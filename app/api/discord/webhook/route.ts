import { NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  if (!rawBody) return new NextResponse('Empty body', { status: 400 });

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 1. Instant response for Discord URL Verification (Type 1 Ping)
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 2. Handle Slash Commands (Type 2)
  if (body.type === 2) {
    const userQuery = body.data?.options?.[0]?.value || 'Hello';

    // Verify signature fast
    if (signature && timestamp) {
      const { data: instances } = await supabase
        .from('deployments')
        .select('discord_public_key')
        .not('discord_public_key', 'is', null)
        .limit(10);

      const publicKeys = (instances || [])
        .map((i) => i.discord_public_key)
        .filter(Boolean);

      let isValid = false;
      for (const key of publicKeys) {
        if (await verifyKey(rawBody, signature, timestamp, key)) {
          isValid = true;
          break;
        }
      }

      // If key verification fails, return immediately
      if (!isValid && publicKeys.length > 0) {
        return new NextResponse('Bad request signature', { status: 401 });
      }
    }

    // Return immediate response to Discord (< 1 second)
    return NextResponse.json({
      type: 4,
      data: {
        content: `🤖 **AutoCloud AI Agent**\n\n> **Question:** ${userQuery}\n\nHello! Your request was received successfully and processed by your AI instance.`,
      },
    });
  }

  return NextResponse.json({ type: 4, data: { content: 'Received interaction.' } });
}