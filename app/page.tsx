'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { FaGithub } from 'react-icons/fa';
import { 
  Bot, 
  Zap, 
  Shield, 
  Sparkles, 
  Terminal, 
  ArrowRight,  
  Mail, 
  MessageSquare,
  Cpu,
  Globe,
  CheckCircle2,
  Lock,
  Server
} from 'lucide-react';


// Dynamically import 3D background with SSR disabled to prevent hydration exceptions
const ThreeBackground = dynamic(() => import('./components/ThreeBackground'), { 
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-slate-950 pointer-events-none" />
});

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkUser() {
      try {
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (isMounted && session?.user) {
            setUser(session.user);
          }
        }
      } catch (e) {
        console.warn('Session retrieval skipped:', e);
      }
    }

    checkUser();

    let authListener: any = null;
    try {
      if (supabase) {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (isMounted) {
            setUser(session?.user ?? null);
          }
        });
        authListener = data?.subscription;
      }
    } catch (e) {
      console.warn('Auth state listener skipped:', e);
    }

    return () => {
      isMounted = false;
      if (authListener) authListener.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      if (!supabase) return;
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        },
      });
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleDeploy = async (templateId: string) => {
    try {
      setLoadingId(templateId);

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });

      const data = await res.json();

      // Check if redirect URL exists, or if deployment succeeded
      const targetUrl = data?.url || data?.redirectUrl || '/dashboard';

      if (res.ok && (data?.success || data?.url || data?.redirectUrl)) {
        window.location.href = targetUrl;
      } else {
        alert(data?.error || 'Unable to initiate checkout session.');
      }
    } catch (err) {
      console.error('Deployment execution error:', err);
      alert('Checkout process failed. Please check your network connection.');
    } finally {
      setLoadingId(null);
    }
  };

  const templates = [
    {
      id: 'n8n-workflow',
      name: 'n8n Workflow Automation',
      description: 'Dedicated self-hosted n8n automation engine. Run unlimited background triggers 24/7 without execution limits.',
      price: 12,
      icon: Zap,
      tags: ['Automation', 'Low-Code', '24/7 Exec'],
      gradient: 'from-amber-500/20 to-orange-500/20',
      border: 'hover:border-amber-500/50',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'telegram-ai-bot',
      name: 'Telegram AI Assistant Bot',
      description: 'Pre-configured 24/7 Telegram customer support and AI agent powered by Gemini API and OpenAI endpoints.',
      price: 12,
      icon: MessageSquare,
      tags: ['AI Agent', 'Telegram API', 'Support'],
      gradient: 'from-cyan-500/20 to-blue-500/20',
      border: 'hover:border-cyan-500/50',
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
    },
    {
      id: 'langchain-runner',
      name: 'LangChain & CrewAI Runner',
      description: 'Autonomous Python/Node.js multi-agent runtime. Isolated container execution for custom LLM workflows.',
      price: 12,
      icon: Terminal,
      tags: ['Multi-Agent', 'Python Runtime', 'Docker'],
      gradient: 'from-purple-500/20 to-indigo-500/20',
      border: 'hover:border-purple-500/50',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    },
  ];

  const advantages = [
    {
      icon: Zap,
      title: '1-Click Zero-Config Setup',
      description: 'Skip tedious Linux server setup, Docker files, domain routing, and SSL configuration. Deploy in under 30 seconds.',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    {
      icon: Shield,
      title: 'Continuous 24/7 Uptime',
      description: 'Your background bots and scrapers stay online in dedicated cloud containers even when your personal laptop is turned off.',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
    },
    {
      icon: Lock,
      title: 'Isolated & Secure Runtime',
      description: 'Every deployment gets an isolated runtime with encrypted environment variables to keep your secret API keys 100% private.',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      icon: Server,
      title: 'Flat $12/mo Predictable Pricing',
      description: 'Never worry about sudden usage spikes or unexpected cloud bill crashes. Simple flat subscription with no artificial caps.',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    },
    {
      icon: Globe,
      title: 'Instant Global Endpoint Routing',
      description: 'Receive external webhooks from Stripe, Shopify, or custom apps with low-latency global edge routing built-in.',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    },
    {
      icon: Cpu,
      title: '24/7 AI-Powered Live Support',
      description: 'Get instant technical help and troubleshooting guidance anytime directly inside our dedicated Telegram support community.',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-x-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Interactive 3D Background Canvas */}
      <ThreeBackground />

      {/* Ambient Gradient Overlays */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950/80 to-slate-950 pointer-events-none z-0" />

      {/* Floating Navigation Bar */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-6xl">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-full px-6 py-3 flex items-center justify-between shadow-2xl shadow-indigo-950/50">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-indigo-600/20 border border-indigo-500/30">
              <Image 
                src="/gemini-svg.png" 
                alt="AutoCloud AI Logo" 
                width={28} 
                height={28} 
                className="object-contain"
                onError={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.display = 'none';
                }}
              />
              <Bot className="w-4 h-4 text-indigo-400 absolute inset-0 m-auto -z-10" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              AutoCloud AI
            </span>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="/dashboard" className="text-indigo-400 hover:text-indigo-300 font-semibold transition">Dashboard</a>
            <a href="#features" className="hover:text-white transition">Why Choose Us</a>
            <a href="#marketplace" className="hover:text-white transition">Agent Marketplace</a>
            <a href="#support" className="hover:text-white transition">24/7 Support</a>
          </div>

          {/* User Auth Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 hidden sm:inline px-3 py-1 bg-slate-800/60 rounded-full border border-slate-700/50">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-full font-medium transition border border-slate-700/50"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 text-xs bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold px-5 py-2.5 rounded-full shadow-lg shadow-indigo-600/25 transition border border-indigo-400/20 active:scale-95"
              >
                <FaGithub className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 pt-36 pb-24 px-6 max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-28">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8 backdrop-blur-md shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Managed 1-Click Cloud Platform for Autonomous AI Agents</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-[1.12]">
            Deploy Always-On AI Agents <br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Without Server Headaches
            </span>
          </h1>

          <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg mb-10 leading-relaxed font-normal">
            Skip complex terminal commands, Docker builds, and SSL setups. Host self-hosted n8n workflows, Telegram AI bots, and custom Python LLM runners with 24/7 continuous uptime.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#marketplace"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm px-8 py-3.5 rounded-full shadow-xl shadow-indigo-600/30 transition border border-indigo-400/20 active:scale-95"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#features"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-medium text-sm px-8 py-3.5 rounded-full transition border border-slate-800 backdrop-blur-md"
            >
              <span>Why Choose Us</span>
            </a>
          </div>
        </section>

        {/* Why Choose Us / Key Advantages Section */}
        <section id="features" className="mb-32 scroll-mt-28">
          <div className="text-center mb-16">
            <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mb-3">Key Advantages</h2>
            <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Why Developers Choose AutoCloud AI</p>
            <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto">Engineered specifically to solve cloud infrastructure friction for solo builders and creators.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advantages.map((adv, idx) => {
              const IconComp = adv.icon;
              return (
                <div 
                  key={idx}
                  className="bg-slate-900/50 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 rounded-3xl p-8 backdrop-blur-xl flex flex-col justify-between group hover:shadow-xl hover:shadow-indigo-950/30 hover:-translate-y-1"
                >
                  <div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${adv.color}`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">{adv.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{adv.description}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-800/50 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Included in all instances</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Marketplace Section */}
        <section id="marketplace" className="mb-24 scroll-mt-28">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mb-3">Instant Deployments</h2>
              <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Deployable Agent Marketplace</p>
            </div>
            <p className="text-slate-400 text-xs max-w-md">Select a pre-configured template to provision your dedicated cloud container instantly.</p>
          </div>

          {/* CHANNEL-SPECIFIC BOT SERVICES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* 1. TELEGRAM BOT */}
          <div className="relative rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between hover:border-purple-500/60 transition-all duration-300 shadow-xl group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
                  ✈️
                </div>
                <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-white">
                  $12<span className="text-slate-400 text-[10px] font-normal">/mo</span>
                </div>
              </div>
              <h4 className="text-lg font-bold text-white mb-1.5 group-hover:text-purple-300 transition">
                Telegram AI Bot
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                24/7 automated Telegram customer support and lead capture assistant connected to your knowledge base.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {['@BotFather', 'Groups & DMs', 'Fast AI'].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleDeploy('telegram')}
              disabled={loadingId === 'telegram'}
              className="w-full py-2.5 bg-slate-800 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200"
            >
              {loadingId === 'telegram' ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Deploy Telegram Bot →'
              )}
            </button>
          </div>

          {/* 2. SLACK BOT */}
          <div className="relative rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between hover:border-purple-500/60 transition-all duration-300 shadow-xl group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
                  👥
                </div>
                <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-white">
                  $12<span className="text-slate-400 text-[10px] font-normal">/mo</span>
                </div>
              </div>
              <h4 className="text-lg font-bold text-white mb-1.5 group-hover:text-purple-300 transition">
                Slack AI Bot
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Internal team assistant and ticketing bot directly integrated inside your Slack channels and direct messages.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {['App Mentions', 'Internal DMs', 'Workspace Sync'].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleDeploy('slack')}
              disabled={loadingId === 'slack'}
              className="w-full py-2.5 bg-slate-800 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200"
            >
              {loadingId === 'slack' ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Deploy Slack Bot →'
              )}
            </button>
          </div>

          {/* 3. DISCORD BOT */}
          <div className="relative rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between hover:border-purple-500/60 transition-all duration-300 shadow-xl group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
                  👾
                </div>
                <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-white">
                  $12<span className="text-slate-400 text-[10px] font-normal">/mo</span>
                </div>
              </div>
              <h4 className="text-lg font-bold text-white mb-1.5 group-hover:text-purple-300 transition">
                Discord AI Bot
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Community support agent and server moderator trained on your knowledge base to answer community members.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {['Server Invites', 'Moderation', 'Channel Q&A'].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleDeploy('discord')}
              disabled={loadingId === 'discord'}
              className="w-full py-2.5 bg-slate-800 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200"
            >
              {loadingId === 'discord' ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Deploy Discord Bot →'
              )}
            </button>
          </div>

          {/* 4. WEB CHAT WIDGET */}
          <div className="relative rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between hover:border-purple-500/60 transition-all duration-300 shadow-xl group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
                  🌐
                </div>
                <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-white">
                  $12<span className="text-slate-400 text-[10px] font-normal">/mo</span>
                </div>
              </div>
              <h4 className="text-lg font-bold text-white mb-1.5 group-hover:text-purple-300 transition">
                Web Chat Widget
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Embeddable AI live chat bubble for websites, Shopify stores, and web apps with a single script tag.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {['1-Line Script', 'Custom Theme', 'Lead Capture'].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleDeploy('webchat')}
              disabled={loadingId === 'webchat'}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-purple-600/20"
            >
              {loadingId === 'webchat' ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Deploy Web Widget →'
              )}
            </button>
          </div>

        </div>        
        </section>
      </main>

      {/* Footer Section */}
      <footer id="support" className="border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl py-12 px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-indigo-400" />
            </div>
            <p>&copy; {new Date().getFullYear()} AutoCloud AI. All rights reserved. Managed Cloud Platform.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Telegram 24/7 AI Support Button */}
            <a
              href="https://t.me/+lI-_CNIqhW02ZDk9"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm group"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Telegram 24/7 AI Support</span>
            </a>

            {/* Direct Email Help Link */}
            <a
              href="mailto:priyamrana069@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm group"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Email Support</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}