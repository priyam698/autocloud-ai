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
    const payload = JSON.parse(rawBody || '{}');
    const eventName = payload.meta?.event_name || '';

    // Catch all checkout and subscription success events
    const isPaymentSuccess =
      eventName === 'order_created' ||
      eventName === 'subscription_created' ||
      eventName === 'subscription_payment_success' ||
      eventName === 'order_successful';

    if (isPaymentSuccess) {
      const orderId = payload.data?.id?.toString() || payload.data?.attributes?.order_id?.toString() || '';
      const userEmail =
        payload.data?.attributes?.user_email ||
        payload.data?.attributes?.customer_email ||
        payload.data?.attributes?.billing_email ||
        'customer@store.com';

      const customData = payload.meta?.custom_data || {};
      const templateId = customData.template_id || customData.variant || 'telegram';

      const templateNames: Record<string, string> = {
        telegram: 'Telegram AI Bot',
        'telegram-ai-bot': 'Telegram AI Bot',
        slack: 'Slack AI Bot',
        'slack-ai-bot': 'Slack AI Bot',
        discord: 'Discord AI Bot',
        'discord-ai-bot': 'Discord AI Bot',
        webchat: 'Web Chat Widget',
        'webchat-ai-bot': 'Web Chat Widget',
      };

      const botDisplayName = templateNames[templateId] || 'Telegram AI Bot';
      const supabase = getSupabase();

      // 1. Check for existing order (Idempotency)
      if (orderId) {
        const { data: existing } = await supabase
          .from('deployments')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle();

        if (existing) {
          console.log(`[Webhook] Order ${orderId} already exists in database. Skipping duplicate.`);
          return NextResponse.json({ message: 'Order already processed' }, { status: 200 });
        }
      }

      // 2. Insert new deployment instance
      const accessPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

      const { data: newDeployment, error: insertError } = await supabase
        .from('deployments')
        .insert([
          {
            name: botDisplayName,
            bot_name: botDisplayName,
            template_id: templateId,
            order_id: orderId || null,
            user_email: userEmail || null,
            access_password: accessPassword,
            status: 'active',
            is_enabled: true,
            telegram_bot_token: '',
            knowledge_base: 'We assist shoppers with questions regarding our store and products.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('[Webhook DB Error]:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log(`[Webhook] Created single instance for order ${orderId}`);

      // 3. Dispatch credentials email
      if (userEmail && newDeployment) {
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
          console.log(`[Webhook] Sent password email to ${userEmail}`);
        } catch (emailErr) {
          console.error('[Webhook Email Dispatch Error]:', emailErr);
        }
      }
    }

    return NextResponse.json({ success: true, event: eventName });
  } catch (err: any) {
    console.error('[Webhook Exception]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}