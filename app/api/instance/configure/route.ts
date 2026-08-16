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

    const instanceId = body.instance_id || body.instanceId || body.id;
    const botToken = (body.api_key || body.botToken || body.bot_token || body.telegram_token || '').trim();
    const customContext = body.custom_context || body.knowledge || body.rules || body.context;
    const botName = body.name || body.botName;

    if (!instanceId) {
      return NextResponse.json(
        { error: 'Missing instanceId' },
        { status: 400 }
      );
    }

    // 1. Prepare updates for Supabase
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (botToken) updates.bot_token = botToken;
    if (customContext !== undefined) updates.custom_context = customContext;
    if (botName) updates.name = botName;

    const { data, error: dbError } = await supabase
      .from('deployments')
      .update(updates)
      .eq('id', instanceId)
      .select()
      .maybeSingle();

    if (dbError) {
      console.error('[Configure DB Error]:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // 2. Automatically register Webhook with Telegram if botToken exists
    let tgData = null;
    if (botToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
      const webhookUrl = `${appUrl}/api/telegram-webhook?instanceId=${instanceId}&token=${encodeURIComponent(botToken)}`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=True`
      );
      tgData = await tgRes.json();
      console.log('[Telegram setWebhook Response]:', tgData);
    }

    return NextResponse.json({
      success: true,
      message: 'Bot configured and webhook linked successfully',
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