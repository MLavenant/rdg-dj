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
  var opts=['Offer sent','Hold 1','Finance to Approve'];
  if(!(faFee(show)>5000)) opts.push('Confirmed');
  if(current==='Confirmed'&&opts.indexOf('Confirmed')<0) opts.push('Confirmed');
  if(current==='Refused') opts.push('Refused');
  return opts;
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
  /* Own filter. Never curV, so the guest calendar stays where it was. */
  if(faVenues().indexOf(v)<0) return;
  faVenue=v;
  renderFinanceApproval();
}
function faNeedsApproval(r){
  if(!r||!r.d) return false;
  var year=(typeof fiscalYearForDate==='function')?fiscalYearForDate(r.d):parseInt(String(r.d).slice(0,4),10);
  if(year!==2026&&year!==2027) return false;
  var st=(typeof getShowDjStatus==='function')?getShowDjStatus(r):(r.djStatus||null);
  return !st||String(st)==='Finance to Approve';
}
function faShows(venue){
  var rows=[];
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!r||r._s==='empty'||!r.d) return;
    if((r.v||r.venue)!==venue) return;
    if(!faNeedsApproval(r)) return;
    var dj=String(r.dj||'').trim();
    if(!dj||/^tbd$/i.test(dj)) return;
    var uid=(typeof ensureShowUid==='function')?ensureShowUid(r):((r.v||r.venue||'')+'|'+r.d+'|'+dj);
    rows.push({r:r, fee:faFee(r), uid:String(uid), mark:FINANCE_MARKS[uid]||''});
  });
  rows.sort(function(a,b){ return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:0); });
  return rows;
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
function renderFinanceApproval(){
  var host=document.getElementById('financeBody');
  if(!host) return;
  initFinanceMarks();
  if(!financeCanApprove()){
    host.innerHTML='<div class="fa-empty">Finance Approval is not available for this sign-in.</div>';
    return;
  }
  var venue=faHere();
  var sub=document.getElementById('pgSub');
  if(sub&&typeof curView!=='undefined'&&curView==='finance') sub.innerHTML='<span>'+_escHtml(venue)+' · 2026 and 2027 · Not set or Finance to Approve</span>';
  var rows=faShows(venue);
  var approved=0, pending=[];
  rows.forEach(function(item){
    if(item.mark==='yes') approved++;
    else if(item.mark!=='no') pending.push(item);
  });
  var html='<div class="fa-bar"><label>Location<select onchange="faSetVenue(this.value)">';
  faVenues().forEach(function(v){
    html+='<option'+(v===venue?' selected':'')+'>'+_escHtml(v)+'</option>';
  });
  html+='</select></label></div>';
  html+='<div class="fa-stats"><div class="fa-stat is-yes"><b>'+approved+'</b><span>Approved</span></div>'
    +'<div class="fa-stat is-wait"><b>'+pending.length+'</b><span>Pending approval</span></div></div>';
  html+='<div class="fa-break-hd">Pending approval by month</div>';
  if(!pending.length){
    html+='<div class="fa-empty">Nothing is waiting for approval at this location.</div>';
  }else{
    var groups={}, order=[];
    pending.forEach(function(item){
      var key=faMonthKey(item.r.d);
      if(!groups[key]){ groups[key]={items:[]}; order.push(key); }
      groups[key].items.push(item);
    });
    order.sort();
    order.forEach(function(key){
      var items=groups[key].items;
      html+='<section class="fa-loc"><h3>'+_escHtml(faMonthLabel(key))+'<em>'+items.length+' pending</em></h3>'
        +'<table class="fa-tbl"><thead><tr><th>Date</th><th>DJ</th><th>Fee</th><th></th></tr></thead><tbody>';
      items.forEach(function(item){
        var r=item.r;
        var uid=String(item.uid).replace(/"/g,'&quot;');
        html+='<tr><td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
          +'<td>'+_escHtml(r.dj||'')+'</td><td>'+$k(item.fee)+'</td>'
          +'<td class="fa-acts"><button type="button" class="fa-yes" data-uid="'+uid+'" data-mark="yes" title="Approve">&#10003;</button></td></tr>';
      });
      html+='</tbody></table></section>';
    });
  }
  host.innerHTML=html;
  host.onclick=function(ev){
    var btn=ev.target.closest?ev.target.closest('button[data-uid]'):null;
    if(!btn) return;
    faMark(btn.getAttribute('data-uid'), btn.getAttribute('data-mark'));
  };
}
try{ initFinanceMarks(); }catch(eFa){}
/* Sidebar is built during boot, before this file loads. Rebuild so Matthias and Greg keep the item. */
try{ if(typeof buildSidebar==='function') buildSidebar(); }catch(eSb){}
