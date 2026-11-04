/* Monthly Live Entertainment Recap. Reads the ingested P&L and the live calendar.
   Does not write shows, fees, or schedule overrides. */
var MR_ORDER=['MILA Lounge','Casa Neos Lounge','Casa Neos Beach Club'];
var MR_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

function mrStore(){ return window.DJ_MONTHLY_RECAP||{venues:{}}; }
function mrVenue(name){ return (mrStore().venues||{})[name]||null; }
function mrLabel(name){
  var v=mrVenue(name);
  return (v&&v.label)||name;
}
function mrSanitySectionHtml(){
  return '<div class="mr-tabs">'
    +'<button type="button" class="mr-tab" onclick="setView(\'mrecap\')">Monthly Recap</button>'
    +'<button type="button" class="mr-tab" onclick="setView(\'rolling\')">Weekly Meeting</button>'
    +'</div>';
}
function mrPeriods(){
  var beach=mrVenue('Casa Neos Beach Club');
  var years=beach&&beach.pl?Object.keys(beach.pl):[];
  var out=[];
  years.forEach(function(year){
    Object.keys(beach.pl[year]||{}).forEach(function(p){
      var period=+p;
      if(!(period>=1&&period<=12)) return;
      var meta=mrPeriodMeta(+year, period);
      out.push(meta);
    });
  });
  out.sort(function(a,b){ return a.from<b.from?-1:(a.from>b.from?1:0); });
  if(typeof curYr!=='undefined' && typeof curM!=='undefined' && curM!=null){
    var cal=mrPeriodMeta(curYr, curM+1);
    if(!out.some(function(m){ return m.key===cal.key; })) out.push(cal);
    out.sort(function(a,b){ return a.from<b.from?-1:(a.from>b.from?1:0); });
  }
  return out;
}
function mrPeriodMeta(year, period){
  var mi=period-1;
  var range=(typeof fiscalPeriodRange==='function')?fiscalPeriodRange(year, mi):{from:'',to:''};
  var end=(typeof _parseYmd==='function'&&range.to)?_parseYmd(range.to):null;
  var label=end?MR_MONTHS[end.getMonth()]+' '+end.getFullYear():('Period '+period+' '+year);
  var short=(typeof fiscalPeriodShortRange==='function')?fiscalPeriodShortRange(year, mi):'';
  return {year:year, period:period, key:year+'-'+period, label:label, range:short, from:range.from, to:range.to};
}
function mrCurrent(){
  var all=mrPeriods();
  var key=window._mrKey;
  var found=null;
  if(key) all.forEach(function(m){ if(m.key===key) found=m; });
  if(found) return found;
  var calKey=(typeof curYr!=='undefined' && typeof curM!=='undefined')?(curYr+'-'+(curM+1)):null;
  if(calKey) all.forEach(function(m){ if(m.key===calKey) found=m; });
  if(found) return found;
  return all[all.length-1]||mrPeriodMeta(typeof curYr!=='undefined'?curYr:2026, (typeof curM!=='undefined'?curM:9)+1);
}
function mrSelectPeriod(key){
  window._mrKey=key;
  mrRenderPage();
}
function mrPl(venue, year, period){
  var v=mrVenue(venue);
  if(!v||!v.pl||!v.pl[String(year)]) return null;
  return v.pl[String(year)][String(period)]||null;
}
function mrFee(r){
  var raw=r&&r.fee!=null&&r.fee!==''?r.fee:(r&&r.cost!=null?r.cost:null);
  var n=raw!=null&&raw!==''?+raw:null;
  return n!=null&&isFinite(n)?n:null;
}
function mrShowRoi(r){
  var fee=mrFee(r);
  var tgt=(typeof showTargets==='function')?showTargets(r):{roi_t:r.roi_t};
  var roiT=tgt&&tgt.roi_t!=null&&tgt.roi_t!==''&&isFinite(+tgt.roi_t)?+tgt.roi_t:null;
  var bs=r.bs_a!=null&&r.bs_a!==''&&isFinite(+r.bs_a)?+r.bs_a:null;
  var roiA=r.roi_a!=null&&r.roi_a!==''&&isFinite(+r.roi_a)?+r.roi_a:null;
  if(roiA==null&&fee>0&&bs!=null) roiA=bs/fee;
  return {fee:fee, bs:bs, roiT:roiT, roiA:roiA};
}
function mrShows(venue, meta){
  var rows=(typeof SCHED!=='undefined'&&SCHED)?SCHED:[];
  return rows.filter(function(r){
    if(!r||r._s==='empty'||!r.d) return false;
    if((r.v||r.venue)!==venue) return false;
    if(meta.from&&r.d<meta.from) return false;
    if(meta.to&&r.d>meta.to) return false;
    var dj=String(r.dj||'').trim();
    var fee=mrFee(r);
    return !!dj||(fee!=null&&fee>0);
  }).sort(function(a,b){ return a.d<b.d?-1:(a.d>b.d?1:0); });
}
function mrBeat(shows){
  var n=0, hit=0, bs=0, hasBs=false;
  shows.forEach(function(r){
    var x=mrShowRoi(r);
    if(x.bs!=null){ bs+=x.bs; hasBs=true; }
    if(x.roiA==null||x.roiT==null) return;
    n++;
    if(x.roiA+1e-9>=x.roiT) hit++;
  });
  return {rate:n?hit/n:null, hit:hit, n:n, bs:hasBs?bs:null};
}
function mrDaySales(venue, date){
  var v=mrVenue(venue);
  if(!v||!v.daily) return null;
  var n=v.daily[date];
  return n!=null&&isFinite(+n)?+n:null;
}
function mrDayMargin(venue, sales, fee){
  var v=mrVenue(venue);
  var model=v&&v.model;
  if(!model||!(sales>0)||fee==null||!isFinite(+fee)) return null;
  var ebitda=sales*model.contrib-model.fixed-fee;
  return {ebitda:ebitda, margin:ebitda/sales};
}
function mrPct(n){
  if(n==null||!isFinite(+n)) return '—';
  return (n*100).toFixed(1)+'%';
}
function mrPp(now, py, lowerBetter){
  if(now==null||py==null||!isFinite(+now)||!isFinite(+py)) return {text:'—', cls:''};
  var pp=(now-py)*100;
  var up=pp>0.05, down=pp<-0.05;
  var cls=(lowerBetter?down:up)?'mr-pos':((lowerBetter?up:down)?'mr-neg':'');
  var sign=pp>0?'+':'';
  return {text:sign+pp.toFixed(1)+' pp', cls:cls};
}
function mrVar(now, py, lowerBetter){
  if(now==null||py==null||!isFinite(+now)||!isFinite(+py)||py===0) return {text:'—', cls:''};
  var pct=(now-py)/Math.abs(py)*100;
  var up=pct>0.05, down=pct<-0.05;
  var cls=(lowerBetter?down:up)?'mr-pos':((lowerBetter?up:down)?'mr-neg':'');
  var sign=pct>0?'+':'';
  return {text:sign+pct.toFixed(1)+'%', cls:cls};
}
function mrMoney(n){ return (typeof $k==='function')?$k(n):(n==null?'—':String(Math.round(n))); }
function mrLiveBudget(venue, meta){
  if(!meta||typeof BGT_PLAN==='undefined') return null;
  var mm=meta.period<10?'0'+meta.period:String(meta.period);
  var row=((BGT_PLAN[venue]||{})[String(meta.year)]||{})[mm];
  return row&&row.live!=null&&isFinite(+row.live)?+row.live:null;
}
/* Spending above budget is worse. */
function mrSpendVar(spend, budget){
  if(spend==null||budget==null||!isFinite(+spend)||!isFinite(+budget)) return {text:'—', cls:''};
  var gap=spend-budget;
  var cls=gap>0.5?'mr-neg':(gap<-0.5?'mr-pos':'');
  return {text:(gap>0?'+':'')+mrMoney(gap), cls:cls};
}
function mrBudgetRow(spend, budget, rowClass){
  var v=mrSpendVar(spend, budget);
  var solo=rowClass&&rowClass.indexOf('mr-solo')>=0;
  return '<div class="mr-budget '+(rowClass||'mr-line')+'"><span>Budget</span><b>'+mrMoney(budget)+'</b>'+(solo?'':'<b></b>')+'<b class="'+v.cls+'">'+v.text+'</b></div>';
}
function mrDayLabel(d){
  if(typeof _bpDay==='function') return _bpDay(d);
  return d||'—';
}
function mrDj(r){
  var name=r&&r.dj?r.dj:'';
  if(typeof djLabel==='function') name=djLabel(name)||name;
  return name||'TBD';
}
function wmYmd(d){
  var m=d.getMonth()+1, day=d.getDate();
  return d.getFullYear()+'-'+(m<10?'0'+m:''+m)+'-'+(day<10?'0'+day:''+day);
}
function wmAddDays(iso, n){
  var d=new Date(String(iso).slice(0,10)+'T12:00:00');
  d.setDate(d.getDate()+n);
  return wmYmd(d);
}
function wmSpan(a, b){
  var d1=new Date(String(a).slice(0,10)+'T12:00:00');
  var d2=new Date(String(b).slice(0,10)+'T12:00:00');
  return Math.round((d2-d1)/86400000);
}
function wmSumMap(map, from, to){
  if(!map) return null;
  var sum=0, any=false;
  Object.keys(map).forEach(function(ds){
    if(from&&ds<from) return;
    if(to&&ds>to) return;
    var n=+map[ds];
    if(!isFinite(n)) return;
    sum+=n; any=true;
  });
  return any?sum:null;
}
function wmDaySales(venue, date){
  var map=window.WM_MTD&&WM_MTD.sales?WM_MTD.sales[venue]:null;
  if(map&&map[date]!=null&&isFinite(+map[date])) return +map[date];
  return mrDaySales(venue, date);
}
function wmToastDay(venue, date){
  var map=window.WM_MTD&&WM_MTD.toast?WM_MTD.toast[venue]:null;
  if(map&&map[date]!=null&&isFinite(+map[date])) return +map[date];
  return null;
}
function wmMtdRows(venue, meta, useToast){
  var shows=mrShows(venue, meta);
  var byDate={};
  shows.forEach(function(r){ byDate[r.d]=(byDate[r.d]||0)+1; });
  return shows.map(function(r){
    var x=mrShowRoi(r);
    var sales=wmDaySales(venue, r.d);
    var bs=x.bs;
    if(useToast){
      var dayBs=wmToastDay(venue, r.d);
      if(dayBs!=null&&byDate[r.d]===1) bs=dayBs;
    }
    var tgt=(typeof showTargets==='function')?showTargets(r):null;
    var bsT=tgt&&tgt.bs_m!=null&&isFinite(+tgt.bs_m)?+tgt.bs_m:null;
    var roiA=x.roiA;
    if(x.fee>0&&bs!=null) roiA=bs/x.fee;
    var margin=mrDayMargin(venue, sales, x.fee);
    return {r:r, dj:mrDj(r), d:r.d, fee:x.fee, bs:bs, bsT:bsT, roiA:roiA, roiT:x.roiT, sales:sales, margin:margin};
  });
}
function wmBeatRows(rows){
  var n=0, hit=0;
  rows.forEach(function(row){
    if(row.roiA==null||row.roiT==null) return;
    n++;
    if(row.roiA+1e-9>=row.roiT) hit++;
  });
  return {rate:n?hit/n:null, hit:hit, n:n};
}
function wmSpend(rows){
  var sum=0, any=false;
  rows.forEach(function(row){
    if(row.fee!=null&&isFinite(+row.fee)){ sum+=+row.fee; any=true; }
  });
  return any?sum:null;
}
function wmFiscalMm(period){
  var n=+period||0;
  return n<10?'0'+n:String(n);
}
/* Budget total: guest DJ already played and still booked, plus every other entertainment category. */
function wmFullSpend(venue, year, period){
  var mm=wmFiscalMm(period);
  if(typeof bgtFullLiveSpend==='function') return bgtFullLiveSpend(venue, year, mm);
  return null;
}
function wmBsVs(actual, target){
  if((actual==null||!isFinite(+actual))&&(target==null||!isFinite(+target))) return '—';
  var txt=mrMoney(actual)+' <span>vs '+mrMoney(target)+'</span>';
  if(actual!=null&&isFinite(+actual)&&target>0){
    var gap=(actual-target)/Math.abs(target)*100;
    var cls=gap>=-0.05?'wm-bs-hit':'wm-bs-miss';
    txt+=' <b class="'+cls+'">'+(gap>0?'+':'')+gap.toFixed(0)+'%</b>';
  }
  return txt;
}
function wmBs(rows){
  var sum=0, any=false;
  rows.forEach(function(row){
    if(row.bs!=null&&isFinite(+row.bs)){ sum+=+row.bs; any=true; }
  });
  return any?sum:null;
}
function mrVenuePack(venue, meta){
  var now=mrPl(venue, meta.year, meta.period);
  var py=mrPl(venue, meta.year-1, meta.period);
  var shows=mrShows(venue, meta);
  var pyMeta=mrPeriodMeta(meta.year-1, meta.period);
  var pyShows=mrShows(venue, pyMeta);
  var beat=mrBeat(shows);
  var pyBeat=mrBeat(pyShows);
  var rows=shows.map(function(r){
    var x=mrShowRoi(r);
    var sales=mrDaySales(venue, r.d);
    var margin=mrDayMargin(venue, sales, x.fee);
    return {r:r, dj:mrDj(r), d:r.d, fee:x.fee, bs:x.bs, roiA:x.roiA, roiT:x.roiT, sales:sales, margin:margin};
  });
  if(meta&&meta.mtd){
    var pyTo=wmAddDays(pyMeta.from, wmSpan(meta.from, meta.to));
    if(pyTo>pyMeta.to) pyTo=pyMeta.to;
    pyMeta=Object.assign({}, pyMeta, {to:pyTo});
    rows=wmMtdRows(venue, meta, true);
    var pyRows=wmMtdRows(venue, pyMeta, false);
    var sales=wmSumMap(window.WM_MTD&&WM_MTD.sales?WM_MTD.sales[venue]:null, meta.from, meta.to);
    var pySales=wmSumMap(window.WM_MTD&&WM_MTD.sales?WM_MTD.sales[venue]:null, pyMeta.from, pyMeta.to);
    var live=wmFullSpend(venue, meta.year, meta.period);
    var pyLive=wmFullSpend(venue, meta.year-1, meta.period);
    beat=wmBeatRows(rows);
    beat.bs=wmBs(rows);
    pyBeat=wmBeatRows(pyRows);
    pyBeat.bs=wmBs(pyRows);
    now={sales:sales, live:live, livePct:(sales>0&&live!=null)?live/sales:null};
    if(venue==='Casa Neos Lounge') py=null;
    else py={sales:pySales, live:pyLive, livePct:(pySales>0&&pyLive!=null)?pyLive/pySales:null};
  }
  return {venue:venue, label:mrLabel(venue), now:now, py:py, beat:beat, pyBeat:pyBeat, rows:rows};
}
function mrPack(meta){
  return {meta:meta, venues:MR_ORDER.map(function(v){ return mrVenuePack(v, meta); })};
}
function mrVarHtml(v){
  return '<b class="'+v.cls+'">'+v.text+'</b>';
}
function mrLine(label, now, py, kind, novar, solo){
  var nowTxt=kind==='pct'||kind==='live'||kind==='roi'?mrPct(now):mrMoney(now);
  var pyTxt=kind==='pct'||kind==='live'||kind==='roi'?mrPct(py):mrMoney(py);
  var gap=kind==='spend'?mrVar(now, py, true):(kind==='money'?mrVar(now, py):mrPp(now, py, kind==='live'));
  if(solo) return '<div class="mr-line mr-solo"><span>'+label+'</span><b>'+nowTxt+'</b>'+(novar?'<b></b>':mrVarHtml(gap))+'</div>';
  return '<div class="mr-line"><span>'+label+'</span><b>'+nowTxt+'</b><b>'+pyTxt+'</b>'+(novar?'<b></b>':mrVarHtml(gap))+'</div>';
}
function mrHeads(year, solo){
  if(solo) return '<div class="mr-line mr-head mr-solo"><span></span><b>'+year+'</b><b></b></div>';
  return '<div class="mr-line mr-head"><span></span><b>'+year+'</b><b>'+(year-1)+'</b><b>Var</b></div>';
}
function mrArrow(label, now, py){
  var pyTxt=py==null?'—':mrMoney(py);
  return '<div class="mr-line mr-arrow"><span><i class="bp-arr"></i>'+label+'</span><b>'+mrMoney(now)+'</b><b>'+pyTxt+'</b><b></b></div>';
}
function mrCardHtml(p, meta){
  var n=p.now||{}, y=p.py||{};
  var year=meta.year;
  var solo=!p.py;
  var h='<article class="mr-card'+(solo?' mr-solo-card':'')+'"><h3>'+_escHtml(p.label)+'</h3>';
  h+=mrHeads(year, solo);
  h+=mrLine('Total Sales', n.sales, y.sales, 'money', solo, solo);
  h+=solo
    ? '<div class="mr-line mr-solo mr-arrow"><span><i class="bp-arr"></i>Bottle Service Sales</span><b>'+mrMoney(p.beat.bs)+'</b><b></b></div>'
    : mrArrow('Bottle Service Sales', p.beat.bs, p.pyBeat.bs);
  h+=mrLine('ROI % Beat', p.beat.rate, p.pyBeat.rate, 'roi', solo, solo);
  h+=mrLine('Live E Spent Actual + Forecast', n.live, y.live, 'spend', solo, solo);
  h+=mrBudgetRow(n.live, mrLiveBudget(p.venue, meta), solo?'mr-line mr-solo':'');
  h+=mrLine('Live Ent. margins', n.livePct, y.livePct, 'live', solo, solo);
  h+='</article>';
  return h;
}
function mrRoiClass(row){
  if(!row||row.roiA==null||row.roiT==null||!isFinite(+row.roiA)||!isFinite(+row.roiT)) return '';
  return (+row.roiA+1e-9<+row.roiT)?'mr-miss':'mr-beat';
}
function mrShowsTable(rows){
  var h='<table class="mr-shows"><thead><tr><th class="l">Date</th><th class="l">DJ</th><th>DJ fee</th><th>ROI actual</th><th>ROI target</th><th>Sales</th><th>Margin</th></tr></thead><tbody>';
  if(!rows.length) h+='<tr><td class="l" colspan="7">No performances this month.</td></tr>';
  rows.forEach(function(row){
    var tone=mrRoiClass(row);
    h+='<tr'+(tone?' class="'+tone+'"':'')+'><td class="l"><b>'+_escHtml(mrDayLabel(row.d))+'</b></td><td class="l">'+_escHtml(row.dj)+'</td><td>'+mrMoney(row.fee)+'</td><td>'+(typeof rx==='function'?rx(row.roiA):'—')+'</td><td>'+(typeof rx==='function'?rx(row.roiT):'—')+'</td><td>'+mrMoney(row.sales)+'</td><td>'+mrPct(row.margin&&row.margin.margin)+'</td></tr>';
  });
  h+='</tbody></table>';
  return h;
}
function mrRenderPage(){
  var host=document.getElementById('mrecapBody');
  if(!host) return;
  var periods=mrPeriods();
  var meta=mrCurrent();
  window._mrKey=meta.key;
  window._mrMeta=meta;
  var pack=mrPack(meta);
  var h='<div class="mr-bar"><label class="mr-note">Month <select onchange="mrSelectPeriod(this.value)">';
  periods.forEach(function(m){
    h+='<option value="'+m.key+'"'+(m.key===meta.key?' selected':'')+'>'+_escHtml(m.label+' · '+m.range)+'</option>';
  });
  h+='</select></label><button type="button" class="mr-go" onclick="mrExportPdf()">Export PDF</button>';
  h+='<span class="mr-note">P&amp;L from the workbook. Bottle service and ROI beat from the calendar. October 2026 is period 10, through '+_escHtml(meta.range||'')+'.</span></div>';
  h+='<div class="mr-grid">';
  pack.venues.forEach(function(p){ h+=mrCardHtml(p, meta); });
  h+='</div>';
  pack.venues.forEach(function(p){
    h+='<div class="mr-card"><h3>'+_escHtml(p.label)+'</h3>';
    h+=mrShowsTable(p.rows);
    h+='</div>';
  });
  host.innerHTML=h;
}
function mrPdfVar(v){ return '<b class="'+v.cls+'">'+v.text+'</b>'; }
function mrPdfRow(label, now, py, kind, novar){
  var nowTxt=kind==='pct'||kind==='live'||kind==='roi'?mrPct(now):mrMoney(now);
  var pyTxt=kind==='pct'||kind==='live'||kind==='roi'?mrPct(py):mrMoney(py);
  var gap=kind==='spend'?mrVar(now, py, true):(kind==='money'?mrVar(now, py):mrPp(now, py, kind==='live'));
  return '<div class="mr-pdf-row"><span>'+label+'</span><b>'+nowTxt+'</b><b>'+pyTxt+'</b>'+(novar?'<b></b>':mrPdfVar(gap))+'</div>';
}
function mrPdfHeads(year){
  return '<div class="mr-pdf-row mr-pdf-head"><span></span><b>'+year+'</b><b>'+(year-1)+'</b><b>Var</b></div>';
}
function mrPdfArrow(label, now, py){
  var pyTxt=py==null?'—':mrMoney(py);
  return '<div class="mr-pdf-row mr-arrow"><span><i class="bp-arr"></i>'+label+'</span><b>'+mrMoney(now)+'</b><b>'+pyTxt+'</b><b></b></div>';
}
function mrCmpCell(tag, cls, text){
  return '<'+tag+' class="'+cls+'">'+text+'</'+tag+'>';
}
function mrBlank(){ return '\u2014'; }
function mrMoneyCell(n){
  if(n==null||!isFinite(+n)) return mrBlank();
  var t=mrMoney(n);
  return t==='-'||t==='\u2014'?mrBlank():t;
}
/* One grid for the whole card, so 2026, 2025, and Var share the same tracks. */
function mrCmpRow(label, now, py, gap, opt){
  opt=opt||{};
  var row=opt.row?' '+opt.row:'';
  var tone=opt.tone?' '+opt.tone:'';
  var cells=mrCmpCell('span','mr-c-lab'+row,label)+mrCmpCell('b','mr-c-now'+row,now);
  if(!opt.solo) cells+=mrCmpCell('b','mr-c-py'+row,py);
  return cells+mrCmpCell('b','mr-c-var'+row+tone,gap);
}
function mrComparePage(pack, opt){
  opt=opt||{};
  var meta=pack.meta;
  var kicker=opt.kicker||'Monthly Live Entertainment Recap';
  var h='<div class="bp-page bp-deck mr-fill"><div class="bp-deck-hd"><div><div class="bp-deck-kicker">'+_escHtml(kicker)+'</div><b>'+_escHtml(meta.label)+'</b><em>'+_escHtml(meta.range||'')+'</em></div><img src="assets/rdg-logo.png" alt="RDG"></div><div class="bp-deck-body"><div class="mr-pdf-locs">';
  pack.venues.forEach(function(p){
    var n=p.now||{}, y=p.py||{};
    var solo=!p.py;
    var bud=mrLiveBudget(p.venue, meta);
    var spend=mrSpendVar(n.live, bud);
    var roi=mrPp(p.beat.rate, p.pyBeat.rate, false);
    var live=mrPp(n.livePct, y.livePct, true);
    var tot=mrVar(n.live, y.live, true);
    var sales=mrVar(n.sales, y.sales);
    h+='<section class="mr-pdf-loc"><h3>'+_escHtml(p.label)+'</h3><div class="mr-cmp'+(solo?' mr-cmp-one':'')+'">';
    h+=mrCmpRow('', String(meta.year), solo?'':String(meta.year-1), 'Var', {row:'mr-c-hd', solo:solo});
    h+=mrCmpRow('Total Sales', mrMoneyCell(n.sales), solo?'':mrMoneyCell(y.sales), solo?'':sales.text, {tone:solo?'':sales.cls, solo:solo});
    h+=mrCmpRow('<i class="bp-arr"></i>Bottle Service Sales', mrMoneyCell(p.beat.bs), solo?'':mrMoneyCell(p.pyBeat.bs), '', {solo:solo});
    h+=mrCmpRow('ROI % Beat', mrPct(p.beat.rate), solo?'':mrPct(p.pyBeat.rate), solo?'':roi.text, {tone:solo?'':roi.cls, solo:solo});
    h+=mrCmpRow('Live E Spent Actual + Forecast', mrMoneyCell(n.live), solo?'':mrMoneyCell(y.live), solo?'':tot.text, {tone:solo?'':tot.cls, solo:solo});
    h+=mrCmpRow('Budget', mrMoneyCell(bud), '', spend.text, {row:'mr-budc', tone:spend.cls, solo:solo});
    h+=mrCmpRow('Live Ent. margins', mrPct(n.livePct), solo?'':mrPct(y.livePct), solo?'':live.text, {tone:solo?'':live.cls, solo:solo});
    h+='</div></section>';
  });
  h+='</div></div></div>';
  return h;
}
function mrLy(text){ return '<em>'+text+'</em>'; }
function mrDetailPage(p, meta){
  var n=p.now||{}, y=p.py||{};
  var pyY=meta.year-1;
  var bud=mrLiveBudget(p.venue, meta);
  var salesVar=mrVar(n.sales, y.sales);
  var bsVar=mrVar(p.beat.bs, p.pyBeat.bs);
  var spendVar=mrSpendVar(n.live, bud);
  var h='<div class="bp-page bp-deck"><div class="bp-deck-hd"><div><div class="bp-deck-kicker">'+_escHtml(p.label)+'</div><b>'+_escHtml(meta.label)+'</b><em>'+_escHtml(meta.range||'')+'</em></div><img src="assets/rdg-logo.png" alt="RDG"></div><div class="bp-deck-body">';
  h+='<div class="mr-pdf-metrics">';
  h+='<div><span>Sales vs PY</span><b>'+mrMoney(n.sales)+'</b>'+mrLy(pyY+' '+mrMoney(y.sales))+'<i class="'+salesVar.cls+'">'+salesVar.text+'</i></div>';
  h+='<div><span>BS vs '+pyY+'</span><b>'+mrMoney(p.beat.bs)+'</b>'+mrLy(pyY+' '+mrMoney(p.pyBeat.bs))+'<i class="'+bsVar.cls+'">'+bsVar.text+'</i></div>';
  h+='<div class="mr-bud"><span>Spend vs budget</span><b>'+mrMoney(n.live)+'</b><em>Budget '+mrMoney(bud)+'</em><i class="'+spendVar.cls+'">'+spendVar.text+'</i></div>';
  h+='<div><span>ROI beat</span><b>'+mrPct(p.beat.rate)+'</b>'+mrLy(pyY+' '+mrPct(p.pyBeat.rate))+'</div>';
  h+='<div><span>Live E margins</span><b>'+mrPct(n.livePct)+'</b>'+mrLy(pyY+' '+mrPct(y.livePct))+'</div>';
  h+='</div>';
  h+='<table class="mr-pdf-tbl"><thead><tr><th class="l">Date</th><th class="l">DJ</th><th>DJ fee</th><th>ROI actual</th><th>ROI target</th><th>Sales for the day</th><th>Margin</th></tr></thead><tbody>';
  if(!p.rows.length) h+='<tr><td class="l" colspan="7">No performances this month.</td></tr>';
  p.rows.forEach(function(row){
    var tone=mrRoiClass(row);
    h+='<tr'+(tone?' class="'+tone+'"':'')+'><td class="l"><b>'+_escHtml(mrDayLabel(row.d))+'</b></td><td class="l">'+_escHtml(row.dj)+'</td><td>'+mrMoney(row.fee)+'</td><td>'+(typeof rx==='function'?rx(row.roiA):'—')+'</td><td>'+(typeof rx==='function'?rx(row.roiT):'—')+'</td><td>'+mrMoney(row.sales)+'</td><td>'+mrPct(row.margin&&row.margin.margin)+'</td></tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}
/* November MTD on the meeting pack: the current month, through today, rolling after the 25th. */
function wmActualMonth(){
  var info=(typeof wmReportingAnchor==='function')?wmReportingAnchor():{year:(typeof curYr!=='undefined'?curYr:2026), monthIndex:(typeof curM!=='undefined'?curM:10)};
  var meta=mrPeriodMeta(info.year, info.monthIndex+1);
  var today=(typeof TODAY!=='undefined'&&TODAY)?String(TODAY).slice(0,10):(typeof miamiToday==='function'?miamiToday():meta.to);
  var through=today;
  if(meta.from&&through<meta.from) through=meta.from;
  if(meta.to&&through>meta.to) through=meta.to;
  meta.to=through;
  meta.mtd=true;
  meta.label=(meta.label||'')+' MTD';
  meta.range=wmShort(meta.from)+' – '+wmShort(through);
  return meta;
}
function wmShort(iso){
  var d=new Date(String(iso).slice(0,10)+'T12:00:00');
  if(isNaN(d.getTime())) return String(iso||'');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]+' '+d.getDate();
}
function wmPerformancesPage(pack){
  var meta=pack.meta;
  var h='<div class="bp-page bp-deck wm-shows"><div class="bp-deck-hd"><div><div class="bp-deck-kicker">Weekly Live Entertainment Meeting</div><b>Performances</b><em>'+_escHtml((meta.label||'')+(meta.range?' · '+meta.range:''))+'</em></div><img src="assets/rdg-logo.png" alt="RDG"></div><div class="bp-deck-body">';
  pack.venues.forEach(function(p){
    h+='<section class="wm-loc"><h3>'+_escHtml(p.label)+'</h3>';
    h+='<table class="mr-pdf-tbl wm-tbl"><thead><tr><th class="l">Date</th><th class="l">DJ</th><th>DJ fee</th><th>ROI actual</th><th>ROI target</th><th>BS actual vs target</th></tr></thead><tbody>';
    if(!p.rows.length) h+='<tr><td class="l" colspan="6">No performances this month.</td></tr>';
    p.rows.forEach(function(row){
      var tone=mrRoiClass(row);
      h+='<tr'+(tone?' class="'+tone+'"':'')+'><td class="l"><b>'+_escHtml(mrDayLabel(row.d))+'</b></td><td class="l">'+_escHtml(row.dj)+'</td><td>'+mrMoney(row.fee)+'</td><td>'+(typeof rx==='function'?rx(row.roiA):'—')+'</td><td>'+(typeof rx==='function'?rx(row.roiT):'—')+'</td><td class="wm-bs">'+wmBsVs(row.bs, row.bsT)+'</td></tr>';
    });
    h+='</tbody></table></section>';
  });
  h+='</div></div>';
  return h;
}
function mrBuildPdf(){
  var pack=mrPack(mrCurrent());
  var meta=pack.meta;
  var canvases=[];
  if(typeof _bpBusy==='function') _bpBusy(true, 'Cover page');
  return _ensurePdfLibs().then(function(){
    return document.fonts&&document.fonts.ready?document.fonts.ready:null;
  }).then(function(){
    return _bpRenderPage(_bpCoverHtml('Monthly Live Entertainment Recap', meta.label+(meta.range?' · '+meta.range:''), ''));
  }).then(function(cv){
    canvases.push(cv);
    if(typeof _bpBusy==='function') _bpBusy(true, 'All locations');
    return _bpRenderPage(mrComparePage(pack));
  }).then(function(cv){
    canvases.push(cv);
    var chain=Promise.resolve();
    pack.venues.forEach(function(p){
      chain=chain.then(function(){
        if(typeof _bpBusy==='function') _bpBusy(true, p.label);
        return _bpRenderPage(_bpCoverHtml('Monthly Live Entertainment Recap', meta.label, p.label));
      }).then(function(cv){
        canvases.push(cv);
        return _bpRenderPage(mrDetailPage(p, meta));
      }).then(function(cv){ canvases.push(cv); });
    });
    return chain;
  }).then(function(){
    var pdf=_bpPdfFit(canvases);
    if(typeof _bpBusy==='function') _bpBusy(false);
    return pdf;
  }, function(err){
    if(typeof _bpBusy==='function') _bpBusy(false);
    throw err;
  });
}
function mrExportPdf(){
  var meta=mrCurrent();
  mrBuildPdf().then(function(pdf){
    pdf.save('RDG-Monthly-Live-Entertainment-Recap-'+meta.key+'.pdf');
  }).catch(function(err){
    alert('Could not export the Monthly Recap. '+(err&&err.message?err.message:''));
  });
}
