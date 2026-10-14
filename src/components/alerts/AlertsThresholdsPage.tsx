import React, { useState } from 'react';
import { FloodSettings, RelayStates } from '../../types/telemetry';
import { RelayIndicator } from '../common/RelayIndicator';
import {
  Sliders,
  Save,
  RotateCcw,
  ShieldAlert,
  Info,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Power
} from 'lucide-react';

interface Props {
  settings: FloodSettings;
  relays: RelayStates;
  isAdmin: boolean;
  onUpdateSettings: (newSettings: Partial<FloodSettings>) => void;
}

export const AlertsThresholdsPage: React.FC<Props> = ({
  settings,
  relays,
  isAdmin,
  onUpdateSettings,
}) => {
  const [greenThreshold, setGreenThreshold] = useState<number>(settings.green_threshold);
  const [warningThreshold, setWarningThreshold] = useState<number>(settings.warning_threshold);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(settings.critical_threshold);
  const [offlineTimeout, setOfflineTimeout] = useState<number>(settings.offline_timeout_seconds);
  const [displayUnit, setDisplayUnit] = useState<'cm' | 'm'>(settings.display_water_level_unit);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      green_threshold: Number(greenThreshold),
      warning_threshold: Number(warningThreshold),
      critical_threshold: Number(criticalThreshold),
      offline_timeout_seconds: Number(offlineTimeout),
      display_water_level_unit: displayUnit,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetDefaults = () => {
    setGreenThreshold(20);
    setWarningThreshold(50);
    setCriticalThreshold(80);
    setOfflineTimeout(120);
    setDisplayUnit('cm');
    onUpdateSettings({
      green_threshold: 20,
      warning_threshold: 50,
      critical_threshold: 80,
      offline_timeout_seconds: 120,
      display_water_level_unit: 'cm',
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 uppercase font-mono tracking-wider">
            Hydrological Thresholds & Relay Logic Specification
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrate flood boundary classifications and local physical indicator rules
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Thresholds Applied</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Configuration Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-lg p-5">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-cyan-400 mb-1">
                Threshold Calibration Parameters
              </h3>
              <p className="text-xs text-slate-400">
                Values represent water level in centimeters from river baseline.
              </p>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Green Threshold */}
              <div className="bg-slate-900/80 p-3.5 rounded border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-emerald-400 flex items-center gap-2">
                    <Power className="w-3.5 h-3.5" />
                    <span>Physical Green Relay Trigger (Baseline Stream)</span>
                  </label>
                  <span className="text-slate-200 font-bold">{greenThreshold} cm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="40"
                  step="1"
                  disabled={!isAdmin}
                  value={greenThreshold}
                  onChange={(e) => setGreenThreshold(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-sans">
                  Below this value, all relays remain completely inactive to prevent spurious continuous current draw.
                </p>
              </div>

              {/* Warning Threshold */}
              <div className="bg-slate-900/80 p-3.5 rounded border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Flood Warning Threshold & Yellow Relay</span>
                  </label>
                  <span className="text-slate-200 font-bold">{warningThreshold} cm</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="75"
                  step="1"
                  disabled={!isAdmin}
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-sans">
                  Triggers WARNING state in SCADA and energizes Yellow Relay.
                </p>
              </div>

              {/* Critical Threshold */}
              <div className="bg-slate-900/80 p-3.5 rounded border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-rose-400 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Critical Flood Threshold & Red Relay</span>
                  </label>
                  <span className="text-slate-200 font-bold">{criticalThreshold} cm</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="120"
                  step="1"
                  disabled={!isAdmin}
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-sans">
                  Triggers CRITICAL flood state and energizes Red Relay / Evacuation Alert.
                </p>
              </div>

              {/* Timeout & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <label className="text-slate-300 block mb-1">
                    Stale Timeout Window:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="30"
                      max="600"
                      disabled={!isAdmin}
                      value={offlineTimeout}
                      onChange={(e) => setOfflineTimeout(Number(e.target.value))}
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                    />
                    <span className="text-slate-400">seconds</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <label className="text-slate-300 block mb-1">
                    Display Measurement Unit:
                  </label>
                  <select
                    disabled={!isAdmin}
                    value={displayUnit}
                    onChange={(e) => setDisplayUnit(e.target.value as 'cm' | 'm')}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  >
                    <option value="cm">Centimeters (cm) - Prototype Default</option>
                    <option value="m">Meters (m)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isAdmin ? (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded border border-slate-800 hover:bg-slate-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore ASU Defaults</span>
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Thresholds</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic pt-2">
                Viewer mode active. Switch to Admin Mode via the top bar to calibrate thresholds.
              </p>
            )}
          </form>
        </div>

        {/* Live Relays & Architectural Contract Notice (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <RelayIndicator relays={relays} />

          {/* Architectural Separation Notice */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <ShieldAlert className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider">
                Industrial SCADA Safety Boundary
              </h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              In accordance with fail-safe IoT guidelines:
            </p>

            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>
                <strong className="text-slate-300">Local Arduino UNO Execution:</strong> Physical relays are driven directly by Arduino UNO based on GPIO27 UART telemetry from ESP32 #2.
              </li>
              <li>
                <strong className="text-slate-300">Monitoring Only:</strong> This web console observes and reports telemetry. It deliberately possesses no direct remote actuator control commands that could disrupt physical riverfront warning beacons.
              </li>
              <li>
                <strong className="text-slate-300">Fail-Silent Guarantee:</strong> Complete network or internet breakdown will never halt local LoRa reception, buzzer alert, or relay operation.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
