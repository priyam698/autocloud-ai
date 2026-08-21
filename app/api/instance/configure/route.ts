import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      instanceId,
      id,
      knowledge_base,
      knowledge,
      telegram_bot_token,
      bot_token,
      bot_name,
    } = body;

    const targetId = instanceId || id;
    const knowledgeText = knowledge_base !== undefined ? knowledge_base : knowledge;
    const token = telegram_bot_token || bot_token;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'Instance ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Prepare data payload
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (knowledgeText !== undefined) updatePayload.knowledge_base = String(knowledgeText);
    if (token) updatePayload.telegram_bot_token = String(token).trim();
    if (bot_name) updatePayload.bot_name = String(bot_name).trim();

    // 2. Fetch existing record (or match by ID/prefix)
    const { data: allRecords } = await supabase.from('deployments').select('*');
    let matchedRecord = allRecords?.find(
      (r: any) =>
        r.id === targetId ||
        (typeof r.id === 'string' && r.id.toLowerCase().startsWith(targetId.toLowerCase()))
    );

    let finalId = matchedRecord ? matchedRecord.id : targetId;

    const { data: updatedData, error: dbError } = await supabase
      .from('deployments')
      .upsert({ id: finalId, ...updatePayload })
      .select()
      .single();

    if (dbError) {
      console.error('[Configure API] DB Error:', dbError);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    // 3. Automatically register the Telegram Webhook
    const activeToken = token || updatedData?.telegram_bot_token;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://autocloud-ai-p448.vercel.app');

    if (activeToken && appUrl) {
      const webhookUrl = `${appUrl}/api/telegram-webhook?instanceId=${finalId}`;
      try {
        await fetch(`https://api.telegram.org/bot${activeToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        console.log(`[Configure API] Telegram webhook bound to: ${webhookUrl}`);
      } catch (webhookErr) {
        console.warn('[Configure API] Webhook registration warning:', webhookErr);
      }
    }

    return NextResponse.json({
      success: true,
      instanceId: finalId,
      knowledgeLength: updatedData?.knowledge_base?.length || 0,
      data: updatedData,
    });
  } catch (err: any) {
    console.error('[Configure API] Fatal Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}