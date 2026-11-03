/* Finance Approval. April 2027 at Casa Neos Beach Club is the only calendar
   this status is offered on. The page itself lists every Finance to Approve show. */
function unlockFinance(){
  try{ if(sessionStorage.getItem('rdg_finance_unlocked')==='1') return true; }catch(e){}
  var pw=prompt('Finance Approval password:');
  if(pw!=='tk'){ if(pw!==null) alert('Incorrect password.'); return false; }
  try{ sessionStorage.setItem('rdg_finance_unlocked','1'); }catch(e2){}
  return true;
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
function faQueue(){
  var rows=[];
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r, idx){
    if(!r||r._s==='empty'||!r.d) return;
    var fee=faFee(r);
    if(!(fee>5000)) return;
    var st=(typeof getShowDjStatus==='function')?getShowDjStatus(r, r.d):r.djStatus;
    if(st!=='Finance to Approve') return;
    rows.push({r:r, idx:idx, fee:fee, uid:(typeof ensureShowUid==='function')?ensureShowUid(r):''});
  });
  rows.sort(function(a,b){
    var va=(a.r.v||a.r.venue)||'', vb=(b.r.v||b.r.venue)||'';
    if(va<vb) return -1;
    if(va>vb) return 1;
    return a.r.d<b.r.d?-1:(a.r.d>b.r.d?1:0);
  });
  return rows;
}
function faDecide(uid, status){
  var hit=null;
  (SCHED||[]).forEach(function(r, idx){
    if(hit||!r) return;
    var id=(typeof ensureShowUid==='function')?ensureShowUid(r):'';
    if(String(id)===String(uid)) hit={r:r, idx:idx};
  });
  if(!hit||typeof updateShowDjStatus!=='function') return;
  updateShowDjStatus(hit.idx, status, null, uid);
  renderFinanceApproval();
}
function renderFinanceApproval(){
  var host=document.getElementById('financeBody');
  if(!host) return;
  var rows=faQueue();
  if(!rows.length){
    host.innerHTML='<div class="fa-empty">No performances over $5,000 are waiting on Finance to Approve.</div>';
    return;
  }
  var html='', venue='';
  rows.forEach(function(item){
    var r=item.r, v=r.v||r.venue||'';
    if(v!==venue){
      if(venue) html+='</tbody></table></section>';
      venue=v;
      html+='<section class="fa-loc"><h3>'+_escHtml(v)+'</h3><table class="fa-tbl"><thead><tr>'
        +'<th>Date</th><th>DJ</th><th>Fee</th><th>ROI target</th><th>BS target</th><th>Month vs budget</th><th></th></tr></thead><tbody>';
    }
    var tgt=(typeof showTargets==='function')?showTargets(r):null;
    var roi=tgt&&tgt.roi_t!=null?((typeof rx==='function')?rx(tgt.roi_t):String(tgt.roi_t)):'—';
    var bs=tgt&&tgt.bs_m!=null?$k(tgt.bs_m):'—';
    var uid=String(item.uid).replace(/"/g,'&quot;');
    html+='<tr><td>'+_escHtml(typeof _bpDay==='function'?_bpDay(r.d):r.d)+'</td>'
      +'<td>'+_escHtml(r.dj||'TBD')+'</td>'
      +'<td>'+$k(item.fee)+'</td>'
      +'<td>'+roi+'</td>'
      +'<td>'+bs+'</td>'
      +'<td>'+_escHtml(faMonthNote(r))+'</td>'
      +'<td class="fa-acts"><button type="button" class="fa-yes" data-uid="'+uid+'" data-st="Confirmed" title="Confirm">&#10003;</button>'
      +'<button type="button" class="fa-no" data-uid="'+uid+'" data-st="Refused" title="Refuse">&#10007;</button></td></tr>';
  });
  if(venue) html+='</tbody></table></section>';
  host.innerHTML=html;
  host.onclick=function(ev){
    var btn=ev.target.closest?ev.target.closest('button[data-uid]'):null;
    if(!btn) return;
    faDecide(btn.getAttribute('data-uid'), btn.getAttribute('data-st'));
  };
}
