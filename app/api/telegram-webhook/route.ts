import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Resilient fetch helper with timeout
async function safeFetch(url: string, options: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Heuristic knowledge matcher if external LLMs hit rate limits or outages
function extractLocalKnowledgeMatch(query: string, knowledge: string): string | null {
  if (!knowledge || knowledge.length < 10) return null;
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const lines = knowledge.split('\n').map(l => l.trim()).filter(Boolean);

  let bestLine = '';
  let maxMatches = 0;

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (lineLower.includes(word)) score++;
    }
    if (score > maxMatches && score >= 1) {
      maxMatches = score;
      bestLine = line;
    }
  }

  return bestLine.length > 10 ? bestLine.replace(/^[#\-*>\s]+/, '').trim() : null;
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');
    const queryToken = searchParams.get('token');

    const update = await req.json().catch(() => null);
    if (!update) return NextResponse.json({ ok: true });

    const msg = update.message || update.edited_message || update.channel_post;
    if (!msg || !msg.text) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    let userText = msg.text.trim();

    // Strip bot command tags
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 1. Resolve customer instance from Supabase
    let deployment: any = null;

    if (instanceId) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();
      deployment = data;
    }

    if (!deployment && queryToken) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .eq('bot_token', queryToken)
        .maybeSingle();
      deployment = data;
    }

    if (!deployment) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      deployment = data;
    }

    const customerBotToken = queryToken || deployment?.bot_token;
    if (!customerBotToken) {
      console.error('[Multi-tenant Webhook]: Bot token not found.');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AI Assistant';
    const customerKnowledge = (deployment?.custom_context || deployment?.knowledge || '').trim();

    // Handle empty /start greeting
    if (!userText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am your AI assistant for ${botName}. How can I assist you today?`,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // Send typing action to Telegram
    fetch(`https://api.telegram.org/bot${customerBotToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    }).catch(() => {});

    // 2. Prepare Knowledge Context (bounded to 4000 characters for token-safety)
    const effectiveKnowledge = customerKnowledge.length > 20
      ? customerKnowledge.slice(0, 4000)
      : 'AutoCloud AI hosts autonomous AI customer support bots for a flat $12/month. For support contact priyamrana069@gmail.com.';

    const systemPrompt = `
You are the official customer support AI assistant for: "${botName}".

MISSION:
Answer the user's question directly, accurately, and naturally in 1 to 2 clear sentences using ONLY the KNOWLEDGE BASE below.

RULES:
1. Base all facts, pricing, features, and policies strictly on the KNOWLEDGE BASE.
2. If asked something completely outside the knowledge base, politely state that you do not have that information and suggest contacting support.

KNOWLEDGE BASE:
${effectiveKnowledge}
`.trim();

    let replyText = '';

    // --- Provider 1: Groq Llama 3.1 8B Instant (30,000 TPM limit - no rate limit blocks) ---
    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (groqKey && !replyText) {
      try {
        const res = await safeFetch(
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
          5000
        );

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) replyText = content;
        else console.error('[Groq 8B Error Response]:', JSON.stringify(data));
      } catch (err) {
        console.error('[Groq 8B Call Failed]:', err);
      }
    }

    // --- Provider 2: Cerebras Llama 3.1 8B (Fast alternative) ---
    const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
    if (cerebrasKey && !replyText) {
      try {
        const res = await safeFetch(
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
              max_tokens: 150,
              temperature: 0.1,
            }),
          },
          5000
        );

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) replyText = content;
        else console.error('[Cerebras Error Response]:', JSON.stringify(data));
      } catch (err) {
        console.error('[Cerebras Call Failed]:', err);
      }
    }

    // --- Provider 3: Google Gemini Flash ---
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
    if (geminiKey && !replyText) {
      try {
        const res = await safeFetch(
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
                      text: `${systemPrompt}\n\nUser Question: ${userText}\nAI Answer:`,
                    },
                  ],
                },
              ],
              generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
            }),
          },
          6000
        );

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (content) replyText = content;
        else console.error('[Gemini Error Response]:', JSON.stringify(data));
      } catch (err) {
        console.error('[Gemini Call Failed]:', err);
      }
    }

    // --- Provider 4: Groq Llama 3.3 70B ---
    if (groqKey && !replyText) {
      try {
        const res = await safeFetch(
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
              max_tokens: 150,
              temperature: 0.1,
            }),
          },
          6000
        );

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) replyText = content;
      } catch (err) {
        console.error('[Groq 70B Call Failed]:', err);
      }
    }

    // --- Fallback: Extract direct match from customer's knowledge base ---
    if (!replyText) {
      const match = extractLocalKnowledgeMatch(userText, customerKnowledge);
      if (match) {
        replyText = match;
      } else {
        replyText = `Hello! Regarding ${botName}, please refer to our main documentation or contact support for full details.`;
      }
    }

    // 3. Send final response to Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    if (!tgRes.ok) {
      const tgErr = await tgRes.json();
      console.error('[Telegram Send Failed]:', tgErr);
    }

    return NextResponse.json({ ok: true });
  } catch (fatalErr: any) {
    console.error('[Root Webhook Error]:', fatalErr);
    return NextResponse.json({ ok: true });
  }
}