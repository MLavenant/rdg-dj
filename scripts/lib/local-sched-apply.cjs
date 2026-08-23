'use strict';
/** Shared local calendar apply logic (matches js/firebase-sync.js workbook path). */
const fs = require('fs');
const path = require('path');

function loadBaked() {
  const bakeFile = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'sched-baked.js'), 'utf8');
  return JSON.parse(bakeFile.match(/var SCHED\s*=\s*(\[[\s\S]*?\]);/)[1]);
}

function oldEnsureShowUid(rec) {
  if (!rec) return '';
  if (rec._uid) return rec._uid;
  if (rec._added) {
    rec._uid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    return rec._uid;
  }
  const base = [rec.venue || rec.v || '', rec.d || '', rec.dj || '', String(rec.fee != null ? rec.fee : rec.cost != null ? rec.cost : '')].join('|');
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = (h * 16777619) >>> 0; }
  rec._uid = 's_' + h.toString(36) + '_' + String(rec.d || '').replace(/-/g, '');
  return rec._uid;
}

function nightKey(r) {
  if (!r || !r.d) return '';
  return (r.v || r.venue || '') + '|' + r.d;
}

function nightLiveAuthority(edit) {
  if (!edit) return 0;
  let s = 0;
  const kind = edit._writeKind || '';
  if (kind === 'modal' || kind === 'evClear') s += 1000;
  else if (kind === 'statusMerge' || kind === 'djStatus') s += 10;
  else if (kind === 'vipNote' || kind === 'vip' || kind === 'agency') s += 5;
  if (edit.dj != null && String(edit.dj).trim() !== '') s += 100;
  if (edit.fee != null || edit.cost != null) s += 50;
  if (edit.djStatus) s += 5;
  return s;
}

function showScore(r) {
  if (!r) return -1;
  let score = 0;
  if (r.djStatus) score += 40;
  if (r.dj && String(r.dj).trim() && String(r.dj).toUpperCase() !== 'TBD') score += 20;
  if (r.fee != null || r.cost != null) score += 10;
  if (r.note) score += 3;
  if (r.vipNote) score += 2;
  if (r.ev) score += 2;
  if (!r._added) score += 15;
  return score;
}

function mergeDupFields(keep, lose) {
  if (!keep || !lose) return;
  const loseModal = lose._writeKind === 'modal' || lose._writeKind === 'evClear';
  if (loseModal || (lose._added && lose.dj && String(lose.dj).trim() !== '')) {
    if (lose.dj != null) keep.dj = lose.dj;
    if (lose.fee != null || lose.cost != null) {
      keep.fee = lose.fee != null ? lose.fee : lose.cost;
      keep.cost = lose.cost != null ? lose.cost : lose.fee;
    }
  } else {
    if ((!keep.dj || String(keep.dj).toUpperCase() === 'TBD') && lose.dj) keep.dj = lose.dj;
    if (keep.fee == null && keep.cost == null && (lose.fee != null || lose.cost != null)) {
      keep.fee = lose.fee != null ? lose.fee : lose.cost;
      keep.cost = lose.cost != null ? lose.cost : lose.fee;
    }
  }
  if (!keep.djStatus && lose.djStatus) keep.djStatus = lose.djStatus;
  if (!keep.note && lose.note) keep.note = lose.note;
  if (!keep.vipNote && lose.vipNote) keep.vipNote = lose.vipNote;
  if (!keep.agency && lose.agency) keep.agency = lose.agency;
  if (!keep.ev && lose.ev) keep.ev = lose.ev;
}

function dedupeSchedOnePerNight(s) {
  if (!s || !s.length) return s;
  const bestIdx = {};
  const dropUid = {};
  for (let i = 0; i < s.length; i++) {
    const r = s[i];
    if (!r || !r.d || r._s === 'empty') continue;
    const k = nightKey(r);
    if (!k) continue;
    if (bestIdx[k] == null) { bestIdx[k] = i; continue; }
    const a = s[bestIdx[k]], b = r;
    const keep = showScore(b) > showScore(a) ? b : a;
    const lose = keep === a ? b : a;
    mergeDupFields(keep, lose);
    if (keep === b) bestIdx[k] = i;
    if (lose._uid) dropUid[lose._uid] = lose;
  }
  return s.filter((r) => !(r && r._uid && dropUid[r._uid]));
}

function mergeSchedEditLocal(target, edit) {
  if (!target || !edit) return;
  const kind = edit._writeKind || '';
  if (kind === 'vipNote' || kind === 'vip') {
    if (Object.prototype.hasOwnProperty.call(edit, 'vipNote')) target.vipNote = edit.vipNote == null ? null : edit.vipNote;
    return;
  }
  if (kind === 'agency') {
    if (Object.prototype.hasOwnProperty.call(edit, 'agency')) target.agency = edit.agency == null ? null : edit.agency;
    return;
  }
  if (kind === 'modal' || kind === 'evClear') {
    if (Object.prototype.hasOwnProperty.call(edit, 'dj')) target.dj = edit.dj == null ? '' : edit.dj;
    if (edit.fee != null || edit.cost != null) {
      target.fee = edit.fee != null ? edit.fee : edit.cost;
      target.cost = edit.cost != null ? edit.cost : edit.fee;
    }
    Object.assign(target, edit);
    if (Object.prototype.hasOwnProperty.call(edit, 'dj')) target.dj = edit.dj == null ? '' : edit.dj;
    if (edit.fee != null || edit.cost != null) {
      target.fee = edit.fee != null ? edit.fee : edit.cost;
      target.cost = edit.cost != null ? edit.cost : edit.fee;
    }
    return;
  }
  if (kind === 'statusMerge' || kind === 'djStatus') {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    return;
  }
  const hasDj = edit.dj != null && String(edit.dj).trim() !== '';
  const hasFee = edit.fee != null || edit.cost != null;
  if (!hasDj && !hasFee) {
    if (Object.prototype.hasOwnProperty.call(edit, 'djStatus')) target.djStatus = edit.djStatus == null ? null : edit.djStatus;
    return;
  }
  Object.assign(target, edit);
}

function preservePendingModalShows(s, pend, gmap) {
  Object.keys(pend || {}).forEach((uid) => {
    const p = pend[uid];
    if (!p || p.confirmed || p.stale) return;
    if (p.kind !== 'modal' && p.kind !== 'evClear') return;
    const g = gmap[uid];
    if (!g || !g._lockIdentity) return;
    const nk = p.night || nightKey(g);
    if (!nk || nk === '|') return;
    const row = {
      v: g.v || g.venue || '',
      venue: g.venue || g.v || '',
      d: g.d,
      dj: g.dj || '',
      fee: g.fee != null ? g.fee : null,
      cost: g.cost != null ? g.cost : (g.fee != null ? g.fee : null),
      djStatus: g.djStatus,
      agency: g.agency,
      vipNote: g.vipNote,
      ev: g.ev || '',
      _uid: uid,
      _added: g._added || 0,
      _writeKind: 'modal'
    };
    const hits = s.filter((r) => r && nightKey(r) === nk);
    if (hits.length) {
      mergeSchedEditLocal(hits[0], row);
      hits[0]._uid = uid;
      hits[0]._added = row._added;
    } else {
      row._added = row._added || 1;
      s.push(row);
    }
  });
  return s;
}

function workbookUidForNight(map, venue, d, preferUid) {
  let bestKey = preferUid || '';
  let bestAuth = bestKey ? nightLiveAuthority(map[bestKey] || {}) : -1;
  Object.keys(map || {}).forEach((k) => {
    const row = map[k];
    if (!row || row.d !== d) return;
    if ((row.v || row.venue || '') !== venue) return;
    const auth = nightLiveAuthority(row);
    if (auth > bestAuth) { bestAuth = auth; bestKey = k; }
  });
  return bestKey;
}

function statusTxnPatch(map, venue, d, preferUid, nextStatus) {
  const wbUid = workbookUidForNight(map, venue, d, preferUid);
  const cur = map[wbUid];
  if (cur && typeof cur === 'object') {
    const next = Object.assign({}, cur);
    next.djStatus = nextStatus == null ? null : nextStatus;
    next.updatedAt = new Date().toISOString();
    next._writeKind = (cur._writeKind === 'modal' || cur._writeKind === 'evClear') ? cur._writeKind : 'statusMerge';
    map[wbUid] = next;
    return wbUid;
  }
  map[wbUid] = {
    d, v: venue, venue, _uid: wbUid, djStatus: nextStatus,
    _writeKind: 'statusMerge', _added: 1, updatedAt: new Date().toISOString()
  };
  return wbUid;
}

function applyLocal(baked, ov, opts) {
  const s = baked.map((r) => { const c = Object.assign({}, r); oldEnsureShowUid(c); return c; });
  const workbook = (ov && ov.shows) || {};
  const workbookUids = Object.keys(workbook).filter((uid) => workbook[uid]);
  const delsWRaw = ov && ov.deletes ? (Array.isArray(ov.deletes) ? ov.deletes : Object.values(ov.deletes)) : [];
  const delsW = delsWRaw.filter((dk) => dk && String(dk).split('|').length >= 3);

  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit) return;
    let dead = false;
    for (const dk of delsW) {
      const p0 = String(dk || '').split('|');
      if (dk === ((edit.v || edit.venue || '') + '|' + (edit.d || '') + '|' + uid) || (p0.length >= 3 && p0[2] === uid)) { dead = true; break; }
    }
    if (dead) return;
    let editN = edit;
    if (!editN._writeKind && ((editN.dj != null && String(editN.dj).trim() !== '') || editN.fee != null || editN.cost != null)) {
      editN = Object.assign({}, editN, { _writeKind: 'modal' });
    }
    const idx = s.findIndex((r) => r && String(r._uid || '') === String(uid));
    if (idx >= 0) {
      mergeSchedEditLocal(s[idx], editN);
      s[idx]._uid = uid;
    } else {
      const row = Object.assign({}, editN, { _uid: uid });
      const night = nightKey(row);
      const occupied = night ? s.filter((x) => x && nightKey(x) === night) : [];
      if (occupied.length) {
        mergeSchedEditLocal(occupied[0], row);
        occupied[0]._uid = uid;
        occupied[0]._added = 0;
      } else {
        row._added = 1;
        s.push(row);
      }
    }
  });

  const liveByNight = {};
  workbookUids.forEach((uid) => {
    const edit = workbook[uid];
    if (!edit || !edit.d) return;
    const nk = nightKey(edit);
    if (!nk) return;
    const prev = liveByNight[nk];
    const editAuth = nightLiveAuthority(edit);
    const prevAuth = prev ? nightLiveAuthority(prev.edit) : -1;
    const editAt = edit.updatedAt ? Date.parse(edit.updatedAt) : 0;
    const prevAt = prev && prev.edit && prev.edit.updatedAt ? Date.parse(prev.edit.updatedAt) : 0;
    if (!prev || editAuth > prevAuth || (editAuth === prevAuth && editAt >= prevAt)) {
      liveByNight[nk] = { uid, edit };
    }
  });
  Object.keys(liveByNight).forEach((nk) => {
    const pack = liveByNight[nk];
    const edit = Object.assign({}, pack.edit, { _uid: pack.uid, _writeKind: pack.edit._writeKind || 'modal' });
    const hits = s.filter((x) => x && nightKey(x) === nk);
    if (hits.length) {
      mergeSchedEditLocal(hits[0], edit);
      hits[0]._uid = pack.uid;
      hits[0]._added = 0;
    } else {
      edit._added = 1;
      s.push(edit);
    }
  });

  let out = s.filter((r) => {
    if (!r) return false;
    for (const dk of delsW) {
      const p = String(dk || '').split('|');
      const uidKey = (r.v || r.venue || '') + '|' + (r.d || '') + '|' + (r._uid || '');
      if (uidKey === dk || (p.length >= 3 && p[2] === r._uid)) return false;
    }
    return true;
  });

  if (opts && opts.pending && opts.guards) {
    out = preservePendingModalShows(out, opts.pending, opts.guards);
  }
  return dedupeSchedOnePerNight(out);
}

function findNight(rows, venue, d) {
  return rows.find((r) => (r.v || r.venue) === venue && r.d === d) || null;
}

module.exports = {
  loadBaked, applyLocal, findNight, nightKey, workbookUidForNight,
  statusTxnPatch, preservePendingModalShows, mergeSchedEditLocal, dedupeSchedOnePerNight
};
