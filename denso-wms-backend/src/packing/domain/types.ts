export interface ContainerDims {
  internalLengthMm: number;
  internalWidthMm: number;
  internalHeightMm: number;
  doorHeightMm: number | null;
  maxCbm: number;
  maxPayloadKg: number;
}

export interface SolverPart {
  id: string;
  partName: string;
  masterPo: string;
  divisionSortOrder: number;
  dcPrefixSortOrder: number;
  dcPrefixCode: string;
  divisionCode: string;
  cartonCount: number;
  cartonLengthMm: number;
  cartonWidthMm: number;
  cartonHeightMm: number;
  totalWeightKg: number;
  preferredRackSlot?: number | null;
  colorHex: string;
}

export interface PlacementDraft {
  partId: string;
  blockIndex: number;
  cartonSeq: number;
  wallIndex: number; // global wall/"Row" index within the container
  layer: number;
  column: number;
  xMm: number;
  yMm: number;
  zMm: number;
  dxMm: number;
  dyMm: number;
  dzMm: number;
  rotated: boolean;
  colorHex: string;
}

export interface BlockSummary {
  partId: string;
  partName: string;
  divisionCode: string;
  dcPrefixCode: string;
  masterPo: string;
  colorHex: string;
  cartonCount: number;
  placedCartonCount: number;
  wallStart: number;
  wallEnd: number;
}

export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  code: string;
  severity: ViolationSeverity;
  message: string;
  partId?: string;
}

export interface SolveResult {
  placements: PlacementDraft[];
  blocks: BlockSummary[];
  violations: Violation[];
  wallCount: number;
  layerCount: number;
  cbmUsed: number;
  weightUsedKg: number;
}

export interface ContainerRecommendationCandidate {
  containerTypeId: string;
  code: string;
  label: string;
  maxCbm: number;
  maxPayloadKg: number;
  cbmUsed: number;
  weightUsedKg: number;
  cartonCount: number;
  placedCartonCount: number;
  fits: boolean;
  wallCount: number;
  layerCount: number;
  errorCount: number;
}

export interface ContainerRecommendation {
  orderId: string;
  cartonCount: number;
  candidates: ContainerRecommendationCandidate[];
  recommendedContainerTypeId: string | null;
  fullyFits: boolean;
}
