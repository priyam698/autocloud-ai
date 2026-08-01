import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if the update contains a message
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const userText = body.message.text;

      // Reply back if user sent /start
      if (userText === '/start') {
        const botToken = process.env.TELEGRAM_BOT_TOKEN; // Or fetch dynamically from Supabase
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '⚡ AutoCloud AI Runner Connected!\n\nYour 24/7 AI Agent instance is active and running on AutoCloud AI infrastructure.',
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}