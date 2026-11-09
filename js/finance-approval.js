/* Finance Approval. Site filter is local and never moves the guest calendar.
   The status dropdown still offers Finance to Approve only for Casa Neos Beach Club in April 2027. */
var FINANCE_APPROVERS={
  'matthias@rivieradininggroup.com':1,
  'greg@rivieradininggroup.com':1,
  'takuma@rivieradininggroup.com':1
};
var FINANCE_MARKS={};
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
function faInScope(show){
  if(!show||!show.d) return false;
  if((show.v||show.venue)!=='Casa Neos Beach Club') return false;
  if(typeof fiscalInfoForDate!=='function') return false;
  var info=fiscalInfoForDate(show.d);
  return !!(info&&info.year===2027&&info.monthIndex===3);
}
function faFee(show){
  var raw=show&&show.fee!=null&&show.fee!==''?show.fee:(show&&show.cost!=null?show.cost:null);
  var n=raw!=null&&raw!==''?+raw:null;
  return n!=null&&isFinite(n)?n:0;
}
function faStatusOptions(show, current){
  var base=(typeof ACCT_DJ_STATUS!=='undefined')?ACCT_DJ_STATUS.slice():['Offer sent','Hold 1','Confirmed'];
  if(!faInScope(show)) return base;
  return ['Finance to Approve','Finance Approved','Finance declined'].concat(base);
}
/* Live Entertainment stays locked until Finance Approved, except for the approvers. */
function faBlockLiveStatus(show, next, prev){
  if(!faInScope(show)) return false;
  if(next!=='Offer sent'&&next!=='Hold 1'&&next!=='Confirmed') return false;
  if(prev==='Finance Approved') return false;
  if(financeCanApprove()) return false;
  return true;
}
function faStatusSelectOptionsHtml(show, djSt){
  var can=financeCanApprove();
  var locked=!can && djSt!=='Finance Approved';
  function opt(value, label, disabled){
    var on=String(djSt||'')===String(value);
    return '<option value="'+value+'"'+(on?' selected':'')+(disabled&&!on?' disabled':'')+'>'+label+'</option>';
  }
  var h='<optgroup label="Finance">';
  h+=opt('', 'Not set', false);
  h+=opt('Finance to Approve', 'Finance to Approve', false);
  h+=opt('Finance Approved', 'Finance Approved', !can);
  h+=opt('Finance declined', 'Finance declined', !can);
  h+='</optgroup><optgroup label="Live Entertainment">';
  h+=opt('Offer sent', 'Offer sent', locked);
  h+=opt('Hold 1', 'Hold 1', locked);
  h+=opt('Confirmed', 'Confirmed', locked);
  h+='</optgroup>';
  return h;
}
function faMonthNote(show){
  if(typeof fiscalInfoForDate!=='function'||typeof fiscalPeriodRange!=='function') return '—';
  var info=fiscalInfoForDate(show.d);
  var range=fiscalPeriodRange(info.year, info.monthIndex);
  var venue=show.v||show.venue;
  var spend=0;
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!r||r._s==='empty'||!r.d) return;
    if((r.v||r.venue)!==venue) return;
    if(r.d<range.from||r.d>range.to) return;
    spend+=faFee(r);
  });
  var bud=(typeof mrLiveBudget==='function')?mrLiveBudget(venue,{year:info.year, period:info.monthIndex+1}):null;
  if(bud==null) return 'Budget not set';
  var gap=spend-bud;
  if(gap>0.5) return 'Over budget by '+$k(gap);
  if(gap<-0.5) return 'Under budget by '+$k(-gap);
  return 'On budget';
}
var faVenue=null;
function faVenues(){
  if(typeof listActiveVenues==='function') return listActiveVenues();
  return (typeof CORE_VENUES!=='undefined')?CORE_VENUES.slice():[];
}
function faHere(){
  var venues=faVenues();
  if(!faVenue||venues.indexOf(faVenue)<0){
    faVenue=(typeof curV!=='undefined'&&venues.indexOf(curV)>=0)?curV:(venues[0]||'');
  }
  return faVenue;
}
function faSetVenue(v){
  /* Own filter. Never curV, curM, or curYr. */
  if(faVenues().indexOf(v)<0) return;
  faVenue=v;
  renderFinanceApproval();
}
var faYear=null, faMonth=null, faPendingOpen=false;
function faWhen(){
  if(faYear!==2026&&faYear!==2027){
    faYear=(typeof curYr!=='undefined'&&(curYr===2026||curYr===2027))?curYr:2027;
  }
  if(faMonth==null||faMonth<0||faMonth>11) faMonth=(typeof curM!=='undefined')?curM:0;
  return {year:faYear, month:faMonth, mm:(typeof fiscalMm==='function')?fiscalMm(faMonth):((faMonth<9?'0':'')+(faMonth+1))};
}
function faSetYear(v){ faYear=+v; renderFinanceApproval(); }
function faSetMonth(v){ faMonth=+v; renderFinanceApproval(); }
function faTogglePending(){ faPendingOpen=!faPendingOpen; renderFinanceApproval(); }
function faStatusOf(r){
  var st=(typeof getShowDjStatus==='function')?getShowDjStatus(r):(r&&r.djStatus)||null;
  return st?String(st):'';
}
function faNamedShow(r){
  if(!r||r._s==='empty'||!r.d) return false;
  var dj=String(r.dj||'').trim();
  return !!(dj&&!/^tbd$/i.test(dj));
}
function faNeedsApproval(r){
  if(!faNamedShow(r)) return false;
  var year=(typeof fiscalYearForDate==='function')?fiscalYearForDate(r.d):parseInt(String(r.d).slice(0,4),10);
  if(year!==2026&&year!==2027) return false;
  var st=faStatusOf(r);
  return !st||st==='Finance to Approve';
}
function faInMonth(r, year, mm){
  return typeof inFiscalMonthFilter==='function' && inFiscalMonthFilter(r, year, mm);
}
function faRoster(venue, year, mm){
  var rows=[];
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!faNamedShow(r)||(r.v||r.venue)!==venue) return;
    if(mm&&!faInMonth(r, year, mm)) return;
    var uid=(typeof ensureShowUid==='function')?ensureShowUid(r):((r.v||r.venue||'')+'|'+r.d+'|'+r.dj);
    rows.push({r:r, fee:faFee(r), uid:String(uid), status:faStatusOf(r)});
  });
  rows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:0); });
  return rows;
}
function faGuestPosition(venue, year, mm){
  var spend=0;
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!faNamedShow(r)||(r.v||r.venue)!==venue||!faInMonth(r, year, mm)) return;
    spend+=faFee(r);
  });
  var g=(typeof calGuestDjBudget==='function')?calGuestDjBudget(venue, year, mm):null;
  var budget=g&&g.amount!=null&&isFinite(+g.amount)?Math.round(+g.amount):null;
  return {spend:Math.round(spend), budget:budget};
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
function faDecide(uid, status){
  if(!financeCanApprove()||!uid) return;
  var r=faFindShow(uid);
  /* Test scope only. Every other month and location keeps its DJ status. */
  if(!r||!faInScope(r)) return;
  var prev=faStatusOf(r);
  if(prev&&prev!=='Finance to Approve'&&prev!=='Finance Approved'&&prev!=='Finance declined') return;
  if(typeof updateShowDjStatus==='function') updateShowDjStatus(-1, status, null, uid);
  renderFinanceApproval();
}
function faPrior(venue, r){
  var py=(typeof resolvePyFields==='function')?resolvePyFields(venue, r.d):null;
  var fee=py&&py.py_fee!=null&&isFinite(+py.py_fee)?+py.py_fee:null;
  var ret=null;
  if(py&&py.py_roi_a!=null&&isFinite(+py.py_roi_a)) ret=+py.py_roi_a;
  else if(fee>0&&py&&py.py_bs_a!=null&&isFinite(+py.py_bs_a)) ret=+py.py_bs_a/fee;
  return {dj:py&&py.py_dj?py.py_dj:'', fee:fee, ret:ret};
}
function faMoneyGap(spend, budget){
  if(budget==null) return 'Budget not set';
  var gap=spend-budget;
  if(gap>0.5) return 'Over by '+$k(gap);
  if(gap<-0.5) return 'Under by '+$k(-gap);
  return 'On budget';
}
function renderFinanceApproval(){
  var host=document.getElementById('financeBody');
  if(!host) return;
  initFinanceMarks();
  if(!financeCanApprove()){
    host.innerHTML='<div class="fa-empty">Finance Approval is not available for this sign-in.</div>';
    return;
  }
  var venue=faHere();
  var when=faWhen();
  var names=(typeof MN_FULL!=='undefined')?MN_FULL:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var sub=document.getElementById('pgSub');
  if(sub&&typeof curView!=='undefined'&&curView==='finance'){
    sub.innerHTML='<span>'+_escHtml(venue)+' · '+names[when.month]+' '+when.year+'</span>';
  }
  var monthRows=faRoster(venue, when.year, when.mm);
  var approved=0, pending=[];
  monthRows.forEach(function(item){
    if(item.status==='Finance Approved') approved++;
    else if(faNeedsApproval(item.r)) pending.push(item);
  });
  var pos=faGuestPosition(venue, when.year, when.mm);
  var ytdS=0, ytdB=0, hasB=false;
  var months=[];
  for(var mi=0;mi<12;mi++){
    var mm=(typeof fiscalMm==='function')?fiscalMm(mi):((mi<9?'0':'')+(mi+1));
    var cell=faGuestPosition(venue, when.year, mm);
    if(mi<=when.month){
      ytdS+=cell.spend;
      if(cell.budget!=null){ ytdB+=cell.budget; hasB=true; }
    }
    months.push(cell);
  }
  var html='<div class="fa-bar"><label>Location<select onchange="faSetVenue(this.value)">';
  faVenues().forEach(function(v){ html+='<option'+(v===venue?' selected':'')+'>'+_escHtml(v)+'</option>'; });
  html+='</select></label><label>Year<select onchange="faSetYear(this.value)">';
  [2026,2027].forEach(function(y){ html+='<option'+(y===when.year?' selected':'')+'>'+y+'</option>'; });
  html+='</select></label><label>Month<select onchange="faSetMonth(this.value)">';
  names.forEach(function(name, i){ html+='<option value="'+i+'"'+(i===when.month?' selected':'')+'>'+name+'</option>'; });
  html+='</select></label></div>';
  html+='<div class="fa-note">Green and red change DJ status only for Casa Neos Beach Club, April 2027. Every other status stays as it is.</div>';
  html+='<div class="fa-pos"><div><span>Budget</span><b>'+(pos.budget!=null?$k(pos.budget):'—')+'</b></div>'
    +'<div><span>Current position</span><b>'+$k(pos.spend)+'</b></div>'
    +'<div><span>'+names[when.month]+'</span><b>'+faMoneyGap(pos.spend, pos.budget)+'</b></div></div>';
  html+='<div class="fa-stats"><div class="fa-stat is-yes"><b>'+approved+'</b><span>Approved</span></div>'
    +'<button type="button" class="fa-stat is-wait'+(faPendingOpen?' on':'')+'" data-fa="pending"><b>'+pending.length+'</b><span>Pending approval</span></button></div>';
  html+='<div class="fa-break-hd">Guest DJ vs budget · '+when.year+'</div><div class="fa-months">';
  months.forEach(function(cell, i){
    html+='<button type="button" class="fa-m'+(i===when.month?' on':'')+'" data-month="'+i+'"><b>'+names[i]+'</b>'
      +'<span>'+$k(cell.spend)+' / '+(cell.budget!=null?$k(cell.budget):'—')+'</span></button>';
  });
  html+='</div><div class="fa-ytd"><b>YTD through '+names[when.month]+'</b><span>'+$k(ytdS)+' guest DJ / '+(hasB?$k(ytdB):'—')+' budget · '+faMoneyGap(ytdS, hasB?ytdB:null)+'</span></div>';
  if(faPendingOpen){
    html+='<div class="fa-break-hd">Pending approval · '+names[when.month]+' '+when.year+'</div>';
    if(!pending.length){
      html+='<div class="fa-empty">Nothing is waiting in this month.</div>';
    }else{
      html+='<table class="fa-tbl"><thead><tr><th>Date</th><th>DJ</th><th>Fee</th><th>BS target</th><th>Prior DJ</th><th>Prior fee</th><th>Return</th><th></th></tr></thead><tbody>';
      pending.forEach(function(item){
        var r=item.r;
        var tgt=(typeof showTargets==='function')?showTargets(r):null;
        var py=faPrior(venue, r);
        var uid=String(item.uid).replace(/"/g,'&quot;');
        var live=faInScope(r);
        html+='<tr><td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
          +'<td>'+_escHtml(r.dj||'')+'</td><td>'+$k(item.fee)+'</td>'
          +'<td>'+(tgt&&tgt.bs_m!=null?$k(tgt.bs_m):'—')+'</td>'
          +'<td>'+_escHtml(py.dj||'—')+'</td><td>'+(py.fee!=null?$k(py.fee):'—')+'</td>'
          +'<td>'+(py.ret!=null?((typeof rx==='function')?rx(py.ret):(py.ret).toFixed(1)+'x'):'—')+'</td>'
          +'<td class="fa-acts">'+(live
            ?'<button type="button" class="fa-yes" data-uid="'+uid+'" data-status="Finance Approved" title="Finance Approved">&#10003;</button>'
              +'<button type="button" class="fa-no" data-uid="'+uid+'" data-status="Finance declined" title="Finance declined">&#10007;</button>'
            :'<span class="fa-hold">View only</span>')+'</td></tr>';
      });
      html+='</tbody></table>';
    }
  }
  host.innerHTML=html;
  host.onclick=function(ev){
    var t=ev.target.closest?ev.target.closest('[data-fa],[data-month],[data-status]'):null;
    if(!t||!host.contains(t)) return;
    if(t.getAttribute('data-fa')==='pending'){ faTogglePending(); return; }
    if(t.hasAttribute('data-month')){ faSetMonth(t.getAttribute('data-month')); return; }
    if(t.getAttribute('data-status')) faDecide(t.getAttribute('data-uid'), t.getAttribute('data-status'));
  };
}
function faMonthKey(ds){
  if(typeof fiscalInfoForDate!=='function') return String(ds||'').slice(0,7);
  var info=fiscalInfoForDate(ds);
  return info.year+'-'+info.mm;
}
function faMonthLabel(key){
  var parts=String(key||'').split('-');
  var mi=(parseInt(parts[1],10)||1)-1;
  var name=(typeof MN_FULL!=='undefined')?MN_FULL[mi]:parts[1];
  return name+' '+parts[0];
}
function faMark(uid, mark){
  if(!financeCanApprove() || !uid) return;
  var next=FINANCE_MARKS[uid]===mark?'':mark;
  if(next) FINANCE_MARKS[uid]=next;
  else delete FINANCE_MARKS[uid];
  if(window._fbDb){
    try{ window._fbDb.ref('rdg/financeMarks/'+uid).set(next||null); }catch(e){}
  }
  renderFinanceApproval();
}
function initFinanceMarks(){
  if(window._financeMarksOn || !window._fbDb) return;
  window._financeMarksOn=true;
  window._fbDb.ref('rdg/financeMarks').on('value', function(snap){
    FINANCE_MARKS=snap.val()||{};
    if(typeof curView!=='undefined' && curView==='finance') renderFinanceApproval();
  });
}
try{ initFinanceMarks(); }catch(eFa){}
/* Sidebar is built during boot, before this file loads. Rebuild so Matthias and Greg keep the item. */
try{ if(typeof buildSidebar==='function') buildSidebar(); }catch(eSb){}
