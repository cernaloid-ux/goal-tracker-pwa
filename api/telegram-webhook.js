/* ══════════════════════════════════════════════════════════════
   NOVA OS — api/telegram-webhook.js
   Telegram Webhook → Vercel KV (контекст) → Gemini → ответ
   Парсит скрытые команды вида [SET_WATCH: 70%], [ADD_TASK: ... | HH:MM]
   и пишет их в KV (nova-база и/или lifeData-база задач).

   ОБНОВЛЕНИЯ ПРЕДЫДУЩЕГО РЕФАКТОРИНГА:
   1. Дедупликация update_id — защита от Telegram retry spam.
   2. Новый характер Novы — живая, с эмоциями, чередует обращения.
   3. Ночной режим (02:00–05:00 Кишинёв) — Gemini не вызывается.
   4. Таймер "игнора" сокращён с 60 до 15 минут (см. IGNORE_THRESHOLD_MS).

   ОБНОВЛЕНИЯ ЭТОГО РЕФАКТОРИНГА («очеловечивание»):
   5. Мульти-сообщения — Nova может разбивать ответ разделителем [SPLIT]
      на несколько сообщений, отправляются по очереди с задержкой + "печатает...".
   6. Стиль без канцелярита: 1-2 эмодзи на ответ, только короткий дефис (-),
      никаких длинных/средних тире.
   7. Проактивность и эмпатия: похвала при DONE_TASK, случайное "как дела",
      уточняющий вопрос про напоминание при важных задачах.

   ОБНОВЛЕНИЯ ЭТОГО РЕФАКТОРИНГА («анти-CoT»):
   8. Жёсткий запрет на Chain-of-Thought / рассуждения вслух в <output_format>,
      чтобы Gemini 3.6 Flash не выводил в чат английские самопроверки правил.
   ══════════════════════════════════════════════════════════════ */

const { kv } = require('@vercel/kv');
const { waitUntil } = require('@vercel/functions');
const { NOVA_ROLE_PROMPT, normalizeCat } = require('./_nova-core');

const maxDuration = 60; // Vercel: лимит 60 сек

/* ─────────────────────────────────────────────────────────────
   ENV
───────────────────────────────────────────────────────────── */
const TG_BOT_TOKEN     = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID       = process.env.TG_CHAT_ID;
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
// Секрет для системных/cron-запросов, которым разрешено пробивать ночной режим.
// Добавь эту переменную в Vercel (любая случайная строка) и передавай её
// в заголовке `x-nova-cron-secret` при вызове вебхука из cron-задачи.
const NOVA_CRON_SECRET = process.env.NOVA_CRON_SECRET;

const TG_API = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

const LIFE_KV_KEY  = 'цель:master_admin_id';
const NOVA_KV_KEY  = 'цель:master_admin_id:nova';
const DEDUP_KV_KEY = 'цель:master_admin_id:nova:processed_updates';

const NOVA_HISTORY_LIMIT = 12;   // сколько последних реплик держим в памяти
const TYPING_INTERVAL_MS = 4000; // Telegram сбрасывает "печатает..." через ~5 сек — обновляем каждые 4
const DEDUP_LIMIT        = 50;   // сколько последних update_id храним для дедупликации

// Разделитель, которым Nova режет ответ на несколько сообщений
const SPLIT_DELIMITER = '[SPLIT]';
// Пауза между отправкой частей мульти-сообщения
const MULTI_MSG_DELAY_MIN_MS = 1500;
const MULTI_MSG_DELAY_MAX_MS = 2000;

// SCHOOL_SCHEDULE: 1=Пн … 5=Пт. s=предмет, r=кабинет.
const SCHOOL_SCHEDULE = {
  1: [{s:'Русский', r:'302'}, {s:'Русский', r:'302'}, {s:'Математика', r:'217'}, {s:'Математика', r:'217'}, {s:'Английский', r:'5/212'}, {s:'Английский', r:'5/212'}, {s:'Химия', r:'211'}],
  2: [{s:'Румынский', r:'405/406'}, {s:'Румынский', r:'405/406'}, {s:'Физика', r:'301'}, {s:'Физика', r:'301'}, {s:'Разв.личности', r:'204'}, {s:'Физ-ра', r:'БСЗ'}, {s:'Химия', r:'211'}],
  3: [{s:'Математика', r:'217'}, {s:'Математика', r:'217'}, {s:'Русский', r:'305'}, {s:'Русский', r:'305'}, {s:'Биология', r:'6'}, {s:'Английский', r:'5/212'}, {s:'История', r:'303'}],
  4: [{s:'История', r:'303'}, {s:'География', r:'401'}, {s:'Химия', r:'211'}, {s:'Химия', r:'211'}, {s:'Румынский', r:'218/400'}, {s:'Румынский', r:'218/400'}, {s:'Информатика', r:'203/206'}],
  5: [{s:'География', r:'401'}, {s:'Математика', r:'10'}, {s:'Физика', r:'301'}, {s:'Биология', r:'6'}, {s:'Физ-ра', r:'БСЗ'}, {s:'Информатика', r:'203'}, {s:'Гражданское', r:'302'}],
};

// Возвращает день недели по Кишинёву: 1 (Пн) ... 7 (Вс)
function getChisinauIsoWeekday(base = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Chisinau', weekday: 'short' }).format(base);
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[wd] || 7;
}

// Следующий УЧЕБНЫЙ день: Пн-Чт -> завтра, Пт/Сб/Вс -> ближайший понедельник
function getNextSchoolDayIsoWeekday(todayIso) {
  return (todayIso >= 1 && todayIso <= 4) ? todayIso + 1 : 1;
}

function formatTodaySchoolSchedule(dayIso) {
  const lessons = SCHOOL_SCHEDULE[dayIso];
  if (!lessons || !lessons.length) return null;
  return lessons.map((l, i) => `Урок ${i + 1}: ${l.s}, каб. ${l.r}`).join('\n');
}

function formatNextDaySubjects(dayIso) {
  const lessons = SCHOOL_SCHEDULE[dayIso];
  if (!lessons || !lessons.length) return null;
  return lessons.map(l => l.s).join(', ');
}

// Таймер "игнора"
const IGNORE_THRESHOLD_MS = 15 * 60 * 1000;

// Ночной режим: с 02:00 до 05:00 по Кишинёву Gemini не вызывается.
const NIGHT_MODE_START_HOUR = 2;
const NIGHT_MODE_END_HOUR   = 5;
const NIGHT_MODE_REPLY = 'Ночной режим 02:00-05:00. Ответ после 05:00.';

/* ─────────────────────────────────────────────────────────────
   СИСТЕМНЫЙ ПРОМПТ НОВЫ
───────────────────────────────────────────────────────────── */
const NOVA_BASE_PROMPT = `${NOVA_ROLE_PROMPT}

<notes_field_guidance>
Поле "notes" заполняется фактами и деталями из сообщения пользователя (дистанция, материалы, ссылки, участники). Если деталей нет, оставь пустую строку. Не копируй title в notes.
</notes_field_guidance>

<context>
Сегодняшняя дата: __TODAY__.
</context>`;

/* ─────────────────────────────────────────────────────────────
   ПЕРЕХВАТ СИСТЕМНЫХ ФРАЗ
───────────────────────────────────────────────────────────── */
const SYSTEM_PUSH_PATTERNS = [
  /^time to wake up/i,
  /^good morning/i,
  /^wake up/i,
  /^\d+ min(utes?)? until (bedtime|sleep)/i,
  /^time to (sleep|bed)/i,
  /^reminder:/i,
  /^workout (time|reminder)/i,
  /^system (event|alert|notification):/i,
  /^(it'?s )?time (to|for)/i,
];

function isSystemPush(text) {
  return SYSTEM_PUSH_PATTERNS.some(re => re.test(text.trim()));
}

// Проксирует системную фразу через Gemini
async function handleSystemPush(chatId, sysPhrase, nova, lifeData) {
  const contextText = buildContext(lifeData, nova);
  const userPrompt = `Системное событие: «${sysPhrase}». Напиши короткое информативное уведомление на русском. Максимум 1-2 предложения. Без эмодзи.`;
  const history = nova.history.slice(-NOVA_HISTORY_LIMIT);
  const rawReply = await askGemini(userPrompt, contextText, history);
  const { cleanText } = processCommands(rawReply, nova, lifeData);
  await sendMultiPartMessage(chatId, cleanText || rawReply);
  return cleanText || rawReply;
}

const COMMAND_SYNTAX_HINT = `<commands_syntax>
Если нужно сохранить или обновить данные - вставь в ответ скрытую команду в квадратных скобках, ОТДЕЛЬНОЙ строкой. Пользователь эти команды не увидит - они вырезаются автоматически.

<simple_commands>
[ASK_MISSING: {"missing_fields":["time"],"title":"Название"}] - запросить недостающие данные (time, date, color) для события
[SET_WATCH: 70%]          - заряд Apple Watch
[SET_AIRPODS: 45%]        - заряд AirPods
[SET_POWERBANK: 90%]      - заряд повербанка
[LOG_SPORT: сегодня]      - отметить тренировку сегодняшним днём
[SET_MOOD: текст]         - текущее настроение/состояние
[SAVE_NOTE: текст]        - сохранить важную заметку в память
[ADD_REMINDER: текст]     - сохранить напоминание
[DELETE_TASK: id]         - удалить задачу по её ID
[DONE_TASK: id]           - отметить задачу выполненной
[EDIT_TASK: id | Новое название] - переименовать задачу
[RESCHEDULE_TASK: id | YYYY-MM-DD HH:MM] - перенести задачу
[FIND_TASK: ключевое слово] - искать задачу вне ближайших 14 дней
[SET_BOSS: Название задачи] - назначить Главного Босса Дня
[BOSS_DONE] - отметить Босса Дня выполненным
[PENALTY_TASK: Описание] - штрафная задача
[BURNOUT_WARNING] - увеличить счётчик выгорания на 1
[RESET_BURNOUT] - сбросить счётчик выгорания
[JOURNAL_DONE] - вечерний ритуал получен
[BEDTIME_CONFIRMED] - ранний отбой зафиксирован
[LOG_SLEEP_HOURS: N] - часы сна
[DEDUCT_CRYSTALS: N] - списать N кристаллов
[SET_SCHEDULE: HH:MM | HH:MM] - расписание сна: первое время - ОТБОЙ сегодня, второе - ПОДЪЁМ завтра
[MORNING_CONFIRMED]           - подтверждение подъёма
[NIGHT_CONFIRMED]             - подтверждение отбоя
[SKIP_SCHOOL_TODAY]           - пропуск школы сегодня (болезнь, каникулы, выходной)
</simple_commands>

<schedule_commands>
Если пользователь называет два времени ("в 23 лягу, в 7 встану") - выдай [SET_SCHEDULE: 23:00 | 07:00] (первое - отбой, второе - подъём).
Если названо утреннее приветствие ("доброе утро") - выдай [MORNING_CONFIRMED].
Если названо вечернее прощание ("спокойной ночи") - выдай [NIGHT_CONFIRMED].
</schedule_commands>

<add_task_command>
[ADD_TASK_JSON: {...}] - создать задачу в Life OS. JSON должен быть ПОЛНЫМ и валидным - никогда не обрывай его на середине.

Поля объекта:
  title         - название задачи (обязательно, строка)
  notes         - факты из сообщения или пустая строка (см. <notes_field_guidance>)
  priority      - 'low', 'mid' или 'high'
  cat           - 'business'|'sport'|'school'|'life' (см. <categorization>)
  date          - "YYYY-MM-DD", вычисляй от сегодняшней даты
  scheduledAt   - "HH:MM" кишинёвское время, ОБЯЗАТЕЛЬНО если названо время
  timeTo        - "HH:MM" опционально, ВРЕМЯ ОКОНЧАНИЯ события (кишинёвское). Указывай только если явно назван промежуток.
  travelTime    - минуты в пути, если нужно куда-то добираться
  duration_min  - длительность в минутах
  isEvent       - boolean. true для любой задачи с конкретным временем или промежутком, false только для дел на весь день БЕЗ конкретного времени.
  reminders     - СТРОГО МАССИВ ЧИСЕЛ, например [15]. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ПИСАТЬ СЮДА ТЕКСТ!

Правила:
**CRITICAL: Если указывается ЛЮБОЙ временной промежуток («с 15:00 до 18:00», «в 18:00 на 2 часа», «с 11 до 20»), ты ОБЯЗАНА выставить \`isEvent: true\` и корректно вычислить \`duration_min\` (минуты между началом и концом). Задачи с \`isEvent: false\` допустимы ТОЛЬКО для дел на весь день БЕЗ конкретного времени.**
1. Нет времени начала — верни ASK_MISSING (например, [ASK_MISSING: {"missing_fields":["time"],"title":"..."}]).
2. Если задач несколько - выведи все команды [ADD_TASK_JSON: ...] подряд, каждую на новой строке, полностью до закрывающей \`}]\`.
3. Никогда не пиши о добавлении без команды [ADD_TASK_JSON: ...] или [ASK_MISSING: ...].
4. Примеры isEvent: «с 15:00 до 18:00» → scheduledAt:"15:00", timeTo:"18:00", duration_min:180, isEvent:true; «в 18:00 на 2 часа» → scheduledAt:"18:00", duration_min:120, isEvent:true.
5. ТЕСТЫ И КОНТРОЛЬНЫЕ: Если нужно напомнить про тест/контрольную, поставь напоминание заранее (например, за день [1440] или за два дня [2880]). Для обычных заданий — [120].
</add_task_command>
</commands_syntax>

<output_format>
СТОП. ПЕРЕД ГЕНЕРАЦИЕЙ ПРОЧТИ ЭТО:

Твой output - это ЕДИНСТВЕННОЕ, что видит пользователь. Первый же символ ответа летит прямо в чат. Никакого внутреннего монолога, самопроверки правил, черновиков или рассуждений.

ЖЁСТКО ЗАПРЕЩЕНО:
- Любой текст на английском языке (рассуждения, самопроверка, черновик).
- Фразы-самопроверки: "Let's verify", "Let's check", "Checking constraints", "Проверим правила", "Давай подумаю".
- Показ процесса принятия решения, цепочки рассуждений (Chain of Thought).
- Вывод XML-тегов или служебных слов вне контекста ответа.

Финальный ответ пользователю состоит СТРОГО из:
1. Краткого текста на русском языке (1-2 коротких предложения), строго по делу.
2. Двойного переноса строки.
3. Скрытых команд (если нужны), каждая на своей строке, СТРОГО ПОСЛЕ текста.
Запрещено использовать разделитель [SPLIT].
</output_format>`;

/* ─────────────────────────────────────────────────────────────
   ДЕФОЛТНОЕ СОСТОЯНИЕ NOVA / LIFE
───────────────────────────────────────────────────────────── */
function getDefaultNovaState() {
  return {
    gadgets: { watchBattery: null, airpodsBattery: null, powerbankBattery: null },
    mood: '',
    sportLog: [],       // ['2026-08-15', '2026-08-17', ...]
    notes: [],          // [{ text, ts }]
    reminders: [],       // [{ text, ts }]
    history: [],         // [{ role:'user'|'model', text, ts }]
    lastMessageTime: null, // epoch ms последнего входящего сообщения Босса — для таймера игнора
    burnoutScore: 0,    // Радар Выгорания: 0-3, при 3 — авто-DND на 24 ч
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
    pendingDraft: null,        // { title, missing_fields, ts }
    pendingAlert: null,        // { key, title, startAt, sentAt, pings }
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
    lastMessageTime: typeof raw.lastMessageTime === 'number' ? raw.lastMessageTime : null,
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
    pendingDraft: (raw.pendingDraft && typeof raw.pendingDraft === 'object') ? raw.pendingDraft : null,
    pendingAlert: (raw.pendingAlert && typeof raw.pendingAlert === 'object') ? raw.pendingAlert : null,
    // сквозные поля (не теряем при нормализации)
    ...(raw.dndUntil !== undefined ? { dndUntil: raw.dndUntil } : {}),
    ...(raw.pulseLog !== undefined ? { pulseLog: raw.pulseLog } : {}),
    ...(raw.pendingDraft !== undefined ? { pendingDraft: raw.pendingDraft } : {}),
    ...(raw.pendingAlert !== undefined ? { pendingAlert: raw.pendingAlert } : {}),
  };
}

/* ─────────────────────────────────────────────────────────────
   MOOD ENGINE
   Настроение генерируется МАТЕМАТИЧЕСКИ на бэкенде, а не LLM.
   Сбрасывается ежедневно в 03:00 по Кишинёву.
   Распределение: 10% sad, 10% angry, 25% sweet, 55% normal.
───────────────────────────────────────────────────────────── */

function rollMood() {
  const r = Math.random() * 100;
  if (r < 30) return 'sad';      // 0-30   — грустная/пессимистичная (30%)
  if (r < 40) return 'angry';    // 30-40  — злая/жёсткая (10%)
  if (r < 75) return 'sweet';    // 40-75  — милая/заигрывающая (35%)
  return 'normal';               // 75-100 — обычная (25%)
}

// Возвращает epoch ms ближайшего будущего 03:00 по Кишинёву.
// Если сейчас уже позже 03:00 сегодняшнего дня (по Кишинёву) — берём 03:00 завтра.
function getNextMoodResetEpoch(base = new Date()) {
  const todayReset = chisinauTimeToEpoch('03:00', base);
  if (base.getTime() < todayReset) {
    return todayReset;
  }
  const tomorrow = new Date(base.getTime() + 86400000);
  return chisinauTimeToEpoch('03:00', tomorrow);
}

// Возвращает { nova, moodChanged, mood }.
// nova — тот же объект, но с гарантированно свежим activeMood (мутирует по месту).
// Вызывать ПЕРЕД buildContext/сборкой промпта, в КАЖДОМ обработчике, где идёт запрос к Gemini.
function updateAndGetMood(nova) {
  const now = Date.now();
  if (!nova.activeMood || now > nova.activeMood.expiresAt) {
    const type = rollMood();
    nova.activeMood = { type, expiresAt: getNextMoodResetEpoch(new Date(now)) };
    console.log('[Nova mood] новое настроение:', type, '— сброс в 03:00 Кишинёва:', new Date(nova.activeMood.expiresAt).toISOString());
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

// lifeData — та же база, что пишет фронтенд Life OS через api/sync.js
function ensureLifeData(raw) {
  if (raw && typeof raw === 'object') {
    if (!Array.isArray(raw.goals)) raw.goals = [];
    if (!Array.isArray(raw.history)) raw.history = [];
    if (raw.activeBoss === undefined) raw.activeBoss = null; // Главный Босс Дня
    if (raw.skipSchoolToday === undefined) raw.skipSchoolToday = null; // флаг пропуска школы
    return raw;
  }
  return { goals: [], history: [], gems: 0, streak: { days: 0, lastDate: '', doneToday: false }, macroGoals: [], activeBoss: null, skipSchoolToday: null };
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

// текущий час по Кишинёву (0-23), используется для ночного режима
function currentHourChisinau(base = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Chisinau', hour: '2-digit', hour12: false,
  });
  const hourStr = fmt.format(base); // может вернуть "24" в некоторых Node-реализациях
  const hour = Number(hourStr);
  return hour === 24 ? 0 : hour;
}

// true, если сейчас окно ночного режима (по умолчанию 02:00–05:00 Кишинёв)
function isNightModeNow(base = new Date()) {
  const hour = currentHourChisinau(base);
  return hour >= NIGHT_MODE_START_HOUR && hour < NIGHT_MODE_END_HOUR;
}

// смещение Кишинёва относительно UTC в минутах (учитывает DST)
function getChisinauOffsetMinutes(base = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Chisinau', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(base).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return (asUTC - base.getTime()) / 60000;
}

// переводит "HH:MM" (кишинёвское время) в epoch ms для сегодняшнего дня
function chisinauTimeToEpoch(hhmm, dayBase = new Date()) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const offsetMin = getChisinauOffsetMinutes(dayBase);
  const dParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(dayBase).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const utcMsIfNoOffset = Date.UTC(Number(dParts.year), Number(dParts.month) - 1, Number(dParts.day), h || 0, m || 0, 0);
  return utcMsIfNoOffset - offsetMin * 60000;
}

/* ─────────────────────────────────────────────────────────────
   ДЕДУПЛИКАЦИЯ TELEGRAM UPDATE_ID
   Vercel Serverless обнуляет глобальные переменные между вызовами,
   поэтому список обработанных update_id храним в KV.
───────────────────────────────────────────────────────────── */
async function checkAndMarkProcessed(updateId) {
  const raw = await kv.get(DEDUP_KV_KEY);
  const ids = Array.isArray(raw) ? raw : [];

  if (ids.includes(updateId)) {
    return true; // уже обработан — дубль
  }

  const updatedIds = [...ids, updateId].slice(-DEDUP_LIMIT);
  // пишем сразу же, ДО вызова Gemini — чтобы параллельный retry-запрос
  // от Telegram увидел этот update_id как уже обработанный как можно раньше
  await kv.set(DEDUP_KV_KEY, updatedIds);
  return false;
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
    const fmt14 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau' });
    const nowTs = Date.now();
    const in14days = nowTs + 14 * 86400000;

    // Задачи на ближайшие 14 дней (включая сегодня)
    const upcomingTasks = goals.filter(g => {
      if (g.done || !g.scheduledAt) return false;
      return g.scheduledAt >= nowTs && g.scheduledAt <= in14days;
    }).sort((a, b) => a.scheduledAt - b.scheduledAt);

    const overdue = goals.filter(g => !g.done && g.scheduledAt && g.scheduledAt < nowTs);

    lines.push(`Серия (streak): ${streakDays} дней подряд. Кристаллов (gems): ${gems}.`);

    if (upcomingTasks.length) {
      lines.push('Задачи на ближайшие 14 дней (включая сегодня):');
      upcomingTasks.forEach(g => {
        const dateStr = fmt14.format(new Date(g.scheduledAt));
        const timeStr = new Date(g.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Chisinau' });
        lines.push(`- [Дата: ${dateStr}] [ID: ${g.id}] ${g.title} (Категория: ${g.cat || 'business'}) в ${timeStr}`);
      });
    } else {
      lines.push('Задач на ближайшие 14 дней не запланировано.');
    }

    if (overdue.length) {
      lines.push(`Просроченных задач: ${overdue.length}:`);
      overdue.slice(0, 5).forEach(g => {
        const dateStr = g.scheduledAt ? fmt14.format(new Date(g.scheduledAt)) : '?';
        lines.push(`- [Дата: ${dateStr}] [ID: ${g.id}] ${g.title} (Категория: ${g.cat || 'business'})`);
      });
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

  /* --- Life Boss (Главный Босс Дня) --- */
  if (lifeData && typeof lifeData === 'object') {
    const boss = lifeData.activeBoss || null;
    lines.push(`Активный Главный Босс Дня: ${boss ? boss : 'не назначен'}.`);
  }

  /* --- Радар Выгорания --- */
  const burnout = typeof nova.burnoutScore === 'number' ? nova.burnoutScore : 0;
  lines.push(`Индикатор выгорания: ${burnout}/3.`);

  /* --- Результаты поиска FIND_TASK (TTL 10 минут) --- */
  if (nova.lastSearchResults && (Date.now() - nova.lastSearchResults.ts) < 10 * 60000) {
    const { query, matches } = nova.lastSearchResults;
    if (matches.length) {
      lines.push(`Результаты поиска по запросу "${query}":`);
      matches.forEach(m => {
        const dateStr = m.date ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Chisinau', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(m.date)) : 'без даты';
        lines.push(`- [ID: ${m.id}] ${m.title} (${dateStr})`);
      });
    } else {
      lines.push(`Поиск по "${query}" ничего не нашёл.`);
    }
  }

  /* --- школьное расписание --- */
  const todayIsoForSchool = getChisinauIsoWeekday();
  if (todayIsoForSchool >= 1 && todayIsoForSchool <= 5) {
    const todaySchedule = formatTodaySchoolSchedule(todayIsoForSchool);
    if (todaySchedule) {
      lines.push('Расписание уроков на сегодня:');
      lines.push(todaySchedule);
    }
  }
  const nextSchoolIso = getNextSchoolDayIsoWeekday(todayIsoForSchool);
  const nextSubjects = formatNextDaySubjects(nextSchoolIso);
  if (nextSubjects) {
    lines.push(`Предметы на следующий учебный день: ${nextSubjects}.`);
  }

  /* --- pendingDraft (уточнение события) --- */
  if (nova.pendingDraft && (Date.now() - (nova.pendingDraft.ts || 0)) < 10 * 60000) {
    const fields = Array.isArray(nova.pendingDraft.missing_fields) ? nova.pendingDraft.missing_fields.join(', ') : '';
    lines.push(`Ожидается уточнение для события: «${nova.pendingDraft.title}» (не хватает: ${fields}).`);
  }

  /* --- pendingAlert (проактивный алерт) --- */
  if (nova.pendingAlert && nova.pendingAlert.title) {
    lines.push(`Последний вопрос бота: «Ты уже вышел?» по событию «${nova.pendingAlert.title}». Интерпретируй ответ в этом контексте.`);
  }

  return lines.join('\n');
}

/* ─────────────────────────────────────────────────────────────
   ЗАПРОС К GEMINI
───────────────────────────────────────────────────────────── */
async function askGemini(userText, contextText, history) {
  const systemInstruction = `${NOVA_BASE_PROMPT.replace('__TODAY__', todayKeyChisinau())}\n\n<current_context>\n${contextText}\n</current_context>\n\n<commands>\n${COMMAND_SYNTAX_HINT}\n</commands>`;

  const contents = [];
  history.forEach(h => {
    contents.push({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.text }] });
  });
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 4096,
    },
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
   ПАРСИНГ СКРЫТЫХ КОМАНД
   processCommands теперь мутирует ДВЕ базы — nova и lifeData (для ADD_TASK) —
   и возвращает обе, с отдельными флагами изменений.
───────────────────────────────────────────────────────────── */
// Базовый regex для простых команд (не JSON — потому что JSON может содержать ']')
const COMMAND_RE = /\[([A-Z_]+)(?:\s*:\s*([^\]]+))?\]/g;
// Отдельный regex для ADD_TASK_JSON (жадный поиск до последней '}]')
const ADD_TASK_JSON_RE = /\[ADD_TASK_JSON:\s*(\{.*?\})\s*\]/gs;
// Отдельный regex для ASK_MISSING (плоский JSON с массивом missing_fields)
const ASK_MISSING_RE = /\[ASK_MISSING:\s*(\{.*?\})\s*\]/gs;

function parseBatteryValue(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function processCommands(rawReply, nova, lifeData) {
  let novaChanged = false;
  let lifeChanged = false;
  const updatedNova = JSON.parse(JSON.stringify(nova));           // deep clone
  const updatedLifeData = JSON.parse(JSON.stringify(lifeData));
  if (!Array.isArray(updatedLifeData.goals)) updatedLifeData.goals = [];

  let missing = null;
  // ── Шаг 0: парсим ASK_MISSING до COMMAND_RE (чтобы [ не обрезалась) ──
  let workingText = rawReply.replace(ASK_MISSING_RE, (match, jsonRaw) => {
    try {
      const parsed = JSON.parse(jsonRaw.trim());
      if (parsed && Array.isArray(parsed.missing_fields) && parsed.missing_fields.length) {
        missing = {
          missing_fields: parsed.missing_fields.map(String),
          title: String(parsed.title || 'Новое событие').slice(0, 500),
        };
      }
    } catch (err) {
      console.warn('[Nova] ASK_MISSING parse error:', err.message, '| raw:', jsonRaw.slice(0, 200));
    }
    return '';
  });

  // ── Шаг 1: парсим ADD_TASK_JSON отдельным regex (поддерживает ']' внутри JSON) ──
  workingText = workingText.replace(ADD_TASK_JSON_RE, (match, jsonRaw) => {
    // ── ШАГ 2: защита от краша — LLM может засунуть текст вместо JSON ──
    let parsed;
    try {
      parsed = JSON.parse(jsonRaw.trim());
    } catch (jsonErr) {
      console.error('[Nova] ADD_TASK_JSON: невалидный JSON от LLM, игнорируем команду. Ошибка:', jsonErr.message, '| raw:', jsonRaw.slice(0, 200));
      return ''; // тихо вырезаем из текста, не крашим ответ
    }

    try {
      let normalizedCat = normalizeCat(parsed.cat, parsed.title);

      const VALID_PRIORITIES = ['low','mid','high'];

      // scheduledAt: строим из date (YYYY-MM-DD) + scheduledAt (HH:MM), оба — кишинёвские
      let scheduledAt = null;
      let dayBaseForTask = new Date();
      if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))) {
        const [y, mo, d] = String(parsed.date).split('-').map(Number);
        dayBaseForTask = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)); // полдень UTC — нейтральная точка
      }
      let allDay = false;
      if (parsed.scheduledAt && /^\d{1,2}:\d{2}$/.test(String(parsed.scheduledAt))) {
        scheduledAt = chisinauTimeToEpoch(String(parsed.scheduledAt), dayBaseForTask);
      } else if (parsed.scheduledAt && typeof parsed.scheduledAt === 'number') {
        scheduledAt = parsed.scheduledAt; // уже epoch ms
      } else if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))) {
        // Задача с датой, но без конкретного времени — all-day задача на этот день
        scheduledAt = chisinauTimeToEpoch('23:59', dayBaseForTask);
        allDay = true;
      }

      // scheduledEndAt: из timeTo (HH:MM), тем же днём, что и scheduledAt
      let scheduledEndAt = null;
      if (parsed.timeTo && /^\d{1,2}:\d{2}$/.test(String(parsed.timeTo))) {
        scheduledEndAt = chisinauTimeToEpoch(String(parsed.timeTo), dayBaseForTask);
      }

      // Страховка: если timeTo раньше scheduledAt (переход через полночь) — +24ч
      if (scheduledEndAt && scheduledAt && scheduledEndAt <= scheduledAt) {
        scheduledEndAt += 86400000;
      }
      const hasRange = Boolean(scheduledAt && scheduledEndAt && scheduledEndAt > scheduledAt);
      let duration = Number.isFinite(Number(parsed.duration_min)) && Number(parsed.duration_min) > 0
        ? Number(parsed.duration_min) : null;
      if (hasRange) duration = Math.round((scheduledEndAt - scheduledAt) / 60000);
      const isEvent = Boolean(parsed.isEvent) || hasRange || Boolean(scheduledAt && duration && parsed.duration_min);

      const newTask = {
        id:           'nova_' + Date.now(),
        title:        String(parsed.title || 'Новая задача').slice(0, 500),
        notes:        String(parsed.notes || '').slice(0, 2000),
        priority:     VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'mid',
        cat:          normalizedCat, // уже нормализована выше
        tags:         Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10).map(String) : [],
        scheduledAt,
        scheduledEndAt,          // время окончания события (из timeTo)
        isEvent,                 // true если у задачи есть конкретное время
        allDay:       Boolean(allDay || parsed.allDay),
        isProject:    false,
        parentId:     null,
        recurrence:   null,
        duration_min: duration ?? 60,
        travelTime:   Number.isFinite(Number(parsed.travelTime))   ? Math.max(0, Number(parsed.travelTime))   : 0,
        location:     String(parsed.location || '').slice(0, 200),
        cost:         Number.isFinite(Number(parsed.cost)) ? Number(parsed.cost) : 0,
        reminders:    Array.isArray(parsed.reminders) ? parsed.reminders.slice(0, 5).map(Number) : [],
        done:         false,
        elapsed:      0,
        startTime:    null,
        paused:       false,
        subtasks:     [],
        createdAt:    Date.now(),
      };
      console.log('[Nova] ADD_TASK_JSON isEvent=' + isEvent + ' duration_min=' + newTask.duration_min, newTask.id, newTask.title);

      updatedLifeData.goals.push(newTask);
      lifeChanged = true;
      updatedNova.pendingDraft = null;
      novaChanged = true;
      console.log('[Nova] ADD_TASK_JSON:', newTask.id, newTask.title, scheduledAt ? new Date(scheduledAt).toISOString() : 'no time');
      // БАГ 4 guard: мониторим пустой notes для sport/health — помогает понять, помог ли фикс промпта
      if (['sport', 'health'].includes(newTask.cat) && !newTask.notes) {
        console.warn('[Nova] ADD_TASK_JSON: notes пустой для', newTask.cat, 'задачи -', newTask.title, '- промпт не сработал, проверь COMMAND_SYNTAX_HINT');
      }

    } catch (err) {
      console.warn('[Nova] ADD_TASK_JSON parse error:', err.message, '| raw:', jsonRaw.slice(0, 200));
    }
    return ''; // всегда вырезаем из текста
  });

  // ── Шаг 2: парсим остальные простые команды ──
  let cleanText = workingText.replace(COMMAND_RE, (match, cmd, valueRaw) => {
    const value = (valueRaw || '').trim();
    switch (cmd) {
      case 'SET_WATCH': {
        const v = parseBatteryValue(value);
        if (v !== null) { updatedNova.gadgets.watchBattery = v; novaChanged = true; }
        break;
      }
      case 'SET_AIRPODS': {
        const v = parseBatteryValue(value);
        if (v !== null) { updatedNova.gadgets.airpodsBattery = v; novaChanged = true; }
        break;
      }
      case 'SET_POWERBANK': {
        const v = parseBatteryValue(value);
        if (v !== null) { updatedNova.gadgets.powerbankBattery = v; novaChanged = true; }
        break;
      }
      case 'LOG_SPORT': {
        const dayKey = /сегодня/i.test(value) ? todayKeyChisinau() : value;
        if (!updatedNova.sportLog.includes(dayKey)) { updatedNova.sportLog.push(dayKey); updatedNova.sportLog.sort(); novaChanged = true; }
        break;
      }
      case 'SET_MOOD': {
        updatedNova.mood = value; novaChanged = true;
        break;
      }
      case 'SAVE_NOTE': {
        updatedNova.notes.push({ text: value, ts: Date.now() }); novaChanged = true;
        break;
      }
      case 'ADD_REMINDER': {
        updatedNova.reminders.push({ text: value, ts: Date.now() }); novaChanged = true;
        break;
      }
      case 'DELETE_TASK': {
        const targetId = value.trim();
        const before = updatedLifeData.goals.length;
        updatedLifeData.goals = updatedLifeData.goals.filter(g => String(g.id) !== targetId);
        if (updatedLifeData.goals.length !== before) lifeChanged = true;
        break;
      }
      case 'DONE_TASK': {
        const targetId = value.trim();
        const task = updatedLifeData.goals.find(g => String(g.id) === targetId);
        if (task && !task.done) {
          task.done = true;
          lifeChanged = true;
          updatedLifeData.gems = (updatedLifeData.gems || 0) + 1;
          if (!Array.isArray(updatedLifeData.history)) updatedLifeData.history = [];
          updatedLifeData.history.unshift({
            id: 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            goalId: task.id,
            title: task.title,
            cat: task.cat || 'life',
            completedAt: Date.now(),
            elapsed_ms: 0,
            gems: 1,
            bossBonus: 0,
            comboBonus: 0,
            tags: [...(task.tags || [])]
          });
          if (updatedLifeData.history.length > 500) updatedLifeData.history.length = 500;
          if (!updatedLifeData.streak || typeof updatedLifeData.streak !== 'object') {
            updatedLifeData.streak = { days: 1, lastDate: todayKeyChisinau(), doneToday: true, best: 1 };
          } else {
            const today = todayKeyChisinau();
            if (updatedLifeData.streak.lastDate !== today) {
              const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
              updatedLifeData.streak.days = (updatedLifeData.streak.lastDate === yest) ? (updatedLifeData.streak.days + 1) : 1;
              updatedLifeData.streak.lastDate = today;
            }
            updatedLifeData.streak.doneToday = true;
            if (updatedLifeData.streak.days > (updatedLifeData.streak.best || 0)) {
              updatedLifeData.streak.best = updatedLifeData.streak.days;
            }
          }
          console.log('[Nova] DONE_TASK:', targetId, task.title, 'gems +1, history & streak updated');
        }
        break;
      }
      case 'EDIT_TASK': {
        // формат: "id | Новое название"
        const [editId, ...nameParts] = value.split('|').map(s => s.trim());
        const newTitle = nameParts.join('|').trim().slice(0, 500);
        if (editId && newTitle) {
          const task = updatedLifeData.goals.find(g => String(g.id) === editId);
          if (task) { task.title = newTitle; lifeChanged = true; }
        }
        break;
      }
      case 'RESCHEDULE_TASK': {
        // формат: "id | YYYY-MM-DD HH:MM"
        const sepIdx = value.indexOf('|');
        if (sepIdx !== -1) {
          const reschedId = value.slice(0, sepIdx).trim();
          const dtRaw = value.slice(sepIdx + 1).trim(); // "YYYY-MM-DD HH:MM"
          const dtMatch = dtRaw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/);
          if (reschedId && dtMatch) {
            const task = updatedLifeData.goals.find(g => String(g.id) === reschedId);
            if (task) {
              const [, dateStr, timeStr] = dtMatch;
              const [y, mo, d] = dateStr.split('-').map(Number);
              const dayBase = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
              task.scheduledAt = chisinauTimeToEpoch(timeStr, dayBase);
              lifeChanged = true;
              console.log('[Nova] RESCHEDULE_TASK:', reschedId, '->', new Date(task.scheduledAt).toISOString());
            }
          }
        }
        break;
      }
      case 'FIND_TASK': {
        const keyword = value.trim().toLowerCase();
        if (keyword) {
          const matches = updatedLifeData.goals
            .filter(g => (g.title || '').toLowerCase().includes(keyword))
            .slice(0, 10)
            .map(g => ({
              id: g.id,
              title: g.title,
              date: g.scheduledAt ? new Date(g.scheduledAt).toISOString() : null,
            }));
          updatedNova.lastSearchResults = { query: keyword, matches, ts: Date.now() };
          novaChanged = true;
          console.log('[Nova] FIND_TASK:', keyword, '→', matches.length, 'найдено');
        }
        break;
      }
      case 'SET_BOSS': {
        // Главный Босс Дня: сохранить название задачи
        updatedLifeData.activeBoss = value.slice(0, 500);
        lifeChanged = true;
        console.log('[Nova] SET_BOSS:', updatedLifeData.activeBoss);
        break;
      }
      case 'BOSS_DONE': {
        // Главный Босс Дня: обнулить
        updatedLifeData.activeBoss = null;
        let bonusAwarded = false;
        if (updatedLifeData.dailyBoss && typeof updatedLifeData.dailyBoss === 'object' && updatedLifeData.dailyBoss.id) {
          const bossTask = updatedLifeData.goals.find(g => g.id === updatedLifeData.dailyBoss.id);
          if (bossTask && !bossTask.done) {
            bossTask.done = true;
            updatedLifeData.gems = (updatedLifeData.gems || 0) + 4; // 1 base + 3 bonus
            bonusAwarded = true;
          }
        }
        if (!bonusAwarded) {
          updatedLifeData.gems = (updatedLifeData.gems || 0) + 3;
        }
        lifeChanged = true;
        console.log('[Nova] BOSS_DONE — boss cleared, gems awarded');
        break;
      }
      case 'PENALTY_TASK': {
        // Дофаминовый налог: создать штрафную задачу в goals
        const penaltyTask = {
          id: 'nova_penalty_' + Date.now(),
          title: value.slice(0, 500),
          notes: 'Штрафная задача за прокрастинацию / игры.',
          priority: 'high',
          cat: 'business',
          date: todayKeyChisinau(),
          scheduledAt: null,
          duration_min: 25,
          travelTime: 0,
          location: '',
          cost: 0,
          reminders: [],
          done: false,
          createdAt: Date.now(),
          tags: ['penalty'],
        };
        updatedLifeData.goals.push(penaltyTask);
        lifeChanged = true;
        console.log('[Nova] PENALTY_TASK created:', penaltyTask.id, penaltyTask.title);
        break;
      }
      case 'BURNOUT_WARNING': {
        // Радар Выгорания: увеличить счетчик
        updatedNova.burnoutScore = (typeof updatedNova.burnoutScore === 'number' ? updatedNova.burnoutScore : 0) + 1;
        novaChanged = true;
        console.log('[Nova] BURNOUT_WARNING, score now:', updatedNova.burnoutScore);
        // Если достигли 3 — автоматически включаем Recovery Day (DND на 24 ч) и сбрасываем счетчик
        if (updatedNova.burnoutScore >= 3) {
          updatedNova.dndUntil = Date.now() + 24 * 3600000;
          updatedNova.burnoutScore = 0;
          console.log('[Nova] BURNOUT threshold=3 reached! Recovery Day activated, DND until', new Date(updatedNova.dndUntil).toISOString());
        }
        break;
      }
      case 'RESET_BURNOUT': {
        // Радар Выгорания: сбросить счетчик
        updatedNova.burnoutScore = 0;
        novaChanged = true;
        console.log('[Nova] RESET_BURNOUT — burnoutScore сброшен в 0');
        break;
      }
      case 'JOURNAL_DONE': {
        // Вечерний ритуал подтверждён — записываем в sleepFlow
        if (!updatedNova.sleepFlow) updatedNova.sleepFlow = {};
        updatedNova.sleepFlow.journalConfirmed = true;
        novaChanged = true;
        console.log('[Nova] JOURNAL_DONE — вечерний ритуал подтверждён');
        break;
      }
      case 'BEDTIME_CONFIRMED': {
        // Лёша попрощался до 21:45 — фиксируем ранний отбой
        if (!updatedNova.sleepFlow) updatedNova.sleepFlow = {};
        updatedNova.sleepFlow.bedtimeEarly = true;
        novaChanged = true;
        console.log('[Nova] BEDTIME_CONFIRMED — ранний отбой зафиксирован');
        break;
      }
      case 'LOG_SLEEP_HOURS': {
        const hours = parseFloat(String(value).replace(',', '.'));
        if (!Number.isNaN(hours) && hours >= 0 && hours <= 16) {
          updatedNova.sleepLog = [...(updatedNova.sleepLog || []), { date: todayKeyChisinau(), hours }].slice(-30);
          novaChanged = true;
          console.log('[Nova] LOG_SLEEP_HOURS:', hours);
        }
        break;
      }
      case 'DEDUCT_CRYSTALS': {
        const n = parseInt(String(value).replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(n) && n > 0) {
          updatedLifeData.gems = Math.max(0, (updatedLifeData.gems || 0) - n);
          lifeChanged = true;
          console.log('[Nova] DEDUCT_CRYSTALS:', n, '→ gems now:', updatedLifeData.gems);
        }
        break;
      }
      case 'SET_SCHEDULE': {
        // формат значения: "HH:MM | HH:MM" -> отбой | подъём
        const parts = value.split('|').map(s => s.trim());
        if (parts.length === 2 && /^\d{1,2}:\d{2}$/.test(parts[0]) && /^\d{1,2}:\d{2}$/.test(parts[1])) {
          updatedNova.targetSleepTime = parts[0];
          updatedNova.targetWakeTime  = parts[1];
          updatedNova.scheduleSetDate = todayKeyChisinau();
          updatedNova.morningConfirmed = false;
          updatedNova.nightConfirmed   = false;
          updatedNova.morningFlow = { cycleDate: updatedNova.scheduleSetDate };
          updatedNova.sleepFlow   = { cycleDate: updatedNova.scheduleSetDate };
          novaChanged = true;
          console.log('[Nova] SET_SCHEDULE: отбой', parts[0], '| подъём', parts[1]);
        } else {
          console.warn('[Nova] SET_SCHEDULE: невалидный формат от LLM:', value);
        }
        break;
      }
      case 'MORNING_CONFIRMED': {
        updatedNova.morningConfirmed = true;
        if (!updatedNova.morningFlow) updatedNova.morningFlow = {};
        updatedNova.morningFlow.confirmedAt = Date.now();
        novaChanged = true;
        console.log('[Nova] MORNING_CONFIRMED');
        break;
      }
      case 'NIGHT_CONFIRMED': {
        updatedNova.nightConfirmed = true;
        novaChanged = true;
        console.log('[Nova] NIGHT_CONFIRMED');
        break;
      }
      case 'SKIP_SCHOOL_TODAY': {
        updatedLifeData.skipSchoolToday = todayKeyChisinau();
        lifeChanged = true;
        console.log('[Nova] SKIP_SCHOOL_TODAY set for', updatedLifeData.skipSchoolToday);
        break;
      }
      default:
        // неизвестная команда — просто вырезаем из текста
        break;
    }
    return ''; // команда всегда вырезается из текста, видимого пользователю
  });

  // Защита от обрезанного ADD_TASK_JSON и ASK_MISSING (например, из-за лимита токенов модели):
  cleanText = cleanText.replace(/\[ADD_TASK_JSON:.*$/gs, '');
  cleanText = cleanText.replace(/\[ASK_MISSING:.*$/gs, '');

  return {
    cleanText: cleanText.replace(/\n{3,}/g, '\n\n').trim(),
    updatedNova,
    novaChanged,
    updatedLifeData,
    lifeChanged,
    missing,
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelayMs(min, max) {
  return min + Math.random() * (max - min);
}

/* ─────────────────────────────────────────────────────────────
   МУЛЬТИ-СООБЩЕНИЯ (ЗАДАЧА 1 «очеловечивание»)
   Nova может вставить в ответ разделитель [SPLIT], чтобы разбить мысль
   на несколько сообщений подряд, как это делает живой человек.
   Отправляем части по очереди: пауза 1.5-2 сек + "печатает..." перед
   каждой следующей частью (кроме первой — она уходит сразу).
───────────────────────────────────────────────────────────── */
function splitIntoMessages(text) {
  return text
    .split(SPLIT_DELIMITER)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

async function sendMultiPartMessage(chatId, fullText) {
  const parts = splitIntoMessages(fullText);

  if (!parts.length) {
    await sendTelegramMessage(chatId, 'Ответ не сформирован. Повтори запрос.');
    return;
  }

  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      await sendTypingAction(chatId);
      await delay(randomDelayMs(MULTI_MSG_DELAY_MIN_MS, MULTI_MSG_DELAY_MAX_MS));
    }
    await sendTelegramMessage(chatId, parts[i]);
  }
}

/* ─────────────────────────────────────────────────────────────
   ФОНОВАЯ ОБРАБОТКА СООБЩЕНИЯ (fire-and-forget via waitUntil)
   Вся тяжёлая работа: KV → Gemini → processCommands → KV → TG
   выполняется здесь, вне 10-секундного окна Vercel-хендлера.
───────────────────────────────────────────────────────────── */
async function processMessageInBackground(chatId, userText) {
  try {
    // Загружаем обе базы параллельно
    const [lifeDataRaw, novaDataRaw] = await Promise.all([
      kv.get(LIFE_KV_KEY),
      kv.get(NOVA_KV_KEY),
    ]);

    const nova     = normalizeNovaState(novaDataRaw);
    const lifeData = ensureLifeData(lifeDataRaw);

    const contextText = buildContext(lifeData, nova);

    // Короткая история для связности диалога
    const historyForPrompt = nova.history.slice(-NOVA_HISTORY_LIMIT);

    // Зовём Gemini (держим typing живым во время ожидания)
    let rawReply;
    let typingTimer = null;
    try {
      sendTypingAction(chatId);
      typingTimer = setInterval(() => sendTypingAction(chatId), TYPING_INTERVAL_MS);
      rawReply = await askGemini(userText, contextText, historyForPrompt);
    } finally {
      if (typingTimer) clearInterval(typingTimer);
    }

    // Парсим скрытые команды (мутируем nova и lifeData)
    const commandResult = processCommands(rawReply, nova, lifeData);
    const { cleanText, updatedNova, updatedLifeData, missing } = commandResult;
    let novaChanged = commandResult.novaChanged;
    let lifeChanged = commandResult.lifeChanged;

    // Снятие pendingAlert при любом входящем сообщении
    if (nova.pendingAlert) {
      updatedNova.pendingAlert = null;
      novaChanged = true;
    }

    // Обработка missing_fields (ASK_MISSING)
    if (missing && Array.isArray(missing.missing_fields) && missing.missing_fields.length) {
      const templates = {
        time: 'Укажи время начала.',
        date: 'Укажи дату.',
        color: 'Укажи категорию: business, sport, school или life.',
      };
      const prompts = missing.missing_fields.map(f => templates[f] || `Укажи ${f}.`).join(' ');
      const templateReply = `Для события «${missing.title}»: ${prompts}`;

      updatedNova.pendingDraft = {
        title: missing.title,
        missing_fields: missing.missing_fields,
        ts: Date.now(),
      };
      updatedNova.history = [
        ...historyForPrompt,
        { role: 'user', text: userText, ts: Date.now() },
        { role: 'model', text: templateReply, ts: Date.now() },
      ].slice(-NOVA_HISTORY_LIMIT);
      updatedNova.lastMessageTime = Date.now();

      await kv.set(NOVA_KV_KEY, updatedNova);
      if (lifeChanged) {
        updatedLifeData.updatedAt = Date.now();
        await kv.set(LIFE_KV_KEY, updatedLifeData);
      }
      await sendTelegramMessage(chatId, templateReply);
      return;
    }

    // Regex-предохранители на случай, если LLM забыла выдать команду
    if (/(спокойной ночи|я сплю|отбой|иду спать|заткнись я сплю)/i.test(userText)) {
      updatedNova.nightConfirmed = true;
      novaChanged = true;
    }
    if (/(доброе утро|проснулся|встал|подъем)/i.test(userText)) {
      updatedNova.morningConfirmed = true;
      if (!updatedNova.morningFlow) updatedNova.morningFlow = {};
      if (!updatedNova.morningFlow.confirmedAt) updatedNova.morningFlow.confirmedAt = Date.now();
      novaChanged = true;
    }
    if (/(в школу не иду|не иду в школу|сегодня без школы|прогуливаю|заболел.*школ)/i.test(userText)) {
      updatedLifeData.skipSchoolToday = todayKeyChisinau();
      lifeChanged = true;
    }

    // Recovery Day: если burnoutScore достиг 3 — уведомляем отдельным сообщением
    if ((nova.burnoutScore || 0) >= 2 && updatedNova.burnoutScore === 0 && updatedNova.dndUntil > Date.now()) {
      const recoveryUntilStr = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Chisinau', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long',
      }).format(new Date(updatedNova.dndUntil));
      await sendTelegramMessage(chatId, 'Стоп. Радар выгорания на максимуме - включён режим тишины до ' + recoveryUntilStr + '. Отдыхай, задачи приостановлены.');
    }


    // Обновляем историю и метку времени (lastMessageTime — для таймера игнора)
    updatedNova.history = [
      ...historyForPrompt,
      { role: 'user', text: userText, ts: Date.now() },
      { role: 'model', text: rawReply,  ts: Date.now() },
    ].slice(-NOVA_HISTORY_LIMIT);
    updatedNova.lastMessageTime = Date.now();

    // Сохраняем Nova (всегда) и lifeData (только если изменилась)
    await kv.set(NOVA_KV_KEY, updatedNova);
    void novaChanged;
    if (lifeChanged) {
      updatedLifeData.updatedAt = Date.now();
      await kv.set(LIFE_KV_KEY, updatedLifeData);
    }

    // Отправляем ответ пользователю
    await sendMultiPartMessage(chatId, cleanText);
  } catch (err) {
    console.error('[nova background] fatal error:', err);
    try {
      await sendTelegramMessage(chatId, 'Что-то сломалось на бэкенде. Гляну логи в Vercel.');
    } catch (_) { /* молчим */ }
  }
}

/* ─────────────────────────────────────────────────────────────
   ГЛАВНЫЙ ХЕНДЛЕР
───────────────────────────────────────────────────────────── */
async function handler(req, res) {
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

    /* ── ЗАДАЧА 1: дедупликация update_id ──
       Telegram может продублировать доставку одного и того же апдейта,
       если наш ответ задержался. Проверяем update_id ДО любой другой
       логики и мгновенно выходим, если это уже обработанный дубль. */
    const updateId = update?.update_id;
    if (updateId !== undefined && updateId !== null) {
      const isDuplicate = await checkAndMarkProcessed(updateId);
      if (isDuplicate) {
        console.log('[nova webhook] дубль update_id, игнорируем:', updateId);
        return res.status(200).json({ ok: true, duplicate: true });
      }
    } else {
      console.warn('[nova webhook] update без update_id — дедупликация пропущена');
    }

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

    // ПЕРЕХВАТ СИСТЕМНЫХ ФРАЗ: если сообщение выглядит как автоматическая системная фраза
    // (на английском, короткая, без контекста) — прокидываем в Gemini для живого перевода.
    // Используем waitUntil, чтобы не ждать ответа Gemini внутри хендлера.
    if (isSystemPush(userText) && !isNightModeNow()) {
      waitUntil((async () => {
        const [lifeDataRawSys, novaDataRawSys] = await Promise.all([
          kv.get(LIFE_KV_KEY),
          kv.get(NOVA_KV_KEY),
        ]);
        const novaSys     = normalizeNovaState(novaDataRawSys);
        const lifeDataSys = ensureLifeData(lifeDataRawSys);
        await handleSystemPush(chatId, userText, novaSys, lifeDataSys);
      })());
      return res.status(200).json({ ok: true, systemPush: true, queued: true });
    }

    // /reset — сброс памяти Nova (не трогает Life OS базу)
    if (userText === '/reset') {
      await kv.set(NOVA_KV_KEY, getDefaultNovaState());
      await sendTelegramMessage(chatId, 'Память Nova очищена.');
      return res.status(200).json({ ok: true });
    }

    /* ── DND: жёсткий режим тишины [DND: N] ── */
    const dndMatch = userText.match(/^\[DND:\s*(\d+(?:\.\d+)?)\]$/i);
    if (dndMatch) {
      const hours = parseFloat(dndMatch[1]);
      if (hours > 0 && hours <= 72) {
        const dndUntil = Date.now() + hours * 3600000;
        const novaForDnd = normalizeNovaState(await kv.get(NOVA_KV_KEY));
        novaForDnd.dndUntil = dndUntil;
        await kv.set(NOVA_KV_KEY, novaForDnd);
        const untilStr = new Intl.DateTimeFormat('ru-RU', {
          timeZone: 'Europe/Chisinau', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long',
        }).format(new Date(dndUntil));
        await sendTelegramMessage(chatId, `Режим тишины активен до ${untilStr}.`);
      } else {
        await sendTelegramMessage(chatId, 'DND: укажи от 1 до 72 часов. Например [DND: 8].');
      }
      return res.status(200).json({ ok: true, dnd: true });
    }

    /* ── ЗАДАЧА 3: ночной режим (02:00–05:00 Кишинёв) ──
       Системные/cron-запросы могут пробить ночной режим через секретный
       заголовок x-nova-cron-secret. */
    const isCronRequest = Boolean(NOVA_CRON_SECRET) && req.headers['x-nova-cron-secret'] === NOVA_CRON_SECRET;
    if (isNightModeNow() && !isCronRequest) {
      console.log('[nova webhook] ночной режим — Gemini не вызывается');
      await sendTelegramMessage(chatId, NIGHT_MODE_REPLY);
      // lastMessageTime всё равно обновляем, чтобы таймер игнора не считал
      // ночное молчание Боссом-игнорантом
      const novaRaw = await kv.get(NOVA_KV_KEY);
      const nova = normalizeNovaState(novaRaw);
      nova.lastMessageTime = Date.now();
      await kv.set(NOVA_KV_KEY, nova);
      return res.status(200).json({ ok: true, nightMode: true });
    }

    // Тяжёлая логика (KV + Gemini + sendMessage) выносится в фон через waitUntil,
    // чтобы немедленно вернуть 200 Telegram'у и не словить 10-секундный таймаут Vercel.
    waitUntil(processMessageInBackground(chatId, userText));
    return res.status(200).json({ ok: true, queued: true });
  } catch (err) {
    // Ошибки самого хендлера (до waitUntil) — логируем и возвращаем 200,
    // чтобы Telegram не начал спамить retry-доставками.
    console.error('[nova webhook] handler error:', err);
    return res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
}

module.exports = handler;
module.exports.config = { maxDuration };
module.exports.IGNORE_THRESHOLD_MS = IGNORE_THRESHOLD_MS;