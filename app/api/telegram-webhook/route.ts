import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. Fetch active customer bot_token dynamically from Supabase
    const { data: deployment, error: dbError } = await supabase
      .from('deployments')
      .select('bot_token')
      .eq('status', 'running')
      .not('bot_token', 'is', null)
      .limit(1)
      .single();

    if (dbError || !deployment?.bot_token) {
      console.error('[Webhook Error]: No active deployment bot_token found in Supabase.');
      return NextResponse.json({ error: 'No bot token found' }, { status: 400 });
    }

    const botToken = deployment.bot_token;
    let replyText = '';

    // 2. Call Cerebras AI API
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;

    if (!cerebrasApiKey) {
      replyText = 'Configuration Error: CEREBRAS_API_KEY is missing on server.';
    } else {
      const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1-8b',
          messages: [
            {
              role: 'system',
               content: 'You are Felix, an AI assistant running on Telegram. You provide quick, helpful answers without fake rate limits.',
            },
            {
              role: 'user',
              content: userText,
            },
          ],
          temperature: 0.7,
        }),
      });

      const cerebrasData = await cerebrasRes.json();

      if (cerebrasRes.ok && cerebrasData.choices?.[0]?.message?.content) {
        replyText = cerebrasData.choices[0].message.content;
      } else {
        console.error('[Cerebras Error]:', cerebrasData);
        replyText = `Cerebras Error: ${cerebrasData.error?.message || 'Failed to generate response.'}`;
      }
    }

    // 3. Send response back to Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Exception]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}