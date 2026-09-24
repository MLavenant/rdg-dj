'use strict';
/**
 * Grab a FourVenues / Casa Neos booking floor plan the same way we did for Oct 3:
 * open URL → BOOK YOUR TABLE on first live date → capture GLB + hotspot tiers →
 * parse table nodes → write roiFloorPlans drop (with full plan payload) to Firebase.
 *
 * Usage:
 *   node scripts/ingest-booking-floor-plan.cjs --url https://beachclub.casa-neos.com/ --date 2026-10-03 --venue "Casa Neos Beach Club"
 *   node scripts/ingest-booking-floor-plan.cjs --process-queue
 */
const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');
const path = require('path');

const FB_HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}
function hasFlag(name) {
  return process.argv.includes('--' + name);
}

function fbGet(fbPath) {
  return new Promise((resolve) => {
    https
      .get(`https://${FB_HOST}${fbPath}.json`, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d || 'null'));
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}
function fbPut(fbPath, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: FB_HOST,
        path: fbPath + '.json',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      },
      (r) => {
        r.resume();
        r.on('end', () => resolve(r.statusCode || 0));
      }
    );
    req.on('error', () => resolve(0));
    req.write(body);
    req.end();
  });
}

function download(url, file) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(file);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          f.close();
          try {
            fs.unlinkSync(file);
          } catch (e) {}
          return download(res.headers.location, file).then(resolve, reject);
        }
        res.pipe(f);
        f.on('finish', () => {
          f.close();
          resolve();
        });
      })
      .on('error', reject);
  });
}

function parseGlbNodes(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  return (json.nodes || [])
    .filter((n) => /^S_/i.test(n.name || ''))
    .map((n) => ({
      id: String(n.name).replace(/^S_/i, ''),
      t: n.translation || [0, 0, 0]
    }));
}

function parseMoney(text) {
  const m = String(text || '').replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? Math.round(+m[1]) : 0;
}

function matchTiersToTables(nodes, hotspots) {
  if (!nodes.length || !hotspots.length) {
    return { byTier: {}, hotspots: {}, assigned: 0, total: (nodes || []).length };
  }
  const ids = nodes.map((n) => n.id);
  const minX = Math.min(...nodes.map((n) => n.t[0]));
  const maxX = Math.max(...nodes.map((n) => n.t[0]));
  const minZ = Math.min(...nodes.map((n) => n.t[2]));
  const maxZ = Math.max(...nodes.map((n) => n.t[2]));
  const proj = nodes.map((n) => ({
    id: n.id,
    px: (n.t[0] - minX) / (maxX - minX || 1),
    // higher Z (front) → higher screen Y
    py: 1 - (n.t[2] - minZ) / (maxZ - minZ || 1),
    t: n.t
  }));
  const minHX = Math.min(...hotspots.map((h) => h.x));
  const maxHX = Math.max(...hotspots.map((h) => h.x));
  const minHY = Math.min(...hotspots.map((h) => h.y));
  const maxHY = Math.max(...hotspots.map((h) => h.y));
  const hn = hotspots.map((h) => ({
    ...h,
    px: (h.x - minHX) / (maxHX - minHX || 1),
    py: (h.y - minHY) / (maxHY - minHY || 1)
  }));
  const used = new Set();
  const byTier = {};
  const hotspotsOut = {};
  hn.forEach((h) => {
    let best = null;
    let bestD = Infinity;
    proj.forEach((p) => {
      if (used.has(p.id)) return;
      const d = (h.px - p.px) ** 2 + (h.py - p.py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    if (!best) return;
    used.add(best.id);
    const tier = h.tier;
    if (!byTier[tier]) byTier[tier] = { tables: [], minimum: h.minimum || 0, capacity: h.capacity || 8 };
    byTier[tier].tables.push(best.id);
    if (h.minimum > byTier[tier].minimum) byTier[tier].minimum = h.minimum;
    if (h.capacity) byTier[tier].capacity = h.capacity;
    hotspotsOut[best.id] = [best.t[0], Math.max(best.t[1], 0.9) + 0.1, best.t[2]];
  });
  // leftover nodes: leave unassigned
  return { byTier, hotspots: hotspotsOut, assigned: used.size, total: ids.length };
}

const TIER_COLORS = {
  GRAND: 'rgb(24,24,27)',
  PREMIER: 'rgb(37,99,235)',
  SIGNATURE: 'rgb(234,179,8)',
  SELECT: 'rgb(147,51,234)',
  RESERVE: 'rgb(220,38,38)',
  DIAMOND: 'rgb(3,169,244)',
  PRESTIGE: 'rgb(139,195,74)',
  PLATINUM: 'rgb(158,158,158)',
  GOLD: 'rgb(251,192,45)',
  RIVERWALK: 'rgb(245,127,23)',
  SLIP: 'rgb(96,165,250)',
  LOUNGE: 'rgb(196,181,253)'
};
const TIER_ORDER = ['GRAND', 'PREMIER', 'SIGNATURE', 'SELECT', 'RESERVE', 'DIAMOND', 'PRESTIGE', 'PLATINUM', 'GOLD', 'RIVERWALK', 'SLIP', 'LOUNGE'];

function guessVenue(url) {
  if (/lounge\.casa-neos/i.test(url)) return 'Casa Neos Lounge';
  if (/beachclub|beach.?club|casa-neos(?!.*lounge)/i.test(url)) return 'Casa Neos Beach Club';
  if (/mila/i.test(url)) return 'MILA Lounge';
  return 'Casa Neos Beach Club';
}

function guessModelKey(venue) {
  if (venue === 'Casa Neos Lounge') return 'casa-neos-lounge';
  if (venue === 'MILA Lounge') return 'mila-lounge';
  return 'casa-neos-beach-club';
}

async function scrapePlan({ url, dateStr, venue }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const glbs = [];
  page.on('response', (res) => {
    if (/\.glb(\?|$)/i.test(res.url())) glbs.push(res.url());
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);

  // Prefer iframe if present
  let target = page;
  for (const f of page.frames()) {
    if (/fourvenues|iframe|casa-neos|mila/i.test(f.url()) && f !== page.mainFrame()) {
      target = f;
      break;
    }
  }

  const books = target.getByText(/BOOK YOUR TABLE/i);
  const bn = await books.count().catch(() => 0);
  let clickIdx = -1;
  const dateTok = dateStr
    ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase().replace(',', '')
    : '';
  // e.g. OCT 3
  const want = dateStr
    ? [
        dateTok,
        new Date(dateStr + 'T12:00:00')
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          .toUpperCase()
      ]
    : [];

  for (let i = 0; i < bn; i++) {
    const ctx = await books
      .nth(i)
      .evaluate((el) => {
        let p = el;
        for (let k = 0; k < 12 && p; k++) {
          const t = (p.innerText || '').replace(/\s+/g, ' ');
          if (/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d+/i.test(t) && t.length < 400) return t;
          p = p.parentElement;
        }
        return '';
      })
      .catch(() => '');
    console.log('book', i, ctx.slice(0, 120));
    if (!dateStr) {
      clickIdx = i;
      continue;
    }
    const up = ctx.toUpperCase();
    if (want.some((w) => up.includes(w.replace(/\s+/g, ' ')))) {
      clickIdx = i;
      break;
    }
    // OCT 03 vs OCT 3
    const m = dateStr.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (m) {
      const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][+m[1] - 1];
      const day = String(+m[2]);
      if (up.includes(mon) && (up.includes(mon + ' ' + day) || up.includes(mon + ' 0' + day))) {
        clickIdx = i;
        break;
      }
    }
  }
  if (clickIdx < 0 && bn) clickIdx = bn - 1;
  if (clickIdx < 0) throw new Error('No BOOK YOUR TABLE controls found on ' + url);

  const before = glbs.length;
  await books.nth(clickIdx).click({ timeout: 15000 });
  await page.waitForTimeout(12000);

  const afterGlbs = glbs.slice(before);
  let modelUrl = afterGlbs[afterGlbs.length - 1] || glbs[glbs.length - 1];
  // Prefer non-rooftop new/model when multiple
  const preferred = [...afterGlbs, ...glbs].filter((u) => /new\.glb|model-new|model2|lounge\/model/i.test(u));
  if (preferred.length) modelUrl = preferred[preferred.length - 1];
  if (!modelUrl) throw new Error('No GLB loaded after clicking BOOK YOUR TABLE');

  const hotspots = [];
  const caps = {};
  for (const f of [page, ...page.frames()]) {
    try {
      const data = await f.evaluate(() => {
        const legend = {};
        [...document.querySelectorAll('body *')].forEach((el) => {
          const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
          const m = t.match(/^(DIAMOND|PRESTIGE|PLATINUM|GOLD|RIVERWALK|SLIP|LOUNGE)\s+(\d+)\s*$/i);
          if (m && t.length < 40) legend[m[1].toUpperCase()] = +m[2];
        });
        const hs = [...document.querySelectorAll('[data-object-hotspot-id], .hotspot-touch-passthrough')]
          .map((el) => {
            const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
            const tierM = text.match(/\b(DIAMOND|PRESTIGE|PLATINUM|GOLD|RIVERWALK|SLIP|LOUNGE)\b/i);
            if (!tierM) return null;
            const r = el.getBoundingClientRect();
            const money = text.replace(/,/g, '').match(/\$?\s*(\d+)/);
            return {
              tier: tierM[1].toUpperCase(),
              minimum: money ? +money[1] : 0,
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
              text
            };
          })
          .filter(Boolean);
        return { legend, hs };
      });
      if (data.hs && data.hs.length) {
        hotspots.push(...data.hs);
        Object.assign(caps, data.legend || {});
      }
    } catch (e) {}
  }

  const tmp = path.join(__dirname, '..', '_tmp_ingest_model.glb');
  await download(modelUrl, tmp);
  const nodes = parseGlbNodes(tmp);
  console.log('GLB', modelUrl, 'nodes', nodes.length, 'hotspots', hotspots.length);

  const matched = matchTiersToTables(
    nodes,
    hotspots.map((h) => ({
      ...h,
      capacity: caps[h.tier] || 8
    }))
  );

  const tables = [];
  TIER_ORDER.forEach((name) => {
    const t = matched.byTier[name];
    if (!t || !t.tables.length) return;
    tables.push({
      name,
      color: TIER_COLORS[name] || 'rgb(200,200,200)',
      minimum: t.minimum || 0,
      capacity: t.capacity || caps[name] || 8,
      tables: t.tables.slice().sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    });
  });
  Object.keys(matched.byTier).forEach((name) => {
    if (TIER_ORDER.includes(name)) return;
    const t = matched.byTier[name];
    tables.push({
      name,
      color: 'rgb(200,200,200)',
      minimum: t.minimum || 0,
      capacity: t.capacity || 8,
      tables: t.tables
    });
  });

  await browser.close();
  try {
    fs.unlinkSync(tmp);
  } catch (e) {}

  if (!tables.length) throw new Error('Could not map any tables/tiers from the floor plan');

  return {
    modelUrl,
    modelKey: guessModelKey(venue),
    tables,
    hotspots: matched.hotspots,
    badge: 'Grabbed from booking site',
    badgeColor: '#c2410c',
    label: (venue || 'Venue') + ' floor plan',
    meta: { assigned: matched.assigned, nodeCount: nodes.length, hotspotCount: hotspots.length, caps }
  };
}

async function saveDrop({ venue, start, end, sourceUrl, plan, uid, refresh }) {
  const drops = (await fbGet('/rdg/roiFloorPlans')) || {};
  const id = uid || 'fp_grab_' + Date.now().toString(36);
  const prev = drops[id] || {};

  if (!refresh) {
    // Close earlier open-ended drops for venue (new schedule switchover only)
    const dayBefore = (() => {
      const dt = new Date(start + 'T12:00:00');
      dt.setDate(dt.getDate() - 1);
      return dt.toISOString().slice(0, 10);
    })();
    Object.keys(drops).forEach((k) => {
      const o = drops[k];
      if (!o || o.venue !== venue || k === id) return;
      if (o.start >= start) return;
      if (o.end) return;
      o.end = dayBefore;
      o.updatedAt = new Date().toISOString();
    });
  }

  drops[id] = {
    _uid: id,
    label: prev.label || plan.label || venue + ' grabbed plan',
    venue,
    start: refresh && prev.start ? prev.start : start,
    end: end != null && end !== '' ? end : prev.end || '',
    sourceUrl: sourceUrl || prev.sourceUrl || '',
    preset: prev.preset || null,
    status: 'ready',
    plan,
    createdAt: prev.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seeded: false,
    grabbed: true,
    lastRefreshDate: start
  };
  const code = await fbPut('/rdg/roiFloorPlans', drops);
  console.log('Firebase roiFloorPlans PUT', code, 'uid', id, refresh ? '(refresh)' : '');
  return { id, code, drop: drops[id] };
}

async function processQueue() {
  const q = (await fbGet('/rdg/floorPlanIngestRequests')) || {};
  const ids = Object.keys(q).filter((id) => q[id] && (q[id].status === 'queued' || q[id].status === 'pending'));
  if (!ids.length) {
    console.log('No queued ingest requests');
    return;
  }
  for (const id of ids) {
    const req = q[id];
    console.log('Processing', id, req.url, req.start, req.refresh ? 'refresh' : '');
    q[id] = { ...req, status: 'running', updatedAt: new Date().toISOString() };
    await fbPut('/rdg/floorPlanIngestRequests', q);
    try {
      const plan = await scrapePlan({
        url: req.url,
        dateStr: req.start,
        venue: req.venue
      });
      plan.label = req.label || plan.label;
      const saved = await saveDrop({
        venue: req.venue,
        start: req.start,
        end: req.end || '',
        sourceUrl: req.url,
        plan,
        uid: req.dropUid || id,
        refresh: !!req.refresh
      });
      q[id] = {
        ...req,
        status: 'done',
        dropUid: saved.id,
        modelUrl: plan.modelUrl,
        tableCount: plan.tables.reduce((n, t) => n + t.tables.length, 0),
        updatedAt: new Date().toISOString()
      };
    } catch (e) {
      console.error(e);
      q[id] = { ...req, status: 'error', error: String(e.message || e), updatedAt: new Date().toISOString() };
      if (req.dropUid) {
        const drops = (await fbGet('/rdg/roiFloorPlans')) || {};
        if (drops[req.dropUid]) {
          drops[req.dropUid].status = 'error';
          drops[req.dropUid].error = String(e.message || e);
          drops[req.dropUid].updatedAt = new Date().toISOString();
          await fbPut('/rdg/roiFloorPlans', drops);
        }
      }
    }
    await fbPut('/rdg/floorPlanIngestRequests', q);
  }
}

(async () => {
  try {
    require.resolve('playwright');
  } catch (e) {
    module.paths.push(path.join(__dirname, '..', 'node_modules'));
    module.paths.push(path.join(__dirname, '..', '..', 'boh-dashboard', 'node_modules'));
  }

  if (hasFlag('process-queue')) {
    await processQueue();
    return;
  }
  const url = arg('url');
  const dateStr = arg('date');
  const venue = arg('venue', url ? guessVenue(url) : 'Casa Neos Beach Club');
  if (!url || !dateStr) {
    console.log('Usage: --url <bookingUrl> --date YYYY-MM-DD [--venue "Casa Neos Beach Club"]');
    console.log('   or: --process-queue');
    process.exit(1);
  }
  const plan = await scrapePlan({ url, dateStr, venue });
  console.log(
    'Plan tiers',
    plan.tables.map((t) => t.name + '×' + t.tables.length + ' @' + t.minimum).join(', ')
  );
  const saved = await saveDrop({ venue, start: dateStr, sourceUrl: url, plan });
  console.log('Saved drop', saved.id, 'tables', plan.tables.reduce((n, t) => n + t.tables.length, 0));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
