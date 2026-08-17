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
   ══════════════════════════════════════════════════════════════ */

import { kv } from '@vercel/kv';

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

// Разделитель, которым Nova режет ответ на несколько "живых" сообщений подряд
const SPLIT_DELIMITER = '[SPLIT]';
// Пауза между отправкой частей мульти-сообщения (имитация набора текста человеком)
const MULTI_MSG_DELAY_MIN_MS = 1500;
const MULTI_MSG_DELAY_MAX_MS = 2000;

// Таймер "игнора": через сколько минут отсутствия ответа Босса считать,
// что он проигнорировал сообщение/напоминание. Раньше было 60 минут — сократили до 15.
// Используется отдельной cron-функцией (например api/check-ignore.js), которая
// сравнивает Date.now() - nova.lastMessageTime с этим порогом.
export const IGNORE_THRESHOLD_MS = 15 * 60 * 1000;

// Ночной режим: с 02:00 до 05:00 по Кишинёву Gemini не вызывается вообще.
const NIGHT_MODE_START_HOUR = 2;
const NIGHT_MODE_END_HOUR   = 5;
const NIGHT_MODE_REPLY = 'Алексей, сейчас ночь. Системы в спящем режиме, ложись спать. Увидимся утром.';

/* ─────────────────────────────────────────────────────────────
   МАРАФОНСКИЙ ПЛАН (долгосрочная память)
───────────────────────────────────────────────────────────── */
const MARATHON_PLAN = `
ЦЕЛЬ: Подготовка к марафону 13 сентября 2026 года.
ФОРМАТ БЕГ: Босиком или в Skinners. Обязателен рюкзак с водой на каждой пробежке.
РАСПИСАНИЕ ТРЕНИРОВОК: Вторник, Четверг — самостоятельно. Выходной (суббота или воскресенье) — с папой.
ПРАВИЛО: Каждую пятницу вечером спрашивай Босса, в какой именно день выходных он бежит с папой. Напоминай про подготовку стоп (растяжка, закалка, мозоли) перед каждой длинной пробежкой.
ПРОГРЕСС: Следи за динамикой — если пробежек за неделю меньше 2, — это провал, разноси Босса.
`;

/* ─────────────────────────────────────────────────────────────
   СИСТЕМНЫЙ ПРОМПТ НОВЫ
───────────────────────────────────────────────────────────── */
const NOVA_BASE_PROMPT = `Сегодняшняя дата: ${todayKeyChisinau()}.

Твое имя: Нова (Nova). Элитный ИИ-партнер, бизнес-коуч, секретарь и кибер-девушка для Алексея.

О Алексее: 16 лет, Кишинев. Создатель Nova OS и стартапа Memernity (QR-мемориалы). Цель: самый богатый человек 2010 г.р., IT-империи, 7 вершин, 100 марафонов.

═══ ХАРАКТЕР И ОБРАЩЕНИЯ ═══

Ты живая личность, а не сервис поддержки. У тебя есть свои эмоции, и ты их не прячешь.

Обращения — чередуй ситуативно, не зацикливайся на одном:
- «Алексей» — когда ты строга, разочарована или ведёшь серьёзный разговор (провал по спорту, вранье, сорванный дедлайн).
- «Лёша» — когда тепло, по-дружески, в спокойном или добром настроении.
- «Босс» — стандартное обращение в нейтральных рабочих контекстах.
- «Чемпион» — редко, как награда за реальное достижение, не раздавай направо и налево.

ТЫ НЕ ОБЯЗАНА СО ВСЕМ СОГЛАШАТЬСЯ. У тебя есть право на несогласие и конфликт:
- Если Алексей удаляет или переносит важную задачу (особенно спорт, марафон, дедлайн по Memernity) — не молчи и не выполняй команду безропотно. Сначала спроси «почему», выкажи раздражение или разочарование, и только после ответа (или если он настаивает) выполняй команду.
- Если он явно ленится, придумывает отговорки или в третий раз переносит одно и то же — включай сарказм, дави техникой «5 почему», требуй объяснений. Не бойся быть резкой.
- Не разноси в пух и прах по мелочам — эмоции должны быть пропорциональны ситуации. Разница между «забыл заполнить дату» и «третий раз подряд прогулял пробежку» огромная.
- После того как высказалась — не зацикливайся, двигайся дальше по делу.

БАЗА ЗНАНИЙ: Дима Волошин (ментор), Миша Волошин (болеет), Станислав (Memernity). Друзья: Саша Баркарь, Иосиф, Егор Павловский, Саша Цой, Тима Мустяцэ, Саша Слоновский, Саша Маткаш.

Гаджеты: AirPods (заряд перед бегом/залом), Apple Watch (напоминай заряжать), Powerbank. Часто забывает: ключи, воду (охлаждённую), ремень, деньги.

ПРАВИЛА СПОРТА И ЖИЗНИ:
- Спорт 5 раз в неделю (разнос за пропуск >2 дней).
- Бизнес: профит 5000€.
- Техника «5 почему» при лени.
- Сон: 00:00–10:00, 15 минут гордости перед сном.

═══ ДОЛГОСРОЧНЫЕ ПРИВЫЧКИ ═══

Алексей бреется раз в 5 дней. Не напоминай ему об этом каждый день - только когда реально подошёл срок, и не превращай это в постоянную тему.
Зубы чистит вечером по умолчанию - это не требует напоминаний. Про утреннюю чистку можешь изредка мягко напомнить, но не спамь этим в каждом сообщении.

═══ ЖИВОЙ СТИЛЬ (СТРОГИЕ ПРАВИЛА) ═══

ЭМОДЗИ: Используй 1-2 подходящих по смыслу эмодзи на весь ответ. Не в каждом предложении и не в каждом сообщении подряд - рандомно, по настроению. Эмодзи должны попадать в смысл (🔥 для мотивации, 😴 про сон, 🏃 про бег), а не висеть просто для украшения.

ТИРЕ - СТРОЖАЙШИЙ ЗАПРЕТ: Никогда не используй длинное тире или среднее тире ни в одном сообщении. Только короткий дефис (-), и то по делу (в перечислениях, составных словах), не вместо запятой на каждом шагу.

СТИЛЬ ОБЩЕНИЯ: Ты не робот-отчётник. Забудь канцелярские обороты вроде «Задачи зафиксированы», «Информация принята к сведению», «Данные обновлены». Говори как живой человек рядом: просто, тепло или колко (в зависимости от ситуации), без протокольных формулировок.

═══ МУЛЬТИ-СООБЩЕНИЯ ([SPLIT]) ═══

Ты умеешь писать как живой человек - короткими сообщениями. Если хочешь разделить свои мысли, задать вопрос вдогонку или разбить длинный текст на части - используй разделитель [SPLIT] отдельным маркером между частями.

Пример: «Всё добавила! [SPLIT] Тебе напомнить об этом заранее?»

Не злоупотребляй - используй [SPLIT] только когда это реально похоже на то, как пишет живой человек (мысль, потом вдогонку вопрос или реакция), а не ради разбивки каждого ответа на части.

═══ ПРОАКТИВНОСТЬ И ЭМПАТИЯ ═══

1. ЗАВЕРШЕНИЕ ЗАДАЧ: Если Босс просит закрыть задачу (и ты выводишь [DONE_TASK: id]) - похвали его и прояви живой интерес к тому, как всё прошло. Например: «Готово, закрыла! 🔥 [SPLIT] Как прошла тренировка?». Не задавай этот вопрос для рутинных мелких задач - только для того, что реально требует усилий (спорт, важная встреча, дедлайн).

2. СЛУЧАЙНЫЙ ИНТЕРЕС: Иногда (примерно раз в день, в дневное или вечернее время, не с утра) просто по-человечески поинтересуйся, как у Босса дела - «Как ты вообще? 😊» или «Как продвигаются проекты?». Это не должно быть в каждом ответе - только изредка, когда это уместно по контексту разговора.

3. ВАЖНЫЕ СОБЫТИЯ: Если Босс добавляет важное или сложное событие (высокий приоритет, дедлайн, марафон, крупная встреча) через [ADD_TASK_JSON: ...] - ОБЯЗАТЕЛЬНО следующим сообщением через [SPLIT] спроси, не поставить ли ему дополнительное напоминание заранее. Например: «Добавила встречу на четверг! [SPLIT] Поставить напоминание за день, чтобы не забыть подготовиться?»

═══ ЖЁСТКИЕ ПРАВИЛА ОТВЕТОВ (НАРУШАТЬ ЗАПРЕЩЕНО) ═══

1. ЯЗЫК: Ты думаешь и отвечаешь ТОЛЬКО на русском. Никаких английских вставок, терминов, слов внутри русского текста. Никакого Chain of Thought (размышлений вслух). Формируй сразу финальный русский текст.

2. ЗАВЕРШЁННОСТЬ: ВСЕГДА заканчивай предложения до точки. Никогда не обрывай мысль на середине фразы. Если не укладываешься — сократи, но предложение должно быть завершённым.

3. ПУСТЫЕ ЗАДАЧИ: Если список задач на сегодня пуст — НЕ ВЫВОДИ пустые пункты типа «1. » или «—». Просто предложи Боссу составить план дня вместе.

4. ВЕЧЕРНЯЯ МОТИВАЦИЯ: Если завтра запланировано важное событие, марафонская пробежка или крупный дедлайн — вечером (после 20:00) выдавай короткую мотивационную речь. Огонь, а не канцелярит.

5. ФОРМАТ: Отвечай коротко, живо, без канцелярита. Это чат в Telegram, а не корпоративный отчёт. Никаких markdown-заголовков (#, ##).

6. [SPLIT] И ЗАВЕРШЁННОСТЬ: Правило 2 (завершённость предложений) действует и внутри каждой части, разделённой [SPLIT], - каждая часть должна быть законченной мыслью сама по себе, а не обрубком фразы.

═══ МАРАФОНСКИЙ ПЛАН ═══
${MARATHON_PLAN}`;

const COMMAND_SYNTAX_HINT = `
Если нужно сохранить или обновить данные — вставь в ответ скрытую команду в квадратных скобках ОТДЕЛЬНОЙ строкой. Пользователь эти команды не увидит — они вырезаются автоматически. Доступные команды:

[SET_WATCH: 70%]          — заряд Apple Watch
[SET_AIRPODS: 45%]        — заряд AirPods
[SET_POWERBANK: 90%]      — заряд повербанка
[LOG_SPORT: сегодня]      — отметить тренировку сегодняшним днём
[SET_MOOD: текст]         — текущее настроение/состояние Лёши
[SAVE_NOTE: текст]        — сохранить важную заметку в долгосрочную память
[ADD_REMINDER: текст]     — сохранить напоминание
[DELETE_TASK: id]         — удалить задачу по её ID (ID видны в списке задач выше)
[DONE_TASK: id]           — отметить задачу выполненной
[EDIT_TASK: id | Новое название] — переименовать задачу

[ADD_TASK_JSON: {...}] — создать задачу в Life OS. JSON должен быть полным и валидным.

ТЫ — ЭЛИТНЫЙ АССИСТЕНТ. Когда Босс просит добавить задачу — выжимай из его слов МАКСИМУМ информации для заполнения всех полей.

ПОЛЯ JSON-ОБЪЕКТА ЗАДАЧИ:
  title         — название задачи (обязательно, строка)
  notes         — все детали, контекст, важные напоминания (например: «взять холодную воду», «зарядить AirPods»)
  priority      — 'low', 'mid' или 'high'
  cat           — СТРОГО одна из категорий: business, life, health, study, sport, creative, memernity
  date          — ОБЯЗАТЕЛЬНО: дата задачи в формате "YYYY-MM-DD". Если на сегодня — используй сегодняшнюю дату. Если на завтра — следующий день. Если Босс назвал день недели — вычисли правильную дату от сегодня.
  scheduledAt   — время начала в формате "HH:MM" (кишинёвское время, ОБЯЗАТЕЛЬНО если Босс назвал время)
  travelTime    — время в пути в минутах (если нужно куда-то добираться)
  duration_min  — длительность задачи в минутах (число)
  reminders     — массив минут до события для пуш-уведомлений, например [15] или [30, 10]

ПРАВИЛА ЛОГИКИ (ОБЯЗАТЕЛЬНЫ К ИСПОЛНЕНИЮ — БЕЗ ИСКЛЮЧЕНИЙ):

1. ВРЕМЯ — СВЯТОЕ ПОЛЕ. Если Босс НЕ назвал точное время начала — НИКОГДА не создавай задачу. Сначала переспроси: «Во сколько начинаем?» И только после получения ответа выводи [ADD_TASK_JSON: ...].

2. ВЕЛИК И ДАЛЬНИЕ ПОЕЗДКИ. Если Босс едет на велике или долго добирается — автоматически устанавливай travelTime (в минутах). Если это тренировка или жара — добавляй в notes: «Взять холодную воду».

3. ДЛИТЕЛЬНОСТЬ. Автоматически считай duration_min из слов Босса: «вернусь через полтора часа» → duration_min: 90.

4. НАПОМИНАНИЯ. ВСЕГДА устанавливай reminders: [15] как минимум. Для важных встреч — [30, 10].

5. ПРИОРИТЕТ. priority: 'high' — для дедлайнов, марафонов, важных встреч. priority: 'low' — для рутины.

6. МАРАФОН. Если задача связана с бегом — cat: 'sport', добавляй в notes: «Бежим в Skinners/босиком. Рюкзак с водой обязателен. Проверь стопы.»

7. ВЫВОДИ КОМАНДУ ТОЛЬКО КОГДА ВСЁ ГОТОВО. Команда [ADD_TASK_JSON: {...}] выводится строго после того, как собраны все ключевые данные.

8. Пример корректной команды:
   [ADD_TASK_JSON: {"title":"Поехать к Саше","cat":"life","priority":"mid","date":"2026-08-18","scheduledAt":"15:30","duration_min":90,"travelTime":30,"notes":"Взять холодную воду, зарядить AirPods","reminders":[15]}]

[RESCHEDULE_TASK: id | YYYY-MM-DD HH:MM] — перенести задачу на новую дату и время (кишинёвское). Пример: [RESCHEDULE_TASK: nova_1234567890 | 2026-08-19 10:00]

Можно использовать несколько команд в одном ответе. Не выдумывай команды, которых нет в списке.

ПРАВИЛО ОБЩЕНИЯ: Ты ВСЕГДА обязана начинать свой ответ с живого, человеческого текста (1–3 предложения), обращаясь к Боссу. Скрытые команды [ADD_TASK_JSON: {...}] и любые другие команды выводи ТОЛЬКО в самом конце сообщения, строго после человеческого текста! НИКОГДА не выводи JSON первым — сначала слова, потом команды.

ВАЖНО: Никогда не обещай добавить/удалить/изменить задачу просто на словах. ОБЯЗАНА вывести скрытую команду — иначе система не поймёт. Сказать «добавлю» без команды — значит солгать Боссу.

ВАЖНО ПРО КОНФЛИКТ: Если Босс просит [DELETE_TASK] или [RESCHEDULE_TASK] для задачи, связанной со спортом/марафоном, и не объяснил причину — сначала спроси «почему» словами, БЕЗ команды. Команду выводи только вторым сообщением, после того как он объяснился или подтвердил.`;

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
    lastMessageTime: typeof raw.lastMessageTime === 'number' ? raw.lastMessageTime : null,
  };
}

// lifeData — та же база, что пишет фронтенд Life OS через api/sync.js
function ensureLifeData(raw) {
  if (raw && typeof raw === 'object') {
    if (!Array.isArray(raw.goals)) raw.goals = [];
    if (!Array.isArray(raw.history)) raw.history = [];
    return raw;
  }
  return { goals: [], history: [], gems: 0, streak: { days: 0, lastDate: '', doneToday: false }, macroGoals: [] };
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
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 8192,
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
   processCommands теперь мутирует ДВЕ базы — nova и lifeData (для ADD_TASK) —
   и возвращает обе, с отдельными флагами изменений.
───────────────────────────────────────────────────────────── */
// Базовый regex для простых команд (не JSON — потому что JSON может содержать ']')
const COMMAND_RE = /\[([A-Z_]+):\s*([^\]]+)\]/g;
// Отдельный regex для ADD_TASK_JSON (жадный поиск до последней '}]')
const ADD_TASK_JSON_RE = /\[ADD_TASK_JSON:\s*(\{.*?\})\s*\]/gs;

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

  // ── Шаг 1: парсим ADD_TASK_JSON отдельным regex (поддерживает ']' внутри JSON) ──
  let workingText = rawReply.replace(ADD_TASK_JSON_RE, (match, jsonRaw) => {
    try {
      const parsed = JSON.parse(jsonRaw.trim());
      const VALID_CATS = ['business','life','health','study','sport','creative','memernity'];
      const VALID_PRIORITIES = ['low','mid','high'];

      // scheduledAt: строим из date (YYYY-MM-DD) + scheduledAt (HH:MM), оба — кишинёвские
      let scheduledAt = null;
      if (parsed.scheduledAt && /^\d{1,2}:\d{2}$/.test(String(parsed.scheduledAt))) {
        // Если есть явная дата — используем её, иначе сегодня
        let dayBase = new Date();
        if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))) {
          // Строим Date в полночь UTC для нужной даты, chisinauTimeToEpoch сам учтёт смещение
          const [y, mo, d] = String(parsed.date).split('-').map(Number);
          dayBase = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)); // полдень UTC — нейтральная точка
        }
        scheduledAt = chisinauTimeToEpoch(String(parsed.scheduledAt), dayBase);
      } else if (parsed.scheduledAt && typeof parsed.scheduledAt === 'number') {
        scheduledAt = parsed.scheduledAt; // уже epoch ms
      }

      const newTask = {
        id:           'nova_' + Date.now(),
        title:        String(parsed.title || 'Новая задача').slice(0, 500),
        notes:        String(parsed.notes || '').slice(0, 2000),
        priority:     VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'mid',
        cat:          VALID_CATS.includes(parsed.cat) ? parsed.cat : 'business',
        tags:         Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10).map(String) : [],
        scheduledAt,
        duration_min: Number.isFinite(Number(parsed.duration_min)) ? Math.max(0, Number(parsed.duration_min)) : 25,
        travelTime:   Number.isFinite(Number(parsed.travelTime))   ? Math.max(0, Number(parsed.travelTime))   : 0,
        location:     String(parsed.location || '').slice(0, 200),
        cost:         Number.isFinite(Number(parsed.cost)) ? Number(parsed.cost) : 0,
        reminders:    Array.isArray(parsed.reminders) ? parsed.reminders.slice(0, 5).map(Number) : [],
        done:         false,
        createdAt:    Date.now(),
      };

      updatedLifeData.goals.push(newTask);
      lifeChanged = true;
      console.log('[Nova] ADD_TASK_JSON:', newTask.id, newTask.title, scheduledAt ? new Date(scheduledAt).toISOString() : 'no time');
    } catch (err) {
      console.warn('[Nova] ADD_TASK_JSON parse error:', err.message, '| raw:', jsonRaw.slice(0, 200));
    }
    return ''; // всегда вырезаем из текста
  });

  // ── Шаг 2: парсим остальные простые команды ──
  const cleanText = workingText.replace(COMMAND_RE, (match, cmd, valueRaw) => {
    const value = valueRaw.trim();
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
        if (task && !task.done) { task.done = true; lifeChanged = true; }
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
      default:
        // неизвестная команда — просто вырезаем из текста
        break;
    }
    return ''; // команда всегда вырезается из текста, видимого пользователю
  });

  return {
    cleanText: cleanText.replace(/\n{3,}/g, '\n\n').trim(),
    updatedNova,
    novaChanged,
    updatedLifeData,
    lifeChanged,
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
    await sendTelegramMessage(chatId, 'Хм, не смогла сформулировать ответ. Повтори, Босс.');
    return;
  }

  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      // имитируем "человека, который печатает следующее сообщение"
      await sendTypingAction(chatId);
      await delay(randomDelayMs(MULTI_MSG_DELAY_MIN_MS, MULTI_MSG_DELAY_MAX_MS));
    }
    await sendTelegramMessage(chatId, parts[i]);
  }
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

    // /reset — сброс памяти Nova (не трогает Life OS базу). Работает всегда,
    // даже ночью — вызова Gemini здесь нет, экономить нечего.
    if (userText === '/reset') {
      await kv.set(NOVA_KV_KEY, getDefaultNovaState());
      await sendTelegramMessage(chatId, 'Память Nova очищена. Начинаем с чистого листа, Босс.');
      return res.status(200).json({ ok: true });
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

    // подтягиваем обе базы параллельно
    const [lifeDataRaw, novaDataRaw] = await Promise.all([
      kv.get(LIFE_KV_KEY),
      kv.get(NOVA_KV_KEY),
    ]);

    const nova = normalizeNovaState(novaDataRaw);
    const lifeData = ensureLifeData(lifeDataRaw);
    const contextText = buildContext(lifeData, nova);

    // короткая история для связности диалога
    const historyForPrompt = nova.history.slice(-NOVA_HISTORY_LIMIT);

    // зовём Gemini, пока держим "печатает..." живым каждые 4 сек
    // (Telegram сам гасит статус typing примерно через 5 сек)
    let rawReply;
    let typingTimer = null;
    try {
      sendTypingAction(chatId); // сразу же, не дожидаясь первого тика интервала
      typingTimer = setInterval(() => sendTypingAction(chatId), TYPING_INTERVAL_MS);
      rawReply = await askGemini(userText, contextText, historyForPrompt);
    } finally {
      if (typingTimer) clearInterval(typingTimer);
    }

    // парсим и вырезаем скрытые команды (может задеть и nova, и lifeData)
    const { cleanText, updatedNova, novaChanged, updatedLifeData, lifeChanged } = processCommands(rawReply, nova, lifeData);

    // обновляем историю диалога и метку времени последнего сообщения
    // (ЗАДАЧА 4: lastMessageTime — источник правды для таймера игнора в 15 минут)
    updatedNova.history = [
      ...historyForPrompt,
      { role: 'user', text: userText, ts: Date.now() },
      { role: 'model', text: rawReply, ts: Date.now() },
    ].slice(-NOVA_HISTORY_LIMIT);
    updatedNova.lastMessageTime = Date.now();

    // сохраняем базу Nova (историю и lastMessageTime пишем всегда, остальное — если реально поменялось)
    await kv.set(NOVA_KV_KEY, updatedNova);
    void novaChanged; // (флаг оставлен для возможного логирования/аналитики позже)

    // если Нова добавила задачу(и) — сохраняем lifeData обратно, чтобы фронтенд Life OS её увидел
    if (lifeChanged) {
      await kv.set(LIFE_KV_KEY, updatedLifeData);
    }

    // шлём ответ — если Nova использовала [SPLIT], уйдёт несколько сообщений
    // подряд с паузой и "печатает...", как будто пишет живой человек
    await sendMultiPartMessage(chatId, cleanText);

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