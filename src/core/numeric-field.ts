export type NumberPreset = number | {value: number; label: string};

export type ScrubOptions = {step: number; fine?: boolean; coarse?: boolean; fractional?: boolean; increment?: number; stepBase?: number; min?: number; max?: number};
const scrubAmount = (options: ScrubOptions) => options.step * (options.coarse ? 10 : options.fine && options.fractional ? .1 : 1);

/** Relative to the last pointer sample, so changing precision never jumps. */
export function scrubNumber(current: number, delta: number, options: ScrubOptions) {
  const amount = scrubAmount(options);
  const raw = current + delta * amount;
  const quantum = options.coarse && options.increment ? options.increment : amount;
  const origin = options.coarse && options.increment ? 0 : options.stepBase ?? 0;
  const next = origin + Math.round((raw - origin) / quantum) * quantum;
  return Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity, Number(next.toFixed(10))));
}

/** A short capture band and a wider release band make common values feel magnetic.
 * Delta uses half the pointer distance: 3 px capture, 6 px release, capped for dense presets.
 * Read the continuous pointer value so normal step rounding does not enlarge the magnet.
 */
export function snappedScrubNumber(current: number, delta: number, options: ScrubOptions, targets: readonly number[], held?: number): {value: number; snapped?: number} {
  const value = scrubNumber(current, delta, options);
  if (options.fine) return {value};
  const amount = scrubAmount(options), raw = Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity, current + delta * amount));
  const candidates = [...new Set(targets)].filter(target => Number.isFinite(target) && target > (options.min ?? -Infinity) && target < (options.max ?? Infinity) && (!options.coarse || !options.increment || Math.abs(target / options.increment - Math.round(target / options.increment)) < 1e-7));
  const band = (target: number, pixels: number, fraction: number) => {
    const gap = candidates.reduce((nearest, other) => other === target ? nearest : Math.min(nearest, Math.abs(other - target)), Infinity);
    return Math.min(amount * pixels / 2, gap * fraction);
  };
  if (held !== undefined && candidates.includes(held) && Math.abs(raw - held) <= band(held, 6, .4) + 1e-10) return {value: held, snapped: held};
  const target = candidates.reduce<number | undefined>((nearest, item) => nearest === undefined || Math.abs(raw - item) < Math.abs(raw - nearest) ? item : nearest, undefined);
  if (target !== undefined && Math.abs(raw - target) <= band(target, 3, .25) + 1e-10) return {value: target, snapped: target};
  return {value};
}

export function layoutNumberPresets(key: string, slide: {width: number; height: number}, frame: {w: number; h: number}): NumberPreset[] {
  const dimension = key === 'x' || key === 'w' ? slide.width : slide.height;
  if (key === 'w' || key === 'h') return [.25, .5, .75, 1].map(fraction => ({value: Math.round(dimension * fraction * 10) / 10, label: `${fraction * 100}% of slide`}));
  const size = key === 'x' ? frame.w : frame.h;
  return [{value: 0, label: key === 'x' ? 'Left edge' : 'Top edge'}, {value: 24, label: '24 px inset'}, {value: 48, label: '48 px inset'}, {value: Math.round((dimension - size) * 5) / 10, label: 'Center'}, {value: Math.round((dimension - size) * 10) / 10, label: key === 'x' ? 'Right edge' : 'Bottom edge'}];
}

export const NUMBER_PRESETS = {
  number: [0, 1, 2, 4, 8, 16, 32, 64, 100],
  spacing: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96],
  dimension: [64, 128, 240, 320, 480, 640, 960, 1280, 1920],
  offset: [-48, -24, -16, -8, 0, 8, 16, 24, 48],
  font: [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96, 120],
  lineHeight: [1, 1.1, 1.2, 1.25, 1.4, 1.5, 1.6, 1.8, 2],
  tracking: [-2, -1, -.5, 0, .5, 1, 2, 4, 8],
  percent: [0, 10, 25, 50, 75, 90, 100],
  scale: [25, 50, 75, 100, 125, 150, 200, 300],
  angle: [-180, -90, -45, 0, 30, 45, 90, 180],
  radius: [0, 4, 8, 12, 16, 24, 32, 48, 64],
  stroke: [0, .5, 1, 2, 3, 4, 6, 8, 12],
  duration: [100, 200, 300, 400, 500, 800, 1000, 1500, 2000],
  delay: [0, 100, 200, 300, 500, 800, 1000, 2000, 3000, 5000],
  count: [1, 2, 3, 4, 5, 6, 8, 10, 12],
  page: [0, 1, 2, 10, 100],
  data: [-100, -50, 0, 25, 50, 75, 100, 250, 500, 1000],
} as const;
export type NumberPresetKind = keyof typeof NUMBER_PRESETS;

export function numberPresets(kind: NumberPresetKind, options: {presets?: readonly NumberPreset[]; min?: number; max?: number; step?: number | string} = {}): {value: number; label: string}[] {
  const {min, max, step} = options, seen = new Set<number>();
  const candidates = options.presets ?? NUMBER_PRESETS[kind];
  const result = candidates.map(item => typeof item === 'number' ? {value: item, label: ''} : item).filter(item => {
    if (!Number.isFinite(item.value) || min !== undefined && item.value < min || max !== undefined && item.value > max || seen.has(item.value)) return false;
    if (typeof step === 'number' && step > 0 && Math.abs((item.value - (min ?? 0)) / step - Math.round((item.value - (min ?? 0)) / step)) > 1e-7) return false;
    seen.add(item.value); return true;
  });
  if (!result.length && !options.presets) for (const value of [min, max]) if (value !== undefined && Number.isFinite(value) && !seen.has(value) && (typeof step !== 'number' || step <= 0 || Math.abs((value - (min ?? 0)) / step - Math.round((value - (min ?? 0)) / step)) < 1e-7)) {seen.add(value); result.push({value, label: ''});}
  return result;
}

const MENU_PRESETS = {
  number: [0, 1, 2, 4, 8, 16],
  spacing: [0, 8, 16, 24, 32, 48],
  dimension: [128, 240, 320, 640, 960, 1920],
  offset: [-24, -8, 0, 8, 16, 24],
  font: [16, 20, 24, 32, 48, 64],
  lineHeight: [1, 1.2, 1.4, 1.5, 1.6, 2],
  tracking: [-1, -.5, 0, .5, 1, 2],
  percent: [0, 25, 50, 75, 100],
  scale: [25, 50, 75, 100, 150, 200],
  angle: [-90, 0, 30, 45, 90, 180],
  radius: [0, 4, 8, 16, 24, 48],
  stroke: [0, 1, 2, 3, 4, 8],
  duration: [100, 200, 300, 500, 1000, 2000],
  delay: [0, 100, 300, 500, 1000, 2000],
  count: [1, 2, 3, 4, 6, 12],
  page: [0, 1, 2, 10, 100],
  data: [-100, -50, 0, 50, 100, 1000],
} satisfies Record<NumberPresetKind, readonly number[]>;

/** Menus offer a few common choices; drag magnets retain the full preset set. */
export function numberMenuPresets(kind: NumberPresetKind, options: Parameters<typeof numberPresets>[1] = {}) {
  const all = numberPresets(kind, options);
  const preferred = options.presets ? all : all.filter(item => MENU_PRESETS[kind].includes(item.value));
  const choices = preferred.length ? preferred : all;
  if (choices.length <= 6) return choices;
  return Array.from({length: 6}, (_, index) => choices[Math.round(index * (choices.length - 1) / 5)]);
}
