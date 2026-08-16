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

    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 1. Locate deployment by ID or Bot Token
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
      return NextResponse.json({ ok: true });
    }

    const botName = deployment?.name || 'AutoCloud Support';
    const businessContext =
      deployment?.custom_context?.trim() ||
      'AutoCloud AI provides instant cloud hosting for autonomous AI agents and bots at $12/month per bot instance.';

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

    // 2. System prompt
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

RULES:
1. Answer in 1 to 2 concise, clear sentences.
2. PRICING: Every bot on AutoCloud AI is a flat $12/month per instance.
3. SUPPORT: Direct unhandled inquiries to priyamrana069@gmail.com.
4. OUT-OF-SCOPE: If asked about unrelated topics, politely state you only assist with ${botName} inquiries.

KNOWLEDGE BASE:
${businessContext}
`.trim();

    let replyText = `Hello! How can I assist you with ${botName} today?`;

    // 3. Generate with Gemini
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;
    if (geminiKey) {
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
        const data = await geminiRes.json();
        const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (generated) replyText = generated;
      } catch (err) {
        console.error('Gemini processing error:', err);
      }
    }

    // 4. Send Message back to Telegram
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
    console.error('Telegram Webhook Handler Error:', err);
    return NextResponse.json({ ok: true });
  }
}