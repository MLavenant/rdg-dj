/**
 * Parse Sales + Live Entertainment workbooks and push flashPlOverlay to Firebase.
 * Usage: node scripts/upload-flash-pl-overlay.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const XLSX = require('../js/vendor/xlsx.js');

const HOST = 'rdg-dj-dashboard-default-rtdb.firebaseio.com';
const SALES_PATH = path.join(__dirname, '..', 'data', 'excel', 'rdg-sales-2026.xlsx');
const LIVE_PATH = path.join(__dirname, '..', 'data', 'excel', 'live-entertainment-report-2026.xlsx');

const FISCAL_WEEKS_445 = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5];
const SALES_MATCHERS = [
  { venue: 'Casa Neos Lounge', re: /CASA\s*NEOS\s*LOUNGE/i },
  { venue: 'Casa Neos Beach Club', re: /CASA\s*NEOS(?!\s*LOUNGE)/i },
  { venue: 'MILA Lounge', re: /MILA\s*2F/i }
];
const LIVE_SHEETS = {
  '4 - Casa Neos': 'Casa Neos Beach Club',
  '11 - CN Lounge Rooftop': 'Casa Neos Lounge',
  '10 - Mila II MM Club': 'MILA Lounge'
};

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = https.request(
      {
        hostname: HOST,
        path: p,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(b || 'null');
          } catch (e) {
            json = null;
          }
          resolve({ status: res.statusCode, json, body: b });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function flashWeekToPeriodNum(weekNum) {
  let w = +weekNum;
  if (!(w > 0)) return null;
  let start = 1;
  for (let p = 0; p < 12; p++) {
    const end = start + FISCAL_WEEKS_445[p] - 1;
    if (w >= start && w <= end) return p + 1;
    start = end + 1;
  }
  return null;
}
function flashNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/[$,\s]/g, '').replace(/\((.*)\)/, '-$1'));
  return isFinite(n) ? n : null;
}
function sheetRows(wb, name) {
  if (!wb.Sheets[name]) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
}
function parsePeriod(v) {
  if (v == null || v === '') return null;
  const m = String(v).trim().toUpperCase().match(/^P\s*(\d+)$/);
  return m ? +m[1] : null;
}
function parseWeek(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v >= 1 && v <= 53) return v;
  const m = String(v).match(/Week\s*(\d+)/i);
  return m ? +m[1] : null;
}
function findSheetName(wb, re) {
  for (let i = 0; i < wb.SheetNames.length; i++) {
    if (re.test(wb.SheetNames[i])) return wb.SheetNames[i];
  }
  return null;
}
function findWeeklySalesCols(rows, allowSumParts, year) {
  let headerRow = -1;
  const yearRe = year ? new RegExp(String(year)) : null;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    let hits = 0;
    for (let c = 0; c < (rows[i] || []).length; c++) {
      const label = rows[i][c] == null ? '' : String(rows[i][c]);
      if (/MILA\s*2F|CASA\s*NEOS/i.test(label)) hits++;
    }
    if (hits >= 2) {
      headerRow = i;
      break;
    }
  }
  const r2 = rows[headerRow] || [];
  const r3 = rows[headerRow + 1] || [];
  const r4 = rows[headerRow + 2] || [];
  const maxC = Math.max(r2.length, r3.length, r4.length);
  const out = {};
  SALES_MATCHERS.forEach((m) => {
    const total = [];
    const parts = [];
    for (let c = 0; c < maxC; c++) {
      const label = r2[c] == null ? '' : String(r2[c]);
      if (!m.re.test(label)) continue;
      if (yearRe && !yearRe.test(label)) continue;
      const seg = r3[c] == null ? '' : String(r3[c]).trim();
      const metric = r4[c] == null ? '' : String(r4[c]).trim();
      if (!/sales/i.test(metric)) continue;
      if (/^total$/i.test(seg) || /total\s*sales/i.test(metric)) total.push(c);
      else if (allowSumParts) parts.push(c);
    }
    out[m.venue] = total.length ? total : allowSumParts ? parts : [];
  });
  return { cols: out, dataStart: headerRow + 3 };
}
function detectCurrentPeriod(rows, periodCol, weekCol, colLists, dataStart) {
  let maxP = 0;
  let maxW = 0;
  const allCols = [].concat.apply([], colLists);
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] || [];
    const pn = parsePeriod(r[periodCol]);
    if (!pn) continue;
    let has = false;
    for (let c = 0; c < allCols.length; c++) {
      const v = flashNum(r[allCols[c]]);
      if (v != null && v !== 0) {
        has = true;
        break;
      }
    }
    if (has) maxP = Math.max(maxP, pn);
  }
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] || [];
    if (parsePeriod(r[periodCol]) !== maxP) continue;
    const wk = parseWeek(r[weekCol]);
    if (wk) maxW = Math.max(maxW, wk);
  }
  return { periodNum: maxP || null, week: maxW || null };
}
function sumColsForPeriod(rows, cols, periodCol, weekCol, periodNum, throughPeriod, dataStart) {
  let mtd = 0;
  let ytd = 0;
  let sawM = false;
  let sawY = false;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] || [];
    const pn = parsePeriod(r[periodCol]);
    if (!pn) continue;
    let rowSum = 0;
    let has = false;
    for (let c = 0; c < cols.length; c++) {
      const v = flashNum(r[cols[c]]);
      if (v != null) {
        rowSum += v;
        has = true;
      }
    }
    if (!has) continue;
    if (pn === periodNum) {
      mtd += rowSum;
      sawM = true;
    }
    if (pn <= throughPeriod) {
      ytd += rowSum;
      sawY = true;
    }
  }
  return { mtd: sawM ? mtd : null, ytd: sawY ? ytd : null };
}

function parseSales(wb, fileName) {
  const actualName = findSheetName(wb, /^Actual\s*-\s*(\d{4})$/i);
  if (!actualName) throw new Error('Missing Actual - YYYY sheet');
  const yearM = actualName.match(/(\d{4})/);
  const year = yearM ? +yearM[1] : 2026;
  const actualRows = sheetRows(wb, actualName);
  const actualMeta = findWeeklySalesCols(actualRows, false, year);
  const actualCols = actualMeta.cols || {};
  if (!Object.keys(actualCols).length) throw new Error('No sales venue columns found');
  const colLists = Object.keys(actualCols).map((v) => actualCols[v]);
  const cur = detectCurrentPeriod(actualRows, 1, 0, colLists, actualMeta.dataStart);
  if (!cur.periodNum) throw new Error('Could not detect current period');
  const venues = {};
  Object.keys(actualCols).forEach((venue) => {
    const s = sumColsForPeriod(actualRows, actualCols[venue], 1, 0, cur.periodNum, cur.periodNum, actualMeta.dataStart);
    venues[venue] = { salesMtdA: s.mtd, salesYtdA: s.ytd, salesMtdB: null, salesYtdB: null };
  });
  const budgetName =
    findSheetName(wb, new RegExp('^Budget\\s*-\\s*' + year + '$', 'i')) ||
    findSheetName(wb, /^Budget\s*-\s*\d{4}$/i);
  if (budgetName) {
    const budgetRows = sheetRows(wb, budgetName);
    const budgetMeta = findWeeklySalesCols(budgetRows, true, year);
    const budgetCols = budgetMeta.cols || {};
    Object.keys(budgetCols).forEach((venue) => {
      if (!venues[venue]) venues[venue] = { salesMtdA: null, salesYtdA: null, salesMtdB: null, salesYtdB: null };
      const b = sumColsForPeriod(budgetRows, budgetCols[venue], 1, 0, cur.periodNum, cur.periodNum, budgetMeta.dataStart);
      venues[venue].salesMtdB = b.mtd;
      venues[venue].salesYtdB = b.ytd;
    });
  }
  return {
    uploadedAt: new Date().toISOString(),
    fileName: fileName || '',
    year: year,
    period: 'P' + cur.periodNum,
    periodNum: cur.periodNum,
    week: cur.week,
    source: 'weekly',
    venues: venues
  };
}

function parseLive(wb, fileName) {
  const venues = {};
  const weeksFound = [];
  let dateRange = '';
  Object.keys(LIVE_SHEETS).forEach((sheetName) => {
    const venue = LIVE_SHEETS[sheetName];
    const rows = sheetRows(wb, sheetName);
    if (!rows || !rows.length) return;
    if (!dateRange && rows[1] && rows[1][0]) dateRange = String(rows[1][0]);
    let headerRow = -1;
    const weekCols = {};
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i] || [];
      let hits = 0;
      for (let c = 0; c < r.length; c++) {
        const m = r[c] != null && String(r[c]).match(/Week\s+(\d+)/i);
        if (m) {
          weekCols[+m[1]] = c;
          hits++;
          if (weeksFound.indexOf(+m[1]) < 0) weeksFound.push(+m[1]);
        }
      }
      if (hits >= 2) {
        headerRow = i;
        break;
      }
    }
    if (headerRow < 0) return;
    let liveRow = -1;
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i] && rows[i][0];
      if (a != null && /6750/.test(String(a)) && /Live\s*Entertain/i.test(String(a))) {
        liveRow = i;
        break;
      }
    }
    if (liveRow < 0) return;
    const byWeek = {};
    Object.keys(weekCols).forEach((wk) => {
      const val = flashNum(rows[liveRow][weekCols[wk]]);
      if (val != null) byWeek[String(wk)] = val;
    });
    venues[venue] = { byWeek: byWeek };
  });
  weeksFound.sort((a, b) => a - b);
  return {
    uploadedAt: new Date().toISOString(),
    fileName: fileName || '',
    dateRange: dateRange,
    weeks: weeksFound,
    venues: venues
  };
}

(async () => {
  const salesWb = XLSX.read(fs.readFileSync(SALES_PATH), { type: 'buffer' });
  const liveWb = XLSX.read(fs.readFileSync(LIVE_PATH), { type: 'buffer' });
  const sales = parseSales(salesWb, 'RDG Sales - 2026.xlsx');
  const live = parseLive(liveWb, 'Live Entertainment Report - 2026.xlsx');

  console.log('Sales week', sales.week, sales.period);
  Object.keys(sales.venues).forEach((v) => {
    const x = sales.venues[v];
    console.log('  ', v, 'MTD', Math.round(x.salesMtdA || 0), 'YTD', Math.round(x.salesYtdA || 0), 'Bud MTD', Math.round(x.salesMtdB || 0));
  });
  console.log('Live weeks', live.weeks[0], '→', live.weeks[live.weeks.length - 1], 'count', live.weeks.length);
  Object.keys(live.venues).forEach((v) => {
    const by = live.venues[v].byWeek || {};
    const keys = Object.keys(by).map(Number).sort((a, b) => a - b);
    const last = keys[keys.length - 1];
    console.log('  ', v, 'weeks', keys.length, 'last W' + last, '=', Math.round(by[String(last)] || 0));
  });

  if (sales.week !== 34) {
    console.warn('WARNING: expected Sales week 34, got', sales.week);
  }
  const lastLive = live.weeks[live.weeks.length - 1];
  if (lastLive < 33) {
    console.warn('WARNING: Live Ent last week looks early:', lastLive);
  }

  const overlay = { sales: sales, live: live };
  const put = await req('PUT', '/rdg/flashPlOverlay.json', overlay);
  if (put.status !== 200) {
    console.error('Firebase PUT failed', put.status, put.body);
    process.exit(1);
  }
  const outDir = path.join(__dirname, '..', '_local');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'flashPlOverlay-LATEST.json'), JSON.stringify(overlay, null, 2));
  console.log('Firebase flashPlOverlay updated (Sales W' + sales.week + ' ' + sales.period + ', Live through W' + lastLive + ')');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
