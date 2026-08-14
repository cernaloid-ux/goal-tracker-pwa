// api/telegram-webhook.js — Vercel Serverless Function
// Handles Telegram Bot commands via webhook
//
// Setup:
//   1. Create bot with @BotFather → get TOKEN
//   2. Set webhook: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-app.vercel.app/api/telegram-webhook
//   3. Send /today to the bot

import { kv } from '@vercel/kv';

const TG_TOKEN  = process.env.TG_BOT_TOKEN;
const TG_API    = `https://api.telegram.org/bot${TG_TOKEN}`;

// ── Helpers ──────────────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra })
  });
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtDuration(min) {
  if (!min) return '';
  if (min >= 60) return `${Math.floor(min/60)}ч ${min%60 > 0 ? min%60+'м' : ''}`.trim();
  return `${min}м`;
}

// Find user data by Telegram chat_id (scans TG credentials)
async function findUserState(chatId) {
  // Keys are stored as цель:{userId}:tg  →  { token, chatId }
  // We scan for matching chatId
  const keys = await kv.keys('цель:*:tg');
  for (const key of keys) {
    const raw = await kv.get(key);
    if (!raw) continue;
    const tgData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (String(tgData.chatId) === String(chatId)) {
      // Found — load main state
      const userId = key.replace('цель:','').replace(':tg','');
      const stateRaw = await kv.get(`цель:${userId}`);
      if (!stateRaw) return null;
      return { userId, state: typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw };
    }
  }
  return null;
}

// ── Command Handlers ─────────────────────────────────────
async function cmdToday(chatId) {
  const found = await findUserState(chatId);
  if (!found) return sendMessage(chatId, '❌ Аккаунт не найден.\nОткрой приложение и сохрани настройки Telegram.');

  const { state } = found;
  const today = new Date().toISOString().slice(0,10);
  const todayGoals = (state.goals || []).filter(g => {
    if (!g.scheduledAt) return false;
    return new Date(g.scheduledAt).toISOString().slice(0,10) === today;
  }).sort((a,b) => a.scheduledAt - b.scheduledAt);

  const done   = (state.historyToday || []).length;
  const total  = todayGoals.length + done;
  const gems   = state.gems || 0;
  const streak = state.streak?.days || 0;

  let text = `📅 <b>План на сегодня</b>\n`;
  text += `💎 ${gems} кристаллов · 🔥 ${streak} дней серии\n`;
  text += `✅ Выполнено: ${done}/${total}\n\n`;

  if (!todayGoals.length && !done) {
    text += `😅 Плана нет. <i>Слабовато для миллиардера...</i>`;
  } else {
    todayGoals.forEach((g, i) => {
      const time = fmtTime(g.scheduledAt);
      const dur  = fmtDuration(g.duration_min);
      const trav = g.travelTime ? ` 🚗${g.travelTime}м` : '';
      const loc  = g.location   ? ` 📍${g.location}` : '';
      text += `${i+1}. <b>${g.title}</b>\n`;
      text += `   ${time} · ${dur}${trav}${loc}\n`;
    });
  }

  await sendMessage(chatId, text);
}

async function cmdGems(chatId) {
  const found = await findUserState(chatId);
  if (!found) return sendMessage(chatId, '❌ Аккаунт не найден.');
  const { state } = found;
  const lv = getLevel(state.gems || 0);
  await sendMessage(chatId,
    `💎 <b>${state.gems || 0} кристаллов</b>\n🔥 Серия: ${state.streak?.days || 0} дней\n🏆 Уровень: ${lv}`
  );
}

async function cmdStats(chatId) {
  const found = await findUserState(chatId);
  if (!found) return sendMessage(chatId, '❌ Аккаунт не найден.');
  const { state } = found;
  const today = new Date().toISOString().slice(0,10);
  const done  = (state.historyToday || []).length;
  const total = (state.goals || []).filter(g => !g.done).length;
  await sendMessage(chatId,
    `📊 <b>Статистика</b>\n` +
    `✅ Сегодня: ${done} задач\n` +
    `📋 Активных: ${total}\n` +
    `💎 ${state.gems || 0} кристаллов\n` +
    `🔥 ${state.streak?.days || 0} дней подряд`
  );
}

async function cmdHelp(chatId) {
  await sendMessage(chatId,
    `🤖 <b>Цель — Telegram Бот</b>\n\n` +
    `/today — план на сегодня\n` +
    `/gems — кристаллы и уровень\n` +
    `/stats — статистика\n` +
    `/help — эта справка\n\n` +
    `<i>Синхронизация через приложение каждые 30с.</i>`
  );
}

function getLevel(gems) {
  const LEVELS = [
    {min:0,l:'🌱 Новичок'},{min:10,l:'⚡ Стажёр'},{min:25,l:'🔥 Практик'},
    {min:50,l:'💎 Мастер'},{min:100,l:'🏆 Ветеран'},{min:200,l:'⭐ Легенда'},
    {min:500,l:'👑 Элита'},{min:999,l:'🌟 Непобедимый'},
  ];
  let lv = LEVELS[0].l;
  LEVELS.forEach(l => { if (gems >= l.min) lv = l.l; });
  return lv;
}

// ── Main handler ─────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const msg = body?.message || body?.edited_message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim().toLowerCase().split('@')[0]; // strip bot username

    if      (text === '/start' || text === '/help') await cmdHelp(chatId);
    else if (text === '/today')  await cmdToday(chatId);
    else if (text === '/gems')   await cmdGems(chatId);
    else if (text === '/stats')  await cmdStats(chatId);
    else {
      await sendMessage(chatId, '🤔 Неизвестная команда. Напиши /help');
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[tg-webhook] Error:', err);
    return res.status(200).json({ ok: true }); // Always 200 to Telegram
  }
}
