import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    '';
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: deployments, error } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Instance List Supabase Error]:', error);
      return NextResponse.json(
        { success: true, deployments: [], instances: [], error: error.message },
        { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deployments: deployments || [],
        instances: deployments || [],
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error('[Instance List Fatal Error]:', err);
    return NextResponse.json(
      { success: true, deployments: [], instances: [], error: err.message },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}