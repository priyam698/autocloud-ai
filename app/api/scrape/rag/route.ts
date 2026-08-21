import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    const { url, content, instanceId } = body;

    if (!url && !content) {
      return NextResponse.json(
        { success: false, error: 'URL or content is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('knowledge_sources')
      .insert([
        {
          url: url || null,
          content: content || null,
          instance_id: instanceId || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('[Scrape RAG Insert Error]:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Scrape RAG Server Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}