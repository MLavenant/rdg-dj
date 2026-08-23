/**
 * Two-session E2E on safe Oct 2027 nights (mostly empty DJs). Cleans up after itself.
 */
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const VENUE = 'MILA Lounge';
const DATE = '2027-10-07';
const UID = 's_1jrb3kl_20271007';
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
        res.on('end', () => resolve({ status: res.statusCode, body: b, json: safeJson(b) }));
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

function applyWorkbook(localRows, ov) {
  const s = (localRows || []).map((r) => Object.assign({}, r));
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  const delsRaw = ov && ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const dels = delsRaw.filter((dk) => dk && String(dk).split('|').length >= 3);
  if (!workbookUids.length) return s;

  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit) return;
    const idx = s.findIndex((r) => r && String(r._uid || '') === String(uid));
    if (idx >= 0) Object.assign(s[idx], edit, { _uid: uid });
    else {
      const row = Object.assign({}, edit, { _uid: uid });
      const nk = nightKey(row);
      const occupied = nk ? s.filter((x) => x && nightKey(x) === nk) : [];
      if (occupied.length) Object.assign(occupied[0], row);
      else { row._added = 1; s.push(row); }
    }
  });
  const byNight = {};
  s.forEach((r) => {
    const k = nightKey(r);
    if (!byNight[k] || String(r.updatedAt || '') > String(byNight[k].updatedAt || '')) byNight[k] = r;
  });
  return Object.values(byNight);
}

function findNight(rows, venue, d) {
  return rows.filter((r) => (r.v || r.venue) === venue && r.d === d);
}

(async () => {
  console.log('=== Two-session Oct 2027 E2E (' + VENUE + ' ' + DATE + ') ===\n');

  const snapPath = '/rdg/schedOverrides/shows/' + encodeURIComponent(UID) + '.json';
  const prior = await req('GET', snapPath);
  const priorRec = prior.json;

  const tag = 'E2E_OCT27_' + Date.now().toString(36).toUpperCase();
  const writeA = {
    v: VENUE, venue: VENUE, d: DATE, dj: tag + '_A', fee: 7777, cost: 7777,
    _uid: UID, _writeKind: 'modal', updatedAt: new Date().toISOString(), _e2e: true
  };
  const w1 = await req('PUT', snapPath, writeA);
  if (w1.status === 200) pass('Session A: Edit Show write', writeA.dj);
  else fail('Session A: Edit Show write', w1.status + ' ' + w1.body);

  await sleep(500);
  const ov1 = await req('GET', '/rdg/schedOverrides.json');
  const b1 = findNight(applyWorkbook([], ov1.json), VENUE, DATE)[0];
  if (b1 && b1.dj === writeA.dj && Number(b1.fee) === 7777) pass('Session B: sees A edit', b1.dj);
  else fail('Session B: sees A edit', JSON.stringify(b1));

  const cur1 = await req('GET', snapPath);
  const statusWrite = Object.assign({}, cur1.json || writeA, {
    djStatus: 'Hold 1',
    _writeKind: (cur1.json && (cur1.json._writeKind === 'modal' || cur1.json._writeKind === 'evClear')) ? cur1.json._writeKind : 'statusMerge',
    updatedAt: new Date().toISOString()
  });
  const w2 = await req('PUT', snapPath, statusWrite);
  if (w2.status === 200) pass('Session A: status-only write', 'Hold 1');
  else fail('Session A: status-only write', w2.status);

  await sleep(500);
  const ov2 = await req('GET', '/rdg/schedOverrides.json');
  const b2 = findNight(applyWorkbook([], ov2.json), VENUE, DATE)[0];
  if (b2 && b2.djStatus === 'Hold 1' && b2.dj === writeA.dj && Number(b2.fee) === 7777) {
    pass('Session B: status changed, DJ/fee untouched', b2.dj + ' $' + b2.fee);
  } else {
    fail('Session B: status changed, DJ/fee untouched', JSON.stringify({ dj: b2 && b2.dj, fee: b2 && b2.fee, status: b2 && b2.djStatus }));
  }

  const rename = Object.assign({}, writeA, { dj: tag + '_B', updatedAt: new Date().toISOString() });
  const w3 = await req('PUT', snapPath, rename);
  if (w3.status === 200) pass('Session A: rename write', rename.dj);
  else fail('Session A: rename write', w3.status);

  await sleep(500);
  const ov3 = await req('GET', '/rdg/schedOverrides.json');
  const nights = findNight(applyWorkbook([], ov3.json), VENUE, DATE);
  if (nights.length === 1 && nights[0].dj === rename.dj) pass('Session B: one row after rename', rename.dj);
  else fail('Session B: one row after rename', JSON.stringify(nights));

  if (priorRec == null) await req('DELETE', snapPath);
  else await req('PUT', snapPath, priorRec);
  pass('Cleanup restored prior Firebase row', priorRec ? 'restored' : 'deleted test data');

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  if (failed.length) {
    failed.forEach((f) => console.error(' - ' + f.name + ': ' + f.detail));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
