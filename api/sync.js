// api/sync.js — Vercel Serverless Function
// Saves app state to Vercel KV (Redis-compatible)
// Deploy: vercel deploy  |  Set env: KV_REST_API_URL, KV_REST_API_TOKEN

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { userId, ...data } = body;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Store full state under user key (TTL: 7 days)
    await kv.set(`цель:${userId}`, JSON.stringify(data), { ex: 60 * 60 * 24 * 7 });

    // Also store Telegram credentials separately for cron access
    if (data.tgToken && data.tgChatId) {
      await kv.set(`цель:${userId}:tg`, JSON.stringify({
        token: data.tgToken,
        chatId: data.tgChatId
      }), { ex: 60 * 60 * 24 * 30 });
    }

    return res.status(200).json({ ok: true, ts: Date.now() });
  } catch (err) {
    console.error('[sync] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
