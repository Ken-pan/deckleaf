import { AlignHorizontalJustifyStart,AlignHorizontalJustifyCenter,AlignHorizontalJustifyEnd,AlignVerticalJustifyStart,AlignVerticalJustifyCenter,AlignVerticalJustifyEnd,AlignHorizontalDistributeCenter,AlignVerticalDistributeCenter } from '@lucide/svelte';
import {editor} from './core/editor.svelte';
import {alignElements,distributeElements,arrangementUnits,distributionGap,alignmentReference,type AlignmentDirection} from './core/arrangement-operations';
import {arrangementParent} from './core/container-tree';
import {layoutArrangement,layoutAlignment,layoutDistribution} from './core/arrangement-layout';
import {objectAction} from './editor-focus';
import type {ContextMenuItem} from './context-menu';

export function arrangeContextActions():ContextMenuItem[]{
  if(!editor.deck||!editor.slide)return[];
  const slide=editor.slide,units=arrangementUnits(editor.deck,slide.id,editor.selected,editor.selectionScope);
  const flow=layoutArrangement(slide,editor.selected,editor.selectionScope);
  const inGroup=Boolean(editor.editingGroup&&arrangementParent(slide,editor.selected,editor.selectionScope));
  const reference=alignmentReference(editor.alignmentReference,units.length,inGroup);
  const apply=(direction:AlignmentDirection|'x'|'y')=>objectAction(()=>{
    const deck=editor.operationDocument();
    editor.commit(direction==='x'||direction==='y'?distributeElements(deck,slide.id,editor.selected,direction,editor.selectionScope):alignElements(deck,slide.id,editor.selected,direction,reference,editor.selectionScope));
  });
  const alignments=[
    {direction:'left',label:'Align left',icon:AlignHorizontalJustifyStart},
    {direction:'center',label:'Align horizontal centers',icon:AlignHorizontalJustifyCenter},
    {direction:'right',label:'Align right',icon:AlignHorizontalJustifyEnd},
    {direction:'top',label:'Align top',icon:AlignVerticalJustifyStart},
    {direction:'middle',label:'Align vertical centers',icon:AlignVerticalJustifyCenter},
    {direction:'bottom',label:'Align bottom',icon:AlignVerticalJustifyEnd},
  ] as const;
  const items:ContextMenuItem[]=alignments.filter(item=>units.length&&!(flow&&layoutAlignment(flow,item.direction).reason))
    .map(item=>({label:item.label,icon:item.icon,onselect:()=>apply(item.direction)}));
  const distributions=([{axis:'x',label:'Distribute horizontally',icon:AlignHorizontalDistributeCenter},{axis:'y',label:'Distribute vertically',icon:AlignVerticalDistributeCenter}] as const)
    .filter(item=>{const gap=distributionGap(units,item.axis);return flow?!layoutDistribution(flow,item.axis).reason:gap!==null&&gap>=0;})
    .map((item,index)=>({label:item.label,icon:item.icon,divider:index===0,onselect:()=>apply(item.axis)}));
  items.push(...distributions);
  return items;
}
