import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept instanceId, id, or instance_id from payload
    const instanceId = body.instanceId || body.id || body.instance_id;

    if (!instanceId) {
      return NextResponse.json(
        { error: 'Instance ID is required' },
        { status: 400 }
      );
    }

    // Delete directly from deployments table
    const { error: deleteError } = await supabase
      .from('deployments')
      .delete()
      .eq('id', instanceId);

    if (deleteError) {
      console.error('[Delete Error]:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Instance deleted successfully!',
    });
  } catch (err: any) {
    console.error('[Delete Exception]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete instance' },
      { status: 500 }
    );
  }
}