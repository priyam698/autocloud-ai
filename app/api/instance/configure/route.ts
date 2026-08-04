import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Support both naming formats (camelCase & snake_case)
    const instanceId = body.instance_id || body.instanceId;
    const botToken = body.api_key || body.botToken || body.bot_token;

    if (!instanceId || !botToken) {
      console.error('[Configure Error] Missing fields:', { instanceId, botToken });
      return NextResponse.json(
        { error: 'Missing instance_id or api_key' },
        { status: 400 }
      );
    }

    console.log(`[Configure API] Updating instance ${instanceId} with bot token...`);

    // 1. Update bot_token column in Supabase
    const { data, error: dbError } = await supabase
      .from('deployments')
      .update({ bot_token: botToken })
      .eq('id', instanceId)
      .select();

    if (dbError) {
      console.error('[Configure DB Error]:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // 2. Register Webhook directly with Telegram API
    const webhookUrl = `https://autocloud-ai-p448.vercel.app/api/bot/telegram/webhook`;
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(
        webhookUrl
      )}`
    );
    const tgData = await tgRes.json();

    console.log('[Telegram setWebhook Response]:', tgData);

    return NextResponse.json({
      success: true,
      message: 'Bot token linked successfully!',
      data,
      telegram: tgData,
    });
  } catch (err: any) {
    console.error('[Configure Exception]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}