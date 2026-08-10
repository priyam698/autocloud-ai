'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const password = searchParams.get('password') || searchParams.get('access_password');
  const instanceId = searchParams.get('instanceId') || searchParams.get('instance_id');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-sm text-slate-400 mb-6">
          Your AI Agent deployment has been created and is ready to configure.
        </p>

        {password ? (
          <div className="bg-slate-950 border border-purple-500/40 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-1 font-medium">🔑 Your Instance Access Password:</p>
            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 mb-2">
              <code className="text-sm font-mono text-purple-300 font-bold tracking-wider select-all">
                {password}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(password);
                  alert('📋 Access password copied to clipboard!');
                }}
                className="text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 px-3 py-1.5 rounded transition font-medium"
              >
                Copy
              </button>
            </div>
            {instanceId && (
              <p className="text-[10px] text-slate-500 font-mono">
                Instance ID: {instanceId}
              </p>
            )}
            <p className="text-[11px] text-amber-400/90 mt-2">
              ⚠️ Save this password now! You will use it to unlock your agent on the dashboard.
            </p>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 text-left text-xs text-slate-400">
            <p className="mb-2">
              ✨ Your instance is being initialized. You can find your deployment directly on your agent dashboard.
            </p>
          </div>
        )}

        <a
          href="/dashboard"
          className="block w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl transition text-sm shadow-lg shadow-purple-600/20"
        >
          Go to Agent Dashboard →
        </a>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}