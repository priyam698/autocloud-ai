"use client";

import { useState, useEffect } from "react";

interface Instance {
  id: string;
  template_name: string;
  template_id: string;
  status: "RUNNING" | "STOPPED" | "PENDING";
  provisioned_at: string;
  expires_at?: string;
  organization_type?: string;
  organization_name?: string;
  use_case_description?: string;
  telegram_token?: string;
}

export default function DashboardPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [activeLogContainer, setActiveLogContainer] = useState<string | null>(null);
  const [activeTokenModal, setActiveTokenModal] = useState<Instance | null>(null);
  const [selectedInstanceForSetup, setSelectedInstanceForSetup] = useState<Instance | null>(null);

  // Form states for Setup Modal
  const [orgType, setOrgType] = useState("Individual");
  const [orgName, setOrgName] = useState("");
  const [useCase, setUseCase] = useState("");

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      const res = await fetch("/api/instance/list");
      const data = await res.json();
      if (data.instances) setInstances(data.instances);
    } catch (err) {
      console.error("Failed to fetch instances", err);
    }
  };

  // Toggle Power Status (Start/Stop)
  const togglePower = async (instance: Instance) => {
    const newStatus = instance.status === "RUNNING" ? "STOPPED" : "RUNNING";
    try {
      await fetch("/api/instance/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: instance.id, status: newStatus }),
      });
      fetchInstances();
    } catch (err) {
      console.error("Failed to toggle power", err);
    }
  };

  // Handle Remove / Delete Instance
  const handleDelete = async (instanceId: string) => {
    if (confirm("Are you sure you want to remove this instance? This action cannot be undone.")) {
      try {
        await fetch("/api/instance/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId }),
        });
        fetchInstances();
      } catch (err) {
        console.error("Failed to delete instance", err);
      }
    }
  };

  // Open Setup Modal for Org/Use-Case
  const openSetupModal = (instance: Instance) => {
    setSelectedInstanceForSetup(instance);
    setOrgType(instance.organization_type || "Individual");
    setOrgName(instance.organization_name || "");
    setUseCase(instance.use_case_description || "");
  };

  // Save Org/Use-Case Info
  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceForSetup) return;

    try {
      await fetch("/api/instance/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: selectedInstanceForSetup.id,
          organizationType: orgType,
          organizationName: orgType === "Individual" ? "Individual Use" : orgName,
          useCase,
        }),
      });
      setSelectedInstanceForSetup(null);
      fetchInstances();
    } catch (err) {
      console.error("Failed to save setup info", err);
    }
  };

  // Calculate Days Remaining
  const getDaysLeft = (expiresAt?: string) => {
    if (!expiresAt) return 30;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-6 md:p-10 font-sans">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
         <a
  href="/"
  className="text-xs text-indigo-400 hover:underline mb-1 inline-block"
>
  ← Back to Marketplace
</a>
          <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Active instances registered to your account
          </p>
        </div>
        <button
          onClick={fetchInstances}
          className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition flex items-center gap-2 self-start md:self-auto"
        >
          🔄 Refresh Status
        </button>
      </div>

      {/* Instances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {instances.map((instance) => {
          const daysLeft = getDaysLeft(instance.expires_at);

          return (
            <div
              key={instance.id}
              className="bg-[#0e131f] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition shadow-xl"
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 rounded-lg">
                      🤖
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">
                        {instance.template_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {instance.id}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      instance.status === "RUNNING"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                    }`}
                  >
                    {instance.status}
                  </span>
                </div>

                {/* Instance Details */}
                <div className="space-y-2 my-4 text-xs font-mono text-slate-400 bg-[#080b12] p-3.5 rounded-lg border border-slate-800/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Template ID:</span>
                    <span className="text-slate-300 font-semibold">
                      {instance.template_id || "n8n-workflow"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Scope:</span>
                    <span className="text-slate-200">
                      {instance.organization_name || "Individual Use"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subscription Left:</span>
                    <span
                      className={`font-bold ${
                        daysLeft <= 3 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {daysLeft} Days Remaining
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/60">
                {/* Logs Stream Button */}
                <button
                  onClick={() => setActiveLogContainer(instance.id)}
                  className="flex-1 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                >
                  &gt;_ Logs
                </button>

                {/* Bot Token Config Button */}
                <button
                  onClick={() => setActiveTokenModal(instance)}
                  className="flex-1 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                >
                  🔑 Bot Token
                </button>

                {/* Org Setup Details Button */}
                <button
                  onClick={() => openSetupModal(instance)}
                  className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                  title="Configure Usage Details"
                >
                  ⚙️
                </button>

                {/* Power Toggle Button */}
                <button
                  onClick={() => togglePower(instance)}
                  className={`p-2 rounded-lg border transition ${
                    instance.status === "RUNNING"
                      ? "bg-red-950/40 text-red-400 border-red-800/50 hover:bg-red-900/60"
                      : "bg-emerald-950/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/60"
                  }`}
                  title={instance.status === "RUNNING" ? "Stop Instance" : "Start Instance"}
                >
                  ⏻
                </button>

                {/* Delete / Remove Button */}
                <button
                  onClick={() => handleDelete(instance.id)}
                  className="p-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/50 rounded-lg transition"
                  title="Remove Instance"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODAL 1: Live Terminal Log Console --- */}
      {activeLogContainer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0e17] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 bg-[#080b12] border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-mono text-slate-400">
                Console Stream — {activeLogContainer}
              </span>
              <button
                onClick={() => setActiveLogContainer(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-5 font-mono text-xs text-emerald-400 bg-[#05070c] h-80 overflow-y-auto space-y-1">
              <p className="text-slate-500">[SYSTEM] Initializing stream socket connection...</p>
              <p className="text-slate-500">[SYSTEM] Connected to instance runner container.</p>
              <p>[INFO] Telegram webhook listener bound to 0.0.0.0:10000</p>
              <p>[INFO] Polling cycle active — 0 active errors.</p>
              <p className="text-slate-400">[METRICS] CPU: 0.4% | Memory: 128MB / 512MB</p>
            </div>
            <div className="px-5 py-2.5 bg-[#080b12] border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Status: Stream Connected</span>
              <button
                onClick={() => setActiveLogContainer(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
              >
                Close Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Bot Token Configuration --- */}
      {activeTokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0e131f] border border-slate-800 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Bot Token Setup</h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter your Telegram Bot API token from @BotFather
            </p>
            <input
              type="text"
              defaultValue={activeTokenModal.telegram_token || ""}
              placeholder="e.g. 123456789:ABCdefGhIJK..."
              className="w-full bg-[#080b12] border border-slate-700 p-3 rounded-lg text-sm text-white outline-none mb-4 focus:border-indigo-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTokenModal(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setActiveTokenModal(null)}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
              >
                Save Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Organization & Use Case Setup --- */}
      {selectedInstanceForSetup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0e131f] border border-slate-800 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
            <h2 className="text-xl font-bold mb-1">Deployment Scope & Purpose</h2>
            <p className="text-xs text-slate-400 mb-5">
              Specify where and how this instance is deployed.
            </p>

            <form onSubmit={handleSaveSetup} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Deployment Scope
                </label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-700 p-2.5 rounded-lg text-white outline-none focus:border-indigo-500"
                >
                  <option value="Individual">Individual / Personal Use</option>
                  <option value="Organization">Organization / Company</option>
                </select>
              </div>

              {orgType === "Organization" && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Organization / Company Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Trading Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-700 p-2.5 rounded-lg text-white outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Primary Intended Use Case
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Automated crypto trading notifications for personal group channel"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-700 p-2.5 rounded-lg text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInstanceForSetup(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg transition"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}