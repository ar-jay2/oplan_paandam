import React from 'react';
import { RelayStates } from '../../types/telemetry';
import { Power } from 'lucide-react';

interface Props {
  relays: RelayStates;
  compact?: boolean;
}

export const RelayIndicator: React.FC<Props> = ({ relays, compact = false }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Power className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Physical Relay Hardware Status
          </h4>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
          Telemetry Only (Read-Only)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
        {/* Green Relay */}
        <div
          className={`flex flex-col p-2.5 rounded border transition-colors ${
            relays.green
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
              : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
            <span>RELAY 1 (GRN)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                relays.green ? 'bg-emerald-900/80 text-emerald-300 font-bold' : 'text-slate-400'
              }`}
            >
              {relays.green ? 'ENERGIZED' : 'STANDBY'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Range: 20 – 49.9 cm</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Physical indicator for normal stream flow</p>
        </div>

        {/* Yellow Relay */}
        <div
          className={`flex flex-col p-2.5 rounded border transition-colors ${
            relays.yellow
              ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
              : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
            <span>RELAY 2 (YEL)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                relays.yellow ? 'bg-amber-900/80 text-amber-300 font-bold' : 'text-slate-400'
              }`}
            >
              {relays.yellow ? 'ENERGIZED' : 'STANDBY'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Range: 50 – 79.9 cm</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Physical indicator for warning alert</p>
        </div>

        {/* Red Relay */}
        <div
          className={`flex flex-col p-2.5 rounded border transition-colors ${
            relays.red
              ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
              : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
            <span>RELAY 3 (RED)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                relays.red ? 'bg-rose-900/80 text-rose-300 font-bold' : 'text-slate-400'
              }`}
            >
              {relays.red ? 'ENERGIZED' : 'STANDBY'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Range: ≥ 80.0 cm</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Physical indicator for critical siren</p>
        </div>
      </div>
    </div>
  );
};
