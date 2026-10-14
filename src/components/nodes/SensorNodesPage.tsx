import React, { useState } from 'react';
import { FloodNode, FloodReading } from '../../types/telemetry';
import { StatusBadge } from '../common/StatusBadge';
import {
  Radio,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Signal,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  HelpCircle,
  Power
} from 'lucide-react';

interface Props {
  nodes: FloodNode[];
  readings: FloodReading[];
  selectedNodeId: string;
  isAdmin: boolean;
  onSelectNode: (id: string) => void;
  onAddNode: (node: Omit<FloodNode, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateNode: (id: string, updates: Partial<FloodNode>) => void;
  onDeleteNode: (id: string) => void;
  offlineTimeoutSeconds: number;
}

export const SensorNodesPage: React.FC<Props> = ({
  nodes,
  readings,
  selectedNodeId,
  isAdmin,
  onSelectNode,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  offlineTimeoutSeconds,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingNode, setEditingNode] = useState<FloodNode | null>(null);

  // Form states
  const [nodeCode, setNodeCode] = useState<string>('');
  const [nodeName, setNodeName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [locationDescription, setLocationDescription] = useState<string>('');

  const handleOpenAddModal = () => {
    setNodeCode(`PA-ANDAM-00${nodes.length + 1}`);
    setNodeName('');
    setDescription('');
    setLocationDescription('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (node: FloodNode) => {
    setEditingNode(node);
    setNodeName(node.node_name);
    setDescription(node.description || '');
    setLocationDescription(node.location_description || '');
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAddNode({
      node_code: nodeCode.trim().toUpperCase(),
      node_name: nodeName.trim(),
      description: description.trim() || null,
      location_description: locationDescription.trim() || null,
      enabled: true,
    });
    setIsAddModalOpen(false);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNode) {
      onUpdateNode(editingNode.id, {
        node_name: nodeName.trim(),
        description: description.trim() || null,
        location_description: locationDescription.trim() || null,
      });
      setEditingNode(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 uppercase font-mono tracking-wider">
            IoT Edge Sensor Node Registry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage deployed physical LoRa transmitter stations and telemetry nodes
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Node</span>
          </button>
        )}
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((node) => {
          const nodeReadings = readings.filter((r) => r.node_id === node.id);
          const latest = nodeReadings[nodeReadings.length - 1];
          const isSelected = selectedNodeId === node.id;

          // Check online / stale status
          const now = Date.now();
          const lastTime = latest ? new Date(latest.received_at).getTime() : 0;
          const isStale = latest ? (now - lastTime) / 1000 > offlineTimeoutSeconds : true;
          const isOnline = latest ? latest.sensor_online && !isStale : false;

          return (
            <div
              key={node.id}
              className={`border rounded-lg p-5 transition-all bg-[#0f172a] ${
                isSelected
                  ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                      {node.node_code}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        node.enabled
                          ? isOnline
                            ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60'
                            : isStale
                            ? 'text-amber-400 bg-amber-950/50 border-amber-800/60'
                            : 'text-rose-400 bg-rose-950/50 border-rose-800/60'
                          : 'text-slate-400 bg-slate-800 border-slate-700'
                      }`}
                    >
                      {!node.enabled
                        ? 'DISABLED'
                        : isOnline
                        ? 'ONLINE (LIVE)'
                        : isStale
                        ? 'STALE'
                        : 'OFFLINE'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 truncate">{node.node_name}</h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onSelectNode(node.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {isSelected ? 'Active Station' : 'Select'}
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(node)}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        title="Edit Node Information"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateNode(node.id, { enabled: !node.enabled })
                        }
                        className={`p-1 rounded ${
                          node.enabled
                            ? 'text-emerald-400 hover:bg-slate-800'
                            : 'text-slate-400 hover:bg-slate-800'
                        }`}
                        title={node.enabled ? 'Disable Node' : 'Enable Node'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Location display strictly as instructed: Do not invent GPS coordinates */}
              <div className="flex items-start gap-1.5 text-xs text-slate-400 mb-4 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="italic">
                  {node.location_description || 'location not configured'}
                </span>
              </div>

              {/* Node Telemetry Quick Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800 text-xs font-mono">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Water Level</span>
                  <span className="text-slate-100 font-bold tabular-nums">
                    {latest ? `${latest.water_level.toFixed(1)} cm` : '--'}
                  </span>
                </div>

                <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Distance</span>
                  <span className="text-slate-100 font-bold tabular-nums">
                    {latest ? `${latest.distance_cm.toFixed(1)} cm` : '--'}
                  </span>
                </div>

                <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">LoRa RSSI</span>
                  <span className="text-slate-100 font-bold tabular-nums">
                    {latest?.rssi !== null && latest?.rssi !== undefined ? `${latest.rssi} dBm` : '--'}
                  </span>
                </div>

                <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">LoRa SNR</span>
                  <span className="text-slate-100 font-bold tabular-nums">
                    {latest?.snr !== null && latest?.snr !== undefined ? `${latest.snr} dB` : '--'}
                  </span>
                </div>
              </div>

              {/* Last seen time footer */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
                <span>Last Telemetry Packet:</span>
                <span className="text-slate-300">
                  {latest ? new Date(latest.received_at).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Node Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Register New Sensor Node</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-mono">Unique Node Code (e.g. PA-ANDAM-002):</label>
                <input
                  type="text"
                  required
                  value={nodeCode}
                  onChange={(e) => setNodeCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Node Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Riverside Node, Building A, Barangay Monitoring Point"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Deployment Location Description:</label>
                <input
                  type="text"
                  placeholder="e.g. Ibajay Bridge Pier 3, ASU-Ibajay Campus"
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Hardware & Sensor Description:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. ESP32 + JSN-SR04T + RA-02 433MHz LoRa + 12V Solar System"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Node Modal */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                <span>Edit Node: {editingNode.node_code}</span>
              </h3>
              <button
                onClick={() => setEditingNode(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-mono">Node Name:</label>
                <input
                  type="text"
                  required
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Location Description:</label>
                <input
                  type="text"
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-mono">Description:</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingNode(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
