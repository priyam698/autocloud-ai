import { NextResponse } from 'next/server';

// ---------------- HELPERS ----------------
function cleanKey(key?: string): string {
  if (!key) return '';
  return key.replace(/['"]/g, '').trim();
}

// ---------------- 1. DYNAMIC CEREBRAS INFERENCE ----------------
async function callCerebrasAuto(prompt: string, apiKey: string): Promise<string | null> {
  const token = cleanKey(apiKey);
  if (!token) return null;

  try {
    // Dynamically fetch available models from Cerebras
    let selectedModel = 'llama3.1-8b'; // default candidate
    const modelsRes = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const availableModels = modelsData.data?.map((m: any) => m.id) || [];
      if (availableModels.length > 0) {
        // Pick the first available chat/llama model
        selectedModel = availableModels.find((m: string) => m.includes('llama') || m.includes('gemma')) || availableModels[0];
      }
    }

    // Execute chat completion
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: 'You are Felix, a helpful AI assistant on Telegram.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Cerebras Auto Exception]:', err);
    return null;
  }
}

// ---------------- 2. AUTOMATED GROQ FALLBACK ----------------
async function callGroqAuto(prompt: string, apiKey: string): Promise<string | null> {
  const token = cleanKey(apiKey);
  if (!token) return null;

  const candidateModels = ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768'];

  for (const model of candidateModels) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are Felix, a helpful AI assistant on Telegram.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------- 3. AUTOMATED GEMINI FALLBACK ----------------
async function callGeminiAuto(prompt: string, apiKey: string): Promise<string | null> {
  const token = cleanKey(apiKey);
  if (!token) return null;

  const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of candidateModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------- WEBHOOK ROUTE HANDLER ----------------
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');

    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();
    const targetBotToken = cleanKey(tokenFromQuery || process.env.TELEGRAM_BOT_TOKEN);

    if (!targetBotToken) {
      return NextResponse.json({ ok: true });
    }

    // Handle /start command
    if (userText === '/start') {
      await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Hello! I'm Felix, your AI Telegram assistant. Ask me anything!",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    let replyText: string | null = null;

    // Automated Tiered Execution Pipeline
    if (process.env.CEREBRAS_API_KEY) {
      replyText = await callCerebrasAuto(userText, process.env.CEREBRAS_API_KEY);
    }

    if (!replyText) {
      const groqKey = process.env.GROQ_API_KEY || process.env.USER_GROQ_API_KEY;
      if (groqKey) {
        replyText = await callGroqAuto(userText, groqKey);
      }
    }

    if (!replyText) {
      const geminiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY;
      if (geminiKey) {
        replyText = await callGeminiAuto(userText, geminiKey);
      }
    }

    if (!replyText) {
      replyText = "I am currently undergoing automated maintenance. Please try again in a few moments!";
    }

    // Send Response Back to Telegram
    await fetch(`https://api.telegram.org/bot${targetBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: true });
  }
}