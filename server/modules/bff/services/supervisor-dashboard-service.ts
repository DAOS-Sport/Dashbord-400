import {
  facilityLabel,
  findFacilityLineGroup,
} from "@shared/domain/facilities";
import type {
  HandoverSummary,
  StaffMemberSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import type { OperationalHandover, Task } from "@shared/schema";
import type { AppContainer } from "../../../app/container";
import { sourceUnavailable } from "../../../shared/integrations/source-status";

export const taskStatusToSummaryStatus = (
  status: string,
): TaskSummary["status"] =>
  status === "done"
    ? "done"
    : status === "in_progress"
      ? "in_progress"
      : "pending";

export const mapTaskSummary = (task: Task): TaskSummary => ({
  id: String(task.id),
  title: task.title,
  content: task.content,
  status: taskStatusToSummaryStatus(task.status),
  priority:
    task.priority === "high" || task.priority === "low"
      ? task.priority
      : "normal",
  dueLabel: task.dueAt
    ? new Date(task.dueAt).toLocaleString("zh-TW")
    : undefined,
  dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : null,
  createdByName: task.createdByName,
  assignedToName: task.assignedToName,
  source:
    task.source === "supervisor" || task.source === "system"
      ? task.source
      : "employee",
});

export const mapOperationalHandoverSummary = (
  handover: OperationalHandover,
): HandoverSummary => ({
  id: String(handover.id),
  title: handover.title,
  content: handover.content,
  authorName: handover.createdByName || "主管",
  status:
    handover.status === "done"
      ? "completed"
      : handover.dueAt && handover.dueAt.getTime() < Date.now()
        ? "expired"
        : "pending",
  facilityKey: handover.facilityKey,
  targetDate: handover.targetDate,
  targetShiftLabel: handover.targetShiftLabel,
  dueLabel: handover.dueAt
    ? new Date(handover.dueAt).toLocaleString("zh-TW")
    : `${handover.targetDate} ${handover.targetShiftLabel}`,
  reportNote: handover.reportNote,
  assigneeName: handover.assigneeName,
});

export const toTimeRange = (startsAt?: string, endsAt?: string) =>
  startsAt && endsAt
    ? `${new Date(startsAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} - ${new Date(endsAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
    : undefined;

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const openOperationalHandovers = (items: OperationalHandover[]) =>
  items.filter(
    (handover) => handover.status !== "done" && handover.status !== "cancelled",
  );

export const openTasks = (items: Task[]) =>
  items.filter((task) => task.status !== "done" && task.status !== "cancelled");

export const buildStaffingSummary = async (
  container: AppContainer,
  facilityKeys: string[],
) => {
  const now = Date.now();
  const emptyShifts = sourceUnavailable<
    NonNullable<
      Awaited<
        ReturnType<AppContainer["integrations"]["schedule"]["listTodayShifts"]>
      >["data"]
    >
  >(
    "smart-schedule",
    "Schedule shifts timed out for supervisor dashboard.",
    "SCHEDULE_TIMEOUT",
  ) as Awaited<
    ReturnType<AppContainer["integrations"]["schedule"]["listTodayShifts"]>
  >;
  const employeesSlot = container.services.ragicCache.getEmployees();
  const shiftResults = await Promise.all(
    facilityKeys.map((facilityKey) =>
      withTimeout(
        container.integrations.schedule.listTodayShifts(facilityKey),
        1500,
        emptyShifts,
      ),
    ),
  );
  const employees = employeesSlot.data ?? [];
  const activeEmployees: StaffMemberSummary[] = employees
    .filter(
      (employee) =>
        facilityKeys.length === 0 ||
        employee.grantedFacilities.some((key) => facilityKeys.includes(key)),
    )
    .map((employee) => ({
      employeeNumber: employee.employeeNumber,
      name: employee.displayName,
      facilityKey: employee.grantedFacilities[0],
      facilityName: employee.grantedFacilities[0]
        ? facilityLabel(employee.grantedFacilities[0])
        : employee.department,
      title: employee.title,
      department: employee.department,
      status: "off" as const,
    }));

  const shifts = shiftResults.flatMap((result) => result.data ?? []);
  const currentOnDuty: StaffMemberSummary[] = shifts
    .filter(
      (shift) =>
        shift.startsAt &&
        shift.endsAt &&
        Date.parse(shift.startsAt) <= now &&
        Date.parse(shift.endsAt) >= now,
    )
    .map((shift) => ({
      employeeNumber: shift.employeeNumber,
      name: shift.employeeName || shift.label,
      facilityKey: shift.facilityKey,
      facilityName: shift.venueName || facilityLabel(shift.facilityKey),
      shiftLabel: shift.kind || "當班",
      timeRange: toTimeRange(shift.startsAt, shift.endsAt),
      status: "active" as const,
    }));
  const nextOnDuty: StaffMemberSummary[] = shifts
    .filter((shift) => shift.startsAt && Date.parse(shift.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 20)
    .map((shift) => ({
      employeeNumber: shift.employeeNumber,
      name: shift.employeeName || shift.label,
      facilityKey: shift.facilityKey,
      facilityName: shift.venueName || facilityLabel(shift.facilityKey),
      shiftLabel: shift.kind || "下一班",
      timeRange: toTimeRange(shift.startsAt, shift.endsAt),
      status: "upcoming" as const,
    }));

  return {
    active: activeEmployees.length,
    total: activeEmployees.length,
    onShift: currentOnDuty.length,
    absent: Math.max(activeEmployees.length - currentOnDuty.length, 0),
    activeEmployees,
    currentOnDuty,
    nextOnDuty,
    byFacility: facilityKeys.map((facilityKey) => ({
      facilityKey,
      facilityName: facilityLabel(facilityKey),
      active: activeEmployees.filter(
        (employee) =>
          employee.facilityKey === facilityKey ||
          employee.department?.includes(
            findFacilityLineGroup(facilityKey)?.ragicDepartmentAliases[0] ??
              facilityKey,
          ),
      ).length,
      onShift: currentOnDuty.filter(
        (employee) => employee.facilityKey === facilityKey,
      ).length,
      next: nextOnDuty.filter(
        (employee) => employee.facilityKey === facilityKey,
      ).length,
    })),
  };
};
