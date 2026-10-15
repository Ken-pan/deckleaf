<script lang="ts">
  import {getContext,onDestroy,untrack} from 'svelte';
  import {Ban} from '@lucide/svelte';
  import {propertyColor,pickedPropertyColor,nativePropertyColor} from '../../core/property-color';
  let {label,value,mixed=false,onchange,roles=[],roleValue='',onrole,allowClear=true,opaque=false,onvaliditychange}: {label:string;value:string;mixed?:boolean;onchange:(value:string)=>boolean|void;roles?:{value:string;label:string}[];roleValue?:string;onrole?:(role:string)=>void;allowClear?:boolean;opaque?:boolean;onvaliditychange?:(valid:boolean)=>void}=$props();
  const id=$props.id(),editScope=getContext<()=>string|undefined>('property-edit-scope');
  let scope=editScope?.();
  let error=$state(''),input=$state<HTMLInputElement>(),submitted:string|undefined,frame:number|undefined,disposed=false;
  let pending:{color:string;scope:string|undefined}|undefined;
  const displayed=$derived(mixed?'':propertyColor(value)??value);
  const help=$derived(mixed?'Multiple colors.':value==='transparent'?'No color.':'');
  function cancelPick(){if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;pending=undefined;}
  $effect(()=>{const next=displayed;label;scope=editScope?.();error='';submitted=undefined;cancelPick();if(input)input.value=next;untrack(()=>onvaliditychange?.(true));});
  onDestroy(()=>{disposed=true;cancelPick();});
  function current(){return !disposed&&scope===editScope?.();}
  function apply(color:string){
    if(!current())return;
    error='';onvaliditychange?.(true);
    if(color===submitted||!mixed&&color===propertyColor(value))return;
    if(onchange(color)===false){if(input)input.value=displayed;return;}
    submitted=color;
  }
  function picked(color:string,final=false){
    if(!current())return;
    const next=pickedPropertyColor(color,value,mixed);
    if(final){cancelPick();apply(next);return;}
    pending={color:next,scope:editScope?.()};
    if(frame===undefined)frame=requestAnimationFrame(()=>{const next=pending;frame=undefined;pending=undefined;if(next&&next.scope===editScope?.())apply(next.color);});
  }
  function commit(){
    if(!current()||!input?.isConnected)return;
    if(!input.value.trim()&&mixed){error='';onvaliditychange?.(true);return;}
    const color=propertyColor(input.value);
    if(!color||opaque&&(color==='transparent'||color.length!==7)){onvaliditychange?.(false);error=opaque?'Use a six-digit hex color.':'Use hex (e.g. #336699 or #33669980) or transparent.';return;}
    input.value=color;cancelPick();apply(color);
  }
  function key(event:KeyboardEvent){
    if(!current()||event.isComposing||event.keyCode===229)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelPick();if(input)input.value=displayed;error='';onvaliditychange?.(true);}
    else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();commit();}
  }
</script>
<div class="color-property">
  <div class="color-field" class:has-error={Boolean(error)}>
    <input class="color-swatch" class:empty={value==='transparent'||mixed} style:--property-color={value} type="color" value={nativePropertyColor(value)} aria-label={label} aria-describedby={help?`${id}-help`:undefined} title={label} oninput={event=>picked(event.currentTarget.value)} onchange={event=>picked(event.currentTarget.value,true)}/>
    <input bind:this={input} class="color-hex" data-document-value={displayed} spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="{label} hex" aria-invalid={Boolean(error)} aria-describedby={[error?`${id}-error`:'',help?`${id}-help`:''].filter(Boolean).join(' ')||undefined} value={displayed} placeholder={mixed?'Mixed':undefined} oninput={event=>{if(!current())return;error='';const color=propertyColor(event.currentTarget.value);onvaliditychange?.(Boolean(color&&(!opaque||color!=='transparent'&&color.length===7))||mixed&&!event.currentTarget.value.trim());}} onchange={commit} onkeydown={key}/>
    {#if allowClear}<button type="button" class="color-clear" aria-label="No {label.toLowerCase()}" title="No {label.toLowerCase()}" disabled={value==='transparent'&&!mixed} onclick={()=>{cancelPick();if(input)input.value='transparent';apply('transparent');}}><Ban size={14} aria-hidden="true"/></button>{/if}
  </div>
  {#if help}<span id="{id}-help" class="sr-only">{help}</span>{/if}
  {#if onrole&&roles.length}<label class="color-role-row"><span>Style</span><select aria-label={`${label} style`} value={roleValue} onchange={event=>onrole?.(event.currentTarget.value)}>{#if roleValue==='mixed'}<option value="mixed" disabled>Mixed links</option>{/if}<option value="">Custom</option>{#each roles as item}<option value={item.value}>{item.label}</option>{/each}</select></label>{/if}
  {#if error}<p id="{id}-error" role="alert">{error}</p>{/if}
</div>
<style>
  .color-role-row{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:var(--ui-meta);color:var(--text-secondary)}.color-role-row select{flex:1;min-width:0;width:100%;font-size:var(--ui-label)}
  .color-property{min-width:0}
  .color-field{display:flex;align-items:center;gap:8px;min-height:var(--property-control-height,36px);padding:1px 4px;border:1px solid var(--field-border);border-radius:var(--r-control);background:var(--field-surface);min-width:0}
  .color-swatch{flex:none;width:28px;height:28px;min-height:28px;padding:0;border:1px solid var(--border-default);appearance:none;border-radius:var(--r-sm);overflow:hidden;forced-color-adjust:none;cursor:pointer;background:repeating-conic-gradient(var(--border-default) 0% 25%,var(--surface-chrome) 0% 50%) 50%/8px 8px}
  .color-swatch::-webkit-color-swatch-wrapper{padding:0}
  .color-swatch::-webkit-color-swatch{border:0;border-radius:inherit;background:var(--property-color)}
  .color-swatch::-moz-color-swatch{border:0;border-radius:inherit;background:var(--property-color)}
  .color-swatch.empty::-webkit-color-swatch{opacity:0}
  .color-swatch.empty::-moz-color-swatch{opacity:0}
  .color-hex{flex:1;min-width:0;width:100%;height:auto;min-height:28px;padding:0;border:0;background:transparent;box-shadow:none;font:inherit;font-size:var(--ui-label);color:var(--text-primary)}
  .color-hex:focus-visible{outline:0}
  .color-property .color-field input.color-hex{min-height:28px}
  .color-field:has(.color-hex:focus-visible){outline:2px solid var(--accent-line);outline-offset:0}
  .color-clear{display:grid;place-items:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:var(--r-sm);background:transparent;color:var(--text-secondary);cursor:pointer}
  .color-swatch:focus-visible,.color-clear:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}
  .has-error{border-color:var(--danger)}
  p{margin-top:4px;font-size:var(--ui-meta);color:var(--danger-text)}
  @media(max-width:760px),(pointer:coarse){.color-swatch,.color-clear{width:44px;height:44px;min-height:44px}.color-property .color-field input.color-hex{min-height:44px}.color-field{min-height:48px}}
</style>
