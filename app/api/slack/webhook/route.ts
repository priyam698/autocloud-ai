import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Slack Instant Verification Handshake
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Handle Incoming Slack Messages
    if (body.event && body.event.type === 'app_mention') {
      const channel = body.event.channel;
      const userText = body.event.text;
      const teamId = body.team_id;

      // Lookup customer's token dynamically from Supabase
      const { data: config } = await supabase
        ? await supabase.from('integrations').select('slack_token').eq('team_id', teamId).single()
        : { data: null };

      // Fallback to Vercel env variable if testing on your own dev workspace
      const botToken = config?.slack_token || process.env.SLACK_BOT_TOKEN;

      if (!botToken) {
        return NextResponse.json({ error: 'No token found for this workspace' }, { status: 400 });
      }

      // Generate AI Answer via Groq
      let aiResponse = "Hello! How can I assist you today?";
      const groqApiKey = process.env.GROQ_API_KEY;

      if (groqApiKey) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: 'You are a helpful Slack AI support assistant.' },
                { role: 'user', content: userText },
              ],
            }),
          });
          const groqData = await groqRes.json();
          aiResponse = groqData.choices?.[0]?.message?.content || aiResponse;
        } catch (e) {
          console.error('Groq error:', e);
        }
      }

      // Post back to Slack using customer's token
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel, text: aiResponse }),
      });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Slack Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}