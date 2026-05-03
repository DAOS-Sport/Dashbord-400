import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getTodayString } from "@/lib/court-date-utils";
import {
  getCourtsBySchool,
  getCourtName,
  getSchoolName,
} from "@/lib/court-utils";
import { useSchool } from "@/lib/court-school";
import { AppHeader } from "./_components/app-header";
import type { CourtReservation as Reservation } from "@shared/schema";

const WEEKDAYS = [
  { value: 1, label: "週一" },
  { value: 2, label: "週二" },
  { value: 3, label: "週三" },
  { value: 4, label: "週四" },
  { value: 5, label: "週五" },
  { value: 6, label: "週六" },
  { value: 0, label: "週日" },
];

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++)
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);

interface ImportResult {
  createdCount: number;
  skippedCount: number;
  created: Reservation[];
  skipped: { date: string; reason: string }[];
}

interface AdminListResponse {
  startDate: string;
  endDate: string;
  count: number;
  results: Reservation[];
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CourtsAdminPage() {
  const { toast } = useToast();
  const today = getTodayString();
  const school = useSchool();
  const schoolName = getSchoolName(school);
  const schoolCourts = getCourtsBySchool(school);
  const noCourts = schoolCourts.length === 0;

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [weekdays, setWeekdays] = useState<number[]>([3]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [court, setCourt] = useState<number>(schoolCourts[0]?.id ?? 0);
  const [customerName, setCustomerName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"confirmed" | "pending" | "member">(
    "member",
  );
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    setCourt(schoolCourts[0]?.id ?? 0);
    setLastResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const [listStart, setListStart] = useState<string>(() => {
    const t = new Date(today + "T00:00:00");
    t.setDate(t.getDate() - 60);
    return fmtDate(t);
  });
  const [listEnd, setListEnd] = useState<string>(() => {
    const t = new Date(today + "T00:00:00");
    t.setDate(t.getDate() + 365);
    return fmtDate(t);
  });

  const listQueryUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("startDate", listStart);
    p.set("endDate", listEnd);
    return `/api/courts/${school}/admin/reservations?${p.toString()}`;
  }, [listStart, listEnd, school]);

  const {
    data: listData,
    isLoading,
    error: listError,
  } = useQuery<AdminListResponse>({
    queryKey: [
      `/api/courts/${school}/admin/reservations`,
      listStart,
      listEnd,
    ],
    queryFn: async () => {
      const res = await apiRequest("GET", listQueryUrl);
      return (await res.json()) as AdminListResponse;
    },
  });
  const allReservations = listData?.results ?? [];

  const previewDates = useMemo(() => {
    if (!startDate || !endDate || weekdays.length === 0) return [];
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    )
      return [];
    const set = new Set(weekdays);
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      if (set.has(cursor.getDay())) dates.push(fmtDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate, weekdays]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/courts/${school}/admin/import`,
        {
          school,
          startDate,
          endDate,
          weekdays,
          startTime,
          endTime,
          court,
          customerName,
          serviceName: serviceName || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
          status,
        },
      );
      return (await res.json()) as ImportResult;
    },
    onSuccess: (result) => {
      setLastResult(result);
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return (
            typeof k === "string" && k.startsWith(`/api/courts/${school}/`)
          );
        },
      });
      toast({
        title: "匯入完成",
        description: `成功新增 ${result.createdCount} 筆，跳過 ${result.skippedCount} 筆`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "匯入失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(
        "DELETE",
        `/api/courts/${school}/admin/reservations/${id}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return (
            typeof k === "string" && k.startsWith(`/api/courts/${school}/`)
          );
        },
      });
      toast({ title: "已刪除預約" });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleWeekday = (value: number) =>
    setWeekdays((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noCourts) {
      toast({
        title: "尚未建立場地，無法匯入",
        variant: "destructive",
      });
      return;
    }
    if (!customerName.trim()) {
      toast({ title: "請輸入使用者名稱", variant: "destructive" });
      return;
    }
    if (weekdays.length === 0) {
      toast({ title: "請至少選擇一個星期", variant: "destructive" });
      return;
    }
    if (previewDates.length === 0) {
      toast({ title: "目前條件下沒有任何日期符合", variant: "destructive" });
      return;
    }
    importMutation.mutate();
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h2
            className="text-xl sm:text-2xl font-bold text-gray-900"
            data-testid="page-title"
          >
            後台批次匯入
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            目前操作學校：
            <strong className="text-gray-700">{schoolName}</strong>
            　·　指定日期區間 + 星期幾 + 時段，一次建立多筆預約
          </p>
        </div>

        {noCourts && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-sm">
            這所學校目前還沒有場地資料，無法批次匯入。請先在
            <code className="mx-1 bg-amber-100 px-1.5 py-0.5 rounded text-xs">
              shared/court-config.ts
            </code>
            加入場地。
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              批次新增預約
            </CardTitle>
            <p className="text-sm text-gray-500">
              指定日期區間、星期幾與時段，一次建立多筆預約。
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">開始日期</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">結束日期</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <div>
                <Label>星期</Label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {WEEKDAYS.map((w) => (
                    <label
                      key={w.value}
                      className="flex items-center gap-2 cursor-pointer"
                      data-testid={`checkbox-weekday-${w.value}`}
                    >
                      <Checkbox
                        checked={weekdays.includes(w.value)}
                        onCheckedChange={() => toggleWeekday(w.value)}
                      />
                      <span className="text-sm">{w.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>開始時間</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger data-testid="select-start-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>結束時間</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger data-testid="select-end-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>場地</Label>
                  <Select
                    value={String(court)}
                    onValueChange={(v) => setCourt(Number(v))}
                    disabled={noCourts}
                  >
                    <SelectTrigger data-testid="select-court">
                      <SelectValue
                        placeholder={noCourts ? "尚無場地" : undefined}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolCourts.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer-name">使用者名稱 *</Label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="例：李教練、籃球社"
                    data-testid="input-customer-name"
                  />
                </div>
                <div>
                  <Label htmlFor="service-name">服務名稱</Label>
                  <Input
                    id="service-name"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="例：固定團練、課程"
                    data-testid="input-service-name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">聯絡電話</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="可留空"
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <Label>狀態</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as typeof status)}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">會員</SelectItem>
                      <SelectItem value="confirmed">已確認</SelectItem>
                      <SelectItem value="pending">待確認</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">備註</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="可留空"
                  data-testid="input-notes"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-900">
                  預覽：將建立 <strong>{previewDates.length}</strong> 筆預約
                  {previewDates.length > 0 && (
                    <span className="text-blue-700 ml-2">
                      （{previewDates[0]} ~{" "}
                      {previewDates[previewDates.length - 1]}）
                    </span>
                  )}
                </div>
                {previewDates.length > 0 && previewDates.length <= 12 && (
                  <div className="text-xs text-blue-700 mt-1">
                    日期：{previewDates.join("、")}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={importMutation.isPending || noCourts}
                data-testid="button-submit-import"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {importMutation.isPending ? "匯入中..." : "送出匯入"}
              </Button>
            </form>

            {lastResult && (
              <div className="mt-4 border-t pt-4 text-sm">
                <div className="font-medium text-gray-900">上次匯入結果</div>
                <div className="text-gray-600 mt-1">
                  成功{" "}
                  <strong className="text-green-700">
                    {lastResult.createdCount}
                  </strong>{" "}
                  筆 ；跳過{" "}
                  <strong className="text-amber-700">
                    {lastResult.skippedCount}
                  </strong>{" "}
                  筆
                </div>
                {lastResult.skipped.length > 0 && (
                  <ul className="text-xs text-gray-500 mt-2 list-disc pl-5">
                    {lastResult.skipped.map((s) => (
                      <li key={s.date}>
                        {s.date} — {s.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>
                已匯入的預約（{allReservations.length} 筆）
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Label htmlFor="list-start" className="text-xs text-gray-500">
                  從
                </Label>
                <Input
                  id="list-start"
                  type="date"
                  value={listStart}
                  onChange={(e) => setListStart(e.target.value)}
                  className="h-8 w-36"
                  data-testid="input-list-start"
                />
                <Label htmlFor="list-end" className="text-xs text-gray-500">
                  到
                </Label>
                <Input
                  id="list-end"
                  type="date"
                  value={listEnd}
                  onChange={(e) => setListEnd(e.target.value)}
                  className="h-8 w-36"
                  data-testid="input-list-end"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              此列表僅顯示後台匯入的{schoolName}預約，Google Calendar
              同步資料不會出現在這裡。
            </p>
          </CardHeader>
          <CardContent>
            {listError ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                載入失敗：{String(listError.message)}
              </div>
            ) : isLoading ? (
              <div className="text-sm text-gray-500">載入中...</div>
            ) : allReservations.length === 0 ? (
              <div className="text-sm text-gray-500">尚無資料</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>時段</TableHead>
                      <TableHead>場地</TableHead>
                      <TableHead>使用者</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>來源</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allReservations.map((r) => (
                      <TableRow
                        key={r.id}
                        data-testid={`reservation-row-${r.id}`}
                      >
                        <TableCell className="text-sm">
                          {format(
                            new Date(r.date + "T00:00:00"),
                            "M/d (EEE)",
                            { locale: zhTW },
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {r.startTime}–{r.endTime}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getCourtName(r.court)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.customerName}
                          {r.serviceName && (
                            <span className="ml-1 text-gray-400 text-xs">
                              · {r.serviceName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.status === "member"
                              ? "會員"
                              : r.status === "confirmed"
                                ? "已確認"
                                : "待確認"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {r.source === "batch"
                              ? "批次"
                              : r.source === "manual"
                                ? "手動"
                                : r.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `確定刪除 ${r.date} ${r.startTime}-${r.endTime} 的預約？`,
                                )
                              ) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                            data-testid={`button-delete-${r.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
