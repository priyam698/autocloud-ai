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

    // Ignore non-text updates or empty requests
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. DYNAMIC LOOKUP: Get active customer bot token from Supabase deployments
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

    // 2. LLAMA 3 INTEGRATION: Call Groq API endpoint
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      replyText = 'Configuration Error: GROQ_API_KEY is missing on server.';
    } else {
      const llamaRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant powered by Llama 3 running on Telegram.',
            },
            {
              role: 'user',
              content: userText,
            },
          ],
          temperature: 0.7,
        }),
      });

      const llamaData = await llamaRes.json();

      if (llamaRes.ok && llamaData.choices?.[0]?.message?.content) {
        replyText = llamaData.choices[0].message.content;
      } else {
        replyText = `Llama Error: ${llamaData.error?.message || 'Failed to generate response.'}`;
      }
    }

    // 3. TELEGRAM SEND: Send back response using the customer's dynamic botToken from DB
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