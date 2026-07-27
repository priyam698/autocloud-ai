import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { templateName } = await req.json();
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      return NextResponse.json(
        { error: 'Missing Lemon Squeezy credentials in .env.local' },
        { status: 500 }
      );
    }

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
                template_name: templateName,
              },
            },
            product_options: {
              name: `AutoCloud AI: ${templateName}`,
              receipt_button_text: 'Go to Dashboard',
              redirect_url: 'http://localhost:3000/?success=true',
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
      const errorMsg = resData?.errors?.[0]?.detail || resData?.message || 'Failed to create checkout';
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const checkoutUrl = resData?.data?.attributes?.url;
    return NextResponse.json({ url: checkoutUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}