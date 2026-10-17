<script lang="ts">
  import {getContext,onDestroy} from 'svelte';
  import type ColorPopover from './ColorPopover.svelte';
  import type {Editor} from '../../core/editor.svelte';
  let {label,value,mixed=false,disabled=false,framed=false,opaque=false,descriptionId,oninput,onchange,roles=[],roleValue='',onrole}: {
    label:string;value:string;mixed?:boolean;disabled?:boolean;framed?:boolean;opaque?:boolean;descriptionId?:string;
    roles?:{value:string;label:string;color?:string}[];roleValue?:string;onrole?:(role:string)=>void;
    oninput?:(value:string)=>void;onchange?:(value:string)=>void;
  }=$props();
  let Picker=$state<typeof ColorPopover>(),trigger=$state<HTMLButtonElement>(),open=$state(false),loading=$state(false),failed=$state(false),disposed=false,request=0;
  const id=$props.id(),scope=getContext<()=>string|undefined>('property-edit-scope'),editor=getContext<Editor|undefined>('numeric-editor');
  const readScope=()=>scope?.()??`${editor?.deck?.id}:${editor?.activeId}:${editor?.selected.join(',')}`;
  let origin=readScope();
  $effect(()=>{const next=readScope();if(disabled||next!==origin){open=false;request++;loading=false;}origin=next;});
  $effect(()=>{if(!loading)return;const cancel=(event:Event)=>{if(event.target instanceof Node&&!trigger?.contains(event.target)){request++;loading=false;}};document.addEventListener('pointerdown',cancel,true);document.addEventListener('focusin',cancel);return()=>{document.removeEventListener('pointerdown',cancel,true);document.removeEventListener('focusin',cancel);};});
  async function toggle(){
    if(disabled)return;
    trigger?.focus({preventScroll:true});
    if(loading){request++;loading=false;return;}
    if(Picker){open=!open;return;}
    const token=++request;loading=true;failed=false;
    try{const module=await import('./ColorPopover.svelte');if(!disposed&&token===request){Picker=module.default;open=document.activeElement===trigger;}}
    catch{if(!disposed&&token===request)failed=true;}
    finally{if(token===request)loading=false;}
  }
  export function openPicker(){if(!disabled&&!open&&!loading)void toggle();}
  function key(event:KeyboardEvent){if(event.key==='Escape'&&loading){event.preventDefault();event.stopPropagation();request++;loading=false;}}
  onDestroy(()=>{disposed=true;request++;});
</script>
<button bind:this={trigger} type="button" class="color-picker" class:framed {disabled} aria-label={label} aria-describedby={descriptionId} aria-haspopup="dialog" aria-expanded={open} aria-busy={loading} title={label} onclick={toggle} onkeydown={key}>
  <span class="color-preview" class:empty={value==='transparent'||mixed} style:--property-color={value} aria-hidden="true"></span>
</button>
{#if Picker&&trigger}<Picker anchor={trigger} {label} {value} {mixed} {opaque} bind:open {oninput} {onchange} {roles} {roleValue} {onrole}/>{/if}
{#if failed}<span id={`${id}-error`} role="status" class="color-picker-load-error">Color picker could not load. Refresh the app.</span>{/if}
