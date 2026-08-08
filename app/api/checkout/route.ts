import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { templateId } = body;

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      console.error('Missing LemonSqueezy environment variables');
      return NextResponse.json(
        { success: false, error: 'Payment provider not configured.' },
        { status: 500 }
      );
    }

    // Call LemonSqueezy API to create a checkout session
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              custom: {
                template_id: templateId || 'telegram-ai-bot',
              },
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
                id: variantId.toString(),
              },
            },
          },
        },
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error('[LemonSqueezy Checkout Error]:', resData);
      return NextResponse.json(
        { success: false, error: resData?.errors?.[0]?.detail || 'Failed to create payment checkout' },
        { status: 500 }
      );
    }

    // Extract the payment URL from LemonSqueezy response
    const checkoutUrl = resData?.data?.attributes?.url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { success: false, error: 'No checkout URL returned from payment provider' },
        { status: 500 }
      );
    }

    // Return the real LemonSqueezy checkout URL to frontend
    return NextResponse.json({
      success: true,
      url: checkoutUrl,
      redirectUrl: checkoutUrl,
    });
  } catch (err: any) {
    console.error('[Checkout Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}