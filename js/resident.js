/* Resident DJ calendar. Separate from the Guest DJ schedule.
   Reads the same fiscal dates for the month strip. Never writes SCHED.
   Data: rdg/residentDj/{venue__date}. Columns and widths: rdg/residentCols/{venue}.
   Every edit writes only its own field so two people on the same night never overwrite each other. */

var RESIDENT_DJ = {};
var RESIDENT_COLS = {};
var RESIDENT_VENUES = ['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge','HONO Lounge','AVA WP','MILA 3F','CLAUDIE','AVA CG'];
/* Renamed locations keep their saved rows and columns under the original storage key. */
var RESIDENT_VENUE_KEY_ALIAS = {'AVA WP':'AVA_MM'};
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
  /* Year and month stay the fiscal period that contains today. */
  if(resYear==null || resMonth==null){
    var today=(typeof TODAY!=='undefined' && TODAY)?TODAY:((typeof miamiToday==='function')?miamiToday():'');
    var info=(today && typeof fiscalInfoForDate==='function')?fiscalInfoForDate(today):null;
    if(resYear==null) resYear=info?info.year:(parseInt(String(today).slice(0,4),10)||2026);
    if(resMonth==null) resMonth=info?info.monthIndex:((typeof curM!=='undefined')?curM:0);
  }
  if(!resVenue || RESIDENT_VENUES.indexOf(resVenue)<0){
    resVenue=(typeof curV!=='undefined' && RESIDENT_VENUES.indexOf(curV)>=0)?curV:RESIDENT_VENUES[0];
  }
  return {year:resYear, month:resMonth, venue:resVenue};
}
function residentSetVenue(v){
  if(RESIDENT_VENUES.indexOf(v)>=0) resVenue=v;
}
function residentVenueKey(venue){
  var v=String(venue||'');
  if(RESIDENT_VENUE_KEY_ALIAS.hasOwnProperty(v)) return RESIDENT_VENUE_KEY_ALIAS[v];
  return v.replace(/[^a-zA-Z0-9]+/g,'_');
}
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
function residentSummaryMoney(v){
  var n=Math.round(+v||0);
  try{ return n.toLocaleString('en-US')+'$'; }catch(e){ return String(n)+'$'; }
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
/* No per-column budget is stored yet, so Budget and Var stay blank until one exists. */
function residentFootHtml(sum, budget){
  var variance=budget!=null?Math.round(+budget-(+sum||0)):null;
  var cls=variance==null?'':(variance>=0?'res-var-good':'res-var-bad');
  function show(n){ return n==null?'\u2014':residentSummaryMoney(n); }
  return '<div class="res-foot"><span>Total</span><b>'+show(sum)+'</b><span>Budget</span><b>'+show(budget)+'</b><span>Var</span><b class="'+cls+'">'+show(variance)+'</b></div>';
}
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
  /* One location only. Casa Neos Beach Club never writes Casa Neos Lounge's columns. */
  var venue=residentHere().venue;
  var vk=residentVenueKey(venue);
  if(!RESIDENT_COLS[vk]) RESIDENT_COLS[vk]={};
  RESIDENT_COLS[vk].cols=cols;
  RESIDENT_COLS[vk].venue=venue;
  if(window._fbDb){
    try{ window._fbDb.ref('rdg/residentCols/'+vk+'/cols').set(cols); }catch(e){}
    try{ window._fbDb.ref('rdg/residentCols/'+vk+'/venue').set(venue); }catch(e2){}
  }
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
  var thread=residentCommentList(b.note);
  var note=thread.length?thread[thread.length-1].text:'';
  tr.querySelectorAll('td[data-col="'+col.id+'"]').forEach(function(td){
    td.classList.toggle('res-paid', paid);
    td.classList.toggle('res-due', due);
    td.classList.toggle('res-has-note', thread.length>0);
    td.title=thread.length>1?(thread.length+' comments · '+note):note;
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
  residentPaintPaybar();
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
  residentPaintPaybar();
}

function residentCommentList(note){
  var raw=[];
  if(note==null || note==='') return [];
  if(typeof note==='string') raw=[{id:'legacy', by:'', name:'', text:note, at:'', replyTo:''}];
  else if(Array.isArray(note)) raw=note;
  else if(typeof note==='object'){
    Object.keys(note).forEach(function(k){ if(note[k] && typeof note[k]==='object') raw.push(note[k]); });
  }
  return raw.filter(function(c){ return c && String(c.text||'').trim(); }).map(function(c){
    return {id:String(c.id||'legacy'), by:String(c.by||''), name:String(c.name||''), text:String(c.text||'').trim(), at:String(c.at||''), replyTo:String(c.replyTo||'')};
  }).sort(function(a,b){ return a.at<b.at?-1:(a.at>b.at?1:0); });
}
function residentCommentWho(){
  var email=(typeof signInCurrentEmail==='function')?signInCurrentEmail():'';
  var name=(typeof signInName==='function')?signInName(email):'';
  if(!name){ try{ name=localStorage.getItem('rdg_presence_name')||''; }catch(e){} }
  return {by:email, name:String(name||'Someone').trim()||'Someone'};
}
function residentCommentWhen(iso){
  if(!iso) return '';
  var d=new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
}
function residentCommentSave(ds, col, list){
  var clean=(list||[]).filter(function(c){ return c && String(c.text||'').trim(); }).map(function(c){
    return {id:c.id, by:c.by||'', name:c.name||'', text:String(c.text).trim(), at:c.at||'', replyTo:c.replyTo||''};
  });
  residentPut(ds, residentSub(col,'note'), clean.length?clean:null);
  var row=document.querySelector('#residentBody tr[data-ds="'+ds+'"]');
  residentPaintCell(row, col);
}
function residentThreadHtml(list){
  if(!list.length) return '<div class="res-cmt-empty">No comments yet.</div>';
  var who=residentCommentWho();
  var h='';
  function block(c, nested){
    var initial=residentEsc((c.name||'N').charAt(0).toUpperCase());
    h+='<div class="res-cmt'+(nested?' res-cmt-reply':'')+'">'
      +'<div class="res-cmt-av">'+initial+'</div>'
      +'<div class="res-cmt-body"><div class="res-cmt-meta"><b>'+residentEsc(c.name||'Note')+'</b>'
      +(c.at?'<span>'+residentEsc(residentCommentWhen(c.at))+'</span>':'')+'</div>'
      +'<div class="res-cmt-text">'+residentEsc(c.text)+'</div>'
      +'<div class="res-cmt-acts"><button type="button" data-act="reply" data-id="'+residentEsc(c.id)+'">Reply</button>'
      +((!c.by || c.by===who.by)?'<button type="button" data-act="delone" data-id="'+residentEsc(c.id)+'">Delete</button>':'')
      +'</div></div></div>';
    list.filter(function(r){ return r.replyTo===c.id; }).forEach(function(r){ block(r, true); });
  }
  list.filter(function(c){ return !c.replyTo || !list.some(function(p){ return p.id===c.replyTo; }); }).forEach(function(c){ block(c, !!c.replyTo); });
  return h;
}
/* Comment thread, opened from the right-click menu. */
function residentPaintThread(pop){
  var col=residentColById(pop.getAttribute('data-col'));
  var ds=pop.getAttribute('data-ds');
  if(!col||!ds) return;
  var b=residentBits(residentDay(residentHere().venue, ds), col);
  var list=residentCommentList(b.note);
  var replyId=pop.getAttribute('data-reply')||'';
  var reply=null;
  list.forEach(function(c){ if(c.id===replyId) reply=c; });
  if(!reply) replyId='';
  pop.querySelector('.res-pop-hd').textContent=col.label+' · '+ds;
  pop.querySelector('.res-thread').innerHTML=residentThreadHtml(list);
  var banner=pop.querySelector('.res-replying');
  banner.hidden=!reply;
  banner.textContent=reply?('Reply to '+(reply.name||'Note')):'';
  var cancel=pop.querySelector('[data-act="clear-reply"]');
  if(cancel) cancel.hidden=!reply;
  pop.setAttribute('data-reply', replyId);
}
function residentOpenComment(td, x, y){
  var tr=td&&td.closest('tr');
  var col=td&&residentColById(td.getAttribute('data-col'));
  if(!tr || !col) return;
  var pop=document.getElementById('resPop');
  if(!pop){
    pop=document.createElement('div');
    pop.id='resPop';
    pop.className='res-pop';
    pop.innerHTML='<b class="res-pop-hd"></b><div class="res-thread"></div>'
      +'<div class="res-replying" hidden></div>'
      +'<textarea rows="2" placeholder="Write a comment"></textarea>'
      +'<div class="res-pop-acts"><button type="button" data-act="post">Post</button><button type="button" data-act="clear-reply">Cancel reply</button></div>';
    document.body.appendChild(pop);
    pop.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    pop.addEventListener('click', function(e){
      var btn=e.target&&e.target.closest?e.target.closest('[data-act]'):null;
      if(!btn || !pop.contains(btn)) return;
      var act=btn.getAttribute('data-act');
      var c=residentColById(pop.getAttribute('data-col'));
      var d=pop.getAttribute('data-ds');
      if(!c||!d) return;
      var cur=residentCommentList(residentBits(residentDay(residentHere().venue, d), c).note);
      if(act==='reply'){
        pop.setAttribute('data-reply', btn.getAttribute('data-id')||'');
        residentPaintThread(pop);
        try{ pop.querySelector('textarea').focus(); }catch(eF){}
        return;
      }
      if(act==='clear-reply'){
        pop.setAttribute('data-reply','');
        residentPaintThread(pop);
        return;
      }
      if(act==='delone'){
        var id=btn.getAttribute('data-id')||'';
        var drop={};
        drop[id]=1;
        var changed=true;
        while(changed){
          changed=false;
          cur.forEach(function(item){
            if(item.replyTo && drop[item.replyTo] && !drop[item.id]){ drop[item.id]=1; changed=true; }
          });
        }
        residentCommentSave(d, c, cur.filter(function(item){ return !drop[item.id]; }));
        pop.setAttribute('data-reply','');
        residentPaintThread(pop);
        return;
      }
      if(act!=='post') return;
      var text=String(pop.querySelector('textarea').value||'').trim();
      if(!text) return;
      var who=residentCommentWho();
      var replyTo=pop.getAttribute('data-reply')||'';
      if(replyTo && !cur.some(function(item){ return item.id===replyTo; })) replyTo='';
      cur.push({id:'c_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), by:who.by, name:who.name, text:text, at:new Date().toISOString(), replyTo:replyTo});
      residentCommentSave(d, c, cur);
      pop.querySelector('textarea').value='';
      pop.setAttribute('data-reply','');
      residentPaintThread(pop);
    });
  }
  pop.setAttribute('data-ds', tr.getAttribute('data-ds'));
  pop.setAttribute('data-col', col.id);
  pop.setAttribute('data-reply','');
  pop.querySelector('textarea').value='';
  residentPaintThread(pop);
  var w=340;
  pop.style.left=Math.max(8, Math.min(window.innerWidth-w-8, x))+'px';
  pop.style.top=Math.max(8, Math.min(window.innerHeight-420, y))+'px';
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
  var venue=residentHere().venue;
  var label=prompt('New column for '+venue+' only');
  if(label==null) return;
  label=String(label).trim();
  if(!label) return;
  var withName=confirm('Add a Name field next to the $ amount?\n\nOK = Name + $\nCancel = $ only\n\nSaved for '+venue+' only. Other locations stay as they are.');
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
  if(!confirm('Delete the '+col.label+' column for '+residentHere().venue+' only?\n\nOther locations are not changed. Amounts already entered stay saved and come back if you add this column again.')) return;
  residentSaveCols(residentCols().filter(function(c){ return c.id!==id; }));
}
function residentFlashPending(){
  var body=document.getElementById('residentBody');
  if(!body) return;
  if(window._resFlashTimer) clearTimeout(window._resFlashTimer);
  Array.prototype.forEach.call(body.querySelectorAll('.res-flash'), function(el){ el.classList.remove('res-flash'); });
  var cells=body.querySelectorAll('td.res-cell.res-due');
  if(!cells.length) return;
  Array.prototype.forEach.call(cells, function(el){ el.classList.add('res-flash'); });
  var row=cells[0].closest ? cells[0].closest('tr') : cells[0].parentNode;
  if(row && row.scrollIntoView) row.scrollIntoView({block:'center', behavior:'smooth'});
  window._resFlashTimer=setTimeout(function(){
    Array.prototype.forEach.call(body.querySelectorAll('.res-flash'), function(el){ el.classList.remove('res-flash'); });
  }, 4800);
}
function residentDeleteFromList(sel){
  if(!sel) return;
  var id=sel.value||'';
  sel.value='';
  if(!id) return;
  residentDeleteColumn(id);
}
function residentPaySummary(venue, dates){
  var paidN=0, pendN=0, paidAmt=0, pendAmt=0;
  (dates||[]).forEach(function(ds){
    var row=residentDay(venue, ds);
    residentCols(venue).forEach(function(col){
      var b=residentBits(row, col);
      if(!residentHasAmt(b.amt)) return;
      if(b.paid){ paidN++; paidAmt+=+b.amt; }
      else { pendN++; pendAmt+=+b.amt; }
    });
  });
  var total=paidN+pendN;
  return {paidN:paidN, pendN:pendN, paidAmt:paidAmt, pendAmt:pendAmt, total:total, pct:total?Math.round(paidN/total*100):0};
}
function residentPaintPaybar(){
  var bar=document.querySelector('#residentFilters .res-paybar');
  if(!bar || typeof datesInFiscalPeriod!=='function') return;
  var here=residentHere();
  var pay=residentPaySummary(here.venue, datesInFiscalPeriod(here.year, here.month));
  var moved=false;
  function set(sel, big, money){
    var el=bar.querySelector(sel);
    if(!el) return;
    var b=el.querySelector('b');
    var em=el.querySelector('em');
    if(b && b.textContent!==String(big)){ b.textContent=String(big); moved=true; }
    if(em && em.textContent!==money){ em.textContent=money; moved=true; }
  }
  set('.res-sum-pend', pay.pendN, residentSummaryMoney(pay.pendAmt));
  set('.res-sum-paid', pay.paidN, residentSummaryMoney(pay.paidAmt));
  set('.res-sum-done', pay.pct+'%', pay.paidN+' of '+(pay.total||0)+' lines');
  if(!moved) return;
  bar.classList.remove('res-pay-moved');
  void bar.offsetWidth;
  bar.classList.add('res-pay-moved');
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
    fh+='<label>Delete<select onchange="residentDeleteFromList(this)"><option value="">Choose a column</option>';
    cols.forEach(function(c){ fh+='<option value="'+residentEsc(c.id)+'">'+residentEsc(c.label)+'</option>'; });
    fh+='</select></label>';
    var pay=residentPaySummary(here.venue, fiscalDates);
    fh+='<div class="res-paybar">'
      +'<div class="res-sum res-sum-pend" role="button" tabindex="0" title="Show the pending lines" onclick="residentFlashPending()"><b>'+pay.pendN+'</b><span>Pending</span><em>'+residentSummaryMoney(pay.pendAmt)+'</em></div>'
      +'<div class="res-sum res-sum-paid"><b>'+pay.paidN+'</b><span>Paid</span><em>'+residentSummaryMoney(pay.paidAmt)+'</em></div>'
      +'<div class="res-sum res-sum-done"><b>'+pay.pct+'%</b><span>Completion</span><em>'+pay.paidN+' of '+(pay.total||0)+' lines</em></div>'
      +'</div>';
    var asOf=(typeof TODAY!=='undefined'&&TODAY)?(' · as of '+TODAY):'';
    fh+='<span>'+fiscalPeriodShortRange(yr, mo)+asOf+' · grab a column header and drag it · pick a column in Delete to remove it</span>';
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
    var x='<button type="button" class="res-col-x" data-col="'+col.id+'" title="Delete '+residentEsc(col.label)+'">×</button>';
    if(col.kind==='role') h+='<th class="res-group res-tone res-split res-col-hd" colspan="2" data-col="'+col.id+'" title="Drag to reorder. Right-click to rename or delete.">'+residentEsc(col.label)+x+'</th>';
    else h+='<th class="res-group res-tone res-split res-col-hd" rowspan="2" data-col="'+col.id+'" title="Drag to reorder. Right-click to rename or delete.">'+residentEsc(col.label)+x+grip(col.id)+'</th>';
  });
  h+='<th class="res-group res-tone-total res-split" rowspan="2">Total'+grip('total')+'</th></tr><tr>';
  cols.forEach(function(col){
    if(col.kind!=='role') return;
    h+='<th class="res-sub res-tone res-split res-col-hd" data-col="'+col.id+'" title="Drag to reorder this column. Name and $ move together.">Name'+grip(col.id+'__name')+'</th>'
      +'<th class="res-sub res-tone res-col-hd" data-col="'+col.id+'" title="Drag to reorder this column. Name and $ move together.">$'+grip(col.id+'__amt')+'</th>';
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
  var mm=(mo+1<10?'0':'')+(mo+1);
  var grand=0, anyGrand=false;
  h+='</tbody><tfoot><tr class="res-foot-row"><td class="sc-date-cell">Month</td><td></td>';
  cols.forEach(function(col){
    var sum=residentMonthTotal(here.venue, yr, mm, col.id);
    if(sum){ grand+=sum; anyGrand=true; }
    var cell=residentFootHtml(sum, null);
    if(col.kind==='role') h+='<td class="res-split res-foot-cell" colspan="2">'+cell+'</td>';
    else h+='<td class="res-split res-foot-cell">'+cell+'</td>';
  });
  h+='<td class="res-split">'+residentFootHtml(anyGrand?grand:0, null)+'</td></tr></tfoot></table>';
  body.innerHTML=h;
  var table=body.querySelector('table');
  if(table) table.style.width=Math.max(tableW, body.clientWidth||0)+'px';
  residentIndexCells();
  residentMark();
  requestAnimationFrame(function(){
    fitResidentRows();
    residentPinHead();
    if(window._resScrolledToday) return;
    var todayRow=body.querySelector('tr.sc-today');
    if(!todayRow) return;
    window._resScrolledToday=true;
    todayRow.scrollIntoView({block:'center'});
  });
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
function residentHeaderOrder(){
  var body=document.getElementById('residentBody');
  if(!body) return [];
  return Array.prototype.slice.call(body.querySelectorAll('thead tr:first-child th[data-col]'));
}
function residentMoveColumn(id, targetId, place){
  if(!id||!targetId||id===targetId) return;
  var cols=residentCols().slice();
  var from=-1, to=-1, i;
  for(i=0;i<cols.length;i++){
    if(cols[i].id===id) from=i;
    if(cols[i].id===targetId) to=i;
  }
  if(from<0||to<0) return;
  var item=cols.splice(from,1)[0];
  to=-1;
  for(i=0;i<cols.length;i++){ if(cols[i].id===targetId) to=i; }
  if(to<0) return;
  if(place==='after') to+=1;
  cols.splice(to, 0, item);
  residentSaveCols(cols);
}
function residentDragNodes(){
  var g=document.getElementById('resDragGhost');
  if(!g){
    g=document.createElement('div');
    g.id='resDragGhost';
    document.body.appendChild(g);
  }
  var line=document.getElementById('resDropLine');
  if(!line){
    line=document.createElement('div');
    line.id='resDropLine';
    document.body.appendChild(line);
  }
  return {ghost:g, line:line};
}
function residentClearDragMarks(){
  document.body.classList.remove('res-reordering');
  var nodes=residentDragNodes();
  nodes.ghost.classList.remove('on');
  nodes.line.classList.remove('on');
  var body=document.getElementById('residentBody');
  if(!body) return;
  body.querySelectorAll('.res-drag-src,.res-drop-before,.res-drop-after').forEach(function(el){
    el.classList.remove('res-drag-src','res-drop-before','res-drop-after');
  });
}
function residentStartReorder(th, ev){
  if(!th||ev.button!==0) return;
  var id=th.getAttribute('data-col');
  if(!id) return;
  ev.preventDefault();
  var startX=ev.clientX, startY=ev.clientY, moved=false;
  function onMove(e){
    if(!moved && Math.abs(e.clientX-startX)<6 && Math.abs(e.clientY-startY)<6) return;
    moved=true;
    document.body.classList.add('res-reordering');
    var body=document.getElementById('residentBody');
    if(!body) return;
    body.querySelectorAll('.res-drag-src,.res-drop-before,.res-drop-after').forEach(function(el){
      el.classList.remove('res-drag-src','res-drop-before','res-drop-after');
    });
    body.querySelectorAll('[data-col="'+id+'"]').forEach(function(el){ el.classList.add('res-drag-src'); });
    var over=null, place='before';
    residentHeaderOrder().forEach(function(h){
      var r=h.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||h.getAttribute('data-col')===id) return;
      over=h;
      place=e.clientX<r.left+r.width/2?'before':'after';
      h.classList.add(place==='before'?'res-drop-before':'res-drop-after');
    });
    var nodes=residentDragNodes();
    var col=residentColById(id);
    var tilt=Math.max(-14, Math.min(14, (e.clientX-startX)/16));
    nodes.ghost.innerHTML='<b>'+residentEsc(col?col.label:'Column')+'</b><i>'+(col&&col.kind==='role'?'Name and $ move together':'Amount')+'</i>';
    nodes.ghost.style.left=e.clientX+'px';
    nodes.ghost.style.top=e.clientY+'px';
    nodes.ghost.style.transform='translate(-50%, -70%) rotate('+tilt+'deg)';
    nodes.ghost.classList.add('on');
    var table=body.querySelector('table');
    if(over && table){
      var edge=over.getBoundingClientRect();
      var box=table.getBoundingClientRect();
      nodes.line.style.left=(place==='after'?edge.right:edge.left)+'px';
      nodes.line.style.top=box.top+'px';
      nodes.line.style.height=box.height+'px';
      nodes.line.classList.add('on');
    }else{
      nodes.line.classList.remove('on');
    }
  }
  function onUp(e){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    var over=null, place='before';
    if(moved){
      residentHeaderOrder().forEach(function(h){
        var r=h.getBoundingClientRect();
        if(e.clientX<r.left||e.clientX>r.right) return;
        over=h;
        place=e.clientX<r.left+r.width/2?'before':'after';
      });
    }
    residentClearDragMarks();
    if(over) residentMoveColumn(id, over.getAttribute('data-col'), place);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
function residentPickInit(){
  if(_resPickOn) return;
  _resPickOn=true;
  document.addEventListener('click', function(e){
    var body=document.getElementById('residentBody');
    var xbtn=e.target && e.target.closest ? e.target.closest('.res-col-x') : null;
    if(xbtn && residentOn()){
      e.preventDefault();
      residentDeleteColumn(xbtn.getAttribute('data-col'));
      return;
    }
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
    var n=residentCommentList(b.note).length;
    residentMenu(e.clientX, e.clientY, [
      {label:n?'Comments ('+n+')':'Leave a comment', run:function(){ residentOpenComment(td, e.clientX, e.clientY); }}
    ]);
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
    if(e.target.closest && e.target.closest('.res-col-x')) return;
    var grip=e.target.closest && e.target.closest('.res-grip');
    if(grip && body.contains(grip)){ residentStartResize(grip, e); return; }
    var hd=e.target.closest && e.target.closest('th.res-col-hd');
    if(hd && body.contains(hd)){ residentStartReorder(hd, e); return; }
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
function residentPinHead(){
  var body=document.getElementById('residentBody');
  if(!body) return;
  var group=body.querySelector('thead tr:first-child th[colspan]');
  var h=0;
  if(group) h=group.getBoundingClientRect().height;
  if(!h){
    var head=body.querySelector('thead');
    var sub=body.querySelector('thead tr:nth-child(2) th');
    if(head && sub) h=head.getBoundingClientRect().height-sub.getBoundingClientRect().height;
  }
  if(h>0) body.style.setProperty('--res-head-1', (Math.round(h*10)/10)+'px');
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
  var foot=body.querySelector('tfoot');
  var footH=foot?Math.max(foot.offsetHeight, 58):0;
  var rowH=Math.max(13, Math.floor(((available-headH-footH-2)/rows)*10)/10);
  var font=Math.max(8, Math.min(12, rowH*0.62));
  body.style.setProperty('--res-row-h', rowH+'px');
  body.style.setProperty('--res-font', font+'px');
  residentPinHead();
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
  residentPaintPaybar();
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
