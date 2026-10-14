/**
 * Central Reactive Telemetry & State Store
 * Handles real hardware data from Supabase Realtime, historical queries,
 * threshold evaluation, relay logic, and development simulation.
 */
import {
  FloodNode,
  FloodReading,
  FloodEvent,
  FloodSettings,
  FloodStatus,
  RelayStates,
  TelemetrySource,
  ConnectionState,
  RawLoraPacket
} from '../types/telemetry';
import { getSupabase } from './supabaseClient';

const DEFAULT_NODE: FloodNode = {
  id: 'node-pa-andam-001',
  node_code: 'PA-ANDAM-001',
  node_name: 'ASU-Ibajay Riverside Station 1',
  description: 'Primary JSN-SR04T ultrasonic node with 433MHz RA-02 LoRa link',
  location_description: 'Ibajay River Embankment, ASU-Ibajay Campus (Near Agribusiness Center)',
  enabled: true,
  created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_SETTINGS: FloodSettings = {
  id: 'settings-default',
  green_threshold: 20,
  warning_threshold: 50,
  critical_threshold: 80,
  offline_timeout_seconds: 120,
  display_water_level_unit: 'cm',
  updated_at: new Date().toISOString(),
};

// Initial realistic historical readings (past 2 hours)
function generateInitialHistoricalData(nodeId: string): FloodReading[] {
  const readings: FloodReading[] = [];
  const now = Date.now();
  let seq = 700;
  // Baseline total height = 100 cm (sensor height from river bed)
  const totalSensorHeight = 100;

  for (let i = 60; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000).toISOString();
    // Simulate slight natural water oscillation around 31-36 cm
    const noise = Math.sin(i / 5) * 3 + (Math.random() - 0.5) * 1.5;
    const waterLevel = Number((32.5 + noise).toFixed(2));
    const distanceCm = Number((totalSensorHeight - waterLevel).toFixed(2));
    seq++;

    readings.push({
      id: `reading-init-${i}`,
      node_id: nodeId,
      water_level: waterLevel,
      distance_cm: distanceCm,
      flood_status: 'NORMAL',
      sequence_number: seq,
      rssi: -78 + Math.floor(Math.random() * 6),
      snr: Number((8.5 + (Math.random() - 0.5)).toFixed(1)),
      sensor_online: true,
      received_at: timestamp,
      source: 'DEMO DATA',
    });
  }
  return readings;
}

export class TelemetryStore {
  private static instance: TelemetryStore;

  private nodes: FloodNode[] = [DEFAULT_NODE];
  private selectedNodeId: string = DEFAULT_NODE.id;
  private settings: FloodSettings = DEFAULT_SETTINGS;
  private readings: FloodReading[] = [];
  private events: FloodEvent[] = [];
  private latestPacket: RawLoraPacket | null = null;
  private telemetrySource: TelemetrySource = 'DEMO DATA';
  private connectionState: ConnectionState = 'connected';
  private simulationActive: boolean = true;
  private simIntervalId: any = null;
  private sequenceCounter: number = 762;
  private isAdmin: boolean = true; // For ASU research demo access

  private listeners: Set<() => void> = new Set();
  private supabaseRealtimeChannel: any = null;

  private constructor() {
    this.readings = generateInitialHistoricalData(DEFAULT_NODE.id);
    this.initInitialEvents();
    this.initRealtimeOrSimulation();
  }

  public static getInstance(): TelemetryStore {
    if (!TelemetryStore.instance) {
      TelemetryStore.instance = new TelemetryStore();
    }
    return TelemetryStore.instance;
  }

  private initInitialEvents() {
    this.events = [
      {
        id: 'event-01',
        node_id: DEFAULT_NODE.id,
        previous_status: 'NORMAL',
        new_status: 'WARNING',
        water_level: 54.2,
        event_time: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        acknowledged: true,
        acknowledged_at: new Date(Date.now() - 35 * 3600 * 1000).toISOString(),
        acknowledged_by: 'MDRRMO Officer Ibajay',
        notes: 'Monitored due to continuous monsoon rain. Relays engaged yellow indicator at riverside.',
      },
      {
        id: 'event-02',
        node_id: DEFAULT_NODE.id,
        previous_status: 'WARNING',
        new_status: 'NORMAL',
        water_level: 46.8,
        event_time: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
        acknowledged: true,
        acknowledged_at: new Date(Date.now() - 27 * 3600 * 1000).toISOString(),
        acknowledged_by: 'ASU Research Team',
        notes: 'Water level subsided below warning threshold of 50 cm. Normal condition restored.',
      },
    ];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying telemetry listener:', err);
      }
    });
  }

  // Determine Flood Status strictly based on research thresholds
  public computeFloodStatus(waterLevel: number | null, isOnline: boolean): FloodStatus {
    if (!isOnline || waterLevel === null || isNaN(waterLevel)) {
      return 'NO DATA';
    }
    if (waterLevel < this.settings.warning_threshold) {
      return 'NORMAL';
    }
    if (waterLevel >= this.settings.warning_threshold && waterLevel < this.settings.critical_threshold) {
      return 'WARNING';
    }
    return 'CRITICAL';
  }

  // Local Physical Relays logic:
  // Inactive below 20 cm and when sensor is offline.
  // Green relay: 20 <= water < 50
  // Yellow relay: 50 <= water < 80
  // Red relay: water >= 80
  public computeRelayStates(waterLevel: number | null, isOnline: boolean): RelayStates {
    if (!isOnline || waterLevel === null || isNaN(waterLevel)) {
      return {
        green: false,
        yellow: false,
        red: false,
        reason: 'All relays disabled: sensor is offline or telemetry is unavailable.',
      };
    }

    if (waterLevel < this.settings.green_threshold) {
      return {
        green: false,
        yellow: false,
        red: false,
        reason: `Standby: water level (${waterLevel.toFixed(1)} cm) is below physical activation baseline (${this.settings.green_threshold} cm).`,
      };
    }

    if (waterLevel >= this.settings.green_threshold && waterLevel < this.settings.warning_threshold) {
      return {
        green: true,
        yellow: false,
        red: false,
        reason: `Green Relay Active: Normal stream flow detected (${this.settings.green_threshold} - ${this.settings.warning_threshold} cm).`,
      };
    }

    if (waterLevel >= this.settings.warning_threshold && waterLevel < this.settings.critical_threshold) {
      return {
        green: false,
        yellow: true,
        red: false,
        reason: `Yellow Relay Active: Warning threshold breached (${this.settings.warning_threshold} - ${this.settings.critical_threshold} cm). Caution advised.`,
      };
    }

    return {
      green: false,
      yellow: false,
      red: true,
      reason: `Red Relay Active: CRITICAL flood level exceeded (>= ${this.settings.critical_threshold} cm). Immediate evacuation alert!`,
    };
  }

  // Staleness check
  public isReadingStale(lastReading?: FloodReading): boolean {
    if (!lastReading) return true;
    const diffSeconds = (Date.now() - new Date(lastReading.received_at).getTime()) / 1000;
    return diffSeconds > this.settings.offline_timeout_seconds;
  }

  public getLatestReading(nodeId?: string): FloodReading | undefined {
    const targetNodeId = nodeId || this.selectedNodeId;
    const nodeReadings = this.readings.filter((r) => r.node_id === targetNodeId);
    return nodeReadings[nodeReadings.length - 1];
  }

  public getReadings(nodeId?: string): FloodReading[] {
    const targetNodeId = nodeId || this.selectedNodeId;
    return this.readings.filter((r) => r.node_id === targetNodeId);
  }

  public getNodes(): FloodNode[] {
    return [...this.nodes];
  }

  public getSelectedNode(): FloodNode | undefined {
    return this.nodes.find((n) => n.id === this.selectedNodeId) || this.nodes[0];
  }

  public setSelectedNodeId(id: string) {
    this.selectedNodeId = id;
    this.notify();
  }

  public getEvents(): FloodEvent[] {
    return [...this.events].sort(
      (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime()
    );
  }

  public getSettings(): FloodSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<FloodSettings>) {
    this.settings = {
      ...this.settings,
      ...newSettings,
      updated_at: new Date().toISOString(),
    };
    this.notify();
  }

  public getLatestPacket(): RawLoraPacket | null {
    return this.latestPacket;
  }

  public getTelemetrySource(): TelemetrySource {
    return this.telemetrySource;
  }

  public getConnectionState(): ConnectionState {
    const latest = this.getLatestReading();
    if (!latest) return 'disconnected';
    if (this.isReadingStale(latest)) return 'stale';
    return this.connectionState;
  }

  public isSimulationActive(): boolean {
    return this.simulationActive;
  }

  public getIsAdmin(): boolean {
    return this.isAdmin;
  }

  public setIsAdmin(admin: boolean) {
    this.isAdmin = admin;
    this.notify();
  }

  // Node CRUD
  public addNode(node: Omit<FloodNode, 'id' | 'created_at' | 'updated_at'>) {
    const newNode: FloodNode = {
      ...node,
      id: `node-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.nodes.push(newNode);
    this.notify();
    return newNode;
  }

  public updateNode(id: string, updates: Partial<FloodNode>) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n
    );
    this.notify();
  }

  public deleteNode(id: string) {
    if (this.nodes.length <= 1) {
      throw new Error('Cannot delete the primary research node.');
    }
    this.nodes = this.nodes.filter((n) => n.id !== id);
    if (this.selectedNodeId === id) {
      this.selectedNodeId = this.nodes[0].id;
    }
    this.notify();
  }

  // Event Acknowledgment
  public acknowledgeEvent(eventId: string, acknowledgedBy: string, notes?: string) {
    this.events = this.events.map((ev) => {
      if (ev.id === eventId) {
        return {
          ...ev,
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: acknowledgedBy || 'Authorized Admin',
          notes: notes !== undefined ? notes : ev.notes,
        };
      }
      return ev;
    });
    this.notify();
  }

  // Ingest reading (from Supabase Realtime, API, or Simulation)
  public ingestReading(
    readingData: Omit<FloodReading, 'id'>,
    packetRaw?: string,
    source: TelemetrySource = 'DEMO DATA'
  ) {
    const newReading: FloodReading = {
      ...readingData,
      id: `reading-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source,
    };

    // Keep memory clean: max 200 readings per session
    this.readings = [...this.readings.slice(-199), newReading];
    this.telemetrySource = source;
    this.connectionState = 'connected';

    if (packetRaw) {
      this.latestPacket = {
        header: 'PAANDAM',
        waterLevel: readingData.water_level,
        distance: readingData.distance_cm,
        status: readingData.flood_status,
        sequence: readingData.sequence_number,
        rawString: packetRaw,
        timestamp: newReading.received_at,
      };
    }

    // Check for state transitions and record events without duplicates
    this.checkForStatusTransition(newReading);

    this.notify();
  }

  private checkForStatusTransition(newReading: FloodReading) {
    const prevReading = this.readings[this.readings.length - 2];
    const prevStatus = prevReading ? prevReading.flood_status : null;
    const currentStatus = newReading.flood_status;

    // Only create an event when status actually changes and is not 'NO DATA'
    if (prevStatus && prevStatus !== currentStatus && currentStatus !== 'NO DATA') {
      const newEvent: FloodEvent = {
        id: `ev-${Date.now()}`,
        node_id: newReading.node_id,
        previous_status: prevStatus,
        new_status: currentStatus,
        water_level: newReading.water_level,
        event_time: newReading.received_at,
        acknowledged: false,
        acknowledged_at: null,
        notes: null,
        acknowledged_by: null,
      };

      this.events = [newEvent, ...this.events];
    }
  }

  // Realtime Supabase initialization
  public async initRealtimeOrSimulation() {
    const { client, isConfigured } = getSupabase();

    if (isConfigured && client) {
      try {
        console.log('Connecting to Supabase Realtime for flood monitoring...');
        // Query latest readings
        const { data: latestData, error } = await client
          .from('flood_readings')
          .select('*')
          .order('received_at', { ascending: false })
          .limit(50);

        if (!error && latestData && latestData.length > 0) {
          // Real database readings found!
          this.readings = latestData.reverse().map((r: any) => ({
            id: r.id,
            node_id: r.node_id || DEFAULT_NODE.id,
            water_level: Number(r.water_level),
            distance_cm: Number(r.distance_cm),
            flood_status: r.flood_status as FloodStatus,
            sequence_number: Number(r.sequence_number),
            rssi: r.rssi ? Number(r.rssi) : null,
            snr: r.snr ? Number(r.snr) : null,
            sensor_online: Boolean(r.sensor_online),
            received_at: r.received_at,
            source: 'REAL HARDWARE DATA',
          }));
          this.telemetrySource = 'REAL HARDWARE DATA';
          this.stopSimulation();
        }

        // Subscribe to live inserts
        if (this.supabaseRealtimeChannel) {
          client.removeChannel(this.supabaseRealtimeChannel);
        }

        this.supabaseRealtimeChannel = client
          .channel('public:flood_readings')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'flood_readings' },
            (payload) => {
              const r = payload.new;
              this.ingestReading(
                {
                  node_id: r.node_id || DEFAULT_NODE.id,
                  water_level: Number(r.water_level),
                  distance_cm: Number(r.distance_cm),
                  flood_status: r.flood_status as FloodStatus,
                  sequence_number: Number(r.sequence_number),
                  rssi: r.rssi ? Number(r.rssi) : null,
                  snr: r.snr ? Number(r.snr) : null,
                  sensor_online: Boolean(r.sensor_online),
                  received_at: r.received_at || new Date().toISOString(),
                },
                `PAANDAM,${Number(r.water_level).toFixed(2)},${Number(r.distance_cm).toFixed(2)},${r.flood_status},${r.sequence_number}`,
                'REAL HARDWARE DATA'
              );
            }
          )
          .subscribe();

        return;
      } catch (err) {
        console.warn('Supabase Realtime subscription not active, using simulation mode:', err);
      }
    }

    // Default: Run simulation mode for reliable prototype demonstration
    if (this.simulationActive) {
      this.startSimulation();
    }
  }

  // Simulation controls for laboratory testing and presentation
  public startSimulation() {
    if (this.simIntervalId) clearInterval(this.simIntervalId);
    this.simulationActive = true;

    this.simIntervalId = setInterval(() => {
      this.generateSimulatedTick();
    }, 4000);
    this.notify();
  }

  public stopSimulation() {
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = null;
    }
    this.simulationActive = false;
    this.notify();
  }

  public toggleSimulation() {
    if (this.simulationActive) {
      this.stopSimulation();
    } else {
      this.startSimulation();
    }
  }

  public injectPacket(waterLevel: number, sensorOnline: boolean = true) {
    this.sequenceCounter++;
    const totalSensorHeight = 100;
    const distanceCm = Number((totalSensorHeight - waterLevel).toFixed(2));
    const status = this.computeFloodStatus(waterLevel, sensorOnline);
    const packetStr = `PAANDAM,${waterLevel.toFixed(2)},${distanceCm.toFixed(2)},${status},${this.sequenceCounter}`;

    this.ingestReading(
      {
        node_id: this.selectedNodeId,
        water_level: Number(waterLevel.toFixed(2)),
        distance_cm: distanceCm,
        flood_status: status,
        sequence_number: this.sequenceCounter,
        rssi: -79 + Math.floor(Math.random() * 8),
        snr: Number((8.2 + (Math.random() - 0.5) * 1.5).toFixed(1)),
        sensor_online: sensorOnline,
        received_at: new Date().toISOString(),
      },
      packetStr,
      'DEMO DATA'
    );
  }

  private generateSimulatedTick() {
    const latest = this.getLatestReading();
    let currentWater = latest ? latest.water_level : 33.2;

    // Subtle natural wave fluctuations
    const wave = (Math.random() - 0.48) * 1.2;
    let nextWater = Math.max(12, Math.min(95, currentWater + wave));
    nextWater = Number(nextWater.toFixed(2));

    this.injectPacket(nextWater, true);
  }
}

export const telemetryStore = TelemetryStore.getInstance();
