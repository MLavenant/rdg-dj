/**
 * Two isolated sessions against live Firebase (workbook: schedOverrides/shows).
 * MILA Lounge 2026-09-28 (new night) and 2026-09-02 (existing).
 * Session A create / Session B delete / recreate / rename / DJ status.
 */
const https = require("https");

const HOST = "rdg-dj-dashboard-default-rtdb.firebaseio.com";
const VENUE = "MILA Lounge";
const results = [];

function pass(name, detail) {
  results.push({ ok: true, name, detail });
  console.log("PASS  " + name + (detail ? " — " + detail : ""));
}
function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.error("FAIL  " + name + " — " + detail);
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
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve({ status: res.statusCode, body: b, json: safeJson(b) }));
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
function safeJson(b) {
  try {
    return JSON.parse(b || "null");
  } catch (e) {
    return null;
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function nightKey(r) {
  return (r.v || r.venue || "") + "|" + (r.d || "");
}
function uidKey(r) {
  return nightKey(r) + "|" + (r._uid || "");
}
function isDeleted(uid, rec, dels) {
  const uk = rec ? uidKey(Object.assign({}, rec, { _uid: uid })) : "";
  return dels.some((dk) => {
    if (!dk) return false;
    const p = String(dk).split("|");
    return (uk && dk === uk) || (p.length >= 3 && p[2] === uid);
  });
}

/** Matches dashboard apply when schedOverrides.shows is populated. */
function applyWorkbook(localRows, ov) {
  const s = (localRows || []).map((r) => Object.assign({}, r));
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  const delsRaw = ov && ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const dels = delsRaw.filter((dk) => dk && String(dk).split("|").length >= 3);
  if (!workbookUids.length) return s.filter((r) => !isDeleted(r._uid, r, dels));

  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit || isDeleted(uid, edit, dels)) return;
    const idx = s.findIndex((r) => r && String(r._uid || "") === String(uid));
    if (idx >= 0) {
      Object.assign(s[idx], edit, { _uid: uid });
      return;
    }
    const row = Object.assign({}, edit, { _uid: uid });
    const nk = nightKey(row);
    const occupied = nk ? s.filter((x) => x && nightKey(x) === nk) : [];
    if (occupied.length) Object.assign(occupied[0], row);
    else {
      row._added = 1;
      s.push(row);
    }
  });
  const kept = s.filter((r) => r && !isDeleted(r._uid, r, dels));
  const byNight = {};
  kept.forEach((r) => {
    const k = nightKey(r);
    if (!byNight[k] || String(r.updatedAt || "") > String(byNight[k].updatedAt || "")) byNight[k] = r;
  });
  return Object.values(byNight);
}

function nightLiveCopies(ov, venue, dateStr) {
  const hits = [];
  function scan(label, obj, asArray) {
    const src = asArray
      ? Array.isArray(obj)
        ? obj
        : Object.values(obj || {})
      : obj || {};
    const keys = asArray ? src.map((_, i) => String(i)) : Object.keys(src);
    const vals = asArray ? src : keys.map((k) => src[k]);
    (asArray ? src : keys).forEach((kOrRow, i) => {
      const k = asArray ? String(i) : kOrRow;
      const e = asArray ? kOrRow : src[k];
      if (!e || typeof e !== "object") return;
      const venueHit = (e.v || e.venue || "") === venue;
      const dateHit = e.d === dateStr;
      const keyHit = String(k).includes(dateStr) && String(k).includes("MILA");
      if ((venueHit && dateHit) || keyHit) hits.push({ store: label, k, dj: e.dj, fee: e.fee, uid: e._uid || k, status: e.djStatus });
    });
  }
  scan("shows", ov.shows, false);
  scan("addsByUid", ov.addsByUid, false);
  scan("editsByUid", ov.editsByUid, false);
  scan("edits", ov.edits, false);
  const adds = ov.adds ? (Array.isArray(ov.adds) ? ov.adds : Object.values(ov.adds)) : [];
  adds.forEach((e, i) => {
    if (e && e.d === dateStr && (e.v || e.venue) === venue)
      hits.push({ store: "adds", k: String(i), dj: e.dj, fee: e.fee, uid: e._uid, status: e.djStatus });
  });
  return hits;
}

async function getOv() {
  const r = await req("GET", "/rdg/schedOverrides.json");
  return r.json || {};
}

async function persistShow(rec) {
  const uid = rec._uid;
  rec.updatedAt = new Date().toISOString();
  rec._writeKind = rec._writeKind || "modal";
  rec.v = rec.v || rec.venue;
  rec.venue = rec.venue || rec.v;
  const ov = await getOv();
  const shows = ov.shows || {};
  const venue = rec.v;
  for (const other of Object.keys(shows)) {
    if (other === uid) continue;
    const row = shows[other];
    if (row && row.d === rec.d && (row.v || row.venue) === venue) {
      await req("DELETE", "/rdg/schedOverrides/shows/" + encodeURIComponent(other) + ".json");
    }
  }
  await req("PUT", "/rdg/schedOverrides/shows/" + encodeURIComponent(uid) + ".json", rec);
  const dels = ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const next = dels.filter((k) => {
    if (!k) return false;
    const p = String(k).split("|");
    if (p.length < 3) return false;
    if (k === uidKey(rec)) return false;
    if (p[2] === uid) return false;
    return true;
  });
  await req("PUT", "/rdg/schedOverrides/deletes.json", next.length ? next : null);
  await scrubLegacy(venue, rec.d, uid);
}

async function persistStatus(uid, status) {
  const got = await req("GET", "/rdg/schedOverrides/shows/" + encodeURIComponent(uid) + ".json");
  const cur = got.json || {};
  cur.djStatus = status;
  cur.updatedAt = new Date().toISOString();
  cur._writeKind = "statusMerge";
  await req("PUT", "/rdg/schedOverrides/shows/" + encodeURIComponent(uid) + ".json", cur);
}

async function deleteShow(rec) {
  const uid = rec._uid;
  const venue = rec.v || rec.venue;
  const ov = await getOv();
  const shows = ov.shows || {};
  const tomb = [uidKey(rec)];
  for (const id of Object.keys(shows)) {
    const row = shows[id];
    if (id === uid || (row && row.d === rec.d && (row.v || row.venue) === venue)) {
      if (id !== uid) tomb.push(venue + "|" + rec.d + "|" + id);
      await req("DELETE", "/rdg/schedOverrides/shows/" + encodeURIComponent(id) + ".json");
    }
  }
  const dels = ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  tomb.forEach((k) => {
    if (dels.indexOf(k) < 0) dels.push(k);
  });
  await req("PUT", "/rdg/schedOverrides/deletes.json", dels.filter((k) => k && String(k).split("|").length >= 3));
  await scrubLegacy(venue, rec.d, null);
}

async function scrubLegacy(venue, dateStr, keepUid) {
  const ov = await getOv();
  async function scrubMap(path, map) {
    for (const k of Object.keys(map || {})) {
      const row = map[k];
      if (!row || typeof row !== "object") continue;
      if (keepUid && (k === keepUid || row._uid === keepUid)) continue;
      if (row.d === dateStr && (row.v || row.venue || "") === venue) {
        await req("DELETE", path + encodeURIComponent(k) + ".json");
      }
    }
  }
  await scrubMap("/rdg/schedOverrides/addsByUid/", ov.addsByUid);
  await scrubMap("/rdg/schedOverrides/editsByUid/", ov.editsByUid);
  for (const k of Object.keys(ov.edits || {})) {
    const row = ov.edits[k];
    const parts = String(k).split("|");
    const hit =
      (parts[0] === venue && parts[1] === dateStr) ||
      (row && row.d === dateStr && (row.v || row.venue || "") === venue);
    if (hit && !(keepUid && (parts[2] === keepUid || (row && row._uid === keepUid)))) {
      await req("DELETE", "/rdg/schedOverrides/edits/" + encodeURIComponent(k) + ".json");
    }
  }
  const adds = ov.adds ? (Array.isArray(ov.adds) ? ov.adds : Object.values(ov.adds)) : [];
  const nextAdds = adds.filter((r) => !(r && r.d === dateStr && (r.v || r.venue) === venue));
  if (nextAdds.length !== adds.length) {
    await req("PUT", "/rdg/schedOverrides/adds.json", nextAdds.length ? nextAdds : null);
  }
}

function findNight(rows, venue, d) {
  return (rows || []).filter((r) => r && r.d === d && (r.v || r.venue) === venue);
}

function newUid() {
  return "s_e2e_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function runNight(label, dateStr, existingSnap) {
  console.log("\n======== " + label + " " + dateStr + " ========\n");
  const tag = label + " " + dateStr;

  let sessionA = [];
  let sessionB = [];
  if (existingSnap) {
    sessionA = [Object.assign({}, existingSnap)];
    sessionB = [Object.assign({}, existingSnap)];
  }

  const uid1 = existingSnap ? existingSnap._uid : newUid();
  const createRec = {
    v: VENUE,
    venue: VENUE,
    d: dateStr,
    dj: existingSnap ? "E2E-EDIT-A" : "E2E-CREATE-A",
    fee: existingSnap ? 111 : 1000,
    cost: existingSnap ? 111 : 1000,
    _uid: uid1,
    _added: 1,
    djStatus: null
  };

  // Session A create/overwrite
  sessionA = [Object.assign({}, createRec)];
  await persistShow(createRec);
  await sleep(500);
  let ov = await getOv();
  sessionB = applyWorkbook(sessionB, ov);
  let bHits = findNight(sessionB, VENUE, dateStr);
  if (bHits.length === 1 && bHits[0].dj === createRec.dj && Number(bHits[0].fee) === createRec.fee)
    pass(tag + " A create → B sees first write", bHits[0].dj + " $" + bHits[0].fee);
  else fail(tag + " A create → B sees first write", JSON.stringify(bHits));

  sessionA = applyWorkbook(sessionA, ov);
  let aHits = findNight(sessionA, VENUE, dateStr);
  if (aHits.length === 1 && aHits[0].dj === createRec.dj)
    pass(tag + " A still sees own create", aHits[0].dj);
  else fail(tag + " A still sees own create", JSON.stringify(aHits));

  // Session B first rename (the previously-broken case)
  const rename1 = Object.assign({}, bHits[0] || createRec, {
    dj: "E2E-RENAME-B1",
    fee: 2222,
    cost: 2222,
    _uid: (bHits[0] && bHits[0]._uid) || uid1
  });
  await persistShow(rename1);
  await sleep(500);
  ov = await getOv();
  sessionA = applyWorkbook(sessionA, ov);
  aHits = findNight(sessionA, VENUE, dateStr);
  if (aHits.length === 1 && aHits[0].dj === "E2E-RENAME-B1" && Number(aHits[0].fee) === 2222)
    pass(tag + " B first rename → A sees overwrite", aHits[0].dj + " $" + aHits[0].fee);
  else fail(tag + " B first rename → A sees overwrite", JSON.stringify(aHits));

  sessionB = applyWorkbook(sessionB, ov);

  // Session A DJ status
  await persistStatus(rename1._uid, "Confirmed");
  await sleep(400);
  ov = await getOv();
  sessionB = applyWorkbook(sessionB, ov);
  bHits = findNight(sessionB, VENUE, dateStr);
  if (bHits.length === 1 && bHits[0].djStatus === "Confirmed" && bHits[0].dj === "E2E-RENAME-B1")
    pass(tag + " A status Confirmed → B sees name+status", bHits[0].djStatus);
  else fail(tag + " A status Confirmed → B sees name+status", JSON.stringify(bHits));

  sessionA = applyWorkbook(sessionA, ov);

  // Session B status Hold + name change together via persist
  const combo = Object.assign({}, bHits[0], { dj: "E2E-COMBO", fee: 3333, cost: 3333, djStatus: "Hold 1" });
  await persistShow(combo);
  await persistStatus(combo._uid, "Hold 1");
  await sleep(400);
  ov = await getOv();
  sessionA = applyWorkbook(sessionA, ov);
  aHits = findNight(sessionA, VENUE, dateStr);
  if (
    aHits.length === 1 &&
    aHits[0].dj === "E2E-COMBO" &&
    Number(aHits[0].fee) === 3333 &&
    aHits[0].djStatus === "Hold 1"
  )
    pass(tag + " B combo name/fee/status → A overwrite", JSON.stringify({ dj: aHits[0].dj, fee: aHits[0].fee, st: aHits[0].djStatus }));
  else fail(tag + " B combo name/fee/status → A overwrite", JSON.stringify(aHits));

  // Session B delete — gone for A, no live remnants
  await deleteShow(combo);
  await sleep(600);
  ov = await getOv();
  sessionA = applyWorkbook(sessionA, ov);
  sessionB = applyWorkbook(sessionB, ov);
  aHits = findNight(sessionA, VENUE, dateStr);
  bHits = findNight(sessionB, VENUE, dateStr);
  if (aHits.length === 0 && bHits.length === 0)
    pass(tag + " B delete → both sessions empty", "gone");
  else fail(tag + " B delete → both sessions empty", JSON.stringify({ aHits, bHits }));

  const remnants = nightLiveCopies(ov, VENUE, dateStr);
  if (remnants.length === 0)
    pass(tag + " delete leaves no live copies anywhere", "shows/adds/edits empty");
  else fail(tag + " delete leaves no live copies anywhere", JSON.stringify(remnants));

  // Session A create again after delete
  const uid2 = newUid();
  const recreate = {
    v: VENUE,
    venue: VENUE,
    d: dateStr,
    dj: "E2E-RECREATE-A",
    fee: 4444,
    cost: 4444,
    _uid: uid2,
    _added: 1,
    djStatus: "Pending"
  };
  sessionA = [Object.assign({}, recreate)];
  await persistShow(recreate);
  await persistStatus(uid2, "Pending");
  await sleep(500);
  ov = await getOv();
  sessionB = applyWorkbook([], ov);
  bHits = findNight(sessionB, VENUE, dateStr);
  if (bHits.length === 1 && bHits[0].dj === "E2E-RECREATE-A" && bHits[0].djStatus === "Pending")
    pass(tag + " A recreate after delete → B sees new show", bHits[0].dj + " " + bHits[0].djStatus);
  else fail(tag + " A recreate after delete → B sees new show", JSON.stringify(bHits));

  sessionA = applyWorkbook(sessionA, ov);
  aHits = findNight(sessionA, VENUE, dateStr);
  if (aHits.length === 1 && aHits[0]._uid === uid2)
    pass(tag + " recreate is a new uid, old delete does not hide it", uid2);
  else fail(tag + " recreate is a new uid, old delete does not hide it", JSON.stringify(aHits));

  return { last: Object.assign({}, bHits[0] || recreate) };
}

(async () => {
  console.log("=== Two-session MILA Lounge E2E (workbook shows/) ===\n");

  const ping = await req("PUT", "/rdg/_syncE2E.json", { at: new Date().toISOString(), t: "two-session" });
  if (ping.status === 200) pass("Firebase write", "ok");
  else fail("Firebase write", String(ping.status));

  const ov0 = await getOv();
  const sep2 = Object.keys(ov0.shows || {})
    .map((uid) => Object.assign({}, ov0.shows[uid], { _uid: uid }))
    .find((r) => r && r.d === "2026-09-02" && (r.v || r.venue) === VENUE);
  const sep2Snap = sep2 ? JSON.parse(JSON.stringify(sep2)) : null;
  console.log("Sep 2 snapshot:", sep2Snap ? sep2Snap.dj + " $" + sep2Snap.fee + " " + sep2Snap._uid : "(none)");

  const r28 = await runNight("new night", "2026-09-28", null);
  const r02 = await runNight("existing night", "2026-09-02", sep2Snap);

  // Restore Sep 2 original (or leave empty if there was none)
  console.log("\n======== restore ========\n");
  if (sep2Snap) {
    await persistShow(sep2Snap);
    await sleep(400);
    const ovR = await getOv();
    const seen = applyWorkbook([], ovR);
    const hit = findNight(seen, VENUE, "2026-09-02")[0];
    if (hit && hit.dj === sep2Snap.dj && Number(hit.fee) === Number(sep2Snap.fee))
      pass("Sep 2 restored to original", hit.dj + " $" + hit.fee);
    else fail("Sep 2 restored to original", JSON.stringify(hit));
  } else if (r02.last) {
    await deleteShow(r02.last);
    pass("Sep 2 had no original; test show deleted", "");
  }

  if (r28.last) {
    await deleteShow(r28.last);
    await sleep(400);
    const ovC = await getOv();
    const left = nightLiveCopies(ovC, VENUE, "2026-09-28");
    const seen = findNight(applyWorkbook([], ovC), VENUE, "2026-09-28");
    if (seen.length === 0 && left.length === 0)
      pass("Sep 28 cleaned — empty everywhere", "ok");
    else fail("Sep 28 cleaned — empty everywhere", JSON.stringify({ seen, left }));
  }

  await req("DELETE", "/rdg/_syncE2E.json");

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY: " + (results.length - failed.length) + "/" + results.length + " passed ===");
  if (failed.length) {
    failed.forEach((f) => console.error(" - " + f.name + ": " + f.detail));
    process.exit(1);
  }
  console.log("Create / first rename / status / combo / delete / recreate all match across two sessions.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
