import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { slackToken } = await req.json();

    if (!slackToken || !slackToken.startsWith('xoxb-')) {
      return NextResponse.json(
        { error: 'Please provide a valid Bot User OAuth Token (starts with xoxb-)' },
        { status: 400 }
      );
    }

    // 1. Verify token with Slack and auto-extract workspace details
    const authTestRes = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackToken.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    const authData = await authTestRes.json();

    if (!authData.ok) {
      return NextResponse.json(
        { error: `Slack validation failed: ${authData.error}. Check token permissions.` },
        { status: 400 }
      );
    }

    const { team_id, team, user_id: bot_user_id } = authData;

    // 2. Save or update customer configuration in Supabase
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert(
        {
          team_id: team_id,
          team_name: team,
          bot_user_id: bot_user_id,
          slack_token: slackToken.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      );

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      message: `Connected successfully to workspace: ${team}!`,
    });
  } catch (err: any) {
    console.error('Slack integration error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}