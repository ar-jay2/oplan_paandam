import React, { useState, useMemo } from 'react';
import { FloodReading, FloodSettings, FloodStatus } from '../../types/telemetry';
import {
  Download,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Filter,
  BarChart2,
  FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

type TimeRangePreset = '1h' | '24h' | '7d' | '30d' | 'custom';

interface Props {
  readings: FloodReading[];
  settings: FloodSettings;
  nodeName: string;
  nodeCode: string;
}

export const HistoricalAnalyticsPage: React.FC<Props> = ({
  readings,
  settings,
  nodeName,
  nodeCode,
}) => {
  const [range, setRange] = useState<TimeRangePreset>('24h');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const now = Date.now();

  // Filtered readings based on selected range
  const filteredReadings = useMemo(() => {
    let cutoff = now;
    if (range === '1h') cutoff = now - 60 * 60 * 1000;
    else if (range === '24h') cutoff = now - 24 * 60 * 60 * 1000;
    else if (range === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (range === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (range === 'custom') {
      const startMs = startDate ? new Date(startDate).getTime() : 0;
      const endMs = endDate ? new Date(endDate).getTime() : Infinity;
      return readings.filter((r) => {
        const time = new Date(r.received_at).getTime();
        return time >= startMs && time <= endMs;
      });
    }

    return readings.filter((r) => new Date(r.received_at).getTime() >= cutoff);
  }, [readings, range, startDate, endDate, now]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        normalCount: 0,
        warningCount: 0,
        criticalCount: 0,
        totalHours: 0,
        normalPct: 0,
        warningPct: 0,
        criticalPct: 0,
      };
    }

    const levels = filteredReadings.map((r) => r.water_level);
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    const sum = levels.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / levels.length;

    let normalCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    filteredReadings.forEach((r) => {
      if (r.flood_status === 'NORMAL') normalCount++;
      else if (r.flood_status === 'WARNING') warningCount++;
      else if (r.flood_status === 'CRITICAL') criticalCount++;
    });

    const total = filteredReadings.length;
    const normalPct = Math.round((normalCount / total) * 100);
    const warningPct = Math.round((warningCount / total) * 100);
    const criticalPct = Math.round((criticalCount / total) * 100);

    return {
      min,
      max,
      avg,
      normalCount,
      warningCount,
      criticalCount,
      normalPct,
      warningPct,
      criticalPct,
    };
  }, [filteredReadings]);

  // Chart data format
  const chartData = useMemo(() => {
    return filteredReadings.map((r) => ({
      time: new Date(r.received_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      waterLevel: r.water_level,
      status: r.flood_status,
    }));
  }, [filteredReadings]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (filteredReadings.length === 0) return;

    const headers = [
      'Timestamp',
      'Node Code',
      'Water Level (cm)',
      'Ultrasonic Distance (cm)',
      'Flood Status',
      'LoRa Sequence',
      'RSSI (dBm)',
      'SNR (dB)',
      'Sensor Online',
    ];

    const rows = filteredReadings.map((r) => [
      `"${r.received_at}"`,
      `"${nodeCode}"`,
      r.water_level,
      r.distance_cm,
      `"${r.flood_status}"`,
      r.sequence_number,
      r.rssi ?? '',
      r.snr ?? '',
      r.sensor_online ? 'true' : 'false',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pa-andam-telemetry-${nodeCode}-${range}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 uppercase font-mono tracking-wider">
            Historical Flood Analytics & Telemetry Archive
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical multi-point hydrological records for {nodeName} ({nodeCode})
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-md">
            {(['1h', '24h', '7d', '30d', 'custom'] as TimeRangePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setRange(p)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  range === p
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === '1h'
                  ? 'Last 1h'
                  : p === '24h'
                  ? '24h'
                  : p === '7d'
                  ? '7 Days'
                  : p === '30d'
                  ? '30 Days'
                  : 'Custom'}
              </button>
            ))}
          </div>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredReadings.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker if active */}
      {range === 'custom' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Start Time:</span>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">End Time:</span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <span className="text-slate-400 text-[11px]">
            Showing {filteredReadings.length} matching data points
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Maximum Level</span>
          <p className="text-xl font-mono font-bold text-rose-400 mt-1 tabular-nums">
            {stats.max.toFixed(1)} <span className="text-xs font-normal text-slate-400">cm</span>
          </p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Minimum Level</span>
          <p className="text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
            {stats.min.toFixed(1)} <span className="text-xs font-normal text-slate-400">cm</span>
          </p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Average Level</span>
          <p className="text-xl font-mono font-bold text-cyan-300 mt-1 tabular-nums">
            {stats.avg.toFixed(1)} <span className="text-xs font-normal text-slate-400">cm</span>
          </p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Normal Duration</span>
          <p className="text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
            {stats.normalPct}%
          </p>
          <span className="text-[10px] font-mono text-slate-400">{stats.normalCount} samples</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Warning Incidents</span>
          <p className="text-xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
            {stats.warningCount}
          </p>
          <span className="text-[10px] font-mono text-slate-400">{stats.warningPct}% of time</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Critical Alerts</span>
          <p className="text-xl font-mono font-bold text-rose-400 mt-1 tabular-nums">
            {stats.criticalCount}
          </p>
          <span className="text-[10px] font-mono text-slate-400">{stats.criticalPct}% of time</span>
        </div>
      </div>

      {/* Main Historical Area Chart */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300">
            Water Level Dispersion Curve
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Total Samples: {filteredReadings.length}
          </span>
        </div>

        {filteredReadings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
            <BarChart2 className="w-8 h-8 text-slate-600 mb-2" />
            <p>No telemetry records found for this timeframe.</p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
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
                  unit=" cm"
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
                <ReferenceLine
                  y={settings.warning_threshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Warning 50cm', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                />
                <ReferenceLine
                  y={settings.critical_threshold}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: 'Critical 80cm', fill: '#f43f5e', fontSize: 10, position: 'insideTopRight' }}
                />
                <Area
                  type="monotone"
                  dataKey="waterLevel"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#waterGrad)"
                  name="Water Level (cm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Flood Status Distribution Timeline Progress */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 mb-3">
          Categorical Flood Risk Exposure Breakdown
        </h3>

        <div className="h-4 w-full bg-slate-900 rounded-md overflow-hidden flex">
          <div
            style={{ width: `${stats.normalPct}%` }}
            className="bg-emerald-500 h-full transition-all"
            title={`Normal: ${stats.normalPct}%`}
          />
          <div
            style={{ width: `${stats.warningPct}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Warning: ${stats.warningPct}%`}
          />
          <div
            style={{ width: `${stats.criticalPct}%` }}
            className="bg-rose-500 h-full transition-all"
            title={`Critical: ${stats.criticalPct}%`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            <span>Normal: {stats.normalPct}% ({stats.normalCount} samples)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
            <span>Warning: {stats.warningPct}% ({stats.warningCount} samples)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
            <span>Critical: {stats.criticalPct}% ({stats.criticalCount} samples)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
