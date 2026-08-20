'use strict';
var XLSX=require('xlsx');
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

assert(flashWeekToPeriodNum(26)===6, 'Week 26 → P6');
assert(flashWeekToPeriodNum(31)===8, 'Week 31 → P8');
assert(flashWeekToPeriodNum(33)===8, 'Week 33 → P8');

var salesMap={
  'CASA NEOS Sales':'Casa Neos Beach Club',
  'CN Lounge Sales':'Casa Neos Lounge',
  'MILA Sales - 2F':'MILA Lounge'
};
var liveMap={
  '4 - Casa Neos':'Casa Neos Beach Club',
  '11 - CN Lounge Rooftop':'Casa Neos Lounge',
  '10 - Mila II MM Club':'MILA Lounge'
};

var wb=XLSX.readFile('_tmp_sales.xlsx');
Object.keys(salesMap).forEach(function(sheet){
  var rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null,raw:true});
  var mtdCol=9, ytdCol=13, period=null, week=null, totalIdx=-1, budgetIdx=-1, i, c, r, cell;
  for(i=0;i<12;i++){
    r=rows[i]||[];
    for(c=0;c<r.length;c++){
      cell=r[c]==null?'':String(r[c]);
      if(/^P\d+$/i.test(cell.trim()) && !period) period=cell.trim().toUpperCase();
      if(/MTD/i.test(cell) && mtdCol===9) mtdCol=c;
      if(/^YTD$/i.test(cell.trim())) ytdCol=c;
      if(typeof r[c]==='number' && r[c]>=1 && r[c]<=53 && week==null && i<=2) week=r[c];
    }
  }
  for(i=0;i<rows.length;i++){
    r=rows[i]||[];
    for(c=0;c<6;c++){
      if(r[c]!=null && String(r[c]).trim().toUpperCase()==='TOTAL'){ totalIdx=i; break; }
    }
    if(totalIdx>=0) break;
  }
  for(i=totalIdx+1;i<totalIdx+4;i++){
    r=rows[i]||[];
    for(c=0;c<6;c++){
      if(r[c]!=null && String(r[c]).trim().toUpperCase()==='BUDGET'){ budgetIdx=i; break; }
    }
    if(budgetIdx>=0) break;
  }
  var mtdA=flashNum(rows[totalIdx][mtdCol]);
  var mtdB=flashNum(rows[budgetIdx][mtdCol]);
  console.log(salesMap[sheet], period, 'wk', week, 'MTD', Math.round(mtdA), 'vs', Math.round(mtdB));
  assert(period==='P8', salesMap[sheet]+' period P8');
  assert(mtdA!=null && mtdA>0, salesMap[sheet]+' has MTD sales');
  assert(mtdB!=null && mtdB>0, salesMap[sheet]+' has MTD budget');
});

var wbl=XLSX.readFile('_tmp_live.xlsx');
Object.keys(liveMap).forEach(function(sheet){
  var rows=XLSX.utils.sheet_to_json(wbl.Sheets[sheet],{header:1,defval:null,raw:true});
  var weekCols={}, liveRow=-1, i, c, r, m, a;
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
  var mtd=0, n=0;
  Object.keys(weekCols).forEach(function(wk){
    var p=flashWeekToPeriodNum(+wk);
    var v=flashNum(rows[liveRow][weekCols[wk]]);
    if(p===8 && v!=null){ mtd+=v; n++; }
  });
  console.log(liveMap[sheet], 'liveRow', liveRow, 'P8 weeks', n, 'P8 live MTD', Math.round(mtd));
  assert(liveRow>=0, liveMap[sheet]+' finds GL 6750');
  assert(n>=1 && mtd>0, liveMap[sheet]+' has P8 live MTD');
});

console.log('\nAll flash PL parse checks passed.');
