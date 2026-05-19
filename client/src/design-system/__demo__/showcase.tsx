import { useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, ClipboardCheck, FileText, Megaphone, Plus, Search } from "lucide-react";
import {
  ActionButton,
  ContentCard,
  EmptyState,
  FilterTabs,
  FormPanel,
  LoadingState,
  PageHeader,
  PriorityTag,
  SearchBar,
  StatCard,
  StatusTag,
} from "@/design-system/components";
import { designTokens } from "@/design-system/tokens";

const filterTabs = [
  { label: "全部", value: "all", count: 10 },
  { label: "必讀", value: "must", count: 1 },
  { label: "規則 SOP", value: "sop", count: 0 },
  { label: "通知公告", value: "notice", count: 9 },
  { label: "活動", value: "event", count: 0 },
] as const;

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-ds-lg border border-border-default bg-white/72 p-5 shadow-card-rest backdrop-blur-xl">
      <h2 className="mb-4 text-h2 text-text-strong">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemShowcase() {
  const [activeTab, setActiveTab] = useState<(typeof filterTabs)[number]["value"]>("all");
  const [query, setQuery] = useState("");

  return (
    <main className="min-h-dvh bg-surface-base px-6 py-8 text-text-strong">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <PageHeader
          breadcrumb="Design System / Phase A"
          title="Kinetic Luminary 元件展示"
          subtitle="Phase A 僅展示 tokens 與共用元件，不接模組資料流。"
          actions={<ActionButton variant="secondary" icon={<FileText className="h-4 w-4" />}>Migration Notes</ActionButton>}
        />

        <DemoSection title="Tokens">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Primary Navy", designTokens.color.primary.navy],
              ["Accent Teal", designTokens.color.accent.teal],
              ["Accent Lime", designTokens.color.accent.lime],
              ["Must Read", designTokens.color.state.mustRead],
              ["Reminder", designTokens.color.state.reminder],
              ["Priority", designTokens.color.state.priority],
              ["Success", designTokens.color.state.success],
              ["Muted", designTokens.color.state.muted],
            ].map(([label, value]) => (
              <div key={label} className="rounded-ds-md border border-border-subtle bg-white p-3">
                <div className="h-12 rounded-ds-sm" style={{ background: value }} />
                <p className="mt-2 text-caption text-text-muted">{label}</p>
                <p className="font-mono text-[12px] font-bold text-text-strong">{value}</p>
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="PageHeader + ActionButton">
          <div className="grid gap-5">
            <PageHeader
              variant="compact"
              breadcrumb="群組重要公告 / PINNED"
              title="群組重要公告"
              subtitle="以中文主標與英文 micro label 對齊首頁資訊層級。"
              actions={(
                <>
                  <ActionButton variant="primary" icon={<Plus className="h-4 w-4" />}>新增公告</ActionButton>
                  <ActionButton variant="secondary">回首頁</ActionButton>
                  <ActionButton variant="ghost">取消</ActionButton>
                  <ActionButton variant="danger">刪除</ActionButton>
                </>
              )}
            />
          </div>
        </DemoSection>

        <DemoSection title="StatCard">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="待處理" value={12} tone="warning" icon={Bell} />
            <StatCard label="高優先" value={3} tone="danger" icon={AlertTriangle} />
            <StatCard label="已完成" value={28} tone="success" icon={CheckCircle2} />
            <StatCard label="一般" value={7} tone="neutral" icon={ClipboardCheck} />
          </div>
        </DemoSection>

        <DemoSection title="EmptyState + LoadingState">
          <div className="grid gap-4 md:grid-cols-3">
            <EmptyState title="尚未設定交辦事項" description="請新增交辦事項" action={<ActionButton size="sm">新增交辦事項</ActionButton>} />
            <EmptyState variant="inline" icon={<ClipboardCheck className="h-5 w-5" />} title="尚無櫃台交接" />
            <LoadingState variant="panel" message="資料載入中" />
          </div>
        </DemoSection>

        <DemoSection title="Tags">
          <div className="flex flex-wrap gap-2">
            <PriorityTag variant="must-read">必讀</PriorityTag>
            <PriorityTag variant="important">重要</PriorityTag>
            <PriorityTag variant="reminder">提醒</PriorityTag>
            <PriorityTag variant="priority">優先</PriorityTag>
            <StatusTag variant="normal">一般</StatusTag>
            <StatusTag variant="success">已完成</StatusTag>
            <StatusTag variant="muted" size="md">草稿</StatusTag>
          </div>
        </DemoSection>

        <DemoSection title="FilterTabs + SearchBar">
          <div className="grid gap-4">
            <FilterTabs tabs={[...filterTabs]} activeValue={activeTab} onChange={setActiveTab} />
            <SearchBar placeholder="搜尋公告、交接、班表..." value={query} onChange={setQuery} icon={<Search className="h-4 w-4" />} />
          </div>
        </DemoSection>

        <DemoSection title="FormPanel">
          <div className="grid gap-4 lg:grid-cols-2">
            <FormPanel
              title="新增交接事項"
              subtitle="右側表單面板，保留 glassmorphism 與左側 accent 細條。"
              footer={<div className="flex justify-end gap-2"><ActionButton variant="ghost">取消</ActionButton><ActionButton>送出</ActionButton></div>}
            >
              <div className="grid gap-3">
                <input className="min-h-11 rounded-ds-md border border-border-default px-3 text-body" placeholder="標題" />
                <textarea className="min-h-24 rounded-ds-md border border-border-default px-3 py-2 text-body" placeholder="內容" />
              </div>
            </FormPanel>
            <FormPanel title="公告人工覆蓋" subtitle="Phase C 會接行為；Phase A 只先備好 UI。" tone="navy">
              <div className="flex flex-wrap gap-2">
                <StatusTag variant="must-read">MUST_READ</StatusTag>
                <StatusTag variant="normal">NORMAL</StatusTag>
              </div>
            </FormPanel>
          </div>
        </DemoSection>

        <DemoSection title="ContentCard">
          <div className="grid gap-4 lg:grid-cols-3">
            <ContentCard
              tone="pinned"
              header={<div><PriorityTag variant="reminder">置頂</PriorityTag><h3 className="mt-2 text-h3 text-text-strong">群組重要公告</h3></div>}
              body="5/18 起四樓球場暫停開放，先油漆 30 天再做地板 45 天，預計 8-9 月恢復。"
              actions={<ActionButton size="sm" variant="secondary" icon={<Megaphone className="h-4 w-4" />}>查看</ActionButton>}
            />
            <ContentCard
              tone="must-read"
              header={<div><PriorityTag variant="must-read">必讀</PriorityTag><h3 className="mt-2 text-h3 text-text-strong">施工通知</h3></div>}
              body="保留關鍵時間與數字，用於 Phase C 公告卡片重構。"
            />
            <ContentCard
              tone="normal"
              header={<div><StatusTag variant="normal">一般</StatusTag><h3 className="mt-2 text-h3 text-text-strong">活動快訊</h3></div>}
              body="一般列表項使用正常 tone。"
            />
          </div>
        </DemoSection>
      </div>
    </main>
  );
}
