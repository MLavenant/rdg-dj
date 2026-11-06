/* Resident DJ calendar. Separate from the Guest DJ schedule.
   Reads the same fiscal dates for the month strip. Never writes SCHED. */

var RESIDENT_DJ = {};
var RESIDENT_ROLES = [
  {id:'resident_dj', label:'Resident DJ'},
  {id:'light_jockey', label:'Light Jockey'},
  {id:'kryo', label:'KRYO'},
  {id:'greeters', label:'Greeters'},
  {id:'mm', label:'MM'}
];

function residentKey(venue, ds){
  return String(venue||'').replace(/[^a-zA-Z0-9]+/g,'_')+'__'+String(ds||'');
}
function residentEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function residentDay(venue, ds){
  var row=RESIDENT_DJ[residentKey(venue, ds)];
  return (row && typeof row==='object') ? row : {};
}
function residentMoney(v){
  if(v==null || v==='') return '';
  var n=+v;
  return isNaN(n) ? '' : String(n);
}
function residentEdit(el){
  if(!el) return;
  var ds=el.getAttribute('data-ds');
  var field=el.getAttribute('data-field');
  var role=el.getAttribute('data-role')||'';
  var key=residentKey(curV, ds);
  var row=RESIDENT_DJ[key];
  if(!row || typeof row!=='object') row={};
  if(field==='hotel' || field==='ground'){
    var raw=String(el.value||'').replace(/[^0-9.]/g,'');
    row[field]=raw==='' ? null : +raw;
  }else if(role){
    if(!row[role] || typeof row[role]!=='object') row[role]={};
    if(field==='amt'){
      var amt=String(el.value||'').replace(/[^0-9.]/g,'');
      row[role].amt=amt==='' ? null : +amt;
    }else{
      row[role].name=String(el.value||'');
    }
  }
  RESIDENT_DJ[key]=row;
  try{ if(window._fbSave) window._fbSave('residentDj/'+key, row); }catch(e){}
}
function residentJumpMonth(m){
  curM=m;
  if(curView==='resident') renderResidentCalendar();
}
function renderResidentCalendar(){
  var body=document.getElementById('residentBody');
  var hd=document.getElementById('residentHd');
  if(!body) return;
  initResidentDj();
  var yr=curYr, mo=curM;
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  if(hd) hd.textContent=MN_FULL[mo]+' '+yr+' ('+fiscalPeriodShortRange(yr, mo)+')';
  var slider='<div class="month-slider">';
  for(var mi=0;mi<12;mi++){
    slider+='<button type="button" class="ms-btn'+(mi===mo?' ms-on':'')+'" onclick="residentJumpMonth('+mi+')">'+MN_SH[mi]+'</button>';
  }
  slider+='</div>';
  var sliderEl=document.getElementById('residentSlider');
  if(sliderEl) sliderEl.innerHTML=slider;

  var h='<table class="sched-tbl"><thead>';
  h+='<tr>';
  h+='<th class="sc-date" rowspan="2">Date</th>';
  h+='<th class="sc-num" rowspan="2">Hotel</th>';
  h+='<th class="sc-num" rowspan="2">Ground</th>';
  RESIDENT_ROLES.forEach(function(role){
    h+='<th class="res-group" colspan="2">'+role.label+'</th>';
  });
  h+='</tr><tr>';
  RESIDENT_ROLES.forEach(function(){
    h+='<th class="res-sub">Name</th><th class="res-sub">$</th>';
  });
  h+='</tr></thead><tbody>';

  fiscalDates.forEach(function(ds){
    var dObj=_parseYmd(ds);
    var dow=dObj.getDay();
    var isToday=ds===TODAY;
    var dc='sc-row';
    if(isToday) dc+=' sc-today';
    else if(dow===6) dc+=' sc-sat';
    else if(dow===0) dc+=' sc-sun';
    else if(dow===5) dc+=' sc-fri';
    else if(dow===3||dow===4) dc+=' sc-wedthu';
    var dateStr=DOW_FULL[dow]+', '+MN_FULL[dObj.getMonth()]+' '+dObj.getDate()+', '+dObj.getFullYear();
    var row=residentDay(curV, ds);
    h+='<tr class="'+dc+'">';
    h+='<td class="sc-date-cell">'+dateStr+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
    h+='<td class="res-cell"><input class="res-money" inputmode="decimal" data-ds="'+ds+'" data-field="hotel" value="'+residentMoney(row.hotel)+'" placeholder="$" onchange="residentEdit(this)"></td>';
    h+='<td class="res-cell"><input class="res-money" inputmode="decimal" data-ds="'+ds+'" data-field="ground" value="'+residentMoney(row.ground)+'" placeholder="$" onchange="residentEdit(this)"></td>';
    RESIDENT_ROLES.forEach(function(role){
      var cell=(row[role.id] && typeof row[role.id]==='object') ? row[role.id] : {};
      h+='<td class="res-cell"><input class="res-name" data-ds="'+ds+'" data-role="'+role.id+'" data-field="name" value="'+residentEsc(cell.name||'')+'" placeholder="Name" onchange="residentEdit(this)"></td>';
      h+='<td class="res-cell"><input class="res-money" inputmode="decimal" data-ds="'+ds+'" data-role="'+role.id+'" data-field="amt" value="'+residentMoney(cell.amt)+'" placeholder="$" onchange="residentEdit(this)"></td>';
    });
    h+='</tr>';
  });
  h+='</tbody></table>';
  body.innerHTML=h;
}
function initResidentDj(){
  if(window._residentDjListening || !window._fbDb) return;
  window._residentDjListening=true;
  window._fbDb.ref('rdg/residentDj').on('value', function(snap){
    RESIDENT_DJ=snap.val()||{};
    var typing=false;
    try{
      var ae=document.activeElement;
      typing=!!(ae && ae.closest && ae.closest('#residentBody'));
    }catch(e){}
    if(!typing && typeof curView!=='undefined' && curView==='resident') renderResidentCalendar();
  });
}
try{ initResidentDj(); }catch(eRes){}
