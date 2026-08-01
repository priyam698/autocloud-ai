'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bot, Cpu, RefreshCw, Power, CheckCircle, Terminal, ArrowLeft, X, Play } from 'lucide-react';
import Link from 'next/link';

interface Deployment {
  id: string;
  name: string;
  template_id: string;
  status: string;
  user_email: string;
  container_id: string;
  created_at: string;
}

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Console Log Modal state
  const [activeLogContainer, setActiveLogContainer] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string[]>([]);
  
  // Action loading state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAndDeployments();
  }, []);

  async function fetchUserAndDeployments() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || 'priyamrana069@gmail.com';
    setUserEmail(email);

    const { data, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDeployments(data);
    }
    setLoading(false);
  }

  // Toggle RUNNING / STOPPED status in Supabase
  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'running' ? 'stopped' : 'running';
    setActionLoading(id);

    const { error } = await supabase
      .from('deployments')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setDeployments(prev =>
        prev.map(item => (item.id === id ? { ...item, status: newStatus } : item))
      );
    }
    setActionLoading(null);
  }

  // Open Log Viewer Modal
  function openLogs(containerId: string, templateId: string) {
    setActiveLogContainer(containerId);
    setLogContent([
      `[SYS] Initializing runtime stream for container: ${containerId}`,
      `[SYS] Loading configuration template: ${templateId}`,
      `[INF] Memory allocated: 512MB / CPU share: 0.5 vCPU`,
      `[INF] Network interface initialized on port 8080`,
      `[OK] SSL Certificates verified successfully.`,
      `[OK] Connected to agent orchestration cluster.`,
      `[RUN] Process started with PID 1042. Listening for incoming payload stream...`,
      `[LIVE] Agent status: Healthy. Continuous monitoring active.`
    ]);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background Mesh */}
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{ backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 mb-2 transition">
              <ArrowLeft className="w-4 h-4" /> Back to Marketplace
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">
              Active instances registered to <span className="text-slate-200 font-medium">{userEmail}</span>
            </p>
          </div>
          <button 
            onClick={fetchUserAndDeployments}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
          </button>
        </div>

        {/* Deployments Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-sm">Fetching active AI deployments...</p>
          </div>
        ) : deployments.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center backdrop-blur-sm">
            <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Active Deployments</h3>
            <p className="text-slate-400 text-sm mb-6">You haven't provisioned any 24/7 autonomous agent runners yet.</p>
            <Link
              href="/#marketplace"
              className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
            >
              Deploy Your First Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deployments.map((instance) => {
              const isRunning = instance.status === 'running';
              return (
                <div
                  key={instance.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-6 relative transition backdrop-blur-sm shadow-xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{instance.name}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{instance.container_id}</p>
                      </div>
                    </div>
                    
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      isRunning 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      <CheckCircle className="w-3 h-3" /> {instance.status ? instance.status.toUpperCase() : 'RUNNING'}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 rounded-lg p-3.5 border border-slate-800/80 font-mono text-xs text-slate-400 mb-5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Template ID:</span>
                      <span className="text-slate-300 font-semibold">{instance.template_id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Provisioned:</span>
                      <span className="text-slate-300">
                        {instance.created_at ? new Date(instance.created_at).toLocaleDateString() : 'Just now'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => openLogs(instance.container_id, instance.template_id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg border border-slate-700 transition"
                    >
                      <Terminal className="w-3.5 h-3.5" /> View Console Logs
                    </button>

                    <button 
                      onClick={() => toggleStatus(instance.id, instance.status || 'running')}
                      disabled={actionLoading === instance.id}
                      className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                        isRunning 
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                      }`}
                      title={isRunning ? "Stop Instance" : "Start Instance"}
                    >
                      {actionLoading === instance.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isRunning ? (
                        <Power className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Terminal Console Logs Modal */}
      {activeLogContainer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900/80 px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs font-medium text-slate-200">
                  Container Output — {activeLogContainer}
                </span>
              </div>
              <button 
                onClick={() => setActiveLogContainer(null)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 font-mono text-xs text-emerald-400/90 bg-slate-950 h-64 overflow-y-auto space-y-1.5 border-b border-slate-900">
              {logContent.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600 select-none">$</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="px-4 py-2.5 bg-slate-900/50 flex justify-between items-center text-[11px] text-slate-500 font-mono">
              <span>Status: Stream Connected</span>
              <button 
                onClick={() => setActiveLogContainer(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
              >
                Close Console
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}