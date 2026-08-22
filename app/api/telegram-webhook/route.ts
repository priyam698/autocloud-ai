import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const FALLBACK_BOT_TOKEN = '8933256473:AAHoCwrKmPqdvsJf2gzuFFCcO4usvF7E4vc';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

// 1. Safe AI Query with Strict 6-Second Timeout
async function queryAI(userQuestion: string, knowledgeText: string, botName: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  // If no knowledge base has been added yet
  if (!knowledgeText || knowledgeText.trim().length === 0) {
    return 'Hello! I am your AI assistant. The business knowledge base is currently being updated. Please check back shortly or leave your contact details.';
  }

  if (!apiKey) {
    console.warn('[AI Engine] Missing GROQ_API_KEY, returning raw matching text');
    return knowledgeText.slice(0, 300);
  }

  const prompt = `You are ${botName || 'an AI Assistant'}, the official customer support assistant for this business.
Answer the customer's question directly, accurately, and politely using ONLY the knowledge base below.

================ BUSINESS KNOWLEDGE BASE ================
${knowledgeText.trim()}
=========================================================

RULES:
1. Answer using ONLY information from the knowledge base (quote exact prices, products, and rules).
2. If the answer is not in the text, politely state that you do not have that specific information.
3. Keep responses natural, concise, and under 3 sentences.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    }
  } catch (err: any) {
    console.error('[AI Engine Error / Timeout]:', err?.message || err);
  }

  // Fast Fallback: Find matching sentence directly from knowledge text
  const cleanQ = userQuestion.toLowerCase();
  const matchedLine = knowledgeText
    .split('\n')
    .find(line => cleanQ.split(' ').some(word => word.length > 3 && line.toLowerCase().includes(word)));

  return matchedLine || knowledgeText.slice(0, 250);
}

// 2. Safe Telegram Message Dispatcher
async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    const resData = await res.json().catch(() => ({}));
    console.log(`[Telegram Dispatch] Chat: ${chatId} | Status: ${res.status} | Ok: ${resData.ok}`);
    return resData;
  } catch (err) {
    console.error('[Telegram Dispatch Failed]:', err);
    return null;
  }
}

// 3. Webhook Entry Point
export async function POST(req: Request) {
  let chatId: number | string | null = null;
  let activeToken = FALLBACK_BOT_TOKEN;

  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');
    const tokenParam = searchParams.get('token');

    if (tokenParam) activeToken = tokenParam;

    const rawUpdate = await req.json().catch(() => null);
    if (!rawUpdate) return NextResponse.json({ ok: true });

    // Handle standard message, edited message, or channel post
    const msg = rawUpdate.message || rawUpdate.channel_post || rawUpdate.edited_message;
    if (!msg || !msg.text) {
      return NextResponse.json({ ok: true });
    }

    chatId = msg.chat?.id;
    let userText = msg.text.trim().replace(/@\w+/g, '').trim();

    if (!chatId || !userText) {
      return NextResponse.json({ ok: true });
    }

    let customerKnowledge = '';
    let botName = 'Felix';

    // Fetch deployment from Supabase
    try {
      const supabase = getSupabase();
      const { data: records, error } = await supabase.from('deployments').select('*');

      if (!error && records && records.length > 0) {
        let row = records[0];

        if (instanceId) {
          const found = records.find(
            (r: any) =>
              r.id === instanceId ||
              (typeof r.id === 'string' && r.id.toLowerCase().startsWith(instanceId.toLowerCase()))
          );
          if (found) row = found;
        }

        activeToken = row.telegram_bot_token || row.bot_token || activeToken;
        botName = row.bot_name || row.name || botName;

        customerKnowledge =
          row.knowledge_base ||
          row.business_knowledge ||
          row.knowledge ||
          row.business_info ||
          row.rules ||
          row.prompt ||
          '';

        console.log(`[DB Match] Row ID: ${row.id} | Knowledge Length: ${customerKnowledge.length} chars`);
      }
    } catch (dbErr) {
      console.error('[DB Query Exception]:', dbErr);
    }

    // Generate response
    const replyText = await queryAI(userText, customerKnowledge, botName);

    // Guaranteed message delivery
    await sendTelegramMessage(activeToken, chatId, replyText);

    return NextResponse.json({ ok: true });
  } catch (fatalErr: any) {
    console.error('[Webhook Fatal Exception]:', fatalErr);

    // If a fatal crash happens after getting the chatId, still send an emergency message
    if (chatId) {
      await sendTelegramMessage(
        activeToken,
        chatId,
        'I am currently experiencing a brief connection delay. Please try your question again in a few moments.'
      );
    }

    return NextResponse.json({ ok: true });
  }
}