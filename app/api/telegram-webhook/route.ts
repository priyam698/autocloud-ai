import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getCerebrasResponse(userText: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [
          {
            role: 'system',
            content: 'You are Felix, a polite, intelligent, and helpful AI assistant on Telegram.',
          },
          {
            role: 'user',
            content: userText,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(`[Cerebras Error Status ${res.status}]:`, errData);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Cerebras Fetch Exception]:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json();
    const message = body?.message;

    // 1. Silent Guard: Ignore non-text updates or empty payloads
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // 2. Handle /start command directly
    if (userText === '/start') {
      await fetch(`https://api.telegram.org/bot${tokenFromQuery || ''}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Hello! I'm your AI Telegram bot. Ask me anything!",
        }),
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // 3. Strict Database Status Verification (Turn ON / Turn OFF Gatekeeper)
    let targetBotToken = tokenFromQuery;

    if (targetBotToken) {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token, status, expires_at')
        .eq('bot_token', targetBotToken)
        .maybeSingle();

      // BLOCK COMPLETELY: If deployment is stopped, missing, or deleted
      if (!deployment || deployment.status !== 'running') {
        console.log(`[Webhook Gatekeeper]: Request blocked for inactive/deleted token.`);
        return NextResponse.json({ message: 'Deployment inactive or removed' }, { status: 200 });
      }

      // Check for subscription expiration
      if (deployment.expires_at && new Date(deployment.expires_at) < new Date()) {
        console.log(`[Webhook Gatekeeper]: Request blocked. Subscription expired.`);
        await supabase
          .from('deployments')
          .update({ status: 'expired' })
          .eq('bot_token', targetBotToken);

        return NextResponse.json({ message: 'Subscription expired' }, { status: 200 });
      }
    } else {
      // Fallback verification for legacy webhooks
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token')
        .eq('status', 'running')
        .not('bot_token', 'is', null)
        .limit(1)
        .maybeSingle();

      if (!deployment || !deployment.bot_token) {
        console.log('[Webhook Gatekeeper]: No active deployment running in DB.');
        return NextResponse.json({ message: 'No active deployment running' }, { status: 200 });
      }
      targetBotToken = deployment.bot_token;
    }

    // 4. AI Inference Execution
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    let replyText: string | null = null;

    if (cerebrasApiKey) {
      replyText = await getCerebrasResponse(userText, cerebrasApiKey);
    }

    if (!replyText) {
      replyText = "I'm experiencing a brief system sync. Please ask me again in just a moment!";
    }

    // 5. Send Response Back to Telegram
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