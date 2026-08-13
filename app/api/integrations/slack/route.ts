import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { slackToken, teamId } = await req.json();

    if (!slackToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const targetTeam = teamId || 'default_team';

    // Upsert with explicit onConflict matching to handle existing teams cleanly
    const { error } = await supabase
      .from('integrations')
      .upsert(
        { team_id: targetTeam, slack_token: slackToken },
        { onConflict: 'team_id' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Slack connected successfully!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}