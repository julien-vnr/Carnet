/* Carnet d'entraînement – logique du site.
   Les données sont dans carnet.json (dépôt privé carnet-data), lues et écrites avec l'API GitHub. */
(() => {
'use strict';

/* ---------- Outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = {};
const fmt = (n, d = 1) => (n == null || !isFinite(n)) ? '–' : (NF[d] ||= new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d })).format(n);
const parseNum = v => { if (v == null) return null; const s = String(v).trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'); if (!s) return null; const n = Number(s); return isFinite(n) ? n : null; };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISO(new Date());
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
const DF = {
  wd: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }),
  dm: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }),
  wdm: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
  dd: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }),
  dmy: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
};
const fDM = iso => DF.dm.format(fromISO(iso));
const fWDM = iso => DF.wdm.format(fromISO(iso));
const ago = iso => { const n = daysBetween(iso, todayISO()); if (n < 0) return 'à venir'; if (n === 0) return "aujourd'hui"; if (n === 1) return 'hier'; return `il y a ${n} jours`; };
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); };
const fDur = s => { if (!(s > 0)) return '–'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
const fPace = (sec, m) => { if (!(sec > 0 && m > 0)) return '–'; const t = Math.round(sec / (m / 1000)); return `${Math.floor(t / 60)}'${pad(t % 60)}"/km`; };
const parseDur = v => { const s = String(v || '').trim().replace(',', '.'); if (!s) return null; if (/^\d+(\.\d+)?$/.test(s)) return Math.round(+s * 60); const p = s.split(':').map(Number); if (p.some(isNaN)) return null; return p.reduce((a, b) => a * 60 + b, 0); };
const e1rm = (kg, reps) => reps <= 1 ? kg : kg * (1 + reps / 30);
const sprintDist = name => { const m = String(name).match(/(\d+)\s*m\b/i); return m ? +m[1] : 0; };
const isRun = t => !t || /run|trail|jog|course/i.test(String(t));
const isBench = name => { const n = norm(name); return n.includes('developpe couche') && !/haltere|incline|decline|serre/.test(n); };

/* ---------- Programme ---------- */
const CATS = {
  force: { label: 'Force', c: 'var(--plate-blue)' },
  hyper: { label: 'Hypertrophie', c: 'var(--plate-yellow)' },
  sprint: { label: 'Sprint', c: 'var(--plate-red)' },
  course: { label: 'Course', c: 'var(--plate-green)' },
  libre: { label: 'Libre', c: 'var(--plate-chrome)' },
};
const TEMPLATES = [
  { id: 'force_pecs', day: 'Lun', title: 'Pecs · Triceps', cat: 'force', ex: [
    ['Développé couché', 'charge', 5], ['Développé incliné haltères', 'charge', 3], ['Dips', 'pdc', 3],
    ['Écarté poulie vis-à-vis', 'charge', 3], ['Barre au front', 'charge', 3], ['Extension triceps poulie', 'charge', 3]] },
  { id: 'dos_bras', day: 'Mar', title: 'Dos · Biceps · Avant-bras', cat: 'force', ex: [
    ['Tractions', 'pdc', 4], ['Rowing barre', 'charge', 4], ['Tirage vertical', 'charge', 3], ['Rowing haltère', 'charge', 3],
    ['Curl barre', 'charge', 3], ['Curl marteau', 'charge', 3], ['Curl poignets (avant-bras)', 'charge', 3]] },
  { id: 'sprint', day: 'Mer', title: 'Sprint', note: '15 min', cat: 'sprint', ex: [
    ['Sprint 10 m', 'sprint', 4], ['Sprint 20 m', 'sprint', 3], ['Sprint 30 m', 'sprint', 3], ['Sprint 40 m', 'sprint', 2]] },
  { id: 'sprint_complet', day: 'Mer', title: 'Sprint complet', note: '30 min', cat: 'sprint', ex: [
    ['Sauts groupés', 'pdc', 3], ['Foulées bondissantes 20 m', 'sprint', 2], ['Sprint 10 m', 'sprint', 4], ['Sprint 20 m', 'sprint', 3],
    ['Sprint 30 m', 'sprint', 3], ['Sprint 40 m', 'sprint', 2], ['Sprint 20 m lancé', 'sprint', 2]] },
  { id: 'hypertrophie', day: 'Ven', title: 'Pecs · Épaules · Dos · Biceps', cat: 'hyper', ex: [
    ['Développé couché haltères', 'charge', 4], ['Développé militaire haltères', 'charge', 4], ['Élévations latérales', 'charge', 4],
    ['Tirage horizontal', 'charge', 4], ['Pec deck', 'charge', 3], ['Curl incliné haltères', 'charge', 3]] },
  { id: 'libre', day: null, title: 'Séance libre', cat: 'libre', ex: [] },
];
const TPL = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
// getDay() : 0 = dimanche
const PLAN = { 1: { tpl: 'force_pecs' }, 2: { tpl: 'dos_bras', run: true }, 3: { tpl: 'sprint' }, 4: { rest: true }, 5: { tpl: 'hypertrophie', run: true }, 6: { free: true }, 0: { run: true } };
const PLANNED_SESSIONS = Object.values(PLAN).filter(p => p.tpl).length;
const PLANNED_RUNS = Object.values(PLAN).filter(p => p.run).length;
const KINDS = {
  charge: { label: 'Charge', fields: [['kg', 'kg', 'decimal'], ['reps', 'reps', 'numeric']], sep: '×' },
  pdc: { label: 'Poids du corps', fields: [['reps', 'reps', 'numeric'], ['kg', 'kg lest', 'decimal']], sep: '+' },
  sprint: { label: 'Sprint', fields: [['time', 's', 'decimal']], sep: '' },
};
const MFIELDS = [
  ['poids', 'Poids', 'kg'], ['mg', 'Masse grasse', '%'], ['cou', 'Cou', 'cm'], ['epaules', 'Épaules', 'cm'], ['poitrine', 'Poitrine', 'cm'],
  ['bras', 'Bras contracté', 'cm'], ['avantbras', 'Avant-bras', 'cm'], ['taille', 'Taille (nombril)', 'cm'], ['hanches', 'Hanches', 'cm'],
  ['cuisse', 'Cuisse', 'cm'], ['mollet', 'Mollet', 'cm'],
];

/* ---------- Stockage : fichier carnet.json dans ton dépôt GitHub privé ---------- */
const LS_DRAFT = 'carnet-brouillon';
const LS_CACHE = 'carnet-cache';
const LS_PENDING = 'carnet-en-attente';
const LS_CFG = 'carnet-github';
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const EMPTY = () => ({ version: 1, seances: {}, mesures: {}, courses: {}, config: {}, strava: {} });
const clone = o => JSON.parse(JSON.stringify(o));
const normalize = d => { const e = EMPTY(); d = d && typeof d === 'object' ? d : {}; Object.keys(e).forEach(k => { if (d[k] == null || typeof d[k] !== typeof e[k]) d[k] = e[k]; }); return d; };

// Réglages de connexion (gardés sur l'appareil, jamais dans le code)
const cfg = () => ({ owner: 'julien-vnr', repo: 'carnet-data', path: 'carnet.json', token: '', ...(lsGet(LS_CFG) || {}) });
const apiUrl = (c = cfg()) => `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path}`;

const b64encode = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64decode = b => { const bin = atob(String(b).replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))); };

async function gh(url, opts = {}, token = cfg().token) {
  return fetch(url, { cache: 'no-store', ...opts, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
}
async function httpErr(r) { let m = ''; try { m = (await r.json()).message || ''; } catch { /* vide */ } const e = new Error(m || 'HTTP ' + r.status); e.status = r.status; return e; }
async function ghGet() {
  const c = cfg(), url = apiUrl(c);
  const r = await gh(url);
  if (r.status === 404) {
    const rr = await gh(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`);
    if (rr.ok) return { data: EMPTY(), sha: null }; // dépôt OK, fichier pas encore créé
    throw await httpErr(rr);
  }
  if (!r.ok) throw await httpErr(r);
  const j = await r.json();
  let text = j.content ? b64decode(j.content) : '';
  if (!text && j.size) { const raw = await gh(url, { headers: { Accept: 'application/vnd.github.raw' } }); if (!raw.ok) throw await httpErr(raw); text = await raw.text(); }
  return { data: normalize(text ? JSON.parse(text) : {}), sha: j.sha };
}
async function ghPut(data, sha, message) {
  const body = { message, content: b64encode(JSON.stringify(data, null, 1)) };
  if (sha) body.sha = sha;
  const r = await gh(apiUrl(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw await httpErr(r);
  return (await r.json()).content.sha;
}
function applyOp(d, op) {
  if (op.t === 'put') d[op.c][op.id] = { ...op.b };
  else if (op.t === 'del') delete d[op.c][op.id];
  else if (op.t === 'doc') d[op.k] = { ...d[op.k], ...op.b };
}
function commitMessage(ops) {
  const parts = [...new Set(ops.map(op => {
    if (op.t === 'put' && op.c === 'seances') return 'Séance du ' + op.b.date;
    if (op.t === 'put' && op.c === 'mesures') return 'Mesures du ' + op.b.date;
    if (op.t === 'put' && op.c === 'courses') return 'Course du ' + op.b.date;
    if (op.t === 'del') return 'Suppression';
    if (op.t === 'doc' && op.k === 'strava') return 'Import Strava';
    return 'Réglages';
  }))];
  return parts.slice(0, 3).join(', ') + (parts.length > 3 ? '…' : '');
}
function syncErrText(e) {
  if (!e || !e.status) return "Pas de réseau : tes modifications restent sur cet appareil et partiront dès que la connexion revient.";
  if (e.status === 401) return 'Jeton GitHub refusé (expiré ou mal copié). Mets-en un nouveau dans les réglages.';
  if (e.status === 403) return /rate limit/i.test(e.message) ? 'GitHub limite les requêtes pour le moment. Réessaie dans quelques minutes.' : "Ton jeton n'a pas le droit d'écrire : il lui faut la permission « Contents : Read and write » sur carnet-data.";
  if (e.status === 404) return 'Dépôt introuvable : vérifie son nom dans les réglages et que ton jeton y a accès.';
  return `Erreur GitHub ${e.status} : ${e.message}`;
}
const dbErr = e => syncErrText(e);

const Store = {
  mode: 'loading', // loading | ok | notoken | offline | error
  remote: EMPTY(), data: EMPTY(), sha: null, pending: [], syncing: false, error: '', lastSync: null,
  init() {
    const cache = lsGet(LS_CACHE);
    if (cache && cache.data) { this.remote = normalize(cache.data); this.sha = cache.sha || null; this.lastSync = cache.at || null; }
    this.pending = lsGet(LS_PENDING) || [];
    this.rebuild();
    if (!cfg().token) { this.mode = 'notoken'; changed(); return; }
    this.pull();
  },
  rebuild() { const d = clone(this.remote); this.pending.forEach(op => applyOp(d, op)); this.data = d; },
  saveLocal() { lsSet(LS_PENDING, this.pending); lsSet(LS_CACHE, { data: this.remote, sha: this.sha, at: this.lastSync }); },
  async pull() {
    if (!cfg().token) { this.mode = 'notoken'; changed(); return; }
    if (this.syncing) return;
    this.syncing = true; changed();
    try {
      const { data, sha } = await ghGet();
      this.remote = data; this.sha = sha; this.lastSync = Date.now(); this.error = ''; this.mode = 'ok';
      this.rebuild(); this.saveLocal();
    } catch (e) { this.mode = e.status ? 'error' : 'offline'; this.error = syncErrText(e); }
    this.syncing = false; changed();
    if (this.pending.length && this.mode === 'ok') this.flush();
  },
  async flush() {
    if (this.syncing || !this.pending.length) return;
    if (!cfg().token) { this.mode = 'notoken'; changed(); return; }
    this.syncing = true; changed();
    try {
      for (let attempt = 0; ; attempt++) {
        const { data, sha } = await ghGet();
        const ops = this.pending.slice(), next = clone(data);
        ops.forEach(op => applyOp(next, op));
        try {
          this.sha = await ghPut(next, sha, commitMessage(ops));
          this.remote = next; this.pending = this.pending.slice(ops.length); this.lastSync = Date.now();
          this.error = ''; this.mode = 'ok'; this.rebuild(); this.saveLocal();
          break;
        } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
      }
    } catch (e) { this.mode = e.status ? 'error' : 'offline'; this.error = syncErrText(e); }
    this.syncing = false; changed();
    if (this.pending.length && this.mode === 'ok') this.flush();
  },
  enqueue(op) { this.pending.push(op); applyOp(this.data, op); this.saveLocal(); changed(); this.flush(); },
  get loaded() { return this.mode !== 'loading'; },
  async put(c, id, obj) { const b = { ...obj }; delete b.id; this.enqueue({ t: 'put', c, id, b }); },
  async remove(c, id) { this.enqueue({ t: 'del', c, id }); },
  async putDoc(k, b) { this.enqueue({ t: 'doc', k, b: { ...b } }); },
};
window.addEventListener('online', () => Store.pull());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cfg().token && (!Store.lastSync || Date.now() - Store.lastSync > 60000)) Store.pull(); });

/* ---------- Données dérivées ---------- */
const sessions = () => Object.values(Store.data.seances).filter(s => s && s.date).sort((a, b) => a.date === b.date ? (a.savedAt || 0) - (b.savedAt || 0) : a.date < b.date ? -1 : 1);
const measures = () => Object.values(Store.data.mesures).filter(m => m && m.date).sort((a, b) => a.date === b.date ? (a.savedAt || 0) - (b.savedAt || 0) : a.date < b.date ? -1 : 1);
const activities = () => {
  const st = Object.values((Store.data.strava && Store.data.strava.items) || {});
  const man = Object.values(Store.data.courses).map(c => ({ ...c, src: 'manuel' }))
    .filter(c => !st.some(a => a.date === c.date && isRun(a.type) && Math.abs((a.dist || 0) - (c.dist || 0)) < 300));
  return [...st, ...man].filter(a => a && a.date).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
};
const runs = () => activities().filter(a => isRun(a.type));
const benchGoal = () => parseNum(Store.data.config.benchGoal) || 100;

function sessionStats(s) {
  let sets = 0, ton = 0, dist = 0;
  (s.exercises || []).forEach(e => (e.sets || []).forEach(st => {
    sets++;
    if (e.kind === 'charge' && st.kg > 0 && st.reps > 0) ton += st.kg * st.reps;
    if (e.kind === 'pdc' && st.kg > 0 && st.reps > 0) ton += st.kg * st.reps;
    if (e.kind === 'sprint') dist += sprintDist(e.name);
  }));
  return { ex: (s.exercises || []).length, sets, ton, dist };
}
function sessionSummary(s) {
  const st = sessionStats(s);
  const parts = [`${st.ex} exo${st.ex > 1 ? 's' : ''}`, `${st.sets} série${st.sets > 1 ? 's' : ''}`];
  if (st.ton) parts.push(`${fmt(st.ton, 0)} kg soulevés`);
  if (st.dist) parts.push(`${fmt(st.dist, 0)} m de sprint`);
  return parts.join(' · ');
}
function fmtSet(kind, st) {
  if (kind === 'charge') return `${fmt(st.kg)} × ${fmt(st.reps, 0)}`;
  if (kind === 'pdc') return `${fmt(st.reps, 0)}${st.kg > 0 ? ` (+${fmt(st.kg)} kg)` : ''}`;
  return st.time > 0 ? `${fmt(st.time, 2)} s` : '✓';
}
function lastPerf(name, beforeDate, excludeId) {
  const k = norm(name); if (!k) return null;
  const list = sessions().filter(s => s.id !== excludeId && (!beforeDate || s.date <= beforeDate)).reverse();
  for (const s of list) {
    const e = (s.exercises || []).find(x => norm(x.name) === k);
    if (e && e.sets && e.sets.length) return { date: s.date, kind: e.kind, sets: e.sets };
  }
  return null;
}
function metric(e) {
  const sets = e.sets || [];
  if (e.kind === 'charge') {
    let best = null, maxKg = 0;
    sets.forEach(st => { if (st.kg > 0 && st.reps > 0) { const v = e1rm(st.kg, st.reps); if (!best || v > best.y) best = { y: v, kg: st.kg, reps: st.reps }; if (st.kg > maxKg) maxKg = st.kg; } });
    return best && { ...best, maxKg };
  }
  if (e.kind === 'pdc') { const r = Math.max(0, ...sets.map(s => s.reps || 0)); return r > 0 ? { y: r } : null; }
  const t = sets.map(s => s.time).filter(x => x > 0);
  return t.length ? { y: Math.min(...t) } : null;
}
function exerciseIndex() {
  const idx = new Map();
  sessions().forEach(s => (s.exercises || []).forEach(e => {
    const k = norm(e.name); if (!k) return;
    let it = idx.get(k);
    if (!it) { it = { key: k, name: e.name, kind: e.kind, pts: [] }; idx.set(k, it); }
    it.name = e.name; it.kind = e.kind;
    const m = metric(e); if (m) it.pts.push({ d: s.date, ...m });
  }));
  return idx;
}
function benchInfo() {
  let bestLift = null, bestE1 = null;
  sessions().forEach(s => (s.exercises || []).forEach(e => {
    if (e.kind !== 'charge' || !isBench(e.name)) return;
    (e.sets || []).forEach(st => {
      if (!(st.kg > 0 && st.reps > 0)) return;
      if (!bestLift || st.kg > bestLift.kg || (st.kg === bestLift.kg && st.reps > bestLift.reps)) bestLift = { kg: st.kg, reps: st.reps, date: s.date };
      const v = e1rm(st.kg, st.reps);
      if (!bestE1 || v > bestE1.v) bestE1 = { v, kg: st.kg, reps: st.reps, date: s.date };
    });
  }));
  return { bestLift, bestE1 };
}
function latestMeasures() {
  const list = measures();
  const out = {};
  MFIELDS.forEach(([k]) => {
    const withK = list.filter(m => m[k] != null && isFinite(m[k]));
    if (!withK.length) return;
    const last = withK[withK.length - 1], prev = withK[withK.length - 2];
    out[k] = { v: last[k], date: last.date, delta: prev ? last[k] - prev[k] : null };
  });
  return out;
}

/* ---------- État de l'interface ---------- */
const state = { tab: 'semaine', weekOffset: 0, draft: null, progEx: null };
const VIEWS = {};
let pendingRender = false;
function changed() { requestRender(); }
function requestRender() {
  const f = $('#seance-form');
  if (state.tab === 'seance' && f && f.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) { pendingRender = true; return; }
  render();
}

/* ---------- Brouillon de séance ---------- */
function newDraft(date, tplId) {
  const tpl = TPL[tplId] || TPL.libre;
  const prev = sessions().filter(s => s.tpl === tpl.id).pop();
  const list = prev && prev.exercises && prev.exercises.length
    ? prev.exercises.map(e => [e.name, e.kind, Math.max(1, (e.sets || []).length)])
    : tpl.ex;
  return {
    id: null, date, tpl: tpl.id, title: tpl.title, cat: tpl.cat, notes: '',
    exercises: list.map(([name, kind, n]) => ({ name, kind, sets: Array.from({ length: n }, () => ({ kg: '', reps: '', time: '' })) })),
  };
}
function draftFromSession(s) {
  return {
    id: s.id, date: s.date, tpl: s.tpl || 'libre', title: s.title || (TPL[s.tpl] || TPL.libre).title, cat: s.cat || (TPL[s.tpl] || TPL.libre).cat, notes: s.notes || '',
    exercises: (s.exercises || []).map(e => ({ name: e.name, kind: e.kind, sets: (e.sets || []).map(st => ({ kg: st.kg != null ? String(st.kg) : '', reps: st.reps != null ? String(st.reps) : '', time: st.time != null ? String(st.time) : '' })) })),
  };
}
const draftDirty = () => !!state.draft && (!!state.draft.notes.trim() || state.draft.exercises.some(e => e.sets.some(s => String(s.kg).trim() || String(s.reps).trim() || String(s.time).trim())));
let draftTimer;
const saveDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => lsSet(LS_DRAFT, state.draft), 300); };
function ensureDraft() {
  if (!state.draft) { const t = todayISO(); state.draft = newDraft(t, PLAN[new Date().getDay()].tpl || 'libre'); }
  return state.draft;
}

/* ---------- Graphiques (dessinés à la largeur réelle) ---------- */
const charts = [];
const chartSlot = (spec) => { charts.push(spec); return `<div class="chart" data-cid="${charts.length - 1}" style="height:${spec.h || 190}px" role="img" aria-label="${esc(spec.aria || '')}"></div>`; };
function niceTicks(min, max, n = 4) {
  if (min === max) { const p = Math.abs(min) * 0.05 || 1; min -= p; max += p; }
  const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const out = []; for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}
const colPath = (x, y, w, h, r = 4) => { if (h <= 0) return ''; r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
function drawChart(el, spec) {
  const W = Math.max(260, el.clientWidth), H = spec.h || 190;
  const T = 18, B = 26, L = 44, R = spec.type === 'line' ? 64 : 10;
  const ih = H - T - B, iw = W - L - R;
  let svg = '', pts = [];
  const vals = spec.data.map(p => p.y);
  const ticks = spec.type === 'bar' ? niceTicks(0, Math.max(1, ...vals), 3) : niceTicks(Math.min(...vals), Math.max(...vals), 3);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const sy = v => T + (1 - (v - y0) / ((y1 - y0) || 1)) * ih;
  const step = ticks[1] - ticks[0];
  const td = Number.isInteger(step) ? 0 : Number.isInteger(Math.round(step * 1e6) / 1e5) ? 1 : 2;
  ticks.forEach(t => { const y = sy(t).toFixed(1); svg += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${+y + 4}" text-anchor="end">${fmt(t, td)}</text>`; });
  if (spec.type === 'line') {
    const tms = spec.data.map(p => fromISO(p.d).getTime());
    let a = Math.min(...tms), b = Math.max(...tms); if (a === b) { a -= 864e5; b += 864e5; }
    const sx = v => L + (v - a) / (b - a) * iw;
    pts = spec.data.map((p, i) => ({ x: sx(tms[i]), y: sy(p.y), title: fWDM(p.d), value: p.label || (fmt(p.y, spec.digits ?? 1) + (spec.unit ? ' ' + spec.unit : '')) }));
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('');
    svg += `<path d="${line}L${pts[pts.length - 1].x.toFixed(1)},${T + ih}L${pts[0].x.toFixed(1)},${T + ih}Z" fill="var(--accent)" fill-opacity="0.1"/>`;
    svg += `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const e = pts[pts.length - 1];
    svg += `<circle cx="${e.x}" cy="${e.y}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    svg += `<text class="end" x="${e.x + 10}" y="${e.y + 4}">${esc(fmt(spec.data[spec.data.length - 1].y, spec.digits ?? 1))}</text>`;
    svg += `<text x="${L}" y="${H - 6}">${esc(fDM(spec.data[0].d))}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(fDM(spec.data[spec.data.length - 1].d))}</text>`;
    svg += `<g class="hv" opacity="0"><line x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="var(--muted)" stroke-width="1"/><circle r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/></g>`;
  } else {
    const n = spec.data.length, band = iw / n, bw = Math.min(24, band * 0.62);
    spec.data.forEach((p, i) => {
      const x = L + band * i + (band - bw) / 2, y = sy(p.y), h = T + ih - y;
      svg += `<path class="bar" data-i="${i}" d="${colPath(x, y, bw, h)}" fill="var(--accent)"/>`;
      const showLabel = n <= 8 || i % 2 === n % 2;
      if (showLabel) svg += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(p.x)}</text>`;
      pts.push({ x: x + bw / 2, y, title: p.title || p.x, value: p.label || (fmt(p.y, spec.digits ?? 0) + (spec.unit ? ' ' + spec.unit : '')) });
    });
    const last = spec.data[n - 1];
    if (last && last.y > 0) svg += `<text class="end" x="${pts[n - 1].x}" y="${pts[n - 1].y - 6}" text-anchor="middle">${esc(fmt(last.y, spec.digits ?? 0))}</text>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg><div class="tip" hidden></div>`;
  const tip = el.querySelector('.tip'), hv = el.querySelector('.hv'), svgEl = el.querySelector('svg');
  const show = ev => {
    const r = svgEl.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
    let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; bi = i; } });
    const p = pts[bi];
    if (hv) { hv.setAttribute('opacity', 1); hv.querySelector('line').setAttribute('x1', p.x); hv.querySelector('line').setAttribute('x2', p.x); const c = hv.querySelector('circle'); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); }
    el.querySelectorAll('.bar').forEach(b => b.setAttribute('fill-opacity', +b.dataset.i === bi ? 1 : 0.45));
    tip.hidden = false; tip.innerHTML = `<b>${esc(p.value)}</b>${esc(p.title)}`;
    const k = r.width / W; const left = Math.min(Math.max(p.x * k, 70), r.width - 70);
    tip.style.left = left + 'px'; tip.style.top = (p.y * k) + 'px';
  };
  const hide = () => { tip.hidden = true; if (hv) hv.setAttribute('opacity', 0); el.querySelectorAll('.bar').forEach(b => b.setAttribute('fill-opacity', 1)); };
  el.onpointermove = show; el.onpointerdown = show; el.onpointerleave = hide;
}
function drawCharts() { document.querySelectorAll('.chart[data-cid]').forEach(el => { const s = charts[+el.dataset.cid]; if (s) drawChart(el, s); }); }
let rzTimer; window.addEventListener('resize', () => { clearTimeout(rzTimer); rzTimer = setTimeout(drawCharts, 150); });

/* ---------- Barre chargée ---------- */
const PLATES = [
  { w: 25, c: 'var(--plate-red)', h: 1, t: 15 }, { w: 20, c: 'var(--plate-blue)', h: 1, t: 13 }, { w: 15, c: 'var(--plate-yellow)', h: 1, t: 11 },
  { w: 10, c: 'var(--plate-green)', h: 1, t: 9 }, { w: 5, c: 'var(--plate-white)', h: .6, t: 8 }, { w: 2.5, c: 'var(--plate-red)', h: .46, t: 6 },
  { w: 1.25, c: 'var(--plate-chrome)', h: .38, t: 5 },
];
function platesFor(total) {
  let side = Math.max(0, (total - 20) / 2); const out = [];
  PLATES.forEach(p => { while (side >= p.w - 1e-9) { out.push(p); side -= p.w; } });
  return { plates: out, rest: Math.round(side * 100) / 100 };
}
function barbellSVG(total) {
  const W = 460, H = 100, cy = H / 2, PH = 92;
  const { plates } = platesFor(total);
  let s = `<rect x="14" y="${cy - 4}" width="${W - 28}" height="8" rx="3" fill="var(--bar)"/>`;
  s += `<rect x="150" y="${cy - 3}" width="160" height="6" fill="var(--bar)" opacity=".75"/>`;
  s += `<rect x="142" y="${cy - 11}" width="8" height="22" rx="2" fill="var(--bar)"/><rect x="${W - 150}" y="${cy - 11}" width="8" height="22" rx="2" fill="var(--bar)"/>`;
  let xr = W - 142 + 2, xl = 142 - 2;
  plates.forEach(p => {
    const h = PH * p.h, y = cy - h / 2, st = p.w === 5 ? ' stroke="var(--line)" stroke-width="1"' : '';
    s += `<rect x="${xr}" y="${y}" width="${p.t}" height="${h}" rx="2.5" fill="${p.c}"${st}/>`;
    s += `<rect x="${xl - p.t}" y="${y}" width="${p.t}" height="${h}" rx="2.5" fill="${p.c}"${st}/>`;
    xr += p.t + 2; xl -= p.t + 2;
  });
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${s}</svg>`;
}
function platesText(total) {
  const { plates, rest } = platesFor(total);
  if (total <= 20) return 'barre seule (20 kg)';
  const names = plates.map(p => fmt(p.w, 2)).join(' + ');
  return `barre 20 + 2 × (${names}${rest > 0 ? ` + ${fmt(rest, 2)}` : ''})`;
}

/* ---------- Import gratuit : export Strava (.zip ou activities.csv) ---------- */
const Imp = { busy: false, msg: '' };
const TYPE_FR = { Run: 'Course à pied', TrailRun: 'Trail', VirtualRun: 'Course (tapis)', Ride: 'Vélo', VirtualRide: 'Vélo (home trainer)', Walk: 'Marche', Hike: 'Randonnée', Swim: 'Natation', WeightTraining: 'Muscu', Workout: 'Entraînement' };
const typeLabel = t => TYPE_FR[t] || t || 'Course à pied';
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const EN_M = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const FR_M = [['janv', 0], ['jan', 0], ['fevr', 1], ['fev', 1], ['mars', 2], ['avr', 3], ['mai', 4], ['juin', 5], ['juil', 6], ['aout', 7], ['sept', 8], ['oct', 9], ['nov', 10], ['dec', 11]];
function parseStravaDate(raw) {
  const s = String(raw || '').trim(); if (!s) return null;
  const utc = (y, mo, d, h, mi, se) => toISO(new Date(Date.UTC(y, mo, d, h, mi, se || 0)));
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return utc(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (m && EN_M[m[1].toLowerCase()] != null) { let h = +m[4]; const ap = (m[7] || '').toUpperCase(); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0; return utc(+m[3], EN_M[m[1].toLowerCase()], +m[2], h, +m[5], +(m[6] || 0)); }
  m = norm(s).match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4}),?\s+(?:a\s+)?(\d{1,2})[:h](\d{2})(?::(\d{2}))?/);
  if (m) { const f = FR_M.find(([k]) => m[2].startsWith(k)); if (f) return utc(+m[3], f[1], +m[1], +m[4], +m[5], +(m[6] || 0)); }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const d = new Date(s); return isNaN(d) ? null : toISO(d);
}
function parseStravaCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, '')).filter(r => r.length > 3);
  if (rows.length < 2) return [];
  const head = rows[0].map(norm);
  const idx = re => head.findIndex(h => re.test(h));
  let iId = idx(/^(activity id|id de l.?activite|id d.?activite|id)$/);
  let iDate = idx(/^(activity date|date de l.?activite|date d.?activite|date)$/);
  let iName = idx(/^(activity name|nom de l.?activite|nom d.?activite|nom)$/);
  let iType = idx(/^(activity type|type d.?activite|type de l.?activite|type)$/);
  const iMov = idx(/^(moving time|temps de deplacement|duree de deplacement|temps en mouvement)$/);
  let iEl = idx(/^(elapsed time|temps ecoule|duree ecoulee|temps total)$/);
  let iDist = head.reduce((a, h, i) => (/^distance$/.test(h) && a.push(i), a), []);
  const iElev = idx(/^(elevation gain|denivele positif|gain d.?altitude|denivele)$/);
  if (iDate < 0 && head.length >= 7) { iId = 0; iDate = 1; iName = 2; iType = 3; if (iEl < 0) iEl = 5; if (!iDist.length) iDist = [6]; }
  if (iDate < 0) throw new Error("ce fichier ne ressemble pas au activities.csv de Strava");
  const out = [];
  rows.slice(1).forEach(r => {
    const date = parseStravaDate(r[iDate]); if (!date) return;
    let dist = iDist.length >= 2 ? parseNum(r[iDist[1]]) : null;
    if (!(dist > 0) && iDist.length) { const km = parseNum(r[iDist[0]]); if (km != null) dist = km * 1000; }
    const time = (iMov >= 0 ? parseNum(r[iMov]) : null) || (iEl >= 0 ? parseNum(r[iEl]) : null);
    const sid = iId >= 0 ? String(r[iId] || '').trim() : '';
    const name = (iName >= 0 && r[iName]) || 'Activité';
    out.push({
      id: 'strava-' + String(sid || (date + '-' + norm(name))).replace(/[^A-Za-z0-9_.~:@+-]/g, '-'),
      sid: sid || null, date, name, type: iType >= 0 ? String(r[iType] || '') : '', dist, time,
      elev: iElev >= 0 ? parseNum(r[iElev]) : null, src: 'strava',
    });
  });
  return out;
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.JSZip) return res();
    const el = document.createElement('script'); el.src = src; el.onload = () => res();
    el.onerror = () => rej(new Error("impossible d'ouvrir le .zip ici : décompresse l'archive et choisis directement activities.csv"));
    document.head.appendChild(el);
  });
}
async function importStrava(file) {
  if (Imp.busy) return;
  Imp.busy = true; Imp.msg = 'Lecture du fichier…'; render();
  try {
    let text;
    if (/\.zip$/i.test(file.name) || /zip/i.test(file.type)) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const zip = await window.JSZip.loadAsync(file);
      const entry = Object.values(zip.files).find(f => /(^|\/)activities\.csv$/i.test(f.name));
      if (!entry) throw new Error("l'archive ne contient pas de fichier activities.csv");
      text = await entry.async('string');
    } else text = await file.text();
    const acts = parseStravaCSV(text);
    if (!acts.length) throw new Error('aucune activité trouvée dans ce fichier');
    const items = { ...((Store.data.strava && Store.data.strava.items) || {}) };
    let added = 0;
    acts.forEach(a => {
      if (!items[a.id]) { added++; items[a.id] = a; return; }
      const merged = { ...items[a.id] }; Object.keys(a).forEach(k => { if (a[k] != null && a[k] !== '') merged[k] = a[k]; }); items[a.id] = merged;
    });
    const keys = Object.keys(items).sort((a, b) => items[a].date < items[b].date ? -1 : 1);
    let pruned = 0;
    while (keys.length && JSON.stringify(items).length > 230000) { delete items[keys.shift()]; pruned++; }
    await Store.putDoc('strava', { ...Store.data.strava, items, lastImport: Date.now() });
    Imp.msg = `${acts.length} activités lues, ${added} nouvelle${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}.` + (pruned ? ` Les ${pruned} plus anciennes ont été laissées de côté pour rester sous la taille maximale.` : '');
    toast(added ? `${added} activité${added > 1 ? 's' : ''} Strava ajoutée${added > 1 ? 's' : ''}.` : 'Déjà à jour : aucune nouvelle activité.');
  } catch (e) { Imp.msg = 'Import impossible : ' + ((e && e.message) || dbErr(e)) + '.'; }
  Imp.busy = false; render();
}

/* ---------- Vue : Semaine ---------- */
VIEWS.semaine = () => {
  const base = addDays(startOfWeek(new Date()), state.weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(base, i));
  const isos = days.map(toISO), t = todayISO();
  const ses = sessions(), rs = runs();
  const wkSes = ses.filter(s => s.date >= isos[0] && s.date <= isos[6]);
  const wkRuns = rs.filter(r => r.date >= isos[0] && r.date <= isos[6]);
  const km = wkRuns.reduce((a, r) => a + (r.dist || 0), 0) / 1000;
  const ton = wkSes.reduce((a, s) => a + sessionStats(s).ton, 0);
  const lastW = latestMeasures().poids;
  const label = state.weekOffset === 0 ? 'Cette semaine' : state.weekOffset === -1 ? 'Semaine dernière' : state.weekOffset === 1 ? 'Semaine prochaine' : `Semaine ${isoWeek(base)}`;
  const wChip = lastW ? weighChip(lastW.date) : '<span class="chip warn">! Aucune pesée</span>';

  const dayRows = days.map((d, i) => {
    const iso = isos[i], plan = PLAN[d.getDay()], tpl = plan.tpl && TPL[plan.tpl];
    const done = ses.filter(s => s.date === iso), dRuns = rs.filter(r => r.date === iso);
    const past = iso < t, isToday = iso === t;
    let items = '';
    if (done.length) {
      done.forEach(s => { const c = CATS[s.cat] || CATS.libre; items += `<li><i class="pip" style="--c:${c.c}"></i><b>${esc(s.title)}</b><span class="chip ok">✓ Fait</span></li><li class="sum">${esc(sessionSummary(s))}</li>`; });
    } else if (tpl) {
      const c = CATS[tpl.cat];
      const extra = tpl.id === 'sprint' ? '15 ou 30 min' : c.label;
      items += `<li><i class="pip" style="--c:${c.c}"></i><b>${esc(tpl.title)}</b><span class="muted">${esc(extra)}</span>${past ? '<span class="chip warn">! Pas notée</span>' : isToday ? '<span class="chip accent">Au programme</span>' : ''}</li>`;
    } else if (plan.rest) items += `<li><i class="pip" style="--c:var(--line)"></i><b>Repos</b></li>`;
    else if (plan.free && !dRuns.length) items += `<li><i class="pip" style="--c:var(--line)"></i><span class="muted">Libre</span></li>`;
    if (dRuns.length) dRuns.forEach(r => { items += `<li><i class="pip" style="--c:var(--plate-green)"></i><b>Course</b><span class="num">${fmt((r.dist || 0) / 1000, 1)} km · ${fPace(r.time, r.dist)}</span>${r.src === 'strava' ? '<span class="chip">Strava</span>' : ''}</li>`; });
    else if (plan.run) items += `<li><i class="pip" style="--c:var(--plate-green)"></i><span class="muted">Course prévue</span>${past ? '<span class="chip">Pas de course</span>' : ''}</li>`;
    const btn = done.length
      ? `<button class="btn small" data-action="edit-session" data-id="${esc(done[done.length - 1].id)}">Modifier</button>`
      : (tpl || plan.free) && iso <= t ? `<button class="btn small${isToday ? ' primary' : ''}" data-action="log" data-date="${iso}" data-tpl="${tpl ? tpl.id : 'libre'}">Noter</button>` : '';
    return `<article class="day${isToday ? ' is-today' : ''}"><div><div class="dname">${esc(DF.wd.format(d).replace('.', ''))}</div><div class="ddate">${esc(fDM(iso))}</div></div><ul>${items}</ul>${btn}</article>`;
  }).join('');

  const b = benchInfo(), goal = benchGoal(), best = b.bestLift ? b.bestLift.kg : 0;
  return `
  <section class="weekbar">
    <button class="btn icon" data-action="week" data-d="-1" aria-label="Semaine précédente">‹</button>
    <div class="mid"><h2>${esc(label)}</h2><small>Du ${esc(fDM(isos[0]))} au ${esc(fDM(isos[6]))}${state.weekOffset ? ' · <a href="#semaine" data-action="week-now">revenir à aujourd\'hui</a>' : ''}</small></div>
    <button class="btn icon" data-action="week" data-d="1" aria-label="Semaine suivante">›</button>
  </section>
  <section class="tiles" aria-label="Résumé de la semaine">
    <div class="tile"><span class="label">Séances muscu et sprint</span><span class="value num">${wkSes.length} / ${PLANNED_SESSIONS}</span><span class="sub">prévues : lun, mar, mer, ven</span></div>
    <div class="tile"><span class="label">Course</span><span class="value">${fmt(km, 1)} km</span><span class="sub">${wkRuns.length} sortie${wkRuns.length > 1 ? 's' : ''} sur ${PLANNED_RUNS} prévues</span></div>
    <div class="tile"><span class="label">Charge soulevée</span><span class="value">${fmt(ton, 0)} kg</span><span class="sub">séries × reps × kg</span></div>
    <div class="tile"><span class="label">Dernière pesée</span><span class="value">${lastW ? fmt(lastW.v, 1) + ' kg' : '–'}</span><span class="sub">${lastW ? esc(ago(lastW.date)) : ''} ${wChip}</span></div>
  </section>
  <section class="card goalrow">
    <div class="line"><b>Objectif bench : ${fmt(goal)} kg</b><span class="muted">${best ? `meilleure barre ${fmt(best)} kg · ${best >= goal ? 'objectif atteint' : 'encore ' + fmt(goal - best) + ' kg'}` : 'note ta première séance de développé couché'}</span></div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${best}" aria-label="Progression vers l'objectif bench"><span style="width:${Math.min(100, best / goal * 100)}%"></span></div>
  </section>
  <section class="days" aria-label="Jours de la semaine">${dayRows}</section>`;
};
function weighChip(date) {
  const n = daysBetween(date, todayISO());
  if (n <= 7) return '<span class="chip ok">✓ À jour</span>';
  if (n <= 14) return '<span class="chip warn">! Bientôt</span>';
  return '<span class="chip warn">! À refaire</span>';
}

/* ---------- Vue : Séance ---------- */
VIEWS.seance = () => {
  const d = ensureDraft();
  const tplChips = TEMPLATES.map(t => `<button class="tpl" data-action="pick-tpl" data-tpl="${t.id}" aria-pressed="${d.tpl === t.id}"><i class="pip" style="--c:${CATS[t.cat].c}"></i>${t.day ? esc(t.day) + ' · ' : ''}${esc(t.title)}${t.note ? ' <span class="muted">' + esc(t.note) + '</span>' : ''}</button>`).join('');
  const exHtml = d.exercises.map((e, i) => {
    const k = KINDS[e.kind] || KINDS.charge;
    const lp = lastPerf(e.name, d.date, d.id);
    const lastLine = lp
      ? `<p class="last"><span>Dernière fois (${esc(fWDM(lp.date))}) : <span class="num">${esc(lp.sets.map(s => fmtSet(lp.kind, s)).join(' · '))}</span></span><button class="btn small ghost" data-action="copy-last" data-i="${i}">Reprendre</button></p>`
      : `<p class="last">Première fois pour cet exercice.</p>`;
    const rows = e.sets.map((s, j) => {
      const ph = lp ? (lp.sets[j] || lp.sets[lp.sets.length - 1]) : null;
      const inputs = k.fields.map(([f, u, mode], fi) => `${fi && k.sep ? `<span class="sep">${k.sep}</span>` : ''}<input id="s-${i}-${j}-${f}" data-ex="${i}" data-set="${j}" data-f="${f}" inputmode="${mode}" autocomplete="off" value="${esc(s[f])}" placeholder="${ph && ph[f] != null ? esc(fmt(ph[f], 2)) : ''}" aria-label="Série ${j + 1}, ${esc(u)}"><span class="u">${esc(u)}</span>`).join('');
      return `<div class="set"><span class="n">${j + 1}</span>${inputs}<button class="btn icon ghost" data-action="del-set" data-i="${i}" data-j="${j}" aria-label="Supprimer la série ${j + 1}">−</button></div>`;
    }).join('');
    return `<div class="ex">
      <div class="ex-head">
        <input class="ex-name" id="ex-${i}-name" data-ex-name="${i}" value="${esc(e.name)}" placeholder="Nom de l'exercice" aria-label="Nom de l'exercice">
        <select id="ex-${i}-kind" data-ex-kind="${i}" aria-label="Type d'exercice">${Object.entries(KINDS).map(([kk, v]) => `<option value="${kk}"${kk === e.kind ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
        <button class="btn icon ghost" data-action="del-ex" data-i="${i}" data-confirm aria-label="Supprimer l'exercice">×</button>
      </div>
      ${lastLine}
      <div class="sets">${rows}</div>
      <div><button class="btn small ghost" data-action="add-set" data-i="${i}">+ Série</button></div>
    </div>`;
  }).join('');

  const list = sessions().reverse().slice(0, 30);
  const hist = list.length ? list.map(s => { const c = CATS[s.cat] || CATS.libre; return `<div class="hrow"><div><div class="t"><i class="pip" style="--c:${c.c}"></i>${esc(s.title)} <span class="muted" style="font-weight:500">${esc(fWDM(s.date))}</span></div><div class="s">${esc(sessionSummary(s))}</div></div><div class="actions"><button class="btn small" data-action="edit-session" data-id="${esc(s.id)}">Modifier</button><button class="btn small ghost" data-action="del-session" data-id="${esc(s.id)}" data-confirm>Supprimer</button></div></div>`; }).join('')
    : `<p class="empty">${Store.loaded ? 'Aucune séance enregistrée pour le moment.' : 'Chargement de tes séances…'}</p>`;

  return `
  <section class="card" id="seance-form">
    <div class="card-head"><h2>${d.id ? 'Modifier la séance' : 'Noter une séance'}</h2>
      <label class="f" style="grid-auto-flow:column;align-items:center;gap:8px">Date <input type="date" id="f-date" data-draft="date" value="${esc(d.date)}"></label></div>
    <div class="tpls" role="group" aria-label="Type de séance">${tplChips}</div>
    ${exHtml || '<p class="empty">Ajoute ton premier exercice.</p>'}
    <div><button class="btn" data-action="add-ex">+ Ajouter un exercice</button></div>
    <label class="f">Notes (sensations, douleurs, matériel)<textarea id="f-notes" data-draft="notes">${esc(d.notes)}</textarea></label>
    <div class="actions"><button class="btn primary" data-action="save-session">Enregistrer la séance</button>
      ${d.id ? '<button class="btn" data-action="cancel-edit">Annuler la modification</button>' : '<button class="btn ghost" data-action="reset-draft" data-confirm>Vider le formulaire</button>'}</div>
  </section>
  <section class="card"><h2>Historique</h2><div class="hist">${hist}</div></section>`;
};

/* ---------- Vue : Progrès ---------- */
VIEWS.progres = () => {
  const b = benchInfo(), goal = benchGoal();
  const best = b.bestLift ? b.bestLift.kg : 0;
  const idx = exerciseIndex();
  const items = [...idx.values()].filter(it => it.pts.length);
  if (!state.progEx || !idx.has(state.progEx)) state.progEx = (items.find(it => isBench(it.name)) || items[0] || {}).key || null;
  const cur = state.progEx && idx.get(state.progEx);
  let chart = '<p class="empty">Note quelques séances : la courbe de chaque exercice apparaîtra ici.</p>';
  if (cur) {
    const unit = cur.kind === 'charge' ? 'kg' : cur.kind === 'pdc' ? 'reps' : 's';
    const desc = cur.kind === 'charge' ? '1RM estimé par séance (formule d\'Epley)' : cur.kind === 'pdc' ? 'Meilleure série (répétitions)' : 'Meilleur temps (plus bas = mieux)';
    const data = cur.pts.map(p => ({ d: p.d, y: p.y, label: cur.kind === 'charge' ? `${fmt(p.y)} kg (${fmt(p.kg)} × ${fmt(p.reps, 0)})` : `${fmt(p.y, 2)} ${unit}` }));
    chart = `<p class="muted">${esc(desc)}</p>` + (data.length >= 2 ? chartSlot({ type: 'line', data, unit, digits: cur.kind === 'sprint' ? 2 : 1, aria: `${cur.name} : ${desc}` }) : `<p class="empty">Une seule séance pour l'instant (${esc(data[0].label)}). La courbe démarre à la deuxième.</p>`);
  }
  const options = items.map(it => `<option value="${esc(it.key)}"${it.key === state.progEx ? ' selected' : ''}>${esc(it.name)}</option>`).join('');
  const recs = items.map(it => {
    let rec = '', date = '';
    if (it.kind === 'charge') { const m = it.pts.reduce((a, p) => p.y > a.y ? p : a); rec = `${fmt(m.kg)} kg × ${fmt(m.reps, 0)} → 1RM ≈ ${fmt(m.y)} kg`; date = m.d; }
    else if (it.kind === 'pdc') { const m = it.pts.reduce((a, p) => p.y > a.y ? p : a); rec = `${fmt(m.y, 0)} reps`; date = m.d; }
    else { const m = it.pts.reduce((a, p) => p.y < a.y ? p : a); rec = `${fmt(m.y, 2)} s`; date = m.d; }
    return `<tr><td>${esc(it.name)}</td><td>${esc(rec)}</td><td class="r">${esc(fDM(date))}</td></tr>`;
  }).join('');
  // charge soulevée par semaine (8 semaines)
  const w0 = startOfWeek(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(w0, (i - 7) * 7));
  const ses = sessions();
  const ton = weeks.map(w => { const a = toISO(w), z = toISO(addDays(w, 6)); return { x: DF.dd.format(w), title: `Semaine du ${fDM(a)}`, y: ses.filter(s => s.date >= a && s.date <= z).reduce((t, s) => t + sessionStats(s).ton, 0) }; });

  return `
  <section class="card bench">
    <div class="card-head"><h2>Objectif bench</h2>
      <label class="inline-goal" for="goal-input">Objectif <input id="goal-input" inputmode="decimal" value="${esc(fmt(goal, 2))}" data-goal> kg</label></div>
    <div class="bench-figs">
      <div><span class="muted">Meilleure barre</span><b>${best ? fmt(best) + ' kg' : '–'}</b><span class="muted">${b.bestLift ? `× ${fmt(b.bestLift.reps, 0)} · ${esc(fDM(b.bestLift.date))}` : 'pas encore notée'}</span></div>
      <div><span class="muted">1RM estimé</span><b>${b.bestE1 ? fmt(b.bestE1.v) + ' kg' : '–'}</b><span class="muted">${b.bestE1 ? `d'après ${fmt(b.bestE1.kg)} × ${fmt(b.bestE1.reps, 0)}` : 'Epley : kg × (1 + reps/30)'}</span></div>
      <div><span class="muted">Reste à gagner</span><b>${best ? (best >= goal ? 'Atteint' : fmt(goal - best) + ' kg') : fmt(goal) + ' kg'}</b><span class="muted">sur la barre</span></div>
    </div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${best}" aria-label="Progression vers l'objectif"><span style="width:${Math.min(100, best / goal * 100)}%"></span></div>
    <div class="bars">
      <div class="barbell"><div class="cap"><span><b>${best ? fmt(best) : 20} kg</b> · aujourd'hui</span><span class="muted">${esc(platesText(best || 20))}</span></div>${barbellSVG(best || 20)}</div>
      <div class="barbell"><div class="cap"><span><b>${fmt(goal)} kg</b> · objectif</span><span class="muted">${esc(platesText(goal))}</span></div>${barbellSVG(goal)}</div>
    </div>
  </section>
  <section class="card">
    <div class="card-head"><h2>Courbe par exercice</h2>${options ? `<select id="prog-ex" data-prog aria-label="Choisir un exercice">${options}</select>` : ''}</div>
    ${chart}
  </section>
  <section class="card"><h2>Charge soulevée par semaine</h2><p class="muted">Total séries × reps × kg, 8 dernières semaines</p>
    ${ton.some(w => w.y > 0) ? chartSlot({ type: 'bar', data: ton, unit: 'kg', h: 180, aria: 'Charge soulevée par semaine' }) : '<p class="empty">Rien à afficher pour l\'instant.</p>'}</section>
  <section class="card"><h2>Records</h2>${recs ? `<div class="table-wrap"><table><thead><tr><th>Exercice</th><th>Record</th><th class="r">Date</th></tr></thead><tbody>${recs}</tbody></table></div>` : '<p class="empty">Tes records apparaîtront ici dès ta première séance notée.</p>'}</section>`;
};

/* ---------- Vue : Course ---------- */
VIEWS.course = () => {
  const acts = activities(), rs = acts.filter(a => isRun(a.type)), t = todayISO();
  const w0 = startOfWeek(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(w0, (i - 7) * 7));
  const km = weeks.map(w => { const a = toISO(w), z = toISO(addDays(w, 6)); const list = rs.filter(r => r.date >= a && r.date <= z); return { x: DF.dd.format(w), title: `Semaine du ${fDM(a)} · ${list.length} sortie${list.length > 1 ? 's' : ''}`, y: list.reduce((s, r) => s + (r.dist || 0), 0) / 1000 }; });
  const thisWeek = km[7];
  const last28 = rs.filter(r => daysBetween(r.date, t) < 28);
  const km28 = last28.reduce((s, r) => s + (r.dist || 0), 0) / 1000;
  const paced = last28.filter(r => r.dist > 0 && r.time > 0);
  const avgPace = paced.length ? fPace(paced.reduce((s, r) => s + r.time, 0), paced.reduce((s, r) => s + r.dist, 0)) : '–';
  const longest = last28.reduce((m, r) => (r.dist || 0) > (m ? m.dist || 0 : 0) ? r : m, null);
  const sData = Store.data.strava || {};
  const lastSync = sData.lastSync ? new Date(sData.lastSync) : null;

  const nSt = Object.keys(sData.items || {}).length;
  const lastImport = sData.lastImport ? new Date(sData.lastImport) : null;
  const stamp = d => esc(DF.dm.format(d)) + ' à ' + pad(d.getHours()) + 'h' + pad(d.getMinutes());
  const rows = acts.slice(0, 40).map(a => `<tr><td>${esc(fWDM(a.date))}</td><td>${esc(a.name || 'Course')}${a.src === 'manuel' ? ' <span class="chip">à la main</span>' : ''}</td><td>${esc(typeLabel(a.type))}</td><td class="r">${a.dist ? fmt(a.dist / 1000, 2) + ' km' : '–'}</td><td class="r">${fDur(a.time)}</td><td class="r">${isRun(a.type) ? fPace(a.time, a.dist) : '–'}</td><td class="r">${a.src === 'manuel' ? `<button class="btn small ghost" data-action="del-run" data-id="${esc(a.id)}" data-confirm>Supprimer</button>` : ''}</td></tr>`).join('');

  return `
  <section class="card">
    <div class="card-head"><h2>Strava</h2>${nSt ? `<span class="chip ok">✓ ${nSt} activité${nSt > 1 ? 's' : ''}</span>` : '<span class="chip">Rien d\'importé</span>'}</div>
    <p>${nSt ? `${nSt} activité${nSt > 1 ? 's' : ''} Strava dans ton carnet${lastImport ? ' · dernier import le ' + stamp(lastImport) : ''}.` : 'Récupère gratuitement toutes tes courses Strava grâce à l\'export de ton compte.'}</p>
    <h3>Import gratuit</h3>
    <ol class="steps">
      <li>Sur strava.com : photo de profil → <b>Paramètres</b> → <b>Mon compte</b> → <b>Télécharger ou supprimer votre compte</b> → <b>Demander votre archive</b>.</li>
      <li>Strava t'envoie un e-mail avec un fichier .zip (ça peut prendre quelques heures).</li>
      <li>Choisis ce .zip ici, ou le fichier <b>activities.csv</b> qu'il contient. Les activités déjà présentes ne sont pas dupliquées.</li>
    </ol>
    <label class="f" for="strava-file">Fichier d'export Strava (.zip ou activities.csv)<input type="file" id="strava-file" accept=".zip,.csv,text/csv,application/zip" data-import${Imp.busy ? ' disabled' : ''}></label>
    ${Imp.msg ? `<p class="strava-msg">${esc(Imp.msg)}</p>` : ''}
    <p class="muted" style="font-size:14px">La synchro automatique avec Strava est réservée aux abonnés Strava. Entre deux imports, ajoute tes nouvelles courses à la main en bas de page : au prochain import, une course notée à la main le même jour avec la même distance est remplacée par celle de Strava.</p>
  </section>
  <section class="tiles">
    <div class="tile"><span class="label">Cette semaine</span><span class="value">${fmt(thisWeek.y, 1)} km</span><span class="sub">${esc(thisWeek.title.split(' · ')[1])} · objectif ${PLANNED_RUNS}</span></div>
    <div class="tile"><span class="label">28 derniers jours</span><span class="value">${fmt(km28, 1)} km</span><span class="sub">${last28.length} sortie${last28.length > 1 ? 's' : ''}</span></div>
    <div class="tile"><span class="label">Allure moyenne (28 j)</span><span class="value num">${avgPace.replace('/km', '')}</span><span class="sub">par km</span></div>
    <div class="tile"><span class="label">Plus longue (28 j)</span><span class="value">${longest ? fmt(longest.dist / 1000, 1) + ' km' : '–'}</span><span class="sub">${longest ? esc(fDM(longest.date)) : ''}</span></div>
  </section>
  <section class="card"><h2>Kilomètres par semaine</h2>
    ${km.some(w => w.y > 0) ? chartSlot({ type: 'bar', data: km, unit: 'km', digits: 1, h: 180, aria: 'Kilomètres de course par semaine' }) : '<p class="empty">Aucune course sur les 8 dernières semaines pour l\'instant.</p>'}</section>
  <section class="card"><h2>Activités</h2>
    ${rows ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Nom</th><th>Type</th><th class="r">Distance</th><th class="r">Durée</th><th class="r">Allure</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">${Store.loaded ? 'Aucune activité pour le moment.' : 'Chargement…'}</p>`}
  </section>
  <section class="card" id="run-form"><h2>Ajouter une course à la main</h2>
    <div class="fgrid">
      <label class="f">Date<input type="date" id="r-date" value="${t}"></label>
      <label class="f">Distance (km)<input id="r-km" inputmode="decimal" placeholder="8,5"></label>
      <label class="f">Durée (min ou h:mm:ss)<input id="r-dur" inputmode="decimal" placeholder="45:30"></label>
      <label class="f">Nom<input id="r-name" placeholder="Footing"></label>
    </div>
    <div class="actions"><button class="btn" data-action="add-run">Ajouter la course</button></div>
  </section>`;
};

/* ---------- Vue : Mensurations ---------- */
VIEWS.mesures = () => {
  const lm = latestMeasures(), list = measures();
  const w = lm.poids, t = todayISO();
  const wList = list.filter(m => m.poids != null).map(m => ({ d: m.date, y: m.poids }));
  const cells = MFIELDS.map(([k, label, unit]) => {
    const x = lm[k];
    const delta = x && x.delta != null && x.delta !== 0 ? ` · ${x.delta > 0 ? '+' : '−'}${fmt(Math.abs(x.delta), 1)} ${unit}` : '';
    return `<div class="mcell"><span class="k">${esc(label)}</span><span class="v">${x ? fmt(x.v, 1) + ' ' + unit : '–'}</span><span class="d">${x ? esc(fDM(x.date)) + esc(delta) : 'jamais mesuré'}</span></div>`;
  }).join('');
  const rows = list.slice().reverse().map(m => `<tr><td>${esc(fDM(m.date))} ${esc(String(fromISO(m.date).getFullYear()))}</td>${MFIELDS.map(([k]) => `<td class="r">${m[k] != null ? fmt(m[k], 1) : ''}</td>`).join('')}<td class="r"><button class="btn small ghost" data-action="del-measure" data-id="${esc(m.id)}" data-confirm>Supprimer</button></td></tr>`).join('');
  return `
  <section class="card">
    <h2>Dernière pesée</h2>
    ${w ? `<div class="weigh"><span class="big">${fmt(w.v, 1)}<small>kg</small></span><span>${esc(fWDM(w.date))} · <b>${esc(ago(w.date))}</b></span>${weighChip(w.date)}</div>
      <p class="muted">${w.delta != null ? `Par rapport à la pesée d'avant : ${w.delta > 0 ? '+' : w.delta < 0 ? '−' : ''}${fmt(Math.abs(w.delta), 1)} kg.` : ''} Repère-toi : pèse-toi le matin à jeun, au moins une fois par semaine.</p>`
      : `<p class="empty">${Store.loaded ? 'Aucune pesée enregistrée. Remplis le formulaire ci-dessous.' : 'Chargement…'}</p>`}
  </section>
  <section class="card" id="measure-form">
    <h2>Nouvelle prise de mesures</h2>
    <p class="muted">Remplis seulement ce que tu as mesuré. Tours en cm, mètre ruban à plat, muscle relâché sauf le bras.</p>
    <div class="fgrid">
      <label class="f">Date<input type="date" id="m-date" value="${t}"></label>
      ${MFIELDS.map(([k, label, unit]) => `<label class="f">${esc(label)} (${unit})<input id="m-${k}" inputmode="decimal" placeholder="${lm[k] ? esc(fmt(lm[k].v, 1)) : ''}"></label>`).join('')}
    </div>
    <div class="actions"><button class="btn primary" data-action="save-measure">Enregistrer les mesures</button></div>
  </section>
  <section class="card"><h2>Dernières valeurs</h2><div class="mgrid">${cells}</div></section>
  <section class="card"><h2>Poids</h2>${wList.length >= 2 ? chartSlot({ type: 'line', data: wList, unit: 'kg', digits: 1, aria: 'Évolution du poids' }) : '<p class="empty">La courbe apparaît à partir de deux pesées.</p>'}</section>
  <section class="card"><h2>Historique</h2>${rows ? `<div class="table-wrap"><table><thead><tr><th>Date</th>${MFIELDS.map(([, l, u]) => `<th class="r">${esc(l)} (${u})</th>`).join('')}<th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">Rien pour le moment.</p>'}</section>`;
};

/* ---------- Vue : Réglages ---------- */
VIEWS.reglages = () => {
  const c = cfg(), n = Store.pending.length;
  const last = Store.lastSync ? new Date(Store.lastSync) : null;
  return `
  <section class="card">
    <h2>Connexion à tes données</h2>
    <p>Tes séances, mesures et courses sont enregistrées dans le fichier <b>${esc(c.path)}</b> de ton dépôt privé <b>${esc(c.owner)}/${esc(c.repo)}</b>. Le site y accède avec un jeton GitHub, gardé uniquement sur cet appareil.</p>
    <div class="fgrid">
      <label class="f">Compte GitHub<input id="g-owner" value="${esc(c.owner)}" autocomplete="off" spellcheck="false"></label>
      <label class="f">Dépôt des données<input id="g-repo" value="${esc(c.repo)}" autocomplete="off" spellcheck="false"></label>
    </div>
    <label class="f">Jeton GitHub ${c.token ? '(déjà enregistré sur cet appareil)' : ''}<input id="g-token" type="password" autocomplete="off" spellcheck="false" placeholder="${c.token ? '•••••••• laisse vide pour garder le jeton actuel' : 'github_pat_…'}"></label>
    <div class="actions"><button class="btn primary" data-action="save-token">Enregistrer et tester</button>${c.token ? '<button class="btn ghost" data-action="forget-token" data-confirm>Oublier le jeton sur cet appareil</button>' : ''}</div>
    ${Store.error ? `<p class="strava-msg">${esc(Store.error)}</p>` : ''}
  </section>
  <section class="card">
    <h3>Créer ton jeton (une seule fois)</h3>
    <ol class="steps">
      <li>Sur github.com : ta photo en haut à droite → <b>Settings</b> → tout en bas <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
      <li><b>Token name</b> : <code>carnet</code>. <b>Expiration</b> : la durée la plus longue proposée.</li>
      <li><b>Repository access</b> : <b>Only select repositories</b> → choisis <b>carnet-data</b>.</li>
      <li><b>Permissions</b> → <b>Repository permissions</b> → <b>Contents</b> : <b>Read and write</b>.</li>
      <li><b>Generate token</b>, copie le jeton (il commence par <code>github_pat_</code>) et colle-le au-dessus. Fais pareil sur ton téléphone et sur ton PC.</li>
    </ol>
    <p class="muted" style="font-size:14px">Ne mets jamais ce jeton dans le code ni dans un message : avec lui, on peut modifier ton dépôt carnet-data.</p>
  </section>
  <section class="card">
    <h3>Synchronisation</h3>
    <p>${last ? 'Dernière synchro : ' + esc(DF.wdm.format(last)) + ' à ' + pad(last.getHours()) + 'h' + pad(last.getMinutes()) + '.' : 'Pas encore synchronisé.'} ${n ? `<b>${n} modification${n > 1 ? 's' : ''} en attente d'envoi.</b>` : ''}</p>
    <div class="actions"><button class="btn" data-action="sync-now"${Store.syncing || !c.token ? ' disabled' : ''}>${Store.syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}</button><button class="btn ghost" data-action="download-backup">Télécharger une copie de mes données</button></div>
  </section>`;
};

/* ---------- Rendu ---------- */
const view = $('#view');
function storeStatus() {
  const el = $('#store-status'); let cls = '', txt = '';
  const n = Store.pending.length;
  if (Store.mode === 'notoken') { cls = 'warn'; txt = n ? `${n} modif sur cet appareil · relie GitHub` : 'Relie tes données GitHub'; }
  else if (Store.syncing) txt = n ? 'Envoi vers GitHub…' : 'Synchronisation…';
  else if (Store.mode === 'loading') txt = 'Chargement…';
  else if (Store.mode === 'offline') { cls = 'warn'; txt = n ? `Hors ligne · ${n} modif en attente` : 'Hors ligne · données de cet appareil'; }
  else if (Store.mode === 'error') { cls = 'warn'; txt = 'Souci de synchro, voir réglages'; }
  else { cls = 'ok'; txt = n ? `${n} modif en attente` : 'Synchronisé avec GitHub'; }
  el.className = 'status ' + cls; el.innerHTML = `<span class="dot"></span><span>${esc(txt)}</span><span class="gear">· Réglages</span>`;
}
function render() {
  pendingRender = false;
  charts.length = 0;
  const banner = Store.mode === 'notoken' && state.tab !== 'reglages'
    ? `<section class="card banner"><b>Dernière étape : relier le site à ton dépôt carnet-data.</b><p>Tant que ce n'est pas fait, ce que tu notes reste seulement sur cet appareil.</p><div><a class="btn primary" href="#reglages">Ouvrir les réglages</a></div></section>` : '';
  view.innerHTML = banner + VIEWS[state.tab]();
  document.querySelectorAll('.tabs a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href').slice(1) === state.tab ? 'page' : 'false'));
  storeStatus();
  drawCharts();
}
const TABS = ['semaine', 'seance', 'progres', 'course', 'mesures', 'reglages'];
function route() {
  const h = location.hash.slice(1);
  const tab = TABS.includes(h) ? h : 'semaine';
  if (tab !== state.tab) { state.tab = tab; render(); window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', route);
const go = tab => { if (location.hash !== '#' + tab) location.hash = tab; else { state.tab = tab; render(); } };

let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800); }

/* ---------- Actions ---------- */
function arm(b, text) {
  b.classList.add('armed'); b.dataset.orig = b.innerHTML; b.textContent = text || 'Confirmer ?';
  setTimeout(() => { if (b.isConnected && b.classList.contains('armed')) { b.classList.remove('armed'); b.innerHTML = b.dataset.orig; } }, 3000);
}
const actions = {
  'week': b => { state.weekOffset += +b.dataset.d; render(); },
  'week-now': (b, e) => { e.preventDefault(); state.weekOffset = 0; render(); },
  'log': b => {
    const date = b.dataset.date, tpl = b.dataset.tpl;
    if (draftDirty() && state.draft && !state.draft.id && (state.draft.date !== date || state.draft.tpl !== tpl)) toast('Tu as une séance en cours : elle est gardée. Vide le formulaire pour en commencer une autre.');
    else if (!state.draft || state.draft.id || !draftDirty()) { state.draft = newDraft(date, tpl); saveDraft(); }
    go('seance');
  },
  'pick-tpl': b => {
    if (draftDirty() && !b.classList.contains('armed')) { arm(b, 'Remplacer la séance en cours ?'); return; }
    const d = state.draft; state.draft = { ...newDraft(d.date, b.dataset.tpl), id: d.id }; saveDraft(); render();
  },
  'add-set': b => { const e = state.draft.exercises[+b.dataset.i]; const prev = e.sets[e.sets.length - 1]; e.sets.push(prev ? { ...prev } : { kg: '', reps: '', time: '' }); saveDraft(); render(); const j = e.sets.length - 1; const f = KINDS[e.kind].fields[0][0]; const el = $(`#s-${b.dataset.i}-${j}-${f}`); if (el) el.focus(); },
  'del-set': b => { const e = state.draft.exercises[+b.dataset.i]; e.sets.splice(+b.dataset.j, 1); saveDraft(); render(); },
  'del-ex': b => { state.draft.exercises.splice(+b.dataset.i, 1); saveDraft(); render(); },
  'add-ex': () => { state.draft.exercises.push({ name: '', kind: 'charge', sets: [{ kg: '', reps: '', time: '' }, { kg: '', reps: '', time: '' }, { kg: '', reps: '', time: '' }] }); saveDraft(); render(); const el = $(`#ex-${state.draft.exercises.length - 1}-name`); if (el) el.focus(); },
  'copy-last': b => {
    const e = state.draft.exercises[+b.dataset.i], lp = lastPerf(e.name, state.draft.date, state.draft.id); if (!lp) return;
    e.kind = lp.kind; e.sets = lp.sets.map(s => ({ kg: s.kg != null ? String(s.kg) : '', reps: s.reps != null ? String(s.reps) : '', time: s.time != null ? String(s.time) : '' }));
    saveDraft(); render();
  },
  'reset-draft': () => { const d = state.draft; state.draft = newDraft(d.date, d.tpl); saveDraft(); render(); },
  'cancel-edit': () => { state.draft = null; lsSet(LS_DRAFT, null); render(); },
  'edit-session': b => { const s = Store.data.seances[b.dataset.id]; if (!s) return; state.draft = draftFromSession(s); saveDraft(); go('seance'); },
  'save-session': async b => {
    const d = state.draft;
    if (!d.date) { toast('Choisis une date.'); return; }
    const exercises = d.exercises.map(e => {
      const sets = e.sets.map(s => {
        const kg = parseNum(s.kg), reps = parseNum(s.reps), time = parseNum(s.time);
        if (e.kind === 'charge') return reps > 0 && kg != null ? { kg, reps } : null;
        if (e.kind === 'pdc') return reps > 0 ? { reps, kg: kg || 0 } : null;
        return { time: time > 0 ? time : null };
      }).filter(Boolean);
      return { name: e.name.trim(), kind: e.kind, sets };
    }).filter(e => e.name && e.sets.length);
    if (!exercises.length) { toast('Remplis au moins une série (kg et reps).'); return; }
    const tpl = TPL[d.tpl] || TPL.libre;
    const id = d.id || uid('s');
    const body = { date: d.date, tpl: tpl.id, title: tpl.title, cat: tpl.cat, exercises, notes: d.notes.trim(), savedAt: Date.now() };
    b.disabled = true;
    try {
      await Store.put('seances', id, body);
      state.draft = null; lsSet(LS_DRAFT, null);
      toast(d.id ? 'Séance modifiée.' : 'Séance enregistrée. Bien joué !');
      go('semaine');
    } catch (e) { b.disabled = false; toast('Pas enregistré : ' + dbErr(e)); }
  },
  'del-session': async b => { try { await Store.remove('seances', b.dataset.id); if (state.draft && state.draft.id === b.dataset.id) state.draft = null; toast('Séance supprimée.'); } catch (e) { toast('Suppression impossible : ' + dbErr(e)); } },
  'save-token': async b => {
    const owner = $('#g-owner').value.trim(), repo = $('#g-repo').value.trim(), typed = $('#g-token').value.trim();
    const prev = cfg(), token = typed || prev.token;
    if (!owner || !repo) { toast('Indique le compte et le dépôt.'); return; }
    if (!token) { toast('Colle ton jeton GitHub.'); return; }
    b.disabled = true; b.textContent = 'Test en cours…';
    try {
      const r = await gh(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {}, token);
      if (!r.ok) throw await httpErr(r);
      lsSet(LS_CFG, { owner, repo, path: prev.path, token });
      if (prev.owner !== owner || prev.repo !== repo) { Store.remote = EMPTY(); Store.sha = null; Store.rebuild(); }
      Store.error = ''; Store.mode = 'loading'; toast('Connexion réussie !');
      await Store.pull();
    } catch (e) { Store.error = syncErrText(e); toast('Connexion impossible.'); render(); }
  },
  'forget-token': () => { lsSet(LS_CFG, { ...cfg(), token: '' }); Store.mode = 'notoken'; Store.error = ''; toast('Jeton oublié sur cet appareil.'); render(); },
  'sync-now': () => { if (Store.pending.length) Store.flush(); else Store.pull(); },
  'download-backup': () => {
    const blob = new Blob([JSON.stringify(Store.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `carnet-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
  'add-run': async b => {
    const date = $('#r-date').value, km = parseNum($('#r-km').value), time = parseDur($('#r-dur').value), name = $('#r-name').value.trim() || 'Course';
    if (!date || !(km > 0)) { toast('Indique au moins la date et la distance.'); return; }
    b.disabled = true;
    try { await Store.put('courses', uid('c'), { date, name, type: 'Run', dist: km * 1000, time: time || null, savedAt: Date.now() }); toast('Course ajoutée.'); render(); }
    catch (e) { b.disabled = false; toast('Pas enregistré : ' + dbErr(e)); }
  },
  'del-run': async b => { try { await Store.remove('courses', b.dataset.id); toast('Course supprimée.'); } catch (e) { toast('Suppression impossible : ' + dbErr(e)); } },
  'save-measure': async b => {
    const date = $('#m-date').value; if (!date) { toast('Choisis une date.'); return; }
    const body = { date, savedAt: Date.now() }; let n = 0;
    MFIELDS.forEach(([k]) => { const v = parseNum($('#m-' + k).value); if (v != null && v > 0) { body[k] = v; n++; } });
    if (!n) { toast('Remplis au moins une mesure.'); return; }
    b.disabled = true;
    try { await Store.put('mesures', uid('m'), body); toast(body.poids ? `Pesée enregistrée : ${fmt(body.poids, 1)} kg.` : 'Mesures enregistrées.'); render(); }
    catch (e) { b.disabled = false; toast('Pas enregistré : ' + dbErr(e)); }
  },
  'del-measure': async b => { try { await Store.remove('mesures', b.dataset.id); toast('Mesure supprimée.'); } catch (e) { toast('Suppression impossible : ' + dbErr(e)); } },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  if (b.hasAttribute('data-confirm') && !b.classList.contains('armed')) { e.preventDefault(); arm(b); return; }
  const fn = actions[b.dataset.action]; if (fn) fn(b, e);
});
document.addEventListener('input', e => {
  const t = e.target, d = state.draft;
  if (t.dataset.f != null && d) { const s = d.exercises[+t.dataset.ex] && d.exercises[+t.dataset.ex].sets[+t.dataset.set]; if (s) { s[t.dataset.f] = t.value; saveDraft(); } }
  else if (t.dataset.exName != null && d) { d.exercises[+t.dataset.exName].name = t.value; saveDraft(); }
  else if (t.dataset.draft === 'notes' && d) { d.notes = t.value; saveDraft(); }
});
document.addEventListener('change', async e => {
  const t = e.target, d = state.draft;
  if (t.dataset.draft === 'date' && d) { d.date = t.value || todayISO(); saveDraft(); render(); }
  else if (t.dataset.exKind != null && d) { d.exercises[+t.dataset.exKind].kind = t.value; saveDraft(); render(); }
  else if (t.hasAttribute('data-prog')) { state.progEx = t.value; render(); }
  else if (t.hasAttribute('data-import') && t.files && t.files[0]) { importStrava(t.files[0]); }
  else if (t.hasAttribute('data-goal')) {
    const v = parseNum(t.value);
    if (!(v > 20 && v < 500)) { toast('Objectif entre 20 et 500 kg.'); render(); return; }
    try { await Store.putDoc('config', { ...Store.data.config, benchGoal: v }); toast(`Nouvel objectif : ${fmt(v)} kg.`); render(); } catch (err) { toast('Pas enregistré : ' + dbErr(err)); }
  }
});
document.addEventListener('focusout', () => { setTimeout(() => { if (pendingRender) requestRender(); }, 450); });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.set input')) {
    e.preventDefault();
    const ins = [...document.querySelectorAll('#seance-form .set input')]; const i = ins.indexOf(e.target);
    if (ins[i + 1]) ins[i + 1].focus(); else e.target.blur();
  }
});

/* ---------- Démarrage ---------- */
function start() {
  state.draft = lsGet(LS_DRAFT) || null;
  const h = location.hash.slice(1); state.tab = TABS.includes(h) ? h : 'semaine';
  Store.init();
  render();
}
start();
})();
