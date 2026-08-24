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
  window._flashPlEmptyShown=false;

  var h = '';

  /* Stacked full-width sections: Budget → Performance → Tiers → Appendix (1 page / location) */
  h += '<div class="vip-print-page vip-print-page1 vip-stack-sec">';
  h += _vipSectionTitle('BUDGET', 'Standing · All locations');
  h += _vipAllBudgetStandingTable(venues.map(function(v){return v.venue;}), range.sun);
  h += '</div>';

  /* One print page per location (Last week + MTD) */
  venues.forEach(function(d){
    h += '<div class="vip-print-page vip-print-page2 vip-stack-sec">';
    h += _vipSectionTitle('PERFORMANCE SUMMARY', d.venue+' · Last week');
    h += '<div class="vip-email-snap">';
    h += '<div class="vip-band-hd">Last week</div>';
    h += _vipRenderPerfSummary(d);
    var para=_generateVenueFlashParagraph(d);
    if(para) h += '<div class="vip-venue-narrative"><span class="vip-venue-narrative-bullet">\u2022</span> '+para+'</div>';
    h += '<div class="vip-band-hd">MTD</div>';
    h += _vipRenderFlashPlForVenue(d.venue, range.sun);
    h += '</div>';
    h += '</div>';
  });

  h += '<div class="vip-print-page vip-print-page3 vip-stack-sec">';
  h += _vipSectionTitle('TIER BREAKDOWN', 'This week · All locations');
  venues.forEach(function(d){
    h += _vipRenderTierBreakdown(d, rangeWkKey);
  });
  h += '</div>';

  venues.forEach(function(d){
    var blocks=_vipAppendixMonthBlocks(d.venue, range.sun);
    if(!blocks.length){
      h += '<div class="vip-print-page vip-print-app vip-stack-sec">';
      h += _vipSectionTitle('APPENDIX', d.venue);
      h += '<div class="vip-perf-block vip-venue-block">'
        +_vipVenueBlockHd('YTD performances', d.venue, '')
        +'<div style="padding:14px;font-size:11px;color:var(--ink3)">No performances booked this fiscal year.</div></div>';
      h += '</div>';
      return;
    }
    blocks.forEach(function(block, bi){
      h += '<div class="vip-print-page vip-print-app vip-stack-sec">';
      h += _vipSectionTitle('APPENDIX', bi===0 ? d.venue : (d.venue+' · continued'));
      h += block;
      h += '</div>';
    });
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
  try{
    var stHost=document.getElementById('flashPlStatusHost');
    if(stHost && typeof _flashPlStatusChipHtml==='function') stHost.innerHTML=_flashPlStatusChipHtml();
  }catch(eSt){}
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

function _vipAppendixMonthBlocks(venue, asOfDate){
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
  return months.map(function(mi){
    var rows=byMonth[mi].slice().sort(function(a,b){ return String(a.d).localeCompare(String(b.d)); });
    var monthLbl=(typeof MN_SH!=='undefined'?MN_SH[mi]:('M'+(mi+1)))+' '+yr;
    var h='<div class="vip-perf-block vip-venue-block vip-app-month">';
    h+=_vipVenueBlockHd(monthLbl, venue, rows.length+' performance'+(rows.length===1?'':'s'));
    h+='<div class="tbl-wrap vip-app-tbl" style="margin:0"><table class="vip-past-tbl"><thead><tr>'
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
    return h;
  });
}
function _vipRenderAppendixVenue(venue, asOfDate){
  var blocks=_vipAppendixMonthBlocks(venue, asOfDate);
  if(!blocks.length){
    return '<div class="vip-perf-block vip-venue-block">'
      +_vipVenueBlockHd('YTD performances', venue, '')
      +'<div style="padding:14px;font-size:11px;color:var(--ink3)">No performances booked this fiscal year.</div></div>';
  }
  return blocks.join('');
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
     + '<th>EBITDA</th>'
     + '</tr></thead><tbody>';

  var totBS=0,totMin=0,totTbl=0,totBudget=0,totFee=0,totEbitda=0,totEbitdaN=0;
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
    var ebitdaPack=_flashEbitdaForShow(d.venue, sh);
    var ebitdaAmt=ebitdaPack?ebitdaPack.ebitda:null;
    var ebitdaCell;
    if(ebitdaAmt==null) ebitdaCell='<td class="vip-ebitda-empty">\u2014</td>';
    else{
      totEbitda+=ebitdaAmt; totEbitdaN++;
      ebitdaCell=_vipTdFill(_vipEbitdaTxt(ebitdaAmt), ebitdaAmt>=0?'beat':'miss');
      if(ebitdaPack.tip) ebitdaCell=ebitdaCell.replace('<td ', '<td title="'+ebitdaPack.tip.replace(/"/g,'&quot;')+'" ');
    }
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
       + ebitdaCell
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
     + (totEbitdaN?_vipTdFill(_vipEbitdaTxt(totEbitda), totEbitda>=0?'beat':'miss'):'<td class="vip-ebitda-empty">\u2014</td>')
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

/* ========== Weekly Flash — Sales & Live Entertainment MTD (Flash-only) ========== */
window.FLASH_PL_OVERLAY = window.FLASH_PL_OVERLAY || { sales:null, live:null };
var _FLASH_PL_VENUE_MAP = {
  salesSheets: {
    'CASA NEOS Sales': 'Casa Neos Beach Club',
    'CN Lounge Sales': 'Casa Neos Lounge',
    'MILA Sales - 2F': 'MILA Lounge'
  },
  /* Weekly Actual / Budget sheet column matchers (header rows 2–4). */
  actualVenueMatchers: [
    { venue:'Casa Neos Lounge', re:/CASA\s*NEOS\s*LOUNGE/i },
    { venue:'Casa Neos Beach Club', re:/CASA\s*NEOS(?!\s*LOUNGE)/i },
    { venue:'MILA Lounge', re:/MILA\s*2F/i }
  ],
  liveSheets: {
    '4 - Casa Neos': 'Casa Neos Beach Club',
    '11 - CN Lounge Rooftop': 'Casa Neos Lounge',
    '10 - Mila II MM Club': 'MILA Lounge'
  }
};
var _FLASH_PL_ORDER = ['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'];
/* P&L from ebidta calculation*.xlsx (EBIDTA 2 / OPEX DATA 2).
   Hybrid: Payroll + Occupancy + Service Charge + CC Fees = % of day sales;
   Direct OpEx, G&A (ex CC), Utilities, Corporate = fixed daily $; Live Ent = DJ fee. */
var _FLASH_EBITDA_OPEX_BY_VENUE = {
  'Casa Neos Beach Club': {
    model: 'hybrid',
    payroll: 0.10247154902899072,
    occupancy: 0.06,
    other: -0.033,
    ccPct: 0.03,
    fixedDaily: {
      directExLive: 11063.038461538454,
      gaExCc: 6459.81128205128,
      utilities: 1498.2273717948717,
      corporate: 8744.902115384613
    },
    cogs: { lbwShare: 0.62, foodShare: 0.34, bevShare: 0.04, lbwPct: 0.15, foodPct: 0.265, bevPct: 0.28 },
    opexLabels: {
      payroll: 'Payroll (% sales)',
      directExLive: 'Direct OpEx (excl. Live Ent)',
      ccFees: '7010 — Credit Card Fees (3%)',
      gaExCc: 'G&A (excl. CC Fees)',
      utilities: 'Utilities',
      occupancy: 'Occupancy (6%)',
      other: '8090 — Service Charge Retained (3.3%)',
      corporate: 'Corporate Overhead'
    }
  },
  'MILA Lounge': {
    model: 'hybrid',
    payroll: 0.17835972437398664,
    occupancy: 0.06,
    other: -0.033,
    ccPct: 0.033,
    fixedDaily: {
      directExLive: 3809.9299450549443,
      gaExCc: 2801.1549450549455,
      utilities: 361.11994505494505,
      corporate: 3940.2224175824176
    },
    cogs: { lbwShare: 0.62, foodShare: 0.34, bevShare: 0.04, lbwPct: 0.15, foodPct: 0.265, bevPct: 0.28 },
    opexLabels: {
      payroll: 'Payroll (% sales)',
      directExLive: 'Direct OpEx (excl. Live Ent)',
      ccFees: '7010 — Credit Card Fees (3.3%)',
      gaExCc: 'G&A (excl. CC Fees)',
      utilities: 'Utilities',
      occupancy: 'Occupancy (6%)',
      other: '8090 — Service Charge Retained (3.3%)',
      corporate: 'Corporate Overhead'
    }
  },
  'Casa Neos Lounge': {
    model: 'hybrid',
    payroll: 0.02956092355544922,
    occupancy: 0.06,
    other: -0.033,
    ccPct: 0.03,
    fixedDaily: {
      directExLive: 5124.5213461538515,
      gaExCc: 4499.820576923077,
      utilities: 632.2951923076923,
      corporate: 4029.165576923077
    },
    cogs: { lbwShare: 0.62, foodShare: 0.34, bevShare: 0.04, lbwPct: 0.15, foodPct: 0.265, bevPct: 0.28 },
    opexLabels: {
      payroll: 'Payroll (% sales)',
      directExLive: 'Direct OpEx (excl. Live Ent)',
      ccFees: '7010 — Credit Card Fees (3%)',
      gaExCc: 'G&A (excl. CC Fees)',
      utilities: 'Utilities',
      occupancy: 'Occupancy (6%)',
      other: '8090 — Service Charge Retained (3.3%)',
      corporate: 'Corporate Overhead'
    }
  }
};
var _FLASH_DAILY_SALES_SOURCES = {
  'Casa Neos Beach Club': { sheet: 'CASA NEOS', blocks: [{ off: 0, key: 'dinner' }, { off: 8, key: 'lunch' }] },
  'Casa Neos Lounge': { sheet: 'CN LOUNGE', blocks: [{ off: 0, key: 'dinner' }, { off: 8, key: 'lunch' }] },
  'MILA Lounge': { sheet: 'MILA II', blocks: [{ off: 0, key: 'part1' }, { off: 8, key: 'part2' }, { off: 16, key: 'part3' }] }
};
function _flashEbitdaOpex(venue){
  return _FLASH_EBITDA_OPEX_BY_VENUE[venue] || _FLASH_EBITDA_OPEX_BY_VENUE['Casa Neos Beach Club'];
}

function _flashPlLoadLocal(){
  try{
    var raw=localStorage.getItem('rdg_flash_pl_overlay_v1');
    if(!raw) return;
    var parsed=JSON.parse(raw);
    if(parsed && typeof parsed==='object'){
      window.FLASH_PL_OVERLAY = {
        sales: parsed.sales||null,
        live: parsed.live||null
      };
    }
  }catch(e){}
}
function _flashPlSaveLocal(){
  try{ localStorage.setItem('rdg_flash_pl_overlay_v1', JSON.stringify(window.FLASH_PL_OVERLAY||{})); }catch(e){}
}
function _flashPlPersist(){
  _flashPlSaveLocal();
  if(typeof window._fbSave==='function'){
    try{ window._fbSave('flashPlOverlay', window.FLASH_PL_OVERLAY); }catch(eFb){}
  }
}
function _flashPlApplyRemote(val){
  if(!val || typeof val!=='object') return;
  window.FLASH_PL_OVERLAY = {
    sales: val.sales||null,
    live: val.live||null
  };
  _flashPlSaveLocal();
}
_flashPlLoadLocal();

function _flashWeekToPeriodNum(weekNum){
  var w=+weekNum;
  if(!(w>0)) return null;
  var start=1;
  var weeks=(typeof FISCAL_WEEKS_445!=='undefined')?FISCAL_WEEKS_445:[4,4,5,4,4,5,4,4,5,4,4,5];
  for(var p=0;p<12;p++){
    var end=start+weeks[p]-1;
    if(w>=start && w<=end) return p+1;
    start=end+1;
  }
  return null;
}
function _flashPeriodLabel(n){ return n?('P'+n):''; }
function _flashNum(v){
  if(v==null || v==='') return null;
  if(typeof v==='number' && isFinite(v)) return v;
  var s=String(v).replace(/[$,\s]/g,'').replace(/\((.*)\)/,'-$1');
  var n=parseFloat(s);
  return isFinite(n)?n:null;
}
function _flashSheetRows(wb, name){
  if(!wb || !wb.Sheets || !wb.Sheets[name]) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, defval:null, raw:true});
}

function _flashFindSheetName(wb, re){
  if(!wb || !wb.SheetNames) return null;
  for(var i=0;i<wb.SheetNames.length;i++){
    if(re.test(wb.SheetNames[i])) return wb.SheetNames[i];
  }
  return null;
}
function _flashParsePeriodCell(v){
  if(v==null || v==='') return null;
  var s=String(v).trim().toUpperCase();
  var m=s.match(/^P\s*(\d+)$/);
  return m?+m[1]:null;
}
function _flashParseWeekCell(v){
  if(v==null || v==='') return null;
  if(typeof v==='number' && v>=1 && v<=53) return v;
  var m=String(v).match(/Week\s*(\d+)/i);
  return m?+m[1]:null;
}
/** Locate Total Sales columns on Actual / Budget weekly sheets. */
function _flashFindWeeklySalesCols(rows, opts){
  opts=opts||{};
  var allowSumParts=!!opts.allowSumParts;
  var year=opts.year||null;
  var yearRe=year?new RegExp(String(year)):/20\d{2}/;
  var headerRow=-1, i, c, label, hits;
  for(i=0;i<Math.min(rows.length,8);i++){
    hits=0;
    for(c=0;c<(rows[i]||[]).length;c++){
      label=rows[i][c]==null?'':String(rows[i][c]);
      if(/MILA\s*2F|CASA\s*NEOS/i.test(label)) hits++;
    }
    if(hits>=2){ headerRow=i; break; }
  }
  if(headerRow<0) return { cols:{}, headerRow:-1, dataStart:-1 };
  var r2=rows[headerRow]||[];
  var r3=rows[headerRow+1]||[];
  var r4=rows[headerRow+2]||[];
  var maxC=Math.max(r2.length, r3.length, r4.length);
  var out={};
  (_FLASH_PL_VENUE_MAP.actualVenueMatchers||[]).forEach(function(m){
    var totalCols=[], partCols=[], seg, metric;
    for(c=0;c<maxC;c++){
      label=r2[c]==null?'':String(r2[c]);
      if(!m.re.test(label)) continue;
      if(year && !yearRe.test(label)) continue;
      seg=r3[c]==null?'':String(r3[c]).trim();
      metric=r4[c]==null?'':String(r4[c]).trim();
      if(!/sales/i.test(metric)) continue;
      if(/^total$/i.test(seg) || /total\s*sales/i.test(metric)) totalCols.push(c);
      else if(allowSumParts) partCols.push(c);
    }
    if(totalCols.length) out[m.venue]=totalCols;
    else if(allowSumParts && partCols.length) out[m.venue]=partCols;
  });
  return { cols:out, headerRow:headerRow, dataStart:headerRow+3 };
}
function _flashSumColsForPeriod(rows, colIdxs, periodCol, weekCol, targetPeriod, ytdThrough, dataStart){
  var mtd=0, ytd=0, maxWeek=0, sawMtd=false, sawYtd=false;
  var i, r, pn, wk, c, v;
  var start=(dataStart!=null && dataStart>=0)?dataStart:4;
  for(i=start;i<rows.length;i++){
    r=rows[i]||[];
    pn=_flashParsePeriodCell(r[periodCol]);
    if(!pn) continue;
    wk=_flashParseWeekCell(r[weekCol]);
    var rowSum=0, has=false;
    for(c=0;c<colIdxs.length;c++){
      v=_flashNum(r[colIdxs[c]]);
      if(v!=null){ rowSum+=v; has=true; }
    }
    if(!has) continue;
    if(pn===targetPeriod){
      mtd+=rowSum; sawMtd=true;
      if(wk) maxWeek=Math.max(maxWeek, wk);
    }
    if(pn<=ytdThrough){
      ytd+=rowSum; sawYtd=true;
    }
  }
  return {
    mtd:sawMtd?mtd:null,
    ytd:sawYtd?ytd:null,
    week:maxWeek||null
  };
}
function _flashDetectCurrentPeriod(rows, periodCol, weekCol, salesColLists, dataStart){
  var maxPWithSales=0, maxWInPeriod=0, i, r, pn, wk, c, j, v, rowHasSales;
  var start=(dataStart!=null && dataStart>=0)?dataStart:4;
  var allCols=[];
  (salesColLists||[]).forEach(function(cols){
    for(j=0;j<cols.length;j++) allCols.push(cols[j]);
  });
  for(i=start;i<rows.length;i++){
    r=rows[i]||[];
    pn=_flashParsePeriodCell(r[periodCol]);
    if(!pn) continue;
    rowHasSales=false;
    for(c=0;c<allCols.length;c++){
      v=_flashNum(r[allCols[c]]);
      if(v!=null && v!==0){ rowHasSales=true; break; }
    }
    if(rowHasSales) maxPWithSales=Math.max(maxPWithSales, pn);
  }
  if(!maxPWithSales){
    for(i=start;i<rows.length;i++){
      r=rows[i]||[];
      pn=_flashParsePeriodCell(r[periodCol]);
      wk=_flashParseWeekCell(r[weekCol]);
      if(pn) maxPWithSales=Math.max(maxPWithSales, pn);
      if(wk) maxWInPeriod=Math.max(maxWInPeriod, wk);
    }
    return { periodNum:maxPWithSales||null, week:maxWInPeriod||null };
  }
  for(i=start;i<rows.length;i++){
    r=rows[i]||[];
    pn=_flashParsePeriodCell(r[periodCol]);
    if(pn!==maxPWithSales) continue;
    wk=_flashParseWeekCell(r[weekCol]);
    if(wk) maxWInPeriod=Math.max(maxWInPeriod, wk);
  }
  return { periodNum:maxPWithSales, week:maxWInPeriod||null };
}
function _flashParseSalesFromWeeklySheets(wb, fileName){
  var actualName=_flashFindSheetName(wb, /^Actual\s*-\s*(\d{4})$/i);
  if(!actualName) return null;
  var yearM=actualName.match(/(\d{4})/);
  var year=yearM?+yearM[1]:2026;
  var actualRows=_flashSheetRows(wb, actualName);
  if(!actualRows || actualRows.length<5) return null;
  var actualMeta=_flashFindWeeklySalesCols(actualRows, {allowSumParts:false, year:year});
  var actualCols=actualMeta.cols||{};
  if(!Object.keys(actualCols).length) return null;

  var colLists=Object.keys(actualCols).map(function(v){ return actualCols[v]; });
  var cur=_flashDetectCurrentPeriod(actualRows, 1, 0, colLists, actualMeta.dataStart);
  var periodNum=cur.periodNum;
  var week=cur.week;
  if(!periodNum) return null;

  var venues={};
  Object.keys(actualCols).forEach(function(venue){
    var s=_flashSumColsForPeriod(actualRows, actualCols[venue], 1, 0, periodNum, periodNum, actualMeta.dataStart);
    venues[venue]={
      salesMtdA:s.mtd, salesYtdA:s.ytd,
      salesMtdB:null, salesYtdB:null
    };
  });

  var budgetName=_flashFindSheetName(wb, new RegExp('^Budget\\s*-\\s*'+year+'$','i'))
    || _flashFindSheetName(wb, /^Budget\s*-\s*\d{4}$/i);
  if(budgetName){
    var budgetRows=_flashSheetRows(wb, budgetName);
    if(budgetRows && budgetRows.length>=4){
      var budgetMeta=_flashFindWeeklySalesCols(budgetRows, {allowSumParts:true, year:year});
      var budgetCols=budgetMeta.cols||{};
      /* Actual + Budget: Week in col A, period (P8) in col B. */
      Object.keys(budgetCols).forEach(function(venue){
        if(!venues[venue]) venues[venue]={ salesMtdA:null, salesYtdA:null, salesMtdB:null, salesYtdB:null };
        var b=_flashSumColsForPeriod(budgetRows, budgetCols[venue], 1, 0, periodNum, periodNum, budgetMeta.dataStart);
        venues[venue].salesMtdB=b.mtd;
        venues[venue].salesYtdB=b.ytd;
      });
    }
  }

  return {
    uploadedAt:new Date().toISOString(),
    fileName:fileName||'',
    year:year,
    period:_flashPeriodLabel(periodNum),
    periodNum:periodNum,
    week:week,
    source:'weekly',
    venues:venues
  };
}
function _flashParseSalesFromLocationSheets(wb, fileName){
  var venues={};
  var period=null, week=null, year=2026;
  Object.keys(_FLASH_PL_VENUE_MAP.salesSheets).forEach(function(sheetName){
    var venue=_FLASH_PL_VENUE_MAP.salesSheets[sheetName];
    var rows=_flashSheetRows(wb, sheetName);
    if(!rows || !rows.length) return;
    var mtdCol=-1, ytdCol=-1;
    var i, r, c;
    for(i=0;i<Math.min(rows.length,12);i++){
      r=rows[i]||[];
      for(c=0;c<r.length;c++){
        var cell=r[c]==null?'':String(r[c]);
        if(/^P\d+$/i.test(cell.trim()) && !period) period=cell.trim().toUpperCase();
        if(/^Week\s+(\d+)$/i.test(cell.trim()) && week==null){
          week=+RegExp.$1;
        }
        if(/MTD/i.test(cell) && mtdCol<0) mtdCol=c;
        if(/^YTD$/i.test(cell.trim()) && ytdCol<0) ytdCol=c;
      }
      if(week==null){
        for(c=0;c<r.length;c++){
          if(typeof r[c]==='number' && r[c]>=1 && r[c]<=53){ week=r[c]; break; }
        }
      }
    }
    if(mtdCol<0) mtdCol=9;
    if(ytdCol<0) ytdCol=13;
    var totalIdx=-1;
    for(i=0;i<rows.length;i++){
      r=rows[i]||[];
      for(c=0;c<Math.min(r.length,6);c++){
        if(r[c]!=null && String(r[c]).trim().toUpperCase()==='TOTAL'){ totalIdx=i; break; }
      }
      if(totalIdx>=0) break;
    }
    if(totalIdx<0) return;
    var budgetIdx=-1;
    for(i=totalIdx+1;i<Math.min(rows.length, totalIdx+4);i++){
      r=rows[i]||[];
      for(c=0;c<Math.min(r.length,6);c++){
        if(r[c]!=null && String(r[c]).trim().toUpperCase()==='BUDGET'){ budgetIdx=i; break; }
      }
      if(budgetIdx>=0) break;
    }
    venues[venue]={
      salesMtdA:_flashNum(rows[totalIdx][mtdCol]),
      salesMtdB:budgetIdx>=0?_flashNum(rows[budgetIdx][mtdCol]):null,
      salesYtdA:_flashNum(rows[totalIdx][ytdCol]),
      salesYtdB:budgetIdx>=0?_flashNum(rows[budgetIdx][ytdCol]):null
    };
  });
  var periodNum=period?parseInt(String(period).replace(/\D/g,''),10):null;
  if(!periodNum && week) periodNum=_flashWeekToPeriodNum(week);
  if(!Object.keys(venues).length) return null;
  return {
    uploadedAt:new Date().toISOString(),
    fileName:fileName||'',
    year:year,
    period:_flashPeriodLabel(periodNum)||period||'',
    periodNum:periodNum,
    week:week,
    source:'location',
    venues:venues
  };
}
function _flashParseSalesWorkbook(wb, fileName){
  /* Prefer weekly Actual / Budget sheets (period labels in col B). */
  var sales=_flashParseSalesFromWeeklySheets(wb, fileName)
    || _flashParseSalesFromLocationSheets(wb, fileName)
    || { uploadedAt:new Date().toISOString(), fileName:fileName||'', year:2026, period:'', periodNum:null, week:null, venues:{} };
  sales.dailyByVenue=_flashParseAllDailySales(wb, sales.dailyByVenue);
  return sales;
}
function _flashParseAllDailySales(wb, existing){
  var out=existing||{};
  Object.keys(_FLASH_DAILY_SALES_SOURCES).forEach(function(venue){
    var src=_FLASH_DAILY_SALES_SOURCES[venue];
    var daily=_flashParseDailySalesBlocks(wb, src.sheet, src.blocks);
    if(daily && Object.keys(daily).length) out[venue]=daily;
  });
  return out;
}

/** Excel serial → YYYY-MM-DD (UTC). */
function _flashExcelDateIso(serial){
  if(serial==null || typeof serial!=='number' || !isFinite(serial)) return null;
  var d=new Date(Date.UTC(1899,11,30+serial));
  return d.toISOString().slice(0,10);
}
/** Daily net sales from side-by-side source tables (CASA NEOS, CN LOUNGE, MILA II). */
function _flashParseDailySalesBlocks(wb, sheetName, blocks){
  var rows=_flashSheetRows(wb, sheetName);
  if(!rows || !rows.length || !blocks || !blocks.length) return null;
  var byDate={}, i, b, off, key, dateCol, salesCol, r, iso, sales;
  blocks.forEach(function(blk){
    off=blk.off; key=blk.key;
    dateCol=off+4; salesCol=off+1;
    for(i=1;i<rows.length;i++){
      r=rows[i]||[];
      iso=_flashExcelDateIso(r[dateCol]);
      sales=_flashNum(r[salesCol]);
      if(!iso || sales==null || sales<=0) continue;
      if(!byDate[iso]) byDate[iso]={ total:0 };
      byDate[iso][key]=sales;
    }
  });
  Object.keys(byDate).forEach(function(iso){
    var d=byDate[iso], sum=0;
    blocks.forEach(function(blk){ sum+=(+d[blk.key]||0); });
    d.total=sum;
  });
  return byDate;
}
function _flashDailySalesDay(venue, dateStr){
  var ov=window.FLASH_PL_OVERLAY||{};
  var map=ov.sales&&ov.sales.dailyByVenue&&ov.sales.dailyByVenue[venue];
  if(!map || !dateStr) return null;
  return map[dateStr]||null;
}
/** Per operating day: lunch + dinner net sales from CASA NEOS source. */
function _flashDailySalesForShow(venue, dateStr){
  var day=_flashDailySalesDay(venue, dateStr);
  if(!day || !(day.total>0)) return null;
  return day.total;
}
function _flashCalcEbitda(sales, djCost, venue){
  var wf=_flashEbitdaWaterfall(sales, djCost, venue);
  return wf?wf.ebitda:null;
}
function _flashEbitdaPct(amt, sales){
  if(!(sales>0) || amt==null) return '';
  return (100*amt/sales).toFixed(1)+'%';
}
/** Full EBIDTA 2-style waterfall for one operating day. */
function _flashEbitdaWaterfall(sales, djCost, venue){
  sales=Math.round(+(sales||0)||0);
  if(!(sales>0)) return null;
  var o=_flashEbitdaOpex(venue), c=o.cogs;
  var lbw=sales*c.lbwShare, food=sales*c.foodShare, bev=sales*c.bevShare;
  var lbwCost=lbw*c.lbwPct, foodCost=food*c.foodPct, bevCost=bev*c.bevPct;
  var cogs=lbwCost+foodCost+bevCost;
  var gp=sales-cogs;
  var payroll, directExLive, gaExCc, ccFees, ga, utilities, occupancy, other, corporate;
  if(o.model==='hybrid' && o.fixedDaily){
    var f=o.fixedDaily;
    payroll=sales*o.payroll;
    directExLive=f.directExLive;
    gaExCc=f.gaExCc!=null?f.gaExCc:(f.ga||0);
    ccFees=sales*(o.ccPct||0);
    ga=gaExCc+ccFees;
    utilities=f.utilities;
    occupancy=sales*o.occupancy;
    other=sales*o.other;
    corporate=f.corporate;
  } else {
    payroll=sales*o.payroll;
    directExLive=sales*o.directExLive;
    gaExCc=sales*(o.ga||0);
    ccFees=sales*(o.ccPct||0);
    ga=gaExCc+ccFees;
    utilities=sales*o.utilities;
    occupancy=sales*o.occupancy;
    other=sales*o.other;
    corporate=sales*o.corporate;
  }
  var liveEnt=+(djCost||0)||0;
  var ebitda=gp-payroll-directExLive-liveEnt-ga-utilities-occupancy-other-corporate;
  return {
    sales:sales, lbw:lbw, food:food, bev:bev,
    lbwCost:lbwCost, foodCost:foodCost, bevCost:bevCost, cogs:cogs, gp:gp,
    payroll:payroll, directExLive:directExLive, liveEnt:liveEnt,
    ccFees:ccFees, gaExCc:gaExCc, ga:ga,
    utilities:utilities, occupancy:occupancy, other:other, corporate:corporate,
    ebitda:Math.round(ebitda)
  };
}
function _flashEbitdaWfRow(label, amt, sales, opts){
  opts=opts||{};
  var bold=opts.bold, sub=opts.sub, highlight=opts.highlight, indent=opts.indent;
  var cls='ebitda-wf-row'+(bold?' ebitda-wf-bold':'')+(sub?' ebitda-wf-sub':'')+(highlight?' ebitda-wf-hl':'');
  var pad=indent?('padding-left:'+(indent*14)+'px'):'';
  var amtTxt=(amt==null||amt==='')?'\u2014':_flashMoneyTxt(amt);
  var pct='';
  if(!opts.noPct){
    if(opts.pctLabel) pct=opts.pctLabel;
    else if(amt!=null&&sales>0) pct=_flashEbitdaPct(amt, sales);
  }
  return '<tr class="'+cls+'">'
    +'<td class="l" style="'+pad+'">'+label+'</td>'
    +'<td>'+amtTxt+'</td>'
    +'<td class="ebitda-wf-pct">'+pct+'</td>'
    +'</tr>';
}
function _flashEbitdaWaterfallTableHtml(wf, venue){
  if(!wf) return '';
  var s=wf.sales, o=_flashEbitdaOpex(venue), c=o.cogs;
  var ol=o.opexLabels||{}, fx=!!(o.model==='hybrid'), fix={pctLabel:'fixed $'};
  var h='<table class="ebitda-wf-tbl"><thead><tr><th class="l">Line</th><th>Amount</th><th>% Sales</th></tr></thead><tbody>';
  h+=_flashEbitdaWfRow('Total Sales', s, s, {bold:true, highlight:true});
  h+='<tr class="ebitda-wf-sep"><td colspan="3">COGS</td></tr>';
  h+=_flashEbitdaWfRow('LBW Sales', wf.lbw, s, {sub:true, indent:1});
  h+=_flashEbitdaWfRow('Food Sales', wf.food, s, {sub:true, indent:1});
  h+=_flashEbitdaWfRow('Beverage Sales', wf.bev, s, {sub:true, indent:1});
  h+=_flashEbitdaWfRow('LBW Cost ('+(c.lbwPct*100).toFixed(1)+'%)', wf.lbwCost, s, {sub:true, indent:2});
  h+=_flashEbitdaWfRow('Food Cost ('+(c.foodPct*100).toFixed(1)+'%)', wf.foodCost, s, {sub:true, indent:2});
  h+=_flashEbitdaWfRow('Beverage Cost ('+(c.bevPct*100).toFixed(1)+'%)', wf.bevCost, s, {sub:true, indent:2});
  h+=_flashEbitdaWfRow('Total COGS', wf.cogs, s, {bold:true});
  h+=_flashEbitdaWfRow('Gross Profit', wf.gp, s, {bold:true, highlight:true});
  h+='<tr class="ebitda-wf-sep"><td colspan="3">Operating Expenses</td></tr>';
  h+=_flashEbitdaWfRow(ol.payroll||'Payroll', wf.payroll, s, {indent:1});
  h+=_flashEbitdaWfRow(ol.directExLive||'Direct OpEx (excl. Live Ent)', wf.directExLive, s, fx?Object.assign({indent:1},fix):{indent:1});
  h+=_flashEbitdaWfRow('6750 — Live Entertainment', wf.liveEnt, s, {indent:1, highlight:true});
  h+=_flashEbitdaWfRow(ol.ccFees||'7010 — Credit Card Fees', wf.ccFees, s, {indent:1});
  h+=_flashEbitdaWfRow(ol.gaExCc||'G&A (excl. CC Fees)', wf.gaExCc, s, fx?Object.assign({indent:1},fix):{indent:1});
  h+=_flashEbitdaWfRow(ol.utilities||'Utilities', wf.utilities, s, fx?Object.assign({indent:1},fix):{indent:1});
  h+=_flashEbitdaWfRow(ol.occupancy||'Occupancy', wf.occupancy, s, {indent:1});
  h+=_flashEbitdaWfRow(ol.other||'Other (Income) Expenses', wf.other, s, {indent:1});
  h+=_flashEbitdaWfRow(ol.corporate||'Corporate Overhead', wf.corporate, s, fx?Object.assign({indent:1},fix):{indent:1});
  h+=_flashEbitdaWfRow('EBITDA', wf.ebitda, s, {bold:true, highlight:true});
  h+='</tbody></table>';
  return h;
}
function _flashEbitdaMergeWaterfalls(list){
  if(!list||!list.length) return null;
  var sum=function(k){ return list.reduce(function(a,w){ return a+(+w[k]||0); },0); };
  var sales=sum('sales');
  if(!(sales>0)) return null;
  return {
    sales:sales, lbw:sum('lbw'), food:sum('food'), bev:sum('bev'),
    lbwCost:sum('lbwCost'), foodCost:sum('foodCost'), bevCost:sum('bevCost'),
    cogs:sum('cogs'), gp:sum('gp'), payroll:sum('payroll'),
    directExLive:sum('directExLive'), liveEnt:sum('liveEnt'),
    ccFees:sum('ccFees'), gaExCc:sum('gaExCc'), ga:sum('ga'),
    utilities:sum('utilities'), occupancy:sum('occupancy'),
    other:sum('other'), corporate:sum('corporate'), ebitda:sum('ebitda')
  };
}
function _flashEbitdaModelFile(venue){
  if(venue==='MILA Lounge') return 'ebidta calculation mila lounge.xlsx';
  if(venue==='Casa Neos Lounge') return 'ebidta calculation cn lounge.xlsx';
  return 'ebidta calculation.xlsx';
}
function _flashEbitdaSourceSheet(venue){
  var src=_FLASH_DAILY_SALES_SOURCES[venue];
  return src?src.sheet:'';
}
function _flashEbitdaSalesTip(venue, day, sales){
  var parts=[];
  if(venue==='MILA Lounge'){
    if(day.part1) parts.push('P1 '+Math.round(day.part1).toLocaleString());
    if(day.part2) parts.push('P2 '+Math.round(day.part2).toLocaleString());
    if(day.part3) parts.push('P3 '+Math.round(day.part3).toLocaleString());
  } else {
    if(day.lunch) parts.push('Lunch '+Math.round(day.lunch).toLocaleString());
    if(day.dinner) parts.push('Dinner '+Math.round(day.dinner).toLocaleString());
  }
  return 'Sales '+Math.round(sales).toLocaleString()+(parts.length?' ('+parts.join(' + ')+')':'');
}
function _flashEbitdaForShow(venue, sh){
  if(!_FLASH_EBITDA_OPEX_BY_VENUE[venue]) return null;
  var dateStr=sh&&sh.date;
  var day=_flashDailySalesDay(venue, dateStr);
  var sales=day&&day.total>0?day.total:null;
  if(sales==null) return null;
  var dj=+(sh.fee||0)||0;
  var ebitda=_flashCalcEbitda(sales, dj, venue);
  if(ebitda==null) return null;
  var tip=_flashEbitdaSalesTip(venue, day, sales)+' · Live Ent '+Math.round(dj).toLocaleString();
  return { ebitda:Math.round(ebitda), sales:sales, dj:dj, tip:tip };
}
var _EBITDA_ACCESS_SEL_KEY = 'rdg_ebitda_access_venues_v1';
function _ebitdaAccessGetSel(){
  try{
    var raw=sessionStorage.getItem(_EBITDA_ACCESS_SEL_KEY);
    if(raw){
      var parsed=JSON.parse(raw);
      if(parsed && typeof parsed==='object'){
        return _FLASH_PL_ORDER.filter(function(v){ return !!parsed[v]; });
      }
    }
  }catch(e){}
  /* Default: all flash locations so week compare is visible. */
  return _FLASH_PL_ORDER.slice();
}
function _ebitdaAccessSetSel(list){
  var map={};
  _FLASH_PL_ORDER.forEach(function(v){ map[v]=list.indexOf(v)>=0; });
  try{ sessionStorage.setItem(_EBITDA_ACCESS_SEL_KEY, JSON.stringify(map)); }catch(e){}
}
function _ebitdaAccessToggleVenue(venue){
  var sel=_ebitdaAccessGetSel().slice();
  var i=sel.indexOf(venue);
  if(i>=0){
    if(sel.length<=1) return;
    sel.splice(i,1);
  } else {
    sel.push(venue);
    sel.sort(function(a,b){ return _FLASH_PL_ORDER.indexOf(a)-_FLASH_PL_ORDER.indexOf(b); });
  }
  _ebitdaAccessSetSel(sel);
  renderEbitdaAccess();
}
function _ebitdaAccessVenuePillsHtml(active){
  var selMap={};
  (active||[]).forEach(function(v){ selMap[v]=1; });
  var h='<div class="ebitda-loc-bar"><div class="ebitda-loc-lbl">Locations</div><div class="ebitda-loc-pills">';
  _FLASH_PL_ORDER.forEach(function(vn){
    var on=!!selMap[vn];
    h+='<button type="button" class="ebitda-loc-pill'+(on?' on':'')+'" onclick="_ebitdaAccessToggleVenue(\''+vn.replace(/'/g,"\\'")+'\')">'+_escHtml(vn)+'</button>';
  });
  h+='</div><div class="ebitda-loc-hint">Pick locations · week grid aligns days across venues for easy compare</div></div>';
  return h;
}
function _ebitdaAccessVenuePack(pack, venue){
  if(!pack||!pack.venues) return null;
  for(var i=0;i<pack.venues.length;i++){
    if(pack.venues[i].venue===venue) return pack.venues[i];
  }
  return null;
}
function _ebitdaAccessBuildVenueData(d){
  var shows=d.shows||[], wfList=[], showRows=[], byDate={};
  shows.forEach(function(sh){
    var day=_flashDailySalesDay(d.venue, sh.date);
    var sales=day&&day.total>0?day.total:null;
    var fee=+(sh.fee||0)||0;
    var wf=sales!=null?_flashEbitdaWaterfall(sales, fee, d.venue):null;
    if(wf) wfList.push(wf);
    var row={ sh:sh, day:day, sales:sales, fee:fee, wf:wf };
    showRows.push(row);
    if(sh.date) byDate[sh.date]=row;
  });
  return { venue:d.venue, shows:showRows, byDate:byDate, weekWf:_flashEbitdaMergeWaterfalls(wfList), wfList:wfList };
}
function _ebitdaAccessShortVenue(vn){
  if(vn==='Casa Neos Beach Club') return 'CN Beach Club';
  if(vn==='Casa Neos Lounge') return 'CN Lounge';
  if(vn==='MILA Lounge') return 'MILA';
  return vn;
}
function _ebitdaAccessWeekGridHtml(items, weekLbl){
  if(!items||!items.length) return '';
  var dateMap={}, dateOrder=[];
  items.forEach(function(it){
    (it.shows||[]).forEach(function(row){
      var d=row.sh&&row.sh.date;
      if(!d) return;
      if(!dateMap[d]){ dateMap[d]=1; dateOrder.push(d); }
    });
  });
  dateOrder.sort();
  if(!dateOrder.length) return '';

  var h='<div class="ebitda-week-grid-wrap">';
  h+='<div class="sanity-ebitda-sec-title">Week compare · '+_escHtml(weekLbl||'Flash week')+'</div>';
  h+='<div class="tbl-wrap"><table class="ebitda-week-grid"><thead><tr>';
  h+='<th class="l sticky">Day</th>';
  items.forEach(function(it){
    h+='<th>'+_escHtml(_ebitdaAccessShortVenue(it.venue))+'</th>';
  });
  h+='</tr></thead><tbody>';

  dateOrder.forEach(function(iso){
    var label='';
    items.forEach(function(it){
      var row=it.byDate[iso];
      if(row&&row.sh&&!label) label=(row.sh.label||iso).replace(/,.*$/,'');
    });
    h+='<tr><td class="l sticky"><b>'+_escHtml(label||iso)+'</b><br><span class="ebitda-week-iso">'+_escHtml(iso)+'</span></td>';
    items.forEach(function(it){
      var row=it.byDate[iso];
      if(!row){
        h+='<td class="ebitda-week-empty">—</td>';
        return;
      }
      if(!row.wf){
        h+='<td class="ebitda-week-cell miss"><div class="ebitda-week-dj">'+_escHtml(row.sh.dj||'TBD')+'</div><div class="ebitda-week-meta">No sales</div></td>';
        return;
      }
      var cls=row.wf.ebitda>=0?'beat':'miss';
      h+='<td class="ebitda-week-cell '+cls+'">'
        +'<div class="ebitda-week-dj">'+_escHtml(row.sh.dj||'TBD')+'</div>'
        +'<div class="ebitda-week-meta">Sales '+_flashMoneyTxt(row.sales)+' · DJ '+_flashMoneyTxt(row.fee)+'</div>'
        +'<div class="ebitda-week-ebitda">'+_flashMoneyTxt(row.wf.ebitda)+' <span>'+_flashEbitdaPct(row.wf.ebitda,row.sales)+'</span></div>'
        +'</td>';
    });
    h+='</tr>';
  });

  h+='<tr class="ebitda-week-total-row"><td class="l sticky"><b>Week total</b></td>';
  items.forEach(function(it){
    var wf=it.weekWf;
    if(!wf){ h+='<td class="ebitda-week-empty">—</td>'; return; }
    var cls=wf.ebitda>=0?'beat':'miss';
    h+='<td class="ebitda-week-cell '+cls+'">'
      +'<div class="ebitda-week-meta">Sales '+_flashMoneyTxt(wf.sales)+' · DJ '+_flashMoneyTxt(wf.liveEnt)+'</div>'
      +'<div class="ebitda-week-ebitda">'+_flashMoneyTxt(wf.ebitda)+' <span>'+_flashEbitdaPct(wf.ebitda,wf.sales)+'</span></div>'
      +'</td>';
  });
  h+='</tr></tbody></table></div></div>';
  return h;
}
function _ebitdaAccessCompareSummaryHtml(items){
  if(!items||items.length<2) return '';
  var h='<div class="ebitda-compare-sec"><div class="sanity-ebitda-sec-title">Side-by-side · week waterfall</div>';
  h+='<div class="ebitda-compare-grid cols-'+Math.min(items.length,3)+'">';
  items.forEach(function(it){
    var wf=it.weekWf;
    h+='<div class="ebitda-compare-col">';
    h+='<div class="ebitda-compare-col-hd">'+_escHtml(it.venue)+'</div>';
    if(!wf){
      h+='<div class="sanity-ebitda-empty">No daily sales this week.</div>';
    } else {
      h+='<div class="ebitda-compare-kpis">'
        +'<div><span>Sales</span><b>'+_flashMoneyTxt(wf.sales)+'</b></div>'
        +'<div><span>Live Ent</span><b class="vip-cost">'+_flashMoneyTxt(wf.liveEnt)+'</b></div>'
        +'<div><span>EBITDA</span><b class="'+(wf.ebitda>=0?'beat':'miss')+'">'+_flashMoneyTxt(wf.ebitda)+'</b></div>'
        +'<div><span>EBITDA %</span><b>'+_flashEbitdaPct(wf.ebitda, wf.sales)+'</b></div>'
        +'</div>';
      h+='<div class="tbl-wrap">'+_flashEbitdaWaterfallTableHtml(wf, it.venue)+'</div>';
    }
    h+='</div>';
  });
  h+='</div></div>';
  return h;
}
function _flashSanityDayParts(venue, day){
  if(!day || !(day.total>0)) return '\u2014';
  if(venue==='MILA Lounge'){
    return 'P1 '+_flashMoneyTxt(day.part1||0)+' \u00b7 P2 '+_flashMoneyTxt(day.part2||0)+' \u00b7 P3 '+_flashMoneyTxt(day.part3||0);
  }
  return 'L '+_flashMoneyTxt(day.lunch||0)+' \u00b7 D '+_flashMoneyTxt(day.dinner||0);
}

/** EBITDA Access — dedicated page with full EBIDTA 2 waterfall per show. */
function renderEbitdaAccess(){
  var el=document.getElementById('ebitdaBody');
  if(!el) return;
  var unlocked=(typeof _sanityEbitdaUnlocked==='function')&&_sanityEbitdaUnlocked();
  var h='';

  if(!unlocked){
    h+='<div class="sanity-ebitda-block">'
      +'<div class="sanity-ebitda-hd"><div><div class="sanity-ebitda-title">EBITDA Access</div>'
      +'<div class="sanity-ebitda-sub">Password required · full Sales → EBITDA waterfall per DJ day</div></div>'
      +'<button type="button" class="sanity-ebitda-btn" onclick="openEbitdaAccess()">Unlock</button></div>'
      +'<div class="sanity-ebitda-locked">Enter the EBITDA Access password to view the complete P&amp;L build (same as Sanity).</div>'
      +'</div>';
    el.innerHTML=h;
    return;
  }

  var ov=window.FLASH_PL_OVERLAY||{};
  var salesOv=ov.sales||{};
  var pack=(typeof _vipCollectFlashVenues==='function')?_vipCollectFlashVenues(0):null;
  var weekLbl=(pack&&pack.venues&&pack.venues[0])?pack.venues[0].weekOf:'Last week';
  var sel=_ebitdaAccessGetSel();

  h+='<div class="sanity-ebitda-block">'
    +'<div class="sanity-ebitda-hd">'
    +'<div><div class="sanity-ebitda-title">How we get to EBITDA</div>'
    +'<div class="sanity-ebitda-sub">EBIDTA 2 workbook structure · '+_escHtml(weekLbl)+'</div></div>'
    +'<button type="button" class="sanity-ebitda-btn sanity-ebitda-btn-muted" onclick="lockEbitdaAccess()">Lock</button>'
    +'</div>';
  h+='<div class="sanity-ebitda-kpi-row">'
    +'<div class="sanity-ebitda-kpi"><span>RDG Sales</span><b>'+(salesOv.week?'Week '+salesOv.week+' · '+(_escHtml(salesOv.period||'')):'Upload Sales')+'</b></div>'
    +'<div class="sanity-ebitda-kpi"><span>Variables</span><b>Daily Sales + DJ Cost</b></div>'
    +'<div class="sanity-ebitda-kpi"><span>Fixed OPEX</span><b>OPEX DATA 2</b></div>'
    +'</div></div>';

  h+=_ebitdaAccessVenuePillsHtml(sel);

  if(!sel.length){
    h+='<div class="sanity-ebitda-empty">Pick at least one location above.</div>';
    el.innerHTML=h;
    return;
  }

  if(!pack||!pack.venues||!pack.venues.length){
    h+='<div class="sanity-ebitda-empty">No flash week performances to model.</div>';
    el.innerHTML=h;
    return;
  }

  var venueData=[];
  sel.forEach(function(vn){
    var d=_ebitdaAccessVenuePack(pack, vn);
    if(d && d.shows && d.shows.length) venueData.push(_ebitdaAccessBuildVenueData(d));
  });

  if(!venueData.length){
    h+='<div class="sanity-ebitda-empty">No shows for selected location(s) this week.</div>';
    el.innerHTML=h;
    return;
  }

  if(venueData.length>=1) h+=_ebitdaAccessWeekGridHtml(venueData, weekLbl);
  if(venueData.length>=2) h+=_ebitdaAccessCompareSummaryHtml(venueData);

  venueData.forEach(function(vd){
    h+='<div class="ebitda-venue-block">';
    h+='<div class="ebitda-venue-hd">'+_escHtml(vd.venue)+'</div>';
    h+='<div class="ebitda-venue-meta">Source: <b>'+_flashEbitdaSourceSheet(vd.venue)+'</b> · Model: <b>'+_flashEbitdaModelFile(vd.venue)+'</b></div>';

    vd.shows.forEach(function(row){
      h+='<div class="ebitda-show-card">';
      h+='<div class="ebitda-show-hd"><b>'+_escHtml(row.sh.dj||'TBD')+'</b> · '+_escHtml((row.sh.label||row.sh.date||'').replace(/,.*$/,''))+'</div>';
      if(!row.wf){
        h+='<div class="sanity-ebitda-empty">No daily sales for '+_escHtml(row.sh.date||'')+' — upload RDG Sales.</div>';
      } else {
        h+='<div class="ebitda-show-meta">Day sales: <b>'+_flashMoneyTxt(row.sales)+'</b> ('+_flashSanityDayParts(vd.venue, row.day)+') · DJ Cost: <b class="vip-cost">'+_flashMoneyTxt(row.fee)+'</b></div>';
        h+='<div class="tbl-wrap">'+_flashEbitdaWaterfallTableHtml(row.wf, vd.venue)+'</div>';
      }
      h+='</div>';
    });

    if(vd.weekWf){
      h+='<div class="ebitda-show-card ebitda-week-total">';
      h+='<div class="ebitda-show-hd">Week total · '+_escHtml(vd.venue)+'</div>';
      h+='<div class="tbl-wrap">'+_flashEbitdaWaterfallTableHtml(vd.weekWf, vd.venue)+'</div>';
      h+='</div>';
    }
    h+='</div>';
  });

  h+='<div class="sanity-ebitda-foot sanity-ebitda-sec">Performance Summary uses the <b>EBITDA</b> line from each show waterfall. Re-upload <b>RDG Sales</b> to refresh daily sales.</div>';
  el.innerHTML=h;
}

function _renderSanityEbitdaAccess(){ return renderEbitdaAccess(); }

function _flashParseLiveWorkbook(wb, fileName){
  var venues={};
  var weeksFound=[];
  var dateRange='';
  Object.keys(_FLASH_PL_VENUE_MAP.liveSheets).forEach(function(sheetName){
    var venue=_FLASH_PL_VENUE_MAP.liveSheets[sheetName];
    var rows=_flashSheetRows(wb, sheetName);
    if(!rows || !rows.length) return;
    if(!dateRange && rows[1] && rows[1][0]) dateRange=String(rows[1][0]);
    var headerRow=-1, weekCols={};
    var i, c, r;
    for(i=0;i<Math.min(rows.length,10);i++){
      r=rows[i]||[];
      var hits=0;
      for(c=0;c<r.length;c++){
        var m=r[c]!=null && String(r[c]).match(/Week\s+(\d+)/i);
        if(m){
          weekCols[+m[1]]=c;
          hits++;
          if(weeksFound.indexOf(+m[1])<0) weeksFound.push(+m[1]);
        }
      }
      if(hits>=2){ headerRow=i; break; }
    }
    if(headerRow<0) return;
    var liveRow=-1;
    for(i=0;i<rows.length;i++){
      var a=rows[i]&&rows[i][0];
      if(a!=null && /6750/.test(String(a)) && /Live\s*Entertain/i.test(String(a))){
        liveRow=i; break;
      }
    }
    if(liveRow<0) return;
    var byWeek={};
    Object.keys(weekCols).forEach(function(wk){
      var col=weekCols[wk];
      var val=_flashNum(rows[liveRow][col]);
      if(val!=null) byWeek[String(wk)]=val;
    });
    venues[venue]={ byWeek:byWeek };
  });
  weeksFound.sort(function(a,b){ return a-b; });
  return {
    uploadedAt:new Date().toISOString(),
    fileName:fileName||'',
    dateRange:dateRange,
    weeks:weeksFound,
    venues:venues
  };
}

function _flashSumLiveForPeriods(byWeek, periodNums){
  if(!byWeek) return null;
  var set={};
  (periodNums||[]).forEach(function(p){ set[p]=1; });
  var sum=0, n=0;
  Object.keys(byWeek).forEach(function(wk){
    var p=_flashWeekToPeriodNum(+wk);
    if(p && set[p]){ sum+=(+byWeek[wk]||0); n++; }
  });
  return n?sum:null;
}
function _flashLiveBudgetSum(venue, year, fromMi, toMi){
  if(typeof getBgtPlan!=='function') return null;
  var sum=0, n=0;
  for(var mi=fromMi; mi<=toMi; mi++){
    var mm=(typeof fiscalMm==='function')?fiscalMm(mi):((mi+1)<10?'0'+(mi+1):String(mi+1));
    var v=getBgtPlan(venue, String(year), mm, 'live');
    if(v!=null){ sum+=+v; n++; }
  }
  return n?sum:null;
}
/** Sales / live $ budgets from the Budget page (BGT_PLAN) — not from Excel. */
function _flashSalesBudgetSum(venue, year, fromMi, toMi){
  if(typeof getBgtPlan!=='function') return null;
  var sum=0, n=0;
  for(var mi=fromMi; mi<=toMi; mi++){
    var mm=(typeof fiscalMm==='function')?fiscalMm(mi):((mi+1)<10?'0'+(mi+1):String(mi+1));
    var v=getBgtPlan(venue, String(year), mm, 'sales');
    if(v!=null){ sum+=+v; n++; }
  }
  return n?sum:null;
}

function handleFlashPlUpload(kind, inputEl){
  var file=inputEl && inputEl.files && inputEl.files[0];
  if(!file) return;
  if(typeof XLSX==='undefined'){
    alert('Excel reader not loaded. Refresh and try again.');
    inputEl.value='';
    return;
  }
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var data=new Uint8Array(ev.target.result);
      var wb=XLSX.read(data, {type:'array'});
      if(kind==='sales'){
        var sales=_flashParseSalesWorkbook(wb, file.name);
        if(!sales || !Object.keys(sales.venues||{}).length){
          alert('Could not find Sales totals for Casa Neos / Lounge / MILA 2F in that file.');
          return;
        }
        window.FLASH_PL_OVERLAY.sales=sales;
      } else {
        var live=_flashParseLiveWorkbook(wb, file.name);
        if(!live || !Object.keys(live.venues||{}).length){
          alert('Could not find Live Entertainment (GL 6750) for those venues in that file.');
          return;
        }
        window.FLASH_PL_OVERLAY.live=live;
      }
      _flashPlPersist();
      if(typeof renderVIP==='function') renderVIP();
      if(typeof renderEbitdaAccess==='function' && typeof curView!=='undefined' && curView==='ebitda') renderEbitdaAccess();
    }catch(err){
      console.error('Flash PL upload failed', err);
      alert('Could not read that Excel file.');
    } finally {
      try{ inputEl.value=''; }catch(e2){}
    }
  };
  reader.readAsArrayBuffer(file);
}

function _flashPlStatusChipHtml(){
  var ov=window.FLASH_PL_OVERLAY||{};
  var sales=ov.sales, live=ov.live;
  var parts=[];
  if(sales) parts.push('Sales · Wk '+(sales.week||'?')+' '+(sales.period||''));
  else parts.push('Sales · missing');
  if(live){
    var lastWk=(live.weeks&&live.weeks.length)?live.weeks[live.weeks.length-1]:'?';
    parts.push('Live Ent · through Wk '+lastWk);
  } else parts.push('Live Ent · missing');
  return '<span id="flashPlStatus" class="flash-pl-status" title="'+(sales&&sales.fileName?sales.fileName:'')+' / '+(live&&live.fileName?live.fileName:'')+'">'+parts.join(' · ')+'</span>';
}

function _flashMoneyTxt(v){
  if(v==null) return '\u2014';
  return (typeof $k==='function')?$k(v):String(Math.round(v));
}
function _flashPctTxt(v){
  return v!=null?(v+'%'):'\u2014';
}
function _flashWeeksElapsedInPeriod(periodNum, throughWeek){
  var weeks=(typeof FISCAL_WEEKS_445!=='undefined')?FISCAL_WEEKS_445:[4,4,5,4,4,5,4,4,5,4,4,5];
  var start=1, p;
  for(p=1;p<=12;p++){
    var end=start+weeks[p-1]-1;
    if(p===periodNum){
      if(throughWeek==null) return weeks[p-1];
      if(throughWeek<start) return 0;
      return Math.max(0, Math.min(throughWeek, end)-start+1);
    }
    start=end+1;
  }
  return 0;
}
function _flashSumByWeekMap(byWeek, periodNum, throughWeek){
  if(!byWeek) return null;
  var sum=0, n=0;
  Object.keys(byWeek).forEach(function(wk){
    var w=+wk;
    var p=_flashWeekToPeriodNum(w);
    if(p!==periodNum) return;
    if(throughWeek!=null && w>throughWeek) return;
    var v=+byWeek[wk];
    if(isFinite(v)){ sum+=v; n++; }
  });
  return n?sum:null;
}
function _flashPyMonthVals(venue, year, monthIndex0, throughWeek){
  var mm=(typeof fiscalMm==='function')?fiscalMm(monthIndex0):((monthIndex0+1)<10?'0'+(monthIndex0+1):String(monthIndex0+1));
  var pyYear=String((+year||2026)-1);
  var periodNum=monthIndex0+1;
  var sales=null, live=null, source='month';

  /* 1) Baked / uploaded weekly PY (preferred — same week numbers, 4-4-5). */
  var baked=(typeof window.FLASH_PY_2025!=='undefined' && window.FLASH_PY_2025)||null;
  var bakedV=baked&&baked.venues&&baked.venues[venue];
  /* Casa Neos Lounge was closed prior year — no PY Sales / Live. */
  if(venue==='Casa Neos Lounge' || (bakedV&&bakedV.closedPriorYear)){
    var feeClosed=null;
    if(typeof monthPerf==='function'){
      var mpC=monthPerf(venue, pyYear, mm);
      feeClosed=mpC&&mpC.tFee!=null?mpC.tFee:null;
    }
    return {
      year:pyYear, sales:null, live:null, margin:null, fee:feeClosed,
      source:'closed', bgtPeriod:null, closedPriorYear:true
    };
  }
  var ov=window.FLASH_PL_OVERLAY||{};
  var pyV=ov.py&&ov.py.venues&&ov.py.venues[venue];
  var weekMapSales=(pyV&&pyV.salesByWeek)||(bakedV&&bakedV.salesByWeek);
  var weekMapLive=(pyV&&pyV.liveByWeek)||(bakedV&&bakedV.liveByWeek);
  if(weekMapSales||weekMapLive){
    sales=_flashSumByWeekMap(weekMapSales, periodNum, throughWeek);
    live=_flashSumByWeekMap(weekMapLive, periodNum, throughWeek);
    source='weekly';
  }

  /* 2) Fall back to Budget-page full-month P&L actuals. */
  if(sales==null && typeof getBgtActual==='function') sales=getBgtActual(venue, pyYear, mm, 'sales');
  if(live==null && typeof getBgtActual==='function') live=getBgtActual(venue, pyYear, mm, 'live');

  var fee=null;
  if(typeof monthPerf==='function'){
    var mp=monthPerf(venue, pyYear, mm);
    fee=mp&&mp.tFee!=null?mp.tFee:null;
  }

  /* 2025 period budgets kept for Sanity / reference — Target uses 2026 Budget page / Sales Excel. */
  var bgtPeriod=null;
  var bgtRoot=(ov.budget2025&&ov.budget2025[venue])||(baked&&baked.budget2025&&baked.budget2025[venue]);
  if(bgtRoot&&bgtRoot.byPeriod&&bgtRoot.byPeriod[String(periodNum)]){
    bgtPeriod=bgtRoot.byPeriod[String(periodNum)];
  }

  return {
    year:pyYear,
    sales:sales,
    live:live,
    margin:(typeof pctLive==='function')?pctLive(sales, live):null,
    fee:fee,
    source:source,
    bgtPeriod:bgtPeriod
  };
}
/**
 * Actual vs Target (yellow chip) vs Prior Year (grey chip).
 * Only vs Target / vs PY variance rows get green/red fill — not the whole cell.
 * Money modes show $ and % vs base; margin shows pp.
 * mode: sales (higher good) | live|fee (under good) | margin (lower % good)
 * opts.closedPriorYear → PY row shows "closed LY" (no Sales/Live last year).
 */
function _flashPctOfBase(delta, base){
  if(delta==null || base==null || !base) return null;
  return Math.round((delta/Math.abs(base))*1000)/10;
}
function _flashPctSuffix(pct){
  if(pct==null) return '';
  return ' ('+(pct>0?'+':'')+pct+'%)';
}
function _vipFlashPlCompareCell(actual, target, py, mode, pyYear, opts){
  opts=opts||{};
  var isPct=mode==='margin';
  var underGood=(mode==='live'||mode==='fee'||mode==='margin');
  var closed=!!opts.closedPriorYear;
  var vsT=null, vsP=null;
  if(actual!=null && target!=null) vsT=actual-target;
  if(!closed && actual!=null && py!=null) vsP=actual-py;
  var favT=vsT==null?null:(underGood?vsT<=0:vsT>=0);
  var favP=vsP==null?null:(underGood?vsP<=0:vsP>=0);
  function varLine(delta, fav, label, baseForPct){
    if(delta==null) return '<div class="flash-pl-cmp-var muted">'+label+' \u2014</div>';
    var txt;
    if(isPct) txt=(delta>0?'+':'')+Math.round(delta*10)/10+' pp';
    else if(underGood){
      txt=(delta<=0?'Under ':'Over ')+_flashMoneyTxt(Math.abs(delta));
      if(baseForPct!=null) txt+=_flashPctSuffix(_flashPctOfBase(delta, baseForPct));
    } else {
      txt=(typeof $mv==='function'?$mv(delta):((delta>0?'+':'')+delta));
      if(baseForPct!=null) txt+=_flashPctSuffix(_flashPctOfBase(delta, baseForPct));
    }
    var fill=fav?' flash-pl-var-good':' flash-pl-var-bad';
    return '<div class="flash-pl-cmp-var'+fill+'">'+label+' '+txt+'</div>';
  }
  var actTxt=isPct?_flashPctTxt(actual):_flashMoneyTxt(actual);
  var tgtTxt=isPct?_flashPctTxt(target):_flashMoneyTxt(target);
  var pyTxt=closed?'closed LY':(isPct?_flashPctTxt(py):_flashMoneyTxt(py));
  var pyLbl='PY '+(pyYear||'');
  return '<div class="bgt-monthly-cell flash-pl-cell flash-pl-cmp bgt-status-neutral">'
    +'<div class="bgt-monthly-value">'+actTxt+'</div>'
    +'<div class="flash-pl-cmp-row flash-pl-cmp-target"><span>Target</span><b>'+tgtTxt+'</b></div>'
    +varLine(vsT, favT, 'vs Target', target)
    +'<div class="flash-pl-cmp-row flash-pl-cmp-py"><span>'+pyLbl+'</span><b>'+pyTxt+'</b></div>'
    +varLine(vsP, favP, 'vs PY', py)
    +'</div>';
}
function _vipFlashPlRoiCell(roi){
  var measured=roi&&roi.measured;
  var good=measured && roi.misses===0;
  var misses=measured?(roi.measured-roi.beats):0;
  if(roi && roi.misses!=null) misses=roi.misses;
  else if(measured) misses=roi.measured-roi.beats;
  return '<div class="bgt-monthly-cell flash-pl-cell bgt-status-neutral">'
    +'<div class="bgt-monthly-value">'+(measured?(roi.beats+' / '+misses):'\u2014')+'</div>'
    +'<div class="bgt-monthly-vs">beat / miss</div>'
    +'<div class="bgt-monthly-var '+(!measured?'':(good?'pos':'neg'))+'">'+(measured&&roi.pct!=null?(roi.pct+'% beat rate'):'\u2014')+'</div></div>';
}
/** EBITDA amount for Performance Summary cells. Green if >= 0, red if negative. */
function _vipEbitdaTxt(amount){
  var v=(amount==null)?0:+amount;
  return (typeof $k==='function')?$k(v):('$'+Math.round(v).toLocaleString());
}
function _flashUpcomingInPeriod(venue, year, monthIndex0, afterDate){
  var list=[];
  if(typeof SCHED==='undefined' || typeof dateInFiscalPeriod!=='function') return list;
  SCHED.forEach(function(r){
    if(!r||r._s==='empty') return;
    if((r.v||r.venue)!==venue) return;
    if(!r.d || !dateInFiscalPeriod(r.d, year, monthIndex0)) return;
    if(afterDate && r.d<=afterDate) return;
    list.push({
      date:r.d,
      dj:r.dj||r.artist||'TBD',
      fee:+(r.fee||r.cost||0)||0
    });
  });
  list.sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); });
  return list;
}
function _vipFlashPlUpcomingListHtml(upcoming){
  if(!upcoming||!upcoming.length){
    return '<div class="flash-pl-up-empty">No upcoming performances this period</div>';
  }
  var h='<div class="flash-pl-up-list"><table class="flash-pl-up-tbl"><thead><tr>'
    +'<th class="l">Date</th><th class="l">Name</th><th>DJ Fee</th>'
    +'</tr></thead><tbody>';
  upcoming.forEach(function(u){
    h+='<tr>'
      +'<td class="l">'+String(u.date||'')+'</td>'
      +'<td class="l"><b>'+(u.dj||'TBD')+'</b></td>'
      +'<td class="vip-cost">'+(u.fee?_flashMoneyTxt(u.fee):'\u2014')+'</td>'
      +'</tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

function _vipRenderFlashPlForVenue(venue, asOfDate){
  if(_FLASH_PL_ORDER.indexOf(venue)<0) return '';
  var ov=window.FLASH_PL_OVERLAY||{};
  var sales=ov.sales, live=ov.live;
  var info=(typeof fiscalInfoForDate==='function')
    ? fiscalInfoForDate(asOfDate||(typeof TODAY!=='undefined'?TODAY:''))
    : {year:2026, monthIndex:7};
  var periodNum=(sales&&sales.periodNum)||(info.monthIndex+1);
  var year=(sales&&sales.year)||info.year||2026;
  var monthIndex0=periodNum-1;
  var periodListMtd=[periodNum];

  var sv=(sales&&sales.venues&&sales.venues[venue])||{};
  var lv=(live&&live.venues&&live.venues[venue])||{};
  var throughWeek=(sales&&sales.week)||null;
  /* Live MTD = same weeks as Sales (period through flash week). */
  var liveMtd=_flashSumByWeekMap(lv.byWeek, periodNum, throughWeek);
  if(liveMtd==null) liveMtd=_flashSumLiveForPeriods(lv.byWeek, periodListMtd);

  /* 2026 Target: prefer Sales Excel Budget sheet MTD; else Budget page prorated. */
  var salesFullB=_flashSalesBudgetSum(venue, year, monthIndex0, monthIndex0);
  var liveFullB=_flashLiveBudgetSum(venue, year, monthIndex0, monthIndex0);
  var py=_flashPyMonthVals(venue, year, monthIndex0, throughWeek);
  var elapsed=_flashWeeksElapsedInPeriod(periodNum, throughWeek);
  var weeksInP=((typeof FISCAL_WEEKS_445!=='undefined')?FISCAL_WEEKS_445:[4,4,5,4,4,5,4,4,5,4,4,5])[monthIndex0]||4;
  var salesMtdB=(sv.salesMtdB!=null)?sv.salesMtdB:salesFullB;
  var liveMtdB=liveFullB;
  if(sv.salesMtdB==null && elapsed>0 && weeksInP>0 && salesFullB!=null){
    salesMtdB=salesFullB*(elapsed/weeksInP);
  }
  if(elapsed>0 && weeksInP>0 && liveFullB!=null){
    liveMtdB=liveFullB*(elapsed/weeksInP);
  }
  var marginMtdA=(typeof pctLive==='function')?pctLive(sv.salesMtdA, liveMtd):null;
  var marginSalesB=(sv.salesMtdB!=null)?sv.salesMtdB:salesFullB;
  var marginLiveB=liveFullB;
  var marginMtdB=(typeof pctLive==='function')?pctLive(marginSalesB, marginLiveB):null;

  var cutDate=asOfDate||String(TODAY||'');
  var monthRoi=(typeof _vipRoiCompletionStats==='function')
    ? _vipRoiCompletionStats(venue, year, monthIndex0, cutDate)
    : {beats:0,measured:0,pct:null};
  if(monthRoi && monthRoi.measured!=null){
    monthRoi.misses=Math.max(0,(monthRoi.measured||0)-(monthRoi.beats||0));
  }

  var feeSt=(typeof _vipMonthStandingStats==='function')
    ? _vipMonthStandingStats(venue, year, monthIndex0, cutDate)
    : {feeDone:null,feeRemain:null,feeProj:null,monthBgt:null,nRemain:0};
  var upcoming=_flashUpcomingInPeriod(venue, year, monthIndex0, cutDate);

  var needSales=!sales;
  var needLive=!live;
  var periodLbl=_flashPeriodLabel(periodNum);
  var pyClosed=!!py.closedPriorYear;
  var pyNote=pyClosed
    ?('PY '+py.year+' · closed (no Sales/Live)')
    :(py.source==='weekly'
      ?('PY '+py.year+' weekly')
      :('PY '+py.year+' full month'));
  var cmpOpts={closedPriorYear:pyClosed};
  var h='<div class="flash-pl-venue flash-pl-under-perf">';
  if(needSales || needLive){
    h+='<div class="flash-pl-need-upload">'+year+' Actuals need Excel upload. Targets are '+year+' Budget. Upload '
      +(needSales?'<b>Sales Excel</b>':'')
      +(needSales&&needLive?' and ':'')
      +(needLive?'<b>Live Ent Excel</b>':'')
      +' (green buttons above).</div>';
  }
  h+='<div class="flash-pl-split">';

  /* ---- Left: 2026 Actual vs 2026 Target vs PY ---- */
  h+='<div class="bgt-monthly flash-pl-monthly flash-pl-mtd-panel">';
  h+='<div class="bgt-monthly-hd">Sales &amp; Live Entertainment<span>'+periodLbl+' MTD'
    +(sales&&sales.week?(' · Week '+sales.week):'')
    +' · '+year+' Actual · '+pyNote+'</span></div>';
  h+='<div class="bgt-monthly-grid flash-pl-grid flash-pl-grid-mtd">';
  h+='<div class="bgt-monthly-cell bgt-monthly-month"></div>';
  h+='<div class="bgt-monthly-cell bgt-monthly-month">'+year+' Actual vs Target vs PY</div>';
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>Total Sales</b><span>'+year+' actual · '+year+' target · PY</span></div>';
  h+=_vipFlashPlCompareCell(sv.salesMtdA, salesMtdB, py.sales, 'sales', py.year, cmpOpts);
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>Live Entertainment</b><span>GL 6750 · '+year+' target · PY</span></div>';
  h+=_vipFlashPlCompareCell(liveMtd, liveMtdB, py.live, 'live', py.year, cmpOpts);
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>Live E Margin</b><span>Live \u00f7 Sales % · '+year+' target · PY</span></div>';
  h+=_vipFlashPlCompareCell(marginMtdA, marginMtdB, py.margin, 'margin', py.year, cmpOpts);
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>ROI Beat &amp; Miss</b><span>Same rule as Calendar</span></div>';
  h+=_vipFlashPlRoiCell(monthRoi);
  h+='</div></div>';

  /* ---- Right: DJ fees vs budget/PY + upcoming only ---- */
  h+='<div class="bgt-monthly flash-pl-monthly flash-pl-side-panel">';
  h+='<div class="bgt-monthly-hd">Fees &amp; Outlook<span>'+periodLbl+' month · '+pyNote+'</span></div>';
  h+='<div class="bgt-monthly-grid flash-pl-grid flash-pl-grid-side">';
  h+='<div class="bgt-monthly-cell bgt-monthly-month"></div>';
  h+='<div class="bgt-monthly-cell bgt-monthly-month">'+year+' A+F vs Target vs PY</div>';
  h+='<div class="bgt-monthly-cell bgt-monthly-label"><b>DJ Fees</b><span>Full month A+F · '+year+' budget · PY</span></div>';
  h+=_vipFlashPlCompareCell(feeSt.feeProj, feeSt.monthBgt, py.fee, 'fee', py.year, null);
  h+='</div>';
  h+='<div class="flash-pl-up-wrap"><div class="flash-pl-up-hd">Upcoming performances</div>';
  h+=_vipFlashPlUpcomingListHtml(upcoming);
  h+='</div></div>';

  h+='</div></div>';
  return h;
}

