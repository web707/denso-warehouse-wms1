export interface Orientation {
  ox: number; // extent along container length (x-axis / wall thickness)
  oy: number; // extent along container width (y-axis / column pitch)
  rotated: boolean;
}

// Only a 90-degree yaw (swap length/width) is allowed — height never
// rotates. Picks whichever orientation fits more columns across the
// container's width; ties prefer the non-rotated orientation.
export function chooseOrientation(
  cartonLengthMm: number,
  cartonWidthMm: number,
  containerWidthMm: number,
): Orientation {
  const straightCols = Math.floor(containerWidthMm / cartonWidthMm);
  const rotatedCols = Math.floor(containerWidthMm / cartonLengthMm);

  if (rotatedCols > straightCols) {
    return { ox: cartonWidthMm, oy: cartonLengthMm, rotated: true };
  }
  return { ox: cartonLengthMm, oy: cartonWidthMm, rotated: false };
}
