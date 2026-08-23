#!/usr/bin/env node
/**
 * Bulletproof: DJ status changes must NEVER alter DJ name or fee.
 * Mirrors persistShowDjStatusOnly transaction + full workbook apply (local code path).
 * Uses safe Oct 2027 MILA night; restores prior Firebase row on exit.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const VENUE = 'MILA Lounge';
const DATE = '2027-10-07';
const UID = 's_1jrb3kl_20271007';
const DJ = 'CEDRIC GERVAIS STATUS-E2E';
const FEE = 25000;
const STATUSES = ['Offer sent', 'Hold 1', 'Confirmed', ''];
const results = [];

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

/** Exact logic from js/modals.js persistShowDjStatusOnly transaction branch */
function statusTxnPatch(cur, nextStatus) {
  if (cur && typeof cur === 'object') {
    const next = Object.assign({}, cur);
    next.djStatus = nextStatus == null ? null : nextStatus;
    next.updatedAt = new Date().toISOString();
    if (cur._writeKind === 'modal' || cur._writeKind === 'evClear') next._writeKind = cur._writeKind;
    else next._writeKind = 'statusMerge';
    return next;
  }
  return {
    d: DATE, v: VENUE, venue: VENUE, _uid: UID, djStatus: nextStatus == null ? null : nextStatus,
    _writeKind: 'statusMerge', _added: 1, updatedAt: new Date().toISOString()
  };
}

function mergeSchedEditLocal(target, edit) {
  if (!target || !edit) return;
  const kind = edit._writeKind || '';
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
  if (kind === 'statusMerge' || kind === 'djStatus') {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
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
  const s = baked.map((r) => { const c = Object.assign({}, r); return c; });
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  if (!workbookUids.length) return s;

  const delsWRaw = ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const delsW = delsWRaw.filter((dk) => dk && String(dk).split('|').length >= 3);

  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit) return;
    let dead = false;
    for (const dk of delsW) {
      const p0 = String(dk || '').split('|');
      if (dk === ((edit.v || edit.venue || '') + '|' + (edit.d || '') + '|' + uid) || (p0.length >= 3 && p0[2] === uid)) { dead = true; break; }
    }
    if (dead) return;
    const idx = s.findIndex((r) => r && String(r._uid || '') === String(uid));
    let editN = edit;
    if (!editN._writeKind && ((editN.dj != null && String(editN.dj).trim() !== '') || editN.fee != null || editN.cost != null)) {
      editN = Object.assign({}, editN, { _writeKind: 'modal' });
    }
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
        occupied[0]._added = 0;
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
      hits[0]._added = 0;
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

function assertIdentity(row, label) {
  const djOk = row && String(row.dj) === DJ;
  const feeOk = row && Number(row.fee) === FEE;
  if (djOk && feeOk) pass(label, row.dj + ' $' + row.fee + ' status=' + JSON.stringify(row.djStatus));
  else fail(label, JSON.stringify({ dj: row && row.dj, fee: row && row.fee, status: row && row.djStatus }));
}

(async function main() {
  console.log('=== DJ status isolation (name/fee must never move) ===\n');

  const snapPath = '/rdg/schedOverrides/shows/' + encodeURIComponent(UID) + '.json';
  const prior = await req('GET', snapPath);
  const priorRec = prior.json;

  const modalSeed = {
    v: VENUE, venue: VENUE, d: DATE, dj: DJ, fee: FEE, cost: FEE,
    _uid: UID, _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  };
  const w0 = await req('PUT', snapPath, modalSeed);
  if (w0.status !== 200) fail('Seed modal DJ/fee', String(w0.status));
  else pass('Seed modal DJ/fee', DJ + ' $' + FEE);

  await sleep(400);

  for (const st of STATUSES) {
    const got = await req('GET', snapPath);
    const patched = statusTxnPatch(got.json, st || null);
    const w = await req('PUT', snapPath, patched);
    if (w.status !== 200) {
      fail('Status write "' + (st || '(cleared)') + '"', String(w.status));
      continue;
    }

    const raw = await req('GET', snapPath);
    const r = raw.json || {};
    if (String(r.dj) !== DJ || Number(r.fee) !== FEE) {
      fail('Firebase raw after status "' + (st || '(cleared)') + '"', JSON.stringify({ dj: r.dj, fee: r.fee, status: r.djStatus }));
    } else {
      pass('Firebase raw after status "' + (st || '(cleared)') + '"', 'dj/fee frozen');
    }

    const ov = await req('GET', '/rdg/schedOverrides.json');
    const bakeFile = fs.readFileSync(path.join(__dirname, '..', 'data', 'sched-baked.js'), 'utf8');
    const baked = JSON.parse(bakeFile.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/)[1]);
    const applied = applyLocalWorkbook(baked, ov.json);
    const hit = findNight(applied, VENUE, DATE)[0];
    assertIdentity(hit, 'Session B apply after status "' + (st || '(cleared)') + '"');
  }

  /* Evil legacy seed: second uid on same night bundles wrong DJ/fee in statusMerge */
  const evilUid = 's_e2e_evil_' + Date.now().toString(36);
  const evilPath = '/rdg/schedOverrides/shows/' + encodeURIComponent(evilUid) + '.json';
  await req('PUT', evilPath, {
    v: VENUE, venue: VENUE, d: DATE,
    dj: 'WRONG DJ NAME', fee: 1, cost: 1,
    djStatus: 'Confirmed', _writeKind: 'statusMerge',
    updatedAt: new Date().toISOString(), _e2e: true
  });
  await sleep(300);
  const ovEvil = await req('GET', '/rdg/schedOverrides.json');
  const bakeFile2 = fs.readFileSync(path.join(__dirname, '..', 'data', 'sched-baked.js'), 'utf8');
  const baked2 = JSON.parse(bakeFile2.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/)[1]);
  const appliedEvil = applyLocalWorkbook(baked2, ovEvil.json);
  const hitEvil = findNight(appliedEvil, VENUE, DATE)[0];
  assertIdentity(hitEvil, 'Modal row beats evil bundled status seed on same night');
  await req('DELETE', evilPath);

  /* In-memory Cedric: legacy bundled status seed must not rewrite fee/DJ */
  const cedric = { dj: DJ, fee: FEE, djStatus: 'Hold 1', _writeKind: 'modal' };
  mergeSchedEditLocal(cedric, {
    _writeKind: 'statusMerge', djStatus: 'Confirmed',
    dj: 'SHOULD NOT APPLY', fee: 999, cost: 999
  });
  if (cedric.dj === DJ && cedric.fee === FEE && cedric.djStatus === 'Confirmed') {
    pass('Merge ignores bundled dj/fee inside statusMerge seed', cedric.dj + ' $' + cedric.fee);
  } else {
    fail('Merge ignores bundled dj/fee inside statusMerge seed', JSON.stringify(cedric));
  }

  if (priorRec == null) await req('DELETE', snapPath);
  else await req('PUT', snapPath, priorRec);
  pass('Cleanup restored prior Firebase row', priorRec ? 'restored' : 'deleted test data');

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  if (failed.length) {
    failed.forEach((f) => console.error(' - ' + f.name + ': ' + f.detail));
    process.exit(1);
  }
  console.log('DJ status changes never alter DJ name or fee (Firebase + full apply path).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
