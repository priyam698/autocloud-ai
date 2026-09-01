import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    'placeholder-key';
  return createClient(url, key, { auth: { persistSession: false } });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

function cleanResponse(raw: string, userQ: string): string {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .replace(/^[:*#>\s"-]+/, '')
    .trim();

  if (text.toLowerCase().startsWith(userQ.toLowerCase())) {
    text = text.slice(userQ.length).trim();
  }
  return text;
}

async function askAI(userQuestion: string, knowledge: string, botName: string): Promise<string> {
  const cleanKnowledge = (knowledge || '').trim();
  const lowerQ = userQuestion.toLowerCase().trim();

  if (['hi', 'hello', 'hey', 'start', 'hola'].includes(lowerQ)) {
    return `Hello! I'm ${botName}. How can I assist you today? Feel free to ask about our products, pricing, or store policies.`;
  }

  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  const prompt = `You are ${botName}, an intelligent customer support AI assistant for our store.

STORE INFORMATION, PRODUCTS & POLICIES:
"""
${cleanKnowledge || 'We assist customers with questions regarding our store, products, and policies.'}
"""

CUSTOMER QUESTION:
"${userQuestion}"

INSTRUCTIONS:
1. Answer the customer's question thoroughly, accurately, and politely strictly using the Store Information above.
2. If the customer asks about features, specifications, pricing, delivery, or policies, list all relevant details found in the Store Information.
3. If asked about an item or question that is completely absent from the store information, politely state that you do not have that information in the catalog and offer to connect them with support.
4. Respond in the exact same language the customer used.
5. Output ONLY the final response message for the customer.`;

  // 1. Google Gemini
  if (geminiKey) {
    const models = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
    ];

    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 350 },
            }),
            signal: AbortSignal.timeout(6000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (reply) return cleanResponse(reply, userQuestion);
        }
      } catch {}
    }
  }

  // 2. Groq LLaMA 3.3
  if (groqKey) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 350,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return cleanResponse(reply, userQuestion);
        }
      } catch {}
    }
  }

  return cleanKnowledge
    ? `Based on our store policies: ${cleanKnowledge.substring(0, 180)}...`
    : `Hello! I'm ${botName}. How can I assist you with our store today?`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const userMessage = (body?.message || body?.userPrompt || '').trim();
    const instanceId = body?.instanceId || body?.teamId || body?.id;

    if (!userMessage) {
      return NextResponse.json(
        { reply: 'How can I assist you today?', response: 'How can I assist you today?' },
        { headers: corsHeaders }
      );
    }

    const supabase = getSupabaseClient();
    let deployment = null;

    if (instanceId) {
      const { data } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();
      deployment = data;
    }

    if (!deployment) {
      const { data: fallback } = await supabase
        .from('deployments')
        .select('*')
        .eq('template_id', 'widget')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      deployment = fallback;
    }

    if (!deployment) {
      return NextResponse.json(
        { error: 'Bot instance not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const botName = deployment.bot_name || deployment.name || 'Store Assistant';
    const knowledge = deployment.knowledge_base || '';

    const reply = await askAI(userMessage, knowledge, botName);

    return NextResponse.json(
      {
        reply,
        response: reply,
        botName,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[Widget Chat Fatal]:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}