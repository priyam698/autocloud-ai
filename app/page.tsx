'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Rocket, Server, ExternalLink, Loader2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  monthly_price: number;
}

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      const { data, error } = await supabase.from('templates').select('*');
      if (error) {
        console.error('Error fetching templates:', error);
      } else {
        setTemplates(data || []);
      }
      setLoading(false);
    }
    fetchTemplates();
  }, []);

  const handleDeploy = async (template: Template) => {
    setDeployingId(template.id);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: template.name,
          price: template.monthly_price,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Lemon Squeezy Checkout
      } else {
        alert('Payment setup error: ' + (data.error || 'Check Lemon Squeezy keys in .env.local'));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to initiate checkout.');
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center pb-8 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Server className="text-indigo-500 w-8 h-8" />
          <span className="text-xl font-bold tracking-wide">AutoCloud AI</span>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition">
          Sign In
        </button>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto text-center py-16">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
          Deploy 24/7 AI Agents & Automation in <span className="text-indigo-400">One Click</span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
          Instant production hosting for n8n workflows, Telegram AI bots, and custom Python agents. No server setup required.
        </p>
      </section>

      {/* Template Marketplace */}
      <section className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Rocket className="text-indigo-400" /> Choose a Template to Deploy
        </h2>

        {loading ? (
          <p className="text-slate-500">Loading available templates from database...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div 
                key={template.id} 
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-indigo-500 transition"
              >
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/50 px-2 py-1 rounded border border-indigo-800/50">
                    {template.category}
                  </span>
                  <h3 className="text-xl font-bold mt-4 mb-2">{template.name}</h3>
                  <p className="text-slate-400 text-sm mb-6">{template.description}</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 text-xs uppercase">Est. Cost</span>
                    <span className="text-lg font-bold text-emerald-400">${template.monthly_price}/mo</span>
                  </div>
                  <button 
                    onClick={() => handleDeploy(template)}
                    disabled={deployingId === template.id}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {deployingId === template.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Redirecting...
                      </>
                    ) : (
                      <>
                        Deploy Now <ExternalLink className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}