import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- PROVIDER 1: Cerebras AI ---
async function callCerebras(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Cerebras ${res.status} Error]:`, err);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Cerebras Exception]:', err);
    return null;
  }
}

// --- PROVIDER 2: Groq AI ---
async function callGroq(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Groq ${res.status} Error]:`, err);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Groq Exception]:', err);
    return null;
  }
}

// --- PROVIDER 3: Gemini AI ---
async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Gemini ${res.status} Error]:`, err);
      return null;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error('[Gemini Exception]:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // 1. Command /start
    if (userText === '/start') {
      if (tokenFromQuery) {
        await fetch(`https://api.telegram.org/bot${tokenFromQuery}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Hello! I'm Felix, your AI Telegram assistant. Ask me anything!",
          }),
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // 2. Resolve Active Bot Token
    let targetBotToken = tokenFromQuery;

    if (targetBotToken) {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token, status')
        .eq('bot_token', targetBotToken)
        .maybeSingle();

      if (!deployment || deployment.status !== 'running') {
        return NextResponse.json({ message: 'Deployment inactive' }, { status: 200 });
      }
    } else {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token')
        .eq('status', 'running')
        .not('bot_token', 'is', null)
        .limit(1)
        .maybeSingle();

      if (!deployment?.bot_token) {
        return NextResponse.json({ message: 'No active deployment' }, { status: 200 });
      }
      targetBotToken = deployment.bot_token;
    }

    // 3. MULTI-PROVIDER EXECUTION
    let replyText: string | null = null;

    if (process.env.CEREBRAS_API_KEY) {
      replyText = await callCerebras(userText, process.env.CEREBRAS_API_KEY);
    }

    if (!replyText && process.env.GROQ_API_KEY) {
      replyText = await callGroq(userText, process.env.GROQ_API_KEY);
    }

    const geminiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY;
    if (!replyText && geminiKey) {
      replyText = await callGemini(userText, geminiKey);
    }

    if (!replyText) {
      replyText = "I'm having a brief sync moment. Please ask me again in just a second!";
    }

    // 4. Send Response
    await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Fatal Webhook Error]:', err);
    return NextResponse.json({ ok: true });
  }
}