import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { instanceId } = await req.json();

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    // 1. Fetch the bot_token before deleting from database
    const { data: deployment } = await supabase
      .from('deployments')
      .select('bot_token')
      .eq('id', instanceId)
      .maybeSingle();

    // 2. Unregister the webhook from Telegram's servers directly
    if (deployment?.bot_token) {
      try {
        await fetch(`https://api.telegram.org/bot${deployment.bot_token}/deleteWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drop_pending_updates: true }),
        });
        console.log(`[Delete API]: Webhook unregistered for bot token.`);
      } catch (tgErr) {
        console.error('[Delete API Error]: Failed to unregister Telegram webhook', tgErr);
      }
    }

    // 3. Delete the instance row from Supabase
    const { error: dbError } = await supabase
      .from('deployments')
      .delete()
      .eq('id', instanceId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Instance and webhook deleted successfully' });
  } catch (err: any) {
    console.error('[Delete Instance Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}