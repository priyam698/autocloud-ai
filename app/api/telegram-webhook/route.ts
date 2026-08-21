import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

// AI Engine: Exclusively answers from whatever text the customer entered in the knowledge box
async function generateGroundedResponse(
  userQuestion: string,
  customerKnowledge: string,
  botName: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!customerKnowledge || customerKnowledge.trim().length === 0) {
    return 'Hello! I am your AI assistant. The business knowledge base is currently being updated. Please check back shortly or leave your contact details.';
  }

  if (!apiKey) {
    console.error('[Groq Error]: Missing GROQ_API_KEY');
    return 'Our support assistant is experiencing a temporary connection issue. Please try again in a moment.';
  }

  const prompt = `You are ${botName || 'an AI Support Assistant'}, representing this business.
Answer the customer's inquiry accurately, politely, and concisely using ONLY the business knowledge provided below.

================ BUSINESS KNOWLEDGE BASE ================
${customerKnowledge.trim()}
=========================================================

STRICT OPERATING RULES:
1. Answer the question using ONLY information explicitly stated in the knowledge base above.
2. If the user asks about pricing, services, shipping, policies, or company info, extract and state the exact details from the knowledge base.
3. If the answer is NOT present in the knowledge base, politely state that you do not have that specific information.
4. Keep all responses clear, helpful, and under 3 sentences.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userQuestion },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } else {
      console.error('[Groq API Call Failed]:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Groq Fetch Exception]:', err);
  }

  return 'I am currently having trouble retrieving that information. Please contact our support team directly.';
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');
    const tokenParam = searchParams.get('token');

    const update = await req.json().catch(() => null);
    if (!update) return NextResponse.json({ ok: true });

    const message = update.message || update.channel_post || update.edited_message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat?.id;
    let userText = message.text.trim();
    userText = userText.replace(/@\w+/g, '').trim();

    if (!chatId || !userText) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();

    let botToken = tokenParam || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let customerKnowledge = '';
    let botName = 'Felix';

    // Safe DB Lookup: Fetches all records without crashing Postgres on UUID types
    try {
      const { data: records, error } = await supabase
        .from('deployments')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && records && records.length > 0) {
        let matchedRow = records[0];

        if (instanceId) {
          const found = records.find(
            (r: any) =>
              r.id === instanceId ||
              (typeof r.id === 'string' && r.id.toLowerCase().startsWith(instanceId.toLowerCase()))
          );
          if (found) matchedRow = found;
        } else if (botToken) {
          const found = records.find(
            (r: any) => r.telegram_bot_token === botToken || r.bot_token === botToken
          );
          if (found) matchedRow = found;
        }

        botToken = matchedRow.telegram_bot_token || matchedRow.bot_token || botToken;
        botName = matchedRow.bot_name || matchedRow.name || botName;
        customerKnowledge =
          matchedRow.knowledge_base ||
          matchedRow.business_knowledge ||
          matchedRow.business_info ||
          matchedRow.system_prompt ||
          matchedRow.knowledge ||
          matchedRow.rules ||
          '';

        console.log(`[Supabase Matched ID: ${matchedRow.id}] Loaded knowledge length: ${customerKnowledge.length}`);
      }
    } catch (dbErr) {
      console.error('[Supabase Fetch Exception]:', dbErr);
    }

    if (!botToken) {
      console.error('[Telegram Webhook Error]: No bot token available');
      return NextResponse.json({ ok: true });
    }

    const replyText = await generateGroundedResponse(userText, customerKnowledge, botName);

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (fatalErr: any) {
    console.error('[Telegram Webhook Fatal]:', fatalErr);
    return NextResponse.json({ ok: true });
  }
}