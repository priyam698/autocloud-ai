import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { instanceId, password, taskPrompt, userGroqApiKey } = await req.json();

    if (!instanceId || !password || !taskPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields: instanceId, password, and taskPrompt are required.' },
        { status: 400 }
      );
    }

    // 1. Validate instance & authorization in Supabase
    const { data: instance, error: fetchErr } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (fetchErr || !instance) {
      return NextResponse.json({ error: 'Deployment instance not found.' }, { status: 404 });
    }

    if (instance.access_password !== password) {
      return NextResponse.json({ error: 'Unauthorized: Invalid access password.' }, { status: 401 });
    }

    // 2. Resolve Groq API Key (Use user-provided key or Vercel GROQ_API_KEY)
    const apiKey = userGroqApiKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No Groq API Key found. Please set GROQ_API_KEY in Vercel environment variables.' },
        { status: 400 }
      );
    }

    // 3. Initialize LangChain Groq Model
    const model = new ChatGroq({
      apiKey: apiKey,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
    });

    // 4. Construct System Persona based on instance context
    const systemPrompt = instance.custom_context || 
      `You are an autonomous AI Crew Agent executing tasks for deployment instance "${instance.name}". Provide concise, highly accurate responses.`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(taskPrompt),
    ]);

    // 5. Return structured execution results
    return NextResponse.json({
      success: true,
      instance: {
        id: instance.id,
        name: instance.name,
      },
      execution: {
        prompt: taskPrompt,
        result: response.content,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (err: any) {
    console.error('Groq Crew runner execution error:', err);
    return NextResponse.json({ error: err.message || 'Execution failed' }, { status: 500 });
  }
}