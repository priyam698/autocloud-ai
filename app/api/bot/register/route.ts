import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      instanceId,
      botToken,
      discord_token,
      discord_public_key,
      slack_token,
      whatsapp_phone_id,
      whatsapp_token,
      messenger_token,
      custom_context,
      bot_type,
      website_url,
      api_key,
    } = body;

    if (!instanceId) {
      return NextResponse.json({ success: false, error: 'Missing instanceId' }, { status: 400 });
    }

    const trimmedToken = botToken?.trim() || null;
    const knowledgeText = custom_context?.trim() || '';
    const websiteUrlClean = website_url?.trim() || '';

    // 1. Save customer instance data into Supabase
    const updatePayload: Record<string, any> = {
      bot_token: trimmedToken,
      discord_token: discord_token || null,
      discord_public_key: discord_public_key || null,
      slack_token: slack_token || null,
      whatsapp_phone_id: whatsapp_phone_id || null,
      whatsapp_token: whatsapp_token || null,
      messenger_token: messenger_token || null,
      custom_context: knowledgeText,
      bot_type: bot_type || 'general',
      website_url: websiteUrlClean,
      api_key: api_key || '',
    };

    const { error: dbError } = await supabase
      .from('deployments')
      .update(updatePayload)
      .eq('id', instanceId);

    if (dbError) {
      console.error('[Supabase Error]:', dbError);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    // 2. Dynamically bind Telegram webhook to this customer's instance
    if (trimmedToken) {
      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
      const webhookUrl = `${appBaseUrl}/api/telegram-webhook?instanceId=${encodeURIComponent(
        instanceId
      )}&token=${encodeURIComponent(trimmedToken)}`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${trimmedToken}/setWebhook?url=${encodeURIComponent(
          webhookUrl
        )}&drop_pending_updates=true`
      );

      const tgData = await tgRes.json();
      if (!tgData.ok) {
        console.error('[Telegram Webhook Error]:', tgData);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Registration Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}