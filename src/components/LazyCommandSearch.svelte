<script lang="ts">
  import {tick} from 'svelte';
  import {Search} from '@lucide/svelte';
  import Button from './ui/Button.svelte';
  import type {SearchAction} from '../search-actions';
  let {actions,onexpand,class:className=''}:{actions:SearchAction[];onexpand:(query:string)=>void;class?:string}=$props();
  let View=$state<typeof import('./ui/CommandSearch.svelte')['default']>();
  let handle=$state<{toggle:()=>void;close:()=>void}>(),loading=$state(false),requested=false;
  export function close(){requested=false;handle?.close();}
  export function toggle(){
    if(handle){handle.toggle();return;}
    requested=!requested;if(loading||!requested)return;
    loading=true;void import('./ui/CommandSearch.svelte').then(async (module)=>{View=module.default;await tick();if(requested){requested=false;handle?.toggle();}}).catch(()=>{requested=false;}).finally(()=>loading=false);
  }
</script>
{#if View}<View bind:this={handle} {actions} {onexpand} class={className}/>{:else}
  <div class="ui-command-trigger {className}"><Button kind="icon" aria-label="Search" title="Search · ⌘K" aria-haspopup="dialog" aria-expanded="false" aria-busy={loading} onclick={toggle} onkeydown={event=>{if(event.key==='ArrowDown'&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();if(!requested)toggle();}}}><Search size={16} aria-hidden="true"/></Button></div>
{/if}
