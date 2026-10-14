export const SNAP_INCREMENT = 4;

/** Step to the next multiple in the requested direction, including negative values. */
export function nextIncrement(value: number, direction: 1 | -1, increment = SNAP_INCREMENT): number {
  const units = value / increment;
  return (direction === 1 ? Math.floor(units + 1e-9) + 1 : Math.ceil(units - 1e-9) - 1) * increment;
}
