<script lang="ts">
  import type {LineStyle} from '../../core/line-schema';
  import {lineIconGeometry} from '../../core/line-icon';
  let {style,size=16,width=size,layout='path'}:{style:LineStyle;size?:number;width?:number;layout?:'path'|'horizontal'}=$props();
  const id=$props.id();
  const viewWidth=$derived(layout==='horizontal'?width/size*24:24);
  const geometry=$derived(lineIconGeometry(style,layout,viewWidth));
  const transform=(marker:typeof geometry.markers[number])=>`translate(${marker.point[0]} ${marker.point[1]}) rotate(${marker.point[2]})`;
</script>
<svg {width} height={size} style:width={`${width}px`} style:height={`${size}px`} viewBox={`0 0 ${viewWidth} 24`} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <defs><mask id={`${id}-shaft`} maskUnits="userSpaceOnUse" x="0" y="0" width={viewWidth} height="24"><rect width={viewWidth} height="24" fill="white" stroke="none"/>{#each geometry.markers as marker}{#if marker.occludes}<path d={marker.d} transform={transform(marker)} fill="black" stroke="black" stroke-width=".5"/>{/if}{/each}</mask></defs>
  <g mask={`url(#${id}-shaft)`}><path d={geometry.d} stroke-dasharray={geometry.dash} stroke-linecap="round"/></g>
  {#each geometry.markers as marker}{#if marker.kind!=='none'}<path d={marker.d} transform={transform(marker)} fill={marker.filled?'currentColor':'none'} stroke-width={marker.stroke} stroke-linecap="round"/>{/if}{/each}
</svg>
