/**
 * Collapse duplicate schedule lists into one Firebase map:
 *   rdg/schedOverrides/shows/{uid}
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

function pick(a, b) {
  if (!a) return b;
  if (!b) return a;
  const at = Date.parse(a.updatedAt || "") || 0;
  const bt = Date.parse(b.updatedAt || "") || 0;
  if (bt > at) return Object.assign({}, a, b);
  if (at > bt) return Object.assign({}, b, a, { dj: a.dj, fee: a.fee, cost: a.cost, updatedAt: a.updatedAt });
  /* same time: modal / editsByUid-style name wins if present */
  const out = Object.assign({}, a, b);
  if (b._writeKind === "modal" && b.dj) {
    out.dj = b.dj;
    if (b.fee != null) out.fee = b.fee;
    if (b.cost != null) out.cost = b.cost;
  }
  return out;
}

(async () => {
  const ov = (await req("GET", "/rdg/schedOverrides.json")).json || {};
  const dels = (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes || {}))
    .filter((k) => k && String(k).split("|").length >= 3)
    .map((k) => String(k).split("|")[2]);
  const delSet = new Set(dels);
  const map = {};

  Object.keys(ov.addsByUid || {}).forEach((uid) => {
    const row = ov.addsByUid[uid];
    if (!row || delSet.has(uid)) return;
    map[uid] = Object.assign({}, row, { _uid: uid, _added: 1 });
  });
  Object.keys(ov.editsByUid || {}).forEach((uid) => {
    const row = ov.editsByUid[uid];
    if (!row || delSet.has(uid)) return;
    map[uid] = pick(map[uid], Object.assign({}, row, { _uid: uid }));
  });
  Object.keys(ov.edits || {}).forEach((k) => {
    const parts = String(k).split("|");
    const uid = parts[2];
    const row = ov.edits[k];
    if (!uid || !row || delSet.has(uid)) return;
    if (row._writeKind === "statusMerge" && !row.dj && map[uid]) {
      if (row.djStatus != null) map[uid].djStatus = row.djStatus;
      return;
    }
    map[uid] = pick(map[uid], Object.assign({}, row, { _uid: uid }));
  });

  /* One show per venue|date — keep newest updatedAt. */
  const byNight = {};
  Object.keys(map).forEach((uid) => {
    const r = map[uid];
    const nk = (r.v || r.venue || "") + "|" + r.d;
    if (!byNight[nk]) {
      byNight[nk] = uid;
      return;
    }
    const keep = map[byNight[nk]];
    const kt = Date.parse(keep.updatedAt || "") || 0;
    const rt = Date.parse(r.updatedAt || "") || 0;
    if (rt >= kt) byNight[nk] = uid;
  });
  const shows = {};
  Object.keys(byNight).forEach((nk) => {
    const uid = byNight[nk];
    shows[uid] = map[uid];
  });

  const put = await req("PUT", "/rdg/schedOverrides/shows.json", shows);
  console.log("PUT shows", put.status, "count", Object.keys(shows).length);
  const sample = ["2026-09-02", "2026-09-09", "2026-10-01", "2026-11-05", "2026-11-12", "2026-10-31"];
  sample.forEach((d) => {
    Object.keys(shows).forEach((uid) => {
      if (shows[uid].d === d && /MILA/.test(shows[uid].v || shows[uid].venue || "")) {
        console.log(" MILA", d, shows[uid].dj, shows[uid].fee, uid);
      }
    });
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
