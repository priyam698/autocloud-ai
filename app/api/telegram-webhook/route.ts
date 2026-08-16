import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const TELEGRAM_TOKEN =
  process.env.TELEGRAM_SUPPORT_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  '8933256473:AAHoCwrKmPqdvsJf2gzuFFCc04usvF7E4vc';

export async function POST(req: Request) {
  try {
    const update = await req.json().catch(() => null);

    if (!update) {
      return NextResponse.json({ ok: true });
    }

    // Extract text from private message, group message, or channel post
    const message = update.message || update.channel_post || update.edited_message;
    const userText = message?.text?.trim();
    const chatId = message?.chat?.id;

    if (!chatId || !userText) {
      return NextResponse.json({ ok: true });
    }

    // 1. Fetch trained knowledge base from Supabase
    let botName = 'AutoCloud Support';
    let businessContext =
      'AutoCloud AI provides instant, 1-click cloud hosting for autonomous AI agents and bots at $12/month per bot instance.';

    const { data: deployment } = await supabase
      .from('deployments')
      .select('*')
      .or('template_id.eq.telegram,name.ilike.%telegram%')
      .maybeSingle();

    if (deployment) {
      botName = deployment.name || botName;
      if (deployment.custom_context?.trim()) {
        businessContext = deployment.custom_context.trim();
      }
    }

    // 2. Strict AI Prompt
    const systemPrompt = `
You are the official Telegram AI assistant for "${botName}".

RULES:
1. Answer in 1 to 2 clear, concise sentences.
2. PRICING: Every bot on AutoCloud AI (Telegram, Slack, Discord, Web Chat) is a flat $12/month.
3. SUPPORT: Direct users to priyamrana069@gmail.com for escalation.
4. OUT-OF-SCOPE: If asked about topics outside AutoCloud AI, politely decline and offer support email.

KNOWLEDGE BASE:
${businessContext}
`.trim();

    let replyText = 'Hello! How can I assist you with AutoCloud AI today?';

    // 3. Generate response with Gemini
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
                  parts: [{ text: `${systemPrompt}\n\nUser: ${userText}\nAI Response:` }],
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
        if (generated) replyText = generated;
      } catch (e) {
        console.error('Gemini Error in Telegram Webhook:', e);
      }
    }

    // 4. Fallback to Groq if Gemini failed
    if (replyText === 'Hello! How can I assist you with AutoCloud AI today?' && process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
        const groqReply = groqData.choices?.[0]?.message?.content?.trim();
        if (groqReply) replyText = groqReply;
      } catch (e) {
        console.error('Groq Fallback Error:', e);
      }
    }

    // 5. Deliver message back to Telegram
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram Handler Root Error:', err);
    return NextResponse.json({ ok: true });
  }
}