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

    // 1. Strip /start command and bot mentions
    userText = userText.replace(/^\/start(@\w+)?/i, '').replace(/@\w+/g, '').trim();

    // 2. Fetch specific customer deployment and scraped knowledge base from Supabase
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
    const businessContext =
      deployment?.custom_context?.trim() ||
      'AutoCloud AI provides instant 1-click cloud hosting for autonomous AI agents and bots at $12/month per bot instance.';

    // If user sent empty /start command, send initial greeting
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

    // 3. Strict prompt constructed with your website knowledge base
    const systemPrompt = `
You are the official customer support AI assistant for "${botName}".

MISSION & INSTRUCTIONS:
1. Answer the user's inquiry accurately using ONLY the KNOWLEDGE BASE below.
2. Keep replies natural, helpful, and concise (1 to 2 sentences maximum).
3. PRICING: Every bot on AutoCloud AI is a flat $12/month per instance.
4. HUMAN SUPPORT: If the user asks for a human or has an unhandled issue, tell them to email priyamrana069@gmail.com.
5. OUT-OF-SCOPE: If asked about topics completely unrelated to ${botName}, politely decline.

KNOWLEDGE BASE:
${businessContext}
`.trim();

    let replyText: string | null = null;

    // 4. Primary Provider: Groq (Ultra-fast, zero JSON schema errors)
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
            temperature: 0.2,
          }),
        });

        const groqData = await groqRes.json();
        const groqGenerated = groqData.choices?.[0]?.message?.content?.trim();
        if (groqGenerated) {
          replyText = groqGenerated;
        } else {
          console.error('[Groq Error Payload]:', JSON.stringify(groqData));
        }
      } catch (err) {
        console.error('[Groq Fetch Error]:', err);
      }
    }

    // 5. Secondary Provider: Cerebras (Ultra-low latency fallback)
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
            temperature: 0.2,
          }),
        });

        const cerebrasData = await cerebrasRes.json();
        const cerebrasGenerated = cerebrasData.choices?.[0]?.message?.content?.trim();
        if (cerebrasGenerated) {
          replyText = cerebrasGenerated;
        } else {
          console.error('[Cerebras Error Payload]:', JSON.stringify(cerebrasData));
        }
      } catch (err) {
        console.error('[Cerebras Fetch Error]:', err);
      }
    }

    // 6. Deliver response to Telegram
    if (replyText) {
      await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: true });
  }
}