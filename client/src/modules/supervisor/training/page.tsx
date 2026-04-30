import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, FilePenLine, Image as ImageIcon, Link as LinkIcon, PlayCircle, Plus, Search, Trash2 } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe } from "@/shared/auth/session";
import {
  createEmployeeResource,
  deleteEmployeeResource,
  updateEmployeeResource,
  type EmployeeResourceDTO,
} from "@/modules/employee/home/api";
import { fetchSupervisorTrainingResources } from "./api";
import { cn } from "@/lib/utils";

const categories = ["影片", "圖片", "注意事項", "流程", "新人訓練", "其他"];

const inferMediaType = (item: Pick<EmployeeResourceDTO, "subCategory" | "url">) => {
  const category = item.subCategory ?? "";
  if (category.includes("影片")) return "影片";
  if (category.includes("圖片")) return "圖片";
  if (category.includes("注意")) return "注意事項";
  if (!item.url) return "文字";
  return "連結";
};

const mediaIcon = (label: string) => {
  if (label === "影片") return PlayCircle;
  if (label === "圖片") return ImageIcon;
  if (label === "文字" || label === "注意事項") return BookOpen;
  return LinkIcon;
};

export default function SupervisorTrainingPage() {
  const { data: session } = useAuthMe();
  const queryClient = useQueryClient();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", url: "", subCategory: "影片", content: "" });

  const trainingQuery = useQuery({
    queryKey: ["/api/portal/employee-resources", facilityKey, "training", "supervisor"],
    queryFn: () => fetchSupervisorTrainingResources(facilityKey),
  });

  const items = trainingQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const byCategory = category === "全部" || (item.subCategory || inferMediaType(item)) === category;
      const byQuery = !normalizedQuery || `${item.title} ${item.content ?? ""} ${item.url ?? ""} ${item.subCategory ?? ""}`.toLowerCase().includes(normalizedQuery);
      return byCategory && byQuery;
    });
  }, [category, items, query]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", url: "", subCategory: "影片", content: "" });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/portal/employee-resources", facilityKey, "training", "supervisor"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        url: form.url.trim() || undefined,
        subCategory: form.subCategory,
        content: form.content.trim() || undefined,
      };
      if (editingId) {
        return updateEmployeeResource(editingId, {
          title: payload.title,
          url: payload.url ?? null,
          subCategory: payload.subCategory,
          content: payload.content ?? null,
        });
      }
      return createEmployeeResource({
        facilityKey,
        category: "training",
        ...payload,
        sortOrder: items.length + 1,
      });
    },
    onSuccess: () => {
      resetForm();
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployeeResource,
    onSuccess: () => {
      setConfirmingDeleteId(null);
      invalidate();
    },
  });

  const startEdit = (item: EmployeeResourceDTO) => {
    setConfirmingDeleteId(null);
    setEditingId(item.id);
    setForm({
      title: item.title,
      url: item.url ?? "",
      subCategory: item.subCategory ?? inferMediaType(item),
      content: item.content ?? "",
    });
  };

  return (
    <RoleShell role="supervisor" title="員工教材管理" subtitle="主管可新增工作影片、圖片、注意事項；員工端只負責查閱與觀看。">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <WorkbenchCard className="p-4">
              <p className="text-[12px] font-bold text-[#637185]">教材總數</p>
              <p className="mt-2 text-[26px] font-black text-[#0d2a50]">{items.length}</p>
            </WorkbenchCard>
            <WorkbenchCard className="p-4">
              <p className="text-[12px] font-bold text-[#637185]">目前場館</p>
              <p className="mt-2 truncate text-[22px] font-black text-[#15935d]">{facilityKey}</p>
            </WorkbenchCard>
            <WorkbenchCard className="p-4">
              <p className="text-[12px] font-bold text-[#637185]">員工端入口</p>
              <a href="/employee/training" className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#eef5ff] px-3 text-[12px] font-black text-[#2f6fe8]">
                開啟查閱頁
                <ExternalLink className="h-4 w-4" />
              </a>
            </WorkbenchCard>
          </div>

          <WorkbenchCard className="p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[18px] font-black text-[#10233f]">教材庫</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">資料來源：employee_resources / category=training。</p>
              </div>
            </div>
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
              <label className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
                <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {["全部", ...categories].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={cn(
                      "min-h-9 rounded-[8px] px-3 text-[12px] font-black",
                      category === item ? "bg-[#0d2a50] text-white" : "border border-[#dfe7ef] bg-white text-[#536175]",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {trainingQuery.isLoading ? (
              <DreamLoader compact label="教材資料載入中" />
            ) : trainingQuery.isError ? (
              <div className="grid min-h-[320px] place-items-center rounded-[8px] bg-[#fff7f8] p-8 text-center">
                <div>
                  <BookOpen className="mx-auto h-12 w-12 text-[#ff4964]" />
                  <p className="mt-3 text-[18px] font-black text-[#10233f]">教材資料暫時無法取得</p>
                  <p className="mt-1 text-[13px] font-bold text-[#637185]">請確認部署環境 DATABASE_URL 與 employee_resources table 是否可用。</p>
                </div>
              </div>
            ) : filtered.length ? (
              <div className="grid gap-3">
                {filtered.map((item) => {
                  const media = inferMediaType(item);
                  const Icon = mediaIcon(media);
                  return (
                    <article key={item.id} className="flex flex-col gap-3 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-4 md:flex-row md:items-center">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[14px] font-black text-[#10233f]">{item.title}</h3>
                          <span className="rounded-full bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">{item.subCategory ?? media}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#637185]">{item.content || item.url || "未填補充內容"}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">更新：{item.updatedAt}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => startEdit(item)} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                          編輯
                        </button>
                        {confirmingDeleteId === item.id ? (
                          <div className="flex gap-1 rounded-[8px] bg-[#fff0f1] p-1">
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              className="min-h-8 rounded-[7px] bg-[#db4b5a] px-3 text-[11px] font-black text-white disabled:opacity-50"
                            >
                              {deleteMutation.isPending ? "刪除中" : "確認"}
                            </button>
                            <button type="button" onClick={() => setConfirmingDeleteId(null)} className="min-h-8 rounded-[7px] bg-white px-3 text-[11px] font-black text-[#536175]">
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(item.id)}
                            className="grid min-h-9 min-w-9 place-items-center rounded-[8px] border border-[#ffd7df] bg-white text-[#ff4964]"
                            aria-label={`刪除 ${item.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-[320px] place-items-center rounded-[8px] bg-[#fbfcfd] p-8 text-center">
                <div>
                  <BookOpen className="mx-auto h-12 w-12 text-[#9aa8ba]" />
                  <p className="mt-3 text-[18px] font-black text-[#10233f]">尚未建立員工教材</p>
                  <p className="mt-1 text-[13px] font-bold text-[#637185]">新增後會出現在員工端教材頁，觀看時會寫入 TRAINING_VIEW。</p>
                </div>
              </div>
            )}
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="h-fit p-5">
          <div className="border-l-4 border-[#16b6b1] pl-3">
            <h2 className="text-[18px] font-black text-[#10233f]">{editingId ? "編輯教材" : "新增教材"}</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">保留清楚分類，讓新舊員工能快速找到操作教學。</p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              教材名稱
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              類型
              <select value={form.subCategory} onChange={(event) => setForm((current) => ({ ...current, subCategory: event.target.value }))} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none">
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              影片 / 圖片 / 連結 URL
              <input value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              注意事項
              <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="min-h-32 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <div className="flex gap-2">
              {editingId ? (
                <button type="button" onClick={resetForm} className="min-h-10 flex-1 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#536175]">
                  取消
                </button>
              ) : null}
              <button
                type="button"
                disabled={!form.title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="inline-flex min-h-10 flex-[2] items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[13px] font-black text-white disabled:opacity-50"
              >
                {editingId ? <FilePenLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saveMutation.isPending ? "儲存中..." : editingId ? "儲存修改" : "新增教材"}
              </button>
            </div>
            {saveMutation.isError || deleteMutation.isError ? <p className="text-[12px] font-bold text-[#ff4964]">操作失敗，請確認資料庫連線與權限。</p> : null}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
