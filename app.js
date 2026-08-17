/* ══════════════════════════════════════════════════════════════
   LIFE OS PWA — app.js v4.0
   StateManager · SyncManager · ViewRouter · TaskController
   CalendarController · RoutineManager · TimerController
   StoreController · MacroController · ProfileRenderer
   VoiceInput · NLP · Demo · Vercel KV 2-Way Sync
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const CATS = {
  business: { label: 'Бизнес',     color: '#0A84FF', emoji: '💼' },
  life:     { label: 'Жизнь',      color: '#30D158', emoji: '🌱' },
  study:    { label: 'Учёба',      color: '#BF5AF2', emoji: '📚' },
  health:   { label: 'Здоровье',   color: '#FF9F0A', emoji: '💪' },
  creative: { label: 'Творчество', color: '#FF375F', emoji: '🎨' },
};
const COLOR_PALETTE = [
  '#0A84FF','#007AFF','#5AC8FA','#64D2FF','#30D158','#34C759',
  '#30B0C7','#32ADE6','#BF5AF2','#AF52DE','#FF375F','#FF2D55',
  '#FF453A','#FF6961','#FF9F0A','#FFCC00','#FFD60A','#FF9500',
  '#FF6B35','#F7931E','#5E5CE6','#7B7AE0','#A5A4F0','#C7C6FF',
  '#D4AF37','#E8C547','#48CAE4','#00B4D8','#9B5DE5','#C77DFF',
  '#F72585','#B5179E','#06D6A0','#2DC653','#8338EC','#3A86FF',
  '#FB5607','#FF006E','#FFBE0B','#8AC926',
];
const TAG_PALETTE = COLOR_PALETTE.slice(0, 10);
const TAG_DEFAULT_NAMES = ['фокус','срочно','важно','рутина','обучение','проект'];
const REMINDER_OPTIONS = [1, 5, 15, 30, 60, 1440];
const STORE_ITEMS = [
  { id:'m1', cat:'media',  icon:'🎬', title:'Фильм / Сериал',       baseTime:20, unit:'мин', baseCost:1,  desc:'Легальный просмотр без чувства вины.' },
  { id:'m2', cat:'media',  icon:'📱', title:'Соцсети (Скроллинг)',   baseTime:15, unit:'мин', baseCost:1,  desc:'Reels, TikTok, Shorts — без ограничений.' },
  { id:'m3', cat:'media',  icon:'▶️', title:'YouTube (развлечения)', baseTime:20, unit:'мин', baseCost:1,  desc:'Обзоры, летсплеи, мемы — честно заработано.' },
  { id:'g1', cat:'games',  icon:'🎮', title:'Игры (PC / PS)',         baseTime:30, unit:'мин', baseCost:2,  desc:'Полноценный гейминг — по заслугам!' },
  { id:'g2', cat:'games',  icon:'🕹️', title:'Мобильные игры',        baseTime:15, unit:'мин', baseCost:1,  desc:'Быстрые катки на телефоне.' },
  { id:'f1', cat:'food',   icon:'🍔', title:'Фастфуд (Читмил)',       baseTime:1,  unit:'шт',  baseCost:10, desc:'Бургер, пицца или шаурма — ты заслужил.' },
  { id:'f2', cat:'food',   icon:'🥔', title:'Чипсы / Снеки',          baseTime:1,  unit:'уп',  baseCost:5,  desc:'Вредно, но вкусно и честно.' },
  { id:'f3', cat:'food',   icon:'🍫', title:'Шоколад / Сладость',     baseTime:1,  unit:'шт',  baseCost:4,  desc:'Доза сахара за продуктивный труд.' },
];
const LEVELS = [
  { min:0,   label:'Новичок',     emoji:'🌱' },
  { min:10,  label:'Стажёр',      emoji:'⚡' },
  { min:25,  label:'Практик',     emoji:'🔥' },
  { min:50,  label:'Мастер',      emoji:'💎' },
  { min:100, label:'Ветеран',     emoji:'🏆' },
  { min:200, label:'Легенда',     emoji:'⭐' },
  { min:500, label:'Элита',       emoji:'👑' },
  { min:999, label:'Непобедимый', emoji:'🌟' },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function pad(n, d=2) { return String(Math.floor(Math.abs(n))).padStart(d,'0'); }
function rnd() { return Math.random().toString(36).slice(2,7); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dateKey(ts) { const d=new Date(ts||Date.now()); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtD(s) { const dy=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); if(dy>0) return `${dy}д ${pad(h)}ч`; if(h>0) return `${h}ч ${pad(m)}м`; if(m>0) return `${m}м ${pad(sec)}с`; return `${sec}с`; }
function fmtRel(ts) { const d=Date.now()-ts,m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24); if(dy>0) return `${dy}д назад`; if(h>0) return `${h}ч назад`; if(m>0) return `${m}м назад`; return 'только что'; }
function fmtTime(ts) { if(!ts) return ''; const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDateTime(ts) { if(!ts) return ''; const d=new Date(ts); return d.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }
function getLevel(gemCount) { let lv=LEVELS[0]; for(const l of LEVELS){if(gemCount>=l.min) lv=l;} return lv; }
function catColor(g) { return g.color||(CATS[g.cat]||CATS.business).color; }

/* ═══════════════════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════════════════ */
function showToast(msg, duration=3000) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast-card show'; t.textContent = msg;
  stack.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
}
let popQueue=[], popShowing=false;
function showPopup(type, icon, title, sub) { popQueue.push({type,icon,title,sub}); if(!popShowing) flushPopup(); }
function flushPopup() {
  if (!popQueue.length) { popShowing=false; return; }
  popShowing=true;
  const {type,icon,title,sub} = popQueue.shift();
  const stack = document.getElementById('toast-stack');
  if (!stack) { setTimeout(flushPopup,3600); return; }
  const card = document.createElement('div');
  card.className = `popup-card ${type}-card show`;
  card.innerHTML = `<div class="popup-icon">${icon}</div><div class="popup-text"><div class="popup-title">${esc(title)}</div><div class="popup-sub">${esc(sub)}</div></div>`;
  stack.appendChild(card);
  setTimeout(() => { card.classList.remove('show'); setTimeout(() => { card.remove(); flushPopup(); }, 400); }, 3200);
}
function openModal(id) { const el=document.getElementById(id); if(el){el.classList.add('open'); document.body.classList.add('modal-open');} }
function closeModal(id) { const el=document.getElementById(id); if(el){el.classList.remove('open'); document.body.classList.remove('modal-open');} }

/* ═══════════════════════════════════════════════════════════
   STATE MANAGER  (Pub/Sub + localStorage)
═══════════════════════════════════════════════════════════ */
const StateManager = (() => {
  let state = {
    goals:[], history:[], purchases:[], cart:[], gems:0,
    streak:{ days:0, lastDate:'', doneToday:false }, tags:[], macroGoals:[],
    pomoConfig:{ work:25, short:5, long:15 }, pomoPhase:'work', pomoCycles:0,
    sleepSettings:{ bedtime:'23:00', waketime:'07:00', eveningPrepMins:30, eveningGratitudeMins:15, morningWaterDelay:5, morningBrushDelay:10, softAlarmEnabled:true },
    tgToken:'', tgChatId:'', currentView:'tasks', taskFilter:'today', taskTagFilter:null,
    searchQuery:'', sortMode:'date', calView:'month', timerMode:'countdown',
    activeTaskId:null, editingTaskId:null, detailTaskId:null, storeFilter:'all', storeDraft:{},
  };
  const listeners = [];

  function load() {
    try {
      const tryParse = (key, def) => { try { return JSON.parse(localStorage.getItem(key)||'null')||def; } catch(e){return def;} };
      const g = tryParse('lifeos-goals', []);
      const h = tryParse('lifeos-history', []);
      const p = tryParse('lifeos-purchases', []);
      const gems = parseInt(localStorage.getItem('lifeos-gems')||'0')||0;
      const streak = tryParse('lifeos-streak', { days:0, lastDate:'', doneToday:false });
      let tags = tryParse('lifeos-tags', null);
      if (!tags) tags = TAG_DEFAULT_NAMES.map((name,i) => ({ id:'tag_default_'+i, name, color:TAG_PALETTE[i%TAG_PALETTE.length] }));
      const macros  = tryParse('lifeos-macros', []);
      const pomo    = tryParse('lifeos-pomo', { work:25, short:5, long:15 });
      const sleep   = tryParse('lifeos-sleep', state.sleepSettings);
      const tgToken = localStorage.getItem('lifeos-tg-token')||'';
      const tgChatId= localStorage.getItem('lifeos-tg-chat')||'';
      const theme   = localStorage.getItem('lifeos-theme')||'dark';
      document.body.dataset.theme = theme;

      // Also migrate old 'цель-' keys if lifeos- are empty
      if (!g.length) {
        const old = tryParse('цель-goals', []);
        if (old.length) { g.push(...old); }
      }

      g.forEach(gg => {
        if (!gg.location)     gg.location=''; if (!gg.participants) gg.participants=[];
        if (!gg.cost)         gg.cost=0;      if (!gg.travelTime)   gg.travelTime=0;
        if (!gg.reminders)    gg.reminders=[]; if (!gg.color)        gg.color='';
        if (!gg.scheduledAt)  gg.scheduledAt=null;
        if (!gg.duration_min) gg.duration_min = Math.round((gg.duration||1500)/60);
        if (!gg.notes)        gg.notes=''; if (!gg.subtasks) gg.subtasks=[]; if (!gg.tags) gg.tags=[];
      });

      const draft = {}; STORE_ITEMS.forEach(i => draft[i.id]=1);
      state = { ...state, goals:g, history:h, purchases:p, gems, streak, tags, macroGoals:macros, pomoConfig:pomo, sleepSettings:sleep, tgToken, tgChatId, storeDraft:draft };
    } catch(e) { console.error('[StateManager load]', e); }
  }

  function save() {
    try {
      localStorage.setItem('lifeos-goals',    JSON.stringify(state.goals));
      localStorage.setItem('lifeos-history',  JSON.stringify(state.history));
      localStorage.setItem('lifeos-purchases',JSON.stringify(state.purchases));
      localStorage.setItem('lifeos-gems',     String(state.gems));
      localStorage.setItem('lifeos-streak',   JSON.stringify(state.streak));
      localStorage.setItem('lifeos-tags',     JSON.stringify(state.tags));
      localStorage.setItem('lifeos-macros',   JSON.stringify(state.macroGoals));
      localStorage.setItem('lifeos-pomo',     JSON.stringify(state.pomoConfig));
      localStorage.setItem('lifeos-sleep',    JSON.stringify(state.sleepSettings));
      localStorage.setItem('lifeos-tg-token', state.tgToken||'');
      localStorage.setItem('lifeos-tg-chat',  state.tgChatId||'');
      // LWW-метка: обновляется при каждом сохранении локального стейта.
      // SyncManager читает её и передаёт на сервер как updatedAt.
      localStorage.setItem('lifeos-updatedAt', String(Date.now()));
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
   SYNC MANAGER  (Vercel KV 2-Way)
═══════════════════════════════════════════════════════════ */
const SyncManager = (() => {
  const KV = '/api/sync';
  let kvTimer=null, badgeTimer=null;

  function getUid() {
    const host = window.location.hostname;
    if (host === 'cernavation.vercel.app' || host === 'localhost') {
      localStorage.setItem('lifeos-uid', 'master_admin_id');
      return 'master_admin_id';
    }
    let uid = localStorage.getItem('lifeos-uid');
    if (!uid) { uid = 'guest_' + Date.now().toString(36) + rnd(); localStorage.setItem('lifeos-uid', uid); }
    return uid;
  }
  function setBadge(cls,text) {
    const b = document.querySelector('.drawer-sync');
    if (!b) return; b.className='drawer-sync '+(cls!=='hidden'?cls:''); b.textContent=cls!=='hidden'?text:'';
  }

  async function doSync() {
    setBadge('syncing','↑ Синхронизация…');
    try {
      const s = StateManager.get();
      // updatedAt — метка времени последнего изменения на этом клиенте.
      // Сервер использует её для Last-Write-Wins: если сервер новее — вернёт forceUpdate.
      const localUpdatedAt = parseInt(localStorage.getItem('lifeos-updatedAt') || '0') || Date.now();
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
          // Сервер новее — принудительно заменяем локальный стейт серверными данными
          console.warn('[SyncManager] forceUpdate: server is newer, overwriting local state');
          _applyServerData(json.data);
          setBadge('synced', '↓ Обновлено с сервера');
        } else {
          // Успешно сохранили — обновляем метку
          if (json.updatedAt) localStorage.setItem('lifeos-updatedAt', String(json.updatedAt));
          setBadge('synced', '✓ Синхронизировано');
        }
      } else {
        setBadge('hidden', '');
      }
    } catch (_) { setBadge('hidden', ''); }
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => setBadge('hidden', ''), 2400);
  }

  // Полностью заменяет локальный стейт данными с сервера (для loadFromCloud и forceUpdate)
  function _applyServerData(data) {
    if (!data || !data.goals) return;
    const s = StateManager.get();
    // Полная замена — сервер является источником истины
    StateManager.patch({
      goals:      Array.isArray(data.goals)   ? data.goals   : s.goals,
      history:    Array.isArray(data.history) ? data.history : s.history,
      gems:       typeof data.gems   === 'number' ? data.gems   : s.gems,
      streak:     data.streak ?? s.streak,
      macroGoals: Array.isArray(data.macroGoals) ? data.macroGoals : s.macroGoals,
    });
    if (data.updatedAt) localStorage.setItem('lifeos-updatedAt', String(data.updatedAt));
  }

  async function loadFromCloud() {
    try {
      const res = await fetch(`${KV}?userId=${getUid()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.goals) return;
      // Полная замена — сервер является источником истины при начальной загрузке
      _applyServerData(data);
      showToast('☁️ Данные из облака загружены');
    } catch (e) { console.warn('[KV load]', e); }
  }
  return {
    scheduleSync:()=>{ clearTimeout(kvTimer); kvTimer=setTimeout(doSync,1500); },
    loadFromCloud, getUid,
  };
})();

/* ═══════════════════════════════════════════════════════════
   VIEW ROUTER  (Drawer архитектура: .view[data-view] + .drawer-link)
═══════════════════════════════════════════════════════════ */
const VIEW_TITLES = { tasks:'Задачи', calendar:'Календарь', timer:'Фокус-таймер', sleep:'Сон и Рутины', profile:'Профиль' };

// Глобальная выбранная дата (для фильтра задач по дню из календаря)
let _calSelectedDate = null; // YYYY-MM-DD или null

const ViewRouter = {
  switchTo(view) {
    // При ручном переходе в задачи — сбрасываем фильтр по дню
    if (view === 'tasks') _calSelectedDate = null;
    StateManager.set('currentView', view);
    // Sections
    document.querySelectorAll('.view[data-view]').forEach(el => {
      el.classList.toggle('hidden', el.dataset.view !== view);
    });
    // Drawer links
    document.querySelectorAll('.drawer-link[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    // Update header title
    const hdrTitle = document.getElementById('hdr-title');
    if (hdrTitle) hdrTitle.textContent = VIEW_TITLES[view] || view;
    // Reset tasks-view subtitle heading
    const hdrSub = document.getElementById('tasks-view-subtitle');
    if (hdrSub && view === 'tasks') hdrSub.textContent = '';
    // Show/hide search & sort only on tasks
    const searchBtn = document.getElementById('btn-search-toggle');
    const sortBtn   = document.getElementById('btn-sort');
    if (searchBtn) searchBtn.style.display = view==='tasks' ? '' : 'none';
    if (sortBtn)   sortBtn.style.display   = view==='tasks' ? '' : 'none';
    // Close drawer if open
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('show');
    try {
      if (view==='tasks')    { TaskController.render(); renderTagFilterRow(); }
      if (view==='calendar') CalendarController.render();
      if (view==='profile')  ProfileRenderer.render();
      if (view==='timer')    { TimerController.renderGoalCard(); TimerController.tick(); updateTimerControls(); }
    } catch(e) { console.error('[ViewRouter]', e); }
  },

  // Переключиться на задачи с фильтром по конкретному дню
  _switchToTasksDay(dateKey, dateLabel) {
    _calSelectedDate = dateKey;
    StateManager.set('currentView', 'tasks');
    // Показываем вью задач
    document.querySelectorAll('.view[data-view]').forEach(el => {
      el.classList.toggle('hidden', el.dataset.view !== 'tasks');
    });
    document.querySelectorAll('.drawer-link[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'tasks');
    });
    // Заголовок: «Задачи на 5 августа, вс»
    const hdrTitle = document.getElementById('hdr-title');
    if (hdrTitle) hdrTitle.textContent = `Задачи на ${dateLabel}`;
    const hdrSub = document.getElementById('tasks-view-subtitle');
    // Show search/sort
    const searchBtn = document.getElementById('btn-search-toggle');
    const sortBtn   = document.getElementById('btn-sort');
    if (searchBtn) searchBtn.style.display = '';
    if (sortBtn)   sortBtn.style.display   = '';
    // Close drawer
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('show');
    // Рендерим задачи с фильтром по дню
    try { TaskController.renderForDay(dateKey, dateLabel); renderTagFilterRow(); } catch(e) { console.error('[ViewRouter._switchToTasksDay]', e); }
  },
};

/* ═══════════════════════════════════════════════════════════
   TASK CONTROLLER
═══════════════════════════════════════════════════════════ */
const TaskController = {
  _selectedTags:[], _selectedReminders:[], _selectedColor:COLOR_PALETTE[0], _participants:[], _subtasks:[],

  init() {
    StateManager.subscribe(() => {
      if (StateManager.get('currentView')==='tasks') this.render();
    });
  },

  render() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    const st = StateManager.get();
    const { goals, taskFilter, taskTagFilter, searchQuery, sortMode } = st;

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
    if (searchQuery) { const q=searchQuery.toLowerCase(); list=list.filter(g=>g.title.toLowerCase().includes(q)||g.notes?.toLowerCase().includes(q)); }

    list.sort((a,b) => {
      if (sortMode==='priority') { const p={high:0,mid:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1); }
      if (sortMode==='cat') return (a.cat||'').localeCompare(b.cat||'');
      const aT=a.scheduledAt||Infinity, bT=b.scheduledAt||Infinity;
      if(aT!==bT) return aT-bT;
      const p={high:0,mid:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1);
    });

    // Subtitle
    const sub = document.getElementById('tasks-view-subtitle');
    if (sub) {
      const todayDone = st.history.filter(h=>dateKey(h.completedAt)===tKey).length;
      const pendingToday = goals.filter(g=>!g.done&&g.scheduledAt&&dateKey(g.scheduledAt)===tKey).length;
      sub.textContent = `${todayDone} выполнено · ${pendingToday} на сегодня`;
    }
    // Sunday banner
    document.getElementById('sunday-banner')?.classList.toggle('hidden', new Date().getDay()!==0);

    if (!list.length) {
      listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">✨</div><div class="empty-title">${taskFilter==='done'?'Нет выполненных задач':'Задач нет'}</div><div class="empty-sub">${taskFilter==='done'?'':'Нажми + чтобы добавить'}</div></div>`;
      return;
    }
    listEl.innerHTML='';
    list.forEach(g=>listEl.appendChild(this._buildCard(g)));
  },

  // Рендер задач на конкретный день (из клика по календарю)
  renderForDay(dayKey, dateLabel) {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    const goals = StateManager.get('goals') || [];

    // Фильтруем задачи на нужный день
    let list = goals.filter(g => !g.done && g.scheduledAt && dateKey(g.scheduledAt) === dayKey);

    list.sort((a,b) => {
      const aT=a.scheduledAt||Infinity, bT=b.scheduledAt||Infinity;
      if(aT!==bT) return aT-bT;
      const p={high:0,mid:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1);
    });

    // Subtitle: количество задач на день
    const sub = document.getElementById('tasks-view-subtitle');
    if (sub) {
      const done = goals.filter(g => g.done && g.scheduledAt && dateKey(g.scheduledAt) === dayKey).length;
      sub.textContent = `${list.length} задач · ${done} выполнено`;
    }
    // Убираем воскресный баннер
    document.getElementById('sunday-banner')?.classList.add('hidden');

    if (!list.length) {
      listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Задач на этот день нет</div><div class="empty-sub">Нажми + чтобы добавить</div></div>`;
      return;
    }
    listEl.innerHTML='';
    list.forEach(g=>listEl.appendChild(this._buildCard(g)));
  },

  _buildCard(g) {
    const card = document.createElement('div');
    const color=catColor(g), cat=CATS[g.cat]||CATS.business;
    card.className=`task-card${g.done?' done':''}`;
    card.dataset.id=g.id;
    const prio={high:'🔴',mid:'🟡',low:'⚪'}[g.priority]||'🟡';
    const hasTime=!!g.scheduledAt, isOverdue=hasTime&&g.scheduledAt<Date.now()&&!g.done;
    const subDone=(g.subtasks||[]).filter(s=>s.done).length, subTotal=(g.subtasks||[]).length;
    const tagHtml=(g.tags||[]).map(id=>{ const t=StateManager.get('tags').find(x=>x.id===id); return t?`<span class="task-tag" style="background:${t.color}22;color:${t.color}">${esc(t.name)}</span>`:''; }).join('');
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    const pct=Math.min(100,(elapsed/((g.duration_min||25)*60)*100)).toFixed(1);

    card.innerHTML=`
      <div class="task-accent" style="background:${color}"></div>
      <div class="task-body">
        <div class="task-top-row">
          <div class="task-check-wrap"><button class="task-check${g.done?' checked':''}" data-action="check">${g.done?'✓':''}</button></div>
          <div class="task-content">
            <div class="task-title-row"><span class="task-title">${esc(g.title)}</span><span class="task-prio">${prio}</span></div>
            <div class="task-meta">
              <span class="task-cat-badge" style="background:${color}22;color:${color}">${cat.emoji} ${cat.label}</span>
              ${hasTime?`<span class="task-time${isOverdue?' overdue':''}">${isOverdue?'⚠ ':''}${fmtDateTime(g.scheduledAt)}</span>`:''}
              ${g.location?`<span class="task-loc">📍 ${esc(g.location)}</span>`:''}
            </div>
            ${tagHtml?`<div class="task-tags">${tagHtml}</div>`:''}
            ${subTotal>0?`<div class="task-subtask-info">${subDone}/${subTotal} подзадач</div>`:''}
          </div>
          <div class="task-actions">
            <button class="task-action-btn" data-action="timer" aria-label="Таймер">⏱</button>
            <button class="task-action-btn" data-action="detail" aria-label="Детали">›</button>
          </div>
        </div>
        ${(!g.done&&elapsed>0)?`<div class="task-progress"><div class="task-progress-fill" style="width:${pct}%;background:${color}"></div></div>`:''}
      </div>`;

    card.querySelector('[data-action="check"]')?.addEventListener('click',e=>{ e.stopPropagation(); this.complete(g.id); });
    card.querySelector('[data-action="timer"]')?.addEventListener('click',e=>{ e.stopPropagation(); TimerController.setGoal(g.id); ViewRouter.switchTo('timer'); });
    card.querySelector('[data-action="detail"]')?.addEventListener('click',e=>{ e.stopPropagation(); this.openDetail(g.id); });
    card.addEventListener('click',()=>this.openDetail(g.id));
    return card;
  },

  complete(id) {
    const st=StateManager.get();
    const g=st.goals.find(x=>x.id===id);
    if(!g||g.done) return;
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    g.elapsed=elapsed; g.startTime=null; g.paused=true; g.done=true;
    const history=[{ id:'h_'+Date.now().toString(36)+rnd(), goalId:g.id, title:g.title, cat:g.cat, color:catColor(g), completedAt:Date.now(), elapsed_ms:elapsed*1000, gems:1, tags:[...(g.tags||[])] }, ...st.history];
    const gems=st.gems+1;
    let streak={...st.streak}; const today=dateKey();
    if(streak.lastDate===today) { streak.doneToday=true; }
    else { const yest=dateKey(Date.now()-86400000); streak.days=(streak.lastDate===yest)?streak.days+1:1; streak.lastDate=today; streak.doneToday=true; }
    StateManager.patch({ goals:st.goals, history, gems, streak });
    SyncManager.scheduleSync();
    showPopup('gem','💎',`+1 кристалл! (${gems} всего)`,`«${g.title.substring(0,28)}»`);
    const msg=streak.days===1?'Серия началась!':`${streak.days} дней подряд — огонь!`;
    showPopup('fire','🔥',msg,'Огонёк сохранён');
    if(gems%10===0) showPopup('milestone','🏆',`${gems} кристаллов`,['Просто машина!','Легенда!','Неудержимый!'][Math.floor(gems/10-1)%3]||'Огонь!');
    const flash=document.getElementById('done-flash'); if(flash){flash.classList.add('show'); setTimeout(()=>flash.classList.remove('show'),700);}
    try { TimerController.stopAlarm(id); } catch(_){}
    if(StateManager.get('currentView')==='profile') ProfileRenderer.render();
  },

  openModal(id=null) {
    StateManager.set('editingTaskId',id);
    const g=id?StateManager.get('goals').find(x=>x.id===id):null;
    this._selectedColor=g?.color||COLOR_PALETTE[0];
    this._selectedTags=g?[...(g.tags||[])]:[];
    this._selectedReminders=g?[...(g.reminders||[])]:[];
    this._participants=g?[...(g.participants||[])]:[];

    this._subtasks=g?JSON.parse(JSON.stringify(g.subtasks||[])):[];

    document.getElementById('modal-task-title') && (document.getElementById('modal-task-title').textContent=g?'Редактировать':'Новая задача');
    const titleInp=document.getElementById('task-title-input'); if(titleInp) titleInp.value=g?.title||'';
    const notesInp=document.getElementById('task-notes-input'); if(notesInp) notesInp.value=g?.notes||'';
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.priority===(g?.priority||'mid')));
    const dInp = document.getElementById('task-date-input');
    const startInp = document.getElementById('task-start-time-input');
    const endInp = document.getElementById('task-end-time-input');
    if (g?.scheduledAt) {
      const d = new Date(g.scheduledAt);
      if (dInp) dInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if (startInp) startInp.value = `${pad(d.getHours())}:00`;
      if (endInp) {
        const endTs = g.scheduledAt + (g.duration_min || 0) * 60000;
        const de = new Date(endTs);
        endInp.value = g.duration_min ? `${pad(de.getHours())}:${pad(de.getMinutes())}` : '';
      }
    } else {
      // Если открыто из календаря для конкретного дня — предзаполняем эту дату
      // иначе — сегодня по часовому поясу Кишинёва
      const defaultDate = _calSelectedDate ||
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau' }).format(new Date());
      if (dInp) dInp.value = defaultDate;
      if (startInp) startInp.value = `${pad(new Date().getHours())}:00`;
      if (endInp) endInp.value = '';
    }
    const catSel=document.getElementById('task-category-select'); if(catSel) catSel.value=g?.cat||'business';
    const loc=document.getElementById('task-location-input'); if(loc) loc.value=g?.location||'';
    const tr=document.getElementById('task-travel-input'); if(tr) tr.value=g?.travelTime||0;
    const co=document.getElementById('task-cost-input'); if(co) co.value=g?.cost||0;
    this._renderColorPal(); this._renderTagPicker(); this._renderReminders(); this._renderSubtasks(); this._renderParticipants();
    document.getElementById('btn-delete-task')?.classList.toggle('hidden',!g);
    const saveBtn=document.getElementById('btn-save-task'); if(saveBtn) saveBtn.textContent=g?'Сохранить':'Создать';
    document.getElementById('nlp-hint')?.classList.add('hidden');
    openModal('modal-task');
    setTimeout(()=>titleInp?.focus(),120);
  },

  save() {
    const title=document.getElementById('task-title-input')?.value.trim();
    if(!title){showToast('Введи название задачи'); return;}
    const prioBtn=document.querySelector('#priority-ctrl .seg-btn.active');
    const cat=document.getElementById('task-category-select')?.value||'business';
    const dateVal=document.getElementById('task-date-input')?.value;
    const startVal=document.getElementById('task-start-time-input')?.value;
    const endVal=document.getElementById('task-end-time-input')?.value;
    let scheduledAt=null;
    if(dateVal && startVal) {
      // Разбираем дату и время по частям чтобы избежать неоднозначности:
      // new Date("YYYY-MM-DDThh:mm") в iOS Safari < 15 трактует строку как UTC → сдвиг.
      // Date(год, месяц-1, день, ч, м) всегда создаёт LOCAL-время — без сюрпризов.
      const [dy, dm, dd] = dateVal.split('-').map(Number);
      const [th, tm]     = startVal.split(':').map(Number);
      scheduledAt = new Date(dy, dm - 1, dd, th, tm, 0, 0).getTime();
    }
    let durMin=0;
    if(startVal && endVal){
      const [sh, sm] = startVal.split(':').map(Number);
      const [eh, em] = endVal.split(':').map(Number);
      durMin = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }
    const goals=StateManager.get('goals'); const id=StateManager.get('editingTaskId');
    const data={
      title, notes:document.getElementById('task-notes-input')?.value.trim()||'',
      priority:prioBtn?.dataset.priority||'mid', cat, scheduledAt, duration_min:durMin,
      location:document.getElementById('task-location-input')?.value.trim()||'',
      travelTime:parseInt(document.getElementById('task-travel-input')?.value||'0'),
      cost:parseFloat(document.getElementById('task-cost-input')?.value||'0'),
      tags:[...this._selectedTags], reminders:[...this._selectedReminders], participants:[...this._participants],
      color:this._selectedColor, subtasks:this._subtasks.filter(st=>st.text.trim()).map(st=>({...st,id:st.id||('st'+Date.now()+rnd())})),
    };
    if(id) { const g=goals.find(x=>x.id===id); if(g) Object.assign(g,data); }
    else { goals.unshift({id:'g_'+Date.now().toString(36)+rnd(), done:false, elapsed:0, startTime:null, paused:false, createdAt:Date.now(), ...data}); }
    StateManager.patch({goals});
    SyncManager.scheduleSync();
    closeModal('modal-task');
    showToast(id?'✅ Задача обновлена':'✅ Задача создана');
  },

  delete() {
    const id=StateManager.get('editingTaskId'); if(!id) return;
    StateManager.patch({goals:StateManager.get('goals').filter(g=>g.id!==id)});
    SyncManager.scheduleSync(); closeModal('modal-task'); showToast('🗑 Задача удалена');
  },

  openDetail(id) {
    StateManager.set('detailTaskId',id);
    const g=StateManager.get('goals').find(x=>x.id===id); if(!g) return;
    const titleEl=document.getElementById('td-title'); if(titleEl) titleEl.textContent=g.title;
    const body=document.getElementById('task-detail-body'); if(!body) return;
    const cat=CATS[g.cat]||CATS.business, color=catColor(g);
    const tagHtml=(g.tags||[]).map(id=>{ const t=StateManager.get('tags').find(x=>x.id===id); return t?`<span class="task-tag" style="background:${t.color}22;color:${t.color}">${esc(t.name)}</span>`:''; }).join('');
    const subHtml=(g.subtasks||[]).map(st=>`<div class="detail-subtask${st.done?' done':''}"><span class="detail-subtask-check">${st.done?'✓':'○'}</span><span>${esc(st.text)}</span></div>`).join('');
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    const totalSec=(g.duration_min||25)*60, pct=Math.min(100,Math.round(elapsed/totalSec*100));
    body.innerHTML=`
      <div class="detail-cat" style="color:${color}">${cat.emoji} ${cat.label}</div>
      ${g.scheduledAt?`<div class="detail-row"><span>📅</span><span>${fmtDateTime(g.scheduledAt)}</span></div>`:''}
      ${g.duration_min?`<div class="detail-row"><span>⏱</span><span>${g.duration_min} мин</span></div>`:''}
      ${g.location?`<div class="detail-row"><span>📍</span><span>${esc(g.location)}</span></div>`:''}
      ${g.travelTime?`<div class="detail-row"><span>🚗</span><span>${g.travelTime} мин дороги</span></div>`:''}
      ${g.cost?`<div class="detail-row"><span>💰</span><span>${g.cost} ₽</span></div>`:''}
      ${g.notes?`<div class="detail-notes">${esc(g.notes)}</div>`:''}
      ${tagHtml?`<div class="task-tags" style="margin-top:12px">${tagHtml}</div>`:''}
      ${subHtml?`<div class="detail-subtasks">${subHtml}</div>`:''}
      <div class="detail-progress-wrap"><div class="detail-progress-bar"><div class="detail-progress-fill" style="width:${pct}%;background:${color}"></div></div><span class="detail-progress-pct">${pct}%</span></div>
      <div class="detail-elapsed">Прошло: ${fmtD(elapsed)}</div>`;
    openModal('modal-task-detail');
  },

  _renderColorPal() {
    const pal=document.getElementById('task-color-pal'); if(!pal) return;
    pal.innerHTML=COLOR_PALETTE.map(c=>`<button class="color-dot${c===this._selectedColor?' active':''}" data-color="${c}" style="background:${c}"></button>`).join('');
    pal.querySelectorAll('.color-dot').forEach(dot=>{
      dot.addEventListener('click',()=>{ pal.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('active')); dot.classList.add('active'); this._selectedColor=dot.dataset.color; });
    });
  },
  _renderTagPicker() {
    const picker=document.getElementById('task-tags-picker'); if(!picker) return;
    picker.innerHTML=StateManager.get('tags').map(t=>`<button class="tag-pick-btn${this._selectedTags.includes(t.id)?' active':''}" data-id="${t.id}" style="border-color:${t.color};${this._selectedTags.includes(t.id)?`background:${t.color}33;color:${t.color}`:''}">${t.name}</button>`).join('');
    picker.querySelectorAll('.tag-pick-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ const id=btn.dataset.id; if(this._selectedTags.includes(id)) this._selectedTags=this._selectedTags.filter(x=>x!==id); else this._selectedTags.push(id); this._renderTagPicker(); }); });
  },
  _renderReminders() {
    const wrap=document.getElementById('task-reminders'); if(!wrap) return;
    wrap.innerHTML=REMINDER_OPTIONS.map(m=>`<button class="rem-btn${this._selectedReminders.includes(m)?' active':''}" data-min="${m}">${m<60?m+' мин':m===1440?'1 день':m/60+' ч'}</button>`).join('');
    wrap.querySelectorAll('.rem-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ const m=parseInt(btn.dataset.min); if(this._selectedReminders.includes(m)) this._selectedReminders=this._selectedReminders.filter(x=>x!==m); else this._selectedReminders.push(m); this._renderReminders(); }); });
  },
  _renderSubtasks() {
    const list=document.getElementById('subtask-input-list'); if(!list) return;
    list.innerHTML=this._subtasks.map((st,i)=>`<div class="st-input-row"><input class="form-input" type="text" value="${esc(st.text)}" placeholder="Подзадача…" data-i="${i}"><button class="st-del" data-i="${i}">✕</button></div>`).join('');
    list.querySelectorAll('.st-del').forEach(btn=>{ btn.addEventListener('click',()=>{ this._subtasks.splice(parseInt(btn.dataset.i),1); this._renderSubtasks(); }); });
    list.querySelectorAll('input').forEach(inp=>{ inp.addEventListener('input',e=>{ this._subtasks[parseInt(e.target.dataset.i)].text=e.target.value; }); });
  },
  _renderParticipants() {
    const pList=document.getElementById('participants-list'); if(!pList) return;
    pList.innerHTML=this._participants.map((p,i)=>`<span class="participant-tag">${esc(p)}<button class="part-del" data-i="${i}">✕</button></span>`).join('');
    pList.querySelectorAll('.part-del').forEach(btn=>{ btn.addEventListener('click',()=>{ this._participants.splice(parseInt(btn.dataset.i),1); this._renderParticipants(); }); });
  },
  addSubtaskRow() { this._subtasks.push({id:'st_'+Date.now()+rnd(),text:'',done:false}); this._renderSubtasks(); document.getElementById('subtask-input-list')?.querySelector('.st-input-row:last-child input')?.focus(); },
  addParticipant() { const inp=document.getElementById('participant-input'); const name=inp?.value.trim(); if(name){this._participants.push(name); inp.value=''; this._renderParticipants();} }
};

/* ═══════════════════════════════════════════════════════════
   TAG FILTER ROW  (tasks view)
═══════════════════════════════════════════════════════════ */
function renderTagFilterRow() {
  const row=document.getElementById('tag-filter-row'); if(!row) return;
  const tagFilter=StateManager.get('taskTagFilter');
  row.innerHTML=StateManager.get('tags').map(t=>`<button class="tag-filter-btn${tagFilter===t.id?' active':''}" data-id="${t.id}" style="border-color:${t.color};color:${t.color}">${t.name}</button>`).join('');
  row.querySelectorAll('.tag-filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ StateManager.set('taskTagFilter',StateManager.get('taskTagFilter')===btn.dataset.id?null:btn.dataset.id); renderTagFilterRow(); TaskController.render(); });
  });
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR CONTROLLER
═══════════════════════════════════════════════════════════ */
const CalendarController = {
  _calDate: new Date(), _view: 'month', _nowTimer: null, _selectedDateKey: null, _yearDate: new Date(),
  init() { StateManager.subscribe(()=>{ if(StateManager.get('currentView')==='calendar') this.render(); }); },
  setView(v) {
    this._view=v;
    document.querySelectorAll('.cal-vsw-btn').forEach(b=>b.classList.toggle('active',b.dataset.calView===v));
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
  render() {
    const c=document.getElementById('cal-container'), n=document.getElementById('cal-nav-title');
    if(!c||!n) return;
    if(this._view==='month') this._renderMonth(c,n);
    else if(this._view==='week') this._renderTimeline(c,n,7);
    else if(this._view==='day') this._renderTimeline(c,n,1);
    else if(this._view==='year') this._renderYear(c,n);
  },

  // Navigate to tasks view filtered by a specific date
  _navigateToDay(dateKey) {
    this._selectedDateKey = dateKey;
    StateManager.set('calSelectedDate', dateKey);
    // Switch filter to 'day' mode and re-render tasks
    const hdrTitle = document.getElementById('hdr-title');
    const subtitle = document.getElementById('tasks-view-subtitle');
    const [y,m,d] = dateKey.split('-').map(Number);
    const dateLabel = new Date(y,m-1,d).toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
    if(hdrTitle) hdrTitle.textContent = `Задачи на ${dateLabel}`;
    ViewRouter._switchToTasksDay(dateKey, dateLabel);
  },

  _catDotClass(g) {
    const cat = g.cat || 'business';
    return `cal-dot cat-${cat}`;
  },

  _renderMonth(c,n) {
    if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
    const y=this._calDate.getFullYear(), m=this._calDate.getMonth();
    n.textContent=this._calDate.toLocaleString('ru-RU',{month:'long',year:'numeric'});
    const first=new Date(y,m,1).getDay(), offset=(first===0)?6:first-1, dim=new Date(y,m+1,0).getDate();
    const goals=StateManager.get('goals'), tasksByDay={};
    goals.forEach(g=>{ if(!g.scheduledAt||g.done) return; const d=new Date(g.scheduledAt); if(d.getFullYear()===y&&d.getMonth()===m){ const day=d.getDate(); if(!tasksByDay[day]) tasksByDay[day]=[]; tasksByDay[day].push(g); } });
    // Sort each day: high priority first, then by time
    Object.values(tasksByDay).forEach(arr=>arr.sort((a,b)=>{
      const p={high:0,mid:1,low:2}; const pa=(p[a.priority]||1), pb=(p[b.priority]||1);
      if(pa!==pb) return pa-pb; return (a.scheduledAt||0)-(b.scheduledAt||0);
    }));
    c.innerHTML=''; const grid=document.createElement('div'); grid.className='cal-month-grid';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d=>{ const el=document.createElement('div'); el.className='cal-weekday'; el.textContent=d; grid.appendChild(el); });
    for(let i=0;i<offset;i++){const el=document.createElement('div'); el.className='cal-day empty'; grid.appendChild(el);}
    const today=new Date();
    for(let d=1;d<=dim;d++){
      const dk=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday=d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
      const isSelected=dk===this._selectedDateKey;
      const cell=document.createElement('div');
      cell.className=`cal-day${isToday?' today':''}${isSelected?' selected':''}`;
      // Day number
      const numEl=document.createElement('div'); numEl.className='cal-day-num'; numEl.textContent=d; cell.appendChild(numEl);
      // Task chips (max 3)
      const dayTasks=tasksByDay[d]||[];
      const MAX_CHIPS=3;
      dayTasks.slice(0,MAX_CHIPS).forEach(g=>{
        const color=catColor(g);
        const chip=document.createElement('div');
        chip.className='cal-month-task-chip';
        chip.style.cssText=`background:${color}22;border-left:2px solid ${color};color:var(--lbl1);`;
        chip.innerHTML=`<span class="cal-chip-dot" style="background:${color}"></span><span class="cal-chip-title">${esc(g.title)}</span>`;
        cell.appendChild(chip);
      });
      if(dayTasks.length>MAX_CHIPS){
        const more=document.createElement('div'); more.className='cal-month-more';
        more.textContent=`+ ещё ${dayTasks.length-MAX_CHIPS}`; cell.appendChild(more);
      }
      cell.addEventListener('click',()=>{ this._navigateToDay(dk); });
      grid.appendChild(cell);
    }
    c.appendChild(grid);
  },

  _renderYear(c,n) {
    if(this._nowTimer){clearInterval(this._nowTimer); this._nowTimer=null;}
    const y=this._yearDate.getFullYear();
    // Update nav title with year
    n.textContent=String(y);
    const goals=StateManager.get('goals');
    const tasksByDate={};
    goals.forEach(g=>{ if(!g.scheduledAt||g.done) return; const dk=dateKey(g.scheduledAt); if(!tasksByDate[dk]) tasksByDate[dk]=[]; tasksByDate[dk].push(g); });
    c.innerHTML='';
    const wrapper=document.createElement('div'); wrapper.className='cal-year-wrapper';
    const today=new Date();
    const MONTH_NAMES_RU=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
    const WDAY_SHORT=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    for(let mo=0;mo<12;mo++){
      const card=document.createElement('div'); card.className='cal-year-month-card';
      // Month name (clickable -> switches to month view)
      const mLabel=document.createElement('div'); mLabel.className='cal-year-month-name';
      mLabel.textContent=MONTH_NAMES_RU[mo].charAt(0).toUpperCase()+MONTH_NAMES_RU[mo].slice(1);
      mLabel.addEventListener('click',(e)=>{ e.stopPropagation(); this._calDate=new Date(y,mo,1); this.setView('month'); });
      card.appendChild(mLabel);
      // Weekday header row
      const wdayRow=document.createElement('div'); wdayRow.className='cal-year-wday-row';
      WDAY_SHORT.forEach((label,wi)=>{
        const wh=document.createElement('div');
        wh.className='cal-year-wday-hdr'+(wi>=5?' weekend':'');
        wh.textContent=label; wdayRow.appendChild(wh);
      }); card.appendChild(wdayRow);
      // Day grid
      const miniGrid=document.createElement('div'); miniGrid.className='cal-year-mini-grid';
      const firstDay=new Date(y,mo,1).getDay(), off=(firstDay===0)?6:firstDay-1;
      const dim=new Date(y,mo+1,0).getDate();
      // Empty cells before first day
      for(let i=0;i<off;i++){ const e=document.createElement('div'); e.className='cal-year-mini-day'; miniGrid.appendChild(e); }
      for(let d=1;d<=dim;d++){
        const dk=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isTod=d===today.getDate()&&mo===today.getMonth()&&y===today.getFullYear();
        const hasTasks=!!(tasksByDate[dk]&&tasksByDate[dk].length>0);
        // Determine column (0=Mon..6=Sun), weekends are col 5 and 6 (Sat, Sun)
        const colIdx=(off+d-1)%7; // 0-indexed from Пн
        const isWeekend=(colIdx===5||colIdx===6);
        const dc=document.createElement('div');
        dc.className='cal-year-mini-day'+(isTod?' today':'')+(isWeekend&&!isTod?' weekend':'');
        const numSpan=document.createElement('span'); numSpan.className='cal-year-day-num'; numSpan.textContent=d;
        dc.appendChild(numSpan);
        if(hasTasks&&!isTod){
          // Colored dot from first task's category
          const dotColor=catColor(tasksByDate[dk][0]);
          const dot=document.createElement('span'); dot.className='cal-year-task-dot';
          dot.style.background=dotColor; dc.appendChild(dot);
        }
        // Click on day -> go to tasks view for that day
        dc.addEventListener('click',(e)=>{
          e.stopPropagation();
          const [cy,cm,cd]=dk.split('-').map(Number);
          const label=new Date(cy,cm-1,cd).toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
          ViewRouter._switchToTasksDay(dk,label);
        });
        miniGrid.appendChild(dc);
      }
      card.appendChild(miniGrid);
      wrapper.appendChild(card);
    }
    c.appendChild(wrapper);
  },
  _renderTimeline(c,n,days) {
    const HOUR_H=56, TOTAL_H=24*HOUR_H, TIME_W=44;
    let startDate=new Date(this._calDate); startDate.setHours(0,0,0,0);
    if(days===7) startDate.setDate(startDate.getDate()-((startDate.getDay()+6)%7));
    if(days===7){
      const endD=new Date(startDate.getTime()+6*86400000);
      n.textContent=startDate.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' — '+endD.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
    } else {
      n.textContent=this._calDate.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
    }
    const dayTasks=Array.from({length:days},(_,i)=>{
      const dk=dateKey(startDate.getTime()+i*86400000);
      return StateManager.get('goals').filter(g=>!g.done&&g.scheduledAt&&dateKey(g.scheduledAt)===dk);
    });
    c.innerHTML='';
    const wrap=document.createElement('div'); wrap.className='tl-wrap'; c.appendChild(wrap);
    // header
    const hdr=document.createElement('div'); hdr.className='tl-header'; hdr.style.paddingLeft=TIME_W+'px';
    const tKey=dateKey();
    for(let i=0;i<days;i++){
      const d=new Date(startDate.getTime()+i*86400000);
      const dk=dateKey(d.getTime());
      const dh=document.createElement('div'); dh.className='tl-day-hdr';
      dh.innerHTML=`<span class="tl-wday">${d.toLocaleString('ru-RU',{weekday:'short'})}</span><span class="tl-dnum${dk===tKey?' today':''}">${d.getDate()}</span>`;
      dh.addEventListener('click', () => {
        const label = d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
        this._navigateToDay(dk);
      });
      hdr.appendChild(dh);
    }
    wrap.appendChild(hdr);
    // body
    const body=document.createElement('div'); body.className='tl-body'; wrap.appendChild(body);
    // gutter
    const gutter=document.createElement('div'); gutter.className='tl-gutter'; gutter.style.width=TIME_W+'px'; gutter.style.height=TOTAL_H+'px';
    for(let h=0;h<24;h++){
      const lbl=document.createElement('div'); lbl.className='tl-hour-lbl'; lbl.style.top=(h*HOUR_H-7)+'px';
      lbl.textContent=h===0?'':pad(h)+':00'; gutter.appendChild(lbl);
    }
    body.appendChild(gutter);
    // columns
    const cols=document.createElement('div'); cols.className='tl-cols'; body.appendChild(cols);
    for(let i=0;i<days;i++){
      const col=document.createElement('div'); col.className='tl-col'; col.style.height=TOTAL_H+'px';
      for(let h=0;h<24;h++){const ln=document.createElement('div'); ln.className='tl-hline'; ln.style.top=(h*HOUR_H)+'px'; col.appendChild(ln);}
      dayTasks[i].forEach(g=>{
        const st=new Date(g.scheduledAt);
        const topPx=((st.getHours()*60+st.getMinutes())/60)*HOUR_H;
        const dm=g.duration_min||30;
        const hPx=Math.max(20,(dm/60)*HOUR_H-2);
        const color=catColor(g);
        const isShort=dm<=30;
        const block=document.createElement('div');
        block.className='tl-task'+(isShort?' short-event':'');
        block.style.cssText=`top:${topPx}px;height:${hPx}px;border-left-color:${color};background:${color}28;`;
        const endTs=g.scheduledAt+dm*60000;
        block.innerHTML=`<span class="tl-task-title">${esc(g.title)}</span><span class="tl-task-time">${pad(st.getHours())}:${pad(st.getMinutes())} – ${pad(new Date(endTs).getHours())}:${pad(new Date(endTs).getMinutes())}</span>`;
        block.addEventListener('click',()=>TaskController.openDetail(g.id));
        col.appendChild(block);
      });
      cols.appendChild(col);
    }
    // now line
    this._placeNowLine(cols, HOUR_H, days, startDate);
    if(this._nowTimer) clearInterval(this._nowTimer);
    this._nowTimer=setInterval(()=>this._placeNowLine(cols, HOUR_H, days, startDate), 60000);
    // scroll to current hour
    setTimeout(()=>{ body.scrollTop=Math.max(0,(new Date().getHours()-1)*HOUR_H); },60);
  },
  _placeNowLine(colsEl, HOUR_H, days, startDate) {
    colsEl.querySelectorAll('.tl-now-line').forEach(e=>e.remove());
    const now=new Date(), dk=dateKey(now.getTime());
    let idx=-1;
    for(let i=0;i<days;i++){if(dateKey(startDate.getTime()+i*86400000)===dk){idx=i;break;}}
    if(idx<0) return;
    const topPx=((now.getHours()*60+now.getMinutes())/60)*HOUR_H;
    const colW=colsEl.offsetWidth/days;
    const line=document.createElement('div'); line.className='tl-now-line';
    line.style.cssText=`top:${topPx}px;left:${idx*colW}px;width:${colW}px;`;
    line.innerHTML='<div class="tl-now-dot"></div>';
    colsEl.appendChild(line);
  },
};


/* ═══════════════════════════════════════════════════════════
   ROUTINE MANAGER  (Sleep / Soft Alarms / Morning Chain)
═══════════════════════════════════════════════════════════ */
const RoutineManager = {
  _timerIds:[],
  init() { this._scheduleMidnightCheck(); this._scheduleSoftAlarms(); },
  render() {
    const s=StateManager.get('sleepSettings');
    const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val; };
    const setChk=(id,val)=>{ const el=document.getElementById(id); if(el) el.checked=val; };
    set('sleep-bedtime',s.bedtime||'23:00'); set('sleep-waketime',s.waketime||'07:00');
    set('routine-evening-prep',s.eveningPrepMins||30); set('routine-evening-gratitude',s.eveningGratitudeMins||15);
    set('routine-morning-water',s.morningWaterDelay||5); set('routine-morning-brush',s.morningBrushDelay||10);
    setChk('soft-alarm-enabled',!!s.softAlarmEnabled);
  },
  saveSettings() {
    const g=(id,def)=>{ const el=document.getElementById(id); return el?el.value:def; };
    const settings={ bedtime:g('sleep-bedtime','23:00'), waketime:g('sleep-waketime','07:00'), eveningPrepMins:parseInt(g('routine-evening-prep','30')), eveningGratitudeMins:parseInt(g('routine-evening-gratitude','15')), morningWaterDelay:parseInt(g('routine-morning-water','5')), morningBrushDelay:parseInt(g('routine-morning-brush','10')), softAlarmEnabled:!!document.getElementById('soft-alarm-enabled')?.checked };
    StateManager.patch({sleepSettings:settings}); SyncManager.scheduleSync(); this._scheduleSoftAlarms(); showToast('💤 Настройки сна сохранены');
  },
  _scheduleSoftAlarms() {
    this._timerIds.forEach(t=>clearTimeout(t)); this._timerIds=[];
    const s=StateManager.get('sleepSettings'); if(!s.softAlarmEnabled) return;
    const now=new Date(), [wh,wm]=(s.waketime||'07:00').split(':').map(Number);
    let wake=new Date(now.getFullYear(),now.getMonth(),now.getDate(),wh,wm,0);
    if(wake<=now) wake.setDate(wake.getDate()+1);
    const softDelta=wake.getTime()-3600000-Date.now();
    if(softDelta>0&&softDelta<86400000) this._timerIds.push(setTimeout(()=>this._triggerSoftAlarm(),softDelta));
    const [bh,bm]=(s.bedtime||'23:00').split(':').map(Number);
    let bed=new Date(now.getFullYear(),now.getMonth(),now.getDate(),bh,bm,0);
    if(bed<=now) bed.setDate(bed.getDate()+1);
    const prepDelta=bed.getTime()-(s.eveningPrepMins||30)*60000-Date.now();
    const gratDelta=bed.getTime()-(s.eveningGratitudeMins||15)*60000-Date.now();
    if(prepDelta>0&&prepDelta<86400000) this._timerIds.push(setTimeout(()=>{ showPopup('info','🌙','Готовься ко сну','Выключай свет'); this._sendTg('🌙 Через 30 мин ко сну. Выключай свет.'); },prepDelta));
    if(gratDelta>0&&gratDelta<86400000) this._timerIds.push(setTimeout(()=>{ showPopup('info','📓','Гордости за день','Запиши 3 вещи'); this._sendTg('📓 Время записать гордости за день!'); },gratDelta));
  },
  _triggerSoftAlarm() {
    showPopup('info','⏰','Мягкий подъём','Через час вставать'); this._sendTg('⏰ Мягкий будильник: через час подъём.');
    const s=StateManager.get('sleepSettings'), [wh,wm]=(s.waketime||'07:00').split(':').map(Number);
    let wake=new Date(); wake.setHours(wh,wm,0,0); if(wake<=Date.now()) wake.setDate(wake.getDate()+1);
    const rem=wake.getTime()-Date.now(); if(rem>0) this._timerIds.push(setTimeout(()=>{ showPopup('info','☀️','Время вставать!','Доброе утро!'); this._sendTg('☀️ Доброе утро! Время вставать.'); },rem));
  },
  triggerMorningRoutine() {
    const s=StateManager.get('sleepSettings'); showToast('☀️ Утренняя цепочка запущена'); this._sendTg('☀️ Цепочка запущена.');
    setTimeout(()=>{ showPopup('info','💧','Вода','Выпей стакан воды'); this._sendTg('💧 Выпей стакан воды.'); },(s.morningWaterDelay||5)*60000);
    setTimeout(()=>{ showPopup('info','🪥','Зубы','Почисти зубы'); this._sendTg('🪥 Почисти зубы.'); },(s.morningBrushDelay||10)*60000);
  },
  _scheduleMidnightCheck() {
    setInterval(()=>{
      const now=new Date();
      if(now.getHours()===0&&now.getMinutes()===0){
        const st=StateManager.get('streak'), today=dateKey(), yest=dateKey(Date.now()-86400000);
        if(st.lastDate!==today&&st.lastDate!==yest&&now.getDay()!==0) StateManager.patch({streak:{...st,days:0,doneToday:false}});
      }
    },60000);
  },
  _sendTg(text) {
    const token=StateManager.get('tgToken'), chatId=StateManager.get('tgChatId');
    if(!token||!chatId) return;
    fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text})}).catch(()=>{});
  },
};

/* ═══════════════════════════════════════════════════════════
   TIMER CONTROLLER
═══════════════════════════════════════════════════════════ */
const TimerController = {
  _rafId:null, _swStart:null, _swElapsed:0, _swRunning:false,
  _firedAlarms:new Set(), _alarmAudio:{}, _reminderTimers:[],

  init() { StateManager.subscribe(()=>{ /* reactive tick if needed */ }); },

  setGoal(id) {
    StateManager.set('activeTaskId',id);
    this.renderGoalCard(); this.tick(); updateTimerControls();
  },

  setMode(mode) {
    StateManager.set('timerMode',mode);
    document.querySelectorAll('.timer-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    document.getElementById('pomo-status-wrap')?.classList.toggle('hidden',mode!=='pomodoro');
    document.getElementById('pomo-settings')?.classList.toggle('hidden',mode!=='pomodoro');
    this.tick(); updateTimerControls();
  },

  toggle() {
    const mode=StateManager.get('timerMode');
    if(mode==='stopwatch') { if(this._swRunning) this._pauseSW(); else this._startSW(); }
    else { const g=this._goal(); if(!g||g.done) return; (g.startTime&&!g.paused)?this._pauseCd():this._startCd(); }
    updateTimerControls();
  },

  _startCd() {
    const g=this._goal(); if(!g||g.done) return;
    g.startTime=Date.now(); g.paused=false;
    StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
    showToast('▶ Таймер запущен'); this._rafLoop();
  },
  _pauseCd() {
    const g=this._goal(); if(!g) return;
    g.elapsed=(g.elapsed||0)+(Date.now()-g.startTime)/1000; g.startTime=null; g.paused=true;
    StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
    cancelAnimationFrame(this._rafId); this._rafId=null;
  },
  _startSW() { this._swStart=Date.now()-this._swElapsed*1000; this._swRunning=true; showPopup('gem','⏱','Секундомер запущен','Время пошло!'); this._rafLoop(); },
  _pauseSW() { this._swElapsed=(Date.now()-this._swStart)/1000; this._swRunning=false; cancelAnimationFrame(this._rafId); this._rafId=null; },

  reset() {
    cancelAnimationFrame(this._rafId); this._rafId=null;
    const mode=StateManager.get('timerMode');
    if(mode==='stopwatch'){this._swElapsed=0; this._swRunning=false;}
    else if(mode==='pomodoro'){
      StateManager.patch({pomoCycles:0,pomoPhase:'work'});
      const g=this._goal(); if(g){g.elapsed=0; g.startTime=null; g.paused=false; g.subtasks?.forEach(s=>s.done=false); StateManager.patch({goals:StateManager.get('goals')});}
      this._renderPomoDots();
    } else {
      const g=this._goal(); if(g){g.elapsed=0; g.startTime=null; g.paused=false; g.subtasks?.forEach(s=>s.done=false); this._firedAlarms.delete(g.id); this.stopAlarm(g.id); StateManager.patch({goals:StateManager.get('goals')});}
    }
    this.tick(); updateTimerControls(); TaskController.render();
  },

  complete() { const g=this._goal(); if(!g) return; TaskController.complete(g.id); cancelAnimationFrame(this._rafId); this._rafId=null; this.tick(); updateTimerControls(); },

  _goal() { const id=StateManager.get('activeTaskId'); return StateManager.get('goals').find(x=>x.id===id); },

  _rafLoop() {
    cancelAnimationFrame(this._rafId);
    const loop=()=>{
      this.tick();
      let running=false;
      const mode=StateManager.get('timerMode');
      if(mode==='stopwatch') running=this._swRunning;
      else { const g=this._goal(); running=!!(g&&g.startTime&&!g.paused&&!g.done); }
      if(running) this._rafId=requestAnimationFrame(loop);
    };
    this._rafId=requestAnimationFrame(loop);
  },

  tick() {
    const g=this._goal(), circ=2*Math.PI*88;
    const ringEl=document.getElementById('ring-fill'), timeEl=document.getElementById('ring-time');
    const pctEl=document.getElementById('ring-pct'), catEl=document.getElementById('ring-cat-badge');
    const focusEl=document.getElementById('focus-time-display');
    const mode=StateManager.get('timerMode');

    if(mode==='stopwatch'){
      const el=this._swRunning?(Date.now()-this._swStart)/1000:this._swElapsed;
      const hh=Math.floor(el/3600), mm=Math.floor((el%3600)/60), ss=Math.floor(el%60);
      const str=hh>0?`${hh}:${pad(mm)}:${pad(ss)}`:`${pad(mm)}:${pad(ss)}`;
      if(timeEl) timeEl.textContent=str; if(pctEl) pctEl.textContent='⏱';
      if(ringEl){ringEl.style.strokeDashoffset=(circ*0.25).toFixed(3); ringEl.setAttribute('stroke','#BF5AF2');}
      if(focusEl) focusEl.textContent=str; return;
    }

    if(mode==='pomodoro'){
      const pomo=StateManager.get('pomoConfig'), phase=StateManager.get('pomoPhase')||'work';
      const totalSec=(phase==='work'?pomo.work:phase==='short'?pomo.short:pomo.long)*60;
      const elapsed=g?((g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0)):0;
      const remaining=Math.max(0,totalSec-elapsed), pct=Math.min(1,elapsed/totalSec);
      const color=phase==='work'?'#0A84FF':phase==='short'?'#30D158':'#BF5AF2';
      if(ringEl){ringEl.style.strokeDashoffset=(circ*(1-pct)).toFixed(3); ringEl.setAttribute('stroke',color);}
      const mm=Math.floor(remaining/60), ss=Math.floor(remaining%60), str=`${pad(mm)}:${pad(ss)}`;
      if(timeEl) timeEl.textContent=str; if(pctEl) pctEl.textContent=`${Math.round(pct*100)}%`;
      if(focusEl) focusEl.textContent=str;
      const phaseEl=document.getElementById('pomo-phase-label'); if(phaseEl) phaseEl.textContent=phase==='work'?'📚 Фокус':phase==='short'?'☕ Короткий':'🌙 Длинный';
      if(remaining<=0&&g?.startTime) this._advancePomo(g);
      return;
    }

    // Countdown
    if(!g){
      if(timeEl) timeEl.textContent='25:00'; if(pctEl) pctEl.textContent='0%';
      if(ringEl){ringEl.style.strokeDashoffset=circ.toFixed(3); ringEl.setAttribute('stroke','#0A84FF');}
      return;
    }
    const elapsed=(g.elapsed||0)+(g.startTime?(Date.now()-g.startTime)/1000:0);
    const totalSec=(g.duration_min||25)*60, remaining=Math.max(0,totalSec-elapsed), pct=Math.min(1,elapsed/totalSec);
    const color=g.done?'#30D158':(remaining<60?'#FF453A':catColor(g));
    if(ringEl){ringEl.style.strokeDashoffset=(circ*(1-pct)).toFixed(3); ringEl.setAttribute('stroke',color); ringEl.style.filter=`drop-shadow(0 0 12px ${color}88)`;}
    const mm=Math.floor(remaining/60), ss=Math.floor(remaining%60);
    let str; if(g.done) str='✓ Готово'; else if(remaining>=3600) str=`${Math.floor(remaining/3600)}:${pad(Math.floor((remaining%3600)/60))}:${pad(ss)}`; else str=`${pad(mm)}:${pad(ss)}`;
    if(timeEl) timeEl.textContent=str; if(pctEl) pctEl.textContent=`${Math.round(pct*100)}%`;
    if(catEl&&g){const cat=CATS[g.cat]||CATS.business; catEl.textContent=cat.emoji+' '+cat.label;}
    if(focusEl) focusEl.textContent=str;
    if(remaining<=0&&g.startTime&&!this._firedAlarms.has(g.id)){
      this._firedAlarms.add(g.id); this.triggerAlarm(g,'⏰ Время вышло!');
      g.startTime=null; g.paused=true; StateManager.patch({goals:StateManager.get('goals')}); SyncManager.scheduleSync();
      cancelAnimationFrame(this._rafId); this._rafId=null; updateTimerControls();
    }
  },

  _advancePomo(g) {
    g.elapsed=0; g.startTime=Date.now();
    let phase=StateManager.get('pomoPhase')||'work', cycles=StateManager.get('pomoCycles')||0;
    if(phase==='work'){cycles++; phase=(cycles%4===0)?'long':'short'; this.triggerAlarm(g,'🍅 Перерыв!');}
    else{phase='work'; this.triggerAlarm(g,'📚 Фокус!');}
    StateManager.patch({pomoPhase:phase,pomoCycles:cycles,goals:StateManager.get('goals')});
    this._renderPomoDots();
  },
  _renderPomoDots() {
    const wrap=document.getElementById('pomo-dots'); if(!wrap) return;
    const cycles=StateManager.get('pomoCycles')||0; wrap.innerHTML='';
    for(let i=0;i<4;i++){const d=document.createElement('div'); d.className='pomo-dot'+(i<cycles%4?' done':''); wrap.appendChild(d);}
  },
  adjustPomo(key,delta) {
    const pomo={...StateManager.get('pomoConfig')};
    if(key==='work') pomo.work=Math.max(1,Math.min(60,pomo.work+delta*5));
    else if(key==='short') pomo.short=Math.max(1,Math.min(30,pomo.short+delta));
    else pomo.long=Math.max(5,Math.min(60,pomo.long+delta*5));
    StateManager.set('pomoConfig',pomo);
    const el=document.getElementById(`pomo-${key}-val`); if(el) el.textContent=pomo[key];
  },
  renderGoalCard() {
    const g=this._goal();
    const nameEl=document.getElementById('timer-goal-name'); if(nameEl) nameEl.textContent=g?g.title:'Не выбрана';
    const badge=document.getElementById('ring-cat-badge'); if(badge&&g){const cat=CATS[g.cat]||CATS.business; badge.textContent=cat.emoji+' '+cat.label;}
  },
  renderSubtaskRings() {
    const wrap=document.getElementById('subtask-rings'); if(!wrap) return; wrap.innerHTML='';
    const g=this._goal(); if(!g||!g.subtasks?.length) return;
    g.subtasks.forEach(st=>{
      const div=document.createElement('div'); div.className='subtask-ring'+(st.done?' done':''); div.textContent=st.text.substring(0,12);
      div.addEventListener('click',()=>{st.done=!st.done; StateManager.patch({goals:StateManager.get('goals')}); this.renderSubtaskRings();});
      wrap.appendChild(div);
    });
  },
  openPicker() {
    const list=document.getElementById('goal-picker-list'); if(!list) return;
    const active=StateManager.get('goals').filter(g=>!g.done);
    if(!active.length){list.innerHTML='<div class="empty-sub">Нет активных задач</div>';}
    else{
      list.innerHTML=active.map(g=>{const cat=CATS[g.cat]||CATS.business; return `<div class="picker-item" data-id="${g.id}" style="border-left:3px solid ${catColor(g)}"><span>${cat.emoji} ${esc(g.title)}</span></div>`}).join('');
      list.querySelectorAll('.picker-item').forEach(el=>{ el.addEventListener('click',()=>{ this.setGoal(el.dataset.id); closeModal('modal-goal-picker'); this.renderSubtaskRings(); }); });
    }
    openModal('modal-goal-picker');
  },
  openFocus() {
    const g=this._goal(), ov=document.getElementById('focus-overlay'); if(!ov) return;
    const tEl=document.getElementById('focus-task-title'), bEl=document.getElementById('focus-badge');
    if(tEl&&g) tEl.textContent=g.title;
    if(bEl&&g){const cat=CATS[g.cat]||CATS.business; bEl.textContent=cat.emoji+' '+cat.label;}
    ov.classList.add('open');
  },
  closeFocus() { document.getElementById('focus-overlay')?.classList.remove('open'); },
  triggerAlarm(goal,msg='Время вышло!') {
    this.playAlarm(goal.id);
    const stack=document.getElementById('alarm-stack'); if(!stack||document.getElementById('alarm-card-'+goal.id)) return;
    const card=document.createElement('div'); card.id='alarm-card-'+goal.id; card.className='alarm-card';
    card.innerHTML=`<div class="alarm-icon">⏰</div><div class="alarm-text"><div class="alarm-title">${esc(msg)}</div><div class="alarm-sub">«${esc(goal.title.substring(0,40))}»</div></div><button class="alarm-close">✕</button>`;
    card.querySelector('.alarm-close')?.addEventListener('click',()=>this.stopAlarm(goal.id));
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
        if(delta>0){const tid=setTimeout(()=>this.triggerAlarm(g,`Через ${mins<60?mins+' мин':(mins/60)+' ч'}!`),delta); this._reminderTimers.push(tid);}
      });
    });
  },
};

function updateTimerControls() {
  const g=TimerController._goal();
  const isRunning=StateManager.get('timerMode')==='stopwatch'?TimerController._swRunning:!!(g&&g.startTime&&!g.paused&&!g.done);
  const playBtn=document.getElementById('btn-timer-play'); if(playBtn) playBtn.textContent=isRunning?'⏸':'▶';
  const focusBtn=document.getElementById('btn-focus-pause'); if(focusBtn) focusBtn.textContent=isRunning?'⏸':'▶';
}

/* ═══════════════════════════════════════════════════════════
   STORE CONTROLLER
═══════════════════════════════════════════════════════════ */
const StoreController = {
  render() {
    const grid=document.getElementById('store-grid'); if(!grid) return;
    const filter=StateManager.get('storeFilter'), gems=StateManager.get('gems'), draft=StateManager.get('storeDraft');
    const filtered=filter==='all'?STORE_ITEMS:STORE_ITEMS.filter(i=>i.cat===filter);
    grid.innerHTML=filtered.map(item=>{ const qty=draft[item.id]||1, cost=item.baseCost*qty, ok=gems>=cost; return `<div class="store-card${ok?'':' cannot-afford'}"><div class="store-icon">${item.icon}</div><div class="store-title">${item.title}</div><div class="store-desc">${item.desc}</div><div class="store-qty-row"><button class="store-qty-btn" data-id="${item.id}" data-delta="-1">−</button><span>${qty} ${item.unit}</span><button class="store-qty-btn" data-id="${item.id}" data-delta="1">+</button></div><button class="store-buy-btn${ok?'':' disabled'}" data-id="${item.id}">${cost} 💎${ok?'':' · Недостаточно'}</button></div>`; }).join('');
    grid.querySelectorAll('.store-qty-btn').forEach(btn=>{ btn.addEventListener('click',e=>{ e.stopPropagation(); const d={...StateManager.get('storeDraft')}; d[btn.dataset.id]=Math.max(1,(d[btn.dataset.id]||1)+parseInt(btn.dataset.delta)); StateManager.set('storeDraft',d); }); });
    grid.querySelectorAll('.store-buy-btn:not(.disabled)').forEach(btn=>{ btn.addEventListener('click',()=>this.addToCart(btn.dataset.id)); });
  },
  addToCart(itemId) {
    const item=STORE_ITEMS.find(i=>i.id===itemId); if(!item) return;
    const qty=StateManager.get('storeDraft')[itemId]||1, cost=item.baseCost*qty;
    StateManager.set('cart',[...StateManager.get('cart'),{...item,qty,cost}]);
    this.renderCart(); showToast(`🛒 ${item.title} добавлен`);
  },
  renderCart() {
    const cl=document.getElementById('cart-list'), ct=document.getElementById('cart-total'); if(!cl) return;
    const cart=StateManager.get('cart');
    if(!cart.length){cl.innerHTML='<div class="empty-sub">Корзина пуста</div>'; if(ct) ct.textContent='0 💎'; return;}
    cl.innerHTML=cart.map((item,i)=>`<div class="cart-item"><span>${item.icon} ${item.title} × ${item.qty}</span><span>${item.cost} 💎 <button class="cart-remove" data-i="${i}">✕</button></span></div>`).join('');
    const total=cart.reduce((s,i)=>s+i.cost,0); if(ct) ct.textContent=`${total} 💎`;
    cl.querySelectorAll('.cart-remove').forEach(btn=>{ btn.addEventListener('click',()=>{ const c=[...StateManager.get('cart')]; c.splice(parseInt(btn.dataset.i),1); StateManager.set('cart',c); this.renderCart(); }); });
  },
  checkout() {
    const cart=StateManager.get('cart'), total=cart.reduce((s,i)=>s+i.cost,0);
    if(StateManager.get('gems')<total){showToast('❌ Недостаточно кристаллов'); return;}
    StateManager.patch({gems:StateManager.get('gems')-total, purchases:[...StateManager.get('purchases'),...cart.map(i=>({...i,purchasedAt:Date.now()}))], cart:[]});
    SyncManager.scheduleSync(); closeModal('modal-cart'); showToast(`🎉 Покупка совершена! Осталось: ${StateManager.get('gems')} 💎`);
  },
  renderPurchases() {
    const list=document.getElementById('purchases-list'); if(!list) return;
    const p=StateManager.get('purchases');
    if(!p.length){list.innerHTML='<div class="empty-sub">Нет покупок</div>'; return;}
    list.innerHTML=p.slice().reverse().map(p=>`<div class="purchase-item"><span>${p.icon} ${p.title} × ${p.qty}</span><span>${p.cost} 💎 · ${fmtRel(p.purchasedAt)}</span></div>`).join('');
  },
};

/* ═══════════════════════════════════════════════════════════
   MACRO CONTROLLER
═══════════════════════════════════════════════════════════ */
const MacroController = {
  openModal(id=null) {
    const mg=id?StateManager.get('macroGoals').find(x=>x.id===id):null;
    const t=document.getElementById('macro-modal-title'); if(t) t.textContent=mg?'Редактировать цель':'Новая цель';
    const ei=document.getElementById('macro-edit-id'); if(ei) ei.value=mg?.id||'';
    const ti=document.getElementById('macro-title'); if(ti) ti.value=mg?.title||'';
    const di=document.getElementById('macro-deadline'); if(di) di.value=mg?.deadline||'';
    const gi=document.getElementById('macro-gems-reward'); if(gi) gi.value=mg?.gemsReward||50;
    openModal('modal-macro');
  },
  save() {
    const title=document.getElementById('macro-title')?.value.trim(); if(!title){showToast('Введи название цели'); return;}
    const id=document.getElementById('macro-edit-id')?.value;
    const deadline=document.getElementById('macro-deadline')?.value;
    const gemsReward=parseInt(document.getElementById('macro-gems-reward')?.value||'50');
    const macros=[...StateManager.get('macroGoals')];
    if(id){const mg=macros.find(x=>x.id===id); if(mg){mg.title=title; mg.deadline=deadline; mg.gemsReward=gemsReward;}}
    else macros.push({id:'macro_'+Date.now().toString(36)+rnd(),title,deadline,gemsReward,createdAt:Date.now()});
    StateManager.set('macroGoals',macros); SyncManager.scheduleSync(); closeModal('modal-macro'); ProfileRenderer.render();
  },
};

/* ═══════════════════════════════════════════════════════════
   PROFILE RENDERER
═══════════════════════════════════════════════════════════ */
const ProfileRenderer = {
  render() {
    const st=StateManager.get();
    const tKey=dateKey(), todayDone=st.history.filter(h=>dateKey(h.completedAt)===tKey).length;
    const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    set('stat-streak',st.streak.days); set('stat-done-today',todayDone); set('stat-total-done',st.history.length);
    const lv=getLevel(st.gems); set('profile-level',`${lv.emoji} ${lv.label}`); set('profile-gem-count',st.gems);
    this._renderStreakCard(); this._renderMacroList(); StoreController.render(); this._renderHistory();
  },
  _renderStreakCard() {
    const card=document.getElementById('streak-card'); if(!card) return;
    const days7=[];
    for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const dk=dateKey(d.getTime()); const hasDone=StateManager.get('history').some(h=>dateKey(h.completedAt)===dk); days7.push({dk,hasDone,day:d.toLocaleDateString('ru-RU',{weekday:'short'})}); }
    card.innerHTML=`<div class="streak-week">${days7.map(d=>`<div class="streak-day${d.hasDone?' done':''}"><div class="streak-dot"></div><div class="streak-label">${d.day}</div></div>`).join('')}</div><div class="streak-info">🔥 ${StateManager.get('streak').days} дней подряд${new Date().getDay()===0?' · 😴 День отдыха':''}</div>`;
  },
  _renderMacroList() {
    const list=document.getElementById('macro-list'); if(!list) return;
    const macros=StateManager.get('macroGoals'), goals=StateManager.get('goals');
    if(!macros.length){list.innerHTML='<div class="empty-sub">Нет целей</div>'; return;}
    list.innerHTML=macros.map(mg=>{ const linked=goals.filter(g=>g.macroId===mg.id&&g.done).length, total=goals.filter(g=>g.macroId===mg.id).length, pct=total>0?Math.round(linked/total*100):0; return `<div class="macro-item" data-id="${mg.id}"><div class="macro-top"><span class="macro-title">${esc(mg.title)}</span><span class="macro-reward">💎 ${mg.gemsReward||50}</span></div><div class="macro-progress-bar"><div class="macro-progress-fill" style="width:${pct}%"></div></div><div class="macro-sub">${linked}/${total} задач · ${pct}%${mg.deadline?' · до '+new Date(mg.deadline).toLocaleDateString('ru-RU'):''}</div></div>`; }).join('');
    list.querySelectorAll('.macro-item').forEach(el=>el.addEventListener('click',()=>MacroController.openModal(el.dataset.id)));
  },
  _renderHistory() {
    const list=document.getElementById('history-list'); if(!list) return;
    const items=StateManager.get('history').slice(0,50);
    if(!items.length){list.innerHTML='<div class="empty-sub">История пуста</div>'; return;}
    list.innerHTML=items.map(h=>{ const cat=CATS[h.cat]||CATS.business; return `<div class="history-item"><div class="hist-color" style="background:${h.color||cat.color}"></div><div class="hist-info"><div class="hist-title">${esc(h.title)}</div><div class="hist-meta">${cat.emoji} · ${fmtRel(h.completedAt)} · +${h.gems||1} 💎</div></div></div>`; }).join('');
  },
};

/* ═══════════════════════════════════════════════════════════
   SETTINGS HELPERS
═══════════════════════════════════════════════════════════ */
function renderSettingsPanel() {
  // Tags manager
  const mgr=document.getElementById('tags-manager'); if(!mgr) return;
  mgr.innerHTML=StateManager.get('tags').map(t=>`<div class="tag-mgr-item"><span class="tag-dot" style="background:${t.color}"></span><span class="tag-mgr-name">${esc(t.name)}</span><button class="tag-mgr-del" data-id="${t.id}">✕</button></div>`).join('');
  mgr.querySelectorAll('.tag-mgr-del').forEach(btn=>{ btn.addEventListener('click',()=>{ StateManager.set('tags',StateManager.get('tags').filter(t=>t.id!==btn.dataset.id)); renderSettingsPanel(); renderTagFilterRow(); }); });
  // Color pal for new tag
  const pal=document.getElementById('new-tag-color-pal'); if(!pal) return;
  pal.innerHTML=TAG_PALETTE.map(c=>`<button class="color-dot" data-color="${c}" style="background:${c}"></button>`).join('');
  pal.querySelectorAll('.color-dot').forEach(dot=>{ dot.addEventListener('click',()=>{ pal.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('active')); dot.classList.add('active'); }); });
  pal.querySelector('.color-dot')?.classList.add('active');
  // TG
  const tt=document.getElementById('tg-bot-token'); if(tt) tt.value=StateManager.get('tgToken')||'';
  const tc=document.getElementById('tg-chat-id'); if(tc) tc.value=StateManager.get('tgChatId')||'';
  // Theme
  const theme=localStorage.getItem('lifeos-theme')||'dark';
  document.querySelectorAll('.theme-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.theme===theme));
}

/* ═══════════════════════════════════════════════════════════
   VOICE INPUT
═══════════════════════════════════════════════════════════ */
const VoiceInput = {
  _rec:null,
  init() {
    try {
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){document.getElementById('btn-voice-start')?.setAttribute('disabled','true'); return;}
      this._rec=new SR(); this._rec.lang='ru-RU'; this._rec.continuous=false; this._rec.interimResults=true;
      this._rec.onresult=e=>{ const txt=[...e.results].map(r=>r[0].transcript).join(''); const el=document.getElementById('voice-transcript-text'); if(el) el.textContent=txt; if(e.results[e.results.length-1].isFinal){this.stop(); this.apply(txt);} };
      this._rec.onerror=()=>this.stop(); this._rec.onend=()=>this.stop();
    } catch(e){console.warn('Voice not supported',e);}
  },
  start() { if(!this._rec) return; document.getElementById('voice-state-idle')?.classList.add('hidden'); document.getElementById('voice-state-listening')?.classList.remove('hidden'); try{this._rec.start();}catch(e){} },
  stop() { document.getElementById('voice-state-idle')?.classList.remove('hidden'); document.getElementById('voice-state-listening')?.classList.add('hidden'); try{this._rec?.stop();}catch(e){} },
  apply(text) {
    const parsed=NLP.parse(text);
    closeModal('modal-voice'); TaskController.openModal();
    setTimeout(()=>{
      const ti=document.getElementById('task-title-input'); if(ti) ti.value=parsed.title;
      if(parsed.scheduledAt){const d=new Date(parsed.scheduledAt); const di=document.getElementById('task-date-input'); if(di) di.value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
      document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.priority===parsed.priority));
      TaskController._selectedTags=parsed.tags; TaskController._renderTagPicker();
      const hint=document.getElementById('nlp-hint'); if(hint){hint.textContent=`NLP: ${parsed.title}${parsed.scheduledAt?' · '+fmtDateTime(parsed.scheduledAt):''}`;hint.classList.remove('hidden');}
    },100);
  },
};

/* ═══════════════════════════════════════════════════════════
   NLP PARSER
═══════════════════════════════════════════════════════════ */
const NLP = {
  parse(text) {
    const result={title:text,scheduledAt:null,priority:'mid',cat:'business',duration_min:25,tags:[]};
    let s=text;
    if(/\bp1\b/i.test(s)){result.priority='high'; s=s.replace(/\bp1\b/ig,'');}
    else if(/\bp3\b/i.test(s)){result.priority='low'; s=s.replace(/\bp3\b/ig,'');}
    else s=s.replace(/\bp2\b/ig,'');
    const tagMatches=s.match(/@\S+/g)||[];
    const tags=StateManager.get('tags');
    tagMatches.forEach(m=>{ const name=m.slice(1).toLowerCase(); let t=tags.find(t=>t.name.toLowerCase()===name); if(!t){t={id:'tag_'+Date.now().toString(36)+rnd(),name,color:TAG_PALETTE[tags.length%TAG_PALETTE.length]}; tags.push(t); StateManager.set('tags',tags);} result.tags.push(t.id); });
    s=s.replace(/@\S+/g,'').trim();
    const durM=s.match(/на\s+(\d+)\s*(час|ч|мин|м)\b/i);
    if(durM){const num=parseInt(durM[1]); result.duration_min=/час|ч/i.test(durM[2])?num*60:num; s=s.replace(durM[0],'').trim();}
    const now=new Date();
    if(/сегодня/i.test(s)){now.setHours(9,0,0,0); result.scheduledAt=now.getTime(); s=s.replace(/сегодня/i,'').trim();}
    else if(/завтра/i.test(s)){const d=new Date(now); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); result.scheduledAt=d.getTime(); s=s.replace(/завтра/i,'').trim();}
    const timeM=s.match(/в\s+(\d{1,2})[:h]?(\d{2})?\s*(утра|вечера|дня)?/i);
    if(timeM){let h=parseInt(timeM[1]),m=parseInt(timeM[2]||'0'); if(/вечера|дня/i.test(timeM[3])&&h<12) h+=12; const dt=result.scheduledAt?new Date(result.scheduledAt):new Date(); dt.setHours(h,m,0,0); result.scheduledAt=dt.getTime(); s=s.replace(timeM[0],'').trim();}
    result.title=s.replace(/\s+/g,' ').trim()||text;
    return result;
  },
};

/* ═══════════════════════════════════════════════════════════
   DEMO DATA
═══════════════════════════════════════════════════════════ */
function loadDemoData() {
  const now=Date.now(), day=86400000;
  const demoGoals=[
    {id:'demo_1',title:'Прочитать книгу "Атомные привычки"',cat:'study',priority:'high',color:'#BF5AF2',scheduledAt:now-3600000,duration_min:60,tags:[],subtasks:[{id:'st1',text:'Глава 1-5',done:true},{id:'st2',text:'Конспект',done:false}],notes:'Ключевые инсайты о привычках',done:false,elapsed:0,createdAt:now-day*3},
    {id:'demo_2',title:'Тренировка: силовая',cat:'health',priority:'high',color:'#FF9F0A',scheduledAt:now+7200000,duration_min:45,tags:[],subtasks:[],notes:'Жим, приседания, становая',done:false,elapsed:0,createdAt:now-day},
    {id:'demo_3',title:'Запустить MVP лендинга',cat:'business',priority:'mid',color:'#0A84FF',scheduledAt:now+day,duration_min:120,tags:[],subtasks:[{id:'st3',text:'Дизайн',done:true},{id:'st4',text:'Верстка',done:true},{id:'st5',text:'Деплой',done:false}],notes:'',done:false,elapsed:3600,createdAt:now-day*5},
    {id:'demo_4',title:'Медитация 10 минут',cat:'life',priority:'low',color:'#30D158',scheduledAt:now+1800000,duration_min:10,tags:[],subtasks:[],notes:'Дышать, не думать',done:false,elapsed:0,createdAt:now},
    {id:'demo_5',title:'Написать Notion-шаблон для планирования',cat:'creative',priority:'mid',color:'#FF375F',scheduledAt:now+day*2,duration_min:90,tags:[],subtasks:[],notes:'',done:false,elapsed:0,createdAt:now-day*2},
  ];
  const demoHistory=[
    {id:'dh1',goalId:'demo_old_1',title:'Утренняя пробежка 5 км',cat:'health',color:'#FF9F0A',completedAt:now-3600000,elapsed_ms:1800000,gems:1},
    {id:'dh2',goalId:'demo_old_2',title:'Созвон с командой',cat:'business',color:'#0A84FF',completedAt:now-86400000,elapsed_ms:3600000,gems:1},
    {id:'dh3',goalId:'demo_old_3',title:'Изучить Vercel KV API',cat:'study',color:'#BF5AF2',completedAt:now-172800000,elapsed_ms:5400000,gems:1},
    {id:'dh4',goalId:'demo_old_4',title:'Нарисовать wireframe',cat:'creative',color:'#FF375F',completedAt:now-259200000,elapsed_ms:2700000,gems:1},
    {id:'dh5',goalId:'demo_old_5',title:'Ужин с семьёй',cat:'life',color:'#30D158',completedAt:now-345600000,elapsed_ms:7200000,gems:1},
  ];
  const st=StateManager.get();
  const goals=[...demoGoals,...st.goals.filter(g=>!g.id.startsWith('demo_'))];
  const history=[...demoHistory,...st.history.filter(h=>!h.id.startsWith('dh'))];
  const macroGoals=[{id:'macro_demo',title:'🚀 Запустить SaaS-проект',deadline:new Date(now+day*60).toISOString().slice(0,10),gemsReward:100,createdAt:now-day*10}];
  StateManager.patch({goals,history,gems:Math.max(st.gems,27),streak:{days:5,lastDate:dateKey(),doneToday:true},macroGoals});
  SyncManager.scheduleSync();
  closeModal('modal-settings');
  TaskController.render(); renderTagFilterRow(); ProfileRenderer.render();
  showToast('🎉 Демо-данные загружены!');
}

/* ═══════════════════════════════════════════════════════════
   EXPORT / RESET
═══════════════════════════════════════════════════════════ */
function exportData() {
  const data={...StateManager.get(),exportedAt:Date.now()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=`lifeos-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('💾 Данные экспортированы');
}
function resetData() {
  if(!confirm('Удалить ВСЕ данные? Это действие необратимо!')) return;
  ['lifeos-goals','lifeos-history','lifeos-gems','lifeos-streak','lifeos-purchases','lifeos-macros','lifeos-tags','lifeos-pomo','lifeos-sleep','lifeos-uid','lifeos-theme',
   'цель-goals','цель-history','цель-gems','цель-streak2','цель-purchases','цель-macros','цель-tags','цель-pomo'].forEach(k=>localStorage.removeItem(k));
  location.reload();
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL EVENTS — Drawer архитектура
═══════════════════════════════════════════════════════════ */
function initGlobalEvents() {

  // ── DRAWER TOGGLE (Hamburger) ──
  try {
    const drawerEl  = document.getElementById('drawer');
    const overlayEl = document.getElementById('drawer-overlay');
    function openDrawer()  { drawerEl?.classList.add('open');    overlayEl?.classList.add('show'); }
    function closeDrawer() { drawerEl?.classList.remove('open'); overlayEl?.classList.remove('show'); }
    document.getElementById('btn-drawer-toggle')?.addEventListener('click', openDrawer);
    overlayEl?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if(e.key==='Escape') closeDrawer(); });
  } catch(e){console.warn('[drawer]',e);}

  // ── DRAWER NAV LINKS ──
  try {
    document.querySelectorAll('.drawer-link[data-view]').forEach(btn => {
      btn.addEventListener('click', () => ViewRouter.switchTo(btn.dataset.view));
    });
  } catch(e){console.warn('[drawer-nav]',e);}

  // ── CREATE btn (tap = new task, long-press = voice) ──
  try {
    const createBtn = document.getElementById('btn-create');
    let pressTimer = null, triggered = false;
    createBtn?.addEventListener('pointerdown', () => { triggered=false; pressTimer=setTimeout(()=>{ triggered=true; openModal('modal-voice'); }, 600); });
    createBtn?.addEventListener('pointerup',   () => clearTimeout(pressTimer));
    createBtn?.addEventListener('click',       () => { if(!triggered) TaskController.openModal(); });
  } catch(e){console.warn('[create]',e);}

  // ── SEARCH ──
  try {
    document.getElementById('btn-search-toggle')?.addEventListener('click',()=>{
      const wrap=document.getElementById('search-wrap'), isOpen=wrap?.classList.toggle('open');
      if(isOpen) document.getElementById('search-input')?.focus();
      else { StateManager.set('searchQuery',''); const si=document.getElementById('search-input'); if(si) si.value=''; TaskController.render(); }
    });
    document.getElementById('search-input')?.addEventListener('input',e=>{ StateManager.set('searchQuery',e.target.value); TaskController.render(); });
    document.getElementById('search-clear')?.addEventListener('click',()=>{ StateManager.set('searchQuery',''); const si=document.getElementById('search-input'); if(si) si.value=''; TaskController.render(); });
  } catch(e){console.warn('[search]',e);}

  // ── SORT ──
  try {
    document.getElementById('btn-sort')?.addEventListener('click',()=>{
      const modes=['date','priority','cat'], cur=StateManager.get('sortMode')||'date';
      const next=modes[(modes.indexOf(cur)+1)%modes.length]; StateManager.set('sortMode',next);
      const btn=document.getElementById('btn-sort'); if(btn) btn.textContent={date:'⇅ Дата',priority:'⇅ Приоритет',cat:'⇅ Кат.'}[next];
      TaskController.render();
    });
  } catch(e){console.warn('[sort]',e);}

  // ── TASK FILTER ──
  try {
    document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{ StateManager.set('taskFilter',btn.dataset.filter); document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===btn.dataset.filter)); TaskController.render(); });
    });
  } catch(e){console.warn('[filter]',e);}

  // ── SETTINGS ──
  try {
    document.getElementById('btn-settings')?.addEventListener('click',()=>{ renderSettingsPanel(); openModal('modal-settings'); });
    document.querySelectorAll('.theme-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ document.body.dataset.theme=btn.dataset.theme; localStorage.setItem('lifeos-theme',btn.dataset.theme); document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===btn.dataset.theme)); }); });
    document.getElementById('btn-add-tag')?.addEventListener('click',()=>{
      const nameInp=document.getElementById('new-tag-name'); const name=nameInp?.value.trim(); if(!name) return;
      const activeDot=document.querySelector('#new-tag-color-pal .color-dot.active');
      const color=activeDot?.dataset.color||TAG_PALETTE[StateManager.get('tags').length%TAG_PALETTE.length];
      StateManager.set('tags',[...StateManager.get('tags'),{id:'tag_'+Date.now().toString(36)+rnd(),name,color}]);
      if(nameInp) nameInp.value=''; renderSettingsPanel(); renderTagFilterRow();
    });
    document.getElementById('btn-save-tg')?.addEventListener('click',()=>{ StateManager.patch({tgToken:document.getElementById('tg-bot-token')?.value.trim()||'',tgChatId:document.getElementById('tg-chat-id')?.value.trim()||''}); SyncManager.scheduleSync(); showToast('✅ Telegram сохранён'); });
    document.getElementById('btn-export-data')?.addEventListener('click',exportData);
    document.getElementById('btn-reset-data')?.addEventListener('click',resetData);
    document.getElementById('btn-load-demo')?.addEventListener('click',loadDemoData);
    document.getElementById('btn-save-sleep')?.addEventListener('click',()=>RoutineManager.saveSettings());
  } catch(e){console.warn('[settings]',e);}

  // ── TASK MODAL ──
  try {
    document.getElementById('btn-save-task')?.addEventListener('click',()=>TaskController.save());
    document.getElementById('btn-delete-task')?.addEventListener('click',()=>TaskController.delete());
    document.getElementById('btn-add-subtask')?.addEventListener('click',()=>TaskController.addSubtaskRow());
    document.getElementById('btn-add-participant')?.addEventListener('click',()=>TaskController.addParticipant());
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ document.querySelectorAll('#priority-ctrl .seg-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }); });
    document.getElementById('task-title-input')?.addEventListener('input',e=>{
      if(e.target.value.length>5){ const p=NLP.parse(e.target.value); const hint=document.getElementById('nlp-hint'); if(hint&&p.scheduledAt){hint.textContent=`📅 ${fmtDateTime(p.scheduledAt)}`; hint.classList.remove('hidden');}else if(hint) hint.classList.add('hidden'); }
    });
  } catch(e){console.warn('[task modal]',e);}

  // ── DETAIL MODAL ──
  try {
    document.getElementById('btn-td-edit')?.addEventListener('click',()=>{ const id=StateManager.get('detailTaskId'); closeModal('modal-task-detail'); TaskController.openModal(id); });
    document.getElementById('btn-td-done')?.addEventListener('click',()=>{ const id=StateManager.get('detailTaskId'); if(id){TaskController.complete(id); closeModal('modal-task-detail');} });
    document.getElementById('btn-td-timer')?.addEventListener('click',()=>{ const id=StateManager.get('detailTaskId'); if(id){TimerController.setGoal(id); closeModal('modal-task-detail'); ViewRouter.switchTo('timer');} });
  } catch(e){console.warn('[detail]',e);}

  // ── TIMER ──
  try {
    document.getElementById('btn-timer-play')?.addEventListener('click',()=>{ TimerController.toggle(); updateTimerControls(); });
    document.getElementById('btn-timer-reset')?.addEventListener('click',()=>TimerController.reset());
    document.getElementById('btn-timer-done')?.addEventListener('click',()=>TimerController.complete());
    document.getElementById('btn-pick-timer-goal')?.addEventListener('click',()=>TimerController.openPicker());
    document.querySelectorAll('.timer-mode-btn').forEach(btn=>{ btn.addEventListener('click',()=>TimerController.setMode(btn.dataset.mode)); });
    document.getElementById('timer-ring-wrap')?.addEventListener('click',()=>TimerController.openFocus());
    ['work','short','long'].forEach(k=>{ document.getElementById(`pomo-${k}-dec`)?.addEventListener('click',()=>TimerController.adjustPomo(k,-1)); document.getElementById(`pomo-${k}-inc`)?.addEventListener('click',()=>TimerController.adjustPomo(k,1)); });
  } catch(e){console.warn('[timer]',e);}

  // ── FOCUS OVERLAY ──
  try {
    document.getElementById('btn-focus-exit')?.addEventListener('click',()=>TimerController.closeFocus());
    document.getElementById('btn-focus-pause')?.addEventListener('click',()=>{ TimerController.toggle(); updateTimerControls(); });
    document.getElementById('btn-focus-done')?.addEventListener('click',()=>{ TimerController.complete(); TimerController.closeFocus(); });
  } catch(e){console.warn('[focus]',e);}

  // ── CALENDAR ──
  try {
    document.getElementById('cal-prev')?.addEventListener('click',()=>CalendarController.prev());
    document.getElementById('cal-next')?.addEventListener('click',()=>CalendarController.next());
    // Биндим .cal-vsw-btn (новый класс после рефакторинга)
    document.querySelectorAll('.cal-vsw-btn').forEach(btn=>{
      btn.addEventListener('click',()=>CalendarController.setView(btn.dataset.calView));
    });
  } catch(e){console.warn('[cal]',e);}

  // ── PROFILE ──
  try {
    document.getElementById('btn-add-macro')?.addEventListener('click',()=>MacroController.openModal());
    document.getElementById('btn-save-macro')?.addEventListener('click',()=>MacroController.save());
    document.getElementById('btn-clear-history')?.addEventListener('click',()=>{ if(!confirm('Очистить историю?')) return; StateManager.set('history',[]); SyncManager.scheduleSync(); ProfileRenderer.render(); showToast('🗑 История очищена'); });
    document.getElementById('btn-cart')?.addEventListener('click',()=>{ StoreController.renderCart(); openModal('modal-cart'); });
    document.getElementById('btn-purchases')?.addEventListener('click',()=>{ StoreController.renderPurchases(); openModal('modal-purchases'); });
    document.getElementById('btn-checkout')?.addEventListener('click',()=>StoreController.checkout());
  } catch(e){console.warn('[profile]',e);}

  // ── VOICE ──
  try {
    document.getElementById('btn-voice-start')?.addEventListener('click',()=>VoiceInput.start());
    document.getElementById('btn-voice-stop')?.addEventListener('click',()=>VoiceInput.stop());
    document.getElementById('btn-voice-text-parse')?.addEventListener('click',()=>{ const txt=document.getElementById('voice-text-input')?.value.trim(); if(txt) VoiceInput.apply(txt); });
  } catch(e){console.warn('[voice]',e);}

  // ── MODAL CLOSE ──
  try {
    document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.close)));
    document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov) closeModal(ov.id);}));
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal-overlay.open').forEach(m=>closeModal(m.id)); TimerController.closeFocus(); } });
  } catch(e){console.warn('[modals]',e);}
}

/* ═══════════════════════════════════════════════════════════
   INIT — DOMContentLoaded (каждый модуль в try/catch)
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  try { StateManager.load();          } catch(e) { console.error('[Init:load]',e); }
  try { TaskController.init();        } catch(e) { console.error('[Init:task]',e); }
  try { CalendarController.init();    } catch(e) { console.error('[Init:cal]',e); }
  try { RoutineManager.init();        } catch(e) { console.error('[Init:routine]',e); }
  try { TimerController.scheduleReminders(); } catch(e) { console.error('[Init:reminders]',e); }
  try { VoiceInput.init();            } catch(e) { console.error('[Init:voice]',e); }
  try { initGlobalEvents();           } catch(e) { console.error('[Init:events]',e); }
  try { ViewRouter.switchTo('tasks'); } catch(e) { console.error('[Init:view]',e); }
  // Sync pomo display
  try {
    const pomo=StateManager.get('pomoConfig');
    ['work','short','long'].forEach(k=>{ const el=document.getElementById(`pomo-${k}-val`); if(el) el.textContent=pomo[k]; });
  } catch(e){}
  // KV cloud load after 2 sec
  setTimeout(()=>{ try{SyncManager.loadFromCloud();}catch(e){console.warn('[Init:KV]',e);} }, 2000);
  console.log('[Life OS v4.0] ✅ Инициализация завершена');
});