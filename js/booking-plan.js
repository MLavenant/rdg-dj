/* Three Month Rolling Average (sidebar, below Budget).
   Read-only on the calendar: reads SCHED / showTargets / MONTHLY_DJ_BUDGET and never
   writes to schedOverrides or calls any calendar save path. Its own data lives in
   rdg/bookingApprovals, rdg/budgetConfirmations, rdg/bookingPlans, rdg/bookingMeetings
   and is loaded by dedicated listeners that do not go through _fbApply. */

var BP_VENUES=['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'];
var BP_VENUE_SHORT={'Casa Neos Beach Club':'Beach Club','Casa Neos Lounge':'CN Lounge','MILA Lounge':'MILA'};
var BP_CONFIRMED=['Confirmed','Invoice + Contract Signed','Contract + invoice received'];
var BP_EXECS=['Mika','Greg'];
var _bpVenue='Casa Neos Beach Club';
var _bpOffset=0;
var _bpPanel='plan';
var _bpAnchorOverride=null;
var _bpData={approvals:{}, confirms:{}, plans:{}, meetings:{}, notes:{}};

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
  window._fbDb.ref('rdg/approvalNotes').on('value', function(snap){
    _bpData.notes=snap.val()||{};
    _bpMaybeRerender();
    if(typeof curView!=='undefined' && curView==='calendar' && typeof renderCal==='function' && !document.getElementById('bpApprModal')){
      try{ renderCal(); }catch(eCal){}
    }
  }, function(err){ try{ console.warn('Approval notes listener failed', err); }catch(e){} });
})();

function _bpMaybeRerender(){
  if(typeof curView==='undefined' || curView!=='rolling') return;
  if(document.getElementById('bpModal')) return;
  var ae=document.activeElement;
  if(ae && ae.closest && ae.closest('#rollingBookingPlan') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
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
function _bpAnchor(){
  if(_bpAnchorOverride) return _bpAnchorOverride;
  if(typeof curYr!=='undefined' && typeof curM!=='undefined' && curM!=null) return {year:curYr, monthIndex:curM};
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY):miamiToday();
  return fiscalInfoForDate(today);
}
/* The meeting month is the calendar month, and it rolls forward after the 25th. */
function wmReportingAnchor(){
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY).slice(0,10):(typeof miamiToday==='function'?miamiToday():'');
  var d=new Date(today+'T12:00:00');
  if(isNaN(d.getTime())) d=new Date();
  var y=d.getFullYear(), m=d.getMonth();
  if(d.getDate()>25){ m+=1; if(m>11){ m=0; y+=1; } }
  return {year:y, monthIndex:m};
}
function _bpMonths(){
  var info=_bpAnchor();
  var y=info.year, mi=info.monthIndex+_bpOffset;
  while(mi<0){ mi+=12; y--; }
  while(mi>11){ mi-=12; y++; }
  var n=3, out=[];
  for(var i=0;i<n;i++){
    var r=fiscalPeriodRange(y, mi);
    out.push({year:y, mi:mi, mm:padMm(mi+1), key:y+'-'+padMm(mi+1), label:MN_FULL[mi]+' '+y, short:MNS[mi]+' '+y, from:r.from, to:r.to, range:fiscalPeriodShortRange(y, mi)});
    mi++; if(mi>11){ mi=0; y++; }
  }
  return out;
}
function _bpMonthAt(offset){
  var info=_bpAnchor();
  var y=info.year, mi=info.monthIndex+(+offset||0);
  while(mi<0){ mi+=12; y--; }
  while(mi>11){ mi-=12; y++; }
  return {year:y, mi:mi, label:MN_FULL[mi]+' '+y};
}
function _bpShiftMonth(m, delta){
  var y=m.year, mi=m.mi+(delta||0);
  while(mi<0){ mi+=12; y--; }
  while(mi>11){ mi-=12; y++; }
  var r=fiscalPeriodRange(y, mi);
  return {year:y, mi:mi, mm:padMm(mi+1), key:y+'-'+padMm(mi+1), label:MN_FULL[mi]+' '+y, short:MNS[mi]+' '+y, from:r.from, to:r.to, range:fiscalPeriodShortRange(y, mi)};
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
  var py=(typeof resolvePyFields==='function')?resolvePyFields(venue, dateStr):null;
  if(py&&(py.py_dj||py.py_fee!=null||py.py_bs_a!=null)){
    var fee=py.py_fee!=null&&py.py_fee!==''&&isFinite(+py.py_fee)?+py.py_fee:null;
    var bs=py.py_bs_a!=null&&py.py_bs_a!==''&&isFinite(+py.py_bs_a)?+py.py_bs_a:null;
    return {dj:py.py_dj||'', fee:fee, bs:bs, ret:(fee>0&&bs!=null)?bs/fee:null, d:'', status:''};
  }
  var show=(typeof _modalLySameDateShow==='function')?_modalLySameDateShow(venue, dateStr):null;
  if(!show) return null;
  var lyFee=show.fee!=null?show.fee:(show.cost!=null?show.cost:null);
  lyFee=lyFee!=null&&lyFee!==''?+lyFee:null;
  var lyBs=show.bs_a!=null?+show.bs_a:null;
  return {dj:show.dj||'', fee:lyFee, bs:lyBs, ret:(lyFee>0&&lyBs!=null)?lyBs/lyFee:null, d:show.d, status:_bpStatus(show)};
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
  if(row.confirmed) return 'confirmed';
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
/* Same figure as the calendar Total Budget: live entertainment plan, not the guest-DJ monthly budget. */
function _bpMonthBudget(venue, m){
  if(!m||typeof getBgtPlan!=='function') return null;
  var live=getBgtPlan(venue, String(m.year), m.mm, 'live');
  return live!=null&&isFinite(+live)?+live:null;
}
/* Prior-year full live-entertainment spend: guest DJ plus every other category. */
function _bpPySpend(venue, m){
  if(!venue||!m||!m.mm||typeof bgtFullLiveSpend!=='function') return null;
  return bgtFullLiveSpend(venue, m.year-1, m.mm);
}
function _bpBudgetFigure(amount, py, venue){
  var v=venue||_bpVenue;
  var pyBit=v==='Casa Neos Lounge'?'':'<em>PY '+(py!=null?$k(py):'\u2014')+'</em>';
  return '<b>'+(amount!=null?$k(amount):'Not set')+'</b>'+pyBit;
}
function _bpVenueMonth(venue, m){
  var budget=_bpMonthBudget(venue, m);
  var conf=(_bpData.confirms[venue]||{})[m.year]; conf=conf?conf[m.mm]:null;
  var rows=[], confirmed=0, proposed=0, bsT=0;
  _bpBookings(venue, m).forEach(function(r){
    var fee=+(r.fee!=null?r.fee:(r.cost||0))||0;
    var status=_bpStatus(r);
    var isConf=BP_CONFIRMED.indexOf(status)>=0;
    var tgt=(typeof showTargets==='function')?showTargets(r):{bs_m:r.bs_m, roi_t:r.roi_t};
    rows.push({uid:_bpUid(r), venue:venue, d:r.d, dj:r.dj||'', fee:fee, status:status, note:r.note||'', confirmed:isConf,
      bs_a:r.bs_a!=null&&r.bs_a!==''&&isFinite(+r.bs_a)?+r.bs_a:null,
      bs_m:tgt&&tgt.bs_m!=null?+tgt.bs_m:null, roi_t:tgt&&tgt.roi_t!=null?+tgt.roi_t:null});
    if(isConf) confirmed+=fee; else proposed+=fee;
    if(tgt&&tgt.bs_m) bsT+=+tgt.bs_m;
  });
  var planned=confirmed+proposed;
  var forecast=(typeof bgtMonthTotalSpend==='function')?bgtMonthTotalSpend(venue, String(m.year), m.mm):planned;
  var cats=(typeof bgtSpendCategoryRows==='function' && typeof bgtCategoryMonthSpend==='function')?bgtSpendCategoryRows().map(function(row){
    return {label:row.label, amount:Math.round(bgtCategoryMonthSpend(venue, String(m.year), m.mm, row.ids)||0)};
  }):[];
  /* Every booking is judged on the whole month (confirmed + proposed vs budget), not a running total. */
  var monthOver=budget!=null ? Math.max(0, planned-budget) : 0;
  rows.forEach(function(row){
    row.runningAfter=planned;
    /* Confirmed shows are committed spend, never budget exceptions. */
    row.needs=!row.confirmed && budget!=null && monthOver>0 && row.fee>0;
    row.overage=budget!=null && monthOver>0 && row.fee>0 ? monthOver : 0;
    row.approval=_bpApprovalState(row);
    row.violation=false;
  });
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
    confirmed:confirmed, proposed:proposed, planned:planned, forecast:forecast, cats:cats,
    remaining:budget!=null?budget-forecast:null, bsT:bsT, py:_bpPriorTotals(venue, m),
    pySpend:_bpPySpend(venue, m), rows:rows, exc:exc};
}
function _bpVenueList(){
  return BP_VENUES.indexOf(_bpVenue)>=0 ? [_bpVenue] : [BP_VENUES[0]];
}
function _bpMonthOverBudget(c){ return !!(c && c.budget!=null && c.planned>c.budget); }
function _bpHighlightRow(r, c){ return !!r && (+r.fee||0)>20000 && _bpMonthOverBudget(c); }
function _bpSectionRow(r){ return !!r && (+r.fee||0)>5000; }
function _bpPlayed(r){
  if(!r||!r.d) return false;
  return (typeof isPastPerformanceDate==='function')?isPastPerformanceDate(r.d):r.d<_bpToday();
}
/* Played nights use the posted bottle-service actual (Toast only when that night has one show and the calendar actual is empty).
   Nights that have not happened use the bottle-service target, never the actual. */
function _bpShowBs(r){
  if(!r) return null;
  var venue=r.venue||r.v;
  if(!_bpPlayed(r)){
    if(r.bs_m!=null&&r.bs_m!==''&&isFinite(+r.bs_m)) return +r.bs_m;
    var tgt=(typeof showTargets==='function')?showTargets(r):null;
    if(tgt&&tgt.bs_m!=null&&isFinite(+tgt.bs_m)) return +tgt.bs_m;
    return null;
  }
  if(r.bs_a!=null&&r.bs_a!==''&&isFinite(+r.bs_a)) return +r.bs_a;
  if(typeof wmToastDay==='function'&&venue){
    var mates=0;
    (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(s){
      if(s&&s._s!=='empty'&&s.d===r.d&&(s.v||s.venue)===venue) mates++;
    });
    var day=wmToastDay(venue, r.d);
    if(day!=null&&mates<=1) return +day;
  }
  return null;
}
function _bpMonthBs(venue, from, to){
  var sum=0, any=false;
  _bpBookings(venue, {from:from, to:to}).forEach(function(r){
    var bs=_bpShowBs(r);
    if(bs!=null&&isFinite(+bs)){ sum+=+bs; any=true; }
  });
  return any?sum:null;
}
function _bpExceptionRow(r, c){ return _bpHighlightRow(r, c) && !r.confirmed; }
function _bpHasRequest(uid){
  if(!uid) return false;
  var n=_bpNotesFor(uid);
  if(String(n.rationale||'').trim() || String(n.benefits||'').trim()) return true;
  return !!(_bpData.approvals && _bpData.approvals[uid]);
}
function _bpNotesFor(uid){
  var n=(_bpData.notes&&uid)?_bpData.notes[uid]:null;
  return n&&typeof n==='object'?n:{};
}
function _bpCompute(){
  var months=_bpMonths();
  var grid={};
  _bpVenueList().forEach(function(v){
    grid[v]=months.map(function(m){ return _bpVenueMonth(v, m); });
  });
  return {months:months, grid:grid};
}

/* ---- Rendering ---- */
var BP_APPROVAL_LABEL={confirmed:'Confirmed', none:'Within budget', past:'Over budget (past)', needed:'Needs approval', reapproval:'Changed — re-approve', pending:'Pending approval', approved:'Approved', rejected:'Rejected'};
function _bpBadge(state){
  return '<span class="bp-badge bp-st-'+state+'">'+BP_APPROVAL_LABEL[state]+'</span>';
}
function _bpMoneyVar(v){
  if(v==null) return '<span class="bp-muted">No budget</span>';
  return '<span class="'+(v>=0?'bp-pos':'bp-neg')+'">'+(v>=0?'Under ':'Over ')+$k(Math.abs(v))+'</span>';
}
function _bpGapHtml(n, lowerBetter, unit){
  if(n==null || isNaN(n)) return '<b class="bp-muted">—</b>';
  var up=n>0.05, down=n<-0.05;
  var good=lowerBetter?down:up;
  var bad=lowerBetter?up:down;
  var cls=good?'bp-pos':(bad?'bp-neg':'bp-muted');
  var abs=(Math.round(Math.abs(n)*10)/10).toFixed(1);
  var sign=up?'+':(down?'\u2212':'');
  return '<b class="'+cls+'">'+sign+abs+unit+'</b>';
}
function _bpPctHtml(pct, lowerBetter){ return _bpGapHtml(pct, lowerBetter, '%'); }
function _bpPpHtml(pp, lowerBetter){ return _bpGapHtml(pp, lowerBetter, ' pp'); }
/* Bottle service sales: actual for nights already played, target for the rest.
   Live entertainment margin is that cost divided by those sales. */
var BP_FIN_KEYS=['sales','live','ebitda','pySales','pyLive','pyEbitda'];
function _bpFinNum(v){ return v!=null&&isFinite(+v)?+v:null; }
function _bpShare(part, sales){ return part!=null&&sales>0?part/sales*100:null; }
function _bpFinFromRaw(raw){
  var s=raw.sales, p=raw.pySales;
  return {
    raw:raw,
    sales:{now:s, py:p, pct:s!=null&&p?(s-p)/Math.abs(p)*100:null, money:true},
    live:{now:_bpShare(raw.live, s), py:_bpShare(raw.pyLive, p), money:false},
    margin:{now:_bpShare(raw.ebitda, s), py:_bpShare(raw.pyEbitda, p), money:false}
  };
}
function _bpPlRaw(venue, year, period){
  var pl=(typeof mrPl==='function')?mrPl(venue, year, period):null;
  if(!pl||_bpFinNum(pl.sales)==null) return null;
  return {sales:+pl.sales, live:_bpFinNum(pl.live), ebitda:_bpFinNum(pl.net)};
}
/* Open month: actual bottle service for nights already played, target for the rest.
   A closed month is all actuals. */
function _bpMonthRaw(venue, m){
  var raw={sales:null, live:null, ebitda:null, pySales:null, pyLive:null, pyEbitda:null};
  if(!venue||!m||m.mi==null) return raw;
  raw.sales=_bpMonthBs(venue, m.from, m.to);
  if(typeof spBsRange==='function'){
    var now=spBsRange(venue, m.from, m.to);
    if(now) raw.live=now.fee;
  }
  var pyR=fiscalPeriodRange(m.year-1, m.mi);
  raw.pySales=_bpMonthBs(venue, pyR.from, pyR.to);
  if(typeof spBsRange==='function'){
    var py=spBsRange(venue, pyR.from, pyR.to);
    if(py) raw.pyLive=py.fee;
  }
  return raw;
}
function _bpDayRaw(venue, date){
  var raw={sales:null, live:null, ebitda:null, pySales:null, pyLive:null, pyEbitda:null};
  var day=(typeof spSimDay==='function')?spSimDay(venue, date):null;
  if(day){ raw.sales=day.sales; raw.live=day.fee; raw.ebitda=day.ebitda; }
  var ly=_bpLyShow(venue, date);
  var pySales=ly&&typeof mrDaySales==='function'?mrDaySales(venue, ly.d):null;
  if(pySales!=null){
    raw.pySales=pySales;
    raw.pyLive=ly.fee;
    var m=typeof mrDayMargin==='function'?mrDayMargin(venue, pySales, ly.fee):null;
    raw.pyEbitda=m?m.ebitda:null;
  }
  return raw;
}
function _bpFinFor(c){
  if(c&&c._fin) return c._fin;
  var m=c&&c.month||{};
  var isDay=!m.from&&/^\d{4}-\d{2}-\d{2}$/.test(String(m.key||''));
  return _bpFinFromRaw(isDay?_bpDayRaw(c.venue, m.key):_bpMonthRaw(c.venue, m));
}
function _bpFinSum(list){
  var raw={};
  BP_FIN_KEYS.forEach(function(k){
    var total=0, ok=list.length>0;
    list.forEach(function(f){
      var v=f&&f.raw?f.raw[k]:null;
      if(v==null) ok=false; else total+=v;
    });
    raw[k]=ok?total:null;
  });
  return _bpFinFromRaw(raw);
}
function _bpVsParts(month){
  var y=month&&+month.year;
  if(y) return {now:String(y), py:String(y-1)};
  var a=month&&+month.yearFrom, b=month&&+month.yearTo;
  if(!(a&&b)) return null;
  if(a===b) return {now:String(a), py:String(a-1)};
  return {now:a+'\u2013'+String(b).slice(-2), py:(a-1)+'\u2013'+String(b-1).slice(-2)};
}
function _bpFinAmt(pair, which){
  var n=which==='py'?pair.py:pair.now;
  if(n==null||!isFinite(+n)) return '—';
  return pair.money?$k(n):(Math.round(n*10)/10).toFixed(1)+'%';
}
function _bpFinGap(pair){ return pair.now!=null&&pair.py!=null?pair.now-pair.py:null; }
function _bpFinVals(pair, mode){
  var gap=mode==='pp-down'?_bpPpHtml(_bpFinGap(pair), true):(mode==='pp-up'?_bpPpHtml(_bpFinGap(pair), false):_bpPctHtml(pair.pct, false));
  return '<div class="bp-sf-vals"><b>'+_bpFinAmt(pair,'now')+'</b><b>'+_bpFinAmt(pair,'py')+'</b><span class="bp-sf-var">'+gap+'</span></div>';
}
function _bpFinColHtml(month, fin, kind){
  var parts=_bpVsParts(month)||{now:'',py:''};
  var h='<div class="bp-sf-col'+(kind?' bp-sf-'+kind:'')+'">';
  h+='<div class="bp-sf-mh"><b>'+_escHtml(month.label||'')+'</b>'+(month.range?'<span>'+_escHtml(month.range)+'</span>':'')+'</div>';
  h+='<div class="bp-sf-yhs"><b>'+parts.now+'</b><b>'+parts.py+'</b><b>Var</b></div>';
  h+=_bpFinVals(fin.sales);
  h+=_bpFinVals(fin.live, 'pp-down');
  h+='</div>';
  return h;
}
function _bpFinLabsHtml(){
  return '<div class="bp-sf-labs"><div></div><div></div><div class="bp-sf-lab">Bottle service sales</div><div class="bp-sf-lab">Live ent. margins</div></div>';
}
function _bpCatSplitHtml(cats, labelsOnly){
  var h='<div class="bp-split">';
  (cats||[]).forEach(function(cat){
    h+='<div class="bp-split-line"><span>'+_escHtml(cat.label)+'</span>'+(labelsOnly?'':'<b>'+$k(cat.amount)+'</b>')+'</div>';
  });
  return h+'</div>';
}
function _bpPlanBoxHtml(c){
  var over=c.remaining!=null && c.remaining<0;
  var under=c.remaining!=null && c.remaining>=0;
  var shown=c.forecast!=null?c.forecast:c.planned;
  return '<div class="bp-planned-box'+(over?' bp-planned-over':(under?' bp-planned-under':''))+'">'
    +'<div class="bp-fc-row"><b>'+$k(shown)+'</b></div>'
    +'<div class="bp-fc-row">'+_bpMoneyVar(c.remaining)+'</div>'
    +_bpCatSplitHtml(c.cats, false)+'</div>';
}
function _bpBudgetLabelsHtml(){
  var cats=(typeof bgtSpendCategoryRows==='function')?bgtSpendCategoryRows().map(function(row){ return {label:row.label}; }):[];
  return '<article class="bp-card bp-lbl-card"><div class="bp-card-hd"><b>&nbsp;</b><span>&nbsp;</span></div>'
    +'<div class="bp-budget-box"><span>Total Budget</span><em>'+(_bpVenue==='Casa Neos Lounge'?'&nbsp;':'PY spent')+'</em></div>'
    +'<div class="bp-planned-box"><div class="bp-fc-row"><span>Total Forecast Spend</span></div><div class="bp-fc-row"><span>Variance</span></div>'
    +_bpCatSplitHtml(cats, true)+'</div>'
    +'<div class="bp-card-foot"></div></article>';
}
function _bpActualBudgetHtml(c){
  var m=c.month||{};
  var h='<article class="bp-card bp-card-actual">';
  h+='<div class="bp-card-hd"><b>'+_escHtml(m.label||'Prior month')+'</b><span>'+(m.range?_escHtml(m.range):'&nbsp;')+'</span></div>';
  h+='<div class="bp-budget-box">'+_bpBudgetFigure(c.budget, c.pySpend, c.venue)+'</div>';
  h+=_bpPlanBoxHtml(c);
  h+='<div class="bp-card-foot"></div></article>';
  return h;
}
function _bpSplitLine(label, amount){
  return '<div class="bp-split-line"><i class="bp-arr"></i><span>'+label+'</span><b>'+$k(amount)+'</b></div>';
}
function _bpBsVsHtml(target, actual){
  return '<b>'+(target!=null?$k(target):'—')+'</b><em>target</em><span class="bp-bsva-vs">vs</span><b>'+(actual!=null?$k(actual):'—')+'</b><em>'+(actual!=null?'PY actual':'no PY')+'</em>';
}

function renderBookingPlan(){
  var host=document.getElementById('rollingBookingPlan');
  if(!host) return;
  var meta=document.getElementById('rollingMeta');
  var data=_bpCompute();
  var ms=data.months;
  if(meta) meta.textContent=(ms.length>1?(ms[0].short+' – '+ms[ms.length-1].short):ms[0].label)+' · reads the live calendar · approvals stored separately';

  _bpPanel='plan';
  var h='<div class="bp-toolbar">';
  h+='<div class="bp-seg">'
    +'<button type="button" class="on" onclick="bpSetPanel(\'plan\')">Plan</button>'
    +'</div>';
  h+='<div class="bp-nav"><button type="button" onclick="bpShift(-1)" title="Previous month">&#8249;</button>'
    +'<button type="button" onclick="bpShift(0)"'+(_bpOffset===0?' class="on"':'')+'>Today</button>'
    +'<button type="button" onclick="bpShift(1)" title="Next month">&#8250;</button></div>';
  h+='<label class="bp-month-lbl">Start month'
    +'<select class="bp-venue-sel" onchange="bpSetStart(this.value)">';
  for(var off=-12; off<=18; off++){
    var opt=_bpMonthAt(off);
    h+='<option value="'+off+'"'+(off===_bpOffset?' selected':'')+'>'+_escHtml(opt.label)+'</option>';
  }
  h+='</select></label>';
  h+='<select class="bp-venue-sel" onchange="bpSetVenue(this.value)">'
    +BP_VENUES.map(function(v){ return '<option value="'+_escHtml(v)+'"'+(_bpVenue===v?' selected':'')+'>'+_escHtml(v)+'</option>'; }).join('')
    +'</select>';
  h+='<span class="bp-spacer"></span>';
  h+='<button type="button" class="bp-btn" onclick="bpExportPdf()">Export PDF</button>';
  h+='</div>';

  h+=_bpPlanHtml(data);
  host.innerHTML=h;
}

function _bpAddTotals(t, c){
  if(c.budget!=null){ t.budget=(t.budget||0)+c.budget; t.hasB=true; }
  t.confirmed+=c.confirmed; t.proposed+=c.proposed; t.bsT+=c.bsT;
  (c.cats||[]).forEach(function(cat, i){
    if(!t.cats[i]) t.cats[i]={label:cat.label, amount:0};
    t.cats[i].amount+=(cat.amount||0);
  });
  t.forecast=(t.forecast||0)+(c.forecast!=null?c.forecast:(c.planned||0));
  if(c.py){
    if(c.py.fee!=null){ t.pyFee=(t.pyFee||0)+c.py.fee; t.hasPyFee=true; }
    if(c.py.bs!=null){ t.pyBs=(t.pyBs||0)+c.py.bs; t.hasPyBs=true; }
  }
  if(c.pySpend!=null){ t.pySpend=(t.pySpend||0)+c.pySpend; t.hasPySpend=true; }
  else t.pyMiss=true;
}
function _bpBlankTot(){ return {budget:0,hasB:false,confirmed:0,proposed:0,forecast:0,bsT:0,cats:[],pyFee:0,hasPyFee:false,pyBs:0,hasPyBs:false,pySpend:0,hasPySpend:false,pyMiss:false}; }
function _bpActualForVenues(venues, prev){
  if(venues.length===1) return _bpVenueMonth(venues[0], prev);
  var bucket=_bpBlankTot();
  var fins=[];
  venues.forEach(function(v){
    var cell=_bpVenueMonth(v, prev);
    _bpAddTotals(bucket, cell);
    fins.push(_bpFinFor(cell));
  });
  var card=_bpTotCard(bucket, prev.label, prev.range);
  card.month=prev;
  card._fin=_bpFinSum(fins);
  card.isTotal=false;
  return card;
}
function _bpBandHtml(cells, months, actualCell){
  var cards='', tot=_bpBlankTot(), fins=[];
  cells.forEach(function(c){
    cards+=_bpCardHtml(c);
    _bpAddTotals(tot, c);
    fins.push(_bpFinFor(c));
  });
  if(months.length>1) cards+=_bpCardHtml(_bpTotCard(tot, months.length+'-month total', _bpSpanRange(months)));
  var sheet=_bpFinLabsHtml()+_bpFinColHtml(actualCell.month||{}, _bpFinFor(actualCell), 'past');
  cells.forEach(function(c, i){ sheet+=_bpFinColHtml(c.month, fins[i], ''); });
  if(months.length>1) sheet+=_bpFinColHtml({label:months.length+'-month total', range:_bpSpanRange(months), yearFrom:months[0].year, yearTo:months[months.length-1].year}, _bpFinSum(fins), 'total');
  var n=cells.length+(months.length>1?1:0);
  var cols=n+1;
  var h='<div class="bp-eq" style="--bp-cols:'+cols+';--bp-n:'+n+'">';
  h+='<div class="bp-eq-frame"></div>';
  h+='<div class="bp-eq-actual-hd">Actual</div>';
  h+='<div class="bp-eq-forecast-hd">Forecast</div>';
  h+='<div class="bp-subhd bp-eq-subhd">Budget vs pipeline</div>';
  h+='<div class="bp-eq-cards">'+_bpBudgetLabelsHtml()+_bpActualBudgetHtml(actualCell)+cards+'</div>';
  h+='<div class="bp-eq-finhd">Financial</div>';
  h+='<div class="bp-eq-allfins">'+sheet+'</div>';
  h+='</div>';
  return h;
}
function _bpSummaryHtml(data){
  var venues=Object.keys(data.grid);
  var prev=_bpShiftMonth(data.months[0], -1);
  var h='<div class="bp-summary">';
  venues.forEach(function(v){
    h+='<div class="bp-venue-block"><div class="bp-venue-name">'+_escHtml(v)+'</div>';
    h+=_bpBandHtml(data.grid[v], data.months, _bpVenueMonth(v, prev));
    h+='</div>';
  });
  if(venues.length>1){
    var combined=data.months.map(function(m, i){
      var bucket=_bpBlankTot();
      var fins=[];
      venues.forEach(function(v){
        _bpAddTotals(bucket, data.grid[v][i]);
        fins.push(_bpFinFor(data.grid[v][i]));
      });
      var card=_bpTotCard(bucket, m.label, m.range);
      card.month=m;
      card._fin=_bpFinSum(fins);
      return card;
    });
    h+='<div class="bp-venue-block"><div class="bp-venue-name">All venues</div>';
    h+=_bpBandHtml(combined, data.months, _bpActualForVenues(venues, prev));
    h+='</div>';
  }
  h+='</div>';
  return h;
}
function _bpSpanRange(months){
  if(!months || months.length<2) return '';
  var a=String(months[0].range||'').split('\u2013')[0];
  var parts=String(months[months.length-1].range||'').split('\u2013');
  var b=parts[parts.length-1];
  if(!a || !b) return '';
  return a.trim()+'\u2013'+b.trim();
}
function _bpTotCard(t, label, range){
  var planned=t.confirmed+t.proposed;
  var shown=t.forecast!=null?t.forecast:planned;
  return {venue:'', month:{label:label, range:range||'', year:0, mm:''}, budget:t.hasB?t.budget:null,
    confirmed:t.confirmed, proposed:t.proposed, planned:planned, forecast:shown, cats:t.cats,
    remaining:t.hasB?t.budget-shown:null, bsT:t.bsT,
    py:{fee:t.hasPyFee?t.pyFee:null, bs:t.hasPyBs?t.pyBs:null, label:'prior year'},
    pySpend:t.hasPySpend&&!t.pyMiss?t.pySpend:null,
    exc:null, confirm:null, isTotal:true};
}
function _bpCardHtml(c){
  var m=c.month;
  var h='<article class="bp-card'+(c.isTotal?' bp-card-total':' bp-cast')+'">';
  h+='<div class="bp-card-hd"><b>'+_escHtml(m.label)+'</b><span>'+(m.range?_escHtml(m.range):'&nbsp;')+'</span></div>';
  h+='<div class="bp-budget-box">'+_bpBudgetFigure(c.budget, c.pySpend, c.venue)+'</div>';
  h+=_bpPlanBoxHtml(c);
  var foot='';
  if(!c.isTotal){
    var e=c.exc||{}, tags=[];
    if(e.needed) tags.push('<span class="bp-tag bp-tag-amb">'+e.needed+' need approval</span>');
    if(e.pending) tags.push('<span class="bp-tag bp-tag-blue">'+e.pending+' pending</span>');
    if(e.approved) tags.push('<span class="bp-tag bp-tag-green">'+e.approved+' approved</span>');
    if(e.rejected) tags.push('<span class="bp-tag bp-tag-grey">'+e.rejected+' rejected</span>');
    if(tags.length) foot+='<div class="bp-tags">'+tags.join('')+'</div>';
    var conf=c.confirm
      ? '<span class="bp-fin '+(c.confirmStale?'bp-fin-stale':'bp-fin-ok')+'" title="'+_escHtml('Confirmed by '+c.confirm.by+' on '+_bpFmtDate(c.confirm.at))+'">'+(c.confirmStale?'Budget changed since Finance confirmed':'Finance confirmed')+'</span>'
      : '<button type="button" class="bp-fin bp-fin-btn" onclick="bpConfirmBudget(\''+_escHtml(c.venue).replace(/'/g,"\\'")+'\','+m.year+',\''+m.mm+'\')">Finance: confirm budget</button>';
    foot+='<div class="bp-fin-row">'+conf+'</div>';
  }
  h+='<div class="bp-card-foot">'+foot+'</div></article>';
  return h;
}
function _bpMonthPosition(venue, dateStr){
  if(!venue||!dateStr) return null;
  var info=fiscalInfoForDate(dateStr);
  var range=fiscalPeriodRange(info.year, info.monthIndex);
  var spend=0;
  _bpBookings(venue, {from:range.from, to:range.to}).forEach(function(r){
    spend+=+(r.fee!=null?r.fee:(r.cost||0))||0;
  });
  var budget=_bpMonthBudget(venue, {year:info.year, mm:info.mm});
  return {spend:spend, budget:budget, left:budget!=null?budget-spend:null};
}
function _bpPosHtml(pos){
  if(!pos) return '-';
  var h='<div>'+$k(pos.spend)+(pos.budget!=null?'<span class="bp-muted"> / '+$k(pos.budget)+'</span>':'')+'</div>';
  if(pos.left!=null) h+='<div class="'+(pos.left>=0?'bp-pos':'bp-neg')+'">'+(pos.left>=0?'Under ':'Over ')+$k(Math.abs(pos.left))+'</div>';
  return h;
}
function _bpRoiHtml(x){ return x!=null?(+x).toFixed(1)+'x':'-'; }
function _bpPyOn(data){
  var venues=Object.keys(data&&data.grid||{});
  if(!venues.length) return _bpVenue!=='Casa Neos Lounge';
  return venues.some(function(v){ return v!=='Casa Neos Lounge'; });
}
function _bpLyBits(ly){
  return {
    dj:ly&&ly.dj?_escHtml(ly.dj):'\u2014',
    fee:ly&&ly.fee!=null?$k(ly.fee):'\u2014',
    bs:ly&&ly.bs!=null?$k(ly.bs):'\u2014'
  };
}
/* Same bottle-service sales as the financial row: this year is actual for nights already played and target for the rest. Prior year is actual only. */
function _bpMonthBottle(data, m){
  var sales=0, py=0, has=false, hasPy=false;
  Object.keys(data.grid||{}).forEach(function(v){
    var raw=_bpMonthRaw(v, m);
    if(raw.sales!=null){ sales+=raw.sales; has=true; }
    if(v!=='Casa Neos Lounge' && raw.pySales!=null){ py+=raw.pySales; hasPy=true; }
  });
  return {sales:has?sales:null, py:hasPy?py:null};
}
function _bpBkHead(simple, py){
  var cols='<span>Artist</span>'+(py?'<span class="bp-lyh">2025</span>':'')+'<span class="r">Fee</span>'+(py?'<span class="bp-lyh r">2025</span>':'')+'<span>Status</span><span class="r">BS actual</span>'+(py?'<span class="bp-lyh r">2025</span>':'');
  return '<div class="bp-bk-hd"><span>Date</span><div class="bp-bk-cols'+(py?'':' bp-cols-now')+'">'+cols+'</div>'+(simple?'':'<span>Approval</span>')+'</div>';
}
function _bpTotalBox(simple, py, label, n, fee, pyFeeTxt, bsTxt, pyBsTxt){
  var box='<div class="bp-bk-box bp-bk-total"><div class="bp-bk-date"><b>'+_escHtml(label||'Total')+'</b><span>All shows</span></div><div class="bp-bk-lines"><div class="bp-bk-cols bp-bk-line bp-bk-now'+(py?'':' bp-cols-now')+'">';
  box+='<span class="bp-dj">'+n+' bookings</span>';
  if(py) box+='<span></span>';
  box+='<span class="bp-fee">'+$k(fee)+'</span>';
  if(py) box+='<span class="bp-lyc bp-lym">'+(pyFeeTxt||'\u2014')+'</span>';
  box+='<span></span>';
  box+='<span class="bp-bsnow">'+(bsTxt||'\u2014')+'</span>';
  if(py) box+='<span class="bp-lyc bp-lym">'+(pyBsTxt||'\u2014')+'</span>';
  box+='</div></div>'+(simple?'':'<div class="bp-bk-appr"></div>')+'</div>';
  return box;
}
function _bpRowsHtml(data, opts){
  opts=opts||{};
  var simple=!!opts.noActions;
  var py=_bpPyOn(data);
  var items=[];
  var now={n:0, fee:0, bs:0, hasBs:false};
  var pyFee=0, pyN=0, pyBs=0, pyHasBs=false;
  var mTot={};
  data.months.forEach(function(m, mi){ mTot[mi]={n:0, fee:0, pyFee:0, pyN:0}; });
  data.months.forEach(function(m, mi){
    var monthRows=[];
    Object.keys(data.grid).forEach(function(v){
      var c=data.grid[v][mi];
      c.rows.forEach(function(r){ monthRows.push({r:r, budget:c.budget, planned:c.planned}); });
    });
    monthRows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
    monthRows.forEach(function(x){
      var r=x.r;
      var ly=py?_bpLyShow(r.venue, r.d):null;
      var bits=py?_bpLyBits(ly):null;
      var bsNow=_bpShowBs(r);
      now.n++; now.fee+=r.fee||0;
      if(bsNow!=null){ now.bs+=bsNow; now.hasBs=true; }
      if(ly&&ly.fee!=null){ pyFee+=ly.fee; pyN++; }
      if(ly&&ly.bs!=null){ pyBs+=ly.bs; pyHasBs=true; }
      var mt=mTot[mi];
      mt.n++; mt.fee+=r.fee||0;
      if(ly&&ly.fee!=null){ mt.pyFee+=ly.fee; mt.pyN++; }
      var played=_bpPlayed(r);
      var cls=(r.violation?' bp-bk-viol':(r.needs?' bp-bk-over':''))+(played?' bp-bk-played':'');
      var box='<div class="bp-bk-box'+cls+'">';
      box+='<div class="bp-bk-date"><b>'+_bpDay(r.d)+'</b><span>'+_escHtml(BP_VENUE_SHORT[r.venue]||r.venue)+'</span></div>';
      box+='<div class="bp-bk-lines"><div class="bp-bk-cols bp-bk-line bp-bk-now'+(py?'':' bp-cols-now')+'">';
      box+='<span class="bp-dj">'+_escHtml(r.dj||'TBD')+'</span>';
      if(py) box+='<span class="bp-lyc">'+bits.dj+'</span>';
      box+='<span class="bp-fee">'+$k(r.fee)+'</span>';
      if(py) box+='<span class="bp-lyc bp-lym">'+bits.fee+'</span>';
      box+='<span><span class="bp-status '+(played?'bp-status-actual':(r.confirmed?'bp-status-conf':'bp-status-prop'))+'">'+_escHtml(played?'Actual':(r.status||'No status'))+'</span></span>';
      box+='<span class="bp-bsnow">'+(bsNow!=null?$k(bsNow):'\u2014')+'</span>';
      if(py) box+='<span class="bp-lyc bp-lym">'+bits.bs+'</span>';
      box+='</div></div>';
      if(!simple){
        box+='<div class="bp-bk-appr">'+_bpBadge(r.approval);
        if(_bpHasRequest(r.uid)) box+='<span class="bp-tag bp-tag-green">Request sent</span>';
        if(r.approval==='needed'||r.approval==='reapproval') box+='<button type="button" class="bp-act bp-act-main" onclick="bpOpenRequest(\''+r.uid+'\')">Request approval</button>';
        else if(r.approval!=='none' && r.approval!=='past' && r.approval!=='confirmed') box+='<button type="button" class="bp-act" onclick="bpOpenRequest(\''+r.uid+'\')">Open</button>';
        box+='</div>';
      }
      box+='</div>';
      items.push({label:m.label, range:m.range, html:box});
    });
  });
  function paint(list){
    var out=_bpBkHead(simple, py);
    var last='';
    list.forEach(function(it){
      if(it.label!==last){
        out+='<div class="bp-bk-month">'+_escHtml(it.label)+' <span>'+_escHtml(it.range||'')+'</span></div>';
        last=it.label;
      }
      out+=it.html;
    });
    return out;
  }
  var byMonth=!!opts.byMonth;
  var split=opts.columns===2 && items.length>1;
  var h='<div class="bp-bk'+(simple?' bp-bk-simple':'')+(split||byMonth?' bp-bk-splitwrap':'')+'">';
  if(!items.length){
    h+=_bpBkHead(simple, py)+'<div class="bp-empty">No performances.</div>';
  } else if(byMonth){
    var groups=[], seen={};
    data.months.forEach(function(m){
      seen[m.label]={label:m.label, range:m.range, items:[]};
      groups.push(seen[m.label]);
    });
    items.forEach(function(it){
      if(!seen[it.label]){ seen[it.label]={label:it.label, range:it.range, items:[]}; groups.push(seen[it.label]); }
      seen[it.label].items.push(it);
    });
    h+='<div class="bp-bk-months">';
    groups.forEach(function(g, gi){
      var col=g.items.length?paint(g.items):(_bpBkHead(simple, py)+'<div class="bp-bk-month">'+_escHtml(g.label)+' <span>'+_escHtml(g.range||'')+'</span></div><div class="bp-empty">No performances.</div>');
      var mi=data.months.findIndex(function(mm){ return mm.label===g.label; });
      if(mi>=0){
        var mt=mTot[mi];
        var bot=_bpMonthBottle(data, data.months[mi]);
        col+=_bpTotalBox(simple, py, 'Total', mt.n, mt.fee, mt.pyN?$k(mt.pyFee):'\u2014', bot.sales!=null?$k(bot.sales):'\u2014', bot.py!=null?$k(bot.py):'\u2014');
      }
      h+='<div class="bp-bk-col">'+col+'</div>';
    });
    h+='</div>';
  } else if(split){
    var mid=Math.ceil(items.length/2);
    h+='<div class="bp-bk-split"><div class="bp-bk-col">'+paint(items.slice(0, mid))+'</div><div class="bp-bk-col">'+paint(items.slice(mid))+'</div></div>';
  } else {
    h+=paint(items);
  }
  if(items.length){
    var bsAll=0, pyAll=0, hasBsAll=false, hasPyAll=false;
    data.months.forEach(function(m){
      var bot=_bpMonthBottle(data, m);
      if(bot.sales!=null){ bsAll+=bot.sales; hasBsAll=true; }
      if(bot.py!=null){ pyAll+=bot.py; hasPyAll=true; }
    });
    var grandBox=_bpTotalBox(simple, py, '3-month total', now.n, now.fee, pyN?$k(pyFee):'\u2014', hasBsAll?$k(bsAll):(now.hasBs?$k(now.bs):'\u2014'), hasPyAll?$k(pyAll):'\u2014');
    if(byMonth){
      h+='<div class="bp-bk-grandbar"><div class="bp-bk-grandbar-inner">'+grandBox+'</div></div>';
    } else {
      h+=grandBox;
    }
  }
  h+='</div>';
  return h;
}
function _bpSheetHead(data, title){
  var ms=data.months;
  return '<div class="bp-sheet-hd"><div><b>'+_escHtml(title)+'</b><span>'+_escHtml(ms.length>1?(ms[0].label+' – '+ms[ms.length-1].label):ms[0].label)+' · '+_escHtml(_bpVenue)+'</span></div>'
    +'<div>Prepared '+_escHtml(_bpFmtDate(_bpNow()))+'</div></div>';
}
function _bpDeckSlideHtml(data, n, of){
  var ms=data.months;
  var h='<div class="bp-page bp-deck">';
  h+='<div class="bp-deck-hd"><div><span class="bp-deck-kicker">Three Month Booking Plan · '+n+' of '+of+'</span>'
    +'<b>'+_escHtml(_bpVenue)+'</b>'
    +'<em>'+_escHtml(ms[0].label+' – '+ms[ms.length-1].label)+'</em></div>'
    +'<img src="assets/rdg-logo.png" alt="RDG"></div>';
  h+='<div class="bp-deck-body">';
  h+='<div class="bp-deck-sec bp-sec-1"><span>01</span>Budget vs pipeline<em>Budget and planned spend, then sales and margins versus LY</em></div>';
  h+=_bpSummaryHtml(data);
  h+='<div class="bp-deck-sec bp-sec-2"><span>02</span>Performances<em>Every show, one column per month. Past nights use actual bottle service; upcoming nights use the target</em></div>';
  h+=_bpRowsHtml(data, {noActions:true, byMonth:true});
  h+='</div>';
  h+='<div class="bp-deck-ft"><span>Prepared '+_escHtml(_bpFmtDate(_bpNow()))+'</span><span>Riviera Dining Group · Entertainment</span></div>';
  h+='</div>';
  return h;
}
function _bpPlanHtml(data){
  var h='<div id="bpSheet" class="bp-sheet">';
  h+=_bpSheetHead(data, 'Weekly Meeting');
  h+='<div class="bp-deck-sec bp-sec-1"><span>01</span>Budget vs pipeline<em>Budget and planned spend, then sales and margins versus LY</em></div>';
  h+=_bpSummaryHtml(data);
  h+='<div class="bp-deck-sec bp-sec-2"><span>02</span>Performances<em>Every show. Past nights use actual bottle service; upcoming nights use the target</em></div>';
  h+=_bpRowsHtml(data, {byMonth:true});
  h+='</div>';
  return h;
}

/* ---- Toolbar actions ---- */
function bpSetPanel(p){ _bpPanel=p; renderBookingPlan(); }
function bpSetVenue(v){ if(BP_VENUES.indexOf(v)<0) return; _bpVenue=v; renderBookingPlan(); }
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
  if(!ly) return 'No show on the same weekday last year.';
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
  var monthSpend=row.runningAfter;
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
    +ro('Month confirmed + proposed', $k(monthSpend))
    +ro('Month over budget by', '<span class="bp-neg">'+$k(row.overage)+'</span>')
    +ro('BS Target / ROI Target', $k(row.bs_m)+' / '+(row.roi_t!=null?row.roi_t.toFixed(1)+'x':'-'))
    +'</div>';
  h+='<div class="bp-kv bp-kv-wide"><span>Same weekday last year</span><b>'+_escHtml(_bpLyLine(row))+'</b></div>';
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
  return 'RDG-Weekly-Live-Entertainment-Meeting-'+_bpToday()+'.pdf';
}
function _bpMeetingDateLabel(){
  var ds=_bpToday();
  var d=new Date(ds+'T12:00:00');
  if(isNaN(d.getTime())) return ds;
  return d.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
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
function _bpCoverHtml(title, sub, location){
  return '<div class="bp-page bp-cover">'
    +'<img class="bp-cover-logo" src="assets/rdg-logo.png" alt="RDG">'
    +(location?'<div class="bp-cover-loc">'+_escHtml(location)+'</div>':'')
    +'<div class="bp-cover-box">'+_escHtml(title)+'</div>'
    +(sub?'<div class="bp-cover-sub">'+_escHtml(sub)+'</div>':'')
    +'</div>';
}
function _bpField(lbl, val){
  return '<div class="bp-x-field"><span>'+lbl+'</span><b>'+val+'</b></div>';
}
function _bpExceptionPageHtml(r, c, notes){
  notes=notes||_bpNotesFor(r&&r.uid);
  var today=_bpToday();
  var actual=0, forecast=0;
  c.rows.forEach(function(x){ if(x.d<today) actual+=x.fee||0; else forecast+=x.fee||0; });
  var total=actual+forecast;
  var left=c.budget!=null?c.budget-total:null;
  var ly=_bpLyShow(r.venue, r.d);
  var priced=typeof calcTierPricesForShow==='function'?calcTierPricesForShow(r.venue, r.d, r.fee):null;
  var pos=left==null?'-':'<span class="'+(left>=0?'bp-pos':'bp-neg')+'">'+(left>=0?'Under ':'Over ')+$k(Math.abs(left))+'</span>';
  var h='<div class="bp-page bp-x">';
  h+='<div class="bp-x-hd"><div><b>Budget Exception</b><span>'+_escHtml(r.venue)+' · '+_escHtml(c.month.label)+' ('+_escHtml(c.month.range)+')</span></div>'
    +'<img src="assets/rdg-logo.png" alt="RDG"></div>';

  h+='<div class="bp-x-sec bp-x-band"><span>01</span><b>Booking &amp; performance</b><em>Current booking compared with the same weekday last year</em></div><div class="bp-x-pair">';
  h+='<div class="bp-x-col"><div class="bp-x-col-hd">This year</div><div class="bp-x-fields">'
    +_bpField('DJ', _escHtml(r.dj||'TBD'))
    +_bpField('Date', _bpDay(r.d))
    +_bpField('Fee', $k(r.fee))
    +_bpField('Status', _escHtml(r.status||'No status'))
    +'</div></div>';
  h+='<div class="bp-x-col bp-x-ly"><div class="bp-x-col-hd">Last year'+(ly?' · '+_bpDay(ly.d):'')+'</div><div class="bp-x-fields">';
  if(ly){
    h+=_bpField('DJ', _escHtml(ly.dj||'TBD'))
      +_bpField('Date', _bpDay(ly.d))
      +_bpField('Fee', $k(ly.fee))
      +_bpField('Status', 'Actual');
  } else {
    h+=_bpField('DJ', '—')+_bpField('Date', '—')+_bpField('Fee', '—')+_bpField('Status', 'No show');
  }
  h+='</div></div></div>';
  var rationale=String(notes.rationale!=null?notes.rationale:(r.note||'')).trim();
  var benefits=String(notes.benefits||'').trim();
  h+='<div class="bp-x-sec bp-x-band"><span>02</span><b>Approval case</b><em>Business rationale and expected benefits</em></div>';
  h+='<div class="bp-x-why"><span>Rationale</span><b>'+(rationale?_escHtml(rationale):'No rationale yet.')+'</b></div>';
  h+='<div class="bp-x-why"><span>Expected benefits</span><b>'+(benefits?_escHtml(benefits):'No expected benefits yet.')+'</b></div>';
  var signed=String(notes.approvedBy||'').trim();
  h+='<div class="bp-x-sec bp-x-band"><span>03</span><b>Budget position</b><em>Full-month confirmed plus proposed spend</em></div>';
  h+='<div class="bp-x-bud">'
    +'<div class="bp-x-yel"><span>Total budget</span><b>'+(c.budget!=null?$k(c.budget):'Not set')+'</b></div>'
    +'<div><span>Actual + forecast spend</span><b>'+$k(total)+'</b></div>'
    +'<div><span>Position vs budget</span><b>'+pos+'</b></div>'
    +'</div>';

  var dayFin=_bpFinFor({venue:r.venue, month:{key:r.d}});
  h+='<div class="bp-x-sec bp-x-band"><span>04</span><b>Expected day vs last year</b><em>Sales, margins, and live entertainment</em></div>';
  h+='<div class="bp-x-day">'
    +'<div class="bp-x-day-hd"><span></span><b>This year</b><b>PY</b><b>Var</b></div>'
    +_bpDayVsRow('Expected sales', dayFin.sales)
    +_bpDayVsRow('Margins', dayFin.margin, 'pp-up')
    +_bpDayVsRow('Live entertainment', dayFin.live, 'pp-down')
    +'</div>';

  h+='<div class="bp-x-sec bp-x-band"><span>05</span><b>Table tiers &amp; pricing</b><em>'+(priced&&priced.label?_escHtml(priced.label):'Venue pricing guidance')+'</em></div>';
  h+='<div class="bp-x-tiers">';
  if(priced&&priced.tiers&&priced.tiers.length){
    priced.tiers.forEach(function(t){
      var price=t.suggested!=null?t.suggested:t.minimum;
      var n=(t.tables||[]).length;
      h+='<div class="bp-x-tier" style="--tier-color:'+_escHtml(t.color||'#64748b')+'"><div><b>'+_escHtml(t.name)+'</b><span>'+n+' table'+(n===1?'':'s')+(t.capacity?' · '+t.capacity+' guests':'')+(n?' · #'+t.tables.join(', #'):'')+'</span></div><strong>from '+_escHtml(formatFv3dMoney(price))+'</strong></div>';
    });
  } else {
    h+='<div class="bp-empty">No tier pricing for this venue.</div>';
  }
  h+='</div>';
  h+='<div class="bp-x-approval"><div class="bp-x-sec bp-x-band"><span>06</span><b>Approval</b><em>Executive or Finance authorization</em></div>'
    +'<div class="bp-x-sign"><span>Approved by</span><b>'+(signed?_escHtml(signed):'')+'</b><div class="bp-x-sign-line"></div></div></div>';
  h+='</div>';
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
    venues.forEach(function(v){ var c=data.grid[v][mi]; c.rows.forEach(function(r){ if(_bpSectionRow(r)) rows.push({r:r, budget:c.budget}); }); });
  });
  rows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
  h+='<div class="bp-p-sec">Bookings over $5K'+(onlyMonth!=null?' · '+_escHtml(ms[onlyMonth].label):'')+' · this year vs same weekday last year</div>';
  h+='<table class="bp-p-tbl bp-p-bk"><thead><tr><th colspan="2" class="l"></th><th colspan="5" class="bp-p-now bp-p-end">This year</th><th colspan="5" class="bp-p-ly bp-p-end">Last year (same weekday)</th><th colspan="2"></th></tr>'
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
    else h+='<td colspan="5" class="l bp-p-lyc bp-p-end bp-muted">No show on this weekday last year</td>';
    h+='<td>'+_bpPosHtml(pos)+'</td><td class="l">'+_bpBadge(r.approval)+'</td></tr>';
  });
  if(!rows.length) h+='<tr><td colspan="14" class="bp-muted">No bookings over $5K.</td></tr>';
  else h+='<tr class="bp-p-all"><td class="l" colspan="2"><b>Total</b></td><td class="l"><b>'+t.n+' bookings</b></td><td><b>'+$k(t.fee)+'</b></td><td></td><td><b>'+$k(t.hb?t.bs:null)+'</b></td><td class="bp-p-end"><b>'+_bpRoiHtml(t.fee>0&&t.hb?t.bs/t.fee:null)+'</b></td>'
    +'<td class="l bp-p-lyc" colspan="2">'+lt.n+' same weekdays</td><td class="bp-p-lyc">'+$k(lt.n?lt.fee:null)+'</td><td class="bp-p-lyc">'+$k(lt.hb?lt.bs:null)+'</td><td class="bp-p-lyc bp-p-end">'+_bpRoiHtml(lt.fee>0&&lt.hb?lt.bs/lt.fee:null)+'</td><td colspan="2"></td></tr>';
  h+='</tbody></table></div>';
  return h;
}
function _bpPdfCanvas(el){
  var portrait=el.classList&&el.classList.contains('bp-portrait');
  var native=el.classList&&el.classList.contains('bp-approval-src');
  var big=el.classList&&(el.classList.contains('bp-print')||el.classList.contains('bp-deck')||portrait);
  return window.html2canvas(el,{scale:native?2:(big?2:1.25),useCORS:true,logging:false,backgroundColor:'#ffffff',windowWidth:native?720:(portrait?1236:BP_PAGE_W)}).then(function(cv){
    if(portrait) cv._bpPortrait=true;
    if(native){ cv._bpNative=true; cv._bpPageW=720; cv._bpPageH=1190; }
    return cv;
  });
}
function _bpRenderPage(html){
  var stage=document.createElement('div');
  stage.className='bp-pdf-stage';
  stage.innerHTML=html;
  document.body.appendChild(stage);
  var imgs=Array.prototype.slice.call(stage.querySelectorAll('img'));
  return Promise.all(imgs.map(function(im){
    return im.complete?null:new Promise(function(res){ im.onload=im.onerror=res; });
  })).then(function(){
    var body=stage.querySelector('.bp-deck-body');
    if(body){
      var room=body.clientHeight, need=body.scrollHeight;
      if(need>room && room>0){
        var s=room/need*0.97;
        var inner=document.createElement('div');
        while(body.firstChild) inner.appendChild(body.firstChild);
        inner.style.transformOrigin='top left';
        inner.style.transform='scale('+s.toFixed(4)+')';
        inner.style.width=(100/s).toFixed(2)+'%';
        body.appendChild(inner);
      }
    }
    return _bpPdfCanvas(stage.firstChild);
  }).then(function(cv){
    stage.remove();
    return cv;
  }, function(err){ stage.remove(); throw err; });
}
/* One canvas per page, scaled down to fit the whole page. */
function _bpPdfFit(canvases){
  var pdf=new window.jspdf.jsPDF({orientation:'landscape', unit:'pt', format:'letter'});
  canvases.forEach(function(cv, i){
    var portrait=!!cv._bpPortrait;
    var native=!!cv._bpNative;
    if(i){
      if(native) pdf.addPage([cv._bpPageW, cv._bpPageH]);
      else pdf.addPage('letter', portrait?'portrait':'landscape');
    }
    var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight(), m=native?0:18;
    var s=Math.min((pw-2*m)/cv.width, (ph-2*m)/cv.height);
    var w=cv.width*s, h=cv.height*s;
    var fmt=native?'PNG':'JPEG';
    var data=native?cv.toDataURL('image/png'):cv.toDataURL('image/jpeg', 0.88);
    pdf.addImage(data, fmt, (pw-w)/2, m, w, h);
  });
  return pdf;
}
function _bpDayVsRow(label, pair, mode){
  return '<div class="bp-x-day-row"><span>'+label+'</span>'+_bpFinVals(pair, mode)+'</div>';
}
function _bpRequestBecause(row, cell){
  if(cell && cell.budget!=null && cell.planned>cell.budget) return 'the performance is over Budget by '+$k(cell.planned-cell.budget);
  return 'the performance is above '+$k(row&&row.fee);
}
function _bpRequestSentence(row, cell){
  return 'Hello, I am requesting approval for '+(row.dj||'TBD')+' performance at '+row.venue+' for '+_bpDay(row.d)+' because '+_bpRequestBecause(row, cell)+'.';
}
function _bpExceptionRows(data){
  var out=[];
  Object.keys(data.grid).forEach(function(v){
    data.grid[v].forEach(function(c){
      c.rows.forEach(function(r){ if(_bpExceptionRow(r, c) || _bpHasRequest(r.uid)) out.push({r:r, c:c}); });
    });
  });
  out.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
  return out;
}
function _bpBuildPdf(data){
  var ms=data.months;
  var period=ms[0].label+' – '+ms[ms.length-1].label;
  var loc=_bpVenue;
  var sub='Three Month Booking Plan · '+period;
  var canvases=[];
  _bpBusy(true, 'Cover page');
  return _ensurePdfLibs().then(function(){
    return document.fonts&&document.fonts.ready?document.fonts.ready:null;
  }).then(function(){
    return _bpRenderPage(_bpCoverHtml('Entertainment Approval', sub, loc));
  }).then(function(cv){
    canvases.push(cv);
    _bpBusy(true, 'Booking plan');
    if(_bpPanel==='meeting') return _bpCaptureSheet().then(function(cv2){ canvases.push(cv2); });
    return _bpRenderPage(_bpPrintSheetHtml(data, null)).then(function(cv2){ canvases.push(cv2); });
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
  var build=_bpPanel==='meeting'?_bpBuildPdf(_bpCompute()):_bpBuildLocationPages();
  build.then(function(pdf){
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
  Object.keys(data.grid).forEach(function(v){ data.grid[v].forEach(function(c){ c.rows.forEach(function(r){ if(_bpHighlightRow(r, c)) exc.push(r); }); }); });
  if(exc.length){
    h+='<p style="margin-top:16px"><b>Bookings over $20K in months that exceed budget ('+exc.length+')</b></p><ul>';
    exc.forEach(function(r){ h+='<li>'+_escHtml(_bpDay(r.d)+' · '+(BP_VENUE_SHORT[r.venue]||r.venue)+' · '+(r.dj||'TBD')+' · fee '+$k(r.fee)+' · month over budget by '+$k(r.overage)+' · '+BP_APPROVAL_LABEL[r.approval])+'</li>'; });
    h+='</ul>';
  } else {
    h+='<p style="margin-top:16px">No bookings over $20K in a month that exceeds its budget.</p>';
  }
  h+='<p>Thank you,<br>'+_escHtml(_bpWho()==='Unknown'?'Entertainment':_bpWho())+'</p></div>';
  return h;
}
function _bpComputeVenue(v){
  var saved=_bpVenue;
  _bpVenue=v;
  var data=_bpCompute();
  _bpVenue=saved;
  return data;
}
function _bpCombinedPlan(){
  var grid={};
  var months=null;
  BP_VENUES.forEach(function(v){
    var data=_bpComputeVenue(v);
    months=data.months;
    grid[v]=data.grid[v];
  });
  return {months:months, grid:grid};
}
function _bpBuildLocationPages(){
  var canvases=[];
  var saved=_bpVenue;
  var period='';
  _bpAnchorOverride=(typeof wmReportingAnchor==='function')?wmReportingAnchor():null;
  return _ensurePdfLibs().then(function(){
    return document.fonts&&document.fonts.ready?document.fonts.ready:null;
  }).then(function(){
    var ms=_bpMonths();
    period=ms[0].label+' – '+ms[ms.length-1].label;
    _bpBusy(true, 'Cover page');
    return _bpRenderPage(_bpCoverHtml('Weekly Live Entertainment Meeting', _bpMeetingDateLabel(), '')).then(function(cv){ canvases.push(cv); });
  }).then(function(){
    /* Monthly recap for the closed month: break page, all-locations comparison, then each venue's detail page (the monthly recap's pages 2, 4, 6, 8). */
    var recap=typeof wmRecapMonth==='function'?wmRecapMonth():null;
    var recapPack=recap&&typeof mrPack==='function'?mrPack(recap):null;
    if(!recapPack) return;
    var recapTitle=(recap.label||'').replace(/\s+\d{4}$/,'')+' Recap';
    _bpBusy(true, recapTitle);
    return _bpRenderPage(_bpCoverHtml(recapTitle, recap.label+(recap.range?' · '+recap.range:''), '')).then(function(cv){
      canvases.push(cv);
      return _bpRenderPage(mrComparePage(recapPack));
    }).then(function(cv){
      canvases.push(cv);
      var chain=Promise.resolve();
      recapPack.venues.forEach(function(p){
        chain=chain.then(function(){
          _bpBusy(true, p.label);
          return _bpRenderPage(mrDetailPage(p, recap));
        }).then(function(cv){ canvases.push(cv); });
      });
      return chain;
    });
  }).then(function(){
    _bpBusy(true, 'Weekly recap');
    var anchor=(typeof wmReportingAnchor==='function')?wmReportingAnchor():null;
    var recapSub=anchor&&typeof MN_FULL!=='undefined'?MN_FULL[anchor.monthIndex]+' '+anchor.year:_bpMeetingDateLabel();
    return _bpRenderPage(_bpCoverHtml('Weekly Recap', recapSub, '')).then(function(cv){ canvases.push(cv); });
  }).then(function(){
    var actual=(typeof wmActualMonth==='function')?wmActualMonth():null;
    var pack=actual&&typeof mrPack==='function'?mrPack(actual):null;
    if(!pack) return;
    _bpBusy(true, 'Month to date');
    return _bpRenderPage(mrComparePage(pack, {kicker:'Weekly Live Entertainment Meeting'})).then(function(cv){
      canvases.push(cv);
      _bpBusy(true, 'Performances');
      return _bpRenderPage(wmPerformancesPage(pack));
    }).then(function(cv){ canvases.push(cv); });
  }).then(function(){
    _bpBusy(true, 'Three month plan');
    return _bpRenderPage(_bpCoverHtml('Three Month Booking Plan', period+' · Beach Club · CN Lounge · MILA', '')).then(function(cv){ canvases.push(cv); });
  }).then(function(){
    var chain=Promise.resolve();
    BP_VENUES.forEach(function(v, i){
      chain=chain.then(function(){
        _bpBusy(true, 'Location '+(i+1)+' of 3 · '+v);
        _bpVenue=v;
        var data=_bpCompute();
        return _bpRenderPage(_bpDeckSlideHtml(data, i+1, BP_VENUES.length)).then(function(cv){ canvases.push(cv); });
      });
    });
    return chain;
  }).then(function(){
    _bpVenue=saved;
    _bpAnchorOverride=null;
    return _bpPdfFit(canvases);
  }).then(function(pdf){
    _bpBusy(false);
    return pdf;
  }, function(err){
    _bpVenue=saved;
    _bpAnchorOverride=null;
    _bpBusy(false);
    throw err;
  });
}
function bpGenerateMonthlyPlan(){
  var savedPanel=_bpPanel, savedOffset=_bpOffset, savedVenue=_bpVenue;
  _bpPanel='plan'; _bpOffset=0;
  var data=_bpCombinedPlan();
  var btns=document.querySelectorAll('#rollingBookingPlan .bp-btn-dark');
  btns.forEach(function(b){ b.disabled=true; b.textContent='Preparing…'; });
  var ms=data.months;
  var pdfName=_bpPdfName().replace('.pdf','-by-location.pdf');
  _bpBuildLocationPages().then(function(pdf){
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
        c.rows.forEach(function(r){ if(_bpExceptionRow(r, c)) exceptions++; });
      });
    });
    var key=_bpNow().replace(/[:.]/g,'-');
    _bpSave('bookingPlans/'+key, {at:_bpNow(), by:_bpWho(), period:ms[0].short+' – '+ms[ms.length-1].short,
      venues:BP_VENUES.join(', '), totals:totals, byVenue:byVenue, exceptions:exceptions});
  }).catch(function(err){
    alert('Could not prepare the monthly plan. '+(err&&err.message?err.message:''));
  }).then(function(){
    _bpPanel=savedPanel; _bpOffset=savedOffset; _bpVenue=savedVenue;
    renderBookingPlan();
  });
}
function _bpMonthForDate(dateStr){
  var info=fiscalInfoForDate(dateStr);
  var y=info.year, mi=info.monthIndex;
  var range=fiscalPeriodRange(y, mi);
  return {year:y, mi:mi, mm:padMm(mi+1), key:y+'-'+padMm(mi+1), label:MN_FULL[mi]+' '+y, short:MNS[mi]+' '+y, from:range.from, to:range.to, range:fiscalPeriodShortRange(y, mi)};
}
function _bpCellForShow(show){
  return _bpVenueMonth(show.v||show.venue, _bpMonthForDate(show.d));
}
function bpCloseShowApproval(){
  var el=document.getElementById('bpApprModal');
  if(el) el.remove();
}
function bpOpenShowApproval(idx){
  var show=(typeof SCHED!=='undefined')?SCHED[idx]:null;
  if(!show||!show.d) return;
  var uid=(typeof ensureShowUid==='function')?ensureShowUid(show):(show._uid||'');
  var cell=_bpCellForShow(show);
  var row=null;
  cell.rows.forEach(function(r){ if(r.uid===uid) row=r; });
  if(!row){ alert('Add a DJ or a fee on this date before requesting approval.'); return; }
  var notes=_bpNotesFor(uid);
  bpCloseShowApproval();
  var wrap=document.createElement('div');
  wrap.id='bpApprModal';
  wrap.className='bp-appr-modal';
  wrap.innerHTML='<div class="bp-appr-card"><div class="bp-appr-hd"><div><b>Request approval</b><div style="color:#64748b;font-size:13px;margin-top:2px">'+_escHtml((row.dj||'TBD')+' · '+row.venue+' · '+_bpDay(row.d))+'</div></div>'
    +'<button type="button" class="bp-btn" id="bpApprClose">Close</button></div>'
    +'<div class="bp-appr-grid"><div><label>Rationale</label><textarea id="bpApprWhy">'+_escHtml(notes.rationale||row.note||'')+'</textarea>'
    +'<label>Expected benefits</label><textarea id="bpApprBen">'+_escHtml(notes.benefits||'')+'</textarea>'
    +'<label>Approved by</label><textarea id="bpApprBy" placeholder="Name, signature, or a note">'+_escHtml(notes.approvedBy||'')+'</textarea>'
    +'<div class="bp-appr-actions"><button type="button" class="bp-btn bp-btn-dark" id="bpApprSend">Send</button></div>'
    +'<p style="font-size:12px;color:#64748b;margin-top:8px">Send saves this request on the three-month plan and opens the email to Matthias, with Hugo and Christophe copied. The email includes this page and the PDF.</p></div>'
    +'<div class="bp-appr-preview" id="bpApprPreview"></div></div></div>';
  document.body.appendChild(wrap);
  function paint(){
    var n={rationale:document.getElementById('bpApprWhy').value, benefits:document.getElementById('bpApprBen').value, approvedBy:document.getElementById('bpApprBy').value};
    document.getElementById('bpApprPreview').innerHTML=_bpExceptionPageHtml(row, cell, n);
  }
  document.getElementById('bpApprWhy').addEventListener('input', paint);
  document.getElementById('bpApprBen').addEventListener('input', paint);
  document.getElementById('bpApprBy').addEventListener('input', paint);
  document.getElementById('bpApprClose').onclick=bpCloseShowApproval;
  document.getElementById('bpApprSend').onclick=function(){ bpSendShowApproval(row, cell); };
  paint();
}
function bpSendShowApproval(row, cell){
  var whyEl=document.getElementById('bpApprWhy');
  var benEl=document.getElementById('bpApprBen');
  var byEl=document.getElementById('bpApprBy');
  var btn=document.getElementById('bpApprSend');
  if(!whyEl||!benEl||!byEl) return;
  var notes={rationale:whyEl.value.trim(), benefits:benEl.value.trim(), approvedBy:byEl.value.trim(), d:row.d, venue:row.venue, dj:row.dj||'', at:_bpNow(), by:_bpWho()};
  if(btn){ btn.disabled=true; btn.textContent='Sending…'; }
  var rec={uid:row.uid, venue:row.venue, d:row.d, dj:row.dj, fee:row.fee, month:cell.month&&cell.month.key,
    monthBudget:cell.budget, overage:cell.budget!=null?Math.max(0, cell.planned-cell.budget):0, amount:row.fee,
    rationale:notes.rationale, benefit:notes.benefits, meetingDate:'',
    requestedBy:_bpWho(), requestedAt:_bpNow(), finance:null, exec:null, fromCalendar:true};
  _bpSave('approvalNotes/'+row.uid, notes, function(){
    _bpSave('bookingApprovals/'+row.uid, rec);
    if(!_bpData.notes) _bpData.notes={};
    _bpData.notes[row.uid]=notes;
    if(!_bpData.approvals) _bpData.approvals={};
    _bpData.approvals[row.uid]=rec;
    var html=_bpExceptionPageHtml(row, cell, notes);
    _bpBusy(true, 'Approval page');
    _ensurePdfLibs().then(function(){
      return document.fonts&&document.fonts.ready?document.fonts.ready:null;
    }).then(function(){
      return _bpRenderPage(html);
    }).then(function(cv){
      var pdf=_bpPdfFit([cv]);
      var snap=cv.toDataURL('image/jpeg', 0.86);
      var comma=snap.indexOf(',');
      var blob=pdf.output('blob');
      var ready=(blob && typeof blob.then==='function')?blob:Promise.resolve(blob);
      return ready.then(function(fileBlob){
        return _blobToBase64(fileBlob).then(function(b64){ return {b64:b64, snap:comma>=0?snap.slice(comma+1):snap}; });
      });
    }).then(function(pack){
      _bpBusy(false);
      var file='Request-Approval-'+String(row.d)+'-'+String(row.venue||'venue').replace(/\s+/g,'-')+'.pdf';
      var sentence=_bpRequestSentence(row, cell);
      var body='<div style="font-family:Arial,sans-serif;font-size:14px;color:#172033"><p>'+_escHtml(sentence)+'</p>'
        +'<p><img src="cid:performance" alt="Budget exception" style="max-width:100%;height:auto"></p></div>';
      var eml=_buildForecastFlashEml({
        to:['matthias@rivieradininggroup.com'],
        cc:['hugo@rivieradininggroup.com','christophe@rivieradininggroup.com'],
        subject:'Request approval — '+(row.dj||'TBD')+' · '+row.venue+' · '+row.d,
        htmlBody:body,
        inlines:[{cid:'performance', filename:'performance.jpg', contentType:'image/jpeg', base64:pack.snap}],
        attachments:[{filename:file, contentType:'application/pdf', base64:pack.b64}]
      });
      _openBlobInApp(eml, file.replace(/\.pdf$/,'.eml'));
      bpCloseShowApproval();
      if(typeof curView!=='undefined' && curView==='calendar' && typeof renderCal==='function') renderCal();
    }).catch(function(err){
      _bpBusy(false);
      if(btn){ btn.disabled=false; btn.textContent='Send'; }
      alert('Could not prepare the approval email. '+(err&&err.message?err.message:''));
    });
  });
}
