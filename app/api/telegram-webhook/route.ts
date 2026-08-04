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

    // Ignore non-text updates or empty payloads
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. DYNAMIC LOOKUP: Check Supabase for an active 'running' deployment
    const { data: deployment, error: dbError } = await supabase
      .from('deployments')
      .select('bot_token')
      .eq('status', 'running')
      .not('bot_token', 'is', null)
      .limit(1)
      .maybeSingle();

    // If no active instance is found (or deleted), stop execution immediately
    if (dbError || !deployment?.bot_token) {
      console.log('[Webhook Ignored]: No active instance found in database.');
      return NextResponse.json(
        { message: 'No active deployment running' },
        { status: 200 }
      );
    }

    const botToken = deployment.bot_token;
    let replyText = '';

    // 2. CEREBRAS AI INTEGRATION: Call Llama 3.1 8B Model
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
              content: 'You are Felix, a helpful AI assistant running on Telegram.',
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

    // 3. SEND RESPONSE BACK TO TELEGRAM
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