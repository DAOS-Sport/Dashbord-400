import { useCallback } from "react";
import { useLocation } from "wouter";
import type { UiEventType } from "@shared/telemetry/events";
import { apiPost } from "@/shared/api/client";
import { useAuthMe } from "@/shared/auth/session";
import { getCorrelationId } from "./correlation";

export const useTrackEvent = () => {
  const [location] = useLocation();
  const { data: session } = useAuthMe();

  return useCallback(
    (eventType: UiEventType, metadata: Record<string, unknown> = {}) => {
      apiPost("/api/telemetry/ui-events", {
        eventType,
        correlationId: getCorrelationId(),
        page: location,
        componentId: typeof metadata.moduleId === "string" ? metadata.moduleId : undefined,
        actionType: eventType,
        payload: {
          ...metadata,
          role: session?.activeRole,
          facilityKey: session?.activeFacility,
        },
        occurredAt: new Date().toISOString(),
      }).catch((error) => {
        apiPost("/api/telemetry/client-error", {
          message: error instanceof Error ? error.message : "Telemetry dispatch failed",
          correlationId: getCorrelationId(),
          page: location,
          componentId: typeof metadata.moduleId === "string" ? metadata.moduleId : undefined,
          occurredAt: new Date().toISOString(),
        }).catch(() => undefined);
      });
    },
    [location, session?.activeFacility, session?.activeRole],
  );
};
