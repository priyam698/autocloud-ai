import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const eventName = payload.meta?.event_name;

    // Only process order creation events
    if (eventName === 'order_created') {
      const orderId = payload.data?.id?.toString();
      const customData = payload.meta?.custom_data || {};
      const templateId = customData.template_id || 'telegram-ai-bot';

      // 1. IDEMPOTENCY CHECK: If an instance for this order_id already exists, stop here!
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

      // 2. Insert ONLY ONE instance
      const accessPassword = crypto.randomBytes(6).toString('hex');
      const { error } = await supabase.from('deployments').insert([
        {
          name: 'Telegram AI Bot Runner',
          template_id: templateId,
          order_id: orderId || null,
          access_password: accessPassword,
          is_enabled: true,
        },
      ]);

      if (error) {
        console.error('[Webhook DB Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`[Webhook] Created single instance for order ${orderId}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Webhook Exception]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}