/**
 * Restore the live workbook from a weekly backup.
 * Usage: node scripts/restore-schedule.cjs schedule-w2026-33
 * Requires CONFIRM=YES so this cannot run by accident.
 */
const https = require("https");
const key = process.argv[2];
if (!key || key.indexOf("schedule-w") !== 0) {
  console.error("Usage: CONFIRM=YES node scripts/restore-schedule.cjs schedule-wYYYY-WW");
  process.exit(1);
}
if (process.env.CONFIRM !== "YES") {
  console.error("Refusing to restore without CONFIRM=YES");
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
  const snap = await req("GET", "/rdg/scheduleBackups/" + encodeURIComponent(key) + ".json");
  if (!snap.json || !snap.json.shows) {
    console.error("No backup found for " + key);
    process.exit(1);
  }
  const current = await req("GET", "/rdg/schedOverrides.json");
  const safetyKey = "pre-restore-" + new Date().toISOString().replace(/[:.]/g, "-");
  await req("PUT", "/rdg/scheduleBackups/" + encodeURIComponent(safetyKey) + ".json", {
    name: "pre-restore safety",
    key: safetyKey,
    savedAt: new Date().toISOString(),
    shows: (current.json && current.json.shows) || {},
    deletes: (current.json && current.json.deletes) || null
  });
  const next = Object.assign({}, current.json || {}, {
    shows: snap.json.shows,
    deletes: snap.json.deletes || null
  });
  const put = await req("PUT", "/rdg/schedOverrides.json", next);
  if (put.status !== 200) {
    console.error("Restore failed", put.status, put.body);
    process.exit(1);
  }
  console.log("Restored " + (snap.json.name || key) + " (" + Object.keys(snap.json.shows).length + " shows)");
  console.log("Safety copy of previous live data: " + safetyKey);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
