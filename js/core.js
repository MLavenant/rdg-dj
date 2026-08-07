function boot() {
  normalizeKnownAccents();
  loadSavedRules();
  loadSavedVenueRules();
recalcAllSchedTargets(); /* boot */
  loadSavedMonthlyBudget();
  IDX = buildIdx(SCHED);
  /* Start on today's fiscal period so every venue/year lands on a real week strip */
  try{
    var _bootNow=fiscalInfoForDate(TODAY);
    curYr=_bootNow.year; curM=_bootNow.monthIndex;
  }catch(eBoot){ curYr=2026; curM=0; }
  buildSidebar();
  buildVenTabs();
  buildYrPills();
  initLayoutMode();
  setView('calendar');
  initPresence();
  refreshUndoUI();
  /* Fire once-per-week VIP recap popup */
  setTimeout(checkNewWeekPopup, 800);
}

/*    Sidebar                                                      */
function buildSidebar() {
  var venues = listActiveVenues();
  var html = '<div class="sb-section-lbl">Views</div>';
  [
    {id:'calendar',   ic:'&#9783;',  lb:'Calendar'},
    {id:'summary',    ic:'&#9776;',  lb:'Bottle Service Monthly Summary'},
    {id:'allshows',   ic:'&#9776;',  lb:'All Shows'},
    {id:'leaderboard',ic:'&#9650;',  lb:'ROI Ranking'},
    {id:'budget',     ic:'&#36;',    lb:'Budget'},
    {id:'accounting', ic:'&#9998;',  lb:'Accounting'},
  ].forEach(function(b) {
    html += '<button class="sb-btn" data-view="'+b.id+'" onclick="setView(\''+b.id+'\')">'
          + '<span class="sb-ic">'+b.ic+'</span>'+b.lb+'</button>';
  });
  html += '<div class="sb-section-lbl" style="margin-top:8px">Forecasting &amp; Results</div>';
  [
    {id:'vip',        ic:'&#9889;', lb:'Weekly Flash'},
    {id:'forecast',   ic:'&#9650;',  lb:'Forecast'},
  ].forEach(function(b) {
    html += '<button class="sb-btn" data-view="'+b.id+'" onclick="setView(\''+b.id+'\')">'
          + '<span class="sb-ic">'+b.ic+'</span>'+b.lb+'</button>';
  });
  html += '<button class="sb-btn sb-btn-live" data-view="live" onclick="setView(\'live\')">'
        + '<span class="sb-ic">&#9679;</span>LIVE</button>';
  html += '<button class="sb-btn" data-view="3d" onclick="setView(\'3d\')">'
        + '<span class="sb-ic">&#127760;</span>3D View</button>';
  html += '<div class="sb-section-lbl" style="margin-top:8px">Admin</div>';
  html += '<button class="sb-btn" data-view="system" onclick="setView(\'system\')">'
        + '<span class="sb-ic">&#9881;</span>Sanity</button>';
  html += '<div class="sb-section-lbl">Venues</div>';
  venues.forEach(function(v) {
    var c=venueColor(v);
    html += '<button class="sb-ven-btn'+(v===curV?' on':'')+'" data-v="'+v+'" onclick="selVenue(\''+v+'\')" style="border-left:3px solid '+c.a+'">'
          + '<span class="sb-dot" style="background:'+c.a+'"></span>' + v + '</button>';
  });
  document.getElementById('sidebar').innerHTML = html;
}

function selVenue(v) {
  closeMobileNav();
  curV = v;
  if(curView==='accounting' && !isAccountingOnlyVenue(v)) curAcctV = v;
  /* month/year untouched on purpose   only venue-scoped data changes */
  updateTopbarLogo(curV);
  buildVenTabs();
  buildSidebar();
  go();
  /* Re-render venue-driven tabs if active */
  if(curView==='vip')      renderVIP();
  if(curView==='forecast') renderForecast();
  if(curView==='live')     renderLive();
  if(curView==='system')   renderSystem();
}

/*    Venue tabs                                                  */
function buildVenTabs() {
  var venues = listActiveVenues();
  document.getElementById('venTabs').innerHTML = venues.map(function(v){
    var c=venueColor(v);
    var style=v===curV?('background:'+c.a+';border-color:'+c.a+';color:#fff'):('border-left:3px solid '+c.a);
    return '<button class="ven-tab'+(v===curV?' on':'')+'" data-v="'+v+'" style="'+style+'" onclick="selVenue(\''+v+'\')">' + v + '</button>';
  }).join('');
}

/*    Year pills                                                 */
function buildYrPills() {
  var years={2024:1,2025:1,2026:1,2027:1};
  SCHED.forEach(function(r){
    if(r&&r.d) years[fiscalYearForDate(r.d)]=1;
    if(r&&r.yr) years[+r.yr]=1;
  });
  var yrs=Object.keys(years).map(Number).filter(function(y){return y>=2020&&y<=2035;}).sort(function(a,b){return a-b;});
  if(yrs.indexOf(curYr)<0) yrs.push(curYr), yrs.sort(function(a,b){return a-b;});
  document.getElementById('yrPills').innerHTML = yrs.map(function(y){
    return '<button class="yr-pill'+(y===curYr?' on':'')+'" onclick="selYr('+y+')">'+y+'</button>';
  }).join('');
}

function selYr(yr) {
  curYr = yr;
  /* venue untouched on purpose   only year-scoped data changes */
  buildYrPills();
  go();
}

/*    View router                                                 */
var _budgetInited = false;
function setView(v) {
  if(v==='system' && !unlockSanity()) return;
  closeMobileNav();
  curView = v;
  if(_presenceRef) _presenceRef.update({view:v,lastSeen:firebase.database.ServerValue.TIMESTAMP});
  ['calendar','summary','allshows','leaderboard','budget','accounting','vip','forecast','live','system','3d'].forEach(function(id){
    var el = document.getElementById('view-'+id);
    if (!el) return;
    var on = id===v;
    el.style.display = on ? '' : 'none';
    el.classList.toggle('view-on', on);
  });
  var mainEl = document.querySelector('.main');
  if (mainEl) mainEl.classList.toggle('cal-mode', v==='calendar' || v==='accounting');
  document.querySelectorAll('.sb-btn[data-view]').forEach(function(b){b.classList.toggle('on', b.dataset.view===v);});
  if (v === 'budget') {
    clearGlobalCalChrome();
    bgtVenue = curV; bgtYear = curYr; bgtMonth = null;
    if (!_budgetInited) { initBudget(); _budgetInited = true; }
    else {
      var vs = document.getElementById('budgetVenue');
      if (vs) vs.value = bgtVenue;
      var ys = document.getElementById('budgetYear');
      if (ys) ys.value = bgtYear;
      renderBudget();
    }
    return;
  }
  if (v === 'accounting') {
    acctM = curM;
    if(!isAccountingOnlyVenue(curV)) curAcctV = curV;
    renderAccounting();
    return;
  }
  if (v === 'vip') {
    renderVIP();
    return;
  }
  if (v === 'forecast') {
    renderForecast();
    return;
  }
  if (v === 'live') {
    renderLive();
    return;
  }
  if (v === 'system') {
    renderSystem();
    return;
  }
  if (v === '3d') {
    clearGlobalCalChrome();
    var vipPopup=document.getElementById('vipPopup');
    if(vipPopup) vipPopup.remove();
    render3dView();
    return;
  }
  go();
}

/* Standalone 3D floor plan — raw venue GLB via Google <model-viewer>
   (no FourVenues booking website / event carousel).
   Casa Neos Beach Club: Aug–Sep uses rooftop.glb (summer rooftop experience);
   otherwise model2.glb (regular beach club). */
var FV_CNBC_SUMMER_GLB = 'https://fvwebs-storage.fourvenues.com/casa-neos/rooftop.glb?v=1';
var FV_3D_MODELS = [
  {key:'mila-lounge', venue:'MILA Lounge', label:'MILA Lounge', orbit:'45deg 60deg 72%', url:'https://fvwebs-storage.fourvenues.com/mila-lounge/model.glb?v=1'},
  {key:'casa-neos-lounge', venue:'Casa Neos Lounge', label:'Casa Neos Lounge', orbit:'45deg 60deg 86%', url:'https://fvwebs-storage.fourvenues.com/casa-neos/lounge/model.glb?v=3'},
  {key:'casa-neos-beach-club', venue:'Casa Neos Beach Club', label:'Casa Neos Beach Club', orbit:'45deg 60deg 110%', url:'https://fvwebs-storage.fourvenues.com/casa-neos/model2.glb?v=1', summerOrbit:'55deg 65deg 125%'}
];
/* Static reference copied from the source floor-plan configuration. It is
   intentionally local and contains no events, availability or performance. */
var FV_3D_TABLES = {
  'mila-lounge':[
    {name:'GOLD',color:'rgb(251,192,45)',minimum:1000,capacity:10,tables:['301','302','303','304','308','402','410']},
    {name:'PRESTIGE',color:'rgb(139,195,74)',minimum:1500,capacity:10,tables:['403','404']},
    {name:'DIAMOND',color:'rgb(50,150,200)',minimum:2000,capacity:10,tables:['305','306','307','405','407','408','409']}
  ],
  'casa-neos-lounge':[
    {name:'GOLD',color:'rgb(251,191,36)',minimum:500,capacity:8,tables:['803','804','805','806']},
    {name:'PLATINUM',color:'rgb(161,161,170)',minimum:1000,capacity:10,tables:['807','810','901','905','906','909','910']},
    {name:'DIAMOND',color:'rgb(14,165,233)',minimum:1500,capacity:10,tables:['808','809','902','903','904','907','908']}
  ],
  'casa-neos-beach-club':[
    {name:'RIVERWALK',color:'rgb(245,127,23)',minimum:1000,capacity:10,tables:['19','20','21','22','23']},
    {name:'GOLD',color:'rgb(251,192,45)',minimum:1500,capacity:10,tables:['25','26','27','28']},
    {name:'PLATINUM',color:'rgb(158,158,158)',minimum:2000,capacity:10,tables:['32','33','35','36','42','43','46','48','49','53','54','55','56']},
    {name:'PRESTIGE',color:'rgb(139,195,74)',minimum:2500,capacity:10,tables:['31','41']},
    {name:'DIAMOND',color:'rgb(3,169,244)',minimum:3000,capacity:10,tables:['34','51','52']}
  ],
  /* Sunset Rituals rooftop (Aug–Sep) — New Rooftop Beach Club Floor Plan:
     Diamond 5 · Platinum 6 · Prestige 5 · Gold 4 (no Riverwalk). */
  'casa-neos-beach-club-summer':[
    {name:'DIAMOND',color:'rgb(3,169,244)',minimum:3000,capacity:10,tables:['61','63','81','83','73']},
    {name:'PLATINUM',color:'rgb(158,158,158)',minimum:1500,capacity:10,tables:['66','68','76','75','88','86']},
    {name:'PRESTIGE',color:'rgb(139,195,74)',minimum:2000,capacity:10,tables:['64','65','84','85','74']},
    {name:'GOLD',color:'rgb(251,192,45)',minimum:1000,capacity:10,tables:['91','92','93','94']}
  ]
};
/* Model-space table centers read from each raw GLB. model-viewer hotspots use
   these anchors so tier/price badges remain attached while rotating/zooming. */
var FV_3D_HOTSPOTS = {
  'mila-lounge':{
    '301':[-3.070,1.05,-0.987],'302':[-0.626,1.05,-0.987],'303':[0.626,1.05,-0.987],
    '304':[3.070,1.05,-0.987],'305':[3.070,1.05,1.664],'306':[0.626,1.05,1.664],
    '307':[-0.626,1.05,1.664],'308':[-3.070,1.05,1.664],'402':[5.788,1.15,-4.227],
    '403':[5.735,1.15,-1.144],'404':[5.735,1.15,0.999],'405':[5.788,1.15,4.058],
    '407':[2.373,1.05,4.398],'408':[-3.017,1.05,4.482],'409':[-4.782,1.05,4.426],
    '410':[-4.800,1.05,2.469]
  },
  'casa-neos-lounge':{
    '803':[9.014,0.92,2.139],'804':[9.014,0.92,0.905],'805':[9.014,0.92,-0.349],
    '806':[9.014,0.92,-1.595],'807':[7.090,0.92,-2.864],'808':[3.946,0.92,-2.864],
    '809':[-2.151,0.92,-2.864],'810':[-5.270,0.92,-2.864],'901':[5.785,0.92,0.062],
    '902':[4.686,0.92,0.062],'903':[2.176,0.92,0.886],'904':[-0.336,0.92,0.886],
    '905':[-3.237,0.92,0.886],'906':[-3.237,0.92,2.014],'907':[-0.336,0.92,1.976],
    '908':[2.176,0.92,1.976],'909':[4.686,0.92,2.795],'910':[5.785,0.92,2.795]
  },
  'casa-neos-beach-club':{
    '19':[20.747,1.02,5.469],'20':[18.422,1.02,5.513],'21':[16.302,1.02,5.522],
    '22':[14.090,1.02,5.533],'23':[11.923,1.02,5.530],'24':[8.560,1.02,3.700],
    '25':[6.390,1.02,3.809],'26':[-2.006,1.02,3.547],'27':[-4.357,1.02,3.542],'28':[-6.783,1.02,3.542],
    '31':[3.014,1.02,3.385],'32':[1.649,1.02,1.543],'33':[1.649,1.02,-0.211],
    '34':[3.027,1.02,-2.058],'35':[4.403,1.02,-0.220],'36':[4.403,1.02,1.533],
    '41':[6.741,1.02,1.161],'42':[5.954,1.02,-1.738],'43':[5.954,1.02,-3.529],
    '45':[2.900,1.02,-2.900],'46':[0.157,1.02,-2.391],'47':[-1.200,1.02,-1.500],
    '48':[-2.569,1.02,-0.706],'49':[-1.008,1.02,1.400],
    '51':[5.744,1.02,-5.890],'52':[0.461,1.02,-5.890],'53':[-3.755,1.02,-2.964],
    '54':[-4.631,1.02,-1.438],'55':[-5.511,1.02,0.084],'56':[-3.730,1.02,1.698]
  },
  /* Rooftop summer experience — node translations from rooftop.glb */
  'casa-neos-beach-club-summer':{
    '61':[29.856,1.15,-5.870],'63':[24.118,1.15,-5.870],'64':[17.849,1.15,-5.870],
    '65':[14.292,1.15,-5.870],'66':[8.170,1.15,-5.870],'68':[2.331,1.15,-5.870],
    '73':[20.515,0.90,0.034],'74':[11.756,0.90,0.030],'75':[6.808,0.90,0.004],'76':[1.772,0.90,0.034],
    '81':[29.856,1.15,5.969],'83':[24.118,1.15,5.969],'84':[17.849,1.15,5.969],
    '85':[14.292,1.15,5.969],'86':[8.170,1.15,5.969],'88':[2.331,1.15,5.969],
    '91':[-5.742,1.00,7.597],'92':[-10.136,1.00,7.597],'93':[-14.509,1.00,7.597],'94':[-18.837,1.00,7.597]
  }
};
var _fv3dModelKey = 'mila-lounge';
var _fv3dTierFilter = null;
var _fv3dLoaded = false;
var _fv3dPriceOverride = null;
var _fv3dDate = null;

/* CNBC summer rooftop floor plan: Aug 1 – Sep 30 (inclusive). Outside = regular beach club GLB. */
function isCnbcSummerFloor(dateStr){
  var d=dateStr||_fv3dDate||((typeof miamiToday==='function')?miamiToday():'');
  var parts=String(d||'').split('-');
  if(parts.length<2) return false;
  var m=+parts[1];
  return m>=8 && m<=9;
}
function fv3dEffectiveTableKey(modelKey, dateStr){
  if(modelKey==='casa-neos-beach-club' && isCnbcSummerFloor(dateStr)) return 'casa-neos-beach-club-summer';
  return modelKey;
}
function fv3dEffectiveModelUrl(modelKey, dateStr){
  var m=FV_3D_MODELS.find(function(x){return x.key===modelKey;});
  if(modelKey==='casa-neos-beach-club' && isCnbcSummerFloor(dateStr) && typeof FV_CNBC_SUMMER_GLB!=='undefined'){
    return FV_CNBC_SUMMER_GLB;
  }
  return m ? m.url : null;
}
function getFv3dDate(){
  if(_fv3dDate) return _fv3dDate;
  return (typeof miamiToday==='function')?miamiToday():new Date().toISOString().slice(0,10);
}
function setFv3dDate(dateStr){
  _fv3dDate=dateStr||null;
  var inp=document.getElementById('fv3dDate');
  if(inp && dateStr) inp.value=dateStr;
  _fv3dPriceOverride=null;
  renderFv3dFloorVisual();
  var feeEl=document.getElementById('fv3dDjFee');
  if(feeEl && feeEl.value) updateFv3dPricing();
  else renderFv3dReference();
  var badge=document.getElementById('fv3dPlanBadge');
  if(badge){
    var summer=_fv3dModelKey==='casa-neos-beach-club' && isCnbcSummerFloor(getFv3dDate());
    badge.style.display=_fv3dModelKey==='casa-neos-beach-club'?'inline-flex':'none';
    badge.textContent=summer?'Sunset Rituals · Summer rooftop (Aug–Sep)':'Regular beach club plan';
    badge.style.background=summer?'#0f766e':'#334155';
  }
}
/* VIP / fee-guidance floor plan for a venue on a given date (CNBC swaps to rooftop Aug–Sep). */
function getVipFloorPlan(venue, dateStr){
  if(venue==='Casa Neos Beach Club' && typeof isCnbcSummerFloor==='function' && isCnbcSummerFloor(dateStr)){
    var summer=FV_3D_TABLES['casa-neos-beach-club-summer']||[];
    var tierRef={};
    var budget=0;
    summer.forEach(function(t){
      var name=t.name.charAt(0).toUpperCase()+t.name.slice(1).toLowerCase();
      var n=(t.tables&&t.tables.length)||0;
      budget+=n;
      tierRef[name]={
        total:n, min:t.minimum||0,
        color:t.color||'#eee', textColor:'#333'
      };
    });
    return {budget:budget, tiers:tierRef, summer:true};
  }
  if(typeof _vipFloorPlan!=='undefined' && _vipFloorPlan && _vipFloorPlan[venue]) return _vipFloorPlan[venue];
  return {budget:0, tiers:{}, summer:false};
}

function fv3dKeyForVenue(venue){
  if(venue==='MILA Lounge') return 'mila-lounge';
  if(venue==='Casa Neos Lounge') return 'casa-neos-lounge';
  if(venue==='Casa Neos Beach Club') return 'casa-neos-beach-club';
  return null;
}
function scaleTiersToBsTarget(modelKey, bsTarget, dateStr){
  var tableKey=fv3dEffectiveTableKey(modelKey, dateStr);
  var tiers = FV_3D_TABLES[tableKey] || FV_3D_TABLES[modelKey] || [];
  var base = 0;
  tiers.forEach(function(t){ base += (+t.minimum||0) * ((t.tables&&t.tables.length)||0); });
  var scale = (base>0 && bsTarget!=null && !isNaN(+bsTarget)) ? (+bsTarget)/base : 0;
  return tiers.map(function(t){
    var suggested = (t.minimum && scale) ? Math.ceil((t.minimum*scale)/250)*250 : null;
    return {
      name:t.name, color:t.color, capacity:t.capacity, tables:t.tables||[],
      minimum:t.minimum, suggested:suggested
    };
  });
}
function calcTierPricesForShow(venue, dateStr, fee){
  var key = fv3dKeyForVenue(venue);
  if(!key) return null;
  var tgt = (typeof showTargets==='function')
    ? showTargets({v:venue, venue:venue, d:dateStr||'', fee:fee||0, cost:fee||0})
    : {bs_m:null, roi_t:null};
  var look = (typeof venueRoiLookup==='function')
    ? venueRoiLookup(venue, dateStr||'', +fee||0)
    : null;
  var tiers = scaleTiersToBsTarget(key, tgt && tgt.bs_m, dateStr);
  /* Sunset Rituals: use the exact spreadsheet table mins when available. */
  if(look && look.tables){
    tiers = tiers.map(function(t){
      var cat=t.name.charAt(0).toUpperCase()+t.name.slice(1).toLowerCase();
      var exact=look.tables[cat];
      if(exact!=null) return Object.assign({}, t, {suggested:+exact, minimum:t.minimum, fromRules:true});
      return t;
    });
  }
  return {
    modelKey:key,
    tableKey:fv3dEffectiveTableKey(key, dateStr),
    venue:venue,
    date:dateStr||null,
    summer:venue==='Casa Neos Beach Club' && isCnbcSummerFloor(dateStr),
    label: (venue==='Casa Neos Beach Club' && isCnbcSummerFloor(dateStr)) ? 'Sunset Rituals Rooftop Edition' : null,
    fee:+fee||0,
    bsTarget: tgt && tgt.bs_m!=null ? tgt.bs_m : null,
    roiTarget: tgt && tgt.roi_t!=null ? tgt.roi_t : null,
    tiers: tiers
  };
}
function renderFv3dHotspots(viewer, modelKey, tiers){
  if(!viewer) return;
  Array.prototype.slice.call(viewer.querySelectorAll('.fv3d-hotspot')).forEach(function(el){el.remove();});
  var anchors=FV_3D_HOTSPOTS[modelKey]||{};
  var frag=document.createDocumentFragment();
  (tiers||[]).forEach(function(t){
    var price=t.suggested!=null?t.suggested:t.minimum;
    (t.tables||[]).forEach(function(id){
      var p=anchors[id];
      if(!p) return;
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='fv3d-hotspot'+(_fv3dTierFilter&&_fv3dTierFilter!==t.name?' is-muted':'')+(_fv3dTierFilter===t.name?' is-selected':'');
      btn.slot='hotspot-'+modelKey+'-'+id;
      btn.dataset.position=p[0]+' '+p[1]+' '+p[2];
      btn.dataset.normal='0 1 0';
      btn.dataset.tier=t.name;
      btn.style.setProperty('--tier-color',t.color);
      btn.setAttribute('aria-label','Table '+id+', '+t.name+', '+formatFv3dMoney(price));
      btn.title='Table #'+id+' ? '+t.name+' ? '+formatFv3dMoney(price);
      btn.innerHTML='<span class="fv3d-hotspot-tier">'+t.name+'</span><span class="fv3d-hotspot-price">'+formatFv3dMoney(price)+'</span>';
      btn.onclick=function(ev){ev.stopPropagation();selectFv3dHotspot(btn);};
      frag.appendChild(btn);
    });
  });
  viewer.appendChild(frag);
}
function selectFv3dHotspot(btn){
  var viewer=btn&&btn.closest('model-viewer');
  if(!viewer) return;
  var tier=btn.dataset.tier;
  if(viewer.id==='fv3dViewer'){
    setFv3dTierFilter(tier);
    return;
  }
  var selected=btn.classList.contains('is-selected');
  viewer.querySelectorAll('.fv3d-hotspot').forEach(function(el){
    el.classList.toggle('is-selected',!selected&&el.dataset.tier===tier);
    el.classList.toggle('is-muted',!selected&&el.dataset.tier!==tier);
  });
  var layout=viewer.closest('.show3d-layout');
  if(!layout) return;
  layout.querySelectorAll('.fv3d-tier[data-tier]').forEach(function(el){
    el.classList.toggle('is-active',!selected&&el.dataset.tier===tier);
    el.classList.toggle('is-muted',!selected&&el.dataset.tier!==tier);
  });
  var card=!selected&&layout.querySelector('.fv3d-tier[data-tier="'+tier+'"]');
  if(card) card.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function _ensureModelViewerScript(cb){
  if(window.customElements && customElements.get('model-viewer')) { cb(); return; }
  if(document.getElementById('modelViewerScript')){
    var wait=setInterval(function(){ if(customElements.get('model-viewer')){ clearInterval(wait); cb(); } },120);
    return;
  }
  var s=document.createElement('script');
  s.id='modelViewerScript';
  s.type='module';
  s.src='https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  s.onload=function(){
    var wait=setInterval(function(){ if(customElements.get('model-viewer')){ clearInterval(wait); cb(); } },120);
  };
  s.onerror=function(){
    var host=document.getElementById('fv3dHost');
    if(host) host.innerHTML='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e6a0a0;font-size:12px;text-align:center;padding:20px">Could not load the 3D viewer library. Check your connection and refresh.</div>';
  };
  document.head.appendChild(s);
}
function setFv3dModel(key){
  var m = FV_3D_MODELS.find(function(x){ return x.key===key; }) || FV_3D_MODELS[0];
  _fv3dModelKey = m.key;
  _fv3dTierFilter = null;
  _fv3dPriceOverride = null;
  var feeEl=document.getElementById('fv3dDjFee');
  var nameEl=document.getElementById('fv3dDjName');
  if(feeEl) feeEl.value='';
  if(nameEl) nameEl.value='';
  var meta=document.getElementById('fv3dPricingMeta');
  if(meta) meta.innerHTML='Enter a DJ cost to calculate table minimums needed to hit the ROI target.';
  var dateWrap=document.getElementById('fv3dDateWrap');
  if(dateWrap) dateWrap.style.display=(m.key==='casa-neos-beach-club')?'flex':'none';
  if(!_fv3dDate) _fv3dDate=getFv3dDate();
  var dateInp=document.getElementById('fv3dDate');
  if(dateInp && !dateInp.value) dateInp.value=_fv3dDate;
  setFv3dDate(getFv3dDate());
}
function formatFv3dMoney(n){
  return '$'+Number(n||0).toLocaleString('en-US');
}
function setFv3dTierFilter(name){
  _fv3dTierFilter = _fv3dTierFilter===name ? null : name;
  renderFv3dReference();
}

function renderFv3dFloorVisual(){
  var host=document.getElementById('fv3dHost');
  if(!host) return;
  var m=FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;})||FV_3D_MODELS[0];
  var dateStr=getFv3dDate();
  var modelUrl=fv3dEffectiveModelUrl(m.key, dateStr) || m.url;

  /* Drop leftover booking iframe if present from older builds. */
  var existing=document.getElementById('fv3dViewer');
  if(existing && existing.tagName==='IFRAME'){
    host.innerHTML='<div id="fv3dLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbb8e8;font-size:12px;pointer-events:none">Loading 3D floor plan\u2026</div>';
    existing=null;
    _fv3dLoaded=false;
  }

  _ensureModelViewerScript(function(){
    var h=document.getElementById('fv3dHost');
    if(!h) return;
    var mv=document.getElementById('fv3dViewer');
    if(!mv || mv.tagName==='IFRAME'){
      h.innerHTML='<div id="fv3dLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbb8e8;font-size:12px;pointer-events:none">Loading 3D floor plan\u2026</div>';
      mv=document.createElement('model-viewer');
      mv.id='fv3dViewer';
      mv.setAttribute('camera-controls','');
      mv.setAttribute('touch-action','pan-y');
      mv.setAttribute('interaction-prompt','none');
      mv.setAttribute('shadow-intensity','1');
      mv.setAttribute('exposure','1.1');
      mv.setAttribute('min-camera-orbit','auto auto 5%');
      mv.setAttribute('max-camera-orbit','auto auto 300%');
      mv.style.cssText='width:100%;height:100%;background:transparent;--poster-color:transparent';
      mv.addEventListener('load', function(){
        var l=document.getElementById('fv3dLoading'); if(l) l.style.display='none';
      });
      mv.addEventListener('error', function(){
        var l=document.getElementById('fv3dLoading');
        if(l){ l.style.display='flex'; l.style.color='#e6a0a0'; l.textContent='Could not load the 3D model.'; }
      });
      h.appendChild(mv);
      _fv3dLoaded=true;
    }
    var l=document.getElementById('fv3dLoading');
    var summer=m.key==='casa-neos-beach-club' && isCnbcSummerFloor(dateStr);
    if(l){
      l.style.display='flex';
      l.style.color='#cbb8e8';
      l.textContent='Loading '+m.venue+(summer?' summer rooftop':'')+' floor plan\u2026';
    }
    mv.setAttribute('alt', m.venue+(summer?' summer rooftop':'')+' 3D floor plan');
    mv.setAttribute('camera-orbit',(summer && m.summerOrbit) ? m.summerOrbit : (m.orbit||'45deg 60deg 110%'));
    if(mv.getAttribute('src')!==modelUrl) mv.setAttribute('src', modelUrl);
    else if(l) l.style.display='none';
    var tableKey=fv3dEffectiveTableKey(m.key, dateStr);
    var tiers=_fv3dPriceOverride&&_fv3dPriceOverride.modelKey===m.key
      ? _fv3dPriceOverride.tiers
      : scaleTiersToBsTarget(m.key,null,dateStr);
    renderFv3dHotspots(mv, tableKey, tiers);
  });
}

function renderFv3dReference(){
  var m=FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;})||FV_3D_MODELS[0];
  var dateStr=getFv3dDate();
  var tableKey=fv3dEffectiveTableKey(m.key, dateStr);
  var summer=m.key==='casa-neos-beach-club' && isCnbcSummerFloor(dateStr);
  var baseTiers=FV_3D_TABLES[tableKey]||FV_3D_TABLES[m.key]||[];
  var tiers=_fv3dPriceOverride && _fv3dPriceOverride.modelKey===m.key ? _fv3dPriceOverride.tiers : baseTiers.map(function(t){
    return {name:t.name,color:t.color,capacity:t.capacity,tables:t.tables||[],minimum:t.minimum,suggested:null};
  });
  var total=tiers.reduce(function(n,t){return n+(t.tables?t.tables.length:0);},0);
  var venue=document.getElementById('fv3dVenueName');
  var count=document.getElementById('fv3dTableCount');
  var list=document.getElementById('fv3dTierList');
  if(venue) venue.textContent=m.venue+(summer?' · Summer rooftop':'');
  if(count) count.textContent=total+' TABLES';
  if(!list) return;
  list.innerHTML=tiers.map(function(t){
    var active=_fv3dTierFilter===t.name;
    var muted=_fv3dTierFilter&&!active;
    var price = t.suggested!=null ? t.suggested : t.minimum;
    var priceLbl = t.suggested!=null
      ? (formatFv3dMoney(t.suggested)+' needed')
      : (formatFv3dMoney(t.minimum)+' min.');
    return '<button type="button" class="fv3d-tier'+(active?' is-active':'')+(muted?' is-muted':'')+'" style="--tier-color:'+t.color+'" onclick="setFv3dTierFilter(\''+t.name+'\')" aria-pressed="'+active+'">'
      +'<span class="fv3d-tier-top"><span class="fv3d-tier-name">'+t.name+'</span><span class="fv3d-tier-min">'+priceLbl+'</span></span>'
      +'<span class="fv3d-tier-meta">'+t.tables.length+' table'+(t.tables.length===1?'':'s')+' \u00b7 up to '+t.capacity+' guests each'
      +(t.suggested!=null?' \u00b7 base '+formatFv3dMoney(t.minimum):'')+'</span>'
      +'<span class="fv3d-tables">'+t.tables.map(function(id){return '<span class="fv3d-table">#'+id+' \u00b7 '+formatFv3dMoney(price)+'</span>';}).join('')+'</span>'
      +'</button>';
  }).join('');
  var mv=document.getElementById('fv3dViewer');
  if(mv && mv.tagName!=='IFRAME'){
    renderFv3dHotspots(mv, tableKey, tiers);
  }
}
function updateFv3dPricing(){
  var feeEl=document.getElementById('fv3dDjFee');
  var nameEl=document.getElementById('fv3dDjName');
  var meta=document.getElementById('fv3dPricingMeta');
  var m=FV_3D_MODELS.find(function(x){return x.key===_fv3dModelKey;})||FV_3D_MODELS[0];
  var fee=feeEl ? parseFloat(feeEl.value)||0 : 0;
  var djName=nameEl ? (nameEl.value||'').trim() : '';
  var dateStr=getFv3dDate();
  if(!fee){
    _fv3dPriceOverride=null;
    if(meta) meta.innerHTML='Enter a DJ cost to calculate table minimums needed to hit the ROI target.';
    renderFv3dReference();
    return;
  }
  var priced=calcTierPricesForShow(m.venue, dateStr, fee);
  _fv3dPriceOverride=priced;
  if(meta){
    meta.innerHTML=(djName?('<b>'+djName.replace(/</g,'&lt;')+'</b> \u00b7 '):'')
      +'Fee <b>'+$k(fee)+'</b> \u00b7 BS Target <b>'+$k(priced&&priced.bsTarget)+'</b> \u00b7 ROI Target <b>'+(priced&&priced.roiTarget!=null?(+priced.roiTarget).toFixed(1)+'x':'-')+'</b>'
      +(priced&&priced.summer?' \u00b7 <span style="color:#0f766e">Summer rooftop tiers</span>':'');
  }
  renderFv3dReference();
}
function render3dView(){
  var sel = document.getElementById('fv3dModel');
  if(sel){
    sel.innerHTML = FV_3D_MODELS.map(function(m){
      return '<option value="'+m.key+'"'+(_fv3dModelKey===m.key?' selected':'')+'>'+m.label+'</option>';
    }).join('');
  }
  if(!_fv3dDate) _fv3dDate=(typeof miamiToday==='function')?miamiToday():new Date().toISOString().slice(0,10);
  var dateInp=document.getElementById('fv3dDate');
  if(dateInp) dateInp.value=_fv3dDate;
  var dateWrap=document.getElementById('fv3dDateWrap');
  if(dateWrap) dateWrap.style.display=(_fv3dModelKey==='casa-neos-beach-club')?'flex':'none';
  setFv3dDate(_fv3dDate);
  if(typeof updateFv3dPricing==='function') updateFv3dPricing();
  else { renderFv3dFloorVisual(); renderFv3dReference(); }
}

/* Recompute schedule status from Miami today + BS Actual vs target.
   Future nights stay fut/tbd; past nights with Actual become beat/miss; past without Actual = nd. */
function recalcSchedStatuses(){
  TODAY = (typeof miamiToday==='function')
    ? miamiToday()
    : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
  SCHED.forEach(function(r){
    if(!r || r._s==='empty' || !r.d) return;
    if(r.tbd){ r.tbd=0; /* legacy TBD cleared */ }
    if(r.d > TODAY){ r._s='fut'; return; }
    var tgt = (typeof showTargets==='function') ? showTargets(r) : {bs_m:r.bs_m};
    var bsM = tgt && tgt.bs_m != null ? tgt.bs_m : r.bs_m;
    if(r.bs_a != null && bsM != null){
      var beat = r.bs_a >= bsM ? 1 : 0;
      r.beat = beat;
      r._s = beat ? 'beat' : 'miss';
      var fee = r.fee || r.cost;
      if(fee) r.roi_a = +(r.bs_a / fee).toFixed(4);
      if(fee && bsM) r.roi_t = +(bsM / fee).toFixed(4);
    } else {
      r._s = 'nd';
    }
  });
}

function syncLinkedTabsFromSched(rec){
  if(!rec || typeof FORECAST_DATA==='undefined') return;
  var venue=rec.venue||rec.v;
  FORECAST_DATA.forEach(function(e){
    if(!e || e.venue!==venue || e.date!==rec.d) return;
    if(rec.dj!=null) e.dj=rec.dj;
    if(rec.fee!=null){ e.djCost=rec.fee; e.fee=rec.fee; e.cost=rec.fee; }
    if(typeof _fcastEnrich==='function') _fcastEnrich(e);
  });
}
function go() {
  clearPyMapCache();
  recalcSchedStatuses();
  renderKPIs();
  if (curView==='calendar')    renderCal();
  else if (curView==='summary')     renderSummary();
  else if (curView==='allshows')    renderAllShows();
  else if (curView==='leaderboard') renderLeaderboard();
  else if (curView==='accounting'){ renderAccounting(); }
  else if (curView==='vip')         renderVIP();
  else if (curView==='forecast')    renderForecast();
  else if (curView==='budget'){
    /* Venue AND year pills changed while already ON the budget tab   keep them in sync live */
    bgtVenue=curV; bgtYear=curYr; bgtMonth=null;
    var vs=document.getElementById('budgetVenue');
    if(vs) vs.value=bgtVenue;
    var ys=document.getElementById('budgetYear');
    if(ys) ys.value=bgtYear;
    if(_budgetInited) renderBudget();
  }
}

/* Hide calendar-only chrome (KPI strip + monthly budget banner) on other pages */
function clearGlobalCalChrome(){
  var kpiEl=document.getElementById('kpis');
  if(kpiEl){ kpiEl.style.display='none'; kpiEl.innerHTML=''; }
  var banner=document.getElementById('calBudgetBanner');
  if(banner){ banner.innerHTML=''; banner.style.display='none'; }
  var narr=document.getElementById('calNarrative');
  if(narr) narr.innerHTML='';
}
/*     KPIs                                                      */
function renderKPIs() {
  var kpiEl=document.getElementById('kpis');
  var banner=document.getElementById('calBudgetBanner');
  if(curView==='leaderboard'||curView==='budget'){
    clearGlobalCalChrome();
    if(curView==='leaderboard'){
      document.getElementById('pgSub').innerHTML = '<span>ROI Ranking · '+(typeof _lbFilterLabel==='function'?_lbFilterLabel():'all venues')+'</span>';
    } else {
      document.getElementById('pgSub').innerHTML = '<span>'+(budgetSubTab==='planner'?'Budget Planner':'Overview')+'</span>';
    }
    return;
  }
  if(kpiEl) kpiEl.style.display='';
  if(banner) banner.style.display='';
  var mm = curView==='calendar' ? (curM<9?'0'+(curM+1):''+(curM+1)) : null;
  var mName = mm ? ['January','February','March','April','May','June','July','August','September','October','November','December'][curM]+' '+curYr : 'Full year '+curYr;
  var bsRecs = getBSRecs(curYr, curV, mm);
  var shows   = mm ? getShows(curYr, curV, mm) : getShows(curYr, curV);
  var measured = shows.filter(function(r){return r._s==='beat'||r._s==='miss';});
  var beats    = measured.filter(function(r){return r._s==='beat';});
  var br       = measured.length ? Math.round(beats.length/measured.length*100) : 0;
  var totalBS  = bsRecs.reduce(function(s,r){return s+(r.bs_a||0);},0);
  var totalBSM = bsRecs.reduce(function(s,r){return s+(r.bs_m||0);},0);
  var rois     = bsRecs.filter(function(r){return r.roi_a;}).map(function(r){return r.roi_a;});
  var avgROI   = rois.length ? (rois.reduce(function(a,b){return a+b;},0)/rois.length).toFixed(2)+'x' : '-';
  var upcoming = shows.filter(function(r){return r._s==='fut'||r._s==='tbd';}).length;
  /* "Total DJ cost"   every scheduled show's fee, matching the Budget-tab / banner definition
     exactly (SCHED-based, not limited to shows that already have BS actual data). */
  var scheduledShows = shows;
  var totalFee = scheduledShows.reduce(function(s,r){return s+(r.fee||r.cost||0);},0);
  var kpis = [
    {l:'Shows',          v:measured.length,         s:beats.length+' beat / '+(measured.length-beats.length)+' miss', c:''},
    {l:'Beat rate',      v:br+'%',                  s:mName, c:br>=60?'g':'r'},
    {l:'Avg ROI',        v:avgROI,                  s:'BS / DJ fee', c:'b'},
    {l:'BS Actual',      v:$k(totalBS),             s:'vs '+$k(totalBSM)+' target', c:totalBS>=totalBSM&&totalBSM?'g':''},
    {l:'BS Variance',    v:$kv(totalBS-totalBSM),   s:totalBS>=totalBSM?'above target':'below target', c:totalBS>=totalBSM&&totalBSM?'g':'r'},
    {l:'Total DJ cost',  v:$k(totalFee),            s:scheduledShows.length+' shows scheduled', c:''},
    {l:'Upcoming',       v:upcoming,                s:'scheduled', c:'b'},
  ];
  if(kpiEl) kpiEl.innerHTML = kpis.map(function(k){
    return '<div class="kpi '+(k.c?'kpi-'+k.c:'')+'"><div class="kpi-l">'+k.l+'</div><div class="kpi-v">'+k.v+'</div><div class="kpi-s">'+k.s+'</div></div>';
  }).join('');
  if(mm){
    mName = (typeof MN_FULL!=='undefined'?MN_FULL[curM]:mName)+' '+curYr+' <span style="font-weight:600;color:var(--ink3)">('+fiscalPeriodShortRange(curYr,curM)+')</span>';
  }
  document.getElementById('pgSub').innerHTML = '<span>'+curV+' &middot; '+mName+'</span>';
  updateTopbarLogo(curV);
  renderCalBudgetBanner(mm);
}

/*    Budget vs Scheduled Spend banner   shown on the Calendar itself   
   "Scheduled Spend" = sum of every DJ fee booked this month, whether
   already performed or still upcoming (matches the Budget tab's logic). */
function renderCalBudgetBanner(mm){
  var box=document.getElementById('calBudgetBanner');
  var narrBox=document.getElementById('calNarrative');
  if(!box) return;
  if(!mm){ box.innerHTML=''; if(narrBox) narrBox.innerHTML=''; return; } /* only show in single-month view, not full-year */
  var scheduledSpend = SCHED.filter(function(r){
    return (r.v||r.venue)===curV && r.d && r._s!=='empty' && inFiscalMonthFilter(r, curYr, mm);
  }).reduce(function(s,r){ return s+(r.fee||r.cost||0); },0);
  var budget = getMonthlyBudget(curV, curYr, mm);
  var variance = budget!=null ? budget-scheduledSpend : null;
  var pctUsed = budget ? Math.round(scheduledSpend/budget*100) : null;

  if(narrBox){
    narrBox.innerHTML = '<div class="bgt-narrative"><span class="bgt-narrative-ic">&#128202;</span>'+generateBudgetNarrative(curV,curYr,mm)+'</div>';
  }

  var h='<div class="cal-budget-banner">';
  h+='<div class="cal-budget-item"><span class="cal-budget-lbl">DJ Cost <b>(Scheduled Spend)</b></span><span class="cal-budget-val">'+$k(scheduledSpend)+'</span></div>';
  h+='<div class="cal-budget-item"><span class="cal-budget-lbl">Monthly Budget <b>(Target)</b></span><span class="cal-budget-val">'+(budget!=null?$k(budget):'not set')+'</span></div>';
  if(variance!=null){
    h+='<div class="cal-budget-item"><span class="cal-budget-lbl">Variance</span><span class="cal-budget-val '+(variance>=0?'pos':'neg')+'">'+$kv(variance)+'</span></div>';
    h+='<div class="cal-budget-item"><span class="cal-budget-lbl">Budget Used</span><span class="cal-budget-val '+(pctUsed>100?'neg':'pos')+'">'+pctUsed+'%</span></div>';
  }
  h+='</div>';
  box.innerHTML=h;
}

/*     CALENDAR                                                  */
var MN_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DOW     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];



function dlFile(content, filename, mime) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type:mime}));
  a.download = filename; a.click();
}


/*                                                                
   BUDGET v7   Calendar is source of truth
   Shows on calendar   aggregate to budget year grid
   ROI target set per month   drives projections
                                                                   */

var budgetSubTab  = 'overview';
var bgtVenue      = 'Casa Neos Beach Club';
var bgtYear       = 2027;
var bgtMonth      = null;
var bgtROITargets = {};   /* venue|yr|mm -> roi_t number */
var _budgetInited = false;
var _djTarget     = null;
var HIDE_V        = ['AVA Winter Park'];
var MNF = ['January','February','March','April','May','June',
           'July','August','September','October','November','December'];
var MNS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/*    formatters                                                   */
function $m(n){
  if(!n&&n!==0) return '-';
  var a=Math.abs(n),s=n<0?'-':'';
  if(a>=1e6) return s+'$'+(a/1e6).toFixed(2)+'M';
  if(a>=1000) return s+'$'+(a/1000).toFixed(1).replace(/\.0$/,'')+'K';
  return s+'$'+Math.round(a);
}
function $mv(n){
  if(n==null) return '-';
  var a=Math.abs(n),s=n>=0?'+':'-';
  if(a>=1e6) return s+'$'+(a/1e6).toFixed(2)+'M';
  if(a>=1000) return s+'$'+(a/1000).toFixed(1).replace(/\.0$/,'')+'K';
  return s+'$'+Math.round(a);
}


/*    historical stats from BS                                     */
function hs(venue, yr, mm) {
  var recs = BS.filter(function(r){
    return r.venue===venue && r.bs_a && r.d && inFiscalMonthFilter({d:r.d,_s:'ok'}, yr, mm);
  });
  if(!recs.length) return null;
  var paid  = recs.filter(function(r){return r.cost>0;});
  var meas  = recs.filter(function(r){return r.beat!=null;});
  var beats = meas.filter(function(r){return r.beat===1;});
  var rois  = recs.filter(function(r){return r.roi_a!=null;}).map(function(r){return r.roi_a;});
  var tBS   = recs.reduce(function(s,r){return s+r.bs_a;},0);
  var tFee  = paid.reduce(function(s,r){return s+r.cost;},0);
  return {
    n:recs.length, yr:yr, mm:mm||null,
    tBS:Math.round(tBS), tFee:Math.round(tFee),
    avgBS:Math.round(tBS/recs.length),
    avgFee:paid.length?Math.round(tFee/paid.length):0,
    beats:beats.length, meas:meas.length,
    br:meas.length?Math.round(beats.length/meas.length*100):null,
    avgROI:rois.length?+(rois.reduce(function(a,b){return a+b;},0)/rois.length).toFixed(2):null,
    shows:recs,
  };
}

/*    get/set ROI target per month                                 */
function roiKey(mm){ return bgtVenue+'|'+bgtYear+'|'+mm; }
function getRoiT(mm){
  var k=roiKey(mm);
  if(bgtROITargets[k]==null) bgtROITargets[k]=5; /* default 5x */
  return bgtROITargets[k];
}

/*    get 2027 shows from SCHED (live   uses IDX)                 */
function get27Shows(mm){
  return SCHED.filter(function(r){
    if((r.v||r.venue)!==bgtVenue || r._s==='empty' || !r.d) return false;
    return inFiscalMonthFilter(r, bgtYear, mm);
  }).sort(function(a,b){return a.d<b.d?-1:1;});
}

/*    month aggregates from live SCHED                            */
function monthAgg(mm){
  var shows=get27Shows(mm);
  var n=shows.length;
  var tFee=shows.reduce(function(s,r){return s+(r.cost||r.fee||0);},0);
  var roi_t=getRoiT(mm);
  /* Per-show projection: fee*tier OR bs_m (from minimum file) */
  var tProjBS=0, tBSTgt=0;
  shows.forEach(function(r){
    var f=r.cost||r.fee||0;
    if(f>0){
      var tgt=showTargets(r);
      var bs=tgt.bs_m!=null?tgt.bs_m:Math.round(f*(roi_t||5));
      tProjBS+=Math.round(bs);
      tBSTgt+=Math.round(bs);
    } else if(r.bs_m){
      tProjBS+=Math.round(r.bs_m);
      tBSTgt+=Math.round(r.bs_m);
    }
  });
  var tPY=shows.reduce(function(s,r){return s+(r.py_bs_a||0);},0)||null;
  return {n:n,tFee:tFee,roi_t:roi_t,projBS:tProjBS||null,bsTgt:tBSTgt||null,tPY:tPY,shows:shows};
}

/* Display DJ name as stored ? ? / ??? / ???? are valid and shown as entered. */
function djLabel(dj, empty){
  var s=fixKnownAccents(String(dj==null?'':dj)).trim();
  if(!s) return empty!=null?empty:'TBD';
  return s;
}
/* Live beat/ROI from SCHED ? same rules as ROI Ranking (not baked DJ_PROFILES). */
function liveDjPerfStats(name){
  var q=String(name||'').replace(/\?+/g,'').trim().toUpperCase();
  if(!q) return null;
  var n=0, beats=0, meas=0, tFee=0, tBS=0, rois=[], display='';
  SCHED.forEach(function(r){
    if(!r||r._s==='empty'||r.roi_a==null||!r.bs_a) return;
    var nkey=String(r.dj||'').replace(/\?+/g,'').trim().toUpperCase();
    if(nkey!==q) return;
    n++;
    rois.push(r.roi_a);
    if(r.roi_t) meas++;
    if(r.beat===1) beats++;
    tFee+=(r.fee||r.cost||0);
    tBS+=(r.bs_a||0);
    if(!display) display=r.dj;
  });
  if(!n) return null;
  return {
    n:n, beats:beats, meas:meas,
    beat_rate: meas?Math.round(beats/meas*100):0,
    avg_roi_a: +(rois.reduce(function(a,b){return a+b;},0)/rois.length).toFixed(2),
    avg_bs: Math.round(tBS/n),
    avg_fee: Math.round(tFee/n),
    display: display||name.trim()
  };
}
/*    DJ projection for picker                                    */
function djProj(name, fee){
  var raw=String(name||'').trim();
  if(!raw) return {bs:null,roi:null,p:null};
  var q=raw.replace(/\?+/g,'').trim().toUpperCase(), p=null;
  /* Pure placeholders like ???? ? no profile lookup, but name is valid */
  if(!q) return {bs:null,roi:null,p:null};
  for(var i=0;i<DJ_PROFILES.length;i++){
    if(DJ_PROFILES[i].name===q){p=DJ_PROFILES[i];break;}
    if(!p){var ws=q.split(/\s+/);for(var w=0;w<ws.length;w++){if(ws[w].length>=4&&DJ_PROFILES[i].name.indexOf(ws[w])>=0){p=DJ_PROFILES[i];break;}}}
  }
  var live=liveDjPerfStats(raw);
  if(live){
    if(p){
      p=Object.assign({}, p, {
        n:live.n, beats:live.beats, n_measured:live.meas,
        beat_rate:live.beat_rate, avg_roi_a:live.avg_roi_a,
        avg_bs:live.avg_bs, avg_fee:live.avg_fee
      });
    } else {
      p={name:q, display:live.display, n:live.n, beats:live.beats, n_measured:live.meas,
        beat_rate:live.beat_rate, avg_roi_a:live.avg_roi_a, avg_bs:live.avg_bs, avg_fee:live.avg_fee};
    }
  }
  if(!p) return {bs:null,roi:null,p:null};
  var f=fee||p.avg_fee||0;
  return {bs:p.avg_bs, roi:f>0?+(p.avg_bs/f).toFixed(2):null, p:p};
}

/*     INIT                                                      */

/*    Fee   BS Minimum tiers (from 2026 DJ file)    */
var FEE_TIERS=[
  {max:2000,   mult:18.5, label:'Under $2K'},
  {max:5000,   mult:8.0,  label:'$2K-$5K'},
  {max:8000,   mult:7.0,  label:'$5K-$8K'},
  {max:12000,  mult:6.5,  label:'$8K-$12K'},
  {max:20000,  mult:6.0,  label:'$12K-$20K'},
  {max:30000,  mult:5.0,  label:'$20K-$30K'},
  {max:50000,  mult:4.0,  label:'$30K-$50K'},
  {max:80000,  mult:3.0,  label:'$50K-$80K'},
  {max:120000, mult:2.5,  label:'$80K-$120K'},
  {max:999999, mult:2.0,  label:'$120K+'},
];
var REV_CTX={bs:9604301, label:'2026 CN BC'};
/*                                                                
   VENUE ROI RULES   per venue, per season, per day-of-week, per DJ fee tier
   Built from RDG_BS_ROI_.xlsx. Nearest-fee-tier lookup, editable in-app.
                                                                   */
var VENUE_ROI_RULES = {"Casa Neos Beach Club":{"days":["Saturday","Sunday"],"tableCats":["Diamond","Platinum","Prestige","Gold","Riverwalk"],"tiers":[{"fee":5000,"High":{"Saturday":{"roi":7.5,"sales":37500,"tables":{"Diamond":3000,"Platinum":1500,"Prestige":2000,"Gold":1000,"Riverwalk":500}},"Sunday":{"roi":10.0,"sales":50000,"tables":{"Diamond":3000,"Platinum":2000,"Prestige":2500,"Gold":1500,"Riverwalk":1000}}},"Low":{"Saturday":{"roi":7.5,"sales":37500,"tables":{"Diamond":3000,"Platinum":1500,"Prestige":2000,"Gold":1000,"Riverwalk":500}},"Sunday":{"roi":10.0,"sales":50000,"tables":{"Diamond":3000,"Platinum":2000,"Prestige":2500,"Gold":1500,"Riverwalk":1000}}}},{"fee":10000,"High":{"Saturday":{"roi":6.5,"sales":65000,"tables":{"Diamond":4000,"Platinum":3000,"Prestige":3500,"Gold":1500,"Riverwalk":500}},"Sunday":{"roi":8.5,"sales":85000,"tables":{"Diamond":5000,"Platinum":3500,"Prestige":4000,"Gold":2000,"Riverwalk":1500}}},"Low":{"Saturday":{"roi":5.0,"sales":50000,"tables":{"Diamond":3500,"Platinum":2000,"Prestige":2500,"Gold":1500,"Riverwalk":500}},"Sunday":{"roi":6.0,"sales":60000,"tables":{"Diamond":4000,"Platinum":2500,"Prestige":3000,"Gold":1500,"Riverwalk":500}}}},{"fee":15000,"High":{"Saturday":{"roi":5.5,"sales":82500,"tables":{"Diamond":5500,"Platinum":3000,"Prestige":4000,"Gold":2500,"Riverwalk":1500}},"Sunday":{"roi":7.0,"sales":105000,"tables":{"Diamond":6000,"Platinum":4500,"Prestige":5000,"Gold":3000,"Riverwalk":1500}}},"Low":{"Saturday":{"roi":3.5,"sales":52500,"tables":{"Diamond":3500,"Platinum":2000,"Prestige":2500,"Gold":1500,"Riverwalk":500}},"Sunday":{"roi":4.5,"sales":67500,"tables":{"Diamond":4000,"Platinum":3000,"Prestige":3500,"Gold":2000,"Riverwalk":500}}}},{"fee":25000,"High":{"Saturday":{"roi":3.7,"sales":92500,"tables":{"Diamond":5500,"Platinum":3500,"Prestige":4500,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":5.0,"sales":125000,"tables":{"Diamond":7000,"Platinum":5000,"Prestige":5500,"Gold":4000,"Riverwalk":2500}}},"Low":{"Saturday":{"roi":3.0,"sales":75000,"tables":{"Diamond":4500,"Platinum":3000,"Prestige":3500,"Gold":2500,"Riverwalk":1000}},"Sunday":{"roi":4.0,"sales":100000,"tables":{"Diamond":6000,"Platinum":4000,"Prestige":5500,"Gold":3500,"Riverwalk":1000}}}},{"fee":35000,"High":{"Saturday":{"roi":3.0,"sales":105000,"tables":{"Diamond":6500,"Platinum":4000,"Prestige":5500,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":4.0,"sales":140000,"tables":{"Diamond":8000,"Platinum":5500,"Prestige":6000,"Gold":4500,"Riverwalk":3000}}},"Low":{"Saturday":{"roi":2.5,"sales":87500,"tables":{"Diamond":5000,"Platinum":3500,"Prestige":4000,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":3.2,"sales":112000,"tables":{"Diamond":6500,"Platinum":4500,"Prestige":5500,"Gold":3000,"Riverwalk":2000}}}},{"fee":45000,"High":{"Saturday":{"roi":2.5,"sales":112500,"tables":{"Diamond":6500,"Platinum":4500,"Prestige":5500,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":3.5,"sales":157500,"tables":{"Diamond":8500,"Platinum":6500,"Prestige":7000,"Gold":4500,"Riverwalk":3000}}},"Low":{"Saturday":{"roi":2.2,"sales":99000,"tables":{"Diamond":5500,"Platinum":4000,"Prestige":4500,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":3.0,"sales":135000,"tables":{"Diamond":8000,"Platinum":5500,"Prestige":6500,"Gold":4000,"Riverwalk":2000}}}},{"fee":55000,"High":{"Saturday":{"roi":2.2,"sales":121000,"tables":{"Diamond":7000,"Platinum":5000,"Prestige":6000,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":3.0,"sales":165000,"tables":{"Diamond":8500,"Platinum":7000,"Prestige":7500,"Gold":5000,"Riverwalk":3000}}},"Low":{"Saturday":{"roi":2.0,"sales":110000,"tables":{"Diamond":7000,"Platinum":4500,"Prestige":5000,"Gold":3000,"Riverwalk":2000}},"Sunday":{"roi":2.6,"sales":143000,"tables":{"Diamond":8500,"Platinum":6000,"Prestige":6500,"Gold":4000,"Riverwalk":2500}}}},{"fee":65000,"High":{"Saturday":{"roi":2.0,"sales":130000,"tables":{"Diamond":7500,"Platinum":5500,"Prestige":6000,"Gold":3500,"Riverwalk":2000}},"Sunday":{"roi":2.8,"sales":182000,"tables":{"Diamond":9000,"Platinum":7000,"Prestige":7500,"Gold":6500,"Riverwalk":4500}}},"Low":{"Saturday":{"roi":2.0,"sales":130000,"tables":{"Diamond":7500,"Platinum":5500,"Prestige":6000,"Gold":3500,"Riverwalk":2000}},"Sunday":{"roi":2.4,"sales":156000,"tables":{"Diamond":8500,"Platinum":6500,"Prestige":7000,"Gold":5000,"Riverwalk":2500}}}},{"fee":75000,"High":{"Saturday":{"roi":2.0,"sales":150000,"tables":{"Diamond":8500,"Platinum":6000,"Prestige":6500,"Gold":4500,"Riverwalk":3000}},"Sunday":{"roi":2.5,"sales":187500,"tables":{"Diamond":9500,"Platinum":7500,"Prestige":8500,"Gold":6000,"Riverwalk":4000}}},"Low":{"Saturday":{"roi":2.0,"sales":150000,"tables":{"Diamond":8500,"Platinum":6000,"Prestige":6500,"Gold":4500,"Riverwalk":3000}},"Sunday":{"roi":2.2,"sales":165000,"tables":{"Diamond":9000,"Platinum":6500,"Prestige":7500,"Gold":5000,"Riverwalk":3500}}}},{"fee":85000,"High":{"Saturday":{"roi":2.0,"sales":170000,"tables":{"Diamond":10000,"Platinum":7000,"Prestige":8000,"Gold":4500,"Riverwalk":3000}}},"Low":{"Saturday":{"roi":2.0,"sales":170000,"tables":{"Diamond":10000,"Platinum":7000,"Prestige":8000,"Gold":5000,"Riverwalk":3000}},"Sunday":{"roi":2.0,"sales":170000,"tables":{"Diamond":10000,"Platinum":7000,"Prestige":8000,"Gold":5000,"Riverwalk":3000}}}}],"highSeasonMonths":[11,12,1,2,3,4]},"Casa Neos Lounge":{"days":["Thursday","Friday","Saturday","Sunday"],"tableCats":["Diamond","Platinium","Gold"],"tiers":[{"fee":5000,"High":{"Thursday":{"roi":5.5,"sales":27500,"tables":{"Diamond":2000,"Platinium":1000,"Gold":500}},"Friday":{"roi":9.0,"sales":45000,"tables":{"Diamond":3000,"Platinium":2000,"Gold":1500}},"Saturday":{"roi":9.0,"sales":45000,"tables":{"Diamond":3000,"Platinium":2000,"Gold":1500}},"Sunday":{"roi":4.0,"sales":20000,"tables":{"Diamond":1500,"Platinium":1000,"Gold":500}}},"Low":{"Thursday":{"roi":5.0,"sales":25000,"tables":{"Diamond":1500,"Platinium":1000,"Gold":750}},"Friday":{"roi":9.0,"sales":45000,"tables":{"Diamond":3000,"Platinium":2000,"Gold":1000}},"Saturday":{"roi":9.0,"sales":45000,"tables":{"Diamond":3000,"Platinium":2000,"Gold":1000}},"Sunday":{"roi":4.0,"sales":20000,"tables":{"Diamond":1500,"Platinium":1000,"Gold":500}}}},{"fee":15000,"High":{"Thursday":{"roi":2.5,"sales":37500,"tables":{"Diamond":2500,"Platinium":1500,"Gold":1000}},"Friday":{"roi":4.0,"sales":60000,"tables":{"Diamond":4000,"Platinium":2500,"Gold":2000}},"Saturday":{"roi":4.0,"sales":60000,"tables":{"Diamond":4000,"Platinium":2500,"Gold":2000}},"Sunday":{"roi":2.5,"sales":37500,"tables":{"Diamond":2500,"Platinium":1500,"Gold":1000}}},"Low":{"Thursday":{"roi":2.2,"sales":33000,"tables":{"Diamond":2000,"Platinium":1500,"Gold":1000}},"Friday":{"roi":3.5,"sales":52500,"tables":{"Diamond":4000,"Platinium":2000,"Gold":1000}},"Saturday":{"roi":3.5,"sales":52500,"tables":{"Diamond":4000,"Platinium":2000,"Gold":1000}},"Sunday":{"roi":2.2,"sales":33000,"tables":{"Diamond":2000,"Platinium":1500,"Gold":1000}}}},{"fee":25000,"High":{"Thursday":{"roi":2.5,"sales":62500,"tables":{"Diamond":4000,"Platinium":2500,"Gold":2000}},"Friday":{"roi":3.5,"sales":87500,"tables":{"Diamond":5000,"Platinium":4000,"Gold":3500}},"Saturday":{"roi":3.5,"sales":87500,"tables":{"Diamond":5000,"Platinium":4000,"Gold":3500}},"Sunday":{"roi":2.0,"sales":50000,"tables":{"Diamond":3000,"Platinium":2500,"Gold":1500}}},"Low":{"Thursday":{"roi":2.3,"sales":57500,"tables":{"Diamond":3500,"Platinium":2500,"Gold":2000}},"Friday":{"roi":3.3,"sales":82500,"tables":{"Diamond":5000,"Platinium":4000,"Gold":2500}},"Saturday":{"roi":3.3,"sales":82500,"tables":{"Diamond":5000,"Platinium":4000,"Gold":2500}},"Sunday":{"roi":2.0,"sales":50000,"tables":{"Diamond":3500,"Platinium":2000,"Gold":1500}}}},{"fee":35000,"High":{"Thursday":{"roi":2.3,"sales":80500,"tables":{"Diamond":5000,"Platinium":3500,"Gold":3000}},"Friday":{"roi":3.0,"sales":105000,"tables":{"Diamond":6000,"Platinium":5000,"Gold":4000}},"Saturday":{"roi":3.0,"sales":105000,"tables":{"Diamond":6000,"Platinium":5000,"Gold":4000}},"Sunday":{"roi":2.0,"sales":70000,"tables":{"Diamond":4500,"Platinium":3000,"Gold":2500}}},"Low":{"Thursday":{"roi":2.1,"sales":73500,"tables":{"Diamond":4500,"Platinium":3500,"Gold":2000}},"Friday":{"roi":2.4,"sales":84000,"tables":{"Diamond":5000,"Platinium":4000,"Gold":3000}},"Saturday":{"roi":2.4,"sales":84000,"tables":{"Diamond":5000,"Platinium":4000,"Gold":3000}},"Sunday":{"roi":2.0,"sales":70000,"tables":{"Diamond":4000,"Platinium":3500,"Gold":2500}}}},{"fee":45000,"High":{"Thursday":{"roi":2.0,"sales":90000,"tables":{"Diamond":5000,"Platinium":4500,"Gold":3500}},"Friday":{"roi":2.4,"sales":108000,"tables":{"Diamond":6000,"Platinium":5500,"Gold":4000}},"Saturday":{"roi":2.4,"sales":108000,"tables":{"Diamond":6000,"Platinium":5500,"Gold":4000}},"Sunday":{"roi":2.0,"sales":90000,"tables":{"Diamond":5000,"Platinium":4500,"Gold":3500}}},"Low":{"Thursday":{"roi":2.0,"sales":90000,"tables":{"Diamond":5000,"Platinium":4500,"Gold":3500}},"Friday":{"roi":2.0,"sales":90000,"tables":{"Diamond":5000,"Platinium":4500,"Gold":3500}},"Saturday":{"roi":2.0,"sales":90000,"tables":{"Diamond":5000,"Platinium":4500,"Gold":3500}},"Sunday":{"roi":2.0,"sales":90000,"tables":{"Diamond":5000,"Platinium":4500,"Gold":3500}}}},{"fee":55000,"High":{"Thursday":{"roi":2.0,"sales":110000,"tables":{"Diamond":7000,"Platinium":5000,"Gold":3500}},"Friday":{"roi":2.0,"sales":110000,"tables":{"Diamond":7000,"Platinium":5000,"Gold":3500}},"Saturday":{"roi":2.0,"sales":110000,"tables":{"Diamond":7000,"Platinium":5000,"Gold":3500}},"Sunday":{"roi":2.0,"sales":110000,"tables":{"Diamond":7000,"Platinium":5000,"Gold":3500}}},"Low":{"Thursday":{"roi":2.0,"sales":110000,"tables":{"Diamond":6500,"Platinium":5000,"Gold":4500}},"Friday":{"roi":2.0,"sales":110000,"tables":{"Diamond":6500,"Platinium":5000,"Gold":4500}},"Saturday":{"roi":2.0,"sales":110000,"tables":{"Diamond":6500,"Platinium":5000,"Gold":4500}},"Sunday":{"roi":2.0,"sales":110000,"tables":{"Diamond":6500,"Platinium":5000,"Gold":4500}}}}],"highSeasonMonths":[11,12,1,2,3,4]},"MILA Lounge":{"days":["Wednesday","Thursday","Friday","Saturday"],"tableCats":["Diamond","Prestige","Gold"],"tiers":[{"fee":5000,"High":{"Wednesday":{"roi":3.0,"sales":15000,"tables":{"Diamond":1500,"Prestige":500,"Gold":500}},"Thursday":{"roi":5.0,"sales":25000,"tables":{"Diamond":2000,"Prestige":1500,"Gold":1000}},"Friday":{"roi":9.0,"sales":45000,"tables":{"Diamond":3500,"Prestige":3000,"Gold":2000}},"Saturday":{"roi":9.0,"sales":45000,"tables":{"Diamond":3500,"Prestige":3000,"Gold":2000}}},"Low":{"Wednesday":{"roi":3.0,"sales":15000,"tables":{"Diamond":1500,"Prestige":500,"Gold":500}},"Thursday":{"roi":5.0,"sales":25000,"tables":{"Diamond":2000,"Prestige":1500,"Gold":1000}},"Friday":{"roi":8.0,"sales":40000,"tables":{"Diamond":3000,"Prestige":2500,"Gold":2000}},"Saturday":{"roi":8.0,"sales":40000,"tables":{"Diamond":3000,"Prestige":2500,"Gold":2000}}}},{"fee":15000,"High":{"Wednesday":{"roi":2.0,"sales":30000,"tables":{"Diamond":3000,"Prestige":2000,"Gold":750}},"Thursday":{"roi":2.5,"sales":37500,"tables":{"Diamond":3000,"Prestige":2500,"Gold":1500}},"Friday":{"roi":3.5,"sales":52500,"tables":{"Diamond":4000,"Prestige":3000,"Gold":2500}},"Saturday":{"roi":3.5,"sales":52500,"tables":{"Diamond":4000,"Prestige":3000,"Gold":2500}}},"Low":{"Wednesday":{"roi":2.0,"sales":30000,"tables":{"Diamond":3000,"Prestige":2000,"Gold":750}},"Thursday":{"roi":2.0,"sales":30000,"tables":{"Diamond":3000,"Prestige":2000,"Gold":750}},"Friday":{"roi":3.0,"sales":45000,"tables":{"Diamond":3500,"Prestige":3000,"Gold":2000}},"Saturday":{"roi":3.0,"sales":45000,"tables":{"Diamond":3500,"Prestige":3000,"Gold":2000}}}},{"fee":25000,"High":{"Wednesday":{"roi":2.0,"sales":50000,"tables":{"Diamond":4000,"Prestige":3000,"Gold":2500}},"Thursday":{"roi":2.0,"sales":50000,"tables":{"Diamond":4000,"Prestige":3000,"Gold":2500}},"Friday":{"roi":2.7,"sales":67500,"tables":{"Diamond":5000,"Prestige":4000,"Gold":3500}},"Saturday":{"roi":2.7,"sales":67500,"tables":{"Diamond":5000,"Prestige":4000,"Gold":3500}}},"Low":{"Wednesday":{"roi":2.0,"sales":50000,"tables":{"Diamond":4000,"Prestige":3000,"Gold":2500}},"Thursday":{"roi":2.0,"sales":50000,"tables":{"Diamond":4000,"Prestige":3000,"Gold":2500}},"Friday":{"roi":2.2,"sales":55000,"tables":{"Diamond":4500,"Prestige":3000,"Gold":2500}},"Saturday":{"roi":2.2,"sales":55000,"tables":{"Diamond":4500,"Prestige":3000,"Gold":2500}}}},{"fee":35000,"High":{"Wednesday":{"roi":2.0,"sales":70000,"tables":{"Diamond":5000,"Prestige":4500,"Gold":3500}},"Thursday":{"roi":2.0,"sales":80000,"tables":{"Diamond":6000,"Prestige":4500,"Gold":4000}},"Friday":{"roi":2.5,"sales":87500,"tables":{"Diamond":6500,"Prestige":5000,"Gold":4500}},"Saturday":{"roi":2.5,"sales":87500,"tables":{"Diamond":6500,"Prestige":5000,"Gold":4500}}},"Low":{"Wednesday":{"roi":2.0,"sales":70000,"tables":{"Diamond":5500,"Prestige":4000,"Gold":3500}},"Thursday":{"roi":2.0,"sales":70000,"tables":{"Diamond":5500,"Prestige":4000,"Gold":3500}},"Friday":{"roi":2.2,"sales":77000,"tables":{"Diamond":6000,"Prestige":5000,"Gold":3500}},"Saturday":{"roi":2.2,"sales":77000,"tables":{"Diamond":6000,"Prestige":5000,"Gold":3500}}}}],"highSeasonMonths":[11,12,1,2,3,4]}};

/* Sunset Rituals Rooftop Edition — Casa Neos Beach Club Aug 1–Sep 30 only.
   Visible under Venue ROI Rules; applied automatically for Beach Club dates in that window. */
var CNBC_SUMMER_ROOF_KEY = 'Casa Neos Beach Club Summer Roof';
var CNBC_SUMMER_ROOF_DEFAULT = (function(){
  function day(roi, sales, d, p, pr, g){
    return {roi:roi, sales:sales, tables:{Diamond:d, Platinum:p, Prestige:pr, Gold:g}};
  }
  function tier(fee, sat, sun){
    var block={Saturday:sat, Sunday:sun};
    return {fee:fee, High:JSON.parse(JSON.stringify(block)), Low:JSON.parse(JSON.stringify(block))};
  }
  return {
    label:'Sunset Rituals Rooftop Edition',
    appliesTo:'Casa Neos Beach Club',
    months:[8,9],
    days:['Saturday','Sunday'],
    tableCats:['Diamond','Platinum','Prestige','Gold'],
    highSeasonMonths:[8,9],
    tiers:[
      tier(5000,  day(7.5,37500,3000,1500,2000,1000), day(10,50000,4000,2000,3000,1000)),
      tier(10000, day(5,50000,4000,2000,3000,1000),   day(6,60000,5000,2000,4000,1000)),
      tier(15000, day(3.5,52500,4000,2000,3000,1000), day(4.5,67500,5000,2500,4000,1500)),
      tier(20000, day(3,60000,4000,2500,3000,2000),   day(4,80000,5000,3500,4500,2500))
    ]
  };
})();
VENUE_ROI_RULES[CNBC_SUMMER_ROOF_KEY]=CNBC_SUMMER_ROOF_DEFAULT;
function ensureCnbcSummerRoofRules(){
  if(!VENUE_ROI_RULES[CNBC_SUMMER_ROOF_KEY]){
    VENUE_ROI_RULES[CNBC_SUMMER_ROOF_KEY]=JSON.parse(JSON.stringify(CNBC_SUMMER_ROOF_DEFAULT));
  }
}
function effectiveRoiVenue(venue, dateStr, fee){
  if(venue!=='Casa Neos Beach Club') return venue;
  if(typeof isCnbcSummerFloor!=='function' || !isCnbcSummerFloor(dateStr)) return venue;
  ensureCnbcSummerRoofRules();
  var summer=VENUE_ROI_RULES[CNBC_SUMMER_ROOF_KEY];
  if(!summer||!summer.tiers||!summer.tiers.length) return venue;
  var maxFee=summer.tiers[summer.tiers.length-1].fee;
  if(fee && fee>maxFee) return venue; /* above rooftop ladder → regular Beach Club rules */
  return CNBC_SUMMER_ROOF_KEY;
}
function loadSavedVenueRules(){
  try{
    var saved=localStorage.getItem('rdg_venue_roi_rules');
    if(saved){
      var parsed=JSON.parse(saved);
      if(parsed && typeof parsed==='object'){ VENUE_ROI_RULES=parsed; }
    }
  }catch(e){}
  ensureCnbcSummerRoofRules();
}
function saveVenueRules(){
  ensureCnbcSummerRoofRules();
  try{ localStorage.setItem('rdg_venue_roi_rules', JSON.stringify(VENUE_ROI_RULES)); }catch(e){}
  if(window._fbSave) window._fbSave('venueRoiRules', VENUE_ROI_RULES);
  recalcAllSchedTargets();
  go();
  if(curView==='accounting') renderAccounting();
  if(curView==='budget'&&_budgetInited) renderBudget();
}

/* Determine High/Low season for a venue given a date string (YYYY-MM-DD) */
function seasonFor(venue, dateStr){
  var rules=VENUE_ROI_RULES[venue]; if(!rules) return 'High';
  var month=parseInt(dateStr.slice(5,7),10);
  return (rules.highSeasonMonths||[]).indexOf(month)>-1 ? 'High' : 'Low';
}

/* Day name from date string */
var DOW_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function dayNameFor(dateStr){
  return DOW_NAMES[new Date(dateStr+'T12:00:00').getDay()];
}

/* Find the nearest fee tier for a venue (ties broken toward the lower tier is NOT
   the rule   nearest by absolute distance, matching: 9000->5000 (closer), 11000->15000 (closer) */
function nearestTier(venue, fee){
  var rules=VENUE_ROI_RULES[venue]; if(!rules||!rules.tiers||!rules.tiers.length) return null;
  var best=null, bestDist=Infinity;
  rules.tiers.forEach(function(t){
    var dist=Math.abs(t.fee-fee);
    if(dist<bestDist){ bestDist=dist; best=t; }
  });
  return best;
}

/* Core lookup: given venue + date + DJ fee, return {bsTarget, roiTarget, tierFee, season, day}
   BS Target = the nearest tier's Sales figure for that day/season (does NOT scale with actual fee).
   ROI Target = if fee matches the tier's own anchor fee exactly, use the table's stored ROI;
                otherwise recompute as bsTarget / actualFee (so a cheaper DJ shows a higher req'd ROI,
                a pricier one a lower ROI, while still owing the same $ target).
   Casa Neos Beach Club Aug–Sep uses Sunset Rituals Summer Roof rules (not before/after). */
function venueRoiLookup(venue, dateStr, fee){
  var rulesVenue=effectiveRoiVenue(venue, dateStr, fee);
  var rules=VENUE_ROI_RULES[rulesVenue];
  if(!rules || !fee || fee<=0) return null;
  var day=dayNameFor(dateStr);
  if(rules.days.indexOf(day)===-1) return null; /* venue doesn't run DJs this day */
  var season=seasonFor(rulesVenue, dateStr);

  /* Above the highest defined tier: flat 2x ROI, any day, any season */
  var highestTier=rules.tiers[rules.tiers.length-1];
  if(highestTier && fee>highestTier.fee){
    return {
      bsTarget: Math.round(fee*2), roiTarget: 2,
      season: season, day: day, tierFee: 'above-max', tables: {},
      rulesVenue: rulesVenue, summerRoof: rulesVenue===CNBC_SUMMER_ROOF_KEY
    };
  }

  var tier=nearestTier(rulesVenue, fee);
  if(!tier) return null;
  var dayData=(tier[season]||{})[day];
  if(!dayData) return null;
  var bsTarget=dayData.sales;
  var roiTarget = (fee===tier.fee) ? dayData.roi : (bsTarget && fee ? +(bsTarget/fee).toFixed(2) : dayData.roi);
  return {
    bsTarget: bsTarget, roiTarget: roiTarget,
    tierFee: tier.fee, season: season, day: day,
    tables: dayData.tables||{},
    rulesVenue: rulesVenue, summerRoof: rulesVenue===CNBC_SUMMER_ROOF_KEY
  };
}


/* Live BS Target / ROI Tgt from Venue ROI rules (same for 2026/2027+). Falls back to generic FEE_TIERS. */
function showTargets(r){
  var v=r.v||r.venue;
  var fee=r.fee||r.cost||0;
  if(!v||!r.d||!fee) return {bs_m:r.bs_m||null, roi_t:r.roi_t||null};
  var look=venueRoiLookup(v, r.d, fee);
  if(look) return {bs_m:look.bsTarget, roi_t:look.roiTarget};
  return {bs_m:bsMinFor(fee), roi_t:roiTFor(fee)};
}
function applyShowTargets(r){
  var t=showTargets(r);
  if(t.bs_m!=null) r.bs_m=t.bs_m;
  if(t.roi_t!=null) r.roi_t=t.roi_t;
  return r;
}
function recalcAllSchedTargets(){
  SCHED.forEach(function(r){
    if(!r||r._s==='empty') return;
    if(!(r.fee||r.cost)) return;
    applyShowTargets(r);
  });
}

function tierFor(fee){
  if(!fee||fee<=0) return null;
  for(var i=0;i<FEE_TIERS.length;i++) if(fee<=FEE_TIERS[i].max) return FEE_TIERS[i];
  return FEE_TIERS[FEE_TIERS.length-1];
}

/*    ROI Rules   persisted per-browser via localStorage, editable in-app    */
function loadSavedRules(){
  try{
    var saved=localStorage.getItem('rdg_fee_tiers');
    if(saved){
      var parsed=JSON.parse(saved);
      if(Array.isArray(parsed)&&parsed.length){ FEE_TIERS=parsed; }
    }
  }catch(e){ /* localStorage unavailable   fall back to defaults, no crash */ }
}
function saveRules(){
  try{ localStorage.setItem('rdg_fee_tiers', JSON.stringify(FEE_TIERS)); }catch(e){}
  if(window._fbSave) window._fbSave('feeTiers', FEE_TIERS);
}
function openRulesEditor(){
  document.getElementById('rulesModal').classList.remove('hidden');
  renderRulesTable();
}
function closeRulesEditor(){ document.getElementById('rulesModal').classList.add('hidden'); }
function renderRulesTable(){
  var h='<table class="rules-tbl"><thead><tr><th>Fee up to</th><th>ROI Multiplier</th><th>Label</th><th></th></tr></thead><tbody>';
  FEE_TIERS.forEach(function(t,i){
    h+='<tr>';
    h+='<td><input type="number" class="rules-inp" value="'+t.max+'" onchange="updateRuleField('+i+',\'max\',this.value)"></td>';
    h+='<td><input type="number" step="0.1" class="rules-inp" value="'+t.mult+'" onchange="updateRuleField('+i+',\'mult\',this.value)"> x</td>';
    h+='<td><input type="text" class="rules-inp rules-inp-label" value="'+(t.label||'')+'" onchange="updateRuleField('+i+',\'label\',this.value)"></td>';
    h+='<td><button class="rules-del" onclick="removeRuleTier('+i+')" title="Remove tier">&#10005;</button></td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('rulesTableBody').innerHTML=h;
}
function updateRuleField(i,field,val){
  var before=_clone(FEE_TIERS);
  pushUndo('Edit ROI fee tier',function(){ FEE_TIERS=_clone(before); saveRules(); });
  if(field==='label') FEE_TIERS[i][field]=val;
  else FEE_TIERS[i][field]=parseFloat(val)||0;
  FEE_TIERS.sort(function(a,b){return a.max-b.max;});
  saveRules();
  renderRulesTable();
  go(); /* refresh whatever view is open so new rules apply immediately */
}
function removeRuleTier(i){
  if(FEE_TIERS.length<=1){ alert('At least one tier is required.'); return; }
  var before=_clone(FEE_TIERS);
  pushUndo('Remove ROI fee tier',function(){ FEE_TIERS=_clone(before); saveRules(); });
  FEE_TIERS.splice(i,1);
  saveRules();
  renderRulesTable();
  go();
}
function addRuleTier(){
  var before=_clone(FEE_TIERS);
  pushUndo('Add ROI fee tier',function(){ FEE_TIERS=_clone(before); saveRules(); });
  var lastMax=FEE_TIERS.length?FEE_TIERS[FEE_TIERS.length-1].max:0;
  FEE_TIERS.push({max:lastMax+10000, mult:3.0, label:'New tier'});
  saveRules();
  renderRulesTable();
}
function resetRulesToDefault(){
  if(!confirm('Reset all ROI rules to the original defaults? This cannot be undone.')) return;
  var before=_clone(FEE_TIERS);
  pushUndo('Reset ROI fee tiers',function(){ FEE_TIERS=_clone(before); saveRules(); });
  FEE_TIERS=[
    {max:2000,   mult:18.5, label:'Under $2K'},
    {max:5000,   mult:8.0,  label:'$2K-$5K'},
    {max:8000,   mult:7.0,  label:'$5K-$8K'},
    {max:12000,  mult:6.5,  label:'$8K-$12K'},
    {max:20000,  mult:6.0,  label:'$12K-$20K'},
    {max:30000,  mult:5.0,  label:'$20K-$30K'},
    {max:50000,  mult:4.0,  label:'$30K-$50K'},
    {max:80000,  mult:3.0,  label:'$50K-$80K'},
    {max:120000, mult:2.5,  label:'$80K-$120K'},
    {max:999999, mult:2.0,  label:'$120K+'},
  ];
  saveRules();
  renderRulesTable();
  go();
}
function bsMinFor(fee){ var t=tierFor(fee); return t?Math.round(fee*t.mult):null; }
function roiTFor(fee){ var t=tierFor(fee); return t?t.mult:null; }
/* Suggested "fair value" fee: find the fee tier whose bs-target most closely
   matches this DJ's proven average BS output. Iterates tiers band by band. */
function suggestedFeeForBS(avgBS){
  if(!avgBS||avgBS<=0) return null;
  var prevMax=0;
  for(var i=0;i<FEE_TIERS.length;i++){
    var t=FEE_TIERS[i];
    var impliedFee=avgBS/t.mult;
    if(impliedFee>prevMax && impliedFee<=t.max) return Math.round(impliedFee);
    prevMax=t.max;
  }
  return Math.round(avgBS/FEE_TIERS[FEE_TIERS.length-1].mult);
}
/* Suggested fee is a ceiling, never a raise: cap at what's actually been paid */
function cappedSuggestedFee(avgBS, actualCost){
  var fair=suggestedFeeForBS(avgBS);
  if(fair==null) return null;
  if(actualCost&&actualCost>0) return Math.min(fair, Math.round(actualCost));
  return fair;
}
/* Past BS Actuals for a DJ (SCHED + BS), used to calibrate a realistic fee. */
function historicalBsForDj(name){
  var q=String(name||'').replace(/\?+/g,'').trim().toUpperCase();
  if(!q) return [];
  var out=[], seen={};
  function push(d, bs, venue){
    if(bs==null||!(bs>0)||!d) return;
    var k=d+'|'+(venue||'');
    if(seen[k]) return;
    seen[k]=1;
    out.push({d:d, bs_a:bs, venue:venue||null});
  }
  SCHED.forEach(function(r){
    if(!r||r._s==='empty') return;
    var n=String(r.dj||'').replace(/\?+/g,'').trim().toUpperCase();
    if(n!==q && n.indexOf(q)<0 && q.indexOf(n)<0) return;
    push(r.d, r.bs_a, r.v||r.venue);
  });
  BS.forEach(function(r){
    if(!r) return;
    var n=String(r.dj||'').replace(/\?+/g,'').trim().toUpperCase();
    if(n!==q && n.indexOf(q)<0 && q.indexOf(n)<0) return;
    push(r.d, r.bs_a, r.venue);
  });
  return out;
}
/* Target BS for a candidate fee on a given venue/date (venue rules, else FEE_TIERS). */
function targetForFee(venue, dateStr, fee){
  if(!fee||fee<=0) return null;
  if(venue&&dateStr){
    var look=venueRoiLookup(venue, dateStr, fee);
    if(look&&look.bsTarget) return look.bsTarget;
  }
  return bsMinFor(fee);
}
/* Realistic suggested fee: raise/lower until historical beat-vs-target rate is about <=50%.
   If they beat too often at a low fee, suggest paying more (harder target). */
function realisticSuggestedFee(profile, venue, dateStr){
  if(!profile) return null;
  var past=historicalBsForDj(profile.name);
  if(past.length<2){
    return cappedSuggestedFee(profile.avg_bs, profile.avg_fee);
  }
  function beatRate(fee){
    var n=0, hits=0;
    past.forEach(function(p){
      var tgt=targetForFee(p.venue||venue, p.d||dateStr, fee);
      if(tgt==null) return;
      n++;
      if(p.bs_a>=tgt) hits++;
    });
    return n ? hits/n : 1;
  }
  var lo=500, hi=200000, best=cappedSuggestedFee(profile.avg_bs, profile.avg_fee)||profile.avg_fee||5000;
  /* Minimal fee such that beat rate <= 50% (paying enough that target is realistic). */
  for(var i=0;i<24;i++){
    var mid=Math.round((lo+hi)/2);
    if(beatRate(mid)<=0.5){ best=mid; hi=mid-1; }
    else { lo=mid+1; }
  }
  best=Math.max(500, Math.round(best/100)*100);
  return best;
}
/* Suggested fee for rankings:
   - Beat % >= 50%: match avg fee paid (working ? don't inflate)
   - Beat % < 50%: judgment ? fee supported by proven BS, never above avg paid */
function leaderboardSuggestedFee(avgBS, avgFeePaid, beatRatePct){
  var paid = avgFeePaid > 0 ? Math.round(avgFeePaid / 100) * 100 : null;
  if(paid != null && beatRatePct >= 50) return paid;
  var fair = cappedSuggestedFee(avgBS, avgFeePaid);
  if(fair == null) return paid;
  fair = Math.round(fair / 100) * 100;
  if(paid == null) return fair;
  /* Soft judgment: don't slash more than ~25% below avg paid in one step */
  var floor = Math.round(paid * 0.75 / 100) * 100;
  return Math.max(floor, Math.min(paid, fair));
}
function setBudgetSubTab(tab){
  budgetSubTab = tab==='planner' ? 'planner' : 'overview';
  var tO=document.getElementById('bgtTabOverview');
  var tP=document.getElementById('bgtTabPlanner');
  if(tO) tO.classList.toggle('on', budgetSubTab==='overview');
  if(tP) tP.classList.toggle('on', budgetSubTab==='planner');
  var titleEl=document.getElementById('budgetPageTitle');
  if(titleEl) titleEl.textContent=budgetSubTab==='planner'?'Budget Planner':'Overview';
  var sub=document.getElementById('pgSub');
  if(sub && curView==='budget') sub.innerHTML='<span>'+(budgetSubTab==='planner'?'Budget Planner':'Overview')+'</span>';
  bgtMonth=null;
  if(_budgetInited) renderBudget();
}

function initBudget(){
  var venues=[];
  SCHED.forEach(function(r){if(venues.indexOf(r.v)<0&&HIDE_V.indexOf(r.v)<0)venues.push(r.v);});
  venues.sort();
  var vs=document.getElementById('budgetVenue');
  vs.innerHTML=venues.map(function(v){
    return '<option value="'+v+'"'+(v===bgtVenue?' selected':'')+'>'+v+'</option>';
  }).join('');
  vs.onchange=function(){
    bgtVenue=vs.value; bgtMonth=null;
    /* Two-way sync: changing venue from inside Budget also changes it everywhere else */
    curV=bgtVenue;
    buildVenTabs(); buildSidebar();
    renderBudget();
  };
  document.getElementById('budgetYear').onchange=function(){bgtYear=+this.value;bgtMonth=null;renderBudget();};
  renderBudget();
}

