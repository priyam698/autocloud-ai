'use client';

import { useState } from 'react';

export default function SlackIntegrationPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');

  const handleSave = async () => {
    setStatus('Saving...');
    const res = await fetch('/api/integrations/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slackToken: token }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus('✅ Slack Connected Successfully!');
    } else {
      setStatus(`❌ Error: ${data.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '500px', fontFamily: 'sans-serif' }}>
      <h2>Connect Your Slack Workspace</h2>
      <p style={{ color: '#666' }}>Paste your Bot User OAuth Token below to enable AI support in your Slack channels.</p>
      
      <input
        type="password"
        placeholder="xoxb-your-slack-bot-token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      />
      
      <button 
        onClick={handleSave}
        style={{ width: '100%', padding: '10px', backgroundColor: '#4A154B', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        Connect Slack
      </button>

      {status && <p style={{ marginTop: '15px' }}>{status}</p>}
    </div>
  );
}