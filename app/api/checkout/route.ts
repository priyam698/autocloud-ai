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

    // 1. Generate secure access password
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // 2. SINGLE INSERTION using only schema-verified existing columns
    const { data, error } = await supabase
      .from('deployments')
      .insert([
        {
          name: instanceName,
          template: selectedTemplate,
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
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

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