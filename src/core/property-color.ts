/** Canonical document hex, accepting pasted values with or without #. */
export function propertyColor(raw: string): string | undefined {
  if (raw.trim().toLowerCase() === 'transparent') return 'transparent';
  let hex = raw.trim().replace(/^#/, '').toLowerCase();
  if (!/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(hex)) return;
  if (hex.length <= 4) hex = hex.split('').map(c => c + c).join('');
  return '#' + hex;
}

/** Native color pickers edit RGB only; keep the authored alpha channel. */
export function pickedPropertyColor(rgb: string, current: string, mixed = false): string {
  const color = propertyColor(current);
  return rgb.toLowerCase() + (!mixed && color?.length === 9 ? color.slice(7) : '');
}

export function nativePropertyColor(value: string): string {
  const color = propertyColor(value);
  return color && color !== 'transparent' ? color.slice(0, 7) : '#ffffff';
}
