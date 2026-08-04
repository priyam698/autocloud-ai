import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use SUPABASE_SERVICE_ROLE_KEY if available to bypass RLS, otherwise fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Support both instance_id and id from request body
    const instanceId = body.instance_id || body.id;

    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    // Delete record from Supabase 'deployments' table
    const { error } = await supabase
      .from('deployments')
      .delete()
      .eq('id', instanceId);

    if (error) {
      console.error('Supabase Delete Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Instance deleted successfully' });
  } catch (err: any) {
    console.error('Delete Route Exception:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
