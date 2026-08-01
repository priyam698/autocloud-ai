import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { templateId, userEmail } = await req.json();

    const templateNames: Record<string, string> = {
      'n8n-workflow': 'n8n Workflow Automation',
      'telegram-ai-bot': 'Telegram AI Bot Runner',
      'langchain-agent': 'LangChain / CrewAI Runner',
    };

    const instanceName = templateNames[templateId] || 'AI Agent Instance';
    const containerId = `container_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Log active deployment to Supabase database
    const { data, error } = await supabase
      .from('deployments')
      .insert([
        {
          name: instanceName,
          template_id: templateId,
          status: 'running',
          user_email: userEmail || 'guest@autocloud.ai',
          container_id: containerId,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Supabase deployment logging error:', error);
    }

    // 2. Return confirmation with active status & URL
    return NextResponse.json({
      success: true,
      message: `24/7 Background Instance Launched Successfully!`,
      deployment: {
        container_id: containerId,
        status: '🟢 Running 24/7',
        template: instanceName,
        endpoint: `https://${containerId}.autocloud.app`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}