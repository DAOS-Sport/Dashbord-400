import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, CheckCircle2, Search, XCircle } from "lucide-react";
import { fetchSupervisorQnaReview, approveKnowledgeBaseQna, rejectKnowledgeBaseQna, type KnowledgeBaseQnaDTO } from "@/modules/employee/home/api";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";

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

function PendingQnaCard({
  item,
  reviewNote,
  onNoteChange,
  onApprove,
  onReject,
  busy,
}: {
  item: KnowledgeBaseQnaDTO;
  reviewNote: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <article className="rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-[0_14px_32px_-30px_rgba(15,34,58,0.65)]">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#eef6ff] text-[#1b6eea]">
          <BookOpenCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fff4d8] px-2 py-1 text-[11px] font-black text-[#9b6a00]">待審核</span>
            {item.category ? <span className="rounded-full bg-[#f3f6fa] px-2 py-1 text-[11px] font-black text-[#536175]">{item.category}</span> : null}
            <span className="text-[11px] font-bold text-[#8b9aae]">{item.createdByName || item.createdByEmployeeNumber || "員工"} · {formatTime(item.createdAt)}</span>
          </div>
          <h2 className="mt-3 text-[17px] font-black leading-7 text-[#10233f]">{item.question}</h2>
          {item.answer ? <p className="mt-2 whitespace-pre-wrap text-[13px] font-bold leading-6 text-[#536175]">{item.answer}</p> : null}
          {item.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#eef6ff] px-2 py-1 text-[11px] font-black text-[#1b6eea]">{tag}</span>
              ))}
            </div>
          ) : null}
          <label className="mt-4 grid gap-1 text-[12px] font-black text-[#536175]">
            審核備註
            <textarea
              value={reviewNote}
              onChange={(event) => onNoteChange(event.target.value)}
              className="min-h-20 rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[13px] text-[#10233f] outline-none"
              placeholder="核准可留空；退回時請填寫原因。"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="workbench-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#15935d] px-4 text-[13px] font-black text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              核准公開
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="workbench-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#ffd6dc] bg-white px-4 text-[13px] font-black text-[#e33f5f] disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              退回
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SupervisorQnaReviewPage() {
  const queryClient = useQueryClient();
  const authQuery = useAuthMe();
  const facilityKey = authQuery.data?.activeFacility;
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const reviewQuery = useQuery({
    queryKey: ["/api/bff/supervisor/qna-review", facilityKey],
    queryFn: () => fetchSupervisorQnaReview(facilityKey),
  });

  const items = reviewQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.question, item.answer ?? "", item.category ?? "", item.createdByName ?? "", ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [items, query]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/qna-review"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portal/knowledge-base-qna"] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => approveKnowledgeBaseQna(id, note.trim() || null),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => rejectKnowledgeBaseQna(id, note.trim() || null),
    onSuccess: invalidate,
  });

  return (
    <RoleShell role="supervisor" title="Q&A 審核" subtitle="審核員工新增的相關問題，核准後才會公開給所有員工。">
      <div className="grid gap-4">
        <WorkbenchCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-black text-[#10233f]">待審核問答</h1>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{items.length} 筆 pending · 核准後員工端立即可見</p>
            </div>
            <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-[12px] font-black text-[#9b6a00]">supervisor review</span>
          </div>
          <label className="mt-5 flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[#8b9aae]">
            <Search className="h-4 w-4" />
            <span className="sr-only">搜尋待審核問答</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-10 flex-1 bg-transparent text-[14px] font-bold text-[#10233f] outline-none"
              aria-label="搜尋待審核問答"
            />
          </label>
        </WorkbenchCard>

        <div className="grid gap-3">
          {reviewQuery.isLoading ? (
            <WorkbenchCard className="grid min-h-[280px] place-items-center p-6 text-[13px] font-bold text-[#637185]">載入待審核問答中...</WorkbenchCard>
          ) : filtered.length ? (
            filtered.map((item) => (
              <PendingQnaCard
                key={item.id}
                item={item}
                reviewNote={notes[item.id] ?? ""}
                onNoteChange={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
                onApprove={() => approveMutation.mutate({ id: item.id, note: notes[item.id] ?? "" })}
                onReject={() => rejectMutation.mutate({ id: item.id, note: notes[item.id] ?? "" })}
                busy={approveMutation.isPending || rejectMutation.isPending}
              />
            ))
          ) : (
            <WorkbenchCard className="grid min-h-[320px] place-items-center p-6 text-center">
              <div>
                <BookOpenCheck className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                <p className="mt-3 text-[16px] font-black text-[#10233f]">目前沒有待審核問答</p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">員工新增 Q&A 後會出現在這裡。</p>
              </div>
            </WorkbenchCard>
          )}
        </div>
      </div>
    </RoleShell>
  );
}
