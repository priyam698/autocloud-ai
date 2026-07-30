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

    // Use Gemini 2.5 Flash endpoint
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are the official 24/7 AI Technical Support Agent for AutoCloud AI ($12/mo cloud platform for n8n, Telegram bots, and LangChain runners).

User Question: "${userQuery}"

Provide a direct, helpful, and specific answer to this question in 2-3 sentences. Do not use generic templates.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    
    // Safely parse AI generated text
    const aiAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Fallback error logging if key fails
    const replyText = aiAnswer
      ? aiAnswer
      : `AutoCloud AI: To connect your n8n workflow, go to your dashboard, copy your webhook URL, and paste it under the n8n HTTP trigger node. Contact priyamrana069@gmail.com for help!`;

    // Send back to Telegram
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
    console.error('Telegram Support Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}