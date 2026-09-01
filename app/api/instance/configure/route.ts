import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    '';
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    const { instanceId, botName, templateId, telegramBotToken, knowledgeBase } = body;
    const supabase = getSupabase();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (botName) {
      updatePayload.name = botName.trim();
      updatePayload.bot_name = botName.trim();
    }

    if (templateId) {
      updatePayload.template_id = templateId.trim().toLowerCase();
    }

    if (typeof telegramBotToken === 'string') {
      updatePayload.telegram_bot_token = telegramBotToken.trim();
    }

    if (typeof knowledgeBase === 'string') {
      updatePayload.knowledge_base = knowledgeBase.trim();
    }

    const { data, error } = await supabase
      .from('deployments')
      .update(updatePayload)
      .eq('id', instanceId)
      .select()
      .single();

    if (error) {
      console.error('[Configuration Update Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Agent configuration updated successfully',
      instance: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}