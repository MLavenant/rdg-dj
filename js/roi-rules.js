/* Venue ROI Rules — full-page editor (standard tiers + special-day performances) */

var _roiPageTab = 'rules'; /* rules | special */
var _roiEditSpecialUid = null;
var _roiSpForceCustom = false;
var _roiSpPrefill = null;
var _roiDatePick = { venue: '', date: '', q: '' };

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
    });
    inp.addEventListener('focus',function(){
      inp.value=String(_vrParseMoney(inp.value)||'');
      inp.select();
    });
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
  h+='</div>';

  if(_roiPageTab==='rules'){
    h+='<div id="vrTabs"></div>';
    h+='<div id="vrBody" class="roi-rules-body"></div>';
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
  }else{
    wireRoiSpecialEvents();
  }
}

function setRoiPageTab(tab){
  _roiPageTab=tab;
  _roiEditSpecialUid=null;
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
      var fp=ev.floorPlan==='summer'?'Sunset 20':(ev.floorPlan==='regular'?'Regular':'Auto');
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
  h+='<div class="fld"><label>Venue</label><select id="roiSpVenue">'+venues.map(function(v){
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
  h+='<div class="fld"><label>Floor plan</label><select id="roiSpFloor">';
  [{v:'auto',l:'Auto (date-based)'},{v:'summer',l:'Sunset rooftop — 20 tables (BC)'},{v:'regular',l:'Regular venue plan'}].forEach(function(o){
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
  var h='';
  h+='<div class="vr-tiers vr-tiers--page">';
  rules.tiers.forEach(function(tier, ti){
    h+='<div class="vr-tier-block vr-tier-block--page"><div class="vr-tier-hd"><span class="vr-tier-fee-lbl">DJ Fee tier</span>';
    h+=_vrFeeInputHtml(tier.fee, 'vr-fee-inp roi-sp-fee', 'data-ti="'+ti+'" readonly title="Anchor fee for this tier"');
    if(fee>0&&tier.fee!==fee){
      h+='<span class="roi-tier-match-note">Show DJ: $'+fee.toLocaleString()+'</span>';
    }
    h+='</div>';
    h+='<div class="vr-tier-scroll"><table class="vr-tier-tbl vr-tier-tbl--page"><thead><tr><th>Season</th><th>Day</th><th>ROI</th><th>BS Target</th>';
    (rules.tableCats||[]).forEach(function(c){
      h+='<th class="vr-th-tier">'+c+'<span class="vr-th-sub">min $</span></th>';
    });
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
    h+='</tbody></table></div></div>';
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
