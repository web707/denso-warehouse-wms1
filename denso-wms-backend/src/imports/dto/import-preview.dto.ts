export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportPreviewOrder {
  orderNumber: string;
  division: string;
  destination: string;
  parts: {
    partName: string;
    productCode: string | null;
    divisionCode: string;
    dcPrefix: string;
    masterPo: string;
    quantityPcs: number;
    totalWeightKg: number;
    cartonCount: number;
    cartonLengthMm: number;
    cartonWidthMm: number;
    cartonHeightMm: number;
  }[];
}

export interface ImportResult {
  dryRun: boolean;
  orders: ImportPreviewOrder[];
  orderCount: number;
  partCount: number;
  errors: ImportRowError[];
  /** Raw container hint text parsed from the file header (e.g. "One - 20' container"). */
  containerHint?: string;
  createdOrderIds?: string[];
  // Only set on a real commit (dryRun: false). insertedPartCount can be
  // lower than partCount when duplicatePartsSkipped > 0 — re-importing the
  // same file into an order that already has those exact PART rows skips
  // them instead of inserting a second copy.
  insertedPartCount?: number;
  duplicatePartsSkipped?: number;
  /** Rack that received newly inserted PARTs when importing directly from a rack screen. */
  targetRackId?: string;
}

