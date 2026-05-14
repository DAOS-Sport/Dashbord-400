export type AnnouncementExcludeReason =
  | "personal_task_dispatch"
  | "fragment_continuation"
  | "url_only"
  | "work_status_complaint"
  | "group_query_not_announcement";

export type AnnouncementMustReadSignal =
  | "OPERATION_CLOSURE"
  | "SOP_CHANGE"
  | "SYSTEM_MAINTENANCE"
  | "CONSTRUCTION_GUIDANCE"
  | "IMMEDIATE_EFFECT"
  | "DEADLINE";

export interface AnnouncementClassification {
  decision: "not_announcement" | "candidate";
  priority: "must_read" | "normal";
  excludeReason?: AnnouncementExcludeReason;
  signals: AnnouncementMustReadSignal[];
  confidenceAdjustment: 0 | -1;
  ruleMatched: boolean;
}

export interface BufferedAnnouncementMessage {
  messageId: string;
  senderId: string;
  groupId: string;
  content: string;
  sentAt: string | Date;
}

export interface MergedAnnouncementMessage extends BufferedAnnouncementMessage {
  sourceMessageIds: string[];
}

export interface CandidateTitleSummaryValidation {
  title: string;
  summary: string;
  anomaly?: {
    reason: "title_equals_summary" | "title_longer_than_summary";
    originalTitle: string;
    originalSummary: string;
  };
}

const urlPattern = /https?:\/\/\S+/gi;
const concreteDatePattern = /(?:\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}[日號])/;
const periodPattern = /(?:\d+\s*[天日]|(?:\d+\s*)?月)/;
const allMentionPattern = /^@(All|所有人|全體|全館)\b/i;
const anyMentionPattern = /^@\S+/;
const personalDispatchVerbPattern = /(?:通知|記得|幫我|去|要|處理)/;
const fragmentPattern = /^[\d一二三四五六七八九十]+[\.、)]\s*$/;
const statusComplaintPattern = /(?:還是?沒有看完|還沒看完|在跟.+洽|等回覆|再說|待處理|忘記)/;

const countMeaningfulChars = (value: string) => value.replace(urlPattern, "").replace(/\s+/g, "").length;

const hasQuestionCue = (value: string) => /[？?嗎呢]/.test(value);
const hasTimeCue = (value: string) => concreteDatePattern.test(value) || /(?:今天|明天|昨天|即日起|今晚|本週|下週|\d{1,2}:\d{2})/.test(value);
const hasAudienceCue = (value: string) => /(?:@All|@所有人|全體|全公司|各館|全館|同仁|櫃台|救生|會員|球友)/i.test(value);
const hasActionCue = (value: string) => /(?:開始|暫停|開放|通知|公告|執行|調整|變更|維護|施工|完成|確認)/.test(value);

export const detectAnnouncementSignals = (content: string): AnnouncementMustReadSignal[] => {
  const signals = new Set<AnnouncementMustReadSignal>();
  if (/(?:即日起|今晚|本週|今天|明天|開始|起)/.test(content)) signals.add("IMMEDIATE_EFFECT");
  if (/(?:截止|期限|前|到期|預計|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}[日號])/.test(content)) signals.add("DEADLINE");
  if (/(?:暫停|停用|停開|關閉|不開放|休館|封閉|停課|全面暫停)/.test(content)) signals.add("OPERATION_CLOSURE");
  if (/(?:SOP|流程|規定|規範|改成|改為|異動|變更)/i.test(content)) signals.add("SOP_CHANGE");
  if (/(?:系統|後台|POS|會員系統|預約系統).*(?:維護|更新|停機)|(?:維護|更新|停機).*(?:系統|後台|POS|會員系統|預約系統)/.test(content)) signals.add("SYSTEM_MAINTENANCE");
  if (/(?:施工|工程|油漆|地板|整修|高壓槍)/.test(content)) signals.add("CONSTRUCTION_GUIDANCE");
  return Array.from(signals);
};

export const classifyAnnouncementMessage = (content: string, confidence?: number): AnnouncementClassification => {
  const normalized = content.trim();
  const meaningfulLength = countMeaningfulChars(normalized);
  const withoutUrls = normalized.replace(urlPattern, "").trim();

  if (anyMentionPattern.test(normalized) && !allMentionPattern.test(normalized) && personalDispatchVerbPattern.test(normalized)) {
    return { decision: "not_announcement", priority: "normal", excludeReason: "personal_task_dispatch", signals: [], confidenceAdjustment: 0, ruleMatched: true };
  }
  if (meaningfulLength < 15 && /(?:通知|記得|幫我|去|要|處理)/.test(normalized) && !hasTimeCue(normalized) && !hasAudienceCue(normalized)) {
    return { decision: "not_announcement", priority: "normal", excludeReason: "personal_task_dispatch", signals: [], confidenceAdjustment: 0, ruleMatched: true };
  }
  if (fragmentPattern.test(normalized) && meaningfulLength < 10) {
    return { decision: "not_announcement", priority: "normal", excludeReason: "fragment_continuation", signals: [], confidenceAdjustment: 0, ruleMatched: true };
  }
  if (Boolean(normalized.match(urlPattern)) && countMeaningfulChars(withoutUrls) < 5) {
    return { decision: "not_announcement", priority: "normal", excludeReason: "url_only", signals: [], confidenceAdjustment: 0, ruleMatched: true };
  }
  if (statusComplaintPattern.test(normalized) && meaningfulLength < 25 && !(hasTimeCue(normalized) && hasAudienceCue(normalized) && hasActionCue(normalized))) {
    return { decision: "not_announcement", priority: "normal", excludeReason: "work_status_complaint", signals: [], confidenceAdjustment: 0, ruleMatched: true };
  }
  if (allMentionPattern.test(normalized) && hasQuestionCue(normalized) && meaningfulLength < 20) {
    return { decision: "not_announcement", priority: "normal", excludeReason: "group_query_not_announcement", signals: [], confidenceAdjustment: 0, ruleMatched: true };
  }

  const signals = detectAnnouncementSignals(normalized);
  const hasConcreteDate = concreteDatePattern.test(normalized);
  const hasTargetAudience = /(?:各館|全體|全公司|全館)/.test(normalized);
  const hasShortTimeWindow = /(?:即日起|今晚|本週)/.test(normalized);
  const hasConstructionPeriod = signals.includes("CONSTRUCTION_GUIDANCE") && periodPattern.test(normalized);
  const directMustRead =
    (signals.includes("OPERATION_CLOSURE") && hasConcreteDate) ||
    (signals.includes("SOP_CHANGE") && hasTargetAudience) ||
    (signals.includes("SYSTEM_MAINTENANCE") && hasShortTimeWindow) ||
    hasConstructionPeriod ||
    (hasConcreteDate && (signals.includes("OPERATION_CLOSURE") || signals.includes("CONSTRUCTION_GUIDANCE")));
  const confidenceAdjustment = typeof confidence === "number" && Number.isFinite(confidence) && confidence < 0.6 ? -1 : 0;

  return {
    decision: "candidate",
    priority: directMustRead && confidenceAdjustment === 0 ? "must_read" : "normal",
    signals,
    confidenceAdjustment,
    ruleMatched: directMustRead,
  };
};

const truncate = (value: string, max: number) => {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? compact.slice(0, max) : compact;
};

const fallbackTitleFromContent = (content: string) => {
  const compact = content.replace(urlPattern, "").replace(/\s+/g, " ").trim();
  const date = compact.match(concreteDatePattern)?.[0];
  const target = compact.match(/(?:四樓球場|二樓|各館|全體|全公司|全館|會員系統|預約系統|櫃台|球場)/)?.[0];
  const action = compact.match(/(?:暫停|停用|維護|施工|油漆|地板|通知|調整|開放|改為|變更)/)?.[0];
  const parts = [date, target, action].filter(Boolean).join(" ");
  return truncate(parts || compact.split(/[，,。.\n]/)[0] || "公告候選", 20);
};

export const validateCandidateTitleSummary = (
  title: string | null | undefined,
  summary: string | null | undefined,
  originalText: string | null | undefined,
): CandidateTitleSummaryValidation => {
  const safeSummary = truncate(summary || originalText || title || "未提供摘要", 80);
  const safeTitle = truncate(title || fallbackTitleFromContent(originalText || safeSummary), 20);
  const same = safeTitle.trim() === safeSummary.trim();
  const titleLonger = safeTitle.length > safeSummary.length;
  if (!same && !titleLonger) return { title: safeTitle, summary: safeSummary };
  const fallbackSummary = truncate(originalText || safeSummary, 80);
  const derivedTitle = fallbackTitleFromContent(originalText || fallbackSummary);
  const fallbackTitle = derivedTitle === fallbackSummary ? truncate(derivedTitle.replace(/^@(?:All|所有人)\s*/i, "") || "公告候選", 12) : derivedTitle;
  return {
    title: fallbackTitle,
    summary: fallbackSummary,
    anomaly: {
      reason: same ? "title_equals_summary" : "title_longer_than_summary",
      originalTitle: safeTitle,
      originalSummary: safeSummary,
    },
  };
};

const getCandidateText = (candidate: Record<string, unknown>) =>
  String(candidate.originalText ?? candidate.sourceMessageText ?? candidate.text ?? candidate.summary ?? candidate.title ?? "");

const getCandidateConfidence = (candidate: Record<string, unknown>) => {
  const extractedConfidence = candidate.extractedJson && typeof candidate.extractedJson === "object"
    ? (candidate.extractedJson as Record<string, unknown>).confidence
    : undefined;
  const confidence = Number(candidate.confidence ?? extractedConfidence);
  return Number.isFinite(confidence) ? confidence : undefined;
};

export const sanitizeAnnouncementCandidate = <T extends Record<string, unknown>>(candidate: T): (T & { localClassifier?: AnnouncementClassification }) | null => {
  const text = getCandidateText(candidate);
  const classification = classifyAnnouncementMessage(text, getCandidateConfidence(candidate));
  if (classification.decision === "not_announcement") return null;
  const titleSummary = validateCandidateTitleSummary(String(candidate.title ?? ""), String(candidate.summary ?? ""), text);
  return {
    ...candidate,
    title: titleSummary.title,
    summary: titleSummary.summary,
    localClassifier: classification,
    extractedJson: {
      ...((candidate.extractedJson && typeof candidate.extractedJson === "object") ? candidate.extractedJson as Record<string, unknown> : {}),
      localClassifier: classification,
      titleSummaryAnomaly: titleSummary.anomaly,
    },
  };
};

export const sanitizeAnnouncementCandidatesPayload = <T extends Record<string, unknown>>(payload: unknown) => {
  if (!payload || typeof payload !== "object") return payload;
  const source = payload as Record<string, unknown>;
  const itemsKey = Array.isArray(source.candidates) ? "candidates" : Array.isArray(source.items) ? "items" : null;
  if (!itemsKey) return payload;
  const originalItems = source[itemsKey] as T[];
  const sanitized = originalItems.map((item) => sanitizeAnnouncementCandidate(item)).filter((item): item is T & { localClassifier: AnnouncementClassification } => Boolean(item));
  return {
    ...source,
    [itemsKey]: sanitized,
    ...(itemsKey === "candidates" ? { items: sanitized } : { candidates: sanitized }),
    total: typeof source.total === "number" ? Math.min(source.total, sanitized.length) : sanitized.length,
    filteredByLocalClassifier: originalItems.length - sanitized.length,
  };
};

export class AnnouncementMessageBuffer {
  private pending: MergedAnnouncementMessage | null = null;
  constructor(private readonly windowMs = 5 * 60 * 1000) {}

  ingest(message: BufferedAnnouncementMessage): MergedAnnouncementMessage[] {
    const flushed: MergedAnnouncementMessage[] = [];
    const sentAt = new Date(message.sentAt);
    const currentAt = Number.isNaN(sentAt.getTime()) ? new Date() : sentAt;
    if (!this.pending) {
      this.pending = { ...message, sentAt: currentAt.toISOString(), sourceMessageIds: [message.messageId] };
      return flushed;
    }
    const pendingAt = new Date(this.pending.sentAt);
    const sameActor = this.pending.senderId === message.senderId && this.pending.groupId === message.groupId;
    const withinWindow = currentAt.getTime() - pendingAt.getTime() <= this.windowMs;
    const switchesTarget = /^@\S+/.test(message.content.trim());
    if (!sameActor || !withinWindow || switchesTarget) {
      flushed.push(this.pending);
      this.pending = { ...message, sentAt: currentAt.toISOString(), sourceMessageIds: [message.messageId] };
      return flushed;
    }
    this.pending = {
      ...this.pending,
      messageId: message.messageId,
      content: `${this.pending.content}\n\n${message.content}`,
      sentAt: currentAt.toISOString(),
      sourceMessageIds: [...this.pending.sourceMessageIds, message.messageId],
    };
    return flushed;
  }

  flush(): MergedAnnouncementMessage[] {
    if (!this.pending) return [];
    const item = this.pending;
    this.pending = null;
    return [item];
  }
}
