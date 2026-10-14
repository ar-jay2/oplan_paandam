/**
 * Central Reactive Telemetry & State Store
 * Handles real hardware data from Supabase Realtime, automatic polling refresh,
 * joining flood_nodes, RLS diagnostic feedback, and optional manual emulation.
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
  RawLoraPacket,
  SupabaseConnectionStatus,
} from '../types/telemetry';
import { getSupabase, getStoredSupabaseConfig } from './supabaseClient';

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

export class TelemetryStore {
  private static instance: TelemetryStore;

  private nodes: FloodNode[] = [DEFAULT_NODE];
  private selectedNodeId: string = DEFAULT_NODE.id;
  private settings: FloodSettings = DEFAULT_SETTINGS;
  private readings: FloodReading[] = [];
  private events: FloodEvent[] = [];
  private latestPacket: RawLoraPacket | null = null;
  private telemetrySource: TelemetrySource = 'REAL HARDWARE DATA';
  private connectionState: ConnectionState = 'connecting';
  private simulationActive: boolean = false; // Disabled by default; real hardware data is preferred
  private simIntervalId: any = null;
  private pollingIntervalId: any = null;
  private sequenceCounter: number = 0;
  private isAdmin: boolean = true;
  private isLoading: boolean = true;

  private supabaseStatus: SupabaseConnectionStatus = {
    isConfigured: false,
    isConnected: false,
    hasAnonKey: false,
    projectUrl: '',
    lastSyncTime: null,
    lastSuccessfulReadingTime: null,
    errorMessage: null,
    isRlsError: false,
    readingsCount: 0,
  };

  private listeners: Set<() => void> = new Set();
  private supabaseRealtimeChannel: any = null;

  private constructor() {
    // Start with empty real data (no fake sine wave readings)
    this.readings = [];
    this.events = [];
    this.initSupabaseData();
    this.startAutoRefresh();
  }

  public static getInstance(): TelemetryStore {
    if (!TelemetryStore.instance) {
      TelemetryStore.instance = new TelemetryStore();
    }
    return TelemetryStore.instance;
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

  // Staleness check based on observed transmission cadence and configured timeout
  public isReadingStale(lastReading?: FloodReading): boolean {
    if (!lastReading) return true;
    const diffSeconds = (Date.now() - new Date(lastReading.received_at).getTime()) / 1000;
    const cadence = this.getObservedTransmissionInterval(lastReading.node_id);
    // If we have an observed cadence from the ESP32 (e.g. 15s, 30s), consider stale after 3 missed intervals or offline_timeout_seconds
    const effectiveTimeout = cadence
      ? Math.max(cadence * 3, Math.min(60, this.settings.offline_timeout_seconds))
      : this.settings.offline_timeout_seconds;
    return diffSeconds > effectiveTimeout;
  }

  // Calculate actual observed ESP32 LoRa transmission interval (in seconds)
  public getObservedTransmissionInterval(nodeId?: string): number | null {
    const targetNodeId = nodeId || this.selectedNodeId;
    const nodeReadings = this.readings
      .filter((r) => r.node_id === targetNodeId || (this.nodes.length === 1 && r.source === 'REAL HARDWARE DATA'))
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

    if (nodeReadings.length < 2) return null;

    const recent = nodeReadings.slice(-6); // sample last 5 intervals
    let sumDiff = 0;
    for (let i = 1; i < recent.length; i++) {
      const diff = (new Date(recent[i].received_at).getTime() - new Date(recent[i - 1].received_at).getTime()) / 1000;
      sumDiff += diff;
    }
    const avg = Math.round(sumDiff / (recent.length - 1));
    return avg > 0 && avg < 3600 ? avg : null;
  }

  // Dynamic freshness state: FRESH (LIVE), DELAYED, STALE, DISCONNECTED
  public getFreshnessState(nodeId?: string): {
    state: 'fresh' | 'delayed' | 'stale' | 'disconnected';
    label: string;
    elapsedSeconds: number | null;
    observedCadence: number | null;
  } {
    const latest = this.getLatestReading(nodeId);
    if (!latest || (!this.supabaseStatus.isConnected && this.readings.length === 0)) {
      return {
        state: 'disconnected',
        label: !latest ? 'NO DATA' : 'DISCONNECTED',
        elapsedSeconds: null,
        observedCadence: null,
      };
    }

    const elapsed = Math.max(0, Math.round((Date.now() - new Date(latest.received_at).getTime()) / 1000));
    const cadence = this.getObservedTransmissionInterval(nodeId);
    
    // Stale threshold is derived from actual ESP32 transmission cadence (3 missed packets) or settings
    const staleThreshold = cadence
      ? Math.max(cadence * 3, Math.min(60, this.settings.offline_timeout_seconds))
      : this.settings.offline_timeout_seconds;

    // Fresh threshold: within ~1.8x cadence or default 30-45s
    const freshThreshold = cadence
      ? Math.min(staleThreshold - 10, Math.max(25, Math.round(cadence * 1.8)))
      : 45;

    if (elapsed <= freshThreshold) {
      return {
        state: 'fresh',
        label: 'FRESH (LIVE)',
        elapsedSeconds: elapsed,
        observedCadence: cadence,
      };
    }

    if (elapsed <= staleThreshold) {
      return {
        state: 'delayed',
        label: `DELAYED (${elapsed}s)`,
        elapsedSeconds: elapsed,
        observedCadence: cadence,
      };
    }

    // If packet has exceeded 2x stale threshold or sensor is flagged offline
    if (elapsed > Math.max(staleThreshold * 2, 300) || !latest.sensor_online) {
      return {
        state: 'disconnected',
        label: !latest.sensor_online ? 'SENSOR OFFLINE' : `DISCONNECTED (${elapsed}s)`,
        elapsedSeconds: elapsed,
        observedCadence: cadence,
      };
    }

    return {
      state: 'stale',
      label: `STALE (>${staleThreshold}s)`,
      elapsedSeconds: elapsed,
      observedCadence: cadence,
    };
  }

  public getLatestReading(nodeId?: string): FloodReading | undefined {
    const targetNodeId = nodeId || this.selectedNodeId;
    const nodeReadings = this.readings
      .filter((r) => r.node_id === targetNodeId)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

    if (nodeReadings.length > 0) {
      return nodeReadings[nodeReadings.length - 1];
    }

    // If targetNodeId doesn't match directly, check if targetNodeId is the only registered station
    // or if the station's node_code matches
    const selectedNode = this.nodes.find((n) => n.id === targetNodeId);
    if (selectedNode) {
      // Find any reading associated with this node's code or fallback if single station
      if (this.nodes.length === 1 && this.readings.length > 0) {
        const sortedAll = [...this.readings].sort(
          (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        );
        return sortedAll[sortedAll.length - 1];
      }
    }

    // Fallback to absolute latest reading across all nodes if selectedNodeId has no readings
    if (!nodeId && this.readings.length > 0) {
      const sortedAll = [...this.readings].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
      );
      return sortedAll[sortedAll.length - 1];
    }

    return undefined;
  }

  public getReadings(nodeId?: string): FloodReading[] {
    const targetNodeId = nodeId || this.selectedNodeId;
    const filtered = this.readings.filter((r) => r.node_id === targetNodeId);
    if (filtered.length > 0) {
      return filtered;
    }
    // If this is the only node in the registry, return all readings
    if (this.nodes.length === 1 && this.readings.length > 0) {
      return this.readings;
    }
    return nodeId ? [] : this.readings;
  }

  public getAllReadings(): FloodReading[] {
    return [...this.readings];
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

  public getSupabaseStatus(): SupabaseConnectionStatus {
    return { ...this.supabaseStatus };
  }

  public getIsLoading(): boolean {
    return this.isLoading;
  }

  public updateSettings(newSettings: Partial<FloodSettings>) {
    this.settings = {
      ...this.settings,
      ...newSettings,
      updated_at: new Date().toISOString(),
    };
    this.notify();

    // Sync to Supabase if configured
    const { client } = getSupabase();
    if (client && this.supabaseStatus.isConnected) {
      client
        .from('flood_settings')
        .upsert({
          id: this.settings.id,
          green_threshold: this.settings.green_threshold,
          warning_threshold: this.settings.warning_threshold,
          critical_threshold: this.settings.critical_threshold,
          offline_timeout_seconds: this.settings.offline_timeout_seconds,
          display_water_level_unit: this.settings.display_water_level_unit,
          updated_at: this.settings.updated_at,
        })
        .then(({ error }) => {
          if (error) console.error('Failed to sync settings to Supabase:', error.message);
        });
    }
  }

  public getLatestPacket(): RawLoraPacket | null {
    return this.latestPacket;
  }

  public getTelemetrySource(): TelemetrySource {
    return this.telemetrySource;
  }

  public getConnectionState(): ConnectionState {
    if (this.supabaseStatus.isRlsError || (!this.supabaseStatus.isConnected && !this.simulationActive)) {
      return 'error';
    }
    const latest = this.getLatestReading();
    if (!latest) return 'connecting';
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

  // Node CRUD with Supabase synchronization
  public addNode(node: Omit<FloodNode, 'id' | 'created_at' | 'updated_at'>) {
    const newNode: FloodNode = {
      ...node,
      id: `node-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.nodes.push(newNode);
    this.notify();

    const { client } = getSupabase();
    if (client && this.supabaseStatus.isConnected) {
      client
        .from('flood_nodes')
        .insert({
          node_code: newNode.node_code,
          node_name: newNode.node_name,
          description: newNode.description,
          location_description: newNode.location_description,
          enabled: newNode.enabled,
        })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Failed to insert node to Supabase:', error.message);
          } else if (data) {
            // Update local ID to match Supabase UUID
            this.nodes = this.nodes.map((n) => (n.id === newNode.id ? { ...n, id: data.id } : n));
            this.notify();
          }
        });
    }

    return newNode;
  }

  public updateNode(id: string, updates: Partial<FloodNode>) {
    this.nodes = this.nodes.map((n) =>
      n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n
    );
    this.notify();

    const { client } = getSupabase();
    if (client && this.supabaseStatus.isConnected) {
      client
        .from('flood_nodes')
        .update({
          node_name: updates.node_name,
          description: updates.description,
          location_description: updates.location_description,
          enabled: updates.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update node in Supabase:', error.message);
        });
    }
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

    const { client } = getSupabase();
    if (client && this.supabaseStatus.isConnected) {
      client.from('flood_nodes').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete node in Supabase:', error.message);
      });
    }
  }

  // Event Acknowledgment
  public acknowledgeEvent(eventId: string, acknowledgedBy: string, notes?: string) {
    const ackTime = new Date().toISOString();
    this.events = this.events.map((ev) => {
      if (ev.id === eventId) {
        return {
          ...ev,
          acknowledged: true,
          acknowledged_at: ackTime,
          acknowledged_by: acknowledgedBy || 'Authorized Admin',
          notes: notes !== undefined ? notes : ev.notes,
        };
      }
      return ev;
    });
    this.notify();

    const { client } = getSupabase();
    if (client && this.supabaseStatus.isConnected) {
      client
        .from('flood_events')
        .update({
          acknowledged: true,
          acknowledged_at: ackTime,
          acknowledged_by: acknowledgedBy || 'Authorized Admin',
          notes: notes !== undefined ? notes : null,
        })
        .eq('id', eventId)
        .then(({ error }) => {
          if (error) console.error('Failed to acknowledge event in Supabase:', error.message);
        });
    }
  }

  // Ingest reading (from Realtime, Polling, or Emulation)
  public ingestReading(
    readingData: Omit<FloodReading, 'id'>,
    packetRaw?: string,
    source: TelemetrySource = 'REAL HARDWARE DATA'
  ) {
    const newReading: FloodReading = {
      ...readingData,
      id: `reading-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source,
    };

    // When real hardware telemetry arrives, immediately purge any lingering simulated/demo readings
    if (source === 'REAL HARDWARE DATA') {
      this.readings = this.readings.filter((r) => r.source !== 'DEMO DATA');
    }

    // Prevent duplicate sequence numbers from the same node if already present
    const isDuplicate = this.readings.some(
      (r) =>
        r.node_id === newReading.node_id &&
        r.sequence_number === newReading.sequence_number
    );

    if (isDuplicate) return;

    // Insert and sort strictly in chronological order (earliest to latest)
    this.readings = [...this.readings, newReading].sort(
      (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    );

    // Keep memory clean: max 250 readings per session
    if (this.readings.length > 250) {
      this.readings = this.readings.slice(-250);
    }

    this.telemetrySource = source;
    this.connectionState = 'connected';

    if (source === 'REAL HARDWARE DATA') {
      const newTime = new Date(newReading.received_at).getTime();
      const prevTime = this.supabaseStatus.lastSuccessfulReadingTime
        ? new Date(this.supabaseStatus.lastSuccessfulReadingTime).getTime()
        : 0;
      if (newTime >= prevTime) {
        this.supabaseStatus.lastSuccessfulReadingTime = newReading.received_at;
      }
      this.supabaseStatus.observedCadenceSeconds = this.getObservedTransmissionInterval(newReading.node_id);
    }

    // CRITICAL: Only update latestPacket if newReading is actually newer than or equal to current latestPacket
    const currentLatestTime = this.latestPacket ? new Date(this.latestPacket.timestamp).getTime() : 0;
    const newReadingTime = new Date(newReading.received_at).getTime();

    if (newReadingTime >= currentLatestTime) {
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
      } else {
        this.latestPacket = {
          header: 'PAANDAM',
          waterLevel: readingData.water_level,
          distance: readingData.distance_cm,
          status: readingData.flood_status,
          sequence: readingData.sequence_number,
          rawString: `PAANDAM,${readingData.water_level.toFixed(2)},${readingData.distance_cm.toFixed(2)},${readingData.flood_status},${readingData.sequence_number}`,
          timestamp: newReading.received_at,
        };
      }
    }

    this.checkForStatusTransition(newReading);
    this.notify();
  }

  private checkForStatusTransition(newReading: FloodReading) {
    const prevReading = this.readings[this.readings.length - 2];
    const prevStatus = prevReading ? prevReading.flood_status : null;
    const currentStatus = newReading.flood_status;

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

  // --- Real Supabase Data Ingestion and Synchronization ---

  public async initSupabaseData() {
    this.isLoading = true;
    this.notify();

    const { url, anonKey } = getStoredSupabaseConfig();
    this.supabaseStatus.projectUrl = url;
    this.supabaseStatus.hasAnonKey = Boolean(anonKey);
    this.supabaseStatus.isConfigured = Boolean(url && anonKey);

    const { client, isConfigured } = getSupabase();

    if (!isConfigured || !client) {
      this.isLoading = false;
      this.supabaseStatus.isConnected = false;
      this.supabaseStatus.errorMessage = !anonKey
        ? 'Awaiting Supabase Public Anon Key. Please enter your project anon key in System Settings.'
        : 'Supabase client configuration incomplete.';
      this.connectionState = 'disconnected';
      this.notify();
      return;
    }

    try {
      console.log(`[Supabase] Connecting to ${url}...`);

      // 1. Fetch Registered Nodes
      const { data: nodesData, error: nodesError } = await client
        .from('flood_nodes')
        .select('*')
        .order('created_at', { ascending: true });

      if (nodesError) {
        this.handleSupabaseError(nodesError, 'flood_nodes');
      } else if (nodesData && nodesData.length > 0) {
        this.nodes = nodesData.map((n: any) => ({
          id: n.id,
          node_code: n.node_code,
          node_name: n.node_name,
          description: n.description,
          location_description: n.location_description,
          enabled: Boolean(n.enabled),
          created_at: n.created_at,
          updated_at: n.updated_at,
        }));
        this.selectedNodeId = this.nodes[0].id;
      }

      // 2. Fetch Latest Readings (Joining flood_nodes)
      let rawReadings: any[] = [];
      const joinResponse = await client
        .from('flood_readings')
        .select(`
          id,
          node_id,
          water_level,
          distance_cm,
          flood_status,
          sequence_number,
          rssi,
          snr,
          sensor_online,
          received_at,
          flood_nodes (
            id,
            node_code,
            node_name,
            description,
            location_description,
            enabled
          )
        `)
        .order('received_at', { ascending: false })
        .limit(100);

      if (!joinResponse.error && joinResponse.data) {
        rawReadings = joinResponse.data;
      } else {
        // Fallback without join if foreign-key relationship cache is pending
        console.warn('[Supabase] Joined select failed, falling back to standard select:', joinResponse.error?.message);
        const simpleResponse = await client
          .from('flood_readings')
          .select('*')
          .order('received_at', { ascending: false })
          .limit(100);

        if (simpleResponse.error) {
          this.handleSupabaseError(simpleResponse.error, 'flood_readings');
        } else if (simpleResponse.data) {
          rawReadings = simpleResponse.data;
        }
      }

      // Process and populate readings
      if (rawReadings && rawReadings.length > 0) {
        // Extract embedded nodes if any were joined and update this.nodes
        rawReadings.forEach((r) => {
          if (r.flood_nodes && typeof r.flood_nodes === 'object') {
            const fn = r.flood_nodes;
            const existingIndex = this.nodes.findIndex((n) => n.id === fn.id || n.node_code === fn.node_code);
            if (existingIndex >= 0) {
              this.nodes[existingIndex] = {
                ...this.nodes[existingIndex],
                id: fn.id,
                node_code: fn.node_code,
                node_name: fn.node_name || this.nodes[existingIndex].node_name,
                description: fn.description || this.nodes[existingIndex].description,
                location_description: fn.location_description || this.nodes[existingIndex].location_description,
                enabled: fn.enabled !== undefined ? Boolean(fn.enabled) : this.nodes[existingIndex].enabled,
              };
            } else {
              this.nodes.push({
                id: fn.id,
                node_code: fn.node_code,
                node_name: fn.node_name,
                description: fn.description,
                location_description: fn.location_description,
                enabled: Boolean(fn.enabled),
                created_at: fn.created_at || new Date().toISOString(),
                updated_at: fn.updated_at || new Date().toISOString(),
              });
            }
          }
        });

        // Chronological order for time-series charts
        const sorted = [...rawReadings].reverse();
        this.readings = sorted.map((r: any) => ({
          id: r.id,
          node_id: r.node_id || this.nodes[0]?.id || DEFAULT_NODE.id,
          water_level: Number(r.water_level),
          distance_cm: Number(r.distance_cm),
          flood_status: r.flood_status as FloodStatus,
          sequence_number: Number(r.sequence_number),
          rssi: r.rssi !== null && r.rssi !== undefined ? Number(r.rssi) : null,
          snr: r.snr !== null && r.snr !== undefined ? Number(r.snr) : null,
          sensor_online: Boolean(r.sensor_online),
          received_at: r.received_at,
          source: 'REAL HARDWARE DATA',
        }));

        const latest = this.readings[this.readings.length - 1];
        if (latest) {
          // If default placeholder node is present, link its id with real telemetry node_id
          if (this.nodes.length === 1 && this.nodes[0].id === DEFAULT_NODE.id && latest.node_id) {
            this.nodes[0].id = latest.node_id;
          }
          this.selectedNodeId = latest.node_id;
          this.supabaseStatus.lastSuccessfulReadingTime = latest.received_at;
          this.supabaseStatus.observedCadenceSeconds = this.getObservedTransmissionInterval(latest.node_id);
          this.latestPacket = {
            header: 'PAANDAM',
            waterLevel: latest.water_level,
            distance: latest.distance_cm,
            status: latest.flood_status,
            sequence: latest.sequence_number,
            rawString: `PAANDAM,${latest.water_level.toFixed(2)},${latest.distance_cm.toFixed(2)},${latest.flood_status},${latest.sequence_number}`,
            timestamp: latest.received_at,
          };
        }

        this.telemetrySource = 'REAL HARDWARE DATA';
        this.supabaseStatus.readingsCount = this.readings.length;
      }

      // 3. Fetch Flood Events
      const { data: eventsData, error: eventsError } = await client
        .from('flood_events')
        .select('*')
        .order('event_time', { ascending: false })
        .limit(50);

      if (eventsError) {
        console.warn('[Supabase] Could not fetch flood_events:', eventsError.message);
      } else if (eventsData) {
        this.events = eventsData.map((ev: any) => ({
          id: ev.id,
          node_id: ev.node_id,
          previous_status: ev.previous_status,
          new_status: ev.new_status,
          water_level: ev.water_level !== null ? Number(ev.water_level) : null,
          event_time: ev.event_time,
          acknowledged: Boolean(ev.acknowledged),
          acknowledged_at: ev.acknowledged_at,
          acknowledged_by: ev.acknowledged_by,
          notes: ev.notes,
        }));
      }

      // 4. Fetch Settings
      const { data: settingsData } = await client
        .from('flood_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        this.settings = {
          id: settingsData.id,
          green_threshold: Number(settingsData.green_threshold ?? 20),
          warning_threshold: Number(settingsData.warning_threshold ?? 50),
          critical_threshold: Number(settingsData.critical_threshold ?? 80),
          offline_timeout_seconds: Number(settingsData.offline_timeout_seconds ?? 120),
          display_water_level_unit: settingsData.display_water_level_unit === 'm' ? 'm' : 'cm',
          updated_at: settingsData.updated_at || new Date().toISOString(),
        };
      }

      // Mark success
      this.supabaseStatus.isConnected = true;
      this.supabaseStatus.isRlsError = false;
      this.supabaseStatus.errorMessage = null;
      this.supabaseStatus.lastSyncTime = new Date().toISOString();
      this.connectionState = 'connected';

      // Setup Realtime WebSocket listeners
      this.setupRealtimeSubscription(client);
    } catch (err: any) {
      console.error('[Supabase] Ingestion init error:', err);
      this.supabaseStatus.isConnected = false;
      this.supabaseStatus.errorMessage = err.message || 'Network connection failed.';
      this.connectionState = 'error';
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  private handleSupabaseError(error: any, table: string) {
    console.error(`[Supabase Error on ${table}]:`, error);
    const msg = error.message || '';
    const isPermission =
      error.code === '42501' ||
      msg.toLowerCase().includes('permission denied') ||
      msg.toLowerCase().includes('row-level security') ||
      msg.toLowerCase().includes('violates row-level security');

    this.supabaseStatus.isConnected = false;
    this.supabaseStatus.isRlsError = isPermission;
    this.supabaseStatus.errorMessage = isPermission
      ? `Row Level Security (RLS) is blocking public read access on table '${table}'. You must add a SELECT policy for the 'anon' role in Supabase.`
      : `Database error on '${table}': ${msg}`;
    this.connectionState = 'error';
  }

  // Setup Realtime WebSocket listeners on flood_readings and flood_events
  private setupRealtimeSubscription(client: any) {
    if (this.supabaseRealtimeChannel) {
      try {
        client.removeChannel(this.supabaseRealtimeChannel);
      } catch (e) {
        // ignore
      }
    }

    this.supabaseRealtimeChannel = client
      .channel('pa-andam-telemetry-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'flood_readings' },
        (payload: any) => {
          const r = payload.new;
          console.log('[Supabase Realtime] Ingested packet from ESP32:', r);
          this.ingestReading(
            {
              node_id: r.node_id || this.selectedNodeId,
              water_level: Number(r.water_level),
              distance_cm: Number(r.distance_cm),
              flood_status: r.flood_status as FloodStatus,
              sequence_number: Number(r.sequence_number),
              rssi: r.rssi !== null && r.rssi !== undefined ? Number(r.rssi) : null,
              snr: r.snr !== null && r.snr !== undefined ? Number(r.snr) : null,
              sensor_online: Boolean(r.sensor_online),
              received_at: r.received_at || new Date().toISOString(),
            },
            `PAANDAM,${Number(r.water_level).toFixed(2)},${Number(r.distance_cm).toFixed(2)},${r.flood_status},${r.sequence_number}`,
            'REAL HARDWARE DATA'
          );
          this.supabaseStatus.lastSyncTime = new Date().toISOString();
          this.supabaseStatus.readingsCount = this.readings.length;
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'flood_events' },
        (payload: any) => {
          const ev = payload.new;
          const exists = this.events.some((e) => e.id === ev.id);
          if (!exists) {
            this.events = [
              {
                id: ev.id,
                node_id: ev.node_id,
                previous_status: ev.previous_status,
                new_status: ev.new_status,
                water_level: ev.water_level !== null ? Number(ev.water_level) : null,
                event_time: ev.event_time,
                acknowledged: Boolean(ev.acknowledged),
                acknowledged_at: ev.acknowledged_at,
                acknowledged_by: ev.acknowledged_by,
                notes: ev.notes,
              },
              ...this.events,
            ];
            this.notify();
          }
        }
      )
      .subscribe();
  }

  // Automatic Polling Watchdog: Refreshes readings every 4 seconds to guarantee updates
  private startAutoRefresh() {
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);

    this.pollingIntervalId = setInterval(async () => {
      // Do not poll if emulation is running
      if (this.simulationActive) return;

      const { client, isConfigured } = getSupabase();
      if (!isConfigured || !client || !this.supabaseStatus.isConnected) return;

      try {
        // Query the latest 5 readings to pick up any ESP32 updates
        const { data: latestBatch, error } = await client
          .from('flood_readings')
          .select('*')
          .order('received_at', { ascending: false })
          .limit(5);

        if (error) {
          console.warn('[Supabase Polling Error]:', error.message);
          this.supabaseStatus.isConnected = false;
          this.supabaseStatus.errorMessage = `Polling query failed: ${error.message}`;
          this.notify();
        } else if (latestBatch) {
          // If recovered
          if (!this.supabaseStatus.isConnected) {
            this.supabaseStatus.isConnected = true;
            this.supabaseStatus.errorMessage = null;
          }

          if (latestBatch.length > 0) {
            let hasNew = false;
            latestBatch.reverse().forEach((r: any) => {
              const alreadyExists = this.readings.some(
                (existing) => existing.id === r.id || (existing.sequence_number === Number(r.sequence_number) && existing.node_id === r.node_id)
              );
              if (!alreadyExists) {
                hasNew = true;
                this.ingestReading(
                  {
                    node_id: r.node_id || this.selectedNodeId,
                    water_level: Number(r.water_level),
                    distance_cm: Number(r.distance_cm),
                    flood_status: r.flood_status as FloodStatus,
                    sequence_number: Number(r.sequence_number),
                    rssi: r.rssi !== null ? Number(r.rssi) : null,
                    snr: r.snr !== null ? Number(r.snr) : null,
                    sensor_online: Boolean(r.sensor_online),
                    received_at: r.received_at,
                  },
                  `PAANDAM,${Number(r.water_level).toFixed(2)},${Number(r.distance_cm).toFixed(2)},${r.flood_status},${r.sequence_number}`,
                  'REAL HARDWARE DATA'
                );
              }
            });

            if (hasNew) {
              this.supabaseStatus.lastSyncTime = new Date().toISOString();
              this.supabaseStatus.readingsCount = this.readings.length;
              this.notify();
            }
          }
        }
      } catch (e: any) {
        console.warn('[Supabase Polling Network Exception]:', e);
        this.supabaseStatus.isConnected = false;
        this.supabaseStatus.errorMessage = e?.message || 'Network polling connection error';
        this.notify();
      }
    }, 4000);
  }

  // Simulation controls (Strictly for laboratory testing / offline demo)
  public startSimulation() {
    if (this.simIntervalId) clearInterval(this.simIntervalId);
    this.simulationActive = true;
    this.telemetrySource = 'DEMO DATA';

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
    // Purge all simulated/demo readings so only genuine Supabase readings remain
    this.readings = this.readings.filter((r) => r.source !== 'DEMO DATA');
    this.telemetrySource = 'REAL HARDWARE DATA';
    this.initSupabaseData();
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

    const wave = (Math.random() - 0.48) * 1.2;
    let nextWater = Math.max(12, Math.min(95, currentWater + wave));
    nextWater = Number(nextWater.toFixed(2));

    this.injectPacket(nextWater, true);
  }
}

export const telemetryStore = TelemetryStore.getInstance();
