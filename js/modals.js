function openAddModal(ds){
  _editIdx=-1;
  _editUid='';
  var f=getFields();
  f.venue.value=curV;
  var defaultDate=ds;
  if(!defaultDate){
    try{ defaultDate=fiscalPeriodRange(curYr, curM).from; }
    catch(eDef){ defaultDate=TODAY; }
  }
  f.date.value=defaultDate;
  f.dj.value=''; f.fee.value=''; f.ev.value=''; if(f.tbd) f.tbd.checked=false; f.note.value='';
  f.bsm.value=''; f.bsa.value=''; f.roit.value=''; f.roia.value='';
  document.getElementById('modalTitle').textContent='Add Show';
  document.getElementById('btnDelete').style.display='none';
  checkDjSuggestion();
  updateFeeTargetsPreview();
  document.getElementById('evModal').classList.remove('hidden');
}
function openEditModal(idx, uid){
  var r=null;
  if(typeof _findSchedByUidOrIdx==='function') r=_findSchedByUidOrIdx(uid, idx);
  if(!r && idx!=null && idx>=0 && idx<SCHED.length) r=SCHED[idx];
  if(!r && uid){
    for(var i=0;i<SCHED.length;i++){
      if(SCHED[i] && String(SCHED[i]._uid||'')===String(uid)){ r=SCHED[i]; break; }
    }
  }
  if(!r){
    try{ console.warn('openEditModal: show not found', idx, uid); }catch(e){}
    return;
  }
  _editIdx=SCHED.indexOf(r);
  if(_editIdx<0 && idx!=null && idx>=0) _editIdx=idx;
  /* Stable identity — SCHED may rebuild while the modal is open; never trust idx alone on save. */
  _editUid=ensureShowUid(r);
  var f=getFields();
  f.venue.value=r.v||r.venue||''; f.date.value=r.d||'';
  f.dj.value=r.dj||''; f.fee.value=r.fee||r.cost||'';
  f.bsm.value=r.bs_m||''; f.bsa.value=r.bs_a||'';
  f.roit.value=r.roi_t||''; f.roia.value=r.roi_a||'';
  f.ev.value=r.ev||''; if(f.tbd) if(f.tbd) f.tbd.checked=!!r.tbd; f.note.value=r.note||'';
  document.getElementById('modalTitle').textContent='Edit Show';
  document.getElementById('btnDelete').style.display='';
  checkDjSuggestion();
  updateFeeTargetsPreview();
  document.getElementById('evModal').classList.remove('hidden');
}
function getFields(){
  return {
    venue:document.getElementById('fldVenue'), date:document.getElementById('fldDate'),
    dj:document.getElementById('fldDJ'),       fee:document.getElementById('fldFee'),
    bsm:document.getElementById('fldBSM'),     bsa:document.getElementById('fldBSA'),
    roit:document.getElementById('fldROIT'),   roia:document.getElementById('fldROIA'),
    ev:document.getElementById('fldEv'),       tbd:document.getElementById('fldTBD'), /* removed from UI */
    note:document.getElementById('fldNote'),
  };
}

/* Fiscal spend helpers for Add/Edit Show panels */
function _modalFiscalSpend(venue, year, mm, excludeIdx){
  return SCHED.filter(function(r){
    if(!r || r._s==='empty' || !r.d) return false;
    if((r.v||r.venue)!==venue) return false;
    if(excludeIdx!=null && SCHED.indexOf(r)===excludeIdx) return false;
    return mm ? inFiscalMonthFilter(r, year, mm) : dateInFiscalYear(r.d, year);
  }).reduce(function(s,r){ return s+(+r.fee||+r.cost||0); }, 0);
}
function _modalYearDjBudget(venue, year){
  var tot=0, n=0;
  for(var mi=1;mi<=12;mi++){
    var b=getMonthlyBudget(venue, year, padMm(mi));
    if(b!=null){ tot+=b; n++; }
  }
  return n ? tot : null;
}
function _modalForecastRow(venue, dateStr){
  if(typeof _vipForecastRow==='function') return _vipForecastRow(venue, dateStr);
  if(typeof _vipLiveRow==='function') return _vipLiveRow(venue, dateStr);
  return null;
}
function _modalBudgetBlock(venue, dateStr, feeToAdd){
  if(!venue || !dateStr) return '';
  var info=fiscalInfoForDate(dateStr);
  var yr=info.year, mm=info.mm, mi=info.monthIndex;
  var monthBudget=getMonthlyBudget(venue, yr, mm);
  var monthSpend=_modalFiscalSpend(venue, yr, mm, _editIdx);
  var monthAfter=monthSpend + (feeToAdd||0);
  var monthVar=monthBudget!=null ? monthBudget-monthSpend : null;
  var monthVarAfter=monthBudget!=null ? monthBudget-monthAfter : null;
  var yearBudget=_modalYearDjBudget(venue, yr);
  var yearSpend=_modalFiscalSpend(venue, yr, null, _editIdx);
  var yearAfter=yearSpend + (feeToAdd||0);
  var yearVar=yearBudget!=null ? yearBudget-yearSpend : null;
  var yearVarAfter=yearBudget!=null ? yearBudget-yearAfter : null;
  var periodLabel=MN_FULL[mi]+' '+yr+' <span class="dj-sugg-sub">('+fiscalPeriodShortRange(yr, mi)+')</span>';

  function row(label, val, cls){
    return '<div class="dj-sugg-row"><span>'+label+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+val+'</b></div>';
  }
  function varCls(v){ return v==null?'':(v>=0?'pos':'neg'); }

  var h='<div class="dj-sugg-sec dj-sugg-budget">';
  h+='<div class="dj-sugg-sec-hd">Budget</div>';
  h+='<div class="dj-sugg-grid">';
  h+='<div class="dj-sugg-panel">';
  h+='<div class="dj-sugg-panel-hd">Month · '+periodLabel+'</div>';
  h+=row('Spent so far', $k(monthSpend));
  h+=row('Month budget', monthBudget!=null?$k(monthBudget):'<span class="muted">Not set</span>');
  h+=row('Variance now', monthVar!=null?$kv(monthVar):'-', varCls(monthVar));
  h+=row('If you add this show ('+$k(feeToAdd||0)+')', $k(monthAfter));
  h+=row('Variance after booking', monthVarAfter!=null?$kv(monthVarAfter):'-', varCls(monthVarAfter));
  h+='</div>';
  h+='<div class="dj-sugg-panel">';
  h+='<div class="dj-sugg-panel-hd">Year · FY '+yr+'</div>';
  h+=row('Spent so far', $k(yearSpend));
  h+=row('Year budget', yearBudget!=null?$k(yearBudget):'<span class="muted">Not set</span>');
  h+=row('Variance now', yearVar!=null?$kv(yearVar):'-', varCls(yearVar));
  h+=row('If you add this show ('+$k(feeToAdd||0)+')', $k(yearAfter));
  h+=row('Variance after booking', yearVarAfter!=null?$kv(yearVarAfter):'-', varCls(yearVarAfter));
  h+='</div></div></div>';
  return h;
}
/** Same calendar date one year earlier (Add/Edit modal LY panel). */
function _modalLyDate(dateStr){
  if(!dateStr || String(dateStr).length<10) return null;
  var parts=String(dateStr).split('-');
  var y=parseInt(parts[0],10)-1;
  if(!(y>=2000) || !parts[1] || !parts[2]) return null;
  return y+'-'+parts[1]+'-'+parts[2];
}
/** Live schedule show on exact LY calendar date (bake + shows overlays). */
function _modalLySameDateShow(venue, dateStr){
  var ly=_modalLyDate(dateStr);
  if(!venue || !ly) return null;
  if(typeof _schedShowOn==='function') return _schedShowOn(venue, ly);
  var best=null;
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if((r.v||r.venue)!==venue || r._s==='empty' || r.d!==ly) return;
    if(!(r.dj||'').trim()) return;
    if(!best || ((r.bs_a||0)>(best.bs_a||0))) best=r;
  });
  return best;
}
function _modalSalesBlock(venue, dateStr, feeToAdd, name){
  if(!venue || !dateStr) return '';
  var lyDate=_modalLyDate(dateStr);
  var show=_modalLySameDateShow(venue, dateStr);
  var py=show && typeof _pyFieldsFromShow==='function' ? _pyFieldsFromShow(show) : null;
  function row(label, val, cls){
    return '<div class="dj-sugg-row"><span>'+label+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+val+'</b></div>';
  }
  var h='<div class="dj-sugg-sec dj-sugg-sales">';
  h+='<div class="dj-sugg-sec-hd">Same date last year'+(lyDate?' <span class="dj-sugg-sub">('+lyDate+')</span>':'')+'</div>';
  h+='<div class="dj-sugg-grid">';
  h+='<div class="dj-sugg-panel">';
  if(py && py.py_dj){
    h+=row('Artist', djLabel(py.py_dj));
    h+=row('Fee', $k(py.py_fee));
    h+=row('BS Target', $k(py.py_bs_m));
    h+=row('BS Actual', $k(py.py_bs_a));
    h+=row('ROI Actual', py.py_roi_a!=null?(Number(py.py_roi_a).toFixed(1)+'x'):'-');
    h+=row('Beat?', py.py_beat==1?'Yes':(py.py_beat==0?'No':'-'), py.py_beat==1?'pos':(py.py_beat==0?'neg':''));
  } else {
    h+='<div class="dj-sugg-row"><span class="muted">No show on '+(lyDate||'that date')+' last year</span><b></b></div>';
  }
  h+='</div></div></div>';
  return h;
}
function _modalArtistBlock(proj, venue, dateStr){
  if(!proj || !proj.p) return '';
  var p=proj.p;
  var fair=realisticSuggestedFee(p, venue, dateStr) || cappedSuggestedFee(p.avg_bs, p.avg_fee);
  return '<div class="dj-sugg-sec dj-sugg-artist">'
    +'<div class="dj-sugg-sec-hd">Artist history</div>'
    +'<button type="button" class="dj-sugg-hd" style="cursor:pointer;text-decoration:underline;background:none;border:0;padding:0;font-family:inherit" onclick="openDjShowHistory(decodeURIComponent(\''+encodeURIComponent(p.name)+'\'))" title="Click to see every booking">'+p.display+' &mdash; '+p.n+' shows on record</button>'
    +'<div class="dj-sugg-row"><span>Avg fee historically paid</span><b>'+$k(p.avg_fee)+'</b></div>'
    +'<div class="dj-sugg-row"><span>Avg BS delivered</span><b>'+$k(p.avg_bs)+'</b></div>'
    +'<div class="dj-sugg-row"><span>Avg ROI achieved</span><b class="kc-b">'+(p.avg_roi_a||'-')+'x</b></div>'
    +'<div class="dj-sugg-row"><span>Beat rate</span><b class="'+(p.beat_rate>=60?'hit':'low')+'">'+p.beat_rate+'%</b></div>'
    +'<div class="dj-sugg-row"><span class="muted">Suggested fee aims for ~50% historical beat vs target</span><b></b></div>'
    +'<button type="button" class="dj-sugg-use" onclick="useSuggestedFee('+fair+')">Use realistic suggested fee: '+$k(fair)+'</button>'
    +'</div>';
}
function _modalBookingEngineBlock(venue, dateStr, fee, name){
  if(!(+fee>100000) || !venue || !dateStr) return '';
  return '<div class="dj-sugg-sec dj-sugg-engine">'
    +'<div class="dj-sugg-sec-hd">Booking Approval Engine</div>'
    +'<div class="dj-sugg-engine-note">Fee is over $100K — generate an ownership-ready investment case with budget, sales, VIP mins, and recommendation.</div>'
    +'<button type="button" class="dj-sugg-use dj-sugg-engine-btn" onclick="openBookingApprovalEngine()">Open Booking Approval Engine</button>'
    +'</div>';
}

/* Live DJ-history lookup for the Add/Edit Show modal — 3 sections: artist, budget, sales */
var _djSuggestTimer=null;
function checkDjSuggestion(){
  /* Debounce: every keystroke was scanning SCHED + DJ_PROFILES and freezing the modal. */
  if(_djSuggestTimer) clearTimeout(_djSuggestTimer);
  _djSuggestTimer=setTimeout(_checkDjSuggestionNow, 120);
}
function _checkDjSuggestionNow(){
  var f=getFields();
  var name=(f.dj.value||'').trim();
  var box=document.getElementById('fldDjSuggest');
  if(!box) return;
  var venue=f.venue.value, dateStr=f.date.value;
  var proposedFee=parseFloat(String(f.fee.value||'').replace(/,/g,''));
  if(!(proposedFee>0)) proposedFee=null;
  var proj=name ? djProj(name,null) : {p:null};
  var feeToAdd = proposedFee || (proj.p?(realisticSuggestedFee(proj.p, venue, dateStr)||cappedSuggestedFee(proj.p.avg_bs,proj.p.avg_fee)):0) || 0;

  if(!name && !(venue && dateStr)){
    box.innerHTML=''; box.style.display='none'; return;
  }

  var artistHtml=_modalArtistBlock(proj, venue, dateStr);
  var budgetHtml=_modalBudgetBlock(venue, dateStr, feeToAdd);
  var salesHtml=_modalSalesBlock(venue, dateStr, feeToAdd, name);
  var engineHtml=_modalBookingEngineBlock(venue, dateStr, feeToAdd, name);

  var html=artistHtml+budgetHtml+salesHtml+engineHtml;
  if(!html){ box.innerHTML=''; box.style.display='none'; return; }
  box.style.display='block';
  box.innerHTML=html;
  box.classList.toggle('dj-sugg-wide', !!(budgetHtml||salesHtml||engineHtml));
}

function buildBookingApprovalCase(){
  var f=getFields();
  var venue=f.venue.value, dateStr=f.date.value;
  var name=(f.dj.value||'').trim()||'TBD';
  var fee=parseFloat(f.fee.value)||0;
  var info=fiscalInfoForDate(dateStr);
  var mm=info.mm, yr=info.year, mi=info.monthIndex;
  var monthBudget=getMonthlyBudget(venue, yr, mm);
  var monthSpend=_modalFiscalSpend(venue, yr, mm, _editIdx);
  var monthAfter=monthSpend+fee;
  var monthVarAfter=monthBudget!=null ? monthBudget-monthAfter : null;
  var salesPlan=getBgtPlan(venue, yr, mm, 'sales');
  var tgt=showTargets({v:venue, venue:venue, d:dateStr, fee:fee, cost:fee});
  var proj=djProj(name, fee);
  var expectedRoi=tgt.roi_t!=null ? tgt.roi_t : (proj.p&&proj.p.avg_roi_a);
  var expectedBs=tgt.bs_m!=null ? +tgt.bs_m : 0;
  /* Sales case: current month BS targets from scheduled shows, then + this DJ */
  var currentBsForecast=SCHED.filter(function(r){
    if(!r||r._s==='empty'||!r.d) return false;
    if((r.v||r.venue)!==venue) return false;
    if(_editIdx!=null && SCHED.indexOf(r)===_editIdx) return false;
    return inFiscalMonthFilter(r, yr, mm);
  }).reduce(function(s,r){
    var t=showTargets(r);
    return s+(t.bs_m||0);
  },0);
  var revisedBsForecast=currentBsForecast+expectedBs;
  var currentSales=salesPlan!=null ? +salesPlan : null;
  var revisedSales=currentSales!=null ? currentSales+expectedBs : (expectedBs||null);
  var marginNow=pctLive(currentSales, monthSpend);
  var marginAfter=pctLive(revisedSales, monthAfter);
  return {
    artist:name, date:dateStr, venue:venue, fee:fee,
    monthLabel:MN_FULL[mi]+' '+yr,
    monthSpend:monthSpend, monthAfter:monthAfter, monthBudget:monthBudget, monthVarAfter:monthVarAfter,
    currentBsForecast:currentBsForecast, revisedBsForecast:revisedBsForecast,
    currentSales:currentSales, revisedSales:revisedSales,
    marginNow:marginNow, marginAfter:marginAfter,
    expectedBs:expectedBs||null, expectedRoi:expectedRoi
  };
}
function closeBookingApprovalEngine(){
  var el=document.getElementById('bookingEngineModal');
  if(el) el.remove();
}
function _bookingEngineVipPricesHtml(venue, dateStr, fee){
  var priced=(typeof calcTierPricesForShow==='function') ? calcTierPricesForShow(venue, dateStr, fee) : null;
  var tiersHtml=(priced&&priced.tiers?priced.tiers:[]).map(function(t){
    var price=t.suggested!=null?t.suggested:t.minimum;
    return '<div class="be-tier-chip" style="--tier-color:'+(t.color||'#ccc')+'">'
      +'<div class="be-tier-name">'+t.name+'</div>'
      +'<div class="be-tier-price">'+(typeof formatFv3dMoney==='function'?formatFv3dMoney(price):$k(price))+'</div>'
      +'<div class="be-tier-meta">'+(t.tables?t.tables.length:0)+' tables</div>'
      +'</div>';
  }).join('');
  if(!tiersHtml) return '<div class="muted">No tier pricing available for this venue.</div>';
  return '<div class="be-3d-tiers be-price-only">'+tiersHtml+'</div>';
}
function openBookingApprovalEngine(){
  closeBookingApprovalEngine();
  var c=buildBookingApprovalCase();
  if(!(c.fee>100000)){ alert('Booking Approval Engine is for fees above $100K.'); return; }
  var vipHtml=_bookingEngineVipPricesHtml(c.venue, c.date, c.fee);
  var under=c.monthVarAfter!=null && c.monthVarAfter>=0;
  var over=c.monthVarAfter!=null && c.monthVarAfter<0;

  function line(l,v,cls){
    return '<div class="be-row"><span>'+l+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+v+'</b></div>';
  }
  var modal=document.createElement('div');
  modal.id='bookingEngineModal';
  modal.className='modal-bg';
  modal.onclick=function(ev){ if(ev.target===modal) closeBookingApprovalEngine(); };
  modal.innerHTML='<div class="modal be-modal" onclick="event.stopPropagation()">'
    +'<div class="modal-hd"><h3>Booking Approval Engine</h3>'
    +'<button class="modal-close" onclick="closeBookingApprovalEngine()">&#10005;</button></div>'
    +'<div class="modal-body be-body">'
    +'<div class="be-hero"><div class="be-artist">'+_escHtml(c.artist)+'</div>'
    +'<div class="be-meta">'+_escHtml(c.venue)+' · '+c.date+' · <b>'+$k(c.fee)+'</b></div></div>'
    +'<div class="be-grid">'
    +'<div class="be-card'+(over?' be-card-over':(under?' be-card-under':''))+'"><div class="be-card-hd">Commitment</div>'
    +line('Current monthly commitment', $k(c.monthSpend))
    +line('Revised commitment', $k(c.monthAfter), over?'neg':(under?'pos':''))
    +line('Monthly budget ('+c.monthLabel+')', c.monthBudget!=null?$k(c.monthBudget):'-')
    +line('Variance after booking', c.monthVarAfter!=null?$kv(c.monthVarAfter):'-', over?'neg':(under?'pos':''))
    +'</div>'
    +'<div class="be-card"><div class="be-card-hd">Sales case</div>'
    +line('Current BS forecast (month)', $k(c.currentBsForecast))
    +line('Revised BS forecast (+ this DJ)', $k(c.revisedBsForecast), 'pos')
    +line('Current sales plan', c.currentSales!=null?$k(c.currentSales):'-')
    +line('Revised sales plan (+ DJ BS tgt)', c.revisedSales!=null?$k(c.revisedSales):'-', 'pos')
    +line('Live E margin now (fees/sales)', c.marginNow!=null?(c.marginNow+'%'):'-')
    +line('Live E margin after', c.marginAfter!=null?(c.marginAfter+'%'):'-')
    +line('Expected ROI', c.expectedRoi!=null?(Number(c.expectedRoi).toFixed(1)+'x'):'-')
    +line('This DJ BS target', c.expectedBs!=null?$k(c.expectedBs):'-')
    +'</div></div>'
    +'<div class="be-card"><div class="be-card-hd">VIP table pricing</div>'
    +vipHtml+'</div>'
    +'</div>'
    +'<div class="modal-foot"><button type="button" class="btn-pdf" onclick="window.print()">Print / PDF</button>'
    +'<button type="button" class="btn-cancel" onclick="closeBookingApprovalEngine()">Close</button></div>'
    +'</div>';
  document.body.appendChild(modal);
}

function closeDjShowHistory(){
  var el=document.getElementById('djHistModal');
  if(el) el.remove();
}
function openDjShowHistory(name){
  closeDjShowHistory();
  if(!name) return;
  var q=String(name).replace(/\?+/g,'').trim().toUpperCase();
  var rows=SCHED.filter(function(r){
    if(!r||r._s==='empty'||!r.dj||r.roi_a==null||!r.bs_a) return false;
    var nm=String(r.dj).replace(/\?+/g,'').trim().toUpperCase();
    return nm===q;
  }).sort(function(a,b){ return a.d<b.d?1:-1; });
  var rowsHtml=rows.map(function(r){
    var tgt=(typeof showTargets==='function')?showTargets(r):{bs_m:r.bs_m,roi_t:r.roi_t};
    var bsM=tgt.bs_m, roiT=tgt.roi_t, fee=r.fee||r.cost;
    var tone=(typeof perfTone==='function')?perfTone(r.bs_a,bsM,fee,r.roi_a,roiT):'';
    var dt=new Date(r.d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'short',day:'numeric'});
    var st=r._s==='beat'?'Beat':r._s==='miss'?'Miss':r._s==='fut'?'Upcoming':'?';
    return '<tr>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);white-space:nowrap;color:var(--ink3)">'+dt+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair)">'+(r.v||r.venue||'')+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right">'+$k(fee)+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right">'+$k(bsM)+'</td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right"'+(tone?' class="'+tone+'"':'')+'><b>'+$k(r.bs_a)+'</b></td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:right"'+(tone?' class="'+tone+'"':'')+'><b>'+rx(r.roi_a)+'</b></td>'
      +'<td style="padding:7px 8px;border-bottom:0.5px solid var(--hair);text-align:center"><span class="pill '+(r._s==='beat'?'p-beat':r._s==='miss'?'p-miss':'p-nd')+'">'+st+'</span></td>'
      +'</tr>';
  }).join('') || '<tr><td colspan="7" style="padding:16px;color:var(--ink3)">No shows found</td></tr>';

  var modal=document.createElement('div');
  modal.id='djHistModal';
  modal.className='modal-bg';
  modal.onclick=function(ev){ if(ev.target===modal) closeDjShowHistory(); };
  modal.innerHTML='<div class="modal" style="width:min(700px,96vw)" onclick="event.stopPropagation()">'
    +'<div class="modal-hd"><h3>'+name+' &middot; '+rows.length+' show'+(rows.length===1?'':'s')+' on record</h3>'
    +'<button class="modal-close" onclick="closeDjShowHistory()">&#10005;</button></div>'
    +'<div class="modal-body" style="gap:12px">'
    +'<div style="overflow:auto;max-height:60vh;border:0.5px solid var(--hair);border-radius:10px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'
    +'<th style="text-align:left;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Date</th>'
    +'<th style="text-align:left;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Venue</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Fee</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Target</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Actual</th>'
    +'<th style="text-align:right;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">ROI</th>'
    +'<th style="text-align:center;padding:8px;background:var(--card3);font-size:9px;color:var(--ink3)">Status</th>'
    +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'
    +'</div>'
    +'<div class="modal-foot"><button type="button" class="btn-pdf" onclick="closeDjShowHistory()">Close</button></div>'
    +'</div>';
  document.body.appendChild(modal);
}
function editVipNote(idx){
  var r=SCHED[idx]; if(!r) return;
  var cur=(r.vipNote||'');
  var next=prompt('VIP note:', cur);
  if(next===null) return;
  r.vipNote=next.trim()||null;
  /* VIP only — never full persistSchedShow (that could rewrite fee/DJ from stale local). */
  if(typeof persistShowVipNoteOnly==='function') persistShowVipNoteOnly(r);
  if(typeof clearPyMapCache==='function') clearPyMapCache();
  go();
}
function useSuggestedFee(fee){
  var f=getFields();
  f.fee.value=fee;
  updateFeeTargetsPreview();
  checkDjSuggestion();
}
function updateFeeTargetsPreview(){
  var box=document.getElementById('fldFeeTargets');
  var bsEl=document.getElementById('fldFeeBsTgt');
  var roiEl=document.getElementById('fldFeeRoiTgt');
  var vipEl=document.getElementById('fldVipMinimums');
  if(!box||!bsEl||!roiEl) return;
  var f=getFields();
  var fee=parseFloat(f.fee.value)||0;
  var venue=f.venue.value, dateStr=f.date.value;
  if(!fee || !venue || !dateStr){
    box.style.display='none';
    if(vipEl) vipEl.style.display='none';
    return;
  }
  var tgt=showTargets({v:venue, venue:venue, d:dateStr, fee:fee, cost:fee});
  box.style.display='block';
  bsEl.textContent = tgt.bs_m!=null ? $k(tgt.bs_m) : '?';
  roiEl.textContent = tgt.roi_t!=null ? (Number(tgt.roi_t).toFixed(1)+'x') : '?';
  if(f.bsm) f.bsm.value = tgt.bs_m!=null ? tgt.bs_m : '';
  if(f.roit) f.roit.value = tgt.roi_t!=null ? tgt.roi_t : '';
  renderVipMinimumGuidance(venue,tgt.bs_m,vipEl);
}
function renderVipMinimumGuidance(venue,bsTarget,box){
  if(!box) return;
  var dateStr=(typeof getFields==='function'&&getFields().date)?getFields().date.value:'';
  var fp=(typeof getVipFloorPlan==='function')
    ? getVipFloorPlan(venue, dateStr)
    : ((typeof _vipFloorPlan!=='undefined'&&_vipFloorPlan)?_vipFloorPlan[venue]:null);
  var tiers=fp&&fp.tiers?Object.keys(fp.tiers):[];
  if(!bsTarget){
    box.style.display='none';
    return;
  }
  var totalTables=0, baseRevenue=0;
  tiers.forEach(function(name){
    var t=fp.tiers[name]||{};
    var count=+t.total||0, min=+t.min||0;
    totalTables+=count; baseRevenue+=count*min;
  });
  var averageMin=totalTables?Math.ceil((+bsTarget/totalTables)/250)*250:null;
  var scale=baseRevenue>0?(+bsTarget/baseRevenue):0;
  var tierHtml=tiers.map(function(name){
    var t=fp.tiers[name]||{}, count=+t.total||0, current=+t.min||0;
    var suggested=current&&scale?Math.ceil((current*scale)/250)*250:averageMin;
    if(!count||!suggested) return '';
    return '<div style="padding:6px 8px;background:#fff;border-radius:7px;border:0.5px solid #d8cbed">'
      +'<div style="font-size:8px;font-weight:800;text-transform:uppercase;color:var(--ink3)">'+name+' &middot; '+count+' tables</div>'
      +'<div style="font-size:14px;font-weight:900;color:#5b368c">'+$kv(suggested)+' min</div></div>';
  }).join('');
  box.style.display='block';
  box.innerHTML='<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#5b368c">VIP table minimums to reach DJ ROI'
    +(fp&&fp.summer?' <span style="color:#0f766e;font-weight:700">(summer rooftop)</span>':'')+'</div>'
    +'<div style="font-size:10px;color:var(--ink2);margin:3px 0 7px">VIP must deliver <b>'+$k(bsTarget)+'</b> in bottle service.'
    +(totalTables?' Across '+totalTables+' sellable tables, the blended minimum is <b>'+$kv(averageMin)+'</b> per table.':'')+'</div>'
    +(tierHtml?'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px">'+tierHtml+'</div>'
      :'<div style="font-size:10px;color:var(--ink3)">Floor-plan table counts are not available for this venue yet.</div>');
}
function closeModal(opts){
  document.getElementById('evModal').classList.add('hidden');
  /* Save/delete already paint — skip flush so we don't double go()/renderCal. */
  if(opts && opts.skipFlush){
    window._calPendingRefresh=false;
    return;
  }
  if(typeof _calFlushPendingRefresh==='function'){
    try{ setTimeout(_calFlushPendingRefresh, 0); }catch(e){}
  }
}

/* Firebase RTDB .set()/.update() throw if any property is undefined — that aborted
   saveEvent before go()/renderCal, so SCHED had the new DJ but the calendar still
   showed the old name until a later status change re-rendered. */
function _fbSanitize(val){
  if(val===undefined) return null;
  if(val===null || typeof val!=='object') return val;
  if(Array.isArray(val)) return val.map(_fbSanitize);
  var out={};
  Object.keys(val).forEach(function(k){
    var v=val[k];
    if(v===undefined) return;
    out[k]=_fbSanitize(v);
  });
  return out;
}

function _alignRecToBakedShow(rec){
  if(!rec || !rec.d) return false;
  var venue=rec.v||rec.venue||'';
  ensureShowUid(rec);
  if(!window._bakedUidIndex){
    window._bakedUidIndex={};
    (SCHED_BAKED||[]).forEach(function(r){
      if(!r) return;
      window._bakedUidIndex[ensureShowUid(r)]=r;
    });
  }
  function bakeDeleted(bakeUid){
    if(typeof window._bakeUidIsDeleted==='function'){
      return window._bakeUidIsDeleted(bakeUid, venue, rec.d);
    }
    if(window._schedDeletedUids && window._schedDeletedUids[bakeUid]) return true;
    var nk=venue+'|'+rec.d;
    if(window._schedClearedNights && window._schedClearedNights[nk] &&
       window._schedClearedNights[nk].uid===bakeUid) return true;
    try{
      var dels=window._lastSchedDeletes||[];
      for(var i=0;i<dels.length;i++){
        var p=String(dels[i]||'').split('|');
        if(p.length>=3 && p[2]===bakeUid) return true;
      }
    }catch(e){}
    return false;
  }
  if(window._bakedUidIndex[rec._uid]){
    if(bakeDeleted(rec._uid)) return false;
    rec._added=0;
    return true;
  }
  var hits=SCHED_BAKED.filter(function(r){
    return r && (r.v||r.venue)===venue && r.d===rec.d;
  });
  if(hits.length!==1) return false;
  /* One-show-per-night: fold shadow adds onto the baked uid ONLY if that bake
     was not deleted. Otherwise the add must stay an add (AMOG after DARMON delete). */
  var bakeUid=ensureShowUid(hits[0]);
  if(bakeDeleted(bakeUid)) return false;
  if(rec._added && bakeDeleted(bakeUid)) return false;
  rec._uid=bakeUid;
  rec._added=0;
  return true;
}
function _fbOnSchedWrite(err){
  if(!err) return;
  console.error('Firebase schedule write failed', err);
  try{
    var el=document.getElementById('fbSyncDot');
    if(el){ el.style.background='#ef4444'; el.title='Schedule write denied — check Firebase rules'; }
  }catch(eDot){}
}
/* ONE workbook: rdg/schedOverrides/shows/{uid} is the only live record.
   Save overwrites that node and erases leftover copies for the same show. */
function _fbEraseLegacyCopies(rec){
  if(!rec||!window._fbRef) return;
  var uid=ensureShowUid(rec);
  var uidKey=_schedUidKey(rec).replace(/\//g,'_');
  var dateKey=_schedDateKey(rec).replace(/\//g,'_');
  try{ window._fbRef.child('schedOverrides/addsByUid/'+uid).remove(); }catch(e1){}
  try{ window._fbRef.child('schedOverrides/editsByUid/'+uid).remove(); }catch(e2){}
  try{ window._fbRef.child('schedOverrides/edits/'+uidKey).remove(); }catch(e3){}
  try{ window._fbRef.child('schedOverrides/edits/'+dateKey).remove(); }catch(e4){}
}
function _fbEraseNightCopies(venue, dateStr, keepUid){
  if(!window._fbRef||!venue||!dateStr) return;
  function scrub(path){
    window._fbRef.child(path).once('value', function(snap){
      var map=snap.val()||{};
      Object.keys(map).forEach(function(k){
        var row=map[k];
        if(!row||typeof row!=='object') return;
        if(keepUid && (k===keepUid || row._uid===keepUid)) return;
        if(row.d===dateStr && (row.v||row.venue||'')===venue){
          try{ window._fbRef.child(path+'/'+k).remove(); }catch(e){}
        }
      });
    });
  }
  scrub('schedOverrides/addsByUid');
  scrub('schedOverrides/editsByUid');
  window._fbRef.child('schedOverrides/edits').once('value', function(snap){
    var map=snap.val()||{};
    Object.keys(map).forEach(function(k){
      var row=map[k];
      var parts=String(k).split('|');
      var hit=(parts[0]===venue && parts[1]===dateStr) ||
        (row && row.d===dateStr && (row.v||row.venue||'')===venue);
      if(hit && !(keepUid && (parts[2]===keepUid || (row&&row._uid===keepUid)))){
        try{ window._fbRef.child('schedOverrides/edits/'+k).remove(); }catch(e){}
      }
    });
  });
  window._fbRef.child('schedOverrides/adds').transaction(function(vals){
    if(!vals) return vals;
    var arr=Array.isArray(vals)?vals:Object.values(vals);
    var next=arr.filter(function(r){
      if(!r||!r.d) return false;
      if(r.d===dateStr && (r.v||r.venue||'')===venue) return false;
      return true;
    });
    return next.length?next:null;
  });
}
function _fbRemoveSchedRecord(rec){
  if(!rec||!window._fbRef) return;
  ensureShowUid(rec);
  var uid=rec._uid;
  var venue=rec.v||rec.venue||'';
  var dateStr=rec.d||'';
  var uidKey=_schedUidKey(rec);
  if(typeof window._guardClearDeleted==='function') window._guardClearDeleted(rec);
  function _tombstone(keys){
    window._fbRef.child('schedOverrides/deletes').transaction(function(vals){
      var arr=vals?(Array.isArray(vals)?vals:Object.values(vals)):[];
      keys.forEach(function(k){ if(k && arr.indexOf(k)<0) arr.push(k); });
      return arr.filter(function(k){ return k && String(k).split('|').length >= 3; });
    });
  }
  _tombstone([uidKey]);
  window._fbRef.child('schedOverrides/shows').transaction(function(map){
    if(!map || typeof map!=='object') return map;
    Object.keys(map).forEach(function(id){
      var row=map[id];
      if(id===uid){ delete map[id]; return; }
      if(row && row.d===dateStr && (row.v||row.venue||'')===venue) delete map[id];
    });
    return Object.keys(map).length?map:null;
  }, function(){
    var extra=[uidKey];
    _tombstone(extra);
  });
  _fbEraseLegacyCopies(rec);
  _fbEraseNightCopies(venue, dateStr, null);
}
function _fbDropOtherShowsOnNight(rec){
  if(!rec||!window._fbRef||!rec.d) return;
  var uid=ensureShowUid(rec);
  var venue=rec.v||rec.venue||'';
  window._fbRef.child('schedOverrides/shows').once('value', function(snap){
    var map=snap.val()||{};
    Object.keys(map).forEach(function(other){
      if(other===uid) return;
      var row=map[other];
      if(!row||row.d!==rec.d) return;
      if((row.v||row.venue||'')!==venue) return;
      try{ window._fbRef.child('schedOverrides/shows/'+other).remove(); }catch(e){}
    });
  });
}
function persistSchedShow(rec){
  applyShowTargets(rec);
  if(rec && rec.ev==null) rec.ev='';
  ensureShowUid(rec);
  if(!rec._writeKind) rec._writeKind='modal';
  var wasAdded=!!rec._added;
  var isBaked=_alignRecToBakedShow(rec);
  if(wasAdded && !isBaked){ rec._added=1; }
  if(typeof window._guardSchedWrite==='function') window._guardSchedWrite(rec);
  if(!window._fbRef) return;
  var uid=ensureShowUid(rec);
  var fbKey=_schedUidKey(rec);
  if(!isBaked) rec._added=1;
  else rec._added=0;
  var payload=_fbSanitize(rec);
  payload.updatedAt=new Date().toISOString();
  payload._writeKind='modal';
  payload._uid=uid;
  payload.d=rec.d;
  payload.v=rec.v||rec.venue||'';
  payload.venue=rec.venue||rec.v||'';
  payload.dj=rec.dj||'';
  payload.fee=rec.fee!=null?rec.fee:null;
  payload.cost=rec.cost!=null?rec.cost:(rec.fee!=null?rec.fee:null);
  payload._added=isBaked?0:1;
  try{
    window._fbRef.child('schedOverrides/deletes').transaction(function(vals){
      if(!vals) return vals;
      var arr=Array.isArray(vals)?vals:Object.values(vals);
      var next=arr.filter(function(k){
        if(!k) return false;
        var p=String(k).split('|');
        if(p.length < 3) return false;
        if(k===fbKey) return false;
        if(p[2]===uid) return false;
        return true;
      });
      return next.length?next:null;
    });
  }catch(eDel){}
  window._fbRef.child('schedOverrides/shows').transaction(function(map){
    if(!map || typeof map!=='object') map={};
    var venue=payload.v||payload.venue||'';
    Object.keys(map).forEach(function(other){
      if(other===uid) return;
      var row=map[other];
      if(!row||row.d!==payload.d) return;
      if((row.v||row.venue||'')!==venue) return;
      delete map[other];
    });
    var prev=map[uid];
    if(prev && typeof prev==='object'){
      var prevAt=prev.updatedAt?Date.parse(prev.updatedAt):0;
      var newAt=payload.updatedAt?Date.parse(payload.updatedAt):0;
      /* Edit Show must not wipe status / agency / VIP that live only on the remote row. */
      if(payload.djStatus==null && prev.djStatus!=null) payload.djStatus=prev.djStatus;
      if(payload.agency==null && prev.agency!=null) payload.agency=prev.agency;
      if(payload.vipNote==null && prev.vipNote!=null) payload.vipNote=prev.vipNote;
      if(prevAt && newAt && prevAt>newAt){
        if(prev.djStatus!=null) payload.djStatus=prev.djStatus;
        if(prev.agency!=null) payload.agency=prev.agency;
        if(prev.vipNote!=null) payload.vipNote=prev.vipNote;
      }
    }
    map[uid]=payload;
    return map;
  }, _fbOnSchedWrite);
  _fbEraseLegacyCopies(rec);
  _fbEraseNightCopies(payload.v||payload.venue||'', rec.d, uid);
}
/* DJ Status only — write djStatus on this show's uid path ONLY.
   Never bundle DJ name / fee (that made status look like it changed price).
   If no Firebase node exists yet, seed date + venue + status only — use Edit Show
   to persist DJ name and fee. Never touch other nights. */
function persistShowDjStatusOnly(rec){
  if(!rec||!rec.d) return;
  ensureShowUid(rec);
  if(!window._fbRef) return;
  _alignRecToBakedShow(rec);
  var uid=ensureShowUid(rec);
  var nextStatus=rec.djStatus==null ? null : rec.djStatus;
  if(typeof window._guardSchedWrite==='function'){
    window._guardSchedWrite({
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: uid,
      djStatus: nextStatus,
      _writeKind: 'statusMerge'
    });
  }
  var isBaked=_alignRecToBakedShow(rec);
  if(!isBaked) rec._added=1;
  window._fbRef.child('schedOverrides/shows').transaction(function(map){
    if(!map || typeof map!=='object') map={};
    var cur=map[uid];
    if(cur && typeof cur==='object'){
      var next=Object.assign({}, cur);
      next.djStatus=nextStatus;
      next.updatedAt=new Date().toISOString();
      /* Keep modal/evClear — downgrading to statusMerge hid saved fee/DJ on reload. */
      if(cur._writeKind!=='modal' && cur._writeKind!=='evClear'){
        next._writeKind='statusMerge';
      }
      map[uid]=next;
      return map;
    }
    map[uid]=_fbSanitize({
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: uid,
      djStatus: nextStatus,
      _writeKind: 'statusMerge',
      _added: isBaked?0:1,
      updatedAt:new Date().toISOString()
    });
    return map;
  }, _fbOnSchedWrite);
}
/* VIP note only — never bundle DJ name / fee. */
function persistShowVipNoteOnly(rec){
  if(!rec||!rec.d) return;
  ensureShowUid(rec);
  if(!window._fbRef) return;
  _alignRecToBakedShow(rec);
  var uid=ensureShowUid(rec);
  var nextVip=rec.vipNote==null ? null : rec.vipNote;
  if(typeof window._guardSchedWrite==='function'){
    window._guardSchedWrite({
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: uid,
      vipNote: nextVip,
      _writeKind: 'vipNote'
    });
  }
  var isBaked=_alignRecToBakedShow(rec);
  if(!isBaked) rec._added=1;
  window._fbRef.child('schedOverrides/shows').transaction(function(map){
    if(!map || typeof map!=='object') map={};
    var cur=map[uid];
    if(cur && typeof cur==='object'){
      var next=Object.assign({}, cur);
      next.vipNote=nextVip;
      next.updatedAt=new Date().toISOString();
      if(cur._writeKind!=='modal' && cur._writeKind!=='evClear'){
        next._writeKind='vipNote';
      }
      map[uid]=next;
      return map;
    }
    map[uid]=_fbSanitize({
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: uid,
      vipNote: nextVip,
      _writeKind: 'vipNote',
      _added: isBaked?0:1,
      updatedAt:new Date().toISOString()
    });
    return map;
  }, _fbOnSchedWrite);
}
/* Agency only — never bundle DJ name / fee. */
function persistShowAgencyOnly(rec){
  if(!rec||!rec.d) return;
  ensureShowUid(rec);
  if(!window._fbRef) return;
  _alignRecToBakedShow(rec);
  var uid=ensureShowUid(rec);
  var nextAgency=rec.agency==null ? null : rec.agency;
  if(typeof window._guardSchedWrite==='function'){
    window._guardSchedWrite({
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: uid,
      agency: nextAgency,
      _writeKind: 'agency'
    });
  }
  var isBaked=_alignRecToBakedShow(rec);
  if(!isBaked) rec._added=1;
  window._fbRef.child('schedOverrides/shows').transaction(function(map){
    if(!map || typeof map!=='object') map={};
    var cur=map[uid];
    if(cur && typeof cur==='object'){
      var next=Object.assign({}, cur);
      next.agency=nextAgency;
      next.updatedAt=new Date().toISOString();
      if(cur._writeKind!=='modal' && cur._writeKind!=='evClear'){
        next._writeKind='agency';
      }
      map[uid]=next;
      return map;
    }
    map[uid]=_fbSanitize({
      d: rec.d,
      v: rec.v||rec.venue||'',
      venue: rec.venue||rec.v||'',
      _uid: uid,
      agency: nextAgency,
      _writeKind: 'agency',
      _added: isBaked?0:1,
      updatedAt:new Date().toISOString()
    });
    return map;
  }, _fbOnSchedWrite);
}
function _findSchedByUidOrIdx(uid, idx){
  if(uid){
    for(var i=0;i<SCHED.length;i++){
      if(SCHED[i] && ensureShowUid(SCHED[i])===String(uid)) return SCHED[i];
    }
    /* UID was provided but not found — do NOT fall back to idx (stale idx
       after re-render was writing status onto the previous night's show). */
    return null;
  }
  if(idx!=null && idx>=0 && idx<SCHED.length) return SCHED[idx];
  return null;
}
function _schedRecordKey(rec){ return _schedUidKey(rec); }
function _isBakedSchedRecord(rec){
  if(!rec) return false;
  ensureShowUid(rec);
  if(!window._bakedUidIndex){
    window._bakedUidIndex={};
    (SCHED_BAKED||[]).forEach(function(r){
      if(!r) return;
      window._bakedUidIndex[ensureShowUid(r)]=r;
    });
  }
  if(window._bakedUidIndex[rec._uid]) return true;
  if(rec._added) return false;
  var venue=rec.v||rec.venue||'';
  var hits=SCHED_BAKED.filter(function(r){ return r && (r.v||r.venue)===venue && r.d===rec.d; });
  return hits.length===1;
}
function _fbClearEditKeys(rec){
  if(!rec||!window._fbRef) return;
  ensureShowUid(rec);
  _fbEraseLegacyCopies(rec);
  try{ window._fbRef.child('schedOverrides/shows/'+rec._uid).remove(); }catch(e){}
}
function _fbRestoreSchedRecord(rec){
  if(!rec||!window._fbRef) return;
  ensureShowUid(rec);
  var uidKey=_schedUidKey(rec);
  if(typeof window._guardUndelete==='function') window._guardUndelete(rec);
  if(_isBakedSchedRecord(rec)){
    window._fbRef.child('schedOverrides/deletes').transaction(function(vals){
      if(!vals) return vals;
      var arr=Array.isArray(vals)?vals:Object.values(vals);
      var next=arr.filter(function(k){return k!==uidKey && k!==_schedDateKey(rec);});
      return next.length?next:null;
    });
    persistSchedShow(rec);
  }else{
    persistSchedShow(rec);
  }
}
function _undoShowChange(before,after,beforeIndex){
  if(after) ensureShowUid(after);
  for(var i=SCHED.length-1;i>=0;i--){
    var r=SCHED[i];
    if(after && (r._uid===after._uid || _schedKeysMatch(r,after))) SCHED.splice(i,1);
  }
  if(after) _fbRemoveSchedRecord(after);
  if(before){
    ensureShowUid(before);
    var idx=Math.max(0,Math.min(beforeIndex==null?SCHED.length:beforeIndex,SCHED.length));
    SCHED.splice(idx,0,_clone(before));
    _fbRestoreSchedRecord(before);
  }
  IDX=buildIdx(SCHED);
  if(typeof clearPyMapCache==='function') clearPyMapCache();
}

function saveEvent(){
  var f=getFields();
  var v=f.venue.value, d=f.date.value, dj=fixKnownAccents((f.dj.value||'').trim());
  var fee=parseFloat(f.fee.value)||null;
  var ev=(f.ev.value||'').trim();
  var tbd=0; /* TBD/unconfirmed checkbox removed */
  if(!d){alert('Date required');return;}
  var yr=fiscalYearForDate(d);
  /* Re-resolve the show by uid — Firebase may have rebuilt SCHED while the modal was open,
     so a stale _editIdx would write the rename onto another night (calendar kept old name). */
  if(_editUid){
    var resolved=-1;
    for(var ri=0;ri<SCHED.length;ri++){
      if(SCHED[ri] && ensureShowUid(SCHED[ri])===String(_editUid)){ resolved=ri; break; }
    }
    if(resolved>=0){
      _editIdx=resolved;
    } else if(_editIdx>=0){
      /* Refuse stale index writes — better to abort than corrupt the previous night. */
      alert('This show refreshed while the editor was open. Please close and edit it again.');
      return;
    }
  }
  /* Hard rule: never create a second show on an occupied venue|date.
     Heavily edited nights previously got bake + addsByUid as two rows. */
  if(_editIdx<0){
    var occupiedIdx=-1;
    for(var oi=0;oi<SCHED.length;oi++){
      var ox=SCHED[oi];
      if(!ox||ox._s==='empty'||!ox.d) continue;
      if(ox.d===d && (ox.v||ox.venue)===v){ occupiedIdx=oi; break; }
    }
    if(occupiedIdx>=0){
      _editIdx=occupiedIdx;
      _editUid=ensureShowUid(SCHED[occupiedIdx]);
    }
  }
  /* auto-populate BS target and ROI target   venue-specific rules first, generic tier fallback */
  var tmp={v:v,d:d,fee:fee,cost:fee};
  var tgt=showTargets(tmp);
  var bsm=tgt.bs_m;
  var roit=tgt.roi_t;
  var past=d<=TODAY;
  var _s=(!dj&&!fee)?'empty':(tbd?'tbd':(past?'nd':'fut'));
  var note=(f.note.value||'').trim()||null;
  var beforeIndex=_editIdx;
  var before=_editIdx>=0?_clone(SCHED[_editIdx]):null;
  var rec={v:v,venue:v,yr:yr,d:d,dj:dj,fee:fee,cost:fee,bs_m:bsm,bs_a:null,
           roi_t:roit,roi_a:null,beat:null,ev:ev,tbd:tbd,_s:_s,note:note,
           djStatus:null};
  var pyAtt=resolvePyFields(v,d,null);
  rec.py_dj=pyAtt.py_dj; rec.py_fee=pyAtt.py_fee; rec.py_bs_m=pyAtt.py_bs_m;
  rec.py_bs_a=pyAtt.py_bs_a; rec.py_roi_t=pyAtt.py_roi_t; rec.py_roi_a=pyAtt.py_roi_a; rec.py_beat=pyAtt.py_beat;
  /* preserve existing bs_a/roi_a/beat when editing an already-performed show */
  if(_editIdx>=0){
    var prev=SCHED[_editIdx];
    if(prev){
      rec.bs_a=prev.bs_a; rec.roi_a=prev.roi_a; rec.beat=prev.beat;
      rec.vipNote=prev.vipNote||null;
      if(prev._uid) rec._uid=prev._uid;
      else if(_editUid) rec._uid=_editUid;
      if(prev._added) rec._added=prev._added;
      if(prev.bs_a&&prev._s!=='fut'&&prev._s!=='tbd') rec._s=prev._s;
      /* Keep status / agency / VIP on rename/fee edits — Edit Show owns identity only. */
      if(Object.prototype.hasOwnProperty.call(prev,'djStatus')) rec.djStatus=prev.djStatus;
      if(Object.prototype.hasOwnProperty.call(prev,'agency')) rec.agency=prev.agency;
      if(Object.prototype.hasOwnProperty.call(prev,'vipNote')) rec.vipNote=prev.vipNote;
    }
  } else {
    rec._added=1;
    rec.djStatus=null;
  }
  if(_editUid && !rec._uid) rec._uid=_editUid;
  ensureShowUid(rec);
  rec._writeKind='modal';
  /* Normalize undefined → null so Firebase writes and in-memory state stay clean. */
  Object.keys(rec).forEach(function(k){ if(rec[k]===undefined) rec[k]=null; });
  if(_editIdx>=0){
    /* Mutate in place so the same object the calendar already holds updates immediately. */
    var live=SCHED[_editIdx];
    Object.keys(live).forEach(function(k){ delete live[k]; });
    Object.assign(live, rec);
    rec=live;
  } else {
    SCHED.push(rec);
  }
  IDX=buildIdx(SCHED); closeModal({skipFlush:true});
  if(typeof syncLinkedTabsFromSched==='function') syncLinkedTabsFromSched(rec);
  /* If date/venue changed, retire old Firebase keys so the show does not ghost on reload. */
  if(before && _schedDateKey(before)!==_schedDateKey(rec)){
    if(before._added || !_isBakedSchedRecord(before)){
      _fbRemoveSchedRecord(before);
    } else {
      _fbClearEditKeys(before);
    }
  }
  /* Paint FIRST from local SCHED + guard, then persist. Firebase's local echo of
     .set() is synchronous and used to rebuild SCHED before go() ran — leaving the
     old DJ name on screen until a later status change re-rendered. */
  if(typeof window._guardSchedWrite==='function') window._guardSchedWrite(rec);
  go();
  if(curView==='calendar') renderCal();
  try{
    persistSchedShow(rec);
  }catch(ePersist){
    try{ console.warn('persistSchedShow failed', ePersist); }catch(e2){}
  }
  if(typeof window._applySchedGuardsToLiveSched==='function') window._applySchedGuardsToLiveSched();
  _editUid='';
  /* One paint is enough — a second go()/renderCal here plus the Firebase echo
     was freezing the app after Save (esp. on bake nights like MILA Aug 29). */
  if(curView==='accounting') renderAccounting();
  if(curView==='budget'&&_budgetInited) renderBudget();
  if(curView==='vip') renderVIP();
  if(curView==='forecast') renderForecast();
}
function deleteEvent(){
  /* Resolve by uid first — same stale-index protection as save. */
  if(_editUid){
    var resolved=-1;
    for(var ri=0;ri<SCHED.length;ri++){
      if(SCHED[ri] && ensureShowUid(SCHED[ri])===String(_editUid)){ resolved=ri; break; }
    }
    if(resolved>=0) _editIdx=resolved;
  }
  if(_editIdx<0 || _editIdx>=SCHED.length) return;
  var show = SCHED[_editIdx];
  if(!show) return;
  var label = (show.dj||'this performance') + ' on ' + (show.d||'');
  if(!confirm('Delete ' + label + '?\n\nThis removes it for everyone.')) return;
  if(typeof window._guardClearDeleted==='function') window._guardClearDeleted(show);
  if(window._fbRef) _fbRemoveSchedRecord(show);
  SCHED.splice(_editIdx,1);
  _editIdx=-1; _editUid='';
  IDX=buildIdx(SCHED);
  closeModal({skipFlush:true});
  go();
  if(curView==='calendar') renderCal();
  if(curView==='accounting') renderAccounting();
  if(curView==='budget'&&_budgetInited) renderBudget();
}

/*                                                               
   SPECIAL WEEK
                                                                  */
/* ?? Special Week management ?? */
var _swEditKey   = null;
var _swEditLabel = null;
var _swEditSrc   = null;
var _swEditCluster = null;

function _swNorm(label){ return String(label==null?'':label).trim().toUpperCase(); }

/* Firebase merges overrides onto the baked schedule, so a cleared tag must be
   stored as '' - deleting the key lets the baked event name reappear on reload. */
function _persistShowEv(rec){
  if(!window._fbRef || !rec || !rec.d) return;
  ensureShowUid(rec);
  if(typeof _alignRecToBakedShow==='function') _alignRecToBakedShow(rec);
  var evVal=rec.ev==null?'':rec.ev;
  try{ window._fbRef.child('schedOverrides/shows/'+rec._uid+'/ev').set(evVal); }catch(e){}
  if(!evVal){
    try{ persistSchedShow(Object.assign({}, rec, {ev:'', _writeKind:'evClear'})); }catch(eFull){}
  }
}

function _swUseRecords(){ return !!window._swRecordsMigrated; }
function _swMetaKey(k){ return k==='_migrated' || k==='migratedAt'; }
function _swNewUid(){ return 'sw_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
function _rebuildSpecialWeeksFromRecords(){
  if(typeof window._expandSwRecordsToMap!=='function') return;
  specialWeeks=window._expandSwRecordsToMap(window._swRecords||{});
}
function persistSwRecord(rec){
  if(!rec || !rec.v || !rec.label || !rec.start || !rec.end) return null;
  rec._uid=rec._uid || _swNewUid();
  rec.updatedAt=new Date().toISOString();
  window._swRecords=window._swRecords||{};
  window._swRecords[rec._uid]={ _uid:rec._uid, v:rec.v, label:rec.label, start:rec.start, end:rec.end, updatedAt:rec.updatedAt };
  if(_swUseRecords()) _rebuildSpecialWeeksFromRecords();
  if(!window._fbRef) return rec._uid;
  try{ window._fbRef.child('specialWeekRecords/_migrated').set(true); }catch(e0){}
  try{
    window._fbRef.child('specialWeekRecords/'+rec._uid).set({
      v:rec.v, label:rec.label, start:rec.start, end:rec.end, updatedAt:rec.updatedAt
    });
  }catch(e1){}
  return rec._uid;
}
function removeSwRecord(uid){
  if(!uid) return;
  if(window._swRecords) delete window._swRecords[uid];
  if(_swUseRecords()) _rebuildSpecialWeeksFromRecords();
  if(window._fbRef){
    try{ window._fbRef.child('specialWeekRecords/'+uid).remove(); }catch(e){}
  }
}
function _swFindUid(venue, label, start, end){
  var norm=_swNorm(label), hit=null, hitSpan=1e9;
  Object.keys(window._swRecords||{}).forEach(function(uid){
    if(_swMetaKey(uid)) return;
    var r=window._swRecords[uid];
    if(!r || r.v!==venue || _swNorm(r.label)!==norm) return;
    if(start && end && (r.end<start || r.start>end)) return;
    var span=String(r.end||'').localeCompare(String(r.start||''));
    if(start && r.start<=start && r.end>=start){ hit=uid; hitSpan=-1; return; }
    if(hitSpan>=0){ hit=uid; }
  });
  return hit;
}
function _swUidsForLabel(venue, label){
  var norm=_swNorm(label), out=[];
  Object.keys(window._swRecords||{}).forEach(function(uid){
    if(_swMetaKey(uid)) return;
    var r=window._swRecords[uid];
    if(r && r.v===venue && _swNorm(r.label)===norm) out.push(uid);
  });
  return out;
}
function _saveSpecialWeeksTree(){
  if(_swUseRecords()) return;
  if(window._fbSave) window._fbSave('specialWeeks', specialWeeks);
}

function _dedupeSpecialWeeks(){
  var changed=false;
  Object.keys(specialWeeks).forEach(function(k){
    var seen={}, kept=[];
    (specialWeeks[k]||[]).forEach(function(sw){
      var sig=_swNorm(sw.label)+'|'+sw.startDay+'|'+sw.endDay;
      if(seen[sig]){ changed=true; return; }
      seen[sig]=1; kept.push(sw);
    });
    if(!kept.length){ delete specialWeeks[k]; changed=true; }
    else specialWeeks[k]=kept;
  });
  if(changed) _saveSpecialWeeksTree();
  return changed;
}

/* One row per period: calendar bands and schedule tags for the same name merge together. */
function _swGroups(){
  var groups={};
  function bucket(label){
    var norm=_swNorm(label);
    if(!groups[norm]) groups[norm]={ label:String(label||'').trim(), norm:norm, bands:[], dates:[] };
    return groups[norm];
  }
  Object.keys(specialWeeks).forEach(function(k){
    if(k.indexOf(curV+'|')!==0) return;
    var parts=k.split('|');
    (specialWeeks[k]||[]).forEach(function(sw){
      bucket(sw.label).bands.push({ yr:parts[1], mm:parts[2], startDay:sw.startDay, endDay:sw.endDay });
    });
  });
  SCHED.forEach(function(r){
    if(r.v!==curV || !r.ev || !r.d) return;
    bucket(r.ev).dates.push(r.d);
  });
  return Object.keys(groups).map(function(n){
    var g=groups[n];
    g.dates.sort();
    g.bands.sort(function(a,b){ return (a.yr+a.mm+String(a.startDay).padStart(2,'0')).localeCompare(b.yr+b.mm+String(b.startDay).padStart(2,'0')); });
    return g;
  }).sort(function(a,b){ return a.label.localeCompare(b.label); });
}

function _swAnchorDate(g){
  if(g.bands.length){
    var b=g.bands[0];
    return b.yr+'-'+b.mm+'-'+String(b.startDay).padStart(2,'0');
  }
  return g.dates.length?g.dates[0]:null;
}

function _swGroupSubtitle(g){
  var MN3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var bits=[];
  if(g.bands.length){
    var b=g.bands[0];
    var span=MN3[parseInt(b.mm,10)-1]+' '+b.yr+' &nbsp;&#183;&nbsp; Day '+b.startDay+(b.endDay!==b.startDay?' &ndash; '+b.endDay:'');
    bits.push(g.bands.length>1 ? span+' +'+(g.bands.length-1)+' more week'+(g.bands.length-1>1?'s':'') : span);
  }
  if(g.dates.length) bits.push(g.dates.length+' tagged show'+(g.dates.length>1?'s':''));
  return bits.join(' &nbsp;&#183;&nbsp; ') || 'No dates yet';
}

function _renderSwList(){
  var container = document.getElementById('swExistingList');
  if(!container) return;
  _dedupeSpecialWeeks();
  var all = _swGroups();
  container._swAll = all;
  if(!all.length){ container.innerHTML='<div style="font-size:10px;color:var(--ink3);margin-bottom:8px">No special periods added yet.</div>'; return; }
  var h = '<div style="margin-bottom:10px">'
    +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:6px">Existing Periods</div>';
  all.forEach(function(g, i){
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--card);border-radius:8px;margin-bottom:4px;border:0.5px solid var(--hair)">'
      +'<div><div style="font-size:11px;font-weight:700">'+g.label+'</div>'
      +'<div style="font-size:9px;color:var(--ink3)">'+_swGroupSubtitle(g)+'</div></div>'
      +'<div style="display:flex;gap:4px">'
      +'<button onclick="_swEdit('+i+')" style="padding:3px 9px;border-radius:6px;border:0.5px solid var(--rule);background:var(--card2);font-size:10px;font-weight:600;cursor:pointer;font-family:inherit">Edit</button>'
      +'<button onclick="_swDelete('+i+')" style="padding:3px 9px;border-radius:6px;border:none;background:#faeaea;color:#8b2020;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">Delete</button>'
      +'</div></div>';
  });
  h += '</div>';
  container.innerHTML = h;
}

function _swEdit(idx){
  var container = document.getElementById('swExistingList');
  var all = container._swAll||[];
  var g = all[parseInt(idx)];
  if(!g) return;
  openEditSpecialWeek(g.label, _swAnchorDate(g));
}

function _swDelete(idx){
  var container = document.getElementById('swExistingList');
  var all = container._swAll||[];
  var g = all[parseInt(idx)];
  if(!g) return;
  deleteSpecialPeriodByLabel(g.label);
}

/* List delete removes the whole period: every band and every tagged show for this venue. */
function deleteSpecialPeriodByLabel(label){
  var norm=_swNorm(label);
  if(!norm) return;
  var dates=SCHED.filter(function(r){ return r.v===curV && r.d && _swNorm(r.ev)===norm; });
  var bands=0;
  Object.keys(specialWeeks).forEach(function(k){
    if(k.indexOf(curV+'|')!==0) return;
    (specialWeeks[k]||[]).forEach(function(sw){ if(_swNorm(sw.label)===norm) bands++; });
  });
  if(!dates.length && !bands) return;
  var scope=[];
  if(dates.length) scope.push(dates.length+' tagged show day'+(dates.length===1?'':'s'));
  if(bands) scope.push(bands+' calendar week'+(bands===1?'':'s'));
  if(!confirm('Delete "'+label+'" from '+curV+'?\n\nRemoves '+scope.join(' and ')+' across every month.')) return;
  var before=_captureSpecialPeriodState();
  pushUndo('Delete special period: '+label,function(){ _restoreSpecialPeriodState(before); });
  Object.keys(specialWeeks).forEach(function(k){
    if(k.indexOf(curV+'|')!==0) return;
    specialWeeks[k]=(specialWeeks[k]||[]).filter(function(sw){ return _swNorm(sw.label)!==norm; });
    if(!specialWeeks[k].length) delete specialWeeks[k];
  });
  if(_swUseRecords()){
    _swUidsForLabel(curV, label).forEach(removeSwRecord);
  } else {
    _saveSpecialWeeksTree();
  }
  dates.forEach(function(r){ r.ev=''; _persistShowEv(r); });
  _swEditKey=null; _swEditLabel=null; _swEditSrc=null; _swEditCluster=null;
  _setSwCoverageNote('');
  _renderSwList();
  go();
}

/** Day difference between YYYY-MM-DD strings. */
function _ymdDiffDays(a, b){
  return Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00')) / 86400000);
}
/** Contiguous cluster of tagged show dates around a clicked day (gap > 1 day breaks). */
function _clusterDatesAround(dates, aroundDate){
  if(!dates || !dates.length) return [];
  var sorted=dates.slice().sort();
  if(!aroundDate){
    /* No click context (list Edit): prefer the cluster in the visible month, else the latest cluster */
    var prefer=null;
    try{
      var mm=(curM+1<10?'0':'')+(curM+1);
      prefer=curYr+'-'+mm+'-15';
    }catch(e){}
    aroundDate=prefer || sorted[sorted.length-1];
  }
  var idx=-1;
  for(var i=0;i<sorted.length;i++){
    if(sorted[i]===aroundDate){ idx=i; break; }
  }
  if(idx<0){
    /* Clicked empty day inside a specialWeeks band: nearest tagged show */
    var best=-1, bestDist=1e9;
    for(var j=0;j<sorted.length;j++){
      var dist=Math.abs(_ymdDiffDays(aroundDate, sorted[j]));
      if(dist<bestDist){ bestDist=dist; best=j; }
    }
    idx=best;
  }
  if(idx<0) return sorted;
  var lo=idx, hi=idx;
  while(lo>0 && _ymdDiffDays(sorted[lo-1], sorted[lo])<=1) lo--;
  while(hi<sorted.length-1 && _ymdDiffDays(sorted[hi], sorted[hi+1])<=1) hi++;
  return sorted.slice(lo, hi+1);
}
/** Resolve the editable week around a clicked date (not every occurrence of the label). */
function findSpecialWeekCoverage(label, aroundDate){
  if(!label) return null;
  var allDates=SCHED.filter(function(r){ return r.v===curV && _swNorm(r.ev)===_swNorm(label) && r.d; })
    .map(function(r){ return r.d; })
    .filter(function(d,i,a){ return a.indexOf(d)===i; })
    .sort();

  /* Prefer a specialWeeks band that contains the clicked date */
  var swHit=null;
  Object.keys(specialWeeks).forEach(function(k){
    if(!k.startsWith(curV+'|')) return;
    var parts=k.split("|");
    (specialWeeks[k]||[]).forEach(function(sw){
      if(_swNorm(sw.label)!==_swNorm(label)) return;
      var start=parts[1]+'-'+parts[2]+'-'+String(sw.startDay).padStart(2,'0');
      var end=parts[1]+'-'+parts[2]+'-'+String(sw.endDay).padStart(2,'0');
      if(aroundDate && aroundDate>=start && aroundDate<=end){
        swHit={ key:k, start:start, end:end, startDay:sw.startDay, endDay:sw.endDay, uid:sw._uid||null };
      }
    });
  });
  if(swHit){
    var uid=swHit.uid||_swFindUid(curV, label, swHit.start, swHit.end);
    var rec=uid && window._swRecords ? window._swRecords[uid] : null;
    var start=rec && rec.start ? rec.start : swHit.start;
    var end=rec && rec.end ? rec.end : swHit.end;
    var inBand=allDates.filter(function(d){ return d>=start && d<=end; });
    return { label:label, start:start, end:end, dates:inBand, src:"sw", key:swHit.key, cluster:true, uid:uid||null };
  }

  if(!allDates.length) return null;
  var cluster=_clusterDatesAround(allDates, aroundDate);
  if(!cluster.length) cluster=allDates.slice();
  return {
    label:label,
    start:cluster[0],
    end:cluster[cluster.length-1],
    dates:cluster,
    src:'sched',
    key:null,
    cluster:true,
    uid:_swFindUid(curV, label, cluster[0], cluster[cluster.length-1])
  };
}
function _fmtSwCoverage(cov){
  if(!cov) return '';
  var startLbl='', endLbl='';
  try{
    startLbl=new Date(cov.start+'T12:00:00').toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});
    endLbl=new Date(cov.end+'T12:00:00').toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});
  }catch(e){ startLbl=cov.start; endLbl=cov.end; }
  var n=cov.dates && cov.dates.length ? cov.dates.length : 0;
  var bits=['This week: <b>'+startLbl+'</b> &ndash; <b>'+endLbl+'</b>'];
  if(n) bits.push(n+' tagged show day'+(n===1?'':'s'));
  bits.push('Adjust name or dates below, then Save');
  return bits.join(' &middot; ');
}
function _setSwCoverageNote(html){
  var el=document.getElementById('swCoverageNote');
  if(!el) return;
  if(html){ el.innerHTML=html; el.style.display='block'; }
  else { el.innerHTML=''; el.style.display='none'; }
}
function openEditSpecialWeek(label, ds){
  label=(label||'').trim();
  ds=(ds||'').trim() || null;
  document.getElementById('swModal').classList.remove('hidden');
  _renderSwList();
  var cov=findSpecialWeekCoverage(label, ds);
  document.getElementById('swLabel').value = label;
  if(cov){
    _swEditKey   = cov.key || null;
    _swEditLabel = cov.label;
    _swEditSrc   = cov.src;
    _swEditCluster = { start:cov.start, end:cov.end, dates:(cov.dates||[]).slice(), uid:cov.uid||null };
    document.getElementById('swModalTitle').textContent = 'Edit Special Period';
    document.getElementById('swFormLabel').textContent  = 'Editing "'+cov.label+'"';
    document.getElementById('swSaveBtn').textContent    = 'Save Changes';
    document.getElementById('swDeleteSelectedBtn').style.display='';
    document.getElementById('swStartDate').value = cov.start;
    document.getElementById('swEndDate').value   = cov.end;
    _setSwCoverageNote(_fmtSwCoverage(cov));
  } else {
    _swEditKey=null; _swEditLabel=null; _swEditSrc=null; _swEditCluster=null;
    document.getElementById('swModalTitle').textContent = 'Manage Special Periods';
    document.getElementById('swFormLabel').textContent  = 'New Period';
    document.getElementById('swSaveBtn').textContent    = 'Add Period';
    document.getElementById('swDeleteSelectedBtn').style.display='none';
    var period=fiscalPeriodRange(curYr, curM);
    document.getElementById('swStartDate').value=period.from;
    document.getElementById('swEndDate').value=period.to;
    _setSwCoverageNote('');
  }
  document.getElementById('swLabel').focus();
}

function _shiftYmd(dateStr, days){
  var d=new Date(dateStr+'T12:00:00');
  d.setDate(d.getDate()+days);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function findSpecialWeekRange(label){
  var min=null, max=null, found=false;
  Object.keys(specialWeeks).forEach(function(k){
    if(!k.startsWith(curV+'|')) return;
    var parts=k.split("|");
    (specialWeeks[k]||[]).forEach(function(sw){
      if(_swNorm(sw.label)!==_swNorm(label)) return;
      found=true;
      var start=parts[1]+'-'+parts[2]+'-'+String(sw.startDay).padStart(2,'0');
      var end=parts[1]+'-'+parts[2]+'-'+String(sw.endDay).padStart(2,'0');
      if(!min||start<min) min=start;
      if(!max||end>max) max=end;
    });
  });
  return found ? {start:min, end:max} : null;
}
function replaceSpecialWeekRange(label, startStr, endStr, uid){
  if(!label||!startStr||!endStr) return false;
  var sd=new Date(startStr+'T12:00:00'), ed=new Date(endStr+'T12:00:00');
  if(isNaN(sd.getTime())||isNaN(ed.getTime())||sd>ed) return false;
  if(_swUseRecords()){
    persistSwRecord({ _uid:uid||_swNewUid(), v:curV, label:label, start:startStr, end:endStr });
    return true;
  }
  Object.keys(specialWeeks).forEach(function(k){
    if(!k.startsWith(curV+'|')) return;
    specialWeeks[k]=(specialWeeks[k]||[]).filter(function(s){ return s.label!==label; });
    if(!specialWeeks[k].length) delete specialWeeks[k];
  });
  var cur=new Date(sd);
  while(cur<=ed){
    var yr2=cur.getFullYear(), mo2=cur.getMonth();
    var mm2=(mo2+1<10?'0':'')+(mo2+1);
    var startDay=cur.getDate();
    var monthEnd=new Date(yr2,mo2+1,0);
    var endInMonth=ed<=monthEnd?ed:monthEnd;
    var endDay=endInMonth.getDate();
    var k=curV+'|'+yr2+'|'+mm2;
    if(!specialWeeks[k]) specialWeeks[k]=[];
    specialWeeks[k]=specialWeeks[k].filter(function(s){return _swNorm(s.label)!==_swNorm(label);});
    specialWeeks[k].push({label:label,startDay:startDay,endDay:endDay});
    cur=new Date(yr2,mo2+1,1);
  }
  _dedupeSpecialWeeks();
  _saveSpecialWeeksTree();
  return true;
}
function swNudgePeriod(label, edge, delta){
  var cov=findSpecialWeekCoverage(label, null);
  if(!cov) return;
  var start=cov.start, end=cov.end;
  if(edge==='start') start=_shiftYmd(start, delta);
  else end=_shiftYmd(end, delta);
  if(start>end){
    if(edge==='start') start=end;
    else end=start;
  }
  var before=_captureSpecialPeriodState();
  pushUndo('Move special week: '+label,function(){ _restoreSpecialPeriodState(before); });
  replaceSpecialWeekRange(label, start, end, cov.uid);
  go();
}
var _swDrag = null;
function swDragStart(e){
  var el=e.target.closest('[data-sw-label]');
  if(!el) return;
  _swDrag={ type:'period', label:el.getAttribute('data-sw-label'), from:el.getAttribute('data-sw-from') };
  try{ e.dataTransfer.setData('text/plain', 'period|'+_swDrag.label); e.dataTransfer.effectAllowed='move'; }catch(err){}
}
function showDragStart(e){
  if(_isCoarsePointer()){ e.preventDefault(); return; }
  var el=e.target.closest('[data-show-idx]');
  if(!el) return;
  var idx=parseInt(el.getAttribute('data-show-idx'),10);
  if(!(idx>=0) || !SCHED[idx]) return;
  _swDrag={ type:'show', idx:idx, from:SCHED[idx].d };
  try{ e.dataTransfer.setData('text/plain', 'show|'+idx); e.dataTransfer.effectAllowed='move'; }catch(err){}
  e.stopPropagation();
}
function swDragEnd(){ _swDrag=null; document.querySelectorAll('.sc-row-drop').forEach(function(tr){ tr.classList.remove('sc-row-drop'); }); }
function swDragOver(e){
  if(!_swDrag) return;
  e.preventDefault();
  var tr=e.target.closest('tr[data-cal-ds]');
  if(tr) tr.classList.add('sc-row-drop');
}
function swDragLeave(e){
  var tr=e.target.closest('tr[data-cal-ds]');
  if(tr && !tr.contains(e.relatedTarget)) tr.classList.remove('sc-row-drop');
}
function swDropOnDate(e, toDate){
  e.preventDefault();
  var drag=_swDrag; _swDrag=null;
  document.querySelectorAll('.sc-row-drop').forEach(function(tr){ tr.classList.remove('sc-row-drop'); });
  if(!drag || !toDate) return;
  if(drag.type==='period'){
    var cov=findSpecialWeekCoverage(drag.label, drag.from||toDate);
    var range=cov ? {start:cov.start, end:cov.end} : findSpecialWeekRange(drag.label);
    if(!range) return;
    var from=drag.from||range.start;
    var deltaDays=Math.round((new Date(toDate+'T12:00:00')-new Date(from+'T12:00:00'))/86400000);
    if(!deltaDays) return;
    var beforePeriod=_captureSpecialPeriodState();
    pushUndo('Move special week: '+drag.label,function(){ _restoreSpecialPeriodState(beforePeriod); });
    replaceSpecialWeekRange(drag.label, _shiftYmd(range.start, deltaDays), _shiftYmd(range.end, deltaDays), cov && cov.uid);
    go();
    return;
  }
  if(drag.type==='show'){
    var rec=SCHED[drag.idx];
    if(!rec || rec.d===toDate) return;
    var beforeShow=_clone(rec), beforeIndex=drag.idx;
    ensureShowUid(rec);
    rec.d=toDate;
    rec.yr=fiscalYearForDate(toDate);
    rec.djStatus=null;
    applyShowTargets(rec);
    if(typeof clearPyMapCache==='function') clearPyMapCache();
    var afterShow=_clone(rec);
    pushUndo('Move show: '+(rec.dj||'TBD')+' to '+toDate,function(){
      _undoShowChange(beforeShow,afterShow,beforeIndex);
    });
    /* Clear old date keys without marking a baked show as deleted forever. */
    if(window._fbRef){
      if(beforeShow._added || !_isBakedSchedRecord(beforeShow)) _fbRemoveSchedRecord(beforeShow);
      else _fbClearEditKeys(beforeShow);
    }
    if(typeof persistSchedShow==='function') persistSchedShow(rec);
    go();
  }
}

function openAddSpecialWeek(){
  _swEditKey = null; _swEditLabel = null; _swEditSrc = null; _swEditCluster = null;
  document.getElementById('swModal').classList.remove('hidden');
  document.getElementById('swModalTitle').textContent = 'Manage Special Periods';
  document.getElementById('swFormLabel').textContent  = 'New Period';
  document.getElementById('swSaveBtn').textContent    = 'Add Period';
  document.getElementById('swDeleteSelectedBtn').style.display='none';
  var period=fiscalPeriodRange(curYr, curM);
  document.getElementById('swStartDate').value=period.from;
  document.getElementById('swEndDate').value=period.to;
  document.getElementById('swLabel').value='';
  _setSwCoverageNote('');
  _renderSwList();
  document.getElementById('swLabel').focus();
}
function closeSwModal(){
  document.getElementById('swModal').classList.add('hidden');
  _swEditKey = null; _swEditLabel = null; _swEditSrc = null; _swEditCluster = null;
  document.getElementById('swDeleteSelectedBtn').style.display='none';
  _setSwCoverageNote('');
}
function _captureSpecialPeriodState(){
  var evs={};
  SCHED.forEach(function(r){
    if(r.v===curV && r.d) evs[(r.venue||r.v)+'|'+r.d]=r.ev||'';
  });
  var recs={};
  Object.keys(window._swRecords||{}).forEach(function(uid){
    if(_swMetaKey(uid)) return;
    var r=window._swRecords[uid];
    if(r && r.v===curV) recs[uid]=_clone(r);
  });
  return {venue:curV,specialWeeks:_clone(specialWeeks),recs:recs,evs:evs};
}
function _restoreSpecialPeriodState(state){
  if(!state) return;
  if(_swUseRecords()){
    Object.keys(window._swRecords||{}).forEach(function(uid){
      if(_swMetaKey(uid)) return;
      var r=window._swRecords[uid];
      if(r && r.v===state.venue && !(state.recs && state.recs[uid])) removeSwRecord(uid);
    });
    Object.keys(state.recs||{}).forEach(function(uid){
      persistSwRecord(state.recs[uid]);
    });
  } else {
    specialWeeks=_clone(state.specialWeeks)||{};
    _saveSpecialWeeksTree();
  }
  SCHED.forEach(function(r){
    if(r.v!==state.venue || !r.d) return;
    var key=(r.venue||r.v)+'|'+r.d;
    if(!Object.prototype.hasOwnProperty.call(state.evs,key)) return;
    var old=state.evs[key];
    if((r.ev||'')===(old||'')) return;
    r.ev=old||'';
    _persistShowEv(r);
  });
}
function deleteSelectedSpecialWeek(){
  if(!_swEditLabel || !_swEditCluster) return;
  var label=_swEditLabel;
  var start=_swEditCluster.start, end=_swEditCluster.end;
  if(!confirm('Delete "'+label+'" for '+start+' through '+end+'?\n\nOnly this selected week will be removed.')) return;
  var before=_captureSpecialPeriodState();
  pushUndo('Delete special week: '+label,function(){ _restoreSpecialPeriodState(before); });
  if(_swUseRecords()){
    var uid=_swEditCluster.uid || _swFindUid(curV, label, start, end);
    if(uid) removeSwRecord(uid);
    else {
      _swUidsForLabel(curV, label).forEach(function(id){
        var r=window._swRecords[id];
        if(r && !(r.end<start || r.start>end)) removeSwRecord(id);
      });
    }
  } else {
    Object.keys(specialWeeks).forEach(function(k){
      if(!k.startsWith(curV+'|')) return;
      var parts=k.split('|');
      specialWeeks[k]=(specialWeeks[k]||[]).filter(function(sw){
        if(_swNorm(sw.label)!==_swNorm(label)) return true;
        var a=parts[1]+'-'+parts[2]+'-'+String(sw.startDay).padStart(2,'0');
        var b=parts[1]+'-'+parts[2]+'-'+String(sw.endDay).padStart(2,'0');
        return !(a<=end && b>=start);
      });
      if(!specialWeeks[k].length) delete specialWeeks[k];
    });
    _saveSpecialWeeksTree();
  }
  SCHED.forEach(function(r){
    if(r.v!==curV || _swNorm(r.ev)!==_swNorm(label) || !r.d || r.d<start || r.d>end) return;
    r.ev='';
    _persistShowEv(r);
  });
  closeSwModal();
  go();
}
/** Cluster-scoped SCHED.ev sync: only touch the week being edited, leave other same-label weeks alone. */
function _syncSchedEvForPeriod(oldLabel, newLabel, startStr, endStr, cluster){
  var oldStart=cluster && cluster.start ? cluster.start : startStr;
  var oldEnd=cluster && cluster.end ? cluster.end : endStr;
  SCHED.forEach(function(r){
    if(r.v!==curV || !r.d) return;
    var inOld = r.d>=oldStart && r.d<=oldEnd;
    var inNew = r.d>=startStr && r.d<=endStr;
    if(!inOld && !inNew) return;
    var matchOld = oldLabel && _swNorm(r.ev)===_swNorm(oldLabel);
    var matchNew = newLabel && _swNorm(r.ev)===_swNorm(newLabel);
    var next=null;
    var apply=false;
    if(inNew){
      /* Stamp the period onto show nights so bake tags cannot outlive rename/delete. */
      if(!r.ev || matchOld || matchNew){ next=newLabel||''; apply=true; }
    } else if(inOld && (matchOld || matchNew)){
      next=''; apply=true;
    }
    if(!apply) return;
    if((r.ev||'')===(next||'')) return;
    r.ev=next||'';
    _persistShowEv(r);
  });
}
/** Upsert one date-range band without wiping other same-label weeks.
 *  removeLabels: labels to strip from the edited cluster (old name + new name on rename). */
function _upsertSpecialWeekRange(label, startStr, endStr, replaceCluster, removeLabels){
  if(!label||!startStr||!endStr) return false;
  var sd=new Date(startStr+'T12:00:00'), ed=new Date(endStr+'T12:00:00');
  if(isNaN(sd.getTime())||isNaN(ed.getTime())||sd>ed) return false;
  var oldStart=replaceCluster && replaceCluster.start ? replaceCluster.start : startStr;
  var oldEnd=replaceCluster && replaceCluster.end ? replaceCluster.end : endStr;
  if(_swUseRecords()){
    var uid=(replaceCluster && replaceCluster.uid) || _swFindUid(curV, (removeLabels&&removeLabels[0])||label, oldStart, oldEnd) || _swNewUid();
    persistSwRecord({ _uid:uid, v:curV, label:label, start:startStr, end:endStr });
    return true;
  }
  var drop={};
  (removeLabels||[label]).forEach(function(lb){ if(lb) drop[_swNorm(lb)]=1; });
  Object.keys(specialWeeks).forEach(function(k){
    if(!k.startsWith(curV+'|')) return;
    var parts=k.split("|");
    specialWeeks[k]=(specialWeeks[k]||[]).filter(function(s){
      if(!drop[_swNorm(s.label)]) return true;
      var a=parts[1]+'-'+parts[2]+'-'+String(s.startDay).padStart(2,'0');
      var b=parts[1]+'-'+parts[2]+'-'+String(s.endDay).padStart(2,'0');
      /* remove only bands that overlap the week being edited */
      return !(a<=oldEnd && b>=oldStart);
    });
    if(!specialWeeks[k].length) delete specialWeeks[k];
  });
  var cur=new Date(sd);
  while(cur<=ed){
    var yr2=cur.getFullYear(), mo2=cur.getMonth();
    var mm2=(mo2+1<10?'0':'')+(mo2+1);
    var startDay=cur.getDate();
    var monthEnd=new Date(yr2,mo2+1,0);
    var endInMonth=ed<=monthEnd?ed:monthEnd;
    var endDay=endInMonth.getDate();
    var k=curV+'|'+yr2+'|'+mm2;
    if(!specialWeeks[k]) specialWeeks[k]=[];
    specialWeeks[k].push({label:label,startDay:startDay,endDay:endDay});
    cur=new Date(yr2,mo2+1,1);
  }
  _dedupeSpecialWeeks();
  _saveSpecialWeeksTree();
  return true;
}
function saveSpecialWeek(){
  var label=(document.getElementById('swLabel').value||'').trim();
  var startStr=document.getElementById('swStartDate').value;
  var endStr  =document.getElementById('swEndDate').value;
  if(!label||!startStr||!endStr) return;
  var sd=new Date(startStr+'T12:00:00'), ed=new Date(endStr+'T12:00:00');
  if(sd>ed) return;
  var oldLabel=_swEditLabel || label;
  var cluster=_swEditCluster;
  var before=_captureSpecialPeriodState();
  pushUndo((_swEditLabel?'Edit':'Add')+' special week: '+label,function(){ _restoreSpecialPeriodState(before); });

  if(_swEditLabel || _swEditSrc){
    /* Editing an existing week: drop old+new labels in cluster so renames don't leave a ghost band */
    var rem=[oldLabel, label];
    _upsertSpecialWeekRange(label, startStr, endStr, cluster || {start:startStr,end:endStr}, rem);
    _syncSchedEvForPeriod(oldLabel, label, startStr, endStr, cluster || {start:startStr,end:endStr});
  } else {
    /* Brand-new period — also stamp SCHED.ev so bake tags cannot resurrect after delete */
    replaceSpecialWeekRange(label, startStr, endStr, _swNewUid());
    _syncSchedEvForPeriod(null, label, startStr, endStr, {start:startStr,end:endStr});
  }

  _swEditKey=null; _swEditLabel=null; _swEditSrc=null; _swEditCluster=null;
  document.getElementById('swLabel').value='';
  document.getElementById('swModalTitle').textContent='Manage Special Periods';
  document.getElementById('swFormLabel').textContent='New Period';
  document.getElementById('swSaveBtn').textContent='Add Period';
  document.getElementById('swDeleteSelectedBtn').style.display='none';
  _setSwCoverageNote('');
  _renderSwList();
  go();
}

/*                                                               
   BUDGET TOPLINE   Bottle Service only
                                                                  */
var REV_CTX={bs:9604301, dj_bs_2026:5869524, label:'2026 CN BC'};

function renderBudgetTopLine(ytProj, ytFee){
  var tl = document.getElementById('budgetTopLine');
  if(!tl) return;
  var pctBS = ytProj ? (ytProj/REV_CTX.bs*100).toFixed(1) : null;
  var varVsPY = ytProj - REV_CTX.dj_bs_2026;

  var h='<div class="bgt-topline">';
  h+='<div class="btl-title">Bottle Service forecast   '+bgtYear+' vs 2026</div>';
  h+='<div class="btl-row">';
  /* PY DJ BS */
  h+='<div class="btl-col">';
  h+='<div class="btl-lbl">DJ BS 2026 actual</div>';
  h+='<div style="font-size:20px;font-weight:900;color:var(--ink3)">'+$m(REV_CTX.dj_bs_2026)+'</div>';
  h+='<div class="btl-note">'+REV_CTX.label+'</div>';
  h+='</div>';
  /* Total BS 2026 */
  h+='<div class="btl-col">';
  h+='<div class="btl-lbl">Total BS 2026</div>';
  h+='<div style="font-size:20px;font-weight:900;color:var(--ink3)">'+$m(REV_CTX.bs)+'</div>';
  h+='<div class="btl-note">full venue BS</div>';
  h+='</div>';
  /* Projected DJ BS */
  h+='<div class="btl-col btl-key">';
  h+='<div class="btl-lbl">Proj DJ BS '+bgtYear+'</div>';
  h+='<div style="font-size:24px;font-weight:900;color:var(--blue)">'+$m(ytProj)+'</div>';
  h+='<div class="btl-note '+(pctBS?'kc-b':'')+'">'+(pctBS?pctBS+'% of total BS':'add fees to project')+'</div>';
  h+='</div>';
  /* Change */
  h+='<div class="btl-col btl-total">';
  h+='<div class="btl-lbl">vs 2026 DJ BS</div>';
  h+='<div style="font-size:24px;font-weight:900" class="'+(varVsPY>=0?'pos':'neg')+'">'+$mv(varVsPY)+'</div>';
  h+='<div class="btl-note">'+$m(ytFee)+' in DJ fees</div>';
  h+='</div>';
  h+='</div></div>';
  tl.innerHTML=h;
}




/*     HELP & FEEDBACK PANEL                                         */
var HELP_FAQ = [
  {kw:['add','show','new dj','book'], q:'How do I add a show?',
   a:'Click <b>+ Add Show</b> on the Calendar or Accounting tab. Enter venue, date, DJ name and fee   BS Target and ROI Target are calculated automatically from the fee tier table.'},
  {kw:['py','prior year','last year','2025','blank','empty','monday','sunday','weekend'], q:"Why is a date's PY (prior year) column empty or on the wrong day?",
   a:"Prior-year (PY) keeps the same weekday (Sunday?Sunday, Saturday?Saturday). Same calendar date is used only when that anniversary is also the same weekday; otherwise the closest same-weekday show within 3 days is used. Each prior-year show is used at most once. Otherwise it stays blank rather than guessing."},
  {kw:['budget','not show','missing','lounge','venue'], q:"Why don't I see my new show in the Budget tab?",
   a:"The Budget tab follows whatever venue you're viewing on the Calendar   switch venues using the pills at the top and Budget updates automatically. The Year dropdown inside Budget is independent, so make sure it's set to the year you want too."},
  {kw:['roi','target','tier','multiplier','suggested','fair value'], q:'How is the ROI Target / Suggested Fee calculated?',
   a:'ROI Target comes from the DJ fee (venue fee-tier rules). Suggested Fee is calibrated from that DJ\'s past BS Actuals so historical beat-vs-target rate stays around ?50% ? a realistic pay level, not an automatic raise or cut.'},
  {kw:['special week','f1','art basel','wmc','event','festival'], q:'Can I add a Special Week (like F1, Art Basel)?',
   a:'Yes   click <b>+ Special Week</b>, name it, and pick a start/end date. It can span multiple months and shows as an amber label on every day in range.'},
  {kw:['2026','2027','plan','year','current'], q:'Can I budget for 2026 as well as 2027?',
   a:'Yes   use the Year dropdown in the Budget tab. Selecting 2026 shows your existing bookings for the rest of this year with the same fee/ROI/BS Target math as 2027 planning.'},
  {kw:['accounting','rider','fire','sound','cryo','cost line','hotel','kryo','others'], q:'How do I track Guest DJ vs other entertainment costs?',
   a:'Accounting has two tabs: <b>Guest DJ</b> (status, fees, R365) and <b>Others</b> (Hotel, Ground, Light Jockey, Fire Performance, Tech Line, Kryo). Others is a full-month grid with Name + Cost per day. Use the venue dropdown for Claudie, AVA WP, AVA CG, and Mila Restaurant on Others.'},
  {kw:['grid','list','year view','toggle','zoom'], q:'What do the calendar view buttons do?',
   a:'The three icons switch between List (detailed table), Grid (traditional box calendar), and Full Year (all 12 months at a glance, still showing DJ name/fee/target).'},
];



/* ---- Help & Feedback easter eggs + Virtual DJ Booth ---- */
var _helpEggClicks = 0;
var _helpEggTimer = null;
var _eggAudio = null;
var EGG_PLAYLIST = [
  { title: 'Hugo M. \u2014 Baoli Miami 2012', src: 'assets/easter/hugo-baoli-miami-2012.mp3' }
];
var _djb = null; /* mixer state */

function openHelp(ev){
  document.getElementById('helpModal').classList.remove('hidden');
  renderHelpFaq('');
}
function helpTitleEgg(){
  _helpEggClicks++;
  clearTimeout(_helpEggTimer);
  _helpEggTimer = setTimeout(function(){ _helpEggClicks=0; }, 1200);
  if(_helpEggClicks < 5) return;
  _helpEggClicks = 0;
  triggerDiscoEgg();
}
function triggerDiscoEgg(){
  document.documentElement.classList.add('egg-disco');
  var boom=document.createElement('div');
  boom.className='egg-boom';
  boom.textContent='AFTERPARTY MODE';
  document.body.appendChild(boom);
  setTimeout(function(){ boom.remove(); document.documentElement.classList.remove('egg-disco'); }, 2600);
}
function _eggPickTrack(){
  if(!EGG_PLAYLIST.length) return null;
  return EGG_PLAYLIST[Math.floor(Math.random()*EGG_PLAYLIST.length)];
}
function _eggTrackUrl(src){
  try{ return new URL(src, window.location.href).href; }catch(e){ return src; }
}
function stopEggSong(){
  closeDjBooth(true);
  if(_eggAudio){
    try{ _eggAudio.pause(); _eggAudio.removeAttribute('src'); _eggAudio.load(); }catch(e){}
    _eggAudio=null;
  }
  var bar=document.getElementById('eggPlayer');
  if(bar) bar.remove();
}
function _eggSetPlayerSub(msg){
  var bar=document.getElementById('eggPlayer');
  if(bar){
    var sub=bar.querySelector('.egg-player-sub');
    if(sub) sub.textContent=msg;
  }
}
function playEggSong(track){
  /* legacy mini player kept as fallback; booth uses Web Audio mixer */
  var t=track||_eggPickTrack();
  if(!t) return null;
  if(_eggAudio){
    try{ _eggAudio.pause(); }catch(e){}
    _eggAudio=null;
  }
  var bar=document.getElementById('eggPlayer');
  if(bar) bar.remove();
  return t;
}
function resumeEggSong(){
  if(_djb){ djbPlay('a'); djbPlay('b'); return; }
  openDjBooth();
}

function _djbFmt(t){
  if(!isFinite(t) || t<0) return '0:00';
  var m=Math.floor(t/60), sec=Math.floor(t%60);
  return m+':'+(sec<10?'0':'')+sec;
}
function _djbMakeDeckAudio(url){
  var a=new Audio();
  a.crossOrigin='anonymous';
  a.preload='auto';
  a.src=url;
  a.loop=true;
  return a;
}
function _djbBuildGraph(ctx, audioEl){
  var src=ctx.createMediaElementSource(audioEl);
  var vol=ctx.createGain(); vol.gain.value=0.85;
  var low=ctx.createBiquadFilter(); low.type='lowshelf'; low.frequency.value=320; low.gain.value=0;
  var mid=ctx.createBiquadFilter(); mid.type='peaking'; mid.frequency.value=1000; mid.Q.value=0.7; mid.gain.value=0;
  var high=ctx.createBiquadFilter(); high.type='highshelf'; high.frequency.value=3200; high.gain.value=0;
  var filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=18000; filter.Q.value=0.7;
  var xf=ctx.createGain(); xf.gain.value=0.707;
  src.connect(vol); vol.connect(low); low.connect(mid); mid.connect(high); high.connect(filter); filter.connect(xf);
  return { src:src, vol:vol, low:low, mid:mid, high:high, filter:filter, xf:xf, audio:audioEl };
}
function _djbApplyCrossfader(v){
  if(!_djb) return;
  /* equal-power crossfade: 0 = full A, 1 = full B */
  var x=Math.max(0, Math.min(1, Number(v)));
  _djb.xfPos=x;
  _djb.a.xf.gain.value=Math.cos(x*0.5*Math.PI);
  _djb.b.xf.gain.value=Math.sin(x*0.5*Math.PI);
  var el=document.getElementById('djbXfVal');
  if(el) el.textContent = x<0.45?'A':(x>0.55?'B':'CENTER');
}
function _djbTick(){
  if(!_djb || !_djb.open) return;
  ['a','b'].forEach(function(id){
    var d=_djb[id];
    var prog=document.getElementById('djbProg'+id.toUpperCase());
    var t0=document.getElementById('djbT0'+id.toUpperCase());
    var t1=document.getElementById('djbT1'+id.toUpperCase());
    if(prog && d.audio.duration){
      prog.max=d.audio.duration;
      if(!_djb.scrubbing) prog.value=d.audio.currentTime||0;
    }
    if(t0) t0.textContent=_djbFmt(d.audio.currentTime||0);
    if(t1) t1.textContent=_djbFmt(d.audio.duration||0);
  });
  if(_djb.analyser && _djb.vuEls){
    var data=new Uint8Array(_djb.analyser.frequencyBinCount);
    _djb.analyser.getByteFrequencyData(data);
    var n=_djb.vuEls.length;
    for(var i=0;i<n;i++){
      var idx=Math.floor(i/n*data.length);
      var h=Math.max(4, Math.round(data[idx]/255*100));
      _djb.vuEls[i].style.height=h+'%';
    }
  }
  _djb.raf=requestAnimationFrame(_djbTick);
}
function djbPlay(which){
  if(!_djb) return;
  var d=_djb[which];
  if(!_djb.ctx) return;
  if(_djb.ctx.state==='suspended') _djb.ctx.resume();
  var p=d.audio.play();
  if(p&&p.catch) p.catch(function(){});
  var btn=document.getElementById('djbPlay'+which.toUpperCase());
  if(btn) btn.textContent='Pause';
}
function djbPause(which){
  if(!_djb) return;
  _djb[which].audio.pause();
  var btn=document.getElementById('djbPlay'+which.toUpperCase());
  if(btn) btn.textContent='Play';
}
function djbToggle(which){
  if(!_djb) return;
  if(_djb[which].audio.paused) djbPlay(which); else djbPause(which);
}
function djbCue(which){
  if(!_djb) return;
  var d=_djb[which];
  d.audio.currentTime=0;
  djbPlay(which);
}
function djbSetVol(which, v){
  if(!_djb) return;
  _djb[which].vol.gain.value=Number(v);
}
function djbSetPitch(which, v){
  if(!_djb) return;
  _djb[which].audio.playbackRate=Number(v);
  var el=document.getElementById('djbPitchVal'+which.toUpperCase());
  if(el) el.textContent=Number(v).toFixed(2)+'x';
}
function djbSetEq(which, band, v){
  if(!_djb) return;
  _djb[which][band].gain.value=Number(v);
}
function djbSetFilter(which, v){
  if(!_djb) return;
  /* log scale ~200Hz to 18kHz */
  var t=Number(v);
  var freq=200*Math.pow(18000/200, t);
  _djb[which].filter.frequency.value=freq;
}
function djbSetMaster(v){
  if(!_djb||!_djb.master) return;
  _djb.master.gain.value=Number(v);
}
function djbSeek(which, v){
  if(!_djb) return;
  _djb[which].audio.currentTime=Number(v);
}
function closeDjBooth(silent){
  if(_djb){
    _djb.open=false;
    if(_djb.raf) cancelAnimationFrame(_djb.raf);
    try{ if(_djb.a) _djb.a.audio.pause(); }catch(e){}
    try{ if(_djb.b) _djb.b.audio.pause(); }catch(e){}
    try{ if(_djb.ctx) _djb.ctx.close(); }catch(e){}
    _djb=null;
  }
  var m=document.getElementById('eggBooth');
  if(m) m.remove();
  var bar=document.getElementById('eggPlayer');
  if(bar && !silent) bar.remove();
}
function openDjBooth(){
  stopEggSong();
  var track=_eggPickTrack();
  if(!track){ alert('No easter track found.'); return; }
  var url=_eggTrackUrl(track.src);
  var old=document.getElementById('eggBooth');
  if(old) old.remove();

  var AC=window.AudioContext||window.webkitAudioContext;
  var ctx=new AC();
  var audioA=_djbMakeDeckAudio(url);
  var audioB=_djbMakeDeckAudio(url);
  /* Offset deck B a bit so mixing feels different when both play */
  audioB.addEventListener('loadedmetadata', function(){
    try{ audioB.currentTime=Math.min(32, (audioB.duration||60)*0.12); }catch(e){}
  }, {once:true});

  var deckA=_djbBuildGraph(ctx, audioA);
  var deckB=_djbBuildGraph(ctx, audioB);
  var master=ctx.createGain(); master.gain.value=0.9;
  var analyser=ctx.createAnalyser(); analyser.fftSize=64;
  deckA.xf.connect(master);
  deckB.xf.connect(master);
  master.connect(analyser);
  analyser.connect(ctx.destination);

  _djb={ open:true, ctx:ctx, a:deckA, b:deckB, master:master, analyser:analyser, xfPos:0.5, scrubbing:false, raf:0, track:track };

  var modal=document.createElement('div');
  modal.id='eggBooth';
  modal.className='modal-bg djb-modal';
  modal.innerHTML=
    '<div class="modal">'+
      '<div class="modal-hd"><h3>&#127911; Virtual DJ Booth</h3><button class="modal-close" onclick="closeDjBooth()">&#10005;</button></div>'+
      '<div class="modal-body">'+
        '<div class="djb-wrap">'+
          '<div class="djb-deck a">'+
            '<div class="djb-deck-hd"><div class="djb-deck-name">Deck A</div><div style="font-size:10px;color:#67e8f9">LEFT</div></div>'+
            '<div class="djb-track">'+track.title+'</div>'+
            '<input class="djb-progress" id="djbProgA" type="range" min="0" max="100" step="0.1" value="0" oninput="_djb.scrubbing=true;djbSeek(\'a\',this.value)" onchange="_djb.scrubbing=false">'+
            '<div class="djb-time"><span id="djbT0A">0:00</span><span id="djbT1A">0:00</span></div>'+
            '<div class="djb-btns">'+
              '<button class="djb-btn play" id="djbPlayA" onclick="djbToggle(\'a\')">Play</button>'+
              '<button class="djb-btn" onclick="djbCue(\'a\')">Cue</button>'+
              '<button class="djb-btn stop" onclick="djbPause(\'a\')">Stop</button>'+
            '</div>'+
            '<div class="djb-sliders">'+
              '<div class="djb-slider"><label>Volume</label><input type="range" min="0" max="1" step="0.01" value="0.85" oninput="djbSetVol(\'a\',this.value)"></div>'+
              '<div class="djb-slider"><label>Pitch <span id="djbPitchValA">1.00x</span></label><input type="range" min="0.85" max="1.15" step="0.01" value="1" oninput="djbSetPitch(\'a\',this.value)"></div>'+
              '<div class="djb-slider"><label>Bass</label><input type="range" min="-12" max="12" step="0.5" value="0" oninput="djbSetEq(\'a\',\'low\',this.value)"></div>'+
              '<div class="djb-slider"><label>Mid</label><input type="range" min="-12" max="12" step="0.5" value="0" oninput="djbSetEq(\'a\',\'mid\',this.value)"></div>'+
              '<div class="djb-slider"><label>Treble</label><input type="range" min="-12" max="12" step="0.5" value="0" oninput="djbSetEq(\'a\',\'high\',this.value)"></div>'+
              '<div class="djb-slider"><label>Filter</label><input type="range" min="0" max="1" step="0.01" value="1" oninput="djbSetFilter(\'a\',this.value)"></div>'+
            '</div>'+
          '</div>'+
          '<div class="djb-center">'+
            '<div class="djb-xf-lbl">Crossfader</div>'+
            '<div id="djbXfVal" style="font-size:11px;font-weight:900;color:#fbbf24">CENTER</div>'+
            '<input class="djb-xf" type="range" min="0" max="1" step="0.01" value="0.5" oninput="_djbApplyCrossfader(this.value)" orient="vertical">'+
            '<div class="djb-slider djb-master"><label>Master</label><input type="range" min="0" max="1" step="0.01" value="0.9" oninput="djbSetMaster(this.value)"></div>'+
            '<div class="djb-vu" id="djbVu"></div>'+
          '</div>'+
          '<div class="djb-deck b">'+
            '<div class="djb-deck-hd"><div class="djb-deck-name">Deck B</div><div style="font-size:10px;color:#f9a8d4">RIGHT</div></div>'+
            '<div class="djb-track">'+track.title+'</div>'+
            '<input class="djb-progress" id="djbProgB" type="range" min="0" max="100" step="0.1" value="0" oninput="_djb.scrubbing=true;djbSeek(\'b\',this.value)" onchange="_djb.scrubbing=false">'+
            '<div class="djb-time"><span id="djbT0B">0:00</span><span id="djbT1B">0:00</span></div>'+
            '<div class="djb-btns">'+
              '<button class="djb-btn play" id="djbPlayB" onclick="djbToggle(\'b\')">Play</button>'+
              '<button class="djb-btn" onclick="djbCue(\'b\')">Cue</button>'+
              '<button class="djb-btn stop" onclick="djbPause(\'b\')">Stop</button>'+
            '</div>'+
            '<div class="djb-sliders">'+
              '<div class="djb-slider"><label>Volume</label><input type="range" min="0" max="1" step="0.01" value="0.85" oninput="djbSetVol(\'b\',this.value)"></div>'+
              '<div class="djb-slider"><label>Pitch <span id="djbPitchValB">1.00x</span></label><input type="range" min="0.85" max="1.15" step="0.01" value="1" oninput="djbSetPitch(\'b\',this.value)"></div>'+
              '<div class="djb-slider"><label>Bass</label><input type="range" min="-12" max="12" step="0.5" value="0" oninput="djbSetEq(\'b\',\'low\',this.value)"></div>'+
              '<div class="djb-slider"><label>Mid</label><input type="range" min="-12" max="12" step="0.5" value="0" oninput="djbSetEq(\'b\',\'mid\',this.value)"></div>'+
              '<div class="djb-slider"><label>Treble</label><input type="range" min="-12" max="12" step="0.5" value="0" oninput="djbSetEq(\'b\',\'high\',this.value)"></div>'+
              '<div class="djb-slider"><label>Filter</label><input type="range" min="0" max="1" step="0.01" value="1" oninput="djbSetFilter(\'b\',this.value)"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="djb-hint">Mix tip: start Deck A, nudge Deck B pitch, sweep the crossfader, and ride bass/filter for drops. Same track on both decks \u2014 your mix, your booth.</div>'+
      '</div>'+
      '<div class="modal-foot">'+
        '<button class="btn-cancel" onclick="closeDjBooth()">Close booth</button>'+
        '<button class="btn-save" onclick="djbPlay(\'a\');djbPlay(\'b\')">Start both decks</button>'+
        '<button class="btn-save" onclick="triggerDiscoEgg()">Hit the lights</button>'+
      '</div>'+
    '</div>';

  modal.addEventListener('click', function(e){ if(e.target===modal) closeDjBooth(); });
  document.body.appendChild(modal);

  var vu=document.getElementById('djbVu');
  _djb.vuEls=[];
  for(var i=0;i<16;i++){ var bar=document.createElement('i'); bar.style.height='8%'; vu.appendChild(bar); _djb.vuEls.push(bar); }

  _djbApplyCrossfader(0.5);
  _djbTick();

  /* Auto-start deck A inside user gesture */
  ctx.resume().then(function(){ djbPlay('a'); }).catch(function(){});
}
function triggerHelpBoothEgg(){
  openDjBooth();
}
function _wireHelpEggClick(){
  var btn=document.getElementById('sbHelpBtn');
  if(!btn || btn._eggWired) return;
  btn._eggWired=true;
  btn.addEventListener('click', function(e){
    if(e.shiftKey || e.altKey){
      e.preventDefault();
      e.stopImmediatePropagation();
      triggerHelpBoothEgg();
      return;
    }
    openHelp();
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _wireHelpEggClick);
else _wireHelpEggClick();

/* Shift then type gallardochristophe ? Gallardo portrait; matisse ? Matisse photo */
var _gallardoArmed = false;
var _gallardoBuf = '';
var _gallardoTimer = null;
var EASTER_SEQS = {
  gallardochristophe: { src: 'assets/easter/gallardo-christophe.png', alt: 'Christophe Gallardo' },
  matisse: { src: 'assets/easter/matisse-mbappe.png', alt: 'Matisse' }
};
function closeGallardoEgg(){
  var el=document.getElementById('eggGallardo');
  if(el) el.remove();
}
function triggerGallardoEgg(seqKey){
  closeGallardoEgg();
  var meta=EASTER_SEQS[seqKey]||EASTER_SEQS.gallardochristophe;
  var wrap=document.createElement('div');
  wrap.id='eggGallardo';
  wrap.className='egg-gallardo';
  wrap.title='Click or Esc to close';
  var img=document.createElement('img');
  img.src=meta.src;
  img.alt=meta.alt;
  wrap.appendChild(img);
  wrap.addEventListener('click', closeGallardoEgg);
  document.body.appendChild(wrap);
}
function _resetGallardoSeq(){
  _gallardoArmed=false;
  _gallardoBuf='';
  clearTimeout(_gallardoTimer);
  _gallardoTimer=null;
}
function _armGallardoSeq(){
  _gallardoArmed=true;
  _gallardoBuf='';
  clearTimeout(_gallardoTimer);
  _gallardoTimer=setTimeout(_resetGallardoSeq, 8000);
}
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){ closeGallardoEgg(); return; }
  var tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(e.target&&e.target.isContentEditable)) return;
  if(e.key==='Shift'){ _armGallardoSeq(); return; }
  if(!_gallardoArmed) return;
  if(e.key==='Escape'||e.key==='Backspace'){ _resetGallardoSeq(); return; }
  if(e.key.length!==1) return;
  var ch=e.key.toLowerCase();
  if(!/[a-z]/.test(ch)){ _resetGallardoSeq(); return; }
  _gallardoBuf+=ch;
  clearTimeout(_gallardoTimer);
  _gallardoTimer=setTimeout(_resetGallardoSeq, 8000);
  var keys=Object.keys(EASTER_SEQS);
  var anyPrefix=keys.some(function(k){ return k.indexOf(_gallardoBuf)===0; });
  if(!anyPrefix){ _resetGallardoSeq(); return; }
  if(EASTER_SEQS[_gallardoBuf]){
    var hit=_gallardoBuf;
    _resetGallardoSeq();
    triggerGallardoEgg(hit);
  }
});

function renderHelpFaq(query){
  var qs=(query||'').trim().toLowerCase();
  if(qs==='neos forever' || qs==='afterparty'){
    var box=document.getElementById('helpFaqList');
    if(box) box.innerHTML='<div class="help-q">Easter egg unlocked</div><div class="help-a">Casa Neos never sleeps. Shift+click <b>Help &amp; Feedback</b> to open the <b>Virtual DJ Booth</b> and mix Baoli Miami 2012 (2 decks, EQ, crossfader). Or tap <b>Built with &#9835; in Miami</b> five times for Afterparty Mode.</div>';
    return;
  }
  var list = qs
    ? HELP_FAQ.filter(function(item){
        return item.q.toLowerCase().indexOf(qs)>-1
          || item.kw.some(function(k){return k.indexOf(qs)>-1||qs.indexOf(k)>-1;});
      })
    : HELP_FAQ;
  var h = list.length ? list.map(function(item){
    return '<div class="help-q">'+item.q+'</div><div class="help-a">'+item.a+'</div>';
  }).join('') : '<div class="help-a" style="padding:10px 0;color:var(--ink3)">No matching FAQ   describe it below and copy it over to Claude.</div>';
  var box=document.getElementById('helpFaqList');
  if(box) box.innerHTML = h;
}

function closeHelp(){ document.getElementById('helpModal').classList.add('hidden'); }

function copyFeedbackText(){
  var note=(document.getElementById('helpNote').value||'').trim();
  var summary = 'RDG DJ Dashboard   question / issue\\n'
    + 'Venue: '+curV+' | Year: '+curYr+' | View: '+curView+'\\n'
    + (note ? '\\nDetails:\\n'+note : '\\n(no details added   please describe the issue)')
    + '\\n\\n(Paste this into the Claude conversation where this dashboard was built   Claude will make the fix and send back an updated file.)';
  var ta=document.createElement('textarea');
  ta.value=summary; document.body.appendChild(ta);
  ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  var btn=document.getElementById('helpCopyBtn');
  if(btn){ var orig=btn.textContent; btn.textContent='Copied!'; setTimeout(function(){btn.textContent=orig;},1500); }
}

/*                                                                
   VENUE ROI RULES EDITOR   one section per venue, editable tiers
                                                                   */
var _vrEditVenue = null;
function _pushVenueRulesUndo(label){
  var before=_clone(VENUE_ROI_RULES);
  pushUndo(label,function(){
    VENUE_ROI_RULES=_clone(before)||{};
    saveVenueRules();
  });
}

function openVenueRulesEditor(){
  document.getElementById('venueRulesModal').classList.remove('hidden');
  _vrEditVenue = Object.keys(VENUE_ROI_RULES)[0];
  renderVenueRulesPanel();
}
function closeVenueRulesEditor(){ document.getElementById('venueRulesModal').classList.add('hidden'); }
function selectVenueRuleTab(v){ _vrEditVenue = v; renderVenueRulesPanel(); }

var MONTH_NAMES_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function renderVenueRulesPanel(){
  ensureCnbcSummerRoofRules();
  var venues=Object.keys(VENUE_ROI_RULES);
  /* Keep Summer Roof next to Beach Club in the tab strip. */
  venues.sort(function(a,b){
    var rank=function(v){
      if(v==='Casa Neos Beach Club') return 1;
      if(v===CNBC_SUMMER_ROOF_KEY) return 2;
      if(v==='Casa Neos Lounge') return 3;
      if(v==='MILA Lounge') return 4;
      return 9;
    };
    return rank(a)-rank(b) || a.localeCompare(b);
  });
  var tabsHtml='<div class="vr-tabs vr-tabs--page">';
  venues.forEach(function(v){
    var label=v===CNBC_SUMMER_ROOF_KEY ? 'CNBC Summer Roof' : v;
    tabsHtml+='<button class="vr-tab'+(v===_vrEditVenue?' on':'')+'" data-vv="'+v+'" title="'+(v===CNBC_SUMMER_ROOF_KEY?'Sunset Rituals · Aug–Sep only':v)+'">'+label+'</button>';
  });
  tabsHtml+='</div>';
  document.getElementById('vrTabs').innerHTML=tabsHtml;
  document.querySelectorAll('#vrTabs .vr-tab').forEach(function(btn){
    btn.addEventListener('click',function(){ selectVenueRuleTab(btn.dataset.vv); });
  });

  var rules=VENUE_ROI_RULES[_vrEditVenue];
  if(!rules){ document.getElementById('vrBody').innerHTML='<div class="empty">No rules defined for this venue yet.</div>'; return; }

  var h='';
  if(_vrEditVenue===CNBC_SUMMER_ROOF_KEY){
    h+='<div class="vr-season-box" style="border-left:3px solid #0f766e">';
    h+='<div class="vr-season-lbl" style="color:#0f766e">Sunset Rituals Rooftop Edition</div>';
    h+='<div class="vr-season-hint">Applies automatically to <b>Casa Neos Beach Club</b> shows from <b>August 1 through September 30</b> only (ROI, BS Target, and table mins). Outside that window the regular Beach Club rules are used. Floor plan: Diamond 5 · Platinum 6 · Prestige 5 · Gold 4.</div>';
    h+='</div>';
  }

  h+='<div class="vr-season-box">';
  h+='<div class="vr-season-lbl">High season months</div>';
  h+='<div class="vr-month-grid">';
  for(var m=1;m<=12;m++){
    var isHigh=(rules.highSeasonMonths||[]).indexOf(m)>-1;
    h+='<button class="vr-month-btn'+(isHigh?' on':'')+'" data-month="'+m+'">'+MONTH_NAMES_SHORT[m-1]+'</button>';
  }
  h+='</div>';
  h+='<div class="vr-season-hint">Click months to toggle High / Low season. Everything else defaults to Low.</div>';
  h+='</div>';

  h+='<div class="vr-days-box">';
  h+='<div class="vr-season-lbl">Operating days (DJ nights)</div>';
  h+='<div class="vr-month-grid">';
  DOW_NAMES.forEach(function(d){
    var active=rules.days.indexOf(d)>-1;
    h+='<button class="vr-month-btn'+(active?' on':'')+'" data-day="'+d+'">'+d.slice(0,3)+'</button>';
  });
  h+='</div></div>';

  h+='<div class="vr-tiers vr-tiers--page">';
  rules.tiers.forEach(function(tier, ti){
    h+='<div class="vr-tier-block vr-tier-block--page">';
    h+='<div class="vr-tier-hd">';
    h+='<span class="vr-tier-fee-lbl">DJ Fee</span>';
    if(typeof _vrFeeInputHtml==='function'){
      h+=_vrFeeInputHtml(tier.fee, 'vr-fee-inp', 'data-action="fee" data-ti="'+ti+'"');
    }else{
      h+='<input type="number" class="vr-fee-inp" value="'+tier.fee+'" data-action="fee" data-ti="'+ti+'">';
    }
    h+='<button class="rules-del" data-action="remove-tier" data-ti="'+ti+'" title="Remove tier">&#10005;</button>';
    h+='</div>';
    h+='<div class="vr-tier-scroll"><table class="vr-tier-tbl vr-tier-tbl--page"><thead><tr><th>Season</th><th>Day</th><th>ROI</th><th>BS Target</th>';
    (rules.tableCats||[]).forEach(function(c){
      h+='<th class="vr-th-tier">'+c+'<span class="vr-th-sub">min $</span></th>';
    });
    h+='</tr></thead><tbody>';
    ['High','Low'].forEach(function(season){
      rules.days.forEach(function(day, di){
        var dayData=(tier[season]||{})[day]||{roi:0,sales:0,tables:{}};
        h+='<tr>';
        if(di===0) h+='<td rowspan="'+rules.days.length+'" class="vr-season-cell vr-season-'+season.toLowerCase()+'">'+season+'</td>';
        h+='<td class="vr-day-cell">'+day.slice(0,3)+'</td>';
        h+='<td><input type="number" step="0.1" class="vr-cell-inp vr-roi-inp" value="'+dayData.roi+'" data-action="day-field" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-field="roi"></td>';
        if(typeof _vrMoneyInputHtml==='function'){
          h+='<td>'+_vrMoneyInputHtml(dayData.sales, 'vr-cell-inp vr-target-inp', 'data-action="day-field" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-field="sales"')+'</td>';
          (rules.tableCats||[]).forEach(function(c){
            var tv=(dayData.tables||{})[c]||0;
            h+='<td>'+_vrMoneyInputHtml(tv, 'vr-cell-inp vr-cell-sm', 'data-action="table-field" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-cat="'+c+'"')+'</td>';
          });
        }else{
          h+='<td><input type="number" class="vr-cell-inp" value="'+dayData.sales+'" data-action="day-field" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-field="sales"></td>';
          (rules.tableCats||[]).forEach(function(c){
            var tv=(dayData.tables||{})[c]||0;
            h+='<td><input type="number" class="vr-cell-inp vr-cell-sm" value="'+tv+'" data-action="table-field" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-cat="'+c+'"></td>';
          });
        }
        h+='</tr>';
      });
    });
    h+='</tbody></table></div></div>';
  });
  h+='</div>';
  h+='<button class="btn-add" id="vrAddTierBtn">+ Add DJ fee tier</button>';

  document.getElementById('vrBody').innerHTML=h;
  var vrBodyEl=document.getElementById('vrBody');
  if(vrBodyEl) vrBodyEl.style.maxHeight=document.getElementById('view-roi-rules')?'none':'50vh';
  if(typeof wireVenueRulesMoneyInputs==='function') wireVenueRulesMoneyInputs(document.getElementById('vrBody'));
  wireVenueRulesEvents();
}

function wireVenueRulesEvents(){
  document.querySelectorAll('.vr-month-btn[data-month]').forEach(function(btn){
    btn.addEventListener('click',function(){ toggleHighSeasonMonth(_vrEditVenue, parseInt(btn.dataset.month,10)); });
  });
  document.querySelectorAll('.vr-month-btn[data-day]').forEach(function(btn){
    btn.addEventListener('click',function(){ toggleOperatingDay(_vrEditVenue, btn.dataset.day); });
  });
  document.querySelectorAll('[data-action="fee"]').forEach(function(inp){
    inp.addEventListener('change',function(){
      var val=(typeof _vrParseMoney==='function')?_vrParseMoney(inp.value):(parseFloat(inp.value)||0);
      updateTierFee(_vrEditVenue, parseInt(inp.dataset.ti,10), val);
    });
  });
  document.querySelectorAll('[data-action="remove-tier"]').forEach(function(btn){
    btn.addEventListener('click',function(){ removeTier(_vrEditVenue, parseInt(btn.dataset.ti,10)); });
  });
  document.querySelectorAll('[data-action="day-field"]').forEach(function(inp){
    inp.addEventListener('change',function(){
      var val=inp.dataset.field==='roi'?(parseFloat(inp.value)||0):((typeof _vrParseMoney==='function')?_vrParseMoney(inp.value):(parseFloat(inp.value)||0));
      updateTierDay(_vrEditVenue, parseInt(inp.dataset.ti,10), inp.dataset.season, inp.dataset.day, inp.dataset.field, val);
    });
  });
  document.querySelectorAll('[data-action="table-field"]').forEach(function(inp){
    inp.addEventListener('change',function(){
      var val=(typeof _vrParseMoney==='function')?_vrParseMoney(inp.value):(parseFloat(inp.value)||0);
      updateTierTable(_vrEditVenue, parseInt(inp.dataset.ti,10), inp.dataset.season, inp.dataset.day, inp.dataset.cat, val);
    });
  });
  var addBtn=document.getElementById('vrAddTierBtn');
  if(addBtn) addBtn.addEventListener('click',function(){ addNewTier(_vrEditVenue); });
}

function toggleHighSeasonMonth(v,m){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  _pushVenueRulesUndo('Change high-season month');
  if(!rules.highSeasonMonths) rules.highSeasonMonths=[];
  var idx=rules.highSeasonMonths.indexOf(m);
  if(idx>-1) rules.highSeasonMonths.splice(idx,1); else rules.highSeasonMonths.push(m);
  saveVenueRules(); renderVenueRulesPanel();
}
function toggleOperatingDay(v,day){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  _pushVenueRulesUndo('Change venue operating day');
  var idx=rules.days.indexOf(day);
  if(idx>-1) rules.days.splice(idx,1); else rules.days.push(day);
  saveVenueRules(); renderVenueRulesPanel();
}
function updateTierFee(v,ti,val){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  _pushVenueRulesUndo('Change venue DJ fee tier');
  rules.tiers[ti].fee=parseFloat(val)||0;
  rules.tiers.sort(function(a,b){return a.fee-b.fee;});
  saveVenueRules(); renderVenueRulesPanel(); go();
}
function updateTierDay(v,ti,season,day,field,val){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  _pushVenueRulesUndo('Change venue ROI target');
  var tier=rules.tiers[ti];
  if(!tier[season]) tier[season]={};
  if(!tier[season][day]) tier[season][day]={roi:0,sales:0,tables:{}};
  tier[season][day][field]=parseFloat(val)||0;
  saveVenueRules(); go();
}
function updateTierTable(v,ti,season,day,cat,val){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  _pushVenueRulesUndo('Change VIP table minimum');
  var tier=rules.tiers[ti];
  if(!tier[season]) tier[season]={};
  if(!tier[season][day]) tier[season][day]={roi:0,sales:0,tables:{}};
  if(!tier[season][day].tables) tier[season][day].tables={};
  tier[season][day].tables[cat]=parseFloat(val)||0;
  saveVenueRules();
}
function removeTier(v,ti){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  if(rules.tiers.length<=1){ alert('At least one tier is required.'); return; }
  _pushVenueRulesUndo('Remove venue DJ fee tier');
  rules.tiers.splice(ti,1);
  saveVenueRules(); renderVenueRulesPanel(); go();
}
function addNewTier(v){
  var rules=VENUE_ROI_RULES[v]; if(!rules) return;
  _pushVenueRulesUndo('Add venue DJ fee tier');
  var lastFee=rules.tiers.length?rules.tiers[rules.tiers.length-1].fee:5000;
  var newTier={fee:lastFee+10000, High:{}, Low:{}};
  rules.days.forEach(function(d){
    newTier.High[d]={roi:2,sales:0,tables:{}};
    newTier.Low[d]={roi:2,sales:0,tables:{}};
  });
  rules.tiers.push(newTier);
  saveVenueRules(); renderVenueRulesPanel();
}


/*                                                                
   IMPORT FROM EXCEL   refresh BS Actual from an "Act vs For Reporting"
   style file. Runs fully in-browser via the bundled XLSX library  
   no server, no external calls, works offline.
                                                                   */
var _importPendingRows = null;
var _importTargetVenue = null;

function openImportModal(){
  document.getElementById('importModal').classList.remove('hidden');
  document.getElementById('importStep1').style.display='';
  document.getElementById('importStep2').style.display='none';
  document.getElementById('importFile').value='';
  var vs=document.getElementById('importVenueSel');
  var venues=Object.keys(VENUE_ROI_RULES);
  vs.innerHTML=venues.map(function(v){return '<option value="'+v+'"'+(v===curV?' selected':'')+'>'+v+'</option>';}).join('');
}
function closeImportModal(){ document.getElementById('importModal').classList.add('hidden'); }

function handleImportFile(inputEl){
  var file=inputEl.files && inputEl.files[0];
  if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=new Uint8Array(e.target.result);
      var wb=XLSX.read(data,{type:'array', cellDates:false});
      parseImportWorkbook(wb, file.name);
    }catch(err){
      document.getElementById('importResult').innerHTML='<div class="import-err">Could not read this file: '+err.message+'</div>';
      document.getElementById('importStep1').style.display='';
      document.getElementById('importStep2').style.display='none';
    }
  };
  reader.readAsArrayBuffer(file);
}

/* Convert an Excel serial date OR a JS Date OR a date-like string to YYYY-MM-DD */
function excelDateToISO(v){
  if(v==null || v==='') return null;
  if(typeof v==='number'){
    var d=new Date(Math.round((v-25569)*86400*1000));
    return d.toISOString().slice(0,10);
  }
  if(v instanceof Date){ return v.toISOString().slice(0,10); }
  var s=String(v).trim();
  var m=s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  var d2=new Date(s);
  if(!isNaN(d2.getTime())) return d2.toISOString().slice(0,10);
  return null;
}
function numOrNull(v){
  if(v==null||v==='') return null;
  if(typeof v==='string'){
    var s=v.trim().replace(/[$,]/g,'');
    if(!s||/[#?]/.test(s)) return null;
    var f=parseFloat(s);
    return isNaN(f)?null:f;
  }
  var f2=parseFloat(v);
  return isNaN(f2)?null:f2;
}

/* Find the best matching sheet + header row for an "Act vs For Reporting" style layout */
function findReportSheet(wb){
  for(var i=0;i<wb.SheetNames.length;i++){
    var name=wb.SheetNames[i];
    var ws=wb.Sheets[name];
    var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
    for(var r=0;r<Math.min(rows.length,15);r++){
      var row=rows[r]||[];
      var rowStr=row.map(function(c){return c==null?'':String(c).toLowerCase();}).join('|');
      if(rowStr.indexOf('date')>-1 && (rowStr.indexOf('dj')>-1 || rowStr.indexOf('cost')>-1)){
        return {sheetName:name, rows:rows, headerRowIdx:r};
      }
    }
  }
  /* fallback: just use the first sheet raw */
  var first=wb.SheetNames[0];
  var rows0=XLSX.utils.sheet_to_json(wb.Sheets[first],{header:1,raw:true,defval:null});
  return {sheetName:first, rows:rows0, headerRowIdx:0};
}

/* Locate column indices by fuzzy header matching, scanning a couple of header rows
   (matches the "Act vs For Reporting" 2-row header style: labels then Actual/Minimum/etc) */
function locateColumns(rows, headerRowIdx){
  var cols={date:null, dj:null, cost:null, bsActual:null, bsMinimum:null, roiActual:null, roiTarget:null};
  var scanRows=[rows[headerRowIdx]||[], rows[headerRowIdx+1]||[]];
  var bsGroupCol=null;
  scanRows[0].forEach(function(cell,ci){
    var s=(cell==null?'':String(cell)).toLowerCase();
    if(s.indexOf('date')>-1 && cols.date==null) cols.date=ci;
    if((s.indexOf('dj name')>-1||s==='dj') && cols.dj==null) cols.dj=ci;
    if(s.indexOf('dj cost')>-1 && cols.cost==null) cols.cost=ci;
    if(s.indexOf('bottle serv')>-1 && bsGroupCol==null) bsGroupCol=ci;
  });
  /* second row usually has Actual/Minimum labels under the Bottle Service group */
  if(bsGroupCol!=null){
    for(var ci=bsGroupCol; ci<bsGroupCol+6 && ci<scanRows[1].length; ci++){
      var s2=(scanRows[1][ci]==null?'':String(scanRows[1][ci])).toLowerCase();
      if(s2.indexOf('actual')>-1 && cols.bsActual==null) cols.bsActual=ci;
      if(s2.indexOf('min')>-1 && cols.bsMinimum==null) cols.bsMinimum=ci;
    }
  }
  /* generic fallback: scan all header-ish rows for simple column names too */
  if(cols.date==null||cols.dj==null||cols.cost==null){
    scanRows[0].forEach(function(cell,ci){
      var s=(cell==null?'':String(cell)).toLowerCase();
      if(s==='date'&&cols.date==null) cols.date=ci;
      if((s==='dj'||s==='dj name'||s==='guest dj')&&cols.dj==null) cols.dj=ci;
      if((s==='cost'||s==='fee'||s==='dj fee')&&cols.cost==null) cols.cost=ci;
      if((s==='bs actual'||s==='bottle service actual')&&cols.bsActual==null) cols.bsActual=ci;
      if((s==='bs target'||s==='bs minimum')&&cols.bsMinimum==null) cols.bsMinimum=ci;
    });
  }
  return cols;
}

function parseImportWorkbook(wb, fileName){
  var found=findReportSheet(wb);
  var cols=locateColumns(found.rows, found.headerRowIdx);

  if(cols.date==null || cols.bsActual==null){
    document.getElementById('importResult').innerHTML='<div class="import-err">Could not find Date / BS Actual columns in "'+found.sheetName+'". Make sure the file has a Date column and a Bottle Service Actual column, similar to the minimum reporting files.</div>';
    return;
  }

  var dataRows=found.rows.slice(found.headerRowIdx+2); /* skip header + sub-header rows */
  var parsed=[];
  dataRows.forEach(function(row){
    var dateISO=excelDateToISO(row[cols.date]);
    if(!dateISO || !dateISO.startsWith('20')) return;
    var dj = cols.dj!=null ? (row[cols.dj]!=null?String(row[cols.dj]).trim():null) : null;
    var cost = cols.cost!=null ? numOrNull(row[cols.cost]) : null;
    var bsA = numOrNull(row[cols.bsActual]);
    var bsM = cols.bsMinimum!=null ? numOrNull(row[cols.bsMinimum]) : null;
    if(bsA==null && !dj && cost==null) return; /* skip fully blank rows */
    parsed.push({d:dateISO, dj:dj, cost:cost, bs_a:bsA, bs_m:bsM});
  });

  _importPendingRows = parsed;

  document.getElementById('importStep1').style.display='none';
  document.getElementById('importStep2').style.display='';
  document.getElementById('importConfirmBtn').style.display='';
  document.getElementById('importPreviewInfo').innerHTML =
    '<b>'+fileName+'</b>   sheet "'+found.sheetName+'"   found <b>'+parsed.length+'</b> dated rows with data.';

  var previewRows = parsed.slice(0,8);
  var ph='<table class="import-preview-tbl"><thead><tr><th>Date</th><th>DJ</th><th>Cost</th><th>BS Actual</th><th>BS Target</th></tr></thead><tbody>';
  previewRows.forEach(function(r){
    ph+='<tr><td>'+r.d+'</td><td>'+(r.dj||'-')+'</td><td>'+(r.cost!=null?'$'+r.cost.toLocaleString():'-')+'</td>'
      +'<td>'+(r.bs_a!=null?'$'+r.bs_a.toLocaleString():'-')+'</td><td>'+(r.bs_m!=null?'$'+r.bs_m.toLocaleString():'-')+'</td></tr>';
  });
  ph+='</tbody></table>';
  if(parsed.length>8) ph+='<div style="font-size:9px;color:var(--ink3);margin-top:4px">+ '+(parsed.length-8)+' more rows</div>';
  document.getElementById('importPreview').innerHTML=ph;
}

function confirmImport(){
  if(!_importPendingRows || !_importPendingRows.length) return;
  var venue=document.getElementById('importVenueSel').value;
  var updated=0, added=0, skipped=0;
  var beforeSched=_clone(SCHED), beforeBs=_clone(BS);
  pushUndo('Import Excel actuals: '+venue,function(){
    SCHED=_clone(beforeSched)||[];
    BS=_clone(beforeBs)||[];
    IDX=buildIdx(SCHED);
  });

  _importPendingRows.forEach(function(row){
    if(row.bs_a==null){ skipped++; return; }

    /* Update / create the BS record */
    var bsRec = BS.find(function(b){ return b.venue===venue && b.d===row.d; });
    if(bsRec){
      bsRec.bs_a = row.bs_a;
      if(row.bs_m!=null) bsRec.bs_m = row.bs_m;
      if(row.cost!=null) bsRec.cost = row.cost;
      if(row.dj) bsRec.dj = row.dj;
      if(bsRec.cost) bsRec.roi_a = +(bsRec.bs_a/bsRec.cost).toFixed(4);
      if(bsRec.bs_m && bsRec.cost) bsRec.roi_t = +(bsRec.bs_m/bsRec.cost).toFixed(4);
      if(bsRec.roi_a!=null && bsRec.roi_t!=null) bsRec.beat = bsRec.roi_a>=bsRec.roi_t?1:0;
      updated++;
    } else {
      var newBs={venue:venue, yr:parseInt(row.d.slice(0,4),10), d:row.d, dj:row.dj,
        cost:row.cost, bs_a:row.bs_a, bs_m:row.bs_m, roi_a:null, roi_t:null, beat:null};
      if(newBs.cost) newBs.roi_a=+(newBs.bs_a/newBs.cost).toFixed(4);
      if(newBs.bs_m && newBs.cost) newBs.roi_t=+(newBs.bs_m/newBs.cost).toFixed(4);
      if(newBs.roi_a!=null && newBs.roi_t!=null) newBs.beat=newBs.roi_a>=newBs.roi_t?1:0;
      BS.push(newBs);
      added++;
    }

    /* Cascade to the matching SCHED record so Calendar/Accounting reflect it too */
    var schedRec = SCHED.find(function(s){ return s.v===venue && s.d===row.d; });
    if(schedRec){
      schedRec.bs_a = row.bs_a;
      if(row.bs_m!=null) schedRec.bs_m = row.bs_m;
      if(row.cost!=null && !schedRec.fee) schedRec.fee = row.cost;
      if(row.dj && !schedRec.dj) schedRec.dj = row.dj;
      var feeForRoi = schedRec.fee||schedRec.cost;
      if(feeForRoi){
        schedRec.roi_a=+(schedRec.bs_a/feeForRoi).toFixed(4);
        if(schedRec.bs_m) schedRec.roi_t=+(schedRec.bs_m/feeForRoi).toFixed(4);
      }
      if(schedRec.roi_a!=null && schedRec.roi_t!=null){
        var past = schedRec.d<=TODAY;
        schedRec._s = past ? (schedRec.roi_a>=schedRec.roi_t?'beat':'miss') : schedRec._s;
      }
    }
  });

  IDX=buildIdx(SCHED);
  closeImportModal();
  go();
  if(curView==='accounting') renderAccounting();
  if(curView==='budget'&&_budgetInited) renderBudget();
  if(curView==='leaderboard') renderLeaderboard();

  alert('Import complete for '+venue+':\\n'+updated+' existing dates updated\\n'+added+' new dates added\\n'+skipped+' rows skipped (no BS Actual value)');
}

boot();

