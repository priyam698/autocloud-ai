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

    // Use sessionId or orderId as a unique key for deduplication
    const uniqueCheckoutId = sessionId || orderId;

    // 1. DEDUPLICATION CHECK
    // If a unique checkout ID is passed, check if an instance already exists for it
    if (uniqueCheckoutId) {
      const { data: existingInstance } = await supabase
        .from('deployments')
        .select('*')
        .eq('order_id', uniqueCheckoutId)
        .maybeSingle();

      // If it already exists, return the existing instance immediately (NO NEW CREATION)
      if (existingInstance) {
        return NextResponse.json({
          success: true,
          message: 'Instance already exists for this order',
          data: existingInstance,
        });
      }
    }

    // 2. Generate security password for the instance
    const accessPassword = crypto.randomBytes(6).toString('hex'); // 12-character random string

    // 3. SINGLE INSERTION into Supabase
    const { data, error } = await supabase
      .from('deployments')
      .insert([
        {
          order_id: uniqueCheckoutId || null,
          user_id: userId || null,
          access_password: accessPassword,
          is_enabled: true,
          subscription_status: 'active',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[Checkout Error]:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
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