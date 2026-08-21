import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

async function generateAIAnswer(question: string, knowledge: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const cleanKnowledge = knowledge?.trim() || 'AutoCloud AI provides automated customer support bots.';

  if (!apiKey) {
    return cleanKnowledge.slice(0, 300);
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are the official dedicated AI support assistant for this business. Answer the customer inquiry accurately and concisely using ONLY this knowledge base:\n\n${cleanKnowledge}\n\nRules:\n- Ground all pricing, cancellations, refunds, and feature answers in the knowledge above.\n- If not present, state you do not have that info and refer to human support.\n- Keep replies under 3 sentences.`,
          },
          { role: 'user', content: question },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || 'No response generated.';
    }
  } catch (err) {
    console.error('[Discord AI Error]:', err);
  }

  return cleanKnowledge.slice(0, 300);
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: true });
    }

    // 1. Handle Discord PING (Type 1) Handshake
    if (body.type === 1) {
      return NextResponse.json({ type: 1 });
    }

    // 2. Extract Message Details (Slash Command or Direct Message)
    const userMessage =
      body.data?.options?.[0]?.value ||
      body.data?.name ||
      body.content ||
      body.message?.content ||
      '';

    if (!userMessage) {
      return NextResponse.json({
        type: 4,
        data: { content: 'Please provide a valid question or message.' },
      });
    }

    // 3. Look up Customer Knowledge Base from Supabase
    const supabase = getSupabase();
    let dynamicKnowledge = '';

    try {
      const query = instanceId
        ? supabase.from('deployments').select('*').eq('id', instanceId).maybeSingle()
        : supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();

      const { data: deployment } = await query;
      if (deployment) {
        dynamicKnowledge =
          deployment.knowledge_base ||
          deployment.business_knowledge ||
          deployment.business_info ||
          deployment.rules ||
          deployment.system_prompt ||
          '';
      }
    } catch (dbErr) {
      console.error('[Discord DB Lookup Error]:', dbErr);
    }

    // 4. Generate AI Response
    const replyText = await generateAIAnswer(userMessage, dynamicKnowledge);

    // 5. Respond back to Discord Interaction (Type 4: ChannelMessageWithSource)
    return NextResponse.json({
      type: 4,
      data: {
        content: replyText,
      },
    });
  } catch (fatalErr: any) {
    console.error('[Discord Webhook Fatal]:', fatalErr);
    return NextResponse.json(
      { type: 4, data: { content: 'An internal error occurred while processing your request.' } },
      { status: 200 }
    );
  }
}