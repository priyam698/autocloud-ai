import { NextResponse } from 'next/server';

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

    const logs: string[] = [];
    let replyText: string | null = null;

    // 1. TRY CEREBRAS
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    if (!cerebrasKey) {
      logs.push("Cerebras: Key missing in Vercel env");
    } else {
      try {
        const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b',
            messages: [
              { role: 'system', content: 'You are Felix, a helpful AI assistant.' },
              { role: 'user', content: userText }
            ],
            temperature: 0.7,
          }),
        });
        const data = await res.json();
        if (res.ok && data.choices?.[0]?.message?.content) {
          replyText = data.choices[0].message.content;
        } else {
          logs.push(`Cerebras (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
        }
      } catch (err: any) {
        logs.push(`Cerebras Exception: ${err.message}`);
      }
    }

    // 2. TRY GROQ (IF CEREBRAS FAILED)
    if (!replyText) {
      const groqKey = process.env.GROQ_API_KEY || process.env.USER_GROQ_API_KEY;
      if (!groqKey) {
        logs.push("Groq: Key missing in Vercel env");
      } else {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: 'You are Felix, a helpful AI assistant.' },
                { role: 'user', content: userText }
              ],
              temperature: 0.7,
            }),
          });
          const data = await res.json();
          if (res.ok && data.choices?.[0]?.message?.content) {
            replyText = data.choices[0].message.content;
          } else {
            logs.push(`Groq (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
          }
        } catch (err: any) {
          logs.push(`Groq Exception: ${err.message}`);
        }
      }
    }

    // 3. TRY GEMINI (IF GROQ FAILED)
    if (!replyText) {
      const geminiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        logs.push("Gemini: Key missing in Vercel env");
      } else {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: userText }] }],
              }),
            }
          );
          const data = await res.json();
          if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            replyText = data.candidates[0].content.parts[0].text;
          } else {
            logs.push(`Gemini (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
          }
        } catch (err: any) {
          logs.push(`Gemini Exception: ${err.message}`);
        }
      }
    }

    // Fallback output with diagnostic logs
    if (!replyText) {
      replyText = `⚠️ Diagnostic Logs:\n` + logs.join('\n');
    }

    // Send Message Back
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