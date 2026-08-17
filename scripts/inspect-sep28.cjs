const https = require("https");
function get(p) {
  return new Promise((resolve, reject) => {
    https
      .get("https://rdg-dj-dashboard-default-rtdb.firebaseio.com" + p, (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b || "null"));
          } catch (e) {
            resolve(b);
          }
        });
      })
      .on("error", reject);
  });
}
(async () => {
  const ov = await get("/rdg/schedOverrides.json");
  const d = "2026-09-28";
  const v = "MILA Lounge";
  function dump(label, obj) {
    const hits = [];
    Object.keys(obj || {}).forEach((k) => {
      const e = obj[k];
      if (!e || typeof e !== "object") return;
      const venue = e.v || e.venue || "";
      const date = e.d || "";
      const keyHit = String(k).includes(d) && String(k).includes("MILA");
      if (date === d && venue === v) hits.push({ k, dj: e.dj, fee: e.fee, added: e._added, kind: e._writeKind, at: e.updatedAt, status: e.djStatus, uid: e._uid || "" });
      else if (keyHit) hits.push({ k, dj: e.dj, fee: e.fee, added: e._added, kind: e._writeKind, at: e.updatedAt, via: "key" });
    });
    console.log("\n== " + label + " (" + hits.length + ") ==");
    hits.forEach((h) => console.log(JSON.stringify(h)));
  }
  dump("shows (workbook)", ov.shows);
  dump("addsByUid", ov.addsByUid);
  dump("editsByUid", ov.editsByUid);
  dump("edits[]", ov.edits);
  const dels = Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes || {});
  console.log("\n== deletes mentioning 09-28 ==");
  dels.filter((k) => String(k).includes("2026-09-28")).forEach((k) => console.log(k));
  const legacy = Array.isArray(ov.adds) ? ov.adds : Object.values(ov.adds || {});
  console.log("\n== legacy adds 09-28 ==");
  legacy.filter((r) => r && r.d === d && (r.v || r.venue) === v).forEach((r) => console.log(JSON.stringify(r)));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
