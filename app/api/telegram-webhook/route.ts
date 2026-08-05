import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to call Cerebras AI
async function getCerebrasResponse(userText: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
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
        max_completion_tokens: 1024,
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
    const body = await req.json();
    const message = body.message;

    // Ignore non-text updates or empty payloads silently
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

    // If no active instance found, ignore message completely
    if (dbError || !deployment || !deployment.bot_token) {
      console.log('[Webhook Ignored]: No active instance found in database.');
      return NextResponse.json({ message: 'No active deployment running' }, { status: 200 });
    }

    const botToken = deployment.bot_token;
    let replyText: string | null = null;

    // 2. ATTEMPT PRIMARY AI PROVIDER (Cerebras)
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    if (cerebrasApiKey) {
      replyText = await getCerebrasResponse(userText, cerebrasApiKey);
    }

    // 3. GRACEFUL CONSUMER FALLBACK
    // If Cerebras fails, returns null, or key is missing, deliver a clean, polite response
    if (!replyText) {
      console.warn('[AI Pipeline Warning]: Cerebras failed. Sending polite fallback to end user.');
      replyText = "I'm experiencing a brief system sync. Please ask me again in just a moment!";
    }

    // 4. SEND RESPONSE BACK TO TELEGRAM
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