/* Finance Approval and the 2027 Finance Status rule.
   Finance Status lives on its own path (rdg/financeStatus/{uid}). DJ name, fee, and DJ status keep their
   existing schedule sync. Only fiscal 2027 at the three locations below follows the finance rule. */
var FINANCE_APPROVERS={
  'matthias@rivieradininggroup.com':1,
  'greg@rivieradininggroup.com':1,
  'takuma@rivieradininggroup.com':1,
  'michael@rivieradininggroup.com':1,
  'fabien@rivieradininggroup.com':1
};
var FA_VENUES=['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'];
var FA_FIN=['Finance to Approve','Finance Approved','Finance declined'];
var FA_LIVE=['Offer sent','Hold 1','Confirmed'];
var FA_YEAR=2027;
var FINANCE_STATUS={};
function financeSignedInEmail(){
  var email='';
  if(typeof signInCurrentEmail==='function') email=signInCurrentEmail();
  if(!email && typeof signInSavedEmail==='function' && typeof signInNormalizeEmail==='function') email=signInNormalizeEmail(signInSavedEmail());
  return email;
}
function financeCanApprove(){
  if(typeof signInIsOwner==='function' && signInIsOwner()) return true;
  return !!FINANCE_APPROVERS[financeSignedInEmail()];
}
function unlockFinance(){
  return financeCanApprove();
}
function faFiscalYear(ds){
  if(typeof fiscalYearForDate==='function') return fiscalYearForDate(ds);
  return parseInt(String(ds||'').slice(0,4),10);
}
function faInScope(show){
  if(!show||!show.d) return false;
  if(FA_VENUES.indexOf(show.v||show.venue)<0) return false;
  return faFiscalYear(show.d)===FA_YEAR;
}
function faYearOn(venue, year){
  return FA_VENUES.indexOf(venue)>=0 && +year===FA_YEAR;
}
function faFee(show){
  var raw=show&&show.fee!=null&&show.fee!==''?show.fee:(show&&show.cost!=null?show.cost:null);
  var n=raw!=null&&raw!==''?+raw:null;
  return n!=null&&isFinite(n)?n:0;
}
function faKey(show){
  var uid=(typeof ensureShowUid==='function')?ensureShowUid(show):(show&&show._uid)||'';
  return String(uid||'').replace(/[.#$\[\]\/]/g,'_');
}
function faRawDjStatus(show){
  var st=(typeof getShowDjStatus==='function')?getShowDjStatus(show, show&&show.d):(show&&show.djStatus)||null;
  return st?String(st):'';
}
/* The April 2027 test wrote finance values into DJ status. Those read as Not set for DJ status. */
function faDjStatus(show){
  var raw=faRawDjStatus(show);
  return FA_FIN.indexOf(raw)>=0?'':raw;
}
function faFinanceStatus(show){
  if(!faInScope(show)) return '';
  var rec=FINANCE_STATUS[faKey(show)];
  if(rec&&typeof rec==='object'&&rec.s!=null) return FA_FIN.indexOf(rec.s)>=0?rec.s:'';
  var raw=faRawDjStatus(show);
  if(FA_FIN.indexOf(raw)>=0) return raw;
  /* A DJ status set before the finance process counts as approved. */
  if(FA_LIVE.indexOf(raw)>=0) return 'Finance Approved';
  return '';
}
function faFinanceTone(st){
  if(st==='Finance to Approve') return 'fa-fs-wait';
  if(st==='Finance Approved') return 'fa-fs-ok';
  if(st==='Finance declined') return 'fa-fs-no';
  return 'fa-fs-none';
}
function faDjLocked(show){
  if(!faInScope(show)) return false;
  if(financeCanApprove()) return false;
  return faFinanceStatus(show)!=='Finance Approved';
}
function faStatusOptions(show, current){
  return (typeof ACCT_DJ_STATUS!=='undefined')?ACCT_DJ_STATUS.slice():FA_LIVE.slice();
}
/* Offer sent, Hold 1, and Confirmed wait for Finance Approved, except for the approvers. */
function faBlockLiveStatus(show, next, prev){
  if(!faInScope(show)) return false;
  if(FA_LIVE.indexOf(next)<0) return false;
  if(!faDjLocked(show)) return false;
  try{ alert('DJ status unlocks once Finance Approval marks this night Finance Approved.'); }catch(e){}
  return true;
}
function faStatusSelectOptionsHtml(show, djSt){
  var cur=FA_FIN.indexOf(djSt)>=0?'':String(djSt||'');
  var locked=faDjLocked(show);
  var h='<option value=""'+(!cur?' selected':'')+'>Not set</option>';
  FA_LIVE.forEach(function(opt){
    var on=cur===opt;
    h+='<option value="'+opt+'"'+(on?' selected':'')+(locked&&!on?' disabled':'')+'>'+opt+'</option>';
  });
  return h;
}
function faFinanceSelectHtml(show, ds, idx){
  var st=faFinanceStatus(show);
  var can=financeCanApprove();
  var uid=String((typeof ensureShowUid==='function')?ensureShowUid(show):'').replace(/"/g,'&quot;');
  function opt(value, label, gated){
    var on=st===value;
    return '<option value="'+value+'"'+(on?' selected':'')+(gated&&!can&&!on?' disabled':'')+'>'+label+'</option>';
  }
  return '<select class="fa-fs-sel '+faFinanceTone(st)+'" data-action="finStatus" data-ds="'+ds+'" data-idx="'+idx+'" data-uid="'+uid+'"'
    +' onclick="event.stopPropagation()" title="Finance Status. Approved and declined are set from Finance Approval.">'
    +opt('', 'Not set', false)
    +opt('Finance to Approve', 'Finance to Approve', false)
    +opt('Finance Approved', 'Finance Approved', true)
    +opt('Finance declined', 'Finance declined', true)
    +'</select>';
}
function faFindShow(uid){
  var found=null;
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(found||!r) return;
    var id=(typeof ensureShowUid==='function')?ensureShowUid(r):'';
    if(String(id)===String(uid)) found=r;
  });
  return found;
}
function faRefreshViews(){
  if(typeof curView==='undefined') return;
  if(curView==='finance') renderFinanceApproval();
  else if((curView==='calendar'||curView==='accounting') && typeof _calRequestRefresh==='function') _calRequestRefresh(false);
}
function faSetFinance(show, status, why){
  if(!faInScope(show)) return false;
  var key=faKey(show);
  if(!key) return false;
  var rec={
    s:status||'',
    fee:status==='Finance Approved'?faFee(show):null,
    by:financeSignedInEmail()||'unknown',
    at:new Date().toISOString(),
    why:why||'manual'
  };
  FINANCE_STATUS[key]=rec;
  if(window._fbDb){
    try{ window._fbDb.ref('rdg/financeStatus/'+key).set(rec); }catch(e){}
  }
  return true;
}
function faSetFinanceFromSelect(sel){
  if(!sel) return;
  var r=faFindShow(sel.getAttribute('data-uid'));
  var next=sel.value||'';
  if(!r||!faInScope(r)){ faRefreshViews(); return; }
  var prev=faFinanceStatus(r);
  if(prev===next) return;
  var terminal=next==='Finance Approved'||next==='Finance declined'||prev==='Finance Approved'||prev==='Finance declined';
  if(terminal && !faCanDecide(r)){
    try{ alert(faForGreg(r)?'Greg or Matthias approve this night.':'Takuma approves this night.'); }catch(e){}
    sel.value=prev;
    return;
  }
  faSetFinance(r, next, 'calendar');
  sel.className='fa-fs-sel '+faFinanceTone(next);
  window._calStatusMenuOpen=false;
  faRefreshViews();
}
/* Called from Edit Show before the save. A fee above the approved fee sends the night back to Finance to Approve
   and clears its DJ status. Returns true when the DJ status needs clearing. */
function faOnFeeChange(before, rec){
  if(!before||!rec||!faInScope(rec)) return false;
  var oldFee=faFee(before), newFee=faFee(rec);
  if(newFee===oldFee) return false;
  var st=faFinanceStatus(before);
  if(st==='Finance Approved'){
    var stored=FINANCE_STATUS[faKey(before)];
    var approved=stored&&stored.fee!=null&&isFinite(+stored.fee)?+stored.fee:oldFee;
    if(newFee>approved){
      faSetFinance(rec, 'Finance to Approve', 'fee raised from '+approved+' to '+newFee);
      return !!faDjStatus(before);
    }
    return false;
  }
  if(st==='Finance declined'){
    faSetFinance(rec, 'Finance to Approve', 'fee changed after decline');
  }
  return false;
}
function faDecide(uid, status){
  if(!uid) return;
  var r=faFindShow(uid);
  if(!r||!faInScope(r)) return;
  if(!faCanDecide(r)){
    try{ alert(faForGreg(r)?'Greg or Matthias approve this night.':'Takuma approves this night.'); }catch(e){}
    return;
  }
  faSetFinance(r, status, 'finance approval');
  renderFinanceApproval();
}
/* Super owner (Greg) and Matthias see the quarter view and approve the larger nights.
   Takuma, Michael, and Fabien keep the month cards and approve every other night. */
function faViewer(){
  var email=String(financeSignedInEmail()||'').toLowerCase();
  if(email==='greg@rivieradininggroup.com'||email==='matthias@rivieradininggroup.com') return 'greg';
  if(!email && typeof signInIsOwner==='function' && signInIsOwner()) return 'greg';
  return 'desk';
}
function faGregView(){ return faViewer()==='greg'; }
function faMonthBudget(show){
  if(!show||!show.d||typeof fiscalInfoForDate!=='function'||typeof calGuestDjBudget!=='function') return null;
  var info=fiscalInfoForDate(show.d);
  var g=calGuestDjBudget(show.v||show.venue, info.year, info.mm);
  var n=g&&g.amount!=null?+g.amount:null;
  return n!=null&&isFinite(n)?n:null;
}
/* Over $30K always. Over 5% of that month's Guest DJ budget when the fee is at least $5K.
   Under $5K stays with Takuma even when it is over the budget. */
function faForGreg(show){
  var fee=faFee(show);
  if(!(fee>=5000)) return false;
  if(fee>30000) return true;
  var budget=faMonthBudget(show);
  if(!(budget>0)) return false;
  return fee>budget*0.05;
}
function faCanDecide(show){
  if(!financeCanApprove()||!show||!faInScope(show)) return false;
  return faGregView()?faForGreg(show):!faForGreg(show);
}
function faWhyGreg(show){
  if(!faForGreg(show)) return '';
  if(faFee(show)>30000) return 'Over $30K';
  return 'Over 5% of the month budget';
}

var faVenue=null, faYear=null, faMonth=null, faPendingOn=false, faPendingScope=null;
function faVenues(){ return FA_VENUES.slice(); }
function faHere(){
  if(!faVenue||FA_VENUES.indexOf(faVenue)<0){
    faVenue=(typeof curV!=='undefined'&&FA_VENUES.indexOf(curV)>=0)?curV:FA_VENUES[0];
  }
  return faVenue;
}
function faSetVenue(v){
  /* Own filter. Never curV, curM, or curYr. */
  if(FA_VENUES.indexOf(v)<0) return;
  faVenue=v;
  faPendingOn=false;
  renderFinanceApproval();
}
function faWhen(){
  if(faYear!==2026&&faYear!==2027) faYear=FA_YEAR;
  /* null >= 0 is true in JavaScript, so a missing month must be checked by type. */
  var total=!(typeof faMonth==='number'&&faMonth>=0&&faMonth<=11);
  if(total) return {year:faYear, total:true, month:null, mm:null};
  return {year:faYear, total:false, month:faMonth, mm:(typeof fiscalMm==='function')?fiscalMm(faMonth):((faMonth<9?'0':'')+(faMonth+1))};
}
function faSetYear(v){ faYear=+v; faPendingOn=false; renderFinanceApproval(); }
function faSetMonth(v){
  faMonth=(v==null||v==='total'||v==='-1')?null:+v;
  faPendingOn=false;
  renderFinanceApproval();
}
function faHorizon(year, names){
  var today=(typeof miamiToday==='function')?miamiToday():(typeof TODAY!=='undefined'?TODAY:'');
  var info=(today&&typeof fiscalInfoForDate==='function')?fiscalInfoForDate(today):null;
  if(info&&+info.year===+year) return {through:info.monthIndex, label:'Budget YTD · through '+names[info.monthIndex]};
  return {through:11, label:'Budget · full year'};
}
function faBooking(r){
  if(!r||r._s==='empty'||!r.d) return false;
  if(faInScope(r)) return true;
  return !!String(r.dj||'').trim()||faFee(r)>0;
}
function faNeedsApproval(r){
  if(!faInScope(r)||!faBooking(r)) return false;
  var st=faFinanceStatus(r);
  return !st||st==='Finance to Approve';
}
function faInMonth(r, year, mm){
  return typeof inFiscalMonthFilter==='function' && inFiscalMonthFilter(r, year, mm);
}
function faRoster(venue, year, mm){
  var rows=[];
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!faBooking(r)||(r.v||r.venue)!==venue) return;
    if(mm){ if(!faInMonth(r, year, mm)) return; }
    else if(typeof dateInFiscalYear==='function'){ if(!dateInFiscalYear(r.d, year)) return; }
    else if(String(r.d).slice(0,4)!==String(year)) return;
    var uid=(typeof ensureShowUid==='function')?ensureShowUid(r):((r.v||r.venue||'')+'|'+r.d+'|'+r.dj);
    rows.push({r:r, fee:faFee(r), uid:String(uid), status:faFinanceStatus(r)});
  });
  rows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:0); });
  return rows;
}
function faCounts(rows){
  var c={approved:0, pending:0, declined:0, total:rows.length};
  rows.forEach(function(item){
    if(item.status==='Finance Approved') c.approved++;
    else if(item.status==='Finance declined') c.declined++;
    else if(faNeedsApproval(item.r)) c.pending++;
  });
  return c;
}
function faGuestPosition(venue, year, mm){
  var spend=0;
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!faBooking(r)||(r.v||r.venue)!==venue||!faInMonth(r, year, mm)) return;
    spend+=faFee(r);
  });
  var g=(typeof calGuestDjBudget==='function')?calGuestDjBudget(venue, year, mm):null;
  var budget=g&&g.amount!=null&&isFinite(+g.amount)?Math.round(+g.amount):null;
  return {spend:Math.round(spend), budget:budget};
}
function faPrior(venue, r){
  var py=(typeof resolvePyFields==='function')?resolvePyFields(venue, r.d):null;
  var fee=py&&py.py_fee!=null&&isFinite(+py.py_fee)?+py.py_fee:null;
  var sales=null;
  if(r&&r.bs_a!=null&&r.bs_a!==''&&isFinite(+r.bs_a)) sales=+r.bs_a;
  else if(py&&py.py_bs_a!=null&&isFinite(+py.py_bs_a)) sales=+py.py_bs_a;
  return {dj:py&&py.py_dj?py.py_dj:'', fee:fee, sales:sales};
}
function faBottlePosition(venue, year, mm){
  var sales=0, target=0, prior=0, hasS=false, hasT=false, hasP=false;
  faRoster(venue, year, mm).forEach(function(item){
    var r=item.r;
    var tgt=(typeof showTargets==='function')?showTargets(r):null;
    if(tgt&&tgt.bs_m!=null&&isFinite(+tgt.bs_m)){ target+=+tgt.bs_m; hasT=true; }
    if(r.bs_a!=null&&r.bs_a!==''&&isFinite(+r.bs_a)){ sales+=+r.bs_a; hasS=true; }
    var py=(typeof resolvePyFields==='function')?resolvePyFields(venue, r.d):null;
    if(py&&py.py_bs_a!=null&&isFinite(+py.py_bs_a)){ prior+=+py.py_bs_a; hasP=true; }
  });
  return {sales:hasS?Math.round(sales):null, target:hasT?Math.round(target):null, prior:hasP?Math.round(prior):null};
}
function faPriorGuest(venue, year, mm){
  if(!(+year>2000)) return null;
  return faGuestPosition(venue, +year-1, mm).spend;
}
function faMoney(n){ return (n==null||!isFinite(+n))?'—':$k(n); }
function faCall(actual, target, goodWhen){
  if(actual==null||target==null||!isFinite(+actual)||!isFinite(+target)) return {word:'—', text:'—', tone:''};
  var gap=Math.round(+actual-+target);
  if(!gap) return {word:'Even', text:$k(0), tone:''};
  var good=goodWhen==='over'?gap>0:gap<0;
  return {word:gap>0?'Over':'Under', text:(gap>0?'+':'−')+$k(Math.abs(gap)), tone:good?' fa-good':' fa-bad'};
}
function faMm(mi){
  return (typeof fiscalMm==='function')?fiscalMm(mi):((mi<9?'0':'')+(mi+1));
}
function faDelta(base, other){
  if(base==null||other==null||!isFinite(+base)||!isFinite(+other)) return null;
  return Math.round(+base-+other);
}
function faSigned(n){
  if(n==null||!isFinite(+n)) return '—';
  if(!n) return $k(0);
  return (n>0?'+':'−')+$k(Math.abs(n));
}
function faRange(venue, year, from, to){
  var spend=0, budget=0, hasB=false, sales=0, bsT=0, hasS=false, hasT=false;
  var priorG=0, priorB=0, hasPG=false, hasPB=false;
  for(var mi=from; mi<=to; mi++){
    var mm=faMm(mi);
    var g=faGuestPosition(venue, year, mm);
    var bottle=faBottlePosition(venue, year, mm);
    var pg=faPriorGuest(venue, year, mm);
    spend+=g.spend;
    if(g.budget!=null){ budget+=g.budget; hasB=true; }
    if(bottle.sales!=null){ sales+=bottle.sales; hasS=true; }
    if(bottle.target!=null){ bsT+=bottle.target; hasT=true; }
    if(bottle.prior!=null){ priorB+=bottle.prior; hasPB=true; }
    if(pg!=null){ priorG+=pg; hasPG=true; }
  }
  return {
    spend:Math.round(spend), budget:hasB?Math.round(budget):null,
    sales:hasS?Math.round(sales):null, target:hasT?Math.round(bsT):null,
    priorGuest:hasPG?Math.round(priorG):null, priorBottle:hasPB?Math.round(priorB):null
  };
}
function faScopeRows(venue, year, scope){
  var rows=[];
  if(scope==null||scope==='year'||scope==='total') return faRoster(venue, year, null);
  if(/^q[1-4]$/.test(String(scope))){
    var q=+String(scope).slice(1)-1;
    for(var mi=q*3; mi<q*3+3; mi++) rows=rows.concat(faRoster(venue, year, faMm(mi)));
    return rows;
  }
  if(/^y\d+$/.test(String(scope))){
    var to=+String(scope).slice(1);
    for(var yi=0; yi<=to; yi++) rows=rows.concat(faRoster(venue, year, faMm(yi)));
    return rows;
  }
  var one=+scope;
  if(!(one>=0&&one<=11)) return rows;
  return faRoster(venue, year, faMm(one));
}
function faQueue(rows, mineOnly){
  var list=(rows||[]).filter(function(item){ return faNeedsApproval(item.r); });
  if(mineOnly&&faGregView()) list=list.filter(function(item){ return faForGreg(item.r); });
  if(mineOnly&&!faGregView()) list=list.filter(function(item){ return !faForGreg(item.r); });
  return list;
}
function faLineHtml(opts){
  var call=opts.call;
  return '<div class="fa-line"><div class="fa-k">'+opts.label+'</div>'
    +'<div class="fa-bud"><span>'+opts.leftName+'</span><b>'+faMoney(opts.leftVal)+'</b></div>'
    +'<div><span>'+opts.midName+'</span><b>'+faMoney(opts.midVal)+'</b></div>'
    +'<div class="fa-call'+call.tone+'"><button type="button" class="fa-gap" data-fa="pending" data-scope="'+opts.scope+'" title="Open pending approval"><span>'+_escHtml(call.word)+'</span><b>'+_escHtml(call.text)+'</b></button></div>'
    +'<div><span>PY</span><b>'+faMoney(opts.prior)+'</b></div></div>';
}
function faCardHtml(title, row, scope, card){
  return '<section class="fa-vs" data-card="'+card+'"><h4>'+_escHtml(title)+'</h4>'
    +faLineHtml({label:'Guest DJ', leftName:'Budget', leftVal:row.budget, midName:'Scheduled', midVal:row.spend, call:faCall(row.spend, row.budget, 'under'), prior:row.priorGuest, priorDelta:faDelta(row.budget, row.priorGuest), scope:scope})
    +faLineHtml({label:'Bottle service', leftName:'Target', leftVal:row.target, midName:'Sales', midVal:row.sales, call:faCall(row.sales, row.target, 'over'), prior:row.priorBottle, priorDelta:faDelta(row.target, row.priorBottle), scope:scope})
    +'</section>';
}
function faStatusLine(venue, year, scope){
  if(!faYearOn(venue, year)) return '';
  var roster=faScopeRows(venue, year, scope);
  if(!roster.length) return '<i class="fa-m-none">No performances</i>';
  var all=roster.filter(function(item){ return faNeedsApproval(item.r); });
  var mine=faQueue(roster, true);
  if(!all.length) return '<i class="fa-m-ok">All approved</i>';
  var n=faGregView()?mine.length:all.length;
  if(!n) return '<i class="fa-m-ok">All approved</i>';
  return '<i class="fa-m-wait"><i class="fa-warn-dot"></i>'+n+' pending approval</i>';
}
function faStackBox(name, forecast, budget, prior, scope, monthIndex){
  var call=faCall(forecast, budget, 'under');
  var tone=budget==null?'':(forecast>budget?' is-bad':' is-good');
  var monthAttr=(typeof monthIndex==='number')?' data-month="'+monthIndex+'"':'';
  return '<div class="fa-m'+tone+'"'+monthAttr+'><b class="fa-m-name">'+_escHtml(name)+'</b>'
    +'<div class="fa-m-trio">'
    +'<div class="fa-m-bit"><em>'+$k(forecast)+'</em></div>'
    +'<div class="fa-m-bit"><b class="fa-m-bud">'+faMoney(budget)+'</b></div>'
    +'<div class="fa-m-bit"><b class="fa-m-var'+call.tone+'">'+_escHtml(call.text)+'</b></div>'
    +'</div>'
    +'<div class="fa-m-py">PY '+faMoney(prior)+'</div>'
    +'<button type="button" class="fa-m-pend" data-fa="pending" data-scope="'+scope+'">'+faStatusLine(faHere(), faWhen().year, scope)+'</button></div>';
}
/* withLabels is only for the single full-year bar. Quarter bars sit under the one header per column. */
function faTotalBar(label, spend, budget, withLabels){
  var call=faCall(spend, budget, 'under');
  var lab=function(t){ return withLabels?'<i>'+t+'</i>':''; };
  return '<div class="fa-qbar'+(withLabels?'':' fa-qbar-tight')+'"><span>'+_escHtml(label)+'</span>'
    +'<b>'+lab('Scheduled')+faMoney(spend)+'</b>'
    +'<b class="fa-m-bud">'+lab('Budget')+faMoney(budget)+'</b>'
    +'<b class="fa-m-var'+call.tone+'">'+lab('Variance')+_escHtml(call.text)+'</b></div>';
}
function faTrioHeadHtml(){
  return '<div class="fa-trio-hd"><span>Scheduled</span><span>Budget</span><span>Variance</span></div>';
}
function faMonthTileHtml(venue, year, mi, names){
  var mm=faMm(mi);
  var cell=faGuestPosition(venue, year, mm);
  return faStackBox(names[mi], cell.spend, cell.budget, faPriorGuest(venue, year, mm), String(mi), mi);
}
function faQuarterHtml(venue, year, q, names){
  var from=q*3, to=from+2;
  var row=faRange(venue, year, from, to);
  var h='<div class="fa-q"><header class="fa-q-hd"><b>Q'+(q+1)+'</b></header>'+faTrioHeadHtml()+'<div class="fa-q-months">';
  for(var mi=from; mi<=to; mi++) h+=faMonthTileHtml(venue, year, mi, names);
  h+='</div>'+faTotalBar('Q'+(q+1)+' total', row.spend, row.budget, false);
  return h+'</div>';
}
function faPendingHtml(venue, year, scope, title){
  var all=faScopeRows(venue, year, scope).filter(function(item){ return faNeedsApproval(item.r); });
  var gregRows=all.filter(function(item){ return faForGreg(item.r); });
  var rows=faGregView()?gregRows:all;
  var aside=faGregView()?(all.length-gregRows.length):gregRows.length;
  var asideWho=faGregView()?'Takuma':'Greg';
  var head='<div class="fa-pending" id="faPending"><div class="fa-break-hd"><i class="fa-warn-dot"></i>Pending approval'
    +(title?' · '+_escHtml(title):'')+'</div>';
  if(!rows.length){
    return head+'<div class="fa-empty fa-all-ok">All approved'+(aside?' · '+aside+' with '+asideWho:'')+'.</div></div>';
  }
  head+='<div class="fa-pending-note">'+(faGregView()?rows.length+' for you':rows.length+' pending approval')+(aside?' · '+aside+' with '+asideWho:'')+'</div>';
  var h=head+'<table class="fa-tbl"><colgroup><col class="fa-c-warn"><col class="fa-c-date"><col class="fa-c-dj"><col class="fa-c-fee"><col class="fa-c-route"><col class="fa-c-act"></colgroup><thead><tr><th class="fa-warn-side"></th><th>Date</th><th>DJ</th><th>Fee</th><th>Route</th><th></th></tr></thead><tbody>';
  rows.forEach(function(item){
    var r=item.r;
    var uid=String(item.uid).replace(/"/g,'&quot;');
    var greg=faForGreg(r);
    var can=faCanDecide(r);
    var budget=faMonthBudget(r);
    var pct=budget>0?Math.round(item.fee/budget*1000)/10+'% of budget':'';
    h+='<tr class="fa-row-warn"><td class="fa-warn-side" title="Pending approval">!</td>'
      +'<td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
      +'<td>'+_escHtml(String(r.dj||'').trim()||'TBD')+'</td>'
      +'<td>'+(item.fee>0?$k(item.fee):'—')+(pct?'<i class="fa-pct">'+pct+'</i>':'')+'</td>'
      +'<td><span class="fa-chip '+(greg?'fa-fs-wait':'fa-fs-none')+'">'+(greg?_escHtml(faWhyGreg(r)):'Takuma')+'</span></td>';
    if(can){
      h+='<td class="fa-acts"><button type="button" class="fa-yes" data-uid="'+uid+'" data-status="Finance Approved" title="Finance Approved">&#10003;</button>'
        +'<button type="button" class="fa-no" data-uid="'+uid+'" data-status="Finance declined" title="Finance declined">&#10007;</button></td>';
    }else{
      h+='<td class="fa-hold">'+(greg?'Greg approves':'Takuma approves')+'</td>';
    }
    h+='</tr>';
  });
  return h+'</tbody></table></div>';
}
function faScopeTitle(scope, names){
  if(scope==null||scope==='year'||scope==='total') return 'Full year';
  if(/^q[1-4]$/.test(String(scope))) return 'Q'+String(scope).slice(1);
  if(/^y\d+$/.test(String(scope))) return 'YTD through '+names[+String(scope).slice(1)];
  var mi=+scope;
  return (mi>=0&&mi<=11)?names[mi]:'';
}
function faMonthRow(venue, year, mi){
  var g=faGuestPosition(venue, year, faMm(mi));
  var bottle=faBottlePosition(venue, year, faMm(mi));
  return {spend:g.spend, budget:g.budget, sales:bottle.sales, target:bottle.target, priorGuest:faPriorGuest(venue, year, faMm(mi)), priorBottle:bottle.prior};
}
function renderFinanceApproval(){
  var host=document.getElementById('financeBody');
  if(!host) return;
  initFinanceStatus();
  if(!financeCanApprove()){
    host.innerHTML='<div class="fa-empty">Finance Approval is not available for this sign-in.</div>';
    return;
  }
  var venue=faHere();
  var when=faWhen();
  var live=faYearOn(venue, when.year);
  var greg=faGregView();
  var names=(typeof MN_FULL!=='undefined')?MN_FULL:['January','February','March','April','May','June','July','August','September','October','November','December'];
  var sub=document.getElementById('pgSub');
  if(sub&&typeof curView!=='undefined'&&curView==='finance'){
    sub.innerHTML='<span>'+_escHtml(venue)+' · '+(when.total?when.year:(names[when.month]+' '+when.year))+'</span>';
  }
  var html='<div class="fa-bar">';
  if(!when.total) html+='<button type="button" class="fa-back" data-fa="total" title="Back to the year">&#8592; Total</button>';
  html+='<label>Location<select onchange="faSetVenue(this.value)">';
  FA_VENUES.forEach(function(v){ html+='<option'+(v===venue?' selected':'')+'>'+_escHtml(v)+'</option>'; });
  html+='</select></label><label>Year<select onchange="faSetYear(this.value)">';
  [2026,2027].forEach(function(y){ html+='<option'+(y===when.year?' selected':'')+'>'+y+'</option>'; });
  html+='</select></label><label>Month<select onchange="faSetMonth(this.value)">';
  html+='<option value="total"'+(when.total?' selected':'')+'>Total</option>';
  names.forEach(function(name, i){ html+='<option value="'+i+'"'+(!when.total&&i===when.month?' selected':'')+'>'+name+'</option>'; });
  html+='</select></label></div>';
  html+='<div class="fa-rule">'+(greg
    ?'Super owner. You approve nights over $30K, and nights of at least $5K that are over 5% of that month\'s Guest DJ budget. Admins approve the rest.'
    :'Admin. You approve nights under $5K and nights within 5% of that month\'s Guest DJ budget. The Super owner approves nights over that, and every night over $30K.')+'</div>';
  if(!live) html+='<div class="fa-note">Finance approval applies to 2027 performances. 2026 is shown against budget only.</div>';
  var yearRow=faRange(venue, when.year, 0, 11);
  html+=faCardHtml('Budget · full year', yearRow, 'year', 'year');
  if(greg && when.total){
    html+='<div class="fa-fit"><div class="fa-break-hd">Guest DJ · scheduled vs budget · '+when.year+'</div><div class="fa-quarters">';
    for(var q=0;q<4;q++) html+=faQuarterHtml(venue, when.year, q, names);
    html+='</div>'+faTotalBar(when.year+' total', yearRow.spend, yearRow.budget, true)+'</div>';
  }else if(!greg){
    var mi=when.total?((typeof TODAY!=='undefined'&&typeof fiscalInfoForDate==='function'&&fiscalInfoForDate(TODAY).year===when.year)?fiscalInfoForDate(TODAY).monthIndex:0):when.month;
    html+='<div class="fa-stack">'
      +faCardHtml('MTD · '+names[mi], faMonthRow(venue, when.year, mi), String(mi), 'mtd')
      +faCardHtml('YTD through '+names[mi], faRange(venue, when.year, 0, mi), 'y'+mi, 'ytd')
      +'</div>';
    if(live) html+='<button type="button" class="fa-pending-launch" data-fa="pending" data-scope="'+mi+'">'+faStatusLine(venue, when.year, String(mi))+'</button>';
    html+=faTotalBar(when.year+' total', yearRow.spend, yearRow.budget, true);
  }else{
    html+=faCardHtml(names[when.month], faMonthRow(venue, when.year, when.month), String(when.month), 'month');
    html+=faTotalBar(when.year+' total', yearRow.spend, yearRow.budget, true);
    if(!faPendingOn){ faPendingOn=true; faPendingScope=String(when.month); }
  }
  if(live && (faPendingOn || (greg && !when.total))){
    html+=faPendingHtml(venue, when.year, faPendingScope||'year', faScopeTitle(faPendingScope, names));
  }
  host.innerHTML=html;
  host.onclick=function(ev){
    var t=ev.target.closest?ev.target.closest('[data-fa],[data-month],[data-status]'):null;
    if(!t||!host.contains(t)) return;
    if(t.getAttribute('data-fa')==='total'){ faSetMonth('total'); return; }
    if(t.getAttribute('data-fa')==='pending'){
      var scope=t.getAttribute('data-scope')||'year';
      if(faPendingOn && String(faPendingScope)===String(scope)){ faPendingOn=false; faPendingScope=null; }
      else { faPendingOn=true; faPendingScope=scope; }
      renderFinanceApproval();
      return;
    }
    if(t.hasAttribute('data-month')){ faSetMonth(t.getAttribute('data-month')); return; }
    if(t.getAttribute('data-status')) faDecide(t.getAttribute('data-uid'), t.getAttribute('data-status'));
  };
}
function initFinanceStatus(){
  if(window._financeStatusOn || !window._fbDb) return;
  window._financeStatusOn=true;
  window._fbDb.ref('rdg/financeStatus').on('value', function(snap){
    FINANCE_STATUS=snap.val()||{};
    faRefreshViews();
  });
}
(function faWaitForDb(tries){
  try{ initFinanceStatus(); }catch(e){}
  if(!window._financeStatusOn && tries<120) setTimeout(function(){ faWaitForDb(tries+1); }, 500);
})(0);
/* Sidebar is built during boot, before this file loads. Rebuild so the approvers keep the item. */
try{ if(typeof buildSidebar==='function') buildSidebar(); }catch(eSb){}
