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
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const { title, message, instanceId } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Insert broadcast notification safely
    const { data, error } = await supabase
      .from('broadcast_logs')
      .insert([
        {
          title: title || 'System Update',
          message,
          instance_id: instanceId || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('[Broadcast Insert Error]:', error);
      return NextResponse.json({ ok: true, warning: error.message });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Broadcast API Error]:', err);
    return NextResponse.json({ ok: true });
  }
}