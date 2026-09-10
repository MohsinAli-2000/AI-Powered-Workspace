import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-[#0b0f19]">
      {/* Ambient background glow orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-[128px] pointer-events-none" />
      
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 mb-8 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">AI Knowledge Workspace</h1>
          <p className="text-xs text-slate-400">Enterprise Multi-Tenant Intelligence</p>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-md z-10">
        <div className="glass-panel rounded-2xl p-8 shadow-2xl border border-white/10">
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-slate-400 text-center z-10">
        Protected by enterprise-grade multi-tenant isolation and 6-step access control.
      </p>
    </div>
  );
}
