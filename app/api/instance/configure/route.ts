import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { instanceId, id, knowledge, knowledge_base, bot_token, telegram_bot_token, bot_name } = body;

    const targetId = instanceId || id;
    const knowledgeText = knowledge_base || knowledge || '';
    const token = telegram_bot_token || bot_token;

    if (!targetId) {
      return NextResponse.json({ success: false, error: 'Instance ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Prepare updated fields
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (knowledgeText !== undefined) updatePayload.knowledge_base = knowledgeText;
    if (token) updatePayload.telegram_bot_token = token;
    if (bot_name) updatePayload.bot_name = bot_name;

    // 2. Update existing deployment or insert if new
    const { data, error } = await supabase
      .from('deployments')
      .upsert({ id: targetId, ...updatePayload })
      .select()
      .single();

    if (error) {
      console.error('[Database Update Error]:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 3. Automatically register/bind the Telegram webhook if token exists
    if (token && process.env.NEXT_PUBLIC_APP_URL) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram-webhook?instanceId=${targetId}`;
      try {
        await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      } catch (webhookErr) {
        console.warn('[Webhook Auto-Bind Warning]:', webhookErr);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Configure Route Exception]:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}