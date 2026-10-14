import React, { useState } from 'react';
import { telemetryStore } from '../../services/telemetryStore';
import { Play, Square, Radio, AlertTriangle, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
}

export const SimulationController: React.FC<Props> = ({ isOpen, onToggle }) => {
  const [sliderVal, setSliderVal] = useState<number>(33.5);
  const isSimActive = telemetryStore.isSimulationActive();
  const latestPacket = telemetryStore.getLatestPacket();

  const handleApplyWaterLevel = (val: number, online: boolean = true) => {
    setSliderVal(val);
    telemetryStore.injectPacket(val, online);
  };

  if (!isOpen) return null;

  return (
    <div className="border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 py-3 text-xs text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Simulation Status & Quick Scenarios */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-cyan-400 font-bold uppercase tracking-wider pr-2 border-r border-slate-700">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Hardware Emulation Bench</span>
          </div>

          <button
            onClick={() => telemetryStore.toggleSimulation()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
              isSimActive
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {isSimActive ? (
              <>
                <Square className="w-3 h-3" />
                <span>Pause Auto Loop</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>Run Auto Stream (4s)</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1 pl-2">
            <span className="text-slate-400 text-[11px]">Inject Scenario:</span>
            <button
              onClick={() => handleApplyWaterLevel(18.0)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] border border-slate-700"
            >
              Standby (18cm)
            </button>
            <button
              onClick={() => handleApplyWaterLevel(35.5)}
              className="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 font-mono text-[11px] border border-emerald-700/50 flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              Normal (35.5cm)
            </button>
            <button
              onClick={() => handleApplyWaterLevel(62.4)}
              className="px-2 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 font-mono text-[11px] border border-amber-700/50 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              Warning (62.4cm)
            </button>
            <button
              onClick={() => handleApplyWaterLevel(86.2)}
              className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-mono text-[11px] border border-rose-700/50 flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Critical (86.2cm)
            </button>
            <button
              onClick={() => handleApplyWaterLevel(0, false)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-[11px] border border-slate-700"
            >
              Sensor Offline
            </button>
          </div>
        </div>

        {/* Right: Manual Slider & Raw Packet Preview */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Fine Level:</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={sliderVal}
              onChange={(e) => handleApplyWaterLevel(parseFloat(e.target.value), true)}
              className="w-28 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <span className="font-mono text-cyan-300 font-bold w-12 text-right">
              {sliderVal.toFixed(1)}cm
            </span>
          </div>

          {latestPacket && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 text-slate-400">
              <span className="text-slate-400">LoRa RX:</span>
              <span className="text-cyan-400 truncate max-w-xs">{latestPacket.rawString}</span>
            </div>
          )}

          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
