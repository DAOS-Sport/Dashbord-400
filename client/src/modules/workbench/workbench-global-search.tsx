import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import type { WorkbenchRole } from "@shared/auth/me";
import { apiGet } from "@/shared/api/client";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  summary: string;
  href: string;
}

const TYPE_LABELS: Record<string, string> = {
  announcement: "公告",
  handover: "交辦",
  task: "任務",
  shift: "班表",
  shortcut: "捷徑",
  document: "文件",
  campaign: "活動",
  training: "教育訓練",
  qna: "常見問題",
  module: "模組",
};

const TYPE_COLORS: Record<string, string> = {
  announcement: "bg-[#fef3c7] text-[#92400e]",
  handover: "bg-[#ede9fe] text-[#5b21b6]",
  task: "bg-[#fce7f3] text-[#9d174d]",
  shift: "bg-[#d1fae5] text-[#065f46]",
  shortcut: "bg-[#e0f2fe] text-[#0369a1]",
  document: "bg-[#f3f4f6] text-[#374151]",
  campaign: "bg-[#fef3c7] text-[#92400e]",
  training: "bg-[#e0e7ff] text-[#3730a3]",
  qna: "bg-[#dcfce7] text-[#166534]",
  module: "bg-[#eef5ff] text-[#1f6fd1]",
};

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function fetchSearch(role: WorkbenchRole, query: string, facilityKey?: string) {
  if (role === "employee" || role === "lifeguard") {
    const params = new URLSearchParams({ q: query });
    if (facilityKey) params.set("facilityKey", facilityKey);
    return apiGet<{ query: string; items: SearchResultItem[] }>(
      `/api/bff/employee/search?${params.toString()}`,
    );
  }
  return apiGet<{ query: string; items: SearchResultItem[] }>(
    `/api/search/global?q=${encodeURIComponent(query)}`,
  );
}

export function WorkbenchGlobalSearch({
  role,
  className,
}: {
  role: WorkbenchRole;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility;

  const debouncedQuery = useDebounce(inputValue, 300);
  const canSearch = debouncedQuery.trim().length >= 2;

  const searchQuery = useQuery({
    queryKey: ["/api/search", role, debouncedQuery, facilityKey],
    queryFn: () => fetchSearch(role, debouncedQuery.trim(), facilityKey),
    enabled: canSearch,
    staleTime: 15_000,
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setInputValue("");
    }
  }, [open]);

  const handleSelect = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const items = searchQuery.data?.items ?? [];

  return (
    <>
      <button
        type="button"
        aria-label="全局搜尋 (Ctrl+K)"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
        className={cn(
          "workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white md:bg-[#f0f4f8] md:text-[#10233f] lg:bg-[#f0f4f8] lg:text-[#10233f]",
          className,
        )}
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80dvh] w-[min(92vw,560px)] overflow-hidden rounded-[14px] p-0 shadow-[0_32px_80px_-40px_rgba(13,34,58,0.62)]">
          <DialogHeader className="sr-only">
            <DialogTitle>全局搜尋</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 border-b border-[#e6edf5] px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[#9aa8ba]" />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="搜尋公告、任務、模組、常見問題…"
              data-testid="input-global-search"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-bold text-[#10233f] outline-none placeholder:text-[#9aa8ba]"
            />
            <div className="flex items-center gap-2">
              <kbd className="hidden rounded-[5px] border border-[#dfe7ef] bg-[#f7f9fb] px-1.5 py-0.5 text-[10px] font-black text-[#8b9aae] sm:block">
                ESC
              </kbd>
              {inputValue ? (
                <button
                  type="button"
                  aria-label="清除搜尋"
                  onClick={() => setInputValue("")}
                  className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#f2f6fa]"
                >
                  <X className="h-3.5 w-3.5 text-[#8b9aae]" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[calc(80dvh-60px)] overflow-y-auto">
            {!canSearch && (
              <div className="px-4 py-10 text-center text-[13px] font-bold text-[#9aa8ba]">
                輸入至少 2 個字元開始搜尋
              </div>
            )}

            {canSearch && searchQuery.isFetching && !items.length && (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] font-bold text-[#637185]">
                <Loader2 className="h-4 w-4 animate-spin" />
                搜尋中…
              </div>
            )}

            {canSearch && !searchQuery.isFetching && !items.length && (
              <div className="px-4 py-10 text-center text-[13px] font-bold text-[#9aa8ba]">
                找不到符合「{debouncedQuery.trim()}」的結果
              </div>
            )}

            {items.length > 0 && (
              <div className="p-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.href)}
                    data-testid={`search-result-${item.id}`}
                    className="flex w-full min-h-11 items-center gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-[#f7f9fb]"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-[6px] px-2 py-0.5 text-[11px] font-black",
                        TYPE_COLORS[item.type] ?? "bg-[#f0f4f8] text-[#536175]",
                      )}
                    >
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-black text-[#10233f]">
                        {item.title}
                      </span>
                      {item.summary ? (
                        <span className="block truncate text-[11px] font-bold text-[#8b9aae]">
                          {item.summary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#f0f4f8] px-4 py-2">
              <span className="text-[10px] font-bold text-[#c4cdd6]">
                {role === "employee" || role === "lifeguard"
                  ? "搜尋範圍：公告、交辦、班表、捷徑、常見問題"
                  : "搜尋範圍：系統模組登錄"}
              </span>
              <kbd className="rounded-[5px] border border-[#dfe7ef] bg-[#f7f9fb] px-1.5 py-0.5 text-[10px] font-black text-[#8b9aae]">
                ⌘K
              </kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
