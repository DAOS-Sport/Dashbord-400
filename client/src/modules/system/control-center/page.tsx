import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, ClipboardList, KeyRound, RefreshCw, ShieldAlert, Users, WifiOff } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchMetricCluster } from "@/modules/workbench/metric-cluster";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchHelperStatus, fetchSystemControlCenter, type ControlCenterSeverity, type HelperStatusDto } from "./api";
import { fetchCautionPermissions, type CautionPermissionDto } from "@/modules/system/line-whitelist/api";

const queryKey = ["/api/bff/system/control-center"];

const severityStyle: Record<ControlCenterSeverity, { dot: string; label: string; border: string }> = {
  normal: { dot: "bg-[#15935d]", label: "正常", border: "border-[#dfe7ef]" },
  warning: { dot: "bg-[#ca8a04]", label: "注意", border: "border-[#f2dda8]" },
  critical: { dot: "bg-[#dc2626]", label: "緊急", border: "border-[#ffc7cf]" },
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

const eventSeverityLabel = (severity: string) => {
  if (severity === "critical") return "緊急";
  if (severity === "warning" || severity === "high") return "注意";
  return "一般";
};

const helperStatusClass = (status: string) =>
  status === "ready"
    ? "bg-[#e9f8df] text-[#188249]"
    : status === "missing_required"
      ? "bg-[#ffe8eb] text-[#dc2626]"
      : "bg-[#eef2f6] text-[#536175]";

const helperStatusLabel = (status: string) =>
  status === "ready" ? "已設定" : status === "missing_required" ? "缺必要設定" : "未接通";

function HelperStatusDrawer({ open, onClose, data, isLoading }: { open: boolean; onClose: () => void; data?: HelperStatusDto; isLoading: boolean }) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[760px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[#10233f]"><Bot className="h-5 w-5" /> 400小幫手狀態檢視</SheetTitle>
          <SheetDescription>外部服務、暴露端點、Secrets 設定狀態與容錯策略。</SheetDescription>
        </SheetHeader>
        {isLoading ? <div className="mt-6 rounded-[8px] bg-[#f7f9fb] p-4 text-[13px] font-bold text-[#637185]">載入服務清單...</div> : null}
        {data ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ["外部服務", data.summary.externalServices],
                ["已設定", data.summary.readyServices],
                ["端點", data.summary.exposedEndpoints],
                ["缺必要", data.summary.missingRequiredEnv.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border border-[#edf1f6] bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">{label}</p>
                  <p className="mt-2 text-[24px] font-black text-[#10233f]">{value}</p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="text-[14px] font-black text-[#10233f]">對外呼叫服務</h3>
              <div className="mt-2 grid gap-2">
                {data.services.map((service) => (
                  <div key={service.name} className="rounded-[8px] border border-[#edf1f6] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-black text-[#10233f]">{service.name}</p>
                        <p className="mt-1 text-[12px] font-bold text-[#637185]">{service.purpose}</p>
                      </div>
                      <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", helperStatusClass(service.status))}>{helperStatusLabel(service.status)}</span>
                    </div>
                    {service.missingCredentialKeys.length ? <p className="mt-2 text-[11px] font-black text-[#dc2626]">缺少：{service.missingCredentialKeys.join(", ")}</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[14px] font-black text-[#10233f]">本系統暴露端點</h3>
              <div className="mt-2 grid gap-2">
                {data.endpoints.map((endpoint) => (
                  <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-[8px] border border-[#edf1f6] p-3">
                    <p className="font-mono text-[12px] font-black text-[#10233f]">{endpoint.method} {endpoint.path}</p>
                    <p className="mt-1 text-[12px] font-bold text-[#637185]">{endpoint.description} · {endpoint.auth}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-[14px] font-black text-[#10233f]"><KeyRound className="h-4 w-4" /> Secrets / 環境變數</h3>
              <div className="mt-2 space-y-3">
                {data.envGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[12px] font-black text-[#007166]">{group.title}</p>
                    <div className="mt-2 grid gap-2">
                      {group.variables.map((variable) => (
                        <div key={variable.name} className="flex items-center justify-between gap-3 rounded-[8px] border border-[#edf1f6] px-3 py-2">
                          <p className="font-mono text-[11px] font-black text-[#10233f]">{variable.name}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-black", helperStatusClass(variable.status))}>{helperStatusLabel(variable.status)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function LineWhitelistDrawer({ open, onClose, data, isLoading }: { open: boolean; onClose: () => void; data?: CautionPermissionDto; isLoading: boolean }) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[760px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[#10233f]"><Users className="h-5 w-5" /> 慎用查詢權限管理</SheetTitle>
          <SheetDescription>檢視 400 LINE 小幫手慎用查詢授權、人員狀態與期限。</SheetDescription>
        </SheetHeader>
        {isLoading ? <div className="mt-6 rounded-[8px] bg-[#f7f9fb] p-4 text-[13px] font-bold text-[#637185]">載入白名單...</div> : null}
        {data?.storageStatus === "schema_pending" ? (
          <div className="mt-5 rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[13px] font-black text-[#8a5a00]">
            白名單資料表尚未建立，套用 migration 後即可寫入與切換狀態。
          </div>
        ) : null}
        {data ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              {[["已授權", data.summary.total], ["啟用中", data.summary.active], ["停用", data.summary.disabled], ["已過期", data.summary.expired]].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border border-[#edf1f6] bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">{label}</p>
                  <p className="mt-2 text-[24px] font-black text-[#10233f]">{value}</p>
                </div>
              ))}
            </div>
            <section>
              <h3 className="text-[14px] font-black text-[#10233f]">治理規則</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {["不刪除授權紀錄，只能停用", "期限到期後驗證 endpoint 拒絕", "LINE 側應 fail-closed", "每次使用寫入 used audit"].map((rule) => (
                  <div key={rule} className="rounded-[8px] border border-[#edf1f6] p-3 text-[12px] font-black text-[#10233f]">{rule}</div>
                ))}
              </div>
            </section>
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-black text-[#10233f]">授權人員</h3>
                <Link href="/system/line-whitelist" className="text-[12px] font-black text-[#007166]">進入管理 →</Link>
              </div>
              <div className="mt-2 grid gap-2">
                {data.items.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-[8px] border border-[#edf1f6] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-black text-[#10233f]">{entry.displayName}</p>
                        <p className="mt-1 truncate font-mono text-[11px] font-black text-[#536175]">{entry.userId}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">{entry.phone ?? "-"} · {entry.department ?? "-"}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-black", entry.status === "active" ? "bg-[#e9f8df] text-[#188249]" : "bg-[#eef2f6] text-[#536175]")}>
                        {entry.status === "active" || entry.status === "expiring_soon" ? "啟用" : entry.status === "expired" ? "過期" : "停用"}
                      </span>
                    </div>
                  </div>
                ))}
                {!data.items.length ? <div className="rounded-[8px] bg-[#f7f9fb] p-4 text-center text-[12px] font-bold text-[#8b9aae]">尚未建立白名單。</div> : null}
              </div>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function SystemControlCenterPage() {
  const queryClient = useQueryClient();
  const [helperDrawerOpen, setHelperDrawerOpen] = useState(false);
  const [lineWhitelistDrawerOpen, setLineWhitelistDrawerOpen] = useState(false);
  const controlCenterQuery = useQuery({
    queryKey,
    queryFn: fetchSystemControlCenter,
    staleTime: 5_000,
  });
  const helperStatusQuery = useQuery({
    queryKey: ["/api/bff/system/helper-status"],
    queryFn: fetchHelperStatus,
    enabled: helperDrawerOpen,
  });
  const lineWhitelistQuery = useQuery({
    queryKey: ["/api/bff/system/line-whitelist"],
    queryFn: () => fetchCautionPermissions(),
    enabled: lineWhitelistDrawerOpen,
  });
  const data = controlCenterQuery.data;
  const hasControlCenterData = Boolean(data);
  const controlCenterErrorMessage =
    controlCenterQuery.error instanceof Error ? controlCenterQuery.error.message : "控制中心資料載入失敗";
  const refreshedAt = useMemo(() => formatTime(data?.generatedAt), [data?.generatedAt]);
  const kpiCards = [
    { label: "正常功能", helper: "可直接使用", value: data?.kpi.readyModules ?? 0, tone: "green" as const, icon: Activity, href: "/system/watchdog" },
    { label: "需要留意", helper: "可用但需追蹤", value: data?.kpi.degradedModules ?? 0, tone: "amber" as const, icon: AlertTriangle, href: "/system/watchdog" },
    { label: "尚未接通", helper: "等外部資料源", value: data?.kpi.notConnectedModules ?? 0, tone: "gray" as const, icon: WifiOff, href: "/system/watchdog" },
    { label: "錯誤", helper: "需要處理", value: data?.kpi.errorModules ?? 0, tone: "red" as const, icon: ShieldAlert, href: "/system/watchdog" },
    { label: "今日紀錄", helper: "操作留痕", value: data?.kpi.audit24h ?? 0, tone: "navy" as const, icon: ClipboardList, href: "/system/governance" },
    { label: "緊急事件", helper: "24 小時內", value: data?.kpi.watchdogCritical24h ?? 0, tone: "red" as const, icon: ShieldAlert, href: "/system/watchdog" },
  ];
  const tiles = [
    {
      key: "watchdog",
      title: "系統健康",
      code: "WATCHDOG",
      href: "/system/watchdog",
      severity: data?.tiles.watchdog.severity ?? "normal",
      lines: [
        `${data?.tiles.watchdog.criticalCount ?? 0} 件緊急事件待處理`,
        `最近狀態：${data?.tiles.watchdog.lastEventTitle ?? "目前沒有事件"}`,
      ],
    },
    {
      key: "operations",
      title: "同仁支援",
      code: "OPERATIONS",
      href: "/system/operations",
      severity: data?.tiles.operations.severity ?? "normal",
      lines: [
        `${data?.tiles.operations.pendingCount ?? 0} 件待協助 · 今日已協助 ${data?.tiles.operations.todayHandledCount ?? 0} 件`,
        "查同仁、讓他重新登入、重新整理資料、重發通知",
      ],
    },
    {
      key: "insights",
      title: "使用狀況",
      code: "INSIGHTS",
      href: "/system/insights",
      severity: data?.tiles.insights.severity ?? "normal",
      lines: ["看哪些功能最常用", data?.tiles.insights.anomalyHint ?? "近期使用穩定"],
    },
    {
      key: "helper-status",
      title: "400小幫手",
      code: "HELPER STATUS",
      onClick: () => setHelperDrawerOpen(true),
      severity: ((helperStatusQuery.data?.summary.missingRequiredEnv.length ?? 0) > 0 ? "warning" : "normal") as ControlCenterSeverity,
      lines: [
        `${helperStatusQuery.data?.summary.externalServices ?? 8} 個外部服務 · ${helperStatusQuery.data?.summary.exposedEndpoints ?? 11} 個端點`,
        "檢視 Secrets 設定、端點認證與容錯策略",
      ],
    },
    {
      key: "line-whitelist",
      title: "白名單管理",
      code: "LINE ACCESS",
      onClick: () => setLineWhitelistDrawerOpen(true),
      severity: (lineWhitelistQuery.data?.storageStatus === "schema_pending" ? "warning" : "normal") as ControlCenterSeverity,
      lines: [
        `${lineWhitelistQuery.data?.summary.active ?? 0} 位啟用 · ${lineWhitelistQuery.data?.summary.expired ?? 0} 位已過期`,
        "管理 400 LINE 官方帳號功能授權、狀態與期限",
      ],
    },
    {
      key: "governance",
      title: "治理與紀錄",
      code: "GOVERNANCE",
      href: "/system/governance",
      severity: data?.tiles.governance.severity ?? "normal",
      lines: [
        `${data?.tiles.governance.moduleCount ?? 0} 個模組`,
        `${data?.tiles.governance.orphanCount ?? 0} 個未歸位項目`,
      ],
    },
  ];
  const chairmanStatus = controlCenterQuery.isError
    ? "控制中心資料無法載入，請先確認權限與 BFF 狀態。"
    : data?.kpi.errorModules
      ? "有錯誤功能，請先進入系統健康查看。"
      : data?.tiles.watchdog.criticalCount
        ? "有緊急事件，請先進入系統健康處理。"
        : data?.tiles.operations.pendingCount
          ? "有同仁支援待處理，請進入同仁支援。"
          : "目前沒有需要立即處理的事項。";

  return (
    <RoleShell role="system" title="系統控制中心" subtitle="SYSTEM CONTROL CENTER">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-control-center-page">
        <div className="flex flex-col gap-3 rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-[0_8px_24px_-16px_rgba(13,42,80,0.18)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#15935d]">SYSTEM · 總控台</p>
            <h1 className="mt-1 text-[24px] font-black text-[#10233f]">系統總控台</h1>
            <p className="mt-1 text-[13px] font-bold text-[#637185]">先看這裡：今天系統是否正常、同仁是否需要協助、功能是否有人使用。最後更新 {refreshedAt}</p>
          </div>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey })}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#10233f]"
          >
            <RefreshCw className={cn("h-4 w-4", controlCenterQuery.isFetching && "animate-spin")} />
            重新整理
          </button>
        </div>

        <WorkbenchCard className="border-[#cfe8dd] bg-[#fbfffd] p-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#15935d]">給系統管理員的一句話</p>
              <h2 className="mt-2 text-[20px] font-black text-[#10233f]">{chairmanStatus}</h2>
            </div>
            <p className="text-[13px] font-bold leading-6 text-[#536175]">「正常功能」越多代表可用範圍越大；「尚未接通」通常是外部資料還沒串好，不代表系統壞掉。</p>
            <p className="text-[13px] font-bold leading-6 text-[#536175]">要找人、重登、重發通知，進「同仁支援」；要看功能有沒有被用，進「使用狀況」。</p>
          </div>
        </WorkbenchCard>

        {controlCenterQuery.isError ? (
          <WorkbenchCard className="border-[#ffc7cf] bg-[#fff7f8] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#dc2626]">
                  <ShieldAlert className="h-5 w-5" />
                  <h2 className="text-[16px] font-black">控制中心資料無法載入</h2>
                </div>
                <p className="mt-2 text-[13px] font-bold leading-6 text-[#7f1d1d]">
                  已停止顯示 0 值摘要，避免誤判系統正常。請確認目前角色是 /SYSTEM，或到 Watchdog 手動檢查。
                </p>
                <p className="mt-1 truncate text-[11px] font-bold text-[#a23a48]">{controlCenterErrorMessage}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => queryClient.invalidateQueries({ queryKey })}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] border border-[#ffc7cf] bg-white px-3 text-[12px] font-black text-[#dc2626]"
                >
                  <RefreshCw className={cn("h-4 w-4", controlCenterQuery.isFetching && "animate-spin")} />
                  重新整理
                </button>
                <Link href="/system/watchdog" className="inline-flex min-h-9 items-center justify-center rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-black text-white">
                  進入 Watchdog
                </Link>
              </div>
            </div>
          </WorkbenchCard>
        ) : null}

        {hasControlCenterData ? (
          <WorkbenchMetricCluster
            eyebrow="System Metrics"
            title="系統摘要"
            helper="集中顯示，點擊可進入對應監控頁。"
            items={kpiCards}
            columnsClassName="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
          />
        ) : null}

        {hasControlCenterData ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {tiles.map((tile) => {
              const ui = severityStyle[tile.severity];
              const body = (
                <WorkbenchCard className={cn("min-h-[140px] border p-4 transition hover:shadow-[0_12px_32px_-18px_rgba(13,42,80,0.30)]", ui.border)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", ui.dot)} />
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">{ui.label}</span>
                      </div>
                      <h2 className="mt-3 text-[18px] font-black text-[#10233f]">{tile.title}</h2>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b9aae]">{tile.code}</p>
                    </div>
                    {tile.key === "helper-status" ? <Bot className="h-5 w-5 text-[#637185]" /> : tile.key === "line-whitelist" ? <Users className="h-5 w-5 text-[#637185]" /> : <ArrowRight className="h-5 w-5 text-[#637185]" />}
                  </div>
                  <div className="mt-5 space-y-1">
                    {tile.lines.map((line) => (
                      <p key={line} className="text-[13px] font-bold leading-6 text-[#536175]">{line}</p>
                    ))}
                  </div>
                </WorkbenchCard>
              );
              if ("onClick" in tile) {
                return (
                  <button key={tile.key} type="button" onClick={tile.onClick} className="block w-full text-left">
                    {body}
                  </button>
                );
              }
              return (
                <Link key={tile.key} href={tile.href} className="block">
                  {body}
                </Link>
              );
            })}
          </div>
        ) : null}

        {hasControlCenterData ? (
          <WorkbenchCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf1f6] p-4">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">近期重要事件</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">最近 5 筆需要留意或緊急處理的系統事件。</p>
              </div>
              <Link href="/system/watchdog" className="text-[12px] font-black text-[#007166]">查看全部事件 →</Link>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {(data?.recentCriticalEvents ?? []).map((event) => (
                <Link key={event.id} href="/system/watchdog" className="grid gap-2 border-b border-[#edf1f6] p-4 transition hover:bg-[#fbfcfd] md:grid-cols-[120px_110px_1fr_160px] md:items-center">
                  <span className="text-[12px] font-bold text-[#637185]">{formatTime(event.createdAt)}</span>
                  <span className={cn("w-fit rounded-full px-2.5 py-1 text-[10px] font-black", event.severity === "critical" ? "bg-[#ffe8eb] text-[#dc2626]" : "bg-[#fff6e7] text-[#ca8a04]")}>{eventSeverityLabel(event.severity)}</span>
                  <span className="truncate text-[13px] font-black text-[#10233f]">{event.title}</span>
                  <span className="truncate text-[12px] font-bold text-[#637185]">{event.source}{event.role ? ` · ${event.role}` : ""}</span>
                </Link>
              ))}
              {!(data?.recentCriticalEvents ?? []).length ? (
                <div className="grid min-h-[160px] place-items-center p-6 text-center">
                  <div>
                    <CheckCircle2 className="mx-auto h-10 w-10 text-[#15935d]" />
                    <p className="mt-3 text-[14px] font-black text-[#10233f]">目前系統穩定，無關鍵事件</p>
                    <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">Watchdog 有事件時會集中出現在這裡。</p>
                  </div>
                </div>
              ) : null}
            </div>
          </WorkbenchCard>
        ) : null}
      </div>
      <HelperStatusDrawer
        open={helperDrawerOpen}
        onClose={() => setHelperDrawerOpen(false)}
        data={helperStatusQuery.data}
        isLoading={helperStatusQuery.isLoading}
      />
      <LineWhitelistDrawer
        open={lineWhitelistDrawerOpen}
        onClose={() => setLineWhitelistDrawerOpen(false)}
        data={lineWhitelistQuery.data}
        isLoading={lineWhitelistQuery.isLoading}
      />
    </RoleShell>
  );
}
