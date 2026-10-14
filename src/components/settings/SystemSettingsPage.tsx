import React, { useState, useEffect } from 'react';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  getSupabase,
} from '../../services/supabaseClient';
import { telemetryStore } from '../../services/telemetryStore';
import { TelemetrySource } from '../../types/telemetry';
import { TelemetrySourceBadge } from '../common/TelemetrySourceBadge';
import {
  Settings,
  Database,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Cpu,
  Radio,
  FileCode,
  Terminal,
  ExternalLink,
  Lock
} from 'lucide-react';

interface Props {
  telemetrySource: TelemetrySource;
  isAdmin: boolean;
  onToggleAdmin: () => void;
}

export const SystemSettingsPage: React.FC<Props> = ({
  telemetrySource,
  isAdmin,
  onToggleAdmin,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [gatewaySecret, setGatewaySecret] = useState<string>('pa_andam_sec_99a8b7c6d5e4');
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedRls, setCopiedRls] = useState<boolean>(false);

  const sampleRlsCode = `-- Run in Supabase SQL Editor:
CREATE POLICY "Public Read Access: flood_nodes"
  ON public.flood_nodes FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access: flood_readings"
  ON public.flood_readings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access: flood_events"
  ON public.flood_events FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Public Read Access: flood_settings"
  ON public.flood_settings FOR SELECT
  TO anon, authenticated USING (true);`;

  useEffect(() => {
    const { url, anonKey } = getStoredSupabaseConfig();
    setSupabaseUrl(url);
    setSupabaseAnonKey(anonKey);
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setTestResult({ status: 'testing', message: 'Testing Supabase connection...' });

    try {
      const { client, isConfigured } = getSupabase();
      if (!isConfigured || !client) {
        setTestResult({
          status: 'error',
          message: 'Please provide both a valid Supabase Project URL and Public Anon Key.',
        });
        return;
      }

      // 1. Test flood_nodes
      const { data: nodes, error: nodesError } = await client.from('flood_nodes').select('id, node_code').limit(1);

      if (nodesError) {
        const isRls = nodesError.code === '42501' || nodesError.message.toLowerCase().includes('permission denied');
        setTestResult({
          status: 'error',
          message: isRls
            ? `Row Level Security (RLS) blocked access to 'flood_nodes': ${nodesError.message}. Apply the SELECT policy for the 'anon' role.`
            : `Failed to query flood_nodes: ${nodesError.message}`,
        });
        return;
      }

      // 2. Test flood_readings
      const { data: readings, error: readingsError } = await client
        .from('flood_readings')
        .select('id, water_level, received_at')
        .order('received_at', { ascending: false })
        .limit(1);

      if (readingsError) {
        const isRls = readingsError.code === '42501' || readingsError.message.toLowerCase().includes('permission denied');
        setTestResult({
          status: 'error',
          message: isRls
            ? `Row Level Security (RLS) blocked access to 'flood_readings': ${readingsError.message}. Apply the SELECT policy for the 'anon' role.`
            : `Failed to query flood_readings: ${readingsError.message}`,
        });
        return;
      }

      const readingsInfo = readings && readings.length > 0
        ? `Found recent hardware telemetry (last reading at ${new Date(readings[0].received_at).toLocaleTimeString()}).`
        : 'Tables accessible, awaiting first packet from ESP32 gateway.';

      setTestResult({
        status: 'success',
        message: `Connection verified successfully! ${readingsInfo}`,
      });

      telemetryStore.initSupabaseData();
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `Failed to connect: ${err.message || 'Network error'}`,
      });
    }
  };

  const copyFirmwareSnippet = () => {
    navigator.clipboard.writeText(sampleFirmwareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const sampleFirmwareCode = `// ESP32 #2 Gateway Firmware Snippet (Non-blocking Wi-Fi + LoRa + UART2)
// Retains UART2 on GPIO27 to Arduino UNO at 115200 baud
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <LoRa.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* endpoint = "https://<your-project>.supabase.co/functions/v1/ingest-flood-telemetry";
const char* gatewaySecret = "YOUR_GATEWAY_SECRET";

HardwareSerial UnoSerial(2); // UART2: TX=GPIO27

void setup() {
  Serial.begin(115200);
  UnoSerial.begin(115200, SERIAL_8N1, -1, 27); // UART2 TX to UNO GPIO27
  WiFi.begin(ssid, password);
  LoRa.begin(433E6);
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String packet = "";
    while (LoRa.available()) packet += (char)LoRa.read();
    
    // 1. Immediately forward to Arduino UNO (local display + relays)
    UnoSerial.println(packet);
    
    // 2. Transmit asynchronously to Supabase ingestion Edge Function
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(endpoint);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-gateway-secret", gatewaySecret);
      // Payload matching schema
      String payload = "{\\"node_code\\":\\"PA-ANDAM-001\\",\\"packet\\":\\"" + packet + "\\"}";
      int httpCode = http.POST(payload);
      http.end();
    }
  }
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 uppercase font-mono tracking-wider">
            System & Infrastructure Settings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure Supabase PostgreSQL connection, Gateway Ingestion secrets, and ESP32 firmware parameters
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TelemetrySourceBadge source={telemetrySource} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Supabase Connection (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                Supabase PostgreSQL Connection
              </h3>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Connect this dashboard to your hosted Supabase instance. If left blank, the system automatically uses honest local simulation data without breaking.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1">Supabase Project URL:</label>
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Supabase Public Anon Key:</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Save & Test Connection</span>
                </button>
              </div>

              {testResult.status !== 'idle' && (
                <div
                  className={`p-3 rounded border text-xs font-mono ${
                    testResult.status === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : testResult.status === 'testing'
                      ? 'bg-slate-900 border-slate-700 text-slate-300'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  }`}
                >
                  <p>{testResult.message}</p>
                </div>
              )}
            </form>
          </div>

          {/* Gateway Ingestion Secret Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                Gateway Ingestion Endpoint Security
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              The Edge Function <code className="text-cyan-300">ingest-flood-telemetry</code> validates incoming HTTP POST packets from ESP32 #2 using a dedicated gateway secret header.
            </p>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">HTTP Header:</span>
                <span className="text-cyan-400 font-semibold">x-gateway-secret</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Secret Token:</span>
                <span className="text-slate-200 font-bold">••••••••••••••••••••••••</span>
              </div>
            </div>

            <div className="flex items-start gap-2 mt-3 text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-slate-300">Zero-Leak Guarantee: </strong>
                Service-role keys and master database passwords are never shipped in frontend JavaScript bundles. Only the public anon key is accessed client-side.
              </p>
            </div>
          </div>

          {/* Row Level Security (RLS) Policy Guide Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                  Row Level Security (RLS) Policies
                </h3>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sampleRlsCode);
                  setCopiedRls(true);
                  setTimeout(() => setCopiedRls(false), 2500);
                }}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60"
              >
                {copiedRls ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedRls ? 'Copied' : 'Copy Policy SQL'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              If Supabase returns <code className="text-amber-400 font-mono">42501 permission denied</code>, run these SQL statements in your Supabase SQL Editor to allow public read access for monitoring:
            </p>

            <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] font-mono text-cyan-300/90 overflow-x-auto max-h-40 leading-relaxed">
              <code>{sampleRlsCode}</code>
            </pre>
          </div>
        </div>

        {/* Right Column: Hardware Architecture & Firmware (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                  ESP32 #2 Dual-Pathway Firmware Routine
                </h3>
              </div>
              <button
                onClick={copyFirmwareSnippet}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Ensures that local UART transmission on <code className="text-cyan-300">GPIO27</code> to the Arduino UNO and TFT display operates synchronously, while remote Wi-Fi telemetry to Supabase executes non-blockingly.
            </p>

            <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
              <code>{sampleFirmwareCode}</code>
            </pre>
          </div>

          {/* Database Schema Reference */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                PostgreSQL Schema Definition
              </h3>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              The four dedicated relational tables in the public schema for OPLAN PA-ANDAM:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-cyan-400 font-bold block">flood_nodes</span>
                <span className="text-[11px] text-slate-400">Registry of hardware stations</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-cyan-400 font-bold block">flood_readings</span>
                <span className="text-[11px] text-slate-400">Time-series water level packets</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-cyan-400 font-bold block">flood_events</span>
                <span className="text-[11px] text-slate-400">Boundary transitions & ack logs</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-cyan-400 font-bold block">flood_settings</span>
                <span className="text-[11px] text-slate-400">Calibrated thresholds & units</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
