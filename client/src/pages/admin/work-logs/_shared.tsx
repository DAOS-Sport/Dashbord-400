import { useEffect, useState, type ReactNode } from "react";
import { useLocation, Link, Redirect } from "wouter";
import { useAuthMe } from "@/shared/auth/session";
import { facilityConfigs } from "@/config/facility-configs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";

export type WorkLogModule = "lifeguard" | "counter";

const STORAGE_KEY: Record<WorkLogModule, string> = {
  lifeguard: "work-logs-admin-facility",
  counter: "counter-logs-admin-facility",
};

const MODULE_LABEL: Record<WorkLogModule, string> = {
  lifeguard: "救生員日誌",
  counter: "櫃台日誌",
};

const URL_PREFIX: Record<WorkLogModule, string> = {
  lifeguard: "/admin/work-logs",
  counter: "/admin/counter-logs",
};

export function detectModuleFromPath(path: string): WorkLogModule {
  return path.startsWith("/admin/counter-logs") ? "counter" : "lifeguard";
}

export function useModuleType(): WorkLogModule {
  const [location] = useLocation();
  return detectModuleFromPath(location);
}

export const FACILITY_OPTIONS = Object.values(facilityConfigs).map((f) => ({
  value: f.facilityKey,
  label: `${f.shortName} · ${f.facilityName}`,
}));

export function useAdminFacility(): [string, (k: string) => void] {
  const moduleType = useModuleType();
  const storageKey = STORAGE_KEY[moduleType];
  const [facilityKey, setFacilityKey] = useState<string>(() => {
    if (typeof window === "undefined") return FACILITY_OPTIONS[0]?.value ?? "";
    return window.localStorage.getItem(storageKey) || FACILITY_OPTIONS[0]?.value || "";
  });
  useEffect(() => {
    if (typeof window !== "undefined" && facilityKey) {
      window.localStorage.setItem(storageKey, facilityKey);
    }
  }, [facilityKey, storageKey]);
  return [facilityKey, setFacilityKey];
}

interface TabSpec { slug: string; label: string }

const COMMON_TABS: TabSpec[] = [
  { slug: "daily-templates", label: "每日固定" },
  { slug: "assigned-tasks", label: "主管交辦" },
  { slug: "recurring-templates", label: "每週循環" },
];

const LIFEGUARD_ONLY_TABS: TabSpec[] = [
  { slug: "water-schedules", label: "水質時段" },
  { slug: "water-standards", label: "水質標準" },
];

const TAIL_TAB: TabSpec = { slug: "submissions", label: "主管審核" };

function tabsForModule(moduleType: WorkLogModule): Array<TabSpec & { url: string }> {
  const base = moduleType === "lifeguard"
    ? [...COMMON_TABS, ...LIFEGUARD_ONLY_TABS, TAIL_TAB]
    : [...COMMON_TABS, TAIL_TAB];
  const prefix = URL_PREFIX[moduleType];
  return base.map((t) => ({ ...t, url: `${prefix}/${t.slug}` }));
}

interface ShellProps {
  title: string;
  description?: string;
  facilityKey: string;
  onFacilityChange: (k: string) => void;
  showFacility?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkLogAdminShell({
  title,
  description,
  facilityKey,
  onFacilityChange,
  showFacility = true,
  actions,
  children,
}: ShellProps) {
  const [location] = useLocation();
  const moduleType = detectModuleFromPath(location);
  const tabs = tabsForModule(moduleType);
  const moduleLabel = MODULE_LABEL[moduleType];

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                {moduleLabel} · 後台管理
              </p>
              <h1 className="text-xl font-bold mt-0.5" data-testid="text-page-title">{title}</h1>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showFacility && (
                <Select value={facilityKey} onValueChange={onFacilityChange}>
                  <SelectTrigger className="w-[260px]" data-testid="select-admin-facility">
                    <SelectValue placeholder="選擇場館" />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} data-testid={`option-facility-${o.value}`}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {actions}
            </div>
          </div>
          <nav className="flex gap-1 mt-4 -mb-px overflow-x-auto" role="tablist">
            {tabs.map((t) => {
              const active = location === t.url;
              return (
                <Link
                  key={t.url}
                  href={t.url}
                  className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition whitespace-nowrap ${
                    active
                      ? "border-primary text-primary bg-background"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                  data-testid={`tab-${t.slug}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function AdminRoleGuard({ children }: { children: ReactNode }) {
  const { data: session, isLoading, isError } = useAuthMe();
  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <DreamLoader label="權限驗證中" />
      </div>
    );
  }
  if (isError || !session) {
    return <Redirect to="/login" />;
  }
  const allowed = session.grantedRoles?.includes("supervisor") || session.grantedRoles?.includes("system");
  if (!allowed) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center space-y-3" data-testid="text-no-permission">
          <p className="text-lg font-bold">無瀏覽權限</p>
          <p className="text-sm text-muted-foreground">
            此頁面僅開放給主管或系統管理員使用，目前帳號無對應權限。
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive" data-testid="text-error">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground" data-testid="text-empty">
      {message}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="grid place-items-center py-16" data-testid="text-loading">
      <DreamLoader label="載入中" compact />
    </div>
  );
}

const SHIFT_LABEL: Record<string, string> = {
  morning: "早班",
  noon: "中班",
  night: "晚班",
  all: "全班",
};

export function shiftLabel(s: string): string {
  return SHIFT_LABEL[s] ?? s;
}

const INPUT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "checkbox", label: "勾選 (checkbox)" },
  { value: "text", label: "短文字 (text)" },
  { value: "textarea", label: "多行文字 (textarea)" },
  { value: "number", label: "數字 (number)" },
  { value: "select", label: "下拉單選 (select)" },
  { value: "multiselect", label: "多選按鈕 (multiselect)" },
  { value: "time", label: "時間 (time)" },
  { value: "date", label: "日期 (date)" },
  { value: "rating", label: "評分 (rating)" },
  { value: "photo", label: "照片 (photo)" },
  { value: "number_photo", label: "數字+照片 (number_photo)" },
  { value: "checkbox_photo", label: "勾選+照片 (checkbox_photo)" },
  { value: "yes_no", label: "是/否 (yes_no)" },
  { value: "on_off", label: "ON/OFF (on_off)" },
  { value: "yes_no_remark", label: "是/否+備註 (yes_no_remark)" },
  { value: "water_quality_form", label: "水質表單 (water_quality_form)" },
];

export const INPUT_TYPES = INPUT_TYPE_OPTIONS;
