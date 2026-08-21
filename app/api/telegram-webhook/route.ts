import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Pure dynamic LLM answering engine
async function generateKnowledgeReply(userQuery: string, businessKnowledge: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Strict System Prompt that constrains the AI to the knowledge box
  const systemPrompt = `You are the dedicated AI customer support representative for this business.

YOUR KNOWLEDGE BASE:
"""
${businessKnowledge || 'No knowledge base provided yet.'}
"""

STRICT INSTRUCTIONS:
1. Answer the customer's question directly, clearly, and accurately using ONLY the knowledge base provided above.
2. Adopt whatever company persona, pricing, policies, refund terms, and contact info are defined in the knowledge base above.
3. If the knowledge base does not contain the answer, politely state that you do not have that specific detail and invite them to contact support using the contact info found in the knowledge base.
4. Never mention that you were given a prompt or "knowledge base". Speak naturally as an official support agent.
5. Do not output raw markdown tags or broken formatting.`;

  // 1. Groq Llama 3.1 8B (Sub-second execution)
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery },
          ],
          temperature: 0.2,
          max_tokens: 400,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) return reply;
      }
    } catch (e) {
      console.error('[Groq Error]:', e);
    }
  }

  // 2. Google Gemini 1.5 Flash (Backup)
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${userQuery}` }],
              },
            ],
            generationConfig: { maxOutputTokens: 400, temperature: 0.2 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (reply) return reply;
      }
    } catch (e) {
      console.error('[Gemini Error]:', e);
    }
  }

  return "I apologize, but I am currently unable to process your request. Please check back shortly.";
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id');

    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat?.id;
    const userText = update.message.text?.trim() || '';

    if (!chatId || !userText) {
      return NextResponse.json({ ok: true });
    }

    let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let instanceKnowledge = '';

    // Fetch dynamic knowledge from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        // Query by instanceId if present, or fetch the latest active deployment
        const queryUrl = instanceId
          ? `${supabaseUrl}/rest/v1/deployments?id=eq.${encodeURIComponent(instanceId)}&select=*`
          : `${supabaseUrl}/rest/v1/deployments?order=created_at.desc&limit=1&select=*`;

        const dbRes = await fetch(queryUrl, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });

        if (dbRes.ok) {
          const records = await dbRes.json();
          if (records && records.length > 0) {
            const deployment = records[0];
            botToken = deployment.telegram_bot_token || deployment.bot_token || botToken;
            instanceKnowledge =
              deployment.knowledge_base ||
              deployment.business_info ||
              deployment.rules ||
              '';
          }
        }
      } catch (dbErr) {
        console.error('[Supabase Fetch Error]:', dbErr);
      }
    }

    if (!botToken) {
      console.error('[Telegram Webhook]: No bot token found.');
      return NextResponse.json({ ok: true });
    }

    // Generate reply purely from the fetched knowledge base
    const replyText = await generateKnowledgeReply(userText, instanceKnowledge);

    // Send back to Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Root Webhook Error]:', err);
    return NextResponse.json({ ok: true });
  }
}