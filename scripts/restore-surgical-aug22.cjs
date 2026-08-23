/**
 * Surgical Firebase restore after local E2E damaged production schedOverrides.
 * - Restores missing/tombstoned shows from post-remigrate baseline (Aug 21)
 * - Removes test duplicate UIDs and E2E tombstones
 * - Keeps legitimate live edits (shows that differ from baseline but still exist)
 *
 * Usage: CONFIRM=YES node scripts/restore-surgical-aug22.cjs
 */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

if (process.env.CONFIRM !== 'YES') {
  console.error('Refusing without CONFIRM=YES');
  console.error('Usage: CONFIRM=YES node scripts/restore-surgical-aug22.cjs');
  process.exit(1);
}

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const BASELINE_SHOWS = path.join(
  __dirname,
  '..',
  '_local',
  'shows-after-remigrate-2026-08-21T21-29-59-980Z.json'
);
const BASELINE_OV = path.join(
  __dirname,
  '..',
  '_local',
  'schedOverrides-snapshot-2026-08-21T20-24-49-229Z.json'
);

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = https.request(
      {
        hostname: HOST,
        path: p,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(b || 'null');
          } catch (e) {
            json = null;
          }
          resolve({ status: res.statusCode, json, body: b });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function asDeleteList(deletes) {
  if (!deletes) return [];
  if (Array.isArray(deletes)) return deletes.map(String);
  return Object.values(deletes).map(String);
}

(async () => {
  const baselineRaw = JSON.parse(fs.readFileSync(BASELINE_SHOWS, 'utf8'));
  const baselineOv = JSON.parse(fs.readFileSync(BASELINE_OV, 'utf8'));
  const baselineShows = baselineRaw.shows || baselineRaw;
  const baselineDeletes = asDeleteList(baselineOv.deletes);

  const curRes = await req('GET', '/rdg/schedOverrides.json');
  if (curRes.status !== 200 || !curRes.json) {
    console.error('Failed to read schedOverrides', curRes.status);
    process.exit(1);
  }
  const current = curRes.json;
  const shows = Object.assign({}, current.shows || {});
  const curDeletes = asDeleteList(current.deletes);

  const restored = [];
  const removed = [];

  Object.keys(baselineShows).forEach((uid) => {
    if (!shows[uid]) {
      shows[uid] = baselineShows[uid];
      restored.push(uid);
    }
  });

  Object.keys(shows).forEach((uid) => {
    if (!baselineShows[uid]) {
      removed.push(uid);
      delete shows[uid];
    }
  });

  const nextDeletes = baselineDeletes.slice();

  const next = Object.assign({}, current, {
    shows,
    deletes: nextDeletes
  });

  const outDir = path.join(__dirname, '..', '_local');
  fs.mkdirSync(outDir, { recursive: true });
  const planPath = path.join(outDir, 'restore-surgical-plan-' + Date.now() + '.json');
  fs.writeFileSync(
    planPath,
    JSON.stringify(
      {
        restored,
        removed,
        deletesBefore: curDeletes.length,
        deletesAfter: nextDeletes.length,
        guyBC: shows['s_1gig7qw_20261010'],
        guyMILA: shows['s_1o1pm6c_20261008']
      },
      null,
      2
    )
  );

  const put = await req('PUT', '/rdg/schedOverrides.json', next);
  if (put.status !== 200) {
    console.error('Restore PUT failed', put.status, put.body);
    process.exit(1);
  }

  console.log('Surgical restore OK');
  console.log('Plan:', planPath);
  console.log('Restored shows:', restored.length, restored);
  console.log('Removed extra/test shows:', removed.length, removed);
  console.log('Deletes:', curDeletes.length, '→', nextDeletes.length);
  console.log('Guy Gerber BC Oct 10:', shows['s_1gig7qw_20261010']?.dj, shows['s_1gig7qw_20261010']?.fee);
  console.log('Guy Gerber MILA Oct 8:', shows['s_1o1pm6c_20261008']?.dj, shows['s_1o1pm6c_20261008']?.fee);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
