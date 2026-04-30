import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ExternalLink, Image as ImageIcon, Link as LinkIcon, PlayCircle, Search } from "lucide-react";
import type { TrainingSummary } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { fetchEmployeeHome } from "@/modules/employee/home/api";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { cn } from "@/lib/utils";

const trainingCategories = ["全部", "影片", "圖片", "注意事項", "流程", "新人訓練", "其他"];

const mediaLabel: Record<TrainingSummary["mediaType"], string> = {
  video: "影片",
  image: "圖片",
  link: "連結",
  note: "注意事項",
};

const mediaIcon: Record<TrainingSummary["mediaType"], typeof PlayCircle> = {
  video: PlayCircle,
  image: ImageIcon,
  link: LinkIcon,
  note: BookOpen,
};

const isExternalUrl = (url?: string) => Boolean(url && /^https?:\/\//i.test(url));

const toVideoEmbedUrl = (url?: string) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : undefined;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

function TrainingPreview({ item }: { item: TrainingSummary }) {
  const embedUrl = item.mediaType === "video" ? toVideoEmbedUrl(item.url) : undefined;
  if (item.mediaType === "image" && item.url) {
    return (
      <img
        src={item.url}
        alt={item.title}
        loading="lazy"
        className="h-44 w-full rounded-[8px] object-cover"
      />
    );
  }
  if (embedUrl) {
    return (
      <iframe
        title={item.title}
        src={embedUrl}
        className="h-44 w-full rounded-[8px] border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  const Icon = mediaIcon[item.mediaType];
  return (
    <div className="grid h-44 place-items-center rounded-[8px] bg-[#eef5ff] text-[#1f6fd1]">
      <Icon className="h-10 w-10" />
    </div>
  );
}

function TrainingCard({
  item,
  onView,
}: {
  item: TrainingSummary;
  onView: (item: TrainingSummary) => void;
}) {
  const Icon = mediaIcon[item.mediaType];
  return (
    <article className="flex min-h-[360px] flex-col rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-[0_18px_44px_-34px_rgba(13,42,80,0.7)]">
      <TrainingPreview item={item} />
      <div className="mt-4 flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-[#eaf8ef] px-2.5 text-[11px] font-black text-[#15935d]">
            <Icon className="h-3.5 w-3.5" />
            {item.subCategory || mediaLabel[item.mediaType]}
          </span>
          <span className="text-[11px] font-bold text-[#8b9aae]">{item.updatedAt}</span>
        </div>
        <h2 className="mt-3 line-clamp-2 text-[18px] font-black leading-snug text-[#10233f]">{item.title}</h2>
        <p className="mt-2 line-clamp-3 text-[13px] font-bold leading-6 text-[#637185]">{item.content || "教材已建立，點擊開始觀看或開啟連結。"}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <span className="text-[11px] font-bold text-[#8b9aae]">{item.createdByName ? `建立者：${item.createdByName}` : "員工教材"}</span>
          {item.url ? (
            <a
              href={item.url}
              target={isExternalUrl(item.url) ? "_blank" : undefined}
              rel={isExternalUrl(item.url) ? "noreferrer" : undefined}
              onClick={() => onView(item)}
              className="workbench-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white"
            >
              開始觀看
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onView(item)}
              className="workbench-focus inline-flex min-h-10 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]"
            >
              已閱讀
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function EmployeeTrainingPage() {
  const trackEvent = useTrackEvent();
  const homeQuery = useQuery({
    queryKey: ["/api/bff/employee/home", "training"],
    queryFn: fetchEmployeeHome,
  });
  const training = homeQuery.data?.training?.data ?? [];
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return training.filter((item) => {
      const byCategory = categoryFilter === "全部" || (item.subCategory || mediaLabel[item.mediaType]) === categoryFilter;
      const byQuery = !normalized || `${item.title} ${item.content ?? ""} ${item.subCategory ?? ""} ${item.url ?? ""}`.toLowerCase().includes(normalized);
      return byCategory && byQuery;
    });
  }, [categoryFilter, query, training]);

  const categoryOptions = useMemo(() => {
    const fromItems = training.map((item) => item.subCategory || mediaLabel[item.mediaType]).filter(Boolean);
    return Array.from(new Set([...trainingCategories, ...fromItems]));
  }, [training]);

  const recordTrainingView = (item: TrainingSummary) => {
    trackEvent("TRAINING_VIEW", {
      moduleId: "employee-training",
      resourceId: String(item.resourceId ?? item.id),
      title: item.title,
      mediaType: item.mediaType,
      url: item.url,
    });
  };

  return (
    <EmployeeShell title="員工教材" subtitle="">
      <div className="grid gap-4">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex min-h-10 min-w-[260px] flex-1 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
              <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none placeholder:text-[#9aa8ba]"
                placeholder="搜尋教材、影片、流程或注意事項"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={cn(
                    "workbench-focus min-h-9 rounded-[8px] px-3 text-[12px] font-black",
                    categoryFilter === category ? "bg-[#0d2a50] text-white" : "border border-[#dfe7ef] bg-white text-[#536175]",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {homeQuery.isLoading ? (
            <WorkbenchCard className="p-8">
              <DreamLoader compact label="員工教材載入中" />
            </WorkbenchCard>
          ) : filtered.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((item) => (
                <TrainingCard
                  key={item.id}
                  item={item}
                  onView={recordTrainingView}
                />
              ))}
            </div>
          ) : (
            <WorkbenchCard className="grid min-h-[360px] place-items-center p-8 text-center">
              <div>
                <BookOpen className="mx-auto h-12 w-12 text-[#9aa8ba]" />
                <p className="mt-3 text-[18px] font-black text-[#10233f]">尚未建立員工教材</p>
                <p className="mt-1 text-[13px] font-bold text-[#637185]">教材資料來源已接 employee_resources / training；沒有資料時不補假內容。</p>
              </div>
            </WorkbenchCard>
          )}
        </div>
      </div>
    </EmployeeShell>
  );
}
