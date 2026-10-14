import type {Slide,SlideElement} from './model';
import type {Operation} from './operations';
import {createContainerTree,selectionRoots} from './container-tree';
import {selectionBounds,type Bounds,type Point} from './interactions';
import {layerMove,layerChildren,type LayerDrop,type LayerMove} from './layer-move';

type Item={id:string;box:Bounds};
export type CanvasDrop={drop:LayerDrop;parent?:string;box?:Bounds;line?:{x1:number;y1:number;x2:number;y2:number};label:string;reason?:string;flow:boolean;reparent:boolean};
const contains=(box:Bounds,p:Point)=>p.x>=box.x&&p.y>=box.y&&p.x<=box.x+box.w&&p.y<=box.y+box.h;

/** One geometry/index snapshot per gesture. Slot changes alone regenerate membership operations. */
export function createCanvasMoveScene(slide:Slide,ids:string[],context='') {
  const tree=createContainerTree(slide),roots=selectionRoots(slide,ids,context).filter(id=>!tree.elements.get(id)?.locked&&!tree.elements.get(id)?.designPattern&&!tree.stats.get(id)?.locked),picked=new Set(roots);
  const members=roots.flatMap(id=>tree.groupById.has(id)?tree.descendants(id):tree.elements.has(id)?[tree.elements.get(id)!]:[]),memberIds=new Set(members.map(e=>e.id));
  const parentOf=(id:string)=>tree.elements.get(id)?.group??tree.groupById.get(id)?.parent;
  const parents=roots.map(parentOf),commonParent=parents.length&&parents.every(id=>id===parents[0])?parents[0]:undefined;
  // A plain group's bounds follow its children. Moving a child does not change membership.
  const keepMembership=parents.some(id=>id&&!tree.layouts.has(id));
  const boxes=new Map<string,Bounds>();
  for(const group of tree.groups){const layout=tree.layouts.get(group.id),box=layout??selectionBounds(tree.descendants(group.id).filter(e=>!e.hidden));if(box&&tree.stats.get(group.id)?.visible)boxes.set(group.id,box);}
  const bounds=roots.length===1&&tree.groupById.has(roots[0])?boxes.get(roots[0])??null:selectionBounds(members.filter(e=>!e.hidden));
  const containers=tree.groups.filter(g=>tree.layouts.has(g.id)&&boxes.has(g.id)&&!picked.has(g.id)&&!tree.ancestors(g.id).some(id=>picked.has(id))).sort((a,b)=>tree.ancestors(b.id).length-tree.ancestors(a.id).length||(tree.rank.get(b.id)??0)-(tree.rank.get(a.id)??0));
  const remaining=(id:string)=>!picked.has(id)&&(tree.elements.has(id)?!memberIds.has(id):tree.descendants(id).some(e=>!memberIds.has(e.id)));
  const children=new Map<string,Item[]>();
  for(const layout of tree.layouts.values())children.set(layout.id,layout.order.filter(remaining).flatMap(id=>{const e=tree.elements.get(id),box=e&&!e.hidden?selectionBounds([e]):boxes.get(id);return box&&(!e||!e.hidden)?[{id,box}]:[];}));
  let key='',cached:CanvasDrop|undefined,plan:LayerMove|undefined;
  function target(point:Point,dx:number,dy:number,exitTolerance=0):CanvasDrop {
    const parent=keepMembership?commonParent:containers.find(g=>{const box=boxes.get(g.id)!;return contains(box,point)||roots.every(id=>parentOf(id)===g.id)&&contains({x:box.x-exitTolerance,y:box.y-exitTolerance,w:box.w+exitTolerance*2,h:box.h+exitTolerance*2},point);})?.id,layout=parent?tree.layouts.get(parent):undefined;
    const sameParent=roots.every(id=>parentOf(id)===parent),items=parent?children.get(parent)??[]:[];
    let drop:LayerDrop={target:parent??null,position:'inside'},line:CanvasDrop['line'];
    if(layout&&items.length&&bounds){
      const vertical=layout.direction==='vertical',main=vertical?'y':'x',cross=vertical?'x':'y',size=vertical?'h':'w',crossSize=vertical?'w':'h';
      const center={x:bounds.x+dx+bounds.w/2,y:bounds.y+dy+bounds.h/2};let band=items;
      if(layout.direction==='grid'||layout.wrap){const bands:Item[][]=[];for(const item of items){const row=bands.find(row=>row.some(v=>item.box[cross]<v.box[cross]+v.box[crossSize]-.001&&item.box[cross]+item.box[crossSize]>v.box[cross]+.001));if(row)row.push(item);else bands.push([item]);}band=bands.sort((a,b)=>Math.abs(center[cross]-(Math.min(...a.map(v=>v.box[cross]))+Math.max(...a.map(v=>v.box[cross]+v.box[crossSize])))/2)-Math.abs(center[cross]-(Math.min(...b.map(v=>v.box[cross]))+Math.max(...b.map(v=>v.box[cross]+v.box[crossSize])))/2))[0];}
      const before=band.find(v=>center[main]<v.box[main]+v.box[size]/2),anchor=before??band.at(-1)!;drop={target:anchor.id,position:before?'before':'after'};
      const at=before?anchor.box[main]-layout.gap/2:anchor.box[main]+anchor.box[size]+layout.gap/2,start=Math.min(...band.map(v=>v.box[cross])),end=Math.max(...band.map(v=>v.box[cross]+v.box[crossSize]));
      line=vertical?{x1:start,y1:at,x2:end,y2:at}:{x1:at,y1:start,x2:at,y2:end};
    }else if(!sameParent&&!layout){const front=layerChildren(tree,parent).find(remaining);if(front)drop={target:front,position:'before'};}
    const token=JSON.stringify([parent,drop.target,drop.position]);
    if(token===key&&cached)return cached;
    key=token;plan=layerMove(slide,roots,drop,tree);
    // Moving inside a plain container keeps its existing paint position.
    if(keepMembership||sameParent&&!layout)plan={...plan,operations:[]};
    const name=parent?tree.layouts.get(parent)?.name??tree.groupById.get(parent)?.name:'Slide',anchor=drop.target?tree.elements.get(drop.target)?.name??tree.groupById.get(drop.target)?.name:undefined;
    const label=keepMembership&&!commonParent?'Move selection · Groups unchanged':layout?anchor&&drop.position!=='inside'?`Insert ${drop.position} ${anchor} · ${name}`:`Place in ${name}`:sameParent?`Move within ${name}`:`Move to ${name}`;
    cached={drop,parent,box:parent&&!keepMembership?boxes.get(parent):undefined,line,label,reason:plan.reason,flow:Boolean(layout),reparent:!keepMembership&&!sameParent};return cached;
  }
  function operations(destination:CanvasDrop,dx:number,dy:number):Operation[] {
    if(destination!==cached||!plan||plan.reason||!roots.length)return[];
    const ops=[...plan.operations];
    if(!destination.flow&&Math.abs(dx)+Math.abs(dy)>.0001){
      for(const e of members)ops.push({op:'update_element',slideId:slide.id,elementId:e.id,patch:{x:e.x+dx,y:e.y+dy}});
      // Explicit frames prevent a detached nested flow from resolving back to its old position.
      for(const layout of tree.layouts.values())if(picked.has(layout.id)||tree.ancestors(layout.id).some(id=>picked.has(id)))ops.push({op:'set_group_layout',slideId:slide.id,layout:{...layout,x:layout.x+dx,y:layout.y+dy}});
      if(!destination.reparent){
        // Editing a plain child must not be mistaken for dragging its enclosing flow frame.
        const ancestors=new Set(roots.flatMap(id=>tree.ancestors(id)));
        for(const id of ancestors){const layout=tree.layouts.get(id);if(layout&&!ops.some(op=>op.op==='set_group_layout'&&op.layout.id===id))ops.push({op:'set_group_layout',slideId:slide.id,layout});}
      }
    }
    return ops;
  }
  return {roots,members:members as SlideElement[],bounds,target,operations,parentOf};
}
export type CanvasMoveScene=ReturnType<typeof createCanvasMoveScene>;
