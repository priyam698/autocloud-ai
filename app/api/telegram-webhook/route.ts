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

    const update = await req.json().catch(() => null);
    if (!update) return NextResponse.json({ ok: true });

    const msg = update.message || update.edited_message || update.channel_post;
    if (!msg || !msg.text) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    let userText = msg.text.trim();

    // 1. Clean command triggers (/start, bot mentions)
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Dynamically fetch this specific customer's bot token and knowledge base
    let query = supabase.from('deployments').select('*');
    if (instanceId) {
      query = query.eq('id', instanceId);
    } else {
      query = query.or('template_id.eq.telegram,name.ilike.%telegram%');
    }

    const { data: deployment, error: dbError } = await query.maybeSingle();

    if (dbError || !deployment) {
      console.error('[Webhook] Could not find deployment for instanceId:', instanceId);
      return NextResponse.json({ ok: true });
    }

    // Resolve customer bot token from database column
    const customerBotToken =
      deployment.telegram_token ||
      deployment.telegram_bot_token ||
      deployment.bot_token ||
      process.env.TELEGRAM_SUPPORT_BOT_TOKEN;

    if (!customerBotToken) {
      console.error('[Webhook] No bot token found in database for instance:', deployment.id);
      return NextResponse.json({ ok: true });
    }

    const botName = deployment.name || 'AI Assistant';
    const businessContext =
      deployment.custom_context?.trim() ||
      'AutoCloud AI provides instant, 1-click cloud hosting for autonomous AI agents and bots at $12/month per bot instance.';

    // 3. If user sent empty /start, greet immediately
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

    // 4. Strict enterprise prompt using customer context
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

RULES:
1. Answer in 1 to 2 concise, clear, and professional sentences.
2. Only answer questions based on the KNOWLEDGE BASE below.
3. PRICING: Every bot instance on AutoCloud AI is a flat $12/month.
4. SUPPORT: Direct unhandled inquiries to priyamrana069@gmail.com.
5. OUT-OF-SCOPE: If asked about unrelated topics, politely state you only assist with ${botName} inquiries.

KNOWLEDGE BASE:
${businessContext}
`.trim();

    let replyText = `Hello! How can I assist you with ${botName} today?`;

    // 5. Generate response using Gemini
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
                  parts: [{ text: `${systemPrompt}\n\nUser Question: ${userText}\nAI Reply:` }],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 120,
              },
            }),
          }
        );
        const data = await geminiRes.json();
        const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (generated) replyText = generated;
      } catch (err) {
        console.error('Gemini processing error:', err);
      }
    }

    // 6. Fallback to Groq if Gemini is rate limited
    if (replyText.startsWith('Hello! How can I assist') && process.env.GROQ_API_KEY) {
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
      } catch (err) {
        console.error('Groq fallback error:', err);
      }
    }

    // 7. Deliver response back through the customer's Telegram bot
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
    console.error('Dynamic Telegram Webhook Error:', err);
    return NextResponse.json({ ok: true });
  }
}