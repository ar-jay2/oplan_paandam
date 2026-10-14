import React, { useMemo } from 'react';
import {
  FloodReading,
  FloodNode,
  FloodSettings,
  RelayStates,
  TelemetrySource,
  ConnectionState,
} from '../../types/telemetry';
import { StatusBadge } from '../common/StatusBadge';
import { RelayIndicator } from '../common/RelayIndicator';
import { TelemetrySourceBadge } from '../common/TelemetrySourceBadge';
import {
  Activity,
  AlertTriangle,
  Radio,
  Signal,
  Clock,
  Gauge,
  ArrowUpRight,
  TrendingUp,
  Hash,
  AlertOctagon,
  ShieldCheck,
  Cpu
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
  onNavigateToLive: () => void;
  onNavigateToAnalytics: () => void;
}

export const OverviewPage: React.FC<Props> = ({
  latestReading,
  historicalReadings,
  node,
  settings,
  relays,
  telemetrySource,
  connectionState,
  isStale,
  observedCadence,
  freshnessState = { state: 'disconnected', label: 'NO DATA', elapsedSeconds: null, observedCadence: null },
  supabaseStatus,
  onNavigateToLive,
  onNavigateToAnalytics,
}) => {
  const waterLevel = latestReading ? latestReading.water_level : 0;
  const distance = latestReading ? latestReading.distance_cm : 0;
  const status = latestReading ? latestReading.flood_status : 'NO DATA';
  const isOnline = latestReading ? latestReading.sensor_online : false;
  const unit = settings.display_water_level_unit;

  // Chart data: past 20-30 readings for trend
  const chartData = useMemo(() => {
    const subset = historicalReadings.slice(-30);
    return subset.map((r) => ({
      time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      waterLevel: r.water_level,
      status: r.flood_status,
    }));
  }, [historicalReadings]);

  return (
    <div className="space-y-6">
      {/* Supabase Error Alert if active */}
      {supabaseStatus?.errorMessage && !supabaseStatus.isConnected && (
        <div className="bg-rose-950/70 border border-rose-500/60 rounded-lg p-3.5 flex items-start justify-between text-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Supabase Connection Error
              </p>
              <p className="text-xs text-rose-200/90 mt-0.5">
                {supabaseStatus.errorMessage}
              </p>
              {supabaseStatus.lastSuccessfulReadingTime && (
                <p className="text-[11px] font-mono text-slate-300 mt-1">
                  Last successful reading received at: {new Date(supabaseStatus.lastSuccessfulReadingTime).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <span className="text-[11px] font-mono text-rose-300 bg-rose-900/60 px-2 py-1 rounded border border-rose-700 shrink-0">
            CONNECTION FAILED
          </span>
        </div>
      )}

      {/* Waiting for first telemetry or Staleness Warning Banner */}
      {!latestReading ? (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3.5 flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Awaiting Initial Telemetry Stream
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Listening for real-time ESP32 LoRa readings in Supabase table <code className="text-cyan-300 font-mono">flood_readings</code>. As soon as the edge function receives a packet, the dashboard updates automatically.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-1 rounded border border-cyan-800/60 shrink-0">
            AUTO-LISTENING
          </span>
        </div>
      ) : isStale ? (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-lg p-3.5 flex items-center justify-between text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                Telemetry Stale Warning
              </p>
              <p className="text-xs text-amber-300/90 mt-0.5">
                No new packet received within the configured timeout window ({settings.offline_timeout_seconds} seconds). Last reading was at {new Date(latestReading.received_at).toLocaleTimeString()} ({freshnessState.elapsedSeconds ? `${freshnessState.elapsedSeconds}s ago` : ''}).
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-900/50 px-2 py-1 rounded border border-amber-600/40 shrink-0">
            TIMEOUT EXCEEDED
          </span>
        </div>
      ) : null}

      {/* Primary Research Station Info Header */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-mono text-cyan-400 font-bold bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded">
              NODE: {node?.node_code || 'PA-ANDAM-001'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{node?.location_description || 'Location not configured'}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">
            {node?.node_name || 'ASU-Ibajay Flood Monitoring Node'}
          </h2>
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
          <TelemetrySourceBadge source={telemetrySource} />
          {/* Freshness Badge */}
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

      {/* Grid of Key SCADA Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Water Level */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="uppercase tracking-wider">Current Water Level</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold text-slate-100 tabular-nums">
              {waterLevel.toFixed(1)}
            </span>
            <span className="text-xs font-mono uppercase text-slate-400">{unit}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">Baseline Target:</span>
            <span className="font-mono text-slate-300">
              {waterLevel < 50 ? '< 50.0 cm (Normal)' : waterLevel < 80 ? '50 - 80 cm (Warning)' : '≥ 80 cm (Critical)'}
            </span>
          </div>
        </div>

        {/* Card 2: Sensor Distance */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="uppercase tracking-wider">Ultrasonic Distance</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold text-slate-100 tabular-nums">
              {distance.toFixed(1)}
            </span>
            <span className="text-xs font-mono uppercase text-slate-400">{unit}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">Transducer:</span>
            <span className="font-mono text-slate-300">JSN-SR04T Waterproof</span>
          </div>
        </div>

        {/* Card 3: LoRa Link Quality */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="uppercase tracking-wider">433MHz LoRa Link</span>
            <Signal className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-mono font-bold text-slate-100 tabular-nums">
                {latestReading?.rssi ?? '--'}
              </span>
              <span className="text-xs font-mono uppercase text-slate-400 ml-1">dBm</span>
            </div>
            <div className="pl-3 border-l border-slate-800">
              <span className="text-2xl font-mono font-bold text-slate-100 tabular-nums">
                {latestReading?.snr ?? '--'}
              </span>
              <span className="text-xs font-mono uppercase text-slate-400 ml-1">dB</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">Hardware Link:</span>
            <span className="font-mono text-emerald-400">RA-02 RF Nominal</span>
          </div>
        </div>

        {/* Card 4: Packet Sequence & Node State */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="uppercase tracking-wider">Packet Sequence</span>
            <Hash className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-bold text-slate-100 tabular-nums">
              #{latestReading?.sequence_number ?? 0}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">Sensor Status:</span>
            <span
              className={`font-mono font-semibold ${
                isOnline ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isOnline ? 'ONLINE' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Visualizer: Real-time Water Level Trend Chart */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase font-mono tracking-wider">
              Water Level Trend & SCADA Thresholds
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live telemetry series with calibrated Warning (50 cm) and Critical (80 cm) boundary references
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToLive}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Live View</span>
            </button>
            <button
              onClick={onNavigateToAnalytics}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* Recharts Trend Line */}
        {chartData.length === 0 ? (
          <div className="h-64 sm:h-72 w-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-400 font-mono text-xs">
            <Activity className="w-8 h-8 text-cyan-500/50 mb-2 animate-pulse" />
            <p className="text-slate-200 font-bold mb-1">Awaiting Telemetry Packets</p>
            <p className="text-[11px] text-slate-400 max-w-md">
              The waveform will plot live as soon as readings are received by the Edge Function and inserted into <code className="text-cyan-300">flood_readings</code>.
            </p>
          </div>
        ) : (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  unit={` ${unit}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090e1b',
                    borderColor: '#334155',
                    borderRadius: '6px',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '12px',
                    color: '#e2e8f0',
                  }}
                />
                {/* Relay Green line at 20 */}
                <ReferenceLine
                  y={settings.green_threshold}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: `Relay Min (${settings.green_threshold}cm)`,
                    fill: '#10b981',
                    fontSize: 10,
                    position: 'insideBottomRight',
                  }}
                />
                {/* Warning threshold line at 50 */}
                <ReferenceLine
                  y={settings.warning_threshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: `Warning (${settings.warning_threshold}cm)`,
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                {/* Critical threshold line at 80 */}
                <ReferenceLine
                  y={settings.critical_threshold}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{
                    value: `Critical (${settings.critical_threshold}cm)`,
                    fill: '#f43f5e',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="waterLevel"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#06b6d4' }}
                  activeDot={{ r: 5, fill: '#22d3ee' }}
                  name="Water Level"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Relays Hardware Status Section */}
      <RelayIndicator relays={relays} />
    </div>
  );
};
