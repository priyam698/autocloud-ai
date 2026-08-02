'use client';

import { useState, useEffect } from 'react';

interface DeploymentInstance {
  id: string;
  name?: string;
  template_id?: string;
  status?: string;
  user_email?: string;
  container_id?: string;
  created_at?: string;
  bot_token?: string;
  access_password?: string;
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

  // Configure Telegram Token Modal State
  const [keyModalInstance, setKeyModalInstance] = useState<DeploymentInstance | null>(null);
  const [userTelegramToken, setUserTelegramToken] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);

  // Instance Details Modal State
  const [selectedInstance, setSelectedInstance] = useState<DeploymentInstance | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instance/list');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      let list: DeploymentInstance[] = [];
      if (Array.isArray(data)) list = data;
      else if (data.instances && Array.isArray(data.instances)) list = data.instances;

      setInstances(list);
      setFilteredInstances(list);
    } catch (err: any) {
      console.error('Failed to fetch instances:', err);
      setError(err.message || 'Error loading instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
            item.user_email?.toLowerCase().includes(query) ||
            item.id?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, instances]);

  // Handle Security Unlock
  const handleUnlockInstance = () => {
    if (!authModalInstance) return;
    setAuthError(null);

    if (authModalInstance.access_password && inputPassword !== authModalInstance.access_password) {
      setAuthError('Invalid Access Password for this Bot Instance.');
      return;
    }

    setUnlockedInstances((prev) => ({ ...prev, [authModalInstance.id]: true }));
    setAuthModalInstance(null);
    setInputPassword('');
  };

  // Save Telegram Bot Token
  const handleSaveApiKey = async () => {
    if (!keyModalInstance) return;
    setIsSavingKey(true);

    try {
      const res = await fetch('/api/instance/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instance_id: keyModalInstance.id,
          api_key: userTelegramToken,
        }),
      });

      if (res.ok) {
        alert('Telegram Bot Token linked successfully!');
        setKeyModalInstance(null);
        setUserTelegramToken('');
        fetchInstances();
      } else {
        alert('Failed to update bot token. Please check permissions.');
      }
    } catch (err) {
      alert('Error saving bot token.');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this instance?')) return;
    setIsDeleting(id);
    try {
      const res = await fetch('/api/instance/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: id }),
      });
      if (res.ok) {
        setInstances((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert('Failed to delete instance');
      }
    } catch (err) {
      alert('Error deleting instance');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-6 md:p-10 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <a href="/" className="text-xs text-indigo-400 hover:underline mb-1 inline-block">
            ← Back to Marketplace
          </a>
          <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Locked instances require your emailed Instance ID & Password to manage
          </p>
        </div>

        <button
          onClick={fetchInstances}
          className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
        >
          🔄 Refresh Status
        </button>
      </div>

      {/* Search & Filter Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <input
          type="text"
          placeholder="Search agents by name, template, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
        />
        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-indigo-400 font-semibold">{filteredInstances.length}</span> of {instances.length} active instances
        </div>
      </div>

      {/* Instances Grid */}
      {loading ? (
        <div className="text-slate-400 py-10 text-center">Loading protected instances...</div>
      ) : error ? (
        <div className="text-red-400 py-10 text-center">Error loading instances: {error}</div>
      ) : filteredInstances.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl py-16 px-6 text-center text-slate-400 space-y-3">
          <div className="text-4xl">🤖</div>
          <p className="text-base font-medium text-slate-300">No active instances found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No agent instances matched your search query.'
              : 'Deploy an agent template from the marketplace to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInstances.map((instance) => {
            const isUnlocked = unlockedInstances[instance.id];

            return (
              <div
                key={instance.id}
                className="bg-slate-900/60 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-5 space-y-4 shadow-lg backdrop-blur-sm transition duration-200 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-base text-white truncate max-w-[200px]">
                      {instance.name || 'AI Agent Instance'}
                    </h3>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium capitalize shrink-0 border ${
                        instance.status === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      ● {instance.status || 'unknown'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Instance ID:</span>
                      <span className="text-slate-300">{instance.id.substring(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Template:</span>
                      <span className="text-slate-300">{instance.template_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security:</span>
                      <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {isUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs gap-2">
                  {!isUnlocked ? (
                    <button
                      onClick={() => setAuthModalInstance(instance)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition"
                    >
                      🔒 Enter Password to Unlock
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setKeyModalInstance(instance);
                            setUserTelegramToken(instance.bot_token || '');
                          }}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/20 transition text-xs font-medium"
                        >
                          🔑 Connect Bot Token
                        </button>
                        <button
                          onClick={() => setSelectedInstance(instance)}
                          className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/20 transition text-xs"
                        >
                          Details
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteInstance(instance.id)}
                          disabled={isDeleting === instance.id}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded border border-rose-500/20 transition text-xs disabled:opacity-50"
                        >
                          {isDeleting === instance.id ? '...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setUnlockedInstances((prev) => ({ ...prev, [instance.id]: false }))}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition text-xs"
                        >
                          🔒 Lock
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unlock Password Modal */}
      {authModalInstance && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">
              Unlock {authModalInstance.name}
            </h3>
            <p className="text-xs text-slate-400">
              Enter the Access Password sent to your email receipt for Instance ID:{' '}
              <span className="font-mono text-indigo-400">{authModalInstance.id}</span>
            </p>

            <input
              type="password"
              placeholder="Enter Access Password..."
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
            />

            {authError && <p className="text-xs text-red-400">{authError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAuthModalInstance(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlockInstance}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium"
              >
                Authenticate & Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Telegram Token Modal */}
      {keyModalInstance && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">Connect Telegram Bot</h3>
              <button
                onClick={() => setKeyModalInstance(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 block font-medium">
                Enter Telegram Bot Token (from @BotFather):
              </label>
              <input
                type="password"
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ"
                value={userTelegramToken}
                onChange={(e) => setUserTelegramToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                * AI compute (Groq Llama 3.3) is provided automatically by AutoCloud AI.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setKeyModalInstance(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={isSavingKey || !userTelegramToken.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {isSavingKey ? 'Connecting...' : 'Activate Bot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedInstance && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">{selectedInstance.name}</h3>
              <button
                onClick={() => setSelectedInstance(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p><span className="text-slate-500">ID:</span> {selectedInstance.id}</p>
              <p><span className="text-slate-500">Template:</span> {selectedInstance.template_id}</p>
              <p><span className="text-slate-500">Status:</span> {selectedInstance.status}</p>
              <p><span className="text-slate-500">Container:</span> {selectedInstance.container_id}</p>
              <p><span className="text-slate-500">Owner:</span> {selectedInstance.user_email}</p>
              <p><span className="text-slate-500">Created At:</span> {selectedInstance.created_at || 'N/A'}</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedInstance(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
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