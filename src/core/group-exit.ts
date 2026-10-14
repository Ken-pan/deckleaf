import type {Slide} from './model';
import {createContainerTree,selectionRoots} from './container-tree';
import {layerMove,type LayerMove} from './layer-move';

/** Exit commands use the same hierarchy, order and lock rules as layer dragging. */
export function groupExitOptions(slide:Slide,ids:string[],context='') {
  const tree=createContainerTree(slide),roots=selectionRoots(slide,ids,context,tree);
  const parents=roots.map(id=>tree.elements.get(id)?.group??tree.groupById.get(id)?.parent);
  const available=parents.some(Boolean),parent=parents[0]&&parents.every(p=>p===parents[0])?parents[0]:undefined;
  const destination=parent?tree.groupById.get(parent)?.parent:undefined;
  const nested=parents.some(id=>id&&tree.groupById.get(id)?.parent);
  const blocked:LayerMove={ids:roots,operations:[],reason:'Select members of one group to move out one level.'};
  return {available,parent,destination,nested,
    out:available&&parent?layerMove(slide,roots,{target:parent,position:'before'},tree):blocked,
    slide:available?layerMove(slide,roots,{target:null,position:'inside'},tree):{ids:roots,operations:[]},
    showSlide:available&&(nested||!parent)};
}
