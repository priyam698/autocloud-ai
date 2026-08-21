import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

// Direct Knowledge Parser: Extracts relevant lines if AI network times out
function extractFromKnowledge(query: string, knowledge: string): string {
  if (!knowledge || knowledge.trim().length === 0) {
    return 'Please contact human support directly for assistance with your inquiry.';
  }

  const qTerms = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const blocks = knowledge
    .split(/\n\n+|(?=## )|(?=\* )/)
    .map(b => b.replace(/^[#*-\s]+/, '').trim())
    .filter(b => b.length > 5);

  let bestBlock = '';
  let maxScore = 0;

  for (const block of blocks) {
    const lower = block.toLowerCase();
    let score = 0;
    for (const term of qTerms) {
      if (lower.includes(term)) score += 2;
    }
    if (score > maxScore) {
      maxScore = score;
      bestBlock = block;
    }
  }

  return bestBlock || blocks.slice(0, 2).join('\n\n');
}

// Groq AI Engine
async function generateTelegramReply(userMessage: string, knowledge: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const cleanKnowledge = knowledge?.trim() || '';

  if (apiKey && cleanKnowledge.length > 0) {
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
            {
              role: 'system',
              content: `You are the official dedicated AI customer support assistant.
Answer the customer's question directly, accurately, and politely using ONLY the business knowledge base below.

================ BUSINESS KNOWLEDGE BASE ================
${cleanKnowledge}
=========================================================

RULES:
1. Ground all answers (pricing, cancellation, refund, contact details) strictly in the knowledge above.
2. If information is not in the knowledge base, politely state that you do not have that specific detail and provide the support contact email.
3. Answer naturally in 1-3 conversational sentences.`,
            },
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
      }
    } catch (err) {
      console.error('[Groq Inference Error]:', err);
    }
  }

  return extractFromKnowledge(userMessage, cleanKnowledge);
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');

    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat?.id;
    const userMessage = update.message.text?.trim() || '';

    if (!chatId || !userMessage) {
      return NextResponse.json({ ok: true });
    }

    let botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let customerKnowledge = '';

    const supabase = getSupabase();

    try {
      const query = instanceId
        ? supabase.from('deployments').select('*').eq('id', instanceId).maybeSingle()
        : supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();

      const { data: deployment } = await query;
      if (deployment) {
        botToken =
          deployment.telegram_bot_token ||
          deployment.bot_token ||
          deployment.custom_bot_token ||
          botToken;

        customerKnowledge =
          deployment.knowledge_base ||
          deployment.business_knowledge ||
          deployment.business_info ||
          deployment.rules ||
          deployment.system_prompt ||
          '';
      }
    } catch (dbErr) {
      console.error('[Telegram DB Lookup Error]:', dbErr);
    }

    if (!botToken) {
      console.error('[Telegram Error]: Missing bot token');
      return NextResponse.json({ ok: true });
    }

    const finalAnswer = await generateTelegramReply(userMessage, customerKnowledge);

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
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: true });
  }
}