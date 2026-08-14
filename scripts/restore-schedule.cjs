/**
 * Restore live workbook from the single latest backup.
 * Usage: CONFIRM=YES node scripts/restore-schedule.cjs
 */
const https = require("https");
if (process.env.CONFIRM !== "YES") {
  console.error("Refusing to restore without CONFIRM=YES");
  console.error("Usage: CONFIRM=YES node scripts/restore-schedule.cjs");
  process.exit(1);
}

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = https.request(
      {
        hostname: "rdg-dj-dashboard-default-rtdb.firebaseio.com",
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
          resolve({ status: res.statusCode, json, body: b });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const snap = await req("GET", "/rdg/scheduleBackups/latest.json");
  const bak = snap.json;
  if (!bak || (!bak.liveShows && !bak.calendar && !bak.shows)) {
    console.error("No latest backup found");
    process.exit(1);
  }
  const current = await req("GET", "/rdg/schedOverrides.json");
  const liveShows = bak.liveShows || bak.shows || {};
  const liveDeletes = bak.liveDeletes != null ? bak.liveDeletes : bak.deletes || null;
  const next = Object.assign({}, current.json || {}, {
    shows: liveShows,
    deletes: liveDeletes
  });
  const put = await req("PUT", "/rdg/schedOverrides.json", next);
  if (put.status !== 200) {
    console.error("Restore failed", put.status, put.body);
    process.exit(1);
  }
  console.log(
    "Restored schedule latest (" +
      (bak.savedAt || "") +
      ") — live workbook " +
      Object.keys(liveShows).length +
      " overlay shows; calendar snapshot had " +
      (bak.count || Object.keys(bak.calendar || {}).length) +
      " nights for 2025-2027."
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
