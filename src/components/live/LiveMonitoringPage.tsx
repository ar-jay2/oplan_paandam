import React, { useMemo } from 'react';
import {
  FloodReading,
  FloodNode,
  FloodSettings,
  RelayStates,
  TelemetrySource,
  ConnectionState,
  RawLoraPacket,
} from '../../types/telemetry';
import { StatusBadge } from '../common/StatusBadge';
import { TelemetrySourceBadge } from '../common/TelemetrySourceBadge';
import { RelayIndicator } from '../common/RelayIndicator';
import {
  Activity,
  AlertTriangle,
  Radio,
  Signal,
  Clock,
  Gauge,
  Layers,
  Terminal,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

interface Props {
  latestReading?: FloodReading;
  historicalReadings: FloodReading[];
  node?: FloodNode;
  settings: FloodSettings;
  relays: RelayStates;
  telemetrySource: TelemetrySource;
  connectionState: ConnectionState;
  isStale: boolean;
  latestPacket: RawLoraPacket | null;
  observedCadence?: number | null;
  freshnessState?: {
    state: 'fresh' | 'delayed' | 'stale' | 'disconnected';
    label: string;
    elapsedSeconds: number | null;
    observedCadence: number | null;
  };
  supabaseStatus?: {
    isConnected: boolean;
    errorMessage: string | null;
    lastSuccessfulReadingTime: string | null;
  };
}

export const LiveMonitoringPage: React.FC<Props> = ({
  latestReading,
  historicalReadings,
  node,
  settings,
  relays,
  telemetrySource,
  connectionState,
  isStale,
  latestPacket,
  observedCadence,
  freshnessState = { state: 'disconnected', label: 'NO DATA', elapsedSeconds: null, observedCadence: null },
  supabaseStatus,
}) => {
  const waterLevel = latestReading ? latestReading.water_level : 0;
  const distance = latestReading ? latestReading.distance_cm : 0;
  const status = latestReading ? latestReading.flood_status : 'NO DATA';
  const isOnline = latestReading ? latestReading.sensor_online : false;
  const unit = settings.display_water_level_unit;

  // Chart data for current live session
  const chartData = useMemo(() => {
    return historicalReadings.slice(-40).map((r) => ({
      time: new Date(r.received_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      waterLevel: r.water_level,
      distance: r.distance_cm,
    }));
  }, [historicalReadings]);

  // Visual river stage fill percentage (assuming 100cm total transducer height)
  const totalHeight = 100;
  const waterFillPct = Math.min(100, Math.max(0, (waterLevel / totalHeight) * 100));

  return (
    <div className="space-y-6">
      {/* Top Station Status Strip */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mb-1">
            <span className="font-mono text-cyan-400 font-bold bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded">
              NODE: {node?.node_code || 'PA-ANDAM-001'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{node?.location_description || 'Location not configured'}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">{node?.node_name || 'ASU-Ibajay Flood Monitoring Node'}</h2>
          {latestReading ? (
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Last Telemetry:</span>
                <strong className="text-slate-200">
                  {new Date(latestReading.received_at).toLocaleDateString()} {new Date(latestReading.received_at).toLocaleTimeString()}
                </strong>
                {freshnessState.elapsedSeconds !== null && (
                  <span className="text-slate-400">({freshnessState.elapsedSeconds}s ago)</span>
                )}
              </span>
              {observedCadence && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-cyan-300">
                    ESP32 Cadence: ~{observedCadence}s
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs font-mono text-slate-400 mt-1">
              Status: Awaiting first telemetry packet from ESP32 gateway
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dynamic Freshness State Badge */}
          <span
            className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase tracking-wider ${
              freshnessState.state === 'fresh'
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50'
                : freshnessState.state === 'delayed'
                ? 'bg-amber-950/70 text-amber-300 border-amber-500/50'
                : freshnessState.state === 'stale'
                ? 'bg-rose-950/70 text-rose-300 border-rose-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {freshnessState.label}
          </span>
          <StatusBadge status={status} size="lg" />
        </div>
      </div>

      {/* Main Dual Stage: Left Big Gauge & Physical Cross-Section, Right Telemetry Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Physical Level Cross-Section Visualizer (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300">
                Ultrasonic Embankment Cross-Section
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">JSN-SR04T Sensor</span>
            </div>

            {/* Graphic representation of river channel */}
            <div className="relative h-64 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex">
              {/* Scale ruler on left */}
              <div className="w-14 bg-slate-900/80 border-r border-slate-800/80 flex flex-col justify-between p-1.5 text-[10px] font-mono text-slate-400 select-none">
                <span className="text-rose-400 font-bold">100cm (Sensor)</span>
                <span className="text-rose-400">80cm (Crit)</span>
                <span className="text-amber-400">50cm (Warn)</span>
                <span className="text-emerald-400">20cm (Min)</span>
                <span className="text-slate-400">0cm (Bed)</span>
              </div>

              {/* River water visualizer */}
              <div className="flex-1 relative flex flex-col justify-end bg-gradient-to-b from-slate-950 to-slate-900">
                {/* Critical threshold line */}
                <div className="absolute top-[20%] left-0 right-0 border-b border-rose-500/70 border-dashed z-10 flex justify-end pr-2">
                  <span className="text-[9px] font-mono text-rose-400 bg-slate-950/80 px-1 rounded">
                    Critical 80cm
                  </span>
                </div>
                {/* Warning threshold line */}
                <div className="absolute top-[50%] left-0 right-0 border-b border-amber-500/70 border-dashed z-10 flex justify-end pr-2">
                  <span className="text-[9px] font-mono text-amber-400 bg-slate-950/80 px-1 rounded">
                    Warning 50cm
                  </span>
                </div>
                {/* Relay baseline line */}
                <div className="absolute top-[80%] left-0 right-0 border-b border-emerald-500/70 border-dashed z-10 flex justify-end pr-2">
                  <span className="text-[9px] font-mono text-emerald-400 bg-slate-950/80 px-1 rounded">
                    Relay Base 20cm
                  </span>
                </div>

                {/* Ultrasonic sound beam simulation */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 text-[10px] font-mono text-cyan-300">
                  <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-cyan-500/40">
                    Distance: {distance.toFixed(1)} cm
                  </span>
                  <div className="w-0.5 h-12 bg-cyan-400/40 my-1 animate-pulse" />
                </div>

                {/* Water Body */}
                <div
                  className={`w-full transition-all duration-700 relative border-t ${
                    status === 'CRITICAL'
                      ? 'bg-rose-500/30 border-rose-400'
                      : status === 'WARNING'
                      ? 'bg-amber-500/30 border-amber-400'
                      : 'bg-cyan-500/25 border-cyan-400'
                  }`}
                  style={{ height: `${waterFillPct}%` }}
                >
                  <div className="absolute top-2 left-3 text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Water Level: {waterLevel.toFixed(1)} cm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Readout */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
            <div>
              <p className="text-[11px] font-mono uppercase text-slate-400">Current Depth</p>
              <p className="text-2xl font-mono font-bold text-cyan-400 tabular-nums">
                {waterLevel.toFixed(1)} <span className="text-xs text-slate-400">{unit}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase text-slate-400">Air Clearance</p>
              <p className="text-2xl font-mono font-bold text-slate-200 tabular-nums">
                {distance.toFixed(1)} <span className="text-xs text-slate-400">{unit}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry Parameters & Session Chart (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">LoRa RSSI</span>
              <p className="text-lg font-mono font-bold text-slate-100 mt-1 tabular-nums">
                {latestReading?.rssi ?? '--'} <span className="text-xs font-normal text-slate-400">dBm</span>
              </p>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">LoRa SNR</span>
              <p className="text-lg font-mono font-bold text-slate-100 mt-1 tabular-nums">
                {latestReading?.snr ?? '--'} <span className="text-xs font-normal text-slate-400">dB</span>
              </p>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">Sequence</span>
              <p className="text-lg font-mono font-bold text-cyan-300 mt-1 tabular-nums">
                #{latestReading?.sequence_number ?? 0}
              </p>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400">Transducer</span>
              <p
                className={`text-sm font-mono font-bold mt-1.5 ${
                  isOnline ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isOnline ? 'CONNECTED' : 'OFFLINE'}
              </p>
            </div>
          </div>

          {/* Live Session Chart */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300">
                Continuous Session Waveform
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                Last {chartData.length} Packets
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                    unit={` ${unit}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090e1b',
                      borderColor: '#334155',
                      borderRadius: '6px',
                      fontFamily: 'IBM Plex Mono',
                      fontSize: '11px',
                    }}
                  />
                  <ReferenceLine y={settings.green_threshold} stroke="#10b981" strokeDasharray="3 3" />
                  <ReferenceLine y={settings.warning_threshold} stroke="#f59e0b" strokeDasharray="3 3" />
                  <ReferenceLine y={settings.critical_threshold} stroke="#f43f5e" strokeDasharray="3 3" />
                  <Line
                    type="stepAfter"
                    dataKey="waterLevel"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    name="Water Level"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Raw LoRa Packet Dissector Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300">
                  ESP32 LoRa Packet Dissector
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Format: PAANDAM,waterLevel,distance,status,sequence
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto">
              <code>
                {latestPacket ? latestPacket.rawString : `PAANDAM,${waterLevel.toFixed(2)},${distance.toFixed(2)},${status},${latestReading?.sequence_number ?? 0}`}
              </code>
            </div>

            <div className="grid grid-cols-5 gap-2 mt-2 text-[10px] font-mono text-slate-400 text-center">
              <div className="bg-slate-900/60 p-1 rounded border border-slate-800">
                <span className="text-slate-400 block">Header</span>
                <span className="text-cyan-400 font-bold">PAANDAM</span>
              </div>
              <div className="bg-slate-900/60 p-1 rounded border border-slate-800">
                <span className="text-slate-400 block">Water Level</span>
                <span className="text-slate-200">{waterLevel.toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/60 p-1 rounded border border-slate-800">
                <span className="text-slate-400 block">Distance</span>
                <span className="text-slate-200">{distance.toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/60 p-1 rounded border border-slate-800">
                <span className="text-slate-400 block">Status</span>
                <span className="text-amber-400">{status}</span>
              </div>
              <div className="bg-slate-900/60 p-1 rounded border border-slate-800">
                <span className="text-slate-400 block">Seq #</span>
                <span className="text-slate-200">{latestReading?.sequence_number ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relays Monitoring */}
      <RelayIndicator relays={relays} />
    </div>
  );
};
