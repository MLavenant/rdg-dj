/* Three Month Plan bottle-service sales. Reads data/dj-sales-prevision.js
   and the live calendar. Never writes shows or overrides.
   Sales for a month = sum of (calendar DJ fee x historical tier ROI). */

function spVenue(venue){
  var s=window.DJ_SALES_PREVISION;
  return s&&s.venues?s.venues[venue]||null:null;
}
function spNum(v){ return v!=null&&v!==''&&isFinite(+v)?+v:null; }
function spFee(r){
  var raw=r&&r.fee!=null&&r.fee!==''?r.fee:(r&&r.cost!=null&&r.cost!==''?r.cost:null);
  return spNum(raw);
}
function spTierBounds(label){
  var nums=String(label||'').replace(/[$,\s]/g,'').split(/-|\+/).filter(Boolean).map(Number);
  if(/\+$/.test(String(label).trim())) return {lo:nums[0], hi:Infinity};
  return {lo:nums[0], hi:nums[1]};
}
function spTierIndex(tiers, fee){
  var order=tiers.order||[];
  for(var i=0;i<order.length;i++){
    var b=spTierBounds(order[i]);
    if(fee>=b.lo && fee<b.hi) return i;
  }
  return order.length?order.length-1:-1;
}
function spDayRoi(cell, wd){
  if(!cell) return null;
  if(wd===6 && cell.satN>0 && cell.sat!=null) return cell.sat;
  if(wd===0 && cell.sunN>0 && cell.sun!=null) return cell.sun;
  return null;
}
function spBlendRoi(cell){
  if(!cell) return null;
  var n=0, sum=0;
  if(cell.satN>0 && cell.sat!=null){ sum+=cell.sat*cell.satN; n+=cell.satN; }
  if(cell.sunN>0 && cell.sun!=null){ sum+=cell.sun*cell.sunN; n+=cell.sunN; }
  return n?sum/n:null;
}
/* The month is the calendar's fiscal month, the same one the calendar grid uses. */
function spRateMonth(date){
  if(typeof fiscalInfoForDate==='function'){
    var info=fiscalInfoForDate(date);
    if(info&&info.monthIndex!=null) return String(info.monthIndex+1);
  }
  return String(_parseYmd(date).getMonth()+1);
}
/* Month + tier + weekday, then that weekday for the tier. No invented neighbor tier. */
function spRoi(venue, fee, date){
  var v=spVenue(venue);
  var tiers=v&&v.tiers;
  if(!tiers||!(fee>0)) return null;
  var idx=spTierIndex(tiers, fee);
  if(idx<0) return null;
  var d=_parseYmd(date), wd=d.getDay(), month=spRateMonth(date);
  var label=tiers.order[idx];
  var roi=spDayRoi((tiers.monthly[label]||{})[month], wd);
  if(roi!=null) return {roi:roi, rule:'tier, month and day', tier:label};
  roi=spDayRoi(tiers.overall[label], wd);
  if(roi!=null) return {roi:roi, rule:'tier and day', tier:label};
  return null;
}
/* Historical run rate when the tier and day match. Otherwise the ROI target from the app. */
function spShowRoi(r){
  var fee=spFee(r);
  if(!(fee>0)||!r) return null;
  var venue=r.v||r.venue;
  var hist=spRoi(venue, fee, r.d);
  if(hist) return hist.roi;
  var tgt=(typeof showTargets==='function')?showTargets(r):null;
  if(tgt&&tgt.roi_t!=null&&isFinite(+tgt.roi_t)&&+tgt.roi_t>0) return +tgt.roi_t;
  if(typeof venueRoiLookup==='function'){
    var look=venueRoiLookup(venue, r.d, fee);
    if(look&&look.roiTarget!=null&&+look.roiTarget>0) return +look.roiTarget;
  }
  return null;
}
function spBudgetDay(venue, date){
  var v=spVenue(venue);
  if(!v||!v.weeks) return null;
  var fy=fiscalYearForDate(date);
  var start=_parseYmd(fiscalYearStart(fy)), d=_parseYmd(date);
  var week=Math.floor(Math.round((d-start)/86400000)/7)+1;
  var wk=v.weeks[String(week)];
  if(!wk) return null;
  var wd=(d.getDay()+6)%7;
  return {week:week, brunch:wk.brunch[wd]||0, dinner:wk.dinner[wd]||0, bs:wk.bs[wd]||0};
}
function spShowsOn(venue, date){
  return (typeof SCHED!=='undefined'&&SCHED?SCHED:[]).filter(function(r){
    if(!r||r._s==='empty'||r.d!==date) return false;
    if((r.v||r.venue)!==venue) return false;
    var fee=spFee(r);
    return (r.dj&&String(r.dj).trim())||(fee!=null&&fee>0);
  });
}
/* One performance day. Shows without a fee keep the budget bottle service for that day. */
function spSimDay(venue, date, shows){
  var bud=spBudgetDay(venue, date);
  if(!bud) return null;
  shows=shows||spShowsOn(venue, date);
  if(!shows.length) return null;
  var fee=0, bs=0, usedBudget=false, rules=[];
  shows.forEach(function(r){
    var f=spFee(r)||0;
    fee+=f;
    var roi=f>0?spRoi(venue, f, date):null;
    if(roi){ bs+=f*roi.roi; rules.push(roi.rule); }
    else usedBudget=true;
  });
  if(usedBudget) bs+=bud.bs;
  var sales=bud.brunch+bud.dinner+bs;
  var m=(typeof mrDayMargin==='function')?mrDayMargin(venue, sales, fee):null;
  return {date:date, sales:sales, brunch:bud.brunch, dinner:bud.dinner, bs:bs, fee:fee,
    ebitda:m?m.ebitda:null, rules:rules, usedBudget:usedBudget};
}
/* Bottle service only. Cost is every calendar fee in the range.
   Sales is fee times the historical run rate, or the app ROI target when that day has no history. */
function spBsRange(venue, from, to){
  if(!from||!to) return null;
  var sales=0, fee=0, rated=0, any=0;
  (typeof SCHED!=='undefined'&&SCHED?SCHED:[]).forEach(function(r){
    if(!r||r._s==='empty'||!r.d||r.d<from||r.d>to) return;
    if((r.v||r.venue)!==venue) return;
    var f=spFee(r);
    var named=r.dj&&String(r.dj).trim();
    if(!named&&!(f>0)) return;
    any++;
    f=f||0;
    fee+=f;
    var roi=f>0?spShowRoi(r):null;
    if(roi){ sales+=f*roi; rated++; }
  });
  if(!any) return {sales:null, fee:null};
  return {sales:rated?sales:null, fee:fee};
}
function spSimRange(venue, from, to){
  if(!spVenue(venue)) return null;
  var byDate={};
  (typeof SCHED!=='undefined'&&SCHED?SCHED:[]).forEach(function(r){
    if(!r||r._s==='empty'||!r.d||r.d<from||r.d>to) return;
    if((r.v||r.venue)!==venue) return;
    var fee=spFee(r);
    if(!((r.dj&&String(r.dj).trim())||(fee!=null&&fee>0))) return;
    (byDate[r.d]=byDate[r.d]||[]).push(r);
  });
  var out={sales:0, fee:0, ebitda:0, hasEbitda:true, days:[]};
  Object.keys(byDate).sort().forEach(function(d){
    var day=spSimDay(venue, d, byDate[d]);
    if(!day) return;
    out.days.push(day);
    out.sales+=day.sales;
    out.fee+=day.fee;
    if(day.ebitda==null) out.hasEbitda=false; else out.ebitda+=day.ebitda;
  });
  if(!out.days.length) return {sales:null, fee:null, ebitda:null, days:[]};
  if(!out.hasEbitda) out.ebitda=null;
  return out;
}
