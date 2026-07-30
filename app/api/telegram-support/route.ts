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

    // Call Gemini API using gemini-1.5-flash model
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are the official 24/7 AI Technical Support Agent for AutoCloud AI ($12/mo platform hosting n8n, Telegram bots, and LangChain runners). 

User Query: "${userQuery}"

Answer the user's specific question directly, accurately, and uniquely in 2-3 friendly sentences. Do NOT give a generic template answer.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    
    // Extract real Gemini response
    const aiAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Construct final message
    const replyText = aiAnswer 
      ? aiAnswer 
      : `AutoCloud Support: We encountered an issue answering "${userQuery}". Please email support@autocloud.ai or try again!`;

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
    console.error('Telegram Bot Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}