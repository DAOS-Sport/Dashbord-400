import { useMemo, useState } from "react";
import PortalShell from "@/components/portal/PortalShell";
import BentoCard from "@/components/portal/BentoCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePortalAuth } from "@/hooks/use-bound-facility";
import { getFacilityConfig } from "@/config/facility-configs";
import PhotoUpload from "@/components/work-log/PhotoUpload";
import {
  useTodayWorkLog,
  useCompleteTask,
  useConfirmHandover,
  useCreateLifeguardHandover,
  useSubmitDailyReport,
  type CompleteTaskPayload,
} from "@/hooks/useWorkLog";
import type {
  WorkLogShift,
  WorkLogTaskItem,
  LifeguardHandoverItem,
  WaterQualitySlot,
} from "@/types/portal";

const SHIFT_LABEL: Record<WorkLogShift, string> = { morning: "早班", noon: "中班", night: "晚班" };
const WEEKDAY_LABEL = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const HANDOVER_CATEGORY_LABEL: Record<string, string> = {
  facility: "設施",
  customer: "客務",
  safety: "安全",
  general: "一般",
};

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>;
}

function autoDetectShift(): WorkLogShift {
  const now = new Date();
  const taipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const h = taipei.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "noon";
  return "night";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

interface TaskInputProps {
  task: WorkLogTaskItem;
  draftValue: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
  disabled: boolean;
  facilityKey: string;
}

function TaskInputRenderer({ task, draftValue, onChange, disabled, facilityKey }: TaskInputProps) {
  const value = (draftValue ?? task.inputValue ?? {}) as Record<string, unknown>;
  const config = (task.inputConfig ?? {}) as Record<string, unknown>;

  switch (task.inputType) {
    case "checkbox":
      return null; // Completion checkbox handled by parent
    case "text":
    case "textarea":
      return (
        <Textarea
          rows={task.inputType === "textarea" ? 3 : 2}
          placeholder={(config.placeholder as string) || "請輸入..."}
          value={typeof value.text === "string" ? value.text : ""}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          disabled={disabled}
          data-testid={`input-text-${task.source}-${task.refId}`}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          step="any"
          placeholder={(config.placeholder as string) || "請輸入數字"}
          value={typeof value.number === "number" || typeof value.number === "string" ? String(value.number) : ""}
          onChange={(e) => onChange({ ...value, number: e.target.value === "" ? "" : Number(e.target.value) })}
          disabled={disabled}
          data-testid={`input-number-${task.source}-${task.refId}`}
        />
      );
    case "select": {
      const options = Array.isArray(config.options) ? (config.options as string[]) : [];
      return (
        <Select
          value={typeof value.select === "string" ? value.select : ""}
          onValueChange={(v) => onChange({ ...value, select: v })}
          disabled={disabled}
        >
          <SelectTrigger data-testid={`input-select-${task.source}-${task.refId}`}>
            <SelectValue placeholder="請選擇" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case "multiselect": {
      const options = Array.isArray(config.options) ? (config.options as string[]) : [];
      const current = Array.isArray(value.multiselect) ? (value.multiselect as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const checked = current.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  const next = checked ? current.filter((c) => c !== o) : [...current, o];
                  onChange({ ...value, multiselect: next });
                }}
                disabled={disabled}
                className={`px-3 py-1 rounded-full text-xs border transition ${checked ? "bg-stitch-secondary text-white border-stitch-secondary" : "bg-white text-stitch-on-surface border-slate-300 hover:bg-slate-50"}`}
                data-testid={`input-multi-${task.source}-${task.refId}-${o}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "time":
      return (
        <Input
          type="time"
          value={typeof value.time === "string" ? value.time : ""}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          disabled={disabled}
          data-testid={`input-time-${task.source}-${task.refId}`}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={typeof value.date === "string" ? value.date : ""}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          disabled={disabled}
          data-testid={`input-date-${task.source}-${task.refId}`}
        />
      );
    case "rating": {
      const max = typeof config.max === "number" ? config.max : 5;
      const current = typeof value.rating === "number" ? value.rating : 0;
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, i) => {
            const star = i + 1;
            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange({ ...value, rating: star })}
                disabled={disabled}
                className={`text-2xl ${star <= current ? "text-amber-400" : "text-slate-300"}`}
                data-testid={`input-rating-${task.source}-${task.refId}-${star}`}
              >
                ★
              </button>
            );
          })}
        </div>
      );
    }
    case "photo":
    case "number_photo":
    case "checkbox_photo": {
      const photoUrls = Array.isArray(value.photoUrls) ? (value.photoUrls as string[]) : [];
      const maxPhotos = typeof config.maxPhotos === "number" ? config.maxPhotos : 5;
      return (
        <div className="space-y-2">
          {task.inputType === "number_photo" && (
            <Input
              type="number"
              step="any"
              placeholder="請輸入數字"
              value={typeof value.number === "number" || typeof value.number === "string" ? String(value.number) : ""}
              onChange={(e) => onChange({ ...value, number: e.target.value === "" ? "" : Number(e.target.value) })}
              disabled={disabled}
              data-testid={`input-numphoto-${task.source}-${task.refId}`}
            />
          )}
          <PhotoUpload
            value={photoUrls}
            onChange={(urls) => onChange({ ...value, photoUrls: urls })}
            facilityKey={facilityKey}
            folder="work-logs/tasks"
            max={maxPhotos}
            disabled={disabled}
            testIdPrefix={`photo-${task.source}-${task.refId}`}
          />
        </div>
      );
    }
    default:
      return <span className="text-xs text-slate-400">不支援的輸入類型：{task.inputType}</span>;
  }
}

interface TaskRowProps {
  task: WorkLogTaskItem;
  facilityKey: string;
  workDate: string;
  shiftType: WorkLogShift;
  onComplete: (payload: CompleteTaskPayload) => Promise<unknown>;
  isPending: boolean;
  disabled: boolean;
}

function TaskRow({ task, facilityKey, workDate, shiftType, onComplete, isPending, disabled }: TaskRowProps) {
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState<string>(task.notes ?? "");
  const isCheckboxOnly = task.inputType === "checkbox";

  const handleToggle = async (next: boolean) => {
    await onComplete({
      facilityKey, workDate, shiftType,
      taskSource: task.source,
      taskRefId: task.refId,
      taskName: task.taskName,
      isCompleted: next,
      inputValue: draft ?? task.inputValue ?? undefined,
      notes: notes || undefined,
    });
  };

  const handleSave = async () => {
    await onComplete({
      facilityKey, workDate, shiftType,
      taskSource: task.source,
      taskRefId: task.refId,
      taskName: task.taskName,
      isCompleted: true,
      inputValue: draft ?? task.inputValue ?? undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 transition ${task.isCompleted ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}
      data-testid={`task-row-${task.source}-${task.refId}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.isCompleted}
          onCheckedChange={(v) => handleToggle(!!v)}
          disabled={disabled || isPending}
          className="mt-1"
          data-testid={`checkbox-${task.source}-${task.refId}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${task.isCompleted ? "text-emerald-700 line-through" : "text-stitch-primary"}`}>
              {task.taskName}
            </span>
            {task.isRequired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">必填</span>}
            {task.source === "assigned" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">指派</span>}
            {task.source === "recurring" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">週期</span>}
            {task.completedBy && <span className="text-[10px] text-emerald-600">{task.completedBy} · {formatTime(task.completedAt)}</span>}
          </div>
          {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
          {!isCheckboxOnly && (
            <div className="mt-2 space-y-2">
              <TaskInputRenderer task={task} draftValue={draft} onChange={setDraft} disabled={disabled || isPending} facilityKey={facilityKey} />
              <Textarea
                rows={1}
                placeholder="備註（選填）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={disabled || isPending}
                className="text-xs"
                data-testid={`input-notes-${task.source}-${task.refId}`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={disabled || isPending}
                data-testid={`button-save-${task.source}-${task.refId}`}
              >
                {task.isCompleted ? "更新" : "儲存並標記完成"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  icon: string;
  title: string;
  badge?: string;
  count?: { done: number; total: number };
}

function SectionHeader({ icon, title, badge, count }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-stitch-secondary shrink-0" style={{ background: "rgba(0,107,96,0.1)" }}>
        <MaterialIcon name={icon} />
      </div>
      <div className="flex-1">
        {badge && <p className="portal-label text-stitch-secondary">{badge}</p>}
        <h2 className="font-headline text-lg font-bold text-stitch-primary mt-0.5">{title}</h2>
      </div>
      {count && (
        <span className={`text-xs font-bold ${count.done >= count.total ? "text-emerald-600" : "text-amber-600"}`}>
          {count.done} / {count.total}
        </span>
      )}
    </div>
  );
}

interface HandoverPanelProps {
  items: LifeguardHandoverItem[];
  onConfirm: (id: number) => Promise<unknown>;
  isPending: boolean;
  disabled: boolean;
}

function HandoverPanel({ items, onConfirm, isPending, disabled }: HandoverPanelProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 px-3 py-6 text-center">前一班次尚未留下交接事項</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((h) => (
        <div
          key={h.id}
          className={`rounded-xl border px-4 py-3 ${h.isConfirmed ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
          data-testid={`handover-item-${h.id}`}
        >
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{HANDOVER_CATEGORY_LABEL[h.category] ?? h.category}</span>
            <span className="text-[10px] text-slate-500">{h.authorName ?? "-"} · {SHIFT_LABEL[h.fromShift as WorkLogShift] ?? h.fromShift}</span>
            <span className="text-[10px] text-slate-400 ml-auto">{formatTime(h.createdAt)}</span>
          </div>
          <p className="text-sm text-stitch-primary mt-2 whitespace-pre-wrap">{h.content}</p>
          <div className="flex items-center justify-between mt-2">
            {h.isConfirmed ? (
              <span className="text-xs text-emerald-700">已確認 · {h.confirmedByName} · {formatTime(h.confirmedAt)}</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onConfirm(h.id)}
                disabled={disabled || isPending}
                data-testid={`button-confirm-handover-${h.id}`}
              >
                <MaterialIcon name="check_circle" className="text-sm mr-1" /> 我已知悉
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface WaterPanelProps {
  slots: WaterQualitySlot[];
}

function WaterPanel({ slots }: WaterPanelProps) {
  if (slots.length === 0) {
    return <p className="text-sm text-slate-500 px-3 py-6 text-center">本班次無水質量測排程</p>;
  }
  return (
    <div className="space-y-2">
      {slots.map((s) => (
        <div
          key={s.scheduleId}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.isCompleted ? (s.isAbnormal ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200") : "bg-white border-slate-200"}`}
          data-testid={`water-slot-${s.scheduleId}`}
        >
          <MaterialIcon name={s.isCompleted ? (s.isAbnormal ? "warning" : "check_circle") : "schedule"} className={s.isAbnormal ? "text-rose-500" : s.isCompleted ? "text-emerald-500" : "text-slate-400"} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stitch-primary">{s.poolName}</p>
            <p className="text-xs text-slate-500">{s.scheduledTime}</p>
          </div>
          {s.isCompleted ? (
            <span className="text-[11px] text-slate-500">{s.recordedBy} · {formatTime(s.recordedAt)}</span>
          ) : (
            <span className="text-[11px] text-amber-600">待量測</span>
          )}
        </div>
      ))}
      <p className="text-[11px] text-slate-400 px-2">水質量測表單將於下一階段開放（v2）。目前可在後台直接寫入水質紀錄。</p>
    </div>
  );
}

export default function PortalWorkLog({ facilityKey }: { facilityKey: string }) {
  const config = getFacilityConfig(facilityKey);
  const { auth } = usePortalAuth();
  const { toast } = useToast();
  const [shiftType, setShiftType] = useState<WorkLogShift>(autoDetectShift());

  const todayQuery = useTodayWorkLog(facilityKey, shiftType);
  const completeMut = useCompleteTask(facilityKey, shiftType);
  const confirmMut = useConfirmHandover(facilityKey, shiftType);
  const handoverMut = useCreateLifeguardHandover(facilityKey, shiftType);
  const submitMut = useSubmitDailyReport(facilityKey, shiftType);

  const [handoverContent, setHandoverContent] = useState("");
  const [handoverCategory, setHandoverCategory] = useState<"facility" | "customer" | "safety" | "general">("general");

  const data = todayQuery.data;
  const isLoading = todayQuery.isLoading;

  const submission = data?.submission;
  const submittedLocked = submission?.status === "submitted" || submission?.status === "approved";

  const dailyTasks = data?.sections.dailyTasks ?? [];
  const assignedTasks = data?.sections.assignedTasks ?? [];
  const recurringTasks = data?.sections.recurringTasks ?? [];
  const handoverItems = data?.sections.handover ?? [];
  const waterSlots = data?.sections.waterQuality.schedules ?? [];

  const dailyDoneCount = dailyTasks.filter((t) => t.isCompleted).length;
  const assignedDoneCount = assignedTasks.filter((t) => t.isCompleted).length;
  const recurringDoneCount = recurringTasks.filter((t) => t.isCompleted).length;
  const handoverConfirmedCount = handoverItems.filter((h) => !h.canConfirm).length;
  const waterDoneCount = waterSlots.filter((s) => s.isCompleted).length;

  const progressPercent = useMemo(() => {
    if (!data) return 0;
    const total = data.progress.totalRequired;
    if (total === 0) return 100;
    return Math.round((data.progress.totalCompleted / total) * 100);
  }, [data]);

  const handleCompleteTask = async (payload: CompleteTaskPayload) => {
    try {
      await completeMut.mutateAsync(payload);
    } catch (err) {
      toast({ title: "更新任務失敗", description: err instanceof Error ? err.message : "請稍後再試", variant: "destructive" });
    }
  };

  const handleConfirmHandover = async (id: number) => {
    try {
      await confirmMut.mutateAsync(id);
      toast({ title: "已確認交接" });
    } catch (err) {
      toast({ title: "確認失敗", description: err instanceof Error ? err.message : "請稍後再試", variant: "destructive" });
    }
  };

  const handleCreateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handoverContent.trim();
    if (!trimmed || !data) return;
    const next = shiftType === "morning" ? "noon" : shiftType === "noon" ? "night" : "morning";
    try {
      await handoverMut.mutateAsync({
        facilityKey,
        workDate: data.workDate,
        fromShift: shiftType,
        toShift: next,
        category: handoverCategory,
        content: trimmed,
      });
      setHandoverContent("");
      toast({ title: "交接事項已留給下一班" });
    } catch (err) {
      toast({ title: "建立失敗", description: err instanceof Error ? err.message : "請稍後再試", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!data) return;
    try {
      await submitMut.mutateAsync({ facilityKey, workDate: data.workDate, shiftType });
      toast({ title: "日報已送出，等待主管核可" });
    } catch (err) {
      const e = err as Error & { missing?: Array<{ source: string; taskName: string }> };
      const list = e.missing?.slice(0, 5).map((m) => m.taskName).join("、") ?? "";
      toast({
        title: "尚有未完成項目",
        description: list ? `請先完成：${list}${e.missing && e.missing.length > 5 ? " ...等" : ""}` : (e.message || "請稍後再試"),
        variant: "destructive",
      });
    }
  };

  return (
    <PortalShell facilityKey={facilityKey} pageTitle="救生員日誌">
      {() => (
        <div className="space-y-5">
          {/* 頂部資訊卡 */}
          <BentoCard testId="section-worklog-header" variant="white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg,#006b60,#003a55)" }}>
                  <MaterialIcon name="assignment_turned_in" />
                </div>
                <div>
                  <p className="portal-label text-stitch-secondary">TODAY · WORK LOG</p>
                  <h1 className="font-headline text-xl font-bold text-stitch-primary mt-1" data-testid="text-worklog-title">
                    {config?.facilityName ?? facilityKey} · 救生員日誌
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {data?.workDate ?? "..."} ・ {WEEKDAY_LABEL[data?.weekday ?? 0]} ・ <span className="text-stitch-primary font-semibold">{auth?.name ?? "未登入"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(["morning", "noon", "night"] as WorkLogShift[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShiftType(s)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${shiftType === s ? "bg-stitch-primary text-white border-stitch-primary" : "bg-white text-stitch-primary border-slate-300 hover:bg-slate-50"}`}
                    data-testid={`button-shift-${s}`}
                  >
                    {SHIFT_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">今日進度</span>
                <span className="font-bold text-stitch-primary" data-testid="text-progress-summary">
                  {data?.progress.totalCompleted ?? 0} / {data?.progress.totalRequired ?? 0}（{progressPercent}%）
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                  style={{ width: `${progressPercent}%` }}
                  data-testid="progressbar-worklog"
                />
              </div>
              {submission && (
                <p className={`text-xs mt-2 ${submission.status === "approved" ? "text-emerald-600" : submission.status === "returned" ? "text-rose-600" : "text-amber-600"}`} data-testid="text-submission-status">
                  日報狀態：{submission.status === "submitted" ? "已送出（等待主管）" : submission.status === "approved" ? `已核可（${submission.reviewedByName ?? "-"}）` : `退件（${submission.reviewNote ?? "請補正"}）`}
                </p>
              )}
            </div>
          </BentoCard>

          {isLoading && (
            <BentoCard testId="section-worklog-loading" variant="white">
              <p className="text-sm text-slate-500 text-center py-8">載入今日工作中...</p>
            </BentoCard>
          )}

          {todayQuery.isError && (
            <BentoCard testId="section-worklog-error" variant="white">
              <div className="flex items-center gap-3 text-rose-600 py-6 px-2">
                <MaterialIcon name="error" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">載入今日工作失敗</p>
                  <p className="text-xs text-slate-500 mt-1">{todayQuery.error instanceof Error ? todayQuery.error.message : "請稍後再試"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => todayQuery.refetch()} data-testid="button-worklog-retry">
                  <MaterialIcon name="refresh" className="text-sm mr-1" /> 重新載入
                </Button>
              </div>
            </BentoCard>
          )}

          {data && (
            <>
              {/* 水質量測 */}
              <BentoCard testId="section-water" variant="white">
                <SectionHeader icon="water_drop" title="水質量測" badge="WATER QUALITY" count={{ done: waterDoneCount, total: waterSlots.length }} />
                <WaterPanel slots={waterSlots} />
              </BentoCard>

              {/* 每日固定任務 */}
              <BentoCard testId="section-daily" variant="white">
                <SectionHeader icon="checklist" title="每日固定任務" badge="DAILY TASKS" count={{ done: dailyDoneCount, total: dailyTasks.length }} />
                {dailyTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">本班次尚無設定固定任務</p>
                ) : (
                  <div className="space-y-2">
                    {dailyTasks.map((t) => (
                      <TaskRow
                        key={`daily-${t.refId}`}
                        task={t}
                        facilityKey={facilityKey}
                        workDate={data.workDate}
                        shiftType={shiftType}
                        onComplete={handleCompleteTask}
                        isPending={completeMut.isPending}
                        disabled={submittedLocked}
                      />
                    ))}
                  </div>
                )}
              </BentoCard>

              {/* 指派任務 */}
              <BentoCard testId="section-assigned" variant="white">
                <SectionHeader icon="assignment_ind" title="主管指派任務" badge="ASSIGNED" count={{ done: assignedDoneCount, total: assignedTasks.length }} />
                {assignedTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">目前無指派任務</p>
                ) : (
                  <div className="space-y-2">
                    {assignedTasks.map((t) => (
                      <TaskRow
                        key={`assigned-${t.refId}`}
                        task={t}
                        facilityKey={facilityKey}
                        workDate={data.workDate}
                        shiftType={shiftType}
                        onComplete={handleCompleteTask}
                        isPending={completeMut.isPending}
                        disabled={submittedLocked}
                      />
                    ))}
                  </div>
                )}
              </BentoCard>

              {/* 週期任務 */}
              <BentoCard testId="section-recurring" variant="white">
                <SectionHeader icon="event_repeat" title="週期任務" badge="RECURRING" count={{ done: recurringDoneCount, total: recurringTasks.length }} />
                {recurringTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">今日無週期任務排程</p>
                ) : (
                  <div className="space-y-2">
                    {recurringTasks.map((t) => (
                      <TaskRow
                        key={`recurring-${t.refId}`}
                        task={t}
                        facilityKey={facilityKey}
                        workDate={data.workDate}
                        shiftType={shiftType}
                        onComplete={handleCompleteTask}
                        isPending={completeMut.isPending}
                        disabled={submittedLocked}
                      />
                    ))}
                  </div>
                )}
              </BentoCard>

              {/* 救生員交接 */}
              <BentoCard testId="section-handover" variant="white">
                <SectionHeader
                  icon="handshake"
                  title="救生員交接事項"
                  badge="HANDOVER"
                  count={{ done: handoverConfirmedCount, total: handoverItems.length }}
                />
                <HandoverPanel
                  items={handoverItems}
                  onConfirm={handleConfirmHandover}
                  isPending={confirmMut.isPending}
                  disabled={submittedLocked}
                />
                {!submittedLocked && (
                  <form onSubmit={handleCreateHandover} className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">留交接給下一班次</p>
                    <div className="flex gap-2">
                      <Select value={handoverCategory} onValueChange={(v) => setHandoverCategory(v as typeof handoverCategory)}>
                        <SelectTrigger className="w-32" data-testid="select-handover-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">一般</SelectItem>
                          <SelectItem value="facility">設施</SelectItem>
                          <SelectItem value="customer">客務</SelectItem>
                          <SelectItem value="safety">安全</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        rows={2}
                        placeholder="輸入交接內容..."
                        value={handoverContent}
                        onChange={(e) => setHandoverContent(e.target.value)}
                        className="flex-1"
                        data-testid="input-handover-content"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={handoverMut.isPending || !handoverContent.trim()}
                      data-testid="button-create-handover"
                    >
                      <MaterialIcon name="send" className="text-sm mr-1" /> 留下交接
                    </Button>
                  </form>
                )}
              </BentoCard>

              {/* 送出日報 */}
              <BentoCard testId="section-submit" variant="white">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="portal-label text-stitch-secondary">SUBMIT</p>
                    <h2 className="font-headline text-lg font-bold text-stitch-primary mt-0.5">送出今日工作日報</h2>
                    <p className="text-xs text-slate-500 mt-1">送出後將鎖定本班次紀錄並送主管核可</p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={submitMut.isPending || submittedLocked}
                    className="bg-stitch-primary text-white hover:bg-stitch-primary/90"
                    data-testid="button-submit-daily-report"
                  >
                    <MaterialIcon name="send" className="text-sm mr-2" />
                    {submittedLocked ? (submission?.status === "approved" ? "已核可" : "已送出") : "送出日報"}
                  </Button>
                </div>
              </BentoCard>
            </>
          )}
        </div>
      )}
    </PortalShell>
  );
}
