export type UiEventType =
  | "PAGE_VIEW"
  | "NAV_CLICK"
  | "CARD_CLICK"
  | "VIEW_ALL_CLICK"
  | "ROLE_SWITCH_CLICK"
  | "FACILITY_SWITCH"
  | "SEARCH_SUBMIT"
  | "MODULE_HEALTH_VIEW"
  | "TRAINING_VIEW"
  | "CHART_DRILLDOWN"
  | "FILTER_CHANGE"
  | "TOGGLE_PANEL"
  | "ACTION_SUBMIT";

export interface UiEventDto {
  eventType: UiEventType;
  page: string;
  componentId?: string;
  actionType?: string;
  payload?: unknown;
  correlationId?: string;
  occurredAt?: string;
}

export interface ClientErrorDto {
  message: string;
  page?: string;
  stack?: string;
  componentId?: string;
  correlationId?: string;
  occurredAt?: string;
}
