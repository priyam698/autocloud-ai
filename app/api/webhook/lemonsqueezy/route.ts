import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    if (event.meta.event_name === 'order_created') {
      const userEmail = event.data.attributes.user_email;
      const orderId = event.data.id;

      // 1. Generate unique Instance ID and Password
      const instanceId = crypto.randomUUID();
      const accessPassword = crypto.randomBytes(6).toString('hex'); // e.g. "a3f891b2c4e5"

      // 2. Insert into Supabase deployments table
      const { error } = await supabase.from('deployments').insert({
        id: instanceId,
        user_email: userEmail,
        status: 'running',
        template_id: 'n8n-workflow',
        access_password: accessPassword,
        container_id: `bot_${crypto.randomBytes(4).toString('hex')}`,
      });

      if (error) {
        console.error('Supabase Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 3. Send Order Confirmation Email with ID & Password
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AutoCloud AI <orders@autocloud.ai>',
          to: [userEmail],
          subject: 'AutoCloud AI - Order Confirmation & Bot Credentials',
          html: `
            <h2>Thank you for your purchase!</h2>
            <p>Your AI Agent instance has been deployed successfully.</p>
            <br/>
            <h3>🔑 Your Credentials:</h3>
            <p><strong>Instance ID:</strong> ${instanceId}</p>
            <p><strong>Access Password:</strong> ${accessPassword}</p>
            <br/>
            <p>Use these credentials on your dashboard to unlock and configure your bot.</p>
          `,
        }),
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}