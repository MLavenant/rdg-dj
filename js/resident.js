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
  return isNaN(n) ? '' : (String(n)+'$');
}
function residentMoneySize(v){
  var s=residentMoney(v);
  return Math.max(3, s.length||0);
}
function residentSizeMoney(el){
  if(!el) return;
  el.size=Math.max(3, String(el.value||'').length||0);
}
function residentFormatMoneyInput(el, n){
  if(!el) return;
  var shown=residentMoney(n);
  var raw=String(el.value||'');
  if(raw===shown){ residentSizeMoney(el); return; }
  var pos=el.selectionStart||0;
  var digitsBefore=0;
  for(var i=0;i<pos && i<raw.length;i++){
    if(/[0-9.]/.test(raw.charAt(i))) digitsBefore++;
  }
  el.value=shown;
  var next=0, seen=0;
  while(next<shown.length && seen<digitsBefore){
    if(/[0-9.]/.test(shown.charAt(next))) seen++;
    next++;
  }
  try{ el.setSelectionRange(next, next); }catch(e){}
  residentSizeMoney(el);
}
function residentGuestNames(ds){
  if(typeof SCHED==='undefined') return '';
  var names=[];
  SCHED.forEach(function(r){
    if(!r || (r.v||r.venue)!==curV || r.d!==ds || r._s==='empty') return;
    var nm=r.dj==null?'':String(r.dj).trim();
    if(!nm || /^tbd$/i.test(nm)) return;
    if(typeof djLabel==='function') nm=djLabel(nm);
    if(names.indexOf(nm)<0) names.push(nm);
  });
  return names.join(' · ');
}
function residentRowTotal(row){
  var n=0;
  if(row && row.hotel!=null && row.hotel!=='') n+=+row.hotel||0;
  if(row && row.ground!=null && row.ground!=='') n+=+row.ground||0;
  RESIDENT_ROLES.forEach(function(role){
    var cell=row && row[role.id];
    if(cell && cell.amt!=null && cell.amt!=='') n+=+cell.amt||0;
  });
  return n||null;
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
    residentFormatMoneyInput(el, row[field]);
  }else if(role){
    if(!row[role] || typeof row[role]!=='object') row[role]={};
    if(field==='amt'){
      var amt=String(el.value||'').replace(/[^0-9.]/g,'');
      row[role].amt=amt==='' ? null : +amt;
      residentFormatMoneyInput(el, row[role].amt);
    }else{
      row[role].name=String(el.value||'');
      residentSizeMoney(el);
    }
  }
  RESIDENT_DJ[key]=row;
  var tr=el.closest?el.closest('tr'):null;
  if(tr){
    var tot=tr.querySelector('.res-total');
    if(tot) tot.textContent=residentMoney(residentRowTotal(row));
  }
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

  var h='<table class="sched-tbl res-tbl"><colgroup><col class="res-date-col"><col class="res-guest-col"><col class="res-amt-col"><col class="res-amt-col">';
  RESIDENT_ROLES.forEach(function(){ h+='<col class="res-name-col"><col class="res-amt-col">'; });
  h+='<col class="res-total-col"></colgroup><thead>';
  h+='<tr>';
  h+='<th class="sc-date" rowspan="2">Date</th>';
  h+='<th class="res-group res-guest" rowspan="2">Guest DJ</th>';
  h+='<th class="res-group res-tone-hotel res-split" rowspan="2">Hotel</th>';
  h+='<th class="res-group res-tone-ground res-split" rowspan="2">Ground</th>';
  RESIDENT_ROLES.forEach(function(role){
    h+='<th class="res-group res-tone-'+role.id+' res-split" colspan="2">'+role.label+'</th>';
  });
  h+='<th class="res-group res-tone-total res-split" rowspan="2">Total</th>';
  h+='</tr><tr>';
  RESIDENT_ROLES.forEach(function(role){
    h+='<th class="res-sub res-tone-'+role.id+' res-split">Name</th><th class="res-sub res-tone-'+role.id+'">$</th>';
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
    var guests=residentGuestNames(ds);
    h+='<td class="sc-date-cell">'+dateStr+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
    h+='<td class="res-guest-cell" title="'+residentEsc(guests)+'"><b>'+residentEsc(guests)+'</b></td>';
    h+='<td class="res-cell res-tone-hotel res-split"><input class="res-money" size="'+residentMoneySize(row.hotel)+'" inputmode="decimal" data-ds="'+ds+'" data-field="hotel" value="'+residentMoney(row.hotel)+'" oninput="residentEdit(this)"></td>';
    h+='<td class="res-cell res-tone-ground res-split"><input class="res-money" size="'+residentMoneySize(row.ground)+'" inputmode="decimal" data-ds="'+ds+'" data-field="ground" value="'+residentMoney(row.ground)+'" oninput="residentEdit(this)"></td>';
    RESIDENT_ROLES.forEach(function(role){
      var cell=(row[role.id] && typeof row[role.id]==='object') ? row[role.id] : {};
      h+='<td class="res-cell res-tone-'+role.id+' res-split"><input class="res-name" data-ds="'+ds+'" data-role="'+role.id+'" data-field="name" value="'+residentEsc(cell.name||'')+'" onchange="residentEdit(this)"></td>';
      h+='<td class="res-cell res-tone-'+role.id+'"><input class="res-money" size="'+residentMoneySize(cell.amt)+'" inputmode="decimal" data-ds="'+ds+'" data-role="'+role.id+'" data-field="amt" value="'+residentMoney(cell.amt)+'" oninput="residentEdit(this)"></td>';
    });
    h+='<td class="res-cell res-tone-total res-split res-total">'+residentMoney(residentRowTotal(row))+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  body.innerHTML=h;
  requestAnimationFrame(fitResidentRows);
}
function fitResidentRows(){
  var body=document.getElementById('residentBody');
  if(!body || typeof curView==='undefined' || curView!=='resident') return;
  var rows=body.querySelectorAll('tbody tr').length||28;
  var available=body.clientHeight;
  if(available<80){
    body._fitTries=(body._fitTries||0)+1;
    if(body._fitTries<8) requestAnimationFrame(fitResidentRows);
    return;
  }
  body._fitTries=0;
  var head=body.querySelector('thead');
  var headH=head?head.offsetHeight:36;
  var rowH=Math.max(13, Math.floor(((available-headH-2)/rows)*10)/10);
  var font=Math.max(8, Math.min(12, rowH*0.62));
  body.style.setProperty('--res-row-h', rowH+'px');
  body.style.setProperty('--res-font', font+'px');
  if(!window._residentFitBound){
    window._residentFitBound=true;
    window.addEventListener('resize', fitResidentRows);
  }
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
