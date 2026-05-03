import { useQuery } from "@tanstack/react-query";
import { useAuthMe } from "@/shared/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParkingShell, ParkingGuard } from "./_shared";

interface Summary {
  activeVehicleCount: number;
  expiringSoonCount: number;
  pendingPaymentReviewCount: number;
  notSignedCount: number;
  overdueCount: number;
  todayEventDayCount: number;
  monthRevenue: number;
}

const CARDS: Array<{ key: keyof Summary; label: string; tone: "primary" | "warn" | "danger" | "ok" | "muted"; suffix?: string }> = [
  { key: "activeVehicleCount",        label: "履約中車輛",     tone: "primary" },
  { key: "expiringSoonCount",         label: "30 日內到期",   tone: "warn" },
  { key: "pendingPaymentReviewCount", label: "待審核付款",     tone: "warn" },
  { key: "notSignedCount",            label: "尚未簽約",       tone: "muted" },
  { key: "overdueCount",              label: "已逾期",         tone: "danger" },
  { key: "todayEventDayCount",        label: "今日活動日",     tone: "ok" },
  { key: "monthRevenue",              label: "本月收入 (NTD)", tone: "primary" },
];

const TONE: Record<string, string> = {
  primary: "text-primary",
  warn:    "text-amber-600 dark:text-amber-400",
  danger:  "text-destructive",
  ok:      "text-emerald-600 dark:text-emerald-400",
  muted:   "text-muted-foreground",
};

export default function ParkingDashboardPage() {
  const { data: session, isLoading, isError } = useAuthMe();
  const q = useQuery<Summary>({
    queryKey: ["/api/parking/dashboard"],
  });

  return (
    <ParkingGuard session={session} isLoading={isLoading} isError={isError}>
      <ParkingShell title="戰情總覽" subtitle="即時掌握車輛、合約與收款狀態">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c) => (
            <Card key={String(c.key)} data-testid={`card-summary-${String(c.key)}`} className="border-border">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{c.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold tabular-nums ${TONE[c.tone]}`} data-testid={`text-${String(c.key)}`}>
                  {q.isLoading ? "…" : q.data ? Number(q.data[c.key] ?? 0).toLocaleString() : "0"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        {q.isError ? <p className="mt-4 text-sm text-destructive">載入失敗，請稍後重試。</p> : null}
        <div className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          後續功能預留：到期通知排程、月度報表匯出、活動日壅塞預警、LINE/Email 推播。
        </div>
      </ParkingShell>
    </ParkingGuard>
  );
}
