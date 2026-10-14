<script lang="ts">
  import type {Component,Snippet} from 'svelte';
  import {ChevronDown} from '@lucide/svelte';
  import {uiDisclosure} from '../ui-motion';
  let {title, icon:Icon, label=`${title} properties`, open=$bindable(true), children}: {title:string;icon?:Component<any>;label?:string;open?:boolean;children:Snippet}=$props();
</script>

<details class="panel-section inspector-section" aria-label={label} bind:open use:uiDisclosure={next=>open=next}>
  <summary><h3>{#if Icon}<Icon size={16} aria-hidden="true"/>{/if}<span>{title}</span></h3><ChevronDown class="section-chevron" size={14} aria-hidden="true"/></summary>
  <div class="section-body">{@render children()}</div>
</details>

<style>
  details{display:block;padding:12px;min-width:0;container-type:inline-size}
  summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;list-style:none;cursor:pointer;border-radius:var(--r-sm)}
  summary::-webkit-details-marker{display:none}
  h3{display:flex;align-items:center;gap:8px;min-width:0;margin:0;font-size:var(--ui-label);line-height:var(--ui-line-body)}
  summary :global(svg){flex:none;color:var(--text-secondary)}
  details[open]>summary :global(.section-chevron){rotate:180deg}
  summary:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}
  .section-body{display:flex;flex-direction:column;gap:8px;min-width:0;padding-top:8px}
  @media(hover:hover) and (pointer:fine){summary:hover{background:var(--state-hover)}}
  @media(max-width:760px),(pointer:coarse){summary{min-height:44px}}
</style>
