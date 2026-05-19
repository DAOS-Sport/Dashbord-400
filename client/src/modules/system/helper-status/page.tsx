import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ChevronLeft, Clock, KeyRound, ListChecks, RadioTower, Server, ShieldCheck, WifiOff } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { fetchHelperStatus } from "@/modules/system/control-center/api";
import { fetchLineBotServiceStatus, fetchLineBotServiceStatusSnapshots, type LineBotServiceItem } from "@/modules/system/line-whitelist/api";
import { cn } from "@/lib/utils";

const sections = [
  { key: "overview", label: "總覽控制台", icon: ShieldCheck },
  { key: "services", label: "對外服務", icon: Server },
  { key: "endpoints", label: "端點與 Secrets", icon: KeyRound },
  { key: "trace", label: "即時追蹤", icon: RadioTower },
  { key: "push", label: "推送狀態", icon: Clock },
  { key: "whitelist", label: "白名單管理", icon: ListChecks },
] as const;

const statusLabel = (status: string) => status === "ready" ? "正常" : status === "missing_required" ? "缺必要設定" : "未接通";
const statusClass = (status: string) =>
  status === "ready"
    ? "bg-[#e9f8df] text-[#188249]"
    : status === "missing_required"
      ? "bg-[#ffe8eb] text-[#dc2626]"
      : "bg-[#eef2f6] text-[#536175]";

const normalizeRuntimeStatus = (status?: string) => {
  const value = (status ?? "unknown").toLowerCase();
  if (value === "healthy" || value === "up" || value === "ok" || status === "正常") return "healthy";
  if (value === "unhealthy" || value === "down" || value === "critical" || status === "中斷") return "critical";
  if (value === "degraded" || value === "warning" || status === "降級") return "degraded";
  return "unknown";
};

const runtimeStatusLabel = (status?: string) => {
  const normalized = normalizeRuntimeStatus(status);
  if (normalized === "healthy") return "正常";
  if (normalized === "degraded") return "降級";
  if (normalized === "critical") return "中斷";
  return "未知";
};

const runtimeStatusClass = (status?: string) => {
  const normalized = normalizeRuntimeStatus(status);
  if (normalized === "healthy") return "bg-[#e9f8df] text-[#188249]";
  if (normalized === "degraded") return "bg-[#fff6e7] text-[#9b6a00]";
  if (normalized === "critical") return "bg-[#ffe8eb] text-[#dc2626]";
  return "bg-[#eef2f6] text-[#536175]";
};

const runtimeServiceName = (service: LineBotServiceItem) => service.name ?? service.service ?? "unknown-service";
const runtimeServiceMessage = (service: LineBotServiceItem) => service.message ?? service.note ?? "尚無細節";

export default function SystemHelperStatusPage() {
  const [section, setSection] = useState<typeof sections[number]["key"]>("overview");
  const statusQuery = useQuery({
    queryKey: ["/api/bff/system/helper-status"],
    queryFn: fetchHelperStatus,
    refetchInterval: section === "overview" ? 30_000 : false,
  });
  const lineBotStatusQuery = useQuery({
    queryKey: ["/api/bff/system/line-bot/service-status", "helper-status"],
    queryFn: fetchLineBotServiceStatus,
    refetchInterval: 30_000,
    retry: 1,
  });
  const lineBotSnapshotsQuery = useQuery({
    queryKey: ["/api/bff/system/line-bot/service-status/snapshots", "helper-status"],
    queryFn: fetchLineBotServiceStatusSnapshots,
    enabled: section === "push",
    retry: 1,
  });
  const data = statusQuery.data;
  const missingRequired = data?.summary.missingRequiredEnv.length ?? 0;
  const runtimeServices = useMemo(() => {
    const raw = lineBotStatusQuery.data as { services?: LineBotServiceItem[]; message?: string } | undefined;
    return Array.isArray(raw?.services) ? raw.services : [];
  }, [lineBotStatusQuery.data]);
  const runtimeProblemServices = useMemo(() =>
    runtimeServices.filter((service) => normalizeRuntimeStatus(service.status) !== "healthy"),
  [runtimeServices]);
  const runtimeOverall = lineBotStatusQuery.isError
    ? "中斷"
    : runtimeProblemServices.some((service) => normalizeRuntimeStatus(service.status) === "critical")
      ? "中斷"
      : runtimeProblemServices.length
        ? "降級"
        : runtimeServices.length
          ? "正常"
          : missingRequired
            ? "降級"
            : "等待";
  const dashboardWebhook = useMemo(() =>
    data?.envGroups.flatMap((group) => group.variables).find((variable) => variable.name === "DASHBOARD_WEBHOOK_URL"),
  [data?.envGroups]);
  const lineBotMessage = (lineBotStatusQuery.data as { message?: string } | undefined)?.message;
  const snapshotItems = lineBotSnapshotsQuery.data?.items ?? [];
  const latestSnapshot = snapshotItems[0];
  const latestSnapshotAt = latestSnapshot?.snappedAt ?? latestSnapshot?.createdAt ?? latestSnapshot?.checkedAt;

  return (
    <RoleShell role="system" title="400LINE 服務監控" subtitle="LINE BOT ASSISTANT GOVERNANCE">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-helper-status-page">
        <Link href="/system" className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
          <ChevronLeft className="h-4 w-4" />
          回控制中心
        </Link>

        {statusQuery.isError ? (
          <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-3 text-[13px] font-black text-[#dc2626]">
            400LINE 服務監控資料載入失敗。
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "整體健康", value: runtimeOverall, icon: ShieldCheck },
            { label: "400LINE 服務", value: runtimeServices.length || data?.summary.externalServices || 0, icon: Server },
            { label: "異常服務", value: runtimeProblemServices.length, icon: AlertTriangle },
            { label: "缺必要設定", value: missingRequired, icon: WifiOff },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <WorkbenchCard key={item.label} className="p-4">
                <div className="flex items-center justify-between text-[#8b9aae]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]">{item.label}</p>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-[30px] font-black text-[#10233f]">{item.value}</p>
              </WorkbenchCard>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
          <WorkbenchCard className="p-2">
            <nav className="grid gap-1">
              {sections.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={cn("flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-left text-[13px] font-black", active ? "bg-[#0f1b3d] text-white" : "text-[#536175] hover:bg-[#f3f6fb]")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </WorkbenchCard>

          <div className="space-y-3">
            {section === "overview" ? (
              <>
                <WorkbenchCard className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-black text-[#10233f]">400LINE 即時服務狀態</h2>
                      <p className="mt-1 text-[12px] font-bold text-[#637185]">從 400LINE Admin/Internal API 讀取；用來快速看哪個連接或提供服務出問題。</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", runtimeStatusClass(runtimeOverall))}>{runtimeOverall}</span>
                  </div>
                  {lineBotStatusQuery.isError || lineBotMessage ? (
                    <div className="mt-3 rounded-[8px] border border-[#ffe8df] bg-[#fff8f6] p-3 text-[12px] font-bold text-[#c2410c]">
                      {lineBotMessage ?? "400LINE 服務狀態讀取失敗，請確認 LINE_BOT_ADMIN_TOKEN / INTERNAL_API_TOKEN 與遠端端點。"}
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {runtimeServices.map((service) => (
                      <button key={runtimeServiceName(service)} type="button" onClick={() => setSection("services")} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 text-left hover:border-[#2dd4bf]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-black text-[#10233f]">{runtimeServiceName(service)}</p>
                          <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", runtimeStatusClass(service.status))}>{runtimeStatusLabel(service.status)}</span>
                        </div>
                        <p className="mt-2 text-[12px] font-bold leading-5 text-[#637185]">{runtimeServiceMessage(service)}</p>
                        {service.latencyMs !== undefined ? <p className="mt-2 text-[11px] font-black text-[#8b9aae]">latency：{service.latencyMs}ms</p> : null}
                      </button>
                    ))}
                  </div>
                  {!lineBotStatusQuery.isLoading && !runtimeServices.length ? (
                    <div className="mt-3 rounded-[8px] bg-[#f7f9fb] p-4 text-[13px] font-bold text-[#637185]">
                      尚未取得 400LINE 即時服務清單；目前先顯示 CMS 端已知服務設定。
                    </div>
                  ) : null}
                </WorkbenchCard>

                <WorkbenchCard className="p-4">
                  <h2 className="text-[16px] font-black text-[#10233f]">CMS 已知服務設定</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {(data?.services ?? []).map((service) => (
                      <button key={service.name} type="button" onClick={() => setSection("services")} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 text-left hover:border-[#2dd4bf]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-black text-[#10233f]">{service.name}</p>
                          <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusClass(service.status))}>{statusLabel(service.status)}</span>
                        </div>
                        <p className="mt-2 text-[12px] font-bold leading-5 text-[#637185]">{service.purpose}</p>
                        <p className="mt-2 text-[11px] font-black text-[#8b9aae]">最後成功時間：等待 heartbeat</p>
                      </button>
                    ))}
                  </div>
                </WorkbenchCard>
                <WorkbenchCard className="p-4">
                  <h2 className="text-[16px] font-black text-[#10233f]">最近事件 Timeline</h2>
                  <div className="mt-3 rounded-[8px] bg-[#f7f9fb] p-4 text-[13px] font-bold text-[#637185]">
                    目前等待 400LINE 小幫手 heartbeat / trace push。CMS 端已保留此區塊，接到 webhook 後可直接顯示 error_event 與狀態變化。
                  </div>
                </WorkbenchCard>
              </>
            ) : null}

            {section === "services" ? (
              <div className="space-y-3">
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">400LINE Live Checks</h2>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {runtimeServices.map((service) => (
                    <div key={runtimeServiceName(service)} className="rounded-[8px] border border-[#edf1f6] bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-black text-[#10233f]">{runtimeServiceName(service)}</p>
                          <p className="mt-1 text-[12px] font-bold text-[#637185]">{runtimeServiceMessage(service)}</p>
                        </div>
                        <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", runtimeStatusClass(service.status))}>{runtimeStatusLabel(service.status)}</span>
                      </div>
                      <p className="mt-3 text-[11px] font-black text-[#8b9aae]">
                        {service.checkedAt ? `檢查時間：${new Date(service.checkedAt).toLocaleString("zh-TW")}` : "等待 heartbeat"}
                      </p>
                    </div>
                  ))}
                  {!lineBotStatusQuery.isLoading && !runtimeServices.length ? (
                    <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">
                      尚未接到 400LINE live checks。
                    </div>
                  ) : null}
                </div>
              </WorkbenchCard>
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">CMS 對外服務設定</h2>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {(data?.services ?? []).map((service) => (
                    <div key={service.name} className="rounded-[8px] border border-[#edf1f6] bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-black text-[#10233f]">{service.name}</p>
                          <p className="mt-1 text-[12px] font-bold text-[#637185]">{service.purpose}</p>
                        </div>
                        <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", statusClass(service.status))}>{statusLabel(service.status)}</span>
                      </div>
                      <p className="mt-3 text-[12px] font-bold text-[#536175]">呼叫方式：{service.callMethod}</p>
                      <p className="mt-2 text-[12px] font-bold text-[#536175]">必要設定：{service.credentialKeys.length ? service.credentialKeys.join(", ") : "無"}</p>
                      {service.missingCredentialKeys.length ? <p className="mt-2 text-[11px] font-black text-[#dc2626]">缺少：{service.missingCredentialKeys.join(", ")}</p> : null}
                    </div>
                  ))}
                </div>
              </WorkbenchCard>
              </div>
            ) : null}

            {section === "endpoints" ? (
              <div className="grid gap-3 xl:grid-cols-2">
                <WorkbenchCard className="p-4">
                  <h2 className="text-[16px] font-black text-[#10233f]">暴露端點</h2>
                  <div className="mt-3 space-y-2">
                    {(data?.endpoints ?? []).map((endpoint) => (
                      <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-[8px] border border-[#edf1f6] p-3">
                        <p className="font-mono text-[12px] font-black text-[#10233f]">{endpoint.method} {endpoint.path}</p>
                        <p className="mt-1 text-[12px] font-bold text-[#637185]">{endpoint.description} · {endpoint.auth}</p>
                      </div>
                    ))}
                  </div>
                </WorkbenchCard>
                <WorkbenchCard className="p-4">
                  <h2 className="text-[16px] font-black text-[#10233f]">Secrets / 環境變數</h2>
                  <div className="mt-3 space-y-3">
                    {(data?.envGroups ?? []).map((group) => (
                      <section key={group.title}>
                        <p className="text-[12px] font-black text-[#007166]">{group.title}</p>
                        <div className="mt-2 grid gap-2">
                          {group.variables.map((variable) => (
                            <div key={variable.name} className="flex items-center justify-between gap-3 rounded-[8px] border border-[#edf1f6] px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-mono text-[12px] font-black text-[#10233f]">{variable.name}</p>
                                <p className="truncate text-[11px] font-bold text-[#8b9aae]">{variable.description}</p>
                              </div>
                              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-black", statusClass(variable.status))}>{statusLabel(variable.status)}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </WorkbenchCard>
              </div>
            ) : null}

            {section === "trace" ? (
              <div className="grid gap-3 xl:grid-cols-2">
                <WorkbenchCard className="p-4">
                  <h2 className="text-[16px] font-black text-[#10233f]">訊息流 Tail</h2>
                  <div className="mt-3 rounded-[8px] bg-[#0f1b3d] p-4 font-mono text-[12px] leading-6 text-[#d9e4ef]">
                    [LIVE] 等待 GET /api/lineXBS/trace/decisions 串接<br />
                    rule_matched / hard_excluded / needs_ai_review 會顯示於此。
                  </div>
                </WorkbenchCard>
                <WorkbenchCard className="p-4">
                  <h2 className="text-[16px] font-black text-[#10233f]">錯誤 Log</h2>
                  <div className="mt-3 rounded-[8px] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#a23a48]">
                    尚未收到 400LINE error_event push。接線後依 source / level / 時間範圍過濾。
                  </div>
                </WorkbenchCard>
              </div>
            ) : null}

            {section === "push" ? (
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">推送狀態</h2>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[8px] border border-[#edf1f6] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">DASHBOARD_WEBHOOK_URL</p>
                    <p className="mt-2 text-[13px] font-black text-[#10233f]">{dashboardWebhook?.configured ? "已設定（masked）" : "未設定"}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#edf1f6] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Circuit Breaker</p>
                    <p className="mt-2 text-[13px] font-black text-[#188249]">正常</p>
                  </div>
                  <div className="rounded-[8px] border border-[#edf1f6] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">心跳紀錄</p>
                    <p className="mt-2 text-[13px] font-black text-[#536175]">{latestSnapshotAt ? new Date(latestSnapshotAt).toLocaleString("zh-TW") : "等待 400LINE push"}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">最近快照</p>
                  {lineBotSnapshotsQuery.isLoading ? <p className="text-[12px] font-bold text-[#8b9aae]">載入中…</p> : null}
                  {snapshotItems.slice(0, 6).map((snapshot, index) => {
                    const services = snapshot.services ?? snapshot.servicesJson ?? [];
                    const snappedAt = snapshot.snappedAt ?? snapshot.createdAt ?? snapshot.checkedAt;
                    return (
                      <div key={String(snapshot.id ?? index)} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                        <p className="text-[11px] font-black text-[#536175]">{snappedAt ? new Date(snappedAt).toLocaleString("zh-TW") : "未標記時間"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {services.map((service, serviceIndex) => (
                            <span key={`${runtimeServiceName(service)}-${serviceIndex}`} className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", runtimeStatusClass(service.status))}>
                              {runtimeServiceName(service)} {runtimeStatusLabel(service.status)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!lineBotSnapshotsQuery.isLoading && !snapshotItems.length ? (
                    <p className="text-[12px] font-bold text-[#8b9aae]">尚無快照記錄</p>
                  ) : null}
                </div>
              </WorkbenchCard>
            ) : null}

            {section === "whitelist" ? (
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">白名單管理</h2>
                <p className="mt-2 text-[13px] font-bold leading-6 text-[#637185]">面試 / 慎用權限與功能白名單由 CMS DB 管理，功能異動會透過 400LINE Admin API proxy 回寫到 LINE Bot。</p>
                <Link href="/system/line-whitelist" className="mt-4 inline-flex min-h-10 items-center rounded-[8px] bg-[#0f1b3d] px-4 text-[13px] font-black text-white">
                  進入白名單功能管理
                </Link>
              </WorkbenchCard>
            ) : null}
          </div>
        </div>
      </div>
    </RoleShell>
  );
}
