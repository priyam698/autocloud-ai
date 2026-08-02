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
}

export default function Dashboard() {
  const [instances, setInstances] = useState<DeploymentInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<DeploymentInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInstance, setSelectedInstance] = useState<DeploymentInstance | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instance/list');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      
      let list: DeploymentInstance[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.instances && Array.isArray(data.instances)) {
        list = data.instances;
      }

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <a
            href="/"
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline mb-1 inline-flex items-center gap-1 font-medium transition"
          >
            ← Back to Marketplace
          </a>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Agent Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Active instances and deployments registered to your account
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInstances}
            className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition duration-150 flex items-center gap-2 shadow-sm"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh Status
          </button>
        </div>
      </div>

      {/* Control / Filter Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search agents by name, template, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500/50 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-indigo-400 font-semibold">{filteredInstances.length}</span> of {instances.length} active instances
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Fetching registered agent instances...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-red-400 py-10">
          <p className="font-semibold text-base mb-1">Failed to load instances</p>
          <p className="text-xs text-red-300/80">{error}</p>
          <button
            onClick={fetchInstances}
            className="mt-4 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-medium transition"
          >
            Try Again
          </button>
        </div>
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
          {filteredInstances.map((instance) => (
            <div
              key={instance.id}
              className="bg-slate-900/60 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-5 space-y-4 shadow-lg backdrop-blur-sm transition duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Status & Name */}
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-semibold text-base text-white truncate max-w-[200px]">
                    {instance.name || 'AI Agent Instance'}
                  </h3>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium capitalize shrink-0 border ${
                      instance.status === 'running'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : instance.status === 'stopped'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    ● {instance.status || 'unknown'}
                  </span>
                </div>

                {/* Instance Details */}
                <div className="space-y-1.5 text-xs text-slate-400 font-mono bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Template:</span>
                    <span className="text-slate-300 font-sans">{instance.template_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Container:</span>
                    <span className="text-slate-300 truncate max-w-[140px]">{instance.container_id || 'N/A'}</span>
                  </div>
                  {instance.user_email && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Owner:</span>
                      <span className="text-slate-300 truncate max-w-[140px]">{instance.user_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between text-xs gap-2">
                <button
                  onClick={() => copyToClipboard(instance.id, instance.id)}
                  className="text-slate-400 hover:text-slate-200 transition font-mono text-[11px] flex items-center gap-1"
                >
                  {copiedId === instance.id ? '✓ Copied ID' : `ID: ${instance.id.substring(0, 8)}...`}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedInstance(instance)}
                    className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/20 transition"
                  >
                    Details
                  </button>

                  <button
                    onClick={() => handleDeleteInstance(instance.id)}
                    disabled={isDeleting === instance.id}
                    className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded border border-rose-500/20 transition disabled:opacity-50"
                  >
                    {isDeleting === instance.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
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
              {selectedInstance.bot_token && (
                <p className="truncate"><span className="text-slate-500">Bot Token:</span> {selectedInstance.bot_token}</p>
              )}
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