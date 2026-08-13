import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { slackToken, teamId } = await req.json();

    if (!slackToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Save token to Supabase under customer's record
    const { error } = await supabase
      .from('integrations')
      .upsert({ team_id: teamId || 'default_team', slack_token: slackToken });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Slack connected successfully!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}