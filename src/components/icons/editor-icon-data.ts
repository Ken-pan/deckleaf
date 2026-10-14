import type { LucideIconData } from '@lucide/svelte';

// Editor-specific meanings absent from Lucide. Keep its 24px grid, 2px stroke,
// rounded caps and currentColor rendering through the shared Lucide Icon.
export const editorIconData = {
  cornerRadius: {name: 'corner-radius', size: 24, node: [
    ['path', {d: 'M5 20v-7a8 8 0 0 1 8-8h7'}],
    ['path', {d: 'M5 8V5h3', 'stroke-dasharray': '1 3'}],
  ]},
  // Use the same card positions in both directions; only occlusion changes.
  bringForward: {name: 'bring-forward', size: 24, node: [
    ['rect', {x: 2, y: 9, width: 9, height: 9, rx: 2}],
    ['path', {d: 'M6 9V7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'}],
    ['path', {d: 'M20 18V6m-2 2 2-2 2 2'}],
  ]},
  sendBackward: {name: 'send-backward', size: 24, node: [
    ['rect', {x: 6, y: 5, width: 9, height: 9, rx: 2}],
    ['path', {d: 'M6 9H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-2'}],
    ['path', {d: 'M20 6v12m-2-2 2 2 2-2'}],
  ]},
  textAlignTop: {name: 'text-align-top', size: 24, node: [
    ['rect', {x: 3, y: 3, width: 18, height: 18, rx: 2}],
    ['path', {d: 'M7 7h10M7 11h7'}],
  ]},
  textAlignMiddle: {name: 'text-align-middle', size: 24, node: [
    ['rect', {x: 3, y: 3, width: 18, height: 18, rx: 2}],
    ['path', {d: 'M7 10h10M7 14h7'}],
  ]},
  textAlignBottom: {name: 'text-align-bottom', size: 24, node: [
    ['rect', {x: 3, y: 3, width: 18, height: 18, rx: 2}],
    ['path', {d: 'M7 13h10M7 17h7'}],
  ]},
  textAutoWidth: {name: 'text-auto-width', size: 24, node: [
    ['path', {d: 'M12 11V3M8 3h8M3 18h18m-3-3 3 3-3 3M6 15l-3 3 3 3'}],
  ]},
  textAutoHeight: {name: 'text-auto-height', size: 24, node: [
    ['path', {d: 'M3 7h9M3 12h6M3 17h9M19 5v14m-3-3 3 3 3-3m-6-8 3-3 3 3'}],
  ]},
  // A closed text frame is distinct from crop/scan corners and alignment bars.
  textFixedSize: {name: 'text-fixed-size', size: 24, node: [
    ['rect', {x: 3, y: 3, width: 18, height: 18, rx: 2}],
    ['path', {d: 'M8 8h8M12 8v8'}],
  ]},
} satisfies Record<string, LucideIconData>;
