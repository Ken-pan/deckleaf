<script lang="ts">
  import type {CanvasDrop} from '../core/canvas-container-move';
  let {drop,scale,page}:{drop:CanvasDrop;scale:number;page:{width:number;height:number}}=$props();
  const box=$derived(drop.box??{x:0,y:0,w:page.width,h:page.height});
  const badgeWidth=$derived(Math.max(120,Math.min(260,page.width*scale-24))/scale);
  const x=$derived(Math.max(8/scale,Math.min(box.x,page.width-badgeWidth-8/scale)));
  const y=$derived(Math.max(8/scale,Math.min(box.y-36/scale,page.height-48/scale)));
</script>
<div class="drop" class:invalid={Boolean(drop.reason)} data-container-drop={drop.parent??'slide'} data-drop-position={drop.drop.position} aria-hidden="true" style:--u="{1/scale}px">
  <div class="boundary" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px"></div>
  {#if drop.line&&!drop.reason}<svg width={page.width} height={page.height}><line x1={drop.line.x1} y1={drop.line.y1} x2={drop.line.x2} y2={drop.line.y2}/><circle cx={drop.line.x1} cy={drop.line.y1} r={3/scale}/><circle cx={drop.line.x2} cy={drop.line.y2} r={3/scale}/></svg>{/if}
  <div class="badge" style:left="{x}px" style:top="{y}px" style:max-width="{badgeWidth}px">{drop.reason??drop.label}</div>
</div>
<style>
  .drop{position:absolute;inset:0;pointer-events:none;z-index:45;color:var(--canvas-selection)}
  .invalid{color:var(--warning-text)}
  .boundary{position:absolute;border:calc(2*var(--u)) dashed currentColor;background:color-mix(in srgb,currentColor 5%,transparent);box-sizing:border-box}
  svg{position:absolute;inset:0;overflow:visible}line{stroke:currentColor;stroke-width:calc(3*var(--u))}circle{fill:currentColor}
  .badge{position:absolute;padding:calc(5*var(--u)) calc(8*var(--u));border:var(--u) solid currentColor;border-radius:calc(4*var(--u));background:var(--surface-overlay);color:var(--text-primary);font:calc(12*var(--u))/1.4 var(--font-ui);overflow-wrap:anywhere;box-shadow:var(--shadow-floating)}
  .invalid .badge{border-color:var(--warning-border);color:var(--warning-text)}
  @media(forced-colors:active){.drop{color:Highlight}.boundary{background:none}.badge{background:Canvas;color:CanvasText}}
</style>
