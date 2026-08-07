/* Miami calendar day — must live outside sched-baked.js so bake regenerations
   cannot wipe it (that broke sync from v4.17: miamiToday ReferenceError → red dot). */
function miamiToday(){
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
var TODAY = miamiToday();

var HIDE_V   = ['AVA Winter Park'];
var CORE_VENUES = ['Casa Neos Beach Club','Casa Neos Lounge','MILA Lounge'];
function listActiveVenues(){
  var venues=CORE_VENUES.slice();
  SCHED.forEach(function(r){
    var v=r&& (r.v||r.venue);
    if(!v) return;
    if(venues.indexOf(v)<0 && HIDE_V.indexOf(v)<0) venues.push(v);
  });
  return venues;
}
var VENUE_COLORS = {
  'Casa Neos Beach Club': {a:'#a3402d', b:'#7a2f21'}, /* Casa Neos brand red */
  'MILA Lounge':          {a:'#2e2a2c', b:'#57504f'}, /* MILA brand charcoal */
  'Casa Neos Lounge':     {a:'#a3402d', b:'#7a2f21'}, /* Casa Neos brand red (shared family) */
};
