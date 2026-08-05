import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // 1. Resolve Bot Token
    let targetBotToken = tokenFromQuery;
    if (!targetBotToken) {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token')
        .eq('status', 'running')
        .not('bot_token', 'is', null)
        .limit(1)
        .maybeSingle();

      if (!deployment?.bot_token) {
        return NextResponse.json({ message: 'No active deployment' }, { status: 200 });
      }
      targetBotToken = deployment.bot_token;
    }

    // 2. Direct Call to Cerebras with Detailed Error Output
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    let replyText = '';

    if (!cerebrasKey) {
      replyText = 'DEBUG: CEREBRAS_API_KEY is missing on Vercel environment variables.';
    } else {
      try {
        const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3.1-8b',
            messages: [
              { role: 'user', content: userText }
            ],
          }),
        });

        const cerebrasData = await cerebrasRes.json();

        if (cerebrasRes.ok && cerebrasData.choices?.[0]?.message?.content) {
          replyText = cerebrasData.choices[0].message.content;
        } else {
          // Send the EXACT status code and error response to Telegram!
          replyText = `CEREBRAS ERROR [${cerebrasRes.status}]: ${JSON.stringify(cerebrasData)}`;
        }
      } catch (err: any) {
        replyText = `FETCH EXCEPTION: ${err.message}`;
      }
    }

    // 3. Send back to Telegram
    await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}