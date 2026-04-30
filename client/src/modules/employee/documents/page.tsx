import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Link as LinkIcon, Pencil, Plus, Search } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { createEmployeeResource, fetchEmployeeHome, updateEmployeeResource } from "@/modules/employee/home/api";
import { EmployeeResourceActions } from "@/modules/employee/resources/employee-resource-actions";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

const defaultDocumentCategoryOptions = ["點名/報到", "文件", "表單", "規則", "課程", "其他"];
type DocumentSortMode = "custom" | "name" | "category" | "recent";
const sortModeLabels: Record<DocumentSortMode, string> = {
  custom: "自訂",
  name: "名稱",
  category: "分類",
  recent: "最近更新",
};

const isExternalUrl = (url?: string) => Boolean(url && /^https?:\/\//i.test(url));
const normalizeSortDate = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function EmployeeDocumentsPage() {
  const queryClient = useQueryClient();
  const homeQuery = useQuery({
    queryKey: ["/api/bff/employee/home", "documents"],
    queryFn: fetchEmployeeHome,
  });
  const facilityKey = homeQuery.data?.facility.key ?? "xinbei_pool";
  const documents = homeQuery.data?.documents.data ?? [];
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [subCategory, setSubCategory] = useState("文件");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>(defaultDocumentCategoryOptions);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [sortMode, setSortMode] = useState<DocumentSortMode>("custom");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const preferenceKey = `junsi.cms.employee.documents.preferences.${homeQuery.data?.currentUser?.id ?? "local"}`;
  const categoryPreferenceKey = `junsi.cms.employee.documents.categories.${homeQuery.data?.currentUser?.id ?? "local"}`;

  const allCategoryOptions = useMemo(() => {
    const fromDocuments = documents.map((doc) => doc.subCategory).filter((value): value is string => Boolean(value?.trim()));
    return Array.from(new Set([...defaultDocumentCategoryOptions, ...categoryOptions, ...fromDocuments]));
  }, [categoryOptions, documents]);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const categoryScoped = categoryFilter === "全部"
      ? documents
      : documents.filter((doc) => (doc.subCategory || "文件") === categoryFilter);
    const base = normalized
      ? categoryScoped.filter((doc) =>
        `${doc.title} ${doc.description ?? ""} ${doc.url ?? ""} ${doc.subCategory ?? ""}`.toLowerCase().includes(normalized),
      )
      : categoryScoped;
    const customIndex = new Map(customOrder.map((id, index) => [id, index]));
    return [...base].sort((a, b) => {
      if (sortMode === "name") return a.title.localeCompare(b.title, "zh-TW");
      if (sortMode === "category") return (a.subCategory ?? "其他").localeCompare(b.subCategory ?? "其他", "zh-TW") || a.title.localeCompare(b.title, "zh-TW");
      if (sortMode === "recent") return normalizeSortDate(b.updatedAt) - normalizeSortDate(a.updatedAt);
      const aIndex = customIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = customIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.title.localeCompare(b.title, "zh-TW");
    });
  }, [categoryFilter, documents, query, sortMode, customOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(preferenceKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { sortMode?: DocumentSortMode; customOrder?: string[] };
      if (parsed.sortMode && parsed.sortMode in sortModeLabels) setSortMode(parsed.sortMode);
      if (Array.isArray(parsed.customOrder)) setCustomOrder(parsed.customOrder);
    } catch {
      window.localStorage.removeItem(preferenceKey);
    }
  }, [preferenceKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(categoryPreferenceKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setCategoryOptions(Array.from(new Set([...defaultDocumentCategoryOptions, ...parsed.filter(Boolean)])));
      }
    } catch {
      window.localStorage.removeItem(categoryPreferenceKey);
    }
  }, [categoryPreferenceKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(preferenceKey, JSON.stringify({ sortMode, customOrder }));
  }, [customOrder, preferenceKey, sortMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const customOnly = categoryOptions.filter((item) => !defaultDocumentCategoryOptions.includes(item));
    window.localStorage.setItem(categoryPreferenceKey, JSON.stringify(customOnly));
  }, [categoryOptions, categoryPreferenceKey]);

  const addCategory = () => {
    const next = customCategory.trim();
    if (!next) return;
    setCategoryOptions((items) => Array.from(new Set([...items, next])));
    setSubCategory(next);
    setCategoryFilter(next);
    setCustomCategory("");
  };

  const moveDocument = (id: string, direction: -1 | 1) => {
    const order = customOrder.length ? [...customOrder] : filteredDocuments.map((doc) => doc.id);
    const index = order.indexOf(id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    setSortMode("custom");
    setCustomOrder(order);
  };

  const getLinkProps = (docUrl?: string) => ({
    href: docUrl || undefined,
    target: isExternalUrl(docUrl) ? "_blank" : undefined,
    rel: isExternalUrl(docUrl) ? "noreferrer" : undefined,
  });

  const resetForm = () => {
    setEditingResourceId(null);
    setTitle("");
    setContent("");
    setUrl("");
    setSubCategory("文件");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "documents"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingResourceId) {
        return updateEmployeeResource(editingResourceId, {
          title: title.trim(),
          content: content.trim() || null,
          url: url.trim() || null,
          subCategory,
        });
      }
      return createEmployeeResource({
        facilityKey,
        category: "document",
        subCategory,
        title: title.trim(),
        content: content.trim() || undefined,
        url: url.trim() || undefined,
        sortOrder: documents.length + 1,
      });
    },
    onSuccess: () => {
      resetForm();
      invalidate();
    },
  });

  const startEdit = (doc: typeof documents[number]) => {
    if (!doc.resourceId) return;
    setEditingResourceId(doc.resourceId);
    setTitle(doc.title);
    setContent(doc.description ?? "");
    setUrl(doc.url ?? "");
    setSubCategory(doc.subCategory || "文件");
  };

  return (
    <EmployeeShell title="常用文件" subtitle="">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <WorkbenchCard className="min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[18px] font-black text-[#10233f]">常用連結資料庫</h2>
            </div>
            <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[12px] font-black text-[#1f6fd1]">{documents.length} 筆</span>
          </div>

          <label className="mb-4 flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3">
            <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
            <input
              aria-label="搜尋常用文件"
              name="document-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none placeholder:text-[#9aa8ba]"
              placeholder="搜尋文件名稱、用途或連結…"
            />
          </label>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-black text-[#536175]">分類</span>
            {["全部", ...allCategoryOptions].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category)}
                className={`min-h-9 rounded-[8px] px-3 text-[12px] font-black ${categoryFilter === category ? "bg-[#eaf8ef] text-[#15935d]" : "border border-[#dfe7ef] bg-white text-[#536175]"}`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-black text-[#536175]">排序</span>
            {(Object.keys(sortModeLabels) as DocumentSortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`min-h-9 rounded-[8px] px-3 text-[12px] font-black ${sortMode === mode ? "bg-[#0d2a50] text-white" : "border border-[#dfe7ef] bg-white text-[#536175]"}`}
              >
                {sortModeLabels[mode]}
              </button>
            ))}
          </div>

          {homeQuery.isLoading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-[13px] font-bold text-[#637185]">載入常用文件中...</div>
          ) : filteredDocuments.length ? (
            <div className="overflow-hidden rounded-[8px] border border-[#edf2f7]">
              <div className="hidden grid-cols-[80px_minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(120px,0.65fr)_minmax(160px,1fr)_120px] gap-3 bg-[#f7f9fb] px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8b9aae] lg:grid">
                <span>排序</span>
                <span>名稱</span>
                <span>連結</span>
                <span>分類</span>
                <span>用途</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-[#edf2f7]">
                {filteredDocuments.map((doc) => (
                  <article key={doc.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[80px_minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(120px,0.65fr)_minmax(160px,1fr)_120px] lg:items-center">
                    <div className="flex gap-1">
                      <button type="button" aria-label={`上移 ${doc.title}`} onClick={() => moveDocument(doc.id, -1)} className="workbench-focus grid h-8 w-8 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175]">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={`下移 ${doc.title}`} onClick={() => moveDocument(doc.id, 1)} className="workbench-focus grid h-8 w-8 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175]">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#eef5ff] text-[#1f6fd1]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-black text-[#10233f]">{doc.title}</h3>
                        <p className="mt-1 truncate text-[11px] font-bold text-[#8b9aae]">更新：{doc.updatedAt}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      {doc.url ? (
                        <a {...getLinkProps(doc.url)} className="workbench-focus inline-flex max-w-full min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                          <LinkIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{doc.url}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#8b9aae]" />
                        </a>
                      ) : (
                        <span className="text-[12px] font-bold text-[#8b9aae]">尚未設定連結</span>
                      )}
                    </div>
                    <span className="w-fit rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-black text-[#1f6fd1]">{doc.subCategory || "文件"}</span>
                    <p className="line-clamp-2 text-[12px] font-bold leading-5 text-[#637185]">{doc.description || "無備註"}</p>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      {doc.resourceId ? (
                        <>
                          <button
                            type="button"
                            aria-label={`編輯 ${doc.title}`}
                            onClick={() => startEdit(doc)}
                            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <EmployeeResourceActions
                            resourceId={doc.resourceId}
                            title={doc.title}
                            content={doc.description}
                            url={doc.url}
                            allowEdit={false}
                            onChanged={invalidate}
                            className="mt-0"
                          />
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid min-h-[320px] place-items-center rounded-[8px] bg-[#fbfcfd] p-6 text-center">
              <div>
                <FileText className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                <p className="mt-3 text-[16px] font-black text-[#10233f]">尚未新增常用連結</p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">請在右側新增名稱、URL 與用途。</p>
              </div>
            </div>
          )}
        </WorkbenchCard>

        <WorkbenchCard className="h-fit p-5">
          <div className="border-l-4 border-[#16b6b1] pl-3">
            <h2 className="text-[18px] font-black text-[#10233f]">{editingResourceId ? "編輯常用連結" : "新增常用連結"}</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">場館：{facilityKey}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              連結名稱
              <input name="document-title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              URL
              <input name="document-url" type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              分類
              <select value={subCategory} onChange={(event) => setSubCategory(event.target.value)} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none">
                {allCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="grid gap-2 rounded-[8px] border border-dashed border-[#cfd9e5] bg-[#fbfcfd] p-3">
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                新增分類
                <input name="document-category" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
              </label>
              <button type="button" onClick={addCategory} disabled={!customCategory.trim()} className="workbench-focus min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175] disabled:opacity-50">
                新增分類
              </button>
            </div>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              說明 / 用途
              <textarea name="document-note" value={content} onChange={(event) => setContent(event.target.value)} className="min-h-24 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <div className="flex gap-2">
              {editingResourceId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="workbench-focus min-h-10 flex-1 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#536175]"
                >
                  取消
                </button>
              ) : null}
              <button
                type="button"
                disabled={!title.trim() || !url.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="workbench-focus inline-flex min-h-10 flex-[2] items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[13px] font-black text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {saveMutation.isPending ? "儲存中…" : editingResourceId ? "儲存修改" : "新增連結"}
              </button>
            </div>
            {saveMutation.isError ? <p className="text-[12px] font-bold text-[#ff4964]">儲存失敗，請確認 URL 格式或資料庫連線。</p> : null}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
