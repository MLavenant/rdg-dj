/* Live Entertainment Dashboard sign-in.
   Allowlisted work emails, then a 6-digit code created once per email.
   The code is stored as a PBKDF2 hash in Firebase, never as the digits. */

var RDG_SIGNIN_ALLOW = {
  'hugo@rivieradininggroup.com': 'Hugo',
  'christophe@rivieradininggroup.com': 'Christophe',
  'greg@rivieradininggroup.com': 'Greg',
  'michael@rivieradininggroup.com': 'Michael',
  'alexandra@rivieradininggroup.com': 'Alexandra',
  'matthias@rivieradininggroup.com': 'Matthias',
  'takuma@rivieradininggroup.com': 'Takuma',
  'jessica@rivieradininggroup.com': 'Jessica',
  'fabien@rivieradininggroup.com': 'Fabien'
};
var RDG_SIGNIN_OWNER = 'matthias@rivieradininggroup.com';
var RDG_ACCESS_DEFAULT = {
  'greg@rivieradininggroup.com': 'super',
  'matthias@rivieradininggroup.com': 'owner',
  'takuma@rivieradininggroup.com': 'admin',
  'michael@rivieradininggroup.com': 'admin',
  'fabien@rivieradininggroup.com': 'admin',
  'hugo@rivieradininggroup.com': 'operator',
  'christophe@rivieradininggroup.com': 'operator',
  'alexandra@rivieradininggroup.com': 'operator',
  'jessica@rivieradininggroup.com': 'operator'
};
var RDG_ACCESS_ROLES = [
  {id:'admin', label:'Admin', note:'Finance approval'},
  {id:'operator', label:'Operator', note:'Calendar and reports'},
  {id:'ao', label:'AO', note:'Calendar and reports'}
];
var ACCESS_DIR = {};
var _accessDirReady = false;
var _signInEmail = '';
var _signInSlide = 0;
var _signInTimer = null;
var _signInBusy = false;
var _signInCachedRec = null;
var _signInCachedEmail = '';

function signInNormalizeEmail(raw){
  return String(raw||'').trim().toLowerCase();
}
function signInKey(email){
  return signInNormalizeEmail(email).replace(/[^a-z0-9]/g, '_');
}
function signInCurrentEmail(){
  try{ return signInNormalizeEmail(sessionStorage.getItem('rdg_signin_email')||''); }catch(e){ return ''; }
}
function signInIsSuperOwner(){
  return signInCurrentEmail()==='greg@rivieradininggroup.com';
}
function signInIsOwner(){
  var email=signInCurrentEmail();
  return email===RDG_SIGNIN_OWNER || signInIsSuperOwner();
}
function signInCleanRole(role){
  role=String(role||'').toLowerCase();
  if(role==='admin'||role==='operator'||role==='ao') return role;
  return 'operator';
}
function signInRoleLabel(role){
  if(role==='super') return 'Super owner';
  if(role==='owner') return 'Owner';
  for(var i=0;i<RDG_ACCESS_ROLES.length;i++){
    if(RDG_ACCESS_ROLES[i].id===role) return RDG_ACCESS_ROLES[i].label;
  }
  return 'Operator';
}
function signInApplyDirectory(val){
  ACCESS_DIR={};
  Object.keys(val||{}).forEach(function(k){
    var rec=val[k];
    if(!rec||!rec.email) return;
    var email=signInNormalizeEmail(rec.email);
    if(!email||email.indexOf('@')<1||email.indexOf('.')<0) return;
    ACCESS_DIR[email]={
      email:email,
      name:String(rec.name||'').trim()||RDG_SIGNIN_ALLOW[email]||email,
      role:signInCleanRole(rec.role),
      builtin:!!RDG_SIGNIN_ALLOW[email]
    };
  });
}
function signInDirRef(){
  if(!window._fbDb) return null;
  return window._fbDb.ref('rdg/accessPeople');
}
function signInEnsureDirectory(){
  if(_accessDirReady) return Promise.resolve();
  signInDbOnline();
  var ref=signInDirRef();
  if(!ref||typeof signInOnce!=='function') return Promise.resolve();
  return signInOnce(ref).then(function(val){
    signInApplyDirectory(val||{});
    _accessDirReady=true;
  }).catch(function(){ _accessDirReady=true; });
}
function signInWatchAccess(tries){
  if(!window._fbDb){
    if((tries||0)<80) setTimeout(function(){ signInWatchAccess((tries||0)+1); }, 400);
    return;
  }
  if(window._accessWatchOn) return;
  window._accessWatchOn=true;
  window._fbDb.ref('rdg/accessPeople').on('value', function(snap){
    signInApplyDirectory(snap.val()||{});
    _accessDirReady=true;
    var typing=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#accAddForm');
    if(typing) return;
    try{
      if(typeof curView!=='undefined'&&curView==='system'&&typeof renderSystem==='function') renderSystem();
      if(typeof curView!=='undefined'&&curView==='access'&&typeof renderAccess==='function') renderAccess();
    }catch(e){}
  });
}
function signInAllowed(email){
  email=signInNormalizeEmail(email);
  return !!(RDG_SIGNIN_ALLOW[email]||ACCESS_DIR[email]);
}
function signInRole(email){
  email=signInNormalizeEmail(email);
  if(email==='greg@rivieradininggroup.com') return 'super';
  if(email===RDG_SIGNIN_OWNER) return 'owner';
  if(ACCESS_DIR[email]&&ACCESS_DIR[email].role) return ACCESS_DIR[email].role;
  return RDG_ACCESS_DEFAULT[email]||(signInAllowed(email)?'operator':'');
}
function signInName(email){
  email=signInNormalizeEmail(email);
  if(RDG_SIGNIN_ALLOW[email]) return RDG_SIGNIN_ALLOW[email];
  if(ACCESS_DIR[email]&&ACCESS_DIR[email].name) return ACCESS_DIR[email].name;
  return '';
}
function signInLockedPerson(email){
  email=signInNormalizeEmail(email);
  return email==='greg@rivieradininggroup.com'||email===RDG_SIGNIN_OWNER;
}
function signInPeople(){
  var map={};
  Object.keys(RDG_SIGNIN_ALLOW).forEach(function(email){
    map[email]={email:email, name:RDG_SIGNIN_ALLOW[email], role:signInRole(email), builtin:true, locked:signInLockedPerson(email)};
  });
  Object.keys(ACCESS_DIR).forEach(function(email){
    if(map[email]){ map[email].role=signInRole(email); return; }
    map[email]={email:email, name:ACCESS_DIR[email].name||email, role:signInRole(email), builtin:false, locked:false};
  });
  return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){
    return a.name.localeCompare(b.name);
  });
}
function signInAttr(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function signInPeopleCardHtml(){
  var owner=signInIsOwner();
  var people=signInPeople();
  var h='<div style="background:var(--card);border-radius:12px;padding:14px 16px;border-left:4px solid #0b2e40">'
    +'<div style="font-size:14px;font-weight:900">People</div>'
    +'<div style="margin-top:4px;font-size:11px;color:var(--ink3)">Add a work email and choose what they can do. Admin can approve finance. Operator and AO use the calendar and reports.</div>';
  if(owner){
    h+='<div id="accAddForm" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:12px">'
      +'<label style="display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b">Name<input id="accName" type="text" autocomplete="off" style="font:inherit;font-size:13px;font-weight:650;text-transform:none;letter-spacing:0;padding:7px 8px;border:1px solid #e4dfd8;border-radius:8px;min-width:140px"></label>'
      +'<label style="display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b">Email<input id="accEmail" type="email" autocomplete="off" placeholder="name@company.com" style="font:inherit;font-size:13px;font-weight:650;text-transform:none;letter-spacing:0;padding:7px 8px;border:1px solid #e4dfd8;border-radius:8px;min-width:220px"></label>'
      +'<label style="display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b">Access<select id="accRole" style="font:inherit;font-size:13px;font-weight:650;text-transform:none;letter-spacing:0;padding:7px 8px;border:1px solid #e4dfd8;border-radius:8px">';
    RDG_ACCESS_ROLES.forEach(function(r){ h+='<option value="'+r.id+'">'+r.label+'</option>'; });
    h+='</select></label>'
      +'<button type="button" onclick="signInAccessAdd()" style="font:inherit;font-size:13px;font-weight:800;padding:8px 14px;border:0;border-radius:8px;background:#0b2e40;color:#fff;cursor:pointer">Add</button>'
      +'</div>';
  }
  h+='<table class="fa-tbl" style="margin-top:12px"><thead><tr><th>Name</th><th>Email</th><th>Access</th>'+(owner?'<th></th>':'')+'</tr></thead><tbody>';
  people.forEach(function(p){
    h+='<tr><td>'+_escHtml(p.name)+'</td><td>'+_escHtml(p.email)+'</td><td>';
    if(owner&&!p.locked){
      h+='<select data-email="'+signInAttr(p.email)+'" onchange="signInAccessSetRole(this)" style="font:inherit;font-size:12px;font-weight:700;padding:4px 6px;border:1px solid #e4dfd8;border-radius:6px">';
      RDG_ACCESS_ROLES.forEach(function(r){
        h+='<option value="'+r.id+'"'+(p.role===r.id?' selected':'')+'>'+r.label+'</option>';
      });
      h+='</select>';
    }else{
      h+=_escHtml(signInRoleLabel(p.role));
    }
    h+='</td>';
    if(owner){
      h+='<td class="fa-acts">';
      if(!p.builtin) h+='<button type="button" class="fa-no" title="Remove" data-email="'+signInAttr(p.email)+'" onclick="signInAccessRemove(this)">×</button>';
      h+='</td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  return h;
}
function signInAccessAdd(){
  if(!signInIsOwner()) return;
  var name=String((document.getElementById('accName')||{}).value||'').trim();
  var email=signInNormalizeEmail((document.getElementById('accEmail')||{}).value);
  var role=signInCleanRole((document.getElementById('accRole')||{}).value);
  if(!name){ alert('Enter a name.'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ alert('Enter a work email.'); return; }
  if(signInAllowed(email)){ alert(email+' already has access.'); return; }
  var ref=signInDirRef();
  if(!ref){ alert('Still connecting. Try again in a moment.'); return; }
  ref.child(signInKey(email)).set({
    email:email, name:name, role:role, builtin:false, addedAt:Date.now(), addedBy:signInCurrentEmail()
  }).catch(function(){ alert('Could not add that email.'); });
}
function signInAccessSetRole(el){
  if(!signInIsOwner()||!el) return;
  var email=signInNormalizeEmail(el.getAttribute('data-email'));
  var role=signInCleanRole(el.value);
  if(!email||signInLockedPerson(email)||!signInAllowed(email)) return;
  var person=null;
  signInPeople().forEach(function(p){ if(p.email===email) person=p; });
  if(!person) return;
  var ref=signInDirRef();
  if(!ref){ alert('Still connecting. Try again in a moment.'); return; }
  ref.child(signInKey(email)).set({
    email:email, name:person.name, role:role, builtin:!!person.builtin, updatedAt:Date.now(), updatedBy:signInCurrentEmail()
  }).catch(function(){ alert('Could not save that access.'); });
}
function signInAccessRemove(el){
  if(!signInIsOwner()||!el) return;
  var email=signInNormalizeEmail(el.getAttribute('data-email'));
  if(!email||signInLockedPerson(email)||RDG_SIGNIN_ALLOW[email]) return;
  if(!confirm('Remove access for '+email+'?')) return;
  var ref=signInDirRef();
  if(!ref){ alert('Still connecting. Try again in a moment.'); return; }
  ref.child(signInKey(email)).remove().catch(function(){ alert('Could not remove that email.'); });
}
function signInRememberEmail(email){
  var v=signInNormalizeEmail(email);
  try{ sessionStorage.setItem('rdg_signin_email', v); }catch(e){}
  try{ localStorage.setItem('rdg_signin_email', v); }catch(e2){}
}
function signInSavedEmail(){
  try{
    return sessionStorage.getItem('rdg_signin_email')||localStorage.getItem('rdg_signin_email')||'';
  }catch(e){ return ''; }
}
function signInNote(msg, bad){
  var note=document.getElementById('signinNote');
  if(!note) return;
  note.textContent=msg;
  note.classList.toggle('signin-note-bad', !!bad);
}
function signInShowStep(step){
  ['email','create','code'].forEach(function(name){
    var el=document.getElementById('signinStep'+name.charAt(0).toUpperCase()+name.slice(1));
    if(el) el.hidden = name!==step;
  });
  var who=document.getElementById('signinWho');
  if(who) who.textContent=_signInEmail||'';
  if(step==='email'){
    signInNote('Use your work email. After your PIN is set, you enter that PIN to get in.', false);
  }else if(step==='create'){
    signInNote('Create a 6-digit PIN for '+(_signInEmail||'this email')+'. Next time you only enter this PIN.', false);
  }else{
    signInNote('Enter your PIN.', false);
    signInPrefetch(_signInEmail);
    signInPaintCodeBtn();
  }
}
function signInPrefetch(email){
  email=signInNormalizeEmail(email);
  if(!email) return;
  signInDbOnline();
  var ref=signInCodeRef(email);
  if(!ref) return;
  signInOnce(ref).then(function(rec){
    if(signInNormalizeEmail(_signInEmail)!==email) return;
    _signInCachedRec=rec||null;
    _signInCachedEmail=email;
  }).catch(function(){});
}
function signInPaintCodeBtn(){
  var el=document.getElementById('signinCode');
  var btn=document.getElementById('signinCodeBtn');
  if(!btn || _signInBusy) return;
  var pin=signInDigits(el&&el.value);
  var ready=pin.length===6;
  btn.classList.toggle('signin-btn-ready', ready);
  btn.textContent='Enter';
}
function signInPinTyped(){
  var el=document.getElementById('signinCode');
  if(!el) return;
  var pin=signInDigits(el.value);
  if(el.value!==pin){
    var pos=el.selectionStart||pin.length;
    el.value=pin;
    try{ el.setSelectionRange(pos, pos); }catch(e){}
  }
  signInPaintCodeBtn();
  if(pin.length===6) submitSignInCode();
}
function signInCodeReady(email){
  try{ return localStorage.getItem('rdg_signin_ready')===signInNormalizeEmail(email); }catch(e){ return false; }
}
function signInMarkReady(email){
  try{ localStorage.setItem('rdg_signin_ready', signInNormalizeEmail(email)); }catch(e){}
}
function signInDbOnline(){
  try{ if(window._fbDb && window._fbDb.goOnline) window._fbDb.goOnline(); }catch(e){}
}
function signInOnce(ref){
  return new Promise(function(resolve, reject){
    var done=false;
    var timer=setTimeout(function(){
      if(done) return;
      done=true;
      reject(new Error('timeout'));
    }, 12000);
    try{
      ref.once('value', function(snap){
        if(done) return;
        done=true;
        clearTimeout(timer);
        resolve(snap.val());
      }, function(err){
        if(done) return;
        done=true;
        clearTimeout(timer);
        reject(err||new Error('read'));
      });
    }catch(e){
      if(done) return;
      done=true;
      clearTimeout(timer);
      reject(e);
    }
  });
}
function signInStartSlides(){
  var track=document.getElementById('signinTrack');
  if(!track) return;
  if(_signInTimer) return;
  function paint(){
    var slides=track.querySelectorAll('.signin-slide');
    for(var i=0;i<slides.length;i++) slides[i].classList.toggle('on', i===_signInSlide);
  }
  paint();
  _signInTimer=setInterval(function(){
    _signInSlide=(_signInSlide+1)%3;
    paint();
  }, 5000);
}
function _signInBytes(){
  var salt=new Uint8Array(16);
  crypto.getRandomValues(salt);
  return salt;
}
function _signInB64(bytes){
  var s='';
  bytes.forEach(function(b){ s+=String.fromCharCode(b); });
  return btoa(s);
}
function _signInFromB64(s){
  var raw=atob(s);
  var out=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}
function signInHash(pin, saltB64){
  var salt=_signInFromB64(saltB64);
  return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']).then(function(key){
    return crypto.subtle.deriveBits({name:'PBKDF2', salt:salt, iterations:120000, hash:'SHA-256'}, key, 256);
  }).then(function(bits){
    return _signInB64(new Uint8Array(bits));
  });
}
function signInCodeRef(email){
  if(!window._fbDb) return null;
  return window._fbDb.ref('rdg/signInCodes/'+signInKey(email));
}
function signInLocked(){
  var until=0;
  try{ until=+sessionStorage.getItem('rdg_signin_lock_until')||0; }catch(e){}
  return until && Date.now()<until;
}
function signInFail(){
  var n=0;
  try{ n=+(sessionStorage.getItem('rdg_signin_fails')||0); }catch(e){}
  n+=1;
  try{ sessionStorage.setItem('rdg_signin_fails', String(n)); }catch(e2){}
  if(n>=5){
    try{ sessionStorage.setItem('rdg_signin_lock_until', String(Date.now()+60000)); }catch(e3){}
    signInNote('Too many tries. Wait a minute, then try again.', true);
    return true;
  }
  return false;
}
function signInClearFails(){
  try{
    sessionStorage.removeItem('rdg_signin_fails');
    sessionStorage.removeItem('rdg_signin_lock_until');
  }catch(e){}
}
function signInDigits(raw){
  return String(raw||'').replace(/\D/g,'').slice(0,6);
}
function signInFinish(email){
  var name=signInName(email)||'';
  if(!_setPresenceName(name)){
    _signInBusy=false;
    signInPaintCodeBtn();
    signInNote('This email cannot sign in.', true);
    return;
  }
  signInRememberEmail(email);
  signInMarkReady(email);
  signInClearFails();
  var btn=document.getElementById('signinCodeBtn')||document.getElementById('signinCreateBtn');
  if(btn){ btn.disabled=true; btn.classList.add('signin-btn-ready'); btn.textContent='Entering…'; }
  var opened=false;
  function openApp(){
    if(opened) return;
    opened=true;
    _signInBusy=false;
    try{
      sessionStorage.setItem('rdg_session_active','1');
      sessionStorage.setItem('rdg_session_activity', String(Date.now()));
    }catch(e){}
    _hideSessionGate();
    try{ if(window._fbDb) window._fbDb.goOnline(); }catch(eOn){}
    try{ if(typeof initResidentDj==='function') initResidentDj(); }catch(eRes){}
    _writePresence();
    refreshPresenceChip();
    if(typeof buildSidebar==='function') buildSidebar();
    if(btn){
      btn.disabled=false;
      btn.textContent=btn.id==='signinCreateBtn'?'Save PIN and enter':'Enter';
    }
  }
  /* Open as soon as the version check returns, and don't wait on a slow page fetch. */
  var cap=setTimeout(openApp, 450);
  _ensureLatestAppThen(function(){
    clearTimeout(cap);
    openApp();
  });
}
function submitSignInEmail(){
  if(signInLocked()){ signInNote('Too many tries. Wait a minute, then try again.', true); return; }
  var email=signInNormalizeEmail((document.getElementById('signinEmail')||{}).value);
  if(!email || email.indexOf('@')<1){ signInNote('Enter your work email.', true); return; }
  signInRememberEmail(email);
  var btn=document.getElementById('signinEmailBtn');
  if(btn){ btn.disabled=true; btn.textContent='Checking…'; }
  signInEnsureDirectory().then(function(){
  if(!signInAllowed(email)){
    if(btn){ btn.disabled=false; btn.textContent='Continue'; }
    signInFail();
    signInNote('This email does not have access.', true);
    return;
  }
  _signInEmail=email;
  signInDbOnline();
  var ref=signInCodeRef(email);
  if(!ref){
    if(btn){ btn.disabled=false; btn.textContent='Continue'; }
    signInNote('Still connecting. Try again in a moment.', true);
    return;
  }
  signInOnce(ref).then(function(rec){
    _signInCachedRec=rec||null;
    _signInCachedEmail=email;
    if(btn){ btn.disabled=false; btn.textContent='Continue'; }
    var has=!!(rec && rec.hash && rec.salt);
    if(has) signInMarkReady(email);
    signInShowStep(has?'code':'create');
    var focus=document.getElementById(has?'signinCode':'signinCreate');
    if(focus) focus.focus();
  }).catch(function(){
    if(btn){ btn.disabled=false; btn.textContent='Continue'; }
    signInNote('Could not check this email. Try again.', true);
  });
  });
}
function submitSignInCreate(){
  if(signInLocked()){ signInNote('Too many tries. Wait a minute, then try again.', true); return; }
  var email=_signInEmail;
  if(!signInAllowed(email)){ signInNote('This email does not have access.', true); return; }
  var pin=signInDigits((document.getElementById('signinCreate')||{}).value);
  var confirm=signInDigits((document.getElementById('signinConfirm')||{}).value);
  if(pin.length!==6){ signInNote('The PIN must be 6 digits.', true); return; }
  if(pin!==confirm){ signInNote('The two PINs do not match.', true); return; }
  signInDbOnline();
  var ref=signInCodeRef(email);
  if(!ref){ signInNote('Still connecting. Try again in a moment.', true); return; }
  var btn=document.getElementById('signinCreateBtn');
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  var salt=_signInB64(_signInBytes());
  signInHash(pin, salt).then(function(hash){
    return ref.transaction(function(cur){
      if(cur && cur.hash) return;
      return {salt:salt, hash:hash, createdAt:Date.now()};
    });
  }).then(function(res){
    if(btn){ btn.disabled=false; btn.textContent='Save PIN and enter'; }
    document.getElementById('signinCreate').value='';
    document.getElementById('signinConfirm').value='';
    if(!res.committed){
      signInMarkReady(email);
      signInNote('A PIN is already set for this email. Enter it.', true);
      signInShowStep('code');
      var again=document.getElementById('signinCode');
      if(again) again.focus();
      return;
    }
    signInFinish(email);
  }).catch(function(){
    if(btn){ btn.disabled=false; btn.textContent='Save PIN and enter'; }
    signInNote('Could not save the PIN. Try again.', true);
  });
}
function signInCodeFailed(){
  _signInBusy=false;
  var btn=document.getElementById('signinCodeBtn');
  if(btn) btn.disabled=false;
  signInPaintCodeBtn();
}
function submitSignInCode(){
  if(_signInBusy) return;
  if(signInLocked()){ signInNote('Too many tries. Wait a minute, then try again.', true); return; }
  var email=_signInEmail;
  if(!signInAllowed(email)){ signInNote('This email does not have access.', true); return; }
  var pin=signInDigits((document.getElementById('signinCode')||{}).value);
  if(pin.length!==6){ signInPaintCodeBtn(); return; }
  signInDbOnline();
  var ref=signInCodeRef(email);
  if(!ref){ signInNote('Still connecting. Try again in a moment.', true); return; }
  _signInBusy=true;
  var btn=document.getElementById('signinCodeBtn');
  if(btn){ btn.disabled=true; btn.classList.add('signin-btn-ready'); btn.textContent='Entering…'; }
  function check(rec){
    if(!rec || !rec.hash || !rec.salt){
      signInCodeFailed();
      try{ localStorage.removeItem('rdg_signin_ready'); }catch(e){}
      _signInCachedRec=null;
      signInShowStep('create');
      return;
    }
    return signInHash(pin, rec.salt).then(function(hash){
      var box=document.getElementById('signinCode');
      if(box) box.value='';
      if(hash!==rec.hash){
        signInCodeFailed();
        if(!signInFail()) signInNote('Incorrect PIN.', true);
        return;
      }
      signInFinish(email);
    });
  }
  var cached=(_signInCachedEmail===email && _signInCachedRec && _signInCachedRec.hash) ? _signInCachedRec : null;
  if(cached){
    Promise.resolve(check(cached)).catch(function(){
      signInCodeFailed();
      signInNote('Could not check the PIN. Try again.', true);
    });
    return;
  }
  signInOnce(ref).then(function(rec){
    _signInCachedRec=rec||null;
    _signInCachedEmail=email;
    return check(rec);
  }).catch(function(){
    signInCodeFailed();
    signInNote('Could not check the PIN. Try again.', true);
  });
}
function signInClearCode(email){
  if(!signInIsOwner()) return;
  email=signInNormalizeEmail(email);
  if(!signInAllowed(email)) return;
  if(!confirm('Clear the PIN for '+email+'? They will create a new one next time.')) return;
  signInDbOnline();
  var ref=signInCodeRef(email);
  if(!ref) return;
  ref.remove().then(function(){
    if(signInCodeReady(email)){ try{ localStorage.removeItem('rdg_signin_ready'); }catch(e){} }
    renderAccess();
  }).catch(function(){ alert('Could not clear that PIN.'); });
}

function rdgSignOut(){
  try{ if(typeof closeMobileNav==='function') closeMobileNav(); }catch(eNav){}
  try{
    sessionStorage.removeItem('rdg_session_active');
    sessionStorage.removeItem('rdg_session_activity');
  }catch(e){}
  try{ if(typeof _presenceRef!=='undefined' && _presenceRef) _presenceRef.remove(); }catch(e2){}
  try{ if(window._fbDb) window._fbDb.goOffline(); }catch(e3){}
  try{ if(typeof refreshPresenceChip==='function') refreshPresenceChip(); }catch(e4){}
  _showSessionGate('signout');
}
function _showSessionGate(msg){
  signInDbOnline();
  var gate=document.getElementById('sessionGate');
  var emailEl=document.getElementById('signinEmail');
  var saved=signInNormalizeEmail(signInSavedEmail());
  if(emailEl && saved) emailEl.value=saved;
  _signInEmail=saved;
  var pinReady=!!(saved && signInAllowed(saved) && signInCodeReady(saved));
  signInShowStep(pinReady?'code':'email');
  if(msg && /idle/i.test(msg)) signInNote(pinReady?'Signed out after 20 minutes idle. Enter your PIN.':'Signed out after 20 minutes idle. Enter your work email to continue.', false);
  else if(msg && /signout/i.test(msg)) signInNote(pinReady?'Signed out. Enter your PIN.':'Signed out. Enter your work email to continue.', false);
  if(gate){
    gate.classList.remove('hidden');
    document.body.classList.add('session-locked');
  }
  signInStartSlides();
  setTimeout(function(){
    try{
      var focus=document.getElementById(pinReady?'signinCode':'signinEmail');
      if(focus) focus.focus();
    }catch(e){}
  }, 40);
}
function _hideSessionGate(){
  var gate=document.getElementById('sessionGate');
  ['signinCreate','signinConfirm','signinCode'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.value='';
  });
  if(gate) gate.classList.add('hidden');
  document.body.classList.remove('session-locked');
}

function renderAccess(){
  var el=document.getElementById('accessBody');
  if(!el) return;
  if(!signInIsOwner()){
    el.innerHTML='<div class="bsl-empty">Only the owner can see who has access.</div>';
    return;
  }
  el.innerHTML='<div class="bsl-empty">Loading…</div>';
  signInEnsureDirectory().then(function(){
    var people=signInPeople();
    return Promise.all(people.map(function(p){
      var ref=signInCodeRef(p.email);
      if(!ref) return Promise.resolve({name:p.name, email:p.email, role:p.role, set:false});
      return ref.once('value').then(function(snap){
        var rec=snap.val();
        return {name:p.name, email:p.email, role:p.role, set:!!(rec&&rec.hash)};
      });
    }));
  }).then(function(rows){
    var h='<div style="font-size:12px;color:#64748b;margin-bottom:10px">Add an email or change access under Settings. This list only clears a PIN.</div>';
    h+='<table class="fa-tbl"><thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Code</th><th></th></tr></thead><tbody>';
    rows.forEach(function(r){
      h+='<tr><td>'+_escHtml(r.name)+'</td><td>'+_escHtml(r.email)+'</td><td>'+_escHtml(signInRoleLabel(r.role))+'</td><td>'+(r.set?'Set':'Not set yet')+'</td><td class="fa-acts">';
      if(r.set) h+='<button type="button" class="fa-no" title="Clear code" data-email="'+signInAttr(r.email)+'" onclick="signInClearCode(this.getAttribute(\'data-email\'))">×</button>';
      h+='</td></tr>';
    });
    h+='</tbody></table>';
    el.innerHTML=h;
  }).catch(function(){
    el.innerHTML='<div class="bsl-empty">Could not load access.</div>';
  });
}

/* fiscal.js opens the gate before this file loads. Open it again so a saved
   email lands on the PIN, not the email form. */
try{ if(typeof _sessionIsActive==='function' && !_sessionIsActive()) _showSessionGate(); }catch(eGate){}
try{ signInWatchAccess(0); }catch(eWatch){}
(function(){
  var el=document.getElementById('signinCode');
  if(!el) return;
  el.addEventListener('change', signInPinTyped);
  el.addEventListener('animationstart', function(e){
    if(e.animationName==='signInAutofill') setTimeout(signInPinTyped, 0);
  });
})();
