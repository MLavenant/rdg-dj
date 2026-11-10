/* Finance Approval and the 2027 Finance Status rule.
   Finance Status lives on its own path (rdg/financeStatus/{uid}). DJ name, fee, and DJ status keep their
   existing schedule sync. Only fiscal 2027 at the three locations below follows the finance rule. */
var FINANCE_APPROVERS={
  'matthias@rivieradininggroup.com':1,
  'greg@rivieradininggroup.com':1,
  'takuma@rivieradininggroup.com':1,
  'michael@rivieradininggroup.com':1
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
  var can=financeCanApprove();
  if(!can && (next==='Finance Approved'||next==='Finance declined'||prev==='Finance Approved'||prev==='Finance declined')){
    try{ alert('Only Finance Approval can approve or decline this night.'); }catch(e){}
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
  if(!financeCanApprove()||!uid) return;
  var r=faFindShow(uid);
  if(!r||!faInScope(r)) return;
  faSetFinance(r, status, 'finance approval');
  renderFinanceApproval();
}

var faVenue=null, faYear=null, faMonth=null;
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
  renderFinanceApproval();
}
function faWhen(){
  if(faYear!==2026&&faYear!==2027) faYear=FA_YEAR;
  /* null >= 0 is true in JavaScript, so a missing month must be checked by type. */
  var total=!(typeof faMonth==='number'&&faMonth>=0&&faMonth<=11);
  if(total) return {year:faYear, total:true, month:null, mm:null};
  return {year:faYear, total:false, month:faMonth, mm:(typeof fiscalMm==='function')?fiscalMm(faMonth):((faMonth<9?'0':'')+(faMonth+1))};
}
function faSetYear(v){ faYear=+v; renderFinanceApproval(); }
function faSetMonth(v){
  faMonth=(v==null||v==='total'||v==='-1')?null:+v;
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
  var sales=0, target=0, hasS=false, hasT=false;
  faRoster(venue, year, mm).forEach(function(item){
    var tgt=(typeof showTargets==='function')?showTargets(item.r):null;
    if(tgt&&tgt.bs_m!=null&&isFinite(+tgt.bs_m)){ target+=+tgt.bs_m; hasT=true; }
    var py=faPrior(venue, item.r);
    if(py.sales!=null){ sales+=py.sales; hasS=true; }
  });
  return {sales:hasS?Math.round(sales):null, target:hasT?Math.round(target):null};
}
function faMoney(n){ return (n==null||!isFinite(+n))?'—':$k(n); }
function faCall(actual, target, goodWhen){
  if(actual==null||target==null||!isFinite(+actual)||!isFinite(+target)) return {word:'—', text:'—', tone:''};
  var gap=Math.round(+actual-+target);
  if(!gap) return {word:'Even', text:$k(0), tone:''};
  var good=goodWhen==='over'?gap>0:gap<0;
  return {word:gap>0?'Over':'Under', text:(gap>0?'+':'−')+$k(Math.abs(gap)), tone:good?' fa-good':' fa-bad'};
}
function faRange(venue, year, from, to){
  var spend=0, budget=0, hasB=false, sales=0, bsT=0, hasS=false, hasT=false;
  for(var mi=from; mi<=to; mi++){
    var mm=(typeof fiscalMm==='function')?fiscalMm(mi):((mi<9?'0':'')+(mi+1));
    var g=faGuestPosition(venue, year, mm);
    var bottle=faBottlePosition(venue, year, mm);
    spend+=g.spend;
    if(g.budget!=null){ budget+=g.budget; hasB=true; }
    if(bottle.sales!=null){ sales+=bottle.sales; hasS=true; }
    if(bottle.target!=null){ bsT+=bottle.target; hasT=true; }
  }
  return {spend:Math.round(spend), budget:hasB?Math.round(budget):null, sales:hasS?Math.round(sales):null, target:hasT?Math.round(bsT):null};
}
function faLineHtml(label, midLabel, mid, target, call){
  return '<div class="fa-line"><div class="fa-k">'+label+'</div>'
    +'<div class="fa-bud"><span>Target</span><b>'+faMoney(target)+'</b></div>'
    +'<div><span>'+midLabel+'</span><b>'+faMoney(mid)+'</b></div>'
    +'<div class="fa-call'+call.tone+'"><span>'+_escHtml(call.word)+'</span><b>'+_escHtml(call.text)+'</b></div></div>';
}
function faCardHtml(title, row){
  return '<section class="fa-vs"><h4>'+_escHtml(title)+'</h4>'
    +faLineHtml('Guest DJ','Forecast',row.spend,row.budget,faCall(row.spend,row.budget,'under'))
    +faLineHtml('Bottle service','Sales',row.sales,row.target,faCall(row.sales,row.target,'over'))
    +'</section>';
}
function faMonthTileHtml(venue, year, mi, names){
  var mm=(typeof fiscalMm==='function')?fiscalMm(mi):((mi<9?'0':'')+(mi+1));
  var cell=faGuestPosition(venue, year, mm);
  var tone=cell.budget==null?'':(cell.spend>cell.budget?' is-bad':' is-good');
  var line='';
  if(faYearOn(venue, year)){
    var c=faCounts(faRoster(venue, year, mm));
    if(!c.total) line='<i class="fa-m-none">No performances</i>';
    else if(c.pending) line='<i class="fa-m-wait">'+c.pending+' pending approval</i>';
    else line='<i class="fa-m-ok">All approved</i>';
  }
  return '<button type="button" class="fa-m'+tone+'" data-month="'+mi+'"><b>'+names[mi]+'</b>'
    +'<div class="fa-m-row"><span class="fa-m-bud">Target '+faMoney(cell.budget)+'</span><em>'+$k(cell.spend)+'</em></div>'
    +line+'</button>';
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
  var names=(typeof MN_FULL!=='undefined')?MN_FULL:['January','February','March','April','May','June','July','August','September','October','November','December'];
  var sub=document.getElementById('pgSub');
  if(sub&&typeof curView!=='undefined'&&curView==='finance'){
    sub.innerHTML='<span>'+_escHtml(venue)+' · '+(when.total?when.year:(names[when.month]+' '+when.year))+'</span>';
  }
  var html='<div class="fa-bar">';
  if(!when.total) html+='<button type="button" class="fa-back" data-fa="total" title="Back to the year total">&#8592; Total</button>';
  html+='<label>Location<select onchange="faSetVenue(this.value)">';
  FA_VENUES.forEach(function(v){ html+='<option'+(v===venue?' selected':'')+'>'+_escHtml(v)+'</option>'; });
  html+='</select></label><label>Year<select onchange="faSetYear(this.value)">';
  [2026,2027].forEach(function(y){ html+='<option'+(y===when.year?' selected':'')+'>'+y+'</option>'; });
  html+='</select></label><label>Month<select onchange="faSetMonth(this.value)">';
  html+='<option value="total"'+(when.total?' selected':'')+'>Total</option>';
  names.forEach(function(name, i){ html+='<option value="'+i+'"'+(!when.total&&i===when.month?' selected':'')+'>'+name+'</option>'; });
  html+='</select></label></div>';
  if(!live) html+='<div class="fa-note">Finance approval applies to 2027 performances. 2026 is shown against budget only.</div>';
  if(when.total){
    if(live){
      var c=faCounts(faRoster(venue, when.year, null));
      html+='<div class="fa-stats"><div class="fa-stat is-yes"><b>'+c.approved+'</b><span>Approved</span></div>'
        +'<div class="fa-stat is-wait"><b>'+c.pending+'</b><span>Pending approval</span></div></div>';
    }
    var horizon=faHorizon(when.year, names);
    html+=faCardHtml(horizon.label, faRange(venue, when.year, 0, horizon.through));
    html+='<div class="fa-break-hd">Guest DJ vs budget · '+when.year+'</div><div class="fa-months">';
    for(var mi=0;mi<12;mi++) html+=faMonthTileHtml(venue, when.year, mi, names);
    html+='</div>';
  }else{
    var g=faGuestPosition(venue, when.year, when.mm);
    var bottle=faBottlePosition(venue, when.year, when.mm);
    html+='<div class="fa-stack">'+faCardHtml('MTD · '+names[when.month], {spend:g.spend, budget:g.budget, sales:bottle.sales, target:bottle.target})
      +faCardHtml('YTD through '+names[when.month], faRange(venue, when.year, 0, when.month))+'</div>';
    if(live){
      var pending=faRoster(venue, when.year, when.mm).filter(function(item){ return faNeedsApproval(item.r); });
      html+='<div class="fa-break-hd">Pending approval · '+names[when.month]+' '+when.year+'</div>';
      if(!pending.length){
        html+='<div class="fa-empty fa-all-ok">All approved.</div>';
      }else{
        html+='<table class="fa-tbl"><thead><tr><th>Date</th><th>DJ</th><th>Fee</th><th>BS target</th><th>Prior DJ</th><th>Prior fee</th><th>BS sales</th><th>Finance status</th><th></th></tr></thead><tbody>';
        pending.forEach(function(item){
          var r=item.r;
          var tgt=(typeof showTargets==='function')?showTargets(r):null;
          var py=faPrior(venue, r);
          var uid=String(item.uid).replace(/"/g,'&quot;');
          html+='<tr><td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
            +'<td>'+_escHtml(String(r.dj||'').trim()||'TBD')+'</td><td>'+(item.fee>0?$k(item.fee):'—')+'</td>'
            +'<td>'+(tgt&&tgt.bs_m!=null?$k(tgt.bs_m):'—')+'</td>'
            +'<td>'+_escHtml(py.dj||'—')+'</td><td>'+(py.fee!=null?$k(py.fee):'—')+'</td>'
            +'<td>'+faMoney(py.sales)+'</td>'
            +'<td><span class="fa-chip '+faFinanceTone(item.status)+'">'+_escHtml(item.status||'Not set')+'</span></td>'
            +'<td class="fa-acts"><button type="button" class="fa-yes" data-uid="'+uid+'" data-status="Finance Approved" title="Finance Approved">&#10003;</button>'
            +'<button type="button" class="fa-no" data-uid="'+uid+'" data-status="Finance declined" title="Finance declined">&#10007;</button></td></tr>';
        });
        html+='</tbody></table>';
      }
    }
  }
  host.innerHTML=html;
  host.onclick=function(ev){
    var t=ev.target.closest?ev.target.closest('[data-fa],[data-month],[data-status]'):null;
    if(!t||!host.contains(t)) return;
    if(t.getAttribute('data-fa')==='total'){ faSetMonth('total'); return; }
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
