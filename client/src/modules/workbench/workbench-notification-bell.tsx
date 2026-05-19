import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Loader2, Send, X } from "lucide-react";
import type { WorkbenchRole } from "@shared/auth/me";
import { roleLabels } from "@shared/auth/me";
import { apiGet, apiPatch, apiPost } from "@/shared/api/client";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";

type NotificationItem = {
  deliveryId: string;
  notificationId: number;
  title: string;
  body: string;
  level: "info" | "success" | "warning" | "danger" | string;
  targetRole: WorkbenchRole | "all";
  facilityKey: string | null;
  facilityName: string;
  actionUrl: string | null;
  source: string;
  createdAt: string | null;
  readAt: string | null;
  createdByName: string | null;
};

type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
  sourceStatus: {
    connected: boolean;
    source: string;
    errorMessage?: string;
  };
};

const notificationQueryKey = ["/api/bff/workbench/notifications"] as const;

const fetchNotifications = () => apiGet<NotificationsResponse>("/api/bff/workbench/notifications");

const levelClassName = (level: string) => {
  if (level === "danger") return "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]";
  if (level === "warning") return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  if (level === "success") return "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]";
  return "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]";
};

const formatTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function ComposeNotificationForm({ role }: { role: WorkbenchRole }) {
  const { data: session } = useAuthMe();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState<WorkbenchRole | "all">(role === "system" ? "all" : "employee");
  const [level, setLevel] = useState<"info" | "success" | "warning" | "danger">("info");
  const sendNotification = useMutation({
    mutationFn: () =>
      apiPost("/api/bff/workbench/notifications", {
        title,
        body,
        targetRole,
        level,
        facilityKey: session?.activeFacility ?? null,
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  return (
    <form
      className="border-t border-[#e6edf5] bg-[#f8fbfe] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !body.trim()) return;
        sendNotification.mutate();
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-black text-[#10233f]">發送通知</p>
        <select
          value={targetRole}
          onChange={(event) => setTargetRole(event.target.value as WorkbenchRole | "all")}
          className="h-8 rounded-[7px] border border-[#dfe7ef] bg-white px-2 text-[11px] font-black text-[#536175]"
        >
          <option value="employee">員工</option>
          <option value="lifeguard">救生員</option>
          <option value="supervisor">主管</option>
          <option value="all">全部角色</option>
        </select>
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="通知標題"
        className="mb-2 h-9 w-full rounded-[7px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none focus:border-[#1cb4a3]"
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="提醒內容"
        rows={3}
        className="mb-2 w-full resize-none rounded-[7px] border border-[#dfe7ef] bg-white px-3 py-2 text-[12px] font-bold leading-5 text-[#10233f] outline-none focus:border-[#1cb4a3]"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value as "info" | "success" | "warning" | "danger")}
          className="h-8 rounded-[7px] border border-[#dfe7ef] bg-white px-2 text-[11px] font-black text-[#536175]"
        >
          <option value="info">一般</option>
          <option value="success">完成</option>
          <option value="warning">提醒</option>
          <option value="danger">緊急</option>
        </select>
        <button
          type="submit"
          disabled={sendNotification.isPending || !title.trim() || !body.trim()}
          className="workbench-focus inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#0d2a50] px-3 text-[11px] font-black text-white disabled:opacity-50"
        >
          {sendNotification.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          送出
        </button>
      </div>
    </form>
  );
}

export function WorkbenchNotificationBell({
  role,
  allowCompose = false,
  className,
}: {
  role: WorkbenchRole;
  allowCompose?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationQueryKey,
    queryFn: fetchNotifications,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const markRead = useMutation({
    mutationFn: (deliveryId: string) => apiPatch(`/api/bff/workbench/notifications/${encodeURIComponent(deliveryId)}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const data = query.data;
  const unreadCount = data?.sourceStatus.connected ? data.unreadCount : 0;
  const groupedLabel = useMemo(() => roleLabels[role] ?? role, [role]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label="通知中心"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white md:bg-[#f0f4f8] md:text-[#10233f] lg:bg-[#f0f4f8] lg:text-[#10233f]"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff4964] px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(92vw,390px)] overflow-hidden rounded-[12px] border border-[#dfe7ef] bg-white text-[#10233f] shadow-[0_24px_72px_-38px_rgba(15,34,58,0.62)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e6edf5] px-4 py-3">
            <div>
              <p className="text-[14px] font-black">通知中心</p>
              <p className="text-[11px] font-bold text-[#8b9aae]">{groupedLabel}工作台</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="workbench-focus grid h-8 w-8 place-items-center rounded-[8px] bg-[#f2f6fa]" aria-label="關閉通知">
              <X className="h-4 w-4" />
            </button>
          </div>
          {query.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-5 text-[13px] font-black text-[#637185]">
              <Loader2 className="h-4 w-4 animate-spin" />
              通知讀取中
            </div>
          ) : !data?.sourceStatus.connected ? (
            <div className="p-5 text-center">
              <p className="text-[14px] font-black text-[#10233f]">通知資料源未連線</p>
              <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{data?.sourceStatus.errorMessage ?? "目前無法讀取資料庫通知。"}</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {data.items.length ? (
                data.items.map((item) => (
                  <article key={item.deliveryId} className={cn("mb-2 rounded-[10px] border p-3", levelClassName(item.level), item.readAt && "opacity-70")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[13px] font-black">{item.title}</p>
                        <p className="mt-1 line-clamp-3 text-[12px] font-bold leading-5 opacity-85">{item.body}</p>
                      </div>
                      {!item.readAt ? (
                        <button
                          type="button"
                          onClick={() => markRead.mutate(item.deliveryId)}
                          disabled={markRead.isPending}
                          className="workbench-focus grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70"
                          aria-label="標記已讀"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black opacity-75">
                      <span>{item.facilityName}</span>
                      <span>{formatTime(item.createdAt)}</span>
                      {item.createdByName ? <span>{item.createdByName}</span> : null}
                    </div>
                    {item.actionUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.readAt) markRead.mutate(item.deliveryId);
                          window.location.assign(item.actionUrl!);
                        }}
                        className="workbench-focus mt-2 min-h-8 rounded-[7px] bg-white/80 px-2 text-[11px] font-black"
                      >
                        前往處理
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="p-5 text-center text-[13px] font-bold text-[#637185]">目前沒有通知</div>
              )}
            </div>
          )}
          {allowCompose ? <ComposeNotificationForm role={role} /> : null}
        </div>
      ) : null}
    </div>
  );
}
