import os
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from groq import Groq

# ----------------- CONFIGURATION -----------------
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Fallback to system GROQ key if user didn't provide their own
GROQ_API_KEY = os.getenv("USER_GROQ_API_KEY") or os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.3-70b-versatile"

# Authorized Users (Your Telegram ID + Consumer's Telegram ID)
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID")  # E.g., "6699188889"
CONSUMER_TELEGRAM_ID = os.getenv("CONSUMER_TELEGRAM_ID")  # Set upon deployment/purchase

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ----------------- SECURITY MIDDLEWARE -----------------
def is_user_authorized(user_id: int) -> bool:
    str_id = str(user_id)
    allowed_ids = [str(ADMIN_TELEGRAM_ID)]
    if CONSUMER_TELEGRAM_ID:
        allowed_ids.append(str(CONSUMER_TELEGRAM_ID))
    return str_id in allowed_ids

# ----------------- BOT HANDLERS -----------------
async font_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_user_authorized(user_id):
        await update.message.reply_text("⛔ Unauthorized Access: This bot is private to its owner.")
        return
    await update.message.reply_text("Hello! I am your Felix AI Assistant. How can I help you today?")

async font_handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_user_authorized(user_id):
        await update.message.reply_text("⛔ Access Denied.")
        return

    user_text = update.message.text
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are Felix, a helpful AI assistant."},
                {"role": "user", "content": user_text}
            ],
            temperature=0.7,
            max_tokens=1024,
        )
        response_text = completion.choices[0].message.content
        await update.message.reply_text(response_text)
    except Exception as e:
        logging.error(f"Groq API Error: {e}")
        await update.message.reply_text("Error processing request.")

# ----------------- HEALTH CHECK SERVER -----------------
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Bot is running")

def run_health_server():
    server = HTTPServer(('0.0.0.0', 8080), HealthCheckHandler)
    server.serve_forever()

# ----------------- MAIN EXECUTION -----------------
if __name__ == '__main__':
    threading.Thread(target=run_health_server, daemon=True).start()
    
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    print("Bot is starting...")
    app.run_polling()