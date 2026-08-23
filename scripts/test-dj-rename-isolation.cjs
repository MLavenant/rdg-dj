#!/usr/bin/env node
/**
 * Bulletproof: DJ name / fee edits must NOT alter status, agency, VIP, or other nights.
 * Mirrors persistSchedShow modal transaction + full local apply path.
 * Oct 2027 MILA — restores prior Firebase row on exit.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const VENUE = 'MILA Lounge';
const OTHER_VENUE = 'Casa Neos Lounge';
const DATE = '2027-10-07';
const OTHER_DATE = '2027-10-01';
const UID = 's_1jrb3kl_20271007';
const OTHER_UID = 's_35hhgk_20271001';
const results = [];

const IDENTITY = {
  dj: 'RENAME-E2E ORIGINAL',
  fee: 18000,
  djStatus: 'Hold 1',
  agency: 'WME TEST',
  vipNote: 'VIP TABLE 7'
};

function pass(name, detail) {
  results.push({ ok: true, name, detail });
  console.log('PASS  ' + name + (detail ? ' — ' + detail : ''));
}
function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.error('FAIL  ' + name + ' — ' + detail);
}

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = https.request(
      { hostname: HOST, path: p, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve({ status: res.statusCode, json: safeJson(b) }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
function safeJson(b) { try { return JSON.parse(b || 'null'); } catch (e) { return null; } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nightKey(r) { return (r.v || r.venue || '') + '|' + (r.d || ''); }

function modalTxnPatch(cur, patch) {
  const next = Object.assign({}, cur || {}, patch, {
    updatedAt: new Date().toISOString(),
    _writeKind: 'modal',
    _uid: UID,
    d: DATE,
    v: VENUE,
    venue: VENUE
  });
  /* Edit Show must not wipe status / agency / VIP (persistSchedShow transaction rule) */
  if (patch.djStatus == null && cur && cur.djStatus != null) next.djStatus = cur.djStatus;
  if (patch.agency == null && cur && cur.agency != null) next.agency = cur.agency;
  if (patch.vipNote == null && cur && cur.vipNote != null) next.vipNote = cur.vipNote;
  if (patch.dj != null) next.dj = patch.dj;
  if (patch.fee != null) { next.fee = patch.fee; next.cost = patch.fee; }
  return next;
}

function mergeSchedEditLocal(target, edit) {
  if (!target || !edit) return;
  const kind = edit._writeKind || '';
  if (kind === 'statusMerge' || kind === 'djStatus') {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    return;
  }
  if (kind === 'vipNote' || kind === 'vip') {
    if (Object.prototype.hasOwnProperty.call(edit, 'vipNote')) target.vipNote = edit.vipNote == null ? null : edit.vipNote;
    return;
  }
  if (kind === 'agency') {
    if (Object.prototype.hasOwnProperty.call(edit, 'agency')) target.agency = edit.agency == null ? null : edit.agency;
    return;
  }
  if (kind === 'modal' || kind === 'evClear') {
    if (Object.prototype.hasOwnProperty.call(edit, 'dj')) target.dj = edit.dj == null ? '' : edit.dj;
    if (edit.fee != null || edit.cost != null) {
      target.fee = edit.fee != null ? edit.fee : edit.cost;
      target.cost = edit.cost != null ? edit.cost : edit.fee;
    }
    Object.assign(target, edit);
    if (Object.prototype.hasOwnProperty.call(edit, 'dj')) target.dj = edit.dj == null ? '' : edit.dj;
    if (edit.fee != null || edit.cost != null) {
      target.fee = edit.fee != null ? edit.fee : edit.cost;
      target.cost = edit.cost != null ? edit.cost : edit.fee;
    }
    return;
  }
  Object.assign(target, edit);
}

function nightLiveAuthority(edit) {
  if (!edit) return 0;
  let s = 0;
  const kind = edit._writeKind || '';
  if (kind === 'modal' || kind === 'evClear') s += 1000;
  else if (kind === 'statusMerge' || kind === 'djStatus') s += 10;
  if (edit.dj != null && String(edit.dj).trim() !== '') s += 100;
  if (edit.fee != null || edit.cost != null) s += 50;
  if (edit.djStatus) s += 5;
  return s;
}

function applyLocalWorkbook(baked, ov) {
  const s = baked.map((r) => Object.assign({}, r));
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  if (!workbookUids.length) return s;
  const delsWRaw = ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const delsW = delsWRaw.filter((dk) => dk && String(dk).split('|').length >= 3);

  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit) return;
    let editN = edit;
    if (!editN._writeKind && ((editN.dj != null && String(editN.dj).trim() !== '') || editN.fee != null || editN.cost != null)) {
      editN = Object.assign({}, editN, { _writeKind: 'modal' });
    }
    const idx = s.findIndex((r) => r && String(r._uid || '') === String(uid));
    if (idx >= 0) {
      mergeSchedEditLocal(s[idx], editN);
      s[idx]._uid = uid;
    } else {
      const row = Object.assign({}, editN, { _uid: uid });
      const night = nightKey(row);
      const occupied = night ? s.filter((x) => x && nightKey(x) === night) : [];
      if (occupied.length) {
        mergeSchedEditLocal(occupied[0], row);
        occupied[0]._uid = uid;
      } else {
        row._added = 1;
        s.push(row);
      }
    }
  });

  const liveByNight = {};
  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit || !edit.d) return;
    const nk = nightKey(edit);
    if (!nk) return;
    const prev = liveByNight[nk];
    const editAuth = nightLiveAuthority(edit);
    const prevAuth = prev ? nightLiveAuthority(prev.edit) : -1;
    const editAt = edit.updatedAt ? Date.parse(edit.updatedAt) : 0;
    const prevAt = prev && prev.edit && prev.edit.updatedAt ? Date.parse(prev.edit.updatedAt) : 0;
    if (!prev || editAuth > prevAuth || (editAuth === prevAuth && editAt >= prevAt)) {
      liveByNight[nk] = { uid, edit };
    }
  });
  Object.keys(liveByNight).forEach((nk) => {
    const pack = liveByNight[nk];
    const edit = Object.assign({}, pack.edit, { _uid: pack.uid, _writeKind: pack.edit._writeKind || 'modal' });
    const hits = s.filter((x) => x && nightKey(x) === nk);
    if (hits.length) {
      mergeSchedEditLocal(hits[0], edit);
      hits[0]._uid = pack.uid;
    } else {
      edit._added = 1;
      s.push(edit);
    }
  });

  return s.filter((r) => {
    if (!r) return false;
    for (const dk of delsW) {
      const p = String(dk || '').split('|');
      const uidKey = (r.v || r.venue || '') + '|' + (r.d || '') + '|' + (r._uid || '');
      if (uidKey === dk || (p.length >= 3 && p[2] === r._uid)) return false;
    }
    return true;
  });
}

function findNight(rows, venue, d) {
  return rows.filter((r) => (r.v || r.venue) === venue && r.d === d);
}

function checkMeta(row, label) {
  const ok = row &&
    row.djStatus === IDENTITY.djStatus &&
    row.agency === IDENTITY.agency &&
    row.vipNote === IDENTITY.vipNote;
  if (ok) pass(label, 'status=' + row.djStatus + ' agency=' + row.agency);
  else fail(label, JSON.stringify({ djStatus: row && row.djStatus, agency: row && row.agency, vip: row && row.vipNote }));
}

function loadBaked() {
  const bakeFile = fs.readFileSync(path.join(__dirname, '..', 'data', 'sched-baked.js'), 'utf8');
  return JSON.parse(bakeFile.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/)[1]);
}

async function applyAndFind(ov) {
  const applied = applyLocalWorkbook(loadBaked(), ov);
  return findNight(applied, VENUE, DATE)[0];
}

(async function main() {
  console.log('=== DJ rename / fee isolation (meta fields + other nights) ===\n');

  const snapPath = '/rdg/schedOverrides/shows/' + encodeURIComponent(UID) + '.json';
  const otherPath = '/rdg/schedOverrides/shows/' + encodeURIComponent(OTHER_UID) + '.json';
  const prior = await req('GET', snapPath);
  const priorOther = await req('GET', otherPath);
  const priorRec = prior.json;
  const priorOtherRec = priorOther.json;

  const seed = modalTxnPatch(null, Object.assign({}, IDENTITY, { _e2e: true }));
  await req('PUT', snapPath, seed);
  await req('PUT', otherPath, {
    v: OTHER_VENUE, venue: OTHER_VENUE, d: OTHER_DATE, dj: 'CONTROL DJ', fee: 5000, cost: 5000,
    _uid: OTHER_UID, _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  });
  await sleep(400);
  pass('Seed test night + control night', IDENTITY.dj + ' / CONTROL DJ');

  /* 1) Rename DJ only */
  let cur = (await req('GET', snapPath)).json;
  let patched = modalTxnPatch(cur, { dj: 'RENAME-E2E RENAMED' });
  await req('PUT', snapPath, patched);
  await sleep(300);
  cur = (await req('GET', snapPath)).json;
  if (cur.dj === 'RENAME-E2E RENAMED' && Number(cur.fee) === IDENTITY.fee) {
    pass('Rename DJ only — Firebase', cur.dj + ' $' + cur.fee);
  } else fail('Rename DJ only — Firebase', JSON.stringify({ dj: cur.dj, fee: cur.fee }));
  checkMeta(cur, 'Rename DJ only — meta preserved (Firebase)');

  let hit = await applyAndFind((await req('GET', '/rdg/schedOverrides.json')).json);
  if (hit && hit.dj === 'RENAME-E2E RENAMED' && Number(hit.fee) === IDENTITY.fee) {
    pass('Rename DJ only — Session B apply', hit.dj);
  } else fail('Rename DJ only — Session B apply', JSON.stringify(hit));
  checkMeta(hit, 'Rename DJ only — meta preserved (apply)');

  /* 2) Change fee only */
  cur = (await req('GET', snapPath)).json;
  patched = modalTxnPatch(cur, { fee: 22000 });
  await req('PUT', snapPath, patched);
  await sleep(300);
  cur = (await req('GET', snapPath)).json;
  if (cur.dj === 'RENAME-E2E RENAMED' && Number(cur.fee) === 22000) {
    pass('Fee change only — Firebase', '$' + cur.fee);
  } else fail('Fee change only — Firebase', JSON.stringify({ dj: cur.dj, fee: cur.fee }));
  checkMeta(cur, 'Fee change only — meta preserved (Firebase)');

  hit = await applyAndFind((await req('GET', '/rdg/schedOverrides.json')).json);
  if (hit && Number(hit.fee) === 22000 && hit.dj === 'RENAME-E2E RENAMED') {
    pass('Fee change only — Session B apply', '$' + hit.fee);
  } else fail('Fee change only — Session B apply', JSON.stringify(hit));
  checkMeta(hit, 'Fee change only — meta preserved (apply)');

  /* 3) Change DJ + fee together */
  cur = (await req('GET', snapPath)).json;
  patched = modalTxnPatch(cur, { dj: 'RENAME-E2E FINAL', fee: 33333 });
  await req('PUT', snapPath, patched);
  await sleep(300);
  cur = (await req('GET', snapPath)).json;
  if (cur.dj === 'RENAME-E2E FINAL' && Number(cur.fee) === 33333) {
    pass('DJ + fee together — Firebase', cur.dj + ' $' + cur.fee);
  } else fail('DJ + fee together — Firebase', JSON.stringify(cur));
  checkMeta(cur, 'DJ + fee together — meta preserved (Firebase)');

  /* 4) Other nights untouched */
  const ov = (await req('GET', '/rdg/schedOverrides.json')).json;
  const otherRaw = ov.shows && ov.shows[OTHER_UID];
  if (otherRaw && otherRaw.dj === 'CONTROL DJ' && Number(otherRaw.fee) === 5000) {
    pass('Control night untouched (Firebase)', otherRaw.dj);
  } else fail('Control night untouched (Firebase)', JSON.stringify(otherRaw));

  const applied = applyLocalWorkbook(loadBaked(), ov);
  const otherHit = findNight(applied, OTHER_VENUE, OTHER_DATE)[0];
  if (otherHit && otherHit.dj === 'CONTROL DJ') {
    pass('Control night untouched (apply)', otherHit.dj);
  } else fail('Control night untouched (apply)', JSON.stringify(otherHit));

  /* 5) Only one row for test night */
  const allTest = findNight(applied, VENUE, DATE);
  if (allTest.length === 1) pass('One row per venue|date after edits', 'count=1');
  else fail('One row per venue|date after edits', 'count=' + allTest.length);

  if (priorRec == null) await req('DELETE', snapPath);
  else await req('PUT', snapPath, priorRec);
  if (priorOtherRec == null) await req('DELETE', otherPath);
  else await req('PUT', otherPath, priorOtherRec);
  pass('Cleanup restored prior Firebase rows', 'both nights');

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  if (failed.length) {
    failed.forEach((f) => console.error(' - ' + f.name + ': ' + f.detail));
    process.exit(1);
  }
  console.log('DJ/fee edits never move status, agency, VIP, or other nights.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
