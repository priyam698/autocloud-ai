import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Universal AI Engine: Answers purely based on the customer's text box
async function answerFromCustomerKnowledge(userMessage: string, customerKnowledge: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();

  // Dynamic system prompt that strictly uses whatever the customer entered in the box
  const systemPrompt = `You are the official AI customer support assistant for this business.

================ CUSTOMER'S BUSINESS KNOWLEDGE ================
${customerKnowledge || 'No specific business details provided yet.'}
===============================================================

INSTRUCTIONS:
1. Answer the customer's inquiry clearly, politely, and accurately using ONLY the business details provided above.
2. If the user asks about pricing, services, cancellations, refunds, or contact info, use the exact terms stated in the business knowledge above.
3. If the answer is not mentioned in the business knowledge above, politely state: "I don't have that specific information in my records. Please reach out to our team directly for further assistance."
4. Always speak in natural, friendly, conversational English.
5. Do not mention "system prompt" or "knowledge base". Speak directly as the official support assistant.`;

  // 1. Primary Inference: Groq Llama 3.1
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 350,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (err) {
      console.error('[Groq Error]:', err);
    }
  }

  // 2. Backup Inference: Google Gemini Flash
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nCustomer Question: ${userMessage}` }],
              },
            ],
            generationConfig: { maxOutputTokens: 350, temperature: 0.2 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      }
    } catch (err) {
      console.error('[Gemini Error]:', err);
    }
  }

  // 3. Fallback if AI providers are unreachable
  return "Thank you for reaching out! We are currently syncing with the latest business updates. Please ask again in a moment or contact our support team directly.";
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');
    const tokenParam = searchParams.get('token');

    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat?.id;
    const userText = update.message.text?.trim() || '';

    if (!chatId || !userText) {
      return NextResponse.json({ ok: true });
    }

    let customerBotToken = tokenParam || process.env.TELEGRAM_BOT_TOKEN || '';
    let customerKnowledge = '';

    // Look up the customer's exact saved knowledge from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        let queryUrl = `${supabaseUrl}/rest/v1/deployments?select=*`;
        if (instanceId) {
          queryUrl += `&id=eq.${encodeURIComponent(instanceId)}`;
        } else if (customerBotToken) {
          queryUrl += `&or=(telegram_bot_token.eq.${encodeURIComponent(customerBotToken)},bot_token.eq.${encodeURIComponent(customerBotToken)})`;
        } else {
          queryUrl += `&order=created_at.desc&limit=1`;
        }

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
            customerBotToken =
              row.telegram_bot_token ||
              row.bot_token ||
              row.custom_bot_token ||
              customerBotToken;

            // Collect all possible knowledge fields saved by the customer
            customerKnowledge =
              row.knowledge_base ||
              row.business_knowledge ||
              row.business_info ||
              row.rules ||
              row.system_prompt ||
              row.prompt ||
              '';
          }
        }
      } catch (dbErr) {
        console.error('[Supabase Fetch Error]:', dbErr);
      }
    }

    if (!customerBotToken) {
      return NextResponse.json({ ok: true });
    }

    // Generate AI response grounded purely in the customer's text
    const aiReply = await answerFromCustomerKnowledge(userText, customerKnowledge);

    // Send response back to Telegram
    await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiReply,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook Fatal]:', err);
    return NextResponse.json({ ok: true });
  }
}