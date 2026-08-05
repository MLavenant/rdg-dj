function renderAccounting(){
  fillAcctVenueSelect();
  var view=document.getElementById('view-accounting');
  if(view){
    view.classList.toggle('acct-others-mode', acctSubTab==='others');
    view.classList.remove('acct-guest-mode');
  }
  var tabGuest=document.getElementById('acctTabGuest');
  var tabOthers=document.getElementById('acctTabOthers');
  if(tabGuest) tabGuest.classList.toggle('on', acctSubTab==='guest');
  if(tabOthers) tabOthers.classList.toggle('on', acctSubTab==='others');
  var addWrap=document.getElementById('acctAddShowWrap');
  if(addWrap) addWrap.style.display=(acctSubTab==='guest' && !isAccountingOnlyVenue(curAcctV))?'':'none';

  var yr=curYr, mo=acctM;
  var mm=(mo+1<10?'0':'')+(mo+1);
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  var days=fiscalDates.length;
  document.getElementById('acctHd').textContent=MN_FULL[mo]+' '+yr+' ('+fiscalPeriodShortRange(yr, mo)+') - '+curAcctV;
  updateTopbarLogo(curAcctV||curV);

  var sl='<div class="month-slider" id="acctSliderInner">';
  for(var mi=0;mi<12;mi++) sl+='<button class="ms-btn'+(mi===mo?' ms-on':'')+'" id="asbtn'+mi+'" onclick="jumpAcctMonth('+mi+')">'+ MN_SH[mi]+'</button>';
  sl+='</div>';
  document.getElementById('acctSlider').innerHTML=sl;
  setTimeout(function(){var b=document.getElementById('asbtn'+mo);if(b&&b.scrollIntoView)b.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});},60);

  if(acctSubTab==='others'){
    renderAccountingOthers(yr, mo, mm, days);
    return;
  }
  renderAccountingGuest(yr, mo, mm, days);
}

function renderAccountingOthers(yr, mo, mm, days){
  document.getElementById('acctSummary').innerHTML='';

  var catTotals={};
  ACCT_OTHER_CATS.forEach(function(c){ catTotals[c.id]=0; });
  var monthTotal=0;
  var fiscalDates=datesInFiscalPeriod(yr, mo);

  var h='<div class="acct-others-wrap"><table class="sched-tbl acct-tbl acct-others-tbl"><thead>';
  h+='<tr><th class="sc-date" rowspan="2">Date</th>';
  ACCT_OTHER_CATS.forEach(function(c){
    h+='<th class="acct-others-cat" colspan="2">'+c.label+'</th>';
  });
  h+='<th class="sc-num" rowspan="2">Day Total</th></tr><tr>';
  ACCT_OTHER_CATS.forEach(function(){
    h+='<th class="acct-others-sub">Name</th><th class="acct-others-sub">Cost</th>';
  });
  h+='</tr></thead><tbody>';

  for(var adi=0; adi<fiscalDates.length; adi++){
    var ds=fiscalDates[adi];
    var dObj=_parseYmd(ds);
    var day=dObj.getDate();
    var dow=dObj.getDay();
    var isToday=ds===TODAY;
    var dc='sc-row';
    if(isToday) dc+=' sc-today';
    else if(dow===6) dc+=' sc-sat';
    else if(dow===0) dc+=' sc-sun';
    else if(dow===5) dc+=' sc-fri';
    else if(dow===3||dow===4) dc+=' sc-wedthu';

    var dayTot=0;
    h+='<tr class="'+dc+'">';
    h+='<td class="sc-date-cell">'+DOW_FULL[dow]+', '+MN_FULL[dObj.getMonth()]+' '+day+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
    ACCT_OTHER_CATS.forEach(function(c){
      var cell=getOthersCell(ds, c.id);
      var cost=cell.cost;
      if(cost!=null){ dayTot+=cost; catTotals[c.id]+=cost; monthTotal+=cost; }
      h+='<td class="acct-others-cell"><input class="acct-others-name" data-ds="'+ds+'" data-cat="'+c.id+'" data-field="name" value="'+(cell.name||'').replace(/"/g,'&quot;')+'" placeholder="Name"></td>';
      h+='<td class="acct-others-cell"><input type="number" class="acct-others-cost" data-ds="'+ds+'" data-cat="'+c.id+'" data-field="cost" value="'+(cost!=null?cost:'')+'" placeholder="$"></td>';
    });
    h+='<td class="sc-num acct-others-total">'+(dayTot?$k(dayTot):'-')+'</td>';
    h+='</tr>';
  }

  h+='<tr class="acct-total-row"><td><b>MONTH TOTAL</b></td>';
  ACCT_OTHER_CATS.forEach(function(c){
    h+='<td></td><td class="sc-num"><b>'+$k(catTotals[c.id]||null)+'</b></td>';
  });
  h+='<td class="sc-num"><b>'+$k(monthTotal||null)+'</b></td></tr>';
  h+='</tbody></table></div>';

  document.getElementById('acctBody').innerHTML=h;
  document.querySelectorAll('.acct-others-name, .acct-others-cost').forEach(function(inp){
    inp.addEventListener('change', function(){
      setOthersField(inp.dataset.ds, inp.dataset.cat, inp.dataset.field, inp.value);
      renderAccounting();
    });
  });
  requestAnimationFrame(fitAccountingOthersRows);
}

function fitAccountingOthersRows(){
  var body=document.getElementById('acctBody');
  if(!body||acctSubTab!=='others') return;
  var rows=body.querySelectorAll('.acct-others-tbl tbody tr').length||32;
  var available=Math.max(300,body.clientHeight);
  var headH=14;
  var rowH=Math.max(9,Math.floor(((available-(headH*2)-4)/rows)*10)/10);
  var font=Math.max(5.8,Math.min(8,rowH*.48));
  var inputFont=Math.max(5.8,Math.min(7.5,font));
  var control=Math.max(8,Math.min(15,rowH-1));
  body.style.setProperty('--acct-others-row-h',rowH+'px');
  body.style.setProperty('--acct-others-font',font+'px');
  body.style.setProperty('--acct-others-input-font',inputFont+'px');
  body.style.setProperty('--acct-others-control-h',control+'px');
  body.style.setProperty('--acct-others-head-h',headH+'px');
  body.style.setProperty('--acct-others-head-font','6.5px');
  if(!window._acctOthersResizeBound){
    window._acctOthersResizeBound=true;
    window.addEventListener('resize',function(){
      if(curView==='accounting'&&acctSubTab==='others') fitAccountingOthersRows();
    });
  }
}

function renderAccountingGuest(yr, mo, mm, days){
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  days=fiscalDates.length;
  var showMap={};
  SCHED.forEach(function(r){
    if((r.v||r.venue)!==curAcctV||r._s==='empty') return;
    if(!r.d||!dateInFiscalPeriod(r.d, yr, mo)) return;
    if(!showMap[r.d]) showMap[r.d]=[];
    showMap[r.d].push(r);
  });

  var statusCounts={};
  ACCT_STATUS_OPTIONS.forEach(function(s){ statusCounts[s]=0; });
  statusCounts['Not set']=0;
  var totalShowsThisMonth=0;
  fiscalDates.forEach(function(tds){
    var tshows=showMap[tds]||[];
    var tacct=getAcct(tds);
    var apSt=tacct.apStatus||null;
    tshows.forEach(function(r){
      totalShowsThisMonth++;
      var djSt=getShowDjStatus(r,tds)||'Not set';
      statusCounts[djSt]=(statusCounts[djSt]||0)+1;
      if(apSt) statusCounts[apSt]=(statusCounts[apSt]||0)+1;
    });
  });
  var summaryHtml='<div class="acct-summary">';
  summaryHtml+='<div class="acct-sum-item'+(!_acctStatusFilter?' acct-sum-active':'')+'" data-filter="__all__"><b>'+totalShowsThisMonth+'</b><span>Shows this month</span></div>';
  ACCT_STATUS_OPTIONS.concat(['Not set']).forEach(function(s){
    if(!statusCounts[s]) return;
    var cls=acctStatusClass(s==='Not set'?null:s);
    var active=_acctStatusFilter===s;
    summaryHtml+='<div class="acct-sum-item '+cls+(active?' acct-sum-active':'')+'" data-filter="'+s+'"><b>'+statusCounts[s]+'</b><span>'+s+'</span></div>';
  });
  summaryHtml+='</div>';
  document.getElementById('acctSummary').innerHTML=summaryHtml;
  document.querySelectorAll('.acct-sum-item').forEach(function(tile){
    tile.addEventListener('click',function(){
      var f=tile.dataset.filter;
      setAcctStatusFilter(f==='__all__'?null:f);
    });
  });

  var h='<table class="sched-tbl acct-tbl"><thead><tr>';
  h+='<th class="sc-date">Date</th>';
  h+='<th class="sc-ev">Event</th>';
  h+='<th class="sc-dj">Guest DJ</th>';
  h+='<th class="sc-num acct-col-fee">DJ Fee</th>';
  h+='<th class="sc-num acct-col-target">BS Target</th>';
  h+='<th class="sc-num" style="background:#eef7ee">BS Actual</th>';
  h+='<th class="acct-status-hd">DJ Status</th>';
  h+='<th class="acct-status-hd">AP Status</th>';
  h+='<th class="acct-doc-hd">Contract</th>';
  h+='<th class="acct-doc-hd">Invoice</th>';
  h+='<th class="sc-act-r" title="R365">R365</th>';
  h+='<th class="sc-act"></th>';
  h+='</tr></thead><tbody>';

  var totDJ=0, totBSM=0, totBSA=0;
  var anyFilterMatch=false;

  for(var adi=0;adi<fiscalDates.length;adi++){
    var ds=fiscalDates[adi];
    var dObj=_parseYmd(ds);
    var dow=dObj.getDay();
    var isToday=ds===TODAY;
    var shows=showMap[ds]||[];
    var evLabel=daySpecialLabel(ds)||'';
    var acct=getAcct(ds);

    /* DJ filters are per-show; AP filters remain date-level (docs/workflow). */
    if(_acctStatusFilter){
      var apFilter=ACCT_AP_STATUS.indexOf(_acctStatusFilter)>=0;
      if(apFilter){
        if((acct.apStatus||'')!==_acctStatusFilter) continue;
      } else {
        shows=shows.filter(function(r){
          return (getShowDjStatus(r, ds)||'Not set')===_acctStatusFilter;
        });
        if(!shows.length) continue;
      }
    }

    var dc='sc-row';
    if(isToday) dc+=' sc-today';
    else if(dow===6) dc+=' sc-sat';
    else if(dow===0) dc+=' sc-sun';
    else if(dow===5) dc+=' sc-fri';
    else if(dow===3||dow===4) dc+=' sc-wedthu';
    if(shows.length) dc+=' sc-has-show';
    if(!shows.length) dc+=' sc-noshow';

    var dateStr=DOW_FULL[dow]+', '+MN_FULL[dObj.getMonth()]+' '+dObj.getDate()+', '+dObj.getFullYear();

    if(!shows.length){
      if(_acctStatusFilter) continue;
      h+='<tr class="'+dc+'">';
      h+='<td class="sc-date-cell">'+dateStr+'</td>';
      h+='<td class="sc-ev-cell">'+_evLabelHtml(evLabel, ds)+'</td>';
      h+='<td colspan="4" class="sc-empty-day"></td>';
      h+='<td></td><td></td><td></td><td></td><td></td>';
      h+='<td class="sc-act">'+(isAccountingOnlyVenue(curAcctV)?'':'<button class="sc-add-btn" data-ds="'+ds+'" data-action="add">+</button>')+'</td>';
      h+='</tr>';
      continue;
    }
    anyFilterMatch=true;

    var djFeeTotal=shows.reduce(function(s,r){return s+(r.fee||r.cost||0);},0);
    totDJ+=djFeeTotal;
    totBSM+=shows.reduce(function(s,r){return s+(showTargets(r).bs_m||0);},0);
    totBSA+=shows.reduce(function(s,r){return s+(r.bs_a||0);},0);

    var nrows=Math.max(1,shows.length);
    shows.forEach(function(r,ri){
      var nm=djLabel(r.dj);
      var idx=SCHED.indexOf(r);
      var tgt=showTargets(r);
      var bsM=tgt.bs_m;
      var bsCls=perfTone(r.bs_a, bsM, (r.fee||r.cost), r.roi_a, tgt.roi_t);
      var feeCls=feeTierClass(r.fee||r.cost);
      var feeRowCls=feeRowClass(r.fee||r.cost);

      h+='<tr class="'+dc+(feeRowCls?' '+feeRowCls:'')+'">';
      if(ri===0){
        h+='<td class="sc-date-cell" rowspan="'+nrows+'">'+dateStr
          +(isToday?'<span class="sc-today-badge"> Today</span>':'')
          +'</td>';
        h+='<td class="sc-ev-cell" rowspan="'+nrows+'">'+_evLabelHtml(evLabel, ds)+'</td>';
      }
      h+='<td class="sc-dj-cell"><b class="'+bsCls+'">'+nm+'</b>'+(r.note?'<div class="dj-note-badge">&#128221; '+r.note.replace(/</g,'&lt;')+'</div>':'')+'</td>';
      h+='<td class="sc-num acct-col-fee fee-cell '+(feeCls||'')+'">'+$k(r.fee||r.cost||null)+'</td>';
      h+='<td class="sc-num acct-col-target">'+$k(bsM)+'</td>';
      h+='<td class="sc-num '+bsCls+'"><b>'+$k(r.bs_a)+'</b></td>';
      var djSt=getShowDjStatus(r, ds)||'';
      var showUid=ensureShowUid(r);
      h+='<td class="acct-status-cell"><div class="acct-status-wrap">'
        +_djStatusSelectHtml(djSt, 'data-ds="'+ds+'" data-idx="'+idx+'" data-uid="'+showUid+'" data-action="djStatus"')
        +'</div></td>';
      if(ri===0){
        var apSt=acct.apStatus||'';
        var lastHint=acct.updatedBy?('Last: '+acct.updatedBy+' \u00b7 '+_fmtAcctWhen(acct.updatedAt)):'History';
        h+='<td class="acct-status-cell" rowspan="'+nrows+'"><div class="acct-status-wrap">'
          +'<select class="acct-status-sel '+acctStatusClass(apSt||null)+'" data-ds="'+ds+'" data-action="apStatus" title="AP Status">'
          +'<option value=""'+(!apSt?' selected':'')+'>Not set</option>'
          +ACCT_AP_STATUS.map(function(opt){return '<option value="'+opt+'"'+(apSt===opt?' selected':'')+'>'+opt+'</option>';}).join('')
          +'</select>'
          +'<div class="acct-last-edit" data-ds="'+ds+'" data-action="acctHist" title="View edit history">'+lastHint+'</div>'
          +'</div></td>';
        h+='<td class="acct-doc-cell" rowspan="'+nrows+'">'+_acctDocDropHtml(ds,'contract',acct.contracts)+'</td>';
        h+='<td class="acct-doc-cell" rowspan="'+nrows+'">'+_acctDocDropHtml(ds,'invoice',acct.invoices)+'</td>';
        h+='<td class="sc-act-r" rowspan="'+nrows+'"><label class="r365-wrap"><input type="checkbox" class="r365-chk" data-ds="'+ds+'" data-action="r365" '+(acct.r365?'checked':'')+'><span class="r365-box">R</span></label></td>';
      }
      h+='<td class="sc-act"><button class="sc-edit-btn" data-idx="'+idx+'" data-uid="'+showUid+'" data-action="edit">&#9998;</button></td>';
      h+='</tr>';
    });
  }

  if(_acctStatusFilter && !anyFilterMatch){
    h+='<tr><td colspan="12" class="sc-empty-day" style="text-align:center;padding:16px">No shows with status "'+_acctStatusFilter+'" this month.</td></tr>';
  }

  h+='<tr class="acct-total-row">';
  h+='<td><b>'+(_acctStatusFilter?'FILTERED':'MONTH')+' TOTAL</b></td><td></td><td></td>';
  h+='<td class="sc-num acct-col-fee"><b>'+$k(totDJ)+'</b></td>';
  h+='<td class="sc-num acct-col-target">'+$k(totBSM)+'</td>';
  h+='<td class="sc-num '+(totBSA&&totBSM?(totBSA>=totBSM?'hit':'low'):'')+'"><b>'+$k(totBSA)+'</b></td>';
  h+='<td></td><td></td><td></td><td></td><td></td><td></td>';
  h+='</tr></tbody></table>';

  document.getElementById('acctBody').innerHTML=h;
  wireAccountingEvents();
}



/*                                                               
   EVENT MODAL   simplified (venue/date/dj/fee only)
                                                                  */
