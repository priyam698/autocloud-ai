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

  if (!rawBody) {
    return new NextResponse('Empty body', { status: 400 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 1. Immediately pass Discord's initial URL Verification Ping (Type 1)
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 2. For actual messages/interactions, verify signature against registered keys
  if (signature && timestamp) {
    const { data: instances } = await supabase
      .from('deployments')
      .select('discord_public_key')
      .not('discord_public_key', 'is', null);

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

    if (!isValid) {
      return new NextResponse('Bad request signature', { status: 401 });
    }
  }

  // 3. Respond to Discord messages / slash commands
  return NextResponse.json({
    type: 4,
    data: {
      content: "Hello! AutoCloud AI is online and ready to assist.",
    },
  });
}