function renderCal(){
  /* Never rebuild the table while DJ Status menu is open — Firebase echoes
     and soft refreshes used to wipe the <select> mid-pick. */
  if(typeof _calUiBusy==='function' && _calUiBusy()){
    if(window._calPendingRefresh!=='go') window._calPendingRefresh='cal';
    return;
  }
  if(typeof window._applySchedGuardsToLiveSched==='function') window._applySchedGuardsToLiveSched();
  applyVenueTint();
  var yr=curYr, mo=curM;
  var mm=(mo+1<10?'0':'')+(mo+1);
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  var days=fiscalDates.length;
  var mName=MN_FULL[mo]+' '+yr;
  document.getElementById('calHd').textContent=mName+' ('+fiscalPeriodShortRange(yr, mo)+')';
  /* toggle button states */
  var lb=document.getElementById('calViewListBtn'), gb=document.getElementById('calViewGridBtn'), yb=document.getElementById('calViewYearBtn');
  if(lb&&gb&&yb){ lb.classList.toggle('on',calViewMode==='list'); gb.classList.toggle('on',calViewMode==='grid'); yb.classList.toggle('on',calViewMode==='year'); }

  /* render month slider with auto-scroll */
  var sliderHtml='<div class="month-slider" id="calSliderInner">';
  for(var mi=0;mi<12;mi++){
    sliderHtml+='<button class="ms-btn'+(mi===mo?' ms-on':'')+'" id="msbtn'+mi+'" onclick="jumpToMonth('+mi+')">'
      +MN_SH[mi]+'</button>';
  }
  sliderHtml+='</div>';
  document.getElementById('monthSlider').innerHTML=sliderHtml;
  /* scroll active into view */
  setTimeout(function(){
    var btn=document.getElementById('msbtn'+mo);
    if(!btn||typeof btn.scrollIntoView!=='function') return;
    try{ btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); }
    catch(eScroll){ try{ btn.scrollIntoView(true); }catch(e2){} }
  },50);

  /* index shows by fiscal period dates (shared for both views) */
  var showMap={};
  SCHED.forEach(function(r){
    if((r.v||r.venue)!==curV||r._s==='empty') return;
    if(!r.d||!dateInFiscalPeriod(r.d, yr, mo)) return;
    if(!showMap[r.d]) showMap[r.d]=[];
    showMap[r.d].push(r);
  });

  if(calViewMode==='year'){ document.getElementById('view-calendar').classList.remove('cal-list-fit'); renderCalYear(); return; }
  if(calViewMode==='grid'){ document.getElementById('view-calendar').classList.remove('cal-list-fit'); renderCalGrid(yr,mo,mm,days,showMap); return; }

  var isMobileLayout=document.body.classList.contains('mobile-mode');
  var calEl=document.getElementById('view-calendar');
  if(isMobileLayout) calEl.classList.remove('cal-list-fit'); else calEl.classList.add('cal-list-fit');
  renderCalMonthRecap(yr, mo, mm, showMap);
  renderCalPriorYearRecap(yr, mm);

  var pyMap=buildPyMapForMonth(curV, yr, mm);
  var pyBlank={py_dj:null,py_fee:null,py_bs_m:null,py_bs_a:null,py_roi_t:null,py_roi_a:null,py_beat:null};

  var h='<table class="sched-tbl"><thead><tr>';
  h+='<th class="sc-ev">Event</th>';
  h+='<th class="sc-date">Date</th>';
  h+='<th class="sc-dj">DJ Guest</th>';
  h+='<th class="acct-status-hd sc-dj-st">DJ Status</th>';
  h+='<th class="sc-vip" title="VIP team notes">VIP</th>';
  h+='<th class="sc-3d" title="Open 3D floor plan with tier pricing">3D</th>';
  h+='<th class="sc-fee">Fee</th>';
  h+='<th class="sc-num">BS Target</th>';
  h+='<th class="sc-num">BS Actual</th>';
  h+='<th class="sc-num">ROI Tgt</th>';
  h+='<th class="sc-num">ROI Act</th>';
  h+='<th class="sc-sep" title="Prior-year comparison"></th>';
  h+='<th class="sc-py sc-py-hd" title="Same date last year — not a second booking">Last year DJ</th>';
  h+='<th class="sc-num" title="Prior-year fee">LY Fee</th>';
  h+='<th class="sc-num" title="Prior-year BS target">LY BS Tgt</th>';
  h+='<th class="sc-num" title="Prior-year BS actual">LY BS Act</th>';
  h+='<th class="sc-num" title="Prior-year ROI target">LY ROI Tgt</th>';
  h+='<th class="sc-num" title="Prior-year ROI actual">LY ROI Act</th>';
  h+='<th class="sc-act"></th>';
  h+='</tr></thead><tbody>';

  for(var di=0;di<fiscalDates.length;di++){
    var ds=fiscalDates[di];
    var dObj=_parseYmd(ds);
    var dow=dObj.getDay();
    var isToday=ds===TODAY;
    var shows=showMap[ds]||[];
    var evLabel=daySpecialLabel(ds)||'';

    var dc='sc-row';
    if(isToday)          dc+=' sc-today';
    else if(dow===6)     dc+=' sc-sat';
    else if(dow===0)     dc+=' sc-sun';
    else if(dow===5)     dc+=' sc-fri';
    else if(dow===3||dow===4) dc+=' sc-wedthu';
    if(shows.length)     dc+=' sc-has-show';
    if(!shows.length)    dc+=' sc-noshow';

    var dateStr=DOW_FULL[dow]+', '+MN_FULL[dObj.getMonth()]+' '+dObj.getDate()+', '+dObj.getFullYear();
    var nrows=Math.max(1,shows.length);

    if(!shows.length){
      h+='<tr class="'+dc+'" data-cal-ds="'+ds+'" ondragover="swDragOver(event)" ondragleave="swDragLeave(event)" ondrop="swDropOnDate(event,\''+ds+'\')">';
      h+='<td class="sc-ev-cell">'+_evLabelHtml(evLabel, ds)+'</td>';
      h+='<td class="sc-date-cell">'+dateStr+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
      h+='<td colspan="9" class="sc-empty-day"><button type="button" class="sc-add-inline" data-action="addShow" data-ds="'+ds+'">+ Add show</button></td>';
      h+='<td class="sc-sep"></td>';
      /* Show prior-year match on empty days so planners still see last year's lineup */
      h+=_pyCellsHtml(pyMap[ds]||pyBlank);
      h+='<td class="sc-act"><button type="button" class="sc-add-btn" data-action="addShow" data-ds="'+ds+'" title="Add show">+</button></td>';
      h+='</tr>';
    } else {
      shows.forEach(function(r,ri){
        var st   = r._s||'nd';
        var gLive=(typeof window._guardForShow==='function')?window._guardForShow(r):null;
        var djShow=(gLive && gLive.dj!=null && String(gLive.dj).trim()!=='')?gLive.dj:r.dj;
        var nm   = djLabel(djShow);
        var idx  = SCHED.indexOf(r);
        var py = (ri===0 ? (pyMap[ds]||pyBlank) : null);
        var tgt=showTargets(r);
        var bsM=tgt.bs_m, roiT=tgt.roi_t;
        var fee=(gLive && gLive.fee!=null)?gLive.fee:(r.fee||r.cost);
        var bCls = perfTone(r.bs_a, bsM, fee, r.roi_a, roiT);
        var rCls = bCls;
        var tSty = toneStyle(bCls);
        var feeCls = feeTierClass(fee);
        var feeRowCls = feeRowClass(fee);

        h+='<tr class="'+dc+' sc-'+st+(bCls?' sc-tone-'+bCls:'')+(feeRowCls?' '+feeRowCls:'')+'" data-cal-ds="'+ds+'" ondragover="swDragOver(event)" ondragleave="swDragLeave(event)" ondrop="swDropOnDate(event,\''+ds+'\')">';
        if(ri===0){
          h+='<td class="sc-ev-cell" rowspan="'+nrows+'">'+_evLabelHtml(evLabel, ds)+'</td>';
          h+='<td class="sc-date-cell" rowspan="'+nrows+'">'
            +dateStr+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
        }
        var showUid=ensureShowUid(r);
        /* Click opens edit. Drag-to-move uses a small grip so HTML5 drag cannot swallow the click. */
        h+='<td class="sc-dj-cell" data-show-idx="'+idx+'" data-uid="'+showUid+'" data-action="editShow" style="cursor:pointer" title="Click to edit show">'
          +'<b class="dj-clickname '+bCls+'">'+nm+'</b>'
          +'<span class="dj-fee-inline">'+$k(fee)+'</span>'
          +(r.note?'<div class="dj-note-badge">&#128221; '+r.note.replace(/</g,'&lt;')+'</div>':'')
          +'</td>';
        var djSt=getShowDjStatus(r, ds)||'';
        h+='<td class="acct-status-cell"><div class="acct-status-wrap">'
          +_djStatusSelectHtml(djSt, 'data-ds="'+ds+'" data-idx="'+idx+'" data-uid="'+showUid+'" data-action="djStatus" onclick="event.stopPropagation()" title="DJ Status for this performance"')
          +'</div></td>';
        var vipTxt=(r.vipNote||'').trim();
        var vipEsc=vipTxt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        h+='<td class="sc-vip" onclick="event.stopPropagation()">';
        h+='<span class="vip-link'+(vipTxt?' has-note':'')+'" title="'+(vipTxt||'Add VIP note')+'" onclick="editVipNote('+idx+')">'+(vipTxt?vipEsc:'Add VIP note')+'</span>';
        h+='</td>';
        h+='<td class="sc-3d" onclick="event.stopPropagation()"><button type="button" class="sc-3d-btn" onclick="openShow3dModal('+idx+')" title="Open 3D floor plan and tier prices">3D</button></td>';
        h+='<td class="sc-num fee-cell '+(feeCls||'')+'" data-show-idx="'+idx+'" data-uid="'+showUid+'" data-action="editShow" style="cursor:pointer" title="Click to edit fee">'+$k(fee)+'</td>';
        h+='<td class="sc-num">'+$k(bsM)+'</td>';
        h+='<td class="sc-num '+bCls+'"'+(tSty?' style="'+tSty+'"':'')+'><b>'+$k(r.bs_a)+'</b>'
          +(bCls?'<div class="sc-beat-icon">'+bsToneIcon(bCls)+'</div>':'')+'</td>';
        h+='<td class="sc-num">'+rx(roiT)+'</td>';
        h+='<td class="sc-num '+rCls+'"'+(tSty?' style="'+tSty+'"':'')+'><b>'+rx(r.roi_a)+'</b>'
          +(rCls?'<div class="sc-beat-icon">'+roiToneIcon(rCls)+'</div>':'')+'</td>';
        if(ri===0){
          h+='<td class="sc-sep" rowspan="'+nrows+'"></td>';
          h+=_pyCellsHtml(py||pyBlank, nrows);
        }
        h+='<td class="sc-act"><button type="button" class="sc-edit-btn" data-idx="'+idx+'" data-uid="'+showUid+'" data-action="editShow" title="Edit show">&#9998;</button></td>';
        h+='</tr>';
      });
    }
  }
  h+='</tbody></table>';
  document.getElementById('calBody').innerHTML=h;
  document.querySelectorAll('#calBody [data-action="djStatus"]').forEach(function(sel){
    _wireDjStatusSelect(sel, function(){
      if(sel.dataset.idx!=null && sel.dataset.idx!=='') updateShowDjStatus(+sel.dataset.idx, sel.value, sel, sel.dataset.uid);
      else updateAcctDjStatus(sel.dataset.ds, sel.value, sel);
    });
  });
  wireCalEditClicks();
  initCalColResize();
  fitCalListRows(days);
}

/* Reliable click-to-edit (delegation). Avoids broken inline handlers and drag-vs-click fights. */
function wireCalEditClicks(){
  var body=document.getElementById('calBody');
  if(!body || body._calEditWired===2) return;
  body._calEditWired=2;
  body.addEventListener('click', function(e){
    var addEl=e.target.closest('[data-action="addShow"]');
    if(addEl && body.contains(addEl)){
      e.preventDefault();
      e.stopPropagation();
      var ds=addEl.getAttribute('data-ds')||'';
      if(ds && typeof openAddModal==='function') openAddModal(ds);
      return;
    }
    var el=e.target.closest('[data-action="editShow"]');
    if(!el || !body.contains(el)) return;
    e.preventDefault();
    e.stopPropagation();
    var idx=parseInt(el.getAttribute('data-show-idx')||el.getAttribute('data-idx'),10);
    var uid=el.getAttribute('data-uid')||'';
    if(typeof openEditModal==='function') openEditModal(idx, uid);
  });
}

/* Every Calendar List column can be dragged and retains its width. */
function initCalColResize(){
  var table=document.querySelector('#calBody .sched-tbl');
  if(!table) return;
  var heads=Array.prototype.slice.call(table.querySelectorAll('thead th'));
  if(!heads.length) return;
  var saved={};
  try{ saved=JSON.parse(localStorage.getItem('rdg_cal_col_widths_v2')||'{}')||{}; }catch(e){}
  var inPy=false;
  var keys=heads.map(function(th,i){
    if(th.classList.contains('sc-sep')){inPy=true;return 'py-separator';}
    var text=(th.textContent||'').trim().toLowerCase().replace(/\(\d{4}\)/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return (inPy?'py-':'current-')+(text||('column-'+i));
  });
  var legacy=parseInt(localStorage.getItem('rdg_dj_col_w')||'0',10);
  if(legacy && !saved['current-dj-guest']) saved['current-dj-guest']=legacy;

  /* Stable name-based keys prevent new columns from shifting old saved widths
     onto the PY separator or neighboring columns. */
  var widths=heads.map(function(th,i){
    if(keys[i]==='py-separator') return 3;
    var natural=th.getBoundingClientRect().width||70;
    if(keys[i]==='py-py-dj' && !saved[keys[i]]) natural=Math.max(145,natural);
    if(keys[i]==='current-3d' && !saved[keys[i]]) natural=34;
    return Math.round(saved[keys[i]] || natural);
  });
  table.style.tableLayout='fixed';
  function applyWidths(){
    var total=0;
    heads.forEach(function(th,i){
      var w=keys[i]==='py-separator'
        ? 3
        : Math.max((i===heads.length-1)?28:28, Math.min(600, widths[i]|0));
      widths[i]=w; total+=w;
      th.style.setProperty('width',w+'px','important');
      th.style.setProperty('min-width',w+'px','important');
      th.style.setProperty('max-width',w+'px','important');
    });
    table.style.setProperty('width',Math.max(total,document.getElementById('calBody').clientWidth)+'px','important');
    table.style.setProperty('min-width','0','important');
  }
  applyWidths();

  heads.forEach(function(th,i){
    if(th.classList.contains('sc-sep')) return;
    var handle=document.createElement('span');
    handle.className='sc-col-resizer';
    handle.title='Drag to resize '+(th.textContent.trim()||'column');
    th.appendChild(handle);
    handle.addEventListener('mousedown',function(ev){
      ev.preventDefault(); ev.stopPropagation();
      handle.classList.add('dragging');
      var startX=ev.clientX, startW=widths[i];
      function onMove(e){ widths[i]=startW+(e.clientX-startX); applyWidths(); }
      function onUp(){
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        var out={}; widths.forEach(function(w,j){out[keys[j]]=Math.round(w);});
        try{localStorage.setItem('rdg_cal_col_widths_v2',JSON.stringify(out));}catch(e){}
      }
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  });
}


function fitCalListRows(days){
  var body=document.getElementById('calBody');
  if(!body) return;
  var rows=body.querySelectorAll('.sched-tbl tbody tr').length||Math.max(28,days|0);
  var available=Math.max(180,body.clientHeight);
  var headH=18;
  var rowH=Math.max(8,Math.floor(((available-headH-8)/rows)*10)/10);
  var font=Math.max(6.5,Math.min(10,rowH*.68));
  var mini=Math.max(6,Math.min(8,font-.5));
  var control=Math.max(9,Math.min(18,rowH-1));
  body.style.setProperty('--cal-row-h',rowH+'px');
  body.style.setProperty('--cal-font',font+'px');
  body.style.setProperty('--cal-mini-font',mini+'px');
  body.style.setProperty('--cal-control-h',control+'px');
  body.style.setProperty('--cal-head-h',headH+'px');
  body.style.setProperty('--cal-head-font',Math.max(6.5,Math.min(8,font))+'px');
  if(!window._calFitResizeBound){
    window._calFitResizeBound=true;
    window.addEventListener('resize',function(){
      if(curView==='calendar'&&calViewMode==='list') fitCalListRows(days);
    });
  }
}

/* P&L helper: blank out zeroed pre-open months so they don't look like real $0 sales. */
function _calPlMonth(venue, year, mm){
  var salesRaw=(typeof getBgtActual==='function')?getBgtActual(venue,year,mm,'sales'):null;
  var liveRaw=(typeof getBgtActual==='function')?getBgtActual(venue,year,mm,'live'):null;
  var hasPl=salesRaw!=null&&salesRaw>0;
  var sales=hasPl?salesRaw:null;
  var live=hasPl?liveRaw:null;
  return { sales:sales, live:live, pct:pctLive(sales, live), hasPl:hasPl };
}

/* Last-year strip: Fees / Budget / Variance only (same as this-year strip). */
function renderCalPriorYearRecap(yr, mm){
  var box=document.getElementById('calPriorYearRecap');
  if(!box) return;
  if(!mm || !yr){ box.innerHTML=''; box.style.display='none'; return; }
  var py=yr-1;
  var mi=parseInt(mm,10);
  var s=hs(curV,py,mm);
  var hd='<div class="cal-py-hd">'+MN_SH[mi-1]+' '+py+' actual<span>Last year</span></div>';
  var shows=SCHED.filter(function(r){
    return (r.v||r.venue)===curV && r.d && r._s!=='empty' && inFiscalMonthFilter(r, py, mm);
  });
  var fees=0;
  shows.forEach(function(r){ fees+=(r.fee||r.cost||0); });
  if(!shows.length&&s) fees=s.tFee||0;
  if(!shows.length && !s){
    box.innerHTML=hd+'<div class="cal-py-empty">No '+py+' records for '+curV+'.</div>';
    box.style.display='flex';
    return;
  }
  var budget=getMonthlyBudget(curV,py,mm);
  var feeVar=budget!=null?budget-fees:null;
  var feePct=budget?Math.round(fees/budget*100):null;
  var varCls=feeVar!=null?(feeVar>=0?'hit':'low'):'';
  var items=[
    {l:'Total DJ Fees',v:fees?$k(fees):'-'},
    {l:'Total Budget',v:budget!=null?$k(budget):'-',s:'Guest DJ monthly budget'},
    {l:'Budget Variance',v:feeVar!=null?$kv(feeVar):'-',s:feePct!=null?feePct+'% of budget used':'-',cls:varCls}
  ];
  box.innerHTML=hd+items.map(function(it){
    return '<div class="cal-py-item"><div class="cal-py-l">'+it.l+'</div><div class="cal-py-v'+(it.cls?' '+it.cls:'')+'">'+it.v+'</div>'
      +(it.s?'<div class="cal-recap-s">'+it.s+'</div>':'')+'</div>';
  }).join('');
  box.style.display='flex';
}

function renderCalMonthRecap(yr, mo, mm, showMap){
  var box=document.getElementById('calMonthRecap');
  if(!box) return;
  var fees=0;
  Object.keys(showMap||{}).forEach(function(ds){
    (showMap[ds]||[]).forEach(function(r){
      fees+=(r.fee||r.cost||0);
    });
  });
  var budget=(typeof getMonthlyBudget==='function')?getMonthlyBudget(curV, yr, mm):null;
  var feeVar=budget!=null?budget-fees:null;
  var feePct=budget?Math.round(fees/budget*100):null;
  box.style.display='flex';
  box.innerHTML=
    '<div class="cal-recap-hd">'+MN_SH[mo]+' '+yr+' actual<span>This year</span></div>'
    +'<div class="cal-recap-item"><div class="cal-recap-l">Total DJ Fees</div><div class="cal-recap-v">'+$k(fees||null)+'</div></div>'
    +'<div class="cal-recap-item"><div class="cal-recap-l">Total Budget</div><div class="cal-recap-v">'+(budget!=null?$k(budget):'-')+'</div><div class="cal-recap-s">Guest DJ monthly budget</div></div>'
    +'<div class="cal-recap-item"><div class="cal-recap-l">Budget Variance</div><div class="cal-recap-v '+(feeVar!=null?(feeVar>=0?'hit':'low'):'')+'">'+(feeVar!=null?$kv(feeVar):'-')+'</div><div class="cal-recap-s">'+(feePct!=null?feePct+'% of budget used':'set budget in Budget tab')+'</div></div>';
}

function closeShow3dModal(){
  var el=document.getElementById('show3dModal');
  if(el) el.remove();
}
function openShow3dModal(idx){
  closeShow3dModal();
  var r=SCHED[idx]; if(!r) return;
  var venue=r.v||r.venue;
  var key=fv3dKeyForVenue(venue);
  if(!key){
    alert('No 3D floor plan is available for '+venue+' yet.');
    return;
  }
  var model=FV_3D_MODELS.find(function(m){return m.key===key;});
  var fee=r.fee||r.cost||0;
  var priced=calcTierPricesForShow(venue, r.d, fee);
  var tgt=showTargets(r);
  var summer=!!(priced&&priced.summer);
  var tiersHtml=(priced?priced.tiers:[]).map(function(t){
    var price=t.suggested!=null?t.suggested:t.minimum;
    return '<div class="fv3d-tier" data-tier="'+t.name+'" style="--tier-color:'+t.color+';cursor:default">'
      +'<div class="fv3d-tier-top"><span class="fv3d-tier-name">'+t.name+'</span><span class="fv3d-tier-min">'+formatFv3dMoney(price)+'</span></div>'
      +'<div class="fv3d-tier-meta">'+t.tables.length+' tables \u00b7 up to '+t.capacity+' guests \u00b7 base '+formatFv3dMoney(t.minimum)+'</div>'
      +'<div class="fv3d-tables">'+t.tables.map(function(id){return '<span class="fv3d-table">#'+id+' \u00b7 '+formatFv3dMoney(price)+'</span>';}).join('')+'</div>'
      +'</div>';
  }).join('');

  var modal=document.createElement('div');
  modal.id='show3dModal';
  modal.className='modal-bg show3d-modal';
  modal.onclick=function(ev){ if(ev.target===modal) closeShow3dModal(); };
  modal.innerHTML='<div class="modal" onclick="event.stopPropagation()">'
    +'<div class="modal-hd"><h3>'+venue+(summer?' \u00b7 Summer rooftop':'')+' \u00b7 3D tier pricing</h3><button class="modal-close" onclick="closeShow3dModal()">&#10005;</button></div>'
    +'<div class="modal-body">'
    +'<div style="font-size:11px;color:var(--ink2);margin-bottom:8px"><b>'+(djLabel(r.dj)||'TBD')+'</b> \u00b7 '+r.d
      +' \u00b7 Fee <b>'+$k(fee)+'</b> \u00b7 BS Target <b>'+$k(tgt.bs_m)+'</b> \u00b7 ROI Target <b>'+rx(tgt.roi_t)+'</b>'
      +(summer?' \u00b7 <span style="color:#0f766e">Summer rooftop tiers (Aug\u2013Sep)</span>':'')+'</div>'
    +'<div class="show3d-layout">'
    +'<div class="show3d-host" id="show3dHost"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbb8e8;font-size:12px">Loading floor plan&hellip;</div></div>'
    +'<div class="show3d-side"><div class="fv3d-pricing-hd">Table minimums to hit ROI</div>'
    +'<div class="fv3d-tier-list">'+tiersHtml+'</div>'
    +'<div class="fv3d-panel-note" style="margin-top:10px">Scaled from the '+(summer?'summer rooftop':'static')+' floor-plan configuration to this show\'s BS target. No booking or event data.</div></div>'
    +'</div></div>'
    +'<div class="modal-foot"><button type="button" class="btn-pdf" onclick="closeShow3dModal()">Close</button>'
    +'<button type="button" class="btn-pdf" style="background:var(--ink);color:#fff;border-color:var(--ink)" onclick="closeShow3dModal();_fv3dModelKey=\''+key+'\';_fv3dDate=\''+r.d+'\';setView(\'3d\')">Open full 3D view</button></div>'
    +'</div>';
  document.body.appendChild(modal);
  var host=document.getElementById('show3dHost');
  if(!host||!model) return;
  var modelUrl=(typeof fv3dEffectiveModelUrl==='function')
    ? (fv3dEffectiveModelUrl(key, r.d) || model.url)
    : model.url;
  _ensureModelViewerScript(function(){
    var h=document.getElementById('show3dHost');
    if(!h||!model) return;
    h.innerHTML='';
    var mv=document.createElement('model-viewer');
    mv.setAttribute('src', modelUrl);
    mv.setAttribute('alt', venue+(summer?' summer rooftop':'')+' 3D floor plan');
    mv.setAttribute('camera-controls','');
    mv.setAttribute('touch-action','pan-y');
    mv.setAttribute('interaction-prompt','none');
    mv.setAttribute('shadow-intensity','1');
    mv.setAttribute('exposure','1.1');
    mv.setAttribute('camera-orbit',(summer && model.summerOrbit) ? model.summerOrbit : (model.orbit||'45deg 60deg 110%'));
    mv.style.cssText='width:100%;height:100%;background:transparent;--poster-color:transparent';
    h.appendChild(mv);
    var hotspotKey=(typeof fv3dEffectiveTableKey==='function')?fv3dEffectiveTableKey(key, r.d):key;
    renderFv3dHotspots(mv,hotspotKey,priced?priced.tiers:[]);
  });
}

/*     CALENDAR   grid (box) view                                   */
function dayGridClick(ds){ openAddModal(ds); }

function renderCalGrid(yr,mo,mm,days,showMap){
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  var h='<div class="cal-grid" style="grid-template-columns:repeat(7,1fr)">';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(d){h+='<div class="cg-dow">'+d+'</div>';});
  var firstDow=_parseYmd(fiscalDates[0]).getDay();
  for(var i=0;i<firstDow;i++) h+='<div class="cg-empty"></div>';

  fiscalDates.forEach(function(ds){
    var dObj=_parseYmd(ds);
    var day=dObj.getDate();
    var dow=dObj.getDay();
    var isToday=ds===TODAY;
    var shows=(showMap[ds]||[]).filter(function(r){return r._s!=='empty';});
    var evLabel=daySpecialLabel(ds)||'';

    var dc='cg-day';
    if(isToday) dc+=' cg-today';
    if(dow===0||dow===6) dc+=' cg-wknd';
    if(!shows.length) dc+=' cg-day-empty';

    h+='<div class="'+dc+'" data-ds="'+ds+'" onclick="dayGridClick(this.dataset.ds)">';
    h+='<div class="cg-dn"><span>'+MN_SH[dObj.getMonth()]+' '+day+'</span>'+(isToday?'<span class="cg-today-dot"></span>':'')+'</div>';
    if(evLabel) h+='<div class="cg-ev-banner">'+evLabel+'</div>';

    shows.forEach(function(r){
      var st=r._s||'nd';
      var nm=djLabel(r.dj).slice(0,16);
      var idx=SCHED.indexOf(r);
      var tgt=showTargets(r);
      var bsM=tgt.bs_m;
      var feeCls=feeTierClass(r.fee||r.cost);
      h+='<div class="cg-chip cg-chip-'+st+'" data-idx="'+idx+'" data-uid="'+ensureShowUid(r)+'" data-action="editShow">';
      h+='<div class="cg-chip-dj">'+nm+'</div>';
      if(bsM||r.bs_a){
        h+='<div class="cg-chip-nums">';
        h+='<span>'+$k(bsM)+'</span>';
        var gTone=perfTone(r.bs_a, bsM, (r.fee||r.cost), r.roi_a, (typeof showTargets==='function'?showTargets(r).roi_t:r.roi_t)); var gSty=toneStyle(gTone);
        h+='<span class="'+gTone+'"'+(gSty?' style="'+gSty+'"':'')+'>'+$k(r.bs_a)+'</span>';
        h+='</div>';
      } else if(r.fee||r.cost) {
        h+='<div class="cg-chip-nums fee-cell '+(feeCls||'')+'"><span>'+$k(r.fee||r.cost)+'</span></div>';
      }
      h+='</div>';
    });
    h+='<button type="button" class="cg-add" title="Add show" onclick="event.stopPropagation();openAddModal(\''+ds+'\')">+</button>';

    h+='</div>';
  });
  h+='</div>';
  document.getElementById('calBody').innerHTML=h;
  wireCalEditClicks();
}

/*     CALENDAR   Full Year grid (12 mini-months)                    */
function renderCalYear(){
  applyVenueTint();
  var yr=curYr;
  var h='<div class="cy-legend"><b>Legend:</b> <span class="cy-legend-fee">Fee</span> &middot; <span class="cy-legend-target">BS Target</span> &middot; <span class="cy-legend-actual">BS Actual</span> &middot; DJ colors by fee (&lt;$10K blue / $10\u201350K salmon / &gt;$50K red)</div>';
  h+='<div class="cal-year-grid">';
  for(var mo=0; mo<12; mo++){
    var fiscalDates=datesInFiscalPeriod(yr, mo);
    var mm=(mo+1<10?'0':'')+(mo+1);

    var showMap={};
    SCHED.forEach(function(r){
      if((r.v||r.venue)!==curV||r._s==='empty') return;
      if(!r.d||!dateInFiscalPeriod(r.d, yr, mo)) return;
      if(!showMap[r.d]) showMap[r.d]=[];
      showMap[r.d].push(r);
    });

    h+='<div class="cy-month">';
    h+='<div class="cy-month-hd" onclick="jumpFromYear('+mo+')">'+MN_FULL[mo]+' <span style="font-weight:600;color:var(--ink3);font-size:9px">'+fiscalPeriodShortRange(yr,mo)+'</span></div>';
    h+='<div class="cy-col-labels"><span></span><span></span><span class="cy-col-lbl">Fee</span><span class="cy-col-lbl">Target</span><span class="cy-col-lbl">Actual</span></div>';
    h+='<div class="cy-days-list">';
    fiscalDates.forEach(function(ds){
      var shows=showMap[ds]||[];
      var isToday=ds===TODAY;
      var dObj=_parseYmd(ds);
      var day=dObj.getDate();
      if(!shows.length){
        if(isToday) h+='<div class="cy-row cy-row-today"><span class="cy-daynum">'+day+'</span><span class="cy-empty-lbl">Today</span></div>';
        return;
      }
      shows.forEach(function(r,ri){
        var st=r._s||'nd';
        var idxTgt=(typeof showTargets==='function')?showTargets(r):{bs_m:r.bs_m,roi_t:r.roi_t};
        var idxTone=(typeof perfTone==='function')?perfTone(r.bs_a, idxTgt.bs_m, (r.fee||r.cost), r.roi_a, idxTgt.roi_t):'';
        if(st==='miss' && idxTone==='near') st='beat';
        var nm=djLabel(r.dj).slice(0,14);
        var idx=SCHED.indexOf(r);
        h+='<div class="cy-row cy-row-'+st+(isToday?' cy-row-today':'')+'" data-idx="'+idx+'" data-uid="'+ensureShowUid(r)+'" data-action="editShow">';
        h+='<span class="cy-daynum">'+(ri===0?day:'')+'</span>';
        var cyTgtObj=showTargets(r); var cyFee=r.fee||r.cost; var cyTone=perfTone(r.bs_a, cyTgtObj.bs_m, cyFee, r.roi_a, cyTgtObj.roi_t); var cySty=toneStyle(cyTone);
        var cyFeeCls=feeTierClass(cyFee);
        h+='<span class="cy-djname '+cyTone+'">'+nm+'</span>';
        h+='<span class="cy-fee '+(cyFeeCls||'')+'">'+$k(cyFee)+'</span>';
        h+='<span class="cy-target">'+$k(cyTgtObj.bs_m)+'</span>';
        h+='<span class="cy-actual '+cyTone+'"'+(cySty?' style="'+cySty+'"':'')+'>'+$k(r.bs_a)+'</span>';
        h+='</div>';
      });
    });
    h+='</div></div>';
  }
  h+='</div>';
  document.getElementById('calBody').innerHTML=h;
  wireCalEditClicks();
}
function jumpFromYear(mo){ curM=mo; calViewMode='list'; go(); }

function jumpToMonth(m){ curM=m; curView='calendar'; go(); }
function jumpAcctMonth(m){ acctM=m; renderAccounting(); }

/*    Venue-branded day tinting: lighten venue color for pastel backgrounds    */
function hexLighten(hex, pct){
  hex=hex.replace('#','');
  var r=parseInt(hex.substr(0,2),16), g=parseInt(hex.substr(2,2),16), b=parseInt(hex.substr(4,2),16);
  r=Math.round(r+(255-r)*pct); g=Math.round(g+(255-g)*pct); b=Math.round(b+(255-b)*pct);
  return 'rgb('+r+','+g+','+b+')';
}
function applyVenueTint(){
  var c=venueColor(curV);
  var styleEl=document.getElementById('venueTintStyle');
  if(!styleEl){
    styleEl=document.createElement('style'); styleEl.id='venueTintStyle';
    document.head.appendChild(styleEl);
  }
  /* Weekend + any day with a performance share the venue tint */
  var weekendTint=hexLighten(c.a,0.92);
  styleEl.textContent =
    '.sc-sat td:not(.sc-sep){background:'+weekendTint+' !important}'
    +'.sc-sun td:not(.sc-sep){background:'+weekendTint+' !important}'
    +'.sc-has-show td:not(.sc-sep){background:'+weekendTint+' !important}'
    +'.sc-fri:not(.sc-has-show) td:not(.sc-sep){background:var(--card) !important}'
    +'.sc-wedthu:not(.sc-has-show) td:not(.sc-sep){background:var(--card) !important}';
}

/*                                                               
   MONTHLY SUMMARY   all 12 months
                                                                  */
function renderSummary(){
  var h='';
  for(var mi=1;mi<=12;mi++){
    var mm=(mi<10?'0':'')+mi;
    var perf=monthPerfFromSched(curYr, curV, mm);
    var isEmpty=perf.isEmpty;
    var tBS=perf.tBS, tBSM=perf.tBSM, tFee=perf.tFee;
    var beats=perf.beats, meas=perf.measured;
    var avgR=perf.avgR!=null?perf.avgR.toFixed(1)+'x':'-';
    var nShows=perf.nShows;
    var isFuture=isEmpty?false:(!meas && !tBS);
    var varV=tBS-tBSM;

    h+='<div class="sum-card'+(isEmpty?' sum-card-empty':isFuture?' sum-future':'')+'" onclick="openMonthSummary('+(mi-1)+')">';
    h+='<div class="sum-mname">'+MN_FULL[mi-1]+(isFuture&&!isEmpty?' <span class="sum-fut-tag">Planned</span>':'')+'</div>';
    if(isEmpty){
      h+='<div class="sum-no-data">No shows</div>';
    } else if(isFuture){
      h+='<div class="sum-hero">'+$k(tBSM||null)+'<span class="sum-hero-lbl">target</span></div>';
      h+='<div class="sum-grid">';
      h+='<div class="sg-c"><b>'+nShows+'</b><span>Shows</span></div>';
      h+='<div class="sg-c"><b>'+$k(tFee)+'</b><span>DJ fees</span></div>';
      h+='</div>';
    } else {
      h+='<div class="sum-hero">'+$k(tBS)+'<span class="sum-var '+(varV>=0?'beat':'miss')+'">'+$kv(varV)+'</span></div>';
      h+='<div class="sum-bs-bar"><div class="sum-bs-fill" style="width:'+Math.min(100,tBSM?Math.round(tBS/tBSM*100):100)+'%"></div></div>';
      h+='<div class="sum-grid">';
      h+='<div class="sg-c"><b>'+$k(tBSM)+'</b><span>BS Target</span></div>';
      h+='<div class="sg-c"><b class="kc-b">'+avgR+'</b><span>Avg ROI</span></div>';
      h+='<div class="sg-c"><b>'+$k(tFee)+'</b><span>DJ Cost</span></div>';
      if(meas) h+='<div class="sg-c"><b class="'+(beats>=meas*0.6?'beat':'miss')+'">'+beats+'/'+meas+'</b><span>Beat</span></div>';
      h+='</div>';
    }
    h+='</div>';
  }
  document.getElementById('summaryBody').innerHTML=h;
}

/*                                                               
   ALL SHOWS
                                                                  */
function renderAllShows(){
  var recs=SCHED.filter(function(r){return (r.v||r.venue)===curV&&r.d&&r._s!=='empty'&&dateInFiscalYear(r.d,curYr)&&(r.bs_a||r.bs_m||r._s==='beat'||r._s==='miss'||r._s==='fut'||r._s==='nd');});
  recs.sort(function(a,b){return a.d<b.d?-1:1;});
  if(!recs.length){
    document.getElementById('allshowsBody').innerHTML='<div class="empty">No data for '+curV+' '+curYr+'</div>';
    return;
  }
  var h='<table class="shows-tbl"><thead><tr>'
    +'<th>Date</th><th>DJ</th><th>Fee</th><th>BS Target</th><th>BS Actual</th>'
    +'<th>ROI Tgt</th><th>ROI Act</th><th>Status</th>'
    +'</tr></thead><tbody>';
  recs.forEach(function(r){
    var tgt=showTargets(r);
    var bsM=tgt.bs_m, roiT=tgt.roi_t;
    var fee=r.fee||r.cost;
    var bCls=perfTone(r.bs_a, bsM, fee, r.roi_a, roiT);
    var rCls=bCls;
    var dt=new Date(r.d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    var stLabel=r._s==='beat'?'Beat':r._s==='miss'?'Miss':r._s==='fut'?'Upcoming':r._s==='nd'?'N/A':(r._s||'N/A');
    var stPill=r._s==='beat'?'p-beat':r._s==='miss'?'p-miss':'p-nd';
    h+='<tr>';
    h+='<td class="td-dt">'+dt+'</td>';
    h+='<td class="td-dj '+bCls+'">'+(r.dj||'-')+'</td>';
    h+='<td>'+$k(fee)+'</td>';
    h+='<td>'+$k(bsM)+'</td>';
    h+='<td class="'+bCls+'"><b>'+$k(r.bs_a)+'</b></td>';
    h+='<td>'+rx(roiT)+'</td>';
    h+='<td class="'+rCls+'"><b>'+rx(r.roi_a)+'</b></td>';
    h+='<td><span class="pill '+stPill+'">'+stLabel+'</span></td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('allshowsBody').innerHTML=h;
}

/*                                                               
   ROI RANKING   venue all-time, click DJ for full history
                                                                  */
var _lbDJ = null; /* selected DJ for detail view */
var _lbSort = { key: 'score', dir: 'desc' };

function lbSortBy(key){
  if(_lbSort.key === key) _lbSort.dir = _lbSort.dir === 'desc' ? 'asc' : 'desc';
  else { _lbSort.key = key; _lbSort.dir = 'desc'; }
  renderLeaderboard();
}
function _lbSortMark(key){
  if(_lbSort.key !== key) return '';
  return _lbSort.dir === 'desc' ? ' ?' : ' ?';
}
function _lbTh(label, key){
  return '<th style="cursor:pointer;user-select:none" onclick="event.stopPropagation();lbSortBy(\''+key+'\')" title="Sort by '+label+'">'+label+_lbSortMark(key)+'</th>';
}

function renderLeaderboard(){
  if(_lbDJ) { renderDJDetail(_lbDJ); return; }
  var q=(document.getElementById('lbSearch')||{value:''}).value||'';
  var qs=q.trim().toUpperCase();
  /* All venues combined, all-time */
  var raw=SCHED.filter(function(r){return r._s!=='empty'&&r.roi_a!=null&&r.bs_a;}).map(function(r){return {venue:r.venue||r.v,dj:r.dj,cost:r.fee||r.cost,bs_a:r.bs_a,bs_m:r.bs_m,roi_a:r.roi_a,roi_t:r.roi_t,beat:r.beat,d:r.d};});
  var djMap={};
  raw.forEach(function(r){
    var key=(r.dj||'').trim().toUpperCase(); if(!key) return;
    if(!djMap[key]) djMap[key]={dj:r.dj,n:0,beats:0,meas:0,tFee:0,tBS:0,rois:[],shows:[],venues:{}};
    djMap[key].n++;
    djMap[key].rois.push(r.roi_a);
    if(r.roi_t) djMap[key].meas++;
    if(r.beat===1) djMap[key].beats++;
    djMap[key].tFee+=(r.cost||0);
    djMap[key].tBS+=(r.bs_a||0);
    djMap[key].shows.push(r);
    djMap[key].venues[r.venue]=(djMap[key].venues[r.venue]||0)+1;
  });
  var list=Object.keys(djMap).map(function(k){
    var d=djMap[k];
    var avgROI=d.rois.reduce(function(a,b){return a+b;},0)/d.rois.length;
    var avgBS=Math.round(d.tBS/d.n);
    var avgFeePaid=Math.round(d.tFee/d.n);
    var misses=Math.max(0, d.meas - d.beats);
    var br=d.meas?Math.round(d.beats/d.meas*100):0;
    var score=avgROI*(d.meas?d.beats/d.meas:0.5)*Math.log(d.n+1);
    var fairFee=leaderboardSuggestedFee(avgBS, avgFeePaid, br);
    var venueList=Object.keys(d.venues).sort(function(a,b){return d.venues[b]-d.venues[a];});
    return {dj:d.dj,n:d.n,beats:d.beats,misses:misses,meas:d.meas,avgROI:avgROI,br:br,score:score,
      tFee:d.tFee,tBS:d.tBS,shows:d.shows,avgBS:avgBS,avgFeePaid:avgFeePaid,fairFee:fairFee,venues:venueList};
  });

  var sortKey = _lbSort.key || 'score';
  var dir = _lbSort.dir === 'asc' ? 1 : -1;
  list.sort(function(a,b){
    var av=a[sortKey], bv=b[sortKey];
    if(av==null && bv==null) return 0;
    if(av==null) return 1;
    if(bv==null) return -1;
    if(typeof av === 'string'){
      var cmp=String(av).localeCompare(String(bv));
      return dir * (cmp || String(a.dj).localeCompare(String(b.dj)));
    }
    if(av === bv){
      if(a.br !== b.br) return dir * (a.br - b.br);
      return dir * (a.n - b.n);
    }
    return dir * (av - bv);
  });
  if(qs) list=list.filter(function(r){return r.dj.toUpperCase().indexOf(qs)>=0;});

  var h='<table class="shows-tbl"><thead><tr>'
    +'<th>#</th>'
    +_lbTh('DJ','dj')
    +'<th>Venue(s)</th>'
    +_lbTh('Shows','n')
    +_lbTh('Beat/Miss','beats')
    +_lbTh('Beat %','br')
    +_lbTh('Avg ROI','avgROI')
    +_lbTh('Avg BS/show','avgBS')
    +_lbTh('Avg Fee Paid','avgFeePaid')
    +_lbTh('Suggested Fee','fairFee')
    +_lbTh('Total BS Act','tBS')
    +'</tr></thead><tbody>';
  list.forEach(function(r,i){
    var fairCls = r.fairFee && r.avgFeePaid && r.fairFee<r.avgFeePaid ? 'low' : '';
    var VENUE_SHORT={'Casa Neos Beach Club':'CNBC','Casa Neos Lounge':'CNL','MILA Lounge':'MILA'};
    var venueBadges = '<div class="lb-venue-badges">' + r.venues.map(function(v){
      var c=venueColor(v);
      var short=VENUE_SHORT[v]||v.slice(0,4).toUpperCase();
      return '<span class="lb-venue-badge" style="background:'+c.a+'1a;color:'+c.a+'" title="'+v+'">'+short+'</span>';
    }).join('') + '</div>';
    var suggTitle = r.br >= 50
      ? 'Beat % ? 50% ? match avg fee paid'
      : 'Beat % under 50% ? judgment fee from proven BS (capped at avg paid)';
    h+='<tr class="lb-row" onclick="showDJDetail(\''+encodeURIComponent(r.dj)+'\')">';
    h+='<td style="color:var(--ink3);font-weight:700">'+(i+1)+'</td>';
    h+='<td class="td-dj lb-dj-link" style="font-weight:700">'+r.dj+'</td>';
    h+='<td>'+venueBadges+'</td>';
    h+='<td style="text-align:center">'+r.n+'</td>';
    h+='<td style="text-align:center" title="'+r.beats+' beat / '+r.misses+' miss">'+r.beats+'/'+r.misses+'</td>';
    h+='<td class="'+(r.br>=60?'hit':'low')+'" style="text-align:center;font-weight:700">'+r.br+'%</td>';
    h+='<td class="'+(r.br>=60?'hit':'low')+'" style="font-weight:700">'+r.avgROI.toFixed(2)+'x</td>';
    h+='<td>'+$k(r.avgBS)+'</td>';
    h+='<td style="color:var(--ink3)">'+$k(r.avgFeePaid)+'</td>';
    h+='<td class="'+fairCls+'" style="font-weight:800" title="'+suggTitle+'">'+$k(r.fairFee)+'</td>';
    h+='<td style="font-weight:700">'+$k(r.tBS)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('lbBody').innerHTML=h;
}


function showDJDetail(djEnc){
  _lbDJ=djEnc;
  renderDJDetail(djEnc);
}

function renderDJDetail(djEnc){
  var djName=decodeURIComponent(djEnc);
  var djKey=djName.trim().toUpperCase();
  /* All shows ACROSS ALL VENUES for this DJ */
  var shows=SCHED.filter(function(r){
    return r._s!=='empty'&&r.dj&&r.dj.trim().toUpperCase()===djKey&&r.bs_a;
  }).map(function(r){return {venue:r.venue||r.v,dj:r.dj,cost:r.fee||r.cost,bs_a:r.bs_a,bs_m:r.bs_m,roi_a:r.roi_a,roi_t:r.roi_t,beat:r.beat,d:r.d};})
   .sort(function(a,b){return a.d<b.d?-1:1;});

  document.getElementById('lbMeta') && (document.getElementById('lbMeta').textContent=djName+'   '+shows.length+' shows across all venues');

  var roiVals=shows.filter(function(r){return r.roi_a;});
  var avgROI=roiVals.length?roiVals.reduce(function(s,r){return s+r.roi_a;},0)/roiVals.length:0;
  var beats=shows.filter(function(r){return r.beat===1;}).length;
  var meas=shows.filter(function(r){return r.beat!==null&&r.beat!==undefined;}).length;
  var tBS=shows.reduce(function(s,r){return s+(r.bs_a||0);},0);
  var tFee=shows.reduce(function(s,r){return s+(r.cost||0);},0);
  var avgBS=shows.length?Math.round(tBS/shows.length):0;
  var avgFeePaid=shows.length?Math.round(tFee/shows.length):0;
  var suggFee=leaderboardSuggestedFee(avgBS, avgFeePaid, meas?Math.round(beats/meas*100):0);

  var h='<div style="padding:12px 16px;background:var(--card);border-bottom:0.5px solid var(--hair);display:flex;align-items:center;gap:16px;flex-wrap:wrap">';
  h+='<button onclick="_lbDJ=null;renderLeaderboard()" style="font-size:11px;font-weight:600;padding:5px 12px;border-radius:var(--r);border:0.5px solid var(--rule);background:var(--card);cursor:pointer;font-family:inherit">&#8592; Rankings</button>';
  h+='<div style="font-size:20px;font-weight:900;letter-spacing:-.5px">'+djName+'</div>';
  var bCls=meas&&beats/meas>=0.6?'hit':'low';
  [
    {l:'Shows',v:shows.length,c:''},
    {l:'Avg ROI',v:avgROI.toFixed(2)+'x',c:bCls},
    {l:'Beat rate',v:meas?Math.round(beats/meas*100)+'%':'-',c:bCls},
    {l:'Avg BS/show',v:$k(avgBS),c:''},
    {l:'Avg fee paid',v:$k(avgFeePaid),c:''},
  ].forEach(function(k){
    h+='<div style="text-align:center"><div style="font-size:18px;font-weight:800" class="'+k.c+'">'+k.v+'</div><div style="font-size:9px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em">'+k.l+'</div></div>';
  });
  /* Suggested fee   highlighted separately */
  h+='<div style="text-align:center;margin-left:auto;background:var(--blue-bg);padding:6px 14px;border-radius:10px">';
  h+='<div style="font-size:18px;font-weight:900;color:var(--blue)">'+$k(suggFee)+'</div>';
  h+='<div style="font-size:9px;color:var(--blue);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Suggested fee</div>';
  h+='</div>';
  h+='</div>';

  h+='<table class="shows-tbl"><thead><tr>'
    +'<th>Date</th><th>Venue</th><th>Fee</th><th>BS Target</th><th>BS Actual</th>'
    +'<th>ROI Tgt</th><th>ROI Act</th><th>Status</th>'
    +'</tr></thead><tbody>';
  shows.forEach(function(r){
    var bsCls=perfTone(r.bs_a, r.bs_m, (r.fee||r.cost), r.roi_a, r.roi_t);
    var rCls=bsCls;
    var dt=new Date(r.d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    h+='<tr>';
    h+='<td class="td-dt">'+dt+'</td>';
    h+='<td style="font-size:10px;color:var(--ink3)">'+r.venue+'</td>';
    h+='<td>'+$k(r.cost)+'</td>';
    h+='<td>'+$k(r.bs_m)+'</td>';
    h+='<td class="'+bsCls+'"><b>'+$k(r.bs_a)+'</b></td>';
    h+='<td>'+rx(r.roi_t)+'</td>';
    h+='<td class="'+rCls+'"><b>'+rx(r.roi_a)+'</b></td>';
    h+='<td><span class="pill '+(r.beat===1?'p-beat':r.beat===0?'p-miss':'p-nd')+'">'+(r.beat===1?'Beat':r.beat===0?'Miss':'N/A')+'</span></td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('lbBody').innerHTML=h;
}

function _acctDocsKey(kind){ return kind==='invoice'?'invoices':'contracts'; }
function _acctDocList(acct, kind){
  _acctNormalize(acct);
  return acct[_acctDocsKey(kind)]||[];
}
function _acctSafeFileName(name){
  return String(name||'document.pdf').replace(/[\\\/:#?*"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,120);
}
function _acctGuessPdfPages(file){
  return new Promise(function(resolve){
    if(!file){ resolve(null); return; }
    var reader=new FileReader();
    reader.onload=function(){
      try{
        var text=String(reader.result||'');
        var matches=text.match(/\/Type\s*\/Page\b/g);
        resolve(matches&&matches.length?matches.length:null);
      }catch(e){ resolve(null); }
    };
    reader.onerror=function(){ resolve(null); };
    reader.readAsText(file.slice(0, Math.min(file.size, 2*1024*1024)));
  });
}
function _acctDocDropHtml(ds, kind, docs){
  var label=kind==='invoice'?'Invoice':'Contract';
  var h='<div class="acct-doc-drop" data-ds="'+ds+'" data-kind="'+kind+'" data-action="docDrop" title="Drop PDF here ('+label+')">'
    +'<div class="acct-doc-hint">Drop PDF<br><span style="font-weight:600">multi-page OK</span></div>'
    +'<div class="acct-doc-list">';
  (docs||[]).forEach(function(doc,idx){
    var pages=doc.pages!=null?('<span class="acct-doc-pages">'+doc.pages+'p</span>'):'';
    h+='<div class="acct-doc-chip">'
      +'<a href="'+_escHtml(doc.url)+'" target="_blank" rel="noopener" title="'+_escHtml(doc.name)+'" onclick="event.stopPropagation()">'+_escHtml(doc.name||'PDF')+'</a>'
      +pages
      +'<button type="button" class="acct-doc-del" data-ds="'+ds+'" data-kind="'+kind+'" data-idx="'+idx+'" data-action="docDel" title="Remove">&#10005;</button>'
      +'</div>';
  });
  h+='</div></div>';
  return h;
}
function _acctStorageRef(){
  try{
    if(!window._fbStorage) window._fbStorage=firebase.storage();
    return window._fbStorage;
  }catch(e){ return null; }
}
function addAcctPdfFiles(ds, kind, files){
  var list=Array.prototype.slice.call(files||[]).filter(function(f){
    return f && (f.type==='application/pdf' || /\.pdf$/i.test(f.name||''));
  });
  if(!list.length){ alert('Please drop PDF files only.'); return; }
  var storage=_acctStorageRef();
  if(!storage){ alert('File storage is unavailable in this browser session.'); return; }
  var acct=_acctNormalize(getAcct(ds));
  var key=_acctDocsKey(kind);
  var drop=document.querySelector('#acctBody .acct-doc-drop[data-ds="'+ds+'"][data-kind="'+kind+'"]');
  if(drop) drop.classList.add('acct-doc-busy');
  var venue=(typeof acctVenue==='function'?acctVenue():curAcctV)||curV||'venue';
  var by=_acctSoftEditorName();
  Promise.all(list.map(function(file){
    return _acctGuessPdfPages(file).then(function(pages){
      var stamp=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
      var path='rdg/acctDocs/'+_acctSafeFileName(venue)+'/'+ds+'/'+kind+'/'+stamp+'_'+_acctSafeFileName(file.name);
      var ref=storage.ref(path);
      return ref.put(file, {contentType:'application/pdf', customMetadata:{originalName:file.name||'document.pdf'}}).then(function(){
        return ref.getDownloadURL();
      }).then(function(url){
        return {
          id:stamp,
          name:file.name||'document.pdf',
          url:url,
          path:path,
          size:file.size||null,
          pages:pages,
          uploadedAt:new Date().toISOString(),
          uploadedBy:by
        };
      });
    });
  })).then(function(docs){
    _pushAcctUndo('Upload accounting '+kind+' PDF');
    acct[key]=(acct[key]||[]).concat(docs);
    _acctPushLog(acct, kind==='invoice'?'Invoice PDF':'Contract PDF', '', docs.length+' file(s)', by);
    _acctPersist();
    if(curView==='accounting') renderAccounting();
  }).catch(function(err){
    console.error(err);
    alert('Could not upload PDF. Check Firebase Storage rules allow uploads to rdg/acctDocs/.');
    if(drop) drop.classList.remove('acct-doc-busy');
  });
}
function removeAcctPdf(ds, kind, idx){
  var acct=_acctNormalize(getAcct(ds));
  var key=_acctDocsKey(kind);
  var docs=acct[key]||[];
  var doc=docs[idx];
  if(!doc) return;
  if(!confirm('Remove '+((doc.name)||'this PDF')+'?')) return;
  _pushAcctUndo('Remove accounting '+kind+' PDF');
  docs.splice(idx,1);
  acct[key]=docs;
  _acctPushLog(acct, kind==='invoice'?'Invoice PDF':'Contract PDF', doc.name||'', 'removed', _acctSoftEditorName());
  _acctPersist();
  var storage=_acctStorageRef();
  if(storage && doc.path){
    try{ storage.ref(doc.path).delete().catch(function(){}); }catch(e){}
  }
  if(curView==='accounting') renderAccounting();
}
function wireAccountingDocDrops(){
  document.querySelectorAll('#acctBody [data-action="docDrop"]').forEach(function(zone){
    var input=document.createElement('input');
    input.type='file';
    input.accept='application/pdf,.pdf';
    input.multiple=true;
    input.style.display='none';
    zone.appendChild(input);
    zone.addEventListener('click',function(e){
      if(e.target.closest('[data-action="docDel"]')||e.target.closest('a')) return;
      input.click();
    });
    input.addEventListener('change',function(){
      if(input.files&&input.files.length) addAcctPdfFiles(zone.dataset.ds, zone.dataset.kind, input.files);
      input.value='';
    });
    zone.addEventListener('dragenter',function(e){ e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragover',function(e){ e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave',function(e){
      if(!zone.contains(e.relatedTarget)) zone.classList.remove('dragover');
    });
    zone.addEventListener('drop',function(e){
      e.preventDefault();
      zone.classList.remove('dragover');
      if(e.dataTransfer&&e.dataTransfer.files) addAcctPdfFiles(zone.dataset.ds, zone.dataset.kind, e.dataTransfer.files);
    });
  });
  document.querySelectorAll('#acctBody [data-action="docDel"]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      removeAcctPdf(btn.dataset.ds, btn.dataset.kind, parseInt(btn.dataset.idx,10));
    });
  });
}
function wireAccountingEvents(){
  document.querySelectorAll('#acctBody [data-action="add"]').forEach(function(btn){
    btn.addEventListener('click',function(){ openAddModal(btn.dataset.ds); });
  });
  document.querySelectorAll('#acctBody [data-action="edit"]').forEach(function(btn){
    btn.addEventListener('click',function(){ openEditModal(parseInt(btn.dataset.idx,10), btn.dataset.uid); });
  });
  document.querySelectorAll('#acctBody [data-action="djStatus"]').forEach(function(sel){
    _wireDjStatusSelect(sel, function(){
      if(sel.dataset.idx!=null && sel.dataset.idx!=='') updateShowDjStatus(+sel.dataset.idx, sel.value, sel, sel.dataset.uid);
      else updateAcctDjStatus(sel.dataset.ds, sel.value, sel);
    });
  });
  document.querySelectorAll('#acctBody [data-action="apStatus"]').forEach(function(sel){
    sel.addEventListener('change',function(){ updateAcctApStatus(sel.dataset.ds, sel.value, sel); });
  });
  document.querySelectorAll('#acctBody [data-action="acctHist"]').forEach(function(btn){
    btn.addEventListener('click',function(){ showAcctHistory(btn.dataset.ds); });
  });
  document.querySelectorAll('#acctBody [data-action="r365"]').forEach(function(chk){
    chk.addEventListener('change',function(){ updateR365(chk, chk.dataset.ds); });
  });
  wireAccountingDocDrops();
}

var ACCT_AP_PASSWORD="jessica";
var _acctStatusFilter=null; /* when set, only show rows matching this status */

function acctStatusClass(status){
  if(!status) return 'acct-st-notset';
  if(status==='Paid') return 'acct-st-paid';
  if(status==='Deposit paid') return 'acct-st-deposit';
  if(status==='On Workflow') return 'acct-st-pending';
  if(status.indexOf('Missing')===0) return 'acct-st-missing';
  if(status==='Confirmed'||status==='Contract + invoice received') return 'acct-st-confirmed';
  if(status==='Offer sent'||status==='Hold 1') return 'acct-st-pending';
  return 'acct-st-notset';
}
function _acctNormalize(acct){
  if(!acct) return acct;
  if(acct.djStatus==null && acct.apStatus==null && acct.status){
    if(ACCT_DJ_STATUS.indexOf(acct.status)>=0) acct.djStatus=acct.status;
    else if(ACCT_AP_STATUS.indexOf(acct.status)>=0) acct.apStatus=acct.status;
  }
  if(!acct.log) acct.log=[];
  if(!Array.isArray(acct.contracts)) acct.contracts=[];
  if(!Array.isArray(acct.invoices)) acct.invoices=[];
  return acct;
}
function _acctEffectiveStatus(acct){
  _acctNormalize(acct);
  return acct.apStatus || acct.djStatus || acct.status || null;
}
function _acctPersist(){
  try{ if(window._fbSave) window._fbSave('acctData', acctData); }catch(e){}
}
/* Prefer day-scoped writes so status changes do not rewrite the whole acct tree. */
function _acctPersistDay(ds){
  if(!ds){ _acctPersist(); return; }
  try{
    var k=(typeof acctKey==='function')?acctKey(ds):String(ds);
    if(window._fbRef && acctData && acctData[k]!=null){
      window._fbRef.child('acctData/'+k).set(acctData[k]);
    } else {
      _acctPersist();
    }
  }catch(e){ _acctPersist(); }
}
function _acctEditorName(){
  var by=sessionStorage.getItem('rdg_acct_editor')||'';
  if(!by){
    by=prompt('Your name (saved for edit history):')||'';
    by=by.trim();
    if(!by) return null;
    sessionStorage.setItem('rdg_acct_editor', by);
  }
  return by;
}
function _acctRequireApPassword(){
  var by=_acctEditorName();
  if(!by) return null;
  var pw=prompt('Password required to update AP Status:');
  if(pw!==ACCT_AP_PASSWORD){ alert('Incorrect password.'); return null; }
  return by;
}
function _acctPushLog(acct, field, fromVal, toVal, by){
  if(!acct.log) acct.log=[];
  acct.log.push({
    at: new Date().toISOString(),
    by: by,
    field: field,
    from: fromVal||'',
    to: toVal||''
  });
  if(acct.log.length>40) acct.log=acct.log.slice(-40);
  acct.updatedAt=new Date().toISOString();
  acct.updatedBy=by;
}
function _acctSoftEditorName(){
  /* DJ Status: no name prompt required ? use presence/session if known */
  try{
    var p=(typeof _presenceName==='function')?_presenceName():'';
    if(p) return p;
  }catch(e){}
  try{
    var s=sessionStorage.getItem('rdg_acct_editor')||'';
    if(s) return s;
  }catch(e2){}
  return 'Unknown';
}
function updateAcctDjStatus(ds,val,sel){
  var acct=_acctNormalize(getAcct(ds));
  var prev=acct.djStatus||'';
  var next=val||'';
  if(prev===next) return;
  _pushAcctUndo('Change DJ status');
  var by=_acctSoftEditorName();
  acct.djStatus=next||null;
  /* Clearing Not set must also clear legacy status or Confirmed resurrects via _acctNormalize */
  if(!next){
    if((typeof ACCT_DJ_STATUS!=='undefined'?ACCT_DJ_STATUS:[]).indexOf(acct.status||'')>=0){
      acct.status=acct.apStatus||null;
    } else if(!acct.apStatus){
      acct.status=null;
    }
  } else {
    acct.status=_acctEffectiveStatus(acct);
  }
  _acctPushLog(acct,'DJ Status',prev,next||'Not set',by);
  _acctPersistDay(ds);
  if(sel) sel.className='acct-status-sel '+acctStatusClass(next||null);
  window._calStatusMenuOpen=false;
  _calRequestRefresh(curView==='accounting'?'go':false);
}
/* Keep DJ Status <select> open: Firebase soft-refreshes were rebuilding the
   calendar mid-open and snapping the menu shut. Lock paint while focused. */
window._calStatusMenuOpen=false;
window._calPendingRefresh=false;
function _calUiBusy(){
  if(window._calStatusMenuOpen) return true;
  var ae=document.activeElement;
  if(!ae) return false;
  if(ae.tagName==='SELECT' && ae.getAttribute('data-action')==='djStatus') return true;
  if(ae.tagName==='SELECT' && ae.classList && ae.classList.contains('acct-status-sel')) return true;
  return false;
}
function _calRequestRefresh(forceGo){
  if(_calUiBusy()){
    window._calPendingRefresh=forceGo?'go':'cal';
    return;
  }
  if(forceGo==='go' || window._calPendingRefresh==='go'){
    window._calPendingRefresh=false;
    if(typeof go==='function') go();
    return;
  }
  window._calPendingRefresh=false;
  if(curView==='calendar' && typeof renderCal==='function') renderCal();
  else if(curView==='accounting' && typeof renderAccounting==='function') renderAccounting();
}
function _calFlushPendingRefresh(){
  if(!window._calPendingRefresh || _calUiBusy()) return;
  var kind=window._calPendingRefresh;
  window._calPendingRefresh=false;
  if(kind==='go' && typeof go==='function') go();
  else if(curView==='calendar' && typeof renderCal==='function') renderCal();
  else if(curView==='accounting' && typeof renderAccounting==='function') renderAccounting();
}
function _wireDjStatusSelect(sel, onChange){
  if(!sel || sel._djStatusWired) return;
  sel._djStatusWired=1;
  function lock(e){
    window._calStatusMenuOpen=true;
    if(e){ e.stopPropagation(); }
  }
  function unlock(){
    window._calStatusMenuOpen=false;
    setTimeout(_calFlushPendingRefresh, 0);
  }
  sel.addEventListener('pointerdown', lock);
  sel.addEventListener('mousedown', lock);
  sel.addEventListener('touchstart', lock, {passive:true});
  sel.addEventListener('focus', lock);
  sel.addEventListener('blur', unlock);
  sel.addEventListener('change', function(){
    window._calStatusMenuOpen=false;
    if(typeof onChange==='function') onChange();
  });
  sel.addEventListener('click', function(e){ e.stopPropagation(); });
}
/* Per-performance DJ status (calendar). New/edited shows start at Not set.
   Status writes must NEVER rewrite DJ guest name / fee / date. */
function updateShowDjStatus(idx,val,sel,uid){
  var wantUid=uid||(sel&&sel.dataset&&sel.dataset.uid)||'';
  var wantDs=(sel&&sel.dataset&&sel.dataset.ds)||'';
  if(!wantUid){
    try{ console.warn('updateShowDjStatus: missing uid — ignored to protect other nights'); }catch(e){}
    return;
  }
  var r=_findSchedByUidOrIdx
    ? _findSchedByUidOrIdx(wantUid, -1)
    : null;
  if(!r||!r.d) return;
  /* Hard date check — never apply status to a different night than the control. */
  if(wantDs && r.d!==wantDs){
    try{ console.warn('updateShowDjStatus: date mismatch', wantDs, r.d); }catch(e2){}
    return;
  }
  if(String(ensureShowUid(r))!==String(wantUid)) return;
  var next=val||'';
  var prev=getShowDjStatus(r,r.d)||'';
  if(prev===next) return;
  r.djStatus=next||null;
  ensureShowUid(r);
  if(typeof persistShowDjStatusOnly==='function') persistShowDjStatusOnly(r);
  else if(typeof persistSchedShow==='function') persistSchedShow(r);
  var sameDay=SCHED.filter(function(x){
    return x && x._s!=='empty' && (x.v||x.venue)===(r.v||r.venue) && x.d===r.d;
  });
  if(sameDay.length<=1){
    var acct=_acctNormalize(getAcct(r.d));
    var by=_acctSoftEditorName();
    var prevAcct=acct.djStatus||'';
    acct.djStatus=next||null;
    if(!next){
      if((typeof ACCT_DJ_STATUS!=='undefined'?ACCT_DJ_STATUS:[]).indexOf(acct.status||'')>=0){
        acct.status=acct.apStatus||null;
      } else if(!acct.apStatus){
        acct.status=null;
      }
    } else {
      acct.status=_acctEffectiveStatus(acct);
    }
    if(prevAcct!==next) _acctPushLog(acct,'DJ Status',prevAcct,next||'Not set',by);
    _acctPersistDay(r.d);
  }
  /* Update this control in place — full calendar rebuild can wait until the
     menu is closed (and Firebase echo must not snap it shut mid-pick). */
  if(sel) sel.className='acct-status-sel '+acctStatusClass(next||null);
  window._calStatusMenuOpen=false;
  _calRequestRefresh(curView==='accounting'?'go':false);
}
function _djStatusSelectHtml(djSt, extraAttrs){
  var opts=(typeof ACCT_DJ_STATUS!=='undefined'?ACCT_DJ_STATUS:['Offer sent','Hold 1','Confirmed']);
  var h='<select class="acct-status-sel '+acctStatusClass(djSt||null)+'" '+(extraAttrs||'')+'>';
  /* Always keep Not set available (including when clearing a prior status) */
  h+='<option value=""'+(!djSt?' selected':'')+'>Not set</option>';
  h+=opts.map(function(opt){return '<option value="'+opt+'"'+(djSt===opt?' selected':'')+'>'+opt+'</option>';}).join('');
  return h+'</select>';
}
function updateAcctApStatus(ds,val,sel){
  var acct=_acctNormalize(getAcct(ds));
  var prev=acct.apStatus||'';
  var next=val||'';
  if(prev===next) return;
  var by=_acctRequireApPassword();
  if(!by){
    if(sel) sel.value=prev;
    return;
  }
  _pushAcctUndo('Change AP status');
  acct.apStatus=next||null;
  acct.status=_acctEffectiveStatus(acct);
  _acctPushLog(acct,'AP Status',prev,next,by);
  _acctPersist();
  renderAccounting();
}
function updateAcctStatus(ds,val){ /* legacy */ updateAcctDjStatus(ds,val); }
function _fmtAcctWhen(iso){
  if(!iso) return '';
  try{
    var d=new Date(iso);
    return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }catch(e){ return iso; }
}
function showAcctHistory(ds){
  var acct=_acctNormalize(getAcct(ds));
  var log=acct.log||[];
  var old=document.getElementById('acctHistModal');
  if(old) old.remove();
  var modal=document.createElement('div');
  modal.id='acctHistModal';
  modal.className='acct-hist-modal';
  var rows=log.slice().reverse().map(function(e){
    return '<div class="acct-hist-row"><b>'+_fmtAcctWhen(e.at)+'</b> &middot; '+ (e.by||'?')
      +'<br><span style="color:var(--ink3)">'+e.field+': </span>'
      +'<span style="color:var(--ink4)">'+(e.from||'Not set')+'</span> \u2192 <b>'+(e.to||'Not set')+'</b></div>';
  }).join('') || '<div class="acct-hist-row" style="color:var(--ink3)">No edits yet.</div>';
  modal.innerHTML='<div class="acct-hist-card"><h3>Edit history</h3>'
    +'<div style="font-size:11px;color:var(--ink3);margin-bottom:8px">'+ds+' &middot; '+curV+'</div>'
    +(acct.updatedBy?'<div style="font-size:11px;margin-bottom:10px">Last edit: <b>'+acct.updatedBy+'</b> &middot; '+_fmtAcctWhen(acct.updatedAt)+'</div>':'')
    +rows
    +'<div style="margin-top:12px;text-align:right"><button onclick="document.getElementById(\'acctHistModal\').remove()" style="padding:6px 14px;border-radius:8px;border:none;background:var(--ink);color:#fff;font-weight:700;cursor:pointer">Close</button></div>'
    +'</div>';
  modal.addEventListener('click',function(ev){ if(ev.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}
function updateR365(inp,ds){
  _pushAcctUndo('Change R365 status');
  getAcct(ds).r365=inp.checked?1:0;
  _acctPersist();
}
function setAcctStatusFilter(status){
  _acctStatusFilter = (_acctStatusFilter===status) ? null : status;
  renderAccounting();
}

/* ---------------------------------------------------------------
   VIP DATA ? last week per-show / per-tier breakdown
   Pulled live from Toast. Updated each Monday by the AI assistant.
   --------------------------------------------------------------- */
/* --- VIP multi-venue data --------------------------------------- */
var VIP_VENUES = [
/* --- W28 (Jul 6-12, 2026) LIVE TOAST DATA --- */
{"venue":"Casa Neos Beach Club","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-11","label":"Saturday, July 11","dj":"BARUT","fee":500,"bsActual":15688.38,"bsMin":37500,"tablesActual":5,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":9803,"avgPerTable":4902,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":3,"totalTables":15,"totalSales":4676,"avgPerTable":1559,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"51","tier":"Diamond","sales":9767,"checks":1,"minPerTable":4000},{"table":"46","tier":"Platinum","sales":2301,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1328,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":1047,"checks":1,"minPerTable":2000},{"table":"52","tier":"Diamond","sales":36,"checks":2,"minPerTable":4000},{"table":"34","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"31","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"41","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"32","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"47","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"48","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"49","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"53","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"54","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"56","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"24","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"25","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"26","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"27","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"28","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"19","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"21","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"22","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"23","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":31.3768,"roiTarget":75},{"date":"2026-07-12","label":"Sunday, July 12","dj":"JOEZI","fee":12000,"bsActual":187594,"bsMin":60000,"tablesActual":27,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":21502,"avgPerTable":10751,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":2,"totalTables":2,"totalSales":20498,"avgPerTable":10249,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":14,"totalTables":15,"totalSales":84049,"avgPerTable":6004,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":23243,"avgPerTable":4649,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":4,"totalTables":5,"totalSales":13358,"avgPerTable":3340,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"48","tier":"Platinum","sales":26160,"checks":1,"minPerTable":2000},{"table":"41","tier":"Prestige","sales":14150,"checks":1,"minPerTable":3500},{"table":"34","tier":"Diamond","sales":14050,"checks":2,"minPerTable":4000},{"table":"54","tier":"Platinum","sales":8010,"checks":1,"minPerTable":2000},{"table":"26","tier":"Gold","sales":7826,"checks":1,"minPerTable":1500},{"table":"49","tier":"Platinum","sales":7728,"checks":1,"minPerTable":2000},{"table":"51","tier":"Diamond","sales":7452,"checks":1,"minPerTable":4000},{"table":"32","tier":"Platinum","sales":7155,"checks":1,"minPerTable":2000},{"table":"24","tier":"Gold","sales":6722,"checks":1,"minPerTable":1500},{"table":"31","tier":"Prestige","sales":6348,"checks":2,"minPerTable":3500},{"table":"23","tier":"Riverwalk","sales":4971,"checks":1,"minPerTable":1000},{"table":"56","tier":"Platinum","sales":4869,"checks":1,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":4280,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":3842,"checks":1,"minPerTable":2000},{"table":"25","tier":"Gold","sales":3708,"checks":1,"minPerTable":1500},{"table":"53","tier":"Platinum","sales":3506,"checks":1,"minPerTable":2000},{"table":"27","tier":"Gold","sales":3452,"checks":2,"minPerTable":1500},{"table":"22","tier":"Riverwalk","sales":3364,"checks":1,"minPerTable":1000},{"table":"19","tier":"Riverwalk","sales":3146,"checks":1,"minPerTable":1000},{"table":"47","tier":"Platinum","sales":3113,"checks":1,"minPerTable":2000},{"table":"46","tier":"Platinum","sales":2708,"checks":1,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":2616,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1950,"checks":1,"minPerTable":2000},{"table":"21","tier":"Riverwalk","sales":1877,"checks":1,"minPerTable":1000},{"table":"28","tier":"Gold","sales":1535,"checks":1,"minPerTable":1500},{"table":"52","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":15.6328,"roiTarget":5}]},{"venue":"MILA Lounge","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-08","label":"Wednesday, July 8","dj":"LEX","fee":500,"bsActual":105,"bsMin":15000,"tablesActual":0,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"305","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"409","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"404","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"301","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"302","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"304","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"308","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"410","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":0.21,"roiTarget":30},{"date":"2026-07-09","label":"Thursday, July 9","dj":"SPARROW","fee":6500,"bsActual":39342,"bsMin":25000,"tablesActual":11,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":19315,"avgPerTable":3219,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3348,"avgPerTable":3348,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":4,"totalTables":8,"totalSales":7704,"avgPerTable":1926,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"307","tier":"Diamond","sales":5622,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3827,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":3348,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":3147,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":2899,"checks":2,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2464,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":2437,"checks":1,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":2066,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2000,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1392,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":1165,"checks":2,"minPerTable":1000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"410","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":6.0526,"roiTarget":3.8462},{"date":"2026-07-10","label":"Friday, July 10","dj":"ENOO NAPA","fee":7000,"bsActual":82915.5,"bsMin":45000,"tablesActual":13,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":5,"totalTables":8,"totalSales":42709,"avgPerTable":8542,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":7756,"avgPerTable":7756,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":7,"totalTables":8,"totalSales":22993,"avgPerTable":3285,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"407","tier":"Diamond","sales":18824,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":12478,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":7756,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":4688,"checks":2,"minPerTable":1000},{"table":"303","tier":"Gold","sales":4482,"checks":1,"minPerTable":1000},{"table":"401","tier":"Gold","sales":4280,"checks":1,"minPerTable":1000},{"table":"306","tier":"Diamond","sales":4050,"checks":1,"minPerTable":2000},{"table":"304","tier":"Gold","sales":3902,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":3803,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":3554,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2248,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":2082,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1311,"checks":1,"minPerTable":1000},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":11.8451,"roiTarget":6.4286},{"date":"2026-07-11","label":"Saturday, July 11","dj":"SAMANTHA LOVERIDGE","fee":1000,"bsActual":72141,"bsMin":45000,"tablesActual":15,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":23410,"avgPerTable":3902,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3220,"avgPerTable":3220,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":8,"totalTables":8,"totalSales":23760,"avgPerTable":2970,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"409","tier":"Diamond","sales":5902,"checks":4,"minPerTable":2000},{"table":"301","tier":"Gold","sales":5520,"checks":2,"minPerTable":1000},{"table":"307","tier":"Diamond","sales":4847,"checks":2,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":3776,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3692,"checks":1,"minPerTable":2000},{"table":"401","tier":"Gold","sales":3545,"checks":1,"minPerTable":1000},{"table":"308","tier":"Gold","sales":3466,"checks":1,"minPerTable":1000},{"table":"404","tier":"Prestige","sales":3220,"checks":1,"minPerTable":3000},{"table":"303","tier":"Gold","sales":2666,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":2649,"checks":1,"minPerTable":1000},{"table":"305","tier":"Diamond","sales":2599,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2594,"checks":1,"minPerTable":2000},{"table":"302","tier":"Gold","sales":2162,"checks":2,"minPerTable":1000},{"table":"402","tier":"Gold","sales":2042,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":1710,"checks":1,"minPerTable":1000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000}],"roiActual":72.141,"roiTarget":45}]},{"venue":"Casa Neos Lounge","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-09","label":"Thursday, July 9","dj":"BARUT","fee":500,"bsActual":24970,"bsMin":25000,"tablesActual":11,"tablesBudget":20,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":12984,"avgPerTable":2164,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":4,"totalTables":10,"totalSales":4923,"avgPerTable":1231,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":1,"totalTables":4,"totalSales":1570,"avgPerTable":1570,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":4118,"checks":1,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":3132,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":2867,"checks":77,"minPerTable":0},{"table":"908","tier":"Platinum","sales":1635,"checks":1,"minPerTable":1500},{"table":"903","tier":"Diamond","sales":1605,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":1580,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":1570,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":1549,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":1545,"checks":1,"minPerTable":2000},{"table":"905","tier":"Diamond","sales":1035,"checks":1,"minPerTable":2000},{"table":"909","tier":"Platinum","sales":928,"checks":1,"minPerTable":1500},{"table":"807","tier":"Platinum","sales":780,"checks":1,"minPerTable":1500},{"table":"810","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"910","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"911","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"912","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"805","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":49.94,"roiTarget":0},{"date":"2026-07-10","label":"Friday, July 10","dj":"JENIA TERSOL b2b ECHONOMIST","fee":12000,"bsActual":53542,"bsMin":52500,"tablesActual":16,"tablesBudget":20,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":22839,"avgPerTable":3807,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":6,"totalTables":10,"totalSales":15436,"avgPerTable":2573,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":4,"totalTables":4,"totalSales":7668,"avgPerTable":1917,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":6569,"checks":3,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":5627,"checks":2,"minPerTable":1500},{"table":"806","tier":"Gold","sales":4710,"checks":1,"minPerTable":1000},{"table":"904","tier":"Diamond","sales":4617,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3833,"checks":54,"minPerTable":0},{"table":"809","tier":"Diamond","sales":3590,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3063,"checks":1,"minPerTable":2000},{"table":"905","tier":"Diamond","sales":3000,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":2974,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2535,"checks":1,"minPerTable":1500},{"table":"807","tier":"Platinum","sales":2154,"checks":1,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":2000,"checks":1,"minPerTable":2000},{"table":"906","tier":"Platinum","sales":1111,"checks":1,"minPerTable":1500},{"table":"803","tier":"Gold","sales":1044,"checks":1,"minPerTable":1000},{"table":"910","tier":"Platinum","sales":1035,"checks":1,"minPerTable":1500},{"table":"804","tier":"Gold","sales":1000,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":914,"checks":1,"minPerTable":1000},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"911","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"912","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500}],"roiActual":4.4618,"roiTarget":0},{"date":"2026-07-11","label":"Saturday, July 11","dj":"ONOMA or BIRDS OF MIND","fee":1000,"bsActual":36520,"bsMin":45000,"tablesActual":12,"tablesBudget":20,"tiers":{"Diamond":{"soldTables":5,"totalTables":6,"totalSales":16610,"avgPerTable":3322,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":5,"totalTables":10,"totalSales":10390,"avgPerTable":2078,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":2,"totalTables":4,"totalSales":3444,"avgPerTable":1722,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":6561,"checks":2,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3596,"checks":41,"minPerTable":0},{"table":"807","tier":"Platinum","sales":3550,"checks":1,"minPerTable":1500},{"table":"903","tier":"Diamond","sales":3204,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3042,"checks":1,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":2451,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":2370,"checks":1,"minPerTable":1000},{"table":"908","tier":"Platinum","sales":2250,"checks":1,"minPerTable":1500},{"table":"904","tier":"Diamond","sales":2224,"checks":1,"minPerTable":2000},{"table":"907","tier":"Platinum","sales":2085,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1579,"checks":1,"minPerTable":2000},{"table":"805","tier":"Gold","sales":1074,"checks":2,"minPerTable":1000},{"table":"910","tier":"Platinum","sales":54,"checks":1,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"911","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"912","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":36.52,"roiTarget":0},{"date":"2026-07-12","label":"Sunday, July 12","dj":"AFTERDARK","fee":500,"bsActual":74650,"bsMin":20000,"tablesActual":17,"tablesBudget":20,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":30048,"avgPerTable":5008,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":7,"totalTables":10,"totalSales":19572,"avgPerTable":2796,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":4,"totalTables":4,"totalSales":10937,"avgPerTable":2734,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":7078,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":6605,"checks":126,"minPerTable":0},{"table":"806","tier":"Gold","sales":6536,"checks":4,"minPerTable":1000},{"table":"809","tier":"Diamond","sales":6183,"checks":2,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":6134,"checks":2,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":5287,"checks":2,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":4766,"checks":2,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":4015,"checks":1,"minPerTable":2000},{"table":"910","tier":"Platinum","sales":3743,"checks":2,"minPerTable":1500},{"table":"803","tier":"Gold","sales":2777,"checks":2,"minPerTable":1000},{"table":"807","tier":"Platinum","sales":2672,"checks":1,"minPerTable":1500},{"table":"906","tier":"Platinum","sales":2542,"checks":1,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":2262,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2045,"checks":1,"minPerTable":1500},{"table":"810","tier":"Platinum","sales":1542,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1351,"checks":1,"minPerTable":2000},{"table":"804","tier":"Gold","sales":899,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":725,"checks":1,"minPerTable":1000},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"911","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"912","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500}],"roiActual":149.3,"roiTarget":0}]},
/* --- W27 (Jul 4-5, 2026) --- */
/* --- W28 (Jul 6-12, 2026) LIVE TOAST DATA --- */
{"venue":"Casa Neos Beach Club","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-11","label":"Saturday, July 11","dj":"BARUT","fee":500,"bsActual":15688.38,"bsMin":37500,"tablesActual":5,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":9803,"avgPerTable":4902,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":3,"totalTables":15,"totalSales":4676,"avgPerTable":1559,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"51","tier":"Diamond","sales":9767,"checks":1,"minPerTable":4000},{"table":"46","tier":"Platinum","sales":2301,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1328,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":1047,"checks":1,"minPerTable":2000},{"table":"52","tier":"Diamond","sales":36,"checks":2,"minPerTable":4000},{"table":"34","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"31","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"41","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"32","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"47","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"48","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"49","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"53","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"54","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"56","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"24","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"25","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"26","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"27","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"28","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"19","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"21","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"22","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"23","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":31.3768,"roiTarget":75},{"date":"2026-07-12","label":"Sunday, July 12","dj":"JOEZI","fee":12000,"bsActual":187594,"bsMin":60000,"tablesActual":27,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":21502,"avgPerTable":10751,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":2,"totalTables":2,"totalSales":20498,"avgPerTable":10249,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":14,"totalTables":15,"totalSales":84049,"avgPerTable":6004,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":23243,"avgPerTable":4649,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":4,"totalTables":5,"totalSales":13358,"avgPerTable":3340,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"48","tier":"Platinum","sales":26160,"checks":1,"minPerTable":2000},{"table":"41","tier":"Prestige","sales":14150,"checks":1,"minPerTable":3500},{"table":"34","tier":"Diamond","sales":14050,"checks":2,"minPerTable":4000},{"table":"54","tier":"Platinum","sales":8010,"checks":1,"minPerTable":2000},{"table":"26","tier":"Gold","sales":7826,"checks":1,"minPerTable":1500},{"table":"49","tier":"Platinum","sales":7728,"checks":1,"minPerTable":2000},{"table":"51","tier":"Diamond","sales":7452,"checks":1,"minPerTable":4000},{"table":"32","tier":"Platinum","sales":7155,"checks":1,"minPerTable":2000},{"table":"24","tier":"Gold","sales":6722,"checks":1,"minPerTable":1500},{"table":"31","tier":"Prestige","sales":6348,"checks":2,"minPerTable":3500},{"table":"23","tier":"Riverwalk","sales":4971,"checks":1,"minPerTable":1000},{"table":"56","tier":"Platinum","sales":4869,"checks":1,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":4280,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":3842,"checks":1,"minPerTable":2000},{"table":"25","tier":"Gold","sales":3708,"checks":1,"minPerTable":1500},{"table":"53","tier":"Platinum","sales":3506,"checks":1,"minPerTable":2000},{"table":"27","tier":"Gold","sales":3452,"checks":2,"minPerTable":1500},{"table":"22","tier":"Riverwalk","sales":3364,"checks":1,"minPerTable":1000},{"table":"19","tier":"Riverwalk","sales":3146,"checks":1,"minPerTable":1000},{"table":"47","tier":"Platinum","sales":3113,"checks":1,"minPerTable":2000},{"table":"46","tier":"Platinum","sales":2708,"checks":1,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":2616,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1950,"checks":1,"minPerTable":2000},{"table":"21","tier":"Riverwalk","sales":1877,"checks":1,"minPerTable":1000},{"table":"28","tier":"Gold","sales":1535,"checks":1,"minPerTable":1500},{"table":"52","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":15.6328,"roiTarget":5}]},{"venue":"MILA Lounge","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-08","label":"Wednesday, July 8","dj":"LEX","fee":500,"bsActual":105,"bsMin":15000,"tablesActual":0,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"305","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"409","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"404","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"301","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"302","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"304","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"308","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"410","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":0.21,"roiTarget":30},{"date":"2026-07-09","label":"Thursday, July 9","dj":"SPARROW","fee":6500,"bsActual":39342,"bsMin":25000,"tablesActual":11,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":19315,"avgPerTable":3219,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3348,"avgPerTable":3348,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":4,"totalTables":8,"totalSales":7704,"avgPerTable":1926,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"307","tier":"Diamond","sales":5622,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3827,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":3348,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":3147,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":2899,"checks":2,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2464,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":2437,"checks":1,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":2066,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2000,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1392,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":1165,"checks":2,"minPerTable":1000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"410","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":6.0526,"roiTarget":3.8462},{"date":"2026-07-10","label":"Friday, July 10","dj":"ENOO NAPA","fee":7000,"bsActual":82915.5,"bsMin":45000,"tablesActual":13,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":5,"totalTables":8,"totalSales":42709,"avgPerTable":8542,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":7756,"avgPerTable":7756,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":7,"totalTables":8,"totalSales":22993,"avgPerTable":3285,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"407","tier":"Diamond","sales":18824,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":12478,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":7756,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":4688,"checks":2,"minPerTable":1000},{"table":"303","tier":"Gold","sales":4482,"checks":1,"minPerTable":1000},{"table":"401","tier":"Gold","sales":4280,"checks":1,"minPerTable":1000},{"table":"306","tier":"Diamond","sales":4050,"checks":1,"minPerTable":2000},{"table":"304","tier":"Gold","sales":3902,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":3803,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":3554,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2248,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":2082,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1311,"checks":1,"minPerTable":1000},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000}],"roiActual":11.8451,"roiTarget":6.4286},{"date":"2026-07-11","label":"Saturday, July 11","dj":"SAMANTHA LOVERIDGE","fee":1000,"bsActual":72141,"bsMin":45000,"tablesActual":15,"tablesBudget":18,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":23410,"avgPerTable":3902,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3220,"avgPerTable":3220,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":8,"totalTables":8,"totalSales":23760,"avgPerTable":2970,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"}},"tableDetail":[{"table":"409","tier":"Diamond","sales":5902,"checks":4,"minPerTable":2000},{"table":"301","tier":"Gold","sales":5520,"checks":2,"minPerTable":1000},{"table":"307","tier":"Diamond","sales":4847,"checks":2,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":3776,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3692,"checks":1,"minPerTable":2000},{"table":"401","tier":"Gold","sales":3545,"checks":1,"minPerTable":1000},{"table":"308","tier":"Gold","sales":3466,"checks":1,"minPerTable":1000},{"table":"404","tier":"Prestige","sales":3220,"checks":1,"minPerTable":3000},{"table":"303","tier":"Gold","sales":2666,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":2649,"checks":1,"minPerTable":1000},{"table":"305","tier":"Diamond","sales":2599,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2594,"checks":1,"minPerTable":2000},{"table":"302","tier":"Gold","sales":2162,"checks":2,"minPerTable":1000},{"table":"402","tier":"Gold","sales":2042,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":1710,"checks":1,"minPerTable":1000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000}],"roiActual":72.141,"roiTarget":45}]},{"venue":"Casa Neos Lounge","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-09","label":"Thursday, July 9","dj":"BARUT","fee":500,"bsActual":24970,"bsMin":25000,"tablesActual":17,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":12984,"avgPerTable":2164,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":3,"totalTables":6,"totalSales":4143,"avgPerTable":1381,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":2,"totalTables":5,"totalSales":2350,"avgPerTable":1175,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":6,"totalTables":24,"totalSales":2626,"avgPerTable":438,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":4118,"checks":1,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":3132,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":2867,"checks":77,"minPerTable":0},{"table":"908","tier":"Platinum","sales":1635,"checks":1,"minPerTable":1500},{"table":"903","tier":"Diamond","sales":1605,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":1580,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":1570,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":1549,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":1545,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":1074,"checks":21,"minPerTable":500},{"table":"905","tier":"Diamond","sales":1035,"checks":1,"minPerTable":2000},{"table":"909","tier":"Platinum","sales":928,"checks":1,"minPerTable":1500},{"table":"807","tier":"Gold","sales":780,"checks":1,"minPerTable":1000},{"table":"L8A","tier":"Lounge","sales":500,"checks":1,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":500,"checks":1,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":357,"checks":13,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":185,"checks":5,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":10,"checks":1,"minPerTable":500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"810","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"805","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":49.94,"roiTarget":0},{"date":"2026-07-10","label":"Friday, July 10","dj":"JENIA TERSOL b2b ECHONOMIST","fee":12000,"bsActual":53542,"bsMin":52500,"tablesActual":23,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":22839,"avgPerTable":3807,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":4,"totalTables":6,"totalSales":12247,"avgPerTable":3062,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":9822,"avgPerTable":1964,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":8,"totalTables":24,"totalSales":3766,"avgPerTable":471,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":6569,"checks":3,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":5627,"checks":2,"minPerTable":1500},{"table":"806","tier":"Gold","sales":4710,"checks":1,"minPerTable":1000},{"table":"904","tier":"Diamond","sales":4617,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3833,"checks":54,"minPerTable":0},{"table":"809","tier":"Diamond","sales":3590,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3063,"checks":1,"minPerTable":2000},{"table":"905","tier":"Diamond","sales":3000,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":2974,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2535,"checks":1,"minPerTable":1500},{"table":"807","tier":"Gold","sales":2154,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":2000,"checks":1,"minPerTable":2000},{"table":"L3","tier":"Lounge","sales":1122,"checks":22,"minPerTable":500},{"table":"906","tier":"Platinum","sales":1111,"checks":1,"minPerTable":1500},{"table":"803","tier":"Gold","sales":1044,"checks":1,"minPerTable":1000},{"table":"804","tier":"Gold","sales":1000,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":914,"checks":1,"minPerTable":1000},{"table":"L5","tier":"Lounge","sales":816,"checks":9,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":513,"checks":7,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":406,"checks":2,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":314,"checks":2,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":239,"checks":4,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":237,"checks":2,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":119,"checks":4,"minPerTable":500},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":4.4618,"roiTarget":0},{"date":"2026-07-11","label":"Saturday, July 11","dj":"ONOMA or BIRDS OF MIND","fee":1000,"bsActual":36520,"bsMin":45000,"tablesActual":16,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":5,"totalTables":6,"totalSales":16610,"avgPerTable":3322,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":3,"totalTables":6,"totalSales":6786,"avgPerTable":2262,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":3,"totalTables":5,"totalSales":6994,"avgPerTable":2331,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":5,"totalTables":24,"totalSales":2480,"avgPerTable":496,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":6561,"checks":2,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3596,"checks":41,"minPerTable":0},{"table":"807","tier":"Gold","sales":3550,"checks":1,"minPerTable":1000},{"table":"903","tier":"Diamond","sales":3204,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3042,"checks":1,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":2451,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":2370,"checks":1,"minPerTable":1000},{"table":"908","tier":"Platinum","sales":2250,"checks":1,"minPerTable":1500},{"table":"904","tier":"Diamond","sales":2224,"checks":1,"minPerTable":2000},{"table":"907","tier":"Platinum","sales":2085,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1579,"checks":1,"minPerTable":2000},{"table":"805","tier":"Gold","sales":1074,"checks":2,"minPerTable":1000},{"table":"L3","tier":"Lounge","sales":952,"checks":17,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":880,"checks":8,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":480,"checks":12,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":144,"checks":3,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":24,"checks":1,"minPerTable":500},{"table":"902","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":36.52,"roiTarget":0},{"date":"2026-07-12","label":"Sunday, July 12","dj":"AFTERDARK","fee":500,"bsActual":74650,"bsMin":20000,"tablesActual":23,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":30048,"avgPerTable":5008,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":5,"totalTables":6,"totalSales":13157,"avgPerTable":2631,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":13609,"avgPerTable":2722,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":7,"totalTables":24,"totalSales":7488,"avgPerTable":1070,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":7078,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":6605,"checks":126,"minPerTable":0},{"table":"806","tier":"Gold","sales":6536,"checks":4,"minPerTable":1000},{"table":"809","tier":"Diamond","sales":6183,"checks":2,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":6134,"checks":2,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":5287,"checks":2,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":4766,"checks":2,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":4015,"checks":1,"minPerTable":2000},{"table":"803","tier":"Gold","sales":2777,"checks":2,"minPerTable":1000},{"table":"807","tier":"Gold","sales":2672,"checks":1,"minPerTable":1000},{"table":"906","tier":"Platinum","sales":2542,"checks":1,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":2262,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2045,"checks":1,"minPerTable":1500},{"table":"L5","tier":"Lounge","sales":1951,"checks":42,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":1880,"checks":38,"minPerTable":500},{"table":"810","tier":"Platinum","sales":1542,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1351,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":1285,"checks":19,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":1163,"checks":2,"minPerTable":500},{"table":"804","tier":"Gold","sales":899,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":725,"checks":1,"minPerTable":1000},{"table":"L5A","tier":"Lounge","sales":591,"checks":5,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":332,"checks":5,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":286,"checks":10,"minPerTable":500},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":149.3,"roiTarget":0}]},
/* --- W27 (Jul 4-5, 2026) --- */
/* --- W28 (Jul 6-12, 2026) LIVE TOAST DATA --- */
{"venue":"Casa Neos Beach Club","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-11","label":"Saturday, July 11","dj":"BARUT","fee":500,"bsActual":15688.38,"bsMin":37500,"tablesActual":5,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":9803,"avgPerTable":4902,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":3,"totalTables":15,"totalSales":4676,"avgPerTable":1559,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"51","tier":"Diamond","sales":9767,"checks":1,"minPerTable":4000},{"table":"46","tier":"Platinum","sales":2301,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1328,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":1047,"checks":1,"minPerTable":2000},{"table":"52","tier":"Diamond","sales":36,"checks":2,"minPerTable":4000},{"table":"34","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"31","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"41","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"32","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"47","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"48","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"49","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"53","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"54","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"56","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"24","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"25","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"26","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"27","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"28","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"19","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"21","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"22","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"23","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":31.3768,"roiTarget":75},{"date":"2026-07-12","label":"Sunday, July 12","dj":"JOEZI","fee":12000,"bsActual":187594,"bsMin":60000,"tablesActual":27,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":21502,"avgPerTable":10751,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":2,"totalTables":2,"totalSales":20498,"avgPerTable":10249,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":14,"totalTables":15,"totalSales":84049,"avgPerTable":6004,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":23243,"avgPerTable":4649,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":4,"totalTables":5,"totalSales":13358,"avgPerTable":3340,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"48","tier":"Platinum","sales":26160,"checks":1,"minPerTable":2000},{"table":"41","tier":"Prestige","sales":14150,"checks":1,"minPerTable":3500},{"table":"34","tier":"Diamond","sales":14050,"checks":2,"minPerTable":4000},{"table":"54","tier":"Platinum","sales":8010,"checks":1,"minPerTable":2000},{"table":"26","tier":"Gold","sales":7826,"checks":1,"minPerTable":1500},{"table":"49","tier":"Platinum","sales":7728,"checks":1,"minPerTable":2000},{"table":"51","tier":"Diamond","sales":7452,"checks":1,"minPerTable":4000},{"table":"32","tier":"Platinum","sales":7155,"checks":1,"minPerTable":2000},{"table":"24","tier":"Gold","sales":6722,"checks":1,"minPerTable":1500},{"table":"31","tier":"Prestige","sales":6348,"checks":2,"minPerTable":3500},{"table":"23","tier":"Riverwalk","sales":4971,"checks":1,"minPerTable":1000},{"table":"56","tier":"Platinum","sales":4869,"checks":1,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":4280,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":3842,"checks":1,"minPerTable":2000},{"table":"25","tier":"Gold","sales":3708,"checks":1,"minPerTable":1500},{"table":"53","tier":"Platinum","sales":3506,"checks":1,"minPerTable":2000},{"table":"27","tier":"Gold","sales":3452,"checks":2,"minPerTable":1500},{"table":"22","tier":"Riverwalk","sales":3364,"checks":1,"minPerTable":1000},{"table":"19","tier":"Riverwalk","sales":3146,"checks":1,"minPerTable":1000},{"table":"47","tier":"Platinum","sales":3113,"checks":1,"minPerTable":2000},{"table":"46","tier":"Platinum","sales":2708,"checks":1,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":2616,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1950,"checks":1,"minPerTable":2000},{"table":"21","tier":"Riverwalk","sales":1877,"checks":1,"minPerTable":1000},{"table":"28","tier":"Gold","sales":1535,"checks":1,"minPerTable":1500},{"table":"52","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":15.6328,"roiTarget":5}]},{"venue":"MILA Lounge","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-08","label":"Wednesday, July 8","dj":"LEX","fee":500,"bsActual":105,"bsMin":15000,"tablesActual":1,"tablesBudget":72,"tiers":{"Diamond":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":1,"totalTables":24,"totalSales":32,"avgPerTable":32,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":0,"totalTables":30,"totalSales":0,"avgPerTable":0,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"4","tier":"Booths","sales":32,"checks":1,"minPerTable":500},{"table":"305","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"409","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"404","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"301","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"302","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"304","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"308","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"410","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"2","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"5","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"6","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"8","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"9","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"1A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"2A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"4A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"5A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"6A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"8A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"9A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S1","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S3","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S4","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S5","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S6","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S7","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S8","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S9","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S11","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S15","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S16","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S17","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":0.21,"roiTarget":30},{"date":"2026-07-09","label":"Thursday, July 9","dj":"SPARROW","fee":6500,"bsActual":39342,"bsMin":25000,"tablesActual":31,"tablesBudget":72,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":19315,"avgPerTable":3219,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3348,"avgPerTable":3348,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":4,"totalTables":8,"totalSales":7704,"avgPerTable":1926,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":12,"totalTables":24,"totalSales":1838,"avgPerTable":153,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":8,"totalTables":30,"totalSales":794,"avgPerTable":99,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"307","tier":"Diamond","sales":5622,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3827,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":3348,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":3147,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":2899,"checks":2,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2464,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":2437,"checks":1,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":2066,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2000,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1392,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":1165,"checks":2,"minPerTable":1000},{"table":"8","tier":"Booths","sales":472,"checks":12,"minPerTable":500},{"table":"S4","tier":"Seating","sales":295,"checks":6,"minPerTable":200},{"table":"9","tier":"Booths","sales":276,"checks":7,"minPerTable":500},{"table":"7","tier":"Booths","sales":246,"checks":7,"minPerTable":500},{"table":"6","tier":"Booths","sales":243,"checks":6,"minPerTable":500},{"table":"11A","tier":"Booths","sales":180,"checks":1,"minPerTable":500},{"table":"S5","tier":"Seating","sales":128,"checks":3,"minPerTable":200},{"table":"s2","tier":"Other","sales":127,"checks":2,"minPerTable":0},{"table":"S3","tier":"Seating","sales":101,"checks":3,"minPerTable":200},{"table":"5","tier":"Booths","sales":100,"checks":1,"minPerTable":500},{"table":"S6","tier":"Seating","sales":92,"checks":2,"minPerTable":200},{"table":"4A","tier":"Booths","sales":88,"checks":2,"minPerTable":500},{"table":"6A","tier":"Booths","sales":76,"checks":2,"minPerTable":500},{"table":"S7","tier":"Seating","sales":66,"checks":2,"minPerTable":200},{"table":"4","tier":"Booths","sales":65,"checks":1,"minPerTable":500},{"table":"S1","tier":"Seating","sales":48,"checks":1,"minPerTable":200},{"table":"8A","tier":"Booths","sales":45,"checks":2,"minPerTable":500},{"table":"S9","tier":"Seating","sales":44,"checks":1,"minPerTable":200},{"table":"9A","tier":"Booths","sales":25,"checks":1,"minPerTable":500},{"table":"2A","tier":"Booths","sales":22,"checks":1,"minPerTable":500},{"table":"S15","tier":"Seating","sales":20,"checks":1,"minPerTable":200},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"410","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"2","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"1A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"5A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S8","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S11","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S16","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S17","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":6.0526,"roiTarget":3.8462},{"date":"2026-07-10","label":"Friday, July 10","dj":"ENOO NAPA","fee":7000,"bsActual":82915.5,"bsMin":45000,"tablesActual":37,"tablesBudget":72,"tiers":{"Diamond":{"soldTables":5,"totalTables":8,"totalSales":42709,"avgPerTable":8542,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":7756,"avgPerTable":7756,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":7,"totalTables":8,"totalSales":22993,"avgPerTable":3285,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":17,"totalTables":24,"totalSales":5623,"avgPerTable":331,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":7,"totalTables":30,"totalSales":1058,"avgPerTable":151,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"407","tier":"Diamond","sales":18824,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":12478,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":7756,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":4688,"checks":2,"minPerTable":1000},{"table":"303","tier":"Gold","sales":4482,"checks":1,"minPerTable":1000},{"table":"401","tier":"Gold","sales":4280,"checks":1,"minPerTable":1000},{"table":"306","tier":"Diamond","sales":4050,"checks":1,"minPerTable":2000},{"table":"304","tier":"Gold","sales":3902,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":3803,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":3554,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2248,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":2082,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1311,"checks":1,"minPerTable":1000},{"table":"6A","tier":"Booths","sales":960,"checks":4,"minPerTable":500},{"table":"9","tier":"Booths","sales":880,"checks":17,"minPerTable":500},{"table":"8","tier":"Booths","sales":573,"checks":7,"minPerTable":500},{"table":"5","tier":"Booths","sales":482,"checks":1,"minPerTable":500},{"table":"1A","tier":"Booths","sales":421,"checks":8,"minPerTable":500},{"table":"S5","tier":"Seating","sales":340,"checks":6,"minPerTable":200},{"table":"9A","tier":"Booths","sales":323,"checks":8,"minPerTable":500},{"table":"8A","tier":"Booths","sales":315,"checks":4,"minPerTable":500},{"table":"4","tier":"Booths","sales":275,"checks":4,"minPerTable":500},{"table":"S6","tier":"Seating","sales":265,"checks":5,"minPerTable":200},{"table":"S7","tier":"Seating","sales":227,"checks":6,"minPerTable":200},{"table":"11A","tier":"Booths","sales":222,"checks":2,"minPerTable":500},{"table":"7","tier":"Booths","sales":208,"checks":4,"minPerTable":500},{"table":"2A","tier":"Booths","sales":203,"checks":3,"minPerTable":500},{"table":"4A","tier":"Booths","sales":177,"checks":2,"minPerTable":500},{"table":"S9","tier":"Seating","sales":163,"checks":2,"minPerTable":200},{"table":"6","tier":"Booths","sales":161,"checks":2,"minPerTable":500},{"table":"10A","tier":"Booths","sales":124,"checks":2,"minPerTable":500},{"table":"5A","tier":"Booths","sales":122,"checks":2,"minPerTable":500},{"table":"2","tier":"Booths","sales":94,"checks":2,"minPerTable":500},{"table":"3A","tier":"Booths","sales":83,"checks":2,"minPerTable":500},{"table":"s2","tier":"Other","sales":44,"checks":2,"minPerTable":0},{"table":"S8","tier":"Seating","sales":40,"checks":1,"minPerTable":200},{"table":"S16","tier":"Seating","sales":21,"checks":1,"minPerTable":200},{"table":"S17","tier":"Seating","sales":2,"checks":1,"minPerTable":200},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"402","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S1","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S3","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S4","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S11","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S15","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":11.8451,"roiTarget":6.4286},{"date":"2026-07-11","label":"Saturday, July 11","dj":"SAMANTHA LOVERIDGE","fee":1000,"bsActual":72141,"bsMin":45000,"tablesActual":39,"tablesBudget":72,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":23410,"avgPerTable":3902,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3220,"avgPerTable":3220,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":8,"totalTables":8,"totalSales":23760,"avgPerTable":2970,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":16,"totalTables":24,"totalSales":4355,"avgPerTable":272,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":8,"totalTables":30,"totalSales":906,"avgPerTable":113,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"409","tier":"Diamond","sales":5902,"checks":4,"minPerTable":2000},{"table":"301","tier":"Gold","sales":5520,"checks":2,"minPerTable":1000},{"table":"307","tier":"Diamond","sales":4847,"checks":2,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":3776,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3692,"checks":1,"minPerTable":2000},{"table":"401","tier":"Gold","sales":3545,"checks":1,"minPerTable":1000},{"table":"308","tier":"Gold","sales":3466,"checks":1,"minPerTable":1000},{"table":"404","tier":"Prestige","sales":3220,"checks":1,"minPerTable":3000},{"table":"303","tier":"Gold","sales":2666,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":2649,"checks":1,"minPerTable":1000},{"table":"305","tier":"Diamond","sales":2599,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2594,"checks":1,"minPerTable":2000},{"table":"302","tier":"Gold","sales":2162,"checks":2,"minPerTable":1000},{"table":"402","tier":"Gold","sales":2042,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":1710,"checks":1,"minPerTable":1000},{"table":"2","tier":"Booths","sales":1205,"checks":5,"minPerTable":500},{"table":"4","tier":"Booths","sales":890,"checks":2,"minPerTable":500},{"table":"6","tier":"Booths","sales":595,"checks":1,"minPerTable":500},{"table":"S9","tier":"Seating","sales":391,"checks":2,"minPerTable":200},{"table":"10A","tier":"Booths","sales":279,"checks":5,"minPerTable":500},{"table":"5A","tier":"Booths","sales":252,"checks":2,"minPerTable":500},{"table":"4A","tier":"Booths","sales":250,"checks":3,"minPerTable":500},{"table":"5","tier":"Booths","sales":161,"checks":3,"minPerTable":500},{"table":"S3","tier":"Seating","sales":141,"checks":1,"minPerTable":200},{"table":"9A","tier":"Booths","sales":139,"checks":2,"minPerTable":500},{"table":"1A","tier":"Booths","sales":138,"checks":1,"minPerTable":500},{"table":"S4","tier":"Seating","sales":131,"checks":3,"minPerTable":200},{"table":"11A","tier":"Booths","sales":128,"checks":2,"minPerTable":500},{"table":"8A","tier":"Booths","sales":98,"checks":3,"minPerTable":500},{"table":"S11","tier":"Seating","sales":80,"checks":1,"minPerTable":200},{"table":"3A","tier":"Booths","sales":72,"checks":1,"minPerTable":500},{"table":"S6","tier":"Seating","sales":70,"checks":1,"minPerTable":200},{"table":"7","tier":"Booths","sales":61,"checks":1,"minPerTable":500},{"table":"2A","tier":"Booths","sales":55,"checks":1,"minPerTable":500},{"table":"S7","tier":"Seating","sales":53,"checks":1,"minPerTable":200},{"table":"s2","tier":"Other","sales":50,"checks":2,"minPerTable":0},{"table":"8","tier":"Booths","sales":20,"checks":1,"minPerTable":500},{"table":"S8","tier":"Seating","sales":20,"checks":1,"minPerTable":200},{"table":"S5","tier":"Seating","sales":20,"checks":1,"minPerTable":200},{"table":"7A","tier":"Booths","sales":12,"checks":1,"minPerTable":500},{"table":"405","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"9","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"6A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S1","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S15","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S16","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S17","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":72.141,"roiTarget":45}]},{"venue":"Casa Neos Lounge","weekOf":"Jul 6  Jul 12, 2026","weekKey":"2026-W28","shows":[{"date":"2026-07-09","label":"Thursday, July 9","dj":"BARUT","fee":500,"bsActual":24970,"bsMin":25000,"tablesActual":17,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":12984,"avgPerTable":2164,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":3,"totalTables":6,"totalSales":4143,"avgPerTable":1381,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":2,"totalTables":5,"totalSales":2350,"avgPerTable":1175,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":6,"totalTables":24,"totalSales":2626,"avgPerTable":438,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":4118,"checks":1,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":3132,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":2867,"checks":77,"minPerTable":0},{"table":"908","tier":"Platinum","sales":1635,"checks":1,"minPerTable":1500},{"table":"903","tier":"Diamond","sales":1605,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":1580,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":1570,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":1549,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":1545,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":1074,"checks":21,"minPerTable":500},{"table":"905","tier":"Diamond","sales":1035,"checks":1,"minPerTable":2000},{"table":"909","tier":"Platinum","sales":928,"checks":1,"minPerTable":1500},{"table":"807","tier":"Gold","sales":780,"checks":1,"minPerTable":1000},{"table":"L8A","tier":"Lounge","sales":500,"checks":1,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":500,"checks":1,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":357,"checks":13,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":185,"checks":5,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":10,"checks":1,"minPerTable":500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"810","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"805","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":49.94,"roiTarget":0},{"date":"2026-07-10","label":"Friday, July 10","dj":"JENIA TERSOL b2b ECHONOMIST","fee":12000,"bsActual":53542,"bsMin":52500,"tablesActual":23,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":22839,"avgPerTable":3807,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":4,"totalTables":6,"totalSales":12247,"avgPerTable":3062,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":9822,"avgPerTable":1964,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":8,"totalTables":24,"totalSales":3766,"avgPerTable":471,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":6569,"checks":3,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":5627,"checks":2,"minPerTable":1500},{"table":"806","tier":"Gold","sales":4710,"checks":1,"minPerTable":1000},{"table":"904","tier":"Diamond","sales":4617,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3833,"checks":54,"minPerTable":0},{"table":"809","tier":"Diamond","sales":3590,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3063,"checks":1,"minPerTable":2000},{"table":"905","tier":"Diamond","sales":3000,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":2974,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2535,"checks":1,"minPerTable":1500},{"table":"807","tier":"Gold","sales":2154,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":2000,"checks":1,"minPerTable":2000},{"table":"L3","tier":"Lounge","sales":1122,"checks":22,"minPerTable":500},{"table":"906","tier":"Platinum","sales":1111,"checks":1,"minPerTable":1500},{"table":"803","tier":"Gold","sales":1044,"checks":1,"minPerTable":1000},{"table":"804","tier":"Gold","sales":1000,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":914,"checks":1,"minPerTable":1000},{"table":"L5","tier":"Lounge","sales":816,"checks":9,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":513,"checks":7,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":406,"checks":2,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":314,"checks":2,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":239,"checks":4,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":237,"checks":2,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":119,"checks":4,"minPerTable":500},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":4.4618,"roiTarget":0},{"date":"2026-07-11","label":"Saturday, July 11","dj":"ONOMA or BIRDS OF MIND","fee":1000,"bsActual":36520,"bsMin":45000,"tablesActual":16,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":5,"totalTables":6,"totalSales":16610,"avgPerTable":3322,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":3,"totalTables":6,"totalSales":6786,"avgPerTable":2262,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":3,"totalTables":5,"totalSales":6994,"avgPerTable":2331,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":5,"totalTables":24,"totalSales":2480,"avgPerTable":496,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":6561,"checks":2,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3596,"checks":41,"minPerTable":0},{"table":"807","tier":"Gold","sales":3550,"checks":1,"minPerTable":1000},{"table":"903","tier":"Diamond","sales":3204,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3042,"checks":1,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":2451,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":2370,"checks":1,"minPerTable":1000},{"table":"908","tier":"Platinum","sales":2250,"checks":1,"minPerTable":1500},{"table":"904","tier":"Diamond","sales":2224,"checks":1,"minPerTable":2000},{"table":"907","tier":"Platinum","sales":2085,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1579,"checks":1,"minPerTable":2000},{"table":"805","tier":"Gold","sales":1074,"checks":2,"minPerTable":1000},{"table":"L3","tier":"Lounge","sales":952,"checks":17,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":880,"checks":8,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":480,"checks":12,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":144,"checks":3,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":24,"checks":1,"minPerTable":500},{"table":"902","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":36.52,"roiTarget":0},{"date":"2026-07-12","label":"Sunday, July 12","dj":"AFTERDARK","fee":500,"bsActual":74650,"bsMin":20000,"tablesActual":23,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":30048,"avgPerTable":5008,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":5,"totalTables":6,"totalSales":13157,"avgPerTable":2631,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":13609,"avgPerTable":2722,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":7,"totalTables":24,"totalSales":7488,"avgPerTable":1070,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":7078,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":6605,"checks":126,"minPerTable":0},{"table":"806","tier":"Gold","sales":6536,"checks":4,"minPerTable":1000},{"table":"809","tier":"Diamond","sales":6183,"checks":2,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":6134,"checks":2,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":5287,"checks":2,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":4766,"checks":2,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":4015,"checks":1,"minPerTable":2000},{"table":"803","tier":"Gold","sales":2777,"checks":2,"minPerTable":1000},{"table":"807","tier":"Gold","sales":2672,"checks":1,"minPerTable":1000},{"table":"906","tier":"Platinum","sales":2542,"checks":1,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":2262,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2045,"checks":1,"minPerTable":1500},{"table":"L5","tier":"Lounge","sales":1951,"checks":42,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":1880,"checks":38,"minPerTable":500},{"table":"810","tier":"Platinum","sales":1542,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1351,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":1285,"checks":19,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":1163,"checks":2,"minPerTable":500},{"table":"804","tier":"Gold","sales":899,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":725,"checks":1,"minPerTable":1000},{"table":"L5A","tier":"Lounge","sales":591,"checks":5,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":332,"checks":5,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":286,"checks":10,"minPerTable":500},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":149.3,"roiTarget":0}]},
/* --- W27 (Jul 4-5, 2026) --- */
/* --- W29 (Jul 7-13, 2026) LIVE TOAST DATA --- */
{"venue":"Casa Neos Beach Club","weekOf":"Jul 7  Jul 13, 2026","weekKey":"2026-W29","shows":[{"date":"2026-07-11","label":"Saturday, July 11","dj":"BARUT","fee":500,"bsActual":15688.38,"bsMin":37500,"tablesActual":5,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":9803,"avgPerTable":4902,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":3,"totalTables":15,"totalSales":4676,"avgPerTable":1559,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":0,"totalTables":5,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"51","tier":"Diamond","sales":9767,"checks":1,"minPerTable":4000},{"table":"46","tier":"Platinum","sales":2301,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1328,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":1047,"checks":1,"minPerTable":2000},{"table":"52","tier":"Diamond","sales":36,"checks":2,"minPerTable":4000},{"table":"34","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"31","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"41","tier":"Prestige","sales":0,"checks":0,"minPerTable":3500},{"table":"32","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"47","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"48","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"49","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"53","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"54","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"56","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"24","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"25","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"26","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"27","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"28","tier":"Gold","sales":0,"checks":0,"minPerTable":1500},{"table":"19","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"21","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"22","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000},{"table":"23","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":31.3768,"roiTarget":75},{"date":"2026-07-12","label":"Sunday, July 12","dj":"JOEZI","fee":12000,"bsActual":187594,"bsMin":60000,"tablesActual":27,"tablesBudget":30,"tiers":{"Diamond":{"soldTables":2,"totalTables":3,"totalSales":21502,"avgPerTable":10751,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":2,"totalTables":2,"totalSales":20498,"avgPerTable":10249,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},"Platinum":{"soldTables":14,"totalTables":15,"totalSales":84049,"avgPerTable":6004,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":23243,"avgPerTable":4649,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},"Riverwalk":{"soldTables":4,"totalTables":5,"totalSales":13358,"avgPerTable":3340,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"48","tier":"Platinum","sales":26160,"checks":1,"minPerTable":2000},{"table":"41","tier":"Prestige","sales":14150,"checks":1,"minPerTable":3500},{"table":"34","tier":"Diamond","sales":14050,"checks":2,"minPerTable":4000},{"table":"54","tier":"Platinum","sales":8010,"checks":1,"minPerTable":2000},{"table":"26","tier":"Gold","sales":7826,"checks":1,"minPerTable":1500},{"table":"49","tier":"Platinum","sales":7728,"checks":1,"minPerTable":2000},{"table":"51","tier":"Diamond","sales":7452,"checks":1,"minPerTable":4000},{"table":"32","tier":"Platinum","sales":7155,"checks":1,"minPerTable":2000},{"table":"24","tier":"Gold","sales":6722,"checks":1,"minPerTable":1500},{"table":"31","tier":"Prestige","sales":6348,"checks":2,"minPerTable":3500},{"table":"23","tier":"Riverwalk","sales":4971,"checks":1,"minPerTable":1000},{"table":"56","tier":"Platinum","sales":4869,"checks":1,"minPerTable":2000},{"table":"42","tier":"Platinum","sales":4280,"checks":1,"minPerTable":2000},{"table":"33","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"55","tier":"Platinum","sales":4056,"checks":1,"minPerTable":2000},{"table":"36","tier":"Platinum","sales":3842,"checks":1,"minPerTable":2000},{"table":"25","tier":"Gold","sales":3708,"checks":1,"minPerTable":1500},{"table":"53","tier":"Platinum","sales":3506,"checks":1,"minPerTable":2000},{"table":"27","tier":"Gold","sales":3452,"checks":2,"minPerTable":1500},{"table":"22","tier":"Riverwalk","sales":3364,"checks":1,"minPerTable":1000},{"table":"19","tier":"Riverwalk","sales":3146,"checks":1,"minPerTable":1000},{"table":"47","tier":"Platinum","sales":3113,"checks":1,"minPerTable":2000},{"table":"46","tier":"Platinum","sales":2708,"checks":1,"minPerTable":2000},{"table":"43","tier":"Platinum","sales":2616,"checks":1,"minPerTable":2000},{"table":"35","tier":"Platinum","sales":1950,"checks":1,"minPerTable":2000},{"table":"21","tier":"Riverwalk","sales":1877,"checks":1,"minPerTable":1000},{"table":"28","tier":"Gold","sales":1535,"checks":1,"minPerTable":1500},{"table":"52","tier":"Diamond","sales":0,"checks":0,"minPerTable":4000},{"table":"45","tier":"Platinum","sales":0,"checks":0,"minPerTable":2000},{"table":"20","tier":"Riverwalk","sales":0,"checks":0,"minPerTable":1000}],"roiActual":15.6328,"roiTarget":5}]},{"venue":"MILA Lounge","weekOf":"Jul 7  Jul 13, 2026","weekKey":"2026-W29","shows":[{"date":"2026-07-08","label":"Wednesday, July 8","dj":"LEX","fee":500,"bsActual":105,"bsMin":15000,"tablesActual":1,"tablesBudget":70,"tiers":{"Diamond":{"soldTables":0,"totalTables":8,"totalSales":0,"avgPerTable":0,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":0,"totalTables":2,"totalSales":0,"avgPerTable":0,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":0,"totalTables":6,"totalSales":0,"avgPerTable":0,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":1,"totalTables":24,"totalSales":32,"avgPerTable":32,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":0,"totalTables":30,"totalSales":0,"avgPerTable":0,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"4","tier":"Booths","sales":32,"checks":1,"minPerTable":500},{"table":"305","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"409","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"410","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"404","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"301","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"302","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"304","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"308","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"2","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"5","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"6","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"8","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"9","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"1A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"2A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"4A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"5A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"6A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"8A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"9A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S1","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S3","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S4","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S5","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S6","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S7","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S8","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S9","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S11","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S15","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S16","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S17","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":0.21,"roiTarget":30},{"date":"2026-07-09","label":"Thursday, July 9","dj":"SPARROW","fee":6500,"bsActual":39342,"bsMin":25000,"tablesActual":31,"tablesBudget":70,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":19315,"avgPerTable":3219,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3348,"avgPerTable":3348,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":4,"totalTables":6,"totalSales":7704,"avgPerTable":1926,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":12,"totalTables":24,"totalSales":1838,"avgPerTable":153,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":8,"totalTables":30,"totalSales":794,"avgPerTable":99,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"307","tier":"Diamond","sales":5622,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3827,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":3348,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":3147,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":2899,"checks":2,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2464,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":2437,"checks":1,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":2066,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2000,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1392,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":1165,"checks":2,"minPerTable":1000},{"table":"8","tier":"Booths","sales":472,"checks":12,"minPerTable":500},{"table":"S4","tier":"Seating","sales":295,"checks":6,"minPerTable":200},{"table":"9","tier":"Booths","sales":276,"checks":7,"minPerTable":500},{"table":"7","tier":"Booths","sales":246,"checks":7,"minPerTable":500},{"table":"6","tier":"Booths","sales":243,"checks":6,"minPerTable":500},{"table":"11A","tier":"Booths","sales":180,"checks":1,"minPerTable":500},{"table":"S5","tier":"Seating","sales":128,"checks":3,"minPerTable":200},{"table":"s2","tier":"Other","sales":127,"checks":2,"minPerTable":0},{"table":"S3","tier":"Seating","sales":101,"checks":3,"minPerTable":200},{"table":"5","tier":"Booths","sales":100,"checks":1,"minPerTable":500},{"table":"S6","tier":"Seating","sales":92,"checks":2,"minPerTable":200},{"table":"4A","tier":"Booths","sales":88,"checks":2,"minPerTable":500},{"table":"6A","tier":"Booths","sales":76,"checks":2,"minPerTable":500},{"table":"S7","tier":"Seating","sales":66,"checks":2,"minPerTable":200},{"table":"4","tier":"Booths","sales":65,"checks":1,"minPerTable":500},{"table":"S1","tier":"Seating","sales":48,"checks":1,"minPerTable":200},{"table":"8A","tier":"Booths","sales":45,"checks":2,"minPerTable":500},{"table":"S9","tier":"Seating","sales":44,"checks":1,"minPerTable":200},{"table":"9A","tier":"Booths","sales":25,"checks":1,"minPerTable":500},{"table":"2A","tier":"Booths","sales":22,"checks":1,"minPerTable":500},{"table":"S15","tier":"Seating","sales":20,"checks":1,"minPerTable":200},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"410","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"303","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"401","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"2","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"1A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"5A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S8","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S11","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S16","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S17","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":6.0526,"roiTarget":3.8462},{"date":"2026-07-10","label":"Friday, July 10","dj":"ENOO NAPA","fee":7000,"bsActual":82915.5,"bsMin":45000,"tablesActual":37,"tablesBudget":70,"tiers":{"Diamond":{"soldTables":6,"totalTables":8,"totalSales":44791,"avgPerTable":7465,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":7756,"avgPerTable":7756,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":6,"totalTables":6,"totalSales":20911,"avgPerTable":3485,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":17,"totalTables":24,"totalSales":5623,"avgPerTable":331,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":7,"totalTables":30,"totalSales":1058,"avgPerTable":151,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"407","tier":"Diamond","sales":18824,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":12478,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":7756,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":4688,"checks":2,"minPerTable":1000},{"table":"303","tier":"Gold","sales":4482,"checks":1,"minPerTable":1000},{"table":"401","tier":"Gold","sales":4280,"checks":1,"minPerTable":1000},{"table":"306","tier":"Diamond","sales":4050,"checks":1,"minPerTable":2000},{"table":"304","tier":"Gold","sales":3902,"checks":1,"minPerTable":1000},{"table":"409","tier":"Diamond","sales":3803,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":3554,"checks":1,"minPerTable":2000},{"table":"308","tier":"Gold","sales":2248,"checks":1,"minPerTable":1000},{"table":"410","tier":"Diamond","sales":2082,"checks":1,"minPerTable":2000},{"table":"302","tier":"Gold","sales":1311,"checks":1,"minPerTable":1000},{"table":"6A","tier":"Booths","sales":960,"checks":4,"minPerTable":500},{"table":"9","tier":"Booths","sales":880,"checks":17,"minPerTable":500},{"table":"8","tier":"Booths","sales":573,"checks":7,"minPerTable":500},{"table":"5","tier":"Booths","sales":482,"checks":1,"minPerTable":500},{"table":"1A","tier":"Booths","sales":421,"checks":8,"minPerTable":500},{"table":"S5","tier":"Seating","sales":340,"checks":6,"minPerTable":200},{"table":"9A","tier":"Booths","sales":323,"checks":8,"minPerTable":500},{"table":"8A","tier":"Booths","sales":315,"checks":4,"minPerTable":500},{"table":"4","tier":"Booths","sales":275,"checks":4,"minPerTable":500},{"table":"S6","tier":"Seating","sales":265,"checks":5,"minPerTable":200},{"table":"S7","tier":"Seating","sales":227,"checks":6,"minPerTable":200},{"table":"11A","tier":"Booths","sales":222,"checks":2,"minPerTable":500},{"table":"7","tier":"Booths","sales":208,"checks":4,"minPerTable":500},{"table":"2A","tier":"Booths","sales":203,"checks":3,"minPerTable":500},{"table":"4A","tier":"Booths","sales":177,"checks":2,"minPerTable":500},{"table":"S9","tier":"Seating","sales":163,"checks":2,"minPerTable":200},{"table":"6","tier":"Booths","sales":161,"checks":2,"minPerTable":500},{"table":"10A","tier":"Booths","sales":124,"checks":2,"minPerTable":500},{"table":"5A","tier":"Booths","sales":122,"checks":2,"minPerTable":500},{"table":"2","tier":"Booths","sales":94,"checks":2,"minPerTable":500},{"table":"3A","tier":"Booths","sales":83,"checks":2,"minPerTable":500},{"table":"s2","tier":"Other","sales":44,"checks":2,"minPerTable":0},{"table":"S8","tier":"Seating","sales":40,"checks":1,"minPerTable":200},{"table":"S16","tier":"Seating","sales":21,"checks":1,"minPerTable":200},{"table":"S17","tier":"Seating","sales":2,"checks":1,"minPerTable":200},{"table":"307","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"7A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S1","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S3","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S4","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S11","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S15","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":11.8451,"roiTarget":6.4286},{"date":"2026-07-11","label":"Saturday, July 11","dj":"SAMANTHA LOVERIDGE","fee":1000,"bsActual":72141,"bsMin":45000,"tablesActual":38,"tablesBudget":70,"tiers":{"Diamond":{"soldTables":7,"totalTables":8,"totalSales":25120,"avgPerTable":3589,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Prestige":{"soldTables":1,"totalTables":2,"totalSales":3220,"avgPerTable":3220,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},"Gold":{"soldTables":6,"totalTables":6,"totalSales":20008,"avgPerTable":3335,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Booths":{"soldTables":16,"totalTables":24,"totalSales":4355,"avgPerTable":272,"minPerTable":500,"color":"#ffeaa7","textColor":"#6c4f00"},"Seating":{"soldTables":8,"totalTables":30,"totalSales":906,"avgPerTable":113,"minPerTable":200,"color":"#dfe6e9","textColor":"#2d3436"}},"tableDetail":[{"table":"409","tier":"Diamond","sales":5902,"checks":4,"minPerTable":2000},{"table":"301","tier":"Gold","sales":5520,"checks":2,"minPerTable":1000},{"table":"307","tier":"Diamond","sales":4847,"checks":2,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":3776,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3692,"checks":1,"minPerTable":2000},{"table":"401","tier":"Gold","sales":3545,"checks":1,"minPerTable":1000},{"table":"308","tier":"Gold","sales":3466,"checks":1,"minPerTable":1000},{"table":"404","tier":"Prestige","sales":3220,"checks":1,"minPerTable":3000},{"table":"303","tier":"Gold","sales":2666,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":2649,"checks":1,"minPerTable":1000},{"table":"305","tier":"Diamond","sales":2599,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2594,"checks":1,"minPerTable":2000},{"table":"302","tier":"Gold","sales":2162,"checks":2,"minPerTable":1000},{"table":"410","tier":"Diamond","sales":1710,"checks":1,"minPerTable":2000},{"table":"2","tier":"Booths","sales":1205,"checks":5,"minPerTable":500},{"table":"4","tier":"Booths","sales":890,"checks":2,"minPerTable":500},{"table":"6","tier":"Booths","sales":595,"checks":1,"minPerTable":500},{"table":"S9","tier":"Seating","sales":391,"checks":2,"minPerTable":200},{"table":"10A","tier":"Booths","sales":279,"checks":5,"minPerTable":500},{"table":"5A","tier":"Booths","sales":252,"checks":2,"minPerTable":500},{"table":"4A","tier":"Booths","sales":250,"checks":3,"minPerTable":500},{"table":"5","tier":"Booths","sales":161,"checks":3,"minPerTable":500},{"table":"S3","tier":"Seating","sales":141,"checks":1,"minPerTable":200},{"table":"9A","tier":"Booths","sales":139,"checks":2,"minPerTable":500},{"table":"1A","tier":"Booths","sales":138,"checks":1,"minPerTable":500},{"table":"S4","tier":"Seating","sales":131,"checks":3,"minPerTable":200},{"table":"11A","tier":"Booths","sales":128,"checks":2,"minPerTable":500},{"table":"8A","tier":"Booths","sales":98,"checks":3,"minPerTable":500},{"table":"S11","tier":"Seating","sales":80,"checks":1,"minPerTable":200},{"table":"3A","tier":"Booths","sales":72,"checks":1,"minPerTable":500},{"table":"S6","tier":"Seating","sales":70,"checks":1,"minPerTable":200},{"table":"7","tier":"Booths","sales":61,"checks":1,"minPerTable":500},{"table":"2A","tier":"Booths","sales":55,"checks":1,"minPerTable":500},{"table":"S7","tier":"Seating","sales":53,"checks":1,"minPerTable":200},{"table":"s2","tier":"Other","sales":50,"checks":2,"minPerTable":0},{"table":"8","tier":"Booths","sales":20,"checks":1,"minPerTable":500},{"table":"S8","tier":"Seating","sales":20,"checks":1,"minPerTable":200},{"table":"S5","tier":"Seating","sales":20,"checks":1,"minPerTable":200},{"table":"7A","tier":"Booths","sales":12,"checks":1,"minPerTable":500},{"table":"406","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":0,"checks":0,"minPerTable":3000},{"table":"1","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"3","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"9","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"10","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"11","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"6A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"12A","tier":"Booths","sales":0,"checks":0,"minPerTable":500},{"table":"S1","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S2","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S10","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S12","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S13","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S14","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S15","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S16","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S17","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S18","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S19","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S20","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S21","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S22","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S23","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S24","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S25","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S26","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S27","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S28","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S29","tier":"Seating","sales":0,"checks":0,"minPerTable":200},{"table":"S30","tier":"Seating","sales":0,"checks":0,"minPerTable":200}],"roiActual":72.141,"roiTarget":45}]},{"venue":"Casa Neos Lounge","weekOf":"Jul 7  Jul 13, 2026","weekKey":"2026-W29","shows":[{"date":"2026-07-09","label":"Thursday, July 9","dj":"BARUT","fee":500,"bsActual":24970,"bsMin":25000,"tablesActual":17,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":12984,"avgPerTable":2164,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":3,"totalTables":6,"totalSales":4143,"avgPerTable":1381,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":2,"totalTables":5,"totalSales":2350,"avgPerTable":1175,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":6,"totalTables":24,"totalSales":2626,"avgPerTable":438,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":4118,"checks":1,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":3132,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":2867,"checks":77,"minPerTable":0},{"table":"908","tier":"Platinum","sales":1635,"checks":1,"minPerTable":1500},{"table":"903","tier":"Diamond","sales":1605,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":1580,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":1570,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":1549,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":1545,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":1074,"checks":21,"minPerTable":500},{"table":"905","tier":"Diamond","sales":1035,"checks":1,"minPerTable":2000},{"table":"909","tier":"Platinum","sales":928,"checks":1,"minPerTable":1500},{"table":"807","tier":"Gold","sales":780,"checks":1,"minPerTable":1000},{"table":"L8A","tier":"Lounge","sales":500,"checks":1,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":500,"checks":1,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":357,"checks":13,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":185,"checks":5,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":10,"checks":1,"minPerTable":500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"810","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"805","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":49.94,"roiTarget":0},{"date":"2026-07-10","label":"Friday, July 10","dj":"JENIA TERSOL b2b ECHONOMIST","fee":12000,"bsActual":53542,"bsMin":52500,"tablesActual":23,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":22839,"avgPerTable":3807,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":4,"totalTables":6,"totalSales":12247,"avgPerTable":3062,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":9822,"avgPerTable":1964,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":8,"totalTables":24,"totalSales":3766,"avgPerTable":471,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":6569,"checks":3,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":5627,"checks":2,"minPerTable":1500},{"table":"806","tier":"Gold","sales":4710,"checks":1,"minPerTable":1000},{"table":"904","tier":"Diamond","sales":4617,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3833,"checks":54,"minPerTable":0},{"table":"809","tier":"Diamond","sales":3590,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3063,"checks":1,"minPerTable":2000},{"table":"905","tier":"Diamond","sales":3000,"checks":1,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":2974,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2535,"checks":1,"minPerTable":1500},{"table":"807","tier":"Gold","sales":2154,"checks":1,"minPerTable":1000},{"table":"902","tier":"Diamond","sales":2000,"checks":1,"minPerTable":2000},{"table":"L3","tier":"Lounge","sales":1122,"checks":22,"minPerTable":500},{"table":"906","tier":"Platinum","sales":1111,"checks":1,"minPerTable":1500},{"table":"803","tier":"Gold","sales":1044,"checks":1,"minPerTable":1000},{"table":"804","tier":"Gold","sales":1000,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":914,"checks":1,"minPerTable":1000},{"table":"L5","tier":"Lounge","sales":816,"checks":9,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":513,"checks":7,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":406,"checks":2,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":314,"checks":2,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":239,"checks":4,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":237,"checks":2,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":119,"checks":4,"minPerTable":500},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":4.4618,"roiTarget":0},{"date":"2026-07-11","label":"Saturday, July 11","dj":"ONOMA or BIRDS OF MIND","fee":1000,"bsActual":36520,"bsMin":45000,"tablesActual":16,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":5,"totalTables":6,"totalSales":16610,"avgPerTable":3322,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":3,"totalTables":6,"totalSales":6786,"avgPerTable":2262,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":3,"totalTables":5,"totalSales":6994,"avgPerTable":2331,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":5,"totalTables":24,"totalSales":2480,"avgPerTable":496,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"809","tier":"Diamond","sales":6561,"checks":2,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3596,"checks":41,"minPerTable":0},{"table":"807","tier":"Gold","sales":3550,"checks":1,"minPerTable":1000},{"table":"903","tier":"Diamond","sales":3204,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":3042,"checks":1,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":2451,"checks":1,"minPerTable":1500},{"table":"806","tier":"Gold","sales":2370,"checks":1,"minPerTable":1000},{"table":"908","tier":"Platinum","sales":2250,"checks":1,"minPerTable":1500},{"table":"904","tier":"Diamond","sales":2224,"checks":1,"minPerTable":2000},{"table":"907","tier":"Platinum","sales":2085,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1579,"checks":1,"minPerTable":2000},{"table":"805","tier":"Gold","sales":1074,"checks":2,"minPerTable":1000},{"table":"L3","tier":"Lounge","sales":952,"checks":17,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":880,"checks":8,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":480,"checks":12,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":144,"checks":3,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":24,"checks":1,"minPerTable":500},{"table":"902","tier":"Diamond","sales":0,"checks":0,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"906","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"803","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"804","tier":"Gold","sales":0,"checks":0,"minPerTable":1000},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":36.52,"roiTarget":0},{"date":"2026-07-12","label":"Sunday, July 12","dj":"AFTERDARK","fee":500,"bsActual":74650,"bsMin":20000,"tablesActual":23,"tablesBudget":41,"tiers":{"Diamond":{"soldTables":6,"totalTables":6,"totalSales":30048,"avgPerTable":5008,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},"Platinum":{"soldTables":5,"totalTables":6,"totalSales":13157,"avgPerTable":2631,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},"Gold":{"soldTables":5,"totalTables":5,"totalSales":13609,"avgPerTable":2722,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},"Lounge":{"soldTables":7,"totalTables":24,"totalSales":7488,"avgPerTable":1070,"minPerTable":500,"color":"#d4edda","textColor":"#155724"}},"tableDetail":[{"table":"903","tier":"Diamond","sales":7078,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":6605,"checks":126,"minPerTable":0},{"table":"806","tier":"Gold","sales":6536,"checks":4,"minPerTable":1000},{"table":"809","tier":"Diamond","sales":6183,"checks":2,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":6134,"checks":2,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":5287,"checks":2,"minPerTable":2000},{"table":"901","tier":"Platinum","sales":4766,"checks":2,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":4015,"checks":1,"minPerTable":2000},{"table":"803","tier":"Gold","sales":2777,"checks":2,"minPerTable":1000},{"table":"807","tier":"Gold","sales":2672,"checks":1,"minPerTable":1000},{"table":"906","tier":"Platinum","sales":2542,"checks":1,"minPerTable":1500},{"table":"909","tier":"Platinum","sales":2262,"checks":1,"minPerTable":1500},{"table":"907","tier":"Platinum","sales":2045,"checks":1,"minPerTable":1500},{"table":"L5","tier":"Lounge","sales":1951,"checks":42,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":1880,"checks":38,"minPerTable":500},{"table":"810","tier":"Platinum","sales":1542,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1351,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":1285,"checks":19,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":1163,"checks":2,"minPerTable":500},{"table":"804","tier":"Gold","sales":899,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":725,"checks":1,"minPerTable":1000},{"table":"L5A","tier":"Lounge","sales":591,"checks":5,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":332,"checks":5,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":286,"checks":10,"minPerTable":500},{"table":"908","tier":"Platinum","sales":0,"checks":0,"minPerTable":1500},{"table":"L1","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L10","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L3A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L8A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L11A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500},{"table":"L12A","tier":"Lounge","sales":0,"checks":0,"minPerTable":500}],"roiActual":149.3,"roiTarget":0}]},
/* --- W27 (Jul 4-5, 2026) --- */
{
  "venue":   "Casa Neos Beach Club",
  "weekOf":  "Jul 4 ? Jul 5, 2026",
  "weekKey": "2026-W27",
  "shows": [
    {
      "date": "2026-07-04", "label": "Saturday, July 4",
      "dj": "PEACE CONTROL", "fee": 10000,
      "bsActual": 80046, "bsMin": 35000,
      "tablesActual": 20, "tablesBudget": 27,
      "tiers": {
        "Diamond":  {"soldTables":3,"totalTables":3,"totalSales":19324,"avgPerTable":6441,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Prestige": {"soldTables":2,"totalTables":2,"totalSales":8775, "avgPerTable":4388,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},
        "Platinum": {"soldTables":10,"totalTables":13,"totalSales":37408,"avgPerTable":3741,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},
        "Gold":     {"soldTables":3,"totalTables":5,"totalSales":6684, "avgPerTable":2228,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},
        "Riverwalk":{"soldTables":2,"totalTables":5,"totalSales":2010, "avgPerTable":1005,"minPerTable":1000,"color":"#d4edda","textColor":"#155724"}
      },
      "tableDetail": [
        {"table":"51","tier":"Diamond","sales":7040,"checks":1},{"table":"52","tier":"Diamond","sales":6143,"checks":1},{"table":"34","tier":"Diamond","sales":6141,"checks":1},
        {"table":"41","tier":"Prestige","sales":4888,"checks":1},{"table":"31","tier":"Prestige","sales":3887,"checks":1},
        {"table":"35","tier":"Platinum","sales":5004,"checks":1},{"table":"53","tier":"Platinum","sales":4727,"checks":1},{"table":"54","tier":"Platinum","sales":4303,"checks":1},{"table":"56","tier":"Platinum","sales":4529,"checks":1},{"table":"46","tier":"Platinum","sales":4375,"checks":1},{"table":"33","tier":"Platinum","sales":3195,"checks":1},{"table":"32","tier":"Platinum","sales":3625,"checks":1},{"table":"42","tier":"Platinum","sales":3510,"checks":1},{"table":"55","tier":"Platinum","sales":2053,"checks":1},{"table":"43","tier":"Platinum","sales":2087,"checks":1},{"table":"45","tier":"Platinum","sales":0,"checks":0},{"table":"47","tier":"Platinum","sales":0,"checks":0},{"table":"48","tier":"Platinum","sales":0,"checks":0},{"table":"36","tier":"Platinum","sales":0,"checks":0},{"table":"49","tier":"Platinum","sales":0,"checks":0},
        {"table":"25","tier":"Gold","sales":2467,"checks":1},{"table":"27","tier":"Gold","sales":2094,"checks":1},{"table":"26","tier":"Gold","sales":2022,"checks":1},{"table":"28","tier":"Gold","sales":0,"checks":0},{"table":"24","tier":"Gold","sales":0,"checks":0},
        {"table":"23","tier":"Riverwalk","sales":1141,"checks":1},{"table":"22","tier":"Riverwalk","sales":869,"checks":1},{"table":"19","tier":"Riverwalk","sales":0,"checks":0},{"table":"20","tier":"Riverwalk","sales":0,"checks":0},{"table":"21","tier":"Riverwalk","sales":0,"checks":0}
      ]
    },
    {
      "date": "2026-07-05", "label": "Sunday, July 5",
      "dj": "TOM & COLLINS", "fee": 7000,
      "bsActual": 77877, "bsMin": 31500,
      "tablesActual": 19, "tablesBudget": 27,
      "tiers": {
        "Diamond":  {"soldTables":3,"totalTables":3,"totalSales":14486,"avgPerTable":4829,"minPerTable":4000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Prestige": {"soldTables":2,"totalTables":2,"totalSales":15265,"avgPerTable":7633,"minPerTable":3500,"color":"#e8d5ff","textColor":"#4a0080"},
        "Platinum": {"soldTables":9,"totalTables":13,"totalSales":28735,"avgPerTable":3193,"minPerTable":2000,"color":"#e8e8e8","textColor":"#2d2d2d"},
        "Gold":     {"soldTables":5,"totalTables":5,"totalSales":8768, "avgPerTable":1754,"minPerTable":1500,"color":"#fff3cd","textColor":"#7d5a00"},
        "Riverwalk":{"soldTables":0,"totalTables":5,"totalSales":0,    "avgPerTable":0,  "minPerTable":1000,"color":"#d4edda","textColor":"#155724"}
      },
      "tableDetail": [
        {"table":"51","tier":"Diamond","sales":6875,"checks":1},{"table":"52","tier":"Diamond","sales":5000,"checks":1},{"table":"34","tier":"Diamond","sales":2611,"checks":1},
        {"table":"41","tier":"Prestige","sales":7949,"checks":1},{"table":"31","tier":"Prestige","sales":7316,"checks":1},
        {"table":"35","tier":"Platinum","sales":5000,"checks":1},{"table":"53","tier":"Platinum","sales":4000,"checks":1},{"table":"54","tier":"Platinum","sales":4000,"checks":1},{"table":"56","tier":"Platinum","sales":3000,"checks":1},{"table":"46","tier":"Platinum","sales":3000,"checks":1},{"table":"33","tier":"Platinum","sales":3000,"checks":1},{"table":"32","tier":"Platinum","sales":2000,"checks":1},{"table":"42","tier":"Platinum","sales":0,"checks":0},{"table":"55","tier":"Platinum","sales":1000,"checks":1},{"table":"43","tier":"Platinum","sales":3735,"checks":1},{"table":"45","tier":"Platinum","sales":0,"checks":0},{"table":"47","tier":"Platinum","sales":0,"checks":0},{"table":"48","tier":"Platinum","sales":2505,"checks":1},{"table":"36","tier":"Platinum","sales":695,"checks":1},{"table":"49","tier":"Platinum","sales":52,"checks":1},
        {"table":"25","tier":"Gold","sales":3000,"checks":1},{"table":"27","tier":"Gold","sales":2000,"checks":1},{"table":"26","tier":"Gold","sales":1270,"checks":1},{"table":"28","tier":"Gold","sales":2002,"checks":1},{"table":"24","tier":"Gold","sales":597,"checks":1},
        {"table":"23","tier":"Riverwalk","sales":0,"checks":0},{"table":"22","tier":"Riverwalk","sales":0,"checks":0},{"table":"19","tier":"Riverwalk","sales":0,"checks":0},{"table":"20","tier":"Riverwalk","sales":0,"checks":0},{"table":"21","tier":"Riverwalk","sales":0,"checks":0}
      ]
    }
  ]
},
/* --- Casa Neos Lounge -------------------------------------------- */
{
  "venue":   "Casa Neos Lounge",
  "weekOf":  "Jul 2 ? Jul 5, 2026",
  "weekKey": "2026-W27",
  "shows": [
    {
      "date":"2026-07-02","label":"Wednesday, Jul 2",
      "dj":"BARUT","fee":1000,
      "bsActual":28750,"bsMin":25000,
      "tablesActual":21,"tablesBudget":20,
      "tiers":{
        "Diamond": {"soldTables":6,"totalTables":6,"totalSales":13170,"avgPerTable":2195,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Platinum":{"soldTables":4,"totalTables":9,"totalSales":3314, "avgPerTable":828, "minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},
        "Gold":    {"soldTables":2,"totalTables":5,"totalSales":2254, "avgPerTable":1127,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Lounge":  {"soldTables":9,"totalTables":24,"totalSales":4171,"avgPerTable":463, "minPerTable":500, "color":"#d4edda","textColor":"#155724"}
      },
      "tableDetail":[{"table":"No Table","tier":"Other","sales":5841,"checks":126,"minPerTable":0},{"table":"903","tier":"Diamond","sales":3800,"checks":3,"minPerTable":2000},{"table":"809","tier":"Diamond","sales":2538,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":2202,"checks":1,"minPerTable":2000},{"table":"904","tier":"Diamond","sales":1810,"checks":1,"minPerTable":2000},{"table":"907","tier":"Platinum","sales":1800,"checks":1,"minPerTable":1500},{"table":"902","tier":"Diamond","sales":1788,"checks":1,"minPerTable":2000},{"table":"807","tier":"Gold","sales":1319,"checks":1,"minPerTable":1000},{"table":"909","tier":"Platinum","sales":1310,"checks":1,"minPerTable":1500},{"table":"L3A","tier":"Lounge","sales":1153,"checks":25,"minPerTable":500},{"table":"905","tier":"Diamond","sales":1032,"checks":1,"minPerTable":2000},{"table":"805","tier":"Gold","sales":935,"checks":1,"minPerTable":1000},{"table":"L10A","tier":"Lounge","sales":579,"checks":14,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":506,"checks":5,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":505,"checks":4,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":485,"checks":4,"minPerTable":500},{"table":"L2A","tier":"Lounge","sales":463,"checks":11,"minPerTable":500},{"table":"L1A","tier":"Lounge","sales":252,"checks":5,"minPerTable":500},{"table":"901","tier":"Platinum","sales":184,"checks":1,"minPerTable":1500},{"table":"L5A","tier":"Lounge","sales":125,"checks":2,"minPerTable":500},{"table":"L1","tier":"Lounge","sales":103,"checks":4,"minPerTable":500},{"table":"908","tier":"Platinum","sales":20,"checks":1,"minPerTable":1500}]
    },
    {
      "date":"2026-07-03","label":"Thursday, Jul 3",
      "dj":"ONOMA","fee":500,
      "bsActual":13130,"bsMin":45000,
      "tablesActual":12,"tablesBudget":20,
      "tiers":{
        "Diamond": {"soldTables":4,"totalTables":6,"totalSales":7868,"avgPerTable":1967,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Platinum":{"soldTables":1,"totalTables":9,"totalSales":1750,"avgPerTable":1750,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},
        "Gold":    {"soldTables":1,"totalTables":5,"totalSales":43,  "avgPerTable":43,  "minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Lounge":  {"soldTables":6,"totalTables":24,"totalSales":1565,"avgPerTable":260,"minPerTable":500, "color":"#d4edda","textColor":"#155724"}
      },
      "tableDetail":[{"table":"903","tier":"Diamond","sales":3057,"checks":1,"minPerTable":2000},{"table":"809","tier":"Diamond","sales":2247,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":1904,"checks":40,"minPerTable":0},{"table":"908","tier":"Platinum","sales":1750,"checks":1,"minPerTable":1500},{"table":"808","tier":"Diamond","sales":1520,"checks":1,"minPerTable":2000},{"table":"902","tier":"Diamond","sales":1044,"checks":1,"minPerTable":2000},{"table":"L4","tier":"Lounge","sales":600,"checks":15,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":304,"checks":3,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":275,"checks":5,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":254,"checks":3,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":78,"checks":2,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":54,"checks":1,"minPerTable":500},{"table":"803","tier":"Gold","sales":43,"checks":1,"minPerTable":1000}]
    },
    {
      "date":"2026-07-04","label":"Friday, Jul 4",
      "dj":"AMOG","fee":2000,
      "bsActual":28522,"bsMin":45000,
      "tablesActual":16,"tablesBudget":20,
      "tiers":{
        "Diamond": {"soldTables":5,"totalTables":6,"totalSales":11058,"avgPerTable":2211,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Platinum":{"soldTables":3,"totalTables":9,"totalSales":6464, "avgPerTable":2154,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},
        "Gold":    {"soldTables":1,"totalTables":5,"totalSales":4140, "avgPerTable":4140,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Lounge":  {"soldTables":7,"totalTables":24,"totalSales":3100,"avgPerTable":442, "minPerTable":500, "color":"#d4edda","textColor":"#155724"}
      },
      "tableDetail":[{"table":"807","tier":"Gold","sales":4140,"checks":1,"minPerTable":1000},{"table":"809","tier":"Diamond","sales":4127,"checks":1,"minPerTable":2000},{"table":"No Table","tier":"Other","sales":3553,"checks":48,"minPerTable":0},{"table":"810","tier":"Platinum","sales":2460,"checks":1,"minPerTable":1500},{"table":"901","tier":"Platinum","sales":2195,"checks":5,"minPerTable":1500},{"table":"904","tier":"Diamond","sales":2120,"checks":1,"minPerTable":2000},{"table":"908","tier":"Platinum","sales":1809,"checks":1,"minPerTable":1500},{"table":"903","tier":"Diamond","sales":1648,"checks":1,"minPerTable":2000},{"table":"902","tier":"Diamond","sales":1585,"checks":1,"minPerTable":2000},{"table":"808","tier":"Diamond","sales":1578,"checks":2,"minPerTable":2000},{"table":"L3","tier":"Lounge","sales":1199,"checks":14,"minPerTable":500},{"table":"L4","tier":"Lounge","sales":970,"checks":21,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":314,"checks":8,"minPerTable":500},{"table":"L5","tier":"Lounge","sales":281,"checks":8,"minPerTable":500},{"table":"L5A","tier":"Lounge","sales":176,"checks":4,"minPerTable":500},{"table":"L7A","tier":"Lounge","sales":110,"checks":1,"minPerTable":500},{"table":"L2","tier":"Lounge","sales":50,"checks":1,"minPerTable":500}]
    },
    {
      "date":"2026-07-05","label":"Saturday, Jul 5",
      "dj":"AFTERDARK","fee":1000,
      "bsActual":32187,"bsMin":20000,
      "tablesActual":24,"tablesBudget":20,
      "tiers":{
        "Diamond": {"soldTables":6,"totalTables":6,"totalSales":13629,"avgPerTable":2271,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Platinum":{"soldTables":5,"totalTables":9,"totalSales":8060, "avgPerTable":1612,"minPerTable":1500,"color":"#e8e8e8","textColor":"#2d2d2d"},
        "Gold":    {"soldTables":4,"totalTables":5,"totalSales":3588, "avgPerTable":897, "minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Lounge":  {"soldTables":9,"totalTables":24,"totalSales":3048,"avgPerTable":338, "minPerTable":500, "color":"#d4edda","textColor":"#155724"}
      },
      "tableDetail":[{"table":"No Table","tier":"Other","sales":3862,"checks":79,"minPerTable":0},{"table":"809","tier":"Diamond","sales":3708,"checks":1,"minPerTable":2000},{"table":"810","tier":"Platinum","sales":3642,"checks":1,"minPerTable":1500},{"table":"904","tier":"Diamond","sales":2952,"checks":1,"minPerTable":2000},{"table":"903","tier":"Diamond","sales":2454,"checks":2,"minPerTable":2000},{"table":"906","tier":"Platinum","sales":1950,"checks":1,"minPerTable":1500},{"table":"808","tier":"Diamond","sales":1903,"checks":1,"minPerTable":2000},{"table":"L5","tier":"Lounge","sales":1733,"checks":40,"minPerTable":500},{"table":"807","tier":"Gold","sales":1678,"checks":1,"minPerTable":1000},{"table":"901","tier":"Platinum","sales":1600,"checks":1,"minPerTable":1500},{"table":"905","tier":"Diamond","sales":1528,"checks":2,"minPerTable":2000},{"table":"902","tier":"Diamond","sales":1084,"checks":1,"minPerTable":2000},{"table":"804","tier":"Gold","sales":934,"checks":1,"minPerTable":1000},{"table":"805","tier":"Gold","sales":834,"checks":1,"minPerTable":1000},{"table":"909","tier":"Platinum","sales":771,"checks":1,"minPerTable":1500},{"table":"L4","tier":"Lounge","sales":509,"checks":9,"minPerTable":500},{"table":"L10A","tier":"Lounge","sales":360,"checks":3,"minPerTable":500},{"table":"L4A","tier":"Lounge","sales":173,"checks":3,"minPerTable":500},{"table":"806","tier":"Gold","sales":142,"checks":1,"minPerTable":1000},{"table":"L5A","tier":"Lounge","sales":114,"checks":4,"minPerTable":500},{"table":"908","tier":"Platinum","sales":97,"checks":1,"minPerTable":1500},{"table":"L7A","tier":"Lounge","sales":60,"checks":1,"minPerTable":500},{"table":"L9A","tier":"Lounge","sales":48,"checks":1,"minPerTable":500},{"table":"L6A","tier":"Lounge","sales":32,"checks":1,"minPerTable":500},{"table":"L3","tier":"Lounge","sales":20,"checks":1,"minPerTable":500}]
    }
  ]
},
/* --- MILA Lounge ------------------------------------------------- */
{
  "venue":   "MILA Lounge",
  "weekOf":  "Jul 1 ? Jul 4, 2026",
  "weekKey": "2026-W27",
  "shows": [
    {
      "date":"2026-07-01","label":"Wednesday, Jul 1",
      "dj":"","fee":0,
      "bsActual":12561,"bsMin":1800,
      "tablesActual":17,"tablesBudget":18,
      "tiers":{
        "Diamond": {"soldTables":3,"totalTables":9, "totalSales":4266,"avgPerTable":1422,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Gold":    {"soldTables":1,"totalTables":8, "totalSales":783, "avgPerTable":783, "minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Booths":  {"soldTables":12,"totalTables":24,"totalSales":1834,"avgPerTable":152,"minPerTable":500, "color":"#ffeaa7","textColor":"#6c4f00"},
        "Seating": {"soldTables":1,"totalTables":31,"totalSales":48,  "avgPerTable":48,  "minPerTable":200, "color":"#dfe6e9","textColor":"#2d3436"}
      },
      "tableDetail":[{"table":"406","tier":"Diamond","sales":3697,"checks":1,"minPerTable":2000},{"table":"307","tier":"Diamond","sales":2196,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":1130,"checks":1,"minPerTable":2000},{"table":"403","tier":"Prestige","sales":1100,"checks":1,"minPerTable":3000},{"table":"408","tier":"Diamond","sales":940,"checks":1,"minPerTable":2000},{"table":"410","tier":"Gold","sales":783,"checks":1,"minPerTable":1000},{"table":"10","tier":"Booths","sales":520,"checks":14,"minPerTable":500},{"table":"1","tier":"Booths","sales":215,"checks":7,"minPerTable":500},{"table":"11A","tier":"Booths","sales":170,"checks":2,"minPerTable":500},{"table":"1A","tier":"Booths","sales":114,"checks":1,"minPerTable":500},{"table":"11","tier":"Booths","sales":98,"checks":4,"minPerTable":500},{"table":"6A","tier":"Booths","sales":97,"checks":2,"minPerTable":500},{"table":"3A","tier":"Booths","sales":49,"checks":1,"minPerTable":500},{"table":"S3","tier":"Seating","sales":48,"checks":2,"minPerTable":200},{"table":"9A","tier":"Booths","sales":20,"checks":1,"minPerTable":500},{"table":"10A","tier":"Booths","sales":12,"checks":1,"minPerTable":500}]
    },
    {
      "date":"2026-07-02","label":"Thursday, Jul 2",
      "dj":"DIMITRIOS","fee":1000,
      "bsActual":26625,"bsMin":25000,
      "tablesActual":32,"tablesBudget":18,
      "tiers":{
        "Diamond": {"soldTables":4,"totalTables":9, "totalSales":5877, "avgPerTable":1469,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Prestige":{"soldTables":1,"totalTables":2, "totalSales":2076, "avgPerTable":2076,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},
        "Gold":    {"soldTables":6,"totalTables":8, "totalSales":7895, "avgPerTable":1315,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Booths":  {"soldTables":16,"totalTables":24,"totalSales":5167,"avgPerTable":322, "minPerTable":500, "color":"#ffeaa7","textColor":"#6c4f00"},
        "Seating": {"soldTables":5,"totalTables":31,"totalSales":542,  "avgPerTable":108, "minPerTable":200, "color":"#dfe6e9","textColor":"#2d3436"}
      },
      "tableDetail":[{"table":"403","tier":"Prestige","sales":3113,"checks":1,"minPerTable":3000},{"table":"410","tier":"Gold","sales":2164,"checks":1,"minPerTable":1000},{"table":"407","tier":"Diamond","sales":2133,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":2076,"checks":1,"minPerTable":3000},{"table":"305","tier":"Diamond","sales":2036,"checks":1,"minPerTable":2000},{"table":"304","tier":"Gold","sales":1842,"checks":1,"minPerTable":1000},{"table":"302","tier":"Gold","sales":1538,"checks":1,"minPerTable":1000},{"table":"306","tier":"Diamond","sales":1158,"checks":1,"minPerTable":2000},{"table":"303","tier":"Gold","sales":1133,"checks":1,"minPerTable":1000},{"table":"301","tier":"Gold","sales":1102,"checks":1,"minPerTable":1000},{"table":"408","tier":"Diamond","sales":550,"checks":1,"minPerTable":2000},{"table":"3","tier":"Booths","sales":545,"checks":2,"minPerTable":500},{"table":"10","tier":"Booths","sales":510,"checks":10,"minPerTable":500},{"table":"1","tier":"Booths","sales":500,"checks":1,"minPerTable":500},{"table":"11","tier":"Booths","sales":211,"checks":5,"minPerTable":500},{"table":"S8","tier":"Seating","sales":177,"checks":3,"minPerTable":200},{"table":"10A","tier":"Booths","sales":172,"checks":4,"minPerTable":500},{"table":"S5","tier":"Seating","sales":143,"checks":2,"minPerTable":200},{"table":"S4","tier":"Seating","sales":130,"checks":3,"minPerTable":200},{"table":"9A","tier":"Booths","sales":130,"checks":2,"minPerTable":500},{"table":"6A","tier":"Booths","sales":120,"checks":3,"minPerTable":500},{"table":"401","tier":"Gold","sales":116,"checks":1,"minPerTable":1000},{"table":"3A","tier":"Booths","sales":115,"checks":1,"minPerTable":500},{"table":"7A","tier":"Booths","sales":103,"checks":3,"minPerTable":500},{"table":"5A","tier":"Booths","sales":78,"checks":2,"minPerTable":500},{"table":"12","tier":"Booths","sales":74,"checks":1,"minPerTable":500},{"table":"8A","tier":"Booths","sales":69,"checks":2,"minPerTable":500},{"table":"11A","tier":"Booths","sales":48,"checks":1,"minPerTable":500},{"table":"S6","tier":"Seating","sales":48,"checks":1,"minPerTable":200},{"table":"S7","tier":"Seating","sales":44,"checks":1,"minPerTable":200},{"table":"4A","tier":"Booths","sales":28,"checks":2,"minPerTable":500}]
    },
    {
      "date":"2026-07-03","label":"Friday, Jul 3",
      "dj":"JUANY BRAVO","fee":3500,
      "bsActual":27477,"bsMin":45000,
      "tablesActual":29,"tablesBudget":18,
      "tiers":{
        "Diamond": {"soldTables":5,"totalTables":9, "totalSales":9435, "avgPerTable":1887,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Prestige":{"soldTables":1,"totalTables":2, "totalSales":4522, "avgPerTable":4522,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},
        "Gold":    {"soldTables":5,"totalTables":8, "totalSales":5909, "avgPerTable":1181,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Booths":  {"soldTables":15,"totalTables":24,"totalSales":3202,"avgPerTable":213, "minPerTable":500, "color":"#ffeaa7","textColor":"#6c4f00"},
        "Seating": {"soldTables":3,"totalTables":31,"totalSales":240,  "avgPerTable":80,  "minPerTable":200, "color":"#dfe6e9","textColor":"#2d3436"}
      },
      "tableDetail":[{"table":"404","tier":"Prestige","sales":4522,"checks":1,"minPerTable":3000},{"table":"307","tier":"Diamond","sales":2966,"checks":1,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":2865,"checks":1,"minPerTable":2000},{"table":"408","tier":"Diamond","sales":2569,"checks":1,"minPerTable":2000},{"table":"409","tier":"Diamond","sales":2109,"checks":1,"minPerTable":2000},{"table":"302","tier":"Gold","sales":1500,"checks":1,"minPerTable":1000},{"table":"304","tier":"Gold","sales":1135,"checks":1,"minPerTable":1000},{"table":"308","tier":"Gold","sales":1130,"checks":1,"minPerTable":1000},{"table":"403","tier":"Prestige","sales":1105,"checks":1,"minPerTable":3000},{"table":"301","tier":"Gold","sales":1100,"checks":1,"minPerTable":1000},{"table":"303","tier":"Gold","sales":1044,"checks":1,"minPerTable":1000},{"table":"407","tier":"Diamond","sales":1027,"checks":1,"minPerTable":2000},{"table":"305","tier":"Diamond","sales":764,"checks":1,"minPerTable":2000},{"table":"10A","tier":"Booths","sales":379,"checks":4,"minPerTable":500},{"table":"9A","tier":"Booths","sales":375,"checks":6,"minPerTable":500},{"table":"8A","tier":"Booths","sales":329,"checks":5,"minPerTable":500},{"table":"12A","tier":"Booths","sales":180,"checks":1,"minPerTable":500},{"table":"5A","tier":"Booths","sales":170,"checks":1,"minPerTable":500},{"table":"S7","tier":"Seating","sales":116,"checks":3,"minPerTable":200},{"table":"S6","tier":"Seating","sales":100,"checks":1,"minPerTable":200},{"table":"4A","tier":"Booths","sales":98,"checks":1,"minPerTable":500},{"table":"3","tier":"Booths","sales":88,"checks":3,"minPerTable":500},{"table":"10","tier":"Booths","sales":63,"checks":2,"minPerTable":500},{"table":"11","tier":"Booths","sales":48,"checks":2,"minPerTable":500},{"table":"2A","tier":"Booths","sales":25,"checks":1,"minPerTable":500},{"table":"S8","tier":"Seating","sales":24,"checks":1,"minPerTable":200},{"table":"7A","tier":"Booths","sales":23,"checks":1,"minPerTable":500}]
    },
    {
      "date":"2026-07-04","label":"Saturday, Jul 4",
      "dj":"ONOMA","fee":1000,
      "bsActual":34180,"bsMin":45000,
      "tablesActual":31,"tablesBudget":18,
      "tiers":{
        "Diamond": {"soldTables":4,"totalTables":9, "totalSales":18089,"avgPerTable":4522,"minPerTable":2000,"color":"#b9f2ff","textColor":"#0a4a6e"},
        "Prestige":{"soldTables":1,"totalTables":2, "totalSales":2821, "avgPerTable":2821,"minPerTable":3000,"color":"#e8d5ff","textColor":"#4a0080"},
        "Gold":    {"soldTables":4,"totalTables":8, "totalSales":5746, "avgPerTable":1436,"minPerTable":1000,"color":"#fff3cd","textColor":"#7d5a00"},
        "Booths":  {"soldTables":15,"totalTables":24,"totalSales":2142,"avgPerTable":142, "minPerTable":500, "color":"#ffeaa7","textColor":"#6c4f00"},
        "Seating": {"soldTables":7,"totalTables":31,"totalSales":762,  "avgPerTable":108, "minPerTable":200, "color":"#dfe6e9","textColor":"#2d3436"}
      },
      "tableDetail":[{"table":"408","tier":"Diamond","sales":7826,"checks":1,"minPerTable":2000},{"table":"306","tier":"Diamond","sales":4808,"checks":1,"minPerTable":2000},{"table":"406","tier":"Diamond","sales":3697,"checks":1,"minPerTable":2000},{"table":"407","tier":"Diamond","sales":3334,"checks":1,"minPerTable":2000},{"table":"404","tier":"Prestige","sales":2821,"checks":1,"minPerTable":3000},{"table":"305","tier":"Diamond","sales":2121,"checks":1,"minPerTable":2000},{"table":"304","tier":"Gold","sales":1583,"checks":1,"minPerTable":1000},{"table":"410","tier":"Gold","sales":1561,"checks":1,"minPerTable":1000},{"table":"301","tier":"Gold","sales":1419,"checks":1,"minPerTable":1000},{"table":"308","tier":"Gold","sales":1183,"checks":1,"minPerTable":1000},{"table":"3","tier":"Booths","sales":285,"checks":5,"minPerTable":500},{"table":"10A","tier":"Booths","sales":254,"checks":4,"minPerTable":500},{"table":"S7","tier":"Seating","sales":189,"checks":5,"minPerTable":200},{"table":"9A","tier":"Booths","sales":185,"checks":5,"minPerTable":500},{"table":"8A","tier":"Booths","sales":176,"checks":4,"minPerTable":500},{"table":"S5","tier":"Seating","sales":148,"checks":2,"minPerTable":200},{"table":"6A","tier":"Booths","sales":131,"checks":3,"minPerTable":500},{"table":"S8","tier":"Seating","sales":125,"checks":2,"minPerTable":200},{"table":"S16","tier":"Seating","sales":113,"checks":1,"minPerTable":200},{"table":"3A","tier":"Booths","sales":106,"checks":3,"minPerTable":500},{"table":"10","tier":"Booths","sales":96,"checks":3,"minPerTable":500},{"table":"S9","tier":"Seating","sales":94,"checks":1,"minPerTable":200},{"table":"1","tier":"Booths","sales":88,"checks":1,"minPerTable":500},{"table":"2A","tier":"Booths","sales":82,"checks":2,"minPerTable":500},{"table":"7A","tier":"Booths","sales":81,"checks":1,"minPerTable":500},{"table":"S6","tier":"Seating","sales":69,"checks":2,"minPerTable":200},{"table":"5A","tier":"Booths","sales":48,"checks":2,"minPerTable":500},{"table":"12","tier":"Booths","sales":36,"checks":1,"minPerTable":500},{"table":"S3","tier":"Seating","sales":24,"checks":1,"minPerTable":200}]
    }
  ]
}
];

/* backward-compat alias for any legacy references */
var VIP_DATA = VIP_VENUES[0];

var TIER_COLORS = {
  Diamond:"#b9f2ff",Prestige:"#e8d5ff",Platinum:"#e8e8e8",
  Gold:"#fff3cd",Riverwalk:"#d4edda",Cabana:"#ffeaa7",Deck:"#dfe6e9",
  Lounge:"#d4edda",Booths:"#ffeaa7",Seating:"#dfe6e9"
};
var TIER_TEXT = {
  Diamond:"#0a4a6e",Prestige:"#4a0080",Platinum:"#2d2d2d",
  Gold:"#7d5a00",Riverwalk:"#155724",Cabana:"#6c4f00",Deck:"#2d3436",
  Lounge:"#155724",Booths:"#6c4f00",Seating:"#2d3436"
};
var TIER_ORDER = ['Diamond','Prestige','Platinum','Gold','Riverwalk','Cabana','Deck','Lounge','Booths','Seating'];
/* Completed-week Toast tier actuals. Kept separate from per-show FourVenues
   pacing because Toast is the final source of truth for sold tables and sales. */
var VIP_WEEK_TIER_ACTUALS = {
  '2026-W30|Casa Neos Beach Club': {
    source:'Toast actual \u00b7 Jul 20\u201326',
    tiers:{
      Diamond:{soldTables:3,totalTables:3,totalSales:26471,avgPerTable:8824,minPerTable:4000},
      Prestige:{soldTables:2,totalTables:2,totalSales:1838,avgPerTable:919,minPerTable:3500},
      Platinum:{soldTables:12,totalTables:15,totalSales:54785,avgPerTable:4565,minPerTable:2000},
      Gold:{soldTables:4,totalTables:5,totalSales:4604,avgPerTable:1151,minPerTable:1500},
      Riverwalk:{soldTables:0,totalTables:5,totalSales:0,avgPerTable:0,minPerTable:1000}
    }
  },
  '2026-W31|Casa Neos Beach Club': {
    source:'Toast actual \u00b7 Jul 27\u2013Aug 2',
    tiers:{
      Diamond:{soldTables:3,totalTables:3,totalSales:26269,avgPerTable:8756,minPerTable:4000},
      Prestige:{soldTables:2,totalTables:2,totalSales:14415,avgPerTable:7208,minPerTable:3500},
      Platinum:{soldTables:15,totalTables:15,totalSales:57734,avgPerTable:3849,minPerTable:2000},
      Gold:{soldTables:5,totalTables:5,totalSales:13628,avgPerTable:2726,minPerTable:1500},
      Riverwalk:{soldTables:4,totalTables:5,totalSales:7020,avgPerTable:1755,minPerTable:1000}
    }
  }
};
function _vipAllocateWeeklyTiers(shows, weekly){
  var out=(shows||[]).map(function(sh){
    var row={};
    Object.keys(sh).forEach(function(k){ row[k]=sh[k]; });
    row.tiers={};
    row._tierDataAvailable=true;
    row._tierAllocated=true;
    return row;
  });
  if(!out.length||!weekly||!weekly.tiers) return out;
  var totalTables=out.reduce(function(s,sh){return s+(+sh.tablesActual||0);},0);
  var totalBs=out.reduce(function(s,sh){return s+(+sh.bsActual||0);},0);
  Object.keys(weekly.tiers).forEach(function(tname){
    var wt=weekly.tiers[tname], sold=+wt.soldTables||0, sales=+wt.totalSales||0;
    var allocations=[], used=0;
    out.forEach(function(sh,i){
      var raw=totalTables?sold*((+sh.tablesActual||0)/totalTables):sold/out.length;
      var base=Math.floor(raw);
      allocations.push({i:i,n:base,rem:raw-base});
      used+=base;
    });
    allocations.sort(function(a,b){return b.rem-a.rem;});
    for(var left=sold-used, ai=0;left>0;left--,ai++) allocations[ai%allocations.length].n++;
    allocations.sort(function(a,b){return a.i-b.i;});
    var salesUsed=0;
    out.forEach(function(sh,i){
      var n=allocations[i].n;
      var part=i===out.length-1?sales-salesUsed:Math.round(sales*(totalBs?(+sh.bsActual||0)/totalBs:1/out.length));
      salesUsed+=part;
      sh.tiers[tname]={
        soldTables:n,totalTables:+wt.totalTables||0,totalSales:part,
        avgPerTable:n?Math.round(part/n):0,minPerTable:+wt.minPerTable||0,
        color:wt.color||TIER_COLORS[tname]||'#eee',
        textColor:wt.textColor||TIER_TEXT[tname]||'#333'
      };
    });
  });
  return out;
}

function $kv(v){ if(v==null||v==='') return '\u2014'; return '$'+(Math.round(v)).toLocaleString(); }

var _vipActiveVenue = 0;
var _vipWeekOffset = 0; // 0=last week, 1=2 weeks ago, 2=3 weeks ago

function _fmtVar(v){
  if(v===0) return '<span style="color:var(--ink3)">\u2014</span>';
  return '<span class="'+(v>0?'beat':'miss')+'">'+(v>0?'+':'')+$kv(v)+'</span>';
}
function _fmtVarN(v){
  if(v===0) return '<span style="color:var(--ink3)">\u2014</span>';
  return '<span class="'+(v>0?'beat':'miss')+'">'+(v>0?'+':'')+v+'</span>';
}
function _fmtROI(bs,fee){
  if(!fee) return '\u2014';
  return (bs/fee).toFixed(1)+'x';
}
var _TARGET_BG = 'background:#FFF2CC;color:#7D5A00;font-weight:700';
function _vipFillTone(v){
  if(v==null || v===0) return '';
  return v>0?'beat':'miss';
}
function _vipVarPlain(v){
  if(v==null || v===0) return '\u2014';
  return (v>0?'+':'')+$kv(v);
}
function _vipTdFill(inner, tone, extraCls){
  var cls=(extraCls||'')+(tone?(' vip-fill-'+tone):'');
  return '<td'+(cls?' class="'+cls.trim()+'"':'')+'>'+inner+'</td>';
}
function _vipRoiToneCls(roiCls){
  if(roiCls==='hit') return 'beat';
  if(roiCls==='near') return 'near';
  if(roiCls==='low') return 'miss';
  return '';
}
function _vipVenueBlockHd(sectionLabel, venue, sub){
  return '<div class="vip-perf-hd vip-venue-hd">'
    +'<div class="vip-venue-hd-main">'
    +'<span class="vip-venue-name">'+venue+'</span>'
    +(sectionLabel?'<span class="vip-venue-sec">'+sectionLabel+'</span>':'')
    +'</div>'
    +(sub?'<span class="vip-venue-sub">'+sub+'</span>':'')
    +'</div>';
}

function _venueShortName(v){
  if(!v) return '';
  if(/Beach Club/i.test(v)) return 'Casa Neos BC';
  if(/Casa Neos Lounge/i.test(v)) return 'Casa Neos Lounge';
  if(/MILA/i.test(v)) return 'MILA Lounge';
  return v;
}
function _dowShortFromLabel(label){
  if(!label) return '';
  var m=String(label).match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
  return m?m[1]:'';
}
function _tierWins(sh){
  var wins=[], soft=[];
  Object.keys(sh.tiers||{}).forEach(function(t){
    var x=sh.tiers[t]; if(!x||!(x.soldTables>0)) return;
    if(x.avgPerTable>=x.minPerTable) wins.push(t); else soft.push(t);
  });
  return {wins:wins, soft:soft};
}
function _generateVenueFlashParagraph(d){
  var shows=(d&&d.shows)||[];
  if(!shows.length) return '';
  var name=_venueShortName(d.venue);
  var beat=shows.filter(function(s){return s.bsActual>=s.bsMin && s.bsMin>0;});
  var miss=shows.filter(function(s){return s.bsMin>0 && s.bsActual<s.bsMin;});
  var n=shows.length;
  var beatPct=Math.round(beat.length/n*100);
  var parts=[];
  if(beat.length===n){
    parts.push(name+' delivered a strong week, with every performance exceeding DJ Bottle Service Ratio targets, resulting in 100% ROI completion.');
  } else if(beat.length===0){
    parts.push(name+' continued to face significant ROI challenges, with all '+n+' performance'+(n===1?'':'s')+' finishing below DJ Bottle Service Ratio targets, resulting in 0% ROI completion.');
  } else {
    var beatBits=beat.map(function(s){return s.dj+(s.bsActual>s.bsMin*1.15?' significantly exceeding':' exceeding')+' targets';}).join(', while ');
    var missBits=miss.map(function(s){return s.dj+' fell '+(s.bsActual<s.bsMin*0.5?'well ':'')+'short';}).join(' and ');
    parts.push(name+' delivered another split weekend, with '+beatBits+(missBits?', while '+missBits:'')+', resulting in '+beatPct+'% ROI completion.');
  }
  var ranked=shows.slice().sort(function(a,b){
    var fa=a.tablesBudget?((a.tablesActual||0)/a.tablesBudget):0;
    var fb=b.tablesBudget?((b.tablesActual||0)/b.tablesBudget):0;
    return fa-fb;
  });
  var weak=ranked[0], strong=ranked[ranked.length-1];
  if(weak && weak.tablesBudget){
    var wFill=(weak.tablesActual||0)+'/'+weak.tablesBudget;
    var wDay=_dowShortFromLabel(weak.label)||'The softest night';
    if((weak.tablesActual||0)/weak.tablesBudget<=0.45){
      parts.push(wDay+'\'s performance'+(weak.dj?' ('+weak.dj+')':'')+' was impacted by very weak demand ('+wFill+' tables sold)'+(weak.bsMin?', with bottle service at '+$kv(weak.bsActual||0)+' versus a '+$kv(weak.bsMin)+' minimum':'')+'.');
    }
  }
  if(strong && strong!==weak && strong.tablesBudget && (strong.tablesActual||0)/strong.tablesBudget>=0.7){
    var tw=_tierWins(strong);
    var sFill=(strong.tablesActual||0)+'/'+strong.tablesBudget;
    var sDay=_dowShortFromLabel(strong.label)||'The strongest night';
    var tierBit=tw.wins.length?('particularly across '+tw.wins.join(', ')):'strong premium-tier monetization';
    parts.push('In contrast, '+sDay+' combined solid table volume ('+sFill+' sold) with '+tierBit+', supporting one of the stronger ROI performances of the week.');
  } else if(/MILA/i.test(d.venue) && beatPct<60){
    parts.push('This continues the broader trend that MILA\'s opportunity lies in increasing table volume rather than lowering pricing.');
  } else if(beatPct>=50){
    parts.push('The results reinforce that '+name+' delivers strong ROI when demand materializes.');
  } else {
    var anyTier=shows.reduce(function(a,sh){return a.concat(_tierWins(sh).wins);},[]);
    var uniq=[]; anyTier.forEach(function(t){ if(uniq.indexOf(t)<0) uniq.push(t); });
    if(uniq.length) parts.push('While '+uniq.slice(0,4).join(', ')+' pricing was healthy in places, low table volume prevented meaningful bottle service conversion throughout the week.');
  }
  return parts.join(' ');
}
function _generateWeekFlashNarrative(venues){
  var list=(venues||[]).filter(function(v){return v&&v.shows&&v.shows.length;});
  if(!list.length) return '';
  var order=['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'];
  list.sort(function(a,b){
    var ia=order.indexOf(a.venue), ib=order.indexOf(b.venue);
    if(ia<0) ia=99; if(ib<0) ib=99;
    return ia-ib;
  });
  var paras=list.map(_generateVenueFlashParagraph).filter(Boolean);
  if(!paras.length) return '';
  return '<div class="vip-week-narrative"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);margin-bottom:8px">Week Narrative</div>'
    +paras.map(function(p){return '<p>'+p+'</p>';}).join('')
    +'</div>';
}
function _generateInsight(d){
  var shows=d.shows, n=shows.length;
  if(!n) return '';
  var beat=shows.filter(function(s){return s.bsActual>=s.bsMin;}), miss=shows.filter(function(s){return s.bsActual<s.bsMin;});
  var totBS=shows.reduce(function(s,sh){return s+sh.bsActual;},0);
  var totMin=shows.reduce(function(s,sh){return s+sh.bsMin;},0);
  var totTbl=shows.reduce(function(s,sh){return s+(sh.tablesActual||0);},0);
  var totBudget=shows.reduce(function(s,sh){return s+(sh.tablesBudget||0);},0);
  var beatPct=Math.round(beat.length/n*100);
  var avgPerTbl=totTbl?Math.round(totBS/totTbl):0;
  /* sentiment */
  var tone = beatPct>=75?'strong':beatPct>=50?'mixed':beatPct>=25?'weak':'poor';
  var opener = {strong:'A strong week for ',mixed:'A mixed week for ',weak:'A challenging week for ',poor:'A difficult week for '}[tone];
  /* beat/miss artists */
  var beatNames=beat.map(function(s){return s.dj;}).join(' & ');
  var missNames=miss.map(function(s){return s.dj;}).join(' & ');
  /* table volume */
  var tblFillPct = (totTbl&&totBudget) ? Math.round(totTbl/totBudget*100) : null;
  /* build sentence */
  var s = opener+d.venue+'. ';
  if(beat.length===n) s += 'All '+n+' shows exceeded their BS target';
  else if(beat.length===0) s += 'None of the '+n+' shows met their BS target';
  else s += (beatNames?beatNames+' beat':'Beat shows beat')+' target'+(missNames?' while '+missNames+' fell short':'');
  s += ', delivering '+$kv(totBS)+' total bottle service (vs '+$kv(totMin)+' combined min). ';
  if(tblFillPct!=null) s += 'Table volume was '+tblFillPct+'% of budget ('+totTbl+'/'+totBudget+' tables sold), with an avg of '+$kv(avgPerTbl)+' per table. ';
  /* tier insight */
  var tierSetC={};
  shows.forEach(function(sh){Object.keys(sh.tiers).forEach(function(t){
    if(!tierSetC[t])tierSetC[t]={beatN:0,n:0};
    if(sh.tiers[t].soldTables>0){tierSetC[t].n++;if(sh.tiers[t].avgPerTable>=sh.tiers[t].minPerTable)tierSetC[t].beatN++;}
  });});
  var topTiers=Object.keys(tierSetC).filter(function(t){return tierSetC[t].n>0&&tierSetC[t].beatN===tierSetC[t].n;});
  var lowTiers=Object.keys(tierSetC).filter(function(t){return tierSetC[t].n>0&&tierSetC[t].beatN===0;});
  if(topTiers.length) s += topTiers.join(', ')+' tier'+(topTiers.length>1?'s':'')+' consistently hit minimums';
  if(lowTiers.length) s += (topTiers.length?' while ':'')+lowTiers.join(', ')+' remained below target';
  if(topTiers.length||lowTiers.length) s += '.';
  return s;
}

/* -------------------------------------------------------------------
   FORECAST DATA ? pulled from FourVenues via Playwright scrape
   Last refreshed: 2026-07-11
   ------------------------------------------------------------------- */
var FORECAST_DATA = [
  {"venue":"Casa Neos Beach Club","date":"2026-07-18","dj":"VITO (UK)","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-07-19","dj":"KAZ JAMES","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-07-25","dj":"MARIAN","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-07-26","dj":"AMOG","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-01","dj":"","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-02","dj":"","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-08","dj":"","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-09","dj":"NOTRE DAME","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-15","dj":"ARIEL VROMEN","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-16","dj":"DJEFF","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-22","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-23","dj":"MONKEY SAFARI","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Beach Club","date":"2026-08-29","dj":"ONOMA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-18","dj":"ANGELOS","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-22","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-22","dj":"AXEL BECA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-23","dj":"BARON | NO PHONES","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-24","dj":"XINOBI","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-24","dj":"K.O.B.A","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-25","dj":"DARMON","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-29","dj":"AXEL BECA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-29","dj":"AXEL BECA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-30","dj":"SIS","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-31","dj":"NICO DE ANDREA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-07-31","dj":"K.O.B.A","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-01","dj":"AMOG","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-05","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-06","dj":"SUPER FLU","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-07","dj":"JESSICA BRANKKA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-08","dj":"MARCO LYS","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-12","dj":"ONOMA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-13","dj":"TOM & COLLINS","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-14","dj":"NICO BERNARDINI","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-15","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-19","dj":"AXEL BECA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-20","dj":"OMRI","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-21","dj":"AUGUSTO YEPES","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-22","dj":"AJNA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-26","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-27","dj":"DIFFER","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-28","dj":"ONOMA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"MILA Lounge","date":"2026-08-29","dj":"DARMON","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-18","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-19","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-23","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-24","dj":"Mal?ne Morez","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-25","dj":"AMOG","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-26","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-30","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-07-31","dj":"BHASKAR","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-01","dj":"ONOMA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-02","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-06","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-07","dj":"AMOG","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-08","dj":"KIKO FRANCO","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-09","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-13","dj":"ONOMA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-14","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-15","dj":"DARMON","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-16","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-20","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-21","dj":"","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-22","dj":"ROCKIN MOROCCIN","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-23","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-27","dj":"ONOMA","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-28","dj":"BARUT","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-29","dj":"DA MIKE","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"},
  {"venue":"Casa Neos Lounge","date":"2026-08-30","dj":"AFTERDARK","bookedTables":0,"totalTables":0,"totalRevenue":0,"tierSummary":{},"hasData":false,"_source":"sales_period_unattended","_period":"Last 7 days"}
];
var FV_PERF_DB = [{"venue":"MILA Lounge","date":"2025-01-01","dj":"Sub Zero","djKey":"SUB ZERO","dow":3,"fee":1500,"finalBs":5305,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-02","dj":"Nicolas Monier","djKey":"NICOLAS MONIER","dow":4,"fee":3500,"finalBs":51417,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-03","dj":"Laolu","djKey":"LAOLU","dow":5,"fee":2000,"finalBs":65355,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-04","dj":"Simone Vittulo","djKey":"SIMONE VITTULO","dow":6,"fee":3500,"finalBs":66196,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-01-05","dj":"Pippi Ciez","djKey":"PIPPI CIEZ","dow":0,"fee":4183,"finalBs":39391,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-08","dj":"Young Pulse","djKey":"YOUNG PULSE","dow":3,"fee":3000,"finalBs":1020,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-09","dj":"Komashov","djKey":"KOMASHOV","dow":4,"fee":10000,"finalBs":34546,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-10","dj":"Baron","djKey":"BARON","dow":5,"fee":3000,"finalBs":61609,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-11","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":6,"fee":6500,"finalBs":73443,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-01-12","dj":"Omar FNX/YAMIL","djKey":"OMAR FNX YAMIL","dow":0,"fee":7524,"finalBs":39055,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-15","dj":"Nicolas Bernardini","djKey":"NICOLAS BERNARDINI","dow":3,"fee":1500,"finalBs":13074,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-16","dj":"Kalamo","djKey":"KALAMO","dow":4,"fee":2500,"finalBs":33679,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-17","dj":"Fabrice Dayan","djKey":"FABRICE DAYAN","dow":5,"fee":3000,"finalBs":47897,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-18","dj":"Kintar","djKey":"KINTAR","dow":6,"fee":5000,"finalBs":59023,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-01-19","dj":"VALERON","djKey":"VALERON","dow":0,"fee":15000,"finalBs":85635,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-22","dj":"Bellaire","djKey":"BELLAIRE","dow":3,"fee":7000,"finalBs":15638,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-23","dj":"Valeron","djKey":"VALERON","dow":4,"fee":20000,"finalBs":54756,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-24","dj":"Yuma","djKey":"YUMA","dow":5,"fee":3500,"finalBs":52002,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-25","dj":"Darmon","djKey":"DARMON","dow":6,"fee":2500,"finalBs":51669,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-01-26","dj":"Bora Uzer","djKey":"BORA UZER","dow":0,"fee":25000,"finalBs":73340,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-29","dj":"Sandy Rivera","djKey":"SANDY RIVERA","dow":3,"fee":5000,"finalBs":11945,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-30","dj":"BLOND:ISH","djKey":"BLOND ISH","dow":4,"fee":110000,"finalBs":105210,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-01-31","dj":"Yulia Niko","djKey":"YULIA NIKO","dow":5,"fee":8000,"finalBs":52207,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-01","dj":"MonoBase","djKey":"MONOBASE","dow":6,"fee":2500,"finalBs":48981,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-02","dj":"MARTEN LOU","djKey":"MARTEN LOU","dow":0,"fee":8000,"finalBs":79938,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-05","dj":"Shapeshifter","djKey":"SHAPESHIFTER","dow":3,"fee":6000,"finalBs":8650,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-06","dj":"Nandu","djKey":"NANDU","dow":4,"fee":4500,"finalBs":40213,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-07","dj":"Joezi","djKey":"JOEZI","dow":5,"fee":7000,"finalBs":52704,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-08","dj":"APACHE","djKey":"APACHE","dow":6,"fee":6000,"finalBs":53701,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-08","dj":"Kimonos","djKey":"KIMONOS","dow":6,"fee":8000,"finalBs":59830,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-09","dj":"AMOG","djKey":"AMOG","dow":0,"fee":2000,"finalBs":70295,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-12","dj":"Sub Zero","djKey":"SUB ZERO","dow":3,"fee":1500,"finalBs":8341,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-13","dj":"Kaz James","djKey":"KAZ JAMES","dow":4,"fee":22500,"finalBs":46024,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-14","dj":"Onomaa","djKey":"ONOMAA","dow":5,"fee":500,"finalBs":45678,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-15","dj":"Derun","djKey":"DERUN","dow":6,"fee":6500,"finalBs":21680,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-15","dj":"Ariel VRomen","djKey":"ARIEL VROMEN","dow":6,"fee":5000,"finalBs":51958,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-16","dj":"Guy Gerber","djKey":"GUY GERBER","dow":0,"fee":35000,"finalBs":121627,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-19","dj":"AXEL BECA","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-20","dj":"Nadav","djKey":"NADAV","dow":4,"fee":2500,"finalBs":35231,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-21","dj":"AMOG","djKey":"AMOG","dow":5,"fee":2500,"finalBs":62371,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-22","dj":"Kiko Franco","djKey":"KIKO FRANCO","dow":6,"fee":3000,"finalBs":31282,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-22","dj":"Darmon","djKey":"DARMON","dow":6,"fee":2500,"finalBs":50505,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-02-23","dj":"Nick Morgan","djKey":"NICK MORGAN","dow":0,"fee":6000,"finalBs":86746,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-26","dj":"Danny Krivit","djKey":"DANNY KRIVIT","dow":3,"fee":5000,"finalBs":48100,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-27","dj":"Bontan","djKey":"BONTAN","dow":4,"fee":8000,"finalBs":40121,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-02-28","dj":"Sinego","djKey":"SINEGO","dow":5,"fee":5500,"finalBs":42015,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-01","dj":"Crisologo","djKey":"CRISOLOGO","dow":6,"fee":2211.2,"finalBs":41742,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-01","dj":"Marco Peruzzi","djKey":"MARCO PERUZZI","dow":6,"fee":2500,"finalBs":94160,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-02","dj":"SINEGO","djKey":"SINEGO","dow":0,"fee":5500,"finalBs":148728,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-05","dj":"Mike Dunn","djKey":"MIKE DUNN","dow":3,"fee":7000,"finalBs":7879,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-06","dj":"Avi Snow","djKey":"AVI SNOW","dow":4,"fee":3500,"finalBs":38012,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-07","dj":"Coya Music","djKey":"COYA MUSIC","dow":5,"fee":2500,"finalBs":76209,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-08","dj":"SOR & DARMON","djKey":"SOR AND DARMON","dow":6,"fee":5000,"finalBs":29410,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-08","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":6,"fee":4000,"finalBs":75243,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-09","dj":"Kimonos + Ariel Vromen","djKey":"KIMONOS ARIEL VROMEN","dow":0,"fee":13600,"finalBs":120355,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-12","dj":"Greg Cerrone","djKey":"GREG CERRONE","dow":3,"fee":2500,"finalBs":10319,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-13","dj":"Queen Rami","djKey":"QUEEN RAMI","dow":4,"fee":3000,"finalBs":44129,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-14","dj":"Yulia Niko","djKey":"YULIA NIKO","dow":5,"fee":8000,"finalBs":42029,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-15","dj":"MGT MONTANO","djKey":"MGT MONTANO","dow":6,"fee":3000,"finalBs":51472,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-15","dj":"Tiffy Vera","djKey":"TIFFY VERA","dow":6,"fee":2000,"finalBs":51431,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-16","dj":"Birds Of Mind","djKey":"BIRDS OF MIND","dow":0,"fee":12000,"finalBs":113887,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-19","dj":"Jojo Flores","djKey":"JOJO FLORES","dow":3,"fee":2000,"finalBs":10301,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-20","dj":"Valeron","djKey":"VALERON","dow":4,"fee":15000,"finalBs":44596,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-21","dj":"Mat.Joe","djKey":"MAT JOE","dow":5,"fee":5000,"finalBs":67489,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-22","dj":"Gustavo Ibarra","djKey":"GUSTAVO IBARRA","dow":6,"fee":2000,"finalBs":41454,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-22","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":67589,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-23","dj":"Valeron","djKey":"VALERON","dow":0,"fee":15000,"finalBs":131036,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-26","dj":"Kenny Dope","djKey":"KENNY DOPE","dow":3,"fee":15000,"finalBs":11976,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-27","dj":"Dennis Cruz","djKey":"DENNIS CRUZ","dow":4,"fee":60000,"finalBs":70352,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-28","dj":"Kaz James","djKey":"KAZ JAMES","dow":5,"fee":22500,"finalBs":73442,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-29","dj":"Mahmut Orhan/Evita beach club","djKey":"MAHMUT ORHAN EVITA BEACH CLUB","dow":6,"fee":47500,"finalBs":97557,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-29","dj":"Nico De Andrea","djKey":"NICO DE ANDREA","dow":6,"fee":5000,"finalBs":86688,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-03-30","dj":"Pablo Fierro","djKey":"PABLO FIERRO","dow":0,"fee":20050,"finalBs":1105,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-03-30","dj":"Saraga","djKey":"SARAGA","dow":0,"fee":4500,"finalBs":10429,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-02","dj":"Scollo","djKey":"SCOLLO","dow":3,"fee":700,"finalBs":6705,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-03","dj":"AABEL","djKey":"AABEL","dow":4,"fee":2500,"finalBs":43028,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-04","dj":"Tito","djKey":"TITO","dow":5,"fee":2500,"finalBs":69423,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-05","dj":"Simone Vittulo","djKey":"SIMONE VITTULO","dow":6,"fee":3000,"finalBs":33866,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-05","dj":"Darmon","djKey":"DARMON","dow":6,"fee":3000,"finalBs":44578,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-06","dj":"AMEME","djKey":"AMEME","dow":0,"fee":20000,"finalBs":171958,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-09","dj":"Sub Zero","djKey":"SUB ZERO","dow":3,"fee":1500,"finalBs":13129,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-10","dj":"Yulia Niko","djKey":"YULIA NIKO","dow":4,"fee":8000,"finalBs":38997,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-11","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":5,"fee":6500,"finalBs":48423,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-12","dj":"2 Nomads","djKey":"2 NOMADS","dow":6,"fee":3000,"finalBs":36094,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-12","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":60641,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-13","dj":"Gioli & Assya","djKey":"GIOLI AND ASSYA","dow":0,"fee":20000,"finalBs":115085,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-16","dj":"Jojoflores","djKey":"JOJOFLORES","dow":3,"fee":2500,"finalBs":5215,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-17","dj":"Kimonos","djKey":"KIMONOS","dow":4,"fee":8000,"finalBs":47727,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-18","dj":"Steve Lawler","djKey":"STEVE LAWLER","dow":5,"fee":8000,"finalBs":50850,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-19","dj":"Nommis","djKey":"NOMMIS","dow":6,"fee":2500,"finalBs":41945,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-19","dj":"CJ Jeff","djKey":"CJ JEFF","dow":6,"fee":2500,"finalBs":65913,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-20","dj":"Avant Gart Talabot","djKey":"AVANT GART TALABOT","dow":0,"fee":10000,"finalBs":127774,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-23","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":2500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-24","dj":"Nick Morgan","djKey":"NICK MORGAN","dow":4,"fee":6000,"finalBs":45121,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-25","dj":"Floyd Lavine","djKey":"FLOYD LAVINE","dow":5,"fee":2500,"finalBs":55540,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-26","dj":"Double Touch","djKey":"DOUBLE TOUCH","dow":6,"fee":4500,"finalBs":37733,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-26","dj":"Fabrice Dayan","djKey":"FABRICE DAYAN","dow":6,"fee":4500,"finalBs":48768,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-04-27","dj":"Satori","djKey":"SATORI","dow":0,"fee":40000,"finalBs":138559,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-04-30","dj":"Dennis Ferrer","djKey":"DENNIS FERRER","dow":3,"fee":15000,"finalBs":25081,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-01","dj":"WMW","djKey":"WMW","dow":4,"fee":4500,"finalBs":87678,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-02","dj":"CARLITA","djKey":"CARLITA","dow":5,"fee":16500,"finalBs":175753,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-03","dj":"ANOTR","djKey":"ANOTR","dow":6,"fee":180000,"finalBs":222598,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-03","dj":"KAZ JAMES","djKey":"KAZ JAMES","dow":6,"fee":22500,"finalBs":143837,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-04","dj":"B?douin","djKey":"BDOUIN","dow":0,"fee":55000,"finalBs":187545,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-04","dj":"Rony Seikaly","djKey":"RONY SEIKALY","dow":0,"fee":32000,"finalBs":27821,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-07","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":2500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-08","dj":"Chambord","djKey":"CHAMBORD","dow":4,"fee":2000,"finalBs":22927,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-09","dj":"Tim Engerlhardt","djKey":"TIM ENGERLHARDT","dow":5,"fee":2500,"finalBs":41755,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-10","dj":"BALEX","djKey":"BALEX","dow":6,"fee":1500,"finalBs":34550,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-10","dj":"Demaya","djKey":"DEMAYA","dow":6,"fee":2000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-11","dj":"AMOG","djKey":"AMOG","dow":0,"fee":2000,"finalBs":87750,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-14","dj":"Ray Kash","djKey":"RAY KASH","dow":3,"fee":500,"finalBs":11938,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-15","dj":"Tamir Regev","djKey":"TAMIR REGEV","dow":4,"fee":3000,"finalBs":36369,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-16","dj":"AMOG","djKey":"AMOG","dow":5,"fee":3000,"finalBs":68774,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-17","dj":"Nicola Bernardini b2b Tiffy Vera","djKey":"NICOLA BERNARDINI TIFFY VERA","dow":6,"fee":4000,"finalBs":20717,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-17","dj":"LUCH","djKey":"LUCH","dow":6,"fee":4000,"finalBs":69288,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-18","dj":"TOM & COLLINS","djKey":"TOM AND COLLINS","dow":0,"fee":7000,"finalBs":110788,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-21","dj":"Nicola Bernardini","djKey":"NICOLA BERNARDINI","dow":3,"fee":2000,"finalBs":3909,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-22","dj":"TMP0007","djKey":"TMP0007","dow":4,"fee":8000,"finalBs":31255,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-23","dj":"Kid Bamboo","djKey":"KID BAMBOO","dow":5,"fee":3000,"finalBs":33915,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-24","dj":"AUGUSTO YEPES","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":23599,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-24","dj":"Greg Cerrone","djKey":"GREG CERRONE","dow":6,"fee":6500,"finalBs":54735,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-25","dj":"Nic Fanciulli","djKey":"NIC FANCIULLI","dow":0,"fee":20000,"finalBs":121955,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-28","dj":"Mel.Bundo","djKey":"MEL BUNDO","dow":3,"fee":750,"finalBs":9580,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-29","dj":"Abel","djKey":"ABEL","dow":4,"fee":2500,"finalBs":27328,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-30","dj":"2Nomads/D'witches","djKey":"2NOMADS D WITCHES","dow":5,"fee":2500,"finalBs":76110,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-05-31","dj":"Aabel+2nomads","djKey":"AABEL 2NOMADS","dow":6,"fee":6000,"finalBs":159924,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-05-31","dj":"Black Circle","djKey":"BLACK CIRCLE","dow":6,"fee":2500,"finalBs":48365,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-01","dj":"Roy Rosenfield","djKey":"ROY ROSENFIELD","dow":0,"fee":8000,"finalBs":70029,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-04","dj":"Umit","djKey":"UMIT","dow":3,"fee":2000,"finalBs":1431,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-05","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":4,"fee":7500,"finalBs":33247,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-06","dj":"Lato","djKey":"LATO","dow":5,"fee":3000,"finalBs":36148,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-07","dj":"BAKAYAN","djKey":"BAKAYAN","dow":6,"fee":2700,"finalBs":11595,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-07","dj":"D Witches","djKey":"D WITCHES","dow":6,"fee":3000,"finalBs":40822,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-08","dj":"Dorian Craft","djKey":"DORIAN CRAFT","dow":0,"fee":3575,"finalBs":95935,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-11","dj":"Tony Touch","djKey":"TONY TOUCH","dow":3,"fee":3500,"finalBs":11437,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-12","dj":"Chris Luno","djKey":"CHRIS LUNO","dow":4,"fee":6000,"finalBs":34719,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-13","dj":"Tiffy Vera","djKey":"TIFFY VERA","dow":5,"fee":2000,"finalBs":34560,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-14","dj":"Cristian Lex","djKey":"CRISTIAN LEX","dow":6,"fee":0,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-14","dj":"Baron","djKey":"BARON","dow":6,"fee":3000,"finalBs":42702,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-15","dj":"Baron B2B Darmon","djKey":"BARON DARMON","dow":0,"fee":5500,"finalBs":101958,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-18","dj":"Scollo","djKey":"SCOLLO","dow":3,"fee":700,"finalBs":17252,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-19","dj":"Aabel","djKey":"AABEL","dow":4,"fee":3000,"finalBs":20870,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-20","dj":"SuperFlu","djKey":"SUPERFLU","dow":5,"fee":7000,"finalBs":53449,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-21","dj":"AMOG","djKey":"AMOG","dow":6,"fee":0,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-21","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":52932,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-22","dj":"PARALLELLE","djKey":"PARALLELLE","dow":0,"fee":12000,"finalBs":116725,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-25","dj":"David Berrie","djKey":"DAVID BERRIE","dow":3,"fee":1500,"finalBs":4294,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-26","dj":"Jessica Branka","djKey":"JESSICA BRANKA","dow":4,"fee":5000,"finalBs":19032,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-27","dj":"JUNO","djKey":"JUNO","dow":5,"fee":3000,"finalBs":30148,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-28","dj":"Cristian Lex","djKey":"CRISTIAN LEX","dow":6,"fee":0,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-06-28","dj":"Darmon","djKey":"DARMON","dow":6,"fee":3000,"finalBs":41340,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-06-29","dj":"KASANGO","djKey":"KASANGO","dow":0,"fee":7000,"finalBs":73991,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-02","dj":"Jojo Flores","djKey":"JOJO FLORES","dow":3,"fee":700,"finalBs":3790,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-03","dj":"Samson","djKey":"SAMSON","dow":4,"fee":3000,"finalBs":11017,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-04","dj":"Klement Bonelli","djKey":"KLEMENT BONELLI","dow":5,"fee":2500,"finalBs":27553,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-05","dj":"Axel Beca","djKey":"AXEL BECA","dow":6,"fee":0,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-05","dj":"Gustavo Ibarra","djKey":"GUSTAVO IBARRA","dow":6,"fee":2000,"finalBs":35279,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-06","dj":"Kaz James","djKey":"KAZ JAMES","dow":0,"fee":22000,"finalBs":64533,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-09","dj":"Scollo","djKey":"SCOLLO","dow":3,"fee":1500,"finalBs":1112,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-10","dj":"Darmon","djKey":"DARMON","dow":4,"fee":3000,"finalBs":22266,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-11","dj":"Simone Vittulo","djKey":"SIMONE VITTULO","dow":5,"fee":3500,"finalBs":30417,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-12","dj":"Cristian Lex","djKey":"CRISTIAN LEX","dow":6,"fee":0,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-12","dj":"Fabrice Dayan","djKey":"FABRICE DAYAN","dow":6,"fee":3000,"finalBs":43209,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-13","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":0,"fee":7000,"finalBs":59443,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-16","dj":"Greg Cerrone","djKey":"GREG CERRONE","dow":3,"fee":2000,"finalBs":5172,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-17","dj":"Onomaa","djKey":"ONOMAA","dow":4,"fee":1000,"finalBs":12671,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-18","dj":"Kiko Franco","djKey":"KIKO FRANCO","dow":5,"fee":2500,"finalBs":40097,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-19","dj":"Onoma","djKey":"ONOMA","dow":6,"fee":0,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-19","dj":"AXEL BECA","djKey":"AXEL BECA","dow":6,"fee":1000,"finalBs":25145,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-20","dj":"Abel","djKey":"ABEL","dow":0,"fee":3000,"finalBs":82473,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-20","dj":"AMIRAM KADOSH 7/19","djKey":"AMIRAM KADOSH 7 19","dow":0,"fee":4025,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-23","dj":"Sam Baroni","djKey":"SAM BARONI","dow":3,"fee":700,"finalBs":1758,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-24","dj":"HOAX","djKey":"HOAX","dow":4,"fee":3500,"finalBs":5716,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-25","dj":"Liam Fitzgerald","djKey":"LIAM FITZGERALD","dow":5,"fee":2500,"finalBs":37381,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-26","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":9590,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-26","dj":"Airrica","djKey":"AIRRICA","dow":6,"fee":3500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-07-27","dj":"CALUSSA","djKey":"CALUSSA","dow":0,"fee":10000,"finalBs":65723,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-30","dj":"MR BONES","djKey":"MR BONES","dow":3,"fee":1000,"finalBs":2937,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-07-31","dj":"Lee Foss","djKey":"LEE FOSS","dow":4,"fee":10000,"finalBs":17340,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-01","dj":"Onoma","djKey":"ONOMA","dow":5,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-02","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":17103,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-02","dj":"Pippi Ciez","djKey":"PIPPI CIEZ","dow":6,"fee":4000,"finalBs":40553,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-03","dj":"Rockin Morroccin","djKey":"ROCKIN MORROCCIN","dow":0,"fee":3525,"finalBs":52960,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-06","dj":"Jojo Flores","djKey":"JOJO FLORES","dow":3,"fee":2000,"finalBs":1120,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-07","dj":"Santiago Garcia","djKey":"SANTIAGO GARCIA","dow":4,"fee":3000,"finalBs":19006,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-08","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":5,"fee":7000,"finalBs":46560,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-09","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":8777,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-09","dj":"Hoomance","djKey":"HOOMANCE","dow":6,"fee":3500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-10","dj":"FAHLBERG","djKey":"FAHLBERG","dow":0,"fee":6000,"finalBs":73668,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-13","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-14","dj":"Ariel VRomen","djKey":"ARIEL VROMEN","dow":4,"fee":5000,"finalBs":32818,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-15","dj":"K.O.B.A","djKey":"K O B A","dow":5,"fee":2500,"finalBs":37379,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-16","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":15532,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-16","dj":"The Neighbors","djKey":"THE NEIGHBORS","dow":6,"fee":2500,"finalBs":79629,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-17","dj":"THEMBA","djKey":"THEMBA","dow":0,"fee":12000,"finalBs":97670,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-20","dj":"Scollo","djKey":"SCOLLO","dow":3,"fee":700,"finalBs":2896,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-21","dj":"Mia Moretti","djKey":"MIA MORETTI","dow":4,"fee":4000,"finalBs":24529,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-22","dj":"AMOG","djKey":"AMOG","dow":5,"fee":2000,"finalBs":35481,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-23","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":16531,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-23","dj":"Demaya","djKey":"DEMAYA","dow":6,"fee":4000,"finalBs":41448,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-24","dj":"AMOG","djKey":"AMOG","dow":0,"fee":2000,"finalBs":89992,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-27","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-28","dj":"AKIRA ft Darmon","djKey":"AKIRA FT DARMON","dow":4,"fee":6919,"finalBs":27077,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-29","dj":"Re.You","djKey":"RE YOU","dow":5,"fee":4000,"finalBs":33396,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-30","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":12257,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-30","dj":"Jean Marc","djKey":"JEAN MARC","dow":6,"fee":1500,"finalBs":41617,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-08-31","dj":"PABLO FIERRO","djKey":"PABLO FIERRO","dow":0,"fee":null,"finalBs":134191,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-08-31","dj":"Onoma","djKey":"ONOMA","dow":0,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-03","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-04","dj":"Avantgart Tabldot","djKey":"AVANTGART TABLDOT","dow":4,"fee":10000,"finalBs":12328,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-05","dj":"Jean Massey","djKey":"JEAN MASSEY","dow":5,"fee":2000,"finalBs":37779,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-06","dj":"GREG CERRONE","djKey":"GREG CERRONE","dow":6,"fee":2300,"finalBs":12131,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-07","dj":"APACHE","djKey":"APACHE","dow":0,"fee":6000,"finalBs":82219,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-10","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":2000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-11","dj":"Rodriguez JR.","djKey":"RODRIGUEZ JR","dow":4,"fee":2000,"finalBs":20858,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-12","dj":"AMOG","djKey":"AMOG","dow":5,"fee":2000,"finalBs":52197,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-13","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":15434,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-13","dj":"Fabrice Dayan","djKey":"FABRICE DAYAN","dow":6,"fee":3000,"finalBs":45757,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-14","dj":"Allen Husley","djKey":"ALLEN HUSLEY","dow":0,"fee":6030,"finalBs":63499,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-17","dj":"Scollo","djKey":"SCOLLO","dow":3,"fee":700,"finalBs":1472,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-18","dj":"Dorian Craft + Friends","djKey":"DORIAN CRAFT FRIENDS","dow":4,"fee":3500,"finalBs":12596,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-19","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":5,"fee":7000,"finalBs":48284,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-20","dj":"Tito Koba","djKey":"TITO KOBA","dow":6,"fee":2000,"finalBs":7403,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-20","dj":"Augusto Yepes","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":49932,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-21","dj":"Steve Lawler+Pete Tong","djKey":"STEVE LAWLER PETE TONG","dow":0,"fee":25500,"finalBs":117184,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-24","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-25","dj":"Catz&Dogz","djKey":"CATZ AND DOGZ","dow":4,"fee":8000,"finalBs":29629,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-26","dj":"Ramyen","djKey":"RAMYEN","dow":5,"fee":3500,"finalBs":59172,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-27","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":12801,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-09-27","dj":"Qwartz","djKey":"QWARTZ","dow":6,"fee":1500,"finalBs":37143,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-09-28","dj":"MONKEY SAFARI","djKey":"MONKEY SAFARI","dow":0,"fee":10010,"finalBs":127834,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-01","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-02","dj":"CHUS","djKey":"CHUS","dow":4,"fee":6000,"finalBs":18718,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-03","dj":"Chris IDH","djKey":"CHRIS IDH","dow":5,"fee":4000,"finalBs":56815,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-04","dj":"AUGUSTO YEPES","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":10292,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-04","dj":"CJ JEFF","djKey":"CJ JEFF","dow":6,"fee":2500,"finalBs":44420,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-05","dj":"AMOG","djKey":"AMOG","dow":0,"fee":2000,"finalBs":125698,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-08","dj":"James De Torres","djKey":"JAMES DE TORRES","dow":3,"fee":1500,"finalBs":3748,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-09","dj":"Enoo Napa","djKey":"ENOO NAPA","dow":4,"fee":8000,"finalBs":35574,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-10","dj":"NA SAYA","djKey":"NA SAYA","dow":5,"fee":4000,"finalBs":50918,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-11","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":16096,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-11","dj":"Tiffy Vera","djKey":"TIFFY VERA","dow":6,"fee":2000,"finalBs":63580,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-12","dj":"MALONE","djKey":"MALONE","dow":0,"fee":7000,"finalBs":92714,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-15","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-16","dj":"Darmon","djKey":"DARMON","dow":4,"fee":3000,"finalBs":36851,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-17","dj":"SImon Kidzoo","djKey":"SIMON KIDZOO","dow":5,"fee":3000,"finalBs":53604,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-18","dj":"Kiko Franco","djKey":"KIKO FRANCO","dow":6,"fee":3000,"finalBs":38103,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-18","dj":"Kimonos","djKey":"KIMONOS","dow":6,"fee":10000,"finalBs":64335,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-19","dj":"ANDHIM","djKey":"ANDHIM","dow":0,"fee":7000,"finalBs":62901,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-23","dj":"Echonomist","djKey":"ECHONOMIST","dow":4,"fee":10000,"finalBs":45845,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-24","dj":"Cameron Jack","djKey":"CAMERON JACK","dow":5,"fee":4000,"finalBs":62024,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-25","dj":"AABEL","djKey":"AABEL","dow":6,"fee":3000,"finalBs":20092,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-25","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":52549,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-10-26","dj":"AMEME, DARMON","djKey":"AMEME DARMON","dow":0,"fee":22500,"finalBs":108599,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-29","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-30","dj":"DJ Tennis","djKey":"DJ TENNIS","dow":4,"fee":20000,"finalBs":42406,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-10-31","dj":"Birds Of Mind","djKey":"BIRDS OF MIND","dow":5,"fee":11000,"finalBs":67210,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-01","dj":"SIMONE VITTULO","djKey":"SIMONE VITTULO","dow":6,"fee":3000,"finalBs":31689,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-01","dj":"Augusto Yepes","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":38365,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-02","dj":"LEE BURIDGE","djKey":"LEE BURIDGE","dow":0,"fee":25000,"finalBs":68796,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-05","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-06","dj":"James Mac","djKey":"JAMES MAC","dow":4,"fee":6000,"finalBs":32966,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-07","dj":"Yamagucci","djKey":"YAMAGUCCI","dow":5,"fee":5000,"finalBs":56903,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-08","dj":"GUSTAVO IBARRA","djKey":"GUSTAVO IBARRA","dow":6,"fee":2000,"finalBs":49279,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-08","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":59337,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-09","dj":"PABLO FIERRO","djKey":"PABLO FIERRO","dow":0,"fee":20000,"finalBs":126410,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-12","dj":"Cristian Perrera","djKey":"CRISTIAN PERRERA","dow":3,"fee":1000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-13","dj":"Gioli & Assia","djKey":"GIOLI AND ASSIA","dow":4,"fee":20000,"finalBs":48250,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-14","dj":"Sinego","djKey":"SINEGO","dow":5,"fee":5000,"finalBs":63401,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-15","dj":"KIMONOS","djKey":"KIMONOS","dow":6,"fee":10000,"finalBs":29321,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":4000,"d1Rev":4000,"d0Rev":8000,"tablesD4":1,"tablesFinal":2,"multD4":7.33,"eventId":"g2eoweolgek8t4me81rcxr9ffx0rxc2j","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-11-15","dj":"Deff","djKey":"DEFF","dow":6,"fee":5000,"finalBs":49216,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-16","dj":"SINEGO / BORA UZER","djKey":"SINEGO BORA UZER","dow":0,"fee":31000,"finalBs":132782,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":20000,"d1Rev":50000,"d0Rev":75500,"tablesD4":4,"tablesFinal":17,"multD4":6.639,"eventId":"tq61mql2hxhy713a4glqitzmz40no4l7","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-11-19","dj":"Onoma","djKey":"ONOMA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-20","dj":"Raffa Guidos","djKey":"RAFFA GUIDOS","dow":4,"fee":3500,"finalBs":29145,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-21","dj":"Steve Lawler","djKey":"STEVE LAWLER","dow":5,"fee":8000,"finalBs":72730,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-22","dj":"GAEB & MEDINA","djKey":"GAEB AND MEDINA","dow":6,"fee":3000,"finalBs":41832,"finalSrc":"toast","d14Rev":0,"d7Rev":5000,"d4Rev":5000,"d1Rev":5000,"d0Rev":5000,"tablesD4":5,"tablesFinal":8,"multD4":8.366,"eventId":"e1aqtx2w8qgbuvqk4spqz41nn80kg61k","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-11-22","dj":"Baron","djKey":"BARON","dow":6,"fee":4000,"finalBs":28536,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-23","dj":"MASON COLLECTIVE","djKey":"MASON COLLECTIVE","dow":0,"fee":15000,"finalBs":117925,"finalSrc":"toast","d14Rev":0,"d7Rev":12500,"d4Rev":43000,"d1Rev":57000,"d0Rev":77000,"tablesD4":10,"tablesFinal":18,"multD4":2.742,"eventId":"r0mcxvkhcerc919gpmikrqtmoe29ngco","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-11-26","dj":"Aabel","djKey":"AABEL","dow":3,"fee":3000,"finalBs":22231,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-27","dj":"Onoma","djKey":"ONOMA","dow":4,"fee":1000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-11-28","dj":"Nomis","djKey":"NOMIS","dow":5,"fee":3000,"finalBs":47923,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-29","dj":"2NOMADS","djKey":"2NOMADS","dow":6,"fee":3000,"finalBs":24462,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":1000,"d1Rev":2000,"d0Rev":2500,"tablesD4":1,"tablesFinal":3,"multD4":24.462,"eventId":"wb2c4shhumfhil2a7kuaf9zbg82qu7rj","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-11-29","dj":"Darmon","djKey":"DARMON","dow":6,"fee":3000,"finalBs":35733,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-11-30","dj":"VALERON","djKey":"VALERON","dow":0,"fee":15000,"finalBs":87648,"finalSrc":"toast","d14Rev":18500,"d7Rev":21000,"d4Rev":21000,"d1Rev":31000,"d0Rev":44000,"tablesD4":5,"tablesFinal":13,"multD4":4.174,"eventId":"tphk38km2ymfr0accgny41ozxo3sak8n","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-02","dj":"MIGUELLE & TONS / LUCIANO","djKey":"MIGUELLE AND TONS LUCIANO","dow":2,"fee":35000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-03","dj":"ANOTR","djKey":"ANOTR","dow":3,"fee":130000,"finalBs":131923,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-04","dj":"DIXON","djKey":"DIXON","dow":4,"fee":65000,"finalBs":140471,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-05","dj":"ADRIATIQUE","djKey":"ADRIATIQUE","dow":5,"fee":100000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-05","dj":"DESIREE","djKey":"DESIREE","dow":5,"fee":20000,"finalBs":141281,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-06","dj":"PAWSA","djKey":"PAWSA","dow":6,"fee":130000,"finalBs":461980,"finalSrc":"toast","d14Rev":188000,"d7Rev":202000,"d4Rev":212000,"d1Rev":276000,"d0Rev":305000,"tablesD4":17,"tablesFinal":25,"multD4":2.179,"eventId":"mzmnfhkq00ilwjw25h3u4rbkk3gcodge","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-06","dj":"VALERON","djKey":"VALERON","dow":6,"fee":15000,"finalBs":132457,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-07","dj":"MARCO CAROLA","djKey":"MARCO CAROLA","dow":0,"fee":120000,"finalBs":269756,"finalSrc":"toast","d14Rev":119000,"d7Rev":119000,"d4Rev":141000,"d1Rev":157000,"d0Rev":176000,"tablesD4":14,"tablesFinal":18,"multD4":1.913,"eventId":"ow5s9lyatndzcocy36hahbewp6d0y9yg","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-07","dj":"KIMONOS","djKey":"KIMONOS","dow":0,"fee":10000,"finalBs":9744,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-10","dj":"Cristian Lex","djKey":"CRISTIAN LEX","dow":3,"fee":500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-13","dj":"tk","djKey":"TK","dow":6,"fee":null,"finalBs":58251,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-13","dj":"Augusto Yepes","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":47411,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-14","dj":"TOM&COLLINS","djKey":"TOM AND COLLINS","dow":0,"fee":7000,"finalBs":81441,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":3500,"d1Rev":15500,"d0Rev":35000,"tablesD4":1,"tablesFinal":16,"multD4":23.269,"eventId":"rsui264xhoqtqfksztoup211eu5kn0u2","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-17","dj":"FALYN","djKey":"FALYN","dow":3,"fee":3000,"finalBs":9307,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-18","dj":"Darmon b2b AAbel","djKey":"DARMON AABEL","dow":4,"fee":5000,"finalBs":21579,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-19","dj":"Sinego","djKey":"SINEGO","dow":5,"fee":6000,"finalBs":20084,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-20","dj":"AABEL+VANJEE","djKey":"AABEL VANJEE","dow":6,"fee":13500,"finalBs":37578,"finalSrc":"toast","d14Rev":0,"d7Rev":4000,"d4Rev":5000,"d1Rev":12500,"d0Rev":14000,"tablesD4":2,"tablesFinal":9,"multD4":7.516,"eventId":"ldjvruj22q6mco1w7zo9l57b8ur3614t","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-20","dj":"Nick Morgan","djKey":"NICK MORGAN","dow":6,"fee":7000,"finalBs":55418,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-21","dj":"NIC FANCIULLI","djKey":"NIC FANCIULLI","dow":0,"fee":20000,"finalBs":67253,"finalSrc":"toast","d14Rev":8000,"d7Rev":16000,"d4Rev":20000,"d1Rev":25000,"d0Rev":40500,"tablesD4":4,"tablesFinal":10,"multD4":3.363,"eventId":"lqs0s61ez3ov6ru4k8t4qetd4bwa360x","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-25","dj":"Onoma","djKey":"ONOMA","dow":4,"fee":1000,"finalBs":24384,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-26","dj":"BLACK CHILD","djKey":"BLACK CHILD","dow":5,"fee":10000,"finalBs":28806,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-27","dj":"WHOMADEWHO","djKey":"WHOMADEWHO","dow":6,"fee":70000,"finalBs":95227,"finalSrc":"toast","d14Rev":5500,"d7Rev":11000,"d4Rev":21500,"d1Rev":52000,"d0Rev":57500,"tablesD4":4,"tablesFinal":13,"multD4":4.429,"eventId":"fdv0d5u11zzfqcifptv3kpifsfjsfhtb","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-27","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":25022,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-28","dj":"BEN STERLING","djKey":"BEN STERLING","dow":0,"fee":45000,"finalBs":125779,"finalSrc":"toast","d14Rev":12000,"d7Rev":20500,"d4Rev":20500,"d1Rev":33000,"d0Rev":44500,"tablesD4":5,"tablesFinal":12,"multD4":6.136,"eventId":"gfn1gssuu6qe3l4yzz9exna0ynjozaur","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2025-12-28","dj":"Steve Lawler","djKey":"STEVE LAWLER","dow":0,"fee":8000,"finalBs":13784,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-29","dj":"AMEME","djKey":"AMEME","dow":1,"fee":25000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-30","dj":"BLONDISH","djKey":"BLONDISH","dow":2,"fee":130000,"finalBs":144198,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-30","dj":"CHLOE CAILLET","djKey":"CHLOE CAILLET","dow":2,"fee":25000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2025-12-31","dj":"CARLITA","djKey":"CARLITA","dow":3,"fee":100000,"finalBs":255785,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2025-12-31","dj":"LIVA K","djKey":"LIVA K","dow":3,"fee":20000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-01","dj":"Apache","djKey":"APACHE","dow":4,"fee":7000,"finalBs":51107,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-02","dj":"Maxi Meraki","djKey":"MAXI MERAKI","dow":5,"fee":10000,"finalBs":70372,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-03","dj":"CLOONEE","djKey":"CLOONEE","dow":6,"fee":100000,"finalBs":150779,"finalSrc":"toast","d14Rev":7000,"d7Rev":18000,"d4Rev":23000,"d1Rev":58000,"d0Rev":92000,"tablesD4":3,"tablesFinal":19,"multD4":6.556,"eventId":"njfxn5wwv8hmzculyff682vi35kzyoay","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-03","dj":"Luch","djKey":"LUCH","dow":6,"fee":5000,"finalBs":51741,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-04","dj":"JAN BLOMQVIST","djKey":"JAN BLOMQVIST","dow":0,"fee":42500,"finalBs":95548,"finalSrc":"toast","d14Rev":7000,"d7Rev":7000,"d4Rev":14000,"d1Rev":36000,"d0Rev":54000,"tablesD4":4,"tablesFinal":13,"multD4":6.825,"eventId":"dgxiih7b31e3q4adf0et1olzq90lnoqy","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-07","dj":"ONOMA","djKey":"ONOMA","dow":3,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-08","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":4,"fee":7000,"finalBs":22767,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-09","dj":"Chris IDH","djKey":"CHRIS IDH","dow":5,"fee":3500,"finalBs":37566,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-10","dj":"GORDO","djKey":"GORDO","dow":6,"fee":75000,"finalBs":124890,"finalSrc":"toast","d14Rev":38000,"d7Rev":38000,"d4Rev":38000,"d1Rev":68500,"d0Rev":74500,"tablesD4":4,"tablesFinal":10,"multD4":3.287,"eventId":"h4ghuco5n3qkdvet7uojfkn7ictohhiq","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-10","dj":"Andrea Oliva","djKey":"ANDREA OLIVA","dow":6,"fee":15000,"finalBs":61795,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-11","dj":"DENNIS CRUZ","djKey":"DENNIS CRUZ","dow":0,"fee":60000,"finalBs":123943,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":12000,"d1Rev":36000,"d0Rev":44000,"tablesD4":1,"tablesFinal":9,"multD4":10.329,"eventId":"c72jnqjdloku0x52ts8a8bsnebpyiqf2","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-14","dj":"Cristian Perera","djKey":"CRISTIAN PERERA","dow":3,"fee":null,"finalBs":5736,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-15","dj":"Da Mike","djKey":"DA MIKE","dow":4,"fee":3500,"finalBs":59097,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-16","dj":"KASANGO","djKey":"KASANGO","dow":5,"fee":6000,"finalBs":59615,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-17","dj":"AABEL / SCENARIO","djKey":"AABEL SCENARIO","dow":6,"fee":13000,"finalBs":53206,"finalSrc":"toast","d14Rev":0,"d7Rev":500,"d4Rev":500,"d1Rev":6000,"d0Rev":16500,"tablesD4":1,"tablesFinal":10,"multD4":106.412,"eventId":"wu243bnxmmbj0nofgtacrfih5buopu3q","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-17","dj":"Gustavo Ibarra","djKey":"GUSTAVO IBARRA","dow":6,"fee":1500,"finalBs":57544,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-18","dj":"NOTRE DAME","djKey":"NOTRE DAME","dow":0,"fee":20000,"finalBs":157028,"finalSrc":"toast","d14Rev":10000,"d7Rev":25000,"d4Rev":65000,"d1Rev":85000,"d0Rev":108500,"tablesD4":13,"tablesFinal":21,"multD4":2.416,"eventId":"e2agvqakn1oc6lx7ajsina1a6pnlcndb","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-21","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":3587,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-22","dj":"Monkey Safari","djKey":"MONKEY SAFARI","dow":4,"fee":10000,"finalBs":39426,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-23","dj":"Sinego","djKey":"SINEGO","dow":5,"fee":6000,"finalBs":69221,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-24","dj":"STEVE LAWLER","djKey":"STEVE LAWLER","dow":6,"fee":8000,"finalBs":55439,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":5500,"d1Rev":22000,"d0Rev":25500,"tablesD4":4,"tablesFinal":12,"multD4":10.08,"eventId":"uhxam8bhvdb1izyydr4vpnlsonzy722q","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-24","dj":"Liam Fitzgerald","djKey":"LIAM FITZGERALD","dow":6,"fee":2500,"finalBs":41657,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-25","dj":"SINEGO","djKey":"SINEGO","dow":0,"fee":6000,"finalBs":127320,"finalSrc":"toast","d14Rev":3000,"d7Rev":3000,"d4Rev":10000,"d1Rev":25000,"d0Rev":52000,"tablesD4":3,"tablesFinal":14,"multD4":12.732,"eventId":"hfoqm6d9y0wzwttt7bjgdjx0r1gvhyxj","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-28","dj":"Cristian Perera","djKey":"CRISTIAN PERERA","dow":3,"fee":null,"finalBs":7687,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-29","dj":"Valeron","djKey":"VALERON","dow":4,"fee":15000,"finalBs":40211,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-01-30","dj":"Super Flu","djKey":"SUPER FLU","dow":5,"fee":7000,"finalBs":46453,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-01-31","dj":"CALUSSA","djKey":"CALUSSA","dow":6,"fee":10000,"finalBs":63268,"finalSrc":"toast","d14Rev":0,"d7Rev":500,"d4Rev":2500,"d1Rev":12500,"d0Rev":18000,"tablesD4":3,"tablesFinal":11,"multD4":25.307,"eventId":"jqtdaq0gskwi672c1ojrn8su9g4wutxo","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-01-31","dj":"Kashoski","djKey":"KASHOSKI","dow":6,"fee":3500,"finalBs":44521,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-01","dj":"VALERON","djKey":"VALERON","dow":0,"fee":10000,"finalBs":72572,"finalSrc":"toast","d14Rev":3000,"d7Rev":8000,"d4Rev":12000,"d1Rev":18000,"d0Rev":21000,"tablesD4":4,"tablesFinal":8,"multD4":6.048,"eventId":"zxxz28p3frigc6lgru1lrk919bizyfl4","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-04","dj":"Kiko Franco","djKey":"KIKO FRANCO","dow":3,"fee":3500,"finalBs":67414,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-05","dj":"Caiiro","djKey":"CAIIRO","dow":4,"fee":10000,"finalBs":18487,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-06","dj":"Peace Control","djKey":"PEACE CONTROL","dow":5,"fee":10000,"finalBs":73260,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-07","dj":"OPENER  /  TOM&COLLINS","djKey":"OPENER TOM AND COLLINS","dow":6,"fee":7000,"finalBs":69395,"finalSrc":"toast","d14Rev":0,"d7Rev":2000,"d4Rev":8500,"d1Rev":24000,"d0Rev":37000,"tablesD4":5,"tablesFinal":22,"multD4":8.164,"eventId":"yk60izojwe7jo6iirnv46xkoy3qu5oib","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-07","dj":"Ramyen","djKey":"RAMYEN","dow":6,"fee":3500,"finalBs":58252,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-08","dj":"FRANKY RIZARDO","djKey":"FRANKY RIZARDO","dow":0,"fee":40000,"finalBs":86683,"finalSrc":"toast","d14Rev":16000,"d7Rev":27500,"d4Rev":27500,"d1Rev":44500,"d0Rev":55500,"tablesD4":5,"tablesFinal":14,"multD4":3.152,"eventId":"c0pjeurmzllbidzi2ljovpuo2ivs1uq8","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-11","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":491,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-12","dj":"Kaz James","djKey":"KAZ JAMES","dow":4,"fee":25000,"finalBs":41218,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-13","dj":"Ariel Vromen","djKey":"ARIEL VROMEN","dow":5,"fee":4000,"finalBs":49991,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-14","dj":"DJEFF B2B AWEN","djKey":"DJEFF AWEN","dow":6,"fee":17000,"finalBs":33668,"finalSrc":"toast","d14Rev":0,"d7Rev":7500,"d4Rev":12000,"d1Rev":20500,"d0Rev":20500,"tablesD4":3,"tablesFinal":5,"multD4":2.806,"eventId":"mu6lakomuy0g1qbaspd2ake1vvhpid98","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-14","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":51507,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-15","dj":"SILVIE LOTTO","djKey":"SILVIE LOTTO","dow":0,"fee":8000,"finalBs":139084,"finalSrc":"toast","d14Rev":10000,"d7Rev":10000,"d4Rev":47500,"d1Rev":59184,"d0Rev":71184,"tablesD4":9,"tablesFinal":16,"multD4":2.928,"eventId":"b9cvvqcs450b6jn5v446pjlh24xk79np","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-15","dj":"Cristian Lex","djKey":"CRISTIAN LEX","dow":0,"fee":500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-18","dj":"Leo Gira","djKey":"LEO GIRA","dow":3,"fee":1000,"finalBs":12335,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-19","dj":"SOMMA","djKey":"SOMMA","dow":4,"fee":4500,"finalBs":21302,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-20","dj":"Nick Morgan","djKey":"NICK MORGAN","dow":5,"fee":8000,"finalBs":39125,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-21","dj":"PABLO FIERRO","djKey":"PABLO FIERRO","dow":6,"fee":25000,"finalBs":62554,"finalSrc":"toast","d14Rev":0,"d7Rev":0,"d4Rev":8500,"d1Rev":22500,"d0Rev":30500,"tablesD4":3,"tablesFinal":10,"multD4":7.359,"eventId":"r4aprjmxv8gv2rw83shepnt6xhuoubet","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-21","dj":"Kimonos","djKey":"KIMONOS","dow":6,"fee":10000,"finalBs":74135,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-22","dj":"BEDOUIN","djKey":"BEDOUIN","dow":0,"fee":70000,"finalBs":180943,"finalSrc":"toast","d14Rev":27000,"d7Rev":45500,"d4Rev":79000,"d1Rev":91500,"d0Rev":111500,"tablesD4":13,"tablesFinal":18,"multD4":2.29,"eventId":"i1jn2wct9fkyke4a9406lv9a5xvxgvz2","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-25","dj":"Onoma","djKey":"ONOMA","dow":3,"fee":null,"finalBs":22306,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-26","dj":"Malne","djKey":"MALNE","dow":4,"fee":7000,"finalBs":40086,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-02-27","dj":"AMOG","djKey":"AMOG","dow":5,"fee":2000,"finalBs":34854,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-02-28","dj":"AABEL DAMIAN LAZARUS","djKey":"AABEL DAMIAN LAZARUS","dow":6,"fee":60000,"finalBs":97180,"finalSrc":"toast","d14Rev":8000,"d7Rev":15000,"d4Rev":19000,"d1Rev":40000,"d0Rev":62000,"tablesD4":4,"tablesFinal":15,"multD4":5.115,"eventId":"zjnurwjr9qghn7lc0pqjsmehntwb7hdi","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-02-28","dj":"Augusto Yepes","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":68467,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-01","dj":"MARCO CAROLA","djKey":"MARCO CAROLA","dow":0,"fee":120000,"finalBs":187240,"finalSrc":"toast","d14Rev":11000,"d7Rev":23000,"d4Rev":51000,"d1Rev":94000,"d0Rev":117000,"tablesD4":4,"tablesFinal":14,"multD4":3.671,"eventId":"yxpgde4izkl6hyad8dy6wc78vrd9vf8d","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-03-04","dj":"onoma","djKey":"ONOMA","dow":3,"fee":500,"finalBs":6131,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-05","dj":"KAZ JAMES","djKey":"KAZ JAMES","dow":4,"fee":25000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-05","dj":"Kimonos","djKey":"KIMONOS","dow":4,"fee":10000,"finalBs":52337,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-06","dj":"RONY SEIKALI","djKey":"RONY SEIKALI","dow":5,"fee":40000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-06","dj":"SINEGO","djKey":"SINEGO","dow":5,"fee":6000,"finalBs":63636,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-07","dj":"PRIVATE EVENT w/ RUFUS DU SOL","djKey":"PRIVATE EVENT W RUFUS DU SOL","dow":6,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-07","dj":"CLOSED FOR P.E","djKey":"CLOSED FOR P E","dow":6,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-07","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":47655,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-08","dj":"BOB MOSES","djKey":"BOB MOSES","dow":0,"fee":85000,"finalBs":143741,"finalSrc":"toast","d14Rev":0,"d7Rev":15500,"d4Rev":27500,"d1Rev":79500,"d0Rev":88500,"tablesD4":4,"tablesFinal":15,"multD4":5.227,"eventId":"ouw89r8qdqu6qqb85omhksypi0hr4dsb","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-08","dj":"SINEGO","djKey":"SINEGO","dow":0,"fee":6000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-11","dj":"Osoraro Okan","djKey":"OSORARO OKAN","dow":3,"fee":1000,"finalBs":304,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-12","dj":"Luca Saporito (audiofly)","djKey":"LUCA SAPORITO AUDIOFLY","dow":4,"fee":3500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-12","dj":"AJ Christou","djKey":"AJ CHRISTOU","dow":4,"fee":4000,"finalBs":27543,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-13","dj":"Deer Jade","djKey":"DEER JADE","dow":5,"fee":10000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-13","dj":"Enoo Napa b2b Da Capo","djKey":"ENOO NAPA DA CAPO","dow":5,"fee":12000,"finalBs":30662,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-14","dj":"MIGUELLE & TONS","djKey":"MIGUELLE AND TONS","dow":6,"fee":15000,"finalBs":80268,"finalSrc":"toast","d14Rev":7000,"d7Rev":10000,"d4Rev":13000,"d1Rev":35500,"d0Rev":44000,"tablesD4":4,"tablesFinal":16,"multD4":6.174,"eventId":"xoedo6akhfiulpx92su8r3pgyd843vlo","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-14","dj":"Kadosh","djKey":"KADOSH","dow":6,"fee":3000,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-14","dj":"Dorian Craft","djKey":"DORIAN CRAFT","dow":6,"fee":3500,"finalBs":29527,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-15","dj":"MITA GAMI","djKey":"MITA GAMI","dow":0,"fee":45000,"finalBs":81785,"finalSrc":"toast","d14Rev":0,"d7Rev":14000,"d4Rev":28000,"d1Rev":59000,"d0Rev":69000,"tablesD4":6,"tablesFinal":14,"multD4":2.921,"eventId":"ar1n4ndtvgtjceqxh952gq6ousxj7z2h","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-15","dj":"Barut","djKey":"BARUT","dow":0,"fee":1000,"finalBs":34911,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-18","dj":"Lance","djKey":"LANCE","dow":3,"fee":1000,"finalBs":21539,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-19","dj":"Yung Omz","djKey":"YUNG OMZ","dow":4,"fee":3500,"finalBs":16480,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-19","dj":"Camilo Franco","djKey":"CAMILO FRANCO","dow":4,"fee":5000,"finalBs":41229,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-20","dj":"Tiffy Vera","djKey":"TIFFY VERA","dow":5,"fee":3000,"finalBs":49084,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-20","dj":"Da Mike","djKey":"DA MIKE","dow":5,"fee":3500,"finalBs":75926,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-21","dj":"ANDREA OLIVA","djKey":"ANDREA OLIVA","dow":6,"fee":12500,"finalBs":110703,"finalSrc":"toast","d14Rev":9000,"d7Rev":20500,"d4Rev":20500,"d1Rev":47500,"d0Rev":65500,"tablesD4":6,"tablesFinal":22,"multD4":5.4,"eventId":"ut14p9fxicte9osegxh0hns53hnay0q1","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-21","dj":"Poulardo","djKey":"POULARDO","dow":6,"fee":5000,"finalBs":62811,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-21","dj":"CJ Jeff","djKey":"CJ JEFF","dow":6,"fee":3500,"finalBs":59922,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-22","dj":"ROGER SANCHEZ","djKey":"ROGER SANCHEZ","dow":0,"fee":15000,"finalBs":151987,"finalSrc":"toast","d14Rev":7500,"d7Rev":42500,"d4Rev":69500,"d1Rev":77500,"d0Rev":109000,"tablesD4":16,"tablesFinal":23,"multD4":2.187,"eventId":"cqz1izpvila9jooljwda68l58j1boqac","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-22","dj":"Barut","djKey":"BARUT","dow":0,"fee":1000,"finalBs":48889,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-25","dj":"AAA","djKey":"AAA","dow":3,"fee":10000,"finalBs":45575,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-26","dj":"ADAM TEN","djKey":"ADAM TEN","dow":4,"fee":45000,"finalBs":123596,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-26","dj":"SHIMZA","djKey":"SHIMZA","dow":4,"fee":35000,"finalBs":70034,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-03-27","dj":"TOMAN","djKey":"TOMAN","dow":5,"fee":12000,"finalBs":86469,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-27","dj":"KAZ JAMES","djKey":"KAZ JAMES","dow":5,"fee":25000,"finalBs":75926,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-28","dj":"CAMELPHAT","djKey":"CAMELPHAT","dow":6,"fee":80000,"finalBs":258501,"finalSrc":"toast","d14Rev":109500,"d7Rev":157500,"d4Rev":163500,"d1Rev":198500,"d0Rev":198500,"tablesD4":24,"tablesFinal":27,"multD4":1.581,"eventId":"rsjix5ych577qm59vlcnm1edwg6mao47","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-28","dj":"MASON COLLECTIVE","djKey":"MASON COLLECTIVE","dow":6,"fee":15000,"finalBs":81576,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-28","dj":"MARTEN LOU","djKey":"MARTEN LOU","dow":6,"fee":10000,"finalBs":118551,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-03-29","dj":"LUCIANO","djKey":"LUCIANO","dow":0,"fee":70000,"finalBs":145977,"finalSrc":"toast","d14Rev":39500,"d7Rev":44500,"d4Rev":44500,"d1Rev":73000,"d0Rev":98000,"tablesD4":7,"tablesFinal":18,"multD4":3.28,"eventId":"ip4expi32du6r87rib5zrbyokjkmkctw","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-03-29","dj":"MIGUELLE & TONS","djKey":"MIGUELLE AND TONS","dow":0,"fee":15000,"finalBs":104127,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-03-29","dj":"ONOMA","djKey":"ONOMA","dow":0,"fee":500,"finalBs":15113,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-01","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":500,"finalBs":515,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-02","dj":"ECHONOMIST","djKey":"ECHONOMIST","dow":4,"fee":12000,"finalBs":14235,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-02","dj":"Blair","djKey":"BLAIR","dow":4,"fee":4000,"finalBs":35501,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-03","dj":"CHAMBORD","djKey":"CHAMBORD","dow":5,"fee":6000,"finalBs":35403,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-03","dj":"Kid Bamboo","djKey":"KID BAMBOO","dow":5,"fee":3000,"finalBs":55749,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-04","dj":"ZEEBA ft AVI live","djKey":"ZEEBA FT AVI LIVE","dow":6,"fee":10000,"finalBs":65511,"finalSrc":"toast","d14Rev":2500,"d7Rev":2500,"d4Rev":2500,"d1Rev":15500,"d0Rev":34500,"tablesD4":1,"tablesFinal":13,"multD4":26.204,"eventId":"b29rdq6faqin4ekilzsxz3gzh43wotxy","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-04","dj":"JESSICA BRANKA","djKey":"JESSICA BRANKA","dow":6,"fee":4000,"finalBs":72815,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-04","dj":"DMTRI","djKey":"DMTRI","dow":6,"fee":2500,"finalBs":44226,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-05","dj":"SHIMZA","djKey":"SHIMZA","dow":0,"fee":40000,"finalBs":172621,"finalSrc":"toast","d14Rev":0,"d7Rev":26500,"d4Rev":40000,"d1Rev":79500,"d0Rev":103500,"tablesD4":7,"tablesFinal":21,"multD4":4.316,"eventId":"bq7b9x7o7go4ptjex7uhi3mq5wdamzuu","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-05","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":30919,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-08","dj":"Leo Gira","djKey":"LEO GIRA","dow":3,"fee":1500,"finalBs":5299,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-09","dj":"YULIA NIKO","djKey":"YULIA NIKO","dow":4,"fee":8000,"finalBs":5673,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-09","dj":"AABEL","djKey":"AABEL","dow":4,"fee":3000,"finalBs":64572,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-10","dj":"BARON","djKey":"BARON","dow":5,"fee":4000,"finalBs":34663,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-10","dj":"Tom&Collins","djKey":"TOM AND COLLINS","dow":5,"fee":7000,"finalBs":56291,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-11","dj":"VANJEE","djKey":"VANJEE","dow":6,"fee":8000,"finalBs":72499,"finalSrc":"toast","d14Rev":0,"d7Rev":4000,"d4Rev":7000,"d1Rev":21500,"d0Rev":29000,"tablesD4":2,"tablesFinal":12,"multD4":10.357,"eventId":"vfajl9df5ax2r9siapuonm2erlk3dts9","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-11","dj":"TOM ZETA","djKey":"TOM ZETA","dow":6,"fee":3500,"finalBs":65847,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-11","dj":"DEMAY","djKey":"DEMAY","dow":6,"fee":4000,"finalBs":35869,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-12","dj":"DARMON B2B BARON","djKey":"DARMON BARON","dow":0,"fee":8000,"finalBs":134411,"finalSrc":"toast","d14Rev":0,"d7Rev":9000,"d4Rev":34500,"d1Rev":47500,"d0Rev":61500,"tablesD4":9,"tablesFinal":17,"multD4":3.896,"eventId":"bmdlbdbz4duj90zdq9ij7evaaxdca7fy","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-12","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":43828,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-15","dj":"Axel Beca","djKey":"AXEL BECA","dow":3,"fee":500,"finalBs":10726,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-16","dj":"ARIEL VROMEN/KIMONOS","djKey":"ARIEL VROMEN KIMONOS","dow":4,"fee":14000,"finalBs":30653,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-16","dj":"JIMI JULES","djKey":"JIMI JULES","dow":4,"fee":40000,"finalBs":60081,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-17","dj":"JEAN MARC","djKey":"JEAN MARC","dow":5,"fee":2500,"finalBs":39470,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-17","dj":"Chris IDH","djKey":"CHRIS IDH","dow":5,"fee":3500,"finalBs":22047,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-18","dj":"NICO DE ANDREA","djKey":"NICO DE ANDREA","dow":6,"fee":8000,"finalBs":58682,"finalSrc":"toast","d14Rev":4000,"d7Rev":7500,"d4Rev":7500,"d1Rev":19500,"d0Rev":27500,"tablesD4":2,"tablesFinal":9,"multD4":7.824,"eventId":"iiwjno4d5pxkr79oq4e3gwphsy016kz4","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-18","dj":"MONOBASE","djKey":"MONOBASE","dow":6,"fee":2500,"finalBs":46307,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-18","dj":"Sama","djKey":"SAMA","dow":6,"fee":1500,"finalBs":56557,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-19","dj":"ENOO NAPA b2b CAIIRO","djKey":"ENOO NAPA CAIIRO","dow":0,"fee":20000,"finalBs":114848,"finalSrc":"toast","d14Rev":4500,"d7Rev":12500,"d4Rev":18500,"d1Rev":43000,"d0Rev":58500,"tablesD4":4,"tablesFinal":14,"multD4":6.208,"eventId":"wtoc3qu6pvqq7e10agid2zql7iuofu3x","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-19","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":37241,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-22","dj":"Jay  V","djKey":"JAY V","dow":3,"fee":500,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-23","dj":"MEDNAS/naas/saad","djKey":"MEDNAS NAAS SAAD","dow":4,"fee":5000,"finalBs":14268,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-23","dj":"BUN XAPA","djKey":"BUN XAPA","dow":4,"fee":3500,"finalBs":42032,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-24","dj":"BARUT","djKey":"BARUT","dow":5,"fee":1000,"finalBs":29368,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-24","dj":"Rockin Morroccin","djKey":"ROCKIN MORROCCIN","dow":5,"fee":4000,"finalBs":52676,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-25","dj":"PATRICK TOPPING","djKey":"PATRICK TOPPING","dow":6,"fee":60000,"finalBs":81713,"finalSrc":"toast","d14Rev":40000,"d7Rev":40000,"d4Rev":54000,"d1Rev":81000,"d0Rev":88000,"tablesD4":7,"tablesFinal":15,"multD4":1.513,"eventId":"v5eayel7yfk71bp0czys4jqmirmeadkn","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-25","dj":"FLETCH","djKey":"FLETCH","dow":6,"fee":5000,"finalBs":47427,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-25","dj":"Apache","djKey":"APACHE","dow":6,"fee":6000,"finalBs":41180,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-04-26","dj":"BORA UZER","djKey":"BORA UZER","dow":0,"fee":20000,"finalBs":128908,"finalSrc":"toast","d14Rev":0,"d7Rev":11000,"d4Rev":21500,"d1Rev":45000,"d0Rev":67000,"tablesD4":4,"tablesFinal":18,"multD4":5.996,"eventId":"yzzfrjg8eusf7rcjycac4unp0hikddr0","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-04-26","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":20073,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-29","dj":"Onoma","djKey":"ONOMA","dow":3,"fee":500,"finalBs":4014,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-04-30","dj":"CARLITA","djKey":"CARLITA","dow":4,"fee":70000,"finalBs":140912,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-04-30","dj":"GUY GERBER","djKey":"GUY GERBER","dow":4,"fee":45000,"finalBs":79754,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-01","dj":"ADRIATIQUE","djKey":"ADRIATIQUE","dow":5,"fee":150000,"finalBs":467197,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-01","dj":"CHLOE CAILLET","djKey":"CHLOE CAILLET","dow":5,"fee":30000,"finalBs":105691,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-01","dj":"KAZ JAMES","djKey":"KAZ JAMES","dow":5,"fee":25000,"finalBs":100832,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-02","dj":"MESTIZA","djKey":"MESTIZA","dow":6,"fee":45000,"finalBs":235881,"finalSrc":"toast","d14Rev":91000,"d7Rev":130000,"d4Rev":145000,"d1Rev":169000,"d0Rev":178000,"tablesD4":13,"tablesFinal":17,"multD4":1.627,"eventId":"iuwp3gs7e2jx0qzbl49y1bnt6szbc2mr","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-02","dj":"JADEN THOMSON","djKey":"JADEN THOMSON","dow":6,"fee":5000,"finalBs":99923,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-02","dj":"MASON COLLECTIVE","djKey":"MASON COLLECTIVE","dow":6,"fee":20000,"finalBs":135388,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-03","dj":"SETH TROXLER","djKey":"SETH TROXLER","dow":0,"fee":60000,"finalBs":227159,"finalSrc":"toast","d14Rev":23000,"d7Rev":36000,"d4Rev":62000,"d1Rev":120000,"d0Rev":168000,"tablesD4":13,"tablesFinal":25,"multD4":3.664,"eventId":"h84hgevtvl6xayonsrm1cy0jbdi4a4o3","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-03","dj":"AFTER DARK","djKey":"AFTER DARK","dow":0,"fee":1000,"finalBs":134645,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-03","dj":"KIMONOS","djKey":"KIMONOS","dow":0,"fee":10000,"finalBs":22811,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-06","dj":"AXEL BECA","djKey":"AXEL BECA","dow":3,"fee":1000,"finalBs":24481,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-07","dj":"DARMON","djKey":"DARMON","dow":4,"fee":4000,"finalBs":7585,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-07","dj":"MASSUMA","djKey":"MASSUMA","dow":4,"fee":5000,"finalBs":60152,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-08","dj":"BARUT","djKey":"BARUT","dow":5,"fee":2500,"finalBs":7799,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-08","dj":"AMOG","djKey":"AMOG","dow":5,"fee":3500,"finalBs":47702,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-09","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":42858,"finalSrc":"toast","d14Rev":0,"d7Rev":5500,"d4Rev":13500,"d1Rev":20500,"d0Rev":20500,"tablesD4":4,"tablesFinal":6,"multD4":3.175,"eventId":"h688mc6sixudk8rjq2jdthybrmg8i9ah","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-09","dj":"TIFFY VERA","djKey":"TIFFY VERA","dow":6,"fee":4000,"finalBs":35072,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-09","dj":"GUSTAVO IBARRA","djKey":"GUSTAVO IBARRA","dow":6,"fee":1500,"finalBs":22114,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-10","dj":"APACHE","djKey":"APACHE","dow":0,"fee":6000,"finalBs":45560,"finalSrc":"toast","d14Rev":5000,"d7Rev":5000,"d4Rev":9500,"d1Rev":14000,"d0Rev":18000,"tablesD4":3,"tablesFinal":7,"multD4":4.796,"eventId":"db516hvzt5gf6s8w34pmgr4t261ymz5h","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-10","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":11917,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-13","dj":"LEX","djKey":"LEX","dow":3,"fee":1500,"finalBs":15020,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-14","dj":"MONKEY SAFARI / GAEB","djKey":"MONKEY SAFARI GAEB","dow":4,"fee":12000,"finalBs":20079,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-14","dj":"STEVE LAWLER","djKey":"STEVE LAWLER","dow":4,"fee":3000,"finalBs":19878,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-15","dj":"Mr BONES","djKey":"MR BONES","dow":5,"fee":2000,"finalBs":26268,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-15","dj":"AUGUSTO YEPES","djKey":"AUGUSTO YEPES","dow":5,"fee":4250,"finalBs":37554,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-16","dj":"KIMONOS","djKey":"KIMONOS","dow":6,"fee":10000,"finalBs":46827,"finalSrc":"toast","d14Rev":7500,"d7Rev":10500,"d4Rev":30500,"d1Rev":33500,"d0Rev":34500,"tablesD4":8,"tablesFinal":10,"multD4":1.535,"eventId":"xa3uhfsb6zoic41kgmyczqmulln1levi","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-16","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":60857,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-16","dj":"MAXI MERAKI  / POP UP MOMENTO","djKey":"MAXI MERAKI POP UP MOMENTO","dow":6,"fee":10000,"finalBs":39739,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-17","dj":"MONOLINK","djKey":"MONOLINK","dow":0,"fee":100000,"finalBs":153094,"finalSrc":"toast","d14Rev":22500,"d7Rev":46000,"d4Rev":73000,"d1Rev":82000,"d0Rev":89000,"tablesD4":9,"tablesFinal":13,"multD4":2.097,"eventId":"gl9v2u2gt1spvx065bp2l2nok6l4u9ad","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-17","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":28631,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-20","dj":"ONOMA","djKey":"ONOMA","dow":3,"fee":null,"finalBs":139,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-21","dj":"JAMIIE / MEJIAS","djKey":"JAMIIE MEJIAS","dow":4,"fee":7000,"finalBs":9580,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-21","dj":"APE DRUMS","djKey":"APE DRUMS","dow":4,"fee":8000,"finalBs":23167,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-22","dj":"TECHNASIA","djKey":"TECHNASIA","dow":5,"fee":5500,"finalBs":13887,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-22","dj":"CJ JEFF","djKey":"CJ JEFF","dow":5,"fee":2500,"finalBs":74195,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-23","dj":"STEVE LAWLER","djKey":"STEVE LAWLER","dow":6,"fee":8000,"finalBs":94061,"finalSrc":"toast","d14Rev":8000,"d7Rev":13500,"d4Rev":13500,"d1Rev":16500,"d0Rev":30500,"tablesD4":5,"tablesFinal":10,"multD4":6.967,"eventId":"mo12gvn1fzn5hh6nf4w6r1tgppv05wje","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-23","dj":"SIMON KIDZOO / CALUSSA","djKey":"SIMON KIDZOO CALUSSA","dow":6,"fee":2000,"finalBs":76855,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-23","dj":"NICK MORGAN","djKey":"NICK MORGAN","dow":6,"fee":8000,"finalBs":44376,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-24","dj":"TOM & COLLINS","djKey":"TOM AND COLLINS","dow":0,"fee":7000,"finalBs":146819,"finalSrc":"toast","d14Rev":28000,"d7Rev":38000,"d4Rev":60000,"d1Rev":92000,"d0Rev":92000,"tablesD4":16,"tablesFinal":24,"multD4":2.447,"eventId":"qvj41y5ecsawfvf893bll9cgbif5e9li","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-24","dj":"AFTER ARK","djKey":"AFTER ARK","dow":0,"fee":1000,"finalBs":77659,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-24","dj":"DA CAPO","djKey":"DA CAPO","dow":0,"fee":null,"finalBs":null,"finalSrc":null,"d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-25","dj":"PABLO FIERRO","djKey":"PABLO FIERRO","dow":1,"fee":20000,"finalBs":37215,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-27","dj":"LEX","djKey":"LEX","dow":3,"fee":500,"finalBs":8370,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-28","dj":"BARUT","djKey":"BARUT","dow":4,"fee":1000,"finalBs":2544,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-28","dj":"KIMONOS","djKey":"KIMONOS","dow":4,"fee":10000,"finalBs":42244,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-05-29","dj":"CAMERON JACK","djKey":"CAMERON JACK","dow":5,"fee":4000,"finalBs":12487,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-29","dj":"AMEME","djKey":"AMEME","dow":5,"fee":25000,"finalBs":53371,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-30","dj":"VANJEE","djKey":"VANJEE","dow":6,"fee":12000,"finalBs":102103,"finalSrc":"toast","d14Rev":16500,"d7Rev":16500,"d4Rev":30500,"d1Rev":47500,"d0Rev":49500,"tablesD4":8,"tablesFinal":14,"multD4":3.348,"eventId":"fhb5rmybmapu1axje6uaakrtjpjn5h36","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-30","dj":"TMPLE","djKey":"TMPLE","dow":6,"fee":3500,"finalBs":37177,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-05-30","dj":"DARMON","djKey":"DARMON","dow":6,"fee":4000,"finalBs":29543,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-05-31","dj":"BONTAN","djKey":"BONTAN","dow":0,"fee":10000,"finalBs":93865,"finalSrc":"toast","d14Rev":1500,"d7Rev":8500,"d4Rev":15500,"d1Rev":27000,"d0Rev":33000,"tablesD4":5,"tablesFinal":11,"multD4":6.056,"eventId":"wy1oskc2b88nzuvi64o9fq318suaypa3","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-05-31","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":30820,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-03","dj":"AXEL BECA","djKey":"AXEL BECA","dow":3,"fee":500,"finalBs":175,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-04","dj":"BOB MOSES","djKey":"BOB MOSES","dow":4,"fee":40000,"finalBs":41336,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-04","dj":"MEL","djKey":"MEL","dow":4,"fee":6000,"finalBs":8175,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-05","dj":"NINO (FR)","djKey":"NINO FR","dow":5,"fee":2500,"finalBs":11899,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-05","dj":"K.O.B.A","djKey":"K O B A","dow":5,"fee":2000,"finalBs":24471,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-06","dj":"AABEL","djKey":"AABEL","dow":6,"fee":3000,"finalBs":62389,"finalSrc":"toast","d14Rev":2500,"d7Rev":16000,"d4Rev":16000,"d1Rev":23500,"d0Rev":28500,"tablesD4":6,"tablesFinal":13,"multD4":3.899,"eventId":"oskmpwl0phjv82qgftwslk0bgx287mqj","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-06","dj":"AMOG","djKey":"AMOG","dow":6,"fee":2000,"finalBs":34656,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-06","dj":"JAMES MAC","djKey":"JAMES MAC","dow":6,"fee":3500,"finalBs":28076,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-07","dj":"CEDRIC GERVAIS","djKey":"CEDRIC GERVAIS","dow":0,"fee":15000,"finalBs":100144,"finalSrc":"toast","d14Rev":0,"d7Rev":11000,"d4Rev":15000,"d1Rev":34000,"d0Rev":43000,"tablesD4":5,"tablesFinal":17,"multD4":6.676,"eventId":"emso07kvwflsjs4ohwjrz7v8762vw047","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-07","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":31821,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-10","dj":"LEX","djKey":"LEX","dow":3,"fee":500,"finalBs":289,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-11","dj":"ONOMA","djKey":"ONOMA","dow":4,"fee":1000,"finalBs":484,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-11","dj":"OSCAAR","djKey":"OSCAAR","dow":4,"fee":2500,"finalBs":16025,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-12","dj":"K.O.B.A","djKey":"K O B A","dow":5,"fee":2000,"finalBs":23900,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-12","dj":"TIM ENGELHARDT","djKey":"TIM ENGELHARDT","dow":5,"fee":5000,"finalBs":25997,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-13","dj":"AMINE K","djKey":"AMINE K","dow":6,"fee":4000,"finalBs":37511,"finalSrc":"toast","d14Rev":3000,"d7Rev":6000,"d4Rev":12500,"d1Rev":25000,"d0Rev":26500,"tablesD4":4,"tablesFinal":13,"multD4":3.001,"eventId":"jhtwxpjaq63529xoynfzlxk39smx0f4a","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-13","dj":"AUGUSTO YEPES","djKey":"AUGUSTO YEPES","dow":6,"fee":4000,"finalBs":18638,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-13","dj":"MELOKO","djKey":"MELOKO","dow":6,"fee":4000,"finalBs":31111,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-14","dj":"ADAM TEN","djKey":"ADAM TEN","dow":0,"fee":30000,"finalBs":158296,"finalSrc":"toast","d14Rev":22500,"d7Rev":54500,"d4Rev":54500,"d1Rev":73000,"d0Rev":83000,"tablesD4":10,"tablesFinal":15,"multD4":2.905,"eventId":"njzxhohshrpkrd7fhxzdqrct9ijc65z7","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-14","dj":"DJ TENNIS","djKey":"DJ TENNIS","dow":0,"fee":25000,"finalBs":34682,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-17","dj":"ONOMA","djKey":"ONOMA","dow":3,"fee":1000,"finalBs":13049,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-18","dj":"BARUT","djKey":"BARUT","dow":4,"fee":1000,"finalBs":2103,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-18","dj":"RSQUARED","djKey":"RSQUARED","dow":4,"fee":4000,"finalBs":11818,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-19","dj":"GIOLI & ASSIA","djKey":"GIOLI AND ASSIA","dow":5,"fee":20000,"finalBs":13524,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-19","dj":"SAMM","djKey":"SAMM","dow":5,"fee":10000,"finalBs":45532,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-20","dj":"DARMON","djKey":"DARMON","dow":6,"fee":4000,"finalBs":59964,"finalSrc":"toast","d14Rev":5500,"d7Rev":8500,"d4Rev":12000,"d1Rev":24500,"d0Rev":31000,"tablesD4":7,"tablesFinal":18,"multD4":4.997,"eventId":"jn1ncfyk31bzvoeaal9f8vn5fpsvw6e2","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-20","dj":"DORIAN CRAFT","djKey":"DORIAN CRAFT","dow":6,"fee":3500,"finalBs":51173,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-20","dj":"FRANC FALA","djKey":"FRANC FALA","dow":6,"fee":4000,"finalBs":47412,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-21","dj":"MARTEN LOU","djKey":"MARTEN LOU","dow":0,"fee":10000,"finalBs":126254,"finalSrc":"toast","d14Rev":8000,"d7Rev":12000,"d4Rev":25000,"d1Rev":38000,"d0Rev":56000,"tablesD4":15,"tablesFinal":23,"multD4":5.05,"eventId":"iqtcgmjp2dfhd2q9sxbufv95fdmgbmly","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-21","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":52130,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-24","dj":"KIKO FRANCO","djKey":"KIKO FRANCO","dow":3,"fee":3000,"finalBs":15871,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-25","dj":"2NOMADS","djKey":"2NOMADS","dow":4,"fee":5000,"finalBs":55262,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-25","dj":"BENJA","djKey":"BENJA","dow":4,"fee":3500,"finalBs":42584,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-06-26","dj":"TOM ZETTA","djKey":"TOM ZETTA","dow":5,"fee":5000,"finalBs":52448,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-26","dj":"SINEGO","djKey":"SINEGO","dow":5,"fee":6500,"finalBs":48828,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-27","dj":"CALUSSA","djKey":"CALUSSA","dow":6,"fee":12000,"finalBs":49926,"finalSrc":"toast","d14Rev":500,"d7Rev":2500,"d4Rev":8500,"d1Rev":20500,"d0Rev":25000,"tablesD4":6,"tablesFinal":14,"multD4":5.874,"eventId":"i9gvv2xxkbqompnw45qhaxhzap9jegh3","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-27","dj":"AUGUSTO YEPES","djKey":"AUGUSTO YEPES","dow":6,"fee":4250,"finalBs":30413,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-06-27","dj":"GUSTAVO IBARRA","djKey":"GUSTAVO IBARRA","dow":6,"fee":2000,"finalBs":68159,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-06-28","dj":"THEMBA","djKey":"THEMBA","dow":0,"fee":15000,"finalBs":172603,"finalSrc":"toast","d14Rev":26000,"d7Rev":43500,"d4Rev":56000,"d1Rev":74000,"d0Rev":80000,"tablesD4":20,"tablesFinal":23,"multD4":3.082,"eventId":"onbog3plcvcttlzhehpn9myrjyuhhppb","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-06-28","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":1000,"finalBs":84669,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-01","dj":"AXEL BECA","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":12561,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-07-02","dj":"BARUT","djKey":"BARUT","dow":4,"fee":500,"finalBs":28750,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-02","dj":"AMOG","djKey":"AMOG","dow":4,"fee":1000,"finalBs":26510,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-07-03","dj":"ONOMA","djKey":"ONOMA","dow":5,"fee":2000,"finalBs":13130,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-03","dj":"JUANY BRAVO","djKey":"JUANY BRAVO","dow":5,"fee":3500,"finalBs":27477,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-07-04","dj":"PEACE CONTROL","djKey":"PEACE CONTROL","dow":6,"fee":10000,"finalBs":79706,"finalSrc":"toast","d14Rev":3000,"d7Rev":6000,"d4Rev":13500,"d1Rev":31500,"d0Rev":34500,"tablesD4":5,"tablesFinal":15,"multD4":5.904,"eventId":"zas3ftykszy6hfrbske4g3ghu6hguv3o","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-04","dj":"AMOG","djKey":"AMOG","dow":6,"fee":1000,"finalBs":28315,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-04","dj":"LUCAS SAPORITO","djKey":"LUCAS SAPORITO","dow":6,"fee":4000,"finalBs":33832,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-07-05","dj":"TOM&COLLINS","djKey":"TOM AND COLLINS","dow":0,"fee":7000,"finalBs":77799,"finalSrc":"toast","d14Rev":15000,"d7Rev":25000,"d4Rev":28500,"d1Rev":32000,"d0Rev":42000,"tablesD4":12,"tablesFinal":17,"multD4":2.73,"eventId":"a25pz7r6iuzokj1srtdbe36zwmv5uqzu","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-05","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":500,"finalBs":32188,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-08","dj":"LEX","djKey":"LEX","dow":3,"fee":500,"finalBs":105,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-07-09","dj":"BARUT","djKey":"BARUT","dow":4,"fee":500,"finalBs":24970,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-09","dj":"SPARROW","djKey":"SPARROW","dow":4,"fee":6500,"finalBs":39342,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-07-10","dj":"JENIA TERSOL b2b ECHONOMIST","djKey":"JENIA TERSOL ECHONOMIST","dow":5,"fee":12000,"finalBs":53542,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-10","dj":"ENOO NAPA","djKey":"ENOO NAPA","dow":5,"fee":7000,"finalBs":82916,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-07-11","dj":"BARUT","djKey":"BARUT","dow":6,"fee":500,"finalBs":15688,"finalSrc":"toast","d14Rev":3000,"d7Rev":3000,"d4Rev":4500,"d1Rev":13500,"d0Rev":14500,"tablesD4":2,"tablesFinal":7,"multD4":3.486,"eventId":"b3fjqje0cro4hhm0pj9lapz1og7rsdf2","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-11","dj":"ONOMA or BIRDS OF MIND","djKey":"ONOMA OR BIRDS OF MIND","dow":6,"fee":1000,"finalBs":36520,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-11","dj":"SAMANTHA LOVERIDGE","djKey":"SAMANTHA LOVERIDGE","dow":6,"fee":1000,"finalBs":72141,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Beach Club","date":"2026-07-12","dj":"JOEZI","djKey":"JOEZI","dow":0,"fee":12000,"finalBs":187594,"finalSrc":"toast","d14Rev":16500,"d7Rev":34000,"d4Rev":71000,"d1Rev":105000,"d0Rev":121000,"tablesD4":19,"tablesFinal":27,"multD4":2.642,"eventId":"doezxpcprf8qtyudvqb1all2wrv9ic44","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-12","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":500,"finalBs":74650,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-15","dj":"ONOMA","djKey":"ONOMA","dow":3,"fee":500,"finalBs":60,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-07-16","dj":"BEN STERLING","djKey":"BEN STERLING","dow":4,"fee":45000,"finalBs":38086,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"MILA Lounge","date":"2026-07-16","dj":"DARMON","djKey":"DARMON","dow":4,"fee":4000,"finalBs":18382,"finalSrc":"toast","d14Rev":null,"d7Rev":null,"d4Rev":null,"d1Rev":null,"d0Rev":null,"tablesD4":null,"tablesFinal":null,"multD4":null,"eventId":null,"scrapedAt":null},{"venue":"Casa Neos Lounge","date":"2026-07-17","dj":"LUCH","djKey":"LUCH","dow":5,"fee":null,"finalBs":2000,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":2000,"d0Rev":2000,"tablesD4":0,"tablesFinal":1,"multD4":null,"eventId":"yqm8q6fdj0kbvaj4xoi6jgbdzpwcw4kd","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-17","dj":"LAZARE","djKey":"LAZARE","dow":5,"fee":null,"finalBs":3500,"finalSrc":"fv","d14Rev":0,"d7Rev":3500,"d4Rev":3500,"d1Rev":3500,"d0Rev":3500,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"uzmzhox5ym6rtx2h3gcqj6g1gf0dzees","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-07-18","dj":"VITO (UK)","djKey":"VITO UK","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"ryekj8lnrqqz3q9yliar8dqhrg96psvy","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-18","dj":"BARUT","djKey":"BARUT","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"q8vn9181neki0fsz8crgn4pazprnd7wu","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-18","dj":"ANGELOS","djKey":"ANGELOS","dow":6,"fee":null,"finalBs":1000,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":1000,"d1Rev":1000,"d0Rev":1000,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"rzt47kplb1yphaiftgp0dazh5barnz0m","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-07-19","dj":"KAZ JAMES","djKey":"KAZ JAMES","dow":0,"fee":null,"finalBs":47000,"finalSrc":"fv","d14Rev":6000,"d7Rev":14000,"d4Rev":29000,"d1Rev":47000,"d0Rev":47000,"tablesD4":9,"tablesFinal":11,"multD4":1.621,"eventId":"bhv61fopi0au52egpi7pmnoqnsprawkh","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-19","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"k5mc6rwl8l9vnp2sgxbpl6s27tcikpp6","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-22","dj":"BARUT","djKey":"BARUT","dow":3,"fee":null,"finalBs":500,"finalSrc":"fv","d14Rev":0,"d7Rev":500,"d4Rev":500,"d1Rev":500,"d0Rev":500,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"ikp921xpzdduoiomw1b354lqhl1vrtm2","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-23","dj":"BARUT","djKey":"BARUT","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"ulluw6ximbhk33ie4rs2574t31kd9cgk","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-23","dj":"BARON | NO PHONES","djKey":"BARON NO PHONES","dow":4,"fee":null,"finalBs":4500,"finalSrc":"fv","d14Rev":2500,"d7Rev":4500,"d4Rev":4500,"d1Rev":4500,"d0Rev":4500,"tablesD4":2,"tablesFinal":2,"multD4":1,"eventId":"z8y50feudynrk59qzyqrqda3eyyv0dcu","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-24","dj":"Mal?ne Morez","djKey":"MAL NE MOREZ","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"tunxy8lpn8wsw6fgftq897j2mzm33l6c","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-24","dj":"XINOBI","djKey":"XINOBI","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"xwerckecf3edru4maoz8n683t4yyhoa8","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-07-25","dj":"MARIAN","djKey":"MARIAN","dow":6,"fee":null,"finalBs":13500,"finalSrc":"fv","d14Rev":10500,"d7Rev":13500,"d4Rev":13500,"d1Rev":13500,"d0Rev":13500,"tablesD4":7,"tablesFinal":7,"multD4":1,"eventId":"ub75v9l2gqazfcv7xoph1010pyeoeavm","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-25","dj":"AMOG","djKey":"AMOG","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"pptwbni6yqjbkw2c7cxmuzi2gkufgg5c","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-25","dj":"DARMON","djKey":"DARMON","dow":6,"fee":null,"finalBs":1000,"finalSrc":"fv","d14Rev":0,"d7Rev":1000,"d4Rev":1000,"d1Rev":1000,"d0Rev":1000,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"qun10yp3igcsagk69uzmmpuli1ay2akc","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-07-26","dj":"AMOG","djKey":"AMOG","dow":0,"fee":null,"finalBs":3000,"finalSrc":"fv","d14Rev":3000,"d7Rev":3000,"d4Rev":3000,"d1Rev":3000,"d0Rev":3000,"tablesD4":2,"tablesFinal":2,"multD4":1,"eventId":"f8dpai5r3qb9fzumitl4ljt30d3e0s5v","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-26","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"pgz7s7sodib1w0rtwz5ywl5atqn6fqb7","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-29","dj":"AXEL BECA","djKey":"AXEL BECA","dow":3,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"b1074lzitmwpsnl4rq1lbyypjzettr8v","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-30","dj":"BARUT","djKey":"BARUT","dow":4,"fee":null,"finalBs":2000,"finalSrc":"fv","d14Rev":2000,"d7Rev":2000,"d4Rev":2000,"d1Rev":2000,"d0Rev":2000,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"fig04dinf41t48f02ehamyiuye25dqza","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-07-30","dj":"SIS","djKey":"SIS","dow":4,"fee":null,"finalBs":2000,"finalSrc":"fv","d14Rev":2000,"d7Rev":2000,"d4Rev":2000,"d1Rev":2000,"d0Rev":2000,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"vhjryjlysq8pyqdp49gurf6pojvy4g25","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-07-31","dj":"BHASKAR","djKey":"BHASKAR","dow":5,"fee":null,"finalBs":3000,"finalSrc":"fv","d14Rev":3000,"d7Rev":3000,"d4Rev":3000,"d1Rev":3000,"d0Rev":3000,"tablesD4":2,"tablesFinal":2,"multD4":1,"eventId":"e1w95dfendscgq0tvbwv5tk36q7lcz4i","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-01","dj":"","djKey":"","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"yhbtiojfhu9czbuv5opeor9w7i46nme5","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-01","dj":"ONOMA","djKey":"ONOMA","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"peyuj5fhuvuhpnl9b78jxoqf3ecafup1","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-01","dj":"AMOG","djKey":"AMOG","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"wbi0lgeivigrzvnslb5l4ray5wcasx3t","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-02","dj":"","djKey":"","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"o4e1172cgd712iz36x0hkmuwa9z4807o","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-02","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"wq1rbcqygj0zhnlgfvv39yercbs30hwu","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-05","dj":"","djKey":"","dow":3,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"r73lsadl4p9pdbhahtrr4wcb4gmiw905","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-06","dj":"BARUT","djKey":"BARUT","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"h002dluy10wbocztyckq85cohinmr32t","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-06","dj":"SUPER FLU","djKey":"SUPER FLU","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"mnx2mnmjxm6nlsukn1yuy9quz1atcrrl","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-07","dj":"AMOG","djKey":"AMOG","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"z0u8iwt2q99916kd8z8rpgxvb5cr3ngs","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-07","dj":"JESSICA BRANKKA","djKey":"JESSICA BRANKKA","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"k9l8557ttmejhhpvlexbny1oy7xzxipw","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-08","dj":"","djKey":"","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"pjnk52n3wge5xvxsl7v9q3lab34y33tl","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-08","dj":"KIKO FRANCO","djKey":"KIKO FRANCO","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"c6u47nnpnwbc3wqgbxwsakab4cszkimy","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-08","dj":"MARCO LYS","djKey":"MARCO LYS","dow":6,"fee":null,"finalBs":3000,"finalSrc":"fv","d14Rev":3000,"d7Rev":3000,"d4Rev":3000,"d1Rev":3000,"d0Rev":3000,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"w8eyneujx0kuuehn2v2kqtircr70d9wm","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-09","dj":"NOTRE DAME","djKey":"NOTRE DAME","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"bl7x9zi1cpa18tkunkgtmb1l7h01z7w2","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-09","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"ckiajyiaus5vu5suap9c7kzwrl5w4i35","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-12","dj":"","djKey":"","dow":3,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"xklxq45fwbk23hiqhtjokkz1senqj6bc","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-13","dj":"ONOMA","djKey":"ONOMA","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"peakuxamy2osc2gsocntvs1a5mqjlhjg","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-13","dj":"TOM & COLLINS","djKey":"TOM AND COLLINS","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"kb51l7noerfstcu4ce6jz61j6kd8symz","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-14","dj":"BARUT","djKey":"BARUT","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"hn93qsljkh46tzj0nj1jmzucmcvmy1za","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-14","dj":"NICO BERNARDINI","djKey":"NICO BERNARDINI","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"k4xwjzz1mfnfr35h3i0ywelkchmh1ng6","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-15","dj":"ARIEL VROMEN","djKey":"ARIEL VROMEN","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"bmhwefmiz2m58bliv33sv4n9y5o9feyh","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-15","dj":"DARMON","djKey":"DARMON","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"pho8t43ozk2l5l45vxhy4a4s4nhugxf6","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-15","dj":"BARUT","djKey":"BARUT","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"favmuu9st8633r2lxst4anvyce5ymkmd","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-16","dj":"DJEFF","djKey":"DJEFF","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"l0flq3rcy86w2rwf1mm0khnf3ksvd7yi","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-16","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"x02eboomloyz1xce5lel3p3hqa8chkp4","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-19","dj":"","djKey":"","dow":3,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"vikkgdprambq8cjd0ioljv3y9tfb1ouc","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-20","dj":"BARUT","djKey":"BARUT","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"d9g8qmdw1sjancisr5qm05qgcjp20ptn","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-20","dj":"OMRI","djKey":"OMRI","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"j1ewueh6qu7hg8prl6mauuok5ftakmrf","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-21","dj":"","djKey":"","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"ec84vy5ia2nw4ywl2vy9au63f0271gyf","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-21","dj":"AUGUSTO YEPES","djKey":"AUGUSTO YEPES","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"hft6v0vdfvwmido5jyuq49got8jt9wt6","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-22","dj":"BARUT","djKey":"BARUT","dow":6,"fee":null,"finalBs":1500,"finalSrc":"fv","d14Rev":1500,"d7Rev":1500,"d4Rev":1500,"d1Rev":1500,"d0Rev":1500,"tablesD4":1,"tablesFinal":1,"multD4":1,"eventId":"krfjsfzlfji631rk508msxeowmbo922a","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-22","dj":"ROCKIN MOROCCIN","djKey":"ROCKIN MOROCCIN","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"fpdyer3tbn19j0v9vqgop52w6cot0vf5","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-22","dj":"AJNA","djKey":"AJNA","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"x8cneulisd4edcfovgt1xjw4tt4hxnsw","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-23","dj":"MONKEY SAFARI","djKey":"MONKEY SAFARI","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"byx53ieeljqv801m4jljj1uui4zx5gtm","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-23","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"nx8vqwhnqudmxpfxhzevrp7tmwsu6yzh","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-26","dj":"","djKey":"","dow":3,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"mkh46qihlqab2ln4fmrd0inxiq30vspv","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-27","dj":"ONOMA","djKey":"ONOMA","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"dz3z27vkaaozify689u0l7w6y77e684x","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-27","dj":"DIFFER","djKey":"DIFFER","dow":4,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"xkd0l7b28mifvfc9uat0nmxp8gd7p1r7","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-28","dj":"BARUT","djKey":"BARUT","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"ncbt9czjhpc10tone1dtodduya3pahat","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-28","dj":"ONOMA","djKey":"ONOMA","dow":5,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"rxm6w9uyxbielz8m1gpoqgdfa3jogv8g","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Beach Club","date":"2026-08-29","dj":"ONOMA","djKey":"ONOMA","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"rgsldfn0lzy3y063pthc6qcuibxdlu64","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-29","dj":"DA MIKE","djKey":"DA MIKE","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"ksvjrr939emazngg9zsr1c6suurelfig","scrapedAt":"2026-07-17"},{"venue":"MILA Lounge","date":"2026-08-29","dj":"DARMON","djKey":"DARMON","dow":6,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"bxfglvn0ypm7opxj3a3v8rwskt88dzxl","scrapedAt":"2026-07-17"},{"venue":"Casa Neos Lounge","date":"2026-08-30","dj":"AFTERDARK","djKey":"AFTERDARK","dow":0,"fee":null,"finalBs":0,"finalSrc":"fv","d14Rev":0,"d7Rev":0,"d4Rev":0,"d1Rev":0,"d0Rev":0,"tablesD4":0,"tablesFinal":0,"multD4":null,"eventId":"eycjc23e9e36l0xxhwubopp47g9og2ik","scrapedAt":"2026-07-17"}];



var _fcastActiveVenue = 0;
var _fcastActiveView = 'venue'; // 'venue' or 'all'
var FCAST_VENUES = ['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge'];

function _fmtK(n){ return n>=1000?'$'+(n/1000).toFixed(1)+'k':'$'+n; }
function _fmtMoney(n){ return n?'$'+n.toLocaleString():'?'; }
function _daysTo(dateStr){
  var now = new Date(); now.setHours(0,0,0,0);
  var d = new Date(dateStr+'T12:00:00'); d.setHours(0,0,0,0);
  return Math.round((d-now)/86400000);
}

/* For a forecast event, get fee + dj name from SCHED and compute bsTarget via ROI rules */
function _fcastEnrich(e){
  if(e._enriched) return e;
  // Look up matching SCHED entry for fee and DJ name
  var matches = SCHED.filter(function(r){ return r.v===e.venue && r.d===e.date; });
  var match = matches[0];
  var fee = (match && (match.fee||match.cost)) || e.djCost || 0;
  e.djCost = fee;
  // Prefer SCHED DJ name over FourVenues (which can be blank/garbled)
  if(match && match.dj && (!e.dj || /^\?+$/.test(e.dj) || e.dj==='TBD' || e.dj==='TBA')){
    e.dj = match.dj;
  }
  // Compute bsTarget from ROI rules using actual fee
  if(!e.bsTarget){
    var roi = venueRoiLookup(e.venue, e.date, fee);
    if(roi && roi.bsTarget) e.bsTarget = roi.bsTarget;
  }
  // For past shows, prefer Toast bs_a if available
  if(match && match.bs_a != null) e._toastActual = match.bs_a;
  e._enriched = true;
  return e;
}

/* ?? Pacing sparkline ??????????????????????????????????????????????????????
   pacingObj: { "YYYY-MM-DD": {tables, revenue}, ... }
   capacity:  totalTables for the event (cap line)
   Returns an inline SVG string (80?30px).
   ?????????????????????????????????????????????????????????????????????????? */
function _sparkline(pacingObj, capacity){
  if(!pacingObj) return '<span style="color:var(--ink4);font-size:9px">No data yet</span>';
  var days = Object.keys(pacingObj).sort();
  if(!days.length) return '<span style="color:var(--ink4);font-size:9px">No data yet</span>';
  var vals = days.map(function(d){ return (pacingObj[d]&&pacingObj[d].tables)||0; });
  var maxV = capacity || Math.max.apply(null,vals) || 1;
  var W=84, H=30, pad=3;
  var w=W-pad*2, h=H-pad*2;
  var n=vals.length;
  function px(i){ return pad + (n===1?w/2:i/(n-1)*w); }
  function py(v){ return pad+h - Math.min(1,v/maxV)*h; }
  var capY = py(maxV);
  var pts = vals.map(function(v,i){ return px(i)+','+py(v); }).join(' ');
  var col = vals[vals.length-1]>=maxV*0.8?'#22c55e':vals[vals.length-1]>=maxV*0.4?'#f59e0b':'#60a5fa';
  var svg = '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">'
    + '<line x1="'+pad+'" y1="'+capY+'" x2="'+(W-pad)+'" y2="'+capY+'" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2"/>'
    + '<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>';
  vals.forEach(function(v,i){
    svg += '<circle cx="'+px(i)+'" cy="'+py(v)+'" r="2" fill="'+col+'"/>';
  });
  svg += '<text x="'+(W-pad)+'" y="'+(H-1)+'" text-anchor="end" font-size="7" fill="'+col+'">'+vals[vals.length-1]+(capacity?'/'+capacity:'')+'</text>';
  svg += '</svg>';
  return svg;
}

/** DJ name for Forecast UI ? keep ? placeholders as entered. */
function _fcastDjName(dj){
  if(dj==null) return '';
  return String(dj).trim();
}

/** Day-over-day pace: Today ALWAYS = Sales-export FORECAST (fallbackRev).
 *  Firebase pacing is history only (Yesterday) ? never override Today's Actual. */
function _fcastDayDelta(venue, date, fallbackRev, fallbackTables){
  var key = (venue + '_' + date).replace(/[^a-zA-Z0-9_-]/g, '_');
  var hist = window._pacingData ? window._pacingData[key] : null;
  var days = hist ? Object.keys(hist).sort() : [];
  var todayRev = fallbackRev != null ? fallbackRev : 0;
  var todayTbl = fallbackTables != null ? fallbackTables : 0;
  var prevRev = null, prevTbl = null, prevDay = null, latestDay = null;
  // Miami calendar "today" for snapshot selection
  var miamiToday = (function(){
    try{
      var fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
      return fmt.format(new Date());
    }catch(e){ return new Date().toISOString().slice(0,10); }
  })();
  if(days.length){
    latestDay = days[days.length - 1];
    // "Yesterday" must be the prior Miami calendar day. Never present a
    // stale snapshot from several days ago as yesterday's position.
    var yDate=new Date(miamiToday+'T12:00:00');
    yDate.setDate(yDate.getDate()-1);
    var yStr=yDate.getFullYear()+'-'+String(yDate.getMonth()+1).padStart(2,'0')+'-'+String(yDate.getDate()).padStart(2,'0');
    if(hist[yStr]){
      prevDay=yStr;
      var prev=hist[yStr]||{};
      prevRev=prev.revenue!=null?prev.revenue:null;
      prevTbl=prev.tables!=null?prev.tables:null;
    }
  }
  var bodRev=null, bodTbl=null, bodDay=null;
  if(hist && hist[miamiToday]){
    bodDay=miamiToday;
    var bod=hist[bodDay]||{};
    bodRev=bod.revenue!=null?bod.revenue:null;
    bodTbl=bod.tables!=null?bod.tables:null;
  }
  var weekStartRev=null, weekStartTbl=null, weekStartDay=null;
  try{
    var mt=new Date(miamiToday+'T12:00:00');
    var dow=mt.getDay();
    var mon=new Date(mt); mon.setDate(mt.getDate()-(dow===0?6:dow-1));
    var monStr=mon.getFullYear()+'-'+String(mon.getMonth()+1).padStart(2,'0')+'-'+String(mon.getDate()).padStart(2,'0');
    if(hist && hist[monStr]){
      weekStartDay=monStr;
      var ws=hist[weekStartDay]||{};
      weekStartRev=ws.revenue!=null?ws.revenue:null;
      weekStartTbl=ws.tables!=null?ws.tables:null;
    }
  }catch(e){}
  return {
    todayRev: todayRev, todayTbl: todayTbl,
    prevRev: prevRev, prevTbl: prevTbl,
    prevDay: prevDay, latestDay: latestDay,
    bodRev: bodRev, bodTbl: bodTbl, bodDay: bodDay,
    weekStartRev: weekStartRev, weekStartTbl: weekStartTbl, weekStartDay: weekStartDay,
    dRev: prevRev == null ? null : (todayRev - prevRev),
    dTbl: prevTbl == null ? null : (todayTbl - prevTbl),
    dBod: bodRev == null ? null : (todayRev - bodRev),
    dWeek: weekStartRev == null ? null : (todayRev - weekStartRev),
    hasPrev: prevRev != null,
    hasBod: bodRev != null,
    hasWeek: weekStartRev != null
  };
}

/* ---- LIVE: day-of Toast Bottle Service (all venues) ---- */
var _livePrevBs = {};
var _liveAnimTok = 0;
function _liveMiamiParts(){
  var fmt = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false
  });
  var parts={};
  fmt.formatToParts(new Date()).forEach(function(p){ if(p.type!=='literal') parts[p.type]=p.value; });
  var hour = parts.hour==='24' ? 0 : +parts.hour;
  return { dateStr: parts.year+'-'+parts.month+'-'+parts.day, hour:hour, minute:+parts.minute };
}
function _liveBizDate(){
  var p=_liveMiamiParts();
  // After midnight until 5am still belongs to last night's show (Toast BS window)
  if(p.hour < 5){
    var d=new Date(p.dateStr+'T12:00:00'); d.setDate(d.getDate()-1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  return p.dateStr;
}
function _liveWindowActive(){
  var h=_liveMiamiParts().hour;
  return h>=23 || h<5;
}
function _liveFmtMoney(n){
  if(n==null || !isFinite(n)) return '?';
  return '$'+Math.round(n).toLocaleString();
}
function _liveAnimateMoney(el, from, to, deltaEl){
  if(!el) return;
  from = from==null ? 0 : +from;
  to = to==null ? 0 : +to;
  if(to <= from || !isFinite(to)){
    el.textContent = _liveFmtMoney(to);
    return;
  }
  var tok = ++_liveAnimTok;
  var t0 = performance.now();
  var dur = 900;
  function frame(now){
    if(tok !== _liveAnimTok) return;
    var t = Math.min(1, (now - t0) / dur);
    var ease = 1 - Math.pow(1 - t, 3);
    var val = from + (to - from) * ease;
    el.textContent = _liveFmtMoney(val);
    if(t < 1) requestAnimationFrame(frame);
    else {
      el.textContent = _liveFmtMoney(to);
      if(deltaEl && to > from){
        deltaEl.textContent = '+$' + Math.round(to - from).toLocaleString();
        deltaEl.className = 'live-delta';
      }
    }
  }
  requestAnimationFrame(frame);
}
function refreshLive(){
  var btn = document.getElementById('liveRefreshBtn');
  if(btn){ btn.textContent = 'Pulling Toast?'; btn.disabled = true; }
  var prevAt = (window._liveNight && window._liveNight.updatedAt) || '';
  var cfg = window._rdgConfig || {};
  var url = (cfg.liveRefreshUrl || '').trim();
  // Never accept GitHub PATs from Firebase/browser config ? that path leaked tokens publicly.

  function done(ok, msg){
    if(btn){ btn.textContent = 'Refresh'; btn.disabled = false; }
    if(msg){
      var tip = document.getElementById('liveRefreshTip');
      if(!tip){
        tip = document.createElement('div');
        tip.id = 'liveRefreshTip';
        tip.style.cssText = 'font-size:11px;margin:0 0 10px;color:var(--ink3)';
        var body = document.getElementById('liveBody');
        if(body && body.parentNode) body.parentNode.insertBefore(tip, body);
      }
      tip.textContent = msg;
      tip.style.color = ok ? '#0f766e' : '#b91c1c';
    }
    renderLive(true);
  }

  function pollUntilUpdated(tries){
    tries = tries || 0;
    if(tries > 45){
      done(false, 'Toast pull timed out ? check Sanity / GitHub Actions Live Refresh.');
      return;
    }
    var cur = (window._liveNight && window._liveNight.updatedAt) || '';
    var req = window._liveRefreshRequest || {};
    if((cur && cur !== prevAt) || req.status === 'done' || req.status === 'failed'){
      done(req.status !== 'failed', req.message || (cur && cur !== prevAt ? 'Toast LIVE updated.' : 'Refresh finished.'));
      return;
    }
    // Faster poll ? Firebase usually updates as soon as the worker finishes
    setTimeout(function(){ pollUntilUpdated(tries + 1); }, 1200);
  }

  // Mark request in Firebase (Sanity + workers can see it)
  if(window._fbDb){
    window._fbDb.ref('rdg/liveRefreshRequest').set({
      status: 'pending',
      requestedAt: new Date().toISOString(),
      source: 'dashboard_refresh_btn'
    }).catch(function(){});
  }

  var kick = Promise.resolve(null);
  if(url){
    kick = fetch(url.replace(/\/$/, '') + (url.indexOf('/live-refresh') >= 0 ? '' : '/live-refresh'), {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        cfg.liveRefreshKey ? { 'x-live-key': cfg.liveRefreshKey } : {}
      ),
      body: '{}'
    }).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().catch(function(){ return {}; });
    });
  } else {
    done(false, 'Live Refresh not configured. Set a private liveRefreshUrl endpoint (never store GitHub tokens in Firebase).');
    return;
  }

  kick.then(function(result){
    // HTTP endpoint already finished the Toast pull ? no long wait
    if(result && result.payload && result.payload.date){
      window._liveNight = result.payload;
      done(!!result.ok, result.payload && result.message
        ? result.message
        : (result.ok ? 'Toast LIVE updated (all venues).' : 'Toast pull finished with errors.'));
      return;
    }
    if(result && result.ok === false && result.error){
      done(false, 'Toast pull failed: ' + result.error);
      return;
    }
    pollUntilUpdated(0);
  }).catch(function(err){
    done(false, 'Could not start Toast pull: ' + (err && err.message ? err.message : err));
  });
}
function renderLive(animate){
  var el=document.getElementById('liveBody');
  if(!el) return;
  var biz=_liveBizDate();
  var live=window._liveNight;
  // Always show tonight (biz date). Ignore stale Firebase nights like Jul 17.
  var showDate = biz;
  var liveFresh = !!(live && live.date === biz);
  var salesByVenue = liveFresh ? ((live && live.salesByVenue) || {}) : {};
  var statsByVenue = liveFresh ? ((live && live.statsByVenue) || {}) : {};
  var inWin=_liveWindowActive();

  // LIVE is always all venues for the night ? ignore sidebar venue selection (curV)
  var shows = SCHED.filter(function(r){
    if(r.d!==showDate) return false;
    if(r._s==='empty') return false;
    var dj=String(r.dj||'').trim();
    return !!dj && dj.toUpperCase()!=='TBD';
  });
  // Also surface any Toast live rows that aren't in SCHED yet (tonight only)
  if(liveFresh && live && live.rows && live.rows.length){
    live.rows.forEach(function(row){
      if(!row || row.date!==showDate) return;
      var already = shows.some(function(r){
        return (r.v||r.venue)===row.venue && String(r.dj||'')===String(row.dj||'');
      });
      if(already) return;
      var dj=String(row.dj||'').trim();
      if(!dj || dj.toUpperCase()==='TBD') return;
      shows.push({
        v: row.venue, venue: row.venue, d: row.date, dj: row.dj,
        fee: row.fee, cost: row.fee, bs_m: row.bs_m, bs_a: row.bs_a,
        roi_t: row.roi_t, roi_a: row.roi_a, _s: 'fut'
      });
    });
  }
  shows.sort(function(a,b){
    var va=(a.v||a.venue||'').localeCompare(b.v||b.venue||'');
    if(va) return va;
    return (a.dj||'').localeCompare(b.dj||'');
  });

  var h='';
  var nightLabel = (function(){
    var d=new Date(showDate+'T12:00:00');
    return d.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});
  })();
  h += '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">';
  h += '<div><div style="font-size:15px;font-weight:900">'+nightLabel+'</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:2px">All venues ? night of '+showDate+'</div></div>';
  if(inWin) h += '<div style="font-size:11px;font-weight:800;color:#dc2626">UPDATING</div>';
  h += '</div>';
  if(live && live.date && live.date !== biz){
    var staleLbl = (function(){
      var d=new Date(live.date+'T12:00:00');
      return d.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});
    })();
    h += '<div style="font-size:11px;color:#b45309;margin:0 0 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:8px 10px">'
      + 'Last Toast pull was <b>'+staleLbl+'</b>. Press <b>Refresh</b> for tonight\'s LIVE numbers.'
      + '</div>';
  } else if(!liveFresh){
    h += '<div style="font-size:11px;color:var(--ink3);margin:0 0 10px">Press <b>Refresh</b> to pull tonight\'s Toast BS for all venues.</div>';
  }

  if(!shows.length){
    h += '<div style="background:var(--card);border-radius:12px;padding:20px;color:var(--ink3)">No shows tonight across MILA / Casa Neos Beach Club / Lounge.</div>';
    el.innerHTML=h;
    return;
  }

  h += '<div style="background:var(--card);border-radius:12px;overflow:auto">';
  h += '<table class="live-tbl"><thead><tr>'
    + '<th class="left">DJ</th>'
    + '<th>Cost</th>'
    + '<th style="background:#FFF2CC;color:#7D5A00">Target</th>'
    + '<th>BS Actual</th>'
    + '<th>Active Tables</th>'
    + '<th>Need / Table</th>'
    + '<th>% </th>'
    + '</tr></thead><tbody>';

  var nextPrev = {};
  shows.forEach(function(r, idx){
    var venue=r.v||r.venue;
    var fee=r.fee!=null?r.fee:(r.cost!=null?r.cost:0);
    var tgtLookup=venueRoiLookup(venue, r.d, fee);
    var bsTgt=(tgtLookup&&tgtLookup.bsTarget!=null)?tgtLookup.bsTarget:(r.bs_m!=null?r.bs_m:null);
    var liveBs = salesByVenue[venue];
    var activeTbl = null;
    if(liveBs==null && live && live.rows){
      var hit=(live.rows||[]).find(function(x){ return x.venue===venue && x.date===r.d; });
      if(hit){
        if(hit.bs_a!=null) liveBs=hit.bs_a;
        if(hit.activeTables!=null) activeTbl=hit.activeTables;
      }
    }
    if(statsByVenue[venue] && statsByVenue[venue].activeTables!=null) activeTbl = statsByVenue[venue].activeTables;
    var bsA = liveBs!=null ? liveBs : (r.bs_a!=null?r.bs_a:null);
    var key = venue+'|'+r.d;
    var prev = _livePrevBs[key];
    nextPrev[key] = bsA;
    var pct = (bsTgt>0 && bsA!=null) ? Math.round(bsA/bsTgt*100) : null;
    var hitTgt = bsTgt!=null && bsA!=null && bsA >= bsTgt;
    var bsCls = bsA==null || bsA===0 ? 'bs-zero' : (hitTgt ? 'bs-hit' : 'bs-miss');
    var pctCol = pct==null?'var(--ink4)':(pct>=100?'#15803d':pct>=50?'#f59e0b':'#dc2626');
    var gap = (bsTgt!=null && bsA!=null) ? Math.max(0, bsTgt - bsA) : null;
    var needPer = (gap!=null && activeTbl>0) ? Math.round(gap / activeTbl) : (gap!=null && gap>0 ? gap : null);
    var shortVen = venue.replace('Casa Neos ','CN ').replace(' Lounge','');
    h += '<tr data-live-key="'+key.replace(/"/g,'')+'">';
    h += '<td class="left"><div style="font-weight:900;text-transform:uppercase;font-size:14px">'+(r.dj||'')+'</div>'
      + '<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+shortVen+'</div></td>';
    h += '<td>'+(fee?$k(fee):'\u2014')+'</td>';
    h += '<td style="background:#FFF2CC;font-weight:800;color:#7D5A00">'+(bsTgt!=null?$k(bsTgt):'\u2014')+'</td>';
    h += '<td class="bs-act '+bsCls+'"><span class="live-tick" data-live-bs="'+idx+'">'+(bsA!=null?_liveFmtMoney(bsA):'?')+'</span>'
      + '<span data-live-delta="'+idx+'"></span></td>';
    h += '<td style="font-weight:800">'+(activeTbl!=null?activeTbl:'?')+'</td>';
    h += '<td style="font-weight:700;color:'+(needPer!=null && needPer>0?'#dc2626':'#15803d')+'">'
      +(gap===0?'Hit':(needPer!=null?$k(needPer):'\u2014'))+'</td>';
    h += '<td class="vs-tgt" style="color:'+pctCol+'">'+(pct!=null?pct+'%':'\u2014')+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  el.innerHTML=h;

  // Count-up animation when Refresh / new data increases BS
  if(animate){
    shows.forEach(function(r, idx){
      var venue=r.v||r.venue;
      var key=venue+'|'+r.d;
      var to = nextPrev[key];
      var from = _livePrevBs[key];
      if(to==null) return;
      if(from==null || to<=from) return;
      var bsEl = el.querySelector('[data-live-bs="'+idx+'"]');
      var dEl = el.querySelector('[data-live-delta="'+idx+'"]');
      _liveAnimateMoney(bsEl, from, to, dEl);
    });
  }
  _livePrevBs = nextPrev;
}

function _ensurePdfLibs(){
  function loadPdfScript(src,ready){
    if(ready()) return Promise.resolve();
    return new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src=src;
      s.onload=function(){ ready()?resolve():reject(new Error('PDF library unavailable after load')); };
      s.onerror=function(){ reject(new Error('Could not load PDF library')); };
      document.head.appendChild(s);
    });
  }
  return Promise.all([
    loadPdfScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',function(){return !!window.html2canvas;}),
    loadPdfScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF);})
  ]);
}

function _captureDomToCanvas(part, exportWidth){
  exportWidth=Math.max(1200,Math.ceil(part.scrollWidth||0),exportWidth||1200);
  var stage=document.createElement('div');
  stage.className='fcast-pdf-stage';
  stage.style.cssText='position:fixed;left:0;top:0;width:'+exportWidth+'px;max-width:none;background:#fff;padding:0;margin:0;overflow:visible;z-index:2147483646;pointer-events:none;box-sizing:border-box';
  var clone=part.cloneNode(true);
  clone.style.cssText+=';display:flex!important;position:relative!important;left:0!important;top:0!important;transform:none!important;width:'+exportWidth+'px!important;max-width:none!important;margin:0!important;padding:24px!important;overflow:visible!important;box-sizing:border-box!important';
  clone.querySelectorAll('.fcast-chart-wrap,.fcast-tbl-wrap,.tbl-wrap,.vip-perf-block').forEach(function(node){
    node.style.setProperty('overflow','visible','important');
    node.style.setProperty('max-height','none','important');
  });
  stage.appendChild(clone);
  document.body.appendChild(stage);
  var fontsReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
  return fontsReady.then(function(){
    return window.html2canvas(clone,{
      scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff',
      windowWidth:Math.ceil(clone.getBoundingClientRect().width||exportWidth)
    });
  }).then(function(canvas){
    if(stage.parentNode) stage.parentNode.removeChild(stage);
    return canvas;
  },function(err){
    if(stage.parentNode) stage.parentNode.removeChild(stage);
    throw err;
  });
}

function _pdfFromCanvases(canvases, filename, asBlob){
  var pdf=new window.jspdf.jsPDF({unit:'in',format:'letter',orientation:'landscape',compress:true});
  var first=true;
  function addCanvasPaged(canvas){
    var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight(), margin=0.25;
    var usableW=pw-margin*2, usableH=ph-margin*2;
    /* Fit width; split vertically so tall appendix pages are never shrunk/clipped. */
    var scale=usableW/canvas.width;
    var pagePxH=usableH/scale;
    if(canvas.height*scale <= usableH+0.01){
      if(!first) pdf.addPage('letter','landscape');
      first=false;
      var w=canvas.width*scale, h=canvas.height*scale;
      pdf.addImage(canvas.toDataURL('image/jpeg',0.98),'JPEG',margin,margin,w,h,undefined,'FAST');
      return;
    }
    var y=0;
    while(y < canvas.height-0.5){
      if(!first) pdf.addPage('letter','landscape');
      first=false;
      var sliceH=Math.min(pagePxH, canvas.height-y);
      var slice=document.createElement('canvas');
      slice.width=canvas.width;
      slice.height=Math.max(1, Math.ceil(sliceH));
      var ctx=slice.getContext('2d');
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,slice.width,slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      var sw=slice.width*scale, sh=slice.height*scale;
      pdf.addImage(slice.toDataURL('image/jpeg',0.98),'JPEG',margin,margin,sw,sh,undefined,'FAST');
      y+=sliceH;
    }
  }
  canvases.forEach(function(c){ addCanvasPaged(c); });
  if(asBlob){
    return Promise.resolve(pdf.output('blob'));
  }
  pdf.save(filename);
  return Promise.resolve(null);
}

function exportViewPdf(viewId){
  if(viewId && curView !== viewId) setView(viewId);
  var targetId = 'view-'+(viewId||curView||'page');
  var el = document.getElementById(targetId);
  if(!el){ alert('Nothing to export'); return; }
  var filename = 'RDG-'+(viewId||curView||'page')+'-'+new Date().toISOString().slice(0,10)+'.pdf';
  function run(){
    document.body.classList.add('printing-'+(viewId||curView||'page'));
    function cleanup(){ document.body.classList.remove('printing-forecast','printing-vip','printing-page'); }
    var exportType=viewId||curView;
    var exportJob;
    if(exportType==='forecast' || exportType==='vip'){
      var pages;
      if(exportType==='vip'){
        pages=[].slice.call(el.querySelectorAll('.vip-print-page'));
      } else {
        pages=[el.querySelector('.fcast-print-page1'), el.querySelector('.fcast-print-page2')].filter(Boolean);
      }
      if(pages.length<2){
        cleanup();
        alert('PDF sections unavailable');
        return;
      }
      var width=Math.max(1200,Math.ceil(el.getBoundingClientRect().width||0));
      var canvases=[];
      var chain=Promise.resolve();
      pages.forEach(function(page){
        chain=chain.then(function(){
          return _captureDomToCanvas(page,width).then(function(c){ canvases.push(c); });
        });
      });
      exportJob=chain.then(function(){
        return _pdfFromCanvases(canvases, filename, false);
      });
    } else {
      if(!window.html2pdf){
        cleanup();
        alert('PDF library unavailable');
        return;
      }
      exportJob=window.html2pdf().set({
        margin:[0.35,0.35,0.35,0.35], filename:filename,
        image:{type:'jpeg',quality:0.96},
        html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:Math.max(1200,el.scrollWidth)},
        jsPDF:{unit:'in',format:'letter',orientation:'landscape'},
        pagebreak:{mode:['css','legacy']}
      }).from(el).save();
    }
    Promise.resolve(exportJob).then(function(){ cleanup(); }).catch(function(err){
      console.warn('PDF export failed', err);
      cleanup();
      alert('PDF download failed. Please try again.');
    });
  }
  _ensurePdfLibs().then(function(){
    if((viewId||curView)==='forecast'||(viewId||curView)==='vip') run();
    else if(window.html2pdf) run();
    else {
      var s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload=function(){ run(); };
      s.onerror=function(){ alert('Could not load PDF library. Check your network connection.'); };
      document.head.appendChild(s);
    }
  }).catch(function(){
    alert('Could not load PDF libraries. Check your network connection.');
  });
}

var _FCAST_EMAIL_TO = [
  'michael@rivieradininggroup.com',
  'fabien@rivieradininggroup.com',
  'greg@rivieradininggroup.com',
  'marine@rivieradininggroup.com',
  'sheena@rivieradininggroup.com'
];
var _FCAST_EMAIL_CC = [
  'Salesteam@rivieradininggroup.com',
  'matthias@rivieradininggroup.com',
  'takuma@rivieradininggroup.com',
  'VIP@rivieradininggroup.com',
  'yulyana@rivieradininggroup.com',
  'g.moorefield@rivieradininggroup.com'
];

function _fcastVenueShortFile(v){
  if(/Beach Club/i.test(v)) return 'Casa-Neos-BC';
  if(/Casa Neos Lounge/i.test(v)) return 'Casa-Neos-Lounge';
  if(/MILA/i.test(v)) return 'MILA-Lounge';
  return String(v||'Venue').replace(/\s+/g,'-');
}

function _blobToBase64(blob){
  return new Promise(function(resolve,reject){
    var fr=new FileReader();
    fr.onload=function(){
      var s=String(fr.result||'');
      var i=s.indexOf(',');
      resolve(i>=0?s.slice(i+1):s);
    };
    fr.onerror=reject;
    fr.readAsDataURL(blob);
  });
}

function _downloadBlob(blob, filename){
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); if(a.parentNode) a.parentNode.removeChild(a); }, 4000);
  return url;
}
function _openBlobInApp(blob, filename){
  var url=URL.createObjectURL(blob);
  /* Always download .eml (reliable after async PDF work). Also try to open. */
  var a=document.createElement('a');
  a.href=url; a.download=filename||'message.eml';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ if(a.parentNode) a.parentNode.removeChild(a); }, 1000);
  try{ window.open(url, '_blank'); }catch(eOpen){}
  setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(eRev){} }, 60000);
  return url;
}

function _buildForecastFlashEml(opts){
  /* opts: {to,cc,subject,htmlBody,attachments:[{filename,contentType,base64}], inlines:[{cid,contentType,base64}]} */
  var boundary='RDG_MIXED_'+Date.now().toString(36);
  var related='RDG_REL_'+Date.now().toString(36);
  var lines=[];
  function push(s){ lines.push(s); }
  push('To: '+opts.to.join(', '));
  if(opts.cc && opts.cc.length) push('Cc: '+opts.cc.join(', '));
  push('Subject: '+opts.subject);
  push('X-Unsent: 1');
  push('MIME-Version: 1.0');
  push('Content-Type: multipart/mixed; boundary="'+boundary+'"');
  push('');
  push('--'+boundary);
  push('Content-Type: multipart/related; boundary="'+related+'"');
  push('');
  push('--'+related);
  push('Content-Type: text/html; charset="UTF-8"');
  push('Content-Transfer-Encoding: 7bit');
  push('');
  push(opts.htmlBody);
  push('');
  (opts.inlines||[]).forEach(function(img){
    push('--'+related);
    push('Content-Type: '+(img.contentType||'image/jpeg'));
    push('Content-Transfer-Encoding: base64');
    push('Content-ID: <'+img.cid+'>');
    push('Content-Disposition: inline; filename="'+img.filename+'"');
    push('');
    var b64=img.base64||'';
    for(var i=0;i<b64.length;i+=76) push(b64.slice(i,i+76));
    push('');
  });
  push('--'+related+'--');
  push('');
  (opts.attachments||[]).forEach(function(att){
    push('--'+boundary);
    push('Content-Type: '+(att.contentType||'application/pdf')+'; name="'+att.filename+'"');
    push('Content-Transfer-Encoding: base64');
    push('Content-Disposition: attachment; filename="'+att.filename+'"');
    push('');
    var b64=att.base64||'';
    for(var j=0;j<b64.length;j+=76) push(b64.slice(j,j+76));
    push('');
  });
  push('--'+boundary+'--');
  push('');
  return new Blob([lines.join('\r\n')],{type:'message/rfc822'});
}

function prepareForecastFlashEmail(){
  var btn=document.getElementById('fcastEmailBtn');
  var venues=['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge'];
  var prevView=curView, prevV=curV;
  var weekKey=getISOWeek(new Date());
  var weekNum=(String(weekKey).match(/W(\d+)/)||[])[1]||'';
  var todayLabel=(function(){
    var d=new Date();
    return (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
  })();
  var subject='DJ Booking Performance Flash : Week '+weekNum;
  if(btn){ btn.disabled=true; btn.textContent='Preparing email…'; }

  function restore(){
    curV=prevV;
    if(typeof buildVenTabs==='function') buildVenTabs();
    if(typeof buildSidebar==='function') buildSidebar();
    if(typeof updateTopbarLogo==='function') updateTopbarLogo(curV);
    if(prevView!=='forecast') setView(prevView);
    else { curView='forecast'; renderForecast(); }
    if(btn){ btn.disabled=false; btn.textContent='Send all emails'; }
  }

  _ensurePdfLibs().then(function(){
    if(curView!=='forecast') setView('forecast');
    var results=[];
    var chain=Promise.resolve();
    venues.forEach(function(venue, vi){
      chain=chain.then(function(){
        curV=venue;
        if(typeof buildVenTabs==='function') buildVenTabs();
        if(typeof updateTopbarLogo==='function') updateTopbarLogo(curV);
        renderForecast();
        document.body.classList.add('printing-forecast');
        var el=document.getElementById('view-forecast');
        var p1=el&&el.querySelector('.fcast-print-page1');
        var p2=el&&el.querySelector('.fcast-print-page2');
        if(!p1||!p2) throw new Error('Forecast sections missing for '+venue);
        var width=Math.max(1200,Math.ceil(el.getBoundingClientRect().width||0));
        return _captureDomToCanvas(p1,width).then(function(c1){
          return _captureDomToCanvas(p2,width).then(function(c2){
            document.body.classList.remove('printing-forecast');
            var snapJpeg=c1.toDataURL('image/jpeg',0.92);
            var short=_fcastVenueShortFile(venue);
            var pdfName='RDG-Booking-Performance-'+short+'-W'+weekNum+'.pdf';
            return _pdfFromCanvases([c1,c2], pdfName, true).then(function(pdfBlob){
              return _blobToBase64(pdfBlob).then(function(pdfB64){
                results.push({
                  venue:venue, short:short, pdfName:pdfName, pdfBlob:pdfBlob, pdfB64:pdfB64,
                  snapJpeg:snapJpeg, snapB64:snapJpeg.split(',')[1]||'', cid:'snap'+vi+'@rdg'
                });
              });
            });
          });
        });
      });
    });
    return chain.then(function(){
      document.body.classList.remove('printing-forecast');

      var html='<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1c1c1e;line-height:1.5">';
      html+='<p>Hi team,</p>';
      html+='<p>Please find below our booking performance as of <b>'+todayLabel+'</b>.</p>';
      results.forEach(function(r){
        html+='<div style="margin:18px 0 8px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#48484a">'+r.venue+'</div>';
        html+='<img src="cid:'+r.cid+'" alt="'+r.venue+' booking performance" style="max-width:100%;border:1px solid #e5e5ea;border-radius:8px;display:block"/>';
      });
      html+='<p style="margin-top:18px;font-size:12px;color:#8e8e93">PDFs attached for each location (page 1 = Actual vs Target + Details; page 2 = Pick up pace).</p>';
      html+='</div>';

      var eml=_buildForecastFlashEml({
        to:_FCAST_EMAIL_TO,
        cc:_FCAST_EMAIL_CC,
        subject:subject,
        htmlBody:html,
        inlines:results.map(function(r){
          return {cid:r.cid, filename:r.short+'-snap.jpg', contentType:'image/jpeg', base64:r.snapB64};
        }),
        attachments:results.map(function(r){
          return {filename:r.pdfName, contentType:'application/pdf', base64:r.pdfB64};
        })
      });
      var emlName='DJ-Booking-Performance-Flash-W'+weekNum+'.eml';
      /* EML only — open Outlook draft (snapshots + PDFs). No bare mailto. */
      _openBlobInApp(eml, emlName);
      restore();
    });
  }).catch(function(err){
    console.warn('Forecast email prepare failed', err);
    document.body.classList.remove('printing-forecast');
    restore();
    alert('Could not prepare the email. Check your network and try again.');
  });
}

var _VIP_EMAIL_TO = [
  'Salesteam@rivieradininggroup.com',
  'takuma@rivieradininggroup.com',
  'michael@rivieradininggroup.com',
  'fabien@rivieradininggroup.com',
  'greg@rivieradininggroup.com',
  'marine@rivieradininggroup.com'
];

function prepareVipFlashEmail(){
  var btn=document.getElementById('vipEmailBtn');
  var prevView=curView;
  var weekOffset=_vipWeekOffset;
  var pack=_vipCollectFlashVenues(weekOffset);
  var venues=pack.venues;
  var weekKey=pack.rangeWkKey;
  var weekNum=(String(weekKey).match(/W(\d+)/)||[])[1]||'';
  var thisRoi=_vipRoiWeekStats(venues);
  var priorPack=_vipCollectFlashVenues(weekOffset+1);
  var priorRoi=_vipRoiWeekStats(priorPack.venues);
  var subject='DJ ROI Performance Analysis : Week '+weekNum;
  if(btn){ btn.disabled=true; btn.textContent='Preparing email…'; }

  function restore(){
    if(prevView!=='vip') setView(prevView);
    else { curView='vip'; renderVIP(); }
    if(btn){ btn.disabled=false; btn.textContent='Send all emails'; }
  }

  _ensurePdfLibs().then(function(){
    if(curView!=='vip') setView('vip');
    renderVIP();
    document.body.classList.add('printing-vip');
    var el=document.getElementById('view-vip');
    if(!el) throw new Error('Weekly Flash view missing');
    var pages=[].slice.call(el.querySelectorAll('.vip-print-page'));
    var snaps=[].slice.call(el.querySelectorAll('.vip-email-snap'));
    if(pages.length<2) throw new Error('Weekly Flash sections missing');
    var width=Math.max(1200,Math.ceil(el.getBoundingClientRect().width||0));
    var canvases=[];
    var chain=Promise.resolve();
    pages.forEach(function(page){
      chain=chain.then(function(){
        return _captureDomToCanvas(page,width).then(function(c){ canvases.push(c); });
      });
    });
    return chain.then(function(){
      var snapChain=Promise.resolve();
      var snapResults=[];
      snaps.forEach(function(snap, si){
        snapChain=snapChain.then(function(){
          return _captureDomToCanvas(snap, width).then(function(c){
            var jpeg=c.toDataURL('image/jpeg',0.92);
            var venue=(venues[si]&&venues[si].venue)||('Venue '+(si+1));
            snapResults.push({
              venue:venue,
              short:_fcastVenueShortFile(venue),
              snapB64:jpeg.split(',')[1]||'',
              cid:'vip'+si+'@rdg',
              para:_generateVenueFlashParagraph(venues[si]||{})
            });
          });
        });
      });
      return snapChain.then(function(){
        var pdfName='RDG-DJ-ROI-Performance-W'+weekNum+'.pdf';
        return _pdfFromCanvases(canvases, pdfName, true).then(function(pdfBlob){
          return _blobToBase64(pdfBlob).then(function(pdfB64){
            document.body.classList.remove('printing-vip');
            var html='<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1c1c1e;line-height:1.55">';
            html+='<p>Hello all,</p>';
            html+='<p>Please find the recap of our DJ ROI for last week at Casa Neos BC / Lounge &amp; Mila Lounge.</p>';
            html+='<p><b>ROI :</b> '+thisRoi.beats+'/'+thisRoi.total
              +' vs. '+priorRoi.beats+'/'+priorRoi.total+' last week</p>';
            snapResults.forEach(function(r){
              html+='<div style="margin:20px 0 8px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#48484a">'+r.venue+'</div>';
              html+='<img src="cid:'+r.cid+'" alt="'+r.venue+' performance summary" style="max-width:100%;border:1px solid #e5e5ea;border-radius:8px;display:block"/>';
            });
            html+='<p style="margin-top:18px;font-size:12px;color:#8e8e93">Full Weekly Flash PDF attached (Budget, Performance, Tier Breakdown, Appendix).</p>';
            html+='</div>';
            var eml=_buildForecastFlashEml({
              to:_VIP_EMAIL_TO,
              cc:[],
              subject:subject,
              htmlBody:html,
              inlines:snapResults.map(function(r){
                return {cid:r.cid, filename:r.short+'-roi.jpg', contentType:'image/jpeg', base64:r.snapB64};
              }),
              attachments:[{filename:pdfName, contentType:'application/pdf', base64:pdfB64}]
            });
            _openBlobInApp(eml, 'DJ-ROI-Performance-Analysis-W'+weekNum+'.eml');
            restore();
          });
        });
      });
    });
  }).catch(function(err){
    console.warn('VIP flash email prepare failed', err);
    document.body.classList.remove('printing-vip');
    restore();
    alert('Could not prepare the Weekly Flash email. Check your network and try again.');
  });
}

function renderSystem(){
  var el = document.getElementById('systemBody');
  if(!el) return;
  var st = window._scrapeStatus || {};
  var fv = st.fourvenues || null;
  var toast = st.toast || null;
  var toastLive = st.toastLive || null;
  var fbOk = !!window._fbReady;
  var cfg = window._rdgConfig || {};
  var liveCfgOk = !!cfg.liveRefreshUrl;
  var forecastLive = window._forecastLive || null;
  var liveNight = window._liveNight || null;
  var liveReq = window._liveRefreshRequest || null;

  function ageHours(iso){
    if(!iso) return null;
    var t = Date.parse(iso);
    if(!t) return null;
    return (Date.now() - t) / 3600000;
  }
  function health(data, maxHours){
    if(!data) return { badge:'#94a3b8', label:'No run yet', stale:true };
    if(data.ok === false) return { badge:'#ef4444', label:'FAILED', stale:true };
    var h = ageHours(data.at || data.updatedAt);
    if(h != null && maxHours != null && h > maxHours) return { badge:'#f59e0b', label:'STALE', stale:true };
    return { badge:'#22c55e', label:'OK', stale:false };
  }
  function card(title, defaultSchedule, data, maxHours, extra){
    var sched = (data && (data.schedule || data.Schedule)) || defaultSchedule;
    var what = (data && data.what) || '';
    var hx = health(data, maxHours);
    var when = data && (data.atLocal || data.at) ? (data.atLocal || data.at) : '\u2014';
    var msg  = data && (data.message || data.msg) ? (data.message || data.msg) : '';
    return '<div style="background:var(--card);border-radius:12px;padding:14px 16px;border-left:4px solid '+hx.badge+'">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<div style="font-size:13px;font-weight:800">'+title+'</div>'
      + '<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:'+hx.badge+';color:#fff">'+hx.label+'</span>'
      + '</div>'
      + (what ? '<div style="margin-top:8px;font-size:11px;color:var(--ink2)"><b>Pulls:</b> '+what+'</div>' : '')
      + '<div style="margin-top:6px;font-size:11px;color:var(--ink3)">When: <b style="color:var(--ink2)">'+sched+'</b></div>'
      + '<div style="margin-top:4px;font-size:11px;color:var(--ink3)">Last run: <b style="color:var(--ink2)">'+when+'</b></div>'
      + (msg ? '<div style="margin-top:6px;font-size:11px;color:var(--ink2)">'+msg+'</div>' : '')
      + (extra || '')
      + '</div>';
  }

  var overallBad = (!fbOk) || (fv && fv.ok === false) || (toast && toast.ok === false) || !liveCfgOk;
  var overallWarn = !overallBad && (
    health(fv, 36).stale || health(toast, 84).stale || health(toastLive, 36).stale
  );

  var h = '';
  h += '<div style="background:var(--card);border-radius:12px;padding:14px 16px;border-left:4px solid '+(overallBad?'#ef4444':(overallWarn?'#f59e0b':'#22c55e'))+'">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<div style="font-size:14px;font-weight:900">Overall</div>'
    + '<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:'+(overallBad?'#ef4444':(overallWarn?'#f59e0b':'#22c55e'))+';color:#fff">'
    + (overallBad ? 'NEEDS ATTENTION' : (overallWarn ? 'CHECK STALE DATA' : 'HEALTHY'))
    + '</span></div>'
    + '<div style="margin-top:8px;font-size:11px;color:var(--ink3);line-height:1.55">'
    + 'GitHub Pages hosts the site. Toast + FourVenues refresh via punctual workflow_dispatch ~8:25 AM ET, with automatic retries at <b>9:00</b> and <b>9:30</b> ET if needed (cron-job.org / Windows task). '
    + 'If still failing after 9:30, Sanity stays <b style="color:#ef4444">RED</b>. '
    + 'GitHub schedule crons are late backup only (often hours delayed). '
    + 'LIVE only updates when someone presses Refresh (Toast API to Firebase).'
    + '</div></div>';

  h += '<div style="background:var(--card);border-radius:12px;padding:14px 16px;border-left:4px solid '+(fbOk?'#22c55e':'#f59e0b')+'">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<div style="font-size:13px;font-weight:800">Firebase connection</div>'
    + '<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:'+(fbOk?'#22c55e':'#f59e0b')+';color:#fff">'+(fbOk?'Connected':'Connecting...')+'</span>'
    + '</div>'
    + '<div style="margin-top:6px;font-size:11px;color:var(--ink3)">People edits + live overlays (Forecast / LIVE) sync here for every viewer.</div>'
    + '</div>';

  var people=_activePresenceRows();
  var peopleRows=people.map(function(p){
    var isMe=p._id===_presenceSessionId;
    var seen=p.lastSeen?new Date(+p.lastSeen).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'now';
    var device=p.device||'Unknown device';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:0.5px solid var(--hair)">'
      +'<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:7px"></span>'
      +'<b>'+_escHtml(p.name||'Unnamed')+'</b>'+(isMe?' <span style="font-size:9px;color:var(--ink3)">(you)</span>':'')
      +'<div style="font-size:9px;color:var(--ink3);margin:2px 0 0 15px">'+_escHtml(device)+' ? Viewing '+_escHtml(p.view||'dashboard')+'</div></div>'
      +'<span style="font-size:9px;color:var(--ink4)">active '+seen+'</span></div>';
  }).join('');
  h += '<div style="background:var(--card);border-radius:12px;padding:14px 16px;border-left:4px solid #22c55e">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
    +'<div style="font-size:13px;font-weight:800">Connected people</div>'
    +'<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:#22c55e;color:#fff">'+people.length+' ONLINE</span></div>'
    +'<div style="font-size:10px;color:var(--ink3);margin-top:5px">Each computer must enter a name on open. Click the online chip in the top bar to change it.</div>'
    +(peopleRows||'<div style="font-size:11px;color:var(--ink3);padding-top:9px">No active sessions detected.</div>')
    +'</div>';

  var fvExtra = forecastLive && forecastLive.updatedAt
    ? '<div style="margin-top:6px;font-size:11px;color:var(--ink3)">forecastLive: <b style="color:var(--ink2)">'+forecastLive.updatedAt+'</b>'
      + (forecastLive.source ? ' ? '+forecastLive.source : '') + '</div>'
    : '';
  h += card('FourVenues (Forecast BS Actual)', 'Dispatch ~8:25 ET · retries 9:00 & 9:30 if needed · Integrations API · laptop off', fv, 36, fvExtra);

  h += card('Toast BS Actual (calendar / history)', 'Dispatch ~8:25 ET · retries 9:00 & 9:30 if needed · Firebase toastActuals', toast, 84,
    (window._toastActuals && window._toastActuals.updatedAt
      ? '<div style="margin-top:6px;font-size:11px;color:var(--ink3)">toastActuals: <b style="color:var(--ink2)">'+window._toastActuals.updatedAt+'</b></div>'
      : ''));

  var liveExtra = '';
  if(liveNight && liveNight.updatedAt){
    liveExtra += '<div style="margin-top:6px;font-size:11px;color:var(--ink3)">liveNight: <b style="color:var(--ink2)">'+(liveNight.updatedAtLocal||liveNight.updatedAt)+'</b> ? night '+(liveNight.date||'')+'</div>';
  }
  if(liveReq && liveReq.status){
    liveExtra += '<div style="margin-top:4px;font-size:11px;color:var(--ink3)">Last Refresh request: <b style="color:var(--ink2)">'+liveReq.status+'</b>'
      + (liveReq.requestedAt || liveReq.finishedAt ? ' ? '+(liveReq.finishedAt||liveReq.requestedAt) : '') + '</div>';
  }
  liveExtra += '<div style="margin-top:6px;font-size:11px;color:'+(liveCfgOk?'#0f766e':'#b91c1c')+'">'
    + (liveCfgOk
      ? 'Refresh button wired (private HTTP endpoint).'
      : 'Refresh not wired ? set rdg/config/liveRefreshUrl to a private server endpoint (never store GitHub tokens in Firebase).')
    + '</div>';
  h += card('Toast LIVE (on-demand only)', 'Only when someone presses Refresh ? no night schedule', toastLive, 36, liveExtra);

  h += '<div style="background:var(--card);border-radius:12px;padding:14px 16px">'
    + '<div style="font-size:13px;font-weight:800;margin-bottom:6px">How the pieces fit</div>'
    + '<div style="font-size:11px;color:var(--ink3);line-height:1.6">'
    + '<b style="color:var(--ink2)">GitHub Pages (rdg-dj):</b> the published website everyone opens.<br>'
    + '<b style="color:var(--ink2)">GitHub Actions (boh-dashboard):</b> cloud robot ~8:25 ET, retries 9:00 &amp; 9:30 if needed (schedule = late backup) &middot; laptop can be off.<br>'
    + '<b style="color:var(--ink2)">FourVenues:</b> Integrations API bookings (accepted + not-completed price) ? Forecast Actuals.<br>'
    + '<b style="color:var(--ink2)">Firebase:</b> instant overlays (Forecast Actuals, LIVE night, Sanity status).'
    + '</div></div>';

  el.innerHTML = h;
}


/* ---- Forecast weather (Open-Meteo, Miami) ---- */
var _WX_LAT = 25.7617, _WX_LON = -80.1918; /* Miami */
var _wxCache = null;
var _wxCacheAt = 0;
var _wxLoading = false;

function _wxCodeInfo(code){
  var c = code|0;
  if(c===0) return {ico:'\u2600\uFE0F', lbl:'Clear'};
  if(c<=3) return {ico:'\u26C5', lbl:c===1?'Mostly clear':'Partly cloudy'};
  if(c===45||c===48) return {ico:'\uD83C\uDF2B\uFE0F', lbl:'Fog'};
  if(c>=51&&c<=57) return {ico:'\uD83C\uDF27\uFE0F', lbl:'Drizzle'};
  if(c>=61&&c<=67) return {ico:'\uD83C\uDF27\uFE0F', lbl:'Rain'};
  if(c>=71&&c<=77) return {ico:'\uD83C\uDF28\uFE0F', lbl:'Snow'};
  if(c>=80&&c<=82) return {ico:'\uD83C\uDF26\uFE0F', lbl:'Showers'};
  if(c>=95) return {ico:'\u26C8\uFE0F', lbl:'Storms'};
  return {ico:'\u2601\uFE0F', lbl:'Cloudy'};
}
function _wxF(c){ return Math.round((c*9/5)+32); }
function _wxShowMap(events){
  var m={};
  (events||[]).forEach(function(e){
    if(!e||!e.date) return;
    if(_daysTo(e.date)<-1) return;
    var nm=_fcastDjName(e.dj)||'Show';
    if(!m[e.date]) m[e.date]=[];
    m[e.date].push(nm);
  });
  return m;
}
function _wxRenderHtml(data, events){
  if(!data||!data.daily||!data.daily.time){
    return '<div class="fcast-wx"><div class="fcast-wx-err">Weather unavailable right now.</div></div>';
  }
  var d=data.daily;
  var shows=_wxShowMap(events);
  var h='<div class="fcast-wx">';
  h+='<div class="fcast-wx-hd"><div class="fcast-wx-title">Weather &mdash; Miami</div>';
  h+='<div class="fcast-wx-sub">Next 7 days &middot; Open-Meteo &middot; evenings matter for outdoor / patio nights</div></div>';
  h+='<div class="fcast-wx-row">';
  for(var i=0;i<d.time.length && i<7;i++){
    var ds=d.time[i];
    var info=_wxCodeInfo(d.weather_code?d.weather_code[i]:d.weathercode?d.weathercode[i]:3);
    var hi=_wxF(d.temperature_2m_max[i]);
    var lo=_wxF(d.temperature_2m_min[i]);
    var rain=d.precipitation_probability_max?d.precipitation_probability_max[i]:null;
    var dateObj=new Date(ds+'T12:00:00');
    var dow=dateObj.toLocaleDateString('en-US',{weekday:'short'});
    var md=dateObj.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    var showList=shows[ds]||[];
    var cls='fcast-wx-day'+(showList.length?' has-show':'');
    h+='<div class="'+cls+'">';
    h+='<div class="fcast-wx-dow">'+dow+'</div>';
    h+='<div class="fcast-wx-date">'+md+'</div>';
    h+='<div class="fcast-wx-ico">'+info.ico+'</div>';
    h+='<div class="fcast-wx-cond">'+info.lbl+'</div>';
    h+='<div class="fcast-wx-temp">'+hi+'\u00b0 <span>/ '+lo+'\u00b0</span></div>';
    if(rain!=null) h+='<div class="fcast-wx-rain">'+rain+'% rain</div>';
    if(showList.length) h+='<div class="fcast-wx-show" title="'+showList.join(', ')+'">'+showList[0]+(showList.length>1?' +'+(showList.length-1):'')+'</div>';
    h+='</div>';
  }
  h+='</div></div>';
  return h;
}
function _wxFetch(cb){
  var now=Date.now();
  if(_wxCache && (now-_wxCacheAt)<55*60*1000){ cb(null,_wxCache); return; }
  if(_wxLoading){ cb(null,_wxCache); return; }
  _wxLoading=true;
  var url='https://api.open-meteo.com/v1/forecast'
    +'?latitude='+_WX_LAT+'&longitude='+_WX_LON
    +'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    +'&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=7';
  fetch(url).then(function(r){ return r.json(); }).then(function(j){
    _wxLoading=false;
    _wxCache=j; _wxCacheAt=Date.now();
    try{ sessionStorage.setItem('rdg_wx', JSON.stringify({at:_wxCacheAt,data:j})); }catch(e){}
    cb(null,j);
  }).catch(function(err){
    _wxLoading=false;
    cb(err,null);
  });
}
function _wxEnsureMounted(events){
  var host=document.getElementById('fcastWxHost');
  if(!host) return;
  try{
    if(!_wxCache){
      var raw=sessionStorage.getItem('rdg_wx');
      if(raw){ var o=JSON.parse(raw); if(o&&o.data&&(Date.now()-o.at)<55*60*1000){ _wxCache=o.data; _wxCacheAt=o.at; } }
    }
  }catch(e){}
  if(_wxCache){ host.innerHTML=_wxRenderHtml(_wxCache, events); }
  else { host.innerHTML='<div class="fcast-wx"><div class="fcast-wx-err">Loading Miami weather\u2026</div></div>'; }
  _wxFetch(function(err,data){
    if(!document.getElementById('fcastWxHost')) return;
    if(err||!data){
      if(!_wxCache) document.getElementById('fcastWxHost').innerHTML='<div class="fcast-wx"><div class="fcast-wx-err">Could not load weather. Check connection and retry.</div></div>';
      return;
    }
    document.getElementById('fcastWxHost').innerHTML=_wxRenderHtml(data, events);
  });
}


var _fcastRangeMode = 'all'; /* '3d' | 'all' */
function setFcastRange(mode){ _fcastRangeMode = mode; renderForecast(); }
function _fcastActColor(act, tgt){
  if(!act) return 'fcast-bar-act-zero';
  if(!tgt) return 'fcast-bar-act-hi';
  return act >= tgt ? 'fcast-bar-act-hi' : 'fcast-bar-act-lo';
}
function _fcastBarChartHtml(rows, venueTitle){
  var maxV = 1;
  rows.forEach(function(r){ maxV = Math.max(maxV, r.act||0, r.tgt||0); });
  var h = '<div class="fcast-perf-title">'+(venueTitle||'BOOKING PERFORMANCE')+' : ACTUAL VS. TARGET</div>';
  h += '<div class="fcast-bars">';
  rows.forEach(function(r){
    var act = r.act||0, tgt = r.tgt||0;
    var pct = tgt>0 ? Math.round(act/tgt*100) : (act>0?100:0);
    var actCls = !act ? 'fcast-bar-act-zero' : (tgt && act>=tgt ? 'fcast-bar-act-hi' : 'fcast-bar-act');
    var tw = Math.max(tgt?3:0, Math.round((tgt/maxV)*100));
    var aw = Math.max(act?3:0, Math.round((act/maxV)*100));
    h += '<div class="fcast-hbar-row" title="'+(r.tip||'')+'">';
    h += '<div class="fcast-hbar-meta"><div class="fcast-hbar-name">'+(r.label||'')+'</div><div class="fcast-hbar-sub">'+(r.dateLabel||r.sub||'')+'</div><div class="fcast-hbar-pct-inline">'+pct+'% complete</div></div>';
    h += '<div class="fcast-hbar-tracks">';
    h += '<div class="fcast-hbar-track"><div class="fcast-hbar-rail"><div class="fcast-hbar-fill '+actCls+'" style="width:'+aw+'%"></div></div><div class="fcast-hbar-amt">$'+(act?act.toLocaleString():'0')+'</div></div>';
    h += '<div class="fcast-hbar-track"><div class="fcast-hbar-rail"><div class="fcast-hbar-fill fcast-bar-tgt" style="width:'+tw+'%"></div></div><div class="fcast-hbar-amt">$'+(tgt?tgt.toLocaleString():'0')+'</div></div>';
    h += '</div></div>';
  });
  h += '</div>';
  h += '<div class="fcast-legend"><span><i style="background:#C62828"></i>Actual</span><span><i style="background:#E8A317"></i>Target</span></div>';
  return h;
}
/* Details table for PDF page 2 / Forecast layout (Artist, fee, ROI, Actual, Target, tables left, upside, %) */
function _fcastDetailsTableHtml(events, venueShort){
  var rows = (events||[]).slice();
  var title = (venueShort||'VENUE')+' BOOKING PERFORMANCE : DETAILS';
  var h = '<div class="fcast-chart-wrap fcast-print-details" style="padding:0;overflow:hidden">';
  h += '<div class="fcast-perf-title">'+title+'</div>';
  h += '<div class="fcast-tbl-wrap" style="padding:0 0 10px"><table class="fcast-tbl fcast-details-tbl">';
  h += '<thead><tr>'
    + '<th class="left">Artist</th>'
    + '<th>DJ Cost</th>'
    + '<th>Date</th>'
    + '<th>ROI</th>'
    + '<th style="background:#dcfce7;color:#166534">Actual</th>'
    + '<th style="background:#FFF2CC;color:#7D5A00">Target</th>'
    + '<th># Table Left</th>'
    + '<th>Potential $ Upside</th>'
    + '<th>$ Ticket Sold</th>'
    + '<th>% Completion</th>'
    + '</tr></thead><tbody>';
  if(!rows.length){
    h += '<tr><td colspan="10" style="padding:14px;color:var(--ink3)">No upcoming shows</td></tr>';
  }
  rows.forEach(function(e){
    var fee = e.djCost || 0;
    var act = e.totalRevenue || 0;
    var tgt = e.bsTarget || (function(){ var r=venueRoiLookup(e.venue,e.date,fee); return r?r.bsTarget:0; })() || 0;
    var roi = fee>0 && tgt>0 ? Math.round((tgt/fee)*10)/10 : (fee>0 && act>0 ? Math.round((act/fee)*10)/10 : 0);
    var fpBudget = (typeof _vipFloorPlan!=='undefined' && _vipFloorPlan[e.venue]) ? (_vipFloorPlan[e.venue].budget||0) : 0;
    var totTables = (e.totalTables>0 ? e.totalTables : fpBudget) || 0;
    var booked = e.bookedTables || 0;
    var tablesLeft = totTables>0 ? Math.max(0, totTables - booked) : null;
    var upside = tgt>0 ? Math.max(0, tgt - act) : 0;
    if(tablesLeft!=null && totTables>0 && tgt>0){
      upside = Math.max(upside, Math.round(tablesLeft * (tgt / totTables)));
    }
    var pct = tgt>0 ? Math.round(act/tgt*1000)/100 : null;
    var pctBg = pct==null ? '' : (pct>=100 ? '#dcfce7' : pct>0 ? '#fce7f3' : '');
    var dateObj = new Date(e.date+'T12:00:00');
    var dateStr = (dateObj.getMonth()+1)+'/'+dateObj.getDate()+'/'+dateObj.getFullYear();
    var artist = _fcastDjName(e.dj) || 'TBA';
    h += '<tr>';
    h += '<td class="left" style="font-weight:800">'+artist+'</td>';
    h += '<td>'+(fee?('$'+fee.toLocaleString()):'$0')+'</td>';
    h += '<td>'+dateStr+'</td>';
    h += '<td>'+(roi||0)+'</td>';
    h += '<td style="background:#dcfce7;font-weight:700">'+(act?('$'+act.toLocaleString()):'')+'</td>';
    h += '<td style="background:#FFF2CC;font-weight:700">'+(tgt?('$'+tgt.toLocaleString()):'')+'</td>';
    h += '<td>'+(tablesLeft!=null?tablesLeft:'')+'</td>';
    h += '<td>'+(upside?('$'+upside.toLocaleString()):'')+'</td>';
    h += '<td></td>';
    h += '<td style="'+(pctBg?'background:'+pctBg+';':'')+'font-weight:800">'+(pct!=null?(pct.toFixed(2)+'%'):'')+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div></div>';
  return h;
}
function _fcastPickupPct(dlt, tgt){
  if(!dlt || !dlt.hasPrev) return null;
  var gap = Math.max(0, (tgt||0) - (dlt.prevRev||0));
  if(gap <= 0){
    if((dlt.dRev||0) > 0) return 100;
    return 0;
  }
  return Math.round((dlt.dRev / gap) * 100);
}

/* ---- Projected sales from FV_PERF_DB (artist D-4 pace + weekday/Sunday baselines) ---- */
function _perfNormDj(s){
  return String(s||'').toUpperCase().replace(/\?+/g,'').replace(/&/g,' AND ').replace(/B2B/g,' ')
    .replace(/[^A-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function _perfRows(){
  return (typeof FV_PERF_DB!=='undefined' && Array.isArray(FV_PERF_DB)) ? FV_PERF_DB : [];
}
function _perfIsHistorical(r){
  if(!r || !r.date) return false;
  var n=new Date();
  var today=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  if(r.date >= today) return false;
  if(r.finalBs==null) return false;
  if(r.finalSrc==='toast') return true;
  return !!(r.scrapedAt && r.scrapedAt > r.date);
}
function _perfMedian(nums){
  var a=(nums||[]).filter(function(n){ return n!=null && isFinite(n); }).slice().sort(function(x,y){ return x-y; });
  if(!a.length) return null;
  var m=Math.floor(a.length/2);
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
}
function _perfRevAtDaysOut(row, daysOut){
  if(!row || daysOut==null) return null;
  if(daysOut>=12) return row.d14Rev;
  if(daysOut>=6) return row.d7Rev;
  if(daysOut>=3) return row.d4Rev;
  if(daysOut>=1) return row.d1Rev;
  return row.d0Rev!=null ? row.d0Rev : row.finalBs;
}
/** Snapshot revenue N days before event from Firebase pacing (live). */
function _fcastSnapAtDaysOut(venue, date, daysOut){
  var key=(venue+'_'+date).replace(/[^a-zA-Z0-9_-]/g,'_');
  var hist=window._pacingData ? window._pacingData[key] : null;
  if(!hist) return null;
  var target=new Date(date+'T12:00:00');
  target.setDate(target.getDate()-daysOut);
  var want=_ymdLocal ? _ymdLocal(target) : target.toISOString().slice(0,10);
  if(hist[want] && hist[want].revenue!=null) return { day:want, revenue:hist[want].revenue, tables:hist[want].tables };
  // nearest snapshot within ?1 day
  var best=null, bestDist=99;
  Object.keys(hist).forEach(function(d){
    var dist=Math.abs((new Date(d+'T12:00:00')-target)/86400000);
    if(dist<bestDist){ bestDist=dist; best={ day:d, revenue:hist[d].revenue, tables:hist[d].tables }; }
  });
  return (best && bestDist<=1.5) ? best : null;
}
function _perfArtistComps(venue, dj, excludeDate){
  var key=_perfNormDj(dj);
  if(!key) return [];
  return _perfRows().filter(function(r){
    if(!_perfIsHistorical(r)) return false;
    if(r.venue!==venue) return false;
    if(excludeDate && r.date===excludeDate) return false;
    return r.djKey===key || (r.djKey && (r.djKey.indexOf(key)>=0 || key.indexOf(r.djKey)>=0) && Math.min(r.djKey.length,key.length)>=4);
  }).sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; });
}
function _perfWeekdayComps(venue, dow, excludeDate){
  return _perfRows().filter(function(r){
    if(!_perfIsHistorical(r)) return false;
    if(r.venue!==venue) return false;
    if(r.dow!==dow) return false;
    if(excludeDate && r.date===excludeDate) return false;
    return true;
  });
}
/**
 * Project final BS for an upcoming show.
 * 1) Artist history: median(final / rev_at_similar_days_out) ? current
 * 2) Weekday/Sunday baseline: same using D-4 mult when available, else median final
 * 3) Blend when both exist
 */
function _fcastProjectSales(e){
  _fcastEnrich(e);
  var days=_daysTo(e.date);
  var cur=e.totalRevenue||0;
  var dow=new Date(e.date+'T12:00:00').getDay();
  var artist=_perfArtistComps(e.venue, e.dj, e.date);
  var weekday=_perfWeekdayComps(e.venue, dow, e.date);
  var DOW_N=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function multsFrom(rows){
    var ms=[];
    rows.forEach(function(r){
      var past=_perfRevAtDaysOut(r, Math.max(0, days));
      if(past!=null && past>0 && r.finalBs!=null) ms.push(r.finalBs/past);
      else if(r.multD4!=null && days>=3 && days<=5) ms.push(r.multD4);
    });
    return ms;
  }

  var artistMult=_perfMedian(multsFrom(artist));
  var weekMult=_perfMedian(multsFrom(weekday));
  var weekFinalMed=_perfMedian(weekday.map(function(r){ return r.finalBs; }));
  var weekD4Med=_perfMedian(weekday.filter(function(r){ return r.d4Rev>0; }).map(function(r){ return r.d4Rev; }));
  var weekMultD4=_perfMedian(weekday.filter(function(r){ return r.multD4!=null; }).map(function(r){ return r.multD4; }));

  var artistProj=(artistMult!=null && cur>0) ? Math.round(cur*artistMult) : null;
  var weekProj=null;
  if(weekMult!=null && cur>0) weekProj=Math.round(cur*weekMult);
  else if(weekMultD4!=null && cur>0 && days<=5) weekProj=Math.round(cur*weekMultD4);
  else if(weekFinalMed!=null) weekProj=Math.round(weekFinalMed);

  var projected=null, method='?';
  if(artistProj!=null && weekProj!=null){
    projected=Math.round(artistProj*0.6 + weekProj*0.4);
    method='Artist + '+DOW_N[dow]+' blend';
  } else if(artistProj!=null){
    projected=artistProj; method='Artist history';
  } else if(weekProj!=null){
    projected=weekProj; method=DOW_N[dow]+' baseline';
  }

  // Best prior artist show for "4 days out last time" story
  var prior=null;
  for(var i=0;i<artist.length;i++){
    if(artist[i].d4Rev!=null || artist[i].finalBs!=null){ prior=artist[i]; break; }
  }

  return {
    days:days, cur:cur, dow:dow, dowLabel:DOW_N[dow],
    projected:projected, method:method,
    artistMult:artistMult, weekMult:weekMult, weekMultD4:weekMultD4,
    weekFinalMed:weekFinalMed, weekD4Med:weekD4Med,
    artistN:artist.length, weekN:weekday.length,
    prior:prior,
    artistProj:artistProj, weekProj:weekProj
  };
}
function _fmtMoneyShort(n){
  if(n==null || !isFinite(n)) return '\u2014';
  var a=Math.abs(n);
  if(a>=1e6) return (n<0?'-':'')+'$'+(a/1e6).toFixed(2)+'M';
  if(a>=1000) return (n<0?'-':'')+'$'+(a/1000).toFixed(1).replace(/\.0$/,'')+'K';
  return (n<0?'-':'')+'$'+Math.round(a);
}

function renderForecast(venueIdx, view){
  if(venueIdx!==undefined) _fcastActiveVenue = venueIdx;
  if(view!==undefined) _fcastActiveView = view;
  // Enrich all forecast events with fee + bsTarget
  FORECAST_DATA.forEach(_fcastEnrich);

  var TCOL = {DIAMOND:'#b9f2ff',PRESTIGE:'#c8b4e8',PLATINUM:'#e8e8e8',GOLD:'#ffe082',RIVERWALK:'#b2dfdb',SLIP:'#ffccbc',LOUNGE:'#c8e6c9',BOOTHS:'#fff9c4',SEATING:'#f0f4c3',Other:'#eeeeee'};
  var TTXT = {DIAMOND:'#0a4a6e',PRESTIGE:'#4a1a7a',PLATINUM:'#2d2d2d',GOLD:'#7d5a00',RIVERWALK:'#00574b',SLIP:'#7d3000',LOUNGE:'#155724',BOOTHS:'#666000',SEATING:'#4a5400',Other:'#555'};
  var TIER_ORDER_FC = ['DIAMOND','PRESTIGE','PLATINUM','GOLD','RIVERWALK','SLIP','LOUNGE','BOOTHS','SEATING','Other'];
  var now = new Date(); now.setHours(0,0,0,0);
  var todayStr = now.toISOString().split('T')[0];

  var h = '';

  // No separate venue tabs ? Forecast follows the global venue selector (curV)

  if(false && _fcastActiveView==='all'){
    // -- ALL VENUES SUMMARY (disabled ? venue now driven by global selector) ---
    var allEvts = FORECAST_DATA.slice().sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:0; });
    // Top KPI strip
    var totalRev = allEvts.reduce(function(s,e){return s+e.totalRevenue;},0);
    var totalTarget = allEvts.reduce(function(s,e){return s+(e.bsTarget||0);},0);
    var totalPct = totalTarget>0?Math.round(totalRev/totalTarget*100):0;
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
    [{lbl:'Total Shows',val:allEvts.length},{lbl:'With Bookings',val:allEvts.filter(function(e){return e.totalRevenue>0;}).length},
     {lbl:'Revenue Committed',val:'$'+totalRev.toLocaleString()},{lbl:'Total Target',val:'$'+totalTarget.toLocaleString()},
     {lbl:'Overall % Complete',val:totalPct+'%',col:totalPct>=50?'#22c55e':totalPct>=20?'#f59e0b':'#ef4444'}
    ].forEach(function(s){
      h += '<div style="background:var(--card);border-radius:10px;padding:9px 14px;min-width:110px">'
         + '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3)">'+s.lbl+'</div>'
         + '<div style="font-size:18px;font-weight:900;letter-spacing:-.5px;color:'+(s.col||'inherit')+'">'+s.val+'</div>'
         + '</div>';
    });
    h += '</div>';

    // All-venues table
    h += '<div class="fcast-tbl-wrap"><table class="fcast-tbl">';
    h += '<thead><tr>'
       + '<th class="left">Date</th><th class="left">Venue</th><th class="left">Artist</th>'
       + '<th>BS Actual</th><th style="background:#FFF2CC;color:#7D5A00">BS Target</th>'
       + '<th>% Complete</th><th>Pickup Pace</th><th>Tables</th><th>Days Out</th>'
       + '<th>Booking Pace</th>'
       + '</tr></thead><tbody>';

    allEvts.forEach(function(e){
      var days = _daysTo(e.date);
      if(days < -1) return; // skip past events
      // Derive target live from VENUE_ROI_RULES if not pre-set
      var bsTarget = e.bsTarget || 0;
      var dispActAll = (e._toastActual!=null) ? e._toastActual : e.totalRevenue;
      var pct = bsTarget>0?Math.round(dispActAll/bsTarget*100):0;
      var pctCol = pct>=70?'#22c55e':pct>=30?'#f59e0b':'#ef4444';
      if(pct===0&&!dispActAll) pctCol='#94a3b8';
      var dateObj = new Date(e.date+'T12:00:00');
      var dateFmt = dateObj.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      // Pickup pace: pct per week assuming scrape was done 0 days ago (Jul 11)
      // Days elapsed since event was last updated = 0 (just scraped)
      // Weeks to event:
      var weeksLeft = Math.max(1, Math.ceil(days/7));
      var neededPerWeek = e.bsTarget>0 ? Math.round((e.bsTarget-e.totalRevenue)/weeksLeft) : 0;
      var paceStr = (days>0 && e.bsTarget>0) ? '+'+_fmtK(neededPerWeek)+'/wk needed' : '?';
      var vShort = e.venue==='Casa Neos Beach Club'?'BC':e.venue==='MILA Lounge'?'MILA':'Lounge';
      h += '<tr>';
      h += '<td class="left" style="font-size:10px;color:var(--ink3)">'+dateFmt+'</td>';
      h += '<td class="left"><span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;background:var(--hair);color:var(--ink2)">'+vShort+'</span></td>';
      h += '<td class="left" style="font-weight:700">'+e.dj+'</td>';
      h += '<td style="font-weight:700">'+(e.totalRevenue>0?'$'+e.totalRevenue.toLocaleString():'?')+'</td>';
      h += '<td style="background:#FFF2CC;color:#7D5A00;font-weight:700">'+(bsTarget?'$'+bsTarget.toLocaleString():'?')+'</td>';
      h += '<td>';
      if(bsTarget>0){
        h += '<div style="display:flex;align-items:center;gap:5px">'
           + '<b style="color:'+pctCol+'">'+pct+'%</b>'
           + '<div style="width:50px;height:6px;background:var(--hair);border-radius:3px;overflow:hidden"><div style="width:'+Math.min(100,pct)+'%;height:100%;background:'+pctCol+';border-radius:3px"></div></div>'
           + '</div>';
      } else { h += '?'; }
      h += '</td>';
      h += '<td style="font-size:10px;color:'+(neededPerWeek>0?'#f59e0b':'var(--ink3)')+'">'+paceStr+'</td>';
      h += '<td>'+(e.totalTables>0?'<b>'+e.bookedTables+'</b><span style="color:var(--ink3)">/'+e.totalTables+'</span>':'?')+'</td>';
      h += '<td style="font-size:10px;color:'+(days<=7?'#ef4444':days<=14?'#f59e0b':'var(--ink3)')+'">'+days+'d</td>';
      // Pacing sparkline
      var _pk = (e.venue+'_'+e.date).replace(/[^a-zA-Z0-9_-]/g,'_');
      var _ph = window._pacingData ? window._pacingData[_pk] : null;
      h += '<td>'+_sparkline(_ph, e.totalTables)+'</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';

  } else {
    // -- SINGLE VENUE VIEW ? follows global venue selector (curV) ---
    var vname = curV;
    var events = FORECAST_DATA.filter(function(e){ return e.venue===vname; })
      .sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:0; });

    // KPI strip ? compute targets live from VENUE_ROI_RULES
    var totalRev = events.reduce(function(s,e){return s+e.totalRevenue;},0);
    var totalTarget = events.reduce(function(s,e){
      if(e.bsTarget) return s+e.bsTarget;
      var r=venueRoiLookup(e.venue,e.date,e.djCost||0); return s+(r?r.bsTarget:0);
    },0);
    var totalPct = totalTarget>0?Math.round(totalRev/totalTarget*100):0;
    h += '<div class="fcast-print-page1">';
    h += '<div class="fcast-print-kpis" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
    [{lbl:'Upcoming Shows',val:events.length},
     {lbl:'BS Actual (export)',val:'$'+totalRev.toLocaleString(),col:'#0f766e'},
     {lbl:'BS Target',val:'$'+totalTarget.toLocaleString(),col:'#7d5a00'},
     {lbl:'% of Target',val:totalPct+'%',col:totalPct>=50?'#22c55e':totalPct>=20?'#f59e0b':'#ef4444'}
    ].forEach(function(s){
      h += '<div style="background:var(--card);border-radius:10px;padding:12px 16px;min-width:130px;flex:1">'
         + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3)">'+s.lbl+'</div>'
         + '<div style="font-size:22px;font-weight:900;letter-spacing:-.5px;margin-top:2px;color:'+(s.col||'inherit')+'">'+s.val+'</div>'
         + '</div>';
    });
    h += '</div>';

    var upcoming = events.filter(function(e){ return _daysTo(e.date)>=-1; });
    // Horizontal booking chart: BC = next 4, Lounge & MILA = next 8
    var chartLimit = (curV==='Casa Neos Beach Club') ? 4 : 8;
    var viewRows = upcoming.slice(0, chartLimit);
    var venueShort = (curV==='Casa Neos Beach Club') ? 'CASA NEOS BC'
      : (curV==='Casa Neos Lounge') ? 'CASA NEOS LOUNGE'
      : (curV==='MILA Lounge') ? 'MILA LOUNGE'
      : String(curV||'VENUE').toUpperCase();

    // ============================================================
    // 1) RESULTS ? booking performance snapshot (PDF page 1)
    // ============================================================
    h += '<div class="fcast-chart-wrap fcast-print-snap" style="padding:0;overflow:hidden">';
    if(!viewRows.length){
      h += '<div style="padding:16px;color:var(--ink3)">No upcoming shows.</div>';
    } else {
      var chartRows = viewRows.map(function(e){
        var act = e.totalRevenue||0;
        var tgt = e.bsTarget || (function(){ var r=venueRoiLookup(e.venue,e.date,e.djCost||0); return r?r.bsTarget:0; })();
        var dateObj = new Date(e.date+'T12:00:00');
        var mm = ('0'+(dateObj.getMonth()+1)).slice(-2);
        var dd = ('0'+dateObj.getDate()).slice(-2);
        var yyyy = dateObj.getFullYear();
        var dateLabel = mm+'/'+dd+'/'+yyyy;
        var djLabel = _fcastDjName(e.dj) || 'TBD';
        var pct = tgt>0?Math.round(act/tgt*100):0;
        return { act:act, tgt:tgt, label:djLabel, dateLabel:dateLabel, tip:djLabel+' \u2014 Actual $'+act.toLocaleString()+' / Target $'+(tgt||0).toLocaleString()+' ('+pct+'%)' };
      });
      h += _fcastBarChartHtml(chartRows, venueShort+' BOOKING PERFORMANCE');
    }
    h += '</div>';

    // ============================================================
    // 2) DETAILS ? booking performance detail table (PDF page 1)
    // ============================================================
    h += _fcastDetailsTableHtml(upcoming, venueShort);
    h += '</div>';

    // ============================================================
    // Pick up pace ? PDF page 2
    // ============================================================
    h += '<div class="fcast-print-page2">';
    h += '<div class="fcast-chart-wrap fcast-print-below" style="padding:0;overflow:hidden">';
    h += '<div class="fcast-chart-title" style="padding:12px 16px 0">PICK UP PACE</div>';
    h += '<div style="padding:4px 16px 10px;font-size:10px;color:var(--ink3)">Today = FourVenues Sales export &middot; vs yesterday, beginning of day, and week start (Mon) &middot; Pickup % = day gain vs remaining gap to target.</div>';
    var paceFocus = upcoming.slice();
    h += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    h += '<thead><tr>'
       + '<th style="text-align:left;padding:8px 12px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">Date / Artist</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">Week start</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">Yesterday</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">BOD</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:#0f766e;font-size:10px">Today</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">&Delta; Yday</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">&Delta; BOD</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:#7d5a00;font-size:10px">Target</th>'
       + '<th style="text-align:right;padding:8px 8px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">% Done</th>'
       + '<th style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--rule);color:var(--ink3);font-size:10px">Pickup %</th>'
       + '</tr></thead><tbody>';
    if(!paceFocus.length){
      h += '<tr><td colspan="10" style="padding:14px 16px;color:var(--ink3)">No upcoming shows</td></tr>';
    }
    paceFocus.forEach(function(e){
      var tgt = e.bsTarget || (function(){ var r=venueRoiLookup(e.venue,e.date,e.djCost||0); return r?r.bsTarget:0; })();
      var dlt = _fcastDayDelta(e.venue, e.date, e.totalRevenue||0, e.bookedTables||0);
      var pct = _fcastPickupPct(dlt, tgt);
      var donePct = tgt>0 ? Math.round((e.totalRevenue||0)/tgt*100) : 0;
      var doneCol = !(e.totalRevenue) ? '#94a3b8' : (donePct>=100 ? '#15803d' : donePct>=30 ? '#f59e0b' : '#dc2626');
      var dateObj = new Date(e.date+'T12:00:00');
      var dateFmt = dateObj.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      var djLabel = _fcastDjName(e.dj);
      function _pd(v,ok){ if(!ok||v==null) return {s:'\u2014',c:'var(--ink3)'}; var c=v>0?'#22c55e':v<0?'#ef4444':'var(--ink3)'; var s=v>0?('+$'+Math.round(v).toLocaleString()):(v<0?('-$'+Math.round(Math.abs(v)).toLocaleString()):'$0'); return {s:s,c:c}; }
      var dY=_pd(dlt.dRev,dlt.hasPrev), dB=_pd(dlt.dBod,dlt.hasBod);
      var pctCol = pct==null ? 'var(--ink4)' : (pct>=20 ? '#22c55e' : pct>0 ? '#f59e0b' : '#94a3b8');
      var pctStr = pct==null ? '\u2014' : ((pct>0?'+':'')+pct+'%');
      h += '<tr>';
      h += '<td style="padding:10px 12px;border-bottom:0.5px solid var(--hair)"><div style="font-weight:800">'+(djLabel||'&nbsp;')+'</div><div style="font-size:10px;color:var(--ink3)">'+dateFmt+' &middot; '+_daysTo(e.date)+'d out</div></td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;color:var(--ink3)">'+(dlt.hasWeek?'$'+Math.round(dlt.weekStartRev).toLocaleString():'\u2014')+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;color:var(--ink3)">'+(dlt.hasPrev?'$'+Math.round(dlt.prevRev).toLocaleString():'\u2014')+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;color:var(--ink3)">'+(dlt.hasBod?'$'+Math.round(dlt.bodRev).toLocaleString():'\u2014')+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;font-weight:800;color:#0f766e">$'+Math.round(dlt.todayRev).toLocaleString()+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;font-weight:800;color:'+dY.c+'">'+dY.s+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;font-weight:800;color:'+dB.c+'">'+dB.s+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;font-weight:800;color:#7d5a00;background:#FFF2CC">'+(tgt?'$'+tgt.toLocaleString():'\u2014')+'</td>';
      h += '<td style="padding:10px 8px;border-bottom:0.5px solid var(--hair);text-align:right;font-weight:900;color:'+doneCol+'">'+donePct+'%</td>';
      h += '<td style="padding:10px 12px;border-bottom:0.5px solid var(--hair);text-align:right;font-weight:900;color:'+pctCol+'">'+pctStr+'</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';

    h += '</div>';
  }

  document.getElementById('fcastBody').innerHTML = h;
  document.getElementById('fcastMeta').textContent = 'BS Actual = FourVenues Integrations API \u00b7 Results \u00b7 Details \u00b7 Pick up pace';
}


/* ---------------------------------------------------------------
   VIP WEEK NAVIGATION - week offset navigation
   --------------------------------------------------------------- */
function _vipShiftDate(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getVipWeekRange(weeksBack) {
  // weeksBack=0 = last complete week, weeksBack=1 = 2 weeks ago, etc.
  var nowMs = Date.now() - 4 * 60 * 60 * 1000;
  var todayStr = new Date(nowMs).toISOString().slice(0, 10);
  var dow = new Date(todayStr + 'T12:00:00Z').getUTCDay();
  var daysToLastMon = dow === 0 ? 6 : dow + 6;
  var lastMon = _vipShiftDate(todayStr, -daysToLastMon);
  var targetMon = _vipShiftDate(lastMon, -weeksBack * 7);
  var targetSun = _vipShiftDate(targetMon, 6);
  return { mon: targetMon, sun: targetSun };
}

function _fmtVipWeekLabel(weeksBack) {
  if (weeksBack === 0) return 'Last Week';
  var r = getVipWeekRange(weeksBack);
  var opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  var ms = new Date(r.mon + 'T12:00:00Z').toLocaleDateString('en-US', opts);
  var ss = new Date(r.sun + 'T12:00:00Z').toLocaleDateString('en-US', opts);
  return ms + ' \u2013 ' + ss;
}

function vipWeekNav(delta) {
  var newOffset = _vipWeekOffset + delta;
  if (newOffset < 0) return; // can't go forward past "last week"
  var range = getVipWeekRange(newOffset);
  var hasData = SCHED.some(function(e) { return e.d >= range.mon && e.d <= range.sun && e.bs_a; });
  if (!hasData && delta > 0) return; // no data further back
  _vipWeekOffset = newOffset;
  renderVIP(_vipActiveVenue);
}

/* Sales / Live Entertainment standing for Weekly Flash (P&L actual vs OPEX budget). */
function _vipPlBucket(venue, year, months){
  var salesA=0, liveA=0, salesB=0, liveB=0, nA=0, nB=0;
  (months||[]).forEach(function(mm){
    var sa=getBgtActual(venue, year, mm, 'sales');
    var la=getBgtActual(venue, year, mm, 'live');
    if(sa!=null && sa>0){ salesA+=sa; nA++; if(la!=null) liveA+=la; }
    var sb=getBgtPlan(venue, year, mm, 'sales');
    var lb=getBgtPlan(venue, year, mm, 'live');
    if(sb!=null){ salesB+=sb; nB++; if(lb!=null) liveB+=lb; }
  });
  return {
    salesA:nA?salesA:null,
    liveA:nA?liveA:null,
    salesB:nB?salesB:null,
    liveB:nB?liveB:null,
    marginA:pctLive(nA?salesA:null, nA?liveA:null),
    marginB:pctLive(nB?salesB:null, nB?liveB:null)
  };
}
function _vipMonthStandingStats(venue, yr, monthIndex0, cutDate){
  var feeDone=0, feeRemain=0, bsDone=0, bsRemain=0, bsTargetMonth=0, nRemain=0;
  SCHED.forEach(function(r){
    if(!r||r._s==='empty') return;
    if((r.v||r.venue)!==venue) return;
    if(!r.d || !dateInFiscalPeriod(r.d, yr, monthIndex0)) return;
    var fee=+(r.fee||r.cost||0)||0;
    var tgt=showTargets(r);
    var bsT=tgt&&tgt.bs_m!=null?+tgt.bs_m:null;
    if(bsT!=null) bsTargetMonth+=bsT;
    var isPast=r.d<=cutDate;
    if(isPast){
      feeDone+=fee;
      if(r.bs_a!=null) bsDone+=+r.bs_a;
      else if(bsT!=null) bsDone+=bsT;
    } else {
      feeRemain+=fee;
      nRemain++;
      if(bsT!=null) bsRemain+=bsT;
      else if(fee>0 && tgt && tgt.roi_t) bsRemain+=Math.round(fee*tgt.roi_t);
    }
  });
  var mm=fiscalMm(monthIndex0);
  var monthBgt=getMonthlyBudget(venue,yr,mm);
  var feeProj=feeDone+feeRemain;
  var bsProj=bsDone+bsRemain;
  return {
    mi:monthIndex0+1, mm:mm,
    feeDone:feeDone, feeRemain:feeRemain, feeProj:feeProj, nRemain:nRemain,
    bsDone:bsDone, bsRemain:bsRemain, bsProj:bsProj, bsTargetMonth:bsTargetMonth,
    monthBgt:monthBgt,
    feeVar:monthBgt!=null?(monthBgt-feeProj):null,
    feeUsedPct:monthBgt?Math.round(feeProj/monthBgt*100):null,
    bsVar:bsTargetMonth>0?(bsProj-bsTargetMonth):null,
    bsPct:bsTargetMonth>0?Math.round(bsProj/bsTargetMonth*100):null
  };
}
/* Past performances only: ROI beat (hit/near) vs total measured past shows. */
function _vipRoiCompletionStats(venue, yr, monthIndex0, cutDate){
  var beats=0, measured=0, pastShows=0;
  SCHED.forEach(function(r){
    if(!r||r._s==='empty') return;
    if((r.v||r.venue)!==venue) return;
    if(!r.d || !dateInFiscalPeriod(r.d, yr, monthIndex0)) return;
    if(r.d > cutDate) return;
    pastShows++;
    var fee=+(r.fee||r.cost||0)||0;
    var tgt=showTargets(r);
    if(r.bs_a==null || !tgt || tgt.bs_m==null) return;
    measured++;
    var tone=perfTone(r.bs_a, tgt.bs_m, fee, r.roi_a, tgt.roi_t);
    if(tone==='hit'||tone==='near') beats++;
  });
  return {
    beats:beats,
    measured:measured,
    pastShows:pastShows,
    pct:measured?Math.round(beats/measured*100):null
  };
}
function _vipStandingStripHtml(title, st, extraClass){
  function item(lbl, val, sub, cls){
    return '<div class="vip-stand-item"><div class="vip-stand-l">'+lbl+'</div>'
      +'<div class="vip-stand-v'+(cls?' '+cls:'')+'">'+val+'</div>'
      +(sub?'<div class="vip-stand-s">'+sub+'</div>':'')+'</div>';
  }
  return '<div class="vip-stand-month'+(extraClass?' '+extraClass:'')+'"><div class="vip-stand-month-title">'+title+'</div>'
    +'<div class="vip-stand-row">'
    +item('DJ Fees Actual + Forecast', st.feeProj?$k(st.feeProj):'-', $k(st.feeDone)+' actual + '+$k(st.feeRemain)+' remaining ('+st.nRemain+' shows)', '')
    +item('Budget', st.monthBgt!=null?$k(st.monthBgt):'-', 'Guest DJ monthly budget', '')
    +item('Variance vs Budget', st.feeVar!=null?$kv(st.feeVar):'-', st.feeUsedPct!=null?(st.feeUsedPct+'% of budget used'):(st.feeVar!=null?(st.feeVar>=0?'Under budget':'Over budget'):'-'), st.feeVar!=null?(st.feeVar>=0?'beat':'miss'):'')
    +item('BS Actual + Forecast', st.bsProj?$k(st.bsProj):'-', $k(st.bsDone)+' actual + '+$k(st.bsRemain)+' @ ROI target', '')
    +item('BS Target', st.bsTargetMonth?$k(st.bsTargetMonth):'-', 'ROI-target envelope', '')
    +item('BS vs Target', st.bsVar!=null?$kv(st.bsVar):'-', st.bsPct!=null?(st.bsPct+'% of target'):'-', st.bsVar!=null?(st.bsVar>=0?'beat':'miss'):'')
    +'</div></div>';
}
function _vipStandingHtml(venue, asOfDate){
  var info=fiscalInfoForDate(asOfDate);
  var yr=info.year;
  var mi=info.monthIndex+1;
  var period=fiscalPeriodRange(yr, info.monthIndex);
  var cutDate=(dateInFiscalPeriod(String(TODAY||''), yr, info.monthIndex)) ? String(TODAY) : (asOfDate>period.to?period.to:asOfDate);

  var monthSt=_vipMonthStandingStats(venue, yr, info.monthIndex, cutDate);
  var yFeeDone=0,yFeeRemain=0,yFeeProj=0,yFeeBgt=0,yHasBgt=false,yNRemain=0;
  var yBsDone=0,yBsRemain=0,yBsProj=0,yBsTgt=0;
  for(var m=0;m<=info.monthIndex;m++){
    var pEnd=fiscalPeriodRange(yr, m).to;
    var mCut=cutDate<pEnd?cutDate:pEnd;
    if(m<info.monthIndex) mCut=pEnd;
    var st=_vipMonthStandingStats(venue, yr, m, mCut);
    yFeeDone+=st.feeDone; yFeeRemain+=st.feeRemain; yFeeProj+=st.feeProj; yNRemain+=st.nRemain;
    yBsDone+=st.bsDone; yBsRemain+=st.bsRemain; yBsProj+=st.bsProj; yBsTgt+=st.bsTargetMonth;
    if(st.monthBgt!=null){ yFeeBgt+=st.monthBgt; yHasBgt=true; }
  }
  var yFeeVar=yHasBgt?(yFeeBgt-yFeeProj):null;
  var yFeeUsed=yHasBgt&&yFeeBgt?Math.round(yFeeProj/yFeeBgt*100):null;
  var yBsVar=yBsTgt>0?(yBsProj-yBsTgt):null;
  var yBsPct=yBsTgt>0?Math.round(yBsProj/yBsTgt*100):null;
  var ytdSt={
    feeDone:yFeeDone, feeRemain:yFeeRemain, feeProj:yFeeProj, nRemain:yNRemain,
    bsDone:yBsDone, bsRemain:yBsRemain, bsProj:yBsProj, bsTargetMonth:yBsTgt,
    monthBgt:yHasBgt?yFeeBgt:null, feeVar:yFeeVar, feeUsedPct:yFeeUsed, bsVar:yBsVar, bsPct:yBsPct
  };

  return '<div class="vip-stand">'
    +'<div class="vip-stand-hd"><span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3)">Budget Standing</span>'
    +'<span style="font-size:10px;color:var(--ink3)">'+venue+' &middot; through '+cutDate+'</span></div>'
    +_vipStandingStripHtml(MN_SH[mi-1]+' '+yr+' <span style="font-weight:600;text-transform:none;letter-spacing:0;color:var(--ink3)"> — Month · Actual + Forecast</span>', monthSt)
    +_vipStandingStripHtml('YTD '+yr+' <span style="font-weight:600;text-transform:none;letter-spacing:0;color:var(--ink3)"> — Jan–'+MN_SH[mi-1]+' · same metrics</span>', ytdSt, 'vip-stand-ytd')
    +'<div class="vip-stand-note">DJ Fees = booked actual to date + remaining scheduled fees. Future BS assumes ROI target from venue rules. Green = favorable.</div>'
    +'</div>';
}

/* Build VIP venue data from SCHED for a given week range (used for historical weeks) */
/* Build a floor-plan reference (totalTables per tier, tablesBudget) from VIP_VENUES data.
   This is stable ? the floor plan doesn't change week to week. */
var _vipFloorPlan = (function(){
  var fp = {};
  (VIP_VENUES||[]).forEach(function(v){
    if(fp[v.venue]) return; // use first/most recent entry per venue
    var budget = 0;
    var tierRef = {};
    (v.shows||[]).forEach(function(sh){
      Object.keys(sh.tiers||{}).forEach(function(t){
        var td = sh.tiers[t];
        if(!tierRef[t]) tierRef[t] = { total: td.totalTables||0, min: td.minPerTable||0, color: td.color||'#eee', textColor: td.textColor||'#333' };
        budget = Math.max(budget, Object.values(sh.tiers).reduce(function(s,x){ return s+(x.totalTables||0); },0));
      });
    });
    fp[v.venue] = { budget: budget, tiers: tierRef };
  });
  return fp;
})();


function _vipForecastRow(venue, date){
  if(typeof FORECAST_DATA!=='undefined' && Array.isArray(FORECAST_DATA)){
    for(var i=0;i<FORECAST_DATA.length;i++){
      var e=FORECAST_DATA[i];
      if(e && e.venue===venue && e.date===date) return e;
    }
  }
  var live=window._forecastLive && window._forecastLive.events;
  if(live){
    var key=(venue+'_'+date).replace(/[^a-zA-Z0-9_-]/g,'_');
    if(live[key]) return live[key];
    var keys=Object.keys(live);
    for(var j=0;j<keys.length;j++){
      var row=live[keys[j]];
      if(row && row.venue===venue && row.date===date) return row;
    }
  }
  return null;
}
function _vipPacingTables(venue, date){
  var key=(venue+'_'+date).replace(/[^a-zA-Z0-9_-]/g,'_');
  var hist=window._pacingData ? window._pacingData[key] : null;
  if(!hist) return null;
  var days=Object.keys(hist).sort();
  for(var i=days.length-1;i>=0;i--){
    var t=hist[days[i]] && hist[days[i]].tables;
    if(t!=null) return +t;
  }
  return null;
}
function _vipLiveRow(venue, date){
  var live=window._forecastLive && window._forecastLive.events;
  if(!live) return null;
  var key=(venue+'_'+date).replace(/[^a-zA-Z0-9_-]/g,'_');
  if(live[key]) return live[key];
  var keys=Object.keys(live);
  for(var j=0;j<keys.length;j++){
    var row=live[keys[j]];
    if(row && row.venue===venue && row.date===date) return row;
  }
  return null;
}
function _vipResolveTables(venue, date, fallback){
  if(fallback!=null && fallback!=='' && +fallback>0) return +fallback;
  var live=_vipLiveRow(venue, date);
  if(live && live.bookedTables!=null && (+live.bookedTables>0 || live.hasData)) return +live.bookedTables;
  var p=_vipPacingTables(venue, date);
  if(p!=null && +p>0) return +p;
  var f=_vipForecastRow(venue, date);
  if(f && f.bookedTables!=null && (+f.bookedTables>0 || f.hasData)) return +f.bookedTables;
  if(fallback!=null && fallback!=='') return +fallback;
  if(live && live.bookedTables!=null) return +live.bookedTables;
  if(f && f.bookedTables!=null) return +f.bookedTables;
  return null;
}

function buildVipFromSched(mon, sun) {
  var venueMap = {};
  var opts     = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  var weekLabel = new Date(mon+'T12:00:00Z').toLocaleDateString('en-US', opts)
                + ' \u2013 ' + new Date(sun+'T12:00:00Z').toLocaleDateString('en-US', opts);
  var dateOpts = { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' };
  var weekKey = getISOWeek(new Date(mon + 'T12:00:00Z'));

  /* Index baked VIP show tiers by venue|date for reuse on non-rich weeks. */
  var bakedTier = {};
  (VIP_VENUES||[]).forEach(function(v){
    (v.shows||[]).forEach(function(sh){
      if(!sh||!sh.date||!sh.tiers) return;
      bakedTier[(v.venue||'')+'|'+sh.date]=sh;
    });
  });

  SCHED.forEach(function(e) {
    if (e.d < mon || e.d > sun) return;
    var vn = e.venue || e.v || '';
    if (!vn) return;
    if (!venueMap[vn]) venueMap[vn] = { venue: vn, weekOf: weekLabel, weekKey: weekKey, shows: [] };

    var fp      = (typeof getVipFloorPlan==='function') ? getVipFloorPlan(vn, e.d) : (_vipFloorPlan[vn] || {});
    var budget  = fp.budget || null;
    var tierRef = {};
    Object.keys(fp.tiers||{}).forEach(function(t){
      tierRef[t] = {
        soldTables: 0, totalTables: fp.tiers[t].total,
        totalSales: 0, avgPerTable: 0,
        minPerTable: fp.tiers[t].min,
        color: fp.tiers[t].color, textColor: fp.tiers[t].textColor
      };
    });

    var liveRow = (typeof _vipLiveRow==='function') ? _vipLiveRow(vn, e.d) : ((typeof _vipForecastRow==='function') ? _vipForecastRow(vn, e.d) : null);
    var tablesActual = (typeof _vipResolveTables==='function') ? _vipResolveTables(vn, e.d, null) : null;
    var hasTierActual=!!(liveRow&&liveRow.tierSummary&&typeof liveRow.tierSummary==='object'&&Object.keys(liveRow.tierSummary).length);
    if(hasTierActual){
      Object.keys(liveRow.tierSummary).forEach(function(tname){
        var src=liveRow.tierSummary[tname]||{};
        var canon=tname.charAt(0).toUpperCase()+tname.slice(1).toLowerCase();
        var key=tierRef[tname]?tname:(tierRef[canon]?canon:tname);
        if(!tierRef[key]){
          tierRef[key]={ soldTables:0, totalTables:0, totalSales:0, avgPerTable:0, minPerTable:0, color:'#eee', textColor:'#333' };
        }
        if(src.soldTables!=null) tierRef[key].soldTables=+src.soldTables;
        else if(src.sold!=null) tierRef[key].soldTables=+src.sold;
        else if(src.booked!=null) tierRef[key].soldTables=+src.booked;
        if(src.totalTables!=null) tierRef[key].totalTables=+src.totalTables;
        else if(src.total!=null) tierRef[key].totalTables=+src.total;
        if(src.totalSales!=null) tierRef[key].totalSales=+src.totalSales;
        else if(src.sales!=null) tierRef[key].totalSales=+src.sales;
        else if(src.revenue!=null) tierRef[key].totalSales=+src.revenue;
        if(src.avgPerTable!=null) tierRef[key].avgPerTable=+src.avgPerTable;
        else if(tierRef[key].soldTables>0) tierRef[key].avgPerTable=Math.round(tierRef[key].totalSales/tierRef[key].soldTables);
      });
      if(tablesActual==null || tablesActual===0){
        var sumSold=Object.keys(tierRef).reduce(function(s,t){ return s+(tierRef[t].soldTables||0); },0);
        if(sumSold>0) tablesActual=sumSold;
      }
    }

    /* Prefer exact baked VIP show for this date when live tier summary is missing. */
    var baked=bakedTier[vn+'|'+e.d];
    if(!hasTierActual && baked && baked.tiers){
      Object.keys(baked.tiers).forEach(function(tname){
        var src=baked.tiers[tname]||{};
        if(!tierRef[tname]){
          tierRef[tname]={ soldTables:0, totalTables:0, totalSales:0, avgPerTable:0, minPerTable:0, color:TIER_COLORS[tname]||'#eee', textColor:TIER_TEXT[tname]||'#333' };
        }
        if(src.soldTables!=null) tierRef[tname].soldTables=+src.soldTables;
        if(src.totalTables!=null) tierRef[tname].totalTables=+src.totalTables;
        if(src.totalSales!=null) tierRef[tname].totalSales=+src.totalSales;
        if(src.avgPerTable!=null) tierRef[tname].avgPerTable=+src.avgPerTable;
        if(src.minPerTable!=null) tierRef[tname].minPerTable=+src.minPerTable;
        if(src.color) tierRef[tname].color=src.color;
        if(src.textColor) tierRef[tname].textColor=src.textColor;
      });
      hasTierActual=Object.keys(baked.tiers).some(function(t){ var x=baked.tiers[t]; return x&&((x.soldTables>0)||(x.totalSales>0)); });
      if((tablesActual==null||tablesActual===0) && baked.tablesActual!=null) tablesActual=+baked.tablesActual;
    }

    var bsAct = e.bs_a || (liveRow && liveRow.totalRevenue) || (baked && baked.bsActual) || 0;
    var feeN = e.fee || e.cost || (baked && baked.fee) || 0;
    var tgtRow = (typeof showTargets==='function') ? showTargets(e) : null;
    var bsMinN = e.bs_m || (tgtRow && tgtRow.bs_m) || (baked && baked.bsMin) || 0;
    venueMap[vn].shows.push({
      date:         e.d,
      label:        new Date(e.d+'T12:00:00Z').toLocaleDateString('en-US', dateOpts),
      dj:           e.dj || (liveRow && liveRow.dj) || (baked && baked.dj) || '',
      fee:          feeN,
      bsActual:     bsAct,
      bsMin:        bsMinN,
      tablesActual: tablesActual,
      tablesBudget: budget || (baked && baked.tablesBudget) || null,
      tiers:        tierRef,
      tableDetail:  (baked && baked.tableDetail) || null,
      _tierDataAvailable: hasTierActual,
      roiActual:    e.roi_a || (feeN > 0 ? Math.round(bsAct/feeN*100)/100 : 0),
      roiTarget:    e.roi_t || 0
    });
  });
  var order = ['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge'];
  var result = [];
  order.forEach(function(vn){ if(venueMap[vn]) result.push(venueMap[vn]); });
  Object.keys(venueMap).forEach(function(vn){ if(order.indexOf(vn)<0) result.push(venueMap[vn]); });
  return result;
}

