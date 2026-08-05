import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function callCerebrasDirect(userText: string, apiKey: string): Promise<string> {
  const cleanKey = apiKey.trim();

  // Try standard model IDs supported by Cerebras
  const models = ['llama3.1-8b', 'llama-3.3-70b'];

  for (const model of models) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
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

      const data = await res.json();

      if (res.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      console.error(`[Cerebras Error (${model})]:`, data);
    } catch (err) {
      console.error(`[Cerebras Exception (${model})]:`, err);
    }
  }

  return "Cerebras API execution failed. Please check server logs for exact error status.";
}

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

    // 1. Quick Command Handler
    if (userText === '/start') {
      if (tokenFromQuery) {
        await fetch(`https://api.telegram.org/bot${tokenFromQuery}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Hello! I'm your AI Telegram bot running on Cerebras. Ask me anything!",
          }),
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // 2. Database Status Check
    let targetBotToken = tokenFromQuery;

    if (targetBotToken) {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token, status')
        .eq('bot_token', targetBotToken)
        .maybeSingle();

      if (!deployment || deployment.status !== 'running') {
        return NextResponse.json({ message: 'Deployment inactive' }, { status: 200 });
      }
    } else {
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

    // 3. Direct Cerebras Call Execution
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    let replyText = '';

    if (!cerebrasKey) {
      replyText = 'Configuration Error: CEREBRAS_API_KEY environment variable is missing on Vercel.';
    } else {
      replyText = await callCerebrasDirect(userText, cerebrasKey);
    }

    // 4. Send Message Back to Telegram
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
    console.error('[Telegram Webhook Exception]:', err);
    return NextResponse.json({ ok: true });
  }
}