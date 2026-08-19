/* Venue ROI Rules — full-page editor (standard tiers + special-day performances) */

var _roiPageTab = 'rules'; /* rules | special */
var _roiEditSpecialUid = null;

function openVenueRulesEditor(){
  if(typeof setView==='function') setView('roi-rules');
}

function closeVenueRulesEditor(){ /* legacy modal hook — page replaces modal */ }

function renderRoiRulesPage(){
  ensureCnbcSummerRoofRules();
  var root=document.getElementById('roiRulesBody');
  if(!root) return;

  var h='';
  h+='<div class="roi-page-intro">';
  h+='<p><b>Venue ROI Rules</b> drive BS Target, ROI Target, VIP table minimums, and forecast table counts across Calendar, Budget, Forecast, Accounting, and 3D View.</p>';
  h+='<p class="roi-page-hint">Nearest fee tier is used when a DJ fee falls between anchors. BS Target stays fixed; ROI Target recalculates when the fee does not match the tier anchor.</p>';
  h+='</div>';

  h+='<div class="roi-subtabs">';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='rules'?' on':'')+'" onclick="setRoiPageTab(\'rules\')">Standard venue rules</button>';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='special'?' on':'')+'" onclick="setRoiPageTab(\'special\')">Special performances</button>';
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
  h+='<p>Add <b>special performances</b> for one-off dates or holidays (Labor Day Monday, NYE, etc.) when a venue runs on a day outside its normal schedule or needs different ROI / floor-plan rules.</p>';
  h+='<p class="roi-page-hint">Example: Casa Neos BC on a Monday in September — pick <em>Sunset Rituals</em> rules, enable Monday, and set floor plan to Sunset (20 tables).</p>';
  h+='</div>';

  h+='<div class="roi-special-toolbar">';
  h+='<button type="button" class="btn-add" onclick="openRoiSpecialForm()">+ Add special performance</button>';
  h+='</div>';

  if(_roiEditSpecialUid!==null){
    h+=renderRoiSpecialForm(_roiEditSpecialUid);
  }

  var list=_roiSpeList();
  h+='<div class="roi-special-list">';
  if(!list.length){
    h+='<div class="roi-empty">No special performances yet. Add one for Labor Day, Art Basel, NYE, or any off-schedule show.</div>';
  }else{
    h+='<table class="fcast-tbl roi-special-tbl"><thead><tr>';
    h+='<th class="left">Label</th><th class="left">Venue</th><th>Dates</th><th>Days</th><th>Rules</th><th>Floor plan</th><th></th>';
    h+='</tr></thead><tbody>';
    list.forEach(function(ev){
      var rulesLbl=ev.rules&&ev.rules.tiers?'Custom':(ev.rulesVenue||'Auto');
      if(rulesLbl===CNBC_SUMMER_ROOF_KEY) rulesLbl='Sunset Rituals';
      var days=(ev.days&&ev.days.length)?ev.days.map(function(d){return d.slice(0,3);}).join(', '):'All in range';
      if(ev.extraDays&&ev.extraDays.length){
        days+=(days?' + ':'')+ev.extraDays.map(function(d){return d.slice(0,3);}).join(', ')+' (extra)';
      }
      var fp=ev.floorPlan==='summer'?'Sunset 20':(ev.floorPlan==='regular'?'Regular':'Auto');
      h+='<tr>';
      h+='<td class="left" style="font-weight:800">'+_escRoi(ev.label||'Untitled')+'</td>';
      h+='<td class="left">'+_escRoi(ev.venue||'')+'</td>';
      h+='<td style="font-size:11px">'+ev.start+(ev.end!==ev.start?' → '+ev.end:'')+'</td>';
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

function renderRoiSpecialUpcoming(){
  var today=new Date(); today.setHours(0,0,0,0);
  var todayStr=today.toISOString().split('T')[0];
  var shows=[];
  if(typeof SCHED!=='undefined'){
    SCHED.forEach(function(r){
      if(!r||!r.d||r.d<todayStr) return;
      var v=r.v||r.venue;
      var sp=roiSpecialEventFor(v, r.d);
      var day=dayNameFor(r.d);
      var rv=effectiveRoiVenue(v, r.d, r.fee||r.cost||0);
      var rules=VENUE_ROI_RULES[rv];
      var offDay=rules&&rules.days&&rules.days.indexOf(day)===-1;
      if(sp||offDay) shows.push({r:r,v:v,day:day,sp:sp,offDay:offDay});
    });
  }
  shows.sort(function(a,b){ return a.r.d.localeCompare(b.r.d); });
  if(!shows.length) return '';
  var h='<div class="roi-special-upcoming"><div class="roi-section-title">Schedule alerts — off-day or special-rule shows</div>';
  h+='<table class="fcast-tbl"><thead><tr><th class="left">Date</th><th class="left">Venue</th><th class="left">DJ</th><th>Day</th><th>Status</th></tr></thead><tbody>';
  shows.slice(0,12).forEach(function(row){
    var st=row.sp
      ? ('<span style="color:#0f766e;font-weight:700">'+_escRoi(row.sp.label)+'</span>')
      : ('<span style="color:#dc2626;font-weight:700">No special rule — add one</span>');
    h+='<tr><td class="left">'+row.r.d+'</td><td class="left">'+_escRoi(row.v)+'</td><td class="left">'+_escRoi(row.r.dj||'TBD')+'</td><td>'+row.day.slice(0,3)+'</td><td>'+st+'</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

function _escRoi(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

function openRoiSpecialForm(uid){
  _roiEditSpecialUid=uid||'__new__';
  renderRoiRulesPage();
}

function renderRoiSpecialForm(uid){
  var isNew=uid==='__new__';
  var ev=isNew?{
    label:'', venue:curV||'Casa Neos Beach Club',
    start:'', end:'', rulesVenue:CNBC_SUMMER_ROOF_KEY,
    extraDays:['Monday'], dayTemplate:'Sunday', floorPlan:'auto',
    days:[]
  }:Object.assign({}, ROI_SPECIAL_EVENTS[uid]||{});
  if(!ev._uid&& !isNew) ev._uid=uid;

  var venues=(typeof listActiveVenues==='function'?listActiveVenues():['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge']);
  var templateSel=ev.rules&&ev.rules.tiers?'__custom__':(ev.rulesVenue||'Casa Neos Beach Club');

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

  h+='<div id="roiSpCustomWrap" style="'+(templateSel==='__custom__'?'':'display:none')+'">';
  h+='<div class="vr-season-lbl" style="margin:10px 0 6px">Custom tier grid (optional)</div>';
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
  var h='';
  h+='<div class="vr-season-hint" style="margin-bottom:8px">Edit ROI, BS Target, and table mins for this one-off event. Changes apply only to this special performance.</div>';
  h+='<div class="vr-tiers">';
  rules.tiers.forEach(function(tier, ti){
    h+='<div class="vr-tier-block"><div class="vr-tier-hd"><span>DJ Fee</span><input type="number" class="vr-fee-inp roi-sp-fee" value="'+tier.fee+'" data-ti="'+ti+'"></div>';
    h+='<table class="vr-tier-tbl"><thead><tr><th>Season</th><th>Day</th><th>ROI</th><th>BS Target</th>';
    (rules.tableCats||[]).forEach(function(c){ h+='<th>'+c+'</th>'; });
    h+='</tr></thead><tbody>';
    var days=rules.days||DOW_NAMES;
    ['High','Low'].forEach(function(season){
      days.forEach(function(day, di){
        var dayData=(tier[season]||{})[day]||{roi:0,sales:0,tables:{}};
        h+='<tr>';
        if(di===0) h+='<td rowspan="'+days.length+'" class="vr-season-cell vr-season-'+season.toLowerCase()+'">'+season+'</td>';
        h+='<td class="vr-day-cell">'+day.slice(0,3)+'</td>';
        h+='<td><input type="number" step="0.1" class="vr-cell-inp roi-sp-roi" value="'+dayData.roi+'" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'"></td>';
        h+='<td><input type="number" class="vr-cell-inp roi-sp-sales" value="'+dayData.sales+'" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'"></td>';
        (rules.tableCats||[]).forEach(function(c){
          var tv=(dayData.tables||{})[c]||0;
          h+='<td><input type="number" class="vr-cell-inp vr-cell-sm roi-sp-tbl" value="'+tv+'" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-cat="'+c+'"></td>';
        });
        h+='</tr>';
      });
    });
    h+='</tbody></table></div>';
  });
  h+='</div>';
  body.innerHTML=h;
  body._roiSpRules=rules;
}

function _collectRoiSpCustomRules(){
  var body=document.getElementById('roiSpCustomBody');
  if(!body||!body._roiSpRules) return null;
  var rules=JSON.parse(JSON.stringify(body._roiSpRules));
  document.querySelectorAll('.roi-sp-fee').forEach(function(inp){
    var ti=+inp.dataset.ti;
    if(rules.tiers[ti]) rules.tiers[ti].fee=parseFloat(inp.value)||0;
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
    rules.tiers[ti][season][day].sales=parseFloat(inp.value)||0;
  });
  document.querySelectorAll('.roi-sp-tbl').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day, cat=inp.dataset.cat;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    if(!rules.tiers[ti][season][day].tables) rules.tiers[ti][season][day].tables={};
    rules.tiers[ti][season][day].tables[cat]=parseFloat(inp.value)||0;
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
    updatedAt:new Date().toISOString()
  };
  if(days.length) rec.days=days;

  if(template==='__custom__'){
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
  renderRoiRulesPage();
}

function cancelRoiSpecialForm(){
  _roiEditSpecialUid=null;
  renderRoiRulesPage();
}

function deleteRoiSpecial(uid){
  if(!ROI_SPECIAL_EVENTS[uid]) return;
  if(!confirm('Delete this special performance rule?')) return;
  delete ROI_SPECIAL_EVENTS[uid];
  saveRoiSpecialEvents();
}

function wireRoiSpecialEvents(){ /* reserved for future delegated events */ }
