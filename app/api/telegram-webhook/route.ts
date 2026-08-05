import { NextResponse } from 'next/server';

async function callCerebras(prompt: string, apiKey: string): Promise<string | null> {
  const cleanKey = apiKey.trim();
  // Candidate models supported by Cerebras API
  const models = ['llama-3.3-70b', 'llama3.3-70b', 'llama3.1-8b'];

  for (const model of models) {
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
            {
              role: 'system',
              content: 'You are Felix, a helpful AI assistant on Telegram.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = await res.json();

      if (res.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      } else {
        console.error(`[Cerebras ${model} Error]:`, data);
      }
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

    // Handle /start command
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

    // Execute Cerebras Inference
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    let replyText: string | null = null;

    if (!cerebrasApiKey) {
      replyText = 'Configuration Error: CEREBRAS_API_KEY environment variable is missing on Vercel.';
    } else {
      replyText = await callCerebras(userText, cerebrasApiKey);
    }

    if (!replyText) {
      replyText = "I'm having a brief connection sync. Please ask me again in just a second!";
    }

    // Send Message Back to Telegram
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