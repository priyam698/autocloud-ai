import { NextResponse } from 'next/server';

export const maxDuration = 30; // Extends execution limit to prevent timeout drops

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body?.message?.chat?.id && body?.message?.text) {
      const chatId = body.message.chat.id;
      const userMessage = body.message.text;

      const telegramToken = process.env.TELEGRAM_BOT_TOKEN || '';
      const geminiApiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY || '';

      let replyText = '';

      if (userMessage === '/start') {
        replyText = '⚡ AutoCloud AI Runner Active!\n\nI am connected to Gemini AI. Ask me anything about crypto, quant trading, or general coding!';
      } else {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            }),
          }
        );

        const geminiData = await geminiRes.json();

        replyText =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
          `Gemini Error: ${geminiData?.error?.message || 'Unable to generate response.'}`;
      }

      // Send plain text message (prevents Telegram Markdown parse crashes)
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
        }),
      });
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram Gemini Webhook is active!' });
}