import { useCallback, useMemo } from "react";
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { RoleShell } from "@/modules/workbench/role-shell";
import {
  TOPOLOGY_NODES,
  TOPOLOGY_EDGES,
  TOPOLOGY_GROUP_LABELS,
  type TopologyNode,
} from "@/config/topology-config";

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  module:   { bg: "#eef5ff", border: "#2f6fe8", text: "#10233f" },
  infra:    { bg: "#eaf8ef", border: "#007166", text: "#10233f" },
  external: { bg: "#f1efff", border: "#5d48c8", text: "#10233f" },
  group:    { bg: "#f3f6fb", border: "#8b9aae", text: "#10233f" },
};

const STATUS_DOT: Record<string, string> = {
  active:  "#22c55e",
  partial: "#f59e0b",
  planned: "#94a3b8",
};

const GROUP_LAYOUTS: Record<string, { x: number; y: number }> = {
  infra:         { x: 600, y: 0 },
  courts:        { x: 0,   y: 0 },
  admin:         { x: 0,   y: 260 },
  employee:      { x: 0,   y: 520 },
  announcements: { x: 600, y: 260 },
};

function buildFlowNodes(nodes: TopologyNode[]): Node[] {
  const groupCounters: Record<string, number> = {};
  return nodes.map((n) => {
    const group = n.group ?? "ungrouped";
    const idx = groupCounters[group] ?? 0;
    groupCounters[group] = idx + 1;
    const base = GROUP_LAYOUTS[group] ?? { x: 900, y: 0 };
    const colors = NODE_COLORS[n.type] ?? NODE_COLORS.module;
    return {
      id: n.id,
      position: { x: base.x + (idx % 2) * 220, y: base.y + Math.floor(idx / 2) * 110 },
      data: {
        label: (
          <div className="min-w-[140px] px-1">
            <div className="flex items-center gap-1.5">
              {n.status ? <span style={{ background: STATUS_DOT[n.status] }} className="inline-block h-2 w-2 rounded-full shrink-0" /> : null}
              <span className="text-[12px] font-black leading-tight whitespace-pre-line">{n.label}</span>
            </div>
            {n.description ? <p className="mt-1 text-[10px] font-bold leading-tight text-[#637185]">{n.description}</p> : null}
          </div>
        ),
      },
      style: {
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: 10,
        padding: "8px 10px",
        fontSize: 12,
        cursor: n.route ? "pointer" : "default",
      },
    };
  });
}

function buildFlowEdges(edges: typeof TOPOLOGY_EDGES): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: false,
    style: e.dashed
      ? { strokeDasharray: "5,4", stroke: "#94a3b8", strokeWidth: 1.5 }
      : { stroke: "#8b9aae", strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fontWeight: 700, fill: "#637185" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9aae", width: 16, height: 16 },
  }));
}

export default function SystemTopologyPage() {
  const initialNodes = useMemo(() => buildFlowNodes(TOPOLOGY_NODES), []);
  const initialEdges = useMemo(() => buildFlowEdges(TOPOLOGY_EDGES), []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    const cfg = TOPOLOGY_NODES.find((n) => n.id === node.id);
    if (cfg?.route) window.open(cfg.route, "_self");
  }, []);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const n of TOPOLOGY_NODES) {
      const g = n.group ?? "ungrouped";
      if (!seen.has(g)) { seen.add(g); result.push(g); }
    }
    return result;
  }, []);

  return (
    <RoleShell role="system" title="模組拓撲圖" subtitle="系統各模組與基礎設施的連線關係">
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(NODE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span style={{ background: c.bg, border: `1.5px solid ${c.border}` }} className="inline-block h-4 w-4 rounded-[4px]" />
            <span className="text-[12px] font-bold text-[#536175]">{type}</span>
          </div>
        ))}
        <div className="ml-4 flex items-center gap-3">
          {Object.entries(STATUS_DOT).map(([s, color]) => (
            <div key={s} className="flex items-center gap-1">
              <span style={{ background: color }} className="inline-block h-2.5 w-2.5 rounded-full" />
              <span className="text-[11px] font-bold text-[#8b9aae]">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <span key={g} className="rounded-full border border-[#dfe7ef] bg-[#f3f6fb] px-3 py-1 text-[11px] font-black text-[#536175]">
            {TOPOLOGY_GROUP_LABELS[g] ?? g}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#dfe7ef]" style={{ height: "calc(100vh - 260px)", minHeight: 520 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          minZoom={0.3}
        >
          <Background gap={18} size={1} color="#e2e9f2" />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={(n) => {
            const cfg = TOPOLOGY_NODES.find((t) => t.id === n.id);
            return NODE_COLORS[cfg?.type ?? "module"]?.border ?? "#8b9aae";
          }} pannable zoomable />
        </ReactFlow>
      </div>
    </RoleShell>
  );
}
