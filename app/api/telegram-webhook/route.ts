import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processCustomerMessage } from '@/lib/ai-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryTeamId = searchParams.get('teamId') || 'T0BQ21MN7FV';

    const update = await req.json();
    if (!update.message || !update.message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const userText = update.message.text;

    // Retrieve Telegram bot token for this workspace
    let telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (supabase) {
      const { data } = await supabase
        .from('integrations')
        .select('telegram_token')
        .eq('team_id', queryTeamId)
        .maybeSingle();

      if (data?.telegram_token) {
        telegramToken = data.telegram_token;
      }
    }

    if (!telegramToken) {
      console.error('No Telegram token found for team:', queryTeamId);
      return NextResponse.json({ ok: true });
    }

    // Call Central AI Engine (Maintains context memory per chat_id)
    const aiResponse = await processCustomerMessage({
      teamId: queryTeamId,
      platform: 'telegram',
      sessionId: String(chatId),
      userPrompt: userText,
    });

    // Send reply via Telegram Bot API
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse,
        parse_mode: 'Markdown',
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram Webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}