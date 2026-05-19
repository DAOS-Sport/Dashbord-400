import type { RagicEmployeeRecord } from "../integrations/ragic/auth-adapter";
import type { FacilityCandidateDto } from "@shared/auth/me";
import { createRagicAuthAdapter } from "../integrations/ragic";
import { listRagicH05FacilityCandidates } from "../integrations/ragic/facility-adapter";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = REFRESH_INTERVAL_MS * 2.5;

type CacheSlot<T> = {
  data: T | null;
  source: string;
  lastPrimedAt: Date | null;
  lastAttemptAt: Date | null;
  lastRefreshSucceededAt: Date | null;
  error: string | null;
};

const emptySlot = <T>(): CacheSlot<T> => ({
  data: null,
  source: "none",
  lastPrimedAt: null,
  lastAttemptAt: null,
  lastRefreshSucceededAt: null,
  error: null,
});

const slotStatus = (slot: CacheSlot<unknown>): "ok" | "degraded" => {
  if (slot.data === null) return "degraded";
  if (slot.error !== null) {
    const ageMs = slot.lastRefreshSucceededAt
      ? Date.now() - slot.lastRefreshSucceededAt.getTime()
      : Infinity;
    if (ageMs > STALE_THRESHOLD_MS) return "degraded";
  }
  return "ok";
};

class RagicCacheService {
  private readonly adapter = createRagicAuthAdapter();
  private employees: CacheSlot<RagicEmployeeRecord[]> = emptySlot();
  private facilities: CacheSlot<FacilityCandidateDto[]> = emptySlot();
  private timer: ReturnType<typeof setInterval> | null = null;

  private async refreshEmployees(): Promise<void> {
    const attemptedAt = new Date();
    try {
      const result = await this.adapter.listActiveEmployees();
      if (result.data) {
        this.employees = {
          data: result.data,
          source: result.meta.source,
          lastPrimedAt: attemptedAt,
          lastAttemptAt: attemptedAt,
          lastRefreshSucceededAt: attemptedAt,
          error: null,
        };
      } else {
        const errMsg = result.meta.fallbackReason ?? "Ragic employees unavailable";
        this.employees = { ...this.employees, lastAttemptAt: attemptedAt, error: errMsg };
        console.warn(`[RagicCache] employees refresh failed: ${errMsg}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      this.employees = { ...this.employees, lastAttemptAt: attemptedAt, error: errMsg };
      console.warn(`[RagicCache] employees exception: ${errMsg}`);
    }
  }

  private async refreshFacilities(): Promise<void> {
    const attemptedAt = new Date();
    try {
      const result = await listRagicH05FacilityCandidates();
      if (result.data) {
        this.facilities = {
          data: result.data,
          source: result.meta.source,
          lastPrimedAt: attemptedAt,
          lastAttemptAt: attemptedAt,
          lastRefreshSucceededAt: attemptedAt,
          error: null,
        };
      } else {
        const errMsg = result.meta.fallbackReason ?? "Ragic facilities unavailable";
        this.facilities = { ...this.facilities, lastAttemptAt: attemptedAt, error: errMsg };
        console.warn(`[RagicCache] facilities refresh failed: ${errMsg}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      this.facilities = { ...this.facilities, lastAttemptAt: attemptedAt, error: errMsg };
      console.warn(`[RagicCache] facilities exception: ${errMsg}`);
    }
  }

  getEmployees(): CacheSlot<RagicEmployeeRecord[]> {
    return this.employees;
  }

  getFacilities(): CacheSlot<FacilityCandidateDto[]> {
    return this.facilities;
  }

  status() {
    const ageMs = (slot: CacheSlot<unknown>) =>
      slot.lastPrimedAt ? Date.now() - slot.lastPrimedAt.getTime() : null;

    return {
      employees: {
        status: slotStatus(this.employees),
        count: this.employees.data?.length ?? 0,
        source: this.employees.source,
        lastPrimedAt: this.employees.lastPrimedAt?.toISOString() ?? null,
        ageMs: ageMs(this.employees),
        error: this.employees.error,
      },
      facilities: {
        status: slotStatus(this.facilities),
        count: this.facilities.data?.length ?? 0,
        source: this.facilities.source,
        lastPrimedAt: this.facilities.lastPrimedAt?.toISOString() ?? null,
        ageMs: ageMs(this.facilities),
        error: this.facilities.error,
      },
    };
  }

  start(): void {
    void Promise.all([this.refreshEmployees(), this.refreshFacilities()]).then(() => {
      const s = this.status();
      console.log(`[RagicCache] primed: ${s.employees.count} employees (${s.employees.source}), ${s.facilities.count} facilities (${s.facilities.source})`);
    });

    this.timer = setInterval(() => {
      void Promise.all([this.refreshEmployees(), this.refreshFacilities()]);
    }, REFRESH_INTERVAL_MS);

    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const ragicCacheService = new RagicCacheService();
