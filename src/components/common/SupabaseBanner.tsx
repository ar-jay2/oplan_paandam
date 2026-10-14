import React, { useState } from 'react';
import { SupabaseConnectionStatus } from '../../types/telemetry';
import { getStoredSupabaseConfig, saveStoredSupabaseConfig } from '../../services/supabaseClient';
import { telemetryStore } from '../../services/telemetryStore';
import { Database, ShieldAlert, Key, Check, Copy, ExternalLink, RefreshCw, X } from 'lucide-react';

interface Props {
  status: SupabaseConnectionStatus;
  onNavigateToSettings: () => void;
}

export const SupabaseBanner: React.FC<Props> = ({ status, onNavigateToSettings }) => {
  const [showRlsModal, setShowRlsModal] = useState<boolean>(false);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [anonKeyInput, setAnonKeyInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const rlsSql = `-- Enable Row Level Security (RLS) Read Access for OPLAN PA-ANDAM
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/cactbrecfedmzsuqynve/sql)

ALTER TABLE public.flood_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_settings ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policies for Dashboard
CREATE POLICY "Public Read Access: flood_nodes"
  ON public.flood_nodes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public Read Access: flood_readings"
  ON public.flood_readings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public Read Access: flood_events"
  ON public.flood_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public Read Access: flood_settings"
  ON public.flood_settings FOR SELECT
  TO anon, authenticated
  USING (true);`;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anonKeyInput.trim()) return;
    saveStoredSupabaseConfig(status.projectUrl, anonKeyInput.trim());
    telemetryStore.initSupabaseData();
    setShowKeyInput(false);
  };

  const copySql = () => {
    navigator.clipboard.writeText(rlsSql);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Case 1: Missing Public Anon Key
  if (!status.hasAnonKey) {
    return (
      <>
        <div className="bg-cyan-950/70 border-b border-cyan-800/80 px-4 py-2.5 text-xs text-cyan-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-100">Supabase Connected:</span>{' '}
                <code className="text-cyan-300 font-mono text-[11px]">{status.projectUrl}</code>
                <span className="text-slate-300 block sm:inline sm:ml-2">
                  Enter your Project Public Anon Key to stream real ESP32 telemetry.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowKeyInput(true)}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded text-xs transition-colors"
              >
                Enter Anon Key
              </button>
              <button
                onClick={onNavigateToSettings}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs border border-slate-700 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Quick Key Entry Modal */}
        {showKeyInput && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f172a] border border-slate-700 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-100">
                    Connect Supabase Telemetry
                  </h3>
                </div>
                <button
                  onClick={() => setShowKeyInput(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Enter the public <code className="text-cyan-300 font-mono">anon</code> key from your Supabase Dashboard
                (<em>Project Settings &gt; API &gt; Project API keys &gt; anon public</em>).
              </p>

              <form onSubmit={handleSaveKey} className="space-y-3 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Target Project URL:</label>
                  <div className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-cyan-400">
                    {status.projectUrl}
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Supabase Anon Key:</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={anonKeyInput}
                    onChange={(e) => setAnonKeyInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(false)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium font-sans"
                  >
                    Save & Load Real Telemetry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // Case 2: Row Level Security (RLS) Policy Error
  if (status.isRlsError) {
    return (
      <>
        <div className="bg-rose-950/80 border-b border-rose-700/80 px-4 py-2.5 text-xs text-rose-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold uppercase tracking-wider text-rose-300">
                  Supabase RLS Policy Required:
                </span>{' '}
                <span>
                  Row Level Security is enabled on your Supabase tables, but no SELECT policy exists for the public <code className="text-rose-300 font-mono">anon</code> role.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowRlsModal(true)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded text-xs transition-colors"
              >
                View Required SQL Policy
              </button>
              <button
                onClick={() => telemetryStore.initSupabaseData()}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs border border-slate-700 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>

        {/* RLS Modal */}
        {showRlsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f172a] border border-slate-700 rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-xl text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h3 className="text-sm font-bold uppercase font-mono tracking-wider">
                    Supabase Row Level Security (RLS) Policy Fix
                  </h3>
                </div>
                <button
                  onClick={() => setShowRlsModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-slate-300 leading-relaxed">
                By default, Supabase tables with RLS reject queries from anonymous web visitors. Run this SQL snippet in your Supabase SQL Editor to grant read-only permissions for telemetry visualization:
              </p>

              <div className="relative">
                <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-64 leading-relaxed">
                  <code>{rlsSql}</code>
                </pre>
                <button
                  onClick={copySql}
                  className="absolute top-2 right-2 flex items-center gap-1 text-[11px] text-cyan-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded transition-colors"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <a
                  href="https://supabase.com/dashboard/project/cactbrecfedmzsuqynve/sql"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      telemetryStore.initSupabaseData();
                      setShowRlsModal(false);
                    }}
                    className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                  >
                    I Have Applied the Policy (Retry)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Case 3: Other Connection Error
  if (status.errorMessage && !status.isConnected) {
    return (
      <div className="bg-amber-950/70 border-b border-amber-700/80 px-4 py-2.5 text-xs text-amber-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <span className="font-bold uppercase tracking-wider text-amber-300">
              Supabase Telemetry Error:
            </span>{' '}
            <span>{status.errorMessage}</span>
            {status.lastSuccessfulReadingTime && (
              <span className="block sm:inline sm:ml-2 text-slate-300 font-mono text-[11px]">
                · Last successful reading: {new Date(status.lastSuccessfulReadingTime).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => telemetryStore.initSupabaseData()}
              className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded text-xs border border-amber-700 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={onNavigateToSettings}
              className="text-[11px] underline hover:text-white shrink-0"
            >
              Configure in Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
