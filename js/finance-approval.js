/* Finance Approval. The status dropdown still offers Finance to Approve only
   for Casa Neos Beach Club in April 2027. The page lists every performance
   on the calendar month and is visible only to the approvers listed here. */
var FINANCE_APPROVERS={
  'matthias@rivieradininggroup.com':1,
  'greg@rivieradininggroup.com':1,
  'takuma@rivieradininggroup.com':1
};
var FINANCE_MARKS={};
function financeCanApprove(){
  return typeof signInCurrentEmail==='function' && !!FINANCE_APPROVERS[signInCurrentEmail()];
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
function faShows(){
  var rows=[];
  var dates=null;
  if(typeof datesInFiscalPeriod==='function' && typeof curYr!=='undefined'){
    dates={};
    datesInFiscalPeriod(curYr, curM).forEach(function(d){ dates[d]=1; });
  }
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!r||r._s==='empty'||!r.d) return;
    var dj=String(r.dj||'').trim();
    if(!dj || /^tbd$/i.test(dj)) return;
    if(dates && !dates[r.d]) return;
    var uid=(typeof ensureShowUid==='function')?ensureShowUid(r):((r.v||r.venue||'')+'|'+r.d+'|'+dj);
    rows.push({r:r, fee:faFee(r), uid:String(uid), mark:FINANCE_MARKS[uid]||''});
  });
  rows.sort(function(a,b){
    var va=(a.r.v||a.r.venue)||'', vb=(b.r.v||b.r.venue)||'';
    if(va<vb) return -1;
    if(va>vb) return 1;
    return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:0);
  });
  return rows;
}
function financeJumpMonth(m){
  curM=m;
  renderFinanceApproval();
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
  var mo=typeof curM==='undefined'?0:curM;
  var html='<div class="month-slider">';
  for(var mi=0;mi<12;mi++){
    html+='<button type="button" class="ms-btn'+(mi===mo?' ms-on':'')+'" data-month="'+mi+'">'+(typeof MN_SH!=='undefined'?MN_SH[mi]:mi)+'</button>';
  }
  html+='</div>';
  var rows=faShows();
  if(!rows.length){
    html+='<div class="fa-empty">No performances on this month of the calendar.</div>';
    host.innerHTML=html;
  }else{
    var venue='';
    rows.forEach(function(item){
      var r=item.r, v=r.v||r.venue||'';
      if(v!==venue){
        if(venue) html+='</tbody></table></section>';
        venue=v;
        html+='<section class="fa-loc"><h3>'+_escHtml(v)+'</h3><table class="fa-tbl"><thead><tr>'
          +'<th>Date</th><th>DJ</th><th>Fee</th><th>ROI target</th><th>BS target</th><th></th></tr></thead><tbody>';
      }
      var tgt=(typeof showTargets==='function')?showTargets(r):null;
      var roi=tgt&&tgt.roi_t!=null?((typeof rx==='function')?rx(tgt.roi_t):String(tgt.roi_t)):'—';
      var bs=tgt&&tgt.bs_m!=null?$k(tgt.bs_m):'—';
      var uid=String(item.uid).replace(/"/g,'&quot;');
      var tone=item.mark==='yes'?' fa-yes':(item.mark==='no'?' fa-no':'');
      html+='<tr class="'+tone.trim()+'"><td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
        +'<td>'+_escHtml(r.dj||'')+'</td>'
        +'<td>'+$k(item.fee)+'</td>'
        +'<td>'+roi+'</td>'
        +'<td>'+bs+'</td>'
        +'<td class="fa-acts"><button type="button" class="fa-yes'+(item.mark==='yes'?' on':'')+'" data-uid="'+uid+'" data-mark="yes" title="Approve">&#10003;</button>'
        +'<button type="button" class="fa-no'+(item.mark==='no'?' on':'')+'" data-uid="'+uid+'" data-mark="no" title="Not approved">&#10007;</button></td></tr>';
    });
    if(venue) html+='</tbody></table></section>';
    host.innerHTML=html;
  }
  host.onclick=function(ev){
    var month=ev.target.closest?ev.target.closest('button[data-month]'):null;
    if(month){ financeJumpMonth(+month.getAttribute('data-month')); return; }
    var btn=ev.target.closest?ev.target.closest('button[data-uid]'):null;
    if(!btn) return;
    faMark(btn.getAttribute('data-uid'), btn.getAttribute('data-mark'));
  };
}
try{ initFinanceMarks(); }catch(eFa){}
