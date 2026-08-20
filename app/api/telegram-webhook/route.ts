import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Fallback baseline platform knowledge if no custom knowledge was scraped
const FALLBACK_DEFAULT_KNOWLEDGE = `
AutoCloud AI is an autonomous, 1-click cloud platform for hosting 24/7 AI customer support bots and agents.
- Flat Pricing: $12/month per bot instance across Telegram, Slack, Discord, and Web Chat widgets.
- $0 setup fees, no maintenance fees, no server management or VPS required.
- Human support / escalation: Email priyamrana069@gmail.com.
- Forgot credentials or lost instance access: Email priyamrana069@gmail.com to reset.
- Accidentally deleted instance: Email billing receipt to priyamrana069@gmail.com for restoration.
`.trim();

// Timeout-protected fetch helper to prevent serverless function hangs
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('teamId');
    const queryToken = searchParams.get('token');

    const update = await req.json().catch(() => null);
    if (!update) return NextResponse.json({ ok: true });

    const msg = update.message || update.edited_message || update.channel_post;
    if (!msg || !msg.text) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    let userText = msg.text.trim();

    // 1. Clean command triggers
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Fetch deployment and scraped context from Supabase
    let deployment: any = null;

    if (instanceId) {
      const { data } = await supabase.from('deployments').select('*').eq('id', instanceId).maybeSingle();
      deployment = data;
    }

    if (!deployment && queryToken) {
      const { data } = await supabase.from('deployments').select('*').eq('bot_token', queryToken).maybeSingle();
      deployment = data;
    }

    if (!deployment) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      deployment = data;
    }

    const customerBotToken =
      queryToken ||
      deployment?.bot_token ||
      deployment?.telegram_token ||
      process.env.TELEGRAM_SUPPORT_BOT_TOKEN;

    if (!customerBotToken) {
      console.error('[Telegram Webhook Error]: No customer bot token found.');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AI Assistant';
    const scrapedKnowledge = (deployment?.custom_context || deployment?.knowledge || '').trim();
    const effectiveKnowledge = scrapedKnowledge.length > 20 ? scrapedKnowledge : FALLBACK_DEFAULT_KNOWLEDGE;

    // Direct greeting on empty /start
    if (!userText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am your AI assistant. How can I help you today?`,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Fast-Path Hard Rule Handlers
    const lower = userText.toLowerCase();
    let replyText: string | null = null;

    if (
      (lower.includes('reset') || lower.includes('forgot') || lower.includes('lost')) &&
      (lower.includes('password') || lower.includes('credential') || lower.includes('login') || lower.includes('access'))
    ) {
      replyText = 'To reset your account login credentials or instance access, please email priyamrana069@gmail.com with your registered details.';
    } else if (
      (lower.includes('delete') || lower.includes('deleted') || lower.includes('remove')) &&
      (lower.includes('instance') || lower.includes('bot') || lower.includes('agent'))
    ) {
      replyText = 'If you accidentally deleted your instance, please send your billing receipt to priyamrana069@gmail.com along with your query to restore it.';
    } else if (
      lower.includes('speak to a human') ||
      lower.includes('real human') ||
      lower.includes('support email') ||
      lower.includes('support mail')
    ) {
      replyText = 'You can reach human support directly by emailing priyamrana069@gmail.com.';
    }

    // 4. Multi-Provider AI Inference Waterfall
    if (!replyText) {
      const systemPrompt = `
You are the official customer support AI assistant for: "${botName}".

MISSION:
Answer the user's question accurately, concisely, and naturally (1 to 2 clear sentences) using ONLY the KNOWLEDGE BASE provided below.

RULES:
1. Base all facts, products, services, offerings, and pricing strictly on the KNOWLEDGE BASE.
2. If the user asks something completely outside the knowledge base, politely decline and provide support assistance.

KNOWLEDGE BASE:
${effectiveKnowledge}
`.trim();

      // --- Provider 1: Groq (Llama 3.3 70B) ---
      const groqKey = process.env.GROQ_API_KEY?.trim();
      if (groqKey && !replyText) {
        try {
          const res = await fetchWithTimeout(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userText },
                ],
                max_tokens: 180,
                temperature: 0.1,
              }),
            },
            6000
          );

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) replyText = content;
          else console.error('[Groq 70B Non-fatal Error]:', JSON.stringify(data));
        } catch (err) {
          console.error('[Groq 70B Timeout/Error]:', err);
        }
      }

      // --- Provider 2: Cerebras (Llama 3.1 8B - Ultra Fast) ---
      const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
      if (cerebrasKey && !replyText) {
        try {
          const res = await fetchWithTimeout(
            'https://api.cerebras.ai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${cerebrasKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama3.1-8b',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userText },
                ],
                max_tokens: 180,
                temperature: 0.1,
              }),
            },
            5000
          );

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) replyText = content;
          else console.error('[Cerebras Non-fatal Error]:', JSON.stringify(data));
        } catch (err) {
          console.error('[Cerebras Timeout/Error]:', err);
        }
      }

      // --- Provider 3: Google Gemini Flash 1.5 ---
      const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
      if (geminiKey && !replyText) {
        try {
          const res = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `${systemPrompt}\n\nUser Question: ${userText}\n\nAnswer:`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 180,
                },
              }),
            },
            6000
          );

          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (content) replyText = content;
          else console.error('[Gemini Non-fatal Error]:', JSON.stringify(data));
        } catch (err) {
          console.error('[Gemini Timeout/Error]:', err);
        }
      }

      // --- Provider 4: Groq Instant Fallback (Llama 3.1 8B) ---
      if (groqKey && !replyText) {
        try {
          const res = await fetchWithTimeout(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userText },
                ],
                max_tokens: 150,
                temperature: 0.1,
              }),
            },
            4000
          );

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) replyText = content;
        } catch (err) {
          console.error('[Groq 8B Fast Timeout/Error]:', err);
        }
      }
    }

    // Safety fallback
    if (!replyText) {
      replyText = 'I am currently having trouble accessing the full knowledge base. Please contact human support at priyamrana069@gmail.com for assistance.';
    }

    // 5. Send message safely to Telegram
    const telegramRes = await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    if (!telegramRes.ok) {
      const errData = await telegramRes.json();
      console.error('[Telegram Send Message Failed]:', errData);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Fatal Root Exception]:', err);
    return NextResponse.json({ ok: true });
  }
}