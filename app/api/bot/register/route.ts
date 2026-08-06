import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, botToken } = await req.json();

    if (!botToken || !userId) {
      return NextResponse.json({ error: 'Missing userId or botToken' }, { status: 400 });
    }

    const cleanToken = botToken.trim();
    const appDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai.vercel.app';
    const webhookUrl = `${appDomain}/api/telegram-webhook?token=${cleanToken}`;

    // 1. Register Webhook with Telegram Automatically
    const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return NextResponse.json({ error: `Telegram Registration Failed: ${tgData.description}` }, { status: 400 });
    }

    // 2. Save/Update Bot Token & Active Status in Supabase
    const { error } = await supabase.from('user_bots').upsert(
      {
        user_id: userId,
        telegram_bot_token: cleanToken,
        is_enabled: true,
        subscription_status: 'active',
      },
      { onConflict: 'telegram_bot_token' }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Bot activated and registered!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}