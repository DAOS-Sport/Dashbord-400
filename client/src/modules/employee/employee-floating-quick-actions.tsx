import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FloatingQuickActionsPanel } from "@/modules/workbench/floating-quick-actions";
import { fetchEmployeeWorkbenchPreferences } from "@/modules/employee/home/api";
import {
  employeeShortcutCandidates,
  mergeEmployeeShortcutPreference,
  normalizeEmployeeActionableShortcuts,
  readEmployeeShortcutPreference,
  toFloatingQuickActionItem,
} from "@/modules/employee/quick-actions";

export function EmployeeFloatingQuickActions() {
  const preferenceQuery = useQuery({
    queryKey: ["/api/bff/employee/workbench-preferences"],
    queryFn: fetchEmployeeWorkbenchPreferences,
    staleTime: 30_000,
  });
  const shortcuts = useMemo(() => {
    if (preferenceQuery.data?.quickActions?.length) {
      return normalizeEmployeeActionableShortcuts(preferenceQuery.data.quickActions);
    }
    return mergeEmployeeShortcutPreference(employeeShortcutCandidates, readEmployeeShortcutPreference()).slice(0, 3);
  }, [preferenceQuery.data?.quickActions]);

  return (
    <FloatingQuickActionsPanel
      eyebrow="Employee Actions"
      title="員工快捷操作"
      items={shortcuts.map(toFloatingQuickActionItem)}
      tone="blue"
    />
  );
}
