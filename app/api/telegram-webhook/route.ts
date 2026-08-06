import { NextResponse } from 'next/server';

function cleanKey(key?: string): string {
  if (!key) return '';
  return key.replace(/['"]/g, '').trim();
}

// 1. PRIMARY: GROQ INFERENCE (Fastest + High Free Tier Limits)
async function callGroq(prompt: string, apiKey: string): Promise<string | null> {
  const token = cleanKey(apiKey);
  if (!token) return null;

  // Groq's production models
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are Felix, a helpful AI assistant on Telegram.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    } catch {
      continue;
    }
  }
  return null;
}

// 2. BACKUP: GEMINI INFERENCE
async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  const token = cleanKey(apiKey);
  if (!token) return null;

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();
    const targetBotToken = cleanKey(tokenFromQuery || process.env.TELEGRAM_BOT_TOKEN);

    if (!targetBotToken) {
      return NextResponse.json({ ok: true });
    }

    // Handle Telegram /start command
    if (userText === '/start') {
      await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Hello! I'm Felix, your AI Telegram assistant. Ask me anything!",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    let replyText: string | null = null;

    // 1. Groq (Primary)
    const groqKey = process.env.GROQ_API_KEY || process.env.USER_GROQ_API_KEY;
    if (groqKey) {
      replyText = await callGroq(userText, groqKey);
    }

    // 2. Gemini (Fallback)
    if (!replyText) {
      const geminiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY;
      if (geminiKey) {
        replyText = await callGemini(userText, geminiKey);
      }
    }

    if (!replyText) {
      replyText = "⚠️ Unable to connect to Groq or Gemini. Please verify your GROQ_API_KEY in Vercel.";
    }

    // Send back to Telegram
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