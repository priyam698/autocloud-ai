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

// AI Engine: Grounded exclusively on customer's knowledge text
async function askGroq(userQuestion: string, businessKnowledge: string, botName: string = 'Assistant'): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!businessKnowledge || businessKnowledge.trim().length === 0) {
    return 'Hello! I am your AI assistant. The business knowledge base is currently being updated. Please ask again shortly or leave your contact details.';
  }

  if (!apiKey) {
    console.error('[Groq Error]: Missing GROQ_API_KEY');
    return 'Our support assistant is experiencing a temporary service update. Please try again shortly.';
  }

  const prompt = `You are ${botName}, the official customer support AI assistant for this business.
Answer the customer's question directly, accurately, and politely using ONLY the business knowledge provided below.

================ BUSINESS KNOWLEDGE BASE ================
${businessKnowledge.trim()}
=========================================================

RULES:
1. Answer the question using ONLY details from the knowledge base above (pricing, products, shipping, policies).
2. If the user asks about specific prices (e.g. jackets, shoes, plans), quote the exact prices stated in the knowledge base.
3. If the answer is NOT present in the knowledge base, politely state that you do not have that specific information.
4. Keep answers concise, natural, and under 3 sentences.`;

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
        temperature: 0.1,
        max_tokens: 350,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } else {
      console.error('[Groq API Error]:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Groq Fetch Exception]:', err);
  }

  return 'I am currently having trouble retrieving that information. Please try again shortly.';
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

    // Hard fallback bot token to guarantee delivery even if env vars are missing
    let botToken =
      tokenParam ||
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_SUPPORT_BOT_TOKEN ||
      '8933256473:AAHoCwrKmPqdvsJf2gzuFFCcO4usvF7E4vc';

    let customerKnowledge = '';
    let botName = 'Felix';

    const supabase = getSupabase();

    // Query database for customer's knowledge base
    try {
      let { data: records, error } = await supabase.from('deployments').select('*');

      if (error || !records || records.length === 0) {
        const fallbackRes = await supabase.from('instances').select('*');
        records = fallbackRes.data;
      }

      if (records && records.length > 0) {
        let matchedRow = records[0];

        if (instanceId) {
          const found = records.find(
            (r: any) =>
              r.id === instanceId ||
              (typeof r.id === 'string' && r.id.toLowerCase().startsWith(instanceId.toLowerCase()))
          );
          if (found) matchedRow = found;
        }

        botToken = matchedRow.telegram_bot_token || matchedRow.bot_token || botToken;
        botName = matchedRow.bot_name || matchedRow.name || botName;
        customerKnowledge =
          matchedRow.knowledge_base ||
          matchedRow.business_knowledge ||
          matchedRow.knowledge ||
          matchedRow.business_info ||
          matchedRow.rules ||
          matchedRow.prompt ||
          matchedRow.system_prompt ||
          '';

        console.log(`[Webhook Matched] ID: ${matchedRow.id} | Knowledge Length: ${customerKnowledge.length}`);
      }
    } catch (dbErr) {
      console.error('[Webhook DB Query Exception]:', dbErr);
    }

    // Generate dynamic reply with Groq
    const replyText = await askGroq(userText, customerKnowledge, botName);

    // Dispatch reply to Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    if (!tgRes.ok) {
      console.error('[Telegram API Send Failed]:', await tgRes.text());
    }

    return NextResponse.json({ ok: true });
  } catch (fatal: any) {
    console.error('[Telegram Webhook Fatal]:', fatal);
    return NextResponse.json({ ok: true });
  }
}