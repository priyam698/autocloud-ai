import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// GET: Retrieve all knowledge base documents for a workspace
export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database unconfigured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId parameter is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

// POST: Add a new document or FAQ
export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database unconfigured' }, { status: 500 });
  }

  try {
    const { teamId, title, content } = await req.json();

    if (!teamId || !title || !content) {
      return NextResponse.json(
        { error: 'teamId, title, and content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert([{ team_id: teamId, title, content }])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, document: data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove a document by ID
export async function DELETE(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database unconfigured' }, { status: 500 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}