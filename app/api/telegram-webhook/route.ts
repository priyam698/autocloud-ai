import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message || body?.channel_post;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
    const isPrivateChat = message.chat.type === 'private';

    // 1. Fetch active deployment & context from Supabase
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

    // 2. SAVE GROUP CHAT ID FOR AUTOMATED SALES BROADCASTS
    if (isGroup && deployment?.id) {
      await supabase
        .from('deployments')
        .update({ group_chat_id: chatId.toString() })
        .eq('id', deployment.id);
    }

    // 3. AUTO-WELCOME NEW GROUP MEMBERS
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

    // 4. ANSWER MESSAGES WITH LLM & LIVE STORE API LOOKUP
    const userText = message.text;
    if (!userText) return NextResponse.json({ ok: true });

    let liveStoreContext = '';

    // Check if customer provided an Order ID pattern (e.g. #12345 or 123456) in Direct Message
    const orderMatch = userText.match(/#?(\d{4,10})/);
    if (isPrivateChat && orderMatch && deployment?.website_url) {
      const orderId = orderMatch[1];
      try {
        const storeRes = await fetch(`${deployment.website_url}?order_id=${orderId}`, {
          headers: {
            Authorization: `Bearer ${deployment.api_key || ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (storeRes.ok) {
          const orderData = await storeRes.json();
          liveStoreContext = `\n[LIVE STORE API SYSTEM DATA]: Order #${orderId} details: Status="${
            orderData.status || 'Processing'
          }", Tracking="${orderData.tracking_number || 'Pending'}". Answer the user using this official data.`;
        }
      } catch (err) {
        console.error('Failed to fetch store API:', err);
      }
    }

    // Combine system prompt, knowledge base, and live store API data
    const systemPrompt = `You are an AI Support Bot. Assist users in group/DM using this business context:\n${customContext}${liveStoreContext}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        temperature: 0.5,
      }),
    });

    const groqData = await groqRes.json();
    const replyText =
      groqData?.choices?.[0]?.message?.content ||
      "I'm here to help! For complex issues or account verification, please email priyamrana069@gmail.com.";

    // Reply back in Telegram chat
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        reply_to_message_id: message.message_id,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}