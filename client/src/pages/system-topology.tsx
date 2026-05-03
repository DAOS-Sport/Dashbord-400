import { useCallback, useMemo } from "react";
import { useLocation, Redirect } from "wouter";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { Network } from "lucide-react";
import { useAuthMe } from "@/shared/auth/session";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { topologyNodes, topologyEdges, topologyGroups, type TopologyGroup } from "@/config/topology-config";

interface NodeData {
  label: string;
  englishKey: string;
  description: string;
  group: TopologyGroup;
  path?: string;
}

const GROUP_ORDER: TopologyGroup[] = ["external", "portal", "admin", "infra"];

// Simple deterministic layered layout: group → column, items in group → rows.
function computeLayout(): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const groupX: Record<TopologyGroup, number> = { external: 0, portal: 320, admin: 700, infra: 1180 };
  const counters: Record<TopologyGroup, number> = { external: 0, portal: 0, admin: 0, infra: 0 };
  for (const n of topologyNodes) {
    const i = counters[n.group]++;
    positions[n.id] = { x: groupX[n.group], y: 60 + i * 110 };
  }
  return positions;
}

function buildNodes(): Node<NodeData>[] {
  const layout = computeLayout();
  return topologyNodes.map((n) => {
    const g = topologyGroups[n.group];
    return {
      id: n.id,
      position: layout[n.id],
      data: {
        label: n.label,
        englishKey: n.englishKey,
        description: n.description,
        group: n.group,
        path: n.path,
      },
      type: "default",
      style: {
        background: g.bg,
        border: `2px solid ${g.border}`,
        borderRadius: 10,
        padding: 8,
        width: 220,
        color: g.color,
        fontWeight: 600,
        fontSize: 12,
        boxShadow: "0 1px 3px rgba(13,42,80,0.08)",
      },
    } satisfies Node<NodeData>;
  });
}

function buildEdges(): Edge[] {
  return topologyEdges.map((e, idx) => ({
    id: `e${idx}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    animated: false,
    labelStyle: { fontSize: 10, fontWeight: 600, fill: "#475569" },
    labelBgStyle: { fill: "#f8fafc" },
    labelBgPadding: [2, 4],
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
  }));
}

export default function SystemTopologyPage() {
  const { data: session, isLoading, isError } = useAuthMe();
  const [, navigate] = useLocation();

  const initialNodes = useMemo(() => buildNodes(), []);
  const initialEdges = useMemo(() => buildEdges(), []);
  const [nodes, , onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node<NodeData>) => {
    if (node.data?.path) navigate(node.data.path);
  }, [navigate]);

  if (isLoading) {
    return <div className="grid h-full place-items-center"><DreamLoader label="權限驗證中" /></div>;
  }
  if (isError || !session) return <Redirect to="/login" />;
  const allowed = session.grantedRoles?.includes("supervisor") || session.grantedRoles?.includes("system");
  if (!allowed) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center space-y-3" data-testid="text-no-permission">
          <p className="text-lg font-bold">無瀏覽權限</p>
          <p className="text-sm text-muted-foreground">此頁面僅開放給主管或系統管理員使用。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-6 py-4">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">SYSTEM · MODULE TOPOLOGY</p>
        <h1 className="text-xl font-bold mt-0.5 flex items-center gap-2" data-testid="text-page-title">
          <Network className="h-5 w-5 text-primary" />
          模組拓撲圖
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          目前所有模組的依賴關係。點擊節點可跳轉到對應頁面，可拖曳、滾輪縮放。
        </p>
      </div>

      <div className="flex-1 min-h-0" data-testid="topology-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable={false}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            zoomable
            pannable
            nodeColor={(n) => topologyGroups[(n.data as NodeData)?.group ?? "infra"].border}
            maskColor="rgba(15, 23, 42, 0.06)"
          />
          <Panel position="top-right" className="rounded-lg border border-border bg-card/95 backdrop-blur p-3 shadow-md">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">圖例 LEGEND</p>
            <div className="space-y-1.5">
              {GROUP_ORDER.map((g) => (
                <div key={g} className="flex items-center gap-2 text-xs" data-testid={`legend-${g}`}>
                  <span className="inline-block w-4 h-4 rounded border-2" style={{ background: topologyGroups[g].bg, borderColor: topologyGroups[g].border }} />
                  <span className="font-bold" style={{ color: topologyGroups[g].color }}>{topologyGroups[g].label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
