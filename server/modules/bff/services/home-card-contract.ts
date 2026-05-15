import type { BffSection } from "@shared/bff/envelope";
import { type HomeCardDto } from "@shared/modules";
import { employeeModuleDescriptorMap } from "./home-contract-defaults";

export const sectionToCard = <T>(
  moduleId: string,
  title: string,
  order: number,
  routePath: string | undefined,
  section: BffSection<T>,
  emptyText: string,
  notConnectedText: string,
): HomeCardDto => {
  const descriptor = employeeModuleDescriptorMap.get(moduleId);
  const stage = descriptor?.stage ?? "planned";
  const data = section.data;
  const isArray = Array.isArray(data);
  const isEmpty = data == null || (isArray && data.length === 0);
  const notConnected = section.status === "unavailable";
  const status: HomeCardDto["status"] =
    stage === "production-ready"
      ? notConnected
        ? "error"
        : isEmpty
          ? "empty"
          : "ready"
      : stage === "bff-wired"
        ? "incomplete"
        : "not_connected";
  return {
    moduleId,
    title,
    status,
    routePath,
    order,
    payload: data,
    sourceStatus: {
      source: descriptor?.bffEndpoint ?? section.meta.errorCode ?? moduleId,
      connected: stage === "production-ready" || stage === "bff-wired",
      lastSyncedAt: section.meta.lastSyncAt,
      errorMessage:
        status === "not_connected"
          ? notConnectedText
          : status === "incomplete"
            ? `${title} 已接上 BFF，但尚未達到 production-ready。`
            : status === "error"
              ? (section.meta.fallbackReason ?? notConnectedText)
              : isEmpty
                ? emptyText
                : undefined,
    },
  };
};
