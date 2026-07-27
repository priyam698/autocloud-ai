'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  price_monthly: number;
}

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. Fetch Templates from Supabase
    async function fetchTemplates() {
      const { data, error } = await supabase.from('templates').select('*');
      if (!error && data) {
        setTemplates(data);
      }
    }
    fetchTemplates();

    // 2. Check Active Auth Session
    async function getUserSession() {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    }
    getUserSession();

    // 3. Listen for Auth State Changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- SIGN IN WITH GITHUB ---
  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });
    if (error) alert(`Sign in error: ${error.message}`);
  };

  // --- SIGN OUT ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // --- CHECKOUT REDIRECT ---
  const handleDeploy = async (templateName: string) => {
    setLoading(templateName);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
        setLoading(null);
      }
    } catch (err) {
      alert('Network error. Please try again.');
      setLoading(null);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#0b0f19] text-white overflow-hidden selection:bg-purple-500 selection:text-white">
      {/* BACKGROUND ANIMATED GLOW ORBS */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
      <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000 pointer-events-none"></div>

      {/* NAVIGATION BAR */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-gray-800/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-purple-400">
            AutoCloud AI
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Cloud Engine Online
          </span>

          {/* DYNAMIC AUTH BUTTON */}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-300 bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700/80">
                {user.email || user.user_metadata?.full_name || 'Logged In'}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl font-medium text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all duration-200"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="px-5 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-600/20 transition-all duration-200"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 mb-8 backdrop-blur-md">
          <span>⚡ 1-Click Production Hosting</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mb-8">
          Deploy 24/7 AI Agents & <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
            Automation in One Click
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed mb-10">
          Instant background execution for n8n workflows, Telegram AI bots, and custom Python agents. Zero server configuration or terminal setup required.
        </p>
      </section>

      {/* TEMPLATES SECTION */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-28">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2 text-gray-200">
          <span>⚡ Choose a Template to Deploy</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="group relative rounded-2xl bg-gradient-to-b from-gray-900/90 to-gray-900/40 p-1 border border-gray-800/80 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 backdrop-blur-xl flex flex-col justify-between"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {tpl.category}
                  </span>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    ${tpl.price_monthly}/mo
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  {tpl.name}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-6">
                  {tpl.description}
                </p>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => handleDeploy(tpl.name)}
                  disabled={loading === tpl.name}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === tpl.name ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Deploy Now</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}