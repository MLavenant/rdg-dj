#!/usr/bin/env node
/**
 * Compare calendar display fields: production apply vs local apply (v5.0 ship).
 * Uses live Firebase + sched-baked.js. Read-only — does not write Firebase.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const DISPLAY_FIELDS = ['dj', 'fee', 'cost', 'djStatus', 'agency', 'vipNote', 'ev', 'note', 'bs_m'];

function get(p) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: HOST, path: p, timeout: 60000 }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try { resolve(JSON.parse(b || 'null')); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function oldEnsureShowUid(rec) {
  if (!rec) return '';
  if (rec._uid) return rec._uid;
  if (rec._added) {
    rec._uid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    return rec._uid;
  }
  const base = [rec.venue || rec.v || '', rec.d || '', rec.dj || '', String(rec.fee != null ? rec.fee : rec.cost != null ? rec.cost : '')].join('|');
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = (h * 16777619) >>> 0; }
  rec._uid = 's_' + h.toString(36) + '_' + String(rec.d || '').replace(/-/g, '');
  return rec._uid;
}

function nightKey(r) {
  if (!r || !r.d) return '';
  return (r.v || r.venue || '') + '|' + r.d;
}

function nightLiveAuthority(edit) {
  if (!edit) return 0;
  let s = 0;
  const kind = edit._writeKind || '';
  if (kind === 'modal' || kind === 'evClear') s += 1000;
  else if (kind === 'statusMerge' || kind === 'djStatus') s += 10;
  else if (kind === 'vipNote' || kind === 'vip' || kind === 'agency') s += 5;
  if (edit.dj != null && String(edit.dj).trim() !== '') s += 100;
  if (edit.fee != null || edit.cost != null) s += 50;
  if (edit.djStatus) s += 5;
  return s;
}

function showScore(r) {
  if (!r) return -1;
  let score = 0;
  if (r.djStatus) score += 40;
  if (r.dj && String(r.dj).trim() && String(r.dj).toUpperCase() !== 'TBD') score += 20;
  if (r.fee != null || r.cost != null) score += 10;
  if (r.note) score += 3;
  if (r.vipNote) score += 2;
  if (r.ev) score += 2;
  if (!r._added) score += 15;
  return score;
}

function mergeDupFields(keep, lose) {
  if (!keep || !lose) return;
  const loseModal = lose._writeKind === 'modal' || lose._writeKind === 'evClear';
  if (loseModal || (lose._added && lose.dj && String(lose.dj).trim() !== '')) {
    if (lose.dj != null) keep.dj = lose.dj;
    if (lose.fee != null || lose.cost != null) {
      keep.fee = lose.fee != null ? lose.fee : lose.cost;
      keep.cost = lose.cost != null ? lose.cost : lose.fee;
    }
  } else {
    if ((!keep.dj || String(keep.dj).toUpperCase() === 'TBD') && lose.dj) keep.dj = lose.dj;
    if (keep.fee == null && keep.cost == null && (lose.fee != null || lose.cost != null)) {
      keep.fee = lose.fee != null ? lose.fee : lose.cost;
      keep.cost = lose.cost != null ? lose.cost : lose.fee;
    }
  }
  if (!keep.djStatus && lose.djStatus) keep.djStatus = lose.djStatus;
  if (!keep.note && lose.note) keep.note = lose.note;
  if (!keep.vipNote && lose.vipNote) keep.vipNote = lose.vipNote;
  if (!keep.agency && lose.agency) keep.agency = lose.agency;
  if (!keep.ev && lose.ev) keep.ev = lose.ev;
}

function dedupeSchedOnePerNight(s) {
  if (!s || !s.length) return s;
  const bestIdx = {};
  const dropUid = {};
  for (let i = 0; i < s.length; i++) {
    const r = s[i];
    if (!r || !r.d || r._s === 'empty') continue;
    const k = nightKey(r);
    if (!k) continue;
    if (bestIdx[k] == null) { bestIdx[k] = i; continue; }
    const a = s[bestIdx[k]], b = r;
    const keep = showScore(b) > showScore(a) ? b : a;
    const lose = keep === a ? b : a;
    mergeDupFields(keep, lose);
    if (keep === b) bestIdx[k] = i;
    if (lose._uid) dropUid[lose._uid] = lose;
  }
  return s.filter((r) => !(r && r._uid && dropUid[r._uid]));
}

function mergeSchedEditProd(target, edit) {
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
    if (target._writeKind === 'djStatus') target._writeKind = 'modal';
    if (target.v && !target.venue) target.venue = target.v;
    if (target.venue && !target.v) target.v = target.venue;
    return;
  }
  if (kind === 'statusMerge' || kind === 'djStatus') {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    return;
  }
  const hasDj = edit.dj != null && String(edit.dj).trim() !== '';
  const hasFee = edit.fee != null || edit.cost != null;
  if (!hasDj && !hasFee) {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    if (Object.prototype.hasOwnProperty.call(edit, 'ev')) target.ev = edit.ev == null ? '' : edit.ev;
    if (Object.prototype.hasOwnProperty.call(edit, 'note')) target.note = edit.note == null ? null : edit.note;
    if (Object.prototype.hasOwnProperty.call(edit, 'vipNote')) target.vipNote = edit.vipNote == null ? null : edit.vipNote;
    if (Object.prototype.hasOwnProperty.call(edit, 'agency')) target.agency = edit.agency == null ? null : edit.agency;
    return;
  }
  Object.assign(target, edit);
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
    if (target._writeKind === 'djStatus') target._writeKind = 'modal';
    if (target.v && !target.venue) target.venue = target.v;
    if (target.venue && !target.v) target.v = target.venue;
    return;
  }
  if (kind === 'statusMerge' || kind === 'djStatus') {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    return;
  }
  const hasDj = edit.dj != null && String(edit.dj).trim() !== '';
  const hasFee = edit.fee != null || edit.cost != null;
  if (!hasDj && !hasFee) {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    if (Object.prototype.hasOwnProperty.call(edit, 'ev')) target.ev = edit.ev == null ? '' : edit.ev;
    if (Object.prototype.hasOwnProperty.call(edit, 'note')) target.note = edit.note == null ? null : edit.note;
    if (Object.prototype.hasOwnProperty.call(edit, 'vipNote')) target.vipNote = edit.vipNote == null ? null : edit.vipNote;
    if (Object.prototype.hasOwnProperty.call(edit, 'agency')) target.agency = edit.agency == null ? null : edit.agency;
    return;
  }
  Object.assign(target, edit);
}

function applyWorkbook(baked, ov, mode) {
  const merge = mode === 'local' ? mergeSchedEditLocal : mergeSchedEditProd;
  const s = baked.map((r) => { const c = Object.assign({}, r); oldEnsureShowUid(c); return c; });
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  if (!workbookUids.length) return s;

  const delsWRaw = ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const delsW = delsWRaw.filter((dk) => dk && String(dk).split('|').length >= 3);

  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit) return;
    let dead = false;
    for (let di0 = 0; di0 < delsW.length; di0++) {
      const p0 = String(delsW[di0] || '').split('|');
      if (delsW[di0] === ((edit.v || edit.venue || '') + '|' + (edit.d || '') + '|' + uid) || (p0.length >= 3 && p0[2] === uid)) {
        dead = true; break;
      }
    }
    if (dead) return;

    const idx = s.findIndex((r) => r && String(r._uid || '') === String(uid));
    if (idx >= 0) {
      let editN = edit;
      if (mode === 'local' && !editN._writeKind && ((editN.dj != null && String(editN.dj).trim() !== '') || editN.fee != null || editN.cost != null)) {
        editN = Object.assign({}, editN, { _writeKind: 'modal' });
      }
      merge(s[idx], editN);
      s[idx]._uid = uid;
      oldEnsureShowUid(s[idx]);
      return;
    }
    let row = Object.assign({}, edit, { _uid: uid });
    if (mode === 'local' && !row._writeKind && ((row.dj != null && String(row.dj).trim() !== '') || row.fee != null || row.cost != null)) {
      row._writeKind = 'modal';
    }
    oldEnsureShowUid(row);
    const night = nightKey(row);
    const occupied = night ? s.filter((x) => x && nightKey(x) === night) : [];
    if (occupied.length) {
      merge(occupied[0], row);
      if (mode === 'local') {
        occupied[0]._uid = uid;
        occupied[0]._added = 0;
      }
    } else {
      row._added = 1;
      s.push(row);
    }
  });

  if (mode === 'local') {
    const liveByNight = {};
    workbookUids.forEach((uid) => {
      const edit = workbook[uid];
      if (!edit || !edit.d) return;
      let dead = false;
      for (let di0 = 0; di0 < delsW.length; di0++) {
        const p0 = String(delsW[di0] || '').split('|');
        if (delsW[di0] === ((edit.v || edit.venue || '') + '|' + (edit.d || '') + '|' + uid) || (p0.length >= 3 && p0[2] === uid)) {
          dead = true; break;
        }
      }
      if (dead) return;
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
        merge(hits[0], edit);
        hits[0]._uid = pack.uid;
        hits[0]._added = 0;
      } else {
        edit._added = 1;
        s.push(edit);
      }
    });
  }

  const filtered = s.filter((r) => {
    if (!r) return false;
    for (let di = 0; di < delsW.length; di++) {
      const p = String(delsW[di] || '').split('|');
      const uidKey = (r.v || r.venue || '') + '|' + (r.d || '') + '|' + (r._uid || '');
      if (uidKey === delsW[di] || (p.length >= 3 && p[2] === r._uid)) return false;
    }
    return true;
  });
  return dedupeSchedOnePerNight(filtered);
}

function displayRow(r) {
  const o = { night: nightKey(r) };
  DISPLAY_FIELDS.forEach((f) => { o[f] = r[f] == null ? null : r[f]; });
  if (o.fee == null && o.cost != null) o.fee = o.cost;
  return o;
}

function norm(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return Number(v);
  return String(v).trim();
}

(async function main() {
  const bakeFile = fs.readFileSync(path.join(__dirname, '..', 'data', 'sched-baked.js'), 'utf8');
  const m = bakeFile.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error('Could not parse SCHED bake');
  const baked = JSON.parse(m[1]);
  const ov = await get('/rdg/schedOverrides.json');

  const prod = applyWorkbook(baked, ov, 'prod');
  const local = applyWorkbook(baked, ov, 'local');

  const prodMap = {};
  prod.forEach((r) => { if (r && r.d) prodMap[nightKey(r)] = displayRow(r); });
  const localMap = {};
  local.forEach((r) => { if (r && r.d) localMap[nightKey(r)] = displayRow(r); });

  const allNights = new Set([...Object.keys(prodMap), ...Object.keys(localMap)]);
  const diffs = [];
  allNights.forEach((nk) => {
    const a = prodMap[nk];
    const b = localMap[nk];
    if (!a || !b) {
      diffs.push({ night: nk, kind: 'missing', prod: a || null, local: b || null });
      return;
    }
    const fieldDiffs = [];
    DISPLAY_FIELDS.forEach((f) => {
      if (norm(a[f]) !== norm(b[f])) fieldDiffs.push({ field: f, prod: a[f], local: b[f] });
    });
    if (fieldDiffs.length) diffs.push({ night: nk, fields: fieldDiffs });
  });

  const coreVenues = { 'Casa Neos Beach Club': 1, 'Casa Neos Lounge': 1, 'MILA Lounge': 1 };
  const coreDiffs = diffs.filter((d) => {
    const v = String(d.night).split('|')[0];
    const y = String(d.night).split('|')[1] || '';
    return coreVenues[v] && (y.startsWith('2026') || y.startsWith('2027'));
  });

  console.log('=== Calendar display parity: shipped apply vs local ===\n');
  console.log('Baked rows:', baked.length);
  console.log('Production nights after apply:', Object.keys(prodMap).length);
  console.log('Local nights after apply:', Object.keys(localMap).length);
  console.log('Total display diffs:', diffs.length);
  console.log('Core 3-venue 2026-2027 diffs:', coreDiffs.length);

  if (coreDiffs.length) {
    console.log('\n--- CORE VENUE DIFFERENCES (would change what you see) ---');
    coreDiffs.slice(0, 40).forEach((d) => {
      console.log('\n' + d.night);
      if (d.kind === 'missing') {
        console.log('  MISSING:', JSON.stringify({ prod: d.prod, local: d.local }));
      } else {
        d.fields.forEach((f) => console.log('  ' + f.field + ': prod=' + JSON.stringify(f.prod) + ' local=' + JSON.stringify(f.local)));
      }
    });
    if (coreDiffs.length > 40) console.log('\n... +' + (coreDiffs.length - 40) + ' more');
    process.exit(1);
  }

  console.log('\nPASS — every DJ name, fee, status, VIP, agency, ev, note matches production for 2026-2027 core venues.');
  if (diffs.length) {
    console.log('Note: ' + diffs.length + ' diff(s) outside core 3-venue 2026-2027 scope (ignored for gate).');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
