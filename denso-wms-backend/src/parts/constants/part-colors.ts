// Same 12-color palette as the current frontend's PART_COLORS (seedData.js)
// so imported/created parts render consistently once the frontend is rewired.
export const PART_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#3b82f6',
  '#a855f7',
];

export function nextPartColor(existingCount: number): string {
  return PART_COLORS[existingCount % PART_COLORS.length];
}
