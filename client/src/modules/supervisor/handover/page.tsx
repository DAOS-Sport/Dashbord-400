import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, FileText, ImagePlus, MapPin, MessageSquarePlus, RefreshCw, Search, X } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { createSupervisorHandover, fetchSupervisorHandovers, updateSupervisorHandover, uploadSupervisorHandoverImage } from "./api";
import { SupervisorEmptyState, SupervisorPill } from "../supervisor-ui";

type HandoverPriority = "normal" | "low" | "high";

const priorityOptions: Array<{ value: HandoverPriority; label: string }> = [
  { value: "normal", label: "一般" },
  { value: "low", label: "提醒" },
  { value: "high", label: "優先" },
];

const priorityClass: Record<HandoverPriority, string> = {
  normal: "bg-[#eef2f6] text-[#536175]",
  low: "bg-[#fff6e7] text-[#d27a16]",
  high: "bg-[#ffe8eb] text-[#ff4964]",
};

const statusMetricClass = {
  normal: "text-[#0d2a50]",
  low: "text-[#ef7d22]",
  high: "text-[#ff4964]",
  completed: "text-[#15935d]",
};

const handoverColumns = [
  { key: "pending", title: "待處理", statuses: ["pending", "claimed"] },
  { key: "progress", title: "進行中", statuses: ["in_progress", "reported"] },
  { key: "done", title: "已完成", statuses: ["done", "cancelled"] },
] as const;

const statusFilterOptions = [
  { value: "all", label: "全部狀態" },
  { value: "pending", label: "待處理" },
  { value: "claimed", label: "已認領" },
  { value: "in_progress", label: "進行中" },
  { value: "reported", label: "已回報" },
  { value: "done", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

export default function SupervisorHandoverPage() {
  const { data: session } = useAuthMe();
  const activeFacility = session?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [targetFacility, setTargetFacility] = useState(activeFacility);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<HandoverPriority>("normal");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  useEffect(() => {
    setTargetFacility(activeFacility);
  }, [activeFacility]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handoversQuery = useQuery({
    queryKey: ["/api/bff/supervisor/handovers", facilityFilter, statusFilter, keyword],
    queryFn: () => fetchSupervisorHandovers({ facilityKey: facilityFilter, status: statusFilter, q: keyword }),
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      setImageUploadError(null);
      const imageUrl = imageFile ? await uploadSupervisorHandoverImage(imageFile, targetFacility) : null;
      return createSupervisorHandover({
        facilityKey: targetFacility,
        title: title.trim(),
        content: content.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        priority,
        linkedActionType: imageUrl ? "image" : null,
        linkedActionUrl: imageUrl,
      });
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      setDueAt("");
      setPriority("normal");
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/handovers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/dashboard"] });
    },
    onError: (error) => {
      setImageUploadError(error instanceof Error ? error.message : "圖片或交辦建立失敗");
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "claimed" | "in_progress" | "reported" | "done" | "cancelled" }) => updateSupervisorHandover(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/handovers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/dashboard"] });
    },
  });
  const handovers = handoversQuery.data?.items ?? [];
  const facilities = handoversQuery.data?.facilities ?? (session?.grantedFacilities ?? []).map((facilityKey) => ({ facilityKey, facilityName: facilityKey }));
  const openItems = handovers.filter((item) => item.status !== "done" && item.status !== "cancelled");
  const normalCount = openItems.filter((item) => item.priority === "normal").length;
  const reminderCount = openItems.filter((item) => item.priority === "low").length;
  const highPriorityCount = openItems.filter((item) => item.priority === "high").length;
  const completedCount = handovers.filter((item) => item.status === "done" || item.status === "cancelled").length;
  const statusMetrics = [
    { label: "一般", value: normalCount, className: statusMetricClass.normal },
    { label: "提醒", value: reminderCount, className: statusMetricClass.low },
    { label: "優先", value: highPriorityCount, className: statusMetricClass.high },
    { label: "已完成", value: completedCount, className: statusMetricClass.completed },
  ];
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageUploadError("只能上傳圖片檔");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError("圖片大小不可超過 10MB");
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageUploadError(null);
  };
  const clearImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageUploadError(null);
  };
  const grouped = useMemo(
    () => handoverColumns.map((column) => ({
      ...column,
      items: handovers.filter((item) => column.statuses.includes(item.status as never)),
    })),
    [handovers],
  );

  return (
    <RoleShell role="supervisor" title="交接事項" subtitle="主管可查看授權館別的交接事項，依館別篩選並建立指定場館交接。">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {statusMetrics.map((metric) => (
            <WorkbenchCard key={metric.label} className="p-4">
              <p className="text-[12px] font-bold text-[#637185]">{metric.label}</p>
              <p className={cn("mt-2 text-[26px] font-black", metric.className)}>{metric.value}</p>
            </WorkbenchCard>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">新增交接事項</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">依館別同步給主管、救生與櫃台查看。</p>
              </div>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                目標館別
                <select
                  value={targetFacility}
                  onChange={(event) => setTargetFacility(event.target.value)}
                  className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold outline-none focus:border-[#2f6fe8]"
                >
                  {facilities.map((facility) => (
                    <option key={facility.facilityKey} value={facility.facilityKey}>{facility.facilityName}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                交接標題
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]" />
              </label>
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                到期時間
                <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
              </label>
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                交接內容
                <textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-40 w-full rounded-[8px] border border-[#dfe7ef] bg-white p-3 text-[14px] font-bold leading-6 outline-none focus:border-[#2f6fe8]" />
              </label>
              <div>
                <p className="mb-2 text-[12px] font-black text-[#637185]">標記為：</p>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map((option) => (
                    <button key={option.value} type="button" onClick={() => setPriority(option.value)} className={cn("min-h-9 rounded-[8px] border px-4 text-[12px] font-black", priority === option.value ? "border-[#0d2a50] bg-[#0d2a50] text-white" : "border-[#cfd9e5] bg-white text-[#536175]")}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-black text-[#637185]">圖片紀錄</p>
                {imagePreviewUrl ? (
                  <div className="overflow-hidden rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb]">
                    <img src={imagePreviewUrl} alt="交接圖片預覽" className="max-h-52 w-full bg-white object-contain" />
                    <div className="flex items-center justify-between gap-2 border-t border-[#edf2f7] px-3 py-2">
                      <p className="min-w-0 truncate text-[12px] font-bold text-[#536175]">{imageFile?.name}</p>
                      <button type="button" onClick={clearImage} className="inline-flex min-h-8 items-center gap-1 rounded-[7px] border border-[#ffc6cf] bg-white px-2 text-[12px] font-black text-[#ff4964]">
                        <X className="h-3.5 w-3.5" />
                        移除
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#9aa8ba] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-black text-[#536175]">
                    <ImagePlus className="h-5 w-5 text-[#2f6fe8]" />
                    上傳交接圖片
                    <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                  </label>
                )}
                {imageUploadError ? <p className="mt-2 text-[12px] font-bold text-[#ff4964]">{imageUploadError}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {createMutation.isPending ? (imageFile ? "上傳並送出中" : "送出中") : "建立交接事項"}
            </button>
          </WorkbenchCard>

          <WorkbenchCard className="p-5">
            <div className="mb-4 grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-black">交接看板</h2>
                <button onClick={() => handoversQuery.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                  <RefreshCw className={cn("h-4 w-4", handoversQuery.isFetching && "animate-spin")} />
                  重新整理
                </button>
              </div>
              <div className="grid gap-2 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
                <label className="grid gap-1 text-[11px] font-black text-[#637185]">
                  館別
                  <select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)} className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold text-[#10233f]">
                    <option value="all">全部館別</option>
                    {facilities.map((facility) => (
                      <option key={facility.facilityKey} value={facility.facilityKey}>{facility.facilityName}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-black text-[#637185]">
                  狀態
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold text-[#10233f]">
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-black text-[#637185]">
                  搜尋
                  <span className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
                    <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
                    <input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none" placeholder="標題、內容、人員或館別" />
                  </span>
                </label>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {handoversQuery.isLoading ? (
                <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185] lg:col-span-3">載入交接事項中...</div>
              ) : handovers.length > 0 ? (
                grouped.map((column) => (
                  <section key={column.key} className="rounded-[12px] border border-[#e5e8ec] bg-[#f8fafc] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[13px] font-black text-[#102940]">{column.title}</h3>
                      <SupervisorPill tone={column.key === "done" ? "green" : column.key === "progress" ? "blue" : "amber"}>{column.items.length}</SupervisorPill>
                    </div>
                    <div className="space-y-3">
                      {column.items.length ? column.items.map((item) => (
                        <article key={item.id} className="rounded-[10px] border border-[#e6edf4] bg-white p-3 shadow-sm">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6fe8]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words text-[13px] font-black text-[#10233f]">{item.title}</p>
                                <SupervisorPill tone="blue">{item.facilityName || item.facilityKey}</SupervisorPill>
                                <SupervisorPill tone="gray">{item.status}</SupervisorPill>
                                <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-black", priorityClass[item.priority])}>
                                  {priorityOptions.find((option) => option.value === item.priority)?.label ?? "一般"}
                                </span>
                                {item.dueAt ? <SupervisorPill tone="blue">到期 {new Date(item.dueAt).toLocaleString("zh-TW")}</SupervisorPill> : null}
                              </div>
                              <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[12px] font-bold leading-5 text-[#536175]">{item.content}</p>
                              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#8b9aae]">
                                <MapPin className="h-3.5 w-3.5" />
                                {item.facilityName || item.facilityKey}
                              </p>
                              {item.reportNote ? <p className="mt-2 rounded-[8px] bg-[#f8fafc] p-2 text-[12px] font-bold text-[#637185]">員工回報：{item.reportNote}</p> : null}
                              {item.linkedActionType === "image" && item.linkedActionUrl ? (
                                <figure className="mt-3 overflow-hidden rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb]">
                                  <img src={item.linkedActionUrl} alt={`${item.title} 圖片紀錄`} loading="lazy" className="max-h-52 w-full bg-white object-contain" />
                                  <figcaption className="border-t border-[#edf2f7] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8b9aae]">圖片紀錄</figcaption>
                                </figure>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(["claimed", "in_progress", "reported", "done", "cancelled"] as const).map((status) => (
                                  <button key={status} type="button" onClick={() => statusMutation.mutate({ id: item.id, status })} className="workbench-focus rounded-[8px] border border-[#dfe7ef] bg-white px-2 py-1 text-[11px] font-black text-[#536175]">
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-[10px] bg-white p-4 text-center text-[12px] font-bold text-[#8b9aae]">目前沒有{column.title}交接。</div>
                      )}
                    </div>
                  </section>
                ))
              ) : (
                <SupervisorEmptyState icon={CheckCircle2} title="目前沒有交接事項" description="建立後會同步出現在指定館別的主管、救生與櫃台端。" className="lg:col-span-3" />
              )}
            </div>
          </WorkbenchCard>
        </div>
      </div>
    </RoleShell>
  );
}
