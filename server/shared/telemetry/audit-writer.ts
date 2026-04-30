export interface AuditEventInput {
  actorId?: string;
  role?: string;
  facilityKey?: string;
  action: string;
  resource: string;
  resourceId?: string;
  payload?: unknown;
  correlationId?: string;
  resultStatus?: "success" | "failure";
}
