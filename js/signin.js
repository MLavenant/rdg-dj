/* Live Entertainment Dashboard sign-in.
   Allowlisted work emails, then a 6-digit code created once per email.
   The code is stored as a PBKDF2 hash in Firebase, never as the digits. */

var RDG_SIGNIN_ALLOW = {
  'hugo@rivieradininggroup.com': 'Hugo',
  'christophe@rivieradininggroup.com': 'Christophe',
  'greg@rivieradininggroup.com': 'Greg',
  'michael@rivieradininggroup.com': 'Michael',
  'alexandra@rivieradininggroup.com': 'Alexandra',
  'matthias@rivieradininggroup.com': 'Matthias'
};
var RDG_SIGNIN_OWNER = 'matthias@rivieradininggroup.com';
var _signInEmail = '';
var _signInSlide = 0;
var _signInTimer = null;

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
  if(step==='email'){
    signInNote('Use your work email. If you have already created a sign-in code, you will enter it next.', false);
  }else if(step==='create'){
    signInNote('Create a 6-digit code for this email. You will enter it each time you sign in. It cannot be changed from this page.', false);
  }else{
    signInNote('Enter the 6-digit code for '+_signInEmail+'.', false);
  }
}
function signInStartSlides(){
  var track=document.getElementById('signinTrack');
  if(!track) return;
  if(_signInTimer) return;
  function paint(){
    track.style.transform='translateX('+(-_signInSlide*33.3333)+'%)';
  }
  paint();
  _signInTimer=setInterval(function(){
    _signInSlide=(_signInSlide+1)%3;
    paint();
  }, 10000);
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
    signInNote('This email cannot sign in.', true);
    return;
  }
  signInRememberEmail(email);
  signInClearFails();
  var btn=document.getElementById('signinCodeBtn')||document.getElementById('signinCreateBtn');
  if(btn){ btn.disabled=true; btn.textContent='Checking…'; }
  _ensureLatestAppThen(function(){
    try{
      sessionStorage.setItem('rdg_session_active','1');
      sessionStorage.setItem('rdg_session_activity', String(Date.now()));
    }catch(e){}
    _hideSessionGate();
    try{ if(window._fbDb) window._fbDb.goOnline(); }catch(eOn){}
    _writePresence();
    refreshPresenceChip();
    if(typeof buildSidebar==='function') buildSidebar();
    if(btn){ btn.disabled=false; btn.textContent=btn.id==='signinCreateBtn'?'Save code and enter':'Enter'; }
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
  var ref=signInCodeRef(email);
  if(!ref){ signInNote('Still connecting. Try again in a moment.', true); return; }
  var btn=document.getElementById('signinEmailBtn');
  if(btn){ btn.disabled=true; btn.textContent='Checking…'; }
  ref.once('value').then(function(snap){
    if(btn){ btn.disabled=false; btn.textContent='Continue'; }
    var rec=snap.val();
    if(rec && rec.hash && rec.salt) signInShowStep('code');
    else signInShowStep('create');
    var focus=document.getElementById(rec&&rec.hash?'signinCode':'signinCreate');
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
  if(pin.length!==6){ signInNote('The code must be 6 digits.', true); return; }
  if(pin!==confirm){ signInNote('The two codes do not match.', true); return; }
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
    if(btn){ btn.disabled=false; btn.textContent='Save code and enter'; }
    document.getElementById('signinCreate').value='';
    document.getElementById('signinConfirm').value='';
    if(!res.committed){
      signInNote('A code is already set for this email. Enter it instead.', true);
      signInShowStep('code');
      return;
    }
    signInFinish(email);
  }).catch(function(){
    if(btn){ btn.disabled=false; btn.textContent='Save code and enter'; }
    signInNote('Could not save the code. Try again.', true);
  });
}
function submitSignInCode(){
  if(signInLocked()){ signInNote('Too many tries. Wait a minute, then try again.', true); return; }
  var email=_signInEmail;
  if(!RDG_SIGNIN_ALLOW[email]){ signInNote('This email does not have access.', true); return; }
  var pin=signInDigits((document.getElementById('signinCode')||{}).value);
  if(pin.length!==6){ signInNote('Enter the 6-digit code.', true); return; }
  var ref=signInCodeRef(email);
  if(!ref){ signInNote('Still connecting. Try again in a moment.', true); return; }
  var btn=document.getElementById('signinCodeBtn');
  if(btn){ btn.disabled=true; btn.textContent='Checking…'; }
  ref.once('value').then(function(snap){
    var rec=snap.val();
    if(!rec || !rec.hash || !rec.salt){
      if(btn){ btn.disabled=false; btn.textContent='Enter'; }
      signInShowStep('create');
      return signInHash('000000', _signInB64(_signInBytes()));
    }
    return signInHash(pin, rec.salt).then(function(hash){
      if(btn){ btn.disabled=false; btn.textContent='Enter'; }
      document.getElementById('signinCode').value='';
      if(hash!==rec.hash){
        if(!signInFail()) signInNote('Incorrect sign-in code.', true);
        return;
      }
      signInFinish(email);
    });
  }).catch(function(){
    if(btn){ btn.disabled=false; btn.textContent='Enter'; }
    signInNote('Could not check the code. Try again.', true);
  });
}
function signInClearCode(email){
  if(!signInIsOwner()) return;
  email=signInNormalizeEmail(email);
  if(!RDG_SIGNIN_ALLOW[email]) return;
  if(!confirm('Clear the sign-in code for '+email+'? They will create a new one next time.')) return;
  var ref=signInCodeRef(email);
  if(!ref) return;
  ref.remove().then(function(){ renderAccess(); }).catch(function(){ alert('Could not clear that code.'); });
}

function _showSessionGate(msg){
  var gate=document.getElementById('sessionGate');
  var emailEl=document.getElementById('signinEmail');
  var saved=signInSavedEmail();
  if(emailEl && saved && !emailEl.value) emailEl.value=saved;
  signInShowStep('email');
  if(msg && /idle/i.test(msg)) signInNote('Signed out after 20 minutes idle. Enter your work email to continue.', false);
  if(gate){
    gate.classList.remove('hidden');
    document.body.classList.add('session-locked');
  }
  signInStartSlides();
  setTimeout(function(){ try{ if(emailEl) emailEl.focus(); }catch(e){} }, 40);
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
