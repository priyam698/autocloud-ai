import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    const eventName = event.meta?.event_name;
    console.log('Received Lemon Squeezy Event:', eventName);

    // Trigger deployment creation on ANY purchase/subscription event
    if (
      eventName === 'order_created' ||
      eventName === 'subscription_created' ||
      eventName === 'subscription_payment_success'
    ) {
      const userEmail =
        event.data?.attributes?.user_email ||
        event.data?.attributes?.customer_email ||
        'customer@autocloud.ai';

      const customName =
        event.data?.attributes?.first_order_item?.product_name ||
        'Telegram AI Bot Runner';

      const instanceId = crypto.randomUUID();
      const accessPassword = crypto.randomBytes(6).toString('hex');

      // Insert deployment into Supabase
      const { data, error } = await supabase.from('deployments').insert({
        id: instanceId,
        name: customName,
        user_email: userEmail,
        status: 'running',
        template_id: 'telegram-ai-bot',
        access_password: accessPassword,
        container_id: `bot_${crypto.randomBytes(4).toString('hex')}`,
      });

      if (error) {
        console.error('Supabase Insert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('Successfully created deployment:', instanceId);
      return NextResponse.json({ success: true, instanceId });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Route Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}