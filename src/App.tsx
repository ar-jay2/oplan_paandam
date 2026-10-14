/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavigationPage } from './types/telemetry';
import { telemetryStore } from './services/telemetryStore';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { OverviewPage } from './components/overview/OverviewPage';
import { LiveMonitoringPage } from './components/live/LiveMonitoringPage';
import { HistoricalAnalyticsPage } from './components/analytics/HistoricalAnalyticsPage';
import { FloodEventsPage } from './components/events/FloodEventsPage';
import { SensorNodesPage } from './components/nodes/SensorNodesPage';
import { AlertsThresholdsPage } from './components/alerts/AlertsThresholdsPage';
import { ReportsPage } from './components/reports/ReportsPage';
import { SystemSettingsPage } from './components/settings/SystemSettingsPage';
import { SimulationController } from './components/common/SimulationController';

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSimOpen, setIsSimOpen] = useState<boolean>(true); // Open by default in research dev mode for easy testing
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  // Subscribe to central reactive telemetry store
  useEffect(() => {
    const unsubscribe = telemetryStore.subscribe(() => {
      setTelemetryTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  const nodes = telemetryStore.getNodes();
  const selectedNode = telemetryStore.getSelectedNode();
  const latestReading = telemetryStore.getLatestReading(selectedNode?.id);
  const historicalReadings = telemetryStore.getReadings(selectedNode?.id);
  const events = telemetryStore.getEvents();
  const settings = telemetryStore.getSettings();
  const latestPacket = telemetryStore.getLatestPacket();
  const telemetrySource = telemetryStore.getTelemetrySource();
  const connectionState = telemetryStore.getConnectionState();
  const isStale = telemetryStore.isReadingStale(latestReading);
  const isAdmin = telemetryStore.getIsAdmin();

  // Relays calculation based on research criteria
  const relays = telemetryStore.computeRelayStates(
    latestReading ? latestReading.water_level : null,
    latestReading ? latestReading.sensor_online && !isStale : false
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        selectedNodeCode={selectedNode?.node_code || 'PA-ANDAM-001'}
        selectedNodeName={selectedNode?.node_name || 'Station 1'}
        isStale={isStale}
        lastReadingTime={latestReading ? latestReading.received_at : null}
      />

      {/* Main Workspace Frame (offset by sidebar width on lg screens) */}
      <div className="lg:pl-64 flex-1 flex flex-col min-h-screen">
        {/* Top Navigation Bar */}
        <Navbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          telemetrySource={telemetrySource}
          connectionState={connectionState}
          isSimOpen={isSimOpen}
          onToggleSim={() => setIsSimOpen(!isSimOpen)}
          isAdmin={isAdmin}
          onToggleAdmin={() => telemetryStore.setIsAdmin(!isAdmin)}
          isStale={isStale}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'overview' && (
            <OverviewPage
              latestReading={latestReading}
              historicalReadings={historicalReadings}
              node={selectedNode}
              settings={settings}
              relays={relays}
              telemetrySource={telemetrySource}
              connectionState={connectionState}
              isStale={isStale}
              onNavigateToLive={() => setCurrentPage('live')}
              onNavigateToAnalytics={() => setCurrentPage('analytics')}
            />
          )}

          {currentPage === 'live' && (
            <LiveMonitoringPage
              latestReading={latestReading}
              historicalReadings={historicalReadings}
              node={selectedNode}
              settings={settings}
              relays={relays}
              telemetrySource={telemetrySource}
              connectionState={connectionState}
              isStale={isStale}
              latestPacket={latestPacket}
            />
          )}

          {currentPage === 'analytics' && (
            <HistoricalAnalyticsPage
              readings={historicalReadings}
              settings={settings}
              nodeName={selectedNode?.node_name || 'ASU-Ibajay Station'}
              nodeCode={selectedNode?.node_code || 'PA-ANDAM-001'}
            />
          )}

          {currentPage === 'events' && (
            <FloodEventsPage
              events={events}
              isAdmin={isAdmin}
              onAcknowledge={(id, admin, notes) =>
                telemetryStore.acknowledgeEvent(id, admin, notes)
              }
            />
          )}

          {currentPage === 'nodes' && (
            <SensorNodesPage
              nodes={nodes}
              readings={historicalReadings}
              selectedNodeId={selectedNode?.id || ''}
              isAdmin={isAdmin}
              onSelectNode={(id) => telemetryStore.setSelectedNodeId(id)}
              onAddNode={(node) => telemetryStore.addNode(node)}
              onUpdateNode={(id, updates) => telemetryStore.updateNode(id, updates)}
              onDeleteNode={(id) => telemetryStore.deleteNode(id)}
              offlineTimeoutSeconds={settings.offline_timeout_seconds}
            />
          )}

          {currentPage === 'alerts' && (
            <AlertsThresholdsPage
              settings={settings}
              relays={relays}
              isAdmin={isAdmin}
              onUpdateSettings={(newSettings) =>
                telemetryStore.updateSettings(newSettings)
              }
            />
          )}

          {currentPage === 'reports' && (
            <ReportsPage
              node={selectedNode}
              readings={historicalReadings}
              events={events}
              settings={settings}
              telemetrySource={telemetrySource}
            />
          )}

          {currentPage === 'settings' && (
            <SystemSettingsPage
              telemetrySource={telemetrySource}
              isAdmin={isAdmin}
              onToggleAdmin={() => telemetryStore.setIsAdmin(!isAdmin)}
            />
          )}
        </main>

        {/* Collapsible Development & Hardware Emulation Test Bench */}
        <SimulationController
          isOpen={isSimOpen}
          onToggle={() => setIsSimOpen(false)}
        />
      </div>
    </div>
  );
}
