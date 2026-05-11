import type { ComponentType } from "react";
import { Link } from "wouter";
import { ArrowRight, CircleAlert, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SupervisorHomeDrawerStatus = "loading" | "ready" | "empty" | "error" | "degraded";

export type SupervisorModulePreviewItem = {
  id: string;
  title: string;
  meta?: string;
  value?: string;
  tone?: "green" | "blue" | "amber" | "red" | "navy";
};

export type SupervisorHomeDrawerConfig = {
  moduleId: "parking" | "counter-log" | "lane-rentals" | "courts";
  eyebrow: string;
  title: string;
  description: string;
  status: SupervisorHomeDrawerStatus;
  statusLabel: string;
  icon: ComponentType<{ className?: string }>;
  stats: Array<{
    label: string;
    value: string;
    tone?: "green" | "blue" | "amber" | "red" | "navy";
  }>;
  items: SupervisorModulePreviewItem[];
  emptyText: string;
  errorText?: string;
  ctas: Array<{
    label: string;
    href: `/supervisor/${string}`;
    variant?: "primary" | "secondary";
  }>;
};

export type SupervisorModulePreview = SupervisorHomeDrawerConfig & {
  primaryMetric: string;
  primaryLabel: string;
  secondaryMetric: string;
  secondaryLabel: string;
};

const toneClass = (tone: SupervisorModulePreviewItem["tone"] = "navy") => ({
  green: "bg-[#eaf8ef] text-[#15935d]",
  blue: "bg-[#eef5ff] text-[#2f6fe8]",
  amber: "bg-[#fff4e8] text-[#c86912]",
  red: "bg-[#ffe8eb] text-[#ff4964]",
  navy: "bg-[#eef2f6] text-[#10233f]",
}[tone]);

function StatusContent({ config }: { config: SupervisorHomeDrawerConfig }) {
  if (config.status === "loading") {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-[8px] bg-[#fbfcfd] text-center">
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#2f6fe8]" />
          <p className="mt-3 text-[13px] font-black text-[#10233f]">正在載入模組摘要</p>
        </div>
      </div>
    );
  }

  if (config.status === "error" || config.status === "degraded") {
    return (
      <div className="rounded-[8px] border border-[#ffd4da] bg-[#fff6f7] p-4 text-[13px] font-bold text-[#9f2336]">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">{config.statusLabel}</p>
            <p className="mt-1 text-[#b24857]">{config.errorText ?? "目前只能顯示導流入口，完整資料請進入模組頁查看。"}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config.items.length) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-[8px] bg-[#fbfcfd] p-6 text-center">
        <div>
          <p className="text-[14px] font-black text-[#10233f]">{config.emptyText}</p>
          <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">首頁只做摘要預覽；完整操作請前往模組頁。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {config.items.map((item) => (
        <div key={item.id} className="flex min-h-[52px] items-center gap-3 rounded-[8px] border border-[#edf1f6] bg-white px-3 py-2">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneClass(item.tone).split(" ")[0])} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
            {item.meta ? <p className="mt-0.5 truncate text-[11px] font-bold text-[#8b9aae]">{item.meta}</p> : null}
          </div>
          {item.value ? <span className={cn("rounded-[4px] px-2 py-1 text-[11px] font-black", toneClass(item.tone))}>{item.value}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function SupervisorModulePreviewCard({
  preview,
}: {
  preview: SupervisorModulePreview;
}) {
  const Icon = preview.icon;
  const href = preview.ctas[0]?.href ?? "/supervisor";
  return (
    <Link
      href={href}
      data-testid={`supervisor-module-preview-${preview.moduleId}`}
      className="workbench-focus group block min-h-[156px] rounded-[8px] border border-[#dfe7ef] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eaf8ef] text-[#15935d]">
          <Icon className="h-5 w-5" />
        </div>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", toneClass(preview.status === "error" ? "red" : preview.status === "degraded" ? "amber" : "green"))}>
          {preview.statusLabel}
        </span>
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007166]">{preview.eyebrow}</p>
        <h3 className="mt-1 text-[16px] font-black text-[#10233f]">{preview.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#637185]">{preview.description}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[8px] bg-[#fbfcfd] p-2">
          <p className="text-[20px] font-black tabular-nums text-[#10233f]">{preview.primaryMetric}</p>
          <p className="text-[11px] font-bold text-[#8b9aae]">{preview.primaryLabel}</p>
        </div>
        <div className="rounded-[8px] bg-[#fbfcfd] p-2">
          <p className="text-[20px] font-black tabular-nums text-[#10233f]">{preview.secondaryMetric}</p>
          <p className="text-[11px] font-bold text-[#8b9aae]">{preview.secondaryLabel}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] font-black text-[#007166]">
        <span>查看詳細畫面</span>
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function SupervisorHomeDrawer({
  config,
  onClose,
}: {
  config: SupervisorHomeDrawerConfig;
  onClose: () => void;
}) {
  const Icon = config.icon;
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={`關閉${config.title}抽屜`} onClick={onClose} className="absolute inset-0 bg-[#10233f]/35" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col bg-white shadow-[0_24px_80px_-28px_rgba(13,42,80,0.65)]" data-testid={`supervisor-home-drawer-${config.moduleId}`}>
        <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007166]">{config.eyebrow}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#0d2a50] text-white">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[20px] font-black text-[#10233f]">{config.title}</h2>
                <p className="mt-0.5 text-[12px] font-bold text-[#637185]">{config.description}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#f3f6fb] text-[#536175]" aria-label="關閉">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f6f8fb] p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {config.stats.map((stat) => (
              <div key={stat.label} className="rounded-[8px] border border-[#e6edf4] bg-white p-3">
                <p className="text-[11px] font-bold text-[#8b9aae]">{stat.label}</p>
                <p className={cn("mt-1 text-[22px] font-black tabular-nums text-[#10233f]", stat.tone === "red" && "text-[#ff4964]", stat.tone === "amber" && "text-[#c86912]", stat.tone === "green" && "text-[#15935d]", stat.tone === "blue" && "text-[#2f6fe8]")}>{stat.value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-[8px] border border-[#e6edf4] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-black text-[#10233f]">最近狀態</h3>
              <span className="text-[11px] font-black text-[#8b9aae]">PREVIEW ONLY</span>
            </div>
            <StatusContent config={config} />
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#edf1f6] bg-white p-4 sm:flex-row sm:justify-end">
          {config.ctas.map((cta) => (
            <Link
              key={cta.href}
              href={cta.href}
              onClick={onClose}
              className={cn(
                "workbench-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-[13px] font-black",
                cta.variant === "secondary"
                  ? "border border-[#dfe7ef] bg-white text-[#10233f]"
                  : "bg-[#0d2a50] text-white",
              )}
            >
              {cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
