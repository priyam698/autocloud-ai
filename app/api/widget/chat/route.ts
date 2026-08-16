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
    const userMessage = (body.message || body.userPrompt || '').trim();
    const chatHistory = Array.isArray(body.history) ? body.history.slice(-6) : [];

    if (!targetId || !userMessage) {
      return NextResponse.json(
        { error: 'Missing required parameters (teamId/instanceId and message).' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fetch bot configuration and scraped knowledge base
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

    const botName = instance.name || 'AutoCloud Assistant';
    const businessContext = instance.custom_context?.trim() || '';

    // 2. Enterprise System Prompt Guardrails
    const systemPrompt = `
You are the official, elite AI Customer Support Specialist for "${botName}".

CORE OPERATING DIRECTIVES:
1. BREVITY & CLARITY: Keep every response between 1 to 3 direct, natural sentences. Never output long essays, generic markdown lists, or unnecessary filler phrases (e.g., "Sure, I can help with that!").
2. ABSOLUTE GROUNDING: Only state facts, features, and policies explicitly documented in the KNOWLEDGE BASE below.
3. PRICING RULES: All AI bots on AutoCloud AI (Telegram, Slack, Discord, Web Chat) are a flat $12/month per bot instance with 24/7 managed cloud uptime. Never invent tier structures or per-user costs.
4. ELEGANT ESCALATION: If the user asks something outside the Knowledge Base, respond politely: "I don't have those specific details on file right now. Please reach out to our team at support@autocloud.ai and we'll assist you immediately."

KNOWLEDGE BASE:
${businessContext || 'AutoCloud AI provides instant, 1-click cloud hosting for autonomous AI agents and bots at $12/month.'}
`.trim();

    // 3. Assemble message payload with conversation memory
    const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map((msg: { role: string; content: string }) => ({
        role: (msg.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // 4. Low temperature for deterministic, factual output
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: formattedMessages,
      max_tokens: 150,
      temperature: 0.1,
      presence_penalty: 0.0,
      frequency_penalty: 0.2,
    });

    const reply =
      completion.choices[0]?.message?.content ||
      "Hello! How can I assist you with AutoCloud AI today?";

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Widget Chat API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}