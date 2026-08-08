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

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

    // 1. Fetch deployment & context from Supabase
    const { data: deployment } = await supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const botToken = deployment?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const customContext =
      deployment?.custom_context ||
      'You are a helpful community manager and support bot for our Telegram group.';

    if (!botToken) {
      return NextResponse.json({ error: 'No bot token found' }, { status: 400 });
    }

    // ----------------------------------------------------
    // FEATURE A: AUTO-WELCOME NEW GROUP MEMBERS
    // ----------------------------------------------------
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      for (const newMember of message.new_chat_members) {
        const welcomeName = newMember.first_name || 'Member';
        const welcomeText = `🎉 Welcome **${welcomeName}** to the group!\n\n${customContext}\n\nFeel free to ask any questions here!`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: 'Markdown',
          }),
        });
      }
      return NextResponse.json({ ok: true });
    }

    // ----------------------------------------------------
    // FEATURE B: ANSWER GROUP & DIRECT MESSAGES WITH LLM
    // ----------------------------------------------------
    const userText = message.text;
    if (!userText) return NextResponse.json({ ok: true });

    // In groups, you can choose to reply only if mentioned or to all questions
    const groqApiKey = process.env.GROQ_API_KEY;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            content: `You are a Telegram Community Admin Bot. Assist users in group/DM using this info:\n${customContext}`,
          },
          { role: 'user', content: userText },
        ],
        temperature: 0.5,
      }),
    });

    const groqData = await groqRes.json();
    const replyText =
      groqData?.choices?.[0]?.message?.content ||
      "I'm here to help! Ask any questions regarding our service.";

    // Reply back in chat (replying directly to the user's message)
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        reply_to_message_id: message.message_id, // Replies directly to user's chat message
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}