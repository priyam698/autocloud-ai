import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// 1. ADD THIS: Allows opening the URL in a browser for a quick status check
export async function GET() {
  return NextResponse.json(
    { message: 'Lemon Squeezy webhook endpoint is active.' },
    { status: 200 }
  );
}

// 2. YOUR POST HANDLER (WITH SIGNATURE VERIFICATION)
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // OPTIONAL BUT RECOMMENDED: Verify Lemon Squeezy HMAC Signature
    const hmac = crypto.createHmac(
      'sha256',
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET || ''
    );
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(
      req.headers.get('x-signature') || '',
      'utf8'
    );

    if (
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET &&
      (!signature.length ||
        !crypto.timingSafeEqual(digest, signature))
    ) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);

    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data;
    const userEmail = event.data?.attributes?.user_email;

    if (
      eventName === 'order_created' ||
      eventName === 'subscription_created'
    ) {
      const templateId = customData?.template_id || 'n8n-workflow';
      const containerId = `bot_${Math.random().toString(36).substring(2, 9)}`;

      // Automatically register the customer's running 24/7 bot instance
      await supabase.from('deployments').insert([
        {
          name: customData?.template_name || 'AI Agent Runner',
          template_id: templateId,
          status: 'running',
          user_email: userEmail,
          container_id: containerId,
          created_at: new Date().toISOString(),
        },
      ]);

      console.log(
        `[AutoCloud Webhook] Bot Instance ${containerId} provisioned for ${userEmail}`
      );
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}