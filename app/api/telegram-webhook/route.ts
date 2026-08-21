import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');

    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat?.id;
    const userMessage = update.message.text?.trim() || '';

    if (!chatId || !userMessage) {
      return NextResponse.json({ ok: true });
    }

    let botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let customerKnowledge = '';

    // 1. Fetch the exact customer knowledge base from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const queryUrl = instanceId
          ? `${supabaseUrl}/rest/v1/deployments?id=eq.${encodeURIComponent(instanceId)}&select=*`
          : `${supabaseUrl}/rest/v1/deployments?order=created_at.desc&limit=1&select=*`;

        const dbRes = await fetch(queryUrl, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });

        if (dbRes.ok) {
          const records = await dbRes.json();
          if (records && records.length > 0) {
            const row = records[0];
            botToken = row.telegram_bot_token || row.bot_token || botToken;
            customerKnowledge =
              row.knowledge_base ||
              row.business_knowledge ||
              row.business_info ||
              row.rules ||
              row.system_prompt ||
              '';
          }
        }
      } catch (dbErr) {
        console.error('[Supabase Error]:', dbErr);
      }
    }

    if (!botToken) {
      console.error('[Webhook Error]: Missing Telegram Bot Token');
      return NextResponse.json({ ok: true });
    }

    // 2. Call Single AI Engine (Groq Llama 3.3 70B)
    const groqKey = process.env.GROQ_API_KEY?.trim();
    let replyText = 'Thank you for reaching out! Please contact our team directly for further assistance.';

    if (groqKey) {
      const systemPrompt = `You are the official dedicated AI customer support assistant.
Answer the customer's inquiry clearly, politely, and concisely using ONLY the business knowledge base below.

================ BUSINESS KNOWLEDGE BASE ================
${customerKnowledge || 'AutoCloud AI provides autonomous customer support bots.'}
=========================================================

RULES:
1. Ground all answers (pricing, cancellation, refund, contact details) strictly in the knowledge above.
2. If information is not in the knowledge base, politely state that you do not have that specific detail and provide the support contact email.
3. Answer naturally in 1-3 conversational sentences.`;

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
            { role: 'user', content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 350,
        }),
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        replyText = groqData.choices?.[0]?.message?.content?.trim() || replyText;
      } else {
        const errBody = await groqRes.text();
        console.error(`[Groq Error ${groqRes.status}]:`, errBody);
      }
    } else {
      console.error('[Configuration Error]: GROQ_API_KEY is missing');
    }

    // 3. Send AI response directly to Telegram user
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (fatalErr) {
    console.error('[Webhook Fatal Error]:', fatalErr);
    return NextResponse.json({ ok: true });
  }
}