// api/cron-notifications.js — Vercel Cron Job Handler
//
// Runs on schedule (configured in vercel.json):
//   08:00 UTC+3 → Morning digest
//   23:00 UTC+3 → Streak panic
//   Also: dynamic task reminders with travelTime offset
//
// Environment variables needed:
//   TG_BOT_TOKEN=your_bot_token

import { kv } from '@vercel/kv';

const TG_TOKEN = process.env.TG_BOT_TOKEN;

async function sendTg(chatId, text) {
  if (!chatId || !TG_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

function pad(n) { return String(n).padStart(2,'0'); }

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Scan all users
async function getAllUsers() {
  const stateKeys = await kv.keys('цель:*');
  // Filter to only main state keys (not :tg sub-keys)
  const mainKeys = stateKeys.filter(k => !k.includes(':tg'));
  const users = [];
  for (const key of mainKeys) {
    const userId = key.replace('цель:','');
    const stateRaw = await kv.get(key);
    const tgRaw    = await kv.get(`цель:${userId}:tg`);
    if (!stateRaw) continue;
    const state   = typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw;
    const tgData  = tgRaw ? (typeof tgRaw === 'string' ? JSON.parse(tgRaw) : tgRaw) : null;
    if (tgData?.chatId) users.push({ userId, state, tgChatId: tgData.chatId });
  }
  return users;
}

// ── HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel cron authorization
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type; // 'morning' | 'night' | 'reminders'
  const now  = new Date();

  try {
    const users = await getAllUsers();

    for (const { state, tgChatId } of users) {
      const today      = now.toISOString().slice(0,10);
      const todayGoals = (state.goals || []).filter(g => {
        if (!g.scheduledAt || g.done) return false;
        return new Date(g.scheduledAt).toISOString().slice(0,10) === today;
      }).sort((a,b) => a.scheduledAt - b.scheduledAt);

      const doneTodayCount = (state.historyToday || []).length;
      const streak         = state.streak?.days || 0;
      const gems           = state.gems || 0;

      // ── 1. MORNING DIGEST (08:00) ──────────────────────
      if (type === 'morning') {
        let msg = `☀️ <b>Доброе утро!</b> ${now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}\n`;
        msg += `🔥 ${streak} дней серии · 💎 ${gems} кристаллов\n\n`;

        if (!todayGoals.length) {
          msg += `📋 <b>Планов нет.</b>\n<i>Слабовато для миллиардера. Открой приложение!</i>`;
        } else {
          msg += `📋 <b>Сегодня ${todayGoals.length} задач${todayGoals.length > 4 ? '' : ':'}.</b>\n\n`;
          todayGoals.slice(0, 5).forEach((g, i) => {
            const time = g.scheduledAt ? fmtTime(g.scheduledAt) : '—';
            const dur  = g.duration_min ? ` · ${g.duration_min}м` : '';
            const loc  = g.location ? ` 📍${g.location}` : '';
            const trav = g.travelTime ? ` 🚗${g.travelTime}м до` : '';
            msg += `${i+1}. <b>${g.title}</b>\n   ${time}${dur}${trav}${loc}\n`;
          });
          if (todayGoals.length > 5) msg += `\n...и ещё ${todayGoals.length - 5}`;
        }

        await sendTg(tgChatId, msg);
      }

      // ── 2. STREAK PANIC (23:00) ────────────────────────
      if (type === 'night') {
        const isSunday = now.getDay() === 0;
        if (isSunday) continue; // Sunday cheat day — no panic

        if (doneTodayCount === 0) {
          const msg =
            `🚨 <b>АЛЁ!</b>\n\n` +
            `Серия ${streak} дней сгорит через час!\n` +
            `Сделай хоть что-нибудь! ⚡\n\n` +
            `Открой приложение → поставь галочку → спи спокойно.`;
          await sendTg(tgChatId, msg);
        } else {
          const msg =
            `🌙 <b>Хорошая работа!</b>\n` +
            `Сегодня выполнено: ${doneTodayCount} задач\n` +
            `🔥 Серия ${streak} дней сохранена. Отдыхай!`;
          await sendTg(tgChatId, msg);
        }
      }

      // ── 3. DYNAMIC REMINDERS ─────────────────────────
      if (type === 'reminders') {
        const nowMs = now.getTime();
        for (const g of todayGoals) {
          if (!g.scheduledAt || !g.reminders?.length) continue;

          for (const reminderMin of g.reminders) {
            const fireAt = g.scheduledAt - reminderMin * 60_000;
            const delta  = fireAt - nowMs;

            // Fire if within ±30 seconds of scheduled reminder time
            if (delta >= -30_000 && delta <= 30_000) {
              const label = reminderMin >= 60
                ? `${Math.floor(reminderMin/60)} ч`
                : `${reminderMin} мин`;

              const travelNote = g.travelTime
                ? ` (Дорога: ${g.travelTime} мин → выходи в ${fmtTime(g.scheduledAt - g.travelTime * 60_000)}!)`
                : '';

              const msg =
                `⏰ <b>Напоминание — через ${label}</b>\n` +
                `📌 ${g.title}\n` +
                `🕐 ${fmtTime(g.scheduledAt)}${g.location ? ` · 📍${g.location}` : ''}${travelNote}`;

              await sendTg(tgChatId, msg);
            }
          }
        }
      }
    }

    return res.status(200).json({ ok: true, type, users: users.length });
  } catch (err) {
    console.error('[cron] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
