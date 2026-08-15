(function () {
  const currentScript = document.currentScript;
  const teamId = currentScript ? (currentScript.getAttribute('data-team-id') || 'T0BQ21MN7FV') : 'T0BQ21MN7FV';
  const backendUrl = currentScript ? new URL(currentScript.src).origin : 'https://autocloud-ai-p448.vercel.app';

  // Persistent user session per browser
  let sessionId = localStorage.getItem('autocloud_chat_session');
  if (!sessionId) {
    sessionId = 'web_' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem('autocloud_chat_session', sessionId);
  }

  // Inject Styles
  const style = document.createElement('style');
  style.innerHTML = `
    .ac-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #4f46e5;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4);
      z-index: 999999;
      transition: transform 0.2s ease, background 0.2s ease;
    }
    .ac-widget-btn:hover { transform: scale(1.06); background: #4338ca; }
    .ac-widget-window {
      position: fixed;
      bottom: 94px;
      right: 24px;
      width: 380px;
      height: 540px;
      max-height: calc(100vh - 120px);
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 18px;
      display: none;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      z-index: 999999;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    .ac-header {
      background: #1e293b;
      padding: 16px;
      color: #f8fafc;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
    }
    .ac-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ac-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.45;
      word-break: break-word;
    }
    .ac-msg-user {
      background: #4f46e5;
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 2px;
    }
    .ac-msg-bot {
      background: #1e293b;
      color: #e2e8f0;
      align-self: flex-start;
      border-bottom-left-radius: 2px;
    }
    .ac-input-container {
      padding: 12px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
      display: flex;
      gap: 8px;
    }
    .ac-input {
      flex: 1;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
      outline: none;
    }
    .ac-input:focus { border-color: #6366f1; }
    .ac-send-btn {
      background: #4f46e5;
      border: none;
      color: #fff;
      padding: 0 16px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }
    .ac-send-btn:hover { background: #4338ca; }
  `;
  document.head.appendChild(style);

  // Inject DOM Elements
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="ac-widget-btn" id="ac-toggle" title="Chat with AutoCloud AI">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </div>
    <div class="ac-widget-window" id="ac-window">
      <div class="ac-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;"></span>
          <span>AutoCloud AI</span>
        </div>
        <span style="cursor:pointer;opacity:0.7;font-size:20px" id="ac-close">&times;</span>
      </div>
      <div class="ac-messages" id="ac-msgs">
        <div class="ac-msg ac-msg-bot">Hello! How can I help you today?</div>
      </div>
      <form class="ac-input-container" id="ac-form">
        <input class="ac-input" id="ac-input" placeholder="Ask anything..." autocomplete="off" />
        <button class="ac-send-btn" type="submit">Send</button>
      </form>
    </div>
  `;
  document.body.appendChild(container);

  // Widget Logic
  const toggleBtn = document.getElementById('ac-toggle');
  const chatWindow = document.getElementById('ac-window');
  const closeBtn = document.getElementById('ac-close');
  const form = document.getElementById('ac-form');
  const input = document.getElementById('ac-input');
  const msgContainer = document.getElementById('ac-msgs');

  let isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) input.focus();
  }

  toggleBtn.onclick = toggleChat;
  closeBtn.onclick = toggleChat;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // User message
    const userBubble = document.createElement('div');
    userBubble.className = 'ac-msg ac-msg-user';
    userBubble.textContent = text;
    msgContainer.appendChild(userBubble);
    input.value = '';
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Bot Typing Indicator
    const typingBubble = document.createElement('div');
    typingBubble.className = 'ac-msg ac-msg-bot';
    typingBubble.textContent = 'Thinking...';
    msgContainer.appendChild(typingBubble);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const res = await fetch(`${backendUrl}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, sessionId, message: text }),
      });
      const data = await res.json();
      typingBubble.textContent = data.reply || 'Sorry, I could not process your request.';
    } catch (err) {
      typingBubble.textContent = 'Network error. Please try again.';
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
  };
})();