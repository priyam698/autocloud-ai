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

// AI Engine: Strictly answers using the text stored in the customer's database row
async function askGroq(userQuestion: string, businessText: string, botName: string = 'Assistant'): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!businessText || businessText.trim().length === 0) {
    return 'The business knowledge base is currently empty. Please add your business details in the dashboard.';
  }

  if (!apiKey) {
    console.error('[Groq Error]: Missing GROQ_API_KEY');
    return 'Our AI assistant is temporarily offline for maintenance.';
  }

  const systemPrompt = `You are ${botName}, the official AI support assistant for this business.
Answer the customer's question directly, politely, and accurately using ONLY the business knowledge provided below.

================ BUSINESS KNOWLEDGE ================
${businessText.trim()}
===================================================

RULES:
1. Answer the question using ONLY details from the knowledge base above (pricing, items, shipping, rules).
2. If the answer is not in the text, politely state that you do not have that specific information.
3. Keep answers clear, natural, and under 3 sentences.`;

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
          { role: 'system', content: systemPrompt },
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
    }
  } catch (err) {
    console.error('[Groq Inference Error]:', err);
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

    const supabase = getSupabase();

    let botToken = tokenParam || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let customerKnowledge = '';
    let botName = 'Felix';

    // 1. Safe query: no fragile .order() calls that crash on missing columns
    try {
      const { data: records, error } = await supabase.from('deployments').select('*');

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

        // Extract knowledge across any potential column name
        customerKnowledge =
          matchedRow.knowledge_base ||
          matchedRow.business_knowledge ||
          matchedRow.knowledge ||
          matchedRow.business_info ||
          matchedRow.rules ||
          matchedRow.prompt ||
          matchedRow.system_prompt ||
          matchedRow.content ||
          '';

        console.log(`[Webhook] Matched ID: ${matchedRow.id} | Knowledge length: ${customerKnowledge.length}`);
      } else if (error) {
        console.error('[Webhook Supabase Error]:', error.message);
      }
    } catch (dbErr) {
      console.error('[Webhook DB Exception]:', dbErr);
    }

    if (!botToken) {
      console.error('[Webhook Error]: No bot token found');
      return NextResponse.json({ ok: true });
    }

    // 2. Generate answer using customer knowledge
    const answer = await askGroq(userText, customerKnowledge, botName);

    // 3. Dispatch to Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: answer,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (fatal: any) {
    console.error('[Webhook Fatal]:', fatal);
    return NextResponse.json({ ok: true });
  }
}