/* Finance Approval and the 2027 Finance Status rule.
   Finance Status lives on its own path (rdg/financeStatus/{uid}). DJ name, fee, and DJ status keep their
   existing schedule sync. Only fiscal 2027 at the three locations below follows the finance rule.

   RULES ACTION is off. DJ status can be changed without Finance Approved.
   Set RULES_ACTION to true to turn these held rules on together:
   1. Offer sent, Hold 1, and Confirmed stay locked until Finance Approved.
   2. A night under $5,000 whose month is still within the Guest DJ budget can be
      finance-approved by anyone signed in. That bypasses Owner and Super Owner.
   These stay on either way:
   - Super Owner approves a night above $30K, or above $5K when the fee is more than
     5% of that month's Guest DJ budget. Owners approve every other night.
   - Approve and decline only in Finance Approval.
   - An Owner can move Approved back to Not set or To approve, which clears DJ status. */
var RULES_ACTION=false;
var FINANCE_APPROVERS={
  'matthias@rivieradininggroup.com':1,
  'greg@rivieradininggroup.com':1,
  'takuma@rivieradininggroup.com':1,
  'michael@rivieradininggroup.com':1,
  'fabien@rivieradininggroup.com':1
};
var FA_VENUES=['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge','HONO Lounge'];
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
  var email=financeSignedInEmail();
  var role=(typeof signInRole==='function')?signInRole(email):'';
  if(role==='operator'||role==='ao') return false;
  if(role==='admin'||role==='owner'||role==='super') return true;
  if(typeof signInIsOwner==='function' && signInIsOwner()) return true;
  return !!FINANCE_APPROVERS[email];
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
/* Calendar column for every year at the finance venues. Approval queue and the DJ-status lock stay on 2027. */
function faFinanceTrack(show){
  return !!(show && FA_VENUES.indexOf(show.v||show.venue)>=0);
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
  if(!faFinanceTrack(show)) return '';
  var raw=faRawDjStatus(show);
  /* A DJ status never counts as finance approval. Approval is only the finance record. */
  if(FA_FIN.indexOf(raw)>=0) return raw;
  var rec=FINANCE_STATUS[faKey(show)];
  if(rec&&typeof rec==='object'&&rec.s!=null) return FA_FIN.indexOf(rec.s)>=0?rec.s:'';
  return '';
}
function faFinanceTone(st){
  if(st==='Finance to Approve') return 'fa-fs-wait';
  if(st==='Finance Approved') return 'fa-fs-ok';
  if(st==='Finance declined') return 'fa-fs-no';
  return 'fa-fs-none';
}
function faDjLocked(show){
  if(!RULES_ACTION) return false;
  if(!faInScope(show)) return false;
  return faFinanceStatus(show)!=='Finance Approved';
}
function faIsOwnerRole(){
  var role=(typeof signInRole==='function')?signInRole(financeSignedInEmail()):'';
  return role==='owner';
}
/* Calendar can send a night To approve, and an Owner can pull an approval back.
   Approved and Declined are only set in Finance Approval. */
function faCalendarFinanceAllowed(prev, value){
  if(value===prev) return true;
  if(value==='Finance Approved'||value==='Finance declined') return false;
  if(!prev && value==='Finance to Approve') return true;
  return prev==='Finance Approved' && (value===''||value==='Finance to Approve') && faIsOwnerRole();
}
function faStatusOptions(show, current){
  return (typeof ACCT_DJ_STATUS!=='undefined')?ACCT_DJ_STATUS.slice():FA_LIVE.slice();
}
/* Offer sent, Hold 1, and Confirmed wait for Finance Approved only while RULES ACTION is on. */
function faBlockLiveStatus(show, next){
  if(!RULES_ACTION) return false;
  if(!faInScope(show)) return false;
  if(FA_LIVE.indexOf(next)<0) return false;
  if(!faDjLocked(show)) return false;
  var msg=faOpenLane(show)
    ?'DJ status unlocks once this night is Finance Approved.'
    :('DJ status unlocks once '+(faForGreg(show)?'a Super Owner':'an Owner')+' marks this night Approved.');
  try{ alert(msg); }catch(e){}
  return true;
}
function faDjLockTitle(show){
  if(faOpenLane(show)) return 'Locked until this night is Finance Approved';
  return 'Locked until '+(faForGreg(show)?'a Super Owner':'an Owner')+' marks this night Finance Approved';
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
  var uid=String((typeof ensureShowUid==='function')?ensureShowUid(show):'').replace(/"/g,'&quot;');
  function opt(value, label){
    var on=st===value;
    var allowed=faCalendarFinanceAllowed(st, value);
    return '<option value="'+value+'"'+(on?' selected':'')+(allowed?'':' disabled')+'>'+label+'</option>';
  }
  return '<select class="fa-fs-sel '+faFinanceTone(st)+'" data-action="finStatus" data-ds="'+ds+'" data-idx="'+idx+'" data-uid="'+uid+'"'
    +' onclick="event.stopPropagation()" title="Finance Status. Approve or decline only in Finance Approval. An Owner can move Approved back to Not set or To approve, which clears DJ status.">'
    +opt('', 'Not set')
    +opt('Finance to Approve', 'To approve')
    +opt('Finance Approved', 'Approved')
    +opt('Finance declined', 'Declined')
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
function faClearDjStatus(show){
  if(!show) return;
  var prev=(typeof faDjStatus==='function')?faDjStatus(show):'';
  show.djStatus=null;
  if(typeof ensureShowUid==='function') ensureShowUid(show);
  if(typeof persistShowDjStatusOnly==='function') persistShowDjStatusOnly(show);
  try{
    var same=0;
    (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(x){
      if(x && x._s!=='empty' && (x.v||x.venue)===(show.v||show.venue) && x.d===show.d) same++;
    });
    if(same<=1 && typeof getAcct==='function' && typeof _acctPersistDay==='function'){
      var acct=getAcct(show.d);
      if(acct && acct.djStatus){
        acct.djStatus=null;
        _acctPersistDay(show.d);
      }
    }
  }catch(e){}
  if(show._uid && prev && typeof showHistPush==='function') showHistPush(show._uid, 'DJ Status', prev, 'Not set');
}
function faFinanceShort(st){
  if(!st) return 'Not set';
  if(st==='Finance to Approve') return 'To approve';
  if(st==='Finance Approved') return 'Approved';
  if(st==='Finance declined') return 'Declined';
  return st;
}
function faSetFinance(show, status, why){
  if(!faFinanceTrack(show)) return false;
  var key=faKey(show);
  if(!key) return false;
  var prev=faFinanceStatus(show);
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
  var uid=(typeof ensureShowUid==='function')?ensureShowUid(show):(show&&show._uid)||'';
  var fromLbl=faFinanceShort(prev);
  var toLbl=faFinanceShort(status);
  if(uid && fromLbl!==toLbl && typeof showHistPush==='function') showHistPush(uid, 'Finance Status', fromLbl, toLbl);
  return true;
}
function faSetFinanceFromSelect(sel){
  if(!sel) return;
  var r=faFindShow(sel.getAttribute('data-uid'));
  var next=sel.value||'';
  if(!r||!faFinanceTrack(r)){ faRefreshViews(); return; }
  var prev=faFinanceStatus(r);
  if(prev===next) return;
  if(!faCalendarFinanceAllowed(prev, next)){
    if(next==='Finance Approved'||next==='Finance declined'){
      try{ alert('Approve or decline this night in Finance Approval. The calendar cannot set Approved.'); }catch(e){}
    }else if(prev==='Finance Approved'){
      try{ alert('Only an Owner can move an approved night back to Not set or To approve.'); }catch(e2){}
    }
    sel.value=prev;
    return;
  }
  if(prev==='Finance Approved') faClearDjStatus(r);
  faSetFinance(r, next, prev==='Finance Approved'?'owner reset':'calendar');
  sel.className='fa-fs-sel '+faFinanceTone(next);
  if(next==='Finance Approved'){
    var row=sel.closest?sel.closest('tr'):null;
    var dj=row?row.querySelector('select[data-action="djStatus"]'):null;
    if(dj){
      dj.disabled=false;
      dj.classList.remove('fa-dj-locked');
      for(var oi=0;oi<dj.options.length;oi++) dj.options[oi].disabled=false;
      dj.title='DJ Status for this performance';
    }
  }
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
    try{ alert(faForGreg(r)?'A Super Owner approves this night.':'An Owner approves this night.'); }catch(e){}
    return;
  }
  faSetFinance(r, status, 'finance approval');
  renderFinanceApproval();
}
/* Super Owner approves the large nights. Every Owner approves the rest. The role decides, not a person's name. */
function faViewer(){
  return faIsSuperApprover()?'greg':'desk';
}
function faSetViewer(){}
function faGregView(){ return faViewer()==='greg'; }
function faMonthBudget(show){
  if(!show||!show.d||typeof fiscalInfoForDate!=='function'||typeof calGuestDjBudget!=='function') return null;
  var info=fiscalInfoForDate(show.d);
  var g=calGuestDjBudget(show.v||show.venue, info.year, info.mm);
  var n=g&&g.amount!=null?+g.amount:null;
  return n!=null&&isFinite(n)?n:null;
}
/* Super Owner: fee above $30K, or fee above $5K and above 5% of that month's budget.
   Every other night goes to Owner. */
function faForGreg(show){
  var fee=faFee(show);
  if(fee>30000) return true;
  if(!(fee>5000)) return false;
  var budget=faMonthBudget(show);
  return budget>0 && fee/budget>0.05;
}
function faIsSuperApprover(){
  var email=String(financeSignedInEmail()||'').toLowerCase();
  var role=(typeof signInRole==='function')?signInRole(email):'';
  return role==='super'||email==='greg@rivieradininggroup.com';
}
/* RULES ACTION. Under $5K, and the month's Guest DJ fees are still within budget. */
function faMonthOnBudget(show){
  if(!show||!show.d||typeof fiscalInfoForDate!=='function') return false;
  var info=fiscalInfoForDate(show.d);
  if(!info) return false;
  var pos=faGuestPosition(show.v||show.venue, info.year, info.mm);
  if(!pos||pos.budget==null||!(pos.budget>0)) return false;
  return pos.spend<=pos.budget;
}
function faOpenLane(show){
  if(!RULES_ACTION||!show) return false;
  var fee=faFee(show);
  if(!(fee>0)||!(fee<5000)) return false;
  return faMonthOnBudget(show);
}
function faCanSeeFinance(){
  if(financeCanApprove()) return true;
  return !!(RULES_ACTION&&financeSignedInEmail());
}
function faCanDecide(show){
  if(!show||!faFinanceTrack(show)) return false;
  if(faOpenLane(show)) return !!financeSignedInEmail();
  if(!financeCanApprove()) return false;
  return faIsSuperApprover()?faForGreg(show):!faForGreg(show);
}
function faWhyGreg(show){
  if(faOpenLane(show)) return 'Anyone';
  if(!faForGreg(show)) return 'Owner';
  if(faFee(show)>30000) return 'Above $30K';
  return 'Above 5% of budget';
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
  if(mineOnly&&faGregView()) list=list.filter(function(item){ return faForGreg(item.r)||faOpenLane(item.r); });
  if(mineOnly&&!faGregView()) list=list.filter(function(item){ return !faForGreg(item.r)||faOpenLane(item.r); });
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
  if(!all.length) return '<i class="fa-m-ok">All approved</i>';
  return '<i class="fa-m-wait"><i class="fa-warn-dot"></i>'+all.length+' pending approval</i>';
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
  var rows=faScopeRows(venue, year, scope).filter(function(item){ return faNeedsApproval(item.r); });
  var superN=0, ownerN=0, anyN=0;
  rows.forEach(function(item){
    if(faOpenLane(item.r)) anyN++;
    else if(faForGreg(item.r)) superN++;
    else ownerN++;
  });
  var head='<div class="fa-pending" id="faPending"><div class="fa-break-hd"><i class="fa-warn-dot"></i>Pending approval'
    +(title?' · '+_escHtml(title):'')+'</div>';
  if(!rows.length){
    return head+'<div class="fa-empty fa-all-ok">All approved.</div></div>';
  }
  head+='<div class="fa-pending-note">'+superN+' for Super Owner · '+ownerN+' for Owner'+(anyN?' · '+anyN+' for anyone':'')+'</div>';
  var h=head+'<table class="fa-tbl"><colgroup><col class="fa-c-warn"><col class="fa-c-date"><col class="fa-c-dj"><col class="fa-c-fee"><col class="fa-c-route"><col class="fa-c-act"></colgroup><thead><tr><th class="fa-warn-side"></th><th>Date</th><th>DJ</th><th>Fee</th><th>Route</th><th></th></tr></thead><tbody>';
  rows.forEach(function(item){
    var r=item.r;
    var uid=String(item.uid).replace(/"/g,'&quot;');
    var lane=faOpenLane(r);
    var greg=faForGreg(r);
    var can=faCanDecide(r);
    var budget=faMonthBudget(r);
    var pct=budget>0?Math.round(item.fee/budget*1000)/10+'% of budget':'';
    h+='<tr class="fa-row-warn"><td class="fa-warn-side" title="Pending approval">!</td>'
      +'<td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
      +'<td>'+_escHtml(String(r.dj||'').trim()||'TBD')+'</td>'
      +'<td>'+(item.fee>0?$k(item.fee):'—')+(pct?'<i class="fa-pct">'+pct+'</i>':'')+'</td>'
      +'<td><span class="fa-chip '+(lane?'fa-fs-ok':(greg?'fa-fs-wait':'fa-fs-none'))+'">'+_escHtml(faWhyGreg(r))+'</span></td>';
    if(can){
      h+='<td class="fa-acts"><button type="button" class="fa-yes" data-uid="'+uid+'" data-status="Finance Approved" title="Finance Approved">&#10003;</button>'
        +'<button type="button" class="fa-no" data-uid="'+uid+'" data-status="Finance declined" title="Finance declined">&#10007;</button></td>';
    }else{
      h+='<td class="fa-hold">'+(greg?'Super Owner':'Owner')+'</td>';
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
  if(!faCanSeeFinance()){
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
  var laneNote=RULES_ACTION?' A night under $5K that is still within the month Guest DJ budget can be approved by anyone.':'';
  html+='<div class="fa-rule">'+(greg
    ?'Super Owner. You approve a night above $30K, and a night above $5K when that fee is more than 5% of the month\'s Guest DJ budget. Owners approve every other night.'
    :'Owner. You approve every night except one above $30K, and one above $5K that is more than 5% of the month\'s Guest DJ budget. A Super Owner approves those.')+laneNote+'</div>';
  if(!live) html+='<div class="fa-note">Finance approval applies to 2027 performances. 2026 is shown against budget only.</div>';
  var yearRow=faRange(venue, when.year, 0, 11);
  if(when.total){
    html+='<div class="fa-fit"><div class="fa-break-hd">Guest DJ · scheduled vs budget · '+when.year+'</div><div class="fa-quarters">';
    for(var q=0;q<4;q++) html+=faQuarterHtml(venue, when.year, q, names);
    html+='</div>'+faTotalBar(when.year+' total', yearRow.spend, yearRow.budget, true)+'</div>';
  }else{
    html+=faCardHtml('Budget · full year', yearRow, 'year', 'year');
    html+=faCardHtml(names[when.month], faMonthRow(venue, when.year, when.month), String(when.month), 'month');
    if(live) html+=faPendingHtml(venue, when.year, String(when.month), names[when.month]);
  }
  host.innerHTML=html;
  host.onclick=function(ev){
    var t=ev.target.closest?ev.target.closest('[data-fa],[data-month],[data-status]'):null;
    if(!t||!host.contains(t)) return;
    if(t.getAttribute('data-fa')==='total'){ faSetMonth('total'); return; }
    if(t.getAttribute('data-fa')==='pending'){
      var scope=t.getAttribute('data-scope')||'';
      if(/^\d+$/.test(scope)){ faSetMonth(scope); return; }
      var monthEl=t.closest('[data-month]');
      if(monthEl){ faSetMonth(monthEl.getAttribute('data-month')); return; }
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
