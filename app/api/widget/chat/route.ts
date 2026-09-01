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

// Resilient Fallback Parser: strictly strips all section headers
function parseKnowledgeAnswer(question: string, knowledge: string, botName: string): string {
  if (!knowledge || !knowledge.trim()) {
    return `Hello! I'm ${botName}. How can I assist you with our store today?`;
  }

  const q = question.toLowerCase();
  
  // Clean knowledge: ignore headers, dividers, and empty lines
  const cleanLines = knowledge
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || l.length <= 2) return false;
      if (l.startsWith('===') || l.startsWith('---')) return false;
      const lower = l.toLowerCase();
      if (lower.startsWith('store name:') || lower.startsWith('products & features:') || lower.startsWith('store policies')) return false;
      if (lower.endsWith(':') && l.length < 35) return false; // Exclude raw section headers
      return true;
    });

  // 1. Search for Product/Feature matches
  if (q.includes('watch')) {
    const watchLine = cleanLines.find((l) => l.toLowerCase().includes('watch'));
    if (watchLine) return watchLine.replace(/^[-*•\s]+/, '').trim();
  }
  if (q.includes('earbud') || q.includes('audio') || q.includes('headphone')) {
    const earbudLine = cleanLines.find((l) => l.toLowerCase().includes('earbud'));
    if (earbudLine) return earbudLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 2. Search for Return/Refund matches
  if (q.includes('return') || q.includes('refund') || q.includes('replace') || q.includes('guarantee')) {
    const returnLine = cleanLines.find((l) => {
      const lower = l.toLowerCase();
      return lower.includes('return') || lower.includes('refund') || lower.includes('replacement');
    });
    if (returnLine) return returnLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 3. Search for Shipping matches
  if (q.includes('ship') || q.includes('delivery') || q.includes('dispatch') || q.includes('arrive')) {
    const shipLine = cleanLines.find((l) => {
      const lower = l.toLowerCase();
      return lower.includes('shipping') || lower.includes('delivery');
    });
    if (shipLine) return shipLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 4. Search for Support/Contact matches
  if (q.includes('email') || q.includes('support') || q.includes('contact') || q.includes('help')) {
    const supportLine = cleanLines.find((l) => l.toLowerCase().includes('support') || l.toLowerCase().includes('@'));
    if (supportLine) return supportLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 5. Keyword search over non-header lines
  const qWords = q.replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 2);
  let bestLine = '';
  let maxMatches = 0;

  for (const line of cleanLines) {
    const lower = line.toLowerCase();
    let matches = 0;
    for (const w of qWords) {
      if (lower.includes(w)) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestLine = line;
    }
  }

  if (bestLine && maxMatches > 0) {
    return bestLine.replace(/^[-*•\s]+/, '').trim();
  }

  return `We assist shoppers with questions regarding our store products and policies. Please ask about a specific product or policy!`;
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

  const prompt = `You are ${botName}, a customer support representative for our store.

STORE KNOWLEDGE & POLICIES:
"""
${cleanKnowledge}
"""

CUSTOMER QUESTION:
"${userQuestion}"

INSTRUCTIONS:
1. Answer the customer directly in 1-2 polite, conversational sentences using ONLY the Store Knowledge provided above.
2. If asked about features, pricing, or policies, provide the specific details clearly.
3. If the product or question is not mentioned in the store knowledge, state politely that it is not available.
4. Output ONLY the response for the customer. Do not output raw section headings or boilerplate headers.`;

  // 1. Google Gemini
  if (geminiKey) {
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'];
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
            }),
            signal: AbortSignal.timeout(5000),
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

  // 2. Groq LLaMA
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
            temperature: 0.2,
            max_tokens: 250,
          }),
          signal: AbortSignal.timeout(4500),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return cleanResponse(reply, userQuestion);
        }
      } catch {}
    }
  }

  // 3. Fallback: Parse the exact line/rule from the knowledge base
  return parseKnowledgeAnswer(userQuestion, cleanKnowledge, botName);
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