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

    console.log(`[LemonSqueezy Webhook] Received Event: ${eventName}`);

    // Initialize Supabase using Service Role Key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List of events to trigger deployment creation
    const validEvents = [
      'order_created',
      'subscription_created',
      'subscription_payment_success',
      'license_key_created'
    ];

    if (validEvents.includes(eventName)) {
      // Robust extraction across different Lemon Squeezy payload types
      const userEmail = 
        attributes.user_email || 
        attributes.customer_email || 
        attributes.user_email_address || 
        customData.user_email || 
        'customer@autocloud.ai';

      const productName = 
        attributes.first_order_item?.product_name || 
        attributes.product_name || 
        attributes.user_name || 
        'Telegram AI Bot Runner';

      // Map template dynamically based on product name
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
        return NextResponse.json({ error: dbError.message, details: dbError }, { status: 500 });
      }

      console.log('[Webhook Success] Instance Auto-Created:', instanceId);
      return NextResponse.json({ success: true, instanceId, data });
    }

    return NextResponse.json({ received: true, eventName });
  } catch (err: any) {
    console.error('[Webhook Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}