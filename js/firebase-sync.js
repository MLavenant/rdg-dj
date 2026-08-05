var SCHED_BAKED = SCHED.map(function(r){ var c=Object.assign({},r); ensureShowUid(c); return c; }); // immutable reference
SCHED.forEach(function(r){ ensureShowUid(r); });

(function(){
  var cfg = {
    apiKey:            "AIzaSyAy8aN1ndDpa6BghLjMkeOdH355zvKxCTE",
    authDomain:        "rdg-dj-dashboard.firebaseapp.com",
    databaseURL:       "https://rdg-dj-dashboard-default-rtdb.firebaseio.com",
    projectId:         "rdg-dj-dashboard",
    storageBucket:     "rdg-dj-dashboard.firebasestorage.app",
    messagingSenderId: "46000430246",
    appId:             "1:46000430246:web:19e9705e453cc50d64e867"
  };
  firebase.initializeApp(cfg);
  window._fbDb  = firebase.database();
  window._fbRef = window._fbDb.ref('rdg');
  try{ window._fbStorage = firebase.storage(); }catch(e){ window._fbStorage = null; }
  window._fbReady = false;

  /* ?? Write helper ??????????????????????????????????????????????? */
  window._fbSave = function(path, value){
    window._fbRef.child(path).set(value === undefined ? null : value);
  };

  /* ?? Rebuild SCHED from baked + Firebase overrides ????????????? */
  function _mergeSchedEdit(target, edit){
    if(!target || !edit) return;
    /* Pure status patches must never touch artist identity.
       Older clients wrote _writeKind:'djStatus' ON TOP of full records via
       .update(), which made us ignore dj/fee and snap back to bake — looked
       like "changing status changed another DJ's name/fee". If identity
       fields are present, treat as a full live edit. */
    var hasIdentity = (edit.dj!=null && edit.dj!=='') || edit.fee!=null || edit.cost!=null || !!edit.d;
    if(edit._writeKind==='djStatus' && !hasIdentity){
      target.djStatus = edit.djStatus==null ? null : edit.djStatus;
      return;
    }
    /* Live edits are the source of truth — apply as saved (including ??? names). */
    Object.assign(target, edit);
  }
  window._fbApplySched = function(ov){
    // Start from baked copy
    var s = SCHED_BAKED.map(function(r){ var c=Object.assign({},r); ensureShowUid(c); return c; });
    if(!ov) { SCHED = s; IDX = buildIdx(SCHED); return; }
    var edits = ov.edits || {};
    var editKeys = Object.keys(edits);
    /* Apply uid-keyed edits first (venue|date|_uid), then legacy venue|date only when safe. */
    editKeys.forEach(function(k){
      var parts = k.split('|'), venue = parts[0], date = parts[1], uid = parts[2]||'';
      if(!uid) return;
      var idx = s.findIndex(function(r){ return r._uid===uid || (_schedDateKey(r)===(venue+'|'+date) && ensureShowUid(r)===uid); });
      if(idx >= 0){ _mergeSchedEdit(s[idx], edits[k]); ensureShowUid(s[idx]); }
    });
    editKeys.forEach(function(k){
      var parts = k.split('|'), venue = parts[0], date = parts[1], uid = parts[2]||'';
      if(uid) return;
      var hasUidEdit = editKeys.some(function(k2){ return k2.indexOf(venue+'|'+date+'|')===0; });
      if(hasUidEdit) return;
      var matches = s.filter(function(r){ return (r.venue||r.v)===venue && r.d===date; });
      if(matches.length===1){ _mergeSchedEdit(matches[0], edits[k]); ensureShowUid(matches[0]); }
    });
    /* Added shows: legacy array + race-safe addsByUid map */
    var adds = ov.adds ? (Array.isArray(ov.adds)?ov.adds:Object.values(ov.adds)) : [];
    var byUid = ov.addsByUid ? (typeof ov.addsByUid==='object'?ov.addsByUid:{}) : {};
    Object.keys(byUid).forEach(function(uid){ if(byUid[uid]) adds.push(byUid[uid]); });
    adds.forEach(function(r){
      if(!r) return;
      ensureShowUid(r);
      r._added=1;
      var exists = s.some(function(x){ return x._uid===r._uid; });
      if(!exists) s.push(r);
    });
    /* Deletes: exact uid key, or legacy venue|date (whole day) */
    var dels = ov.deletes ? (Array.isArray(ov.deletes)?ov.deletes:Object.values(ov.deletes)) : [];
    s = s.filter(function(r){
      var dateKey=_schedDateKey(r);
      var uidKey=_schedUidKey(r);
      for(var di=0;di<dels.length;di++){
        var dk=dels[di];
        if(!dk) continue;
        var p=String(dk).split('|');
        if(p.length>=3){ if(uidKey===dk) return false; }
        else if(dateKey===dk) return false;
      }
      return true;
    });
    s.forEach(function(r){ if(r&&r.dj) r.dj=fixKnownAccents(r.dj); ensureShowUid(r); });
    SCHED = s;
    IDX   = buildIdx(SCHED);
    if(typeof recalcAllSchedTargets==='function') recalcAllSchedTargets();
  };

  /* ?? Apply full Firebase snapshot ?????????????????????????????? */
  window._fbApply = function(data){
    data = data || {};
    // specialWeeks
    if(data.specialWeeks) specialWeeks = data.specialWeeks;
    // VENUE_ROI_RULES first so target recalc uses latest rules
    if(data.venueRoiRules) VENUE_ROI_RULES = data.venueRoiRules;
    // SCHED overrides
    window._fbApplySched(data.schedOverrides);
    // FEE_TIERS
    if(data.feeTiers){
      FEE_TIERS = Array.isArray(data.feeTiers) ? data.feeTiers : Object.values(data.feeTiers);
    }
    // MONTHLY_DJ_BUDGET
    if(data.monthlyDjBudget){
      var fbB=data.monthlyDjBudget;
      Object.keys(fbB||{}).forEach(function(venue){
        if(!MONTHLY_DJ_BUDGET[venue]) MONTHLY_DJ_BUDGET[venue]={};
        Object.keys(fbB[venue]||{}).forEach(function(year){
          if(isMisassigned2024Budget(venue,year)) return;
          if(!MONTHLY_DJ_BUDGET[venue][year]) MONTHLY_DJ_BUDGET[venue][year]={};
          Object.keys(fbB[venue][year]||{}).forEach(function(mm){
            var val=fbB[venue][year][mm];
            if(val!=null) MONTHLY_DJ_BUDGET[venue][year][mm]=val;
          });
        });
      });
    }
    if(data.bgtPlan) deepMergeBgtPlan(data.bgtPlan);
    if(data.bgtCatSpend){
      Object.keys(data.bgtCatSpend||{}).forEach(function(k){
        if(data.bgtCatSpend[k]!=null) BGT_CAT_SPEND[k]=data.bgtCatSpend[k];
      });
      try{ localStorage.setItem('rdg_bgt_cat_spend_v1', JSON.stringify(BGT_CAT_SPEND)); }catch(e){}
    }
    if(data.bgtCustomCats && Array.isArray(data.bgtCustomCats)){
      BGT_CUSTOM_CATS=data.bgtCustomCats;
      try{ localStorage.setItem('rdg_bgt_custom_cats_v1', JSON.stringify(BGT_CUSTOM_CATS)); }catch(e){}
    }
    applyOfficialH2Budgets();
    // Accounting status + history
    if(data.acctData) acctData = data.acctData;
    if(data.acctOthersData){
      var fo=data.acctOthersData;
      Object.keys(fo||{}).forEach(function(k){
        if(fo[k]!=null) acctOthersData[k]=fo[k];
      });
    }

    /* Toast BS Actuals must re-apply after every sched rebuild — edits/baked
       can otherwise wipe a later toastActuals overlay until that node changes. */
    if(window._toastActuals && typeof window._applyToastActuals==='function'){
      window._applyToastActuals(window._toastActuals);
    }

    if(window._fbReady){
      if(curView==='vip')             renderVIP();
      else if(curView==='forecast')   renderForecast();
      else if(curView==='live')       renderLive();
      else if(curView==='system')     renderSystem();
      else if(curView==='accounting') renderAccounting();
      else if(curView==='budget'){
        /* Do not rebuild the Budget Planner while the user is typing — Firebase
           echo of local saves was wiping inputs after one keystroke. */
        var typing=!!window._bgtPlayTyping;
        var ae=document.activeElement;
        if(ae && ae.closest && ae.closest('#budget2027Builder')) typing=true;
        if(!typing && typeof _budgetInited!=='undefined' && _budgetInited && typeof renderBudget==='function') renderBudget();
      }
      else                            go();
    }
  };

  /* Live listener — fires immediately on load and on any change */
  window._fbRef.on('value', function(snap){
    var firstLoad=!window._fbReady;
    if(firstLoad) window._fbReady = true;
    window._fbApply(snap.val());
    if(firstLoad){
      var el = document.getElementById('fbSyncDot');
      if(el){ el.style.background='#22c55e'; el.title='Live sync active'; }
      /* First snapshot previously skipped go() because _fbReady was still false
         inside _fbApply — calendar could show baked TBD while SCHED already had
         a Firebase override (e.g. wrong DJ in the edit modal). */
      if(typeof go==='function') go();
    }
  });

  /* ?? Pacing history listener (separate ref, read-only) ????????????????????? */
  window._pacingData = {};  // { "venue_YYYY-MM-DD": { "2026-07-10": {tables,revenue}, ... } }
  window._fbDb.ref('rdg/pacing').on('value', function(snap){
    window._pacingData = snap.val() || {};
    if(window._fbReady && curView==='forecast') renderForecast();
    if(window._fbReady && curView==='vip') renderVIP();
  });

  /* Week-level Toast tier actuals (key = ISOWeek|Venue). Merges on top of baked VIP_WEEK_TIER_ACTUALS. */
  window._vipTierActuals = {};
  window._fbDb.ref('rdg/vipTierActuals').on('value', function(snap){
    window._vipTierActuals = snap.val() || {};
    if(window._fbReady && curView==='vip') renderVIP();
  });

  /* Live Forecast Actuals from unattended FourVenues job (Sales-export math).
     Overrides baked FORECAST_DATA so every viewer sees morning updates without a Pages redeploy. */
  window._forecastLive = null;
  function _applyForecastLive(live){
    window._forecastLive = live || null;
    if(!live || !live.events || typeof FORECAST_DATA==='undefined') return;
    var n = 0;
    FORECAST_DATA.forEach(function(e){
      var key = (e.venue + '_' + e.date).replace(/[^a-zA-Z0-9_-]/g, '_');
      var row = live.events[key];
      if(!row) return;
      if(row.totalRevenue != null && (row.hasData || row.totalRevenue>0 || e.totalRevenue==null)) e.totalRevenue = row.totalRevenue;
      if(row.bookedTables != null && (row.hasData || row.bookedTables>0 || !e.bookedTables)) e.bookedTables = row.bookedTables;
      if(row.totalTables != null && (row.hasData || row.totalTables>0 || !e.totalTables)) e.totalTables = row.totalTables;
      if(row.dj != null && row.dj !== '') e.dj = row.dj;
      if(row.tierSummary) e.tierSummary = row.tierSummary;
      e.hasData = row.hasData != null ? row.hasData : true;
      e._source = row._source || 'forecast_live';
      n++;
    });
    return n;
  }
  window._fbDb.ref('rdg/forecastLive').on('value', function(snap){
    var live = snap.val() || null;
    var n = _applyForecastLive(live) || 0;
    if(window._fbReady && curView==='forecast') renderForecast();
    if(window._fbReady && curView==='vip') renderVIP();
    var meta = document.getElementById('fcastMeta');
    if(meta && live && live.updatedAt){
      try{
        var when = new Date(live.updatedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
        meta.textContent = 'BS Actual = FourVenues live ('+when+') ? '+(live.source||'export math')+' ? synced for all users';
      }catch(e){}
    }
  });

  /* Toast BS Actual cloud overlay ? same pattern as forecastLive so calendar
     updates even when the Pages commit reports "No dashboard changes". */
  window._toastActuals = null;
  function _applyToastActuals(live){
    window._toastActuals = live || null;
    if(!live || !live.byVenueDate) return 0;
    var n = 0;
    SCHED.forEach(function(r){
      if(!r || !r.d) return;
      var venue = r.venue || r.v;
      var byDate = live.byVenueDate[venue];
      if(!byDate || byDate[r.d] == null) return;
      var next = byDate[r.d];
      if(r.bs_a === next) return;
      r.bs_a = next;
      var fee = r.fee || r.cost || 0;
      var tgt = (typeof showTargets==='function') ? showTargets(r) : {bs_m:r.bs_m};
      var bsM = (tgt && tgt.bs_m!=null) ? tgt.bs_m : r.bs_m;
      if(bsM != null){
        r.bs_m = bsM;
        r.beat = next >= bsM ? 1 : 0;
        r._s = next >= bsM ? 'beat' : 'miss';
      }
      if(tgt && tgt.roi_t!=null) r.roi_t = tgt.roi_t;
      r.roi_a = fee > 0 ? Math.round(next / fee * 10000) / 10000 : r.roi_a;
      n++;
    });
    if(n && typeof IDX !== 'undefined') IDX = buildIdx(SCHED);
    return n;
  }
  window._applyToastActuals = _applyToastActuals;
  window._fbDb.ref('rdg/toastActuals').on('value', function(snap){
    var live = snap.val() || null;
    var n = _applyToastActuals(live) || 0;
    if(window._fbReady && n){
      if(curView==='calendar') go();
      else if(curView==='accounting') renderAccounting();
      else if(curView==='leaderboard') renderLeaderboard();
      else if(curView==='allshows') renderAllShows();
      else if(curView==='summary') renderSummary();
    }
  });

  /* Toast LIVE night-of BS (11pm?3am pulls) */
  window._liveNight = null;
  window._fbDb.ref('rdg/liveNight').on('value', function(snap){
    var prev = window._liveNight;
    window._liveNight = snap.val() || null;
    if(window._fbReady && curView==='live'){
      // Animate dollar increases when Firebase pushes a higher total
      var shouldAnim = false;
      try{
        if(prev && window._liveNight && prev.salesByVenue && window._liveNight.salesByVenue){
          Object.keys(window._liveNight.salesByVenue).forEach(function(v){
            var a = prev.salesByVenue[v], b = window._liveNight.salesByVenue[v];
            if(b!=null && a!=null && b>a) shouldAnim = true;
          });
        }
      }catch(e){}
      renderLive(shouldAnim);
    }
  });

  window._scrapeStatus = {};
  window._fbDb.ref('rdg/scrapeStatus').on('value', function(snap){
    window._scrapeStatus = snap.val() || {};
    if(curView==='system') renderSystem();
  });
  window._rdgConfig = {};
  window._fbDb.ref('rdg/config').on('value', function(snap){
    window._rdgConfig = snap.val() || {};
    if(curView==='system') renderSystem();
  });
  window._liveRefreshRequest = null;
  window._fbDb.ref('rdg/liveRefreshRequest').on('value', function(snap){
    window._liveRefreshRequest = snap.val() || null;
    if(curView==='system') renderSystem();
  });
})();
var calViewMode = 'list';
function toggleCalView(v){ calViewMode=v; go(); }

function acctKey(d){ return acctVenue()+'|'+curYr+'|'+d.slice(5,7)+'|'+d; }
function othersKey(ds, catId){ return curAcctV+'|'+curYr+'|'+ds.slice(5,7)+'|'+ds+'|'+catId; }
function getOthersCell(ds, catId){
  var k=othersKey(ds, catId);
  if(!acctOthersData[k]) acctOthersData[k]={name:'',cost:null};
  return acctOthersData[k];
}
function setOthersField(ds, catId, field, val){
  var k=othersKey(ds, catId);
  var before=acctOthersData[k] ? {name:acctOthersData[k].name, cost:acctOthersData[k].cost} : {name:'',cost:null};
  pushUndo('Edit Others '+catId, function(){
    acctOthersData[k]=before;
    if(window._fbSave) window._fbSave('acctOthersData/'+k, before);
    try{ localStorage.setItem('rdg_acct_others_v1', JSON.stringify(acctOthersData)); }catch(e){}
    renderAccounting();
  });
  if(!acctOthersData[k]) acctOthersData[k]={name:'',cost:null};
  if(field==='cost'){
    if(val===''||val==null) acctOthersData[k].cost=null;
    else {
      var n=parseFloat(val);
      acctOthersData[k].cost=isNaN(n)?null:n;
    }
  } else {
    acctOthersData[k].name=val==null?'':String(val);
  }
  if(window._fbSave) window._fbSave('acctOthersData/'+k, acctOthersData[k]);
  try{ localStorage.setItem('rdg_acct_others_v1', JSON.stringify(acctOthersData)); }catch(e){}
}
(function loadAcctOthersLocal(){
  try{
    var saved=JSON.parse(localStorage.getItem('rdg_acct_others_v1')||'{}')||{};
    Object.keys(saved).forEach(function(k){
      if(!acctOthersData[k]) acctOthersData[k]=saved[k];
    });
  }catch(e){}
})();
var ACCT_DEFAULT_CATS = ['Rider','Resident DJ','Fire Show','Cryo','Sound System'];
var ACCT_DJ_STATUS=["Offer sent","Hold 1","Confirmed"];
var ACCT_AP_STATUS=["On Workflow","Contract + invoice received","Missing contract","Missing invoice","Missing forms","Missing Countersign","Missing Mika Signature","Deposit paid","Paid"];
var ACCT_STATUS_OPTIONS=ACCT_DJ_STATUS.concat(ACCT_AP_STATUS);
function getAcct(d){
  var k=acctKey(d);
  if(!acctData[k]){
    acctData[k]={items:ACCT_DEFAULT_CATS.map(function(c){return {name:c,amount:null};}),r365:0,djStatus:null,apStatus:null,contracts:[],invoices:[],log:[]};
  }
  return _acctNormalize(acctData[k]);
}
function _pushAcctUndo(label){
  var before=_clone(acctData);
  pushUndo(label,function(){
    acctData=_clone(before)||{};
    _acctPersist();
  });
}
function addAcctItem(ds){
  _pushAcctUndo('Add accounting cost line');
  var acct=getAcct(ds);
  acct.items.push({name:'Other',amount:null});
  renderAccounting();
}
function removeAcctItem(ds,idx){
  _pushAcctUndo('Remove accounting cost line');
  var acct=getAcct(ds);
  acct.items.splice(idx,1);
  renderAccounting();
}
function acctTotal(d){
  var r=SCHED.filter(function(s){return s.v===curV&&s.d===d&&s._s!=='empty';});
  var djFee=r.reduce(function(s,x){return s+(x.fee||x.cost||0);},0);
  var extraTotal=(getAcct(d).items||[]).reduce(function(s,it){return s+(it.amount||0);},0);
  return djFee+extraTotal;
}

function swKey(mm){ return curV+'|'+curYr+'|'+mm; }
function getSpecialWeeks(mm){ return specialWeeks[swKey(mm)]||[]; }
function daySpecialLabel(ds){
  /* 1. Check runtime special weeks */
  var mm=ds.slice(5,7), day=parseInt(ds.slice(8,10),10);
  var sws=getSpecialWeeks(mm);
  for(var i=0;i<sws.length;i++) if(day>=sws[i].startDay&&day<=sws[i].endDay) return sws[i].label;
  /* 2. Fall back to ev field on any SCHED record for this date */
  var recs=SCHED.filter(function(r){return r.v===curV&&r.d===ds&&r.ev;});
  if(recs.length) return recs[0].ev;
  return null;
}
function _escAttr(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;');
}
function _evLabelHtml(evLabel, ds){
  if(!evLabel) return '';
  var enc=encodeURIComponent(evLabel);
  var dsEnc=encodeURIComponent(ds||'');
  return '<span class="sc-ev-label" onclick="event.stopPropagation();openEditSpecialWeek(decodeURIComponent(\''+enc+'\'), decodeURIComponent(\''+dsEnc+'\'))" '
    +'title="Click to edit or remove this period" style="cursor:pointer">'
    +evLabel.replace(/</g,'&lt;')+'</span>';
}

/*    month/year navigation                                       */
function prevM(){ curM--; if(curM<0){curM=11;curYr--;buildYrPills();} go(); }
function nextM(){ curM++; if(curM>11){curM=0;curYr++;buildYrPills();} go(); }
function prevAcctM(){ acctM--; if(acctM<0) acctM=11; renderAccounting(); }
function nextAcctM(){ acctM++; if(acctM>11) acctM=0; renderAccounting(); }
function jumpMonth(m){ curM=m; setView('calendar'); }
function closeMonthSummary(){
  var el=document.getElementById('monthSumModal');
  if(el) el.remove();
}
function openMonthSummary(mo){
  closeMonthSummary();
  var mm=(mo+1<10?'0':'')+(mo+1);
  var perf=monthPerfFromSched(curYr, curV, mm);
  var title=MN_FULL[mo]+' '+curYr;
  var br=perf.measured?Math.round(perf.beats/perf.measured*100):null;
  var rowsHtml=perf.shows.map(function(x){
    var dt=new Date(x.d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    var st=x._s==='beat'?'Beat':x._s==='miss'?'Miss':x._s==='fut'?'Upcoming':x._s==='nd'?'No actual':(x._s||'?');
    return '<tr>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);white-space:nowrap;color:var(--ink3)">'+dt+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);font-weight:800" class="'+x.bTone+'">'+(djLabel(x.dj)||'TBD')+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right">'+$k(x.fee)+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right">'+$k(x.bs_m)+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right" class="'+x.bTone+'"><b>'+$k(x.bs_a)+'</b></td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right" class="'+x.rTone+'"><b>'+rx(x.roi_a)+'</b></td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:center"><span class="pill '+(x._s==='beat'?'p-beat':x._s==='miss'?'p-miss':'p-nd')+'">'+st+'</span></td>'
      +'</tr>';
  }).join('') || '<tr><td colspan="7" style="padding:16px;color:var(--ink3)">No shows</td></tr>';

  var modal=document.createElement('div');
  modal.id='monthSumModal';
  modal.className='modal-bg';
  modal.onclick=function(ev){ if(ev.target===modal) closeMonthSummary(); };
  modal.innerHTML='<div class="modal" style="width:min(720px,96vw)" onclick="event.stopPropagation()">'
    +'<div class="modal-hd"><h3>'+title+' ? '+curV+'</h3>'
    +'<button class="modal-close" onclick="closeMonthSummary()">&#10005;</button></div>'
    +'<div class="modal-body" style="gap:12px">'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +'<div style="flex:1;min-width:110px;background:var(--card2);border-radius:10px;padding:10px 12px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">BS Actual</div><div style="font-size:20px;font-weight:900">'+$k(perf.tBS)+'</div></div>'
    +'<div style="flex:1;min-width:110px;background:var(--card2);border-radius:10px;padding:10px 12px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">BS Target</div><div style="font-size:20px;font-weight:900">'+$k(perf.tBSM)+'</div></div>'
    +'<div style="flex:1;min-width:110px;background:var(--card2);border-radius:10px;padding:10px 12px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">Beat</div><div style="font-size:20px;font-weight:900" class="'+(br!=null&&br>=60?'beat':'miss')+'">'+(perf.measured?perf.beats+'/'+perf.measured:'?')+(br!=null?' <span style="font-size:12px">('+br+'%)</span>':'')+'</div></div>'
    +'<div style="flex:1;min-width:110px;background:var(--card2);border-radius:10px;padding:10px 12px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">Avg ROI</div><div style="font-size:20px;font-weight:900;color:var(--blue)">'+(perf.avgR!=null?perf.avgR.toFixed(1)+'x':'?')+'</div></div>'
    +'</div>'
    +'<div style="overflow:auto;max-height:55vh;border:0.5px solid var(--hair);border-radius:10px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'
    +'<th style="text-align:left;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Date</th>'
    +'<th style="text-align:left;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">DJ</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Fee</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Target</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Actual</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">ROI</th>'
    +'<th style="text-align:center;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Status</th>'
    +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'
    +'</div>'
    +'<div class="modal-foot">'
    +'<button type="button" class="btn-pdf" onclick="closeMonthSummary()">Close</button>'
    +'<button type="button" class="btn-pdf" style="background:var(--ink);color:#fff;border-color:var(--ink)" onclick="closeMonthSummary();jumpMonth('+mo+')">Open calendar</button>'
    +'</div></div>';
  document.body.appendChild(modal);
}


/*                                                               
   CALENDAR   full scheduling list view
                                                                  */
