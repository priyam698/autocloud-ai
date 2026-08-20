import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const DEFAULT_AUTOCLOUD_KNOWLEDGE = `
AutoCloud AI is a 1-click cloud platform for hosting autonomous AI agents and bots 24/7.
- PRICING: Flat $12/month per bot instance across all supported platforms (Slack, Telegram, Discord, and Web Chat widgets).
- SLACK BOT PRICING: $12/month per instance with 24/7 cloud uptime and AI responses.
- TELEGRAM BOT PRICING: $12/month per instance.
- DISCORD BOT PRICING: $12/month per instance.
- KEY FEATURES: 1-click deployment, 99.9% uptime, website knowledge auto-scraping, custom context prompts, zero DevOps setup.
- HUMAN SUPPORT: For technical help, billing, or human escalation, contact priyamrana069@gmail.com.
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

    // 1. Strip /start and bot mentions
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Fetch deployment row from Supabase
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
      console.error('[Telegram Webhook] No customerBotToken available.');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AutoCloud Support';
    const customContext = deployment?.custom_context?.trim() || '';
    const fullKnowledge = `${DEFAULT_AUTOCLOUD_KNOWLEDGE}\n\n${customContext}`.trim();

    // Direct greeting on empty /start
    if (!userText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am the official AI assistant for ${botName}. How can I help you today?`,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Prompt definition
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

INSTRUCTIONS:
1. Answer the user's question accurately using ONLY the KNOWLEDGE BASE below.
2. Keep replies natural, concise, and helpful (1 to 2 sentences).
3. PRICING: Flat $12/month per bot instance across Telegram, Slack, Discord, and Web Chat.
4. HUMAN SUPPORT: If asked for human support, direct them to priyamrana069@gmail.com.
5. OUT-OF-SCOPE: If asked about topics unrelated to ${botName}, politely decline.

KNOWLEDGE BASE:
${fullKnowledge}
`.trim();

    let replyText = '';

    // 4. Primary Provider: Groq (llama-3.1-8b-instant)
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
        } else {
          console.error('[Groq Failure]:', JSON.stringify(groqData));
        }
      } catch (err) {
        console.error('[Groq Exception]:', err);
      }
    }

    // 5. Secondary Provider: Cerebras (llama3.1-8b)
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

    // 6. Tertiary Provider: Google Gemini
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
    if (!replyText && geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\nUser Question: ${userText}\nAI Reply:` }],
                },
              ],
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

    // Direct fallback if all keys are unavailable
    if (!replyText) {
      if (userText.toLowerCase().includes('pricing') || userText.toLowerCase().includes('slack')) {
        replyText = 'AutoCloud AI hosts autonomous bots across Slack, Telegram, and Discord for a flat $12/month per bot instance.';
      } else if (userText.toLowerCase().includes('support') || userText.toLowerCase().includes('contact')) {
        replyText = 'You can reach human support directly by emailing priyamrana069@gmail.com.';
      } else {
        replyText = `I am the AI assistant for ${botName}. AutoCloud AI provides 1-click cloud hosting for bots at $12/month. For assistance, email priyamrana069@gmail.com.`;
      }
    }

    // 7. Deliver message to Telegram
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
    console.error('[Telegram Fatal Error]:', err);
    return NextResponse.json({ ok: true });
  }
}