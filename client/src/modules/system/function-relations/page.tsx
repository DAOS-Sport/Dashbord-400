import { ArrowRight, Database, GitBranch, Layers3, Link2, Network, ShieldCheck, Table2, Workflow } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import {
  architectureCoverage,
  architectureModuleGroups,
  featureFlows,
  relationMetrics,
  roleToneClass,
  routeRelations,
  moduleStatusLabels,
  statusLabels,
  type ModuleArchitectureItem,
  tableRelationGroups,
  type FeatureFlow,
  type TableRelationChild,
  type TableRelationGroup,
} from "./relations-data";

const statusClass: Record<TableRelationChild["status"], string> = {
  active: "border-[#bdebd0] bg-[#eaf8ef] text-[#007166]",
  partial: "border-[#ffe0ad] bg-[#fff6e7] text-[#c06413]",
  planned: "border-[#dfe7ef] bg-[#f7f9fb] text-[#637185]",
};

const moduleStatusClass: Record<ModuleArchitectureItem["status"], string> = {
  implemented: "border-[#bdebd0] bg-[#eaf8ef] text-[#007166]",
  partial: "border-[#ffe0ad] bg-[#fff6e7] text-[#c06413]",
  planned: "border-[#dfe7ef] bg-[#f7f9fb] text-[#637185]",
  legacy: "border-[#dfe7ef] bg-[#f7f9fb] text-[#637185]",
  external: "border-[#d7e5ff] bg-[#eef5ff] text-[#2f6fe8]",
  mock: "border-[#e4dcff] bg-[#f1efff] text-[#5d48c8]",
  deprecated: "border-[#ffd8de] bg-[#fff0f2] text-[#d94155]",
};

const entryModeLabels: Record<ModuleArchitectureItem["entryMode"], string> = {
  workbench: "正式入口",
  "legacy-route": "相容路由",
  "api-only": "API only",
  background: "背景能力",
};

function MetricGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {relationMetrics.map((metric) => (
        <WorkbenchCard key={metric.label} className="p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">{metric.label}</p>
          <p className="mt-2 text-[28px] font-black tabular-nums text-[#10233f]">{metric.value}</p>
          <p className="mt-1 text-[12px] font-bold text-[#637185]">{metric.helper}</p>
        </WorkbenchCard>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: TableRelationChild["status"] }) {
  return (
    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-black", statusClass[status])}>
      {statusLabels[status]}
    </span>
  );
}

function ModuleStatusBadge({ status }: { status: ModuleArchitectureItem["status"] }) {
  return (
    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-black", moduleStatusClass[status])}>
      {moduleStatusLabels[status]}
    </span>
  );
}

function ArchitectureRegistryMatrix() {
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-[#edf1f6] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[16px] font-black text-[#10233f]"><Layers3 className="h-5 w-5 text-[#007166]" />模組母系統歸屬</h2>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">
              由 `MODULE_REGISTRY` 直接分類，顯示所有正式模組、背景能力、整合與 legacy 相容層，避免只看 sidebar 造成孤兒模組。
            </p>
          </div>
          <div className="rounded-[8px] border border-[#d8e2ee] bg-[#fbfcfd] px-3 py-2 text-right">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Coverage</p>
            <p className="font-mono text-[13px] font-black text-[#10233f]">{architectureCoverage.groupedModules}/{architectureCoverage.totalModules}</p>
          </div>
        </div>
        {architectureCoverage.ungroupedModuleIds.length || architectureCoverage.suspiciousUnboundModuleIds.length ? (
          <div className="mt-3 rounded-[8px] border border-[#ffd5a0] bg-[#fff6e7] px-3 py-2 text-[12px] font-bold text-[#9a4f0f]">
            仍需處理：{[...architectureCoverage.ungroupedModuleIds, ...architectureCoverage.suspiciousUnboundModuleIds].join(", ")}
          </div>
        ) : (
          <div className="mt-3 rounded-[8px] border border-[#bdebd0] bg-[#eaf8ef] px-3 py-2 text-[12px] font-black text-[#007166]">
            目前沒有孤兒模組，也沒有可疑的無 BFF 使用者入口。
          </div>
        )}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-2">
        {architectureModuleGroups.map((group) => (
          <div key={group.id} className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd]">
            <div className="border-b border-[#edf1f6] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-black text-[#10233f]">{group.title}</h3>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{group.description}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] font-black text-[#536175]">{group.modules.length}</span>
              </div>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
              {group.modules.map((module) => (
                <div key={module.id} className="rounded-[8px] border border-[#edf1f6] bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] font-black text-[#10233f]">{module.id}</p>
                      <p className="truncate text-[12px] font-bold text-[#536175]">{module.label}</p>
                    </div>
                    <ModuleStatusBadge status={module.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-5 text-[#637185]">{module.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-black text-[#2f6fe8]">{entryModeLabels[module.entryMode]}</span>
                    <span className="rounded-full bg-[#f7f9fb] px-2 py-1 text-[10px] font-black text-[#536175]">{module.hasBff ? "BFF" : "無 BFF"}</span>
                    <span className="rounded-full bg-[#f7f9fb] px-2 py-1 text-[10px] font-black text-[#536175]">routes {module.routeCount}</span>
                    <span className="rounded-full bg-[#f7f9fb] px-2 py-1 text-[10px] font-black text-[#536175]">api {module.apiCount}</span>
                    {module.ownerRole ? <span className="rounded-full bg-[#f1efff] px-2 py-1 text-[10px] font-black text-[#5d48c8]">{module.ownerRole}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WorkbenchCard>
  );
}

function TableRelationCard({ group }: { group: TableRelationGroup }) {
  const Icon = group.Icon;
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-[#edf1f6] bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-black text-[#10233f]">{group.title}</p>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{group.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 xl:grid-cols-[230px_1fr]">
        <div className="rounded-[8px] border border-[#d8e2ee] bg-[#f7f9fb] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">Parent</p>
          <p className="mt-2 break-words font-mono text-[13px] font-black text-[#10233f]">{group.parent}</p>
        </div>
        <div className="space-y-2">
          {group.children.map((child) => (
            <div key={`${group.id}-${child.table}`} className="grid gap-2 rounded-[8px] border border-[#edf1f6] bg-white p-3 lg:grid-cols-[220px_1fr_130px] lg:items-center">
              <div className="min-w-0">
                <p className="truncate font-mono text-[12px] font-black text-[#10233f]">{child.table}</p>
                <p className="truncate text-[11px] font-bold text-[#8b9aae]">{child.relation}</p>
              </div>
              <p className="text-[12px] font-bold leading-5 text-[#536175]">{child.feature}</p>
              <StatusBadge status={child.status} />
            </div>
          ))}
        </div>
      </div>
    </WorkbenchCard>
  );
}

function FeatureFlowCard({ flow }: { flow: FeatureFlow }) {
  return (
    <WorkbenchCard className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#2f6fe8]">{flow.owner}</span>
            <span className="font-mono text-[11px] font-bold text-[#8b9aae]">{flow.route}</span>
          </div>
          <h3 className="mt-2 text-[15px] font-black text-[#10233f]">{flow.title}</h3>
          <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{flow.summary}</p>
        </div>
        <Workflow className="h-5 w-5 shrink-0 text-[#007166]" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {flow.steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 py-2 text-[11px] font-black text-[#10233f]">{step}</span>
            {index < flow.steps.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-[#8b9aae]" /> : null}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]"><Database className="h-3.5 w-3.5" />Tables</p>
          <div className="flex flex-wrap gap-2">
            {flow.tables.map((table) => (
              <span key={table} className="rounded-full bg-[#f7f9fb] px-2.5 py-1 font-mono text-[10px] font-bold text-[#536175]">{table}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]"><ShieldCheck className="h-3.5 w-3.5" />Audit</p>
          <div className="flex flex-wrap gap-2">
            {flow.audit.map((item) => (
              <span key={item} className="rounded-full bg-[#f1efff] px-2.5 py-1 font-mono text-[10px] font-bold text-[#5d48c8]">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </WorkbenchCard>
  );
}

function RouteMatrix() {
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-[#edf1f6] p-4">
        <h2 className="flex items-center gap-2 text-[16px] font-black text-[#10233f]"><Link2 className="h-5 w-5 text-[#007166]" />工作區入口與模組對照</h2>
        <p className="mt-1 text-[12px] font-bold text-[#637185]">這裡對照目前正式工作台入口，不列 legacy redirect。</p>
      </div>
      <div className="divide-y divide-[#edf1f6]">
        {routeRelations.map((item) => (
          <div key={item.role} className="grid gap-3 p-4 xl:grid-cols-[180px_220px_1fr] xl:items-start">
            <div>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", roleToneClass[item.role])}>{item.title}</span>
              <p className="mt-2 font-mono text-[12px] font-black text-[#10233f]">{item.route}</p>
            </div>
            <p className="text-[12px] font-bold leading-5 text-[#637185]">{item.source}</p>
            <div className="flex flex-wrap gap-2">
              {item.modules.map((module) => (
                <span key={module} className="rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[11px] font-black text-[#10233f]">{module}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WorkbenchCard>
  );
}

export default function SystemFunctionRelationsPage() {
  return (
    <RoleShell role="system" title="當前功能關係" subtitle="IT 端總覽目前資料庫母子表、功能邏輯流、角色入口與稽核觀察面。">
      <div className="space-y-5" data-testid="system-function-relations-page">
        <MetricGrid />

        <WorkbenchCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#007166]">Current Architecture Map</p>
              <h1 className="mt-2 text-[22px] font-black text-[#10233f]">資料母表、子表與功能邏輯關係</h1>
              <p className="mt-2 text-[13px] font-bold leading-6 text-[#637185]">
                這頁是 IT 端的活文件入口：用目前 repo 的 schema、module registry 與 workbench route 整理而成。它不讀寫業務資料，只協助驗收與討論每個功能背後的資料流。
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-[12px] bg-[#0d2a50] text-white">
              <Network className="h-7 w-7" />
            </div>
          </div>
        </WorkbenchCard>

        <ArchitectureRegistryMatrix />

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-[#007166]" />
            <h2 className="text-[17px] font-black text-[#10233f]">資料庫母表 / 子表關係</h2>
          </div>
          <div className="grid gap-4">
            {tableRelationGroups.map((group) => <TableRelationCard key={group.id} group={group} />)}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[#007166]" />
            <h2 className="text-[17px] font-black text-[#10233f]">功能邏輯流</h2>
          </div>
          <div className="grid gap-4">
            {featureFlows.map((flow) => <FeatureFlowCard key={flow.id} flow={flow} />)}
          </div>
        </section>

        <RouteMatrix />
      </div>
    </RoleShell>
  );
}
