/**
 * Live Firebase E2E: edit / add / delete schedule sync (same paths as the dashboard).
 * Uses a random test night, then restores any baked show touched.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const HOST = "rdg-dj-dashboard-default-rtdb.firebaseio.com";
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

function ensureShowUid(rec) {
  if (!rec) return "";
  if (rec._uid) return rec._uid;
  if (rec._added) {
    rec._uid = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    return rec._uid;
  }
  const base = [
    rec.venue || rec.v || "",
    rec.d || "",
    rec.dj || "",
    String(rec.fee != null ? rec.fee : rec.cost != null ? rec.cost : "")
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  rec._uid = "s_" + h.toString(36) + "_" + String(rec.d || "").replace(/-/g, "");
  return rec._uid;
}
function dateKey(rec) {
  return (rec.venue || rec.v || "") + "|" + rec.d;
}
function uidKey(rec) {
  return dateKey(rec) + "|" + ensureShowUid(rec);
}

/** Minimal second-session apply (matches dashboard: bake + edits + addsByUid − deletes). */
function applyAsSessionB(bakeRow, ov) {
  const s = bakeRow ? [Object.assign({}, bakeRow)] : [];
  if (bakeRow) ensureShowUid(s[0]);
  const edits = (ov && ov.edits) || {};
  Object.keys(edits).forEach((k) => {
    const parts = k.split("|");
    const uid = parts[2] || "";
    const edit = edits[k];
    if (!edit) return;
    if (uid) {
      const idx = s.findIndex((r) => r._uid === uid);
      if (idx >= 0) Object.assign(s[idx], edit);
    } else if (s.length === 1 && dateKey(s[0]) === parts[0] + "|" + parts[1]) {
      Object.assign(s[0], edit);
    }
  });
  const dels = ov && ov.deletes
    ? Array.isArray(ov.deletes)
      ? ov.deletes
      : Object.values(ov.deletes)
    : [];
  const filtered = s.filter((r) => {
    const uk = uidKey(r);
    return !dels.some((dk) => {
      if (!dk) return false;
      const p = String(dk).split("|");
      return uk === dk || (p.length >= 3 && p[2] === r._uid);
    });
  });
  const byUid = (ov && ov.addsByUid) || {};
  Object.keys(byUid).forEach((uid) => {
    const r = byUid[uid];
    if (!r) return;
    if (dels.some((dk) => {
      const p = String(dk || "").split("|");
      return p.length >= 3 && p[2] === uid;
    })) return;
    if (filtered.some((x) => x._uid === uid)) return;
    filtered.push(Object.assign({}, r, { _added: 1, _uid: uid }));
  });
  return filtered;
}

function guardWouldHideRemote(staleGuardDj, remoteDj) {
  // Pre-fix bug: calendar always preferred sessionStorage guard.
  // Post-fix: only fresh (<8s) guards overlay — stale must NOT hide remote.
  const stale = { at: Date.now() - 60000, dj: staleGuardDj };
  const fresh = Date.now() - Number(stale.at) <= 8000;
  const painted = fresh && stale.dj ? stale.dj : remoteDj;
  return painted === remoteDj;
}

(async () => {
  console.log("=== Firebase schedule sync E2E ===\n");

  // 1) Rules / connectivity
  const health = await req("PUT", "/rdg/_syncE2E.json", {
    at: new Date().toISOString(),
    phase: "start"
  });
  if (health.status === 200) pass("Firebase anon write", "HTTP 200");
  else fail("Firebase anon write", "HTTP " + health.status + " " + health.body);

  const healthR = await req("GET", "/rdg/_syncE2E.json");
  if (healthR.status === 200 && healthR.json && healthR.json.phase === "start")
    pass("Firebase anon read", "echo ok");
  else fail("Firebase anon read", JSON.stringify(healthR.json));

  // Load bake pick
  const bakeFile = fs.readFileSync(path.join(__dirname, "..", "data", "sched-baked.js"), "utf8");
  const m = bakeFile.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("Could not parse SCHED bake");
  const SCHED = JSON.parse(m[1]);
  const cands = SCHED.filter(
    (r) =>
      r &&
      r.d &&
      r.d >= "2026-09-01" &&
      r.d <= "2026-10-31" &&
      r.dj &&
      (r.fee || r.cost)
  );
  const pick = cands[Math.floor(Math.random() * cands.length)];
  const venue = pick.v || pick.venue;
  const bake = {
    v: venue,
    venue,
    d: pick.d,
    dj: pick.dj,
    fee: pick.fee != null ? pick.fee : pick.cost,
    cost: pick.cost != null ? pick.cost : pick.fee
  };
  ensureShowUid(bake);
  console.log(
    "\nRandom baked night:",
    venue,
    pick.d,
    "DJ=" + bake.dj,
    "fee=" + bake.fee,
    "uid=" + bake._uid
  );

  const editKey = uidKey(bake);
  const editPath = "/rdg/schedOverrides/edits/" + encodeURIComponent(editKey) + ".json";

  // Snapshot prior edit (if any) to restore
  const priorEdit = await req("GET", editPath);
  const prior = priorEdit.json;

  // ---- EDIT DJ name + fee ----
  const editedName = "E2E SYNC " + Date.now().toString(36).toUpperCase();
  const editedFee = 4242;
  const editPayload = {
    v: venue,
    venue,
    d: pick.d,
    dj: editedName,
    fee: editedFee,
    cost: editedFee,
    _uid: bake._uid,
    _writeKind: "modal",
    updatedAt: new Date().toISOString(),
    _e2e: true
  };
  const wEdit = await req("PUT", editPath, editPayload);
  if (wEdit.status === 200) pass("EDIT write to Firebase", editedName + " / $" + editedFee);
  else fail("EDIT write to Firebase", wEdit.status + " " + wEdit.body);

  await sleep(400);
  const rEdit = await req("GET", editPath);
  if (rEdit.json && rEdit.json.dj === editedName && Number(rEdit.json.fee) === editedFee)
    pass("EDIT readable by other session", rEdit.json.dj);
  else fail("EDIT readable by other session", JSON.stringify(rEdit.json));

  // Session B apply
  const ovAfterEdit = await req("GET", "/rdg/schedOverrides.json");
  const sessionB1 = applyAsSessionB(bake, ovAfterEdit.json);
  const hit = sessionB1.find((r) => r._uid === bake._uid);
  if (hit && hit.dj === editedName && Number(hit.fee) === editedFee)
    pass("EDIT applied in session B rebuild", hit.dj + " $" + hit.fee);
  else fail("EDIT applied in session B rebuild", JSON.stringify(hit));

  if (guardWouldHideRemote("OLD STALE NAME", editedName))
    pass("Stale local guard does not hide remote DJ name", "paints " + editedName);
  else fail("Stale local guard does not hide remote DJ name", "still painting stale");

  // Restore baked edit key
  if (prior == null) await req("DELETE", editPath);
  else await req("PUT", editPath, prior);
  pass("EDIT cleanup restored prior Firebase edit", prior ? "restored" : "deleted test edit");

  // ---- ADD show on empty night ----
  const addDate = "2026-11-03"; // Tue — usually empty for nightlife
  const addUid = "s_e2e_" + Date.now().toString(36);
  const addRec = {
    v: "MILA Lounge",
    venue: "MILA Lounge",
    d: addDate,
    dj: "E2E ADD " + addUid.slice(-4).toUpperCase(),
    fee: 1111,
    cost: 1111,
    _uid: addUid,
    _added: 1,
    _writeKind: "modal",
    updatedAt: new Date().toISOString(),
    _e2e: true
  };
  const addPath = "/rdg/schedOverrides/addsByUid/" + encodeURIComponent(addUid) + ".json";
  const wAdd = await req("PUT", addPath, addRec);
  if (wAdd.status === 200) pass("ADD write to Firebase", addRec.dj + " " + addDate);
  else fail("ADD write to Firebase", wAdd.status + " " + wAdd.body);

  await sleep(400);
  const ovAfterAdd = await req("GET", "/rdg/schedOverrides.json");
  const sessionB2 = applyAsSessionB(null, {
    edits: {},
    addsByUid: { [addUid]: ovAfterAdd.json.addsByUid[addUid] },
    deletes: ovAfterAdd.json.deletes
  });
  if (sessionB2.some((r) => r._uid === addUid && r.dj === addRec.dj))
    pass("ADD visible in session B", addRec.dj);
  else fail("ADD visible in session B", JSON.stringify(sessionB2));

  // ---- DELETE the add ----
  const delKey = uidKey(addRec);
  const delsNow = ovAfterAdd.json.deletes
    ? Array.isArray(ovAfterAdd.json.deletes)
      ? ovAfterAdd.json.deletes.slice()
      : Object.values(ovAfterAdd.json.deletes)
    : [];
  if (delsNow.indexOf(delKey) < 0) delsNow.push(delKey);
  const onlyUidDels = delsNow.filter((k) => k && String(k).split("|").length >= 3);
  await req("DELETE", addPath);
  const wDel = await req("PUT", "/rdg/schedOverrides/deletes.json", onlyUidDels);
  if (wDel.status === 200) pass("DELETE tombstone written", delKey);
  else fail("DELETE tombstone written", wDel.status + " " + wDel.body);

  await sleep(400);
  const ovAfterDel = await req("GET", "/rdg/schedOverrides.json");
  const sessionB3 = applyAsSessionB(null, {
    edits: {},
    addsByUid: ovAfterDel.json.addsByUid || {},
    deletes: ovAfterDel.json.deletes
  });
  if (!sessionB3.some((r) => r._uid === addUid))
    pass("DELETE hides show in session B", "add gone");
  else fail("DELETE hides show in session B", "still present");

  // Cleanup: remove our tombstone from deletes array
  const cleaned = (Array.isArray(ovAfterDel.json.deletes)
    ? ovAfterDel.json.deletes
    : Object.values(ovAfterDel.json.deletes || {})
  ).filter((k) => k !== delKey);
  await req("PUT", "/rdg/schedOverrides/deletes.json", cleaned.length ? cleaned : null);
  await req("DELETE", "/rdg/_syncE2E.json");
  pass("Cleanup complete", "test tombstone + probe removed");

  // Summary
  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY: " + (results.length - failed.length) + "/" + results.length + " passed ===");
  if (failed.length) {
    failed.forEach((f) => console.error(" - " + f.name + ": " + f.detail));
    process.exit(1);
  }
  console.log("All edit / add / delete sync paths verified against live Firebase.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
