import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      instanceId,
      botToken,
      discord_token,
      discord_public_key,
      slack_token,
      whatsapp_phone_id,
      whatsapp_token,
      messenger_token,
      custom_context,
      bot_type,
      website_url,
      api_key,
    } = body;

    if (!instanceId) {
      return NextResponse.json({ success: false, error: 'Missing instanceId' }, { status: 400 });
    }

    // 1. Update instance credentials in Supabase
    const { error: dbError } = await supabase
      .from('deployments')
      .update({
        bot_token: botToken || null,
        discord_token: discord_token || null,
        discord_public_key: discord_public_key || null,
        slack_token: slack_token || null,
        whatsapp_phone_id: whatsapp_phone_id || null,
        whatsapp_token: whatsapp_token || null,
        messenger_token: messenger_token || null,
        custom_context: custom_context || '',
        bot_type: bot_type || 'general',
        website_url: website_url || '',
        api_key: api_key || '',
      })
      .eq('id', instanceId);

    if (dbError) {
      console.error('Supabase error:', dbError);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    // 2. Automated 1-Click Discord Slash Command Registration
    if (discord_token && discord_public_key) {
      try {
        // Fetch Discord Application ID automatically using the bot token
        const appRes = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
          headers: { Authorization: `Bot ${discord_token}` },
        });
        const appData = await appRes.json();

        if (appData.id) {
          // Register /ask slash command for this customer's bot
          await fetch(`https://discord.com/api/v10/applications/${appData.id}/commands`, {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${discord_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([
              {
                name: 'ask',
                description: 'Ask the AI Support Agent a question',
                options: [
                  {
                    name: 'question',
                    description: 'Your question or support prompt',
                    type: 3, // STRING
                    required: true,
                  },
                ],
              },
            ]),
          });
        }
      } catch (cmdError) {
        console.error('Failed to auto-register Discord commands:', cmdError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}