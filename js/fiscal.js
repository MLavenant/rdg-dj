var FISCAL_WEEKS_445=[4,4,5,4,4,5,4,4,5,4,4,5];
function _parseYmd(s){ return new Date(String(s).slice(0,10)+'T12:00:00'); }
function _pad2(n){ return n<10?'0'+n:''+n; }
function fiscalYearStart(year){
  var d=new Date((+year)-1,11,28,12,0,0,0);
  d.setDate(d.getDate()+((8-d.getDay())%7));
  return _ymdLocal(d);
}
function fiscalYearEnd(year){
  var d=_parseYmd(fiscalYearStart((+year)+1));
  d.setDate(d.getDate()-1);
  return _ymdLocal(d);
}
function fiscalPeriodRange(year, monthIndex0){
  var mi=Math.max(0,Math.min(11,+monthIndex0||0));
  var start=_parseYmd(fiscalYearStart(year));
  var off=0;
  for(var i=0;i<mi;i++) off+=FISCAL_WEEKS_445[i]*7;
  var from=new Date(start.getTime()); from.setDate(from.getDate()+off);
  var to;
  if(mi===11){
    to=_parseYmd(fiscalYearEnd(year));
  } else {
    to=new Date(from.getTime());
    to.setDate(to.getDate()+FISCAL_WEEKS_445[mi]*7-1);
  }
  return {from:_ymdLocal(from), to:_ymdLocal(to), weeks:FISCAL_WEEKS_445[mi], days:Math.round((to-from)/86400000)+1};
}
function fiscalMm(monthIndex0){ return _pad2((+monthIndex0)+1); }
function fiscalMonthIndexFromMm(mm){ return Math.max(0,Math.min(11,(parseInt(mm,10)||1)-1)); }
function dateInFiscalPeriod(dateStr, year, monthIndex0){
  if(!dateStr) return false;
  var r=fiscalPeriodRange(year, monthIndex0);
  return dateStr>=r.from && dateStr<=r.to;
}
function dateInFiscalYear(dateStr, year){
  if(!dateStr) return false;
  return dateStr>=fiscalYearStart(year) && dateStr<=fiscalYearEnd(year);
}
function fiscalYearForDate(dateStr){
  var y=parseInt(String(dateStr).slice(0,4),10);
  if(dateStr>=fiscalYearStart(y+1)) return y+1;
  if(dateStr<fiscalYearStart(y)) return y-1;
  return y;
}
function fiscalInfoForDate(dateStr){
  var fy=fiscalYearForDate(dateStr);
  for(var mi=0;mi<12;mi++){
    if(dateInFiscalPeriod(dateStr, fy, mi)) return {year:fy, monthIndex:mi, mm:fiscalMm(mi)};
  }
  return {year:fy, monthIndex:0, mm:'01'};
}
function datesInFiscalPeriod(year, monthIndex0){
  var r=fiscalPeriodRange(year, monthIndex0);
  var out=[], d=_parseYmd(r.from), end=_parseYmd(r.to);
  while(d<=end){ out.push(_ymdLocal(d)); d.setDate(d.getDate()+1); }
  return out;
}
/* Stable per-show id so multiple performances on the same date sync correctly.
   Bake / single-show nights: venue|date ONLY (never dj|fee) so rename/fee edits
   do not orphan Firebase overlays. True multi-adds keep random uids. */
function stableShowUidForNight(venue, d){
  var base=[venue||'', d||''].join('|');
  var h=2166136261;
  for(var i=0;i<base.length;i++){ h^=base.charCodeAt(i); h=(h*16777619)>>>0; }
  return 's_'+h.toString(36)+'_'+String(d||'').replace(/-/g,'');
}
function ensureShowUid(rec){
  if(!rec) return '';
  if(rec._uid) return rec._uid;
  /* New adds get a random uid so identical DJ/fee same night never collide. */
  if(rec._added){
    rec._uid='s_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    return rec._uid;
  }
  rec._uid=stableShowUidForNight(rec.venue||rec.v||'', rec.d||'');
  return rec._uid;
}
/* Retarget non-add rows onto stable venue|date uid so old dj|fee hashes heal on save. */
function preferStableShowUid(rec){
  if(!rec||!rec.d) return '';
  if(rec._added) return ensureShowUid(rec);
  var stable=stableShowUidForNight(rec.venue||rec.v||'', rec.d);
  if(rec._uid && rec._uid!==stable){
    rec._prevUid=rec._uid;
    rec._uid=stable;
  } else if(!rec._uid){
    rec._uid=stable;
  }
  return rec._uid;
}
function schedIsBlankIdentity(rec){
  if(!rec) return false;
  var djBlank=!rec.dj || !String(rec.dj).trim();
  var fee=rec.fee!=null?rec.fee:(rec.cost!=null?rec.cost:null);
  return djBlank && fee==null;
}
function _schedDateKey(rec){ return rec?((rec.venue||rec.v||'')+'|'+rec.d):''; }
function _schedUidKey(rec){
  if(!rec||!rec.d) return '';
  return _schedDateKey(rec)+'|'+ensureShowUid(rec);
}
function _schedKeysMatch(a,b){
  if(!a||!b) return false;
  if(a._uid&&b._uid) return a._uid===b._uid;
  return _schedDateKey(a)===_schedDateKey(b) && (a.dj||'')===(b.dj||'') && String(a.fee!=null?a.fee:(a.cost||''))===String(b.fee!=null?b.fee:(b.cost||''));
}
function _countShowsOnDate(venue, dateStr){
  if(!dateStr) return 0;
  var n=0;
  SCHED.forEach(function(r){
    if(!r||r._s==='empty'||!r.d) return;
    if(r.d!==dateStr) return;
    if(venue && (r.v||r.venue)!==venue) return;
    n++;
  });
  return n;
}
function getShowDjStatus(r, ds){
  if(r && Object.prototype.hasOwnProperty.call(r,'djStatus')) return r.djStatus||null;
  var date=ds||(r&&r.d)||'';
  var venue=r&&(r.v||r.venue);
  /* Multi-show nights: do not share date-level Accounting status across performances. */
  if(_countShowsOnDate(venue, date)>1) return null;
  try{ return (getAcct(date).djStatus)||null; }catch(e){ return null; }
}
function _isCoarsePointer(){
  try{ if(window.matchMedia && window.matchMedia('(pointer:coarse)').matches) return true; }catch(e){}
  return ('ontouchstart' in window) && (navigator.maxTouchPoints>0);
}
function fiscalPeriodShortRange(year, monthIndex0){
  var r=fiscalPeriodRange(year, monthIndex0);
  var a=_parseYmd(r.from), b=_parseYmd(r.to);
  var sh=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return sh[a.getMonth()]+' '+a.getDate()+'\u2013'+sh[b.getMonth()]+' '+b.getDate();
}
function inFiscalMonthFilter(r, year, mm){
  if(!r||!r.d||r._s==='empty') return false;
  if(!mm) return dateInFiscalYear(r.d, year);
  return dateInFiscalPeriod(r.d, year, fiscalMonthIndexFromMm(mm));
}
function feeTierClass(fee){
  if(fee==null||fee===''||isNaN(+fee)||!(+fee>0)) return '';
  var f=+fee;
  if(f<10000) return 'fee-tier-low';
  if(f<=50000) return 'fee-tier-mid';
  return 'fee-tier-high';
}
function feeRowClass(fee){
  var tier=feeTierClass(fee);
  return tier ? tier.replace('fee-tier-','fee-row-') : '';
}
function updateTopbarLogo(venue){
  var v=venue||((typeof curV!=='undefined')?curV:'');
  var logo=(typeof venueLogo==='function')?venueLogo(v):'';
  var tbLogo=document.getElementById('topbarLogo');
  if(!tbLogo) return;
  if(logo){ tbLogo.src=logo; tbLogo.classList.remove('hidden'); tbLogo.alt=v||''; }
  else { tbLogo.classList.add('hidden'); tbLogo.removeAttribute('src'); }
}
try{
  var _bootFiscal=fiscalInfoForDate(TODAY);
  curYr=_bootFiscal.year;
  curM=_bootFiscal.monthIndex;
}catch(e){}

function _schedShowOn(venue, dateStr){
  if(!venue||!dateStr) return null;
  var best=null;
  SCHED.forEach(function(r){
    if((r.v||r.venue)!==venue) return;
    if(r._s==='empty'||!r.d||r.d!==dateStr) return;
    var nm=(r.dj||'').trim();
    if(!nm) return;
    if(!best || ((r.bs_a||0)>(best.bs_a||0))) best=r;
  });
  return best;
}
function _pyFieldsFromShow(m){
  if(!m) return {py_dj:null,py_fee:null,py_bs_m:null,py_bs_a:null,py_roi_t:null,py_roi_a:null,py_beat:null};
  var fee=m.fee||m.cost||null;
  var tgt=(typeof showTargets==='function')?showTargets(m):{bs_m:m.bs_m,roi_t:m.roi_t};
  var bsM=tgt.bs_m!=null?tgt.bs_m:m.bs_m;
  var roiT=tgt.roi_t!=null?tgt.roi_t:m.roi_t;
  var beat=m.beat;
  if(beat==null && m.bs_a!=null && bsM!=null) beat=m.bs_a>=bsM?1:0;
  return {
    py_dj:m.dj, py_fee:fee, py_bs_m:bsM, py_bs_a:m.bs_a||null,
    py_roi_t:roiT, py_roi_a:m.roi_a||null, py_beat:beat
  };
}
function _pyShowKey(r){ return (r.d||'')+'|'+(r.dj||''); }
function _sameWeekday(a, b){
  var da=new Date(a+'T12:00:00'), db=new Date(b+'T12:00:00');
  if(isNaN(da.getTime())||isNaN(db.getTime())) return false;
  return da.getDay()===db.getDay();
}

/** Unique PY assignment for a venue-month: each prior-year show used at most once. */
var _pyMapCache={key:'', map:null};
function clearPyMapCache(){ _pyMapCache={key:'', map:null}; }
function buildPyMapForMonth(venue, yr, mm){
  var cacheKey=venue+'|'+yr+'|'+mm+'|445';
  if(_pyMapCache.key===cacheKey && _pyMapCache.map) return _pyMapCache.map;
  var map={};
  var used={};
  var mi=fiscalMonthIndexFromMm(mm);
  var dates=datesInFiscalPeriod(yr, mi);
  var pyDates=datesInFiscalPeriod(yr-1, mi);
  var empty={py_dj:null,py_fee:null,py_bs_m:null,py_bs_a:null,py_roi_t:null,py_roi_a:null,py_beat:null};

  function claim(ds, show){
    if(!show) return false;
    var k=_pyShowKey(show);
    if(used[k]) return false;
    used[k]=true;
    map[ds]=_pyFieldsFromShow(show);
    return true;
  }

  /* Pass 1: same index day in prior fiscal period when weekday matches */
  dates.forEach(function(ds, idx){
    var pyDate=pyDates[Math.min(idx, pyDates.length-1)];
    if(!pyDate || !_sameWeekday(ds, pyDate)) return;
    claim(ds, _schedShowOn(venue, pyDate));
  });

  /* Pass 2: nearest same-weekday unused show in prior fiscal period */
  dates.forEach(function(ds){
    if(map[ds]) return;
    var d=_parseYmd(ds);
    if(isNaN(d.getTime())) return;
    var wantDow=d.getDay();
    var best=null, bestDist=1e15;
    var anchorIdx=dates.indexOf(ds);
    var anniversary=pyDates[Math.min(Math.max(anchorIdx,0), pyDates.length-1)];
    var annT=_parseYmd(anniversary).getTime();
    SCHED.forEach(function(r){
      if((r.v||r.venue)!==venue) return;
      if(r._s==='empty'||!r.d) return;
      if(!dateInFiscalPeriod(r.d, yr-1, mi)) return;
      if(used[_pyShowKey(r)]) return;
      if(!(r.dj||'').trim()) return;
      var rd=_parseYmd(r.d);
      if(isNaN(rd.getTime())||rd.getDay()!==wantDow) return;
      var dist=Math.abs(rd.getTime()-annT);
      if(dist<bestDist){ bestDist=dist; best=r; }
    });
    if(best && bestDist<=10*86400000) claim(ds, best);
  });

  dates.forEach(function(ds){ if(!map[ds]) map[ds]=empty; });
  _pyMapCache={key:cacheKey, map:map};
  return map;
}

function findPriorYearMatch(venue, dateStr){
  if(!venue||!dateStr) return null;
  var info=fiscalInfoForDate(dateStr);
  var map=buildPyMapForMonth(venue, info.year, info.mm);
  var f=map[dateStr];
  if(!f||!f.py_dj) return null;
  var pyDates=datesInFiscalPeriod(info.year-1, info.monthIndex);
  var idx=datesInFiscalPeriod(info.year, info.monthIndex).indexOf(dateStr);
  var approx=pyDates[Math.min(Math.max(idx,0), pyDates.length-1)];
  return (approx && _schedShowOn(venue, approx)) ||
    SCHED.find(function(r){
      return (r.v||r.venue)===venue && r._s!=='empty' && r.d &&
        String(r.dj||'')===String(f.py_dj||'') &&
        dateInFiscalPeriod(r.d, info.year-1, info.monthIndex);
    }) || null;
}
function resolvePyFields(venue, dateStr, baked){
  if(venue&&dateStr&&dateStr.length>=10){
    var info=fiscalInfoForDate(dateStr);
    var map=buildPyMapForMonth(venue, info.year, info.mm);
    if(map[dateStr] && map[dateStr].py_dj) return map[dateStr];
  }
  /* Do not fall back to baked py_* ? it caused duplicate PY names across days. */
  return {py_dj:null,py_fee:null,py_bs_m:null,py_bs_a:null,py_roi_t:null,py_roi_a:null,py_beat:null};
}
function _pyCellsHtml(py, rowspan){
  var pyNm=djLabel(py.py_dj, '');
  var pyBCls=perfTone(py.py_bs_a, py.py_bs_m, py.py_fee, py.py_roi_a, py.py_roi_t);
  var pyRCls=pyBCls;
  var pyFeeCls=feeTierClass(py.py_fee);
  var rs=rowspan && rowspan>1 ? ' rowspan="'+rowspan+'"' : '';
  var h='<td class="sc-py"'+rs+' title="Prior year ('+((py&&py.py_dj)? 'last year lineup':'no show last year')+') — not a second booking this year">';
  if(pyNm) h+='<span class="sc-py-badge">LY</span> <b class="'+pyBCls+'">'+pyNm+'</b>';
  else h+='-';
  h+='</td>';
  h+='<td class="sc-num fee-cell '+(pyFeeCls||'py-dim')+'"'+rs+'>'+$k(py.py_fee)+'</td>';
  h+='<td class="sc-num py-dim"'+rs+'>'+$k(py.py_bs_m)+'</td>';
  h+='<td class="sc-num '+pyBCls+'"'+rs+'><b>'+$k(py.py_bs_a)+'</b></td>';
  h+='<td class="sc-num py-dim"'+rs+'>'+rx(py.py_roi_t)+'</td>';
  h+='<td class="sc-num '+pyRCls+'"'+rs+'><b>'+rx(py.py_roi_a)+'</b></td>';
  return h;
}


/*    formatters                                                     */
function $k(n) { /* always K/M with one-decimal thousands */
  if (n == null || isNaN(n)) return '-';
  var a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6)  return s + '$' + (a/1e6).toFixed(2) + 'M';
  if (a >= 1000) return s + '$' + (a/1000).toFixed(1).replace(/\.0$/,'') + 'K';
  return s + '$' + Math.round(a);
}
function $kv(n) {
  if (n == null) return '-';
  var a = Math.abs(n), s = n >= 0 ? '+' : '-';
  if (a >= 1e6)  return s + '$' + (a/1e6).toFixed(2) + 'M';
  if (a >= 1000) return s + '$' + (a/1000).toFixed(1).replace(/\.0$/,'') + 'K';
  return s + '$' + Math.round(a);
}
function rx(n) { return n != null ? (+n).toFixed(1) + 'x' : '-'; }
/* ROI color vs target (1-decimal): above = green, equal or within 0.1 below = orange, else red */
function roiTone(actual, target){
  if(actual==null||target==null||isNaN(+actual)||isNaN(+target)) return '';
  var a=Math.round(+actual*10)/10;
  var t=Math.round(+target*10)/10;
  if(a > t) return 'hit';
  if(a >= t - 0.1) return 'near'; /* equal or within 0.1x below = gold */
  return 'low';
}
/* Shared tone for DJ name + BS Actual + ROI Act ? compare the same 1-decimal ROI the user sees */
function perfTone(bs_a, bs_m, fee, roi_a, roi_t){
  var feeN = fee != null ? +fee : 0;
  var ra = null, rt = null;
  if(roi_a != null && !isNaN(+roi_a)) ra = +roi_a;
  else if(feeN > 0 && bs_a != null && !isNaN(+bs_a)) ra = +bs_a / feeN;
  if(roi_t != null && !isNaN(+roi_t)) rt = +roi_t;
  else if(feeN > 0 && bs_m != null && !isNaN(+bs_m)) rt = +bs_m / feeN;
  if(ra != null && rt != null) return roiTone(ra, rt);
  return bsTone(bs_a, bs_m, fee);
}
function toneColor(cls){
  if(cls==='hit') return 'var(--beat)';
  if(cls==='near') return 'var(--amb)';
  if(cls==='low') return 'var(--miss)';
  return '';
}
function toneStyle(cls){
  var c=toneColor(cls);
  return c ? ('color:'+c+'!important') : '';
}
/* BS Actual color ? same near band as ROI (0.1x of fee in $), so Calussa etc. match gold across columns */
function bsTone(actual, target, fee){
  if(actual==null||target==null||isNaN(+actual)||isNaN(+target)) return '';
  if(fee!=null && +fee>0) return roiTone(+actual/+fee, +target/+fee);
  var a=+actual, t=+target;
  if(a >= t) return 'hit';
  if(a >= t - Math.max(t * 0.02, 2500)) return 'near';
  return 'low';
}
function roiToneIcon(cls){
  if(cls==='hit') return '&#9650;';
  if(cls==='near') return '&#9679;';
  if(cls==='low') return '&#9660;';
  return '';
}
function bsToneIcon(cls){ return roiToneIcon(cls); }
/* Live month stats from SCHED (same beat/miss rules as calendar) */
function monthPerfFromSched(yr, venue, mm){
  var shows = SCHED.filter(function(r){
    return (r.v||r.venue)===venue && r.d && r._s!=='empty' && inFiscalMonthFilter(r, yr, mm);
  });
  var rows = shows.map(function(r){
    var tgt = (typeof showTargets==='function') ? showTargets(r) : {bs_m:r.bs_m, roi_t:r.roi_t};
    var bsM = tgt && tgt.bs_m != null ? tgt.bs_m : r.bs_m;
    var fee = r.fee || r.cost || 0;
    var roiT = tgt && tgt.roi_t != null ? tgt.roi_t : (fee && bsM ? +(bsM/fee).toFixed(4) : r.roi_t);
    var roiA = r.roi_a != null ? r.roi_a : (fee && r.bs_a != null ? +(r.bs_a/fee).toFixed(4) : null);
    return {
      r:r, dj:r.dj, d:r.d, fee:fee, bs_a:r.bs_a, bs_m:bsM, roi_a:roiA, roi_t:roiT,
      _s:r._s, beat:r._s==='beat'?1:r._s==='miss'?0:null,
      bTone:perfTone(r.bs_a, bsM, fee, roiA, roiT), rTone:perfTone(r.bs_a, bsM, fee, roiA, roiT)
    };
  });
  var measured = rows.filter(function(x){ return x._s==='beat' || x._s==='miss'; });
  var beats = measured.filter(function(x){ return x._s==='beat'; }).length;
  var tBS = rows.reduce(function(s,x){ return s+(x.bs_a||0); },0);
  var tBSM = rows.reduce(function(s,x){ return s+(x.bs_m||0); },0);
  var tFee = rows.reduce(function(s,x){ return s+(x.fee||0); },0);
  var rois = measured.filter(function(x){ return x.roi_a!=null; }).map(function(x){ return +x.roi_a; });
  var avgR = rois.length ? (rois.reduce(function(a,b){return a+b;},0)/rois.length) : null;
  return {
    shows:rows, nShows:rows.length, measured:measured.length, beats:beats,
    tBS:tBS, tBSM:tBSM, tFee:tFee, avgR:avgR,
    isEmpty:!rows.length, isFuture:!tBS && rows.some(function(x){ return x._s==='fut'||x._s==='tbd'||!x.bs_a; }) && !measured.length
  };
}

/*    Get venue-year shows                                            */
function getShows(yr, venue, mm) {
  return SCHED.filter(function(r) {
    if ((r.v||r.venue) !== venue) return false;
    if (r._s === 'empty' || !r.d) return false;
    return inFiscalMonthFilter(r, yr, mm);
  });
}
function getBSRecs(yr, venue, mm) {
  return BS.filter(function(r) {
    if (r.venue !== venue || !r.d) return false;
    if (!(r.bs_a || r.bs_m)) return false;
    return inFiscalMonthFilter({d:r.d,_s:'ok'}, yr, mm);
  });
}

/* Undo UI removed. Saves still last-write to Firebase; no local reverse stack. */
function pushUndo(){}
function refreshUndoUI(){}
function openUndoHistory(){}
function closeUndoHistory(){}
function undoToIndex(){}
function _clone(v){ return v==null?v:JSON.parse(JSON.stringify(v)); }
function _escHtml(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* Repair known accent losses from the original spreadsheet import while
   preserving intentional question-mark planning annotations. */
var DJ_ACCENT_FIXES={
  'B?douin':'B\u00e9douin',
  'Mal?ne':'Mal\u00e8ne',
  'DEMAY?':'DEMAY\u00c9',
  'MEL?':'MEL\u00c9'
};
function fixKnownAccents(value){
  var s=String(value==null?'':value);
  Object.keys(DJ_ACCENT_FIXES).forEach(function(bad){
    if(s.indexOf(bad)>=0) s=s.split(bad).join(DJ_ACCENT_FIXES[bad]);
  });
  return s;
}
function normalizeKnownAccents(){
  SCHED.forEach(function(r){ if(r&&r.dj) r.dj=fixKnownAccents(r.dj); });
  if(typeof SCHED_BAKED!=='undefined') SCHED_BAKED.forEach(function(r){ if(r&&r.dj) r.dj=fixKnownAccents(r.dj); });
  if(typeof BS!=='undefined') BS.forEach(function(r){ if(r&&r.dj) r.dj=fixKnownAccents(r.dj); });
}

/* Named presence is stored outside rdg/ so heartbeats do not trigger full
   dashboard re-renders. */
var _presenceRows={};
var _presenceRef=null;
var _presenceSessionId=null;
var SESSION_IDLE_MS=20*60*1000;
function _presenceName(){
  var name='';
  try{ name=localStorage.getItem('rdg_presence_name')||''; }catch(e){}
  name=String(name||'').trim();
  if(!name || /^guest(\s|$)/i.test(name)) return '';
  return name;
}
function _sessionIsActive(){
  try{
    if(sessionStorage.getItem('rdg_session_active')!=='1') return false;
    var t=+sessionStorage.getItem('rdg_session_activity')||0;
    if(!t || Date.now()-t>SESSION_IDLE_MS) return false;
    if(!_presenceName()) return false;
    return true;
  }catch(e){ return false; }
}
function _touchSessionActivity(){
  if(!_sessionIsActive()) return;
  try{ sessionStorage.setItem('rdg_session_activity', String(Date.now())); }catch(e){}
}
function _showSessionGate(msg){
  var gate=document.getElementById('sessionGate');
  var note=document.getElementById('sessionGateNote');
  var inp=document.getElementById('sessionGateName');
  var cancel=document.getElementById('sessionGateCancel');
  if(note) note.textContent=msg||'Enter your name to continue.';
  if(inp) inp.value=_presenceName();
  if(cancel) cancel.style.display=_sessionIsActive() ? '' : 'none';
  if(gate){
    gate.classList.remove('hidden');
    document.body.classList.add('session-locked');
    setTimeout(function(){ try{ inp && inp.focus(); }catch(e){} }, 50);
  }
}
function _hideSessionGate(){
  var gate=document.getElementById('sessionGate');
  if(gate) gate.classList.add('hidden');
  document.body.classList.remove('session-locked');
}
function cancelSessionGate(){
  if(_sessionIsActive()) _hideSessionGate();
}
function _appVersionLocal(){
  return String(window.RDG_APP_VERSION||'').trim();
}
function _appIndexFetchUrl(){
  var base=location.href.split('#')[0].split('?')[0];
  if(/index\.html$/i.test(base)) return base;
  return base.replace(/\/?$/,'/')+'index.html';
}
/** After idle / sign-in: if GitHub Pages has a newer build, hard-reload onto it. */
function _ensureLatestAppThen(done){
  var local=_appVersionLocal();
  var fetchUrl=_appIndexFetchUrl();
  var finished=false;
  function finish(){
    if(finished) return;
    finished=true;
    if(typeof done==='function') done();
  }
  var t=setTimeout(finish, 4000);
  try{
    fetch(fetchUrl+'?_='+Date.now(), {cache:'no-store', credentials:'same-origin'})
      .then(function(r){ return r.text(); })
      .then(function(html){
        clearTimeout(t);
        var m=String(html||'').match(/RDG_APP_VERSION\s*=\s*['"]([\d.]+)['"]/)
          || String(html||'').match(/RDG DJ Dashboard v([\d.]+)/);
        var remote=m ? String(m[1]).trim() : '';
        if(remote && local && remote!==local){
          try{
            sessionStorage.setItem('rdg_session_active','1');
            sessionStorage.setItem('rdg_session_activity', String(Date.now()));
          }catch(eKeep){}
          var dest=location.pathname;
          if(!/index\.html$/i.test(dest) && !/\/$/.test(dest)) dest+='/';
          location.replace(dest+'?v='+encodeURIComponent(remote)+'&_='+Date.now());
          return;
        }
        finish();
      })
      .catch(function(){ clearTimeout(t); finish(); });
  }catch(eFetch){
    clearTimeout(t);
    finish();
  }
}
function _sessionLogout(reason){
  try{
    sessionStorage.removeItem('rdg_session_active');
    sessionStorage.removeItem('rdg_session_activity');
  }catch(e){}
  try{ if(_presenceRef) _presenceRef.remove(); }catch(e2){}
  try{ if(window._fbDb) window._fbDb.goOffline(); }catch(e3){}
  refreshPresenceChip();
  _showSessionGate(reason==='idle'
    ? 'Signed out after 20 minutes idle. Enter your name to continue.'
    : 'Enter your name to continue.');
}
function submitSessionGate(){
  var inp=document.getElementById('sessionGateName');
  var name=inp ? String(inp.value||'').trim() : '';
  if(!_setPresenceName(name)){
    var note=document.getElementById('sessionGateNote');
    if(note) note.textContent='Please enter your real name (not Guest).';
    if(inp) inp.focus();
    return;
  }
  var btn=document.querySelector('#sessionGate .btn-save');
  if(btn){ btn.disabled=true; btn.textContent='Checking…'; }
  _ensureLatestAppThen(function(){
    try{
      sessionStorage.setItem('rdg_session_active','1');
      sessionStorage.setItem('rdg_session_activity', String(Date.now()));
    }catch(e){}
    _hideSessionGate();
    try{ if(window._fbDb) window._fbDb.goOnline(); }catch(eOn){}
    _writePresence();
    refreshPresenceChip();
    if(btn){ btn.disabled=false; btn.textContent='Continue'; }
  });
}
function initSessionWatch(){
  if(window._sessionWatchReady) return;
  window._sessionWatchReady=true;
  ['pointerdown','keydown','click','scroll','touchstart'].forEach(function(ev){
    document.addEventListener(ev, function(){
      var marked=false;
      try{ marked=sessionStorage.getItem('rdg_session_active')==='1'; }catch(e){}
      if(!marked) return;
      if(!_sessionIsActive()) _sessionLogout('idle');
      else _touchSessionActivity();
    }, {passive:true});
  });
  setInterval(function(){
    var marked=false;
    try{ marked=sessionStorage.getItem('rdg_session_active')==='1'; }catch(e){}
    if(marked && !_sessionIsActive()) _sessionLogout('idle');
  }, 15000);
  if(!_sessionIsActive()){
    _showSessionGate('Enter your name to open the DJ Dashboard.');
  } else {
    _hideSessionGate();
    _touchSessionActivity();
  }
}
function _presenceDeviceLabel(){
  var ua=navigator.userAgent||'';
  var browser='Browser';
  if(/Edg\//.test(ua)) browser='Edge';
  else if(/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser='Chrome';
  else if(/Firefox\//.test(ua)) browser='Firefox';
  else if(/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser='Safari';
  var os='computer';
  if(/Windows/i.test(ua)) os='Windows';
  else if(/Mac OS X|Macintosh/i.test(ua)) os='Mac';
  else if(/Android/i.test(ua)) os='Android';
  else if(/iPhone|iPad|iPod/i.test(ua)) os='iOS';
  else if(/Linux/i.test(ua)) os='Linux';
  return browser+' on '+os;
}
function _setPresenceName(name){
  name=String(name||'').trim().slice(0,40);
  if(!name || /^guest(\s|$)/i.test(name)) return false;
  try{ localStorage.setItem('rdg_presence_name',name); }catch(e){}
  _writePresence();
  refreshPresenceChip();
  return true;
}
function _askPresenceName(force){
  _showSessionGate(force ? 'Update the name others see on this computer.' : 'Enter your name to continue.');
  return _presenceName();
}
function editPresenceName(){
  _showSessionGate('Update the name others see on this computer.');
}
function _presencePayload(){
  return {
    name:_presenceName()||('Unnamed '+String(_presenceSessionId||'').slice(-4)),
    device:_presenceDeviceLabel(),
    connectedAt:firebase.database.ServerValue.TIMESTAMP,
    lastSeen:firebase.database.ServerValue.TIMESTAMP,
    view:curView||'calendar'
  };
}
function _writePresence(){
  if(!_presenceRef) return;
  if(!_sessionIsActive() || !_presenceName()) return;
  _presenceRef.update(_presencePayload());
}
function _activePresenceRows(){
  var now=Date.now();
  return Object.keys(_presenceRows||{}).map(function(k){
    var row=_presenceRows[k]||{}; row._id=k; return row;
  }).filter(function(row){
    return !row.lastSeen || now-(+row.lastSeen)<150000;
  }).sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); });
}
function refreshPresenceChip(){
  var rows=_activePresenceRows();
  var chip=document.getElementById('presenceChip');
  var txt=document.getElementById('presenceChipText');
  var me=_presenceName();
  if(chip){
    chip.classList.toggle('online',!!rows.length);
    chip.title=me ? ('Signed in as '+me+' · click to change name') : 'Enter your name to sign in';
  }
  if(txt) txt.textContent=me && _sessionIsActive() ? (rows.length+' online · '+me) : (rows.length+' online · sign in');
}
function initPresence(){
  if(!window._fbDb) return;
  try{
    initSessionWatch();
    _presenceSessionId=sessionStorage.getItem('rdg_presence_session')||'';
    if(!_presenceSessionId){
      _presenceSessionId='s_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
      sessionStorage.setItem('rdg_presence_session',_presenceSessionId);
    }
    window._fbDb.ref('.info/connected').on('value',function(snap){
      if(snap.val()!==true) return;
      if(!_sessionIsActive() || !_presenceName()) return;
      _presenceRef=window._fbDb.ref('rdgPresence/'+_presenceSessionId);
      _presenceRef.onDisconnect().remove();
      _presenceRef.set(_presencePayload());
    });
    window._fbDb.ref('rdgPresence').on('value',function(snap){
      _presenceRows=snap.val()||{};
      refreshPresenceChip();
      if(curView==='system') renderSystem();
    });
    setInterval(_writePresence,45000);
  }catch(err){ console.warn('Presence unavailable',err); }
}
function unlockSanity(){
  try{ if(sessionStorage.getItem('rdg_sanity_unlocked')==='1') return true; }catch(e){}
  var pw=prompt('Sanity password:');
  if(pw!=='matthias'){ if(pw!==null) alert('Incorrect password.'); return false; }
  try{ sessionStorage.setItem('rdg_sanity_unlocked','1'); }catch(e){}
  return true;
}

/* Layout: auto mobile detection + manual Mobile/Laptop override */
var LAYOUT_PREF_KEY='rdg_layout_mode';
var layoutModePref=null;
function detectMobileLayout(){
  try{
    if(window.matchMedia && window.matchMedia('(max-width:900px)').matches) return true;
    if(window.matchMedia && window.matchMedia('(pointer:coarse)').matches && Math.min(window.innerWidth||0,window.innerHeight||0)<=920) return true;
  }catch(e){}
  var ua=navigator.userAgent||'';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) && (window.innerWidth||0)<=1024;
}
function effectiveLayoutMode(){
  if(layoutModePref==='mobile'||layoutModePref==='desktop') return layoutModePref;
  return detectMobileLayout()?'mobile':'desktop';
}
function closeMobileNav(){
  document.body.classList.remove('nav-open');
  var btn=document.getElementById('mobileNavBtn');
  if(btn){ btn.innerHTML='&#9776;'; btn.setAttribute('aria-label','Open menu'); }
}
function toggleMobileNav(){
  document.body.classList.toggle('nav-open');
  var open=document.body.classList.contains('nav-open');
  var btn=document.getElementById('mobileNavBtn');
  if(btn){ btn.innerHTML=open?'&#10005;':'&#9776;'; btn.setAttribute('aria-label',open?'Close menu':'Open menu'); }
}
function refreshLayoutToggle(){
  var locked=layoutModePref==='mobile'||layoutModePref==='desktop';
  var mode=effectiveLayoutMode();
  var a=document.getElementById('layoutAutoBtn');
  var m=document.getElementById('layoutMobileBtn');
  var d=document.getElementById('layoutDesktopBtn');
  if(a) a.classList.toggle('on', !locked);
  if(m) m.classList.toggle('on', locked && mode==='mobile');
  if(d) d.classList.toggle('on', locked && mode==='desktop');
}
function applyLayoutMode(){
  var mode=effectiveLayoutMode();
  document.body.classList.toggle('mobile-mode', mode==='mobile');
  if(mode!=='mobile') closeMobileNav();
  refreshLayoutToggle();
  try{ if(typeof go==='function' && curView==='calendar') go(); }catch(e){}
}
function setLayoutMode(mode){
  layoutModePref=(mode==='mobile'||mode==='desktop')?mode:null;
  try{
    if(layoutModePref) localStorage.setItem(LAYOUT_PREF_KEY, layoutModePref);
    else localStorage.removeItem(LAYOUT_PREF_KEY);
  }catch(e){}
  closeMobileNav();
  applyLayoutMode();
}
function initLayoutMode(){
  try{
    var saved=localStorage.getItem(LAYOUT_PREF_KEY);
    if(saved==='mobile'||saved==='desktop') layoutModePref=saved;
  }catch(e){}
  applyLayoutMode();
  if(window.matchMedia){
    try{
      var mq=window.matchMedia('(max-width:900px)');
      var onChange=function(){ if(!layoutModePref) applyLayoutMode(); };
      if(mq.addEventListener) mq.addEventListener('change', onChange);
      else if(mq.addListener) mq.addListener(onChange);
    }catch(e){}
  }
  window.addEventListener('resize', function(){ if(!layoutModePref) applyLayoutMode(); });
  document.addEventListener('keydown', function(ev){
    if(ev.key==='Escape') closeMobileNav();
  });
}

/*     BOOT                                                         */
try{ initSessionWatch(); }catch(eSess){}
