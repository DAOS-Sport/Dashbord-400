type EmployeeResourcePrivacyRow = {
  category: string;
  createdByEmployeeNumber: string | null;
};

export const canReadEmployeeResource = (_row: EmployeeResourcePrivacyRow, _ownerEmployeeNumber?: string | null) => true;

export const canMutateEmployeeResource = (
  row: EmployeeResourcePrivacyRow,
  actor: { employeeNumber: string; isSupervisor?: boolean },
) => {
  return row.createdByEmployeeNumber === actor.employeeNumber || actor.isSupervisor === true;
};

export const filterEmployeeResourcesForCaller = <T extends EmployeeResourcePrivacyRow>(
  rows: T[],
  ownerEmployeeNumber?: string | null,
) => rows.filter((row) => canReadEmployeeResource(row, ownerEmployeeNumber));
