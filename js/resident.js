/* Resident DJ calendar. Separate from the Guest DJ schedule.
   Reads the same fiscal dates for the month strip. Never writes SCHED.
   Data: rdg/residentDj/{venue__date}. Columns and widths: rdg/residentCols/{venue}.
   Every edit writes only its own field so two people on the same night never overwrite each other. */

var RESIDENT_DJ = {};
var RESIDENT_COLS = {};
var RESIDENT_VENUES = ['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge','AVA MM','MILA 3F','CLAUDIE','AVA CG','CASA HONO'];
var RESIDENT_DEFAULT_COLS = [
  {id:'hotel', label:'Hotel', kind:'money'},
  {id:'ground', label:'Ground', kind:'money'},
  {id:'resident_dj', label:'Resident DJ', kind:'role'},
  {id:'light_jockey', label:'Light Jockey', kind:'role'},
  {id:'kryo', label:'KRYO', kind:'role'},
  {id:'greeters', label:'Greeters', kind:'role'},
  {id:'mm', label:'MM', kind:'role'}
];
var RESIDENT_DEFAULT_W = {date:190, guest:130, total:80, money:80, name:96, amt:74};
var resYear = null, resMonth = null, resVenue = null;

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
function residentSetVenue(v){
  if(RESIDENT_VENUES.indexOf(v)>=0) resVenue=v;
}
function residentVenueKey(venue){ return String(venue||'').replace(/[^a-zA-Z0-9]+/g,'_'); }
function residentKey(venue, ds){ return residentVenueKey(venue)+'__'+String(ds||''); }
function residentEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function residentList(v){
  if(!v) return [];
  return Array.isArray(v)?v:Object.keys(v).sort(function(a,b){ return (+a)-(+b); }).map(function(k){ return v[k]; });
}
function residentCols(venue){
  var cfg=RESIDENT_COLS[residentVenueKey(venue||residentHere().venue)];
  var list=cfg&&cfg.cols?residentList(cfg.cols):null;
  list=(list||[]).filter(function(c){ return c&&c.id&&c.label; });
  return list.length?list:RESIDENT_DEFAULT_COLS.slice();
}
function residentWidths(venue){
  var cfg=RESIDENT_COLS[residentVenueKey(venue||residentHere().venue)];
  return (cfg&&cfg.widths&&typeof cfg.widths==='object')?cfg.widths:{};
}
function residentColById(id){
  var hit=null;
  residentCols().forEach(function(c){ if(c.id===id) hit=c; });
  return hit;
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
function residentBits(row, col){
  row=row||{};
  if(!col) return {};
  if(col.kind==='role'){
    var cell=(row[col.id] && typeof row[col.id]==='object') ? row[col.id] : {};
    return {name:cell.name||'', amt:cell.amt, paid:!!cell.paid, note:cell.note||''};
  }
  return {amt:row[col.id], paid:!!row[col.id+'Paid'], note:row[col.id+'Note']||''};
}
function residentSub(col, part){
  if(col.kind==='role') return col.id+'/'+part;
  if(part==='amt') return col.id;
  return col.id+(part==='paid'?'Paid':'Note');
}
function residentHasAmt(v){ return v!=null && v!=='' && isFinite(+v); }
function residentRowTotal(row, venue){
  var n=0, any=false;
  residentCols(venue).forEach(function(col){
    var b=residentBits(row, col);
    if(residentHasAmt(b.amt)){ n+=+b.amt; any=true; }
  });
  return any?n:null;
}
/* Fiscal-month total for one column. Feeds the Budget page. */
function residentMonthTotal(venue, year, mm, colId){
  var mi=(parseInt(mm,10)||1)-1;
  if(typeof datesInFiscalPeriod!=='function') return 0;
  var col=null;
  residentCols(venue).forEach(function(c){ if(c.id===colId) col=c; });
  if(!col) col={id:colId, kind:colId==='hotel'||colId==='ground'?'money':'role'};
  var sum=0;
  datesInFiscalPeriod(+year, mi).forEach(function(ds){
    var b=residentBits(residentDay(venue, ds), col);
    if(residentHasAmt(b.amt)) sum+=+b.amt;
  });
  return Math.round(sum);
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

/* Writes. Local state changes at once; Firebase gets only the touched field. */
var _residentSaveTimers={}, _residentPending={};
function residentSetPath(obj, path, value){
  var parts=path.split('/');
  var cur=obj;
  for(var i=0;i<parts.length-1;i++){
    if(!cur[parts[i]] || typeof cur[parts[i]]!=='object') cur[parts[i]]={};
    cur=cur[parts[i]];
  }
  if(value==null || value==='') delete cur[parts[parts.length-1]];
  else cur[parts[parts.length-1]]=value;
}
function residentPut(ds, sub, value){
  var key=residentKey(residentHere().venue, ds);
  if(!RESIDENT_DJ[key] || typeof RESIDENT_DJ[key]!=='object') RESIDENT_DJ[key]={};
  residentSetPath(RESIDENT_DJ[key], sub, value);
  var path=key+'/'+sub;
  _residentPending[path]=value==null||value===''?null:value;
  clearTimeout(_residentSaveTimers[path]);
  _residentSaveTimers[path]=setTimeout(function(){
    var v=_residentPending[path];
    delete _residentPending[path];
    if(!window._fbDb) return;
    /* Own path. Never SCHED, acctData, or the guest calendar. */
    try{ window._fbDb.ref('rdg/residentDj/'+path).set(v==null?null:v); }catch(e){}
  }, 220);
}
function residentSaveCols(cols){
  var vk=residentVenueKey(residentHere().venue);
  if(!RESIDENT_COLS[vk]) RESIDENT_COLS[vk]={};
  RESIDENT_COLS[vk].cols=cols;
  if(window._fbDb){ try{ window._fbDb.ref('rdg/residentCols/'+vk+'/cols').set(cols); }catch(e){} }
  renderResidentCalendar();
}
function residentSaveWidth(wkey, px){
  var vk=residentVenueKey(residentHere().venue);
  if(!RESIDENT_COLS[vk]) RESIDENT_COLS[vk]={};
  if(!RESIDENT_COLS[vk].widths) RESIDENT_COLS[vk].widths={};
  RESIDENT_COLS[vk].widths[wkey]=px;
  if(window._fbDb){ try{ window._fbDb.ref('rdg/residentCols/'+vk+'/widths/'+wkey).set(px); }catch(e){} }
}

/* Paint one column cell group (name + amount) from state. */
function residentPaintCell(tr, col){
  if(!tr || !col) return;
  var ds=tr.getAttribute('data-ds');
  var b=residentBits(residentDay(residentHere().venue, ds), col);
  var paid=!!b.paid;
  var due=!paid && residentHasAmt(b.amt);
  var note=String(b.note||'').trim();
  tr.querySelectorAll('td[data-col="'+col.id+'"]').forEach(function(td){
    td.classList.toggle('res-paid', paid);
    td.classList.toggle('res-due', due);
    td.classList.toggle('res-has-note', !!note);
    td.title=note;
    var inp=td.querySelector('input');
    if(inp && inp!==document.activeElement){
      var part=inp.getAttribute('data-part');
      inp.value=part==='name'?(b.name||''):residentMoney(b.amt);
    }
    var dot=td.querySelector('.res-dot');
    if(dot) dot.classList.toggle('is-paid', paid);
  });
}
function residentPaintTotal(tr){
  var tot=tr&&tr.querySelector('.res-total');
  if(tot) tot.textContent=residentMoney(residentRowTotal(residentDay(residentHere().venue, tr.getAttribute('data-ds'))));
}
function residentEdit(el){
  if(!el) return;
  var tr=el.closest('tr');
  var ds=tr&&tr.getAttribute('data-ds');
  var col=residentColById(el.getAttribute('data-col'));
  var part=el.getAttribute('data-part');
  if(!ds || !col) return;
  if(part==='name'){
    residentPut(ds, residentSub(col,'name'), String(el.value||''));
  }else{
    var raw=String(el.value||'').replace(/[^0-9.]/g,'');
    var n=raw===''?null:+raw;
    if(n!=null && !isFinite(n)) n=null;
    residentPut(ds, residentSub(col,'amt'), n);
    residentFormatMoneyInput(el, n);
  }
  residentPaintCell(tr, col);
  residentPaintTotal(tr);
}
function residentFormatMoneyInput(el, n){
  if(!el) return;
  var shown=residentMoney(n);
  var raw=String(el.value||'');
  if(raw===shown) return;
  var pos=el.selectionStart||0;
  var digitsBefore=0;
  for(var i=0;i<pos && i<raw.length;i++){
    if(/[0-9.]/.test(raw.charAt(i))) digitsBefore++;
  }
  el.value=shown;
  if(el!==document.activeElement) return;
  var next=0, seen=0;
  while(next<shown.length && seen<digitsBefore){
    if(/[0-9.]/.test(shown.charAt(next))) seen++;
    next++;
  }
  try{ el.setSelectionRange(next, next); }catch(e){}
}
function residentTogglePaid(btn){
  var tr=btn.closest('tr');
  var col=residentColById(btn.getAttribute('data-col'));
  if(!tr || !col) return;
  var ds=tr.getAttribute('data-ds');
  var b=residentBits(residentDay(residentHere().venue, ds), col);
  residentPut(ds, residentSub(col,'paid'), b.paid?null:true);
  residentPaintCell(tr, col);
}

/* Comment popover, opened from the right-click menu. */
function residentOpenComment(td, x, y){
  var tr=td&&td.closest('tr');
  var col=td&&residentColById(td.getAttribute('data-col'));
  if(!tr || !col) return;
  var pop=document.getElementById('resPop');
  if(!pop){
    pop=document.createElement('div');
    pop.id='resPop';
    pop.className='res-pop';
    pop.innerHTML='<b class="res-pop-hd"></b><textarea rows="3" placeholder="Comment"></textarea>'
      +'<div class="res-pop-acts"><button type="button" data-act="save">Save</button><button type="button" data-act="del">Delete</button></div>';
    document.body.appendChild(pop);
    pop.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    pop.addEventListener('click', function(e){
      var act=e.target&&e.target.getAttribute&&e.target.getAttribute('data-act');
      if(!act) return;
      var c=residentColById(pop.getAttribute('data-col'));
      var d=pop.getAttribute('data-ds');
      if(!c||!d) return;
      var text=act==='del'?'':String(pop.querySelector('textarea').value||'').trim();
      residentPut(d, residentSub(c,'note'), text||null);
      var row=document.querySelector('#residentBody tr[data-ds="'+d+'"]');
      residentPaintCell(row, c);
      pop.classList.remove('on');
    });
  }
  var ds=tr.getAttribute('data-ds');
  var b=residentBits(residentDay(residentHere().venue, ds), col);
  pop.setAttribute('data-ds', ds);
  pop.setAttribute('data-col', col.id);
  pop.querySelector('.res-pop-hd').textContent=col.label+' · '+ds;
  pop.querySelector('textarea').value=b.note||'';
  pop.style.left=Math.max(8, Math.min(window.innerWidth-236, x))+'px';
  pop.style.top=Math.max(8, Math.min(window.innerHeight-160, y))+'px';
  pop.classList.add('on');
  setTimeout(function(){ try{ pop.querySelector('textarea').focus(); }catch(e){} }, 0);
}
function residentCloseMenus(){
  var m=document.getElementById('resMenu');
  if(m) m.classList.remove('on');
}
function residentMenu(x, y, items){
  var m=document.getElementById('resMenu');
  if(!m){
    m=document.createElement('div');
    m.id='resMenu';
    m.className='res-menu';
    document.body.appendChild(m);
    m.addEventListener('mousedown', function(e){ e.stopPropagation(); });
  }
  m.innerHTML='';
  items.forEach(function(it){
    var b=document.createElement('button');
    b.type='button';
    b.textContent=it.label;
    if(it.danger) b.className='danger';
    b.addEventListener('click', function(){ residentCloseMenus(); it.run(); });
    m.appendChild(b);
  });
  m.style.left=Math.max(8, Math.min(window.innerWidth-200, x))+'px';
  m.style.top=Math.max(8, Math.min(window.innerHeight-40*items.length-16, y))+'px';
  m.classList.add('on');
}
function residentNewColId(label){
  var base=String(label||'col').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'col';
  return 'c_'+base+'_'+Date.now().toString(36);
}
function residentAddColumn(afterId){
  var label=prompt('New column name');
  if(label==null) return;
  label=String(label).trim();
  if(!label) return;
  var withName=confirm('Add a Name field next to the $ amount?\n\nOK = Name + $\nCancel = $ only');
  var cols=residentCols().slice();
  var col={id:residentNewColId(label), label:label, kind:withName?'role':'money'};
  var at=cols.length;
  cols.forEach(function(c, i){ if(c.id===afterId) at=i+1; });
  cols.splice(at, 0, col);
  residentSaveCols(cols);
}
function residentRenameColumn(id){
  var col=residentColById(id);
  if(!col) return;
  var label=prompt('Column name', col.label);
  if(label==null) return;
  label=String(label).trim();
  if(!label) return;
  residentSaveCols(residentCols().map(function(c){ return c.id===id?{id:c.id, label:label, kind:c.kind}:c; }));
}
function residentDeleteColumn(id){
  var col=residentColById(id);
  if(!col) return;
  if(!confirm('Delete the '+col.label+' column for '+residentHere().venue+'?\n\nAmounts already entered stay saved and come back if you add it again.')) return;
  residentSaveCols(residentCols().filter(function(c){ return c.id!==id; }));
}

function residentSetFilter(kind, value){
  if(kind==='year') resYear=+value;
  else if(kind==='month') resMonth=+value;
  else if(kind==='venue' && RESIDENT_VENUES.indexOf(value)>=0) resVenue=value;
  if(curView==='resident') renderResidentCalendar();
}
function residentW(widths, key, fallback){
  var n=+widths[key];
  return n>=28&&n<=800?n:fallback;
}
function renderResidentCalendar(){
  var body=document.getElementById('residentBody');
  if(!body) return;
  initResidentDj();
  var here=residentHere();
  var yr=here.year, mo=here.month;
  var fiscalDates=datesInFiscalPeriod(yr, mo);
  var cols=residentCols(here.venue);
  var widths=residentWidths(here.venue);
  var filters=document.getElementById('residentFilters');
  if(filters){
    var years=[];
    for(var y=yr-1;y<=yr+1;y++) years.push(y);
    var fh='<div class="res-title">'+residentEsc(here.venue)+' Resident Tracker</div>';
    fh+='<label>Year<select onchange="residentSetFilter(\'year\',this.value)">';
    years.forEach(function(y){ fh+='<option'+(y===yr?' selected':'')+'>'+y+'</option>'; });
    fh+='</select></label><label>Location<select onchange="residentSetFilter(\'venue\',this.value)">';
    RESIDENT_VENUES.forEach(function(v){ fh+='<option'+(v===here.venue?' selected':'')+'>'+residentEsc(v)+'</option>'; });
    fh+='</select></label><label>Month<select onchange="residentSetFilter(\'month\',this.value)">';
    for(var mi=0;mi<12;mi++) fh+='<option value="'+mi+'"'+(mi===mo?' selected':'')+'>'+MN_FULL[mi]+'</option>';
    fh+='</select></label><button type="button" class="res-add-col" onclick="residentAddColumn()">+ Column</button>';
    fh+='<span>'+fiscalPeriodShortRange(yr, mo)+' · right-click a header to rename or delete, a cell to comment</span>';
    filters.innerHTML=fh;
  }
  var sub=document.getElementById('pgSub');
  if(sub && curView==='resident') sub.innerHTML='<span>'+residentEsc(here.venue)+' · Resident DJ</span>';

  var tableW=0;
  function colTag(key, fallback){
    var w=residentW(widths, key, fallback);
    tableW+=w;
    return '<col data-wkey="'+key+'" style="width:'+w+'px">';
  }
  var h='<table class="sched-tbl res-tbl"><colgroup>'+colTag('date', RESIDENT_DEFAULT_W.date)+colTag('guest', RESIDENT_DEFAULT_W.guest);
  cols.forEach(function(col){
    if(col.kind==='role') h+=colTag(col.id+'__name', RESIDENT_DEFAULT_W.name)+colTag(col.id+'__amt', RESIDENT_DEFAULT_W.amt);
    else h+=colTag(col.id, RESIDENT_DEFAULT_W.money);
  });
  h+=colTag('total', RESIDENT_DEFAULT_W.total)+'</colgroup><thead><tr>';
  function grip(key){ return '<span class="res-grip" data-wkey="'+key+'" title="Drag to resize"></span>'; }
  h+='<th class="sc-date" rowspan="2">Date'+grip('date')+'</th>';
  h+='<th class="res-group res-guest" rowspan="2">Guest DJ'+grip('guest')+'</th>';
  cols.forEach(function(col){
    if(col.kind==='role') h+='<th class="res-group res-tone res-split res-col-hd" colspan="2" data-col="'+col.id+'">'+residentEsc(col.label)+'</th>';
    else h+='<th class="res-group res-tone res-split res-col-hd" rowspan="2" data-col="'+col.id+'">'+residentEsc(col.label)+grip(col.id)+'</th>';
  });
  h+='<th class="res-group res-tone-total res-split" rowspan="2">Total'+grip('total')+'</th></tr><tr>';
  cols.forEach(function(col){
    if(col.kind!=='role') return;
    h+='<th class="res-sub res-tone res-split res-col-hd" data-col="'+col.id+'">Name'+grip(col.id+'__name')+'</th>'
      +'<th class="res-sub res-tone res-col-hd" data-col="'+col.id+'">$'+grip(col.id+'__amt')+'</th>';
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
    var row=residentDay(here.venue, ds);
    var guests=residentGuestNames(ds);
    h+='<tr class="'+dc+'" data-ds="'+ds+'">';
    h+='<td class="sc-date-cell">'+dateStr+(isToday?'<span class="sc-today-badge"> Today</span>':'')+'</td>';
    h+='<td class="res-guest-cell" title="'+residentEsc(guests)+'"><b>'+residentEsc(guests)+'</b></td>';
    cols.forEach(function(col){
      var b=residentBits(row, col);
      var tone=(b.paid?' res-paid':(residentHasAmt(b.amt)?' res-due':''))+(String(b.note||'').trim()?' res-has-note':'');
      var tip=residentEsc(String(b.note||'').trim());
      if(col.kind==='role'){
        h+='<td class="res-cell res-tone res-split'+tone+'" data-col="'+col.id+'" title="'+tip+'"><input class="res-name" data-col="'+col.id+'" data-part="name" value="'+residentEsc(b.name)+'" oninput="residentEdit(this)"></td>';
      }
      h+='<td class="res-cell res-pay res-tone'+(col.kind==='role'?'':' res-split')+tone+'" data-col="'+col.id+'" title="'+tip+'">'
        +'<input class="res-money" inputmode="decimal" data-col="'+col.id+'" data-part="amt" value="'+residentMoney(b.amt)+'" oninput="residentEdit(this)">'
        +'<button type="button" class="res-dot'+(b.paid?' is-paid':'')+'" data-col="'+col.id+'" title="Mark paid"></button></td>';
    });
    h+='<td class="res-cell res-tone-total res-split res-total">'+residentMoney(residentRowTotal(row, here.venue))+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  body.innerHTML=h;
  var table=body.querySelector('table');
  if(table) table.style.width=Math.max(tableW, body.clientWidth||0)+'px';
  residentIndexCells();
  residentMark();
  requestAnimationFrame(fitResidentRows);
}

/* Selection, copy, paste, and clear. */
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
function residentBox(){
  if(!_resAnchor || !_resEnd) return null;
  return {
    r1:Math.min(_resAnchor.r,_resEnd.r), r2:Math.max(_resAnchor.r,_resEnd.r),
    c1:Math.min(_resAnchor.c,_resEnd.c), c2:Math.max(_resAnchor.c,_resEnd.c)
  };
}
function residentMark(){
  var body=document.getElementById('residentBody');
  if(!body) return;
  body.querySelectorAll('td.res-picked').forEach(function(td){ td.classList.remove('res-picked'); });
  var box=residentBox();
  if(!box) return;
  var grid=residentGrid();
  for(var r=box.r1;r<=box.r2;r++){
    for(var c=box.c1;c<=box.c2;c++){
      var el=grid[r]&&grid[r][c];
      if(el && el.parentNode) el.parentNode.classList.add('res-picked');
    }
  }
}
function residentSelectedTsv(){
  var box=residentBox();
  if(!box) return '';
  var grid=residentGrid();
  var lines=[];
  for(var r=box.r1;r<=box.r2;r++){
    var cols=[];
    for(var c=box.c1;c<=box.c2;c++){
      var el=grid[r]&&grid[r][c];
      cols.push(el?el.value:'');
    }
    lines.push(cols.join('\t'));
  }
  return lines.join('\n');
}
function residentMulti(){
  var box=residentBox();
  return !!box && (box.r1!==box.r2 || box.c1!==box.c2);
}
/* One copied value fills the whole selection. A block pastes from the selection's top-left cell. */
function residentApplyPaste(text){
  var box=residentBox();
  var grid=residentGrid();
  if(!box || text==null) return;
  var lines=String(text).replace(/\r/g,'').replace(/\n$/,'').split('\n').map(function(l){ return l.split('\t'); });
  if(!lines.length) return;
  var single=lines.length===1 && lines[0].length===1;
  var r2=single?box.r2:box.r1+lines.length-1;
  for(var r=box.r1;r<=r2;r++){
    var line=single?lines[0]:lines[r-box.r1];
    var c2=single?box.c2:box.c1+line.length-1;
    for(var c=box.c1;c<=c2;c++){
      var el=grid[r]&&grid[r][c];
      if(!el) continue;
      el.value=single?line[0]:line[c-box.c1];
      residentEdit(el);
    }
  }
  if(!single){
    _resEnd={r:Math.min(r2, grid.length-1), c:box.c1+Math.max(0, lines[0].length-1)};
    residentMark();
  }
}
function residentClearSelection(){
  var box=residentBox();
  var grid=residentGrid();
  if(!box) return;
  for(var r=box.r1;r<=box.r2;r++){
    for(var c=box.c1;c<=box.c2;c++){
      var el=grid[r]&&grid[r][c];
      if(!el) continue;
      el.value='';
      residentEdit(el);
    }
  }
}
function residentCellFromEvent(e){
  var body=document.getElementById('residentBody');
  if(!body || !e || !e.target || !e.target.closest) return null;
  if(e.target.closest('.res-dot') || e.target.closest('.res-grip')) return null;
  var el=e.target.closest('input');
  if(el && body.contains(el) && (el.classList.contains('res-name') || el.classList.contains('res-money'))) return el;
  var td=e.target.closest('td');
  if(!td || !body.contains(td)) return null;
  return td.querySelector('input.res-name, input.res-money');
}
function residentOn(){
  return typeof curView!=='undefined' && curView==='resident';
}
function residentStartResize(handle, ev){
  var body=document.getElementById('residentBody');
  var key=handle.getAttribute('data-wkey');
  var colEl=body&&body.querySelector('col[data-wkey="'+key+'"]');
  var table=body&&body.querySelector('table');
  if(!colEl || !table) return;
  ev.preventDefault(); ev.stopPropagation();
  var startX=ev.clientX, startW=parseFloat(colEl.style.width)||colEl.getBoundingClientRect().width||80;
  var startTable=parseFloat(table.style.width)||table.getBoundingClientRect().width;
  handle.classList.add('dragging');
  function onMove(e){
    var w=Math.max(28, Math.min(800, startW+(e.clientX-startX)));
    colEl.style.width=w+'px';
    table.style.width=Math.max(startTable+(w-startW), body.clientWidth)+'px';
  }
  function onUp(){
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    residentSaveWidth(key, Math.round(parseFloat(colEl.style.width)||startW));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
function residentPickInit(){
  if(_resPickOn) return;
  _resPickOn=true;
  document.addEventListener('click', function(e){
    var body=document.getElementById('residentBody');
    var btn=e.target && e.target.closest ? e.target.closest('.res-dot') : null;
    if(!btn || !body || !body.contains(btn) || !residentOn()) return;
    e.preventDefault();
    residentTogglePaid(btn);
  });
  document.addEventListener('contextmenu', function(e){
    var body=document.getElementById('residentBody');
    if(!body || !residentOn() || !e.target || !e.target.closest || !body.contains(e.target)) return;
    var th=e.target.closest('th.res-col-hd');
    if(th){
      e.preventDefault();
      var id=th.getAttribute('data-col');
      var col=residentColById(id);
      if(!col) return;
      residentMenu(e.clientX, e.clientY, [
        {label:'Rename '+col.label, run:function(){ residentRenameColumn(id); }},
        {label:'Add column after', run:function(){ residentAddColumn(id); }},
        {label:'Delete column', danger:true, run:function(){ residentDeleteColumn(id); }}
      ]);
      return;
    }
    var td=e.target.closest('td[data-col]');
    if(!td) return;
    e.preventDefault();
    var tr=td.closest('tr');
    var c=residentColById(td.getAttribute('data-col'));
    var b=c?residentBits(residentDay(residentHere().venue, tr.getAttribute('data-ds')), c):{};
    var items=[{label:b.note?'Edit comment':'Leave a comment', run:function(){ residentOpenComment(td, e.clientX, e.clientY); }}];
    if(b.note){
      items.push({label:'Delete comment', danger:true, run:function(){
        residentPut(tr.getAttribute('data-ds'), residentSub(c,'note'), null);
        residentPaintCell(tr, c);
      }});
    }
    residentMenu(e.clientX, e.clientY, items);
  });
  document.addEventListener('mousedown', function(e){
    var inMenu=e.target.closest && (e.target.closest('#resMenu') || e.target.closest('#resPop'));
    if(!inMenu){
      residentCloseMenus();
      var pop=document.getElementById('resPop');
      if(pop) pop.classList.remove('on');
    }
    var body=document.getElementById('residentBody');
    if(!body || !residentOn()) return;
    var grip=e.target.closest && e.target.closest('.res-grip');
    if(grip && body.contains(grip)){ residentStartResize(grip, e); return; }
    if(e.button===2) return;
    var el=residentCellFromEvent(e);
    if(!el){
      if(e.target && body.contains(e.target)) return;
      if(inMenu) return;
      _resAnchor=null; _resEnd=null; residentMark();
      return;
    }
    var pos=residentPos(el);
    if(e.shiftKey && _resAnchor){ _resEnd=pos; e.preventDefault(); }
    else { _resAnchor=pos; _resEnd=pos; _resDrag=true; }
    if(document.activeElement!==el) el.focus();
    residentMark();
  });
  document.addEventListener('mouseover', function(e){
    if(!_resDrag) return;
    var el=residentCellFromEvent(e);
    if(!el) return;
    var pos=residentPos(el);
    if(_resEnd && pos.r===_resEnd.r && pos.c===_resEnd.c) return;
    _resEnd=pos;
    if(_resAnchor && (pos.r!==_resAnchor.r || pos.c!==_resAnchor.c)){
      try{ window.getSelection().removeAllRanges(); }catch(eSel){}
    }
    residentMark();
  });
  document.addEventListener('mouseup', function(){ _resDrag=false; });
  document.addEventListener('copy', function(e){
    if(!residentOn() || !_resAnchor || !_resEnd) return;
    var ae=document.activeElement;
    if(!residentMulti() && ae && ae.selectionStart!=null && ae.selectionStart!==ae.selectionEnd) return;
    var text=residentSelectedTsv();
    _resClip=text;
    e.preventDefault();
    if(e.clipboardData) e.clipboardData.setData('text/plain', text);
  }, true);
  document.addEventListener('cut', function(e){
    if(!residentOn() || !residentMulti()) return;
    var text=residentSelectedTsv();
    _resClip=text;
    e.preventDefault();
    if(e.clipboardData) e.clipboardData.setData('text/plain', text);
    residentClearSelection();
  }, true);
  document.addEventListener('paste', function(e){
    if(!residentOn() || !_resAnchor) return;
    var body=document.getElementById('residentBody');
    var ae=document.activeElement;
    if(!body || !(ae && body.contains(ae)) && !residentMulti()) return;
    var text='';
    try{ text=e.clipboardData ? e.clipboardData.getData('text/plain') : ''; }catch(err){}
    if(!text) text=_resClip;
    if(text==null || text==='') return;
    e.preventDefault();
    residentApplyPaste(text);
  }, true);
  document.addEventListener('keydown', function(e){
    if(!residentOn() || !_resAnchor) return;
    var body=document.getElementById('residentBody');
    var ae=document.activeElement;
    var inside=ae && body && body.contains(ae);
    if((e.key==='Delete'||e.key==='Backspace') && residentMulti() && (inside || !ae || ae===document.body)){
      e.preventDefault();
      residentClearSelection();
      return;
    }
    if(e.key==='Escape'){ residentCloseMenus(); var pop=document.getElementById('resPop'); if(pop) pop.classList.remove('on'); }
  }, true);
}
function fitResidentRows(){
  var body=document.getElementById('residentBody');
  if(!body || !residentOn()) return;
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
/* Remote changes repaint values in place; the cell someone is typing in is left alone. */
function residentPaintFromStore(){
  var body=document.getElementById('residentBody');
  if(!body || !residentOn()) return;
  var rows=body.querySelectorAll('tbody tr[data-ds]');
  if(!rows.length){ renderResidentCalendar(); return; }
  var cols=residentCols();
  rows.forEach(function(tr){
    cols.forEach(function(col){ residentPaintCell(tr, col); });
    residentPaintTotal(tr);
  });
}
function residentColsSignature(){
  return JSON.stringify(residentCols())+JSON.stringify(residentWidths());
}
function residentRefreshBudget(){
  if(typeof curView!=='undefined' && curView==='budget' && typeof renderBudgetGuestDjTable==='function'){
    try{ renderBudgetGuestDjTable(); }catch(e){}
  }
}
function initResidentDj(){
  residentPickInit();
  if(window._residentDjListening || !window._fbDb) return;
  window._residentDjListening=true;
  window._fbDb.ref('rdg/residentDj').on('value', function(snap){
    var next=snap.val()||{};
    Object.keys(_residentPending).forEach(function(path){
      var cut=path.indexOf('/');
      var key=path.slice(0, cut);
      if(!next[key] || typeof next[key]!=='object') next[key]={};
      residentSetPath(next[key], path.slice(cut+1), _residentPending[path]);
    });
    RESIDENT_DJ=next;
    residentPaintFromStore();
    residentRefreshBudget();
  });
  window._fbDb.ref('rdg/residentCols').on('value', function(snap){
    var before=residentColsSignature();
    RESIDENT_COLS=snap.val()||{};
    if(residentOn() && residentColsSignature()!==before){
      var ae=document.activeElement;
      var body=document.getElementById('residentBody');
      if(!(ae && body && body.contains(ae) && ae.tagName==='INPUT')) renderResidentCalendar();
    }
    residentRefreshBudget();
  });
}
(function residentWaitForDb(tries){
  try{ initResidentDj(); }catch(e){}
  if(!window._residentDjListening && tries<120) setTimeout(function(){ residentWaitForDb(tries+1); }, 500);
})(0);
