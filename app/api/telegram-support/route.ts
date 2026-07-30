import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userQuery = message.text;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing in environment variables');
    }

    // Call Gemini 1.5 Flash API with explicit prompt structuring
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are the official 24/7 AI Support Engineer for AutoCloud AI ($12/mo platform hosting n8n, Telegram bots, and LangChain agents). Answer this user query directly, concisely, and uniquely in 2-3 sentences: "${userQuery}"`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    
    // Safely extract generated text from Gemini
    const aiAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Build unique reply
    const replyText = aiAnswer
      ? aiAnswer
      : `AutoCloud AI: We host n8n workflows, Telegram bots, and LangChain agents for $12/mo with 24/7 uptime. For detailed queries, email priyamrana069@gmail.com!`;

    // Send response back to Telegram
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_SUPPORT_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
        }),
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram Support Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}