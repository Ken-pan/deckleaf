<script lang="ts">
  import {tick} from 'svelte';
  import {Search} from '@lucide/svelte';
  import Button from './ui/Button.svelte';
  import type {SearchAction} from '../search-actions';
  let {actions,onexpand,onprepare,class:className=''}:{actions:SearchAction[];onexpand:(query:string)=>void;onprepare?:()=>Promise<void>;class?:string}=$props();
  let View=$state<typeof import('./ui/CommandSearch.svelte')['default']>();
  let handle=$state<{toggle:()=>void;close:()=>void;focus:()=>void}>(),loading=$state(false),requested=false;
  let host:HTMLDivElement;
  export function close(){requested=false;handle?.close();}
  export function toggle(){
    if(handle){handle.toggle();return;}
    requested=!requested;if(loading||!requested)return;
    loading=true;void Promise.all([import('./ui/CommandSearch.svelte'),onprepare?.()]).then(async ([module])=>{const focused=host.contains(document.activeElement);View=module.default;await tick();if(requested){requested=false;handle?.toggle();}else if(focused&&document.activeElement===document.body)handle?.focus();}).catch(()=>{if(requested)onexpand('');requested=false;}).finally(()=>loading=false);
  }
  function cancel(event:KeyboardEvent){if(!requested||handle||event.isComposing||event.keyCode===229||!['Escape','Tab'].includes(event.key))return;requested=false;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}}
</script>
<svelte:window onkeydowncapture={cancel} onpointerdowncapture={event=>{if(requested&&!event.composedPath().includes(host))requested=false;}}/>
<div bind:this={host} class="ui-command-trigger {className}">
{#if View}<View bind:this={handle} {actions} {onexpand}/>{:else}
  <Button kind="icon" aria-label="Search" title="Search · ⌘K" aria-haspopup="dialog" aria-expanded="false" busy={loading} onclick={toggle} onkeydown={event=>{if(event.key==='ArrowDown'&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();if(!requested)toggle();}}}><Search size={16} aria-hidden="true"/></Button>
{/if}
</div>
