(function () {
  // 1. Get Instance ID from script tag
  const scriptTag = document.currentScript || document.querySelector('script[data-instance-id]');
  const instanceId = scriptTag ? scriptTag.getAttribute('data-instance-id') : null;

  if (!instanceId) {
    console.error('AutoCloud AI Widget: Missing data-instance-id attribute.');
    return;
  }

  // 2. Inject CSS Styles
  const style = document.createElement('style');
  style.innerHTML = `
    #autocloud-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #autocloud-widget-button {
      width: 56px;
      height: 56px;
      border-radius: 28px;
      background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.5);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #autocloud-widget-button:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 30px -5px rgba(139, 92, 246, 0.7);
    }
    #autocloud-widget-window {
      display: none;
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 360px;
      height: 520px;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      flex-direction: column;
      overflow: hidden;
    }
    .autocloud-header {
      background: #0f172a;
      padding: 14px 16px;
      border-bottom: 1px solid #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    .autocloud-body {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #030712;
    }
    .autocloud-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .autocloud-msg-user {
      align-self: flex-end;
      background: #7c3aed;
      color: white;
      border-bottom-right-radius: 2px;
    }
    .autocloud-msg-bot {
      align-self: flex-start;
      background: #1e293b;
      color: #e2e8f0;
      border-bottom-left-radius: 2px;
    }
    .autocloud-footer {
      padding: 12px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
      display: flex;
      gap: 8px;
    }
    .autocloud-input {
      flex: 1;
      background: #030712;
      border: 1px solid #334155;
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
    }
    .autocloud-send {
      background: #7c3aed;
      color: white;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);

  // 3. Inject Widget DOM Elements
  const container = document.createElement('div');
  container.id = 'autocloud-widget-container';
  container.innerHTML = `
    <div id="autocloud-widget-window">
      <div class="autocloud-header">
        <span>🤖 AI Assistant</span>
        <button id="autocloud-close-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div class="autocloud-body" id="autocloud-messages">
        <div class="autocloud-msg autocloud-msg-bot">Hello! How can I help you today?</div>
      </div>
      <div class="autocloud-footer">
        <input type="text" id="autocloud-input-field" class="autocloud-input" placeholder="Type a message..." />
        <button id="autocloud-send-btn" class="autocloud-send">Send</button>
      </div>
    </div>
    <button id="autocloud-widget-button">💬</button>
  `;
  document.body.appendChild(container);

  // 4. Widget Interactivity & Messaging Logic
  const button = document.getElementById('autocloud-widget-button');
  const windowEl = document.getElementById('autocloud-widget-window');
  const closeBtn = document.getElementById('autocloud-close-btn');
  const sendBtn = document.getElementById('autocloud-send-btn');
  const inputField = document.getElementById('autocloud-input-field');
  const messagesBox = document.getElementById('autocloud-messages');

  button.onclick = () => {
    windowEl.style.display = windowEl.style.display === 'flex' ? 'none' : 'flex';
  };
  closeBtn.onclick = () => {
    windowEl.style.display = 'none';
  };

  async function sendMessage() {
    const text = inputField.value.trim();
    if (!text) return;

    // Append user message UI
    const userMsg = document.createElement('div');
    userMsg.className = 'autocloud-msg autocloud-msg-user';
    userMsg.textContent = text;
    messagesBox.appendChild(userMsg);
    inputField.value = '';
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Append typing indicator
    const botMsg = document.createElement('div');
    botMsg.className = 'autocloud-msg autocloud-msg-bot';
    botMsg.textContent = 'Thinking...';
    messagesBox.appendChild(botMsg);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    try {
      const res = await fetch('https://autocloud-ai-p448.vercel.app/api/widget/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, message: text }),
      });
      const data = await res.json();
      botMsg.textContent = data.reply || 'Sorry, I could not process your request.';
    } catch (err) {
      botMsg.textContent = 'Connection error. Please try again.';
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  sendBtn.onclick = sendMessage;
  inputField.onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };
})();