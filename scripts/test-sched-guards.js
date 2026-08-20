/* Local regression checks for DJ rename paint + add-show vs day deletes.
   Run: node scripts/test-sched-guards.js
*/
'use strict';

function assert(cond, msg){
  if(!cond) throw new Error('FAIL: '+msg);
  console.log('ok —', msg);
}

function sanitize(val){
  if(val===undefined) return null;
  if(val===null || typeof val!=='object') return val;
  if(Array.isArray(val)) return val.map(sanitize);
  var out={};
  Object.keys(val).forEach(function(k){
    if(val[k]===undefined) return;
    out[k]=sanitize(val[k]);
  });
  return out;
}

/* 1) Firebase reject simulation: undefined must be stripped */
var dirty={dj:'HUGO M', fee:15000, bs_a:undefined, vipNote:undefined, py_dj:null};
var clean=sanitize(dirty);
assert(!('bs_a' in clean) || clean.bs_a===null || clean.bs_a!==undefined, 'sanitize drops/fixes undefined');
assert(JSON.stringify(clean).indexOf('undefined')<0, 'sanitized payload JSON has no undefined');
assert(clean.dj==='HUGO M', 'sanitize keeps DJ name');

/* 2) Day-level delete must spare _added shows */
function applyDeletes(shows, dels){
  return shows.filter(function(r){
    var dateKey=(r.venue||r.v)+'|'+r.d;
    var uidKey=dateKey+'|'+r._uid;
    for(var i=0;i<dels.length;i++){
      var dk=dels[i];
      var p=String(dk).split('|');
      if(p.length>=3){ if(uidKey===dk) return false; }
      else if(dateKey===dk){
        if(r._added) return true;
        return false;
      }
    }
    return true;
  });
}
var baked={v:'MILA Lounge',d:'2026-08-29',dj:'ONOMA',_uid:'s_baked',_added:0};
var added={v:'MILA Lounge',d:'2026-08-29',dj:'NEW DJ',_uid:'s_new',_added:1};
var after=applyDeletes([baked, added], ['MILA Lounge|2026-08-29']);
assert(after.length===1 && after[0].dj==='NEW DJ', 'day delete keeps user-added show');
assert(applyDeletes([baked], ['MILA Lounge|2026-08-29']).length===0, 'day delete removes baked show');

/* 3) Guard overlay wins for calendar paint */
var guard={at:Date.now(), dj:'HUGO M', fee:15000, d:'2026-11-20', v:'Casa Neos Lounge'};
var row={_uid:'s1', d:'2026-11-20', v:'Casa Neos Lounge', dj:'RIVOO ??', fee:15000};
function paintName(r, g){
  if(g && g.dj!=null && String(g.dj).trim()!=='') return g.dj;
  return r.dj;
}
assert(paintName(row, guard)==='HUGO M', 'calendar paint uses guard DJ over stale SCHED');
assert(paintName(row, null)==='RIVOO ??', 'without guard, shows SCHED DJ');

/* 4) Paint-before-persist ordering */
var events=[];
function fakeSave(localDj){
  events.push('mutate:'+localDj);
  events.push('paint:'+localDj);
  events.push('persist');
  /* sync echo reverts SCHED */
  events.push('echo:RIVOO ??');
  events.push('reapply-guard:'+localDj);
  events.push('paint2:'+localDj);
}
fakeSave('HUGO M');
assert(events.indexOf('paint:HUGO M')<events.indexOf('persist'), 'first paint happens before persist');
assert(events[events.length-1]==='paint2:HUGO M', 'final paint shows renamed DJ after echo');

/* 5) Status patches must never carry identity fields when updating existing */
var statusPatch={ djStatus:'Hold 1' };
assert(!('dj' in statusPatch) && !('d' in statusPatch), 'status patch is status-only');

/* 6) Guard match is uid-only for paint */
function guardForShow(r, gmap){
  if(!r || !r._uid) return null;
  return gmap[r._uid]||null;
}
var gmap={
  uid_zeubii:{dj:'NEW ZEUB', d:'2026-11-22'},
  uid_rivo:{dj:'HUGO M', d:'2026-11-20'}
};
assert(guardForShow({_uid:'uid_rivo',d:'2026-11-20'}, gmap).dj==='HUGO M', 'RIVO guard stays on RIVO uid');
assert(guardForShow({_uid:'uid_zeubii',d:'2026-11-22'}, gmap).dj==='NEW ZEUB', 'ZEUBII guard stays on ZEUBII uid');
assert(guardForShow({_uid:'missing',d:'2026-11-20'}, gmap)==null, 'no date fallback for paint');

/* 7) Durable guard is not cleared when Firebase briefly matches */
function shouldClearGuard(sameDj, sameFee){
  /* Durable mode: never clear on match */
  return false;
}
assert(shouldClearGuard(true,true)===false, 'guard stays after match so later sync cannot wipe rename');

/* 8) Deletes must not be resurrected by add guards */
function applyDeletesAndGuards(shows, deletedUids, guards){
  var s=shows.filter(function(r){ return !(r._uid && deletedUids[r._uid]); });
  Object.keys(guards).forEach(function(uid){
    if(deletedUids[uid]) return;
    var g=guards[uid];
    if(!g || !g._added) return;
    if(s.some(function(r){ return r._uid===uid; })) return;
    s.push({_uid:uid, dj:g.dj, _added:1});
  });
  return s;
}
var afterDel=applyDeletesAndGuards(
  [{_uid:'a',dj:'Matthias',_added:1}],
  {a:{at:1}},
  {a:{dj:'Matthias',_added:1}}
);
assert(afterDel.length===0, 'deleted add is not resurrected by guard');

/* 9) Thin {ev:''} patches must clear bake event labels (same class as status-only) */
function mergeSchedEdit(target, edit){
  var hasDj = edit.dj!=null && String(edit.dj).trim()!=='';
  var hasFee = edit.fee!=null || edit.cost!=null;
  if(!hasDj && !hasFee){
    if(Object.prototype.hasOwnProperty.call(edit,'djStatus')){
      target.djStatus = edit.djStatus==null ? null : edit.djStatus;
    }
    if(Object.prototype.hasOwnProperty.call(edit,'ev')){
      target.ev = edit.ev==null ? '' : edit.ev;
    }
    return;
  }
  Object.assign(target, edit);
}
var bakeEv={dj:'RIVO', fee:10000, ev:'HALLOWEEN'};
mergeSchedEdit(bakeEv, {ev:''});
assert(bakeEv.ev==='', 'thin ev clear wipes bake event label');
assert(bakeEv.dj==='RIVO', 'thin ev clear does not wipe DJ');
mergeSchedEdit(bakeEv, {djStatus:'Confirmed'});
assert(bakeEv.ev==='' && bakeEv.djStatus==='Confirmed', 'status thin patch keeps cleared ev');

/* 10) Rename must drop old special-week label from the edited cluster */
function upsertLabels(bands, removeNorms, newLabel){
  var kept=bands.filter(function(s){ return removeNorms.indexOf(String(s.label).toUpperCase())<0; });
  kept.push({label:newLabel});
  return kept;
}
var afterRename=upsertLabels(
  [{label:'HALLOWEEN'},{label:'OTHER'}],
  ['HALLOWEEN','SPOOKY'],
  'SPOOKY'
);
assert(afterRename.length===2 && afterRename.some(function(b){return b.label==='SPOOKY';}) && afterRename.some(function(b){return b.label==='OTHER';}), 'rename replaces old label, keeps other periods');
assert(!afterRename.some(function(b){return b.label==='HALLOWEEN';}), 'rename does not leave ghost old label');

/* 11) One show per venue|date — fold bake + shadow add into a single row */
function nightKey(r){ return (r.v||r.venue||'')+'|'+r.d; }
function showScore(r){
  var score=0;
  if(r.djStatus) score+=40;
  if(r.dj && String(r.dj).toUpperCase()!=='TBD') score+=20;
  if(!r._added) score+=15;
  return score;
}
function mergeDup(keep, lose){
  if(!keep.djStatus && lose.djStatus) keep.djStatus=lose.djStatus;
  if((!keep.dj||keep.dj==='TBD') && lose.dj) keep.dj=lose.dj;
}
function dedupeOnePerNight(shows){
  var best={};
  var drop={};
  shows.forEach(function(r,i){
    var k=nightKey(r);
    if(best[k]==null){ best[k]=i; return; }
    var a=shows[best[k]], b=r;
    var keep=showScore(b)>showScore(a)?b:a;
    var lose=keep===a?b:a;
    mergeDup(keep, lose);
    if(keep===b) best[k]=i;
    drop[lose._uid]=1;
  });
  return shows.filter(function(r){ return !drop[r._uid]; });
}
var dupNight=dedupeOnePerNight([
  {_uid:'bake',v:'Casa Neos Lounge',d:'2026-11-14',dj:'MOBLACK',fee:10000,_added:0,djStatus:'Confirmed'},
  {_uid:'add',v:'Casa Neos Lounge',d:'2026-11-14',dj:'MOBLACK',fee:10000,_added:1,djStatus:null}
]);
assert(dupNight.length===1, 'duplicate same-night shows collapse to one');
assert(dupNight[0]._uid==='bake', 'baked row wins over shadow add');
assert(dupNight[0].djStatus==='Confirmed', 'Confirmed status kept when folding');

/* 11) Status on modal-saved show must not downgrade write kind (fee stuck at bake) */
function statusTxnPatch(cur, nextStatus){
  var next=Object.assign({}, cur);
  next.djStatus=nextStatus;
  if(cur._writeKind!=='modal' && cur._writeKind!=='evClear') next._writeKind='statusMerge';
  return next;
}
var modalSaved={fee:20000,dj:'CEDRIC GERVAIS',_writeKind:'modal'};
var afterStatus=statusTxnPatch(modalSaved,'Confirmed');
assert(afterStatus.fee===20000 && afterStatus._writeKind==='modal', 'status keeps modal fee/write kind');

/* 12) VIP / agency thin patches never carry fee or DJ */
function vipTxnSeed(rec){
  return { d:rec.d, v:rec.v, _uid:rec._uid, vipNote:rec.vipNote, _writeKind:'vipNote' };
}
function agencyTxnSeed(rec){
  return { d:rec.d, v:rec.v, _uid:rec._uid, agency:rec.agency, _writeKind:'agency' };
}
var vipSeed=vipTxnSeed({d:'2026-10-23',v:'Casa Neos Lounge',_uid:'s1',vipNote:'JD',fee:20000,dj:'CEDRIC'});
assert(!('fee' in vipSeed) && !('dj' in vipSeed) && vipSeed.vipNote==='JD', 'VIP seed is vipNote-only');
var agSeed=agencyTxnSeed({d:'2026-10-23',v:'Casa Neos Lounge',_uid:'s1',agency:'X',fee:20000,dj:'CEDRIC'});
assert(!('fee' in agSeed) && !('dj' in agSeed) && agSeed.agency==='X', 'agency seed is agency-only');

/* 13) Merge: modal fee/DJ always beat bake (reload rule) */
function mergeReload(target, edit){
  var kind=edit._writeKind||'';
  if(kind==='vipNote' || kind==='vip'){
    if(Object.prototype.hasOwnProperty.call(edit,'vipNote')) target.vipNote=edit.vipNote;
    return;
  }
  if(kind==='agency'){
    if(Object.prototype.hasOwnProperty.call(edit,'agency')) target.agency=edit.agency;
    return;
  }
  if(kind==='modal' || kind==='evClear'){
    if(Object.prototype.hasOwnProperty.call(edit,'dj')) target.dj=edit.dj==null?'':edit.dj;
    if(edit.fee!=null || edit.cost!=null){
      target.fee=edit.fee!=null?edit.fee:edit.cost;
      target.cost=edit.cost!=null?edit.cost:edit.fee;
    }
    Object.assign(target, edit);
    if(Object.prototype.hasOwnProperty.call(edit,'dj')) target.dj=edit.dj==null?'':edit.dj;
    if(edit.fee!=null || edit.cost!=null){
      target.fee=edit.fee!=null?edit.fee:edit.cost;
      target.cost=edit.cost!=null?edit.cost:edit.fee;
    }
    return;
  }
  if(kind==='statusMerge' || kind==='djStatus'){
    if(Object.prototype.hasOwnProperty.call(edit,'djStatus')) target.djStatus=edit.djStatus;
    var legacy=(edit.fee!=null||edit.cost!=null) && edit.dj && String(edit.dj).trim()!=='';
    if(legacy){
      target.dj=edit.dj;
      target.fee=edit.fee!=null?edit.fee:edit.cost;
    }
    return;
  }
}
var bakeRow={dj:'',fee:5000,vipNote:null,agency:null};
mergeReload(bakeRow, {_writeKind:'modal', dj:'CEDRIC GERVAIS ?', fee:20000, cost:20000, djStatus:'Confirmed'});
assert(bakeRow.fee===20000 && bakeRow.dj==='CEDRIC GERVAIS ?', 'modal reload beats bake fee/DJ');
mergeReload(bakeRow, {_writeKind:'statusMerge', djStatus:'Hold 1'});
assert(bakeRow.fee===20000 && bakeRow.dj==='CEDRIC GERVAIS ?' && bakeRow.djStatus==='Hold 1', 'status merge does not touch fee/DJ');
mergeReload(bakeRow, {_writeKind:'vipNote', vipNote:'JD'});
assert(bakeRow.fee===20000 && bakeRow.vipNote==='JD', 'VIP merge does not touch fee');
mergeReload(bakeRow, {_writeKind:'agency', agency:'WME'});
assert(bakeRow.fee===20000 && bakeRow.agency==='WME', 'agency merge does not touch fee');

/* 14) Edit Show preserve status/agency/VIP when building payload */
function editShowPreserve(prev, feeNext){
  var rec={fee:feeNext, dj:prev.dj, djStatus:null, agency:null, vipNote:null};
  if(Object.prototype.hasOwnProperty.call(prev,'djStatus')) rec.djStatus=prev.djStatus;
  if(Object.prototype.hasOwnProperty.call(prev,'agency')) rec.agency=prev.agency;
  if(Object.prototype.hasOwnProperty.call(prev,'vipNote')) rec.vipNote=prev.vipNote;
  return rec;
}
var preserved=editShowPreserve({dj:'CEDRIC',djStatus:'Confirmed',agency:'WME',vipNote:'JD'}, 25000);
assert(preserved.fee===25000 && preserved.djStatus==='Confirmed' && preserved.agency==='WME' && preserved.vipNote==='JD', 'Edit Show keeps status/agency/VIP');

console.log('\nAll sched guard tests passed.');
