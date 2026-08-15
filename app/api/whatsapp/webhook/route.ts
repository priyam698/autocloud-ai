import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processCustomerMessage } from '@/lib/ai-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'autocloud_meta_verify_token';

// 1. GET Request: Meta Webhook Verification Handshake
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp Webhook Verified Successfully!');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// 2. POST Request: Incoming Customer Messages
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryTeamId = searchParams.get('teamId') || 'T0BQ21MN7FV';

    const body = await req.json();

    // Check if this is a WhatsApp message event
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      // Return 200 OK so Meta doesn't retry delivery for non-text events (delivery receipts, status updates)
      return NextResponse.json({ status: 'ignored' });
    }

    const fromNumber = message.from; // Customer's phone number
    const userText = message.text.body;
    const phoneNumberId = value.metadata?.phone_number_id;

    // Fetch instance credentials if stored in database
    let accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (supabase) {
      const { data } = await supabase
        .from('integrations')
        .select('whatsapp_token, whatsapp_phone_id')
        .eq('team_id', queryTeamId)
        .maybeSingle();

      if (data?.whatsapp_token) {
        accessToken = data.whatsapp_token;
      }
    }

    if (!accessToken || !phoneNumberId) {
      console.error('Missing WhatsApp Access Token or Phone Number ID');
      return NextResponse.json({ status: 'missing_credentials' });
    }

    // Call Central AI Engine (Maintains multi-turn context per customer phone number)
    const reply = await processCustomerMessage({
      teamId: queryTeamId,
      platform: 'whatsapp',
      sessionId: `wa_${fromNumber}`,
      userPrompt: userText,
    });

    // Send AI reply back via Meta WhatsApp Graph API
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fromNumber,
        type: 'text',
        text: { body: reply },
      }),
    });

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error('WhatsApp Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}