import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!rawBody) return new NextResponse('Empty body', { status: 400 });

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 1. Instant response for Discord URL Verification Ping (Type 1)
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 2. Instant response for Slash Commands (Type 2)
  if (body.type === 2) {
    const userQuery = body.data?.options?.[0]?.value || 'Hello';

    // Immediate type 4 response under 500ms
    return NextResponse.json({
      type: 4,
      data: {
        content: `🤖 **AutoCloud AI:** You asked: "${userQuery}"\n\nYour support request was received and processed successfully!`,
      },
    });
  }

  return NextResponse.json({ type: 4, data: { content: 'Received!' } });
}