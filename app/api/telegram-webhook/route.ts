import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Telemetry & Execution Log Interface
interface TelemetryRecord {
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
}

// 1. System Prompt Builder with Enterprise Directives
function buildSystemDirective(knowledge: string): string {
  return `You are Felix, the Senior Solutions Specialist and dedicated AI agent for AutoCloud AI.
Your task is to provide clear, helpful, and accurate answers to customer inquiries based strictly on the Business Knowledge Base provided below.

================ BUSINESS KNOWLEDGE BASE ================
${knowledge || 'AutoCloud AI provides autonomous zero-downtime AI agent hosting, multi-channel webhook infrastructure, and one-click website training.'}
=========================================================

OPERATING GUIDELINES & POLICIES:
1. Grounding: Answer strictly using verified details from the knowledge base above. Never fabricate nonexistent features, pricing plans, or terms.
2. Tone: Professional, authoritative, concise, and courteous in natural conversational English.
3. Cancellations: If the customer asks about cancellation, explain that subscriptions can be cancelled anytime via their billing dashboard, keeping the instance active until the end of the billing period.
4. Refunds: If asked about refunds, clarify strictly that all sales are final once instance compute and credentials have been provisioned.
5. Pricing: Standard dedicated instances are billed at $12.00 / month flat.
6. Escalations: For unresolved billing issues, password resets, or API key disputes, direct the customer to contact human support at priyamrana069@gmail.com with their Instance ID.
7. Formatting: Do not output malformed markdown, unclosed bold brackets, or raw code tags.`;
}

// 2. Primary Engine: Groq Llama 3.1 8B Instant (Ultra-Low Latency)
async function callGroq8B(userQuery: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Waterfall Tier 1 - Groq 8B Failed]:', err);
  }
  return null;
}

// 3. Secondary Engine: Cerebras Llama 3.1 8B/70B (High-Speed Inference)
async function callCerebras(userQuery: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Waterfall Tier 2 - Cerebras Failed]:', err);
  }
  return null;
}

// 4. Tertiary Engine: Google Gemini 1.5 Flash (Deep Context)
async function callGeminiFlash(userQuery: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nUser Question: ${userQuery}` }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.2,
          },
        }),
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Waterfall Tier 3 - Gemini Flash Failed]:', err);
  }
  return null;
}

// 5. Quaternary Engine: Groq Llama 3.3 70B Versatile (Heavy Reasoning)
async function callGroq70B(userQuery: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Waterfall Tier 4 - Groq 70B Failed]:', err);
  }
  return null;
}

// 6. Waterfall Orchestrator
async function executeMultiProviderWaterfall(userQuery: string, knowledge: string): Promise<string> {
  const systemPrompt = buildSystemDirective(knowledge);
  const startTime = Date.now();

  // Tier 1: Groq 8B
  const groq8bReply = await callGroq8B(userQuery, systemPrompt);
  if (groq8bReply) {
    console.log(`[Waterfall Success] Tier 1: Groq 8B resolved in ${Date.now() - startTime}ms`);
    return groq8bReply;
  }

  // Tier 2: Cerebras
  const cerebrasReply = await callCerebras(userQuery, systemPrompt);
  if (cerebrasReply) {
    console.log(`[Waterfall Success] Tier 2: Cerebras resolved in ${Date.now() - startTime}ms`);
    return cerebrasReply;
  }

  // Tier 3: Gemini 1.5 Flash
  const geminiReply = await callGeminiFlash(userQuery, systemPrompt);
  if (geminiReply) {
    console.log(`[Waterfall Success] Tier 3: Gemini Flash resolved in ${Date.now() - startTime}ms`);
    return geminiReply;
  }

  // Tier 4: Groq 70B Versatile
  const groq70bReply = await callGroq70B(userQuery, systemPrompt);
  if (groq70bReply) {
    console.log(`[Waterfall Success] Tier 4: Groq 70B resolved in ${Date.now() - startTime}ms`);
    return groq70bReply;
  }

  // Tier 5: Safe Synthetic Fallback
  console.warn(`[Waterfall Warning] All 4 LLM providers exhausted. Returning graceful degradation.`);
  return "I am currently updating my knowledge base. Please ask your question again in a few moments, or reach out to our human support team at priyamrana069@gmail.com.";
}

// 7. Root Webhook POST Handler
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

    // Default Multi-Tenant Tokens
    let customerBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let instanceKnowledge = '';

    // Multi-Tenant Isolation: Query Database for instance specific token & knowledge
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && instanceId) {
      try {
        const dbRes = await fetch(
          `${supabaseUrl}/rest/v1/deployments?id=eq.${encodeURIComponent(instanceId)}&select=*`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );

        if (dbRes.ok) {
          const records = await dbRes.json();
          if (records && records.length > 0) {
            const deployment = records[0];
            customerBotToken =
              deployment.telegram_bot_token ||
              deployment.bot_token ||
              deployment.custom_bot_token ||
              customerBotToken;
            instanceKnowledge =
              deployment.knowledge_base ||
              deployment.business_info ||
              deployment.rules ||
              deployment.system_prompt ||
              '';
          }
        }
      } catch (dbErr) {
        console.error('[Supabase Multi-Tenant Lookup Error]:', dbErr);
      }
    }

    if (!customerBotToken) {
      console.error('[Telegram Webhook Error]: No active bot token found for this instance.');
      return NextResponse.json({ ok: true });
    }

    // Execute Multi-Tier AI Generation
    const replyText = await executeMultiProviderWaterfall(userText, instanceKnowledge);

    // Dispatch Message to Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${customerBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    if (!tgRes.ok) {
      const tgErr = await tgRes.json().catch(() => ({}));
      console.error('[Telegram Send Failed]:', tgErr);
    }

    return NextResponse.json({ ok: true });
  } catch (fatalErr: any) {
    console.error('[Root Telegram Webhook Fatal Error]:', fatalErr);
    return NextResponse.json({ ok: true });
  }
}