import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Comprehensive AutoCloud AI Knowledge Base
const AUTOCLOUD_KNOWLEDGE_BASE = `
# AUTOCLOUD AI PLATFORM KNOWLEDGE BASE

1. PLATFORM OVERVIEW:
- AutoCloud AI (https://autocloud-ai-p448.vercel.app) is an autonomous, 1-click cloud hosting platform for AI customer support agents and bots.
- Supported Channels: Telegram AI Bots, Slack AI Support Bots, Discord Community Bots, and Website Webchat Widgets.
- Infrastructure: 99.9% uptime, 24/7 continuous cloud execution, zero server management, zero DevOps required.

2. PRICING & FEES:
- Pricing: Flat $12/month per bot instance across all supported platforms (Telegram, Slack, Discord, Webchat).
- Setup Fees & Hidden Charges: $0. There are no setup fees, no maintenance fees, and no hidden charges.
- Free Trial: Paid tier starts at $12/month.
- Billing: Processed securely via LemonSqueezy.

3. AUTO-TRAINING & SCRAPING:
- Users can paste any website URL into the dashboard. AutoCloud AI automatically scrapes and converts website content into an active AI knowledge base.

4. SUPPORT & INSTANCE TROUBLESHOOTING:
- PASSWORD / LOGIN CREDENTIALS RESET: If a user asks how to reset login credentials, forgot password, or lost instance access, reply: "To reset your dashboard login credentials or instance access, please email priyamrana069@gmail.com with your registered email."
- ACCIDENTALLY DELETED INSTANCE: If a user deleted their bot instance, reply: "If you accidentally deleted your instance, please send your billing receipt to priyamrana069@gmail.com along with your query to restore your instance."
- HUMAN SUPPORT: For technical escalation or human assistance, email priyamrana069@gmail.com.
- OUT-OF-SCOPE: For questions unrelated to AutoCloud AI, politely decline and state you only assist with AutoCloud AI.
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

    // 1. Clean command triggers
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Fetch specific customer deployment & context from Supabase
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
      console.error('[Telegram Webhook] No valid bot token found.');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AutoCloud Support';
    const customContext = deployment?.custom_context?.trim() || '';
    const mergedKnowledge = `${AUTOCLOUD_KNOWLEDGE_BASE}\n\n# CUSTOM INSTANCE CONTEXT:\n${customContext}`.trim();

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

    // 3. High-Precision Instant Intent Matcher
    const lower = userText.toLowerCase();
    let replyText: string | null = null;

    // Reset password / Login credentials
    if (
      (lower.includes('reset') || lower.includes('forgot') || lower.includes('lost') || lower.includes('change')) &&
      (lower.includes('password') || lower.includes('credential') || lower.includes('login') || lower.includes('account'))
    ) {
      replyText = 'To reset your dashboard login credentials or instance access, please email priyamrana069@gmail.com with your registered account details.';
    }
    // Accidentally deleted instance
    else if (
      (lower.includes('delete') || lower.includes('deleted') || lower.includes('remove') || lower.includes('lost')) &&
      (lower.includes('instance') || lower.includes('bot') || lower.includes('agent'))
    ) {
      replyText = 'If you accidentally deleted your instance, please send your billing receipt to priyamrana069@gmail.com along with your query, and our team will restore it for you.';
    }
    // Hidden fees / setup fees / free trial
    else if (
      lower.includes('hidden') ||
      lower.includes('setup fee') ||
      lower.includes('extra fee') ||
      lower.includes('maintenance fee')
    ) {
      replyText = 'There are $0 setup fees and no hidden maintenance costs. AutoCloud AI is a flat $12/month per bot instance.';
    }
    // Human support / contact person
    else if (
      lower.includes('human') ||
      lower.includes('real person') ||
      lower.includes('speak to') ||
      lower.includes('representative') ||
      lower.includes('support email') ||
      lower.includes('support mail')
    ) {
      replyText = 'You can reach human support directly by emailing priyamrana069@gmail.com.';
    }

    // 4. Dynamic LLM Generation (Groq -> Cerebras -> Gemini)
    if (!replyText) {
      const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

MISSION & RULES:
1. Answer the user's question directly and concisely (1 to 2 clear sentences).
2. Only use the KNOWLEDGE BASE provided below.
3. PRICING: Every bot instance on AutoCloud AI (Slack, Telegram, Discord, Web Chat) is a flat $12/month with $0 setup fees.
4. If the question cannot be answered from the knowledge base, provide the support email: priyamrana069@gmail.com.

KNOWLEDGE BASE:
${mergedKnowledge}
`.trim();

      // Provider 1: Groq (llama-3.1-8b-instant - Fast <300ms response)
      const groqKey = process.env.GROQ_API_KEY?.trim();
      if (groqKey) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
          });

          const groqData = await groqRes.json();
          if (groqData.choices?.[0]?.message?.content) {
            replyText = groqData.choices[0].message.content.trim();
          }
        } catch (err) {
          console.error('[Groq Error]:', err);
        }
      }

      // Provider 2: Cerebras (llama3.1-8b)
      const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
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
          if (cerebrasData.choices?.[0]?.message?.content) {
            replyText = cerebrasData.choices[0].message.content.trim();
          }
        } catch (err) {
          console.error('[Cerebras Error]:', err);
        }
      }

      // Provider 3: Gemini Flash 1.5
      const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
      if (!replyText && geminiKey) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userText }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
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
    }

    // Default safety fallback
    if (!replyText) {
      replyText = 'AutoCloud AI hosts bots across Slack, Telegram, and Discord for a flat $12/month per instance. For support, contact priyamrana069@gmail.com.';
    }

    // 5. Send message back to Telegram
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
    console.error('[Telegram Webhook Fatal Error]:', err);
    return NextResponse.json({ ok: true });
  }
}