/* Inbox: @mentions in notes and comments.
   Type @christophe (first name, full name without spaces, or the part before the @ of the email)
   in a show note, VIP comment, accounting note or Resident DJ comment. The tagged person gets a
   message in their Inbox with a red count until they open it. Messages stay as history.
   Stored in Firebase at rdg/inbox/<email key>/<id>. */

var _inboxItems=[];
var _inboxEmail='';
var _inboxRef=null;
var _inboxLoaded=false;

function inboxKeyFor(email){
  return (typeof signInKey==='function')?signInKey(email):String(email||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
}
function inboxMyEmail(){
  return (typeof signInCurrentEmail==='function')?signInCurrentEmail():'';
}
function inboxAlnum(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

/* @christophe -> christophe@rivieradininggroup.com (or '' when nobody matches). */
function inboxResolve(token){
  token=String(token||'').toLowerCase().replace(/[._-]+$/,'');
  if(!token) return '';
  var people=(typeof signInPeople==='function')?signInPeople():[];
  var flat=inboxAlnum(token), i, p, local, full, first;
  for(i=0;i<people.length;i++){
    p=people[i]; local=String(p.email||'').split('@')[0].toLowerCase();
    if(token===local) return p.email;
  }
  for(i=0;i<people.length;i++){
    p=people[i]; full=inboxAlnum(p.name);
    if(flat && flat===full) return p.email;
  }
  var hits=[];
  for(i=0;i<people.length;i++){
    p=people[i]; first=inboxAlnum(String(p.name||'').split(/\s+/)[0]);
    if(flat && flat===first) hits.push(p.email);
  }
  return hits.length===1?hits[0]:'';
}
function inboxMentionedEmails(text){
  var out=[], seen={}, re=/@([A-Za-z][A-Za-z0-9._-]*)/g, m;
  text=String(text||'');
  while((m=re.exec(text))){
    var email=inboxResolve(m[1]);
    if(email && !seen[email]){ seen[email]=1; out.push(email); }
  }
  return out;
}
function inboxAuthorName(){
  var email=inboxMyEmail();
  var name=(typeof signInName==='function')?signInName(email):'';
  if(!name){ try{ name=localStorage.getItem('rdg_presence_name')||''; }catch(e){} }
  return String(name||email||'Someone').trim()||'Someone';
}

/* Call after a note or comment is saved. Only people newly tagged since the previous text get a message. */
function inboxNotify(prevText, nextText, ctx){
  try{
    if(!window._fbDb || !nextText) return;
    var me=inboxMyEmail();
    var before={};
    inboxMentionedEmails(prevText).forEach(function(e){ before[e]=1; });
    var text=String(nextText).trim();
    inboxMentionedEmails(text).forEach(function(email){
      if(before[email] || email===me) return;
      var rec={
        fromName:inboxAuthorName(), fromEmail:me||'', at:new Date().toISOString(),
        kind:(ctx&&ctx.kind)||'Note', view:(ctx&&ctx.view)||'calendar',
        venue:(ctx&&ctx.venue)||'', date:(ctx&&ctx.date)||'', dj:(ctx&&ctx.dj)||'',
        text:text.slice(0,700), read:false
      };
      window._fbDb.ref('rdg/inbox/'+inboxKeyFor(email)).push(rec);
    });
  }catch(e){}
}

function inboxUnreadCount(){
  var n=0; _inboxItems.forEach(function(m){ if(!m.read) n++; }); return n;
}
function inboxBadgeHtml(){
  var n=inboxUnreadCount();
  return '<span class="sb-badge sb-badge-inbox"'+(n?'':' style="display:none"')+'>'+(n>99?'99+':n)+'</span>';
}
function inboxPaintBadge(){
  var n=inboxUnreadCount();
  document.querySelectorAll('.sb-badge-inbox').forEach(function(el){
    el.textContent=n>99?'99+':String(n);
    el.style.display=n?'':'none';
  });
}

function inboxStart(){
  var email=inboxMyEmail();
  if(!email || !window._fbDb) return;
  if(_inboxRef && _inboxEmail===email) return;
  if(_inboxRef){ try{ _inboxRef.off(); }catch(e){} }
  _inboxEmail=email; _inboxItems=[]; _inboxLoaded=false;
  _inboxRef=window._fbDb.ref('rdg/inbox/'+inboxKeyFor(email));
  _inboxRef.limitToLast(500).on('value', function(snap){
    var val=snap.val()||{}, list=[];
    Object.keys(val).forEach(function(id){
      var m=val[id];
      if(m && typeof m==='object') list.push(Object.assign({id:id}, m, {read:!!m.read}));
    });
    list.sort(function(a,b){ return a.at<b.at?1:(a.at>b.at?-1:0); });
    _inboxItems=list; _inboxLoaded=true;
    inboxPaintBadge();
    if(typeof curView!=='undefined' && curView==='inbox') renderInbox();
  });
}
setInterval(inboxStart, 1500);

function inboxSetRead(id, read){
  if(!_inboxRef) return;
  _inboxItems.forEach(function(m){ if(m.id===id) m.read=!!read; });
  try{
    _inboxRef.child(id).update({read:!!read, readAt:read?new Date().toISOString():null});
  }catch(e){}
  inboxPaintBadge();
}
function inboxMarkAllRead(){
  _inboxItems.forEach(function(m){ if(!m.read) inboxSetRead(m.id, true); });
  renderInbox();
}

function inboxWhen(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function inboxDateLabel(ds){
  if(!ds) return '';
  try{
    var d=new Date(String(ds).slice(0,10)+'T12:00:00');
    return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  }catch(e){ return ds; }
}
/* Wrap real @tags in a filled, underlined chip. Input is already HTML-escaped. */
function inboxTagify(escHtml){
  return String(escHtml==null?'':escHtml).replace(/@([A-Za-z][A-Za-z0-9._-]*)/g, function(all, tok){
    return inboxResolve(tok)?'<span class="ib-tag">'+all+'</span>':all;
  });
}
function inboxTextHtml(text){
  return inboxTagify(_escHtml(text));
}
function inboxItemHtml(m){
  var where=[m.venue, inboxDateLabel(m.date), m.dj].filter(Boolean).map(_escHtml).join(' &middot; ');
  return '<div class="ib-item'+(m.read?'':' ib-unread')+'" data-id="'+_escHtml(m.id)+'">'
    +'<span class="ib-dot"></span>'
    +'<div class="ib-main">'
      +'<div class="ib-line"><b>'+_escHtml(m.fromName||'Someone')+'</b> tagged you under <b>'+_escHtml(m.kind||'a note')+'</b>'
      +(where?' <span class="ib-where">'+where+'</span>':'')+'</div>'
      +'<div class="ib-says">and says:</div>'
      +'<div class="ib-quote">'+inboxTextHtml(m.text||'')+'</div>'
      +'<div class="ib-when">'+_escHtml(inboxWhen(m.at))+(m.read&&m.readAt?' &middot; read '+_escHtml(inboxWhen(m.readAt)):'')+'</div>'
    +'</div>'
    +'<div class="ib-acts">'
      +'<button type="button" class="ib-open" data-act="open">Open</button>'
      +'<button type="button" class="ib-toggle" data-act="toggle">'+(m.read?'Mark unread':'Mark read')+'</button>'
    +'</div>'
  +'</div>';
}
function renderInbox(){
  var el=document.getElementById('inboxBody');
  if(!el) return;
  var n=inboxUnreadCount();
  var sub=document.getElementById('pgSub');
  if(sub) sub.innerHTML='<span>Inbox</span>';
  var h='<div class="ib-head"><div><b>'+(n?n+' unread':'All read')+'</b> <span class="ib-hint">'+_inboxItems.length+' message'+(_inboxItems.length===1?'':'s')+' kept</span></div>'
    +(n?'<button type="button" class="ib-markall" data-act="markall">Mark all as read</button>':'')+'</div>';
  if(!inboxMyEmail()){
    h+='<div class="bsl-empty">Sign in to see your messages.</div>';
  } else if(!_inboxLoaded){
    h+='<div class="bsl-empty">Loading…</div>';
  } else if(!_inboxItems.length){
    h+='<div class="bsl-empty">No messages yet. When someone writes @'+_escHtml((inboxAuthorName()||'you').split(/\s+/)[0].toLowerCase())+' in a note or comment, it shows up here.</div>';
  } else {
    h+='<div class="ib-list">'+_inboxItems.map(inboxItemHtml).join('')+'</div>';
  }
  el.innerHTML=h;
  if(!el._ibBound){
    el._ibBound=true;
    el.addEventListener('click', function(e){
      var btn=e.target.closest?e.target.closest('[data-act]'):null;
      var item=e.target.closest?e.target.closest('.ib-item'):null;
      if(btn && btn.getAttribute('data-act')==='markall'){ inboxMarkAllRead(); return; }
      if(!item) return;
      var id=item.getAttribute('data-id');
      var act=btn?btn.getAttribute('data-act'):'open';
      if(act==='toggle'){
        var cur=_inboxItems.filter(function(m){ return m.id===id; })[0];
        inboxSetRead(id, !(cur&&cur.read));
        renderInbox();
        return;
      }
      inboxOpen(id);
    });
  }
}

/* Opening a message marks it read, then jumps to where it was written. */
function inboxOpen(id){
  var m=_inboxItems.filter(function(x){ return x.id===id; })[0];
  if(!m) return;
  inboxSetRead(id, true);
  try{
    if(m.venue) curV=m.venue;
    if(m.date && typeof fiscalInfoForDate==='function'){
      var fi=fiscalInfoForDate(m.date);
      curYr=fi.year; curM=fi.monthIndex;
    }
    if(typeof buildVenTabs==='function') buildVenTabs();
    if(typeof buildYrPills==='function') buildYrPills();
    if(typeof updateTopbarLogo==='function') updateTopbarLogo(curV);
    setView(m.view||'calendar');
  }catch(e){ renderInbox(); }
}


/* ---- @ suggestions: type @ in any note or comment box to pick a person ---- */
/* The tag is the first name (@greg). If two people share a first name, or the first name is a single letter, it falls back to the email name. */
function inboxHandle(p){
  var people=(typeof signInPeople==='function')?signInPeople():[];
  var first=inboxAlnum(String(p.name||'').split(/\s+/)[0]);
  var same=people.filter(function(x){ return inboxAlnum(String(x.name||'').split(/\s+/)[0])===first; }).length;
  if(first.length>=2 && same===1) return first;
  return String(p.email||'').split('@')[0].toLowerCase();
}
var _mnPop=null, _mnTarget=null, _mnList=[], _mnIdx=0, _mnStart=-1;
function mnHide(){
  if(_mnPop) _mnPop.style.display='none';
  _mnTarget=null; _mnList=[]; _mnStart=-1;
}
function mnMatches(q){
  q=String(q||'').toLowerCase();
  var me=inboxMyEmail();
  var people=(typeof signInPeople==='function')?signInPeople():[];
  return people.filter(function(p){
    if(p.email===me) return false;
    if(!q) return true;
    var name=String(p.name||'').toLowerCase();
    var local=String(p.email||'').split('@')[0].toLowerCase();
    if(local.indexOf(q)===0 || inboxAlnum(name).indexOf(inboxAlnum(q))===0) return true;
    return name.split(/\s+/).some(function(w){ return w.replace(/[^a-z0-9]/g,'').indexOf(inboxAlnum(q))===0 && inboxAlnum(q); });
  }).slice(0,8);
}
function mnPaint(){
  if(!_mnPop){
    _mnPop=document.createElement('div');
    _mnPop.id='mentionPop';
    _mnPop.className='mn-pop';
    /* Keep the click inside the popup: it must not reach "click outside closes" handlers (comment boxes, menus). */
    _mnPop.addEventListener('mousedown', function(e){
      e.preventDefault();
      e.stopPropagation();
      var it=e.target.closest?e.target.closest('.mn-item'):null;
      if(it) mnPick(+it.getAttribute('data-i'));
    });
    _mnPop.addEventListener('click', function(e){ e.stopPropagation(); });
    _mnPop.addEventListener('mouseup', function(e){ e.stopPropagation(); });
    document.body.appendChild(_mnPop);
  }
  _mnPop.innerHTML=_mnList.map(function(p,i){
    return '<div class="mn-item'+(i===_mnIdx?' on':'')+'" data-i="'+i+'"><b>'+_escHtml(p.name)+'</b>'
      +'<span>@'+_escHtml(inboxHandle(p))+'</span></div>';
  }).join('');
  var r=_mnTarget.getBoundingClientRect();
  var w=Math.max(200, Math.min(300, r.width));
  _mnPop.style.display='block';
  _mnPop.style.width=w+'px';
  var h=_mnPop.offsetHeight;
  var top=r.bottom+4;
  if(top+h>window.innerHeight-8) top=Math.max(8, r.top-h-4);
  _mnPop.style.left=Math.max(8, Math.min(window.innerWidth-w-8, r.left))+'px';
  _mnPop.style.top=top+'px';
}
function mnPick(i){
  var ta=_mnTarget, p=_mnList[i];
  if(!ta || !p) return;
  var caret=ta.selectionStart;
  var before=ta.value.slice(0,_mnStart), after=ta.value.slice(caret);
  var tag='@'+inboxHandle(p)+' ';
  ta.value=before+tag+after;
  var pos=(before+tag).length;
  ta.setSelectionRange(pos,pos);
  mnHide();
  ta.dispatchEvent(new Event('input',{bubbles:true}));
  ta.focus();
}
document.addEventListener('input', function(e){
  var ta=e.target;
  if(!ta || ta.tagName!=='TEXTAREA') return;
  var caret=ta.selectionStart;
  var m=/(^|[\s(])@([A-Za-z0-9._-]*)$/.exec(ta.value.slice(0,caret));
  if(!m){ if(_mnTarget===ta) mnHide(); return; }
  var list=mnMatches(m[2]);
  if(!list.length){ mnHide(); return; }
  _mnTarget=ta; _mnList=list; _mnIdx=0; _mnStart=caret-m[2].length-1;
  mnPaint();
}, true);
document.addEventListener('keydown', function(e){
  if(!_mnTarget || e.target!==_mnTarget || !_mnPop || _mnPop.style.display==='none') return;
  if(e.key==='ArrowDown'){ _mnIdx=(_mnIdx+1)%_mnList.length; mnPaint(); }
  else if(e.key==='ArrowUp'){ _mnIdx=(_mnIdx-1+_mnList.length)%_mnList.length; mnPaint(); }
  else if(e.key==='Enter' || e.key==='Tab'){ mnPick(_mnIdx); }
  else if(e.key==='Escape'){ mnHide(); }
  else return;
  e.preventDefault(); e.stopPropagation();
}, true);
document.addEventListener('focusout', function(e){ if(e.target===_mnTarget) setTimeout(mnHide, 120); }, true);
window.addEventListener('scroll', function(){ if(_mnTarget) mnHide(); }, true);