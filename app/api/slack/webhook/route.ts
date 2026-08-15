import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processCustomerMessage } from '@/lib/ai-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Slack Handshake
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    const event = body.event;
    if (!event || event.bot_id || event.subtype === 'bot_message') {
      return NextResponse.json({ status: 'ok' });
    }

    const isAppMention = event.type === 'app_mention';
    const isDirectMessage = event.type === 'message' && (event.channel_type === 'im' || !event.subtype);

    if (isAppMention || isDirectMessage) {
      const channel = event.channel;
      const teamId = body.team_id;
      const rawText = event.text || '';
      
      // Thread Session: reply in existing thread or start a new thread
      const threadTs = event.thread_ts || event.ts;
      const userPrompt = rawText.replace(/<@[^>]+>/g, '').trim() || 'Hello';

      // 2. Fetch workspace Bot Token
      let botToken = process.env.SLACK_BOT_TOKEN;
      if (supabase) {
        let { data: config } = await supabase
          .from('integrations')
          .select('slack_token')
          .eq('team_id', teamId)
          .maybeSingle();

        if (!config?.slack_token) {
          const { data: latest } = await supabase
            .from('integrations')
            .select('slack_token')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          config = latest;
        }

        if (config?.slack_token) {
          botToken = config.slack_token;
        }
      }

      if (!botToken) {
        console.error('No Slack token found for workspace:', teamId);
        return NextResponse.json({ status: 'ok' });
      }

      // 3. Process via Central AI Engine (Retrieval + Thread Memory)
      const aiReply = await processCustomerMessage({
        teamId,
        platform: 'slack',
        sessionId: threadTs,
        userPrompt,
      });

      // 4. Send Threaded Reply back to Slack
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: channel,
          thread_ts: threadTs,
          text: aiReply,
        }),
      });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Slack Webhook Error:', err);
    return NextResponse.json({ status: 'ok' });
  }
}