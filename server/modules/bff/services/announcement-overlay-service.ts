import type { AnnouncementSummary } from "@shared/domain/workbench";
import { storage } from "../../../storage";

import { announcementSortTime } from "./announcement-summary-service";

export const applyAnnouncementOverlays = async (
  items: AnnouncementSummary[],
): Promise<AnnouncementSummary[]> => {
  if (items.length === 0) return items;
  const overlays = await storage
    .getAnnouncementOverlays(items.map((item) => item.id))
    .catch(() => new Map());
  if (overlays.size === 0) return items;
  const nowMs = Date.now();
  const augmented: AnnouncementSummary[] = [];
  for (const item of items) {
    const overlay = overlays.get(item.id);
    if (overlay?.isHidden) continue;
    if (!overlay) {
      augmented.push(item);
      continue;
    }
    const pinnedUntilMs = overlay.pinnedUntil
      ? overlay.pinnedUntil.getTime()
      : 0;
    const isCurrentlyPinned = pinnedUntilMs > nowMs;
    augmented.push({
      ...item,
      isPinned: isCurrentlyPinned || item.isPinned,
      overlayPinnedUntil: overlay.pinnedUntil
        ? overlay.pinnedUntil.toISOString()
        : null,
      overlayNote: overlay.note ?? null,
      overlayHidden: false,
      overlayLastModifiedByName: overlay.lastModifiedByName,
      overlayLastModifiedAt: overlay.updatedAt
        ? overlay.updatedAt.toISOString()
        : null,
    });
  }
  augmented.sort((a, b) => {
    const aPinUntil = a.overlayPinnedUntil
      ? Date.parse(a.overlayPinnedUntil)
      : 0;
    const bPinUntil = b.overlayPinnedUntil
      ? Date.parse(b.overlayPinnedUntil)
      : 0;
    const aActive = aPinUntil > nowMs ? 1 : 0;
    const bActive = bPinUntil > nowMs ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    if (aActive && bActive && bPinUntil !== aPinUntil)
      return bPinUntil - aPinUntil;
    const pinned = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinned !== 0) return pinned;
    return announcementSortTime(b) - announcementSortTime(a);
  });
  return augmented;
};
