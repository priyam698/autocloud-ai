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

  // Unlock Modal State
  const [unlockedInstances, setUnlockedInstances] = useState<Record<string, boolean>>({});
  const [authModalInstance, setAuthModalInstance] = useState<DeploymentInstance | null>(null);
  const [inputPassword, setInputPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Configure Key Modal State
  const [keyModalInstance, setKeyModalInstance] = useState<DeploymentInstance | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);

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

  // Handle Authentication / Unlocking
  const handleUnlockInstance = () => {
    if (!authModalInstance) return;
    setAuthError(null);

    // Verify Password against record (or via API)
    if (authModalInstance.access_password && inputPassword !== authModalInstance.access_password) {
      setAuthError('Invalid Access Password for this Bot Instance');
      return;
    }

    setUnlockedInstances((prev) => ({ ...prev, [authModalInstance.id]: true }));
    setAuthModalInstance(null);
    setInputPassword('');
  };

  // Save API Key Function
  const handleSaveApiKey = async () => {
    if (!keyModalInstance) return;
    setIsSavingKey(true);

    try {
      const res = await fetch('/api/instance/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Instance-Password': inputPassword,
        },
        body: JSON.stringify({
          instance_id: keyModalInstance.id,
          api_key: userApiKey,
        }),
      });

      if (res.ok) {
        alert('API Key updated successfully!');
        setKeyModalInstance(null);
        setUserApiKey('');
        fetchInstances();
      } else {
        alert('Failed to update API key. Check permissions.');
      }
    } catch (err) {
      alert('Error saving API key.');
    } finally {
      setIsSavingKey(false);
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

      {/* Filter Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
        />
        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-indigo-400 font-semibold">{filteredInstances.length}</span> instances
        </div>
      </div>

      {/* Instance Cards */}
      {loading ? (
        <div className="text-slate-400 py-10 text-center">Loading protected instances...</div>
      ) : error ? (
        <div className="text-red-400 py-10 text-center">Error: {error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInstances.map((instance) => {
            const isUnlocked = unlockedInstances[instance.id];

            return (
              <div
                key={instance.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-base text-white truncate">
                      {instance.name || 'AI Agent'}
                    </h3>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                        instance.status === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      ● {instance.status || 'unknown'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Instance ID:</span>
                      <span className="text-slate-300">{instance.id.substring(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Template:</span>
                      <span className="text-slate-300">{instance.template_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security:</span>
                      <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {isUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lock Controls */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs gap-2">
                  {!isUnlocked ? (
                    <button
                      onClick={() => setAuthModalInstance(instance)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition"
                    >
                      🔒 Enter Password to Unlock
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full justify-end">
                      <button
                        onClick={() => {
                          setKeyModalInstance(instance);
                          setUserApiKey(instance.bot_token || '');
                        }}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg"
                      >
                        🔑 Config Key
                      </button>
                      <button
                        onClick={() => setUnlockedInstances((prev) => ({ ...prev, [instance.id]: false }))}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        🔒 Lock
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unlock Security Modal */}
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
              placeholder="Enter Password..."
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

      {/* API Key Modal */}
      {keyModalInstance && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Set Provider API Key</h3>
            <input
              type="password"
              placeholder="sk-..."
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setKeyModalInstance(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={isSavingKey}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs"
              >
                {isSavingKey ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}