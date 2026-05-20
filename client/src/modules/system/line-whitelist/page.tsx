import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, ChevronUp, Clock, Save, Search, ShieldCheck, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { LINE_FEATURES } from "@shared/system/line-feature-whitelist";
import {
  createLineWhitelistEntry,
  fetchLineBotServiceStatus,
  fetchLineBotServiceStatusSnapshots,
  fetchLineWhitelist,
  searchLineWhitelistCandidates,
  updateLineWhitelistEntry,
  type LineWhitelistCandidate,
  type LineWhitelistEntry,
} from "./api";

const whitelistQueryKey = ["/api/bff/system/line-whitelist"];
const defaultFeatureAccess = () =>
  Object.fromEntries(LINE_FEATURES.map((feature) => [feature.key, feature.key === "interview" || feature.key === "caution-query"]));

const dateValue = (value?: string | null) => value ? value.slice(0, 10).replaceAll("-", "/") : "";
const inputDateValue = (value?: string | null) => value ? value.slice(0, 10) : "";
const fullPhone = (phone?: string | null) => phone || "-";
const isExpiringSoon = (entry: LineWhitelistEntry) => {
  if (entry.unlimited || !entry.endsAt || entry.status !== "active") return false;
  const end = new Date(entry.endsAt).getTime();
  if (!Number.isFinite(end)) return false;
  const days = (end - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 14;
};

const featureSummary = (features: Record<string, boolean>) =>
  LINE_FEATURES.filter((feature) => features[feature.key]).map((feature) => feature.label).join("、") || "未開功能";

const operationErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "操作失敗，請稍後再試。";

function ServiceHealthStrip() {
  const [showSnapshots, setShowSnapshots] = useState(false);
  const statusQuery = useQuery({
    queryKey: ["/api/bff/system/line-bot/service-status", "line-whitelist"],
    queryFn: fetchLineBotServiceStatus,
    refetchInterval: 30_000,
    retry: 1,
  });
  const snapshotsQuery = useQuery({
    queryKey: ["/api/bff/system/line-bot/service-status/snapshots", "line-whitelist"],
    queryFn: fetchLineBotServiceStatusSnapshots,
    enabled: showSnapshots,
    retry: 1,
  });
  const services = Array.isArray(statusQuery.data?.services) ? statusQuery.data.services : [];
  return (
    <WorkbenchCard className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#536175]" />
          <h2 className="text-[15px] font-black text-[#10233f]">400LINE 連線狀態</h2>
          {statusQuery.isFetching ? <span className="text-[11px] font-bold text-[#8b9aae]">更新中…</span> : null}
        </div>
        <button type="button" onClick={() => setShowSnapshots((value) => !value)} className="flex items-center gap-1 rounded-[8px] border border-[#dfe7ef] px-3 py-1.5 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]">
          {showSnapshots ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          快照
        </button>
      </div>
      {(statusQuery.data as { message?: string } | undefined)?.message ? (
        <div className="mt-3 rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[12px] font-bold text-[#8a5a00]">
          {(statusQuery.data as { message?: string }).message}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {services.map((service) => {
          const status = String(service.status ?? "unknown");
          const ok = ["healthy", "up", "ok"].includes(status.toLowerCase());
          const bad = ["critical", "down", "unhealthy"].includes(status.toLowerCase());
          return (
            <span key={`${service.name ?? service.service}-${status}`} className={cn("rounded-full px-3 py-1.5 text-[12px] font-black", ok ? "bg-[#e9f8df] text-[#188249]" : bad ? "bg-[#ffe8df] text-[#c2410c]" : "bg-[#fff6e7] text-[#ca8a04]")}>
              {service.name ?? service.service ?? "unknown"} · {status}
            </span>
          );
        })}
        {!statusQuery.isLoading && !services.length ? <span className="text-[12px] font-bold text-[#8b9aae]">尚未取得 400LINE 服務狀態。</span> : null}
      </div>
      {showSnapshots ? (
        <div className="mt-3 grid gap-2">
          {(snapshotsQuery.data?.items ?? []).slice(0, 4).map((snapshot, index) => {
            const at = snapshot.snappedAt ?? snapshot.createdAt ?? snapshot.checkedAt;
            return (
              <div key={String(snapshot.id ?? index)} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 text-[12px] font-bold text-[#536175]">
                {at ? new Date(at).toLocaleString("zh-TW") : "未標記時間"}
              </div>
            );
          })}
          {!snapshotsQuery.isLoading && !(snapshotsQuery.data?.items ?? []).length ? <p className="text-[12px] font-bold text-[#8b9aae]">尚無快照記錄。</p> : null}
        </div>
      ) : null}
    </WorkbenchCard>
  );
}

function WhitelistEntryCard({ entry }: { entry: LineWhitelistEntry }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>(entry.featureAccess);
  const [periodType, setPeriodType] = useState<"unlimited" | "range">(entry.unlimited ? "unlimited" : "range");
  const [startsAt, setStartsAt] = useState(inputDateValue(entry.startsAt));
  const [endsAt, setEndsAt] = useState(inputDateValue(entry.endsAt));
  const updateMutation = useMutation({
    mutationFn: (payload: { status?: "active" | "disabled"; featureAccess?: Record<string, boolean>; unlimited?: boolean; startsAt?: string | null; endsAt?: string | null }) =>
      updateLineWhitelistEntry(entry.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whitelistQueryKey }),
  });
  const toggleFeature = (key: string, value: boolean) => {
    const next = { ...localFeatures, [key]: value };
    setLocalFeatures(next);
    updateMutation.mutate({ featureAccess: next });
  };
  const savePeriod = () => {
    updateMutation.mutate({
      unlimited: periodType === "unlimited",
      startsAt: startsAt || null,
      endsAt: periodType === "unlimited" ? null : (endsAt || null),
    });
  };
  return (
    <WorkbenchCard className="p-4">
      <div className="grid gap-3 xl:grid-cols-[1fr_180px_140px_120px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-black text-[#10233f]">{entry.displayName}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", entry.status === "active" ? "bg-[#e9f8df] text-[#188249]" : "bg-[#eef2f6] text-[#536175]")}>
              {entry.status === "active" ? "啟用" : "停用"}
            </span>
            {isExpiringSoon(entry) ? <span className="rounded-full bg-[#fff6e7] px-2 py-0.5 text-[10px] font-black text-[#ca8a04]">即將到期</span> : null}
          </div>
          <p className="mt-0.5 font-mono text-[11px] font-black text-[#536175]">{entry.lineUserId}</p>
          <p className="mt-0.5 text-[11px] font-bold text-[#8b9aae]">{fullPhone(entry.phone)} · {entry.department ?? "-"}</p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">授權期限</p>
          <p className="mt-1 text-[12px] font-black text-[#10233f]">{entry.unlimited ? "無期限" : `${dateValue(entry.startsAt) || "立即"} ~ ${dateValue(entry.endsAt) || "未指定"}`}</p>
        </div>
        <label className="flex items-center gap-2">
          <Switch disabled={updateMutation.isPending} checked={entry.status === "active"} onCheckedChange={(value) => updateMutation.mutate({ status: value ? "active" : "disabled" })} />
          <span className="text-[12px] font-black text-[#536175]">{entry.status === "active" ? "啟用" : "停用"}</span>
        </label>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#dfe7ef] px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          編輯
        </button>
      </div>
      <p className="mt-3 text-[11px] font-bold text-[#637185]">{featureSummary(localFeatures)}</p>
      {expanded ? (
        <div className="mt-4 grid gap-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LINE_FEATURES.map((feature) => (
              <label key={feature.key} className="flex min-h-[70px] items-center justify-between gap-3 rounded-[6px] border border-[#edf1f6] bg-white p-3">
                <div>
                  <p className="text-[12px] font-black text-[#10233f]">{feature.label}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-[#8b9aae]">{feature.description}</p>
                </div>
                <Switch disabled={updateMutation.isPending} checked={Boolean(localFeatures[feature.key])} onCheckedChange={(value) => toggleFeature(feature.key, value)} />
              </label>
            ))}
          </div>
          {updateMutation.isError ? (
            <div className="rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] p-3 text-[12px] font-bold text-[#c2410c]">
              {operationErrorMessage(updateMutation.error)}
            </div>
          ) : null}
          <div className="grid gap-2 lg:grid-cols-[160px_1fr_1fr_auto] lg:items-end">
            <label className="grid gap-1">
              <span className="text-[11px] font-black text-[#8b9aae]">期限</span>
              <select value={periodType} onChange={(event) => setPeriodType(event.target.value as "unlimited" | "range")} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                <option value="unlimited">無期限</option>
                <option value="range">指定起迄</option>
              </select>
            </label>
            <input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold" />
            <input type="date" value={endsAt} disabled={periodType === "unlimited"} onChange={(event) => setEndsAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold disabled:opacity-50" />
            <button type="button" onClick={savePeriod} disabled={updateMutation.isPending} className="h-10 rounded-[8px] bg-[#0f1b3d] px-4 text-[12px] font-black text-white disabled:opacity-50">儲存期限</button>
          </div>
        </div>
      ) : null}
    </WorkbenchCard>
  );
}

export function LineWhitelistManagementPanel({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [ragicQuery, setRagicQuery] = useState("");
  const [ragicSelected, setRagicSelected] = useState<LineWhitelistCandidate | null>(null);
  const [manualLineUserId, setManualLineUserId] = useState("");
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>(defaultFeatureAccess());
  const [periodType, setPeriodType] = useState<"unlimited" | "range">("unlimited");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [wlSearch, setWlSearch] = useState("");
  const [lastSavedName, setLastSavedName] = useState("");
  const [lastSyncMessage, setLastSyncMessage] = useState("");

  const whitelistQuery = useQuery({
    queryKey: whitelistQueryKey,
    queryFn: fetchLineWhitelist,
  });
  const ragicCandidateQuery = useQuery({
    queryKey: ["/api/bff/system/line-whitelist/candidates", ragicQuery.trim()],
    queryFn: () => searchLineWhitelistCandidates(ragicQuery.trim()),
    staleTime: 60_000,
  });
  const filteredRagicCandidates = useMemo(() => {
    const all = ragicCandidateQuery.data?.items ?? [];
    const query = ragicQuery.trim().toLowerCase();
    if (!query) return all;
    return all.filter((candidate) =>
      `${candidate.displayName} ${candidate.lineUserId} ${candidate.employeeNumber} ${candidate.phone} ${candidate.department}`.toLowerCase().includes(query),
    );
  }, [ragicCandidateQuery.data?.items, ragicQuery]);
  const normalizedSelectedLineUserId = ragicSelected?.lineUserId && ragicSelected.lineUserId !== ragicSelected.employeeNumber ? ragicSelected.lineUserId : "";
  const effectiveLineUserId = normalizedSelectedLineUserId || manualLineUserId.trim();
  const selectedExisting = effectiveLineUserId
    ? (whitelistQuery.data?.items ?? []).find((item) => item.lineUserId === effectiveLineUserId)
    : null;
  const needsManualLineId = Boolean(ragicSelected) && !normalizedSelectedLineUserId;
  const canSubmit = Boolean(ragicSelected?.displayName) && effectiveLineUserId.length > 0 && whitelistQuery.data?.storageStatus !== "schema_pending";
  const filteredWhitelist = useMemo(() => {
    const query = wlSearch.trim().toLowerCase();
    return (whitelistQuery.data?.items ?? []).filter((item) => {
      if (!query) return true;
      return `${item.displayName} ${item.lineUserId} ${item.phone ?? ""} ${item.department ?? ""}`.toLowerCase().includes(query);
    });
  }, [whitelistQuery.data?.items, wlSearch]);
  const summary = {
    total: whitelistQuery.data?.summary.total ?? 0,
    active: whitelistQuery.data?.summary.active ?? 0,
    disabled: whitelistQuery.data?.summary.disabled ?? 0,
    expiringSoon: (whitelistQuery.data?.items ?? []).filter(isExpiringSoon).length,
  };

  const selectCandidate = (candidate: LineWhitelistCandidate) => {
    const lineUserId = candidate.lineUserId && candidate.lineUserId !== candidate.employeeNumber ? candidate.lineUserId : "";
    const existing = lineUserId ? (whitelistQuery.data?.items ?? []).find((item) => item.lineUserId === lineUserId) : null;
    setRagicSelected(candidate);
    setManualLineUserId("");
    setRagicQuery("");
    setFeatureAccess(existing?.featureAccess ?? defaultFeatureAccess());
    setPeriodType(existing?.unlimited === false ? "range" : "unlimited");
    setStartsAt(inputDateValue(existing?.startsAt));
    setEndsAt(inputDateValue(existing?.endsAt));
    setNotes(existing?.notes ?? "");
  };

  const createMutation = useMutation({
    mutationFn: createLineWhitelistEntry,
    onSuccess: (entry) => {
      setLastSavedName(entry.displayName);
      setLastSyncMessage(entry.sync?.message ?? "");
      queryClient.invalidateQueries({ queryKey: whitelistQueryKey });
      setRagicSelected(null);
      setManualLineUserId("");
      setFeatureAccess(defaultFeatureAccess());
      setPeriodType("unlimited");
      setStartsAt("");
      setEndsAt("");
      setNotes("");
    },
  });
  return (
      <div
        className={cn("space-y-3", !embedded && "mx-auto max-w-[1440px]")}
        data-testid="system-line-whitelist-page"
      >
        {whitelistQuery.data?.storageStatus === "schema_pending" ? (
          <div className="rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[13px] font-black text-[#8a5a00]">
            白名單資料表尚未建立：請執行 db:push 後即可寫入。
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "授權人員", value: summary.total, icon: Users },
            { label: "啟用中", value: summary.active, icon: ShieldCheck },
            { label: "已停用", value: summary.disabled, icon: SlidersHorizontal },
            { label: "即將到期", value: summary.expiringSoon, icon: Clock },
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">新增 / 更新授權</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">搜尋 Ragic H01 人員，對準姓名與 LINE userId 後，選擇功能並加入 400LINE 白名單。</p>
              </div>
            </div>

            {!ragicSelected ? (
              <>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b9aae]" />
                  <input value={ragicQuery} onChange={(event) => setRagicQuery(event.target.value)} placeholder="搜尋姓名 / userid / 電話 / 部門" className="h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white py-0 pl-8 pr-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />
                </div>
                {ragicCandidateQuery.data?.sourceStatus ? (
                  <div className="mt-2 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-2 text-[11px] font-bold text-[#637185]">
                    Ragic H01：{ragicCandidateQuery.data.sourceStatus.status}
                    {ragicCandidateQuery.data.sourceStatus.lastSyncAt ? ` · ${new Date(ragicCandidateQuery.data.sourceStatus.lastSyncAt).toLocaleString("zh-TW")}` : ""}
                    {ragicCandidateQuery.data.sourceStatus.fallbackReason ? ` · ${ragicCandidateQuery.data.sourceStatus.fallbackReason}` : ""}
                  </div>
                ) : null}
                <div className="mt-2 max-h-[280px] overflow-y-auto rounded-[8px] border border-[#edf1f6]">
                  {ragicCandidateQuery.isLoading ? (
                    <div className="p-4 text-center text-[12px] font-bold text-[#8b9aae]">載入 Ragic H01 員工中…</div>
                  ) : ragicCandidateQuery.isError ? (
                    <div className="p-4 text-center text-[12px] font-bold text-[#c2410c]">Ragic H01 員工資料暫時無法存取</div>
                  ) : filteredRagicCandidates.length ? (
                    filteredRagicCandidates.map((candidate) => (
                      <button key={candidate.lineUserId || candidate.employeeNumber} type="button" onClick={() => selectCandidate(candidate)} className="block w-full border-b border-[#edf1f6] p-3 text-left last:border-b-0 hover:bg-[#f5f8fb]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-black text-[#10233f]">{candidate.displayName}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-[#8b9aae]">{fullPhone(candidate.phone)} · {candidate.department || "-"}</p>
                          </div>
                          <p className="shrink-0 font-mono text-[10px] text-[#536175]">{candidate.lineUserId && candidate.lineUserId !== candidate.employeeNumber ? candidate.lineUserId.slice(0, 8) + "…" : "待綁定"}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-[12px] font-bold text-[#8b9aae]">無符合人員</div>
                  )}
                </div>
                {ragicCandidateQuery.data ? <p className="mt-1 text-right text-[10px] font-bold text-[#8b9aae]">共 {ragicCandidateQuery.data.items.length} 位，篩選後 {filteredRagicCandidates.length} 位</p> : null}
              </>
            ) : (
              <div className="mt-4 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-black text-[#10233f]">{ragicSelected.displayName}</p>
                  <button type="button" onClick={() => setRagicSelected(null)} className="text-[11px] font-black text-[#8b9aae] hover:text-[#536175]">重新選擇</button>
                </div>
                <div className="mt-2 grid gap-2 text-[12px] font-bold text-[#536175]">
                  <p>userid：<span className="font-mono">{effectiveLineUserId || "待綁定"}</span></p>
                  <p>電話：{fullPhone(ragicSelected.phone)}</p>
                  <p>部門：{ragicSelected.department || "-"}</p>
                </div>
                {needsManualLineId ? (
                  <input value={manualLineUserId} onChange={(event) => setManualLineUserId(event.target.value)} placeholder="手動輸入 LINE userId（U 開頭）" className="mt-3 h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 font-mono text-[12px] outline-none focus:border-[#2dd4bf]" />
                ) : null}
                {selectedExisting ? <p className="mt-2 text-[11px] font-black text-[#0e7490]">此人已在白名單，送出會更新原授權。</p> : null}
              </div>
            )}

            <div className="mt-4 grid gap-2">
              <p className="text-[12px] font-black text-[#10233f]">功能選用清單</p>
              {LINE_FEATURES.map((feature) => (
                <label key={feature.key} className="flex items-center justify-between gap-3 rounded-[6px] border border-[#edf1f6] p-2">
                  <div>
                    <p className="text-[12px] font-black text-[#10233f]">{feature.label}</p>
                    <p className="text-[10px] font-bold text-[#8b9aae]">{feature.description}</p>
                  </div>
                  <Switch checked={Boolean(featureAccess[feature.key])} onCheckedChange={(value) => setFeatureAccess((prev) => ({ ...prev, [feature.key]: value }))} />
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-2">
              <p className="text-[12px] font-black text-[#10233f]">授權期限</p>
              <select value={periodType} onChange={(event) => setPeriodType(event.target.value as "unlimited" | "range")} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                <option value="unlimited">無期限</option>
                <option value="range">指定起迄</option>
              </select>
              <input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
              {periodType === "range" ? <input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" /> : null}
            </div>

            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={200} placeholder="備註（選填），最多 200 字" className="mt-3 min-h-[72px] w-full rounded-[8px] border border-[#dfe7ef] p-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />
            {createMutation.isError ? (
              <div className="mt-3 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] p-3 text-[12px] font-bold text-[#c2410c]">
                {operationErrorMessage(createMutation.error)}
              </div>
            ) : null}
            <button
              type="button"
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => {
                if (!canSubmit || !ragicSelected) return;
                createMutation.mutate({
                  lineUserId: effectiveLineUserId,
                  displayName: ragicSelected.displayName,
                  employeeNumber: ragicSelected.employeeNumber || null,
                  phone: ragicSelected.phone || null,
                  department: ragicSelected.department || null,
                  status: "active",
                  featureAccess,
                  startsAt: startsAt || null,
                  endsAt: periodType === "unlimited" ? null : (endsAt || null),
                  unlimited: periodType === "unlimited",
                  notes: notes || null,
                });
              }}
              className="mt-3 min-h-10 w-full rounded-[8px] bg-[#0f1b3d] px-4 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? "儲存中…" : selectedExisting ? "更新授權" : "新增至白名單"}
            </button>
          </WorkbenchCard>

          <div className="space-y-3">
            {lastSavedName ? (
              <div className="rounded-[8px] border border-[#d1fae5] bg-[#f0fdf4] p-3 text-[12px] font-bold text-[#188249]">
                已儲存 {lastSavedName} 的功能授權，後端會同步更新 400LINE 白名單。
              </div>
            ) : null}
            {lastSyncMessage ? (
              <div className="rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[12px] font-bold text-[#8a5a00]">
                {lastSyncMessage}
              </div>
            ) : null}
            <div className="rounded-[8px] border border-[#edf1f6] bg-white p-3">
              <p className="text-[13px] font-black text-[#10233f]">目前 400LINE 白名單對象</p>
              <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">保留 CMS shadow 內可編輯的詳細授權，新增與更新一律從左側 Ragic H01 流程執行。</p>
            </div>
            <input value={wlSearch} onChange={(event) => setWlSearch(event.target.value)} placeholder="搜尋白名單（姓名 / userid / 電話 / 部門）" className="h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />

            {whitelistQuery.isLoading ? (
              <WorkbenchCard className="p-6 text-center text-[12px] font-bold text-[#8b9aae]">載入中…</WorkbenchCard>
            ) : filteredWhitelist.length ? (
              filteredWhitelist.map((entry) => <WhitelistEntryCard key={entry.id} entry={entry} />)
            ) : (
              <WorkbenchCard className="grid min-h-[220px] place-items-center p-6 text-center">
                <div>
                  <UserPlus className="mx-auto h-10 w-10 text-[#8b9aae]" />
                  <p className="mt-3 text-[14px] font-black text-[#10233f]">{wlSearch ? "無符合結果" : "尚未新增任何成員"}</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">從左側搜尋 Ragic H01 人員後新增授權。</p>
                </div>
              </WorkbenchCard>
            )}
          </div>
        </div>

        <ServiceHealthStrip />
      </div>
  );
}

export default function SystemLineWhitelistPage() {
  return (
    <RoleShell role="system" title="400 LINE 白名單管理" subtitle="INTERVIEW + CAUTION ACCESS">
      <LineWhitelistManagementPanel />
    </RoleShell>
  );
}
