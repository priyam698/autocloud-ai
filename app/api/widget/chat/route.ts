import { NextResponse } from 'next/server';
import { processCustomerMessage } from '@/lib/ai-engine';

// Enable CORS so external customer websites can connect
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { teamId, sessionId, message } = await req.json();

    if (!teamId || !message) {
      return NextResponse.json(
        { error: 'teamId and message are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call Central AI Engine (Uses workspace RAG + user session memory)
    const reply = await processCustomerMessage({
      teamId,
      platform: 'web',
      sessionId: sessionId || 'web_guest_session',
      userPrompt: message,
    });

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}