import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { templateId } = body;

    // Friendly names mapped to template IDs
    const templateNames: Record<string, string> = {
      'n8n-workflow': 'n8n Workflow Automation',
      'telegram-ai-bot': 'Telegram AI Bot Runner',
      'langchain-agent': 'LangChain / CrewAI Runner',
    };

    const selectedName = templateNames[templateId] || 'AI Agent Hosting';

    // Support both naming styles (LEMONSQUEEZY_ and LEMON_SQUEEZY_)
    const apiKey = process.env.LEMONSQUEEZY_API_KEY || process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID || process.env.LEMON_SQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID || process.env.LEMON_SQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      return NextResponse.json(
        { error: 'Lemon Squeezy credentials missing in environment variables.' },
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
                template_id: templateId,
                template_name: selectedName,
              },
            },
            product_options: {
              name: `AutoCloud AI: ${selectedName}`,
              description: '1-Click deployment and 24/7 background hosting for AI Agents and workflows.',
              redirect_url: `${req.headers.get('origin') || 'https://autocloud-ai-p448.vercel.app'}/?success=true`,
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: String(storeId),
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: String(variantId),
              },
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Lemon Squeezy error details:', data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || 'Failed to create checkout session.' },
        { status: response.status }
      );
    }

    const checkoutUrl = data.data?.attributes?.url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Checkout URL not returned from payment gateway.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err: any) {
    console.error('Checkout API Route Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}