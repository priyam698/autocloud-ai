import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Safely parse JSON body or default to empty object
    const body = await req.json().catch(() => ({}));
    const { sessionId, orderId, userId, templateId } = body;

    const uniqueId = sessionId || orderId || `instance_${Date.now()}`;

    // 1. DEDUPLICATION CHECK: Prevent creating multiple instances for the same request
    const { data: existingInstance } = await supabase
      .from('deployments')
      .select('*')
      .eq('order_id', uniqueId)
      .maybeSingle();

    if (existingInstance) {
      return NextResponse.json({
        success: true,
        redirectUrl: '/dashboard',
        url: '/dashboard',
        data: existingInstance,
      });
    }

    // 2. Generate secure random password
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // 3. SINGLE INSERTION: Insert exactly 1 row into deployments
    const { data, error } = await supabase
      .from('deployments')
      .insert([
        {
          order_id: uniqueId,
          access_password: accessPassword,
          is_enabled: true,
          subscription_status: 'active',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[Checkout DB Insert Error]:', error);
      // Fallback: If order_id column constraint fails, try inserting minimal fields
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('deployments')
        .insert([
          {
            access_password: accessPassword,
            is_enabled: true,
            subscription_status: 'active',
          },
        ])
        .select()
        .single();

      if (fallbackError) {
        return NextResponse.json(
          { success: false, error: fallbackError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        redirectUrl: '/dashboard',
        url: '/dashboard',
        data: fallbackData,
      });
    }

    // Return success response supporting both 'url' and 'redirectUrl' frontend keys
    return NextResponse.json({
      success: true,
      redirectUrl: '/dashboard',
      url: '/dashboard',
      data,
    });
  } catch (err: any) {
    console.error('[Checkout Server Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}