export type ModuleCompletionEventBinding = {
  startEvent: string;
  completionEvent: string;
};

export type InsightAnomalyType = "spike" | "drop";

export const moduleCompletionEvents: Record<string, ModuleCompletionEventBinding> = {
  "lifeguard-water-quality": {
    startEvent: "NAV_CLICK:lifeguard-water-quality",
    completionEvent: "LIFEGUARD_WATER_QUALITY_CREATED",
  },
  "lifeguard-coach-dive": {
    startEvent: "NAV_CLICK:lifeguard-coach-dive",
    completionEvent: "LIFEGUARD_COACH_DIVE_CREATED",
  },
  "lifeguard-cleanup": {
    startEvent: "NAV_CLICK:lifeguard-cleanup",
    completionEvent: "LIFEGUARD_CLEANUP_CREATED",
  },
  "lifeguard-lost-and-found": {
    startEvent: "NAV_CLICK:lifeguard-lost-and-found",
    completionEvent: "LIFEGUARD_LOST_ITEM_CREATED",
  },
  handover: {
    startEvent: "NAV_CLICK:handover",
    completionEvent: "OPERATIONAL_HANDOVER_CREATED",
  },
};

export const calculateDeltaPct = (currentCount: number, previousCount: number) => {
  if (previousCount <= 0) return currentCount > 0 ? 999 : 0;
  return Math.round(((currentCount - previousCount) / previousCount) * 100);
};

export const classifyInsightAnomaly = (
  currentCount: number,
  previousCount: number,
): InsightAnomalyType | null => {
  const deltaPct = calculateDeltaPct(currentCount, previousCount);
  if (deltaPct > 300) return "spike";
  if (deltaPct < -30) return "drop";
  return null;
};

export const calculateCompletionRate = (startCount: number, completionCount: number) => {
  if (startCount <= 0) return undefined;
  return Math.min(100, Math.round((completionCount / startCount) * 100));
};
