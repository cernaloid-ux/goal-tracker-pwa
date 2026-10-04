/**
 * api/sync.js — Vercel KV 2-way Cloud Sync  v3.0
 * GET  /api/sync?userId=XXX  → returns stored state (userId не влияет на ключ)
 * POST /api/sync             → Last-Write-Wins: полная перезапись если клиент новее
 *
 * ВАЖНО: базовый ключ KV всегда 'цель:master_admin_id'.
 * Это связывает фронтенд Life OS и Telegram-бота Nova — они читают/пишут одну и ту же базу,
 * независимо от того, какой userId шлёт фронтенд (гостевой uid, master_admin_id и т.п.).
 *
 * Env vars: KV_REST_API_URL, KV_REST_API_TOKEN
 */
const { createClient } = require('@vercel/kv');

const MAX_GOALS     = 400;
const MAX_HISTORY   = 200;
const TTL_SECONDS   = 60 * 60 * 24 * 90; // 90 days
const MASTER_KV_KEY = 'цель:master_admin_id'; // единственный ключ, который вообще существует

function getKV() {
  return createClient({
    url:   process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

function sanitizeState(body, clientUserId) {
  const safeArr=(v,lim)=>Array.isArray(v)?v.slice(0,lim):[];
  const safeNum=(v,def=0)=>{const n=parseInt(v,10);return isNaN(n)?def:n;};
  const safeObj=(v,def={})=>(v&&typeof v==='object'&&!Array.isArray(v))?v:def;
  // База пишется всегда под MASTER_KV_KEY, но фронтенд получает свой clientUserId
  // чтобы принять ответ (иначе гостевые userId типа guest_123 молча отвергают данные).
  const returnUserId = clientUserId || 'master_admin_id';
  return {
    userId:    returnUserId,
    gems:      safeNum(body.gems,0),
    streak:    safeObj(body.streak,{days:0,lastDate:'',doneToday:false}),
    goals: safeArr(body.goals,MAX_GOALS).map(g=>({
      id:           String(g.id||'').slice(0,32),
      title:        String(g.title||'').slice(0,500),
      notes:        String(g.notes||'').slice(0,2000),
      cat:          String(g.cat||'business').slice(0,20),
      priority:     String(g.priority||'mid').slice(0,10),
      color:        String(g.color||'').slice(0,10),
      isEvent:      !!g.isEvent,
      isProject:    !!g.isProject,
      parentId:     g.parentId ? String(g.parentId).slice(0,64) : null,
      gemsReward:   safeNum(g.gemsReward, 0),
      recurrence:   (g.recurrence && Array.isArray(g.recurrence.days))
        ? { days: g.recurrence.days.slice(0,7).map(Number), until: g.recurrence.until ? parseInt(g.recurrence.until) : null }
        : null,
      tags:         Array.isArray(g.tags)?g.tags.slice(0,10).map(String):[],
      scheduledAt:  g.scheduledAt?parseInt(g.scheduledAt):null,
      duration_min: safeNum(g.duration_min,25),
      travelTime:   safeNum(g.travelTime,0),
      location:     String(g.location||'').slice(0,200),
      participants: Array.isArray(g.participants)?g.participants.slice(0,10).map(String):[],
      reminders:    Array.isArray(g.reminders)?g.reminders.slice(0,5).map(Number):[],
      cost:         safeNum(g.cost,0),
      subtasks:     Array.isArray(g.subtasks)?g.subtasks.slice(0,20).map(st=>({id:String(st.id||''),text:String(st.text||'').slice(0,200),done:!!st.done})):[],
      done:         !!g.done,
      elapsed_ms:   safeNum(g.elapsed_ms,0),
      createdAt:    safeNum(g.createdAt,Date.now()),
    })),
    history: safeArr(body.history,MAX_HISTORY).map(h=>({
      id:          String(h.id||'').slice(0,32),
      goalId:      String(h.goalId||'').slice(0,32),
      title:       String(h.title||'').slice(0,500),
      completedAt: safeNum(h.completedAt,Date.now()),
      elapsed_ms:  safeNum(h.elapsed_ms,0),
      gems:        safeNum(h.gems,1),
      color:       String(h.color||'#0A84FF').slice(0,10),
      cat:         String(h.cat||'business').slice(0,20),
    })),
    tgToken:   String(body.tgToken||'').slice(0,64),
    tgChatId:  String(body.tgChatId||'').slice(0,20),
    // LWW: сохраняем клиентскую метку updatedAt — именно её сравниваем с серверной.
    // Если клиент её не прислал (старый клиент) — ставим серверное время как fallback.
    updatedAt: (body.updatedAt && Number(body.updatedAt) > 0) ? Number(body.updatedAt) : Date.now(),
  };
}

async function handler(req,res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, x-nova-key');
  if(req.method==='OPTIONS') return res.status(200).end();

  const kv=getKV();

  if(req.method==='GET'){
    const clientUserId = req.query.userId || null;
    if (String(clientUserId) === 'master_admin_id') {
      const syncKey = process.env.NOVA_SYNC_KEY;
      if (!syncKey || req.headers['x-nova-key'] !== syncKey) {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    const kvKey = (clientUserId && clientUserId !== 'master_admin_id') ? ('цель:' + clientUserId) : MASTER_KV_KEY;
    try {
      const data=await kv.get(kvKey);
      if(!data) return res.status(404).json({error:'No state found'});
      const payload = clientUserId ? { ...data, userId: clientUserId } : data;
      return res.status(200).json(payload);
    }
    catch(e){console.error('[KV GET]',e); return res.status(500).json({error:'KV read error',detail:e.message});}
  }

  if(req.method==='POST'){
    let body; try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch(e){return res.status(400).json({error:'Invalid JSON'});}
    if(!body||typeof body!=='object') return res.status(400).json({error:'Invalid body'});
    const clientUserId = body.userId || null;
    if (String(clientUserId) === 'master_admin_id') {
      const syncKey = process.env.NOVA_SYNC_KEY;
      if (!syncKey || req.headers['x-nova-key'] !== syncKey) {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    const kvKey = (clientUserId && clientUserId !== 'master_admin_id') ? ('цель:' + clientUserId) : MASTER_KV_KEY;
    try {
      const existing=await kv.get(kvKey);

      // ── Last-Write-Wins ───────────────────────────────────────────────
      // Если сервер новее клиента — отклоняем запись и возвращаем серверные данные.
      // Клиент обязан их принять и перезаписать свой локальный стейт.
      const clientTs  = parseInt(body.updatedAt) || 0;
      const serverTs  = (existing && typeof existing === 'object') ? (parseInt(existing.updatedAt) || 0) : 0;

      if (existing && typeof existing === 'object' && clientTs < serverTs) {
        const payload = clientUserId ? { ...existing, userId: clientUserId } : existing;
        console.log(`[KV POST] forceUpdate: server=${serverTs} > client=${clientTs}`);
        return res.status(200).json({ ok: false, forceUpdate: true, data: payload });
      }

      // Клиент новее или равен — полностью перезаписываем базу.
      const sanitized = sanitizeState(body, clientUserId);
      await kv.set(kvKey, sanitized, {ex: TTL_SECONDS});
      return res.status(200).json({ok:true, userId:sanitized.userId, updatedAt:sanitized.updatedAt, gems:sanitized.gems, goalsCount:sanitized.goals.length});
    } catch(e){console.error('[KV POST]',e); return res.status(500).json({error:'KV write error',detail:e.message});}
  }

  return res.status(405).json({error:'Method not allowed'});
}

module.exports = handler;