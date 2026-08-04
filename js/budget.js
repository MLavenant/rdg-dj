function renderBudget(){
  if(bgtMonth) renderMonthDrill(bgtMonth);
  else renderYearGrid();
}

/*     YEAR GRID                                                 */
/*                                                                
   MONTHLY DJ $ BUDGET   a second dimension alongside BS/ROI.
   Editable per venue/year/month, persisted like the other rule sets.
   Populate with real figures via the "DJ Guest Budget" reference file
   (2025-2026 tab) once available   defaults to blank/editable for now.
                                                                   */
var MONTHLY_DJ_BUDGET = {"MILA Lounge":{"2025":{"10":52500,"11":57750,"12":220500,"01":105000,"02":73500,"03":131250,"04":57750,"05":220500,"06":36750,"07":36750,"08":36750,"09":36750},"2026":{"10":52500,"11":57750,"12":220500,"01":105000,"02":73500,"03":131250,"04":57750,"05":220500,"06":80000,"07":80000,"08":36750,"09":36750},"2027":{"10":52500,"11":57750,"12":220500,"01":105000,"02":73500,"03":131250,"04":57750,"05":220500,"06":80000,"07":80000,"08":36750,"09":36750}},"Casa Neos Lounge":{"2026":{"10":52500,"11":57750,"12":100000,"01":null,"02":null,"03":160000,"04":60000,"05":100000,"06":70000,"07":70000,"08":36750,"09":36750},"2027":{"10":52500,"11":57750,"12":100000,"01":null,"02":null,"03":160000,"04":60000,"05":100000,"06":70000,"07":70000,"08":36750,"09":36750}},"Casa Neos Beach Club":{"2025":{"10":30000,"11":37500,"12":150000,"01":109500,"02":103500,"03":94500,"04":55500,"05":85500,"06":21000,"07":21000,"08":21000,"09":21000},"2026":{"10":50000,"11":81000,"12":550000,"01":200000,"02":103500,"03":150000,"04":70000,"05":350000,"06":100000,"07":100000,"08":41000,"09":41000},"2027":{"10":50000,"11":81000,"12":550000,"01":200000,"02":103500,"03":150000,"04":70000,"05":350000,"06":100000,"07":100000,"08":41000,"09":41000}}}; /* 2024-2025 tab maps to calendar 2025; 2025-2026 maps to 2026; Lounge was not open in 2024-25; 2027 carried from 2026 */
function isMisassigned2024Budget(venue,year){
  return year==='2024'&&(venue==='MILA Lounge'||venue==='Casa Neos Beach Club');
}
function loadSavedMonthlyBudget(){
  try{
    var saved=localStorage.getItem('rdg_monthly_dj_budget');
    if(!saved) return;
    var parsed=JSON.parse(saved);
    if(!parsed||typeof parsed!=='object') return;
    /* Deep-merge saved edits ON TOP of the seeded defaults, so real reference
       data (e.g. from BUDGET_RDG.xlsx) survives unless a specific month was
       explicitly edited by the user. */
    Object.keys(parsed).forEach(function(venue){
      if(!MONTHLY_DJ_BUDGET[venue]) MONTHLY_DJ_BUDGET[venue]={};
      Object.keys(parsed[venue]).forEach(function(year){
        if(isMisassigned2024Budget(venue,year)) return;
        if(!MONTHLY_DJ_BUDGET[venue][year]) MONTHLY_DJ_BUDGET[venue][year]={};
        Object.keys(parsed[venue][year]).forEach(function(mm){
          var val=parsed[venue][year][mm];
          if(val!=null) MONTHLY_DJ_BUDGET[venue][year][mm]=val;
        });
      });
    });
  }catch(e){}
}
function saveMonthlyBudget(){
  try{ localStorage.setItem('rdg_monthly_dj_budget', JSON.stringify(MONTHLY_DJ_BUDGET)); }catch(e){}
  if(window._fbSave) window._fbSave('monthlyDjBudget', MONTHLY_DJ_BUDGET);
}

function getMonthlyBudget(venue, year, mm){
  var v=MONTHLY_DJ_BUDGET[venue]; if(!v) return null;
  var y=v[year]; if(!y) return null;
  return y[mm]!=null ? y[mm] : null;
}
function setMonthlyBudget(venue, year, mm, val){
  var before=_clone(MONTHLY_DJ_BUDGET);
  pushUndo('Change monthly DJ budget',function(){
    MONTHLY_DJ_BUDGET=_clone(before)||{};
    saveMonthlyBudget();
  });
  if(!MONTHLY_DJ_BUDGET[venue]) MONTHLY_DJ_BUDGET[venue]={};
  if(!MONTHLY_DJ_BUDGET[venue][year]) MONTHLY_DJ_BUDGET[venue][year]={};
  MONTHLY_DJ_BUDGET[venue][year][mm]=parseFloat(val)||null;
  saveMonthlyBudget();
}

/* ---- Budget Executive Tables helpers ---- */
function padMm(mi){ return mi<10?'0'+mi:''+mi; }
function miamiMonthNum(){
  try{
    var info=fiscalInfoForDate(String(TODAY||''));
    if(info && info.monthIndex!=null) return info.monthIndex+1;
  }catch(e){}
  return (new Date()).getMonth()+1;
}
function getBgtLastActualMonth(venue, year){
  var last=0;
  for(var mi=1;mi<=12;mi++){
    var mm=padMm(mi);
    if(getBgtActual(venue,year,mm,'sales')!=null||getBgtActual(venue,year,mm,'live')!=null) last=mi;
  }
  return last||null;
}
function getDjYtdCutoff(year){
  try{
    var info=fiscalInfoForDate(String(TODAY||''));
    if(+year===info.year) return info.monthIndex+1;
  }catch(e){}
  var cy=parseInt(String(TODAY||'').slice(0,4),10)||(new Date()).getFullYear();
  if(+year===cy) return miamiMonthNum();
  return 12;
}
function monthPerf(venue, year, mm){
  /* Prefer live SCHED for fees/BS; fall back to historical BS aggregate. */
  var shows=SCHED.filter(function(r){
    return (r.v||r.venue)===venue && r.d && r._s!=='empty' && inFiscalMonthFilter(r, year, mm);
  });
  var tFee=0, tBS=0, hasFee=false, hasBS=false;
  shows.forEach(function(r){
    var f=r.cost||r.fee||0;
    if(f){ tFee+=f; hasFee=true; }
    if(r.bs_a!=null){ tBS+=r.bs_a; hasBS=true; }
  });
  if(hasFee||hasBS){
    return {
      tFee:hasFee?Math.round(tFee):null,
      tBS:hasBS?Math.round(tBS):null,
      roi:(hasFee&&hasBS&&tFee>0)?+(tBS/tFee).toFixed(1):null
    };
  }
  var h=hs(venue,year,mm);
  if(!h) return {tFee:null,tBS:null,roi:null};
  return {
    tFee:h.tFee||null,
    tBS:h.tBS||null,
    roi:(h.tFee&&h.tBS)?+(h.tBS/h.tFee).toFixed(1):null
  };
}
function pctLive(sales, live){
  if(sales==null||live==null||!(sales>0)) return null;
  return Math.round(live/sales*1000)/10;
}
function dash(v){ return v==null||v===''?'-':v; }
function fmtPp(v){
  if(v==null) return '-';
  return (v>0?'+':'')+v+' pp';
}
function bgtMonthCellHeader(){
  var h='<div class="bgt-monthly-cell bgt-monthly-month"></div>';
  for(var i=0;i<12;i++) h+='<div class="bgt-monthly-cell bgt-monthly-month">'+MNS[i]+'</div>';
  h+='<div class="bgt-monthly-cell bgt-monthly-month bgt-monthly-ytd">YTD</div>';
  return h;
}
function bgtMoneyCell(actual, budget, variance, favorableWhen){
  /* favorableWhen: 'under' (budget-actual>=0 good) | 'margin' (actual-budget<=0 good) */
  var actualText=actual!=null?$k(actual):'-';
  var budgetText=budget!=null?$k(budget):'-';
  var varText='-';
  var cls='';
  if(variance!=null){
    varText=favorableWhen==='under'
      ?(variance>=0?'Under ':'Over ')+$m(Math.abs(variance))
      :$mv(variance);
    var fav=favorableWhen==='margin'?variance<=0:variance>=0;
    cls=fav?'pos':'neg';
  }
  var status=variance==null?' bgt-status-neutral':(fav?' bgt-status-good':' bgt-status-bad');
  return '<div class="bgt-monthly-cell'+status+'"><div class="bgt-monthly-value">'+actualText+'</div>'
    +'<div class="bgt-monthly-vs">vs '+budgetText+'</div>'
    +'<div class="bgt-monthly-var '+cls+'">'+varText+'</div></div>';
}
function bgtPctCell(actual, budget, variancePp){
  var actualText=actual!=null?actual+'%':'-';
  var budgetText=budget!=null?budget+'%':'-';
  var varText='-';
  var cls='';
  if(variancePp!=null){
    varText=fmtPp(variancePp);
    cls=variancePp<=0?'pos':'neg';
  }
  var status=variancePp==null?' bgt-status-neutral':(variancePp<=0?' bgt-status-good':' bgt-status-bad');
  return '<div class="bgt-monthly-cell'+status+'"><div class="bgt-monthly-value">'+actualText+'</div>'
    +'<div class="bgt-monthly-vs">vs '+budgetText+'</div>'
    +'<div class="bgt-monthly-var '+cls+'">'+varText+'</div></div>';
}
function bgtRoiCompletion(venue, year, mm){
  var shows=SCHED.filter(function(r){
    if((r.v||r.venue)!==venue || r._s==='empty' || !r.d) return false;
    return inFiscalMonthFilter(r, year, mm);
  });
  var beats=0, misses=0, measured=0;
  shows.forEach(function(r){
    var fee=r.cost||r.fee||0;
    var target=showTargets(r);
    var tone=perfTone(r.bs_a,target.bs_m,fee,r.roi_a,target.roi_t);
    if(tone==='hit'||tone==='near'){ beats++; measured++; }
    else if(tone==='low'){ misses++; measured++; }
  });
  return {beats:beats, misses:misses, measured:measured, pct:measured?Math.round(beats/measured*100):null};
}
function bgtRoiCell(c){
  var neutral=!c||!c.measured;
  var good=!neutral&&c.misses===0;
  var status=neutral?' bgt-status-neutral':(good?' bgt-status-good':' bgt-status-bad');
  return '<div class="bgt-monthly-cell'+status+'"><div class="bgt-monthly-value">'
    +(neutral?'-':c.beats+' / '+c.misses)+'</div><div class="bgt-monthly-vs">beat / miss</div>'
    +'<div class="bgt-monthly-var '+(neutral?'':(good?'pos':'neg'))+'">'
    +(neutral?'-':c.pct+'% beat rate')+'</div></div>';
}

/* YTD Budget decision totals (financial cutoff = latest P&L month) */
function computeBudgetYearTotals(venue, year){
  var ytDjBudget=0, ytDjSpend=0, hasDjBudget=false;
  var ytASales=0, ytALive=0, ytBSales=0, ytBLive=0;
  var hasActual=false;
  var lastActualMm=getBgtLastActualMonth(venue,year);
  var djCut=getDjYtdCutoff(year);
  for(var mi=1;mi<=12;mi++){
    var mm=padMm(mi);
    var budget=getMonthlyBudget(venue,year,mm);
    var spend=(monthAgg(mm).tFee)||0;
    if(mi<=djCut){
      if(budget!=null){ hasDjBudget=true; ytDjBudget+=budget; }
      ytDjSpend+=spend;
    }
  }
  for(var mi2=1;mi2<=12;mi2++){
    if(!lastActualMm||mi2>lastActualMm) break;
    var mm2=padMm(mi2);
    var aS=getBgtActual(venue,year,mm2,'sales');
    var aL=getBgtActual(venue,year,mm2,'live');
    var bS=getBgtPlan(venue,year,mm2,'sales');
    var bL=getBgtPlan(venue,year,mm2,'live');
    if(aS!=null){ ytASales+=aS; hasActual=true; }
    if(aL!=null){ ytALive+=aL; hasActual=true; }
    if(bS!=null) ytBSales+=bS;
    if(bL!=null) ytBLive+=bL;
  }
  var aPct=pctLive(ytASales,ytALive);
  var bPct=pctLive(ytBSales,ytBLive);
  return {
    djSpend:ytDjSpend,
    djBudget:hasDjBudget?ytDjBudget:null,
    djVar:hasDjBudget?(ytDjBudget-ytDjSpend):null,
    salesActual:hasActual?ytASales:null,
    salesBudget:lastActualMm?ytBSales:null,
    liveActual:hasActual?ytALive:null,
    liveBudget:lastActualMm?ytBLive:null,
    liveVar:hasActual?(ytBLive-ytALive):null,
    marginActual:aPct,
    marginBudget:bPct,
    marginVarPp:(aPct!=null&&bPct!=null)?Math.round((aPct-bPct)*10)/10:null,
    lastActualMm:lastActualMm||null,
    djCutoffMm:djCut
  };
}
function renderBudgetKpiStrip(t){
  var el=document.getElementById('budgetKPIs');
  if(!el) return;
  el.innerHTML='';
  el.style.display='none';
}

/* Table 1: Total Sales + Live Entertainment + margin (financial YTD) */
function renderBudgetFinancialTable(){
  var host=document.getElementById('budgetTopLine');
  if(!host) return;
  var lastMm=getBgtLastActualMonth(bgtVenue,bgtYear);
  var cutLabel=lastMm?('YTD through '+MNS[lastMm-1]):'No P&L actuals yet';
  var ytASales=0, ytALive=0, ytBSales=0, ytBLive=0, hasA=false, hasB=false;

  var h='<div class="bgt-monthly"><div class="bgt-monthly-hd">Live Entertainment &amp; Sales <span>'+cutLabel+'</span></div>';
  h+='<div class="bgt-monthly-grid">'+bgtMonthCellHeader();

  /* Sales row */
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>Total Sales</b><span>Actual vs budget</span></div>';
  for(var mi=1;mi<=12;mi++){
    var mm=padMm(mi);
    var a=getBgtActual(bgtVenue,bgtYear,mm,'sales');
    var b=getBgtPlan(bgtVenue,bgtYear,mm,'sales');
    if(lastMm&&mi<=lastMm){
      if(a!=null){ ytASales+=a; hasA=true; }
      if(b!=null){ ytBSales+=b; hasB=true; }
    }
    var varS=(a!=null&&b!=null)?(a-b):null;
    var salesStatus=varS==null?' bgt-status-neutral':(varS>=0?' bgt-status-good':' bgt-status-bad');
    h+='<div class="bgt-monthly-cell'+salesStatus+'"><div class="bgt-monthly-value">'+(a!=null?$k(a):'-')+'</div>'
      +'<div class="bgt-monthly-vs">vs '+(b!=null?$k(b):'-')+'</div>'
      +'<div class="bgt-monthly-var '+(varS==null?'':(varS>=0?'pos':'neg'))+'">'+(varS!=null?$mv(varS):'-')+'</div></div>';
  }
  var ytSalesVar=hasA&&hasB?ytASales-ytBSales:null;
  var ytSalesStatus=ytSalesVar==null?' bgt-status-neutral':(ytSalesVar>=0?' bgt-status-good':' bgt-status-bad');
  h+='<div class="bgt-monthly-cell'+ytSalesStatus+'"><div class="bgt-monthly-value">'+(hasA?$k(ytASales):'-')+'</div>'
    +'<div class="bgt-monthly-vs">vs '+(hasB?$k(ytBSales):'-')+'</div>'
    +'<div class="bgt-monthly-var '+(ytSalesVar==null?'':(ytSalesVar>=0?'pos':'neg'))+'">'+(ytSalesVar!=null?$mv(ytSalesVar):'-')+'</div></div>';

  /* Live Entertainment $ */
  ytALive=0; ytBLive=0; hasA=false; hasB=false;
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>Live Entertainment</b><span>P&amp;L actual / Calendar committed vs budget</span></div>';
  for(var mi2=1;mi2<=12;mi2++){
    var mm2=padMm(mi2);
    var pnlLive=getBgtActual(bgtVenue,bgtYear,mm2,'live');
    var calendarCommitted=(monthAgg(mm2).tFee)||0;
    var aL=pnlLive!=null?pnlLive:(calendarCommitted>0?calendarCommitted:null);
    var bL=getBgtPlan(bgtVenue,bgtYear,mm2,'live');
    if(lastMm&&mi2<=lastMm){
      if(pnlLive!=null){ ytALive+=pnlLive; hasA=true; }
      if(bL!=null){ ytBLive+=bL; hasB=true; }
    }
    var varL=(aL!=null&&bL!=null)?(bL-aL):null;
    h+=bgtMoneyCell(aL,bL,varL,'under');
  }
  var ytLiveVar=(hasA&&hasB)?(ytBLive-ytALive):null;
  h+=bgtMoneyCell(hasA?ytALive:null, hasB?ytBLive:null, ytLiveVar, 'under');

  /* Margin % */
  var ytASales2=0, ytBSales2=0, ytALive2=0, ytBLive2=0, hasMA=false, hasMB=false;
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>Live E Margin</b><span>Actual vs budget</span></div>';
  for(var mi3=1;mi3<=12;mi3++){
    var mm3=padMm(mi3);
    var aS3=getBgtActual(bgtVenue,bgtYear,mm3,'sales');
    var aL3=getBgtActual(bgtVenue,bgtYear,mm3,'live');
    var bS3=getBgtPlan(bgtVenue,bgtYear,mm3,'sales');
    var bL3=getBgtPlan(bgtVenue,bgtYear,mm3,'live');
    var aP=pctLive(aS3,aL3);
    var bP=pctLive(bS3,bL3);
    var vP=(aP!=null&&bP!=null)?Math.round((aP-bP)*10)/10:null;
    if(lastMm&&mi3<=lastMm){
      if(aS3!=null){ ytASales2+=aS3; hasMA=true; }
      if(aL3!=null) ytALive2+=aL3;
      if(bS3!=null){ ytBSales2+=bS3; hasMB=true; }
      if(bL3!=null) ytBLive2+=bL3;
    }
    h+=bgtPctCell(aP,bP,vP);
  }
  var ytAP=hasMA?pctLive(ytASales2,ytALive2):null;
  var ytBP=hasMB?pctLive(ytBSales2,ytBLive2):null;
  var ytVP=(ytAP!=null&&ytBP!=null)?Math.round((ytAP-ytBP)*10)/10:null;
  h+=bgtPctCell(ytAP,ytBP,ytVP);

  /* ROI target completion: measured shows at or above their ROI target. */
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>ROI Beat &amp; Miss</b><span>Same rule as Calendar</span></div>';
  var ytdRoi={beats:0,misses:0,measured:0,pct:null};
  var roiCut=getDjYtdCutoff(bgtYear);
  for(var mi4=1;mi4<=12;mi4++){
    var rc=bgtRoiCompletion(bgtVenue,bgtYear,padMm(mi4));
    if(mi4<=roiCut){ ytdRoi.beats+=rc.beats; ytdRoi.misses+=rc.misses; ytdRoi.measured+=rc.measured; }
    h+=bgtRoiCell(rc);
  }
  ytdRoi.pct=ytdRoi.measured?Math.round(ytdRoi.beats/ytdRoi.measured*100):null;
  h+=bgtRoiCell(ytdRoi);

  h+='</div></div>';
  host.innerHTML=h;
}

function bgtOtherCategoryMonthTotal(venue, year, mm, catIds){
  var prefix=venue+'|'+year+'|'+mm+'|';
  var total=0, found=false;
  Object.keys(acctOthersData||{}).forEach(function(k){
    if(k.indexOf(prefix)!==0) return;
    var cat=k.slice(k.lastIndexOf('|')+1);
    if(catIds.indexOf(cat)<0) return;
    var row=acctOthersData[k]||{};
    if(row.cost!=null&&!isNaN(+row.cost)){ total+=+row.cost; found=true; }
  });
  return found?Math.round(total):0;
}

/* Table 2: entertainment spend populated from Calendar + Accounting Others. */
function renderBudgetGuestDjTable(){
  var host=document.getElementById('budgetGuestDjTable');
  if(!host) return;
  var cut=getDjYtdCutoff(bgtYear);
  var cutLabel=(+bgtYear===parseInt(String(TODAY||'').slice(0,4),10))
    ?('YTD through '+MNS[cut-1]+' (current month)')
    :('Full year '+bgtYear);
  var rows=[
    {label:'Guest DJ', sub:'Calendar fees', ids:null},
    {label:'Resident DJ', sub:'Accounting \u2192 Others', ids:['resident_dj']},
    {label:'Hotel', sub:'Accounting \u2192 Others', ids:['hotel']},
    {label:'Ground', sub:'Accounting \u2192 Others', ids:['ground']},
    {label:'Fire', sub:'Accounting \u2192 Others', ids:['fire_performance']},
    {label:'Kryo', sub:'Accounting \u2192 Others', ids:['kryo']},
    {label:'Others', sub:'Light Jockey + Tech Line', ids:['light_jockey','tech_line']}
  ];
  var monthSpend=new Array(13).fill(0);
  var monthBudget=new Array(13).fill(null);
  var monthHasB=new Array(13).fill(false);
  var h='<div class="bgt-monthly"><div class="bgt-monthly-hd">Entertainment Spend by Category <span>'+cutLabel+' \u00b7 live from Calendar &amp; Accounting</span></div>';
  h+='<div class="bgt-monthly-grid">'+bgtMonthCellHeader();
  rows.forEach(function(row){
    var ytSpend=0, ytBudget=0, hasB=false;
    h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>'+row.label+'</b><span>'+row.sub+'</span></div>';
    for(var mi=1;mi<=12;mi++){
      var mm=padMm(mi);
      var spend=row.ids?bgtOtherCategoryMonthTotal(bgtVenue,bgtYear,mm,row.ids):((monthAgg(mm).tFee)||0);
      var budget=row.ids?null:getMonthlyBudget(bgtVenue,bgtYear,mm);
      var variance=budget!=null?(budget-spend):null;
      monthSpend[mi]+=spend||0;
      if(budget!=null){ monthBudget[mi]=(monthBudget[mi]||0)+budget; monthHasB[mi]=true; }
      if(mi<=cut){
        ytSpend+=spend;
        if(budget!=null){ ytBudget+=budget; hasB=true; }
      }
      h+=bgtMoneyCell(spend||0,budget,variance,'under');
    }
    var ytVar=hasB?(ytBudget-ytSpend):null;
    h+=bgtMoneyCell(ytSpend,hasB?ytBudget:null,ytVar,'under');
  });
  /* Total / Budget / Variance footer rows */
  var ytTotSpend=0, ytTotBudget=0, ytHasB=false;
  h+='<div class="bgt-monthly-cell bgt-monthly-label bgt-total-label"><b>Total Spend</b><span>All categories</span></div>';
  for(var tmi=1;tmi<=12;tmi++){
    var tSpend=monthSpend[tmi]||0;
    var tBud=monthHasB[tmi]?monthBudget[tmi]:null;
    var tVar=tBud!=null?(tBud-tSpend):null;
    if(tmi<=cut){
      ytTotSpend+=tSpend;
      if(tBud!=null){ ytTotBudget+=tBud; ytHasB=true; }
    }
    h+=bgtMoneyCell(tSpend,tBud,tVar,'under');
  }
  h+=bgtMoneyCell(ytTotSpend,ytHasB?ytTotBudget:null,ytHasB?(ytTotBudget-ytTotSpend):null,'under');

  function simpleMoneyRow(label,sub,vals,ytVal,cls){
    var out='<div class="bgt-monthly-cell bgt-monthly-label bgt-total-label"><b>'+label+'</b><span>'+sub+'</span></div>';
    for(var i=1;i<=12;i++){
      var v=vals[i];
      out+='<div class="bgt-monthly-cell'+(cls||'')+'"><div class="bgt-monthly-value">'+(v!=null?$k(v):'-')+'</div></div>';
    }
    out+='<div class="bgt-monthly-cell'+(cls||'')+'"><div class="bgt-monthly-value">'+(ytVal!=null?$k(ytVal):'-')+'</div></div>';
    return out;
  }
  var budgetVals={}, varVals={}, ytVarTot=null;
  for(var bmi=1;bmi<=12;bmi++){
    budgetVals[bmi]=monthHasB[bmi]?monthBudget[bmi]:null;
    varVals[bmi]=monthHasB[bmi]?(monthBudget[bmi]-monthSpend[bmi]):null;
  }
  if(ytHasB) ytVarTot=ytTotBudget-ytTotSpend;
  h+=simpleMoneyRow('Budget','Guest DJ monthly budget',budgetVals,ytHasB?ytTotBudget:null,'');
  h+='<div class="bgt-monthly-cell bgt-monthly-label bgt-total-label"><b>Variance</b><span>Budget \u2212 Total Spend</span></div>';
  for(var vmi=1;vmi<=12;vmi++){
    var vv=varVals[vmi];
    var vCls=vv==null?' bgt-status-neutral':(vv>=0?' bgt-status-good':' bgt-status-bad');
    var vTone=vv==null?'':(vv>=0?'pos':'neg');
    var vTxt=vv==null?'-':((vv>=0?'Under ':'Over ')+$m(Math.abs(vv)));
    h+='<div class="bgt-monthly-cell'+vCls+'"><div class="bgt-monthly-value '+(vTone||'')+'">'+(vv!=null?$kv(vv):'-')+'</div>'
      +'<div class="bgt-monthly-var '+vTone+'">'+vTxt+'</div></div>';
  }
  var yvCls=ytVarTot==null?' bgt-status-neutral':(ytVarTot>=0?' bgt-status-good':' bgt-status-bad');
  var yvTone=ytVarTot==null?'':(ytVarTot>=0?'pos':'neg');
  var yvTxt=ytVarTot==null?'-':((ytVarTot>=0?'Under ':'Over ')+$m(Math.abs(ytVarTot)));
  h+='<div class="bgt-monthly-cell'+yvCls+'"><div class="bgt-monthly-value '+(yvTone||'')+'">'+(ytVarTot!=null?$kv(ytVarTot):'-')+'</div>'
    +'<div class="bgt-monthly-var '+yvTone+'">'+yvTxt+'</div></div>';
  h+='</div></div>';
  host.innerHTML=h;
}

/* Table 3: Fixed 2025 vs 2026 performance comparison */
function renderBudgetYoYCompare(){
  var host=document.getElementById('budgetYoYCompare');
  if(!host) return;
  var calendarCut=miamiMonthNum();
  var financialCut=getBgtLastActualMonth(bgtVenue,2026)||calendarCut;

  function oneMonth(year,mi){
    var mm=padMm(mi);
    var p=monthPerf(bgtVenue,year,mm);
    var sales=getBgtActual(bgtVenue,year,mm,'sales');
    var live=getBgtActual(bgtVenue,year,mm,'live');
    return {sales:sales,bs:p.tBS,fee:p.tFee,margin:pctLive(sales,live)};
  }
  function aggregate(year){
    var bs=0,fee=0,hasBS=false,hasFee=false,sales=0,live=0,hasFin=false;
    for(var mi=1;mi<=calendarCut;mi++){
      var p=monthPerf(bgtVenue,year,padMm(mi));
      if(p.tBS!=null){bs+=p.tBS;hasBS=true;}
      if(p.tFee!=null){fee+=p.tFee;hasFee=true;}
    }
    for(var fi=1;fi<=financialCut;fi++){
      var mm=padMm(fi);
      var s=getBgtActual(bgtVenue,year,mm,'sales'),l=getBgtActual(bgtVenue,year,mm,'live');
      if(s!=null){sales+=s;hasFin=true;}
      if(l!=null) live+=l;
    }
    return {
      sales:hasFin?sales:null,
      bs:hasBS?bs:null,
      fee:hasFee?fee:null,
      margin:hasFin?pctLive(sales,live):null
    };
  }
  function money(v){return v!=null?$k(v):'-';}
  function pct(v){return v!=null?v+'%':'-';}
  function deltaMoney(v){return v!=null?$mv(v):'-';}
  function delta(v,suffix){return v!=null?(v>0?'+':'')+v+suffix:'-';}
  function tone(v,positiveGood){
    if(v==null||v===0) return '';
    return ((positiveGood&&v>0)||(!positiveGood&&v<0))?' bgt-good':' bgt-bad';
  }
  function td(value,formatter,cls){return '<td class="'+(cls||'')+'">'+formatter(value)+'</td>';}
  function row(label,p25,p26,isYtd){
    var dSales=p25.sales!=null&&p26.sales!=null?p26.sales-p25.sales:null;
    var dBS=p25.bs!=null&&p26.bs!=null?p26.bs-p25.bs:null;
    var dFee=p25.fee!=null&&p26.fee!=null?p26.fee-p25.fee:null;
    var dMargin=p25.margin!=null&&p26.margin!=null?Math.round((p26.margin-p25.margin)*10)/10:null;
    var h='<tr'+(isYtd?' class="bgt-perf-ytd"':'')+'><td>'+label+'</td>';
    h+=td(p25.sales,money)+td(p25.bs,money)+td(p25.fee,money)+td(p25.margin,pct);
    h+=td(p26.sales,money,tone(dSales,true))+td(p26.bs,money,tone(dBS,true))+td(p26.fee,money,tone(dFee,false))+td(p26.margin,pct,tone(dMargin,false));
    h+=td(dSales,deltaMoney,tone(dSales,true))+td(dBS,deltaMoney,tone(dBS,true));
    h+=td(dFee,deltaMoney,tone(dFee,false))+td(dMargin,function(v){return delta(v,' pp');},tone(dMargin,false));
    return h+'</tr>';
  }

  var y25=aggregate(2025), y26=aggregate(2026);
  var cards=[
    {lbl:'Total Sales',a:y25.sales,b:y26.sales,goodUp:true},
    {lbl:'Bottle Service',a:y25.bs,b:y26.bs,goodUp:true},
    {lbl:'DJ Fees',a:y25.fee,b:y26.fee,goodUp:false},
    {lbl:'Live Ent Margin',a:y25.margin,b:y26.margin,pct:true,goodUp:false}
  ];
  var strip='<div class="bgt-yoy-strip">';
  cards.forEach(function(c){
    var d=(c.a!=null&&c.b!=null)?(c.pct?Math.round((c.b-c.a)*10)/10:(c.b-c.a)):null;
    var cls=d==null?'':(((c.goodUp&&d>0)||(!c.goodUp&&d<0))?'bgt-good':(d===0?'':'bgt-bad'));
    strip+='<div class="bgt-yoy-card"><div class="bgt-yoy-l">'+c.lbl+'</div>';
    strip+='<div class="bgt-yoy-row"><span>2025</span><b>'+(c.pct?pct(c.a):money(c.a))+'</b></div>';
    strip+='<div class="bgt-yoy-row"><span>2026</span><b>'+(c.pct?pct(c.b):money(c.b))+'</b></div>';
    strip+='<div class="bgt-yoy-delta '+cls+'">'+(d==null?'-':(c.pct?delta(d,' pp'):deltaMoney(d)))+'</div></div>';
  });
  strip+='</div>';

  var h='<div class="bgt-monthly"><div class="bgt-monthly-hd">2025 vs 2026 Performance'
    +'<span>Total Sales ? Bottle Service ? DJ Fees ? Live Ent Margin  -  YTD BS/fees through '+MNS[calendarCut-1]+' ? P&L through '+MNS[financialCut-1]+'</span></div>';
  h+=strip;
  h+='<div class="bgt-perf-scroll"><table class="bgt-perf"><thead>'
    +'<tr><th rowspan="2">Period</th><th colspan="4" class="bgt-perf-group bgt-perf-2025">2025 Actual</th>'
    +'<th colspan="4" class="bgt-perf-group bgt-perf-2026">2026 Actual</th>'
    +'<th colspan="4" class="bgt-perf-group bgt-perf-var">2026 vs 2025</th></tr>'
    +'<tr><th>Total Sales</th><th>BS</th><th>DJ Fees</th><th>Live E %</th>'
    +'<th>Total Sales</th><th>BS</th><th>DJ Fees</th><th>Live E %</th>'
    +'<th>&#916; Sales</th><th>&#916; BS</th><th>&#916; Fees</th><th>&#916; Margin</th></tr></thead><tbody>';
  for(var mi=1;mi<=12;mi++) h+=row(MNS[mi-1],oneMonth(2025,mi),oneMonth(2026,mi),false);
  h+=row('YTD',y25,y26,true);
  h+='</tbody></table></div></div>';
  host.innerHTML=h;
}
/* Table 4: 2027 Guest DJ budget builder ? baselines + editable plan */
function suggest2027Budget(venue, mi){
  var mm=padMm(mi);
  var fee25=(monthPerf(venue,2025,mm).tFee)||0;
  var fee26=(monthPerf(venue,2026,mm).tFee)||0;
  var bgt26=getMonthlyBudget(venue,2026,mm);
  var bgt27Existing=getMonthlyBudget(venue,2027,mm);
  /* Prefer a disciplined envelope: max(2026 budget, 2025 actual) when 2026 overspent hard;
     otherwise blend 70% of 2026 actual with 30% of 2026 budget for seasonality. */
  var suggested=null;
  if(bgt26!=null && fee26>0){
    var overPct=fee26/bgt26;
    if(overPct>1.25){
      /* Heavy overspend month ? hold closer to budget, allow modest growth from 2025 */
      suggested=Math.round(Math.max(bgt26, fee25*1.05)/500)*500;
    } else if(overPct<0.9){
      /* Under budget ? keep room near actual + buffer */
      suggested=Math.round(Math.max(fee26*1.1, bgt26*0.95)/500)*500;
    } else {
      suggested=Math.round((fee26*0.7+bgt26*0.3)/500)*500;
    }
  } else if(bgt26!=null){
    suggested=bgt26;
  } else if(fee26>0){
    suggested=Math.round(fee26/500)*500;
  } else if(fee25>0){
    suggested=Math.round(fee25*1.1/500)*500;
  }
  return {fee25:fee25||null, fee26:fee26||null, bgt26:bgt26, suggested:suggested, existing:bgt27Existing};
}

var _bgtPlayMonth = null;
var _bgtPlayTargetMargin = null;
function renderBudget2027Builder(){
  var host=document.getElementById('budget2027Builder');
  if(!host) return;
  var venue=bgtVenue;
  if(_bgtPlayMonth==null) _bgtPlayMonth=Math.max(1, Math.min(12, miamiMonthNum()||1));
  var mi=_bgtPlayMonth;
  var mm=padMm(mi);
  var sug=suggest2027Budget(venue,mi);
  var sales25=getBgtActual(venue,2025,mm,'sales');
  var sales26=getBgtActual(venue,2026,mm,'sales');
  var live25=getBgtActual(venue,2025,mm,'live');
  var live26=getBgtActual(venue,2026,mm,'live');
  var margin25=pctLive(sales25,live25);
  var margin26=pctLive(sales26,live26);
  var fee25=sug.fee25, fee26=sug.fee26;
  var planFee=sug.existing!=null?sug.existing:(sug.suggested!=null?sug.suggested:'');
  var planSales=getBgtPlan(venue,2027,mm,'sales');
  if(planSales==null && sales26!=null) planSales=Math.round(sales26*1.05/1000)*1000;
  var feeN=planFee===''||planFee==null?null:+planFee;
  var salesN=planSales==null?null:+planSales;
  var feePct=(salesN>0&&feeN!=null)?Math.round(feeN/salesN*1000)/10:null;
  var vsFee26=(feeN!=null&&fee26!=null)?(feeN-fee26):null;
  var vsSales26=(salesN!=null&&sales26!=null)?(salesN-sales26):null;
  var vsMargin=(feePct!=null&&margin26!=null)?Math.round((feePct-margin26)*10)/10:null;

  var yFee=0,ySales=0,yFee26=0,nFee=0,nSales=0;
  for(var yi=1;yi<=12;yi++){
    var ymm=padMm(yi);
    var yf=getMonthlyBudget(venue,2027,ymm);
    var ys=getBgtPlan(venue,2027,ymm,'sales');
    var f26=(monthPerf(venue,2026,ymm).tFee)||0;
    if(yf!=null){ yFee+=yf; nFee++; }
    if(ys!=null){ ySales+=ys; nSales++; }
    yFee26+=f26||0;
  }

  var h='<div class="bgt-play">';
  h+='<div class="bgt-play-hd">2027 Budget Builder<span>'+venue+' — play with Sales & DJ Fees using 2025/2026 history</span></div>';
  h+='<div class="bgt-play-guide"><b>How to use:</b> Build two ways — <b>Top-down</b> (Sales → Target Live E % → Suggested fees) and <b>Bottom-up</b> (Desired programming cost → Resulting margin). Reconcile both below. Values save automatically.</div>';

  h+='<div class="bgt-play-ytd">';
  h+='<div class="bgt-play-metric"><div class="l">2027 Fees Plan</div><div class="v">'+(nFee?$k(yFee):'-')+'</div><div class="s">'+nFee+'/12 months set</div></div>';
  h+='<div class="bgt-play-metric"><div class="l">2027 Sales Plan</div><div class="v">'+(nSales?$k(ySales):'-')+'</div><div class="s">'+nSales+'/12 months set</div></div>';
  h+='<div class="bgt-play-metric'+(nFee?(yFee<=yFee26?' good':' bad'):'')+'"><div class="l">Fees vs 2026</div><div class="v">'+(nFee?$kv(yFee-yFee26):'-')+'</div><div class="s">Full-year plan delta</div></div>';
  h+='<div class="bgt-play-metric"><div class="l">Plan Fee / Sales</div><div class="v">'+(ySales>0?((yFee/ySales*100).toFixed(1)+'%'):'-')+'</div><div class="s">Entertainment intensity</div></div>';
  h+='</div>';

  /* Full-year plan overview (all 12 months at a glance) */
  h+='<div class="bgt-play-overview">';
  h+='<div class="bgt-play-overview-hd">2027 plan overview<span>Click a month to edit · current setup for '+venue+'</span></div>';
  h+='<table class="bgt-play-ov-tbl"><thead><tr>';
  h+='<th>Month</th><th>Sales plan</th><th>Fees plan</th><th>Fee/Sales</th><th>Fees vs 2026</th><th>Sched. fees</th><th>Shows</th>';
  h+='</tr></thead><tbody>';
  for(var om=1;om<=12;om++){
    var omm=padMm(om);
    var oFee=getMonthlyBudget(venue,2027,omm);
    var oSales=getBgtPlan(venue,2027,omm,'sales');
    if(oSales==null){
      var s26o=getBgtActual(venue,2026,omm,'sales');
      if(s26o!=null) oSales=Math.round(s26o*1.05/1000)*1000;
    }
    var oFee26=(monthPerf(venue,2026,omm).tFee)||0;
    var oPct=(oSales>0&&oFee!=null)?(oFee/oSales*100).toFixed(1)+'%':'-';
    var oSched=getShows(2027,venue,omm);
    var oSchedFee=oSched.reduce(function(s,r){return s+(+r.fee||+r.cost||0);},0);
    h+='<tr class="'+(om===mi?'bgt-ov-on':'')+'" onclick="_bgtPlayMonth='+om+';renderBudget2027Builder()">';
    h+='<td>'+MNS[om-1]+'</td>';
    h+='<td>'+(oSales!=null?$k(oSales):'-')+'</td>';
    h+='<td>'+(oFee!=null?$k(oFee):'-')+'</td>';
    h+='<td>'+oPct+'</td>';
    h+='<td>'+(oFee!=null?$kv(oFee-oFee26):'-')+'</td>';
    h+='<td>'+(oSchedFee?$k(oSchedFee):'-')+'</td>';
    h+='<td>'+(oSched.length||'-')+'</td>';
    h+='</tr>';
  }
  h+='</tbody><tfoot><tr><td>Year</td><td>'+(nSales?$k(ySales):'-')+'</td><td>'+(nFee?$k(yFee):'-')+'</td><td>'+(ySales>0?((yFee/ySales*100).toFixed(1)+'%'):'-')+'</td><td>'+(nFee?$kv(yFee-yFee26):'-')+'</td><td colspan="2"></td></tr></tfoot></table>';
  h+='</div>';

  h+='<div class="bgt-play-months">';
  for(var m=1;m<=12;m++){
    h+='<button type="button" class="bgt-play-mbtn'+(m===mi?' on':'')+'" onclick="_bgtPlayMonth='+m+';renderBudget2027Builder()">'+MNS[m-1]+'</button>';
  }
  h+='</div>';

  h+='<div class="bgt-play-card">';
  h+='<div class="bgt-play-title">'+MN_FULL[mi-1]+' 2027</div>';
  h+='<div class="bgt-play-hist">';
  h+='<div class="bgt-play-hist-item"><div class="bgt-play-hist-l">2025 Sales</div><div class="bgt-play-hist-v">'+(sales25!=null?$k(sales25):'-')+'</div><div class="bgt-play-hist-s">Fees '+(fee25!=null?$k(fee25):'-')+' · Live '+(margin25!=null?margin25+'%':'-')+'</div></div>';
  h+='<div class="bgt-play-hist-item"><div class="bgt-play-hist-l">2026 Sales</div><div class="bgt-play-hist-v">'+(sales26!=null?$k(sales26):'-')+'</div><div class="bgt-play-hist-s">Fees '+(fee26!=null?$k(fee26):'-')+' · Live '+(margin26!=null?margin26+'%':'-')+'</div></div>';
  h+='<div class="bgt-play-hist-item"><div class="bgt-play-hist-l">2026 Fee Budget</div><div class="bgt-play-hist-v">'+(sug.bgt26!=null?$k(sug.bgt26):'-')+'</div><div class="bgt-play-hist-s">Guest DJ envelope</div></div>';
  h+='<div class="bgt-play-hist-item"><div class="bgt-play-hist-l">Suggested 2027 Fee</div><div class="bgt-play-hist-v">'+(sug.suggested!=null?$k(sug.suggested):'-')+'</div><div class="bgt-play-hist-s">From 2025/2026 rule of thumb</div></div>';
  h+='</div>';

  var targetMarginShow=_bgtPlayTargetMargin!=null?_bgtPlayTargetMargin:(margin26!=null?margin26:'');
  h+='<div class="bgt-play-inputs">';
  h+='<div class="bgt-play-fld"><label>2027 Total Sales ($)</label><input id="bgtPlaySales" type="number" inputmode="decimal" value="'+(salesN!=null?salesN:'')+'" placeholder="e.g. 2500000" oninput="on2027PlayInput()"></div>';
  h+='<div class="bgt-play-fld"><label>2027 DJ Fees ($)</label><input id="bgtPlayFees" type="number" inputmode="decimal" value="'+(feeN!=null?feeN:'')+'" placeholder="e.g. 200000" oninput="on2027PlayInput()"></div>';
  h+='<div class="bgt-play-fld"><label>Target Live E Margin (%)</label><input id="bgtPlayTargetMargin" type="number" inputmode="decimal" step="0.1" value="'+targetMarginShow+'" placeholder="e.g. 4.5" oninput="on2027PlayInput()"></div>';
  h+='</div>';

  h+='<div class="bgt-play-metrics" id="bgtPlayMetrics">';
  h+=_bgtPlayMetricsHtml(feePct, vsFee26, vsSales26, vsMargin, margin26);
  h+='</div>';

  h+='<div class="bgt-reconcile" id="bgtReconcile">';
  h+=_bgtReconcileHtml(salesN, feeN, margin26);
  h+='</div>';

  h+='<div class="bgt-play-actions">';
  h+='<button type="button" class="primary" onclick="applySuggested2027Month(\''+mm+'\')">Use suggested fees</button>';
  h+='<button type="button" onclick="bgtPlayPreset(\'sales26\')">Sales = 2026</button>';
  h+='<button type="button" onclick="bgtPlayPreset(\'sales10\')">Sales = 2026 +10%</button>';
  h+='<button type="button" onclick="bgtPlayPreset(\'fee26\')">Fees = 2026 actual</button>';
  h+='<button type="button" onclick="bgtPlayPreset(\'matchLive\')">Fees to match 2026 Live %</button>';
  h+='<button type="button" onclick="bgtApplyTopDown()">Apply top-down suggested fees</button>';
  h+='<button type="button" onclick="applyAllSuggested2027()">Use suggested for all months</button>';
  h+='</div>';

  /* Selected month: full schedule overview with current lineup */
  var monthShows=getShows(2027,venue,mm).slice().sort(function(a,b){return (a.d||'').localeCompare(b.d||'');});
  var monthSchedFee=monthShows.reduce(function(s,r){return s+(+r.fee||+r.cost||0);},0);
  var monthBsT=monthShows.reduce(function(s,r){var t=showTargets(r);return s+(t.bs_m||0);},0);
  h+='<div class="bgt-play-month-ov">';
  h+='<div class="bgt-play-month-ov-hd">'+MN_FULL[mi-1]+' 2027 schedule overview <span>'+fiscalPeriodShortRange(2027,mi-1)+' · '+monthShows.length+' shows · fees '+$k(monthSchedFee)+' · BS tgt '+$k(monthBsT)+(feeN!=null?(' · budget '+$k(feeN)+' · var '+$kv(monthSchedFee-feeN)):'')+'</span></div>';
  if(!monthShows.length){
    h+='<div style="font-size:11px;color:var(--ink3);padding:6px 2px">No performances scheduled in this fiscal month yet.</div>';
  } else {
    h+='<div class="bgt-play-show-row hd"><span>Date</span><span>DJ</span><span>Fee</span><span>BS tgt</span><span>Status</span></div>';
    monthShows.forEach(function(r){
      var tgt=showTargets(r);
      var st=getShowDjStatus(r,r.d)||'Not set';
      h+='<div class="bgt-play-show-row">';
      h+='<span>'+(r.d||'')+'</span>';
      h+='<span>'+djLabel(r.dj)+'</span>';
      h+='<span>'+$k(r.fee||r.cost)+'</span>';
      h+='<span>'+$k(tgt.bs_m)+'</span>';
      h+='<span>'+st+'</span>';
      h+='</div>';
    });
  }
  h+='</div>';

  h+='</div></div>';
  host.innerHTML=h;
}
function _bgtPlayMetricsHtml(feePct, vsFee26, vsSales26, vsMargin, margin26){
  var h='';
  h+='<div class="bgt-play-metric"><div class="l">Fees / Sales</div><div class="v">'+(feePct!=null?feePct+'%':'-')+'</div><div class="s">Your 2027 entertainment intensity</div></div>';
  h+='<div class="bgt-play-metric'+(vsMargin==null?'':(vsMargin<=0?' good':' bad'))+'"><div class="l">vs 2026 Live Ent %</div><div class="v">'+(vsMargin!=null?((vsMargin>0?'+':'')+vsMargin+' pp'):'-')+'</div><div class="s">2026 was '+(margin26!=null?margin26+'%':'-')+'</div></div>';
  h+='<div class="bgt-play-metric'+(vsFee26==null?'':(vsFee26<=0?' good':' bad'))+'"><div class="l">Fees vs 2026</div><div class="v">'+(vsFee26!=null?$kv(vsFee26):'-')+'</div><div class="s">Plan − 2026 actual fees</div></div>';
  h+='<div class="bgt-play-metric'+(vsSales26==null?'':(vsSales26>=0?' good':' bad'))+'"><div class="l">Sales vs 2026</div><div class="v">'+(vsSales26!=null?$kv(vsSales26):'-')+'</div><div class="s">Plan − 2026 actual sales</div></div>';
  return h;
}
function _bgtReconcileHtml(salesN, feeN, defaultTargetMargin){
  var targetEl=document.getElementById('bgtPlayTargetMargin');
  var targetMargin=targetEl && targetEl.value!=='' ? parseFloat(targetEl.value)
    : (_bgtPlayTargetMargin!=null?_bgtPlayTargetMargin:defaultTargetMargin);
  if(targetMargin!=null && isNaN(targetMargin)) targetMargin=null;
  var topDownFee=(salesN!=null && targetMargin!=null) ? Math.round(salesN*(targetMargin/100)/500)*500 : null;
  var bottomUpMargin=(salesN>0 && feeN!=null) ? Math.round(feeN/salesN*1000)/10 : null;
  var gap=(topDownFee!=null && feeN!=null) ? (feeN-topDownFee) : null;
  var h='<div class="bgt-reconcile-hd">Budget Builder · Reconcile</div>';
  h+='<div class="bgt-reconcile-grid">';
  h+='<div class="bgt-reconcile-card"><div class="t">Top-down</div>';
  h+='<div class="s">Sales Forecast → Target Live E Margin → Suggested Entertainment Budget</div>';
  h+='<div class="row"><span>Sales forecast</span><b>'+(salesN!=null?$k(salesN):'-')+'</b></div>';
  h+='<div class="row"><span>Target Live E %</span><b>'+(targetMargin!=null?targetMargin+'%':'-')+'</b></div>';
  h+='<div class="row"><span>Suggested fees</span><b>'+(topDownFee!=null?$k(topDownFee):'-')+'</b></div>';
  h+='</div>';
  h+='<div class="bgt-reconcile-card"><div class="t">Bottom-up</div>';
  h+='<div class="s">Desired Programming → Total Programming Cost → Resulting Live E Margin</div>';
  h+='<div class="row"><span>Programming cost</span><b>'+(feeN!=null?$k(feeN):'-')+'</b></div>';
  h+='<div class="row"><span>Resulting Live E %</span><b>'+(bottomUpMargin!=null?bottomUpMargin+'%':'-')+'</b></div>';
  h+='<div class="row"><span>vs target margin</span><b class="'+(bottomUpMargin!=null&&targetMargin!=null?(bottomUpMargin<=targetMargin?'pos':'neg'):'')+'">'+(bottomUpMargin!=null&&targetMargin!=null?(((bottomUpMargin-targetMargin)>0?'+':'')+(Math.round((bottomUpMargin-targetMargin)*10)/10)+' pp'):'-')+'</b></div>';
  h+='</div>';
  h+='</div>';
  h+='<div class="bgt-reconcile-gap'+(gap==null?'':(Math.abs(gap)<1?' good':(gap>0?' bad':' good')))+'">';
  if(gap==null) h+='Set sales, target margin, and programming cost to compare frameworks.';
  else if(Math.abs(gap)<1) h+='Frameworks aligned — artistic programming matches the financial target.';
  else if(gap>0) h+='Bottom-up is <b>'+$k(gap)+'</b> above top-down. Cut programming or raise sales / accept a higher Live E %.';
  else h+='Bottom-up is <b>'+$k(Math.abs(gap))+'</b> under top-down. Room to invest more in programming while staying on margin.';
  h+='</div>';
  return h;
}
function bgtApplyTopDown(){
  var salesEl=document.getElementById('bgtPlaySales');
  var feeEl=document.getElementById('bgtPlayFees');
  var targetEl=document.getElementById('bgtPlayTargetMargin');
  if(!salesEl||!feeEl||!targetEl) return;
  var salesN=salesEl.value===''?null:parseFloat(salesEl.value);
  var targetMargin=targetEl.value===''?null:parseFloat(targetEl.value);
  if(!(salesN>0) || targetMargin==null || isNaN(targetMargin)) return;
  feeEl.value=Math.round(salesN*(targetMargin/100)/500)*500;
  on2027PlayInput();
  renderBudget2027Builder();
}
function on2027PlayInput(){
  var mi=_bgtPlayMonth||1, mm=padMm(mi), venue=bgtVenue;
  var salesEl=document.getElementById('bgtPlaySales');
  var feeEl=document.getElementById('bgtPlayFees');
  if(!salesEl||!feeEl) return;
  var salesN=salesEl.value===''?null:parseFloat(salesEl.value);
  var feeN=feeEl.value===''?null:parseFloat(feeEl.value);
  var targetEl=document.getElementById('bgtPlayTargetMargin');
  if(targetEl){
    _bgtPlayTargetMargin=targetEl.value===''?null:parseFloat(targetEl.value);
    if(_bgtPlayTargetMargin!=null && isNaN(_bgtPlayTargetMargin)) _bgtPlayTargetMargin=null;
  }
  if(salesN!=null && !isNaN(salesN)) setBgtPlanQuiet(venue,2027,mm,'sales',salesN);
  else setBgtPlanQuiet(venue,2027,mm,'sales',null);
  if(feeN!=null && !isNaN(feeN)) setMonthlyBudgetQuiet(venue,2027,mm,feeN);
  else setMonthlyBudgetQuiet(venue,2027,mm,null);
  var sales26=getBgtActual(venue,2026,mm,'sales');
  var live26=getBgtActual(venue,2026,mm,'live');
  var margin26=pctLive(sales26,live26);
  var fee26=(monthPerf(venue,2026,mm).tFee)||null;
  var feePct=(salesN>0&&feeN!=null)?Math.round(feeN/salesN*1000)/10:null;
  var vsFee26=(feeN!=null&&fee26!=null)?(feeN-fee26):null;
  var vsSales26=(salesN!=null&&sales26!=null)?(salesN-sales26):null;
  var vsMargin=(feePct!=null&&margin26!=null)?Math.round((feePct-margin26)*10)/10:null;
  var box=document.getElementById('bgtPlayMetrics');
  if(box) box.innerHTML=_bgtPlayMetricsHtml(feePct, vsFee26, vsSales26, vsMargin, margin26);
  var rec=document.getElementById('bgtReconcile');
  if(rec) rec.innerHTML=_bgtReconcileHtml(salesN, feeN, margin26);
}
function setBgtPlanQuiet(venue, year, mm, field, val){
  if(!BGT_PLAN[venue]) BGT_PLAN[venue]={};
  if(!BGT_PLAN[venue][year]) BGT_PLAN[venue][year]={};
  if(!BGT_PLAN[venue][year][mm]) BGT_PLAN[venue][year][mm]={};
  BGT_PLAN[venue][year][mm][field]=(val==null||val===''||isNaN(+val))?null:+val;
  saveBgtPlan();
}
function setMonthlyBudgetQuiet(venue, year, mm, val){
  if(!MONTHLY_DJ_BUDGET[venue]) MONTHLY_DJ_BUDGET[venue]={};
  if(!MONTHLY_DJ_BUDGET[venue][year]) MONTHLY_DJ_BUDGET[venue][year]={};
  if(val==null||val==='') delete MONTHLY_DJ_BUDGET[venue][year][mm];
  else MONTHLY_DJ_BUDGET[venue][year][mm]=+val;
  saveMonthlyBudget();
}
function bgtPlayPreset(kind){
  var mi=_bgtPlayMonth||1, mm=padMm(mi), venue=bgtVenue;
  var sales26=getBgtActual(venue,2026,mm,'sales');
  var live26=getBgtActual(venue,2026,mm,'live');
  var margin26=pctLive(sales26,live26);
  var fee26=(monthPerf(venue,2026,mm).tFee)||0;
  var salesEl=document.getElementById('bgtPlaySales');
  var feeEl=document.getElementById('bgtPlayFees');
  if(!salesEl||!feeEl) return;
  if(kind==='sales26' && sales26!=null) salesEl.value=Math.round(sales26);
  if(kind==='sales10' && sales26!=null) salesEl.value=Math.round(sales26*1.1/1000)*1000;
  if(kind==='fee26') feeEl.value=Math.round(fee26);
  if(kind==='matchLive'){
    var s=+salesEl.value||sales26;
    if(s>0 && margin26!=null) feeEl.value=Math.round(s*(margin26/100)/500)*500;
  }
  on2027PlayInput();
  renderBudget2027Builder();
}
function on2027BudgetEdit(el){
  if(!el) return;
  var mm=el.getAttribute('data-mm');
  var raw=el.value;
  var val=(raw===''||raw==null)?null:parseFloat(raw);
  setMonthlyBudget(bgtVenue,2027,mm,val);
  renderBudget2027Builder();
  if(typeof renderCalMonthRecap==='function'&&typeof curY!=='undefined'){
    /* refresh calendar strips if viewing 2027 */
  }
}
function applySuggested2027Month(mm){
  var mi=parseInt(mm,10);
  _bgtPlayMonth=mi;
  var s=suggest2027Budget(bgtVenue,mi);
  if(s.suggested==null) return;
  setMonthlyBudget(bgtVenue,2027,mm,s.suggested);
  renderBudget2027Builder();
}
function applyAllSuggested2027(){
  var before=_clone(MONTHLY_DJ_BUDGET);
  pushUndo('Apply suggested 2027 budgets',function(){
    MONTHLY_DJ_BUDGET=_clone(before)||{};
    saveMonthlyBudget();
  });
  if(!MONTHLY_DJ_BUDGET[bgtVenue]) MONTHLY_DJ_BUDGET[bgtVenue]={};
  if(!MONTHLY_DJ_BUDGET[bgtVenue][2027]) MONTHLY_DJ_BUDGET[bgtVenue][2027]={};
  for(var mi=1;mi<=12;mi++){
    var s=suggest2027Budget(bgtVenue,mi);
    if(s.suggested!=null) MONTHLY_DJ_BUDGET[bgtVenue][2027][padMm(mi)]=s.suggested;
  }
  saveMonthlyBudget();
  renderBudget2027Builder();
}

/*    Render the 12-month Budget vs Actual Spend strip    */
function renderBudgetSpendTracker(){
  var MNS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h='<div class="bgt-spend-tracker">';
  h+='<div class="bgt-spend-hd">Guest DJ $ Budget vs Actual Spend <span class="bgt-spend-hint">  set your monthly budget once, it stays saved</span></div>';
  h+='<div class="bgt-spend-row bgt-spend-labelrow">';
  h+='<div class="bgt-spend-cell bgt-spend-lbl-col">Month</div>';
  for(var mi=1;mi<=12;mi++) h+='<div class="bgt-spend-cell">'+MNS[mi-1]+'</div>';
  h+='</div>';

  var ytBudget=0, ytSpend=0;
  var budgetRow='<div class="bgt-spend-row"><div class="bgt-spend-cell bgt-spend-lbl-col">Budget</div>';
  var spendRow ='<div class="bgt-spend-row"><div class="bgt-spend-cell bgt-spend-lbl-col">Actual Spend</div>';
  var varRow   ='<div class="bgt-spend-row"><div class="bgt-spend-cell bgt-spend-lbl-col">Variance</div>';

  for(var mi2=1;mi2<=12;mi2++){
    var mm=mi2<10?'0'+mi2:''+mi2;
    var budget=getMonthlyBudget(bgtVenue,bgtYear,mm);
    var agg=monthAgg(mm);
    var spend=agg.tFee||0;
    var variance = budget!=null ? budget-spend : null;
    ytBudget += budget||0; ytSpend += spend;

    var isLocked = budget!=null;
    budgetRow+='<div class="bgt-spend-cell">'
      +(isLocked
        ? '<div class="bgt-spend-locked"><span>'+$k(budget)+'</span><button class="bgt-unlock-btn" data-mm="'+mm+'" title="Unlock to edit">&#128274;</button></div>'
        : '<input type="number" class="bgt-spend-inp" data-mm="'+mm+'" value="" placeholder="$">')
      +'</div>';
    spendRow+='<div class="bgt-spend-cell'+(spend?' bgt-spend-hasval':'')+'">'+(spend?$m(spend):'-')+'</div>';
    varRow+='<div class="bgt-spend-cell '+(variance!=null?(variance>=0?'pos':'neg'):'')+'">'+(variance!=null?$mv(variance):'-')+'</div>';
  }
  budgetRow+='</div>'; spendRow+='</div>'; varRow+='</div>';
  h+=budgetRow+spendRow+varRow;

  h+='</div>';

  var block=document.getElementById('bgtSpendBlock')||document.getElementById('budgetSpendTracker');
  if(!block) return;
  block.innerHTML=h;
  block.querySelectorAll('.bgt-spend-inp').forEach(function(inp){
    inp.addEventListener('change',function(){
      setMonthlyBudget(bgtVenue,bgtYear,inp.dataset.mm,inp.value);
      renderBudget();
    });
  });
  block.querySelectorAll('.bgt-unlock-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      if(!confirm('This budget is locked for the year. Unlock to edit anyway?')) return;
      setMonthlyBudget(bgtVenue,bgtYear,btn.dataset.mm,'');
      renderBudget();
    });
  });
  renderBudgetPlanRecap();
}

/* P&L actuals: Total Sales + GL 6750 Live Entertainment (read-only). Budget inputs stay in BGT_PLAN. */
var BGT_ACTUALS = {"Casa Neos Beach Club": {"2024": {"01": {"sales": 0.0, "live": 0.0}, "02": {"sales": 0.0, "live": 0.0}, "03": {"sales": 0.0, "live": 0.0}, "04": {"sales": 0.0, "live": 0.0}, "05": {"sales": 0.0, "live": 0.0}, "06": {"sales": 267272.95, "live": 5918.5}, "07": {"sales": 1323214.72, "live": 8322.05}, "08": {"sales": 1373253.97, "live": 3133.82}, "09": {"sales": 1518137.98, "live": 3900.0}, "10": {"sales": 997720.82, "live": 10026.6}, "11": {"sales": 1363086.75, "live": 22220.28}, "12": {"sales": 2348494.68, "live": 201907.82}}, "2025": {"01": {"sales": 2297283.81, "live": 96069.31}, "02": {"sales": 2557057.73, "live": 116322.75}, "03": {"sales": 3806628.3, "live": 151668.89}, "04": {"sales": 2996929.08, "live": 155896.19}, "05": {"sales": 3388786.61, "live": 324256.07}, "06": {"sales": 2909123.58, "live": 77694.02}, "07": {"sales": 1802384.45, "live": 60741.21}, "08": {"sales": 1930719.61, "live": 48635.54}, "09": {"sales": 2518777.6, "live": 72558.74}, "10": {"sales": 2078547.57, "live": 71536.13}, "11": {"sales": 2529366.22, "live": 138534.6}, "12": {"sales": 4417099.08, "live": 580481.12}}, "2026": {"01": {"sales": 3871217.7, "live": 633717.78}, "02": {"sales": 2949678.36, "live": 234848.9}, "03": {"sales": 4612961.61, "live": 644959.52}, "04": {"sales": 3169573.56, "live": 212641.69}, "05": {"sales": 3958106.03, "live": 398321.53}, "06": {"sales": 3411474.28, "live": 167020.28}, "07": {"sales": 2295953.07, "live": 98890.75}}}, "MILA Lounge": {"2024": {"01": {"sales": 1591149.05, "live": 121524.52}, "02": {"sales": 1820138.11, "live": 70757.61}, "03": {"sales": 1964112.82, "live": 221728.17}, "04": {"sales": 1542275.0, "live": 48752.45}, "05": {"sales": 1870989.13, "live": 132855.58}, "06": {"sales": 1504863.57, "live": 85748.01}, "07": {"sales": 1206631.4, "live": 60309.44}, "08": {"sales": 1106383.27, "live": 86495.44}, "09": {"sales": 1347146.89, "live": 85510.81}, "10": {"sales": 1297072.69, "live": 75250.14}, "11": {"sales": 1476368.31, "live": 143279.92}, "12": {"sales": 2378054.56, "live": 341196.98}}, "2025": {"01": {"sales": 1878325.12, "live": 130869.8}, "02": {"sales": 1785196.94, "live": 224185.8}, "03": {"sales": 2178833.88, "live": 236842.83}, "04": {"sales": 1482763.05, "live": 88902.46}, "05": {"sales": 1848554.41, "live": 271261.84}, "06": {"sales": 1370837.67, "live": 94253.62}, "07": {"sales": 913603.97, "live": 59224.33}, "08": {"sales": 1079194.08, "live": 82313.21}, "09": {"sales": 1360440.23, "live": 95878.4}, "10": {"sales": 1421583.2, "live": 87130.92}, "11": {"sales": 1518266.14, "live": 107781.35}, "12": {"sales": 2425031.34, "live": 364009.31}}, "2026": {"01": {"sales": 2216434.48, "live": 214408.65}, "02": {"sales": 1759429.07, "live": 133400.73}, "03": {"sales": 2447280.08, "live": 153918.74}, "04": {"sales": 1514845.24, "live": 101061.67}, "05": {"sales": 2114019.21, "live": 197496.84}, "06": {"sales": 1387232.27, "live": 135121.58}, "07": {"sales": 1021061.7, "live": 72816.05}}}, "Casa Neos Lounge": {"2026": {"01": {"sales": 0.0, "live": 0.0}, "02": {"sales": 0.0, "live": 0.0}, "03": {"sales": 1272552.61, "live": 195804.54}, "04": {"sales": 912125.58, "live": 92563.92}, "05": {"sales": 1441139.88, "live": 171294.27}, "06": {"sales": 1104175.23, "live": 140249.29}, "07": {"sales": 613353.3, "live": 90514.91}}}};
function getBgtActual(venue, year, mm, field){
  var row=(((BGT_ACTUALS[venue]||{})[String(year)]||{})[mm]||{});
  var v=row[field];
  return v==null?null:+v;
}

/* Editable budget inputs: Total Sales & Live Entertainment.
   2026 Casa Neos Beach Club + Lounge seeded from "3 - 2026 CASA NEOS Budget.xlsx"
   OPEX CASA NEOS / OPEX LOUNGE (Row 7 Sales + Live Entertainment). */
var BGT_PLAN_SEED = {
  "Casa Neos Beach Club":{"2026":{
    "01":{"sales":3421326.12,"live":595694.57},"02":{"sales":2625788.27,"live":215300},
    "03":{"sales":3776754.65,"live":186800},"04":{"sales":3015373.12,"live":97900},
    "05":{"sales":3455018.79,"live":394500},"06":{"sales":3291723.63,"live":119400},
    "07":{"sales":2159435.42,"live":119400},"08":{"sales":1876430.07,"live":60000},
    "09":{"sales":2517077.27,"live":57000},"10":{"sales":2084827.79,"live":70900},
    "11":{"sales":2517113.08,"live":112800},"12":{"sales":5497470.76,"live":1062000}
  }},
  "Casa Neos Lounge":{"2026":{
    "01":{"sales":0,"live":0},"02":{"sales":0,"live":0},
    "03":{"sales":1234427,"live":84600},"04":{"sales":913157.24,"live":79700},
    "05":{"sales":1369793.33,"live":128200},"06":{"sales":1617945.9,"live":89400},
    "07":{"sales":625749.28,"live":89400},"08":{"sales":1150892.62,"live":56150},
    "09":{"sales":1232386.02,"live":56150},"10":{"sales":583857.53,"live":72200},
    "11":{"sales":883206.8,"live":77450},"12":{"sales":1509705.66,"live":229200}
  }},
  "MILA Lounge":{"2026":{
    "07":{"sales":1456405.22,"live":98810},"08":{"sales":1068948.48,"live":67841},
    "09":{"sales":1214732.65,"live":68750},"10":{"sales":1236359.79,"live":81290},
    "11":{"sales":1358667.98,"live":88182},"12":{"sales":2363577.47,"live":339132}
  }}
};
var BGT_PLAN = JSON.parse(JSON.stringify(BGT_PLAN_SEED));
function deepMergeBgtPlan(src){
  Object.keys(src||{}).forEach(function(venue){
    if(!BGT_PLAN[venue]) BGT_PLAN[venue]={};
    Object.keys(src[venue]||{}).forEach(function(year){
      if(!BGT_PLAN[venue][year]) BGT_PLAN[venue][year]={};
      Object.keys(src[venue][year]||{}).forEach(function(mm){
        if(!BGT_PLAN[venue][year][mm]) BGT_PLAN[venue][year][mm]={};
        Object.keys(src[venue][year][mm]||{}).forEach(function(field){
          var val=src[venue][year][mm][field];
          if(val!=null) BGT_PLAN[venue][year][mm][field]=val;
        });
      });
    });
  });
}
(function loadBgtPlan(){
  /* Deep-merge saved edits on top of seeded OPEX budgets. */
  try{
    var saved=JSON.parse(localStorage.getItem('rdg_bgt_plan_v2')||'{}')||{};
    deepMergeBgtPlan(saved);
  }catch(e){}
})();
function applyOfficialH2Budgets(){
  ['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'].forEach(function(venue){
    if(!BGT_PLAN[venue]) BGT_PLAN[venue]={};
    if(!BGT_PLAN[venue]['2026']) BGT_PLAN[venue]['2026']={};
    for(var mi=7;mi<=12;mi++){
      var mm=padMm(mi);
      var official=(((BGT_PLAN_SEED[venue]||{})['2026']||{})[mm]);
      if(official) BGT_PLAN[venue]['2026'][mm]={sales:official.sales,live:official.live};
    }
  });
}
/* These are the approved P7-P12 operating budgets; old browser cache must not replace them. */
applyOfficialH2Budgets();
function saveBgtPlan(){
  try{ localStorage.setItem('rdg_bgt_plan_v2', JSON.stringify(BGT_PLAN)); }catch(e){}
  if(window._fbSave) window._fbSave('bgtPlan', BGT_PLAN);
}
function getBgtPlan(venue, year, mm, field){
  return (((BGT_PLAN[venue]||{})[year]||{})[mm]||{})[field];
}
function setBgtPlan(venue, year, mm, field, val){
  var before=_clone(BGT_PLAN);
  pushUndo('Change '+(field==='sales'?'sales plan':'live entertainment plan'),function(){
    BGT_PLAN=_clone(before)||{};
    saveBgtPlan();
  });
  if(!BGT_PLAN[venue]) BGT_PLAN[venue]={};
  if(!BGT_PLAN[venue][year]) BGT_PLAN[venue][year]={};
  if(!BGT_PLAN[venue][year][mm]) BGT_PLAN[venue][year][mm]={};
  var n=parseFloat(val);
  BGT_PLAN[venue][year][mm][field]=isNaN(n)?null:n;
  saveBgtPlan();
}
function renderBudgetPlanRecap(){
  var host=document.getElementById('bgtPlanBlock')||document.getElementById('budgetSpendTracker');
  if(!host) return;
  var MNS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h='<div class="bgt-plan-recap">';
  h+='<div class="bgt-plan-hd">Sales vs Live Entertainment</div>';
  h+='<div class="bgt-plan-hint">P&L actuals (GL 6750 Live Entertainment / Total Sales) vs budget (editable). Not BS Actual or Guest DJ fees. % = Live Entertainment / Total Sales.</div>';
  h+='<div class="bgt-plan-row"><div class="bgt-plan-lbl">Month</div>';
  for(var i=0;i<12;i++) h+='<div class="bgt-plan-cell">'+MNS[i]+'</div>';
  h+='</div>';

  /* ---- Actuals (read-only from P&L) ---- */
  h+='<div class="bgt-plan-subhd">Actual (P&L)</div>';
  var aSalesRow='<div class="bgt-plan-row bgt-plan-actual"><div class="bgt-plan-lbl">Actual Total Sales</div>';
  var aLiveRow='<div class="bgt-plan-row bgt-plan-actual"><div class="bgt-plan-lbl">Actual Live Ent. (6750)</div>';
  var aPctRow='<div class="bgt-plan-row bgt-plan-actual"><div class="bgt-plan-lbl">Actual Live Ent. %</div>';
  for(var mi=1;mi<=12;mi++){
    var mm=mi<10?'0'+mi:''+mi;
    var aSales=getBgtActual(bgtVenue,bgtYear,mm,'sales');
    var aLive=getBgtActual(bgtVenue,bgtYear,mm,'live');
    var aPct=(aSales>0 && aLive!=null) ? Math.round(aLive/aSales*1000)/10 : null;
    aSalesRow+='<div class="bgt-plan-cell">'+(aSales!=null?$k(aSales):'-')+'</div>';
    aLiveRow+='<div class="bgt-plan-cell">'+(aLive!=null?$k(aLive):'-')+'</div>';
    aPctRow+='<div class="bgt-plan-cell">'+(aPct!=null?aPct+'%':'-')+'</div>';
  }
  aSalesRow+='</div>'; aLiveRow+='</div>'; aPctRow+='</div>';
  h+=aSalesRow+aLiveRow+aPctRow;

  /* ---- Budget (editable) ---- */
  h+='<div class="bgt-plan-subhd">Budget</div>';
  var salesRow='<div class="bgt-plan-row"><div class="bgt-plan-lbl">Budget Total Sales</div>';
  var liveRow='<div class="bgt-plan-row"><div class="bgt-plan-lbl">Budget Live Ent.</div>';
  var pctRow='<div class="bgt-plan-row"><div class="bgt-plan-lbl">Budget Live Ent. %</div>';
  for(var mi2=1;mi2<=12;mi2++){
    var mm2=mi2<10?'0'+mi2:''+mi2;
    var sales=getBgtPlan(bgtVenue,bgtYear,mm2,'sales');
    var live=getBgtPlan(bgtVenue,bgtYear,mm2,'live');
    var pct=(sales>0 && live!=null) ? Math.round(live/sales*1000)/10 : null;
    salesRow+='<div class="bgt-plan-cell"><input type="number" class="bgt-plan-inp" data-field="sales" data-mm="'+mm2+'" value="'+(sales!=null?sales:'')+'" placeholder="$"></div>';
    liveRow+='<div class="bgt-plan-cell"><input type="number" class="bgt-plan-inp" data-field="live" data-mm="'+mm2+'" value="'+(live!=null?live:'')+'" placeholder="$"></div>';
    pctRow+='<div class="bgt-plan-cell">'+(pct!=null?pct+'%':'-')+'</div>';
  }
  salesRow+='</div>'; liveRow+='</div>'; pctRow+='</div>';
  h+=salesRow+liveRow+pctRow+'</div>';

  host.innerHTML=h;
  host.querySelectorAll('.bgt-plan-inp').forEach(function(inp){
    inp.addEventListener('change',function(){
      setBgtPlan(bgtVenue,bgtYear,inp.dataset.mm,inp.dataset.field,inp.value);
      renderBudget();
    });
  });
}

/* Executive narrative: MTD Guest DJ + YTD Live Ent + ROI example */
function generateBudgetNarrative(venue, year, mm){
  var MNF=['January','February','March','April','May','June','July','August','September','October','November','December'];
  if(mm){
    var agg=monthAgg(mm);
    var budget=getMonthlyBudget(venue,year,mm);
    var spend=agg.tFee||0;
    var variance=budget!=null?budget-spend:null;
    var avgROI=agg.tFee&&agg.projBS?+(agg.projBS/agg.tFee).toFixed(1):null;
    var topShow=agg.shows&&agg.shows.length?agg.shows.reduce(function(a,b){return (b.cost||b.fee||0)>(a.cost||a.fee||0)?b:a;}):null;
    if(!agg.n) return venue+' has no DJ shows scheduled for '+MNF[parseInt(mm,10)-1]+' '+year+' yet.';
    var parts=[];
    parts.push(agg.n+' show'+(agg.n>1?'s':'')+' booked in '+MNF[parseInt(mm,10)-1]+' '+year+', projecting '+$m(agg.projBS)+' in bottle service against '+$m(agg.tFee)+' in DJ fees'+(avgROI?' ('+avgROI+'x average ROI)':'')+'.');
    if(budget!=null){
      if(variance>=0) parts.push('Spend is tracking '+$m(Math.abs(variance))+' under the '+$m(budget)+' budget ('+Math.round(spend/budget*100)+'% used).');
      else parts.push('Spend is '+$m(Math.abs(variance))+' OVER the '+$m(budget)+' budget ('+Math.round(spend/budget*100)+'% used).');
    } else {
      parts.push('No budget set for this month yet.');
    }
    if(topShow) parts.push('Biggest booking: '+djLabel(topShow.dj)+' at '+$m(topShow.cost||topShow.fee)+'.');
    return parts.join(' ');
  }

  var curMm=getDjYtdCutoff(year);
  var curLabel=MNF[curMm-1];
  var mAgg=monthAgg(padMm(curMm));
  var mSpend=mAgg.tFee||0;
  var mBudget=getMonthlyBudget(venue,year,padMm(curMm));
  var mPerf=monthPerf(venue,year,padMm(curMm));
  var mRoi=mPerf.roi;

  var t=computeBudgetYearTotals(venue,year);
  var finLabel=t.lastActualMm?MNF[t.lastActualMm-1]:null;

  /* YTD ROI through DJ cutoff */
  var ytdBS=0, ytdFee=0, hasBS=false, hasFee=false;
  for(var mi=1;mi<=curMm;mi++){
    var p=monthPerf(venue,year,padMm(mi));
    if(p.tBS!=null){ ytdBS+=p.tBS; hasBS=true; }
    if(p.tFee!=null){ ytdFee+=p.tFee; hasFee=true; }
  }
  var ytdRoi=(hasBS&&hasFee&&ytdFee>0)?+(ytdBS/ytdFee).toFixed(1):null;

  /* Top performing measured show YTD by ROI */
  var topEx=null;
  SCHED.filter(function(r){
    if(r.v!==venue||r.yr!==year||r._s==='empty') return false;
    var m=parseInt(r.d.slice(5,7),10);
    if(m>curMm) return false;
    var fee=r.cost||r.fee||0;
    return fee>0 && r.bs_a!=null && r.bs_a>0;
  }).forEach(function(r){
    var fee=r.cost||r.fee||0;
    var roi=fee?r.bs_a/fee:0;
    if(!topEx||roi>topEx.roi) topEx={dj:r.dj, fee:fee, bs:r.bs_a, roi:+roi.toFixed(1), d:r.d};
  });

  var s1='In '+curLabel+', Guest DJ spend is '+$m(mSpend)
    +(mBudget!=null?' vs '+$m(mBudget)+' budget':'')
    +(mPerf.tBS!=null?' with '+$m(mPerf.tBS)+' BS Actual':'')
    +(mRoi!=null?' ('+mRoi+'x ROI)':'')+'.';

  var s2='YTD Live Entertainment is '
    +(t.liveActual!=null?$m(t.liveActual):'n/a')
    +(t.liveBudget!=null?' vs '+$m(t.liveBudget)+' budget':'')
    +(t.marginActual!=null?' at '+t.marginActual+'% margin':'')
    +(t.marginBudget!=null?' (budget '+t.marginBudget+'%)':'')
    +(finLabel?' through '+finLabel:'')
    +(ytdRoi!=null?', with '+ytdRoi+'x YTD ROI':'')+'.';

  if(topEx){
    s2+=' Top example: '+djLabel(topEx.dj)+' delivered '+$m(topEx.bs)+' BS on '+$m(topEx.fee)+' ('+topEx.roi+'x).';
  }
  return s1+' '+s2;
}

function renderYearGrid(){
  setBudgetExecVisible(true);
  var titleEl=document.getElementById('budgetPageTitle');
  if(titleEl) titleEl.textContent=budgetSubTab==='planner'?'Budget Planner':'Overview';
  document.getElementById('budgetMeta').textContent=budgetSubTab==='planner'
    ? (bgtVenue+' ? 2025 vs 2026 + 2027 builder')
    : (bgtVenue+' ? '+bgtYear+' ? Executive tables');
  renderBudgetKpiStrip(computeBudgetYearTotals(bgtVenue,bgtYear));

  var narr=generateBudgetNarrative(bgtVenue,bgtYear,null);
  var narrEl=document.getElementById('budgetNarrative');
  if(narrEl){
    if(budgetSubTab==='planner') narrEl.innerHTML='';
    else narrEl.innerHTML='<div class="bgt-narrative">'+narr+'</div>';
  }

  if(budgetSubTab==='planner'){
    var top=document.getElementById('budgetTopLine'); if(top) top.innerHTML='';
    var guest=document.getElementById('budgetGuestDjTable'); if(guest) guest.innerHTML='';
    renderBudgetYoYCompare();
    renderBudget2027Builder();
  } else {
    renderBudgetFinancialTable();
    renderBudgetGuestDjTable();
    var yoy=document.getElementById('budgetYoYCompare'); if(yoy) yoy.innerHTML='';
    var b27=document.getElementById('budget2027Builder'); if(b27) b27.innerHTML='';
  }
  var spendHost=document.getElementById('budgetSpendTracker');
  if(spendHost) spendHost.innerHTML='';
  var monthsHost=document.getElementById('budgetMonths');
  if(monthsHost) monthsHost.innerHTML='';
}

function setBudgetExecVisible(on){
  var overviewIds=['budgetTopLine','budgetGuestDjTable','budgetSpendTracker'];
  var plannerIds=['budgetYoYCompare','budget2027Builder'];
  overviewIds.forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=(on && budgetSubTab!=='planner')?'':'none';
  });
  plannerIds.forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=(on && budgetSubTab==='planner')?'':'none';
  });
  var narr=document.getElementById('budgetNarrative');
  if(narr) narr.style.display=(on && budgetSubTab!=='planner')?'':'none';
  var kpi=document.getElementById('budgetKPIs');
  if(kpi) kpi.style.display='none';
}

function renderMonthDrill(mm){
  var mi=parseInt(mm,10);
  var py1=bgtYear-1;
  var s26=hs(bgtVenue,py1,mm);
  var roi_t=getRoiT(mm);
  var shows=get27Shows(mm);
  var tFee=shows.reduce(function(s,r){return s+(r.cost||r.fee||0);},0);
  var projBS=tFee&&roi_t?Math.round(tFee*roi_t):null;
  var tPY=shows.reduce(function(s,r){return s+(r.py_bs_a||0);},0)||null;
  var vsPY=projBS&&tPY?projBS-tPY:null;

  setBudgetExecVisible(false);
  document.getElementById('budgetMeta').textContent=bgtVenue+' ? '+MNF[mi-1]+' '+bgtYear;
  var narrEl=document.getElementById('budgetNarrative');
  if(narrEl) narrEl.innerHTML='<div class="bgt-narrative">'+generateBudgetNarrative(bgtVenue,bgtYear,mm)+'</div>';

  var html='';

  /* Back + title */
  html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">';
  html+='<button id="bgtBack" style="font-size:11px;font-weight:600;padding:7px 14px;border-radius:var(--r);border:0.5px solid var(--rule);background:var(--card);color:var(--ink2);cursor:pointer;font-family:inherit">&#8592; Year view</button>';
  html+='<button id="bgtPrevM" class="cal-nav-btn" style="width:26px;height:26px">&#8592;</button>';
  html+='<div style="font-size:20px;font-weight:900;letter-spacing:-.5px;min-width:140px">'+MNF[mi-1]+' '+bgtYear+'</div>';
  html+='<button id="bgtNextM" class="cal-nav-btn" style="width:26px;height:26px">&#8594;</button>';
  html+='</div>';
  html+='<div class="month-slider" id="bgtDrillSlider" style="margin:0 0 12px;border-radius:6px;border:0.5px solid var(--rule)">';
  for(var smi=0;smi<12;smi++){
    var smm=smi<10?'0'+(smi+1):''+(smi+1);
    html+='<button class="ms-btn'+(smi+1===mi?' ms-on':'')+'" id="bgtmsbtn'+smi+'" onclick="jumpDrillMonth('+smi+')">'+MNS[smi]+'</button>';
  }
  html+='</div>';

  /*    TOP: previous year recap (single clean banner)    */
  var monthBudget=getMonthlyBudget(bgtVenue,bgtYear,mm);
  var monthVariance=monthBudget!=null?monthBudget-tFee:null;
  html+='<div class="bgt-month-spend-line">';
  html+='<span>DJ $ Budget: <b>'+(monthBudget!=null?$m(monthBudget):'not set')+'</b></span>';
  html+='<span>Actual Spend: <b>'+$m(tFee)+'</b></span>';
  if(monthVariance!=null) html+='<span>Variance: <b class="'+(monthVariance>=0?'pos':'neg')+'">'+$mv(monthVariance)+'</b></span>';
  html+='<input type="number" class="bgt-spend-inp" id="bgtMonthBudgetInp" placeholder="Set budget $" value="'+(monthBudget||'')+'" style="margin-left:auto">';
  html+='</div>';
  html+='<div class="bgtm-recap">';
  html+='<div class="bgtm-recap-hd">'+py1+' Actual   '+MNF[mi-1]+' recap</div>';
  if(s26){
    var bCls=s26.br!=null?(s26.br>=60?'pos':'neg'):'';
    html+='<div class="bgtm-recap-body">';
    html+='<div class="bgtm-rc"><b>'+$m(s26.tBS)+'</b><span>Total BS</span></div>';
    html+='<div class="bgtm-rc"><b>'+s26.n+'</b><span>Shows</span></div>';
    html+='<div class="bgtm-rc"><b>'+$m(s26.avgBS)+'</b><span>Avg BS / show</span></div>';
    html+='<div class="bgtm-rc"><b>'+$m(s26.tFee)+'</b><span>Total DJ fees</span></div>';
    html+='<div class="bgtm-rc"><b class="kc-b">'+rx(s26.avgROI)+'</b><span>Avg ROI</span></div>';
    html+='<div class="bgtm-rc"><b class="'+bCls+'">'+(s26.br!=null?s26.br+'%':'-')+'</b><span>Beat rate</span></div>';
    html+='</div>';
  } else {
    html+='<div class="bgtm-recap-empty">No '+py1+' data for this month</div>';
  }
  html+='</div>';

  /*    ROI target control    */
  html+='<div class="bgtm-roictrl">';
  html+='<span>ROI Target for '+MNF[mi-1]+'</span>';
  html+='<input id="bgtmROI" class="bgtm-inp" type="number" min="1" max="50" step="0.5" value="'+roi_t+'"><span style="font-size:12px;color:var(--ink3)">x</span>';
  html+='<span class="bgtm-roictrl-sep"></span>';
  html+='<span class="bgtm-roictrl-stat">Proj BS <b class="kc-g">'+$m(projBS)+'</b></span>';
  if(vsPY!=null) html+='<span class="bgtm-roictrl-stat">vs '+py1+' <b class="'+(vsPY>=0?'pos':'neg')+'">'+$mv(vsPY)+'</b></span>';
  html+='</div>';

  /*    BOTTOM: 2027 DJ schedule    */
  if(shows.length){
    html+='<div style="background:var(--card);border-radius:10px;overflow:hidden;border:0.5px solid var(--rule);margin-top:12px">';
    html+='<div style="padding:10px 14px;background:var(--card2);display:flex;align-items:center;justify-content:space-between;border-bottom:0.5px solid var(--rule)">';
    html+='<span style="font-size:12px;font-weight:700">'+bgtYear+' DJ Schedule   edit fees here, or on the calendar</span>';
    html+='<button id="bgtAddRow" style="font-size:11px;font-weight:600;padding:5px 12px;border-radius:var(--r);border:none;background:var(--ink);color:#fff;cursor:pointer;font-family:inherit">+ Add show</button>';
    html+='</div>';
    html+='<div class="bgtm-trow bgtm-thdr"><div>Date</div><div>DJ</div><div>Fee ($)</div><div>PY DJ</div><div>PY BS Act</div><div>PY ROI</div><div>Proj BS</div><div>Proj ROI</div><div>Event</div><div></div></div>';

    shows.forEach(function(r){
      var si=SCHED.indexOf(r);
      var dt=new Date(r.d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      var fee=r.cost||r.fee||0;
      var projBSrow=fee&&roi_t?Math.round(fee*roi_t):null;
      var pCls=projBSrow&&r.py_bs_a?(projBSrow>=r.py_bs_a?'pos':'neg'):'';
      var bpy=resolvePyFields(bgtVenue, r.d, r);
      var pyBCls=bpy.py_beat===1?'pos':bpy.py_beat===0?'neg':'';
      var pyB=bpy.py_beat===1?'<span class="bgt-beat beat">BEAT</span>':bpy.py_beat===0?'<span class="bgt-beat miss">MISS</span>':'';
      html+='<div class="bgtm-trow'+(fee?' bgtm-tr-hasfee':'')+'">';
      html+='<div style="color:var(--ink3);font-size:10px">'+dt+'</div>';
      html+='<div><span class="bgt-djbtn" data-si="'+si+'">'+(r.dj&&String(r.dj).trim()?djLabel(r.dj):'+ Pick DJ')+'</span></div>';
      html+='<div><input class="bgtm-fi" type="number" min="0" placeholder="Enter fee" value="'+(fee||'')+'" data-si="'+si+'"></div>';
      html+='<div style="font-size:10px;color:var(--ink3)">'+(bpy.py_dj||'-')+''+pyB+'</div>';
      html+='<div class="'+pyBCls+'" style="font-weight:600">'+(bpy.py_bs_a?$m(bpy.py_bs_a):'-')+'</div>';
      html+='<div class="'+roiTone(bpy.py_roi_a, bpy.py_roi_t)+'">'+(bpy.py_roi_a!=null?Number(bpy.py_roi_a).toFixed(1)+'x':'-')+'</div>';
      html+='<div class="'+pCls+'" style="font-weight:800">'+(projBSrow?$m(projBSrow):'-')+'</div>';
      html+='<div style="color:var(--blue);font-weight:600">'+(projBSrow&&fee?+(projBSrow/fee).toFixed(2)+'x':'-')+'</div>';
      html+='<div style="font-size:9px;color:var(--ink3)">'+(r.ev||'')+'</div>';
      html+='<div class="bgt-del" data-si="'+si+'">&#215;</div>';
      html+='</div>';
    });

    /* month total */
    html+='<div class="bgtm-trow bgtm-ttotal">';
    html+='<div style="grid-column:1/3;font-weight:800">'+MNS[mi-1].toUpperCase()+' TOTAL</div>';
    html+='<div style="font-weight:700">'+$m(tFee)+'</div>';
    html+='<div style="grid-column:4/7">'+$m(tPY)+' PY</div>';
    html+='<div style="font-weight:900;font-size:14px;color:#2d6a2d">'+$m(projBS)+'</div>';
    html+='<div style="font-weight:700;color:var(--blue)">'+(tFee&&roi_t?roi_t+'x tgt':'-')+'</div>';
    html+='<div class="'+(vsPY!=null?(vsPY>=0?'pos':'neg'):'')+'">'+$mv(vsPY)+' vs PY</div>';
    html+='<div style="grid-column:10/11"></div>';
    html+='</div>';

    html+='</div>';
  } else {
    html+='<div style="padding:30px;text-align:center;background:var(--card);border-radius:10px;border:0.5px dashed var(--rule);color:var(--ink3);margin-top:12px">';
    html+='No shows scheduled for '+MNF[mi-1]+' '+bgtYear+'.<br><button id="bgtAddRow" style="margin-top:10px;font-size:11px;font-weight:600;padding:7px 16px;border-radius:var(--r);border:none;background:var(--blue);color:#fff;cursor:pointer;font-family:inherit">+ Add show to calendar</button>';
    html+='</div>';
  }

  document.getElementById('budgetMonths').innerHTML=html;

  /* Listeners */
  document.getElementById('bgtBack').addEventListener('click',function(){bgtMonth=null;renderBudget();});
  var mBudgetInp=document.getElementById('bgtMonthBudgetInp');
  if(mBudgetInp) mBudgetInp.addEventListener('change',function(){ setMonthlyBudget(bgtVenue,bgtYear,mm,mBudgetInp.value); renderBudget(); });
  document.getElementById('bgtPrevM').addEventListener('click',function(){
    var pm=mi-1; if(pm<1){pm=12;} bgtMonth=(pm<10?'0':'')+pm; renderBudget();
  });
  document.getElementById('bgtNextM').addEventListener('click',function(){
    var nm=mi+1; if(nm>12){nm=1;} bgtMonth=(nm<10?'0':'')+nm; renderBudget();
  });
  setTimeout(function(){
    var b=document.getElementById('bgtmsbtn'+(mi-1));
    if(b&&b.scrollIntoView) b.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  },50);

  var roiInp=document.getElementById('bgtmROI');
  if(roiInp) roiInp.addEventListener('input',function(){
    bgtROITargets[roiKey(mm)]=+this.value||5; renderBudget();
  });

  document.querySelectorAll('#budgetMonths .bgtm-fi').forEach(function(inp){
    inp.addEventListener('change',function(){
      var si=+inp.dataset.si;
      if(SCHED[si]){
        SCHED[si].cost=+inp.value||null;
        SCHED[si].fee=+inp.value||null;
        applyShowTargets(SCHED[si]);
        persistSchedShow(SCHED[si]);
      }
      IDX=buildIdx(SCHED);
      renderBudget();
    });
  });

  document.querySelectorAll('#budgetMonths .bgt-djbtn').forEach(function(btn){
    btn.addEventListener('click',function(){
      _djTarget={si:+btn.dataset.si};
      openDjPickerBgt();
    });
  });

  document.querySelectorAll('#budgetMonths .bgt-del').forEach(function(btn){
    btn.addEventListener('click',function(){
      var si=+btn.dataset.si;
      var show=SCHED[si];
      if(!show) return;
      if(!confirm('Remove '+(show.dj||'this performance')+' on '+(show.d||'')+'?\n\nThis syncs for everyone.')) return;
      var before=_clone(show), beforeIndex=si;
      pushUndo('Delete show: '+(show.dj||'TBD')+' '+show.d,function(){
        _undoShowChange(before,null,beforeIndex);
      });
      if(typeof _fbRemoveSchedRecord==='function') _fbRemoveSchedRecord(show);
      SCHED.splice(si,1);
      IDX=buildIdx(SCHED);
      if(typeof clearPyMapCache==='function') clearPyMapCache();
      renderBudget();
      if(curView==='calendar') go();
      if(curView==='accounting') renderAccounting();
    });
  });

  var addBtn=document.getElementById('bgtAddRow');
  if(addBtn) addBtn.addEventListener('click',function(){
    var mi=parseInt(mm,10)||1;
    var d;
    try{ d=fiscalPeriodRange(bgtYear, mi-1).from; }
    catch(eBgt){ d=bgtYear+'-'+mm+'-01'; }
    var rec={v:bgtVenue,yr:bgtYear,d:d,dj:'',cost:null,fee:null,
      py_dj:null,py_bs_a:null,py_roi_a:null,py_beat:null,ev:'',_s:'fut',
      _added:1,djStatus:null};
    ensureShowUid(rec);
    SCHED.push(rec);
    var after=_clone(rec);
    pushUndo('Add show: '+d,function(){ _undoShowChange(null,after,SCHED.length-1); });
    IDX=buildIdx(SCHED);
    if(typeof persistSchedShow==='function') persistSchedShow(rec);
    renderBudget();
    if(curView==='calendar') go();
  });
}

function jumpDrillMonth(smi){ bgtMonth=(smi<9?'0':'')+(smi+1); renderBudget(); }

function openDjPickerBgt(){
  document.getElementById('djPickerModal').classList.remove('hidden');
  var inp=document.getElementById('djSearch');
  inp.value=''; inp.focus(); renderDjList('');
  inp.oninput=function(){renderDjList(inp.value);};
}
function closeDjPicker(){document.getElementById('djPickerModal').classList.add('hidden');_djTarget=null;}
function renderDjList(q){
  var qs=q.trim().toUpperCase(),max=DJ_PROFILES[0]?DJ_PROFILES[0].score:1;
  var list=DJ_PROFILES.filter(function(p){return !qs||p.name.indexOf(qs)>=0||(p.display||'').toUpperCase().indexOf(qs)>=0;}).slice(0,60);
  document.getElementById('djPickerList').innerHTML=list.map(function(p,i){
    var bar=Math.round(Math.min(100,p.score/max*100));
    var bCls=p.beat_rate>=60?'pos':'neg';
    return '<div class="dp-row" data-name="'+encodeURIComponent(p.display||'')+'">'
      +'<div class="dp-rank">'+(i+1)+'</div>'
      +'<div class="dp-info"><div class="dp-name">'+(p.display||'')+'</div>'
      +'<div class="dp-sub">'+p.n+' shows &middot; '+p.beat_rate+'% beat &middot; avg BS '+$m(p.avg_bs)+' &middot; avg fee '+$m(p.avg_fee)+'</div>'
      +'<div class="dp-bar"><div class="dp-fill" style="width:'+bar+'%"></div></div></div>'
      +'<div class="dp-stat"><b>'+p.avg_roi_a+'x</b><span>ROI</span></div>'
      +'<div class="dp-stat"><b class="'+bCls+'">'+p.beat_rate+'%</b><span>beat</span></div>'
      +'</div>';
  }).join('');
  document.querySelectorAll('.dp-row').forEach(function(row){
    row.addEventListener('click',function(){
      if(!_djTarget) return;
      var name=decodeURIComponent(row.dataset.name||'');
      var si=_djTarget.si;
      if(SCHED[si]){
        SCHED[si].dj=name;
        var p=djProj(name,SCHED[si].cost||SCHED[si].fee||null);
        if(!SCHED[si].cost&&p.p){ SCHED[si].cost=p.p.avg_fee; SCHED[si].fee=p.p.avg_fee; }
        SCHED[si]._s=SCHED[si].d>TODAY?'fut':'nd';
        applyShowTargets(SCHED[si]);
        persistSchedShow(SCHED[si]);
      }
      IDX=buildIdx(SCHED);
      closeDjPicker(); renderBudget();
      if(curView==='calendar') go();
      if(curView==='accounting') renderAccounting();
    });
  });
}
document.getElementById('djPickerModal').addEventListener('click',function(e){if(e.target===this)closeDjPicker();});

function addBudgetRow(){ /* called from HTML button */ var mm=bgtMonth||'01'; bgtMonth=mm; renderBudget(); }

function exportBudgetCSV(){
  var lines=['Month,Shows,Total Fee,ROI Target,Proj BS,PY BS,vs PY'];
  for(var mi=1;mi<=12;mi++){
    var mm=mi<10?'0'+mi:''+mi;
    var agg=monthAgg(mm); if(!agg.n&&!agg.tFee) continue;
    lines.push([MNS[mi-1],(agg.n||0),(agg.tFee||''),(getRoiT(mm)||''),(agg.projBS||''),(agg.tPY||''),(agg.projBS&&agg.tPY?agg.projBS-agg.tPY:'')].join(','));
    var shows=get27Shows(mm);
    shows.forEach(function(r){lines.push(['',r.d,'"'+(r.dj||'')+'"',(r.cost||''),(r.py_bs_a||''),(r.py_roi_a||''),'',''].join(','));});
  }
  dlFile(lines.join('\n'),'budget_'+bgtVenue.replace(/ /g,'_')+'_'+bgtYear+'.csv','text/csv');
}
/*                                                                 */


/*                                                                
   V5 COMPLETE REPLACEMENT CODE
   All view functions + accounting tracker
                                                                   */


var DOW_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var MN_FULL  = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];
var MN_SH    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var acctData = {};
var acctOthersData = {};
var specialWeeks = {};
var acctM = 0;
var acctSubTab = 'guest';
var curAcctV = 'Casa Neos Beach Club';
var ACCOUNTING_ONLY_VENUES = ['Claudie','AVA WP','AVA CG','Mila Restaurant'];
var ACCT_OTHER_CATS = [
  {id:'hotel', label:'Hotel'},
  {id:'ground', label:'Ground'},
  {id:'resident_dj', label:'Resident DJ'},
  {id:'light_jockey', label:'Light Jockey'},
  {id:'fire_performance', label:'Fire Performance'},
  {id:'tech_line', label:'Tech Line'},
  {id:'kryo', label:'Kryo'}
];
function djVenuesList(){
  var venues=[];
  SCHED.forEach(function(r){ if(venues.indexOf(r.v)<0 && HIDE_V.indexOf(r.v)<0) venues.push(r.v); });
  venues.sort();
  return venues;
}
function accountingVenuesList(){
  var base=djVenuesList();
  ACCOUNTING_ONLY_VENUES.forEach(function(v){ if(base.indexOf(v)<0) base.push(v); });
  return base;
}
function isAccountingOnlyVenue(v){ return ACCOUNTING_ONLY_VENUES.indexOf(v)>=0; }
function acctVenue(){ return curView==='accounting' ? curAcctV : curV; }
function fillAcctVenueSelect(){
  var sel=document.getElementById('acctVenueSel');
  if(!sel) return;
  var list=accountingVenuesList();
  if(list.indexOf(curAcctV)<0) curAcctV=list[0]||curV;
  sel.innerHTML=list.map(function(v){
    return '<option value="'+v+'"'+(v===curAcctV?' selected':'')+'>'+v+'</option>';
  }).join('');
}
function selAcctVenue(v){
  curAcctV=v;
  if(isAccountingOnlyVenue(v)){
    acctSubTab='others';
  } else {
    curV=v;
    buildVenTabs(); buildSidebar();
  }
  updateTopbarLogo(curAcctV||curV);
  renderAccounting();
}
function setAcctSubTab(tab){
  acctSubTab=tab==='others'?'others':'guest';
  renderAccounting();
}

/* ???????????????????????????????????????????????????????????????????
   FIREBASE REAL-TIME SYNC
   All UI mutations (add/edit/delete show, special weeks, ROI rules,
   fee tiers, budget) are written to Firebase so every browser sees
   the same state instantly.
   ??????????????????????????????????????????????????????????????????? */
