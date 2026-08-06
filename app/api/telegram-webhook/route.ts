import { NextResponse } from 'next/server';

async function callCerebras(prompt: string, apiKey: string): Promise<string | null> {
  const cleanKey = apiKey.trim();
  
  // List of active model IDs on Cerebras Cloud
  const modelCandidates = [
    'llama-3.3-70b',
    'llama3.1-8b',
    'llama3.1-70b',
    'llama-3.1-8b'
  ];

  for (const model of modelCandidates) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
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

      if (!res.ok) {
        console.error(`[Cerebras ${model} Error ${res.status}]`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (err) {
      console.error(`[Cerebras ${model} Exception]:`, err);
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
    const targetBotToken = tokenFromQuery || process.env.TELEGRAM_BOT_TOKEN;

    if (!targetBotToken) {
      return NextResponse.json({ error: 'No Telegram bot token found' }, { status: 200 });
    }

    // Handle /start
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

    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    let replyText: string | null = null;

    if (cerebrasApiKey) {
      replyText = await callCerebras(userText, cerebrasApiKey);
    }

    if (!replyText) {
      replyText = "Cerebras API key is missing or model access failed. Please check CEREBRAS_API_KEY in Vercel settings.";
    }

    // Send Response
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