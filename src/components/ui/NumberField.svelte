<script lang="ts">
  import {getContext,onDestroy,untrack,type Component} from 'svelte';
  import {nextIncrement} from '../../core/numeric-increment';
  let {label,prefix=label,icon,value,mixed=false,automatic=false,unit='',min,max,step=1,increment,keyboardStep,disabled=false,hint,onchange,onvaliditychange}: {label:string;prefix?:string;icon?:Component<any>;value?:number|string;mixed?:boolean;automatic?:boolean;unit?:string;min?:number;max?:number;step?:number|string;increment?:number;keyboardStep?:number;disabled?:boolean;hint?:string;onchange:(value:number)=>boolean|void;onvaliditychange?:(valid:boolean)=>void}=$props();
  const id=$props.id();let error=$state(''),input=$state<HTMLInputElement>();
  const editScope=getContext<() => string | undefined>('property-edit-scope');
  let scope=editScope?.();
  let submitted:number|undefined,disposed=false;
  onDestroy(()=>disposed=true);
  const Icon=$derived(icon);
  const displayed=$derived(mixed?'':String(value??''));
  const unitNames:Record<string,string>={px:'pixels','%':'percent','°':'degrees',ms:'milliseconds','×':'multiplier'};
  const help=$derived([mixed?'Multiple values.':automatic?'Automatic value.':'',unit?`Unit: ${unitNames[unit]??unit}.`:'',hint??''].filter(Boolean).join(' '));
  $effect(()=>{const next=displayed;label;automatic;scope=editScope?.();error='';submitted=undefined;if(input)input.value=next;untrack(()=>onvaliditychange?.(true));});
  function commit(event:Event){
    commitInput(event.currentTarget as HTMLInputElement);
  }
  function commitInput(input: HTMLInputElement){
    if(disposed||scope!==editScope?.()||!input.isConnected)return;
    if(!input.value.trim()&&mixed){error='';onvaliditychange?.(true);return;}
    if(!input.validity.valid||!input.value.trim()||!Number.isFinite(Number(input.value))){onvaliditychange?.(false);error=input.validity.stepMismatch?`Use increments of ${step}.`:min!==undefined&&max!==undefined?`Use ${min} to ${max}.`:min!==undefined?`Use ${min} or more.`:max!==undefined?`Use ${max} or less.`:'Enter a valid number.';return;}
    onvaliditychange?.(true);const next=Number(input.value);error='';if(next===submitted||!mixed&&!automatic&&next===Number(value))return;
    if(onchange(next)===false)input.value=displayed;else submitted=next;
  }
  function key(event:KeyboardEvent){
    if(disposed||scope!==editScope?.()||event.isComposing||event.keyCode===229)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();(event.currentTarget as HTMLInputElement).value=displayed;error='';onvaliditychange?.(true);}
    else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();commitInput(event.currentTarget as HTMLInputElement);}
    else if(!event.metaKey&&!event.ctrlKey&&['ArrowUp','ArrowDown'].includes(event.key)){
      const input=event.currentTarget as HTMLInputElement;
      event.preventDefault();event.stopPropagation();
      const current=input.value.trim()?input.valueAsNumber:mixed?Number(value):NaN;
      if(!Number.isFinite(current))return;
      const direction=event.key==='ArrowUp'?1:-1,amount=keyboardStep??(typeof step==='number'?step:1);
      const next=event.shiftKey&&increment?nextIncrement(current,direction,increment):current+direction*amount*(event.shiftKey?10:event.altKey&&step==='any'?.1:1);
      input.value=String(Math.max(min??-Infinity,Math.min(max??Infinity,Math.round(next*1e10)/1e10)));
      commitInput(input);
    }
  }
</script>
<div class="number-property">
  <label class="number-field" class:has-error={Boolean(error)} class:word-prefix={!Icon && prefix.length >= 5} title={hint??`${label}${unit?` (${unit})`:''}`}>
    <span class="field-prefix">{#if Icon}<Icon size={14} aria-hidden="true" />{:else}{prefix}{/if}{#if automatic}<small>Auto</small>{/if}</span>
    <input bind:this={input} type="number" data-document-value={displayed} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={[error?`${id}-error`:'',help?`${id}-help`:''].filter(Boolean).join(' ')||undefined} {min} {max} {step} {disabled} value={displayed} placeholder={mixed?'Mixed':automatic?'Auto':undefined} oninput={event=>{if(disposed||scope!==editScope?.())return;error='';const input=event.currentTarget;onvaliditychange?.(Boolean(input.value.trim())&&input.validity.valid||mixed&&!input.value.trim());}} onchange={commit} onkeydown={key}/>
    {#if unit}<span class="field-unit" aria-hidden="true">{unit}</span>{/if}
  </label>
  {#if help}<span id="{id}-help" class="sr-only">{help}</span>{/if}
  {#if error}<p id="{id}-error" class="field-error" role="alert">{error}</p>{/if}
</div>
<style>
  .number-property{min-width:0;container-type:inline-size}
  .number-field{display:flex;align-items:center;gap:6px;min-height:var(--property-control-height,36px);padding:4px 8px;border:1px solid var(--field-border);border-radius:var(--r-control);background:var(--field-surface);font-size:var(--ui-label);color:var(--text-secondary);min-width:0}
  .field-prefix{display:flex;align-items:center;gap:4px;flex:none}
  .field-prefix:empty{display:none}
  .field-prefix small{font-size:var(--ui-meta);color:var(--text-link)}
  input{flex:1;min-width:0;width:100%;height:auto;min-height:0;padding:0;border:0;background:transparent;box-shadow:none;font:inherit;color:var(--text-primary);font-variant-numeric:tabular-nums;appearance:textfield}
  input::-webkit-inner-spin-button{appearance:none;margin:0}
  .number-property .number-field input[type='number']{min-height:0}
  input:focus-visible{outline:0}
  .number-field:focus-within{outline:2px solid var(--accent-line);outline-offset:0}
  .field-unit{flex:none;font-size:var(--ui-meta)}
  .has-error{border-color:var(--danger)}
  .field-error{margin-top:4px;font-size:var(--ui-meta);color:var(--danger-text)}
  @container(max-width:8.5rem){
    .word-prefix{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 6px}
    .word-prefix .field-prefix{grid-column:1 / -1;min-width:0}
    .word-prefix input{grid-column:1;font-size:var(--ui-text)}
    .word-prefix .field-unit{grid-column:2}
  }
  @media(max-width:760px),(pointer:coarse){.number-field{min-height:44px}}
</style>
