/* Venue ROI Rules — full-page editor (standard tiers + special-day performances) */

var _roiPageTab = 'rules'; /* rules | special | floors */
var _roiEditSpecialUid = null;
var _roiSpForceCustom = false;
var _roiSpPrefill = null;
var _roiDatePick = { venue: '', date: '', q: '' };
var _roiEditFloorUid = null;

function _roiSpResolveFee(ev){
  if(ev&&ev.djFee>0) return ev.djFee;
  if(ev&&ev.start&&ev.venue&&typeof SCHED!=='undefined'){
    var fee=0;
    SCHED.forEach(function(r){
      if(!r||r.d!==ev.start) return;
      if((r.v||r.venue)!==ev.venue) return;
      fee=r.fee||r.cost||0;
    });
    if(fee>0) return fee;
  }
  if(_roiSpPrefill&&_roiSpPrefill.djFee>0) return _roiSpPrefill.djFee;
  return 0;
}
function _roiSpFilterRulesForShow(rules, fee, dateStr, showDays){
  if(!rules||!fee||!rules.tiers||!rules.tiers.length) return rules;
  var tier=nearestTier(rules, fee);
  if(!tier) return rules;
  var out=JSON.parse(JSON.stringify(rules));
  out.tiers=[JSON.parse(JSON.stringify(tier))];
  if(showDays&&showDays.length){
    out.days=showDays.slice();
    out.days.sort(function(a,b){ return DOW_NAMES.indexOf(a)-DOW_NAMES.indexOf(b); });
  }
  out._matchedFee=fee;
  out._matchedTierFee=tier.fee;
  return out;
}

function _vrFmtMoney(n){
  if(n==null||n===''||isNaN(+n)) return '';
  return Math.round(+n).toLocaleString('en-US');
}
function _vrParseMoney(s){
  return parseFloat(String(s||'').replace(/[^0-9.-]/g,''))||0;
}
function _vrMoneyInputHtml(val, cls, attrs){
  cls=cls||'vr-cell-inp';
  attrs=attrs||'';
  return '<span class="vr-money-wrap"><span class="vr-money-sym">$</span>'
    +'<input type="text" inputmode="numeric" class="'+cls+' vr-money-inp" value="'+_vrFmtMoney(val)+'" '+attrs+'></span>';
}
function _vrFeeInputHtml(val, cls, attrs){
  return _vrMoneyInputHtml(val, (cls||'vr-fee-inp')+' vr-fee-inp', attrs);
}
function wireVenueRulesMoneyInputs(root){
  (root||document).querySelectorAll('.vr-money-inp').forEach(function(inp){
    if(inp._vrMoneyWired) return;
    inp._vrMoneyWired=true;
    inp.addEventListener('blur',function(){
      var n=_vrParseMoney(inp.value);
      inp.value=n?_vrFmtMoney(n):'';
      if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
    });
    inp.addEventListener('focus',function(){
      inp.value=String(_vrParseMoney(inp.value)||'');
      inp.select();
    });
    inp.addEventListener('input',function(){
      if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
    });
  });
  if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
}

function _roiFmtUsd(n){
  n=Math.round(+n||0);
  return '$'+n.toLocaleString('en-US');
}
function _roiTierHeaderHtml(tableCats, counts){
  var h='';
  (tableCats||[]).forEach(function(c){
    var n=typeof roiCountForCat==='function'?roiCountForCat(counts, c):0;
    h+='<th class="vr-th-tier">'+_escRoi(c)+'<span class="vr-th-sub">×'+n+' tables · min $</span></th>';
  });
  return h;
}
function _roiVerifyBlockHtml(rules, countsMeta, tier, ti, days, seasons){
  var counts=(countsMeta&&countsMeta.counts)||{};
  var cats=rules.tableCats||[];
  var h='<div class="vr-verify" data-verify-ti="'+ti+'">';
  h+='<div class="vr-verify-hd">Verify · tables × min vs BS Target</div>';
  if(countsMeta&&countsMeta.badge){
    h+='<div class="vr-verify-plan">Floor plan: '+_escRoi(countsMeta.badge);
    var bits=[];
    cats.forEach(function(c){
      bits.push(c+'×'+(typeof roiCountForCat==='function'?roiCountForCat(counts,c):0));
    });
    if(bits.length) h+=' <span class="roi-page-hint">('+_escRoi(bits.join(' · '))+')</span>';
    h+='</div>';
  }
  h+='<table class="vr-verify-tbl"><thead><tr><th>Season</th><th>Day</th><th class="left">Capacity (Σ count×min)</th><th>BS Target</th><th>BS − Capacity</th><th>Status</th></tr></thead><tbody>';
  (seasons||['High','Low']).forEach(function(season){
    (days||[]).forEach(function(day){
      var dayData=(tier[season]||{})[day]||{roi:0,sales:0,tables:{}};
      var v=typeof roiVerifyCapacity==='function'
        ? roiVerifyCapacity(dayData.sales, dayData.tables, cats, counts)
        : {sum:0,bs:+dayData.sales||0,gap:0,hit:null};
      var stCls=v.hit===true?'vr-verify-hit':(v.hit===false?'vr-verify-miss':'vr-verify-na');
      var stLbl=v.hit===true?'HIT':(v.hit===false?'SHORT':'—');
      h+='<tr class="'+stCls+'" data-verify-row data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'">';
      h+='<td>'+season+'</td><td>'+day.slice(0,3)+'</td>';
      h+='<td class="left vr-verify-cap">'+_roiFmtUsd(v.sum)+'</td>';
      h+='<td class="vr-verify-bs">'+_roiFmtUsd(v.bs)+'</td>';
      h+='<td class="vr-verify-gap">'+_roiFmtUsd(v.gap)+'</td>';
      h+='<td class="vr-verify-status"><span class="vr-verify-pill">'+stLbl+'</span></td>';
      h+='</tr>';
    });
  });
  h+='</tbody></table>';
  h+='<div class="vr-verify-hint">Green = capacity (all tiers × their mins) ≥ BS Target. Red = short. Gap = BS Target − capacity.</div>';
  h+='</div>';
  return h;
}
function roiRefreshVerifyBlocks(root){
  root=root||document;
  var counts={};
  try{
    var metaEl=root.querySelector('[data-roi-counts]');
    if(metaEl) counts=JSON.parse(metaEl.getAttribute('data-roi-counts')||'{}');
  }catch(e){ counts={}; }
  root.querySelectorAll('[data-verify-row]').forEach(function(tr){
    var ti=tr.getAttribute('data-ti');
    var season=tr.getAttribute('data-season');
    var day=tr.getAttribute('data-day');
    var cats=[];
    try{
      var catsEl=root.querySelector('[data-roi-cats]');
      if(catsEl) cats=JSON.parse(catsEl.getAttribute('data-roi-cats')||'[]');
    }catch(e2){}
    var salesInp=root.querySelector('.vr-target-inp[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"], .roi-sp-sales[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"]');
    var bs=salesInp?_vrParseMoney(salesInp.value):0;
    var tables={};
    cats.forEach(function(c){
      var inp=root.querySelector('.vr-cell-sm[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"][data-cat="'+c+'"], .roi-sp-tbl[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"][data-cat="'+c+'"]');
      tables[c]=inp?_vrParseMoney(inp.value):0;
    });
    var v=typeof roiVerifyCapacity==='function'?roiVerifyCapacity(bs, tables, cats, counts):{sum:0,bs:bs,gap:bs,hit:null};
    var cap=tr.querySelector('.vr-verify-cap');
    var bsEl=tr.querySelector('.vr-verify-bs');
    var gap=tr.querySelector('.vr-verify-gap');
    var st=tr.querySelector('.vr-verify-status .vr-verify-pill');
    if(cap) cap.textContent=_roiFmtUsd(v.sum);
    if(bsEl) bsEl.textContent=_roiFmtUsd(v.bs);
    if(gap) gap.textContent=_roiFmtUsd(v.gap);
    tr.classList.remove('vr-verify-hit','vr-verify-miss','vr-verify-na');
    if(v.hit===true){ tr.classList.add('vr-verify-hit'); if(st) st.textContent='HIT'; }
    else if(v.hit===false){ tr.classList.add('vr-verify-miss'); if(st) st.textContent='SHORT'; }
    else { tr.classList.add('vr-verify-na'); if(st) st.textContent='—'; }
  });
}

function openVenueRulesEditor(){
  if(typeof setView==='function') setView('roi-rules');
}

function closeVenueRulesEditor(){ /* legacy modal hook — page replaces modal */ }

function renderRoiRulesPage(){
  ensureCnbcSummerRoofRules();
  var root=document.getElementById('roiRulesBody');
  if(!root) return;

  var h='';
  h+='<div class="roi-page-hero">';
  h+='<div class="roi-page-hero-text">';
  h+='<h2>Venue ROI Rules</h2>';
  h+='<p>BS Target, ROI Target, VIP table minimums, and forecast table counts for Calendar, Budget, Forecast, Accounting, and 3D View.</p>';
  h+='<p class="roi-page-hint">Nearest fee tier applies when a DJ fee falls between anchors. BS Target stays fixed; ROI Target recalculates when the fee does not match the tier anchor.</p>';
  h+='</div></div>';

  h+='<div class="roi-subtabs">';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='rules'?' on':'')+'" onclick="setRoiPageTab(\'rules\')"><span class="roi-subtab-ic">&#9881;</span> Standard venue rules</button>';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='special'?' on':'')+'" onclick="setRoiPageTab(\'special\')"><span class="roi-subtab-ic">&#9733;</span> Special performances</button>';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='floors'?' on':'')+'" onclick="setRoiPageTab(\'floors\')"><span class="roi-subtab-ic">&#127760;</span> 3D Floor plans</button>';
  h+='</div>';

  if(_roiPageTab==='rules'){
    h+='<div id="vrTabs"></div>';
    h+='<div id="vrBody" class="roi-rules-body"></div>';
  }else if(_roiPageTab==='floors'){
    h+=renderRoiFloorPlansSection();
  }else{
    h+=renderRoiSpecialSection();
  }

  root.innerHTML=h;
  if(_roiPageTab==='rules'){
    if(!_vrEditVenue||!VENUE_ROI_RULES[_vrEditVenue]){
      var keys=Object.keys(VENUE_ROI_RULES);
      _vrEditVenue=keys[0];
    }
    renderVenueRulesPanel();
  }else if(_roiPageTab==='special'){
    wireRoiSpecialEvents();
  }
}

function setRoiPageTab(tab){
  _roiPageTab=tab;
  _roiEditSpecialUid=null;
  _roiEditFloorUid=null;
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  renderRoiRulesPage();
}

function _roiSpeUid(){
  return 'spe_'+Math.random().toString(36).slice(2,8)+'_'+Date.now().toString(36).slice(-4);
}

function _roiSpeList(){
  return Object.keys(ROI_SPECIAL_EVENTS||{}).map(function(uid){
    var ev=ROI_SPECIAL_EVENTS[uid];
    if(!ev) return null;
    return Object.assign({_uid:uid}, ev);
  }).filter(Boolean).sort(function(a,b){
    return (a.start||'').localeCompare(b.start||'');
  });
}

function _roiRulesTemplateOptions(selected){
  ensureCnbcSummerRoofRules();
  var opts=[
    {v:'Casa Neos Beach Club', l:'Casa Neos Beach Club (regular)'},
    {v:CNBC_SUMMER_ROOF_KEY, l:'CNBC Sunset Rituals Rooftop (Aug–Sep)'},
    {v:'Casa Neos Lounge', l:'Casa Neos Lounge'},
    {v:'MILA Lounge', l:'MILA Lounge'},
    {v:'__custom__', l:'Custom (clone & edit tiers below)'}
  ];
  return opts.map(function(o){
    return '<option value="'+o.v+'"'+(selected===o.v?' selected':'')+'>'+o.l+'</option>';
  }).join('');
}

function renderRoiSpecialSection(){
  var h='';
  h+='<div class="roi-special-intro">';
  h+='<p>Pick a <b>specific date</b> below to apply <b>High</b> or <b>Low</b> season ROI rules, or open a full <b>Special ROI</b> rule (custom targets / off-schedule days).</p>';
  h+='<p class="roi-page-hint">Click the date field to open the calendar, or type/search a date, label, or venue. Example: Casa Neos BC Labor Day Monday → High or Low season, or a custom special.</p>';
  h+='</div>';

  h+=renderRoiDateAssignBar();

  h+='<div class="roi-special-toolbar">';
  h+='<button type="button" class="btn-add" onclick="openRoiSpecialForm()">+ Add special performance</button>';
  h+='</div>';

  if(_roiEditSpecialUid!==null){
    h+=renderRoiSpecialForm(_roiEditSpecialUid);
  }

  var list=_roiSpeListFiltered();
  h+='<div class="roi-special-list">';
  h+='<div class="roi-section-title">Saved specials'+(list.length?' <span class="roi-page-hint" style="font-weight:600">('+list.length+')</span>':'')+'</div>';
  if(!list.length){
    h+='<div class="roi-empty">No specials match'+( _roiDatePick.q||_roiDatePick.date ? ' your search' : ' yet')+'. Pick a date above or add one.</div>';
  }else{
    h+='<table class="fcast-tbl roi-special-tbl"><thead><tr>';
    h+='<th class="left">Label</th><th class="left">Venue</th><th>Dates</th><th>Days</th><th>Rules</th><th>Floor plan</th><th></th>';
    h+='</tr></thead><tbody>';
    list.forEach(function(ev){
      var rulesLbl=ev.forceSeason?('Season: '+ev.forceSeason):(ev.rules&&ev.rules.tiers?'Custom':(ev.rulesVenue||'Auto'));
      if(rulesLbl===CNBC_SUMMER_ROOF_KEY) rulesLbl='Sunset Rituals';
      var days=(ev.days&&ev.days.length)?ev.days.map(function(d){return d.slice(0,3);}).join(', '):'All in range';
      if(ev.extraDays&&ev.extraDays.length){
        days+=(days?' + ':'')+ev.extraDays.map(function(d){return d.slice(0,3);}).join(', ')+' (extra)';
      }
      var fp=ev.floorPlan==='summer'?'Sunset 20'
        :(ev.floorPlan==='casa-neos-beach-club-new'?'CNBC waterfront'
        :(ev.floorPlan==='casa-neos-lounge-new'?'CNL remodel'
        :(ev.floorPlan==='casa-neos-lounge'?'CNL classic'
        :(ev.floorPlan==='regular'?'Regular':'Auto'))));
      h+='<tr>';
      h+='<td class="left" style="font-weight:800">'+_escRoi(ev.label||'Untitled')+'</td>';
      h+='<td class="left">'+_escRoi(ev.venue||'')+'</td>';
      h+='<td style="font-size:11px"><button type="button" class="roi-date-chip" onclick="roiJumpToDate(\''+_escRoi(ev.venue||'')+'\',\''+ev.start+'\')" title="Select this date">'+ev.start+(ev.end!==ev.start?' → '+ev.end:'')+'</button></td>';
      h+='<td style="font-size:10px">'+days+'</td>';
      h+='<td style="font-size:10px">'+_escRoi(rulesLbl)+'</td>';
      h+='<td style="font-size:10px">'+fp+'</td>';
      h+='<td style="white-space:nowrap">';
      h+='<button type="button" class="roi-mini-btn" onclick="openRoiSpecialForm(\''+ev._uid+'\')">Edit</button> ';
      h+='<button type="button" class="roi-mini-btn roi-mini-del" onclick="deleteRoiSpecial(\''+ev._uid+'\')">Delete</button>';
      h+='</td></tr>';
    });
    h+='</tbody></table>';
  }
  h+='</div>';

  h+=renderRoiSpecialUpcoming();
  return h;
}

function _roiSpeListFiltered(){
  var list=_roiSpeList();
  var q=String(_roiDatePick.q||'').trim().toLowerCase();
  var d=String(_roiDatePick.date||'').trim();
  var v=String(_roiDatePick.venue||'').trim();
  return list.filter(function(ev){
    if(v && ev.venue!==v) return false;
    if(d){
      if(!(ev.start<=d && ev.end>=d) && ev.start!==d && ev.end!==d) return false;
    }
    if(!q) return true;
    var blob=((ev.label||'')+' '+(ev.venue||'')+' '+(ev.start||'')+' '+(ev.end||'')+' '+(ev.forceSeason||'')+' '+(ev.rulesVenue||'')).toLowerCase();
    return blob.indexOf(q)>=0;
  });
}

function renderRoiDateAssignBar(){
  var venues=(typeof listActiveVenues==='function'?listActiveVenues():['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge']);
  if(!_roiDatePick.venue) _roiDatePick.venue=curV||venues[0]||'';
  var h='<div class="roi-date-bar" id="roiDateBar">';
  h+='<div class="roi-date-bar-hd">Select a date</div>';
  h+='<div class="roi-date-bar-grid">';
  h+='<div class="fld"><label>Venue</label><select id="roiDateVenue" onchange="_roiDatePick.venue=this.value;roiRefreshDateInspect()">';
  venues.forEach(function(v){
    h+='<option value="'+_escRoi(v)+'"'+(v===_roiDatePick.venue?' selected':'')+'>'+_escRoi(v)+'</option>';
  });
  h+='</select></div>';
  h+='<div class="fld"><label>Date (click to pick)</label><input id="roiDatePick" type="date" value="'+(_roiDatePick.date||'')+'" onchange="_roiDatePick.date=this.value;roiRefreshDateInspect()"></div>';
  h+='<div class="fld"><label>Search specials</label><input id="roiDateSearch" type="search" placeholder="Label, date, venue…" value="'+_escRoi(_roiDatePick.q||'')+'" oninput="_roiDatePick.q=this.value;roiFilterSpecialList()"></div>';
  h+='</div>';
  h+='<div class="roi-date-actions">';
  h+='<button type="button" class="roi-season-btn roi-season-high" onclick="roiAssignSeasonForDate(\'High\')">Apply High season ROI</button>';
  h+='<button type="button" class="roi-season-btn roi-season-low" onclick="roiAssignSeasonForDate(\'Low\')">Apply Low season ROI</button>';
  h+='<button type="button" class="btn-add" onclick="roiOpenSpecialForPickedDate()">Special ROI rules…</button>';
  h+='</div>';
  h+='<div id="roiDateInspect" class="roi-date-inspect">'+_roiDateInspectHtml()+'</div>';
  h+='</div>';
  return h;
}

function _roiFeeOnDate(venue, dateStr){
  var fee=0;
  if(typeof SCHED==='undefined'||!dateStr) return fee;
  SCHED.forEach(function(r){
    if(!r||r.d!==dateStr) return;
    if((r.v||r.venue)!==venue) return;
    var f=+(r.fee||r.cost||0)||0;
    if(f>fee) fee=f;
  });
  return fee;
}

function _roiShowsOnDate(venue, dateStr){
  var out=[];
  if(typeof SCHED==='undefined'||!dateStr) return out;
  SCHED.forEach(function(r){
    if(!r||r.d!==dateStr) return;
    if(venue && (r.v||r.venue)!==venue) return;
    out.push(r);
  });
  return out;
}

function _roiDateInspectHtml(){
  var venue=_roiDatePick.venue||'';
  var dateStr=_roiDatePick.date||'';
  if(!dateStr){
    return '<div class="roi-page-hint">Choose a date (or click a date chip in the list) to preview Calendar targets and assign High / Low / Special rules.</div>';
  }
  var day=typeof dayNameFor==='function'?dayNameFor(dateStr):'';
  var fee=_roiFeeOnDate(venue, dateStr);
  var shows=_roiShowsOnDate(venue, dateStr);
  var sp=typeof roiSpecialEventFor==='function'?roiSpecialEventFor(venue, dateStr):null;
  var look=(fee>0 && typeof venueRoiLookup==='function')?venueRoiLookup(venue, dateStr, fee):null;
  var natural=typeof seasonFor==='function'?seasonFor(
    (typeof effectiveRoiVenue==='function'?effectiveRoiVenue(venue, dateStr, fee):venue),
    dateStr
  ):'';
  var h='<div class="roi-inspect-card">';
  h+='<div class="roi-inspect-title">'+_escRoi(venue)+' · <button type="button" class="roi-date-chip" onclick="document.getElementById(\'roiDatePick\').showPicker&&document.getElementById(\'roiDatePick\').showPicker()">'+dateStr+'</button> <span class="roi-page-hint">('+day+')</span></div>';
  if(shows.length){
    h+='<div class="roi-inspect-shows">Shows: '+shows.map(function(r){
      return '<b>'+_escRoi(r.dj||'TBD')+'</b> ($'+((r.fee||r.cost||0).toLocaleString? (r.fee||r.cost||0).toLocaleString():(r.fee||r.cost||0))+')';
    }).join(' · ')+'</div>';
  }else{
    h+='<div class="roi-inspect-shows roi-page-hint">No show booked on Calendar for this venue/date — you can still assign season or special rules.</div>';
  }
  if(sp){
    var spUid=_roiUidForSpecial(sp);
    h+='<div class="roi-inspect-sp">Existing special: <b>'+_escRoi(sp.label||'')+'</b>'
      +(sp.forceSeason?(' · forced <b>'+sp.forceSeason+'</b> season'):'')
      +(spUid?(' <button type="button" class="roi-mini-btn" onclick="openRoiSpecialForm(\''+spUid+'\')">Edit</button>'):'')
      +'</div>';
  }
  if(look){
    h+='<div class="roi-inspect-targets">Current targets → BS <b>$'+(look.bsTarget!=null?Math.round(look.bsTarget).toLocaleString():'—')+'</b> · ROI <b>'+(look.roiTarget!=null?look.roiTarget+'x':'—')+'</b> · season <b>'+look.season+'</b>'
      +(look.specialEvent?(' · via “'+_escRoi(look.specialEvent)+'”'):(' · calendar default '+natural))
      +'</div>';
  }else if(fee===0){
    h+='<div class="roi-inspect-targets">Fee <b>$0</b> → BS target <b>—</b> · ROI <b>0</b> (no target).</div>';
  }else if(fee<=0){
    h+='<div class="roi-page-hint">Add a DJ fee on Calendar to preview BS / ROI targets for this date.</div>';
  }else{
    h+='<div class="roi-page-hint">No matching ROI tier for this day (off-schedule). Use Special ROI rules or Apply High/Low (adds the weekday as an extra day).</div>';
  }
  h+='</div>';
  return h;
}

function roiRefreshDateInspect(){
  var venueEl=document.getElementById('roiDateVenue');
  var dateEl=document.getElementById('roiDatePick');
  if(venueEl) _roiDatePick.venue=venueEl.value;
  if(dateEl) _roiDatePick.date=dateEl.value;
  var box=document.getElementById('roiDateInspect');
  if(box) box.innerHTML=_roiDateInspectHtml();
  roiFilterSpecialList();
}

function roiFilterSpecialList(){
  var qEl=document.getElementById('roiDateSearch');
  if(qEl) _roiDatePick.q=qEl.value;
  var venueEl=document.getElementById('roiDateVenue');
  var dateEl=document.getElementById('roiDatePick');
  if(venueEl) _roiDatePick.venue=venueEl.value;
  if(dateEl) _roiDatePick.date=dateEl.value;
  var caret=qEl?qEl.selectionStart:null;
  renderRoiRulesPage();
  var again=document.getElementById('roiDateSearch');
  if(again){
    again.focus();
    try{ again.setSelectionRange(caret!=null?caret:again.value.length, caret!=null?caret:again.value.length); }catch(e){}
  }
}

function _roiUidForSpecial(sp){
  if(!sp) return '';
  if(sp._uid) return sp._uid;
  var found='';
  Object.keys(ROI_SPECIAL_EVENTS||{}).forEach(function(uid){
    if(ROI_SPECIAL_EVENTS[uid]===sp) found=uid;
  });
  return found;
}

function roiJumpToDate(venue, dateStr){
  _roiDatePick.venue=venue||_roiDatePick.venue;
  _roiDatePick.date=dateStr||'';
  _roiPageTab='special';
  renderRoiRulesPage();
  setTimeout(function(){
    var el=document.getElementById('roiDateBar');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  },40);
}

function roiOpenSpecialForPickedDate(){
  var venue=(document.getElementById('roiDateVenue')||{}).value||_roiDatePick.venue;
  var dateStr=(document.getElementById('roiDatePick')||{}).value||_roiDatePick.date;
  if(!dateStr){ alert('Pick a date first (click the date field).'); return; }
  _roiDatePick.venue=venue; _roiDatePick.date=dateStr;
  var shows=_roiShowsOnDate(venue, dateStr);
  var dj=shows[0]&&shows[0].dj?shows[0].dj:'Special';
  openRoiSpecialFormForShow(venue, dateStr, dj);
}

function roiAssignSeasonForDate(season){
  if(season!=='High'&&season!=='Low') return;
  var venue=(document.getElementById('roiDateVenue')||{}).value||_roiDatePick.venue;
  var dateStr=(document.getElementById('roiDatePick')||{}).value||_roiDatePick.date;
  if(!venue||!dateStr){ alert('Pick a venue and date first.'); return; }
  _roiDatePick.venue=venue; _roiDatePick.date=dateStr;
  var day=dayNameFor(dateStr);
  var fee=_roiFeeOnDate(venue, dateStr);
  var rulesVenue=(typeof effectiveRoiVenue==='function')?effectiveRoiVenue(venue, dateStr, fee||0):venue;
  var rules=VENUE_ROI_RULES[rulesVenue];
  var offDay=!(rules&&rules.days&&rules.days.indexOf(day)>-1);
  var dateLbl='';
  try{
    dateLbl=new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }catch(e){ dateLbl=dateStr; }

  /* Update existing special covering this exact single day, else create */
  var existingUid=null;
  Object.keys(ROI_SPECIAL_EVENTS||{}).forEach(function(uid){
    var ev=ROI_SPECIAL_EVENTS[uid];
    if(!ev||ev.venue!==venue) return;
    if(ev.start===dateStr&&ev.end===dateStr) existingUid=uid;
  });
  var uid=existingUid||_roiSpeUid();
  var fp='auto';
  if(venue==='Casa Neos Beach Club'&&typeof isCnbcSummerFloor==='function'&&isCnbcSummerFloor(dateStr)) fp='summer';
  var rec={
    _uid:uid,
    label:season+' season · '+dateLbl,
    venue:venue,
    start:dateStr,
    end:dateStr,
    forceSeason:season,
    rulesVenue:rulesVenue,
    rules:null,
    floorPlan:fp,
    days:[day],
    extraDays:offDay?[day]:[],
    dayTemplate:(rules&&rules.days&&rules.days.indexOf('Sunday')>-1)?'Sunday':((rules&&rules.days&&rules.days[0])||'Sunday'),
    djFee:fee||0,
    updatedAt:new Date().toISOString()
  };
  ROI_SPECIAL_EVENTS[uid]=rec;
  saveRoiSpecialEvents();
  if(typeof refreshAllRoiDerivedData==='function') refreshAllRoiDerivedData();
  else if(typeof recalcAllSchedTargets==='function') recalcAllSchedTargets();
  _roiEditSpecialUid=null;
  renderRoiRulesPage();
}

function renderRoiSpecialUpcoming(){
  var today=new Date(); today.setHours(0,0,0,0);
  var todayStr=today.toISOString().split('T')[0];
  var shows=[];
  if(typeof SCHED!=='undefined'){
    SCHED.forEach(function(r){
      if(!r||!r.d||r.d<todayStr) return;
      var v=r.v||r.venue;
      if(roiSpecialEventFor(v, r.d)) return;
      var day=dayNameFor(r.d);
      var rv=effectiveRoiVenue(v, r.d, r.fee||r.cost||0);
      var rules=VENUE_ROI_RULES[rv];
      var offDay=rules&&rules.days&&rules.days.indexOf(day)===-1;
      if(offDay) shows.push({r:r,v:v,day:day});
    });
  }
  shows.sort(function(a,b){ return a.r.d.localeCompare(b.r.d); });
  if(!shows.length) return '';
  var h='<div class="roi-special-upcoming"><div class="roi-section-title">Needs a special rule</div>';
  h+='<p class="roi-page-hint" style="margin:-4px 0 10px">Off-schedule shows without a special performance rule. Click a row to set Target, ROI, and table mins for that date.</p>';
  h+='<table class="fcast-tbl roi-alert-tbl"><thead><tr><th class="left">Date</th><th class="left">Venue</th><th class="left">DJ</th><th>Day</th><th>Action</th></tr></thead><tbody>';
  shows.slice(0,16).forEach(function(row){
    h+='<tr class="roi-alert-row" tabindex="0" role="button" data-venue="'+_escRoi(row.v)+'" data-date="'+row.r.d+'" data-dj="'+_escRoi(row.r.dj||'TBD')+'" onclick="openRoiSpecialFormFromRow(this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openRoiSpecialFormFromRow(this);}">';
    h+='<td class="left">'+row.r.d+'</td><td class="left">'+_escRoi(row.v)+'</td><td class="left" style="font-weight:700">'+_escRoi(row.r.dj||'TBD')+'</td><td>'+row.day.slice(0,3)+'</td>';
    h+='<td><span class="roi-alert-cta">No special rule — add one &#8594;</span></td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

function openRoiSpecialFormFromRow(tr){
  if(!tr||!tr.dataset) return;
  openRoiSpecialFormForShow(tr.dataset.venue||'', tr.dataset.date||'', tr.dataset.dj||'');
}

function openRoiSpecialFormForShow(venue, dateStr, djName){
  _roiPageTab='special';
  _roiEditSpecialUid='__new__';
  _roiSpForceCustom=true;
  var day=dayNameFor(dateStr);
  var fee=0;
  if(typeof SCHED!=='undefined'){
    SCHED.forEach(function(r){
      if(!r||r.d!==dateStr) return;
      if((r.v||r.venue)!==venue) return;
      fee=r.fee||r.cost||0;
    });
  }
  var rv=effectiveRoiVenue(venue, dateStr, fee);
  var rules=_cloneVenueRules(rv);
  if(rules){
    if(rules.days.indexOf(day)===-1){
      rules.days=rules.days.slice();
      rules.days.push(day);
      rules.days.sort(function(a,b){ return DOW_NAMES.indexOf(a)-DOW_NAMES.indexOf(b); });
    }
    var templateDay=rules.days.indexOf('Sunday')>-1?'Sunday':rules.days[0];
    rules.tiers.forEach(function(tier){
      ['High','Low'].forEach(function(season){
        if(!tier[season]) tier[season]={};
        if(!tier[season][day]){
          var src=(tier[season]||{})[templateDay]||{roi:2,sales:0,tables:{}};
          tier[season][day]=JSON.parse(JSON.stringify(src));
        }
      });
    });
  }
  var dateLbl='';
  try{
    var dObj=new Date(dateStr+'T12:00:00');
    dateLbl=dObj.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }catch(e){ dateLbl=dateStr; }
  var fp='auto';
  if(venue==='Casa Neos Beach Club'&&typeof isCnbcSummerFloor==='function'&&isCnbcSummerFloor(dateStr)) fp='summer';
  _roiSpPrefill={
    label:(String(djName||'Special').trim()||'Special')+' · '+dateLbl,
    venue:venue, start:dateStr, end:dateStr,
    rulesVenue:null, rules:rules, floorPlan:fp,
    extraDays:[day], dayTemplate:'Sunday', days:[day], djFee:fee
  };
  renderRoiRulesPage();
  setTimeout(function(){
    var el=document.getElementById('roiSpecialForm');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  },50);
}

function _escRoi(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

function openRoiSpecialForm(uid){
  _roiEditSpecialUid=uid||'__new__';
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  renderRoiRulesPage();
}

function renderRoiSpecialForm(uid){
  var isNew=uid==='__new__';
  var ev=isNew?(_roiSpPrefill||{
    label:'', venue:curV||'Casa Neos Beach Club',
    start:'', end:'', rulesVenue:CNBC_SUMMER_ROOF_KEY,
    extraDays:['Monday'], dayTemplate:'Sunday', floorPlan:'auto',
    days:[]
  }):Object.assign({}, ROI_SPECIAL_EVENTS[uid]||{});
  if(!ev._uid&& !isNew) ev._uid=uid;

  var venues=(typeof listActiveVenues==='function'?listActiveVenues():['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge']);
  var forceCustom=_roiSpForceCustom||(ev.rules&&ev.rules.tiers);
  var templateSel=forceCustom?'__custom__':(ev.rulesVenue||'Casa Neos Beach Club');

  var h='<div class="roi-special-form" id="roiSpecialForm">';
  h+='<div class="roi-section-title">'+(isNew?'New special performance':'Edit special performance')+'</div>';
  h+='<div class="roi-form-grid">';
  h+='<div class="fld"><label>Label</label><input id="roiSpLabel" type="text" value="'+_escRoi(ev.label)+'" placeholder="Labor Day Monday, NYE, Art Basel..."></div>';
  h+='<div class="fld"><label>Venue</label><select id="roiSpVenue" onchange="roiSpFloorOrVenueChanged()">'+venues.map(function(v){
    return '<option value="'+v+'"'+(v===ev.venue?' selected':'')+'>'+v+'</option>';
  }).join('')+'</select></div>';
  h+='<div class="fld"><label>Start date</label><input id="roiSpStart" type="date" value="'+(ev.start||'')+'"></div>';
  h+='<div class="fld"><label>End date</label><input id="roiSpEnd" type="date" value="'+(ev.end||ev.start||'')+'"></div>';
  h+='<div class="fld"><label>Rule template</label><select id="roiSpTemplate" onchange="toggleRoiSpCustom()">'+_roiRulesTemplateOptions(templateSel)+'</select></div>';
  h+='<div class="fld"><label>Season for this date</label><select id="roiSpForceSeason">';
  [{v:'',l:'Auto (High/Low by month)'},{v:'High',l:'Force High season'},{v:'Low',l:'Force Low season'}].forEach(function(o){
    h+='<option value="'+o.v+'"'+((ev.forceSeason||'')===o.v?' selected':'')+'>'+o.l+'</option>';
  });
  h+='</select></div>';
  h+='<div class="fld"><label>Floor plan</label><select id="roiSpFloor" onchange="roiSpFloorOrVenueChanged()">';
  [{v:'auto',l:'Auto (date / floor-plan drops)'},{v:'summer',l:'Sunset rooftop — 20 tables (BC)'},{v:'casa-neos-beach-club-new',l:'CNBC waterfront + slips (Oct 2026+)'},{v:'casa-neos-lounge-new',l:'CN Lounge remodel (Sep 2026+)'},{v:'casa-neos-lounge',l:'CN Lounge classic'},{v:'regular',l:'Regular / classic venue plan'}].forEach(function(o){
    h+='<option value="'+o.v+'"'+(ev.floorPlan===o.v?' selected':'')+'>'+o.l+'</option>';
  });
  h+='</select></div>';
  h+='</div>';

  h+='<div class="vr-days-box"><div class="vr-season-lbl">Limit to specific days in range (optional)</div>';
  h+='<div class="vr-month-grid" id="roiSpDaysFilter">';
  DOW_NAMES.forEach(function(d){
    var on=!ev.days||!ev.days.length||ev.days.indexOf(d)>-1;
    h+='<button type="button" class="vr-month-btn roi-sp-day'+(on?' on':'')+'" data-day="'+d+'">'+d.slice(0,3)+'</button>';
  });
  h+='</div><div class="vr-season-hint">Leave all selected to apply to every day in the date range.</div></div>';

  h+='<div class="vr-days-box"><div class="vr-season-lbl">Extra off-schedule days (e.g. Monday at BC)</div>';
  h+='<div class="vr-month-grid" id="roiSpExtraDays">';
  DOW_NAMES.forEach(function(d){
    var on=(ev.extraDays||[]).indexOf(d)>-1;
    h+='<button type="button" class="vr-month-btn roi-sp-extra'+(on?' on':'')+'" data-day="'+d+'">'+d.slice(0,3)+'</button>';
  });
  h+='</div><div class="vr-season-hint">For days not in the standard venue schedule. Tier data defaults to the <select id="roiSpDayTemplate" style="font-size:10px;padding:2px 4px">';
  DOW_NAMES.forEach(function(d){
    h+='<option value="'+d+'"'+(ev.dayTemplate===d?' selected':'')+'>'+d+'</option>';
  });
  h+='</select> column unless you customize tiers below.</div></div>';

  h+='<div id="roiSpCustomWrap" class="roi-tier-editor-wrap"'+(templateSel!=='__custom__'?' style="display:none"':'')+'>';
  h+='<div class="roi-tier-editor-hd"><span class="vr-season-lbl">ROI, BS Target &amp; table minimums</span>';
  h+='<span class="roi-page-hint" id="roiSpTierHint">Shows only the fee tier this DJ falls into.</span></div>';
  h+='<div id="roiSpCustomBody"></div>';
  h+='</div>';

  h+='<div class="roi-form-actions">';
  h+='<button type="button" class="btn-cancel" onclick="cancelRoiSpecialForm()">Cancel</button>';
  h+='<button type="button" class="btn-save" onclick="saveRoiSpecialForm(\''+(isNew?'__new__':uid)+'\')">Save special performance</button>';
  h+='</div></div>';

  setTimeout(function(){
    renderRoiSpCustomEditor(ev);
    wireRoiSpFormToggles();
  },0);
  return h;
}

function toggleRoiSpCustom(){
  var sel=document.getElementById('roiSpTemplate');
  var wrap=document.getElementById('roiSpCustomWrap');
  if(wrap) wrap.style.display=(sel&&sel.value==='__custom__')?'':'none';
  if(sel&&sel.value==='__custom__'){
    var ev={rules:null};
    renderRoiSpCustomEditor(ev);
  }
}
function roiSpFloorOrVenueChanged(){
  var wrap=document.getElementById('roiSpCustomWrap');
  var sel=document.getElementById('roiSpTemplate');
  if(wrap&&wrap.style.display!=='none'&&sel&&sel.value==='__custom__'){
    var body=document.getElementById('roiSpCustomBody');
    var ev={rules:(body&&body._roiSpRules)||null};
    renderRoiSpCustomEditor(ev);
  }
}

function wireRoiSpFormToggles(){
  document.querySelectorAll('.roi-sp-day').forEach(function(btn){
    btn.addEventListener('click',function(){ btn.classList.toggle('on'); });
  });
  document.querySelectorAll('.roi-sp-extra').forEach(function(btn){
    btn.addEventListener('click',function(){ btn.classList.toggle('on'); });
  });
}

function renderRoiSpCustomEditor(ev){
  var body=document.getElementById('roiSpCustomBody');
  if(!body) return;
  var rules=ev.rules;
  if(!rules||!rules.tiers){
    var tmpl=document.getElementById('roiSpTemplate');
    var key=tmpl?tmpl.value:'Casa Neos Beach Club';
    if(key==='__custom__') key='Casa Neos Beach Club';
    rules=_cloneVenueRules(key);
  }
  if(!rules){ body.innerHTML='<div class="roi-empty">Pick a template first.</div>'; return; }
  var fee=_roiSpResolveFee(ev);
  var dateStr=ev.start||(_roiSpPrefill&&_roiSpPrefill.start)||'';
  var days=rules.days||DOW_NAMES;
  var showDays=days;
  if(_roiSpPrefill&&_roiSpPrefill.days&&_roiSpPrefill.days.length) showDays=_roiSpPrefill.days;
  else if(ev.days&&ev.days.length) showDays=ev.days;
  if(fee>0){
    rules=_roiSpFilterRulesForShow(rules, fee, dateStr, showDays);
    var hint=document.getElementById('roiSpTierHint');
    if(hint){
      hint.textContent='DJ fee $'+fee.toLocaleString()+' → nearest tier $'+(rules._matchedTierFee||fee).toLocaleString()+'. Edit Target, ROI, and table mins for this performance only.';
    }
  }
  var seasons=['High','Low'];
  if(dateStr&&typeof seasonFor==='function') seasons=[seasonFor(rules, dateStr)];
  var venue=(document.getElementById('roiSpVenue')||{}).value||(ev.venue)||'Casa Neos Beach Club';
  var floorPlan=(document.getElementById('roiSpFloor')||{}).value||ev.floorPlan||'auto';
  var countsMeta=typeof roiTableCountsForRulesVenue==='function'
    ? roiTableCountsForRulesVenue(venue, {dateStr:dateStr, floorPlan:floorPlan})
    : {counts:{}, badge:''};
  var counts=countsMeta.counts||{};
  var h='';
  h+='<div hidden data-roi-counts=\''+JSON.stringify(counts).replace(/'/g,'&#39;')+'\' data-roi-cats=\''+JSON.stringify(rules.tableCats||[]).replace(/'/g,'&#39;')+'\'></div>';
  h+='<div class="vr-tiers vr-tiers--page">';
  rules.tiers.forEach(function(tier, ti){
    h+='<div class="vr-tier-block vr-tier-block--page"><div class="vr-tier-hd"><span class="vr-tier-fee-lbl">DJ Fee tier</span>';
    h+=_vrFeeInputHtml(tier.fee, 'vr-fee-inp roi-sp-fee', 'data-ti="'+ti+'" readonly title="Anchor fee for this tier"');
    if(fee>0&&tier.fee!==fee){
      h+='<span class="roi-tier-match-note">Show DJ: $'+fee.toLocaleString()+'</span>';
    }
    h+='</div>';
    h+='<div class="vr-tier-scroll"><table class="vr-tier-tbl vr-tier-tbl--page"><thead><tr><th>Season</th><th>Day</th><th>ROI</th><th>BS Target</th>';
    h+=_roiTierHeaderHtml(rules.tableCats, counts);
    h+='</tr></thead><tbody>';
    showDays=rules.days||showDays;
    seasons.forEach(function(season){
      showDays.forEach(function(day, di){
        var dayData=(tier[season]||{})[day]||{roi:0,sales:0,tables:{}};
        h+='<tr>';
        if(di===0) h+='<td rowspan="'+showDays.length+'" class="vr-season-cell vr-season-'+season.toLowerCase()+'">'+season+'</td>';
        h+='<td class="vr-day-cell">'+day.slice(0,3)+'</td>';
        h+='<td><input type="number" step="0.1" class="vr-cell-inp vr-roi-inp roi-sp-roi" value="'+dayData.roi+'" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'"></td>';
        h+='<td>'+_vrMoneyInputHtml(dayData.sales, 'vr-cell-inp vr-target-inp roi-sp-sales', 'data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'"')+'</td>';
        (rules.tableCats||[]).forEach(function(c){
          var tv=(dayData.tables||{})[c]||0;
          h+='<td>'+_vrMoneyInputHtml(tv, 'vr-cell-inp vr-cell-sm roi-sp-tbl', 'data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-cat="'+c+'"')+'</td>';
        });
        h+='</tr>';
      });
    });
    h+='</tbody></table></div>';
    h+=_roiVerifyBlockHtml(rules, countsMeta, tier, ti, showDays, seasons);
    h+='</div>';
  });
  h+='</div>';
  body.innerHTML=h;
  body._roiSpRules=rules;
  wireVenueRulesMoneyInputs(body);
}

function _collectRoiSpCustomRules(){
  var body=document.getElementById('roiSpCustomBody');
  if(!body||!body._roiSpRules) return null;
  var rules=JSON.parse(JSON.stringify(body._roiSpRules));
  document.querySelectorAll('.roi-sp-fee').forEach(function(inp){
    var ti=+inp.dataset.ti;
    if(rules.tiers[ti]) rules.tiers[ti].fee=_vrParseMoney(inp.value);
  });
  document.querySelectorAll('.roi-sp-roi').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    rules.tiers[ti][season][day].roi=parseFloat(inp.value)||0;
  });
  document.querySelectorAll('.roi-sp-sales').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    rules.tiers[ti][season][day].sales=_vrParseMoney(inp.value);
  });
  document.querySelectorAll('.roi-sp-tbl').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day, cat=inp.dataset.cat;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    if(!rules.tiers[ti][season][day].tables) rules.tiers[ti][season][day].tables={};
    rules.tiers[ti][season][day].tables[cat]=_vrParseMoney(inp.value);
  });
  rules.tiers.sort(function(a,b){ return a.fee-b.fee; });
  return rules;
}

function saveRoiSpecialForm(uid){
  var label=(document.getElementById('roiSpLabel')||{}).value||'';
  var venue=(document.getElementById('roiSpVenue')||{}).value||'';
  var start=(document.getElementById('roiSpStart')||{}).value||'';
  var end=(document.getElementById('roiSpEnd')||{}).value||start;
  var template=(document.getElementById('roiSpTemplate')||{}).value||'';
  var floorPlan=(document.getElementById('roiSpFloor')||{}).value||'auto';
  var dayTemplate=(document.getElementById('roiSpDayTemplate')||{}).value||'Sunday';
  var forceSeason=(document.getElementById('roiSpForceSeason')||{}).value||'';
  if(!label.trim()){ alert('Please enter a label.'); return; }
  if(!start){ alert('Please enter a start date.'); return; }
  if(end<start) end=start;

  var allDaysOn=document.querySelectorAll('.roi-sp-day.on');
  var days=[];
  if(allDaysOn.length<7){
    document.querySelectorAll('.roi-sp-day.on').forEach(function(btn){ days.push(btn.dataset.day); });
  }
  var extraDays=[];
  document.querySelectorAll('.roi-sp-extra.on').forEach(function(btn){ extraDays.push(btn.dataset.day); });

  var rec={
    label:label.trim(), venue:venue, start:start, end:end,
    floorPlan:floorPlan, extraDays:extraDays, dayTemplate:dayTemplate,
    forceSeason:(forceSeason==='High'||forceSeason==='Low')?forceSeason:null,
    updatedAt:new Date().toISOString(),
    djFee:_roiSpResolveFee({venue:venue,start:start,end:end,djFee:0})
  };
  if(days.length) rec.days=days;

  if(template==='__custom__'||_roiSpForceCustom){
    rec.rules=_collectRoiSpCustomRules();
    rec.rulesVenue=null;
  }else{
    rec.rulesVenue=template;
    rec.rules=null;
  }

  var newUid=uid==='__new__'?_roiSpeUid():uid;
  rec._uid=newUid;
  ROI_SPECIAL_EVENTS[newUid]=rec;
  saveRoiSpecialEvents();
  _roiEditSpecialUid=null;
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  renderRoiRulesPage();
}

function cancelRoiSpecialForm(){
  _roiEditSpecialUid=null;
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  renderRoiRulesPage();
}

function deleteRoiSpecial(uid){
  if(!ROI_SPECIAL_EVENTS[uid]) return;
  if(!confirm('Delete this special performance rule?')) return;
  delete ROI_SPECIAL_EVENTS[uid];
  saveRoiSpecialEvents();
}

function wireRoiSpecialEvents(){ /* reserved for future delegated events */ }

/* ─── 3D Floor plan drops ───────────────────────────────────────── */
function _roiFpUid(){
  return 'fp_'+Math.random().toString(36).slice(2,8)+'_'+Date.now().toString(36).slice(-4);
}
function _roiFpList(){
  if(typeof ensureDefaultRoiFloorPlans==='function') ensureDefaultRoiFloorPlans();
  return Object.keys(ROI_FLOOR_PLANS||{}).map(function(uid){
    var p=ROI_FLOOR_PLANS[uid];
    if(!p) return null;
    return Object.assign({_uid:uid}, p);
  }).filter(Boolean).sort(function(a,b){
    var c=(a.venue||'').localeCompare(b.venue||'');
    if(c) return c;
    return (b.start||'').localeCompare(a.start||'');
  });
}
function _roiFpPresetOptions(selected){
  var presets=typeof FV_3D_PLAN_PRESETS!=='undefined'?FV_3D_PLAN_PRESETS:{};
  return Object.keys(presets).map(function(k){
    var p=presets[k];
    return '<option value="'+k+'"'+(selected===k?' selected':'')+'>'+_escRoi(p.label||k)+'</option>';
  }).join('');
}
function _roiFpPlanSummary(p){
  if(p&&p.plan&&p.plan.tables&&p.plan.tables.length){
    var n=p.plan.tables.reduce(function(s,t){ return s+((t.tables&&t.tables.length)||0); },0);
    var tiers=p.plan.tables.map(function(t){ return t.name+'×'+((t.tables&&t.tables.length)||0); }).join(' · ');
    return {lbl:(p.plan.badge||p.plan.label||p.label||'Grabbed plan')+' · '+n+' tables', tiers:tiers, ready:true};
  }
  var preset=(typeof FV_3D_PLAN_PRESETS!=='undefined'&&p&&FV_3D_PLAN_PRESETS[p.preset])?FV_3D_PLAN_PRESETS[p.preset]:null;
  if(preset) return {lbl:preset.label||p.preset, tiers:'', ready:true};
  if(p&&p.status==='queued') return {lbl:'Queued grab…', tiers:'', ready:false};
  if(p&&p.status==='error') return {lbl:'Grab failed', tiers:p.error||'', ready:false};
  return {lbl:p&&p.preset?p.preset:'—', tiers:'', ready:false};
}
function _roiFpLatestForVenue(venue){
  var best=null;
  Object.keys(ROI_FLOOR_PLANS||{}).forEach(function(uid){
    if(uid==='__draft_preview__') return;
    var p=ROI_FLOOR_PLANS[uid];
    if(!p||p.venue!==venue) return;
    if(!best){ best=Object.assign({_uid:uid}, p); return; }
    if((p.updatedAt||'')>(best.updatedAt||'')) best=Object.assign({_uid:uid}, p);
    else if((p.updatedAt||'')===(best.updatedAt||'') && (p.start||'')>(best.start||'')) best=Object.assign({_uid:uid}, p);
  });
  return best;
}
function openFv3dForVenue(venue, dateStr){
  var key=typeof fv3dKeyForVenue==='function'?fv3dKeyForVenue(venue):null;
  var src=typeof fv3dBookingSourceFor==='function'?fv3dBookingSourceFor(venue):null;
  if(!key && src) key=src.modelKey;
  if(!key){ alert('No 3D model for '+venue); return; }
  var d=dateStr||(typeof getFv3dDate==='function'?getFv3dDate():'')||(typeof miamiToday==='function'?miamiToday():'');
  if(typeof _fv3dModelKey!=='undefined') _fv3dModelKey=key;
  if(typeof setView==='function') setView('3d');
  setTimeout(function(){
    if(typeof setFv3dModel==='function') setFv3dModel(key);
    if(d && typeof setFv3dDate==='function') setFv3dDate(d);
  },80);
}
function renderRoiFloorPlansSection(){
  if(typeof ensureDefaultRoiFloorPlans==='function') ensureDefaultRoiFloorPlans();
  var h='';
  h+='<div class="roi-special-intro">';
  h+='<p><b>To see a plan:</b> open <b>3D View</b> in the left sidebar → pick the venue → set the date. This page only starts a Refresh; the model never appears here.</p>';
  h+='<p class="roi-page-hint">When status is ready, use <b>Open in 3D View</b>. Refreshing = wait. Error = grab failed (try again or check Actions).</p>';
  h+='</div>';

  h+='<div class="roi-special-list">';
  h+='<div class="roi-section-title">Venue booking sites</div>';
  var sources=typeof FV_3D_BOOKING_SOURCES!=='undefined'?FV_3D_BOOKING_SOURCES:{};
  var today=(typeof miamiToday==='function')?miamiToday():new Date().toISOString().slice(0,10);
  Object.keys(sources).forEach(function(venue){
    var src=sources[venue];
    var drop=_roiFpLatestForVenue(venue)||(typeof roiFloorPlanDropFor==='function'?roiFloorPlanDropFor(venue, today):null);
    var sum=_roiFpPlanSummary(drop||{});
    var st=drop?(drop.status||(sum.ready?'ready':'')):'none';
    var viewDate=(drop&&drop.start)||today;
    h+='<div class="roi-fp-venue-card">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:800">'+_escRoi(venue)+'</div>';
    h+='<div class="roi-page-hint" style="margin-top:4px"><a href="'+_escRoi(src.url)+'" target="_blank" rel="noopener">'+_escRoi(src.url)+'</a></div>';
    if(st==='ready'||(sum.ready&&st!=='error'&&st!=='refreshing'&&st!=='queued')){
      h+='<div style="font-size:11px;margin-top:6px;color:#166534;font-weight:700">Ready — '+_escRoi(sum.lbl)+'</div>';
    }else if(st==='refreshing'||st==='queued'||st==='running'){
      h+='<div style="font-size:11px;margin-top:6px;color:#9a3412;font-weight:700">Grabbing… check back in ~15–30 min, then Open in 3D View</div>';
    }else if(st==='error'){
      h+='<div style="font-size:11px;margin-top:6px;color:#991b1b;font-weight:700">Grab failed'+(drop&&drop.error?(': '+_escRoi(String(drop.error).slice(0,120))):'')+'</div>';
    }else{
      h+='<div style="font-size:10px;margin-top:6px" class="roi-page-hint">No refreshed plan yet — existing built-in 3D still works in 3D View</div>';
    }
    h+='</div>';
    h+='<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">';
    h+='<button type="button" class="btn-save" onclick="openFv3dForVenue(\''+_escRoi(venue).replace(/'/g,"\\'")+'\',\''+_escRoi(viewDate)+'\')">Open in 3D View</button>';
    h+='<button type="button" class="btn-add" onclick="refreshFloorPlanFromBookingSite(\''+_escRoi(venue).replace(/'/g,"\\'")+'\')">Refresh floor plan</button>';
    h+='</div></div>';
  });
  h+='</div>';

  var list=_roiFpList().filter(function(p){ return p&&p._uid!=='__draft_preview__'; });
  h+='<div class="roi-special-list" style="margin-top:18px">';
  h+='<div class="roi-section-title">Scheduled plans'+(list.length?' <span class="roi-page-hint" style="font-weight:600">('+list.length+')</span>':'')+'</div>';
  if(!list.length){
    h+='<div class="roi-empty">None yet — Refresh on a venue above (or in 3D View) to grab one.</div>';
  }else{
    h+='<table class="fcast-tbl roi-special-tbl"><thead><tr>';
    h+='<th class="left">Venue</th><th>From</th><th>Until</th><th class="left">Plan</th><th></th>';
    h+='</tr></thead><tbody>';
    list.forEach(function(p){
      var sum=_roiFpPlanSummary(p);
      var endLbl=p.end?p.end:'Open';
      var st=p.status||(sum.ready?'ready':'');
      h+='<tr>';
      h+='<td class="left" style="font-weight:800">'+_escRoi(p.venue||'')+'</td>';
      h+='<td style="font-size:11px">'+_escRoi(p.start||'')+'</td>';
      h+='<td style="font-size:11px">'+_escRoi(endLbl)+'</td>';
      h+='<td class="left" style="font-size:10px">'+_escRoi(sum.lbl)+(st&&st!=='ready'?' <span class="roi-page-hint">['+st+']</span>':'')+'</td>';
      h+='<td style="white-space:nowrap">';
      h+='<button type="button" class="roi-mini-btn" onclick="openFv3dForVenue(\''+_escRoi(p.venue||'').replace(/'/g,"\\'")+'\',\''+_escRoi(p.start||today)+'\')">Open 3D</button> ';
      h+='<button type="button" class="roi-mini-btn" onclick="refreshFloorPlanFromBookingSite(\''+_escRoi(p.venue||'').replace(/'/g,"\\'")+'\',\''+_escRoi(p.start||today)+'\')">Refresh</button> ';
      h+='<button type="button" class="roi-mini-btn roi-mini-del" onclick="deleteRoiFloorPlan(\''+p._uid+'\')">Delete</button>';
      h+='</td></tr>';
    });
    h+='</tbody></table>';
  }
  h+='</div>';
  return h;
}

function updateFv3dRefreshStatus(){
  var el=document.getElementById('fv3dRefreshStatus');
  if(!el) return;
  var m=typeof FV_3D_MODELS!=='undefined'?FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;}):null;
  var venue=m?m.venue:null;
  var d=(typeof getFv3dDate==='function'?getFv3dDate():'')||'';
  var drop=venue&&d&&typeof roiFloorPlanDropFor==='function'?roiFloorPlanDropFor(venue, d):null;
  if(!drop){ el.textContent=''; return; }
  if(drop.status==='queued'||drop.status==='refreshing'||drop.status==='running'){
    el.textContent='Grabbing from booking site… keep this date; it updates when ready.';
    return;
  }
  if(drop.status==='error'){
    el.textContent='Last grab failed — try Refresh again.';
    return;
  }
  if(drop.plan&&drop.updatedAt){
    el.textContent='Last grab '+String(drop.updatedAt).slice(0,16).replace('T',' ');
    return;
  }
  el.textContent='';
}

/* Same fixed booking URL every time → scrape BOOK YOUR TABLE for the selected date → update 3D plan. */
function refreshFloorPlanFromBookingSite(venueOpt, dateOpt){
  var m=typeof FV_3D_MODELS!=='undefined'?FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;}):null;
  var venue=venueOpt||(m&&m.venue)||'';
  var src=typeof fv3dBookingSourceFor==='function'?fv3dBookingSourceFor(venue):null;
  if(!src||!src.url){
    alert('No fixed booking link for this venue yet.');
    return;
  }
  venue=src.venue||venue;
  var dateStr=dateOpt||(typeof getFv3dDate==='function'?getFv3dDate():'')||(typeof miamiToday==='function'?miamiToday():'');
  if(!dateStr){
    alert('Pick a date in 3D View first (the date on the booking site to open).');
    return;
  }

  var drop=typeof roiFloorPlanDropFor==='function'?roiFloorPlanDropFor(venue, dateStr):null;
  var uid=(drop&&drop._uid)?drop._uid:_roiFpUid();
  var prev=ROI_FLOOR_PLANS[uid]||drop||{};
  var known=typeof _roiFpGuessKnownPreset==='function'?_roiFpGuessKnownPreset(venue, src.url, dateStr):null;
  var interim=null;
  if(!(prev.plan&&prev.plan.tables&&prev.plan.tables.length)&&known&&typeof _fv3dPlanPayloadFromPreset==='function'){
    interim=_fv3dPlanPayloadFromPreset(known);
  }

  ROI_FLOOR_PLANS[uid]={
    _uid:uid,
    label:prev.label||(venue+' live plan'),
    venue:venue,
    start:prev.start||dateStr,
    end:prev.end||'',
    preset:known||prev.preset||null,
    sourceUrl:src.url,
    status:'refreshing',
    plan:prev.plan&&prev.plan.tables?prev.plan:(interim||null),
    grabbed:!!(prev.grabbed||interim),
    createdAt:prev.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    seeded:false,
    lastRefreshDate:dateStr
  };
  if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();

  var reqId='req_refresh_'+uid+'_'+Date.now().toString(36);
  _roiFpQueueIngest({
    _uid:reqId,
    dropUid:uid,
    url:src.url,
    venue:venue,
    start:dateStr,
    end:ROI_FLOOR_PLANS[uid].end||'',
    label:ROI_FLOOR_PLANS[uid].label,
    status:'queued',
    refresh:true,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });

  updateFv3dRefreshStatus();
  if(typeof curView!=='undefined'&&curView==='roi-rules'&&typeof renderRoiRulesPage==='function') renderRoiRulesPage();

  var st=document.getElementById('fv3dRefreshStatus');
  if(st) st.textContent='Grab queued — scraping '+src.url.replace(/^https?:\/\//,'')+' for '+dateStr+'…';
  alert('Refresh queued.\n\nSame link: '+src.url+'\nDate on site: '+dateStr+'\n\nThe worker grabs the 3D plan (usually within ~15–30 min). Leave this date selected — 3D View updates when it’s ready.');
}
function openRoiFloorForm(uid){
  _roiEditFloorUid=uid||'__new__';
  renderRoiRulesPage();
}
function cancelRoiFloorForm(){
  _roiEditFloorUid=null;
  renderRoiRulesPage();
}
function renderRoiFloorForm(uid){
  var isNew=uid==='__new__';
  var p=isNew?{
    label:'',
    venue:'Casa Neos Beach Club',
    start:'',
    end:'',
    sourceUrl:'https://beachclub.casa-neos.com/',
    closePrevious:true,
    status:'',
    plan:null
  }:Object.assign({closePrevious:false}, ROI_FLOOR_PLANS[uid]||{});
  var venues=(typeof listActiveVenues==='function'?listActiveVenues():['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge']);
  var h='<div class="roi-special-form" id="roiFloorForm">';
  h+='<div class="roi-section-title">'+(isNew?'Add floor plan':'Edit floor plan')+'</div>';
  h+='<div class="roi-fp-callout">Link + dates + Save. The 3D plan is picked up for those dates automatically.</div>';
  h+='<div class="roi-form-grid">';
  h+='<div class="fld" style="grid-column:1/-1"><label>Booking site link</label><input id="roiFpSourceUrl" type="url" value="'+_escRoi(p.sourceUrl||'')+'" placeholder="https://beachclub.casa-neos.com/" oninput="roiFpRefreshPreview()"></div>';
  h+='<div class="fld"><label>Venue</label><select id="roiFpVenue" onchange="roiFpVenueChanged();roiFpRefreshPreview()">'+venues.map(function(v){
    return '<option value="'+_escRoi(v)+'"'+(v===p.venue?' selected':'')+'>'+_escRoi(v)+'</option>';
  }).join('')+'</select></div>';
  h+='<div class="fld"><label>Name <span class="roi-page-hint">(optional)</span></label><input id="roiFpLabel" type="text" value="'+_escRoi(p.label||'')+'" placeholder="Auto from venue + date" oninput="roiFpRefreshPreview()"></div>';
  h+='<div class="fld"><label>Starts (first live date)</label><input id="roiFpStart" type="date" value="'+(p.start||'')+'" onchange="roiFpRefreshPreview()"></div>';
  h+='<div class="fld"><label>Ends <span class="roi-page-hint">(blank = ongoing)</span></label><input id="roiFpEnd" type="date" value="'+(p.end||'')+'" onchange="roiFpRefreshPreview()"></div>';
  h+='<input type="hidden" id="roiFpPreset" value="'+_escRoi(p.preset||'')+'">';
  h+='</div>';
  h+='<label class="roi-page-hint" style="display:flex;align-items:center;gap:8px;margin:10px 0;cursor:pointer">';
  h+='<input id="roiFpClosePrev" type="checkbox"'+(p.closePrevious!==false?' checked':'')+'> ';
  h+='End earlier open-ended plan the day before Starts</label>';
  h+='<div id="roiFpPreview" class="roi-fp-preview"></div>';
  h+='<div class="roi-form-actions">';
  h+='<button type="button" class="btn-cancel" onclick="cancelRoiFloorForm()">Cancel</button>';
  h+='<button type="button" class="btn-save" onclick="saveRoiFloorForm(\''+(isNew?'__new__':uid)+'\')">Save floor plan</button>';
  h+='</div></div>';
  setTimeout(function(){ roiFpRefreshPreview(); },0);
  return h;
}
function roiFpVenueChanged(){
  var v=(document.getElementById('roiFpVenue')||{}).value||'';
  var url=document.getElementById('roiFpSourceUrl');
  if(!url) return;
  if(/Beach Club/i.test(v)){
    if(!url.value||/casa-neos\.com/i.test(url.value)) url.value='https://beachclub.casa-neos.com/';
  }else if(/Lounge/i.test(v)&&/Casa Neos/i.test(v)){
    if(!url.value||/casa-neos\.com/i.test(url.value)) url.value='https://lounge.casa-neos.com/';
  }
  roiFpRefreshPreview();
}
function roiFpPresetChanged(){ /* preset field removed from UI; kept for compatibility */ }
function roiFpAutoLabel(venue, start){
  if(!venue) return 'Floor plan';
  if(!start) return venue+' floor plan';
  var parts=String(start).split('-');
  if(parts.length===3){
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var m=months[+parts[1]-1]||parts[1];
    return venue+' · from '+m+' '+String(+parts[2])+', '+parts[0];
  }
  return venue+' · from '+start;
}
function roiFpRefreshPreview(){
  var box=document.getElementById('roiFpPreview');
  if(!box) return;
  var venue=(document.getElementById('roiFpVenue')||{}).value||'';
  var start=(document.getElementById('roiFpStart')||{}).value||'';
  var end=(document.getElementById('roiFpEnd')||{}).value||'';
  var url=((document.getElementById('roiFpSourceUrl')||{}).value||'').trim();
  var uid=_roiEditFloorUid;
  var existing=(uid&&uid!=='__new__'&&ROI_FLOOR_PLANS[uid])?ROI_FLOOR_PLANS[uid]:null;
  var known=_roiFpGuessKnownPreset(venue, url, start)||(existing&&existing.preset)||'';
  var presetEl=document.getElementById('roiFpPreset');
  if(presetEl) presetEl.value=known||'';
  var plan=existing&&existing.plan&&existing.plan.tables?existing.plan:null;
  if(!plan&&known&&typeof _fv3dPlanPayloadFromPreset==='function') plan=_fv3dPlanPayloadFromPreset(known);

  if(!url&&!plan){
    box.innerHTML='<div class="roi-fp-preview-err">Paste the booking site link to continue.</div>';
    return;
  }
  if(!start){
    box.innerHTML='<div class="roi-fp-preview-err">Set <b>Starts</b> — the first date the new floor plan is live on the website.</div>';
    return;
  }
  if(!plan){
    var h0='<div class="roi-fp-preview-ok">';
    h0+='<div class="roi-fp-preview-hd">Ready to save</div>';
    h0+='<p>From <b>'+start+'</b>'+(end?' to <b>'+end+'</b>':' onward')+' at <b>'+_escRoi(venue)+'</b>.</p>';
    h0+='<p class="roi-page-hint">New link — Save queues an automatic grab. The plan usually appears within ~30 minutes (no coding).</p>';
    h0+='</div>';
    box.innerHTML=h0;
    return;
  }
  var tiers=plan.tables||[];
  var nTables=tiers.reduce(function(s,t){ return s+((t.tables&&t.tables.length)||0); },0);
  var tierLine=tiers.map(function(t){ return t.name+'×'+((t.tables&&t.tables.length)||0)+' @'+(t.minimum||0); }).join(' · ')||'No tables';
  var h='<div class="roi-fp-preview-ok">';
  h+='<div class="roi-fp-preview-hd">Ready to save</div>';
  h+='<p>From <b>'+start+'</b>'+(end?' to <b>'+end+'</b>':' onward')+' at <b>'+_escRoi(venue)+'</b>:</p>';
  h+='<ul>';
  h+='<li><b>Badge:</b> '+_escRoi(plan.badge||plan.label||'Custom')+'</li>';
  h+='<li><b>Model:</b> <code style="font-size:10px">'+_escRoi(plan.modelUrl||'')+'</code></li>';
  h+='<li><b>Tables:</b> '+nTables+' ('+_escRoi(tierLine)+')</li>';
  h+='</ul></div>';
  box.innerHTML=h;
}
function _roiFpGuessKnownPreset(venue, url, start){
  var u=String(url||'').toLowerCase();
  if(/lounge\.casa-neos/.test(u)||(/Casa Neos Lounge/i.test(venue)&&!/beach/i.test(u))){
    if(!start||start>='2026-09-25') return 'casa-neos-lounge-new';
  }
  if(/beachclub\.casa-neos|beach.?club/i.test(u)||/Beach Club/i.test(venue)){
    if(start&&start>='2026-10-03') return 'casa-neos-beach-club-new';
    if(start&&start>='2026-08-01'&&start<='2026-09-30') return 'casa-neos-beach-club-summer';
    if(!start||start>='2026-10-03') return 'casa-neos-beach-club-new';
  }
  return null;
}
function _roiFpQueueIngest(req){
  if(window._fbSave) window._fbSave('floorPlanIngestRequests/'+req._uid, req);
  try{
    var q=JSON.parse(localStorage.getItem('rdg_floor_plan_ingest_q')||'{}');
    q[req._uid]=req;
    localStorage.setItem('rdg_floor_plan_ingest_q', JSON.stringify(q));
  }catch(e){}
}
function _roiFpCloseEarlier(venue, start, newUid){
  var dayBefore=_roiFpDayBefore(start);
  Object.keys(ROI_FLOOR_PLANS||{}).forEach(function(oid){
    if(oid===newUid) return;
    var o=ROI_FLOOR_PLANS[oid];
    if(!o||o.venue!==venue) return;
    if(o.start>=start) return;
    if(o.end&&o.end!=='') return;
    o.end=dayBefore;
    o.updatedAt=new Date().toISOString();
  });
}
function _roiFpOpen3d(venue, start, plan, known){
  var key=(plan&&plan.modelKey)||(known&&FV_3D_PLAN_PRESETS[known]&&FV_3D_PLAN_PRESETS[known].modelKey)||(typeof fv3dKeyForVenue==='function'?fv3dKeyForVenue(venue):null);
  if(!key) return;
  if(typeof _fv3dModelKey!=='undefined') _fv3dModelKey=key;
  if(typeof setView==='function') setView('3d');
  setTimeout(function(){
    if(typeof setFv3dModel==='function') setFv3dModel(key);
    if(typeof setFv3dDate==='function') setFv3dDate(start);
  },80);
}
/* One-button save: attach plan from link/date (or queue scrape) and schedule it. */
function saveRoiFloorForm(uid){
  var labelEl=document.getElementById('roiFpLabel');
  var label=((labelEl||{}).value||'').trim();
  var venue=(document.getElementById('roiFpVenue')||{}).value||'';
  var start=(document.getElementById('roiFpStart')||{}).value||'';
  var end=(document.getElementById('roiFpEnd')||{}).value||'';
  var sourceUrl=((document.getElementById('roiFpSourceUrl')||{}).value||'').trim();
  var closePrev=!!(document.getElementById('roiFpClosePrev')||{}).checked;
  if(!sourceUrl){ alert('Paste the booking site link.'); return; }
  if(!start){ alert('Set Starts — the first date the new floor plan is live on the website.'); return; }
  if(end&&end<start){ alert('Ends must be on or after Starts.'); return; }
  if(!label) label=roiFpAutoLabel(venue, start);

  var newUid=uid==='__new__'?_roiFpUid():uid;
  var prev=ROI_FLOOR_PLANS[newUid]||{};
  var known=_roiFpGuessKnownPreset(venue, sourceUrl, start)||prev.preset||null;
  var plan=prev.plan&&prev.plan.tables?prev.plan:null;
  if(known&&typeof _fv3dPlanPayloadFromPreset==='function'){
    var fromKnown=_fv3dPlanPayloadFromPreset(known);
    if(fromKnown) plan=fromKnown;
  }

  if(closePrev) _roiFpCloseEarlier(venue, start, newUid);

  if(plan){
    ROI_FLOOR_PLANS[newUid]={
      _uid:newUid,
      label:label,
      venue:venue,
      start:start,
      end:end||'',
      preset:known||null,
      sourceUrl:sourceUrl,
      status:'ready',
      plan:plan,
      grabbed:true,
      createdAt:prev.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      seeded:false
    };
    if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();
    _roiEditFloorUid=null;
    var n=plan.tables.reduce(function(s,t){ return s+(t.tables?t.tables.length:0); },0);
    var open3d=confirm('Saved. From '+start+', '+venue+' uses this plan ('+n+' tables).\n\nOpen 3D View?');
    renderRoiRulesPage();
    if(open3d) _roiFpOpen3d(venue, start, plan, known);
    return;
  }

  /* Unknown link — save drop as queued + enqueue scrape */
  ROI_FLOOR_PLANS[newUid]={
    _uid:newUid,
    label:label,
    venue:venue,
    start:start,
    end:end||'',
    preset:null,
    sourceUrl:sourceUrl,
    status:'queued',
    plan:null,
    grabbed:false,
    createdAt:prev.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    seeded:false
  };
  if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();
  var reqId='req_'+newUid;
  _roiFpQueueIngest({
    _uid:reqId,
    dropUid:newUid,
    url:sourceUrl,
    venue:venue,
    start:start,
    end:end||'',
    label:label,
    status:'queued',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  _roiEditFloorUid=null;
  alert('Saved. Automatic grab is queued — the 3D plan usually appears within ~30 minutes. Hard-refresh later or open 3D View on the Starts date once status shows ready.');
  renderRoiRulesPage();
}
function grabRoiFloorFromLink(uid){ saveRoiFloorForm(uid); }
function roiFpOpen3dPreview(){
  var venue=(document.getElementById('roiFpVenue')||{}).value||'';
  var start=(document.getElementById('roiFpStart')||{}).value||'';
  var url=((document.getElementById('roiFpSourceUrl')||{}).value||'').trim();
  var uid=_roiEditFloorUid;
  var existing=(uid&&uid!=='__new__'&&ROI_FLOOR_PLANS[uid])?ROI_FLOOR_PLANS[uid]:null;
  var plan=existing&&existing.plan?existing.plan:null;
  var known=_roiFpGuessKnownPreset(venue, url, start);
  if(!plan&&known&&typeof _fv3dPlanPayloadFromPreset==='function') plan=_fv3dPlanPayloadFromPreset(known);
  if(!start){ alert('Set Starts first.'); return; }
  ROI_FLOOR_PLANS.__draft_preview__={
    _uid:'__draft_preview__', venue:venue, start:start, end:'',
    preset:known||null, plan:plan||null,
    updatedAt:new Date().toISOString(), label:'(preview)'
  };
  _roiFpOpen3d(venue, start, plan, known);
}
function _roiFpDayBefore(ymd){
  if(!ymd||!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  var dt=new Date(ymd+'T12:00:00');
  dt.setDate(dt.getDate()-1);
  var y=dt.getFullYear();
  var m=String(dt.getMonth()+1).padStart(2,'0');
  var d=String(dt.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+d;
}
function deleteRoiFloorPlan(uid){
  if(!ROI_FLOOR_PLANS[uid]) return;
  if(!confirm('Delete this floor plan? Built-in date rules still apply if no other drop covers the range.')) return;
  delete ROI_FLOOR_PLANS[uid];
  if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();
  if(_roiEditFloorUid===uid) _roiEditFloorUid=null;
  renderRoiRulesPage();
}
