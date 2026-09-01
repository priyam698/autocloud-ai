'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, 
  Settings, 
  BookOpen, 
  RefreshCw, 
  ShieldCheck, 
  Globe2, 
  MessageSquare,
  Copy, 
  Check,
  Trash2,
  Loader2,
  Code2,
  Send,
  ArrowLeft
} from 'lucide-react';
import ConfigureAgentModal from '@/components/ConfigureAgentModal';
import UserManualModal from '@/components/UserManualModal';

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instance/list', { cache: 'no-store' });
      const data = await res.json();
      const list = data.deployments || data.instances || data.data || (Array.isArray(data) ? data : []);
      setDeployments(list);
    } catch (e) {
      console.error('Failed to load deployments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyEmbedSnippet = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autocloud-ai-p448.vercel.app';
    const snippet = `<script src="${origin}/widget.js" data-instance-id="${id}" defer></script>`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete instance ${id}? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    setDeletingId(id);
    try {
      const res = await fetch('/api/instance/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: id }),
      });

      const data = await res.json();
      if (data.success || res.ok) {
        setDeployments((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(`Failed to delete instance: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('An error occurred while deleting the instance.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 p-6 md:p-10 font-sans">
      
      {/* Top Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b border-gray-800/80">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-[#141721] hover:bg-[#1c202e] border border-gray-800 text-gray-400 hover:text-white transition flex items-center justify-center shrink-0"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">AI Agent Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Manage, train, and configure your multi-tenant bot instances</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsManualOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1d28] hover:bg-[#232738] border border-purple-500/40 text-purple-300 text-xs font-semibold transition shadow-lg shadow-purple-950/40"
          >
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span>📘 User Manual & Guides</span>
          </button>

          <button
            onClick={fetchDeployments}
            className="p-2.5 rounded-xl bg-[#141721] hover:bg-[#1c202e] border border-gray-800 text-gray-400 hover:text-white transition"
            title="Refresh Deployments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Deployments Section */}
      <div className="max-w-6xl mx-auto mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Active Deployments</h2>
          <span className="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2.5 py-0.5 rounded-full font-medium">
            {deployments.length} {deployments.length === 1 ? 'Bot' : 'Bots'} Active
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center rounded-2xl bg-[#11131a] border border-gray-800/80">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading your bot instances...</p>
          </div>
        ) : deployments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#11131a] border border-gray-800/80 space-y-3">
            <Bot className="w-10 h-10 text-gray-600 mx-auto" />
            <h3 className="text-sm font-semibold text-gray-300">No Bot Instances Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Complete checkout to automatically provision your AI support agent.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deployments.map((inst) => {
              const isWidget = inst.template_id === 'widget' || inst.template_id === 'webchat';
              const templateLabel = isWidget ? 'Web Chat Widget' : 'Telegram AI Bot';

              return (
                <div
                  key={inst.id}
                  className={`p-5 rounded-2xl bg-[#12141c] border ${
                    isWidget ? 'border-blue-900/40 hover:border-blue-500/50' : 'border-gray-800 hover:border-purple-500/50'
                  } transition flex flex-col justify-between space-y-4 shadow-xl`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-mono font-bold text-white text-xs break-all leading-tight">
                            {inst.id}
                          </h3>
                          <button
                            onClick={() => copyId(inst.id)}
                            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition shrink-0"
                            title="Copy Full Instance ID"
                          >
                            {copiedId === inst.id ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <p className={`text-[11px] font-medium mt-1 ${isWidget ? 'text-blue-400' : 'text-purple-400'}`}>
                          {inst.name || inst.bot_name || templateLabel}
                        </p>
                      </div>

                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] font-semibold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {inst.status || 'Active'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Globe2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>11 Languages Supported</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>3-Strike Moderation Active</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400 truncate">
                        {isWidget ? (
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <Send className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <span>Template: {templateLabel}</span>
                      </div>
                    </div>

                    {isWidget && (
                      <div className="mt-3 pt-3 border-t border-gray-800/60">
                        <button
                          onClick={() => copyEmbedSnippet(inst.id)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/40 text-blue-300 text-[11px] font-medium transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5" />
                            {copiedSnippet === inst.id ? 'Copied to Clipboard!' : 'Copy Embed HTML Script'}
                          </span>
                          {copiedSnippet === inst.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedInstance(inst);
                        setIsConfigOpen(true);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition shadow-md ${
                        isWidget
                          ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                          : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure</span>
                    </button>

                    <button
                      onClick={() => handleDelete(inst.id)}
                      disabled={deletingId === inst.id}
                      className="p-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-800/40 transition shrink-0"
                      title="Delete Bot Instance"
                    >
                      {deletingId === inst.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedInstance && (
        <ConfigureAgentModal
          isOpen={isConfigOpen}
          onClose={() => {
            setIsConfigOpen(false);
            setSelectedInstance(null);
            fetchDeployments();
          }}
          instance={selectedInstance}
        />
      )}

      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />
    </div>
  );
}