#!/usr/bin/env node
/**
 * Local-only snapshot of live Firebase schedule (SoT).
 * Does NOT commit or push. Writes under _local/ (gitignored).
 *
 * Run: node scripts/snapshot-live-schedule.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const VENUES = {
  'Casa Neos Beach Club': 1,
  'Casa Neos Lounge': 1,
  'MILA Lounge': 1
};

function get(p){
  return new Promise(function(resolve, reject){
    https.get({ hostname: HOST, path: p, timeout: 60000 }, function(res){
      let b = '';
      res.on('data', function(d){ b += d; });
      res.on('end', function(){
        try{ resolve(JSON.parse(b || 'null')); }
        catch(e){ reject(e); }
      });
    }).on('error', reject);
  });
}

function venueOf(row){
  return (row && (row.venue || row.v)) || '';
}

(async function main(){
  const outDir = path.join(__dirname, '..', '_local');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ov = await get('/rdg/schedOverrides.json');
  const shows = (ov && ov.shows) || {};
  const rows = [];
  Object.keys(shows).forEach(function(uid){
    const r = shows[uid];
    if(!r || !r.d) return;
    const y = String(r.d).slice(0, 4);
    if(y !== '2026' && y !== '2027') return;
    const v = venueOf(r);
    if(!VENUES[v]) return;
    rows.push({
      uid: uid,
      d: r.d,
      venue: v,
      dj: r.dj || '',
      fee: r.fee != null ? r.fee : r.cost,
      cost: r.cost != null ? r.cost : r.fee,
      djStatus: r.djStatus || null,
      agency: r.agency || null,
      vipNote: r.vipNote || null,
      bs_m: r.bs_m != null ? r.bs_m : null,
      ev: r.ev || '',
      _writeKind: r._writeKind || null,
      updatedAt: r.updatedAt || null
    });
  });
  rows.sort(function(a, b){
    return String(a.d).localeCompare(b.d) || String(a.venue).localeCompare(b.venue);
  });

  const fullPath = path.join(outDir, 'schedOverrides-snapshot-' + stamp + '.json');
  const slimPath = path.join(outDir, 'schedule-2026-2027-3venues-' + stamp + '.json');
  const latestSlim = path.join(outDir, 'schedule-2026-2027-3venues-LATEST.json');
  const latestFull = path.join(outDir, 'schedOverrides-LATEST.json');

  fs.writeFileSync(fullPath, JSON.stringify(ov, null, 2));
  fs.writeFileSync(latestFull, JSON.stringify(ov, null, 2));
  fs.writeFileSync(slimPath, JSON.stringify({
    savedAt: new Date().toISOString(),
    source: 'Firebase rdg/schedOverrides/shows',
    note: 'Live calendar SoT for 2026–2027 / 3 venues. Bake is not authority.',
    count: rows.length,
    rows: rows
  }, null, 2));
  fs.writeFileSync(latestSlim, JSON.stringify({
    savedAt: new Date().toISOString(),
    count: rows.length,
    rows: rows
  }, null, 2));

  const oct8 = rows.filter(function(r){ return r.d === '2026-10-08' && r.venue === 'MILA Lounge'; });
  const oct10 = rows.filter(function(r){ return r.d === '2026-10-10' && r.venue === 'Casa Neos Beach Club'; });
  console.log('Snapshot OK →', outDir);
  console.log('2026–2027 / 3 venues rows:', rows.length);
  console.log('Oct 8 MILA:', JSON.stringify(oct8));
  console.log('Oct 10 Beach Club:', JSON.stringify(oct10));
})().catch(function(err){
  console.error('Snapshot failed', err);
  process.exit(1);
});
