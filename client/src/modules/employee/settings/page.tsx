import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, Check, GripVertical, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import type { ShortcutSummary } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { fetchEmployeeWorkbenchPreferences, updateEmployeeWorkbenchPreferences } from "@/modules/employee/home/api";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { cn } from "@/lib/utils";
import {
  employeeShortcutCandidates,
  employeeShortcutLimit,
  employeeShortcutSurfaceClass,
  employeeShortcutToneClass,
  getEmployeeShortcutIcon,
  mergeEmployeeShortcutPreference,
  normalizeEmployeeActionableShortcuts,
  readEmployeeShortcutPreference,
  resetEmployeeShortcutPreference,
  writeEmployeeShortcutPreference,
} from "@/modules/employee/quick-actions";

const isInternalHref = (href?: string | null) => Boolean(href?.startsWith("/"));

export default function EmployeeSettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useAuthMe();
  const switchFacility = useSwitchFacility();
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const preferenceQuery = useQuery({
    queryKey: ["/api/bff/employee/workbench-preferences", "employee-settings"],
    queryFn: fetchEmployeeWorkbenchPreferences,
    staleTime: 60_000,
  });
  const candidates = useMemo(
    () => preferenceQuery.data?.candidates?.length ? preferenceQuery.data.candidates : employeeShortcutCandidates,
    [preferenceQuery.data?.candidates],
  );
  const baseShortcuts = useMemo(() => normalizeEmployeeActionableShortcuts(candidates), [candidates]);
  const [shortcuts, setShortcuts] = useState<ShortcutSummary[]>(() =>
    mergeEmployeeShortcutPreference(employeeShortcutCandidates, readEmployeeShortcutPreference()),
  );
  const [preferredFacilityKey, setPreferredFacilityKey] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const remainingCandidates = candidates.filter((candidate) => !shortcuts.some((item) => item.id === candidate.id));
  const preferenceMutation = useMutation({
    mutationFn: (next: { quickActions?: ShortcutSummary[]; preferredFacilityKey?: string | null }) => updateEmployeeWorkbenchPreferences(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/workbench-preferences"] });
    },
  });

  useEffect(() => {
    if (preferenceQuery.data?.quickActions?.length) {
      setShortcuts(mergeEmployeeShortcutPreference(candidates, preferenceQuery.data.quickActions));
      setPreferredFacilityKey(preferenceQuery.data.preferredFacilityKey);
      return;
    }
    if (!baseShortcuts.length) return;
    setShortcuts(mergeEmployeeShortcutPreference(baseShortcuts, readEmployeeShortcutPreference()));
    setPreferredFacilityKey(session?.activeFacility ?? null);
  }, [baseShortcuts, candidates, preferenceQuery.data?.preferredFacilityKey, preferenceQuery.data?.quickActions, session?.activeFacility]);

  const persist = (next: ShortcutSummary[]) => {
    writeEmployeeShortcutPreference(next);
    preferenceMutation.mutate({ quickActions: next, preferredFacilityKey });
    return next;
  };

  const choosePreferredFacility = (facilityKey: string) => {
    setPreferredFacilityKey(facilityKey);
    preferenceMutation.mutate({ quickActions: shortcuts, preferredFacilityKey: facilityKey });
    if (facilityKey !== session?.activeFacility) switchFacility.mutate(facilityKey);
  };

  const moveShortcut = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= shortcuts.length) return;
    setShortcuts((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return persist(next);
    });
  };

  const dropShortcut = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setShortcuts((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return persist(next);
    });
    setDragIndex(null);
  };

  const removeShortcut = (id: string) => {
    setShortcuts((current) => persist(current.filter((item) => item.id !== id)));
  };

  const addShortcut = (shortcut: ShortcutSummary) => {
    setShortcuts((current) => {
      if (current.length >= employeeShortcutLimit || current.some((item) => item.id === shortcut.id)) return current;
      return persist([...current, shortcut]);
    });
    setShowAddMenu(false);
  };

  const resetShortcuts = () => {
    resetEmployeeShortcutPreference();
    const next = baseShortcuts.length ? baseShortcuts : employeeShortcutCandidates.slice(0, employeeShortcutLimit);
    setShortcuts(next);
    preferenceMutation.mutate({ quickActions: next, preferredFacilityKey });
    setShowAddMenu(false);
  };

  return (
    <EmployeeShell title="員工設定" subtitle="管理目前帳號的場館切換與右側快速入口。">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <WorkbenchCard className="p-5">
          <div className="mb-5 rounded-[10px] border border-[#dfe7ef] bg-[#fbfcfd] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#007166]">Facility</p>
                <h2 className="mt-1 text-[18px] font-black text-[#10233f]">切換場館</h2>
                <p className="mt-1 text-[13px] font-medium text-[#637185]">此設定會跟著員工帳號保存，工作台頁首的場館切換器也可隨時更換。</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#637185]">{granted.length} 個授權館別</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {granted.map((facilityKey) => {
                const active = facilityKey === (preferredFacilityKey ?? session?.activeFacility);
                return (
                  <button
                    key={facilityKey}
                    type="button"
                    onClick={() => choosePreferredFacility(facilityKey)}
                    className={cn(
                      "workbench-focus flex min-h-[72px] items-center gap-3 rounded-[8px] border bg-white px-3 text-left transition",
                      active ? "border-[#1cb4a3] bg-[#eefaf5]" : "border-[#dfe7ef] hover:border-[#b7c7d8]",
                    )}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#eef5ff] text-[#1f6fd1]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-black text-[#10233f]">{facilityLabels.getFacilityName(facilityKey)}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-[#8b9aae]">{active ? "目前預設館別" : "設為工作館別"}</span>
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0 text-[#15935d]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#007166]">Quick Actions</p>
              <h2 className="mt-1 text-[20px] font-black text-[#10233f]">快速操作管理</h2>
              <p className="mt-1 text-[13px] font-medium text-[#637185]">
                拖曳項目或用上下箭頭調整順序，首頁右側浮動面板會套用這份設定。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={shortcuts.length >= employeeShortcutLimit || !remainingCandidates.length}
                onClick={() => setShowAddMenu((current) => !current)}
                className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white disabled:opacity-45"
              >
                <Plus className="h-4 w-4" />
                新增入口
              </button>
              <button
                type="button"
                onClick={resetShortcuts}
                className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]"
              >
                <RotateCcw className="h-4 w-4" />
                重設
              </button>
            </div>
          </div>

          {showAddMenu ? (
            <div className="mt-4 grid gap-2 rounded-[8px] border border-dashed border-[#cfd9e5] bg-[#fbfcfd] p-3 sm:grid-cols-2 xl:grid-cols-3">
              {remainingCandidates.map((candidate) => {
                const Icon = getEmployeeShortcutIcon(candidate);
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => addShortcut(candidate)}
                    className="workbench-focus flex min-h-11 items-center gap-3 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-left hover:border-[#9dd84f]"
                  >
                    <span className={cn("grid h-8 w-8 place-items-center rounded-[8px]", employeeShortcutToneClass[candidate.tone])}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black text-[#10233f]">{candidate.label}</span>
                      <span className="block truncate text-[11px] font-bold text-[#8b9aae]">{isInternalHref(candidate.href) ? "工作台入口" : "外部連結"}</span>
                    </span>
                  </button>
                );
              })}
              {!remainingCandidates.length ? <div className="text-[12px] font-bold text-[#637185]">目前沒有可新增的入口。</div> : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {preferenceMutation.isPending ? (
              <div className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-3 text-[12px] font-bold text-[#637185]">同步帳號設定中...</div>
            ) : null}
            {preferenceMutation.isError ? (
              <div className="rounded-[8px] border border-[#ffd6dc] bg-[#fff3f5] p-3 text-[12px] font-bold text-[#db4b5a]">帳號設定同步失敗，已先保留在此瀏覽器。</div>
            ) : null}
            {preferenceQuery.isLoading ? (
              <div className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-6">
                <DreamLoader label="設定載入中" />
              </div>
            ) : null}
            {shortcuts.map((shortcut, index) => {
              const Icon = getEmployeeShortcutIcon(shortcut);
              return (
                <div
                  key={shortcut.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropShortcut(index)}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    "flex min-h-[74px] cursor-grab items-center gap-3 rounded-[8px] border bg-white p-3 shadow-[0_14px_36px_-34px_rgba(15,34,58,0.65)] transition",
                    employeeShortcutSurfaceClass[shortcut.tone],
                    dragIndex === index ? "scale-[0.99] opacity-60" : "hover:-translate-y-0.5 hover:shadow-md",
                  )}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white/70 text-[#8b9aae]" aria-hidden>
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[8px]", employeeShortcutToneClass[shortcut.tone])}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-[#10233f]">{shortcut.label}</p>
                    <p className="mt-0.5 truncate text-[12px] font-bold text-[#637185]">{shortcut.href}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveShortcut(index, -1)}
                      disabled={index === 0}
                      aria-label={`上移 ${shortcut.label}`}
                      className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175] disabled:opacity-35"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveShortcut(index, 1)}
                      disabled={index === shortcuts.length - 1}
                      aria-label={`下移 ${shortcut.label}`}
                      className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#536175] disabled:opacity-35"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeShortcut(shortcut.id)}
                      aria-label={`移除 ${shortcut.label}`}
                      className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#ffd6dc] bg-white text-[#db4b5a] hover:bg-[#fff3f5]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {!shortcuts.length && !preferenceQuery.isLoading ? (
              <div className="rounded-[8px] border border-dashed border-[#cfd9e5] bg-[#fbfcfd] p-8 text-center text-[13px] font-bold text-[#637185]">
                尚未設定快速操作，請新增入口。
              </div>
            ) : null}
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="h-fit p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eaf8ef] text-[#15935d]">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-[#10233f]">首頁顯示規則</h2>
              <p className="text-[12px] font-bold text-[#637185]">{shortcuts.length}/{employeeShortcutLimit} 個入口</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-[12px] font-bold leading-5 text-[#536175]">
            <p>快速操作只作為入口導覽，不在首頁直接新增、審核或刪除資料。</p>
            <p>桌機右側浮動面板可拖曳位置；手機和平板仍維持原本底部導覽。</p>
            {preferenceQuery.isError ? <p className="text-[#db4b5a]">目前無法讀取帳號偏好，設定頁會先使用預設入口。</p> : null}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
