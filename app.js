/* ══════════════════════════════════════════════════════════
   ЦЕЛЬ PWA — app.js v2.0
   Storage · Timer · Calendar · Voice · Store · Vercel KV
   ══════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════
   VERCEL KV SYNC
   Endpoint: /api/sync  (deployed on Vercel)
   Falls back silently if not deployed yet.
═══════════════════════════════════════════════════════════ */
const KV_ENDPOINT = '/api/sync';
let syncTimer = null;
let syncBadgeTimer = null;

async function syncToKV(payload) {
  const badge = document.getElementById('sync-badge');
  if (badge) { badge.className = 'sync-badge syncing'; badge.textContent = '↑ Синхронизация...'; }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await fetch(KV_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getOrCreateUserId(), ...payload })
      });
      if (badge) { badge.className = 'sync-badge synced'; badge.textContent = '✓ Синхронизировано'; }
    } catch (_) {
      /* Offline or not yet deployed — silent fail */
      if (badge) { badge.className = 'sync-badge hidden'; }
    } finally {
      clearTimeout(syncBadgeTimer);
      syncBadgeTimer = setTimeout(() => { if (badge) badge.className = 'sync-badge hidden'; }, 2400);
    }
  }, 1200);
}

function getOrCreateUserId() {
  let uid = localStorage.getItem('цель-uid');
  if (!uid) { uid = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); localStorage.setItem('цель-uid', uid); }
  return uid;
}

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

// 40 curated colors for tags/events
const COLOR_PALETTE = [
  '#0A84FF','#007AFF','#5AC8FA','#64D2FF','#30D158','#34C759',
  '#30B0C7','#32ADE6','#BF5AF2','#AF52DE','#FF375F','#FF2D55',
  '#FF453A','#FF6961','#FF9F0A','#FFCC00','#FFD60A','#FF9500',
  '#FF6B35','#F7931E','#5E5CE6','#7B7AE0','#A5A4F0','#C7C6FF',
  '#D4AF37','#E8C547','#48CAE4','#00B4D8','#9B5DE5','#C77DFF',
  '#F72585','#B5179E','#06D6A0','#2DC653','#8338EC','#3A86FF',
  '#FB5607','#FF006E','#FFBE0B','#8AC926',
];

const QUICK_DURATIONS = [
  [0,0,5,0,'5 мин'],[0,0,15,0,'15 мин'],[0,0,25,0,'25 мин'],
  [0,0,45,0,'45 мин'],[0,1,0,0,'1 час'],[0,2,0,0,'2 часа'],
  [0,4,0,0,'4 часа'],[1,0,0,0,'1 день'],[7,0,0,0,'7 дней'],
];

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

const TAG_DEFAULT_NAMES = ['фокус','срочно','важно','рутина','обучение','проект'];
const TAG_PALETTE = COLOR_PALETTE.slice(0, 10);
const REMINDER_OPTIONS = [1, 5, 15, 30, 60, 1440]; // minutes

const LEVELS = [
  { min:0,   label:'Новичок',      emoji:'🌱' },
  { min:10,  label:'Стажёр',       emoji:'⚡' },
  { min:25,  label:'Практик',      emoji:'🔥' },
  { min:50,  label:'Мастер',       emoji:'💎' },
  { min:100, label:'Ветеран',      emoji:'🏆' },
  { min:200, label:'Легенда',      emoji:'⭐' },
  { min:500, label:'Элита',        emoji:'👑' },
  { min:999, label:'Непобедимый',  emoji:'🌟' },
];

/* ═══════════════════════════════════════════════════════════
   STATE (100% localStorage backward compatible)
═══════════════════════════════════════════════════════════ */
let goals     = JSON.parse(localStorage.getItem('цель-goals')     || '[]');
let history   = JSON.parse(localStorage.getItem('цель-history')   || '[]');
let purchases = JSON.parse(localStorage.getItem('цель-purchases') || '[]');
let gems      = parseInt(localStorage.getItem('цель-gems')        || '0');
let streak    = JSON.parse(localStorage.getItem('цель-streak2')   || '{"days":0,"lastDate":"","doneToday":false}');

// Tags
let tags = JSON.parse(localStorage.getItem('цель-tags') || 'null');
if (!tags) {
  tags = TAG_DEFAULT_NAMES.map((name, i) => ({
    id: 'tag_default_' + i, name,
    color: TAG_PALETTE[i % TAG_PALETTE.length]
  }));
}

// Macro goals (with legacy migration)
let macroGoals = JSON.parse(localStorage.getItem('цель-macros') || 'null');
if (!macroGoals) {
  const legacy = JSON.parse(localStorage.getItem('цель-macro') || 'null');
  macroGoals = legacy ? [{ ...legacy, id: 'macro_' + Date.now().toString(36) }] : [];
}

// UI State
let activeTaskId   = null;
let currentView    = 'tasks';
let taskFilter     = 'all';
let taskTagFilter  = null;
let histTagFilter  = null;
let storeFilter    = 'all';
let storeDraft     = {};
let cart           = [];
let editingTaskId  = null;
let detailTaskId   = null;
let reflMacroId    = null;
let selectedColor  = COLOR_PALETTE[0];
let selectedTags   = [];
let selectedReminders = [];
let participants   = [];

// Pomodoro
let pomoConfig = JSON.parse(localStorage.getItem('цель-pomo') || '{"work":25,"short":5,"long":15}');
let pomoPhase  = 'work'; // 'work' | 'short' | 'long'
let pomoCycles = 0;

// Timer
let rafId         = null;
let timerMode     = 'countdown'; // 'countdown' | 'pomodoro' | 'stopwatch'
let stopwatchStart = null;
let stopwatchElapsed = 0;
let stopwatchRunning = false;

// Calendar
let calView     = 'month';
let calDate     = new Date();
let calSelectedDay = null;

// Alarms
let firedAlarmIds   = new Set();
let alarmAudioMap   = {};
let reminderTimers  = [];

// Pending voice draft
let voiceDraft = null;

STORE_ITEMS.forEach(i => storeDraft[i.id] = 1);

/* ── MIGRATE TAG REFS ── */
function findOrCreateTagByName(name) {
  let t = tags.find(t => t.id === name) || tags.find(t => t.name === name);
  if (!t) {
    t = { id: 'tag_' + Date.now().toString(36) + rnd(), name, color: TAG_PALETTE[tags.length % TAG_PALETTE.length] };
    tags.push(t);
  }
  return t;
}
function migrateTagRefs(item) {
  if (item.tags && item.tags.length) {
    item.tags = item.tags.map(ref => tags.find(t => t.id === ref) ? ref : findOrCreateTagByName(ref).id);
  }
}
goals.forEach(migrateTagRefs);
history.forEach(migrateTagRefs);

/* ── EXTEND GOALS with new fields ── */
goals.forEach(g => {
  if (!g.location)     g.location = '';
  if (!g.participants) g.participants = [];
  if (!g.cost)         g.cost = 0;
  if (!g.travelTime)   g.travelTime = 0;
  if (!g.reminders)    g.reminders = [];
  if (!g.color)        g.color = '';
  if (!g.scheduledAt)  g.scheduledAt = null;
  if (!g.duration_min) g.duration_min = Math.round((g.duration || 1500) / 60);
  if (!g.notes)        g.notes = '';
});

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function pad(n, d = 2) { return String(Math.floor(Math.abs(n))).padStart(d, '0'); }
function rnd() { return Math.random().toString(36).slice(2, 6); }
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getTag(id) { return tags.find(t => t.id === id); }
function dateKey(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtD(s) {
  const dy = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  if (dy > 0) return `${dy}д ${pad(h)}ч`;
  if (h  > 0) return `${h}ч ${pad(m)}м`;
  if (m  > 0) return `${m}м ${pad(sec)}с`;
  return `${sec}с`;
}
function fmtRel(ts) {
  const d = Date.now() - ts, m = Math.floor(d/60000), h = Math.floor(m/60), dy = Math.floor(h/24);
  if (dy > 0) return `${dy}д назад`;
  if (h  > 0) return `${h}ч назад`;
  if (m  > 0) return `${m}м назад`;
  return 'только что';
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
function getElapsed(g) {
  if (!g.startTime) return g.elapsed || 0;
  return (g.elapsed || 0) + (Date.now() - g.startTime) / 1000;
}
function catColor(g) {
  if (g.color) return g.color;
  return (CATS[g.cat] || CATS.business).color;
}
function getLevel(gemCount) {
  let lv = LEVELS[0];
  for (const l of LEVELS) { if (gemCount >= l.min) lv = l; }
  return lv;
}
function mkEl(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

/* ═══════════════════════════════════════════════════════════
   SAVE / LOAD
═══════════════════════════════════════════════════════════ */
function saveAll(skipKV = false) {
  localStorage.setItem('цель-goals',     JSON.stringify(goals));
  localStorage.setItem('цель-history',   JSON.stringify(history));
  localStorage.setItem('цель-gems',      String(gems));
  localStorage.setItem('цель-streak2',   JSON.stringify(streak));
  localStorage.setItem('цель-purchases', JSON.stringify(purchases));
  localStorage.setItem('цель-macros',    JSON.stringify(macroGoals));
  localStorage.setItem('цель-tags',      JSON.stringify(tags));
  localStorage.setItem('цель-pomo',      JSON.stringify(pomoConfig));
  if (!skipKV) {
    syncToKV({
      goals: goals.filter(g => !g.done).slice(0, 40),  // active goals only
      gems,
      streak,
      historyToday: history.filter(h => dateKey(h.completedAt) === dateKey()),
      macroGoals,
    });
  }
}

/* ── KV SYNC ── */
function syncToKV(data) {
  const uid = getOrCreateUserId();
  const token = localStorage.getItem('цель-tg-token');
  if (!token) return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: localStorage.getItem('цель-tg-chat'), text: JSON.stringify(data) })
  }).catch(e => console.warn('KV Sync failed'));
}

/* ═══════════════════════════════════════════════════════════
   STREAK LOGIC
═══════════════════════════════════════════════════════════ */
const isSunday = () => new Date().getDay() === 0;

function streakOnComplete() {
  const today = dateKey();
  if (streak.lastDate === today) {
    streak.doneToday = true;
  } else {
    const yest = dateKey(Date.now() - 86400000);
    streak.days = (streak.lastDate === yest) ? streak.days + 1 : 1;
    streak.lastDate  = today;
    streak.doneToday = true;
  }
  saveAll();
}
function streakMidnightCheck() {
  const today = dateKey(), yest = dateKey(Date.now() - 86400000);
  if (streak.lastDate !== today) {
    streak.doneToday = false;
    // ВОСКРЕСНЫЙ ЧИТ-ДЕНЬ: стрик не сгорает по воскресеньям
    if (!isSunday()) {
      if (streak.lastDate !== yest && streak.lastDate !== '') streak.days = 0;
    }
    saveAll(true);
  }
}

/* ═══════════════════════════════════════════════════════════
   BIRTHDAY BONUS
═══════════════════════════════════════════════════════════ */
function checkBirthdayBonus() {
  const n = new Date(), y = n.getFullYear(), key = `birthday_bonus_${y}`;
  if (n.getMonth() === 4 && n.getDate() === 1 && !localStorage.getItem(key)) {
    gems += 100; localStorage.setItem(key, 'true'); saveAll();
    showPopup('milestone', '🎉', 'С Днём Рождения!', '+100 💎 на счёт!');
  }
}

/* ═══════════════════════════════════════════════════════════
   POPUP TOASTS
═══════════════════════════════════════════════════════════ */
let popQueue = [], popShowing = false;
function showPopup(type, icon, title, sub) {
  popQueue.push({ type, icon, title, sub });
  if (!popShowing) flushPopup();
}
function flushPopup() {
  if (!popQueue.length) { popShowing = false; return; }
  popShowing = true;
  const { type, icon, title, sub } = popQueue.shift();
  const stack = document.getElementById('popup-stack');
  const card  = mkEl('div', `popup-card ${type}-card`);
  card.innerHTML = `<div class="popup-icon">${icon}</div><div class="popup-text"><div class="popup-title">${esc(title)}</div><div class="popup-sub">${esc(sub)}</div></div>`;
  stack.appendChild(card);
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
  setTimeout(() => {
    card.classList.remove('show');
    setTimeout(() => { card.remove(); flushPopup(); }, 400);
  }, 3200);
}
function awardOnComplete(goalTitle) {
  const prevDone = streak.doneToday;
  gems++; saveAll(); streakOnComplete();
  showPopup('gem', '💎', `+1 кристалл! (${gems} всего)`, `«${goalTitle.substring(0,28)}»`);
  if (!prevDone) {
    const msg = streak.days === 1 ? 'Серия началась!' : `${streak.days} дней подряд — огонь!`;
    showPopup('fire', '🔥', msg, 'Огонёк сохранён на сегодня');
  }
  if (gems % 10 === 0 && gems !== 0) {
    const msgs = ['Просто машина!','Легенда!','Неудержимый!','На пике формы!','Непобедимый!'];
    showPopup('milestone', '🏆', `${gems} кристаллов — ${msgs[Math.floor(gems/10-1) % msgs.length]}`, 'Ты движешься вперёд каждый день');
  }
}

/* ═══════════════════════════════════════════════════════════
   ALARM ENGINE
═══════════════════════════════════════════════════════════ */
function playAlarm(goalId) {
  stopAlarm(goalId);
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const beep = () => {
      const t = ctx.currentTime;
      [880, 1108, 880, 1318].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.22, t + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.14);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t + i * 0.16); osc.stop(t + i * 0.16 + 0.15);
      });
    };
    beep();
    const loopId = setInterval(beep, 1600);
    alarmAudioMap[goalId] = { ctx, loopId };
  } catch(e) { console.warn('WebAudio:', e); }
}
function stopAlarm(goalId) {
  const e = alarmAudioMap[goalId];
  if (e) { clearInterval(e.loopId); e.ctx.close().catch(()=>{}); delete alarmAudioMap[goalId]; }
  const card = document.getElementById('alarm-card-' + goalId);
  if (card) card.remove();
}
function triggerAlarm(goal, msg = 'Время вышло!') {
  playAlarm(goal.id);
  if (document.getElementById('alarm-card-' + goal.id)) return;
  const stack = document.getElementById('alarm-stack');
  const card = mkEl('div', 'alarm-card');
  card.id = 'alarm-card-' + goal.id;
  card.innerHTML = `<div class="alarm-icon">⏰</div><div class="alarm-text"><div class="alarm-title">${esc(msg)}</div><div class="alarm-sub">«${esc(goal.title.substring(0,40))}»</div></div><button class="alarm-close" title="Закрыть">✕</button>`;
  card.querySelector('.alarm-close').addEventListener('click', () => stopAlarm(goal.id));
  stack.appendChild(card);
}
function scheduleReminders(goal) {
  clearReminderTimers();
  if (!goal.scheduledAt || !goal.reminders || !goal.reminders.length) return;
  goal.reminders.forEach(mins => {
    const fireAt = goal.scheduledAt - mins * 60000;
    const delta = fireAt - Date.now();
    if (delta > 0) {
      const tid = setTimeout(() => {
        triggerAlarm(goal, `Через ${mins < 60 ? mins + ' мин' : (mins/60) + ' ч'}!`);
      }, delta);
      reminderTimers.push(tid);
    }
  });
}
function clearReminderTimers() {
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];
}
function rescheduleAllReminders() {
  clearReminderTimers();
  goals.filter(g => !g.done && g.scheduledAt && g.reminders?.length).forEach(scheduleReminders);
}

/* ═══════════════════════════════════════════════════════════
   TIMER ENGINE (RAF)
═══════════════════════════════════════════════════════════ */
/* ── CONTEXTUAL TOASTS ── */
const CONTEXT_TOASTS = {
  // по тегу
  'спорт':     ['🏋️', 'Развали их там!', 'Максимальная отдача!'],
  'здоровье':  ['💪', 'Тело — твой капитал!', 'Каждый повтор считается.'],
  'бизнес':    ['💼', 'Продуктивности, босс!', 'Делай деньги, не отмазки.'],
  'учёба':     ['📚', 'Знание — сила!', 'Сфокусируйся, ты справишься.'],
  'творчество':['🎨', 'Потоковое состояние!', 'Создавай шедевры.'],
  // по категории задачи
  business:    ['💼', 'Продуктивности, босс!', 'Делай деньги, не отмазки.'],
  health:      ['💪', 'Развали их там!', 'Тело — твой капитал!'],
  study:       ['📚', 'Знание — сила!', 'Сфокусируйся.'],
  creative:    ['🎨', 'Потоковое состояние!', 'Создавай шедевры.'],
  life:        ['🌱', 'Маленькие шаги — большой путь!', 'Вперёд!'],
  default:     ['⚡', 'Поехали!', 'Фокус включён.'],
};

function getContextualToast(goal) {
  // Check tag names first
  const tagNames = (goal.tags || []).map(id => { const t = getTag(id); return t ? t.name.toLowerCase() : ''; });
  for (const [key, val] of Object.entries(CONTEXT_TOASTS)) {
    if (tagNames.some(n => n.includes(key))) return val;
  }
  // Category fallback
  return CONTEXT_TOASTS[goal.cat] || CONTEXT_TOASTS.default;
}

function startTimer() {
  if (timerMode === 'stopwatch') {
    stopwatchStart = Date.now() - stopwatchElapsed * 1000;
    stopwatchRunning = true;
    // Toast for stopwatch
    showPopup('gem', '⏱', 'Секундомер запущен', 'Время пошло!');
    rafLoop();
  } else if (timerMode === 'pomodoro') {
    const g = goals.find(x => x.id === activeTaskId);
    if (g) { g.startTime = Date.now(); g.paused = false; saveAll(); }
    rafLoop();
  } else {
    const g = goals.find(x => x.id === activeTaskId);
    if (!g || g.done) return;
    g.startTime = Date.now(); g.paused = false;
    firedAlarmIds.delete(g.id); saveAll(); rafLoop();
    // Contextual toast
    const [icon, t, s] = getContextualToast(g);
    showPopup('gem', icon, t, s);
  }
  updateTimerControls();
  renderTaskList();
}
function pauseTimer() {
  if (timerMode === 'stopwatch') {
    stopwatchElapsed = (Date.now() - stopwatchStart) / 1000;
    stopwatchRunning = false;
  } else {
    const g = goals.find(x => x.id === activeTaskId);
    if (g) { g.elapsed = getElapsed(g); g.startTime = null; g.paused = true; saveAll(); }
  }
  cancelAnimationFrame(rafId); rafId = null;
  updateTimerControls(); renderTaskList();
}
function resetTimer() {
  cancelAnimationFrame(rafId); rafId = null;
  if (timerMode === 'stopwatch') {
    stopwatchElapsed = 0; stopwatchRunning = false;
  } else if (timerMode === 'pomodoro') {
    pomoCycles = 0; pomoPhase = 'work';
    const g = goals.find(x => x.id === activeTaskId);
    if (g) { g.elapsed = 0; g.startTime = null; g.paused = false; if (g.subtasks) g.subtasks.forEach(s => s.done = false); saveAll(); }
    renderPomodoroCycles();
  } else {
    const g = goals.find(x => x.id === activeTaskId);
    if (g) { g.elapsed = 0; g.startTime = null; g.paused = false; if (g.subtasks) g.subtasks.forEach(s => s.done = false); saveAll(); firedAlarmIds.delete(g.id); stopAlarm(g.id); }
  }
  tickDisplay();
  updateTimerControls(); renderTaskList();
}
function completeTimer() {
  cancelAnimationFrame(rafId); rafId = null;
  const g = goals.find(x => x.id === activeTaskId); if (!g) return;
  const elapsed = getElapsed(g);
  g.elapsed = elapsed; g.startTime = null; g.paused = true; g.done = true;
  history.push({
    id: Date.now(), title: g.title, cat: g.cat,
    duration: g.duration, elapsed, overdue: elapsed > g.duration * 1.1,
    completedAt: Date.now(), type: 'timer', tags: [...(g.tags||[])]
  });
  saveAll(); awardOnComplete(g.title); stopAlarm(g.id);
  const flash = document.getElementById('done-flash');
  flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 700);
  updateTimerControls(); tickDisplay(); renderTaskList();
}
function rafLoop() {
  cancelAnimationFrame(rafId);
  function loop() {
    tickDisplay();
    let running = false;
    if (timerMode === 'stopwatch') running = stopwatchRunning;
    else { const g = goals.find(x => x.id === activeTaskId); running = !!(g && g.startTime && !g.paused && !g.done); }
    if (running) rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}
function tickDisplay() {
  const g = goals.find(x => x.id === activeTaskId);
  const circ = 2 * Math.PI * 96;
  const ringEl   = document.getElementById('ring-fill-el');
  const timeEl   = document.getElementById('timer-time-display');
  const subEl    = document.getElementById('timer-time-sub');
  const pctEl    = document.getElementById('timer-pct');
  const catEl    = document.getElementById('timer-cat-badge');
  const focusEl  = document.getElementById('focus-time');

  if (timerMode === 'stopwatch') {
    const elapsed = stopwatchRunning ? (Date.now() - stopwatchStart) / 1000 : stopwatchElapsed;
    const hh = Math.floor(elapsed / 3600), mm = Math.floor((elapsed % 3600) / 60), ss = Math.floor(elapsed % 60);
    const str = hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
    if (timeEl) timeEl.textContent = str;
    if (subEl)  subEl.textContent  = 'Секундомер';
    if (ringEl) { ringEl.style.strokeDashoffset = (circ * 0.25).toFixed(3); ringEl.setAttribute('stroke', '#BF5AF2'); }
    if (catEl)  catEl.textContent = '';
    if (focusEl) focusEl.textContent = str;
    return;
  }

  if (timerMode === 'pomodoro') {
    const totalSec = pomoPhaseSeconds();
    const elapsedSec = g ? getElapsed(g) : 0;
    const remaining  = Math.max(0, totalSec - elapsedSec);
    const pct = Math.min(1, elapsedSec / totalSec);
    if (ringEl) {
      ringEl.style.strokeDashoffset = (circ * (1 - pct)).toFixed(3);
      ringEl.setAttribute('stroke', pomoPhaseColor());
    }
    const mm = Math.floor(remaining / 60), ss = Math.floor(remaining % 60);
    if (timeEl) timeEl.textContent = `${pad(mm)}:${pad(ss)}`;
    if (subEl) subEl.textContent = pomoPhaseLabel();
    if (pctEl) pctEl.textContent = `${Math.round(pct * 100)}%`;
    if (focusEl) focusEl.textContent = `${pad(mm)}:${pad(ss)}`;
    // Auto-advance pomodoro phase
    if (remaining <= 0 && g && g.startTime) {
      advancePomodoro(g);
    }
    return;
  }

  // Countdown mode
  if (!g) {
    if (timeEl) timeEl.textContent = '00:00';
    if (ringEl) { ringEl.style.strokeDashoffset = circ.toFixed(3); }
    return;
  }
  const elapsed   = getElapsed(g);
  const remaining = Math.max(0, g.duration - elapsed);
  const pct       = Math.min(1, elapsed / g.duration);
  const color     = g.done ? '#30D158' : (remaining < 60 ? '#FF453A' : catColor(g));

  if (ringEl) {
    ringEl.style.strokeDashoffset = (circ * (1 - pct)).toFixed(3);
    ringEl.setAttribute('stroke', color);
    ringEl.style.filter = `drop-shadow(0 0 12px ${color}88)`;
  }
  const rd = Math.floor(remaining/86400), rh = Math.floor((remaining%86400)/3600),
        rm = Math.floor((remaining%3600)/60), rs = Math.floor(remaining%60);
  let str;
  if (g.done) str = '✓ Выполнено';
  else if (rd > 0) str = `${rd}д ${pad(rh)}:${pad(rm)}:${pad(rs)}`;
  else if (rh > 0) str = `${rh}:${pad(rm)}:${pad(rs)}`;
  else str = `${pad(rm)}:${pad(rs)}`;

  if (timeEl) { timeEl.textContent = str; timeEl.classList.toggle('overdue', remaining < 60 && !g.done); }
  if (subEl)  subEl.textContent  = g.done ? '' : (rd > 0 ? '' : (rh > 0 ? `${rh}ч до конца` : ''));
  if (pctEl)  pctEl.textContent  = `${Math.round(pct * 100)}% выполнено`;
  if (catEl) { const c = CATS[g.cat] || CATS.business; catEl.textContent = c.label; catEl.style.color = c.color; }

  const focusTitleEl = document.getElementById('focus-title'), focusBadgeEl = document.getElementById('focus-cat-badge');
  if (focusEl) { focusEl.textContent = g.done ? '✓' : str; focusEl.classList.toggle('warn', remaining < 60 && !g.done); }
  if (focusTitleEl) focusTitleEl.textContent = g.title;
  if (focusBadgeEl) { const c = CATS[g.cat] || CATS.business; focusBadgeEl.textContent = c.label; focusBadgeEl.style.color = c.color; }

  if (!g.done && remaining <= 0 && g.startTime && !firedAlarmIds.has(g.id)) {
    firedAlarmIds.add(g.id); triggerAlarm(g);
  }
}

/* ── Fix calendar now-line render ── */
function buildNowLine() {
  const line = document.createElement('div');
  line.className = 'cal-now-line';
  line.innerHTML = '<div class="cal-now-line-dot"></div><div class="cal-now-line-bar"></div>';
  return line;
}

function pomoPhaseSeconds() {
  const k = { work: 'work', short: 'short', long: 'long' }[pomoPhase];
  return pomoConfig[k] * 60;
}
function pomoPhaseLabel() {
  return { work:'Фокус 🎯', short:'Короткий перерыв ☕', long:'Длинный перерыв 🌿' }[pomoPhase];
}
function pomoPhaseColor() {
  return { work:'#0A84FF', short:'#30D158', long:'#BF5AF2' }[pomoPhase];
}
function advancePomodoro(g) {
  cancelAnimationFrame(rafId); rafId = null;
  g.elapsed = 0; g.startTime = null; g.paused = true; saveAll();
  if (pomoPhase === 'work') {
    pomoCycles++;
    pomoPhase = pomoCycles % 4 === 0 ? 'long' : 'short';
    showPopup('gem', '☕', 'Перерыв!', pomoPhase === 'long' ? 'Длинный перерыв — отдохни!' : 'Короткий перерыв — 5 минут');
  } else {
    pomoPhase = 'work';
    showPopup('gem', '🎯', 'Время работать!', 'Фокус-сессия началась');
  }
  renderPomodoroCycles();
  updateTimerControls();
}
function renderPomodoroCycles() {
  const el = document.getElementById('pomo-cycles'); if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const dot = mkEl('div', `pomo-cycle-dot${i < pomoCycles % 4 ? ' done' : ''}`);
    el.appendChild(dot);
  }
  const phaseEl = document.getElementById('pomo-phase');
  if (phaseEl) phaseEl.textContent = pomoPhaseLabel();
}

function updateTimerControls() {
  const startBtn = document.getElementById('btn-timer-start');
  const doneBtn  = document.getElementById('btn-timer-done');
  const resetBtn = document.getElementById('btn-timer-reset');
  if (!startBtn) return;
  let isRunning = false;
  if (timerMode === 'stopwatch') isRunning = stopwatchRunning;
  else { const g = goals.find(x => x.id === activeTaskId); isRunning = !!(g && g.startTime && !g.paused && !g.done); }
  startBtn.textContent = isRunning ? '⏸' : '▶';
  startBtn.onclick = isRunning ? pauseTimer : startTimer;
  if (doneBtn) { doneBtn.style.display = timerMode === 'stopwatch' ? 'none' : ''; }
  renderSubtaskRings();
  // Focus mode controls
  const fControls = document.getElementById('focus-controls'); if (!fControls) return;
  fControls.innerHTML = '';
  const fStart = mkEl('button', `timer-ctrl-btn ${isRunning?'secondary':'primary'}`);
  fStart.textContent = isRunning ? '⏸' : '▶';
  fStart.onclick = isRunning ? pauseTimer : startTimer;
  fControls.appendChild(fStart);
  if (timerMode !== 'stopwatch') {
    const fDone = mkEl('button', 'timer-ctrl-btn success'); fDone.textContent = '✓';
    fDone.onclick = completeTimer; fControls.appendChild(fDone);
  }
}

function renderSubtaskRings() {
  const wrap = document.getElementById('subtask-rings'); if (!wrap) return;
  wrap.innerHTML = '';
  const g = goals.find(x => x.id === activeTaskId);
  if (!g || !g.subtasks || !g.subtasks.length) return;
  const color = catColor(g), R = 20, circ = 2 * Math.PI * R;
  g.subtasks.forEach((st, i) => {
    const w = mkEl('div', `st-ring-wrap${st.done ? ' done' : ''}`);
    w.innerHTML = `<div class="st-ring-svg-wrap"><svg class="st-ring-svg" viewBox="0 0 50 50"><circle fill="none" stroke="rgba(255,255,255,.1)" stroke-width="4" cx="25" cy="25" r="${R}"/><circle fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" cx="25" cy="25" r="${R}" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${st.done ? 0 : circ.toFixed(2)}" style="transition:stroke-dashoffset .3s"/></svg><div class="st-inner-label">${st.done ? '✓' : i+1}</div></div><div class="st-label">${esc(st.title)}</div>`;
    w.addEventListener('click', () => { st.done = !st.done; saveAll(); renderSubtaskRings(); });
    wrap.appendChild(w);
  });
}

/* ── Active goal selector ── */
function renderTimerGoalSelector() {
  const el = document.getElementById('tgs-task-info'); if (!el) return;
  const g = goals.find(x => x.id === activeTaskId);
  el.textContent = g ? g.title : 'Выбери задачу...';
  if (g) el.style.color = catColor(g);
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(`view-${view}`);
  if (panel) { panel.style.display = ''; panel.style.removeProperty('display'); }
  document.querySelectorAll('.di-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'tasks')    renderTaskList();
  if (view === 'calendar') renderCalendar();
  if (view === 'timer')    { renderTimerGoalSelector(); updateTimerControls(); tickDisplay(); }
  if (view === 'profile')  renderProfile();
}
document.querySelectorAll('.di-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ═══════════════════════════════════════════════════════════
   TASKS VIEW
═══════════════════════════════════════════════════════════ */
function renderSundayBanner() {
  let banner = document.getElementById('sunday-banner');
  if (isSunday()) {
    if (!banner) {
      banner = mkEl('div', 'sunday-banner');
      banner.id = 'sunday-banner';
      banner.innerHTML = '😴 Сегодня воскресенье — отдыхай! Стрик защищён.';
      const tagRow = document.getElementById('task-tag-filter-row');
      if (tagRow) tagRow.insertAdjacentElement('afterend', banner);
    }
  } else {
    if (banner) banner.remove();
  }
}

function renderTaskList() {
  const all = [...goals];
  const now = new Date();
  const todayKey = dateKey();
  const tomorrowKey = dateKey(Date.now() + 86400000);
  const searchQ = document.getElementById('search-input')?.value?.trim().toLowerCase() || '';
  renderSundayBanner();

  let filtered = all;
  if (searchQ) {
    filtered = filtered.filter(g =>
      g.title.toLowerCase().includes(searchQ) ||
      (g.location || '').toLowerCase().includes(searchQ) ||
      (g.tags || []).some(tid => { const t = getTag(tid); return t && t.name.toLowerCase().includes(searchQ); })
    );
  }
  if (taskTagFilter) filtered = filtered.filter(g => (g.tags||[]).includes(taskTagFilter));

  // Groups
  const groups = { overdue:[], today:[], tomorrow:[], upcoming:[], nodule:[], done:[] };
  filtered.forEach(g => {
    if (g.done) { groups.done.push(g); return; }
    if (!g.scheduledAt) { groups.nodule.push(g); return; }
    const dk = dateKey(g.scheduledAt);
    if (g.scheduledAt < Date.now() && !g.done) groups.overdue.push(g);
    else if (dk === todayKey) groups.today.push(g);
    else if (dk === tomorrowKey) groups.tomorrow.push(g);
    else if (g.scheduledAt > Date.now()) groups.upcoming.push(g);
    else groups.nodule.push(g);
  });

  if (taskFilter === 'today')    { Object.keys(groups).forEach(k => k !== 'today' && (groups[k] = [])); }
  if (taskFilter === 'upcoming') { Object.keys(groups).forEach(k => !['upcoming','tomorrow'].includes(k) && (groups[k] = [])); }
  if (taskFilter === 'overdue')  { Object.keys(groups).forEach(k => k !== 'overdue' && (groups[k] = [])); }
  if (taskFilter === 'done')     { Object.keys(groups).forEach(k => k !== 'done' && (groups[k] = [])); }

  const groupMeta = {
    overdue:  { id:'tasks-group-overdue',   label:'🔴 Просрочено',   items: groups.overdue },
    today:    { id:'tasks-group-today',     label:'📅 Сегодня',       items: groups.today },
    tomorrow: { id:'tasks-group-tomorrow',  label:'🌅 Завтра',        items: groups.tomorrow },
    upcoming: { id:'tasks-group-upcoming',  label:'📆 Позже',         items: groups.upcoming },
    nodule:   { id:'tasks-group-nodule',    label:'📋 Без даты',      items: groups.nodule },
    done:     { id:'tasks-group-done',      label:'✓ Выполнено',      items: groups.done },
  };

  let totalVisible = 0;
  Object.values(groupMeta).forEach(({ id, label, items }) => {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = '';
    if (!items.length) return;
    totalVisible += items.length;
    const lbl = mkEl('div', 'task-group-label', label);
    el.appendChild(lbl);
    items.forEach((g, idx) => {
      el.appendChild(buildTaskCard(g, idx));
    });
  });

  const empty = document.getElementById('tasks-empty');
  if (empty) empty.style.display = totalVisible === 0 ? '' : 'none';

  // Subtitle
  const sub = document.getElementById('tasks-subtitle');
  if (sub) {
    const active = goals.filter(g => !g.done).length;
    const todayDone = history.filter(h => dateKey(h.completedAt) === todayKey).length;
    sub.textContent = `${active} активных · ${todayDone} выполнено сегодня`;
  }

  renderTaskTagFilterRow();
}

function buildTaskCard(g, idx) {
  const color = catColor(g);
  const elapsed = getElapsed(g), pct = Math.min(100, (elapsed / g.duration) * 100);
  const c = CATS[g.cat] || CATS.business;
  const card = mkEl('div', `task-card${g.done ? ' done' : ''}${g.id === activeTaskId ? ' active-task' : ''}`);
  card.style.cssText = `--task-color:${color}; animation-delay:${idx * 0.04}s`;

  const tagHtml = (g.tags||[]).slice(0,3).map(tid => {
    const t = getTag(tid); if (!t) return '';
    return `<span class="task-tag" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">${esc(t.name)}</span>`;
  }).join('');

  const metaItems = [];
  if (g.scheduledAt) metaItems.push(`<span class="task-meta-item">📅 ${fmtTime(g.scheduledAt)}</span>`);
  if (g.duration_min) metaItems.push(`<span class="task-meta-item">⏱ ${g.duration_min}м</span>`);
  if (g.location) metaItems.push(`<span class="task-meta-item">📍 ${esc(g.location.substring(0,20))}</span>`);
  if (g.travelTime) metaItems.push(`<span class="task-meta-item">🚗 ${g.travelTime}м</span>`);

  const priorityColors = { high:'#FF453A', mid:'#FF9F0A', low:'#30D158' };
  const pColor = priorityColors[g.priority] || priorityColors.mid;

  card.innerHTML = `
    <div class="task-card-top">
      <button class="task-check-btn${g.done?' checked':''}" data-id="${g.id}">
        ${g.done ? '✓' : ''}
      </button>
      <div class="task-card-content">
        <div class="task-title">${esc(g.title)}</div>
        ${metaItems.length ? `<div class="task-meta">${metaItems.join('')}</div>` : ''}
        ${tagHtml ? `<div class="task-tags">${tagHtml}</div>` : ''}
      </div>
      <div class="task-priority-dot" style="background:${pColor};margin-top:4px"></div>
    </div>
    ${(g.elapsed || g.startTime) ? `<div class="task-progress"><div class="task-progress-fill" style="width:${pct.toFixed(1)}%"></div></div>` : ''}
  `;

  card.querySelector('.task-check-btn').addEventListener('click', e => {
    e.stopPropagation();
    if (g.done) restartGoal(g.id);
    else completeGoalDirect(g.id);
  });
  card.addEventListener('click', () => openTaskDetail(g.id));

  return card;
}

function renderTaskTagFilterRow() {
  const row = document.getElementById('task-tag-filter-row'); if (!row) return;
  row.innerHTML = '';
  if (!tags.length) return;
  tags.forEach(t => {
    const chip = mkEl('button', `tag-filter-chip${taskTagFilter === t.id ? ' active' : ''}`);
    chip.textContent = t.name;
    chip.style.color = t.color;
    chip.style.borderColor = taskTagFilter === t.id ? t.color : t.color + '44';
    chip.style.background = taskTagFilter === t.id ? t.color : t.color + '18';
    chip.addEventListener('click', () => {
      taskTagFilter = taskTagFilter === t.id ? null : t.id;
      renderTaskList();
    });
    row.appendChild(chip);
  });
}

/* ── GOAL ACTIONS ── */
function completeGoalDirect(id) {
  const g = goals.find(x => x.id === id); if (!g || g.done) return;
  const elapsed = getElapsed(g);
  g.elapsed = elapsed; g.startTime = null; g.paused = true; g.done = true;
  history.push({
    id: Date.now(), title: g.title, cat: g.cat,
    duration: g.duration, elapsed, overdue: elapsed > g.duration * 1.1,
    completedAt: Date.now(), type: 'timer', tags: [...(g.tags||[])],
    location: g.location, cost: g.cost
  });
  saveAll(); awardOnComplete(g.title); stopAlarm(g.id);
  const flash = document.getElementById('done-flash');
  flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 700);
  renderTaskList();
  if (currentView === 'timer') { updateTimerControls(); tickDisplay(); }
}
function restartGoal(id) {
  const g = goals.find(x => x.id === id); if (!g) return;
  g.done = false; g.elapsed = 0; g.startTime = null; g.paused = false;
  if (g.subtasks) g.subtasks.forEach(s => s.done = false);
  saveAll(); renderTaskList();
}
function deleteGoal(id) {
  cancelAnimationFrame(rafId); rafId = null;
  goals = goals.filter(x => x.id !== id);
  if (activeTaskId === id) activeTaskId = goals[0]?.id || null;
  saveAll(); renderTaskList();
  if (currentView === 'timer') renderTimerGoalSelector();
}

/* ── TASK DETAIL ── */
function openTaskDetail(id) {
  const g = goals.find(x => x.id === id); if (!g) return;
  detailTaskId = id;
  document.getElementById('detail-title').textContent = g.title;

  const body = document.getElementById('modal-task-detail-body');
  body.innerHTML = '';
  const color = catColor(g), c = CATS[g.cat] || CATS.business;

  // Status badge
  const statusBadge = mkEl('div', 'task-detail-section');
  statusBadge.innerHTML = `<div class="task-detail-chips">
    <span class="task-detail-chip" style="color:${color};border-color:${color}44;background:${color}11">${c.emoji} ${c.label}</span>
    <span class="task-detail-chip" style="color:${g.done?'#30D158':'#FF9F0A'};border-color:currentColor;background:currentColor">
      ${g.done ? '✓ Выполнено' : '⏳ В процессе'}
    </span>
  </div>`;
  body.appendChild(statusBadge);

  if (g.scheduledAt || g.duration_min) {
    const timeSection = mkEl('div', 'task-detail-section');
    timeSection.innerHTML = `<div class="task-detail-label">Время</div><div class="task-detail-value">${g.scheduledAt ? fmtDateTime(g.scheduledAt) : 'Без даты'}${g.duration_min ? ` · ${g.duration_min} мин` : ''}</div>`;
    body.appendChild(timeSection);
  }
  if (g.location) {
    const locSection = mkEl('div', 'task-detail-section');
    locSection.innerHTML = `<div class="task-detail-label">📍 Место</div><div class="task-detail-value">${esc(g.location)}</div>`;
    body.appendChild(locSection);
  }
  if (g.travelTime) {
    const tvSection = mkEl('div', 'task-detail-section');
    tvSection.innerHTML = `<div class="task-detail-label">🚗 Время на дорогу</div><div class="task-detail-value">${g.travelTime} мин</div>`;
    body.appendChild(tvSection);
  }
  if (g.participants && g.participants.length) {
    const partSection = mkEl('div', 'task-detail-section');
    partSection.innerHTML = `<div class="task-detail-label">👥 Участники</div><div class="task-detail-chips">${g.participants.map(p => `<span class="task-detail-chip" style="color:var(--accent);border-color:var(--accent-dim);background:var(--accent-dim)">👤 ${esc(p)}</span>`).join('')}</div>`;
    body.appendChild(partSection);
  }
  if (g.cost) {
    const costSection = mkEl('div', 'task-detail-section');
    costSection.innerHTML = `<div class="task-detail-label">💰 Бюджет</div><div class="task-detail-value">${g.cost} MDL</div>`;
    body.appendChild(costSection);
  }
  if (g.reminders && g.reminders.length) {
    const remSection = mkEl('div', 'task-detail-section');
    const remLabels = g.reminders.map(m => m >= 1440 ? `${m/1440}д` : m >= 60 ? `${m/60}ч` : `${m}м`);
    remSection.innerHTML = `<div class="task-detail-label">🔔 Напоминания</div><div class="task-detail-chips">${remLabels.map(l => `<span class="task-detail-chip" style="color:var(--orange);border-color:rgba(255,159,10,.3);background:rgba(255,159,10,.1)">${l} до</span>`).join('')}</div>`;
    body.appendChild(remSection);
  }
  if (g.tags && g.tags.length) {
    const tagsSection = mkEl('div', 'task-detail-section');
    tagsSection.innerHTML = `<div class="task-detail-label">Теги</div><div class="task-detail-chips">${(g.tags||[]).map(tid => { const t = getTag(tid); return t ? `<span class="task-detail-chip" style="color:${t.color};border-color:${t.color}44;background:${t.color}11">${esc(t.name)}</span>` : ''; }).join('')}</div>`;
    body.appendChild(tagsSection);
  }
  if (g.subtasks && g.subtasks.length) {
    const stSection = mkEl('div', 'task-detail-section');
    stSection.innerHTML = `<div class="task-detail-label">Подзадачи</div>`;
    g.subtasks.forEach((st, i) => {
      const row = mkEl('div', `detail-subtask-row`);
      row.innerHTML = `<div class="detail-st-check${st.done?' done':''}">${st.done?'✓':''}</div><div class="detail-st-text${st.done?' done':''}">${esc(st.title)}</div>`;
      row.addEventListener('click', () => { st.done = !st.done; saveAll(); openTaskDetail(id); });
      stSection.appendChild(row);
    });
    body.appendChild(stSection);
  }
  if (g.notes) {
    const notesSection = mkEl('div', 'task-detail-section');
    notesSection.innerHTML = `<div class="task-detail-label">Заметки</div><div class="task-detail-value" style="font-size:13px;color:var(--text2);line-height:1.5">${esc(g.notes)}</div>`;
    body.appendChild(notesSection);
  }

  // Action buttons
  const completeBtn = document.getElementById('btn-detail-complete');
  if (completeBtn) {
    completeBtn.textContent = g.done ? '↺ Переоткрыть' : '✓ Выполнено';
    completeBtn.onclick = () => {
      if (g.done) restartGoal(g.id); else completeGoalDirect(g.id);
      closeModal('modal-task-detail');
      renderTaskList();
    };
  }
  const deleteBtn = document.getElementById('btn-detail-delete');
  if (deleteBtn) deleteBtn.onclick = () => {
    if (confirm(`Удалить задачу «${g.title}»?`)) {
      deleteGoal(g.id); closeModal('modal-task-detail');
    }
  };
  const editBtn = document.getElementById('btn-detail-edit');
  if (editBtn) editBtn.onclick = () => { closeModal('modal-task-detail'); openTaskModal(g.id); };

  openModal('modal-task-detail');
}

/* ─── TASK CREATE / EDIT MODAL ─── */
function openTaskModal(id = null) {
  editingTaskId = id;
  const g = id ? goals.find(x => x.id === id) : null;
  document.getElementById('modal-task-title-label').textContent = g ? 'Редактировать' : 'Новая задача';

  // Reset form
  document.getElementById('t-title').value = g?.title || '';
  document.getElementById('t-cat').value   = g?.cat || 'business';
  document.getElementById('t-priority').value = g?.priority || 'mid';
  document.getElementById('t-location').value  = g?.location || '';
  document.getElementById('t-travel-time').value = g?.travelTime || '';
  document.getElementById('t-cost').value  = g?.cost || '';
  document.getElementById('t-notes').value = g?.notes || '';

  // Scheduled time
  if (g?.scheduledAt) {
    const d = new Date(g.scheduledAt);
    document.getElementById('t-scheduled').value = d.toISOString().slice(0, 16);
  } else {
    document.getElementById('t-scheduled').value = '';
  }

  // Duration (min for calendar)
  document.getElementById('t-duration-min').value = g?.duration_min || 25;

  // Timer duration
  if (g?.duration) {
    const dur = g.duration;
    document.getElementById('t-days').value    = Math.floor(dur / 86400);
    document.getElementById('t-hours').value   = Math.floor((dur % 86400) / 3600);
    document.getElementById('t-minutes').value = Math.floor((dur % 3600) / 60);
    document.getElementById('t-seconds').value = Math.floor(dur % 60);
  } else {
    document.getElementById('t-days').value = 0;
    document.getElementById('t-hours').value = 0;
    document.getElementById('t-minutes').value = 25;
    document.getElementById('t-seconds').value = 0;
  }

  // Quick pills
  const qr = document.getElementById('task-quick-pills'); qr.innerHTML = '';
  QUICK_DURATIONS.forEach(([d,h,m,s,l]) => {
    const b = mkEl('button', 'quick-pill', l);
    b.addEventListener('click', () => {
      document.getElementById('t-days').value = d;
      document.getElementById('t-hours').value = h;
      document.getElementById('t-minutes').value = m;
      document.getElementById('t-seconds').value = s;
    });
    qr.appendChild(b);
  });

  // Color picker
  selectedColor = g?.color || COLOR_PALETTE[0];
  renderColorPalette('task-color-palette', selectedColor, (c) => { selectedColor = c; });

  // Tags picker
  selectedTags = [...(g?.tags || [])];
  renderTagsPicker('task-tags-picker', selectedTags);

  // Reminders
  selectedReminders = [...(g?.reminders || [])];
  renderReminderChips();

  // Participants
  participants = [...(g?.participants || [])];
  renderParticipantsList();

  // Subtasks
  const stList = document.getElementById('subtask-input-list'); stList.innerHTML = '';
  (g?.subtasks || []).forEach(st => addSubtaskInputRow(st.title));

  openModal('modal-task');
  setTimeout(() => document.getElementById('t-title').focus(), 100);
}

function renderColorPalette(containerId, currentColor, onSelect) {
  const container = document.getElementById(containerId); if (!container) return;
  container.innerHTML = '';
  COLOR_PALETTE.forEach(c => {
    const sw = mkEl('div', `color-swatch${c === currentColor ? ' selected' : ''}`);
    sw.style.background = c;
    sw.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      onSelect(c);
    });
    container.appendChild(sw);
  });
}
function renderTagsPicker(containerId, currentSelected) {
  const container = document.getElementById(containerId); if (!container) return;
  container.innerHTML = '';
  tags.forEach(t => {
    const chip = mkEl('button', `tag-pick-chip${currentSelected.includes(t.id) ? ' selected' : ''}`);
    chip.textContent = t.name;
    chip.style.color = currentSelected.includes(t.id) ? '#fff' : t.color;
    chip.style.borderColor = currentSelected.includes(t.id) ? t.color : t.color + '55';
    chip.style.background = currentSelected.includes(t.id) ? t.color : t.color + '18';
    chip.addEventListener('click', () => {
      if (currentSelected.includes(t.id)) { currentSelected.splice(currentSelected.indexOf(t.id), 1); }
      else { currentSelected.push(t.id); }
      renderTagsPicker(containerId, currentSelected);
    });
    container.appendChild(chip);
  });
  const newBtn = mkEl('button', 'tag-pick-new', '+ тег');
  newBtn.addEventListener('click', () => openInlineTagForm(container, newBtn, currentSelected));
  container.appendChild(newBtn);
}
function openInlineTagForm(container, anchorBtn, currentSelected) {
  if (container.querySelector('.tag-inline-form')) return;
  let chosenColor = TAG_PALETTE[tags.length % TAG_PALETTE.length];
  const form = mkEl('div', 'tag-inline-form');
  form.innerHTML = `<input type="text" placeholder="Тег" maxlength="16"><div class="color-swatch" style="background:${chosenColor};border-color:#fff;width:18px;height:18px"></div><button type="button" style="color:var(--green);font-size:18px;background:none;border:none;cursor:pointer">✓</button>`;
  const inp = form.querySelector('input');
  const sw  = form.querySelector('.color-swatch');
  sw.addEventListener('click', () => {
    const idx = (TAG_PALETTE.indexOf(chosenColor) + 1) % TAG_PALETTE.length;
    chosenColor = TAG_PALETTE[idx]; sw.style.background = chosenColor;
  });
  const confirm_ = () => {
    const name = inp.value.trim(); if (!name) { form.remove(); return; }
    const newTag = { id:'tag_'+Date.now().toString(36)+rnd(), name, color: chosenColor };
    tags.push(newTag); currentSelected.push(newTag.id); saveAll();
    form.remove(); anchorBtn.remove();
    renderTagsPicker(form.parentElement?.id || 'task-tags-picker', currentSelected);
  };
  form.querySelector('button').addEventListener('click', confirm_);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirm_(); } });
  anchorBtn.insertAdjacentElement('beforebegin', form);
  inp.focus();
}
function renderReminderChips() {
  document.querySelectorAll('.reminder-chip').forEach(chip => {
    const mins = parseInt(chip.dataset.mins);
    chip.classList.toggle('active', selectedReminders.includes(mins));
    chip.onclick = () => {
      if (selectedReminders.includes(mins)) selectedReminders.splice(selectedReminders.indexOf(mins), 1);
      else selectedReminders.push(mins);
      renderReminderChips();
    };
  });
}
function renderParticipantsList() {
  const el = document.getElementById('participants-list'); if (!el) return;
  el.innerHTML = '';
  participants.forEach((p, i) => {
    const chip = mkEl('div', 'participant-chip');
    chip.innerHTML = `👤 ${esc(p)} <button class="participant-remove" data-idx="${i}">×</button>`;
    chip.querySelector('.participant-remove').addEventListener('click', () => { participants.splice(i, 1); renderParticipantsList(); });
    el.appendChild(chip);
  });
}
function addSubtaskInputRow(value = '') {
  const list = document.getElementById('subtask-input-list');
  const row = mkEl('div', 'subtask-input-row');
  const inp = mkEl('input', 'form-input');
  inp.type = 'text'; inp.placeholder = 'Подзадача...'; inp.value = value;
  const rm = mkEl('button', 'st-remove-btn', '×');
  rm.type = 'button'; rm.addEventListener('click', () => row.remove());
  row.appendChild(inp); row.appendChild(rm); list.appendChild(row);
  return inp;
}

// Save task
document.getElementById('btn-save-task')?.addEventListener('click', () => {
  const title = document.getElementById('t-title').value.trim();
  if (!title) { document.getElementById('t-title').style.borderColor = 'var(--red)'; return; }
  document.getElementById('t-title').style.borderColor = '';

  const scheduled = document.getElementById('t-scheduled').value;
  const dur_min   = parseInt(document.getElementById('t-duration-min').value) || 25;
  const d = parseInt(document.getElementById('t-days').value) || 0;
  const h = parseInt(document.getElementById('t-hours').value) || 0;
  const m = parseInt(document.getElementById('t-minutes').value) || 0;
  const s = parseInt(document.getElementById('t-seconds').value) || 0;
  const duration = d*86400 + h*3600 + m*60 + s || 1500;
  const subtasks = Array.from(document.querySelectorAll('#subtask-input-list input'))
    .map(i => i.value.trim()).filter(Boolean).map(t => ({ title: t, done: false }));

  if (editingTaskId) {
    const g = goals.find(x => x.id === editingTaskId);
    if (g) {
      g.title        = title;
      g.cat          = document.getElementById('t-cat').value;
      g.priority     = document.getElementById('t-priority').value;
      g.scheduledAt  = scheduled ? new Date(scheduled).getTime() : null;
      g.duration_min = dur_min;
      g.duration     = duration;
      g.location     = document.getElementById('t-location').value.trim();
      g.travelTime   = parseInt(document.getElementById('t-travel-time').value) || 0;
      g.cost         = parseFloat(document.getElementById('t-cost').value) || 0;
      g.notes        = document.getElementById('t-notes').value.trim();
      g.color        = selectedColor;
      g.tags         = [...selectedTags];
      g.reminders    = [...selectedReminders];
      g.participants = [...participants];
      g.subtasks     = subtasks.length ? subtasks : g.subtasks;
    }
  } else {
    const goal = {
      id: Date.now().toString(36) + rnd(),
      title, cat: document.getElementById('t-cat').value,
      priority: document.getElementById('t-priority').value,
      scheduledAt: scheduled ? new Date(scheduled).getTime() : null,
      duration_min: dur_min, duration,
      location: document.getElementById('t-location').value.trim(),
      travelTime: parseInt(document.getElementById('t-travel-time').value) || 0,
      cost: parseFloat(document.getElementById('t-cost').value) || 0,
      notes: document.getElementById('t-notes').value.trim(),
      color: selectedColor, tags: [...selectedTags], reminders: [...selectedReminders],
      participants: [...participants], subtasks,
      elapsed: 0, startTime: null, paused: false, done: false, createdAt: Date.now()
    };
    goals.push(goal);
    if (!activeTaskId) activeTaskId = goal.id;
  }
  saveAll(); rescheduleAllReminders();
  closeModal('modal-task');
  renderTaskList();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'timer') { renderTimerGoalSelector(); tickDisplay(); }
});

// Participants add
document.getElementById('add-participant-btn')?.addEventListener('click', () => {
  const inp = document.getElementById('t-participant-input');
  const name = inp.value.trim(); if (!name) return;
  participants.push(name); inp.value = '';
  renderParticipantsList();
});
document.getElementById('t-participant-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('add-participant-btn').click(); }
});
// Subtask add button
document.getElementById('add-subtask-btn')?.addEventListener('click', () => {
  const inp = addSubtaskInputRow(); inp.focus();
});

/* ═══════════════════════════════════════════════════════════
   CALENDAR VIEW
═══════════════════════════════════════════════════════════ */
function renderCalendar() {
  renderCalNav();
  if (calView === 'month') renderMonthView();
  else if (calView === 'week') renderWeekView();
  else if (calView === 'day') renderDayView();
}

function renderCalNav() {
  const el = document.getElementById('cal-nav-title'); if (!el) return;
  if (calView === 'month') {
    el.textContent = calDate.toLocaleString('ru-RU', { month:'long', year:'numeric' }).toUpperCase();
  } else if (calView === 'week') {
    const mon = getWeekStart(calDate);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    el.textContent = `${mon.getDate()} — ${sun.getDate()} ${sun.toLocaleString('ru-RU',{month:'short',year:'numeric'})}`;
  } else {
    el.textContent = calDate.toLocaleString('ru-RU', { day:'numeric', month:'long', weekday:'long' });
  }
  document.getElementById('cal-title').textContent = 'Календарь';
  document.querySelectorAll('.cal-vs-btn').forEach(b => b.classList.toggle('active', b.dataset.calview === calView));
}

// Month
function renderMonthView() {
  document.getElementById('cal-month-view').style.display = '';
  document.getElementById('cal-week-view').style.display  = 'none';
  document.getElementById('cal-day-view').style.display   = 'none';
  document.getElementById('cal-day-events-panel').style.display = 'none';

  const grid = document.getElementById('cal-grid'); grid.innerHTML = '';
  const y = calDate.getFullYear(), mo = calDate.getMonth();
  const firstDay = new Date(y, mo, 1).getDay();
  const shift = firstDay === 0 ? 6 : firstDay - 1;
  const days = new Date(y, mo+1, 0).getDate();

  for (let i = 0; i < shift; i++) grid.appendChild(mkEl('div', 'cal-cell empty'));

  for (let d = 1; d <= days; d++) {
    const dk = `${y}-${pad(mo+1)}-${pad(d)}`;
    const isToday = dk === dateKey();
    const isSelected = calSelectedDay === dk;
    const cell = mkEl('div', `cal-cell${isToday?' today':''}${isSelected?' selected':''}`);

    // Events for this day
    const dayGoals = goals.filter(g => g.scheduledAt && dateKey(g.scheduledAt) === dk);
    const dayHistory = history.filter(h => dateKey(h.completedAt) === dk);

    let dotsHtml = '';
    const shown = dayGoals.slice(0,4);
    shown.forEach(g => {
      dotsHtml += `<div class="cal-dot" style="background:${catColor(g)}"></div>`;
    });
    if (dayGoals.length > 4) dotsHtml += `<span style="font-size:7px;color:var(--text3)">+${dayGoals.length-4}</span>`;
    if (dayHistory.length && !dayGoals.length) dotsHtml += `<div class="cal-dot" style="background:var(--green)"></div>`;

    cell.innerHTML = `<div class="cal-date">${d}</div><div class="cal-dots">${dotsHtml}</div>`;
    cell.addEventListener('click', () => {
      calSelectedDay = dk;
      renderMonthView();
      showCalDayPanel(dk, dayGoals, dayHistory);
    });
    grid.appendChild(cell);
  }
}

function showCalDayPanel(dk, dayGoals, dayHistory) {
  const panel = document.getElementById('cal-day-events-panel');
  const titleEl = document.getElementById('cal-dep-title');
  const listEl  = document.getElementById('cal-dep-list');
  const d = new Date(dk);
  titleEl.textContent = d.toLocaleString('ru-RU', { weekday:'long', day:'numeric', month:'long' });
  listEl.innerHTML = '';

  if (!dayGoals.length && !dayHistory.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">Нет событий</div>';
  }
  dayGoals.forEach(g => {
    const item = mkEl('div', 'cal-dep-item');
    item.innerHTML = `<div class="cal-dep-dot" style="background:${catColor(g)}"></div><div class="cal-dep-info"><div class="cal-dep-name">${esc(g.title)}</div><div class="cal-dep-time">${g.scheduledAt ? fmtTime(g.scheduledAt) : ''} · ${g.duration_min}м</div></div>`;
    item.addEventListener('click', () => openTaskDetail(g.id));
    listEl.appendChild(item);
  });
  dayHistory.forEach(h => {
    const c = CATS[h.cat] || CATS.business;
    const item = mkEl('div', 'cal-dep-item');
    item.innerHTML = `<div class="cal-dep-dot" style="background:${c.color}"></div><div class="cal-dep-info"><div class="cal-dep-name">✓ ${esc(h.title)}</div><div class="cal-dep-time">Выполнено</div></div>`;
    listEl.appendChild(item);
  });
  panel.style.display = '';
}

// Week
function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}
function renderWeekView() {
  document.getElementById('cal-month-view').style.display = 'none';
  document.getElementById('cal-week-view').style.display  = '';
  document.getElementById('cal-day-view').style.display   = 'none';
  document.getElementById('cal-day-events-panel').style.display = 'none';

  const mon = getWeekStart(calDate);
  const days = Array.from({length:7}, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate()+i); return d; });
  const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  // Header
  const header = document.getElementById('cal-week-header');
  header.style.gridTemplateColumns = `repeat(7,1fr)`;
  header.innerHTML = '';
  days.forEach((d, i) => {
    const isToday = dateKey(d) === dateKey();
    const hdr = mkEl('div', `cal-week-day-hdr${isToday?' today':''}`);
    hdr.innerHTML = `<div>${DAY_NAMES[i]}</div><div class="cal-week-day-num${isToday?' today':''}">${d.getDate()}</div>`;
    hdr.addEventListener('click', () => { calDate = new Date(d); calView = 'day'; renderCalendar(); });
    header.appendChild(hdr);
  });

  // Body
  const timecol = document.getElementById('cal-time-col'); timecol.innerHTML = '';
  const cols    = document.getElementById('cal-week-cols');
  cols.style.gridTemplateColumns = `repeat(7,1fr)`;
  cols.innerHTML = '';

  for (let h = 0; h < 24; h++) {
    const lbl = mkEl('div', 'cal-hour-label', h === 0 ? '' : `${pad(h)}:00`);
    timecol.appendChild(lbl);
  }

  days.forEach(d => {
    const col = mkEl('div', 'cal-week-col');
    for (let h = 0; h < 24; h++) col.appendChild(mkEl('div', 'cal-hour-row'));

    // Events
    const dk = dateKey(d);
    const dayGoals = goals.filter(g => g.scheduledAt && dateKey(g.scheduledAt) === dk);
    dayGoals.forEach(g => {
      if (!g.scheduledAt) return;
      const startH = new Date(g.scheduledAt).getHours() + new Date(g.scheduledAt).getMinutes() / 60;
      const durH   = (g.duration_min || 25) / 60;
      const top    = startH * 60; const height = Math.max(durH * 60, 24);
      const color  = catColor(g);

      if (g.travelTime) {
        const tvBlock = mkEl('div', 'cal-travel-block');
        tvBlock.style.cssText = `top:${top - (g.travelTime)}px;height:${g.travelTime}px;opacity:.6`;
        col.appendChild(tvBlock);
      }
      const evBlock = mkEl('div', 'cal-event-block');
      evBlock.style.cssText = `top:${top}px;height:${height}px;background:${color}cc`;
      evBlock.innerHTML = `<div class="ev-title">${esc(g.title)}</div><div class="ev-time">${fmtTime(g.scheduledAt)}</div>`;
      evBlock.addEventListener('click', () => openTaskDetail(g.id));
      col.appendChild(evBlock);
    });

    cols.appendChild(col);
  });

  // Scroll to current time
  const now = new Date(); const pxFromTop = (now.getHours() * 60 + now.getMinutes());
  setTimeout(() => { const body = document.querySelector('.cal-week-body'); if (body) body.scrollTop = Math.max(0, pxFromTop - 120); }, 50);
}

// Day
function renderDayView() {
  document.getElementById('cal-month-view').style.display = 'none';
  document.getElementById('cal-week-view').style.display  = 'none';
  document.getElementById('cal-day-view').style.display   = '';
  document.getElementById('cal-day-events-panel').style.display = 'none';

  const dateEl = document.getElementById('cal-day-date');
  dateEl.textContent = calDate.toLocaleString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const timecol = document.getElementById('cal-day-time-col'); timecol.innerHTML = '';
  const events  = document.getElementById('cal-day-events');   events.innerHTML  = '';

  for (let h = 0; h < 24; h++) {
    timecol.appendChild(mkEl('div', 'cal-hour-label', h === 0 ? '' : `${pad(h)}:00`));
    events.appendChild(mkEl('div', 'cal-hour-row'));
  }

  const dk = dateKey(calDate);
  const dayGoals = goals.filter(g => g.scheduledAt && dateKey(g.scheduledAt) === dk);

  dayGoals.forEach(g => {
    if (!g.scheduledAt) return;
    const startH = new Date(g.scheduledAt).getHours() + new Date(g.scheduledAt).getMinutes() / 60;
    const durH   = (g.duration_min || 25) / 60;
    const top    = startH * 60; const height = Math.max(durH * 60, 28);
    const color  = catColor(g);

    if (g.travelTime) {
      const tvBlock = mkEl('div', 'cal-travel-block');
      tvBlock.style.cssText = `top:${top - g.travelTime}px;height:${g.travelTime}px`;
      events.appendChild(tvBlock);
    }
    const evBlock = mkEl('div', 'cal-event-block');
    evBlock.style.cssText = `top:${top}px;height:${height}px;background:${color}dd;left:6px;right:6px`;
    evBlock.innerHTML = `<div class="ev-title">${esc(g.title)}</div><div class="ev-time">${fmtTime(g.scheduledAt)} · ${g.duration_min}м${g.location?' · 📍'+esc(g.location.substring(0,16)):''}</div>`;
    evBlock.addEventListener('click', () => openTaskDetail(g.id));
    events.appendChild(evBlock);
  });

  // Current time line
  const now = new Date();
  if (dateKey(now) === dk) {
    const pxFromTop = now.getHours() * 60 + now.getMinutes();
    const nowLine = buildNowLine();
    nowLine.style.cssText = `position:absolute;top:${pxFromTop}px;left:0;right:0;z-index:5;display:flex;align-items:center;pointer-events:none`;
    events.appendChild(nowLine);
    setTimeout(() => { const body = document.querySelector('.cal-day-body'); if (body) body.scrollTop = Math.max(0, pxFromTop - 120); }, 50);
  }
}

// Calendar nav events
document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
  if (calView === 'month') calDate.setMonth(calDate.getMonth() - 1);
  else if (calView === 'week') calDate.setDate(calDate.getDate() - 7);
  else calDate.setDate(calDate.getDate() - 1);
  calDate = new Date(calDate);
  renderCalendar();
});
document.getElementById('cal-next-btn')?.addEventListener('click', () => {
  if (calView === 'month') calDate.setMonth(calDate.getMonth() + 1);
  else if (calView === 'week') calDate.setDate(calDate.getDate() + 7);
  else calDate.setDate(calDate.getDate() + 1);
  calDate = new Date(calDate);
  renderCalendar();
});
document.getElementById('cal-today-btn')?.addEventListener('click', () => {
  calDate = new Date(); renderCalendar();
});
document.querySelectorAll('.cal-vs-btn').forEach(btn => {
  btn.addEventListener('click', () => { calView = btn.dataset.calview; renderCalendar(); });
});

/* ═══════════════════════════════════════════════════════════
   PROFILE VIEW
═══════════════════════════════════════════════════════════ */
function renderProfile() {
  renderProfileHero();
  renderProfileStats();
  renderStreakCard();
  renderMacroList();
  renderHistoryMini();
  renderStoreGrid();
}

function renderProfileHero() {
  const lv = getLevel(gems);
  document.getElementById('profile-gem-count').textContent = gems;
  document.getElementById('profile-level').textContent = `${lv.emoji} ${lv.label}`;
  document.getElementById('profile-avatar').textContent = lv.emoji;
}

function renderProfileStats() {
  const el = document.getElementById('profile-stats-row'); if (!el) return;
  const todayKey = dateKey();
  const todayDone = history.filter(h => dateKey(h.completedAt) === todayKey).length;
  const totalDone = goals.filter(g => g.done).length;
  const stats = [
    { val: history.length, label: 'Завершено' },
    { val: todayDone,      label: 'Сегодня' },
    { val: streak.days,    label: '🔥 Серия' },
  ];
  el.innerHTML = stats.map(s => `<div class="profile-stat-card"><div class="psc-val">${s.val}</div><div class="psc-label">${s.label}</div></div>`).join('');
}

function renderStreakCard() {
  const el = document.getElementById('streak-display-card'); if (!el) return;
  const todayKey = dateKey();
  const todayDone = history.filter(h => dateKey(h.completedAt) === todayKey).length;
  const isActive = streak.doneToday;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:32px">${isActive ? '🔥' : '💤'}</span>
      <div>
        <div style="font-size:20px;font-weight:800;color:${isActive?'var(--fire)':'var(--text2)'}">${streak.days} дней подряд</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${isActive ? 'Огонёк горит! Не сдавайся' : 'Выполни задачу чтобы продолжить серию'}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:13px;font-weight:700;color:var(--gem2)">${gems} 💎</div>
        <div style="font-size:10px;color:var(--text3)">кристаллов</div>
      </div>
    </div>`;
}

function renderMacroList() {
  const el = document.getElementById('macro-list'); if (!el) return;
  el.innerHTML = '';
  if (!macroGoals.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Нет грандиозных целей</div>';
    return;
  }
  macroGoals.forEach(mg => {
    const card = mkEl('div', 'macro-card');
    const deadline = new Date(mg.deadline);
    const diff = deadline - new Date();
    let timerStr;
    if (diff < 0) timerStr = '<span style="color:var(--red)">Срок вышел</span>';
    else { const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000); timerStr = `${d}д ${pad(h)}ч`; }
    card.innerHTML = `<div class="macro-card-info"><div class="macro-title">${esc(mg.title)}</div><div class="macro-timer">${timerStr} · ${mg.reward} 💎</div></div><div class="macro-card-actions"><button class="macro-act-btn success" data-id="${mg.id}">Победа!</button><button class="macro-act-btn danger" data-id="${mg.id}">Провал</button></div>`;
    card.querySelector('.success').addEventListener('click', () => handleMacroSuccess(mg.id));
    card.querySelector('.danger').addEventListener('click', () => handleMacroFail(mg.id));
    el.appendChild(card);
  });
}

function handleMacroSuccess(id) {
  const mg = macroGoals.find(x => x.id === id); if (!mg) return;
  const reward = parseInt(mg.reward) || 10;
  gems += reward;
  history.push({ id: Date.now(), title: `[МАКРО ПРЫЖОК] ${mg.title}`, completedAt: Date.now(), type:'macro_success', cat:'business', gemAmount: reward });
  macroGoals = macroGoals.filter(x => x.id !== id);
  saveAll(); showPopup('milestone', '🏆', 'ГРАНДИОЗНАЯ ПОБЕДА!', `+${reward} 💎 начислено!`);
  renderProfile();
}
function handleMacroFail(id) {
  reflMacroId = id; openModal('modal-reflection');
}

document.getElementById('btn-save-reflection')?.addEventListener('click', () => {
  const mg = macroGoals.find(x => x.id === reflMacroId); if (!mg) return;
  const txt = document.getElementById('reflect-text').value;
  history.push({ id: Date.now(), title: `[ОПЫТ ПРОВАЛА] ${mg.title}`, completedAt: Date.now(), reflection: txt, type:'macro_fail', cat:'life' });
  macroGoals = macroGoals.filter(x => x.id !== reflMacroId);
  reflMacroId = null; saveAll(); closeModal('modal-reflection');
  renderProfile();
});

function renderHistoryMini() {
  const el = document.getElementById('history-list-mini'); if (!el) return;
  renderHistoryTagFilter('history-tag-filter');
  let sorted = [...history].reverse().filter(h => !histTagFilter || (h.tags||[]).includes(histTagFilter));
  el.innerHTML = '';
  if (!sorted.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Нет записей</div>'; return; }
  sorted.slice(0,8).forEach(h => el.appendChild(buildHistItem(h)));
}

function renderHistoryTagFilter(elId) {
  const el = document.getElementById(elId); if (!el) return;
  el.innerHTML = '';
  const allChip = mkEl('button', `history-tag-chip${histTagFilter===null?' active':''}`, 'Все');
  allChip.style.color = histTagFilter===null?'#fff':'var(--text3)';
  allChip.style.borderColor = histTagFilter===null?'var(--accent)':'var(--border2)';
  allChip.style.background = histTagFilter===null?'var(--accent)':'transparent';
  allChip.addEventListener('click', () => { histTagFilter=null; renderHistoryMini(); renderHistoryFull(); });
  el.appendChild(allChip);
  tags.forEach(t => {
    const chip = mkEl('button', `history-tag-chip${histTagFilter===t.id?' active':''}`, t.name);
    chip.style.color = t.color; chip.style.borderColor = histTagFilter===t.id?t.color:t.color+'55';
    chip.style.background = histTagFilter===t.id?t.color:t.color+'18';
    chip.addEventListener('click', () => { histTagFilter = histTagFilter===t.id?null:t.id; renderHistoryMini(); renderHistoryFull(); });
    el.appendChild(chip);
  });
}

function renderHistoryFull() {
  const el = document.getElementById('history-list-full'); if (!el) return;
  renderHistoryTagFilter('history-tag-filter-full');
  let sorted = [...history].reverse().filter(h => !histTagFilter || (h.tags||[]).includes(histTagFilter));
  el.innerHTML = '';
  if (!sorted.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Нет записей</div>'; return; }
  sorted.forEach(h => el.appendChild(buildHistItem(h)));
}

function buildHistItem(h) {
  const c = CATS[h.cat] || CATS.business;
  const color = c.color || 'var(--text3)';
  const gemInfo = h.type === 'timer' ? '+1 💎' : (h.type === 'manual' ? `+${h.gemAmount} 💎` : h.type==='macro_success'?`+${h.gemAmount} 💎`:'');
  const tagHtml = (h.tags||[]).slice(0,2).map(tid => { const t = getTag(tid); return t ? `<span class="task-tag" style="background:${t.color}22;color:${t.color}">${esc(t.name)}</span>`:'' }).join('');
  const row = mkEl('div', 'hist-item');
  row.innerHTML = `<div class="hist-dot" style="background:${color}"></div><div class="hist-info"><div class="hist-name">${esc(h.title)}</div><div class="hist-meta-row">${fmtRel(h.completedAt)} · ${c.label||'Достижение'}</div>${tagHtml?`<div class="hist-tags">${tagHtml}</div>`:''}</div><div class="hist-right"><div class="hist-gem-badge">${gemInfo}</div>${h.elapsed?`<div class="hist-gem-badge" style="color:var(--text3)">${fmtD(h.elapsed)}</div>`:''}<div class="hist-status-badge" style="background:${h.overdue?'rgba(255,69,58,.1)':'rgba(48,209,88,.1)'};color:${h.overdue?'var(--red)':'var(--green)'}">${h.overdue?'С опоз.':'В срок'}</div><button class="hist-del-btn" title="Удалить">✕</button></div>`;
  row.querySelector('.hist-del-btn').addEventListener('click', () => deleteHistoryItem(h.id));
  return row;
}

function deleteHistoryItem(id) {
  const idx = history.findIndex(h => h.id === id); if (idx === -1) return;
  const item = history[idx]; history.splice(idx, 1);
  if (gems > 0 && item.type === 'timer') gems--;
  saveAll(); renderProfile();
  showPopup('gem', '↩️', 'Запись удалена', `«${item.title.substring(0,26)}»`);
}

/* ── STORE ── */
function renderStoreGrid() {
  const grid = document.getElementById('store-grid'); if (!grid) return;
  grid.innerHTML = '';

  const filtered = storeFilter === 'all' ? STORE_ITEMS : STORE_ITEMS.filter(i => i.cat === storeFilter);
  filtered.forEach(item => {
    const qty = storeDraft[item.id] || 1;
    const cost = qty * item.baseCost;
    const timeStr = `${item.baseTime * qty} ${item.unit}`;
    const card = mkEl('div', 'store-card');
    card.innerHTML = `<div class="store-icon">${item.icon}</div><div class="store-card-title">${item.title}</div><div class="store-card-desc">${item.desc}</div><div class="store-controls"><button class="store-qty-btn" data-id="${item.id}" data-dir="-1" ${qty<=1?'disabled':''}>-</button><div class="store-qty-info"><div class="store-qty-time">${timeStr}</div><div class="store-qty-cost">${cost} 💎</div></div><button class="store-qty-btn" data-id="${item.id}" data-dir="1">+</button></div><button class="store-add-btn" data-id="${item.id}">+ В корзину</button>`;
    card.querySelectorAll('.store-qty-btn').forEach(btn => {
      btn.addEventListener('click', () => { const delta = parseInt(btn.dataset.dir); if((storeDraft[item.id]||1)+delta >= 1) { storeDraft[item.id] = (storeDraft[item.id]||1)+delta; renderStoreGrid(); } });
    });
    card.querySelector('.store-add-btn').addEventListener('click', () => {
      cart.push({ id: Date.now()+Math.random(), item, qty, cost: item.baseCost*qty, timeStr });
      storeDraft[item.id] = 1; renderStoreGrid(); updateCartBadge();
      showPopup('gem', '🛒', 'Добавлено в корзину', `${item.title} (${qty})`);
    });
    grid.appendChild(card);
  });
}
function updateCartBadge() {
  const b = document.getElementById('cart-badge'); if (!b) return;
  b.textContent = cart.length; cart.length > 0 ? b.classList.add('show') : b.classList.remove('show');
}
function renderCartModal() {
  const list = document.getElementById('cart-list'); list.innerHTML = ''; let total = 0;
  cart.forEach((c, idx) => {
    total += c.cost;
    const el = mkEl('div', 'cart-item');
    el.innerHTML = `<div class="cart-item-icon">${c.item.icon}</div><div class="cart-item-info"><div class="cart-item-name">${c.item.title}</div><div class="cart-item-sub">${c.timeStr} · ${c.cost} 💎</div></div><button class="cart-item-del">×</button>`;
    el.querySelector('.cart-item-del').addEventListener('click', () => { cart.splice(idx,1); updateCartBadge(); renderCartModal(); });
    list.appendChild(el);
  });
  const totalEl = document.getElementById('cart-total-display'); if (totalEl) totalEl.textContent = total + ' 💎';
  const btn = document.getElementById('btn-checkout'); if (!btn) return;
  if (!cart.length) { btn.textContent='Корзина пуста'; btn.disabled=true; btn.style.opacity=.5; }
  else if (gems < total) { btn.textContent='Не хватает 💎'; btn.disabled=true; btn.style.opacity=.5; }
  else { btn.textContent='Оплатить всё'; btn.disabled=false; btn.style.opacity=1; }
}
document.getElementById('btn-checkout')?.addEventListener('click', () => {
  const total = cart.reduce((s,c) => s+c.cost, 0);
  if (gems >= total && cart.length > 0) {
    gems -= total;
    purchases.push({ id: Date.now(), date: Date.now(), items:[...cart], totalCost: total });
    cart=[]; saveAll(); updateCartBadge(); closeModal('modal-cart');
    renderProfile(); showPopup('gem', '🛍️', 'Покупка успешна!', `Потрачено ${total} 💎. Хорошего отдыха!`);
  }
});
function renderPurchases() {
  const el = document.getElementById('purchases-list'); if (!el) return;
  el.innerHTML = '';
  if (!purchases.length) { el.innerHTML='<div style="color:var(--text3)">Пока нет покупок</div>'; return; }
  purchases.slice().reverse().forEach(p => {
    const rec = mkEl('div', 'purchase-record');
    const d = new Date(p.date).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    rec.innerHTML = `<div class="purchase-record-header"><span>${d}</span><span style="color:var(--red)">-${p.totalCost} 💎</span></div><div class="purchase-record-items">${p.items.map(i=>`${i.item.icon} ${i.item.title} (${i.timeStr})`).join('<br>')}</div>`;
    el.appendChild(rec);
  });
}

// Store filter chips
document.getElementById('store-filter-row')?.addEventListener('click', e => {
  const btn = e.target.closest('.store-chip'); if (!btn) return;
  document.querySelectorAll('.store-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); storeFilter = btn.dataset.cat; renderStoreGrid();
});

/* ── GEM BANK ── */
document.getElementById('btn-open-gem-bank')?.addEventListener('click', () => openModal('modal-gem-bank'));
document.getElementById('btn-save-gem')?.addEventListener('click', () => {
  const val = parseInt(document.getElementById('gem-amount').value) || 1;
  const desc = document.getElementById('gem-desc').value.trim(); if (!desc) return;
  gems += val;
  history.push({ id: Date.now(), title: `Достижение: ${desc}`, completedAt: Date.now(), type:'manual', gemAmount: val });
  saveAll(); closeModal('modal-gem-bank'); renderProfile();
  showPopup('gem', '✨', `+${val} 💎 начислено`, desc);
});
document.getElementById('btn-charity')?.addEventListener('click', () => {
  if (confirm('Ты действительно сделал перевод на доброе дело?')) {
    gems += 1;
    history.push({ id: Date.now(), title:'Донат на благотворительность (20 MDL)', completedAt: Date.now(), type:'donation', cat:'life' });
    saveAll(); showPopup('gem','🍀','Кристалл за добро','Мир стал чуть лучше'); renderProfile();
  }
});

/* ── MACRO GOALS ── */
document.getElementById('btn-add-macro')?.addEventListener('click', () => openModal('modal-macro'));
document.getElementById('btn-save-macro')?.addEventListener('click', () => {
  const title = document.getElementById('macro-title').value.trim();
  const deadline = document.getElementById('macro-deadline').value;
  const reward   = document.getElementById('macro-reward').value;
  if (!title || !deadline) return;
  macroGoals.push({ id:'macro_'+Date.now().toString(36)+rnd(), title, deadline, reward });
  saveAll(); closeModal('modal-macro'); renderProfile();
});

/* ── HISTORY ── */
document.getElementById('btn-view-history')?.addEventListener('click', () => { renderHistoryFull(); openModal('modal-history'); });
document.getElementById('btn-view-cart')?.addEventListener('click', () => { renderCartModal(); openModal('modal-cart'); });
document.getElementById('btn-view-purchases')?.addEventListener('click', () => { renderPurchases(); openModal('modal-purchases'); });

/* ═══════════════════════════════════════════════════════════
   TIMER VIEW SETUP
═══════════════════════════════════════════════════════════ */
// Timer mode buttons
document.querySelectorAll('.timer-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    timerMode = btn.dataset.mode;
    cancelAnimationFrame(rafId); rafId = null;
    document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Show/hide pomo settings & status
    document.getElementById('pomodoro-status').style.display = timerMode === 'pomodoro' ? '' : 'none';
    document.getElementById('pomo-settings').style.display   = timerMode === 'pomodoro' ? '' : 'none';
    if (timerMode === 'pomodoro') renderPomodoroCycles();
    updateTimerControls(); tickDisplay();
  });
});

// Timer goal picker
document.getElementById('tgs-change-btn')?.addEventListener('click', () => openGoalPicker());
function openGoalPicker() {
  const el = document.getElementById('goal-picker-list'); el.innerHTML = '';
  goals.filter(g => !g.done).forEach(g => {
    const color = catColor(g), c = CATS[g.cat] || CATS.business;
    const item = mkEl('div', 'goal-pick-item');
    item.innerHTML = `<div class="goal-pick-dot" style="background:${color}"></div><div class="goal-pick-info"><div class="goal-pick-name">${esc(g.title)}</div><div class="goal-pick-meta">${c.label} · ${fmtD(g.duration)}</div></div>${activeTaskId===g.id?'<div class="goal-pick-check">✓</div>':''}`;
    item.addEventListener('click', () => {
      activeTaskId = g.id; closeModal('modal-goal-picker');
      renderTimerGoalSelector(); updateTimerControls(); tickDisplay();
    });
    el.appendChild(item);
  });
  if (!goals.filter(g=>!g.done).length) el.innerHTML = '<div style="color:var(--text3);font-size:13px">Нет активных задач</div>';
  openModal('modal-goal-picker');
}

// Pomodoro adjust buttons
document.querySelectorAll('.pomo-adj-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const field = btn.dataset.field, dir = parseInt(btn.dataset.dir);
    const limits = { work:[5,90], short:[1,30], long:[5,60] };
    const [min,max] = limits[field];
    pomoConfig[field] = Math.min(max, Math.max(min, pomoConfig[field] + dir));
    document.getElementById(`pomo-${field}-val`).textContent = pomoConfig[field];
    saveAll(); tickDisplay();
  });
});

// Focus fullscreen
document.getElementById('btn-focus-fullscreen')?.addEventListener('click', () => {
  document.getElementById('focus-overlay').classList.add('show');
  updateTimerControls(); tickDisplay();
});
document.getElementById('focus-exit-btn')?.addEventListener('click', () => {
  document.getElementById('focus-overlay').classList.remove('show');
});

/* ═══════════════════════════════════════════════════════════
   VOICE / AI MODAL
═══════════════════════════════════════════════════════════ */
document.getElementById('di-create-btn')?.addEventListener('click', () => {
  resetVoiceModal(); openModal('modal-voice');
});

function resetVoiceModal() {
  showVoiceState('idle');
  document.getElementById('voice-text-input').value = '';
  document.getElementById('voice-transcript').textContent = 'Слушаю...';
}

function showVoiceState(state) {
  ['idle','recording','processing'].forEach(s => {
    document.getElementById(`voice-state-${s}`).style.display = s === state ? '' : 'none';
  });
}

let recognition = null;
let voiceFullTranscript = '';

// Voice orb click
document.getElementById('voice-orb')?.addEventListener('click', () => startVoiceRecording());
document.getElementById('btn-voice-stop')?.addEventListener('click', () => stopVoiceRecording());
document.getElementById('btn-voice-parse-text')?.addEventListener('click', () => {
  const text = document.getElementById('voice-text-input').value.trim();
  if (!text) return;
  showVoiceState('processing');
  processVoiceText(text);
});

function startVoiceRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Голосовой ввод не поддерживается в вашем браузере. Используйте текстовый ввод.'); return; }
  recognition = new SR();
  recognition.lang = 'ru-RU'; recognition.continuous = true; recognition.interimResults = true;
  voiceFullTranscript = '';
  showVoiceState('recording');
  document.getElementById('voice-orb').classList.add('recording');
  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) voiceFullTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('voice-transcript').textContent = (voiceFullTranscript + interim) || 'Слушаю...';
    // Keyword: cancel
    if ((voiceFullTranscript + interim).toLowerCase().includes('отмена')) { stopVoiceRecording(true); }
  };
  recognition.onerror = () => stopVoiceRecording(false);
  recognition.onend = () => {
    if (voiceFullTranscript.trim()) { showVoiceState('processing'); processVoiceText(voiceFullTranscript.trim()); }
    else showVoiceState('idle');
  };
  recognition.start();
}

function stopVoiceRecording(cancel = false) {
  if (recognition) { try { recognition.stop(); } catch(e) {} recognition = null; }
  document.getElementById('voice-orb').classList.remove('recording');
  if (cancel) { voiceFullTranscript = ''; showVoiceState('idle'); closeModal('modal-voice'); }
}

async function processVoiceText(text) {
  showVoiceState('processing');
  let draft;
  const apiKey = localStorage.getItem('цель-openai-key') || document.getElementById('voice-api-key')?.value || document.getElementById('settings-api-key')?.value;
  if (apiKey && apiKey.startsWith('sk-')) {
    draft = await callOpenAI(text, apiKey);
  } else {
    draft = localParseTask(text);
  }
  voiceDraft = draft;
  closeModal('modal-voice');
  openDraftModal(draft);
}

/* ── Mock OpenAI Call (replace with real call when API key provided) ── */
async function callOpenAI(text, apiKey) {
  const prompt = `Ты — ИИ-ассистент планировщика. Пользователь произнёс: "${text}".
Разбери эту фразу и верни ТОЛЬКО валидный JSON объект без markdown, со следующими полями:
{
  "title": "название задачи",
  "cat": "business|life|study|health|creative",
  "priority": "high|mid|low",
  "scheduledAt": "ISO datetime или null",
  "duration_min": число минут или 25,
  "location": "место или ''",
  "travelTime": число минут или 0,
  "participants": ["имена"] или [],
  "reminders": [минуты до события] или [],
  "notes": "заметки или ''"
}
Сегодня: ${new Date().toLocaleString('ru-RU')}. Ответь только JSON.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model:'gpt-4o-mini', messages:[{role:'user',content:prompt}], max_tokens:300, temperature:.2 })
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const jsonStr = data.choices[0].message.content.trim().replace(/```json?|```/g,'');
    return JSON.parse(jsonStr);
  } catch(e) {
    console.warn('OpenAI error, falling back to local parser:', e);
    return localParseTask(text);
  }
}

/* ═══════════════════════════════════════════════════════════
   LOCAL NLP PARSER v2 (Russian regex)
   Supports: time, duration, travel, reminders, participants,
   location, priority, category, day-of-week, cost
═══════════════════════════════════════════════════════════ */
function localParseTask(text) {
  const now = new Date();
  const t = text; // short alias

  const draft = {
    title: text, cat: 'business', priority: 'mid',
    scheduledAt: null, duration_min: 25,
    location: '', travelTime: 0, participants: [], reminders: [],
    cost: 0, notes: ''
  };

  // ── 1. EXACT TIME  "в 18:30"  or  "в 18" / "в 6 часов"
  const exactTimePat = /\bв\s+(\d{1,2}):(\d{2})\b/i;
  const hourOnlyPat  = /\bв\s+(\d{1,2})\s*(?:час(?:ов|а)?|ч)\b/i;
  let exactM = t.match(exactTimePat) || t.match(hourOnlyPat);
  if (exactM) {
    const h = parseInt(exactM[1]);
    const m = exactM[2] ? parseInt(exactM[2]) : 0;
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    draft.scheduledAt = d.getTime();
  }

  // ── 2. RELATIVE DAY
  const dayMap = { 'завтра':1, 'послезавтра':2 };
  for (const [word, offset] of Object.entries(dayMap)) {
    if (new RegExp(word, 'i').test(t)) {
      const base = new Date(now);
      base.setDate(base.getDate() + offset);
      if (draft.scheduledAt) {
        const sc = new Date(draft.scheduledAt);
        sc.setFullYear(base.getFullYear(), base.getMonth(), base.getDate());
        draft.scheduledAt = sc.getTime();
      } else {
        base.setHours(12, 0, 0, 0);
        draft.scheduledAt = base.getTime();
      }
      break;
    }
  }
  if (/\bсегодня\b/i.test(t) && !draft.scheduledAt) {
    draft.scheduledAt = now.getTime();
  }

  // ── 3. DAY OF WEEK  "в понедельник / в пятницу"
  const DOW_RU = ['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу'];
  DOW_RU.forEach((name, idx) => {
    if (new RegExp(`\\b(?:в\\s+)?${name}\\b`, 'i').test(t) && !draft.scheduledAt) {
      const today = now.getDay();
      let diff = idx - today;
      if (diff <= 0) diff += 7;
      const target = new Date(now);
      target.setDate(now.getDate() + diff);
      target.setHours(12, 0, 0, 0);
      draft.scheduledAt = target.getTime();
    }
  });

  // ── 4. DURATION  "на 2 часа"  /  "на 45 минут"  /  "на 1,5 часа"
  const durHPat = /\bна\s+(\d+(?:[.,]\d+)?)\s*(?:час(?:а|ов)?|ч(?!и|е))\b/i;
  const durMPat = /\bна\s+(\d+)\s*(?:минут|мин)\b/i;
  const durH = t.match(durHPat), durM = t.match(durMPat);
  if (durH) draft.duration_min = Math.round(parseFloat(durH[1].replace(',','.')) * 60);
  if (durM) draft.duration_min = parseInt(durM[1]);

  // ── 5. TRAVEL TIME  "дорога 30 мин" / "ехать 20 минут"
  const travelPat = /(?:дорог[аиу]|ехать|добираться)\s*(\d+)\s*(?:минут|мин|ч(?:ас(?:а|ов)?)?)/i;
  const travelM = t.match(travelPat);
  if (travelM) {
    const val = parseInt(travelM[1]);
    draft.travelTime = /ч(?:ас)?/i.test(travelM[0].replace(travelM[1],'')) ? val*60 : val;
  }

  // ── 6. REMINDERS  "напомни за 30 минут"  /  "напомни за час"
  const remPat = /(?:напомн[иь]|за)\s*(\d+)\s*(минут|мин|час(?:а|ов)?|ч)/gi;
  let rm;
  while ((rm = remPat.exec(t)) !== null) {
    const val = parseInt(rm[1]);
    const unit = rm[2].toLowerCase();
    draft.reminders.push(unit.startsWith('ч') ? val*60 : val);
  }
  // "за час" without number
  if (/\bза час\b/i.test(t) && !draft.reminders.length) draft.reminders.push(60);

  // ── 7. PARTICIPANTS  "с Алиной" / "с командой"
  const withPat = /\bс\s+([А-ЯЁA-Z][а-яёa-z]{1,})\b/g;
  let wp;
  while ((wp = withPat.exec(t)) !== null) {
    const exclude = ['утра','вечера','часов','половины'];
    if (!exclude.includes(wp[1].toLowerCase())) draft.participants.push(wp[1]);
  }

  // ── 8. LOCATION  "в офисе" / "в кафе Центр" / "на стадионе"
  const locationKeywords = 'офис[ае]?|кафе|ресторан[ае]?|спортзал[ае]?|парк[ае]?|центр[ае]?|зал[ае]?|библиотек[ае]|магазин[ае]?|аптек[ае]?';
  const locPat = new RegExp(`(?:в|на)\\s+((?:${locationKeywords})(?:\\s+[А-ЯЁA-Za-zа-яё]+)?)`, 'i');
  const locM = t.match(locPat);
  if (locM) draft.location = locM[1].trim();

  // ── 9. COST / BUDGET  "бюджет 500" / "стоит 300 MDL"
  const costPat = /(?:бюджет|стоит|цена)\s*(\d+)/i;
  const costM = t.match(costPat);
  if (costM) draft.cost = parseInt(costM[1]);

  // ── 10. PRIORITY  keywords
  if (/\b(?:важно|срочно|критично|asap|горит|очень важн)/i.test(t)) draft.priority = 'high';
  else if (/\b(?:когда будет время|не срочно|потом|низкий)/i.test(t)) draft.priority = 'low';

  // ── 11. CATEGORY detection
  const catMap = [
    ['health',   /\b(?:трениров|спорт|бег|зал|здоров|фитнес|пробежк|йог)/i],
    ['study',    /\b(?:учеб|курс|урок|лекц|книг|читать|изучить|обучен)/i],
    ['creative', /\b(?:твор|рисо|музык|писат|дизайн|видео|съемк|монтаж)/i],
    ['life',     /\b(?:семья|дом|дети|жена|муж|мама|папа|убрать|готовить|купить)/i],
    ['business', /\b(?:встреч|совещан|клиент|проект|бизнес|офис|контракт|зарплат)/i],
  ];
  for (const [cat, re] of catMap) { if (re.test(t)) { draft.cat = cat; break; } }

  // ── 12. CLEAN TITLE
  // Remove all parsed tokens from title
  const cleanPatterns = [
    /\bзавтра\b/gi, /\bсегодня\b/gi, /\bпослезавтра\b/gi,
    exactTimePat, hourOnlyPat, durHPat, durMPat, travelPat,
    /\bза\s+\d+\s*(?:минут|мин|час(?:а|ов)?|ч)\b/gi,
    /\bнапомн[иь]\s+за.{0,30}/gi,
    /\bбюджет\s+\d+/gi, /\bстоит\s+\d+/gi,
    /\bважно\b|\bсрочно\b|\bкритично\b/gi,
    /\b(?:добавь|создай|поставь|запланируй|запиши)\b/gi,
  ];
  let cleanTitle = t;
  cleanPatterns.forEach(p => { cleanTitle = cleanTitle.replace(p, ' '); });
  // Remove location string
  if (draft.location) cleanTitle = cleanTitle.replace(draft.location, '');
  // Remove participant names
  draft.participants.forEach(p => { cleanTitle = cleanTitle.replace(new RegExp('\\bс\\s+' + p + '\\b', 'i'), ''); });
  // Clean days of week
  DOW_RU.forEach(d => { cleanTitle = cleanTitle.replace(new RegExp('\\bв\\s+' + d + '\\b', 'gi'), ''); });

  draft.title = cleanTitle.trim().replace(/\s+/g, ' ').replace(/^[,;.\s-]+|[,;.\s-]+$/g, '').trim() || text;
  // Capitalize
  draft.title = draft.title.charAt(0).toUpperCase() + draft.title.slice(1);

  return draft;
}

/* ── Draft modal ── */
function openDraftModal(draft) {
  const container = document.getElementById('draft-form-container'); container.innerHTML = '';

  const makeField = (label, type, val, id) => {
    const g = mkEl('div', 'form-group');
    const l = mkEl('label', 'form-label', label); l.htmlFor = id;
    const inp = mkEl('input', 'form-input'); inp.type = type; inp.id = id; inp.value = val || '';
    g.appendChild(l); g.appendChild(inp); container.appendChild(g);
    return inp;
  };
  const makeSelect = (label, options, val, id) => {
    const g = mkEl('div', 'form-group');
    const l = mkEl('label', 'form-label', label); l.htmlFor = id;
    const sel = mkEl('select', 'form-select'); sel.id = id;
    options.forEach(([v,txt]) => { const o=mkEl('option','',txt); o.value=v; if(v===val) o.selected=true; sel.appendChild(o); });
    g.appendChild(l); g.appendChild(sel); container.appendChild(g); return sel;
  };

  const titleInp = makeField('Название', 'text', draft.title, 'draft-title');
  titleInp.style.fontWeight = '600'; titleInp.style.fontSize = '15px';
  makeSelect('Категория', Object.entries(CATS).map(([k,v])=>[k,`${v.emoji} ${v.label}`]), draft.cat, 'draft-cat');
  makeSelect('Приоритет', [['high','🔴 Высокий'],['mid','🟡 Средний'],['low','🟢 Низкий']], draft.priority, 'draft-priority');

  if (draft.scheduledAt) {
    const g = mkEl('div', 'form-group');
    const l = mkEl('label', 'form-label', 'Дата и время'); const inp = mkEl('input', 'form-input'); inp.type='datetime-local'; inp.id='draft-scheduled';
    const d=new Date(draft.scheduledAt); inp.value=d.toISOString().slice(0,16);
    g.appendChild(l); g.appendChild(inp); container.appendChild(g);
  }
  makeField('Длительность (мин)', 'number', draft.duration_min || 25, 'draft-duration');
  if (draft.location !== undefined)  makeField('📍 Место', 'text', draft.location, 'draft-location');
  if (draft.travelTime)  makeField('🚗 Время на дорогу (мин)', 'number', draft.travelTime, 'draft-travel');
  if (draft.participants?.length) {
    const g = mkEl('div', 'form-group');
    g.innerHTML = `<div class="form-label">👥 Участники</div><div style="color:var(--accent);font-size:13px">${draft.participants.map(esc).join(', ')}</div>`;
    container.appendChild(g);
  }
  if (draft.reminders?.length) {
    const g = mkEl('div', 'form-group');
    const labels = draft.reminders.map(m => m >= 60 ? `${m/60}ч` : `${m}м`);
    g.innerHTML = `<div class="form-label">🔔 Напоминания</div><div style="color:var(--orange);font-size:13px">${labels.join(', ')} до события</div>`;
    container.appendChild(g);
  }

  openModal('modal-draft');
}

document.getElementById('btn-draft-save')?.addEventListener('click', () => saveDraftTask(false));
document.getElementById('btn-draft-new')?.addEventListener('click', () => saveDraftTask(true));

function saveDraftTask(openNew) {
  const title = document.getElementById('draft-title')?.value.trim();
  if (!title) return;
  const schEl = document.getElementById('draft-scheduled');
  const goal = {
    id: Date.now().toString(36) + rnd(),
    title, cat: document.getElementById('draft-cat')?.value || 'business',
    priority: document.getElementById('draft-priority')?.value || 'mid',
    scheduledAt: schEl ? new Date(schEl.value).getTime() : (voiceDraft?.scheduledAt||null),
    duration_min: parseInt(document.getElementById('draft-duration')?.value) || 25,
    duration: (parseInt(document.getElementById('draft-duration')?.value) || 25) * 60,
    location: document.getElementById('draft-location')?.value.trim() || voiceDraft?.location||'',
    travelTime: parseInt(document.getElementById('draft-travel')?.value)||voiceDraft?.travelTime||0,
    participants: voiceDraft?.participants||[],
    reminders: voiceDraft?.reminders||[],
    cost: 0, color: '', tags: [], subtasks: [], notes: '',
    elapsed: 0, startTime: null, paused: false, done: false, createdAt: Date.now()
  };
  goals.push(goal);
  if (!activeTaskId) activeTaskId = goal.id;
  saveAll(); rescheduleAllReminders();
  closeModal('modal-draft');
  renderTaskList();
  if (currentView === 'calendar') renderCalendar();
  showPopup('gem', '✦', 'Задача создана!', goal.title.substring(0,30));
  if (openNew) { resetVoiceModal(); openModal('modal-voice'); }
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════ */
document.getElementById('btn-settings')?.addEventListener('click', () => {
  renderTagsManager();
  document.getElementById('bg-dim-slider').value = localStorage.getItem('цель-bg-dim') || '70';
  document.getElementById('settings-api-key').value = localStorage.getItem('цель-openai-key') || '';
  applyBackground();
  openModal('modal-settings');
});

// Theme switcher
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.body.dataset.theme = btn.dataset.theme;
    localStorage.setItem('цель-theme', btn.dataset.theme);
  });
});

// Background
function applyBackground() {
  const img = localStorage.getItem('цель-bg-image');
  const dim = parseInt(localStorage.getItem('цель-bg-dim') || '70') / 100;
  const layer = document.getElementById('bg-image-layer');
  layer.style.backgroundImage = img ? `url("${img}")` : 'none';
  document.getElementById('bg-dim-layer').style.background = `rgba(0,0,0,${dim})`;
  const prev = document.getElementById('bg-preview');
  if (prev) { prev.style.backgroundImage = img ? `url("${img}")` : 'none'; prev.textContent = img ? '' : 'Фон не выбран'; }
}
document.getElementById('bg-file-input')?.addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image(); img.onload = () => {
      const maxW = 1920, scale = Math.min(1, maxW/img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width*scale; canvas.height = img.height*scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      try { localStorage.setItem('цель-bg-image', canvas.toDataURL('image/jpeg', 0.72)); applyBackground(); }
      catch(err) { alert('Изображение слишком большое. Попробуй другое фото.'); }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById('btn-bg-remove')?.addEventListener('click', () => { localStorage.removeItem('цель-bg-image'); applyBackground(); });
document.getElementById('bg-dim-slider')?.addEventListener('input', e => { localStorage.setItem('цель-bg-dim', e.target.value); applyBackground(); });
document.getElementById('settings-api-key')?.addEventListener('change', e => { localStorage.setItem('цель-openai-key', e.target.value.trim()); });

// Tags manager
function renderTagsManager() {
  const list = document.getElementById('tags-manager-list'); if (!list) return;
  list.innerHTML = '';
  // Color picker for new tag
  let newTagColor = TAG_PALETTE[0];
  const picker = document.getElementById('new-tag-color-picker'); picker.innerHTML = '';
  TAG_PALETTE.slice(0,10).forEach((c,i) => {
    const sw = mkEl('div',`color-swatch${i===0?' selected':''}`,); sw.style.background=c;
    sw.style.width='18px'; sw.style.height='18px';
    sw.addEventListener('click',()=>{ picker.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected')); sw.classList.add('selected'); newTagColor=c; });
    picker.appendChild(sw);
  });
  document.getElementById('btn-add-new-tag').onclick = () => {
    const inp = document.getElementById('new-tag-name'); const name = inp.value.trim(); if(!name) return;
    tags.push({ id:'tag_'+Date.now().toString(36)+rnd(), name, color: newTagColor });
    saveAll(); inp.value=''; renderTagsManager(); renderTaskList();
  };

  if (!tags.length) { list.innerHTML='<div style="font-size:11px;color:var(--text3)">Нет тегов</div>'; return; }
  tags.forEach(t => {
    const row = mkEl('div', 'tag-manage-row');
    const dot = mkEl('div', 'tag-manage-dot'); dot.style.background = t.color;
    dot.title='Кликни для смены цвета';
    const swatchWrap = mkEl('div', ''); swatchWrap.style.display='none';
    const sr = mkEl('div', 'tag-color-swatch-row');
    TAG_PALETTE.slice(0,10).forEach(c => {
      const sw = mkEl('div','color-swatch'); sw.style.background=c; sw.style.width='16px'; sw.style.height='16px';
      sw.addEventListener('click',()=>{ t.color=c; dot.style.background=c; saveAll(); renderTaskList(); });
      sr.appendChild(sw);
    });
    swatchWrap.appendChild(sr);
    dot.addEventListener('click',()=>{ swatchWrap.style.display=swatchWrap.style.display==='none'?'flex':'none'; swatchWrap.style.flexWrap='wrap'; swatchWrap.style.gap='4px'; swatchWrap.style.marginLeft='4px'; });
    const nameInp = mkEl('input','tag-manage-name'); nameInp.type='text'; nameInp.value=t.name;
    nameInp.addEventListener('change',()=>{ t.name=nameInp.value.trim()||t.name; saveAll(); renderTaskList(); });
    const delBtn = mkEl('button','tag-del-btn','✕'); delBtn.title='Удалить';
    delBtn.addEventListener('click',()=>{
      if(!confirm(`Удалить тег «${t.name}»?`)) return;
      tags=tags.filter(x=>x.id!==t.id);
      goals.forEach(g=>{ if(g.tags) g.tags=g.tags.filter(id=>id!==t.id); });
      history.forEach(h=>{ if(h.tags) h.tags=h.tags.filter(id=>id!==t.id); });
      saveAll(); renderTagsManager(); renderTaskList();
    });
    row.appendChild(dot); row.appendChild(swatchWrap); row.appendChild(nameInp); row.appendChild(delBtn);
    list.appendChild(row);
  });
}

//* ── Telegram Bot Settings ── */
document.getElementById('btn-save-tg-settings')?.addEventListener('click', () => {
  const token   = document.getElementById('tg-bot-token')?.value.trim();
  const chat_id = document.getElementById('tg-chat-id')?.value.trim();
  if (token) localStorage.setItem('цель-tg-token', token);
  if (chat_id) localStorage.setItem('цель-tg-chat', chat_id);
  // Save to KV so the webhook can find it
  syncToKV({ tgToken: token, tgChatId: chat_id });
  showPopup('gem', '✅', 'Настройки Telegram сохранены', 'Бот теперь активен');
});

// Data export
document.getElementById('btn-export-data')?.addEventListener('click', () => {
  const data = { goals, history, gems, streak, purchases, macroGoals, tags, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `цель-backup-${dateKey()}.json`; a.click();
  URL.revokeObjectURL(url);
});
// Reset data
document.getElementById('btn-reset-data')?.addEventListener('click', () => {
  if (confirm('⚠️ Удалить ВСЕ данные? Это действие необратимо!')) {
    if (confirm('Точно уверен? Все кристаллы, история и задачи будут удалены!')) {
      ['цель-goals','цель-history','цель-gems','цель-streak2','цель-purchases','цель-macros','цель-tags','цель-bg-image'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  }
});

/* ═══════════════════════════════════════════════════════════
   MODAL SYSTEM
═══════════════════════════════════════════════════════════ */
function openModal(id) {
  const overlay = document.getElementById(id); if (!overlay) return;
  overlay.classList.add('show');
  // Trap focus
  setTimeout(() => { const first = overlay.querySelector('input, select, textarea, button'); if (first) first.focus(); }, 50);
}
function closeModal(id) {
  const overlay = document.getElementById(id); if (!overlay) return;
  overlay.classList.remove('show');
}

// Close buttons
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
// Click outside to close
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// Search toggle
document.getElementById('btn-search-toggle')?.addEventListener('click', () => {
  const wrap = document.getElementById('search-bar-wrap');
  wrap.classList.toggle('open');
  if (wrap.classList.contains('open')) setTimeout(() => document.getElementById('search-input')?.focus(), 200);
});
document.getElementById('search-input')?.addEventListener('input', () => renderTaskList());
document.getElementById('search-clear-btn')?.addEventListener('click', () => {
  document.getElementById('search-input').value = '';
  document.getElementById('search-bar-wrap').classList.remove('open');
  renderTaskList();
});

// Filter chips
document.getElementById('filter-chips')?.addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip'); if (!chip) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active'); taskFilter = chip.dataset.filter; renderTaskList();
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Escape') { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); document.getElementById('focus-overlay').classList.remove('show'); }
  if (e.code === 'Space' && currentView === 'timer') { e.preventDefault(); const startBtn = document.getElementById('btn-timer-start'); if (startBtn) startBtn.click(); }
  if (e.code === 'KeyN' && !e.metaKey && !e.ctrlKey) openTaskModal();
});

/* ═══════════════════════════════════════════════════════════
   CLOCK (1s interval)
═══════════════════════════════════════════════════════════ */
let _lastSecond = -1;
setInterval(() => {
  const n = new Date();
  const sec = n.getHours()*3600 + n.getMinutes()*60 + n.getSeconds();
  if (sec !== _lastSecond) {
    _lastSecond = sec;
    if (sec === 0) { streakMidnightCheck(); if (currentView==='profile') renderProfile(); }
  }
  // Update macro timers every 30s
  if (sec % 30 === 0 && currentView === 'profile') renderMacroList();
  // Update calendar now-line every 60s
  if (sec % 60 === 0 && calView === 'day' && currentView === 'calendar') renderDayView();
}, 1000);

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
/* ── Settings: load saved TG values ── */
function loadTgSettings() {
  const tokEl = document.getElementById('tg-bot-token');
  const cidEl = document.getElementById('tg-chat-id');
  if (tokEl) tokEl.value = localStorage.getItem('цель-tg-token') || '';
  if (cidEl) cidEl.value = localStorage.getItem('цель-tg-chat') || '';
}
document.getElementById('btn-settings')?.addEventListener('click', () => {
  renderTagsManager();
  document.getElementById('settings-api-key').value = localStorage.getItem('цель-openai-key') || '';
  loadTgSettings();
  openModal('modal-settings');
}, true);

function init() {
  // Restore theme
  const savedTheme = localStorage.getItem('цель-theme') || 'dark';
  document.body.dataset.theme = savedTheme;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === savedTheme));

  // Streak midnight check (Sunday protection inside)
  streakMidnightCheck();

  // Birthday bonus
  checkBirthdayBonus();

  // Persist migrations
  saveAll(true); // skipKV=true on first load

  // Set active task
  activeTaskId = goals.find(g => !g.done)?.id || null;

  // Reschedule reminders
  rescheduleAllReminders();

  // Render initial view
  switchView('tasks');

  // Initial KV sync
  setTimeout(() => syncToKV({ goals: goals.filter(g=>!g.done).slice(0,40), gems, streak }), 2000);

  // Welcome popup
  if (!localStorage.getItem('цель-welcomed')) {
    localStorage.setItem('цель-welcomed','1');
    setTimeout(() => showPopup('milestone','✦','Добро пожаловать в Цель!',`Загружено ${goals.length} задач, ${gems} 💎`), 800);
  } else {
    const greet = isSunday() ? '😴 Воскресенье! Отдыхай.' : `${goals.filter(g=>!g.done).length} активных задач`;
    setTimeout(() => showPopup('gem','💎',`${gems} кристаллов`, greet), 600);
  }
}

init();
