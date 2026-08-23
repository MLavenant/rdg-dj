#!/usr/bin/env node
/**
 * One-time remigration: collapse schedOverrides/shows to stable venue|date UIDs.
 *
 * Default: dry-run only (writes plan under _local/, does NOT mutate Firebase).
 * Apply:   node scripts/remigrate-shows-stable-uids.js --apply
 *
 * Does NOT git commit/push. Touches Firebase only with --apply.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const APPLY = process.argv.includes('--apply');
const VENUES = {
  'Casa Neos Beach Club': 1,
  'Casa Neos Lounge': 1,
  'MILA Lounge': 1
};

function req(method, p, body) {
  return new Promise(function (resolve, reject) {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = https.request(
      {
        hostname: HOST,
        path: p,
        method: method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {},
        timeout: 120000
      },
      function (res) {
        let b = '';
        res.on('data', function (d) { b += d; });
        res.on('end', function () {
          let json = null;
          try { json = JSON.parse(b || 'null'); } catch (e) {}
          resolve({ status: res.statusCode, json: json, raw: b });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

/** Same algorithm as js/fiscal.js ensureShowUid for non-_added rows. */
function stableUid(venue, d) {
  const base = [venue || '', d || ''].join('|');
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return 's_' + h.toString(36) + '_' + String(d || '').replace(/-/g, '');
}

function nightKey(r) {
  return (r.v || r.venue || '') + '|' + (r.d || '');
}

function score(r) {
  let s = 0;
  const kind = r._writeKind || '';
  if (kind === 'modal' || kind === 'evClear') s += 100;
  if (r.dj && String(r.dj).trim() && String(r.dj).toUpperCase() !== 'TBD') s += 40;
  if (r.fee != null || r.cost != null) s += 20;
  if (r.djStatus) s += 10;
  if (r.updatedAt) s += Math.min(9, Math.floor((Date.parse(r.updatedAt) || 0) / 1e12));
  return s;
}

function mergeKeep(keep, lose) {
  const out = Object.assign({}, lose, keep);
  if (!out.djStatus && lose.djStatus) out.djStatus = lose.djStatus;
  if (!out.agency && lose.agency) out.agency = lose.agency;
  if (!out.vipNote && lose.vipNote) out.vipNote = lose.vipNote;
  if ((out.dj == null || String(out.dj).trim() === '') && lose.dj) out.dj = lose.dj;
  if (out.fee == null && out.cost == null) {
    out.fee = lose.fee != null ? lose.fee : lose.cost;
    out.cost = lose.cost != null ? lose.cost : lose.fee;
  }
  const kt = Date.parse(keep.updatedAt || '') || 0;
  const lt = Date.parse(lose.updatedAt || '') || 0;
  if (lt > kt) out.updatedAt = lose.updatedAt;
  return out;
}

(async function main() {
  const outDir = path.join(__dirname, '..', '_local');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const ov = (await req('GET', '/rdg/schedOverrides.json')).json || {};
  const shows = ov.shows && typeof ov.shows === 'object' ? ov.shows : {};
  const backupPath = path.join(outDir, 'shows-backup-before-remigrate-' + stamp + '.json');
  fs.writeFileSync(backupPath, JSON.stringify(shows, null, 2));

  const byNight = {};
  Object.keys(shows).forEach(function (uid) {
    const r = shows[uid];
    if (!r || !r.d) return;
    const y = String(r.d).slice(0, 4);
    if (y !== '2026' && y !== '2027') return;
    const v = r.v || r.venue || '';
    if (!VENUES[v]) return;
    const nk = nightKey(r);
    if (!byNight[nk]) byNight[nk] = [];
    byNight[nk].push({ uid: uid, row: r });
  });

  const nextShows = Object.assign({}, shows); // start from full map, rewrite 3-venue nights
  const plan = [];
  let collisions = 0;
  let remapped = 0;
  let alreadyStable = 0;

  Object.keys(byNight).forEach(function (nk) {
    const group = byNight[nk];
    group.sort(function (a, b) { return score(b.row) - score(a.row); });
    let keep = Object.assign({}, group[0].row);
    const dropUids = [];
    for (let i = 1; i < group.length; i++) {
      keep = mergeKeep(keep, group[i].row);
      dropUids.push(group[i].uid);
      collisions++;
    }
    const venue = keep.v || keep.venue || '';
    const stable = stableUid(venue, keep.d);
    keep._uid = stable;
    keep.v = venue;
    keep.venue = venue;
    if (!keep._writeKind && ((keep.dj && String(keep.dj).trim()) || keep.fee != null || keep.cost != null)) {
      keep._writeKind = 'modal';
    }
    keep.remigratedAt = new Date().toISOString();

    const oldKeepUid = group[0].uid;
    plan.push({
      night: nk,
      stableUid: stable,
      fromUids: group.map(function (g) { return g.uid; }),
      dropUids: dropUids.concat(oldKeepUid !== stable ? [oldKeepUid] : []).filter(function (u, i, a) {
        return u !== stable && a.indexOf(u) === i;
      }),
      dj: keep.dj || '',
      fee: keep.fee != null ? keep.fee : keep.cost,
      djStatus: keep.djStatus || null,
      alreadyStable: oldKeepUid === stable && dropUids.length === 0
    });

    if (oldKeepUid === stable && dropUids.length === 0) {
      alreadyStable++;
      nextShows[stable] = Object.assign({}, shows[stable], { _uid: stable, v: venue, venue: venue });
      return;
    }
    remapped++;
    // remove all old keys for this night (3 venues scope only)
    group.forEach(function (g) { delete nextShows[g.uid]; });
    nextShows[stable] = keep;
  });

  const planPath = path.join(outDir, 'remigrate-plan-' + stamp + '.json');
  fs.writeFileSync(planPath, JSON.stringify({
    savedAt: new Date().toISOString(),
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    backupPath: backupPath,
    nights: plan.length,
    remapped: remapped,
    alreadyStable: alreadyStable,
    collisionsCollapsed: collisions,
    plan: plan
  }, null, 2));

  // Spotlight nights that caused complaints
  const spot = plan.filter(function (p) {
    return /2026-10-08\|MILA|2026-10-10\|Casa Neos Beach|GUY|GERBER/i.test(
      p.night + '|' + (p.dj || '')
    ) || /2026-10-08/.test(p.night) || /2026-10-10/.test(p.night);
  });

  console.log('Backup →', backupPath);
  console.log('Plan   →', planPath);
  console.log('Nights:', plan.length, '| remapped:', remapped, '| already stable:', alreadyStable, '| collapsed dupes:', collisions);
  console.log('Spotlight:', JSON.stringify(spot, null, 2));

  if (!APPLY) {
    console.log('\nDRY-RUN only. Re-run with --apply to write Firebase shows map.');
    return;
  }

  // Full shows map PUT — safest for atomic remapping of 3-venue nights while preserving other keys
  const put = await req('PUT', '/rdg/schedOverrides/shows.json', nextShows);
  console.log('PUT /rdg/schedOverrides/shows.json →', put.status);
  if (put.status < 200 || put.status >= 300) {
    console.error('APPLY FAILED', put.status, put.raw && put.raw.slice(0, 300));
    process.exit(1);
  }
  const verify = (await req('GET', '/rdg/schedOverrides/shows.json')).json || {};
  const verifyPath = path.join(outDir, 'shows-after-remigrate-' + stamp + '.json');
  fs.writeFileSync(verifyPath, JSON.stringify(verify, null, 2));
  console.log('Verified →', verifyPath, 'keys:', Object.keys(verify).length);
  console.log('APPLY complete.');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
