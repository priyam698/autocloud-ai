import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Universal Knowledge Engine: Parses ANY custom business text box dynamically
function parseDynamicKnowledge(query: string, knowledge: string): string {
  if (!knowledge || knowledge.trim().length === 0) {
    return "Thank you for reaching out! Our knowledge base is currently being updated. Please contact human support for direct assistance.";
  }

  const queryTerms = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2);
  const blocks = knowledge.split(/\n\s*\n|(?=##? )|(?=\* \*\*)/g).map(b => b.trim()).filter(Boolean);

  let bestMatch = '';
  let highestScore = 0;

  for (const block of blocks) {
    const blockText = block.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (blockText.includes(term)) {
        score += 1;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = block;
    }
  }

  if (bestMatch && highestScore > 0) {
    return bestMatch.replace(/^[#*-\s]+/, '').trim();
  }

  // If no specific section matches, return the top summary of the knowledge box
  return blocks.slice(0, 2).join('\n\n').replace(/^[#*-\s]+/, '').trim();
}

// Multi-Tier SDK Execution
async function generateAutonomousResponse(userQuery: string, businessKnowledge: string): Promise<string> {
  const cleanKnowledge = businessKnowledge?.trim() || 'Standard business support services.';
  
  const systemPrompt = `You are the dedicated AI customer support specialist for this company.
Answer the customer's query accurately, concisely, and politely using ONLY the business knowledge base below.

================ BUSINESS KNOWLEDGE BASE ================
${cleanKnowledge}
=========================================================

RULES:
1. Answer in natural, friendly conversational English.
2. Ground all pricing, cancellations, policies, and feature answers strictly in the knowledge base above.
3. If the answer cannot be found in the knowledge base, politely state that and provide the support contact email listed in the text.
4. Do not output broken markdown syntax.`;

  // 1. Primary Engine: Official Groq SDK (Llama 3.1 8B Instant)
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try {
      const groq = new Groq({ apiKey: groqKey });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.2,
        max_tokens: 350,
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      if (reply) return reply;
    } catch (groqErr) {
      console.error('[Groq SDK Execution Error]:', groqErr);
    }
  }

  // 2. Secondary Engine: Official Google Generative AI SDK (Gemini 1.5 Flash)
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1)?.trim();
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userQuery);
      const geminiReply = result.response.text()?.trim();
      if (geminiReply) return geminiReply;
    } catch (geminiErr) {
      console.error('[Gemini SDK Execution Error]:', geminiErr);
    }
  }

  // 3. Fallback: Dynamic Knowledge Parser
  return parseDynamicKnowledge(userQuery, cleanKnowledge);
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');

    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat?.id;
    const userText = update.message.text?.trim() || '';

    if (!chatId || !userText) {
      return NextResponse.json({ ok: true });
    }

    let botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_SUPPORT_BOT_TOKEN || '';
    let dynamicKnowledge = '';

    // Multi-tenant database lookup
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
            const deployment = records[0];
            botToken = deployment.telegram_bot_token || deployment.bot_token || deployment.custom_bot_token || botToken;
            dynamicKnowledge =
              deployment.knowledge_base ||
              deployment.business_info ||
              deployment.rules ||
              deployment.system_prompt ||
              '';
          }
        }
      } catch (dbErr) {
        console.error('[Supabase Knowledge Lookup Error]:', dbErr);
      }
    }

    if (!botToken) {
      console.error('[Telegram Webhook Error]: No bot token available to reply.');
      return NextResponse.json({ ok: true });
    }

    // Generate answer strictly grounded in the knowledge box
    const replyText = await generateAutonomousResponse(userText, dynamicKnowledge);

    // Send response back to Telegram
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
    console.error('[Root Telegram Webhook Fatal Error]:', fatalErr);
    return NextResponse.json({ ok: true });
  }
}