<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ArrowLeft, Check, ChevronRight } from '@lucide/svelte';
  import { registeredContext, type ContextActions, type ContextMenuItem, type ContextRequest } from '../../context-menu';
  import { visualBounds } from '../../ui-viewport';
  import { contextMenuPlacement } from '../../context-menu-viewport';
  import { restoreFocus,popoverFocus } from '../../ui-focus';
  let {resolve, contextKey, onerror, allowRegistered=true}: {resolve:(request:ContextRequest)=>ContextActions|undefined|Promise<ContextActions|undefined>; contextKey:string; onerror:(message:string)=>void;allowRegistered?:boolean} = $props();
  let host: HTMLDivElement, menu: HTMLDivElement;
  let open = $state(false), actions = $state<ContextActions>(), path = $state<ContextMenuItem[]>([]);
  let items = $derived(path.at(-1)?.children ?? actions?.items ?? []);
  let origin: HTMLElement | undefined, point = {x:0,y:0}, openedKey = '', serial = 0;
  let pending: (()=>void) | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let search = '', searchedAt = 0;
  const controls = () => [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  export function openAt(request:ContextRequest) {void show(request).catch(()=>onerror('The context menu could not load. Refresh and try again.'));}
  function position() {
    if(!open)return;
    const viewport=visualBounds();menu.style.maxWidth=`${Math.max(1,viewport.width-24)}px`;
    const placed=contextMenuPlacement(point,{width:menu.offsetWidth,height:menu.scrollHeight+2},viewport);
    menu.style.maxHeight=`${placed.maxHeight}px`;menu.style.left=`${placed.left}px`;menu.style.top=`${placed.top}px`;menu.dataset.uiPlacement=placed.placement;
  }
  export function close(restore = false) {
    pending = undefined; clearTimeout(timer); serial++;
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
    if(token!==serial||!resolved)return;
    origin = resolved.returnFocus ?? origin;
    actions = resolved; path = []; point = request;
    await tick();
    if (token !== serial || !request.target.isConnected) return;
    openedKey = contextKey;
    // A menu opened in a modal must remain inside its native inert boundary.
    (request.target.closest('dialog:modal,[popover]:popover-open') ?? host).append(menu);
    menu.showPopover(); open = true; search = ''; position();
    await tick(); if (token === serial && open) (controls()[0] ?? menu).focus({preventScroll:true});
  }
  function request(event: MouseEvent | KeyboardEvent) {
    if (!(event.target instanceof HTMLElement || event.target instanceof SVGElement)) return;
    const target = event.target instanceof HTMLElement ? event.target : event.target.parentElement;
    if (!target) return;
    event.preventDefault(); event.stopPropagation();
    if (menu.contains(target) && open) return;
    const keyboard = event instanceof KeyboardEvent || event instanceof MouseEvent && event.button === 0 && !event.clientX && !event.clientY;
    const rect = target.getBoundingClientRect();
    const payload = {target, keyboard, x:keyboard ? rect.left + Math.min(rect.width/2,24) : (event as MouseEvent).clientX, y:keyboard ? rect.bottom : (event as MouseEvent).clientY};
    pending = undefined; clearTimeout(timer);
    if (event instanceof MouseEvent && event.buttons) {
      // Opening before right pointer-up can immediately light-dismiss a popover.
      pending = () => openAt(payload); timer = setTimeout(release, 350);
    } else timer = setTimeout(() => openAt(payload), 0);
  }
  function release() { const next = pending; pending = undefined; clearTimeout(timer); next?.(); }
  async function enter(item: ContextMenuItem) {path = [...path,item]; search=''; await tick();position();(controls()[1]??controls()[0])?.focus({preventScroll:true});}
  async function back() { const label=path.at(-1)?.label;path=path.slice(0,-1);await tick();position();(controls().find(button=>button.dataset.label===label)??controls()[0])?.focus({preventScroll:true}); }
  function select(item: ContextMenuItem) {
    if (item.disabled) return;
    if (item.children) {void enter(item);return;}
    const action=item.onselect;close(true);
    try { Promise.resolve(action?.()).catch(error => onerror(error instanceof Error ? error.message : 'The action could not be completed.')); }
    catch (error) {onerror(error instanceof Error ? error.message : 'The action could not be completed.');}
  }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode===229 || event.altKey || event.metaKey || event.ctrlKey) return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(path.length)void back();else close(true);return;}
    if(event.key==='Tab'){close(true);return;}
    const buttons=controls(),index=buttons.indexOf(event.target as HTMLButtonElement);
    if(event.key==='ArrowLeft'&&path.length){event.preventDefault();event.stopPropagation();void back();return;}
    if(event.key==='ArrowRight'){const item=items.find(item=>item.label===(event.target as HTMLElement).dataset.label);if(item?.children){event.preventDefault();event.stopPropagation();void enter(item);}return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();return;}
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
    const scroll = (event:Event) => {if(open&&event.target instanceof Node&&!menu.contains(event.target))close();};
    const observer=new ResizeObserver(position);observer.observe(menu);
    document.addEventListener('contextmenu',context,true);document.addEventListener('keydown',keyboard,true);document.addEventListener('pointerup',release,true);
    document.addEventListener('wheel',scroll,{capture:true,passive:true});document.addEventListener('touchmove',scroll,{capture:true,passive:true});window.addEventListener('blur',dismiss);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
    return()=>{close();observer.disconnect();document.removeEventListener('contextmenu',context,true);document.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointerup',release,true);document.removeEventListener('wheel',scroll,true);document.removeEventListener('touchmove',scroll,true);window.removeEventListener('blur',dismiss);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);};
  });
</script>

<div bind:this={host} class="ui-context-menu-host">
  <div bind:this={menu} use:popoverFocus={{close:()=>close(),origin:()=>origin}} popover="auto" class="ui-action-menu ui-context-menu" data-context-menu role="menu" tabindex="-1" aria-label={path.at(-1)?.label ?? actions?.label ?? 'Context menu'} inert={!open} onkeydown={key} onbeforetoggle={event=>{open=event.newState==='open';menu.inert=!open;}} ontoggle={event=>{if(event.newState==='closed'&&!open&&!menu.matches(':popover-open')&&menu.parentElement!==host)host.append(menu);}}>
    <div class="ui-context-menu-title">{path.at(-1)?.label ?? actions?.label}</div>
    {#if path.length}<button type="button" role="menuitem" tabindex="-1" data-label="Back" onclick={()=>void back()}><ArrowLeft size={16}/><span>Back</span><kbd>←</kbd></button><div class="ui-menu-divider" role="separator"></div>{/if}
    {#each items as item}
      {#if item.divider}<div class="ui-menu-divider" role="separator"></div>{/if}
      <button type="button" role={item.checked===undefined?'menuitem':item.choice?'menuitemradio':'menuitemcheckbox'} aria-label={item.label} aria-checked={item.checked} aria-haspopup={item.children?'menu':undefined} tabindex="-1" data-label={item.label} data-tone={item.tone} disabled={item.disabled} onclick={()=>select(item)}>
        {#if item.icon}<item.icon size={16} aria-hidden="true"/>{:else}<span class="ui-context-icon" aria-hidden="true"></span>{/if}<span>{item.label}</span>{#if item.checked}<Check size={14} aria-hidden="true"/>{/if}{#if item.children}<ChevronRight size={14} aria-hidden="true"/>{:else if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
      </button>
    {/each}
  </div>
</div>
