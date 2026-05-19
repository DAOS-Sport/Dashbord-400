import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  Bell,
  Bot,
  ChevronLeft,
  Database,
  ListChecks,
  RadioTower,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import {
  fetchLinebotManagementFacilities,
  fetchLinebotManagementOverview,
  fetchLinebotManagementPipeline,
  fetchLinebotManagementServices,
  fetchLinebotManagementWhitelist,
  syncLinebotWhitelistShadow,
} from "./api";
import type { LinebotApiReadiness, LinebotManagementStatus } from "@shared/system/linebot-management-contract";

const tabs = [
  { key: "overview", label: "總覽", icon: ShieldCheck },
  { key: "services", label: "服務監控", icon: Server },
  { key: "facilities", label: "群組 / 館別", icon: Users },
  { key: "whitelist", label: "白名單 / 權限", icon: ListChecks },
  { key: "pipeline", label: "重要公告管線", icon: Bell },
  { key: "readiness", label: "API Readiness", icon: RadioTower },
] as const;

type TabKey = typeof tabs[number]["key"];

const statusLabel = (status: LinebotManagementStatus) => {
  if (status === "ready") return "ready";
  if (status === "degraded") return "degraded";
  if (status === "waiting_for_400line_api") return "waiting_for_400line_api";
  return "error";
};

const statusClass = (status: LinebotManagementStatus) =>
  status === "ready"
    ? "bg-[#e9f8df] text-[#188249]"
    : status === "degraded"
      ? "bg-[#fff6e7] text-[#9b6a00]"
      : status === "waiting_for_400line_api"
        ? "bg-[#eef2f6] text-[#536175]"
        : "bg-[#ffe8eb] text-[#dc2626]";

function StatusPill({ status }: { status: LinebotManagementStatus }) {
  return <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusClass(status))}>{statusLabel(status)}</span>;
}

function LoadingBlock() {
  return <div className="rounded-[8px] border border-[#edf1f6] bg-white p-4 text-[13px] font-bold text-[#637185]">載入 400LINE 管理資料中...</div>;
}

function ErrorBlock() {
  return <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-4 text-[13px] font-black text-[#dc2626]">400LINE 管理資料讀取失敗。</div>;
}

function EmptyBlock({ label }: { label: string }) {
  return <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">尚無{label}資料。</div>;
}

function ApiReadinessList({ items }: { items: LinebotApiReadiness[] }) {
  if (!items.length) return <EmptyBlock label="API readiness" />;
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={`${item.method}-${item.path}-${item.label}-${item.lastCheckedAt}-${index}`} className="grid gap-2 rounded-[8px] border border-[#edf1f6] bg-white p-3 lg:grid-cols-[160px_1fr_180px] lg:items-center">
          <div className="flex items-center gap-2">
            <StatusPill status={item.status} />
            <span className="text-[11px] font-black text-[#536175]">{item.method}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] font-black text-[#10233f]">{item.path}</p>
            <p className="mt-0.5 text-[12px] font-bold text-[#637185]">{item.label} · {item.note}</p>
          </div>
          <p className="text-[11px] font-bold text-[#8b9aae]">最後同步 {new Date(item.lastCheckedAt).toLocaleString("zh-TW")}</p>
        </div>
      ))}
    </div>
  );
}

export default function SystemLinebotManagementPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const overviewQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/overview"],
    queryFn: fetchLinebotManagementOverview,
    refetchInterval: 30_000,
    retry: 1,
  });
  const servicesQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/services"],
    queryFn: fetchLinebotManagementServices,
    enabled: tab === "services" || tab === "readiness",
    retry: 1,
  });
  const facilitiesQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/facilities"],
    queryFn: fetchLinebotManagementFacilities,
    enabled: tab === "facilities",
    retry: 1,
  });
  const whitelistQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/whitelist-snapshot"],
    queryFn: fetchLinebotManagementWhitelist,
    enabled: tab === "whitelist",
    retry: 1,
  });
  const pipelineQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/announcement-pipeline"],
    queryFn: fetchLinebotManagementPipeline,
    enabled: tab === "pipeline" || tab === "readiness",
    retry: 1,
  });
  const syncMutation = useMutation({
    mutationFn: () => syncLinebotWhitelistShadow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/system/linebot-management/whitelist-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/system/linebot-management/overview"] });
    },
  });

  const readinessItems = useMemo(() => [
    ...(overviewQuery.data?.apiReadiness ?? []),
    ...(servicesQuery.data?.apiReadiness ?? []),
    ...(pipelineQuery.data?.apiReadiness ?? []),
  ], [overviewQuery.data?.apiReadiness, pipelineQuery.data?.apiReadiness, servicesQuery.data?.apiReadiness]);

  return (
    <RoleShell role="system" title="400LINE 管理" subtitle="LINE BOT ASSISTANT GOVERNANCE">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-linebot-management-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/system" className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
            <ChevronLeft className="h-4 w-4" />
            回控制中心
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/system/lineXBS-status" className="rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]">服務監控舊頁</Link>
            <Link href="/system/line-whitelist" className="rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]">白名單舊頁</Link>
          </div>
        </div>

        <WorkbenchCard className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[#0f766e]">
                <Bot className="h-5 w-5" />
                <p className="text-[11px] font-black uppercase tracking-[0.16em]">400LINE DOMAIN</p>
              </div>
              <h1 className="mt-2 text-[24px] font-black text-[#10233f]">400LINE 管理</h1>
              <p className="mt-1 text-[13px] font-bold text-[#637185]">集中監測 400LINE / LINE Bot Assistant 服務、群組、白名單與重要公告管線。此頁只讀，不顯示 secret 值。</p>
              {overviewQuery.data ? (
                <p className="mt-1 font-mono text-[11px] font-black text-[#8b9aae]">
                  source={overviewQuery.data.sourceMode}{overviewQuery.data.rawStatus ? ` · raw=${overviewQuery.data.rawStatus}` : ""}
                </p>
              ) : null}
            </div>
            {overviewQuery.data ? <StatusPill status={overviewQuery.data.status} /> : null}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
            {(overviewQuery.data?.cards ?? []).map((card) => (
              <div key={card.label} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black text-[#8b9aae]">{card.label}</p>
                  <StatusPill status={card.status} />
                </div>
                <p className="mt-2 text-[26px] font-black text-[#10233f]">{card.value}</p>
                <p className="mt-1 text-[11px] font-bold text-[#637185]">{card.hint}</p>
              </div>
            ))}
            {overviewQuery.isLoading ? <LoadingBlock /> : null}
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="p-2">
          <div className="flex flex-wrap gap-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn("inline-flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[12px] font-black", active ? "bg-[#0f1b3d] text-white" : "text-[#536175] hover:bg-[#f3f6fb]")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </WorkbenchCard>

        {tab === "overview" ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
            <WorkbenchCard className="p-4">
              <h2 className="text-[16px] font-black text-[#10233f]">狀態摘要</h2>
              {overviewQuery.isError ? <ErrorBlock /> : null}
              <div className="mt-3 grid gap-2">
                {(overviewQuery.data?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-[8px] bg-[#f7f9fb] p-3 text-[12px] font-bold text-[#536175]">{note}</div>
                ))}
              </div>
            </WorkbenchCard>
            <WorkbenchCard className="p-4">
              <h2 className="text-[16px] font-black text-[#10233f]">API Readiness</h2>
              <div className="mt-3">
                <ApiReadinessList items={(overviewQuery.data?.apiReadiness ?? []).slice(0, 5)} />
              </div>
            </WorkbenchCard>
          </div>
        ) : null}

        {tab === "services" ? (
          <WorkbenchCard className="p-4">
            <h2 className="text-[16px] font-black text-[#10233f]">服務監控</h2>
            {servicesQuery.isLoading ? <LoadingBlock /> : null}
            {servicesQuery.isError ? <ErrorBlock /> : null}
            <div className="mt-3 grid gap-2 xl:grid-cols-2">
              {(servicesQuery.data?.services ?? []).map((service) => (
                <div key={service.key} className="rounded-[8px] border border-[#edf1f6] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-black text-[#10233f]">{service.label}</p>
                      <p className="mt-1 font-mono text-[11px] font-black text-[#536175]">{service.sourcePath}</p>
                    </div>
                    <StatusPill status={service.status} />
                  </div>
                  <p className="mt-2 text-[12px] font-bold text-[#637185]">{service.message}</p>
                  <p className="mt-2 text-[11px] font-bold text-[#8b9aae]">最後同步 {service.lastSyncAt ? new Date(service.lastSyncAt).toLocaleString("zh-TW") : "等待 heartbeat"}</p>
                </div>
              ))}
            </div>
            {!servicesQuery.isLoading && !(servicesQuery.data?.services ?? []).length ? <EmptyBlock label="服務監控" /> : null}
          </WorkbenchCard>
        ) : null}

        {tab === "facilities" ? (
          <WorkbenchCard className="p-4">
            <h2 className="text-[16px] font-black text-[#10233f]">群組 / 館別</h2>
            {facilitiesQuery.isLoading ? <LoadingBlock /> : null}
            {facilitiesQuery.isError ? <ErrorBlock /> : null}
            <div className="mt-3 grid gap-2 xl:grid-cols-2">
              {(facilitiesQuery.data?.items ?? []).map((facility) => (
                <div key={facility.id} className="grid gap-2 rounded-[8px] border border-[#edf1f6] bg-white p-3 lg:grid-cols-[1fr_160px] lg:items-center">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-[#10233f]">{facility.name}</p>
                    <p className="mt-1 truncate font-mono text-[11px] font-black text-[#536175]">{facility.groupId}</p>
                    <p className="mt-1 text-[12px] font-bold text-[#637185]">{facility.message}</p>
                  </div>
                  <StatusPill status={facility.status} />
                </div>
              ))}
            </div>
            {!facilitiesQuery.isLoading && !(facilitiesQuery.data?.items ?? []).length ? <EmptyBlock label="館別" /> : null}
          </WorkbenchCard>
        ) : null}

        {tab === "whitelist" ? (
          <WorkbenchCard className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">白名單 / 權限三方比對</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">這裡只看 400LINE、Ragic H01/H02、CMS shadow 是否對齊；細部授權編輯請進白名單詳細頁。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {whitelistQuery.data ? <StatusPill status={whitelistQuery.data.status} /> : null}
                <button
                  type="button"
                  disabled={syncMutation.isPending || !whitelistQuery.data?.summary.syncable}
                  onClick={() => syncMutation.mutate()}
                  className="rounded-[8px] bg-[#0f1b3d] px-3 py-2 text-[12px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncMutation.isPending ? "同步中..." : "同步到 CMS shadow"}
                </button>
                <Link href="/system/line-whitelist" className="rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]">進入詳細授權</Link>
              </div>
            </div>
            {whitelistQuery.isLoading ? <LoadingBlock /> : null}
            {whitelistQuery.isError ? <ErrorBlock /> : null}
            {syncMutation.data ? (
              <div className="mt-3 rounded-[8px] border border-[#d1fae5] bg-[#f0fdf4] p-3 text-[12px] font-bold text-[#188249]">
                同步完成：created {syncMutation.data.created}，updated {syncMutation.data.updated}，skipped {syncMutation.data.skipped}，errors {syncMutation.data.errors}
              </div>
            ) : null}
            {syncMutation.isError ? (
              <div className="mt-3 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] p-3 text-[12px] font-bold text-[#c2410c]">同步失敗，請稍後再試。</div>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-5 xl:grid-cols-10">
              {whitelistQuery.data ? Object.entries(whitelistQuery.data.summary).map(([key, value]) => (
                <div key={key} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                  <p className="text-[11px] font-black text-[#8b9aae]">{key}</p>
                  <p className="mt-1 text-[24px] font-black text-[#10233f]">{value}</p>
                </div>
              )) : null}
            </div>
            <div className="mt-3 grid gap-2">
              {(whitelistQuery.data?.items ?? []).map((item) => (
                <div key={`${item.lineUserId}-${item.comparisonStatus}-${item.cmsShadowId ?? "none"}`} className="grid gap-2 rounded-[8px] border border-[#edf1f6] bg-white p-3 xl:grid-cols-[1fr_190px_160px_180px] xl:items-center">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-[#10233f]">{item.displayName}</p>
                    <p className="mt-1 truncate font-mono text-[11px] font-black text-[#536175]">{item.lineUserId || "等待 lineUserId 對齊"}</p>
                    <p className="mt-1 text-[12px] font-bold text-[#637185]">{item.department ?? "-"} · {item.phone ?? "-"} · {item.employeeNumber ?? "-"}</p>
                  </div>
                  <span className="text-[12px] font-black text-[#536175]">{item.featureSummary}</span>
                  <span className={cn("rounded-full px-2 py-1 text-center text-[11px] font-black", item.ragicMatched ? "bg-[#e9f8df] text-[#188249]" : "bg-[#fff6e7] text-[#9b6a00]")}>
                    Ragic {item.ragicMatchMode}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={cn("rounded-full px-2 py-1 text-center text-[11px] font-black", item.syncable ? "bg-[#e0f2fe] text-[#0369a1]" : "bg-[#eef2f6] text-[#536175]")}>{item.comparisonStatus}</span>
                    {item.fieldMismatches.length ? <span className="rounded-full bg-[#fff6e7] px-2 py-1 text-[11px] font-black text-[#9b6a00]">{item.fieldMismatches.join("、")}</span> : null}
                    <Link href="/system/line-whitelist" className="text-[11px] font-black text-[#0f766e] hover:underline">編輯</Link>
                  </div>
                </div>
              ))}
            </div>
            {!whitelistQuery.isLoading && !(whitelistQuery.data?.items ?? []).length ? <EmptyBlock label="白名單 snapshot" /> : null}
          </WorkbenchCard>
        ) : null}

        {tab === "pipeline" ? (
          <WorkbenchCard className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">重要公告管線</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">員工端群組重要公告可吃高信心候選，但需通過本地 displayable filter。</p>
              </div>
              {pipelineQuery.data ? <StatusPill status={pipelineQuery.data.status} /> : null}
            </div>
            {pipelineQuery.isLoading ? <LoadingBlock /> : null}
            {pipelineQuery.isError ? <ErrorBlock /> : null}
            <div className="mt-3 grid gap-2">
              {(pipelineQuery.data?.stages ?? []).map((stage) => (
                <div key={stage.key} className="grid gap-2 rounded-[8px] border border-[#edf1f6] bg-white p-3 lg:grid-cols-[220px_1fr_120px] lg:items-center">
                  <p className="font-black text-[#10233f]">{stage.label}</p>
                  <p className="text-[12px] font-bold text-[#637185]">{stage.description}</p>
                  <StatusPill status={stage.status} />
                </div>
              ))}
            </div>
            {pipelineQuery.data ? (
              <div className="mt-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                <div className="flex items-center gap-2 text-[#536175]">
                  <Database className="h-4 w-4" />
                  <p className="text-[12px] font-black">員工端進入規則</p>
                </div>
                <p className="mt-2 text-[12px] font-bold text-[#637185]">
                  priority = {pipelineQuery.data.employeeEntryRule.priority.join(" / ")}，
                  confidence &gt;= {pipelineQuery.data.employeeEntryRule.minimumConfidence}，
                  需符合 facility/group scope 與 displayable filter。來源標籤：{pipelineQuery.data.employeeEntryRule.sourceLabels.join("、")}。
                </p>
              </div>
            ) : null}
          </WorkbenchCard>
        ) : null}

        {tab === "readiness" ? (
          <WorkbenchCard className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#536175]" />
              <h2 className="text-[16px] font-black text-[#10233f]">API Readiness</h2>
            </div>
            <div className="mt-3">
              <ApiReadinessList items={readinessItems} />
            </div>
          </WorkbenchCard>
        ) : null}
      </div>
    </RoleShell>
  );
}
