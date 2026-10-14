import {GroupLayoutSchema,type Slide} from './model';
import type {Operation} from './operations';
import {descendants,slideGroups} from './container-tree';
import type {Bounds,ResizeHandle} from './interactions';

export type LayoutResizeAxes={w:boolean;h:boolean};
export function layoutResizeAxes(slide:Slide,id:string):LayoutResizeAxes {
  const parent=slideGroups(slide).find(g=>g.id===id)?.parent;
  const flow=slide.autoLayouts?.find(l=>l.id===parent);
  return {w:true,h:!(flow?.direction==='grid'&&flow.adaptiveColumns)};
}
export function layoutHandleAxes(handle:ResizeHandle,proportional=false):LayoutResizeAxes {
  return {w:proportional||/[ew]/.test(handle),h:proportional||/[ns]/.test(handle)};
}
/** Resizing a layout changes its frame, never the scale of its descendants. */
export function resizedLayoutFrame(frame:Bounds,dx:number,dy:number,handle:ResizeHandle,proportional=false):Bounds {
  const sx=handle.includes('e')?1:handle.includes('w')?-1:0,sy=handle.includes('s')?1:handle.includes('n')?-1:0;
  let w=Math.max(1,Math.min(20000,frame.w+sx*dx)),h=Math.max(1,Math.min(20000,frame.h+sy*dy));
  if(proportional){const ratio=!sy||sx&&Math.abs(dx/frame.w)>=Math.abs(dy/frame.h)?w/frame.w:h/frame.h;
    const bounded=Math.max(1/frame.w,1/frame.h,Math.min(20000/frame.w,20000/frame.h,ratio));w=frame.w*bounded;h=frame.h*bounded;}
  return {x:Math.max(-20000,Math.min(20000,sx<0?frame.x+frame.w-w:sx>0?frame.x:frame.x+(frame.w-w)/2)),y:Math.max(-20000,Math.min(20000,sy<0?frame.y+frame.h-h:sy>0?frame.y:frame.y+(frame.h-h)/2)),w,h};
}
/** Panel and pointer edits share axis ownership and the same atomic operations. */
export function resizeLayout(slide:Slide,id:string,frame:Bounds,axes:LayoutResizeAxes):Operation[] {
  const layout=slide.autoLayouts?.find(l=>l.id===id);if(!layout)return[];
  if(descendants(slide,id).some(e=>e.locked))throw new Error('Unlock all members before resizing this layout.');
  const allowed=layoutResizeAxes(slide,id);
  if(axes.h&&!allowed.h)throw new Error('Height follows the parent grid. Resize the parent layout instead.');
  const group=slideGroups(slide).find(g=>g.id===id),parentFlow=slide.autoLayouts?.some(l=>l.id===group?.parent);
  const next=GroupLayoutSchema.parse({...layout,
    ...(!parentFlow?{x:frame.x,y:frame.y}:{}),
    ...(axes.w?{w:frame.w,widthMode:'fixed'}:{}),...(axes.h?{h:frame.h,heightMode:'fixed'}:{})});
  const operations:Operation[]=[];
  if(group?.layoutItem&&(axes.w&&group.layoutItem.widthMode==='fill'||axes.h&&group.layoutItem.heightMode==='fill'))operations.push({op:'set_group',slideId:slide.id,group:{...group,layoutItem:{...group.layoutItem,...(axes.w?{widthMode:'fixed' as const}:{}),...(axes.h?{heightMode:'fixed' as const}:{})}}});
  if(JSON.stringify(next)!==JSON.stringify(layout))operations.push({op:'set_group_layout',slideId:slide.id,layout:next});
  return operations;
}
/** Feed this metadata through the regular layout/text resolver, just as commit does. */
export function layoutResizePreview(slide:Slide,id:string,frame:Bounds,axes:LayoutResizeAxes):Slide {
  const ops=resizeLayout(slide,id,frame,axes);
  let next=slide;
  for(const op of ops){
    if(op.op==='set_group')next={...next,groups:[...(next.groups??[]).filter(g=>g.id!==op.group.id),op.group]};
    if(op.op==='set_group_layout')next={...next,autoLayouts:[...(next.autoLayouts??[]).filter(l=>l.id!==id),op.layout]};
  }
  return next;
}
