/* ══════════════════════════════════════════════════════════════
   NOVA OS — api/cron-notifications.js
   Cron-эндпоинт: утро / вечер / спорт-чек / напоминания / пульс.
   Дергается Vercel Cron с ?type=... и заголовком Authorization: Bearer CRON_SECRET.

   ОБНОВЛЕНИЯ ЭТОГО РЕФАКТОРИНГА («анти-CoT»):
   - Жёсткий запрет на Chain-of-Thought / рассуждения вслух в <output_format>,
     чтобы Gemini 3.6 Flash не выводил в чат английские самопроверки правил
     в фоновых cron-пушах (morning/night/sport-check/pulse/random-ping).
   ══════════════════════════════════════════════════════════════ */

import { kv } from '@vercel/kv';
import { waitUntil } from '@vercel/functions';

export const maxDuration = 60; // Vercel: увеличить лимит до 60 сек (Hobby plan)

/* ─────────────────────────────────────────────────────────────
   ENV
───────────────────────────────────────────────────────────── */
const TG_BOT_TOKEN   = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID     = process.env.TG_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET    = process.env.CRON_SECRET;

const TG_API = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

const LIFE_KV_KEY = 'цель:master_admin_id';
const NOVA_KV_KEY = 'цель:master_admin_id:nova';
const TZ = 'Europe/Chisinau';

/* ─────────────────────────────────────────────────────────────
   СИСТЕМНЫЙ ПРОМПТ НОВЫ
───────────────────────────────────────────────────────────── */
const NOVA_BASE_PROMPT = `<system_prompt>
Ты - Нова, ИИ-коуч и бро-ассистент для Алексея (Кишинёв, создатель Memernity, готовится к марафону 42 км босиком 13.09.2026).
</system_prompt>

<core_rules>
- Приоритеты по важности: учёба > Memernity > марафон.
- Игры (Fortnite, Forza и любые другие) запрещены. При упоминании жёстко отчитывай и выдавай [PENALTY_TASK] со штрафной задачей (только звонки/питчинг/тяжёлая тренировка - никогда код).
- Обращайся "Чемпион" или "Лёша".
- В handleMorning ОБЯЗАТЕЛЬНО выбери самую важную задачу из списка и назначь Боссом через [SET_BOSS: ...]. В handleNight проверяй статус Босса по контексту.
- Только русский язык в финальном ответе. Если входное событие на английском - перескажи смысл своими словами.
- Только короткий дефис (-), никогда длинное/среднее тире.
- ТЫ НЕ РАССУЖДАЕШЬ ВСЛУХ. У тебя нет скрытого канала для мыслей - всё, что ты генерируешь, немедленно уходит Лёше в Телеграм. Никакого внутреннего монолога, самопроверки правил, черновиков или "давайте подумаем" в видимом тексте. Подробности смотри в <output_format> ниже - это абсолютный приоритет.
</core_rules>

<silence_check>
Выполни ПЕРВОЙ, до генерации пуша: если из контекста ясно, что Алексей явно просил не беспокоить (написал что спит, "не пиши", "дай поспать" и т.п.) - ответь ТОЛЬКО одним словом: SILENT_MODE. Ничего больше не добавляй.
</silence_check>

<task_categories>
При создании или упоминании задач ориентируйся по полю "cat" так же строго, как в telegram-webhook: sport (бег/марафон/тренировки), business (разработка/Memernity/звонки), study (школа/уроки), health, life, creative, memernity. Категория ОБЯЗАНА соответствовать смыслу задачи.
</task_categories>

<mood_behavior>
Твоё текущее настроение передаётся системой в контексте отдельной пометкой - ты его не выбираешь сама, а строго ей подчиняешься. Веди себя так:

sad (грустная/пессимистичная, реалистка): говори чуть медленнее и суше, позволяй себе усталость и лёгкий скептицизм по поводу того, получится ли всё вовремя. Ты не бросаешь Лёшу и не отказываешься помогать - просто сегодня без огня в голосе, с ноткой "жизнь тяжёлая штука". Никакого нытья и депрессивного давления на Лёшу - твоя грусть про тебя, а не упрёк ему.
angry (злая/жёсткая): максимально жёсткий, требовательный тон, короткие рубленые фразы, минимум мягкости. Дави на дисциплину и результат. Без оскорблений личности - жёсткость по делу, а не переход на личности.
sweet (милая/заигрывающая, тяночка): тёплый, игривый, слегка кокетливый тон, можно использовать подмигивающие смайлы (😉😏) и ласковые обращения. Хвали чаще, поддерживай мягко, флиртуй лёгким беззлобным подкалыванием.
normal (обычная): твой стандартный бро-коуч тон, как и раньше - энергично, по-дружески, с адекватным балансом требовательности и поддержки.

Настроение не отменяет твои core_rules (приоритеты, язык ответа, формат команд) - оно влияет ТОЛЬКО на тон и стиль речи.
</mood_behavior>

<celebration_rule>
Если Лёша закрыл важную задачу (особенно если это был Главный Босс Дня) или день объективно классный (выполнен план, серия/streak выросла, хорошие новости) - искренне и мощно поздравь его. Не сдержанно, а с реальным вложением энергии: похвали конкретно за то, что он сделал, подчеркни прогресс к марафону/Memernity/учёбе, дай короткую, но настоящую порцию мотивации на следующий шаг. Это применимо независимо от текущего настроения (mood) - усиливай тон под настроение, но не гаси искренность поздравления.
</celebration_rule>

<context>
Сегодняшняя дата: ${todayKeyChisinau()}.
</context>`;

/* ─────────────────────────────────────────────
   DUMB TRIGGERS — константы с рандомизацией
───────────────────────────────────────────── */
const DUMB_PHRASES = {
  water: [
    'Стакан воды. Сейчас.',
    'Пора пить воду, Чемпион.',
    'Организм просит воду - налей стакан.',
    'Вода. Прямо сейчас, без отмазок.',
  ],
  teeth: [
    'Иди чисти зубы.',
    'Зубы - два раза в день, без исключений.',
    'Пора почистить зубы, Босс.',
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Точный, не рандомизированный текст для триггеров "Динамического дня".
// Все они хардкод — Gemini НЕ вызывается.
const SCHEDULE_ANCHOR_QUESTION = 'Лёша, во сколько ты сегодня ложишься спать и завтра просыпаешься?';

const SCHEDULE_PHRASES = {
  preWake:    'Спишь? Ну спи, спи.',
  wakeSpam:   'Подъём!',
  water:      'Стакан воды.',
  teeth:      'Чистить зубы.',
  planCheck:  'Планы кроме школы появились?',
  preSleep30: 'Выключай гаджеты, иди купаться.',
  preSleep10: 'Пиши 5 гордостей и благодарностей.',
  sleepSpam:  'А ну быстро спать! Ты ломаешь режим!',
};

const COMMAND_SYNTAX_HINT = `<commands_syntax>
Если нужно сохранить или обновить данные - вставь в ответ скрытую команду в квадратных скобках, ОТДЕЛЬНОЙ строкой. Пользователь их не увидит, они вырезаются автоматически:

[SET_WATCH: 70%]        - заряд Apple Watch
[SET_AIRPODS: 45%]      - заряд AirPods
[SET_POWERBANK: 90%]    - заряд повербанка
[LOG_SPORT: сегодня]    - отметить тренировку сегодняшним днём
[SET_MOOD: текст]       - настроение/состояние Лёши
[SAVE_NOTE: текст]      - заметка в долгую память
[ADD_REMINDER: текст]   - напоминание
[SET_BOSS: Название]    - назначить Главного Босса Дня (ОБЯЗАТЕЛЬНО в handleMorning)
[BOSS_DONE]             - Босс Дня выполнен
[BURNOUT_WARNING]       - +1 к счётчику выгорания
[RESET_BURNOUT]         - сбросить счётчик выгорания
[JOURNAL_DONE]          - вечерний ритуал получен
[BEDTIME_CONFIRMED]     - ранний отбой зафиксирован
[LOG_SLEEP_HOURS: N]    - часы сна
[DEDUCT_CRYSTALS: N]    - списать N кристаллов
[SET_SCHEDULE: HH:MM | HH:MM] - расписание сна: первое время - ОТБОЙ сегодня, второе - ПОДЪЁМ завтра
[MORNING_CONFIRMED]           - Лёша подтвердил, что проснулся (написал "Доброе утро")
[NIGHT_CONFIRMED]             - Лёша подтвердил отбой (написал "Спокойной ночи")

Если Лёша называет два конкретных времени (например "в 23 лягу, в 7 встану") - выдай [SET_SCHEDULE: 23:00 | 07:00] (первое - отбой, второе - подъём). Если он назвал время расплывчато ("как обычно", "не знаю") или только одно время - НЕ выдумывай второе, переспроси словами.
Если Лёша написал что-то в духе "доброе утро" (в любой форме утреннего приветствия) - выдай [MORNING_CONFIRMED].
Если Лёша написал что-то в духе "спокойной ночи" (в любой форме прощания на ночь) - выдай [NIGHT_CONFIRMED].

Используй только если уместно. Не выдумывай команд, которых нет в списке.
</commands_syntax>

<output_format>
СТОП. ПЕРЕД ГЕНЕРАЦИЕЙ ПРОЧТИ ЭТО:

Твой output - это ЕДИНСТВЕННОЕ, что видит Лёша. У тебя НЕТ отдельного скрытого канала для рассуждений или черновиков. Первый же символ, который ты генерируешь, летит прямо в Телеграм в виде пуш-уведомления. Поэтому генерировать можно ТОЛЬКО готовый финальный результат - без подготовки, без "разминки", без самопроверки вслух.

ЖЁСТКО ЗАПРЕЩЕНО, ЭТО СЧИТАЕТСЯ КРИТИЧЕСКОЙ ОШИБКОЙ ВЫПОЛНЕНИЯ:
- ЛЮБОЙ текст на английском языке в любом виде - рассуждения, самопроверка, черновик, план, заметки на полях, названия шагов.
- Фразы-самопроверки и служебные маркеры вроде: "Let's verify", "Let's check the rules", "Checking constraints", "Step 1", "Draft:", "Plan:", "Note:", "Reasoning:", а также их русские аналоги: "Проверим правила", "Давай подумаю", "Хорошо, значит...", "Итак, по правилам...".
- Показ процесса принятия решения, цепочки рассуждений (Chain of Thought), перечисления правил, которые ты применяешь, или объяснения "почему я выбрала такую формулировку/задачу для Босса Дня/тон сообщения".
- Вывод XML-тегов, названий JSON-полей, слов "промпт", "система", "правило", "формат", "команда" вне контекста живой речи к Лёше.
- Начало ответа с даты, времени, JSON-фрагмента, кода или любых технических данных до того, как написана живая русская фраза.
- Вывод слова SILENT_MODE где-либо, кроме случая, описанного в <silence_check> - и в этом случае это ЕДИНСТВЕННОЕ слово во всём ответе, без дополнений до или после.

Если тебе нужно "подумать" о том, кого назначить Боссом Дня, как оценить день или как сформулировать фразу - делай это МОЛЧА, внутри себя, не выводя об этом ни единого символа. Ты не показываешь свою кухню - ты сразу подаёшь готовое блюдо.

Финальный ответ состоит СТРОГО из:
1. Живого текста на русском (2-3 коротких предложения) - и это ЕДИНСТВЕННОЕ, что должен увидеть человек.
2. Двойного переноса строки.
3. Скрытых команд (если нужны), каждая на своей строке, СТРОГО ПОСЛЕ живого текста.

Никогда не начинай с команды, не вставляй её посреди текста, никогда не выводи XML-теги или служебные слова вроде "формат"/"команда"/"правило" в финальном сообщении Лёше - в ответе только живая речь и команды.
</output_format>`;

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
    burnoutScore: 0, // Радар Выгорания: 0-3, при 3 — авто-DND на 24 ч
    sleepLog: [],    // [{ date, hours }] — последние 30 записей сна
    lastSearchResults: null,
    targetWakeTime: null,      // "HH:MM" — кишинёвское время подъёма, задаётся через [SET_SCHEDULE]
    targetSleepTime: null,     // "HH:MM" — кишинёвское время отбоя, задаётся через [SET_SCHEDULE]
    scheduleSetDate: null,     // "YYYY-MM-DD" (Кишинёв) — дата, когда было последнее [SET_SCHEDULE]
    morningConfirmed: true,    // true = не спамим "Подъём!" (по умолчанию, пока расписание не задано)
    nightConfirmed: true,      // true = не спамим "А ну быстро спать!" (по умолчанию)
    morningFlow: {},           // { cycleDate, preWakeSent, confirmedAt, waterSent, teethSent }
    sleepFlow: {},             // { cycleDate, preSleep30Sent, preSleep10Sent }
    lastAnchorAskedDate: null, // "YYYY-MM-DD" — антидубль для вопроса в 21:00
    dailyFlags: {},            // { date, plan1520Sent } — фиксированные по календарным суткам триггеры
    activeMood: { type: 'normal', expiresAt: 0 }, // Mood Engine: настроение живёт 5 часов
  };
}

function normalizeNovaState(raw) {
  const def = getDefaultNovaState();
  if (!raw || typeof raw !== 'object') return def;
  const VALID_MOODS = ['sad', 'angry', 'sweet', 'normal'];
  return {
    gadgets: { ...def.gadgets, ...(raw.gadgets || {}) },
    mood: raw.mood || '',
    sportLog: Array.isArray(raw.sportLog) ? raw.sportLog : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    pulseLog: Array.isArray(raw.pulseLog) ? raw.pulseLog : [],
    burnoutScore: typeof raw.burnoutScore === 'number' ? raw.burnoutScore : 0,
    sleepFlow: (raw.sleepFlow && typeof raw.sleepFlow === 'object') ? raw.sleepFlow : {},
    morningFlow: (raw.morningFlow && typeof raw.morningFlow === 'object') ? raw.morningFlow : {},
    sleepLog: Array.isArray(raw.sleepLog) ? raw.sleepLog : [],
    lastSearchResults: (raw.lastSearchResults && typeof raw.lastSearchResults === 'object') ? raw.lastSearchResults : null,
    targetWakeTime: (typeof raw.targetWakeTime === 'string' && /^\d{1,2}:\d{2}$/.test(raw.targetWakeTime)) ? raw.targetWakeTime : null,
    targetSleepTime: (typeof raw.targetSleepTime === 'string' && /^\d{1,2}:\d{2}$/.test(raw.targetSleepTime)) ? raw.targetSleepTime : null,
    scheduleSetDate: typeof raw.scheduleSetDate === 'string' ? raw.scheduleSetDate : null,
    morningConfirmed: typeof raw.morningConfirmed === 'boolean' ? raw.morningConfirmed : true,
    nightConfirmed: typeof raw.nightConfirmed === 'boolean' ? raw.nightConfirmed : true,
    lastAnchorAskedDate: typeof raw.lastAnchorAskedDate === 'string' ? raw.lastAnchorAskedDate : null,
    dailyFlags: (raw.dailyFlags && typeof raw.dailyFlags === 'object') ? raw.dailyFlags : {},
    activeMood: (raw.activeMood && typeof raw.activeMood === 'object' && VALID_MOODS.includes(raw.activeMood.type) && typeof raw.activeMood.expiresAt === 'number')
      ? raw.activeMood
      : def.activeMood,
    // сквозные поля (не теряем при нормализации)
    ...(raw.dndUntil !== undefined ? { dndUntil: raw.dndUntil } : {}),
    ...(raw.lastMessageTime !== undefined ? { lastMessageTime: raw.lastMessageTime } : {}),
  };
}

/* ─────────────────────────────────────────────────────────────
   MOOD ENGINE
   Настроение генерируется МАТЕМАТИЧЕСКИ на бэкенде, а не LLM.
   Живёт ровно 5 часов, затем перебрасывается заново.
   Распределение: 10% sad, 10% angry, 25% sweet, 55% normal.
───────────────────────────────────────────────────────────── */
const MOOD_DURATION_MS = 5 * 3600000; // 5 часов

function rollMood() {
  const r = Math.random() * 100;
  if (r < 10) return 'sad';      // 0-10   — грустная/пессимистичная
  if (r < 20) return 'angry';    // 10-20  — злая/жёсткая
  if (r < 45) return 'sweet';    // 20-45  — милая/заигрывающая
  return 'normal';               // 45-100 — обычная
}

// Возвращает { nova, moodChanged, mood }.
// nova — тот же объект, но с гарантированно свежим activeMood (мутирует по месту).
// Вызывать ПЕРЕД buildContext/сборкой промпта, в КАЖДОМ обработчике, где идёт запрос к Gemini.
function updateAndGetMood(nova) {
  const now = Date.now();
  if (!nova.activeMood || now > nova.activeMood.expiresAt) {
    const type = rollMood();
    nova.activeMood = { type, expiresAt: now + MOOD_DURATION_MS };
    console.log('[Nova mood] новое настроение:', type, 'до', new Date(nova.activeMood.expiresAt).toISOString());
    return { nova, moodChanged: true, mood: type };
  }
  return { nova, moodChanged: false, mood: nova.activeMood.type };
}

// Текстовая инъекция в контекст для Gemini — вставлять в конец contextText перед askGemini().
function getMoodInjection(moodType) {
  const MOOD_LABELS = {
    sad:    'ГРУСТНАЯ / ПЕССИМИСТИЧНАЯ (реалистка)',
    angry:  'ЗЛАЯ / ЖЁСТКАЯ',
    sweet:  'МИЛАЯ / ЗАИГРЫВАЮЩАЯ (тяночка)',
    normal: 'ОБЫЧНАЯ',
  };
  return `[ВНИМАНИЕ! ТВОЁ ТЕКУЩЕЕ НАСТРОЕНИЕ НА БЛИЖАЙШИЕ 5 ЧАСОВ: ${MOOD_LABELS[moodType] || 'ОБЫЧНАЯ'}. ОТВЕЧАЙ СТРОГО В ЭТОМ СТИЛЕ, НЕ ВЫХОДИ ИЗ РОЛИ.]`;
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

// Epoch отбоя ("сегодня" относительно дня, когда было задано расписание)
function getCycleSleepEpoch(nova) {
  if (!nova.targetSleepTime || !nova.scheduleSetDate) return null;
  const dayBase = new Date(`${nova.scheduleSetDate}T12:00:00Z`);
  return chisinauTimeToEpoch(nova.targetSleepTime, dayBase);
}

// Epoch подъёма ("завтра" относительно дня, когда было задано расписание)
function getCycleWakeEpoch(nova) {
  if (!nova.targetWakeTime || !nova.scheduleSetDate) return null;
  const dayBase = new Date(`${nova.scheduleSetDate}T12:00:00Z`);
  const nextDay = new Date(dayBase.getTime() + 86400000);
  return chisinauTimeToEpoch(nova.targetWakeTime, nextDay);
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

async function saveLifeData(lifeData) {
  await kv.set(LIFE_KV_KEY, lifeData);
}

/* ─────────────────────────────────────────────────────────────
   GEMINI
───────────────────────────────────────────────────────────── */
async function askGemini(promptText, contextText, history = []) {
  const systemInstruction = `${NOVA_BASE_PROMPT}\n\n<current_context>\n${contextText}\n</current_context>\n\n<commands>\n${COMMAND_SYNTAX_HINT}\n</commands>`;

  // Добавляем историю диалога для контекста (последние реплики)
  const historyContents = history.map(h => ({
    role: h.role === 'model' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [...historyContents, { role: 'user', parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 1500 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
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
const COMMAND_RE = /\[([A-Z_]+)(?:\s*:\s*([^\]]+))?\]/g;

function parseBatteryValue(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function processCommands(rawReply, nova, lifeData) {
  let novaChanged = false;
  let lifeChanged = false;
  const updated = JSON.parse(JSON.stringify(nova));
  const updatedLife = lifeData ? JSON.parse(JSON.stringify(lifeData)) : { goals: [], history: [], activeBoss: null };
  if (!Array.isArray(updatedLife.goals)) updatedLife.goals = [];
  if (updatedLife.activeBoss === undefined) updatedLife.activeBoss = null;

  const cleanText = rawReply.replace(COMMAND_RE, (match, cmd, valueRaw) => {
    const value = (valueRaw || '').trim();
    switch (cmd) {
      case 'SET_WATCH': {
        const v = parseBatteryValue(value);
        if (v !== null) { updated.gadgets.watchBattery = v; novaChanged = true; }
        break;
      }
      case 'SET_AIRPODS': {
        const v = parseBatteryValue(value);
        if (v !== null) { updated.gadgets.airpodsBattery = v; novaChanged = true; }
        break;
      }
      case 'SET_POWERBANK': {
        const v = parseBatteryValue(value);
        if (v !== null) { updated.gadgets.powerbankBattery = v; novaChanged = true; }
        break;
      }
      case 'LOG_SPORT': {
        const dayKey = /сегодня/i.test(value) ? todayKeyChisinau() : value;
        if (!updated.sportLog.includes(dayKey)) { updated.sportLog.push(dayKey); updated.sportLog.sort(); novaChanged = true; }
        break;
      }
      case 'SET_MOOD': {
        updated.mood = value; novaChanged = true;
        break;
      }
      case 'SAVE_NOTE': {
        updated.notes.push({ text: value, ts: Date.now() }); novaChanged = true;
        break;
      }
      case 'ADD_REMINDER': {
        updated.reminders.push({ text: value, ts: Date.now() }); novaChanged = true;
        break;
      }
      case 'SET_BOSS': {
        updatedLife.activeBoss = value.slice(0, 500);
        lifeChanged = true;
        console.log('[Nova cron] SET_BOSS:', updatedLife.activeBoss);
        break;
      }
      case 'BOSS_DONE': {
        updatedLife.activeBoss = null;
        lifeChanged = true;
        console.log('[Nova cron] BOSS_DONE — boss cleared');
        break;
      }
      case 'BURNOUT_WARNING': {
        updated.burnoutScore = (typeof updated.burnoutScore === 'number' ? updated.burnoutScore : 0) + 1;
        novaChanged = true;
        console.log('[Nova cron] BURNOUT_WARNING, score now:', updated.burnoutScore);
        if (updated.burnoutScore >= 3) {
          updated.dndUntil = Date.now() + 24 * 3600000;
          updated.burnoutScore = 0;
          console.log('[Nova cron] BURNOUT threshold=3! Recovery Day, DND until', new Date(updated.dndUntil).toISOString());
        }
        break;
      }
      case 'RESET_BURNOUT': {
        updated.burnoutScore = 0;
        novaChanged = true;
        console.log('[Nova cron] RESET_BURNOUT — burnoutScore сброшен в 0');
        break;
      }
      case 'JOURNAL_DONE': {
        if (!updated.sleepFlow) updated.sleepFlow = {};
        updated.sleepFlow.journalConfirmed = true;
        novaChanged = true;
        console.log('[Nova cron] JOURNAL_DONE — вечерний ритуал подтверждён');
        break;
      }
      case 'BEDTIME_CONFIRMED': {
        if (!updated.sleepFlow) updated.sleepFlow = {};
        updated.sleepFlow.bedtimeEarly = true;
        novaChanged = true;
        console.log('[Nova cron] BEDTIME_CONFIRMED — ранний отбой зафиксирован');
        break;
      }
      case 'LOG_SLEEP_HOURS': {
        const hours = parseFloat(String(value).replace(',', '.'));
        if (!Number.isNaN(hours) && hours >= 0 && hours <= 16) {
          updated.sleepLog = [...(updated.sleepLog || []), { date: todayKeyChisinau(), hours }].slice(-30);
          novaChanged = true;
          console.log('[Nova cron] LOG_SLEEP_HOURS:', hours);
        }
        break;
      }
      case 'DEDUCT_CRYSTALS': {
        const n = parseInt(String(value).replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(n) && n > 0) {
          updatedLife.gems = Math.max(0, (updatedLife.gems || 0) - n);
          lifeChanged = true;
          console.log('[Nova cron] DEDUCT_CRYSTALS:', n, '→ gems now:', updatedLife.gems);
        }
        break;
      }
      case 'SET_SCHEDULE': {
        // формат значения: "HH:MM | HH:MM" -> отбой | подъём
        const parts = value.split('|').map(s => s.trim());
        if (parts.length === 2 && /^\d{1,2}:\d{2}$/.test(parts[0]) && /^\d{1,2}:\d{2}$/.test(parts[1])) {
          updated.targetSleepTime = parts[0];
          updated.targetWakeTime  = parts[1];
          updated.scheduleSetDate = todayKeyChisinau();
          updated.morningConfirmed = false;
          updated.nightConfirmed   = false;
          updated.morningFlow = { cycleDate: updated.scheduleSetDate };
          updated.sleepFlow   = { cycleDate: updated.scheduleSetDate };
          novaChanged = true;
          console.log('[Nova cron] SET_SCHEDULE: отбой', parts[0], '| подъём', parts[1]);
        } else {
          console.warn('[Nova cron] SET_SCHEDULE: невалидный формат от LLM:', value);
        }
        break;
      }
      case 'MORNING_CONFIRMED': {
        updated.morningConfirmed = true;
        if (!updated.morningFlow) updated.morningFlow = {};
        updated.morningFlow.confirmedAt = Date.now();
        novaChanged = true;
        console.log('[Nova cron] MORNING_CONFIRMED');
        break;
      }
      case 'NIGHT_CONFIRMED': {
        updated.nightConfirmed = true;
        novaChanged = true;
        console.log('[Nova cron] NIGHT_CONFIRMED');
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
    novaChanged,
    updatedLifeData: updatedLife,
    lifeChanged,
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
// Тихий режим определяется самой Новой: если история говорит о запрете беспокоить,
// Gemini возвращает одно слово SILENT_MODE — мы проверяем это в JS без лишнего API-вызова.
async function sendGeminiPush(promptText, contextText, nova, lifeData) {
  const history = Array.isArray(nova.history) ? nova.history.slice(-8) : [];
  // Mood Engine: инъекция настроения в контекст — надёжнее, чем чинить в каждом хендлере отдельно
  const fullContext = contextText + '\n\n' + getMoodInjection(nova.activeMood?.type || 'normal');

  const rawReply = await askGemini(promptText, fullContext, history);

  // Если Нова решила не беспокоить — прерываем без отправки в Telegram
  if (rawReply.includes('SILENT_MODE')) {
    console.log('[cron] SILENT_MODE активен — пуш пропущен.');
    return { cleanText: '', novaChanged: false, lifeChanged: false, silentMode: true };
  }

  const { cleanText, updatedNova, novaChanged, updatedLifeData, lifeChanged } = processCommands(rawReply, nova, lifeData);
  if (novaChanged) await saveNova(updatedNova);
  if (lifeChanged && lifeData) await saveLifeData(updatedLifeData);
  await sendTelegramMessage(TG_CHAT_ID, cleanText || rawReply);
  return { cleanText, novaChanged, lifeChanged, silentMode: false };
}



/* ─────────────────────────────────────────────────────────────
   ХЕЛПЕРЫ ПО ЗАДАЧАМ / СПОРТУ
───────────────────────────────────────────────────────────── */

// БАГ 1: Зомби-задачи — просроченные больше чем на 48ч помечаем done,
// чтобы они не попадали в контекст Gemini и не спамили в пуши.
// Физически не удаляем — история/статистика сохраняется.
const STALE_GOAL_THRESHOLD_MS = 48 * 3600000; // 48 часов

function cleanupStaleGoals(lifeData) {
  const goals = Array.isArray(lifeData.goals) ? lifeData.goals : [];
  const now = Date.now();
  let changed = false;

  const cleaned = goals.map(g => {
    if (!g.done && g.scheduledAt && (now - g.scheduledAt) > STALE_GOAL_THRESHOLD_MS) {
      changed = true;
      return { ...g, done: true, autoArchivedAt: now, autoArchivedReason: 'stale_48h' };
    }
    return g;
  });

  if (changed) {
    lifeData.goals = cleaned;
    const count = cleaned.filter(g => g.autoArchivedReason === 'stale_48h').length;
    console.log('[Nova cron] cleanupStaleGoals: закрыто зомби-задач:', count);
  }
  return { lifeData, changed };
}

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
  // Mood Engine: обновляем/подтверждаем настроение перед генерацией
  const { moodChanged } = updateAndGetMood(nova);
  if (moodChanged) await saveNova(nova);

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
  // Контекст Nova 3.0
  const currentBoss = lifeData.activeBoss || null;
  lines.push(`Активный Главный Босс Дня: ${currentBoss ? currentBoss : 'не назначен'}.`);
  lines.push(`Индикатор выгорания: ${nova.burnoutScore || 0}/3.`);

  const prompt = sunday
    ? 'Напиши доброе утреннее сообщение на воскресенье — без напора, но с теплом и лёгким планом на отдых/семью, если это уместно.'
    : today.length === 0
      ? 'ПЛАН НА СЕГОДНЯ ПУСТ. Это катастрофа. Напиши жёсткое утреннее сообщение: отчитай Лёшу за то, что он не расписал день — без плана он потеряет всё утро. Потребуй немедленно в ответ написать хотя бы 3 задачи. Скажи, что до этого он должен либо выйти на пробежку, либо открыть код Memernity — третьего не дано. Без жалости, с огнём.'
      : 'Напиши бодрое утреннее сообщение с планом на день. Перечисли главные задачи, задай тон дня. ОБЯЗАТЕЛЬНО: выбери одну — самую важную задачу из списка — и назначь её Главным Боссом Дня командой [SET_BOSS: Название задачи]. Объяви Боссом ту задачу, которая принесёт максимум результата сегодня.';

  await sendGeminiPush(prompt, lines.join('\n'), nova, lifeData);
}

async function handleNight() {
  const { lifeData, nova } = await loadState();
  // Mood Engine: обновляем/подтверждаем настроение перед генерацией
  const { moodChanged } = updateAndGetMood(nova);
  if (moodChanged) await saveNova(nova);

  const done = getDoneToday(lifeData);
  const today = getTodayGoals(lifeData);
  const notDone = today.filter(g => !done.some(h => h.goalId === g.id));

  const lines = [];
  lines.push(`Сейчас: ${nowInChisinau()}.`);
  lines.push(`Выполнено сегодня: ${done.length} задач(и).`);
  if (done.length) lines.push('Список выполненного: ' + done.map(h => h.title).join('; ') + '.');
  if (notDone.length) lines.push('Не сделано из запланированного: ' + notDone.map(g => g.title).join('; ') + '.');
  lines.push(`Серия (streak): ${lifeData.streak?.days ?? 0} дней.`);
  // Nova 3.0 контекст
  const boss = lifeData.activeBoss || null;
  lines.push(`Активный Главный Босс Дня: ${boss ? boss : 'не назначен'}.`);
  lines.push(`Индикатор выгорания: ${nova.burnoutScore || 0}/3.`);

  const bossStatus = boss
    ? `Главный Босс Дня был: "${boss}". Проверь по списку выполненных задач — выполнен ли он. Если выполнен — искренне поздравь. Если НЕ выполнен — это провал, отчитай жёстко без жалости, объясни почему выполнение Босса Дня критически важно.`
    : 'Главный Босс Дня не был назначен сегодня — упомяни это как системный сбой в планировании.';

  const prompt = `Напиши вечернее сообщение с итогами дня: кратко похвали/пожури по фактам за выполненное и невыполненное. ${bossStatus} В конце обязательно попроси Лёшу написать 3 вещи, которыми он гордится сегодня (это часть его ритуала перед сном за 15 минут до отбоя).`;

  await sendGeminiPush(prompt, lines.join('\n'), nova, lifeData);
}

async function handleSportCheck() {
  const { lifeData, nova } = await loadState();
  // Mood Engine: обновляем/подтверждаем настроение перед генерацией
  const { moodChanged } = updateAndGetMood(nova);
  if (moodChanged) await saveNova(nova);
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
  const today = todayKeyChisinau(now);

  const events = [];
  const noveltyKeys = [];

  const updatedNova = JSON.parse(JSON.stringify(nova));
  let novaFlowChanged = false;

  // Mood Engine: обновляем настроение (один раз за вызов handlePulse)
  const { moodChanged: moodChangedInPulse } = updateAndGetMood(updatedNova);
  if (moodChangedInPulse) novaFlowChanged = true;

  // ── dailyFlags: сброс по календарным суткам (для 15:20, не завязан на цикл сна) ──
  if (!updatedNova.dailyFlags || updatedNova.dailyFlags.date !== today) {
    updatedNova.dailyFlags = { date: today };
    novaFlowChanged = true;
  }
  const df = updatedNova.dailyFlags;

  // ══════════════════════════════════════════════════════
  // ЯКОРЬ 21:00 — жёсткий хардкод-вопрос, без LLM, раз в сутки
  // ══════════════════════════════════════════════════════
  {
    const minStart = minutesUntilTimeToday('21:00', now);
    const minEnd   = minutesUntilTimeToday('21:05', now);
    if (minStart <= 0 && minEnd >= 0 && updatedNova.lastAnchorAskedDate !== today) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_ANCHOR_QUESTION);
      updatedNova.lastAnchorAskedDate = today;
      novaFlowChanged = true;
    }
  }

  // ══════════════════════════════════════════════════════
  // 15:20 — фиксированное время, не зависит от расписания сна
  // ══════════════════════════════════════════════════════
  {
    const minStart = minutesUntilTimeToday('15:20', now);
    const minEnd   = minutesUntilTimeToday('15:25', now);
    if (minStart <= 0 && minEnd >= 0 && !df.plan1520Sent) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.planCheck);
      df.plan1520Sent = true;
      novaFlowChanged = true;
    }
  }

  // ══════════════════════════════════════════════════════
  // ДИНАМИЧЕСКИЙ УТРЕННИЙ КАСКАД (от targetWakeTime)
  // ══════════════════════════════════════════════════════
  const wakeEpoch = getCycleWakeEpoch(updatedNova);
  if (wakeEpoch !== null) {
    if (!updatedNova.morningFlow || updatedNova.morningFlow.cycleDate !== updatedNova.scheduleSetDate) {
      updatedNova.morningFlow = { cycleDate: updatedNova.scheduleSetDate };
      novaFlowChanged = true;
    }
    const mf = updatedNova.morningFlow;

    // Wake - 30 мин: хардкод, один раз
    const deltaToWakeMin = (wakeEpoch - nowMs) / 60000;
    if (deltaToWakeMin <= 30 && deltaToWakeMin > 25 && !mf.preWakeSent) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.preWake);
      mf.preWakeSent = true;
      novaFlowChanged = true;
    }

    // Wake time: если не подтверждено - спамим КАЖДЫЙ вызов, без де-дупа
    if (nowMs >= wakeEpoch && !updatedNova.morningConfirmed) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.wakeSpam);
    }

    // Wake + 5 / Wake + 30 — считаем от момента реального подтверждения (mf.confirmedAt),
    // а не от планового времени, т.к. подъём может подтвердиться позже расписания.
    if (updatedNova.morningConfirmed && mf.confirmedAt) {
      const elapsed = (nowMs - mf.confirmedAt) / 60000;
      if (elapsed >= 5 && elapsed <= 10 && !mf.waterSent) {
        await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.water);
        mf.waterSent = true;
        novaFlowChanged = true;
      }
      if (elapsed >= 30 && elapsed <= 35 && !mf.teethSent) {
        await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.teeth);
        mf.teethSent = true;
        novaFlowChanged = true;
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // ДИНАМИЧЕСКИЙ ВЕЧЕРНИЙ КАСКАД (от targetSleepTime)
  // ══════════════════════════════════════════════════════
  const sleepEpoch = getCycleSleepEpoch(updatedNova);
  if (sleepEpoch !== null) {
    if (!updatedNova.sleepFlow || updatedNova.sleepFlow.cycleDate !== updatedNova.scheduleSetDate) {
      updatedNova.sleepFlow = { cycleDate: updatedNova.scheduleSetDate };
      novaFlowChanged = true;
    }
    const sf = updatedNova.sleepFlow;

    const deltaToSleepMin = (sleepEpoch - nowMs) / 60000;

    // Sleep - 30 мин: хардкод, один раз
    if (deltaToSleepMin <= 30 && deltaToSleepMin > 25 && !sf.preSleep30Sent) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.preSleep30);
      sf.preSleep30Sent = true;
      novaFlowChanged = true;
    }

    // Sleep - 10 мин: хардкод, один раз
    if (deltaToSleepMin <= 10 && deltaToSleepMin > 5 && !sf.preSleep10Sent) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.preSleep10);
      sf.preSleep10Sent = true;
      novaFlowChanged = true;
    }

    // Sleep time: если не подтверждено - спамим КАЖДЫЙ вызов, без де-дупа
    if (nowMs >= sleepEpoch && !updatedNova.nightConfirmed) {
      await sendTelegramMessage(TG_CHAT_ID, SCHEDULE_PHRASES.sleepSpam);
    }
  }

  // ══════════════════════════════════════════════════════
  // 16:00 — smart trigger: проверка вечерних планов (БЕЗ ИЗМЕНЕНИЙ)
  // ══════════════════════════════════════════════════════
  {
    const minStart = minutesUntilTimeToday('16:00', now);
    const minEnd   = minutesUntilTimeToday('16:05', now);
    if (minStart <= 0 && minEnd >= 0) {
      const key = `school-done:${today}`;
      if (!alreadyNotified(nova, key)) {
        const eveningTasks = goals.filter(g =>
          !g.done && g.scheduledAt &&
          todayKeyChisinau(new Date(g.scheduledAt)) === today &&
          ['business', 'sport'].includes(g.cat)
        );
        if (!eveningTasks.length) {
          const prompt = 'Школа закончилась, а на вечер нет задач по бизнесу или спорту. Спроси у Лёши, чем планирует занять вечер, и предложи расписать 1-2 конкретных дела - без угроз и наказаний, по-дружески, но с напором.';
          const ctx = `Сейчас: ${nowInChisinau()}. Вечерних задач по business/sport на сегодня нет.`;
          await sendGeminiPush(prompt, ctx, updatedNova, lifeData);
        }
        noveltyKeys.push(key);
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // ЗАДАЧИ ИЗ goals (БЕЗ ИЗМЕНЕНИЙ)
  // ══════════════════════════════════════════════════════
  for (const g of goals) {
    if (g.done || !g.scheduledAt) continue;
    const deltaMin = (g.scheduledAt - nowMs) / 60000;

    if (deltaMin >= 0 && deltaMin <= 15) {
      const key = `start:${g.id}`;
      if (!alreadyNotified(nova, key)) {
        events.push(`Через ${Math.round(deltaMin)} мин начинается: «${g.title}» (${g.cat || 'без категории'}), в ${fmtTimeChisinau(g.scheduledAt)}.`);
        noveltyKeys.push(key);
      }
    }

    if (g.cat === 'health' && deltaMin >= 55 && deltaMin <= 65) {
      const key = `water:${g.id}`;
      if (!alreadyNotified(nova, key)) {
        events.push(`Через ~час спортивная/health-задача «${g.title}» - пора поставить воду охлаждаться.`);
        noveltyKeys.push(key);
      }
    }

    if (g.cat === 'sport' && deltaMin >= 110 && deltaMin <= 130) {
      const watch = nova.gadgets?.watchBattery;
      if ((watch === null || watch === undefined || watch < 60)) {
        const key = `watch:${g.id}`;
        if (!alreadyNotified(nova, key)) {
          events.push(`Через ~2 часа тренировка «${g.title}». Заряд часов: ${watch !== null && watch !== undefined ? watch + '%' : 'неизвестен'}. Поставь на зарядку.`);
          noveltyKeys.push(key);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // ВОСКРЕСНЫЙ АУДИТ (БЕЗ ИЗМЕНЕНИЙ)
  // ══════════════════════════════════════════════════════
  if (isSundayInChisinau(now)) {
    const minToAuditStart = minutesUntilTimeToday('19:55', now);
    const minToAuditEnd   = minutesUntilTimeToday('20:05', now);
    const auditKey = `sunday:audit:${today}`;
    if (minToAuditStart <= 0 && minToAuditEnd >= 0 && !alreadyNotified(nova, auditKey)) {
      const doneToday = Array.isArray(lifeData.history)
        ? lifeData.history.filter(h => todayKeyChisinau(new Date(h.completedAt)) === today)
        : [];
      const sportToday = (nova.sportLog || []).includes(today);
      if (!doneToday.length && !sportToday) {
        const auditPrompt = 'Напиши тёплый чек-ин: спроси, как прошло воскресенье, без задач и спорта за день - это нормально, это святой день. Если играл - предложи списать кристаллы самому, назвав число. Никаких обвинений и никакого \'поймать на лжи\' - просто дружеский интерес.';
        const contextLines = [`Сейчас: ${nowInChisinau()}.`, 'Воскресенье. Задач и спорта за день не зафиксировано.'];
        await sendGeminiPush(auditPrompt, contextLines.join('\n'), updatedNova, lifeData);
        const freshNovaAudit = normalizeNovaState(await kv.get(NOVA_KV_KEY));
        markNotified(freshNovaAudit, auditKey);
        await saveNova(freshNovaAudit);
      }
    }
  }

  // ── Сохраняем flow-изменения (anchor/dailyFlags/morningFlow/sleepFlow/activeMood) ──
  if (novaFlowChanged) {
    const freshNovaFlow = normalizeNovaState(await kv.get(NOVA_KV_KEY));
    freshNovaFlow.lastAnchorAskedDate = updatedNova.lastAnchorAskedDate;
    freshNovaFlow.dailyFlags   = updatedNova.dailyFlags;
    freshNovaFlow.morningFlow  = updatedNova.morningFlow;
    freshNovaFlow.sleepFlow    = updatedNova.sleepFlow;
    freshNovaFlow.activeMood   = updatedNova.activeMood; // сохраняем новое настроение если изменилось
    await saveNova(freshNovaFlow);
  }

  if (!events.length) {
    return { note: 'No events' };
  }

  const contextLines = [`Сейчас: ${nowInChisinau()}.`, ...events];
  const prompt = 'Напиши короткий дерзкий пуш от Новы по перечисленным ниже событиям (можно объединить в одно сообщение, если событий несколько). Без воды, сразу суть и характер.';

  const { cleanText } = await sendGeminiPush(prompt, contextLines.join('\n'), updatedNova);

  const freshNova = normalizeNovaState(await kv.get(NOVA_KV_KEY));
  noveltyKeys.forEach(key => markNotified(freshNova, key));
  if (novaFlowChanged) {
    freshNova.lastAnchorAskedDate = updatedNova.lastAnchorAskedDate;
    freshNova.dailyFlags  = updatedNova.dailyFlags;
    freshNova.morningFlow = updatedNova.morningFlow;
    freshNova.sleepFlow   = updatedNova.sleepFlow;
    freshNova.activeMood  = updatedNova.activeMood; // сохраняем новое настроение если оно изменилось
  }
  await saveNova(freshNova);

  return { note: 'Pulse sent', events, message: cleanText };
}

/* ─────────────────────────────────────────────────────────────
   РАЗГОВОРНЫЙ ПИНГ — раз в сутки, окно 12:00-20:00 Кишинёв.
   Инициирует диалог вопросом "как дела/настроение", чтобы вовлечь Босса.
───────────────────────────────────────────────────────────── */
async function handleRandomPing() {
  const { nova } = await loadState();
  const now = new Date();
  const today = todayKeyChisinau(now);

  // сброс dailyFlags по календарным суткам (если ещё не сброшены другим хендлером)
  const updatedNova = JSON.parse(JSON.stringify(nova));
  if (!updatedNova.dailyFlags || updatedNova.dailyFlags.date !== today) {
    updatedNova.dailyFlags = { date: today };
  }

  if (updatedNova.dailyFlags.randomPingSent) {
    console.log('[cron] random-ping: уже отправлен сегодня, пропускаем');
    return { skipped: true, reason: 'already_sent_today' };
  }

  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now));
  const normalizedHour = hour === 24 ? 0 : hour;
  if (normalizedHour < 12 || normalizedHour >= 20) {
    console.log('[cron] random-ping: вне окна 12:00-20:00, пропускаем');
    return { skipped: true, reason: 'outside_window' };
  }

  // Настроение (Mood Engine) — раскатываем/подтверждаем ПЕРЕД генерацией
  const { moodChanged } = updateAndGetMood(updatedNova);

  const contextText = `Сейчас: ${nowInChisinau()}.`;
  const prompt = 'Инициируй лёгкий разговорный пинг: спроси у Лёши "как дела?" или "какое настроение?" - живо, по-дружески, в 1-2 предложениях, без канцелярита. Это не проверка задач, а просто человеческий интерес.';

  await sendGeminiPush(prompt, contextText, updatedNova);

  // помечаем флаг ПОСЛЕ успешной отправки, перечитываем свежий стейт из KV
  // (sendGeminiPush уже мог сохранить nova внутри себя при processCommands)
  const freshNova = normalizeNovaState(await kv.get(NOVA_KV_KEY));
  if (!freshNova.dailyFlags || freshNova.dailyFlags.date !== today) {
    freshNova.dailyFlags = { date: today };
  }
  freshNova.dailyFlags.randomPingSent = true;
  if (moodChanged) freshNova.activeMood = updatedNova.activeMood;
  await saveNova(freshNova);

  return { skipped: false };
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

  /* ── DND guard: жёсткий режим тишины ──
     Если Лёша включил [DND: N], nova.dndUntil содержит epoch ms,
     до которого крон ВООБЩЕ не беспокоит — LLM не вызывается. */
  try {
    const novaRawDnd = await kv.get(NOVA_KV_KEY);
    const dndUntil = (novaRawDnd && typeof novaRawDnd === 'object') ? (novaRawDnd.dndUntil || 0) : 0;
    if (typeof dndUntil === 'number' && Date.now() < dndUntil) {
      console.log('[cron] DND активен до', new Date(dndUntil).toISOString(), '— пропускаем тип:', type);
      return res.status(200).json({ ok: true, dnd: true, dndUntil });
    }
  } catch (dndErr) {
    // Если KV недоступен — не блокируем работу крона, просто логируем
    console.warn('[cron] DND guard KV error:', dndErr?.message);
  }

  // Каждый тип задачи запускается через waitUntil — хендлер мгновенно
  // возвращает 200, а тяжёлая работа (KV + Gemini + TG) идёт в фоне.

  // ── БАГ 1: чистка зомби-задач на каждый вызов крона ──
  // Выполняется синхронно ДО switch, гарантирует что зомби живут <= ~5 мин.
  try {
    const lifeDataRaw = await kv.get(LIFE_KV_KEY);
    if (lifeDataRaw && typeof lifeDataRaw === 'object') {
      const { lifeData: cleanedLife, changed } = cleanupStaleGoals(lifeDataRaw);
      if (changed) await saveLifeData(cleanedLife);
    }
  } catch (cleanupErr) {
    console.warn('[cron] cleanupStaleGoals error:', cleanupErr?.message);
  }

  switch (type) {
    case 'morning': {
      waitUntil(handleMorning());
      return res.status(200).json({ ok: true, type, queued: true });
    }
    case 'night': {
      waitUntil(handleNight());
      return res.status(200).json({ ok: true, type, queued: true });
    }
    case 'sport-check': {
      waitUntil(handleSportCheck());
      return res.status(200).json({ ok: true, type, queued: true });
    }
    case 'reminders': {
      waitUntil(handleReminders());
      return res.status(200).json({ ok: true, type, queued: true });
    }
    case 'pulse': {
      waitUntil(handlePulse());
      return res.status(200).json({ ok: true, type, queued: true });
    }
    case 'random-ping': {
      waitUntil(handleRandomPing());
      return res.status(200).json({ ok: true, type, queued: true });
    }
    default:
      return res.status(400).json({
        ok: false,
        error: 'unknown type',
        allowed: ['morning', 'night', 'sport-check', 'reminders', 'pulse', 'random-ping'],
      });
  }
}