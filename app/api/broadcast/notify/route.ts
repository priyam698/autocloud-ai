import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { botToken, chatId, saleTitle, saleDescription, discountCode, imageUrl } = await req.json();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: 'botToken and chatId are required' },
        { status: 400 }
      );
    }

    const message = `🚨 **NEW SALE ANNOUNCEMENT!** 🚨\n\n` +
      `**${saleTitle || 'Special Offer Available Now!'}**\n` +
      `${saleDescription || 'Check out our store for limited-time discounts.'}\n\n` +
      (discountCode ? `🎟️ Use Discount Code: **${discountCode}**\n\n` : '') +
      `🛒 Visit our website to shop now!`;

    // Send message directly to the Telegram group
    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Sale alert broadcasted successfully!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}