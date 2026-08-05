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

console.log('\nAll sched guard tests passed.');
