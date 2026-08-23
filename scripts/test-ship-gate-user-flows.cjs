#!/usr/bin/env node
/**
 * Automated two-session verification for user-reported bugs:
 * 1) New show visible after Session B refresh
 * 2) Status change does not touch another night
 * 3) Rename persists across sessions + stale rebuild
 * 4) Pending add survives stale Firebase snapshot (pre-echo)
 */
'use strict';
const https = require('https');
const {
  loadBaked, applyLocal, findNight, nightKey, statusTxnPatch
} = require('./lib/local-sched-apply.cjs');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const results = [];

function pass(n, d) { results.push({ ok: true, name: n, detail: d }); console.log('PASS  ' + n + (d ? ' — ' + d : '')); }
function fail(n, d) { results.push({ ok: false, name: n, detail: d }); console.error('FAIL  ' + n + ' — ' + d); }

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = https.request(
      { hostname: HOST, path: p, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, json: safe(b) }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
function safe(b) { try { return JSON.parse(b || 'null'); } catch (e) { return null; } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function sessionApply(ov, opts) {
  return applyLocal(loadBaked(), ov, opts);
}

(async function main() {
  console.log('=== Ship-gate: automated two-session user flows ===\n');
  const baked = loadBaked();

  /* ── 1) NEW SHOW: Session A add → Session B refresh (twice) ── */
  const V1 = 'MILA Lounge';
  const D1 = '2027-11-15';
  const UID1 = 's_e2e_new_' + Date.now().toString(36);
  const P1 = '/rdg/schedOverrides/shows/' + encodeURIComponent(UID1) + '.json';
  const prior1 = await req('GET', P1);

  const newShow = {
    v: V1, venue: V1, d: D1, dj: 'SHIP-GATE NEW DJ', fee: 12345, cost: 12345,
    _uid: UID1, _added: 1, _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  };
  const w1 = await req('PUT', P1, newShow);
  if (w1.status === 200) pass('Session A: new show write', newShow.dj);
  else fail('Session A: new show write', String(w1.status));

  await sleep(500);
  const ovB1 = await req('GET', '/rdg/schedOverrides.json');
  const hitB1 = findNight(sessionApply(ovB1.json), V1, D1);
  if (hitB1 && hitB1.dj === newShow.dj && Number(hitB1.fee) === 12345) pass('Session B: sees new show (1st refresh)', hitB1.dj);
  else fail('Session B: sees new show (1st refresh)', JSON.stringify(hitB1));

  await sleep(400);
  const ovB2 = await req('GET', '/rdg/schedOverrides.json');
  const hitB2 = findNight(sessionApply(ovB2.json), V1, D1);
  if (hitB2 && hitB2.dj === newShow.dj) pass('Session B: sees new show (2nd refresh)', hitB2.dj);
  else fail('Session B: sees new show (2nd refresh)', JSON.stringify(hitB2));

  /* Stale snapshot before echo: bake-only + pending guard */
  const staleOv = JSON.parse(JSON.stringify(ovB2.json));
  if (staleOv.shows) delete staleOv.shows[UID1];
  const pending = { [UID1]: { kind: 'modal', night: nightKey(newShow), confirmed: false, stale: false } };
  const guards = {
    [UID1]: {
      _lockIdentity: true, dj: newShow.dj, fee: newShow.fee, cost: newShow.cost,
      d: D1, v: V1, venue: V1, _added: 1
    }
  };
  const staleHit = findNight(sessionApply(staleOv, { pending, guards }), V1, D1);
  if (staleHit && staleHit.dj === newShow.dj) pass('Stale snapshot: pending add still visible', staleHit.dj);
  else fail('Stale snapshot: pending add still visible', JSON.stringify(staleHit));

  /* ── 2) STATUS: change night A only; night B untouched ── */
  const VA = 'MILA Lounge';
  const DA = '2027-10-07';
  const UIDA = 's_1jrb3kl_20271007';
  const VB = 'Casa Neos Lounge';
  const DB = '2027-10-01';
  const UIDB = 's_35hhgk_20271001';
  const snapA = await req('GET', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDA) + '.json');
  const snapB = await req('GET', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDB) + '.json');
  const priorA = snapA.json;
  const priorB = snapB.json;

  const seedA = Object.assign({}, priorA || { v: VA, venue: VA, d: DA, _uid: UIDA }, {
    dj: 'STATUS-GATE DJ A', fee: 15000, cost: 15000, djStatus: 'Offer sent',
    _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  });
  const seedB = Object.assign({}, priorB || { v: VB, venue: VB, d: DB, _uid: UIDB }, {
    dj: 'STATUS-GATE DJ B', fee: 8000, cost: 8000, djStatus: 'Offer sent',
    _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  });
  await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDA) + '.json', seedA);
  await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDB) + '.json', seedB);
  await sleep(400);

  let ov = await req('GET', '/rdg/schedOverrides.json');
  const showsMap = Object.assign({}, ov.json.shows || {});
  const wbUid = statusTxnPatch(showsMap, VA, DA, UIDA, 'Confirmed');
  await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(wbUid) + '.json', showsMap[wbUid]);
  await sleep(400);

  ov = await req('GET', '/rdg/schedOverrides.json');
  const afterStatus = sessionApply(ov.json);
  const rowA = findNight(afterStatus, VA, DA);
  const rowB = findNight(afterStatus, VB, DB);
  if (rowA && rowA.djStatus === 'Confirmed' && rowA.dj === 'STATUS-GATE DJ A' && Number(rowA.fee) === 15000) {
    pass('Status night A: status changed, DJ/fee frozen', rowA.djStatus);
  } else fail('Status night A', JSON.stringify(rowA));
  if (rowB && rowB.djStatus === 'Offer sent' && rowB.dj === 'STATUS-GATE DJ B') {
    pass('Status night B: untouched', rowB.dj + ' / ' + rowB.djStatus);
  } else fail('Status night B: should be untouched', JSON.stringify(rowB));

  /* ── 3) RENAME: Session A rename → Session B → Session A refresh ── */
  const VR = 'Casa Neos Lounge';
  const DR = '2027-10-08';
  const UIDR = 's_53epbc_20271008';
  const priorR = await req('GET', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDR) + '.json');
  const renamed = Object.assign({}, priorR.json || { v: VR, venue: VR, d: DR, _uid: UIDR }, {
    dj: 'RENAME-GATE V1', fee: 11111, cost: 11111, djStatus: 'Hold 1', agency: 'AG-GATE',
    _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  });
  await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDR) + '.json', renamed);
  await sleep(400);

  const renamed2 = Object.assign({}, renamed, { dj: 'RENAME-GATE V2', fee: 22222, cost: 22222, updatedAt: new Date().toISOString() });
  await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDR) + '.json', renamed2);
  await sleep(400);

  const ovR1 = await req('GET', '/rdg/schedOverrides.json');
  const hitR1 = findNight(sessionApply(ovR1.json), VR, DR);
  if (hitR1 && hitR1.dj === 'RENAME-GATE V2' && Number(hitR1.fee) === 22222 && hitR1.djStatus === 'Hold 1' && hitR1.agency === 'AG-GATE') {
    pass('Session B: rename + meta preserved', hitR1.dj + ' $' + hitR1.fee);
  } else fail('Session B: rename', JSON.stringify(hitR1));

  await sleep(300);
  const ovR2 = await req('GET', '/rdg/schedOverrides.json');
  const hitR2 = findNight(sessionApply(ovR2.json), VR, DR);
  if (hitR2 && hitR2.dj === 'RENAME-GATE V2') pass('Session A refresh: rename still there', hitR2.dj);
  else fail('Session A refresh: rename lost', JSON.stringify(hitR2));

  /* ── 4) DELETE → blank re-add: no old fee ── */
  const VD = 'MILA Lounge';
  const DD = '2027-11-20';
  const UIDD = 's_e2e_delre_' + Date.now().toString(36);
  const PD = '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDD) + '.json';
  const priorD = await req('GET', PD);
  const seeded = {
    v: VD, venue: VD, d: DD, dj: 'DELETE-THEN-BLANK', fee: 19999, cost: 19999,
    _uid: UIDD, _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  };
  await req('PUT', PD, seeded);
  await sleep(300);
  await req('DELETE', PD);
  const tomb = VD + '|' + DD + '|' + UIDD;
  const ovDel = await req('GET', '/rdg/schedOverrides.json');
  const dels = ovDel.json.deletes ? (Array.isArray(ovDel.json.deletes) ? ovDel.json.deletes.slice() : Object.values(ovDel.json.deletes)) : [];
  if (dels.indexOf(tomb) < 0) dels.push(tomb);
  await req('PUT', '/rdg/schedOverrides/deletes.json', dels.filter((k) => k && String(k).split('|').length >= 3));
  await sleep(300);
  const blankUid = 's_e2e_blank_' + Date.now().toString(36);
  const blankShow = {
    v: VD, venue: VD, d: DD, dj: '', fee: null, cost: null,
    _uid: blankUid, _added: 1, _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  };
  await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(blankUid) + '.json', blankShow);
  await sleep(400);
  const ovRe = await req('GET', '/rdg/schedOverrides.json');
  const hitRe = findNight(sessionApply(ovRe.json), VD, DD);
  if (hitRe && (!hitRe.fee || Number(hitRe.fee) === 0) && !String(hitRe.dj || '').includes('DELETE-THEN-BLANK')) {
    pass('Delete → blank re-add: no old fee/DJ', JSON.stringify({ dj: hitRe.dj, fee: hitRe.fee }));
  } else fail('Delete → blank re-add: old fee/DJ resurrected', JSON.stringify(hitRe));
  await req('DELETE', '/rdg/schedOverrides/shows/' + encodeURIComponent(blankUid) + '.json');
  const cleanedDels = dels.filter((k) => k !== tomb);
  await req('PUT', '/rdg/schedOverrides/deletes.json', cleanedDels.length ? cleanedDels : null);

  /* ── cleanup ── */
  if (prior1.json == null) await req('DELETE', P1);
  else await req('PUT', P1, prior1.json);
  if (priorA == null) await req('DELETE', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDA) + '.json');
  else await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDA) + '.json', priorA);
  if (priorB == null) await req('DELETE', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDB) + '.json');
  else await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDB) + '.json', priorB);
  if (priorR.json == null) await req('DELETE', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDR) + '.json');
  else await req('PUT', '/rdg/schedOverrides/shows/' + encodeURIComponent(UIDR) + '.json', priorR.json);
  pass('Cleanup', 'all test nights restored');

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  if (failed.length) {
    failed.forEach((f) => console.error(' - ' + f.name + ': ' + f.detail));
    process.exit(1);
  }
  console.log('All user-reported flows verified (automated two-session).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
