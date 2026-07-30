import dynamic from 'next/dynamic';

const ThreeBackground = dynamic(() => import('@/app/components/ThreeBackground'), {
  ssr: false,
});
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
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            setUser(session?.user ?? null);
          }
        );

        const { data, error } = await supabase.from('templates').select('*');
        if (error) {
          console.error('Error fetching templates:', error);
        } else if (data && data.length > 0) {
          setTemplates(data);
        } else {
          setTemplates([
            {
              id: 'n8n-workflow',
              name: 'n8n Workflow Automation',
              description: 'Generative AI workflows that move your background operations from trigger to continuous execution.',
              category: 'AUTOMATION',
              price_monthly: 12,
              badge: 'Most Popular',
            },
            {
              id: 'telegram-ai-bot',
              name: 'Telegram AI Bot Runner',
              description: 'Pre-configured Python environment for running high-availability OpenAI & Claude Telegram bots.',
              category: 'AI AGENTS',
              price_monthly: 12,
              badge: 'Instant Setup',
            },
            {
              id: 'langchain-agent',
              name: 'LangChain / CrewAI Runner',
              description: 'Scalable background execution environment for multi-agent autonomous AI workflows.',
              category: 'AI AGENTS',
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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
    <div className="min-h-screen bg-[#0d0f12] text-slate-100 font-sans selection:bg-pink-500 selection:text-white relative overflow-hidden">
      
      {/* GLOWING AMBIENT BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-rose-500/15 via-purple-600/10 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px]" />
      </div>

      {/* FLOATING PILL NAVBAR */}
      <div className="relative z-20 pt-6 px-4">
        <nav className="max-w-4xl mx-auto bg-[#16191e]/80 border border-slate-800/80 rounded-full px-6 py-3 backdrop-blur-md flex items-center justify-between shadow-2xl">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 p-[1.5px]">
              <div className="w-full h-full bg-[#0d0f12] rounded-full flex items-center justify-center">
                <img src="/gemini-svg.png" alt="AutoCloud Logo" className="w-5 h-5 object-contain" />
              </div>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              AutoCloud <span className="text-rose-400">AI</span>
            </span>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#templates" className="hover:text-white transition-colors">Bot Library</a>
            <a href="#why-us" className="hover:text-white transition-colors">Why Choose Us</a>
            <a href="#templates" className="hover:text-white transition-colors">Pricing</a>
            <a href="https://t.me/AutoCloudSupportBot" target="_blank" className="hover:text-white transition-colors">24/7 Docs</a>
          </div>

          {/* User Auth Button */}
          <div>
            {authLoading ? (
              <div className="h-8 w-20 bg-slate-800 rounded-full animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="px-5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-purple-600 hover:opacity-90 rounded-full transition-all shadow-md shadow-rose-500/20"
              >
                Sign In
              </button>
            )}
          </div>
        </nav>
      </div>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-semibold mb-8 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          1-Click Production Agent Hosting
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.15] mb-6 text-white">
          Deploy 24/7 AI Agents & <br />
          <span className="bg-gradient-to-r from-rose-400 via-purple-300 to-amber-300 bg-clip-text text-transparent">
            Automation in One Click
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed mb-10">
          Instant background execution for n8n workflows, Telegram AI bots, and custom Python agents. Zero Linux terminal setup needed.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="#templates"
            className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 rounded-full shadow-lg shadow-rose-500/25 transition-all active:scale-95"
          >
            Deploy Now
          </a>
          <a
            href="https://t.me/AutoCloudSupportBot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 text-sm font-semibold text-slate-300 bg-[#16191e] hover:bg-slate-800 border border-slate-800 rounded-full transition-all"
          >
            Explore Docs
          </a>
        </div>
      </section>

      {/* WHY CHOOSE US / KEY ADVANTAGES SECTION */}
      <section id="why-us" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-800/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
            Why Choose <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">AutoCloud AI</span>
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Eliminate server maintenance fatigue, scale AI workflows seamlessly, and run persistent 24/7 background agents at half the price.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Advantage 1 */}
          <div className="bg-[#13161c]/80 backdrop-blur-xl border border-slate-800/90 hover:border-rose-500/40 rounded-2xl p-6 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/40 text-rose-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Zero Terminal Setup</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Forget SSH keys, Docker commands, or SSL certificates. Select a pre-configured template and launch in under 30 seconds.
            </p>
          </div>

          {/* Advantage 2 */}
          <div className="bg-[#13161c]/80 backdrop-blur-xl border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-6 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/40 text-amber-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Uncapped 24/7 Uptime</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Unlike official cloud tiers with strict execution caps, AutoCloud AI provides continuous background execution without artificial limits.
            </p>
          </div>

          {/* Advantage 3 */}
          <div className="bg-[#13161c]/80 backdrop-blur-xl border border-slate-800/90 hover:border-purple-500/40 rounded-2xl p-6 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
              🧪
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Flat $12/mo Pricing</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Save up to 50% compared to official $24/mo hosting plans. Transparent monthly billing with zero surprise usage spikes.
            </p>
          </div>
        </div>
      </section>

      {/* TEMPLATE MARKETPLACE SECTION */}
      <section id="templates" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-24 pt-8 border-t border-slate-800/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">
            Deployable Agent Library
          </h2>
          <p className="text-slate-400 text-sm">Select an instance below to spin up your 24/7 background worker.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((tpl, index) => {
            const icons = ['⚡', '🛡️', '🧪'];
            const iconBg = [
              'bg-rose-950/60 text-rose-400 border-rose-800/40',
              'bg-amber-950/60 text-amber-400 border-amber-800/40',
              'bg-purple-950/60 text-purple-400 border-purple-800/40',
            ];

            return (
              <div
                key={tpl.id}
                className="group bg-[#13161c]/90 backdrop-blur-xl border border-slate-800/90 hover:border-slate-700 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="mb-6">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800/40">
                      {tpl.category}
                    </span>
                  </div>

                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg mb-5 ${iconBg[index % 3]}`}>
                    {icons[index % 3]}
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-rose-300 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">
                    {tpl.description}
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-4 border-t border-slate-800/80 pt-4">
                    <span className="text-xs font-medium text-slate-400">Hosting</span>
                    <span className="text-2xl font-black text-white">
                      ${tpl.price_monthly || 12}
                      <span className="text-xs font-normal text-slate-400">/mo</span>
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeploy(tpl.id)}
                    disabled={loadingId === tpl.id}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-500 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loadingId === tpl.id ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Redirecting...</span>
                      </>
                    ) : (
                      <span>Deploy Instance →</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 py-8 bg-[#0b0d0f] relative z-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} AutoCloud AI Inc. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="https://t.me/AutoCloudSupportBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-full hover:border-sky-500/50 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Telegram 24/7 AI Support</span>
            </a>

            <a
              href="mailto:priyamrana069@gmail.com"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-full hover:border-purple-500/50 transition-all"
            >
              <span>Email Support</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}