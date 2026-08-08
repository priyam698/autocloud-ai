import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    // Ignore non-text updates or empty payloads
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. Fetch active deployment details & business knowledge base from Supabase
    const { data: deployment, error: dbError } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError || !deployment) {
      console.error('Database query error or no deployment found:', dbError);
    }

    const botToken = deployment?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const customContext =
      deployment?.custom_context ||
      'You are a helpful customer support AI assistant for AutoCloud AI.';

    if (!botToken) {
      console.error('No bot token found in DB or environment variables.');
      return NextResponse.json(
        { error: 'Telegram Bot Token missing' },
        { status: 400 }
      );
    }

    // 2. Query Gemini 1.5 Flash API with Business Context
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY environment variable is not set.');
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Business Context / Knowledge Base:\n${customContext}\n\nUser Question: ${userText}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const replyText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't process your request right now. Please try again in a moment.";

    // 3. Send message back to user via Telegram Bot API
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
    console.error('Telegram Webhook Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}