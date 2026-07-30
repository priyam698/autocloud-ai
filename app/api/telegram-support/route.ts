import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userQuery = message.text;

    // Initialize official Google Gen AI client
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Generate dynamic response using gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are the official 24/7 AI Technical Support Engineer for AutoCloud AI ($12/mo platform hosting n8n, Telegram bots, and LangChain runners). 

User Question: "${userQuery}"

Provide a direct, helpful, and unique answer to this specific question in 2-3 friendly sentences.`,
    });

    const replyText =
      response.text ||
      `AutoCloud AI Support: To connect your n8n workflow, open your dashboard, grab your webhook URL, and paste it inside your n8n HTTP trigger node.`;

    // Send response back to Telegram
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
    console.error('Telegram Bot Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}