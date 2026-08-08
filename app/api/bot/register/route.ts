import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { instanceId, telegram_bot_token, botToken, custom_context } = body;

    // Support both parameter names (botToken or telegram_bot_token)
    const token = (telegram_bot_token || botToken || '').trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Telegram bot token is required.' },
        { status: 400 }
      );
    }

    const appDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
    
    // 1. Dynamic Webhook URL for this specific deployment
    const webhookUrl = instanceId 
      ? `${appDomain}/api/telegram-webhook/${instanceId}`
      : `${appDomain}/api/telegram-webhook`;

    // 2. Automatically register the webhook with Telegram
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`
    );
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return NextResponse.json(
        { success: false, error: tgData.description || 'Failed to connect with Telegram.' },
        { status: 400 }
      );
    }

    // 3. Update the deployment row in Supabase
    if (instanceId) {
      const { error: dbError } = await supabase
        .from('deployments')
        .update({
          bot_token: token,
          custom_context: custom_context || '',
          is_enabled: true,
        })
        .eq('id', instanceId);

      if (dbError) {
        console.error('[Register DB Error]:', dbError);
        return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bot activated and registered successfully!',
    });
  } catch (err: any) {
    console.error('[Register Server Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}