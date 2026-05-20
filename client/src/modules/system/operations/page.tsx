import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, FileSearch, MousePointerClick, RefreshCw, RotateCcw, Search, Send, ShieldAlert, ShieldCheck, UserRound, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet, apiPost } from "@/shared/api/client";
import { fetchAuditLogs, fetchAuditPortalAnalytics, fetchUiEventOverview } from "../audit/api";

type OpsTabKey = "actions" | "audit";

const opsTabs: Array<{ id: OpsTabKey; label: string }> = [
  { id: "actions", label: "同仁支援" },
  { id: "audit", label: "操作稽核" },
];

const readOpsTabFromUrl = (): OpsTabKey => {
  if (typeof window === "undefined") return "actions";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return opsTabs.some((t) => t.id === tab) ? (tab as OpsTabKey) : "actions";
};

type OperationUser = {
  userId: string;
  employeeNumber: string;
  name: string;
  email: string | null;
  role: string;
  activeFacility: string | null;
  grantedRoles: string[];
  grantedFacilities: string[];
  lastSeenAt: string | null;
  hasActiveSession: boolean;
};

type UserDetail = {
  identity: {
    employeeNumber: string;
    name: string;
    email: string | null;
    role: string;
    grantedRoles: string[];
    activeFacility: string | null;
    grantedFacilities: string[];
  };
  session: {
    active: boolean;
    sessionId: string | null;
    issuedAt: string | null;
    lastSeenAt: string | null;
    ip: string | null;
    userAgent: string | null;
  };
  recentAudit: Array<{ action: string; resource: string; payload: unknown; createdAt: string }>;
  recentClientErrors: Array<{ message: string; page?: string; componentId?: string; createdAt: string }>;
  recentFailedNotifications: Array<{ channel: string; target: string; errorMessage: string; createdAt: string; notificationId?: string }>;
  visibleModules: Array<{ moduleId: string; label: string; route: string; status: string }>;
};

type RecentAssist = {
  id?: number;
  action: string;
  resource: string;
  payload: unknown;
  resultStatus?: string;
  createdAt: string;
};

type OpsAction = "reset-session" | "refresh-cache" | "resend-notification";

const actionMeta: Record<OpsAction, { title: string; auditAction: string; icon: typeof RotateCcw; description: string; endpoint: (userId: string) => string }> = {
  "reset-session": {
    title: "讓他重新登入",
    auditAction: "OPS_RESET_SESSION",
    icon: RotateCcw,
    description: "適合同仁卡在登入狀態、切換角色異常、畫面一直轉圈時使用。系統會留下紀錄；此動作會讓他下次操作需要重新登入。",
    endpoint: (userId) => `/api/bff/system/operations/user/${encodeURIComponent(userId)}/reset-session`,
  },
  "refresh-cache": {
    title: "重新整理他的資料",
    auditAction: "OPS_REFRESH_CACHE",
    icon: RefreshCw,
    description: "適合同仁首頁資料舊、場館或模組沒有更新時使用。這會要求系統下次重新讀取他的首頁、場館與模組資料。",
    endpoint: (userId) => `/api/bff/system/operations/user/${encodeURIComponent(userId)}/refresh-cache`,
  },
  "resend-notification": {
    title: "重發通知",
    auditAction: "OPS_RESEND_NOTIFICATION",
    icon: Send,
    description: "適合通知寄送失敗時使用。若通知重發功能尚未接線，畫面會明確告知，仍會留下系統紀錄。",
    endpoint: (userId) => `/api/bff/system/operations/user/${encodeURIComponent(userId)}/resend-notification`,
  },
};

const payloadText = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "-";

function OpsActionDialog({
  action,
  target,
  detail,
  onClose,
}: {
  action: OpsAction | null;
  target: OperationUser | null;
  detail?: UserDetail;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [notificationId, setNotificationId] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const meta = action ? actionMeta[action] : null;
  const mutation = useMutation({
    mutationFn: async () => {
      if (!action || !target || !meta) throw new Error("missing action target");
      const body = action === "resend-notification"
        ? { reason, notificationId: notificationId || "manual-retry" }
        : { reason };
      return apiPost<{ ok: boolean; sessionsCleared?: number; keysCleared?: string[]; notificationStatus?: string; errorMessage?: string }>(meta.endpoint(target.userId), body);
    },
    onSuccess: (result) => {
      if (result.ok === false) {
        toast({ title: "協助已記錄但未完成", description: result.errorMessage ?? "系統回傳未完成狀態", variant: "destructive" });
        return;
      }
      toast({ title: `已送出：${meta?.title}`, description: "已寫入系統紀錄，使用者快照正在重新整理。" });
      queryClient.invalidateQueries({ queryKey: ["system-operations-user", target?.userId] });
      queryClient.invalidateQueries({ queryKey: ["system-operations-assists"] });
      onClose();
      setReason("");
      setNotificationId("");
    },
    onError: (error) => {
      toast({ title: "協助失敗", description: error instanceof Error ? error.message : "未知錯誤", variant: "destructive" });
    },
  });
  const Icon = meta?.icon ?? ShieldAlert;
  const failedNotifications = detail?.recentFailedNotifications ?? [];
  const canSubmit = Boolean(meta && target && reason.trim().length >= 3 && !mutation.isPending);

  return (
    <Dialog open={Boolean(action && target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] rounded-[8px] border-[#dfe7ef] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[18px] font-black text-[#10233f]">
            <Icon className="h-5 w-5 text-[#15935d]" />
            確認協助：{meta?.title}
          </DialogTitle>
          <DialogDescription className="text-[13px] font-bold leading-6 text-[#637185]">
            目標使用者：{target?.name ?? "-"}（{target?.employeeNumber ?? "-"}）
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-[8px] border border-[#dfe7ef] bg-[#f8fbff] p-3 text-[13px] font-bold leading-6 text-[#536175]">
            {meta?.description}
          </div>
          {action === "resend-notification" ? (
            <label className="grid gap-1.5 text-[12px] font-black text-[#536175]">
              要重發的通知
              <select
                value={notificationId}
                onChange={(event) => setNotificationId(event.target.value)}
                className="min-h-10 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold text-[#10233f]"
              >
                <option value="">手動重發（通知系統尚未接線）</option>
                {failedNotifications.map((item, index) => (
                  <option key={`${item.notificationId ?? index}`} value={item.notificationId ?? String(index)}>
                    {item.channel} · {item.target} · {item.errorMessage}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1.5 text-[12px] font-black text-[#536175]">
            協助原因（必填，至少 3 字）
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="resize-none rounded-[6px] border border-[#dfe7ef] bg-white p-3 text-[13px] font-bold leading-6 text-[#10233f] outline-none focus:border-[#15935d]"
              placeholder="例如：同仁首頁資料卡住，主管要求協助重新整理。"
            />
          </label>
          <div className="flex items-center gap-2 rounded-[8px] border border-[#f2dda8] bg-[#fff9ed] p-3 text-[12px] font-black text-[#9a6500]">
            <AlertTriangle className="h-4 w-4" />
            此動作將被記錄於系統紀錄。
          </div>
          {mutation.isError ? (
            <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-3 text-[12px] font-black text-[#dc2626]">
              {mutation.error instanceof Error ? mutation.error.message : "協助失敗，請調整原因後重試。"}
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="min-h-9 rounded-[4px] border border-[#dfe7ef] px-4 text-[12px] font-black text-[#536175]">
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
            className="min-h-9 rounded-[4px] bg-[#0d2a50] px-4 text-[12px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#c7d0dc]"
          >
            {mutation.isPending ? "處理中..." : "確認協助"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SystemOperationsPage() {
  const [tab, setTabState] = useState<OpsTabKey>(() => readOpsTabFromUrl());
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<OperationUser | null>(null);
  const [action, setAction] = useState<OpsAction | null>(null);

  const setTab = (next: OpsTabKey) => {
    setTabState(next);
    if (typeof window === "undefined") return;
    const search = next === "actions" ? "" : `?tab=${next}`;
    window.history.replaceState(null, "", `/system/operations${search}`);
  };
  const searchQuery = useQuery({
    queryKey: ["system-operations-search", submittedQuery],
    queryFn: () => apiGet<{ items: OperationUser[] }>(`/api/bff/system/operations/user-search?q=${encodeURIComponent(submittedQuery)}`),
    enabled: submittedQuery.trim().length > 0,
  });
  const detailQuery = useQuery({
    queryKey: ["system-operations-user", selectedUser?.userId],
    queryFn: () => apiGet<UserDetail>(`/api/bff/system/operations/user/${encodeURIComponent(selectedUser!.userId)}`),
    enabled: Boolean(selectedUser?.userId),
  });
  const assistsQuery = useQuery({
    queryKey: ["system-operations-assists"],
    queryFn: () => apiGet<{ items: RecentAssist[] }>("/api/bff/system/operations/recent-assists?limit=50"),
  });
  const detail = detailQuery.data;
  const isSystemTarget = selectedUser?.role === "system" || selectedUser?.grantedRoles.includes("system");
  const actionButtons = useMemo(() => (Object.keys(actionMeta) as OpsAction[]), []);

  return (
    <RoleShell role="system" title="遠維協助" subtitle="CMS 內部 · 同仁支援 + 操作稽核">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-operations-page">
        <WorkbenchCard className="p-2">
          <div className="flex flex-wrap gap-2">
            {opsTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "min-h-10 rounded-[8px] px-4 text-[13px] font-black transition",
                  tab === item.id ? "bg-[#0d2a50] text-white" : "bg-white text-[#637185] hover:bg-[#f3f6fb]",
                )}
                data-testid={`ops-tab-${item.id}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </WorkbenchCard>

        {tab === "audit" ? <OpsAuditPanel /> : null}

        {tab === "actions" ? (
          <>
        <WorkbenchCard className="p-3.5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="grid flex-1 gap-1 text-[12px] font-black text-[#536175]">
              搜尋同仁
              <div className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
                <Search className="h-4 w-4 text-[#8b9aae]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSubmittedQuery(query);
                  }}
                  className="min-h-9 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none"
                  placeholder="輸入員編、姓名或信箱..."
                />
              </div>
            </label>
            <button
              type="button"
              onClick={() => setSubmittedQuery(query)}
              className="min-h-10 rounded-[4px] bg-[#0d2a50] px-5 text-[13px] font-black text-white"
            >
              搜尋
            </button>
          </div>
        </WorkbenchCard>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <WorkbenchCard className="overflow-hidden p-0">
            <div className="border-b border-[#edf1f6] p-3.5">
              <p className="text-[16px] font-black text-[#10233f]">搜尋結果</p>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">點選同仁後，右側會顯示目前狀態與可協助項目。</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {(searchQuery.data?.items ?? []).map((user) => (
                <button
                  type="button"
                  key={user.userId}
                  onClick={() => setSelectedUser(user)}
                  className={cn(
                    "grid min-h-11 w-full grid-cols-[1fr_90px_70px] items-center gap-2 border-b border-[#edf1f6] px-3.5 text-left text-[12px] transition hover:bg-[#fbfcfd]",
                    selectedUser?.userId === user.userId && "bg-[#ecf8f2]",
                  )}
                >
                  <span>
                    <span className="block truncate font-black text-[#10233f]">{user.name}</span>
                    <span className="block truncate font-bold text-[#637185]">{user.employeeNumber}</span>
                  </span>
                  <span className="truncate font-bold text-[#536175]">{user.activeFacility ?? "-"}</span>
                  <span className={cn("w-fit rounded-full px-2 py-1 text-[10px] font-black", user.hasActiveSession ? "bg-[#e8f7ef] text-[#15935d]" : "bg-[#edf1f6] text-[#637185]")}>
                    {user.hasActiveSession ? "使用中" : "閒置"}
                  </span>
                </button>
              ))}
              {searchQuery.isLoading ? <div className="p-4 text-[13px] font-bold text-[#637185]">搜尋中...</div> : null}
              {!searchQuery.isLoading && !(searchQuery.data?.items ?? []).length ? (
                <div className="p-4 text-[13px] font-bold text-[#8b9aae]">請先輸入查詢條件。</div>
              ) : null}
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="overflow-hidden p-0">
            <div className="grid gap-3 border-b border-[#edf1f6] p-3.5 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="text-[16px] font-black text-[#10233f]">同仁狀態</p>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">身分、登入狀態、可用功能與協助動作</p>
              </div>
              {selectedUser ? (
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  {actionButtons.map((key) => {
                    const meta = actionMeta[key];
                    const Icon = meta.icon;
                    return (
                      <button
                        type="button"
                        key={key}
                        disabled={isSystemTarget}
                        title={isSystemTarget ? "不可對系統管理員介入；系統管理員帳號不允許互相操作" : meta.title}
                        onClick={() => setAction(key)}
                        className="inline-flex min-h-9 items-center gap-2 rounded-[4px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] disabled:cursor-not-allowed disabled:bg-[#f3f6fb] disabled:text-[#9aa7b8]"
                      >
                        <Icon className="h-4 w-4" />
                        {meta.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {selectedUser ? (
              <div className="grid gap-3 p-3.5 lg:grid-cols-[260px_1fr]">
                <div className="space-y-3">
                  <div className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
                    <UserRound className="h-6 w-6 text-[#15935d]" />
                    <p className="mt-2 text-[15px] font-black text-[#10233f]">{selectedUser.name}</p>
                    <p className="text-[12px] font-bold text-[#637185]">{selectedUser.employeeNumber}</p>
                    <div className="mt-3 grid gap-1 text-[12px] font-bold text-[#536175]">
                      <span>目前角色：{detail?.identity.role ?? selectedUser.role}</span>
                      <span>目前場館：{detail?.identity.activeFacility ?? selectedUser.activeFacility ?? "-"}</span>
                      <span>登入狀態：{detail?.session.active ? "使用中" : "未使用"}</span>
                      <span>最後活動：{formatTime(detail?.session.lastSeenAt ?? selectedUser.lastSeenAt)}</span>
                    </div>
                  </div>
                  {isSystemTarget ? (
                    <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-3 text-[12px] font-black leading-5 text-[#dc2626]">
                      不可對系統管理員介入；系統管理員帳號不允許互相操作。
                    </div>
                  ) : null}
                </div>

                <Tabs defaultValue="audit" className="min-w-0">
                  <TabsList className="h-9 rounded-[8px] bg-[#edf1f6] p-1">
                    <TabsTrigger value="audit" className="h-7 text-[12px]">近期紀錄</TabsTrigger>
                    <TabsTrigger value="errors" className="h-7 text-[12px]">錯誤回報</TabsTrigger>
                    <TabsTrigger value="notifications" className="h-7 text-[12px]">通知狀態</TabsTrigger>
                    <TabsTrigger value="modules" className="h-7 text-[12px]">可用功能</TabsTrigger>
                  </TabsList>
                  <TabsContent value="audit" className="mt-3">
                    <CompactRows
                      rows={detail?.recentAudit ?? []}
                      empty="尚無相關系統紀錄。"
                      render={(row) => (
                        <>
                          <span className="font-black text-[#10233f]">{row.action}</span>
                          <span className="truncate text-[#637185]">{row.resource}</span>
                          <span className="text-right text-[#8b9aae]">{formatTime(row.createdAt)}</span>
                        </>
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="errors" className="mt-3">
                    <CompactRows
                      rows={detail?.recentClientErrors ?? []}
                      empty="尚無前端錯誤回報。"
                      render={(row) => (
                        <>
                          <span className="font-black text-[#dc2626]">{row.message}</span>
                          <span className="truncate text-[#637185]">{row.page ?? row.componentId ?? "-"}</span>
                          <span className="text-right text-[#8b9aae]">{formatTime(row.createdAt)}</span>
                        </>
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="notifications" className="mt-3">
                    <CompactRows
                      rows={detail?.recentFailedNotifications ?? []}
                      empty="目前沒有通知重發系統或失敗通知。"
                      render={(row) => (
                        <>
                          <span className="font-black text-[#10233f]">{row.channel}</span>
                          <span className="truncate text-[#637185]">{row.target}</span>
                          <span className="text-right text-[#dc2626]">{row.errorMessage}</span>
                        </>
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="modules" className="mt-3">
                    <CompactRows
                      rows={detail?.visibleModules ?? []}
                      empty="沒有可見功能。"
                      render={(row) => (
                        <>
                          <span className="font-black text-[#10233f]">{row.label}</span>
                          <span className="truncate text-[#637185]">{row.route}</span>
                          <span className="text-right text-[#8b9aae]">{row.status}</span>
                        </>
                      )}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="p-6 text-center text-[13px] font-bold text-[#8b9aae]">選擇搜尋結果後顯示同仁狀態。</div>
            )}
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[#edf1f6] p-3.5">
            <div>
              <p className="text-[16px] font-black text-[#10233f]">最近協助紀錄</p>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">每一次協助都會留下時間、對象與原因。</p>
            </div>
          </div>
          <CompactRows
            rows={assistsQuery.data?.items ?? []}
            empty="尚無協助紀錄。"
            render={(row) => (
              <>
                <span className="font-black text-[#10233f]">{row.action}</span>
                <span className="truncate text-[#637185]">{row.resultStatus ?? "-"}</span>
                <span className="text-right text-[#8b9aae]">{formatTime(row.createdAt)}</span>
              </>
            )}
          />
        </WorkbenchCard>

          </>
        ) : null}

        <OpsActionDialog action={action} target={selectedUser} detail={detail} onClose={() => setAction(null)} />
      </div>
    </RoleShell>
  );
}

function OpsAuditPanel() {
  const uiQuery = useQuery({ queryKey: ["/api/bff/system/ui-event-overview"], queryFn: fetchUiEventOverview });
  const analyticsQuery = useQuery({ queryKey: ["/api/portal/analytics", "audit"], queryFn: fetchAuditPortalAnalytics });
  const auditLogsQuery = useQuery({ queryKey: ["/api/audit/logs"], queryFn: fetchAuditLogs });
  const analytics = analyticsQuery.data;
  const metrics: readonly (readonly [label: string, value: number, Icon: LucideIcon, tone: string])[] = [
    ["UI 事件", uiQuery.data?.totalEvents ?? 0, MousePointerClick, "text-[#2f6fe8]"],
    ["Client Errors", uiQuery.data?.totalClientErrors ?? 0, Activity, "text-[#ff4964]"],
    ["Portal Events", analytics?.totalEvents ?? 0, ShieldCheck, "text-[#15935d]"],
    ["使用者", analytics?.topEmployees?.length ?? 0, Users, "text-[#10233f]"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {metrics.map(([label, value, Icon, tone]) => (
          <WorkbenchCard key={label} className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">{label}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className={`text-[26px] font-black ${tone}`}>{value}</p>
              <Icon className="h-5 w-5 text-[#2f6fe8]" />
            </div>
          </WorkbenchCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkbenchCard className="p-5">
          <h2 className="mb-4 text-[15px] font-black">事件類型</h2>
          <div className="space-y-3">
            {(analytics?.byType ?? []).map((item) => (
              <div key={item.eventType} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                <FileSearch className="h-4 w-4 text-[#2f6fe8]" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-black text-[#10233f]">{item.eventType}</span>
                <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
              </div>
            ))}
            {!analytics?.byType?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無事件類型資料。</div> : null}
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="p-5">
          <h2 className="mb-4 text-[15px] font-black">高頻使用者</h2>
          <div className="space-y-3">
            {(analytics?.topEmployees ?? []).slice(0, 8).map((item, index) => (
              <div key={`${item.employeeNumber}-${index}`} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef5ff] text-[11px] font-black text-[#2f6fe8]">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-[#10233f]">{item.employeeName ?? "未知使用者"}</p>
                  <p className="text-[11px] font-bold text-[#8b9aae]">{item.employeeNumber ?? "無員編"}</p>
                </div>
                <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
              </div>
            ))}
            {!analytics?.topEmployees?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無使用者稽核資料。</div> : null}
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="p-5 xl:col-span-2">
          <h2 className="mb-4 text-[15px] font-black">Audit Logs</h2>
          <div className="space-y-3">
            {(auditLogsQuery.data?.items ?? []).map((item) => (
              <div key={`${item.id ?? item.timestamp}-${item.action}`} className="grid gap-2 rounded-[8px] bg-[#fbfcfd] p-3 md:grid-cols-[1fr_150px_120px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[#10233f]">{item.action}</p>
                  <p className="truncate text-[11px] font-bold text-[#8b9aae]">{item.resource}{item.resourceId ? ` / ${item.resourceId}` : ""}</p>
                </div>
                <p className="text-[12px] font-bold text-[#637185]">{item.actorId ?? "system"}</p>
                <p className="text-[12px] font-black text-[#10233f]">{item.resultStatus ?? "success"}</p>
              </div>
            ))}
            {!auditLogsQuery.data?.items?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無 audit log 資料。</div> : null}
          </div>
        </WorkbenchCard>
      </div>
    </div>
  );
}

function CompactRows<T>({
  rows,
  empty,
  render,
}: {
  rows: T[];
  empty: string;
  render: (row: T) => ReactNode;
}) {
  if (!rows.length) {
    return <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-center text-[13px] font-bold text-[#8b9aae]">{empty}</div>;
  }
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#edf1f6]">
      {rows.map((row, index) => (
        <div key={index} className="grid min-h-11 grid-cols-[1fr_1fr_150px] items-center gap-3 border-b border-[#edf1f6] px-3 text-[12px] font-bold last:border-b-0">
          {render(row)}
        </div>
      ))}
    </div>
  );
}
