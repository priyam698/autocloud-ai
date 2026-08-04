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

    console.log(`[LemonSqueezy Webhook] Processing event: ${eventName}`);

    // Create Supabase client with Service Role Key to bypass RLS policies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List of events that indicate a completed payment/subscription
    const allowedEvents = [
      'order_created',
      'subscription_created',
      'subscription_payment_success',
      'license_key_created',
    ];

    if (allowedEvents.includes(eventName)) {
      // Extract Email safely across all Lemon Squeezy webhook schemas
      const userEmail =
        attributes.user_email ||
        attributes.customer_email ||
        attributes.user_email_address ||
        customData.user_email ||
        'customer@autocloud.ai';

      // Extract Product/Service Name safely
      const productName =
        attributes.first_order_item?.product_name ||
        attributes.product_name ||
        attributes.billing_reason ||
        'Telegram AI Bot Runner';

      // Determine template ID based on product title
      let templateId = 'telegram-ai-bot';
      if (productName.toLowerCase().includes('n8n')) {
        templateId = 'n8n-workflow';
      }

      const instanceId = crypto.randomUUID();
      const accessPassword = crypto.randomBytes(6).toString('hex');

      // Perform insertion into Supabase
      const { data, error: dbError } = await supabase
        .from('deployments')
        .insert({
          id: instanceId,
          name: productName,
          user_email: userEmail,
          status: 'running',
          template_id: templateId,
          access_password: accessPassword,
          container_id: `bot_${crypto.randomBytes(4).toString('hex')}`,
        })
        .select();

      if (dbError) {
        console.error('[Supabase Insert Error]:', dbError);
        // Returning 500 forces Lemon Squeezy to display the error text in the Response box
        return NextResponse.json(
          { error: 'Database Insert Failed', details: dbError.message },
          { status: 500 }
        );
      }

      console.log('[Webhook Success] Instance Created:', instanceId);
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