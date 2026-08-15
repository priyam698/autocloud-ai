import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processCustomerMessage } from '@/lib/ai-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'autocloud_meta_verify_token';

// 1. GET: Meta Webhook Handshake Verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Meta DM Webhook Verified Successfully!');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// 2. POST: Handle Incoming Facebook Messenger & Instagram Direct Messages
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryTeamId = searchParams.get('teamId') || 'T0BQ21MN7FV';

    const body = await req.json();

    if (body.object !== 'page' && body.object !== 'instagram') {
      return NextResponse.json({ status: 'ignored' });
    }

    const entry = body.entry?.[0];
    const messagingEvent = entry?.messaging?.[0];

    // Ignore read receipts, delivery confirmations, or echo messages from the page itself
    if (!messagingEvent || !messagingEvent.message || messagingEvent.message.is_echo || !messagingEvent.message.text) {
      return NextResponse.json({ status: 'ignored' });
    }

    const senderId = messagingEvent.sender.id;
    const userText = messagingEvent.message.text;

    // Fetch page access token from Supabase for this workspace
    let pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (supabase) {
      const { data } = await supabase
        .from('integrations')
        .select('meta_page_token')
        .eq('team_id', queryTeamId)
        .maybeSingle();

      if (data?.meta_page_token) {
        pageAccessToken = data.meta_page_token;
      }
    }

    if (!pageAccessToken) {
      console.error('No Meta Page Access Token found for team:', queryTeamId);
      return NextResponse.json({ status: 'missing_token' });
    }

    // Call Central AI Engine (Maintains multi-turn context per senderId)
    const reply = await processCustomerMessage({
      teamId: queryTeamId,
      platform: 'meta_dm',
      sessionId: `meta_${senderId}`,
      userPrompt: userText,
    });

    // Send response back via Meta Graph API
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: reply },
      }),
    });

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error('Meta DM Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}