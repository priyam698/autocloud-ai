import { NextResponse } from 'next/server';

// 1. CEREBRAS API (llama3.1-8b)
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
        messages: [
          { role: 'system', content: 'You are Felix, a helpful AI assistant on Telegram.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// 2. GROQ API (llama-3.3-70b-versatile)
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
        messages: [
          { role: 'system', content: 'You are Felix, a helpful AI assistant on Telegram.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// 3. GEMINI API (gemini-2.0-flash)
async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
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
    const targetBotToken = tokenFromQuery || process.env.TELEGRAM_BOT_TOKEN;

    if (!targetBotToken) {
      return NextResponse.json({ error: 'No Telegram bot token found' }, { status: 200 });
    }

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

    // Pipeline execution: Cerebras -> Groq -> Gemini
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
      replyText = "I'm having a brief connection sync. Please ask me again in just a second!";
    }

    // Send Message
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
    return NextResponse.json({ ok: true });
  }
}