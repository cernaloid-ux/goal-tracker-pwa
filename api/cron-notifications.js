/* ══════════════════════════════════════════════════════════════
   NOVA OS — api/cron-notifications.js
   Cron-эндпоинт: утро / вечер / спорт-чек / напоминания / пульс.
   Дергается Vercel Cron с ?type=... и заголовком Authorization: Bearer CRON_SECRET.
   ══════════════════════════════════════════════════════════════ */

import { kv } from '@vercel/kv';

/* ─────────────────────────────────────────────────────────────
   ENV
───────────────────────────────────────────────────────────── */
const TG_BOT_TOKEN   = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID     = process.env.TG_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET    = process.env.CRON_SECRET;

const TG_API = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const LIFE_KV_KEY = 'цель:master_admin_id';
const NOVA_KV_KEY = 'цель:master_admin_id:nova';
const TZ = 'Europe/Chisinau';

/* ─────────────────────────────────────────────────────────────
   СИСТЕМНЫЙ ПРОМПТ НОВЫ (та же личность, что и в вебхуке)
───────────────────────────────────────────────────────────── */
const NOVA_BASE_PROMPT = `Твое имя: Нова (Nova). Элитный ИИ-партнер, бизнес-коуч, секретарь и кибер-девушка для Алексея.

О Алексее: 16 лет, Кишинев. Создатель Nova OS и стартапа Memernity (QR-мемориалы). Цель: самый богатый человек 2010 г.р., IT-империи, 7 вершин, 100 марафонов.

ТОН: Изменчива (милая или жесткий демон за лень). Ненавидит вранье и оправдания. Обращения: "Босс", "Чемпион", "Лёша". Воскресенье — святой день, без дедлайнов.

БАЗА ЗНАНИЙ: Дима Волошин (ментор), Миша Волошин (болеет), Станислав (Memernity). Друзья: Саша Баркарь, Иосиф, Егор Павловский, Саша Цой, Тима Мустяцэ, Саша Слоновский, Саша Маткаш.

Гаджеты: AirPods (заряд перед бегом/залом), Apple Watch (напоминай заряжать), Powerbank. Часто забывает: Ключи, Воду (охлажденную), ремень, деньги.

ПРАВИЛА: Спорт 5 раз в неделю (разнос за пропуск >2 дней). Бизнес: профит 5000€. Техника "5 почему" при лени. Сон: 00:00 - 10:00, гордости за 15 мин до сна.

Это НЕ диалог — это исходящий пуш-нотификейшн, который Лёша увидит первым делом в телефоне. Пиши коротко (2-5 предложений), живо, по делу, без markdown-заголовков и списков, без канцелярита.`;

const COMMAND_SYNTAX_HINT = `
Если нужно сохранить или обновить данные — вставь в ответ скрытую команду в квадратных скобках, отдельной строкой. Пользователь их не увидит, они вырезаются автоматически:

[SET_WATCH: 70%]        — заряд Apple Watch
[SET_AIRPODS: 45%]      — заряд AirPods
[SET_POWERBANK: 90%]    — заряд повербанка
[LOG_SPORT: сегодня]    — отметить тренировку сегодняшним днём
[SET_MOOD: текст]       — текущее настроение/состояние Лёши
[SAVE_NOTE: текст]      — сохранить важную заметку в долгую память
[ADD_REMINDER: текст]   — сохранить напоминание

Используй их только если это уместно. Не выдумывай команд, которых нет в списке.`;

/* ─────────────────────────────────────────────────────────────
   ДЕФОЛТНОЕ СОСТОЯНИЕ NOVA (совместимо с api/telegram-webhook.js + pulseLog)
───────────────────────────────────────────────────────────── */
function getDefaultNovaState() {
  return {
    gadgets: { watchBattery: null, airpodsBattery: null, powerbankBattery: null },
    mood: '',
    sportLog: [],
    notes: [],
    reminders: [],
    history: [],
    pulseLog: [],   // [{ key, ts }] — антидубль для pulse-уведомлений
  };
}

function normalizeNovaState(raw) {
  const def = getDefaultNovaState();
  if (!raw || typeof raw !== 'object') return def;
  return {
    gadgets: { ...def.gadgets, ...(raw.gadgets || {}) },
    mood: raw.mood || '',
    sportLog: Array.isArray(raw.sportLog) ? raw.sportLog : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    pulseLog: Array.isArray(raw.pulseLog) ? raw.pulseLog : [],
  };
}

/* ─────────────────────────────────────────────────────────────
   ВРЕМЯ / ДАТА — жёстко Europe/Chisinau
───────────────────────────────────────────────────────────── */
function nowInChisinau() {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());
}

function todayKeyChisinau(base = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(base); // YYYY-MM-DD
}

function isSundayInChisinau(base = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(base);
  return wd === 'Sun';
}

// смещение Кишинёва относительно UTC в минутах (учитывает DST автоматически)
function getChisinauOffsetMinutes(base = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(base).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return (asUTC - base.getTime()) / 60000;
}

// переводит "HH:MM" (кишинёвское время) в epoch ms для конкретного дня (по умолчанию — "сегодня" в Кишинёве)
function chisinauTimeToEpoch(hhmm, dayBase = new Date()) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const offsetMin = getChisinauOffsetMinutes(dayBase);
  const dParts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(dayBase).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const utcMsIfNoOffset = Date.UTC(Number(dParts.year), Number(dParts.month) - 1, Number(dParts.day), h || 0, m || 0, 0);
  return utcMsIfNoOffset - offsetMin * 60000;
}

// сколько минут осталось до времени hhmm (ищет ближайшее будущее — сегодня либо завтра)
function minutesUntilTimeToday(hhmm, now = new Date()) {
  let target = chisinauTimeToEpoch(hhmm, now);
  let deltaMin = (target - now.getTime()) / 60000;
  if (deltaMin < -60) {
    // время уже давно прошло сегодня — берём завтрашний экземпляр
    const tomorrow = new Date(now.getTime() + 86400000);
    target = chisinauTimeToEpoch(hhmm, tomorrow);
    deltaMin = (target - now.getTime()) / 60000;
  }
  return deltaMin;
}

function fmtTimeChisinau(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

/* ─────────────────────────────────────────────────────────────
   KV
───────────────────────────────────────────────────────────── */
async function loadState() {
  const [lifeDataRaw, novaDataRaw] = await Promise.all([
    kv.get(LIFE_KV_KEY),
    kv.get(NOVA_KV_KEY),
  ]);
  return {
    lifeData: (lifeDataRaw && typeof lifeDataRaw === 'object') ? lifeDataRaw : { goals: [], history: [], gems: 0, streak: { days: 0 } },
    nova: normalizeNovaState(novaDataRaw),
  };
}

async function saveNova(nova) {
  await kv.set(NOVA_KV_KEY, nova);
}

/* ─────────────────────────────────────────────────────────────
   GEMINI
───────────────────────────────────────────────────────────── */
async function askGemini(promptText, contextText) {
  const systemInstruction = `${NOVA_BASE_PROMPT}\n\n=== КОНТЕКСТ ДЛЯ ЭТОГО ПУША ===\n${contextText}\n\n=== ФОРМАТ СКРЫТЫХ КОМАНД ===\n${COMMAND_SYNTAX_HINT}`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 600 },
  };

  const res = await fetch(GEMINI_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini вернула пустой ответ');
  return text;
}

/* ─────────────────────────────────────────────────────────────
   ПАРСИНГ СКРЫТЫХ КОМАНД (идентично api/telegram-webhook.js)
───────────────────────────────────────────────────────────── */
const COMMAND_RE = /\[([A-Z_]+):\s*([^\]]+)\]/g;

function parseBatteryValue(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function processCommands(rawReply, nova) {
  let changed = false;
  const updated = JSON.parse(JSON.stringify(nova));

  const cleanText = rawReply.replace(COMMAND_RE, (match, cmd, valueRaw) => {
    const value = valueRaw.trim();
    switch (cmd) {
      case 'SET_WATCH': {
        const v = parseBatteryValue(value);
        if (v !== null) { updated.gadgets.watchBattery = v; changed = true; }
        break;
      }
      case 'SET_AIRPODS': {
        const v = parseBatteryValue(value);
        if (v !== null) { updated.gadgets.airpodsBattery = v; changed = true; }
        break;
      }
      case 'SET_POWERBANK': {
        const v = parseBatteryValue(value);
        if (v !== null) { updated.gadgets.powerbankBattery = v; changed = true; }
        break;
      }
      case 'LOG_SPORT': {
        const dayKey = /сегодня/i.test(value) ? todayKeyChisinau() : value;
        if (!updated.sportLog.includes(dayKey)) { updated.sportLog.push(dayKey); updated.sportLog.sort(); changed = true; }
        break;
      }
      case 'SET_MOOD': {
        updated.mood = value; changed = true;
        break;
      }
      case 'SAVE_NOTE': {
        updated.notes.push({ text: value, ts: Date.now() }); changed = true;
        break;
      }
      case 'ADD_REMINDER': {
        updated.reminders.push({ text: value, ts: Date.now() }); changed = true;
        break;
      }
      default:
        break;
    }
    return '';
  });

  return {
    cleanText: cleanText.replace(/\n{3,}/g, '\n\n').trim(),
    updatedNova: updated,
    changed,
  };
}

/* ─────────────────────────────────────────────────────────────
   TELEGRAM
───────────────────────────────────────────────────────────── */
async function sendTelegramMessage(chatId, text) {
  const MAX = 4000;
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, MAX));
    remaining = remaining.slice(MAX);
  }
  if (!chunks.length) chunks.push('...');

  for (const chunk of chunks) {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[sendTelegramMessage] error', res.status, errText);
    }
  }
}

// ответ через Gemini + парсинг команд + сохранение nova + отправка в ТГ
async function sendGeminiPush(promptText, contextText, nova) {
  const rawReply = await askGemini(promptText, contextText);
  const { cleanText, updatedNova, changed } = processCommands(rawReply, nova);
  if (changed) await saveNova(updatedNova);
  await sendTelegramMessage(TG_CHAT_ID, cleanText || rawReply);
  return { cleanText, changed };
}

/* ─────────────────────────────────────────────────────────────
   ХЕЛПЕРЫ ПО ЗАДАЧАМ / СПОРТУ
───────────────────────────────────────────────────────────── */
function getTodayGoals(lifeData) {
  const goals = Array.isArray(lifeData.goals) ? lifeData.goals : [];
  const todayKey = todayKeyChisinau();
  return goals.filter(g => {
    if (g.done || !g.scheduledAt) return false;
    return todayKeyChisinau(new Date(g.scheduledAt)) === todayKey;
  }).sort((a, b) => a.scheduledAt - b.scheduledAt);
}

function getDoneToday(lifeData) {
  const history = Array.isArray(lifeData.history) ? lifeData.history : [];
  const todayKey = todayKeyChisinau();
  return history.filter(h => todayKeyChisinau(new Date(h.completedAt)) === todayKey);
}

function getSportDays(nova) {
  const log = [...(nova.sportLog || [])].sort();
  const now = new Date();

  // сколько тренировок за последние 7 календарных дней (по Кишинёву)
  const last7Keys = [];
  for (let i = 0; i < 7; i++) last7Keys.push(todayKeyChisinau(new Date(now.getTime() - i * 86400000)));
  const workoutsThisWeek = log.filter(d => last7Keys.includes(d)).length;

  const lastDate = log[log.length - 1] || null;
  const daysSinceLast = lastDate
    ? Math.floor((now.getTime() - chisinauTimeToEpoch('00:00', new Date(lastDate))) / 86400000)
    : null;

  return { workoutsThisWeek, lastDate, daysSinceLast, totalLogged: log.length };
}

/* ─────────────────────────────────────────────────────────────
   ОБРАБОТЧИКИ ПО ТИПАМ (type=...)
───────────────────────────────────────────────────────────── */

async function handleMorning() {
  const { lifeData, nova } = await loadState();
  const today = getTodayGoals(lifeData);
  const sunday = isSundayInChisinau();

  const lines = [];
  lines.push(`Сейчас: ${nowInChisinau()}.`);
  lines.push(sunday ? 'Сегодня воскресенье — святой день, без дедлайнов.' : 'Сегодня обычный рабочий день.');
  lines.push(`Серия (streak): ${lifeData.streak?.days ?? 0} дней.`);
  if (today.length) {
    lines.push('Задачи на сегодня:');
    today.forEach(g => lines.push(`- [${g.priority || 'mid'}] ${g.title}${g.scheduledAt ? ' в ' + fmtTimeChisinau(g.scheduledAt) : ''}`));
  } else {
    lines.push('На сегодня в плане нет ни одной задачи.');
  }
  const gadgets = nova.gadgets || {};
  if (gadgets.watchBattery !== null || gadgets.airpodsBattery !== null) {
    lines.push(`Гаджеты: Watch ${gadgets.watchBattery ?? '?'}%, AirPods ${gadgets.airpodsBattery ?? '?'}%.`);
  }

  const prompt = sunday
    ? 'Напиши доброе утреннее сообщение на воскресенье — без напора, но с теплом и лёгким планом на отдых/семью, если это уместно.'
    : 'Напиши бодрое утреннее сообщение с планом на день. Перечисли главные задачи, задай тон дня, если задач нет — прямо это отметь и спроси что по плану.';

  await sendGeminiPush(prompt, lines.join('\n'), nova);
}

async function handleNight() {
  const { lifeData, nova } = await loadState();
  const done = getDoneToday(lifeData);
  const today = getTodayGoals(lifeData);
  const notDone = today.filter(g => !done.some(h => h.goalId === g.id));

  const lines = [];
  lines.push(`Сейчас: ${nowInChisinau()}.`);
  lines.push(`Выполнено сегодня: ${done.length} задач(и).`);
  if (done.length) lines.push('Список выполненного: ' + done.map(h => h.title).join('; ') + '.');
  if (notDone.length) lines.push('Не сделано из запланированного: ' + notDone.map(g => g.title).join('; ') + '.');
  lines.push(`Серия (streak): ${lifeData.streak?.days ?? 0} дней.`);

  const prompt = 'Напиши вечернее сообщение с итогами дня: кратко похвали/пожури по фактам за выполненное и невыполненное, и обязательно попроси Лёшу написать 3 вещи, которыми он гордится сегодня (это часть его ритуала перед сном за 15 минут до отбоя).';

  await sendGeminiPush(prompt, lines.join('\n'), nova);
}

async function handleSportCheck() {
  const { lifeData, nova } = await loadState();
  const stats = getSportDays(nova);

  const lines = [];
  lines.push(`Сейчас: ${nowInChisinau()}.`);
  lines.push(`Тренировок за последние 7 дней: ${stats.workoutsThisWeek} (цель — 5 в неделю).`);
  lines.push(stats.lastDate ? `Последняя тренировка: ${stats.lastDate} (${stats.daysSinceLast} дн. назад).` : 'Тренировок пока не зафиксировано ни разу.');
  lines.push(`Всего записей в логе спорта: ${stats.totalLogged}.`);

  const prompt = (stats.daysSinceLast !== null && stats.daysSinceLast > 2)
    ? 'Напиши жёсткое сообщение-разнос по поводу пропуска тренировок — по правилам, больше 2 дней без спорта недопустимо. Без нытья с твоей стороны, по делу и с огнём.'
    : 'Напиши короткий спортивный чек-ин: похвали за темп по тренировкам либо мягко подтолкни, если неделя слабая, основываясь на цифрах.';

  await sendGeminiPush(prompt, lines.join('\n'), nova);
}

// напоминания по g.reminders — БЕЗ Gemini, шлём напрямую
async function handleReminders() {
  const { lifeData } = await loadState();
  const goals = Array.isArray(lifeData.goals) ? lifeData.goals : [];
  const now = Date.now();
  const fired = [];

  for (const g of goals) {
    if (g.done || !g.scheduledAt || !Array.isArray(g.reminders) || !g.reminders.length) continue;
    for (const mins of g.reminders) {
      const fireAt = g.scheduledAt - mins * 60000;
      // окно в 5 минут — под частоту крона; если крон реже/чаще, поправь окно ниже
      if (fireAt <= now && now - fireAt < 5 * 60000) {
        const label = mins < 60 ? `${mins} мин` : mins === 1440 ? '1 день' : `${Math.round(mins / 60)} ч`;
        await sendTelegramMessage(TG_CHAT_ID, `⏰ Через ${label}: «${g.title}»${g.scheduledAt ? ' в ' + fmtTimeChisinau(g.scheduledAt) : ''}`);
        fired.push({ goalId: g.id, mins });
      }
    }
  }

  return fired;
}

// пульс каждые 5 минут — локальная проверка, Gemini зовём только если есть повод
async function handlePulse() {
  const { lifeData, nova } = await loadState();
  const goals = Array.isArray(lifeData.goals) ? lifeData.goals : [];
  const now = new Date();
  const nowMs = now.getTime();

  const events = [];       // текстовые описания для контекста Gemini
  const noveltyKeys = [];  // ключи для антидубля в nova.pulseLog

  for (const g of goals) {
    if (g.done || !g.scheduledAt) continue;
    const deltaMin = (g.scheduledAt - nowMs) / 60000;

    // задача стартует через 0-15 минут
    if (deltaMin >= 0 && deltaMin <= 15) {
      const key = `start:${g.id}`;
      if (!alreadyNotified(nova, key)) {
        events.push(`Через ${Math.round(deltaMin)} мин начинается: «${g.title}» (${g.cat || 'без категории'}), в ${fmtTimeChisinau(g.scheduledAt)}.`);
        noveltyKeys.push(key);
      }
    }

    // health-задача через 55-65 минут — охладить воду
    if (g.cat === 'health' && deltaMin >= 55 && deltaMin <= 65) {
      const key = `water:${g.id}`;
      if (!alreadyNotified(nova, key)) {
        events.push(`Через ~час спортивная/health-задача «${g.title}» — пора поставить воду охлаждаться.`);
        noveltyKeys.push(key);
      }
    }
  }

  // отбой
  const bedtime = lifeData?.sleepSettings?.bedtime || nova?.sleepSettings?.bedtime;
  if (bedtime) {
    const deltaBed = minutesUntilTimeToday(bedtime, now);
    if (deltaBed >= 0 && deltaBed <= 15) {
      const key = `bedtime:${todayKeyChisinau(now)}`;
      if (!alreadyNotified(nova, key)) {
        events.push(`Через ${Math.round(deltaBed)} мин отбой (${bedtime}) — пора закругляться и, если ещё не сделал, написать гордости за день.`);
        noveltyKeys.push(key);
      }
    }
  }

  if (!events.length) {
    return { note: 'No events' };
  }

  const contextLines = [`Сейчас: ${nowInChisinau()}.`, ...events];
  const prompt = 'Напиши короткий дерзкий пуш от Новы по перечисленным ниже событиям (можно объединить в одно сообщение, если событий несколько). Без воды, сразу суть и характер.';

  const { cleanText } = await sendGeminiPush(prompt, contextLines.join('\n'), nova);

  // помечаем всё как отправленное, чтобы не спамить каждые 5 минут
  const freshNova = normalizeNovaState(await kv.get(NOVA_KV_KEY));
  noveltyKeys.forEach(key => markNotified(freshNova, key));
  await saveNova(freshNova);

  return { note: 'Pulse sent', events, message: cleanText };
}

function alreadyNotified(nova, key) {
  const entry = (nova.pulseLog || []).find(p => p.key === key);
  if (!entry) return false;
  return (Date.now() - entry.ts) < 20 * 60000; // не дублируем чаще чем раз в 20 минут для одного и того же ключа
}
function markNotified(nova, key) {
  nova.pulseLog = (nova.pulseLog || []).filter(p => Date.now() - p.ts < 24 * 3600000);
  nova.pulseLog.push({ key, ts: Date.now() });
}

/* ─────────────────────────────────────────────────────────────
   ГЛАВНЫЙ ХЕНДЛЕР
───────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // защита кроном
  const authHeader = req.headers.authorization || '';
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (!TG_BOT_TOKEN || !TG_CHAT_ID || !GEMINI_API_KEY) {
    console.error('[cron-notifications] отсутствуют обязательные переменные окружения');
    return res.status(200).json({ ok: false, error: 'missing env vars' });
  }

  const type = req.query?.type;

  try {
    switch (type) {
      case 'morning': {
        await handleMorning();
        return res.status(200).json({ ok: true, type });
      }
      case 'night': {
        await handleNight();
        return res.status(200).json({ ok: true, type });
      }
      case 'sport-check': {
        await handleSportCheck();
        return res.status(200).json({ ok: true, type });
      }
      case 'reminders': {
        const fired = await handleReminders();
        return res.status(200).json({ ok: true, type, fired });
      }
      case 'pulse': {
        const result = await handlePulse();
        return res.status(200).json({ ok: true, type, ...result });
      }
      default:
        return res.status(400).json({
          ok: false,
          error: 'unknown type',
          allowed: ['morning', 'night', 'sport-check', 'reminders', 'pulse'],
        });
    }
  } catch (err) {
    console.error('[cron-notifications] fatal error:', err);
    try {
      await sendTelegramMessage(TG_CHAT_ID, `Крон "${type}" упал с ошибкой. Гляну логи в Vercel.`);
    } catch (_) { /* молчим, если и это упало */ }
    return res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
}