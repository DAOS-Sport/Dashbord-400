import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Bell, GripVertical, Link as LinkIcon, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { defaultEmployeeHomeWidgets, type WorkbenchWidgetLayoutItem } from "@shared/domain/layout";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import {
  fetchSupervisorLayoutSettings,
  fetchSupervisorQuickLinks,
  fetchSupervisorSystemAnnouncements,
  saveSupervisorLayoutSettings,
} from "./api";
import { cn } from "@/lib/utils";

export default function SupervisorSettingsPage() {
  const { data: session } = useAuthMe();
  const queryClient = useQueryClient();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const [widgets, setWidgets] = useState<WorkbenchWidgetLayoutItem[]>(defaultEmployeeHomeWidgets);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const quickLinksQuery = useQuery({ queryKey: ["/api/portal/quick-links", facilityKey], queryFn: () => fetchSupervisorQuickLinks(facilityKey) });
  const announcementsQuery = useQuery({ queryKey: ["/api/portal/system-announcements", facilityKey], queryFn: () => fetchSupervisorSystemAnnouncements(facilityKey) });
  const layoutQuery = useQuery({ queryKey: ["/api/portal/layout-settings", facilityKey, "employee", "employee-home"], queryFn: () => fetchSupervisorLayoutSettings(facilityKey) });
  const saveLayoutMutation = useMutation({
    mutationFn: () => saveSupervisorLayoutSettings({ facilityKey, role: "employee", layoutKey: "employee-home", widgets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/layout-settings", facilityKey, "employee", "employee-home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    },
  });
  const quickLinks = quickLinksQuery.data?.items ?? [];
  const announcements = announcementsQuery.data?.items ?? [];

  useEffect(() => {
    if (layoutQuery.data?.widgets?.length) setWidgets(layoutQuery.data.widgets);
  }, [layoutQuery.data]);
  const governanceItems: readonly (readonly [title: string, desc: string, Icon: LucideIcon])[] = [
    ["權限邊界", "寫入操作需主管 session", ShieldCheck],
    ["版面設定", "Dashboard widget 控制已在首頁提供", SlidersHorizontal],
    ["資料接口", "Replit pull 後只需重連 API env", Settings],
  ];

  const moveWidget = (index: number, direction: -1 | 1) => {
    setWidgets((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next.map((widget, order) => ({ ...widget, sortOrder: (order + 1) * 10 }));
    });
  };

  const toggleWidget = (key: string) => {
    setWidgets((current) => current.map((item) => item.key === key ? { ...item, enabled: !item.enabled } : item));
  };

  const moveWidgetByKey = (sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return;
    setWidgets((current) => {
      const sourceIndex = current.findIndex((item) => item.key === sourceKey);
      const targetIndex = current.findIndex((item) => item.key === targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next.map((widget, order) => ({ ...widget, sortOrder: (order + 1) * 10 }));
    });
  };

  return (
    <RoleShell role="supervisor" title="系統設定" subtitle="主管可檢視場館快速入口與系統公告設定，正式寫入仍由後端權限控管。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">快速入口</p>
            <p className="mt-2 text-[26px] font-black text-[#2f6fe8]">{quickLinks.length}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">系統公告</p>
            <p className="mt-2 text-[26px] font-black text-[#ef7d22]">{announcements.length}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">目前場館</p>
            <p className="mt-2 text-[22px] font-black text-[#15935d]">{facilityKey}</p>
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]"><SlidersHorizontal className="h-5 w-5" /></div>
              <div>
                <h2 className="text-[15px] font-black">員工首頁 Widget 排版草稿</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">儲存後會寫入 DB，員工首頁依此控制顯示與排序。</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setWidgets(defaultEmployeeHomeWidgets)} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                重設預設
              </button>
              <button
                type="button"
                onClick={() => saveLayoutMutation.mutate()}
                disabled={saveLayoutMutation.isPending}
                className="min-h-9 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white disabled:opacity-55"
              >
                {saveLayoutMutation.isPending ? "儲存中..." : "儲存並套用"}
              </button>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-2">
              {widgets.map((widget, index) => (
                <div
                  key={widget.key}
                  draggable
                  onDragStart={() => setDraggingKey(widget.key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingKey) moveWidgetByKey(draggingKey, widget.key);
                    setDraggingKey(null);
                  }}
                  onDragEnd={() => setDraggingKey(null)}
                  className={cn(
                    "flex cursor-grab items-center gap-3 rounded-[8px] border p-3 active:cursor-grabbing",
                    widget.enabled ? "border-[#dfe7ef] bg-[#fbfcfd]" : "border-[#edf1f5] bg-white opacity-55",
                    draggingKey === widget.key && "border-[#2f6fe8] bg-[#eef5ff]",
                  )}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-[#8b9aae]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-[#10233f]">{index + 1}. {widget.label}</p>
                    <p className="text-[11px] font-bold text-[#8b9aae]">{widget.area} · {widget.size === "wide" ? "滿版" : "卡片"} · 排序 {widget.sortOrder}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => moveWidget(index, -1)} className="h-8 rounded-[8px] border border-[#dfe7ef] bg-white px-2 text-[11px] font-black text-[#536175]">上</button>
                    <button type="button" onClick={() => moveWidget(index, 1)} className="h-8 rounded-[8px] border border-[#dfe7ef] bg-white px-2 text-[11px] font-black text-[#536175]">下</button>
                    <button type="button" onClick={() => toggleWidget(widget.key)} className={cn("h-8 rounded-[8px] px-2 text-[11px] font-black", widget.enabled ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#eef2f6] text-[#637185]")}>
                      {widget.enabled ? "開" : "關"}
                    </button>
                  </div>
                </div>
              ))}
              {layoutQuery.isLoading ? <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">讀取版面設定中...</div> : null}
              {saveLayoutMutation.isError ? <div className="rounded-[8px] bg-[#fff7f8] p-3 text-[12px] font-bold text-[#ff4964]">儲存失敗，請確認主管權限或 DB 連線。</div> : null}
              {saveLayoutMutation.isSuccess ? <div className="rounded-[8px] bg-[#effaf4] p-3 text-[12px] font-bold text-[#15935d]">已儲存並套用到員工首頁。</div> : null}
            </div>
            <div className="rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb] p-3">
              <p className="mb-3 text-[12px] font-black text-[#536175]">首頁預覽骨架</p>
              <div className="space-y-3">
                {widgets.filter((widget) => widget.enabled).map((widget) => (
                  <div key={`preview-${widget.key}`} className={cn("rounded-[8px] bg-white p-3 text-[12px] font-black text-[#10233f] shadow-sm", widget.size === "wide" ? "min-h-12" : "min-h-20")}>
                    {widget.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </WorkbenchCard>

        <div className="grid gap-4 xl:grid-cols-2">
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]"><LinkIcon className="h-5 w-5" /></div>
              <div>
                <h2 className="text-[15px] font-black">常用網址</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">資料走 `/api/portal/quick-links`。</p>
              </div>
            </div>
            <div className="space-y-3">
              {quickLinksQuery.isLoading ? <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入中...</div> : null}
              {quickLinks.map((item) => (
                <div key={item.id} className="rounded-[8px] bg-[#fbfcfd] p-3">
                  <p className="text-[13px] font-black text-[#10233f]">{item.title}</p>
                  <p className="mt-1 truncate text-[11px] font-bold text-[#8b9aae]">{item.url}</p>
                </div>
              ))}
              {!quickLinksQuery.isLoading && quickLinks.length === 0 ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未建立常用網址。</div> : null}
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#fff6e7] text-[#ef7d22]"><Bell className="h-5 w-5" /></div>
              <div>
                <h2 className="text-[15px] font-black">系統公告</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">資料走 `/api/portal/system-announcements`。</p>
              </div>
            </div>
            <div className="space-y-3">
              {announcementsQuery.isLoading ? <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入中...</div> : null}
              {announcements.map((item) => (
                <div key={item.id} className="rounded-[8px] bg-[#fbfcfd] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] font-bold text-[#637185]">{item.content}</p>
                    </div>
                    <span className="rounded-full bg-[#eef2f6] px-2 py-1 text-[10px] font-black text-[#637185]">{item.severity}</span>
                  </div>
                </div>
              ))}
              {!announcementsQuery.isLoading && announcements.length === 0 ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未建立系統公告。</div> : null}
            </div>
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {governanceItems.map(([title, desc, Icon]) => (
              <div key={title} className="rounded-[8px] bg-[#fbfcfd] p-3">
                <Icon className="h-5 w-5 text-[#2f6fe8]" />
                <p className="mt-2 text-[13px] font-black text-[#10233f]">{title}</p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{desc}</p>
              </div>
            ))}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
