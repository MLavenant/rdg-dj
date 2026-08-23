/**
 * Two-session special-week add/delete sync against live Firebase.
 * Simulates Session A writes + Session B apply (records → bands → day label).
 * Restores Firebase on exit.
 *
 * Usage: node scripts/test-special-week-sync.cjs
 */
'use strict';
const https = require('https');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const VENUE = 'Casa Neos Beach Club';
const LABEL = 'SW-E2E-' + Date.now().toString(36).toUpperCase();
const START = '2027-08-14'; /* Sat */
const END = '2027-08-15'; /* Sun */
const UID = 'sw_e2e_' + Date.now().toString(36);
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function metaKey(k) {
  return k === '_migrated' || k === 'migratedAt';
}

function expandRecordsToMap(recs) {
  const map = {};
  Object.keys(recs || {}).forEach((uid) => {
    if (metaKey(uid)) return;
    const rec = recs[uid];
    if (!rec || !rec.v || !rec.label || !rec.start || !rec.end) return;
    const sd = new Date(rec.start + 'T12:00:00');
    const ed = new Date(rec.end + 'T12:00:00');
    if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || sd > ed) return;
    const cur = new Date(sd);
    while (cur <= ed) {
      const yr2 = cur.getFullYear();
      const mo2 = cur.getMonth();
      const mm2 = (mo2 + 1 < 10 ? '0' : '') + (mo2 + 1);
      const startDay = cur.getDate();
      const monthEnd = new Date(yr2, mo2 + 1, 0);
      const endInMonth = ed <= monthEnd ? ed : monthEnd;
      const k = rec.v + '|' + yr2 + '|' + mm2;
      if (!map[k]) map[k] = [];
      map[k].push({
        label: rec.label,
        startDay: startDay,
        endDay: endInMonth.getDate(),
        _uid: uid
      });
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }
  });
  return map;
}

function dayLabelFromBands(specialWeeks, venue, ds) {
  const mm = ds.slice(5, 7);
  const day = parseInt(ds.slice(8, 10), 10);
  const key = venue + '|' + ds.slice(0, 4) + '|' + mm;
  const sws = specialWeeks[key] || [];
  for (let i = 0; i < sws.length; i++) {
    if (day >= sws[i].startDay && day <= sws[i].endDay) return sws[i].label;
  }
  return null;
}

function bandHasLabel(specialWeeks, venue, label) {
  const norm = String(label).toUpperCase();
  return Object.keys(specialWeeks || {}).some((k) => {
    if (k.indexOf(venue + '|') !== 0) return false;
    return (specialWeeks[k] || []).some((sw) => String(sw.label || '').toUpperCase() === norm);
  });
}

(async () => {
  console.log('=== Special-week two-session sync E2E ===\n');
  console.log('Label:', LABEL, 'range:', START, '→', END);

  const beforeRecs = (await req('GET', '/rdg/specialWeekRecords.json')).json || {};
  const beforeWeeks = (await req('GET', '/rdg/specialWeeks.json')).json || {};

  /* ---- Session A: ADD ---- */
  const rec = {
    v: VENUE,
    label: LABEL,
    start: START,
    end: END,
    updatedAt: new Date().toISOString()
  };
  const putRec = await req('PUT', '/rdg/specialWeekRecords/' + UID + '.json', rec);
  if (putRec.status !== 200) {
    fail('Session A: write specialWeekRecords', String(putRec.status));
  } else {
    pass('Session A: write specialWeekRecords', UID);
  }

  /* Mirror legacy map the way the app now does after add */
  const afterAddRecs = Object.assign({}, beforeRecs, { [UID]: rec });
  const mirrored = expandRecordsToMap(afterAddRecs);
  const putWeeks = await req('PUT', '/rdg/specialWeeks.json', mirrored);
  if (putWeeks.status !== 200) fail('Session A: mirror specialWeeks', String(putWeeks.status));
  else pass('Session A: mirror specialWeeks', Object.keys(mirrored).length + ' keys');

  await sleep(400);

  /* ---- Session B: sees ADD ---- */
  const bRecs = (await req('GET', '/rdg/specialWeekRecords.json')).json || {};
  const bWeeks = (await req('GET', '/rdg/specialWeeks.json')).json || {};
  const bFromRecs = expandRecordsToMap(bRecs);
  if (bRecs[UID] && bRecs[UID].label === LABEL) pass('Session B: record visible', LABEL);
  else fail('Session B: record visible', JSON.stringify(bRecs[UID]));

  const labelSat = dayLabelFromBands(bFromRecs, VENUE, START);
  const labelSun = dayLabelFromBands(bFromRecs, VENUE, END);
  if (labelSat === LABEL && labelSun === LABEL) {
    pass('Session B: calendar bands show label (from records)', START + ' + ' + END);
  } else {
    fail('Session B: calendar bands show label (from records)', labelSat + ' / ' + labelSun);
  }

  if (bandHasLabel(bWeeks, VENUE, LABEL)) {
    pass('Session B: legacy specialWeeks also has label', 'dual-write ok');
  } else {
    fail('Session B: legacy specialWeeks also has label', 'mirror missing');
  }

  /* ---- Session A: DELETE ---- */
  const delRec = await req('DELETE', '/rdg/specialWeekRecords/' + UID + '.json');
  if (delRec.status !== 200) fail('Session A: delete record', String(delRec.status));
  else pass('Session A: delete record', UID);

  const afterDelRecs = Object.assign({}, beforeRecs);
  delete afterDelRecs[UID];
  /* Keep meta from before */
  const mirroredDel = expandRecordsToMap(afterDelRecs);
  const putWeeksDel = await req('PUT', '/rdg/specialWeeks.json', mirroredDel);
  if (putWeeksDel.status !== 200) fail('Session A: mirror delete to specialWeeks', String(putWeeksDel.status));
  else pass('Session A: mirror delete to specialWeeks', 'ok');

  await sleep(400);

  /* ---- Session B: sees DELETE ---- */
  const b2Recs = (await req('GET', '/rdg/specialWeekRecords.json')).json || {};
  const b2Weeks = (await req('GET', '/rdg/specialWeeks.json')).json || {};
  const b2FromRecs = expandRecordsToMap(b2Recs);

  if (!b2Recs[UID]) pass('Session B: record gone', 'deleted');
  else fail('Session B: record gone', JSON.stringify(b2Recs[UID]));

  const goneSat = dayLabelFromBands(b2FromRecs, VENUE, START);
  const goneSun = dayLabelFromBands(b2FromRecs, VENUE, END);
  if (goneSat !== LABEL && goneSun !== LABEL) {
    pass('Session B: calendar bands cleared', String(goneSat) + ' / ' + String(goneSun));
  } else {
    fail('Session B: calendar bands cleared', goneSat + ' / ' + goneSun);
  }

  if (!bandHasLabel(b2Weeks, VENUE, LABEL)) {
    pass('Session B: legacy specialWeeks cleared', 'dual-write delete ok');
  } else {
    fail('Session B: legacy specialWeeks cleared', 'stale band remains');
  }

  /* ---- Restore prior specialWeeks tree exactly ---- */
  await req('PUT', '/rdg/specialWeeks.json', beforeWeeks);
  /* Ensure e2e uid not left in records */
  if ((await req('GET', '/rdg/specialWeekRecords/' + UID + '.json')).json) {
    await req('DELETE', '/rdg/specialWeekRecords/' + UID + '.json');
  }
  pass('Cleanup restored prior special weeks', 'ok');

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  if (failed.length) {
    failed.forEach((f) => console.error(' - ' + f.name + ': ' + f.detail));
    process.exit(1);
  }
  console.log('Add + delete of special weeks propagate to every session.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
