import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    '';
  return createClient(url, key);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

async function askAI(
  userQuestion: string,
  knowledge: string,
  botName: string
): Promise<string> {
  const cleanKnowledge = (knowledge || '').trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  const prompt = `You are ${botName}, an intelligent customer support assistant.

STORE KNOWLEDGE & POLICIES:
${cleanKnowledge || 'We assist shoppers with inquiries regarding our store, products, and policies.'}

CUSTOMER QUESTION:
"${userQuestion}"

INSTRUCTIONS:
1. Answer directly in 1-2 polite, helpful sentences strictly using the Store Knowledge above.
2. If the question asks for something not mentioned in the store knowledge, state clearly that it is not available or ask them to email support at priyamrana069@gmail.com.
3. Match the exact language of the customer.
4. Output only the final response for the customer.`;

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
          }),
          signal: AbortSignal.timeout(6000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (reply) return reply;
      }
    } catch {}
  }

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 250,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) return reply;
      }
    } catch {}
  }

  return cleanKnowledge
    ? `According to our store guidelines: ${cleanKnowledge}`
    : `Hello! I'm ${botName}. How can I assist you today?`;
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

    const supabase = getSupabase();
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

    if (
      deployment.status === 'expired' ||
      (deployment.expires_at && new Date(deployment.expires_at) < new Date())
    ) {
      return NextResponse.json(
        { reply: '⚠️ This chat widget subscription has expired.', response: '⚠️ This chat widget subscription has expired.' },
        { headers: corsHeaders }
      );
    }

    const botName = deployment.bot_name || deployment.name || 'AutoCloud Support';
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
    console.error('[Widget Chat API Error]:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}