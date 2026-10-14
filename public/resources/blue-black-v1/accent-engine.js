export const ORIGINAL_ACCENT = '#2f5bff';
export const ACCENT_PRESETS = [
  {color: ORIGINAL_ACCENT, label: 'Cobalt'}, {color: '#35664d', label: 'Forest'},
  {color: '#bd365b', label: 'Berry'}, {color: '#a65a16', label: 'Ochre'},
  {color: '#7652b5', label: 'Violet'}, {color: '#147a83', label: 'Teal'},
  {color: '#53565c', label: 'Graphite'},
];
/** @param {string} value */
export function normalizeAccent(value) {
  if (!/^#[\da-f]{6}$/i.test(value)) throw new Error('Enter a six-digit HEX color, such as #2F5BFF.');
  return value.toLowerCase();
}
/** Replace only the original blue pigment, including its antialiased mixtures.
 * @param {Uint8Array | Uint8ClampedArray} pixels @param {string} color */
export function recolorAccentPixels(pixels, color) {
  const target = normalizeAccent(color);
  if (target === ORIGINAL_ACCENT) return pixels;
  const rgb = [1, 3, 5].map(i => parseInt(target.slice(i, i + 2), 16));
  const delta = [rgb[0] - 47, rgb[1] - 91, rgb[2] - 255];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (!pixels[i + 3] || b - r <= 12 || b - g <= 8) continue;
    const huePosition = (g - r) / (b - r);
    if (huePosition < -.15 || huePosition > .65) continue;
    const weight = Math.min(1, (b - r) / 208);
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(Math.max(0, Math.min(255, pixels[i + c] + delta[c] * weight)));
  }
  return pixels;
}
