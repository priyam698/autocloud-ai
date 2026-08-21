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

// 1. Groq AI Inference
async function generateTelegramReply(userMessage: string, knowledge: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    console.error('[Groq Error]: Missing GROQ_API_KEY in environment');
    return knowledge || 'Please contact our team directly for further details.';
  }

  const systemPrompt = `You are the official dedicated AI customer support assistant for this business.
Answer the user's question directly, accurately, and politely using ONLY the business knowledge base below.

================ CUSTOMER BUSINESS KNOWLEDGE ================
${knowledge}
============================================================

RULES:
1. Base all answers (pricing, company name, features, cancellations, refund policy) strictly on the knowledge above.
2. If the answer is in the text above, state it clearly in 1-3 conversational sentences.
3. If the knowledge base is completely empty or does not contain the answer, politely let them know and provide support contact information.`;

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
          { role: 'user', content: userMessage },
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
    console.error('[Groq Network Exception]:', err);
  }

  return knowledge || 'Thank you for reaching out! Please contact our support team directly.';
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');
    const tokenParam = searchParams.get('token');

    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat?.id;
    const userMessage = update.message.text?.trim() || '';

    if (!chatId || !userMessage) {
      return NextResponse.json({ ok: true });
    }

    let botToken = tokenParam || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let customerKnowledge = '';

    const supabase = getSupabase();

    // Look up the customer's saved knowledge base from Supabase
    try {
      // 1. Try 'deployments' table
      let { data: records, error } = await supabase
        .from('deployments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !records || records.length === 0) {
        // 2. Fallback to 'instances' table if deployments is empty
        const fallbackRes = await supabase.from('instances').select('*').order('created_at', { ascending: false });
        records = fallbackRes.data;
      }

      if (records && records.length > 0) {
        // Find matching record by instanceId or botToken, otherwise take latest
        let row = records[0];
        if (instanceId) {
          const found = records.find((r: any) => r.id === instanceId || r.instance_id === instanceId);
          if (found) row = found;
        } else if (botToken) {
          const found = records.find((r: any) => r.telegram_bot_token === botToken || r.bot_token === botToken);
          if (found) row = found;
        }

        botToken = row.telegram_bot_token || row.bot_token || row.custom_bot_token || botToken;
        customerKnowledge =
          row.knowledge_base ||
          row.business_knowledge ||
          row.business_info ||
          row.knowledge ||
          row.content ||
          row.rules ||
          row.system_prompt ||
          row.prompt ||
          '';

        console.log(`[Supabase Loaded] Row ID: ${row.id} | Knowledge Length: ${customerKnowledge.length} chars`);
      } else {
        console.warn('[Supabase Warning]: No deployment records found in database');
      }
    } catch (dbErr) {
      console.error('[Supabase Fetch Exception]:', dbErr);
    }

    if (!botToken) {
      console.error('[Telegram Fatal]: No valid bot token found');
      return NextResponse.json({ ok: true });
    }

    // Generate response with Groq using the extracted knowledge
    const finalAnswer = await generateTelegramReply(userMessage, customerKnowledge);

    // Send answer back to Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: finalAnswer,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Fatal]:', err);
    return NextResponse.json({ ok: true });
  }
}