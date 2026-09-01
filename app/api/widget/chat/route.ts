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

// Smart keyword match fallback if external AI APIs are delayed
function extractDirectAnswer(question: string, knowledge: string, botName: string): string {
  if (!knowledge || !knowledge.trim()) {
    return `Hello! I'm ${botName}. How can I assist you with our store today?`;
  }

  const qWords = question.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 2);
  const lines = knowledge.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  let bestLine = '';
  let maxMatches = 0;

  for (const line of lines) {
    const lLower = line.toLowerCase();
    let matches = 0;
    for (const word of qWords) {
      if (lLower.includes(word)) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestLine = line;
    }
  }

  if (bestLine && maxMatches > 0) {
    return bestLine.replace(/^[-*•\s]+/, '').trim();
  }

  return `Hello! How can I assist you with our products and services today?`;
}

async function askAI(userQuestion: string, knowledge: string, botName: string): Promise<string> {
  const cleanKnowledge = (knowledge || '').trim();
  const lowerQ = userQuestion.toLowerCase().trim();

  if (['hi', 'hello', 'hey', 'start', 'hola'].includes(lowerQ)) {
    return `Hello! I'm ${botName}. How can I assist you today? Feel free to ask about our products, pricing, or store policies.`;
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  const prompt = `You are ${botName}, a helpful customer support representative for our store.

STORE INFORMATION & RULES:
${cleanKnowledge || 'We assist customers with questions regarding our store, products, and policies.'}

CUSTOMER QUESTION:
"${userQuestion}"

INSTRUCTIONS:
1. Answer the customer's question directly and concisely in 1-2 polite sentences using ONLY the Store Information above.
2. State exact prices, specifications, or policies if asked.
3. If the user asks for an item not in the store rules, politely state it is not available.
4. Output ONLY the plain text reply.`;

  // 1. Google Gemini (Fast 1.5/2.0 Flash)
  if (geminiKey) {
    const geminiModels = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    for (const model of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 250 },
            }),
            signal: AbortSignal.timeout(6000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawReply) return cleanResponse(rawReply, userQuestion);
        }
      } catch (err) {
        console.warn(`[Gemini ${model} Error]:`, err);
      }
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
            max_tokens: 250,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          const rawReply = data.choices?.[0]?.message?.content?.trim();
          if (rawReply) return cleanResponse(rawReply, userQuestion);
        }
      } catch (err) {
        console.warn(`[Groq ${model} Error]:`, err);
      }
    }
  }

  // Fallback directly to the relevant rule from the database
  return extractDirectAnswer(userQuestion, cleanKnowledge, botName);
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