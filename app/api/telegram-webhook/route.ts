import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const DEFAULT_SYSTEM_PROMPT = `
You are a helpful 24/7 AI Customer Support Assistant.
Answer customer inquiries politely, concisely, and accurately based on the business context provided.
If you do not know an answer, politely ask the user to contact human support.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    // Ignore non-message updates
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const chatType = message.chat.type; // 'private', 'group', or 'supergroup'
    const userText = message.text;

    // 1. Handle Direct Messages (DMs from ANY customer)
    if (chatType === 'private') {
      if (userText.startsWith('/start')) {
        await sendTelegramMessage(
          chatId,
          'Hello! 👋 How can I assist you today? Feel free to ask any questions!'
        );
        return NextResponse.json({ ok: true });
      }

      // Generate Gemini response for public DM
      const replyText = await generateAIResponse(userText);
      await sendTelegramMessage(chatId, replyText);
      return NextResponse.json({ ok: true });
    }

    // 2. Handle Group Messages (Responds when tagged @bot or replied to)
    if (chatType === 'group' || chatType === 'supergroup') {
      const botToken = process.env.TELEGRAM_SUPPORT_BOT_TOKEN;
      const botInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const botInfo = await botInfoRes.json();
      const botUsername = botInfo?.result?.username ? `@${botInfo.result.username}` : '';

      const isRepliedToBot = message.reply_to_message?.from?.id === botInfo?.result?.id;

      if ((botUsername && userText.includes(botUsername)) || isRepliedToBot) {
        const cleanText = botUsername ? userText.replace(botUsername, '').trim() : userText;
        const replyText = await generateAIResponse(cleanText);
        await sendTelegramMessage(chatId, replyText);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ ok: true }); // Return ok: true so Telegram doesn't retry endlessly
  }
}

// Helper: Generate AI Response using Gemini
async function generateAIResponse(userMessage: string, customContext: string = '') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const fullPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\nBusiness Info:\n${customContext}\n\nCustomer Question: ${userMessage}`;

    const result = await model.generateContent(fullPrompt);
    return result.response.text() || "I'm sorry, I couldn't process that question right now.";
  } catch (error) {
    console.error('[Gemini AI Error]:', error);
    return "I'm having trouble connecting right now. Please try again shortly!";
  }
}

// Helper: Send message back to Telegram API
async function sendTelegramMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}