/* ══════════════════════════════════════════════════════════════
   NOVA OS — app.js v7.1 (clean rebuild, no runtime HTML injection)
   StateManager · SyncManager · ViewRouter · TaskController
   CalendarController (with drag & drop) · RoutineManager
   TimerController · StoreController · MacroController (Project→Sprint)
   ProfileRenderer · VoiceInput · NLP · Demo · Vercel KV 2-Way Sync
   ══════════════════════════════════════════════════════════════ */

// ── SAFE BOOT GUARD ───────────────────────────────────────────────────────
// Если прошлый запуск упал до DOMContentLoaded или в течение первых 4 сек
// (nova-boot не удалился), включаем lite-режим: никаких тяжёлых эффектов,
// никакой загрузки из облака. Пользователь видит рабочее UI без рисков OOM.
(function() {
  if (localStorage.getItem('nova-boot')) {
    document.documentElement.classList.add('lite');
    console.warn('[Nova OS] Safe/lite mode activated (previous crash detected)');
  } else {
    localStorage.setItem('nova-boot', String(Date.now()));
  }
})();

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
// Only 'business' and 'health' (labelled "Sport" in the UI) earn crystals.
// Everything else (life/study/creative) is crystal-free by design.
const CATS = {
  business: { label: 'Business', color: '#FF3B30', emoji: '💼', earnsGems: true },
  health:   { label: 'Sport',    color: '#FF9500', emoji: '💪', earnsGems: true },
  study:    { label: 'School',   color: '#5E5CE6', emoji: '📚', earnsGems: false },
  life:     { label: 'Life',     color: '#8E8E93', emoji: '🌱', earnsGems: false },
  creative: { label: 'Life',     color: '#8E8E93', emoji: '🎨', earnsGems: false },
};
const CAT_ORDER = ['business', 'health', 'study', 'life'];
const COLOR_PALETTE = [
  '#FF3B30','#FF6961','#FF9500','#FFCC00','#34C759','#30D158',
  '#00B4D8','#0A84FF','#5E5CE6','#BF5AF2','#FF375F','#A5A4F0',
  '#48CAE4','#8AC926','#F72585','#FFBE0B',
];
const TAG_PALETTE = COLOR_PALETTE.slice(0, 10);
const TAG_DEFAULT_NAMES = ['focus','urgent','important','routine','learning','project'];
const REMINDER_OPTIONS = [1, 5, 15, 30, 60, 1440];
const STORE_ITEMS = [
  { id:'m1', cat:'media',  icon:'🎬', title:'Movies / Series',     baseTime:20, unit:'min', baseCost:1,  desc:'Guilt-free screen time.' },
  { id:'m2', cat:'media',  icon:'📱', title:'Social Media',        baseTime:15, unit:'min', baseCost:1,  desc:'Scroll freely, no limits.' },
  { id:'m3', cat:'media',  icon:'▶️', title:'YouTube',             baseTime:20, unit:'min', baseCost:1,  desc:'Reviews, clips, memes.' },
  { id:'g1', cat:'games',  icon:'🎮', title:'PC / PS Games',       baseTime:30, unit:'min', baseCost:2,  desc:'Full gaming session — earned!' },
  { id:'g2', cat:'games',  icon:'🕹️', title:'Mobile Games',        baseTime:15, unit:'min', baseCost:1,  desc:'Quick round on your phone.' },
  { id:'f1', cat:'food',   icon:'🍔', title:'Fast Food',           baseTime:1,  unit:'pc',  baseCost:10, desc:'Burger, pizza, or a wrap.' },
  { id:'f2', cat:'food',   icon:'🥔', title:'Chips / Snacks',      baseTime:1,  unit:'pk',  baseCost:5,  desc:'Unhealthy but honest.' },
  { id:'f3', cat:'food',   icon:'🍫', title:'Chocolate / Sweet',   baseTime:1,  unit:'pc',  baseCost:4,  desc:'A sugar reward for the grind.' },
  { id:'c1', cat:'charity',icon:'❤️', title:'Good Deed / Charity', baseTime:1,  unit:'x',   baseCost:1,  desc:'Do a kind act or donate.' },
];
const LEVELS = [
  { min:0,   label:'Beginner',      emoji:'🌱' },
  { min:10,  label:'Trainee',       emoji:'⚡' },
  { min:25,  label:'Practitioner',  emoji:'🔥' },
  { min:50,  label:'Master',        emoji:'💎' },
  { min:100, label:'Veteran',       emoji:'🏆' },
  { min:200, label:'Legend',        emoji:'⭐' },
  { min:500, label:'Elite',         emoji:'👑' },
  { min:999, label:'Unstoppable',   emoji:'🌟' },
];
const RING_R = 150;                       // matches r="150" in the timer SVG
const RING_C = 2 * Math.PI * RING_R;      // ring circumference
const SPHERE_R = 32;                      // matches r="32" in the sphere SVGs
const SPHERE_C = 2 * Math.PI * SPHERE_R;
const SLIDER_STEP_MIN = 10;               // sleep sliders snap to 10-minute steps — strictly multiples of 10
const DEFAULT_TIMER_MIN = 60;             // default focus-timer length for tasks with no explicit duration
const SLIDER_MAX_STEP = Math.floor(24 * 60 / SLIDER_STEP_MIN) - 1; // 0..143

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function pad(n, d=2) { return String(Math.floor(Math.abs(n))).padStart(d,'0'); }
function rnd() { return Math.random().toString(36).slice(2,7); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dateKey(ts) { const d=new Date(ts||Date.now()); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
// Safari-safe date parser. Replaces new Date('YYYY-MM-DD') which Safari treats as UTC midnight
// causing off-by-one-day bugs. Converts dashes to slashes so Safari uses local time.
function parseDateSafe(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return new Date(v);
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim().replace(/-/g, '/').replace('T', ' ').replace(/\.\d+Z?$/, '');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtD(s) { const dy=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); if(dy>0) return `${dy}d ${pad(h)}h`; if(h>0) return `${h}h ${pad(m)}m`; if(m>0) return `${m}m ${pad(sec)}s`; return `${sec}s`; }
function fmtRel(ts) { const d=Date.now()-ts,m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24); if(dy>0) return `${dy}d ago`; if(h>0) return `${h}h ago`; if(m>0) return `${m}m ago`; return 'just now'; }
function fmtTime(ts) { if(!ts) return ''; const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDateTime(ts) { if(!ts) return ''; const d=new Date(ts); return d.toLocaleString('en-US',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }
function fmtWhen(g){ return g.allDay ? new Date(g.scheduledAt).toLocaleDateString('en-US',{day:'numeric',month:'short'}) : fmtDateTime(g.scheduledAt); }
function fmtDayLabel(ts) { const d=new Date(ts); return d.toLocaleDateString('en-US',{day:'numeric',month:'long',weekday:'short'}); }
function fmtMinutesToHM(mins) { const h=Math.floor(mins/60), m=Math.round(mins%60); return `${h}h ${pad(m)}m`; }
function fmtTimeRange(scheduledAt, durationMin) {
  if (!scheduledAt) return '';
  const start = new Date(scheduledAt);
  const end = new Date(scheduledAt + (durationMin||DEFAULT_TIMER_MIN)*60000);
  const startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  return `${startStr} – ${endStr}`;
}
function getLevel(gemCount) { let lv=LEVELS[0]; for(const l of LEVELS){if(gemCount>=l.min) lv=l;} return lv; }
function catColor(g) { return g.color||(CATS[g.cat]||CATS.business).color; }
function catInfo(g) { return CATS[g.cat]||CATS.business; }
function isUrgent(g) { return g.priority==='high'; }
function catEarnsGems(cat) { return !!(CATS[cat]||{}).earnsGems; }
function initials(name) {
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return (parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
}
function timeStrToStep(hhmm) {
  const [h,m]=(hhmm||'00:00').split(':').map(Number);
  const mins=(h*60+m);
  return Math.round(mins/SLIDER_STEP_MIN);
}
// Converts a slider step index back to a "HH:MM" string that is always
// a strict multiple of SLIDER_STEP_MIN (10) — never e.g. 09:35.
function stepToTimeStr(step) {
  const clamped = Math.max(0, Math.min(SLIDER_MAX_STEP, Math.round(step)));
  const mins = clamped * SLIDER_STEP_MIN;
  const h=Math.floor(mins/60)%24, m=mins%60;
  return `${pad(h)}:${pad(m)}`;
}

/* ═══════════════════════════════════════════════════════════
   TREE HELPERS (Nova OS v8 — flat goals[] with isProject/parentId)
═══════════════════════════════════════════════════════════ */
function getChildren(parentId) {
  return StateManager.get('goals').filter(g => g.parentId === parentId);
}
function getDescendantIds(nodeId, seen = new Set()) {
  if (seen.has(nodeId)) return []; // protect against cycles
  seen.add(nodeId);
  const kids = getChildren(nodeId);
  return kids.flatMap(k => [k.id, ...getDescendantIds(k.id, seen)]);
}
// Recursive progress: counts done/total across LEAF tasks (isProject:false)
function computeNodeProgress(nodeId, seen = new Set()) {
  if (seen.has(nodeId)) return { done:0, total:0 };
  seen.add(nodeId);
  const kids = getChildren(nodeId);
  let done = 0, total = 0;
  kids.forEach(k => {
    if (k.isProject) { const p = computeNodeProgress(k.id, seen); done += p.done; total += p.total; }
    else { total += 1; if (k.done) done += 1; }
  });
  return { done, total };
}
function nodeMatchesCategoryFilter(node, catFilter, seen = new Set()) {
  if (!catFilter) return true;
  // A13: 'creative' is displayed as 'life' — treat them as equivalent when filtering
  if (!node.isProject) return (node.cat === catFilter) || (catFilter === 'life' && node.cat === 'creative');
  if (seen.has(node.id)) return false;
  seen.add(node.id);
  return getChildren(node.id).some(k => nodeMatchesCategoryFilter(k, catFilter, seen));
}
// Flat list for <select> with indentation by depth
function buildParentOptionsFlat(excludeId = null) {
  const excludedSet = excludeId ? new Set([excludeId, ...getDescendantIds(excludeId)]) : new Set();
  const out = [];
  const walk = (parentId, depth) => {
    StateManager.get('goals').filter(g => g.isProject && g.parentId === parentId).forEach(p => {
      if (excludedSet.has(p.id)) return;
      out.push({ id: p.id, label: '—'.repeat(depth) + ' ' + p.title });
      walk(p.id, depth + 1);
    });
  };
  walk(null, 0);
  return out;
}
// A12: pay / revoke project gemsReward when leaf completion changes its ancestor project status.
// Returns the gem delta (positive = pay bonus, negative = revoke).
// Uses in-place mutation on goals[] objects; caller must patch state after calling this.
function settleProjectRewards(leaf) {
  let delta = 0, pid = leaf.parentId, guard = 0;
  const goals = StateManager.get('goals');
  while (pid && guard++ < 20) {
    const p = goals.find(x=>x.id===pid); if (!p) break;
    const { done, total } = computeNodeProgress(p.id);
    const complete = total > 0 && done === total, reward = p.gemsReward || 0;
    if (complete && !p.rewardPaid) {
      p.rewardPaid = true; delta += reward;
      if (reward) showPopup('boss','🏆',`Project complete: ${p.title}`,`+${reward} crystals`);
    } else if (!complete && p.rewardPaid) {
      p.rewardPaid = false; delta -= reward;
    }
    pid = p.parentId;
  }
  return delta;
}

/* ═══════════════════════════════════════════════════════════
   LEGACY MIGRATION (macroGoals → flat goals[] with isProject)
   Called from StateManager.load() and SyncManager._applyServerData()
═══════════════════════════════════════════════════════════ */
function migrateLegacyProjectData(rawState) {
  const macroGoals = rawState.macroGoals;
  if (!Array.isArray(macroGoals) || !macroGoals.length) {
    // Still normalize existing goals even if no macroGoals to convert
    (rawState.goals || []).forEach(g => {
      if (g.isProject === undefined) g.isProject = false;
      if (g.parentId === undefined) g.parentId = g.sprintId || g.macroId || null;
      if (g.recurrence === undefined) g.recurrence = null;
    });
    return;
  }
  const goals = rawState.goals || [];
  const existingIds = new Set(goals.map(g => g.id));
  const defaults = { done:false, cat:'business', scheduledAt:null, duration_min:60, subtasks:[], tags:[], reminders:[], notes:'', location:'', cost:0, travelTime:0, participants:[], color:'', elapsed:0, startTime:null, paused:false };

  macroGoals.forEach(mg => {
    if (!existingIds.has(mg.id)) {
      goals.push({ ...defaults, id: mg.id, title: mg.title, isProject:true, parentId:null,
        deadline: mg.deadline||'', gemsReward: mg.gemsReward||50, createdAt: mg.createdAt||Date.now(),
        isEvent:false, recurrence:null, elapsed_ms:0 });
      existingIds.add(mg.id);
    }
    (mg.sprints||[]).forEach(sp => {
      if (!existingIds.has(sp.id)) {
        goals.push({ ...defaults, id: sp.id, title: sp.title, isProject:true, parentId: mg.id,
          deadline:'', gemsReward:0, createdAt: sp.createdAt||Date.now(),
          isEvent:false, recurrence:null, elapsed_ms:0 });
        existingIds.add(sp.id);
      }
    });
  });

  goals.forEach(g => {
    if (g.isProject === undefined) g.isProject = false;
    if (g.parentId === undefined || (g.parentId === null && (g.macroId || g.sprintId))) {
      g.parentId = g.sprintId || g.macroId || null;
    }
    if (g.recurrence === undefined) g.recurrence = null;
  });

  rawState.goals = goals;
}

/* ═══════════════════════════════════════════════════════════
   GHOST RECURRENCE HELPER (Nova OS v8)
   Returns synthetic event objects for recurring events that
   fall within [rangeStartMs, rangeEndMs). Ghosts are read-only;
   clicking them opens the master event's detail modal.
═══════════════════════════════════════════════════════════ */
function getGhostOccurrences(rangeStartMs, rangeEndMs) {
  const ghosts = [];
  const recurringEvents = StateManager.get('goals').filter(
    g => g.isEvent && g.recurrence && Array.isArray(g.recurrence.days) && g.recurrence.days.length && g.scheduledAt
  );
  recurringEvents.forEach(g => {
    const untilMs = g.recurrence.until || (rangeEndMs + 1);
    // Walk day-by-day through the range
    const cur = new Date(rangeStartMs);
    cur.setHours(0, 0, 0, 0);
    const masterDate = new Date(g.scheduledAt);
    const masterDk   = dateKey(g.scheduledAt);

    while (cur.getTime() <= rangeEndMs && cur.getTime() <= untilMs) {
      // ISO weekday: 1=Mon … 7=Sun
      const isoDay = (cur.getDay() === 0) ? 7 : cur.getDay();
      const curDk  = dateKey(cur.getTime());

      if (g.recurrence.days.includes(isoDay) && curDk !== masterDk) {
        // Skip dates that have been split into individual exceptions
        if (Array.isArray(g.recurrence.exceptions) && g.recurrence.exceptions.includes(curDk)) {
          cur.setDate(cur.getDate() + 1);
          continue;
        }
        // Build ghost timestamp: same HH:MM as master, but on cur's date
        const ghostTs = new Date(cur);
        ghostTs.setHours(masterDate.getHours(), masterDate.getMinutes(), 0, 0);
        const ghostId = `${g.id}_ghost_${curDk}`;
        ghosts.push({
          ...g,
          id:          ghostId,
          scheduledAt: ghostTs.getTime(),
          isGhost:     true,
          ghostOf:     g.id,
          done:        false,   // ghosts are never marked done
          recurrence:  null,    // prevents nested ghost generation
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
  return ghosts;
}

/* ═══════════════════════════════════════════════════════════
   UI HELPERS — toasts, popups, alarms, modal open/close
═══════════════════════════════════════════════════════════ */
function showToast(msg, duration=3000) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast-card'; t.textContent = msg;
  t.style.cssText = 'background:rgba(44,44,46,.96);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 16px;color:#fff;font-size:13px;font-weight:500;box-shadow:0 12px 28px -8px rgba(0,0,0,.6);opacity:0;transform:translateX(20px);transition:opacity .3s,transform .3s;pointer-events:auto;';
  stack.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(0)'; });
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; setTimeout(() => t.remove(), 400); }, duration);
}
function showToastWithUndo(msg, duration=5000) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast-card';
  t.style.cssText = 'background:rgba(44,44,46,.96);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:10px 14px;color:#fff;font-size:13px;font-weight:500;box-shadow:0 12px 28px -8px rgba(0,0,0,.6);opacity:0;transform:translateX(20px);transition:opacity .3s,transform .3s;pointer-events:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;';
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Отменить';
  btn.style.cssText = 'background:rgba(255,59,48,0.25);border:1px solid rgba(255,59,48,0.5);color:#fff;padding:4px 9px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;';
  btn.onclick = () => {
    if (StateManager.undo()) {
      refreshEverything();
      showToast('↩ Отменено', 1500);
    }
    t.remove();
  };
  t.appendChild(btn);
  stack.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(0)'; });
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; setTimeout(() => t.remove(), 400); }, duration);
}
let popQueue=[], popShowing=false;
function showPopup(type, icon, title, sub) { popQueue.push({type,icon,title,sub}); if(!popShowing) flushPopup(); }
function flushPopup() {
  if (!popQueue.length) { popShowing=false; return; }
  popShowing=true;
  const {icon,title,sub} = popQueue.shift();
  const stack = document.getElementById('toast-stack');
  if (!stack) { setTimeout(flushPopup,3600); return; }
  const card = document.createElement('div');
  card.style.cssText = 'display:flex;align-items:center;gap:12px;background:rgba(44,44,46,.97);border:1px solid rgba(255,59,48,.3);border-radius:16px;padding:12px 16px;color:#fff;box-shadow:0 0 0 1px rgba(255,59,48,.15),0 16px 34px -10px rgba(255,59,48,.35);opacity:0;transform:translateX(20px) scale(.96);transition:opacity .3s,transform .3s;pointer-events:auto;';
  card.innerHTML = `<div style="font-size:22px;flex:none;">${icon}</div><div><div style="font-size:13px;font-weight:700;">${esc(title)}</div><div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:1px;">${esc(sub)}</div></div>`;
  stack.appendChild(card);
  requestAnimationFrame(()=>{ card.style.opacity='1'; card.style.transform='translateX(0) scale(1)'; });
  setTimeout(() => { card.style.opacity='0'; card.style.transform='translateX(20px) scale(.96)'; setTimeout(() => { card.remove(); flushPopup(); }, 400); }, 3200);
}
// Every modal wrapper shares the z-50 class, so with two modals open at
// once the later one could render beneath the earlier one. Every
// openModal() call bumps that modal's inline z-index above all others and
// closes any *other* currently-open modal first, so at most one modal is
// ever interactive at a time and it is always on top.
let _modalZCounter = 10000;
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  document.querySelectorAll('.modal').forEach(m => {
    if (m.id !== id && !m.classList.contains('hidden')) {
      m.classList.add('hidden'); m.classList.remove('flex');
      if (m.id === 'modal-voice') VoiceInput.stop();
    }
  });
  _modalZCounter += 1;
  el.style.zIndex = String(_modalZCounter);
  el.classList.remove('hidden'); el.classList.add('flex');
  document.body.classList.add('modal-open');
  if (id === 'modal-voice') VoiceInput.start();
};
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden'); el.classList.remove('flex');
  const stillOpen = Array.from(document.querySelectorAll('.modal')).some(m => !m.classList.contains('hidden'));
  if (!stillOpen) document.body.classList.remove('modal-open');
  if (id === 'modal-voice') VoiceInput.stop();
};

/* ═══════════════════════════════════════════════════════════
   STATE MANAGER (Pub/Sub + localStorage)
═══════════════════════════════════════════════════════════ */
const StateManager = (() => {
  let state = {
    goals:[], history:[], purchases:[], cart:[], gems:0,
    streak:{ days:0, lastDate:'', doneToday:false, best:0 }, tags:[],
    pomoConfig:{ work:25, short:5, long:15 }, pomoPhase:'work', pomoCycles:0,
    sleepSettings:{ bedtime:'23:00', waketime:'07:00', eveningPrepMins:30, eveningGratitudeMins:15, morningWaterDelay:5, morningBrushDelay:10, softAlarmEnabled:true, sleepLog:{} },
    routines:[], profileName:'You',
    tgToken:'', tgChatId:'', webhookUrl:'', currentView:'tasks', taskFilter:'today', taskTagFilter:null, taskCatFilter:null,
    searchQuery:'', sortMode:'date', calView:'day', timerMode:'countdown',
    activeTaskId:null, editingTaskId:null, editingRoutineId:null, detailTaskId:null,
    storeFilter:'all', storeDraft:{}, expandedMacros:{},
    dimRecurring: false,
    dailyBoss: { date: '', id: null },
    achievements: {},
  };
  const listeners = [];

  function load() {
    try {
      const tryParse = (key, def) => { try { return JSON.parse(localStorage.getItem(key)||'null')??def; } catch(e){return def;} };
      const g = tryParse('nova-goals', []);
      const h = tryParse('nova-history', []);
      const p = tryParse('nova-purchases', []);
      const gems = parseInt(localStorage.getItem('nova-gems')||'0')||0;
      const streak = tryParse('nova-streak', { days:0, lastDate:'', doneToday:false, best:0 });
      if (typeof streak.best !== 'number') streak.best = streak.days||0;
      let tags = tryParse('nova-tags', null);
      if (!tags) tags = TAG_DEFAULT_NAMES.map((name,i) => ({ id:'tag_default_'+i, name, color:TAG_PALETTE[i%TAG_PALETTE.length] }));
      // Read legacy macros for migration (will be cleaned up after migration)
      const macros    = tryParse('nova-macros', []);
      const pomo      = tryParse('nova-pomo', { work:25, short:5, long:15 });
      const sleep     = tryParse('nova-sleep', state.sleepSettings);
      if (!sleep.sleepLog) sleep.sleepLog = {};
      const routines  = tryParse('nova-routines', []);
      const profileName = localStorage.getItem('nova-profile-name') || 'You';
      const tgToken   = localStorage.getItem('nova-tg-token')||'';
      const tgChatId  = localStorage.getItem('nova-tg-chat')||'';
      const webhookUrl= localStorage.getItem('nova-webhook')||'';

      g.forEach(gg => {
        if (!gg.location)     gg.location=''; if (!gg.participants) gg.participants=[];
        if (!gg.cost)         gg.cost=0;      if (!gg.travelTime)   gg.travelTime=0;
        if (!gg.reminders)    gg.reminders=[]; if (!gg.color)        gg.color='';
        if (gg.isEvent === undefined) gg.isEvent = false;
        if (!gg.scheduledAt)  gg.scheduledAt=null;
        if (!gg.duration_min) gg.duration_min = Math.round((gg.duration||DEFAULT_TIMER_MIN*60)/60);
        if (!gg.notes)        gg.notes='';
        if (!gg.subtasks)     gg.subtasks=[];
        if (!gg.tags)         gg.tags=[];
        if (!gg.macroId)      gg.macroId=null;
        if (!gg.sprintId)     gg.sprintId=null;
        if (!gg.cat || !CATS[gg.cat]) gg.cat='business';
        if (typeof gg.elapsed !== 'number') gg.elapsed=0;
      });

      const rawForMigration = { goals: g, macroGoals: macros };
      migrateLegacyProjectData(rawForMigration);

      if (!localStorage.getItem('nova-migrated-v8') && macros.length) {
        localStorage.setItem('nova-migrated-v8', '1');
      }
      // Clean up legacy macros key after migration
      if (localStorage.getItem('nova-migrated-v8')) {
        localStorage.removeItem('nova-macros');
      }

      const draft = {}; STORE_ITEMS.forEach(i => draft[i.id]=1);
      const dimRecurring = localStorage.getItem('nova-dim-recurring') === '1';
      const activeTaskId = localStorage.getItem('nova-active-task') || null;
      // A2: on first run with new sync system, let server win so all devices start in sync
      if (!localStorage.getItem('nova-sync-v2')) {
        localStorage.setItem('nova-updatedAt', '0');
        localStorage.setItem('nova-sync-v2', '1');
      }
      const dailyBoss = tryParse('nova-daily-boss', { date: '', id: null });
      const achievements = tryParse('nova-achievements', {});
      state = { ...state, goals:rawForMigration.goals, history:h, purchases:p, gems, streak, tags,
        pomoConfig:pomo, sleepSettings:sleep, routines, profileName,
        tgToken, tgChatId, webhookUrl, storeDraft:draft, dimRecurring, activeTaskId,
        dailyBoss, achievements };
    } catch(e) {
      console.error('[StateManager load]', e);
      // Guarantee critical arrays are always arrays even if parse failed
      if (!Array.isArray(state.goals))   state.goals   = [];
      if (!Array.isArray(state.history)) state.history = [];
      if (!Array.isArray(state.tags))    state.tags    = [];
    }
  }

  function save() {
    try {
      localStorage.setItem('nova-goals',    JSON.stringify(state.goals));
      // Cap history at 500 entries — prevents localStorage bloat and slow mobile renders
      const historyToSave = state.history.length > 500 ? state.history.slice(0, 500) : state.history;
      localStorage.setItem('nova-history',  JSON.stringify(historyToSave));
      localStorage.setItem('nova-purchases',JSON.stringify(state.purchases));
      localStorage.setItem('nova-gems',     String(state.gems));
      localStorage.setItem('nova-streak',   JSON.stringify(state.streak));
      localStorage.setItem('nova-tags',     JSON.stringify(state.tags));
      // nova-macros intentionally NOT written — data lives in nova-goals now
      localStorage.setItem('nova-pomo',     JSON.stringify(state.pomoConfig));
      localStorage.setItem('nova-sleep',    JSON.stringify(state.sleepSettings));
      localStorage.setItem('nova-routines', JSON.stringify(state.routines));
      localStorage.setItem('nova-profile-name', state.profileName||'You');
      localStorage.setItem('nova-tg-token', state.tgToken||'');
      localStorage.setItem('nova-tg-chat',  state.tgChatId||'');
      localStorage.setItem('nova-webhook',  state.webhookUrl||'');
      localStorage.setItem('nova-updatedAt', String(Date.now()));
      localStorage.setItem('nova-dim-recurring', state.dimRecurring ? '1' : '0');
      localStorage.setItem('nova-daily-boss', JSON.stringify(state.dailyBoss || { date: '', id: null }));
      localStorage.setItem('nova-achievements', JSON.stringify(state.achievements || {}));
    } catch(e) { console.error('[StateManager save]', e); }
  }

  // ── Centralized Undo/Redo (in-memory only, not persisted) ──
  const _undoStack = [], _redoStack = [];
  const MAX_SNAP = 50;
  let _restoring = false;
  function _snap() {
    return JSON.parse(JSON.stringify({ goals: state.goals, history: state.history, gems: state.gems, streak: state.streak }));
  }
  function _applySnap(s) {
    _restoring = true;
    Object.assign(state, s);
    save();
    _restoring = false;
    try { SyncManager.scheduleSync(); } catch(_) {}
    try { TimerController.scheduleReminders(); } catch(_) {}
    try { refreshEverything(); } catch(_) {}
    if (typeof _updateUndoRedoBtns === 'function') _updateUndoRedoBtns();
  }

  return {
    get: (key) => key===undefined ? {...state} : state[key],
    set: (key,val) => {
      state[key]=val;
      // A2: don't bump updatedAt / re-save 12 keys for view-state-only changes
      const UI_ONLY = new Set(['currentView','taskFilter','taskTagFilter','taskCatFilter','taskUrgentOnly','searchQuery','sortMode','calView','timerMode','editingTaskId','editingRoutineId','detailTaskId','storeFilter','storeDraft','expandedMacros','cart']);
      if (key==='activeTaskId') localStorage.setItem('nova-active-task', val||'');
      else if (!UI_ONLY.has(key)) save();
      listeners.forEach(fn=>fn(key,val));
    },
    patch: (obj) => { Object.assign(state,obj); save(); listeners.forEach(fn=>fn()); },
    subscribe: (fn) => { listeners.push(fn); return ()=>{ const i=listeners.indexOf(fn); if(i>-1) listeners.splice(i,1); }; },
    load, save,
    // Undo/redo API
    pushUndoSnapshot() {
      if (_restoring) return;
      _undoStack.push(_snap());
      if (_undoStack.length > MAX_SNAP) _undoStack.shift();
      _redoStack.length = 0;
      if (typeof _updateUndoRedoBtns === 'function') _updateUndoRedoBtns();
    },
    undo() {
      const s = _undoStack.pop();
      if (!s) return false;
      _redoStack.push(_snap());
      _applySnap(s);
      return true;
    },
    redo() {
      const s = _redoStack.pop();
      if (!s) return false;
      _undoStack.push(_snap());
      _applySnap(s);
      return true;
    },
    canUndo() { return _undoStack.length > 0; },
    canRedo() { return _redoStack.length > 0; },
  };
})();


/* ═══════════════════════════════════════════════════════════
   SYNC MANAGER (Vercel KV 2-Way)
═══════════════════════════════════════════════════════════ */
const SyncManager = (() => {
  const KV = '/api/sync';
  let kvTimer=null;
  let _syncKeyToastShown=false;

  function getSyncKey() { return localStorage.getItem('nova-sync-key') || ''; }

  function getUid() {
    const host = window.location.hostname;
    if ((host === 'cernavation.vercel.app' || host === 'localhost') && getSyncKey()) {
      return 'master_admin_id';
    }
    let uid = localStorage.getItem('nova-uid');
    if (!uid || uid === 'master_admin_id') { uid = 'guest_' + Date.now().toString(36) + rnd(); localStorage.setItem('nova-uid', uid); }
    return uid;
  }
  function setBadge(cls,text) {
    if (cls==='hidden' || !text) return;
    showToast(text, 1600);
  }

  async function doSync() {
    try {
      const s = StateManager.get();
      const localUpdatedAt = parseInt(localStorage.getItem('nova-updatedAt') || '0') || Date.now();
      const res = await fetch(KV, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-nova-key': getSyncKey() },
        body: JSON.stringify({
          userId: getUid(),
          updatedAt: localUpdatedAt,
          goals: s.goals,
          gems: s.gems,
          streak: s.streak,
          history: s.history.length > 500 ? s.history.slice(0, 500) : s.history,
          purchases: s.purchases,
          tags: s.tags,
          routines: s.routines,
          sleepSettings: s.sleepSettings,
          dailyBoss: s.dailyBoss,
          achievements: s.achievements,
        }),
      });
      if (res.status === 401) {
        if (!_syncKeyToastShown && getUid() === 'master_admin_id') {
          _syncKeyToastShown = true;
          showToast('🔑 Sync key required');
        }
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.forceUpdate && json.data) {
          console.warn('[SyncManager] forceUpdate: server is newer, overwriting local state');
          _applyServerData(json.data);
          setBadge('synced', '↓ Synced from server');
        } else if (json.updatedAt) {
          localStorage.setItem('nova-updatedAt', String(json.updatedAt));
        }
      }
    } catch (_) { /* offline or endpoint missing — silent, non-blocking */ }
  }

  function _applyServerData(data) {
    if (!data || !data.goals) return;
    const s = StateManager.get();
    // Run migration on server data in case it came from an older client
    if (Array.isArray(data.macroGoals) && data.macroGoals.length) {
      migrateLegacyProjectData(data);
    } else {
      (data.goals || []).forEach(g => {
        if (g.isProject === undefined) g.isProject = false;
        if (g.parentId === undefined)  g.parentId  = g.sprintId || g.macroId || null;
        if (g.recurrence === undefined) g.recurrence = null;
      });
    }
    const patch = {
      goals:      Array.isArray(data.goals)   ? data.goals   : s.goals,
      history:    Array.isArray(data.history) ? data.history : s.history,
      gems:       typeof data.gems   === 'number' ? data.gems   : s.gems,
      streak:     data.streak ?? s.streak,
    };
    if (Array.isArray(data.purchases))   patch.purchases   = data.purchases;
    if (Array.isArray(data.tags))        patch.tags        = data.tags;
    if (Array.isArray(data.routines))    patch.routines    = data.routines;
    if (data.sleepSettings && typeof data.sleepSettings === 'object') patch.sleepSettings = data.sleepSettings;
    if (data.dailyBoss && typeof data.dailyBoss === 'object') patch.dailyBoss = data.dailyBoss;
    if (data.achievements && typeof data.achievements === 'object') patch.achievements = data.achievements;
    // Single deferred render — StateManager.patch() notifies listeners synchronously;
    // refreshEverything() is the authoritative full repaint, deferred so DOM isn't
    // hammered twice in the same frame.
    StateManager.patch(patch);
    if (data.updatedAt) localStorage.setItem('nova-updatedAt', String(data.updatedAt));
    setTimeout(() => {
      try { TimerController.scheduleReminders(); } catch(_) {}
      try { refreshEverything(); } catch(_) {}
    }, 0);
  }

  async function loadFromCloud(opts = {}) {
    try {
      const res = await fetch(`${KV}?userId=${getUid()}`, { headers: { 'x-nova-key': getSyncKey() } });
      if (res.status === 401) {
        if (!_syncKeyToastShown && getUid() === 'master_admin_id') {
          _syncKeyToastShown = true;
          showToast('🔑 Sync key required');
        }
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.goals) return;
      // Skip if server data is not newer than local
      const localTs = parseInt(localStorage.getItem('nova-updatedAt') || '0') || 0;
      if (data.updatedAt && data.updatedAt <= localTs) {
        if (data.updatedAt < localTs) { clearTimeout(kvTimer); kvTimer = setTimeout(doSync, 300); }
        return;
      }
      if (opts.silent && document.querySelector('.modal:not(.hidden)')) return;
      _applyServerData(data);
      if (!opts.silent) showToast('☁️ Cloud data loaded');
    } catch (e) { console.warn('[KV load]', e); }
  }
  return {
    scheduleSync:()=>{ clearTimeout(kvTimer); kvTimer=setTimeout(doSync,1500); },
    loadFromCloud, getUid, getSyncKey,
  };
})();

// Keeps every on-screen copy of the profile name in sync regardless of
// which view is currently active. Runs unconditionally, independent of
// currentView, so a fresh page load (Tasks is the default view) never
// shows a stale placeholder. Must be called AFTER StateManager.load()
// so it reads the persisted nova-profile-name value, not the "You" default.
function syncProfileNameEverywhere() {
  const name = StateManager.get('profileName') || 'You';
  const headerName = document.getElementById('profile-name-header');
  if (headerName) headerName.textContent = name;
  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = name;
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) avatarEl.textContent = initials(name);
  const nameInp = document.getElementById('settings-profile-name');
  if (nameInp && document.activeElement !== nameInp) nameInp.value = name;
}

// Called by StateManager after every undo/redo snapshot push to sync button disabled state
function _updateUndoRedoBtns() {
  const u = document.getElementById('btn-undo'), r = document.getElementById('btn-redo');
  if (u) u.disabled = !StateManager.canUndo();
  if (r) r.disabled = !StateManager.canRedo();
}

function refreshEverything() {
  updateCrystalChips();
  syncProfileNameEverywhere();
  const v = StateManager.get('currentView');
  if (v==='tasks')    { TaskController.render(); renderTagFilterRow(); renderProjectsPanel(); renderCategoryFilters(); }
  if (v==='calendar') CalendarController.render();
  if (v==='profile')  ProfileRenderer.render();
  if (v==='focus')    { TimerController.renderGoalCard(); TimerController.tick(); TimerController.renderSpheres(); }
  if (v==='sleep')    RoutineManager.render();
}

/* ═══════════════════════════════════════════════════════════
   VIEW ROUTER
═══════════════════════════════════════════════════════════ */
const VIEW_ORDER = ['tasks','focus','calendar','sleep','profile'];

const ViewRouter = {
  switchTo(view) {
    if (!VIEW_ORDER.includes(view)) view = 'tasks';
    StateManager.set('currentView', view);
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('hidden', el.id !== 'view-' + view));
    const active = document.getElementById('view-' + view);
    if (active) { active.classList.remove('view'); void active.offsetWidth; active.classList.add('view'); }
    document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    try {
      if (view==='tasks')    { TaskController.render(); renderTagFilterRow(); renderProjectsPanel(); renderCategoryFilters(); }
      if (view==='calendar') { CalendarController._didAutoScroll = false; CalendarController.render(); }
      if (view==='profile')  ProfileRenderer.render();
      if (view==='focus')    { TimerController.renderGoalCard(); TimerController.tick(); TimerController.renderSpheres(); }
      if (view==='sleep')    RoutineManager.render();
    } catch(e) { console.error('[ViewRouter]', e); }
  },
};
window.switchView = (view) => ViewRouter.switchTo(view);

function switchSub(containerId, prefix, sub) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.subtab').forEach(t => {
    const key = t.dataset.sub || t.dataset.cal;
    const on = key === sub;
    t.classList.toggle('active', on);
    t.classList.toggle('text-white/50', !on);
  });
  const rootId = (prefix === 'focus') ? 'view-focus' : 'view-calendar';
  document.querySelectorAll('#' + rootId + ' .subview').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(prefix + '-' + sub);
  if (target) {
    target.classList.remove('hidden'); target.classList.remove('subview');
    void target.offsetWidth; target.classList.add('subview');
  }
  if (prefix === 'focus') {
    if (sub === 'history') FocusHistoryRenderer.render();
    if (sub === 'shop') StoreController.render();
    if (sub === 'timer') { TimerController.renderGoalCard(); TimerController.tick(); TimerController.renderSpheres(); }
  }
  if (prefix === 'cal') {
    StateManager.set('calView', sub);
    CalendarController.setView(sub);
  }
}

/* ═══════════════════════════════════════════════════════════
   PROJECTS PANEL (v8 — recursive tree via isProject/parentId)
═══════════════════════════════════════════════════════════ */
function _buildLeafTaskRow(g) {
  const cat = catInfo(g);
  return `<label class="flex items-center gap-3 cursor-pointer" data-task-row="${g.id}">
    <input type="checkbox" class="chk" data-action="toggle-task" data-id="${g.id}" ${g.done?'checked':''}>
    <span class="tasklabel flex-1 truncate" style="${g.done?'text-decoration:line-through;opacity:.45;':''}">${esc(g.title)}</span>
    ${(g.scheduledAt && !g.allDay)?`<span class="cal-event-time flex-none">${fmtTimeRange(g.scheduledAt, g.duration_min)}</span>`:''}
    <span class="tag ${isUrgent(g)?'':'tag-grey'} flex-none">${cat.label}</span>
    <button class="node-icon-btn flex-none" data-action="edit-task" data-id="${g.id}" title="Edit task">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
    </button>
  </label>`;
}

function _renderNodeCard(node, depth) {
  const expanded = !!(StateManager.get('expandedMacros')||{})[node.id];
  const { done, total } = computeNodeProgress(node.id);
  const pct = total ? Math.round(done/total*100) : 0;
  const children = getChildren(node.id);
  const catFilter = StateManager.get('taskCatFilter');
  const visibleChildren = children.filter(c => nodeMatchesCategoryFilter(c, catFilter));

  const childrenHtml = visibleChildren.map(c =>
    c.isProject ? _renderNodeCard(c, depth+1) : _buildLeafTaskRow(c)
  ).join('');

  return `
  <div class="glass glass-hover rounded-2xl p-4 ${depth>0?'tree-node':''}" data-macro-card="${node.id}">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0" data-action="toggle-macro-expand" data-id="${node.id}">
        <svg class="expand-chevron w-4 h-4 text-white/40 flex-none ${expanded?'open':''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <span class="truncate font-semibold text-sm">${esc(node.title)}</span>
        <span class="text-white/30 text-[11px] flex-none">${total} task${total===1?'':'s'}</span>
      </div>
      <div class="flex items-center gap-2 flex-none">
        <span class="text-accent font-bold text-sm">${pct}%</span>
        <div class="node-actions">
          <button class="node-icon-btn" data-action="add-child-task" data-parent-id="${node.id}" title="Add task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </button>
          <button class="node-icon-btn" data-action="add-child-project" data-parent-id="${node.id}" title="Add sub-folder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
          </button>
          <button class="node-icon-btn" data-action="edit-macro" data-id="${node.id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="h-1.5 rounded-full bg-white/10 mt-3 overflow-hidden">
      <div class="h-full accent-grad" style="width:${pct}%"></div>
    </div>
    <div class="node-children-wrap ${expanded?'open':''}" data-children-wrap="${node.id}">
      <div class="node-children-inner">
        <div class="space-y-2" data-children-list="${node.id}">
          ${childrenHtml || (expanded ? '<p class="text-white/30 text-xs pl-2 pt-1">Empty — use the icons above to add something</p>' : '')}
        </div>
      </div>
    </div>
  </div>`;
}

function renderProjectsPanel() {
  const wrap = document.getElementById('projects-container');
  if (!wrap) return;
  const goals    = StateManager.get('goals');

  const roots = goals.filter(g => g.isProject && !g.parentId);

  if (!roots.length) {
    wrap.innerHTML = `<div class="glass rounded-3xl p-6">
      <div class="empty-state" style="padding:24px 0;">
        <div class="empty-icon">🗂️</div>
        <div class="empty-title">No projects yet</div>
        <div class="empty-sub">Tap "+ New Project" to create your first project</div>
      </div>
    </div>`;
    return;
  }

  let html = '';
  roots.forEach(root => {
    html += _renderNodeCard(root, 0);
  });
  wrap.innerHTML = html || `<p class="text-white/35 text-sm p-4">No projects match the current filter.</p>`;

  // Toggle expand: НЕ вызывать renderProjectsPanel() — только точечный DOM-тоггл,
  // иначе CSS-transition аккордеона не сработает (элемент "родится" уже в конечном состоянии).
  wrap.querySelectorAll('[data-action="toggle-macro-expand"]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const exp = { ...StateManager.get('expandedMacros') };
      exp[id] = !exp[id];
      StateManager.set('expandedMacros', exp); // persist only, no forced re-render of this panel

      const cardEl = wrap.querySelector(`[data-macro-card="${id}"]`);
      cardEl?.querySelector('.expand-chevron')?.classList.toggle('open', exp[id]);
      cardEl?.querySelector(`[data-children-wrap="${id}"]`)?.classList.toggle('open', exp[id]);
    });
  });

  wrap.querySelectorAll('[data-action="add-child-task"]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); _openInlineQuickAdd(el.dataset.parentId, 'task'); });
  });
  wrap.querySelectorAll('[data-action="add-child-project"]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); _openInlineQuickAdd(el.dataset.parentId, 'project'); });
  });
  wrap.querySelectorAll('[data-action="edit-macro"]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); MacroController.openModal(el.dataset.id); });
  });
  wrap.querySelectorAll('[data-action="toggle-task"]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); TaskController.complete(el.dataset.id); renderProjectsPanel(); });
  });
  wrap.querySelectorAll('[data-action="edit-task"]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); TaskController.openModal(el.dataset.id); });
  });
}

function _openInlineQuickAdd(parentId, kind) {
  // Убрать любой уже открытый quick-add инпут (не более одного одновременно)
  document.querySelectorAll('.inline-quick-add').forEach(i => i.remove());

  // Если родитель свёрнут — раскрыть его точечно (не через renderProjectsPanel!)
  const exp = { ...StateManager.get('expandedMacros') };
  if (!exp[parentId]) {
    exp[parentId] = true;
    StateManager.set('expandedMacros', exp);
    const cardEl = document.querySelector(`[data-macro-card="${parentId}"]`);
    cardEl?.querySelector('.expand-chevron')?.classList.add('open');
    cardEl?.querySelector(`[data-children-wrap="${parentId}"]`)?.classList.add('open');
  }

  const listEl = document.querySelector(`[data-children-list="${parentId}"]`);
  if (!listEl) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-quick-add field';
  input.placeholder = kind === 'project' ? 'Folder name & press Enter…' : 'Task name & press Enter…';
  listEl.prepend(input);
  input.focus();

  let committed = false;
  const commit = () => {
    if (committed) return; committed = true;
    const val = input.value.trim();
    if (val) {
      const id = (kind === 'project' ? 'macro_' : 'g_') + Date.now().toString(36) + rnd();
      const base = {
        id, title: val, parentId, isProject: kind === 'project',
        done: false, createdAt: Date.now(), cat: 'business', scheduledAt: null,
        duration_min: DEFAULT_TIMER_MIN, subtasks: [], tags: [], reminders: [],
        notes: '', location: '', cost: 0, recurrence: null,
        elapsed: 0, startTime: null, paused: false,
        ...(kind === 'project' ? { gemsReward: 0, deadline: null } : { isEvent: false, priority: 'mid' }),
      };
      StateManager.patch({ goals: [...StateManager.get('goals'), base] });
      SyncManager.scheduleSync();
    }
    input.remove();
    renderProjectsPanel(); // полный ре-рендер оправдан: данные реально изменились
  };
  const cancel = () => { if (committed) return; committed = true; input.remove(); };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', () => setTimeout(cancel, 100));
}

/* ═══════════════════════════════════════════════════════════
   CATEGORY / DEADLINE FILTER SIDEBAR (Tasks view, right rail)
═══════════════════════════════════════════════════════════ */
function renderCategoryFilters() {
  const catWrap = document.getElementById('category-filter-list');
  const dlWrap = document.getElementById('deadline-filter-list');
  if (!catWrap || !dlWrap) return;
  const goals = StateManager.get('goals');
  const activeCat = StateManager.get('taskCatFilter');

  const catKey = g => g.cat === 'creative' ? 'life' : g.cat;
  catWrap.innerHTML = CAT_ORDER.map(key=>{
    const c = CATS[key];
    const count = goals.filter(g=>!g.done && catKey(g)===key).length;
    const active = (activeCat === 'creative' ? 'life' : activeCat) === key;
    return `<button class="w-full glass-soft glass-hover rounded-xl px-4 py-2.5 text-left text-sm flex items-center gap-3 justify-between" data-action="filter-cat" data-cat="${key}" style="${active?`border-color:${c.color}88;color:#fff;`:''}">
      <span class="flex items-center gap-3"><span class="w-2.5 h-2.5 rounded-full" style="background:${c.color}"></span>${c.label}</span>
      <span class="text-[10px] text-white/40">${count}</span>
    </button>`;
  }).join('');
  catWrap.querySelectorAll('[data-action="filter-cat"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cur = StateManager.get('taskCatFilter');
      StateManager.set('taskCatFilter', cur===btn.dataset.cat ? null : btn.dataset.cat);
      TaskController.render(); renderCategoryFilters(); renderProjectsPanel();
    });
  });

  const now=new Date(), tKey=dateKey();
  const urgent = goals.filter(g=>!g.done && isUrgent(g)).length;
  const today = goals.filter(g=>!g.done && g.scheduledAt && dateKey(g.scheduledAt)===tKey).length;
  const doneCount = goals.filter(g=>g.done).length;
  dlWrap.innerHTML = `
    <button class="w-full glass-soft glass-hover rounded-xl px-4 py-2.5 text-left text-sm flex items-center justify-between" data-action="filter-deadline" data-key="urgent">Urgent <span class="text-[10px] px-2 py-0.5 rounded-full bg-accent/25 text-red-300">${urgent}</span></button>
    <button class="w-full glass-soft glass-hover rounded-xl px-4 py-2.5 text-left text-sm flex items-center justify-between" data-action="filter-deadline" data-key="today">Today <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10">${today}</span></button>
    <button class="w-full glass-soft glass-hover rounded-xl px-4 py-2.5 text-left text-sm flex items-center justify-between" data-action="filter-deadline" data-key="done">Done <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10">${doneCount}</span></button>
  `;
  dlWrap.querySelectorAll('[data-action="filter-deadline"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.key;
      if (key==='done') StateManager.set('taskFilter','done');
      else if (key==='today') StateManager.set('taskFilter','today');
      else if (key==='urgent') { StateManager.set('taskFilter','all'); StateManager.set('taskUrgentOnly', true); }
      TaskController.render();
      document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(b=>{
        const on = b.dataset.filter===StateManager.get('taskFilter');
        b.classList.toggle('active', on);
        b.style.background = on ? 'rgba(255,59,48,.18)' : 'transparent';
        b.style.color = on ? '#fff' : 'rgba(255,255,255,.5)';
      });
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   BOSS CONFETTI (B4.1 — Lightweight Canvas Animation)
═══════════════════════════════════════════════════════════ */
function launchBossConfetti() {
  if (document.documentElement.classList.contains('lite')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }
    ctx.scale(dpr, dpr);

    const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'];
    const particles = [];
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: w * 0.5 + (Math.random() - 0.5) * 120,
        y: h * 0.35 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 3,
        size: Math.random() * 5 + 4,
        color: colors[i % colors.length],
        alpha: 1,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }

    const startTime = Date.now();
    const duration = 1500;

    function frame() {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        canvas.remove();
        return;
      }
      ctx.clearRect(0, 0, w, h);
      const progress = elapsed / duration;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.rotation += p.rotSpeed;
        p.alpha = Math.max(0, 1 - progress);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (_) { /* fallback silent */ }
}

/* ═══════════════════════════════════════════════════════════
   TASK CONTROLLER
═══════════════════════════════════════════════════════════ */
const TaskController = {
  _selectedTags:[], _selectedReminders:[], _selectedColor:COLOR_PALETTE[0], _participants:[], _subtasks:[], _activeCat:'business', _selectedType:'task', _selectedRecurrence:null,

  init() {
    StateManager.subscribe(() => {
      if (StateManager.get('currentView')==='tasks') this.render();
    });
    document.getElementById('btn-search-toggle')?.addEventListener('click', () => {
      const wrap = document.getElementById('search-wrap');
      const isOpen = wrap.style.display !== 'none';
      wrap.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) document.getElementById('search-input')?.focus();
      else { StateManager.set('searchQuery',''); const si=document.getElementById('search-input'); if(si) si.value=''; this.render(); }
    });
    document.getElementById('search-input')?.addEventListener('input', e => { StateManager.set('searchQuery', e.target.value); this.render(); });
    document.getElementById('btn-sort')?.addEventListener('click', () => {
      const modes=['date','priority','cat'], cur=StateManager.get('sortMode')||'date';
      const next=modes[(modes.indexOf(cur)+1)%modes.length]; StateManager.set('sortMode',next);
      const btn=document.getElementById('btn-sort'); if(btn) btn.textContent={date:'⇅ Date',priority:'⇅ Priority',cat:'⇅ Category'}[next];
      this.render();
    });
    document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        StateManager.set('taskFilter',btn.dataset.filter);
        StateManager.set('taskUrgentOnly', false);
        document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(b=>{
          const on=b.dataset.filter===btn.dataset.filter;
          b.classList.toggle('active',on);
          b.style.background = on ? 'rgba(255,59,48,.18)' : 'transparent';
          b.style.color = on ? '#fff' : 'rgba(255,255,255,.5)';
        });
        this.render();
      });
    });
    document.getElementById('btn-new-task')?.addEventListener('click', ()=>this.openModal());
    document.getElementById('btn-add-subtask')?.addEventListener('click', ()=>this.addSubtaskRow());
    document.getElementById('btn-task-save')?.addEventListener('click', ()=>this.save());
    document.getElementById('btn-delete-task')?.addEventListener('click', ()=>this.delete());
    document.getElementById('task-title-input')?.addEventListener('input', e=>{
      const hint=document.getElementById('nlp-hint');
      if(!hint) return;
      if(e.target.value.length>5){ const p=NLP.parse(e.target.value, {dryRun:true}); if(p.scheduledAt){hint.textContent=`📅 ${fmtDateTime(p.scheduledAt)}`; hint.classList.remove('hidden');}else hint.classList.add('hidden'); }
      else hint.classList.add('hidden');
    });
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#priority-ctrl .seg-btn').forEach(b=>{b.style.background='rgba(255,255,255,.05)';b.style.color='rgba(255,255,255,.5)';b.classList.remove('active');});
        btn.style.background='rgba(255,59,48,.18)'; btn.style.color='#fff'; btn.classList.add('active');
      });
    });

    // Task detail modal buttons
    document.getElementById('btn-td-edit')?.addEventListener('click', ()=>{ closeModal('taskDetailModal'); this.openModal(StateManager.get('detailTaskId')); });
    document.getElementById('btn-td-timer')?.addEventListener('click', ()=>{ closeModal('taskDetailModal'); TimerController.setGoal(StateManager.get('detailTaskId')); ViewRouter.switchTo('focus'); });
    document.getElementById('btn-td-done')?.addEventListener('click', ()=>{ this.complete(StateManager.get('detailTaskId')); closeModal('taskDetailModal'); });
    // Deletes the task currently open in the detail modal. Reads detailTaskId
    // fresh (not a closed-over id) so it always targets the task actually on
    // screen, then closes the modal and re-renders every view that could be
    // showing that task (list, projects panel, calendar) without errors.
    document.getElementById('btn-td-delete')?.addEventListener('click', ()=>{
      const id=StateManager.get('detailTaskId');
      if(!id) { closeModal('taskDetailModal'); return; }
      const g=StateManager.get('goals').find(x=>x.id===id);
      if(!confirm(`Delete "${g?g.title:'this task'}"?`)) return;
      StateManager.patch({goals:StateManager.get('goals').filter(x=>x.id!==id)});
      if (StateManager.get('activeTaskId')===id) StateManager.set('activeTaskId', null);
      SyncManager.scheduleSync();
      StateManager.set('detailTaskId', null);
      closeModal('taskDetailModal');
      this.render();
      renderProjectsPanel();
      if (StateManager.get('currentView')==='calendar') CalendarController.render();
      if (StateManager.get('currentView')==='focus') { TimerController.tick(); TimerController.renderSpheres(); }
      showToast('🗑 Task deleted');
    });
  },

  render() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    const st = StateManager.get();
    const { goals, taskFilter, taskTagFilter, searchQuery, sortMode } = st;
    const catFilter = st.taskCatFilter;
    const urgentOnly = st.taskUrgentOnly;

    const now=new Date(), tKey=dateKey(), tom=new Date(now); tom.setDate(tom.getDate()+1);
    const tomKey=dateKey(tom.getTime()), weekEnd=new Date(now); weekEnd.setDate(weekEnd.getDate()+7);

    let list = goals.filter(g => {
      if (g.isProject) return false; // projects shown in Projects panel only
      if (taskFilter==='done') return g.done;
      if (g.done) return false;
      if (taskFilter==='all') return true;
      if (!g.scheduledAt) return taskFilter==='today';
      const dk=dateKey(g.scheduledAt);
      if (taskFilter==='today')    return dk===tKey;
      if (taskFilter==='tomorrow') return dk===tomKey;
      if (taskFilter==='week')     return g.scheduledAt<=weekEnd.getTime();
      return true;
    });
    if (taskTagFilter) list = list.filter(g=>g.tags?.includes(taskTagFilter));
    if (catFilter) list = list.filter(g=>g.cat===catFilter || (catFilter==='life' && g.cat==='creative'));
    if (urgentOnly) list = list.filter(g=>isUrgent(g));
    if (searchQuery) { const q=searchQuery.toLowerCase(); list=list.filter(g=>g.title.toLowerCase().includes(q)||g.notes?.toLowerCase().includes(q)); }

    list.sort((a,b) => {
      if (sortMode==='priority') { const p={high:0,mid:1,low:2}; return (p[a.priority]??1)-(p[b.priority]??1); }
      if (sortMode==='cat') return (a.cat||'').localeCompare(b.cat||'');
      const aT=a.scheduledAt||Infinity, bT=b.scheduledAt||Infinity;
      if(aT!==bT) return aT-bT;
      const p={high:0,mid:1,low:2}; return (p[a.priority]??1)-(p[b.priority]??1);
    });

    const sub = document.getElementById('tasks-view-subtitle');
    if (sub) {
      const todayDone = st.history.filter(h=>dateKey(h.completedAt)===tKey).length;
      const pendingToday = goals.filter(g=>!g.done&&g.scheduledAt&&dateKey(g.scheduledAt)===tKey).length;
      sub.textContent = `${todayDone} done · ${pendingToday} due today`;
    }

    const activeBoss = (st.dailyBoss && st.dailyBoss.date === tKey && st.dailyBoss.id) ? goals.find(x => x.id === st.dailyBoss.id) : null;
    let renderedList = list;
    if (activeBoss && !activeBoss.done && taskFilter !== 'done') {
      renderedList = renderedList.filter(x => x.id !== activeBoss.id);
    }

    listEl.innerHTML = '';
    if (taskFilter !== 'done') {
      const bossSec = this._buildBossSection(goals, st.dailyBoss);
      if (bossSec) listEl.appendChild(bossSec);
    }

    if (!renderedList.length && (!activeBoss || activeBoss.done || taskFilter === 'done')) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML = `<div class="empty-icon">✨</div><div class="empty-title">${taskFilter==='done'?'No completed tasks':'No tasks here'}</div><div class="empty-sub">${taskFilter==='done'?'':'Tap New Task to add one'}</div>`;
      listEl.appendChild(emptyDiv);
      return;
    }

    renderedList.forEach(g=>listEl.appendChild(this._buildCard(g)));
  },

  _buildBossSection(goals, dailyBoss) {
    const isToday = dailyBoss && dailyBoss.date === dateKey() && dailyBoss.id;
    const bossTask = isToday ? goals.find(x => x.id === dailyBoss.id) : null;

    if (bossTask) {
      if (bossTask.done) {
        const sec = document.createElement('div');
        sec.className = 'rounded-2xl p-4 mb-3';
        sec.style.cssText = 'background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);box-shadow:0 4px 16px rgba(255,204,0,.08);';
        sec.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <span style="font-size:22px;flex:none;">👑</span>
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:11px;font-weight:700;letter-spacing:0.5px;color:#FFCC00;text-transform:uppercase;">Boss Defeated!</span>
                  <span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(255,204,0,.2);color:#FFCC00;">+3 💎</span>
                </div>
                <p style="font-size:13px;font-weight:500;text-decoration:line-through;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(bossTask.title)}</p>
              </div>
            </div>
            <button class="glass-soft glass-hover text-xs rounded-xl px-2.5 py-1 text-white/50" data-action="clear-boss" style="flex:none;">Clear</button>
          </div>`;
        sec.querySelector('[data-action="clear-boss"]')?.addEventListener('click', () => {
          StateManager.set('dailyBoss', { date: '', id: null });
          SyncManager.scheduleSync();
          this.render();
        });
        return sec;
      }

      const wrap = document.createElement('div');
      wrap.className = 'mb-4';
      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:0 4px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.5px;color:#FFCC00;text-transform:uppercase;">👑 Boss of the Day</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(255,204,0,.2);color:#FFCC00;">+3 💎 reward</span>
          </div>
          <button class="glass-soft glass-hover text-xs rounded-xl px-2 py-0.5 text-white/50" data-action="clear-boss">Change</button>
        </div>`;
      const bossCard = this._buildCard(bossTask);
      bossCard.style.border = '1px solid rgba(255,204,0,0.5)';
      bossCard.style.boxShadow = '0 4px 18px rgba(255,204,0,0.15)';
      wrap.appendChild(bossCard);
      wrap.querySelector('[data-action="clear-boss"]')?.addEventListener('click', () => {
        StateManager.set('dailyBoss', { date: '', id: null });
        SyncManager.scheduleSync();
        this.render();
      });
      return wrap;
    }

    const sec = document.createElement('div');
    sec.className = 'glass-soft rounded-2xl p-3 mb-3';
    sec.style.cssText = 'border:1px dashed rgba(255,204,0,.25);background:rgba(255,204,0,.03);';
    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span style="font-size:18px;flex:none;">👑</span>
          <div style="min-width:0;">
            <p style="font-size:12px;font-weight:600;color:#fff;">Boss of the Day</p>
            <p style="font-size:11px;color:rgba(255,255,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Conquer 1 big task (+3 💎)</p>
          </div>
        </div>
        <button class="glass-soft glass-hover text-xs font-semibold rounded-xl px-3 py-1.5" data-action="pick-suggested" style="color:#FFCC00;border:1px solid rgba(255,204,0,.35);flex:none;">Pick suggested</button>
      </div>`;
    sec.querySelector('[data-action="pick-suggested"]')?.addEventListener('click', () => {
      const pool = goals.filter(g => !g.done && !g.isProject);
      pool.sort((a,b) => {
        const p = { high: 0, mid: 1, low: 2 };
        const pd = (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
        if (pd !== 0) return pd;
        const aT = a.scheduledAt || Infinity, bT = b.scheduledAt || Infinity;
        return aT - bT;
      });
      if (pool.length) {
        StateManager.set('dailyBoss', { date: dateKey(), id: pool[0].id });
        SyncManager.scheduleSync();
        showToast(`👑 Boss of the Day: "${pool[0].title}"`);
        this.render();
      } else {
        showToast('No unfinished tasks available');
      }
    });
    return sec;
  },

  renderForDay(dayKey, dateLabel) {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    const goals = StateManager.get('goals') || [];
    let list = goals.filter(g => !g.done && g.scheduledAt && dateKey(g.scheduledAt) === dayKey);
    list.sort((a,b) => {
      const aT=a.scheduledAt||Infinity, bT=b.scheduledAt||Infinity;
      if(aT!==bT) return aT-bT;
      const p={high:0,mid:1,low:2}; return (p[a.priority]??1)-(p[b.priority]??1);
    });
    const sub = document.getElementById('tasks-view-subtitle');
    if (sub) {
      const done = goals.filter(g => g.done && g.scheduledAt && dateKey(g.scheduledAt) === dayKey).length;
      sub.textContent = `${list.length} tasks · ${done} done · ${dateLabel}`;
    }
    if (!list.length) {
      listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Nothing scheduled this day</div><div class="empty-sub">Tap New Task to add one</div></div>`;
      return;
    }
    listEl.innerHTML='';
    list.forEach(g=>listEl.appendChild(this._buildCard(g)));
  },

  _buildCard(g) {
    const card = document.createElement('div');
    const color=catColor(g), cat=catInfo(g);
    const st = StateManager.get();
    const isCurrentBoss = !!(st.dailyBoss && st.dailyBoss.date === dateKey() && st.dailyBoss.id === g.id);
    card.className = 'glass-soft glass-hover rounded-2xl p-4' + (g.done ? ' opacity-50' : '');
    card.dataset.id=g.id;
    const prio={high:'🔴',mid:'🟡',low:'⚪'}[g.priority]||'🟡';
    const hasTime=!!g.scheduledAt, isOverdue=hasTime&&!g.done&&(g.allDay ? dateKey(g.scheduledAt)<dateKey() : g.scheduledAt<Date.now());
    const subDone=(g.subtasks||[]).filter(s=>s.done).length, subTotal=(g.subtasks||[]).length;
    const tagHtml=(g.tags||[]).map(id=>{ const t=StateManager.get('tags').find(x=>x.id===id); return t?`<span class="tag" style="background:${t.color}22;color:${t.color};border-color:${t.color}44;">${esc(t.name)}</span>`:''; }).join('');
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    const pct=Math.min(100,(elapsed/((g.duration_min||DEFAULT_TIMER_MIN)*60)*100)).toFixed(1);

    card.innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <button class="chk" data-action="check" style="${g.done?'background:#FF3B30;border-color:#FF3B30;':''}">${g.done?'<span style="color:#fff;font-size:13px;">✓</span>':''}</button>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span class="tasklabel font-medium" style="${g.done?'text-decoration:line-through;opacity:.5;':''}">${esc(g.title)}</span>
            <span style="flex:none;">${isUrgent(g)?prio:''}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
            <span class="tag ${isUrgent(g)?'':'tag-grey'}">${cat.label}${catEarnsGems(g.cat)?' 💎':''}</span>
            ${hasTime?`<span class="tag-grey tag" style="${isOverdue?'color:#ff8f88;':''}">${isOverdue?'⚠ ':''}${fmtWhen(g)}</span>`:''}
            ${g.location?`<span class="tag-grey tag">📍 ${esc(g.location)}</span>`:''}
          </div>
          ${tagHtml?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">${tagHtml}</div>`:''}
          ${subTotal>0?`<div class="text-white/35 text-xs" style="margin-top:6px;">${subDone}/${subTotal} subtasks</div>`:''}
          ${(!g.done&&elapsed>0)?`<div style="height:4px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px;"><div style="height:100%;width:${pct}%;background:${color};border-radius:999px;"></div></div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex:none;">
          <button class="glass-soft glass-hover rounded-lg" data-action="boss" style="width:30px;height:30px;font-size:13px;${isCurrentBoss?'color:#FFCC00;border:1px solid rgba(255,204,0,.45);background:rgba(255,204,0,.15);':'color:rgba(255,255,255,.35);'}" title="${isCurrentBoss?'Remove as Boss':'Set as Boss of the Day'}">⭐</button>
          <button class="glass-soft glass-hover rounded-lg" data-action="timer" style="width:30px;height:30px;font-size:13px;">⏱</button>
          <button class="glass-soft glass-hover rounded-lg" data-action="edit" style="width:30px;height:30px;font-size:13px;">✎</button>
          <button class="glass-soft glass-hover rounded-lg" data-action="delete" style="width:30px;height:30px;font-size:13px;color:#ff8f88;">🗑</button>
        </div>
      </div>`;

    card.querySelector('[data-action="boss"]')?.addEventListener('click', e => {
      e.stopPropagation();
      const curBoss = StateManager.get('dailyBoss');
      if (curBoss && curBoss.date === dateKey() && curBoss.id === g.id) {
        StateManager.set('dailyBoss', { date: '', id: null });
        showToast('⭐ Boss removed');
      } else {
        StateManager.set('dailyBoss', { date: dateKey(), id: g.id });
        showToast('👑 Set as Boss of the Day!');
      }
      this.render();
      SyncManager.scheduleSync();
    });
    card.querySelector('[data-action="check"]')?.addEventListener('click',e=>{ e.stopPropagation(); this.complete(g.id); });
    card.querySelector('[data-action="timer"]')?.addEventListener('click',e=>{ e.stopPropagation(); TimerController.setGoal(g.id); ViewRouter.switchTo('focus'); });
    card.querySelector('[data-action="edit"]')?.addEventListener('click',e=>{ e.stopPropagation(); this.openModal(g.id); });
    card.querySelector('[data-action="delete"]')?.addEventListener('click',e=>{
      e.stopPropagation();
      if(!confirm(`Delete "${g.title}"?`)) return;
      StateManager.patch({goals:StateManager.get('goals').filter(x=>x.id!==g.id)});
      if (StateManager.get('activeTaskId')===g.id) StateManager.set('activeTaskId', null);
      SyncManager.scheduleSync(); this.render(); renderProjectsPanel();
      showToast('🗑 Task deleted');
    });
    card.addEventListener('click',()=>this.openDetail(g.id));
    return card;
  },

  complete(id) {
    StateManager.pushUndoSnapshot(); // snapshot BEFORE any mutation (goals are mutated in-place below)
    const st=StateManager.get();
    const g=st.goals.find(x=>x.id===id);
    if(!g) return;

    // ── ANTI-DUPE SYSTEM ──────────────────────────────────────────────
    // Запоминаем состояние ДО тоггла. Кристаллы начисляются только на
    // переходе false→true и списываются только на переходе true→false.
    // Клик по чекбоксу больше не может начислить/задвоить награду.
    const wasDone = g.done;
    g.done = !wasDone;

    if (wasDone) {
      // Задачу СНЯЛИ с выполнения — реверсим экономику.
      const hIdx = st.history.findIndex(h => h.goalId === g.id);
      const hEntry = hIdx > -1 ? st.history[hIdx] : null;
      const revert = hEntry ? ((hEntry.gems || 0) + (hEntry.bossBonus || 0) + (hEntry.comboBonus || 0)) : (catEarnsGems(g.cat) ? 1 : 0);
      const history = hIdx > -1 ? st.history.filter((_, i) => i !== hIdx) : st.history;
      // A12: revoke project bonus if project is no longer fully complete
      const bonus = settleProjectRewards(g);
      const gems = Math.max(0, st.gems - revert + bonus);
      StateManager.patch({ goals: st.goals, history, gems });
      SyncManager.scheduleSync();
      updateCrystalChips();

      if (revert > 0) {
        showPopup('gem-revert','💎',`-${revert} Crystal${revert>1?'s':''} (${gems} total)`,`"${g.title.substring(0,28)}" — un-completed`);
      } else {
        showPopup('undo','↩️','Task un-completed',`"${g.title.substring(0,28)}"`);
      }

      this.render(); renderProjectsPanel();
      if(StateManager.get('currentView')==='profile') ProfileRenderer.render();
      if(StateManager.get('currentView')==='calendar') CalendarController.render();
      if(StateManager.get('currentView')==='focus') { TimerController.tick(); TimerController.renderSpheres(); }
      return;
    }

    // Задачу ВЫПОЛНИЛИ.
    // elapsed_ms fix: fold in any time accrued while the timer was actively
    // running (g.startTime set) BEFORE snapshotting into history, so a task
    // completed mid-run never records 0m. If the timer was never started at
    // all, elapsed legitimately stays 0 — that's correct, not a bug.
    const elapsedSec = (g.elapsed||0) + (g.startTime ? (Date.now()-g.startTime)/1000 : 0);
    g.elapsed = elapsedSec; g.startTime=null; g.paused=true;

    const earnsGems = catEarnsGems(g.cat);
    const gemsEarned = earnsGems ? 1 : 0; // РЕБАЛАНС: 1 кристалл за задачу (было 3)

    const isBoss = !!(st.dailyBoss && st.dailyBoss.date === dateKey() && st.dailyBoss.id === g.id);
    const bossBonus = isBoss ? 3 : 0;

    // B4.2: Combo bonus for today's completed tasks
    const todayCompletedCount = (st.history || []).filter(h => dateKey(h.completedAt) === dateKey()).length;
    const comboCount = todayCompletedCount + 1;
    let comboBonus = 0;
    if (earnsGems) {
      if (comboCount === 3) comboBonus = 1;
      else if (comboCount >= 5) comboBonus = 2;
    }

    const history=[{ id:'h_'+Date.now().toString(36)+rnd(), goalId:g.id, title:g.title, cat:g.cat, color:catColor(g), completedAt:Date.now(), elapsed_ms:Math.max(0,Math.round(elapsedSec*1000)), gems:gemsEarned, bossBonus, comboBonus, tags:[...(g.tags||[])] }, ...st.history];
    // A12: settle any parent-project reward bonuses (pays gemsReward when all leaves done)
    const bonus = settleProjectRewards(g);
    const gems=st.gems+gemsEarned+bossBonus+comboBonus+bonus;

    let streak={...st.streak}; const today=dateKey();
    if(streak.lastDate===today) { streak.doneToday=true; }
    else { const yest=dateKey(Date.now()-86400000); streak.days=(streak.lastDate===yest)?streak.days+1:1; streak.lastDate=today; streak.doneToday=true; }
    if (streak.days > (streak.best||0)) streak.best = streak.days;

    StateManager.patch({ goals:st.goals, history, gems, streak });
    SyncManager.scheduleSync();
    updateCrystalChips();

    if (isBoss) {
      showPopup('boss-defeat','👑','Boss defeated!','+3 crystals bonus!');
      launchBossConfetti();
    }

    if (comboBonus > 0) {
      showPopup('combo', '🔥', `Combo ×${comboCount}!`, `+${comboBonus} crystal bonus`);
    }

    if (earnsGems) {
      showPopup('gem','💎',`+${gemsEarned} Crystal${gemsEarned>1?'s':''}! (${gems} total)`,`"${g.title.substring(0,28)}"`);
    } else {
      showPopup('done','✅','Task completed',`"${g.title.substring(0,28)}" — no crystal for this category`);
    }
    const msg=streak.days===1?'Streak started!':`${streak.days} days in a row — on fire!`;
    showPopup('fire','🔥',msg,'Streak saved');
    if(earnsGems && gems%10===0) showPopup('milestone','🏆',`${gems} crystals`,['Just a machine!','Legend!','Unstoppable!'][Math.floor(gems/10-1)%3]||'On fire!');

    const flash=document.getElementById('done-flash'); if(flash){flash.classList.add('show'); flash.style.opacity='1'; setTimeout(()=>{flash.style.opacity='0';},700);}
    try { TimerController.stopAlarm(id); } catch(_){}

    this.render(); renderProjectsPanel();
    if(StateManager.get('currentView')==='profile') ProfileRenderer.render();
    if(StateManager.get('currentView')==='calendar') CalendarController.render();
    if(StateManager.get('currentView')==='focus') { TimerController.tick(); TimerController.renderSpheres(); FocusHistoryRenderer.render(); }
    checkAchievements();
  },

  openModal(id=null, opts={}) {
    StateManager.set('editingTaskId',id);
    const g=id?StateManager.get('goals').find(x=>x.id===id):null;
    this._selectedColor=g?.color||'';
    this._selectedTags=g?[...(g.tags||[])]:[];
    this._selectedReminders=g?[...(g.reminders||[])]:[];
    this._participants=g?[...(g.participants||[])]:[];
    this._subtasks=g?JSON.parse(JSON.stringify(g.subtasks||[])):[];
    this._activeCat=g?.cat||'business';
    this._selectedType=g?.isEvent ? 'event' : 'task';
    this._selectedRecurrence=g?.recurrence ? JSON.parse(JSON.stringify(g.recurrence)) : null;

    const titleEl = document.getElementById('taskModalTitle');
    if (titleEl) titleEl.textContent = g ? 'Edit Task' : 'New Task';

    const titleInp=document.getElementById('task-title-input');
    const dateInp=document.getElementById('task-date-input');
    const fromInp=document.getElementById('task-time-from-input');
    const toInp=document.getElementById('task-time-to-input');
    const budgetInp=document.getElementById('task-budget-input');
    const notesInp=document.getElementById('task-notes-input');
    const parentSel=document.getElementById('task-parent-select');
    const locationInp=document.getElementById('task-location-input');

    if (titleInp) titleInp.value = g?.title || '';
    if (dateInp) {
      if (g?.scheduledAt) { const d=new Date(g.scheduledAt); dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
      else { const d=new Date(); dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    }
    if (fromInp) {
      if (g && !g.allDay && g.scheduledAt) { const d=new Date(g.scheduledAt); fromInp.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
      else fromInp.value = '';
    }
    if (toInp) {
      if (g?.scheduledAt && g.duration_min) { const end=new Date(g.scheduledAt + g.duration_min*60000); toInp.value = `${pad(end.getHours())}:${pad(end.getMinutes())}`; }
      else toInp.value = '';
    }
    if (budgetInp) budgetInp.value = g?.cost || '';
    if (notesInp) notesInp.value = g?.notes || '';
    if (locationInp) locationInp.value = g?.location || '';

    // Focus duration (min) — filled for tasks; overridden by time-to if event provides range
    const durationInp = document.getElementById('task-duration-input');
    if (durationInp) durationInp.value = g?.duration_min || DEFAULT_TIMER_MIN;

    // Presets from click-to-create (e.g. clicking on calendar grid slot)
    if (!id && opts.presetType) this._selectedType = opts.presetType;
    if (!id && opts.presetScheduledAt) {
      const pd = new Date(opts.presetScheduledAt);
      if (dateInp) dateInp.value = `${pd.getFullYear()}-${pad(pd.getMonth()+1)}-${pad(pd.getDate())}`;
      if (fromInp) fromInp.value = `${pad(pd.getHours())}:${pad(pd.getMinutes())}`;
    }

    // Prefill from DictationController Draft Board (B1.4)
    if (!id && opts.prefill) {
      const pf = opts.prefill;
      if (pf.title && titleInp) titleInp.value = pf.title;
      if (pf.notes && notesInp) notesInp.value = pf.notes;
      if (pf.location && locationInp) locationInp.value = pf.location;
      if (pf.kind) this._selectedType = pf.kind;
      if (pf.cat) this._activeCat = pf.cat;
      if (pf.date && dateInp) dateInp.value = pf.date;
      if (pf.time && fromInp) fromInp.value = pf.time;
      if (pf.timeTo && toInp) toInp.value = pf.timeTo;
      if (pf.duration_min && durationInp) durationInp.value = pf.duration_min;
      if (Array.isArray(pf.tags)) {
        const allTags = StateManager.get('tags') || [];
        this._selectedTags = pf.tags.map(t => {
          const found = allTags.find(x => x.name.toLowerCase() === String(t).toLowerCase() || x.id === t);
          return found ? found.id : t;
        });
      }
      if (Array.isArray(pf.reminders)) this._selectedReminders = [...pf.reminders];
      if (pf.recurrence) this._selectedRecurrence = JSON.parse(JSON.stringify(pf.recurrence));
    }

    // Priority buttons
    const prefillPrio = opts.prefill?.priority ? (opts.prefill.priority === 'medium' ? 'mid' : opts.prefill.priority) : null;
    const targetPriority = (!id && prefillPrio) || g?.priority || 'mid';
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>{
      const active = targetPriority===btn.dataset.priority;
      btn.style.background = active ? 'rgba(255,59,48,.18)' : 'rgba(255,255,255,.05)';
      btn.style.color = active ? '#fff' : 'rgba(255,255,255,.5)';
      btn.classList.toggle('active', active);
    });

    // Parent (Project/Folder) select
    if (parentSel) {
      const opts2 = buildParentOptionsFlat(id || null);
      parentSel.innerHTML = `<option value="">None</option>` + opts2.map(o=>`<option value="${o.id}">${esc(o.label)}</option>`).join('');
      parentSel.value = g?.parentId || opts.presetParentId || '';
    }

    this._renderTypeRow();
    this._renderCategoryRow();
    this._renderColorRow();
    this._renderTagRow();
    this._renderRemindersRow();
    this._renderSubtasks();
    this._renderRecurrenceUI();

    const saveBtn = document.getElementById('btn-task-save');
    if (saveBtn) saveBtn.textContent = g ? 'Save Task' : 'Create Task';
    document.getElementById('btn-delete-task')?.classList.toggle('hidden', !g);

    openModal('taskModal');
    this._syncFieldVisibility();
    setTimeout(()=>titleInp?.focus(),120);
  },

  _renderCategoryRow() {
    const wrap = document.getElementById('task-category-row');
    if (!wrap) return;
    wrap.innerHTML = CAT_ORDER.map(key => {
      const c = CATS[key];
      const active = this._activeCat===key;
      return `<button type="button" class="tag glass-hover" data-cat="${key}" style="${active?`background:${c.color}22;border-color:${c.color}66;color:#fff;`:'background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);'}">${c.label}${c.earnsGems?' 💎':''}</button>`;
    }).join('');
    wrap.querySelectorAll('[data-cat]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ this._activeCat = btn.dataset.cat; this._renderCategoryRow(); });
    });
  },

  _renderTagRow() {
    const wrap = document.getElementById('task-tags-row');
    if (!wrap) return;
    const customTags = StateManager.get('tags').map(t => {
      const active = this._selectedTags.includes(t.id);
      return `<button type="button" class="tag glass-hover" data-tagid="${t.id}" style="${active?`background:${t.color}33;border-color:${t.color};color:#fff;`:'background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);'}">${esc(t.name)}</button>`;
    }).join('');
    wrap.innerHTML = customTags + `<button type="button" id="btn-quick-new-tag" class="tag-grey tag glass-hover">+ New</button>`;
    wrap.querySelectorAll('[data-tagid]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=btn.dataset.tagid;
        if(this._selectedTags.includes(id)) this._selectedTags=this._selectedTags.filter(x=>x!==id);
        else this._selectedTags.push(id);
        this._renderTagRow();
      });
    });
    wrap.querySelector('#btn-quick-new-tag')?.addEventListener('click', ()=>{
      const name = prompt('New tag name:'); if(!name) return;
      const tags=[...StateManager.get('tags')];
      const t = { id:'tag_'+Date.now().toString(36)+rnd(), name, color:TAG_PALETTE[tags.length%TAG_PALETTE.length] };
      tags.push(t); StateManager.set('tags', tags);
      this._selectedTags.push(t.id);
      this._renderTagRow();
    });
  },

  _renderTypeRow() {
    const wrap = document.getElementById('type-ctrl');
    if (!wrap) return;
    wrap.querySelectorAll('[data-type]').forEach(btn => {
      const active = this._selectedType === btn.dataset.type;
      btn.style.background = active ? 'rgba(255,59,48,.18)' : 'rgba(255,255,255,.05)';
      btn.style.color = active ? '#fff' : 'rgba(255,255,255,.5)';
      btn.classList.toggle('active', active);
      btn.onclick = () => { this._selectedType = btn.dataset.type; this._renderTypeRow(); this._syncFieldVisibility(); };
    });
  },

  _syncFieldVisibility() {
    const isEvent = this._selectedType === 'event';
    document.getElementById('task-time-to-wrap')?.classList.toggle('hidden', !isEvent);
    document.getElementById('event-recurrence-section')?.classList.toggle('hidden', !isEvent);
    const fromLbl = document.getElementById('task-time-from-label');
    if (fromLbl) fromLbl.textContent = isEvent ? 'Time from' : 'Time (optional)';
    const fromInp = document.getElementById('task-time-from-input');
    if (isEvent && fromInp && !fromInp.value) {
      const nextH = (new Date().getHours() + 1) % 24;
      fromInp.value = `${pad(nextH)}:00`;
    }
    if (!isEvent) this._selectedRecurrence = null;
  },

  _renderRecurrenceUI() {
    const toggleEl = document.getElementById('task-recurrence-toggle');
    const bodyEl   = document.getElementById('task-recurrence-body');
    const daysRow  = document.getElementById('task-recurrence-days-row');
    const untilInp = document.getElementById('task-recurrence-until-input');
    if (!toggleEl || !bodyEl || !daysRow) return;

    const recOn = !!this._selectedRecurrence;
    toggleEl.classList.toggle('on', recOn);
    bodyEl.classList.toggle('hidden', !recOn);

    // Wire toggle button (replaces any prior listener by overwriting onclick)
    toggleEl.onclick = () => {
      if (this._selectedRecurrence) {
        this._selectedRecurrence = null;
      } else {
      this._selectedRecurrence = { days:[1,2,3,4,5], until:null, exceptions:[] };
      }
      this._renderRecurrenceUI();
    };

    if (!recOn || !daysRow) return;
    const labels = ['M','T','W','T','F','S','S'];
    daysRow.innerHTML = labels.map((l,i) => {
      const dayNum = i + 1;
      const active = this._selectedRecurrence?.days?.includes(dayNum);
      return `<button type="button" class="w-10 h-10 rounded-xl text-sm font-medium glass-hover" data-rday="${dayNum}" style="${active?'background:linear-gradient(145deg,#FF3B30,#b71f16);color:#fff;':'background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);'}">${l}</button>`;
    }).join('');
    daysRow.querySelectorAll('[data-rday]').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = parseInt(btn.dataset.rday);
        if (!this._selectedRecurrence) return;
        if (this._selectedRecurrence.days.includes(d)) {
          this._selectedRecurrence.days = this._selectedRecurrence.days.filter(x => x !== d);
        } else {
          this._selectedRecurrence.days.push(d);
          this._selectedRecurrence.days.sort();
        }
        this._renderRecurrenceUI();
      });
    });

    if (untilInp) {
      untilInp.value = this._selectedRecurrence?.until
        ? parseDateSafe(this._selectedRecurrence.until).toISOString().slice(0,10)
        : '';
      untilInp.onchange = (e) => {
        if (!this._selectedRecurrence) return;
        this._selectedRecurrence.until = e.target.value
          ? new Date(e.target.value + 'T00:00:00').getTime()
          : null;
      };
    }
  },

  _renderColorRow() {
    const wrap = document.getElementById('task-color-row');
    if (!wrap) return;
    // Add a "None / category default" option first
    const noneActive = !this._selectedColor;
    const noneBtn = `<button type="button" data-color="" style="width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,.12);border:2px solid ${noneActive?'#fff':'transparent'};box-shadow:${noneActive?'0 0 0 2px rgba(255,255,255,.5)':'none'};transition:border-color .2s,box-shadow .2s;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.6);" title="Category default">×</button>`;
    const swatches = COLOR_PALETTE.map(c => {
      const active = this._selectedColor === c;
      return `<button type="button" data-color="${c}" style="width:28px;height:28px;border-radius:999px;background:${c};border:2px solid ${active?'#fff':'transparent'};box-shadow:${active?`0 0 0 2px ${c}88`:'none'};transition:border-color .2s,box-shadow .2s;cursor:pointer;" title="${c}"></button>`;
    }).join('');
    wrap.innerHTML = noneBtn + swatches;
    wrap.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectedColor = btn.dataset.color;
        this._renderColorRow();
      });
    });
  },

  _renderRemindersRow() {
    const wrap = document.getElementById('task-reminders-row');
    if (!wrap) return;
    const labels = { 1:'1 min', 5:'5 min', 15:'15 min', 30:'30 min', 60:'1 hour', 1440:'1 day' };
    wrap.innerHTML = REMINDER_OPTIONS.map(v => {
      const active = this._selectedReminders.includes(v);
      return `<button type="button" class="tag glass-hover" data-reminder="${v}" style="${active?'background:rgba(255,59,48,.22);border-color:rgba(255,59,48,.6);color:#fff;':'background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);'}">${labels[v]||v+' min'}</button>`;
    }).join('');
    wrap.querySelectorAll('[data-reminder]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = parseInt(btn.dataset.reminder);
        if (this._selectedReminders.includes(v)) this._selectedReminders = this._selectedReminders.filter(x => x !== v);
        else this._selectedReminders.push(v);
        this._renderRemindersRow();
      });
    });
  },

  save() {
    const titleInp=document.getElementById('task-title-input');
    const title = titleInp?.value.trim();
    if(!title){showToast('Enter a task title'); return;}
    const prioBtn = document.querySelector('#priority-ctrl .seg-btn.active');
    const cat = this._activeCat || 'business';
    const dateVal = document.getElementById('task-date-input')?.value;
    const startVal = document.getElementById('task-time-from-input')?.value;
    const endVal = document.getElementById('task-time-to-input')?.value;
    const parentId = document.getElementById('task-parent-select')?.value || null;
    const isEventType = this._selectedType === 'event';
    let scheduledAt = null, allDay = false;
    if (dateVal) {
      const [dy,dm,dd]=dateVal.split('-').map(Number);
      if (startVal) { const [th,tm]=startVal.split(':').map(Number); scheduledAt = new Date(dy,dm-1,dd,th,tm,0,0).getTime(); }
      else { scheduledAt = new Date(dy,dm-1,dd,23,59,0,0).getTime(); allDay = true; }
    }
    if (isEventType && !startVal) { showToast('Set a start time for the event'); return; }

    // Duration: read from explicit input first, then override with event time range if provided
    const durationInpEl = document.getElementById('task-duration-input');
    const durationInpVal = parseInt(durationInpEl?.value || '', 10);
    let durMin = Number.isFinite(durationInpVal) && durationInpVal > 0 ? durationInpVal : DEFAULT_TIMER_MIN;
    if (isEventType && startVal && endVal) {
      const [sh, sm] = startVal.split(':').map(Number);
      const [eh, em] = endVal.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff>0) durMin = diff;
    }
    const id=StateManager.get('editingTaskId');
    const notesInp = document.getElementById('task-notes-input');
    const budgetInp = document.getElementById('task-budget-input');
    const recurrence = (isEventType && this._selectedRecurrence && this._selectedRecurrence.days?.length)
      ? { days: [...this._selectedRecurrence.days], until: this._selectedRecurrence.until || null, exceptions: this._selectedRecurrence.exceptions || [] }
      : null;
    const data={
      title, notes: notesInp?.value.trim()||'',
      priority: prioBtn?.dataset.priority||'mid', cat, scheduledAt, duration_min:durMin,
      isEvent: isEventType,
      allDay: allDay && !isEventType,
      isProject: false,
      parentId: parentId || null,
      recurrence,
      location: document.getElementById('task-location-input')?.value.trim() || '',
      travelTime:0,
      cost: parseFloat(budgetInp?.value||'0'),
      tags:[...this._selectedTags], reminders:[...this._selectedReminders], participants:[...this._participants],
      color:this._selectedColor, subtasks:this._subtasks.filter(st=>st.text.trim()).map(st=>({...st,id:st.id||('st'+Date.now()+rnd())})),
    };
    // Never mutate a live goal object in place — always replace via a
    // fresh array so StateManager's shallow-clone semantics can't leak
    // an in-progress edit back into the rendered UI before save() commits.
    const prevGoals = StateManager.get('goals');
    let goals;
    if (id) {
      goals = prevGoals.map(g => g.id===id ? { ...g, ...data } : g);
    } else {
      goals = [{id:'g_'+Date.now().toString(36)+rnd(), done:false, elapsed:0, startTime:null, paused:false, createdAt:Date.now(), ...data}, ...prevGoals];
    }
    StateManager.patch({goals});
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    closeModal('taskModal');
    this.render();
    renderProjectsPanel();
    if (StateManager.get('currentView')==='calendar') CalendarController.render();
    showToast(id?'✅ Task updated':'✅ Task created');
  },

  delete() {
    const id=StateManager.get('editingTaskId'); if(!id) return;
    if(!confirm('Delete this task?')) return;
    StateManager.patch({goals:StateManager.get('goals').filter(g=>g.id!==id)});
    if (StateManager.get('activeTaskId')===id) StateManager.set('activeTaskId', null);
    SyncManager.scheduleSync(); closeModal('taskModal'); this.render(); renderProjectsPanel(); showToast('🗑 Task deleted');
  },

  openDetail(id) {
    StateManager.set('detailTaskId',id);
    const g=StateManager.get('goals').find(x=>x.id===id); if(!g) return;
    const titleEl=document.getElementById('td-title'); if(titleEl) titleEl.textContent=g.title;
    const body=document.getElementById('task-detail-body'); if(!body) return;
    const cat=catInfo(g), color=catColor(g);
    const tagHtml=(g.tags||[]).map(id=>{ const t=StateManager.get('tags').find(x=>x.id===id); return t?`<span class="tag" style="background:${t.color}22;color:${t.color};border-color:${t.color}44;">${esc(t.name)}</span>`:''; }).join('');
    const subHtml=(g.subtasks||[]).map(st=>`<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.6);padding:4px 0;${st.done?'text-decoration:line-through;opacity:.5;':''}"><span>${st.done?'✓':'○'}</span><span>${esc(st.text)}</span></div>`).join('');
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    const totalSec=(g.duration_min||DEFAULT_TIMER_MIN)*60, pct=Math.min(100,Math.round(elapsed/totalSec*100));
    const parent = g.parentId ? StateManager.get('goals').find(x=>x.id===g.parentId) : null;
    body.innerHTML=`
      <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:${color}">${cat.emoji} ${cat.label}${catEarnsGems(g.cat)?' · 💎 earns crystals':''}</div>
      ${parent?`<div style="display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px;"><span>🗂️</span><span>${esc(parent.title)}</span></div>`:''}
      ${g.scheduledAt?`<div style="display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px;"><span>📅</span><span>${fmtWhen(g)}</span></div>`:''}
      ${g.duration_min?`<div style="display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px;"><span>⏱</span><span>${g.duration_min} min</span></div>`:''}
      ${g.cost?`<div style="display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px;"><span>💰</span><span>$${g.cost}</span></div>`:''}
      ${g.notes?`<div style="font-size:13px;color:rgba(255,255,255,.6);background:rgba(255,255,255,.04);padding:10px 12px;border-radius:12px;margin-top:8px;">${esc(g.notes)}</div>`:''}
      ${tagHtml?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:12px;">${tagHtml}</div>`:''}
      ${subHtml?`<div style="margin-top:10px;">${subHtml}</div>`:''}
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
        <div style="flex:1;height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;"><div style="height:100%;border-radius:999px;width:${pct}%;background:${color}"></div></div>
        <span style="font-size:12px;font-weight:600;color:#ff8f88;">${pct}%</span>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:8px;">Elapsed: ${fmtD(elapsed)}</div>`;
    document.getElementById('btn-td-done').style.display = g.done ? 'none' : '';
    openModal('taskDetailModal');
  },

  _renderSubtasks() {
    const list=document.getElementById('subtask-input-list'); if(!list) return;
    list.innerHTML=this._subtasks.map((st,i)=>`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input class="field" type="text" value="${esc(st.text)}" placeholder="Subtask…" data-i="${i}" style="flex:1;"><button type="button" class="st-del" data-i="${i}" style="background:rgba(255,255,255,.08);border:none;color:#fff;width:32px;height:32px;border-radius:10px;cursor:pointer;flex:none;">✕</button></div>`).join('');
    list.querySelectorAll('.st-del').forEach(btn=>{ btn.addEventListener('click',()=>{ this._subtasks.splice(parseInt(btn.dataset.i),1); this._renderSubtasks(); }); });
    list.querySelectorAll('input').forEach(inp=>{ inp.addEventListener('input',e=>{ this._subtasks[parseInt(e.target.dataset.i)].text=e.target.value; }); });
  },
  addSubtaskRow() { this._subtasks.push({id:'st_'+Date.now()+rnd(),text:'',done:false}); this._renderSubtasks(); document.getElementById('subtask-input-list')?.querySelector('div:last-child input')?.focus(); },
};

/* ═══════════════════════════════════════════════════════════
   TAG FILTER ROW  (tasks view)
═══════════════════════════════════════════════════════════ */
function renderTagFilterRow() {
  const row=document.getElementById('tag-filter-row'); if(!row) return;
  const tagFilter=StateManager.get('taskTagFilter');
  const tags = StateManager.get('tags');
  if (!tags.length) { row.innerHTML=''; return; }
  row.innerHTML=tags.map(t=>`<button class="tag-grey tag glass-hover" data-id="${t.id}" style="${tagFilter===t.id?`border-color:${t.color};color:${t.color};background:${t.color}1a;`:''}">${esc(t.name)}</button>`).join('');
  row.querySelectorAll('[data-id]').forEach(btn=>{
    btn.addEventListener('click',()=>{ StateManager.set('taskTagFilter',StateManager.get('taskTagFilter')===btn.dataset.id?null:btn.dataset.id); renderTagFilterRow(); TaskController.render(); });
  });
}

/* ═══════════════════════════════════════════════════════════
   CRYSTAL / STREAK CHIP SYNC
═══════════════════════════════════════════════════════════ */
function updateCrystalChips() {
  const gems = StateManager.get('gems');
  const streak = StateManager.get('streak');
  const formatted = gems.toLocaleString('en-US');

  const sidebarGems = document.getElementById('sidebar-gems'); if (sidebarGems) sidebarGems.textContent = formatted;
  const focusGems = document.getElementById('focus-gems'); if (focusGems) focusGems.textContent = formatted;
  const focusStreak = document.getElementById('focus-streak'); if (focusStreak) focusStreak.textContent = streak.days;
  const shopGems = document.getElementById('shop-gems'); if (shopGems) shopGems.textContent = formatted;
}

function layoutOverlaps(items) {
  const out = new Map(); let cluster = [], clusterEnd = 0;
  const flush = () => {
    const colsEnd = [];
    cluster.forEach(g => {
      const s = g.scheduledAt, e = s + (g.duration_min||DEFAULT_TIMER_MIN)*60000;
      let c = colsEnd.findIndex(end => end <= s);
      if (c === -1) { c = colsEnd.length; colsEnd.push(e); } else colsEnd[c] = e;
      out.set(g.id, { col: c, cols: 1 });
    });
    cluster.forEach(g => out.get(g.id).cols = colsEnd.length);
    cluster = [];
  };
  items.forEach(g => {
    const s = g.scheduledAt, e = s + (g.duration_min||DEFAULT_TIMER_MIN)*60000;
    if (cluster.length && s >= clusterEnd) { flush(); clusterEnd = 0; }
    cluster.push(g); clusterEnd = Math.max(clusterEnd, e);
  });
  flush(); return out;
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR CONTROLLER (with drag & drop rescheduling)
═══════════════════════════════════════════════════════════ */
const CalendarController = {
  _calDate: new Date(), _view: 'day', _nowTimer: null, _yearDate: new Date(),
  _dragGoalId: null, _didAutoScroll: false,
  _pendingGhost: null,   // 3.5 — ghost being edited in choice dialog
  // ── Layout constants ──────────────────────────────────────
  PX_PER_MIN: 1,   // 1440px total height = 24 h × 60 min
  SNAP_MIN:   10,  // pointer drag/resize snaps to 10-min grid
  MIN_H:      20,  // minimum card height in pixels

  // ── Undo/Redo ─────────────────────────────────────────────
  _undoStack: [],
  _redoStack: [],
  MAX_UNDO: 50,

  init() {
    StateManager.subscribe(()=>{ if(StateManager.get('currentView')==='calendar') this.render(); });
    document.getElementById('cal-prev')?.addEventListener('click', ()=>this.prev());
    document.getElementById('cal-next')?.addEventListener('click', ()=>this.next());
    document.getElementById('cal-today')?.addEventListener('click', ()=>{ this._calDate=new Date(); this._yearDate=new Date(); this._didAutoScroll=false; this.render(); });
    document.getElementById('btn-undo')?.addEventListener('click', ()=>this.undo());
    document.getElementById('btn-redo')?.addEventListener('click', ()=>this.redo());
    document.addEventListener('keydown', (e)=>{
      // Don't capture in text inputs
      const tag = document.activeElement?.tagName;
      if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||document.activeElement?.isContentEditable) return;
      if ((e.metaKey||e.ctrlKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      if ((e.metaKey||e.ctrlKey) && (e.key==='y' || (e.key==='z'&&e.shiftKey))) { e.preventDefault(); this.redo(); }
    });
    document.querySelectorAll('#calTabs .subtab').forEach(t => {
      t.addEventListener('click', () => switchSub('calTabs','cal', t.dataset.cal));
    });
    // 3.5 — Ghost edit choice dialog buttons
    document.getElementById('btn-ghost-edit-this')?.addEventListener('click', () => {
      closeModal('ghostEditChoiceModal');
      if (!this._pendingGhost) return;
      this._splitGhostIntoException(this._pendingGhost, { openEditor: true });
      this._pendingGhost = null;
    });
    document.getElementById('btn-ghost-edit-following')?.addEventListener('click', () => {
      closeModal('ghostEditChoiceModal');
      if (!this._pendingGhost) return;
      // Edit all following — just open the master event editor
      TaskController.openModal(this._pendingGhost.ghostOf);
      this._pendingGhost = null;
    });
    this._updateUndoRedoButtons();
    // 1.4 — Start in Day on mobile, Week on desktop
    const startView = window.innerWidth < 768 ? 'day' : 'week';
    this._view = startView;
    switchSub('calTabs', 'cal', startView);
  },

  setView(v) {
    this._didAutoScroll = false;
    this._view = v;
    document.querySelectorAll('#calTabs .subtab').forEach(b=>{
      const on = b.dataset.cal === v;
      b.classList.toggle('active', on);
      b.classList.toggle('text-white/50', !on);
    });
    this.render();
  },

  prev() {
    this._didAutoScroll = false;
    if(this._view==='year') { this._yearDate.setFullYear(this._yearDate.getFullYear()-1); this.render(); return; }
    if(this._view==='month') this._calDate.setMonth(this._calDate.getMonth()-1);
    else if(this._view==='week') this._calDate.setDate(this._calDate.getDate()-7);
    else this._calDate.setDate(this._calDate.getDate()-1);
    this.render();
  },
  next() {
    this._didAutoScroll = false;
    if(this._view==='year') { this._yearDate.setFullYear(this._yearDate.getFullYear()+1); this.render(); return; }
    if(this._view==='month') this._calDate.setMonth(this._calDate.getMonth()+1);
    else if(this._view==='week') this._calDate.setDate(this._calDate.getDate()+7);
    else this._calDate.setDate(this._calDate.getDate()+1);
    this.render();
  },

  _updateHeaderTitle(text) {
    const h1 = document.getElementById('calendar-header-title');
    if (h1) h1.textContent = text;
  },

  render() {
    try {
      if (this._view==='day')   this._renderDay();
      else if (this._view==='week')  this._renderWeek();
      else if (this._view==='month') this._renderMonth();
      else if (this._view==='year')  this._renderYear();
    } catch(e) { console.error('[CalendarController.render]', e); showToast('⚠️ Ошибка отображения'); }
  },

  _navigateToDay(dk) {
    const [y,m,d] = dk.split('-').map(Number);
    const label = new Date(y,m-1,d).toLocaleDateString('en-US',{day:'numeric',month:'long',weekday:'short'});
    ViewRouter.switchTo('tasks');
    StateManager.set('taskFilter','all');
    document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(b=>{
      const on = b.dataset.filter==='all';
      b.classList.toggle('active', on);
      b.style.background = on ? 'rgba(255,59,48,.18)' : 'transparent';
      b.style.color = on ? '#fff' : 'rgba(255,255,255,.5)';
    });
    TaskController.renderForDay(dk, label);
  },

  // ── Rescheduling helpers ──────────────────────────────────

  // Used by month-grid drop: keep time-of-day, change date only
  _rescheduleGoalToDate(goalId, targetDate) {
    const goals = StateManager.get('goals');
    const g = goals.find(x=>x.id===goalId);
    if (!g || !g.scheduledAt) return;
    const old = new Date(g.scheduledAt);
    const next = parseDateSafe(targetDate);
    if (!next) return; // safety guard for invalid date strings
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    const updated = goals.map(x => x.id===goalId ? { ...x, scheduledAt: next.getTime() } : x);
    StateManager.pushUndoSnapshot();
    StateManager.patch({ goals: updated });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    this.render();
    if (StateManager.get('currentView')==='tasks') TaskController.render();
    showToast(`📅 Moved to ${next.toLocaleDateString('en-US',{day:'numeric',month:'short'})}`, 1400);
  },

  // Used by month-grid: change date + hour (legacy)
  _rescheduleGoalToDateTime(goalId, targetDate, hour) {
    const goals = StateManager.get('goals');
    const g = goals.find(x=>x.id===goalId);
    if (!g || !g.scheduledAt) return;
    const old = new Date(g.scheduledAt);
    const next = new Date(targetDate);
    next.setHours(hour, old.getMinutes(), 0, 0);
    const updated = goals.map(x => x.id===goalId ? { ...x, scheduledAt: next.getTime() } : x);
    StateManager.patch({ goals: updated });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    this.render();
    if (StateManager.get('currentView')==='tasks') TaskController.render();
    showToast(`📅 Rescheduled to ${fmtDateTime(next.getTime())}`, 1400);
  },

  // Used by pointer drag-drop in day/week absolute grids
  _rescheduleGoalToTimestamp(goalId, newTs, newDurMin=null, _pushToUndo=true) {
    const goals = StateManager.get('goals');
    const g = goals.find(x=>x.id===goalId);
    if (!g) return;
    const patch = {};
    if (newTs !== null) patch.scheduledAt = newTs;
    if (newDurMin !== null) patch.duration_min = Math.max(this.SNAP_MIN, newDurMin);
    if (!Object.keys(patch).length) return;
    if (_pushToUndo) {
      StateManager.pushUndoSnapshot(); // centralized snapshot — covers goals+history+gems+streak
    }
    const updated = goals.map(x => x.id===goalId ? { ...x, ...patch } : x);
    StateManager.patch({ goals: updated });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    this.render();
    if (StateManager.get('currentView')==='tasks') TaskController.render();
  },

  // ── Undo/Redo — delegates to centralized StateManager ─────

  _pushUndo() { /* no-op: superseded by StateManager.pushUndoSnapshot() */ },
  _applyGoalPatch(goalId, patch) {
    const goals = StateManager.get('goals');
    const updated = goals.map(g => g.id===goalId ? {...g, ...patch} : g);
    StateManager.patch({ goals: updated });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    this.render();
    if (StateManager.get('currentView')==='tasks') TaskController.render();
  },

  undo() {
    if (StateManager.undo()) showToast('↩ Undone', 1200);
  },

  redo() {
    if (StateManager.redo()) showToast('↪ Redone', 1200);
  },

  _updateUndoRedoButtons() {
    _updateUndoRedoBtns();
  },

  // ── Pointer-based drag & resize ───────────────────────────

  // Attach pointer drag to a card. gridEl must have position:relative and
  // know its date (via data-date-ms attribute set by caller).
  _attachPointerDrag(cardEl, goalId, gridEl, handleEl=null, ghostObj=null) {
    // Touch-action and user-select are set inside beginDrag for touch,
    // immediately for mouse. We leave them unset here so normal scrolling
    // is not blocked before a long-press is confirmed.

    cardEl.addEventListener('pointerdown', (e) => {
      // Ignore clicks on the resize handle
      if (e.target.classList.contains('cal-resize-handle')) return;
      // Only primary button / single touch
      if (e.button && e.button !== 0) return;

      const isTouch = e.pointerType === 'touch';
      // If pointerdown is on the drag-handle element, start drag immediately
      const isHandle = handleEl && (e.target === handleEl || handleEl.contains(e.target));
      const LONG_PRESS_MS = 400;  // БАГ 3.4: снижено с 1000ms → 400ms; мышь теперь тоже ждёт задержки
      const PX = this.PX_PER_MIN;
      const SNAP = this.SNAP_MIN;
      const MOVE_TOLERANCE = 8; // px allowed before we decide it's a scroll

      // Starting offset inside the card (capture at pointerdown)
      const cardRect = cardEl.getBoundingClientRect();
      const offsetY  = e.clientY - cardRect.top;
      const startX   = e.clientX;
      const startY   = e.clientY;

      const g = ghostObj || StateManager.get('goals').find(x=>x.id===goalId);
      if (!g || !g.scheduledAt) return;

      // For week view, remember which day columns exist so we can switch horizontally
      const dayColEls   = gridEl.closest('[id="weekGrid"]')
        ? gridEl.closest('[id="weekGrid"]').querySelectorAll('[data-col-date-ms]')
        : gridEl.querySelectorAll('[data-col-date-ms]');
      const isWeekView  = dayColEls.length > 0;

      let currentTopPx    = parseFloat(cardEl.style.top) || 0;
      let targetColEl     = gridEl;  // current visual parent column (week view)
      let targetDateMs    = parseInt(gridEl.dataset.colDateMs || gridEl.dataset.dateMs || this._calDate.getTime());
      let moved           = false;
      let longPressTimer  = null;
      let dragStarted     = false;

      // ── helpers ──────────────────────────────────────────────
      const getTargetDayColumn = (clientX) => {
        if (!isWeekView || !dayColEls.length) return null;
        // Use first/last column rects to determine grid range, then interpolate
        const firstRect = dayColEls[0].getBoundingClientRect();
        const lastRect  = dayColEls[dayColEls.length - 1].getBoundingClientRect();
        const gridLeft  = firstRect.left;
        const gridRight = lastRect.right;
        const relX      = Math.max(0, Math.min(gridRight - gridLeft, clientX - gridLeft));
        const colWidth  = (gridRight - gridLeft) / dayColEls.length;
        let idx = Math.floor(relX / colWidth);
        idx = Math.max(0, Math.min(dayColEls.length - 1, idx));
        return { idx, colEl: dayColEls[idx] };
      };

      const beginDrag = () => {
        dragStarted = true;
        cardEl.style.touchAction = 'none';
        cardEl.style.userSelect  = 'none';
        cardEl.classList.add('dragging-active');
        cardEl.setPointerCapture(e.pointerId);
        cardEl.style.opacity = '0.75';
        cardEl.style.zIndex  = '20';
        cardEl.addEventListener('pointermove', onMove);
        cardEl.addEventListener('pointerup',   onUp);
      };

      const cancelPending = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        document.removeEventListener('pointermove', earlyMoveCheck);
        document.removeEventListener('pointerup',   earlyCancel);
        document.removeEventListener('pointercancel', cancelPending);
      };

      // ── early-move / early-cancel (before drag is confirmed) ─
      const earlyMoveCheck = (moveE) => {
        if (dragStarted) return;
        const dx = Math.abs(moveE.clientX - startX);
        const dy = Math.abs(moveE.clientY - startY);
        if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancelPending(); // treat as scroll
      };
      const earlyCancel = (upE) => {
        if (dragStarted) return;
        const wasTap = longPressTimer !== null && Math.abs(upE.clientX-startX)<=MOVE_TOLERANCE && Math.abs(upE.clientY-startY)<=MOVE_TOLERANCE;
        cancelPending();
        if (wasTap) { if (ghostObj) this._openGhostEditChoice(ghostObj); else TaskController.openDetail(goalId); }
      };

      // ── main drag handlers ────────────────────────────────────
      const onMove = (ev) => {
        ev.preventDefault();
        const gridRect = gridEl.getBoundingClientRect();
        const rawMin   = (ev.clientY - gridRect.top - offsetY) / PX;
        const snapped  = Math.max(0, Math.min(23*60+50, Math.round(rawMin / SNAP) * SNAP));
        currentTopPx   = snapped * PX;
        cardEl.style.top = currentTopPx + 'px';
        moved = true;

        // Week view: move card into the correct day column visually
        if (isWeekView) {
          const target = getTargetDayColumn(ev.clientX);
          if (target && target.colEl !== targetColEl) {
            targetColEl.removeChild(cardEl);
            target.colEl.appendChild(cardEl);
            targetColEl  = target.colEl;
            targetDateMs = parseInt(target.colEl.dataset.colDateMs);
            // Re-apply positioning after DOM move
            cardEl.style.top     = currentTopPx + 'px';
            cardEl.style.opacity = '0.75';
            cardEl.style.zIndex  = '20';
          }
        }
      };

      const onUp = (ev) => {
        cardEl.releasePointerCapture(ev.pointerId);
        cardEl.removeEventListener('pointermove', onMove);
        cardEl.removeEventListener('pointerup',   onUp);
        cardEl.classList.remove('dragging-active');
        cardEl.style.opacity = '';
        cardEl.style.zIndex  = '';

        if (!moved) {
          if (ghostObj) this._openGhostEditChoice(ghostObj);
          else TaskController.openDetail(goalId);
          return;
        }

        // Final column determination at drop (in case pointermove was missed)
        if (isWeekView) {
          const target = getTargetDayColumn(ev.clientX);
          if (target) {
            targetDateMs = parseInt(target.colEl.dataset.colDateMs);
          }
        } else {
          // Day view: use gridEl date
          targetDateMs = parseInt(gridEl.dataset.dateMs || gridEl.dataset.colDateMs || this._calDate.getTime());
        }

        const gridRect   = gridEl.getBoundingClientRect();
        const snappedMin = Math.max(0, Math.min(23*60+50, Math.round((ev.clientY - gridRect.top - offsetY) / PX / SNAP) * SNAP));
        const h = Math.floor(snappedMin / 60);
        const m = snappedMin % 60;
        const newDate = new Date(targetDateMs);
        newDate.setHours(h, m, 0, 0);

        if (ghostObj) {
          this._splitGhostIntoException(ghostObj, { newTs: newDate.getTime(), openEditor: false });
        } else {
          this._rescheduleGoalToTimestamp(goalId, newDate.getTime());
          showToast(`📅 Moved to ${pad(h)}:${pad(m)}`, 1200);
        }
      };

      // ── dispatch: handle element → immediate, otherwise long-press for both touch and mouse ──
      if (isHandle) {
        // Drag handle: start immediately without waiting
        e.preventDefault();
        e.stopPropagation();
        beginDrag();
      } else {
        // Long-press for both touch and mouse (400ms) — short tap always opens detail
        document.addEventListener('pointermove', earlyMoveCheck);
        document.addEventListener('pointerup',   earlyCancel);
        document.addEventListener('pointercancel', cancelPending, {once:true});
        longPressTimer = setTimeout(() => {
          cancelPending();
          e.preventDefault();
          beginDrag();
        }, LONG_PRESS_MS);
      }
    });
  },

  // Attach resize handle — drag it to change duration_min
  _attachResizeHandle(handle, cardEl, goalId) {
    handle.style.touchAction = 'none';
    handle.style.userSelect  = 'none';

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);

      const PX   = this.PX_PER_MIN;
      const SNAP = this.SNAP_MIN;
      const MIN  = this.MIN_H;
      const startY    = e.clientY;
      const startH    = parseFloat(cardEl.style.height) || MIN;

      // Snapshot before state for undo
      const g = StateManager.get('goals').find(x=>x.id===goalId);
      const beforeDur = g ? (g.duration_min || Math.round(startH / PX)) : Math.round(startH / PX);

      const onMove = (ev) => {
        ev.preventDefault();
        const deltaMin = (ev.clientY - startY) / PX;
        const snapped  = Math.max(SNAP, Math.round((startH/PX + deltaMin) / SNAP) * SNAP);
        cardEl.style.height = Math.max(MIN, snapped * PX) + 'px';
      };

      const onUp = (ev) => {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup',   onUp);
        const newDurMin = Math.max(SNAP, Math.round(parseFloat(cardEl.style.height) / PX / SNAP) * SNAP);
        // Snapshot before committing resize (reschedule called with false to avoid double snapshot)
        const gNow = StateManager.get('goals').find(x=>x.id===goalId);
        if (gNow && newDurMin !== beforeDur) {
          StateManager.pushUndoSnapshot();
        }
        this._rescheduleGoalToTimestamp(goalId, null, newDurMin, false);
        // null ts = keep scheduledAt, only change duration
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup',   onUp);
    });
  },

  // ── Day grid (absolute) ───────────────────────────────────

  // 2.1 — Ghost style helper: respects dimRecurring setting
  _ghostStyle(color, radius='8px', pad='4px 8px') {
    const dim = StateManager.get('dimRecurring');
    return dim
      ? `background:${color}11;border-left:3px dashed ${color};border-radius:${radius};padding:${pad};opacity:.55;cursor:pointer;overflow:hidden;box-sizing:border-box;`
      : `background:${color}22;border-left:3px solid ${color};border-radius:${radius};padding:${pad};opacity:1;cursor:grab;overflow:hidden;box-sizing:border-box;`;
  },

  // 3.5 — Ghost edit choice dialog
  _openGhostEditChoice(ghostObj) {
    this._pendingGhost = ghostObj;
    openModal('ghostEditChoiceModal');
  },

  // 3.5/2.3 — Split a ghost occurrence into an independent clone + exception in master.
  // opts.newTs     — override scheduledAt for the clone (used by drag & drop)
  // opts.openEditor — open task editor for the clone after creation
  _splitGhostIntoException(ghostObj, opts = {}) {
    StateManager.pushUndoSnapshot(); // snapshot BEFORE mutation
    const goals = StateManager.get('goals');
    const master = goals.find(x => x.id === ghostObj.ghostOf);
    if (!master) return;
    const exDate = dateKey(ghostObj.scheduledAt);
    const exceptions = [...new Set([...(master.recurrence?.exceptions || []), exDate])];
    const updated = goals.map(g => g.id === master.id
      ? { ...g, recurrence: { ...g.recurrence, exceptions } }
      : g
    );
    // Create independent clone (strips ghost metadata, clears recurrence)
    const { isGhost, ghostOf, ...rest } = ghostObj;
    const clone = {
      ...rest,
      id: 'g_' + Date.now().toString(36) + rnd(),
      recurrence: null,
      isEvent: true,
      scheduledAt: opts.newTs ?? ghostObj.scheduledAt,
      done: false, elapsed: 0, startTime: null, paused: false,
    };
    StateManager.patch({ goals: [...updated, clone] });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    this.render();
    if (opts.openEditor) {
      TaskController.openModal(clone.id);
    } else {
      showToast('📌 Moved as separate event');
    }
  },

  _renderDay() {
    try {
      if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
      const c = document.getElementById('dayGrid'); if(!c) return;
      this._updateHeaderTitle(this._calDate.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'}));
      const dk   = dateKey(this._calDate.getTime());
      const PX   = this.PX_PER_MIN;
      const TOTAL = 24 * 60 * PX;

      // Container
      c.style.cssText = `position:relative;height:${TOTAL}px;`;
      c.dataset.dateMs = String(new Date(this._calDate).setHours(0,0,0,0));

      // 3.2 — All-day tasks strip (isEvent:false items with today's date)
      const dayAllDayStrip = document.getElementById('dayAllDayStrip');
      if (dayAllDayStrip) {
        const taskItems = StateManager.get('goals').filter(g => !g.isProject && !g.isEvent && g.scheduledAt && dateKey(g.scheduledAt)===dk);
        dayAllDayStrip.innerHTML = taskItems.length
          ? taskItems.map(g => {
              const color = catColor(g);
              return `<div data-task-id="${g.id}" data-allday="1" class="glass-soft glass-hover rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer" style="background:${color}22;border-left:3px solid ${color};${g.done?'opacity:.5;text-decoration:line-through;':''}">`
                + `<span style="width:6px;height:6px;border-radius:50%;background:${color};flex:none;"></span>`
                + `${esc(g.title)}</div>`;
            }).join('')
          : '';
        dayAllDayStrip.querySelectorAll('[data-task-id]').forEach(el => {
          el.addEventListener('click', e => { e.stopPropagation(); TaskController.openDetail(el.dataset.taskId); });
        });
      }

      // Hour guide lines
      let html = '';
      for (let h = 0; h < 24; h++) {
        const top = h * 60 * PX;
        html += `<div style="position:absolute;left:0;right:0;top:${top}px;display:flex;align-items:flex-start;pointer-events:none;">
          <span style="font-size:11px;color:rgba(255,255,255,.3);width:44px;flex:none;padding-top:2px;font-variant-numeric:tabular-nums;">${pad(h)}:00</span>
          <div style="flex:1;height:1px;background:rgba(255,255,255,.06);margin-top:8px;"></div>
        </div>`;
      }
      c.innerHTML = html;

      // 3.3 — Click-to-create on empty grid area
      c.onclick = (e) => {
        if (e.target !== c && e.target.closest('[data-task-id]')) return;
        const rect = c.getBoundingClientRect();
        const rawMin = (e.clientY - rect.top) / PX;
        const snapped = Math.max(0, Math.min(23*60+50, Math.round(rawMin / this.SNAP_MIN) * this.SNAP_MIN));
        const h = Math.floor(snapped / 60), m = snapped % 60;
        const dayMs = parseInt(c.dataset.dateMs || this._calDate.getTime());
        const presetTs = new Date(dayMs);
        presetTs.setHours(h, m, 0, 0);
        TaskController.openModal(null, { presetScheduledAt: presetTs.getTime(), presetType: 'event' });
      };

      // Task cards — only isEvent:true items + ghost recurrences go in the time grid
      const dayStart = new Date(this._calDate); dayStart.setHours(0,0,0,0);
      const dayEnd   = new Date(this._calDate); dayEnd.setHours(23,59,59,999);
      const realEvents = StateManager.get('goals').filter(g => !g.isProject && g.isEvent && g.scheduledAt && dateKey(g.scheduledAt)===dk);
      const ghosts    = getGhostOccurrences(dayStart.getTime(), dayEnd.getTime()).filter(g => dateKey(g.scheduledAt)===dk);
      const goals = [...realEvents, ...ghosts];
      goals.sort((a,b)=>a.scheduledAt-b.scheduledAt);
      const layout = layoutOverlaps(goals);

      goals.forEach(g => {
        const d = new Date(g.scheduledAt);
        const topMin  = d.getHours()*60 + d.getMinutes();
        const durMin  = g.duration_min || DEFAULT_TIMER_MIN;
        const topPx   = topMin * PX;
        const heightPx= Math.max(this.MIN_H, durMin * PX);
        const color   = catColor(g);
        const cat     = catInfo(g);
        const twoLine = heightPx >= 36;
        const { col, cols } = layout.get(g.id) || { col: 0, cols: 1 };
        const leftWidth = `left:calc(50px + (100% - 54px) * ${col/cols});width:calc((100% - 54px) / ${cols} - 2px);`;

        const card = document.createElement('div');
        card.dataset.taskId = g.isGhost ? g.ghostOf : g.id;
        if (g.isGhost) {
          card.dataset.ghost = '1';
          card.style.cssText = `position:absolute;${leftWidth}top:${topPx}px;height:${heightPx}px;`
            + this._ghostStyle(color, '8px', '4px 8px');
        } else {
          card.style.cssText = `position:absolute;${leftWidth}top:${topPx}px;height:${heightPx}px;`
            + `background:${color}22;border-left:3px solid ${color};border-radius:8px;`
            + `padding:4px 8px;cursor:grab;overflow:hidden;box-sizing:border-box;`
            + (g.done ? 'opacity:.5;' : '');
        }
        // Drag handle for both real events and ghosts
        const dragHandleHtml = `<div class="cal-drag-handle" style="position:absolute;top:4px;right:20px;font-size:10px;opacity:0.4;cursor:grab;user-select:none;touch-action:none;">⠿</div>`;
        card.innerHTML = `<p style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${g.done?'text-decoration:line-through;':''}">${esc(g.title)}${g.isGhost?' 🔁':''}</p>`
          + (twoLine ? `<span style="font-size:10px;color:rgba(255,255,255,.45);">${fmtTimeRange(g.scheduledAt, durMin)}</span><span class="tag-mini ${isUrgent(g)?'tag':'tag-grey'}" style="margin-left:6px;">${cat.label}</span>` : '')
          + dragHandleHtml
          + (!g.isGhost ? `<div class="cal-resize-handle" style="position:absolute;bottom:2px;right:4px;width:16px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);cursor:s-resize;"></div>` : '');

        c.appendChild(card);
        const dragHandle = card.querySelector('.cal-drag-handle');
        if (g.isGhost) {
          // Ghost drag: creates exception+clone on drop; tap opens choice dialog
          this._attachPointerDrag(card, g.ghostOf, c, dragHandle, g);
        } else {
          this._attachPointerDrag(card, g.id, c, dragHandle);
          this._attachResizeHandle(card.querySelector('.cal-resize-handle'), card, g.id);
        }
      });

      // A9.4 — Now-line (today only)
      if (dk === dateKey()) {
        const nowLine = document.createElement('div');
        nowLine.style.cssText = 'position:absolute;left:44px;right:0;height:2px;background:#FF3B30;z-index:20;pointer-events:none;';
        nowLine.innerHTML = '<span style="position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:#FF3B30;"></span>';
        const updateNow = () => {
          const n = new Date();
          nowLine.style.top = ((n.getHours()*60 + n.getMinutes()) * PX) + 'px';
        };
        updateNow();
        c.appendChild(nowLine);
        this._nowTimer = setInterval(updateNow, 60000);
      }

      // A9.4 — Auto-scroll to current time - 2h on first render
      if (!this._didAutoScroll) {
        this._didAutoScroll = true;
        const calDay = document.getElementById('cal-day');
        if (calDay) {
          const targetMins = new Date().getHours() * 60 + new Date().getMinutes();
          setTimeout(() => {
            calDay.scrollTop = Math.max(0, targetMins - 120) * PX;
          }, 0);
        }
      }
    } catch(e) { console.error('[_renderDay]', e); }
  },
  _renderWeek() {
    try {
      if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
      const c = document.getElementById('weekGrid'); if(!c) return;
      let start = new Date(this._calDate); start.setHours(0,0,0,0);
      start.setDate(start.getDate() - ((start.getDay()+6)%7)); // Monday
      const end = new Date(start.getTime()+6*86400000);
      this._updateHeaderTitle(start.toLocaleDateString('en-US',{day:'numeric',month:'short'})+' – '+end.toLocaleDateString('en-US',{day:'numeric',month:'short'}));

      const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const todayKey = dateKey();
      const realGoals = StateManager.get('goals').filter(g => !g.isProject && g.scheduledAt);
      const weekEnd   = new Date(start.getTime() + 7*86400000 - 1);
      const weekGhosts = getGhostOccurrences(start.getTime(), weekEnd.getTime());
      // 3.2 — Separate task items (not isEvent) from event items for all-day strip
      const allEventGoals = [
        ...realGoals.filter(g => g.isEvent),
        ...weekGhosts,
      ];
      const allTaskGoals = realGoals.filter(g => !g.isEvent);
      const dayDates = [];
      for (let i=0;i<7;i++) dayDates.push(new Date(start.getTime()+i*86400000));

      const PX    = this.PX_PER_MIN;
      const TOTAL = 24*60*PX;

      // Header row
      let head = `<div style="display:grid;grid-template-columns:44px repeat(7,1fr);gap:4px;margin-bottom:4px;position:sticky;top:0;background:rgba(28,28,30,.98);z-index:10;padding-bottom:4px;">
        <div></div>`;
      for (let i=0;i<7;i++){
        const d  = dayDates[i];
        const dk = dateKey(d.getTime());
        head += `<div style="text-align:center;cursor:pointer;" data-day="${dk}"><p style="font-size:10px;color:rgba(255,255,255,.4);">${dayNames[i]}</p><p style="font-weight:600;border-radius:6px;${dk===todayKey?'color:#FF3B30;background:rgba(255,59,48,.12);padding:2px 4px;':''}">${d.getDate()}</p></div>`;  // 3.1 today
      }
      head += `</div>`;

      // 3.2 — All-day task strip row (above body)
      let allDayRow = `<div style="display:grid;grid-template-columns:44px repeat(7,1fr);gap:4px;margin-bottom:4px;"><div></div>`;
      for (let i=0;i<7;i++){
        const dk = dateKey(dayDates[i].getTime());
        const dayTasks = allTaskGoals.filter(g => dateKey(g.scheduledAt)===dk);
        allDayRow += `<div style="display:flex;flex-direction:column;gap:2px;min-height:20px;">`;
        dayTasks.forEach(g => {
          const color = catColor(g);
          allDayRow += `<div data-task-id="${g.id}" data-allday="1" class="glass-soft rounded-md px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-1 cursor-pointer overflow-hidden" style="background:${color}22;border-left:2px solid ${color};${g.done?'opacity:.5;text-decoration:line-through;':''}"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(g.title)}</span></div>`;
        });
        allDayRow += `</div>`;
      }
      allDayRow += `</div>`;

      // Body: time labels column + 7 absolute day columns
      const bodyWrapper = document.createElement('div');
      bodyWrapper.style.cssText = `display:grid;grid-template-columns:44px repeat(7,1fr);gap:4px;position:relative;height:${TOTAL}px;`;

      // Time labels
      const labelCol = document.createElement('div');
      labelCol.style.cssText = `position:relative;height:${TOTAL}px;`;
      for (let h=0;h<24;h++){
        const lbl = document.createElement('div');
        lbl.style.cssText = `position:absolute;top:${h*60*PX}px;left:0;right:0;font-size:10px;color:rgba(255,255,255,.3);font-variant-numeric:tabular-nums;`;
        lbl.textContent = pad(h)+':00';
        labelCol.appendChild(lbl);
      }
      bodyWrapper.appendChild(labelCol);

      // Day columns
      for (let i=0;i<7;i++){
        const d    = dayDates[i];
        const dk   = dateKey(d.getTime());
        const col  = document.createElement('div');
        col.style.cssText = `position:relative;height:${TOTAL}px;border-left:1px solid rgba(255,255,255,.06);${dk===todayKey?'background:rgba(255,59,48,.06);':''}`;  // 3.1 today highlight
        col.dataset.day = dk;
        col.dataset.colDateMs = String(d.getTime());

        // Hour guide lines inside column
        for (let h=0;h<24;h++){
          const line = document.createElement('div');
          line.style.cssText = `position:absolute;left:0;right:0;top:${h*60*PX}px;height:1px;background:rgba(255,255,255,.05);pointer-events:none;`;
          col.appendChild(line);
        }

        // 3.3 — Click-to-create on column background
        col.addEventListener('click', (e) => {
          if (e.target !== col && e.target.closest('[data-task-id]')) return;
          const colRect = col.getBoundingClientRect();
          const rawMin = (e.clientY - colRect.top) / PX;
          const snapped = Math.max(0, Math.min(23*60+50, Math.round(rawMin / this.SNAP_MIN) * this.SNAP_MIN));
          const h2 = Math.floor(snapped / 60), m2 = snapped % 60;
          const presetTs = new Date(d.getTime());
          presetTs.setHours(h2, m2, 0, 0);
          TaskController.openModal(null, { presetScheduledAt: presetTs.getTime(), presetType: 'event' });
        });

        // Cards for this day (isEvent real + ghosts only in time grid)
        const dayGoals = allEventGoals.filter(g=>dateKey(g.scheduledAt)===dk);
        dayGoals.sort((a,b)=>a.scheduledAt-b.scheduledAt);
        const layout = layoutOverlaps(dayGoals);
        dayGoals.forEach(g => {
          const dt      = new Date(g.scheduledAt);
          const topMin  = dt.getHours()*60 + dt.getMinutes();
          const durMin  = g.duration_min || DEFAULT_TIMER_MIN;
          const topPx   = topMin * PX;
          const heightPx= Math.max(this.MIN_H, durMin * PX);
          const color   = catColor(g);
          const cat     = catInfo(g);
          const twoLine = heightPx >= 32;
          const { col: cCol, cols: cCols } = layout.get(g.id) || { col: 0, cols: 1 };
          const leftWidth = `left:calc(${cCol/cCols*100}% + 2px);width:calc(${100/cCols}% - 4px);`;

          const card = document.createElement('div');
          card.dataset.taskId = g.isGhost ? g.ghostOf : g.id;
          if (g.isGhost) {
            card.dataset.ghost = '1';
            card.style.cssText = `position:absolute;${leftWidth}top:${topPx}px;height:${heightPx}px;`
              + this._ghostStyle(color, '6px', '3px 6px');
          } else {
            card.style.cssText = `position:absolute;${leftWidth}top:${topPx}px;height:${heightPx}px;`
              + `background:${color}22;border-left:3px solid ${color};border-radius:6px;`
              + `padding:3px 6px;cursor:grab;overflow:hidden;box-sizing:border-box;`
              + (g.done ? 'opacity:.5;' : '');
          }
          // Drag handle for both real events and ghosts
          const dragHandleHtml = `<div class="cal-drag-handle" style="position:absolute;top:2px;right:14px;font-size:9px;opacity:0.4;cursor:grab;user-select:none;touch-action:none;">⠿</div>`;
          card.innerHTML = `<p style="font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${g.done?'text-decoration:line-through;':''}">${esc(g.title)}${g.isGhost?' 🔁':''}</p>`
            + (twoLine ? `<span style="font-size:9px;color:rgba(255,255,255,.4);">${fmtTimeRange(g.scheduledAt, durMin)}</span>` : '')
            + dragHandleHtml
            + (!g.isGhost ? `<div class="cal-resize-handle" style="position:absolute;bottom:2px;right:3px;width:12px;height:4px;border-radius:2px;background:rgba(255,255,255,.2);cursor:s-resize;"></div>` : '');

          col.appendChild(card);
          const dragHandle = card.querySelector('.cal-drag-handle');
          if (g.isGhost) {
            // Ghost drag: creates exception+clone on drop; tap opens choice dialog
            this._attachPointerDrag(card, g.ghostOf, col, dragHandle, g);
          } else {
            this._attachPointerDrag(card, g.id, col, dragHandle);
            this._attachResizeHandle(card.querySelector('.cal-resize-handle'), card, g.id);
          }
        });

        // A9.4 — Now-line (today column only)
        if (dk === todayKey) {
          const nowLine = document.createElement('div');
          nowLine.style.cssText = 'position:absolute;left:0;right:0;height:2px;background:#FF3B30;z-index:20;pointer-events:none;';
          nowLine.innerHTML = '<span style="position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:#FF3B30;"></span>';
          const updateNow = () => {
            const n = new Date();
            nowLine.style.top = ((n.getHours()*60 + n.getMinutes()) * PX) + 'px';
          };
          updateNow();
          col.appendChild(nowLine);
          this._nowTimer = setInterval(updateNow, 60000);
        }

        bodyWrapper.appendChild(col);
      }

      c.innerHTML = head + allDayRow;
      c.appendChild(bodyWrapper);

      // A9.4 — Auto-scroll to current time - 2h on first render
      if (!this._didAutoScroll) {
        this._didAutoScroll = true;
        const weekScroll = c.parentElement;
        if (weekScroll) {
          const targetMins = new Date().getHours() * 60 + new Date().getMinutes();
          setTimeout(() => {
            weekScroll.scrollTop = Math.max(0, targetMins - 120) * PX;
          }, 0);
        }
      }

      // Day header click → navigate
      c.querySelectorAll('[data-day]').forEach(el=>el.addEventListener('click',()=>this._navigateToDay(el.dataset.day)));
      // All-day task chip click → open detail
      // All-day chips (not ghost time-grid cards) handled here; ghost cards handled via _attachPointerDrag
      c.querySelectorAll('[data-allday="1"]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();TaskController.openDetail(el.dataset.taskId);}));
    } catch(e) { console.error('[_renderWeek]', e); }
  },
  _renderMonth() {
    try {
      if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
      const c = document.getElementById('monthGrid'); if(!c) return;
      const y=this._calDate.getFullYear(), m=this._calDate.getMonth();
      this._updateHeaderTitle(this._calDate.toLocaleString('en-US',{month:'long',year:'numeric'}));
      const first=new Date(y,m,1).getDay(), offset=(first===0)?6:first-1, dim=new Date(y,m+1,0).getDate();
      const monthStart = new Date(y,m,1).getTime();
      const monthEnd   = new Date(y,m+1,0,23,59,59,999).getTime();
      const allGoals = [
        ...StateManager.get('goals').filter(g => !g.isProject),
        ...getGhostOccurrences(monthStart, monthEnd),
      ];
      const tasksByDay={};
      allGoals.forEach(g=>{ if(!g.scheduledAt) return; const d=new Date(g.scheduledAt); if(d.getFullYear()===y&&d.getMonth()===m){ const day=d.getDate(); (tasksByDay[day]=tasksByDay[day]||[]).push(g); } });
      Object.values(tasksByDay).forEach(arr=>arr.sort((a,b)=>{
        const p={high:0,mid:1,low:2}; const pa=(p[a.priority]??1), pb=(p[b.priority]??1);
        if(pa!==pb) return pa-pb; return (a.scheduledAt||0)-(b.scheduledAt||0);
      }));
      const today=new Date();
      let html='';
      for (let i=0;i<offset;i++) html += `<div class="glass-soft rounded-xl opacity-30"></div>`;
      for (let d=1; d<=dim; d++) {
        const dk = `${y}-${pad(m+1)}-${pad(d)}`;
        const isToday = d===today.getDate() && m===today.getMonth() && y===today.getFullYear();
        const dayTasks = tasksByDay[d]||[];
        const MAX=4;
        let items = dayTasks.slice(0,MAX).map(g=>{
          const color=catColor(g);
          const isGhost = !!g.isGhost;
          const ghostStyle = isGhost ? this._ghostStyle(color, '4px', '0') : '';
          const baseStyle = isGhost ? ghostStyle : `background:${color}22;`;
          const chipAttr = isGhost ? `data-ghost-date="${dateKey(g.scheduledAt)}"` : `data-task-id="${g.id}" draggable="true"`;
          return `<div class="flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded-md mt-1 overflow-hidden ${g.done?'opacity-50':''}" style="${baseStyle}border-left:2px ${isGhost?'dashed':'solid'} ${color};color:rgba(255,255,255,${isGhost?'.55':'.85'});" ${chipAttr}><span class="w-1.5 h-1.5 rounded-full flex-none" style="background:${color}"></span><span class="whitespace-nowrap overflow-hidden text-ellipsis" style="${g.done?'text-decoration:line-through;':''}">${esc(g.title)}${isGhost?' 🔁':''}</span>${g.allDay ? '' : `<span class="cal-event-time" style="margin-left:auto;">${fmtTimeRange(g.scheduledAt, g.duration_min)}</span>`}</div>`;
        }).join('');
        if (dayTasks.length>MAX) items += `<div class="text-[10px] text-accent mt-1">+ ${dayTasks.length-MAX} more</div>`;
        html += `<div class="glass-soft glass-hover rounded-xl p-2 flex flex-col gap-1 min-h-24 cursor-pointer ${isToday?'ring-1 ring-accent':''}" data-day="${dk}">
          <span class="text-xs font-semibold ${isToday?'text-accent':'text-white/60'}">${d}</span>${items}</div>`;
      }
      c.innerHTML = html;
      c.querySelectorAll('[data-task-id][draggable="true"]').forEach(el=>{
        el.addEventListener('dragstart', e=>{ this._dragGoalId = el.dataset.taskId; e.dataTransfer.setData('text/plain', el.dataset.taskId); e.dataTransfer.effectAllowed='move'; });
        el.addEventListener('dragend', ()=>{ this._dragGoalId = null; });
      });
      c.querySelectorAll('[data-day]').forEach(el=>{
        el.addEventListener('click',()=>this._navigateToDay(el.dataset.day));
        this._makeMonthDropTarget(el, el.dataset.day);
      });
      c.querySelectorAll('[data-task-id]').forEach(el=>{
        el.addEventListener('click',e=>{e.stopPropagation(); TaskController.openDetail(el.dataset.taskId);});
      });
      // Ghost chips in month view — find the ghost object and open choice dialog
      c.querySelectorAll('[data-ghost-date]').forEach(el=>{
        el.addEventListener('click', e=>{
          e.stopPropagation();
          const cellDk = el.closest('[data-day]')?.dataset.day;
          if (!cellDk) return;
          const [cy,cm,cd] = cellDk.split('-').map(Number);
          const dayStart = new Date(cy,cm-1,cd).getTime();
          const dayEnd   = new Date(cy,cm-1,cd,23,59,59,999).getTime();
          const ghost = getGhostOccurrences(dayStart, dayEnd).find(gh => dateKey(gh.scheduledAt) === el.dataset.ghostDate);
          if (ghost) this._openGhostEditChoice(ghost);
        });
      });
    } catch(e) { console.error('[_renderMonth]', e); }
  },

  // Lightweight HTML5 drop for month-grid cells (date-only rescheduling)
  _makeMonthDropTarget(el, dateStr) {
    el.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; el.classList.add('ring-1','ring-accent'); });
    el.addEventListener('dragleave', ()=>{ el.classList.remove('ring-1','ring-accent'); });
    el.addEventListener('drop', (e)=>{
      e.preventDefault(); el.classList.remove('ring-1','ring-accent');
      const goalId = this._dragGoalId || e.dataTransfer.getData('text/plain');
      if (!goalId) return;
      this._rescheduleGoalToDate(goalId, dateStr);
    });
  },
  _renderYear() {
    try {
      if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
      const c = document.getElementById('yearGrid'); if(!c) return;
      const y = this._yearDate.getFullYear();
      this._updateHeaderTitle(String(y));
      const yearStart = new Date(y, 0, 1).getTime();
      const yearEnd   = new Date(y, 11, 31, 23, 59, 59, 999).getTime();
      const allGoals  = [
      ...StateManager.get('goals').filter(g => !g.isProject),
      ...getGhostOccurrences(yearStart, yearEnd),
      ];
      const tasksByDate = {};
      allGoals.forEach(g=>{ if(!g.scheduledAt) return; const dk=dateKey(g.scheduledAt); (tasksByDate[dk]=tasksByDate[dk]||[]).push(g); });
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const today = new Date();
      let html='';
      months.forEach((mName, mi) => {
      const dim = new Date(y, mi+1, 0).getDate();
      let dots='';
      for (let d=1; d<=dim; d++) {
      const dk = `${y}-${pad(mi+1)}-${pad(d)}`;
      const has = tasksByDate[dk] && tasksByDate[dk].length>0;
      const isToday = d===today.getDate() && mi===today.getMonth() && y===today.getFullYear();
      const color = has ? catColor(tasksByDate[dk][0]) : null;
      dots += `<div class="heat cursor-pointer" data-day="${dk}" style="background:${isToday?'#FF3B30':(has?color:'rgba(255,255,255,0.08)')}"></div>`;
      }
      html += `<div class="glass glass-hover rounded-2xl p-4" data-month="${mi}">
      <p class="font-semibold mb-3 cursor-pointer ${mi===today.getMonth()&&y===today.getFullYear()?'text-accent':''}">${mName}</p>
      <div class="grid grid-cols-7 gap-1.5">${dots}</div>
      </div>`;
      });
      c.innerHTML = html;
      c.querySelectorAll('[data-day]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation(); this._navigateToDay(el.dataset.day);}));
      c.querySelectorAll('[data-month] > p').forEach((el,mi)=>{
      el.addEventListener('click', ()=>{ this._calDate = new Date(y, mi, 1); this.setView('month'); switchSub('calTabs','cal','month'); });
      });
    } catch(e) { console.error('[_renderYear]', e); }
  },
};

/* ═══════════════════════════════════════════════════════════
   ROUTINE MANAGER — sleep sliders (10-min step) + editable,
   toggleable routines
═══════════════════════════════════════════════════════════ */
const RoutineManager = {
  _timerIds:[], _draftActions:[], _draftDays:[],

  init() {
    this._scheduleMidnightCheck();
    this._scheduleSoftAlarms();
    this._wireSleepView();
    this._wireRoutineModal();
    document.getElementById('btn-add-routine')?.addEventListener('click', ()=>this.openModal());
    document.getElementById('btn-routine-add-action')?.addEventListener('click', ()=>this._addActionRow());
    StateManager.subscribe(()=>{ if(StateManager.get('currentView')==='sleep') this.render(); });
  },

  render() {
    const s=StateManager.get('sleepSettings');
    const bedStep = timeStrToStep(s.bedtime||'23:00');
    const wakeStep = timeStrToStep(s.waketime||'07:00');

    const bigBed = document.getElementById('sleep-bedtime-big'); if (bigBed) bigBed.textContent = s.bedtime||'23:00';
    const bigWake = document.getElementById('sleep-waketime-big'); if (bigWake) bigWake.textContent = s.waketime||'07:00';
    const bedSlider = document.getElementById('sleep-bedtime-slider');
    const wakeSlider = document.getElementById('sleep-waketime-slider');
    if (bedSlider) bedSlider.value = bedStep;
    if (wakeSlider) wakeSlider.value = wakeStep;
    const bedLabel = document.getElementById('sleep-bedtime-slider-label'); if (bedLabel) bedLabel.textContent = s.bedtime||'23:00';
    const wakeLabel = document.getElementById('sleep-waketime-slider-label'); if (wakeLabel) wakeLabel.textContent = s.waketime||'07:00';

    // Sleep duration (handles overnight wrap, e.g. 23:00 -> 07:00)
    let bedMins = timeStrToStep(s.bedtime)*SLIDER_STEP_MIN, wakeMins = timeStrToStep(s.waketime)*SLIDER_STEP_MIN;
    let durMins = wakeMins - bedMins; if (durMins<=0) durMins += 24*60;
    const durLabel = document.getElementById('sleep-duration-label'); if (durLabel) durLabel.textContent = fmtMinutesToHM(durMins);

    const softToggle = document.getElementById('toggle-soft-alarm');
    if (softToggle) softToggle.classList.toggle('on', !!s.softAlarmEnabled);

    this._renderWeekBars();
    this._renderRoutinesList();
  },

  _renderWeekBars() {
    const wrap = document.getElementById('sleep-week-bars');
    if (!wrap) return;
    const log = StateManager.get('sleepSettings').sleepLog || {};
    const days = ['M','T','W','T','F','S','S'];
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - ((start.getDay()+6)%7));
    let total=0, count=0;
    let html='';
    for (let i=0;i<7;i++) {
      const dk = dateKey(start.getTime()+i*86400000);
      const mins = log[dk];
      const hasData = typeof mins === 'number';
      if (hasData) { total+=mins; count++; }
      const pct = hasData ? Math.min(100, Math.round(mins/540*100)) : 30;
      html += `<div class="flex-1 flex flex-col items-center gap-2"><div class="w-full rounded-lg ${hasData?'accent-grad':'bg-white/15'}" style="height:${pct}%"></div><span class="text-[10px] text-white/40">${days[i]}</span></div>`;
    }
    wrap.innerHTML = html;
    const avgLabel = document.getElementById('sleep-avg-label');
    if (avgLabel) avgLabel.textContent = count ? `Avg ${fmtMinutesToHM(total/count)}` : 'No data yet';
  },

  _renderRoutinesList() {
    const container = document.getElementById('routines-list');
    if (!container) return;
    const routines = StateManager.get('routines');
    if (!routines.length) {
      container.innerHTML = `<div class="empty-state" style="padding:24px 0;"><div class="empty-icon">🌙</div><div class="empty-title">No routines yet</div><div class="empty-sub">Tap Add to create one</div></div>`;
      return;
    }
    container.innerHTML = routines.map(r => `
      <div class="glass-soft glass-hover rounded-2xl p-4 cursor-pointer" data-routine-id="${r.id}">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="13" r="6"/><path stroke-linecap="round" d="M12 2v2"/></svg>
            <p class="font-semibold text-sm">${esc(r.title)}</p>
          </div>
          <div class="toggle${r.on?' on':''}" data-toggle data-action="toggle-routine" data-id="${r.id}"></div>
        </div>
        <p class="text-white/40 text-xs mb-2">${r.trigger ? 'Triggers at '+r.trigger : 'No trigger set'}</p>
        <div class="flex flex-wrap gap-1.5">${(r.actions||[]).map(t=>`<span class="tag-grey tag">${esc(t)}</span>`).join('')}</div>
      </div>
    `).join('');
    container.querySelectorAll('[data-action="toggle-routine"]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.stopPropagation();
        const id = el.dataset.id;
        const prev = StateManager.get('routines');
        let nextOn = false;
        const routines = prev.map(r => {
          if (r.id!==id) return r;
          nextOn = !r.on;
          return { ...r, on: nextOn };
        });
        StateManager.set('routines', routines);
        el.classList.toggle('on', nextOn);
        const title = routines.find(r=>r.id===id)?.title||'Routine';
        showToast(nextOn?`✅ "${title}" enabled`:`⏸ "${title}" disabled`, 1400);
        this._scheduleSoftAlarms();
      });
    });
    container.querySelectorAll('[data-routine-id]').forEach(el=>{
      el.addEventListener('click', ()=>this.openModal(el.dataset.routineId));
    });
  },

  _wireSleepView() {
    const bedSlider = document.getElementById('sleep-bedtime-slider');
    const wakeSlider = document.getElementById('sleep-waketime-slider');
    if (bedSlider) {
      // step="10" on the slider itself already enforces 10-minute snapping
      // at the input level; stepToTimeStr() re-quantizes defensively so the
      // stored value is always an exact multiple of 10, never e.g. 23:05.
      bedSlider.addEventListener('input', e=>{
        const t = stepToTimeStr(parseInt(e.target.value));
        const lbl=document.getElementById('sleep-bedtime-slider-label'); if(lbl) lbl.textContent=t;
      });
      bedSlider.addEventListener('change', e=>{
        const t = stepToTimeStr(parseInt(e.target.value));
        this._patchSleep({ bedtime: t });
      });
    }
    if (wakeSlider) {
      wakeSlider.addEventListener('input', e=>{
        const t = stepToTimeStr(parseInt(e.target.value));
        const lbl=document.getElementById('sleep-waketime-slider-label'); if(lbl) lbl.textContent=t;
      });
      wakeSlider.addEventListener('change', e=>{
        const t = stepToTimeStr(parseInt(e.target.value));
        this._patchSleep({ waketime: t });
      });
    }
    document.getElementById('toggle-soft-alarm')?.addEventListener('click', (e)=>{
      const on = !e.currentTarget.classList.contains('on');
      e.currentTarget.classList.toggle('on', on);
      this._patchSleep({ softAlarmEnabled: on });
    });
  },

  _patchSleep(patch) {
    const s = { ...StateManager.get('sleepSettings'), ...patch };
    // Log tonight's planned duration for the weekly chart once bed/wake both known
    let bedMins = timeStrToStep(s.bedtime)*SLIDER_STEP_MIN, wakeMins = timeStrToStep(s.waketime)*SLIDER_STEP_MIN;
    let durMins = wakeMins - bedMins; if (durMins<=0) durMins += 24*60;
    s.sleepLog = { ...(s.sleepLog||{}), [dateKey()]: durMins };
    StateManager.patch({ sleepSettings: s });
    SyncManager.scheduleSync();
    this._scheduleSoftAlarms();
    this.render();
    showToast('💤 Sleep settings saved', 1500);
  },

  openModal(id=null) {
    StateManager.set('editingRoutineId', id);
    // Deep-clone the routine (not just the array) — StateManager.get() only
    // shallow-clones the top-level state object, so routine objects inside
    // the array are still live references. Cloning breaks that aliasing.
    const r = id ? StateManager.get('routines').find(x=>x.id===id) : null;
    this._draftActions = r ? JSON.parse(JSON.stringify(r.actions||[])) : ['Drink water'];
    this._draftDays = r ? JSON.parse(JSON.stringify(r.days||[1,2,3,4,5,6,7])) : [1,2,3,4,5,6,7];

    document.getElementById('routineModalTitle').textContent = r ? 'Edit Routine' : 'New Routine';
    document.getElementById('routine-title-input').value = r?.title || '';
    document.getElementById('routine-time-input').value = r?.trigger || '';
    const newActionInp = document.getElementById('routine-new-action-input');
    if (newActionInp) newActionInp.value = '';
    const pushToggle = document.getElementById('routine-push-toggle');
    pushToggle.classList.toggle('on', r ? !!r.push : true);
    document.getElementById('btn-delete-routine').classList.toggle('hidden', !r);
    this._renderActionsList();
    this._renderDaysRow();
    openModal('routineModal');
  },

  _renderActionsList() {
    const list = document.getElementById('routine-actions-list');
    if (!list) return;
    if (!this._draftActions.length) {
      list.innerHTML = `<p class="text-white/35 text-xs" style="padding:4px 0;">No actions yet — add one below.</p>`;
      return;
    }
    list.innerHTML = this._draftActions.map((a,i)=>`
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-white/70 flex-1">${esc(a)}</span>
        <button type="button" class="glass-soft rounded-lg" data-action="remove-routine-action" data-i="${i}" style="width:26px;height:26px;font-size:11px;color:rgba(255,255,255,.5);">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-action="remove-routine-action"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ this._draftActions.splice(parseInt(btn.dataset.i),1); this._renderActionsList(); });
    });
  },

  // Adds whatever is typed in the "add action" input into the in-memory
  // draft array (_draftActions) and re-renders the list immediately. This
  // is the array that _wireRoutineModal's save handler snapshots into the
  // routine object, so anything pushed here is guaranteed to persist.
  _addActionRow() {
    const inp = document.getElementById('routine-new-action-input');
    const val = inp?.value.trim();
    if (!val) return;
    // Guard against accidental duplicate entries (case-insensitive).
    if (this._draftActions.some(a=>a.toLowerCase()===val.toLowerCase())) {
      showToast('That action is already on the list', 1400);
      if (inp) { inp.value=''; inp.focus(); }
      return;
    }
    this._draftActions.push(val);
    if (inp) { inp.value=''; inp.focus(); }
    this._renderActionsList();
  },

  // Folds whatever is currently typed in the "add action" box into the
  // draft array without requiring the person to press + or Enter first.
  // Called before every save so a typed-but-unsubmitted action is never
  // silently discarded.
  _flushPendingAction() {
    const inp = document.getElementById('routine-new-action-input');
    const val = inp?.value.trim();
    if (!val) return;
    if (!this._draftActions.some(a=>a.toLowerCase()===val.toLowerCase())) {
      this._draftActions.push(val);
    }
    if (inp) inp.value = '';
  },

  _renderDaysRow() {
    const wrap = document.getElementById('routine-days-row');
    if (!wrap) return;
    const labels = ['M','T','W','T','F','S','S'];
    wrap.innerHTML = labels.map((l,i)=>{
      const dayNum = i+1;
      const active = this._draftDays.includes(dayNum);
      return `<button type="button" class="w-10 h-10 rounded-xl text-sm font-medium glass-hover" data-day="${dayNum}" style="${active?'background:linear-gradient(145deg,#FF3B30,#b71f16);color:#fff;':'background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);'}">${l}</button>`;
    }).join('');
    wrap.querySelectorAll('[data-day]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const d = parseInt(btn.dataset.day);
        if (this._draftDays.includes(d)) this._draftDays = this._draftDays.filter(x=>x!==d);
        else this._draftDays.push(d);
        this._renderDaysRow();
      });
    });
  },

  _wireRoutineModal() {
    const newActionInp = document.getElementById('routine-new-action-input');
    newActionInp?.addEventListener('keydown', (e)=>{
      if (e.key==='Enter') { e.preventDefault(); this._addActionRow(); }
    });

    // Saving a routine: flush any unsubmitted action text into the draft
    // FIRST, then snapshot _draftActions/_draftDays into fresh arrays and
    // write them onto the routine object. Because save always reads
    // this._draftActions (not the DOM), every action added via _addActionRow
    // or _flushPendingAction is present at save time and survives reload
    // via StateManager.save() -> localStorage.setItem('nova-routines', ...).
    document.getElementById('btn-routine-save')?.addEventListener('click', ()=>{
      const title = document.getElementById('routine-title-input')?.value.trim();
      if (!title) { showToast('Enter a routine title'); return; }
      this._flushPendingAction();
      const trigger = document.getElementById('routine-time-input')?.value || '';
      const push = document.getElementById('routine-push-toggle')?.classList.contains('on');
      const id = StateManager.get('editingRoutineId');
      const prevRoutines = StateManager.get('routines');
      const actionsSnapshot = [...this._draftActions];
      const daysSnapshot = [...this._draftDays];
      let routines;
      if (id) {
        routines = prevRoutines.map(r => r.id===id
          ? { ...r, title, trigger, actions:actionsSnapshot, days:daysSnapshot, push }
          : r);
      } else {
        routines = [...prevRoutines, { id:'r_'+Date.now().toString(36)+rnd(), title, trigger, actions:actionsSnapshot, days:daysSnapshot, on:true, push }];
      }
      StateManager.set('routines', routines);
      showToast(id?'✅ Routine updated':'✅ Routine saved');
      SyncManager.scheduleSync();
      this._renderRoutinesList();
      this._scheduleSoftAlarms();
      closeModal('routineModal');
    });
    document.getElementById('btn-delete-routine')?.addEventListener('click', ()=>{
      const id = StateManager.get('editingRoutineId'); if (!id) return;
      if (!confirm('Delete this routine?')) return;
      StateManager.set('routines', StateManager.get('routines').filter(r=>r.id!==id));
      SyncManager.scheduleSync();
      this._renderRoutinesList();
      closeModal('routineModal');
      showToast('🗑 Routine deleted');
    });
  },

  _scheduleSoftAlarms() {
    this._timerIds.forEach(t=>clearTimeout(t)); this._timerIds=[];
    const s=StateManager.get('sleepSettings'); if(!s.softAlarmEnabled) return;

    // БАГ 2: строим wake/bed через UTC-арифметику с учётом Кишинёвского смещения (+2 зимой / +3 летом),
    // вместо new Date(year, month, day, h, m) который использует локальный TZ устройства.
    const _chisinauHhmm = (hhmm) => {
      const [h, m] = String(hhmm||'00:00').split(':').map(Number);
      const now = new Date();
      // получаем дату по Кишинёву через Intl
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Chisinau', year:'numeric', month:'2-digit', day:'2-digit',
      }).formatToParts(now).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
      // смещение Кишинёва в минутах (учитывает DST)
      const localParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Chisinau', hour12:false,
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit',
      }).formatToParts(now).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
      const asUTC = Date.UTC(Number(localParts.year), Number(localParts.month)-1, Number(localParts.day),
        Number(localParts.hour)===24?0:Number(localParts.hour), Number(localParts.minute), Number(localParts.second));
      const offsetMin = (asUTC - now.getTime()) / 60000;
      // epoch для hhmm сегодня по Кишинёву
      const target = Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), h, m, 0) - offsetMin*60000;
      return target;
    };

    const now = Date.now();
    let wake = _chisinauHhmm(s.waketime||'07:00');
    if (wake <= now) wake += 86400000; // завтра
    const softDelta = wake - 3600000 - now; // за 60 мин до подъёма
    if (softDelta > 0 && softDelta < 86400000) this._timerIds.push(setTimeout(()=>this._triggerSoftAlarm(), softDelta));

    let bed = _chisinauHhmm(s.bedtime||'23:00');
    if (bed <= now) bed += 86400000;
    const prepDelta = bed - (s.eveningPrepMins||30)*60000 - now;
    const gratDelta  = bed - (s.eveningGratitudeMins||15)*60000 - now;
    // БАГ 2: русские строки вместо английских, чтобы вебхук не путал их с системными фразами
    if (prepDelta > 0 && prepDelta < 86400000) this._timerIds.push(setTimeout(()=>{ showPopup('info','🌙','Время отдыхать','Приглуши свет и выключи гаджеты'); this._sendTg('🌙 До отбоя 30 минут. Приглуши свет, убери телефон.'); }, prepDelta));
    if (gratDelta  > 0 && gratDelta  < 86400000) this._timerIds.push(setTimeout(()=>{ showPopup('info','📓','Вечерний ритуал','Напиши 3 вещи, которыми гордишься сегодня'); this._sendTg('📓 Напиши 3 вещи, которыми гордишься сегодня, и 3 благодарности. Вечерний ритуал.'); }, gratDelta));

    // Enabled routines with a trigger time also get scheduled as popups.
    StateManager.get('routines').filter(r=>r.on && r.trigger).forEach(r=>{
      const [rh,rm]=r.trigger.split(':').map(Number);
      const days = (Array.isArray(r.days)&&r.days.length) ? r.days : [1,2,3,4,5,6,7];
      const t = new Date(); t.setHours(rh,rm,0,0);
      for (let i=0; i<8 && (t.getTime()<=now || !days.includes(t.getDay()===0?7:t.getDay())); i++) t.setDate(t.getDate()+1);
      const delta = t.getTime()-now;
      if (delta>0 && delta<86400000) this._timerIds.push(setTimeout(()=>{
        showPopup('info','🔔',r.title,(r.actions||[]).join(' · '));
        if (r.push) this._sendTg(`🔔 ${r.title}: ${(r.actions||[]).join(', ')}`);
      },delta));
    });
  },
  _triggerSoftAlarm() {
    // БАГ 2: русские строки — не создаём SYSTEM_PUSH_PATTERNS мусор в Telegram
    showPopup('info','⏰','Скоро подъём','Через час пора вставать');
    this._sendTg('⏰ Чемпион, через час подъём. Мягкий будильник - начинай просыпаться.');
    const s=StateManager.get('sleepSettings');
    const [wh,wm]=(s.waketime||'07:00').split(':').map(Number);
    // TZ-aware: строим wakeEpoch через Intl вместо local Date constructor
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Chisinau',year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(now).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
    const lp = new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Chisinau',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
      .formatToParts(now).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
    const offsetMin = (Date.UTC(Number(lp.year),Number(lp.month)-1,Number(lp.day),Number(lp.hour)===24?0:Number(lp.hour),Number(lp.minute),Number(lp.second)) - now.getTime()) / 60000;
    let wakeEpoch = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),wh,wm,0) - offsetMin*60000;
    if (wakeEpoch <= Date.now()) wakeEpoch += 86400000;
    const rem = wakeEpoch - Date.now();
    if (rem > 0) this._timerIds.push(setTimeout(()=>{ showPopup('info','☀️','Доброе утро!','Пора вставать, Чемпион!'); this._sendTg('☀️ Доброе утро, Чемпион! Пора вставать - новый день ждёт.'); }, rem));
  },
  _scheduleMidnightCheck() {
    this._lastDay = dateKey();
    const tick = () => {
      const today = dateKey(), yest = dateKey(Date.now()-86400000), st = StateManager.get('streak');
      if (st.lastDate && st.lastDate!==today && st.lastDate!==yest && (st.days>0 || st.doneToday)) StateManager.patch({streak:{...st,days:0,doneToday:false}});
      else if (st.lastDate!==today && st.doneToday) StateManager.patch({streak:{...st,doneToday:false}});
      if (today !== this._lastDay) { this._lastDay = today; this._scheduleSoftAlarms(); }
    };
    tick(); setInterval(tick, 60000);
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) tick(); });
  },
  _sendTg(text) {
    const token=StateManager.get('tgToken'), chatId=StateManager.get('tgChatId');
    if(!token||!chatId) return;
    fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text})}).catch(()=>{});
    const webhook = StateManager.get('webhookUrl');
    if (webhook) { fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,ts:Date.now()})}).catch(()=>{}); }
  },
};

/* ═══════════════════════════════════════════════════════════
   TIMER CONTROLLER
═══════════════════════════════════════════════════════════ */
const TimerController = {
  _rafId:null, _endTimer:null, _firedAlarms:new Set(), _alarmAudio:{}, _reminderTimers:[],

  init() {
    document.getElementById('btn-add-5m')?.addEventListener('click', ()=>this.addMinutes(5));
    document.getElementById('btn-add-10m')?.addEventListener('click', ()=>this.addMinutes(10));
    document.getElementById('btn-add-20m')?.addEventListener('click', ()=>this.addMinutes(20));
    document.getElementById('btn-add-30m')?.addEventListener('click', ()=>this.addMinutes(30));
    document.getElementById('btn-timer-toggle')?.addEventListener('click', ()=>this.toggle());
    document.getElementById('btn-timer-restart')?.addEventListener('click', ()=>this.reset());
    document.getElementById('btn-timer-delete')?.addEventListener('click', ()=>this.deleteActive());
    document.getElementById('btn-timer-pick-task')?.addEventListener('click', ()=>this.openPicker());
    document.getElementById('goal-picker-list')?.addEventListener('click', (e)=>{
      const row = e.target.closest('[data-id]');
      if (!row) return;
      this.setGoal(row.dataset.id);
      closeModal('goalPickerModal');
    });
    // A4b/c: kick tick on tab restore (RAF stops in background)
    document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) this.tick(); });
    // A4c: resume raf+armEndTimer if a timer was running before the page reloaded
    const _g = this._goal();
    if (_g && _g.startTime && !_g.paused && !_g.done) { this._rafLoop(); this._armEndTimer(); }
    setInterval(()=>this.scheduleReminders(), 3600000);
  },

  // A4b: set a real setTimeout as a fallback so background-tab timers still fire
  _armEndTimer() {
    clearTimeout(this._endTimer); this._endTimer = null;
    const g = this._goal(); if (!g || !g.startTime || g.paused || g.done) return;
    const total = (g.duration_min || DEFAULT_TIMER_MIN) * 60;
    const left = (total - ((g.elapsed||0) + (Date.now() - g.startTime) / 1000)) * 1000;
    this._endTimer = setTimeout(()=>this.tick(), Math.max(0, left) + 50);
  },

  setGoal(id) {
    // A4d: pause the previously running task before switching
    const prevId = StateManager.get('activeTaskId');
    if (prevId && prevId !== id) {
      const prev = StateManager.get('goals').find(x=>x.id===prevId);
      if (prev && prev.startTime && !prev.paused) {
        prev.elapsed = (prev.elapsed||0) + (Date.now()-prev.startTime)/1000;
        prev.startTime = null; prev.paused = true;
      }
    }
    const g = StateManager.get('goals').find(x=>x.id===id);
    if (!g) { showToast('That task could not be found — it may have been deleted'); return; }
    StateManager.set('activeTaskId', id);
    this._firedAlarms.delete(id);
    this.renderGoalCard();
    this.renderSpheres();
    this.tick();
    switchSub('focusTabs','focus','timer');
    showToast(`⏱ Timer set to "${g.title.substring(0,32)}"`, 1500);
  },

  addMinutes(mins) {
    const g=this._goal(); if(!g) { showToast('Pick a task first — tap ⏱ on any task'); return; }
    g.duration_min = (g.duration_min||DEFAULT_TIMER_MIN) + mins;
    StateManager.patch({goals:StateManager.get('goals')});
    this.tick(); this._armEndTimer();
    showToast(`+${mins}m added`, 1200);
  },

  toggle() {
    const g=this._goal(); if(!g||g.done){ showToast('Pick a task first — tap ⏱ on any task'); return; }
    (g.startTime&&!g.paused)?this._pauseCd():this._startCd();
  },

  _startCd() {
    const g=this._goal(); if(!g||g.done) return;
    g.startTime=Date.now(); g.paused=false;
    StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
    this._updateToggleLabel();
    showToast('▶ Timer started', 1200); this._rafLoop(); this._armEndTimer();
  },
  _pauseCd() {
    const g=this._goal(); if(!g) return;
    g.elapsed=(g.elapsed||0)+(Date.now()-g.startTime)/1000; g.startTime=null; g.paused=true;
    StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
    cancelAnimationFrame(this._rafId); this._rafId=null;
    clearTimeout(this._endTimer); this._endTimer=null;
    this._updateToggleLabel();
  },
  _updateToggleLabel() {
    const g=this._goal();
    const lbl=document.getElementById('btn-timer-toggle-label');
    if (lbl) lbl.textContent = (g && g.startTime && !g.paused) ? 'Pause' : 'Start';
  },

  reset() {
    cancelAnimationFrame(this._rafId); this._rafId=null;
    clearTimeout(this._endTimer); this._endTimer=null;
    const g = this._goal();
    if (g) {
      if (!confirm(`Restart the timer for "${g.title}"? This resets elapsed time to zero.`)) return;
      g.elapsed=0; g.startTime=null; g.paused=false; g.subtasks?.forEach(s=>s.done=false); this._firedAlarms.delete(g.id); this.stopAlarm(g.id); StateManager.patch({goals:StateManager.get('goals')});
      SyncManager.scheduleSync();
      showToast('🔄 Timer restarted', 1200);
    }
    this.tick(); this._updateToggleLabel(); TaskController.render();
  },

  deleteActive() {
    const g = this._goal(); if(!g) { showToast('No task selected'); return; }
    if (!confirm(`Remove "${g.title}"? This deletes the task entirely.`)) return;
    StateManager.patch({goals:StateManager.get('goals').filter(x=>x.id!==g.id)});
    StateManager.set('activeTaskId', null);
    SyncManager.scheduleSync();
    this.renderGoalCard(); this.tick(); TaskController.render(); renderProjectsPanel();
    showToast('🗑 Task deleted');
  },

  complete() { const g=this._goal(); if(!g) return; TaskController.complete(g.id); cancelAnimationFrame(this._rafId); this._rafId=null; this.tick(); this.renderSpheres(); },

  _goal() { const id=StateManager.get('activeTaskId'); return StateManager.get('goals').find(x=>x.id===id); },

  _rafLoop() {
    cancelAnimationFrame(this._rafId);
    const loop=()=>{
      this.tick();
      const g=this._goal();
      const running = !!(g&&g.startTime&&!g.paused&&!g.done);
      if(running) this._rafId=requestAnimationFrame(loop);
    };
    this._rafId=requestAnimationFrame(loop);
  },

  tick() {
    const g=this._goal();
    const ring = document.getElementById('timer-ring-progress');
    const timeText = document.getElementById('timer-time-text');
    const nameText = document.getElementById('timer-task-name');
    const tagsWrap = document.getElementById('timer-task-tags');
    this._updateToggleLabel();

    if (!g) {
      // Default idle display now matches DEFAULT_TIMER_MIN (60), not a
      // hardcoded 25 — keeps the ring/text consistent with the actual
      // default duration new tasks get.
      if (timeText) timeText.textContent = `${pad(DEFAULT_TIMER_MIN)}:00`;
      if (nameText) nameText.textContent = 'No task selected';
      if (tagsWrap) tagsWrap.innerHTML = '';
      if (ring) { ring.setAttribute('stroke-dashoffset', RING_C); ring.setAttribute('stroke', '#FF3B30'); }
      return;
    }
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    const totalSec=(g.duration_min||DEFAULT_TIMER_MIN)*60, remaining=Math.max(0,totalSec-elapsed), pct=Math.min(1,elapsed/totalSec);
    const color = g.done ? '#30D158' : (remaining<60 ? '#FF453A' : catColor(g));
    if (ring) {
      ring.setAttribute('stroke-dashoffset', (RING_C*(1-pct)).toFixed(3));
      ring.setAttribute('stroke', color);
      ring.style.filter = `drop-shadow(0 0 14px ${color}bb)`;
    }
    const mm=Math.floor(remaining/60), ss=Math.floor(remaining%60);
    let str; if(g.done) str='✓ Done'; else if(remaining>=3600) str=`${Math.floor(remaining/3600)}:${pad(Math.floor((remaining%3600)/60))}:${pad(ss)}`; else str=`${pad(mm)}:${pad(ss)}`;
    if (timeText) timeText.textContent = str;
    if (nameText) nameText.textContent = g.title;
    if (tagsWrap) {
      const cat = catInfo(g);
      tagsWrap.innerHTML = `${isUrgent(g)?'<span class="tag">Urgent</span>':''}<span class="tag-grey tag">${cat.label}${catEarnsGems(g.cat)?' 💎':''}</span>`;
    }
    if (remaining<=0 && g.startTime && !this._firedAlarms.has(g.id)) {
      this._firedAlarms.add(g.id); this.triggerAlarm(g,'⏰ Time is up!');
      // A4a: persist elapsed before nulling startTime so the ring stays at 100% after alarm
      g.elapsed = totalSec;
      g.startTime=null; g.paused=true; StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
      cancelAnimationFrame(this._rafId); this._rafId=null;
      clearTimeout(this._endTimer); this._endTimer=null;
      this._updateToggleLabel();
    }
  },

  renderGoalCard() {
    const g=this._goal();
    const nameText = document.getElementById('timer-task-name');
    const tagsWrap = document.getElementById('timer-task-tags');
    if (nameText) nameText.textContent = g ? g.title : 'No task selected';
    if (tagsWrap && g) {
      const cat = catInfo(g);
      tagsWrap.innerHTML = `${isUrgent(g)?'<span class="tag">Urgent</span>':''}<span class="tag-grey tag">${cat.label}${catEarnsGems(g.cat)?' 💎':''}</span>`;
    } else if (tagsWrap) tagsWrap.innerHTML = '';
    const sphereLabel = document.getElementById('sphere-current-label');
    if (sphereLabel) sphereLabel.textContent = g ? g.title : 'None selected';
  },

  renderSpheres() {
    const g = this._goal();
    const streak = StateManager.get('streak');

    // Current goal sphere
    if (g) {
      const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
      const totalSec=(g.duration_min||DEFAULT_TIMER_MIN)*60;
      const pct = Math.min(100, Math.round(elapsed/totalSec*100));
      const ring = document.getElementById('sphere-current-ring');
      if (ring) ring.setAttribute('stroke-dashoffset', (SPHERE_C*(1-pct/100)).toFixed(2));
      const pctLabel = document.getElementById('sphere-current-pct'); if (pctLabel) pctLabel.textContent = pct+'%';
    } else {
      const ring = document.getElementById('sphere-current-ring'); if (ring) ring.setAttribute('stroke-dashoffset', SPHERE_C);
      const pctLabel = document.getElementById('sphere-current-pct'); if (pctLabel) pctLabel.textContent = '0%';
    }

    // Big goals sphere — % of root projects that are fully completed (all leaf tasks done)
    const rootProjects = StateManager.get('goals').filter(g => g.isProject && !g.parentId);
    const completedMacros = rootProjects.filter(m => {
      const prog = computeNodeProgress(m.id);
      return prog.total > 0 && prog.done === prog.total;
    }).length;
    const totalMacros = rootProjects.length;
    const macroPct = totalMacros ? Math.round(completedMacros/totalMacros*100) : 0;
    const goalsRing = document.getElementById('sphere-goals-ring');
    if (goalsRing) goalsRing.setAttribute('stroke-dashoffset', (SPHERE_C*(1-macroPct/100)).toFixed(2));
    const goalsPct = document.getElementById('sphere-goals-pct'); if (goalsPct) goalsPct.textContent = macroPct+'%';
    const goalsLabel = document.getElementById('sphere-goals-label'); if (goalsLabel) goalsLabel.textContent = `${completedMacros} of ${totalMacros} completed`;

    // Streak sphere
    const streakPct = Math.min(100, Math.round((streak.days / Math.max(7, streak.best||7)) * 100));
    const streakRing = document.getElementById('sphere-streak-ring');
    if (streakRing) streakRing.setAttribute('stroke-dashoffset', (SPHERE_C*(1-streakPct/100)).toFixed(2));
    const streakCount = document.getElementById('sphere-streak-count'); if (streakCount) streakCount.textContent = streak.days;
    const streakBest = document.getElementById('sphere-streak-best'); if (streakBest) streakBest.textContent = `Personal best: ${streak.best||0} days`;
  },

  openPicker() {
    this._renderPickerList();
    openModal('goalPickerModal');
  },

  _renderPickerList() {
    const list=document.getElementById('goal-picker-list'); if(!list) return;
    const active=StateManager.get('goals').filter(g=>!g.done && !g.isProject);
    if(!active.length){
      list.innerHTML='<div style="text-align:center;padding:20px 0;color:rgba(255,255,255,.35);font-size:13px;">No active tasks — create one first</div>';
      return;
    }
    // Rows carry data-id and are otherwise plain — click handling lives on
    // the parent #goal-picker-list (delegated, wired once in init()), so
    // rebuilding this innerHTML on every open never breaks selection.
    list.innerHTML=active.map(g=>{
      const cat=catInfo(g);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:rgba(70,70,76,.18);border:1px solid rgba(255,255,255,.07);margin-bottom:8px;cursor:pointer;border-left:3px solid ${catColor(g)}" data-id="${g.id}"><span>${cat.emoji} ${esc(g.title)}</span></div>`;
    }).join('');
  },

  triggerAlarm(goal,msg='Time is up!') {
    this.playAlarm(goal.id);
    const stack=document.getElementById('alarm-stack'); if(!stack||document.getElementById('alarm-card-'+goal.id)) return;
    const card=document.createElement('div'); card.id='alarm-card-'+goal.id;
    card.style.cssText='display:flex;align-items:center;gap:12px;background:rgba(80,10,10,.95);border:1px solid rgba(255,59,48,.5);border-radius:16px;padding:12px 16px;color:#fff;box-shadow:0 0 22px rgba(255,59,48,.4);';
    card.innerHTML=`<div style="font-size:22px;">⏰</div><div><div style="font-size:13px;font-weight:700;">${esc(msg)}</div><div style="font-size:11px;color:rgba(255,255,255,.6);">"${esc(goal.title.substring(0,40))}"</div></div><button style="background:rgba(255,255,255,.08);border:none;color:#fff;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:12px;flex:none;">✕</button>`;
    card.querySelector('button')?.addEventListener('click',()=>this.stopAlarm(goal.id));
    stack.appendChild(card);
  },
  playAlarm(goalId) {
    this.stopAlarm(goalId);
    try {
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      const ctx=new AC();
      const beep=()=>{ const t=ctx.currentTime; [880,1108,880,1318].forEach((freq,i)=>{ const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type='sine'; osc.frequency.value=freq; gain.gain.setValueAtTime(0.0001,t+i*0.16); gain.gain.exponentialRampToValueAtTime(0.22,t+i*0.16+0.02); gain.gain.exponentialRampToValueAtTime(0.0001,t+i*0.16+0.14); osc.connect(gain); gain.connect(ctx.destination); osc.start(t+i*0.16); osc.stop(t+i*0.16+0.15); }); };
      beep(); const loopId=setInterval(beep,1600); this._alarmAudio[goalId]={ctx,loopId};
    } catch(e){console.warn('WebAudio:',e);}
  },
  stopAlarm(goalId) {
    const e=this._alarmAudio[goalId]; if(e){clearInterval(e.loopId); try{e.ctx.close();}catch(_){} delete this._alarmAudio[goalId];}
    document.getElementById('alarm-card-'+goalId)?.remove();
  },
  scheduleReminders() {
    this._reminderTimers.forEach(t=>clearTimeout(t)); this._reminderTimers=[];
    const MAX = 2147483647, now = Date.now();
    const pool = [...StateManager.get('goals'), ...getGhostOccurrences(now, now + 7*86400000)];
    pool.filter(g=>!g.isProject && !g.done && g.scheduledAt && g.reminders?.length).forEach(g=>{
      g.reminders.forEach(mins=>{
        const delta = g.scheduledAt - mins*60000 - Date.now();
        if (delta > 0 && delta <= MAX) this._reminderTimers.push(setTimeout(()=>this.triggerAlarm(g, `In ${mins<60?mins+' min':(mins/60)+' h'}!`), delta));
      });
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   FOCUS HISTORY RENDERER
═══════════════════════════════════════════════════════════ */
const FocusHistoryRenderer = {
  render() {
    const wrap = document.getElementById('focus-history-list');
    if (!wrap) return;
    const items = StateManager.get('history').slice(0,50);
    if (!items.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">⏱</div><div class="empty-title">No sessions yet</div><div class="empty-sub">Complete a task to see it here</div></div>`; return; }
    wrap.innerHTML = items.map(h=>{
      const cat = CATS[h.cat]||CATS.business;
      // elapsed_ms is written correctly at completion time (TaskController.complete),
      // so this is a straight ms->min conversion — no extra correction needed here.
      const mins = Math.round((h.elapsed_ms||0)/60000);
      const hh = Math.floor(mins/60), mm = mins%60;
      const durStr = hh>0 ? `${hh}h ${mm}m` : `${mm}m`;
      return `<div class="glass glass-hover rounded-2xl p-5 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 rounded-xl accent-grad flex items-center justify-center flex-none"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path stroke-linecap="round" d="M12 9v4l2 2"/></svg></div>
          <div><p class="font-semibold">${esc(h.title)}</p><div class="flex gap-2 mt-1"><span class="tag-grey tag">${cat.label}</span></div></div>
        </div>
        <div class="text-right"><p class="font-semibold tabular-nums">${durStr}</p><p class="text-white/40 text-xs">${fmtRel(h.completedAt)}</p></div>
        <div class="glass-soft rounded-xl px-3 py-2 flex items-center gap-1.5 text-sm font-semibold ${h.gems>0?'text-accent':'text-white/30'} flex-none">${h.gems>0?`<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2 4 8l8 14 8-14-8-6Z"/></svg>+${h.gems}`:'No crystal'}</div>
      </div>`;
    }).join('');
  },
};

/* ═══════════════════════════════════════════════════════════
   STORE CONTROLLER
═══════════════════════════════════════════════════════════ */
const StoreController = {
  init() {
    document.getElementById('btn-cart')?.addEventListener('click', ()=>{ this.renderCart(); openModal('cartModal'); });
    document.getElementById('btn-purchases')?.addEventListener('click', ()=>{ this.renderPurchases(); openModal('purchasesModal'); });
    document.getElementById('btn-checkout')?.addEventListener('click', ()=>this.checkout());
    document.getElementById('cart-comment-input')?.addEventListener('input', ()=>{
      document.getElementById('cart-comment-error')?.classList.add('hidden');
    });
  },

  render() {
    const grid = document.getElementById('store-grid');
    if (!grid) return;
    const gems = StateManager.get('gems');
    const draft = StateManager.get('storeDraft');

    const shopGems = document.getElementById('shop-gems'); if (shopGems) shopGems.textContent = gems.toLocaleString('en-US');
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
      const n = StateManager.get('cart').length;
      cartCount.textContent = n ? `(${n})` : '';
      cartCount.classList.toggle('hidden', !n);
    }

    grid.innerHTML = STORE_ITEMS.map(item => {
      const qty = draft[item.id]||1;
      const cost = item.baseCost*qty;
      const ok = gems>=cost;
      return `<div class="glass glass-hover rounded-3xl p-5 flex flex-col${ok?'':' opacity-50'}" data-item="${item.id}">
        <div class="w-12 h-12 rounded-2xl accent-grad flex items-center justify-center mb-4 text-xl">${item.icon}</div>
        <h3 class="font-semibold mb-1">${esc(item.title)}</h3>
        <p class="text-white/40 text-sm flex-1">${esc(item.desc)}</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:10px 0;font-size:13px;">
          <button class="glass-soft glass-hover rounded-lg" data-action="qty" data-delta="-1" style="width:28px;height:28px;">−</button>
          <span>${item.unit==='min' ? item.baseTime*qty+' min' : qty+' '+item.unit}</span>
          <button class="glass-soft glass-hover rounded-lg" data-action="qty" data-delta="1" style="width:28px;height:28px;">+</button>
        </div>
        <button class="mt-1 glass-soft ${ok?'glass-hover':''} rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2" data-action="add-to-cart" ${ok?'':'disabled'}>
          <svg class="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2 4 8l8 14 8-14-8-6Z"/></svg>${cost} Crystal${cost!==1?'s':''}${ok?'':' · Not enough'}
        </button>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-item]').forEach(card=>{
      const id = card.dataset.item;
      card.querySelectorAll('[data-action="qty"]').forEach(btn=>{
        btn.addEventListener('click', e=>{
          e.stopPropagation();
          const d = {...StateManager.get('storeDraft')};
          d[id] = Math.max(1, (d[id]||1) + parseInt(btn.dataset.delta));
          StateManager.set('storeDraft', d);
          this.render();
        });
      });
      const buyBtn = card.querySelector('[data-action="add-to-cart"]');
      if (buyBtn && !buyBtn.disabled) buyBtn.addEventListener('click', ()=>this.addToCart(id));
    });
  },

  addToCart(itemId) {
    const item=STORE_ITEMS.find(i=>i.id===itemId); if(!item) return;
    const qty=StateManager.get('storeDraft')[itemId]||1, cost=item.baseCost*qty;
    StateManager.set('cart',[...StateManager.get('cart'),{...item,qty,cost}]);
    this.render();
    showToast(`🛒 ${item.title} added`, 1500);
  },
  renderCart() {
    const cl=document.getElementById('cart-list'), ct=document.getElementById('cart-total'); if(!cl) return;
    const cart=StateManager.get('cart');
    if(!cart.length){cl.innerHTML='<div style="text-align:center;padding:20px 0;color:rgba(255,255,255,.35);font-size:13px;">Cart is empty</div>'; if(ct) ct.textContent='0 💎'; return;}
    cl.innerHTML=cart.map((item,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:rgba(70,70,76,.18);border:1px solid rgba(255,255,255,.07);margin-bottom:8px;"><span>${item.icon} ${esc(item.title)} × ${item.qty}</span><span>${item.cost} 💎 <button data-i="${i}" data-action="remove-from-cart" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;margin-left:6px;">✕</button></span></div>`).join('');
    const total=cart.reduce((s,i)=>s+i.cost,0); if(ct) ct.textContent=`${total} 💎`;
    cl.querySelectorAll('[data-action="remove-from-cart"]').forEach(btn=>{ btn.addEventListener('click',()=>{ const c=[...StateManager.get('cart')]; c.splice(parseInt(btn.dataset.i),1); StateManager.set('cart',c); this.renderCart(); this.render(); }); });
    // Fresh comment box per cart session — a leftover comment from a
    // previous purchase should never silently apply to a new one.
    const commentInp = document.getElementById('cart-comment-input');
    if (commentInp) commentInp.value = '';
    document.getElementById('cart-comment-error')?.classList.add('hidden');
  },
  // Mandatory comment enforced before checkout completes: an empty/whitespace
  // comment blocks the purchase, shows the inline error, and focuses the box.
  checkout() {
    const cart=StateManager.get('cart'), total=cart.reduce((s,i)=>s+i.cost,0);
    if(!cart.length) { showToast('Cart is empty'); return; }
    if(StateManager.get('gems')<total){showToast('❌ Not enough crystals'); return;}

    const commentInp = document.getElementById('cart-comment-input');
    const comment = commentInp?.value.trim() || '';
    if (!comment) {
      document.getElementById('cart-comment-error')?.classList.remove('hidden');
      commentInp?.focus();
      showToast('📝 Add a short comment before checking out');
      return;
    }

    const purchases=[...StateManager.get('purchases'),...cart.map(i=>({...i,comment,purchasedAt:Date.now()}))];
    StateManager.patch({gems:StateManager.get('gems')-total, purchases, cart:[]});
    SyncManager.scheduleSync();
    closeModal('cartModal');
    updateCrystalChips();
    this.render();
    if (StateManager.get('currentView')==='profile') ProfileRenderer.render();
    checkAchievements();
    showToast(`🎉 Purchase complete! ${StateManager.get('gems')} 💎 left`);
  },
  renderPurchases() {
    const list=document.getElementById('purchases-list'); if(!list) return;
    const p=StateManager.get('purchases');
    if(!p.length){list.innerHTML='<div style="text-align:center;padding:20px 0;color:rgba(255,255,255,.35);font-size:13px;">No purchases yet</div>'; return;}
    list.innerHTML=p.slice().reverse().map(pu=>`<div style="padding:12px 14px;border-radius:14px;background:rgba(70,70,76,.18);border:1px solid rgba(255,255,255,.07);margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span>${pu.icon} ${esc(pu.title)} × ${pu.qty}</span>
        <span>${pu.cost} 💎 · ${fmtRel(pu.purchasedAt)}</span>
      </div>
      ${pu.comment?`<p style="font-size:12px;color:rgba(255,255,255,.45);margin-top:6px;font-style:italic;">"${esc(pu.comment)}"</p>`:''}
    </div>`).join('');
  },
};

/* ═══════════════════════════════════════════════════════════
   MACRO CONTROLLER — Projects / Folders (v8)
   All project data lives in goals[] with isProject:true.
   No more macroGoals array or Sprint concept.
═══════════════════════════════════════════════════════════ */
const MacroController = {

  init() {
    document.getElementById('btn-add-macro')?.addEventListener('click', ()=>this.openModal());
    document.getElementById('btn-new-macro')?.addEventListener('click', ()=>this.openModal());
    document.getElementById('btn-save-macro')?.addEventListener('click', ()=>this.save());
    document.getElementById('btn-delete-macro')?.addEventListener('click', ()=>this.delete(document.getElementById('macro-edit-id')?.value));
  },

  openModal(id=null, opts={}) {
    const mg = id ? StateManager.get('goals').find(x=>x.id===id && x.isProject) : null;
    document.getElementById('macroModalTitle').textContent = mg ? 'Edit Project' : 'New Project';
    document.getElementById('macro-edit-id').value = mg?.id || '';
    document.getElementById('macro-title').value = mg?.title || '';
    document.getElementById('macro-deadline').value = mg?.deadline || '';
    document.getElementById('macro-gems-reward').value = mg?.gemsReward ?? 50;
    document.getElementById('btn-delete-macro').classList.toggle('hidden', !mg);

    // Populate parent select (exclude self and all descendants to prevent cycles)
    const parentSel = document.getElementById('macro-parent-select');
    if (parentSel) {
      const options = buildParentOptionsFlat(id || null);
      parentSel.innerHTML = `<option value="">— Root (no parent) —</option>` + options.map(o=>`<option value="${o.id}">${esc(o.label)}</option>`).join('');
      parentSel.value = mg?.parentId || opts.presetParentId || '';
    }

    openModal('macroModal');
  },

  save() {
    const title = document.getElementById('macro-title')?.value.trim();
    if (!title) { showToast('Enter a project title'); return; }
    const id         = document.getElementById('macro-edit-id')?.value;
    const deadline   = document.getElementById('macro-deadline')?.value || '';
    const gemsReward = parseInt(document.getElementById('macro-gems-reward')?.value || '50');
    const parentId   = document.getElementById('macro-parent-select')?.value || null;

    const prevGoals = StateManager.get('goals');
    let goals;
    if (id) {
      goals = prevGoals.map(g => g.id===id ? { ...g, title, deadline, gemsReward, parentId } : g);
    } else {
      const newProject = {
        id: 'macro_'+Date.now().toString(36)+rnd(), title, deadline, gemsReward, parentId,
        isProject:true, recurrence:null, done:false, cat:'business', scheduledAt:null,
        duration_min:60, notes:'', subtasks:[], tags:[], reminders:[], location:'',
        cost:0, travelTime:0, participants:[], color:'', elapsed:0, startTime:null,
        paused:false, createdAt:Date.now(), isEvent:false,
      };
      goals = [newProject, ...prevGoals];
    }
    StateManager.patch({goals});
    SyncManager.scheduleSync();
    closeModal('macroModal');
    if (StateManager.get('currentView')==='profile') ProfileRenderer.render();
    if (StateManager.get('currentView')==='tasks') renderProjectsPanel();
    TimerController.renderSpheres();
    showToast(id ? '✅ Project updated' : '✅ Project created');
  },

  delete(id) {
    if (!id) return;
    const descendants = getDescendantIds(id);
    const total = descendants.length;
    const msg = total > 0
      ? `Delete this project and ${total} nested item${total===1?'':'s'}? This cannot be undone.`
      : 'Delete this project? It has no children.';
    if (!confirm(msg)) return;
    const toDelete = new Set([id, ...descendants]);
    const goals = StateManager.get('goals').filter(g => !toDelete.has(g.id));
    StateManager.patch({goals});
    SyncManager.scheduleSync();
    closeModal('macroModal');
    renderProjectsPanel();
    if (StateManager.get('currentView')==='profile') ProfileRenderer.render();
    TimerController.renderSpheres();
    showToast(`🗑 Deleted project and ${total} nested item${total===1?'':'s'}`);
  },
};

/* ═══════════════════════════════════════════════════════════
   ACHIEVEMENTS ENGINE (B4.3)
═══════════════════════════════════════════════════════════ */
const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    title: 'First Blood',
    emoji: '🎯',
    desc: 'Complete your first task',
    check: ctx => (ctx.history || []).length >= 1
  },
  {
    id: 'streak_3',
    title: 'Warming Up',
    emoji: '🔥',
    desc: 'Reach a 3-day streak',
    check: ctx => (ctx.streak?.days || 0) >= 3 || (ctx.streak?.best || 0) >= 3
  },
  {
    id: 'streak_7',
    title: 'Unstoppable',
    emoji: '⚡',
    desc: 'Reach a 7-day streak',
    check: ctx => (ctx.streak?.days || 0) >= 7 || (ctx.streak?.best || 0) >= 7
  },
  {
    id: 'streak_30',
    title: 'Legendary Master',
    emoji: '👑',
    desc: 'Reach a 30-day streak',
    check: ctx => (ctx.streak?.days || 0) >= 30 || (ctx.streak?.best || 0) >= 30
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    emoji: '🌅',
    desc: 'Complete a task before 08:00',
    check: ctx => (ctx.history || []).some(h => {
      const d = new Date(h.completedAt);
      return !isNaN(d.getTime()) && d.getHours() < 8;
    })
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    emoji: '🦉',
    desc: 'Complete a task after 23:00',
    check: ctx => (ctx.history || []).some(h => {
      const d = new Date(h.completedAt);
      return !isNaN(d.getTime()) && d.getHours() >= 23;
    })
  },
  {
    id: 'marathoner',
    title: 'Marathoner',
    emoji: '🏃',
    desc: 'Complete 10 Sport/Health tasks',
    check: ctx => (ctx.history || []).filter(h => h.cat === 'health').length >= 10
  },
  {
    id: 'shipper',
    title: 'Super Shipper',
    emoji: '🚀',
    desc: 'Complete 10 Business tasks',
    check: ctx => (ctx.history || []).filter(h => h.cat === 'business').length >= 10
  },
  {
    id: 'focus_hour',
    title: 'Deep Diver',
    emoji: '🧘',
    desc: 'Focus for 60+ minutes in one session',
    check: ctx => (ctx.history || []).some(h => (h.elapsed_ms || 0) >= 3600000)
  },
  {
    id: 'boss_slayer',
    title: 'Boss Slayer',
    emoji: '⚔️',
    desc: 'Defeat 5 Bosses of the Day',
    check: ctx => (ctx.history || []).filter(h => (h.bossBonus || 0) > 0).length >= 5
  },
  {
    id: 'project_complete',
    title: 'Grand Architect',
    emoji: '🏛️',
    desc: 'Complete an entire project',
    check: ctx => (ctx.goals || []).some(g => g.isProject && g.rewardPaid)
  },
  {
    id: 'comeback',
    title: 'Phoenix Rising',
    emoji: '🦅',
    desc: 'Complete a task after 3+ days pause',
    check: ctx => {
      const h = ctx.history || [];
      if (h.length < 2) return false;
      const sorted = [...h].sort((a,b) => a.completedAt - b.completedAt);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].completedAt - sorted[i-1].completedAt >= 3 * 86400000) return true;
      }
      return false;
    }
  }
];

function checkAchievements() {
  const st = StateManager.get();
  const achievements = { ...(st.achievements || {}) };
  const ctx = {
    state: st,
    goals: st.goals || [],
    history: st.history || [],
    streak: st.streak || { days: 0, lastDate: '', best: 0 },
    purchases: st.purchases || [],
    gems: st.gems || 0
  };

  let newlyUnlocked = false;
  for (const ach of ACHIEVEMENTS) {
    if (!achievements[ach.id] && ach.check(ctx)) {
      achievements[ach.id] = Date.now();
      newlyUnlocked = true;
      showPopup('ach', '🏅', ach.title, ach.desc);
    }
  }

  if (newlyUnlocked) {
    StateManager.patch({ achievements });
    SyncManager.scheduleSync();
    if (StateManager.get('currentView') === 'profile' && typeof ProfileRenderer !== 'undefined' && ProfileRenderer.render) {
      ProfileRenderer.render();
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   INSIGHTS & ANALYTICS RENDERER (B3)
═══════════════════════════════════════════════════════════ */
const InsightsRenderer = {
  _focusDays: 7,

  render() {
    const root = document.getElementById('insights-root');
    if (!root) return;
    const history = StateManager.get('history') || [];

    root.innerHTML = `
      ${this.renderHeatmap(history)}
      ${this.renderFocusDonut(history)}
      ${this.renderHourlyProductivity(history)}
      ${this.renderWeekOverWeek(history)}
    `;

    root.querySelectorAll('[data-action="toggle-focus-days"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.days, 10);
        if (days && days !== this._focusDays) {
          this._focusDays = days;
          this.render();
        }
      });
    });
  },

  renderHeatmap(history) {
    const counts = {};
    (history || []).forEach(h => {
      const dk = dateKey(h.completedAt);
      counts[dk] = (counts[dk] || 0) + 1;
    });

    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek));
    const days = 26 * 7;
    const startDate = new Date(endDate.getTime() - (days - 1) * 86400000);

    const cellSize = 11;
    const gap = 3;
    const width = 26 * (cellSize + gap);
    const height = 7 * (cellSize + gap);

    let rects = '';
    const cur = new Date(startDate);
    for (let c = 0; c < 26; c++) {
      for (let r = 0; r < 7; r++) {
        const dk = dateKey(cur.getTime());
        const isFuture = cur.getTime() > now.getTime();
        const cnt = isFuture ? 0 : (counts[dk] || 0);
        let fill = 'rgba(255,255,255,0.06)';
        if (!isFuture) {
          if (cnt >= 5) fill = '#FF3B30';
          else if (cnt >= 3) fill = 'rgba(255,59,48,0.7)';
          else if (cnt >= 1) fill = 'rgba(255,59,48,0.35)';
        }
        const x = c * (cellSize + gap);
        const y = r * (cellSize + gap);
        const label = isFuture ? 'Future' : `${dk}: ${cnt} completed`;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2.5" fill="${fill}" data-date="${dk}"><title>${label}</title></rect>`;
        cur.setDate(cur.getDate() + 1);
      }
    }

    return `
      <div class="rounded-2xl p-4" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <p class="text-xs font-semibold uppercase tracking-wider text-white/60">26-Week Activity Heatmap</p>
          <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:rgba(255,255,255,.4);">
            <span>Less</span>
            <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(255,255,255,0.06);"></span>
            <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(255,59,48,0.35);"></span>
            <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(255,59,48,0.7);"></span>
            <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#FF3B30;"></span>
            <span>More</span>
          </div>
        </div>
        <div style="overflow-x:auto;padding-bottom:4px;" class="hide-scrollbar">
          <svg viewBox="0 0 ${width} ${height}" style="width:${width}px;max-width:none;display:block;">
            ${rects}
          </svg>
        </div>
      </div>`;
  },

  renderFocusDonut(history) {
    const days = this._focusDays || 7;
    const cutoff = Date.now() - days * 86400000;
    const recent = (history || []).filter(h => h.completedAt >= cutoff);

    const catTotals = { business: 0, health: 0, study: 0, life: 0 };
    let zeroElapsedCount = 0;
    recent.forEach(h => {
      const cat = ['business', 'health', 'study', 'life'].includes(h.cat) ? h.cat : (h.cat === 'creative' ? 'life' : 'business');
      const ms = h.elapsed_ms || 0;
      if (ms === 0) zeroElapsedCount++;
      catTotals[cat] = (catTotals[cat] || 0) + ms;
    });

    const totalMs = Object.values(catTotals).reduce((a, b) => a + b, 0);
    const majorityZero = recent.length > 0 && (zeroElapsedCount / recent.length > 0.5 || totalMs === 0);

    const circ = 238.76; // 2 * PI * 38
    let offset = 0;
    let circles = '';
    if (totalMs > 0) {
      for (const [cat, ms] of Object.entries(catTotals)) {
        if (ms <= 0) continue;
        const color = (CATS[cat] || CATS.business).color;
        const dash = (ms / totalMs) * circ;
        circles += `<circle cx="50" cy="50" r="38" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)" />`;
        offset += dash;
      }
    } else {
      circles = `<circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12" />`;
    }

    const totalHrs = Math.floor(totalMs / 3600000);
    const totalMins = Math.round((totalMs % 3600000) / 60000);
    const totalCenterText = totalHrs > 0 ? `${totalHrs}h ${totalMins}m` : `${totalMins}m`;

    const legendItems = Object.entries(catTotals).map(([cat, ms]) => {
      const color = (CATS[cat] || CATS.business).color;
      const label = (CATS[cat] || CATS.business).label;
      const h = Math.floor(ms / 3600000);
      const m = Math.round((ms % 3600000) / 60000);
      const str = h > 0 ? `${h}h ${m}m` : `${m}m`;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:999px;background:${color};flex:none;"></span>
            <span class="text-xs text-white/70">${esc(label)}</span>
          </div>
          <span class="text-xs font-semibold tabular-nums text-white/90">${str}</span>
        </div>`;
    }).join('');

    return `
      <div class="rounded-2xl p-4" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap;">
          <p class="text-xs font-semibold uppercase tracking-wider text-white/60">Focus Time by Category</p>
          <div style="display:flex;gap:4px;background:rgba(255,255,255,.06);padding:2px;border-radius:10px;">
            <button class="text-[11px] px-2.5 py-1 rounded-lg font-medium ${days===7?'bg-white/20 text-white font-semibold':'text-white/50'}" data-action="toggle-focus-days" data-days="7">7d</button>
            <button class="text-[11px] px-2.5 py-1 rounded-lg font-medium ${days===30?'bg-white/20 text-white font-semibold':'text-white/50'}" data-action="toggle-focus-days" data-days="30">30d</button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div style="position:relative;width:140px;height:140px;margin:0 auto;">
            <svg viewBox="0 0 100 100" style="width:140px;height:140px;display:block;">
              ${circles}
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
              <span class="text-[11px] text-white/40">Total</span>
              <span class="text-sm font-bold tabular-nums text-white">${totalCenterText}</span>
            </div>
          </div>

          <div class="space-y-2">
            ${legendItems}
          </div>
        </div>

        ${majorityZero ? `
          <div class="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[11px] text-white/40">
            <span style="color:#FFCC00;">💡</span>
            <span>Используй таймер, чтобы видеть время</span>
          </div>` : ''}
      </div>`;
  },

  renderHourlyProductivity(history) {
    const counts = new Array(24).fill(0);
    (history || []).forEach(h => {
      const d = new Date(h.completedAt);
      if (!isNaN(d.getTime())) {
        counts[d.getHours()]++;
      }
    });

    let maxCount = 0;
    let goldenHour = 10;
    for (let i = 0; i < 24; i++) {
      if (counts[i] > maxCount) {
        maxCount = counts[i];
        goldenHour = i;
      }
    }

    const nextHour = (goldenHour + 1) % 24;
    const goldenStr = maxCount > 0
      ? `Твой золотой час: ${pad(goldenHour)}:00–${pad(nextHour)}:00`
      : 'Выполняй задачи, чтобы найти свой золотой час';

    const barW = 8;
    const gap = 4;
    const svgW = 24 * (barW + gap);
    const svgH = 65;
    const maxBarH = 45;

    let bars = '';
    for (let i = 0; i < 24; i++) {
      const cnt = counts[i];
      const h = maxCount > 0 ? Math.max(3, Math.round((cnt / maxCount) * maxBarH)) : 2;
      const x = i * (barW + gap);
      const y = maxBarH - h + 5;
      const isGold = i === goldenHour && maxCount > 0;
      const fill = isGold ? '#FF3B30' : (cnt > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)');
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2" fill="${fill}"><title>${pad(i)}:00–${pad((i+1)%24)}:00 : ${cnt} tasks</title></rect>`;
    }

    return `
      <div class="rounded-2xl p-4" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
          <p class="text-xs font-semibold uppercase tracking-wider text-white/60">Productivity by Hour</p>
          <span class="text-xs font-medium text-accent" style="color:#FFCC00;">⭐ ${esc(goldenStr)}</span>
        </div>
        <div style="overflow-x:auto;padding-bottom:2px;" class="hide-scrollbar">
          <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${svgW}px;height:${svgH}px;display:block;">
            ${bars}
            <text x="2" y="${svgH - 2}" font-size="8" fill="rgba(255,255,255,0.3)">00:00</text>
            <text x="${6 * (barW+gap)}" y="${svgH - 2}" font-size="8" fill="rgba(255,255,255,0.3)">06:00</text>
            <text x="${12 * (barW+gap)}" y="${svgH - 2}" font-size="8" fill="rgba(255,255,255,0.3)">12:00</text>
            <text x="${18 * (barW+gap)}" y="${svgH - 2}" font-size="8" fill="rgba(255,255,255,0.3)">18:00</text>
            <text x="${svgW - 24}" y="${svgH - 2}" font-size="8" fill="rgba(255,255,255,0.3)">23:00</text>
          </svg>
        </div>
      </div>`;
  },

  renderWeekOverWeek(history) {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0).getTime();
    const lastWeekStart = thisWeekStart - 7 * 86400000;
    const lastWeekEnd = thisWeekStart - 1;

    const thisWeek = (history || []).filter(h => h.completedAt >= thisWeekStart);
    const lastWeek = (history || []).filter(h => h.completedAt >= lastWeekStart && h.completedAt <= lastWeekEnd);

    const twTasks = thisWeek.length;
    const lwTasks = lastWeek.length;
    const dTasks = twTasks - lwTasks;

    const twFocusH = thisWeek.reduce((s, h) => s + (h.elapsed_ms || 0), 0) / 3600000;
    const lwFocusH = lastWeek.reduce((s, h) => s + (h.elapsed_ms || 0), 0) / 3600000;
    const dFocus = twFocusH - lwFocusH;

    const twGems = thisWeek.reduce((s, h) => s + (h.gems || 0) + (h.bossBonus || 0) + (h.comboBonus || 0), 0);
    const lwGems = lastWeek.reduce((s, h) => s + (h.gems || 0) + (h.bossBonus || 0) + (h.comboBonus || 0), 0);
    const dGems = twGems - lwGems;

    const renderDelta = (d, isHour = false) => {
      const valStr = isHour ? Math.abs(d).toFixed(1) + 'h' : Math.abs(d);
      if (d > 0) return `<span class="text-xs font-semibold text-emerald-400">▲ +${valStr}</span>`;
      if (d < 0) return `<span class="text-xs font-semibold text-rose-400">▼ -${valStr}</span>`;
      return `<span class="text-xs text-white/40">― 0</span>`;
    };

    return `
      <div class="rounded-2xl p-4" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);">
        <p class="text-xs font-semibold uppercase tracking-wider text-white/60 mb-3">Week over Week</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="glass-soft rounded-xl p-3 flex flex-col justify-between">
            <span class="text-[11px] text-white/40">Tasks Completed</span>
            <div class="flex items-baseline justify-between mt-1">
              <span class="text-xl font-bold tabular-nums text-white">${twTasks}</span>
              ${renderDelta(dTasks)}
            </div>
            <span class="text-[10px] text-white/30 mt-1">Prev week: ${lwTasks}</span>
          </div>

          <div class="glass-soft rounded-xl p-3 flex flex-col justify-between">
            <span class="text-[11px] text-white/40">Focus Hours</span>
            <div class="flex items-baseline justify-between mt-1">
              <span class="text-xl font-bold tabular-nums text-white">${twFocusH.toFixed(1)}h</span>
              ${renderDelta(dFocus, true)}
            </div>
            <span class="text-[10px] text-white/30 mt-1">Prev week: ${lwFocusH.toFixed(1)}h</span>
          </div>

          <div class="glass-soft rounded-xl p-3 flex flex-col justify-between">
            <span class="text-[11px] text-white/40">Crystals Earned</span>
            <div class="flex items-baseline justify-between mt-1">
              <span class="text-xl font-bold tabular-nums text-accent flex items-center gap-1">${twGems} 💎</span>
              ${renderDelta(dGems)}
            </div>
            <span class="text-[10px] text-white/30 mt-1">Prev week: ${lwGems} 💎</span>
          </div>
        </div>
      </div>`;
  }
};

/* ═══════════════════════════════════════════════════════════
   PROFILE RENDERER
═══════════════════════════════════════════════════════════ */
const ProfileRenderer = {
  render() {
    const st=StateManager.get();
    // A10: level is based on lifetime earned gems (current balance + all history awards),
    // so spending crystals in the shop never lowers the player's level.
    const lifetime = Math.max(st.gems, st.history.reduce((s,h)=>s+(h.gems||0),0));
    const lv=getLevel(lifetime);

    syncProfileNameEverywhere();
    const levelEl = document.getElementById('profile-level'); if (levelEl) levelEl.textContent = `${lv.emoji} ${lv.label}`;

    // Level progress bar — progress within the current level band toward the next
    const idx = LEVELS.findIndex(l=>l.label===lv.label);
    const next = LEVELS[idx+1];
    const bar = document.getElementById('profile-level-bar');
    if (bar) {
      if (next) {
        const span = next.min - lv.min;
        const into = lifetime - lv.min;
        bar.style.width = Math.max(4,Math.min(100, Math.round(into/span*100)))+'%';
      } else bar.style.width = '100%';
    }

    // A10: exclude project folders from task stats
    const taskGoals = st.goals.filter(g=>!g.isProject);
    const doneCount = taskGoals.filter(g=>g.done).length;
    const totalCreated = document.getElementById('stat-total-created'); if (totalCreated) totalCreated.textContent = taskGoals.length;
    const progressEl = document.getElementById('stat-progress'); if (progressEl) progressEl.textContent = taskGoals.length ? Math.round(doneCount/taskGoals.length*100)+'%' : '0%';
    const overdue = taskGoals.filter(g=>!g.done && g.scheduledAt && g.scheduledAt < Date.now()).length;
    const successRate = (doneCount+overdue) > 0 ? Math.round(doneCount/(doneCount+overdue)*100) : 0;
    const successEl = document.getElementById('stat-success-rate'); if (successEl) successEl.textContent = successRate+'%';
    const streakEl = document.getElementById('stat-streak');
    if (streakEl) streakEl.innerHTML = `🔥 ${st.streak.days}`;

    this._renderMacroList();
    this._renderPurchaseHistory();
    this._renderTrophyCase();
    InsightsRenderer.render();
    updateCrystalChips();
  },

  _renderTrophyCase() {
    const trophyGrid = document.getElementById('trophy-case-grid');
    const trophyBadge = document.getElementById('trophy-count-badge');
    if (!trophyGrid) return;

    const st = StateManager.get();
    const achievements = st.achievements || {};
    const unlockedCount = ACHIEVEMENTS.filter(a => !!achievements[a.id]).length;
    if (trophyBadge) trophyBadge.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length}`;

    trophyGrid.innerHTML = ACHIEVEMENTS.map(ach => {
      const unlockedAt = achievements[ach.id];
      if (unlockedAt) {
        const d = new Date(unlockedAt);
        const dStr = !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unlocked';
        return `
          <div class="rounded-2xl p-3 flex flex-col items-center text-center justify-between" style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.35);min-height:115px;">
            <div class="text-3xl mb-1">${ach.emoji}</div>
            <div class="min-w-0 w-full">
              <p class="font-semibold text-xs truncate" title="${esc(ach.title)}">${esc(ach.title)}</p>
              <p class="text-[10px] text-white/50 truncate" title="${esc(ach.desc)}">${esc(ach.desc)}</p>
            </div>
            <span class="text-[9px] font-semibold text-accent mt-2 px-2 py-0.5 rounded-full" style="background:rgba(255,204,0,.2);color:#FFCC00;">Unlocked ${dStr}</span>
          </div>`;
      } else {
        return `
          <div class="rounded-2xl p-3 flex flex-col items-center text-center justify-between" style="background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.12);opacity:.45;min-height:115px;">
            <div class="text-3xl mb-1" style="filter:grayscale(1);">${ach.emoji}</div>
            <div class="min-w-0 w-full">
              <p class="font-semibold text-xs truncate text-white/80" title="${esc(ach.title)}">${esc(ach.title)}</p>
              <p class="text-[10px] text-white/40 truncate" title="${esc(ach.desc)}">${esc(ach.desc)}</p>
            </div>
            <span class="text-[9px] text-white/40 mt-2 px-2 py-0.5 rounded-full bg-white/5">Locked</span>
          </div>`;
      }
    }).join('');
  },

  _renderMacroList() {
    const listWrap = document.getElementById('macro-goals-list');
    if (!listWrap) return;
    const macros = StateManager.get('goals').filter(g => g.isProject && !g.parentId);

    if (!macros.length) {
      listWrap.innerHTML = `<div class="empty-state" style="padding:20px 0;"><div class="empty-icon">🎯</div><div class="empty-title">No goals yet</div><div class="empty-sub">Tap + Add Goal to create one</div></div>`;
      return;
    }
    listWrap.innerHTML = macros.map(mg => {
      const prog = computeNodeProgress(mg.id);
      const pct  = prog.total > 0 ? Math.round(prog.done / prog.total * 100) : 0;
      return `<div data-macro-id="${mg.id}" style="cursor:pointer;">
        <div class="flex justify-between text-sm mb-1.5"><span>${esc(mg.title)}</span><span class="text-accent font-semibold">${pct}%</span></div>
        <div class="h-2.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full accent-grad rounded-full" style="width:${pct}%"></div></div>
        <p class="text-white/35 text-xs mt-1">${prog.total?`${prog.done}/${prog.total} tasks`:'No tasks'}${mg.deadline && parseDateSafe(mg.deadline) ? ' · due '+parseDateSafe(mg.deadline).toLocaleDateString('en-US') : ''} · 💎 ${mg.gemsReward||50}</p>
      </div>`;
    }).join('');
    listWrap.querySelectorAll('[data-macro-id]').forEach(el=>{
      el.addEventListener('click', ()=>MacroController.openModal(el.dataset.macroId));
    });
  },

  _renderPurchaseHistory() {
    const listWrap = document.getElementById('profile-purchase-history');
    if (!listWrap) return;
    const purchases = StateManager.get('purchases').slice().reverse().slice(0,20);
    if (!purchases.length) { listWrap.innerHTML = `<div class="empty-state" style="padding:20px 0;"><div class="empty-icon">🛍️</div><div class="empty-title">No purchases yet</div></div>`; return; }
    listWrap.innerHTML = purchases.map(p => `
      <div class="glass-soft glass-hover rounded-2xl p-4">
        <div class="flex items-center justify-between">
          <div><p class="text-sm font-medium">${p.icon} ${esc(p.title)}${p.qty>1?' × '+p.qty:''}</p><p class="text-white/40 text-xs">${fmtRel(p.purchasedAt)}</p></div>
          <span class="text-accent text-sm font-semibold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2 4 8l8 14 8-14-8-6Z"/></svg>${p.cost}</span>
        </div>
        ${p.comment?`<p class="text-white/45 text-xs mt-2" style="font-style:italic;">"${esc(p.comment)}"</p>`:''}
      </div>`).join('');
  },
};

/* ═══════════════════════════════════════════════════════════
   SETTINGS PANEL
═══════════════════════════════════════════════════════════ */
function renderSettingsPanel() {
  const nameInp = document.getElementById('settings-profile-name');
  if (nameInp) nameInp.value = StateManager.get('profileName') || 'You';

  const tokenInp = document.getElementById('settings-tg-token');
  const chatInp = document.getElementById('settings-tg-chat');
  const webhookInp = document.getElementById('settings-webhook');
  if (tokenInp) tokenInp.value = StateManager.get('tgToken')||'';
  if (chatInp) chatInp.value = StateManager.get('tgChatId')||'';
  if (webhookInp) webhookInp.value = StateManager.get('webhookUrl')||'';
  const syncKeyInp = document.getElementById('settings-sync-key');
  if (syncKeyInp) syncKeyInp.value = localStorage.getItem('nova-sync-key') || '';

  const mgr = document.getElementById('tags-manager');
  if (mgr) {
    mgr.innerHTML = StateManager.get('tags').map(t=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.04);margin-bottom:6px;"><span style="width:12px;height:12px;border-radius:999px;flex:none;background:${t.color}"></span><span style="flex:1;font-size:13px;">${esc(t.name)}</span><button data-id="${t.id}" data-action="delete-tag" style="background:none;border:none;color:rgba(255,255,255,.35);cursor:pointer;">✕</button></div>`).join('');
    mgr.querySelectorAll('[data-action="delete-tag"]').forEach(btn=>{ btn.addEventListener('click',()=>{ StateManager.set('tags',StateManager.get('tags').filter(t=>t.id!==btn.dataset.id)); renderSettingsPanel(); renderTagFilterRow(); }); });
  }
  const pal = document.getElementById('new-tag-color-pal');
  if (pal) {
    pal.innerHTML = TAG_PALETTE.map((c,i)=>`<button type="button" class="color-dot${i===0?' active':''}" data-color="${c}" style="width:26px;height:26px;border-radius:999px;border:2px solid ${i===0?'#fff':'transparent'};cursor:pointer;background:${c};${i===0?'box-shadow:0 0 0 2px rgba(255,59,48,.6);':''}"></button>`).join('');
    pal.querySelectorAll('.color-dot').forEach(dot=>{
      dot.addEventListener('click',()=>{
        pal.querySelectorAll('.color-dot').forEach(d=>{d.style.borderColor='transparent'; d.style.boxShadow='none'; d.classList.remove('active');});
        dot.style.borderColor='#fff'; dot.style.boxShadow='0 0 0 2px rgba(255,59,48,.6)'; dot.classList.add('active');
      });
    });
  }
  // 2.1 — Sync dim-recurring toggle to current state
  const dimToggle = document.getElementById('settings-dim-recurring');
  if (dimToggle) dimToggle.classList.toggle('on', !!StateManager.get('dimRecurring'));
}

function initSettingsHandlers() {
  // Saving Settings persists the display name into StateManager (which
  // writes it to localStorage under 'nova-profile-name') and immediately
  // re-syncs every on-screen copy of the name via syncProfileNameEverywhere().
  document.getElementById('btn-save-settings')?.addEventListener('click', ()=>{
    const nameVal = document.getElementById('settings-profile-name')?.value.trim();
    const dimRecurring = !!document.getElementById('settings-dim-recurring')?.classList.contains('on');
    const syncKeyVal = document.getElementById('settings-sync-key')?.value;
    if (syncKeyVal !== undefined) localStorage.setItem('nova-sync-key', syncKeyVal.trim());
    StateManager.patch({
      profileName: nameVal || 'You',
      tgToken: document.getElementById('settings-tg-token')?.value.trim()||'',
      tgChatId: document.getElementById('settings-tg-chat')?.value.trim()||'',
      webhookUrl: document.getElementById('settings-webhook')?.value.trim()||'',
      dimRecurring,
    });
    SyncManager.scheduleSync();
    SyncManager.loadFromCloud();
    closeModal('modal-settings');
    syncProfileNameEverywhere();
    if (StateManager.get('currentView')==='profile') ProfileRenderer.render();
    if (StateManager.get('currentView')==='calendar') CalendarController.render();
    showToast('✅ Settings saved');
  });
  document.getElementById('btn-add-tag')?.addEventListener('click', ()=>{
    const nameInp=document.getElementById('new-tag-name'); const name=nameInp?.value.trim(); if(!name) return;
    const activeDot=document.querySelector('#new-tag-color-pal .color-dot.active');
    const color=activeDot?.dataset.color||TAG_PALETTE[StateManager.get('tags').length%TAG_PALETTE.length];
    StateManager.set('tags',[...StateManager.get('tags'),{id:'tag_'+Date.now().toString(36)+rnd(),name,color}]);
    if(nameInp) nameInp.value='';
    renderSettingsPanel(); renderTagFilterRow();
  });
  document.getElementById('btn-export-data')?.addEventListener('click', exportData);
  document.getElementById('btn-import-data')?.addEventListener('click', ()=>{
    const inp = document.getElementById('import-file');
    if (inp) inp.click();
  });
  const handleImportFile = (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        if (!Array.isArray(raw.goals)) { showToast('⚠️ Invalid backup: goals not found'); return; }
        StateManager.pushUndoSnapshot();
        const imported = { goals:raw.goals, history:raw.history||[], purchases:raw.purchases||[], gems:raw.gems||0,
          streak:raw.streak||{days:0,lastDate:'',doneToday:false,best:0}, tags:raw.tags||[],
          routines:raw.routines||[], sleepSettings:raw.sleepSettings||StateManager.get('sleepSettings'),
          profileName:raw.profileName||StateManager.get('profileName') };
        const rawForMigration = { goals: imported.goals, macroGoals: [] };
        migrateLegacyProjectData(rawForMigration);
        imported.goals = rawForMigration.goals;
        StateManager.patch(imported);
        SyncManager.scheduleSync();
        refreshEverything();
        showToast('📥 Data imported!');
      } catch(err) { showToast('⚠️ Failed to parse backup file'); console.error('[Import]', err); }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-imported
  };
  document.getElementById('import-file')?.addEventListener('change', handleImportFile);
  document.getElementById('btn-reset-data')?.addEventListener('click', resetData);
  document.getElementById('btn-load-demo')?.addEventListener('click', loadDemoData);
  document.getElementById('settings-dim-recurring')?.addEventListener('click', (e)=>{
    e.currentTarget.classList.toggle('on');
  });
}

function exportData() {
  const { tgToken, tgChatId, webhookUrl, ...safe } = StateManager.get();
  const data = { ...safe, exportedAt: Date.now() };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=`nova-os-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('💾 Data exported');
}
async function resetData() {
  if(!confirm('Delete ALL data? This cannot be undone!')) return;
  // Push empty state to cloud FIRST — otherwise the server will restore everything on next load
  await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nova-key': localStorage.getItem('nova-sync-key')||'' },
    body: JSON.stringify({ userId: SyncManager.getUid(), updatedAt: Date.now(),
      goals:[], history:[], gems:0, streak:{days:0,lastDate:'',doneToday:false,best:0} }),
  }).catch(()=>{});
  ['nova-goals','nova-history','nova-gems','nova-streak','nova-purchases','nova-macros','nova-tags',
   'nova-pomo','nova-sleep','nova-uid','nova-theme','nova-routines','nova-tg-token','nova-tg-chat',
   'nova-webhook','nova-profile-name','nova-updatedAt','nova-dim-recurring','nova-migrated-v8',
   'nova-active-task','nova-sync-v2','nova-boot',
   'lifeos-goals','lifeos-history','lifeos-gems','lifeos-streak2','lifeos-purchases',
   'lifeos-macros','lifeos-tags','lifeos-pomo'].forEach(k=>localStorage.removeItem(k));
  // nova-sync-key is intentionally NOT removed so the user stays authenticated
  location.reload();
}
function loadDemoData() {
  const now=Date.now(), day=86400000;
  // Demo projects (isProject:true goals)
  const demoProjects=[
    {id:'macro_demo',  title:'🚀 Launch SaaS project', isProject:true, parentId:null, deadline:new Date(now+day*60).toISOString().slice(0,10), gemsReward:100, cat:'business', done:false, scheduledAt:null, duration_min:60, subtasks:[], tags:[], reminders:[], notes:'', location:'', cost:0, travelTime:0, participants:[], color:'', elapsed:0, startTime:null, paused:false, createdAt:now-day*10, isEvent:false, recurrence:null, elapsed_ms:0},
    {id:'sprint_demo_1', title:'Sprint 1 — MVP', isProject:true, parentId:'macro_demo', deadline:'', gemsReward:0, cat:'business', done:false, scheduledAt:null, duration_min:60, subtasks:[], tags:[], reminders:[], notes:'', location:'', cost:0, travelTime:0, participants:[], color:'', elapsed:0, startTime:null, paused:false, createdAt:now-day*9, isEvent:false, recurrence:null, elapsed_ms:0},
    {id:'sprint_demo_2', title:'Sprint 2 — Templates', isProject:true, parentId:'macro_demo', deadline:'', gemsReward:0, cat:'business', done:false, scheduledAt:null, duration_min:60, subtasks:[], tags:[], reminders:[], notes:'', location:'', cost:0, travelTime:0, participants:[], color:'', elapsed:0, startTime:null, paused:false, createdAt:now-day*8, isEvent:false, recurrence:null, elapsed_ms:0},
    {id:'macro_demo_2', title:'🏃 Run a half marathon', isProject:true, parentId:null, deadline:new Date(now+day*90).toISOString().slice(0,10), gemsReward:80, cat:'health', done:false, scheduledAt:null, duration_min:60, subtasks:[], tags:[], reminders:[], notes:'', location:'', cost:0, travelTime:0, participants:[], color:'', elapsed:0, startTime:null, paused:false, createdAt:now-day*8, isEvent:false, recurrence:null, elapsed_ms:0},
  ];
  const demoGoals=[
    {id:'demo_1',title:'Read "Atomic Habits"',cat:'study',priority:'high',color:'#5E5CE6',scheduledAt:now-3600000,duration_min:60,tags:[],subtasks:[{id:'st1',text:'Chapters 1-5',done:true},{id:'st2',text:'Notes',done:false}],notes:'Key insights on habits',done:false,elapsed:0,createdAt:now-day*3,isProject:false,parentId:null,isEvent:false,recurrence:null,elapsed_ms:0},
    {id:'demo_2',title:'Strength workout',cat:'health',priority:'high',color:'#FF9500',scheduledAt:now+7200000,duration_min:45,tags:[],subtasks:[],notes:'Bench, squats, deadlift',done:false,elapsed:0,createdAt:now-day,isProject:false,parentId:'macro_demo_2',isEvent:false,recurrence:null,elapsed_ms:0},
    {id:'demo_3',title:'Ship landing MVP',cat:'business',priority:'mid',color:'#FF3B30',scheduledAt:now+day,duration_min:120,tags:[],subtasks:[{id:'st3',text:'Design',done:true},{id:'st4',text:'Build',done:true},{id:'st5',text:'Deploy',done:false}],notes:'',done:false,elapsed:3600,createdAt:now-day*5,isProject:false,parentId:'sprint_demo_1',isEvent:false,recurrence:null,elapsed_ms:3600000},
    {id:'demo_4',title:'10-minute meditation',cat:'life',priority:'low',color:'#34C759',scheduledAt:now+1800000,duration_min:10,tags:[],subtasks:[],notes:"Breathe, don't think",done:false,elapsed:0,createdAt:now,isProject:false,parentId:null,isEvent:false,recurrence:null,elapsed_ms:0},
    {id:'demo_5',title:'Draft planning template',cat:'business',priority:'mid',color:'#F72585',scheduledAt:now+day*2,duration_min:90,tags:[],subtasks:[],notes:'',done:false,elapsed:0,createdAt:now-day*2,isProject:false,parentId:'sprint_demo_2',isEvent:false,recurrence:null,elapsed_ms:0},
  ];
  const demoHistory=[
    {id:'dh1',goalId:'demo_old_1',title:'Morning 5k run',cat:'health',color:'#FF9500',completedAt:now-3600000,elapsed_ms:1800000,gems:3},
    {id:'dh2',goalId:'demo_old_2',title:'Team standup call',cat:'business',color:'#FF3B30',completedAt:now-86400000,elapsed_ms:3600000,gems:3},
    {id:'dh3',goalId:'demo_old_3',title:'Study Vercel KV API',cat:'study',color:'#5E5CE6',completedAt:now-172800000,elapsed_ms:5400000,gems:0},
    {id:'dh4',goalId:'demo_old_4',title:'Sketch wireframe',cat:'creative',color:'#F72585',completedAt:now-259200000,elapsed_ms:2700000,gems:0},
    {id:'dh5',goalId:'demo_old_5',title:'Family dinner',cat:'life',color:'#34C759',completedAt:now-345600000,elapsed_ms:7200000,gems:0},
  ];
  const st=StateManager.get();
  const demoIds = new Set([...demoProjects, ...demoGoals].map(g=>g.id));
  const goals=[...demoProjects,...demoGoals,...st.goals.filter(g=>!demoIds.has(g.id))];
  const history=[...demoHistory,...st.history.filter(h=>!h.id.startsWith('dh'))];
  StateManager.patch({goals,history,gems:Math.max(st.gems,27),streak:{days:5,lastDate:dateKey(),doneToday:true,best:Math.max(st.streak.best||0,5)}});
  localStorage.setItem('nova-migrated-v8', '1');
  SyncManager.scheduleSync();
  closeModal('modal-settings');
  refreshEverything();
  showToast('🎉 Demo data loaded!');
}

/* ═══════════════════════════════════════════════════════════
   VOICE INPUT
═══════════════════════════════════════════════════════════ */
const VoiceInput = {
  _rec: null, _active: false, _lang: 'ru-RU', _baseTranscript: '',
  init() {
    try {
      this._lang = localStorage.getItem('nova-voice-lang') || 'ru-RU';
      const updateLangChips = () => {
        document.querySelectorAll('#voice-lang-chips button[data-lang]').forEach(b => {
          const on = b.dataset.lang === this._lang;
          b.classList.toggle('glass-soft', on);
          b.classList.toggle('active', on);
          b.classList.toggle('text-white/40', !on);
        });
      };
      updateLangChips();
      document.querySelectorAll('#voice-lang-chips button[data-lang]').forEach(b => {
        b.addEventListener('click', () => {
          this._lang = b.dataset.lang;
          localStorage.setItem('nova-voice-lang', this._lang);
          updateLangChips();
          if (this._rec) this._rec.lang = this._lang;
        });
      });

      document.getElementById('voiceMic')?.addEventListener('click', () => {
        if (this._active) this.stop(); else this.start();
      });

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { this._unsupported = true; return; }
      this._rec = new SR();
      this._rec.lang = this._lang;
      this._rec.continuous = true;
      this._rec.interimResults = true;

      this._rec.onresult = (e) => {
        let interim = '';
        let finalTxt = this._baseTranscript || '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            finalTxt += (finalTxt ? ' ' : '') + e.results[i][0].transcript.trim();
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        this._baseTranscript = finalTxt;
        const el = document.getElementById('voiceTranscript');
        if (el) el.value = finalTxt + (interim ? (finalTxt ? ' ' : '') + interim : '');
        const interimEl = document.getElementById('voiceInterim');
        if (interimEl) {
          interimEl.textContent = interim ? `... ${interim}` : '';
          interimEl.classList.toggle('hidden', !interim);
        }
      };

      this._rec.onerror = (e) => {
        this.stop();
        if (e?.error === 'not-allowed') showToast('Разреши доступ к микрофону');
        else if (e?.error && e.error !== 'no-speech') showToast(`🎤 Microphone error: ${e.error}`);
      };

      this._rec.onend = () => {
        this._active = false;
        const status = document.getElementById('voiceStatus');
        if (status) status.textContent = 'Ready';
        const dot = document.getElementById('voiceDot');
        if (dot) dot.style.background = 'rgba(255,255,255,0.4)';
      };
    } catch(e) { console.warn('Voice not supported', e); this._unsupported = true; }
  },

  start() {
    const dot = document.getElementById('voiceDot');
    const status = document.getElementById('voiceStatus');
    if (this._unsupported) { showToast('🎤 Voice input not supported in this browser'); return; }
    if (!this._rec) return;
    this._active = true;
    this._baseTranscript = document.getElementById('voiceTranscript')?.value || '';
    if (status) status.textContent = 'Listening...';
    if (dot) dot.style.background = '#FF3B30';
    try { this._rec.start(); } catch(e){}
  },

  stop() {
    this._active = false;
    try { this._rec?.stop(); } catch(e){}
    const dot = document.getElementById('voiceDot');
    const status = document.getElementById('voiceStatus');
    if (status) status.textContent = 'Ready';
    if (dot) dot.style.background = 'rgba(255,255,255,0.4)';
    const interimEl = document.getElementById('voiceInterim');
    if (interimEl) interimEl.classList.add('hidden');
  },
  apply(text) {
    if (!text || !text.trim()) return;
    const parsed=NLP.parse(text);
    closeModal('modal-voice');
    TaskController.openModal();
    setTimeout(()=>{
      const titleInp=document.getElementById('task-title-input');
      if (titleInp) titleInp.value = parsed.title;
      if (parsed.scheduledAt) {
        const d=new Date(parsed.scheduledAt);
        const dateInp=document.getElementById('task-date-input');
        const fromInp=document.getElementById('task-time-from-input');
        if (dateInp) dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        if (fromInp) fromInp.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      const prioBtn = document.querySelector(`#priority-ctrl .seg-btn[data-priority="${parsed.priority}"]`);
      if (prioBtn) {
        document.querySelectorAll('#priority-ctrl .seg-btn').forEach(b=>{b.style.background='rgba(255,255,255,.05)';b.style.color='rgba(255,255,255,.5)';b.classList.remove('active');});
        prioBtn.style.background='rgba(255,59,48,.18)'; prioBtn.style.color='#fff'; prioBtn.classList.add('active');
      }
      TaskController._selectedTags = parsed.tags;
      TaskController._activeCat = parsed.cat;
      TaskController._renderCategoryRow();
      TaskController._renderTagRow();
      const hint=document.getElementById('nlp-hint');
      if(hint){hint.textContent=`🎤 Parsed: ${parsed.title}${parsed.scheduledAt?' · '+fmtDateTime(parsed.scheduledAt):''}`;hint.classList.remove('hidden');}
    },120);
  },
};

/* ═══════════════════════════════════════════════════════════
   NLP PARSER
═══════════════════════════════════════════════════════════ */
const NLP = {
  parse(text, opts = {}) {
    const result={title:text,scheduledAt:null,priority:'mid',cat:'business',duration_min:DEFAULT_TIMER_MIN,tags:[]};
    let s=text;
    if(/\bp1\b/i.test(s)){result.priority='high'; s=s.replace(/\bp1\b/ig,'');}
    else if(/\bp3\b/i.test(s)){result.priority='low'; s=s.replace(/\bp3\b/ig,'');}
    else s=s.replace(/\bp2\b/ig,'');
    if (/\b(gym|workout|sport|run|training)\b/i.test(s)) result.cat='health';
    else if (/\b(school|study|exam|class|homework)\b/i.test(s)) result.cat='study';
    else if (/\b(life|home|family|errand)\b/i.test(s)) result.cat='life';
    else if (/\b(art|design|write|creative)\b/i.test(s)) result.cat='creative';
    const tagMatches=s.match(/@\S+/g)||[];
    const tags=StateManager.get('tags');
    tagMatches.forEach(m=>{ const name=m.slice(1).toLowerCase(); let t=tags.find(t=>t.name.toLowerCase()===name); if(!t){ if (opts.dryRun) return; t={id:'tag_'+Date.now().toString(36)+rnd(),name,color:TAG_PALETTE[tags.length%TAG_PALETTE.length]}; tags.push(t); StateManager.set('tags',tags);} result.tags.push(t.id); });
    s=s.replace(/@\S+/g,'').trim();
    const durM=s.match(/for\s+(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
    if(durM){const num=parseInt(durM[1]); result.duration_min=/h/i.test(durM[2])?num*60:num; s=s.replace(durM[0],'').trim();}
    const now=new Date();
    if(/\btoday\b/i.test(s)){now.setHours(9,0,0,0); result.scheduledAt=now.getTime(); s=s.replace(/\btoday\b/i,'').trim();}
    else if(/\btomorrow\b/i.test(s)){const d=new Date(now); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); result.scheduledAt=d.getTime(); s=s.replace(/\btomorrow\b/i,'').trim();}
    const timeM=s.match(/\bat\s+(\d{1,2})[:h]?(\d{2})?\s*(am|pm)?/i);
    if(timeM){let h=parseInt(timeM[1]),m=parseInt(timeM[2]||'0'); if(/pm/i.test(timeM[3])&&h<12) h+=12; if(/am/i.test(timeM[3])&&h===12) h=0; const dt=result.scheduledAt?new Date(result.scheduledAt):new Date(); dt.setHours(h,m,0,0); result.scheduledAt=dt.getTime(); s=s.replace(timeM[0],'').trim();}
    result.title=s.replace(/\s+/g,' ').trim()||text;
    return result;
  },

  parseMulti(text, lang = 'ru', defaultDate = null) {
    if (!text || typeof text !== 'string') return [];
    const splitRegex = /(?:\r?\n|;|(?:\s+|^)(?:и\s+еще|и\s+ещё|затем|потом|также|после\s+этого|apoi|și\s+apoi|and\s+then|also)(?:\s+|$))/i;
    const rawSegments = text.split(splitRegex).map(s => s.trim()).filter(Boolean);
    const segments = rawSegments.length ? rawSegments : [text.trim()];

    const results = [];
    const now = new Date();

    for (let seg of segments) {
      if (!seg) continue;
      let s = seg;
      let date = defaultDate || null;
      let time = null;
      let timeTo = null;
      let duration_min = null;
      let kind = 'task';
      let cat = 'life';
      let priority = 'medium';
      let reminders = [];

      // 1. Date heuristics
      if (/\b(?:сегодня|today|azi)\b/i.test(s)) {
        date = dateKey(now.getTime());
        s = s.replace(/\b(?:сегодня|today|azi)\b/ig, ' ');
      } else if (/\b(?:завтра|tomorrow|mâine|maine)\b/i.test(s)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        date = dateKey(d.getTime());
        s = s.replace(/\b(?:завтра|tomorrow|mâine|maine)\b/ig, ' ');
      } else if (/\b(?:послезавтра|poimâine|poimaine)\b/i.test(s)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        date = dateKey(d.getTime());
        s = s.replace(/\b(?:послезавтра|poimâine|poimaine)\b/ig, ' ');
      } else {
        const dowMap = {
          'понедельник': 1, 'пн': 1, 'luni': 1, 'monday': 1, 'mon': 1,
          'вторник': 2, 'вт': 2, 'marți': 2, 'marti': 2, 'tuesday': 2, 'tue': 2,
          'среду': 3, 'среда': 3, 'ср': 3, 'miercuri': 3, 'wednesday': 3, 'wed': 3,
          'четверг': 4, 'чт': 4, 'joi': 4, 'thursday': 4, 'thu': 4,
          'пятницу': 5, 'пятница': 5, 'пт': 5, 'vineri': 5, 'friday': 5, 'fri': 5,
          'субботу': 6, 'суббота': 6, 'сб': 6, 'sâmbătă': 6, 'sambata': 6, 'saturday': 6, 'sat': 6,
          'воскресенье': 7, 'вс': 7, 'duminică': 7, 'duminica': 7, 'sunday': 7, 'sun': 7
        };
        const dowRegex = /(?:в|во|on|la)?\s*\b(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье|luni|marți|marti|miercuri|joi|vineri|sâmbătă|sambata|duminică|duminica|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        const dowMatch = s.match(dowRegex);
        if (dowMatch) {
          const targetDow = dowMap[dowMatch[1].toLowerCase()];
          if (targetDow) {
            const curDow = now.getDay() === 0 ? 7 : now.getDay();
            let diff = targetDow - curDow;
            if (diff <= 0) diff += 7;
            const d = new Date(now);
            d.setDate(d.getDate() + diff);
            date = dateKey(d.getTime());
            s = s.replace(dowMatch[0], ' ');
          }
        } else {
          const ddmmyyyy = s.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
          if (ddmmyyyy) {
            const dayNum = parseInt(ddmmyyyy[1], 10);
            const monthNum = parseInt(ddmmyyyy[2], 10);
            const yearNum = ddmmyyyy[3] ? parseInt(ddmmyyyy[3], 10) : now.getFullYear();
            const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
            if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
              date = `${fullYear}-${pad(monthNum)}-${pad(dayNum)}`;
              s = s.replace(ddmmyyyy[0], ' ');
            }
          }
        }
      }

      // 2. Time heuristics
      const timeRegex = /(?:в|at|la)\s+(\d{1,2})(?::(\d{2})|\s*(?:часов|часа|ч|h|:00))?/i;
      const tm = s.match(timeRegex);
      if (tm) {
        let h = parseInt(tm[1], 10);
        let m = tm[2] ? parseInt(tm[2], 10) : 0;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          time = `${pad(h)}:${pad(m)}`;
          s = s.replace(tm[0], ' ');
        }
      }

      // 3. TimeTo heuristics
      const timeToRegex = /(?:до|till|until|până\s+la)\s+(\d{1,2})(?::(\d{2})|\s*(?:часов|часа|ч|h|:00))?/i;
      const ttm = s.match(timeToRegex);
      if (ttm) {
        let h = parseInt(ttm[1], 10);
        let m = ttm[2] ? parseInt(ttm[2], 10) : 0;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          timeTo = `${pad(h)}:${pad(m)}`;
          s = s.replace(ttm[0], ' ');
        }
      }

      // 4. Duration heuristics
      const durMatch = s.match(/(?:на|for|timp\s+de)\s+(\d+)\s*(часов|часа|час|ч|hours?|hrs?|h|минут|минуты|минуту|мин|m|minutes?|mins?)\b/i);
      if (durMatch) {
        const val = parseInt(durMatch[1], 10);
        const unit = durMatch[2].toLowerCase();
        duration_min = /ч|h/i.test(unit) ? val * 60 : val;
        s = s.replace(durMatch[0], ' ');
      } else if (time && timeTo) {
        const [sh, sm] = time.split(':').map(Number);
        const [eh, em] = timeTo.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) duration_min = diff;
      } else if (time) {
        duration_min = 30;
      }

      // 5. Kind
      if (time || timeTo || /\b(?:встреча|созвон|митинг|вебинар|звонок|сессия|meeting|call|session|ședință|apel)\b/i.test(s)) {
        kind = 'event';
      }

      // 6. Category
      if (/\b(?:клиент|митинг|встреча|проект|звонок|созвон|работа|договор|отчет|memernity|cerna|work|client|meeting|call|project|job)\b/i.test(s)) {
        cat = 'business';
      } else if (/\b(?:тренировка|спорт|врач|зал|бег|бассейн|таблетки|доктор|gym|workout|sport|doctor|run|health|sală|antrenament|medic)\b/i.test(s)) {
        cat = 'health';
      } else if (/\b(?:курс|книга|урок|читать|лекция|дз|homework|study|book|read|exam|school|curs|carte|lecție)\b/i.test(s)) {
        cat = 'study';
      } else {
        cat = 'life';
      }

      // 7. Priority
      if (/\b(?:срочно|важно|asap|urgent|important|p1)\b/i.test(s)) {
        priority = 'high';
        s = s.replace(/\b(?:срочно|важно|asap|urgent|important|p1)\b/ig, ' ');
      } else if (/\b(?:если\s+успею|фоном|не\s+к\s+спеху|low\s+priority|p3)\b/i.test(s)) {
        priority = 'low';
        s = s.replace(/\b(?:если\s+успею|фоном|не\s+к\s+спеху|low\s+priority|p3)\b/ig, ' ');
      } else {
        priority = 'medium';
      }

      // 8. Reminders
      const remMatch = s.match(/(?:напомни\s+за|напоминание\s+за|remind\s+me)\s+(\d+)\s*(?:мин|минут|m|min)?/i);
      if (remMatch) {
        reminders = [parseInt(remMatch[1], 10)];
        s = s.replace(remMatch[0], ' ');
      } else if (time) {
        reminders = [15];
      }

      // 9. Title
      const cleanTitle = s.replace(/\s+/g, ' ').trim();
      const title = cleanTitle.length > 1 ? cleanTitle : seg.trim();

      results.push({
        kind,
        title,
        cat,
        date,
        time,
        timeTo,
        duration_min,
        priority,
        reminders,
        recurrence: null,
        confidence: 0.5,
        notes: '',
        tags: []
      });
    }

    return results;
  }
};

function buildGoalFromDraft(it, tagsState = []) {
  let scheduledAt = null;
  let allDay = false;
  let isEvent = (it.kind === 'event');
  if (it.date) {
    const [dy, dm, dd] = it.date.split('-').map(Number);
    if (!it.time) {
      scheduledAt = new Date(dy, dm - 1, dd, 23, 59, 0, 0).getTime();
      allDay = true;
      isEvent = false;
    } else {
      const [sh, sm] = it.time.split(':').map(Number);
      scheduledAt = new Date(dy, dm - 1, dd, isNaN(sh) ? 9 : sh, isNaN(sm) ? 0 : sm, 0, 0).getTime();
      isEvent = (it.kind === 'event');
    }
  }

  let durMin = 30;
  if (it.duration_min) {
    durMin = parseInt(it.duration_min, 10) || 30;
  } else if (it.time && it.timeTo) {
    const [sh, sm] = it.time.split(':').map(Number);
    const [eh, em] = it.timeTo.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff > 0) durMin = diff;
  }

  const goalTags = [];
  if (Array.isArray(it.tags)) {
    for (const rawTag of it.tags) {
      const name = String(rawTag).replace(/^@/, '').trim().toLowerCase();
      if (!name) continue;
      let found = tagsState.find(t => t.name.toLowerCase() === name || t.id === rawTag);
      if (!found) {
        found = {
          id: 'tag_' + Date.now().toString(36) + rnd(),
          name,
          color: TAG_PALETTE[tagsState.length % TAG_PALETTE.length]
        };
        tagsState.push(found);
      }
      if (!goalTags.includes(found.id)) goalTags.push(found.id);
    }
  }

  const prio = it.priority === 'high' ? 'high' : (it.priority === 'low' ? 'low' : 'mid');
  const cat = ['business', 'health', 'study', 'life'].includes(it.cat) ? it.cat : 'life';

  return {
    id: 'g_' + Date.now().toString(36) + rnd(),
    title: String(it.title || 'Новое дело').trim(),
    cat,
    priority: prio,
    scheduledAt,
    duration_min: durMin,
    isEvent,
    allDay: (allDay && !isEvent),
    isProject: false,
    parentId: null,
    recurrence: it.recurrence || null,
    notes: it.notes || '',
    location: it.location || '',
    travelTime: 0,
    cost: 0,
    tags: goalTags,
    reminders: Array.isArray(it.reminders) ? [...it.reminders] : [],
    participants: [],
    color: '',
    subtasks: [],
    done: false,
    completed: false,
    elapsed: 0,
    startTime: null,
    paused: false,
    createdAt: Date.now()
  };
}

/* ═══════════════════════════════════════════════════════════
   DICTATION CONTROLLER (Nova Voice v9)
═══════════════════════════════════════════════════════════ */
const DictationController = {
  _draftItems: [],
  defaultDate: null,

  openModal(opts = {}) {
    this.defaultDate = opts.defaultDate || null;
    this._draftItems = [];
    const interimEl = document.getElementById('voiceInterim');
    if (interimEl) { interimEl.textContent = ''; interimEl.classList.add('hidden'); }
    const draftSection = document.getElementById('voice-draft-section');
    if (draftSection) draftSection.classList.add('hidden');
    const draftCards = document.getElementById('voice-draft-cards');
    if (draftCards) draftCards.innerHTML = '';
    const draftCount = document.getElementById('voice-draft-count');
    if (draftCount) draftCount.textContent = '0';
    openModal('modal-voice');
  },

  async parse(text) {
    if (!text || !text.trim()) {
      showToast('⚠️ Введите или надиктуйте текст');
      return;
    }
    const parseBtn = document.getElementById('btn-voice-parse');
    const origHtml = parseBtn ? parseBtn.innerHTML : '';
    if (parseBtn) {
      parseBtn.disabled = true;
      parseBtn.innerHTML = '<span>⏳ Распознаю...</span>';
    }

    const langSetting = localStorage.getItem('nova-voice-lang') || 'ru-RU';
    const lang = langSetting.slice(0, 2);
    const payload = {
      text: text.trim(),
      now: new Date().toISOString(),
      lang: lang || 'ru',
      defaultDate: this.defaultDate || null
    };

    let items = null;
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 8000);

    try {
      const syncKey = localStorage.getItem('nova-sync-key') || '';
      const res = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nova-key': syncKey
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length) {
        items = data.items;
      } else {
        throw new Error('No items returned');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Voice parse-voice API error or timeout, falling back to NLP:', err);
      items = NLP.parseMulti(text, lang, this.defaultDate);
      showToast('Offline parse — проверь черновик');
    } finally {
      if (parseBtn) {
        parseBtn.disabled = false;
        parseBtn.innerHTML = origHtml;
      }
    }

    if (items && items.length) {
      if (typeof this.renderDraftBoard === 'function') {
        this.renderDraftBoard(items);
      }
    } else {
      showToast('⚠️ Ничего не удалось распознать');
    }
  },

  renderDraftBoard(items) {
    this._draftItems = (items || []).map((it, idx) => ({
      _id: idx,
      _selected: true,
      kind: it.kind === 'event' ? 'event' : 'task',
      title: it.title || '',
      cat: it.cat || 'life',
      date: it.date || null,
      time: it.time || null,
      timeTo: it.timeTo || null,
      duration_min: it.duration_min || null,
      priority: it.priority === 'mid' ? 'medium' : (it.priority || 'medium'),
      reminders: Array.isArray(it.reminders) ? [...it.reminders] : [],
      recurrence: it.recurrence || null,
      confidence: typeof it.confidence === 'number' ? it.confidence : 1.0,
      notes: it.notes || '',
      tags: Array.isArray(it.tags) ? [...it.tags] : [],
      location: it.location || ''
    }));

    const sec = document.getElementById('voice-draft-section');
    if (sec) sec.classList.remove('hidden');

    this._renderCards();
  },

  _checkCollision(item) {
    if (!item.date || !item.time) return null;
    const [sh, sm] = item.time.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm)) return null;
    const startD = new Date(`${item.date}T${pad(sh)}:${pad(sm)}:00`);
    const startTs = startD.getTime();
    let endTs = null;
    if (item.timeTo) {
      const [eh, em] = item.timeTo.split(':').map(Number);
      if (!isNaN(eh) && !isNaN(em)) {
        endTs = new Date(`${item.date}T${pad(eh)}:${pad(em)}:00`).getTime();
      }
    }
    if (!endTs || endTs <= startTs) {
      const durMin = item.duration_min ? parseInt(item.duration_min, 10) : 30;
      endTs = startTs + (durMin || 30) * 60 * 1000;
    }

    const dayStart = new Date(item.date + 'T00:00:00').getTime();
    const dayEnd = new Date(item.date + 'T23:59:59.999').getTime();

    const allGoals = StateManager.get('goals') || [];
    const realOnDay = allGoals.filter(g => !g.isProject && g.scheduledAt && dateKey(g.scheduledAt) === item.date);
    const ghostsOnDay = typeof getGhostOccurrences === 'function' ? getGhostOccurrences(dayStart, dayEnd).filter(g => dateKey(g.scheduledAt) === item.date) : [];
    const candidates = [...realOnDay, ...ghostsOnDay];

    for (const cand of candidates) {
      const candStart = cand.scheduledAt;
      const candDur = (cand.duration_min || 30) * 60 * 1000;
      const candEnd = candStart + candDur;
      if (startTs < candEnd && endTs > candStart) {
        const cStartD = new Date(candStart);
        const cEndD = new Date(candEnd);
        const timeSpan = `${pad(cStartD.getHours())}:${pad(cStartD.getMinutes())} - ${pad(cEndD.getHours())}:${pad(cEndD.getMinutes())}`;
        return {
          title: cand.title,
          timeSpan
        };
      }
    }
    return null;
  },

  _renderCards() {
    const container = document.getElementById('voice-draft-cards');
    const countEl = document.getElementById('voice-draft-count');
    if (!container) return;

    if (countEl) countEl.textContent = String(this._draftItems.length);
    if (!this._draftItems.length) {
      container.innerHTML = '<p class="text-xs text-white/40 text-center py-4">Черновиков нет</p>';
      const sec = document.getElementById('voice-draft-section');
      if (sec) sec.classList.add('hidden');
      return;
    }

    container.innerHTML = this._draftItems.map(it => {
      const isLowConf = typeof it.confidence === 'number' && it.confidence < 0.6;
      const col = this._checkCollision(it);
      const isEvent = it.kind === 'event';

      return `
        <div class="draft-card glass-soft rounded-2xl p-3 relative ${isLowConf ? 'border border-amber-400/60 bg-amber-500/10' : 'border border-white/10'}" data-draft-id="${it._id}">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <input type="checkbox" class="draft-toggle-cb w-4 h-4 rounded accent-red-500 cursor-pointer" ${it._selected ? 'checked' : ''}>
              <button type="button" class="draft-kind-btn px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${isEvent ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
                ${isEvent ? '📅 Событие' : '✓ Дело'}
              </button>
              ${isLowConf ? '<span class="text-[10px] text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium">⚠️ Низкая уверенность</span>' : ''}
            </div>
            <div class="flex items-center gap-1">
              <button type="button" class="btn-draft-open-full px-2 py-1 text-[11px] font-medium glass-hover text-white/70 rounded-lg hover:text-white" title="Открыть в полной форме">
                ✏️ Полная форма
              </button>
              <button type="button" class="btn-draft-delete p-1 text-white/40 hover:text-red-400 rounded-lg" title="Удалить">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          <div class="mb-2">
            <input type="text" class="draft-field-title field text-xs w-full py-1.5 px-2 rounded-lg bg-white/5 border border-white/10" value="${esc(it.title)}" placeholder="Название дела/события">
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label class="text-[10px] text-white/40 block mb-0.5">Дата</label>
              <input type="date" class="draft-field-date field text-xs w-full py-1 px-1.5 rounded-lg bg-white/5 border border-white/10" value="${it.date || ''}">
            </div>
            <div>
              <label class="text-[10px] text-white/40 block mb-0.5">С</label>
              <input type="time" class="draft-field-time field text-xs w-full py-1 px-1.5 rounded-lg bg-white/5 border border-white/10" value="${it.time || ''}">
            </div>
            <div>
              <label class="text-[10px] text-white/40 block mb-0.5">До</label>
              <input type="time" class="draft-field-timeto field text-xs w-full py-1 px-1.5 rounded-lg bg-white/5 border border-white/10" value="${it.timeTo || ''}">
            </div>
            <div>
              <label class="text-[10px] text-white/40 block mb-0.5">Приоритет</label>
              <select class="draft-field-priority field text-xs w-full py-1 px-1.5 rounded-lg bg-white/5 border border-white/10">
                <option value="high" ${it.priority === 'high' ? 'selected' : ''}>🔴 Срочно</option>
                <option value="medium" ${it.priority === 'medium' || it.priority === 'mid' ? 'selected' : ''}>🟡 Обычно</option>
                <option value="low" ${it.priority === 'low' ? 'selected' : ''}>⚪ Фоном</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5 text-xs">
            <div class="flex items-center gap-1.5">
              <label class="text-[10px] text-white/40">Категория:</label>
              <select class="draft-field-cat field text-xs py-0.5 px-1.5 rounded-lg bg-white/5 border border-white/10">
                <option value="business" ${it.cat === 'business' ? 'selected' : ''}>💼 Business</option>
                <option value="health" ${it.cat === 'health' ? 'selected' : ''}>💪 Health</option>
                <option value="study" ${it.cat === 'study' ? 'selected' : ''}>📚 Study</option>
                <option value="life" ${it.cat === 'life' ? 'selected' : ''}>🌱 Life</option>
              </select>
            </div>
            ${it.duration_min ? `<span class="text-[11px] text-white/40">⏱ ${it.duration_min} мин</span>` : ''}
          </div>

          ${col ? `
            <div class="text-[11px] text-amber-300 mt-2 p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center gap-1">
              <span>⚠️ Пересекается с: <strong>${esc(col.title)}</strong> (${col.timeSpan})</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    this._bindDraftEvents();
  },

  _bindDraftEvents() {
    const container = document.getElementById('voice-draft-cards');
    if (!container) return;

    container.querySelectorAll('.draft-card').forEach(card => {
      const id = parseInt(card.dataset.draftId, 10);
      const item = this._draftItems.find(x => x._id === id);
      if (!item) return;

      card.querySelector('.draft-toggle-cb')?.addEventListener('change', (e) => {
        item._selected = e.target.checked;
      });

      card.querySelector('.draft-kind-btn')?.addEventListener('click', () => {
        item.kind = item.kind === 'event' ? 'task' : 'event';
        this._renderCards();
      });

      card.querySelector('.draft-field-title')?.addEventListener('input', (e) => {
        item.title = e.target.value;
      });

      card.querySelector('.draft-field-date')?.addEventListener('change', (e) => {
        item.date = e.target.value || null;
        this._renderCards();
      });

      card.querySelector('.draft-field-time')?.addEventListener('change', (e) => {
        item.time = e.target.value || null;
        this._renderCards();
      });

      card.querySelector('.draft-field-timeto')?.addEventListener('change', (e) => {
        item.timeTo = e.target.value || null;
        this._renderCards();
      });

      card.querySelector('.draft-field-priority')?.addEventListener('change', (e) => {
        item.priority = e.target.value;
      });

      card.querySelector('.draft-field-cat')?.addEventListener('change', (e) => {
        item.cat = e.target.value;
      });

      card.querySelector('.btn-draft-delete')?.addEventListener('click', () => {
        this._draftItems = this._draftItems.filter(x => x._id !== id);
        this._renderCards();
      });

      card.querySelector('.btn-draft-open-full')?.addEventListener('click', () => {
        closeModal('modal-voice');
        TaskController.openModal(null, { prefill: item });
      });
    });
  },

  commitAll() {
    const selected = this._draftItems.filter(x => x._selected);
    if (!selected.length) {
      showToast('⚠️ Выберите хотя бы одно дело');
      return;
    }

    StateManager.pushUndoSnapshot('Голосовой ввод');
    const existingGoals = StateManager.get('goals') || [];
    const currentTags = [...(StateManager.get('tags') || [])];
    const newGoals = selected.map(it => buildGoalFromDraft(it, currentTags));

    StateManager.patch({
      goals: [...existingGoals, ...newGoals],
      tags: currentTags
    });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    refreshEverything();
    closeModal('modal-voice');

    this._draftItems = [];
    const count = newGoals.length;
    showToastWithUndo(`✅ Добавлено ${count} ${count === 1 ? 'дело' : (count < 5 ? 'дела' : 'дел')}`);
  },
};

/* ═══════════════════════════════════════════════════════════
   GLOBAL EVENTS
═══════════════════════════════════════════════════════════ */
function initGlobalEvents() {
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => ViewRouter.switchTo(btn.dataset.view));
  });
  document.querySelectorAll('#focusTabs .subtab').forEach(t => {
    t.addEventListener('click', () => switchSub('focusTabs','focus', t.dataset.sub));
  });
  document.getElementById('btn-open-voice')?.addEventListener('click', () => DictationController.openModal());
  document.getElementById('btn-cal-voice')?.addEventListener('click', () => {
    const cd = CalendarController._calDate;
    const defaultDate = cd ? dateKey(cd.getTime()) : dateKey(Date.now());
    DictationController.openModal({ defaultDate });
  });
  document.getElementById('btn-voice-stop')?.addEventListener('click', () => { VoiceInput.stop(); });
  document.getElementById('btn-voice-parse')?.addEventListener('click', () => {
    const txt = document.getElementById('voiceTranscript')?.value.trim();
    if (txt) DictationController.parse(txt); else closeModal('modal-voice');
  });
  document.getElementById('btn-draft-add-all')?.addEventListener('click', () => {
    DictationController.commitAll();
  });
  document.getElementById('btn-open-settings')?.addEventListener('click', ()=>{ renderSettingsPanel(); openModal('modal-settings'); });
  document.getElementById('btn-profile-open-shop')?.addEventListener('click', ()=>{ ViewRouter.switchTo('focus'); switchSub('focusTabs','focus','shop'); });
  document.getElementById('btn-profile-see-shop')?.addEventListener('click', ()=>{ ViewRouter.switchTo('focus'); switchSub('focusTabs','focus','shop'); });

  // Sidebar collapse
  const sidebar=document.getElementById('sidebar'), collapseBtn=document.getElementById('collapseBtn'), collapseIcon=document.getElementById('collapseIcon');
  let collapsed=false;
  collapseBtn?.addEventListener('click', ()=>{
    collapsed=!collapsed;
    sidebar.style.width = collapsed?'88px':'240px';
    document.querySelectorAll('.navlabel').forEach(el=>el.style.display = collapsed?'none':'');
    if (collapseIcon) collapseIcon.style.transform = collapsed?'rotate(0deg)':'rotate(180deg)';
  });

  // Generic [data-close] modal-close bindings
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.close));
  });

  // Generic toggle affordance for any [data-toggle] not already wired individually
  document.querySelectorAll('[data-toggle]').forEach(el => {
    if (el.id==='toggle-soft-alarm' || el.id==='settings-dim-recurring' || el.dataset.action==='toggle-routine') return; // wired elsewhere
    el.addEventListener('click', () => el.classList.toggle('on'));
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal').forEach(m => { if (!m.classList.contains('hidden')) closeModal(m.id); });
  });

  console.log('[Nova OS v7.1] Global events bound');
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  try { StateManager.load();          } catch(e) { console.error('[Init:load]',e); }
  try { TaskController.init();        } catch(e) { console.error('[Init:task]',e); }
  try { CalendarController.init();    } catch(e) { console.error('[Init:cal]',e); }
  try { RoutineManager.init();        } catch(e) { console.error('[Init:routine]',e); }
  try { TimerController.init();       } catch(e) { console.error('[Init:timer]',e); }
  try { TimerController.scheduleReminders(); } catch(e) { console.error('[Init:reminders]',e); }
  try { StoreController.init();       } catch(e) { console.error('[Init:store]',e); }
  try { MacroController.init();       } catch(e) { console.error('[Init:macro]',e); }
  try { initSettingsHandlers();       } catch(e) { console.error('[Init:settings]',e); }
  try { VoiceInput.init();            } catch(e) { console.error('[Init:voice]',e); }
  try { initGlobalEvents();           } catch(e) { console.error('[Init:events]',e); }
  try { updateCrystalChips();         } catch(e) { console.error('[Init:crystals]',e); }
  // Must run AFTER StateManager.load() (already the case above) so it reads
  // the persisted profileName instead of the in-memory "You" default —
  // this is what stops the name resetting to "—" on reload.
  try { syncProfileNameEverywhere();  } catch(e) { console.error('[Init:profile-name]',e); }
  try { ViewRouter.switchTo('tasks'); } catch(e) { console.error('[Init:view]',e); }
  // Skip cloud sync in lite (safe) mode — avoid triggering OOM again on recovery load
  if (!document.documentElement.classList.contains('lite')) {
    setTimeout(()=>{ try{SyncManager.loadFromCloud();}catch(e){console.warn('[Init:KV]',e);} }, 2000);
    // A2: background refresh every 60 s + on tab focus
    setInterval(()=>{ try{SyncManager.loadFromCloud({silent:true});}catch(e){} }, 60000);
    document.addEventListener('visibilitychange', ()=>{
      if (!document.hidden) { try{SyncManager.loadFromCloud({silent:true});}catch(e){} }
    });
  }
  // Safe boot: clear the crash-detection key 4s after successful init
  setTimeout(()=>{ localStorage.removeItem('nova-boot'); }, 4000);
  console.log('[Nova OS v7.1] ✅ Initialization complete');
});

/* ═══════════════════════════════════════════════════════════
   GLOBAL ERROR HANDLERS (iOS crash guard)
═══════════════════════════════════════════════════════════ */
window.addEventListener('error', (e) => {
  console.error('[Nova OS] Uncaught error:', e.message, '—', e.filename, 'line', e.lineno);
  if (e.filename) showToast('⚠️ Something went wrong');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Nova OS] Unhandled promise rejection:', e.reason);
});
