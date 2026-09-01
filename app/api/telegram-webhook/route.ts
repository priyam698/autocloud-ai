import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// ==========================================
// 1. SUPABASE CLIENT
// ==========================================
function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://placeholder.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    'placeholder-key';
  return createClient(url, key);
}

// ==========================================
// 2. SCRAPER & URL EXTRACTION
// ==========================================
async function scrapeWebsiteContent(targetUrl: string): Promise<string> {
  try {
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AutoCloudBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return '';

    const html = await res.text();

    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
  } catch (err: any) {
    console.error('[Auto Scrape Exception]:', err.message);
    return '';
  }
}

function extractUrl(text: string): string | null {
  const urlMatch = text.match(
    /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i
  );
  if (urlMatch) {
    let url = urlMatch[0];
    if (
      !url.startsWith('http') &&
      (url.startsWith('www.') ||
        url.includes('.com') ||
        url.includes('.co') ||
        url.includes('.org') ||
        url.includes('.io') ||
        url.includes('.ai') ||
        url.includes('.in'))
    ) {
      return `https://${url}`;
    }
    if (url.startsWith('http')) return url;
  }
  return null;
}

function cleanOutput(rawText: string, userQuestion: string): string {
  let text = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();

  text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  text = text.replace(/\([^)]*(?:simple|friendly|follows rules|concise|polite|accurate)[^)]*\)/gi, '');
  text = text.replace(/^[\s\S]*?(?:Store Information & Rules:|Store Knowledge:|Business Information:|Customer Question:|Instructions:)\s*(?:'[^']*'|"[^"]*")?\s*/i, '');

  if (text.toLowerCase().startsWith(userQuestion.toLowerCase())) {
    text = text.slice(userQuestion.length).trim();
  }

  const lines = text.split('\n');
  const validLines: string[] = [];

  for (const line of lines) {
    const stripped = line.trim().replace(/^[:*#>\s"-]+/, '').trim();
    const lower = stripped.toLowerCase();

    const isSystemHeader =
      lower.startsWith('output only') ||
      lower.startsWith('how to respond') ||
      lower.startsWith('user asks') ||
      lower.startsWith('action:') ||
      lower.startsWith('exact language') ||
      lower.startsWith('persona:') ||
      lower.startsWith('constraint check:') ||
      lower.includes('? yes') ||
      lower.includes('? no');

    if (!isSystemHeader && stripped.length > 0) {
      validLines.push(stripped);
    }
  }

  let result = validLines.join(' ').trim();

  const sentences = result.split(/(?<=[.?!])\s+/);
  const uniqueSentences: string[] = [];
  for (const s of sentences) {
    const sTrim = s.trim();
    if (sTrim && !uniqueSentences.some((u) => u.toLowerCase() === sTrim.toLowerCase())) {
      uniqueSentences.push(sTrim);
    }
  }
  result = uniqueSentences.join(' ');
  return result.replace(/^[:"'`\s]+|["'`\s]+$/g, '').trim();
}

function splitKnowledgeIntoRules(knowledge: string): string[] {
  if (!knowledge || !knowledge.trim()) return [];
  return knowledge
    .split(/\n+/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

// ==========================================
// 3. DYNAMIC GEMINI MODEL RESOLUTION
// ==========================================
async function getActiveGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      const models: string[] = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''))
        .filter((m: string) => !m.includes('embedding') && !m.includes('aqa') && !m.includes('image'));

      if (models.length > 0) {
        return models.sort((a, b) => {
          if (a.includes('2.5-flash') || a.includes('flash-002') || a.includes('1.5-flash')) return -1;
          return 1;
        });
      }
    }
  } catch {}
  return ['gemini-2.5-flash', 'gemini-1.5-flash-002', 'gemini-1.5-flash', 'gemini-1.5-pro-002'];
}

// ==========================================
// 4. MULTILINGUAL CONTENT MODERATION
// ==========================================
async function checkToxicity(content: string, apiKey: string): Promise<boolean> {
  const text = (content || '').trim();
  if (!text || !apiKey) return false;

  const prompt = `You are a strict moderation filter.
Analyze this message for severe harassment, vulgarity, abuse, or spam attacks.
Reply strictly with "VIOLATION" if inappropriate, or "SAFE" if acceptable.

Message: "${text.replace(/"/g, "'")}"`;

  try {
    const liveModels = await getActiveGeminiModels(apiKey);
    const targetModel = liveModels[0] || 'gemini-2.5-flash';
    const formattedModel = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${formattedModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.0, maxOutputTokens: 10 },
        }),
        signal: AbortSignal.timeout(3500),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const verdict =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase() || '';
      return verdict.includes('VIOLATION');
    }
  } catch {}

  return false;
}

// ==========================================
// 5. DIRECT CONVERSATIONAL AI ENGINE
// ==========================================
async function askAI(
  userQuestion: string,
  knowledge: string,
  botName: string
): Promise<string> {
  const cleanKnowledge = (knowledge || '').trim();
  const lowerQ = userQuestion.toLowerCase().trim();

  if (['hi', 'hello', 'hey', 'start', 'hola', 'namaste', 'bonjour'].includes(lowerQ)) {
    return `Hello! I'm ${botName}. How can I assist you today? Feel free to ask about our products, orders, or policies.`;
  }

  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();

  if (!geminiKey && !groqKey && !cerebrasKey) {
    return `⚠️ Missing AI API Keys. Please configure GEMINI_API_KEY in your environment variables.`;
  }

  const combinedPrompt = `You are ${botName}, a helpful customer support representative for our store.

STORE INFORMATION & RULES:
${cleanKnowledge || 'We sell store products and assist customers with inquiries.'}

CUSTOMER QUESTION:
"${userQuestion}"

INSTRUCTIONS:
1. Answer the customer directly in 1-2 polite, conversational sentences using only the Store Information above.
2. If the customer asks for a product, service, or payment method NOT in the Store Information (e.g., COD or unlisted items), state clearly and politely that it is not offered and mention what is accepted/available.
3. Respond in the exact same language the customer used.
4. Output only the message for the customer.`;

  // 1. Google Gemini (Primary Engine)
  if (geminiKey) {
    const liveGeminiModels = await getActiveGeminiModels(geminiKey);

    for (const model of liveGeminiModels) {
      try {
        const formattedModel = model.startsWith('models/') ? model : `models/${model}`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${formattedModel}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
            }),
            signal: AbortSignal.timeout(5000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            const cleaned = cleanOutput(text, userQuestion);
            if (cleaned.length > 0) return cleaned;
          }
        }
      } catch {}
    }
  }

  // 2. Groq (High-Speed Backup)
  if (groqKey) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: combinedPrompt }],
            temperature: 0.2,
            max_tokens: 250,
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const data = await res.json();
          const rawReply = data.choices?.[0]?.message?.content?.trim();
          if (rawReply) {
            const finalized = cleanOutput(rawReply, userQuestion);
            if (finalized.length > 0) return finalized;
          }
        }
      } catch {}
    }
  }

  // 3. Cerebras (Failover)
  if (cerebrasKey) {
    try {
      const resCer = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cerebrasKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1-8b',
          messages: [{ role: 'user', content: combinedPrompt }],
          temperature: 0.2,
          max_tokens: 250,
        }),
        signal: AbortSignal.timeout(3500),
      });

      if (resCer.ok) {
        const jsonCer = await resCer.json();
        const rawCer = jsonCer.choices?.[0]?.message?.content?.trim();
        if (rawCer) {
          const finalized = cleanOutput(rawCer, userQuestion);
          if (finalized.length > 0) return finalized;
        }
      }
    } catch {}
  }

  return cleanKnowledge
    ? `We assist customers according to our store guidelines: ${cleanKnowledge}`
    : `Hello! I'm ${botName}. How can I assist you with our store today?`;
}

// ==========================================
// 6. TELEGRAM API INTERACTIVE SENDER
// ==========================================
async function sendTelegram(token: string, method: string, payload: Record<string, any>) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[Telegram ${method} Error]:`, err);
  }
}

function getMainControlPanel() {
  return {
    inline_keyboard: [
      [
        { text: '📋 View Current Rules', callback_data: 'kb_view' },
        { text: '🗑️ Delete a Rule', callback_data: 'kb_delete_menu' },
      ],
      [
        { text: '➕ Add Rule Guide', callback_data: 'kb_add_guide' },
        { text: '🧹 Clear All Knowledge', callback_data: 'kb_clear_ask' },
      ],
      [
        { text: '👑 Bot Info & Status', callback_data: 'kb_info' },
      ],
    ],
  };
}

// ==========================================
// 7. MAIN WEBHOOK HANDLER
// ==========================================
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId') || searchParams.get('id') || searchParams.get('teamId');

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: true });

    const supabase = getSupabaseClient();
    const { data: records, error: dbError } = await supabase.from('deployments').select('*');

    if (dbError || !records || records.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // MULTI-TENANT RESOLVER: Match by instance ID or find the active Telegram bot deployment
    let tenantDeployment = null;

    if (instanceId) {
      tenantDeployment = records.find(
        (r: any) =>
          r.id === instanceId ||
          (typeof r.id === 'string' && r.id.toLowerCase().startsWith(instanceId.toLowerCase()))
      );
    }

    if (!tenantDeployment) {
      tenantDeployment =
        records.find(
          (r: any) =>
            (r.telegram_bot_token || r.bot_token) &&
            (r.template_id === 'telegram' || !r.template_id)
        ) ||
        records.find((r: any) => r.telegram_bot_token || r.bot_token) ||
        records[0];
    }

    const botToken = tenantDeployment.telegram_bot_token || tenantDeployment.bot_token;
    const botName = tenantDeployment.bot_name || tenantDeployment.name || 'Telegram AI Bot';
    let customerKnowledge = tenantDeployment.knowledge_base || '';
    const deploymentId = tenantDeployment.id;
    const registeredOwnerId = tenantDeployment.admin_telegram_id
      ? String(tenantDeployment.admin_telegram_id)
      : null;

    if (!botToken) {
      console.warn('[Telegram Webhook]: No bot token found for deployment', deploymentId);
      return NextResponse.json({ ok: true });
    }

    // =======================================================
    // A. HANDLE INLINE BUTTON CLICKS (CALLBACK QUERIES)
    // =======================================================
    if (body.callback_query) {
      const cb = body.callback_query;
      const cbId = cb.id;
      const cbSenderId = String(cb.from?.id);
      const cbChatId = cb.message?.chat?.id;
      const cbMessageId = cb.message?.message_id;
      const action = cb.data || '';

      const isCbOwner = registeredOwnerId && cbSenderId === registeredOwnerId;

      if (!isCbOwner && registeredOwnerId) {
        await sendTelegram(botToken, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '⛔ Access Denied: Only the owner can use control panel buttons.',
          show_alert: true,
        });
        return NextResponse.json({ ok: true });
      }

      await sendTelegram(botToken, 'answerCallbackQuery', { callback_query_id: cbId });

      // Action: View Rules
      if (action === 'kb_view') {
        const rules = splitKnowledgeIntoRules(customerKnowledge);
        let text = `📋 <b>Active Store Rules & Memory:</b>\n\n`;
        if (rules.length === 0) {
          text += `<i>No active rules configured yet.</i>`;
        } else {
          rules.forEach((r, idx) => {
            text += `<b>${idx + 1}.</b> ${r}\n`;
          });
        }
        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗑️ Delete a Rule', callback_data: 'kb_delete_menu' }],
              [{ text: '🔙 Back to Menu', callback_data: 'kb_main_menu' }],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Action: Delete Menu (Builds interactive 1-tap delete buttons)
      if (action === 'kb_delete_menu') {
        const rules = splitKnowledgeIntoRules(customerKnowledge);
        if (rules.length === 0) {
          await sendTelegram(botToken, 'editMessageText', {
            chat_id: cbChatId,
            message_id: cbMessageId,
            text: `⚠️ <b>No rules to delete.</b> The knowledge base is already empty.`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'kb_main_menu' }]],
            },
          });
          return NextResponse.json({ ok: true });
        }

        let text = `🗑️ <b>Tap any button below to delete that specific rule:</b>\n\n`;
        const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
        let currentRow: Array<{ text: string; callback_data: string }> = [];

        rules.forEach((r, idx) => {
          text += `<b>#${idx + 1}:</b> ${r}\n`;
          currentRow.push({ text: `❌ Delete #${idx + 1}`, callback_data: `kb_del_${idx}` });
          if (currentRow.length === 2) {
            buttons.push(currentRow);
            currentRow = [];
          }
        });

        if (currentRow.length > 0) buttons.push(currentRow);
        buttons.push([{ text: '🔙 Cancel & Back', callback_data: 'kb_main_menu' }]);

        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        });
        return NextResponse.json({ ok: true });
      }

      // Action: Execute Individual Rule Deletion
      if (action.startsWith('kb_del_')) {
        const targetIndex = parseInt(action.replace('kb_del_', ''), 10);
        let rules = splitKnowledgeIntoRules(customerKnowledge);

        if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < rules.length) {
          const removed = rules.splice(targetIndex, 1)[0];
          const updatedKnowledge = rules.join('\n');

          await supabase.from('deployments').update({ knowledge_base: updatedKnowledge }).eq('id', deploymentId);
          customerKnowledge = updatedKnowledge;

          await sendTelegram(botToken, 'answerCallbackQuery', {
            callback_query_id: cbId,
            text: `✅ Deleted rule #${targetIndex + 1}!`,
            show_alert: false,
          });

          let text = `✅ <b>Rule #${targetIndex + 1} Removed:</b>\n<i>"${removed}"</i>\n\n<b>Remaining Rules:</b>\n`;
          const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
          let currentRow: Array<{ text: string; callback_data: string }> = [];

          if (rules.length === 0) {
            text += `<i>All rules deleted. Knowledge base is empty.</i>`;
          } else {
            rules.forEach((r, idx) => {
              text += `<b>#${idx + 1}:</b> ${r}\n`;
              currentRow.push({ text: `❌ Delete #${idx + 1}`, callback_data: `kb_del_${idx}` });
              if (currentRow.length === 2) {
                buttons.push(currentRow);
                currentRow = [];
              }
            });
            if (currentRow.length > 0) buttons.push(currentRow);
          }

          buttons.push([{ text: '🔙 Back to Menu', callback_data: 'kb_main_menu' }]);

          await sendTelegram(botToken, 'editMessageText', {
            chat_id: cbChatId,
            message_id: cbMessageId,
            text,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons },
          });
        }
        return NextResponse.json({ ok: true });
      }

      // Action: Ask Confirmation to Clear All
      if (action === 'kb_clear_ask') {
        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: `⚠️ <b>Are you sure you want to delete ALL store rules?</b>\nThis cannot be undone.`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🚨 Yes, Wipe Everything', callback_data: 'kb_clear_execute' },
                { text: '❌ Cancel', callback_data: 'kb_main_menu' },
              ],
            ],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Action: Wipe All
      if (action === 'kb_clear_execute') {
        await supabase.from('deployments').update({ knowledge_base: '' }).eq('id', deploymentId);
        customerKnowledge = '';

        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: `🧹 <b>Knowledge Base Cleared!</b>\nAll rules have been wiped. You can add new rules by typing:\n<code>/add &lt;your rule&gt;</code> or <code>/train &lt;all rules&gt;</code>.`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'kb_main_menu' }]],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Action: Add / Modify Guide
      if (action === 'kb_add_guide') {
        const guideText = `✍️ <b>How to Add or Modify Rules:</b>\n\n` +
          `• <b>Add a single new rule:</b>\n<code>/add We open from 9 AM to 6 PM on weekdays.</code>\n\n` +
          `• <b>Overwrite entire store memory:</b>\n<code>/train We sell running shoes. UPI accepted. Returns 7 days.</code>\n\n` +
          `• <b>Scrape a website:</b>\n<code>/website https://yourstore.com</code>`;

        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: guideText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'kb_main_menu' }]],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Action: Bot Status & Info
      if (action === 'kb_info') {
        const rules = splitKnowledgeIntoRules(customerKnowledge);
        const infoText = `🤖 <b>Bot Configuration & Status</b>\n\n` +
          `• <b>Bot Name:</b> ${botName}\n` +
          `• <b>Total Stored Rules:</b> ${rules.length}\n` +
          `• <b>Total Characters:</b> ${customerKnowledge.length}\n` +
          `• <b>Owner Telegram ID:</b> <code>${registeredOwnerId || 'Unregistered'}</code>\n` +
          `• <b>Status:</b> 🟢 Active & Ready`;

        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: infoText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'kb_main_menu' }]],
          },
        });
        return NextResponse.json({ ok: true });
      }

      // Action: Main Menu Return
      if (action === 'kb_main_menu') {
        await sendTelegram(botToken, 'editMessageText', {
          chat_id: cbChatId,
          message_id: cbMessageId,
          text: `⚙️ <b>${botName} Control Panel</b>\nChoose an action below:`,
          parse_mode: 'HTML',
          reply_markup: getMainControlPanel(),
        });
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // =======================================================
    // B. HANDLE STANDARD CHAT MESSAGES
    // =======================================================
    const message = body.message || body.edited_message;
    if (!message || !message.chat) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const senderId = message.from?.id ? String(message.from.id) : null;
    let userText = (message.text || message.caption || '').trim();

    if (!chatId || !senderId || !deploymentId) {
      return NextResponse.json({ ok: true });
    }

    // Expiration Check
    const now = new Date();
    const isExpired =
      tenantDeployment.status === 'expired' ||
      tenantDeployment.subscription_status === 'expired' ||
      (tenantDeployment.expires_at && new Date(tenantDeployment.expires_at) < now);

    if (isExpired) {
      await sendTelegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: '⚠️ This bot subscription has expired. Please renew on your dashboard.',
      });
      return NextResponse.json({ ok: true });
    }

    const isOwner = registeredOwnerId && senderId === registeredOwnerId;

    // Moderation Check for Non-Owners
    if (!isOwner) {
      const { data: modRecord } = await supabase
        .from('bot_moderation')
        .select('*')
        .eq('deployment_id', deploymentId)
        .eq('telegram_user_id', senderId)
        .maybeSingle();

      if (modRecord?.is_banned) {
        return NextResponse.json({ ok: true });
      }
    }

    // Interactive Menu Command (/menu, /admin, /settings, /start for owner)
    if (
      userText === '/menu' ||
      userText === '/admin' ||
      userText === '/settings' ||
      (userText === '/start' && isOwner)
    ) {
      if (registeredOwnerId && !isOwner) {
        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '⛔ Access Denied: Only the verified owner can open the bot control panel.',
        });
        return NextResponse.json({ ok: true });
      }

      await sendTelegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: `⚙️ <b>${botName} Control Panel</b>\nManage your store rules and bot memory with the buttons below:`,
        parse_mode: 'HTML',
        reply_markup: getMainControlPanel(),
      });
      return NextResponse.json({ ok: true });
    }

    // Owner Commands & URL Scraping
    const detectedUrl = extractUrl(userText);
    const isExplicitScrape =
      userText.startsWith('/website ') ||
      userText.startsWith('/crawl ') ||
      userText.startsWith('/scrape ') ||
      userText.startsWith('/link ');

    const isOwnerCommand =
      isExplicitScrape ||
      (isOwner && detectedUrl !== null && userText.split(' ').length <= 3) ||
      userText.startsWith('/train ') ||
      userText.startsWith('/setinfo ') ||
      userText.startsWith('/add ') ||
      userText.startsWith('/append ') ||
      userText.startsWith('/unban ') ||
      userText === '/view' ||
      userText === '/rules' ||
      userText === '/clear' ||
      userText === '/owner';

    if (isOwnerCommand) {
      if (registeredOwnerId && !isOwner) {
        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '⛔ Access Denied: Only the verified owner can modify business knowledge.',
        });
        return NextResponse.json({ ok: true });
      }

      if (userText === '/owner') {
        const status = registeredOwnerId
          ? `👑 Verified Owner ID: <code>${registeredOwnerId}</code>`
          : '⚠️ No owner registered yet. Send <code>/train &lt;rules&gt;</code> to register.';
        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: status,
          parse_mode: 'HTML',
          reply_markup: getMainControlPanel(),
        });
        return NextResponse.json({ ok: true });
      }

      if (isExplicitScrape || (detectedUrl && userText.split(' ').length <= 3)) {
        const targetUrl =
          detectedUrl ||
          userText.replace(/^(\/website|\/crawl|\/scrape|\/link)\s+/i, '').trim();

        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: `⏳ Extracting business data from <code>${targetUrl}</code>...`,
          parse_mode: 'HTML',
        });

        const extractedText = await scrapeWebsiteContent(targetUrl);
        if (extractedText && extractedText.length > 50) {
          const payload: Record<string, any> = { knowledge_base: extractedText };
          if (!registeredOwnerId) payload.admin_telegram_id = senderId;

          await supabase.from('deployments').update(payload).eq('id', deploymentId);
          customerKnowledge = extractedText;
          const preview = extractedText.slice(0, 200).replace(/\n/g, ' ');

          await sendTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `✅ <b>Website Extracted & Memory Updated!</b>\n\n🌐 <b>Source:</b> ${targetUrl}\n📊 <b>Total:</b> ${extractedText.length} chars\n\n<i>Preview:</i>\n"${preview}..."`,
            parse_mode: 'HTML',
            reply_markup: getMainControlPanel(),
          });
        } else {
          await sendTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `⚠️ Could not extract data from <code>${targetUrl}</code>. Please check URL or use <code>/train</code> manually.`,
            parse_mode: 'HTML',
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (userText.startsWith('/unban ')) {
        const targetUserId = userText.replace('/unban', '').trim();
        await supabase
          .from('bot_moderation')
          .delete()
          .eq('deployment_id', deploymentId)
          .eq('telegram_user_id', targetUserId);

        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: `✅ User <code>${targetUserId}</code> unbanned.`,
          parse_mode: 'HTML',
        });
        return NextResponse.json({ ok: true });
      }

      if (userText === '/view' || userText === '/rules') {
        const rules = splitKnowledgeIntoRules(customerKnowledge);
        let text = `📋 <b>Active Store Rules & Knowledge:</b>\n\n`;
        if (rules.length === 0) {
          text += `<i>Knowledge base is empty.</i>`;
        } else {
          rules.forEach((r, idx) => {
            text += `<b>${idx + 1}.</b> ${r}\n`;
          });
        }
        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: getMainControlPanel(),
        });
        return NextResponse.json({ ok: true });
      }

      if (userText === '/clear') {
        await supabase.from('deployments').update({ knowledge_base: '' }).eq('id', deploymentId);
        customerKnowledge = '';
        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '🧹 Knowledge base cleared successfully.',
          reply_markup: getMainControlPanel(),
        });
        return NextResponse.json({ ok: true });
      }

      if (userText.startsWith('/add ') || userText.startsWith('/append ')) {
        const appendData = userText.replace(/^(\/add|\/append)\s+/i, '').trim();
        if (appendData.length > 0) {
          const updatedKnowledge = customerKnowledge
            ? `${customerKnowledge}\n${appendData}`
            : appendData;
          const payload: Record<string, any> = { knowledge_base: updatedKnowledge };
          if (!registeredOwnerId) payload.admin_telegram_id = senderId;

          await supabase.from('deployments').update(payload).eq('id', deploymentId);
          customerKnowledge = updatedKnowledge;

          await sendTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `➕ <b>Rule Appended Successfully:</b>\n\n"${appendData}"`,
            parse_mode: 'HTML',
            reply_markup: getMainControlPanel(),
          });
          return NextResponse.json({ ok: true });
        }
      }

      const newTrainingData = userText.replace(/^(\/train|\/setinfo)\s+/i, '').trim();
      if (newTrainingData.length > 0) {
        const payload: Record<string, any> = { knowledge_base: newTrainingData };
        if (!registeredOwnerId) payload.admin_telegram_id = senderId;

        await supabase.from('deployments').update(payload).eq('id', deploymentId);
        customerKnowledge = newTrainingData;

        const header = registeredOwnerId
          ? '✅ Knowledge Base Updated!'
          : `✅ Knowledge Base Saved & Owner Registered!\nOwner ID: <code>${senderId}</code>`;

        await sendTelegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: `${header}\n\n<b>Stored Memory:</b>\n"${newTrainingData}"`,
          parse_mode: 'HTML',
          reply_markup: getMainControlPanel(),
        });
        return NextResponse.json({ ok: true });
      }
    }

    // 3-Strike Moderation Flow
    if (!isOwner && userText) {
      const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
      const isToxic = await checkToxicity(userText, geminiKey);

      if (isToxic) {
        const { data: existingUser } = await supabase
          .from('bot_moderation')
          .select('*')
          .eq('deployment_id', deploymentId)
          .eq('telegram_user_id', senderId)
          .maybeSingle();

        const currentStrikes = (existingUser?.strikes || 0) + 1;

        if (currentStrikes === 1) {
          await supabase.from('bot_moderation').upsert({
            deployment_id: deploymentId,
            telegram_user_id: senderId,
            strikes: 1,
            last_violation: userText.slice(0, 200),
            updated_at: new Date().toISOString(),
          });

          await sendTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: '⚠️ Warning 1/2: Abusive or profane language is not allowed. Please remain respectful.',
          });
          return NextResponse.json({ ok: true });
        } else if (currentStrikes === 2) {
          await supabase.from('bot_moderation').upsert({
            deployment_id: deploymentId,
            telegram_user_id: senderId,
            strikes: 2,
            last_violation: userText.slice(0, 200),
            updated_at: new Date().toISOString(),
          });

          await sendTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: '⚠️ Warning 2/2 (Final Warning): Further violations will result in an immediate ban.',
          });
          return NextResponse.json({ ok: true });
        } else {
          await supabase.from('bot_moderation').upsert({
            deployment_id: deploymentId,
            telegram_user_id: senderId,
            strikes: 3,
            is_banned: true,
            last_violation: userText.slice(0, 200),
            updated_at: new Date().toISOString(),
          });

          await sendTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: '🚫 You have been permanently banned due to policy violations.',
          });
          return NextResponse.json({ ok: true });
        }
      }
    }

    // Direct Customer Response
    if (userText) {
      const reply = await askAI(userText, customerKnowledge, botName);

      const isGroup = message.chat?.type === 'group' || message.chat?.type === 'supergroup';
      const userMention = message.from?.username
        ? `@${message.from.username}`
        : `${message.from?.first_name || 'User'}`;

      const finalMessage = isGroup ? `${userMention} ${reply}` : reply;

      await sendTelegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: finalMessage,
        reply_to_message_id: message.message_id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (fatal: any) {
    console.error('[Fatal Webhook Exception]:', fatal);
    return NextResponse.json({ ok: true });
  }
}