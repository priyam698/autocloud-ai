import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function queryAI(userQuestion: string, knowledgeText: string, botName: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!knowledgeText || knowledgeText.trim().length === 0) {
    return 'Hello! I am your AI assistant. The business knowledge base is currently being updated. Please check back shortly.';
  }

  if (!apiKey) {
    return knowledgeText.slice(0, 300);
  }

  const systemPrompt = `You are ${botName || 'an AI Assistant'}, the official customer support assistant for this business.
Answer the customer's question directly, accurately, and politely using ONLY the knowledge base provided below.

=== BUSINESS KNOWLEDGE BASE & RULES ===
${knowledgeText.trim()}
=======================================

Rules:
- Answer directly based only on the facts in the knowledge base.
- If the requested info is not in the knowledge base, politely state that you do not have that information.
- Keep the reply concise and professional.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'I am sorry, I could not generate a response right now.';
  } catch (err) {
    console.error('[AI Generation Error]:', err);
    return 'I am currently experiencing a brief connection delay. Please try again in a moment.';
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    // Reject unverified requests without a bot token
    if (!token) {
      return NextResponse.json({ error: 'Missing bot token' }, { status: 400 });
    }

    const update = await req.json().catch(() => null);
    const message = update?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // Handle initial /start command
    if (userText.trim() === '/start') {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Hello! How can I help you today?'
        })
      });
      return NextResponse.json({ ok: true });
    }

    // Retrieve this customer's exact knowledge base from Supabase
    const supabase = getSupabase();
    const { data: botInstance, error: dbError } = await supabase
      .from('instances')
      .select('knowledge_base, knowledge, bot_name')
      .eq('telegram_token', token)
      .maybeSingle();

    if (dbError) {
      console.error('[Supabase Lookup Error]:', dbError);
    }

    const knowledgeText = botInstance?.knowledge_base || botInstance?.knowledge || '';
    const botName = botInstance?.bot_name || 'AI Assistant';

    // Generate AI response
    const reply = await queryAI(userText, knowledgeText, botName);

    // Send answer back through this customer's specific Telegram bot
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply
      })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Webhook Exception]:', error);
    return NextResponse.json({ ok: true });
  }
}