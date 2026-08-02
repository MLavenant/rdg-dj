function renderVIP(venueIdx){
  if(venueIdx!==undefined) _vipActiveVenue = venueIdx;

  // Determine data source: VIP_VENUES (last week, rich tier data) vs SCHED (historical)
  var venues;
  var range = getVipWeekRange(_vipWeekOffset);
  var vipWkKey = (VIP_VENUES && VIP_VENUES[0]) ? (VIP_VENUES[0].weekKey || '') : '';
  var rangeWkKey = getISOWeek(new Date(range.mon + 'T12:00:00Z'));
  var rich = (VIP_VENUES||[]).filter(function(v){ return (v.weekKey||'')===rangeWkKey; });
  if (rich.length) {
    venues = rich.map(function(v){
      return {
        venue:v.venue, weekOf:v.weekOf, weekKey:v.weekKey,
        shows:(v.shows||[]).map(function(sh){
          var out={};
          for(var k in sh){ if(Object.prototype.hasOwnProperty.call(sh,k)) out[k]=sh[k]; }
          out.tiers={};
          Object.keys(sh.tiers||{}).forEach(function(t){
            out.tiers[t]={}; for(var tk in sh.tiers[t]){ if(Object.prototype.hasOwnProperty.call(sh.tiers[t],tk)) out.tiers[t][tk]=sh.tiers[t][tk]; }
          });
          var liveTbl=_vipResolveTables(v.venue, sh.date, sh.tablesActual);
          if(liveTbl!=null) out.tablesActual=liveTbl;
          return out;
        })
      };
    });
  } else {
    venues = buildVipFromSched(range.mon, range.sun);
  }

  if(!venues||!venues.length){
    document.getElementById('vipBody').innerHTML='<div class="empty" style="padding:40px;text-align:center;color:var(--ink3)">No VIP data for this week.</div>';
    return;
  }
  // VIP follows the global venue selector (curV) ? no separate tab bar
  var d = venues.find(function(v){ return v.venue===curV; }) || venues[0];
  if(!d){ document.getElementById('vipBody').innerHTML='<div class="empty" style="padding:40px;text-align:center;color:var(--ink3)">No VIP data for '+curV+' this week.</div>'; return; }

  // Update week nav UI
  var wkLbl = document.getElementById('vipWeekLabel');
  if(wkLbl) wkLbl.textContent = _fmtVipWeekLabel(_vipWeekOffset);
  var nextBtn = document.getElementById('vipNextBtn');
  if(nextBtn){ nextBtn.disabled = _vipWeekOffset===0; nextBtn.style.opacity = _vipWeekOffset===0?'0.3':'1'; }

  document.getElementById('vipMeta').textContent = (d.weekOf||_fmtVipWeekLabel(_vipWeekOffset)) + ' \u2014 ' + d.venue;

  var h = '';

  /* -- Insight sentence -- */
  var insight = _generateInsight(d);
  if(insight) h += '<div style="font-size:11px;color:var(--ink2);line-height:1.55;padding:12px 14px;background:var(--card);border-radius:12px;border-left:3px solid var(--ink3)">'+insight+'</div>';

  h += '<div class="vip-print-page1">';

  /* Budget MTD / YTD standing (sales, live entertainment, margins) */
  h += _vipStandingHtml(d.venue, range.sun);

  /* collect tiers actually used by this venue */
  var tierSet = {};
  d.shows.forEach(function(sh){ Object.keys(sh.tiers).forEach(function(t){ tierSet[t]=sh.tiers[t]; }); });
  var _excludedTiers = (d.venue==='MILA Lounge') ? ['Booths','Seating']
                     : (d.venue==='Casa Neos Lounge') ? ['Lounge']
                     : ['Cabana','Deck'];
  var weeklyTierActual=VIP_WEEK_TIER_ACTUALS[rangeWkKey+'|'+d.venue]||null;
  if(weeklyTierActual){
    Object.keys(weeklyTierActual.tiers).forEach(function(t){
      var base=tierSet[t]||{};
      weeklyTierActual.tiers[t].color=base.color||TIER_COLORS[t]||'#eee';
      weeklyTierActual.tiers[t].textColor=base.textColor||TIER_TEXT[t]||'#333';
      tierSet[t]=weeklyTierActual.tiers[t];
    });
  }
  var tiers = TIER_ORDER.filter(function(t){ return tierSet[t] && _excludedTiers.indexOf(t)<0; });

  /* ----------------------------------------------------
     TABLE 1 ? PERFORMANCE SUMMARY
     ---------------------------------------------------- */
  h += '<div class="vip-perf-block">';
  h += '<div class="vip-perf-hd"><span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3)">Performance Summary</span>'
     + '<span style="font-size:10px;color:var(--ink3)">'+d.venue+(d.weekOf?' \u2014 '+d.weekOf:'')+'</span></div>';
  h += '<div class="tbl-wrap" style="margin:0"><table class="vip-past-tbl"><thead><tr>'
     + '<th class="l" style="min-width:140px">Artist / Date</th>'
     + '<th>DJ Cost</th>'
     + '<th>BS Actual</th><th style="'+_TARGET_BG+'">BS Min</th><th>BS Variance</th>'
     + '<th>ROI Actual</th><th style="'+_TARGET_BG+'">ROI Target</th>'
     + '<th>Tables</th><th style="'+_TARGET_BG+'">Budget</th><th>Tbl Var</th>'
     + '<th>Avg / Tbl</th>'
     + '</tr></thead><tbody>';

  var totBS=0,totMin=0,totTbl=0,totBudget=0,totFee=0;
  d.shows.forEach(function(sh){
    var b=sh.bsActual>=sh.bsMin;
    var vbs=sh.bsActual-sh.bsMin, vtbl=(sh.tablesActual!=null&&sh.tablesBudget!=null)?sh.tablesActual-sh.tablesBudget:null;
    var avg=(sh.tablesActual||0)?Math.round(sh.bsActual/sh.tablesActual):0;
    var roiA=_fmtROI(sh.bsActual,sh.fee), roiT=_fmtROI(sh.bsMin,sh.fee);
    var roiANum=sh.fee>0?sh.bsActual/sh.fee:null;
    var roiTNum=sh.fee>0?sh.bsMin/sh.fee:null;
    var roiCls=roiTone(roiANum, roiTNum);
    var vipRoiCls=roiCls==='hit'?'beat':(roiCls==='near'?'near':(roiCls==='low'?'miss':''));
    totBS+=sh.bsActual; totMin+=sh.bsMin; totTbl+=(sh.tablesActual||0); totBudget+=(sh.tablesBudget||0); totFee+=sh.fee;
    h += '<tr>'
       + '<td class="l"><b>'+sh.dj+'</b><br><span style="font-size:9px;color:var(--ink3)">'+sh.label+'</span></td>'
       + '<td>'+$kv(sh.fee)+'</td>'
       + '<td><b class="'+(b?'beat':'miss')+'">'+$kv(sh.bsActual)+'</b></td>'
       + '<td style="'+_TARGET_BG+'">'+$kv(sh.bsMin)+'</td>'
       + '<td>'+_fmtVar(vbs)+'</td>'
       + '<td class="'+vipRoiCls+'" style="font-weight:700">'+roiA+'</td>'
       + '<td style="'+_TARGET_BG+'">'+roiT+'</td>'
       + '<td>'+(sh.tablesActual!=null?sh.tablesActual:'\u2014')+'</td>'
       + '<td style="'+_TARGET_BG+'">'+(sh.tablesBudget!=null?sh.tablesBudget:'\u2014')+'</td>'
       + '<td>'+(vtbl!=null?_fmtVarN(vtbl):'\u2014')+'</td>'
       + '<td>'+(avg?$kv(avg):'\u2014')+'</td>'
       + '</tr>';
  });
  /* Totals row */
  var totAvg=totTbl?Math.round(totBS/totTbl):0;
  var totVbs=totBS-totMin, totVtbl=totTbl-totBudget;
  var totROIA=_fmtROI(totBS,totFee), totROIT=_fmtROI(totMin,totFee);
  var totRoiCls=roiTone(totFee>0?totBS/totFee:null, totFee>0?totMin/totFee:null);
  var totVipRoi=totRoiCls==='hit'?'beat':(totRoiCls==='near'?'near':(totRoiCls==='low'?'miss':''));
  h += '<tr>'
     + '<td class="l">Total</td>'
     + '<td>'+$kv(totFee)+'</td>'
     + '<td><b class="'+(totVbs>=0?'beat':'miss')+'">'+$kv(totBS)+'</b></td>'
     + '<td style="'+_TARGET_BG+'">'+$kv(totMin)+'</td>'
     + '<td>'+_fmtVar(totVbs)+'</td>'
     + '<td class="'+totVipRoi+'" style="font-weight:700">'+totROIA+'</td>'
     + '<td style="'+_TARGET_BG+'">'+totROIT+'</td>'
     + '<td>'+(totTbl||'\u2014')+'</td>'
     + '<td style="'+_TARGET_BG+'">'+(totBudget||'\u2014')+'</td>'
     + '<td>'+(totBudget?_fmtVarN(totVtbl):'\u2014')+'</td>'
     + '<td>'+$kv(totAvg)+'</td>'
     + '</tr>';
  h += '</tbody></table></div></div>';
  h += '</div>';

  /* ----------------------------------------------------
     TABLE 2 ? TIER BREAKDOWN PER SHOW
     ---------------------------------------------------- */
  h += '<div class="vip-print-page2">';
  h += '<div class="vip-perf-block">';
  h += '<div class="vip-perf-hd"><span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3)">Tier Breakdown by Event</span>'
    +(weeklyTierActual?'<span style="font-size:9px;color:var(--ink3)">Exact weekly Toast totals allocated by event tables &amp; BS share</span>':'')+'</div>';
  h += '<div class="tbl-wrap" style="margin:0"><table class="vip-past-tbl"><thead>';

  /* Row 1: tier color headers spanning 4 cols each */
  h += '<tr><th class="l" rowspan="2" style="min-width:130px;vertical-align:bottom">Artist / Date</th>'
     + '<th rowspan="2" style="vertical-align:bottom">DJ Cost</th>'
     + '<th rowspan="2" style="vertical-align:bottom">Tables</th>'
     + '<th rowspan="2" style="vertical-align:bottom">Avg/Tbl</th>';
  tiers.forEach(function(tname){
    var t=tierSet[tname];
    h += '<th colspan="4" class="th-tier" style="background:'+t.color+';color:'+t.textColor+'">'+tname+'</th>';
  });
  h += '</tr><tr>';
  tiers.forEach(function(){
    h += '<th>Sold</th><th>Total</th><th>Avg</th><th style="'+_TARGET_BG+'">Min/Tbl</th>';
  });
  h += '</tr></thead><tbody>';

  var totTiers={};
  tiers.forEach(function(t){ totTiers[t]={sold:0,total:0,avgSum:0,cnt:0}; });
  var totTblSum=0, totBSSum=0, totFeeSum=0;

  var tierRows=weeklyTierActual?_vipAllocateWeeklyTiers(d.shows,weeklyTierActual):d.shows;
  tierRows.forEach(function(sh){
    var tblN=(sh.tablesActual!=null)?+sh.tablesActual:0;
    var rowSales=tiers.reduce(function(s,t){return s+((sh.tiers[t]&&sh.tiers[t].totalSales)||0);},0);
    var avg=tblN?Math.round((rowSales||sh.bsActual)/tblN):0;
    totTblSum+=tblN; totBSSum+=(rowSales||sh.bsActual); totFeeSum+=sh.fee;
    h += '<tr><td class="l"><b>'+sh.dj+'</b><br><span style="font-size:9px;color:var(--ink3)">'+sh.label.replace(/,.*$/,'')+'</span></td>'
       + '<td>'+$kv(sh.fee)+'</td>'
       + '<td>'+(sh.tablesActual!=null?sh.tablesActual:'\u2014')+' <span style="color:var(--ink3);font-size:9px">/ '+(sh.tablesBudget!=null?sh.tablesBudget:'\u2014')+'</span></td>'
       + '<td>'+$kv(avg)+'</td>';
    tiers.forEach(function(tname){
      var t=sh.tiers[tname];
      if(!t){ h+='<td>\u2014</td><td>\u2014</td><td>\u2014</td><td>\u2014</td>'; return; }
      if(sh._tierDataAvailable===false){ h+='<td>\u2014</td><td>\u2014</td><td>\u2014</td><td style="'+_TARGET_BG+'">'+$kv(t.minPerTable)+'</td>'; return; }
      var bT=t.soldTables>0&&t.avgPerTable>=t.minPerTable;
      totTiers[tname].sold+=t.soldTables; totTiers[tname].total+=t.totalSales;
      if(t.soldTables>0){totTiers[tname].avgSum+=t.avgPerTable;totTiers[tname].cnt++;}
      h += '<td>'+t.soldTables+'/'+t.totalTables+'</td>'
         + '<td><b class="'+(t.totalSales>0?bT?'beat':'miss':'')+'">'+$kv(t.totalSales)+'</b></td>'
         + '<td class="'+(t.soldTables>0?bT?'beat':'miss':'')+'">'+$kv(t.avgPerTable)+'</td>'
         + '<td style="'+_TARGET_BG+'">'+$kv(t.minPerTable)+'</td>';
    });
    h += '</tr>';
  });

  /* Totals row */
  h += '<tr><td class="l">Total</td><td>'+$kv(totFeeSum)+'</td>'
     + '<td>'+totTblSum+'</td>'
     + '<td>'+$kv(totTblSum?Math.round(totBSSum/totTblSum):0)+'</td>';
  tiers.forEach(function(tname){
    var t=totTiers[tname];
    var avgT=t.sold?Math.round(t.total/t.sold):0;
    h += '<td>'+t.sold+'</td><td><b>'+$kv(t.total)+'</b></td><td>'+$kv(avgT)+'</td><td></td>';
  });
  h += '</tr></tbody></table></div></div>';
  h += _generateWeekFlashNarrative(venues);
  h += '</div>';

  /* ----------------------------------------------------
     TABLE 3 ? PER-TABLE DETAIL (Beach Club only)
     ---------------------------------------------------- */
  var hasDetail = d.shows.some(function(sh){return sh.tableDetail&&sh.tableDetail.length;});
  if(hasDetail){
    h += '<div class="vip-perf-block">';
    h += '<div class="vip-perf-hd"><span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3)">Full Table Detail</span></div>';
    d.shows.forEach(function(sh){
      if(!sh.tableDetail||!sh.tableDetail.length) return;
      h += '<div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--ink2);border-top:0.5px solid var(--hair)">'+sh.dj+' ? '+sh.label.replace(/,.*$/,'')+'</div>';
      h += '<div class="tbl-wrap" style="margin:0"><table class="vip-tbl"><thead><tr>'
         + '<th>Table</th><th>Tier</th><th class="r">Sales</th><th class="r">Min/Tbl</th><th class="r">vs Min</th>'
         + '</tr></thead><tbody>';
      sh.tableDetail.slice().sort(function(a,b){
        /* "Other" (no-table) always last */
        if(a.tier==='Other'&&b.tier!=='Other') return 1;
        if(b.tier==='Other'&&a.tier!=='Other') return -1;
        return (b.sales||0)-(a.sales||0);
      }).forEach(function(row){
        var _excl = (d.venue==='MILA Lounge') ? ['Booths','Seating']
                  : (d.venue==='Casa Neos Lounge') ? ['Lounge']
                  : ['Cabana','Deck'];
        if(_excl.indexOf(row.tier)>=0) return;
        var isOther=row.tier==='Other';
        var minPT=(!isOther&&sh.tiers[row.tier])?sh.tiers[row.tier].minPerTable:0;
        var diff=(row.sales||0)-minPT, zero=!row.sales;
        h += '<tr'+(zero?' class="zero-row"':'')+(isOther?' style="opacity:.55"':'')+'>'+
             '<td><b>'+row.table+'</b></td>'+
             '<td><span class="tier-badge" style="background:'+(isOther?'#eee':TIER_COLORS[row.tier]||'#eee')+';color:'+(isOther?'#555':TIER_TEXT[row.tier]||'#333')+'">'+row.tier+'</span></td>'+
             '<td class="r">'+(zero?'?':$kv(row.sales))+'</td>'+
             '<td class="r" style="'+_TARGET_BG+'">'+(minPT?$kv(minPT):'?')+'</td>';
        if(zero||isOther) h+='<td class="r" style="color:var(--ink4)">?</td>';
        else h+='<td class="r '+(diff>=0?'beat':'miss')+'">'+(diff>=0?'+':'')+$kv(diff)+'</td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    });
    h += '</div>';
  }

  document.getElementById('vipBody').innerHTML = h;
}

/* ---------------------------------------------------------------
   NEW-WEEK POPUP ? fires once per week on first visit
   --------------------------------------------------------------- */
function getISOWeek(d){
  var dt=new Date(d); dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate()+4-(dt.getDay()||7));
  var y=dt.getFullYear();
  var s=new Date(y,0,1);
  return y+'-W'+Math.ceil(((dt-s)/86400000+1)/7);
}

function checkNewWeekPopup(){
  if(!VIP_VENUES||!VIP_VENUES.length) return;
  var nowWeek = getISOWeek(new Date());
  var seenKey = 'vip_seen_'+nowWeek;
  if(localStorage.getItem(seenKey)) return;
  localStorage.setItem(seenKey,'1');
  var dataWeek = (VIP_VENUES[0]||{}).weekKey||'';
  if(dataWeek===nowWeek) return;
  showVIPPopup();
}

function showVIPPopup(){
  if(curView==='3d') return;
  /* aggregate all shows across all venues */
  var allShows = [];
  VIP_VENUES.forEach(function(v){ v.shows.forEach(function(sh){ allShows.push({show:sh,venue:v.venue}); }); });
  if(!allShows.length) return;

  var totalBS    = allShows.reduce(function(s,r){return s+r.show.bsActual;},0);
  var beatCount  = allShows.filter(function(r){return r.show.bsActual>=r.show.bsMin;}).length;
  var beatPct    = Math.round(beatCount/allShows.length*100);
  var crushIt    = beatPct >= 50;

  var pop = document.createElement('div');
  pop.id = 'vipPopup';
  pop.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:200;overflow-y:auto;padding:20px 0';

  var venueBlocks = VIP_VENUES.map(function(v){
    var vTotal = v.shows.reduce(function(s,sh){return s+sh.bsActual;},0);
    var vBeat  = v.shows.filter(function(sh){return sh.bsActual>=sh.bsMin;}).length;
    var vOver  = vBeat>=Math.ceil(v.shows.length/2);
    var rows   = v.shows.map(function(sh){
      var b=sh.bsActual>=sh.bsMin;
      var pct = sh.bsMin>0 ? Math.min(100,Math.round(sh.bsActual/sh.bsMin*100)) : 100;
      return '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
        +'<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.85)">'+sh.label.split(',')[0]+' &mdash; '+sh.dj+'</div>'
        +'<div style="font-size:12px;font-weight:900;color:'+(b?'#22c55e':'#ef4444')+'">'+$kv(sh.bsActual)+'</div></div>'
        +'<div style="display:flex;align-items:center;gap:6px">'
        +'<div style="flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:'+(b?'#22c55e':'#ef4444')+';border-radius:2px"></div></div>'
        +'<div style="font-size:9px;color:rgba(255,255,255,.35);white-space:nowrap">min '+$kv(sh.bsMin)+'</div>'
        +'</div></div>';
    }).join('');
    var vColor = vOver ? '#22c55e' : '#ef4444';
    return '<div style="background:rgba(255,255,255,.05);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<span style="font-size:11px;font-weight:800;letter-spacing:-.2px;color:#fff">'+v.venue+'</span>'
      +'<span style="font-size:14px;font-weight:900;color:'+vColor+'">'+$kv(vTotal)+'</span></div>'
      +rows+'</div>';
  }).join('');

  var headTitle = crushIt ? '&#127881; Week Crushed It!' : '&#128200; Room to Grow';
  var headSub   = crushIt
    ? beatCount+' of '+allShows.length+' shows beat target &mdash; great week!'
    : 'Only '+beatCount+' of '+allShows.length+' shows beat target this week.';

  var accentColor = crushIt ? '#22c55e' : '#ef4444';
  var bgGrad      = crushIt ? 'linear-gradient(135deg,#0f2010 0%,#1a1a2e 100%)' : 'linear-gradient(135deg,#200f0f 0%,#1a1a2e 100%)';
  pop.innerHTML = (crushIt?'<canvas id="fwCanvas" style="position:fixed;inset:0;pointer-events:none;z-index:199"></canvas>':'')+
    '<div style="background:'+bgGrad+';border-radius:24px;padding:0;width:440px;max-width:95vw;position:relative;z-index:200;box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden">'
    +'<div style="height:4px;background:'+accentColor+';width:100%"></div>'
    +'<div style="padding:22px 24px 14px;border-bottom:1px solid rgba(255,255,255,.08)">'
    +'<div style="font-size:20px;font-weight:900;letter-spacing:-.5px;color:#fff;margin-bottom:4px">'+headTitle+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);margin-bottom:10px">'+headSub+'</div>'
    +'<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;background:rgba(255,255,255,.07);border-radius:999px;border:1px solid rgba(255,255,255,.1)">'
    +'<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)">All Venues BS</span>'
    +'<span style="font-size:15px;font-weight:900;color:'+accentColor+'">'+$kv(totalBS)+'</span>'
    +'</div>'
    +'</div>'
    +'<div style="padding:16px 24px;display:flex;flex-direction:column;gap:0">'+venueBlocks+'</div>'
    +'<div style="padding:0 24px 20px;display:flex;gap:8px">'
    +'<button onclick="document.getElementById(\'vipPopup\').remove()" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:rgba(255,255,255,.7)">Dismiss</button>'
    +'<button onclick="setView(\'vip\');document.getElementById(\'vipPopup\').remove()" style="flex:2;padding:10px;border-radius:12px;border:none;background:'+accentColor+';color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:.02em">Full Weekly Flash &#8594;</button>'
    +'</div>'
    +'</div>';

  document.body.appendChild(pop);
  if(crushIt) launchFireworks();
}

function launchFireworks(){
  var cv=document.getElementById('fwCanvas'); if(!cv)return;
  cv.width=window.innerWidth; cv.height=window.innerHeight;
  var ctx=cv.getContext('2d');
  var particles=[];
  var colors=['#FFD700','#FF4444','#4CAF50','#2196F3','#FF69B4','#FF8C00','#00CED1'];
  for(var i=0;i<160;i++){
    var a=Math.random()*Math.PI*2;
    var sp=2+Math.random()*6;
    particles.push({x:cv.width/2+(Math.random()-0.5)*200,y:cv.height/2+(Math.random()-0.5)*100,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,alpha:1,size:3+Math.random()*4,color:colors[Math.floor(Math.random()*colors.length)]});
  }
  function frame(){
    ctx.clearRect(0,0,cv.width,cv.height);
    var alive=false;
    particles.forEach(function(p){
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.alpha-=0.013;
      if(p.alpha>0){alive=true;ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
    });
    ctx.globalAlpha=1;
    if(alive) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

