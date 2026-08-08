import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, orderId, email, userId } = body;

    const uniqueCheckoutId = sessionId || orderId || `order_${Date.now()}`;

    // 1. DEDUPLICATION CHECK
    if (uniqueCheckoutId) {
      const { data: existingInstance } = await supabase
        .from('deployments')
        .select('*')
        .eq('order_id', uniqueCheckoutId)
        .maybeSingle();

      if (existingInstance) {
        return NextResponse.json({
          success: true,
          message: 'Instance already exists for this order',
          data: existingInstance,
        });
      }
    }

    // 2. Generate random security password
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // 3. Prepare payload matching deployments table schema
    const payload: Record<string, any> = {
      access_password: accessPassword,
      is_enabled: true,
      subscription_status: 'active',
      created_at: new Date().toISOString(),
    };

    if (uniqueCheckoutId) payload.order_id = uniqueCheckoutId;
    if (userId) payload.user_id = userId;

    // Insert single instance into deployments
    const { data, error } = await supabase
      .from('deployments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[Checkout DB Insert Error]:', error);
      // Fallback insertion with minimal fields if strict columns fail
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('deployments')
        .insert([{ access_password: accessPassword }])
        .select()
        .single();

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: fallbackData });
    }

    return NextResponse.json({
      success: true,
      message: 'Single instance created successfully!',
      data,
    });
  } catch (err: any) {
    console.error('[Checkout Exception]:', err);
    return NextResponse.json(
      { error: err.message || 'Checkout failed' },
      { status: 500 }
    );
  }
}