/* Budget > Booking Plan & Approvals.
   Read-only on the calendar: reads SCHED / showTargets / MONTHLY_DJ_BUDGET and never
   writes to schedOverrides or calls any calendar save path. Its own data lives in
   rdg/bookingApprovals, rdg/budgetConfirmations, rdg/bookingPlans, rdg/bookingMeetings
   and is loaded by dedicated listeners that do not go through _fbApply. */

var BP_VENUES=['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'];
var BP_VENUE_SHORT={'Casa Neos Beach Club':'Beach Club','Casa Neos Lounge':'CN Lounge','MILA Lounge':'MILA'};
var BP_CONFIRMED=['Confirmed','Invoice + Contract Signed','Contract + invoice received'];
var BP_EXECS=['Mika','Greg'];
var _bpMode='3m';
var _bpVenue='all';
var _bpOffset=0;
var _bpPanel='plan';
var _bpData={approvals:{}, confirms:{}, plans:{}, meetings:{}};

(function _bpListen(){
  if(!window._fbDb) return;
  function bind(path, key){
    window._fbDb.ref('rdg/'+path).on('value', function(snap){
      _bpData[key]=snap.val()||{};
      _bpMaybeRerender();
    }, function(err){ try{ console.warn('Booking plan listener failed', path, err); }catch(e){} });
  }
  bind('bookingApprovals','approvals');
  bind('budgetConfirmations','confirms');
  bind('bookingPlans','plans');
  bind('bookingMeetings','meetings');
})();

function _bpMaybeRerender(){
  if(typeof curView==='undefined' || curView!=='budget') return;
  if(typeof budgetSubTab==='undefined' || budgetSubTab!=='plan') return;
  if(document.getElementById('bpModal')) return;
  var ae=document.activeElement;
  if(ae && ae.closest && ae.closest('#budgetBookingPlan') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  renderBookingPlan();
}

function _bpSave(path, value, cb){
  if(!window._fbRef){ alert('Not connected to the live database. Refresh and try again.'); return; }
  window._fbRef.child(path).set(value===undefined?null:value, function(err){
    if(err){ alert('Save failed: '+(err.message||err)); return; }
    if(cb) cb();
  });
}
function _bpWho(){
  var n=(typeof _presenceName==='function')?_presenceName():'';
  return n||'Unknown';
}
function _bpNow(){ return new Date().toISOString(); }
function _bpFmtDate(iso){
  if(!iso) return '';
  var d=new Date(iso);
  if(isNaN(d.getTime())) return String(iso).slice(0,10);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function _bpDay(ds){
  var d=new Date(ds+'T12:00:00');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate();
}

/* ---- Periods (fiscal 4-4-5 months, same as Budget) ---- */
function _bpMonths(){
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY):miamiToday();
  var info=fiscalInfoForDate(today);
  var y=info.year, mi=info.monthIndex+_bpOffset;
  while(mi<0){ mi+=12; y--; }
  while(mi>11){ mi-=12; y++; }
  var n=_bpMode==='1m'?1:3, out=[];
  for(var i=0;i<n;i++){
    var r=fiscalPeriodRange(y, mi);
    out.push({year:y, mi:mi, mm:padMm(mi+1), key:y+'-'+padMm(mi+1), label:MN_FULL[mi]+' '+y, short:MNS[mi]+' '+y, from:r.from, to:r.to, range:fiscalPeriodShortRange(y, mi)});
    mi++; if(mi>11){ mi=0; y++; }
  }
  return out;
}
function _bpMonthAt(offset){
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY):miamiToday();
  var info=fiscalInfoForDate(today);
  var y=info.year, mi=info.monthIndex+(+offset||0);
  while(mi<0){ mi+=12; y--; }
  while(mi>11){ mi-=12; y++; }
  return {year:y, mi:mi, label:MN_FULL[mi]+' '+y};
}
function _bpPriorMonth(m){
  var y=m.year-1;
  var r=fiscalPeriodRange(y, m.mi);
  return {year:y, mi:m.mi, mm:m.mm, from:r.from, to:r.to, short:MNS[m.mi]+' '+y};
}
function _bpPriorTotals(venue, m){
  var pm=_bpPriorMonth(m);
  var fee=0, bs=0, hasBs=false, n=0;
  _bpBookings(venue, pm).forEach(function(r){
    fee+=+(r.fee!=null?r.fee:(r.cost||0))||0;
    n++;
    if(r.bs_a!=null){ bs+=+r.bs_a; hasBs=true; }
  });
  return {fee:n?fee:null, bs:hasBs?bs:null, n:n, label:pm.short};
}
function _bpLyShow(venue, dateStr){
  var show=(typeof _modalLySameDateShow==='function')?_modalLySameDateShow(venue, dateStr):null;
  if(!show) return null;
  var fee=show.fee!=null?show.fee:(show.cost!=null?show.cost:null);
  fee=fee!=null&&fee!==''?+fee:null;
  var bs=show.bs_a!=null?+show.bs_a:null;
  return {dj:show.dj||'', fee:fee, bs:bs, ret:(fee>0&&bs!=null)?bs/fee:null, d:show.d};
}
function _bpThisReturn(row){
  if(row.roi_t!=null) return +row.roi_t;
  if(row.fee>0 && row.bs_m!=null) return row.bs_m/row.fee;
  return null;
}

/* ---- Calendar read (never mutates SCHED rows) ---- */
function _bpUid(r){
  return r._uid || stableShowUidForNight(r.v||r.venue||'', r.d||'');
}
function _bpStatus(r){
  if(typeof getShowDjStatus==='function') return getShowDjStatus(r, r.d)||'';
  return r.djStatus||'';
}
function _bpBookings(venue, m){
  return (typeof SCHED!=='undefined'?SCHED:[]).filter(function(r){
    if(!r || !r.d || r._s==='empty') return false;
    if((r.v||r.venue)!==venue) return false;
    if(r.d<m.from || r.d>m.to) return false;
    var fee=r.fee!=null?r.fee:r.cost;
    return (r.dj && String(r.dj).trim()) || (fee!=null && fee!=='');
  }).slice().sort(function(a,b){ return a.d<b.d?-1:(a.d>b.d?1:0); });
}
function _bpToday(){ return (typeof TODAY!=='undefined'&&TODAY)?String(TODAY):miamiToday(); }
function _bpApprovalState(row){
  var rec=_bpData.approvals[row.uid];
  if(!rec){
    if(!row.needs) return 'none';
    return row.d<_bpToday() ? 'past' : 'needed';
  }
  if(+rec.fee!==+row.fee || rec.d!==row.d || rec.venue!==row.venue) return row.needs ? 'reapproval' : 'none';
  var f=rec.finance||{}, e=rec.exec||{};
  if(f.decision==='rejected' || e.decision==='rejected') return 'rejected';
  if(f.decision==='approved' && e.decision==='approved') return 'approved';
  return 'pending';
}
function _bpVenueMonth(venue, m){
  var budget=getMonthlyBudget(venue, m.year, m.mm);
  var conf=(_bpData.confirms[venue]||{})[m.year]; conf=conf?conf[m.mm]:null;
  var rows=[], confirmed=0, proposed=0, bsT=0, running=0;
  _bpBookings(venue, m).forEach(function(r){
    var fee=+(r.fee!=null?r.fee:(r.cost||0))||0;
    var status=_bpStatus(r);
    var isConf=BP_CONFIRMED.indexOf(status)>=0;
    var tgt=(typeof showTargets==='function')?showTargets(r):{bs_m:r.bs_m, roi_t:r.roi_t};
    running+=fee;
    var over=(budget!=null) ? Math.max(0, running-budget) : 0;
    var needs=budget!=null && over>0 && fee>0;
    var row={uid:_bpUid(r), venue:venue, d:r.d, dj:r.dj||'', fee:fee, status:status, confirmed:isConf,
      bs_m:tgt&&tgt.bs_m!=null?+tgt.bs_m:null, roi_t:tgt&&tgt.roi_t!=null?+tgt.roi_t:null,
      runningAfter:running, overage:needs?Math.min(fee, over):0, needs:needs};
    row.approval=_bpApprovalState(row);
    row.violation=row.confirmed && row.needs && row.approval!=='approved' && row.approval!=='past';
    if(isConf) confirmed+=fee; else proposed+=fee;
    if(row.bs_m) bsT+=row.bs_m;
    rows.push(row);
  });
  var planned=confirmed+proposed;
  var exc={needed:0,pending:0,approved:0,rejected:0,violations:0};
  rows.forEach(function(r){
    if(r.approval==='needed'||r.approval==='reapproval') exc.needed++;
    else if(r.approval==='pending') exc.pending++;
    else if(r.approval==='approved' && r.needs) exc.approved++;
    else if(r.approval==='rejected') exc.rejected++;
    if(r.violation) exc.violations++;
  });
  return {venue:venue, month:m, budget:budget, confirm:conf||null,
    confirmStale:!!(conf && budget!=null && +conf.amount!==+budget),
    confirmed:confirmed, proposed:proposed, planned:planned,
    remaining:budget!=null?budget-planned:null, bsT:bsT, py:_bpPriorTotals(venue, m),
    rows:rows, exc:exc};
}
function _bpVenueList(){ return _bpVenue==='all' ? BP_VENUES.slice() : [_bpVenue]; }
function _bpCompute(){
  var months=_bpMonths();
  var grid={};
  _bpVenueList().forEach(function(v){
    grid[v]=months.map(function(m){ return _bpVenueMonth(v, m); });
  });
  return {months:months, grid:grid};
}

/* ---- Rendering ---- */
var BP_APPROVAL_LABEL={none:'Within budget', past:'Over budget (past)', needed:'Needs approval', reapproval:'Changed — re-approve', pending:'Pending approval', approved:'Approved', rejected:'Rejected'};
function _bpBadge(state){
  return '<span class="bp-badge bp-st-'+state+'">'+BP_APPROVAL_LABEL[state]+'</span>';
}
function _bpMoneyVar(v){
  if(v==null) return '<span class="bp-muted">No budget</span>';
  return '<span class="'+(v>=0?'bp-pos':'bp-neg')+'">'+(v>=0?'Under ':'Over ')+$k(Math.abs(v))+'</span>';
}

function renderBookingPlan(){
  var host=document.getElementById('budgetBookingPlan');
  if(!host) return;
  var titleEl=document.getElementById('budgetPageTitle');
  if(titleEl) titleEl.textContent='Booking Plan & Approvals';
  var meta=document.getElementById('budgetMeta');
  var data=_bpCompute();
  var ms=data.months;
  if(meta) meta.textContent=(ms.length>1?(ms[0].short+' – '+ms[ms.length-1].short):ms[0].label)+' · reads the live calendar · approvals stored separately';

  var h='<div class="bp-toolbar">';
  h+='<div class="bp-seg">'
    +'<button type="button" class="'+(_bpPanel==='plan'?'on':'')+'" onclick="bpSetPanel(\'plan\')">Plan</button>'
    +'<button type="button" class="'+(_bpPanel==='meeting'?'on':'')+'" onclick="bpSetPanel(\'meeting\')">Meeting</button>'
    +'<button type="button" class="'+(_bpPanel==='history'?'on':'')+'" onclick="bpSetPanel(\'history\')">Plan history</button>'
    +'</div>';
  h+='<div class="bp-seg">'
    +'<button type="button" class="'+(_bpMode==='1m'?'on':'')+'" onclick="bpSetMode(\'1m\')">1 Month</button>'
    +'<button type="button" class="'+(_bpMode==='3m'?'on':'')+'" onclick="bpSetMode(\'3m\')">3 Months</button>'
    +'</div>';
  h+='<div class="bp-nav"><button type="button" onclick="bpShift(-1)" title="Previous month">&#8249;</button>'
    +'<button type="button" onclick="bpShift(0)"'+(_bpOffset===0?' class="on"':'')+'>Today</button>'
    +'<button type="button" onclick="bpShift(1)" title="Next month">&#8250;</button></div>';
  h+='<label class="bp-month-lbl">'+(_bpMode==='1m'?'Month':'Start month')
    +'<select class="bp-venue-sel" onchange="bpSetStart(this.value)">';
  for(var off=-12; off<=18; off++){
    var opt=_bpMonthAt(off);
    h+='<option value="'+off+'"'+(off===_bpOffset?' selected':'')+'>'+_escHtml(opt.label)+'</option>';
  }
  h+='</select></label>';
  h+='<select class="bp-venue-sel" onchange="bpSetVenue(this.value)">'
    +'<option value="all"'+(_bpVenue==='all'?' selected':'')+'>All venues</option>'
    +BP_VENUES.map(function(v){ return '<option value="'+_escHtml(v)+'"'+(_bpVenue===v?' selected':'')+'>'+_escHtml(v)+'</option>'; }).join('')
    +'</select>';
  h+='<span class="bp-spacer"></span>';
  h+='<button type="button" class="bp-btn" onclick="bpExportPdf()">Export PDF</button>';
  h+='<button type="button" class="bp-btn bp-btn-dark" onclick="bpGenerateMonthlyPlan()">Generate monthly plan (PDF + email)</button>';
  h+='</div>';

  if(_bpPanel==='history') h+=_bpHistoryHtml();
  else if(_bpPanel==='meeting') h+=_bpMeetingHtml(data);
  else h+=_bpPlanHtml(data);
  host.innerHTML=h;
}

function _bpAddTotals(t, c){
  if(c.budget!=null){ t.budget=(t.budget||0)+c.budget; t.hasB=true; }
  t.confirmed+=c.confirmed; t.proposed+=c.proposed; t.bsT+=c.bsT;
  if(c.py){
    if(c.py.fee!=null){ t.pyFee=(t.pyFee||0)+c.py.fee; t.hasPyFee=true; }
    if(c.py.bs!=null){ t.pyBs=(t.pyBs||0)+c.py.bs; t.hasPyBs=true; }
  }
}
function _bpBlankTot(){ return {budget:0,hasB:false,confirmed:0,proposed:0,bsT:0,pyFee:0,hasPyFee:false,pyBs:0,hasPyBs:false}; }
function _bpSummaryHtml(data){
  var venues=Object.keys(data.grid);
  var h='<div class="bp-summary'+(data.months.length===1?' bp-summary-1m':'')+'">';
  venues.forEach(function(v){
    h+='<div class="bp-venue-block"><div class="bp-venue-name">'+_escHtml(v)+'</div><div class="bp-cards">';
    var tot=_bpBlankTot();
    data.grid[v].forEach(function(c){ h+=_bpCardHtml(c); _bpAddTotals(tot, c); });
    if(data.months.length>1) h+=_bpCardHtml(_bpTotCard(tot, data.months.length+'-month total'));
    h+='</div></div>';
  });
  if(venues.length>1){
    h+='<div class="bp-venue-block"><div class="bp-venue-name">All venues</div><div class="bp-cards">';
    var gTot=_bpBlankTot();
    data.months.forEach(function(m, i){
      var bucket=_bpBlankTot();
      venues.forEach(function(v){ _bpAddTotals(bucket, data.grid[v][i]); });
      h+=_bpCardHtml(_bpTotCard(bucket, m.label, m.range));
      _bpAddTotals(gTot, {budget:bucket.hasB?bucket.budget:null, confirmed:bucket.confirmed, proposed:bucket.proposed, bsT:bucket.bsT, py:{fee:bucket.hasPyFee?bucket.pyFee:null, bs:bucket.hasPyBs?bucket.pyBs:null}});
    });
    if(data.months.length>1) h+=_bpCardHtml(_bpTotCard(gTot, data.months.length+'-month total'));
    h+='</div></div>';
  }
  h+='</div>';
  return h;
}
function _bpTotCard(t, label, range){
  var planned=t.confirmed+t.proposed;
  return {venue:'', month:{label:label, range:range||'', year:0, mm:''}, budget:t.hasB?t.budget:null,
    confirmed:t.confirmed, proposed:t.proposed, planned:planned,
    remaining:t.hasB?t.budget-planned:null, bsT:t.bsT,
    py:{fee:t.hasPyFee?t.pyFee:null, bs:t.hasPyBs?t.pyBs:null, label:'prior year'},
    exc:null, confirm:null, isTotal:true};
}
function _bpCardHtml(c){
  var m=c.month;
  var h='<article class="bp-card'+(c.isTotal?' bp-card-total':'')+'">';
  h+='<div class="bp-card-hd"><b>'+_escHtml(m.label)+'</b>'+(m.range?'<span>'+_escHtml(m.range)+'</span>':'')+'</div>';
  h+='<div class="bp-budget-box"><span>Budget</span><b>'+(c.budget!=null?$k(c.budget):'Not set')+'</b></div>';
  h+='<div class="bp-pipe"><div class="bp-pipe-hd">In the pipeline</div>';
  h+='<div class="bp-line"><span>Confirmed</span><b>'+$k(c.confirmed)+'</b></div>';
  h+='<div class="bp-line"><span>Proposed</span><b>'+$k(c.proposed)+'</b></div>';
  h+='<div class="bp-line bp-line-tot"><span>Total planned</span><b>'+$k(c.planned)+'</b></div>';
  h+='<div class="bp-line"><span>vs budget</span><b>'+_bpMoneyVar(c.remaining)+'</b></div></div>';
  h+='<div class="bp-targets">';
  h+='<div class="bp-line"><span>BS Target</span><b>'+$k(c.bsT||null)+'</b></div>';
  h+='<div class="bp-line"><span>PY BS Actual</span><b>'+$k(c.py&&c.py.bs!=null?c.py.bs:null)+'</b></div>';
  h+='<div class="bp-line"><span>PY DJ fees</span><b>'+$k(c.py&&c.py.fee!=null?c.py.fee:null)+'</b></div>';
  h+='</div>';
  if(!c.isTotal){
    var e=c.exc||{}, tags=[];
    if(e.violations) tags.push('<span class="bp-tag bp-tag-red">'+e.violations+' confirmed w/o approval</span>');
    if(e.needed) tags.push('<span class="bp-tag bp-tag-amb">'+e.needed+' need approval</span>');
    if(e.pending) tags.push('<span class="bp-tag bp-tag-blue">'+e.pending+' pending</span>');
    if(e.approved) tags.push('<span class="bp-tag bp-tag-green">'+e.approved+' approved</span>');
    if(e.rejected) tags.push('<span class="bp-tag bp-tag-grey">'+e.rejected+' rejected</span>');
    if(tags.length) h+='<div class="bp-tags">'+tags.join('')+'</div>';
    var conf=c.confirm
      ? '<span class="bp-fin '+(c.confirmStale?'bp-fin-stale':'bp-fin-ok')+'" title="'+_escHtml('Confirmed by '+c.confirm.by+' on '+_bpFmtDate(c.confirm.at))+'">'+(c.confirmStale?'Budget changed since Finance confirmed':'Finance confirmed')+'</span>'
      : '<button type="button" class="bp-fin bp-fin-btn" onclick="bpConfirmBudget(\''+_escHtml(c.venue).replace(/'/g,"\\'")+'\','+m.year+',\''+m.mm+'\')">Finance: confirm budget</button>';
    h+='<div class="bp-fin-row">'+conf+'</div>';
  }
  h+='</article>';
  return h;
}
function _bpMonthPosition(venue, dateStr){
  if(!venue||!dateStr) return null;
  var info=fiscalInfoForDate(dateStr);
  var range=fiscalPeriodRange(info.year, info.monthIndex);
  var spend=0;
  _bpBookings(venue, {from:range.from, to:range.to}).forEach(function(r){
    if(r.d<=dateStr) spend+=+(r.fee!=null?r.fee:(r.cost||0))||0;
  });
  var budget=getMonthlyBudget(venue, info.year, info.mm);
  return {spend:spend, budget:budget, left:budget!=null?budget-spend:null};
}
function _bpPosHtml(pos){
  if(!pos) return '-';
  var h='<div>'+$k(pos.spend)+(pos.budget!=null?'<span class="bp-muted"> / '+$k(pos.budget)+'</span>':'')+'</div>';
  if(pos.left!=null) h+='<div class="'+(pos.left>=0?'bp-pos':'bp-neg')+'">'+(pos.left>=0?'Under ':'Over ')+$k(Math.abs(pos.left))+'</div>';
  return h;
}
function _bpRoiHtml(x){ return x!=null?(+x).toFixed(1)+'x':'-'; }
function _bpRowsHtml(data, opts){
  opts=opts||{};
  var h='<div class="bp-bk">';
  h+='<div class="bp-bk-hd"><span>Date</span><div class="bp-bk-cols"><span></span><span>Artist</span><span class="r">Fee</span><span>Status</span><span class="r">BS</span><span class="r">ROI</span><span class="r">Month DJ spend vs budget</span></div><span>Approval</span></div>';
  var any=false;
  var now={n:0, fee:0, bs:0, hasBs:false};
  var lyTot={n:0, fee:0, bs:0, hasBs:false};
  function line(kind, tag, artist, fee, statusHtml, bs, bsLbl, roi, posHtml){
    return '<div class="bp-bk-cols bp-bk-line bp-bk-'+kind+'">'
      +'<span class="bp-bk-tag">'+tag+'</span>'
      +'<span class="bp-bk-artist">'+artist+'</span>'
      +'<span class="r">'+fee+'</span>'
      +'<span>'+statusHtml+'</span>'
      +'<span class="r">'+bs+(bsLbl?'<em>'+bsLbl+'</em>':'')+'</span>'
      +'<span class="r">'+roi+'</span>'
      +'<span class="r">'+posHtml+'</span>'
      +'</div>';
  }
  data.months.forEach(function(m, mi){
    var monthRows=[];
    Object.keys(data.grid).forEach(function(v){
      var c=data.grid[v][mi];
      c.rows.forEach(function(r){ monthRows.push({r:r, budget:c.budget}); });
    });
    if(opts.onlyExceptions) monthRows=monthRows.filter(function(x){ return x.r.needs || x.r.approval==='pending' || x.r.approval==='rejected'; });
    if(!monthRows.length) return;
    any=true;
    monthRows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
    h+='<div class="bp-bk-month">'+_escHtml(m.label)+' <span>'+_escHtml(m.range)+'</span></div>';
    monthRows.forEach(function(x){
      var r=x.r;
      var ly=_bpLyShow(r.venue, r.d);
      var lyPos=ly?_bpMonthPosition(r.venue, ly.d):null;
      var nowPos={spend:r.runningAfter, budget:x.budget, left:x.budget!=null?x.budget-r.runningAfter:null};
      now.n++; now.fee+=r.fee||0;
      if(r.bs_m!=null){ now.bs+=r.bs_m; now.hasBs=true; }
      if(ly){
        lyTot.n++;
        if(ly.fee!=null) lyTot.fee+=ly.fee;
        if(ly.bs!=null){ lyTot.bs+=ly.bs; lyTot.hasBs=true; }
      }
      var cls=r.violation?' bp-bk-viol':(r.needs?' bp-bk-over':'');
      h+='<div class="bp-bk-box'+cls+'">';
      h+='<div class="bp-bk-date"><b>'+_bpDay(r.d)+'</b><span>'+_escHtml(BP_VENUE_SHORT[r.venue]||r.venue)+'</span></div>';
      h+='<div class="bp-bk-lines">';
      h+=line('now', 'This year', '<b>'+_escHtml(r.dj||'TBD')+'</b>', $k(r.fee),
        '<span class="bp-status '+(r.confirmed?'bp-status-conf':'bp-status-prop')+'">'+_escHtml(r.status||'No status')+'</span>',
        $k(r.bs_m), 'target', _bpRoiHtml(_bpThisReturn(r)), _bpPosHtml(nowPos));
      if(ly){
        h+=line('ly', 'Last year<em>'+_bpDay(ly.d)+'</em>', _escHtml(ly.dj||'TBD'), $k(ly.fee),
          '<span class="bp-status bp-status-ly">Result</span>', $k(ly.bs), 'actual', _bpRoiHtml(ly.ret), _bpPosHtml(lyPos));
      } else {
        h+='<div class="bp-bk-cols bp-bk-line bp-bk-ly bp-bk-none"><span class="bp-bk-tag">Last year</span><span class="bp-bk-artist">No show on this date last year</span></div>';
      }
      h+='</div>';
      h+='<div class="bp-bk-appr">'+_bpBadge(r.approval)+(r.violation?'<span class="bp-badge bp-st-viol">Confirmed without approval</span>':'');
      if(!opts.noActions){
        if(r.approval==='needed'||r.approval==='reapproval') h+='<button type="button" class="bp-act bp-act-main" onclick="bpOpenRequest(\''+r.uid+'\')">Request approval</button>';
        else if(r.approval!=='none' && r.approval!=='past') h+='<button type="button" class="bp-act" onclick="bpOpenRequest(\''+r.uid+'\')">Open</button>';
      }
      h+='</div></div>';
    });
  });
  if(!any){
    h+='<div class="bp-empty">'+(opts.onlyExceptions?'No bookings above budget in this period.':'No bookings on the calendar for this period.')+'</div>';
  } else {
    var nowRoi=now.fee>0&&now.hasBs?now.bs/now.fee:null;
    var lyRoi=lyTot.fee>0&&lyTot.hasBs?lyTot.bs/lyTot.fee:null;
    h+='<div class="bp-bk-box bp-bk-total"><div class="bp-bk-date"><b>Total</b><span>All bookings</span></div><div class="bp-bk-lines">';
    h+=line('now', 'This year', '<b>'+now.n+' bookings</b>', '<b>'+$k(now.fee)+'</b>', '', '<b>'+$k(now.hasBs?now.bs:null)+'</b>', 'target', '<b>'+_bpRoiHtml(nowRoi)+'</b>', '');
    h+=line('ly', 'Last year', lyTot.n+' same dates', $k(lyTot.n?lyTot.fee:null), '', $k(lyTot.hasBs?lyTot.bs:null), 'actual', _bpRoiHtml(lyRoi), '');
    h+='</div><div class="bp-bk-appr"></div></div>';
  }
  h+='</div>';
  return h;
}
function _bpSheetHead(data, title){
  var ms=data.months;
  return '<div class="bp-sheet-hd"><div><b>'+_escHtml(title)+'</b><span>'+_escHtml(ms.length>1?(ms[0].label+' – '+ms[ms.length-1].label):ms[0].label)+' · '+_escHtml(_bpVenue==='all'?'All venues':_bpVenue)+'</span></div>'
    +'<div>Prepared '+_escHtml(_bpFmtDate(_bpNow()))+'</div></div>';
}
function _bpPlanHtml(data){
  var h='<div id="bpSheet" class="bp-sheet">';
  h+=_bpSheetHead(data, data.months.length>1?'Three Month Booking Plan':'Entertainment Booking Plan vs Budget');
  h+=_bpSummaryHtml(data);
  h+='<div class="bp-sec-hd">Bookings <span>One box per performance: this year on top, the same date last year below.</span></div>';
  h+=_bpRowsHtml(data);
  h+='</div>';
  return h;
}

/* ---- Toolbar actions ---- */
function bpSetPanel(p){ _bpPanel=p; renderBookingPlan(); }
function bpSetMode(m){ _bpMode=m; renderBookingPlan(); }
function bpSetVenue(v){ _bpVenue=v; renderBookingPlan(); }
function bpShift(d){ _bpOffset = d===0 ? 0 : _bpOffset+d; renderBookingPlan(); }
function bpSetStart(v){ _bpOffset=+v||0; renderBookingPlan(); }

function bpConfirmBudget(venue, year, mm){
  var amt=getMonthlyBudget(venue, year, mm);
  if(amt==null){ alert('No budget is set for '+venue+' in this month. Set it in Budget > Overview first.'); return; }
  var mi=parseInt(mm,10)-1;
  if(!confirm('Finance confirms the '+MN_FULL[mi]+' '+year+' DJ budget for '+venue+' at '+$k(amt)+'?\n\nRecorded as: '+_bpWho())) return;
  _bpSave('budgetConfirmations/'+venue+'/'+year+'/'+mm, {amount:amt, by:_bpWho(), at:_bpNow()});
}

/* ---- Exception request / approvals ---- */
function _bpFindRow(uid){
  var data=_bpCompute();
  for(var v in data.grid){
    for(var i=0;i<data.grid[v].length;i++){
      var c=data.grid[v][i];
      for(var j=0;j<c.rows.length;j++) if(c.rows[j].uid===uid) return {row:c.rows[j], cell:c};
    }
  }
  return null;
}
function _bpLyLine(row){
  if(typeof _modalLySameDateShow!=='function') return '';
  var ly=_modalLySameDateShow(row.venue, row.d);
  if(!ly) return 'No show on the same date last year.';
  var fee=ly.fee!=null?ly.fee:ly.cost;
  return (ly.dj||'TBD')+' · fee '+$k(fee)+' · BS Actual '+$k(ly.bs_a)+' (vs target '+$k(ly.bs_m)+')';
}
function bpCloseModal(){
  var el=document.getElementById('bpModal');
  if(el) el.remove();
}
function bpOpenRequest(uid){
  var hit=_bpFindRow(uid);
  if(!hit){ alert('This booking is no longer in the selected period.'); return; }
  var row=hit.row, cell=hit.cell, rec=_bpData.approvals[uid]||null;
  var fresh=!rec || row.approval==='reapproval';
  var spendBefore=row.runningAfter-row.fee;
  var f=(rec&&rec.finance)||{}, e=(rec&&rec.exec)||{};
  function ro(label, val){ return '<div class="bp-kv"><span>'+label+'</span><b>'+val+'</b></div>'; }
  var h='<div class="modal bp-modal"><div class="modal-hd"><h3>'+(fresh?'Request budget exception':'Budget exception')+'</h3><button class="modal-close" onclick="bpCloseModal()">&#10005;</button></div>';
  h+='<div class="modal-body">';
  h+='<div class="bp-kv-grid">'
    +ro('Venue', _escHtml(row.venue))
    +ro('Date', _escHtml(_bpDay(row.d)+' '+row.d.slice(0,4)))
    +ro('DJ', _escHtml(row.dj||'TBD'))
    +ro('Fee', $k(row.fee))
    +ro('Month budget', cell.budget!=null?$k(cell.budget):'Not set')
    +ro('Spend before this booking', $k(spendBefore))
    +ro('Over budget by', '<span class="bp-neg">'+$k(row.overage)+'</span>')
    +ro('BS Target / ROI Target', $k(row.bs_m)+' / '+(row.roi_t!=null?row.roi_t.toFixed(1)+'x':'-'))
    +'</div>';
  h+='<div class="bp-kv bp-kv-wide"><span>Same date last year</span><b>'+_escHtml(_bpLyLine(row))+'</b></div>';
  if(rec && row.approval==='reapproval'){
    h+='<div class="bp-warn">Fee, date or venue changed since this was submitted ('+$k(rec.fee)+' on '+_escHtml(rec.d)+'). It must be approved again.</div>';
  }
  var dis=fresh?'':' disabled';
  h+='<label class="bp-fld"><span>Rationale — why this DJ, why this date</span><textarea id="bpReqRationale" rows="3"'+dis+'>'+_escHtml(rec?rec.rationale:'')+'</textarea></label>';
  h+='<label class="bp-fld"><span>Expected benefit — BS / ROI, event or brand value</span><textarea id="bpReqBenefit" rows="3"'+dis+'>'+_escHtml(rec?rec.benefit:'')+'</textarea></label>';
  h+='<div class="bp-fld-row">';
  h+='<label class="bp-fld"><span>Additional amount requested ($)</span><input id="bpReqAmount" type="number" min="0" step="100" value="'+(rec&&!fresh?(+rec.amount||0):row.overage)+'"'+dis+'></label>';
  h+='<label class="bp-fld"><span>Discussed at entertainment meeting on</span><input id="bpReqMeeting" type="date" value="'+_escHtml(rec?rec.meetingDate||'':'')+'"'+dis+'></label>';
  h+='</div>';
  if(!fresh){
    h+='<div class="bp-meta">Submitted by '+_escHtml(rec.requestedBy||'')+' on '+_escHtml(_bpFmtDate(rec.requestedAt))+'</div>';
    h+='<div class="bp-appr-grid">';
    h+=_bpApproverBlock('finance', 'Finance', f, null);
    h+=_bpApproverBlock('exec', 'Mika or Greg', e, BP_EXECS);
    h+='</div>';
  }
  h+='</div><div class="modal-foot">';
  if(fresh) h+='<button type="button" class="bp-btn" onclick="bpCloseModal()">Cancel</button><button type="button" class="bp-btn bp-btn-dark" onclick="bpSubmitRequest(\''+uid+'\')">Submit for approval</button>';
  else h+='<button type="button" class="bp-btn" onclick="bpCloseModal()">Close</button>';
  h+='</div></div>';
  var bg=document.createElement('div');
  bg.className='modal-bg';
  bg.id='bpModal';
  bg.dataset.uid=uid;
  bg.innerHTML=h;
  bg.addEventListener('click', function(ev){ if(ev.target===bg) bpCloseModal(); });
  document.body.appendChild(bg);
}
function _bpApproverBlock(role, title, d, names){
  var h='<div class="bp-appr"><div class="bp-appr-hd">'+title+'</div>';
  if(d.decision){
    h+='<div class="bp-appr-dec bp-appr-'+d.decision+'">'+(d.decision==='approved'?'Approved':'Rejected')+'</div>'
      +'<div class="bp-meta">'+_escHtml(d.name||'')+' · '+_escHtml(_bpFmtDate(d.at))+(d.recordedBy&&d.recordedBy!==d.name?' · recorded by '+_escHtml(d.recordedBy):'')+'</div>';
    if(d.comment) h+='<div class="bp-appr-note">'+_escHtml(d.comment)+'</div>';
    if(d.evidence) h+='<div class="bp-appr-note"><b>Written approval:</b> '+_escHtml(d.evidence)+'</div>';
    h+='</div>';
    return h;
  }
  if(names) h+='<label class="bp-fld"><span>Approver</span><select id="bpAp_'+role+'_name">'+names.map(function(n){ return '<option>'+n+'</option>'; }).join('')+'</select></label>';
  else h+='<label class="bp-fld"><span>Approver name</span><input id="bpAp_'+role+'_name" type="text" value="'+_escHtml(_bpWho()==='Unknown'?'':_bpWho())+'"></label>';
  h+='<label class="bp-fld"><span>Written approval (email subject, date or link)</span><input id="bpAp_'+role+'_evidence" type="text" placeholder="e.g. RE: Guy Gerber Oct 10 — approved, Oct 2"></label>';
  h+='<label class="bp-fld"><span>Comment</span><input id="bpAp_'+role+'_comment" type="text"></label>';
  h+='<div class="bp-appr-btns"><button type="button" class="bp-btn bp-btn-green" onclick="bpDecide(\''+role+'\',\'approved\')">Approve</button>'
    +'<button type="button" class="bp-btn bp-btn-red" onclick="bpDecide(\''+role+'\',\'rejected\')">Reject</button></div>';
  h+='</div>';
  return h;
}
var _bpOpenUid='';
function bpSubmitRequest(uid){
  var hit=_bpFindRow(uid);
  if(!hit){ alert('This booking is no longer in the selected period.'); return; }
  var row=hit.row, cell=hit.cell;
  var rationale=(document.getElementById('bpReqRationale').value||'').trim();
  var benefit=(document.getElementById('bpReqBenefit').value||'').trim();
  var amount=parseFloat(document.getElementById('bpReqAmount').value);
  var meeting=document.getElementById('bpReqMeeting').value||'';
  if(!rationale || !benefit){ alert('Rationale and expected benefit are required.'); return; }
  if(!(amount>0)){ alert('Enter the additional amount requested.'); return; }
  var rec={uid:uid, venue:row.venue, d:row.d, dj:row.dj, fee:row.fee, month:cell.month.key,
    monthBudget:cell.budget, overage:row.overage, amount:amount, bs_m:row.bs_m, roi_t:row.roi_t,
    rationale:rationale, benefit:benefit, meetingDate:meeting,
    requestedBy:_bpWho(), requestedAt:_bpNow(), finance:null, exec:null};
  var prev=_bpData.approvals[uid];
  if(prev){
    var hist=(prev.history||[]).slice();
    hist.push({fee:prev.fee, d:prev.d, venue:prev.venue, amount:prev.amount, finance:prev.finance||null, exec:prev.exec||null, requestedAt:prev.requestedAt, supersededAt:_bpNow()});
    rec.history=hist;
  }
  _bpSave('bookingApprovals/'+uid, rec, function(){ bpCloseModal(); renderBookingPlan(); });
}
function bpDecide(role, decision){
  var modal=document.getElementById('bpModal');
  var uid=modal && modal.dataset.uid;
  if(!uid) return;
  var rec=_bpData.approvals[uid];
  if(!rec){ alert('Request not found. Refresh and try again.'); return; }
  var name=(document.getElementById('bpAp_'+role+'_name').value||'').trim();
  var evidence=(document.getElementById('bpAp_'+role+'_evidence').value||'').trim();
  var comment=(document.getElementById('bpAp_'+role+'_comment').value||'').trim();
  if(!name){ alert('Enter the approver name.'); return; }
  if(decision==='approved' && !evidence){ alert('Written approval is required. Enter the approval email subject, date or link.'); return; }
  var d={decision:decision, name:name, evidence:evidence, comment:comment, at:_bpNow(), recordedBy:_bpWho()};
  _bpSave('bookingApprovals/'+uid+'/'+role, d, function(){
    bpCloseModal();
    setTimeout(function(){ bpOpenRequest(uid); }, 50);
  });
}

/* ---- Meeting view ---- */
function _bpMeetingHtml(data){
  var m=data.months[0];
  var mt=_bpData.meetings[m.key]||{};
  var h='<div id="bpSheet" class="bp-sheet">';
  h+=_bpSheetHead(data, 'Entertainment Meeting — Plan vs Budget');
  h+='<div class="bp-meeting-hd"><div><b>'+_escHtml(m.label)+' meeting</b><span>'+(mt.lockedAt?'Baseline locked by '+_escHtml(mt.lockedBy||'')+' on '+_escHtml(_bpFmtDate(mt.lockedAt)):'Baseline not locked yet')+'</span></div>';
  h+='<button type="button" class="bp-btn bp-btn-dark" onclick="bpLockBaseline()">'+(mt.lockedAt?'Re-lock baseline':'Lock baseline')+'</button></div>';
  h+='<div class="bp-sec-hd">1 · Budget vs total planned</div>';
  h+=_bpSummaryHtml(data);
  if(mt.baseline){
    h+='<div class="bp-sec-hd">Changes since baseline <span>'+_escHtml(_bpFmtDate(mt.lockedAt))+'</span></div>';
    h+=_bpBaselineDiffHtml(data, mt.baseline);
  }
  h+='<div class="bp-sec-hd">2 · Over budget and exceptions</div>';
  h+=_bpRowsHtml(data, {onlyExceptions:true});
  h+='<div class="bp-sec-hd">3 · Decisions and notes <span>Saved for '+_escHtml(m.label)+'</span></div>';
  h+='<textarea id="bpMeetingNotes" class="bp-notes" rows="5" placeholder="Decisions: drop / re-price / submit for approval…">'+_escHtml(mt.notes||'')+'</textarea>';
  h+='<div class="bp-notes-foot"><span class="bp-muted">'+(mt.notesAt?'Last saved by '+_escHtml(mt.notesBy||'')+' on '+_escHtml(_bpFmtDate(mt.notesAt)):'')+'</span><button type="button" class="bp-btn" onclick="bpSaveNotes()">Save notes</button></div>';
  h+='</div>';
  return h;
}
function _bpBaselineDiffHtml(data, base){
  var h='<table class="bp-tbl bp-diff"><thead><tr><th class="l">Venue</th><th class="l">Month</th><th>Baseline planned</th><th>Now planned</th><th>Change</th><th>Budget</th></tr></thead><tbody>';
  var any=false;
  Object.keys(data.grid).forEach(function(v){
    data.grid[v].forEach(function(c){
      var b=((base[v]||{})[c.month.key])||null;
      if(!b) return;
      any=true;
      var diff=c.planned-(+b.planned||0);
      h+='<tr><td class="l">'+_escHtml(BP_VENUE_SHORT[v]||v)+'</td><td class="l">'+_escHtml(c.month.short)+'</td><td>'+$k(+b.planned||0)+'</td><td>'+$k(c.planned)+'</td>'
        +'<td class="'+(diff>0?'bp-neg':(diff<0?'bp-pos':''))+'">'+(diff?$kv(diff):'-')+'</td><td>'+(c.budget!=null?$k(c.budget):'-')+'</td></tr>';
    });
  });
  if(!any) h+='<tr><td colspan="6" class="bp-empty">No baseline for these months.</td></tr>';
  h+='</tbody></table>';
  return h;
}
function bpSaveNotes(){
  var m=_bpMonths()[0];
  var el=document.getElementById('bpMeetingNotes');
  if(!el) return;
  var cur=Object.assign({}, _bpData.meetings[m.key]||{});
  cur.notes=el.value||'';
  cur.notesBy=_bpWho();
  cur.notesAt=_bpNow();
  _bpSave('bookingMeetings/'+m.key, cur, function(){ renderBookingPlan(); });
}
function bpLockBaseline(){
  var data=_bpCompute();
  var m=data.months[0];
  if(!confirm('Lock the agreed plan for '+m.label+' as the baseline?\n\nLater changes will be compared against it.')) return;
  var base={};
  Object.keys(data.grid).forEach(function(v){
    base[v]={};
    data.grid[v].forEach(function(c){
      base[v][c.month.key]={budget:c.budget, confirmed:c.confirmed, proposed:c.proposed, planned:c.planned};
    });
  });
  var notes=document.getElementById('bpMeetingNotes');
  var cur=Object.assign({}, _bpData.meetings[m.key]||{});
  if(notes) cur.notes=notes.value||'';
  cur.baseline=base;
  cur.lockedBy=_bpWho();
  cur.lockedAt=_bpNow();
  _bpSave('bookingMeetings/'+m.key, cur, function(){ renderBookingPlan(); });
}

/* ---- Plan history ---- */
function _bpHistoryHtml(){
  var keys=Object.keys(_bpData.plans||{}).sort().reverse();
  var h='<div class="bp-sheet"><div class="bp-sec-hd">Monthly plans sent <span>Saved each time a monthly plan is generated</span></div>';
  if(!keys.length) return h+'<div class="bp-empty">No plans generated yet. Use “Generate monthly plan” on the 1st of the month.</div></div>';
  h+='<table class="bp-tbl"><thead><tr><th class="l">Generated</th><th class="l">By</th><th class="l">Period</th><th>Budget</th><th>Confirmed</th><th>Proposed</th><th>Total planned</th><th>Exceptions</th><th>vs previous plan</th></tr></thead><tbody>';
  keys.forEach(function(k, i){
    var p=_bpData.plans[k]||{}, t=p.totals||{};
    var prev=keys[i+1]?(_bpData.plans[keys[i+1]]||{}).totals||null:null;
    var diff=prev?((+t.planned||0)-(+prev.planned||0)):null;
    h+='<tr><td class="l">'+_escHtml(_bpFmtDate(p.at))+'</td><td class="l">'+_escHtml(p.by||'')+'</td><td class="l">'+_escHtml(p.period||'')+'</td>'
      +'<td>'+$k(t.budget)+'</td><td>'+$k(t.confirmed)+'</td><td>'+$k(t.proposed)+'</td><td><b>'+$k(t.planned)+'</b></td>'
      +'<td>'+(+p.exceptions||0)+'</td><td class="'+(diff>0?'bp-neg':(diff<0?'bp-pos':''))+'">'+(diff==null?'-':(diff?$kv(diff):'No change'))+'</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

/* ---- PDF / email ---- */
function _bpCaptureSheet(){
  var sheet=document.getElementById('bpSheet');
  if(!sheet) return Promise.reject(new Error('Nothing to export'));
  return _ensurePdfLibs().then(function(){
    return (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve());
  }).then(function(){
    sheet.classList.add('bp-exporting');
    return window.html2canvas(sheet,{scale:1.4,useCORS:true,logging:false,backgroundColor:'#ffffff',windowWidth:1500});
  }).then(function(canvas){
    sheet.classList.remove('bp-exporting');
    return canvas;
  }, function(err){
    sheet.classList.remove('bp-exporting');
    throw err;
  });
}
function _bpPdfName(){
  var ms=_bpMonths();
  return 'RDG-Entertainment-Booking-Plan-'+ms[0].key+(ms.length>1?'-to-'+ms[ms.length-1].key:'')+'.pdf';
}
/* Every PDF page is a fixed landscape-letter frame (11 x 8.5). */
var BP_PAGE_W=1600, BP_PAGE_H=1236;
function _bpBusy(on, msg){
  var el=document.getElementById('bpBusy');
  if(!on){ if(el) el.remove(); return; }
  if(!el){
    el=document.createElement('div');
    el.id='bpBusy';
    el.className='bp-busy';
    document.body.appendChild(el);
  }
  el.innerHTML='<div><b>Preparing PDF</b><span>'+_escHtml(msg||'')+'</span></div>';
}
function _bpCoverHtml(title, sub){
  return '<div class="bp-page bp-cover">'
    +'<img class="bp-cover-logo" src="assets/rdg-logo.png" alt="RDG">'
    +'<div class="bp-cover-box">'+_escHtml(title)+'</div>'
    +(sub?'<div class="bp-cover-sub">'+_escHtml(sub)+'</div>':'')
    +'</div>';
}
function _bpStatSel(lbl, val, cls){
  return '<div class="bp-x-stat'+(cls?' '+cls:'')+'"><span>'+lbl+'</span><b>'+val+'</b></div>';
}
function _bp3dOrbit(model, tableKey, url){
  var orbit=model.orbit||'45deg 60deg 110%';
  if(tableKey==='casa-neos-beach-club-summer' && model.summerOrbit) orbit=model.summerOrbit;
  if(tableKey==='casa-neos-beach-club-new' && model.fallOrbit) orbit=model.fallOrbit;
  if(tableKey==='casa-neos-beach-club-basel' && model.baselOrbit) orbit=model.baselOrbit;
  if((tableKey==='casa-neos-lounge-new'||tableKey==='casa-neos-lounge-oct'||/lounge\/model-new/.test(url||'')) && model.newOrbit) orbit=model.newOrbit;
  return orbit;
}
var _bpSnapCache={};
/* WebGL is invisible to html2canvas, so the 3D plan is rendered on screen
   (under the busy overlay) and captured with model-viewer's own toBlob(). */
function _bpSnap3d(venue, date){
  var key=(typeof fv3dKeyForVenue==='function')?fv3dKeyForVenue(venue):null;
  var model=key&&typeof FV_3D_MODELS!=='undefined'?FV_3D_MODELS.find(function(m){ return m.key===key; }):null;
  if(!model || typeof _ensureModelViewerScript!=='function') return Promise.resolve(null);
  var url=(typeof fv3dEffectiveModelUrl==='function'?fv3dEffectiveModelUrl(key, date):null)||model.url;
  var tableKey=(typeof fv3dEffectiveTableKey==='function')?fv3dEffectiveTableKey(key, date):key;
  var orbit=_bp3dOrbit(model, tableKey, url);
  var ck=url+'|'+orbit;
  if(_bpSnapCache[ck]) return _bpSnapCache[ck];
  var p=new Promise(function(resolve){
    var done=false, host=null;
    function finish(v){
      if(done) return;
      done=true;
      if(host) host.remove();
      resolve(v);
    }
    setTimeout(function(){ finish(null); }, 60000);
    _ensureModelViewerScript(function(){
      host=document.createElement('div');
      host.className='bp-snap-host';
      var mv=document.createElement('model-viewer');
      mv.setAttribute('src', url);
      mv.setAttribute('camera-orbit', orbit);
      mv.setAttribute('interaction-prompt','none');
      mv.setAttribute('shadow-intensity','1');
      mv.setAttribute('exposure','1.1');
      mv.style.cssText='width:100%;height:100%;background:#ffffff';
      host.appendChild(mv);
      document.body.appendChild(host);
      mv.addEventListener('error', function(){ finish(null); });
      mv.addEventListener('load', function(){
        setTimeout(function(){
          try{
            mv.toBlob({mimeType:'image/png'}).then(function(blob){
              var fr=new FileReader();
              fr.onload=function(){ finish(fr.result); };
              fr.onerror=function(){ finish(null); };
              fr.readAsDataURL(blob);
            }, function(){ finish(null); });
          }catch(e){ finish(null); }
        }, 1500);
      });
    });
  });
  _bpSnapCache[ck]=p;
  p.then(function(v){ if(!v) delete _bpSnapCache[ck]; });
  return p;
}
function _bpExceptionPageHtml(r, c, snap){
  var today=_bpToday();
  var actual=0, forecast=0;
  c.rows.forEach(function(x){ if(x.d<today) actual+=x.fee||0; else forecast+=x.fee||0; });
  var total=actual+forecast;
  var left=c.budget!=null?c.budget-total:null;
  var ly=_bpLyShow(r.venue, r.d);
  var yr=c.month.year, mm=c.month.mm;
  var salesPlan=typeof getBgtPlan==='function'?getBgtPlan(r.venue, yr, mm, 'sales'):null;
  var salesLy=typeof getBgtActual==='function'?getBgtActual(r.venue, yr-1, mm, 'sales'):null;
  var priced=typeof calcTierPricesForShow==='function'?calcTierPricesForShow(r.venue, r.d, r.fee):null;
  function diff(a, b){
    if(a==null||b==null||!b) return '';
    var pct=(a-b)/b*100;
    return '<em class="'+(pct>=0?'bp-pos':'bp-neg')+'">'+(pct>=0?'+':'')+pct.toFixed(0)+'% vs last year</em>';
  }
  var h='<div class="bp-page bp-x">';
  h+='<div class="bp-x-hd"><div><b>Budget Exception</b><span>'+_escHtml(r.venue)+' · '+_escHtml(c.month.label)+' ('+_escHtml(c.month.range)+')</span></div>'
    +'<img src="assets/rdg-logo.png" alt="RDG"></div>';

  h+='<div class="bp-x-sec">Performance &amp; budget</div><div class="bp-x-grid">'
    +_bpStatSel('DJ', _escHtml(r.dj||'TBD'), 'bp-x-wide')
    +_bpStatSel('Date', _bpDay(r.d))
    +_bpStatSel('Fee', $k(r.fee))
    +_bpStatSel('Status', _escHtml(r.status||'No status'))
    +'</div><div class="bp-x-grid">'
    +_bpStatSel('Total budget for the month', c.budget!=null?$k(c.budget):'Not set', 'bp-x-budget')
    +_bpStatSel('Actual DJ fees (played)', $k(actual))
    +_bpStatSel('Forecast DJ fees (upcoming)', $k(forecast))
    +_bpStatSel('Actual + forecast', $k(total), 'bp-x-strong')
    +_bpStatSel('vs budget', left==null?'-':'<span class="'+(left>=0?'bp-pos':'bp-neg')+'">'+(left>=0?'Under ':'Over ')+$k(Math.abs(left))+'</span>')
    +'</div>';

  h+='<div class="bp-x-sec">Sales: what we plan vs what we did last year</div><div class="bp-x-sales">'
    +'<div class="bp-x-sbox"><div class="bp-x-shd">This night</div>'
    +'<div class="bp-x-srow"><span>Planned BS (target)</span><b>'+$k(r.bs_m)+'</b></div>'
    +'<div class="bp-x-srow"><span>Last year same date'+(ly?' ('+_bpDay(ly.d)+(ly.dj?', '+_escHtml(ly.dj):'')+')':'')+'</span><b>'+(ly?$k(ly.bs):'No show')+'</b></div>'
    +'<div class="bp-x-srow bp-x-sfoot">'+diff(r.bs_m, ly&&ly.bs)+'</div></div>'
    +'<div class="bp-x-sbox"><div class="bp-x-shd">Whole month: bottle service</div>'
    +'<div class="bp-x-srow"><span>Planned BS (all bookings)</span><b>'+$k(c.bsT||null)+'</b></div>'
    +'<div class="bp-x-srow"><span>Last year BS actual</span><b>'+$k(c.py&&c.py.bs!=null?c.py.bs:null)+'</b></div>'
    +'<div class="bp-x-srow bp-x-sfoot">'+diff(c.bsT, c.py&&c.py.bs)+'</div></div>'
    +'<div class="bp-x-sbox"><div class="bp-x-shd">Whole month: total sales</div>'
    +'<div class="bp-x-srow"><span>Sales budget</span><b>'+$k(salesPlan!=null?+salesPlan:null)+'</b></div>'
    +'<div class="bp-x-srow"><span>Last year sales actual</span><b>'+$k(salesLy)+'</b></div>'
    +'<div class="bp-x-srow bp-x-sfoot">'+diff(salesPlan!=null?+salesPlan:null, salesLy)+'</div></div>'
    +'</div>';

  h+='<div class="bp-x-sec">3D floor plan &amp; table tiers'+(priced&&priced.label?' <span>'+_escHtml(priced.label)+'</span>':'')+'</div><div class="bp-x-3d">';
  h+='<div class="bp-x-snap">'+(snap?'<img src="'+snap+'" alt="3D floor plan">':'<span>3D snapshot unavailable</span>')+'</div>';
  h+='<div class="bp-x-tiers">';
  if(priced&&priced.tiers&&priced.tiers.length){
    priced.tiers.forEach(function(t){
      var price=t.suggested!=null?t.suggested:t.minimum;
      var n=(t.tables||[]).length;
      h+='<div class="bp-x-tier" style="--tier-color:'+_escHtml(t.color||'#64748b')+'"><div><b>'+_escHtml(t.name)+'</b><span>'+n+' table'+(n===1?'':'s')+(t.capacity?' · '+t.capacity+' guests':'')+'</span>'
        +(n?'<small>#'+t.tables.join(', #')+'</small>':'')+'</div><strong>'+_escHtml(formatFv3dMoney(price))+'</strong></div>';
    });
  } else {
    h+='<div class="bp-empty">No tier pricing for this venue.</div>';
  }
  h+='</div></div></div>';
  return h;
}
/* Compact one-page version of the plan used only in the PDF. */
function _bpPrintSheetHtml(data, onlyMonth){
  var ms=data.months, venues=Object.keys(data.grid);
  var showSummary=onlyMonth==null||onlyMonth===0;
  function rem(v){ return v==null?'<span class="bp-muted">-</span>':'<span class="'+(v>=0?'bp-pos':'bp-neg')+'">'+(v>=0?'Under ':'Over ')+$k(Math.abs(v))+'</span>'; }
  function cells(c){
    return '<td class="bp-p-bud">'+(c.budget!=null?$k(c.budget):'Not set')+'</td><td>'+$k(c.confirmed)+'</td><td>'+$k(c.proposed)+'</td><td><b>'+$k(c.planned)+'</b></td><td>'+rem(c.remaining)+'</td><td>'+$k(c.bsT||null)+'</td><td class="bp-p-end">'+$k(c.py&&c.py.bs!=null?c.py.bs:null)+'</td>';
  }
  var h='<div class="bp-print">';
  h+=_bpSheetHead(data, ms.length>1?'Three Month Booking Plan'+(onlyMonth!=null?' · '+ms[onlyMonth].label+' ('+(onlyMonth+1)+' of '+ms.length+')':''):'Entertainment Booking Plan vs Budget');
  if(showSummary){
  h+='<div class="bp-p-sec">Budget vs pipeline</div><table class="bp-p-tbl bp-p-sum"><thead><tr><th rowspan="2" class="l">Venue</th>';
  ms.forEach(function(m){ h+='<th colspan="7" class="bp-p-end">'+_escHtml(m.label)+' <span>'+_escHtml(m.range)+'</span></th>'; });
  h+='</tr><tr>';
  ms.forEach(function(){ h+='<th>Budget</th><th>Confirmed</th><th>Proposed</th><th>Total</th><th>vs budget</th><th>BS Target</th><th class="bp-p-end">PY BS</th>'; });
  h+='</tr></thead><tbody>';
  venues.forEach(function(v){
    h+='<tr><td class="l"><b>'+_escHtml(BP_VENUE_SHORT[v]||v)+'</b></td>';
    data.grid[v].forEach(function(c){ h+=cells(c); });
    h+='</tr>';
  });
  if(venues.length>1){
    h+='<tr class="bp-p-all"><td class="l"><b>All venues</b></td>';
    ms.forEach(function(m, i){
      var t=_bpBlankTot();
      venues.forEach(function(v){ _bpAddTotals(t, data.grid[v][i]); });
      h+=cells(_bpTotCard(t, m.label));
    });
    h+='</tr>';
  }
  h+='</tbody></table>';
  }

  var rows=[];
  ms.forEach(function(m, mi){
    if(onlyMonth!=null && mi!==onlyMonth) return;
    venues.forEach(function(v){ var c=data.grid[v][mi]; c.rows.forEach(function(r){ rows.push({r:r, budget:c.budget}); }); });
  });
  rows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
  h+='<div class="bp-p-sec">Bookings'+(onlyMonth!=null?' · '+_escHtml(ms[onlyMonth].label):'')+': this year vs same date last year</div>';
  h+='<table class="bp-p-tbl bp-p-bk"><thead><tr><th colspan="2" class="l"></th><th colspan="5" class="bp-p-now bp-p-end">This year</th><th colspan="5" class="bp-p-ly bp-p-end">Last year (same date)</th><th colspan="2"></th></tr>'
    +'<tr><th class="l">Date</th><th class="l">Venue</th><th class="l">Artist</th><th>Fee</th><th class="l">Status</th><th>BS target</th><th class="bp-p-end">ROI</th>'
    +'<th class="l">Date</th><th class="l">Artist</th><th>Fee</th><th>BS actual</th><th class="bp-p-end">ROI</th><th>Month vs budget</th><th class="l">Approval</th></tr></thead><tbody>';
  var t={n:0,fee:0,bs:0,hb:false}, lt={n:0,fee:0,bs:0,hb:false};
  rows.forEach(function(x){
    var r=x.r, ly=_bpLyShow(r.venue, r.d);
    var pos={spend:r.runningAfter, budget:x.budget, left:x.budget!=null?x.budget-r.runningAfter:null};
    t.n++; t.fee+=r.fee||0; if(r.bs_m!=null){ t.bs+=r.bs_m; t.hb=true; }
    if(ly){ lt.n++; lt.fee+=ly.fee||0; if(ly.bs!=null){ lt.bs+=ly.bs; lt.hb=true; } }
    h+='<tr class="'+(r.violation?'bp-p-viol':(r.needs?'bp-p-over':''))+'"><td class="l"><b>'+_bpDay(r.d)+'</b></td><td class="l">'+_escHtml(BP_VENUE_SHORT[r.venue]||r.venue)+'</td>'
      +'<td class="l"><b>'+_escHtml(r.dj||'TBD')+'</b></td><td>'+$k(r.fee)+'</td><td class="l"><span class="bp-status '+(r.confirmed?'bp-status-conf':'bp-status-prop')+'">'+_escHtml(r.status||'No status')+'</span></td><td>'+$k(r.bs_m)+'</td><td class="bp-p-end">'+_bpRoiHtml(_bpThisReturn(r))+'</td>';
    if(ly) h+='<td class="l bp-p-lyc">'+_bpDay(ly.d)+'</td><td class="l bp-p-lyc">'+_escHtml(ly.dj||'TBD')+'</td><td class="bp-p-lyc">'+$k(ly.fee)+'</td><td class="bp-p-lyc">'+$k(ly.bs)+'</td><td class="bp-p-lyc bp-p-end">'+_bpRoiHtml(ly.ret)+'</td>';
    else h+='<td colspan="5" class="l bp-p-lyc bp-p-end bp-muted">No show on this date last year</td>';
    h+='<td>'+_bpPosHtml(pos)+'</td><td class="l">'+_bpBadge(r.approval)+'</td></tr>';
  });
  if(!rows.length) h+='<tr><td colspan="14" class="bp-muted">No bookings on the calendar for this period.</td></tr>';
  else h+='<tr class="bp-p-all"><td class="l" colspan="2"><b>Total</b></td><td class="l"><b>'+t.n+' bookings</b></td><td><b>'+$k(t.fee)+'</b></td><td></td><td><b>'+$k(t.hb?t.bs:null)+'</b></td><td class="bp-p-end"><b>'+_bpRoiHtml(t.fee>0&&t.hb?t.bs/t.fee:null)+'</b></td>'
    +'<td class="l bp-p-lyc" colspan="2">'+lt.n+' same dates</td><td class="bp-p-lyc">'+$k(lt.n?lt.fee:null)+'</td><td class="bp-p-lyc">'+$k(lt.hb?lt.bs:null)+'</td><td class="bp-p-lyc bp-p-end">'+_bpRoiHtml(lt.fee>0&&lt.hb?lt.bs/lt.fee:null)+'</td><td colspan="2"></td></tr>';
  h+='</tbody></table></div>';
  return h;
}
function _bpPdfCanvas(el){
  var big=el.classList&&el.classList.contains('bp-print');
  return window.html2canvas(el,{scale:big?2:1.25,useCORS:true,logging:false,backgroundColor:'#ffffff',windowWidth:BP_PAGE_W});
}
function _bpRenderPage(html){
  var stage=document.createElement('div');
  stage.className='bp-pdf-stage';
  stage.innerHTML=html;
  document.body.appendChild(stage);
  var imgs=Array.prototype.slice.call(stage.querySelectorAll('img'));
  return Promise.all(imgs.map(function(im){
    return im.complete?null:new Promise(function(res){ im.onload=im.onerror=res; });
  })).then(function(){ return _bpPdfCanvas(stage.firstChild); }).then(function(cv){
    stage.remove();
    return cv;
  }, function(err){ stage.remove(); throw err; });
}
/* One canvas per page, scaled down to fit the whole page. */
function _bpPdfFit(canvases){
  var pdf=new window.jspdf.jsPDF({orientation:'landscape', unit:'pt', format:'letter'});
  var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight(), m=18;
  canvases.forEach(function(cv, i){
    if(i) pdf.addPage();
    var s=Math.min((pw-2*m)/cv.width, (ph-2*m)/cv.height);
    var w=cv.width*s, h=cv.height*s;
    pdf.addImage(cv.toDataURL('image/jpeg', 0.88), 'JPEG', (pw-w)/2, m, w, h);
  });
  return pdf;
}
function _bpExceptionRows(data){
  if(data.months.length!==1) return [];
  var out=[], today=_bpToday();
  Object.keys(data.grid).forEach(function(v){
    var c=data.grid[v][0];
    c.rows.forEach(function(r){ if(!r.confirmed && r.d>=today) out.push({r:r, c:c}); });
  });
  out.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
  return out;
}
function _bpBuildPdf(data){
  var ms=data.months;
  var period=ms.length>1?(ms[0].label+' – '+ms[ms.length-1].label):ms[0].label;
  var sub=(ms.length>1?'Three Month Booking Plan':'Monthly Booking Plan')+' · '+period+' · '+(_bpVenue==='all'?'All venues':_bpVenue);
  var canvases=[];
  var exc=_bpExceptionRows(data);
  _bpBusy(true, 'Cover page');
  return _ensurePdfLibs().then(function(){
    return document.fonts&&document.fonts.ready?document.fonts.ready:null;
  }).then(function(){
    return _bpRenderPage(_bpCoverHtml('Entertainment Approval', sub));
  }).then(function(cv){
    canvases.push(cv);
    _bpBusy(true, 'Booking plan');
    if(_bpPanel==='meeting') return _bpCaptureSheet().then(function(cv){ canvases.push(cv); });
    if(ms.length===1) return _bpRenderPage(_bpPrintSheetHtml(data)).then(function(cv){ canvases.push(cv); });
    var chain=Promise.resolve();
    ms.forEach(function(m, mi){
      chain=chain.then(function(){ return _bpRenderPage(_bpPrintSheetHtml(data, mi)); }).then(function(cv){ canvases.push(cv); });
    });
    return chain;
  }).then(function(){
    if(!exc.length) return null;
    var chain=_bpRenderPage(_bpCoverHtml('Budget Exceptions', exc.length+' upcoming performance'+(exc.length===1?'':'s')+' not confirmed · '+period)).then(function(cv){ canvases.push(cv); });
    exc.forEach(function(x, i){
      chain=chain.then(function(){
        _bpBusy(true, 'Budget exception '+(i+1)+' of '+exc.length+' · 3D floor plan');
        return _bpSnap3d(x.r.venue, x.r.d);
      }).then(function(snap){
        _bpBusy(true, 'Budget exception '+(i+1)+' of '+exc.length);
        return _bpRenderPage(_bpExceptionPageHtml(x.r, x.c, snap));
      }).then(function(cv){ canvases.push(cv); });
    });
    return chain;
  }).then(function(){
    return _bpPdfFit(canvases);
  }).then(function(pdf){
    _bpBusy(false);
    return pdf;
  }, function(err){
    _bpBusy(false);
    throw err;
  });
}
function bpExportPdf(){
  if(_bpPanel==='history'){ alert('Switch to Plan or Meeting to export.'); return; }
  _bpBuildPdf(_bpCompute()).then(function(pdf){
    pdf.save(_bpPdfName());
  }).catch(function(err){
    alert('Could not export the PDF. '+(err&&err.message?err.message:''));
  });
}
function _bpEmailHtml(data){
  var ms=data.months;
  var h='<div style="font-family:Arial,sans-serif;font-size:13px;color:#172033">';
  h+='<p>Hi all,</p><p>Please find attached the rolling three-month entertainment booking plan ('+_escHtml(ms[0].label+' – '+ms[ms.length-1].label)+'), showing confirmed commitments, proposed bookings, totals by venue and month, and exceptions requiring approval.</p>';
  h+='<p><b>Finance:</b> please confirm the budget available for each venue and month.</p>';
  h+='<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:12px"><tr style="background:#0f2a4a;color:#fff"><th align="left">Venue</th><th align="left">Month</th><th align="right">Budget</th><th align="right">Confirmed</th><th align="right">Proposed</th><th align="right">Total</th><th align="right">Remaining</th></tr>';
  Object.keys(data.grid).forEach(function(v){
    data.grid[v].forEach(function(c){
      var rem=c.remaining;
      h+='<tr style="border-bottom:1px solid #e2e8f0"><td>'+_escHtml(v)+'</td><td>'+_escHtml(c.month.short)+'</td><td align="right">'+(c.budget!=null?$k(c.budget):'Not set')+'</td><td align="right">'+$k(c.confirmed)+'</td><td align="right">'+$k(c.proposed)+'</td><td align="right"><b>'+$k(c.planned)+'</b></td>'
        +'<td align="right" style="color:'+(rem==null?'#64748b':(rem>=0?'#15803d':'#b91c1c'))+'">'+(rem==null?'-':(rem>=0?'Under ':'Over ')+$k(Math.abs(rem)))+'</td></tr>';
    });
  });
  h+='</table>';
  var exc=[];
  Object.keys(data.grid).forEach(function(v){ data.grid[v].forEach(function(c){ c.rows.forEach(function(r){ if(r.needs) exc.push(r); }); }); });
  if(exc.length){
    h+='<p style="margin-top:16px"><b>Exceptions requiring approval ('+exc.length+')</b></p><ul>';
    exc.forEach(function(r){ h+='<li>'+_escHtml(_bpDay(r.d)+' · '+(BP_VENUE_SHORT[r.venue]||r.venue)+' · '+(r.dj||'TBD')+' · fee '+$k(r.fee)+' · over by '+$k(r.overage)+' · '+BP_APPROVAL_LABEL[r.approval])+'</li>'; });
    h+='</ul>';
  } else {
    h+='<p style="margin-top:16px">No exceptions requiring approval this period.</p>';
  }
  h+='<p>Thank you,<br>'+_escHtml(_bpWho()==='Unknown'?'Entertainment':_bpWho())+'</p></div>';
  return h;
}
function bpGenerateMonthlyPlan(){
  var savedMode=_bpMode, savedPanel=_bpPanel, savedOffset=_bpOffset;
  _bpMode='3m'; _bpPanel='plan'; _bpOffset=0;
  renderBookingPlan();
  var data=_bpCompute();
  var btns=document.querySelectorAll('#budgetBookingPlan .bp-btn-dark');
  btns.forEach(function(b){ b.disabled=true; b.textContent='Preparing…'; });
  var ms=data.months;
  var pdfName=_bpPdfName();
  _bpBuildPdf(data).then(function(pdf){
    return pdf.output('blob');
  }).then(function(blob){
    return _blobToBase64(blob);
  }).then(function(b64){
    var eml=_buildForecastFlashEml({
      to:[], cc:[],
      subject:'Entertainment 3-Month Booking Plan — '+ms[0].short+' to '+ms[ms.length-1].short,
      htmlBody:_bpEmailHtml(data),
      attachments:[{filename:pdfName, contentType:'application/pdf', base64:b64}]
    });
    _openBlobInApp(eml, pdfName.replace(/\.pdf$/,'.eml'));
    var totals={budget:0,confirmed:0,proposed:0,planned:0}, byVenue={}, exceptions=0;
    Object.keys(data.grid).forEach(function(v){
      byVenue[v]={};
      data.grid[v].forEach(function(c){
        byVenue[v][c.month.key]={budget:c.budget, confirmed:c.confirmed, proposed:c.proposed, planned:c.planned};
        if(c.budget!=null) totals.budget+=c.budget;
        totals.confirmed+=c.confirmed; totals.proposed+=c.proposed; totals.planned+=c.planned;
        c.rows.forEach(function(r){ if(r.needs) exceptions++; });
      });
    });
    var key=_bpNow().replace(/[:.]/g,'-');
    _bpSave('bookingPlans/'+key, {at:_bpNow(), by:_bpWho(), period:ms[0].short+' – '+ms[ms.length-1].short,
      venues:_bpVenue, totals:totals, byVenue:byVenue, exceptions:exceptions});
  }).catch(function(err){
    alert('Could not prepare the monthly plan. '+(err&&err.message?err.message:''));
  }).then(function(){
    _bpMode=savedMode; _bpPanel=savedPanel; _bpOffset=savedOffset;
    renderBookingPlan();
  });
}
