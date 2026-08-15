'use client';

import React, { useState, useEffect } from 'react';

interface DocItem {
  id: string;
  team_id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const [teamId, setTeamId] = useState('');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 1. Read ?teamId= from the URL query parameter when opened
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTeamId = params.get('teamId') || 'T0BQ21MN7FV';
      setTeamId(urlTeamId);
    }
  }, []);

  // 2. Fetch documents for this specific bot
  const fetchDocs = async () => {
    if (!teamId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge?teamId=${encodeURIComponent(teamId.trim())}`);
      const data = await res.json();
      if (data.documents) {
        setDocs(data.documents);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge docs:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Automatically reload whenever teamId updates
  useEffect(() => {
    if (teamId) {
      fetchDocs();
    }
  }, [teamId]);

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamId.trim(),
          title: title.trim(),
          content: content.trim(),
        }),
      });

      if (res.ok) {
        setTitle('');
        setContent('');
        setStatusMsg('Document added successfully!');
        fetchDocs();
        setTimeout(() => setStatusMsg(''), 3000);
      } else {
        const errData = await res.json();
        setStatusMsg(`Error: ${errData.error || 'Failed to save document'}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      setStatusMsg('Failed to connect to server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const res = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        fetchDocs();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base & RAG Training</h1>
          <p className="text-slate-400 mt-1">
            Feed company FAQs, product specs, pricing, and policies to empower your AI assistant across Slack, Web, and Telegram.
          </p>
        </div>

        {/* Workspace Selector Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-sm font-medium text-slate-300 whitespace-nowrap">Workspace ID:</span>
            <input
              type="text"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-500 w-full md:w-64"
              placeholder="e.g. T0BQ21MN7FV"
            />
          </div>
          <button
            onClick={fetchDocs}
            className="w-full md:w-auto px-4 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Refresh Knowledge
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className="p-3 bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-sm rounded-lg">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Ingestion Form */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Add Knowledge Document</h2>
            <form onSubmit={handleAddDoc} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Document Title / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Return Policy, Pricing Tiers"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Document Content & Facts</label>
                <textarea
                  rows={8}
                  placeholder="Paste clear facts, documentation, or FAQs here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-medium text-sm rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Ingesting Document...' : 'Save to AI Memory'}
              </button>
            </form>
          </div>

          {/* Active Knowledge Store */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Active Knowledge Documents ({docs.length})</h2>
            
            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading documents...</div>
            ) : docs.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl text-slate-500">
                No documents found for this Workspace. Add your first policy or FAQ on the left!
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-slate-200">{doc.title}</h3>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap line-clamp-4">{doc.content}</p>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Added: {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}