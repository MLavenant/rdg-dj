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
  if(typeof firebase==='undefined'){
    console.error('Firebase SDK failed to load — check network / ad blocker');
    try{
      var el0=document.getElementById('fbSyncDot');
      if(el0){ el0.style.background='#ef4444'; el0.title='Firebase SDK blocked — allow gstatic.com / firebaseio.com'; }
    }catch(e0){}
    return;
  }
  try{
    firebase.initializeApp(cfg);
    window._fbDb  = firebase.database();
    window._fbRef = window._fbDb.ref('rdg');
  }catch(eInit){
    console.error('Firebase init failed', eInit);
    try{
      var el1=document.getElementById('fbSyncDot');
      if(el1){ el1.style.background='#ef4444'; el1.title='Firebase init failed'; }
    }catch(e1){}
    return;
  }
  try{ window._fbStorage = firebase.storage(); }catch(e){ window._fbStorage = null; }
  window._fbReady = false;

  function _setSyncDot(color, title){
    try{
      var el=document.getElementById('fbSyncDot');
      if(!el) return;
      el.style.background=color;
      if(title) el.title=title;
    }catch(eDot){}
  }
  var _fbBootAt=Date.now();
  /* Surface websocket state even before the first schedule snapshot arrives.
     Do not paint red on the initial false blip from .info/connected. */
  try{
    window._fbDb.ref('.info/connected').on('value', function(snap){
      if(window._fbReady) return;
      if(snap.val()===true) _setSyncDot('#f59e0b', 'Connected — loading schedule…');
      else if(Date.now()-_fbBootAt>4000){
        _setSyncDot('#ef4444', 'Offline — check network / VPN / ad blocker');
      }
    });
  }catch(eConn){}
  setTimeout(function(){
    if(window._fbReady) return;
    _setSyncDot('#ef4444', 'Still connecting after 15s — allow *.firebaseio.com and refresh');
  }, 15000);

  function _compactBackupRow(r){
    if(!r||!r.d) return null;
    var y=String(r.d).slice(0,4);
    if(y!=='2025' && y!=='2026' && y!=='2027') return null;
    ensureShowUid(r);
    return {
      _uid: r._uid,
      v: r.v||r.venue||'',
      venue: r.venue||r.v||'',
      d: r.d,
      dj: r.dj||'',
      fee: r.fee!=null?r.fee:null,
      cost: r.cost!=null?r.cost:(r.fee!=null?r.fee:null),
      djStatus: r.djStatus||null,
      agency: r.agency||null,
      ev: r.ev||'',
      note: r.note||null,
      vipNote: r.vipNote||null,
      _added: r._added?1:0
    };
  }
  function _maybeWeeklySchedBackup(ov){
    if(!window._fbRef || window._schedBackupTried) return;
    window._schedBackupTried=1;
    window._fbRef.child('scheduleBackups/latest/savedAt').once('value', function(snap){
      var prev=snap && snap.val();
      if(prev){
        var age=Date.now()-Date.parse(prev);
        if(age < 6*24*60*60*1000) return;
      }
      var calendar={};
      var byYear={ '2025':0, '2026':0, '2027':0 };
      (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
        var row=_compactBackupRow(r);
        if(!row) return;
        calendar[row._uid]=row;
        var y=String(row.d).slice(0,4);
        if(byYear[y]!=null) byYear[y]+=1;
      });
      var count=Object.keys(calendar).length;
      if(!count) return;
      var payload={
        name: 'schedule latest',
        key: 'latest',
        years: ['2025','2026','2027'],
        savedAt: new Date().toISOString(),
        count: count,
        byYear: byYear,
        calendar: calendar,
        liveShows: (ov && ov.shows) || {},
        liveDeletes: (ov && ov.deletes) || null,
        source: 'client'
      };
      window._fbRef.child('scheduleBackups').set({
        latest: payload,
        _meta: {
          lastKey: 'latest',
          lastName: payload.name,
          lastAt: payload.savedAt,
          lastCount: count,
          byYear: byYear
        }
      });
    });
  }

  window._fbSave = function(path, value){
    try{
      window._fbRef.child(path).set(value === undefined ? null : value, function(err){
        if(err){
          console.error('Firebase write failed', path, err);
          _setSyncDot('#ef4444', 'Write denied — check Firebase rules / network');
        }
      });
    }catch(eSave){
      console.error('Firebase write threw', path, eSave);
      _setSyncDot('#ef4444', 'Write failed — check Firebase / console');
    }
  };

  function _swMetaKey(k){ return k==='_migrated' || k==='migratedAt'; }
  function _ymdShift(dateStr, days){
    var d=new Date(dateStr+'T12:00:00');
    d.setDate(d.getDate()+days);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function _stripSwRecordMeta(recs){
    var out={};
    Object.keys(recs||{}).forEach(function(k){
      if(_swMetaKey(k)) return;
      var r=recs[k];
      if(!r || typeof r!=='object') return;
      out[k]={ _uid:k, v:r.v, label:r.label, start:r.start, end:r.end, updatedAt:r.updatedAt||null };
    });
    return out;
  }
  function _expandSwRecordsToMap(recs){
    var map={};
    Object.keys(recs||{}).forEach(function(uid){
      if(_swMetaKey(uid)) return;
      var rec=recs[uid];
      if(!rec || !rec.v || !rec.label || !rec.start || !rec.end) return;
      var sd=new Date(rec.start+'T12:00:00'), ed=new Date(rec.end+'T12:00:00');
      if(isNaN(sd.getTime())||isNaN(ed.getTime())||sd>ed) return;
      var cur=new Date(sd);
      while(cur<=ed){
        var yr2=cur.getFullYear(), mo2=cur.getMonth();
        var mm2=(mo2+1<10?'0':'')+(mo2+1);
        var startDay=cur.getDate();
        var monthEnd=new Date(yr2,mo2+1,0);
        var endInMonth=ed<=monthEnd?ed:monthEnd;
        var k=rec.v+'|'+yr2+'|'+mm2;
        if(!map[k]) map[k]=[];
        map[k].push({ label:rec.label, startDay:startDay, endDay:endInMonth.getDate(), _uid:uid });
        cur=new Date(yr2, mo2+1, 1);
      }
    });
    return map;
  }
  function _legacySpecialWeeksToRecords(sw){
    var pieces=[];
    Object.keys(sw||{}).forEach(function(k){
      if(_swMetaKey(k)) return;
      var parts=k.split('|');
      if(parts.length<3) return;
      var v=parts[0], yr=parts[1], mm=parts[2];
      (sw[k]||[]).forEach(function(band){
        if(!band || !band.label) return;
        pieces.push({
          v:v,
          label:String(band.label).trim(),
          start:yr+'-'+mm+'-'+String(band.startDay).padStart(2,'0'),
          end:yr+'-'+mm+'-'+String(band.endDay).padStart(2,'0')
        });
      });
    });
    pieces.sort(function(a,b){
      var ka=a.v+'|'+String(a.label).toUpperCase()+'|'+a.start;
      var kb=b.v+'|'+String(b.label).toUpperCase()+'|'+b.start;
      return ka<kb?-1:ka>kb?1:0;
    });
    var merged=[];
    pieces.forEach(function(p){
      var prev=merged[merged.length-1];
      if(prev && prev.v===p.v && String(prev.label).toUpperCase()===String(p.label).toUpperCase()){
        if(p.start<=_ymdShift(prev.end, 1)){
          if(p.end>prev.end) prev.end=p.end;
          return;
        }
      }
      merged.push({ v:p.v, label:p.label, start:p.start, end:p.end });
    });
    var recs={};
    merged.forEach(function(p,i){
      var uid='sw_mig_'+i+'_'+String(p.v).replace(/\W+/g,'_')+'_'+String(p.start).replace(/-/g,'');
      recs[uid]={ v:p.v, label:p.label, start:p.start, end:p.end };
    });
    return recs;
  }
  function _kickSpecialWeekMigrate(legacy){
    if(window._swMigrateLock || !window._fbRef) return;
    window._swMigrateLock=true;
    window._fbRef.child('specialWeekRecords').transaction(function(cur){
      if(cur && cur._migrated) return cur;
      var recs=_legacySpecialWeeksToRecords(legacy);
      if(cur){
        Object.keys(cur).forEach(function(k){
          if(_swMetaKey(k)) return;
          recs[k]=cur[k];
        });
      }
      recs._migrated=true;
      recs.migratedAt=new Date().toISOString();
      return recs;
    }, function(){ window._swMigrateLock=false; });
  }
  window._expandSwRecordsToMap=_expandSwRecordsToMap;
  window._stripSwRecordMeta=_stripSwRecordMeta;
  try{
    if(typeof _sessionIsActive==='function' && !_sessionIsActive() && window._fbDb){
      window._fbDb.goOffline();
    }
  }catch(eOff){}

  /* Local write-guards protect YOUR in-flight rename against a bake rebuild /
     Firebase echo for a few seconds. They must NOT permanently override other
     users' live edits (that froze DJ name/fee on other sessions). */
  var _SCHED_GUARD_GRACE_MS = 8000;
  var _SCHED_EDIT_STORE = 'rdg_sched_edits_v2';
  var _SCHED_DEL_STORE = 'rdg_sched_deleted_v1';
  var _SCHED_CLEAR_STORE = 'rdg_sched_cleared_nights_v1';
  window._schedWriteGuard = window._schedWriteGuard || {};
  window._schedDeletedUids = window._schedDeletedUids || {};
  window._schedClearedNights = window._schedClearedNights || {};
  window._schedSeenRemote = window._schedSeenRemote || {};
  window._lastWorkbookUids = window._lastWorkbookUids || {};
  window._lastWorkbookActive = false;
  function _schedGuardIsFresh(g){
    if(!g || !g.at) return false;
    return (Date.now() - Number(g.at)) <= _SCHED_GUARD_GRACE_MS;
  }
  function _loadSchedEditStore(){
    try{
      var raw=sessionStorage.getItem(_SCHED_EDIT_STORE);
      var obj=raw?JSON.parse(raw):{};
      if(obj && typeof obj==='object'){
        Object.keys(obj).forEach(function(uid){
          if(obj[uid] && !window._schedWriteGuard[uid]) window._schedWriteGuard[uid]=obj[uid];
        });
      }
    }catch(e){}
    try{
      var draw=sessionStorage.getItem(_SCHED_DEL_STORE);
      var dobj=draw?JSON.parse(draw):{};
      if(dobj && typeof dobj==='object'){
        Object.keys(dobj).forEach(function(uid){
          if(dobj[uid]) window._schedDeletedUids[uid]=dobj[uid];
        });
      }
    }catch(e2){}
    try{
      var craw=sessionStorage.getItem(_SCHED_CLEAR_STORE);
      var cobj=craw?JSON.parse(craw):{};
      if(cobj && typeof cobj==='object'){
        Object.keys(cobj).forEach(function(nk){
          if(cobj[nk] && !window._schedClearedNights[nk]) window._schedClearedNights[nk]=cobj[nk];
        });
      }
    }catch(e3){}
  }
  function _saveSchedEditStore(){
    try{ sessionStorage.setItem(_SCHED_EDIT_STORE, JSON.stringify(window._schedWriteGuard||{})); }catch(e){}
    try{ sessionStorage.setItem(_SCHED_DEL_STORE, JSON.stringify(window._schedDeletedUids||{})); }catch(e2){}
    try{ sessionStorage.setItem(_SCHED_CLEAR_STORE, JSON.stringify(window._schedClearedNights||{})); }catch(e3){}
  }
  _loadSchedEditStore();
  /* Drop pre-v4.24 identity guards — they froze DJ name/fee across sessions. */
  try{
    if(sessionStorage.getItem('rdg_sched_guard_ver')!=='v5'){
      window._schedWriteGuard={};
      sessionStorage.removeItem(_SCHED_EDIT_STORE);
      sessionStorage.setItem('rdg_sched_guard_ver','v5');
    }
  }catch(eGuardVer){}
  window._guardSchedWrite = function(rec){
    if(!rec || !rec.d) return;
    ensureShowUid(rec);
    /* Saving an ADD must not clear a deleted bake tombstone for the same night —
       that was resurrecting DARMON after delete → add AMOG → delete AMOG. */
    var isAdd=!!rec._added;
    if(!isAdd && window._schedDeletedUids[rec._uid]) delete window._schedDeletedUids[rec._uid];
    if(!isAdd){
      var nk=(rec.v||rec.venue||'')+'|'+rec.d;
      if(window._schedClearedNights && window._schedClearedNights[nk] &&
         window._schedClearedNights[nk].uid===rec._uid){
        delete window._schedClearedNights[nk];
      }
    }
    var kind=rec._writeKind||'modal';
    var prev=(window._schedWriteGuard[rec._uid]||{});
    /* Status/agency patches must NOT freeze DJ name/fee into the local guard —
       that blocked other sessions' renames and re-pushed stale identity. */
    var identityLocked=(kind==='modal' || kind==='evClear');
    window._schedWriteGuard[rec._uid] = {
      at: Date.now(),
      dj: identityLocked ? (rec.dj||'') : (prev.dj!=null?prev.dj:(rec.dj||'')),
      fee: identityLocked ? (rec.fee!=null?rec.fee:null) : (prev.fee!==undefined?prev.fee:(rec.fee!=null?rec.fee:null)),
      cost: identityLocked ? (rec.cost!=null?rec.cost:(rec.fee!=null?rec.fee:null)) : (prev.cost!==undefined?prev.cost:(rec.cost!=null?rec.cost:(rec.fee!=null?rec.fee:null))),
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: rec._uid,
      _added: rec._added||0,
      _writeKind: kind,
      _lockIdentity: identityLocked,
      djStatus: Object.prototype.hasOwnProperty.call(rec,'djStatus') ? (rec.djStatus==null?null:rec.djStatus) : prev.djStatus,
      note: identityLocked ? (rec.note||null) : (prev.note!==undefined?prev.note:(rec.note||null)),
      vipNote: identityLocked ? (rec.vipNote||null) : (prev.vipNote!==undefined?prev.vipNote:(rec.vipNote||null)),
      agency: Object.prototype.hasOwnProperty.call(rec,'agency') ? (rec.agency==null?null:rec.agency) : prev.agency,
      ev: identityLocked ? (rec.ev||'') : (prev.ev!==undefined?prev.ev:(rec.ev||'')),
      bs_a: identityLocked ? (rec.bs_a!=null?rec.bs_a:null) : (prev.bs_a!==undefined?prev.bs_a:(rec.bs_a!=null?rec.bs_a:null)),
      roi_a: identityLocked ? (rec.roi_a!=null?rec.roi_a:null) : (prev.roi_a!==undefined?prev.roi_a:(rec.roi_a!=null?rec.roi_a:null)),
      beat: identityLocked ? (rec.beat!=null?rec.beat:null) : (prev.beat!==undefined?prev.beat:(rec.beat!=null?rec.beat:null)),
      _s: identityLocked ? (rec._s||null) : (prev._s!==undefined?prev._s:(rec._s||null))
    };
    _saveSchedEditStore();
  };
  window._guardClearDeleted = function(rec){
    if(!rec) return;
    ensureShowUid(rec);
    var uid=rec._uid;
    if(window._schedWriteGuard[uid]) delete window._schedWriteGuard[uid];
    window._schedDeletedUids[uid] = {
      at: Date.now(),
      d: rec.d||'',
      v: rec.v||rec.venue||'',
      _uid: uid
    };
    /* Sticky night clear so bake cannot return after delete → add → delete-add. */
    var nk=(rec.v||rec.venue||'')+'|'+(rec.d||'');
    if(nk && nk!=='|'){
      var prev=window._schedClearedNights[nk];
      var deletingBake=false;
      if(window._bakedUidIndex && window._bakedUidIndex[uid]) deletingBake=true;
      else if(!_isAddedRec(rec)){
        try{
          deletingBake=(SCHED_BAKED||[]).some(function(r){
            return r && ensureShowUid(r)===uid;
          });
        }catch(eB){ deletingBake=!_isAddedRec(rec); }
      }
      if(deletingBake){
        window._schedClearedNights[nk] = { uid: uid, at: Date.now(), baked: true };
      } else if(!prev || !prev.baked){
        /* Deleting a replacement add: keep an existing bake clear intact. */
        window._schedClearedNights[nk] = { uid: uid, at: Date.now(), baked: false };
      }
    }
    _saveSchedEditStore();
  };
  function _isAddedRec(rec){ return !!(rec && rec._added); }
  window._guardUndelete = function(rec){
    if(!rec) return;
    ensureShowUid(rec);
    if(window._schedDeletedUids[rec._uid]) delete window._schedDeletedUids[rec._uid];
    var nk=(rec.v||rec.venue||'')+'|'+(rec.d||'');
    if(nk && window._schedClearedNights[nk]) delete window._schedClearedNights[nk];
    _saveSchedEditStore();
  };
  window._bakeUidIsDeleted = function(bakeUid, venue, dateStr){
    if(!bakeUid) return false;
    if(window._schedDeletedUids && window._schedDeletedUids[bakeUid]) return true;
    var nk=(venue||'')+'|'+(dateStr||'');
    if(nk && window._schedClearedNights && window._schedClearedNights[nk] &&
       window._schedClearedNights[nk].uid===bakeUid) return true;
    try{
      var dels=window._lastSchedDeletes||[];
      for(var i=0;i<dels.length;i++){
        var p=String(dels[i]||'').split('|');
        if(p.length>=3 && p[2]===bakeUid) return true;
      }
    }catch(e){}
    return false;
  };
  function _uidIsRemoteDeleted(uid){
    if(!uid) return false;
    var dels=window._lastSchedDeletes||[];
    for(var i=0;i<dels.length;i++){
      var p=String(dels[i]||'').split('|');
      if(p.length>=3 && p[2]===uid) return true;
    }
    return false;
  }
  function _dropWriteGuard(uid){
    if(!uid) return;
    if(window._schedWriteGuard && window._schedWriteGuard[uid]) delete window._schedWriteGuard[uid];
    if(window._schedSeenRemote && window._schedSeenRemote[uid]) delete window._schedSeenRemote[uid];
    _saveSchedEditStore();
  }
  function _nightKey(r){
    if(!r||!r.d) return '';
    return (r.v||r.venue||'')+'|'+r.d;
  }
  function _showScore(r){
    if(!r) return -1;
    var score=0;
    if(r.djStatus) score+=40;
    if(r.dj && String(r.dj).trim() && String(r.dj).toUpperCase()!=='TBD') score+=20;
    if(r.fee!=null || r.cost!=null) score+=10;
    if(r.note) score+=3;
    if(r.vipNote) score+=2;
    if(r.ev) score+=2;
    /* Prefer baked canonical row over a shadow add on the same night. */
    if(!r._added) score+=15;
    return score;
  }
  function _mergeDupFields(keep, lose){
    if(!keep||!lose) return;
    /* Modal / live add identity always wins over bake placeholders.
       Old fill-only-if-empty logic kept bake DJ names when an edit arrived as addsByUid. */
    var loseModal=lose._writeKind==='modal' || lose._writeKind==='evClear';
    if(loseModal || (lose._added && lose.dj && String(lose.dj).trim()!=='')){
      if(lose.dj!=null) keep.dj=lose.dj;
      if(lose.fee!=null || lose.cost!=null){
        keep.fee=lose.fee!=null?lose.fee:lose.cost;
        keep.cost=lose.cost!=null?lose.cost:lose.fee;
      }
    } else {
      if((!keep.dj || String(keep.dj).toUpperCase()==='TBD') && lose.dj) keep.dj=lose.dj;
      if((keep.fee==null && keep.cost==null) && (lose.fee!=null || lose.cost!=null)){
        keep.fee=lose.fee!=null?lose.fee:lose.cost;
        keep.cost=lose.cost!=null?lose.cost:lose.fee;
      }
    }
    if(!keep.djStatus && lose.djStatus) keep.djStatus=lose.djStatus;
    if(!keep.note && lose.note) keep.note=lose.note;
    if(!keep.vipNote && lose.vipNote) keep.vipNote=lose.vipNote;
    if(!keep.agency && lose.agency) keep.agency=lose.agency;
    if(!keep.ev && lose.ev) keep.ev=lose.ev;
    if(keep.bs_a==null && lose.bs_a!=null) keep.bs_a=lose.bs_a;
    if(keep.roi_a==null && lose.roi_a!=null) keep.roi_a=lose.roi_a;
  }
  /* Hard rule: at most one show per venue|date. Heavily edited nights used to
     accumulate bake + addsByUid (or guard re-push) as two calendar rows. */
  function _dedupeSchedOnePerNight(s, cleanup){
    if(!s||!s.length) return s;
    var bestIdx={};
    var dropUid={};
    for(var i=0;i<s.length;i++){
      var r=s[i];
      if(!r||!r.d||r._s==='empty') continue;
      var k=_nightKey(r);
      if(!k) continue;
      if(bestIdx[k]==null){ bestIdx[k]=i; continue; }
      var a=s[bestIdx[k]], b=r;
      var keep=(_showScore(b)>_showScore(a))?b:a;
      var lose=(keep===a)?b:a;
      _mergeDupFields(keep, lose);
      if(keep===b) bestIdx[k]=i;
      if(lose._uid) dropUid[lose._uid]=lose;
    }
    var out=s.filter(function(r){ return !(r && r._uid && dropUid[r._uid]); });
    if(cleanup && typeof cleanup==='function'){
      Object.keys(dropUid).forEach(function(uid){
        try{ cleanup(dropUid[uid], s[bestIdx[_nightKey(dropUid[uid])]]); }catch(e){}
      });
    }
    return out;
  }
  function _cleanupFoldedDuplicate(lose, keep){
    if(!lose||!window._fbRef) return;
    ensureShowUid(lose);
    try{ window._fbRef.child('schedOverrides/addsByUid/'+lose._uid).remove(); }catch(e1){}
    try{
      window._fbRef.child('schedOverrides/adds').transaction(function(vals){
        if(!vals) return vals;
        var arr=Array.isArray(vals)?vals:Object.values(vals);
        var next=arr.filter(function(r){ return !(r && r._uid===lose._uid); });
        return next.length?next:null;
      });
    }catch(e2){}
    if(window._schedWriteGuard && window._schedWriteGuard[lose._uid]){
      delete window._schedWriteGuard[lose._uid];
      _saveSchedEditStore();
    }
    /* Do NOT persistSchedShow(keep) here — that re-wrote bake identity over a
       live modal rename on the same night and broke cross-session name/fee sync. */
  }

  function _reapplySchedGuards(s){
    _loadSchedEditStore();
    var gmap = window._schedWriteGuard || {};
    var deleted = window._schedDeletedUids || {};
    var needRepush = [];
    /* Drop any shows that were locally deleted (tombstones) before guards run. */
    for(var si=s.length-1;si>=0;si--){
      if(s[si] && s[si]._uid && deleted[s[si]._uid]) s.splice(si,1);
    }
    Object.keys(gmap).forEach(function(uid){
      var g = gmap[uid];
      if(!g) return;
      if(deleted[uid]){ delete gmap[uid]; _saveSchedEditStore(); return; }
      var idx = -1;
      for(var i=0;i<s.length;i++){ if(s[i] && String(s[i]._uid||'')===String(uid)){ idx=i; break; } }
      if(idx < 0){
        /* Rename of an existing baked night — retarget by venue|date (never resurrect deletes). */
        if(g.d && (g.v||g.venue) && !g._added){
          var hits = s.filter(function(r){
            return r && !r._added && r.d===g.d && (r.v||r.venue||'')===(g.v||g.venue||'') && !deleted[r._uid];
          });
          if(hits.length===1){
            idx = s.indexOf(hits[0]);
            var bakeUid = ensureShowUid(hits[0]);
            if(bakeUid && bakeUid!==uid){
              g._uid = bakeUid;
              window._schedWriteGuard[bakeUid] = g;
              delete window._schedWriteGuard[uid];
              uid = bakeUid;
              _saveSchedEditStore();
            }
          }
        }
      }
      if(idx < 0){
        /* Never re-push deleted adds. Never create a second show on an occupied night.
           Session A used to resurrect its own add after Session B deleted it,
           because renderCal re-applied the local write-guard. Remote workbook wins. */
        if(g._added && !deleted[uid]){
          var goneRemote=_uidIsRemoteDeleted(uid) ||
            (window._lastWorkbookActive && !(window._lastWorkbookUids && window._lastWorkbookUids[uid]) &&
              ((window._schedSeenRemote && window._schedSeenRemote[uid]) || !_schedGuardIsFresh(g)));
          if(goneRemote){
            delete gmap[uid];
            _saveSchedEditStore();
            return;
          }
          var nightHits = s.filter(function(r){
            return r && r.d===g.d && (r.v||r.venue||'')===(g.v||g.venue||'');
          });
          if(nightHits.length){
            _mergeDupFields(nightHits[0], g);
            var keepUid=ensureShowUid(nightHits[0]);
            g._uid=keepUid;
            g._added=nightHits[0]._added||0;
            window._schedWriteGuard[keepUid]=g;
            if(keepUid!==uid) delete window._schedWriteGuard[uid];
            _saveSchedEditStore();
            needRepush.push(nightHits[0]);
          } else {
            s.push(Object.assign({}, g, {_added:1, _uid:uid}));
            needRepush.push(s[s.length-1]);
          }
        }
        return;
      }
      var cur = s[idx];
      var sameDj = String(cur.dj||'') === String(g.dj||'');
      var curFee = cur.fee!=null?cur.fee:(cur.cost!=null?cur.cost:null);
      var gFee = g.fee!=null?g.fee:(g.cost!=null?g.cost:null);
      var sameFee = (curFee==null && gFee==null) || (curFee!=null && gFee!=null && Number(curFee)===Number(gFee));
      var canLockIdentity=!!g._lockIdentity && (g._writeKind==='modal' || g._writeKind==='evClear' || !!g._added);
      if((!sameDj || !sameFee) && canLockIdentity && _schedGuardIsFresh(g)){
        var remoteAt=cur.updatedAt ? Date.parse(cur.updatedAt) : 0;
        if(remoteAt && remoteAt>Number(g.at||0)){
          delete gmap[uid];
          _saveSchedEditStore();
        } else {
          cur.dj = g.dj;
          cur.fee = g.fee;
          cur.cost = g.cost!=null?g.cost:g.fee;
          if(g._writeKind) cur._writeKind = g._writeKind;
          if(g.note!=null) cur.note = g.note;
          if(g.vipNote!=null) cur.vipNote = g.vipNote;
          if(g.agency !== undefined) cur.agency = g.agency;
          if(g.ev!=null) cur.ev = g.ev;
        }
      } else if(!sameDj || !sameFee){
        delete gmap[uid];
        _saveSchedEditStore();
      }
      /* Do not paint local DJ status/agency over a remote workbook overwrite.
         Session A used to keep its own status after Session B changed it. */
    });
    return needRepush;
  }

  /* ?? Rebuild SCHED from baked + Firebase overrides ????????????? */
  function _mergeSchedEdit(target, edit){
    if(!target || !edit) return;
    var kind=edit._writeKind||'';
    /* Status seeds must not overwrite a live modal DJ name/fee. */
    if(kind==='statusMerge' || kind==='djStatus'){
      if(Object.prototype.hasOwnProperty.call(edit,'djStatus')){
        target.djStatus = edit.djStatus==null ? null : edit.djStatus;
      }
      if(Object.prototype.hasOwnProperty.call(edit,'agency')){
        target.agency = edit.agency==null ? null : edit.agency;
      }
      /* Legacy status seeds wrongly bundled DJ + fee — honor them so saved fees stick. */
      var legacyBundled=(edit.fee!=null||edit.cost!=null) && edit.dj && String(edit.dj).trim()!=='';
      if(legacyBundled){
        target.dj=edit.dj;
        target.fee=edit.fee!=null?edit.fee:edit.cost;
        target.cost=edit.cost!=null?edit.cost:edit.fee;
      } else {
        if((!target.dj || String(target.dj).toUpperCase()==='TBD') && edit.dj) target.dj=edit.dj;
        if((target.fee==null && target.cost==null) && (edit.fee!=null || edit.cost!=null)){
          target.fee=edit.fee!=null?edit.fee:edit.cost;
          target.cost=edit.cost!=null?edit.cost:edit.fee;
        }
      }
      return;
    }
    var hasDj = edit.dj!=null && String(edit.dj).trim()!=='';
    var hasFee = edit.fee!=null || edit.cost!=null;
    if(!hasDj && !hasFee){
      if(Object.prototype.hasOwnProperty.call(edit,'djStatus')){
        target.djStatus = edit.djStatus==null ? null : edit.djStatus;
      }
      if(Object.prototype.hasOwnProperty.call(edit,'ev')){
        target.ev = edit.ev==null ? '' : edit.ev;
      }
      if(Object.prototype.hasOwnProperty.call(edit,'note')){
        target.note = edit.note==null ? null : edit.note;
      }
      if(Object.prototype.hasOwnProperty.call(edit,'vipNote')){
        target.vipNote = edit.vipNote==null ? null : edit.vipNote;
      }
      if(Object.prototype.hasOwnProperty.call(edit,'agency')){
        target.agency = edit.agency==null ? null : edit.agency;
      }
      return;
    }
    if(edit.dj!=null) target.dj=edit.dj;
    if(edit.fee!=null || edit.cost!=null){
      target.fee=edit.fee!=null?edit.fee:edit.cost;
      target.cost=edit.cost!=null?edit.cost:edit.fee;
    }
    Object.assign(target, edit);
    if(target._writeKind==='djStatus') target._writeKind='modal';
    if(target.v && !target.venue) target.venue=target.v;
    if(target.venue && !target.v) target.v=target.venue;
  }
  var _lastSchedOvSig = undefined;
  function _schedOvSig(ov){
    try{ return JSON.stringify(ov==null?null:ov); }catch(e){ return 'err:'+Date.now(); }
  }
  window._fbApplySched = function(ov){
    // Start from baked copy
    var s = SCHED_BAKED.map(function(r){ var c=Object.assign({},r); ensureShowUid(c); return c; });
    if(!ov) {
      var rep0 = _reapplySchedGuards(s);
      SCHED = s; IDX = buildIdx(SCHED);
      _maybeRepushGuards(rep0);
      return;
    }
    /* Single workbook: schedOverrides/shows/{uid} overwrites bake for that show only. */
    var workbook = ov.shows && typeof ov.shows==='object' ? ov.shows : {};
    var workbookUids = Object.keys(workbook).filter(function(uid){ return workbook[uid]; });
    if(workbookUids.length){
      var delsWRaw = ov.deletes ? (Array.isArray(ov.deletes)?ov.deletes:Object.values(ov.deletes)) : [];
      var delsW = delsWRaw.filter(function(dk){ return dk && String(dk).split('|').length>=3; });
      window._lastSchedDeletes = delsW;
      window._lastWorkbookActive = true;
      window._lastWorkbookUids = {};
      workbookUids.forEach(function(uid){
        var edit=workbook[uid];
        if(!edit) return;
        var dead=false;
        for(var di0=0;di0<delsW.length;di0++){
          var p0=String(delsW[di0]||'').split('|');
          if(delsW[di0]===((edit.v||edit.venue||'')+'|'+(edit.d||'')+'|'+uid) || (p0.length>=3 && p0[2]===uid)){
            dead=true; break;
          }
        }
        if(dead) return;
        window._lastWorkbookUids[uid]=1;
        window._schedSeenRemote[uid]=1;
        var idx=s.findIndex(function(r){ return r && String(r._uid||'')===String(uid); });
        if(idx>=0){
          _mergeSchedEdit(s[idx], edit);
          ensureShowUid(s[idx]);
          return;
        }
        var row=Object.assign({}, edit, {_uid:uid});
        ensureShowUid(row);
        var night=_nightKey(row);
        var occupied=night ? s.filter(function(x){ return x && _nightKey(x)===night; }) : [];
        if(occupied.length){
          _mergeSchedEdit(occupied[0], row);
        } else {
          row._added=1;
          s.push(row);
        }
      });
      s = s.filter(function(r){
        if(!r) return false;
        if(window._schedDeletedUids && r._uid && window._schedDeletedUids[r._uid]) return false;
        var uidKey=_schedUidKey(r);
        for(var di=0;di<delsW.length;di++){
          var p=String(delsW[di]||'').split('|');
          if(uidKey===delsW[di] || (p.length>=3 && p[2]===r._uid)) return false;
        }
        return true;
      });
      s.forEach(function(r){ if(r&&r.dj) r.dj=fixKnownAccents(r.dj); ensureShowUid(r); });
      Object.keys(window._schedWriteGuard||{}).forEach(function(uid){
        var g=window._schedWriteGuard[uid];
        if(!g) return;
        if(_uidIsRemoteDeleted(uid) || (window._schedSeenRemote[uid] && !window._lastWorkbookUids[uid])){
          _dropWriteGuard(uid);
        }
      });
      /* Do not re-apply local add/rename guards here — they hid the first
         remote name change on the tab that originally added the show. */
      s=_dedupeSchedOnePerNight(s, null);
      SCHED=s;
      IDX=buildIdx(SCHED);
      if(typeof recalcAllSchedTargets==='function') recalcAllSchedTargets();
      return;
    }
    var edits = ov.edits || {};
    var editKeys = Object.keys(edits);
    var uidAppliedDates = {};
    /* Apply uid-keyed edits first (venue|date|_uid), then legacy venue|date only when safe. */
    editKeys.forEach(function(k){
      var parts = k.split('|'), venue = parts[0], date = parts[1], uid = parts[2]||'';
      if(!uid) return;
      var idx = s.findIndex(function(r){ return r._uid===uid; });
      /* No date-only orphan apply — that could attach another night's edit onto the
         sole show that day when uids drifted. */
      if(idx >= 0){
        _mergeSchedEdit(s[idx], edits[k]);
        ensureShowUid(s[idx]);
        uidAppliedDates[venue+'|'+date]=1;
      }
    });
    editKeys.forEach(function(k){
      var parts = k.split('|'), venue = parts[0], date = parts[1], uid = parts[2]||'';
      if(uid) return;
      /* Skip legacy only when a uid edit actually landed on this venue|date. */
      if(uidAppliedDates[venue+'|'+date]) return;
      var matches = s.filter(function(r){ return (r.venue||r.v)===venue && r.d===date; });
      if(matches.length===1){ _mergeSchedEdit(matches[0], edits[k]); ensureShowUid(matches[0]); }
    });
    /* editsByUid is the live SoT for DJ name/fee (same reliability as addsByUid).
       Apply LAST by exact uid only — never by date — so one show cannot touch another. */
    var byUidEdits = ov.editsByUid ? (typeof ov.editsByUid==='object'?ov.editsByUid:{}) : {};
    Object.keys(byUidEdits).forEach(function(uid){
      var edit=byUidEdits[uid];
      if(!edit) return;
      var idx=s.findIndex(function(r){ return r && String(r._uid||'')===String(uid); });
      if(idx<0) return;
      _mergeSchedEdit(s[idx], edit);
      ensureShowUid(s[idx]);
      var nk=(s[idx].v||s[idx].venue||'')+'|'+(s[idx].d||'');
      if(nk!=='|') uidAppliedDates[nk]=1;
    });
    /* Apply uid deletes BEFORE adds. Legacy day-level tombstones (venue|date)
       are IGNORED — they hid null-fee bake nights (DARMON/ONOMA/BARUT…) and
       caused add/edit freezes. Only uid tombstones can hide a show. */
    var delsRaw = ov.deletes ? (Array.isArray(ov.deletes)?ov.deletes:Object.values(ov.deletes)) : [];
    var dels = [];
    var hadDayLevel = false;
    delsRaw.forEach(function(dk){
      if(!dk) return;
      if(String(dk).split('|').length >= 3) dels.push(dk);
      else hadDayLevel = true;
    });
    window._lastSchedDeletes = dels;
    /* Purge legacy day keys from Firebase so old clients cannot keep re-hiding bake. */
    if(hadDayLevel && window._fbRef && !window._scrubDayDelLock){
      window._scrubDayDelLock = true;
      try{
        window._fbRef.child('schedOverrides/deletes').transaction(function(vals){
          if(!vals) return vals;
          var arr = Array.isArray(vals)?vals:Object.values(vals);
          var next = arr.filter(function(k){ return k && String(k).split('|').length >= 3; });
          if(next.length === arr.length) return vals;
          return next.length ? next : null;
        });
      }catch(eScrub){}
      setTimeout(function(){ window._scrubDayDelLock = false; }, 2500);
    }
    /* Sync sticky night-clears from Firebase uid deletes of baked shows.
       Never auto-clear local bake tombstones just because a snapshot is lagging —
       that resurrected DARMON after delete → add → delete. */
    try{
      if(!window._bakedUidIndex){
        window._bakedUidIndex={};
        (SCHED_BAKED||[]).forEach(function(r){
          if(!r) return;
          window._bakedUidIndex[ensureShowUid(r)]=r;
        });
      }
      var uidDelSet={};
      dels.forEach(function(dk){
        var p=String(dk).split('|');
        if(p.length>=3){
          uidDelSet[p[2]]=1;
          if(window._bakedUidIndex[p[2]]){
            var bakeRow=window._bakedUidIndex[p[2]];
            var nk=(bakeRow.v||bakeRow.venue||'')+'|'+(bakeRow.d||'');
            if(nk && nk!=='|'){
              window._schedClearedNights[nk]={ uid:p[2], at:Date.now(), baked:true };
            }
          }
        }
      });
      /* Only clear a local tombstone when Firebase has an edit AND no uid delete. */
      Object.keys(edits||{}).forEach(function(k){
        var parts=String(k).split('|');
        var uid=parts[2]||(edits[k]&&edits[k]._uid)||'';
        if(!uid || uidDelSet[uid]) return;
        if(window._schedDeletedUids && window._schedDeletedUids[uid]){
          delete window._schedDeletedUids[uid];
        }
        var enk=(parts[0]||'')+'|'+(parts[1]||'');
        if(enk && window._schedClearedNights[enk] && window._schedClearedNights[enk].uid===uid){
          delete window._schedClearedNights[enk];
        }
      });
      _saveSchedEditStore();
    }catch(eClr){}
    s = s.filter(function(r){
      if(!r) return false;
      if(window._schedDeletedUids && r._uid && window._schedDeletedUids[r._uid]) return false;
      var dateKey=_schedDateKey(r);
      var uidKey=_schedUidKey(r);
      /* Cleared night: suppress bake (not live adds) so delete → add → delete
         cannot bring the original bake DJ back. */
      if(!r._added && window._schedClearedNights && window._schedClearedNights[dateKey]){
        var clr=window._schedClearedNights[dateKey];
        if(clr && (clr.baked || clr.uid===r._uid)) return false;
      }
      for(var di=0;di<dels.length;di++){
        var dk=dels[di];
        if(!dk) continue;
        var p=String(dk).split('|');
        if(p.length>=3){
          /* Honor uid deletes always — do not let a stale edit resurrect bake. */
          if(uidKey===dk || (r._uid && p[2]===r._uid)) return false;
        }
      }
      return true;
    });
    /* Added shows: addsByUid is source of truth. Legacy `adds` array often still
       holds the OLD name/fee for the same deterministic uid (e.g. RESIDENT DJ
       before rename to barut). If legacy is applied first, addsByUid is skipped
       via exists-check and the rename vanishes after refresh. */
    var byUid = ov.addsByUid ? (typeof ov.addsByUid==='object'?ov.addsByUid:{}) : {};
    var legacyAdds = ov.adds ? (Array.isArray(ov.adds)?ov.adds:Object.values(ov.adds)) : [];
    var addMap = {};
    legacyAdds.forEach(function(r){
      if(!r) return;
      ensureShowUid(r);
      if(!addMap[r._uid]) addMap[r._uid]=r;
    });
    Object.keys(byUid).forEach(function(uid){
      if(byUid[uid]) addMap[uid]=byUid[uid]; /* always wins over legacy */
    });
    /* editsByUid modal patches for added shows (uid-only identity SoT). */
    var byUidEdits2 = ov.editsByUid ? (typeof ov.editsByUid==='object'?ov.editsByUid:{}) : {};
    Object.keys(byUidEdits2).forEach(function(uid){
      var ed=byUidEdits2[uid];
      if(!ed) return;
      if(addMap[uid]){
        _mergeSchedEdit(addMap[uid], ed);
      } else if(ed._added && ed.d){
        addMap[uid]=Object.assign({}, ed, {_uid:uid, _added:1});
      }
    });
    var adds = Object.keys(addMap).map(function(uid){ return addMap[uid]; });
    var foldedAdds=[];
    var delSet={};
    dels.forEach(function(dk){ if(dk) delSet[dk]=1; });
    adds.forEach(function(r){
      if(!r) return;
      ensureShowUid(r);
      if(window._schedDeletedUids && window._schedDeletedUids[r._uid]) return;
      if(delSet[_schedUidKey(r)] || (r._uid && dels.some(function(dk){
        var p=String(dk||'').split('|'); return p.length>=3 && p[2]===r._uid;
      }))) return;
      r._added=1;
      var existIdx=-1;
      for(var ei=0;ei<s.length;ei++){ if(s[ei] && s[ei]._uid===r._uid){ existIdx=ei; break; } }
      if(existIdx>=0){
        _mergeSchedEdit(s[existIdx], r);
        return;
      }
      var night = _nightKey(r);
      var occupied = night ? s.filter(function(x){ return x && _nightKey(x)===night; }) : [];
      if(occupied.length){
        _mergeDupFields(occupied[0], r);
        foldedAdds.push({lose:r, keep:occupied[0]});
        return;
      }
      s.push(r);
    });
    /* Opportunistic: drop stale legacy adds that addsByUid already superseded
       (same uid or same night) so reloads stop resurrecting old DJ names. */
    if(window._fbRef && legacyAdds.length && Object.keys(byUid).length && !window._scrubLegacyAddsLock){
      window._scrubLegacyAddsLock=true;
      try{
        var coveredNight={};
        Object.keys(byUid).forEach(function(uid){
          var row=byUid[uid]; if(!row||!row.d) return;
          coveredNight[(row.v||row.venue||'')+'|'+row.d]=1;
        });
        window._fbRef.child('schedOverrides/adds').transaction(function(vals){
          if(!vals) return vals;
          var arr=Array.isArray(vals)?vals:Object.values(vals);
          var next=arr.filter(function(r){
            if(!r||!r.d) return false;
            var nk=(r.v||r.venue||'')+'|'+r.d;
            if(coveredNight[nk]) return false;
            return true;
          });
          if(next.length===arr.length) return vals;
          return next.length?next:null;
        });
      }catch(eScrubAdds){}
      setTimeout(function(){ window._scrubLegacyAddsLock=false; }, 5000);
    }
    s.forEach(function(r){ if(r&&r.dj) r.dj=fixKnownAccents(r.dj); ensureShowUid(r); });
    var rep = _reapplySchedGuards(s);
    s = _dedupeSchedOnePerNight(s, null);
    /* Queue Firebase cleanup for folded shadow adds — never delete during apply.
       Sync removes inside apply → value echo → apply → remove → freeze/lag loop. */
    if(!window._pendingFoldCleanup) window._pendingFoldCleanup={};
    foldedAdds.forEach(function(pair){
      if(pair && pair.lose && pair.lose._uid) window._pendingFoldCleanup[pair.lose._uid]=pair;
    });
    if(Object.keys(window._pendingFoldCleanup).length && !window._foldCleanupTimer){
      window._foldCleanupTimer=setTimeout(function(){
        window._foldCleanupTimer=null;
        var pending=window._pendingFoldCleanup||{};
        window._pendingFoldCleanup={};
        Object.keys(pending).forEach(function(uid){
          try{ _cleanupFoldedDuplicate(pending[uid].lose, pending[uid].keep); }catch(eFold){}
        });
      }, 750);
    }
    SCHED = s;
    IDX   = buildIdx(SCHED);
    if(typeof recalcAllSchedTargets==='function') recalcAllSchedTargets();
    _maybeRepushGuards(rep);
  };

  /* Identity re-push disabled — it rewrote Firebase with stale DJ name/fee from
     local status guards and undid other sessions' modal edits. Adds that are
     truly missing are already written by persistSchedShow at save time. */
  function _maybeRepushGuards(rep){
    return;
  }

  /* Paint helpers — calendar must show the latest local rename even if a sync
     echo briefly rebuilds SCHED from an older Firebase snapshot. */
  window._guardForShow = function(r){
    if(!r) return null;
    _loadSchedEditStore();
    var gmap = window._schedWriteGuard || {};
    var g = (r._uid && gmap[r._uid]) ? gmap[r._uid] : null;
    /* Overlay DJ name/fee only for a fresh local modal save — never for status. */
    if(g && g._lockIdentity && _schedGuardIsFresh(g)){
      if(_uidIsRemoteDeleted(r._uid) || (window._schedSeenRemote && window._schedSeenRemote[r._uid] && !(window._lastWorkbookUids && window._lastWorkbookUids[r._uid]))) return null;
      /* Remote workbook with a newer timestamp always wins — otherwise the
         person who ADDED the show never saw the first rename from another tab. */
      var remoteAt=r && r.updatedAt ? Date.parse(r.updatedAt) : 0;
      if(remoteAt && remoteAt>Number(g.at||0)) return null;
      return g;
    }
    return null;
  };
  window._applySchedGuardsToLiveSched = function(){
    if(!SCHED || !SCHED.length) return;
    _reapplySchedGuards(SCHED);
  };

  /* ?? Apply full Firebase snapshot ?????????????????????????????? */
  window._fbApply = function(data){
    data = data || {};
    // VENUE_ROI_RULES first so target recalc uses latest rules
    if(data.venueRoiRules) VENUE_ROI_RULES = data.venueRoiRules;
    if(typeof ensureCnbcSummerRoofRules==='function') ensureCnbcSummerRoofRules();
    if(data.roiSpecialEvents) ROI_SPECIAL_EVENTS = data.roiSpecialEvents;
    var roiSig=JSON.stringify({v:data.venueRoiRules||null,s:data.roiSpecialEvents||null});
    var roiChanged=(roiSig!==window._lastRoiSig);
    if(roiChanged) window._lastRoiSig=roiSig;
    if(roiChanged&&window._fbReady){
      if(typeof recalcAllSchedTargets==='function') recalcAllSchedTargets();
      if(typeof refreshForecastRoiCache==='function') refreshForecastRoiCache();
    }
    /* CRITICAL: the live listener is on the whole `rdg` tree. Writing acctData /
       budget / toast must NOT rebuild SCHED from bake — that wiped in-flight
       DJ renames when status changed (name snapped back to TBD). */
    var schedSig = _schedOvSig(data.schedOverrides);
    var schedChanged = (schedSig !== _lastSchedOvSig);
    if(schedChanged){
      _lastSchedOvSig = schedSig;
      window._fbApplySched(data.schedOverrides);
    }
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
    var acctSig = data.acctData ? JSON.stringify(data.acctData) : '';
    var acctChanged = (acctSig !== window._lastAcctDataSig);
    if(acctChanged) window._lastAcctDataSig = acctSig;
    if(data.acctData) acctData = data.acctData;
    if(data.acctOthersData){
      var fo=data.acctOthersData;
      Object.keys(fo||{}).forEach(function(k){
        if(fo[k]!=null) acctOthersData[k]=fo[k];
      });
    }
    var swRecs = data.specialWeekRecords || null;
    var swSig = swRecs
      ? JSON.stringify(swRecs)
      : (data.specialWeeks ? JSON.stringify(data.specialWeeks) : '');
    var swChanged = (swSig !== window._lastSpecialWeeksSig);
    if(swChanged) window._lastSpecialWeeksSig = swSig;
    if(swRecs && swRecs._migrated){
      window._swRecordsMigrated = true;
      window._swRecords = _stripSwRecordMeta(swRecs);
      specialWeeks = _expandSwRecordsToMap(window._swRecords);
    } else {
      window._swRecordsMigrated = false;
      if(swRecs) window._swRecords = _stripSwRecordMeta(swRecs);
      if(data.specialWeeks) specialWeeks = data.specialWeeks;
      if(data.specialWeeks) _kickSpecialWeekMigrate(data.specialWeeks);
    }

    /* Toast BS Actuals must re-apply after every sched rebuild — edits/baked
       can otherwise wipe a later toastActuals overlay until that node changes. */
    if(schedChanged && window._toastActuals && typeof window._applyToastActuals==='function'){
      window._applyToastActuals(window._toastActuals);
    }

    if(window._fbReady){
      /* View refresh must not mark sync as failed — data already applied. */
      try{
        if(curView==='vip')             renderVIP();
        else if(curView==='forecast')   renderForecast();
        else if(curView==='live')       renderLive();
        else if(curView==='system')     renderSystem();
        else if(curView==='accounting'){
          if(typeof _calUiBusy==='function' && _calUiBusy()) window._calPendingRefresh='go';
          else renderAccounting();
        }
        else if(curView==='budget'){
          /* Do not rebuild the Budget Planner while the user is typing — Firebase
             echo of local saves was wiping inputs after one keystroke. */
          var typing=!!window._bgtPlayTyping;
          var ae=document.activeElement;
          if(ae && ae.closest && ae.closest('#budget2027Builder')) typing=true;
          if(!typing && typeof _budgetInited!=='undefined' && _budgetInited && typeof renderBudget==='function') renderBudget();
        }
        else {
          /* Calendar / summary / leaderboard / etc.
             Never soft-rebuild the calendar on unrelated rdg noise (toast/live/
             scrape) — that closed the DJ Status dropdown mid-open. */
          if(schedChanged){
            if(typeof _calUiBusy==='function' && _calUiBusy()) window._calPendingRefresh='go';
            else if(typeof go==='function') go();
          } else if(curView==='calendar' && (acctChanged || swChanged)){
            if(typeof _calUiBusy==='function' && _calUiBusy()) window._calPendingRefresh='cal';
            else if(typeof renderCal==='function') renderCal();
          }
        }
      }catch(errView){
        console.error('Firebase view refresh failed', errView);
      }
    }
  };

  /* Live listeners — per-path instead of the whole `rdg` tree (~2.4MB).
     Listening to the full tree often never completed (orange/red forever) while
     schedOverrides alone is ~80KB and enough to mark sync ready. */
  window._fbLiveBundle = window._fbLiveBundle || {};
  function _fbIngest(path, val){
    window._fbLiveBundle[path] = val;
    var firstLoad=!window._fbReady;
    /* Ready as soon as schedule overrides arrive (or null = empty overrides). */
    if(firstLoad && path==='schedOverrides'){
      window._fbReady = true;
      _setSyncDot('#22c55e', 'Live sync active');
    }
    try{
      window._fbApply(window._fbLiveBundle);
    }catch(errApply){
      console.error('Firebase apply failed', errApply);
      _setSyncDot('#ef4444', 'Sync error — open console for details');
      return;
    }
    if(firstLoad && window._fbReady){
      try{ _maybeWeeklySchedBackup(window._fbLiveBundle.schedOverrides); }catch(eBk){}
      if(typeof go==='function') go();
    }
  }
  [
    'schedOverrides',
    'specialWeeks',
    'specialWeekRecords',
    'acctData',
    'acctOthersData',
    'venueRoiRules',
    'roiSpecialEvents',
    'feeTiers',
    'monthlyDjBudget',
    'bgtPlan',
    'bgtCatSpend',
    'bgtCustomCats'
  ].forEach(function(key){
    window._fbDb.ref('rdg/'+key).on('value', function(snap){
      _fbIngest(key, snap.val());
    }, function(errListen){
      console.error('Firebase listener failed for '+key, errListen);
      if(key==='schedOverrides'){
        _setSyncDot('#ef4444', 'Firebase schedule listener error — check network');
      }
    });
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
      if(typeof _calUiBusy==='function' && _calUiBusy()){ window._calPendingRefresh='go'; return; }
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
var ACCT_AP_STATUS=[
  "On Workflow",
  "Missing forms",
  "Missing Contract",
  "Missing Contract & Invoice",
  "Missing Signature",
  "Missing Countersign",
  "Missing Invoice",
  "Invoice + Contract Signed",
  "Deposit Paid",
  "Paid"
];
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
