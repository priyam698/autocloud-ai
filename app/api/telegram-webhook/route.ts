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

    // Ignore non-text updates or empty payloads silently
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. STRICT AUTOMATED STATUS CHECK
    if (!tokenFromQuery) {
      return NextResponse.json({ message: 'Missing token parameter' }, { status: 200 });
    }

    const { data: deployment } = await supabase
      .from('deployments')
      .select('bot_token, status, expires_at')
      .eq('bot_token', tokenFromQuery)
      .maybeSingle();

    // AUTOMATED OFF SWITCH 1: If record doesn't exist or status is NOT 'running'
    if (!deployment || deployment.status !== 'running') {
      console.log(`[Webhook Gatekeeper]: Blocked request. Instance status is NOT active.`);
      return NextResponse.json({ message: 'Instance deactivated' }, { status: 200 });
    }

    // AUTOMATED OFF SWITCH 2: Check if subscription timestamp has passed
    if (deployment.expires_at && new Date(deployment.expires_at) < new Date()) {
      console.log(`[Webhook Gatekeeper]: Blocked request. Subscription expired.`);
      
      // Automatically update DB status to expired
      await supabase
        .from('deployments')
        .update({ status: 'expired' })
        .eq('bot_token', tokenFromQuery);

      return NextResponse.json({ message: 'Subscription expired' }, { status: 200 });
    }

    // 2. AI GENERATION (Only runs if status is 'running' AND subscription is active)
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    if (!cerebrasApiKey) {
      return NextResponse.json({ ok: true });
    }

    const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cerebrasApiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: 'You are Felix, an AI assistant running on Telegram.' },
          { role: 'user', content: userText },
        ],
        temperature: 0.7,
      }),
    });

    if (!cerebrasRes.ok) return NextResponse.json({ ok: true });

    const cerebrasData = await cerebrasRes.json();
    const replyText = cerebrasData.choices?.[0]?.message?.content;

    if (replyText) {
      await fetch(`https://api.telegram.org/bot${tokenFromQuery}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: replyText }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: true });
  }
}