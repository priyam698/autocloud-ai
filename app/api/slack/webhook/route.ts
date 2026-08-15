import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Slack URL Handshake Verification
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    const event = body.event;
    if (!event) {
      return NextResponse.json({ status: 'ok' });
    }

    // 2. Ignore bot messages to prevent infinite reply loops
    if (event.bot_id || event.subtype === 'bot_message') {
      return NextResponse.json({ status: 'ok' });
    }

    // 3. Process Channel Mentions OR Direct Messages
    const isAppMention = event.type === 'app_mention';
    const isDirectMessage = event.type === 'message' && (event.channel_type === 'im' || !event.subtype);

    if (isAppMention || isDirectMessage) {
      const channel = event.channel;
      const teamId = body.team_id;
      const rawText = event.text || '';

      // Clean the text by removing @bot mention tags
      const userPrompt = rawText.replace(/<@[^>]+>/g, '').trim() || 'Hello';

      // 4. Fetch Customer Slack Token dynamically from Supabase
      let botToken = process.env.SLACK_BOT_TOKEN;

      if (supabase) {
        // Find exact workspace token
        let { data: config } = await supabase
          .from('integrations')
          .select('slack_token')
          .eq('team_id', teamId)
          .maybeSingle();

        // Fallback to the latest saved token
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
        console.error('No Slack token found for team:', teamId);
        return NextResponse.json({ status: 'ok' });
      }

      // 5. Generate AI Response with Groq
      let aiResponse = "Hello! I am your AutoCloud AI assistant. How can I help you today?";
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
                {
                  role: 'system',
                  content: 'You are an intelligent, concise AI workplace assistant for AutoCloud AI.',
                },
                { role: 'user', content: userPrompt },
              ],
            }),
          });

          if (groqRes.ok) {
            const data = await groqRes.json();
            if (data.choices?.[0]?.message?.content) {
              aiResponse = data.choices[0].message.content;
            }
          }
        } catch (err) {
          console.error('Groq AI API error:', err);
        }
      }

      // 6. Send Response to Slack
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: channel,
          text: aiResponse,
        }),
      });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Slack Webhook Route Error:', err);
    return NextResponse.json({ status: 'ok' });
  }
}