'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DeploymentInstance {
  id: string;
  name: string;
  bot_name?: string;
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

  // Integration Guides Modal State
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'telegram' | 'webchat' | 'slack' | 'discord'>('telegram');

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

  // Helper to determine the channel from the instance data
  const getChannelFromInstance = (instance: any): 'telegram' | 'slack' | 'discord' | 'webchat' => {
    const raw = `${instance?.template_id || ''} ${instance?.name || ''} ${instance?.template || ''}`.toLowerCase();
    if (raw.includes('slack')) return 'slack';
    if (raw.includes('discord')) return 'discord';
    if (raw.includes('web') || raw.includes('widget')) return 'webchat';
    return 'telegram';
  };

  // Crew AI Runner Test State
  const [crewTaskPrompt, setCrewTaskPrompt] = useState<string>('');
  const [crewUserApiKey, setCrewUserApiKey] = useState<string>('');
  const [crewResult, setCrewResult] = useState<string | null>(null);
  const [isExecutingCrew, setIsExecutingCrew] = useState<boolean>(false);

  // Live Telemetry Metrics State
  const [metrics, setMetrics] = useState({ cpu: '12%', ram: '42%', gpu: '8%', temp: '44°C' });
  const [showTelegramGuide, setShowTelegramGuide] = useState<boolean>(false);
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
const handleScrapeWebsite = async () => {
    if (!websiteUrl || !keyModalInstance?.id) {
      setScrapeStatus('Please provide both a valid URL and ensure an instance is selected.');
      return;
    }

    try {
      setIsScraping(true);
      setScrapeStatus('Scraping website content...');

      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: keyModalInstance.id,
          url: websiteUrl,
          websiteUrl: websiteUrl,
        }),
      });

      const data = await res.json();

      if (res.ok && (data.text || data.content || data.scrapedContent || data.success)) {
        const content = data.text || data.content || data.scrapedContent;
        if (content) {
          setBusinessInfo((prev) => (prev ? `${prev}\n\n--- Scraped Knowledge ---\n${content}` : content));
        }
        setScrapeStatus('✓ Scraped and synced to business knowledge!');
      } else {
        setScrapeStatus(data.error || '✕ Failed to scrape website.');
      }
    } catch (err: any) {
      console.error('Scrape failed:', err);
      setScrapeStatus('✕ Error connecting to scrape service.');
    } finally {
      setIsScraping(false);
    }
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
      body: JSON.stringify({ instanceId, id: instanceId }),
    });

    const data = await res.json();
    if (res.ok) {
      // Instantly remove card from UI without waiting for reload
      setInstances((prev: any[]) => prev.filter((item: any) => item.id !== instanceId));
      setFilteredInstances((prev: any[]) => prev.filter((item: any) => item.id !== instanceId));
      fetchInstances();
      alert('Instance deleted successfully!');
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
                          setSelectedChannel(getChannelFromInstance(instance));
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#0D1017] border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative my-6 text-white">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-950/60 border border-purple-700/50 flex items-center justify-center text-purple-300 text-lg shadow-inner">
                  🤖
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Configure AI Telegram Agent</h3>
                  <p className="text-xs text-slate-400">Connect your bot and manage rules directly from Telegram</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeyModalInstance(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 transition"
              >
                ✕
              </button>
            </div>

            {/* Bot Display Name */}
            <div className="mb-4 text-left">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bot Display Name
              </label>
              <input
                type="text"
                placeholder="Felix"
                value={keyModalInstance.name || 'Felix'}
                onChange={(e) => {
                  setKeyModalInstance({
                    ...keyModalInstance,
                    name: e.target.value,
                  });
                }}
                className="w-full bg-[#080B11] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            {/* Telegram Bot Token Input */}
            <div className="mb-5 text-left">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Telegram Bot Token (from @BotFather)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                  🗝️
                </span>
                <input
                  type="text"
                  placeholder="8933256473:AAHoCwrKmPqdvsJf2gzuFFCc04usvF7E4vc"
                  value={userTelegramToken || ''}
                  onChange={(e) => setUserTelegramToken(e.target.value)}
                  className="w-full bg-[#080B11] border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            {/* How To Manage In Telegram Guide Box */}
            <div className="mb-5 text-left bg-purple-950/20 border border-purple-900/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="text-purple-400 text-xs">✨</span>
                <h4 className="text-[11px] font-bold text-purple-300 tracking-wider uppercase">
                  HOW TO MANAGE YOUR BOT ON TELEGRAM
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    <strong className="text-white">Open Interactive Menu:</strong> Send <code className="bg-purple-950/80 border border-purple-800/40 px-1.5 py-0.5 rounded text-purple-300 font-mono">/menu</code> in Telegram to view rules or delete items with 1-tap buttons.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    <strong className="text-white">Add New Policies:</strong> Send <code className="bg-purple-950/80 border border-purple-800/40 px-1.5 py-0.5 rounded text-purple-300 font-mono">/add &lt;rule&gt;</code> to append shipping, pricing, or store rules anytime.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    <strong className="text-white">Extract Any Website:</strong> Send <code className="bg-purple-950/80 border border-purple-800/40 px-1.5 py-0.5 rounded text-purple-300 font-mono">/website https://yourstore.com</code> to auto-train your bot instantly.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setKeyModalInstance(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={isSavingKey}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingKey ? 'Activating Webhook...' : '⚡ Save & Activate Bot'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* INTEGRATION GUIDES MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  📖 Channel Connection Guides
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Follow the steps below to connect your AI agent in under 2 minutes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-white text-base font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Channel Tabs */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-slate-950 border-b border-slate-800">
              {[
                { id: 'telegram', label: '✈️ Telegram' },
                { id: 'webchat', label: '🌐 Web Chat' },
                { id: 'slack', label: '👥 Slack' },
                { id: 'discord', label: '👾 Discord' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveGuideTab(tab.id as any)}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeGuideTab === tab.id
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Guide Steps */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh]">
              
              {/* TELEGRAM GUIDE */}
              {activeGuideTab === 'telegram' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <span>✈️</span> Telegram Bot Setup (3 Simple Steps)
                  </div>
                  
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 1: Get Bot Token</span>
                      <p className="text-slate-400 mt-1">Open Telegram, message <b>@BotFather</b>, type <code>/newbot</code>, and copy your API Token.</p>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 2: Save in AutoCloud</span>
                      <p className="text-slate-400 mt-1">Paste the token into the <b>Telegram Bot Token</b> box in your config window and click <b>Save & Activate</b>.</p>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 3: Activate Webhook (Click to Open)</span>
                      <p className="text-slate-400 mt-1">Paste this link into your browser (replace <code>YOUR_TOKEN</code> with your real token):</p>
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-purple-300 mt-1 select-all break-all">
                        https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://autocloud-ai-p448.vercel.app/api/telegram-webhook?teamId=bcd2b32a-e9f6-40f8-81fc-3f06ccbcbb46
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* WEB CHAT WIDGET GUIDE */}
              {activeGuideTab === 'webchat' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <span>🌐</span> Web Chat Widget (Instant Setup)
                  </div>
                  
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                    <span className="font-semibold text-white">Embed Script on Your Site</span>
                    <p className="text-slate-400 mt-1">Copy and paste this snippet right before the <code>&lt;/body&gt;</code> tag of your website or Shopify theme:</p>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-purple-300 mt-2 select-all break-all">
                      &lt;script src="https://autocloud-ai-p448.vercel.app/widget.js" data-team-id="bcd2b32a-e9f6-40f8-81fc-3f06ccbcbb46"&gt;&lt;/script&gt;
                    </div>
                  </div>
                </div>
              )}

              {/* SLACK GUIDE */}
              {activeGuideTab === 'slack' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <span>👥</span> Slack App Setup (4 Simple Steps)
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 1: Create App & Permissions</span>
                      <p className="text-slate-400 mt-1">Go to <b>api.slack.com/apps</b> → <b>Create App</b>. Under <b>OAuth & Permissions → Scopes</b>, add: <code>app_mention</code>, <code>chat:write</code>, and <code>im:history</code>.</p>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 2: Save Token in AutoCloud</span>
                      <p className="text-slate-400 mt-1">Click <b>Install to Workspace</b> in Slack, copy your <b>Bot Token</b> (starts with <code>xoxb-</code>), paste it into AutoCloud, and save.</p>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 3: Add Webhook Request URL</span>
                      <p className="text-slate-400 mt-1">In Slack, go to <b>Event Subscriptions</b> → turn <b>ON</b> → paste this link into <b>Request URL</b>:</p>
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-purple-300 mt-1 select-all break-all">
                        https://autocloud-ai-p448.vercel.app/api/slack/events?teamId=bcd2b32a-e9f6-40f8-81fc-3f06ccbcbb46
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 4: Subscribe to Bot Events</span>
                      <p className="text-slate-400 mt-1">On the same Event Subscriptions page, scroll down and add: <code>message.im</code> and <code>app_mention</code>.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* DISCORD GUIDE */}
              {activeGuideTab === 'discord' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <span>👾</span> Discord Bot Setup (3 Simple Steps)
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 1: Create Bot in Discord Portal</span>
                      <p className="text-slate-400 mt-1">Go to <b>discord.com/developers/applications</b> → <b>New Application</b> → click <b>Bot</b> tab → click <b>Reset Token</b> to copy your bot token.</p>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 2: Enable Message Permission</span>
                      <p className="text-slate-400 mt-1">On the same Bot page, scroll down and enable <b>Message Content Intent</b>.</p>
                    </div>

                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                      <span className="font-semibold text-white">Step 3: Save in AutoCloud & Invite</span>
                      <p className="text-slate-400 mt-1">Paste your Bot Token into AutoCloud and save. In Discord, use <b>OAuth2 URL Generator</b> (select <code>bot</code> + <code>Send Messages</code>) to invite the bot to your server.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}