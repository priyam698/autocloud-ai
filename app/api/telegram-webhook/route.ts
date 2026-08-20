import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Comprehensive AutoCloud AI Knowledge Base
const DEFAULT_AUTOCLOUD_KNOWLEDGE = `
AutoCloud AI is a 1-click cloud platform for hosting autonomous AI agents and bots 24/7.
- PRICING: Flat $12/month per bot instance across all supported platforms (Slack, Telegram, Discord, and Website Webchat widgets). No hidden server fees.
- SUPPORTED BOT TYPES:
  * Telegram AI Support Bots (Customer service, community management)
  * Slack AI Support Bots ($12/month per instance, enterprise workspace assistant)
  * Discord AI Community Bots ($12/month per instance)
  * Website AI Chat Widgets ($12/month per instance)
- KEY FEATURES: 1-click instant deployment, 99.9% uptime cloud hosting, automated website knowledge scraping, custom system prompt engineering, multi-tenant agent management.
- HUMAN SUPPORT / ESCALATION: For human support, billing inquiries, or technical assistance, users must contact priyamrana069@gmail.com.
`.trim();

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

    // 1. Strip Telegram command triggers (/start, bot mentions)
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Fetch deployment and custom context from Supabase
    let deployment = null;
    if (instanceId) {
      const res = await supabase.from('deployments').select('*').eq('id', instanceId).maybeSingle();
      deployment = res.data;
    } else if (queryToken) {
      const res = await supabase.from('deployments').select('*').eq('bot_token', queryToken).maybeSingle();
      deployment = res.data;
    }

    if (!deployment) {
      const res = await supabase
        .from('deployments')
        .select('*')
        .or('template_id.eq.telegram,name.ilike.%telegram%')
        .maybeSingle();
      deployment = res.data;
    }

    const customerBotToken =
      queryToken ||
      deployment?.bot_token ||
      deployment?.telegram_token ||
      process.env.TELEGRAM_SUPPORT_BOT_TOKEN;

    if (!customerBotToken) {
      console.error('[Telegram Webhook] Missing customerBotToken');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AutoCloud Support';
    const customContext = deployment?.custom_context?.trim() || '';
    const fullKnowledgeBase = `${DEFAULT_AUTOCLOUD_KNOWLEDGE}\n\n${customContext}`.trim();

    // If user sent empty /start command
    if (!userText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am the official AI assistant for ${botName}. How can I assist you today?`,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Strict prompt instructions
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

MISSION:
Answer the user's question accurately using ONLY the information in the KNOWLEDGE BASE below.

RULES:
1. Answer directly in 1 to 2 clear, helpful, and natural sentences.
2. PRICING: If asked about Slack, Telegram, Discord, or Webchat bot pricing, state clearly that it is a flat $12/month per bot instance.
3. HUMAN SUPPORT: If asked how to contact human support, provide the email: priyamrana069@gmail.com.
4. OUT-OF-SCOPE: If asked about topics completely unrelated to AutoCloud AI services, politely decline.

KNOWLEDGE BASE:
${fullKnowledgeBase}
`.trim();

    let replyText = '';

    // 4. Primary Provider: Groq (Llama 3.3 70B)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        });

        const groqData = await groqRes.json();
        const groqReply = groqData.choices?.[0]?.message?.content?.trim();
        if (groqReply) replyText = groqReply;
      } catch (err) {
        console.error('[Groq Error]:', err);
      }
    }

    // 5. Fallback Provider 1: Cerebras (Llama 3.1 8B)
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    if (!replyText && cerebrasKey) {
      try {
        const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
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
        });

        const cerebrasData = await cerebrasRes.json();
        const cerebrasReply = cerebrasData.choices?.[0]?.message?.content?.trim();
        if (cerebrasReply) replyText = cerebrasReply;
      } catch (err) {
        console.error('[Cerebras Error]:', err);
      }
    }

    // 6. Fallback Provider 2: Gemini
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;
    if (!replyText && geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${userText}\nAI Reply:` }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 120 },
            }),
          }
        );
        const geminiData = await geminiRes.json();
        const geminiReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (geminiReply) replyText = geminiReply;
      } catch (err) {
        console.error('[Gemini Error]:', err);
      }
    }

    // Default safety fallback if all API calls fail
    if (!replyText) {
      replyText = 'AutoCloud AI hosts autonomous bots across Telegram, Slack, and Discord for a flat $12/month. For human assistance, contact priyamrana069@gmail.com.';
    }

    // 7. Send reply directly to Telegram chat
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
    console.error('[Telegram Handler Root Error]:', err);
    return NextResponse.json({ ok: true });
  }
}