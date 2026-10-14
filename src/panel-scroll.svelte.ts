import {tick, untrack} from 'svelte';

// Optional panel bodies can sleep without losing the user's reading position.
export function rememberPanelScroll(active: () => boolean, scope: () => string, nodes: () => Array<HTMLElement | undefined>) {
  let shown = false, previousScope = '', savedScope = '', positions: number[] = [];
  $effect.pre(() => {
    const next = active(), key = scope();
    untrack(() => {
      if (shown && !next) { positions = nodes().map(node => node?.scrollTop ?? 0); savedScope = previousScope; }
      if (next && !shown) {
        const restore = key === savedScope ? positions : [];
        void tick().then(() => {
          if (active() && scope() === key) nodes().forEach((node, index) => node?.scrollTo({top: restore[index] ?? 0}));
        });
      }
      shown = next; previousScope = key;
    });
  });
}
