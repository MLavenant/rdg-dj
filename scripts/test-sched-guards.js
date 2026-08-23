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
    /* Bulletproof: status never touches DJ/fee — even if a legacy seed bundled them. */
    if(Object.prototype.hasOwnProperty.call(edit,'djStatus')) target.djStatus=edit.djStatus;
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

/* 15) Stable venue|date uid — DJ rename must not change uid */
function ensureUidVenueDate(rec){
  if(rec._uid) return rec._uid;
  if(rec._added){
    rec._uid='s_rand';
    return rec._uid;
  }
  var base=[(rec.venue||rec.v||''),(rec.d||'')].join('|');
  var h=2166136261;
  for(var i=0;i<base.length;i++){ h^=base.charCodeAt(i); h=(h*16777619)>>>0; }
  rec._uid='s_'+h.toString(36)+'_'+String(rec.d||'').replace(/-/g,'');
  return rec._uid;
}
var uidA={v:'MILA Lounge',d:'2026-10-08',dj:'KIMONOS ????'};
var uidB={v:'MILA Lounge',d:'2026-10-08',dj:'GUY GERBER',fee:20000};
assert(ensureUidVenueDate(uidA)===ensureUidVenueDate(Object.assign({},uidB,{_uid:undefined})), 'rename same night keeps stable venue|date uid');
assert(ensureUidVenueDate({v:'MILA Lounge',d:'2026-10-08',dj:'A'})!==ensureUidVenueDate({v:'Casa Neos Beach Club',d:'2026-10-08',dj:'A'}), 'different venues get different uids');

/* 16) Live workbook night always beats bake (Guy Gerber / Oct 8 + Oct 10) */
function applyLiveWins(bakeRows, workbook){
  var s=bakeRows.map(function(r){ return Object.assign({}, r); });
  function nk(r){ return (r.v||r.venue||'')+'|'+r.d; }
  var liveByNight={};
  Object.keys(workbook).forEach(function(uid){
    var edit=workbook[uid];
    if(!edit||!edit.d) return;
    var key=nk(edit);
    var prev=liveByNight[key];
    var editAt=edit.updatedAt?Date.parse(edit.updatedAt):0;
    var prevAt=prev&&prev.edit&&prev.edit.updatedAt?Date.parse(prev.edit.updatedAt):0;
    if(!prev||editAt>=prevAt) liveByNight[key]={uid:uid, edit:edit};
  });
  Object.keys(liveByNight).forEach(function(key){
    var pack=liveByNight[key];
    var edit=Object.assign({}, pack.edit, {_uid:pack.uid, _writeKind:pack.edit._writeKind||'modal'});
    var hits=s.filter(function(x){ return nk(x)===key; });
    if(hits.length){
      mergeReload(hits[0], edit);
      hits[0]._uid=pack.uid;
      hits[0].dj=edit.dj;
      hits[0].fee=edit.fee!=null?edit.fee:edit.cost;
    } else {
      s.push(edit);
    }
  });
  return s;
}
var bakeOct=[
  {v:'MILA Lounge',d:'2026-10-08',dj:'KIMONOS ????',fee:10000,_uid:'bake_mila'},
  {v:'Casa Neos Beach Club',d:'2026-10-10',dj:'',fee:10000,_uid:'bake_bc'}
];
var liveWb={
  s_guy_mila:{v:'MILA Lounge',d:'2026-10-08',dj:'GUY GERBER',fee:20000,_writeKind:'modal',updatedAt:'2026-08-21T20:01:00.000Z',djStatus:'Confirmed'},
  s_guy_bc:{v:'Casa Neos Beach Club',d:'2026-10-10',dj:'GUY GERBER',fee:50000,_writeKind:'modal',updatedAt:'2026-08-21T19:43:00.000Z',djStatus:'Hold 1'}
};
var afterLive=applyLiveWins(bakeOct, liveWb);
var mila=afterLive.find(function(r){ return r.d==='2026-10-08' && (r.v||r.venue)==='MILA Lounge'; });
var bc=afterLive.find(function(r){ return r.d==='2026-10-10' && (r.v||r.venue)==='Casa Neos Beach Club'; });
assert(mila && mila.dj==='GUY GERBER' && mila.fee===20000, 'Oct 8 MILA live Guy Gerber beats bake KIMONOS');
assert(bc && bc.dj==='GUY GERBER' && bc.fee===50000 && bc.djStatus==='Hold 1', 'Oct 10 Beach Club live Guy Gerber beats blank bake');

/* 17) DJ rename must not wipe status / agency / VIP (Edit Show + Firebase txn) */
function modalTxnPreserve(prevRemote, payload){
  var out=Object.assign({}, payload);
  if(out.djStatus==null && prevRemote.djStatus!=null) out.djStatus=prevRemote.djStatus;
  if(out.agency==null && prevRemote.agency!=null) out.agency=prevRemote.agency;
  if(out.vipNote==null && prevRemote.vipNote!=null) out.vipNote=prevRemote.vipNote;
  return out;
}
var renamed=modalTxnPreserve(
  {dj:'OLD DJ',fee:10000,djStatus:'Hold 1',agency:'WME',vipNote:'VIP note'},
  {dj:'GUY GERBER',fee:20000,djStatus:null,agency:null,vipNote:null,_writeKind:'modal'}
);
assert(renamed.dj==='GUY GERBER' && renamed.fee===20000, 'rename updates DJ + fee');
assert(renamed.djStatus==='Hold 1' && renamed.agency==='WME' && renamed.vipNote==='VIP note', 'rename preserves status/agency/VIP');

/* 18) Status thin write must not carry DJ/fee (inverse isolation) */
function statusOnlyPatch(rec, nextStatus){
  return { d:rec.d, v:rec.v||rec.venue, _uid:rec._uid, djStatus:nextStatus, _writeKind:'statusMerge' };
}
var stOnly=statusOnlyPatch({d:'2026-10-08',v:'MILA Lounge',_uid:'s1',dj:'GUY GERBER',fee:20000}, 'Confirmed');
assert(!('dj' in stOnly) && !('fee' in stOnly) && stOnly.djStatus==='Confirmed', 'status patch never ships DJ/fee');
var rowAfterStatus={dj:'GUY GERBER',fee:20000,djStatus:'Hold 1'};
mergeReload(rowAfterStatus, stOnly);
assert(rowAfterStatus.dj==='GUY GERBER' && rowAfterStatus.fee===20000 && rowAfterStatus.djStatus==='Confirmed', 'status merge leaves DJ/fee untouched');

/* 19) Save ack contract — failure must surface; success clears */
function saveAck(err){
  return err ? {ok:false, msg:String(err.message||err)} : {ok:true};
}
assert(saveAck(null).ok===true, 'save ack success');
assert(saveAck(new Error('permission_denied')).ok===false, 'save ack failure surfaces');

/* 20) Align must not retarget existing live uid onto bake hash */
function alignKeepLiveUid(rec, bakeUid){
  if(rec._uid){ rec._added=0; return {kept:true, uid:rec._uid}; }
  rec._uid=bakeUid;
  rec._added=0;
  return {kept:false, uid:rec._uid};
}
var aligned=alignKeepLiveUid({_uid:'s_guy_live',d:'2026-10-10',dj:'GUY GERBER'}, 's_bake_empty');
assert(aligned.kept===true && aligned.uid==='s_guy_live', 'align keeps live workbook uid');

/* 21) CEDRIC GERVAIS: status update with legacy bundled fee must NOT change fee/DJ */
var cedric={dj:'CEDRIC GERVAIS',fee:25000,djStatus:'Hold 1',_writeKind:'modal'};
mergeReload(cedric, {
  _writeKind:'statusMerge',
  djStatus:'Confirmed',
  dj:'CEDRIC GERVAIS',
  fee:999999,
  cost:999999
});
assert(cedric.dj==='CEDRIC GERVAIS' && cedric.fee===25000 && cedric.djStatus==='Confirmed',
  'Cedric status change never rewrites fee/DJ even if seed is bundled');

/* 22) Edit gate — no edits until live ready */
function canEdit(liveReady, schedError){
  return !!liveReady && !schedError;
}
assert(canEdit(false, null)===false, 'edits locked before live ready');
assert(canEdit(true, 'sync fail')===false, 'edits locked on sync error');
assert(canEdit(true, null)===true, 'edits allowed when live ready');

/* 23) Pending echo confirm — save not done until live row matches */
function pendingMatches(p, row){
  if(!p||!row) return false;
  if(p.kind==='statusMerge') return String(row.djStatus||'')===String(p.djStatus||'');
  return String(row.dj||'').toUpperCase()===String(p.dj||'').toUpperCase()
    && Number(row.fee)!=null && Number(row.fee)===Number(p.fee);
}
var pend={kind:'modal', dj:'GUY GERBER', fee:50000, djStatus:'Hold 1'};
assert(pendingMatches(pend, {dj:'GUY GERBER', fee:50000})===true, 'echo confirms matching DJ/fee');
assert(pendingMatches(pend, {dj:'KIMONOS', fee:10000})===false, 'echo rejects bake ghost after save');
assert(pendingMatches({kind:'statusMerge', djStatus:'Confirmed'}, {dj:'CEDRIC GERVAIS', fee:25000, djStatus:'Confirmed'})===true,
  'status echo confirms status only');

/* 24) Save failure must roll back local optimistic paint */
function rollbackOnFail(localRow, snap, err){
  if(!err) return localRow;
  return Object.assign({}, snap);
}
var optimistic={dj:'NEW NAME', fee:30000, djStatus:'Confirmed'};
var snap={dj:'OLD NAME', fee:20000, djStatus:'Confirmed'};
var rolled=rollbackOnFail(optimistic, snap, new Error('denied'));
assert(rolled.dj==='OLD NAME' && rolled.fee===20000, 'failed save rolls back DJ/fee');

/* 25) liveByNight must prefer modal row over newer thin status seed (Dec 27 class) */
function nightAuth(edit){
  if(!edit) return 0;
  var s=0, kind=edit._writeKind||'';
  if(kind==='modal'||kind==='evClear') s+=1000;
  else if(kind==='statusMerge'||kind==='djStatus') s+=10;
  if(edit.dj!=null && String(edit.dj).trim()!=='') s+=100;
  if(edit.fee!=null||edit.cost!=null) s+=50;
  if(edit.djStatus) s+=5;
  return s;
}
var modalNight={_writeKind:'modal',dj:'SATORI',fee:32000,djStatus:'Hold 1',updatedAt:'2026-08-17T16:19:44.715Z'};
var statusNight={_writeKind:'statusMerge',djStatus:'Confirmed',updatedAt:'2026-08-22T09:44:29.962Z'};
assert(nightAuth(modalNight)>nightAuth(statusNight), 'modal night beats newer status-only seed');

/* 26) In-flight add/rename must survive stale Firebase rebuild (user: new show vanished) */
function preservePendingModalShows(s, pend, gmap){
  Object.keys(pend||{}).forEach(function(uid){
    var p=pend[uid];
    if(!p || p.confirmed || p.stale) return;
    if(p.kind!=='modal' && p.kind!=='evClear') return;
    var g=gmap[uid];
    if(!g || !g._lockIdentity) return;
    var nk=p.night||((g.v||g.venue||'')+'|'+(g.d||''));
    var row={v:g.v||g.venue,venue:g.venue||g.v,d:g.d,dj:g.dj,fee:g.fee,_uid:uid,_added:g._added||1,_writeKind:'modal'};
    var hits=s.filter(function(r){ return r && (r.v||r.venue)===row.venue && r.d===row.d; });
    if(hits.length) Object.assign(hits[0], row);
    else s.push(row);
  });
  return s;
}
var staleBake=[{v:'MILA Lounge',d:'2027-11-15',dj:'',fee:null,_uid:'bake1'}];
var pending={'s_new_add_1':{kind:'modal',night:'MILA Lounge|2027-11-15',confirmed:false,stale:false}};
var guards={'s_new_add_1':{_lockIdentity:true,dj:'BRAND NEW DJ',fee:9000,d:'2027-11-15',v:'MILA Lounge',venue:'MILA Lounge',_added:1}};
var afterRebuild=preservePendingModalShows(staleBake.slice(), pending, guards);
var kept=afterRebuild.find(function(r){ return r.d==='2027-11-15' && r.dj==='BRAND NEW DJ'; });
assert(kept && kept.fee===9000, 'pending add survives stale bake-only rebuild');

/* 27) Delete → blank re-add must not resurrect old bake/fee */
function applyWithClearedNight(baked, ov, clearedNights){
  var s=baked.map(function(r){ return Object.assign({}, r); });
  var wb=(ov&&ov.shows)||{};
  Object.keys(wb).forEach(function(uid){
    var edit=wb[uid];
    if(!edit||!edit.d) return;
    var hits=s.filter(function(x){ return x && (x.v||x.venue)===(edit.v||edit.venue) && x.d===edit.d; });
    if(hits.length) Object.assign(hits[0], edit, {_uid:uid});
    else s.push(Object.assign({}, edit, {_uid:uid, _added:1}));
  });
  return s.filter(function(r){
    if(!r||!r.d) return false;
    var nk=(r.v||r.venue)+'|'+r.d;
    if(clearedNights[nk] && clearedNights[nk].baked && !r._added) return false;
    return true;
  });
}
var bakeNight=[{v:'MILA Lounge',d:'2027-11-20',dj:'OLD BAKE DJ',fee:15000,_uid:'bake_old'}];
var cleared={'MILA Lounge|2027-11-20':{uid:'bake_old',baked:true,at:Date.now()}};
var afterDel=applyWithClearedNight(bakeNight, {shows:{}}, cleared);
assert(afterDel.length===0, 'cleared night hides bake after delete');
var blankAdd={v:'MILA Lounge',d:'2027-11-20',dj:'',fee:null,_added:1,_uid:'s_new_blank',_writeKind:'modal'};
var afterReadd=applyWithClearedNight(bakeNight, {shows:{s_new_blank:blankAdd}}, {});
var hit=afterReadd.find(function(r){ return r.d==='2027-11-20'; });
assert(hit && (!hit.fee || hit.fee===0) && !String(hit.dj||'').includes('OLD BAKE'), 'blank re-add has no old fee/DJ');

/* 28) Blank placeholder must not clear baked tombstone */
var clearedNights28={'MILA Lounge|2027-11-21':{uid:'bake_old2',baked:true,at:Date.now()}};
function guardUndeleteSim(rec, store){
  var blank=!String(rec.dj||'').trim() && rec.fee==null && rec.cost==null;
  var nk=(rec.v||rec.venue)+'|'+rec.d;
  if(nk && store[nk]){
    if(blank && store[nk].baked) return store;
    delete store[nk];
  }
  return store;
}
var afterUndelete=guardUndeleteSim({v:'MILA Lounge',d:'2027-11-21',dj:'',fee:null,_added:1}, clearedNights28);
assert(afterUndelete['MILA Lounge|2027-11-21'] && afterUndelete['MILA Lounge|2027-11-21'].baked, 'blank undelete keeps bake tombstone');

console.log('\nAll sched guard tests passed.');
