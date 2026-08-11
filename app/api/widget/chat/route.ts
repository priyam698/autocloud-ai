import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Enable CORS for external websites embedding the widget
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request) {
  try {
    const { instanceId, message } = await req.json();

    if (!instanceId || !message) {
      return NextResponse.json(
        { error: 'Missing instanceId or message.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 1. Fetch deployment details & business knowledge base
    const { data: instance, error: fetchErr } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (fetchErr || !instance) {
      return NextResponse.json(
        { error: 'Invalid instance ID.' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 2. Initialize Groq Llama model
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured on server.' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const model = new ChatGroq({
      apiKey: apiKey,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
    });

    const systemPrompt = instance.custom_context ||
      `You are a helpful AI Customer Support agent for website visitors. Provide concise, friendly, and helpful responses based on store rules.`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(message),
    ]);

    return NextResponse.json(
      { reply: response.content },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err: any) {
    console.error('Widget chat execution error:', err);
    return NextResponse.json(
      { error: 'Execution error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}