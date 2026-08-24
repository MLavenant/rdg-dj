'use strict';
var fs=require('fs');
var path=require('path');
var XLSX=require('../js/vendor/xlsx.js');
function readWb(rel){
  var p=path.resolve(__dirname, '..', rel);
  return XLSX.read(fs.readFileSync(p), {type:'buffer'});
}
var FISCAL_WEEKS_445=[4,4,5,4,4,5,4,4,5,4,4,5];
function flashWeekToPeriodNum(weekNum){
  var w=+weekNum, start=1, p, end;
  for(p=0;p<12;p++){
    end=start+FISCAL_WEEKS_445[p]-1;
    if(w>=start && w<=end) return p+1;
    start=end+1;
  }
  return null;
}
function flashNum(v){
  if(v==null || v==='') return null;
  if(typeof v==='number' && isFinite(v)) return v;
  var n=parseFloat(String(v).replace(/[$,\s]/g,'').replace(/\((.*)\)/,'-$1'));
  return isFinite(n)?n:null;
}
function assert(cond, msg){
  if(!cond) throw new Error('FAIL: '+msg);
  console.log('ok — '+msg);
}
function sheetRows(wb, name){
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, defval:null, raw:true});
}
function parsePeriod(v){
  if(v==null||v==='') return null;
  var m=String(v).trim().toUpperCase().match(/^P\s*(\d+)$/);
  return m?+m[1]:null;
}
function parseWeek(v){
  if(v==null||v==='') return null;
  if(typeof v==='number' && v>=1 && v<=53) return v;
  var m=String(v).match(/Week\s*(\d+)/i);
  return m?+m[1]:null;
}
var matchers=[
  { venue:'Casa Neos Lounge', re:/CASA\s*NEOS\s*LOUNGE/i },
  { venue:'Casa Neos Beach Club', re:/CASA\s*NEOS(?!\s*LOUNGE)/i },
  { venue:'MILA Lounge', re:/MILA\s*2F/i }
];
function findCols(rows, allowSumParts, year){
  var headerRow=-1, i, c, label, hits;
  var yearRe=year?new RegExp(String(year)):null;
  for(i=0;i<Math.min(rows.length,8);i++){
    hits=0;
    for(c=0;c<(rows[i]||[]).length;c++){
      label=rows[i][c]==null?'':String(rows[i][c]);
      if(/MILA\s*2F|CASA\s*NEOS/i.test(label)) hits++;
    }
    if(hits>=2){ headerRow=i; break; }
  }
  var r2=rows[headerRow]||[], r3=rows[headerRow+1]||[], r4=rows[headerRow+2]||[];
  var maxC=Math.max(r2.length,r3.length,r4.length), out={};
  matchers.forEach(function(m){
    var total=[], parts=[], seg, metric;
    for(c=0;c<maxC;c++){
      label=r2[c]==null?'':String(r2[c]);
      if(!m.re.test(label)) continue;
      if(yearRe && !yearRe.test(label)) continue;
      seg=r3[c]==null?'':String(r3[c]).trim();
      metric=r4[c]==null?'':String(r4[c]).trim();
      if(!/sales/i.test(metric)) continue;
      if(/^total$/i.test(seg) || /total\s*sales/i.test(metric)) total.push(c);
      else if(allowSumParts) parts.push(c);
    }
    out[m.venue]=total.length?total:(allowSumParts?parts:[]);
  });
  return { cols:out, dataStart:headerRow+3 };
}
function sumPeriod(rows, cols, periodCol, periodNum, dataStart){
  var mtd=0,ytd=0,sawM=false,sawY=false,i,r,pn,c,v,rowSum,has;
  for(i=dataStart;i<rows.length;i++){
    r=rows[i]||[];
    pn=parsePeriod(r[periodCol]);
    if(!pn) continue;
    rowSum=0; has=false;
    for(c=0;c<cols.length;c++){
      v=flashNum(r[cols[c]]);
      if(v!=null){ rowSum+=v; has=true; }
    }
    if(!has) continue;
    if(pn===periodNum){ mtd+=rowSum; sawM=true; }
    if(pn<=periodNum){ ytd+=rowSum; sawY=true; }
  }
  return { mtd:sawM?mtd:null, ytd:sawY?ytd:null };
}

assert(flashWeekToPeriodNum(26)===6, 'Week 26 → P6');
assert(flashWeekToPeriodNum(31)===8, 'Week 31 → P8');
assert(flashWeekToPeriodNum(33)===8, 'Week 33 → P8');

var wb=readWb('_tmp_sales.xlsx');
assert(!!wb.Sheets['Actual - 2026'], 'has Actual - 2026');
assert(!!wb.Sheets['Budget - 2026'], 'has Budget - 2026');

var actual=sheetRows(wb, 'Actual - 2026');
var aMeta=findCols(actual, false, 2026);
var aCols=aMeta.cols;
assert(aCols['Casa Neos Beach Club'].length===1, 'Actual finds CASA NEOS Total');
assert(aCols['Casa Neos Lounge'].length===1, 'Actual finds LOUNGE Total');
assert(aCols['MILA Lounge'].length===1, 'Actual finds MILA 2F Total');

var maxP=0, maxW=0, i, r, pn, wk, hasSales, c, v;
var allCols=[].concat(aCols['Casa Neos Beach Club'], aCols['Casa Neos Lounge'], aCols['MILA Lounge']);
for(i=aMeta.dataStart;i<actual.length;i++){
  r=actual[i]||[];
  pn=parsePeriod(r[1]);
  if(!pn) continue;
  hasSales=false;
  for(c=0;c<allCols.length;c++){
    v=flashNum(r[allCols[c]]);
    if(v!=null && v!==0){ hasSales=true; break; }
  }
  if(hasSales) maxP=Math.max(maxP, pn);
}
for(i=aMeta.dataStart;i<actual.length;i++){
  r=actual[i]||[];
  if(parsePeriod(r[1])!==maxP) continue;
  wk=parseWeek(r[0]);
  if(wk) maxW=Math.max(maxW, wk);
}
assert(maxP===8, 'current period is P8 (not empty P9+)');
assert(maxW===34, 'current week in P8 is 34');

var neos=sumPeriod(actual, aCols['Casa Neos Beach Club'], 1, 8, aMeta.dataStart);
var lounge=sumPeriod(actual, aCols['Casa Neos Lounge'], 1, 8, aMeta.dataStart);
var mila=sumPeriod(actual, aCols['MILA Lounge'], 1, 8, aMeta.dataStart);
console.log('Actual P8 MTD', Math.round(neos.mtd), Math.round(lounge.mtd), Math.round(mila.mtd));
assert(Math.round(neos.mtd)===1654780, 'CASA NEOS P8 MTD ~1.655M (through W34)');
assert(Math.round(lounge.mtd)===432279, 'LOUNGE P8 MTD ~432K (through W34)');
assert(Math.round(mila.mtd)===675580, 'MILA P8 MTD ~676K (through W34)');

var budget=sheetRows(wb, 'Budget - 2026');
var bMeta=findCols(budget, true, 2026);
var bCols=bMeta.cols;
assert(bCols['Casa Neos Beach Club'].length>=1, 'Budget finds CASA NEOS');
assert(bCols['Casa Neos Lounge'].length>=1, 'Budget finds LOUNGE');
assert(bCols['MILA Lounge'].length>=3, 'Budget MILA sums Omakase+MM+Lounge');
var bNeos=sumPeriod(budget, bCols['Casa Neos Beach Club'], 1, 8, bMeta.dataStart);
var bLounge=sumPeriod(budget, bCols['Casa Neos Lounge'], 1, 8, bMeta.dataStart);
var bMila=sumPeriod(budget, bCols['MILA Lounge'], 1, 8, bMeta.dataStart);
console.log('Budget P8 MTD', Math.round(bNeos.mtd), Math.round(bLounge.mtd), Math.round(bMila.mtd));
assert(Math.round(bNeos.mtd)===1862024, 'CASA NEOS P8 budget');
assert(Math.round(bLounge.mtd)===971234, 'LOUNGE P8 budget');
assert(Math.round(bMila.mtd)===1068950, 'MILA P8 budget');

var liveMap={
  '4 - Casa Neos':'Casa Neos Beach Club',
  '11 - CN Lounge Rooftop':'Casa Neos Lounge',
  '10 - Mila II MM Club':'MILA Lounge'
};
var wbl=readWb('_tmp_live.xlsx');
Object.keys(liveMap).forEach(function(sheet){
  var rows=sheetRows(wbl, sheet);
  var weekCols={}, liveRow=-1, m, a;
  for(i=0;i<10;i++){
    r=rows[i]||[];
    for(c=0;c<r.length;c++){
      m=r[c]!=null && String(r[c]).match(/Week\s+(\d+)/i);
      if(m) weekCols[+m[1]]=c;
    }
  }
  for(i=0;i<rows.length;i++){
    a=rows[i]&&rows[i][0];
    if(a!=null && /6750/.test(String(a)) && /Live\s*Entertain/i.test(String(a))){ liveRow=i; break; }
  }
  var mtd=0, n=0, maxWk=0;
  Object.keys(weekCols).forEach(function(w){
    var p=flashWeekToPeriodNum(+w);
    var val=flashNum(rows[liveRow][weekCols[w]]);
    if(p===8 && val!=null){ mtd+=val; n++; maxWk=Math.max(maxWk, +w); }
  });
  console.log(liveMap[sheet], 'P8 live MTD', Math.round(mtd), 'through W'+maxWk);
  assert(liveRow>=0, liveMap[sheet]+' finds GL 6750');
  assert(n>=1 && mtd>0, liveMap[sheet]+' has P8 live MTD');
  assert(maxWk===34, liveMap[sheet]+' Live Ent through Week 34');
});

console.log('\nAll flash PL parse checks passed (Week 34).');

/* CASA NEOS / CN LOUNGE / MILA II daily sales + EBITDA */
function parseDailyBlocks(wb, sheet, blocks){
  var rows=sheetRows(wb,sheet);
  if(!rows||!rows.length) return null;
  function xlIso(serial){
    if(serial==null||typeof serial!=='number'||!isFinite(serial)) return null;
    return new Date(Date.UTC(1899,11,30+serial)).toISOString().slice(0,10);
  }
  var byDate={};
  blocks.forEach(function(b){
    var off=b.off, key=b.key;
    for(var i=1;i<rows.length;i++){
      var r=rows[i]||[];
      var iso=xlIso(r[off+4]);
      var sales=flashNum(r[off+1]);
      if(!iso||sales==null||sales<=0) continue;
      if(!byDate[iso]) byDate[iso]={total:0};
      byDate[iso][key]=sales;
    }
  });
  Object.keys(byDate).forEach(function(iso){
    var sum=0;
    blocks.forEach(function(b){ sum+=(+byDate[iso][b.key]||0); });
    byDate[iso].total=sum;
  });
  return byDate;
}
var salesWb=readWb('data/excel/rdg-sales-2026.xlsx');
var cnDaily=parseDailyBlocks(salesWb,'CASA NEOS',[{off:0,key:'dinner'},{off:8,key:'lunch'}]);
var cnlDaily=parseDailyBlocks(salesWb,'CN LOUNGE',[{off:0,key:'dinner'},{off:8,key:'lunch'}]);
var milaDaily=parseDailyBlocks(salesWb,'MILA II',[{off:0,key:'part1'},{off:8,key:'part2'},{off:16,key:'part3'}]);
assert(cnDaily&&cnDaily['2026-08-22'], 'CASA NEOS daily has Aug 22');
assert(Math.round(cnDaily['2026-08-22'].total)===106392, 'Aug 22 CN BC total lunch+dinner');
assert(cnlDaily&&cnlDaily['2026-08-21'], 'CN LOUNGE daily has Aug 21');
assert(Math.round(cnlDaily['2026-08-21'].total)===48668, 'CN Lounge Aug 21 ~49k');
assert(milaDaily&&milaDaily['2026-08-22'], 'MILA II daily has Aug 22');
assert(Math.round(milaDaily['2026-08-22'].total)===67183, 'MILA Aug 22 ~67k');
var OPEX_CNBC={
  payroll:0.08228038213730282,directExLive:0.029494881479329382,ga:0.02689639259651702,
  utilities:0.003994385350264044,occupancy:0.024495221916497185,other:-0.01376450002563533,
  corporate:0.023314557961478643
};
var OPEX_MILA={
  payroll:0.3220454143214509,directExLive:0.1084126407129456,ga:0.13499135553470915,
  utilities:0.010275770794246403,occupancy:0.10741961382113821,other:-0.06502210131332083,
  corporate:0.11212015009380862
};
function calcEbitda(sales,dj,o){
  var lbw=sales*0.62, food=sales*0.34, bev=sales*0.04;
  var cogs=lbw*0.15+food*0.265+bev*0.28;
  var gp=sales-cogs;
  return Math.round(gp-sales*o.payroll-sales*o.directExLive-dj-sales*o.ga-sales*o.utilities-sales*o.occupancy-sales*o.other-sales*o.corporate);
}
assert(calcEbitda(cnDaily['2026-08-22'].total,500,OPEX_CNBC)===66420, 'BARUT Sat EBITDA ~66k');
assert(calcEbitda(milaDaily['2026-08-22'].total,10000,OPEX_MILA)===-4931, 'MILA AJNA Sat EBITDA ~-5k (higher payroll model)');
assert(calcEbitda(61500,4000,OPEX_MILA)===641, 'MILA template $61.5k sales / $4k DJ → ~$641 EBITDA');
console.log('ok — all venues daily EBITDA sources');

