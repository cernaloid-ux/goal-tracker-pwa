/* ══════════════════════════════════════════════════════════════
   NOVA OS — app.js v7.1 (clean rebuild, no runtime HTML injection)
   StateManager · SyncManager · ViewRouter · TaskController
   CalendarController (with drag & drop) · RoutineManager
   TimerController · StoreController · MacroController (Project→Sprint)
   ProfileRenderer · VoiceInput · NLP · Demo · Vercel KV 2-Way Sync
   ══════════════════════════════════════════════════════════════ */

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
function fmtD(s) { const dy=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); if(dy>0) return `${dy}d ${pad(h)}h`; if(h>0) return `${h}h ${pad(m)}m`; if(m>0) return `${m}m ${pad(sec)}s`; return `${sec}s`; }
function fmtRel(ts) { const d=Date.now()-ts,m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24); if(dy>0) return `${dy}d ago`; if(h>0) return `${h}h ago`; if(m>0) return `${m}m ago`; return 'just now'; }
function fmtTime(ts) { if(!ts) return ''; const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDateTime(ts) { if(!ts) return ''; const d=new Date(ts); return d.toLocaleString('en-US',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }
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
// Snaps a "HH:MM" string to the nearest 10-minute step index (0..143).
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
   UI HELPERS — toasts, popups, alarms, modal open/close
═══════════════════════════════════════════════════════════ */
function showToast(msg, duration=3000) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast-card'; t.textContent = msg;
  t.style.cssText = 'background:rgba(60,60,66,.85);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 16px;color:#fff;font-size:13px;font-weight:500;box-shadow:0 12px 28px -8px rgba(0,0,0,.6);opacity:0;transform:translateX(20px);transition:opacity .3s,transform .3s;pointer-events:auto;';
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
  card.style.cssText = 'display:flex;align-items:center;gap:12px;background:rgba(60,60,66,.9);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);border:1px solid rgba(255,59,48,.3);border-radius:16px;padding:12px 16px;color:#fff;box-shadow:0 0 0 1px rgba(255,59,48,.15),0 16px 34px -10px rgba(255,59,48,.35);opacity:0;transform:translateX(20px) scale(.96);transition:opacity .3s,transform .3s;pointer-events:auto;';
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
let _modalZCounter = 1000;
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
    streak:{ days:0, lastDate:'', doneToday:false, best:0 }, tags:[], macroGoals:[],
    pomoConfig:{ work:25, short:5, long:15 }, pomoPhase:'work', pomoCycles:0,
    sleepSettings:{ bedtime:'23:00', waketime:'07:00', eveningPrepMins:30, eveningGratitudeMins:15, morningWaterDelay:5, morningBrushDelay:10, softAlarmEnabled:true, sleepLog:{} },
    routines:[], profileName:'You',
    tgToken:'', tgChatId:'', webhookUrl:'', currentView:'tasks', taskFilter:'today', taskTagFilter:null,
    searchQuery:'', sortMode:'date', calView:'week', timerMode:'countdown',
    activeTaskId:null, editingTaskId:null, editingRoutineId:null, detailTaskId:null,
    storeFilter:'all', storeDraft:{}, expandedMacros:{},
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
      macros.forEach(m => { if (!Array.isArray(m.sprints)) m.sprints=[]; });

      const draft = {}; STORE_ITEMS.forEach(i => draft[i.id]=1);
      state = { ...state, goals:g, history:h, purchases:p, gems, streak, tags, macroGoals:macros,
        pomoConfig:pomo, sleepSettings:sleep, routines, profileName,
        tgToken, tgChatId, webhookUrl, storeDraft:draft };
    } catch(e) { console.error('[StateManager load]', e); }
  }

  function save() {
    try {
      localStorage.setItem('nova-goals',    JSON.stringify(state.goals));
      localStorage.setItem('nova-history',  JSON.stringify(state.history));
      localStorage.setItem('nova-purchases',JSON.stringify(state.purchases));
      localStorage.setItem('nova-gems',     String(state.gems));
      localStorage.setItem('nova-streak',   JSON.stringify(state.streak));
      localStorage.setItem('nova-tags',     JSON.stringify(state.tags));
      localStorage.setItem('nova-macros',   JSON.stringify(state.macroGoals));
      localStorage.setItem('nova-pomo',     JSON.stringify(state.pomoConfig));
      localStorage.setItem('nova-sleep',    JSON.stringify(state.sleepSettings));
      localStorage.setItem('nova-routines', JSON.stringify(state.routines));
      localStorage.setItem('nova-profile-name', state.profileName||'You');
      localStorage.setItem('nova-tg-token', state.tgToken||'');
      localStorage.setItem('nova-tg-chat',  state.tgChatId||'');
      localStorage.setItem('nova-webhook',  state.webhookUrl||'');
      localStorage.setItem('nova-updatedAt', String(Date.now()));
    } catch(e) { console.error('[StateManager save]', e); }
  }

  return {
    get: (key) => key===undefined ? {...state} : state[key],
    set: (key,val) => { state[key]=val; save(); listeners.forEach(fn=>fn(key,val)); },
    patch: (obj) => { Object.assign(state,obj); save(); listeners.forEach(fn=>fn()); },
    subscribe: (fn) => { listeners.push(fn); return ()=>{ const i=listeners.indexOf(fn); if(i>-1) listeners.splice(i,1); }; },
    load, save,
  };
})();

/* ═══════════════════════════════════════════════════════════
   SYNC MANAGER (Vercel KV 2-Way)
═══════════════════════════════════════════════════════════ */
const SyncManager = (() => {
  const KV = '/api/sync';
  let kvTimer=null;

  function getUid() {
    const host = window.location.hostname;
    if (host === 'cernavation.vercel.app' || host === 'localhost') {
      localStorage.setItem('nova-uid', 'master_admin_id');
      return 'master_admin_id';
    }
    let uid = localStorage.getItem('nova-uid');
    if (!uid) { uid = 'guest_' + Date.now().toString(36) + rnd(); localStorage.setItem('nova-uid', uid); }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: getUid(),
          updatedAt: localUpdatedAt,
          goals: s.goals,
          gems: s.gems,
          streak: s.streak,
          history: s.history,
          macroGoals: s.macroGoals,
          tgToken: s.tgToken,
          tgChatId: s.tgChatId,
        }),
      });
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
    StateManager.patch({
      goals:      Array.isArray(data.goals)   ? data.goals   : s.goals,
      history:    Array.isArray(data.history) ? data.history : s.history,
      gems:       typeof data.gems   === 'number' ? data.gems   : s.gems,
      streak:     data.streak ?? s.streak,
      macroGoals: Array.isArray(data.macroGoals) ? data.macroGoals : s.macroGoals,
    });
    if (data.updatedAt) localStorage.setItem('nova-updatedAt', String(data.updatedAt));
    refreshEverything();
  }

  async function loadFromCloud() {
    try {
      const res = await fetch(`${KV}?userId=${getUid()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.goals) return;
      _applyServerData(data);
      showToast('☁️ Cloud data loaded');
    } catch (e) { console.warn('[KV load]', e); }
  }
  return {
    scheduleSync:()=>{ clearTimeout(kvTimer); kvTimer=setTimeout(doSync,1500); },
    loadFromCloud, getUid,
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
      if (view==='calendar') CalendarController.render();
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
   PROJECTS PANEL
   Renders macro goals (Projects) as expandable folders on the
   Tasks view. Each Project groups its linked tasks by Sprint
   (sub-goal): Project -> Sprint -> Tasks. Tasks with no sprintId
   fall into "Unsorted". Sprints with zero tasks are still shown
   so the structure stays visible while it's being built out.
   Project progress (%) is always derived from the completion
   state of its linked tasks (done / total across ALL sprints +
   unsorted), never from the sprints themselves — sprints are a
   pure grouping layer, not a completion unit.
═══════════════════════════════════════════════════════════ */
function _buildProjectTaskRow(g) {
  const cat = catInfo(g);
  return `<label class="flex items-center gap-3 cursor-pointer" data-task-row="${g.id}">
    <input type="checkbox" class="chk" data-action="toggle-task" data-id="${g.id}" ${g.done?'checked':''}>
    <span class="tasklabel flex-1 truncate" style="${g.done?'text-decoration:line-through;opacity:.45;':''}">${esc(g.title)}</span>
    ${g.scheduledAt?`<span class="cal-event-time flex-none">${fmtTimeRange(g.scheduledAt, g.duration_min)}</span>`:''}
    <span class="tag ${isUrgent(g)?'':'tag-grey'} flex-none">${cat.label}</span>
  </label>`;
}

function _renderSprintGroup(label, tasks) {
  const done = tasks.filter(t=>t.done).length;
  return `<div class="task-group-header">
      <span class="w-1.5 h-1.5 rounded-full flex-none" style="background:#FF3B30"></span>
      ${esc(label)} <span class="task-group-count">${done}/${tasks.length}</span>
    </div>
    <div class="space-y-3">${tasks.slice().sort((a,b)=>{
      if (a.done!==b.done) return a.done?1:-1;
      return (a.scheduledAt||Infinity)-(b.scheduledAt||Infinity);
    }).map(_buildProjectTaskRow).join('')}</div>`;
}

// Groups a project's linked tasks strictly by sprintId: Project -> Sprint -> Tasks.
// Tasks without a sprintId land in "Unsorted". Sprints defined on the macro
// goal but with no linked tasks yet are still rendered (empty state note),
// so the sprint structure is visible before any tasks get filed under it.
function _renderProjectTaskGroups(linkedGoals, mg) {
  const sprints = mg.sprints || [];
  let html = '';

  sprints.forEach(sp => {
    const tasks = linkedGoals.filter(g => g.sprintId === sp.id);
    if (!tasks.length) {
      html += `<div class="task-group-header">
        <span class="w-1.5 h-1.5 rounded-full flex-none" style="background:#FF3B30"></span>
        ${esc(sp.title)} <span class="task-group-count">0</span>
      </div>
      <p class="text-white/35 text-sm" style="padding-left:2px;">No tasks in this sprint yet.</p>`;
    } else {
      html += _renderSprintGroup(sp.title, tasks);
    }
  });

  const sprintIds = new Set(sprints.map(sp=>sp.id));
  const unsorted = linkedGoals.filter(g => !g.sprintId || !sprintIds.has(g.sprintId));
  if (unsorted.length) html += _renderSprintGroup('Unsorted', unsorted);

  if (!html) {
    return `<p class="text-white/35 text-sm">No tasks linked yet. Add one and set its Big Goal to "${esc(mg.title)}".</p>`;
  }
  return html;
}

function renderProjectsPanel() {
  const wrap = document.getElementById('projects-container');
  if (!wrap) return;
  const macros = StateManager.get('macroGoals');
  const goals = StateManager.get('goals');
  const expanded = StateManager.get('expandedMacros') || {};

  if (!macros.length) {
    wrap.innerHTML = `<div class="glass rounded-3xl p-6">
      <div class="empty-state" style="padding:24px 0;">
        <div class="empty-icon">🗂️</div>
        <div class="empty-title">No projects yet</div>
        <div class="empty-sub">Tap "+ New Project" to create your first project</div>
      </div>
    </div>`;
    return;
  }

  wrap.innerHTML = macros.map(mg => {
    // Project -> Sprint -> Task nesting: linkedGoals is every task whose
    // macroId points at this project, regardless of sprint. Progress is
    // strictly done/total across that full set — sprints only affect grouping.
    const linkedGoals = goals.filter(g=>g.macroId===mg.id);
    const done = linkedGoals.filter(g=>g.done).length;
    const total = linkedGoals.length;
    const pct = total>0 ? Math.round(done/total*100) : 0;
    const isOpen = !!expanded[mg.id];
    const body = isOpen ? _renderProjectTaskGroups(linkedGoals, mg) : '';
    return `<div class="glass glass-hover rounded-3xl p-6" data-macro-card="${mg.id}">
      <div class="flex items-start justify-between gap-4 mb-5">
        <div class="flex items-center gap-4 cursor-pointer flex-1 min-w-0" data-action="toggle-macro-expand" data-id="${mg.id}">
          <svg class="expand-chevron w-5 h-5 text-white/40 flex-none ${isOpen?'open':''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          <div class="w-14 h-14 rounded-2xl accent-grad flex items-center justify-center flex-none">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
          </div>
          <div class="min-w-0">
            <h2 class="text-xl font-bold truncate">${esc(mg.title)}</h2>
            <p class="text-white/40 text-sm">${total} task${total===1?'':'s'}${(mg.sprints||[]).length?' · '+mg.sprints.length+' sprint'+(mg.sprints.length===1?'':'s'):''}${mg.deadline?' · due '+new Date(mg.deadline).toLocaleDateString('en-US'):''}</p>
          </div>
        </div>
        <div class="flex items-center gap-3 flex-none">
          <span class="text-2xl font-bold text-accent">${pct}%</span>
          <button class="glass-soft glass-hover rounded-lg" style="width:30px;height:30px;font-size:13px;" data-action="edit-macro" data-id="${mg.id}">✎</button>
        </div>
      </div>
      <div class="h-3 rounded-full bg-white/10 overflow-hidden">
        <div class="h-full rounded-full accent-grad accent-glow" style="width:${pct}%"></div>
      </div>
      ${isOpen ? `<div class="mt-6 glass-soft rounded-2xl p-5">${body}</div>` : ''}
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-action="toggle-macro-expand"]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.dataset.id;
      const exp = { ...StateManager.get('expandedMacros') };
      exp[id] = !exp[id];
      StateManager.set('expandedMacros', exp);
      renderProjectsPanel();
    });
  });
  wrap.querySelectorAll('[data-action="edit-macro"]').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.stopPropagation(); MacroController.openModal(el.dataset.id); });
  });
  wrap.querySelectorAll('[data-action="toggle-task"]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      TaskController.complete(el.dataset.id);
      renderProjectsPanel();
    });
  });
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

  catWrap.innerHTML = CAT_ORDER.map(key=>{
    const c = CATS[key];
    const count = goals.filter(g=>!g.done && g.cat===key).length;
    const active = activeCat===key;
    return `<button class="w-full glass-soft glass-hover rounded-xl px-4 py-2.5 text-left text-sm flex items-center gap-3 justify-between" data-action="filter-cat" data-cat="${key}" style="${active?`border-color:${c.color}88;color:#fff;`:''}">
      <span class="flex items-center gap-3"><span class="w-2.5 h-2.5 rounded-full" style="background:${c.color}"></span>${c.label}</span>
      <span class="text-[10px] text-white/40">${count}</span>
    </button>`;
  }).join('');
  catWrap.querySelectorAll('[data-action="filter-cat"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cur = StateManager.get('taskCatFilter');
      StateManager.set('taskCatFilter', cur===btn.dataset.cat ? null : btn.dataset.cat);
      TaskController.render(); renderCategoryFilters();
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
   TASK CONTROLLER
═══════════════════════════════════════════════════════════ */
const TaskController = {
  _selectedTags:[], _selectedReminders:[], _selectedColor:COLOR_PALETTE[0], _participants:[], _subtasks:[], _activeCat:'business',

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
      if(e.target.value.length>5){ const p=NLP.parse(e.target.value); if(p.scheduledAt){hint.textContent=`📅 ${fmtDateTime(p.scheduledAt)}`; hint.classList.remove('hidden');}else hint.classList.add('hidden'); }
      else hint.classList.add('hidden');
    });
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#priority-ctrl .seg-btn').forEach(b=>{b.style.background='rgba(255,255,255,.05)';b.style.color='rgba(255,255,255,.5)';b.classList.remove('active');});
        btn.style.background='rgba(255,59,48,.18)'; btn.style.color='#fff'; btn.classList.add('active');
      });
    });
    document.getElementById('task-macro-select')?.addEventListener('change', e=>{
      this._populateSprintSelect(e.target.value, null);
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
    if (catFilter) list = list.filter(g=>g.cat===catFilter);
    if (urgentOnly) list = list.filter(g=>isUrgent(g));
    if (searchQuery) { const q=searchQuery.toLowerCase(); list=list.filter(g=>g.title.toLowerCase().includes(q)||g.notes?.toLowerCase().includes(q)); }

    list.sort((a,b) => {
      if (sortMode==='priority') { const p={high:0,mid:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1); }
      if (sortMode==='cat') return (a.cat||'').localeCompare(b.cat||'');
      const aT=a.scheduledAt||Infinity, bT=b.scheduledAt||Infinity;
      if(aT!==bT) return aT-bT;
      const p={high:0,mid:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1);
    });

    const sub = document.getElementById('tasks-view-subtitle');
    if (sub) {
      const todayDone = st.history.filter(h=>dateKey(h.completedAt)===tKey).length;
      const pendingToday = goals.filter(g=>!g.done&&g.scheduledAt&&dateKey(g.scheduledAt)===tKey).length;
      sub.textContent = `${todayDone} done · ${pendingToday} due today`;
    }

    if (!list.length) {
      listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">✨</div><div class="empty-title">${taskFilter==='done'?'No completed tasks':'No tasks here'}</div><div class="empty-sub">${taskFilter==='done'?'':'Tap New Task to add one'}</div></div>`;
      return;
    }
    listEl.innerHTML='';
    list.forEach(g=>listEl.appendChild(this._buildCard(g)));
  },

  renderForDay(dayKey, dateLabel) {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    const goals = StateManager.get('goals') || [];
    let list = goals.filter(g => !g.done && g.scheduledAt && dateKey(g.scheduledAt) === dayKey);
    list.sort((a,b) => {
      const aT=a.scheduledAt||Infinity, bT=b.scheduledAt||Infinity;
      if(aT!==bT) return aT-bT;
      const p={high:0,mid:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1);
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
    card.className = 'glass-soft glass-hover rounded-2xl p-4' + (g.done ? ' opacity-50' : '');
    card.dataset.id=g.id;
    const prio={high:'🔴',mid:'🟡',low:'⚪'}[g.priority]||'🟡';
    const hasTime=!!g.scheduledAt, isOverdue=hasTime&&g.scheduledAt<Date.now()&&!g.done;
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
            ${hasTime?`<span class="tag-grey tag" style="${isOverdue?'color:#ff8f88;':''}">${isOverdue?'⚠ ':''}${fmtDateTime(g.scheduledAt)}</span>`:''}
            ${g.location?`<span class="tag-grey tag">📍 ${esc(g.location)}</span>`:''}
          </div>
          ${tagHtml?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">${tagHtml}</div>`:''}
          ${subTotal>0?`<div class="text-white/35 text-xs" style="margin-top:6px;">${subDone}/${subTotal} subtasks</div>`:''}
          ${(!g.done&&elapsed>0)?`<div style="height:4px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px;"><div style="height:100%;width:${pct}%;background:${color};border-radius:999px;"></div></div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex:none;">
          <button class="glass-soft glass-hover rounded-lg" data-action="timer" style="width:30px;height:30px;font-size:13px;">⏱</button>
          <button class="glass-soft glass-hover rounded-lg" data-action="edit" style="width:30px;height:30px;font-size:13px;">✎</button>
          <button class="glass-soft glass-hover rounded-lg" data-action="delete" style="width:30px;height:30px;font-size:13px;color:#ff8f88;">🗑</button>
        </div>
      </div>`;

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
    const st=StateManager.get();
    const g=st.goals.find(x=>x.id===id);
    if(!g) return;
    if (g.done) {
      // Allow un-completing from the quick checkbox — reverse the effect cleanly.
      g.done = false;
      StateManager.patch({ goals: st.goals });
      this.render(); renderProjectsPanel();
      return;
    }
    // elapsed_ms fix: fold in any time accrued while the timer was actively
    // running (g.startTime set) BEFORE snapshotting into history, so a task
    // completed mid-run never records 0m. If the timer was never started at
    // all, elapsed legitimately stays 0 — that's correct, not a bug.
    const elapsedSec = (g.elapsed||0) + (g.startTime ? (Date.now()-g.startTime)/1000 : 0);
    g.elapsed = elapsedSec; g.startTime=null; g.paused=true; g.done=true;

    const earnsGems = catEarnsGems(g.cat);
    const gemsEarned = earnsGems ? 1 : 0;

    const history=[{ id:'h_'+Date.now().toString(36)+rnd(), goalId:g.id, title:g.title, cat:g.cat, color:catColor(g), completedAt:Date.now(), elapsed_ms:Math.max(0,Math.round(elapsedSec*1000)), gems:gemsEarned, tags:[...(g.tags||[])] }, ...st.history];
    const gems=st.gems+gemsEarned;

    let streak={...st.streak}; const today=dateKey();
    if(streak.lastDate===today) { streak.doneToday=true; }
    else { const yest=dateKey(Date.now()-86400000); streak.days=(streak.lastDate===yest)?streak.days+1:1; streak.lastDate=today; streak.doneToday=true; }
    if (streak.days > (streak.best||0)) streak.best = streak.days;

    StateManager.patch({ goals:st.goals, history, gems, streak });
    SyncManager.scheduleSync();
    updateCrystalChips();

    if (earnsGems) {
      showPopup('gem','💎',`+1 Crystal! (${gems} total)`,`"${g.title.substring(0,28)}"`);
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
  },

  // Fills the sprint <select> based on the currently chosen macro goal.
  // Disabled + reset to "None" when no macro is selected.
  _populateSprintSelect(macroId, selectedSprintId) {
    const sel = document.getElementById('task-sprint-select');
    if (!sel) return;
    const mg = macroId ? StateManager.get('macroGoals').find(m=>m.id===macroId) : null;
    const sprints = mg ? (mg.sprints||[]) : [];
    sel.innerHTML = `<option value="">None</option>` + sprints.map(sp=>`<option value="${sp.id}">${esc(sp.title)}</option>`).join('');
    sel.disabled = !sprints.length;
    sel.value = selectedSprintId || '';
  },

  openModal(id=null) {
    StateManager.set('editingTaskId',id);
    const g=id?StateManager.get('goals').find(x=>x.id===id):null;
    this._selectedColor=g?.color||COLOR_PALETTE[0];
    this._selectedTags=g?[...(g.tags||[])]:[];
    this._selectedReminders=g?[...(g.reminders||[])]:[];
    this._participants=g?[...(g.participants||[])]:[];
    this._subtasks=g?JSON.parse(JSON.stringify(g.subtasks||[])):[];
    this._activeCat=g?.cat||'business';

    const titleEl = document.getElementById('taskModalTitle');
    if (titleEl) titleEl.textContent = g ? 'Edit Task' : 'New Task';

    const titleInp=document.getElementById('task-title-input');
    const dateInp=document.getElementById('task-date-input');
    const fromInp=document.getElementById('task-time-from-input');
    const toInp=document.getElementById('task-time-to-input');
    const budgetInp=document.getElementById('task-budget-input');
    const notesInp=document.getElementById('task-notes-input');
    const macroSel=document.getElementById('task-macro-select');

    if (titleInp) titleInp.value = g?.title || '';
    if (dateInp) {
      if (g?.scheduledAt) { const d=new Date(g.scheduledAt); dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
      else { const d=new Date(); dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    }
    if (fromInp) {
      if (g?.scheduledAt) { const d=new Date(g.scheduledAt); fromInp.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
      else fromInp.value = `${pad(new Date().getHours())}:00`;
    }
    if (toInp) {
      if (g?.scheduledAt && g.duration_min) { const end=new Date(g.scheduledAt + g.duration_min*60000); toInp.value = `${pad(end.getHours())}:${pad(end.getMinutes())}`; }
      else toInp.value = '';
    }
    if (budgetInp) budgetInp.value = g?.cost || '';
    if (notesInp) notesInp.value = g?.notes || '';

    // Priority buttons
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>{
      const active = (g?.priority||'mid')===btn.dataset.priority;
      btn.style.background = active ? 'rgba(255,59,48,.18)' : 'rgba(255,255,255,.05)';
      btn.style.color = active ? '#fff' : 'rgba(255,255,255,.5)';
      btn.classList.toggle('active', active);
    });

    // Macro + Sprint selects
    if (macroSel) {
      const macros = StateManager.get('macroGoals');
      macroSel.innerHTML = `<option value="">None</option>` + macros.map(m=>`<option value="${m.id}">${esc(m.title)}</option>`).join('');
      macroSel.value = g?.macroId || '';
    }
    this._populateSprintSelect(g?.macroId || '', g?.sprintId || '');

    this._renderCategoryRow();
    this._renderTagRow();
    this._renderSubtasks();

    const saveBtn = document.getElementById('btn-task-save');
    if (saveBtn) saveBtn.textContent = g ? 'Save Task' : 'Create Task';
    document.getElementById('btn-delete-task')?.classList.toggle('hidden', !g);

    openModal('taskModal');
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

  save() {
    const titleInp=document.getElementById('task-title-input');
    const title = titleInp?.value.trim();
    if(!title){showToast('Enter a task title'); return;}
    const prioBtn = document.querySelector('#priority-ctrl .seg-btn.active');
    const cat = this._activeCat || 'business';
    const dateVal = document.getElementById('task-date-input')?.value;
    const startVal = document.getElementById('task-time-from-input')?.value;
    const endVal = document.getElementById('task-time-to-input')?.value;
    const macroId = document.getElementById('task-macro-select')?.value || null;
    const sprintId = document.getElementById('task-sprint-select')?.value || null;
    let scheduledAt=null;
    if(dateVal && startVal) {
      const [dy, dm, dd] = dateVal.split('-').map(Number);
      const [th, tm]     = startVal.split(':').map(Number);
      scheduledAt = new Date(dy, dm - 1, dd, th, tm, 0, 0).getTime();
    }
    let durMin=DEFAULT_TIMER_MIN;
    if(startVal && endVal){
      const [sh, sm] = startVal.split(':').map(Number);
      const [eh, em] = endVal.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff>0) durMin = diff;
    }
    const id=StateManager.get('editingTaskId');
    const notesInp = document.getElementById('task-notes-input');
    const budgetInp = document.getElementById('task-budget-input');
    const data={
      title, notes: notesInp?.value.trim()||'',
      priority: prioBtn?.dataset.priority||'mid', cat, scheduledAt, duration_min:durMin,
      location:'', travelTime:0, macroId: macroId||null, sprintId: macroId ? (sprintId||null) : null,
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
    const macro = g.macroId ? StateManager.get('macroGoals').find(m=>m.id===g.macroId) : null;
    const sprint = (macro && g.sprintId) ? (macro.sprints||[]).find(sp=>sp.id===g.sprintId) : null;
    body.innerHTML=`
      <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:${color}">${cat.emoji} ${cat.label}${catEarnsGems(g.cat)?' · 💎 earns crystals':''}</div>
      ${macro?`<div style="display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px;"><span>🗂️</span><span>${esc(macro.title)}${sprint?' → '+esc(sprint.title):''}</span></div>`:''}
      ${g.scheduledAt?`<div style="display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px;"><span>📅</span><span>${fmtDateTime(g.scheduledAt)}</span></div>`:''}
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

/* ═══════════════════════════════════════════════════════════
   CALENDAR CONTROLLER (with drag & drop rescheduling)
═══════════════════════════════════════════════════════════ */
const CalendarController = {
  _calDate: new Date(), _view: 'week', _nowTimer: null, _yearDate: new Date(),
  _dragGoalId: null,

  init() {
    StateManager.subscribe(()=>{ if(StateManager.get('currentView')==='calendar') this.render(); });
    document.getElementById('cal-prev')?.addEventListener('click', ()=>this.prev());
    document.getElementById('cal-next')?.addEventListener('click', ()=>this.next());
    document.getElementById('cal-today')?.addEventListener('click', ()=>{ this._calDate=new Date(); this._yearDate=new Date(); this.render(); });
    document.querySelectorAll('#calTabs .subtab').forEach(t => {
      t.addEventListener('click', () => switchSub('calTabs','cal', t.dataset.cal));
    });
  },

  setView(v) {
    this._view = v;
    document.querySelectorAll('#calTabs .subtab').forEach(b=>{
      const on = b.dataset.cal === v;
      b.classList.toggle('active', on);
      b.classList.toggle('text-white/50', !on);
    });
    this.render();
  },

  prev() {
    if(this._view==='year') { this._yearDate.setFullYear(this._yearDate.getFullYear()-1); this.render(); return; }
    if(this._view==='month') this._calDate.setMonth(this._calDate.getMonth()-1);
    else if(this._view==='week') this._calDate.setDate(this._calDate.getDate()-7);
    else this._calDate.setDate(this._calDate.getDate()-1);
    this.render();
  },
  next() {
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
    if (this._view==='day')   this._renderDay();
    else if (this._view==='week')  this._renderWeek();
    else if (this._view==='month') this._renderMonth();
    else if (this._view==='year')  this._renderYear();
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

  // Moves a task to a new date, keeping its original time-of-day and
  // duration intact — used by drag & drop across day/week/month cells.
  _rescheduleGoalToDate(goalId, targetDate) {
    const goals = StateManager.get('goals');
    const g = goals.find(x=>x.id===goalId);
    if (!g || !g.scheduledAt) return;
    const old = new Date(g.scheduledAt);
    const next = new Date(targetDate);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    const updated = goals.map(x => x.id===goalId ? { ...x, scheduledAt: next.getTime() } : x);
    StateManager.patch({ goals: updated });
    SyncManager.scheduleSync();
    TimerController.scheduleReminders();
    this.render();
    if (StateManager.get('currentView')==='tasks') TaskController.render();
    showToast(`📅 Moved to ${next.toLocaleDateString('en-US',{day:'numeric',month:'short'})}`, 1400);
  },

  // Moves a task to a new date AND a new hour (used by the hourly day/week
  // grids), preserving the task's duration.
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

  // Wires native HTML5 drag events on a task chip.
  _makeDraggable(el, goalId) {
    el.draggable = true;
    el.addEventListener('dragstart', (e)=>{
      this._dragGoalId = goalId;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', goalId); } catch(_) {}
      el.style.opacity = '0.4';
    });
    el.addEventListener('dragend', ()=>{ el.style.opacity=''; this._dragGoalId=null; });
  },

  // Wires a drop target that reschedules to a given date (day-level).
  _makeDropTargetDate(el, dateStr) {
    el.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; el.classList.add('ring-1','ring-accent'); });
    el.addEventListener('dragleave', ()=>{ el.classList.remove('ring-1','ring-accent'); });
    el.addEventListener('drop', (e)=>{
      e.preventDefault(); el.classList.remove('ring-1','ring-accent');
      const goalId = this._dragGoalId || e.dataTransfer.getData('text/plain');
      if (!goalId) return;
      this._rescheduleGoalToDate(goalId, dateStr);
    });
  },

  // Wires a drop target that reschedules to a given date + hour (hourly grids).
  _makeDropTargetDateTime(el, dateStr, hour) {
    el.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; el.classList.add('ring-1','ring-accent'); });
    el.addEventListener('dragleave', ()=>{ el.classList.remove('ring-1','ring-accent'); });
    el.addEventListener('drop', (e)=>{
      e.preventDefault(); el.classList.remove('ring-1','ring-accent');
      const goalId = this._dragGoalId || e.dataTransfer.getData('text/plain');
      if (!goalId) return;
      this._rescheduleGoalToDateTime(goalId, dateStr, hour);
    });
  },

  _renderDay() {
    if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
    const c = document.getElementById('dayGrid'); if(!c) return;
    this._updateHeaderTitle(this._calDate.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'}));
    const dk = dateKey(this._calDate.getTime());
    const goals = StateManager.get('goals').filter(g=>g.scheduledAt&&dateKey(g.scheduledAt)===dk);
    goals.sort((a,b)=>a.scheduledAt-b.scheduledAt);
    const byHour = {};
    goals.forEach(g=>{ const h=new Date(g.scheduledAt).getHours(); (byHour[h]=byHour[h]||[]).push(g); });
    let html='';
    for (let h=0; h<24; h++) {
      const label = pad(h)+':00';
      const evs = byHour[h]||[];
      html += `<div class="flex items-start gap-3 border-t border-white/8 py-1" data-drop-hour="${h}" style="min-height:52px">
        <span class="text-xs text-white/35 w-12 flex-none pt-1 tabular-nums">${label}</span>
        <div class="flex-1 space-y-1">${evs.map(g=>{
          const color=catColor(g); const cat=catInfo(g);
          return `<div class="glass-soft glass-hover rounded-xl px-3 py-2 border-l-2 flex flex-col gap-1 cursor-pointer ${g.done?'opacity-50':''}" style="border-color:${color};min-height:${Math.max(1,(g.duration_min||30)/60)*44}px" data-task-id="${g.id}">
            <p class="text-sm font-medium leading-tight" style="${g.done?'text-decoration:line-through;':''}">${esc(g.title)}</p>
            <div class="flex items-center gap-2">
              <span class="cal-event-time">${fmtTimeRange(g.scheduledAt, g.duration_min)}</span>
              <span class="tag-mini ${isUrgent(g)?'tag':'tag-grey'}">${cat.label}</span>
            </div>
          </div>`;
        }).join('')}</div>
      </div>`;
    }
    c.innerHTML = html;
    c.querySelectorAll('[data-task-id]').forEach(el=>{
      el.addEventListener('click',(e)=>{ e.stopPropagation(); TaskController.openDetail(el.dataset.taskId); });
      this._makeDraggable(el, el.dataset.taskId);
    });
    c.querySelectorAll('[data-drop-hour]').forEach(row=>{
      this._makeDropTargetDateTime(row, this._calDate, parseInt(row.dataset.dropHour));
    });
  },

  _renderWeek() {
    if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
    const c = document.getElementById('weekGrid'); if(!c) return;
    let start = new Date(this._calDate); start.setHours(0,0,0,0);
    start.setDate(start.getDate() - ((start.getDay()+6)%7)); // Monday start
    const end = new Date(start.getTime()+6*86400000);
    this._updateHeaderTitle(start.toLocaleDateString('en-US',{day:'numeric',month:'short'})+' – '+end.toLocaleDateString('en-US',{day:'numeric',month:'short'}));

    const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const todayKey = dateKey();
    const goals = StateManager.get('goals').filter(g=>g.scheduledAt);
    const byDayHour = {};
    const dayDates = [];
    for (let i=0;i<7;i++){
      const d = new Date(start.getTime()+i*86400000);
      dayDates.push(d);
      const dk = dateKey(d.getTime());
      goals.filter(g=>dateKey(g.scheduledAt)===dk).forEach(g=>{
        const h=new Date(g.scheduledAt).getHours();
        byDayHour[`${i}-${h}`] = byDayHour[`${i}-${h}`] || [];
        byDayHour[`${i}-${h}`].push(g);
      });
    }
    let head = `<div class="grid gap-2 mb-2" style="grid-template-columns:56px repeat(7,1fr)"><div></div>`;
    for (let i=0;i<7;i++){
      const d = dayDates[i];
      const dk = dateKey(d.getTime());
      head += `<div class="text-center cursor-pointer" data-day="${dk}"><p class="text-xs text-white/40">${dayNames[i]}</p><p class="font-semibold ${dk===todayKey?'text-accent':''}">${d.getDate()}</p></div>`;
    }
    head += `</div>`;
    let body='';
    for (let h=7; h<22; h++) {
      const label = pad(h)+':00';
      let row = `<div class="grid gap-2 border-t border-white/8" style="grid-template-columns:56px repeat(7,1fr);min-height:48px"><span class="text-xs text-white/35 pt-1 tabular-nums">${label}</span>`;
      for (let d=0; d<7; d++) {
        const evs = byDayHour[`${d}-${h}`]||[];
        row += `<div class="pt-1 space-y-1" data-drop-day="${d}" data-drop-hour="${h}">${evs.map(g=>{
          const color=catColor(g); const cat=catInfo(g);
          return `<div class="glass-soft glass-hover rounded-lg px-2 py-1 border-l-2 cursor-pointer ${g.done?'opacity-50':''}" style="border-color:${color}" data-task-id="${g.id}">
            <p class="text-xs font-medium truncate leading-tight" style="${g.done?'text-decoration:line-through;':''}">${esc(g.title)}</p>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="cal-event-time">${fmtTimeRange(g.scheduledAt, g.duration_min)}</span>
              <span class="tag-mini ${isUrgent(g)?'tag':'tag-grey'}">${cat.label}</span>
            </div>
          </div>`;
        }).join('')}</div>`;
      }
      row += `</div>`;
      body += row;
    }
    c.innerHTML = head + body;
    c.querySelectorAll('[data-day]').forEach(el=>el.addEventListener('click',()=>this._navigateToDay(el.dataset.day)));
    c.querySelectorAll('[data-task-id]').forEach(el=>{
      el.addEventListener('click',e=>{e.stopPropagation(); TaskController.openDetail(el.dataset.taskId);});
      this._makeDraggable(el, el.dataset.taskId);
    });
    c.querySelectorAll('[data-drop-day]').forEach(cell=>{
      const dIdx = parseInt(cell.dataset.dropDay);
      const hour = parseInt(cell.dataset.dropHour);
      this._makeDropTargetDateTime(cell, dayDates[dIdx], hour);
    });
  },

  _renderMonth() {
    if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
    const c = document.getElementById('monthGrid'); if(!c) return;
    const y=this._calDate.getFullYear(), m=this._calDate.getMonth();
    this._updateHeaderTitle(this._calDate.toLocaleString('en-US',{month:'long',year:'numeric'}));
    const first=new Date(y,m,1).getDay(), offset=(first===0)?6:first-1, dim=new Date(y,m+1,0).getDate();
    const goals=StateManager.get('goals'), tasksByDay={};
    goals.forEach(g=>{ if(!g.scheduledAt) return; const d=new Date(g.scheduledAt); if(d.getFullYear()===y&&d.getMonth()===m){ const day=d.getDate(); (tasksByDay[day]=tasksByDay[day]||[]).push(g); } });
    Object.values(tasksByDay).forEach(arr=>arr.sort((a,b)=>{
      const p={high:0,mid:1,low:2}; const pa=(p[a.priority]||1), pb=(p[b.priority]||1);
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
        return `<div class="flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded-md mt-1 overflow-hidden ${g.done?'opacity-50':''}" style="background:${color}22;border-left:2px solid ${color};color:rgba(255,255,255,.85)" data-task-id="${g.id}"><span class="w-1.5 h-1.5 rounded-full flex-none" style="background:${color}"></span><span class="whitespace-nowrap overflow-hidden text-ellipsis" style="${g.done?'text-decoration:line-through;':''}">${esc(g.title)}</span><span class="cal-event-time" style="margin-left:auto;">${fmtTimeRange(g.scheduledAt, g.duration_min)}</span></div>`;
      }).join('');
      if (dayTasks.length>MAX) items += `<div class="text-[10px] text-accent mt-1">+ ${dayTasks.length-MAX} more</div>`;
      html += `<div class="glass-soft glass-hover rounded-xl p-2 flex flex-col gap-1 min-h-24 cursor-pointer ${isToday?'ring-1 ring-accent':''}" data-day="${dk}">
        <span class="text-xs font-semibold ${isToday?'text-accent':'text-white/60'}">${d}</span>${items}</div>`;
    }
    c.innerHTML = html;
    c.querySelectorAll('[data-day]').forEach(el=>{
      el.addEventListener('click',()=>this._navigateToDay(el.dataset.day));
      this._makeDropTargetDate(el, el.dataset.day);
    });
    c.querySelectorAll('[data-task-id]').forEach(el=>{
      el.addEventListener('click',e=>{e.stopPropagation(); TaskController.openDetail(el.dataset.taskId);});
      this._makeDraggable(el, el.dataset.taskId);
    });
  },

  _renderYear() {
    if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
    const c = document.getElementById('yearGrid'); if(!c) return;
    const y = this._yearDate.getFullYear();
    this._updateHeaderTitle(String(y));
    const goals = StateManager.get('goals');
    const tasksByDate = {};
    goals.forEach(g=>{ if(!g.scheduledAt) return; const dk=dateKey(g.scheduledAt); (tasksByDate[dk]=tasksByDate[dk]||[]).push(g); });
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
      let t=new Date(Date.now()); t.setHours(rh,rm,0,0); if(t<=now) t.setDate(t.getDate()+1);
      const delta=t.getTime()-now;
      if(delta>0&&delta<86400000) this._timerIds.push(setTimeout(()=>{
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
    setInterval(()=>{
      const now=new Date();
      if(now.getHours()===0&&now.getMinutes()===0){
        const st=StateManager.get('streak'), today=dateKey(), yest=dateKey(Date.now()-86400000);
        if(st.lastDate!==today&&st.lastDate!==yest) StateManager.patch({streak:{...st,days:0,doneToday:false}});
      }
    },60000);
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
  _rafId:null, _firedAlarms:new Set(), _alarmAudio:{}, _reminderTimers:[],

  init() {
    document.getElementById('btn-add-5m')?.addEventListener('click', ()=>this.addMinutes(5));
    document.getElementById('btn-add-10m')?.addEventListener('click', ()=>this.addMinutes(10));
    document.getElementById('btn-add-20m')?.addEventListener('click', ()=>this.addMinutes(20));
    document.getElementById('btn-add-30m')?.addEventListener('click', ()=>this.addMinutes(30));
    document.getElementById('btn-timer-toggle')?.addEventListener('click', ()=>this.toggle());
    document.getElementById('btn-timer-restart')?.addEventListener('click', ()=>this.reset());
    document.getElementById('btn-timer-delete')?.addEventListener('click', ()=>this.deleteActive());
    document.getElementById('btn-timer-pick-task')?.addEventListener('click', ()=>this.openPicker());
    // FIX: goalPickerModal task selection.
    // Delegated click bound ONCE on the stable container (#goal-picker-list),
    // not on the individual row elements that get wiped out and rebuilt by
    // innerHTML on every openPicker()/_renderPickerList() call. Because the
    // listener lives on the parent, it survives every re-render and always
    // finds the row via closest('[data-id]') at click time — this is what
    // makes task selection for the timer actually work.
    document.getElementById('goal-picker-list')?.addEventListener('click', (e)=>{
      const row = e.target.closest('[data-id]');
      if (!row) return;
      this.setGoal(row.dataset.id);
      closeModal('goalPickerModal');
    });
  },

  setGoal(id) {
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
    this.tick();
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
    showToast('▶ Timer started', 1200); this._rafLoop();
  },
  _pauseCd() {
    const g=this._goal(); if(!g) return;
    g.elapsed=(g.elapsed||0)+(Date.now()-g.startTime)/1000; g.startTime=null; g.paused=true;
    StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
    cancelAnimationFrame(this._rafId); this._rafId=null;
    this._updateToggleLabel();
  },
  _updateToggleLabel() {
    const g=this._goal();
    const lbl=document.getElementById('btn-timer-toggle-label');
    if (lbl) lbl.textContent = (g && g.startTime && !g.paused) ? 'Pause' : 'Start';
  },

  reset() {
    cancelAnimationFrame(this._rafId); this._rafId=null;
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
      g.startTime=null; g.paused=true; StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
      cancelAnimationFrame(this._rafId); this._rafId=null;
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
    const goals = StateManager.get('goals');
    const macros = StateManager.get('macroGoals');
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

    // Big goals sphere — % of macro goals whose linked tasks are all done
    const macrosWithTasks = macros.filter(m => goals.some(gg=>gg.macroId===m.id));
    const completedMacros = macrosWithTasks.filter(m => {
      const linked = goals.filter(gg=>gg.macroId===m.id);
      return linked.length>0 && linked.every(gg=>gg.done);
    }).length;
    const totalMacros = macros.length;
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
    const active=StateManager.get('goals').filter(g=>!g.done);
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
    card.style.cssText='display:flex;align-items:center;gap:12px;background:rgba(255,59,48,.16);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);border:1px solid rgba(255,59,48,.5);border-radius:16px;padding:12px 16px;color:#fff;box-shadow:0 0 22px rgba(255,59,48,.4);';
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
    StateManager.get('goals').filter(g=>!g.done&&g.scheduledAt&&g.reminders?.length).forEach(g=>{
      g.reminders.forEach(mins=>{
        const fireAt=g.scheduledAt-mins*60000, delta=fireAt-Date.now();
        if(delta>0){const tid=setTimeout(()=>this.triggerAlarm(g,`In ${mins<60?mins+' min':(mins/60)+' h'}!`),delta); this._reminderTimers.push(tid);}
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
          <span>${qty} ${item.unit} · ${item.baseTime*qty}${item.unit==='min'?'m':''}</span>
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
   MACRO CONTROLLER — Projects, each with an optional list of
   Sprints (sub-goals). Tasks link to a macro (project) and,
   optionally, to one of that project's sprints — giving the
   3-level Project → Sprint → Task structure used by
   renderProjectsPanel().
═══════════════════════════════════════════════════════════ */
const MacroController = {
  _draftSprints:[],

  init() {
    // Both the sidebar "+ Add Goal" (Profile view) and the Tasks-view
    // "+ New Project" button open the exact same project-creation modal.
    document.getElementById('btn-add-macro')?.addEventListener('click', ()=>this.openModal());
    document.getElementById('btn-new-macro')?.addEventListener('click', ()=>this.openModal());
    document.getElementById('btn-save-macro')?.addEventListener('click', ()=>this.save());
    document.getElementById('btn-delete-macro')?.addEventListener('click', ()=>this.delete(document.getElementById('macro-edit-id')?.value));
    document.getElementById('btn-macro-add-sprint')?.addEventListener('click', ()=>this._addDraftSprint());
    document.getElementById('macro-new-sprint-input')?.addEventListener('keydown', (e)=>{
      if (e.key==='Enter') { e.preventDefault(); this._addDraftSprint(); }
    });
  },

  _addDraftSprint() {
    const inp = document.getElementById('macro-new-sprint-input');
    const val = inp?.value.trim();
    if (!val) return;
    this._draftSprints.push({ id:'sprint_'+Date.now().toString(36)+rnd(), title:val });
    if (inp) inp.value='';
    this._renderDraftSprints();
  },

  _renderDraftSprints() {
    const list = document.getElementById('macro-sprints-list');
    if (!list) return;
    if (!this._draftSprints.length) {
      list.innerHTML = `<p class="text-white/35 text-xs" style="padding:4px 0;">No sprints yet — tasks will fall under "Unsorted".</p>`;
      return;
    }
    list.innerHTML = this._draftSprints.map((s,i)=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <input class="field" type="text" value="${esc(s.title)}" data-i="${i}" data-role="sprint-rename" style="flex:1;">
        <button type="button" data-i="${i}" data-role="sprint-remove" style="background:rgba(255,255,255,.08);border:none;color:#fff;width:32px;height:32px;border-radius:10px;cursor:pointer;flex:none;">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-role="sprint-rename"]').forEach(inp=>{
      inp.addEventListener('input', e=>{ this._draftSprints[parseInt(e.target.dataset.i)].title = e.target.value; });
    });
    list.querySelectorAll('[data-role="sprint-remove"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ this._draftSprints.splice(parseInt(btn.dataset.i),1); this._renderDraftSprints(); });
    });
  },

  // Folds an unsubmitted sprint name into the draft before save, same
  // guard pattern as RoutineManager's action-input flush.
  _flushPendingSprint() {
    const inp = document.getElementById('macro-new-sprint-input');
    const val = inp?.value.trim();
    if (!val) return;
    if (!this._draftSprints.some(s=>s.title.toLowerCase()===val.toLowerCase())) {
      this._draftSprints.push({ id:'sprint_'+Date.now().toString(36)+rnd(), title:val });
    }
    if (inp) inp.value = '';
  },

  openModal(id=null) {
    const mg=id?StateManager.get('macroGoals').find(x=>x.id===id):null;
    this._draftSprints = mg ? JSON.parse(JSON.stringify(mg.sprints||[])) : [];
    document.getElementById('macroModalTitle').textContent = mg?'Edit Project':'New Project';
    document.getElementById('macro-edit-id').value = mg?.id||'';
    document.getElementById('macro-title').value = mg?.title||'';
    document.getElementById('macro-deadline').value = mg?.deadline||'';
    document.getElementById('macro-gems-reward').value = mg?.gemsReward||50;
    const newSprintInp = document.getElementById('macro-new-sprint-input');
    if (newSprintInp) newSprintInp.value = '';
    document.getElementById('btn-delete-macro').classList.toggle('hidden', !mg);
    this._renderDraftSprints();
    openModal('macroModal');
  },

  save() {
    const title=document.getElementById('macro-title')?.value.trim(); if(!title){showToast('Enter a project title'); return;}
    const id=document.getElementById('macro-edit-id')?.value;
    const deadline=document.getElementById('macro-deadline')?.value;
    const gemsReward=parseInt(document.getElementById('macro-gems-reward')?.value||'50');
    this._flushPendingSprint();
    const sprintsSnapshot = this._draftSprints.map(s=>({...s}));
    const prevMacros = StateManager.get('macroGoals');
    let macros;
    if (id) {
      macros = prevMacros.map(m => m.id===id ? { ...m, title, deadline, gemsReward, sprints:sprintsSnapshot } : m);
    } else {
      macros = [...prevMacros, { id:'macro_'+Date.now().toString(36)+rnd(), title, deadline, gemsReward, sprints:sprintsSnapshot, createdAt:Date.now() }];
    }
    StateManager.set('macroGoals',macros); SyncManager.scheduleSync(); closeModal('macroModal');
    if (StateManager.get('currentView')==='profile') ProfileRenderer.render();
    if (StateManager.get('currentView')==='tasks') renderProjectsPanel();
    TimerController.renderSpheres();
    showToast(id?'✅ Project updated':'✅ Project created');
  },
  delete(id) {
    if (!id) return;
    if (!confirm('Delete this project? Linked tasks will stay but become unlinked.')) return;
    StateManager.set('macroGoals', StateManager.get('macroGoals').filter(m=>m.id!==id));
    const goals = StateManager.get('goals').map(g => g.macroId===id ? {...g, macroId:null, sprintId:null} : g);
    StateManager.set('goals', goals);
    SyncManager.scheduleSync();
    closeModal('macroModal');
    ProfileRenderer.render();
    if (StateManager.get('currentView')==='tasks') renderProjectsPanel();
    showToast('🗑 Project deleted');
  },
};

/* ═══════════════════════════════════════════════════════════
   PROFILE RENDERER
═══════════════════════════════════════════════════════════ */
const ProfileRenderer = {
  render() {
    const st=StateManager.get();
    const lv=getLevel(st.gems);

    syncProfileNameEverywhere();
    const levelEl = document.getElementById('profile-level'); if (levelEl) levelEl.textContent = `${lv.emoji} ${lv.label}`;

    // Level progress bar — progress within the current level band toward the next
    const idx = LEVELS.findIndex(l=>l.label===lv.label);
    const next = LEVELS[idx+1];
    const bar = document.getElementById('profile-level-bar');
    if (bar) {
      if (next) {
        const span = next.min - lv.min;
        const into = st.gems - lv.min;
        bar.style.width = Math.max(4,Math.min(100, Math.round(into/span*100)))+'%';
      } else bar.style.width = '100%';
    }

    const totalCreated = document.getElementById('stat-total-created'); if (totalCreated) totalCreated.textContent = st.goals.length;
    const doneCount = st.goals.filter(g=>g.done).length, totalGoals = st.goals.length || 1;
    const progressEl = document.getElementById('stat-progress'); if (progressEl) progressEl.textContent = Math.round(doneCount/totalGoals*100)+'%';
    const successRate = st.goals.length ? Math.round((doneCount/st.goals.length)*100) : 0;
    const successEl = document.getElementById('stat-success-rate'); if (successEl) successEl.textContent = successRate+'%';
    const streakEl = document.getElementById('stat-streak');
    if (streakEl) streakEl.innerHTML = `🔥 ${st.streak.days}`;

    this._renderMacroList();
    this._renderPurchaseHistory();
    updateCrystalChips();
  },

  _renderMacroList() {
    const listWrap = document.getElementById('macro-goals-list');
    if (!listWrap) return;
    const macros = StateManager.get('macroGoals');
    const goals = StateManager.get('goals');

    if (!macros.length) {
      listWrap.innerHTML = `<div class="empty-state" style="padding:20px 0;"><div class="empty-icon">🎯</div><div class="empty-title">No goals yet</div><div class="empty-sub">Tap + Add Goal to create one</div></div>`;
      return;
    }
    listWrap.innerHTML = macros.map(mg => {
      const linked = goals.filter(g=>g.macroId===mg.id);
      const done = linked.filter(g=>g.done).length;
      const total = linked.length;
      const pct = total>0 ? Math.round(done/total*100) : 0;
      return `<div data-macro-id="${mg.id}" style="cursor:pointer;">
        <div class="flex justify-between text-sm mb-1.5"><span>${esc(mg.title)}</span><span class="text-accent font-semibold">${pct}%</span></div>
        <div class="h-2.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full accent-grad rounded-full" style="width:${pct}%"></div></div>
        <p class="text-white/35 text-xs mt-1">${total?`${done}/${total} tasks`:'No linked tasks'}${mg.deadline?' · due '+new Date(mg.deadline).toLocaleDateString('en-US'):''} · 💎 ${mg.gemsReward||50}</p>
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
}

function initSettingsHandlers() {
  // Saving Settings persists the display name into StateManager (which
  // writes it to localStorage under 'nova-profile-name') and immediately
  // re-syncs every on-screen copy of the name via syncProfileNameEverywhere().
  document.getElementById('btn-save-settings')?.addEventListener('click', ()=>{
    const nameVal = document.getElementById('settings-profile-name')?.value.trim();
    StateManager.patch({
      profileName: nameVal || 'You',
      tgToken: document.getElementById('settings-tg-token')?.value.trim()||'',
      tgChatId: document.getElementById('settings-tg-chat')?.value.trim()||'',
      webhookUrl: document.getElementById('settings-webhook')?.value.trim()||'',
    });
    SyncManager.scheduleSync();
    closeModal('modal-settings');
    syncProfileNameEverywhere();
    if (StateManager.get('currentView')==='profile') ProfileRenderer.render();
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
  document.getElementById('btn-reset-data')?.addEventListener('click', resetData);
  document.getElementById('btn-load-demo')?.addEventListener('click', loadDemoData);
}

function exportData() {
  const data={...StateManager.get(),exportedAt:Date.now()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=`nova-os-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('💾 Data exported');
}
function resetData() {
  if(!confirm('Delete ALL data? This cannot be undone!')) return;
  ['nova-goals','nova-history','nova-gems','nova-streak','nova-purchases','nova-macros','nova-tags','nova-pomo','nova-sleep','nova-uid','nova-theme','nova-routines','nova-tg-token','nova-tg-chat','nova-webhook','nova-profile-name',
   'lifeos-goals','lifeos-history','lifeos-gems','lifeos-streak2','lifeos-purchases','lifeos-macros','lifeos-tags','lifeos-pomo'].forEach(k=>localStorage.removeItem(k));
  location.reload();
}
function loadDemoData() {
  const now=Date.now(), day=86400000;
  const demoGoals=[
    {id:'demo_1',title:'Read "Atomic Habits"',cat:'study',priority:'high',color:'#5E5CE6',scheduledAt:now-3600000,duration_min:60,tags:[],subtasks:[{id:'st1',text:'Chapters 1-5',done:true},{id:'st2',text:'Notes',done:false}],notes:'Key insights on habits',done:false,elapsed:0,createdAt:now-day*3,macroId:null,sprintId:null},
    {id:'demo_2',title:'Strength workout',cat:'health',priority:'high',color:'#FF9500',scheduledAt:now+7200000,duration_min:45,tags:[],subtasks:[],notes:'Bench, squats, deadlift',done:false,elapsed:0,createdAt:now-day,macroId:'macro_demo_2',sprintId:null},
    {id:'demo_3',title:'Ship landing MVP',cat:'business',priority:'mid',color:'#FF3B30',scheduledAt:now+day,duration_min:120,tags:[],subtasks:[{id:'st3',text:'Design',done:true},{id:'st4',text:'Build',done:true},{id:'st5',text:'Deploy',done:false}],notes:'',done:false,elapsed:3600,createdAt:now-day*5,macroId:'macro_demo',sprintId:'sprint_demo_1'},
    {id:'demo_4',title:'10-minute meditation',cat:'life',priority:'low',color:'#34C759',scheduledAt:now+1800000,duration_min:10,tags:[],subtasks:[],notes:'Breathe, don\'t think',done:false,elapsed:0,createdAt:now,macroId:null,sprintId:null},
    {id:'demo_5',title:'Draft planning template',cat:'business',priority:'mid',color:'#F72585',scheduledAt:now+day*2,duration_min:90,tags:[],subtasks:[],notes:'',done:false,elapsed:0,createdAt:now-day*2,macroId:'macro_demo',sprintId:'sprint_demo_2'},
  ];
  const demoHistory=[
    {id:'dh1',goalId:'demo_old_1',title:'Morning 5k run',cat:'health',color:'#FF9500',completedAt:now-3600000,elapsed_ms:1800000,gems:1},
    {id:'dh2',goalId:'demo_old_2',title:'Team standup call',cat:'business',color:'#FF3B30',completedAt:now-86400000,elapsed_ms:3600000,gems:1},
    {id:'dh3',goalId:'demo_old_3',title:'Study Vercel KV API',cat:'study',color:'#5E5CE6',completedAt:now-172800000,elapsed_ms:5400000,gems:0},
    {id:'dh4',goalId:'demo_old_4',title:'Sketch wireframe',cat:'creative',color:'#F72585',completedAt:now-259200000,elapsed_ms:2700000,gems:0},
    {id:'dh5',goalId:'demo_old_5',title:'Family dinner',cat:'life',color:'#34C759',completedAt:now-345600000,elapsed_ms:7200000,gems:0},
  ];
  const st=StateManager.get();
  const goals=[...demoGoals,...st.goals.filter(g=>!g.id.startsWith('demo_'))];
  const history=[...demoHistory,...st.history.filter(h=>!h.id.startsWith('dh'))];
  const macroGoals=[
    {id:'macro_demo',title:'🚀 Launch SaaS project',deadline:new Date(now+day*60).toISOString().slice(0,10),gemsReward:100,createdAt:now-day*10,sprints:[{id:'sprint_demo_1',title:'Sprint 1 — MVP'},{id:'sprint_demo_2',title:'Sprint 2 — Templates'}]},
    {id:'macro_demo_2',title:'🏃 Run a half marathon',deadline:new Date(now+day*90).toISOString().slice(0,10),gemsReward:80,createdAt:now-day*8,sprints:[]},
    ...st.macroGoals.filter(m=>!m.id.startsWith('macro_demo')),
  ];
  StateManager.patch({goals,history,gems:Math.max(st.gems,27),streak:{days:5,lastDate:dateKey(),doneToday:true,best:Math.max(st.streak.best||0,5)},macroGoals});
  SyncManager.scheduleSync();
  closeModal('modal-settings');
  refreshEverything();
  showToast('🎉 Demo data loaded!');
}

/* ═══════════════════════════════════════════════════════════
   VOICE INPUT
═══════════════════════════════════════════════════════════ */
const VoiceInput = {
  _rec:null, _active:false,
  init() {
    try {
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){ this._unsupported=true; return; }
      this._rec=new SR(); this._rec.lang='en-US'; this._rec.continuous=false; this._rec.interimResults=true;
      this._rec.onresult=e=>{
        const txt=[...e.results].map(r=>r[0].transcript).join('');
        const el=document.getElementById('voiceTranscript'); if(el) el.value=txt;
        if(e.results[e.results.length-1].isFinal){ this.stop(); this.apply(txt); }
      };
      this._rec.onerror=()=>this.stop();
      this._rec.onend=()=>{ this._active=false; };
    } catch(e){ console.warn('Voice not supported',e); this._unsupported=true; }
  },
  start() {
    const dot = document.getElementById('voiceDot');
    const status = document.getElementById('voiceStatus');
    if (this._unsupported) { showToast('🎤 Voice input not supported in this browser'); return; }
    if (!this._rec) return;
    this._active = true;
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
  parse(text) {
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
    tagMatches.forEach(m=>{ const name=m.slice(1).toLowerCase(); let t=tags.find(t=>t.name.toLowerCase()===name); if(!t){t={id:'tag_'+Date.now().toString(36)+rnd(),name,color:TAG_PALETTE[tags.length%TAG_PALETTE.length]}; tags.push(t); StateManager.set('tags',tags);} result.tags.push(t.id); });
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
  document.getElementById('btn-open-voice')?.addEventListener('click', ()=>openModal('modal-voice'));
  document.getElementById('btn-voice-stop')?.addEventListener('click', ()=>{ VoiceInput.stop(); });
  document.getElementById('btn-voice-parse')?.addEventListener('click', ()=>{
    const txt = document.getElementById('voiceTranscript')?.value.trim();
    if (txt) VoiceInput.apply(txt); else closeModal('modal-voice');
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
    if (el.id==='toggle-soft-alarm' || el.dataset.action==='toggle-routine') return; // wired elsewhere
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
  setTimeout(()=>{ try{SyncManager.loadFromCloud();}catch(e){console.warn('[Init:KV]',e);} }, 2000);
  console.log('[Nova OS v7.1] ✅ Initialization complete');
});