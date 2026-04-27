import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Image as ImageIcon } from "lucide-react";
import type { CampaignSummary } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { fetchEmployeeHome } from "@/modules/employee/home/api";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { cn } from "@/lib/utils";

type ActivityFilter = "all" | "promotion" | "course" | "activity";

const filters: Array<{ key: ActivityFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "promotion", label: "促銷" },
  { key: "course", label: "課程" },
  { key: "activity", label: "活動" },
];

const classifyCampaign = (campaign: CampaignSummary): Exclude<ActivityFilter, "all"> => {
  const text = `${campaign.title} ${campaign.statusLabel} ${campaign.effectiveRange}`.toLowerCase();
  if (/促銷|折|券|優惠|promotion|sale/.test(text)) return "promotion";
  if (/課程|教學|家教|營隊|course|class/.test(text)) return "course";
  return "activity";
};

const labelByType: Record<Exclude<ActivityFilter, "all">, string> = {
  promotion: "促銷",
  course: "課程",
  activity: "活動",
};

const badgeClassByType: Record<Exclude<ActivityFilter, "all">, string> = {
  promotion: "bg-[#3b241b] text-[#ff9d4d]",
  course: "bg-[#063f36] text-[#36c98a]",
  activity: "bg-[#0d2f75] text-[#67a3ff]",
};

const getDateLabel = (campaign: CampaignSummary) => {
  const match = campaign.effectiveRange.match(/\d{1,2}\/\d{1,2}(?:\s*[-–]\s*\d{1,2}\/\d{1,2})?|\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  return match?.[0] ?? campaign.effectiveRange ?? "未設定";
};

const isImageUrl = (value: string | undefined) => Boolean(value && /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value.trim()));

function ActivityCard({ campaign }: { campaign: CampaignSummary }) {
  const type = classifyCampaign(campaign);
  const imageUrl = campaign.imageUrl ?? (isImageUrl(campaign.linkUrl) ? campaign.linkUrl : undefined);
  const linkUrl = campaign.linkUrl;
  return (
    <article
      className={cn(
        "relative flex min-h-[210px] overflow-hidden rounded-[8px] bg-[#0d2a50] text-white shadow-[0_18px_36px_-28px_rgba(13,31,55,0.75)]",
        imageUrl ? "bg-cover bg-center" : "",
      )}
      style={imageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(13,42,80,0.96), rgba(13,42,80,0.82), rgba(13,42,80,0.58)), url("${imageUrl}")` } : undefined}
    >
      {!imageUrl ? (
        <div className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-[8px] bg-white/8 text-[#8eb5ff]">
          <ImageIcon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="relative z-10 flex min-h-full w-full flex-col p-5">
      <span className={cn("w-fit rounded-[6px] px-2 py-1 text-[12px] font-black", badgeClassByType[type])}>{labelByType[type]}</span>
      <h2 className="mt-4 line-clamp-2 text-[24px] font-black leading-tight">{campaign.title}</h2>
      <p className="mt-3 line-clamp-2 text-[13px] font-bold leading-6 text-[#c7d4e5]">{campaign.effectiveRange || campaign.statusLabel}</p>
      <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#9fb3cb]">
          <CalendarDays className="h-4 w-4 text-[#8eb5ff]" />
          {getDateLabel(campaign)}
        </span>
        {linkUrl ? (
          <a href={linkUrl} target="_blank" rel="noreferrer" className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] px-2 text-[12px] font-black text-white hover:text-[#9dd84f]">
            查看詳情
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-[12px] font-black text-white/60">尚未綁定網址</span>
        )}
      </div>
      {linkUrl ? <p className="mt-2 truncate text-[11px] font-bold text-white/50">綁定網址：{linkUrl}</p> : null}
      </div>
    </article>
  );
}

export default function EmployeeActivityPeriodsPage() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const homeQuery = useQuery({
    queryKey: ["/api/bff/employee/home", "activity-periods"],
    queryFn: fetchEmployeeHome,
  });

  const campaigns = homeQuery.data?.campaigns.data ?? [];
  const filtered = useMemo(
    () => filter === "all" ? campaigns : campaigns.filter((campaign) => classifyCampaign(campaign) === filter),
    [campaigns, filter],
  );
  const stats = useMemo(() => ({
    total: campaigns.length,
    active: campaigns.filter((campaign) => !/即將|未開始|upcoming/i.test(campaign.statusLabel)).length,
    upcoming: campaigns.filter((campaign) => /即將|未開始|upcoming/i.test(campaign.statusLabel)).length,
  }), [campaigns]);

  return (
    <EmployeeShell title="活動檔期" subtitle={`共 ${stats.total} 檔・進行中 ${stats.active}・即將上線 ${stats.upcoming}`}>
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "min-h-9 rounded-[8px] border px-4 text-[13px] font-black",
              filter === item.key ? "border-[#0d2a50] bg-[#0d2a50] text-white" : "border-[#dfe7ef] bg-white text-[#536175]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {homeQuery.isLoading ? (
        <div className="rounded-[8px] border border-[#dfe7ef] bg-white">
          <DreamLoader compact label="活動檔期載入中" />
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => <ActivityCard key={campaign.id} campaign={campaign} />)}
        </div>
      ) : (
        <div className="grid min-h-[320px] place-items-center rounded-[8px] border border-[#dfe7ef] bg-white p-6 text-center">
          <div>
            <CalendarDays className="mx-auto h-10 w-10 text-[#9aa8ba]" />
            <p className="mt-3 text-[16px] font-black text-[#10233f]">目前沒有活動檔期</p>
            <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">
              活動檔期已接員工資源與 campaigns BFF；沒有資料時不補假活動。
            </p>
          </div>
        </div>
      )}
    </EmployeeShell>
  );
}
