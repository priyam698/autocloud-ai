import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Fetch all active deployment rows directly
    const { data, error } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Instance List Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instances: data || [] }, { status: 200 });
  } catch (err: any) {
    console.error('[Instance List Exception]:', err);
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}