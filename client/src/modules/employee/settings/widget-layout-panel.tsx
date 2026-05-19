import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutDashboard, RotateCcw, Save } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { defaultEmployeeHomeWidgets } from "@shared/domain/layout";
import type { WorkbenchWidgetLayoutItem } from "@shared/domain/layout";
import { apiGet, apiPut } from "@/shared/api/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const AREA_ORDER = ["top", "primary", "lower"] as const;
const AREA_LABELS: Record<string, string> = {
  top: "頂部",
  primary: "主要區塊",
  lower: "下方區塊",
};

type WidgetLayoutResponse = {
  widgets: WorkbenchWidgetLayoutItem[];
  isDefault: boolean;
};

const fetchWidgetLayout = () =>
  apiGet<WidgetLayoutResponse>("/api/bff/employee/widget-layout");

const saveWidgetLayout = (widgets: WorkbenchWidgetLayoutItem[]) =>
  apiPut<WidgetLayoutResponse>("/api/bff/employee/widget-layout", { widgets });

interface WidgetLayoutPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WidgetLayoutPanel({ open, onOpenChange }: WidgetLayoutPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["/api/bff/employee/widget-layout"],
    queryFn: fetchWidgetLayout,
    enabled: open,
  });

  const [localWidgets, setLocalWidgets] = useState<WorkbenchWidgetLayoutItem[]>([]);

  useEffect(() => {
    if (query.data?.widgets) {
      setLocalWidgets(query.data.widgets);
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveWidgetLayout(localWidgets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/widget-layout"] });
      toast({ title: "版型已儲存", description: "首頁版型將在下次載入時生效。" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "儲存失敗", description: "請稍後再試。", variant: "destructive" });
    },
  });

  const toggleWidget = (key: string) => {
    setLocalWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, enabled: !w.enabled } : w)),
    );
  };

  const resetToDefaults = () => {
    setLocalWidgets(defaultEmployeeHomeWidgets);
  };

  const isDirty =
    JSON.stringify(localWidgets) !==
    JSON.stringify(query.data?.widgets ?? defaultEmployeeHomeWidgets);

  const groupedByArea = AREA_ORDER.map((area) => ({
    area,
    areaLabel: AREA_LABELS[area],
    widgets: localWidgets
      .filter((w) => w.area === area)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((group) => group.widgets.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[340px] flex-col gap-0 overflow-hidden p-0 sm:w-[380px]"
      >
        <SheetHeader className="border-b border-[#f0f4f8] px-5 py-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-[#1f6fd1]" />
            <SheetTitle className="text-[16px] font-black text-[#10233f]">
              首頁版型設定
            </SheetTitle>
          </div>
          <p className="text-[12px] font-bold text-[#637185]">
            選擇要在首頁顯示的資訊區塊
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="h-[52px] animate-pulse rounded-[10px] bg-[#f7f9fb]"
                />
              ))}
            </div>
          ) : (
            groupedByArea.map(({ area, areaLabel, widgets }) => (
              <div key={area}>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#8b9aae]">
                  {areaLabel}
                </p>
                <div className="space-y-2">
                  {widgets.map((widget) => (
                    <div
                      key={widget.key}
                      className={cn(
                        "flex items-center gap-3 rounded-[10px] border px-4 py-3 transition",
                        widget.enabled
                          ? "border-[#dfe7ef] bg-white"
                          : "border-[#f0f4f8] bg-[#f7f9fb]",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[13px] font-bold",
                            widget.enabled ? "text-[#10233f]" : "text-[#8b9aae]",
                          )}
                        >
                          {widget.label}
                        </p>
                        <p className="text-[11px] font-bold text-[#9eacbc]">
                          {widget.size === "wide" ? "寬版" : "卡片"}
                        </p>
                      </div>
                      <Switch
                        checked={widget.enabled}
                        onCheckedChange={() => toggleWidget(widget.key)}
                        data-testid={`switch-widget-${widget.key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#f0f4f8] px-5 py-4">
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175] hover:bg-[#f3f6fb]"
            data-testid="button-reset-layout"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            恢復預設
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#1f6fd1] px-4 text-[12px] font-black text-white hover:bg-[#1a5fb8] disabled:opacity-50"
            data-testid="button-save-layout"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "儲存中…" : "儲存設定"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
