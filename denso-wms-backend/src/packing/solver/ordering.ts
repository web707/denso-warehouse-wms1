import { SolverPart } from '../domain/types';

// Division.sortOrder -> DcPrefix.sortOrder -> Master PO (ascending, numeric).
// This is the ONE comparator every placement decision must go through —
// it is what "Division -> DC Prefix -> Master PO" ordering means in code.
export function compareLoadingOrder(a: SolverPart, b: SolverPart): number {
  if (a.divisionSortOrder !== b.divisionSortOrder) {
    return a.divisionSortOrder - b.divisionSortOrder;
  }
  if (a.dcPrefixSortOrder !== b.dcPrefixSortOrder) {
    return a.dcPrefixSortOrder - b.dcPrefixSortOrder;
  }
  const aPo = Number(a.masterPo);
  const bPo = Number(b.masterPo);
  if (Number.isFinite(aPo) && Number.isFinite(bPo) && aPo !== bPo) {
    return aPo - bPo;
  }
  return a.masterPo.localeCompare(b.masterPo);
}

export function sortPartsForLoading(parts: SolverPart[]): SolverPart[] {
  return [...parts].sort(compareLoadingOrder);
}
