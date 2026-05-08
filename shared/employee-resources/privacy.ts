type EmployeeResourcePrivacyRow = {
  category: string;
  createdByEmployeeNumber: string | null;
};

export const isPersonalStickyNote = (row: EmployeeResourcePrivacyRow) => row.category === "sticky_note";

export const canReadEmployeeResource = (row: EmployeeResourcePrivacyRow, ownerEmployeeNumber?: string | null) => {
  if (!isPersonalStickyNote(row)) return true;
  return Boolean(ownerEmployeeNumber && row.createdByEmployeeNumber === ownerEmployeeNumber);
};

export const canMutateEmployeeResource = (
  row: EmployeeResourcePrivacyRow,
  actor: { employeeNumber: string; isSupervisor?: boolean },
) => {
  if (isPersonalStickyNote(row)) return row.createdByEmployeeNumber === actor.employeeNumber;
  return row.createdByEmployeeNumber === actor.employeeNumber || actor.isSupervisor === true;
};

export const filterEmployeeResourcesForCaller = <T extends EmployeeResourcePrivacyRow>(
  rows: T[],
  ownerEmployeeNumber?: string | null,
) => rows.filter((row) => canReadEmployeeResource(row, ownerEmployeeNumber));
