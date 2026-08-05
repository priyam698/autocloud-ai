import os
import logging
import threading
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from groq import Groq

# ---------------- CONFIGURATION ----------------
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Provider API Keys
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY")
USER_GROQ_KEY = os.getenv("USER_GROQ_API_KEY") or os.getenv("GROQ_API_KEY")

# Security Access IDs
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID")
CONSUMER_TELEGRAM_ID = os.getenv("CONSUMER_TELEGRAM_ID")

# Initialize Groq Client (Fallback)
groq_client = Groq(api_key=USER_GROQ_KEY) if USER_GROQ_KEY else None

# Enable Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ---------------- SECURITY MIDDLEWARE ----------------
def is_user_authorized(user_id) -> bool:
    str_id = str(user_id)
    allowed_ids = []
    if ADMIN_TELEGRAM_ID:
        allowed_ids.append(str(ADMIN_TELEGRAM_ID))
    if CONSUMER_TELEGRAM_ID:
        allowed_ids.append(str(CONSUMER_TELEGRAM_ID))
    
    # If no explicit security IDs are configured, allow access
    if not allowed_ids:
        return True
        
    return str_id in allowed_ids

# ---------------- AI INFERENCE GENERATOR ----------------
def generate_ai_reply(prompt: str) -> str:
    # 1. Primary AI Provider: Cerebras
    if CEREBRAS_API_KEY:
        try:
            res = requests.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {CEREBRAS_API_KEY.strip()}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama3.1-8b",
                    "messages": [
                        {"role": "system", "content": "You are Felix, a helpful AI assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7
                },
                timeout=10
            )
            if res.status_code == 200:
                data = res.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
                if content:
                    return content
            else:
                logging.error(f"[Cerebras Error {res.status_code}]: {res.text}")
        except Exception as e:
            logging.error(f"[Cerebras Exception]: {e}")

    # 2. Fallback AI Provider: Groq
    if groq_client:
        try:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are Felix, a helpful AI assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1024,
            )
            if completion.choices and completion.choices[0].message.content:
                return completion.choices[0].message.content
        except Exception as e:
            logging.error(f"[Groq Exception]: {e}")

    return "I am currently experiencing a brief processing delay. Please try asking again in a moment!"

# ---------------- BOT HANDLERS ----------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_user_authorized(user_id):
        await update.message.reply_text("⛔ Unauthorized Access: This bot is private to its owner.")
        return
    await update.message.reply_text("Hello! I am Felix, your AI Assistant. How can I help you today?")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    user_id = update.effective_user.id
    if not is_user_authorized(user_id):
        await update.message.reply_text("⛔ Access Denied.")
        return

    user_text = update.message.text
    response_text = generate_ai_reply(user_text)
    await update.message.reply_text(response_text)

# ---------------- HEALTH CHECK SERVER (FOR RENDER) ----------------
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Bot is running")

def run_health_server():
    server = HTTPServer(('0.0.0.0', 8080), HealthCheckHandler)
    server.serve_forever()

# ---------------- MAIN EXECUTION ----------------
if __name__ == '__main__':
    if not TELEGRAM_BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN environment variable is missing!")
        exit(1)

    # Start health check server on port 8080 for Render keep-alive
    threading.Thread(target=run_health_server, daemon=True).start()

    # Build Application
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN.strip()).build()

    # Add Handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Bot is starting polling...")
    app.run_polling(drop_pending_updates=True)