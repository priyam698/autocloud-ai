import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateAIResponse(userText: string): Promise<string | null> {
  const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasApiKey) {
    console.error('[Configuration Error]: CEREBRAS_API_KEY environment variable is missing.');
    return null;
  }

  // Primary and fallback model identifiers supported by Cerebras
  const models = ['llama3.1-8b', 'llama-3.3-70b'];

  for (const model of models) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cerebrasApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
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
        const errorDetails = await res.json().catch(() => ({}));
        console.error(`[Cerebras Model ${model} Failed]:`, errorDetails);
        continue; // Try fallback model if available
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (err) {
      console.error(`[Cerebras Fetch Error on ${model}]:`, err);
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    // 1. Permanently identify the incoming bot by its unique URL token
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json();
    const message = body.message;

    // Ignore non-text updates or empty payloads silently
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 2. Exact Database Lookup: Ensure this exact bot token is active in DB
    let activeToken = tokenFromQuery;

    if (activeToken) {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token, status')
        .eq('bot_token', activeToken)
        .eq('status', 'running')
        .maybeSingle();

      // IF INSTANCE DELETED OR STOPPED: Immediately ignore request!
      if (!deployment) {
        console.log(`[Webhook Guard]: Blocked message for inactive/deleted token.`);
        return NextResponse.json({ message: 'Deployment inactive' }, { status: 200 });
      }
    } else {
      // Fallback for legacy webhooks missing URL parameter
      const { data: deployment } = await supabase
        .from('deployments')
        .select('bot_token')
        .eq('status', 'running')
        .not('bot_token', 'is', null)
        .limit(1)
        .maybeSingle();

      if (!deployment || !deployment.bot_token) {
        return NextResponse.json({ message: 'No active deployment found' }, { status: 200 });
      }
      activeToken = deployment.bot_token;
    }

    // 3. Generate AI response
    const aiReply = await generateAIResponse(userText);
    const finalReply = aiReply || "I'm experiencing a brief system sync. Please ask me again in a moment!";

    // 4. Send message back to Telegram for this specific bot token
    await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: finalReply,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Exception]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}