/* Venue ROI Rules — full-page editor (standard tiers + special-day performances) */

var _roiPageTab = 'summary'; /* summary | rules | special | floors */
var _roiEditSpecialUid = null;
var _roiSpForceCustom = false;
var _roiSpPrefill = null;
var _roiDatePick = { venue: '', date: '', q: '' };
var _roiEditFloorUid = null;

function _roiSpResolveFee(ev){
  if(ev&&ev.djFee>0) return ev.djFee;
  if(ev&&ev.start&&ev.venue&&typeof SCHED!=='undefined'){
    var fee=0;
    SCHED.forEach(function(r){
      if(!r||r.d!==ev.start) return;
      if((r.v||r.venue)!==ev.venue) return;
      fee=r.fee||r.cost||0;
    });
    if(fee>0) return fee;
  }
  if(_roiSpPrefill&&_roiSpPrefill.djFee>0) return _roiSpPrefill.djFee;
  return 0;
}
function _roiSpFilterRulesForShow(rules, fee, dateStr, showDays){
  if(!rules||!fee||!rules.tiers||!rules.tiers.length) return rules;
  var tier=nearestTier(rules, fee);
  if(!tier) return rules;
  var out=JSON.parse(JSON.stringify(rules));
  out.tiers=[JSON.parse(JSON.stringify(tier))];
  /* Anchor this special to the show's DJ fee so ROI stays as entered (BS = fee × ROI). */
  out.tiers[0].fee=fee;
  if(showDays&&showDays.length){
    out.days=showDays.slice();
    out.days.sort(function(a,b){ return DOW_NAMES.indexOf(a)-DOW_NAMES.indexOf(b); });
  }
  out._matchedFee=fee;
  out._matchedTierFee=tier.fee;
  return out;
}

function _vrFmtMoney(n){
  if(n==null||n===''||isNaN(+n)) return '';
  return Math.round(+n).toLocaleString('en-US');
}
function _vrParseMoney(s){
  return parseFloat(String(s||'').replace(/[^0-9.-]/g,''))||0;
}
function _vrMoneyInputHtml(val, cls, attrs){
  cls=cls||'vr-cell-inp';
  attrs=attrs||'';
  return '<span class="vr-money-wrap"><span class="vr-money-sym">$</span>'
    +'<input type="text" inputmode="numeric" class="'+cls+' vr-money-inp" value="'+_vrFmtMoney(val)+'" '+attrs+'></span>';
}
function _vrFeeInputHtml(val, cls, attrs){
  return _vrMoneyInputHtml(val, (cls||'vr-fee-inp')+' vr-fee-inp', attrs);
}
function wireVenueRulesMoneyInputs(root){
  (root||document).querySelectorAll('.vr-money-inp').forEach(function(inp){
    if(inp._vrMoneyWired) return;
    inp._vrMoneyWired=true;
    inp.addEventListener('blur',function(){
      var n=_vrParseMoney(inp.value);
      var shown=n?_vrFmtMoney(n):'';
      if(inp.value!==shown) inp.value=shown;
      if(inp._vrFocusNum!=null && n===inp._vrFocusNum){
        if(typeof _roiPaintOpenCells==='function') _roiPaintOpenCells();
        return;
      }
      if(inp.getAttribute('data-action')==='table-field' && typeof updateTierTable==='function'){
        updateTierTable(window._vrEditVenue, parseInt(inp.dataset.ti,10), inp.dataset.season, inp.dataset.day, inp.dataset.cat, n);
      }else if(inp.getAttribute('data-action')==='day-field' && inp.dataset.field && typeof updateTierDay==='function'){
        updateTierDay(window._vrEditVenue, parseInt(inp.dataset.ti,10), inp.dataset.season, inp.dataset.day, inp.dataset.field, n);
      }
      if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
    });
    inp.addEventListener('focus',function(){
      var raw=_vrParseMoney(inp.value);
      inp._vrFocusNum=raw;
      var next=raw?String(raw):'';
      if(inp.value!==next){
        var atEnd=inp.selectionStart===inp.value.length;
        inp.value=next;
        if(atEnd){ try{ inp.setSelectionRange(next.length, next.length); }catch(eCaret){} }
      }
    });
    inp.addEventListener('input',function(){
      if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
    });
  });
  if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
}

function _roiFmtUsd(n){
  n=Math.round(+n||0);
  return '$'+n.toLocaleString('en-US');
}
function _roiTierHeaderHtml(tableCats, counts){
  var h='';
  (tableCats||[]).forEach(function(c){
    var n=typeof roiCountForCat==='function'?roiCountForCat(counts, c):0;
    h+='<th class="vr-th-tier vr-th-tier--count">'+_escRoi(c)
      +'<span class="vr-th-count">'+n+'</span>'
      +'<span class="vr-th-sub">tables · min $</span></th>';
  });
  return h;
}
/* Big inventory strip: total tables, per-tier chips, and where counts come from. */
function _roiTableInventoryHtml(rules, countsMeta, opts){
  countsMeta=countsMeta||{};
  var counts=countsMeta.counts||{};
  var cats=rules.tableCats||[];
  var total=countsMeta.total;
  if(total==null){
    total=0;
    cats.forEach(function(c){ total+=(typeof roiCountForCat==='function'?roiCountForCat(counts,c):0); });
  }
  var h='<div class="vr-inventory">';
  h+='<div class="vr-inventory-top">';
  h+='<div class="vr-inventory-total"><span class="vr-inventory-total-n">'+total+'</span><span class="vr-inventory-total-lbl">total tables</span></div>';
  h+='<div class="vr-inventory-chips">';
  cats.forEach(function(c){
    var n=typeof roiCountForCat==='function'?roiCountForCat(counts,c):0;
    h+='<div class="vr-inventory-chip"><span class="vr-inventory-chip-n">'+n+'</span><span class="vr-inventory-chip-lbl">'+_escRoi(c)+'</span></div>';
  });
  h+='</div></div>';
  if(opts&&opts.hideSource){ h+='</div>'; return h; }
  h+='<div class="vr-inventory-source">';
  h+='<div class="vr-inventory-source-hd">Where these numbers come from</div>';
  h+='<ul class="vr-inventory-source-list">';
  h+='<li><b>Floor plan:</b> '+_escRoi(countsMeta.badge||countsMeta.tableKey||'Default venue plan')+'</li>';
  if(countsMeta.tableKey) h+='<li><b>Inventory key:</b> <code>'+_escRoi(countsMeta.tableKey)+'</code> (3D table map in the app)</li>';
  h+='<li><b>Source:</b> '+_escRoi(countsMeta.source||'3D floor plan inventory (same counts as 3D View)')+'</li>';
  if(countsMeta.dateStr) h+='<li><b>Resolved for date:</b> '+_escRoi(countsMeta.dateStr)+' (auto plans switch by date)</li>';
  if(countsMeta.modelUrl) h+='<li><b>Model:</b> <code class="vr-inventory-url">'+_escRoi(countsMeta.modelUrl)+'</code></li>';
  h+='</ul>';
  if(countsMeta.byCat&&countsMeta.byCat.length){
    h+='<div class="vr-inventory-ids">';
    countsMeta.byCat.forEach(function(t){
      h+='<div class="vr-inventory-id-row"><b>'+_escRoi(t.name)+' ×'+t.n+':</b> '
        +_escRoi((t.ids||[]).join(', ')||'—')+'</div>';
    });
    h+='</div>';
  }
  h+='</div></div>';
  return h;
}
function _roiBsSetHeaderHtml(){
  return '<th class="vr-th-bsset" title="Tables × their minimum. Green BS SET means the total covers the BS Target, or is short by $1,000 or less. Red ACTUAL means it is short by more than $1,000.">BS Set / Actual</th>';
}
function _roiBsSetCellHtml(rules, counts, tier, ti, season, day){
  var dayData=(tier[season]||{})[day]||{roi:0,sales:0,tables:{}};
  var v=typeof roiVerifyCapacity==='function'
    ? roiVerifyCapacity(dayData.sales, dayData.tables, rules.tableCats||[], counts||{})
    : {sum:0,bs:+dayData.sales||0,hit:null};
  var stCls=v.hit===true?'vr-verify-hit':(v.hit===false?'vr-verify-miss':'vr-verify-na');
  var stLbl=v.hit===true?'BS SET':(v.hit===false?'ACTUAL':'—');
  return '<td class="vr-bsset '+stCls+'" data-verify-row data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'">'
    +'<span class="vr-bsset-amt">'+_roiFmtUsd(v.sum)+'</span>'
    +'<span class="vr-verify-pill">'+stLbl+'</span></td>';
}
function roiRefreshVerifyBlocks(root){
  root=root||document;
  var counts={};
  try{
    var metaEl=root.querySelector('[data-roi-counts]');
    if(metaEl) counts=JSON.parse(metaEl.getAttribute('data-roi-counts')||'{}');
  }catch(e){ counts={}; }
  root.querySelectorAll('[data-verify-row]').forEach(function(cell){
    var ti=cell.getAttribute('data-ti');
    var season=cell.getAttribute('data-season');
    var day=cell.getAttribute('data-day');
    var cats=[];
    try{
      var catsEl=root.querySelector('[data-roi-cats]');
      if(catsEl) cats=JSON.parse(catsEl.getAttribute('data-roi-cats')||'[]');
    }catch(e2){}
    var salesInp=root.querySelector('.vr-target-inp[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"], .roi-sp-sales[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"]');
    var bs=salesInp?_vrParseMoney(salesInp.value):0;
    var tables={};
    cats.forEach(function(c){
      var inp=root.querySelector('.vr-cell-sm[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"][data-cat="'+c+'"], .roi-sp-tbl[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"][data-cat="'+c+'"]');
      tables[c]=inp?_vrParseMoney(inp.value):0;
    });
    var v=typeof roiVerifyCapacity==='function'?roiVerifyCapacity(bs, tables, cats, counts):{sum:0,bs:bs,gap:bs,hit:null};
    var amt=cell.querySelector('.vr-bsset-amt');
    var st=cell.querySelector('.vr-verify-pill');
    if(amt) amt.textContent=_roiFmtUsd(v.sum);
    cell.classList.remove('vr-verify-hit','vr-verify-miss','vr-verify-na');
    if(v.hit===true){ cell.classList.add('vr-verify-hit'); if(st) st.textContent='BS SET'; }
    else if(v.hit===false){ cell.classList.add('vr-verify-miss'); if(st) st.textContent='ACTUAL'; }
    else { cell.classList.add('vr-verify-na'); if(st) st.textContent='—'; }
  });
}

function openVenueRulesEditor(){
  if(typeof setView==='function') setView('roi-rules');
}

function closeVenueRulesEditor(){ /* legacy modal hook — page replaces modal */ }

function _roiRulesScroller(){
  return document.getElementById('view-roi-rules')||document.scrollingElement;
}
/* A cell edit stays pending until the server copy matches it. A full rules
   write from another open dashboard cannot put the old number back. */
var ROI_CELL_QUEUE_KEY='rdg_roi_cell_queue';
function _roiSaveStatus(){ /* The number itself updates immediately, the same way a calendar edit does. */ }
function _roiSaveCellQueue(){
  try{ sessionStorage.setItem(ROI_CELL_QUEUE_KEY, JSON.stringify(window._roiCellPending||{})); }catch(e){}
}
function _roiLoadCellQueue(){
  /* Do not replay an old tab queue over the live server copy. */
  try{ sessionStorage.removeItem(ROI_CELL_QUEUE_KEY); }catch(e){}
}
function _roiFlushCell(path){
  var pending=window._roiCellPending||{};
  var rec=pending[path];
  if(!rec) return;
  if(!window._fbRef){
    clearTimeout(rec._wait);
    rec._wait=setTimeout(function(){ _roiFlushCell(path); }, 500);
    return;
  }
  if(rec._inflight) return;
  rec._inflight=true;
  var sent=rec.v;
  window._fbRef.child('venueRoiRules/'+path).set(sent, function(err){
    var cur=window._roiCellPending && window._roiCellPending[path];
    /* The live copy can confirm the number before this callback, and clears the queue. */
    if(!cur) return;
    cur._inflight=false;
    if(cur.v!==sent){ _roiFlushCell(path); return; }
    if(err){
      cur.tries=(cur.tries||0)+1;
      _roiSaveCellQueue();
      if(cur.tries<15) setTimeout(function(){ _roiFlushCell(path); }, Math.min(8000, 400*cur.tries));
      return;
    }
    cur.acked=true;
    _roiSaveCellQueue();
  });
}
function _roiRememberCell(path, n){
  if(!window._roiCellPending) window._roiCellPending={};
  window._roiCellPending[path]={v:n, t:Date.now(), tries:0, acked:false};
  _roiSaveCellQueue();
  _roiFlushCell(path);
}
function _roiReadPendingSlot(rules, parts){
  var rule=rules[parts[0]];
  var tiers=rule&&rule.tiers;
  var tier=tiers&&(tiers[+parts[2]]!=null?tiers[+parts[2]]:null);
  if(!tier) return {missing:true};
  var slot=tier[parts[3]]&&tier[parts[3]][parts[4]];
  if(!slot) return {missing:true, tier:tier};
  if(parts[5]==='tables') return {slot:slot, value:slot.tables?slot.tables[parts[6]]:undefined};
  return {slot:slot, value:slot[parts[5]]};
}
function _roiApplyPendingToRules(rules){
  var pending=window._roiCellPending;
  if(!rules||!pending) return {held:false, confirmed:false};
  var held=false, confirmed=false, now=Date.now();
  Object.keys(pending).forEach(function(path){
    var rec=pending[path];
    if(!rec){ delete pending[path]; return; }
    var parts=path.split('/');
    if(parts.length<6){ delete pending[path]; return; }
    var got=_roiReadPendingSlot(rules, parts);
    if(!got.missing && (+got.value||0)===(+rec.v||0)){
      delete pending[path];
      confirmed=true;
      return;
    }
    /* This write already reached the server. A different value is a newer edit and wins. */
    if(rec.acked){ delete pending[path]; return; }
    var rule=rules[parts[0]];
    var tier=rule&&rule.tiers&&rule.tiers[+parts[2]];
    if(!tier){ held=true; }
    else{
      if(!tier[parts[3]]) tier[parts[3]]={};
      if(!tier[parts[3]][parts[4]]) tier[parts[3]][parts[4]]={roi:0,sales:0,tables:{}};
      var slot=tier[parts[3]][parts[4]];
      if(parts[5]==='tables'){
        if(!slot.tables) slot.tables={};
        slot.tables[parts[6]]=rec.v;
      }else slot[parts[5]]=rec.v;
      held=true;
    }
    if(!rec._inflight && (!rec._pushedAt || now-rec._pushedAt>1500)){
      rec._pushedAt=now;
      _roiFlushCell(path);
    }
  });
  _roiSaveCellQueue();
  if(typeof _roiPaintOpenCells==='function') _roiPaintOpenCells();
  return {held:held, confirmed:confirmed};
}
/* Put the server number into every box the person is not typing in. */
function _roiPaintOpenCells(){
  var root=document.getElementById('vrBody');
  var venue=window._vrEditVenue;
  var rules=venue&&typeof VENUE_ROI_RULES!=='undefined'?VENUE_ROI_RULES[venue]:null;
  if(!root||!rules||!rules.tiers) return;
  root.querySelectorAll('[data-action="table-field"],[data-action="day-field"]').forEach(function(inp){
    if(document.activeElement===inp) return;
    var tier=rules.tiers[+inp.dataset.ti];
    if(!tier) return;
    var day=tier[inp.dataset.season]&&tier[inp.dataset.season][inp.dataset.day];
    if(!day) return;
    var n;
    if(inp.getAttribute('data-action')==='table-field') n=day.tables?day.tables[inp.dataset.cat]:null;
    else if(inp.dataset.field==='roi') n=day.roi;
    else n=day.sales;
    if(n==null||n==='') return;
    var shown=inp.dataset.field==='roi'?String(+n||0):(typeof _vrFmtMoney==='function'?_vrFmtMoney(n):String(n));
    if(inp.value!==shown) inp.value=shown;
  });
  if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
}
function _roiClone(o){
  try{ return JSON.parse(JSON.stringify(o==null?{}:o)); }catch(e){ return {}; }
}
function _roiTierList(tiers){
  if(!tiers) return [];
  if(Array.isArray(tiers)) return tiers.slice();
  return Object.keys(tiers).filter(function(k){ return String(+k)===String(k); }).sort(function(a,b){ return (+a)-(+b); }).map(function(k){ return tiers[k]; });
}
function _roiNum(v){ return +v||0; }
function _roiSame(a,b){ return _roiNum(a)===_roiNum(b); }
/* A missing local value is not an edit. Treating it as zero previously wiped real minimums. */
function _roiLocalChange(localVal, baseVal){
  if(localVal==null || localVal==='') return false;
  return _roiNum(localVal)!==_roiNum(baseVal);
}
function _roiPendingCell(path){
  return !!(window._roiCellPending && window._roiCellPending[path]);
}
/* Copy only the cells this browser actually changed onto the live server copy. */
function _roiMergeSavedRules(server, local, baseline){
  var out=_roiClone(server||{});
  var names={};
  Object.keys(local||{}).forEach(function(k){ names[k]=1; });
  Object.keys(baseline||{}).forEach(function(k){ names[k]=1; });
  Object.keys(names).forEach(function(v){
    var L=local?local[v]:null;
    var B=baseline?baseline[v]:null;
    if(!L){
      if(B) delete out[v];
      return;
    }
    if(!out[v]||typeof out[v]!=='object') out[v]=_roiClone(L);
    var S=out[v];
    var base=B||{};
    ['floorPlan','label','appliesTo','fromDate','toDate','tableCats','days','highSeasonMonths'].forEach(function(f){
      var lv=L[f]===undefined?null:L[f];
      var bv=base[f]===undefined?null:base[f];
      if(JSON.stringify(lv)!==JSON.stringify(bv)){
        if(L[f]===undefined) delete S[f];
        else S[f]=_roiClone(L[f]);
      }
    });
    var lt=_roiTierList(L.tiers);
    var bt=_roiTierList(base.tiers);
    var st=_roiTierList(S.tiers);
    var feeChanged=lt.length!==bt.length;
    var i;
    if(!feeChanged){
      for(i=0;i<lt.length;i++){
        if(_roiNum(lt[i]&&lt[i].fee)!==_roiNum(bt[i]&&bt[i].fee)) feeChanged=true;
      }
    }
    function applyCells(targetTiers, serverTiers){
      lt.forEach(function(localTier, ti){
        if(!targetTiers[ti]) targetTiers[ti]=_roiClone(localTier);
        var bTier=bt[ti]||{};
        var sTier=(serverTiers&&serverTiers[ti])||{};
        if(_roiNum(localTier.fee)!==_roiNum(bTier.fee)) targetTiers[ti].fee=_roiNum(localTier.fee);
        ['High','Low'].forEach(function(season){
          var lSeason=localTier[season]||{};
          var bSeason=bTier[season]||{};
          var sSeason=sTier[season]||{};
          if(!targetTiers[ti][season]) targetTiers[ti][season]={};
          var days={};
          Object.keys(lSeason).forEach(function(d){ days[d]=1; });
          Object.keys(bSeason).forEach(function(d){ days[d]=1; });
          Object.keys(sSeason).forEach(function(d){ days[d]=1; });
          Object.keys(days).forEach(function(day){
            var lDay=lSeason[day]||{};
            var bDay=bSeason[day]||{};
            var sDay=sSeason[day]||{};
            if(!targetTiers[ti][season][day]) targetTiers[ti][season][day]={roi:0,sales:0,tables:{}};
            var slot=targetTiers[ti][season][day];
            if(!slot.tables) slot.tables={};
            if(_roiLocalChange(lDay.roi, bDay.roi)) slot.roi=_roiNum(lDay.roi);
            else if(sDay.roi!=null) slot.roi=sDay.roi;
            if(_roiLocalChange(lDay.sales, bDay.sales)) slot.sales=_roiNum(lDay.sales);
            else if(sDay.sales!=null) slot.sales=sDay.sales;
            var cats={};
            Object.keys(lDay.tables||{}).forEach(function(c){ cats[c]=1; });
            Object.keys(bDay.tables||{}).forEach(function(c){ cats[c]=1; });
            Object.keys(sDay.tables||{}).forEach(function(c){ cats[c]=1; });
            Object.keys(cats).forEach(function(cat){
              var lv=(lDay.tables||{})[cat];
              var bv=(bDay.tables||{})[cat];
              var sv=(sDay.tables||{})[cat];
              var cellPath=v+'/tiers/'+ti+'/'+season+'/'+day+'/tables/'+cat;
              if(_roiLocalChange(lv, bv)){
                /* A positive minimum cannot be replaced by a silent zero. A typed zero still saves. */
                if(_roiNum(lv)===0 && _roiNum(sv)>0 && !_roiPendingCell(cellPath)) slot.tables[cat]=sv;
                else slot.tables[cat]=_roiNum(lv);
              }else if(sv!=null) slot.tables[cat]=sv;
            });
          });
        });
      });
    }
    if(feeChanged){
      var serverBefore=st;
      S.tiers=lt.map(function(t){ return _roiClone(t); });
      applyCells(S.tiers, serverBefore);
    }else{
      S.tiers=_roiTierList(S.tiers);
      applyCells(S.tiers, st);
    }
  });
  return out;
}
function _roiCommitRulesTree(){
  if(!window._fbRef || !window._roiRulesBaselineReady){
    clearTimeout(window._roiCommitWait);
    window._roiCommitWait=setTimeout(_roiCommitRulesTree, 400);
    return;
  }
  var local=_roiClone(VENUE_ROI_RULES);
  var baseline=_roiClone(window._roiRulesBaseline||{});
  window._fbRef.child('venueRoiRules').transaction(function(cur){
    return _roiMergeSavedRules(cur||{}, local, baseline);
  }, function(){}, false);
}
_roiLoadCellQueue();
function renderRoiRulesPage(){
  ensureCnbcSummerRoofRules();
  var root=document.getElementById('roiRulesBody');
  if(!root) return;
  var scroller=_roiRulesScroller();
  var keepScroll=scroller?scroller.scrollTop:0;

  var h='';
  h+='<div class="roi-page-hero">';
  h+='<div class="roi-page-hero-text">';
  h+='<h2>Venue ROI Rules</h2>';
  h+='<p>BS Target, ROI Target, VIP table minimums, and forecast table counts for Calendar, Budget, Forecast, Accounting, and 3D View.</p>';
  h+='<p class="roi-page-hint">Nearest fee tier applies when a DJ fee falls between anchors. BS Target stays fixed; ROI Target recalculates when the fee does not match the tier anchor.</p>';
  h+='</div></div>';

  h+='<div class="roi-subtabs">';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='summary'?' on':'')+'" onclick="setRoiPageTab(\'summary\')"><span class="roi-subtab-ic">&#9638;</span> Summary</button>';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='rules'?' on':'')+'" onclick="setRoiPageTab(\'rules\')"><span class="roi-subtab-ic">&#9881;</span> Standard venue rules</button>';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='special'?' on':'')+'" onclick="setRoiPageTab(\'special\')"><span class="roi-subtab-ic">&#9733;</span> Special performances</button>';
  h+='<button type="button" class="roi-subtab'+(_roiPageTab==='floors'?' on':'')+'" onclick="setRoiPageTab(\'floors\')"><span class="roi-subtab-ic">&#127760;</span> 3D Floor plans</button>';
  h+='</div>';

  if(_roiPageTab==='summary'){
    h+=renderRoiRulesSummary();
  }else if(_roiPageTab==='rules'){
    h+='<div id="vrTabs"></div>';
    h+='<div id="vrBody" class="roi-rules-body"></div>';
  }else if(_roiPageTab==='floors'){
    h+=renderRoiFloorPlansSection();
  }else{
    h+=renderRoiSpecialSection();
  }

  root.innerHTML=h;
  if(_roiPageTab==='rules'){
    if(!_vrEditVenue||!VENUE_ROI_RULES[_vrEditVenue]){
      var keys=Object.keys(VENUE_ROI_RULES);
      _vrEditVenue=keys[0];
    }
    renderVenueRulesPanel();
  }else if(_roiPageTab==='special'){
    wireRoiSpecialEvents();
  }
  if(scroller){
    scroller.scrollTop=keepScroll;
    requestAnimationFrame(function(){ if(scroller) scroller.scrollTop=keepScroll; });
  }
}

function setRoiPageTab(tab){
  _roiPageTab=tab;
  _roiEditSpecialUid=null;
  _roiEditFloorUid=null;
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  renderRoiRulesPage();
}

function _roiSummaryRuleKeys(){
  if(typeof ensureVenueRulesFloorPlanBindings==='function') ensureVenueRulesFloorPlanBindings();
  var keys=Object.keys(VENUE_ROI_RULES||{}).filter(function(v){
    return typeof roiRulesTabVisible==='function' ? roiRulesTabVisible(v) : true;
  });
  function rank(v){
    if(typeof CNBC_CURRENT_KEY!=='undefined'&&v===CNBC_CURRENT_KEY) return 1;
    if(typeof CNL_OCT_KEY!=='undefined'&&v===CNL_OCT_KEY) return 2;
    if(v==='MILA Lounge') return 3;
    return 20;
  }
  return keys.sort(function(a,b){ return rank(a)-rank(b)||a.localeCompare(b); });
}
function _roiSummaryMeta(key, rules){
  if(key==='Casa Neos Beach Club') return {name:'Casa Neos Beach Club', period:'Regular rules'};
  if(typeof CNBC_SUMMER_ROOF_KEY!=='undefined'&&key===CNBC_SUMMER_ROOF_KEY) return {name:'CNBC Summer Rooftop',period:'Aug 1 – Oct 4'};
  if(typeof CNBC_CURRENT_KEY!=='undefined'&&key===CNBC_CURRENT_KEY) return {name:'Casa Neos Beach Club',period:'Current waterfront'};
  if(typeof CNL_OCT_KEY!=='undefined'&&key===CNL_OCT_KEY) return {name:'CN Lounge',period:'Oct 1 floor'};
  if(key==='Casa Neos Lounge') return {name:'CN Lounge Classic',period:'Before Sep 25'};
  if(typeof CNL_REMODEL_KEY!=='undefined'&&key===CNL_REMODEL_KEY) return {name:'CN Lounge Remodel',period:'Sep 25 – Sep 30'};
  if(key==='MILA Lounge') return {name:'MILA Lounge',period:'Regular rules'};
  return {name:key,period:(rules&&rules.fromDate?rules.fromDate:'Custom rules')};
}
function _roiSummaryMoney(n){
  n=+n||0;
  if(Math.abs(n)>=1000){
    var k=n/1000;
    return '$'+(Math.round(k*10)/10).toLocaleString('en-US',{maximumFractionDigits:1})+'k';
  }
  return '$'+Math.round(n).toLocaleString('en-US');
}
function _roiSummaryCell(dayData){
  if(!dayData) return '<span class="roi-sum-na">—</span>';
  return '<b>'+_roiSummaryMoney(dayData.sales)+'</b><span>'+(+dayData.roi||0).toFixed(2).replace(/\.?0+$/,'')+'x</span>';
}
function renderRoiRulesSummary(){
  var keys=_roiSummaryRuleKeys();
  var h='<div class="roi-summary-toolbar">'
    +'<div><b>All venue targets at a glance</b><span> BS Target / ROI by DJ fee, season, and operating day</span></div>'
    +'<button type="button" class="btn-pdf" onclick="exportRoiRulesSummaryPdf()">Export one-page PDF</button>'
    +'</div>';
  h+='<div id="roiSummarySheet" class="roi-summary-sheet">';
  h+='<div class="roi-summary-print-head"><div><b>RDG Venue ROI Rules</b><span>BS Target / ROI Target by DJ fee tier</span></div>'
    +'<div>As of '+_escRoi((typeof miamiToday==='function'?miamiToday():'').replace(/-/g,' / '))+'</div></div>';
  h+='<div class="roi-summary-grid">';
  keys.forEach(function(key){
    var rules=VENUE_ROI_RULES[key];
    if(!rules||!rules.tiers||!rules.tiers.length) return;
    var meta=_roiSummaryMeta(key,rules);
    var days=(rules.days||[]).slice();
    var highMonths=(rules.highSeasonMonths||[]).map(function(m){return MONTH_NAMES_SHORT[m-1];}).join(', ');
    h+='<section class="roi-summary-card">';
    h+='<div class="roi-summary-card-hd"><div><b>'+_escRoi(meta.name)+'</b><span>'+_escRoi(meta.period)+'</span></div>'
      +'<small>High: '+_escRoi(highMonths||'none')+'</small></div>';
    h+='<table><thead><tr><th rowspan="2" class="roi-sum-fee-hd">DJ Fee</th><th colspan="'+days.length+'" class="roi-sum-high">High season</th><th colspan="'+days.length+'" class="roi-sum-low">Low season</th></tr><tr>';
    days.forEach(function(day){ h+='<th class="roi-sum-day roi-sum-day-high">'+_escRoi(day.slice(0,3))+'</th>'; });
    days.forEach(function(day,i){ h+='<th class="roi-sum-day roi-sum-day-low'+(i?'':' roi-sum-split')+'">'+_escRoi(day.slice(0,3))+'</th>'; });
    h+='</tr></thead><tbody>';
    rules.tiers.forEach(function(tier){
      h+='<tr><td class="roi-summary-fee">'+_roiSummaryMoney(tier.fee)+'</td>';
      days.forEach(function(day){ h+='<td class="roi-sum-cell-high">'+_roiSummaryCell((tier.High||{})[day])+'</td>'; });
      days.forEach(function(day,i){ h+='<td class="roi-sum-cell-low'+(i?'':' roi-sum-split')+'">'+_roiSummaryCell((tier.Low||{})[day])+'</td>'; });
      h+='</tr>';
    });
    h+='</tbody></table></section>';
  });
  h+='</div><div class="roi-summary-foot">Each target cell shows <b>BS Target</b> above <span>ROI Target</span>. Nearest DJ fee tier applies. Past performances retain their locked historical targets.</div>';
  h+='</div>';
  return h;
}
function exportRoiRulesSummaryPdf(){
  var sheet=document.getElementById('roiSummarySheet');
  if(!sheet){ alert('ROI Rules Summary is unavailable.'); return; }
  var btn=document.querySelector('.roi-summary-toolbar .btn-pdf');
  if(btn){ btn.disabled=true; btn.textContent='Preparing PDF…'; }
  function done(){ if(btn){ btn.disabled=false; btn.textContent='Export one-page PDF'; } }
  if(typeof _ensurePdfLibs!=='function'){
    done(); alert('PDF library unavailable. Hard-refresh and try again.'); return;
  }
  _ensurePdfLibs().then(function(){
    return (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){
      return window.html2canvas(sheet,{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff',windowWidth:1600});
    });
  }).then(function(canvas){
    var pdf=new window.jspdf.jsPDF({unit:'in',format:'letter',orientation:'landscape',compress:true});
    var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight(), margin=.2;
    var scale=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height);
    var w=canvas.width*scale, h=canvas.height*scale;
    pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',(pw-w)/2,(ph-h)/2,w,h,undefined,'FAST');
    pdf.save('RDG-Venue-ROI-Rules-Summary-'+(typeof miamiToday==='function'?miamiToday():'today')+'.pdf');
    done();
  }).catch(function(err){
    try{ console.warn('ROI Summary PDF failed',err); }catch(e){}
    done(); alert('Could not export the ROI Rules Summary PDF. Please try again.');
  });
}

function _roiSpeUid(){
  return 'spe_'+Math.random().toString(36).slice(2,8)+'_'+Date.now().toString(36).slice(-4);
}

function _roiSpeList(){
  return Object.keys(ROI_SPECIAL_EVENTS||{}).map(function(uid){
    var ev=ROI_SPECIAL_EVENTS[uid];
    if(!ev) return null;
    return Object.assign({_uid:uid}, ev);
  }).filter(Boolean).sort(function(a,b){
    return (a.start||'').localeCompare(b.start||'');
  });
}

function _roiRulesTemplateOptions(selected){
  if(typeof ensureVenueRulesFloorPlanBindings==='function') ensureVenueRulesFloorPlanBindings();
  else if(typeof ensureCnbcSummerRoofRules==='function') ensureCnbcSummerRoofRules();
  var opts=[
    {v:CNBC_CURRENT_KEY, l:'Casa Neos Beach Club'},
    {v:CNL_OCT_KEY, l:'CN Lounge'},
    {v:'MILA Lounge', l:'MILA Lounge'},
    {v:'__custom__', l:'Custom (clone & edit tiers below)'}
  ];
  if(selected && !opts.some(function(o){ return o.v===selected; })){
    opts.unshift({v:selected, l:selected});
  }
  return opts.map(function(o){
    return '<option value="'+o.v+'"'+(selected===o.v?' selected':'')+'>'+o.l+'</option>';
  }).join('');
}

function renderRoiSpecialSection(){
  var h='';
  h+='<div class="roi-special-intro">';
  h+='<p>Choose the <b>location</b> and the <b>date</b>, then set the special ROI rules for that performance.</p>';
  h+='</div>';

  h+=renderRoiDateAssignBar();

  h+=renderRoiSpecialUpcoming();

  var list=_roiSpeListFiltered();
  h+='<div class="roi-special-list">';
  h+='<div class="roi-section-title">Saved specials'+(list.length?' <span class="roi-page-hint" style="font-weight:600">('+list.length+')</span>':'')+'</div>';
  if(!list.length){
    h+='<div class="roi-empty">No specials match'+( _roiDatePick.q||_roiDatePick.date ? ' your search' : ' yet')+'. Pick a date above or add one.</div>';
  }else{
    h+='<div class="roi-sp-stack">';
    list.forEach(function(ev){
      var rulesLbl=ev.forceSeason?('Season: '+ev.forceSeason):(ev.rules&&ev.rules.tiers?'Custom':(ev.rulesVenue||'Auto'));
      if(rulesLbl===CNBC_SUMMER_ROOF_KEY) rulesLbl='Sunset Rituals';
      if(typeof CNL_REMODEL_KEY!=='undefined' && rulesLbl===CNL_REMODEL_KEY) rulesLbl='CNL Remodel';
      if(typeof CNL_OCT_KEY!=='undefined' && rulesLbl===CNL_OCT_KEY) rulesLbl='CNL Oct 1';
      var days=(ev.days&&ev.days.length)?ev.days.map(function(d){return d.slice(0,3);}).join(', '):'All in range';
      if(ev.extraDays&&ev.extraDays.length){
        days+=(days?' + ':'')+ev.extraDays.map(function(d){return d.slice(0,3);}).join(', ')+' extra';
      }
      var fp=ev.floorPlan==='summer'?'Sunset 20'
        :(ev.floorPlan==='casa-neos-beach-club-new'?'CNBC waterfront'
        :(ev.floorPlan==='casa-neos-beach-club-basel'?'BC Basel'
        :(ev.floorPlan==='casa-neos-lounge-oct'?'CNL Oct 1'
        :(ev.floorPlan==='casa-neos-lounge-new'?'CNL remodel'
        :(ev.floorPlan==='casa-neos-lounge'?'CNL classic'
        :(ev.floorPlan==='regular'?'Regular':'Auto'))))));
      var when=ev.start+(ev.end&&ev.end!==ev.start?' → '+ev.end:'');
      h+='<div class="roi-sp-card">';
      h+='<div class="roi-sp-card-main">';
      h+='<b>'+_escRoi(ev.label||'Untitled')+'</b>';
      h+='<span>'+_escRoi(ev.venue||'')+'</span>';
      h+='<span>'+_escRoi(when+' · '+days)+'</span>';
      h+='<span>'+_escRoi(rulesLbl+' · '+fp)+'</span>';
      h+='</div>';
      h+='<div class="roi-sp-card-actions">';
      h+='<button type="button" class="roi-mini-btn" onclick="openRoiSpecialForm(\''+ev._uid+'\')">Edit</button>';
      h+='<button type="button" class="roi-mini-btn roi-mini-del" onclick="deleteRoiSpecial(\''+ev._uid+'\')">Delete</button>';
      h+='</div></div>';
    });
    h+='</div>';
  }
  h+='</div>';

  if(_roiEditSpecialUid!==null) h+=renderRoiSpecialForm(_roiEditSpecialUid);
  return h;
}

function _roiSpeListFiltered(){
  var list=_roiSpeList();
  var q=String(_roiDatePick.q||'').trim().toLowerCase();
  var d=String(_roiDatePick.date||'').trim();
  var v=String(_roiDatePick.venue||'').trim();
  return list.filter(function(ev){
    if(v && ev.venue!==v) return false;
    if(d){
      if(!(ev.start<=d && ev.end>=d) && ev.start!==d && ev.end!==d) return false;
    }
    if(!q) return true;
    var blob=((ev.label||'')+' '+(ev.venue||'')+' '+(ev.start||'')+' '+(ev.end||'')+' '+(ev.forceSeason||'')+' '+(ev.rulesVenue||'')).toLowerCase();
    return blob.indexOf(q)>=0;
  });
}

function renderRoiDateAssignBar(){
  var venues=(typeof listActiveVenues==='function'?listActiveVenues():['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge']);
  if(!_roiDatePick.venue) _roiDatePick.venue=curV||venues[0]||'';
  var h='<div class="roi-date-bar" id="roiDateBar">';
  h+='<div class="roi-date-bar-hd">Location and date</div>';
  h+='<div class="roi-date-pick">';
  h+='<div class="fld"><label>Location</label><select id="roiDateVenue" onchange="_roiDatePick.venue=this.value;roiRefreshDateInspect()">';
  venues.forEach(function(v){
    h+='<option value="'+_escRoi(v)+'"'+(v===_roiDatePick.venue?' selected':'')+'>'+_escRoi(v)+'</option>';
  });
  h+='</select></div>';
  h+='<div class="fld"><label>Date</label><input id="roiDatePick" type="date" value="'+(_roiDatePick.date||'')+'" onchange="_roiDatePick.date=this.value;roiRefreshDateInspect()"></div>';
  h+='<button type="button" class="btn-save roi-date-go" onclick="roiOpenSpecialForPickedDate()">Set special ROI rules</button>';
  h+='</div>';
  h+='<div class="fld roi-date-search"><label>Search saved specials</label><input id="roiDateSearch" type="search" placeholder="Name, date, venue…" value="'+_escRoi(_roiDatePick.q||'')+'" oninput="_roiDatePick.q=this.value;roiFilterSpecialList()"></div>';
  h+='<div id="roiDateInspect" class="roi-date-inspect">'+_roiDateInspectHtml()+'</div>';
  h+='</div>';
  return h;
}

function _roiFeeOnDate(venue, dateStr){
  var fee=0;
  if(typeof SCHED==='undefined'||!dateStr) return fee;
  SCHED.forEach(function(r){
    if(!r||r.d!==dateStr) return;
    if((r.v||r.venue)!==venue) return;
    var f=+(r.fee||r.cost||0)||0;
    if(f>fee) fee=f;
  });
  return fee;
}

function _roiShowsOnDate(venue, dateStr){
  var out=[];
  if(typeof SCHED==='undefined'||!dateStr) return out;
  SCHED.forEach(function(r){
    if(!r||r.d!==dateStr) return;
    if(venue && (r.v||r.venue)!==venue) return;
    out.push(r);
  });
  return out;
}

function _roiDateInspectHtml(){
  var venue=_roiDatePick.venue||'';
  var dateStr=_roiDatePick.date||'';
  if(!dateStr){
    return '<div class="roi-page-hint">Choose a date (or click a date chip in the list) to preview Calendar targets and assign High / Low / Special rules.</div>';
  }
  var day=typeof dayNameFor==='function'?dayNameFor(dateStr):'';
  var fee=_roiFeeOnDate(venue, dateStr);
  var shows=_roiShowsOnDate(venue, dateStr);
  var sp=typeof roiSpecialEventFor==='function'?roiSpecialEventFor(venue, dateStr):null;
  var look=(fee>0 && typeof venueRoiLookup==='function')?venueRoiLookup(venue, dateStr, fee):null;
  var natural=typeof seasonFor==='function'?seasonFor(
    (typeof effectiveRoiVenue==='function'?effectiveRoiVenue(venue, dateStr, fee):venue),
    dateStr
  ):'';
  var h='<div class="roi-inspect-card">';
  h+='<div class="roi-inspect-title">'+_escRoi(venue)+' · <button type="button" class="roi-date-chip" onclick="document.getElementById(\'roiDatePick\').showPicker&&document.getElementById(\'roiDatePick\').showPicker()">'+dateStr+'</button> <span class="roi-page-hint">('+day+')</span></div>';
  if(shows.length){
    h+='<div class="roi-inspect-shows">Shows: '+shows.map(function(r){
      return '<b>'+_escRoi(r.dj||'TBD')+'</b> ($'+((r.fee||r.cost||0).toLocaleString? (r.fee||r.cost||0).toLocaleString():(r.fee||r.cost||0))+')';
    }).join(' · ')+'</div>';
  }else{
    h+='<div class="roi-inspect-shows roi-page-hint">No show booked on Calendar for this venue/date — you can still assign season or special rules.</div>';
  }
  if(sp){
    var spUid=_roiUidForSpecial(sp);
    h+='<div class="roi-inspect-sp">Existing special: <b>'+_escRoi(sp.label||'')+'</b>'
      +(sp.forceSeason?(' · forced <b>'+sp.forceSeason+'</b> season'):'')
      +(spUid?(' <button type="button" class="roi-mini-btn" onclick="openRoiSpecialForm(\''+spUid+'\')">Edit</button>'):'')
      +'</div>';
  }
  if(look){
    h+='<div class="roi-inspect-targets">Current targets → BS <b>$'+(look.bsTarget!=null?Math.round(look.bsTarget).toLocaleString():'—')+'</b> · ROI <b>'+(look.roiTarget!=null?look.roiTarget+'x':'—')+'</b> · season <b>'+look.season+'</b>'
      +(look.specialEvent?(' · via “'+_escRoi(look.specialEvent)+'”'):(' · calendar default '+natural))
      +'</div>';
  }else if(fee===0){
    h+='<div class="roi-inspect-targets">Fee <b>$0</b> → BS target <b>—</b> · ROI <b>0</b> (no target).</div>';
  }else if(fee<=0){
    h+='<div class="roi-page-hint">Add a DJ fee on Calendar to preview BS / ROI targets for this date.</div>';
  }else{
    h+='<div class="roi-page-hint">No matching ROI tier for this day. Set special ROI rules for this date.</div>';
  }
  h+='</div>';
  return h;
}

function roiRefreshDateInspect(){
  var venueEl=document.getElementById('roiDateVenue');
  var dateEl=document.getElementById('roiDatePick');
  if(venueEl) _roiDatePick.venue=venueEl.value;
  if(dateEl) _roiDatePick.date=dateEl.value;
  var box=document.getElementById('roiDateInspect');
  if(box) box.innerHTML=_roiDateInspectHtml();
  roiFilterSpecialList();
}

function roiFilterSpecialList(){
  var qEl=document.getElementById('roiDateSearch');
  if(qEl) _roiDatePick.q=qEl.value;
  var venueEl=document.getElementById('roiDateVenue');
  var dateEl=document.getElementById('roiDatePick');
  if(venueEl) _roiDatePick.venue=venueEl.value;
  if(dateEl) _roiDatePick.date=dateEl.value;
  var caret=qEl?qEl.selectionStart:null;
  renderRoiRulesPage();
  var again=document.getElementById('roiDateSearch');
  if(again){
    again.focus();
    try{ again.setSelectionRange(caret!=null?caret:again.value.length, caret!=null?caret:again.value.length); }catch(e){}
  }
}

function _roiUidForSpecial(sp){
  if(!sp) return '';
  if(sp._uid) return sp._uid;
  var found='';
  Object.keys(ROI_SPECIAL_EVENTS||{}).forEach(function(uid){
    if(ROI_SPECIAL_EVENTS[uid]===sp) found=uid;
  });
  return found;
}

function roiJumpToDate(venue, dateStr){
  _roiDatePick.venue=venue||_roiDatePick.venue;
  _roiDatePick.date=dateStr||'';
  _roiPageTab='special';
  renderRoiRulesPage();
  setTimeout(function(){
    var el=document.getElementById('roiDateBar');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  },40);
}

function roiOpenSpecialForPickedDate(){
  var venue=(document.getElementById('roiDateVenue')||{}).value||_roiDatePick.venue;
  var dateStr=(document.getElementById('roiDatePick')||{}).value||_roiDatePick.date;
  if(!dateStr){ alert('Pick a date first (click the date field).'); return; }
  _roiDatePick.venue=venue; _roiDatePick.date=dateStr;
  var shows=_roiShowsOnDate(venue, dateStr);
  var dj=shows[0]&&shows[0].dj?shows[0].dj:'Special';
  openRoiSpecialFormForShow(venue, dateStr, dj);
}

function roiAssignSeasonForDate(season){
  if(season!=='High'&&season!=='Low') return;
  var venue=(document.getElementById('roiDateVenue')||{}).value||_roiDatePick.venue;
  var dateStr=(document.getElementById('roiDatePick')||{}).value||_roiDatePick.date;
  if(!venue||!dateStr){ alert('Pick a venue and date first.'); return; }
  _roiDatePick.venue=venue; _roiDatePick.date=dateStr;
  var day=dayNameFor(dateStr);
  var fee=_roiFeeOnDate(venue, dateStr);
  var rulesVenue=(typeof effectiveRoiVenue==='function')?effectiveRoiVenue(venue, dateStr, fee||0):venue;
  var rules=VENUE_ROI_RULES[rulesVenue];
  var offDay=!(rules&&rules.days&&rules.days.indexOf(day)>-1);
  var dateLbl='';
  try{
    dateLbl=new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }catch(e){ dateLbl=dateStr; }

  /* Update existing special covering this exact single day, else create */
  var existingUid=null;
  Object.keys(ROI_SPECIAL_EVENTS||{}).forEach(function(uid){
    var ev=ROI_SPECIAL_EVENTS[uid];
    if(!ev||ev.venue!==venue) return;
    if(ev.start===dateStr&&ev.end===dateStr) existingUid=uid;
  });
  var uid=existingUid||_roiSpeUid();
  var fp='auto';
  if(venue==='Casa Neos Beach Club'&&typeof isCnbcSummerFloor==='function'&&isCnbcSummerFloor(dateStr)) fp='summer';
  var rec={
    _uid:uid,
    label:season+' season · '+dateLbl,
    venue:venue,
    start:dateStr,
    end:dateStr,
    forceSeason:season,
    rulesVenue:rulesVenue,
    rules:null,
    floorPlan:fp,
    days:[day],
    extraDays:offDay?[day]:[],
    dayTemplate:(rules&&rules.days&&rules.days.indexOf('Sunday')>-1)?'Sunday':((rules&&rules.days&&rules.days[0])||'Sunday'),
    djFee:fee||0,
    updatedAt:new Date().toISOString()
  };
  ROI_SPECIAL_EVENTS[uid]=rec;
  saveRoiSpecialEvents();
  if(typeof refreshAllRoiDerivedData==='function') refreshAllRoiDerivedData();
  else if(typeof recalcAllSchedTargets==='function') recalcAllSchedTargets();
  _roiEditSpecialUid=null;
  renderRoiRulesPage();
}

function renderRoiSpecialUpcoming(){
  var today=new Date(); today.setHours(0,0,0,0);
  var todayStr=today.toISOString().split('T')[0];
  var shows=[];
  if(typeof SCHED!=='undefined'){
    SCHED.forEach(function(r){
      if(!r||!r.d||r.d<todayStr) return;
      var v=r.v||r.venue;
      if(roiSpecialEventFor(v, r.d)) return;
      var day=dayNameFor(r.d);
      var rv=effectiveRoiVenue(v, r.d, r.fee||r.cost||0);
      var rules=VENUE_ROI_RULES[rv];
      var offDay=rules&&rules.days&&rules.days.indexOf(day)===-1;
      if(offDay) shows.push({r:r,v:v,day:day});
    });
  }
  shows.sort(function(a,b){ return a.r.d.localeCompare(b.r.d); });
  if(!shows.length) return '';
  var h='<div class="roi-special-upcoming"><div class="roi-section-title">Needs a special rule</div>';
  h+='<p class="roi-page-hint" style="margin:-4px 0 10px">Off-schedule shows. Open one to set the BS Target and table tiers.</p>';
  h+='<div class="roi-sp-stack">';
  shows.slice(0,16).forEach(function(row){
    h+='<div class="roi-sp-card roi-alert-row" tabindex="0" role="button" data-venue="'+_escRoi(row.v)+'" data-date="'+row.r.d+'" data-dj="'+_escRoi(row.r.dj||'TBD')+'" onclick="openRoiSpecialFormFromRow(this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openRoiSpecialFormFromRow(this);}">';
    h+='<div class="roi-sp-card-main">';
    h+='<b>'+_escRoi(row.r.dj||'TBD')+'</b>';
    h+='<span>'+_escRoi(row.v)+'</span>';
    h+='<span>'+row.r.d+' · '+row.day.slice(0,3)+'</span>';
    h+='</div>';
    h+='<span class="roi-alert-cta">ADD SPECIAL PERFORMANCE ROI</span>';
    h+='</div>';
  });
  h+='</div></div>';
  return h;
}

function openRoiSpecialFormFromRow(tr){
  if(!tr||!tr.dataset) return;
  openRoiSpecialFormForShow(tr.dataset.venue||'', tr.dataset.date||'', tr.dataset.dj||'');
}

function openRoiSpecialFormForShow(venue, dateStr, djName){
  _roiPageTab='special';
  _roiEditSpecialUid='__new__';
  _roiSpForceCustom=true;
  var day=dayNameFor(dateStr);
  var fee=0;
  if(typeof SCHED!=='undefined'){
    SCHED.forEach(function(r){
      if(!r||r.d!==dateStr) return;
      if((r.v||r.venue)!==venue) return;
      fee=r.fee||r.cost||0;
    });
  }
  var rv=effectiveRoiVenue(venue, dateStr, fee);
  var rules=_cloneVenueRules(rv);
  if(rules){
    if(rules.days.indexOf(day)===-1){
      rules.days=rules.days.slice();
      rules.days.push(day);
      rules.days.sort(function(a,b){ return DOW_NAMES.indexOf(a)-DOW_NAMES.indexOf(b); });
    }
    var templateDay=rules.days.indexOf('Sunday')>-1?'Sunday':rules.days[0];
    rules.tiers.forEach(function(tier){
      ['High','Low'].forEach(function(season){
        if(!tier[season]) tier[season]={};
        if(!tier[season][day]){
          var src=(tier[season]||{})[templateDay]||{roi:2,sales:0,tables:{}};
          tier[season][day]=JSON.parse(JSON.stringify(src));
        }
      });
    });
  }
  var dateLbl='';
  try{
    var dObj=new Date(dateStr+'T12:00:00');
    dateLbl=dObj.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }catch(e){ dateLbl=dateStr; }
  var fp='auto';
  if(venue==='Casa Neos Beach Club'&&typeof isCnbcSummerFloor==='function'&&isCnbcSummerFloor(dateStr)) fp='summer';
  _roiSpPrefill={
    dj:String(djName||'Special').trim()||'Special',
    label:(String(djName||'Special').trim()||'Special')+' · '+dateLbl,
    venue:venue, start:dateStr, end:dateStr,
    rulesVenue:null, rules:rules, floorPlan:fp,
    extraDays:[day], dayTemplate:'Sunday', days:[day], djFee:fee
  };
  renderRoiRulesPage();
}

function _escRoi(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

function openRoiSpecialForm(uid){
  _roiEditSpecialUid=uid||'__new__';
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  renderRoiRulesPage();
}

function renderRoiSpecialForm(uid){
  var isNew=uid==='__new__';
  var ev=isNew?(_roiSpPrefill||{
    label:'', venue:curV||'Casa Neos Beach Club',
    start:'', end:'', rulesVenue:CNBC_CURRENT_KEY,
    extraDays:['Monday'], dayTemplate:'Sunday', floorPlan:'auto',
    days:[]
  }):Object.assign({}, ROI_SPECIAL_EVENTS[uid]||{});
  if(!ev._uid&& !isNew) ev._uid=uid;

  if(!ev.dj){
    var booked=_roiShowsOnDate(ev.venue, ev.start);
    ev.dj=(booked[0]&&booked[0].dj)||String(ev.label||'').split('·')[0].trim()||'Special';
  }
  if(!ev.rules||!ev.rules.tiers){
    var ruleKey=ev.rulesVenue&&ev.rulesVenue!=='__custom__'?ev.rulesVenue:((typeof effectiveRoiVenue==='function')?effectiveRoiVenue(ev.venue, ev.start, ev.djFee||0):ev.venue);
    ev.rules=_cloneVenueRules(ruleKey)||_cloneVenueRules(ev.venue);
  }
  window._roiSpEditing={
    dj:ev.dj, label:ev.label||'', venue:ev.venue||'', start:ev.start||'', end:ev.end||ev.start||'',
    floorPlan:ev.floorPlan||'auto', dayTemplate:ev.dayTemplate||'Sunday',
    forceSeason:(ev.forceSeason==='High'||ev.forceSeason==='Low')?ev.forceSeason:null,
    days:ev.days?ev.days.slice():[], extraDays:ev.extraDays?ev.extraDays.slice():[], djFee:ev.djFee||0
  };

  var h='<div class="roi-sp-modal" id="roiSpecialForm">';
  h+='<div class="roi-sp-modal-back" onclick="cancelRoiSpecialForm()"></div>';
  h+='<div class="roi-sp-modal-card" role="dialog" aria-modal="true">';
  h+='<div class="roi-sp-who">';
  h+='<div><span>DJ</span><b>'+_escRoi(ev.dj)+'</b></div>';
  h+='<div><span>Name</span><b>'+_escRoi(ev.label||ev.dj)+'</b></div>';
  h+='<div><span>Venue</span><b>'+_escRoi(ev.venue||'')+'</b></div>';
  h+='</div>';

  h+='<div id="roiSpCustomWrap" class="roi-tier-editor-wrap">';
  h+='<div class="roi-tier-editor-hd"><span class="vr-season-lbl">BS Target and table tiers</span>';
  h+='<span class="roi-page-hint" id="roiSpTierHint">BS Target = DJ fee × ROI.</span></div>';
  h+='<div id="roiSpCustomBody"></div>';
  h+='</div>';

  h+='<div class="roi-form-actions">';
  h+='<button type="button" class="btn-cancel" onclick="cancelRoiSpecialForm()">Cancel</button>';
  h+='<button type="button" class="btn-save" onclick="saveRoiSpecialForm(\''+(isNew?'__new__':uid)+'\')">Save</button>';
  h+='</div></div></div>';

  setTimeout(function(){ renderRoiSpCustomEditor(ev); },0);
  return h;
}

function toggleRoiSpCustom(){
  var sel=document.getElementById('roiSpTemplate');
  var wrap=document.getElementById('roiSpCustomWrap');
  if(wrap) wrap.style.display=(sel&&sel.value==='__custom__')?'':'none';
  var fp=document.getElementById('roiSpFloor');
  if(sel&&fp&&sel.value&&sel.value!=='__custom__'&&typeof VENUE_ROI_RULES!=='undefined'&&VENUE_ROI_RULES[sel.value]&&VENUE_ROI_RULES[sel.value].floorPlan){
    fp.value=VENUE_ROI_RULES[sel.value].floorPlan;
  }
  if(sel&&sel.value==='__custom__'){
    var ev={rules:null};
    renderRoiSpCustomEditor(ev);
  }
}
function roiSpFloorOrVenueChanged(){
  var wrap=document.getElementById('roiSpCustomWrap');
  var sel=document.getElementById('roiSpTemplate');
  if(wrap&&wrap.style.display!=='none'&&sel&&sel.value==='__custom__'){
    var body=document.getElementById('roiSpCustomBody');
    var ev={rules:(body&&body._roiSpRules)||null};
    renderRoiSpCustomEditor(ev);
  }
}

function wireRoiSpFormToggles(){
  document.querySelectorAll('.roi-sp-day').forEach(function(btn){
    btn.addEventListener('click',function(){ btn.classList.toggle('on'); });
  });
  document.querySelectorAll('.roi-sp-extra').forEach(function(btn){
    btn.addEventListener('click',function(){ btn.classList.toggle('on'); });
  });
}

function renderRoiSpCustomEditor(ev){
  var body=document.getElementById('roiSpCustomBody');
  if(!body) return;
  var rules=ev.rules;
  if(!rules||!rules.tiers) rules=_cloneVenueRules((ev&&ev.venue)||'Casa Neos Beach Club');
  if(!rules){ body.innerHTML='<div class="roi-empty">No venue rules for this performance.</div>'; return; }
  var meta=window._roiSpEditing||{};
  var fee=_roiSpResolveFee(ev);
  if(!(fee>0)) fee=_roiSpResolveFee({venue:(ev&&ev.venue)||meta.venue||'', start:(ev&&ev.start)||meta.start||'', djFee:(ev&&ev.djFee)||meta.djFee||0});
  var dateStr=ev.start||meta.start||(_roiSpPrefill&&_roiSpPrefill.start)||'';
  var days=rules.days||DOW_NAMES;
  var showDays=days;
  if(_roiSpPrefill&&_roiSpPrefill.days&&_roiSpPrefill.days.length) showDays=_roiSpPrefill.days;
  else if(ev.days&&ev.days.length) showDays=ev.days;
  if(fee>0){
    rules=_roiSpFilterRulesForShow(rules, fee, dateStr, showDays);
    var hint=document.getElementById('roiSpTierHint');
    if(hint){
      hint.textContent='DJ fee $'+fee.toLocaleString()+' → nearest tier $'+(rules._matchedTierFee||fee).toLocaleString()+'. Set ROI and BS Target fills as fee × ROI.';
    }
  }else{
    var hint0=document.getElementById('roiSpTierHint');
    if(hint0) hint0.textContent='No DJ fee found for this date — enter ROI after the show has a fee so BS Target can auto-fill (fee × ROI).';
  }
  var seasons=['High','Low'];
  if(dateStr&&typeof seasonFor==='function') seasons=[seasonFor(rules, dateStr)];
  var venue=(ev&&ev.venue)||meta.venue||'Casa Neos Beach Club';
  var floorPlan=(ev&&ev.floorPlan)||meta.floorPlan||'auto';
  var tmplKey=(ev&&ev.rulesVenue)||'';
  var countsKey=(tmplKey&&tmplKey!=='__custom__')?tmplKey:venue;
  if(floorPlan==='auto' && rules.floorPlan) floorPlan=rules.floorPlan;
  var countsMeta=typeof roiTableCountsForRulesVenue==='function'
    ? roiTableCountsForRulesVenue(countsKey, {dateStr:dateStr, floorPlan:floorPlan})
    : {counts:{}, badge:'', total:0};
  var counts=countsMeta.counts||{};
  var h='';
  h+='<div hidden data-roi-counts=\''+JSON.stringify(counts).replace(/'/g,'&#39;')+'\' data-roi-cats=\''+JSON.stringify(rules.tableCats||[]).replace(/'/g,'&#39;')+'\'></div>';
  h+=_roiTableInventoryHtml(rules, countsMeta, {hideSource:true});
  h+='<div class="vr-tiers vr-tiers--page">';
  rules.tiers.forEach(function(tier, ti){
    h+='<div class="vr-tier-block vr-tier-block--page"><div class="vr-tier-hd"><span class="vr-tier-fee-lbl">DJ Fee</span>';
    h+='<b class="roi-sp-fee-lock">$'+_vrFmtMoney(tier.fee)+'</b>';
    if(fee>0&&tier.fee!==fee){
      h+='<span class="roi-tier-match-note">Show DJ: $'+fee.toLocaleString()+'</span>';
    }
    h+='</div>';
    h+='<div class="vr-tier-scroll"><table class="vr-tier-tbl vr-tier-tbl--page"><thead><tr><th>Season</th><th>Day</th><th>ROI</th><th>BS Target</th>';
    h+=_roiBsSetHeaderHtml();
    h+=_roiTierHeaderHtml(rules.tableCats, counts);
    h+='</tr></thead><tbody>';
    showDays=rules.days||showDays;
    seasons.forEach(function(season){
      showDays.forEach(function(day, di){
        var dayData=(tier[season]||{})[day]||{roi:0,sales:0,tables:{}};
        h+='<tr>';
        if(di===0) h+='<td rowspan="'+showDays.length+'" class="vr-season-cell vr-season-'+season.toLowerCase()+'">'+season+'</td>';
        h+='<td class="vr-day-cell">'+day.slice(0,3)+'</td>';
        h+='<td><input type="number" step="0.1" class="vr-cell-inp vr-roi-inp roi-sp-roi" value="'+dayData.roi+'" data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" title="BS Target = DJ fee × ROI"></td>';
        h+='<td>'+_vrMoneyInputHtml(dayData.sales, 'vr-cell-inp vr-target-inp roi-sp-sales', 'data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'"')+'</td>';
        h+=_roiBsSetCellHtml(rules, counts, tier, ti, season, day);
        (rules.tableCats||[]).forEach(function(c){
          var tv=(dayData.tables||{})[c]||0;
          h+='<td>'+_vrMoneyInputHtml(tv, 'vr-cell-inp vr-cell-sm roi-sp-tbl', 'data-ti="'+ti+'" data-season="'+season+'" data-day="'+day+'" data-cat="'+c+'"')+'</td>';
        });
        h+='</tr>';
      });
    });
    h+='</tbody></table></div>';
    h+='</div>';
  });
  h+='</div>';
  body.innerHTML=h;
  body._roiSpRules=rules;
  body._roiSpDjFee=fee>0?fee:0;
  wireVenueRulesMoneyInputs(body);
  wireRoiSpRoiToBs(body);
}

/* Special performance: editing ROI auto-fills BS Target = DJ fee × ROI. */
function wireRoiSpRoiToBs(root){
  root=root||document.getElementById('roiSpCustomBody');
  if(!root) return;
  root.querySelectorAll('.roi-sp-roi').forEach(function(inp){
    if(inp._roiSpRoiWired) return;
    inp._roiSpRoiWired=true;
    var sync=function(){ _roiSpApplyBsFromRoi(inp, root); };
    inp.addEventListener('input', sync);
    inp.addEventListener('change', sync);
    inp.addEventListener('blur', sync);
  });
  /* If BS Target is edited manually, keep ROI in sync (BS ÷ fee). */
  root.querySelectorAll('.roi-sp-sales').forEach(function(inp){
    if(inp._roiSpSalesWired) return;
    inp._roiSpSalesWired=true;
    var syncRoi=function(){ _roiSpApplyRoiFromBs(inp, root); };
    inp.addEventListener('change', syncRoi);
    inp.addEventListener('blur', syncRoi);
  });
}
function _roiSpDjFeeForEditor(root){
  root=root||document.getElementById('roiSpCustomBody');
  if(root&&root._roiSpDjFee>0) return root._roiSpDjFee;
  var meta=window._roiSpEditing||{};
  var fee=_roiSpResolveFee({venue:meta.venue||'', start:meta.start||'', djFee:meta.djFee||0});
  if(fee>0&&root) root._roiSpDjFee=fee;
  return fee||0;
}
function _roiSpApplyBsFromRoi(roiInp, root){
  root=root||document.getElementById('roiSpCustomBody');
  if(!roiInp||!root) return;
  var fee=_roiSpDjFeeForEditor(root);
  if(!(fee>0)) return;
  var roi=parseFloat(roiInp.value);
  if(isNaN(roi)||roi<0) return;
  var ti=roiInp.dataset.ti, season=roiInp.dataset.season, day=roiInp.dataset.day;
  var salesInp=root.querySelector('.roi-sp-sales[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"]');
  if(!salesInp) return;
  var bs=Math.round(fee*roi);
  salesInp.value=_vrFmtMoney(bs);
  if(root._roiSpRules&&root._roiSpRules.tiers[ti]){
    if(!root._roiSpRules.tiers[ti][season]) root._roiSpRules.tiers[ti][season]={};
    if(!root._roiSpRules.tiers[ti][season][day]) root._roiSpRules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    root._roiSpRules.tiers[ti][season][day].roi=roi;
    root._roiSpRules.tiers[ti][season][day].sales=bs;
  }
  if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
}
function _roiSpApplyRoiFromBs(salesInp, root){
  root=root||document.getElementById('roiSpCustomBody');
  if(!salesInp||!root) return;
  var fee=_roiSpDjFeeForEditor(root);
  if(!(fee>0)) return;
  var bs=_vrParseMoney(salesInp.value);
  var ti=salesInp.dataset.ti, season=salesInp.dataset.season, day=salesInp.dataset.day;
  var roiInp=root.querySelector('.roi-sp-roi[data-ti="'+ti+'"][data-season="'+season+'"][data-day="'+day+'"]');
  if(!roiInp) return;
  var roi=+(bs/fee).toFixed(2);
  roiInp.value=String(roi);
  if(root._roiSpRules&&root._roiSpRules.tiers[ti]){
    if(!root._roiSpRules.tiers[ti][season]) root._roiSpRules.tiers[ti][season]={};
    if(!root._roiSpRules.tiers[ti][season][day]) root._roiSpRules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    root._roiSpRules.tiers[ti][season][day].roi=roi;
    root._roiSpRules.tiers[ti][season][day].sales=bs;
  }
  if(typeof roiRefreshVerifyBlocks==='function') roiRefreshVerifyBlocks(root);
}

function _collectRoiSpCustomRules(){
  var body=document.getElementById('roiSpCustomBody');
  if(!body||!body._roiSpRules) return null;
  var rules=JSON.parse(JSON.stringify(body._roiSpRules));
  var djFee=_roiSpDjFeeForEditor(body);
  document.querySelectorAll('.roi-sp-fee').forEach(function(inp){
    var ti=+inp.dataset.ti;
    if(rules.tiers[ti]) rules.tiers[ti].fee=_vrParseMoney(inp.value);
  });
  document.querySelectorAll('.roi-sp-roi').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    rules.tiers[ti][season][day].roi=parseFloat(inp.value)||0;
  });
  document.querySelectorAll('.roi-sp-sales').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    rules.tiers[ti][season][day].sales=_vrParseMoney(inp.value);
  });
  document.querySelectorAll('.roi-sp-tbl').forEach(function(inp){
    var ti=+inp.dataset.ti, season=inp.dataset.season, day=inp.dataset.day, cat=inp.dataset.cat;
    if(!rules.tiers[ti][season]) rules.tiers[ti][season]={};
    if(!rules.tiers[ti][season][day]) rules.tiers[ti][season][day]={roi:0,sales:0,tables:{}};
    if(!rules.tiers[ti][season][day].tables) rules.tiers[ti][season][day].tables={};
    rules.tiers[ti][season][day].tables[cat]=_vrParseMoney(inp.value);
  });
  /* Keep BS Target = DJ fee × ROI whenever ROI is set (special-performance contract). */
  if(djFee>0){
    (rules.tiers||[]).forEach(function(tier){
      if(tier) tier.fee=djFee;
      ['High','Low'].forEach(function(season){
        Object.keys(tier[season]||{}).forEach(function(day){
          var d=tier[season][day];
          if(!d) return;
          var roi=+d.roi||0;
          if(roi>0) d.sales=Math.round(djFee*roi);
        });
      });
    });
  }
  rules.tiers.sort(function(a,b){ return a.fee-b.fee; });
  return rules;
}

function saveRoiSpecialForm(uid){
  var meta=window._roiSpEditing||{};
  var label=meta.label||'';
  var venue=meta.venue||'';
  var start=meta.start||'';
  var end=meta.end||start;
  if(!label.trim()||!venue||!start){ alert('This performance is missing a name, venue, or date.'); return; }
  if(end<start) end=start;

  var rec={
    dj:meta.dj||'',
    label:label.trim(), venue:venue, start:start, end:end,
    floorPlan:meta.floorPlan||'auto', extraDays:meta.extraDays||[], dayTemplate:meta.dayTemplate||'Sunday',
    forceSeason:(meta.forceSeason==='High'||meta.forceSeason==='Low')?meta.forceSeason:null,
    updatedAt:new Date().toISOString(),
    djFee:_roiSpResolveFee({venue:venue,start:start,end:end,djFee:meta.djFee||0})
  };
  if(meta.days&&meta.days.length) rec.days=meta.days.slice();
  rec.rules=_collectRoiSpCustomRules();
  rec.rulesVenue=null;

  var newUid=uid==='__new__'?_roiSpeUid():uid;
  rec._uid=newUid;
  ROI_SPECIAL_EVENTS[newUid]=rec;
  saveRoiSpecialEvents();
  _roiEditSpecialUid=null;
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  window._roiSpEditing=null;
  renderRoiRulesPage();
}

function cancelRoiSpecialForm(){
  _roiEditSpecialUid=null;
  _roiSpForceCustom=false;
  _roiSpPrefill=null;
  window._roiSpEditing=null;
  renderRoiRulesPage();
}

function deleteRoiSpecial(uid){
  if(!ROI_SPECIAL_EVENTS[uid]) return;
  if(!confirm('Delete this special performance rule?')) return;
  delete ROI_SPECIAL_EVENTS[uid];
  saveRoiSpecialEvents();
}

function wireRoiSpecialEvents(){ /* reserved for future delegated events */ }

/* ─── 3D Floor plan drops ───────────────────────────────────────── */
function _roiFpUid(){
  return 'fp_'+Math.random().toString(36).slice(2,8)+'_'+Date.now().toString(36).slice(-4);
}
function _roiFpList(){
  if(typeof ensureDefaultRoiFloorPlans==='function') ensureDefaultRoiFloorPlans();
  return Object.keys(ROI_FLOOR_PLANS||{}).map(function(uid){
    var p=ROI_FLOOR_PLANS[uid];
    if(!p) return null;
    return Object.assign({_uid:uid}, p);
  }).filter(Boolean).sort(function(a,b){
    var c=(a.venue||'').localeCompare(b.venue||'');
    if(c) return c;
    return (b.start||'').localeCompare(a.start||'');
  });
}
function _roiFpPresetOptions(selected){
  var presets=typeof FV_3D_PLAN_PRESETS!=='undefined'?FV_3D_PLAN_PRESETS:{};
  return Object.keys(presets).map(function(k){
    var p=presets[k];
    return '<option value="'+k+'"'+(selected===k?' selected':'')+'>'+_escRoi(p.label||k)+'</option>';
  }).join('');
}
function _roiFpPlanSummary(p){
  if(p&&p.plan&&p.plan.tables&&p.plan.tables.length){
    var n=p.plan.tables.reduce(function(s,t){ return s+((t.tables&&t.tables.length)||0); },0);
    var tiers=p.plan.tables.map(function(t){ return t.name+'×'+((t.tables&&t.tables.length)||0); }).join(' · ');
    return {lbl:(p.plan.badge||p.plan.label||p.label||'Grabbed plan')+' · '+n+' tables', tiers:tiers, ready:true};
  }
  var preset=(typeof FV_3D_PLAN_PRESETS!=='undefined'&&p&&FV_3D_PLAN_PRESETS[p.preset])?FV_3D_PLAN_PRESETS[p.preset]:null;
  if(preset) return {lbl:preset.label||p.preset, tiers:'', ready:true};
  if(p&&p.status==='queued') return {lbl:'Queued grab…', tiers:'', ready:false};
  if(p&&p.status==='error') return {lbl:'Grab failed', tiers:p.error||'', ready:false};
  return {lbl:p&&p.preset?p.preset:'—', tiers:'', ready:false};
}
function _roiFpLatestForVenue(venue){
  var best=null;
  Object.keys(ROI_FLOOR_PLANS||{}).forEach(function(uid){
    if(uid==='__draft_preview__') return;
    var p=ROI_FLOOR_PLANS[uid];
    if(!p||p.venue!==venue) return;
    if(!best){ best=Object.assign({_uid:uid}, p); return; }
    if((p.updatedAt||'')>(best.updatedAt||'')) best=Object.assign({_uid:uid}, p);
    else if((p.updatedAt||'')===(best.updatedAt||'') && (p.start||'')>(best.start||'')) best=Object.assign({_uid:uid}, p);
  });
  return best;
}
function openFv3dForVenue(venue, dateStr){
  var key=typeof fv3dKeyForVenue==='function'?fv3dKeyForVenue(venue):null;
  var src=typeof fv3dBookingSourceFor==='function'?fv3dBookingSourceFor(venue):null;
  if(!key && src) key=src.modelKey;
  if(!key){ alert('No 3D model for '+venue); return; }
  var d=dateStr||(typeof getFv3dDate==='function'?getFv3dDate():'')||(typeof miamiToday==='function'?miamiToday():'');
  if(typeof _fv3dModelKey!=='undefined') _fv3dModelKey=key;
  if(typeof setView==='function') setView('3d');
  setTimeout(function(){
    if(typeof setFv3dModel==='function') setFv3dModel(key);
    if(d && typeof setFv3dDate==='function') setFv3dDate(d);
  },80);
}
function renderRoiFloorPlansSection(){
  if(typeof ensureDefaultRoiFloorPlans==='function') ensureDefaultRoiFloorPlans();
  var h='';
  h+='<div class="roi-special-intro">';
  h+='<p><b>To see a plan:</b> open <b>3D View</b> in the left sidebar → pick the venue → set the date. This page only starts a Refresh; the model never appears here.</p>';
  h+='<p class="roi-page-hint">When status is ready, use <b>Open in 3D View</b>. Refreshing = wait. Error = grab failed (try again or check Actions).</p>';
  h+='</div>';

  h+='<div class="roi-special-list">';
  h+='<div class="roi-section-title">Venue booking sites</div>';
  var sources=typeof FV_3D_BOOKING_SOURCES!=='undefined'?FV_3D_BOOKING_SOURCES:{};
  var today=(typeof miamiToday==='function')?miamiToday():new Date().toISOString().slice(0,10);
  Object.keys(sources).forEach(function(venue){
    var src=sources[venue];
    var drop=_roiFpLatestForVenue(venue)||(typeof roiFloorPlanDropFor==='function'?roiFloorPlanDropFor(venue, today):null);
    var sum=_roiFpPlanSummary(drop||{});
    var st=drop?(drop.status||(sum.ready?'ready':'')):'none';
    var viewDate=(drop&&drop.start)||today;
    h+='<div class="roi-fp-venue-card">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:800">'+_escRoi(venue)+'</div>';
    h+='<div class="roi-page-hint" style="margin-top:4px"><a href="'+_escRoi(src.url)+'" target="_blank" rel="noopener">'+_escRoi(src.url)+'</a></div>';
    if(st==='ready'||(sum.ready&&st!=='error'&&st!=='refreshing'&&st!=='queued')){
      h+='<div style="font-size:11px;margin-top:6px;color:#166534;font-weight:700">Ready — '+_escRoi(sum.lbl)+'</div>';
    }else if(st==='refreshing'||st==='queued'||st==='running'){
      h+='<div style="font-size:11px;margin-top:6px;color:#9a3412;font-weight:700">Grabbing… check back in ~15–30 min, then Open in 3D View</div>';
    }else if(st==='error'){
      h+='<div style="font-size:11px;margin-top:6px;color:#991b1b;font-weight:700">Grab failed'+(drop&&drop.error?(': '+_escRoi(String(drop.error).slice(0,120))):'')+'</div>';
    }else{
      h+='<div style="font-size:10px;margin-top:6px" class="roi-page-hint">No refreshed plan yet — existing built-in 3D still works in 3D View</div>';
    }
    h+='</div>';
    h+='<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">';
    h+='<button type="button" class="btn-save" onclick="openFv3dForVenue(\''+_escRoi(venue).replace(/'/g,"\\'")+'\',\''+_escRoi(viewDate)+'\')">Open in 3D View</button>';
    h+='<button type="button" class="btn-add" onclick="refreshFloorPlanFromBookingSite(\''+_escRoi(venue).replace(/'/g,"\\'")+'\')">Refresh floor plan</button>';
    h+='</div></div>';
  });
  h+='</div>';

  var list=_roiFpList().filter(function(p){
    if(!p||p._uid==='__draft_preview__') return false;
    return p.preset==='casa-neos-beach-club-oct17' || p.preset==='casa-neos-beach-club-basel' || p.preset==='casa-neos-lounge-oct' || p.preset==='mila-lounge';
  });
  h+='<div class="roi-special-list" style="margin-top:18px">';
  h+='<div class="roi-section-title">Scheduled plans'+(list.length?' <span class="roi-page-hint" style="font-weight:600">('+list.length+')</span>':'')+'</div>';
  if(!list.length){
    h+='<div class="roi-empty">None yet — Refresh on a venue above (or in 3D View) to grab one.</div>';
  }else{
    h+='<table class="fcast-tbl roi-special-tbl"><thead><tr>';
    h+='<th class="left">Venue</th><th>From</th><th>Until</th><th class="left">Plan</th><th></th>';
    h+='</tr></thead><tbody>';
    list.forEach(function(p){
      var sum=_roiFpPlanSummary(p);
      var endLbl=p.end?p.end:'Open';
      var st=p.status||(sum.ready?'ready':'');
      h+='<tr>';
      h+='<td class="left" style="font-weight:800">'+_escRoi(p.venue||'')+'</td>';
      h+='<td style="font-size:11px">'+_escRoi(p.start||'')+'</td>';
      h+='<td style="font-size:11px">'+_escRoi(endLbl)+'</td>';
      h+='<td class="left" style="font-size:10px">'+_escRoi(sum.lbl)+(st&&st!=='ready'?' <span class="roi-page-hint">['+st+']</span>':'')+'</td>';
      h+='<td style="white-space:nowrap">';
      h+='<button type="button" class="roi-mini-btn" onclick="openFv3dForVenue(\''+_escRoi(p.venue||'').replace(/'/g,"\\'")+'\',\''+_escRoi(p.start||today)+'\')">Open 3D</button> ';
      h+='<button type="button" class="roi-mini-btn" onclick="refreshFloorPlanFromBookingSite(\''+_escRoi(p.venue||'').replace(/'/g,"\\'")+'\',\''+_escRoi(p.start||today)+'\')">Refresh</button> ';
      h+='<button type="button" class="roi-mini-btn roi-mini-del" onclick="deleteRoiFloorPlan(\''+p._uid+'\')">Delete</button>';
      h+='</td></tr>';
    });
    h+='</tbody></table>';
  }
  h+='</div>';
  return h;
}

function updateFv3dRefreshStatus(){
  var el=document.getElementById('fv3dRefreshStatus');
  if(!el) return;
  var m=typeof FV_3D_MODELS!=='undefined'?FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;}):null;
  var venue=m?m.venue:null;
  var d=(typeof getFv3dDate==='function'?getFv3dDate():'')||'';
  var drop=venue&&d&&typeof roiFloorPlanDropFor==='function'?roiFloorPlanDropFor(venue, d):null;
  if(!drop){ el.textContent=''; return; }
  if(drop.status==='queued'||drop.status==='refreshing'||drop.status==='running'){
    el.textContent='Grabbing from booking site… keep this date; it updates when ready.';
    return;
  }
  if(drop.status==='error'){
    el.textContent='Last grab failed — try Refresh again.';
    return;
  }
  if(drop.plan&&drop.updatedAt){
    el.textContent='Last grab '+String(drop.updatedAt).slice(0,16).replace('T',' ');
    return;
  }
  el.textContent='';
}

/* Same fixed booking URL every time → scrape BOOK YOUR TABLE for the selected date → update 3D plan. */
function refreshFloorPlanFromBookingSite(venueOpt, dateOpt){
  var m=typeof FV_3D_MODELS!=='undefined'?FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;}):null;
  var venue=venueOpt||(m&&m.venue)||'';
  var src=typeof fv3dBookingSourceFor==='function'?fv3dBookingSourceFor(venue):null;
  if(!src||!src.url){
    alert('No fixed booking link for this venue yet.');
    return;
  }
  venue=src.venue||venue;
  var dateStr=dateOpt||(typeof getFv3dDate==='function'?getFv3dDate():'')||(typeof miamiToday==='function'?miamiToday():'');
  if(!dateStr){
    alert('Pick a date in 3D View first (the date on the booking site to open).');
    return;
  }

  var drop=typeof roiFloorPlanDropFor==='function'?roiFloorPlanDropFor(venue, dateStr):null;
  var uid=(drop&&drop._uid)?drop._uid:_roiFpUid();
  var prev=ROI_FLOOR_PLANS[uid]||drop||{};
  var known=typeof _roiFpGuessKnownPreset==='function'?_roiFpGuessKnownPreset(venue, src.url, dateStr):null;
  var interim=null;
  if(!(prev.plan&&prev.plan.tables&&prev.plan.tables.length)&&known&&typeof _fv3dPlanPayloadFromPreset==='function'){
    interim=_fv3dPlanPayloadFromPreset(known);
  }

  ROI_FLOOR_PLANS[uid]={
    _uid:uid,
    label:prev.label||(venue+' live plan'),
    venue:venue,
    start:prev.start||dateStr,
    end:prev.end||'',
    preset:known||prev.preset||null,
    sourceUrl:src.url,
    status:'refreshing',
    plan:prev.plan&&prev.plan.tables?prev.plan:(interim||null),
    grabbed:!!(prev.grabbed||interim),
    createdAt:prev.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    seeded:false,
    lastRefreshDate:dateStr
  };
  if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();

  var reqId='req_refresh_'+uid+'_'+Date.now().toString(36);
  _roiFpQueueIngest({
    _uid:reqId,
    dropUid:uid,
    url:src.url,
    venue:venue,
    start:dateStr,
    end:ROI_FLOOR_PLANS[uid].end||'',
    label:ROI_FLOOR_PLANS[uid].label,
    status:'queued',
    refresh:true,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });

  updateFv3dRefreshStatus();
  if(typeof curView!=='undefined'&&curView==='roi-rules'&&typeof renderRoiRulesPage==='function') renderRoiRulesPage();

  var st=document.getElementById('fv3dRefreshStatus');
  if(st) st.textContent='Grab queued — scraping '+src.url.replace(/^https?:\/\//,'')+' for '+dateStr+'…';
  alert('Refresh queued.\n\nSame link: '+src.url+'\nDate on site: '+dateStr+'\n\nThe worker grabs the 3D plan (usually within ~15–30 min). Leave this date selected — 3D View updates when it’s ready.');
}
function openRoiFloorForm(uid){
  _roiEditFloorUid=uid||'__new__';
  renderRoiRulesPage();
}
function cancelRoiFloorForm(){
  _roiEditFloorUid=null;
  renderRoiRulesPage();
}
function renderRoiFloorForm(uid){
  var isNew=uid==='__new__';
  var p=isNew?{
    label:'',
    venue:'Casa Neos Beach Club',
    start:'',
    end:'',
    sourceUrl:'https://beachclub.casa-neos.com/',
    closePrevious:true,
    status:'',
    plan:null
  }:Object.assign({closePrevious:false}, ROI_FLOOR_PLANS[uid]||{});
  var venues=(typeof listActiveVenues==='function'?listActiveVenues():['Casa Neos Beach Club','MILA Lounge','Casa Neos Lounge']);
  var h='<div class="roi-special-form" id="roiFloorForm">';
  h+='<div class="roi-section-title">'+(isNew?'Add floor plan':'Edit floor plan')+'</div>';
  h+='<div class="roi-fp-callout">Link + dates + Save. The 3D plan is picked up for those dates automatically.</div>';
  h+='<div class="roi-form-grid">';
  h+='<div class="fld" style="grid-column:1/-1"><label>Booking site link</label><input id="roiFpSourceUrl" type="url" value="'+_escRoi(p.sourceUrl||'')+'" placeholder="https://beachclub.casa-neos.com/" oninput="roiFpRefreshPreview()"></div>';
  h+='<div class="fld"><label>Venue</label><select id="roiFpVenue" onchange="roiFpVenueChanged();roiFpRefreshPreview()">'+venues.map(function(v){
    return '<option value="'+_escRoi(v)+'"'+(v===p.venue?' selected':'')+'>'+_escRoi(v)+'</option>';
  }).join('')+'</select></div>';
  h+='<div class="fld"><label>Name <span class="roi-page-hint">(optional)</span></label><input id="roiFpLabel" type="text" value="'+_escRoi(p.label||'')+'" placeholder="Auto from venue + date" oninput="roiFpRefreshPreview()"></div>';
  h+='<div class="fld"><label>Starts (first live date)</label><input id="roiFpStart" type="date" value="'+(p.start||'')+'" onchange="roiFpRefreshPreview()"></div>';
  h+='<div class="fld"><label>Ends <span class="roi-page-hint">(blank = ongoing)</span></label><input id="roiFpEnd" type="date" value="'+(p.end||'')+'" onchange="roiFpRefreshPreview()"></div>';
  h+='<input type="hidden" id="roiFpPreset" value="'+_escRoi(p.preset||'')+'">';
  h+='</div>';
  h+='<label class="roi-page-hint" style="display:flex;align-items:center;gap:8px;margin:10px 0;cursor:pointer">';
  h+='<input id="roiFpClosePrev" type="checkbox"'+(p.closePrevious!==false?' checked':'')+'> ';
  h+='End earlier open-ended plan the day before Starts</label>';
  h+='<div id="roiFpPreview" class="roi-fp-preview"></div>';
  h+='<div class="roi-form-actions">';
  h+='<button type="button" class="btn-cancel" onclick="cancelRoiFloorForm()">Cancel</button>';
  h+='<button type="button" class="btn-save" onclick="saveRoiFloorForm(\''+(isNew?'__new__':uid)+'\')">Save floor plan</button>';
  h+='</div></div>';
  setTimeout(function(){ roiFpRefreshPreview(); },0);
  return h;
}
function roiFpVenueChanged(){
  var v=(document.getElementById('roiFpVenue')||{}).value||'';
  var url=document.getElementById('roiFpSourceUrl');
  if(!url) return;
  if(/Beach Club/i.test(v)){
    if(!url.value||/casa-neos\.com/i.test(url.value)) url.value='https://beachclub.casa-neos.com/';
  }else if(/Lounge/i.test(v)&&/Casa Neos/i.test(v)){
    if(!url.value||/casa-neos\.com/i.test(url.value)) url.value='https://lounge.casa-neos.com/';
  }
  roiFpRefreshPreview();
}
function roiFpPresetChanged(){ /* preset field removed from UI; kept for compatibility */ }
function roiFpAutoLabel(venue, start){
  if(!venue) return 'Floor plan';
  if(!start) return venue+' floor plan';
  var parts=String(start).split('-');
  if(parts.length===3){
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var m=months[+parts[1]-1]||parts[1];
    return venue+' · from '+m+' '+String(+parts[2])+', '+parts[0];
  }
  return venue+' · from '+start;
}
function roiFpRefreshPreview(){
  var box=document.getElementById('roiFpPreview');
  if(!box) return;
  var venue=(document.getElementById('roiFpVenue')||{}).value||'';
  var start=(document.getElementById('roiFpStart')||{}).value||'';
  var end=(document.getElementById('roiFpEnd')||{}).value||'';
  var url=((document.getElementById('roiFpSourceUrl')||{}).value||'').trim();
  var uid=_roiEditFloorUid;
  var existing=(uid&&uid!=='__new__'&&ROI_FLOOR_PLANS[uid])?ROI_FLOOR_PLANS[uid]:null;
  var known=_roiFpGuessKnownPreset(venue, url, start)||(existing&&existing.preset)||'';
  var presetEl=document.getElementById('roiFpPreset');
  if(presetEl) presetEl.value=known||'';
  var plan=existing&&existing.plan&&existing.plan.tables?existing.plan:null;
  if(!plan&&known&&typeof _fv3dPlanPayloadFromPreset==='function') plan=_fv3dPlanPayloadFromPreset(known);

  if(!url&&!plan){
    box.innerHTML='<div class="roi-fp-preview-err">Paste the booking site link to continue.</div>';
    return;
  }
  if(!start){
    box.innerHTML='<div class="roi-fp-preview-err">Set <b>Starts</b> — the first date the new floor plan is live on the website.</div>';
    return;
  }
  if(!plan){
    var h0='<div class="roi-fp-preview-ok">';
    h0+='<div class="roi-fp-preview-hd">Ready to save</div>';
    h0+='<p>From <b>'+start+'</b>'+(end?' to <b>'+end+'</b>':' onward')+' at <b>'+_escRoi(venue)+'</b>.</p>';
    h0+='<p class="roi-page-hint">New link — Save queues an automatic grab. The plan usually appears within ~30 minutes (no coding).</p>';
    h0+='</div>';
    box.innerHTML=h0;
    return;
  }
  var tiers=plan.tables||[];
  var nTables=tiers.reduce(function(s,t){ return s+((t.tables&&t.tables.length)||0); },0);
  var tierLine=tiers.map(function(t){ return t.name+'×'+((t.tables&&t.tables.length)||0)+' @'+(t.minimum||0); }).join(' · ')||'No tables';
  var h='<div class="roi-fp-preview-ok">';
  h+='<div class="roi-fp-preview-hd">Ready to save</div>';
  h+='<p>From <b>'+start+'</b>'+(end?' to <b>'+end+'</b>':' onward')+' at <b>'+_escRoi(venue)+'</b>:</p>';
  h+='<ul>';
  h+='<li><b>Badge:</b> '+_escRoi(plan.badge||plan.label||'Custom')+'</li>';
  h+='<li><b>Model:</b> <code style="font-size:10px">'+_escRoi(plan.modelUrl||'')+'</code></li>';
  h+='<li><b>Tables:</b> '+nTables+' ('+_escRoi(tierLine)+')</li>';
  h+='</ul></div>';
  box.innerHTML=h;
}
function _roiFpGuessKnownPreset(venue, url, start){
  var u=String(url||'').toLowerCase();
  if(/lounge\.casa-neos/.test(u)||(/Casa Neos Lounge/i.test(venue)&&!/beach/i.test(u))){
    if(start&&start>='2026-10-01') return 'casa-neos-lounge-oct';
    if(!start||start>='2026-09-25') return 'casa-neos-lounge-new';
  }
  if(/beachclub\.casa-neos|beach.?club|music\.casa-neos/i.test(u)||/Beach Club/i.test(venue)){
    if(start&&start>='2026-12-04'&&start<='2026-12-06') return 'casa-neos-beach-club-basel';
    if(start&&start>='2026-10-05') return 'casa-neos-beach-club-new';
    if(start&&start>='2026-08-01'&&start<='2026-10-04') return 'casa-neos-beach-club-summer';
    if(!start||start>='2026-10-05') return 'casa-neos-beach-club-new';
  }
  return null;
}
function _roiFpQueueIngest(req){
  if(window._fbSave) window._fbSave('floorPlanIngestRequests/'+req._uid, req);
  try{
    var q=JSON.parse(localStorage.getItem('rdg_floor_plan_ingest_q')||'{}');
    q[req._uid]=req;
    localStorage.setItem('rdg_floor_plan_ingest_q', JSON.stringify(q));
  }catch(e){}
}
function _roiFpCloseEarlier(venue, start, newUid){
  var dayBefore=_roiFpDayBefore(start);
  Object.keys(ROI_FLOOR_PLANS||{}).forEach(function(oid){
    if(oid===newUid) return;
    var o=ROI_FLOOR_PLANS[oid];
    if(!o||o.venue!==venue) return;
    if(o.start>=start) return;
    if(o.end&&o.end!=='') return;
    o.end=dayBefore;
    o.updatedAt=new Date().toISOString();
  });
}
function _roiFpOpen3d(venue, start, plan, known){
  var key=(plan&&plan.modelKey)||(known&&FV_3D_PLAN_PRESETS[known]&&FV_3D_PLAN_PRESETS[known].modelKey)||(typeof fv3dKeyForVenue==='function'?fv3dKeyForVenue(venue):null);
  if(!key) return;
  if(typeof _fv3dModelKey!=='undefined') _fv3dModelKey=key;
  if(typeof setView==='function') setView('3d');
  setTimeout(function(){
    if(typeof setFv3dModel==='function') setFv3dModel(key);
    if(typeof setFv3dDate==='function') setFv3dDate(start);
  },80);
}
/* One-button save: attach plan from link/date (or queue scrape) and schedule it. */
function saveRoiFloorForm(uid){
  var labelEl=document.getElementById('roiFpLabel');
  var label=((labelEl||{}).value||'').trim();
  var venue=(document.getElementById('roiFpVenue')||{}).value||'';
  var start=(document.getElementById('roiFpStart')||{}).value||'';
  var end=(document.getElementById('roiFpEnd')||{}).value||'';
  var sourceUrl=((document.getElementById('roiFpSourceUrl')||{}).value||'').trim();
  var closePrev=!!(document.getElementById('roiFpClosePrev')||{}).checked;
  if(!sourceUrl){ alert('Paste the booking site link.'); return; }
  if(!start){ alert('Set Starts — the first date the new floor plan is live on the website.'); return; }
  if(end&&end<start){ alert('Ends must be on or after Starts.'); return; }
  if(!label) label=roiFpAutoLabel(venue, start);

  var newUid=uid==='__new__'?_roiFpUid():uid;
  var prev=ROI_FLOOR_PLANS[newUid]||{};
  var known=_roiFpGuessKnownPreset(venue, sourceUrl, start)||prev.preset||null;
  var plan=prev.plan&&prev.plan.tables?prev.plan:null;
  if(known&&typeof _fv3dPlanPayloadFromPreset==='function'){
    var fromKnown=_fv3dPlanPayloadFromPreset(known);
    if(fromKnown) plan=fromKnown;
  }

  if(closePrev) _roiFpCloseEarlier(venue, start, newUid);

  if(plan){
    ROI_FLOOR_PLANS[newUid]={
      _uid:newUid,
      label:label,
      venue:venue,
      start:start,
      end:end||'',
      preset:known||null,
      sourceUrl:sourceUrl,
      status:'ready',
      plan:plan,
      grabbed:true,
      createdAt:prev.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      seeded:false
    };
    if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();
    _roiEditFloorUid=null;
    var n=plan.tables.reduce(function(s,t){ return s+(t.tables?t.tables.length:0); },0);
    var open3d=confirm('Saved. From '+start+', '+venue+' uses this plan ('+n+' tables).\n\nOpen 3D View?');
    renderRoiRulesPage();
    if(open3d) _roiFpOpen3d(venue, start, plan, known);
    return;
  }

  /* Unknown link — save drop as queued + enqueue scrape */
  ROI_FLOOR_PLANS[newUid]={
    _uid:newUid,
    label:label,
    venue:venue,
    start:start,
    end:end||'',
    preset:null,
    sourceUrl:sourceUrl,
    status:'queued',
    plan:null,
    grabbed:false,
    createdAt:prev.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    seeded:false
  };
  if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();
  var reqId='req_'+newUid;
  _roiFpQueueIngest({
    _uid:reqId,
    dropUid:newUid,
    url:sourceUrl,
    venue:venue,
    start:start,
    end:end||'',
    label:label,
    status:'queued',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  _roiEditFloorUid=null;
  alert('Saved. Automatic grab is queued — the 3D plan usually appears within ~30 minutes. Hard-refresh later or open 3D View on the Starts date once status shows ready.');
  renderRoiRulesPage();
}
function grabRoiFloorFromLink(uid){ saveRoiFloorForm(uid); }
function roiFpOpen3dPreview(){
  var venue=(document.getElementById('roiFpVenue')||{}).value||'';
  var start=(document.getElementById('roiFpStart')||{}).value||'';
  var url=((document.getElementById('roiFpSourceUrl')||{}).value||'').trim();
  var uid=_roiEditFloorUid;
  var existing=(uid&&uid!=='__new__'&&ROI_FLOOR_PLANS[uid])?ROI_FLOOR_PLANS[uid]:null;
  var plan=existing&&existing.plan?existing.plan:null;
  var known=_roiFpGuessKnownPreset(venue, url, start);
  if(!plan&&known&&typeof _fv3dPlanPayloadFromPreset==='function') plan=_fv3dPlanPayloadFromPreset(known);
  if(!start){ alert('Set Starts first.'); return; }
  ROI_FLOOR_PLANS.__draft_preview__={
    _uid:'__draft_preview__', venue:venue, start:start, end:'',
    preset:known||null, plan:plan||null,
    updatedAt:new Date().toISOString(), label:'(preview)'
  };
  _roiFpOpen3d(venue, start, plan, known);
}
function _roiFpDayBefore(ymd){
  if(!ymd||!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  var dt=new Date(ymd+'T12:00:00');
  dt.setDate(dt.getDate()-1);
  var y=dt.getFullYear();
  var m=String(dt.getMonth()+1).padStart(2,'0');
  var d=String(dt.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+d;
}
function deleteRoiFloorPlan(uid){
  if(!ROI_FLOOR_PLANS[uid]) return;
  if(!confirm('Delete this floor plan? Built-in date rules still apply if no other drop covers the range.')) return;
  delete ROI_FLOOR_PLANS[uid];
  if(typeof saveRoiFloorPlans==='function') saveRoiFloorPlans();
  if(_roiEditFloorUid===uid) _roiEditFloorUid=null;
  renderRoiRulesPage();
}
