import {createContainerTree,selectionRoots,type ContainerTree} from './core/container-tree';
import {layerMove,type LayerDrop,type LayerMove} from './core/layer-move';
import {editor} from './core/editor.svelte';
import type {Slide} from './core/model';
import {holdPointerCursor} from './pointer-cursor';

type Options={root:()=>HTMLElement|undefined;list:()=>HTMLElement|undefined;rows:()=>{id:string;depth:number}[];collapsed:()=>string[];fold:(id:string,value:boolean)=>void;disabled:()=>boolean};
type Session={ids:string[];source:string;slide:Slide;tree:ContainerTree;revision:number;slideId:string;deckId:string;handle:HTMLElement;pointer?:number;startX:number;startY:number;x:number;y:number;active:boolean;cursor:string|null;drop?:LayerDrop;plan?:LayerMove;expanded:string[]};
type Feedback={ids:string[];drop?:LayerDrop;invalid?:string;name:string;keyboard:boolean};

/** A gesture owns one immutable view and computes operations only when its slot changes. */
export class LayerDrag {
  view=$state.raw<Feedback>();
  x=$state(0);
  y=$state(0);
  message=$state('');
  private session?:Session;
  private releaseCursor?:()=>void;
  private frame=0;
  private scrollDirection=0;
  private scrollStarted=0;
  private expandTimer:ReturnType<typeof setTimeout>|undefined;
  private visibilityObserver?:MutationObserver;
  constructor(private options:Options){}
  private name(id:string|null,s=this.session){return id===null?'Slide':s?.tree.layouts.get(id)?.name??s?.tree.groupById.get(id)?.name??s?.tree.elements.get(id)?.name??'layer';}
  private select(id:string){if(editor.slide&&createContainerTree(editor.slide).groupById.has(id))editor.chooseGroup(id);else editor.choose(id,false,true);}
  private start(id:string,handle:HTMLElement,pointer?:PointerEvent){
    this.cancel(false);
    const slide=editor.slide,deck=editor.deck;if(!slide||!deck||this.options.disabled()||editor.sourceMode)return;
    const tree=createContainerTree(slide);if(tree.elements.get(id)?.locked||tree.stats.get(id)?.locked)return;
    this.session={ids:[id],source:id,slide,tree,revision:deck.revision,slideId:editor.activeId,deckId:deck.id,handle,pointer:pointer?.pointerId,startX:pointer?.clientX??0,startY:pointer?.clientY??0,x:pointer?.clientX??0,y:pointer?.clientY??0,active:false,cursor:id,expanded:[]};
    handle.focus({preventScroll:true});document.addEventListener('keydown',this.escape,true);
    this.visibilityObserver=new MutationObserver(()=>{if(handle.closest('[inert],[hidden]'))this.cancel();});
    for(let node:HTMLElement|null=handle.parentElement;node;node=node.parentElement)this.visibilityObserver.observe(node,{attributes:true,attributeFilter:['inert','hidden']});
  }
  private activate(){
    const s=this.session;if(!s)return;
    const roots=selectionRoots(s.slide,editor.selected,editor.selectionScope);
    if(s.tree.groupById.has(s.source)?roots.includes(s.source):editor.selected.includes(s.source)&&!editor.selectedContainer)s.ids=roots;
    else this.select(s.source);
    s.active=true;editor.hovered='';this.releaseCursor=holdPointerCursor('grabbing');
    this.x=s.x;this.y=s.y;this.view={ids:s.ids,name:s.ids.length===1?this.name(s.ids[0]):`${s.ids.length} layers`,keyboard:s.pointer===undefined};
    this.message=`Moving ${this.view.name}. Choose a position; press Escape to cancel.`;
  }
  pointerDown(event:PointerEvent,id:string){
    if(event.button!==0||!event.isPrimary)return;
    event.preventDefault();event.stopPropagation();const handle=event.currentTarget as HTMLElement;
    this.start(id,handle,event);if(this.session)handle.setPointerCapture(event.pointerId);
  }
  pointerMove(event:PointerEvent){
    const s=this.session;if(!s||s.pointer!==event.pointerId)return;
    s.x=event.clientX;s.y=event.clientY;
    if(!s.active&&Math.hypot(s.x-s.startX,s.y-s.startY)<6)return;
    event.preventDefault();if(!s.active){this.activate();this.frame=requestAnimationFrame(this.scroll);}
    this.x=s.x;this.y=s.y;this.hit();
  }
  pointerUp(event:PointerEvent){
    const s=this.session;if(!s||s.pointer!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();s.x=event.clientX;s.y=event.clientY;if(s.active){this.hit();void this.drop();}else{const id=s.source;this.cleanup();this.select(id);}
  }
  pointerCancel(event:PointerEvent){if(this.session?.pointer===event.pointerId)this.cancel();}
  private hit(){
    const s=this.session,root=this.options.root();if(!s?.active||!root)return;
    const hit=document.elementFromPoint(s.x,s.y) as HTMLElement|null;
    if(!hit||!root.contains(hit)){this.slot();return;}
    if(hit.closest('[data-layer-root]')){this.slot({target:null,position:'inside'});return;}
    const row=hit.closest<HTMLElement>('[data-layer-row]');
    if(row){const target=row.dataset.layerRow!,box=row.getBoundingClientRect(),fraction=(s.y-box.top)/box.height;this.slot({target,position:s.tree.groupById.has(target)&&fraction>.25&&fraction<.75?'inside':fraction<.5?'before':'after'});}
    else this.slot();
  }
  private slot(drop?:LayerDrop){
    const s=this.session;if(!s||s.drop?.target===drop?.target&&s.drop?.position===drop?.position)return;
    clearTimeout(this.expandTimer);s.drop=drop;s.plan=drop?layerMove(s.slide,s.ids,drop,s.tree):undefined;
    this.view={...this.view!,drop,invalid:s.plan?.reason};
    if(!drop){this.message='Choose a layer or drop inside a group.';return;}
    s.cursor=drop.target;
    const destination=drop.position==='inside'?`inside ${this.name(drop.target)}`:`${drop.position} ${this.name(drop.target)}`;
    this.message=s.plan?.reason??`Move ${this.view!.name} ${destination}.${s.pointer===undefined?' Enter to drop; Escape to cancel.':''}`;
    if(drop.position==='inside'&&drop.target&&!s.plan?.reason&&this.options.collapsed().includes(drop.target)){
      const id=drop.target;this.expandTimer=setTimeout(()=>{if(this.session===s){s.expanded.push(id);this.options.fold(id,false);}},600);
    }
    if(s.pointer===undefined){const target=drop.target?this.options.root()?.querySelector<HTMLElement>(`[data-layer-row="${CSS.escape(drop.target)}"]`):this.options.root()?.querySelector<HTMLElement>('[data-layer-root]');target?.scrollIntoView({block:'nearest'});}
  }
  private scroll=(time:number)=>{
    const s=this.session,list=this.options.list();if(!s?.active||s.pointer===undefined||!list)return;
    const box=list.getBoundingClientRect();let delta=0;
    if(s.x>=box.left&&s.x<=box.right&&s.y>=box.top-24&&s.y<=box.bottom+24){
      const zone=Math.min(40,box.height/4);delta=s.y<box.top+zone?-Math.min(12,(box.top+zone-s.y)*.3):s.y>box.bottom-zone?Math.min(12,(s.y-box.bottom+zone)*.3):0;
    }
    const direction=Math.sign(delta);if(direction!==this.scrollDirection){this.scrollDirection=direction;this.scrollStarted=time;}
    // Give a quick drop priority over scrolling, especially in short touch lists.
    if(direction&&time-this.scrollStarted>=180){const before=list.scrollTop;list.scrollTop+=delta;if(list.scrollTop!==before)this.hit();}
    this.frame=requestAnimationFrame(this.scroll);
  };
  key(event:KeyboardEvent,id:string){
    if(event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey)return;
    if(!this.session){if(![' ','Enter'].includes(event.key)||event.repeat)return;event.preventDefault();event.stopPropagation();this.start(id,event.currentTarget as HTMLElement);if(this.session){this.activate();this.slot({target:id,position:'before'});}return;}
    const s=this.session;if(s.pointer!==undefined)return;
    if(![' ','Enter','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Tab'].includes(event.key))return;
    if(event.key==='Tab'){this.cancel();return;}
    event.preventDefault();event.stopPropagation();if(event.key==='Escape'){this.cancel();return;}
    if(event.key===' '||event.key==='Enter'){if(!event.repeat)void this.drop();return;}
    const rows=this.options.rows().filter(row=>!s.ids.some(id=>row.id===id||s.tree.ancestors(row.id).includes(id))),index=rows.findIndex(row=>row.id===s.cursor);
    if(event.key==='ArrowRight'){if(s.cursor&&s.tree.groupById.has(s.cursor))this.slot({target:s.cursor,position:'inside'});return;}
    if(event.key==='ArrowLeft'){
      const at=s.drop?.position==='inside'?s.drop.target:s.drop?.target?s.tree.elements.get(s.drop.target)?.group??s.tree.groupById.get(s.drop.target)?.parent:s.tree.elements.get(s.source)?.group??s.tree.groupById.get(s.source)?.parent;
      this.slot({target:at?s.tree.groupById.get(at)?.parent??null:null,position:'inside'});return;
    }
    let next=index+(event.key==='ArrowDown'?1:-1);
    if(index<0&&s.cursor!==null){const original=this.options.rows(),start=original.findIndex(row=>row.id===s.source);const anchor=event.key==='ArrowDown'?original.slice(start+1).find(row=>rows.some(v=>v.id===row.id)):[...original.slice(0,start)].reverse().find(row=>rows.some(v=>v.id===row.id));next=anchor?rows.findIndex(row=>row.id===anchor.id):-1;}
    if(event.key==='Home')next=-1;else if(event.key==='End')next=rows.length-1;
    if(next<0)this.slot({target:null,position:'inside'});
    else if(rows.length)this.slot({target:rows[Math.min(next,rows.length-1)].id,position:event.key==='ArrowUp'?'before':'after'});
  }
  private async drop(){
    const s=this.session;if(!s)return;
    if(!s.drop||s.plan?.reason){const message=s.plan?.reason??'Choose a destination before dropping.';if(s.pointer!==undefined)this.cancel(false);this.message=message;return;}
    const drop=s.drop,name=this.view!.name;this.cleanup();
    if(!s.plan?.operations.length){this.message='Position unchanged.';return;}
    const changed=await editor.moveLayers(s.ids,drop,s.revision,s.slideId,s.deckId);
    this.message=changed?`Moved ${name} ${drop.position==='inside'?'inside':drop.position} ${this.name(drop.target,s)}.`:editor.error||'Position unchanged.';
    // The owning container may have disappeared. Focus follows the moved object.
    if(changed)requestAnimationFrame(()=>this.options.root()?.querySelector<HTMLElement>(`[data-layer-row="${CSS.escape(s.ids[0])}"] .layer-grip`)?.focus({preventScroll:true}));
  }
  check(){const s=this.session;if(s&&(this.options.disabled()||editor.sourceMode||editor.deck?.id!==s.deckId||editor.deck?.revision!==s.revision||editor.activeId!==s.slideId))this.cancel();}
  focusOut(event:FocusEvent){if(this.session?.pointer===undefined&&this.session&&event.relatedTarget&&!this.session.handle.contains(event.relatedTarget as Node))this.cancel();}
  private escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&this.session){event.preventDefault();event.stopPropagation();this.cancel();}};
  cancel(announce=true){const s=this.session;if(!s)return;for(const id of s.expanded)this.options.fold(id,true);this.cleanup();if(announce)this.message='Move cancelled.';}
  private cleanup(){
    const s=this.session;this.session=undefined;this.view=undefined;cancelAnimationFrame(this.frame);this.scrollDirection=0;clearTimeout(this.expandTimer);this.releaseCursor?.();this.releaseCursor=undefined;document.removeEventListener('keydown',this.escape,true);
    this.visibilityObserver?.disconnect();this.visibilityObserver=undefined;
    if(s?.pointer!==undefined&&s.handle.hasPointerCapture(s.pointer))s.handle.releasePointerCapture(s.pointer);
  }
}
