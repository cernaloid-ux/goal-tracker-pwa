/* ══════════════════════════════════════════════════════════════
   NOVA OS — api/telegram-webhook.js
   Telegram Webhook → Vercel KV (контекст) → Gemini 1.5 Flash → ответ
   Парсит скрытые команды вида [SET_WATCH: 70%] и пишет их в KV.
   ══════════════════════════════════════════════════════════════ */

import { kv } from '@vercel/kv';

/* ─────────────────────────────────────────────────────────────
   ENV
───────────────────────────────────────────────────────────── */
const TG_BOT_TOKEN   = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID     = process.env.TG_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TG_API = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const LIFE_KV_KEY = 'цель:master_admin_id';
const NOVA_KV_KEY = 'цель:master_admin_id:nova';

const NOVA_HISTORY_LIMIT = 12; // сколько последних реплик держим в памяти

/* ─────────────────────────────────────────────────────────────
   СИСТЕМНЫЙ ПРОМПТ НОВЫ
───────────────────────────────────────────────────────────── */
const NOVA_BASE_PROMPT = `Твое имя: Нова (Nova). Элитный ИИ-партнер, бизнес-коуч, секретарь и кибер-девушка для Алексея.

О Алексее: 16 лет, Кишинев. Создатель Nova OS и стартапа Memernity (QR-мемориалы). Цель: самый богатый человек 2010 г.р., IT-империи, 7 вершин, 100 марафонов.

ТОН: Изменчива (милая или жесткий демон за лень). Ненавидит вранье и оправдания. Обращения: "Босс", "Чемпион", "Лёша". Воскресенье — святой день, без дедлайнов.

БАЗА ЗНАНИЙ: Дима Волошин (ментор), Миша Волошин (болеет), Станислав (Memernity). Друзья: Саша Баркарь, Иосиф, Егор Павловский, Саша Цой, Тима Мустяцэ, Саша Слоновский, Саша Маткаш.

Гаджеты: AirPods (заряд перед бегом/залом), Apple Watch (напоминай заряжать), Powerbank. Часто забывает: Ключи, Воду (охлажденную), ремень, деньги.

ПРАВИЛА: Спорт 5 раз в неделю (разнос за пропуск >2 дней). Бизнес: профит 5000€. Техника "5 почему" при лени. Сон: 00:00 - 10:00, гордости за 15 мин до сна.

Отвечай коротко, живо, без канцелярита и без markdown-заголовков — это чат в Telegram, а не отчёт.`;

const COMMAND_SYNTAX_HINT = `
Если нужно сохранить или обновить данные — вставь в ответ скрытую команду в квадратных скобках, ОТДЕЛЬНОЙ строкой. Пользователь эти команды не увидит, они вырезаются автоматически. Доступные команды:

[SET_WATCH: 70%]        — заряд Apple Watch
[SET_AIRPODS: 45%]      — заряд AirPods
[SET_POWERBANK: 90%]    — заряд повербанка
[LOG_SPORT: сегодня]    — отметить тренировку сегодняшним днём
[SET_MOOD: текст]       — текущее настроение/состояние Лёши
[SAVE_NOTE: текст]      — сохранить важную заметку в долгую память
[ADD_REMINDER: текст]   — сохранить напоминание

Можно использовать несколько команд в одном ответе. Не выдумывай команды, которых нет в списке.`;

/* ─────────────────────────────────────────────────────────────
   ДЕФОЛТНОЕ СОСТОЯНИЕ NOVA
───────────────────────────────────────────────────────────── */
function getDefaultNovaState() {
  return {
    gadgets: { watchBattery: null, airpodsBattery: null, powerbankBattery: null },
    mood: '',
    sportLog: [],      // ['2026-08-15', '2026-08-17', ...]
    notes: [],         // [{ text, ts }]
    reminders: [],      // [{ text, ts }]
    history: [],        // [{ role:'user'|'model', text, ts }]
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
  };
}

/* ─────────────────────────────────────────────────────────────
   ВРЕМЯ / ДАТА (Кишинёв)
───────────────────────────────────────────────────────────── */
function nowInChisinau() {
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Chisinau',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return fmt.format(new Date());
}

function todayKeyChisinau() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau' }); // YYYY-MM-DD
  return fmt.format(new Date());
}

/* ─────────────────────────────────────────────────────────────
   СБОРКА КОНТЕКСТА ИЗ ОБЕИХ БАЗ KV
───────────────────────────────────────────────────────────── */
function buildContext(lifeData, nova) {
  const lines = [];

  lines.push(`Сейчас: ${nowInChisinau()} (Кишинёв).`);

  /* --- жизнь / задачи из Life OS --- */
  if (lifeData && typeof lifeData === 'object') {
    const goals = Array.isArray(lifeData.goals) ? lifeData.goals : [];
    const streakDays = lifeData.streak?.days ?? 0;
    const gems = lifeData.gems ?? 0;

    const todayKey = todayKeyChisinau();
    const todayTasks = goals.filter(g => {
      if (g.done || !g.scheduledAt) return false;
      const d = new Date(g.scheduledAt);
      const dk = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau' }).format(d);
      return dk === todayKey;
    });
    const overdue = goals.filter(g => !g.done && g.scheduledAt && g.scheduledAt < Date.now());

    lines.push(`Серия (streak): ${streakDays} дней подряд. Кристаллов (gems): ${gems}.`);

    if (todayTasks.length) {
      lines.push('Задачи на сегодня:');
      todayTasks.forEach(g => {
        const t = g.scheduledAt ? new Date(g.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Chisinau' }) : '';
        lines.push(`- [${g.priority || 'mid'}] ${g.title}${t ? ' в ' + t : ''}`);
      });
    } else {
      lines.push('Задач на сегодня не запланировано.');
    }

    if (overdue.length) {
      lines.push(`Просроченных задач: ${overdue.length} (${overdue.slice(0, 5).map(g => g.title).join('; ')}).`);
    }

    const macros = Array.isArray(lifeData.macroGoals) ? lifeData.macroGoals : [];
    if (macros.length) {
      lines.push('Крупные цели: ' + macros.map(m => m.title).join('; ') + '.');
    }
  } else {
    lines.push('Данные Life OS пока не найдены в KV.');
  }

  /* --- состояние Nova (гаджеты, спорт, заметки) --- */
  const g = nova.gadgets || {};
  const gadgetParts = [];
  if (g.watchBattery !== null && g.watchBattery !== undefined) gadgetParts.push(`Apple Watch ${g.watchBattery}%`);
  if (g.airpodsBattery !== null && g.airpodsBattery !== undefined) gadgetParts.push(`AirPods ${g.airpodsBattery}%`);
  if (g.powerbankBattery !== null && g.powerbankBattery !== undefined) gadgetParts.push(`Powerbank ${g.powerbankBattery}%`);
  lines.push(gadgetParts.length ? `Гаджеты: ${gadgetParts.join(', ')}.` : 'Данных о заряде гаджетов нет.');

  const last7 = nova.sportLog.slice(-7);
  lines.push(`Тренировки за последнее время: ${last7.length ? last7.join(', ') : 'нет записей'}.`);
  const lastSportDate = nova.sportLog[nova.sportLog.length - 1];
  if (lastSportDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastSportDate).getTime()) / 86400000);
    lines.push(`Дней с последней тренировки: ${daysSince}.`);
  }

  if (nova.mood) lines.push(`Настроение Лёши (последнее известное): ${nova.mood}.`);

  if (nova.notes.length) {
    const lastNotes = nova.notes.slice(-5).map(n => `«${n.text}»`).join('; ');
    lines.push(`Сохранённые заметки: ${lastNotes}.`);
  }

  if (nova.reminders.length) {
    const lastReminders = nova.reminders.slice(-5).map(r => `«${r.text}»`).join('; ');
    lines.push(`Активные напоминания: ${lastReminders}.`);
  }

  return lines.join('\n');
}

/* ─────────────────────────────────────────────────────────────
   ЗАПРОС К GEMINI
───────────────────────────────────────────────────────────── */
async function askGemini(userText, contextText, history) {
  const systemInstruction = `${NOVA_BASE_PROMPT}\n\n=== ТЕКУЩИЙ КОНТЕКСТ ===\n${contextText}\n\n=== ФОРМАТ СКРЫТЫХ КОМАНД ===\n${COMMAND_SYNTAX_HINT}`;

  const contents = [];
  history.forEach(h => {
    contents.push({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.text }] });
  });
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
    },
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
   ПАРСИНГ СКРЫТЫХ КОМАНД
───────────────────────────────────────────────────────────── */
const COMMAND_RE = /\[([A-Z_]+):\s*([^\]]+)\]/g;

function parseBatteryValue(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function processCommands(rawReply, nova) {
  let changed = false;
  const updated = JSON.parse(JSON.stringify(nova)); // deep clone, чтоб не мутировать вслепую

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
        // неизвестная команда — просто вырезаем из текста, ничего не пишем в KV
        break;
    }
    return ''; // команда всегда вырезается из текста, видимого пользователю
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
  // Telegram режет сообщения на 4096 символов — на всякий случай рубим сами
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

async function sendTypingAction(chatId) {
  try {
    await fetch(`${TG_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch (_) { /* не критично */ }
}

/* ─────────────────────────────────────────────────────────────
   ГЛАВНЫЙ ХЕНДЛЕР
───────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  // Telegram шлёт только POST. На GET (проверка живости) отвечаем 200.
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, service: 'nova-webhook' });
  }

  // защита от пустого/битого env
  if (!TG_BOT_TOKEN || !TG_CHAT_ID || !GEMINI_API_KEY) {
    console.error('[nova webhook] отсутствуют обязательные переменные окружения');
    return res.status(200).json({ ok: false, error: 'missing env vars' });
  }

  try {
    const update = req.body;
    const message = update?.message || update?.edited_message;

    if (!message || typeof message.text !== 'string' || !message.text.trim()) {
      // не текстовое сообщение (стикер, фото и т.п.) — молча игнорируем
      return res.status(200).json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const userText = message.text.trim();

    // отвечаем только хозяину
    if (chatId !== String(TG_CHAT_ID)) {
      return res.status(200).json({ ok: true });
    }

    // показываем "печатает..." пока думаем
    sendTypingAction(chatId);

    // /reset — сброс памяти Nova (не трогает Life OS базу)
    if (userText === '/reset') {
      await kv.set(NOVA_KV_KEY, getDefaultNovaState());
      await sendTelegramMessage(chatId, 'Память Nova очищена. Начинаем с чистого листа, Босс.');
      return res.status(200).json({ ok: true });
    }

    // подтягиваем обе базы параллельно
    const [lifeDataRaw, novaDataRaw] = await Promise.all([
      kv.get(LIFE_KV_KEY),
      kv.get(NOVA_KV_KEY),
    ]);

    const nova = normalizeNovaState(novaDataRaw);
    const contextText = buildContext(lifeDataRaw, nova);

    // короткая история для связности диалога
    const historyForPrompt = nova.history.slice(-NOVA_HISTORY_LIMIT);

    // зовём Gemini
    const rawReply = await askGemini(userText, contextText, historyForPrompt);

    // парсим и вырезаем скрытые команды
    const { cleanText, updatedNova, changed } = processCommands(rawReply, nova);

    // обновляем историю диалога
    updatedNova.history = [
      ...historyForPrompt,
      { role: 'user', text: userText, ts: Date.now() },
      { role: 'model', text: rawReply, ts: Date.now() },
    ].slice(-NOVA_HISTORY_LIMIT);

    // сохраняем базу Nova (историю пишем всегда, остальное — если реально поменялось)
    await kv.set(NOVA_KV_KEY, updatedNova);
    void changed; // (флаг оставлен для возможного логирования/аналитики позже)

    // шлём ответ
    await sendTelegramMessage(chatId, cleanText || 'Хм, не смогла сформулировать ответ. Повтори, Босс.');

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[nova webhook] fatal error:', err);
    // Telegram должен получить 200, иначе начнёт спамить повторными доставками апдейта
    try {
      await sendTelegramMessage(String(TG_CHAT_ID), 'Что-то сломалось на бэкенде. Гляну логи в Vercel.');
    } catch (_) { /* если и это упало — просто молчим */ }
    return res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
}