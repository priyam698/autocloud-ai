import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      instanceId,
      id,
      knowledge_base,
      knowledge,
      knowledgeBase,
      telegram_bot_token,
      bot_token,
      telegramToken,
      bot_name,
      botName,
    } = body;

    const targetId = instanceId || id;
    const knowledgeText = knowledge_base ?? knowledge ?? knowledgeBase ?? '';
    const token = (telegram_bot_token || bot_token || telegramToken || '').trim();
    const name = bot_name || botName || 'AI Assistant';

    if (!token) {
      return NextResponse.json({ success: false, error: 'Telegram Bot Token is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Upsert customer's bot instance into Supabase
    const payload = {
      telegram_token: token,
      knowledge_base: knowledgeText,
      bot_name: name,
      status: 'active',
      updated_at: new Date().toISOString()
    };

    let saveError = null;
    if (targetId) {
      const { error } = await supabase.from('instances').update(payload).eq('id', targetId);
      saveError = error;
    } else {
      const { error } = await supabase.from('instances').upsert(payload, { onConflict: 'telegram_token' });
      saveError = error;
    }

    if (saveError) {
      console.error('[Supabase Save Error]:', saveError);
      return NextResponse.json({ success: false, error: saveError.message }, { status: 500 });
    }

    // 2. Automatically register this customer's webhook with Telegram
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
    const dynamicWebhookUrl = `${baseUrl}/api/telegram-webhook?token=${encodeURIComponent(token)}`;

    const telegramRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: dynamicWebhookUrl })
    });

    const telegramData = await telegramRes.json();

    if (!telegramData.ok) {
      console.error('[Telegram Webhook Error]:', telegramData);
      return NextResponse.json({
        success: false,
        error: `Invalid Telegram Token: ${telegramData.description || 'Failed to connect bot.'}`
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bot activated! Webhook registered successfully with zero customer setup.'
    });
  } catch (error: any) {
    console.error('[Configure Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}