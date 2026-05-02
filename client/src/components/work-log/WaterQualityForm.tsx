import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PhotoUpload from "@/components/work-log/PhotoUpload";
import { useSaveWaterQuality, type SaveWaterQualityPayload } from "@/hooks/useWorkLog";
import type { WorkLogShift, WaterQualityRecordDTO } from "@/types/portal";

interface WaterQualityStandardDTO {
  id: number;
  facilityKey: string;
  poolName: string;
  parameterName: string;
  unit: string | null;
  minValue: string | null;
  maxValue: string | null;
}

const numericLike = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? "" : String(v)));

const waterQualitySchema = z.object({
  residualChlorine: numericLike,
  ph: numericLike,
  waterTemp: numericLike,
  roomTemp: numericLike,
  dosingTime: z.string().optional().default(""),
  dosingAmount: numericLike,
  footbathStatus: z.enum(["ok", "abnormal", ""]).optional().default(""),
  lockerRoomStatus: z.enum(["ok", "abnormal", ""]).optional().default(""),
  abnormalNote: z.string().optional().default(""),
  photoUrls: z.array(z.string()).default([]),
});

type WaterQualityFormValues = z.infer<typeof waterQualitySchema>;

const FIELDS: Array<{
  name: keyof WaterQualityFormValues;
  label: string;
  parameterName: string;
  unit?: string;
  inputMode?: "decimal" | "text";
  type?: "number" | "time" | "select";
  options?: Array<{ value: string; label: string }>;
}> = [
  { name: "residualChlorine", label: "餘氯", parameterName: "residual_chlorine", unit: "mg/L", type: "number" },
  { name: "ph", label: "PH 值", parameterName: "ph", type: "number" },
  { name: "waterTemp", label: "水溫", parameterName: "water_temp", unit: "°C", type: "number" },
  { name: "roomTemp", label: "室溫", parameterName: "room_temp", unit: "°C", type: "number" },
  { name: "dosingTime", label: "加藥時間", parameterName: "dosing_time", type: "time" },
  { name: "dosingAmount", label: "加藥量", parameterName: "dosing_amount", unit: "kg", type: "number" },
  {
    name: "footbathStatus", label: "洗腳池", parameterName: "footbath_status", type: "select",
    options: [{ value: "", label: "—" }, { value: "ok", label: "正常" }, { value: "abnormal", label: "異常" }],
  },
  {
    name: "lockerRoomStatus", label: "更衣室巡視", parameterName: "locker_room_check", type: "select",
    options: [{ value: "", label: "—" }, { value: "ok", label: "正常" }, { value: "abnormal", label: "異常" }],
  },
];

interface WaterQualityFormProps {
  facilityKey: string;
  workDate: string;
  shiftType: WorkLogShift;
  poolName: string;
  scheduledTime?: string;
  scheduleId?: number;
  existingRecord?: WaterQualityRecordDTO | null;
  disabled?: boolean;
  onSaved?: (record: { isAbnormal: boolean; abnormalNote: string | null; id?: number }) => void | Promise<void>;
  testIdPrefix?: string;
}

function isOutOfRange(value: string, min: string | null, max: string | null): boolean {
  if (value === "" || value === undefined || value === null) return false;
  const num = Number(value);
  if (Number.isNaN(num)) return false;
  if (min && num < Number(min)) return true;
  if (max && num > Number(max)) return true;
  return false;
}

export default function WaterQualityForm({
  facilityKey,
  workDate,
  shiftType,
  poolName,
  scheduledTime,
  scheduleId,
  existingRecord,
  disabled = false,
  onSaved,
  testIdPrefix = "wqform",
}: WaterQualityFormProps) {
  const { toast } = useToast();
  const saveMut = useSaveWaterQuality(facilityKey, shiftType, workDate);

  const standardsQuery = useQuery<{ items: WaterQualityStandardDTO[] }>({
    queryKey: ["/api/work-logs/water-standards", { facilityKey, poolName }],
    queryFn: async () => {
      const params = new URLSearchParams({ facilityKey, poolName });
      const r = await fetch(`/api/work-logs/water-standards?${params.toString()}`);
      if (!r.ok) throw new Error("載入水質標準失敗");
      return r.json();
    },
    enabled: !!facilityKey && !!poolName,
  });

  const standardsByParam = useMemo(() => {
    const map = new Map<string, WaterQualityStandardDTO>();
    for (const s of standardsQuery.data?.items ?? []) map.set(s.parameterName, s);
    return map;
  }, [standardsQuery.data]);

  const defaultValues = useMemo<WaterQualityFormValues>(() => {
    const m = (existingRecord?.measurements ?? {}) as Record<string, string | number>;
    const get = (k: string) => (m[k] === undefined || m[k] === null ? "" : String(m[k]));
    return {
      residualChlorine: get("residual_chlorine"),
      ph: get("ph"),
      waterTemp: get("water_temp"),
      roomTemp: get("room_temp"),
      dosingTime: get("dosing_time"),
      dosingAmount: get("dosing_amount"),
      footbathStatus: (get("footbath_status") as "ok" | "abnormal" | "") || "",
      lockerRoomStatus: (get("locker_room_check") as "ok" | "abnormal" | "") || "",
      abnormalNote: existingRecord?.abnormalNote ?? "",
      // Preload existing photos so editing a record does not silently wipe
      // previously-uploaded images when the user submits without re-uploading.
      photoUrls: existingRecord?.photoUrls ?? [],
    };
  }, [existingRecord]);

  const form = useForm<WaterQualityFormValues>({
    resolver: zodResolver(waterQualitySchema),
    defaultValues,
  });

  // Reset form when switching to a different existing record (e.g. after save).
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const watched = form.watch();

  // Live abnormal preview based on standards.
  const livePreview = useMemo(() => {
    const reasons: string[] = [];
    for (const f of FIELDS) {
      if (f.type !== "number") continue;
      const std = standardsByParam.get(f.parameterName);
      if (!std) continue;
      const v = String(watched[f.name] ?? "");
      if (isOutOfRange(v, std.minValue, std.maxValue)) {
        const min = std.minValue, max = std.maxValue;
        reasons.push(`${f.label}${min ? ` 應 ≥ ${min}` : ""}${max ? `${min ? "、" : " "}≤ ${max}` : ""}（目前 ${v}${std.unit ?? ""}）`);
      }
    }
    if (watched.footbathStatus === "abnormal") reasons.push("洗腳池異常");
    if (watched.lockerRoomStatus === "abnormal") reasons.push("更衣室異常");
    return reasons;
  }, [watched, standardsByParam]);

  const onSubmit = form.handleSubmit(async (vals) => {
    const measurements: Record<string, string | number> = {};
    for (const f of FIELDS) {
      const raw = vals[f.name];
      if (raw === undefined || raw === "" || raw === null) continue;
      if (f.type === "number") {
        const num = Number(raw);
        measurements[f.parameterName] = Number.isFinite(num) ? num : String(raw);
      } else {
        measurements[f.parameterName] = String(raw);
      }
    }
    const isAbnormal = livePreview.length > 0;
    const note = vals.abnormalNote?.trim()
      || (isAbnormal ? livePreview.join("；") : "");
    const payload: SaveWaterQualityPayload = {
      facilityKey,
      workDate,
      shiftType,
      scheduleId,
      poolName,
      scheduledTime,
      measurements,
      abnormalNote: note || undefined,
      isAbnormal,
      photoUrls: vals.photoUrls?.length ? vals.photoUrls : undefined,
    };
    try {
      const res = await saveMut.mutateAsync(payload);
      const item = (res?.item ?? {}) as { id?: number; isAbnormal?: boolean; abnormalNote?: string | null };
      toast({
        title: item.isAbnormal ? "已儲存（水質異常）" : "水質已儲存",
        description: item.isAbnormal ? (item.abnormalNote ?? "請通知主管處理") : `${poolName} ${scheduledTime ?? ""}`,
        variant: item.isAbnormal ? "destructive" : "default",
      });
      await onSaved?.({
        isAbnormal: !!item.isAbnormal,
        abnormalNote: item.abnormalNote ?? null,
        id: item.id,
      });
    } catch (err) {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    }
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid={`${testIdPrefix}-form`}>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => {
          const std = standardsByParam.get(f.parameterName);
          const value = String(watched[f.name] ?? "");
          const outOfRange = f.type === "number" && std ? isOutOfRange(value, std.minValue, std.maxValue) : false;
          const reg = form.register(f.name);
          return (
            <div key={f.name} className="space-y-1">
              <label className="text-[11px] text-slate-600 flex items-center gap-1">
                <span className="font-medium">{f.label}</span>
                {std && (
                  <span className="text-slate-400">
                    （{std.minValue ?? "—"}~{std.maxValue ?? "—"}{std.unit ? ` ${std.unit}` : ""}）
                  </span>
                )}
              </label>
              {f.type === "select" ? (
                <select
                  {...reg}
                  disabled={disabled || saveMut.isPending}
                  className={`w-full text-sm h-9 rounded-md border px-2 bg-white ${outOfRange || value === "abnormal" ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
                  data-testid={`${testIdPrefix}-${f.name}`}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type={f.type === "time" ? "time" : "text"}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  {...reg}
                  disabled={disabled || saveMut.isPending}
                  className={`text-sm h-9 ${outOfRange ? "border-rose-400 bg-rose-50" : ""}`}
                  data-testid={`${testIdPrefix}-${f.name}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] text-slate-600 font-medium">照片（選填）</label>
        <PhotoUpload
          value={form.watch("photoUrls") ?? []}
          onChange={(urls) => form.setValue("photoUrls", urls, { shouldDirty: true })}
          facilityKey={facilityKey}
          folder="work-logs/water-quality"
          max={5}
          disabled={disabled || saveMut.isPending}
          testIdPrefix={`${testIdPrefix}-photos`}
        />
      </div>

      {livePreview.length > 0 && (
        <div
          className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 space-y-1"
          data-testid={`${testIdPrefix}-abnormal-warning`}
        >
          <p className="font-bold">⚠ 水質異常（將自動建立異常案件通知主管）</p>
          <ul className="list-disc list-inside space-y-0.5">
            {livePreview.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <Textarea
        rows={2}
        placeholder="備註（異常原因或處置措施）"
        {...form.register("abnormalNote")}
        disabled={disabled || saveMut.isPending}
        className="text-xs"
        data-testid={`${testIdPrefix}-note`}
      />

      {Object.keys(errors).length > 0 && (
        <p className="text-xs text-rose-600">表單欄位有誤，請檢查</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {existingRecord ? `已記錄於 ${new Date(existingRecord.recordedAt).toLocaleString("zh-TW")}` : "尚未記錄"}
        </p>
        <Button
          type="submit"
          size="sm"
          disabled={disabled || saveMut.isPending}
          data-testid={`${testIdPrefix}-submit`}
        >
          {saveMut.isPending ? "儲存中..." : existingRecord ? "更新水質紀錄" : "儲存水質紀錄"}
        </Button>
      </div>
    </form>
  );
}
