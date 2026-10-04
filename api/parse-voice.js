/**
 * api/parse-voice.js — Serverless Gemini voice parser for Nova OS
 * STRICTLY CommonJS (module.exports)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Ты - парсер голосовых заметок для планировщика. Верни ТОЛЬКО JSON по схеме. Раздели речь на отдельные элементы (разделители: потом, затем, ещё, а также, перечисление). Даты вычисляй от nowIso и weekday: завтра, послезавтра, в пятницу (ближайшая будущая), через 2 дня. Точное время -> time (HH:MM). 'с 10 до 12' -> time+timeTo. 'на час/полтора часа/30 минут' -> duration_min. Если названо время или промежуток -> kind=event, иначе kind=task и time=null. НИКОГДА не выдумывай время. Размытое время суток: утром=09:00, днём=13:00, вечером=19:00. срочно/важно -> priority high; когда-нибудь/по возможности -> low; иначе mid. cat: health = спорт, бег, зал, тренировка, врач; business = код, Memernity, звонок, питч, клиенты; study = школа, уроки, ДЗ, тест, контрольная, экзамен; иначе life. reminders: массив ЧИСЕЛ-минут до начала ('напомни за час' -> [60]; тест/контрольная -> [1440]; иначе []). 'каждый вторник и четверг' -> recurrence {days:[2,4],until:null} (1=Пн..7=Вс), только для event. projectId выбирай ТОЛЬКО из переданного списка projects по смыслу, иначе null. tags только из переданных names. title короткий, без даты и времени.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          kind: { type: 'STRING', enum: ['task', 'event'] },
          date: { type: 'STRING' },
          time: { type: 'STRING' },
          timeTo: { type: 'STRING' },
          duration_min: { type: 'INTEGER' },
          priority: { type: 'STRING', enum: ['high', 'mid', 'low'] },
          cat: { type: 'STRING', enum: ['business', 'health', 'study', 'life'] },
          tags: { type: 'ARRAY', items: { type: 'STRING' } },
          projectId: { type: 'STRING' },
          location: { type: 'STRING' },
          notes: { type: 'STRING' },
          reminders: { type: 'ARRAY', items: { type: 'INTEGER' } },
          recurrence: {
            type: 'OBJECT',
            properties: {
              days: { type: 'ARRAY', items: { type: 'INTEGER' } },
              until: { type: 'STRING' }
            }
          },
          confidence: { type: 'NUMBER' }
        },
        required: ['title', 'kind', 'priority', 'cat']
      }
    }
  },
  required: ['items']
};

function sanitizeItems(rawItems, availableProjects = [], availableTags = [], defaultDate = null) {
  if (!Array.isArray(rawItems)) return [];
  const validProjectIds = new Set((availableProjects || []).map(p => p.id));
  const validTagNames = new Set((availableTags || []).map(t => String(t).toLowerCase()));
  const validCats = new Set(['business', 'health', 'study', 'life']);

  return rawItems.slice(0, 10).map(it => {
    if (!it || typeof it !== 'object') return null;
    const title = String(it.title || 'Untitled').trim().slice(0, 200);
    const kind = it.kind === 'event' ? 'event' : 'task';
    const cat = validCats.has(it.cat) ? it.cat : 'life';
    const priority = ['high', 'mid', 'low'].includes(it.priority) ? it.priority : 'mid';

    let date = (typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date)) ? it.date : (defaultDate || null);
    let time = (typeof it.time === 'string' && /^\d{1,2}:\d{2}$/.test(it.time)) ? it.time.padStart(5, '0') : null;
    let timeTo = (typeof it.timeTo === 'string' && /^\d{1,2}:\d{2}$/.test(it.timeTo)) ? it.timeTo.padStart(5, '0') : null;

    let duration_min = parseInt(it.duration_min, 10);
    if (isNaN(duration_min) || duration_min < 0) duration_min = 25;
    if (duration_min > 1440) duration_min = 1440;

    let reminders = [];
    if (Array.isArray(it.reminders)) {
      reminders = it.reminders.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 10080);
    }

    let tags = [];
    if (Array.isArray(it.tags)) {
      tags = it.tags.map(String).filter(t => validTagNames.has(t.toLowerCase())).slice(0, 5);
    }

    let projectId = (it.projectId && validProjectIds.has(it.projectId)) ? it.projectId : null;
    let location = typeof it.location === 'string' ? it.location.trim().slice(0, 200) : '';
    let notes = typeof it.notes === 'string' ? it.notes.trim().slice(0, 1000) : '';

    let recurrence = null;
    if (kind === 'event' && it.recurrence && Array.isArray(it.recurrence.days) && it.recurrence.days.length) {
      const days = it.recurrence.days.map(Number).filter(d => d >= 1 && d <= 7);
      if (days.length) {
        recurrence = {
          days,
          until: (typeof it.recurrence.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.recurrence.until)) ? it.recurrence.until : null
        };
      }
    }

    let confidence = typeof it.confidence === 'number' ? Math.max(0, Math.min(1, it.confidence)) : 0.8;

    return {
      title,
      kind,
      cat,
      priority,
      date,
      time,
      timeTo,
      duration_min,
      reminders,
      tags,
      projectId,
      location,
      notes,
      recurrence,
      confidence
    };
  }).filter(Boolean);
}

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

  const { text, nowIso, weekday, lang, tags = [], projects = [], defaultDate = null } = body;
  if (!text || typeof text !== 'string' || !text.trim() || text.length > 2000) {
    return res.status(400).json({ error: 'text must be non-empty string <= 2000 chars' });
  }

  const promptPayload = {
    text: text.trim(),
    nowIso: nowIso || new Date().toISOString(),
    weekday: weekday || 1,
    lang: lang || 'ru-RU',
    tags: Array.isArray(tags) ? tags.map(String) : [],
    projects: Array.isArray(projects) ? projects.map(p => ({ id: p.id, title: p.title })) : [],
    defaultDate: (typeof defaultDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate)) ? defaultDate : null
  };

  const geminiBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(promptPayload) }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  };

  try {
    const apiRes = await fetch(GEMINI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => '');
      console.error('[parse-voice] Gemini error:', apiRes.status, errText);
      return res.status(502).json({ error: `Gemini API error: ${apiRes.status}` });
    }

    const data = await apiRes.json();
    const rawReply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
    let parsed;
    try {
      parsed = JSON.parse(rawReply.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      console.error('[parse-voice] Failed to parse Gemini response JSON:', rawReply, parseErr);
      return res.status(502).json({ error: 'Malformed JSON from Gemini' });
    }

    const items = sanitizeItems(parsed.items, promptPayload.projects, promptPayload.tags, promptPayload.defaultDate);
    return res.status(200).json({ ok: true, items });
  } catch (err) {
    console.error('[parse-voice] Fetch error:', err);
    return res.status(500).json({ error: 'Server error parsing voice', detail: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 30 };
