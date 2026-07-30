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

    // Call Gemini 2.5 Flash API directly via REST
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are the official 24/7 AI Technical Support Engineer for AutoCloud AI ($12/mo platform hosting n8n, Telegram bots, and LangChain runners). Answer this customer query directly, accurately, and uniquely in 2-3 friendly sentences: "${userQuery}"`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    const aiAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    const replyText = aiAnswer
      ? aiAnswer
      : `AutoCloud AI: To connect your n8n workflow, go to your dashboard, grab your webhook URL, and paste it inside your n8n HTTP trigger node. Contact priyamrana069@gmail.com for help!`;

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
    console.error('Telegram Bot Route Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}