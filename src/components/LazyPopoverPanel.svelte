<script lang="ts">
  import {onMount,onDestroy,tick,type ComponentProps} from 'svelte';
  import {ChevronDown} from '@lucide/svelte';
  import type Panel from './ui/PopoverPanel.svelte';
  import Button from './ui/Button.svelte';
  import {restoreFocus} from '../ui-focus';
  type Props=ComponentProps<typeof Panel>&{onerror:(message:string)=>void};
  const generatedId=$props.id();
  let {open=$bindable(false),onerror,id=generatedId,...props}:Props=$props();
  let View=$state<typeof Panel>();
  let instance=$state<{show:()=>void;close:()=>void;toggle:()=>void}>();
  let placeholder=$state<HTMLDivElement>();
  let requested=$state(false),disposed=false,request:Promise<void>|undefined;
  let invoker:HTMLElement|null=null;
  const trigger=()=>document.getElementById(id)?.previousElementSibling?.querySelector<HTMLButtonElement>('button');
  function prepare(){
    return request??=import('./ui/PopoverPanel.svelte').then(async (module)=>{
      if(disposed)return;
      const focused=placeholder?.contains(document.activeElement);
      View=module.default;await tick();if(disposed)return;
      if(focused&&document.activeElement===document.body)trigger()?.focus({preventScroll:true});
      if(requested){requested=false;instance?.show();}
    }).catch(()=>{
      request=undefined;
      if(!disposed&&requested){requested=false;onerror(`${props.title} could not open. Try again.`);restoreFocus(invoker);}
    });
  }
  export function show(){if(props.disabled)return;if(instance){instance.show();return;}requested=true;invoker=document.activeElement as HTMLElement;void prepare();}
  export function close(){requested=false;instance?.close();}
  export function toggle(){if(instance){instance.toggle();return;}if(requested)close();else show();}
  function cancel(event:KeyboardEvent){if(!requested||instance||event.key!=='Escape'||event.isComposing)return;event.preventDefault();event.stopPropagation();close();restoreFocus(invoker);}
  function outside(event:PointerEvent){const target=event.target as Node;if(requested&&!instance&&!placeholder?.contains(target)&&!(invoker?.matches('button,a')&&invoker.contains(target)))close();}
  onMount(()=>{void prepare();document.addEventListener('keydown',cancel,true);document.addEventListener('pointerdown',outside,true);return()=>{document.removeEventListener('keydown',cancel,true);document.removeEventListener('pointerdown',outside,true);};});
  onDestroy(()=>{disposed=true;requested=false;});
</script>
{#if View}<View {...props} {id} bind:open bind:this={instance}/>
{:else if props.trigger}<div class="ui-panel-trigger" bind:this={placeholder}>
  <Button disabled={props.disabled} kind={props.iconOnly?'icon':'text'} aria-label={props.triggerLabel??props.title} title={props.title} aria-haspopup="dialog" aria-controls={id} aria-expanded={requested} aria-busy={requested||undefined} onclick={toggle} onkeydown={event=>{if(!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key==='ArrowDown'){event.preventDefault();show();}}}>
    {@render props.trigger()}{#if !props.iconOnly}<ChevronDown data-ui-marker size={14} aria-hidden="true"/>{/if}
  </Button>
</div>{/if}
