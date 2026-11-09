/* Resident DJ calendar. Separate from the Guest DJ schedule.
   Reads the same fiscal dates for the month strip. Never writes SCHED. */

var RESIDENT_DJ = {};
var RESIDENT_VENUES = ['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge','AVA MM','MILA 3F','CLAUDIE','AVA CG','CASA HONO'];
var resYear = null, resMonth = null, resVenue = null;
var RESIDENT_ROLES = [
  {id:'resident_dj', label:'Resident DJ'},
  {id:'light_jockey', label:'Light Jockey'},
  {id:'kryo', label:'KRYO'},
  {id:'greeters', label:'Greeters'},
  {id:'mm', label:'MM'}
];

function residentHere(){
  if(resYear==null){
    var y=parseInt(String(typeof TODAY!=='undefined'?TODAY:'').slice(0,4),10);
    resYear=y||2026;
  }
  if(resMonth==null) resMonth=(typeof curM!=='undefined')?curM:0;
  if(!resVenue || RESIDENT_VENUES.indexOf(resVenue)<0){
    resVenue=(typeof curV!=='undefined' && RESIDENT_VENUES.indexOf(curV)>=0)?curV:RESIDENT_VENUES[0];
  }
  return {year:resYear, month:resMonth, venue:resVenue};
}
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
function residentNameSize(v){
  var s=String(v||'');
  return Math.max(4, Math.min(22, s.length||4));
}
function residentSizeMoney(el){
  if(!el) return;
  var name=el.getAttribute('data-field')==='name';
  var n=String(el.value||'').length;
  var ch=name?Math.max(4, Math.min(22, n||4)):Math.max(3, n||1);
  el.size=ch;
  if(!name) el.style.width=ch+'ch';
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
    if(!r || (r.v||r.venue)!==residentHere().venue || r.d!==ds || r._s==='empty') return;
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
function residentBits(row, role, field){
  row=row||{};
  if(role){
    var cell=(row[role] && typeof row[role]==='object') ? row[role] : {};
    return {amt:cell.amt, paid:!!cell.paid, note:cell.note||''};
  }
  return {amt:row[field], paid:!!row[field+'Paid'], note:row[field+'Note']||''};
}
function residentApplyPay(td, bits){
  if(!td) return;
  bits=bits||{};
  td.classList.remove('res-due','res-paid');
  if(bits.paid) td.classList.add('res-paid');
  else if(bits.amt!=null && bits.amt!=='' && isFinite(+bits.amt)) td.classList.add('res-due');
  var dot=td.querySelector('.res-dot');
  if(dot){
    var text=String(bits.note||'').trim();
    dot.classList.toggle('is-paid', !!bits.paid);
    dot.classList.toggle('has-note', !!text);
    dot.title=text||'';
  }
}
function residentWriteFlag(ds, field, role, kind, value){
  var key=residentKey(residentHere().venue, ds);
  var row=RESIDENT_DJ[key];
  if(!row || typeof row!=='object') row={};
  if(role){
    if(!row[role] || typeof row[role]!=='object') row[role]={};
    if(kind==='paid') row[role].paid=!!value;
    else row[role].note=String(value||'').trim();
  }else if(kind==='paid'){
    row[field+'Paid']=!!value;
  }else{
    row[field+'Note']=String(value||'').trim();
  }
  RESIDENT_DJ[key]=row;
  var body=document.getElementById('residentBody');
  var sel='td .res-dot[data-ds="'+ds+'"][data-field="'+field+'"]'+(role?'[data-role="'+role+'"]':'');
  var dot=body?body.querySelector(sel):null;
  if(dot) residentApplyPay(dot.closest('td'), residentBits(row, role, field));
  residentSave(key);
}
function residentOpenPop(btn){
  var pop=document.getElementById('resPop');
  if(!pop){
    pop=document.createElement('div');
    pop.id='resPop';
    pop.className='res-pop';
    pop.innerHTML='<label><input type="checkbox"> Paid</label><textarea rows="2" placeholder="Comment"></textarea>';
    document.body.appendChild(pop);
    pop.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    pop.querySelector('input').addEventListener('change', function(){
      residentWriteFlag(pop.getAttribute('data-ds'), pop.getAttribute('data-field'), pop.getAttribute('data-role')||'', 'paid', this.checked);
    });
    pop.querySelector('textarea').addEventListener('change', function(){
      residentWriteFlag(pop.getAttribute('data-ds'), pop.getAttribute('data-field'), pop.getAttribute('data-role')||'', 'note', this.value);
    });
  }
  var ds=btn.getAttribute('data-ds');
  var field=btn.getAttribute('data-field');
  var role=btn.getAttribute('data-role')||'';
  var bits=residentBits(residentDay(residentHere().venue, ds), role, field);
  pop.setAttribute('data-ds', ds);
  pop.setAttribute('data-field', field);
  pop.setAttribute('data-role', role);
  pop.querySelector('input').checked=!!bits.paid;
  pop.querySelector('textarea').value=bits.note||'';
  var box=btn.getBoundingClientRect();
  pop.style.left=Math.max(8, Math.min(window.innerWidth-196, box.left-80))+'px';
  pop.style.top=(box.bottom+6)+'px';
  pop.classList.add('on');
}
function residentMoneyTd(ds, field, role, tone, amt, paid, note){
  var cls='res-cell res-pay res-tone-'+tone+(field==='amt'?'':' res-split');
  if(paid) cls+=' res-paid';
  else if(amt!=null && amt!=='' && isFinite(+amt)) cls+=' res-due';
  var roleAttr=role?' data-role="'+role+'"':'';
  var noted=String(note||'').trim();
  return '<td class="'+cls+'"><input class="res-money" size="'+residentMoneySize(amt)+'" inputmode="decimal" data-ds="'+ds+'"'+roleAttr+' data-field="'+field+'" value="'+residentMoney(amt)+'" oninput="residentEdit(this)">'
    +'<button type="button" class="res-flag res-dot'+(paid?' is-paid':'')+(noted?' has-note':'')+'" data-ds="'+ds+'"'+roleAttr+' data-field="'+field+'" title="'+residentEsc(noted)+'"></button></td>';
}
function residentEdit(el){
  if(!el) return;
  var ds=el.getAttribute('data-ds');
  var field=el.getAttribute('data-field');
  var role=el.getAttribute('data-role')||'';
  var key=residentKey(residentHere().venue, ds);
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
  if(field==='hotel' || field==='ground' || field==='amt') residentApplyPay(el.closest('td'), residentBits(row, role, field));
  var tr=el.closest?el.closest('tr'):null;
  if(tr){
    var tot=tr.querySelector('.res-total');
    if(tot) tot.textContent=residentMoney(residentRowTotal(row));
  }
  residentSave(key);
}
var _residentSaveTimers={};
function residentSave(key){
  clearTimeout(_residentSaveTimers[key]);
  _residentSaveTimers[key]=setTimeout(function(){
    if(!window._fbDb) return;
    var row=RESIDENT_DJ[key];
    /* Own path. Never SCHED, acctData, or the guest calendar. */
    try{ window._fbDb.ref('rdg/residentDj/'+key).set(row||null); }catch(e){}
  }, 160);
}
function residentPaintFromStore(){
  var body=document.getElementById('residentBody');
  if(!body || typeof curView==='undefined' || curView!=='resident') return;
  var inputs=body.querySelectorAll('input[data-ds]');
  if(!inputs.length){ renderResidentCalendar(); return; }
  var seen={};
  inputs.forEach(function(el){
    if(el===document.activeElement) return;
    var ds=el.getAttribute('data-ds');
    var field=el.getAttribute('data-field');
    var role=el.getAttribute('data-role')||'';
    var row=residentDay(residentHere().venue, ds);
    if(field==='hotel' || field==='ground') el.value=residentMoney(row[field]);
    else if(role){
      var cell=(row[role] && typeof row[role]==='object') ? row[role] : {};
      el.value=field==='amt' ? residentMoney(cell.amt) : (cell.name||'');
    }
    residentSizeMoney(el);
    if(field==='hotel' || field==='ground' || field==='amt') residentApplyPay(el.parentNode, residentBits(row, role, field));
    seen[ds]=row;
  });
  body.querySelectorAll('tr').forEach(function(tr){
    var tot=tr.querySelector('.res-total');
    var any=tr.querySelector('input[data-ds]');
    if(!tot || !any) return;
    tot.textContent=residentMoney(residentRowTotal(residentDay(residentHere().venue, any.getAttribute('data-ds'))));
  });
}
function residentSetFilter(kind, value){
  if(kind==='year') resYear=+value;
  else if(kind==='month') resMonth=+value;
  else if(kind==='venue' && RESIDENT_VENUES.indexOf(value)>=0) resVenue=value;
  if(curView==='resident') renderResidentCalendar();
}
function renderResidentCalendar(){
  var body=document.getElementById('residentBody');
  if(!body) return;
  initResidentDj();
  var here=residentHere();
  var yr=here.year, mo=here.month;
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  var filters=document.getElementById('residentFilters');
  if(filters){
    var years=[];
    for(var y=yr-1;y<=yr+1;y++) years.push(y);
    var fh='<label>Year<select onchange="residentSetFilter(\'year\',this.value)">';
    years.forEach(function(y){ fh+='<option'+(y===yr?' selected':'')+'>'+y+'</option>'; });
    fh+='</select></label><label>Location<select onchange="residentSetFilter(\'venue\',this.value)">';
    RESIDENT_VENUES.forEach(function(v){ fh+='<option'+(v===here.venue?' selected':'')+'>'+residentEsc(v)+'</option>'; });
    fh+='</select></label><label>Month<select onchange="residentSetFilter(\'month\',this.value)">';
    for(var mi=0;mi<12;mi++) fh+='<option value="'+mi+'"'+(mi===mo?' selected':'')+'>'+MN_FULL[mi]+'</option>';
    fh+='</select></label><span>'+fiscalPeriodShortRange(yr, mo)+'</span>';
    filters.innerHTML=fh;
  }
  var sub=document.getElementById('pgSub');
  if(sub && curView==='resident') sub.innerHTML='<span>'+residentEsc(here.venue)+' · Resident DJ</span>';

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
    var row=residentDay(residentHere().venue, ds);
    h+='<tr class="'+dc+'">';
    var guests=residentGuestNames(ds);
    h+='<td class="sc-date-cell">'+dateStr+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
    h+='<td class="res-guest-cell" title="'+residentEsc(guests)+'"><b>'+residentEsc(guests)+'</b></td>';
    h+=residentMoneyTd(ds, 'hotel', '', 'hotel', row.hotel, row.hotelPaid, row.hotelNote);
    h+=residentMoneyTd(ds, 'ground', '', 'ground', row.ground, row.groundPaid, row.groundNote);
    RESIDENT_ROLES.forEach(function(role){
      var cell=(row[role.id] && typeof row[role.id]==='object') ? row[role.id] : {};
      h+='<td class="res-cell res-tone-'+role.id+' res-split"><input class="res-name" size="'+residentNameSize(cell.name)+'" data-ds="'+ds+'" data-role="'+role.id+'" data-field="name" value="'+residentEsc(cell.name||'')+'" oninput="residentEdit(this)"></td>';
      h+=residentMoneyTd(ds, 'amt', role.id, role.id, cell.amt, cell.paid, cell.note);
    });
    h+='<td class="res-cell res-tone-total res-split res-total">'+residentMoney(residentRowTotal(row))+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  body.innerHTML=h;
  residentIndexCells();
  requestAnimationFrame(fitResidentRows);
}
var _resAnchor=null, _resEnd=null, _resDrag=false, _resPickOn=false, _resClip='';
function residentGrid(){
  var body=document.getElementById('residentBody');
  if(!body) return [];
  return Array.prototype.map.call(body.querySelectorAll('tbody tr'), function(tr){
    return Array.prototype.slice.call(tr.querySelectorAll('input.res-name, input.res-money'));
  });
}
function residentIndexCells(){
  residentGrid().forEach(function(row, r){
    row.forEach(function(el, c){ el.setAttribute('data-r', r); el.setAttribute('data-c', c); });
  });
}
function residentPos(el){
  return {r:+el.getAttribute('data-r')||0, c:+el.getAttribute('data-c')||0};
}
function residentMark(){
  var body=document.getElementById('residentBody');
  if(!body) return;
  body.querySelectorAll('td.res-picked').forEach(function(td){ td.classList.remove('res-picked'); });
  if(!_resAnchor || !_resEnd) return;
  var r1=Math.min(_resAnchor.r,_resEnd.r), r2=Math.max(_resAnchor.r,_resEnd.r);
  var c1=Math.min(_resAnchor.c,_resEnd.c), c2=Math.max(_resAnchor.c,_resEnd.c);
  var grid=residentGrid();
  for(var r=r1;r<=r2;r++){
    for(var c=c1;c<=c2;c++){
      var el=grid[r]&&grid[r][c];
      if(el && el.parentNode) el.parentNode.classList.add('res-picked');
    }
  }
}
function residentSelectedTsv(){
  if(!_resAnchor || !_resEnd) return '';
  var r1=Math.min(_resAnchor.r,_resEnd.r), r2=Math.max(_resAnchor.r,_resEnd.r);
  var c1=Math.min(_resAnchor.c,_resEnd.c), c2=Math.max(_resAnchor.c,_resEnd.c);
  var grid=residentGrid();
  var lines=[];
  for(var r=r1;r<=r2;r++){
    var cols=[];
    for(var c=c1;c<=c2;c++){
      var el=grid[r]&&grid[r][c];
      cols.push(el?el.value:'');
    }
    lines.push(cols.join('\t'));
  }
  return lines.join('\n');
}
function residentPasteBlock(startEl, text){
  var grid=residentGrid();
  var pos=residentPos(startEl);
  var lines=String(text||'').replace(/\r/g,'').replace(/\n$/,'');
  if(!lines) return;
  lines.split('\n').forEach(function(line, ri){
    line.split('\t').forEach(function(val, ci){
      var el=grid[pos.r+ri] && grid[pos.r+ri][pos.c+ci];
      if(!el) return;
      el.value=val;
      residentEdit(el);
    });
  });
}
function residentCellFromEvent(e){
  var body=document.getElementById('residentBody');
  if(!body || !e || !e.target || !e.target.closest) return null;
  if(e.target.closest('.res-flag')) return null;
  var el=e.target.closest('input');
  if(el && body.contains(el) && (el.classList.contains('res-name') || el.classList.contains('res-money'))) return el;
  var td=e.target.closest('td');
  if(!td || !body.contains(td)) return null;
  return td.querySelector('input.res-name, input.res-money');
}
function residentPasteTarget(){
  var body=document.getElementById('residentBody');
  var el=document.activeElement;
  if(el && body && body.contains(el) && el.hasAttribute && el.hasAttribute('data-r')) return el;
  if(!_resAnchor) return null;
  var grid=residentGrid();
  return (grid[_resAnchor.r] && grid[_resAnchor.r][_resAnchor.c]) || null;
}
function residentApplyPaste(text){
  var el=residentPasteTarget();
  if(!el || text==null || text==='') return;
  residentPasteBlock(el, text);
}
function residentPickInit(){
  if(_resPickOn) return;
  _resPickOn=true;
  document.addEventListener('click', function(e){
    var btn=e.target && e.target.closest ? e.target.closest('.res-flag') : null;
    var body=document.getElementById('residentBody');
    if(!btn || !body || !body.contains(btn) || typeof curView==='undefined' || curView!=='resident') return;
    e.preventDefault();
    residentOpenPop(btn);
  });
  document.addEventListener('mousedown', function(e){
    var pop=document.getElementById('resPop');
    if(pop && pop.classList.contains('on') && !(e.target.closest && (e.target.closest('#resPop') || e.target.closest('.res-dot')))) pop.classList.remove('on');
    var body=document.getElementById('residentBody');
    if(!body || typeof curView==='undefined' || curView!=='resident') return;
    var el=residentCellFromEvent(e);
    if(!el){
      if(e.target && body.contains(e.target)) return;
      _resAnchor=null; _resEnd=null; residentMark();
      return;
    }
    if(document.activeElement!==el) el.focus();
    var pos=residentPos(el);
    if(e.shiftKey && _resAnchor) _resEnd=pos;
    else { _resAnchor=pos; _resEnd=pos; _resDrag=true; }
    residentMark();
  });
  document.addEventListener('mouseover', function(e){
    if(!_resDrag) return;
    var el=residentCellFromEvent(e);
    if(!el) return;
    _resEnd=residentPos(el);
    residentMark();
  });
  document.addEventListener('mouseup', function(){ _resDrag=false; });
  document.addEventListener('copy', function(e){
    if(typeof curView==='undefined' || curView!=='resident' || !_resAnchor || !_resEnd) return;
    var ae=document.activeElement;
    if(ae && ae.selectionStart!=null && ae.selectionStart!==ae.selectionEnd && _resAnchor.r===_resEnd.r && _resAnchor.c===_resEnd.c) return;
    var text=residentSelectedTsv();
    if(!text) return;
    _resClip=text;
    e.preventDefault();
    if(e.clipboardData) e.clipboardData.setData('text/plain', text);
  });
  document.addEventListener('paste', function(e){
    if(typeof curView==='undefined' || curView!=='resident') return;
    var body=document.getElementById('residentBody');
    if(!body) return;
    var hit=residentCellFromEvent(e) || (document.activeElement && body.contains(document.activeElement) ? document.activeElement : null);
    if(!hit && !_resAnchor) return;
    var text='';
    try{ text=e.clipboardData ? e.clipboardData.getData('text/plain') : ''; }catch(err){}
    if(!text) text=_resClip;
    if(!text) return;
    e.preventDefault();
    if(hit && hit.focus) hit.focus();
    residentApplyPaste(text);
  }, true);
  document.addEventListener('keydown', function(e){
    if(typeof curView==='undefined' || curView!=='resident') return;
    var key=String(e.key||'').toLowerCase();
    if(!(e.ctrlKey||e.metaKey) || key!=='v') return;
    var body=document.getElementById('residentBody');
    if(!body || !_resAnchor) return;
    var onInput=e.target && e.target.closest && e.target.closest('#residentBody input');
    if(onInput) return;
    e.preventDefault();
    function apply(text){ residentApplyPaste(text||_resClip); }
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(t){ apply(t); }).catch(function(){ apply(_resClip); });
    } else apply(_resClip);
  }, true);
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
  residentPickInit();
  if(window._residentDjListening || !window._fbDb) return;
  window._residentDjListening=true;
  window._fbDb.ref('rdg/residentDj').on('value', function(snap){
    RESIDENT_DJ=snap.val()||{};
    residentPaintFromStore();
  });
}
try{ initResidentDj(); }catch(eRes){}
