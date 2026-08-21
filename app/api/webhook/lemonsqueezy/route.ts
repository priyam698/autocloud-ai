import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    // Verify LemonSqueezy Signature if secret exists
    if (secret) {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
      const signatureHeader = req.headers.get('x-signature') || '';
      const signature = Buffer.from(signatureHeader, 'utf8');

      if (signature.length !== digest.length || !crypto.timingSafeEqual(digest, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody || '{}');
    const eventName = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const supabase = getSupabase();

    // Handle Subscription & Order Activation
    if (
      eventName === 'order_created' ||
      eventName === 'subscription_created' ||
      eventName === 'subscription_updated'
    ) {
      const instanceId = customData.instance_id || customData.instanceId;
      const userEmail = attributes.user_email || attributes.customer_email;
      const status = attributes.status || 'active';

      if (instanceId) {
        await supabase
          .from('deployments')
          .update({
            status: status === 'active' || status === 'paid' ? 'active' : status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', instanceId);
      }
    }

    return NextResponse.json({ success: true, event: eventName });
  } catch (err: any) {
    console.error('[LemonSqueezy Webhook Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}