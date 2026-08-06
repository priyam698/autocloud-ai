import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getEnvVar(name: string): string {
  const target = name.toUpperCase();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toUpperCase() === target && value) {
      return value.replace(/['"]/g, '').trim();
    }
  }
  return '';
}

async function callGroq(prompt: string, apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are Felix, an AI assistant on Telegram.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token')?.trim();

    // 1. STRICT CHECK: If no bot token is supplied in the webhook URL query, ignore immediately
    if (!tokenFromQuery) {
      return NextResponse.json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const userText = message.text.trim();
    const targetBotToken = tokenFromQuery;

    // 2. DATABASE CHECK: Look up bot configuration in Supabase
    const { data: botConfig } = await supabase
      .from('user_bots')
      .select('is_enabled, subscription_status, expires_at')
      .eq('telegram_bot_token', targetBotToken)
      .maybeSingle();

    // 3. STRICT CHECK: If the bot is not in DB or is disabled/turned off, stay silent
    if (!botConfig || !botConfig.is_enabled) {
      return NextResponse.json({ ok: true });
    }

    // 4. SUBSCRIPTION CHECK: If subscription is expired or inactive
    const isExpired = botConfig.expires_at && new Date(botConfig.expires_at) < new Date();
    if (botConfig.subscription_status !== 'active' || isExpired) {
      await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "⚠️ This bot service has ended or expired. Please renew your subscription on our website to resume service.",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // Handle /start Command
    if (userText === '/start') {
      await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Hello! I am your active AI Telegram assistant. How can I help you today?",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // Process Message with Groq AI
    const groqKey = getEnvVar('GROQ_API_KEY');
    let replyText = await callGroq(userText, groqKey);

    if (!replyText) {
      replyText = "I'm currently busy. Please try again in a moment!";
    }

    // Send Response Back to Telegram
    await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}