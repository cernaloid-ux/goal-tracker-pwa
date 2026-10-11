/**
 * api/web-chat.js — In-App Web Chat Serverless Handler for Nova OS
 * STRICTLY CommonJS (module.exports)
 */
const { NOVA_ROLE_PROMPT, normalizeCat } = require('./_nova-core');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

function todayKeyChisinau(base = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(base).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const OUTPUT_FORMAT_PROMPT = `
<output_format>
Отвечай ТОЛЬКО валидным JSON-объектом следующей структуры:
{
  "reply": "строка с ответом (1-2 коротких предложения, строго по стилю Nova)",
  "actions": [
    {
      "type": "add_task",
      "task": {
        "kind": "event",
        "title": "название события/задачи",
        "cat": "business",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "timeTo": null,
        "duration_min": 60,
        "priority": "mid",
        "notes": "",
        "location": ""
      }
    },
    { "type": "done_task", "id": "id задачи из списка контекста" },
    { "type": "delete_task", "id": "id задачи из списка контекста" },
    { "type": "reschedule_task", "id": "id задачи из списка контекста", "date": "YYYY-MM-DD", "time": "HH:MM" },
    { "type": "edit_task", "id": "id задачи из списка контекста", "title": "новое название" }
  ],
  "missing_fields": [],
  "draft": null
}

ПРАВИЛА MISSING_FIELDS:
Если пользователь хочет создать событие, но не хватает данных:
- "time": если не названо время начала (для событий с конкретным временем).
- "date": если не названа дата и её нельзя однозначно определить.
- "color": если категорию невозможно определить из контекста.
Если данных не хватает:
- actions: [] (пустой массив)
- missing_fields: массив строк из ["time", "date", "color"]
- draft: объект task со всеми уже известными полями (title обязателен, cat/date/time/duration_min если известны)
- reply: "" (пустая строка, НЕ задавай уточняющих вопросов текстом)

ПРАВИЛА ACTIONS:
- Категория cat в add_task: business, sport, school или life.
- Для существующих задач (done_task, delete_task, reschedule_task, edit_task) используй ТОЛЬКО id задач, которые есть в списке задач контекста!
- Если пользователь просто общается или задаёт общий вопрос, actions: [], missing_fields: [], draft: null.
</output_format>`;

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nova-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const syncKey = process.env.NOVA_SYNC_KEY;
  if (!syncKey || req.headers['x-nova-key'] !== syncKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }

  const { message, history = [], goals = [], nowIso } = body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message must be non-empty string' });
  }

  const todayStr = todayKeyChisinau();
  const validGoalIds = new Set((Array.isArray(goals) ? goals : []).map(g => String(g.id)));

  // Формируем контекст задач
  let goalsContext = 'Список актуальных задач пользователя:\n';
  if (Array.isArray(goals) && goals.length) {
    goals.slice(0, 60).forEach(g => {
      const typeStr = g.isEvent ? 'событие' : (g.allDay ? 'на весь день' : 'задача');
      const timeStr = g.time ? ` ${g.time}` : '';
      const durStr = g.duration_min ? ` (${g.duration_min} мин)` : '';
      goalsContext += `- [ID: ${g.id}] «${g.title}» | ${g.cat || 'life'} | ${g.date || 'без даты'}${timeStr}${durStr} [${typeStr}]\n`;
    });
  } else {
    goalsContext += 'Задач нет.\n';
  }

  const systemInstruction = `${NOVA_ROLE_PROMPT}

<current_context>
Сегодняшняя дата (Кишинёв): ${todayStr}
Текущее время (ISO): ${nowIso || new Date().toISOString()}

${goalsContext}
</current_context>

${OUTPUT_FORMAT_PROMPT}`;

  const contents = [];
  if (Array.isArray(history)) {
    history.slice(-8).forEach(h => {
      if (h && typeof h.text === 'string' && h.text.trim()) {
        contents.push({
          role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text }]
        });
      }
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let geminiRaw = '';
  try {
    const resAi = await fetch(GEMINI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resAi.ok) {
      const errText = await resAi.text();
      console.error('[web-chat] Gemini API error:', resAi.status, errText);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const aiJson = await resAi.json();
    geminiRaw = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err) {
    console.error('[web-chat] Network error during Gemini call:', err);
    return res.status(502).json({ error: 'Network error calling AI service' });
  }

  let parsed = null;
  try {
    const cleaned = geminiRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('[web-chat] JSON parse error:', err, 'Raw:', geminiRaw);
    return res.status(200).json({
      ok: true,
      reply: 'Не удалось разобрать ответ.',
      actions: [],
      missing_fields: [],
      draft: null,
    });
  }

  // Серверная валидация полей
  const reply = String(parsed.reply || '').trim();
  const rawMissing = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [];
  const allowedMissing = new Set(['time', 'date', 'color']);
  const missing_fields = rawMissing.map(String).filter(f => allowedMissing.has(f));

  let draft = null;
  if (parsed.draft && typeof parsed.draft === 'object') {
    const d = parsed.draft;
    const cat = normalizeCat(d.cat, d.title);
    draft = {
      title: String(d.title || '').trim().slice(0, 200),
      kind: d.kind === 'task' ? 'task' : 'event',
      cat,
      date: (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) ? d.date : null,
      time: (typeof d.time === 'string' && /^\d{1,2}:\d{2}$/.test(d.time)) ? d.time.padStart(5, '0') : null,
      timeTo: (typeof d.timeTo === 'string' && /^\d{1,2}:\d{2}$/.test(d.timeTo)) ? d.timeTo.padStart(5, '0') : null,
      duration_min: Math.min(1440, Math.max(10, parseInt(d.duration_min, 10) || 60)),
      priority: ['high', 'mid', 'low'].includes(d.priority) ? d.priority : 'mid',
      notes: String(d.notes || '').slice(0, 500),
      location: String(d.location || '').slice(0, 200),
    };
  }

  const actions = [];
  if (Array.isArray(parsed.actions)) {
    parsed.actions.forEach(act => {
      if (!act || typeof act !== 'object') return;
      const type = String(act.type);

      if (type === 'add_task' && act.task && typeof act.task === 'object') {
        const t = act.task;
        const title = String(t.title || '').trim().slice(0, 200);
        if (!title) return;
        const cat = normalizeCat(t.cat, title);
        const duration_min = Math.min(1440, Math.max(10, parseInt(t.duration_min, 10) || 60));
        const date = (typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) ? t.date : todayStr;
        const time = (typeof t.time === 'string' && /^\d{1,2}:\d{2}$/.test(t.time)) ? t.time.padStart(5, '0') : null;
        const timeTo = (typeof t.timeTo === 'string' && /^\d{1,2}:\d{2}$/.test(t.timeTo)) ? t.timeTo.padStart(5, '0') : null;
        const priority = ['high', 'mid', 'low'].includes(t.priority) ? t.priority : 'mid';

        actions.push({
          type: 'add_task',
          task: {
            kind: t.kind === 'task' ? 'task' : 'event',
            title,
            cat,
            date,
            time,
            timeTo,
            duration_min,
            priority,
            notes: String(t.notes || '').slice(0, 500),
            location: String(t.location || '').slice(0, 200),
          }
        });
      } else if (type === 'done_task' && act.id && validGoalIds.has(String(act.id))) {
        actions.push({ type: 'done_task', id: String(act.id) });
      } else if (type === 'delete_task' && act.id && validGoalIds.has(String(act.id))) {
        actions.push({ type: 'delete_task', id: String(act.id) });
      } else if (type === 'reschedule_task' && act.id && validGoalIds.has(String(act.id))) {
        const date = (typeof act.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(act.date)) ? act.date : null;
        const time = (typeof act.time === 'string' && /^\d{1,2}:\d{2}$/.test(act.time)) ? act.time.padStart(5, '0') : null;
        if (date || time) {
          actions.push({ type: 'reschedule_task', id: String(act.id), date, time });
        }
      } else if (type === 'edit_task' && act.id && validGoalIds.has(String(act.id))) {
        const title = String(act.title || '').trim().slice(0, 200);
        if (title) {
          actions.push({ type: 'edit_task', id: String(act.id), title });
        }
      }
    });
  }

  return res.status(200).json({
    ok: true,
    reply,
    actions,
    missing_fields,
    draft,
  });
}

module.exports = handler;
module.exports.config = { maxDuration: 30 };
