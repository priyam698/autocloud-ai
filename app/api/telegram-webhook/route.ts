import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    // Ignore empty updates or non-text messages silently
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // Determine target Telegram token
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

    // Call Cerebras API
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    let replyText = '';

    if (!cerebrasApiKey) {
      replyText = 'Configuration Error: CEREBRAS_API_KEY environment variable is missing on Vercel.';
    } else {
      try {
        const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasApiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3.1-8b',
            messages: [
              { role: 'system', content: 'You are Felix, a helpful AI assistant on Telegram.' },
              { role: 'user', content: userText }
            ],
            temperature: 0.7,
          }),
        });

        const cerebrasData = await cerebrasRes.json();

        if (cerebrasRes.ok && cerebrasData.choices?.[0]?.message?.content) {
          replyText = cerebrasData.choices[0].message.content;
        } else {
          // Send exact API error to Telegram so we see what failed
          replyText = `Cerebras Error [${cerebrasRes.status}]: ${JSON.stringify(cerebrasData)}`;
        }
      } catch (err: any) {
        replyText = `Fetch Error: ${err.message}`;
      }
    }

    // Send response back to Telegram
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