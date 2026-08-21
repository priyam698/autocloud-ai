import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 1. Instant Text Reader: Parses answers directly from whatever text is in the box
function extractAnswerDirectly(question: string, rawKnowledge: string): string {
  if (!rawKnowledge || rawKnowledge.trim().length === 0) {
    return 'Please contact our support team directly for details on this inquiry.';
  }

  const cleanText = rawKnowledge.trim();
  const qTerms = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

  const sections = cleanText
    .split(/\n\n+|(?=## )|(?=\* )/)
    .map(s => s.replace(/^[#*-\s]+/, '').trim())
    .filter(s => s.length > 5);

  let bestSection = '';
  let highestMatch = 0;

  for (const section of sections) {
    const sLower = section.toLowerCase();
    let matches = 0;
    for (const term of qTerms) {
      if (sLower.includes(term)) matches += 2;
    }
    if (matches > highestMatch) {
      highestMatch = matches;
      bestSection = section;
    }
  }

  if (bestSection && highestMatch > 0) {
    return bestSection;
  }

  return sections.slice(0, 2).join('\n\n');
}

// 2. Groq AI Inference Engine
async function getGroqAnswer(userMessage: string, knowledgeText: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = `You are the official dedicated AI customer support assistant.
Answer the customer's question clearly, accurately, and politely using ONLY the business knowledge base below.

================ CUSTOMER BUSINESS KNOWLEDGE ================
${knowledgeText}
============================================================

RULES:
1. Ground all answers (pricing, cancellation, policies, features) strictly in the knowledge provided above.
2. If information is not in the knowledge base, state that you do not have that specific detail and refer to the support contact.
3. Answer naturally in 1-3 conversational sentences.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 350,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    }
  } catch (err) {
    console.error('[Groq Fetch Error]:', err);
  }

  return null;
}

// 3. Webhook Entry Point
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
    const userMessage = update.message.text?.trim() || '';

    if (!chatId || !userMessage) {
      return NextResponse.json({ ok: true });
    }

    let botToken = tokenParam || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let customerKnowledge = '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        let queryUrl = `${supabaseUrl}/rest/v1/deployments?select=*`;
        if (instanceId) {
          queryUrl += `&id=eq.${encodeURIComponent(instanceId)}`;
        } else if (botToken) {
          queryUrl += `&or=(telegram_bot_token.eq.${encodeURIComponent(botToken)},bot_token.eq.${encodeURIComponent(botToken)})`;
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
            botToken = row.telegram_bot_token || row.bot_token || row.custom_bot_token || botToken;
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

    if (!botToken) {
      return NextResponse.json({ ok: true });
    }

    // Step A: Generate via Groq AI
    let finalAnswer = await getGroqAnswer(userMessage, customerKnowledge);

    // Step B: Direct knowledge extractor fallback (Guarantees zero-failure answering)
    if (!finalAnswer) {
      finalAnswer = extractAnswerDirectly(userMessage, customerKnowledge);
    }

    // Send response to Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: finalAnswer,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: true });
  }
}