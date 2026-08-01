import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if telegram sent a message object
    if (body?.message?.chat?.id) {
      const chatId = body.message.chat.id;
      const token = '8933256473:AAHoCwrKmPqdvsJf2gzuFFCcO4usvF7E4vc';

      // Send response message back to Telegram user
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⚡ AutoCloud AI Runner Connected!\n\nYour 24/7 AI Agent instance is active and running on AutoCloud AI infrastructure.',
        }),
      });
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

// Allow GET requests so you can test the route in your browser
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook route is active!' });
}