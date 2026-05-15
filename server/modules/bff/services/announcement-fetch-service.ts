import {
  classifyAnnouncementMessage,
  sanitizeAnnouncementCandidate,
} from "@shared/announcement-classifier";
import { findFacilityLineGroup } from "@shared/domain/facilities";
import type { AnnouncementSummary } from "@shared/domain/workbench";
import { env } from "../../../shared/config/env";

import { asArray, readText } from "./resource-mappers";

export const fetchJsonIfAvailable = async <T>(
  url: URL,
  token?: string,
): Promise<T | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.externalApiTimeoutMs,
  );
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Internal-Token"] = token;
    headers["X-API-Key"] = token;
  }
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchAnnouncementCandidateFallback = async (
  facilityKey: string,
): Promise<AnnouncementSummary[]> => {
  const facility = findFacilityLineGroup(facilityKey);
  const url = new URL("/api/announcement-candidates", env.lineBotBaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "20");
  if (facility?.lineGroupId)
    url.searchParams.set("groupId", facility.lineGroupId);
  const payload = await fetchJsonIfAvailable<unknown>(url);
  return asArray<Record<string, unknown>>(payload)
    .map((item) => sanitizeAnnouncementCandidate(item))
    .filter(
      (
        item,
      ): item is Record<string, unknown> & {
        localClassifier: ReturnType<typeof classifyAnnouncementMessage>;
      } => Boolean(item),
    )
    .filter(
      (item) =>
        !facility?.lineGroupId ||
        !readText(item.groupId) ||
        item.groupId === facility.lineGroupId,
    )
    .filter((item) => {
      const candidateType = readText(item.candidateType).toLowerCase();
      const status = readText(item.status).toLowerCase();
      const confidence = Number(item.confidence ?? 0);
      const approved =
        status === "approved" || status === "published" || status === "active";
      return candidateType !== "ignore" && approved && confidence >= 0.7;
    })
    .slice(0, 8)
    .map((item, index) => ({
      id: String(item.id ?? `candidate-${index}`),
      externalReferenceId: readText(
        item.externalReferenceId ??
          item.sourceMessageId ??
          item.messageId ??
          item.id,
        `candidate-${index}`,
      ),
      title: readText(item.title, "未命名公告"),
      summary: readText(item.summary ?? item.originalText, ""),
      content: readText(
        item.body ?? item.content ?? item.originalText ?? item.summary,
        "",
      ),
      priority:
        item.localClassifier.priority === "must_read" ||
        item.status === "pending" ||
        Number(item.confidence ?? 0) >= 0.8
          ? "required"
          : "normal",
      type:
        item.localClassifier.priority === "must_read" ||
        item.status === "pending" ||
        Number(item.confidence ?? 0) >= 0.8
          ? "required"
          : "notice",
      isPinned:
        item.localClassifier.priority === "must_read" ||
        item.status === "pending" ||
        Number(item.confidence ?? 0) >= 0.8,
      effectiveRange: readText(item.detectedAt ?? item.startAt, "即時"),
      publishedAt: readText(
        item.detectedAt ?? item.startAt,
        new Date().toISOString(),
      ),
      createdAt: readText(
        item.createdAt ?? item.detectedAt ?? item.startAt,
        new Date().toISOString(),
      ),
      deadlineLabel: readText(
        item.effectiveEndAt ??
          item.endAt ??
          item.expiresAt ??
          item.detectedAt ??
          item.startAt,
        "未設定",
      ),
    }));
};
