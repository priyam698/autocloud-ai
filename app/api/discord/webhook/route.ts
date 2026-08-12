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

  // 1. Instantly reject requests without Discord security headers
  if (!signature || !timestamp || !rawBody) {
    return new NextResponse('Bad request signature', { status: 401 });
  }

  // 2. Dynamically fetch all customer Public Keys stored in Supabase
  const { data: deployments } = await supabase
    .from('deployments')
    .select('discord_public_key')
    .not('discord_public_key', 'is', null);

  const registeredKeys = (deployments || [])
    .map((d) => d.discord_public_key?.trim())
    .filter((k): k is string => Boolean(k && k.length > 0));

  // 3. Verify cryptographic Ed25519 signature against registered customer keys
  let isValid = false;
  for (const key of registeredKeys) {
    try {
      if (await verifyKey(rawBody, signature, timestamp, key)) {
        isValid = true;
        break;
      }
    } catch {
      // Continue checking next key if format mismatch
    }
  }

  // Reject if signature doesn't match any registered key in the database
  if (!isValid) {
    return new NextResponse('Bad request signature', { status: 401 });
  }

  // Parse interaction JSON payload after verification passes
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // 4. Respond to Discord's URL Verification Handshake Ping (Type 1)
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 5. Respond to Slash Commands (Type 2)
  if (body.type === 2) {
    const userQuery = body.data?.options?.[0]?.value || 'Hello';

    return NextResponse.json({
      type: 4,
      data: {
        content: `🤖 **AutoCloud AI Agent:**\n\n> **Question:** ${userQuery}\n\nYour request was received and processed successfully!`,
      },
    });
  }

  return NextResponse.json({ type: 4, data: { content: 'Received interaction.' } });
}