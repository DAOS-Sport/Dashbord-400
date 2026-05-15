import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Clock, History, Search, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import {
  createCautionPermission,
  fetchCautionPermissionAudit,
  fetchCautionPermissions,
  searchCautionCandidates,
  updateCautionPermissionPeriod,
  updateCautionPermissionStatus,
  type CautionCandidate,
  type CautionPermission,
} from "./api";

const queryKey = ["/api/cms/system/caution-permissions"];
const tabs = ["慎用查詢", "主管白名單", "公告 VIP", "群組 tier"] as const;

const dateValue = (value?: string | null) => value ? value.slice(0, 10).replaceAll("-", "/") : "";
const inputDateValue = (value?: string | null) => value ? value.slice(0, 10) : "";
const maskPhone = (phone?: string | null) => phone ? phone.replace(/(\d{4})\d+(\d{3})$/, "$1***$2") : "-";

const statusCopy: Record<string, { label: string; className: string }> = {
  active: { label: "● 啟用", className: "bg-[#e9f8df] text-[#188249]" },
  expiring_soon: { label: "⚠ 即將到期", className: "bg-[#fff6e7] text-[#ca8a04]" },
  expired: { label: "⚠ 已過期", className: "bg-[#ffe8df] text-[#c2410c]" },
  disabled: { label: "○ 已停用", className: "bg-[#eef2f6] text-[#536175]" },
  not_yet_effective: { label: "尚未生效", className: "bg-[#eef2ff] text-[#3b82f6]" },
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

function PermissionCard({ entry, onHistory }: { entry: CautionPermission; onHistory: (entry: CautionPermission) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [periodType, setPeriodType] = useState<"unlimited" | "range" | "today_only">(entry.permissionEndAt ? "range" : "unlimited");
  const [startAt, setStartAt] = useState(inputDateValue(entry.permissionStartAt));
  const [endAt, setEndAt] = useState(inputDateValue(entry.permissionEndAt));
  const [reason, setReason] = useState("");
  const ui = statusCopy[entry.status] ?? statusCopy.disabled;
  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => updateCautionPermissionStatus(entry.id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const periodMutation = useMutation({
    mutationFn: () => updateCautionPermissionPeriod(entry.id, {
      periodType,
      periodStartAt: startAt || null,
      periodEndAt: endAt || null,
      changeReason: reason,
    }),
    onSuccess: () => {
      setEditing(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey });
    },
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
          <Switch checked={entry.isActive} onCheckedChange={(checked) => statusMutation.mutate(checked)} />
          <span className="text-[12px] font-black text-[#536175]">{entry.isActive ? "啟用" : "停用"}</span>
        </label>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-[8px] border border-[#dfe7ef] px-3 py-2 text-[12px] font-black text-[#10233f]">編輯期限</button>
          <button type="button" onClick={() => onHistory(entry)} className="rounded-[8px] border border-[#dfe7ef] px-3 py-2 text-[12px] font-black text-[#10233f]">查看歷史</button>
        </div>
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 lg:grid-cols-[160px_1fr_1fr_1.4fr_auto] lg:items-end">
          <label className="grid gap-1">
            <span className="text-[11px] font-black text-[#8b9aae]">授權類型</span>
            <select value={periodType} onChange={(event) => setPeriodType(event.target.value as typeof periodType)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
              <option value="unlimited">無期限</option>
              <option value="range">指定期間</option>
              <option value="today_only">僅今日內測試</option>
            </select>
          </label>
          <input type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold" />
          <input type="date" value={endAt} disabled={periodType !== "range"} onChange={(event) => setEndAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold disabled:opacity-50" />
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="變更原因，至少 5 字" className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold" />
          <button type="button" disabled={reason.trim().length < 5 || periodMutation.isPending} onClick={() => periodMutation.mutate()} className="h-10 rounded-[8px] bg-[#0f1b3d] px-4 text-[12px] font-black text-white disabled:opacity-50">儲存</button>
        </div>
      ) : null}
    </WorkbenchCard>
  );
}

export default function SystemLineWhitelistPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("慎用查詢");
  const [status, setStatus] = useState("all");
  const [dept, setDept] = useState("");
  const [query, setQuery] = useState("");
  const [candidateQueryText, setCandidateQueryText] = useState("");
  const [selected, setSelected] = useState<CautionCandidate | null>(null);
  const [periodType, setPeriodType] = useState<"unlimited" | "range" | "today_only">("unlimited");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");
  const [historyEntry, setHistoryEntry] = useState<CautionPermission | null>(null);
  const permissionsQuery = useQuery({
    queryKey: [...queryKey, status, dept, query],
    queryFn: () => fetchCautionPermissions({ status, dept, q: query }),
  });
  const candidateQuery = useQuery({
    queryKey: ["/api/cms/system/caution-permissions/candidates", candidateQueryText],
    queryFn: () => searchCautionCandidates(candidateQueryText),
    enabled: candidateQueryText.trim().length > 0,
  });
  const createMutation = useMutation({
    mutationFn: createCautionPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelected(null);
      setCandidateQueryText("");
      setNote("");
      setPeriodType("unlimited");
      setStartAt("");
      setEndAt("");
    },
  });
  const summary = permissionsQuery.data?.summary;
  const canSubmit = Boolean(selected) && permissionsQuery.data?.storageStatus !== "schema_pending";
  const selectedPeriodEnd = useMemo(() => {
    if (periodType === "today_only") return "24 小時後自動失效";
    if (periodType === "range") return endAt || "尚未指定迄日";
    return "無期限";
  }, [endAt, periodType]);

  const submit = () => {
    if (!selected) return;
    createMutation.mutate({
      userId: selected.userId,
      displayName: selected.displayName,
      phone: selected.phone,
      department: selected.department,
      position: selected.position,
      periodType,
      periodStartAt: startAt || null,
      periodEndAt: endAt || null,
      note: note || null,
    });
  };

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

        {activeTab !== "慎用查詢" ? (
          <WorkbenchCard className="grid min-h-[320px] place-items-center p-6 text-center">
            <div>
              <SlidersHorizontal className="mx-auto h-10 w-10 text-[#8b9aae]" />
              <p className="mt-3 text-[16px] font-black text-[#10233f]">{activeTab} 將走 400LINE Admin API proxy</p>
              <p className="mt-1 text-[13px] font-bold text-[#8b9aae]">本輪先落地 CMS 自有 DB 的「慎用查詢」權限與 audit。</p>
            </div>
          </WorkbenchCard>
        ) : (
          <>
            {permissionsQuery.data?.storageStatus === "schema_pending" ? (
              <div className="rounded-[8px] border border-[#f2dda8] bg-[#fffaf0] p-3 text-[13px] font-black text-[#8a5a00]">
                慎用查詢權限資料表尚未建立：請套用 migrations/0012_caution_query_permissions.sql 或執行 db:push 後即可寫入。
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-5">
              {[
                { label: "授權人員", value: summary?.total ?? 0, icon: Users },
                { label: "啟用中", value: summary?.active ?? 0, icon: ShieldCheck },
                { label: "即將到期", value: summary?.expiringSoon ?? 0, icon: Clock },
                { label: "已過期", value: summary?.expired ?? 0, icon: Search },
                { label: "已停用", value: summary?.disabled ?? 0, icon: SlidersHorizontal },
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
                  onChange={(event) => setCandidateQueryText(event.target.value)}
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
                  {candidateQueryText.trim() && !candidateQuery.isFetching && !(candidateQuery.data?.items ?? []).length ? <div className="p-4 text-[12px] font-bold text-[#8b9aae]">沒有符合或可新增的人員。</div> : null}
                </div>

                <div className="mt-4 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                  <p className="text-[12px] font-black text-[#10233f]">已選擇</p>
                  <p className="mt-1 text-[13px] font-bold text-[#536175]">{selected ? `${selected.displayName} · ${selected.department || "-"}` : "尚未選擇人員"}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">期限：{selectedPeriodEnd}</p>
                </div>

                <div className="mt-4 grid gap-3">
                  <select value={periodType} onChange={(event) => setPeriodType(event.target.value as typeof periodType)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                    <option value="unlimited">無期限授權</option>
                    <option value="range">指定期間</option>
                    <option value="today_only">僅今日內測試</option>
                  </select>
                  <input type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
                  {periodType === "range" ? <input type="date" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" /> : null}
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="備註，最多 200 字" className="min-h-[84px] rounded-[8px] border border-[#dfe7ef] p-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />
                  <button type="button" disabled={!canSubmit || createMutation.isPending} onClick={submit} className="min-h-10 rounded-[8px] bg-[#0f1b3d] px-4 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                    核發授權
                  </button>
                </div>
              </WorkbenchCard>

              <div className="space-y-3">
                <div className="grid gap-2 rounded-[8px] border border-[#dfe7ef] bg-white p-3 lg:grid-cols-[160px_180px_1fr]">
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                    <option value="all">所有狀態</option>
                    <option value="active">啟用中</option>
                    <option value="expiring_soon">即將到期</option>
                    <option value="expired">已過期</option>
                    <option value="disabled">已停用</option>
                  </select>
                  <select value={dept} onChange={(event) => setDept(event.target.value)} className="h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold">
                    <option value="">所有部門</option>
                    {(permissionsQuery.data?.departments ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋姓名 / 部門 / 電話 / userId" className="h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold outline-none focus:border-[#2dd4bf]" />
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
        )}
      </div>
      <HistoryDrawer entry={historyEntry} open={Boolean(historyEntry)} onClose={() => setHistoryEntry(null)} />
    </RoleShell>
  );
}
