<script lang="ts">
  import {editor} from './core/editor.svelte';
  import {slideLabel} from './core/slide-label';
  import {flip} from 'svelte/animate';
  import {uiCurrentSlide,uiPresence,reducedUI} from './ui-motion';
  import {Eye,EyeOff,Check,Plus,Copy,MoveUp,MoveDown,Trash2,Ellipsis,SquareDashedMousePointer,GripVertical} from '@lucide/svelte';
  import Button from './components/ui/Button.svelte';
  import ActionMenu from './components/ui/ActionMenu.svelte';
  import SlideThumbnail from './components/SlideThumbnail.svelte';
  import {slideClipboardActions} from './editor-clipboard';
  import {beginSlideSelection,endSlideSelection,selectedSlideActions,focusCurrentSlide} from './slide-selection-actions';
  import {slideSelectionDrag} from './slide-rail-drag';
  let touchDrop=$state(''),touchAfter=$state(false),touchMoving=$state(false);
  let {proposalDeck,viewportWidth,leftWidth,draggedSlide,draggedSlides,dropSlide,dropAfter,onDragStart,slideDragOver,onDragLeave,slideDrop,onDragEnd,toggleSlideHidden,setSelectedSlidesHidden,onAdd,duplicateSlide,slideOrder}: {
    proposalDeck:boolean;viewportWidth:number;leftWidth:number;draggedSlide:string;draggedSlides:string[];dropSlide:string;dropAfter:boolean;
    onDragStart:(event:DragEvent,id:string)=>void;slideDragOver:(event:DragEvent,id:string)=>void;onDragLeave:(event:DragEvent)=>void;slideDrop:(event:DragEvent,id:string)=>void;onDragEnd:()=>void;
    toggleSlideHidden:()=>void;setSelectedSlidesHidden:(hidden:boolean)=>void;onAdd:()=>void;duplicateSlide:()=>void;slideOrder:(step:number)=>void;
  }=$props();
  let shownDrop=$derived(touchMoving?touchDrop:dropSlide),shownAfter=$derived(touchMoving?touchAfter:dropAfter);


  let selectedSlideIds=$derived(new Set(editor.selectedSlides));
  let selectedSlidePages=$derived(editor.deck?.slides.filter(slide=>selectedSlideIds.has(slide.id))??[]);
  let slideSelecting=$derived(editor.selectingSlides);
  let hiddenSlideCount=$derived(editor.deck?.slides.filter(slide=>slide.hidden).length??0);
  let activeIndex=$derived(editor.deck?.slides.findIndex(slide=>slide.id===editor.activeId)??0);
  function slideActions(){return slideSelecting?selectedSlideActions(setSelectedSlidesHidden):[
    {label:editor.slide?.hidden?'Unhide slide':'Hide slide',icon:editor.slide?.hidden?Eye:EyeOff,shortcut:'⇧⌘H',onselect:()=>toggleSlideHidden()},
    {label:'Select slides',icon:SquareDashedMousePointer,onselect:beginSlideSelection},
    {label:'Select all slides',shortcut:'⌘A',onselect:()=>editor.selectAllSlides()},
    ...slideClipboardActions(editor.activeId),
    {label:'Duplicate current slide',icon:Copy,onselect:duplicateSlide},
    {label:'Move earlier',icon:MoveUp,disabled:activeIndex<1,onselect:()=>slideOrder(-1)},
    {label:'Move later',icon:MoveDown,disabled:activeIndex>=(editor.deck?.slides.length||1)-1,onselect:()=>slideOrder(1)},
    {label:'Delete current slide',icon:Trash2,divider:true,disabled:(editor.deck?.slides.length||0)<2,onselect:()=>editor.slide&&editor.commit([{op:'delete_slide',slideId:editor.slide.id}])},
  ];}
  function slideKey(event: KeyboardEvent) {
    if(event.defaultPrevented||event.isComposing||event.keyCode===229)return;
    if(event.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();if(!proposalDeck){editor.moveSlides(editor.selectedSlides,event.key==='Home'?'start':event.key==='End'?'end':['ArrowLeft','ArrowUp'].includes(event.key)?'earlier':'later');focusCurrentSlide();}return;}
    if(event.altKey)return;
    const button=event.currentTarget as HTMLButtonElement,cmd=event.ctrlKey||event.metaKey;
    const id=button.dataset.slideId!;
    if(cmd&&event.key.toLowerCase()==='a') {event.preventDefault();event.stopPropagation();if(!proposalDeck)editor.selectAllSlides();return;}
    if(event.key==='Escape'&&slideSelecting){event.preventDefault();event.stopPropagation();endSlideSelection();return;}
    if(event.key===' '){event.preventDefault();event.stopPropagation();if(!proposalDeck&&!event.repeat)editor.selectSlide(id,{toggle:true,range:event.shiftKey});return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const slides=[...button.parentElement!.querySelectorAll<HTMLButtonElement>('.slide-thumb')],index=slides.indexOf(button);
    event.preventDefault();event.stopPropagation();
    const next=slides[event.key==='Home'?0:event.key==='End'?slides.length-1:Math.max(0,Math.min(slides.length-1,index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)))];
    if(next){editor.selectSlide(next.dataset.slideId!,{range:!proposalDeck&&event.shiftKey,additive:cmd,focusOnly:!event.shiftKey&&(cmd||editor.slideSelectionMode)});next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
</script>
        <div class="rail-head"><span>Slides <small>{editor.deck?.slides.length ?? 0}</small></span>{#if hiddenSlideCount}<small class="rail-hidden-count">{hiddenSlideCount} hidden</small>{/if}</div>
        {#if slideSelecting}<div class="slide-selection-status" class:narrow-rail={leftWidth<180&&viewportWidth>1100}><span role="status" aria-live="polite" aria-atomic="true">{touchMoving||draggedSlide?'Moving ':''}{selectedSlidePages.length}{touchMoving||draggedSlide?' slides':' selected'}</span><div class="slide-selection-grip" use:slideSelectionDrag={{start:()=>!proposalDeck&&editor.deck&&selectedSlidePages.length?{ids:[...editor.selectedSlides],deckId:editor.deck.id,revision:editor.deck.revision}:undefined,preview:(target,after,moving)=>{touchDrop=target;touchAfter=after;touchMoving=moving;},drop:(snapshot,target,after)=>{if(!proposalDeck&&editor.deck?.id===snapshot.deckId){editor.dropSlides(snapshot.ids,target,after,snapshot.revision);focusCurrentSlide();}}}}><Button kind="icon" aria-label="Drag selected slides to reorder" title="Drag selected slides to reorder" disabled={!selectedSlidePages.length||proposalDeck} onkeydown={slideKey}><GripVertical size={16}/></Button></div><Button kind="text" aria-label="Done selecting slides" onclick={endSlideSelection}>Done</Button></div>{/if}
        <div class="slide-list" role="listbox" aria-label="Slides" aria-multiselectable="true" aria-orientation={viewportWidth<=1100?'horizontal':'vertical'} use:uiCurrentSlide={editor.slide?.id}>{#each editor.deck?.slides ?? [] as slide, i (slide.id)}<button class="slide-thumb" role="option" aria-selected={selectedSlideIds.has(slide.id)} class:slide-selected={slideSelecting&&selectedSlideIds.has(slide.id)} data-slide-id={slide.id} draggable={!proposalDeck} class:dragging={draggedSlides.includes(slide.id)||touchMoving&&selectedSlideIds.has(slide.id)} class:drop-before={shownDrop===slide.id&&!shownAfter} class:drop-after={shownDrop===slide.id&&shownAfter} ondragstart={event=>onDragStart(event,slide.id)} ondragover={event=>slideDragOver(event,slide.id)} ondragleave={onDragLeave} ondrop={event=>slideDrop(event,slide.id)} ondragend={onDragEnd} animate:flip={{duration: reducedUI() ? 0 : 220}} in:uiPresence={{y: 4}} class:current={slide.id === editor.slide?.id} class:hidden-slide={slide.hidden} onpointerdown={event=>{if(event.button===2)event.preventDefault();}} onclick={event => editor.selectSlide(slide.id,proposalDeck?{}:{toggle:event.metaKey||event.ctrlKey,range:event.shiftKey,additive:event.metaKey||event.ctrlKey})} onkeydown={slideKey} tabindex={slide.id === editor.slide?.id ? 0 : -1} aria-describedby="slide-rail-help" aria-label={`${slideLabel(i)}${slide.hidden?' · Hidden from presentation':''}`} aria-current={slide.id === editor.slide?.id ? 'page' : undefined}><span class="sr-only">Slide </span><span class="thumb-number">{String(i + 1).padStart(2, '0')}</span><div class="thumb-image" aria-hidden="true"><SlideThumbnail deck={editor.deck!} {slide} active={slide.id === editor.slide?.id} original={editor.sourceMode} /></div>{#if slideSelecting}<span class="thumb-selection-mark" aria-hidden="true">{#if selectedSlideIds.has(slide.id)}<Check size={12}/>{/if}</span>{/if}{#if slide.hidden}<span class="thumb-hidden-mark" aria-hidden="true"><EyeOff size={14}/></span>{/if}</button>{/each}</div>
        <div class="rail-foot rail-actions" role="group" aria-label="Slide actions"><button class="text-btn full" disabled={!editor.deck||Boolean(proposalDeck)} aria-label="Add slide" title="Add slide" onclick={onAdd}><Plus /><span>{leftWidth<160?'Add':'Add slide'}</span></button><ActionMenu label={slideSelecting?'Selected slide actions':'Current slide actions'} iconOnly disabled={!editor.slide||Boolean(proposalDeck)} items={slideActions()}><Ellipsis size={16} /></ActionMenu></div>
