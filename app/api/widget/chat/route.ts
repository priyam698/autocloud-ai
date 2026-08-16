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
        { reply: 'How can I assist you with AutoCloud AI today?' },
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

    // 2. Strict system prompt with your custom email
    const systemPrompt = `
You are the official customer support AI agent for "${botName}".

RULES:
1. Answer in 1 to 2 concise, clear, and professional sentences.
2. PRICING: Every bot (Telegram, Slack, Discord, or Web Chat) is a flat $12/month per instance on AutoCloud AI.
3. SUPPORT & CONTACT: If the user asks for support, contact details, or further assistance, always direct them to email directly at priyamrana069@gmail.com.
4. OUT-OF-SCOPE: If asked about topics outside AutoCloud AI hosting, politely state: "I am only able to assist with questions related to AutoCloud AI services and bot hosting. For further support, contact priyamrana069@gmail.com."

KNOWLEDGE BASE:
${businessContext}
`.trim();

    // 3. Attempt Gemini API
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;

    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `${systemPrompt}\n\nUser Question: ${userMessage}\nAssistant Response:`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 120,
              },
            }),
          }
        );

        const geminiData = await geminiRes.json();
        const geminiReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (geminiReply) {
          return NextResponse.json({ reply: geminiReply }, { headers: corsHeaders });
        }
      } catch (err) {
        console.error('Gemini Fetch Failed:', err);
      }
    }

    // 4. Fallback to Groq API
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 120,
          temperature: 0.1,
        }),
      });

      const groqData = await groqRes.json();
      const groqReply = groqData.choices?.[0]?.message?.content?.trim();

      if (groqReply) {
        return NextResponse.json({ reply: groqReply }, { headers: corsHeaders });
      }
    }

    return NextResponse.json(
      { reply: 'For further support, please reach out to us at priyamrana069@gmail.com.' },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Chat Engine Error:', err);
    return NextResponse.json(
      { reply: 'For support, please contact priyamrana069@gmail.com.' },
      { headers: corsHeaders }
    );
  }
}