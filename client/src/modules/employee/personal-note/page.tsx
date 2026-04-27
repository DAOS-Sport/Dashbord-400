import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { createEmployeeResource, deleteEmployeeResource, fetchEmployeeHome, updateEmployeeResource } from "@/modules/employee/home/api";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

export default function EmployeePersonalNotePage() {
  const queryClient = useQueryClient();
  const homeQuery = useQuery({
    queryKey: ["/api/bff/employee/home", "personal-note"],
    queryFn: fetchEmployeeHome,
  });
  const facilityKey = homeQuery.data?.facility.key ?? "xinbei_pool";
  const notes = homeQuery.data?.stickyNotes.data ?? [];
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "personal-note"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createEmployeeResource({
      facilityKey,
      category: "sticky_note",
      title: title.trim(),
      content: content.trim() || undefined,
      isPinned: true,
    }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, nextTitle, nextContent }: { id: number; nextTitle: string; nextContent: string }) =>
      updateEmployeeResource(id, { title: nextTitle, content: nextContent || null }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEmployeeResource(id),
    onSuccess: invalidate,
  });

  return (
    <EmployeeShell title="個人工作記事" subtitle="便利貼由員工自建，顯示在員工首頁摘要卡">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <WorkbenchCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-black text-[#10233f]">便利貼</h2>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">個人工作記事對應首頁的便利貼模組。</p>
            </div>
            <span className="rounded-full bg-[#fff4c8] px-3 py-1 text-[12px] font-black text-[#9a7a1d]">{notes.length} 則</span>
          </div>

          {homeQuery.isLoading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-[13px] font-bold text-[#637185]">載入便利貼中...</div>
          ) : notes.length ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-[8px] border border-[#f0dfaa] bg-[#fff9df] p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white text-[#d29a16] shadow-sm">
                      <NotebookPen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-black text-[#10233f]">{note.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] font-bold leading-6 text-[#536175]">{note.content}</p>
                      <p className="mt-3 text-[11px] font-bold text-[#9a7a1d]">{note.authorName || "員工"} · {note.createdAt}</p>
                    </div>
                  </div>
                  {note.resourceId ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextTitle = window.prompt("便利貼標題", note.title);
                          if (nextTitle === null) return;
                          const nextContent = window.prompt("提醒內容", note.content || "");
                          if (nextContent === null) return;
                          updateMutation.mutate({ id: note.resourceId!, nextTitle, nextContent });
                        }}
                        className="workbench-focus min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("確認刪除這則便利貼？")) deleteMutation.mutate(note.resourceId!);
                        }}
                        className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#ffc6cf] bg-white px-3 text-[12px] font-black text-[#ff4964]"
                      >
                        <Trash2 className="h-4 w-4" />
                        刪除
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[320px] place-items-center rounded-[8px] bg-[#fbfcfd] p-6 text-center">
              <div>
                <NotebookPen className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                <p className="mt-3 text-[16px] font-black text-[#10233f]">尚未新增便利貼</p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">請在右側新增個人工作記事。</p>
              </div>
            </div>
          )}
        </WorkbenchCard>

        <WorkbenchCard className="h-fit p-5">
          <div className="border-l-4 border-[#16b6b1] pl-3">
            <h2 className="text-[18px] font-black text-[#10233f]">新增便利貼</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">場館：{facilityKey}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              便利貼標題
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              提醒內容
              <textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-32 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[13px] text-[#10233f] outline-none" />
            </label>
            <button
              type="button"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="workbench-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[13px] font-black text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? "新增中..." : "新增"}
            </button>
            {createMutation.isError ? <p className="text-[12px] font-bold text-[#ff4964]">新增失敗，請確認欄位後再試。</p> : null}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
