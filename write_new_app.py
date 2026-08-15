#!/usr/bin/env python3
# write_new_app.py — writes the new app.js for ЦЕЛЬ PWA v3
import os, sys

TARGET = os.path.join(os.path.dirname(__file__), 'app.js')

CODE = r'''/* ══════════════════════════════════════════════════════════
   ЦЕЛЬ PWA — app.js v3.0  (Apple HIG + Dynamic Island Nav)
   Bulletproof init · Demo data · Vercel KV 2-Way Sync
   ══════════════════════════════════════════════════════════ */

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
   STATE
═══════════════════════════════════════════════════════════ */
let goals     = [];
let history   = [];
let purchases = [];
let gems      = 0;
let streak    = { days: 0, lastDate: '', doneToday: false };
let tags      = [];
let macroGoals = [];
let pomoConfig = { work: 25, short: 5, long: 15 };

let activeTaskId   = null;
let currentView    = 'tasks';
let taskFilter     = 'today';
let taskTagFilter  = null;
let storeFilter    = 'all';
let storeDraft     = {};
let cart           = [];
let editingTaskId  = null;
let detailTaskId   = null;
let selectedColor  = COLOR_PALETTE[0];
let selectedTags   = [];
let selectedReminders = [];
let participants   = [];
let searchVisible  = false;
let searchQuery    = '';
let calView        = 'month';
let calDate        = new Date();
let timerMode      = 'countdown';
let pomoPhase      = 'work';
let pomoCycles     = 0;
let rafId          = null;
let stopwatchStart = null;
let stopwatchElapsed = 0;
let stopwatchRunning = false;
let firedAlarmIds  = new Set();
let alarmAudioMap  = {};
let reminderTimers = [];
let voiceDraft     = null;
let sortMode       = 'date'; // 'date' | 'priority' | 'cat'

/* ═══════════════════════════════════════════════════════════
   LOAD FROM LOCALSTORAGE
═══════════════════════════════════════════════════════════ */
function loadFromStorage() {
  try { goals     = JSON.parse(localStorage.getItem('цель-goals')   || '[]'); } catch(e) { goals = []; }
  try { history   = JSON.parse(localStorage.getItem('цель-history') || '[]'); } catch(e) { history = []; }
  try { purchases = JSON.parse(localStorage.getItem('цель-purchases')|| '[]');} catch(e) { purchases = []; }
  try { gems      = parseInt(localStorage.getItem('цель-gems')      || '0');  } catch(e) { gems = 0; }
  try { streak    = JSON.parse(localStorage.getItem('цель-streak2') || 'null') || { days:0, lastDate:'', doneToday:false }; } catch(e) {}
  try { tags      = JSON.parse(localStorage.getItem('цель-tags')    || 'null'); if (!tags) initDefaultTags(); } catch(e) { initDefaultTags(); }
  try { macroGoals= JSON.parse(localStorage.getItem('цель-macros')  || '[]'); } catch(e) { macroGoals = []; }
  try { pomoConfig= JSON.parse(localStorage.getItem('цель-pomo')    || 'null') || { work:25, short:5, long:15 }; } catch(e) {}
  // Extend goals with new fields
  goals.forEach(extendGoal);
  STORE_ITEMS.forEach(i => storeDraft[i.id] = 1);
}

function initDefaultTags() {
  tags = TAG_DEFAULT_NAMES.map((name, i) => ({
    id: 'tag_default_' + i, name,
    color: TAG_PALETTE[i % TAG_PALETTE.length]
  }));
}

function extendGoal(g) {
  if (!g.location)     g.location = '';
  if (!g.participants) g.participants = [];
  if (!g.cost)         g.cost = 0;
  if (!g.travelTime)   g.travelTime = 0;
  if (!g.reminders)    g.reminders = [];
  if (!g.color)        g.color = '';
  if (!g.scheduledAt)  g.scheduledAt = null;
  if (!g.duration_min) g.duration_min = Math.round((g.duration || 1500) / 60);
  if (!g.notes)        g.notes = '';
  if (!g.subtasks)     g.subtasks = [];
  if (!g.tags)         g.tags = [];
}

/* ═══════════════════════════════════════════════════════════
   SAVE
═══════════════════════════════════════════════════════════ */
function saveAll(skipKV = false) {
  try { localStorage.setItem('цель-goals',     JSON.stringify(goals));      } catch(e){}
  try { localStorage.setItem('цель-history',   JSON.stringify(history));    } catch(e){}
  try { localStorage.setItem('цель-gems',      String(gems));               } catch(e){}
  try { localStorage.setItem('цель-streak2',   JSON.stringify(streak));     } catch(e){}
  try { localStorage.setItem('цель-purchases', JSON.stringify(purchases));  } catch(e){}
  try { localStorage.setItem('цель-macros',    JSON.stringify(macroGoals)); } catch(e){}
  try { localStorage.setItem('цель-tags',      JSON.stringify(tags));       } catch(e){}
  try { localStorage.setItem('цель-pomo',      JSON.stringify(pomoConfig)); } catch(e){}
  if (!skipKV) scheduleKVSync();
}

/* ═══════════════════════════════════════════════════════════
   VERCEL KV SYNC
═══════════════════════════════════════════════════════════ */
const KV_ENDPOINT = '/api/sync';
let kvSyncTimer = null;
let kvBadgeTimer = null;

function getOrCreateUserId() {
  let uid = localStorage.getItem('цель-uid');
  if (!uid) {
    uid = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    localStorage.setItem('цель-uid', uid);
  }
  return uid;
}

function setBadge(cls, text) {
  const b = document.getElementById('sync-badge');
  if (!b) return;
  b.className = 'sync-badge ' + cls;
  b.textContent = text;
}

function scheduleKVSync() {
  clearTimeout(kvSyncTimer);
  kvSyncTimer = setTimeout(doKVSync, 1500);
}

async function doKVSync() {
  setBadge('syncing', '↑ Синхронизация…');
  try {
    const payload = {
      userId: getOrCreateUserId(),
      goals: goals.filter(g => !g.done).slice(0, 40),
      gems,
      streak,
      history: history.slice(0, 50),
      macroGoals,
      tgToken:  localStorage.getItem('цель-tg-token') || '',
      tgChatId: localStorage.getItem('цель-tg-chat')  || '',
    };
    const res = await fetch(KV_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setBadge('synced', '✓ Синхронизировано');
    } else {
      setBadge('hidden', '');
    }
  } catch (_) {
    setBadge('hidden', '');
  }
  clearTimeout(kvBadgeTimer);
  kvBadgeTimer = setTimeout(() => setBadge('hidden', ''), 2400);
}

async function loadFromKV() {
  const uid = getOrCreateUserId();
  try {
    const res = await fetch(`${KV_ENDPOINT}?userId=${uid}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.goals) return;
    // Merge: cloud goals that are not in local
    const localIds = new Set(goals.map(g => g.id));
    (data.goals || []).forEach(cg => {
      if (!localIds.has(cg.id)) { extendGoal(cg); goals.push(cg); }
    });
    // Merge history
    const hIds = new Set(history.map(h => h.id));
    (data.history || []).forEach(h => { if (!hIds.has(h.id)) history.push(h); });
    // Take higher gems
    if ((data.gems || 0) > gems) gems = data.gems;
    // Take higher streak days
    if ((data.streak?.days || 0) > streak.days) streak = data.streak;
    saveAll(true);
    renderAll();
    showToast('☁️ Данные из облака загружены');
  } catch(e) {
    console.warn('[KV load]', e);
  }
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function pad(n, d = 2) { return String(Math.floor(Math.abs(n))).padStart(d, '0'); }
function rnd() { return Math.random().toString(36).slice(2, 7); }
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
function todayKey() { return dateKey(); }
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
function isSunday() { return new Date().getDay() === 0; }

/* ═══════════════════════════════════════════════════════════
   TOAST (uses #toast-stack from new HTML)
═══════════════════════════════════════════════════════════ */
function showToast(msg, duration = 3000) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = mkEl('div', 'toast-card');
  t.textContent = msg;
  stack.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════
   POPUP (gem / fire / milestone) — uses #toast-stack as fallback
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
  const stack = document.getElementById('toast-stack');
  if (!stack) { setTimeout(flushPopup, 3600); return; }
  const card = mkEl('div', `popup-card ${type}-card`);
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
  gems++; streakOnComplete(); saveAll();
  showPopup('gem', '💎', `+1 кристалл! (${gems} всего)`, `«${goalTitle.substring(0,28)}»`);
  if (!prevDone) {
    const msg = streak.days === 1 ? 'Серия началась!' : `${streak.days} дней подряд — огонь!`;
    showPopup('fire', '🔥', msg, 'Огонёк сохранён на сегодня');
  }
  if (gems % 10 === 0 && gems !== 0) {
    const msgs = ['Просто машина!','Легенда!','Неудержимый!','На пике формы!'];
    showPopup('milestone', '🏆', `${gems} кристаллов`, msgs[Math.floor(gems/10-1) % msgs.length]);
  }
}

/* ═══════════════════════════════════════════════════════════
   STREAK
═══════════════════════════════════════════════════════════ */
function streakOnComplete() {
  const today = todayKey();
  if (streak.lastDate === today) {
    streak.doneToday = true;
  } else {
    const yest = dateKey(Date.now() - 86400000);
    streak.days = (streak.lastDate === yest) ? streak.days + 1 : 1;
    streak.lastDate  = today;
    streak.doneToday = true;
  }
}
function streakMidnightCheck() {
  const today = todayKey(), yest = dateKey(Date.now() - 86400000);
  if (streak.lastDate !== today) {
    streak.doneToday = false;
    if (!isSunday()) {
      if (streak.lastDate !== yest && streak.lastDate !== '') streak.days = 0;
    }
    saveAll(true);
  }
}

/* ═══════════════════════════════════════════════════════════
   ALARM ENGINE
═══════════════════════════════════════════════════════════ */
function playAlarm(goalId) {
  stopAlarm(goalId);
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
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
  if (e) { clearInterval(e.loopId); try { e.ctx.close(); } catch(_){} delete alarmAudioMap[goalId]; }
  document.getElementById('alarm-card-' + goalId)?.remove();
}
function triggerAlarm(goal, msg = 'Время вышло!') {
  playAlarm(goal.id);
  const stack = document.getElementById('alarm-stack');
  if (!stack || document.getElementById('alarm-card-' + goal.id)) return;
  const card = mkEl('div', 'alarm-card');
  card.id = 'alarm-card-' + goal.id;
  card.innerHTML = `<div class="alarm-icon">⏰</div><div class="alarm-text"><div class="alarm-title">${esc(msg)}</div><div class="alarm-sub">«${esc(goal.title.substring(0,40))}»</div></div><button class="alarm-close">✕</button>`;
  card.querySelector('.alarm-close')?.addEventListener('click', () => stopAlarm(goal.id));
  stack.appendChild(card);
}
function scheduleReminders(goal) {
  if (!goal.scheduledAt || !goal.reminders?.length) return;
  goal.reminders.forEach(mins => {
    const fireAt = goal.scheduledAt - mins * 60000;
    const delta = fireAt - Date.now();
    if (delta > 0) {
      const tid = setTimeout(() => triggerAlarm(goal, `Через ${mins < 60 ? mins + ' мин' : (mins/60) + ' ч'}!`), delta);
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
   NLP PARSER
═══════════════════════════════════════════════════════════ */
function parseNLP(text) {
  const result = { title: text, scheduledAt: null, priority: 'mid', cat: 'business', duration_min: 25, tags: [] };
  let s = text;

  // Priority
  if (/\bp1\b/i.test(s)) { result.priority = 'high'; s = s.replace(/\bp1\b/ig, ''); }
  else if (/\bp3\b/i.test(s)) { result.priority = 'low'; s = s.replace(/\bp3\b/ig, ''); }
  else s = s.replace(/\bp2\b/ig, '');

  // Tags @tag
  const tagMatches = s.match(/@\S+/g) || [];
  tagMatches.forEach(m => {
    const name = m.slice(1).toLowerCase();
    let t = tags.find(t => t.name.toLowerCase() === name);
    if (!t) { t = { id: 'tag_' + Date.now().toString(36) + rnd(), name, color: TAG_PALETTE[tags.length % TAG_PALETTE.length] }; tags.push(t); saveAll(true); }
    result.tags.push(t.id);
  });
  s = s.replace(/@\S+/g, '').trim();

  // Duration: "на X часов/мин"
  const durM = s.match(/на\s+(\d+)\s*(час|ч|мин|м)\b/i);
  if (durM) {
    const num = parseInt(durM[1]);
    result.duration_min = /час|ч/i.test(durM[2]) ? num * 60 : num;
    s = s.replace(durM[0], '').trim();
  }

  // Date/time
  const now = new Date();
  if (/сегодня/i.test(s)) { now.setHours(9,0,0,0); result.scheduledAt = now.getTime(); s = s.replace(/сегодня/i,'').trim(); }
  else if (/завтра/i.test(s)) { const d = new Date(now); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); result.scheduledAt = d.getTime(); s = s.replace(/завтра/i,'').trim(); }
  const timeM = s.match(/в\s+(\d{1,2})[:h]?(\d{2})?\s*(утра|вечера|дня)?/i);
  if (timeM) {
    let h = parseInt(timeM[1]), m = parseInt(timeM[2]||'0');
    if (/вечера|дня/i.test(timeM[3]) && h < 12) h += 12;
    const dt = result.scheduledAt ? new Date(result.scheduledAt) : new Date();
    dt.setHours(h, m, 0, 0);
    result.scheduledAt = dt.getTime();
    s = s.replace(timeM[0],'').trim();
  }

  result.title = s.replace(/\s+/g,' ').trim() || text;
  return result;
}

/* ═══════════════════════════════════════════════════════════
   VIEWS NAVIGATION
═══════════════════════════════════════════════════════════ */
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('hidden', el.dataset.view !== view));
  document.querySelectorAll('.island-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  if (view === 'tasks')    renderTaskList();
  if (view === 'calendar') renderCalendar();
  if (view === 'profile')  renderProfile();
  if (view === 'timer')    { renderTimerGoalCard(); updateTimerControls(); tickDisplay(); }
}

/* ═══════════════════════════════════════════════════════════
   TASK FILTERING
═══════════════════════════════════════════════════════════ */
function getFilteredTasks() {
  const now = new Date();
  const todayStr = todayKey();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr = dateKey(tomorrow.getTime());
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate()+7);

  let list = goals.filter(g => {
    if (taskFilter === 'done') return g.done;
    if (g.done) return false;
    if (taskFilter === 'all') return true;
    if (!g.scheduledAt) return taskFilter === 'today';
    const dk = dateKey(g.scheduledAt);
    if (taskFilter === 'today')    return dk === todayStr;
    if (taskFilter === 'tomorrow') return dk === tomorrowStr;
    if (taskFilter === 'week')     return g.scheduledAt <= weekEnd.getTime();
    return true;
  });

  if (taskTagFilter) list = list.filter(g => g.tags?.includes(taskTagFilter));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(g => g.title.toLowerCase().includes(q) || g.notes?.toLowerCase().includes(q));
  }

  // Sort
  list.sort((a, b) => {
    if (sortMode === 'priority') {
      const p = { high: 0, mid: 1, low: 2 };
      return (p[a.priority]||1) - (p[b.priority]||1);
    }
    if (sortMode === 'cat') return (a.cat||'').localeCompare(b.cat||'');
    // date (default)
    const aT = a.scheduledAt || Infinity, bT = b.scheduledAt || Infinity;
    if (aT !== bT) return aT - bT;
    const p = { high: 0, mid: 1, low: 2 };
    return (p[a.priority]||1) - (p[b.priority]||1);
  });

  return list;
}

/* ═══════════════════════════════════════════════════════════
   RENDER TASK LIST
═══════════════════════════════════════════════════════════ */
function renderTaskList() {
  const listEl = document.getElementById('task-list');
  if (!listEl) return;

  // Sunday banner
  const banner = document.getElementById('sunday-banner');
  if (banner) banner.classList.toggle('hidden', !isSunday());

  // Subtitle
  const subtitle = document.getElementById('tasks-view-subtitle');
  if (subtitle) {
    const todayDone = history.filter(h => dateKey(h.completedAt) === todayKey()).length;
    const pendingToday = goals.filter(g => !g.done && g.scheduledAt && dateKey(g.scheduledAt) === todayKey()).length;
    subtitle.textContent = `${todayDone} выполнено · ${pendingToday} на сегодня`;
  }

  const tasks = getFilteredTasks();
  if (!tasks.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">✨</div><div class="empty-title">${taskFilter === 'done' ? 'Нет выполненных задач' : 'Задач нет'}</div><div class="empty-sub">${taskFilter === 'done' ? '' : 'Нажми + чтобы добавить'}</div></div>`;
    return;
  }

  listEl.innerHTML = '';
  tasks.forEach(g => listEl.appendChild(buildTaskCard(g)));
}

function buildTaskCard(g) {
  const card = mkEl('div', `task-card${g.done ? ' done' : ''}${g.id === activeTaskId ? ' active' : ''}`);
  card.dataset.id = g.id;

  const color = catColor(g);
  const cat = CATS[g.cat] || CATS.business;
  const prioEmoji = { high:'🔴', mid:'🟡', low:'⚪' }[g.priority] || '🟡';
  const hasTime = !!g.scheduledAt;
  const elapsed = getElapsed(g);
  const totalSec = (g.duration_min || 25) * 60;
  const pct = Math.min(1, elapsed / totalSec);
  const isRunning = !!g.startTime && !g.paused && !g.done;
  const isOverdue = hasTime && g.scheduledAt < Date.now() && !g.done;
  const subDone = (g.subtasks || []).filter(s => s.done).length;
  const subTotal = (g.subtasks || []).length;

  const tagHtml = (g.tags||[]).map(id => {
    const t = getTag(id);
    return t ? `<span class="task-tag" style="background:${t.color}22;color:${t.color}">${esc(t.name)}</span>` : '';
  }).join('');

  card.innerHTML = `
    <div class="task-accent" style="background:${color}"></div>
    <div class="task-body">
      <div class="task-top-row">
        <div class="task-check-wrap">
          <button class="task-check${g.done ? ' checked' : ''}" data-action="check" aria-label="Выполнить">
            ${g.done ? '✓' : ''}
          </button>
        </div>
        <div class="task-content">
          <div class="task-title-row">
            <span class="task-title">${esc(g.title)}</span>
            <span class="task-prio">${prioEmoji}</span>
          </div>
          <div class="task-meta">
            <span class="task-cat-badge" style="background:${color}22;color:${color}">${cat.emoji} ${cat.label}</span>
            ${hasTime ? `<span class="task-time${isOverdue ? ' overdue' : ''}">${isOverdue ? '⚠ ' : ''}${fmtDateTime(g.scheduledAt)}</span>` : ''}
            ${g.location ? `<span class="task-loc">📍 ${esc(g.location)}</span>` : ''}
          </div>
          ${tagHtml ? `<div class="task-tags">${tagHtml}</div>` : ''}
          ${subTotal > 0 ? `<div class="task-subtask-info">${subDone}/${subTotal} подзадач</div>` : ''}
        </div>
        <div class="task-actions">
          <button class="task-action-btn" data-action="timer" aria-label="Таймер">⏱</button>
          <button class="task-action-btn" data-action="detail" aria-label="Детали">›</button>
        </div>
      </div>
      ${isRunning || pct > 0 ? `<div class="task-progress"><div class="task-progress-fill" style="width:${(pct*100).toFixed(1)}%;background:${color}"></div></div>` : ''}
    </div>`;

  card.querySelector('[data-action="check"]')?.addEventListener('click', e => { e.stopPropagation(); completeGoal(g.id); });
  card.querySelector('[data-action="timer"]')?.addEventListener('click', e => { e.stopPropagation(); setTimerGoal(g.id); switchView('timer'); });
  card.querySelector('[data-action="detail"]')?.addEventListener('click', e => { e.stopPropagation(); openDetailModal(g.id); });
  card.addEventListener('click', () => openDetailModal(g.id));
  return card;
}

/* ═══════════════════════════════════════════════════════════
   COMPLETE GOAL
═══════════════════════════════════════════════════════════ */
function completeGoal(id) {
  const g = goals.find(x => x.id === id);
  if (!g || g.done) return;
  cancelAnimationFrame(rafId); rafId = null;
  const elapsed = getElapsed(g);
  g.elapsed = elapsed; g.startTime = null; g.paused = true; g.done = true;
  const hEntry = {
    id: 'h_' + Date.now().toString(36) + rnd(),
    goalId: g.id, title: g.title, cat: g.cat, color: catColor(g),
    completedAt: Date.now(), elapsed_ms: elapsed * 1000,
    gems: 1, tags: [...(g.tags||[])]
  };
  history.unshift(hEntry);
  saveAll();
  awardOnComplete(g.title);
  stopAlarm(g.id);

  // Flash
  const flash = document.getElementById('done-flash');
  if (flash) { flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 700); }

  if (activeTaskId === id) updateTimerControls();
  renderTaskList();
  renderProfile();
}

/* ═══════════════════════════════════════════════════════════
   TASK MODAL — OPEN / CLOSE
═══════════════════════════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.classList.remove('modal-open');
}

function openTaskModal(id = null) {
  editingTaskId = id;
  const g = id ? goals.find(x => x.id === id) : null;
  selectedColor = g?.color || COLOR_PALETTE[0];
  selectedTags = g ? [...(g.tags || [])] : [];
  selectedReminders = g ? [...(g.reminders || [])] : [];
  participants = g ? [...(g.participants || [])] : [];

  const titleEl = document.getElementById('modal-task-title');
  if (titleEl) titleEl.textContent = g ? 'Редактировать' : 'Новая задача';

  const inp = document.getElementById('task-title-input');
  if (inp) inp.value = g?.title || '';

  const notes = document.getElementById('task-notes-input');
  if (notes) notes.value = g?.notes || '';

  // Priority
  document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.priority === (g?.priority || 'mid'));
  });

  // Date
  const dateInp = document.getElementById('task-date-input');
  if (dateInp) {
    if (g?.scheduledAt) {
      const d = new Date(g.scheduledAt);
      dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else dateInp.value = '';
  }

  // Category
  const catSel = document.getElementById('task-category-select');
  if (catSel) catSel.value = g?.cat || 'business';

  // Duration
  const dh = document.getElementById('dur-h'), dm = document.getElementById('dur-m');
  const totalMin = g?.duration_min || 25;
  if (dh) dh.value = Math.floor(totalMin / 60);
  if (dm) dm.value = totalMin % 60;

  // Location
  const loc = document.getElementById('task-location-input');
  if (loc) loc.value = g?.location || '';

  // Travel / Cost
  const travel = document.getElementById('task-travel-input');
  if (travel) travel.value = g?.travelTime || 0;
  const cost = document.getElementById('task-cost-input');
  if (cost) cost.value = g?.cost || 0;

  // Color palette
  renderColorPalette('task-color-pal', selectedColor, c => { selectedColor = c; });

  // Tags picker
  renderTagsPicker();

  // Reminders
  renderReminders();

  // Subtasks
  renderSubtaskInputList(g?.subtasks || []);

  // Participants
  renderParticipants();

  // NLP hint
  const hint = document.getElementById('nlp-hint');
  if (hint) hint.classList.add('hidden');

  // Delete btn
  const delBtn = document.getElementById('btn-delete-task');
  if (delBtn) delBtn.classList.toggle('hidden', !g);

  // Save btn text
  const saveBtn = document.getElementById('btn-save-task');
  if (saveBtn) saveBtn.textContent = g ? 'Сохранить' : 'Создать';

  openModal('modal-task');
  setTimeout(() => inp?.focus(), 100);
}

function saveTask() {
  const title = document.getElementById('task-title-input')?.value.trim();
  if (!title) { showToast('Введи название задачи'); return; }

  const priorityBtn = document.querySelector('#priority-ctrl .seg-btn.active');
  const catSel = document.getElementById('task-category-select');
  const dateInp = document.getElementById('task-date-input');
  const dh = document.getElementById('dur-h');
  const dm = document.getElementById('dur-m');
  const loc = document.getElementById('task-location-input');
  const travel = document.getElementById('task-travel-input');
  const cost = document.getElementById('task-cost-input');
  const notes = document.getElementById('task-notes-input');

  const scheduledAt = dateInp?.value ? new Date(dateInp.value).getTime() : null;
  const durMin = (parseInt(dh?.value||'0') * 60) + parseInt(dm?.value||'25');

  // Read subtasks from DOM
  const subtasks = [];
  document.querySelectorAll('.st-input-row').forEach(row => {
    const txt = row.querySelector('input')?.value.trim();
    if (txt) subtasks.push({ id: 'st_' + Date.now().toString(36) + rnd(), text: txt, done: false });
  });

  const data = {
    title, notes: notes?.value.trim() || '',
    priority: priorityBtn?.dataset.priority || 'mid',
    cat: catSel?.value || 'business',
    scheduledAt, duration_min: durMin || 25,
    location: loc?.value.trim() || '',
    travelTime: parseInt(travel?.value||'0'),
    cost: parseFloat(cost?.value||'0'),
    tags: [...selectedTags],
    reminders: [...selectedReminders],
    participants: [...participants],
    color: selectedColor,
    subtasks,
  };

  if (editingTaskId) {
    const g = goals.find(x => x.id === editingTaskId);
    if (g) Object.assign(g, data);
  } else {
    const g = {
      id: 'g_' + Date.now().toString(36) + rnd(),
      done: false, elapsed: 0, startTime: null, paused: false,
      createdAt: Date.now(), elapsed_ms: 0, ...data,
    };
    goals.unshift(g);
  }

  saveAll(); rescheduleAllReminders();
  closeModal('modal-task');
  renderTaskList();
  renderCalendar();
  showToast(editingTaskId ? '✅ Задача обновлена' : '✅ Задача создана');
}

/* ═══════════════════════════════════════════════════════════
   DETAIL MODAL
═══════════════════════════════════════════════════════════ */
function openDetailModal(id) {
  detailTaskId = id;
  const g = goals.find(x => x.id === id);
  if (!g) return;

  const titleEl = document.getElementById('td-title');
  if (titleEl) titleEl.textContent = g.title;

  const body = document.getElementById('task-detail-body');
  if (!body) return;

  const cat = CATS[g.cat] || CATS.business;
  const color = catColor(g);
  const elapsed = getElapsed(g);
  const totalSec = (g.duration_min || 25) * 60;
  const pct = Math.min(100, Math.round(elapsed / totalSec * 100));
  const tagHtml = (g.tags||[]).map(id => { const t = getTag(id); return t ? `<span class="task-tag" style="background:${t.color}22;color:${t.color}">${esc(t.name)}</span>` : ''; }).join('');
  const subHtml = (g.subtasks||[]).map(st =>
    `<div class="detail-subtask${st.done?' done':''}">
      <span class="detail-subtask-check">${st.done?'✓':'○'}</span>
      <span>${esc(st.text)}</span>
    </div>`
  ).join('');

  body.innerHTML = `
    <div class="detail-cat" style="color:${color}">${cat.emoji} ${cat.label}</div>
    ${g.scheduledAt ? `<div class="detail-row"><span>📅</span><span>${fmtDateTime(g.scheduledAt)}</span></div>` : ''}
    ${g.duration_min ? `<div class="detail-row"><span>⏱</span><span>${g.duration_min} мин</span></div>` : ''}
    ${g.location ? `<div class="detail-row"><span>📍</span><span>${esc(g.location)}</span></div>` : ''}
    ${g.travelTime ? `<div class="detail-row"><span>🚗</span><span>${g.travelTime} мин дороги</span></div>` : ''}
    ${g.cost ? `<div class="detail-row"><span>💰</span><span>${g.cost} ₽</span></div>` : ''}
    ${g.notes ? `<div class="detail-notes">${esc(g.notes)}</div>` : ''}
    ${tagHtml ? `<div class="task-tags">${tagHtml}</div>` : ''}
    ${subHtml ? `<div class="detail-subtasks">${subHtml}</div>` : ''}
    <div class="detail-progress-wrap">
      <div class="detail-progress-bar"><div class="detail-progress-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="detail-progress-pct">${pct}%</span>
    </div>
    <div class="detail-elapsed">Прошло: ${fmtD(elapsed)}</div>
  `;

  openModal('modal-task-detail');
}

/* ═══════════════════════════════════════════════════════════
   TIMER ENGINE
═══════════════════════════════════════════════════════════ */
function setTimerGoal(id) {
  activeTaskId = id;
  renderTimerGoalCard();
  tickDisplay();
  updateTimerControls();
}

function renderTimerGoalCard() {
  const g = goals.find(x => x.id === activeTaskId);
  const nameEl = document.getElementById('timer-goal-name');
  if (nameEl) nameEl.textContent = g ? g.title : 'Не выбрана';
  const badge = document.getElementById('ring-cat-badge');
  if (badge && g) { const cat = CATS[g.cat] || CATS.business; badge.textContent = cat.emoji + ' ' + cat.label; }
}

function startTimer() {
  if (timerMode === 'stopwatch') {
    stopwatchStart = Date.now() - stopwatchElapsed * 1000;
    stopwatchRunning = true;
    showPopup('gem', '⏱', 'Секундомер запущен', 'Время пошло!');
  } else if (timerMode === 'pomodoro') {
    const g = goals.find(x => x.id === activeTaskId);
    if (g) { g.startTime = Date.now(); g.paused = false; saveAll(); }
  } else {
    const g = goals.find(x => x.id === activeTaskId);
    if (!g || g.done) return;
    g.startTime = Date.now(); g.paused = false;
    firedAlarmIds.delete(g.id); saveAll();
    showToast('▶ Таймер запущен');
  }
  updateTimerControls();
  renderTaskList();
  rafLoop();
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
    if (g) { g.elapsed = 0; g.startTime = null; g.paused = false; g.subtasks?.forEach(s => s.done = false); saveAll(); }
    renderPomodoroCycles();
  } else {
    const g = goals.find(x => x.id === activeTaskId);
    if (g) { g.elapsed = 0; g.startTime = null; g.paused = false; g.subtasks?.forEach(s => s.done = false); saveAll(); firedAlarmIds.delete(g.id); stopAlarm(g.id); }
  }
  tickDisplay();
  updateTimerControls(); renderTaskList();
}

function completeTimer() {
  cancelAnimationFrame(rafId); rafId = null;
  const g = goals.find(x => x.id === activeTaskId);
  if (!g) return;
  completeGoal(g.id);
  tickDisplay();
  updateTimerControls();
}

function pomoPhaseSeconds() {
  if (pomoPhase === 'work')  return pomoConfig.work  * 60;
  if (pomoPhase === 'short') return pomoConfig.short * 60;
  return pomoConfig.long * 60;
}
function pomoPhaseLabel() {
  if (pomoPhase === 'work')  return '📚 Фокус';
  if (pomoPhase === 'short') return '☕ Короткий';
  return '🌙 Длинный';
}
function pomoPhaseColor() {
  if (pomoPhase === 'work')  return '#0A84FF';
  if (pomoPhase === 'short') return '#30D158';
  return '#BF5AF2';
}
function advancePomodoro(g) {
  g.elapsed = 0; g.startTime = Date.now();
  if (pomoPhase === 'work') {
    pomoCycles++;
    pomoPhase = (pomoCycles % 4 === 0) ? 'long' : 'short';
    triggerAlarm(g, '🍅 Перерыв!');
  } else {
    pomoPhase = 'work';
    triggerAlarm(g, '📚 Фокус!');
  }
  renderPomodoroCycles();
  const phaseLabel = document.getElementById('pomo-phase-label');
  if (phaseLabel) phaseLabel.textContent = pomoPhaseLabel();
}
function renderPomodoroCycles() {
  const wrap = document.getElementById('pomo-dots');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = mkEl('div', 'pomo-dot' + (i < pomoCycles % 4 ? ' done' : ''));
    wrap.appendChild(d);
  }
}

function rafLoop() {
  cancelAnimationFrame(rafId);
  const loop = () => {
    tickDisplay();
    let running = false;
    if (timerMode === 'stopwatch') running = stopwatchRunning;
    else { const g = goals.find(x => x.id === activeTaskId); running = !!(g && g.startTime && !g.paused && !g.done); }
    if (running) rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function tickDisplay() {
  const g = goals.find(x => x.id === activeTaskId);
  const circ = 2 * Math.PI * 88; // r=88 from SVG
  const ringEl  = document.getElementById('ring-fill');
  const timeEl  = document.getElementById('ring-time');
  const pctEl   = document.getElementById('ring-pct');
  const catEl   = document.getElementById('ring-cat-badge');
  const focusEl = document.getElementById('focus-time-display');

  if (timerMode === 'stopwatch') {
    const elapsed = stopwatchRunning ? (Date.now() - stopwatchStart) / 1000 : stopwatchElapsed;
    const hh = Math.floor(elapsed / 3600), mm = Math.floor((elapsed % 3600) / 60), ss = Math.floor(elapsed % 60);
    const str = hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
    if (timeEl) timeEl.textContent = str;
    if (pctEl)  pctEl.textContent  = '⏱';
    if (ringEl) { ringEl.style.strokeDashoffset = (circ * 0.25).toFixed(3); ringEl.setAttribute('stroke', '#BF5AF2'); }
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
    const str = `${pad(mm)}:${pad(ss)}`;
    if (timeEl) timeEl.textContent = str;
    if (pctEl)  pctEl.textContent  = `${Math.round(pct * 100)}%`;
    if (focusEl) focusEl.textContent = str;
    if (remaining <= 0 && g?.startTime) advancePomodoro(g);
    return;
  }

  // Countdown
  if (!g) {
    if (timeEl) timeEl.textContent = '25:00';
    if (pctEl)  pctEl.textContent  = '0%';
    if (ringEl) { ringEl.style.strokeDashoffset = circ.toFixed(3); ringEl.setAttribute('stroke', '#0A84FF'); }
    return;
  }
  const elapsed   = getElapsed(g);
  const totalSec  = (g.duration_min || 25) * 60;
  const remaining = Math.max(0, totalSec - elapsed);
  const pct       = Math.min(1, elapsed / totalSec);
  const color     = g.done ? '#30D158' : (remaining < 60 ? '#FF453A' : catColor(g));

  if (ringEl) {
    ringEl.style.strokeDashoffset = (circ * (1 - pct)).toFixed(3);
    ringEl.setAttribute('stroke', color);
    ringEl.style.filter = `drop-shadow(0 0 12px ${color}88)`;
  }
  const mm = Math.floor(remaining / 60), ss = Math.floor(remaining % 60);
  let str;
  if (g.done) str = '✓ Готово';
  else if (remaining >= 3600) str = `${Math.floor(remaining/3600)}:${pad(Math.floor((remaining%3600)/60))}:${pad(ss)}`;
  else str = `${pad(mm)}:${pad(ss)}`;
  if (timeEl) timeEl.textContent = str;
  if (pctEl)  pctEl.textContent  = `${Math.round(pct * 100)}%`;
  if (catEl && g) { const cat = CATS[g.cat]||CATS.business; catEl.textContent = cat.emoji + ' ' + cat.label; }
  if (focusEl) focusEl.textContent = str;

  // Check alarm on countdown end
  if (remaining <= 0 && g.startTime && !firedAlarmIds.has(g.id)) {
    firedAlarmIds.add(g.id);
    triggerAlarm(g, '⏰ Время вышло!');
    const gg = goals.find(x => x.id === activeTaskId);
    if (gg) { gg.startTime = null; gg.paused = true; saveAll(); }
    cancelAnimationFrame(rafId); rafId = null;
    updateTimerControls();
  }
}

function updateTimerControls() {
  const g = goals.find(x => x.id === activeTaskId);
  const isRunning = timerMode === 'stopwatch' ? stopwatchRunning : !!(g && g.startTime && !g.paused && !g.done);
  const playBtn = document.getElementById('btn-timer-play');
  if (playBtn) playBtn.textContent = isRunning ? '⏸' : '▶';
  const focusPauseBtn = document.getElementById('btn-focus-pause');
  if (focusPauseBtn) focusPauseBtn.textContent = isRunning ? '⏸' : '▶';
}

/* ═══════════════════════════════════════════════════════════
   FOCUS OVERLAY (full-screen timer)
═══════════════════════════════════════════════════════════ */
function openFocusOverlay() {
  const g = goals.find(x => x.id === activeTaskId);
  const overlay = document.getElementById('focus-overlay');
  if (!overlay) return;
  const taskTitle = document.getElementById('focus-task-title');
  const badge = document.getElementById('focus-badge');
  if (taskTitle && g) taskTitle.textContent = g.title;
  if (badge && g) { const cat = CATS[g.cat]||CATS.business; badge.textContent = cat.emoji + ' ' + cat.label; }
  overlay.classList.add('open');
}
function closeFocusOverlay() {
  document.getElementById('focus-overlay')?.classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════
   SUBTASK RINGS in timer
═══════════════════════════════════════════════════════════ */
function renderSubtaskRings() {
  const wrap = document.getElementById('subtask-rings');
  if (!wrap) return;
  wrap.innerHTML = '';
  const g = goals.find(x => x.id === activeTaskId);
  if (!g || !g.subtasks?.length) return;
  g.subtasks.forEach(st => {
    const div = mkEl('div', 'subtask-ring' + (st.done ? ' done' : ''));
    div.textContent = st.text.substring(0, 12);
    div.addEventListener('click', () => { st.done = !st.done; saveAll(true); renderSubtaskRings(); });
    wrap.appendChild(div);
  });
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR
═══════════════════════════════════════════════════════════ */
function renderCalendar() {
  const container = document.getElementById('cal-container');
  const navTitle  = document.getElementById('cal-nav-title');
  if (!container || !navTitle) return;

  if (calView === 'month') renderMonthView(container, navTitle);
  else if (calView === 'week') renderWeekView(container, navTitle);
  else renderDayView(container, navTitle);
}

function renderMonthView(container, navTitle) {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  navTitle.textContent = calDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  const first = new Date(y, m, 1).getDay();
  const offset = (first === 0) ? 6 : first - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const tasksByDay = {};
  goals.forEach(g => {
    if (!g.scheduledAt) return;
    const d = new Date(g.scheduledAt);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const day = d.getDate();
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(g);
    }
  });

  const today = new Date();
  container.innerHTML = '';
  const grid = mkEl('div', 'cal-month-grid');
  const weekDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  weekDays.forEach(d => grid.appendChild(mkEl('div', 'cal-weekday', d)));

  for (let i = 0; i < offset; i++) grid.appendChild(mkEl('div', 'cal-day empty'));
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const cell = mkEl('div', `cal-day${isToday ? ' today' : ''}`);
    cell.innerHTML = `<div class="cal-day-num">${d}</div>`;
    const dayTasks = tasksByDay[d] || [];
    dayTasks.slice(0, 3).forEach(g => {
      const dot = mkEl('div', 'cal-task-dot');
      dot.style.background = catColor(g);
      dot.title = g.title;
      dot.addEventListener('click', e => { e.stopPropagation(); openDetailModal(g.id); });
      cell.appendChild(dot);
    });
    if (dayTasks.length > 3) cell.appendChild(mkEl('div', 'cal-more', `+${dayTasks.length - 3}`));
    cell.addEventListener('click', () => {
      const dt = new Date(y, m, d, 9, 0, 0);
      const dInp = document.getElementById('task-date-input');
      if (dInp) dInp.value = `${y}-${pad(m+1)}-${pad(d)}T09:00`;
      openTaskModal();
    });
    grid.appendChild(cell);
  }
  container.appendChild(grid);
}

function renderWeekView(container, navTitle) {
  const startOfWeek = new Date(calDate);
  startOfWeek.setDate(calDate.getDate() - ((calDate.getDay() + 6) % 7));
  navTitle.textContent = `Нед. ${startOfWeek.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })}`;
  container.innerHTML = '';
  const grid = mkEl('div', 'cal-week-grid');
  const today = todayKey();
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
    const dk = dateKey(d.getTime());
    const col = mkEl('div', `cal-week-col${dk === today ? ' today' : ''}`);
    col.innerHTML = `<div class="cal-week-day">${d.toLocaleString('ru-RU', { weekday:'short', day:'numeric' })}</div>`;
    goals.filter(g => g.scheduledAt && dateKey(g.scheduledAt) === dk).forEach(g => {
      const t = mkEl('div', 'cal-week-task');
      t.style.borderLeftColor = catColor(g);
      t.textContent = g.title.substring(0, 20);
      t.addEventListener('click', () => openDetailModal(g.id));
      col.appendChild(t);
    });
    grid.appendChild(col);
  }
  container.appendChild(grid);
}

function renderDayView(container, navTitle) {
  navTitle.textContent = calDate.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' });
  container.innerHTML = '';
  const dk = dateKey(calDate.getTime());
  const dayTasks = goals.filter(g => g.scheduledAt && dateKey(g.scheduledAt) === dk);
  if (!dayTasks.length) { container.appendChild(mkEl('div', 'empty-state', '✨ Нет задач')); return; }
  dayTasks.forEach(g => {
    const card = mkEl('div', 'cal-day-task');
    card.style.borderLeftColor = catColor(g);
    card.innerHTML = `<div class="cdt-time">${fmtTime(g.scheduledAt)}</div><div class="cdt-title">${esc(g.title)}</div>`;
    card.addEventListener('click', () => openDetailModal(g.id));
    container.appendChild(card);
  });
}

/* ═══════════════════════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════════════════════ */
function renderProfile() {
  // Stats
  const todayDone = history.filter(h => dateKey(h.completedAt) === todayKey()).length;
  document.getElementById('stat-streak')?.let ? null : null;
  const statStreak = document.getElementById('stat-streak');
  if (statStreak) statStreak.textContent = streak.days;
  const statToday = document.getElementById('stat-done-today');
  if (statToday) statToday.textContent = todayDone;
  const statTotal = document.getElementById('stat-total-done');
  if (statTotal) statTotal.textContent = history.length;

  // Level & gems
  const lv = getLevel(gems);
  document.getElementById('profile-level') && (document.getElementById('profile-level').textContent = `${lv.emoji} ${lv.label}`);
  document.getElementById('profile-gem-count') && (document.getElementById('profile-gem-count').textContent = gems);

  // Streak card
  renderStreakCard();

  // Macro goals
  renderMacroList();

  // Store
  renderStore();

  // History
  renderHistoryList();
}

function renderStreakCard() {
  const card = document.getElementById('streak-card');
  if (!card) return;
  const days7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dk = dateKey(d.getTime());
    const hasDone = history.some(h => dateKey(h.completedAt) === dk);
    days7.push({ dk, hasDone, day: d.toLocaleDateString('ru-RU', { weekday:'short' }) });
  }
  card.innerHTML = `
    <div class="streak-week">
      ${days7.map(d => `<div class="streak-day${d.hasDone ? ' done' : ''}"><div class="streak-dot"></div><div class="streak-label">${d.day}</div></div>`).join('')}
    </div>
    <div class="streak-info">🔥 ${streak.days} дней подряд${isSunday() ? ' · 😴 День отдыха' : ''}</div>
  `;
}

function renderMacroList() {
  const list = document.getElementById('macro-list');
  if (!list) return;
  if (!macroGoals.length) { list.innerHTML = '<div class="empty-sub">Нет целей</div>'; return; }
  list.innerHTML = macroGoals.map(mg => {
    const linked = goals.filter(g => g.macroId === mg.id && g.done).length;
    const total  = goals.filter(g => g.macroId === mg.id).length;
    const pct = total > 0 ? Math.round(linked / total * 100) : 0;
    return `
      <div class="macro-item" data-id="${mg.id}">
        <div class="macro-top"><span class="macro-title">${esc(mg.title)}</span><span class="macro-reward">💎 ${mg.gemsReward || 50}</span></div>
        <div class="macro-progress-bar"><div class="macro-progress-fill" style="width:${pct}%"></div></div>
        <div class="macro-sub">${linked}/${total} задач · ${pct}%${mg.deadline ? ' · до ' + new Date(mg.deadline).toLocaleDateString('ru-RU') : ''}</div>
      </div>`;
  }).join('');

  list.querySelectorAll('.macro-item').forEach(el => {
    el.addEventListener('click', () => openMacroModal(el.dataset.id));
  });
}

function renderStore() {
  const grid = document.getElementById('store-grid');
  if (!grid) return;
  const filtered = storeFilter === 'all' ? STORE_ITEMS : STORE_ITEMS.filter(i => i.cat === storeFilter);
  grid.innerHTML = filtered.map(item => {
    const qty = storeDraft[item.id] || 1;
    const cost = item.baseCost * qty;
    const canAfford = gems >= cost;
    return `
      <div class="store-card${canAfford ? '' : ' cannot-afford'}">
        <div class="store-icon">${item.icon}</div>
        <div class="store-title">${item.title}</div>
        <div class="store-desc">${item.desc}</div>
        <div class="store-qty-row">
          <button class="store-qty-btn" data-id="${item.id}" data-delta="-1">−</button>
          <span>${qty} ${item.unit}</span>
          <button class="store-qty-btn" data-id="${item.id}" data-delta="1">+</button>
        </div>
        <button class="store-buy-btn${canAfford ? '' : ' disabled'}" data-id="${item.id}">
          ${cost} 💎${canAfford ? '' : ' · Недостаточно'}
        </button>
      </div>`;
  }).join('');

  grid.querySelectorAll('.store-qty-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { id, delta } = btn.dataset;
      storeDraft[id] = Math.max(1, (storeDraft[id] || 1) + parseInt(delta));
      renderStore();
    });
  });
  grid.querySelectorAll('.store-buy-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

function addToCart(itemId) {
  const item = STORE_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  const qty = storeDraft[itemId] || 1;
  const cost = item.baseCost * qty;
  cart.push({ ...item, qty, cost });
  renderCartModal();
  showToast(`🛒 ${item.title} добавлен в корзину`);
}

function renderCartModal() {
  const cartList = document.getElementById('cart-list');
  const cartTotal = document.getElementById('cart-total');
  if (!cartList) return;
  if (!cart.length) { cartList.innerHTML = '<div class="empty-sub">Корзина пуста</div>'; if (cartTotal) cartTotal.textContent = '0 💎'; return; }
  cartList.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <span>${item.icon} ${item.title} × ${item.qty}</span>
      <span>${item.cost} 💎 <button class="cart-remove" data-i="${i}">✕</button></span>
    </div>`).join('');
  const total = cart.reduce((s, i) => s + i.cost, 0);
  if (cartTotal) cartTotal.textContent = `${total} 💎`;
  cartList.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => { cart.splice(parseInt(btn.dataset.i), 1); renderCartModal(); });
  });
}

function checkout() {
  const total = cart.reduce((s, i) => s + i.cost, 0);
  if (gems < total) { showToast('❌ Недостаточно кристаллов'); return; }
  gems -= total;
  cart.forEach(item => {
    purchases.push({ ...item, purchasedAt: Date.now() });
  });
  cart = [];
  saveAll(); renderStore();
  closeModal('modal-cart');
  showToast(`🎉 Покупка совершена! Осталось: ${gems} 💎`);
}

function renderPurchases() {
  const list = document.getElementById('purchases-list');
  if (!list) return;
  if (!purchases.length) { list.innerHTML = '<div class="empty-sub">Нет покупок</div>'; return; }
  list.innerHTML = purchases.slice().reverse().map(p =>
    `<div class="purchase-item"><span>${p.icon} ${p.title} × ${p.qty}</span><span>${p.cost} 💎 · ${fmtRel(p.purchasedAt)}</span></div>`
  ).join('');
}

function renderHistoryList() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const items = history.slice(0, 50);
  if (!items.length) { list.innerHTML = '<div class="empty-sub">История пуста</div>'; return; }
  list.innerHTML = items.map(h => {
    const cat = CATS[h.cat] || CATS.business;
    return `
      <div class="history-item">
        <div class="hist-color" style="background:${h.color || cat.color}"></div>
        <div class="hist-info">
          <div class="hist-title">${esc(h.title)}</div>
          <div class="hist-meta">${cat.emoji} · ${fmtRel(h.completedAt)} · +${h.gems||1} 💎</div>
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   MACRO MODAL
═══════════════════════════════════════════════════════════ */
function openMacroModal(id = null) {
  const mg = id ? macroGoals.find(x => x.id === id) : null;
  document.getElementById('macro-modal-title') && (document.getElementById('macro-modal-title').textContent = mg ? 'Редактировать цель' : 'Новая цель');
  document.getElementById('macro-edit-id') && (document.getElementById('macro-edit-id').value = mg?.id || '');
  document.getElementById('macro-title') && (document.getElementById('macro-title').value = mg?.title || '');
  document.getElementById('macro-deadline') && (document.getElementById('macro-deadline').value = mg?.deadline || '');
  document.getElementById('macro-gems-reward') && (document.getElementById('macro-gems-reward').value = mg?.gemsReward || 50);
  openModal('modal-macro');
}

function saveMacro() {
  const titleEl = document.getElementById('macro-title');
  const title = titleEl?.value.trim();
  if (!title) { showToast('Введи название цели'); return; }
  const id = document.getElementById('macro-edit-id')?.value;
  const deadline = document.getElementById('macro-deadline')?.value;
  const gemsReward = parseInt(document.getElementById('macro-gems-reward')?.value || '50');
  if (id) {
    const mg = macroGoals.find(x => x.id === id);
    if (mg) { mg.title = title; mg.deadline = deadline; mg.gemsReward = gemsReward; }
  } else {
    macroGoals.push({ id: 'macro_' + Date.now().toString(36) + rnd(), title, deadline, gemsReward, createdAt: Date.now() });
  }
  saveAll();
  closeModal('modal-macro');
  renderProfile();
}

/* ═══════════════════════════════════════════════════════════
   GOAL PICKER (for timer)
═══════════════════════════════════════════════════════════ */
function openGoalPicker() {
  const list = document.getElementById('goal-picker-list');
  if (!list) return;
  const activeTasks = goals.filter(g => !g.done);
  if (!activeTasks.length) { list.innerHTML = '<div class="empty-sub">Нет активных задач</div>'; }
  else {
    list.innerHTML = activeTasks.map(g => {
      const cat = CATS[g.cat] || CATS.business;
      return `<div class="picker-item" data-id="${g.id}" style="border-left:3px solid ${catColor(g)}">
        <span>${cat.emoji} ${esc(g.title)}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.picker-item').forEach(el => {
      el.addEventListener('click', () => {
        setTimerGoal(el.dataset.id);
        closeModal('modal-goal-picker');
        renderSubtaskRings();
      });
    });
  }
  openModal('modal-goal-picker');
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════ */
function renderSettings() {
  renderTagsManager();
  renderColorPalette('new-tag-color-pal', TAG_PALETTE[0], c => {
    document.querySelectorAll('#new-tag-color-pal .color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === c));
  });
  // TG
  document.getElementById('tg-bot-token') && (document.getElementById('tg-bot-token').value = localStorage.getItem('цель-tg-token') || '');
  document.getElementById('tg-chat-id') && (document.getElementById('tg-chat-id').value = localStorage.getItem('цель-tg-chat') || '');

  // Theme
  const savedTheme = localStorage.getItem('цель-theme') || 'dark';
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === savedTheme));
}

function renderTagsManager() {
  const mgr = document.getElementById('tags-manager');
  if (!mgr) return;
  mgr.innerHTML = tags.map(t => `
    <div class="tag-mgr-item">
      <span class="tag-dot" style="background:${t.color}"></span>
      <span class="tag-mgr-name">${esc(t.name)}</span>
      <button class="tag-mgr-del" data-id="${t.id}">✕</button>
    </div>`).join('');
  mgr.querySelectorAll('.tag-mgr-del').forEach(btn => {
    btn.addEventListener('click', () => {
      tags = tags.filter(t => t.id !== btn.dataset.id);
      saveAll(); renderTagsManager(); renderTagFilterRow();
    });
  });
}

function renderTagFilterRow() {
  const row = document.getElementById('tag-filter-row');
  if (!row) return;
  row.innerHTML = tags.map(t =>
    `<button class="tag-filter-btn${taskTagFilter === t.id ? ' active' : ''}" data-id="${t.id}" style="border-color:${t.color};color:${t.color}">${t.name}</button>`
  ).join('');
  row.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      taskTagFilter = taskTagFilter === btn.dataset.id ? null : btn.dataset.id;
      renderTagFilterRow();
      renderTaskList();
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   FORM HELPERS
═══════════════════════════════════════════════════════════ */
function renderColorPalette(containerId, currentColor, onChange) {
  const pal = document.getElementById(containerId);
  if (!pal) return;
  pal.innerHTML = COLOR_PALETTE.map(c =>
    `<button class="color-dot${c === currentColor ? ' active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
  ).join('');
  pal.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      pal.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      onChange(dot.dataset.color);
    });
  });
}

function renderTagsPicker() {
  const picker = document.getElementById('task-tags-picker');
  if (!picker) return;
  picker.innerHTML = tags.map(t =>
    `<button class="tag-pick-btn${selectedTags.includes(t.id) ? ' active' : ''}" data-id="${t.id}" style="border-color:${t.color};${selectedTags.includes(t.id) ? `background:${t.color}33;color:${t.color}` : ''}">${t.name}</button>`
  ).join('');
  picker.querySelectorAll('.tag-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (selectedTags.includes(id)) selectedTags = selectedTags.filter(x => x !== id);
      else selectedTags.push(id);
      renderTagsPicker();
    });
  });
}

function renderReminders() {
  const wrap = document.getElementById('task-reminders');
  if (!wrap) return;
  wrap.innerHTML = REMINDER_OPTIONS.map(m => {
    const label = m < 60 ? `${m} мин` : m === 1440 ? '1 день' : `${m/60} ч`;
    const active = selectedReminders.includes(m);
    return `<button class="rem-btn${active ? ' active' : ''}" data-min="${m}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('.rem-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = parseInt(btn.dataset.min);
      if (selectedReminders.includes(m)) selectedReminders = selectedReminders.filter(x => x !== m);
      else selectedReminders.push(m);
      renderReminders();
    });
  });
}

function renderSubtaskInputList(subtasks = []) {
  const list = document.getElementById('subtask-input-list');
  if (!list) return;
  list.innerHTML = subtasks.map((st, i) =>
    `<div class="st-input-row"><input class="form-input" type="text" value="${esc(st.text)}" placeholder="Подзадача…"><button class="st-del" data-i="${i}">✕</button></div>`
  ).join('');
  list.querySelectorAll('.st-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const rows = [...list.querySelectorAll('.st-input-row')];
      rows[parseInt(btn.dataset.i)]?.remove();
    });
  });
}

function renderParticipants() {
  const pList = document.getElementById('participants-list');
  if (!pList) return;
  pList.innerHTML = participants.map((p, i) =>
    `<span class="participant-tag">${esc(p)}<button class="part-del" data-i="${i}">✕</button></span>`
  ).join('');
  pList.querySelectorAll('.part-del').forEach(btn => {
    btn.addEventListener('click', () => { participants.splice(parseInt(btn.dataset.i), 1); renderParticipants(); });
  });
}

/* ═══════════════════════════════════════════════════════════
   VOICE INPUT
═══════════════════════════════════════════════════════════ */
let recognition = null;
function initVoice() {
  try {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { document.getElementById('btn-voice-start')?.setAttribute('disabled', 'true'); return; }
    recognition = new SR();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = e => {
      const txt = [...e.results].map(r => r[0].transcript).join('');
      const transcriptEl = document.getElementById('voice-transcript-text');
      if (transcriptEl) transcriptEl.textContent = txt;
      if (e.results[e.results.length - 1].isFinal) {
        stopVoice();
        applyNLPFromVoice(txt);
      }
    };
    recognition.onerror = () => stopVoice();
    recognition.onend = () => stopVoice();
  } catch(e) { console.warn('Voice not supported', e); }
}

function startVoice() {
  if (!recognition) return;
  document.getElementById('voice-state-idle')?.classList.add('hidden');
  document.getElementById('voice-state-listening')?.classList.remove('hidden');
  try { recognition.start(); } catch(e) {}
}

function stopVoice() {
  document.getElementById('voice-state-idle')?.classList.remove('hidden');
  document.getElementById('voice-state-listening')?.classList.add('hidden');
  try { recognition?.stop(); } catch(e) {}
}

function applyNLPFromVoice(text) {
  const parsed = parseNLP(text);
  closeModal('modal-voice');
  openTaskModal();
  setTimeout(() => {
    document.getElementById('task-title-input') && (document.getElementById('task-title-input').value = parsed.title);
    if (parsed.scheduledAt) {
      const d = new Date(parsed.scheduledAt);
      const dateInp = document.getElementById('task-date-input');
      if (dateInp) dateInp.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.priority === parsed.priority));
    selectedTags = parsed.tags;
    renderTagsPicker();
    const hint = document.getElementById('nlp-hint');
    if (hint) { hint.textContent = `NLP: ${parsed.title}${parsed.scheduledAt ? ' · ' + fmtDateTime(parsed.scheduledAt) : ''}`; hint.classList.remove('hidden'); }
  }, 100);
}

/* ═══════════════════════════════════════════════════════════
   DEMO DATA
═══════════════════════════════════════════════════════════ */
function loadDemoData() {
  const now = Date.now();
  const day = 86400000;
  const demoGoals = [
    { id:'demo_1', title:'Прочитать книгу "Атомные привычки"', cat:'study', priority:'high', color:'#BF5AF2', scheduledAt: now - 3600000, duration_min:60, tags:[], subtasks:[{id:'st1',text:'Глава 1-5',done:true},{id:'st2',text:'Конспект',done:false}], notes:'Ключевые инсайты о привычках', done:false, elapsed:0, createdAt: now - day*3 },
    { id:'demo_2', title:'Тренировка: силовая', cat:'health', priority:'high', color:'#FF9F0A', scheduledAt: now + 7200000, duration_min:45, tags:[], subtasks:[], notes:'Жим, приседания, становая', done:false, elapsed:0, createdAt: now - day },
    { id:'demo_3', title:'Запустить MVP лендинга', cat:'business', priority:'mid', color:'#0A84FF', scheduledAt: now + day, duration_min:120, tags:[], subtasks:[{id:'st3',text:'Дизайн',done:true},{id:'st4',text:'Верстка',done:true},{id:'st5',text:'Деплой',done:false}], notes:'', done:false, elapsed:3600, createdAt: now - day*5 },
    { id:'demo_4', title:'Медитация 10 минут', cat:'life', priority:'low', color:'#30D158', scheduledAt: now + 1800000, duration_min:10, tags:[], subtasks:[], notes:'Дышать, не думать', done:false, elapsed:0, createdAt: now },
    { id:'demo_5', title:'Написать Notion-шаблон для планирования', cat:'creative', priority:'mid', color:'#FF375F', scheduledAt: now + day*2, duration_min:90, tags:[], subtasks:[], notes:'', done:false, elapsed:0, createdAt: now - day*2 },
  ];

  const demoHistory = [
    { id:'h1', goalId:'demo_old_1', title:'Утренняя пробежка 5 км', cat:'health', color:'#FF9F0A', completedAt: now - 3600000,     elapsed_ms:1800000, gems:1 },
    { id:'h2', goalId:'demo_old_2', title:'Созвон с командой',        cat:'business',color:'#0A84FF', completedAt: now - 86400000,    elapsed_ms:3600000, gems:1 },
    { id:'h3', goalId:'demo_old_3', title:'Изучить Vercel KV API',    cat:'study',  color:'#BF5AF2', completedAt: now - 172800000,   elapsed_ms:5400000, gems:1 },
    { id:'h4', goalId:'demo_old_4', title:'Нарисовать wireframe',     cat:'creative',color:'#FF375F',completedAt: now - 259200000,   elapsed_ms:2700000, gems:1 },
    { id:'h5', goalId:'demo_old_5', title:'Ужин с семьёй',            cat:'life',   color:'#30D158', completedAt: now - 345600000,   elapsed_ms:7200000, gems:1 },
  ];

  goals = [...demoGoals, ...goals.filter(g => !g.id.startsWith('demo_'))];
  history = [...demoHistory, ...history.filter(h => !h.id.startsWith('h'))];
  gems = Math.max(gems, 27);
  streak = { days: 5, lastDate: todayKey(), doneToday: true };
  macroGoals = [{
    id: 'macro_demo', title: '🚀 Запустить SaaS-проект', deadline: new Date(now + day*60).toISOString().slice(0,10), gemsReward: 100, createdAt: now - day*10
  }];

  saveAll();
  renderAll();
  closeModal('modal-settings');
  showToast('🎉 Демо-данные загружены!');
}

/* ═══════════════════════════════════════════════════════════
   RENDER ALL
═══════════════════════════════════════════════════════════ */
function renderAll() {
  renderTaskList();
  renderTagFilterRow();
  renderProfile();
  if (currentView === 'calendar') renderCalendar();
  renderTimerGoalCard();
  tickDisplay();
  updateTimerControls();
  renderPomodoroCycles();
}

/* ═══════════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════════ */
function toggleSearch() {
  searchVisible = !searchVisible;
  const wrap = document.getElementById('search-wrap');
  if (wrap) wrap.classList.toggle('open', searchVisible);
  if (searchVisible) {
    document.getElementById('search-input')?.focus();
  } else {
    searchQuery = '';
    document.getElementById('search-input') && (document.getElementById('search-input').value = '');
    renderTaskList();
  }
}

/* ═══════════════════════════════════════════════════════════
   SORT
═══════════════════════════════════════════════════════════ */
function cycleSortMode() {
  const modes = ['date', 'priority', 'cat'];
  sortMode = modes[(modes.indexOf(sortMode) + 1) % modes.length];
  const labels = { date: '⇅ Дата', priority: '⇅ Приоритет', cat: '⇅ Кат.' };
  const btn = document.getElementById('btn-sort');
  if (btn) btn.textContent = labels[sortMode];
  renderTaskList();
}

/* ═══════════════════════════════════════════════════════════
   EXPORT / RESET
═══════════════════════════════════════════════════════════ */
function exportData() {
  const data = { goals, history, gems, streak, macroGoals, tags, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `цель-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('💾 Данные экспортированы');
}

function resetData() {
  if (!confirm('Удалить ВСЕ данные? Это действие необратимо!')) return;
  ['цель-goals','цель-history','цель-gems','цель-streak2','цель-purchases','цель-macros','цель-tags','цель-pomo','цель-uid'].forEach(k => localStorage.removeItem(k));
  loadFromStorage();
  renderAll();
  showToast('🗑 Данные сброшены');
}

/* ═══════════════════════════════════════════════════════════
   EVENT BINDING — BULLETPROOF (all wrapped in try/catch)
═══════════════════════════════════════════════════════════ */
function initEvents() {
  // ── ISLAND NAV ──
  try {
    document.querySelectorAll('.island-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
  } catch(e) { console.warn('[nav]', e); }

  // ── CREATE BUTTON ──
  try {
    document.getElementById('btn-create')?.addEventListener('click', () => openTaskModal());
  } catch(e) { console.warn('[create]', e); }

  // ── SEARCH ──
  try {
    document.getElementById('btn-search-toggle')?.addEventListener('click', toggleSearch);
    document.getElementById('search-input')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderTaskList();
    });
    document.getElementById('search-clear')?.addEventListener('click', () => {
      searchQuery = '';
      document.getElementById('search-input') && (document.getElementById('search-input').value = '');
      renderTaskList();
    });
  } catch(e) { console.warn('[search]', e); }

  // ── SORT ──
  try {
    document.getElementById('btn-sort')?.addEventListener('click', cycleSortMode);
  } catch(e) { console.warn('[sort]', e); }

  // ── SETTINGS ──
  try {
    document.getElementById('btn-settings')?.addEventListener('click', () => { renderSettings(); openModal('modal-settings'); });
    document.getElementById('btn-export-data')?.addEventListener('click', exportData);
    document.getElementById('btn-reset-data')?.addEventListener('click', resetData);
    document.getElementById('btn-save-tg')?.addEventListener('click', () => {
      localStorage.setItem('цель-tg-token', document.getElementById('tg-bot-token')?.value || '');
      localStorage.setItem('цель-tg-chat',  document.getElementById('tg-chat-id')?.value || '');
      showToast('✅ Telegram сохранён');
    });
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.dataset.theme = btn.dataset.theme;
        localStorage.setItem('цель-theme', btn.dataset.theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === btn.dataset.theme));
      });
    });
    // Add tag
    document.getElementById('btn-add-tag')?.addEventListener('click', () => {
      const nameInp = document.getElementById('new-tag-name');
      const name = nameInp?.value.trim();
      if (!name) return;
      const activeDot = document.querySelector('#new-tag-color-pal .color-dot.active');
      const color = activeDot?.dataset.color || TAG_PALETTE[tags.length % TAG_PALETTE.length];
      tags.push({ id: 'tag_' + Date.now().toString(36) + rnd(), name, color });
      if (nameInp) nameInp.value = '';
      saveAll(); renderTagsManager(); renderTagFilterRow();
    });
    // Demo data button
    const demoBtn = document.getElementById('btn-load-demo');
    if (demoBtn) demoBtn.addEventListener('click', loadDemoData);
  } catch(e) { console.warn('[settings]', e); }

  // ── TASK FILTER ──
  try {
    document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        taskFilter = btn.dataset.filter;
        document.querySelectorAll('#task-filter-ctrl .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === taskFilter));
        renderTaskList();
      });
    });
  } catch(e) { console.warn('[filter]', e); }

  // ── TASK MODAL ──
  try {
    document.getElementById('btn-save-task')?.addEventListener('click', saveTask);
    document.getElementById('btn-delete-task')?.addEventListener('click', () => {
      if (!editingTaskId) return;
      goals = goals.filter(g => g.id !== editingTaskId);
      saveAll(); closeModal('modal-task'); renderTaskList(); renderCalendar();
      showToast('🗑 Задача удалена');
    });
    document.getElementById('btn-add-subtask')?.addEventListener('click', () => {
      const list = document.getElementById('subtask-input-list');
      if (!list) return;
      const row = mkEl('div', 'st-input-row');
      row.innerHTML = `<input class="form-input" type="text" placeholder="Подзадача…"><button class="st-del">✕</button>`;
      row.querySelector('.st-del')?.addEventListener('click', () => row.remove());
      list.appendChild(row);
      row.querySelector('input')?.focus();
    });
    document.getElementById('btn-add-participant')?.addEventListener('click', () => {
      const inp = document.getElementById('participant-input');
      const name = inp?.value.trim();
      if (name) { participants.push(name); if(inp) inp.value = ''; renderParticipants(); }
    });
    // Priority ctrl
    document.querySelectorAll('#priority-ctrl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#priority-ctrl .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    // NLP on title input
    document.getElementById('task-title-input')?.addEventListener('input', e => {
      const val = e.target.value;
      if (val.length > 5) {
        const parsed = parseNLP(val);
        const hint = document.getElementById('nlp-hint');
        if (hint && parsed.scheduledAt) {
          hint.textContent = `📅 ${fmtDateTime(parsed.scheduledAt)}`;
          hint.classList.remove('hidden');
        } else if (hint) hint.classList.add('hidden');
      }
    });
  } catch(e) { console.warn('[task modal]', e); }

  // ── DETAIL MODAL ──
  try {
    document.getElementById('btn-td-edit')?.addEventListener('click', () => {
      closeModal('modal-task-detail');
      openTaskModal(detailTaskId);
    });
    document.getElementById('btn-td-done')?.addEventListener('click', () => {
      if (detailTaskId) { completeGoal(detailTaskId); closeModal('modal-task-detail'); }
    });
    document.getElementById('btn-td-timer')?.addEventListener('click', () => {
      if (detailTaskId) { setTimerGoal(detailTaskId); closeModal('modal-task-detail'); switchView('timer'); }
    });
  } catch(e) { console.warn('[detail]', e); }

  // ── TIMER ──
  try {
    document.getElementById('btn-timer-play')?.addEventListener('click', () => {
      const g = goals.find(x => x.id === activeTaskId);
      const isRunning = timerMode === 'stopwatch' ? stopwatchRunning : !!(g && g.startTime && !g.paused && !g.done);
      if (isRunning) pauseTimer(); else startTimer();
    });
    document.getElementById('btn-timer-reset')?.addEventListener('click', resetTimer);
    document.getElementById('btn-timer-done')?.addEventListener('click', completeTimer);
    document.getElementById('btn-pick-timer-goal')?.addEventListener('click', openGoalPicker);
    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cancelAnimationFrame(rafId); rafId = null;
        timerMode = btn.dataset.mode;
        document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === timerMode));
        document.getElementById('pomo-status-wrap')?.classList.toggle('hidden', timerMode !== 'pomodoro');
        document.getElementById('pomo-settings')?.classList.toggle('hidden', timerMode !== 'pomodoro');
        tickDisplay(); updateTimerControls();
      });
    });
    // Pomodoro adj
    document.getElementById('pomo-work-dec')?.addEventListener('click', () => { pomoConfig.work = Math.max(1, pomoConfig.work - 5); updatePomoDisplay(); saveAll(); });
    document.getElementById('pomo-work-inc')?.addEventListener('click', () => { pomoConfig.work = Math.min(60, pomoConfig.work + 5); updatePomoDisplay(); saveAll(); });
    document.getElementById('pomo-short-dec')?.addEventListener('click', () => { pomoConfig.short = Math.max(1, pomoConfig.short - 1); updatePomoDisplay(); saveAll(); });
    document.getElementById('pomo-short-inc')?.addEventListener('click', () => { pomoConfig.short = Math.min(30, pomoConfig.short + 1); updatePomoDisplay(); saveAll(); });
    document.getElementById('pomo-long-dec')?.addEventListener('click', () => { pomoConfig.long = Math.max(5, pomoConfig.long - 5); updatePomoDisplay(); saveAll(); });
    document.getElementById('pomo-long-inc')?.addEventListener('click', () => { pomoConfig.long = Math.min(60, pomoConfig.long + 5); updatePomoDisplay(); saveAll(); });
    // Timer ring click → focus overlay
    document.getElementById('timer-ring-wrap')?.addEventListener('click', openFocusOverlay);
  } catch(e) { console.warn('[timer]', e); }

  // ── FOCUS OVERLAY ──
  try {
    document.getElementById('btn-focus-exit')?.addEventListener('click', closeFocusOverlay);
    document.getElementById('btn-focus-pause')?.addEventListener('click', () => {
      const g = goals.find(x => x.id === activeTaskId);
      const isRunning = timerMode === 'stopwatch' ? stopwatchRunning : !!(g && g.startTime && !g.paused && !g.done);
      if (isRunning) pauseTimer(); else startTimer();
    });
    document.getElementById('btn-focus-done')?.addEventListener('click', () => { completeTimer(); closeFocusOverlay(); });
  } catch(e) { console.warn('[focus]', e); }

  // ── CALENDAR ──
  try {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      if (calView === 'month') calDate.setMonth(calDate.getMonth() - 1);
      else calDate.setDate(calDate.getDate() - 7);
      renderCalendar();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      if (calView === 'month') calDate.setMonth(calDate.getMonth() + 1);
      else calDate.setDate(calDate.getDate() + 7);
      renderCalendar();
    });
    document.querySelectorAll('.cal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        calView = btn.dataset.calView;
        document.querySelectorAll('.cal-tab').forEach(b => b.classList.toggle('active', b.dataset.calView === calView));
        renderCalendar();
      });
    });
  } catch(e) { console.warn('[calendar]', e); }

  // ── PROFILE ──
  try {
    document.getElementById('btn-add-macro')?.addEventListener('click', () => openMacroModal());
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      if (!confirm('Очистить историю?')) return;
      history = []; saveAll(); renderProfile(); showToast('🗑 История очищена');
    });
    document.getElementById('btn-cart')?.addEventListener('click', () => { renderCartModal(); openModal('modal-cart'); });
    document.getElementById('btn-purchases')?.addEventListener('click', () => { renderPurchases(); openModal('modal-purchases'); });
  } catch(e) { console.warn('[profile]', e); }

  // ── MACRO MODAL ──
  try {
    document.getElementById('btn-save-macro')?.addEventListener('click', saveMacro);
  } catch(e) { console.warn('[macro]', e); }

  // ── CART / CHECKOUT ──
  try {
    document.getElementById('btn-checkout')?.addEventListener('click', checkout);
  } catch(e) { console.warn('[cart]', e); }

  // ── VOICE ──
  try {
    document.getElementById('btn-voice-start')?.addEventListener('click', startVoice);
    document.getElementById('btn-voice-stop')?.addEventListener('click', stopVoice);
    document.getElementById('btn-voice-text-parse')?.addEventListener('click', () => {
      const txt = document.getElementById('voice-text-input')?.value.trim();
      if (txt) applyNLPFromVoice(txt);
    });
    // Create button long-press → voice
    let pressTimer = null;
    document.getElementById('btn-create')?.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => openModal('modal-voice'), 600);
    });
    document.getElementById('btn-create')?.addEventListener('pointerup', () => clearTimeout(pressTimer));
  } catch(e) { console.warn('[voice]', e); }

  // ── MODAL CLOSE BUTTONS ──
  try {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
  } catch(e) { console.warn('[modals]', e); }

  // ── KEYBOARD ──
  try {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
        closeFocusOverlay();
      }
    });
  } catch(e) { console.warn('[keyboard]', e); }
}

function updatePomoDisplay() {
  document.getElementById('pomo-work-val') && (document.getElementById('pomo-work-val').textContent = pomoConfig.work);
  document.getElementById('pomo-short-val') && (document.getElementById('pomo-short-val').textContent = pomoConfig.short);
  document.getElementById('pomo-long-val') && (document.getElementById('pomo-long-val').textContent = pomoConfig.long);
}

/* ═══════════════════════════════════════════════════════════
   ADD DEMO BUTTON TO SETTINGS MODAL
   (injected dynamically since HTML might not have it)
═══════════════════════════════════════════════════════════ */
function injectDemoButton() {
  try {
    const settingsModal = document.querySelector('#modal-settings .modal-body');
    if (!settingsModal || document.getElementById('btn-load-demo')) return;
    const section = mkEl('div', 'settings-section');
    section.innerHTML = `
      <div class="settings-section-title">Демо</div>
      <div class="settings-row">
        <div class="settings-row-label">Тест UI</div>
        <button class="settings-btn" id="btn-load-demo">🎮 Загрузить демо-данные</button>
      </div>`;
    settingsModal.appendChild(section);
    document.getElementById('btn-load-demo')?.addEventListener('click', loadDemoData);
  } catch(e) { console.warn('[demo btn]', e); }
}

/* ═══════════════════════════════════════════════════════════
   MIDNIGHT TICK (streak check every minute)
═══════════════════════════════════════════════════════════ */
function startMidnightTick() {
  setInterval(streakMidnightCheck, 60000);
}

/* ═══════════════════════════════════════════════════════════
   APPLY SAVED THEME
═══════════════════════════════════════════════════════════ */
function applyTheme() {
  const theme = localStorage.getItem('цель-theme') || 'dark';
  document.body.dataset.theme = theme;
}

/* ═══════════════════════════════════════════════════════════
   INIT — BULLETPROOF, each module in try/catch
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  try { applyTheme(); } catch(e) { console.error('[theme]', e); }
  try { loadFromStorage(); } catch(e) { console.error('[storage]', e); }
  try { streakMidnightCheck(); } catch(e) { console.error('[streak check]', e); }
  try { injectDemoButton(); } catch(e) { console.error('[demo inject]', e); }
  try { initEvents(); } catch(e) { console.error('[events]', e); }
  try { renderAll(); } catch(e) { console.error('[render]', e); }
  try { initVoice(); } catch(e) { console.error('[voice]', e); }
  try { rescheduleAllReminders(); } catch(e) { console.error('[reminders]', e); }
  try { startMidnightTick(); } catch(e) { console.error('[tick]', e); }
  try { updatePomoDisplay(); } catch(e) { console.error('[pomo display]', e); }
  // KV sync: load from cloud after a short delay
  setTimeout(() => {
    try { loadFromKV(); } catch(e) { console.warn('[KV init]', e); }
  }, 2000);
  console.log('[ЦЕЛЬ v3.0] ✅ Инициализация завершена');
});
'''

print(f"Writing {len(CODE)} bytes to {TARGET}...")
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(CODE)

# Verify
import os
size = os.path.getsize(TARGET)
print(f"✅ Done. File size: {size} bytes ({size/1024:.1f} KB)")

# Quick sanity checks
with open(TARGET, 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ('DOMContentLoaded', 'Init block'),
    ('island-btn', 'Island nav'),
    ('ring-fill', 'Timer ring ID (new)'),
    ('ring-time', 'Timer time ID (new)'),
    ('toast-stack', 'Toast stack (new)'),
    ('task-list', 'Task list'),
    ('loadDemoData', 'Demo data function'),
    ('scheduleKVSync', 'KV sync'),
    ('try {', 'try/catch safety'),
]

print("\nSanity checks:")
all_ok = True
for needle, desc in checks:
    found = needle in content
    status = "✅" if found else "❌"
    print(f"  {status} {desc}: '{needle}'")
    if not found: all_ok = False

print(f"\n{'✅ ALL CHECKS PASSED' if all_ok else '❌ SOME CHECKS FAILED'}")
print(f"\nLines: {content.count(chr(10))}")

# Check OLD problematic IDs are NOT present
old_ids = ['popup-stack', 'search-bar-wrap', 'ring-fill-el', 'timer-time-display', 'timer-time-sub', 'timer-cat-badge']
print("\nOld IDs (should be absent):")
for old_id in old_ids:
    found = old_id in content
    status = "✅ absent" if not found else "⚠️ STILL PRESENT"
    print(f"  {status}: '{old_id}'")
