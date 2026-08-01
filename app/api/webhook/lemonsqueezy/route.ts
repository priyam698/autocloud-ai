import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data;
    const userEmail = event.data?.attributes?.user_email;

    if (eventName === 'order_created' || eventName === 'subscription_created') {
      const templateId = customData?.template_id || 'n8n-workflow';
      const containerId = `bot_${Math.random().toString(36).substring(2, 9)}`;

      // Automatically register the customer's running 24/7 bot instance
      await supabase.from('deployments').insert([
        {
          name: customData?.template_name || 'AI Agent Runner',
          template_id: templateId,
          status: 'running',
          user_email: userEmail,
          container_id: containerId,
          created_at: new Date().toISOString(),
        },
      ]);

      console.log(`[AutoCloud Webhook] Bot Instance ${containerId} provisioned for ${userEmail}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}