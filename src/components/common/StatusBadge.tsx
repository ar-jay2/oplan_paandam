import React from 'react';
import { FloodStatus } from '../../types/telemetry';
import { ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';

interface Props {
  status: FloodStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md', showIcon = true }) => {
  let colorClasses = '';
  let label = status;
  let Icon = HelpCircle;

  switch (status) {
    case 'NORMAL':
      colorClasses = 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
      Icon = ShieldCheck;
      break;
    case 'WARNING':
      colorClasses = 'text-amber-300 bg-amber-950/60 border-amber-500/40';
      Icon = AlertTriangle;
      break;
    case 'CRITICAL':
      colorClasses = 'text-rose-400 bg-rose-950/60 border-rose-500/50 animate-pulse';
      Icon = AlertOctagon;
      break;
    case 'NO DATA':
    default:
      colorClasses = 'text-slate-400 bg-slate-900 border-slate-700';
      Icon = HelpCircle;
      break;
  }

  const sizeClasses =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-sm gap-2 font-bold'
      : size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1 font-medium'
      : 'px-2.5 py-1 text-xs gap-1.5 font-semibold';

  return (
    <span
      className={`inline-flex items-center border rounded-md font-mono tracking-wide ${colorClasses} ${sizeClasses}`}
      role="status"
      aria-label={`Flood status: ${status}`}
    >
      {showIcon && <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
    </span>
  );
};
