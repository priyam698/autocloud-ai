import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const { variantId, customData, userEmail } = body;

    const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
    const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();

    if (!apiKey || !storeId) {
      return NextResponse.json({
        success: true,
        url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard?status=mock_checkout_success`,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard?status=mock_checkout_success`,
      });
    }

    const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: userEmail || undefined,
              custom: customData || {},
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId.toString(),
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: (variantId || process.env.LEMONSQUEEZY_VARIANT_ID || '1').toString(),
              },
            },
          },
        },
      }),
    });

    const resData = await res.json().catch(() => null);
    const checkoutUrl = resData?.data?.attributes?.url;

    return NextResponse.json({
      success: true,
      url: checkoutUrl || '/dashboard',
      redirectUrl: checkoutUrl || '/dashboard',
    });
  } catch (err: any) {
    console.error('[Checkout Server Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}