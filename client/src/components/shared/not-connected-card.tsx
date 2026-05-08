import { CloudOff, Clock3, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotConnectedReason = "upcoming" | "external_pending" | "degraded";

const copy: Record<NotConnectedReason, { suffix: string; helper: string; icon: typeof PlugZap; tone: string }> = {
  upcoming: {
    suffix: "即將推出",
    helper: "即將支援，尚未顯示正式資料。",
    icon: Clock3,
    tone: "border-[#d7e7f7] bg-[#f4f9ff] text-[#1b6eea]",
  },
  external_pending: {
    suffix: "資料暫不可用",
    helper: "外部資料源待接通，現在不顯示假資料。",
    icon: PlugZap,
    tone: "border-[#d7e7f7] bg-[#f4f9ff] text-[#1b6eea]",
  },
  degraded: {
    suffix: "同步中",
    helper: "資料同步暫時延遲，部分內容可能使用 fallback。",
    icon: CloudOff,
    tone: "border-[#f2dda8] bg-[#fff8e8] text-[#9b6a00]",
  },
};

export function NotConnectedCard({
  title,
  reason,
  expectedAt,
  helpLink,
  className,
}: {
  title: string;
  reason: NotConnectedReason;
  expectedAt?: string;
  helpLink?: string;
  className?: string;
}) {
  const ui = copy[reason];
  const Icon = ui.icon;
  return (
    <div className={cn("rounded-[8px] border p-4", ui.tone, className)} data-state={reason === "degraded" ? "degraded" : "not_connected"}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-white/75">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black text-[#10233f]">{title}（{ui.suffix}）</p>
          <p className="mt-1 text-[12px] font-bold leading-5 text-[#536175]">{ui.helper}</p>
          {expectedAt ? <p className="mt-2 text-[11px] font-bold text-[#637185]">預計：{expectedAt}</p> : null}
          {helpLink ? (
            <a href={helpLink} className="mt-3 inline-flex min-h-8 items-center rounded-[8px] bg-white px-3 text-[12px] font-black text-[#1b6eea]">
              開啟既有系統
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DegradedCard(props: Omit<Parameters<typeof NotConnectedCard>[0], "reason">) {
  return <NotConnectedCard {...props} reason="degraded" />;
}
