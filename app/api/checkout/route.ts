import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map template IDs to human-readable names required by your database constraint
const TEMPLATE_NAMES: Record<string, string> = {
  'n8n-workflow': 'n8n Workflow Automation',
  'telegram-ai-bot': 'Telegram AI Bot Runner',
  'langchain-runner': 'LangChain & CrewAI Runner',
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, orderId, userId, templateId } = body;

    const uniqueId = sessionId || orderId || `instance_${Date.now()}`;
    const instanceName = TEMPLATE_NAMES[templateId] || 'Telegram AI Bot Runner';

    // 1. DEDUPLICATION CHECK
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

    // 2. Generate random security password
    const accessPassword = crypto.randomBytes(6).toString('hex');

    // 3. SINGLE INSERTION with required 'name' field
    const { data, error } = await supabase
      .from('deployments')
      .insert([
        {
          name: instanceName,
          template: templateId || 'telegram-ai-bot',
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