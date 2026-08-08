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

    const instanceName = TEMPLATE_NAMES[templateId] || 'Telegram AI Bot Runner';
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // Safe payload: ONLY uses essential standard columns (name, access_password, is_enabled)
    const payload: Record<string, any> = {
      name: instanceName,
      access_password: accessPassword,
      is_enabled: true,
    };

    // Insert directly into deployments
    const { data, error } = await supabase
      .from('deployments')
      .insert([payload])
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