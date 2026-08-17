/**
 * api/sync.js — Vercel KV 2-way Cloud Sync  v2.1
 * GET  /api/sync?userId=XXX  → returns stored state (userId больше не влияет на ключ)
 * POST /api/sync             → saves merged state
 *
 * ВАЖНО: с v2.1 базовый ключ KV жёстко зафиксирован на 'цель:master_admin_id'.
 * Это связывает фронтенд Life OS и Telegram-бота Nova — они читают/пишут одну и ту же базу,
 * независимо от того, какой userId шлёт фронтенд (гостевой uid, master_admin_id и т.п.).
 *
 * Env vars: KV_REST_API_URL, KV_REST_API_TOKEN
 */
import { createClient } from '@vercel/kv';

const MAX_GOALS     = 200;
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
      color:        String(g.color||'#0A84FF').slice(0,10),
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
    updatedAt: Date.now(),
  };
}

async function notifyTelegram(state) {
  const {tgToken,tgChatId}=state; if(!tgToken||!tgChatId) return;
  const overdue=(state.goals||[]).filter(g=>!g.done&&g.scheduledAt&&g.scheduledAt<Date.now());
  if(!overdue.length) return;
  const text=`⏰ *Life OS — Просрочено ${overdue.length} задач*\n\n`+overdue.slice(0,5).map(g=>`• ${g.title}`).join('\n')+(overdue.length>5?`\n...и ещё ${overdue.length-5}`:'');
  try { await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:tgChatId,text,parse_mode:'Markdown'})}); }
  catch(e){console.warn('[TG notify]',e.message);}
}

export default async function handler(req,res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();

  const kv=getKV();

  if(req.method==='GET'){
    // userId из query не влияет на выбор ключа KV — ключ всегда MASTER_KV_KEY.
    // Но мы «зеркалим» клиентский userId обратно, чтобы фронтенд принял ответ.
    const clientUserId = req.query.userId || null;
    try {
      const data=await kv.get(MASTER_KV_KEY);
      if(!data) return res.status(404).json({error:'No state found'});
      // Подставляем clientUserId, не меняя сохранённые данные
      const payload = clientUserId ? { ...data, userId: clientUserId } : data;
      return res.status(200).json(payload);
    }
    catch(e){console.error('[KV GET]',e); return res.status(500).json({error:'KV read error',detail:e.message});}
  }

  if(req.method==='POST'){
    let body; try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch(e){return res.status(400).json({error:'Invalid JSON'});}
    if(!body||typeof body!=='object') return res.status(400).json({error:'Invalid body'});
    // userId из body не влияет на ключ KV (всегда MASTER_KV_KEY), но возвращается
    // в ответе — иначе фронтенд с guest_123 молча отвергает синхронизацию.
    const clientUserId = body.userId || null;
    try {
      const sanitized=sanitizeState(body, clientUserId);
      const existing=await kv.get(MASTER_KV_KEY);
      if(existing&&typeof existing==='object'){
        if((existing.gems||0)>sanitized.gems) sanitized.gems=existing.gems;
        const histIds=new Set(sanitized.history.map(h=>h.id));
        (existing.history||[]).forEach(h=>{if(h&&h.id&&!histIds.has(h.id)) sanitized.history.push(h);});
        sanitized.history.sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
        if(sanitized.history.length>MAX_HISTORY) sanitized.history.splice(MAX_HISTORY);
        const localIds=new Set(sanitized.goals.map(g=>g.id));
        (existing.goals||[]).forEach(cg=>{if(!localIds.has(cg.id)) sanitized.goals.push(cg);});
        if(sanitized.goals.length>MAX_GOALS) sanitized.goals.splice(MAX_GOALS);
        if((existing.streak?.days||0)>(sanitized.streak?.days||0)) sanitized.streak=existing.streak;
      }
      await kv.set(MASTER_KV_KEY,sanitized,{ex:TTL_SECONDS});
      notifyTelegram(sanitized).catch(()=>{});
      // userId в ответе = clientUserId (иллюзия работы со «своей» базой для фронтенда)
      return res.status(200).json({ok:true,userId:sanitized.userId,updatedAt:sanitized.updatedAt,gems:sanitized.gems,goalsCount:sanitized.goals.length});
    } catch(e){console.error('[KV POST]',e); return res.status(500).json({error:'KV write error',detail:e.message});}
  }

  return res.status(405).json({error:'Method not allowed'});
}