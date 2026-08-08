import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEMPLATE_NAMES: Record<string, string> = {
  'n8n-workflow': 'n8n Workflow Automation',
  'telegram-ai-bot': 'Telegram AI Bot Runner',
  'langchain-runner': 'LangChain & CrewAI Runner',
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { templateId } = body;

    const selectedTemplate = templateId || 'telegram-ai-bot';
    const instanceName = TEMPLATE_NAMES[selectedTemplate] || 'Telegram AI Bot Runner';
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // 1. Create exactly 1 instance record in Supabase right away
    const { data: instanceData, error: dbError } = await supabase
      .from('deployments')
      .insert([
        {
          name: instanceName,
          template_id: selectedTemplate,
          access_password: accessPassword,
          is_enabled: true,
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('[Checkout DB Error]:', dbError);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    // 2. Request LemonSqueezy Checkout URL
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      // Fallback: If LemonSqueezy keys are missing, take user directly to dashboard
      return NextResponse.json({
        success: true,
        url: '/dashboard',
        redirectUrl: '/dashboard',
      });
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
                instance_id: instanceData.id,
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