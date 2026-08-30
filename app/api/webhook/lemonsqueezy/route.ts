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
    
    const orderId = payload.data?.id?.toString() || attributes.order_id?.toString() || '';
    const userEmail = attributes.user_email || attributes.customer_email || attributes.billing_email || 'customer@autocloud.ai';
    const supabase = getSupabase();

    // 1. HANDLE EXPIRATIONS OR CANCELLATIONS
    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      if (orderId) {
        await supabase
          .from('deployments')
          .update({ status: 'expired', is_enabled: false, updated_at: new Date().toISOString() })
          .eq('order_id', orderId);
      }
      return NextResponse.json({ success: true, message: 'Instance deactivated on expiration' });
    }

    // 2. HANDLE SUCCESSFUL ORDERS & SUBSCRIPTIONS
    const isPaymentSuccess =
      eventName === 'order_created' ||
      eventName === 'subscription_created' ||
      eventName === 'subscription_payment_success';

    if (isPaymentSuccess) {
      if (!orderId) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
      }

      // Strict Idempotency: Check if instance for this order already exists
      const { data: existing } = await supabase
        .from('deployments')
        .select('id, status')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing) {
        // If renewing or updating status
        await supabase
          .from('deployments')
          .update({ status: 'active', is_enabled: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        return NextResponse.json({ success: true, message: 'Order already exists. Status validated.' });
      }

      const templateId = customData.template_id || customData.variant || 'telegram';
      const templateTitles: Record<string, string> = {
        telegram: 'Telegram AI Assistant',
        slack: 'Slack Intelligence Agent',
        discord: 'Discord Community Bot',
        webchat: 'Live Web Chat Widget',
      };
      const botDisplayName = templateTitles[templateId] || 'Universal AI Bot';
      const accessPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

      // Insert exactly ONE instance
      const { data: newDeployment, error: insertError } = await supabase
        .from('deployments')
        .insert([
          {
            name: botDisplayName,
            bot_name: botDisplayName,
            template_id: templateId,
            order_id: orderId,
            user_email: userEmail,
            access_password: accessPassword,
            status: 'active',
            is_enabled: true,
            telegram_bot_token: '',
            knowledge_base: 'Primary AI knowledge base initialized. Update instructions via dashboard.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('[Webhook Supabase Error]:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Send Credentials Email
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
      } catch (e) {
        console.error('[Email Notification Error]:', e);
      }
    }

    return NextResponse.json({ success: true, event: eventName });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook internal error' }, { status: 500 });
  }
}