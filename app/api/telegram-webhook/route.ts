import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. Get deployment & custom context from Supabase
    const { data: deployment } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const botToken = deployment?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const customContext =
      deployment?.custom_context ||
      'You are a helpful customer support AI assistant for AutoCloud AI.';

    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram Bot Token missing' },
        { status: 400 }
      );
    }

    // 2. Call Groq LLaMA API
    const groqApiKey = process.env.GROQ_API_KEY;

    const groqRes = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant. Answer customer questions using ONLY this business knowledge base:\n\n${customContext}`,
            },
            {
              role: 'user',
              content: userText,
            },
          ],
          temperature: 0.5,
        }),
      }
    );

    const groqData = await groqRes.json();
    const replyText =
      groqData?.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't process your request right now.";

    // 3. Send Telegram Response
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Groq Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}