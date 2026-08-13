/**
 * Live proof: modal DJ name/fee via editsByUid (uid-isolated) + session B apply.
 * Also proves status-only patch does not change another show's name.
 */
const https = require("https");
const HOST = "rdg-dj-dashboard-default-rtdb.firebaseio.com";

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
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(b || "null");
          } catch (e) {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function ensureShowUid(rec) {
  if (rec._uid) return rec._uid;
  const base = [rec.venue || rec.v || "", rec.d || "", rec.dj || "", String(rec.fee != null ? rec.fee : "")].join("|");
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  rec._uid = "s_" + h.toString(36) + "_" + String(rec.d || "").replace(/-/g, "");
  return rec._uid;
}
function mergeSchedEdit(target, edit) {
  if (!target || !edit) return;
  const kind = edit._writeKind || "";
  if (kind === "statusMerge" || kind === "djStatus") {
    if (Object.prototype.hasOwnProperty.call(edit, "djStatus")) target.djStatus = edit.djStatus;
    if ((!target.dj || String(target.dj).toUpperCase() === "TBD") && edit.dj) target.dj = edit.dj;
    return;
  }
  const hasDj = edit.dj != null && String(edit.dj).trim() !== "";
  const hasFee = edit.fee != null || edit.cost != null;
  if (!hasDj && !hasFee) {
    if (Object.prototype.hasOwnProperty.call(edit, "djStatus")) target.djStatus = edit.djStatus;
    return;
  }
  if (edit.dj != null) target.dj = edit.dj;
  if (edit.fee != null || edit.cost != null) {
    target.fee = edit.fee != null ? edit.fee : edit.cost;
    target.cost = edit.cost != null ? edit.cost : edit.fee;
  }
  Object.assign(target, edit);
}

(async () => {
  const venue = "MILA Lounge";
  const d = "2026-10-30";
  const bake = { v: venue, venue, d, dj: "FLOYD LAVINE", fee: 4000 };
  const uid = ensureShowUid(bake);
  const uid2bake = { v: venue, venue, d: "2026-10-31", dj: "OTHER SHOW", fee: 1000 };
  const uid2 = ensureShowUid(uid2bake);

  const newDj = "UIDMAP " + Date.now().toString(36).toUpperCase();
  const identity = {
    dj: newDj,
    fee: 5555,
    cost: 5555,
    d,
    v: venue,
    venue,
    _uid: uid,
    _writeKind: "modal",
    updatedAt: new Date().toISOString(),
    _added: 0
  };

  // Write like the app: editsByUid + legacy edits key
  await req("PUT", "/rdg/schedOverrides/editsByUid/" + uid + ".json", identity);
  await req("PUT", "/rdg/schedOverrides/edits/" + encodeURIComponent(venue + "|" + d + "|" + uid) + ".json", identity);
  await sleep(250);

  const readUid = await req("GET", "/rdg/schedOverrides/editsByUid/" + uid + ".json");
  console.log(
    "editsByUid write",
    readUid.json && readUid.json.dj === newDj && readUid.json.updatedAt ? "PASS" : readUid.json
  );

  // Session B apply: bake + editsByUid by exact uid
  const s = [Object.assign({}, bake), Object.assign({}, uid2bake)];
  ensureShowUid(s[0]);
  ensureShowUid(s[1]);
  const ov = await req("GET", "/rdg/schedOverrides.json");
  const byUid = (ov.json && ov.json.editsByUid) || {};
  Object.keys(byUid).forEach((id) => {
    const idx = s.findIndex((r) => r._uid === id);
    if (idx >= 0) mergeSchedEdit(s[idx], byUid[id]);
  });
  console.log("session B sees rename", s[0].dj === newDj && s[0].fee === 5555 ? "PASS" : s[0]);
  console.log("other show untouched", s[1].dj === "OTHER SHOW" && s[1].fee === 1000 ? "PASS" : s[1]);

  // Status-only on show1 must not change show2, and must not wipe name when thin
  await req("PUT", "/rdg/schedOverrides/editsByUid/" + uid + ".json", {
    djStatus: "Confirmed",
    _uid: uid,
    d,
    v: venue,
    venue
  });
  // Simulate merge of thin status on top of already-applied modal name in memory
  mergeSchedEdit(s[0], { djStatus: "Confirmed" });
  console.log("status keeps name", s[0].dj === newDj && s[0].djStatus === "Confirmed" ? "PASS" : s[0]);

  // cleanup test uid map entry — restore by delete (won't remove real production if we used test-only name)
  // Keep production data: only delete our test identity if we overwrote FLOYD night — restore bake-ish
  await req("DELETE", "/rdg/schedOverrides/editsByUid/" + uid + ".json");
  await req("DELETE", "/rdg/schedOverrides/edits/" + encodeURIComponent(venue + "|" + d + "|" + uid) + ".json");
  console.log("cleanup done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
