import React from 'react';
import { TelemetrySource, ConnectionState } from '../../types/telemetry';
import { Menu, Terminal, UserCheck } from 'lucide-react';

interface Props {
  onToggleMobileMenu: () => void;
  telemetrySource: TelemetrySource;
  connectionState: ConnectionState;
  isSimOpen: boolean;
  onToggleSim: () => void;
  isAdmin: boolean;
  onToggleAdmin: () => void;
  isStale: boolean;
}

export const Navbar: React.FC<Props> = ({
  onToggleMobileMenu,
  telemetrySource,
  connectionState,
  isSimOpen,
  onToggleSim,
  isAdmin,
  onToggleAdmin,
  isStale,
}) => {
  return (
    <header className="h-14 bg-[#090e1b] border-b border-slate-800 px-4 flex items-center justify-between gap-8 shrink-0 z-20">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          OPLAN PA-ANDAM
        </span>
      </div>

      {/* Zone 2: Navigation & Mode Controls */}
      <div className="hidden md:flex items-center gap-5 text-xs text-slate-400 font-mono whitespace-nowrap shrink-0">

        <button
          onClick={onToggleAdmin}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
            isAdmin
              ? 'bg-slate-800 border-slate-700 text-cyan-300'
              : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Administrator mode to edit nodes, acknowledge alerts, and calibrate thresholds"
        >
          <UserCheck className="w-3 h-3 text-cyan-400" />
          <span>{isAdmin ? 'Admin Mode (Active)' : 'Viewer Mode'}</span>
        </button>
      </div>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSim}
          className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            isSimOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isSimOpen ? 'Hide Test Bench' : 'Hardware Test Bench'}</span>
        </button>
      </div>
    </header>
  );
};
