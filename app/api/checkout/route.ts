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
    const { sessionId, orderId, userId } = body;

    const uniqueCheckoutId = sessionId || orderId || `order_${Date.now()}`;

    // 1. Check if an instance already exists for this order to prevent duplicates
    if (uniqueCheckoutId) {
      const { data: existingInstance } = await supabase
        .from('deployments')
        .select('*')
        .eq('order_id', uniqueCheckoutId)
        .maybeSingle();

      if (existingInstance) {
        return NextResponse.json({
          success: true,
          url: '/dashboard',
          message: 'Instance already exists',
          data: existingInstance,
        });
      }
    }

    // 2. Generate random security password
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // 3. Insert exactly ONE instance into deployments
    const { data, error } = await supabase
      .from('deployments')
      .insert([
        {
          order_id: uniqueCheckoutId,
          access_password: accessPassword,
          is_enabled: true,
          subscription_status: 'active',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[Checkout DB Error]:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Return success response formatted for frontend expectations
    return NextResponse.json({
      success: true,
      url: '/dashboard',
      instanceId: data?.id,
      data,
    });
  } catch (err: any) {
    console.error('[Checkout Route Exception]:', err);
    return NextResponse.json(
      { error: err.message || 'Checkout failed' },
      { status: 500 }
    );
  }
}