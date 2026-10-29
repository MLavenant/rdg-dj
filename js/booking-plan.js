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
function _bpMonths(){
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY):miamiToday();
  var info=fiscalInfoForDate(today);
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
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY):miamiToday();
  var info=fiscalInfoForDate(today);
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
  var show=(typeof _modalLySameDateShow==='function')?_modalLySameDateShow(venue, dateStr):null;
  if(!show) return null;
  var fee=show.fee!=null?show.fee:(show.cost!=null?show.cost:null);
  fee=fee!=null&&fee!==''?+fee:null;
  var bs=show.bs_a!=null?+show.bs_a:null;
  return {dj:show.dj||'', fee:fee, bs:bs, ret:(fee>0&&bs!=null)?bs/fee:null, d:show.d, status:_bpStatus(show)};
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
function _bpVenueMonth(venue, m){
  var budget=getMonthlyBudget(venue, m.year, m.mm);
  var conf=(_bpData.confirms[venue]||{})[m.year]; conf=conf?conf[m.mm]:null;
  var rows=[], confirmed=0, proposed=0, bsT=0;
  _bpBookings(venue, m).forEach(function(r){
    var fee=+(r.fee!=null?r.fee:(r.cost||0))||0;
    var status=_bpStatus(r);
    var isConf=BP_CONFIRMED.indexOf(status)>=0;
    var tgt=(typeof showTargets==='function')?showTargets(r):{bs_m:r.bs_m, roi_t:r.roi_t};
    rows.push({uid:_bpUid(r), venue:venue, d:r.d, dj:r.dj||'', fee:fee, status:status, note:r.note||'', confirmed:isConf,
      bs_m:tgt&&tgt.bs_m!=null?+tgt.bs_m:null, roi_t:tgt&&tgt.roi_t!=null?+tgt.roi_t:null});
    if(isConf) confirmed+=fee; else proposed+=fee;
    if(tgt&&tgt.bs_m) bsT+=+tgt.bs_m;
  });
  var planned=confirmed+proposed;
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
    confirmed:confirmed, proposed:proposed, planned:planned,
    remaining:budget!=null?budget-planned:null, bsT:bsT, py:_bpPriorTotals(venue, m),
    rows:rows, exc:exc};
}
function _bpVenueList(){
  return BP_VENUES.indexOf(_bpVenue)>=0 ? [_bpVenue] : [BP_VENUES[0]];
}
function _bpMonthOverBudget(c){ return !!(c && c.budget!=null && c.planned>c.budget); }
function _bpHighlightRow(r, c){ return !!r && (+r.fee||0)>20000 && _bpMonthOverBudget(c); }
function _bpExceptionRow(r, c){ return _bpHighlightRow(r, c) && !r.confirmed; }
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
/* Stable stand-in until sales and margins versus last year are calculated. The gap stays within 0–20%. */
function _bpHash(key){
  var s=2166136261, str=String(key||''), i;
  for(i=0;i<str.length;i++){
    s^=str.charCodeAt(i);
    s=Math.imul(s, 16777619);
  }
  return s>>>0;
}
function _bpPlaceholderPct(key){
  var s=_bpHash(key);
  var mag=Math.round((s%201))/10;
  return (s%3===0)?-mag:mag;
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
function _bpFinPair(key, kind){
  var pct=_bpPlaceholderPct(key+'|'+kind);
  var h=_bpHash(key+'|'+kind+'|base');
  if(kind==='sales'){
    var py=800000+(h%17)*100000;
    return {now:Math.round(py*(1+pct/100)), py:py, pct:pct, money:true};
  }
  var pyM=10+(h%15);
  return {now:Math.round(pyM*(1+pct/100)*10)/10, py:pyM, pct:pct, money:false};
}
function _bpFinFor(c){
  if(c&&c._fin) return c._fin;
  var key=(c.venue||'all')+'|'+(c.month&&(c.month.key||c.month.label)||'');
  return {sales:_bpFinPair(key,'sales'), margin:_bpFinPair(key,'margin'), live:_bpFinPair(key,'live')};
}
function _bpFinSum(list){
  var sN=0, sP=0, mN=0, mP=0, lN=0, lP=0, n=list.length||1;
  list.forEach(function(f){
    sN+=f.sales.now; sP+=f.sales.py;
    mN+=f.margin.now; mP+=f.margin.py;
    lN+=f.live.now; lP+=f.live.py;
  });
  function pack(now, py, money){
    return {now:money?now:(Math.round(now/n*10)/10), py:money?py:(Math.round(py/n*10)/10), pct:py?(now-py)/py*100:0, money:money};
  }
  return {sales:pack(sN,sP,true), margin:pack(mN,mP,false), live:pack(lN,lP,false)};
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
  return pair.money?$k(n):(Math.round(n*10)/10).toFixed(1)+'%';
}
function _bpFinMetric(pair, mode){
  var gap=mode==='pp-down'?_bpPpHtml(pair.now-pair.py, true):(mode==='pp-up'?_bpPpHtml(pair.now-pair.py, false):_bpPctHtml(pair.pct, false));
  return '<b class="bp-fin-now">'+_bpFinAmt(pair,'now')+'</b><i class="bp-fin-sep"></i><b class="bp-fin-py">'+_bpFinAmt(pair,'py')+'</b><span class="bp-finm-var">'+gap+'</span>';
}
function _bpFinCardHtml(month, fin, cast, extra){
  var parts=_bpVsParts(month)||{now:'',py:''};
  var h='<article class="bp-fincard'+(cast?' bp-cast':'')+(extra?' '+extra:'')+'">';
  h+='<div class="bp-fincard-hd"><b>'+_escHtml(month.label||'')+'</b>'+(month.range?'<span>'+_escHtml(month.range)+'</span>':'')+'</div>';
  h+='<b class="bp-yr">'+parts.now+'</b><i class="bp-fin-sep bp-yr"></i><b class="bp-yr">'+parts.py+'</b><span class="bp-yr"></span>';
  h+=_bpFinMetric(fin.sales);
  h+=_bpFinMetric(fin.live, 'pp-down');
  h+=_bpFinMetric(fin.margin, 'pp-up');
  h+='</article>';
  return h;
}
function _bpFinLabelsHtml(){
  return '<article class="bp-fincard bp-lbl-card"><div class="bp-fincard-hd"><b>&nbsp;</b><span>&nbsp;</span></div>'
    +'<span class="bp-yr"></span><span class="bp-lbl">Sales</span><span class="bp-lbl">Live entertainment margins</span><span class="bp-lbl">Margins</span></article>';
}
function _bpPlanBoxHtml(c, actual){
  var over=c.remaining!=null && c.remaining<0;
  var under=c.remaining!=null && c.remaining>=0;
  return '<div class="bp-planned-box'+(over?' bp-planned-over':(under?' bp-planned-under':''))+'">'
    +'<div class="bp-fc-row"><b>'+$k(c.planned)+'</b></div>'
    +'<div class="bp-fc-row">'+_bpMoneyVar(c.remaining)+'</div>'
    +'<div class="bp-split"><div class="bp-split-line"><b>'+(actual?'&nbsp;':$k(c.confirmed))+'</b></div><div class="bp-split-line"><b>'+(actual?'&nbsp;':$k(c.proposed))+'</b></div></div></div>';
}
function _bpBudgetLabelsHtml(){
  return '<article class="bp-card bp-lbl-card"><div class="bp-card-hd"><b>&nbsp;</b><span>&nbsp;</span></div>'
    +'<div class="bp-budget-box"><span>Budget</span></div>'
    +'<div class="bp-planned-box"><div class="bp-fc-row"><span>Forecast</span></div><div class="bp-fc-row"><span>Variance</span></div>'
    +'<div class="bp-split"><div class="bp-split-line"><i class="bp-arr"></i><span>Confirmed</span></div><div class="bp-split-line"><i class="bp-arr"></i><span>Proposed</span></div></div></div>'
    +'<div class="bp-card-foot"></div></article>';
}
function _bpActualBudgetHtml(c){
  var m=c.month||{};
  var h='<article class="bp-card bp-card-actual">';
  h+='<div class="bp-card-hd"><b>'+_escHtml(m.label||'Prior month')+'</b><span>'+(m.range?_escHtml(m.range):'&nbsp;')+'</span></div>';
  h+='<div class="bp-budget-box"><b>'+(c.budget!=null?$k(c.budget):'Not set')+'</b></div>';
  h+=_bpPlanBoxHtml(c, true);
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

  var h='<div class="bp-toolbar">';
  h+='<div class="bp-seg">'
    +'<button type="button" class="'+(_bpPanel==='plan'?'on':'')+'" onclick="bpSetPanel(\'plan\')">Plan</button>'
    +'<button type="button" class="'+(_bpPanel==='meeting'?'on':'')+'" onclick="bpSetPanel(\'meeting\')">Meeting</button>'
    +'<button type="button" class="'+(_bpPanel==='history'?'on':'')+'" onclick="bpSetPanel(\'history\')">Plan history</button>'
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
  var cards='', finHtml='', tot=_bpBlankTot(), fins=[];
  cells.forEach(function(c){
    cards+=_bpCardHtml(c);
    _bpAddTotals(tot, c);
    fins.push(_bpFinFor(c));
  });
  if(months.length>1) cards+=_bpCardHtml(_bpTotCard(tot, months.length+'-month total', _bpSpanRange(months)));
  cells.forEach(function(c, i){ finHtml+=_bpFinCardHtml(c.month, fins[i], true); });
  if(months.length>1) finHtml+=_bpFinCardHtml({label:months.length+'-month total', range:_bpSpanRange(months), yearFrom:months[0].year, yearTo:months[months.length-1].year}, _bpFinSum(fins), false);
  var n=cells.length+(months.length>1?1:0);
  var cols=n+1;
  var h='<div class="bp-eq" style="--bp-cols:'+cols+';--bp-n:'+n+'">';
  h+='<div class="bp-eq-frame"></div>';
  h+='<div class="bp-eq-actual-hd">Actual</div>';
  h+='<div class="bp-eq-forecast-hd">Forecast</div>';
  h+='<div class="bp-subhd bp-eq-subhd">Budget vs pipeline</div>';
  h+='<div class="bp-eq-cards">'+_bpBudgetLabelsHtml()+_bpActualBudgetHtml(actualCell)+cards+'</div>';
  h+='<div class="bp-eq-finhd">Financial</div>';
  h+='<div class="bp-eq-allfins">'+_bpFinLabelsHtml()+_bpFinCardHtml(actualCell.month||{}, _bpFinFor(actualCell), false, 'bp-fincard-actual')+finHtml+'</div>';
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
  return {venue:'', month:{label:label, range:range||'', year:0, mm:''}, budget:t.hasB?t.budget:null,
    confirmed:t.confirmed, proposed:t.proposed, planned:planned,
    remaining:t.hasB?t.budget-planned:null, bsT:t.bsT,
    py:{fee:t.hasPyFee?t.pyFee:null, bs:t.hasPyBs?t.pyBs:null, label:'prior year'},
    exc:null, confirm:null, isTotal:true};
}
function _bpCardHtml(c){
  var m=c.month;
  var h='<article class="bp-card'+(c.isTotal?' bp-card-total':' bp-cast')+'">';
  h+='<div class="bp-card-hd"><b>'+_escHtml(m.label)+'</b><span>'+(m.range?_escHtml(m.range):'&nbsp;')+'</span></div>';
  var over=c.remaining!=null && c.remaining<0;
  var under=c.remaining!=null && c.remaining>=0;
  h+='<div class="bp-budget-box"><b>'+(c.budget!=null?$k(c.budget):'Not set')+'</b></div>';
  h+=_bpPlanBoxHtml(c, false);
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
function _bpPy(text){
  return '<em><span class="bp-py">PY</span>'+text+'</em>';
}
function _bpStack(main, sub){
  return '<span class="bp-stack"><b>'+main+'</b>'+(sub?_bpPy(sub):'')+'</span>';
}
function _bpExpectCell(pair, mode){
  var nums=pair.money
    ? '<b>'+$k(pair.now)+'</b>'+_bpPy($k(pair.py))
    : '<b>'+(Math.round(pair.now*10)/10).toFixed(1)+'%</b>'+_bpPy((Math.round(pair.py*10)/10).toFixed(1)+'%');
  var gap=mode==='pp-up'?_bpPpHtml(pair.now-pair.py, false):_bpPctHtml(pair.pct, false);
  return '<span class="bp-expect"><span class="bp-expect-nums">'+nums+'</span>'+gap+'</span>';
}
function _bpRowsHtml(data, opts){
  opts=opts||{};
  var simple=!!opts.noActions;
  var h='<div class="bp-bk'+(simple?' bp-bk-simple':'')+'">';
  h+='<div class="bp-bk-hd"><span>Date</span><div class="bp-bk-cols"><span>Artist</span><span>Fee</span><span>Status</span><span class="r">Expected margins vs PY</span><span class="r">Expected total sales vs PY</span></div>'+(simple?'':'<span>Approval</span>')+'</div>';
  var any=false;
  var now={n:0, fee:0};
  var pyFee=0, pyN=0;
  data.months.forEach(function(m, mi){
    var monthRows=[];
    Object.keys(data.grid).forEach(function(v){
      var c=data.grid[v][mi];
      c.rows.forEach(function(r){ monthRows.push({r:r, budget:c.budget, planned:c.planned}); });
    });
    monthRows=monthRows.filter(function(x){ return _bpHighlightRow(x.r, x); });
    if(!monthRows.length) return;
    any=true;
    monthRows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
    h+='<div class="bp-bk-month">'+_escHtml(m.label)+' <span>'+_escHtml(m.range)+'</span></div>';
    monthRows.forEach(function(x){
      var r=x.r;
      var ly=_bpLyShow(r.venue, r.d);
      var exp=_bpFinFor({venue:r.venue, month:{key:r.d}});
      now.n++; now.fee+=r.fee||0;
      if(ly&&ly.fee!=null){ pyFee+=ly.fee; pyN++; }
      var cls=r.violation?' bp-bk-viol':(r.needs?' bp-bk-over':'');
      h+='<div class="bp-bk-box'+cls+'">';
      h+='<div class="bp-bk-date"><b>'+_bpDay(r.d)+'</b><span>'+_escHtml(BP_VENUE_SHORT[r.venue]||r.venue)+'</span></div>';
      h+='<div class="bp-bk-lines"><div class="bp-bk-cols bp-bk-line bp-bk-now">';
      h+=_bpStack(_escHtml(r.dj||'TBD'), ly&&ly.dj?_escHtml(ly.dj):(ly?'TBD':'No show'));
      h+=_bpStack($k(r.fee), ly&&ly.fee!=null?$k(ly.fee):'—');
      h+='<span><span class="bp-status '+(r.confirmed?'bp-status-conf':'bp-status-prop')+'">'+_escHtml(r.status||'No status')+'</span></span>';
      h+=_bpExpectCell(exp.margin, 'pp-up');
      h+=_bpExpectCell(exp.sales);
      h+='</div></div>';
      if(!simple){
        h+='<div class="bp-bk-appr">'+_bpBadge(r.approval);
        if(r.approval==='needed'||r.approval==='reapproval') h+='<button type="button" class="bp-act bp-act-main" onclick="bpOpenRequest(\''+r.uid+'\')">Request approval</button>';
        else if(r.approval!=='none' && r.approval!=='past' && r.approval!=='confirmed') h+='<button type="button" class="bp-act" onclick="bpOpenRequest(\''+r.uid+'\')">Open</button>';
        h+='</div>';
      }
      h+='</div>';
    });
  });
  if(!any){
    h+='<div class="bp-empty">No bookings over $20K in a month that exceeds its budget.</div>';
  } else {
    h+='<div class="bp-bk-box bp-bk-total"><div class="bp-bk-date"><b>Total</b><span>Over $20K</span></div><div class="bp-bk-lines"><div class="bp-bk-cols bp-bk-line bp-bk-now">';
    h+=_bpStack(now.n+' bookings', '');
    h+=_bpStack($k(now.fee), pyN?$k(pyFee):'');
    h+='<span></span><span></span><span></span>';
    h+='</div></div>'+(simple?'':'<div class="bp-bk-appr"></div>')+'</div>';
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
  h+='<div class="bp-deck-sec bp-sec-2"><span>02</span>Bookings over $20K<em>Artist and prior year, fee and prior year, status, expected margin and sales versus LY</em></div>';
  h+=_bpRowsHtml(data, {noActions:true});
  h+='</div>';
  h+='<div class="bp-deck-ft"><span>Prepared '+_escHtml(_bpFmtDate(_bpNow()))+'</span><span>Riviera Dining Group · Entertainment</span></div>';
  h+='</div>';
  return h;
}
function _bpPlanHtml(data){
  var h='<div id="bpSheet" class="bp-sheet">';
  h+=_bpSheetHead(data, data.months.length>1?'Three Month Booking Plan':'Entertainment Booking Plan vs Budget');
  h+='<div class="bp-deck-sec bp-sec-1"><span>01</span>Budget vs pipeline<em>Budget and planned spend, then sales and margins versus LY</em></div>';
  h+=_bpSummaryHtml(data);
  h+='<div class="bp-deck-sec bp-sec-2"><span>02</span>Bookings over $20K<em>Artist and prior year, fee and prior year, status, expected margin and sales versus LY. Only months that exceed budget.</em></div>';
  h+=_bpRowsHtml(data);
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

  h+='<div class="bp-x-sec bp-x-band"><span>04</span><b>Sales performance</b><em>Projected this year compared with last year</em></div><div class="bp-x-pair">';
  h+='<div class="bp-x-col"><div class="bp-x-col-hd">This year · projected</div><div class="bp-x-fields bp-x-fields-2">'
    +_bpField('BS Target', $k(r.bs_m))
    +_bpField('ROI', _bpRoiHtml(_bpThisReturn(r)))
    +'</div></div>';
  h+='<div class="bp-x-col bp-x-ly"><div class="bp-x-col-hd">Last year · same weekday</div><div class="bp-x-fields bp-x-fields-2">'
    +(ly?_bpField('BS Actual', $k(ly.bs))+_bpField('ROI', _bpRoiHtml(ly.ret)):_bpField('BS Actual', 'No show')+_bpField('ROI', '—'))
    +'</div></div></div>';

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
    venues.forEach(function(v){ var c=data.grid[v][mi]; c.rows.forEach(function(r){ if(_bpHighlightRow(r, c)) rows.push({r:r, budget:c.budget}); }); });
  });
  rows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:(a.r.venue<b.r.venue?-1:1)); });
  h+='<div class="bp-p-sec">Bookings over $20K in months over budget'+(onlyMonth!=null?' · '+_escHtml(ms[onlyMonth].label):'')+' · this year vs same weekday last year</div>';
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
  if(!rows.length) h+='<tr><td colspan="14" class="bp-muted">No bookings over $20K in a month that exceeds its budget.</td></tr>';
  else h+='<tr class="bp-p-all"><td class="l" colspan="2"><b>Total</b></td><td class="l"><b>'+t.n+' bookings</b></td><td><b>'+$k(t.fee)+'</b></td><td></td><td><b>'+$k(t.hb?t.bs:null)+'</b></td><td class="bp-p-end"><b>'+_bpRoiHtml(t.fee>0&&t.hb?t.bs/t.fee:null)+'</b></td>'
    +'<td class="l bp-p-lyc" colspan="2">'+lt.n+' same weekdays</td><td class="bp-p-lyc">'+$k(lt.n?lt.fee:null)+'</td><td class="bp-p-lyc">'+$k(lt.hb?lt.bs:null)+'</td><td class="bp-p-lyc bp-p-end">'+_bpRoiHtml(lt.fee>0&&lt.hb?lt.bs/lt.fee:null)+'</td><td colspan="2"></td></tr>';
  h+='</tbody></table></div>';
  return h;
}
function _bpPdfCanvas(el){
  var big=el.classList&&(el.classList.contains('bp-print')||el.classList.contains('bp-deck'));
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
  var out=[];
  Object.keys(data.grid).forEach(function(v){
    data.grid[v].forEach(function(c){
      c.rows.forEach(function(r){ if(_bpExceptionRow(r, c)) out.push({r:r, c:c}); });
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
  var exc=_bpExceptionRows(data);
  _bpBusy(true, 'Cover page');
  return _ensurePdfLibs().then(function(){
    return document.fonts&&document.fonts.ready?document.fonts.ready:null;
  }).then(function(){
    return _bpRenderPage(_bpCoverHtml('Entertainment Approval', sub, loc));
  }).then(function(cv){
    canvases.push(cv);
    _bpBusy(true, 'Booking plan');
    if(_bpPanel==='meeting') return _bpCaptureSheet().then(function(cv){ canvases.push(cv); });
    return _bpRenderPage(_bpPrintSheetHtml(data, null)).then(function(cv){ canvases.push(cv); });
  }).then(function(){
    if(!exc.length) return null;
    var chain=_bpRenderPage(_bpCoverHtml('Booking details', exc.length+' booking'+(exc.length===1?'':'s')+' over $20K in a month over budget · '+period, loc)).then(function(cv){ canvases.push(cv); });
    exc.forEach(function(x, i){
      chain=chain.then(function(){
        _bpBusy(true, 'Booking '+(i+1)+' of '+exc.length);
        return _bpRenderPage(_bpExceptionPageHtml(x.r, x.c, _bpNotesFor(x.r.uid)));
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
  var packets=[];
  var period='';
  return _ensurePdfLibs().then(function(){
    return document.fonts&&document.fonts.ready?document.fonts.ready:null;
  }).then(function(){
    var ms=_bpMonths();
    period=ms[0].label+' – '+ms[ms.length-1].label;
    _bpBusy(true, 'Cover page');
    return _bpRenderPage(_bpCoverHtml('Three Month Booking Plan', period+' · Beach Club · CN Lounge · MILA', '')).then(function(cv){ canvases.push(cv); });
  }).then(function(){
    var chain=Promise.resolve();
    BP_VENUES.forEach(function(v, i){
      chain=chain.then(function(){
        _bpBusy(true, 'Location '+(i+1)+' of 3 · '+v);
        _bpVenue=v;
        var data=_bpCompute();
        packets.push({venue:v, exc:_bpExceptionRows(data)});
        return _bpRenderPage(_bpDeckSlideHtml(data, i+1, BP_VENUES.length)).then(function(cv){ canvases.push(cv); });
      });
    });
    return chain;
  }).then(function(){
    var chain=Promise.resolve();
    packets.forEach(function(pack){
      if(!pack.exc.length) return;
      chain=chain.then(function(){
        return _bpRenderPage(_bpCoverHtml('Details', pack.exc.length+' booking'+(pack.exc.length===1?'':'s')+' over $20K · '+period, pack.venue)).then(function(cv){ canvases.push(cv); });
      });
      pack.exc.forEach(function(x, i){
        chain=chain.then(function(){
          _bpBusy(true, pack.venue+' · booking '+(i+1)+' of '+pack.exc.length);
          return _bpRenderPage(_bpExceptionPageHtml(x.r, x.c, _bpNotesFor(x.r.uid))).then(function(cv){ canvases.push(cv); });
        });
      });
    });
    return chain;
  }).then(function(){
    _bpVenue=saved;
    return _bpPdfFit(canvases);
  }).then(function(pdf){
    _bpBusy(false);
    return pdf;
  }, function(err){
    _bpVenue=saved;
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
    +'<p style="font-size:12px;color:#64748b;margin-top:8px">Send opens an email to matthias@rivieradininggroup.com with this page as a snapshot and a PDF.</p></div>'
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
  _bpSave('approvalNotes/'+row.uid, notes, function(){
    if(!_bpData.notes) _bpData.notes={};
    _bpData.notes[row.uid]=notes;
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
      return pdf.output('blob').then(function(blob){
        return _blobToBase64(blob).then(function(b64){ return {b64:b64, snap:comma>=0?snap.slice(comma+1):snap}; });
      });
    }).then(function(pack){
      _bpBusy(false);
      var file='Request-Approval-'+String(row.d)+'-'+String(row.venue||'venue').replace(/\s+/g,'-')+'.pdf';
      var body='<div style="font-family:Arial,sans-serif;font-size:14px;color:#172033"><p>Request approval for <b>'+_escHtml(row.dj||'TBD')+'</b> · '+_escHtml(row.venue)+' · '+_escHtml(_bpDay(row.d))+' · fee '+$k(row.fee)+'.</p>'
        +'<p><b>Rationale</b><br>'+_escHtml(notes.rationale||'—')+'</p><p><b>Expected benefits</b><br>'+_escHtml(notes.benefits||'—')+'</p><p><b>Approved by</b><br>'+_escHtml(notes.approvedBy||'—')+'</p>'
        +'<p><img src="cid:performance" alt="Performance" style="max-width:100%;height:auto"></p></div>';
      var eml=_buildForecastFlashEml({
        to:['matthias@rivieradininggroup.com'],
        cc:[],
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
