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

// Intelligent Semantic Rule Parser (Isolates exact answers without dumping headers)
function parseKnowledgeAnswer(question: string, knowledge: string, botName: string): string {
  if (!knowledge || !knowledge.trim()) {
    return `Hello! I'm ${botName}. How can I assist you with our store today?`;
  }

  const q = question.toLowerCase();
  const lines = knowledge
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('===') && !l.startsWith('---'));

  // 1. Check for Feature questions
  if (q.includes('feature') || q.includes('spec') || q.includes('what does it have') || q.includes('details')) {
    const matchingLine = lines.find((l) => {
      const lower = l.toLowerCase();
      return (q.includes('watch') && lower.includes('watch')) ||
             (q.includes('earbud') && lower.includes('earbud')) ||
             (q.includes('ring') && lower.includes('ring')) ||
             lower.includes('feature');
    });
    if (matchingLine) {
      return matchingLine.replace(/^[-*•\s]+/, '').replace(/^store name:.*$/i, '').trim();
    }
  }

  // 2. Check for Return / Refund questions
  if (q.includes('return') || q.includes('refund') || q.includes('exchange') || q.includes('money back')) {
    const returnLine = lines.find((l) => {
      const lower = l.toLowerCase();
      return lower.includes('return') || lower.includes('refund') || lower.includes('guarantee');
    });
    if (returnLine) return returnLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 3. Check for Shipping / Delivery questions
  if (q.includes('shipping') || q.includes('delivery') || q.includes('ship') || q.includes('arrive') || q.includes('track')) {
    const shippingLine = lines.find((l) => {
      const lower = l.toLowerCase();
      return lower.includes('shipping') || lower.includes('delivery') || lower.includes('dispatch');
    });
    if (shippingLine) return shippingLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 4. Check for Pricing / Cost questions
  if (q.includes('price') || q.includes('cost') || q.includes('how much') || q.includes('rate') || q.includes('$') || q.includes('₹')) {
    const priceLine = lines.find((l) => {
      const lower = l.toLowerCase();
      return (
        (q.includes('watch') && lower.includes('watch')) ||
        (q.includes('earbud') && lower.includes('earbud')) ||
        lower.includes('$') ||
        lower.includes('₹')
      );
    });
    if (priceLine) return priceLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 5. Check for Contact / Support questions
  if (q.includes('email') || q.includes('contact') || q.includes('support') || q.includes('help') || q.includes('reach')) {
    const contactLine = lines.find((l) => l.toLowerCase().includes('email') || l.toLowerCase().includes('support') || l.toLowerCase().includes('@'));
    if (contactLine) return contactLine.replace(/^[-*•\s]+/, '').trim();
  }

  // 6. Keyword Best-Match Filter
  const qWords = q.replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 2);
  let bestLine = '';
  let maxMatches = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('store name:') || lower.startsWith('products & features:')) continue;
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

  return `Hello! How can I assist you with our store products or policies today?`;
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

  const prompt = `You are ${botName}, a customer support AI assistant for our store.

STORE INFORMATION & RULES:
"""
${cleanKnowledge || 'We assist customers with questions regarding our store, products, and policies.'}
"""

CUSTOMER QUESTION:
"${userQuestion}"

INSTRUCTIONS:
1. Answer the customer's question directly, clearly, and politely in 1-2 sentences using strictly the Store Information above.
2. If asked about features, list the exact features from the store knowledge.
3. If asked about prices, delivery, or return policies, state the exact policy terms.
4. Output ONLY the response text for the customer without any meta-talk or raw section titles.`;

  // 1. Google Gemini
  if (geminiKey) {
    const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
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

    const botName = deployment.bot_name || deployment.name || 'Store Support';
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