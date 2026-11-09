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
  'jessica@rivieradininggroup.com': 'Jessica'
};
var RDG_SIGNIN_OWNER = 'matthias@rivieradininggroup.com';
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
function signInIsOwner(){
  return signInCurrentEmail()===RDG_SIGNIN_OWNER;
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
  var name=RDG_SIGNIN_ALLOW[email]||'';
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
  if(!RDG_SIGNIN_ALLOW[email]){
    signInFail();
    signInNote('This email does not have access.', true);
    return;
  }
  _signInEmail=email;
  signInDbOnline();
  var ref=signInCodeRef(email);
  if(!ref){ signInNote('Still connecting. Try again in a moment.', true); return; }
  var btn=document.getElementById('signinEmailBtn');
  if(btn){ btn.disabled=true; btn.textContent='Checking…'; }
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
}
function submitSignInCreate(){
  if(signInLocked()){ signInNote('Too many tries. Wait a minute, then try again.', true); return; }
  var email=_signInEmail;
  if(!RDG_SIGNIN_ALLOW[email]){ signInNote('This email does not have access.', true); return; }
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
  if(!RDG_SIGNIN_ALLOW[email]){ signInNote('This email does not have access.', true); return; }
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
  if(!RDG_SIGNIN_ALLOW[email]) return;
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
  var pinReady=!!(saved && RDG_SIGNIN_ALLOW[saved] && signInCodeReady(saved));
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
  var emails=Object.keys(RDG_SIGNIN_ALLOW);
  el.innerHTML='<div class="bsl-empty">Loading…</div>';
  var reads=emails.map(function(email){
    var ref=signInCodeRef(email);
    if(!ref) return Promise.resolve({email:email, set:false});
    return ref.once('value').then(function(snap){
      var rec=snap.val();
      return {email:email, name:RDG_SIGNIN_ALLOW[email], set:!!(rec&&rec.hash)};
    });
  });
  Promise.all(reads).then(function(rows){
    var h='<table class="fa-tbl"><thead><tr><th>Name</th><th>Email</th><th>Code</th><th></th></tr></thead><tbody>';
    rows.forEach(function(r){
      h+='<tr><td>'+r.name+'</td><td>'+r.email+'</td><td>'+(r.set?'Set':'Not set yet')+'</td><td class="fa-acts">';
      if(r.set) h+='<button type="button" class="fa-no" title="Clear code" onclick="signInClearCode(\''+r.email+'\')">×</button>';
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
(function(){
  var el=document.getElementById('signinCode');
  if(!el) return;
  el.addEventListener('change', signInPinTyped);
  el.addEventListener('animationstart', function(e){
    if(e.animationName==='signInAutofill') setTimeout(signInPinTyped, 0);
  });
})();
