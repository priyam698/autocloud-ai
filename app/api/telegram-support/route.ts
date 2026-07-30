import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userQuery = message.text;

    const apiKey = process.env.GEMINI_API_KEY;

    let replyText = "";

    // Call official Gemini 1.5 Flash endpoint
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are the official 24/7 AI Technical Support Agent for AutoCloud AI ($12/mo cloud platform for n8n workflows, Telegram bots, and LangChain runners). 

User Query: "${userQuery}"

Provide a concise, helpful, and direct answer in 2-3 sentences:`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await geminiRes.json();
      replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (apiErr) {
      console.error("Gemini API call failed:", apiErr);
    }

    // Custom fallback if API key is unverified or model fails
    if (!replyText) {
      if (userQuery.toLowerCase().includes("n8n")) {
        replyText = "AutoCloud AI: To connect your n8n workflow, open your AutoCloud dashboard, copy your unique webhook URL, and paste it directly into your n8n HTTP trigger node.";
      } else if (userQuery.toLowerCase().includes("email") || userQuery.toLowerCase().includes("support")) {
        replyText = "AutoCloud AI Support: You can reach our technical support team directly at priyamrana069@gmail.com 24/7!";
      } else {
        replyText = `AutoCloud AI: Thank you for reaching out regarding "${userQuery}". Our $12/mo cloud platform keeps your AI agents & workflows running 24/7. Contact priyamrana069@gmail.com for additional help!`;
      }
    }

    // Always send response back to Telegram
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_SUPPORT_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
        }),
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}