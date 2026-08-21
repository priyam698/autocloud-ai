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
    const body = await req.json().catch(() => ({}));
    const { instanceId, id } = body;
    const targetId = instanceId || id;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'Instance ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('deployments')
      .delete()
      .eq('id', targetId);

    if (error) {
      console.error('[Delete Instance Error]:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Instance ${targetId} deleted successfully`,
    });
  } catch (err: any) {
    console.error('[Instance Delete Server Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id') || searchParams.get('instanceId');

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'Instance ID query param is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('deployments')
      .delete()
      .eq('id', targetId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Instance deleted successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}