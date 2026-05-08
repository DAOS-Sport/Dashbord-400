import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReservationDetailModal } from "./_components/reservation-detail-modal";
import { AppHeader, getCourtsBasePath } from "./_components/app-header";
import {
  getCourtName,
  getCourtType,
  getCourtHeaderClass,
  getCourtTypeLabel,
} from "@/lib/court-utils";
import { useSchool } from "@/lib/court-school";
import { getTodayString } from "@/lib/court-date-utils";
import type { CourtReservation as Reservation } from "@shared/schema";

interface SearchResponse {
  query: string;
  startDate: string;
  endDate: string;
  count: number;
  results: Reservation[];
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "已確認",
  pending: "待確認",
  member: "會員",
};

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-blue-500",
  pending: "bg-amber-500",
  member: "bg-emerald-500",
};

function defaultRange() {
  const today = getTodayString();
  const t = new Date(today + "T00:00:00");
  const start = new Date(t);
  start.setDate(start.getDate() - 90);
  const end = new Date(t);
  end.setDate(end.getDate() + 180);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

export default function CourtsSearchPage() {
  const school = useSchool();
  const [location] = useLocation();
  const basePath = getCourtsBasePath(location);
  const initialRange = defaultRange();
  const [keyword, setKeyword] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [selected, setSelected] = useState<Reservation | null>(null);

  const params = new URLSearchParams();
  params.set("q", submittedKeyword);
  params.set("startDate", startDate);
  params.set("endDate", endDate);
  const queryUrl = `/api/courts/${school}/search?${params.toString()}`;

  const { data, isFetching, dataUpdatedAt } = useQuery<SearchResponse>({
    queryKey: [queryUrl],
    enabled: !!submittedKeyword.trim(),
  });

  const groups = useMemo(() => {
    const results = data?.results ?? [];
    const map = new Map<string, Reservation[]>();
    for (const r of results) {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedKeyword(keyword.trim());
  };

  const handleClear = () => {
    setKeyword("");
    setSubmittedKeyword("");
  };

  const formatDateHeader = (dateStr: string) =>
    format(new Date(dateStr + "T00:00:00"), "yyyy年M月d日 (EEEE)", {
      locale: zhTW,
    });

  return (
    <div className="font-sans">
      <AppHeader lastSync={dataUpdatedAt || null} syncLoading={isFetching} />

      <main>
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            搜尋預約
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            依姓名 / 電話 / 預約編號查詢
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6"
        >
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="search-input"
                className="text-sm font-medium text-gray-700 mb-1 block"
              >
                關鍵字
              </Label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="search-input"
                    data-testid="input-search"
                    placeholder="搜尋姓名 / 電話 / 預約編號"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {keyword && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="清除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  data-testid="button-search"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!keyword.trim()}
                >
                  搜尋
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="start-date"
                  className="text-sm font-medium text-gray-700 mb-1 block"
                >
                  起始日期
                </Label>
                <Input
                  id="start-date"
                  data-testid="input-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label
                  htmlFor="end-date"
                  className="text-sm font-medium text-gray-700 mb-1 block"
                >
                  結束日期
                </Label>
                <Input
                  id="end-date"
                  data-testid="input-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </form>

        {!submittedKeyword ? (
          <div
            className="text-center py-12 text-gray-500"
            data-testid="empty-state"
          >
            輸入關鍵字後按「搜尋」開始查詢
          </div>
        ) : isFetching ? (
          <div
            className="flex items-center justify-center py-12 text-blue-600"
            data-testid="status-loading"
          >
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm">搜尋中...</span>
          </div>
        ) : (
          <div>
            <div
              className="mb-4 text-sm text-gray-600"
              data-testid="text-result-count"
            >
              關鍵字「<strong>{submittedKeyword}</strong>」共找到{" "}
              <strong className="text-blue-700">{data?.count ?? 0}</strong> 筆
              {(data?.count ?? 0) > 0 && (
                <span className="text-gray-400">
                  （搜尋範圍：{data?.startDate} ~ {data?.endDate}）
                </span>
              )}
            </div>

            {(data?.count ?? 0) === 0 ? (
              <div
                className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200"
                data-testid="no-results"
              >
                找不到符合的預約。試試擴大日期範圍或更改關鍵字。
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map(([date, list]) => (
                  <div key={date}>
                    <div
                      className="text-sm font-semibold text-gray-700 mb-2"
                      data-testid={`group-date-${date}`}
                    >
                      {formatDateHeader(date)}
                      <Link href={`${basePath}/${school}?date=${date}`}>
                        <span className="ml-2 text-xs text-blue-600 hover:underline cursor-pointer">
                          查看當日排程 →
                        </span>
                      </Link>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                      {list.map((r) => {
                        const type = getCourtType(r.court);
                        return (
                          <button
                            key={r.id}
                            onClick={() => setSelected(r)}
                            data-testid={`result-${r.id}`}
                            className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-start gap-3"
                          >
                            <span
                              className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[r.status] ?? "bg-gray-400"}`}
                              title={STATUS_LABELS[r.status] ?? r.status}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 truncate">
                                  {r.customerName}
                                </span>
                                {r.bookingNumber && (
                                  <span className="text-xs text-gray-500 font-mono">
                                    #{r.bookingNumber}
                                  </span>
                                )}
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${getCourtHeaderClass(type)}`}
                                >
                                  {getCourtTypeLabel(type)}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mt-0.5">
                                {r.startTime}–{r.endTime}　·　
                                {getCourtName(r.court)}
                                {r.serviceName && (
                                  <span className="text-gray-400">
                                    　·　{r.serviceName}
                                  </span>
                                )}
                              </div>
                              {r.phone &&
                                r.phone.trim() !== "" &&
                                r.phone !== "後台匯入" &&
                                r.phone !== "從 Google Calendar 匯入" &&
                                /\d/.test(r.phone) && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    📞 {r.phone}
                                  </div>
                                )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <ReservationDetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        reservation={selected}
      />
    </div>
  );
}
