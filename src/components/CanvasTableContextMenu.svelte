<script lang="ts">
  import {onMount,tick} from 'svelte';
  import {positionFloating} from '../ui-viewport';
  import {popoverFocus} from '../ui-focus';
  let {anchor,items,onclose}:{anchor:HTMLElement;items:{label:string;disabled?:boolean;divider?:boolean;tone?:string;shortcut?:string;onselect:()=>void}[];onclose:()=>void}=$props();
  let popup=$state<HTMLDivElement>();
  const buttons=()=>Array.from(popup?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
  function position(){if(popup)positionFloating(popup,anchor.getBoundingClientRect(),{preferredHeight:popup.scrollHeight});}
  onMount(()=>{popup!.showPopover();void tick().then(()=>{position();buttons()[0]?.focus({preventScroll:true});});window.addEventListener('resize',position);window.addEventListener('scroll',position,true);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);return()=>{popup?.hidePopover();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);};});
</script>
<div bind:this={popup} popover="auto" role="menu" tabindex="-1" aria-label="Cell actions" class="ui-action-menu" use:popoverFocus={{close:onclose,origin:()=>anchor}} onbeforetoggle={e=>{if(e.newState==='closed')onclose();}} onkeydown={e=>{if(e.defaultPrevented||e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const invoker=anchor;onclose();invoker?.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const nodes=buttons(),at=nodes.indexOf(e.target as HTMLButtonElement);nodes[e.key==='Home'?0:e.key==='End'?nodes.length-1:(at+(e.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length]?.focus();}}}>
{#each items as item}{#if item.divider}<div class="ui-menu-divider" role="separator"></div>{/if}<button role="menuitem" tabindex="-1" disabled={item.disabled} data-tone={item.tone} onclick={()=>{const invoker=anchor;onclose();invoker?.focus({preventScroll:true});item.onselect();}}><span>{item.label}</span>{#if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}</button>{/each}
</div>
