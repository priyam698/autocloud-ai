import { NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  // 1. Mandatory header check
  if (!signature || !timestamp || !rawBody) {
    return new NextResponse('Bad request signature', { status: 401 });
  }

  // 2. Fetch deployments and registered public keys from Supabase
  let deployments: any[] = [];
  try {
    const { data } = await supabase
      .from('deployments')
      .select('*')
      .not('discord_public_key', 'is', null);

    if (data) deployments = data;
  } catch (err) {
    console.error('Error fetching deployments:', err);
  }

  const registeredKeys = deployments
    .map((d) => d.discord_public_key?.trim())
    .filter((k): k is string => Boolean(k && k.length > 0));

  // Add fallback public key if set in env
  if (process.env.DISCORD_PUBLIC_KEY) {
    registeredKeys.push(process.env.DISCORD_PUBLIC_KEY.trim());
  }

  // 3. Ed25519 Signature Verification
  let isValid = false;
  for (const key of registeredKeys) {
    try {
      if (await verifyKey(rawBody, signature, timestamp, key)) {
        isValid = true;
        break;
      }
    } catch {
      // Continue testing remaining keys
    }
  }

  if (!isValid) {
    return new NextResponse('Bad request signature', { status: 401 });
  }

  // Parse interaction payload
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 4. Respond to Discord Verification Ping (Type 1)
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 5. Handle Slash Commands (Type 2) with Real AI Answer Generation
  if (body.type === 2) {
    const userQuery = body.data?.options?.[0]?.value || 'Hello';

    // Retrieve custom context/knowledge base trained in dashboard
    const activeDeployment = deployments.find((d) => d.custom_context) || deployments[0];
    const systemContext = activeDeployment?.custom_context
      ? `You are an AI Support Agent. Use this business knowledge base to assist the user:\n\n${activeDeployment.custom_context}`
      : 'You are an AI Support Agent for AutoCloud AI. Be helpful, professional, and concise.';

    let aiResponse = '';

    // Call Groq AI API for sub-second LLM response
    try {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (groqApiKey) {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: `${systemContext}\nKeep answers clear, accurate, and structured in Markdown.` },
              { role: 'user', content: userQuery },
            ],
            max_tokens: 350,
            temperature: 0.5,
          }),
        });

        const groqData = await groqRes.json();
        aiResponse = groqData.choices?.[0]?.message?.content || '';
      }
    } catch (err) {
      console.error('Error generating AI response:', err);
    }

    // Fallback if GROQ_API_KEY is missing or fails
    if (!aiResponse) {
      aiResponse = `Hello! I received your question: "${userQuery}".\n\n*(Tip: Add your \`GROQ_API_KEY\` to Vercel Environment Variables to generate live dynamic responses!)*`;
    }

    return NextResponse.json({
      type: 4,
      data: {
        content: `🤖 **AutoCloud AI Agent:**\n\n${aiResponse}`,
      },
    });
  }

  return NextResponse.json({ type: 4, data: { content: 'Received interaction.' } });
}