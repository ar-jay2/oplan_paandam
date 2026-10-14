import React, { useState } from 'react';
import { FloodEvent, FloodStatus } from '../../types/telemetry';
import { StatusBadge } from '../common/StatusBadge';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  CheckCircle,
  Clock,
  UserCheck,
  FileEdit,
  Filter,
  Check
} from 'lucide-react';

interface Props {
  events: FloodEvent[];
  isAdmin: boolean;
  onAcknowledge: (eventId: string, adminName: string, notes?: string) => void;
}

export const FloodEventsPage: React.FC<Props> = ({ events, isAdmin, onAcknowledge }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedEventForAck, setSelectedEventForAck] = useState<FloodEvent | null>(null);
  const [adminName, setAdminName] = useState<string>('Engr. Trixxie Mae Quetua (ASU)');
  const [ackNotes, setAckNotes] = useState<string>('');

  const filteredEvents = events.filter((ev) => {
    if (filterStatus === 'unacknowledged') return !ev.acknowledged;
    if (filterStatus === 'critical') return ev.new_status === 'CRITICAL';
    if (filterStatus === 'warning') return ev.new_status === 'WARNING';
    return true;
  });

  const handleConfirmAck = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEventForAck) {
      onAcknowledge(selectedEventForAck.id, adminName, ackNotes);
      setSelectedEventForAck(null);
      setAckNotes('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Row */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 uppercase font-mono tracking-wider">
            Hydrological State Transition Log & Alerts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Discrete boundary transitions recorded by the multi-protocol IoT framework
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-md">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'unacknowledged', label: 'Pending Ack' },
            { id: 'critical', label: 'Critical Only' },
            { id: 'warning', label: 'Warning Only' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                filterStatus === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Transparency Note */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-400 flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-300">
            Hardware Alarm Dispatch Transparency:
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            Local physical relays (Green, Yellow, Red) and onboard buzzers activate instantly at ESP32 #2 / Arduino UNO.
            External SMS / cellular modem notifications are not asserted until a hardware GSM shield or dedicated SMS gateway is verified and connected.
          </p>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-8 text-center text-slate-400 font-mono text-xs">
            <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
            <p>No flood transition incidents match the active filter criteria.</p>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const isCritical = ev.new_status === 'CRITICAL';
            const isWarning = ev.new_status === 'WARNING';

            return (
              <div
                key={ev.id}
                className={`border rounded-lg p-4 transition-all ${
                  isCritical
                    ? 'bg-rose-950/25 border-rose-500/50'
                    : isWarning
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-[#0f172a] border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Transition Description */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCritical ? (
                        <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold text-slate-300">
                          Transition:
                        </span>
                        <StatusBadge status={ev.previous_status || 'NORMAL'} size="sm" showIcon={false} />
                        <span className="text-slate-400 text-xs">→</span>
                        <StatusBadge status={ev.new_status} size="sm" />

                        <span className="text-xs font-mono text-cyan-400 ml-2">
                          @ {ev.water_level !== null ? `${ev.water_level.toFixed(1)} cm` : 'N/A'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 font-mono">
                        Timestamp: {new Date(ev.event_time).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Acknowledgment Status & Action */}
                  <div className="flex items-center gap-3">
                    {ev.acknowledged ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/60">
                          <Check className="w-3 h-3" />
                          <span>Acknowledged</span>
                        </span>
                        {ev.acknowledged_by && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            By {ev.acknowledged_by}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60">
                          Pending Review
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => setSelectedEventForAck(ev)}
                            className="px-3 py-1 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Administrator Logged Notes if present */}
                {ev.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded">
                    <span className="font-semibold text-slate-400 text-[11px] block mb-0.5 uppercase font-mono">
                      Administrator Remarks:
                    </span>
                    <p className="italic text-slate-300">{ev.notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Acknowledgment Modal */}
      {selectedEventForAck && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>Acknowledge Flood Alert</span>
              </h3>
              <button
                onClick={() => setSelectedEventForAck(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAck} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-mono">Event Target:</label>
                <div className="p-2 bg-slate-900 rounded border border-slate-800 font-mono text-slate-200">
                  {selectedEventForAck.previous_status || 'NORMAL'} → {selectedEventForAck.new_status} (
                  {selectedEventForAck.water_level?.toFixed(1)} cm)
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Authorized Responder Name:</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Action Notes / Field Observations:</label>
                <textarea
                  rows={3}
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="e.g. Dispatched campus MDRRMO team; water clearance confirmed safe; siren operational."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedEventForAck(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  Confirm Acknowledgment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
