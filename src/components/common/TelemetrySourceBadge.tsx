import React from 'react';
import { TelemetrySource } from '../../types/telemetry';
import { Cpu, Database, FlaskConical } from 'lucide-react';

interface Props {
  source: TelemetrySource;
  className?: string;
  size?: 'sm' | 'md';
}

export const TelemetrySourceBadge: React.FC<Props> = ({ source, className = '', size = 'md' }) => {
  const isHardware = source === 'REAL HARDWARE DATA';
  const isDbTest = source === 'DATABASE TEST DATA';

  const badgeStyle = isHardware
    ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300'
    : isDbTest
    ? 'bg-blue-950/70 border-blue-500/60 text-blue-300'
    : 'bg-amber-950/70 border-amber-500/60 text-amber-300';

  const Icon = isHardware ? Cpu : isDbTest ? Database : FlaskConical;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono tracking-wider font-semibold uppercase border rounded-md ${badgeStyle} ${padding} ${className}`}
      title={
        isHardware
          ? 'Live verified packets received from physical ESP32 gateway'
          : isDbTest
          ? 'Historical readings loaded from Supabase PostgreSQL database'
          : 'Locally generated test data for interface validation'
      }
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{source}</span>
    </div>
  );
};
