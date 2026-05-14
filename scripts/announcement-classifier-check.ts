import assert from "node:assert/strict";
import {
  AnnouncementMessageBuffer,
  classifyAnnouncementMessage,
  sanitizeAnnouncementCandidatesPayload,
  validateCandidateTitleSummary,
} from "../shared/announcement-classifier";

const excludedCases = [
  ["在跟他家洽後續", "work_status_complaint"],
  ["昨天新北訊息還是沒有看完....", "work_status_complaint"],
  ["就通知球有八", "personal_task_dispatch"],
  ["2.", "fragment_continuation"],
  ["https://chat.line.biz/abc", "url_only"],
  ["@琳琳Cheng❤️❤️ 通知球友", "personal_task_dispatch"],
  ["@All 小台高壓槍在新北嗎", "group_query_not_announcement"],
] as const;

for (const [content, reason] of excludedCases) {
  const result = classifyAnnouncementMessage(content);
  assert.equal(result.decision, "not_announcement", `${content} should not enter candidates`);
  assert.equal(result.excludeReason, reason, `${content} exclude reason changed`);
}

const closure = classifyAnnouncementMessage("5/18號開始 四樓球場全面暫停 油漆工程 30天 地板工程 45天 預計8-9月才能開放", 0.9);
assert.equal(closure.decision, "candidate");
assert.equal(closure.priority, "must_read");
assert(closure.signals.includes("OPERATION_CLOSURE"));
assert(closure.signals.includes("CONSTRUCTION_GUIDANCE"));

const lowConfidence = classifyAnnouncementMessage("5/18號開始 四樓球場全面暫停 油漆工程 30天 地板工程 45天", 0.5);
assert.equal(lowConfidence.priority, "normal", "low confidence must downgrade direct must-read one level");

const validation = validateCandidateTitleSummary("@All 小台高壓槍在新北嗎", "@All 小台高壓槍在新北嗎", "@All 小台高壓槍在新北嗎");
assert.notEqual(validation.title, validation.summary);
assert(validation.title.length <= validation.summary.length);
assert(validation.anomaly);

const buffer = new AnnouncementMessageBuffer();
assert.equal(buffer.ingest({ messageId: "m1", senderId: "u1", groupId: "g1", content: "2.", sentAt: "2026-05-14T01:10:00.000Z" }).length, 0);
assert.equal(buffer.ingest({ messageId: "m2", senderId: "u1", groupId: "g1", content: "5/17、5/31 幫我把二樓 16-18 空下來", sentAt: "2026-05-14T01:11:00.000Z" }).length, 0);
assert.equal(buffer.ingest({ messageId: "m3", senderId: "u1", groupId: "g1", content: "就通知球有八", sentAt: "2026-05-14T01:12:00.000Z" }).length, 0);
const merged = buffer.flush();
assert.equal(merged.length, 1);
assert.deepEqual(merged[0]?.sourceMessageIds, ["m1", "m2", "m3"]);
assert(merged[0]?.content.includes("\n\n5/17、5/31"));

const payload = sanitizeAnnouncementCandidatesPayload({
  total: 3,
  candidates: [
    { id: 1, title: "在跟他家洽後續", summary: "在跟他家洽後續", originalText: "在跟他家洽後續" },
    { id: 2, title: "四樓球場暫停", summary: "5/18號開始 四樓球場全面暫停 油漆工程 30天 地板工程 45天", originalText: "5/18號開始 四樓球場全面暫停 油漆工程 30天 地板工程 45天", confidence: 0.9 },
    { id: 3, title: "@All 小台高壓槍在新北嗎", summary: "@All 小台高壓槍在新北嗎", originalText: "@All 小台高壓槍在新北嗎" },
  ],
}) as { candidates: Array<{ id: number; localClassifier?: { priority: string } }>; filteredByLocalClassifier: number };
assert.equal(payload.filteredByLocalClassifier, 2);
assert.equal(payload.candidates.length, 1);
assert.equal(payload.candidates[0]?.id, 2);
assert.equal(payload.candidates[0]?.localClassifier?.priority, "must_read");

console.log("announcement-classifier-check passed");
