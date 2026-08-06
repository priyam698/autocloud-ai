'use client';

import { useState } from 'react';

export default function BotSettingsPage({ userId }: { userId: string }) {
  const [botToken, setBotToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleRegisterBot = async () => {
    if (!botToken.trim()) return;
    setLoading(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/bot/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, botToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMessage('✅ Bot successfully registered and activated!');
        setBotToken('');
      } else {
        setStatusMessage(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800">
      <h2 className="text-xl font-bold mb-4">Connect Your Telegram Bot</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Telegram Bot Token (from @BotFather)
          </label>
          <input
            type="text"
            placeholder="123456789:ABCdefGhIJKlmNoPQ..."
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleRegisterBot}
          disabled={loading || !botToken}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
        >
          {loading ? 'Activating Bot...' : 'Activate Bot'}
        </button>

        {statusMessage && (
          <p className="text-sm mt-2 text-slate-300">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}