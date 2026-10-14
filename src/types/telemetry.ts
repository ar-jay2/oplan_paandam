/**
 * OPLAN PA-ANDAM Flood Monitoring Types
 * Aklan State University - Ibajay Campus
 */

export type FloodStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'NO DATA';

export type TelemetrySource = 'REAL HARDWARE DATA' | 'DATABASE TEST DATA' | 'DEMO DATA';

export type ConnectionState = 'connected' | 'connecting' | 'stale' | 'disconnected' | 'error';

export interface FloodNode {
  id: string;
  node_code: string;
  node_name: string;
  description?: string | null;
  location_description?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FloodReading {
  id: string;
  node_id: string;
  water_level: number;
  distance_cm: number;
  flood_status: FloodStatus;
  sequence_number: number;
  rssi?: number | null;
  snr?: number | null;
  sensor_online: boolean;
  received_at: string;
  source?: TelemetrySource;
}

export interface FloodEvent {
  id: string;
  node_id: string;
  previous_status: FloodStatus | null;
  new_status: FloodStatus;
  water_level: number | null;
  event_time: string;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  notes?: string | null;
  acknowledged_by?: string | null;
}

export interface FloodSettings {
  id: string;
  green_threshold: number; // default 20 cm
  warning_threshold: number; // default 50 cm
  critical_threshold: number; // default 80 cm
  offline_timeout_seconds: number; // default 120 seconds
  display_water_level_unit: 'cm' | 'm';
  updated_at: string;
}

export interface RelayStates {
  green: boolean;  // >= 20 and < 50
  yellow: boolean; // >= 50 and < 80
  red: boolean;    // >= 80
  reason: string;
}

export interface RawLoraPacket {
  header: 'PAANDAM';
  waterLevel: number;
  distance: number;
  status: FloodStatus;
  sequence: number;
  rawString: string;
  timestamp: string;
}

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  hasAnonKey: boolean;
  projectUrl: string;
  lastSyncTime: string | null;
  lastSuccessfulReadingTime: string | null;
  errorMessage: string | null;
  isRlsError: boolean;
  readingsCount: number;
  observedCadenceSeconds?: number | null;
}

export type NavigationPage =
  | 'overview'
  | 'live'
  | 'analytics'
  | 'events'
  | 'nodes'
  | 'alerts'
  | 'reports'
  | 'settings';

