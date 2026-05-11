import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, ChevronLeft, Database, PlugZap, X } from "lucide-react";
import type { ModuleHealthDto } from "@shared/modules";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";

type TabKey = "health" | "alerts" | "integrations";

interface WatchdogEventDto {
  id: number;
  source: string;
  serviceName: string;
  status: string;
  severity: string;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  observedAt: string;
  createdAt: string;
}

interface IntegrationOverviewDto {
  checkedAt: string;
  adapters: Array<{ name: string; mode: string; configured: boolean }>;
}

const fetchHealth = () => apiGet<{ items: ModuleHealthDto[] }>("/api/modules/health");
const fetchWatchdogEvents = () => apiGet<{ items: WatchdogEventDto[] }>("/api/bff/system/watchdog-events");
const fetchIntegrations = () => apiGet<IntegrationOverviewDto>("/api/bff/system/integration-overview");

const statusRank: Record<ModuleHealthDto["status"], number> = {
  error: 0,
  degraded: 1,
  not_connected: 2,
  telemetry_pending: 3,
  ready: 4,
};

const statusClass: Record<string, string> = {
  ready: "bg-[#eaf8ef] text-[#007166]",
  telemetry_pending: "bg-[#fff6e7] text-[#9b6a00]",
  degraded: "bg-[#fff6e7] text-[#9b6a00]",
  not_connected: "bg-[#f3f6fb] text-[#6b7280]",
  error: "bg-[#ffe8eb] text-[#dc2626]",
  critical: "bg-[#ffe8eb] text-[#dc2626]",
  warning: "bg-[#fff6e7] text-[#9b6a00]",
  info: "bg-[#eef5ff] text-[#2f6fe8]",
};

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "health", label: "Health" },
  { id: "alerts", label: "Alerts" },
  { id: "integrations", label: "Integrations" },
];

const payloadText = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
};

export default function SystemWatchdogPage() {
  const [tab, setTab] = useState<TabKey>("health");
  const [selectedEvent, setSelectedEvent] = useState<WatchdogEventDto | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const healthQuery = useQuery({ queryKey: ["/api/modules/health", "system-watchdog"], queryFn: fetchHealth });
  const eventsQuery = useQuery({ queryKey: ["/api/bff/system/watchdog-events"], queryFn: fetchWatchdogEvents });
  const integrationsQuery = useQuery({ queryKey: ["/api/bff/system/integration-overview"], queryFn: fetchIntegrations });

  const healthRows = useMemo(() => {
    return [...(healthQuery.data?.items ?? [])]
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => roleFilter === "all" || item.moduleId.includes(roleFilter))
      .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.moduleId.localeCompare(b.moduleId));
  }, [healthQuery.data?.items, roleFilter, statusFilter]);

  const events = useMemo(() => {
    return (eventsQuery.data?.items ?? []).filter((event) => severityFilter === "all" || event.severity === severityFilter);
  }, [eventsQuery.data?.items, severityFilter]);

  return (
    <RoleShell role="system" title="系統健康" subtitle="控制中心 > 系統健康">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-watchdog-page">
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

        {tab === "health" ? (
          <WorkbenchCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] p-4">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">模組健康</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">依 error → degraded → not_connected → ready 排序。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold">
                  <option value="all">all roles</option>
                  <option value="employee">employee</option>
                  <option value="lifeguard">lifeguard</option>
                  <option value="supervisor">supervisor</option>
                  <option value="system">system</option>
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold">
                  <option value="all">all status</option>
                  <option value="error">error</option>
                  <option value="degraded">degraded</option>
                  <option value="not_connected">not_connected</option>
                  <option value="telemetry_pending">telemetry_pending</option>
                  <option value="ready">ready</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#f7f9fb] text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">
                  <tr>
                    <th className="px-4 py-3">moduleId</th>
                    <th className="px-4 py-3">status</th>
                    <th className="px-4 py-3">route</th>
                    <th className="px-4 py-3">bff</th>
                    <th className="px-4 py-3">permission</th>
                    <th className="px-4 py-3">telemetry</th>
                    <th className="px-4 py-3">issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f6]">
                  {healthRows.map((item) => (
                    <tr key={item.moduleId} className="align-top">
                      <td className="px-4 py-3 font-mono text-[12px] font-black text-[#10233f]">{item.moduleId}</td>
                      <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusClass[item.status])}>{item.status}</span></td>
                      {[item.routeOk, item.bffOk, item.permissionOk, item.telemetryOk].map((ok, index) => (
                        <td key={index} className="px-4 py-3">{ok ? <CheckCircle2 className="h-4 w-4 text-[#15935d]" /> : <AlertTriangle className="h-4 w-4 text-[#ca8a04]" />}</td>
                      ))}
                      <td className="max-w-[420px] px-4 py-3 text-[12px] font-bold leading-5 text-[#637185]">{item.issues.join("；") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WorkbenchCard>
        ) : null}

        {tab === "alerts" ? (
          <WorkbenchCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] p-4">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">Watchdog events</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">點擊 row 可展開 payload、routePath、endpoint 與 correlationId。</p>
              </div>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold">
                <option value="all">all severity</option>
                <option value="critical">critical</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </div>
            <div className="divide-y divide-[#edf1f6]">
              {events.map((event) => (
                <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="grid w-full gap-2 p-4 text-left hover:bg-[#fbfcfd] md:grid-cols-[160px_110px_1fr_160px_140px] md:items-center">
                  <span className="text-[12px] font-bold text-[#637185]">{new Date(event.observedAt).toLocaleString("zh-TW")}</span>
                  <span className={cn("w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase", statusClass[event.severity] ?? statusClass.info)}>{event.severity}</span>
                  <span className="truncate text-[13px] font-black text-[#10233f]">{event.message ?? event.serviceName}</span>
                  <span className="truncate text-[12px] font-bold text-[#637185]">{event.serviceName}</span>
                  <span className="truncate text-[12px] font-bold text-[#8b9aae]">{event.source}</span>
                </button>
              ))}
              {!events.length ? <div className="p-8 text-center text-[13px] font-bold text-[#637185]">目前沒有 Watchdog events。</div> : null}
            </div>
          </WorkbenchCard>
        ) : null}

        {tab === "integrations" ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {(integrationsQuery.data?.adapters ?? [
              { name: "Ragic", mode: "pending", configured: false },
              { name: "LINE Bot", mode: "pending", configured: false },
              { name: "Smart Schedule", mode: "pending", configured: false },
              { name: "Gmail", mode: "pending", configured: false },
              { name: "Object Storage", mode: "pending", configured: false },
            ]).map((adapter) => (
              <WorkbenchCard key={adapter.name} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("grid h-10 w-10 place-items-center rounded-[8px]", adapter.configured ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#f3f6fb] text-[#6b7280]")}>
                      {adapter.configured ? <PlugZap className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-[#10233f]">{adapter.name}</p>
                      <p className="mt-1 text-[12px] font-bold text-[#637185]">mode: {adapter.mode}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", adapter.configured ? "bg-[#eaf8ef] text-[#007166]" : "bg-[#f3f6fb] text-[#6b7280]")}>
                    {adapter.configured ? "connected" : "reserved"}
                  </span>
                </div>
                <button type="button" disabled className="mt-5 min-h-9 rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb] px-3 text-[12px] font-black text-[#8b9aae]">
                  Test connection（下版啟用）
                </button>
              </WorkbenchCard>
            ))}
          </div>
        ) : null}

        {selectedEvent ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#10233f]/30">
            <div className="h-full w-full max-w-[620px] overflow-y-auto bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">Watchdog payload</p>
                  <h2 className="mt-1 text-[20px] font-black text-[#10233f]">{selectedEvent.message ?? selectedEvent.serviceName}</h2>
                </div>
                <button type="button" onClick={() => setSelectedEvent(null)} className="grid h-10 w-10 place-items-center rounded-[8px] border border-[#dfe7ef]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="mt-5 grid gap-3 text-[13px]">
                {[
                  ["severity", selectedEvent.severity],
                  ["status", selectedEvent.status],
                  ["source", selectedEvent.source],
                  ["service", selectedEvent.serviceName],
                  ["observedAt", selectedEvent.observedAt],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[8px] bg-[#fbfcfd] p-3">
                    <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{label}</dt>
                    <dd className="mt-1 font-mono text-[12px] font-bold text-[#10233f]">{value}</dd>
                  </div>
                ))}
              </dl>
              <pre className="mt-5 max-h-[520px] overflow-auto rounded-[8px] bg-[#0d2a50] p-4 text-[12px] leading-5 text-white">{payloadText(selectedEvent.payload)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </RoleShell>
  );
}
