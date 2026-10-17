<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ArrowLeft, Check, ChevronRight } from '@lucide/svelte';
  import { registeredContext, type ContextActions, type ContextMenuItem, type ContextRequest } from '../../context-menu';
  import { visualBounds } from '../../ui-viewport';
  import { contextMenuPlacement, contextSubmenuPlacement } from '../../context-menu-viewport';
  import { restoreFocus,popoverFocus } from '../../ui-focus';
  let {resolve, contextKey, onerror, allowRegistered=true}: {resolve:(request:ContextRequest)=>ContextActions|undefined|Promise<ContextActions|undefined>; contextKey:string; onerror:(message:string)=>void;allowRegistered?:boolean} = $props();
  const id=$props.id();
  let host: HTMLDivElement, menu: HTMLDivElement;
  let panels=$state<HTMLDivElement[]>([]);
  let open = $state(false), actions = $state<ContextActions>(), path = $state<ContextMenuItem[]>([]), cascade=$state(true);
  let items = $derived(cascade?actions?.items??[]:path.at(-1)?.children??actions?.items??[]);
  let origin: HTMLElement | undefined, point = {x:0,y:0}, openedKey = '', serial = 0;
  let pending: (()=>void) | undefined, timer: ReturnType<typeof setTimeout> | undefined, hoverTimer:ReturnType<typeof setTimeout>|undefined;
  let search = '', searchedAt = 0;
  const panelAt=(level:number)=>cascade&&level?panels[level-1]:menu;
  const controls = (level=cascade?0:path.length) => [...(panelAt(level)?.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)')??[])];
  const clearHover=()=>{clearTimeout(hoverTimer);};
  function hideChildren(from=0){for(const panel of panels.slice(from).reverse())if(panel?.matches(':popover-open'))panel.hidePopover();}
  export function openAt(request:ContextRequest) {void show(request).catch(()=>onerror('The context menu could not load. Refresh and try again.'));}
  async function position() {
    if(!open)return;
    const viewport=visualBounds();menu.style.maxWidth=`${Math.max(1,viewport.width-24)}px`;
    const placed=contextMenuPlacement(point,{width:menu.offsetWidth,height:menu.scrollHeight+2},viewport);
    menu.style.maxHeight=`${placed.maxHeight}px`;menu.style.left=`${placed.left}px`;menu.style.top=`${placed.top}px`;menu.dataset.uiPlacement=placed.placement;
    if(!cascade)return;
    let side:'left'|'right'='right';
    for(let level=0;level<path.length;level++){
      const panel=panels[level],parent=panelAt(level),trigger=controls(level).find(button=>button.dataset.label===path[level].label);
      if(!panel||!trigger||!parent)break;
      if(!panel.matches(':popover-open'))panel.showPopover();
      const parentBox=parent.getBoundingClientRect(),row=trigger.getBoundingClientRect();
      if(row.bottom<=parentBox.top||row.top>=parentBox.bottom){hideChildren(level);path=path.slice(0,level);return;}
      const child=contextSubmenuPlacement({left:parentBox.left,right:parentBox.right,top:row.top},{width:panel.offsetWidth,height:panel.scrollHeight+2},viewport,side);
      if(!child){hideChildren();cascade=false;await tick();void position();return;}
      panel.style.left=`${child.left}px`;panel.style.top=`${child.top}px`;panel.style.maxHeight=`${child.maxHeight}px`;panel.dataset.uiPlacement=child.side;side=child.side;
    }
  }
  export function close(restore = false) {
    pending = undefined; clearTimeout(timer);clearHover();serial++;
    hideChildren();
    if (menu?.matches(':popover-open')) menu.hidePopover();
    open = false; path = [];
    if (restore) {restoreFocus(origin); actions?.restore?.();}
    if (host && menu && menu.parentElement !== host) host.append(menu);
  }
  $effect(() => { if (open && contextKey !== openedKey) close(); });
  async function show(request: ContextRequest) {
    close();
    const token = ++serial;
    origin = request.target.closest<HTMLElement>('button,a,input,textarea,select,[contenteditable="true"],[tabindex]') ?? document.activeElement as HTMLElement;
    const resolved = await (!allowRegistered||request.target.closest('a,input,textarea,select,[contenteditable="true"]') ? resolve(request) : registeredContext(request.target) ?? resolve(request));
    if(token!==serial||!resolved?.items.length)return;
    origin = resolved.returnFocus ?? origin;
    actions = resolved; path = []; point = request;cascade=visualBounds().width>760;
    await tick();
    if (token !== serial || !request.target.isConnected) return;
    openedKey = contextKey;
    // Descendant manual popovers stay in the root's native focus/inert boundary.
    (request.target.closest('dialog:modal,[popover]:popover-open') ?? host).append(menu);
    menu.showPopover(); open = true; search = ''; await position();
    await tick(); if (token === serial && open) (controls()[0] ?? menu).focus({preventScroll:true});
  }
  function request(event: MouseEvent | KeyboardEvent) {
    if (!(event.target instanceof HTMLElement || event.target instanceof SVGElement)) return;
    const target = event.target instanceof HTMLElement ? event.target : event.target.parentElement;
    if (!target||target.closest('.canvas-cell-grid')) return;
    event.preventDefault(); event.stopPropagation();
    if (menu.contains(target) && open) return;
    const keyboard = event instanceof KeyboardEvent || event instanceof MouseEvent && event.button === 0 && !event.clientX && !event.clientY;
    const rect = target.getBoundingClientRect();
    const payload = {target, keyboard, x:keyboard ? rect.left + Math.min(rect.width/2,24) : (event as MouseEvent).clientX, y:keyboard ? rect.bottom : (event as MouseEvent).clientY};
    pending = undefined; clearTimeout(timer);
    if (event instanceof MouseEvent && event.buttons) {
      pending = () => openAt(payload); timer = setTimeout(release, 350);
    } else timer = setTimeout(() => openAt(payload), 0);
  }
  function release() { const next = pending; pending = undefined; clearTimeout(timer); next?.(); }
  async function enter(item: ContextMenuItem,level:number,focus=true) {
    clearHover();if(!open||item.disabled||!item.children)return;
    if(path[level]!==item){hideChildren(level);path=[...path.slice(0,level),item];}
    search='';await tick();await position();
    if(open&&focus)(controls(level+1)[cascade?0:1]??controls(level+1)[0])?.focus({preventScroll:true});
  }
  async function back(level:number) {
    clearHover();const label=path[level-1]?.label;hideChildren(level-1);path=path.slice(0,level-1);
    await tick();await position();(controls(level-1).find(button=>button.dataset.label===label)??controls(level-1)[0])?.focus({preventScroll:true});
  }
  function hover(item:ContextMenuItem,level:number,event:PointerEvent){
    clearHover();if(!cascade||event.pointerType!=='mouse'||item.disabled)return;
    hoverTimer=setTimeout(()=>{if(!open)return;if(item.children)void enter(item,level,false);else {hideChildren(level);path=path.slice(0,level);}},160);
  }
  function select(item: ContextMenuItem,level:number) {
    if (item.disabled) return;
    if (item.children) {void enter(item,level);return;}
    const action=item.onselect;close(true);
    try { Promise.resolve(action?.()).catch(error => onerror(error instanceof Error ? error.message : 'The action could not be completed.')); }
    catch (error) {onerror(error instanceof Error ? error.message : 'The action could not be completed.');}
  }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode===229 || event.altKey || event.metaKey || event.ctrlKey) return;
    const panel=(event.target as HTMLElement).closest<HTMLElement>('[data-context-panel]');
    if(panel!==event.currentTarget)return;
    const level=Number(panel?.dataset.contextPanel??0),entries=level?path[level-1]?.children??[]:actions?.items??[];
    clearHover();
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(level)void back(level);else if(path.length)void back(path.length);else close(true);return;}
    if(event.key==='Tab'){close(true);return;}
    const buttons=controls(level),index=buttons.indexOf(event.target as HTMLButtonElement);
    if(event.key==='ArrowLeft'&&level){event.preventDefault();event.stopPropagation();void back(level);return;}
    if(event.key==='ArrowRight'){const item=entries.find(item=>item.label===(event.target as HTMLElement).dataset.label);if(item?.children){event.preventDefault();event.stopPropagation();void enter(item,level);}return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();if(cascade&&path.length>level){hideChildren(level);path=path.slice(0,level);}buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();return;}
    if(event.key.length===1&&event.key!==' '){
      const now=performance.now();search=now-searchedAt<700?search+event.key:event.key;searchedAt=now;
      const prefix=[...search].every(letter=>letter===search[0])?search[0]:search;
      const next=[...buttons.slice(index+1),...buttons.slice(0,index+1)].find(button=>button.dataset.label?.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
      if(next){event.preventDefault();event.stopPropagation();next.focus();}
    }
  }
  onMount(() => {
    const context = (event:MouseEvent) => request(event);
    const keyboard = (event:KeyboardEvent) => {if(!event.defaultPrevented&&!event.isComposing&&(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'))request(event);};
    const dismiss = () => close();
    const scroll = (event:Event) => {if(open&&event.target instanceof Node&&!menu.contains(event.target))close();else if(open){clearHover();void position();}};
    const observer=new ResizeObserver(()=>void position());observer.observe(menu);
    document.addEventListener('contextmenu',context,true);document.addEventListener('keydown',keyboard,true);document.addEventListener('pointerup',release,true);
    document.addEventListener('scroll',scroll,true);document.addEventListener('wheel',scroll,{capture:true,passive:true});document.addEventListener('touchmove',scroll,{capture:true,passive:true});window.addEventListener('blur',dismiss);window.addEventListener('resize',dismiss);window.visualViewport?.addEventListener('resize',dismiss);
    return()=>{close();observer.disconnect();document.removeEventListener('contextmenu',context,true);document.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointerup',release,true);document.removeEventListener('scroll',scroll,true);document.removeEventListener('wheel',scroll,true);document.removeEventListener('touchmove',scroll,true);window.removeEventListener('blur',dismiss);window.removeEventListener('resize',dismiss);window.visualViewport?.removeEventListener('resize',dismiss);};
  });
</script>

{#snippet entries(list:ContextMenuItem[],level:number)}
  {#each list as item}
    {#if item.divider}<div class="ui-menu-divider" role="separator"></div>{/if}
    <button type="button" role={item.checked===undefined?'menuitem':item.choice?'menuitemradio':'menuitemcheckbox'} aria-label={item.label} aria-checked={item.checked} aria-haspopup={item.children?'menu':undefined} aria-expanded={item.children?path[level]===item:undefined} aria-controls={item.children&&path[level]===item&&cascade?`${id}-submenu-${level}`:undefined} tabindex="-1" data-label={item.label} data-tone={item.tone} disabled={item.disabled} onpointerenter={event=>hover(item,level,event)} onclick={()=>select(item,level)}>
      {#if item.icon}<item.icon size={16} aria-hidden="true"/>{:else}<span class="ui-context-icon" aria-hidden="true"></span>{/if}<span>{item.label}</span>{#if item.checked}<Check data-ui-marker size={14} aria-hidden="true"/>{/if}{#if item.children}<ChevronRight data-ui-marker size={14} aria-hidden="true"/>{:else if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
    </button>
  {/each}
{/snippet}
<div bind:this={host} class="ui-context-menu-host">
  <div bind:this={menu} use:popoverFocus={{close:()=>close(),origin:()=>origin}} popover="auto" class="ui-action-menu ui-context-menu" data-context-menu data-context-panel={cascade?0:path.length} role="menu" tabindex="-1" aria-label={cascade?actions?.label??'Context menu':path.at(-1)?.label??actions?.label??'Context menu'} inert={!open} onkeydown={key} onpointerenter={clearHover} onbeforetoggle={event=>{open=event.newState==='open';menu.inert=!open;if(!open){clearHover();hideChildren();path=[];}}} ontoggle={event=>{if(event.newState==='closed'&&!open&&!menu.matches(':popover-open')&&menu.parentElement!==host)host.append(menu);}}>
    <div class="ui-context-menu-title">{cascade?actions?.label:path.at(-1)?.label??actions?.label}</div>
    {#if !cascade&&path.length}<button type="button" role="menuitem" tabindex="-1" data-label="Back" onclick={()=>void back(path.length)}><ArrowLeft size={16} aria-hidden="true"/><span>Back</span></button><div class="ui-menu-divider" role="separator"></div>{/if}
    {@render entries(items,cascade?0:path.length)}
    {#each cascade?path:[] as item,index}
      <div bind:this={panels[index]} id={`${id}-submenu-${index}`} popover="manual" class="ui-action-menu ui-context-menu ui-context-submenu" data-context-panel={index+1} role="menu" tabindex="-1" aria-label={item.label} onkeydown={key} onpointerenter={clearHover}>
        {@render entries(item.children??[],index+1)}
      </div>
    {/each}
  </div>
</div>
