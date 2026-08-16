// api/cron-notifications.js — Vercel Cron Job Handler (Nova OS Edition)
// Кроны:
//   morning-nova  → 09:50 UTC+3 (06:50 UTC)
//   night-nova    → 23:45 UTC+3 (20:45 UTC)
//   sport-check   → 19:00 UTC+3 (16:00 UTC)
//   reminders     → каждые 5 мин
//
// Env:
//   TG_BOT_TOKEN
//   CRON_SECRET

import { kv } from '@vercel/kv';

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_API   = `https://api.telegram.org/bot${TG_TOKEN}`;

// ── Helpers ──────────────────────────────────────────────
async function sendTg(chatId, text, extra = {}) {
  if (!chatId || !TG_TOKEN) return;
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra })
  });
}

function pad(n) { return String(n).padStart(2, '0'); }

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateKey(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getDayName(date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'long' });
}

// ── User scan ────────────────────────────────────────────
async function getAllUsers() {
  const stateKeys = await kv.keys('цель:*');
  const mainKeys = stateKeys.filter(k => !k.includes(':tg'));
  const users = [];
  for (const key of mainKeys) {
    const userId = key.replace('цель:', '');
    const stateRaw = await kv.get(key);
    const tgRaw    = await kv.get(`цель:${userId}:tg`);
    if (!stateRaw) continue;
    const state  = typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw;
    const tgData = tgRaw ? (typeof tgRaw === 'string' ? JSON.parse(tgRaw) : tgRaw) : null;
    if (tgData?.chatId) users.push({ userId, state, tgChatId: tgData.chatId });
  }
  return users;
}

// ── Sport logic ──────────────────────────────────────────
function getSportDays(state) {
  const history = state.history || [];
  const days = new Set();
  const now = Date.now();
  history.forEach(h => {
    if (h.cat !== 'health') return;
    const diff = now - (h.completedAt || 0);
    if (diff >= 0 && diff < 7 * 86400000) days.add(dateKey(h.completedAt));
  });
  return days;
}

function getConsecutiveRestDays(state) {
  const history = state.history || [];
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dk = dateKey(d.getTime());
    const hadSport = history.some(h => h.cat === 'health' && dateKey(h.completedAt) === dk);
    if (!hadSport) streak++;
    else break;
  }
  return streak;
}

function getPlannedSportToday(state) {
  const today = dateKey();
  return (state.goals || []).filter(g =>
    !g.done && g.cat === 'health' && g.scheduledAt && dateKey(g.scheduledAt) === today
  );
}

// ── Nova Personality ─────────────────────────────────────
const NOVA = {
  isSunday: () => new Date().getDay() === 0,

  morning(state, todayGoals, doneToday, streak, gems) {
    const isSun = this.isSunday();
    const total = todayGoals.length + doneToday;
    let msg = '';

    if (isSun) {
      msg += `☀️ Доброе утро, Лёша.\n`;
      msg += `Сегодня воскресенье — святой день. Никаких дедлайнов, только забота.\n\n`;
    } else {
      msg += `☀️ Подъём, Босс.\n`;
      msg += `Время ${fmtTime(Date.now())}. План на ${getDayName(new Date())}:\n\n`;
    }

    if (!todayGoals.length && !doneToday) {
      msg += isSun
        ? `Отдыхай, восстанавливайся. Завтра снова в бой. 💤`
        : `📋 <b>Планов нет.</b>\nЭто не похоже на человека, который хочет стать самым богатым, рождённым в 2010-м.\nОткрой Nova OS и набросай цели.`;
    } else {
      if (doneToday > 0) msg += `✅ Уже сделано: ${doneToday}\n`;
      todayGoals.slice(0, 6).forEach((g, i) => {
        const t = g.scheduledAt ? fmtTime(g.scheduledAt) : '—';
        msg += `${i + 1}. ${g.title} (${t})\n`;
      });
      if (todayGoals.length > 6) msg += `...и ещё ${todayGoals.length - 6}\n`;
    }

    if (!isSun) {
      msg += `\n🔥 Серия: ${streak} дней · 💎 ${gems} кристаллов\n`;
      const biz = todayGoals.filter(g => g.cat === 'business').length;
      if (biz === 0 && todayGoals.length > 0) {
        msg += `\n⚠️ Бизнес-задач нет. Memernity не построит сам себя, Босс.`;
      }
    }
    return msg;
  },

  night(state, doneToday, streak) {
    const isSun = this.isSunday();
    let msg = '';

    if (isSun) {
      msg += `🌙 Лёша, воскресенье подходит к концу.\n`;
      msg += `Запиши 3 вещи, за которые ты благодарен сегодня. И ложись спать без тревоги — завтра новая неделя.`;
      return msg;
    }

    msg += `🌙 Босс, время подводить итоги.\n\n`;
    msg += `📓 <b>Три гордости за день:</b>\n1. …\n2. …\n3. …\n\n`;
    msg += `Ответь мне списком или просто запиши в голове. Но честно.\n\n`;

    if (doneToday === 0) {
      msg += `🔥 Сегодня 0 задач. Серия ${streak} дней. Если сейчас не сделаешь хоть одну — всё сгорит.\n`;
      msg += `Я не шучу. Вставай и сделай.`;
    } else {
      msg += `✅ Сегодня сделано: ${doneToday}. Молодец.\n`;
      msg += `Но не расслабляйся. Через 15 минут — сон. Дедлайн 00:00.`;
    }
    return msg;
  },

  sport(state, sportDays, restStreak) {
    const today = dateKey();
    const hadSportToday = sportDays.has(today);
    const planned = getPlannedSportToday(state);
    const isSun = this.isSunday();
    let msg = '';

    if (isSun) {
      msg += `💪 Чемпион, сегодня воскресенье — день восстановления.\n`;
      msg += `Растяжка, прогулка, сон. Но не ленись целый день на диване.`;
      return msg;
    }

    if (hadSportToday) {
      msg += `💪 Красава, Чемпион. Сегодня ты был в форме.\n`;
      msg += `За неделю тренировок: ${sportDays.size}/7. `;
      msg += sportDays.size >= 5 ? `Это то, что нужно. 🔥` : `Нужно ещё ${5 - sportDays.size} до нормы.`;
      return msg;
    }

    if (planned.length > 0) {
      const g = planned[0];
      msg += `💪 Чемпион, сегодня у тебя «${g.title}» в ${fmtTime(g.scheduledAt)}.\n`;
      msg += `🧊 <b>Не забудь охладить воду</b> — поставь бутылку в холодильник сейчас.\n`;
      if (g.location) msg += `📍 ${g.location}\n`;
      msg += `Ремень для велосипеда, ключи, деньги — проверь сумку.`;
      return msg;
    }

    if (restStreak >= 3) {
      msg += `👿 <b>АЛЁ, ЧЕМПИОН!</b>\n\n`;
      msg += `${restStreak} дня подряд без движения. Ты что, решил стать посредственностью?\n`;
      msg += `Твоя цель — 100 марафонов и 7 вершин. А ты не можешь отжаться.\n\n`;
      msg += `Компромисс: домашняя тренировка. 15 минут. Прямо сейчас.\n`;
      msg += `Или признайся себе, что тебе плевать на свои мечты.`;
    } else if (restStreak === 2) {
      msg += `⚠️ Чемпион, второй день отдыха.\n`;
      msg += `Ещё один — и я начну беспокоиться. И тебе не сдобровать.\n`;
      msg += `Запланируй хотя бы домашнюю тренировку на сегодня.`;
    } else {
      msg += `💪 Чемпион, сегодня спорт ещё не сделан.\n`;
      msg += `Недельная статистика: ${sportDays.size}/5. Не сбавляй темп.`;
    }
    return msg;
  }
};

// ── Handlers ─────────────────────────────────────────────
async function handleMorningNova(user) {
  const { state, tgChatId } = user;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const todayGoals = (state.goals || []).filter(g => {
    if (g.done) return false;
    if (!g.scheduledAt) return false;
    return new Date(g.scheduledAt).toISOString().slice(0, 10) === today;
  }).sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));

  const doneToday = (state.history || []).filter(h => dateKey(h.completedAt) === today).length;
  const streak = state.streak?.days || 0;
  const gems = state.gems || 0;

  await sendTg(tgChatId, NOVA.morning(state, todayGoals, doneToday, streak, gems));
}

async function handleNightNova(user) {
  const { state, tgChatId } = user;
  const today = dateKey();
  const doneToday = (state.history || []).filter(h => dateKey(h.completedAt) === today).length;
  const streak = state.streak?.days || 0;

  await sendTg(tgChatId, NOVA.night(state, doneToday, streak));
}

async function handleSportCheck(user) {
  const { state, tgChatId } = user;
  const sportDays = getSportDays(state);
  const restStreak = getConsecutiveRestDays(state);

  await sendTg(tgChatId, NOVA.sport(state, sportDays, restStreak));
}

async function handleReminders(user, now) {
  const { state, tgChatId } = user;
  const today = now.toISOString().slice(0, 10);
  const todayGoals = (state.goals || []).filter(g => {
    if (!g.scheduledAt || g.done) return false;
    return new Date(g.scheduledAt).toISOString().slice(0, 10) === today;
  });

  const nowMs = now.getTime();
  for (const g of todayGoals) {
    if (!g.scheduledAt || !g.reminders?.length) continue;
    for (const reminderMin of g.reminders) {
      const fireAt = g.scheduledAt - reminderMin * 60_000;
      const delta = fireAt - nowMs;
      if (delta >= -30_000 && delta <= 30_000) {
        const label = reminderMin >= 60 ? `${Math.floor(reminderMin / 60)} ч` : `${reminderMin} мин`;
        const travelNote = g.travelTime
          ? ` (Дорога: ${g.travelTime} мин → выходи в ${fmtTime(g.scheduledAt - g.travelTime * 60_000)}!)`
          : '';
        const msg = `⏰ <b>Напоминание — через ${label}</b>\n📌 ${g.title}\n🕐 ${fmtTime(g.scheduledAt)}${g.location ? ` · 📍${g.location}` : ''}${travelNote}`;
        await sendTg(tgChatId, msg);
      }
    }
  }
}

// ── Main handler ─────────────────────────────────────────
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type;
  const now = new Date();

  try {
    const users = await getAllUsers();

    for (const user of users) {
      try {
        if (type === 'morning-nova') await handleMorningNova(user);
        else if (type === 'night-nova') await handleNightNova(user);
        else if (type === 'sport-check') await handleSportCheck(user);
        else if (type === 'reminders') await handleReminders(user, now);
        else if (type === 'morning') await handleMorningNova(user);
        else if (type === 'night') await handleNightNova(user);
      } catch (e) {
        console.error(`[cron:${type}] user error:`, e);
      }
    }

    return res.status(200).json({ ok: true, type, users: users.length });
  } catch (err) {
    console.error('[cron] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}