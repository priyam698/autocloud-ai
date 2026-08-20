import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Helper: Split text into 1500-char chunks for vector indexing
function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

// Helper: Vector embedding generator via Gemini
async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
    if (!apiKey) return null;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      }
    );
    const data = await res.json();
    return data.embedding?.values || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      instanceId,
      botToken,
      bot_token,
      discord_token,
      discord_public_key,
      slack_token,
      whatsapp_phone_id,
      whatsapp_token,
      messenger_token,
      custom_context,
      knowledge,
      bot_type,
      website_url,
      websiteUrl,
      api_key,
    } = body;

    if (!instanceId) {
      return NextResponse.json({ success: false, error: 'Missing instanceId' }, { status: 400 });
    }

    const trimmedToken = (botToken || bot_token)?.trim() || null;
    const knowledgeText = (custom_context || knowledge || '').trim();
    const targetUrl = (website_url || websiteUrl || '').trim();

    // 1. Update instance in Supabase using valid table columns only
    const { error: dbError } = await supabase
      .from('deployments')
      .update({
        bot_token: trimmedToken,
        discord_token: discord_token || null,
        discord_public_key: discord_public_key || null,
        slack_token: slack_token || null,
        whatsapp_phone_id: whatsapp_phone_id || null,
        whatsapp_token: whatsapp_token || null,
        messenger_token: messenger_token || null,
        custom_context: knowledgeText,
        bot_type: bot_type || 'general',
        website_url: targetUrl,
        api_key: api_key || '',
        status: 'online',
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanceId);

    if (dbError) {
      console.error('[Supabase Error]:', dbError);
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    // 2. Register Telegram Webhook directly with Telegram API
    if (trimmedToken) {
      try {
        const appBaseUrl = 'https://autocloud-ai-p448.vercel.app';
        const webhookUrl = `${appBaseUrl}/api/telegram-webhook?token=${encodeURIComponent(trimmedToken)}&instanceId=${encodeURIComponent(instanceId)}`;

        const tgRes = await fetch(
          `https://api.telegram.org/bot${trimmedToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`
        );
        const tgData = await tgRes.json();
        console.log('[Telegram setWebhook Result]:', tgData);
      } catch (tgErr) {
        console.error('[Telegram Webhook Registration Failed]:', tgErr);
      }
    }

    // 3. Register Discord Commands if Discord token provided
    if (discord_token && discord_public_key) {
      try {
        const appRes = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
          headers: { Authorization: `Bot ${discord_token}` },
        });
        const appData = await appRes.json();

        if (appData.id) {
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
                    type: 3,
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

    // 4. Background Vector Indexing for RAG
    if (knowledgeText.length > 50) {
      (async () => {
        try {
          await supabase.from('bot_knowledge_chunks').delete().eq('instance_id', instanceId);
          const chunks = chunkText(knowledgeText);
          for (const chunk of chunks) {
            const vector = await getEmbedding(chunk);
            if (vector) {
              await supabase.from('bot_knowledge_chunks').insert({
                instance_id: instanceId,
                content: chunk,
                url: targetUrl,
                embedding: vector,
              });
            }
          }
        } catch (e) {
          console.error('[RAG Vector Indexing Error]:', e);
        }
      })();
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Registration Exception]:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}