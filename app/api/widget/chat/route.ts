import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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

    if (!userMessage) {
      return NextResponse.json(
        { reply: 'Please provide a question so I can assist you.' },
        { headers: corsHeaders }
      );
    }

    // 1. Fetch deployment context from Supabase
    let botName = 'AutoCloud Support';
    let businessContext = 'AutoCloud AI provides instant, 1-click cloud hosting for autonomous AI agents and bots at $12/month per bot instance.';

    if (targetId) {
      const { data: instance } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (instance) {
        botName = instance.name || botName;
        if (instance.custom_context?.trim()) {
          businessContext = instance.custom_context.trim();
        }
      }
    }

    // 2. Strict system prompt guardrails
    const systemPrompt = `
You are the official customer support AI agent for "${botName}".

MISSION & RULES:
1. Answer in 1 to 2 concise, clear, and professional sentences.
2. Only answer questions based on the KNOWLEDGE BASE below.
3. PRICING: Every bot (Telegram, Slack, Discord, or Web Chat) is a flat $12/month per instance on AutoCloud AI.
4. OUT-OF-SCOPE: If asked about topics outside the knowledge base (e.g. booking flights, external tools), politely state: "I am only able to assist with questions related to AutoCloud AI services and bot hosting."

KNOWLEDGE BASE:
${businessContext}
`.trim();

    // 3. Call Google Gemini API directly
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;

    if (!geminiApiKey) {
      return NextResponse.json(
        { reply: 'Gemini API key is not configured in Vercel environment variables.' },
        { headers: corsHeaders }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userMessage }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 150,
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json();

    if (geminiData.error) {
      console.error('Gemini API Error:', geminiData.error);
      return NextResponse.json(
        { reply: "I'm having trouble processing your request right now. Please try again shortly." },
        { headers: corsHeaders }
      );
    }

    const reply =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      'How can I help you with AutoCloud AI today?';

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Widget Route Error:', err);
    return NextResponse.json(
      { reply: "I'm currently unable to connect. Please try again in a moment." },
      { headers: corsHeaders }
    );
  }
}