<script lang="ts">
  import type {Slide} from '../core/model';
  import {elementCorners,type Bounds} from '../core/interactions';
  import {formatRotation,type RotationGesture} from '../core/rotation';
  import {elementLabel} from './element-labels';
  let {page,slide,gesture,scale,moving,free=false}:{page:{width:number;height:number};slide:Slide;gesture:RotationGesture;scale:number;moving:Bounds|null;free?:boolean}=$props();
  const snap=$derived(gesture.snap);
  const reference=$derived(slide.elements.find(e=>e.id===snap?.referenceId));
  const member=$derived(slide.elements.find(e=>e.id===(snap?.memberId??gesture.members.find(e=>!e.hidden)?.id)));
  const value=$derived(gesture.single?formatRotation(gesture.members[0].rotation+gesture.angle):`Rotate ${formatRotation(gesture.angle,true)}`);
  const name=$derived(reference?.name&&reference.name!=='Element'?reference.name:reference?elementLabel(reference):'');
  const detail=$derived(snap?.kind==='object'?`${gesture.single?'Match angle':`Match ${formatRotation(snap.angle)}`} · ${name}`:snap?.kind==='common'?'Common angle':snap?.kind==='step'?'15° steps':free?'Free rotation':'Rotate');
  let feedbackSize=$state({w:0,h:0});
  const maxWidth=$derived(Math.min(220,page.width*scale-16)/scale);
  function measure(node:HTMLElement){
    const update=()=>{feedbackSize={w:node.offsetWidth,h:node.offsetHeight};};
    const observer=new ResizeObserver(update);observer.observe(node);update();return{destroy:()=>observer.disconnect()};
  }
  const badge=$derived.by(()=>{
    const b=moving??{x:gesture.center.x,y:gesture.center.y,w:0,h:0},w=feedbackSize.w||maxWidth,h=feedbackSize.h||44/scale,pad=8/scale,gap=14/scale;
    const x=b.x+b.w/2-w/2,y=b.y+b.h/2-h/2;
    const candidates=[{x,y:b.y+b.h+gap},{x,y:b.y-h-gap},{x:b.x+b.w+gap,y},{x:b.x-w-gap,y}].map(p=>({x:Math.max(pad,Math.min(p.x,page.width-w-pad)),y:Math.max(pad,Math.min(p.y,page.height-h-pad))}));
    const overlap=(p:{x:number;y:number},box:Bounds)=>Math.max(0,Math.min(p.x+w,box.x+box.w)-Math.max(p.x,box.x))*Math.max(0,Math.min(p.y+h,box.y+box.h)-Math.max(p.y,box.y));
    const obstacles=[b,...(reference?[bounds(reference)]:[])];
    return candidates.map((p,i)=>({...p,score:obstacles.reduce((s,b)=>s+overlap(p,b),0)+i*.001})).sort((a,b)=>a.score-b.score)[0];
  });
  function bounds(e:Slide['elements'][number]):Bounds{
    const p=elementCorners(e),x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));return{x,y,w:Math.max(...p.map(p=>p.x))-x,h:Math.max(...p.map(p=>p.y))-y};
  }
  function axis(center:{x:number;y:number},angle:number,length:number){
    const a=angle*Math.PI/180,dx=Math.cos(a)*length/2,dy=Math.sin(a)*length/2;
    return`M ${center.x-dx} ${center.y-dy} L ${center.x+dx} ${center.y+dy}`;
  }
  const movingAxis=$derived(snap&&member?axis(snap.kind==='object'||gesture.single?{x:member.x+member.w/2,y:member.y+member.h/2}:gesture.center,snap.kind==='object'?snap.angle:gesture.single?member.rotation:gesture.angle,Math.max(snap.kind==='object'||gesture.single?member.w:gesture.scene?.box.w??member.w,64/scale)+24/scale):'');
  const referenceAxis=$derived(reference?axis({x:reference.x+reference.w/2,y:reference.y+reference.h/2},reference.rotation,Math.max(reference.w,64/scale)+24/scale):'');
  const referenceOutline=$derived(reference?`M ${elementCorners(reference).map(p=>`${p.x} ${p.y}`).join(' L ')} Z`:'');
</script>
<div class="rotation-feedback-layer" aria-hidden="true" style:--u="{1/scale}px">
  {#if snap}
    <svg width={page.width} height={page.height} data-rotation-snap={snap.kind}>
      {#if reference}<path class="reference-angle" data-rotation-reference={reference.id} d={referenceOutline} fill="none" stroke="currentColor" stroke-width={1/scale} stroke-dasharray="{3/scale} {3/scale}"/><path d={referenceAxis} fill="none" stroke="currentColor" stroke-width={1/scale} stroke-dasharray="{4/scale} {3/scale}"/>{/if}
      <path d={movingAxis} fill="none" stroke="currentColor" stroke-width={1.5/scale}/>
    </svg>
  {/if}
  <div class="rotation-feedback" class:snapped={Boolean(snap)} data-rotation-angle={gesture.single?formatRotation(gesture.members[0].rotation+gesture.angle):formatRotation(gesture.angle,true)} use:measure style:left="{badge.x}px" style:top="{badge.y}px" style:max-width="{maxWidth}px"><span class="angle-value">{value}</span><span class="angle-detail">{detail}</span></div>
</div>
<style>
  .rotation-feedback-layer{position:absolute;inset:0;pointer-events:none;z-index:35;color:var(--canvas-snap)}
  svg{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}
  .rotation-feedback{position:absolute;max-width:calc(220*var(--u));padding:calc(4*var(--u)) calc(7*var(--u));border:var(--u) solid var(--border-default);border-radius:calc(4*var(--u));background:var(--surface-overlay);color:var(--text-primary);box-shadow:0 calc(2*var(--u)) calc(8*var(--u)) var(--border-subtle);font:calc(11*var(--u))/1.4 var(--font-ui);font-variant-numeric:tabular-nums}
  .snapped{border-color:color-mix(in srgb,var(--canvas-snap) 45%,transparent)}
  span{display:block}.angle-value{font-weight:600;white-space:nowrap}.angle-detail{color:var(--text-secondary);overflow-wrap:anywhere}
</style>
