import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Database, GitBranch, Layers3, Network, Search, ShieldCheck, X } from "lucide-react";
import type { ModuleDefinition } from "@shared/modules";
import { getModuleArchitectureCoverage, getModuleArchitectureGroups, moduleStatusLabels } from "@shared/modules";
import { NotConnectedCard } from "@/components/shared/not-connected-card";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";

type TabKey = "registry" | "relations" | "topology" | "audit" | "raw";

interface AuditLogItem {
  id?: number;
  timestamp: string;
  actorId?: string;
  role?: string;
  facilityKey?: string;
  action: string;
  resource: string;
  resourceId?: string;
  resultStatus?: string;
}

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "registry", label: "Module Registry" },
  { id: "relations", label: "Function Relations" },
  { id: "topology", label: "Topology" },
  { id: "audit", label: "Audit Raw" },
  { id: "raw", label: "Raw Inspector" },
];

const statusClass: Record<string, string> = {
  implemented: "bg-[#eaf8ef] text-[#007166]",
  partial: "bg-[#fff6e7] text-[#9b6a00]",
  planned: "bg-[#f3f6fb] text-[#6b7280]",
  legacy: "bg-[#eef5ff] text-[#2f6fe8]",
  external: "bg-[#f1efff] text-[#5d48c8]",
  mock: "bg-[#f1efff] text-[#5d48c8]",
  deprecated: "bg-[#ffe8eb] text-[#dc2626]",
};

const fetchRegistry = () => apiGet<{ items: ModuleDefinition[] }>("/api/system/module-registry");
const fetchAuditLogs = () => apiGet<{ items: AuditLogItem[] }>("/api/audit/logs?limit=40");

export default function SystemGovernancePage() {
  const [tab, setTab] = useState<TabKey>("registry");
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleDefinition | null>(null);
  const registryQuery = useQuery({ queryKey: ["/api/system/module-registry", "governance"], queryFn: fetchRegistry, retry: 1 });
  const auditQuery = useQuery({ queryKey: ["/api/audit/logs", "governance"], queryFn: fetchAuditLogs, retry: 1 });
  const architectureGroups = useMemo(() => getModuleArchitectureGroups(), []);
  const coverage = useMemo(() => getModuleArchitectureCoverage(), []);
  const registryById = useMemo(() => {
    const map = new Map<string, ModuleDefinition>();
    for (const item of registryQuery.data?.items ?? []) map.set(item.id, item);
    return map;
  }, [registryQuery.data?.items]);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredGroups = architectureGroups.map((group) => ({
    ...group,
    modules: group.modules.filter((module) => {
      if (!normalizedSearch) return true;
      return `${module.id} ${module.label}`.toLowerCase().includes(normalizedSearch);
    }),
  }));

  return (
    <RoleShell role="system" title="治理面" subtitle="Registry / Topology / Audit / Raw Inspector">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-governance-page">
        <Link href="/system" className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
          <ChevronLeft className="h-4 w-4" />
          回控制中心
        </Link>

        <WorkbenchCard className="p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "min-h-10 rounded-[8px] px-4 text-[13px] font-black transition",
                  tab === item.id ? "bg-[#0d2a50] text-white" : "bg-white text-[#637185] hover:bg-[#f3f6fb]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </WorkbenchCard>

        {tab === "registry" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Total Modules", coverage.totalModules],
                ["Grouped", coverage.groupedModules],
                ["Suspicious Orphans", coverage.suspiciousUnboundModuleIds.length],
              ].map(([label, value]) => (
                <WorkbenchCard key={label} className="p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8b9aae]">{label}</p>
                  <p className="mt-2 text-[28px] font-black tabular-nums text-[#10233f]">{value}</p>
                </WorkbenchCard>
              ))}
            </div>

            <WorkbenchCard className="p-4">
              <label className="flex min-h-11 items-center gap-3 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
                <Search className="h-4 w-4 text-[#8b9aae]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜尋 moduleId 或 label"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none"
                />
              </label>
            </WorkbenchCard>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredGroups.map((group) => (
                <WorkbenchCard key={group.id} className="overflow-hidden">
                  <div className="border-b border-[#edf1f6] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-[16px] font-black text-[#10233f]">{group.title}</h2>
                        <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{group.description}</p>
                      </div>
                      <span className="rounded-full bg-[#f3f6fb] px-2.5 py-1 text-[11px] font-black text-[#536175]">{group.modules.length}</span>
                    </div>
                  </div>
                  <div className="max-h-[460px] overflow-y-auto p-3">
                    {group.modules.map((module) => {
                      const live = registryById.get(module.id);
                      return (
                        <button key={module.id} type="button" onClick={() => live && setSelectedModule(live)} className="mb-2 w-full rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 text-left hover:bg-white">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-[12px] font-black text-[#10233f]">{module.id}</p>
                              <p className="truncate text-[12px] font-bold text-[#536175]">{module.label}</p>
                            </div>
                            <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusClass[module.status])}>{moduleStatusLabels[module.status]}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                            {module.roles.map((role) => <span key={role} className="rounded-full bg-white px-2 py-1 text-[#2f6fe8]">{role}</span>)}
                            <span className="rounded-full bg-white px-2 py-1 text-[#536175]">routes {module.routeCount}</span>
                            <span className="rounded-full bg-white px-2 py-1 text-[#536175]">api {module.apiCount}</span>
                          </div>
                        </button>
                      );
                    })}
                    {!group.modules.length ? <div className="p-4 text-center text-[12px] font-bold text-[#8b9aae]">沒有符合搜尋條件的模組。</div> : null}
                  </div>
                </WorkbenchCard>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "relations" ? (
          <div className="grid gap-4">
            <WorkbenchCard className="p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]"><GitBranch className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-[16px] font-black text-[#10233f]">母系統 → 模組 → route/API/table 關係</h2>
                  <p className="mt-1 text-[13px] font-bold leading-6 text-[#637185]">本 tab 由 module registry 即時分類，完整靜態關係頁已收斂到此治理面。</p>
                </div>
              </div>
            </WorkbenchCard>
            <div className="grid gap-4 xl:grid-cols-2">
              {architectureGroups.map((group) => (
                <WorkbenchCard key={group.id} className="p-4">
                  <h3 className="text-[15px] font-black text-[#10233f]">{group.title}</h3>
                  <div className="mt-3 grid gap-2">
                    {group.modules.slice(0, 12).map((module) => (
                      <div key={module.id} className="grid gap-2 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 md:grid-cols-[1fr_70px_70px_70px]">
                        <span className="font-mono text-[12px] font-black text-[#10233f]">{module.id}</span>
                        <span className="text-[11px] font-bold text-[#637185]">routes {module.routeCount}</span>
                        <span className="text-[11px] font-bold text-[#637185]">api {module.apiCount}</span>
                        <span className="text-[11px] font-bold text-[#637185]">tables {module.tableCount}</span>
                      </div>
                    ))}
                  </div>
                </WorkbenchCard>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "topology" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {architectureGroups.map((group) => (
              <WorkbenchCard key={group.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eaf8ef] text-[#007166]"><Network className="h-5 w-5" /></div>
                  <div>
                    <h2 className="text-[16px] font-black text-[#10233f]">{group.title}</h2>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{group.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.modules.map((module) => (
                    <span key={module.id} className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 py-2 font-mono text-[11px] font-black text-[#10233f]">{module.id}</span>
                  ))}
                </div>
              </WorkbenchCard>
            ))}
          </div>
        ) : null}

        {tab === "audit" ? (
          <WorkbenchCard className="overflow-hidden">
            <div className="border-b border-[#edf1f6] p-4">
              <h2 className="text-[16px] font-black text-[#10233f]">Audit Raw</h2>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">讀取 `/api/audit/logs` 最近 40 筆紀錄。</p>
            </div>
            <div className="divide-y divide-[#edf1f6]">
              {(auditQuery.data?.items ?? []).map((item) => (
                <div key={`${item.id ?? item.timestamp}-${item.action}`} className="grid gap-2 p-4 md:grid-cols-[170px_1fr_160px_120px] md:items-center">
                  <span className="text-[12px] font-bold text-[#637185]">{new Date(item.timestamp).toLocaleString("zh-TW")}</span>
                  <span className="truncate text-[13px] font-black text-[#10233f]">{item.action}</span>
                  <span className="truncate text-[12px] font-bold text-[#637185]">{item.resource}{item.resourceId ? ` / ${item.resourceId}` : ""}</span>
                  <span className="rounded-full bg-[#f3f6fb] px-2 py-1 text-center text-[10px] font-black text-[#536175]">{item.resultStatus ?? "success"}</span>
                </div>
              ))}
              {auditQuery.isError ? <div className="p-6 text-center text-[13px] font-bold text-[#dc2626]">Audit logs 暫時無法載入。</div> : null}
              {!auditQuery.isError && !(auditQuery.data?.items ?? []).length ? <div className="p-6 text-center text-[13px] font-bold text-[#637185]">尚無 audit log。</div> : null}
            </div>
          </WorkbenchCard>
        ) : null}

        {tab === "raw" ? (
          <WorkbenchCard className="p-5">
            <NotConnectedCard title="Raw Inspector" reason="degraded" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["Module Registry", "/api/modules/registry"],
                ["Module Health", "/api/modules/health"],
                ["Audit Logs", "/api/audit/logs"],
                ["Watchdog Events", "/api/bff/system/watchdog-events"],
              ].map(([label, path]) => (
                <div key={path} className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
                  <p className="text-[13px] font-black text-[#10233f]">{label}</p>
                  <p className="mt-1 font-mono text-[11px] font-bold text-[#637185]">{path}</p>
                </div>
              ))}
            </div>
          </WorkbenchCard>
        ) : null}

        {selectedModule ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#10233f]/30">
            <div className="h-full w-full max-w-[680px] overflow-y-auto bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">Module Descriptor</p>
                  <h2 className="mt-1 text-[20px] font-black text-[#10233f]">{selectedModule.label}</h2>
                  <p className="mt-1 font-mono text-[12px] font-black text-[#2f6fe8]">{selectedModule.id}</p>
                </div>
                <button type="button" onClick={() => setSelectedModule(null)} className="grid h-10 w-10 place-items-center rounded-[8px] border border-[#dfe7ef]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Info icon={<Layers3 className="h-4 w-4" />} label="status" value={selectedModule.status} />
                <Info icon={<ShieldCheck className="h-4 w-4" />} label="roles" value={selectedModule.visibleRoles.join(", ")} />
                <Info icon={<Database className="h-4 w-4" />} label="tables" value={selectedModule.data.map((item) => item.table ?? item.entity).join(", ") || "-"} />
                <Info icon={<Network className="h-4 w-4" />} label="apis" value={selectedModule.apis.map((item) => `${item.method} ${item.path}`).join(", ") || "-"} />
              </div>
              <pre className="mt-5 max-h-[520px] overflow-auto rounded-[8px] bg-[#0d2a50] p-4 text-[12px] leading-5 text-white">{JSON.stringify(selectedModule, null, 2)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </RoleShell>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
      <div className="flex items-center gap-2 text-[#2f6fe8]">
        {icon}
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{label}</span>
      </div>
      <p className="mt-2 break-words text-[12px] font-bold leading-5 text-[#10233f]">{value}</p>
    </div>
  );
}
