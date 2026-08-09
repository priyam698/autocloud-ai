import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { instanceId, botToken, chatId, saleTitle, saleDescription, discountCode } = await req.json();

    // 1. Fetch deployment details from Supabase if chatId or botToken aren't passed
    let activeToken = botToken;
    let targetChatId = chatId;

    if (instanceId || !targetChatId) {
      let query = supabase.from('deployments').select('*');
      if (instanceId) {
        query = query.eq('id', instanceId);
      } else {
        query = query.order('created_at', { ascending: false }).limit(1);
      }

      const { data: deployment } = await query.single();

      if (deployment) {
        activeToken = activeToken || deployment.bot_token;
        targetChatId = targetChatId || deployment.group_chat_id;
      }
    }

    if (!activeToken || !targetChatId) {
      return NextResponse.json(
        { error: 'Bot is not active in any group chat yet. Add the bot to your Telegram group first!' },
        { status: 400 }
      );
    }

    const message =
      `🚨 **NEW ANNOUNCEMENT!** 🚨\n\n` +
      `**${saleTitle || 'Special Offer Available Now!'}**\n` +
      `${saleDescription || 'Check out our store for updates.'}\n\n` +
      (discountCode ? `🎟️ Code: **${discountCode}**\n\n` : '') +
      `🛒 Visit our website to check it out!`;

    // 2. Broadcast directly to Telegram group
    const tgRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return NextResponse.json({ error: tgData.description }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Broadcast sent to group automatically!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}