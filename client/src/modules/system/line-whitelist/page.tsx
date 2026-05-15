import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ChevronDown, ChevronLeft, ChevronUp, Clock, History, Search, ShieldCheck, SlidersHorizontal, Trash2, UserPlus, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { LINE_FEATURES } from "@shared/system/line-feature-whitelist";
import {
  createCautionPermission,
  createLineBotVipEntry,
  createLineWhitelistEntry,
  deleteLineBotVipEntry,
  deleteLineWhitelistEntry,
  fetchCautionPermissionAudit,
  fetchCautionPermissions,
  fetchLineBotServiceStatus,
  fetchLineBotServiceStatusSnapshots,
  fetchLineBotVipWhitelist,
  fetchLineWhitelist,
  searchCautionCandidates,
  searchLineWhitelistCandidates,
  updateCautionPermissionPeriod,
  updateCautionPermissionStatus,
  updateLineWhitelistEntry,
  type CautionCandidate,
  type CautionPermission,
  type LineWhitelistCandidate,
  type LineWhitelistEntry,
  type VipWhitelistEntry,
} from "./api";

const whitelistQueryKey = ["/api/bff/system/line-whitelist"];
const cautionQueryKey = ["/api/cms/system/caution-permissions"];
const tabs = ["慎用查詢", "主管白名單", "公告 VIP", "群組 tier"] as const;

const dateValue = (v?: string | null) => v ? v.slice(0, 10).replaceAll("-", "/") : "";
const inputDateValue = (v?: string | null) => v ? v.slice(0, 10) : "";
const maskPhone = (phone?: string | null) => phone ? phone.replace(/(\d{4})\d+(\d{3})$/, "$1***$2") : "-";

const cautionStatusCopy: Record<string, { label: string; className: string }> = {
  active: { label: "● 啟用", className: "bg-[#e9f8df] text-[#188249]" },
  expiring_soon: { label: "⚠ 即將到期", className: "bg-[#fff6e7] text-[#ca8a04]" },
  expired: { label: "⚠ 已過期", className: "bg-[#ffe8df] text-[#c2410c]" },
  disabled: { label: "○ 已停用", className: "bg-[#eef2f6] text-[#536175]" },
  not_yet_effective: { label: "尚未生效", className: "bg-[#eef2ff] text-[#3b82f6]" },
};

const svcColor: Record<string, string> = {
  up: "bg-[#e9f8df] text-[#188249]",
  down: "bg-[#ffe8df] text-[#c2410c]",
  degraded: "bg-[#fff6e7] text-[#ca8a04]",
  unknown: "bg-[#eef2f6] text-[#536175]",
};

function HistoryDrawer({ entry, open, onClose }: { entry: CautionPermission | null; open: boolean; onClose: () => void }) {
  const auditQuery = useQuery({
    queryKey: ["/api/cms/system/caution-permissions/audit", entry?.id],
    queryFn: () => fetchCautionPermissionAudit(entry!.id),
    enabled: open && Boolean(entry),
  });
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[620px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[#10233f]"><History className="h-5 w-5" /> {entry?.displayName ?? "權限"} — 權限歷史</SheetTitle>
          <SheetDescription>核發、停用、期限變更與 LINE 小幫手實際使用紀錄。</SheetDescription>
        </SheetHeader>
        {entry ? (
          <div className="mt-5 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[13px] font-black text-[#10233f]">{entry.department ?? "-"} · {entry.position ?? "-"}</p>
            <p className="mt-1 font-mono text-[12px] font-black text-[#536175]">{entry.userId}</p>
            <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{maskPhone(entry.phone)}</p>
          </div>
        ) : null}
        <div className="mt-5 space-y-3">
          {(auditQuery.data?.items ?? []).map((item) => (
            <div key={item.id} className="rounded-[8px] border border-[#edf1f6] bg-white p-3">
              <p className="text-[13px] font-black text-[#10233f]">{item.action}</p>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">操作：{item.actor} · {new Date(item.createdAt).toLocaleString("zh-TW")}</p>
              {item.metadata ? <pre className="mt-2 overflow-x-auto rounded-[6px] bg-[#f7f9fb] p-2 text-[11px] text-[#536175]">{JSON.stringify(item.metadata, null, 2)}</pre> : null}
            </div>
          ))}
          {!auditQuery.isLoading && !(auditQuery.data?.items ?? []).length ? (
            <div className="rounded-[8px] bg-[#f7f9fb] p-4 text-center text-[12px] font-bold text-[#8b9aae]">尚無歷史紀錄。</div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PermissionCard({ entry, onHistory }: { entry: CautionPermission; onHistory: (e: CautionPermission) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [periodType, setPeriodType] = useState<"unlimited" | "range" | "today_only">(entry.permissionEndAt ? "range" : "unlimited");
  const [startAt, setStartAt] = useState(inputDateValue(entry.permissionStartAt));
  const [endAt, setEndAt] = useState(inputDateValue(entry.permissionEndAt));
  const [reason, setReason] = useState("");
  const ui = cautionStatusCopy[entry.status] ?? cautionStatusCopy.disabled;
  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => updateCautionPermissionStatus(entry.id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cautionQueryKey }),
  });
  const periodMutation = useMutation({
    mutationFn: () => updateCautionPermissionPeriod(entry.id, { periodType, periodStartAt: startAt || null, periodEndAt: endAt || null, changeReason: reason }),
    onSuccess: () => { setEditing(false); setReason(""); queryClient.invalidateQueries({ queryKey: cautionQueryKey }); },
  });
  return (
    <WorkbenchCard className="p-4">
      <div className="grid gap-3 xl:grid-cols-[1fr_220px_120px_180px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-black text-[#10233f]">{entry.displayName}</h3>
            <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", ui.className)}>{ui.label}</span>
          </div>
          <p className="mt-1 font-mono text-[12px] font-black text-[#536175]">{entry.userId}</p>
          <p className="mt-1 text-[12px] font-bold text-[#637185]">{entry.department ?? "-"} · {entry.position ?? "-"} · {maskPhone(entry.phone)}</p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">授權期限</p>
          <p className="mt-1 text-[12px] font-black text-[#10233f]">
            {entry.permissionEndAt ? `${dateValue(entry.permissionStartAt) || "立即"} ~ ${dateValue(entry.permissionEndAt)}` : "無期限"}
          </p>
        </div>
        <label className="flex items-center gap-2">
          <Switch checked={entry.isActive} onCheckedChange={(v) => statusMutation.mutate(v)} />
          <span className="text-[12px] font-black text-[#536175]">{entry.isActive ? "啟用" : "停用"}</span>
        </label>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-[8px] border border-[#dfe7ef] px-3 py-2 text-[12px] font-black text-[#10233f]">編輯期限</button>
          <button type="button" onClick={() => onHistory(entry)} className="rounded-[8px] border border-[#dfe7ef] px-3 py-2 text-[12px] font-black text-[#10233f]">查看歷史</button>
        </div>
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 lg:grid-cols-[160px_1fr_1fr_1.4fr_auto] lg:items-end">
          <label className="grid gap-1">
            <span className="text-[11px] font-black text-[#8b9aae]">授權類型</span>
            <select value={periodType} onChange={(e) => setPeriodType(e.target.value as typeof periodType)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
              <option value="unlimited">無期限</option>
              <option value="range">指定期間</option>
              <option value="today_only">僅今日內測試</option>
            </select>
          </label>
          <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold" />
          <input type="date" value={endAt} disabled={periodType !== "range"} onChange={(e) => setEndAt(e.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold disabled:opacity-50" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="變更原因，至少 5 字" className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold" />
          <button type="button" disabled={reason.trim().length < 5 || periodMutation.isPending} onClick={() => periodMutation.mutate()} className="h-10 rounded-[8px] bg-[#0f1b3d] px-4 text-[12px] font-black text-white disabled:opacity-50">儲存</button>
        </div>
      ) : null}
    </WorkbenchCard>
  );
}

function WhitelistEntryCard({ entry, onDelete }: { entry: LineWhitelistEntry; onDelete: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>(entry.featureAccess);
  const updateMutation = useMutation({
    mutationFn: (payload: { status?: "active" | "disabled"; featureAccess?: Record<string, boolean> }) =>
      updateLineWhitelistEntry(entry.id, { ...payload, unlimited: entry.unlimited }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whitelistQueryKey }),
  });
  const toggleFeature = (key: string, value: boolean) => {
    const next = { ...localFeatures, [key]: value };
    setLocalFeatures(next);
    updateMutation.mutate({ featureAccess: next });
  };
  return (
    <WorkbenchCard className="p-4">
      <div className="grid gap-3 xl:grid-cols-[1fr_160px_120px_80px] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-black text-[#10233f]">{entry.displayName}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", entry.status === "active" ? "bg-[#e9f8df] text-[#188249]" : "bg-[#eef2f6] text-[#536175]")}>
              {entry.status === "active" ? "● 啟用" : "○ 停用"}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] font-black text-[#536175]">{entry.lineUserId}</p>
          <p className="mt-0.5 text-[11px] font-bold text-[#8b9aae]">{entry.department ?? "-"}{entry.employeeNumber ? ` · #${entry.employeeNumber}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {LINE_FEATURES.map((f) => (
            <span key={f.key} className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", localFeatures[f.key] ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#f3f6fb] text-[#8b9aae]")}>
              {f.label}
            </span>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <Switch checked={entry.status === "active"} onCheckedChange={(v) => updateMutation.mutate({ status: v ? "active" : "disabled" })} />
          <span className="text-[12px] font-black text-[#536175]">{entry.status === "active" ? "啟用" : "停用"}</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-[8px] border border-[#dfe7ef] px-3 py-2 text-[12px] font-black text-[#10233f]">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => { if (window.confirm(`確定要刪除 ${entry.displayName} 的白名單授權？`)) onDelete(entry.id); }}
            className="rounded-[8px] border border-[#ffe8df] px-3 py-2 text-[12px] font-black text-[#c2410c] hover:bg-[#ffe8df]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 grid gap-2 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINE_FEATURES.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 rounded-[6px] border border-[#edf1f6] bg-white p-2">
              <div>
                <p className="text-[12px] font-black text-[#10233f]">{f.label}</p>
                <p className="text-[10px] font-bold text-[#8b9aae]">{f.description}</p>
              </div>
              <Switch checked={Boolean(localFeatures[f.key])} onCheckedChange={(v) => toggleFeature(f.key, v)} />
            </label>
          ))}
          {entry.notes ? <p className="col-span-full text-[11px] font-bold text-[#8b9aae]">備註：{entry.notes}</p> : null}
          <p className="col-span-full text-[10px] font-bold text-[#8b9aae]">最後更新：{new Date(entry.updatedAt).toLocaleString("zh-TW")}</p>
        </div>
      ) : null}
    </WorkbenchCard>
  );
}

function LineBotServiceHealthPanel() {
  const [showSnapshots, setShowSnapshots] = useState(false);
  const statusQuery = useQuery({
    queryKey: ["/api/bff/system/line-bot/service-status"],
    queryFn: fetchLineBotServiceStatus,
    refetchInterval: 30_000,
    retry: 1,
  });
  const snapshotsQuery = useQuery({
    queryKey: ["/api/bff/system/line-bot/service-status/snapshots"],
    queryFn: fetchLineBotServiceStatusSnapshots,
    enabled: showSnapshots,
    retry: 1,
  });

  const raw = statusQuery.data as Record<string, unknown> | undefined;
  const services: Array<{ name: string; status?: string; message?: string; latencyMs?: number }> =
    Array.isArray(raw?.services)
      ? raw.services as Array<{ name: string; status?: string }>
      : raw
        ? Object.entries(raw)
            .filter(([k]) => !["generatedAt", "checkedAt", "message"].includes(k))
            .map(([name, val]) =>
              val && typeof val === "object" && "status" in val
                ? { name, ...(val as object) }
                : { name, status: typeof val === "string" ? val : "unknown" },
            )
        : [];

  return (
    <WorkbenchCard className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#536175]" />
          <h2 className="text-[15px] font-black text-[#10233f]">LINE Bot 服務健康</h2>
          {statusQuery.isFetching ? <span className="text-[11px] font-bold text-[#8b9aae]">更新中…</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {raw?.checkedAt || raw?.generatedAt ? (
            <span className="text-[11px] font-bold text-[#8b9aae]">
              {new Date(String(raw.checkedAt ?? raw.generatedAt)).toLocaleTimeString("zh-TW")} 更新
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowSnapshots((v) => !v)}
            className="flex items-center gap-1 rounded-[8px] border border-[#dfe7ef] px-3 py-1.5 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]"
          >
            {showSnapshots ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            快照歷史
          </button>
        </div>
      </div>

      {(raw as { message?: string } | undefined)?.message ? (
        <div className="mt-3 rounded-[8px] border border-[#ffe8df] bg-[#fff8f6] p-3 text-[12px] font-bold text-[#c2410c]">
          {(raw as { message?: string }).message}
        </div>
      ) : null}

      {services.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {services.map((svc, i) => {
            const color = svcColor[svc.status ?? "unknown"] ?? svcColor.unknown;
            return (
              <div key={i} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black", color)}>
                <span>{svc.name}</span>
                <span className="opacity-60">·</span>
                <span className="uppercase">{svc.status ?? "?"}</span>
                {svc.latencyMs ? <span className="text-[10px] opacity-60">{svc.latencyMs}ms</span> : null}
              </div>
            );
          })}
        </div>
      ) : !statusQuery.isLoading ? (
        <p className="mt-3 text-[12px] font-bold text-[#8b9aae]">
          {statusQuery.isError ? "服務狀態查詢失敗，請確認 LINE Bot 連線" : "未設定 LINE_BOT_ADMIN_TOKEN 或服務健康端點無回應"}
        </p>
      ) : null}

      {showSnapshots ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">快照歷史</p>
          {snapshotsQuery.isLoading ? <p className="text-[12px] font-bold text-[#8b9aae]">載入中…</p> : null}
          {(snapshotsQuery.data?.items ?? []).slice(0, 10).map((snap, i) => (
            <div key={i} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
              <p className="text-[11px] font-black text-[#536175]">{new Date(snap.createdAt).toLocaleString("zh-TW")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {((snap.services as Array<{ name?: string; status?: string }> | undefined) ?? []).map((svc, j) => {
                  const color = svcColor[svc.status ?? "unknown"] ?? svcColor.unknown;
                  return (
                    <span key={j} className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", color)}>
                      {svc.name ?? `服務${j + 1}`} {svc.status ?? "?"}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {!snapshotsQuery.isLoading && !(snapshotsQuery.data?.items ?? []).length ? (
            <p className="text-[12px] font-bold text-[#8b9aae]">尚無快照記錄</p>
          ) : null}
        </div>
      ) : null}
    </WorkbenchCard>
  );
}

export default function SystemLineWhitelistPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("慎用查詢");

  const [cautionStatus, setCautionStatus] = useState("all");
  const [dept, setDept] = useState("");
  const [query, setQuery] = useState("");
  const [candidateQueryText, setCandidateQueryText] = useState("");
  const [selected, setSelected] = useState<CautionCandidate | null>(null);
  const [periodType, setPeriodType] = useState<"unlimited" | "range" | "today_only">("unlimited");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");
  const [historyEntry, setHistoryEntry] = useState<CautionPermission | null>(null);

  const [vipUserId, setVipUserId] = useState("");
  const [vipDisplayName, setVipDisplayName] = useState("");

  const [ragicQuery, setRagicQuery] = useState("");
  const [ragicSelected, setRagicSelected] = useState<LineWhitelistCandidate | null>(null);
  const [manualLineUserId, setManualLineUserId] = useState("");
  const [wlFeatures, setWlFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(LINE_FEATURES.map((f) => [f.key, false])),
  );
  const [wlNotes, setWlNotes] = useState("");
  const [wlSearch, setWlSearch] = useState("");

  const permissionsQuery = useQuery({
    queryKey: [...cautionQueryKey, cautionStatus, dept, query],
    queryFn: () => fetchCautionPermissions({ status: cautionStatus, dept, q: query }),
  });
  const candidateQuery = useQuery({
    queryKey: ["/api/cms/system/caution-permissions/candidates", candidateQueryText],
    queryFn: () => searchCautionCandidates(candidateQueryText),
    enabled: candidateQueryText.trim().length > 0,
  });

  const whitelistQuery = useQuery({
    queryKey: whitelistQueryKey,
    queryFn: fetchLineWhitelist,
    enabled: activeTab === "主管白名單",
  });

  const vipQueryKey = ["/api/bff/system/line-bot/vip-whitelist"];
  const vipListQuery = useQuery({
    queryKey: vipQueryKey,
    queryFn: fetchLineBotVipWhitelist,
    enabled: activeTab === "公告 VIP",
    retry: 1,
  });
  const vipItems: VipWhitelistEntry[] = (() => {
    const raw = vipListQuery.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && "items" in raw) return (raw as { items: VipWhitelistEntry[] }).items;
    return [];
  })();

  const createVipMutation = useMutation({
    mutationFn: createLineBotVipEntry,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: vipQueryKey }); setVipUserId(""); setVipDisplayName(""); },
  });
  const deleteVipMutation = useMutation({
    mutationFn: deleteLineBotVipEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vipQueryKey }),
  });
  const ragicCandidateQuery = useQuery({
    queryKey: ["/api/bff/system/line-whitelist/candidates", ragicQuery],
    queryFn: () => searchLineWhitelistCandidates(ragicQuery),
    enabled: ragicQuery.trim().length >= 2,
  });

  const createCautionMutation = useMutation({
    mutationFn: createCautionPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cautionQueryKey });
      setSelected(null); setCandidateQueryText(""); setNote(""); setPeriodType("unlimited"); setStartAt(""); setEndAt("");
    },
  });

  const createWlMutation = useMutation({
    mutationFn: createLineWhitelistEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whitelistQueryKey });
      setRagicSelected(null); setManualLineUserId(""); setRagicQuery(""); setWlNotes("");
      setWlFeatures(Object.fromEntries(LINE_FEATURES.map((f) => [f.key, f.key === "interview"])));
    },
  });

  const deleteWlMutation = useMutation({
    mutationFn: deleteLineWhitelistEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whitelistQueryKey }),
  });

  const cautionSummary = permissionsQuery.data?.summary;
  const cautionCanSubmit = Boolean(selected) && permissionsQuery.data?.storageStatus !== "schema_pending";
  const cautionPeriodEnd = useMemo(() => {
    if (periodType === "today_only") return "24 小時後自動失效";
    if (periodType === "range") return endAt || "尚未指定迄日";
    return "無期限";
  }, [endAt, periodType]);

  const effectiveLineUserId = ragicSelected
    ? (ragicSelected.lineUserId && ragicSelected.lineUserId !== ragicSelected.employeeNumber ? ragicSelected.lineUserId : manualLineUserId)
    : manualLineUserId;
  const needsManualId = ragicSelected
    ? !ragicSelected.lineUserId || ragicSelected.lineUserId === ragicSelected.employeeNumber
    : true;
  const wlCanSubmit = Boolean(ragicSelected?.displayName) && effectiveLineUserId.trim().length > 0 && whitelistQuery.data?.storageStatus !== "schema_pending";

  const filteredWhitelist = useMemo(() => {
    const q = wlSearch.trim().toLowerCase();
    return (whitelistQuery.data?.items ?? []).filter((item) => {
      if (!q) return true;
      return `${item.displayName} ${item.lineUserId} ${item.employeeNumber ?? ""} ${item.department ?? ""}`.toLowerCase().includes(q);
    });
  }, [whitelistQuery.data?.items, wlSearch]);

  return (
    <RoleShell role="system" title="400 LINE 白名單管理" subtitle="CAUTION QUERY PERMISSIONS">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-line-whitelist-page">
        <Link href="/system" className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
          <ChevronLeft className="h-4 w-4" />
          回控制中心
        </Link>

        <div className="flex flex-wrap gap-2 rounded-[8px] border border-[#dfe7ef] bg-white p-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("rounded-full px-3 py-2 text-[12px] font-black", activeTab === tab ? "bg-[#0f1b3d] text-white" : "text-[#536175] hover:bg-[#f3f6fb]")}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "慎用查詢" ? (
          <>
            {permissionsQuery.data?.storageStatus === "schema_pending" ? (
              <div className="rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[13px] font-black text-[#8a5a00]">
                慎用查詢權限資料表尚未建立：請套用 migrations/0012_caution_query_permissions.sql 或執行 db:push 後即可寫入。
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-5">
              {[
                { label: "授權人員", value: cautionSummary?.total ?? 0, icon: Users },
                { label: "啟用中", value: cautionSummary?.active ?? 0, icon: ShieldCheck },
                { label: "即將到期", value: cautionSummary?.expiringSoon ?? 0, icon: Clock },
                { label: "已過期", value: cautionSummary?.expired ?? 0, icon: Search },
                { label: "已停用", value: cautionSummary?.disabled ?? 0, icon: SlidersHorizontal },
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

            <div className="grid gap-3 xl:grid-cols-[430px_1fr]">
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">新增授權人員</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">從疆域/Ragic 員工資料搜尋，已啟用授權者不會重複出現。</p>
                <input
                  value={candidateQueryText}
                  onChange={(e) => setCandidateQueryText(e.target.value)}
                  placeholder="搜尋姓名 / 部門 / 電話 / userId"
                  className="mt-4 h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]"
                />
                <div className="mt-3 max-h-[280px] overflow-y-auto rounded-[8px] border border-[#edf1f6]">
                  {(candidateQuery.data?.items ?? []).map((candidate) => (
                    <button key={candidate.userId} type="button" onClick={() => setSelected(candidate)} className={cn("block w-full border-b border-[#edf1f6] p-3 text-left last:border-b-0 hover:bg-[#fbfcfd]", selected?.userId === candidate.userId && "bg-[#ecfeff]")}>
                      <p className="text-[13px] font-black text-[#10233f]">{candidate.displayName} <span className="text-[11px] text-[#8b9aae]">{candidate.position}</span></p>
                      <p className="mt-1 font-mono text-[11px] font-black text-[#536175]">{candidate.userId}</p>
                      <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">{maskPhone(candidate.phone)} · {candidate.department || "-"}</p>
                    </button>
                  ))}
                  {candidateQueryText.trim() && !candidateQuery.isFetching && !(candidateQuery.data?.items ?? []).length ? (
                    <div className="p-4 text-[12px] font-bold text-[#8b9aae]">沒有符合或可新增的人員。</div>
                  ) : null}
                </div>
                <div className="mt-4 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                  <p className="text-[12px] font-black text-[#10233f]">已選擇</p>
                  <p className="mt-1 text-[13px] font-bold text-[#536175]">{selected ? `${selected.displayName} · ${selected.department || "-"}` : "尚未選擇人員"}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">期限：{cautionPeriodEnd}</p>
                </div>
                <div className="mt-4 grid gap-3">
                  <select value={periodType} onChange={(e) => setPeriodType(e.target.value as typeof periodType)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                    <option value="unlimited">無期限授權</option>
                    <option value="range">指定期間</option>
                    <option value="today_only">僅今日內測試</option>
                  </select>
                  <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
                  {periodType === "range" ? <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" /> : null}
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="備註，最多 200 字" className="min-h-[84px] rounded-[8px] border border-[#dfe7ef] p-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />
                  <button type="button" disabled={!cautionCanSubmit || createCautionMutation.isPending} onClick={() => {
                    if (!selected) return;
                    createCautionMutation.mutate({ userId: selected.userId, displayName: selected.displayName, phone: selected.phone, department: selected.department, position: selected.position, periodType, periodStartAt: startAt || null, periodEndAt: endAt || null, note: note || null });
                  }} className="min-h-10 rounded-[8px] bg-[#0f1b3d] px-4 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                    核發授權
                  </button>
                </div>
              </WorkbenchCard>

              <div className="space-y-3">
                <div className="grid gap-2 rounded-[8px] border border-[#dfe7ef] bg-white p-3 lg:grid-cols-[160px_180px_1fr]">
                  <select value={cautionStatus} onChange={(e) => setCautionStatus(e.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                    <option value="all">所有狀態</option>
                    <option value="active">啟用中</option>
                    <option value="expiring_soon">即將到期</option>
                    <option value="expired">已過期</option>
                    <option value="disabled">已停用</option>
                  </select>
                  <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                    <option value="">所有部門</option>
                    {(permissionsQuery.data?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋姓名 / 部門 / 電話 / userId" className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />
                </div>
                {(permissionsQuery.data?.items ?? []).map((entry) => (
                  <PermissionCard key={entry.id} entry={entry} onHistory={setHistoryEntry} />
                ))}
                {!permissionsQuery.isLoading && !(permissionsQuery.data?.items ?? []).length ? (
                  <WorkbenchCard className="grid min-h-[220px] place-items-center p-6 text-center">
                    <div>
                      <ShieldCheck className="mx-auto h-10 w-10 text-[#8b9aae]" />
                      <p className="mt-3 text-[14px] font-black text-[#10233f]">尚未授權任何人員</p>
                      <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">從左側搜尋疆域/Ragic 人員後即可核發第一筆慎用查詢權限。</p>
                    </div>
                  </WorkbenchCard>
                ) : null}
              </div>
            </div>
          </>
        ) : activeTab === "主管白名單" ? (
          <>
            {whitelistQuery.data?.storageStatus === "schema_pending" ? (
              <div className="rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[13px] font-black text-[#8a5a00]">
                白名單資料表尚未建立：請執行 db:push 後即可寫入。
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: "授權人員", value: whitelistQuery.data?.summary.total ?? 0, icon: Users },
                { label: "啟用中", value: whitelistQuery.data?.summary.active ?? 0, icon: ShieldCheck },
                { label: "已停用", value: whitelistQuery.data?.summary.disabled ?? 0, icon: SlidersHorizontal },
                { label: "面試授權", value: whitelistQuery.data?.summary.interviewEnabled ?? 0, icon: UserPlus },
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

            <div className="grid gap-3 xl:grid-cols-[430px_1fr]">
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">新增成員</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">輸入 2 字以上觸發 Ragic 員工搜尋，點選後自動填入資料。</p>
                <input
                  value={ragicQuery}
                  onChange={(e) => setRagicQuery(e.target.value)}
                  placeholder="輸入姓名搜尋員工（≥ 2 字）"
                  data-testid="input-ragic-search"
                  className="mt-4 h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]"
                />
                {ragicQuery.trim().length >= 2 ? (
                  <div className="mt-2 max-h-[200px] overflow-y-auto rounded-[8px] border border-[#edf1f6]">
                    {ragicCandidateQuery.isFetching ? (
                      <div className="p-3 text-[12px] font-bold text-[#8b9aae]">搜尋中…</div>
                    ) : (ragicCandidateQuery.data?.items ?? []).length > 0 ? (
                      (ragicCandidateQuery.data?.items ?? []).map((c) => (
                        <button
                          key={c.lineUserId || c.employeeNumber}
                          type="button"
                          onClick={() => { setRagicSelected(c); setManualLineUserId(""); setRagicQuery(""); }}
                          className={cn("block w-full border-b border-[#edf1f6] p-3 text-left last:border-b-0 hover:bg-[#fbfcfd]", ragicSelected?.employeeNumber === c.employeeNumber && "bg-[#ecfeff]")}
                        >
                          <p className="text-[13px] font-black text-[#10233f]">{c.displayName} <span className="text-[10px] text-[#8b9aae]">{c.title}</span></p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#8b9aae]">{c.department || "-"} · #{c.employeeNumber}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#536175]">
                            {c.lineUserId && c.lineUserId !== c.employeeNumber ? c.lineUserId : "尚未綁定 LINE"}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-[12px] font-bold text-[#8b9aae]">無符合員工</div>
                    )}
                  </div>
                ) : null}

                {ragicSelected ? (
                  <div className="mt-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-black text-[#10233f]">已選擇：{ragicSelected.displayName}</p>
                      <button type="button" onClick={() => { setRagicSelected(null); setManualLineUserId(""); }} className="text-[11px] font-bold text-[#8b9aae] hover:text-[#536175]">清除</button>
                    </div>
                    <p className="mt-0.5 text-[11px] font-bold text-[#8b9aae]">{ragicSelected.department || "-"} · #{ragicSelected.employeeNumber}</p>
                    {needsManualId ? (
                      <div className="mt-2">
                        <p className="text-[11px] font-bold text-[#c2410c]">此員工尚未綁定 LINE，請手動輸入 LINE userId：</p>
                        <input
                          value={manualLineUserId}
                          onChange={(e) => setManualLineUserId(e.target.value)}
                          placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          data-testid="input-manual-line-user-id"
                          className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 font-mono text-[12px] outline-none focus:border-[#2dd4bf]"
                        />
                      </div>
                    ) : (
                      <p className="mt-0.5 font-mono text-[11px] text-[#536175]">LINE userId：{ragicSelected.lineUserId}</p>
                    )}
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  <p className="text-[12px] font-black text-[#10233f]">功能授權</p>
                  {LINE_FEATURES.map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3 rounded-[6px] border border-[#edf1f6] p-2">
                      <div>
                        <p className="text-[12px] font-black text-[#10233f]">{f.label}</p>
                        <p className="text-[10px] font-bold text-[#8b9aae]">{f.description}</p>
                      </div>
                      <Switch
                        checked={Boolean(wlFeatures[f.key])}
                        onCheckedChange={(v) => setWlFeatures((prev) => ({ ...prev, [f.key]: v }))}
                      />
                    </label>
                  ))}
                </div>

                <textarea
                  value={wlNotes}
                  onChange={(e) => setWlNotes(e.target.value)}
                  maxLength={200}
                  placeholder="備註（選填），最多 200 字"
                  className="mt-3 min-h-[72px] w-full rounded-[8px] border border-[#dfe7ef] p-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]"
                />
                <button
                  type="button"
                  disabled={!wlCanSubmit || createWlMutation.isPending}
                  data-testid="button-submit-whitelist"
                  onClick={() => {
                    if (!wlCanSubmit || !ragicSelected) return;
                    createWlMutation.mutate({
                      lineUserId: effectiveLineUserId.trim(),
                      displayName: ragicSelected.displayName,
                      employeeNumber: ragicSelected.employeeNumber || null,
                      department: ragicSelected.department || null,
                      featureAccess: wlFeatures,
                      unlimited: true,
                      notes: wlNotes || null,
                    });
                  }}
                  className="mt-3 min-h-10 w-full rounded-[8px] bg-[#0f1b3d] px-4 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createWlMutation.isPending ? "新增中…" : "新增至白名單"}
                </button>
              </WorkbenchCard>

              <div className="space-y-3">
                <input
                  value={wlSearch}
                  onChange={(e) => setWlSearch(e.target.value)}
                  placeholder="搜尋白名單（姓名 / LINE userId / 部門）"
                  className="h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]"
                />
                {whitelistQuery.isLoading ? (
                  <WorkbenchCard className="p-6 text-center text-[12px] font-bold text-[#8b9aae]">載入中…</WorkbenchCard>
                ) : filteredWhitelist.length > 0 ? (
                  filteredWhitelist.map((entry) => (
                    <WhitelistEntryCard key={entry.id} entry={entry} onDelete={(id) => deleteWlMutation.mutate(id)} />
                  ))
                ) : (
                  <WorkbenchCard className="grid min-h-[220px] place-items-center p-6 text-center">
                    <div>
                      <Users className="mx-auto h-10 w-10 text-[#8b9aae]" />
                      <p className="mt-3 text-[14px] font-black text-[#10233f]">{wlSearch ? "無符合結果" : "尚未新增任何成員"}</p>
                      <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">從左側搜尋 Ragic 員工並設定功能授權後新增。</p>
                    </div>
                  </WorkbenchCard>
                )}
              </div>
            </div>
          </>
        ) : activeTab === "公告 VIP" ? (
          <>
            <div className="grid gap-3 xl:grid-cols-[400px_1fr]">
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">新增 VIP 公告成員</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">直接寫入 LINE Bot 公告白名單，優先接收重要公告推播。亦可在「主管白名單」頁開啟 VIP 公告功能自動同步。</p>
                <div className="mt-4 grid gap-3">
                  <input
                    value={vipUserId}
                    onChange={(e) => setVipUserId(e.target.value)}
                    placeholder="LINE userId（U 開頭）"
                    data-testid="input-vip-user-id"
                    className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 font-mono text-[13px] outline-none focus:border-[#2dd4bf]"
                  />
                  <input
                    value={vipDisplayName}
                    onChange={(e) => setVipDisplayName(e.target.value)}
                    placeholder="顯示名稱"
                    data-testid="input-vip-display-name"
                    className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]"
                  />
                  <button
                    type="button"
                    disabled={!vipUserId.trim() || !vipDisplayName.trim() || createVipMutation.isPending}
                    data-testid="button-add-vip"
                    onClick={() => createVipMutation.mutate({ userId: vipUserId.trim(), displayName: vipDisplayName.trim() })}
                    className="min-h-10 rounded-[8px] bg-[#0f1b3d] px-4 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createVipMutation.isPending ? "新增中…" : "新增至 VIP 白名單"}
                  </button>
                  {createVipMutation.isError ? (
                    <p className="text-[11px] font-bold text-[#c2410c]">新增失敗，請確認 LINE_BOT_ADMIN_TOKEN 設定</p>
                  ) : null}
                </div>
              </WorkbenchCard>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-black text-[#10233f]">LINE Bot VIP 公告白名單 <span className="ml-2 text-[11px] font-bold text-[#8b9aae]">（即時從 LINE Bot 讀取）</span></p>
                  <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: vipQueryKey })} className="rounded-[8px] border border-[#dfe7ef] px-3 py-1.5 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]">重新整理</button>
                </div>

                {vipListQuery.isLoading ? (
                  <WorkbenchCard className="p-6 text-center text-[12px] font-bold text-[#8b9aae]">從 LINE Bot 載入中…</WorkbenchCard>
                ) : vipListQuery.isError || (vipListQuery.data as { message?: string } | undefined)?.message ? (
                  <WorkbenchCard className="p-4">
                    <p className="text-[13px] font-bold text-[#c2410c]">
                      {(vipListQuery.data as { message?: string } | undefined)?.message ?? "無法連線至 LINE Bot，請確認 LINE_BOT_ADMIN_TOKEN 設定"}
                    </p>
                  </WorkbenchCard>
                ) : vipItems.length > 0 ? (
                  vipItems.map((entry) => (
                    <WorkbenchCard key={String(entry.id)} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-[#10233f]">{entry.displayName}</p>
                          <p className="mt-0.5 font-mono text-[11px] font-bold text-[#536175]">{entry.userId}</p>
                          {entry.createdAt ? <p className="mt-0.5 text-[10px] font-bold text-[#8b9aae]">新增：{new Date(entry.createdAt).toLocaleString("zh-TW")}</p> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(`確定要將 ${entry.displayName} 從 VIP 白名單移除？`)) deleteVipMutation.mutate(entry.id); }}
                          className="shrink-0 rounded-[8px] border border-[#ffe8df] px-3 py-2 text-[12px] font-black text-[#c2410c] hover:bg-[#ffe8df]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </WorkbenchCard>
                  ))
                ) : (
                  <WorkbenchCard className="grid min-h-[180px] place-items-center p-6 text-center">
                    <div>
                      <ShieldCheck className="mx-auto h-10 w-10 text-[#8b9aae]" />
                      <p className="mt-3 text-[14px] font-black text-[#10233f]">VIP 白名單目前為空</p>
                      <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">從左側新增成員，或在「主管白名單」頁開啟「VIP 公告」功能自動同步。</p>
                    </div>
                  </WorkbenchCard>
                )}
              </div>
            </div>
          </>
        ) : (
          <WorkbenchCard className="grid min-h-[320px] place-items-center p-6 text-center">
            <div>
              <SlidersHorizontal className="mx-auto h-10 w-10 text-[#8b9aae]" />
              <p className="mt-3 text-[16px] font-black text-[#10233f]">{activeTab} — 建置中</p>
              <p className="mt-1 text-[13px] font-bold text-[#8b9aae]">此分頁將透過 LINE Bot Admin API proxy 管理，敬請期待。</p>
            </div>
          </WorkbenchCard>
        )}

        <LineBotServiceHealthPanel />
      </div>
      <HistoryDrawer entry={historyEntry} open={Boolean(historyEntry)} onClose={() => setHistoryEntry(null)} />
    </RoleShell>
  );
}
