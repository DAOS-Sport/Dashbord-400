import { useCallback, useMemo } from "react";
import { useLocation, Redirect } from "wouter";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Network, RotateCcw, Bot, Database, Mail, Server, Calendar, LayoutDashboard,
  Building2, BarChart3, ShieldCheck, Activity, Bell, Megaphone, LifeBuoy,
  ClipboardCheck, Waves, Workflow, Users, MessageSquare,
} from "lucide-react";
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

// Map englishKey to icon — keeps the visual cue per node card.
const NODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "dashboard": LayoutDashboard,
  "operations": Building2,
  "analytics": BarChart3,
  "hr-audit": ShieldCheck,
  "system-health": Activity,
  "anomaly-reports": Bell,
  "announcements": Megaphone,
  "work-logs": LifeBuoy,
  "counter-log": ClipboardCheck,
  "lane-rentals": Waves,
  "topology": Workflow,
  "portal": Users,
  "portal-handover": MessageSquare,
  "portal-shift": Calendar,
  "linebot": Bot,
  "postgres": Database,
  "ragic": Database,
  "linebot-api": Bot,
  "schedule-api": Server,
  "gmail": Mail,
};

function computeLayout(): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const groupX: Record<TopologyGroup, number> = { external: 0, portal: 360, admin: 800, infra: 1320 };
  const counters: Record<TopologyGroup, number> = { external: 0, portal: 0, admin: 0, infra: 0 };
  for (const n of topologyNodes) {
    const i = counters[n.group]++;
    positions[n.id] = { x: groupX[n.group], y: 60 + i * 130 };
  }
  return positions;
}

const INITIAL_LAYOUT = computeLayout();

// Custom node component renders the full card per spec:
//   icon + 中文名 (label), englishKey (mono), 一句描述 (description)
function ModuleNode({ data }: NodeProps<NodeData>) {
  const g = topologyGroups[data.group];
  const Icon = NODE_ICONS[data.englishKey] ?? Network;
  return (
    <div
      className="rounded-[10px] border-2 px-3 py-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      style={{ background: g.bg, borderColor: g.border, color: g.color, width: 250 }}
      data-testid={`topology-node-${data.englishKey}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-[13px] font-bold truncate flex-1">{data.label}</span>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wide opacity-70 mb-1">{data.englishKey}</p>
      <p className="text-[11px] leading-tight opacity-90">{data.description}</p>
    </div>
  );
}

const NODE_TYPES = { module: ModuleNode };

function buildNodes(): Node<NodeData>[] {
  return topologyNodes.map((n) => ({
    id: n.id,
    position: INITIAL_LAYOUT[n.id],
    data: {
      label: n.label,
      englishKey: n.englishKey,
      description: n.description,
      group: n.group,
      path: n.path,
    },
    type: "module",
  }));
}

function buildEdges(): Edge[] {
  return topologyEdges.map((e, idx) => ({
    id: `e${idx}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    labelStyle: { fontSize: 10, fontWeight: 600, fill: "#475569" },
    labelBgStyle: { fill: "#f8fafc" },
    labelBgPadding: [2, 4] as [number, number],
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
  }));
}

function TopologyCanvas() {
  const [, navigate] = useLocation();
  const initialNodes = useMemo(() => buildNodes(), []);
  const initialEdges = useMemo(() => buildEdges(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node<NodeData>) => {
    if (node.data?.path) navigate(node.data.path);
  }, [navigate]);

  // Restore initial layout (positions + fit-view zoom). Useful after the user
  // drags/zooms around and wants to return to the canonical layout.
  const handleReset = useCallback(() => {
    setNodes(buildNodes());
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [setNodes, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
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
      <Panel position="top-left">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-border bg-card/95 backdrop-blur px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-accent transition"
          data-testid="button-reset-topology"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重設版型
        </button>
      </Panel>
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
  );
}

export default function SystemTopologyPage() {
  const { data: session, isLoading, isError } = useAuthMe();

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
          目前所有模組的依賴關係。點擊節點可跳轉，可拖曳/滾輪縮放，左上角「重設版型」回到初始位置。
        </p>
      </div>

      <div className="flex-1 min-h-0" data-testid="topology-canvas">
        <ReactFlowProvider>
          <TopologyCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
