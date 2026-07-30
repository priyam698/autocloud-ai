'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  price_monthly: number;
  badge?: string;
  icon?: string;
}

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load user session & templates from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch User Session
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // Listen for Auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            setUser(session?.user ?? null);
          }
        );

        // Fetch Templates
        const { data, error } = await supabase.from('templates').select('*');
        if (error) {
          console.error('Error fetching templates:', error);
        } else if (data && data.length > 0) {
          setTemplates(data);
        } else {
          // Fallback UI Templates if database returns empty
          setTemplates([
            {
              id: 'n8n-workflow',
              name: 'n8n Workflow Automation',
              description: 'Self-hosted n8n instance with 24/7 continuous background execution and zero execution limits.',
              category: 'Automation',
              price_monthly: 12,
              badge: 'Most Popular',
            },
            {
              id: 'telegram-ai-bot',
              name: 'Telegram AI Bot Runner',
              description: 'Pre-configured Python/Node.js runtime for high-availability OpenAI & Claude Telegram bots.',
              category: 'AI Assistant',
              price_monthly: 12,
              badge: 'Instant Setup',
            },
            {
              id: 'langchain-agent',
              name: 'LangChain & CrewAI Agent Host',
              description: 'Scalable background execution environment for multi-agent autonomous AI workflows.',
              category: 'Autonomous Agents',
              price_monthly: 12,
              badge: 'High Performance',
            },
          ]);
        }
        setAuthLoading(false);
        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('Data loading error:', err);
        setAuthLoading(false);
      }
    }

    loadData();
  }, []);

  // GitHub OAuth Login
  const handleSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
    } catch (error: any) {
      alert(`Sign in error: ${error.message}`);
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Trigger Lemon Squeezy Checkout
  const handleDeploy = async (templateId: string) => {
    setLoadingId(templateId);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initialize payment checkout.');
        setLoadingId(null);
      }
    } catch (err: any) {
      alert(`Checkout error: ${err.message}`);
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
      
      {/* ANIMATED BACKGROUND GRID & GLOW ORBS */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Cyber grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        
        {/* Ambient floating glow orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[150px] animate-pulse delay-1000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-600/25 rounded-full blur-[130px] animate-pulse delay-700" />
      </div>

      {/* NAVIGATION BAR */}
      <nav className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo with gemini-svg.png */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-800 p-1 flex items-center justify-center overflow-hidden">
              <img
                src="/gemini-svg.png"
                alt="AutoCloud AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              AutoCloud <span className="text-purple-400 font-extrabold">AI</span>
            </span>
          </div>

          {/* User Auth Controls */}
          <div>
            {authLoading ? (
              <div className="h-9 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-300 hidden sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-purple-600/20 active:scale-95"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-6 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          1-Click Production Agent Hosting
        </div>

        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-tight mb-6">
          Deploy 24/7 AI Agents & <br />
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
            Automation in One Click
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12">
          Instant background execution for n8n workflows, Telegram AI bots, and custom Python agents. Zero Linux terminal setup needed.
        </p>
      </section>

      {/* TEMPLATE MARKETPLACE SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="group relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-purple-500/50 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col justify-between"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider bg-purple-950/60 px-3 py-1 rounded-md border border-purple-800/40">
                    {tpl.category}
                  </span>
                  {tpl.badge && (
                    <span className="text-xs font-bold text-amber-300 bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-800/30">
                      {tpl.badge}
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">
                  {tpl.name}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  {tpl.description}
                </p>
              </div>

              {/* Price & Action Button */}
              <div>
                <div className="flex items-baseline justify-between mb-6 border-t border-slate-800/80 pt-6">
                  <span className="text-xs font-medium text-slate-400">Monthly Hosting</span>
                  <span className="text-3xl font-extrabold text-white">
                    ${tpl.price_monthly || 12}
                    <span className="text-sm font-normal text-slate-400">/mo</span>
                  </span>
                </div>

                <button
                  onClick={() => handleDeploy(tpl.id)}
                  disabled={loadingId === tpl.id}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingId === tpl.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Redirecting...</span>
                    </>
                  ) : (
                    <span>Deploy Now</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER & LIVE SUPPORT BADGES */}
      <footer className="border-t border-slate-800 py-10 mt-24 bg-slate-950/80 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Copyright & Branding */}
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} <span className="font-semibold text-slate-200">AutoCloud AI</span>. All rights reserved.
            </p>
          </div>

          {/* Customer Support Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* 24/7 Telegram Live AI Support */}
            <a
              href="https://t.me/AutoCloudSupportBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/50 rounded-xl transition-all shadow-lg hover:shadow-sky-500/10 group"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              {/* Telegram SVG Icon */}
              <svg className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span>Telegram 24/7 AI Support</span>
            </a>

            {/* Direct Email Support */}
            <a
              href="mailto:priyamrana069@gmail.com?subject=AutoCloud%20AI%20Support%20Request"
              className="inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500/50 rounded-xl transition-all shadow-lg hover:shadow-purple-500/10 group"
            >
              {/* Envelope SVG Icon */}
              <svg className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Email Support</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}