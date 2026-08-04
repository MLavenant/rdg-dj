function renderVIP(venueIdx){
  if(venueIdx!==undefined) _vipActiveVenue = venueIdx;

  var pack = _vipCollectFlashVenues(_vipWeekOffset);
  var venues = pack.venues;
  var range = pack.range;
  var rangeWkKey = pack.rangeWkKey;

  var wkLbl = document.getElementById('vipWeekLabel');
  if(wkLbl) wkLbl.textContent = _fmtVipWeekLabel(_vipWeekOffset);
  var nextBtn = document.getElementById('vipNextBtn');
  if(nextBtn){ nextBtn.disabled = _vipWeekOffset===0; nextBtn.style.opacity = _vipWeekOffset===0?'0.3':'1'; }

  var weekOf = (venues[0]&&venues[0].weekOf) || _fmtVipWeekLabel(_vipWeekOffset);
  document.getElementById('vipMeta').textContent = weekOf + ' \u2014 All locations';

  var h = '';

  /* Stacked full-width sections: Budget → Performance → Tiers → Appendix (1 page / location) */
  h += '<div class="vip-print-page vip-print-page1 vip-stack-sec">';
  h += _vipSectionTitle('BUDGET', 'Standing · All locations');
  h += _vipAllBudgetStandingTable(venues.map(function(v){return v.venue;}), range.sun);
  h += '</div>';

  h += '<div class="vip-print-page vip-print-page2 vip-stack-sec">';
  h += _vipSectionTitle('PERFORMANCE SUMMARY', 'This week · All locations');
  venues.forEach(function(d){
    h += '<div class="vip-email-snap">';
    h += _vipRenderPerfSummary(d);
    var para=_generateVenueFlashParagraph(d);
    if(para) h += '<div class="vip-venue-narrative"><span class="vip-venue-narrative-bullet">\u2022</span> '+para+'</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '<div class="vip-print-page vip-print-page3 vip-stack-sec">';
  h += _vipSectionTitle('TIER BREAKDOWN', 'This week · All locations');
  venues.forEach(function(d){
    h += _vipRenderTierBreakdown(d, rangeWkKey);
  });
  h += '</div>';

  venues.forEach(function(d, i){
    h += '<div class="vip-print-page vip-print-app vip-stack-sec" data-app-venue="'+i+'">';
    h += _vipSectionTitle('APPENDIX', d.venue);
    h += _vipRenderAppendixVenue(d.venue, range.sun);
    h += '</div>';
  });

  /* Full table detail — Beach Club only when present */
  var beach = venues.find(function(v){ return v.venue==='Casa Neos Beach Club'; });
  if(beach){
    var hasDetail = (beach.shows||[]).some(function(sh){return sh.tableDetail&&sh.tableDetail.length;});
    if(hasDetail){
      h += '<div class="vip-perf-block">';
      h += '<div class="vip-perf-hd"><span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3)">Full Table Detail — Casa Neos Beach Club</span></div>';
      beach.shows.forEach(function(sh){
        if(!sh.tableDetail||!sh.tableDetail.length) return;
        h += '<div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--ink2);border-top:0.5px solid var(--hair)">'+sh.dj+' \u2014 '+sh.label.replace(/,.*$/,'')+'</div>';
        h += '<div class="tbl-wrap" style="margin:0"><table class="vip-tbl"><thead><tr>'
           + '<th>Table</th><th>Tier</th><th class="r">Sales</th><th class="r">Min/Tbl</th><th class="r">vs Min</th>'
           + '</tr></thead><tbody>';
        sh.tableDetail.slice().sort(function(a,b){
          if(a.tier==='Other'&&b.tier!=='Other') return 1;
          if(b.tier==='Other'&&a.tier!=='Other') return -1;
          return (b.sales||0)-(a.sales||0);
        }).forEach(function(row){
          var _excl = _vipExcludedTiers(beach.venue);
          if(_excl.indexOf(row.tier)>=0) return;
          var isOther=row.tier==='Other';
          var minPT=(!isOther&&sh.tiers[row.tier])?sh.tiers[row.tier].minPerTable:0;
          var diff=(row.sales||0)-minPT, zero=!row.sales;
          h += '<tr'+(zero?' class="zero-row"':'')+(isOther?' style="opacity:.55"':'')+'>'+
               '<td><b>'+row.table+'</b></td>'+
               '<td><span class="tier-badge" style="background:'+(isOther?'#eee':TIER_COLORS[row.tier]||'#eee')+';color:'+(isOther?'#555':TIER_TEXT[row.tier]||'#333')+'">'+row.tier+'</span></td>'+
               '<td class="r">'+(zero?'\u2014':$kv(row.sales))+'</td>'+
               '<td class="r" style="'+_TARGET_BG+'">'+(minPT?$kv(minPT):'\u2014')+'</td>';
          if(zero||isOther) h+='<td class="r" style="color:var(--ink4)">\u2014</td>';
          else h+='<td class="r '+(diff>=0?'beat':'miss')+'">'+(diff>=0?'+':'')+$kv(diff)+'</td>';
          h += '</tr>';
        });
        h += '</tbody></table></div>';
      });
      h += '</div>';
    }
  }

  document.getElementById('vipBody').innerHTML = h;
}

function _vipExcludedTiers(venue){
  /* Seating-only inventory — not bottle-service tiers for flash fills. */
  return (venue==='MILA Lounge') ? ['Booths','Seating']
       : (venue==='Casa Neos Lounge') ? []
       : ['Cabana','Deck'];
}

function _vipSectionTitle(main, sub){
  return '<div class="vip-stack-title">'
    +'<div class="vip-stack-title-main">'+main+'</div>'
    +(sub?'<div class="vip-stack-title-sub">'+sub+'</div>':'')
    +'</div>';
}

function _vipRoiWeekStats(venues){
  var beats=0, total=0;
  (venues||[]).forEach(function(v){
    (v.shows||[]).forEach(function(sh){
      if(!sh) return;
      var fee=+sh.fee||0;
      var bsA=sh.bsActual!=null?+sh.bsActual:null;
      var bsMin=sh.bsMin!=null?+sh.bsMin:null;
      if((!(bsMin>0)) && typeof showTargets==='function'){
        var tgt=showTargets({v:v.venue, venue:v.venue, d:sh.date, fee:fee, cost:fee});
        if(tgt && tgt.bs_m!=null) bsMin=+tgt.bs_m;
      }
      if(!(bsMin>0) || bsA==null) return;
      total++;
      if(bsA>=bsMin) beats++;
    });
  });
  return {beats:beats, total:total};
}

function _vipCollectFlashVenues(weekOffset){
  var range = getVipWeekRange(weekOffset==null?_vipWeekOffset:weekOffset);
  var rangeWkKey = getISOWeek(new Date(range.mon + 'T12:00:00Z'));
  var rich = (VIP_VENUES||[]).filter(function(v){ return (v.weekKey||'')===rangeWkKey; });
  var venues;
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
          out._tierDataAvailable=true;
          return out;
        })
      };
    });
  } else {
    venues = buildVipFromSched(range.mon, range.sun);
  }
  var order = ['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge'];
  var byName={};
  (venues||[]).forEach(function(v){ byName[v.venue]=v; });
  venues = order.map(function(vn){
    return byName[vn] || {venue:vn, weekOf:_fmtVipWeekLabel(weekOffset==null?_vipWeekOffset:weekOffset), weekKey:rangeWkKey, shows:[]};
  });
  return {venues:venues, range:range, rangeWkKey:rangeWkKey};
}

function _vipRenderAppendixVenue(venue, asOfDate){
  var info=fiscalInfoForDate(asOfDate);
  var yr=info.year;
  var period=fiscalPeriodRange(yr, info.monthIndex);
  var cutDate=(dateInFiscalPeriod(String(TODAY||''), yr, info.monthIndex)) ? String(TODAY) : (asOfDate>period.to?period.to:asOfDate);
  var byMonth={};
  (typeof SCHED!=='undefined'?SCHED:[]).forEach(function(r){
    if(!r||r._s==='empty') return;
    if((r.v||r.venue)!==venue) return;
    if(!r.d) return;
    var fi=fiscalInfoForDate(r.d);
    if(!fi || fi.year!==yr) return;
    if(fi.monthIndex>info.monthIndex) return;
    if(!byMonth[fi.monthIndex]) byMonth[fi.monthIndex]=[];
    byMonth[fi.monthIndex].push(r);
  });
  var months=Object.keys(byMonth).map(Number).sort(function(a,b){return a-b;});
  if(!months.length){
    return '<div class="vip-perf-block vip-venue-block">'
      +_vipVenueBlockHd('YTD performances', venue, yr+' · through '+cutDate)
      +'<div style="padding:14px;font-size:11px;color:var(--ink3)">No performances booked this fiscal year.</div></div>';
  }
  var h='';
  months.forEach(function(mi){
    var rows=byMonth[mi].slice().sort(function(a,b){ return String(a.d).localeCompare(String(b.d)); });
    var monthLbl=(typeof MN_SH!=='undefined'?MN_SH[mi]:('M'+(mi+1)))+' '+yr;
    h+='<div class="vip-perf-block vip-venue-block">';
    h+=_vipVenueBlockHd(monthLbl, venue, rows.length+' performance'+(rows.length===1?'':'s'));
    h+='<div class="tbl-wrap" style="margin:0"><table class="vip-past-tbl"><thead><tr>'
      +'<th class="l" style="min-width:120px">Artist / Date</th>'
      +'<th>DJ Fees</th>'
      +'<th>BS Actual</th><th style="'+_TARGET_BG+'">BS Target</th><th>BS Var</th>'
      +'<th>ROI Actual</th><th style="'+_TARGET_BG+'">ROI Target</th>'
      +'</tr></thead><tbody>';
    var totFee=0, totBsA=0, totBsT=0, nBsA=0, nBsT=0;
    rows.forEach(function(r){
      var fee=+(r.fee||r.cost||0)||0;
      var tgt=(typeof showTargets==='function')?showTargets(r):{bs_m:r.bs_m,roi_t:r.roi_t};
      var bsT=tgt&&tgt.bs_m!=null?+tgt.bs_m:null;
      var bsA=r.bs_a!=null?+r.bs_a:null;
      var isPast=r.d<=cutDate;
      var roiT=tgt&&tgt.roi_t!=null?+tgt.roi_t:(fee&&bsT!=null?bsT/fee:null);
      var roiA=r.roi_a!=null?+r.roi_a:(fee&&bsA!=null?bsA/fee:null);
      var vbs=(bsA!=null&&bsT!=null)?(bsA-bsT):null;
      var tone=(typeof perfTone==='function')?perfTone(bsA, bsT, fee, roiA, roiT):'';
      var fill=_vipRoiToneCls(tone);
      if(!fill && vbs!=null) fill=_vipFillTone(vbs);
      totFee+=fee;
      if(bsA!=null){ totBsA+=bsA; nBsA++; }
      if(bsT!=null){ totBsT+=bsT; nBsT++; }
      var dateLbl='';
      try{
        var dObj=new Date(r.d+'T12:00:00');
        dateLbl=dObj.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      }catch(eD){ dateLbl=r.d; }
      var dj=r.dj||r.artist||'TBD';
      var statusNote=!isPast?' <span style="font-size:8px;color:var(--ink3);font-weight:600">upcoming</span>':'';
      h+='<tr>'
        +'<td class="l"><b>'+dj+'</b><br><span style="font-size:9px;color:var(--ink3)">'+dateLbl+statusNote+'</span></td>'
        +'<td class="vip-cost">'+(fee?$kv(fee):'\u2014')+'</td>'
        +_vipTdFill(bsA!=null?$kv(bsA):'\u2014', bsA!=null?fill:'')
        +'<td style="'+_TARGET_BG+'">'+(bsT!=null?$kv(bsT):'\u2014')+'</td>'
        +_vipTdFill(vbs!=null?_vipVarPlain(vbs):'\u2014', vbs!=null?_vipFillTone(vbs):'')
        +_vipTdFill(roiA!=null?(roiA.toFixed(1)+'x'):'\u2014', roiA!=null?fill:'')
        +'<td style="'+_TARGET_BG+'">'+(roiT!=null?(Number(roiT).toFixed(1)+'x'):'\u2014')+'</td>'
        +'</tr>';
    });
    var totRoiA=(totFee&&nBsA)?(totBsA/totFee):null;
    var totRoiT=(totFee&&nBsT)?(totBsT/totFee):null;
    var totVbs=(nBsA&&nBsT)?(totBsA-totBsT):null;
    var totTone=(typeof roiTone==='function' && totRoiA!=null && totRoiT!=null)?roiTone(totRoiA, totRoiT):'';
    var totFill=_vipRoiToneCls(totTone);
    h+='<tr>'
      +'<td class="l">Month total</td>'
      +'<td class="vip-cost">'+$kv(totFee)+'</td>'
      +_vipTdFill(nBsA?$kv(totBsA):'\u2014', totFill||(totVbs!=null?_vipFillTone(totVbs):''))
      +'<td style="'+_TARGET_BG+'">'+(nBsT?$kv(totBsT):'\u2014')+'</td>'
      +_vipTdFill(totVbs!=null?_vipVarPlain(totVbs):'\u2014', totVbs!=null?_vipFillTone(totVbs):'')
      +_vipTdFill(totRoiA!=null?(totRoiA.toFixed(1)+'x'):'\u2014', totFill)
      +'<td style="'+_TARGET_BG+'">'+(totRoiT!=null?(totRoiT.toFixed(1)+'x'):'\u2014')+'</td>'
      +'</tr>';
    h+='</tbody></table></div></div>';
  });
  return h;
}

function _vipResolveWeeklyTier(venue, weekKey){
  var key=weekKey+'|'+venue;
  return (window._vipTierActuals && window._vipTierActuals[key])
      || VIP_WEEK_TIER_ACTUALS[key]
      || null;
}

function _vipCollectTiers(d, weeklyTierActual){
  var tierSet = {};
  (d.shows||[]).forEach(function(sh){ Object.keys(sh.tiers||{}).forEach(function(t){ tierSet[t]=sh.tiers[t]; }); });
  if(weeklyTierActual && weeklyTierActual.tiers){
    Object.keys(weeklyTierActual.tiers).forEach(function(t){
      var base=tierSet[t]||{};
      weeklyTierActual.tiers[t].color=base.color||TIER_COLORS[t]||'#eee';
      weeklyTierActual.tiers[t].textColor=base.textColor||TIER_TEXT[t]||'#333';
      tierSet[t]=weeklyTierActual.tiers[t];
    });
  }
  var excl=_vipExcludedTiers(d.venue);
  return TIER_ORDER.filter(function(t){ return tierSet[t] && excl.indexOf(t)<0; });
}

function _vipAllBudgetStandingTable(venueList, asOfDate){
  var info=fiscalInfoForDate(asOfDate);
  var yr=info.year;
  var mi=info.monthIndex+1;
  var period=fiscalPeriodRange(yr, info.monthIndex);
  var cutDate=(dateInFiscalPeriod(String(TODAY||''), yr, info.monthIndex)) ? String(TODAY) : (asOfDate>period.to?period.to:asOfDate);
  var venueStats=[];
  var h='<div class="vip-perf-block vip-bgt-table-wrap">';
  h+='<div class="vip-perf-hd"><span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3)">Budget Standing — All Locations</span>'
    +'<span style="font-size:10px;color:var(--ink3)">'+MN_SH[mi-1]+' '+yr+' + YTD · through '+cutDate+'</span></div>';
  h+='<div class="tbl-wrap" style="margin:0"><table class="vip-past-tbl"><thead><tr>'
    +'<th class="l">Location</th>'
    +'<th>Fees MTD</th><th style="'+_TARGET_BG+'">Fee Bgt</th><th>Fee Var</th>'
    +'<th>BS MTD</th><th style="'+_TARGET_BG+'">BS Tgt</th><th>BS Var</th>'
    +'<th>Fees YTD</th><th style="'+_TARGET_BG+'">Fee Bgt YTD</th><th>Fee Var YTD</th>'
    +'<th>BS YTD</th><th style="'+_TARGET_BG+'">BS Tgt YTD</th><th>BS Var YTD</th>'
    +'</tr></thead><tbody>';
  venueList.forEach(function(venue){
    var monthSt=_vipMonthStandingStats(venue, yr, info.monthIndex, cutDate);
    var yFeeDone=0,yFeeRemain=0,yFeeProj=0,yFeeBgt=0,yHasBgt=false;
    var yBsDone=0,yBsRemain=0,yBsProj=0,yBsTgt=0;
    var yRoiBeats=0,yRoiMeasured=0,yRoiPast=0;
    for(var m=0;m<=info.monthIndex;m++){
      var pEnd=fiscalPeriodRange(yr, m).to;
      var mCut=(m<info.monthIndex)?pEnd:(cutDate<pEnd?cutDate:pEnd);
      var st=_vipMonthStandingStats(venue, yr, m, mCut);
      yFeeDone+=st.feeDone; yFeeRemain+=st.feeRemain; yFeeProj+=st.feeProj;
      yBsDone+=st.bsDone; yBsRemain+=st.bsRemain; yBsProj+=st.bsProj; yBsTgt+=st.bsTargetMonth;
      if(st.monthBgt!=null){ yFeeBgt+=st.monthBgt; yHasBgt=true; }
      var roiM=_vipRoiCompletionStats(venue, yr, m, mCut);
      yRoiBeats+=roiM.beats; yRoiMeasured+=roiM.measured; yRoiPast+=roiM.pastShows;
    }
    var yFeeVar=yHasBgt?(yFeeBgt-yFeeProj):null;
    var yBsVar=yBsTgt>0?(yBsProj-yBsTgt):null;
    var monthRoi=_vipRoiCompletionStats(venue, yr, info.monthIndex, cutDate);
    venueStats.push({
      venue:venue,
      monthSt:monthSt,
      yFeeProj:yFeeProj, yFeeBgt:yHasBgt?yFeeBgt:null, yFeeVar:yFeeVar,
      yBsProj:yBsProj, yBsTgt:yBsTgt, yBsVar:yBsVar,
      monthRoi:monthRoi,
      yRoi:{beats:yRoiBeats, measured:yRoiMeasured, pastShows:yRoiPast, pct:yRoiMeasured?Math.round(yRoiBeats/yRoiMeasured*100):null}
    });
    h+='<tr>'
      +'<td class="l"><b>'+venue+'</b></td>'
      +'<td class="vip-cost">'+$k(monthSt.feeProj)+'</td>'
      +'<td style="'+_TARGET_BG+'">'+(monthSt.monthBgt!=null?$k(monthSt.monthBgt):'\u2014')+'</td>'
      +_vipTdFill(_vipVarPlain(monthSt.feeVar), _vipFillTone(monthSt.feeVar))
      +'<td>'+$k(monthSt.bsProj)+'</td>'
      +'<td style="'+_TARGET_BG+'">'+$k(monthSt.bsTargetMonth)+'</td>'
      +_vipTdFill(_vipVarPlain(monthSt.bsVar), _vipFillTone(monthSt.bsVar))
      +'<td class="vip-cost">'+$k(yFeeProj)+'</td>'
      +'<td style="'+_TARGET_BG+'">'+(yHasBgt?$k(yFeeBgt):'\u2014')+'</td>'
      +_vipTdFill(_vipVarPlain(yFeeVar), _vipFillTone(yFeeVar))
      +'<td>'+$k(yBsProj)+'</td>'
      +'<td style="'+_TARGET_BG+'">'+$k(yBsTgt)+'</td>'
      +_vipTdFill(_vipVarPlain(yBsVar), _vipFillTone(yBsVar))
      +'</tr>';
  });
  h+='</tbody></table></div></div>';
  h+=_vipStandingRecap(venueStats, MN_SH[mi-1]+' '+yr, yr);
  return h;
}

function _vipStandingRecap(venueStats, monthLbl, yr){
  function metricRow(lbl, actual, budget, varVal, isFee){
    var tone=_vipFillTone(varVal);
    var pct=(budget!=null && budget>0 && actual!=null)?Math.round(actual/budget*100):null;
    return '<div class="vip-recap-metric'+(tone?(' vip-fill-'+tone):'')+'">'
      +'<div class="vip-recap-ml">'+lbl+'</div>'
      +'<div class="vip-recap-mv">'+(actual!=null?$k(actual):'\u2014')
      +' <span class="vip-recap-vs">vs</span> '
      +(budget!=null?$k(budget):'\u2014')+'</div>'
      +'<div class="vip-recap-ms">'+(varVal!=null?_vipVarPlain(varVal):'\u2014')
      +(pct!=null?' · '+pct+'% of '+(isFee?'budget':'target'):'')
      +(isFee?(varVal!=null?(varVal>=0?' · under':' · over'):''):'')
      +'</div></div>';
  }
  function roiRow(roi){
    var tone=roi.measured?(roi.pct>=50?'beat':(roi.pct>=35?'near':'miss')):'';
    return '<div class="vip-recap-metric'+(tone?(' vip-fill-'+tone):'')+'">'
      +'<div class="vip-recap-ml">ROI completed (past)</div>'
      +'<div class="vip-recap-mv">'+(roi.measured? (roi.beats+' / '+roi.measured) : '\u2014')+'</div>'
      +'<div class="vip-recap-ms">'+(roi.pct!=null?(roi.pct+'% beat / near target'):'No past shows with BS')
      +(roi.pastShows && roi.pastShows!==roi.measured?' · '+roi.pastShows+' past booked':'')
      +'</div></div>';
  }
  var h='<div class="vip-stand-recap">';
  h+='<div class="vip-stand-recap-hd">Location Recap — MTD &amp; YTD</div>';
  h+='<div class="vip-stand-recap-grid">';
  venueStats.forEach(function(vs){
    var ms=vs.monthSt;
    h+='<div class="vip-stand-recap-card">';
    h+='<div class="vip-stand-recap-venue">'+vs.venue+'</div>';
    h+='<div class="vip-stand-recap-period">'+monthLbl+' · MTD</div>';
    h+=metricRow('DJ Fees A+F vs Budget', ms.feeProj, ms.monthBgt, ms.feeVar, true);
    h+=metricRow('BS A+F vs Target', ms.bsProj, ms.bsTargetMonth, ms.bsVar, false);
    h+=roiRow(vs.monthRoi);
    h+='<div class="vip-stand-recap-period">YTD '+yr+'</div>';
    h+=metricRow('DJ Fees A+F vs Budget', vs.yFeeProj, vs.yFeeBgt, vs.yFeeVar, true);
    h+=metricRow('BS A+F vs Target', vs.yBsProj, vs.yBsTgt, vs.yBsVar, false);
    h+=roiRow(vs.yRoi);
    h+='</div>';
  });
  h+='</div></div>';
  return h;
}

function _vipRenderPerfSummary(d){
  var h='<div class="vip-perf-block vip-venue-block">';
  h += _vipVenueBlockHd('Performance Summary', d.venue, (d.shows&&d.shows.length)?(d.shows.length+' show'+(d.shows.length===1?'':'s')):'No shows');
  if(!(d.shows&&d.shows.length)){
    h += '<div style="padding:14px;font-size:11px;color:var(--ink3)">No shows this week.</div></div>';
    return h;
  }
  h += '<div class="tbl-wrap" style="margin:0"><table class="vip-past-tbl"><thead><tr>'
     + '<th class="l" style="min-width:110px">Artist / Date</th>'
     + '<th>DJ Cost</th>'
     + '<th>BS Actual</th><th style="'+_TARGET_BG+'">BS Min</th><th>BS Var</th>'
     + '<th>ROI</th><th style="'+_TARGET_BG+'">ROI Tgt</th>'
     + '<th>Tables</th><th style="'+_TARGET_BG+'">Bgt</th>'
     + '<th>Avg/Tbl</th>'
     + '</tr></thead><tbody>';

  var totBS=0,totMin=0,totTbl=0,totBudget=0,totFee=0;
  d.shows.forEach(function(sh){
    var b=sh.bsActual>=sh.bsMin;
    var vbs=sh.bsActual-sh.bsMin;
    var avg=(sh.tablesActual||0)?Math.round(sh.bsActual/sh.tablesActual):0;
    var roiA=_fmtROI(sh.bsActual,sh.fee), roiT=_fmtROI(sh.bsMin,sh.fee);
    var roiANum=sh.fee>0?sh.bsActual/sh.fee:null;
    var roiTNum=sh.fee>0?sh.bsMin/sh.fee:null;
    var roiCls=roiTone(roiANum, roiTNum);
    var vipRoiCls=_vipRoiToneCls(roiCls);
    totBS+=sh.bsActual; totMin+=sh.bsMin; totTbl+=(sh.tablesActual||0); totBudget+=(sh.tablesBudget||0); totFee+=sh.fee;
    h += '<tr>'
       + '<td class="l"><b>'+sh.dj+'</b><br><span style="font-size:9px;color:var(--ink3)">'+sh.label.replace(/,.*$/,'')+'</span></td>'
       + '<td class="vip-cost">'+$kv(sh.fee)+'</td>'
       + _vipTdFill($kv(sh.bsActual), b?'beat':'miss')
       + '<td style="'+_TARGET_BG+'">'+$kv(sh.bsMin)+'</td>'
       + _vipTdFill(_vipVarPlain(vbs), _vipFillTone(vbs))
       + _vipTdFill(roiA, vipRoiCls)
       + '<td style="'+_TARGET_BG+'">'+roiT+'</td>'
       + '<td>'+(sh.tablesActual!=null?sh.tablesActual:'\u2014')+'</td>'
       + '<td style="'+_TARGET_BG+'">'+(sh.tablesBudget!=null?sh.tablesBudget:'\u2014')+'</td>'
       + '<td>'+(avg?$kv(avg):'\u2014')+'</td>'
       + '</tr>';
  });
  var totAvg=totTbl?Math.round(totBS/totTbl):0;
  var totVbs=totBS-totMin;
  var totROIA=_fmtROI(totBS,totFee), totROIT=_fmtROI(totMin,totFee);
  var totRoiCls=roiTone(totFee>0?totBS/totFee:null, totFee>0?totMin/totFee:null);
  var totVipRoi=_vipRoiToneCls(totRoiCls);
  h += '<tr>'
     + '<td class="l">Total</td>'
     + '<td class="vip-cost">'+$kv(totFee)+'</td>'
     + _vipTdFill($kv(totBS), totVbs>=0?'beat':'miss')
     + '<td style="'+_TARGET_BG+'">'+$kv(totMin)+'</td>'
     + _vipTdFill(_vipVarPlain(totVbs), _vipFillTone(totVbs))
     + _vipTdFill(totROIA, totVipRoi)
     + '<td style="'+_TARGET_BG+'">'+totROIT+'</td>'
     + '<td>'+(totTbl||'\u2014')+'</td>'
     + '<td style="'+_TARGET_BG+'">'+(totBudget||'\u2014')+'</td>'
     + '<td>'+$kv(totAvg)+'</td>'
     + '</tr>';
  h += '</tbody></table></div></div>';
  return h;
}

function _vipTierCellHasActual(t, sh){
  if(!t) return false;
  if((+t.soldTables||0)>0 || (+t.totalSales||0)>0) return true;
  if(sh && (sh._tierAllocated || sh._tierDataAvailable===true || sh._tierEstimated)) return true;
  /* Completed show with floor-plan inventory but no Toast tier split — still render 0s + miss fills */
  if(sh && t.totalTables!=null && (sh.bsActual!=null || sh.tablesActual!=null)) return true;
  return false;
}

/* When Toast week totals are missing, roll up per-show tiers or estimate from BS/tables. */
function _vipEnsureShowTierForFill(d){
  var excl=_vipExcludedTiers(d.venue);
  (d.shows||[]).forEach(function(sh){
    if(!sh || !sh.tiers) return;
    var names=Object.keys(sh.tiers).filter(function(t){ return excl.indexOf(t)<0; });
    if(!names.length) return;
    var hasSplit=names.some(function(t){
      var x=sh.tiers[t]; return x && ((+x.soldTables||0)>0 || (+x.totalSales||0)>0);
    });
    if(hasSplit){ sh._tierDataAvailable=true; return; }
    if(sh.bsActual==null && sh.tablesActual==null) return;
    var tblN=+sh.tablesActual||0;
    var bs=+sh.bsActual||0;
    if(!tblN){
      names.forEach(function(t){
        sh.tiers[t].soldTables=0;
        sh.tiers[t].totalSales=0;
        sh.tiers[t].avgPerTable=0;
      });
      sh._tierDataAvailable=true;
      sh._tierEstimated=true;
      return;
    }
    var invTot=names.reduce(function(s,t){ return s+(+sh.tiers[t].totalTables||0); },0) || names.length;
    /* Put known sold tables / BS into tiers by inventory weight so Avg vs Min fills work. */
    var soldLeft=tblN, salesLeft=Math.round(bs);
    names.forEach(function(t,i){
      var inv=+sh.tiers[t].totalTables||0;
      var sold=i===names.length-1 ? soldLeft : Math.min(inv, Math.round(tblN*(inv/invTot)));
      if(sold<0) sold=0;
      soldLeft-=sold;
      var sales=i===names.length-1 ? salesLeft : Math.round(bs*(inv/invTot));
      if(sales<0) sales=0;
      salesLeft-=sales;
      sh.tiers[t].soldTables=sold;
      sh.tiers[t].totalSales=sales;
      sh.tiers[t].avgPerTable=sold?Math.round(sales/sold):0;
    });
    sh._tierDataAvailable=true;
    sh._tierEstimated=true;
  });
}

function _vipAggregateWeekTierFromShows(d){
  var excl=_vipExcludedTiers(d.venue);
  var agg={}, any=false;
  (d.shows||[]).forEach(function(sh){
    Object.keys(sh.tiers||{}).forEach(function(t){
      if(excl.indexOf(t)>=0) return;
      var src=sh.tiers[t]||{};
      if(!agg[t]){
        agg[t]={
          soldTables:0, totalTables:+src.totalTables||0, totalSales:0,
          minPerTable:+src.minPerTable||0,
          color:src.color||TIER_COLORS[t]||'#eee',
          textColor:src.textColor||TIER_TEXT[t]||'#333'
        };
      }
      agg[t].soldTables+=(+src.soldTables||0);
      agg[t].totalSales+=(+src.totalSales||0);
      if((+src.totalTables||0)>agg[t].totalTables) agg[t].totalTables=+src.totalTables;
      if(src.minPerTable!=null) agg[t].minPerTable=+src.minPerTable;
      if((+src.soldTables||0)>0 || (+src.totalSales||0)>0) any=true;
    });
  });
  if(!any) return null;
  Object.keys(agg).forEach(function(t){
    var x=agg[t];
    x.avgPerTable=x.soldTables?Math.round(x.totalSales/x.soldTables):0;
  });
  return {source:'Show tier roll-up', tiers:agg};
}

function _vipRenderTierBreakdown(d, rangeWkKey){
  _vipEnsureShowTierForFill(d);
  var weeklyTierActual=_vipResolveWeeklyTier(d.venue, rangeWkKey);
  if(!weeklyTierActual) weeklyTierActual=_vipAggregateWeekTierFromShows(d);
  var tiers=_vipCollectTiers(d, weeklyTierActual);
  var h='<div class="vip-perf-block vip-venue-block">';
  var tierNote=weeklyTierActual
    ? (weeklyTierActual.source||'Toast week totals')
    : ((d.shows||[]).some(function(sh){return sh._tierEstimated;}) ? 'Estimated from BS / tables' : '');
  h += _vipVenueBlockHd('Tier Breakdown', d.venue, tierNote);
  if(!(d.shows&&d.shows.length)){
    h += '<div style="padding:14px;font-size:11px;color:var(--ink3)">No shows this week.</div></div>';
    return h;
  }
  if(!tiers.length){
    h += '<div style="padding:14px;font-size:11px;color:var(--ink3)">No tier floor plan on file for this venue.</div></div>';
    return h;
  }

  var tierSet={};
  (d.shows||[]).forEach(function(sh){ Object.keys(sh.tiers||{}).forEach(function(t){ tierSet[t]=sh.tiers[t]; }); });
    if(weeklyTierActual&&weeklyTierActual.tiers){
      Object.keys(weeklyTierActual.tiers).forEach(function(t){
        var src=weeklyTierActual.tiers[t]||{};
        var cur=tierSet[t]||{};
        tierSet[t]={
          soldTables:src.soldTables!=null?src.soldTables:cur.soldTables,
          totalTables:src.totalTables!=null?src.totalTables:cur.totalTables,
          totalSales:src.totalSales!=null?src.totalSales:cur.totalSales,
          avgPerTable:src.avgPerTable!=null?src.avgPerTable:cur.avgPerTable,
          minPerTable:src.minPerTable!=null?src.minPerTable:cur.minPerTable,
          color:src.color||cur.color||TIER_COLORS[t]||'#eee',
          textColor:src.textColor||cur.textColor||TIER_TEXT[t]||'#333'
        };
      });
    }

  h += '<div class="tbl-wrap" style="margin:0"><table class="vip-past-tbl"><thead>';
  h += '<tr><th class="l" rowspan="2" style="min-width:100px;vertical-align:bottom">Artist</th>'
     + '<th rowspan="2" style="vertical-align:bottom">Cost</th>'
     + '<th rowspan="2" style="vertical-align:bottom">Tbl</th>'
     + '<th rowspan="2" style="vertical-align:bottom">Avg</th>';
  tiers.forEach(function(tname){
    var t=tierSet[tname]||{};
    h += '<th colspan="4" class="th-tier" style="background:'+(t.color||TIER_COLORS[tname]||'#eee')+';color:'+(t.textColor||TIER_TEXT[tname]||'#333')+'">'+tname+'</th>';
  });
  h += '</tr><tr>';
  tiers.forEach(function(){
    h += '<th>Sold</th><th>Sales</th><th>Avg</th><th style="'+_TARGET_BG+'">Min</th>';
  });
  h += '</tr></thead><tbody>';

  var totTiers={};
  tiers.forEach(function(t){ totTiers[t]={sold:0,sales:0,inv:0,hasActual:false}; });
  var totTblSum=0, totBSSum=0, totFeeSum=0;

  /* Prefer Toast week allocation; otherwise keep per-show (incl. estimated) tiers. */
  var toastWeek=_vipResolveWeeklyTier(d.venue, rangeWkKey);
  var tierRows=toastWeek?_vipAllocateWeeklyTiers(d.shows,toastWeek):d.shows;
  tierRows.forEach(function(sh){
    var tblN=(sh.tablesActual!=null)?+sh.tablesActual:0;
    var rowSales=tiers.reduce(function(s,t){return s+((sh.tiers[t]&&sh.tiers[t].totalSales)||0);},0);
    var avg=tblN?Math.round((rowSales||sh.bsActual)/tblN):0;
    var hasShowActual=sh.bsActual!=null || sh.tablesActual!=null;
    totTblSum+=tblN; totBSSum+=(rowSales||sh.bsActual||0); totFeeSum+=(+sh.fee||0);
    h += '<tr><td class="l"><b>'+sh.dj+'</b><br><span style="font-size:9px;color:var(--ink3)">'+String(sh.label||'').replace(/,.*$/,'')+'</span></td>'
       + '<td class="vip-cost">'+$kv(sh.fee)+'</td>'
       + '<td>'+(sh.tablesActual!=null?sh.tablesActual:'\u2014')+' <span style="color:var(--ink3);font-size:9px">/ '+(sh.tablesBudget!=null?sh.tablesBudget:'\u2014')+'</span></td>'
       + '<td>'+(avg?$kv(avg):'\u2014')+'</td>';
    tiers.forEach(function(tname){
      var t=sh.tiers&&sh.tiers[tname];
      if(!t){ h+='<td>\u2014</td><td>\u2014</td><td>\u2014</td><td>\u2014</td>'; return; }
      var inv=+t.totalTables||0;
      if(inv>totTiers[tname].inv) totTiers[tname].inv=inv;
      var has=_vipTierCellHasActual(t, sh);
      if(!has){
        h+='<td>\u2014<span style="color:var(--ink3);font-size:9px"> / '+inv+'</span></td>'
          +'<td>\u2014</td><td>\u2014</td>'
          +'<td style="'+_TARGET_BG+'">'+$kv(t.minPerTable)+'</td>';
        return;
      }
      var sold=+t.soldTables||0;
      var sales=+t.totalSales||0;
      var avgT=+t.avgPerTable||(sold?Math.round(sales/sold):0);
      var bT=sold>0&&avgT>=(+t.minPerTable||0);
      var toneT=sold>0?(bT?'beat':'miss'):(hasShowActual?'miss':'');
      totTiers[tname].sold+=sold;
      totTiers[tname].sales+=sales;
      totTiers[tname].hasActual=true;
      h += '<td>'+sold+'/'+inv+'</td>'
         + _vipTdFill($kv(sales), toneT)
         + _vipTdFill(sold||hasShowActual?$kv(avgT):'\u2014', sold>0?(bT?'beat':'miss'):(hasShowActual?'miss':''))
         + '<td style="'+_TARGET_BG+'">'+$kv(t.minPerTable)+'</td>';
    });
    h += '</tr>';
  });

  h += '<tr><td class="l">Total</td><td class="vip-cost">'+$kv(totFeeSum)+'</td>'
     + '<td>'+totTblSum+'</td>'
     + '<td>'+$kv(totTblSum?Math.round(totBSSum/totTblSum):0)+'</td>';
  tiers.forEach(function(tname){
    var t=totTiers[tname];
    if(!t.hasActual){
      h += '<td>\u2014<span style="color:var(--ink3);font-size:9px"> / '+t.inv+'</span></td><td>\u2014</td><td>\u2014</td><td></td>';
    } else {
      var avgT=t.sold?Math.round(t.sales/t.sold):0;
      var minT=(tierSet[tname]&&tierSet[tname].minPerTable)||0;
      var bTot=t.sold>0&&avgT>=(+minT||0);
      var toneTot=t.sold>0?(bTot?'beat':'miss'):'miss';
      h += '<td>'+t.sold+'/'+t.inv+'</td>'
         + _vipTdFill($kv(t.sales), toneTot)
         + _vipTdFill($kv(avgT), t.sold>0?(bTot?'beat':'miss'):'miss')
         + '<td></td>';
    }
  });
  h += '</tr></tbody></table></div>';
  if(!toastWeek && (d.shows||[]).every(function(sh){ return sh._tierDataAvailable===false && !sh._tierEstimated; })){
    h += '<div style="padding:8px 14px 12px;font-size:10px;color:var(--ink3)">Sold / Sales update when Toast tier actuals are available for this week (Beach Club auto-loads; other venues when synced).</div>';
  } else if((d.shows||[]).some(function(sh){ return sh._tierEstimated; }) && !toastWeek){
    h += '<div style="padding:8px 14px 12px;font-size:10px;color:var(--ink3)">Tier Sold / Sales estimated from show bottle service + tables until Toast week totals sync.</div>';
  }
  h += '</div>';
  return h;
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

