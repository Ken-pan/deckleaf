<script lang="ts">
  import type { DeckBlock } from '../core/deck-blocks';
  import {fontStack} from '../core/font-stack';
  let {block}: {block: DeckBlock} = $props();
</script>

<svg viewBox="0 0 {block.w} {block.h}" role="img" aria-label="{block.name} preview">
  {#each block.elements as e}
    {#if e.type === 'rect'}
      <rect x={e.x} y={e.y} width={e.w} height={e.h} rx={e.radius} fill={e.fill} stroke={e.stroke} stroke-width={e.strokeWidth} />
    {:else if e.type === 'ellipse'}
      <ellipse cx={e.x+e.w/2} cy={e.y+e.h/2} rx={e.w/2} ry={e.h/2} fill={e.fill} />
    {:else if e.type === 'line'}
      <line x1={e.x} y1={e.flipY?e.y+e.h:e.y} x2={e.x+e.w} y2={e.flipY?e.y:e.y+e.h} stroke={e.stroke} stroke-width={e.strokeWidth} />
    {:else if e.type === 'text'}
      <foreignObject x={e.x} y={e.y} width={e.w} height={e.h}>
        <div style:font-family={fontStack(e.fontFamily)} style:font-size="{e.fontSize}px" style:font-weight={e.fontWeight} style:line-height={e.lineHeight} style:color={e.fill} style:text-align={e.align}>{e.text}</div>
      </foreignObject>
    {/if}
  {/each}
</svg>
<style>
  svg{display:block;width:100%;height:100%;overflow:visible}
  div{white-space:pre-wrap;overflow-wrap:anywhere;height:100%;overflow:hidden}
</style>
