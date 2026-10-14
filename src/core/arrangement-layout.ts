import type {Slide,GroupLayout} from './model';
import {arrangementParent,directMembers,descendants,selectionRoots} from './container-tree';
import type {AlignmentDirection,Operation} from './operations';

export function layoutArrangement(slide:Slide,ids:string[],context='') {
  const parent=arrangementParent(slide,ids,context),layout=slide.autoLayouts?.find(l=>l.id===parent);
  if(!layout)return;
  const roots=selectionRoots(slide,ids,context),members=directMembers(slide,layout.id).filter(e=>!e.hidden);
  return {layout,count:members.length,complete:members.every(e=>roots.includes(e.id)),locked:descendants(slide,layout.id).some(e=>e.locked)};
}
type Arrangement=NonNullable<ReturnType<typeof layoutArrangement>>;
export function layoutAlignment(flow:Arrangement,direction:AlignmentDirection):{patch?:Partial<GroupLayout>;reason?:string} {
  if(flow.locked)return {reason:'Unlock all members to change auto layout.'};
  if(!flow.complete)return {reason:'Select all members to change their shared layout.'};
  const horizontal=['left','center','right'].includes(direction),value=direction==='left'||direction==='top'?'start':direction==='center'||direction==='middle'?'center':'end';
  const l=flow.layout,main=horizontal===(l.direction==='horizontal');
  if(l.direction==='grid')return horizontal?{patch:{align:value}}:{reason:'Grid rows follow their content. Use row gap to set spacing.'};
  if(main&&(horizontal?l.widthMode:l.heightMode)==='hug')return {reason:`Set layout ${horizontal?'width':'height'} to Fixed to change packing.`};
  return {patch:main?{justify:value}:{align:value}};
}
export function layoutDistribution(flow:Arrangement,axis:'x'|'y'):{patch?:Partial<GroupLayout>;reason?:string} {
  if(flow.locked)return {reason:'Unlock all members to change auto layout.'};
  if(!flow.complete)return {reason:'Select all members to distribute the shared layout.'};
  const l=flow.layout;
  if(l.direction==='grid')return {reason:'Grid spacing follows column and row gaps.'};
  if((axis==='x')!==(l.direction==='horizontal'))return {reason:'Distribute along the layout direction.'};
  if(flow.count<2)return {reason:'Add another visible member to distribute.'};
  if((axis==='x'?l.widthMode:l.heightMode)==='hug')return {reason:`Hug already uses equal gaps. Set ${axis==='x'?'width':'height'} to Fixed to spread members.`};
  return {patch:{justify:'space-between'}};
}
export function layoutArrangementOperations(slideId:string,flow:Arrangement,action:AlignmentDirection|'x'|'y'):Operation[] {
  const result=action==='x'||action==='y'?layoutDistribution(flow,action):layoutAlignment(flow,action);
  if(result.reason)throw new Error(result.reason);
  const patch=result.patch!;
  return Object.entries(patch).every(([key,value])=>flow.layout[key as keyof GroupLayout]===value)?[]:[{op:'set_group_layout',slideId,layout:{...flow.layout,...patch}}];
}
