import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Fetch timeout helper
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 7000
): Promise<Response> {
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
    const instanceId = searchParams.get('instanceId');
    const queryToken = searchParams.get('token');

    const update = await req.json().catch(() => null);
    if (!update) return NextResponse.json({ ok: true });

    const msg = update.message || update.edited_message || update.channel_post;
    if (!msg || !msg.text) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    let userText = msg.text.trim();

    // Clean bot commands like /start
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 1. Strictly look up this specific customer's deployment
    let deployment: any = null;

    if (instanceId) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();
      deployment = data;
    } else if (queryToken) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .eq('bot_token', queryToken)
        .maybeSingle();
      deployment = data;
    }

    const customerBotToken = queryToken || deployment?.bot_token;

    // If no customer bot token exists for this request, exit cleanly
    if (!customerBotToken) {
      console.error('[Multi-tenant Webhook]: No matching bot token found for request.');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AI Assistant';
    const customerKnowledge = (deployment?.custom_context || '').trim();

    // Empty /start command greeting
    if (!userText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am the AI assistant for ${botName}. How can I help you today?`,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // Send typing action
    fetch(`https://api.telegram.org/bot${customerBotToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    }).catch(() => {});

    // 2. Build prompt using this customer's knowledge base
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

MISSION:
Answer the user's inquiry accurately, politely, and concisely (1 to 2 clear sentences) using ONLY the KNOWLEDGE BASE provided below.

RULES:
1. Ground all facts, features, and pricing strictly in the KNOWLEDGE BASE.
2. If the user asks something completely outside the knowledge base, politely inform them that you do not have that information and suggest contacting support.

KNOWLEDGE BASE:
${customerKnowledge || 'Welcome to our service. Please let us know how we can assist you.'}
`.trim();

    let replyText = '';

    // Provider 1: Groq Llama 3.3 70B (High accuracy & 128k context)
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
              max_tokens: 200,
              temperature: 0.1,
            }),
          },
          6000
        );

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) replyText = content;
      } catch (err) {
        console.error('[Groq Inference Error]:', err);
      }
    }

    // Provider 2: Google Gemini Flash
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
                      text: `${systemPrompt}\n\nUser Question: ${userText}\nAI Answer:`,
                    },
                  ],
                },
              ],
              generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
            }),
          },
          6000
        );

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (content) replyText = content;
      } catch (err) {
        console.error('[Gemini Inference Error]:', err);
      }
    }

    // Provider 3: Groq Llama 3.1 8B (Fast fallback)
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
        console.error('[Groq 8B Fast Error]:', err);
      }
    }

    // Default response if providers fail
    if (!replyText) {
      replyText = `Thank you for your message. How can I assist you with ${botName} today?`;
    }

    // 3. Send message back to Telegram using this customer's token
    await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Webhook Fatal Exception]:', err);
    return NextResponse.json({ ok: true });
  }
}