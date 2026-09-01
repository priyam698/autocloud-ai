import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    '';
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

    // 1. STRICT FILTER: Only run on 'order_created'
    if (eventName !== 'order_created') {
      return NextResponse.json({
        success: true,
        message: `Ignored event: ${eventName}`,
      });
    }

    const orderId =
      payload.data?.id?.toString() ||
      attributes.order_id?.toString() ||
      attributes.first_order_item?.order_id?.toString() ||
      '';

    const userEmail =
      attributes.user_email ||
      attributes.customer_email ||
      attributes.billing_email ||
      customData.user_email ||
      'customer@store.com';

    // 2. Prevent duplicate bot creation if webhook retries
    if (orderId) {
      const { data: existing } = await supabase
        .from('deployments')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          message: 'Order already provisioned',
        });
      }
    }

    // 3. Multi-Channel Product & Template Detection
    const firstItem = attributes.first_order_item || {};
    const itemProductName = (firstItem.product_name || attributes.product_name || '').toLowerCase();
    const itemVariantName = (firstItem.variant_name || attributes.variant_name || '').toLowerCase();
    const orderSummary = (attributes.order_summary || '').toLowerCase();

    const customTemplate = (
      customData.template_id ||
      customData.template ||
      customData.bot_type ||
      customData.type ||
      ''
    ).toLowerCase();

    let detectedTemplate = 'telegram';
    let defaultBotName = 'Telegram AI Bot';

    if (
      customTemplate.includes('widget') ||
      customTemplate.includes('web') ||
      customTemplate.includes('chat') ||
      itemProductName.includes('widget') ||
      itemProductName.includes('web') ||
      itemProductName.includes('chat') ||
      itemVariantName.includes('widget') ||
      itemVariantName.includes('web') ||
      itemVariantName.includes('chat') ||
      orderSummary.includes('widget') ||
      orderSummary.includes('web chat')
    ) {
      detectedTemplate = 'widget';
      defaultBotName = 'Web Chat AI Bot';
    } else if (
      customTemplate.includes('slack') ||
      itemProductName.includes('slack') ||
      itemVariantName.includes('slack')
    ) {
      detectedTemplate = 'slack';
      defaultBotName = 'Slack AI Bot';
    } else if (
      customTemplate.includes('discord') ||
      itemProductName.includes('discord') ||
      itemVariantName.includes('discord')
    ) {
      detectedTemplate = 'discord';
      defaultBotName = 'Discord AI Bot';
    }

    const botDisplayName = customData.bot_name || defaultBotName;
    const newBotId = crypto.randomUUID();
    const accessPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

    // 4. Insert Deployment Row into Supabase
    const { data: newDeployment, error: insertErr } = await supabase
      .from('deployments')
      .insert([
        {
          id: newBotId,
          order_id: orderId || null,
          name: botDisplayName,
          bot_name: botDisplayName,
          template_id: detectedTemplate,
          status: 'active',
          user_email: userEmail,
          access_password: accessPassword,
          telegram_bot_token: '',
          knowledge_base:
            'We assist shoppers with questions regarding our store, policies, and products.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('[Supabase Insert Error]:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 5. Send access credentials to customer email
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://autocloud-ai-p448.vercel.app';
    try {
      await fetch(`${appUrl}/api/auth/send-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userEmail,
          instanceId: newBotId,
          access_password: accessPassword,
          instanceName: botDisplayName,
        }),
      });
    } catch (emailErr) {
      console.error('[Email Error]:', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Single ${botDisplayName} provisioned successfully`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Webhook Error' },
      { status: 500 }
    );
  }
}