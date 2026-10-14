import React, { useState } from 'react';
import { FloodNode, FloodReading, FloodEvent, FloodSettings, TelemetrySource } from '../../types/telemetry';
import { TelemetrySourceBadge } from '../common/TelemetrySourceBadge';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Shield,
  Clock
} from 'lucide-react';

interface Props {
  node?: FloodNode;
  readings: FloodReading[];
  events: FloodEvent[];
  settings: FloodSettings;
  telemetrySource: TelemetrySource;
}

export const ReportsPage: React.FC<Props> = ({
  node,
  readings,
  events,
  settings,
  telemetrySource,
}) => {
  const [reportRange, setReportRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [reportTitle, setReportTitle] = useState<string>(
    'Hydrological Field Telemetry & Flood Risk Assessment Report'
  );

  const levels = readings.map((r) => r.water_level);
  const maxLevel = levels.length ? Math.max(...levels) : 0;
  const minLevel = levels.length ? Math.min(...levels) : 0;
  const avgLevel = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;

  const warningBreaches = events.filter((e) => e.new_status === 'WARNING').length;
  const criticalBreaches = events.filter((e) => e.new_status === 'CRITICAL').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 uppercase font-mono tracking-wider">
            Official Research & Incident Reporting Station
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Prepared for Aklan State University–Ibajay Campus and Ibajay MDRRMO
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={reportRange}
            onChange={(e) => setReportRange(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
          >
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-6 sm:p-8 space-y-6 print:bg-white print:text-black print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="border-b border-slate-800 pb-6 print:border-slate-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 print:text-blue-700 font-mono text-xs uppercase tracking-wider mb-1">
                <Building className="w-4 h-4" />
                <span>Aklan State University – Ibajay Campus</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 print:text-slate-900">
                OPLAN PA-ANDAM: Telemetry & Hydrology Report
              </h1>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                A Resilient Multi-Protocol IoT Framework for Real-Time Flood Monitoring
              </p>
            </div>

            <div className="text-right">
              <TelemetrySourceBadge source={telemetrySource} />
              <p className="text-[11px] font-mono text-slate-400 print:text-slate-500 mt-2">
                Report Date: {new Date().toLocaleDateString()}
              </p>
              <p className="text-[11px] font-mono text-slate-400 print:text-slate-500">
                Timeframe: {reportRange === '24h' ? '24 Hours' : reportRange === '7d' ? '7 Days' : '30 Days'}
              </p>
            </div>
          </div>
        </div>

        {/* Station Profile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-slate-900/80 p-3 rounded border border-slate-800 print:border-slate-300 print:bg-slate-50">
            <span className="text-slate-400 print:text-slate-500 block uppercase text-[10px]">Station Identifier</span>
            <span className="text-slate-100 print:text-slate-900 font-bold text-sm">{node?.node_code}</span>
            <span className="text-slate-400 print:text-slate-600 block mt-0.5">{node?.node_name}</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded border border-slate-800 print:border-slate-300 print:bg-slate-50">
            <span className="text-slate-400 print:text-slate-500 block uppercase text-[10px]">Deployment Location</span>
            <span className="text-slate-200 print:text-slate-800 font-semibold">
              {node?.location_description || 'Location not configured'}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded border border-slate-800 print:border-slate-300 print:bg-slate-50">
            <span className="text-slate-400 print:text-slate-500 block uppercase text-[10px]">Multi-Protocol Stack</span>
            <span className="text-cyan-300 print:text-blue-700">JSN-SR04T · RA-02 433MHz LoRa · ESP32 · Supabase</span>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div>
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 print:text-slate-800 mb-3">
            1. Hydrological Summary & Statistical Distribution
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800 print:border-slate-300">
              <span className="text-slate-400 text-[10px] block">High-Water Mark (Peak)</span>
              <span className="text-lg font-bold text-rose-400 print:text-rose-700 tabular-nums">
                {maxLevel.toFixed(1)} cm
              </span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded border border-slate-800 print:border-slate-300">
              <span className="text-slate-400 text-[10px] block">Minimum Base Level</span>
              <span className="text-lg font-bold text-emerald-400 print:text-emerald-700 tabular-nums">
                {minLevel.toFixed(1)} cm
              </span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded border border-slate-800 print:border-slate-300">
              <span className="text-slate-400 text-[10px] block">Mean Hydrological Depth</span>
              <span className="text-lg font-bold text-cyan-300 print:text-blue-700 tabular-nums">
                {avgLevel.toFixed(1)} cm
              </span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded border border-slate-800 print:border-slate-300">
              <span className="text-slate-400 text-[10px] block">Telemetry Samples</span>
              <span className="text-lg font-bold text-slate-200 print:text-slate-900 tabular-nums">
                {readings.length}
              </span>
            </div>
          </div>
        </div>

        {/* Threshold Reference */}
        <div>
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 print:text-slate-800 mb-2">
            2. Calibrated Flood Warning Thresholds
          </h3>
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded text-xs space-y-1 text-slate-400 print:border-slate-300 print:text-slate-700 font-mono">
            <p>• Normal Stage: Water level &lt; {settings.warning_threshold} cm (Green Relay: ≥ {settings.green_threshold} cm)</p>
            <p>• Warning Stage: {settings.warning_threshold} cm ≤ Water level &lt; {settings.critical_threshold} cm (Yellow Relay)</p>
            <p>• Critical Stage: Water level ≥ {settings.critical_threshold} cm (Red Relay / Evacuation Siren)</p>
          </div>
        </div>

        {/* Transition Log Table */}
        <div>
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 print:text-slate-800 mb-3">
            3. Recorded Flood Incidents & Administrator Acknowledgments
          </h3>
          <div className="border border-slate-800 rounded overflow-hidden print:border-slate-300">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 print:bg-slate-100 print:text-slate-700">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Transition</th>
                  <th className="p-2.5">Water Level</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Acknowledgment / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-slate-300 print:text-slate-800">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                      No state transitions recorded during this timeframe.
                    </td>
                  </tr>
                ) : (
                  events.slice(0, 8).map((ev) => (
                    <tr key={ev.id}>
                      <td className="p-2.5">{new Date(ev.event_time).toLocaleString()}</td>
                      <td className="p-2.5 font-bold">
                        {ev.previous_status || 'INIT'} → {ev.new_status}
                      </td>
                      <td className="p-2.5">{ev.water_level !== null ? `${ev.water_level.toFixed(1)} cm` : 'N/A'}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            ev.new_status === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300'
                              : ev.new_status === 'WARNING'
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}
                        >
                          {ev.new_status}
                        </span>
                      </td>
                      <td className="p-2.5 text-[11px] text-slate-400 print:text-slate-600">
                        {ev.acknowledged ? `Ack by ${ev.acknowledged_by || 'Admin'}: ${ev.notes || 'Reviewed'}` : 'Pending review'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formal Institutional Sign-off Block */}
        <div className="pt-8 border-t border-slate-800 print:border-slate-300 grid grid-cols-2 gap-8 text-xs font-mono text-slate-400 print:text-slate-800">
          <div>
            <p className="uppercase text-[10px] text-slate-400">Lead Researcher / Project Engineer</p>
            <div className="mt-8 border-t border-slate-700 print:border-slate-400 pt-1">
              <p className="font-bold text-slate-200 print:text-black">Engr. Trixxie Mae Quetua</p>
              <p className="text-[11px]">Aklan State University – Ibajay Campus</p>
            </div>
          </div>

          <div>
            <p className="uppercase text-[10px] text-slate-400">MDRRMO Representative / Verification Officer</p>
            <div className="mt-8 border-t border-slate-700 print:border-slate-400 pt-1">
              <p className="font-bold text-slate-200 print:text-black">Authorized MDRRMO Officer</p>
              <p className="text-[11px]">Municipality of Ibajay, Province of Aklan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
