/**
 * Snapshot live schedule workbook to Firebase:
 *   rdg/scheduleBackups/schedule-wYYYY-WW
 * Keeps the last 16 weekly snapshots. Safe to run anytime (overwrites this week).
 */
const https = require("https");

const HOST = "rdg-dj-dashboard-default-rtdb.firebaseio.com";
const KEEP_WEEKS = 16;

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

function isoWeekParts(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { year, week };
}

function weekKey(d) {
  const p = isoWeekParts(d);
  const ww = p.week < 10 ? "0" + p.week : String(p.week);
  return "schedule-w" + p.year + "-" + ww;
}

function displayName(d) {
  const p = isoWeekParts(d);
  return "schedule w" + p.week + " " + p.year;
}

(async () => {
  const now = new Date();
  const key = weekKey(now);
  const name = displayName(now);
  const ov = (await req("GET", "/rdg/schedOverrides.json")).json || {};
  const shows = ov.shows && typeof ov.shows === "object" ? ov.shows : {};
  const showCount = Object.keys(shows).filter((k) => shows[k]).length;
  const payload = {
    name,
    key,
    savedAt: now.toISOString(),
    showCount,
    shows,
    deletes: ov.deletes || null
  };
  const put = await req("PUT", "/rdg/scheduleBackups/" + encodeURIComponent(key) + ".json", payload);
  if (put.status !== 200) {
    console.error("Backup write failed", put.status, put.body);
    process.exit(1);
  }
  await req("PUT", "/rdg/scheduleBackups/_meta.json", {
    lastKey: key,
    lastName: name,
    lastAt: payload.savedAt,
    lastShowCount: showCount
  });
  console.log("Saved " + name + " (" + key + ") — " + showCount + " shows");

  const all = (await req("GET", "/rdg/scheduleBackups.json")).json || {};
  const keys = Object.keys(all)
    .filter((k) => k && k.indexOf("schedule-w") === 0)
    .sort();
  const drop = keys.slice(0, Math.max(0, keys.length - KEEP_WEEKS));
  for (const old of drop) {
    await req("DELETE", "/rdg/scheduleBackups/" + encodeURIComponent(old) + ".json");
    console.log("Pruned old backup " + old);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
