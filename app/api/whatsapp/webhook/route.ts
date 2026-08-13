import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. GET Request: Meta Webhook Verification Handshake
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'autocloud_whatsapp_secret';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp Webhook Verified Successfully!');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// 2. POST Request: Handle Incoming WhatsApp Messages
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Extract message details from Meta payload
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const fromPhoneNumber = message.from; // Customer's phone number
      const userQuery = message.text?.body;  // Text message
      const phoneNumberId = value.metadata?.phone_number_id; // Bot's Phone Number ID

      // Fetch matching customer deployment from Supabase
      const { data: deployment } = await supabase
        .from('deployments')
        .select('*')
        .eq('whatsapp_phone_id', phoneNumberId)
        .single();

      const whatsappToken = deployment?.whatsapp_token || process.env.WHATSAPP_TOKEN;
      const systemContext = deployment?.custom_context
        ? `You are a WhatsApp AI Customer Support Agent. Use this business knowledge base:\n\n${deployment.custom_context}`
        : 'You are a WhatsApp AI Support Agent for AutoCloud AI. Be polite, clear, and concise.';

      if (whatsappToken && phoneNumberId) {
        // Generate AI Response using Groq LLM
        let aiResponse = '';
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
                  { 
                    role: 'system', 
                    content: `${systemContext}\nKeep answers concise and well-formatted for WhatsApp messages (use WhatsApp formatting like *bold* or _italics_ where appropriate).` 
                  },
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
          console.error('Groq Execution Error:', err);
        }

        if (!aiResponse) {
          aiResponse = `Hello! Thanks for reaching out. We received your message: "${userQuery}".`;
        }

        // Reply directly back to customer on WhatsApp via Meta Graph API
        await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: fromPhoneNumber,
            type: 'text',
            text: { body: aiResponse },
          }),
        });
      }
    }

    // Always return 200 OK to Meta
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}