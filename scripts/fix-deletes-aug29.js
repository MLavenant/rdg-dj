const https = require('https');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        try { res(JSON.parse(d)); } catch (e) { rej(e); }
      });
    }).on('error', rej);
  });
}

function put(url, body) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res(d));
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

(async () => {
  const url = 'https://rdg-dj-dashboard-default-rtdb.firebaseio.com/rdg/schedOverrides/deletes.json';
  let dels = await get(url);
  console.log('raw', JSON.stringify(dels).slice(0, 400));

  const keys = [];
  const pushKey = (k) => {
    k = String(k || '').trim();
    if (k) keys.push(k);
  };

  (Array.isArray(dels) ? dels : [dels]).forEach((item) => {
    const s = String(item || '');
    // Recover keys if PowerShell previously joined them with spaces.
    const re = /([^|"\s][^|]*\|\d{4}-\d{2}-\d{2}(?:\|[A-Za-z0-9_]+)?)/g;
    let m;
    let found = false;
    while ((m = re.exec(s))) {
      found = true;
      pushKey(m[1]);
    }
    if (!found) pushKey(s);
  });

  console.log('parsed', keys.length);
  keys.forEach((k) => console.log(' ', k, 'segments=' + k.split('|').length));

  // Keep only uid tombstones. Drop day-level keys that hide bake forever.
  let final = keys.filter((k) => k.split('|').length >= 3);
  // Drop the failed Aug 29 add tombstone
  final = final.filter((k) => k !== 'MILA Lounge|2026-08-29|s_msgfgewj_o14k7l');
  // Dedupe
  final = Array.from(new Set(final));

  console.log('FINAL', final);
  await put(url, JSON.stringify(final));
  const verify = await get(url);
  console.log('VERIFY', verify);
  console.log('has Aug29 day key', Array.isArray(verify) && verify.includes('MILA Lounge|2026-08-29'));
  console.log('has Aug29 bake uid delete', Array.isArray(verify) && verify.some((k) => String(k).includes('s_1r7gito_20260829')));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
