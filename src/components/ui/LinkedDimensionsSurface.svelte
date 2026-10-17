<script lang="ts">
  import {onMount} from 'svelte';
  import {Spring} from 'svelte/motion';
  import {reducedUI} from '../../ui-motion';
  let surface:SVGSVGElement;
  let geometry=$state({width:0,height:0,left:0,right:0,radius:8});
  // Low stiffness and restrained overshoot keep reversals soft without a bouncy button.
  const swell=new Spring(0,{stiffness:.07,damping:.34,precision:.001});
  onMount(()=>{
    const row=surface.parentElement!;
    const fields=Array.from(row.querySelectorAll<HTMLElement>('.number-field'));
    const touch=matchMedia('(hover: none), (pointer: coarse)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
    let disposed=false;
    function sync(instant=false){
      if(disposed)return;
      const open=touch.matches||row.matches(':hover')||Boolean(row.querySelector('.ratio-toggle:focus-visible'));
      void swell.set(open?1:0,{instant:instant||reducedUI()}).catch(()=>{});
    }
    const pointer=()=>sync(),focus=()=>queueMicrotask(()=>sync()),preference=()=>sync(true);
    row.addEventListener('pointerenter',pointer);row.addEventListener('pointerleave',pointer);
    row.addEventListener('focusin',focus);row.addEventListener('focusout',focus);
    touch.addEventListener('change',preference);motion.addEventListener('change',preference);
    const preferences=new MutationObserver(preference);preferences.observe(document.documentElement,{attributes:true,attributeFilter:['data-ui-motion']});
    function measure(){
      if(fields.length!==2)return;
      const bounds=row.getBoundingClientRect(),left=fields[0].getBoundingClientRect(),right=fields[1].getBoundingClientRect();
      const next={width:bounds.width,height:left.height,left:left.right-bounds.left-.5,right:right.left-bounds.left+.5,radius:parseFloat(getComputedStyle(fields[0]).borderTopLeftRadius)||8};
      if(Object.keys(next).some(key=>next[key as keyof typeof next]!==geometry[key as keyof typeof geometry]))geometry=next;
    }
    measure();
    sync(true);
    const observer=new ResizeObserver(measure);observer.observe(row);fields.forEach(field=>observer.observe(field));
    return ()=>{
      disposed=true;void swell.set(swell.current,{instant:true});observer.disconnect();preferences.disconnect();
      row.removeEventListener('pointerenter',pointer);row.removeEventListener('pointerleave',pointer);
      row.removeEventListener('focusin',focus);row.removeEventListener('focusout',focus);
      touch.removeEventListener('change',preference);motion.removeEventListener('change',preference);
    };
  });
  const path=$derived.by(()=>{
    const {width:w,height:h,left:a,right:b,radius:r}=geometry;
    if(!w||!h)return '';
    const l=.5,t=.5,rr=w-.5,bottom=h-.5,c=w/2,y=h/2,p=Math.max(0,Math.min(1,swell.current));
    // Stretch into the neck while changing shape; settle back to the 22px circle.
    const stretch=Math.sin(Math.PI*p)*.13,ball=2+9*Math.max(0,Math.min(1.06,swell.current)),rx=ball*(1+stretch),ry=ball*(1-stretch),neck=2+Math.max(-.06,Math.min(0,swell.current))*6,qx=rx/Math.SQRT2*p,qy=neck+(ry/Math.SQRT2-neck)*p,k=qy-neck,join=7;
    return `M${l+r} ${t}H${a-r}Q${a} ${t} ${a} ${t+r}V${y-join}
      C${a} ${y-neck} ${c-qx-k} ${y-neck} ${c-qx} ${y-qy}
      A${rx} ${ry} 0 0 1 ${c+qx} ${y-qy}
      C${c+qx+k} ${y-neck} ${b} ${y-neck} ${b} ${y-join}
      V${t+r}Q${b} ${t} ${b+r} ${t}H${rr-r}Q${rr} ${t} ${rr} ${t+r}
      V${bottom-r}Q${rr} ${bottom} ${rr-r} ${bottom}H${b+r}Q${b} ${bottom} ${b} ${bottom-r}V${y+join}
      C${b} ${y+neck} ${c+qx+k} ${y+neck} ${c+qx} ${y+qy}
      A${rx} ${ry} 0 0 1 ${c-qx} ${y+qy}
      C${c-qx-k} ${y+neck} ${a} ${y+neck} ${a} ${y+join}
      V${bottom-r}Q${a} ${bottom} ${a-r} ${bottom}H${l+r}Q${l} ${bottom} ${l} ${bottom-r}
      V${t+r}Q${l} ${t} ${l+r} ${t}Z`;
  });
</script>

<svg bind:this={surface} class="dimensions-surface" viewBox={`0 0 ${geometry.width||1} ${geometry.height||1}`} style:height={`${geometry.height}px`} aria-hidden="true" focusable="false">
  <path d={path}/>
</svg>
