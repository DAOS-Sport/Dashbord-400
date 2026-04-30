import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Edit3, Pin, Plus, Search, Trash2 } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import {
  createKnowledgeBaseQna,
  deleteKnowledgeBaseQna,
  fetchEmployeeHome,
  fetchKnowledgeBaseQna,
  type KnowledgeBaseQnaDTO,
  updateKnowledgeBaseQna,
} from "@/modules/employee/home/api";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";

const readInitialSearch = () => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
};

const splitTags = (value: string) =>
  value
    .split(/[,\n，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function QnaCard({
  item,
  onEdit,
  onDelete,
}: {
  item: KnowledgeBaseQnaDTO;
  onEdit: (item: KnowledgeBaseQnaDTO) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <article id={`qna-${item.id}`} className="rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-[0_14px_32px_-30px_rgba(15,34,58,0.65)]">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#eef6ff] text-[#1b6eea]">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.isPinned ? (
              <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-[#e9f8df] px-2 text-[11px] font-black text-[#188249]">
                <Pin className="h-3 w-3" />
                置頂
              </span>
            ) : null}
            {item.category ? <span className="rounded-full bg-[#f3f6fa] px-2 py-1 text-[11px] font-black text-[#536175]">{item.category}</span> : null}
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", item.answer ? "bg-[#e9f8df] text-[#188249]" : "bg-[#fff4d8] text-[#9b6a00]")}>
              {item.answer ? "已回答" : "待回答"}
            </span>
          </div>
          <h2 className="mt-2 text-[17px] font-black leading-7 text-[#10233f]">{item.question}</h2>
          {item.answer ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] font-bold leading-6 text-[#536175]">{item.answer}</p>
          ) : (
            <div className="mt-3 rounded-[8px] bg-[#f8fafc] px-3 py-3 text-[13px] font-bold text-[#8b9aae]">尚未補上答案</div>
          )}
          {item.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#eef6ff] px-2 py-1 text-[11px] font-black text-[#1b6eea]">{tag}</span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-[11px] font-bold text-[#8b9aae]">
            {item.createdByName || "員工"} · {formatTime(item.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="編輯問答"
            onClick={() => onEdit(item)}
            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175] hover:bg-[#f3f6fa]"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="刪除問答"
            onClick={() => onDelete(item.id)}
            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#ffd6dc] bg-white text-[#e33f5f] hover:bg-[#fff3f5]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function EmployeeQnaPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(readInitialSearch);
  const [editing, setEditing] = useState<KnowledgeBaseQnaDTO | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const homeQuery = useQuery({
    queryKey: ["/api/bff/employee/home", "qna"],
    queryFn: fetchEmployeeHome,
  });
  const facilityKey = homeQuery.data?.facility.key ?? "xinbei_pool";

  const qnaQuery = useQuery({
    queryKey: ["/api/portal/knowledge-base-qna", facilityKey, search],
    queryFn: () => fetchKnowledgeBaseQna(facilityKey, search),
    enabled: Boolean(facilityKey),
  });

  const items = qnaQuery.data?.items ?? [];
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "zh-TW")),
    [items],
  );

  const resetForm = () => {
    setEditing(null);
    setQuestion("");
    setAnswer("");
    setCategory("");
    setTags("");
    setIsPinned(false);
  };

  const loadForEdit = (item: KnowledgeBaseQnaDTO) => {
    setEditing(item);
    setQuestion(item.question);
    setAnswer(item.answer ?? "");
    setCategory(item.category ?? "");
    setTags(item.tags.join(", "));
    setIsPinned(item.isPinned);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/portal/knowledge-base-qna"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/search"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        facilityKey,
        question: question.trim(),
        answer: answer.trim() || null,
        category: category.trim() || null,
        tags: splitTags(tags),
        isPinned,
      };
      return editing ? updateKnowledgeBaseQna(editing.id, input) : createKnowledgeBaseQna(input);
    },
    onSuccess: () => {
      resetForm();
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeBaseQna,
    onSuccess: invalidate,
  });

  return (
    <EmployeeShell title="相關問題詢問" subtitle="">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WorkbenchCard className="min-h-[calc(100dvh-150px)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-black text-[#10233f]">問答資料庫</h1>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{items.length} 筆 · 首頁搜尋可查問題、答案、分類與標籤</p>
            </div>
            <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-[12px] font-black text-[#1b6eea]">Q&A</span>
          </div>

          <label className="mt-5 flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[#8b9aae]">
            <Search className="h-4 w-4" />
            <span className="sr-only">搜尋問答</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 flex-1 bg-transparent text-[14px] font-bold text-[#10233f] outline-none"
              aria-label="搜尋問答"
            />
          </label>

          {categories.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSearch(name)}
                  className="workbench-focus min-h-8 rounded-full border border-[#dfe7ef] bg-[#f8fafc] px-3 text-[12px] font-black text-[#536175] hover:bg-white"
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {qnaQuery.isLoading || homeQuery.isLoading ? (
              <div className="grid min-h-[320px] place-items-center rounded-[8px] bg-[#f8fafc]">
                <DreamLoader label="載入問答" />
              </div>
            ) : items.length ? (
              items.map((item) => (
                <QnaCard
                  key={item.id}
                  item={item}
                  onEdit={loadForEdit}
                  onDelete={(id) => {
                    if (window.confirm("確定要刪除這筆問答？")) deleteMutation.mutate(id);
                  }}
                />
              ))
            ) : (
              <div className="grid min-h-[360px] place-items-center rounded-[8px] bg-[#f8fafc] p-6 text-center">
                <div>
                  <BookOpen className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                  <p className="mt-3 text-[16px] font-black text-[#10233f]">尚未建立問答</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">可以先建立問題，答案之後再補。</p>
                </div>
              </div>
            )}
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="h-fit p-5">
          <div className="border-l-4 border-[#16b6b1] pl-3">
            <h2 className="text-[18px] font-black text-[#10233f]">{editing ? "編輯問答" : "新增問答"}</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">場館：{homeQuery.data?.facility.name ?? facilityKey}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              問題
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="min-h-24 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[14px] font-bold text-[#10233f] outline-none"
              />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              答案
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                className="min-h-44 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[14px] text-[#10233f] outline-none"
              />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              分類
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none"
              />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              標籤
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="min-h-10 rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[13px] text-[#10233f] outline-none"
              />
            </label>
            <label className="flex min-h-10 items-center justify-between gap-3 rounded-[8px] border border-[#dfe7ef] bg-[#f8fafc] px-3 text-[13px] font-black text-[#536175]">
              置頂
              <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="h-4 w-4 accent-[#16b6b1]" />
            </label>
            <div className="flex gap-2 pt-2">
              {editing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="workbench-focus inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#536175]"
                >
                  取消
                </button>
              ) : null}
              <button
                type="button"
                disabled={!question.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="workbench-focus inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {saveMutation.isPending ? "儲存中…" : editing ? "更新問答" : "新增問答"}
              </button>
            </div>
            {saveMutation.isError ? <p className="text-[12px] font-bold text-[#ff4964]">儲存失敗，請確認欄位後再試。</p> : null}
            {deleteMutation.isError ? <p className="text-[12px] font-bold text-[#ff4964]">刪除失敗，請稍後再試。</p> : null}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
