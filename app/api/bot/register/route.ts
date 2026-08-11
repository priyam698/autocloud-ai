import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      instanceId, 
      telegram_bot_token, 
      botToken, 
      custom_context,
      discord_token,
      slack_token,
      whatsapp_token,
      whatsapp_phone_id,
      messenger_token
    } = body;

    // Check for any channel token or context update
    const tgToken = (telegram_bot_token || botToken || '').trim();
    const discordToken = (discord_token || '').trim();
    const slackToken = (slack_token || '').trim();
    const waToken = (whatsapp_token || '').trim();
    const msgToken = (messenger_token || '').trim();

    // 1. If a Telegram token was provided, register its webhook
    if (tgToken) {
      const appDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
      const webhookUrl = `${appDomain}/api/telegram-webhook`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${tgToken}/setWebhook?url=${webhookUrl}`
      );
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return NextResponse.json(
          { success: false, error: tgData.description || 'Failed to connect with Telegram.' },
          { status: 400 }
        );
      }
    }

    // 2. Update deployment row in Supabase
    if (instanceId) {
      const updateData: Record<string, any> = {
        custom_context: custom_context || '',
        is_enabled: true,
      };

      if (tgToken) updateData.bot_token = tgToken;
      if (discordToken) updateData.discord_token = discordToken;
      if (slackToken) updateData.slack_token = slackToken;
      if (waToken) updateData.whatsapp_token = waToken;
      if (whatsapp_phone_id) updateData.whatsapp_phone_id = whatsapp_phone_id;
      if (msgToken) updateData.messenger_token = msgToken;

      const { error: dbError } = await supabase
        .from('deployments')
        .update(updateData)
        .eq('id', instanceId);

      if (dbError) {
        console.error('[Register DB Error]:', dbError);
        return NextResponse.json(
          { success: false, error: dbError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bot activated and updated successfully!',
    });
  } catch (err: any) {
    console.error('[Register Server Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}