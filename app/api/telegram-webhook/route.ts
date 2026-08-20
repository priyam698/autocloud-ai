import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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

    // 2. Locate deployment data dynamically
    let deployment = null;
    if (instanceId) {
      const res = await supabase.from('deployments').select('*').eq('id', instanceId).maybeSingle();
      deployment = res.data;
    } else if (queryToken) {
      const res = await supabase.from('deployments').select('*').eq('bot_token', queryToken).maybeSingle();
      deployment = res.data;
    }

    if (!deployment) {
      const res = await supabase.from('deployments').select('*').or('template_id.eq.telegram,name.ilike.%telegram%').maybeSingle();
      deployment = res.data;
    }

    const customerBotToken =
      queryToken ||
      deployment?.bot_token ||
      deployment?.telegram_token ||
      process.env.TELEGRAM_SUPPORT_BOT_TOKEN;

    if (!customerBotToken) {
      console.error('[Telegram Webhook] No bot token found.');
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AutoCloud Support';
    const businessContext =
      deployment?.custom_context?.trim() ||
      'AutoCloud AI provides instant 1-click cloud hosting for autonomous AI agents and bots at $12/month per bot instance.';

    // If user only sent "/start", return greeting
    if (!userText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am the AI assistant for ${botName}. How can I assist you today?`,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Strict prompt rules
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

RULES:
1. Answer in 1 to 2 concise, clear, and professional sentences.
2. PRICING: Every bot on AutoCloud AI (Telegram, Slack, Discord, Web Chat) is a flat $12/month per instance.
3. SUPPORT: Direct unhandled inquiries to priyamrana069@gmail.com.
4. OUT-OF-SCOPE: If asked about unrelated topics, politely decline and offer support email.

KNOWLEDGE BASE:
${businessContext}
`.trim();

    let replyText: string | null = null;

    // 4. Primary Provider: Gemini API
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;
    if (geminiKey) {
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
                  parts: [{ text: `${systemPrompt}\n\nUser Question: ${userText}\nAI Answer:` }],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 120,
              },
            }),
          }
        );

        const geminiData = await geminiRes.json();
        const generated = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (generated) {
          replyText = generated;
        } else {
          console.error('[Gemini API Error Payload]:', geminiData);
        }
      } catch (err) {
        console.error('[Gemini Fetch Error]:', err);
      }
    }

    // 5. Fallback Provider: Groq API (runs instantly if Gemini fails)
    const groqKey = process.env.GROQ_API_KEY;
    if (!replyText && groqKey) {
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
            max_tokens: 120,
            temperature: 0.1,
          }),
        });

        const groqData = await groqRes.json();
        const groqGenerated = groqData.choices?.[0]?.message?.content?.trim();
        if (groqGenerated) {
          replyText = groqGenerated;
        }
      } catch (err) {
        console.error('[Groq Fetch Error]:', err);
      }
    }

    // Final safety fallback
    if (!replyText) {
      replyText = `AutoCloud AI bots are hosted 24/7 for $12/month per bot instance. For help, contact priyamrana069@gmail.com.`;
    }

    // 6. Deliver reply to Telegram
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
    console.error('[Telegram Webhook Handler Error]:', err);
    return NextResponse.json({ ok: true });
  }
}