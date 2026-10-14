<script lang="ts">
  import {isRegionFill} from '../core/resource-purpose';
  import Notice from './ui/Notice.svelte';
  import {onMount,tick} from 'svelte';
  import {SlidersHorizontal,Replace,Crop,PaintBucket,Square,Minus,Blend,Table2,ChartColumn,Play,Settings2,FlipHorizontal2,FlipVertical2,Check,X} from '@lucide/svelte';
  import {Button,DialogFooter} from './ui';
  import AsyncFeature from './AsyncFeature.svelte';
  let chartOpen = $state(false), tableOpen = $state(false), dataTab=$state<'data'|'style'>('data');
  import {deckDesignSystem,COLOR_LABELS} from '../core/deck-design-system';
  import {objectColorStyleOperations} from '../core/object-style-operations';
  import type {ColorRole} from '../core/design-system-schema';
  import DocumentColorChoices from './DocumentColorChoices.svelte';
  import {swatchInk} from '../selection-color';
  import {positionFloating} from '../ui-viewport';
  import '../selection-tools.css';
  import {editor} from '../core/editor.svelte';
  import type {SlideElement} from '../core/model';
  import {imageStyle} from '../core/typography';
  import {isFigmaPrototype,normalizePrototypeUrl} from '../core/prototype';
  type Menu='color'|'border'|'appearance'|'image'|'prototype'|'';
  let {onresources,onprototype}:{onresources:(id:string,anchor:HTMLElement)=>void;onprototype:(e:SlideElement)=>void}=$props();
  const id=$props.id();
  const editable=$derived(editor.selection.filter(e=>!e.locked)), e=$derived(editable[0]);
  const single=$derived(editor.selection.length===1);
  const shape=$derived(single&&e&&['rect','ellipse','diamond','line'].includes(e.type));
  const colorLabel=$derived(e?.type==='table'?'Text color':e?.type==='chart'?'Chart color':'Fill color');
  const system=$derived(deckDesignSystem(editor.deck??{}));
  const styleTargets=$derived(editable.filter(e=>!e.resource&&!e.sourceRegion&&!['image','prototype'].includes(e.type)));
  const colors=$derived([...new Set((editor.slide?.elements.flatMap(e=>[e.fill,e.stroke])??[]).filter(c=>/^#[\da-f]{6}$/i.test(c)&&!Object.values(system.colors).some(v=>v.toLowerCase()===c.toLowerCase())))].slice(0,14));
  const opacity=$derived(editable.some(v=>v.opacity!==e?.opacity)?'Mixed':`${Number(((e?.opacity??1)*100).toFixed(1))}%`);
  let menu=$state<Menu>(''),opened=$state(false),popup=$state<HTMLDivElement>(),origin:HTMLButtonElement|undefined;
  let hex=$state(''),amount=$state<number|string|undefined>(''),radius=$state<number|string|undefined>(''),fontSize=$state<number|string|undefined>('');
  let shadowDraft=$state<SlideElement['shadow']>();
  let pendingRole=$state<ColorRole|undefined>();
  let width=$state<number|string|undefined>(''),error=$state(''),fit=$state<SlideElement['fit']>('contain'),flipX=$state(false),flipY=$state(false);
  let edges=$state({left:0,top:0,right:0,bottom:0}),link=$state(''),scaling=$state('contain'),responsive=$state(false),deviceFrame=$state(false),chrome=$state(false);
  let frame=0;
  const crop=$derived({left:Number(edges.left)/100,top:Number(edges.top)/100,right:Number(edges.right)/100,bottom:Number(edges.bottom)/100});
  const validCrop=$derived(Object.values(crop).every(v=>Number.isFinite(v)&&v>=0&&v<1)&&crop.left+crop.right<1&&crop.top+crop.bottom<1);
  const imagePreview=$derived(e?{...e,fit,flipX,flipY,crop:validCrop?(Object.values(crop).some(v=>v>0)?crop:undefined):e.crop}:undefined);
  const title=$derived(menu==='color'?colorLabel:menu==='border'?e?.type==='line'?'Line style':'Border':menu==='appearance'?'Appearance':menu==='image'?'Image options':'Prototype settings');
  function position(){
    if(!popup?.matches(':popover-open')||!origin)return;
    const body=popup.querySelector<HTMLElement>('form'),header=popup.querySelector<HTMLElement>('header');
    positionFloating(popup,origin.getBoundingClientRect(),{preferredHeight:(body?.scrollHeight??0)+(header?.offsetHeight??0)+2,minHeight:160});
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  async function open(next:Menu,event:MouseEvent){
    if(!e)return;if(menu===next&&opened){close();return;}
    popup?.hidePopover();origin=event.currentTarget as HTMLButtonElement;menu=next;error='';
    pendingRole=e.design?.[next==='border'?'stroke':'fill'];
    hex=next==='border'?(e.stroke==='transparent'?(e.type==='line'?e.fill:'#26362c'):e.stroke):e.fill;
    amount=opacity==='Mixed'?'':e.opacity*100;radius=e.radius;fontSize=e.fontSize;width=e.type==='line'?e.strokeWidth||2:e.strokeWidth;
    shadowDraft=e.shadow?{...e.shadow}:undefined;
    fit=e.fit;flipX=e.flipX;flipY=e.flipY;
    edges={left:(e.crop?.left??0)*100,top:(e.crop?.top??0)*100,right:(e.crop?.right??0)*100,bottom:(e.crop?.bottom??0)*100};
    link=e.prototype?.url??'';scaling=e.prototype?.scaling??'contain';responsive=e.prototype?.responsive??false;deviceFrame=e.prototype?.deviceFrame??false;chrome=e.prototype?.chrome??false;
    await tick();popup?.showPopover();position();popup?.focus({preventScroll:true});
  }
  function close(){popup?.hidePopover();restoreFocus(origin);}
  function apply(patch:Partial<SlideElement>){editor.patch(patch);close();}
  function chooseColor(role:ColorRole){
    pendingRole=role;hex=system.colors[role];error='';
    if(menu==='border'){if(!Number(width))width=e.type==='line'?2:1;return;}
    if(editor.deck&&editor.slide){editor.commit(objectColorStyleOperations(editor.operationDocument(),editor.slide.id,styleTargets.map(e=>e.id),'fill',role));close();}
  }
  function number(value:number|string|undefined,min:number,max:number,label:string){const n=Number(value);if(!String(value??'').trim()||!Number.isFinite(n)||n<min||n>max)throw new Error(`${label}: enter a number from ${min} to ${max}.`);return n;}
  function save(event:SubmitEvent){
    event.preventDefault();if(!e)return;error='';
    try{
      if(menu==='color'||menu==='border'){
        if(!/^(#[\da-f]{6}|transparent)$/i.test(hex))throw new Error('Enter a six-digit hex color.');
        const strokeWidth=menu==='border'?(hex==='transparent'?0:number(width,e.type==='line'?1:0,100,'Line width')):0;
        if(pendingRole&&editor.deck&&editor.slide){const ops=objectColorStyleOperations(editor.operationDocument(),editor.slide.id,styleTargets.map(e=>e.id),menu==='border'?'stroke':'fill',pendingRole);if(menu==='border')for(const op of ops)if(op.op==='update_element')op.patch.strokeWidth=strokeWidth;editor.commit(ops);close();}
        else apply(menu==='border'?{stroke:hex,strokeWidth}:{fill:hex});
      }else if(menu==='appearance'){
        const patch:Partial<SlideElement>={opacity:number(amount,0,100,'Opacity')/100};
        if(single&&['rect','diamond','image'].includes(e.type))patch.radius=number(radius,0,500,'Corner radius');
        if(shape)patch.shadow=shadowDraft;
        if(single&&['table','chart'].includes(e.type))patch.fontSize=number(fontSize,4,500,'Text size');
        apply(patch);
      }else if(menu==='image'){
        if(!validCrop)throw new Error('Keep each crop edge below 100%; opposite edges must total less than 100%.');
        const patch:Partial<SlideElement>={fit,flipX,flipY};
        if(!e.sourceRegion)patch.crop=Object.values(crop).some(v=>v>0)?crop:undefined;
        apply(patch);
      }else if(menu==='prototype'&&e.prototype)apply({prototype:{...e.prototype,url:normalizePrototypeUrl(link),scaling:scaling as 'contain'|'scale-down'|'fit-width',responsive,deviceFrame,chrome}});
    }catch(err){error=err instanceof Error?err.message:'Check the entered values.';schedule();}
  }
  function key(event:KeyboardEvent){if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();close();}}
  onMount(()=>{
    const observer=new ResizeObserver(schedule);if(popup)observer.observe(popup);
    window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);document.addEventListener('scroll',schedule,true);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);document.removeEventListener('scroll',schedule,true);};
  });
  import {popoverFocus,restoreFocus} from '../ui-focus';
</script>

{#if e}
{#if tableOpen}<AsyncFeature feature="table" props={{elementId:e.id,initialTab:dataTab,onclose:()=>tableOpen=false}} onclose={()=>tableOpen=false} modalTitle="Edit table"/>{/if}
{#if chartOpen}<AsyncFeature feature="chart" props={{elementId:e.id,initialTab:dataTab,onclose:()=>chartOpen=false}} onclose={()=>chartOpen=false} modalTitle="Edit chart"/>{/if}
<div class="element-quick-tools">
  {#if single}
    {#if e.type==='image'}
      <button class="text-btn" aria-label="Replace image" title="Replace image from library" onclick={ev=>onresources(e.id,ev.currentTarget)}><Replace size={16}/><span>Replace</span></button>
      {#if !isRegionFill(e)}<button class="text-btn" aria-label="Crop & fit image" title="Fit, flip and crop" aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='image'} onclick={ev=>open('image',ev)}><Crop size={16}/><span class="selection-secondary-label">Crop &amp; fit</span></button>{/if}
    {:else if e.type==='table'||e.type==='chart'}
      <button class="text-btn" aria-label={e.type==='table'?'Data: edit table':'Data: edit chart'} title="Edit data" aria-haspopup="dialog" aria-expanded={chartOpen||tableOpen} onclick={()=>{dataTab='data';if(e.type==='chart')chartOpen=true;else tableOpen=true;}}>{#if e.type==='table'}<Table2 size={16}/>{:else}<ChartColumn size={16}/>{/if}<span>Data</span></button>
      <button class="text-btn" aria-label={e.type==='table'?'Customize table':'Customize chart'} aria-haspopup="dialog" onclick={()=>{dataTab='style';if(e.type==='chart')chartOpen=true;else tableOpen=true;}}><SlidersHorizontal size={16}/><span>Style</span></button>
    {:else if e.type==='prototype'}
      <button class="text-btn" aria-label="Preview prototype" onclick={()=>onprototype(e)}><Play size={16}/><span>Preview</span></button>
      <button class="icon-btn" aria-label="Prototype settings" title="Prototype settings" aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='prototype'} onclick={ev=>open('prototype',ev)}><Settings2 size={16}/></button>
    {/if}
    {#if (shape&&e.type!=='line')||e.type==='table'||e.type==='chart'}
      <button class="text-btn quick-color" aria-label={colorLabel} title={colorLabel} aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='color'} onclick={ev=>open('color',ev)}><span class="selection-color-glyph" aria-hidden="true"><PaintBucket size={16}/><span class="selection-color-mark" class:clear={e.fill==='transparent'} style:background={e.fill==='transparent'?undefined:e.fill}></span></span></button>
    {/if}
    {#if shape}<button class="text-btn" aria-label={e.type==='line'?'Line style':'Border style'} title={e.type==='line'?'Line color and width':'Border color and width'} aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='border'} onclick={ev=>open('border',ev)}><span class="selection-color-glyph" aria-hidden="true">{#if e.type==='line'}<Minus size={16}/>{:else}<Square size={16}/>{/if}<span class="selection-color-mark" class:clear={e.type!=='line'&&(e.stroke==='transparent'||!e.strokeWidth)} style:background={e.type==='line'?(e.stroke==='transparent'?e.fill:e.stroke):e.stroke!=='transparent'&&e.strokeWidth?e.stroke:undefined}></span></span><span class="selection-secondary-label">{e.type==='line'?`${e.strokeWidth||2} px`:'Border'}</span></button>{/if}
  {/if}
  <span id={`${id}-appearance`} hidden>{opacity} opacity{single&&['rect','image'].includes(e.type)?', corner radius':single&&['table','chart'].includes(e.type)?', text size':''}. Locked objects stay unchanged.</span>
  <button class="text-btn quick-opacity" aria-label="Object appearance" aria-describedby={`${id}-appearance`} title="Opacity and appearance" aria-haspopup="dialog" aria-controls={id} aria-expanded={opened&&menu==='appearance'} onclick={ev=>open('appearance',ev)}><Blend size={16}/><span>{opacity==='Mixed'?'—':opacity}</span></button>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div bind:this={popup} id={id} use:popoverFocus={{close:()=>popup?.hidePopover(), origin:()=>origin}} popover="auto" class="element-format-popover selection-tools-popover canvas-controls-popover" class:wide={menu==='prototype'} role="dialog" tabindex="-1" aria-label={title} onbeforetoggle={ev=>opened=ev.newState==='open'} onkeydown={key}>
    <header><strong>{title}</strong><button class="icon-btn" aria-label="Close object formatting" onclick={close}><X size={16}/></button></header>
    <form class="selection-format-body" onsubmit={save}>
      {#if menu==='color'||menu==='border'}
        <DocumentColorChoices value={pendingRole} disabled={!styleTargets.length} onchoose={chooseColor}/>
        <p class="hint">{pendingRole?`${COLOR_LABELS[pendingRole]} · ${menu==='border'?'Apply to follow document':'Follows document colors'}`:'Custom color'}</p>
        <details class="format-custom-options"><summary>Custom color</summary>{#if colors.length}<div class="color-presets">{#each colors as value}<button type="button" class="color-swatch" style:background={value} style:color={swatchInk(value)} aria-label={`${menu==='border'?'Stroke color':colorLabel} ${value}`} aria-pressed={hex.toLowerCase()===value.toLowerCase()} onclick={()=>{pendingRole=undefined;hex=value;if(menu==='color')apply({fill:value});else if(!Number(width))width=e.type==='line'?2:1;}}>{#if hex.toLowerCase()===value.toLowerCase()}<Check size={16}/>{/if}</button>{/each}</div>{/if}<label class="field-label">Hex color<input aria-label="Hex object color" type="text" maxlength="11" bind:value={hex} oninput={()=>pendingRole=undefined}/></label></details>
        {#if e.type!=='line'&&e.type!=='table'&&e.type!=='chart'}<button type="button" class="text-btn" aria-pressed={hex==='transparent'} onclick={()=>{pendingRole=undefined;hex='transparent';if(menu==='color')apply({fill:'transparent'});else width=0;}}>No {menu==='color'?'fill':'border'}</button>{/if}
        {#if menu==='border'}<label class="field-label">Line width<input aria-label="Line width" type="number" min={e.type==='line'?1:0} max="100" step="any" bind:value={width}/></label>{/if}
      {:else if menu==='appearance'}
        <label class="field-label">Opacity (%)<input aria-label="Object opacity" type="number" min="0" max="100" step="any" placeholder={opacity==='Mixed'?'Mixed values':undefined} bind:value={amount}/></label>
        <div class="opacity-presets">{#each [25,50,75,100] as value}<button class="text-btn" type="button" aria-pressed={String(amount??'').trim()!==''&&Number(amount)===value} onclick={()=>apply({opacity:value/100})}>{value}%</button>{/each}</div>
        {#if single&&['rect','diamond','image'].includes(e.type)}<label class="field-label">Corner radius<input aria-label="Object corner radius" type="number" min="0" max="500" step="any" bind:value={radius}/></label>{/if}
        {#if shape}<AsyncFeature feature="shape-effects" props={{value:shadowDraft,onchange:shadow=>shadowDraft=shadow}}/>{/if}
        {#if single&&['table','chart'].includes(e.type)}<label class="field-label">Text size<input aria-label="Object text size" type="number" min="4" max="500" step="any" bind:value={fontSize}/></label>{/if}
        {#if !single}<p class="hint">Applies to editable objects. Locked objects stay unchanged.</p>{/if}
      {:else if menu==='image'}
        {#if imagePreview?.src&&!e.sourceRegion}<div class="image-preview" style:aspect-ratio={`${e.w}/${e.h}`} style:width={`min(100%, ${160*e.w/e.h}px)`}><div style:transform={`scale(${flipX?-1:1},${flipY?-1:1})`}><img src={imagePreview.src} alt="Crop preview" style={imageStyle(imagePreview)}/></div></div>{/if}
        <label class="field-label">Image fit<select aria-label="Image fit" bind:value={fit} disabled={Boolean(e.sourceRegion)}><option value="contain">Fit</option><option value="cover">Fill and crop</option><option value="fill">Stretch</option></select></label>
        <div class="flip-buttons"><button type="button" class="text-btn" aria-label="Flip horizontally" aria-pressed={flipX} onclick={()=>flipX=!flipX}><FlipHorizontal2 size={16}/>Horizontal</button><button type="button" class="text-btn" aria-label="Flip vertically" aria-pressed={flipY} onclick={()=>flipY=!flipY}><FlipVertical2 size={16}/>Vertical</button></div>
        {#if e.sourceRegion}<p class="hint">This object uses a source reference region. Replace the image to adjust its crop.</p>{:else}<details><summary>Crop edges (%)</summary><div class="crop-fields">{#each ['left','top','right','bottom'] as edge}<label class="field-label">{edge[0].toUpperCase()+edge.slice(1)}<input aria-label={`Crop ${edge}`} type="number" min="0" max="99.99" step="any" bind:value={edges[edge as keyof typeof edges]}/></label>{/each}</div><button type="button" class="text-btn" onclick={()=>edges={left:0,top:0,right:0,bottom:0}}>Reset crop</button></details><p class="hint">Crop keeps the original image. Changes apply together.</p>{/if}
      {:else if menu==='prototype'}
        <label class="field-label">Share link<textarea aria-label="Prototype share link" rows="3" bind:value={link}></textarea></label>
        {#if isFigmaPrototype(link)}<label class="field-label">Zoom<select aria-label="Prototype zoom" bind:value={scaling}><option value="contain">Fit to window</option><option value="scale-down">Scale down only</option><option value="fit-width">Fit width</option></select></label><label class="check-field"><input type="checkbox" bind:checked={responsive}/>Responsive layout</label><label class="check-field"><input type="checkbox" bind:checked={deviceFrame}/>Device frame</label><label class="check-field"><input type="checkbox" bind:checked={chrome}/>Figma footer</label>{:else}<p class="hint">This website controls its own layout.</p>{/if}
      {/if}
      {#if error}<Notice tone="error" title="Formatting could not update" message={error}/>{/if}
      <DialogFooter class="selection-format-footer">{#snippet actions()}<Button onclick={close}>Cancel</Button><Button variant="secondary" type="submit">Apply</Button>{/snippet}</DialogFooter>
    </form>
  </div>
</div>
{/if}
<style>
  .element-quick-tools{display:flex;align-items:center;gap:4px;flex:none}.quick-opacity{gap:4px;font-variant-numeric:tabular-nums}.element-format-popover.wide{width:min(360px,calc(100vw - 24px))}
  form input,form select,form textarea{width:100%;min-width:0}textarea{resize:vertical;max-height:40vh}
  .opacity-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(4.5em,1fr));gap:4px}.opacity-presets>button{padding-inline:4px}.flip-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(8em,1fr));gap:8px}.crop-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:8px}summary{cursor:pointer;padding-block:8px}.image-preview{margin-inline:auto;position:relative;overflow:hidden;background:var(--surface-subtle);border-radius:var(--r-small)}.image-preview>div{position:absolute;inset:0;overflow:hidden}.check-field{display:flex;align-items:center;min-height:32px;gap:8px}.check-field input{width:auto}
  @media(max-width:760px),(pointer:coarse){.element-quick-tools{gap:2px}.check-field,summary{min-height:44px}.check-field input{min-height:0}.element-quick-tools>button{padding-inline:8px}}
  @media(max-width:360px){.quick-opacity>span{display:none}}
</style>
