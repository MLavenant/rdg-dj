var curV     = 'Casa Neos Beach Club';
var curYr    = 2026;
var curM     = 0;  /* 0-11 fiscal month index */
var curView  = 'calendar';
var _editIdx = -1;

/*    Lookup index: venue+date -> [sched records]                     */
var IDX = {};
function buildIdx(arr) {
  var o = {};
  arr.forEach(function(r) {
    var k = r.v + '|' + r.d;
    if (!o[k]) o[k] = [];
    o[k].push(r);
  });
  return o;
}

/* Prior-year match for PY columns:
   Keep the same weekday (Sun?Sun, Sat?Sat). Exact calendar anniversary only
   when that date is also the same weekday; otherwise closest same-weekday
   show within 3 days. Each prior-year show used at most once per month. */
function _ymdLocal(d){
  var y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  return y+'-'+(m<10?'0':'')+m+'-'+(day<10?'0':'')+day;
}
/* 4-4-5 fiscal months: each fiscal year starts on the first Monday on/after Dec 28, then 4/4/5 weeks repeating through December. */
