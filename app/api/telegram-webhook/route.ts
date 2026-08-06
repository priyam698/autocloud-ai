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

    // 1. If no token provided in URL, ignore immediately
    if (!tokenFromQuery) return NextResponse.json({ ok: true });

    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const userText = message.text.trim();
    const targetBotToken = tokenFromQuery;

    // 2. Fetch deployment details from Supabase
    const { data: deployment } = await supabase
      .from('deployments')
      .select('bot_token, is_enabled, subscription_status, expires_at')
      .eq('bot_token', targetBotToken)
      .maybeSingle();

    // If bot token is not in database or set to NULL, stay silent
    if (!deployment || !deployment.bot_token) {
      return NextResponse.json({ ok: true });
    }

    // 3. CHECK SUBSCRIPTION & TOGGLE STATUS
    const isTurnedOff = deployment.is_enabled === false;
    const isUnpaid = deployment.subscription_status && deployment.subscription_status !== 'active';
    const isExpired = deployment.expires_at && new Date(deployment.expires_at) < new Date();

    // If disabled, unpaid, or expired -> BOT GOES COMPLETELY SILENT
    if (isTurnedOff || isUnpaid || isExpired) {
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

    // Process normal message with Groq AI
    const groqKey = getEnvVar('GROQ_API_KEY');
    let replyText = await callGroq(userText, groqKey);

    if (!replyText) {
      replyText = "I'm currently busy. Please try again in a moment!";
    }

    // Send AI Reply
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