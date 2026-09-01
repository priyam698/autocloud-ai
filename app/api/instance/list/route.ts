import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    '';
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: deployments, error } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Instance List Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, deployments: deployments || [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error('[Instance List Fatal]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}