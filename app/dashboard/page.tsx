'use client';

import { useState, useEffect } from 'react';

interface DeploymentInstance {
  id: string;
  name: string;
  template_id: string;
  is_enabled: boolean;
  status?: string;
  user_email?: string;
  container_id?: string;
  created_at?: string;
  bot_token?: string;
  access_password?: string;
  custom_context?: string;
}

export default function Dashboard() {
  const [instances, setInstances] = useState<DeploymentInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<DeploymentInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Security Unlock Modal State
  const [unlockedInstances, setUnlockedInstances] = useState<Record<string, boolean>>({});
  const [authModalInstance, setAuthModalInstance] = useState<DeploymentInstance | null>(null);
  const [inputPassword, setInputPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Configure Telegram Token & Business Info Modal State
  const [keyModalInstance, setKeyModalInstance] = useState<DeploymentInstance | null>(null);
  const [userTelegramToken, setUserTelegramToken] = useState<string>('');
  const [businessInfo, setBusinessInfo] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  // Live Telemetry Metrics State
  const [metrics, setMetrics] = useState({ cpu: '12%', ram: '42%', gpu: '8%', temp: '44°C' });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/instance/metrics');
        const data = await res.json();
        if (data) {
          setMetrics({
            cpu: `${data.cpu_usage}%`,
            ram: `${data.memory_usage}%`,
            gpu: `${data.gpu_usage}%`,
            temp: `${data.gpu_temp}°C`,
          });
        }
      } catch (e) {}
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Fetch Existing Instances
  const fetchInstances = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instance/list');
      const data = await res.json();
      if (res.ok && data.instances) {
        setInstances(data.instances);
        setFilteredInstances(data.instances);
      } else {
        setError(data.error || 'Failed to fetch instances');
      }
    } catch (err: any) {
      console.error('Failed to fetch instances:', err);
      setError(err.message || 'Error loading instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (typeof window !== 'undefined' && window.location.search.includes('success=true')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  fetchInstances();
}, []);
  // Handle Search Filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredInstances(instances);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredInstances(
        instances.filter(
          (item) =>
            item.name?.toLowerCase().includes(query) ||
            item.template_id?.toLowerCase().includes(query) ||
            item.id?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, instances]);

  // Handle Security Unlock
  const handleUnlockInstance = () => {
    if (!authModalInstance) return;
    setAuthError(null);

    if (
      authModalInstance.access_password &&
      inputPassword !== authModalInstance.access_password
    ) {
      setAuthError('Invalid Access Password for this Bot Instance.');
      return;
    }

    setUnlockedInstances((prev) => ({ ...prev, [authModalInstance.id]: true }));
    setAuthModalInstance(null);
    setInputPassword('');
  };

  // Handle Save Telegram Token & Business Info Knowledge Base
  const handleSaveApiKey = async () => {
    if (!keyModalInstance) return;
    setIsSavingKey(true);

    try {
      const res = await fetch('/api/bot/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: keyModalInstance.id,
          botToken: userTelegramToken,
          custom_context: businessInfo,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert('🎉 Telegram Bot Token linked & 24/7 Webhook registered successfully!');
        setKeyModalInstance(null);
        setUserTelegramToken('');
        setBusinessInfo('');
        fetchInstances();
      } else {
        alert('❌ Failed to register bot: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('❌ Error connecting to registration endpoint.');
    } finally {
      setIsSavingKey(false);
    }
  };
const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this agent instance?')) return;

    try {
      const res = await fetch('/api/instance/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Instance deleted successfully!');
        fetchInstances();
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error deleting instance.');
    }
  const handleLoadCryptoTemplate = () => {
    const cryptoTemplate = `=== CRYPTO / WEB3 PROJECT KNOWLEDGE BASE ===

PROJECT OVERVIEW:
Project Name: [PROJECT NAME] ($[TICKER])
Blockchain: [Ethereum / Solana / BNB / Arbitrum]
Official Website: https://yourproject.com
Whitepaper/Docs: https://docs.yourproject.com

TOKENOMICS & CONTRACT ADDRESS:
- Token Symbol: $[TICKER]
- Official Contract Address: 0x0000000000000000000000000000000000000000
- Total Supply: 100,000,000
- Buy/Sell Tax: 0% / 0%

OFFICIAL LINKS (ONLY TRUST THESE):
- Telegram Group: https://t.me/yourgroup
- X (Twitter): https://x.com/yourproject
- DEX Swap Link: https://uniswap.org

FREQUENTLY ASKED QUESTIONS:
Q: What is the contract address?
A: Always verify the official CA: 0x0000000000000000000000000000000000000000. Admins will NEVER DM you first!

Q: How do I buy $[TICKER]?
A: Go to our official DEX link, connect your wallet, and swap for $[TICKER].

SECURITY RULES:
1. Admins will NEVER DM you first or ask for your wallet seed phrase.
2. Only trust official links pinned in this group.`;

    setBusinessInfo(cryptoTemplate);
  };
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2 font-medium"
          >
          ← Back to Home
          </a>
          <h1 className="text-3xl font-bold">Agent Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Locked instances require your emailed Instance ID & Password to manage
          </p>
        </div>
        <button
          onClick={fetchInstances}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm transition-all self-start md:self-auto"
        >
          🔄 Refresh Status
        </button>
      </div>

      {/* Search Bar */}
      <div className="max-w-6xl mx-auto mb-8 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search agents by name, template, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-80 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
        />
        <span className="text-xs text-slate-400 hidden md:block">
          Showing <span className="text-white font-medium">{filteredInstances.length}</span> active instances
        </span>
      </div>

      {/* Instance List / Grid */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading deployments...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400 text-sm">{error}</div>
        ) : filteredInstances.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold text-slate-200">No active instances found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Deploy an agent template from the marketplace to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInstances.map((instance) => {
              const isUnlocked = unlockedInstances[instance.id];

              return (
                <div
                  key={instance.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-base text-slate-100">{instance.name}</h3>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                        ● Running
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400 mb-4 font-mono">
                      <div className="flex justify-between">
                        <span>Instance ID:</span>
                        <span className="text-slate-200">{instance.id.slice(0, 10)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Template:</span>
                        <span className="text-slate-200">{instance.template_id}</span>
                      </div>
                    </div>
                  </div>
                  {/* Live CPU & GPU Telemetry Monitoring */}
<div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-[11px] font-mono">
  <div className="flex items-center justify-between">
    <span className="text-slate-400">💻 CPU Load:</span>
    <span className="text-purple-400 font-bold">{metrics.cpu}</span>
  </div>
  <div className="flex items-center justify-between">
    <span className="text-slate-400">⚡ RAM:</span>
    <span className="text-blue-400 font-bold">{metrics.ram}</span>
  </div>
  <div className="flex items-center justify-between">
    <span className="text-slate-400">🎮 GPU VRAM:</span>
    <span className="text-emerald-400 font-bold">{metrics.gpu}</span>
  </div>
  <div className="flex items-center justify-between">
    <span className="text-slate-400">🔥 GPU Temp:</span>
    <span className="text-amber-400 font-bold">{metrics.temp}</span>
  </div>
</div>

                  {!isUnlocked ? (
                    <button
                      onClick={() => setAuthModalInstance(instance)}
                      className="w-full mt-2 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      🔒 Enter Password to Unlock
                    </button>
                  ) : (
                    <div className="flex gap-2 mt-2">
  <button
    onClick={() => {
      setKeyModalInstance(instance);
      setUserTelegramToken(instance.bot_token || '');
      setBusinessInfo(instance.custom_context || '');
    }}
    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-all"
  >
    ⚙️ Configure
  </button>
  <button
    onClick={() => handleDeleteInstance(instance.id)}
    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
  >
    🗑️ Delete
  </button>
</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Password Unlock Modal */}
      {authModalInstance && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full text-white shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Unlock Instance</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the access password provided for instance{' '}
              <span className="font-mono text-purple-400">{authModalInstance.id.slice(0, 8)}</span>.
            </p>

            <input
              type="password"
              placeholder="Enter Access Password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white mb-3 focus:outline-none focus:border-purple-500"
            />

            {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setAuthModalInstance(null);
                  setInputPassword('');
                  setAuthError(null);
                }}
                className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlockInstance}
                className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg font-medium text-white"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Bot & Knowledge Base Modal */}
      {keyModalInstance && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full text-white shadow-2xl">
            <h3 className="text-lg font-semibold mb-1">🤖 Configure Telegram AI Agent</h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste your Telegram bot token and provide business FAQs to enable 24/7 automated support.
            </p>

            {/* Telegram Token Input */}
            <div className="mb-4 text-left">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Telegram Bot Token (from @BotFather)
              </label>
              <input
                type="text"
                placeholder="e.g. 8933256473:AAHoCwrKmPq..."
                value={userTelegramToken}
                onChange={(e) => setUserTelegramToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            {/* Business Details Input */}
{/* Business Details Input */}
<div className="mb-4 text-left">
  <div className="flex justify-between items-center mb-1">
    <label className="block text-xs font-semibold text-slate-300">
      🤖 Business Details & FAQs (Knowledge Base)
    </label>
    <button
      type="button"
      onClick={handleLoadCryptoTemplate}
      className="text-[10px] bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded transition-all font-medium"
    >
      🪙 Load Crypto Template
    </button>
  </div>

  <textarea
    rows={4}
    placeholder={`Enter details your bot should know:\ne.g.\n- Store Name: AutoCloud AI\n- Support Email: support@autocloud.ai`}
    value={businessInfo}
    onChange={(e) => setBusinessInfo(e.target.value)}
    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
  />
</div>
              <textarea
                rows={4}
                placeholder={`Enter details your bot should know:\ne.g.\n- Store Name: AutoCloud Store\n- Hours: 9 AM - 6 PM\n- Refund Policy: 14 days\n- Support Email: support@example.com`}
                value={businessInfo}
                onChange={(e) => setBusinessInfo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                  type="button"
                  onClick={() => setKeyModalInstance(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={isSavingKey || !userTelegramToken.trim()}
                  className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center gap-1.5"
                >
                  {isSavingKey ? 'Activating Webhook...' : '⚡ Save & Activate Bot'}
                </button>
              </div>
        </div>
      )}
    </div>
  );
}
}