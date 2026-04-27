import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Link as LinkIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { createEmployeeResource, deleteEmployeeResource, fetchEmployeeHome, updateEmployeeResource } from "@/modules/employee/home/api";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

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

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;
    return documents.filter((doc) =>
      `${doc.title} ${doc.description ?? ""} ${doc.url ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [documents, query]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "documents"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createEmployeeResource({
      facilityKey,
      category: "document",
      title: title.trim(),
      content: content.trim() || undefined,
      url: url.trim() || undefined,
    }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setUrl("");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEmployeeResource(id),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, nextTitle, nextContent, nextUrl }: { id: number; nextTitle: string; nextContent: string; nextUrl: string }) =>
      updateEmployeeResource(id, { title: nextTitle, content: nextContent || null, url: nextUrl || null }),
    onSuccess: invalidate,
  });

  return (
    <EmployeeShell title="常用文件" subtitle="常用連結管理，像 Notion 一樣新增、搜尋、開啟與維護同館連結">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <WorkbenchCard className="min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[18px] font-black text-[#10233f]">常用連結資料庫</h2>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">獨立文件模組，來源為 employee_resources / document。</p>
            </div>
            <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[12px] font-black text-[#1f6fd1]">{documents.length} 筆</span>
          </div>

          <label className="mb-4 flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3">
            <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none placeholder:text-[#9aa8ba]"
              placeholder="搜尋文件名稱、用途或連結"
            />
          </label>

          {homeQuery.isLoading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-[13px] font-bold text-[#637185]">載入常用文件中...</div>
          ) : filteredDocuments.length ? (
            <div className="overflow-hidden rounded-[8px] border border-[#edf2f7]">
              <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(160px,1fr)_120px] gap-3 bg-[#f7f9fb] px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8b9aae] lg:grid">
                <span>名稱</span>
                <span>連結</span>
                <span>用途</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-[#edf2f7]">
                {filteredDocuments.map((doc) => (
                  <article key={doc.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(160px,1fr)_120px] lg:items-center">
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
                        <a href={doc.url} target="_blank" rel="noreferrer" className="workbench-focus inline-flex max-w-full min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                          <LinkIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{doc.url}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#8b9aae]" />
                        </a>
                      ) : (
                        <span className="text-[12px] font-bold text-[#8b9aae]">尚未設定連結</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[12px] font-bold leading-5 text-[#637185]">{doc.description || "無備註"}</p>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      {doc.resourceId ? (
                        <>
                          <button
                            type="button"
                            aria-label={`編輯 ${doc.title}`}
                            onClick={() => {
                              const nextTitle = window.prompt("文件名稱", doc.title);
                              if (nextTitle === null) return;
                              const nextContent = window.prompt("用途或備註", doc.description || "");
                              if (nextContent === null) return;
                              const nextUrl = window.prompt("文件連結", doc.url || "");
                              if (nextUrl === null) return;
                              updateMutation.mutate({ id: doc.resourceId!, nextTitle, nextContent, nextUrl });
                            }}
                            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`刪除 ${doc.title}`}
                            onClick={() => {
                              if (window.confirm("確認刪除這份常用連結？")) deleteMutation.mutate(doc.resourceId!);
                            }}
                            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#ffc6cf] bg-white text-[#ff4964]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
            <h2 className="text-[18px] font-black text-[#10233f]">新增常用連結</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">場館：{facilityKey}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              連結名稱
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              URL
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              說明 / 用途
              <textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-24 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <button
              type="button"
              disabled={!title.trim() || !url.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="workbench-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[13px] font-black text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? "新增中..." : "新增連結"}
            </button>
            {createMutation.isError ? <p className="text-[12px] font-bold text-[#ff4964]">新增失敗，請確認 URL 格式或資料庫連線。</p> : null}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
