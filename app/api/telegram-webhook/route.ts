import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Comprehensive AutoCloud AI Enterprise Knowledge Base & FAQs
const AUTOCLOUD_KNOWLEDGE_BASE = `
# AUTOCLOUD AI - OFFICIAL KNOWLEDGE BASE & RULES

1. PLATFORM OVERVIEW:
- AutoCloud AI (autocloud-ai-p448.vercel.app) is an autonomous, 1-click cloud hosting platform for AI agents and support bots.
- Hosted Bots: Telegram AI Bots, Slack AI Support Bots, Discord Community Bots, and Website Webchat Widgets.
- Infrastructure: 99.9% uptime, 24/7 continuous cloud execution, zero server management, zero DevOps required.

2. PRICING & BILLING:
- Pricing: Flat $12/month per bot instance across all platforms (Telegram, Slack, Discord, Webchat).
- Setup Fees & Hidden Charges: $0. No setup fees, no maintenance fees, and no hidden charges.
- Billing Provider: Securely processed via LemonSqueezy.

3. AUTO-TRAINING & SCRAPING:
- Auto-Scrape: Users can enter any public website URL on the dashboard. AutoCloud AI automatically scrapes and converts website content into an active AI knowledge base.

4. CRITICAL SUPPORT & TROUBLESHOOTING RULES:
- FORGOT PASSWORD / ACCESS: If a user forgot their instance password or lost dashboard access, tell them: "Please email priyamrana069@gmail.com to verify your account and reset your credentials."
- ACCIDENTALLY DELETED INSTANCE: If a user accidentally deleted their bot instance, tell them: "Please send your billing receipt to priyamrana069@gmail.com along with your query to restore your instance."
- BILLING & REFUND INQUIRIES: Tell them to email priyamrana069@gmail.com with their LemonSqueezy order ID.
- HUMAN SUPPORT: For technical escalation or human support, direct them to priyamrana069@gmail.com.
- OUT-OF-SCOPE: If asked about topics unrelated to AutoCloud AI services (e.g. general trivia, coding tasks outside AutoCloud), politely decline and state you only assist with AutoCloud AI.
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

    // 1. Clean command prefix (/start, bot mentions)
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Fetch specific customer deployment & scraped context from Supabase
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

    // Direct greeting on empty /start
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

    // 3. Fast-Path Deterministic FAQ Handling
    const lower = userText.toLowerCase();
    let replyText: string | null = null;

    if (lower.includes('forgot') && (lower.includes('password') || lower.includes('credential') || lower.includes('login'))) {
      replyText = 'If you forgot your instance password or access credentials, please email priyamrana069@gmail.com to verify your account and reset your access.';
    } else if ((lower.includes('deleted') || lower.includes('delete')) && lower.includes('instance')) {
      replyText = 'If you accidentally deleted your instance, please send your billing receipt to priyamrana069@gmail.com along with your query, and our team will restore it for you.';
    } else if (lower.includes('human') || lower.includes('speak to a person') || lower.includes('real person') || lower.includes('support email')) {
      replyText = 'You can reach human support directly by emailing priyamrana069@gmail.com.';
    }

    // 4. Dynamic AI Generation with Failover Chain
    if (!replyText) {
      const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

STRICT INSTRUCTIONS:
1. Answer the user's question directly, accurately, and naturally using ONLY the KNOWLEDGE BASE below.
2. Keep your answers concise (1 to 2 clear sentences).
3. If asked about pricing (Telegram, Slack, Discord, Web Chat), state that it is a flat $12/month per bot instance with no hidden setup fees.
4. If asked how to contact support, provide: priyamrana069@gmail.com.
5. If the question cannot be answered from the knowledge base, state you can only assist with ${botName} inquiries and direct them to priyamrana069@gmail.com.

KNOWLEDGE BASE:
${mergedKnowledge}
`.trim();

      // Provider 1: Groq (llama-3.3-70b-versatile)
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
          if (groqData.choices?.[0]?.message?.content) {
            replyText = groqData.choices[0].message.content.trim();
          } else {
            console.error('[Groq Failure]:', JSON.stringify(groqData));
          }
        } catch (err) {
          console.error('[Groq Exception]:', err);
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
          } else {
            console.error('[Cerebras Failure]:', JSON.stringify(cerebrasData));
          }
        } catch (err) {
          console.error('[Cerebras Exception]:', err);
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
          console.error('[Gemini Exception]:', err);
        }
      }
    }

    // Default response if no model answered
    if (!replyText) {
      replyText = 'AutoCloud AI hosts bots across Slack, Telegram, and Discord for a flat $12/month per instance. For assistance, contact priyamrana069@gmail.com.';
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