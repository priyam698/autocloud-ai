import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Safe runtime Supabase client initialization
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

// Fallback rule engine if API connection drops
function executeRuleEngine(question: string, rawKnowledge: string): string {
  const q = question.toLowerCase();

  // If knowledge is present, scan for highest matching line
  if (rawKnowledge && rawKnowledge.trim().length > 0) {
    const lines = rawKnowledge
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5);

    const words = q.split(/\s+/).filter(w => w.length > 2);
    let bestLine = '';
    let bestScore = 0;

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      let matches = 0;
      for (const word of words) {
        if (lineLower.includes(word)) matches++;
      }
      if (matches > bestScore) {
        bestScore = matches;
        bestLine = line;
      }
    }

    if (bestLine && bestScore > 0) {
      return bestLine;
    }
  }

  // Built-in platform defaults
  if (q.includes('cost') || q.includes('price') || q.includes('much') || q.includes('rate')) {
    return 'A dedicated bot instance costs $12 per month with full 24/7 autonomous support.';
  }
  if (q.includes('cancel') || q.includes('delete') || q.includes('stop')) {
    return 'You can cancel or remove your monthly active deployment anytime directly from your dashboard under Instance Settings.';
  }
  if (q.includes('company') || q.includes('name') || q.includes('who are you')) {
    return 'We are AutoCloud AI, providing autonomous AI customer support bots for Telegram, Discord, and WhatsApp.';
  }

  return rawKnowledge.slice(0, 200) || 'How can I assist you with your business today?';
}

// Groq AI inference engine
async function queryGroqLLM(userQuestion: string, knowledgeText: string, botName: string = 'Assistant'): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const systemInstructions = `You are ${botName}, the official dedicated AI customer support assistant for this business.

================ KNOWLEDGE BASE ================
${knowledgeText}
================================================

RULES:
1. Answer the customer's question directly, accurately, and politely using ONLY the knowledge base above.
2. Ground all pricing, cancellation procedures, company details, and feature explanations strictly in the knowledge base.
3. If the knowledge base does not contain the answer, politely provide the support contact information.
4. Keep all responses clear, conversational, and under 3 sentences.`;

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
          { role: 'system', content: systemInstructions },
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
      console.error('[Groq Error Code]:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Groq Network Error]:', err);
  }

  return null;
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
    let businessKnowledge = '';
    let botName = 'Felix';

    const supabase = getSupabaseClient();

    // 1. Fetch deployment record from Supabase
    try {
      let query = supabase.from('deployments').select('*');
      if (instanceId) {
        query = query.eq('id', instanceId);
      } else {
        query = query.order('updated_at', { ascending: false }).limit(1);
      }

      const { data: records, error } = await query;
      if (!error && records && records.length > 0) {
        const row = records[0];
        botToken = row.telegram_bot_token || botToken;
        businessKnowledge = row.knowledge_base || '';
        botName = row.bot_name || botName;
      }
    } catch (dbErr) {
      console.error('[Supabase Fetch Exception]:', dbErr);
    }

    if (!botToken) {
      console.error('[Telegram Webhook]: Missing bot token');
      return NextResponse.json({ ok: true });
    }

    // 2. Generate response via Groq AI
    let replyText = await queryGroqLLM(userMessage, businessKnowledge, botName);

    // 3. Fallback to direct knowledge rule engine if Groq is unavailable
    if (!replyText) {
      replyText = executeRuleEngine(userMessage, businessKnowledge);
    }

    // 4. Dispatch reply directly to Telegram chat
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