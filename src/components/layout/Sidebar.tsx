import React from 'react';
import { NavigationPage } from '../../types/telemetry';
import {
  LayoutDashboard,
  Activity,
  History,
  AlertTriangle,
  Radio,
  Sliders,
  FileText,
  Settings,
  Waves,
  ChevronRight,
  Shield,
  Clock
} from 'lucide-react';

interface Props {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  selectedNodeCode: string;
  selectedNodeName: string;
  isStale: boolean;
  lastReadingTime: string | null;
}

export const Sidebar: React.FC<Props> = ({
  currentPage,
  onNavigate,
  isOpen,
  onCloseMobile,
  selectedNodeCode,
  selectedNodeName,
  isStale,
  lastReadingTime,
}) => {
  const navItems: { id: NavigationPage; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'live', label: 'Live Monitoring', icon: Activity },
    { id: 'analytics', label: 'Historical Analytics', icon: History },
    { id: 'events', label: 'Flood Events', icon: AlertTriangle },
    { id: 'nodes', label: 'Sensor Nodes', icon: Radio },
    { id: 'alerts', label: 'Alerts & Thresholds', icon: Sliders },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-[#080d19] border-r border-slate-800 flex flex-col z-40 transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <Waves className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-100 truncate">
              OPLAN PA-ANDAM
            </h1>
            <p className="text-[11px] text-slate-400 truncate">
              ASU-Ibajay Flood IoT
            </p>
          </div>
        </div>

        {/* Selected Station Banner */}
        <div className="px-4 py-3 bg-[#0d1527] border-b border-slate-800/60">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Active Station</span>
            <span className={isStale ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isStale ? 'Telemetry Stale' : 'Live Sync'}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate">{selectedNodeCode}</p>
          <p className="text-[11px] text-slate-400 truncate">{selectedNodeName}</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400/80" />}
              </button>
            );
          })}
        </nav>

        {/* Research Attribution Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#090e1b] text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-slate-300">ASU-Ibajay Campus</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Multi-Protocol IoT: JSN-SR04T · 433MHz LoRa · ESP32 · Supabase Realtime
          </p>
          {lastReadingTime && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="truncate">Last: {new Date(lastReadingTime).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
