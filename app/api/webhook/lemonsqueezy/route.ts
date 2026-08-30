import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody || '{}');
    const eventName = payload.meta?.event_name || '';
    const customData = payload.meta?.custom_data || {};
    const attributes = payload.data?.attributes || {};
    const supabase = getSupabase();

    // 1. Handle Expirations / Cancellations
    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      const userEmail = attributes.user_email || attributes.customer_email || attributes.billing_email;
      if (userEmail) {
        await supabase
          .from('deployments')
          .update({ status: 'expired', is_enabled: false })
          .eq('user_email', userEmail);
      }
      return NextResponse.json({ success: true, message: 'Subscription expired/cancelled handled.' });
    }

    // 2. CRITICAL: ONLY process 'order_created'. Ignore 'subscription_created' to prevent 2 instances!
    if (eventName !== 'order_created') {
      return NextResponse.json({ success: true, message: `Ignored event '${eventName}' to prevent duplicates.` });
    }

    const orderId = payload.data?.id?.toString() || attributes.order_id?.toString() || '';
    const userEmail =
      attributes.user_email ||
      attributes.customer_email ||
      attributes.billing_email ||
      'customer@store.com';

    // 3. Strict Idempotency Check
    if (orderId) {
      const { data: existingOrder } = await supabase
        .from('deployments')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existingOrder) {
        return NextResponse.json({ success: true, message: 'Order already processed.' });
      }
    }

    const botDisplayName = customData.bot_name || 'Felix';
    const templateId = customData.template_id || customData.variant || 'telegram';
    const accessPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

    // 4. Insert strictly ONE bot row
    const { data: newDeployment, error: insertError } = await supabase
      .from('deployments')
      .insert([
        {
          name: botDisplayName,
          bot_name: botDisplayName,
          template_id: templateId,
          order_id: orderId || null,
          user_email: userEmail,
          access_password: accessPassword,
          status: 'active',
          is_enabled: true,
          telegram_bot_token: '',
          knowledge_base: 'We assist shoppers with questions regarding our store and products.',
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('[Supabase Insert Error]:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 5. Send Credentials Email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
    try {
      await fetch(`${appUrl}/api/auth/send-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userEmail,
          instanceId: newDeployment.id,
          access_password: accessPassword,
          instanceName: newDeployment.name,
        }),
      });
    } catch (emailErr) {
      console.error('[Email Dispatch Error]:', emailErr);
    }

    return NextResponse.json({ success: true, message: 'Strict single instance created.' });
  } catch (err: any) {
    console.error('[Webhook Error]:', err);
    return NextResponse.json({ error: err.message || 'Webhook Error' }, { status: 500 });
  }
}