import { NextResponse } from 'next/server';

const TEMPLATE_NAMES: Record<string, string> = {
  telegram: 'Telegram AI Bot',
  'telegram-ai-bot': 'Telegram AI Bot',
  slack: 'Slack AI Bot',
  'slack-ai-bot': 'Slack AI Bot',
  discord: 'Discord AI Bot',
  'discord-ai-bot': 'Discord AI Bot',
  webchat: 'Web Chat Widget',
  'webchat-ai-bot': 'Web Chat Widget',
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { templateId } = body;

    const selectedTemplate = (templateId || 'telegram').toLowerCase();
    const instanceName = TEMPLATE_NAMES[selectedTemplate] || 'Telegram AI Bot';

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      return NextResponse.json({
        success: true,
        url: '/dashboard',
        redirectUrl: '/dashboard',
      });
    }

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              custom: {
                template_id: selectedTemplate,
                bot_name: instanceName,
              },
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: storeId.toString() } },
            variant: { data: { type: 'variants', id: variantId.toString() } },
          },
        },
      }),
    });

    const resData = await response.json();
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