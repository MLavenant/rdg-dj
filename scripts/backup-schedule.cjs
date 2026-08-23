/**
 * One overwrite backup of the full 2025–2027 calendar (bake + live workbook).
 * Writes rdg/scheduleBackups/latest and deletes any older snapshots.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const HOST = "rdg-dj-dashboard-default-rtdb.firebaseio.com";
const YEARS = { "2025": 1, "2026": 1, "2027": 1 };

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
          } catch (e) {
            json = null;
          }
          resolve({ status: res.statusCode, body: b, json });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
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

function inYears(r) {
  return !!(r && r.d && YEARS[String(r.d).slice(0, 4)]);
}

function compactRow(r) {
  if (!inYears(r)) return null;
  ensureShowUid(r);
  return {
    _uid: r._uid,
    v: r.v || r.venue || "",
    venue: r.venue || r.v || "",
    d: r.d,
    dj: r.dj || "",
    fee: r.fee != null ? r.fee : null,
    cost: r.cost != null ? r.cost : r.fee != null ? r.fee : null,
    djStatus: r.djStatus || null,
    agency: r.agency || null,
    ev: r.ev || "",
    note: r.note || null,
    vipNote: r.vipNote || null,
    _added: r._added ? 1 : 0
  };
}

function nightKey(r) {
  return (r.v || r.venue || "") + "|" + (r.d || "");
}

function applyWorkbook(bakeRows, ov) {
  let s = bakeRows.map((r) => Object.assign({}, r));
  s.forEach(ensureShowUid);
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  const delsRaw = ov && ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const dels = delsRaw.filter((dk) => dk && String(dk).split("|").length >= 3);
  function dead(uid, rec) {
    const uk = nightKey(Object.assign({}, rec, { _uid: uid })) + "|" + uid;
    return dels.some((dk) => {
      const p = String(dk || "").split("|");
      return dk === uk || (p.length >= 3 && p[2] === uid);
    });
  }
  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit || dead(uid, edit)) return;
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
  return s.filter((r) => r && inYears(r) && !dead(r._uid, r));
}

function loadBake() {
  const txt = fs.readFileSync(path.join(__dirname, "..", "data", "sched-baked.js"), "utf8");
  const m = txt.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("Could not parse sched-baked.js");
  return JSON.parse(m[1]).filter(inYears);
}

(async () => {
  const now = new Date();
  const ov = (await req("GET", "/rdg/schedOverrides.json")).json || {};
  const merged = applyWorkbook(loadBake(), ov);
  const calendar = {};
  const byYear = { "2025": 0, "2026": 0, "2027": 0 };
  merged.forEach((r) => {
    const row = compactRow(r);
    if (!row) return;
    calendar[row._uid] = row;
    const y = String(row.d).slice(0, 4);
    if (byYear[y] != null) byYear[y] += 1;
  });
  const liveShows = ov.shows && typeof ov.shows === "object" ? ov.shows : {};
  const specialWeekRecords = (await req("GET", "/rdg/specialWeekRecords.json")).json || null;
  const specialWeeks = (await req("GET", "/rdg/specialWeeks.json")).json || null;
  const payload = {
    name: "schedule latest",
    key: "latest",
    years: ["2025", "2026", "2027"],
    savedAt: now.toISOString(),
    count: Object.keys(calendar).length,
    byYear,
    calendar,
    liveShows,
    liveDeletes: ov.deletes || null,
    specialWeekRecords,
    specialWeeks
  };
  const tree = {
    latest: payload,
    _meta: {
      lastKey: "latest",
      lastName: payload.name,
      lastAt: payload.savedAt,
      lastCount: payload.count,
      byYear
    }
  };
  const put = await req("PUT", "/rdg/scheduleBackups.json", tree);
  if (put.status !== 200) {
    console.error("Backup write failed", put.status, put.body);
    process.exit(1);
  }
  console.log(
    "Saved schedule latest — " +
      payload.count +
      " shows (2025=" +
      byYear["2025"] +
      " 2026=" +
      byYear["2026"] +
      " 2027=" +
      byYear["2027"] +
      "). Previous backups replaced."
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
