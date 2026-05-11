import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, LifeBuoy, PackageSearch } from "lucide-react";
import { Link } from "wouter";
import { apiGet, apiPost } from "@/shared/api/client";
import { FacilityGate } from "@/shared/auth/facility-gate";
import { useAuthMe } from "@/shared/auth/session";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { LifeguardShell } from "./lifeguard-shell";
import { getLifeguardOperationModule, type LifeguardOperationModuleId } from "./operation-modules";
import { LifeguardCameraCapture } from "./shared/camera-capture";

interface PhotoRecordPayload {
  photoUrl: string;
  photoKey: string;
  serverAddress: string | null;
  latitude: number;
  longitude: number;
  clientAddress: string | null;
  clientCaptureTimeIso: string;
}

interface LifeguardRecordResponse {
  waterQuality: Array<Record<string, unknown>>;
  coachDive: Array<Record<string, unknown>>;
  cleanup: Array<Record<string, unknown>>;
  lostItems: Array<Record<string, unknown>>;
  laneIssues: Array<Record<string, unknown>>;
  laneRentals: Array<Record<string, unknown>>;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const currentShiftLabel = () => {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 5 && hour < 12) return "早班";
  if (hour >= 12 && hour < 17) return "午班";
  return "晚班";
};

function ModuleToneIcon({ moduleId }: { moduleId: LifeguardOperationModuleId }) {
  const module = getLifeguardOperationModule(moduleId);
  const Icon = module.Icon;
  return (
    <div className={cn(
      "grid h-14 w-14 shrink-0 place-items-center rounded-[14px]",
      module.tone === "green" && "bg-[#e3f7ef] text-[#116247]",
      module.tone === "blue" && "bg-[#e9f1ff] text-[#2456b3]",
      module.tone === "amber" && "bg-[#fff0d4] text-[#8a520b]",
      module.tone === "violet" && "bg-[#eee8ff] text-[#5134b0]",
      module.tone === "rose" && "bg-[#ffe4e9] text-[#9f2434]",
      module.tone === "slate" && "bg-[#edf2f7] text-[#536175]",
    )}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

function PhotoModulePage({ moduleId }: { moduleId: "water-quality" | "coach-dive" | "cleanup" }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [coachName, setCoachName] = useState("");
  const module = getLifeguardOperationModule(moduleId);
  const endpoint = moduleId === "water-quality" ? "/api/bff/lifeguard/water-quality" : moduleId === "coach-dive" ? "/api/bff/lifeguard/coach-dive" : "/api/bff/lifeguard/cleanup";
  const mutation = useMutation({
    mutationFn: (payload: PhotoRecordPayload) => apiPost(endpoint, {
      ...payload,
      description,
      coachName: moduleId === "coach-dive" ? coachName : undefined,
      structuredFields: {},
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bff/lifeguard/records"] }),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.42fr]">
      <WorkbenchCard className="p-4 sm:p-5">
        <LifeguardCameraCapture
          module={module.apiModule as "water_quality" | "coach_dive" | "cleanup"}
          description={description}
          onSubmitted={async (payload) => { await mutation.mutateAsync(payload); }}
          extraFields={
            <div className="space-y-3">
              {moduleId === "coach-dive" ? (
                <label className="block">
                  <span className="text-[12px] font-black text-[#10233f]">教練姓名</span>
                  <input value={coachName} onChange={(e) => setCoachName(e.target.value)} className="mt-1 min-h-11 w-full rounded-[10px] border border-[#dfe7ef] px-3 text-[14px] font-bold" placeholder="請輸入教練姓名" />
                </label>
              ) : null}
              <label className="block">
                <span className="text-[12px] font-black text-[#10233f]">備註</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[88px] w-full rounded-[10px] border border-[#dfe7ef] px-3 py-2 text-[14px] font-bold" placeholder="可補充現場狀況" />
              </label>
            </div>
          }
        />
      </WorkbenchCard>
      <TodaySummaryCard />
    </div>
  );
}

function LaneIssuesPage() {
  const queryClient = useQueryClient();
  const [laneCode, setLaneCode] = useState("A");
  const [issueType, setIssueType] = useState("異常");
  const [severity, setSeverity] = useState("一般");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () => apiPost("/api/bff/lifeguard/lane-issues", { laneCode, issueType, severity, description }),
    onSuccess: () => {
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/bff/lifeguard/records"] });
    },
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[0.7fr_1fr]">
      <WorkbenchCard className="p-5">
        <div className="space-y-3">
          <label className="block text-[12px] font-black text-[#10233f]">水道編號</label>
          <select value={laneCode} onChange={(e) => setLaneCode(e.target.value)} className="min-h-11 w-full rounded-[10px] border border-[#dfe7ef] px-3 font-black">
            {["A", "B", "C", "D", "E"].map((lane) => <option key={lane}>{lane}</option>)}
          </select>
          <label className="block text-[12px] font-black text-[#10233f]">事項類型</label>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="min-h-11 w-full rounded-[10px] border border-[#dfe7ef] px-3 font-black">
            {["故障", "異常", "維修", "其他"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <label className="block text-[12px] font-black text-[#10233f]">嚴重程度</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="min-h-11 w-full rounded-[10px] border border-[#dfe7ef] px-3 font-black">
            {["一般", "重要", "緊急"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <label className="block text-[12px] font-black text-[#10233f]">文字描述</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[140px] w-full rounded-[10px] border border-[#dfe7ef] px-3 py-2 font-bold" />
          <button disabled={!description.trim() || mutation.isPending} onClick={() => mutation.mutate()} className="min-h-12 w-full rounded-[12px] bg-[#0d2a50] text-[14px] font-black text-white disabled:opacity-60">送出水道事項</button>
          {mutation.isSuccess ? <p className="rounded-[10px] bg-[#e3f7ef] p-3 text-[13px] font-black text-[#116247]">已建立水道事項</p> : null}
        </div>
      </WorkbenchCard>
      <TodaySummaryCard />
    </div>
  );
}

function LostAndFoundPage({ employeeOnly = false }: { employeeOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"new" | "list">("new");
  const [itemCategory, setItemCategory] = useState("other");
  const [itemDescription, setItemDescription] = useState("");
  const [foundLocationNote, setFoundLocationNote] = useState("");
  const records = useQuery({ queryKey: ["/api/bff/lifeguard/lost-and-found"], queryFn: () => apiGet<{ items: Array<Record<string, string | number | null>> }>("/api/bff/lifeguard/lost-and-found") });
  const createMutation = useMutation({
    mutationFn: (payload: PhotoRecordPayload) => apiPost("/api/bff/lifeguard/lost-and-found", {
      ...payload,
      itemCategory,
      itemDescription,
      foundLocationNote,
      description: itemDescription,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/lifeguard/lost-and-found"] });
      setTab("list");
      setItemDescription("");
      setFoundLocationNote("");
    },
  });
  const claimMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/bff/lifeguard/lost-and-found/${id}/claim`, { claimedByName: window.prompt("認領人姓名") || "", claimedByContact: window.prompt("聯絡方式") || "", claimNote: "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bff/lifeguard/lost-and-found"] }),
  });
  const disposeMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/bff/lifeguard/lost-and-found/${id}/dispose`, { disposedReason: window.prompt("廢棄原因") || "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bff/lifeguard/lost-and-found"] }),
  });

  return (
    <WorkbenchCard className="p-5">
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button onClick={() => setTab("new")} className={cn("min-h-11 rounded-[10px] text-[13px] font-black", tab === "new" ? "bg-[#0d2a50] text-white" : "bg-[#f2f5f8]")}>新增</button>
        <button onClick={() => setTab("list")} className={cn("min-h-11 rounded-[10px] text-[13px] font-black", tab === "list" ? "bg-[#0d2a50] text-white" : "bg-[#f2f5f8]")}>清單</button>
      </div>
      {tab === "new" ? (
        <LifeguardCameraCapture
          module="lost_and_found"
          description={itemDescription}
          onSubmitted={async (payload) => { await createMutation.mutateAsync(payload); }}
          extraFields={
            <div className="grid gap-3">
              <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className="min-h-11 rounded-[10px] border border-[#dfe7ef] px-3 font-black">
                <option value="clothing">衣物</option>
                <option value="electronics">電子產品</option>
                <option value="valuable">貴重物</option>
                <option value="other">其他</option>
              </select>
              <input value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} className="min-h-11 rounded-[10px] border border-[#dfe7ef] px-3 font-bold" placeholder="物品描述" />
              <textarea value={foundLocationNote} onChange={(e) => setFoundLocationNote(e.target.value)} className="min-h-[88px] rounded-[10px] border border-[#dfe7ef] px-3 py-2 font-bold" placeholder="在哪裡撿到" />
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(records.data?.items ?? []).map((item) => (
            <div key={String(item.id)} className="rounded-[12px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
              {item.photoUrl ? <img src={String(item.photoUrl)} className="mb-3 h-32 w-full rounded-[10px] object-cover" alt="失物照片" /> : null}
              <p className="text-[14px] font-black text-[#10233f]">{String(item.itemDescription ?? "未命名失物")}</p>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">{String(item.foundLocationNote ?? "未填位置")}</p>
              <p className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#536175]">{String(item.claimStatus)}</p>
              {!employeeOnly && item.claimStatus === "unclaimed" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => claimMutation.mutate(Number(item.id))} className="min-h-10 rounded-[10px] bg-[#15935d] text-[12px] font-black text-white">認領</button>
                  <button onClick={() => disposeMutation.mutate(Number(item.id))} className="min-h-10 rounded-[10px] bg-[#fff1f3] text-[12px] font-black text-[#9f2434]">廢棄</button>
                </div>
              ) : null}
            </div>
          ))}
          {!records.data?.items?.length ? <div className="rounded-[12px] bg-[#f7f9fb] p-6 text-center text-[13px] font-bold text-[#637185]">尚無失物紀錄。</div> : null}
        </div>
      )}
    </WorkbenchCard>
  );
}

function LaneRentalsPage() {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "";
  const { data } = useQuery({
    queryKey: ["/api/bff/lifeguard/lane-rentals", facilityKey],
    queryFn: () => apiGet<{ items: Array<{ id: number; laneCode: string; startTime: string; endTime: string; renterName: string; note?: string | null }> }>(`/api/bff/lifeguard/lane-rentals?facilityKey=${encodeURIComponent(facilityKey)}&date=${today()}`),
    enabled: Boolean(facilityKey),
  });
  const lanes = ["A", "B", "C", "D", "E"];
  return (
    <WorkbenchCard className="p-5">
      <div className="mb-4 flex items-center gap-2 text-[13px] font-black text-[#10233f]"><CalendarDays className="h-4 w-4" />今日水道租借</div>
      <div className="grid gap-3 md:grid-cols-5">
        {lanes.map((lane) => {
          const items = (data?.items ?? []).filter((item) => item.laneCode === lane);
          return (
            <div key={lane} className="min-h-[180px] rounded-[12px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
              <p className="text-[15px] font-black text-[#10233f]">水道 {lane}</p>
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-[10px] bg-white p-2 text-[12px] font-bold text-[#536175]">
                    <p className="font-black text-[#10233f]">{item.startTime}-{item.endTime}</p>
                    <p>{item.renterName}</p>
                  </div>
                ))}
                {!items.length ? <p className="rounded-[10px] bg-white p-3 text-center text-[12px] font-bold text-[#8b9aae]">今日無租借</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </WorkbenchCard>
  );
}

function TodaySummaryCard() {
  const { data } = useQuery({ queryKey: ["/api/bff/lifeguard/records"], queryFn: () => apiGet<LifeguardRecordResponse>("/api/bff/lifeguard/records") });
  const rows = [
    ["水質", data?.waterQuality?.length ?? 0],
    ["教練", data?.coachDive?.length ?? 0],
    ["打掃", data?.cleanup?.length ?? 0],
    ["水道", data?.laneIssues?.length ?? 0],
    ["失物", data?.lostItems?.length ?? 0],
  ];
  return (
    <WorkbenchCard className="p-5">
      <h3 className="text-[16px] font-black text-[#10233f]">今日已紀錄</h3>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {rows.map(([label, count]) => (
          <div key={String(label)} className="rounded-[10px] bg-[#f7f9fb] p-3">
            <p className="text-[11px] font-black text-[#637185]">{label}</p>
            <p className="mt-1 font-mono text-[22px] font-black text-[#10233f]">{count}</p>
          </div>
        ))}
      </div>
    </WorkbenchCard>
  );
}

function LifeguardOperationDetailContent({ moduleId, employeeOnly = false }: { moduleId: LifeguardOperationModuleId; employeeOnly?: boolean }) {
  const { data: session } = useAuthMe();
  const module = getLifeguardOperationModule(moduleId);
  const activeFacility = session?.activeFacility && session.grantedFacilities.includes(session.activeFacility) ? session.activeFacility : "";

  return (
    <LifeguardShell title={module.label} subtitle={module.purpose}>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-3 rounded-[14px] border border-[#dfe7ef] bg-white p-4">
          <ModuleToneIcon moduleId={moduleId} />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#1cb4a3]">LIFEGUARD MODULE</p>
            <p className="mt-1 text-[13px] font-bold text-[#637185]">{activeFacility || "尚未選擇場館"} / {currentShiftLabel()} / {today()}</p>
          </div>
        </div>
        <Link href="/lifeguard" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#10233f]">
          <ArrowLeft className="h-4 w-4" />回首頁
        </Link>
      </div>

      {moduleId === "water-quality" || moduleId === "coach-dive" || moduleId === "cleanup" ? <PhotoModulePage moduleId={moduleId} /> : null}
      {moduleId === "lane-issues" ? <LaneIssuesPage /> : null}
      {moduleId === "lost-and-found" ? <LostAndFoundPage employeeOnly={employeeOnly} /> : null}
      {moduleId === "lane-rentals" ? <LaneRentalsPage /> : null}

      <WorkbenchCard className="mt-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[16px] font-black text-[#10233f]">完整救生員日誌</h2>
            <p className="mt-1 text-[12px] font-medium leading-5 text-[#637185]">原本日誌流程仍保留，可查看交接、日報與既有工作日誌。</p>
          </div>
          <Link href="/lifeguard/log" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-[#0d2a50] px-4 text-[12px] font-black text-white">
            <LifeBuoy className="h-4 w-4" />前往日誌
          </Link>
        </div>
      </WorkbenchCard>
    </LifeguardShell>
  );
}

export function LifeguardOperationDetailPage({ moduleId }: { moduleId: LifeguardOperationModuleId }) {
  return (
    <FacilityGate role="lifeguard" title="選擇今日救生場館" subtitle="救生端會先確認 activeFacility，確認後才進入各項救生作業詳細頁。" compact>
      <LifeguardOperationDetailContent moduleId={moduleId} />
    </FacilityGate>
  );
}

export function EmployeeLostAndFoundPage() {
  return (
    <FacilityGate role="employee" title="選擇今日場館" subtitle="員工可新增與查看自己的失物招領回報。" compact>
      <LifeguardOperationDetailContent moduleId="lost-and-found" employeeOnly />
    </FacilityGate>
  );
}

export default LifeguardOperationDetailPage;
