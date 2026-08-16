import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Enable CORS so customer websites can connect
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetId = body.teamId || body.instanceId;
    const userMessage = body.message || body.userPrompt;

    if (!targetId || !userMessage) {
      return NextResponse.json(
        { error: 'teamId/instanceId and message are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fetch the instance configuration & knowledge base from Supabase
    const { data: instance, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', targetId)
      .single();

    if (error || !instance) {
      return NextResponse.json(
        { error: 'Bot instance not found or inactive.' },
        { status: 404, headers: corsHeaders }
      );
    }

    const botName = instance.name || 'AI Assistant';
    const businessContext = instance.custom_context?.trim() || '';

    // 2. Strict grounding & concise support prompt
    const systemPrompt = `
You are the official customer support AI agent for "${botName}".

MISSION & BEHAVIOR:
- Respond in a friendly, professional, and very concise manner (1 to 2 short sentences maximum).
- NEVER output generic pricing essays, disclaimers, or unprompted bulleted lists.

STRICT RULES:
1. ONLY answer based on the KNOWLEDGE BASE below.
2. If asked about pricing on AutoCloud AI, state clearly: "Every bot (Telegram, Slack, Discord, or Web Chat) is a flat $12/month per instance with 24/7 cloud hosting included."
3. If an answer cannot be found in the Knowledge Base, reply: "I don't have that specific detail right now. Please reach out to our team directly for assistance!"

KNOWLEDGE BASE:
${businessContext || 'AutoCloud AI provides instant, managed cloud hosting for Telegram, Slack, Discord, and Web Chat AI bots at $12/month per bot.'}
`.trim();

    // 3. Low temperature (0.1) stops hallucinations and makes answers exact
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 120,
      temperature: 0.1,
    });

    const reply =
      completion.choices[0]?.message?.content ||
      "I'm here to help! What questions can I answer for you?";

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Widget Chat API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}