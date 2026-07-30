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

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Call Gemini API
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
                  text: `You are the official 24/7 AI Support Engineer for AutoCloud AI (a $12/mo platform hosting n8n, Telegram bots, and LangChain agents). Answer this user query clearly and concisely in 2-3 sentences: "${userQuery}"`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    let replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      console.error('Gemini API Error Response:', JSON.stringify(data));
      replyText = "AutoCloud AI Support: Our $12/mo platform provides 1-click cloud hosting for n8n workflows, Telegram bots, and LangChain agents with 24/7 continuous uptime.";
    }

    // Send answer back to Telegram
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