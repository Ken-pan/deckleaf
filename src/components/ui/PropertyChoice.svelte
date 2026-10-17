<script lang="ts">
  import type { Component } from 'svelte';
  type Option = {value:string;label:string;icon?:Component<any>;description?:string;disabled?:boolean};
  let {label,options,value='',disabled=false,icons=false,onchange}: {label:string;options:readonly Option[];value?:string;disabled?:boolean;icons?:boolean;onchange:(value:string)=>void}=$props();
  const id=$props.id();
  const first=$derived(options.find(option=>!option.disabled)?.value);
  function choose(next:string){if(!disabled&&next!==value)onchange(next);}
  function key(event:KeyboardEvent,index:number){
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.isComposing||event.keyCode===229||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const available=options.map((option,i)=>({option,i})).filter(({option})=>!option.disabled);
    if(disabled||!available.length)return;
    event.preventDefault();event.stopPropagation();
    const at=available.findIndex(item=>item.i===index),next=event.key==='Home'?available[0]:event.key==='End'?available.at(-1)!:available[(at+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+available.length)%available.length];
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button')[next.i]?.focus();
    choose(next.option.value);
  }
</script>
<div class="property-choice" class:icon-choices={icons} role="radiogroup" aria-label={label} aria-disabled={disabled}>
  {#each options as option,index}<button type="button" role="radio" aria-checked={value===option.value} aria-label={option.label} aria-describedby={option.description?`${id}-${index}-help`:undefined} disabled={disabled||option.disabled} tabindex={(options.some(o=>o.value===value&&!o.disabled)?value===option.value:option.value===first)?0:-1} onclick={()=>choose(option.value)} onkeydown={event=>key(event,index)}>
    {#if option.icon}<option.icon size={16} aria-hidden="true" />{/if}<span>{option.label}</span>
  </button>{#if option.description}<span id={`${id}-${index}-help`} class="sr-only">{option.description}</span>{/if}{/each}
</div>
<style>
  .property-choice{display:flex;align-items:stretch;flex-wrap:wrap;gap:2px;padding:2px;border-radius:var(--r-control);background:var(--field-surface);min-width:0}
  button{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 1 auto;min-width:min-content;min-height:var(--property-choice-height,32px);padding:4px 8px;border:0;border-radius:var(--r-sm);background:transparent;color:var(--text-secondary);font:inherit;font-size:var(--ui-label);line-height:var(--ui-line-body);cursor:pointer}
  button :global(svg){flex:none}
  button[aria-checked='true']{background:var(--state-selected);color:var(--text-link)}
  button:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}
  button:disabled{cursor:default}
  @media(hover:hover) and (pointer:fine){
    button:not(:disabled):hover{background:var(--state-hover)}
    button[aria-checked='true']:not(:disabled):hover{background:var(--state-selected-hover)}
  }
  button:not(:disabled):active{background:var(--state-active)}
  button[aria-checked='true']:not(:disabled):active{background:var(--state-selected-active)}
  .icon-choices button{flex:1;min-width:32px;padding:6px}
  .icon-choices button>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  @media(max-width:760px),(pointer:coarse){button{min-height:44px}.icon-choices button{flex-direction:column;min-width:44px;gap:2px;padding:4px}.icon-choices button>span{position:static;width:auto;height:auto;overflow:visible;clip-path:none;white-space:normal;font-size:var(--ui-meta);line-height:var(--ui-line-control)}}
  @media(forced-colors:active){button[aria-checked='true']{outline:1px solid Highlight;outline-offset:-2px}}
</style>
