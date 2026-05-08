import { env } from "../../shared/config/env";

export interface LineMessageDto {
  id: string;
  messageId: string;
  timestamp: string;
  sourceType: "user" | "group" | "room";
  groupId: string | null;
  roomId: string | null;
  userId: string;
  displayName: string;
  type: "text" | "image" | "video" | "sticker" | "file" | "audio" | "location";
  text: string | null;
  createdAt: string;
}

export interface LineMessagesResponse {
  messages: LineMessageDto[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  nextSince: string | null;
  count: number;
}

interface CacheEntry {
  fetchedAt: number;
  data: LineMessagesResponse;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export async function fetchLineMessages(params: {
  groupId: string;
  hours?: number;
  type?: "text";
  limit?: number;
}): Promise<LineMessagesResponse> {
  if (!env.lineBotAdminToken) {
    throw new Error("LINE_BOT_ADMIN_TOKEN not configured");
  }

  const url = new URL("/api/admin/messages", env.lineBotBaseUrl);
  url.searchParams.set("groupId", params.groupId);
  url.searchParams.set("type", params.type ?? "text");
  url.searchParams.set("sourceType", "group");
  url.searchParams.set("limit", String(params.limit ?? 30));
  if (params.hours) {
    url.searchParams.set("start", new Date(Date.now() - params.hours * 3_600_000).toISOString());
  }

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.lineBotAdminToken}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }

  const data = await response.json() as LineMessagesResponse;
  cache.set(cacheKey, { fetchedAt: Date.now(), data });
  return data;
}

export function clearLineMessagesCache() {
  cache.clear();
}
