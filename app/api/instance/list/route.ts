import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    // Query the 'deployments' table for all active agent instances
    const { data, error } = await supabase
      .from('deployments')
      .select('*');

    // Handle database query errors
    if (error) {
      console.error('Supabase Query Error:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch instances from database', details: error.message },
        { status: 500 }
      );
    }

    // Return the deployments array as JSON
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('Server Execution Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err?.message || err },
      { status: 500 }
    );
  }
}