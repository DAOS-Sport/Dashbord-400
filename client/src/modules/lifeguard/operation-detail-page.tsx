import { LifeguardShell } from "./lifeguard-shell";

interface LifeguardOperationDetailPageProps {
  moduleId: string;
}

const MODULE_TITLES: Record<string, string> = {
  "water-quality-photo": "水質照片紀錄",
  "coach-water-photo": "教練班水質照片",
  "closing-cleanup-photo": "打烊清潔照片",
  "lane-notes": "水道備註",
  "lost-and-found": "失物招領",
};

export function LifeguardOperationDetailPage({ moduleId }: LifeguardOperationDetailPageProps) {
  const title = MODULE_TITLES[moduleId] ?? moduleId;
  return (
    <LifeguardShell title={title} subtitle="此模組規劃中，後續 Codex 會補上完整實作。">
      <div
        data-testid={`placeholder-lifeguard-${moduleId}`}
        className="rounded-[8px] border border-dashed border-[#dfe7ef] bg-white p-8 text-[13px] font-bold text-[#637185]"
      >
        <p className="text-[15px] font-black text-[#10233f]">{title}</p>
        <p className="mt-2 leading-6">
          模組 ID：<code className="rounded bg-[#f2f4f7] px-1.5 py-0.5 text-[12px]">{moduleId}</code>
        </p>
        <p className="mt-2 leading-6">尚未提供實作，目前為 placeholder，避免路由失敗。</p>
      </div>
    </LifeguardShell>
  );
}

export default LifeguardOperationDetailPage;
