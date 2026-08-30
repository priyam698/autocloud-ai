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
    
    // Always extract the root order_id / customer email
    const orderId =
      attributes.order_id?.toString() ||
      attributes.first_order_item?.order_id?.toString() ||
      payload.data?.id?.toString() ||
      '';

    const userEmail =
      attributes.user_email ||
      attributes.customer_email ||
      attributes.billing_email ||
      'customer@store.com';

    const supabase = getSupabase();

    // 1. Handle Expirations
    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      if (userEmail) {
        await supabase
          .from('deployments')
          .update({ status: 'expired', is_enabled: false })
          .eq('user_email', userEmail);
      }
      return NextResponse.json({ success: true, message: 'Deactivated on expiration' });
    }

    // 2. ONLY create a new bot instance on 'order_created'
    if (eventName === 'order_created') {
      if (!orderId) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
      }

      // Check if instance already exists
      const { data: existing } = await supabase
        .from('deployments')
        .select('id')
        .or(`order_id.eq.${orderId},user_email.eq.${userEmail}`)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, message: 'Instance already active' });
      }

      const templateId = customData.template_id || customData.variant || 'telegram';
      const botName = customData.bot_name || 'Felix';
      const accessPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

      const { data: newDeployment, error: insertError } = await supabase
        .from('deployments')
        .insert([
          {
            name: botName,
            bot_name: botName,
            template_id: templateId,
            order_id: orderId,
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

      // Send password email
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
      } catch (err) {
        console.error('[Email Error]:', err);
      }

      return NextResponse.json({ success: true, message: 'Single instance provisioned' });
    }

    // 3. For all other subscription events, acknowledge without creating duplicates
    return NextResponse.json({ success: true, ignored_event: eventName });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook Error' }, { status: 500 });
  }
}