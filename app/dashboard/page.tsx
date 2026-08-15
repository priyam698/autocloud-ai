'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  website_url?: string;
  api_key?: string;
  bot_type?: 'general' | 'ecommerce';
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

  // Configure Modal State
  const [keyModalInstance, setKeyModalInstance] = useState<DeploymentInstance | null>(null);
  const [botType, setBotType] = useState<'general' | 'ecommerce'>('general');
  const [userTelegramToken, setUserTelegramToken] = useState<string>('');
  // Multi-Channel Platform States
  const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'whatsapp' | 'webchat' | 'discord' | 'slack' | 'messenger'>('telegram');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState<string>('');
  const [whatsappToken, setWhatsappToken] = useState<string>('');
  const [discordToken, setDiscordToken] = useState<string>('');
  const [discordPublicKey, setDiscordPublicKey] = useState<string>('');
  const [slackToken, setSlackToken] = useState<string>('');
  const [messengerPageToken, setMessengerPageToken] = useState<string>('');

  const [businessInfo, setBusinessInfo] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [storeApiKey, setStoreApiKey] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeStatus, setScrapeStatus] = useState<string>('');

  // Crew AI Runner Test State
  const [crewTaskPrompt, setCrewTaskPrompt] = useState<string>('');
  const [crewUserApiKey, setCrewUserApiKey] = useState<string>('');
  const [crewResult, setCrewResult] = useState<string | null>(null);
  const [isExecutingCrew, setIsExecutingCrew] = useState<boolean>(false);

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

  const handleSaveApiKey = async () => {
    if (!keyModalInstance) return;
    setIsSavingKey(true);

    try {
      const res = await fetch('/api/bot/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: keyModalInstance.id,
          botToken: userTelegramToken || '',
          discord_token: discordToken || '',
          discord_public_key: discordPublicKey || '',
          slack_token: slackToken || '',
          whatsapp_phone_id: whatsappPhoneId || '',
          whatsapp_token: whatsappToken || '',
          messenger_token: messengerPageToken || '',
          custom_context: businessInfo || '',
          bot_type: botType || 'general',
          website_url: websiteUrl || '',
          api_key: storeApiKey || '',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const channelNames: Record<string, string> = {
          telegram: 'Telegram Bot',
          discord: 'Discord Bot',
          slack: 'Slack Bot',
          whatsapp: 'WhatsApp Business',
          messenger: 'Meta DM / Instagram',
          webchat: 'Web Chat Widget',
        };
        const channelLabel = channelNames[selectedChannel] || 'AI Agent';
        alert(`🎉 ${channelLabel} & Knowledge Base updated successfully!`);
        setKeyModalInstance(null);
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
  };
const handleRunCrewTask = async () => {
    if (!keyModalInstance || !crewTaskPrompt.trim()) return;
    setIsExecutingCrew(true);
    setCrewResult(null);

    try {
      const res = await fetch('/api/crew/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: keyModalInstance.id,
          password: keyModalInstance.access_password,
          taskPrompt: crewTaskPrompt,
          userGroqApiKey: crewUserApiKey,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCrewResult(data.execution.result);
      } else {
        setCrewResult('❌ Error: ' + (data.error || 'Execution failed'));
      }
    } catch (err: any) {
      setCrewResult('❌ Network error executing crew task.');
    } finally {
      setIsExecutingCrew(false);
    }
  };
  const handleLoadEcommerceTemplate = () => {
    const template = `==================================================
AUTOCLOUD AI — E-COMMERCE & BUSINESS SUPPORT
==================================================

1. SECURITY & PRIVATE MESSAGE (DM) RULES:
- PUBLIC GROUP RULE: Never ask for or process Order IDs, Account Numbers, Emails, or personal data in a public group.
- PRIVACY REDIRECT: If a customer requests order info or account help in a public group, reply:
  "🔒 For security and privacy, please send me a Direct Message (DM) with your Order ID or Account Number!"
- PRIVATE CHAT (DM) RULE: In direct messages, ask for their Order ID/Account Number, query the store database via our connected website API, and provide order status.

2. ESCALATION POLICY:
- If a query cannot be resolved automatically or requires manual intervention, tell the customer:
  "Please contact our direct support team at priyamrana069@gmail.com with your Order ID for assistance."

3. PRICING & POLICIES:
- Pricing: Fixed $12 flat rate per instance / month.
- Refund Policy: STRICT NO REFUNDS. ALL SALES ARE FINAL.
- Support Email: priyamrana069@gmail.com`;

    setBusinessInfo(template);
  };
const handleAutoScrape = async () => {
    if (!websiteUrl) {
      alert('Please enter a website URL');
      return;
    }

    const targetId = keyModalInstance?.id || instances[0]?.id;

    if (!targetId) {
      alert('No active deployment selected.');
      return;
    }

    setIsScraping(true);
    setScrapeStatus('⏳ Scraping website content...');

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: targetId, websiteUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setScrapeStatus(`✨ Success! Scraped ${data.charCount || ''} characters into AI knowledge.`);
        if (data.knowledgeContext) {
          setBusinessInfo(data.knowledgeContext);
        }
      } else {
        setScrapeStatus(`❌ Error: ${data.error || 'Failed to scrape'}`);
      }
    } catch (err) {
      setScrapeStatus('❌ Request failed. Check console.');
    } finally {
      setIsScraping(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
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

      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading deployments...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400 text-sm">{error}</div>
        ) : filteredInstances.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-lg font-semibold text-slate-200">No active instances found</h3>
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
                        • Running
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400 mb-4 font-mono">
                      <div className="flex justify-between">
                        <span>Instance ID:</span>
                        <span className="text-slate-200">{instance.id.slice(0, 10)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="text-purple-400 font-bold uppercase">
                          {instance.bot_type || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">💻 CPU Load:</span>
                        <span className="text-purple-400 font-bold">{metrics.cpu}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">🧠 RAM:</span>
                        <span className="text-blue-400 font-bold">{metrics.ram}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">⚡ GPU VRAM:</span>
                        <span className="text-emerald-400 font-bold">{metrics.gpu}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">🔥 GPU Temp:</span>
                        <span className="text-amber-400 font-bold">{metrics.temp}</span>
                      </div>
                    </div>
                  </div>

                  {!isUnlocked ? (
                    <button
                      onClick={() => setAuthModalInstance(instance)}
                      className="w-full mt-2 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 text-xs font-medium py-2 rounded-lg transition-all"
                    >
                      🔒 Enter Password to Unlock
                    </button>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setKeyModalInstance(instance);
                          setBusinessInfo(instance.custom_context || '');
                          setWebsiteUrl(instance.website_url || '');
                          setStoreApiKey(instance.api_key || '');
                        }}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                      >
                        ⚙️ Configure Bot
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

      {/* Security Unlock Modal */}
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
                className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlockInstance}
                className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg font-medium text-white transition-colors"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Bot Modal */}
      {keyModalInstance && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full text-white shadow-2xl max-h-[80vh] overflow-y-auto pb-12">
            <h3 className="text-lg font-semibold mb-1">🤖 Configure AI Agent</h3>
            <p className="text-xs text-slate-400 mb-4">
              Choose your bot configuration type and connect your company details or website integration.
            </p>

            {/* BOT TYPE TOGGLE BUTTONS */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setBotType('general')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                  botType === 'general'
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                💬 General Support Bot
              </button>
              <button
                type="button"
                onClick={() => {
                  setBotType('ecommerce');
                  handleLoadEcommerceTemplate();
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                  botType === 'ecommerce'
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🛍️ E-Commerce & Service
              </button>
            </div>

            {/* 🌐 OMNICHANNEL CHANNEL SELECTOR */}
            <div className="mb-5 text-left">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Select Integration Channel:
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-xl mb-4">
                {[
                  { id: 'telegram', label: '✈️ Telegram' },
                  { id: 'whatsapp', label: '💬 WhatsApp' },
                  { id: 'webchat', label: '🌐 Web Chat' },
                  { id: 'discord', label: '👾 Discord' },
                  { id: 'slack', label: '💼 Slack' },
                  { id: 'messenger', label: '📸 Meta DM' },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(ch.id as any)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      selectedChannel === ch.id
                        ? 'bg-purple-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              {/* 1. TELEGRAM INPUT */}
              {selectedChannel === 'telegram' && (
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium">Telegram Bot Token (from @BotFather):</label>
                  <input
                    type="text"
                    placeholder="e.g. 8933256473:AAHoCwrKmPq..."
                    value={userTelegramToken}
                    onChange={(e) => setUserTelegramToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* 2. WHATSAPP INPUTS */}
              {selectedChannel === 'whatsapp' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium">WhatsApp Phone Number ID:</label>
                    <input
                      type="text"
                      placeholder="e.g. 10928374829301"
                      value={whatsappPhoneId}
                      onChange={(e) => setWhatsappPhoneId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium">Meta Cloud System User Access Token:</label>
                    <input
                      type="password"
                      placeholder="EAAG..."
                      value={whatsappToken}
                      onChange={(e) => setWhatsappToken(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* 3. WEBSITE CHAT EMBED SCRIPT */}
              {selectedChannel === 'webchat' && (
                <div className="space-y-2 bg-slate-950 p-3.5 border border-purple-500/30 rounded-xl">
                  <p className="text-xs text-purple-300 font-semibold">Embed AI Chat on Any Website:</p>
                  <p className="text-[11px] text-slate-400">Copy and paste this script tag right before the closing <code>&lt;/body&gt;</code> tag on your website:</p>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <code className="text-[10px] font-mono text-purple-300 select-all">
                      {`<script src="https://autocloud-ai-p448.vercel.app/widget.js" data-instance-id="${keyModalInstance.id}"></script>`}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`<script src="https://autocloud-ai-p448.vercel.app/widget.js" data-instance-id="${keyModalInstance.id}"></script>`);
                        alert('📋 Web Chat embed code copied to clipboard!');
                      }}
                      className="text-[10px] bg-purple-600/40 text-purple-200 px-2.5 py-1 rounded hover:bg-purple-600/60 font-medium ml-2 shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* 4. DISCORD INPUT */}
      {selectedChannel === 'discord' && (
        <div className="space-y-3 text-left">
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              Discord Bot Token (Developer Portal)
            </label>
            <input
              type="password"
              placeholder="MTAy..."
              value={discordToken}
              onChange={(e) => setDiscordToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              Discord Application Public Key
            </label>
            <input
              type="text"
              placeholder="e.g. 1a2b3c4d5e6f..."
              value={discordPublicKey}
              onChange={(e) => setDiscordPublicKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Found under Discord Developer Portal &gt; General Information.
            </span>
          </div>
        </div>
      )}

              {/* 5. SLACK INPUT */}
              {selectedChannel === 'slack' && (
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium">Slack Bot User OAuth Token (xoxb-...):</label>
                  <input
                    type="password"
                    placeholder="xoxb-..."
                    value={slackToken}
                    onChange={(e) => setSlackToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* 6. MESSENGER / INSTAGRAM INPUT */}
              {selectedChannel === 'messenger' && (
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium">Meta Page / Instagram Access Token:</label>
                  <input
                    type="password"
                    placeholder="EAA..."
                    value={messengerPageToken}
                    onChange={(e) => setMessengerPageToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
            </div>

            {/* E-COMMERCE SPECIFIC INPUTS */}
            {botType === 'ecommerce' && (
              <div className="mb-4 space-y-3 bg-purple-950/30 border border-purple-500/20 p-3 rounded-lg text-left">
                <h4 className="text-xs font-bold text-purple-300">
                  🔗 Company Website & API Integration
                </h4>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Company Website / API Endpoint URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://yourcompany.com/api/v1/orders"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Store API Secret / Auth Key
                  </label>
                  <input
                    type="password"
                    placeholder="sk_live_your_secret_key"
                    value={storeApiKey}
                    onChange={(e) => setStoreApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div className="text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
  <div className="flex justify-between items-center mb-1">
    <strong className="text-purple-300">⚡ Sales & Update Webhook Endpoint:</strong>
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText('https://autocloud-ai-p448.vercel.app/api/broadcast/notify');
        alert('📋 Webhook URL copied to clipboard!');
      }}
      className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 px-2 py-0.5 rounded text-[9px]"
    >
      Copy URL
    </button>
  </div>
  <input
    type="text"
    readOnly
    value="https://autocloud-ai-p448.vercel.app/api/broadcast/notify"
    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-purple-400 text-[10px] font-mono cursor-pointer select-all focus:outline-none"
  />
  <span className="text-slate-500 block mt-1">
    (Buyers copy this URL into their store backend to automatically trigger sales alerts in Telegram)
  </span>
</div>
              </div>
            )}

            {/* Business Knowledge Base Input */}
            <div className="mb-4 text-left">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                📄 Business Knowledge Base & Rules
              </label>
              <textarea
                rows={6}
                value={businessInfo}
                onChange={(e) => setBusinessInfo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
           {/* 🌐 Auto-Train AI from Website URL */}
<div className="mb-4 text-left p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl">
  <label className="block text-xs font-semibold text-slate-300 mb-1">
    🌐 Auto-Train AI from Website URL
  </label>
  <p className="text-[11px] text-slate-400 mb-2">
    Enter customer website link to scrape FAQs, products, and support details automatically.
  </p>
  <div className="flex gap-2">
    <input
      type="url"
      placeholder="https://example.com"
      value={websiteUrl}
      onChange={(e) => setWebsiteUrl(e.target.value)}
      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
    />
    <button
      type="button"
      onClick={handleAutoScrape}
      disabled={isScraping}
      className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
    >
      {isScraping ? 'Scraping...' : '⚡ Auto-Scrape'}
    </button>
  </div>
  {scrapeStatus && (
    <p className="mt-2 text-[11px] text-purple-300 font-mono">
      {scrapeStatus}
    </p>
  )}
</div>
{/* 🚀 LIVE CREW TASK RUNNER TESTER */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-left">
              <h4 className="text-xs font-bold text-purple-300 mb-2 flex items-center gap-1.5">
                🚀 Test LangChain & CrewAI Execution
              </h4>
              <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
  Groq API Key (Optional — uses Vercel GROQ_API_KEY by default):
</label>
<input
  type="password"
  placeholder="gsk_..."
  value={crewUserApiKey}
  onChange={(e) => setCrewUserApiKey(e.target.value)}
  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
/>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Task Prompt / Agent Goal:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Summarize our customer support escalation guidelines and draft a sample response."
                    value={crewTaskPrompt}
                    onChange={(e) => setCrewTaskPrompt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRunCrewTask}
                  disabled={isExecutingCrew || !crewTaskPrompt.trim()}
                  className="w-full py-2 bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50 disabled:opacity-50 text-purple-200 text-xs font-semibold rounded-lg transition-all"
                >
                  {isExecutingCrew ? '⚡ Running Crew Agents...' : '▶ Execute Agent Task'}
                </button>

                {crewResult && (
                  <div className="mt-3 p-3 bg-slate-900 border border-purple-500/30 rounded-lg">
                    <p className="text-[10px] text-purple-300 font-bold mb-1">Agent Output:</p>
                    <pre className="text-[11px] text-slate-200 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {crewResult}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            {/* Discord /ask Command Guide Notice */}
          <div className="mb-4 p-3 bg-blue-950/50 border border-blue-500/30 rounded-lg flex items-start gap-3 text-xs text-blue-200">
            <span className="text-base">💡</span>
            <div>
              <strong className="text-white block font-medium mb-0.5">How your users talk to the bot in Discord:</strong>
              <p className="text-blue-300">
                Discord webhook bots require slash commands. Tell your server members to type <code className="bg-blue-900/80 px-1.5 py-0.5 rounded text-blue-100 font-mono font-bold">/ask</code> in any channel to start chatting!
              </p>
            </div>
          </div>
          {/* Bot-Specific Knowledge Base Link */}
          <div className="pt-3 pb-2 border-t border-slate-800 my-4">
            <Link
              href={`/dashboard/knowledge?teamId=${keyModalInstance?.id || 'default'}`}
              target="_blank"
              className="w-full py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <span>📚</span>
              <span>Open Knowledge Base & Training for this Bot</span>
              <span className="text-[10px] opacity-70">↗</span>
            </Link>
          </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => setKeyModalInstance(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={isSavingKey}
                className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center gap-1.5"
              >
                {isSavingKey ? 'Activating Webhook...' : '⚡ Save & Activate Bot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}