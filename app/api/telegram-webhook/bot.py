import os
import logging
from telegram import Update, constants
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from groq import Groq

# ---------------- CONFIGURATION ----------------
# It's best practice on cloud servers to use Environment Variables (fallback provided below)
# ---------------- CONFIGURATION ----------------
# Read credentials securely from Environment Variables on Render
TELEGRAM_BOT_TOKEN = os.getenv("8933256473:AAHoCwrKmPqdvsJf2gzuFFCcO4usvF7E4vc")
GROQ_API_KEY = os.getenv("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")

MODEL_NAME = "llama-3.3-70b-versatile"

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# /start command handler
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Hello! I'm your AI Telegram bot. Ask me anything!")

# Handle incoming text messages
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text

    # Show typing status in Telegram
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": user_text}],
            temperature=0.6
        )

        reply_text = response.choices[0].message.content

        # Strip out thinking tags if present
        if "</think>" in reply_text:
            reply_text = reply_text.split("</think>")[-1].strip()

        # Send formatted reply back to user
        await update.message.reply_text(
            reply_text, 
            parse_mode=constants.ParseMode.MARKDOWN
        )

    except Exception as e:
        logging.error(f"Error generating AI response: {e}")
        await update.message.reply_text("Sorry, something went wrong while generating the response.")

# Main entrypoint
if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("🤖 Bot is running 24/7...")
    app.run_polling()