import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { deleteEmployeeResource, updateEmployeeResource } from "@/modules/employee/home/api";
import { cn } from "@/lib/utils";

const toDateTimeInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoOrNull = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function EmployeeResourceActions({
  resourceId,
  title,
  content,
  url,
  scheduledAt,
  onChanged,
  allowEdit = true,
  allowDelete = true,
  showUrlField = url !== undefined,
  showScheduledAtField = scheduledAt !== undefined,
  className,
}: {
  resourceId?: number;
  title: string;
  content?: string | null;
  url?: string | null;
  scheduledAt?: string | null;
  onChanged: () => void;
  allowEdit?: boolean;
  allowDelete?: boolean;
  showUrlField?: boolean;
  showScheduledAtField?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftContent, setDraftContent] = useState(content ?? "");
  const [draftUrl, setDraftUrl] = useState(url ?? "");
  const [draftScheduledAt, setDraftScheduledAt] = useState(toDateTimeInputValue(scheduledAt));

  useEffect(() => {
    setDraftTitle(title);
    setDraftContent(content ?? "");
    setDraftUrl(url ?? "");
    setDraftScheduledAt(toDateTimeInputValue(scheduledAt));
  }, [content, scheduledAt, title, url]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateEmployeeResource(resourceId!, {
        title: draftTitle.trim(),
        content: draftContent.trim() || null,
        ...(showUrlField ? { url: draftUrl.trim() || null } : {}),
        ...(showScheduledAtField ? { scheduledAt: toIsoOrNull(draftScheduledAt) } : {}),
      }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmployeeResource(resourceId!),
    onSuccess: onChanged,
  });

  if (!resourceId || (!allowEdit && !allowDelete)) return null;

  return (
    <div className={cn("mt-2", className)}>
      <div className="flex flex-wrap gap-2">
        {allowEdit ? (
          <button
            type="button"
            onClick={() => {
              setEditing((current) => !current);
              setConfirmingDelete(false);
            }}
            className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? "收合" : "編輯"}
          </button>
        ) : null}
        {allowDelete && !confirmingDelete ? (
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(true);
              setEditing(false);
            }}
            className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#fff0f1] px-3 text-[12px] font-black text-[#db4b5a]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            刪除
          </button>
        ) : null}
        {allowDelete && confirmingDelete ? (
          <div className="flex flex-wrap gap-2 rounded-[8px] bg-[#fff0f1] p-1">
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="workbench-focus min-h-8 rounded-[7px] bg-[#db4b5a] px-3 text-[11px] font-black text-white disabled:opacity-50"
            >
              {deleteMutation.isPending ? "刪除中" : "確認刪除"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="workbench-focus min-h-8 rounded-[7px] bg-white px-3 text-[11px] font-black text-[#536175]"
            >
              取消
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 rounded-[10px] border border-[#dfe7ef] bg-white p-3 shadow-[0_14px_32px_-28px_rgba(15,34,58,0.4)]">
          <div className="grid gap-3">
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              標題
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 text-[13px] font-bold text-[#10233f] outline-none focus:border-[#0d2a50]"
              />
            </label>
            <label className="grid gap-1 text-[12px] font-black text-[#536175]">
              內容 / 備註
              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                className="min-h-[84px] rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-3 text-[13px] font-bold leading-6 text-[#10233f] outline-none focus:border-[#0d2a50]"
              />
            </label>
            {showUrlField ? (
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                連結
                <input
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 text-[13px] font-bold text-[#10233f] outline-none focus:border-[#0d2a50]"
                />
              </label>
            ) : null}
            {showScheduledAtField ? (
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                日期時間
                <input
                  type="datetime-local"
                  value={draftScheduledAt}
                  onChange={(event) => setDraftScheduledAt(event.target.value)}
                  className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 text-[13px] font-bold text-[#10233f] outline-none focus:border-[#0d2a50]"
                />
              </label>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(title);
                  setDraftContent(content ?? "");
                  setDraftUrl(url ?? "");
                  setDraftScheduledAt(toDateTimeInputValue(scheduledAt));
                  setEditing(false);
                }}
                className="workbench-focus min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!draftTitle.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                className="workbench-focus min-h-9 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white disabled:opacity-50"
              >
                {updateMutation.isPending ? "儲存中" : "儲存"}
              </button>
            </div>
            {updateMutation.isError ? <p className="text-[11px] font-bold text-[#ff4964]">儲存失敗，請稍後再試。</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
