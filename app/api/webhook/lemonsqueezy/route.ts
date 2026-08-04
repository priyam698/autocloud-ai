import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data || {};
    const attributes = event.data?.attributes || {};

    console.log(`[LemonSqueezy Webhook] Event: ${eventName}`);

    // Create Supabase client with Service Role Key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List of events that indicate an active order or subscription
    const allowedEvents = [
      'subscription_created',
      'subscription_payment_success',
      'order_created',
      'license_key_created',
    ];

    if (allowedEvents.includes(eventName)) {
      // 1. Extract Email safely across payload structures
      const userEmail =
        attributes.user_email ||
        attributes.customer_email ||
        customData.user_email ||
        'customer@autocloud.ai';

      // 2. Extract Template Name & ID directly from meta.custom_data or attributes
      const templateName =
        customData.template_name ||
        attributes.product_name ||
        attributes.first_order_item?.product_name ||
        'Telegram AI Bot Runner';

      const templateId =
        customData.template_id ||
        (templateName.toLowerCase().includes('n8n') ? 'n8n-workflow' : 'telegram-ai-bot');

      const instanceId = crypto.randomUUID();
      const accessPassword = crypto.randomBytes(6).toString('hex'); // Generate access password

      // 3. Insert record into Supabase 'deployments' table
      const { data, error: dbError } = await supabase
        .from('deployments')
        .insert({
          id: instanceId,
          name: templateName,
          user_email: userEmail,
          status: 'running',
          template_id: templateId,
          access_password: accessPassword,
          container_id: `bot_${crypto.randomBytes(4).toString('hex')}`,
        })
        .select();

      if (dbError) {
        console.error('[Supabase Auto-Insert Error]:', dbError);
        return NextResponse.json(
          { error: 'Database Insert Failed', details: dbError.message },
          { status: 500 }
        );
      }

      console.log(`[Success] Deployment created: ${instanceId}`);
      return NextResponse.json({
        success: true,
        message: 'Instance created successfully',
        instanceId,
        data,
      });
    }

    return NextResponse.json({ received: true, eventName });
  } catch (err: any) {
    console.error('[Webhook Exception]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}