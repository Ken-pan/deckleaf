<script lang="ts">
  import {setContext} from 'svelte';
  import InspectorSection from './InspectorSection.svelte';
  import {inspectorCapabilities,dataLabelSize,shapeTypeOperations,shadowPatchOperations,shadowPropertyMixed} from '../core/inspector-properties';
  import AsyncFeature from './AsyncFeature.svelte';
  import {canRecolorResource,isRegionFill} from '../core/resource-purpose';
  import ContainerProperties from './ContainerProperties.svelte';
  import GroupMembership from './GroupMembership.svelte';
  import {groupExitActions} from '../group-exit-actions';
  import { objectAction } from '../editor-focus';
  import {objectClipboardActions} from '../clipboard-actions';
  import { textProperties, textPropertyState, textToggleState, type TextProperty } from '../core/text-properties';
  import { editor } from '../core/editor.svelte';
  import { uiDisclosure } from '../ui-motion';
  import {selectionMembers,selectionFrame,scaleSelection,resizeSelectionFrame} from '../core/selection-transform';
  import {canReorderSelection} from '../core/stack-order';
  import { moveElements } from '../core/operations';
  import { isFigmaPrototype, normalizePrototypeUrl } from '../core/prototype';
  import { type SlideElement } from '../core/model';
  import {shapeKind, SHAPE_TOOLS, SHAPE_LABELS, type ShapeInsertTool} from '../core/shapes';
  import ObjectAutoLayout from './ObjectAutoLayout.svelte';
  import {selectedLayout} from '../core/object-layout';
  import { fontWeights, textStylePatch, WEIGHT_LABELS } from '../core/fonts';
  import { selectionBounds, keepsAspectRatio, resizedDimensions } from '../core/interactions';
  import { elementLabel } from './element-labels';
  import AlignmentControls from './AlignmentControls.svelte';
  import FontPicker from './FontPicker.svelte';
  import ElementDataEditor from './ElementDataEditor.svelte';
  import ChartProperties from './ChartProperties.svelte';
  import PropertyChoice from './ui/PropertyChoice.svelte';
  import NumberField from './ui/NumberField.svelte';
  import ColorField from './ui/ColorField.svelte';
  import {objectColorStyleOperations,objectStyleWeightOperations} from '../core/object-style-operations';
  import {COLOR_ROLES,type ColorRole,type TextRole} from '../core/design-system-schema';
  import {COLOR_LABELS,TEXT_LABELS,deckDesignSystem} from '../core/deck-design-system';
  import ObjectStyles from './ObjectStyles.svelte';
  import { ActionMenu, Button } from './ui';
  import {elementIcon} from './icons';
  import RadiusIcon from './icons/CornerRadius.svelte';
  import BringForward from './icons/BringForward.svelte';
  import SendBackward from './icons/SendBackward.svelte';
  import {textAlignmentIcons, textSizingIcons} from './icons/text-icons';
  import {Ellipsis, Layers, Type, Image, Move, Blend, WrapText, SquareDashed, ChevronDown, FileText, Replace, Info, AppWindow, Play, Settings2, Table2, ChartColumn, AlignHorizontalJustifyCenter, Paintbrush, Ruler} from '@lucide/svelte';
  import { Link, Unlink, RotateCw, Scan, Crop, Expand, FlipHorizontal2, FlipVertical2, AlignLeft, AlignCenter, AlignRight, Copy, Trash2, Lock, Unlock, Group, Ungroup, Bold, Italic, Underline } from '@lucide/svelte';
  const selection=$derived(editor.selection);
  const editable=$derived(selection.filter(v=>!v.locked));
  const propertyItems=$derived(editable.length?editable:selection);
  const capabilities=$derived(inspectorCapabilities(propertyItems));
  const textStates=$derived(Object.fromEntries(textProperties.map(key=>[key,textPropertyState(propertyItems,key)])) as {[K in TextProperty]:{value:SlideElement[K]|undefined;mixed:boolean}});
  setContext('property-edit-scope',()=>`${editor.deck?.id}:${editor.activeId}:${editor.selected.join(',')}:${editor.selectedContainer}`);
  let e = $derived(propertyItems[0]);
  const scope=$derived(`${editor.deck?.id}:${editor.activeId}:${editor.selected.join(',')}:${editor.selectedContainer}:${e?.type}`);
  const sections=$state({text:true,image:true,prototype:true,chart:true,table:true,shape:true,appearance:true,transform:false,crop:false,provenance:false,display:false,textOptions:false,poster:false,colorStyles:false,layout:false});
  let layoutPanels=$state({limits:false,group:false,order:false,help:false,individualPadding:false});
  let containerPanels=$state({scale:false,hierarchy:false});
  let sameType=$derived(capabilities.sameType);
  let allLocked=$derived(selection.every(v=>v.locked));
  let mixedLocks=$derived(selection.some(v=>v.locked)&&!allLocked);
  let positionBounds=$derived(editor.slide?selectionFrame(editor.slide,editor.selected,editor.selectionScope):null);
  function mixed(key:keyof SlideElement){if(sameType&&e?.type==='text'&&textProperties.includes(key as TextProperty))return textStates[key as TextProperty].mixed;const items=propertyItems;return items.some(v=>v[key]!==items[0]?.[key]);}
  function textValue<K extends TextProperty>(key: K) { return textStates[key].value ?? e[key]; }
  let boldState=$derived(textToggleState(propertyItems,'bold')),italicState=$derived(textToggleState(propertyItems,'italic')),underlineState=$derived(textToggleState(propertyItems,'underline'));
  let {onfonts, onresources, onprototype, onstyles, active=true}: {active?:boolean;onfonts: () => void; onresources?: (replaceId?: string) => void; onprototype?: (element: SlideElement) => void;onstyles?:(role?:TextRole)=>void} = $props();
  function prototypeUrl(value: string) { prototypeError='';try { editor.patch({prototype: {...e.prototype!, url: normalizePrototypeUrl(value)}}); } catch (error: any) { prototypeError = error.message; } }
  let weights = $derived(e ? fontWeights(e.fontFamily, editor.deck?.fonts, editor.deck?.onlineFonts) : []);
  function patchText(patch: Partial<SlideElement>,merge='') {
    if (editor.slide) editor.commit(editable.filter(e => e.type === 'text').map(e => ({op: 'update_element', slideId: editor.slide!.id, elementId: e.id, patch: textStylePatch(e, patch)})),merge);
  }
  let single = $derived(editor.selection.length === 1);
  let memberLayout=$derived(editor.slide&&selectedLayout(editor.slide,editor.selected));
  let region = $derived(editable.length > 0 && editable.every(isRegionFill));
  let recolorable = $derived(editable.length > 0 && editable.every(v => v.type === 'image' && !v.sourceRegion && canRecolorResource(v.resource)));
  let shapes = $derived(capabilities.shapes);
  let shadowMixed = $derived(editable.some(v=>Boolean(v.shadow)!==Boolean(editable[0]?.shadow)));
  function changeShape(value:string){if(editor.slide)editor.commit(shapeTypeOperations(editor.slide,editor.selected,value as ShapeInsertTool));}
  const shapeValue=$derived(e&&propertyItems.every(item=>shapeKind(item)===shapeKind(e))?shapeKind(e):'');
  const shadowMixedFields=$derived(Object.fromEntries(['color','opacity','blur','x','y'].map(key=>[key,shadowPropertyMixed(editable,key as keyof import('../core/shape-schema').ElementShadow)])));
  const weightRole=$derived(editable.length&&editable.every(e=>e.design?.text===editable[0].design?.text)?editable[0].design?.text:undefined);
  const styleWeight=$derived(weightRole?deckDesignSystem(editor.deck??{}).typography[weightRole].fontWeight:undefined);
  const linkedWeight=$derived(weightRole&&!mixed('fontWeight')&&textValue('fontWeight')===styleWeight&&editable.every(e=>!e.design?.overrides?.includes('fontWeight')));
  function chooseWeight(value:string){if(value==='style'){if(editor.deck&&editor.slide&&!editor.editingId)editor.commit(objectStyleWeightOperations(editor.operationDocument(),editor.slide.id,editable.map(e=>e.id)));}else patchText({fontWeight:Number(value)});}
  const colorRoles=COLOR_ROLES.map(value=>({value,label:COLOR_LABELS[value]}));
  const styleEligible=$derived(editable.length>0&&editable.every(e=>!e.designPattern&&!e.resource&&!e.sourceRegion&&!['image','prototype'].includes(e.type)));
  function colorLink(property:'fill'|'stroke'){const first=editable[0]?.design?.[property]??'';return editable.every(e=>(e.design?.[property]??'')===first)?first:'mixed';}
  function linkColor(property:'fill'|'stroke',role:string){if(editor.deck&&editor.slide)editor.commit(objectColorStyleOperations(editor.operationDocument(),editor.slide.id,editable.map(e=>e.id),property,role?role as ColorRole:undefined));}
  let ratioState = $derived<boolean|'mixed'>(editable.length && editable.some(v=>keepsAspectRatio(v)) ? editable.every(v=>keepsAspectRatio(v)) ? true : 'mixed' : false);
  function number(n: number, key: keyof SlideElement) {
    if(!single&&(key==='x'||key==='y')&&positionBounds)editor.commit(moveElements(editor.operationDocument(),editor.slide!.id,editor.selected,key==='x'?n-positionBounds.x:0,key==='y'?n-positionBounds.y:0,editor.selectionScope),`prop-${key}`);
    else if(!single&&positionBounds&&(key==='w'||key==='h')){const members=selectionMembers(editor.slide!,editor.selected,false,editor.selectionScope),delta=n-positionBounds[key],to=resizeSelectionFrame(positionBounds,members,key==='w'?delta:0,key==='h'?delta:0,'se',true);editor.commit(scaleSelection(editor.operationDocument(),editor.slide!.id,editor.selected,positionBounds,to,editor.selectionScope),`prop-${key}`);}
    else if(key==='w'||key==='h')editor.commit(editable.map(v=>({op:'update_element',slideId:editor.slide!.id,elementId:v.id,patch:resizedDimensions(v,key,n)})),`prop-${key}`);
    else if(e?.type==='text'&&['lineHeight','letterSpacing','fontSize'].includes(key))patchText({[key]:n},`prop-${key}`);
    else editor.patch({[key]:n},`prop-${key}`);
  }
  function grouping() { editor.group(); }
  const sizingOptions=[{value:'auto-width',label:'Auto width',icon:textSizingIcons['auto-width'],description:'Width and height follow the text'},{value:'auto-height',label:'Auto height',icon:textSizingIcons['auto-height'],description:'Width stays fixed; height follows the text'},{value:'fixed',label:'Fixed size',icon:textSizingIcons.fixed,description:'Width and height stay fixed'}];
  let sizing=$derived(mixed('textSizing')?'':e?.textSizing??'fixed');
  let imageError=$state(''),prototypeError=$state('');
  $effect(()=>{editor.selected.join(',');imageError='';prototypeError='';});
  function crop(edge:'left'|'right'|'top'|'bottom',value:number){const next={left:0,right:0,top:0,bottom:0,...e.crop,[edge]:value/100};if(next.left+next.right>=1||next.top+next.bottom>=1){imageError='Opposite crop edges must total less than 100%.';return false;}imageError='';editor.patch({crop:next});return true;}
  function flip(key:'flipX'|'flipY'){editor.patch({[key]:!editable.every(e=>e[key])});}
  function stroke(value:string){if(editor.slide)editor.commit(editable.map(item=>({op:'update_element',slideId:editor.slide!.id,elementId:item.id,patch:item.type==='table'?{stroke:value}:{stroke:value,strokeWidth:value==='transparent'?0:item.strokeWidth||1}})),'stroke');}
</script>
{#if active}
{#key scope}
{#if editor.selectedContainer}<ContainerProperties bind:disclosures={containerPanels}/><ObjectAutoLayout bind:disclosures={layoutPanels}/>{:else if e}
  {@const ObjectIcon = sameType ? elementIcon(e) : Layers}
  <div class="panel-section object-summary">
    <div class="object-heading">
      <span class="object-type-icon"><ObjectIcon size={16} aria-hidden="true" /></span>
      <div class="object-heading-copy">
        {#if single}<input class="object-name" aria-label="Object name" value={e.name} maxlength="200" disabled={e.locked} onchange={event=>{const name=event.currentTarget.value.trim();event.currentTarget.value=name||e.name;if(name&&name!==e.name)editor.patch({name});}} onkeydown={event=>{if(event.isComposing||event.keyCode===229)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.value=e.name;}}} />{:else}<strong>{editor.selection.length} objects</strong>{/if}
        {#if !single||e.sourceRegion||e.pageElement}<span>{sameType ? elementLabel(e) : 'Mixed types'}{#if mixedLocks} · {editable.length} editable{/if}</span>{/if}
      </div>
      <ActionMenu class="object-menu" label="Object actions" iconOnly items={[
        ...objectClipboardActions(),
        {label: single ? 'Duplicate object' : 'Duplicate objects', icon: Copy, disabled: allLocked, onselect: event => void objectAction(() => editor.duplicateSelection(),event)},
        {label: allLocked ? (single ? 'Unlock object' : 'Unlock objects') : (single ? 'Lock object' : 'Lock objects'), icon: allLocked ? Unlock : Lock, onselect: () => editor.patch({locked: !allLocked})},
        ...groupExitActions(),
        {label: 'Bring forward', icon: BringForward, divider: true, disabled: !canReorderSelection(editor.slide,editor.selected,1,editor.selectionScope), onselect: () => editor.reorderSelection(1)},
        {label: 'Send backward', icon: SendBackward, disabled: !canReorderSelection(editor.slide,editor.selected,-1,editor.selectionScope), onselect: () => editor.reorderSelection(-1)},
        {label: single ? 'Delete object' : 'Delete objects', icon: Trash2, tone: 'danger', divider: true, disabled: allLocked, onselect: event => void objectAction(() => editor.remove(),event)},
      ]}><Ellipsis size={16} /></ActionMenu>
    </div>
  </div>
  {#if allLocked}
    <div class="inspector-lock-state"><p><Lock size={16} aria-hidden="true" /><span>{single ? 'Locked object' : 'Locked selection'}</span></p><Button variant="secondary" class="full" onclick={() => editor.patch({locked:false})}><Unlock size={16} />{single ? 'Unlock object' : 'Unlock objects'}</Button></div>
  {:else if mixedLocks}<p class="inspector-selection-note">Changes apply to {editable.length} editable {editable.length===1?'object':'objects'}. Locked objects stay unchanged.</p>{/if}
  <GroupMembership standalone/>
  <fieldset class="object-properties" disabled={allLocked}>
    <section class="panel-section inspector-section" aria-label="Layout properties">
      <div class="section-heading"><h3><Ruler size={16} aria-hidden="true"/>Layout</h3><div class="layout-heading-tools"><span>px</span>{#if single&&editable.length&&editable.every(v=>!['text','line','prototype'].includes(v.type))}<Button variant="quiet" size="sm" class="ratio-toggle" aria-label="Keep aspect ratio" aria-pressed={ratioState} title="Keep width and height linked · Shift temporarily reverses this while dragging" onclick={()=>editor.patch({aspectRatioLocked:ratioState!==true})}>{#if ratioState===true}<Link size={14}/>{:else}<Unlink size={14}/>{/if}</Button>{/if}</div></div>
      <div class="property-grid">
        {#each [['x','X'],['y','Y'],['w','Width'],['h','Height']] as [key,label]}
          {@const auto = sameType&&e.type==='text'&&(key==='w'?sizing==='auto-width':key==='h'&&sizing!==''&&sizing!=='fixed')}
          <NumberField {label} prefix={key==='w'?'W':key==='h'?'H':label} disabled={!single&&!positionBounds||single&&Boolean(memberLayout)&&(key==='x'||key==='y')&&memberLayout!.order.length>1} value={!single&&positionBounds?positionBounds[key as 'x'|'y'|'w'|'h'].toFixed(1):Math.round(e[key as 'x'|'y'|'w'|'h']*10)/10} mixed={!single?!positionBounds:mixed(key as keyof SlideElement)} automatic={single&&Boolean(auto)} min={key==='w'||key==='h'?1:-20000} max={20000} step="any" increment={4} hint={auto?key==='w'?'Enter a width to fix it and keep automatic height':'Enter a height to use fixed size':`${label} in px · ↑ / ↓ adjusts by 1 · Shift adjusts to the next 4 px value`} onchange={value=>number(value,key as keyof SlideElement)}/>
        {/each}
      </div>
      
      {#if sameType&&e.type==='text'}<div class="property-choice-row text-resizing"><span>Resizing{#if sizing===''}<small>Mixed</small>{/if}</span><PropertyChoice label="Text resizing" options={sizingOptions} value={sizing} icons disabled={allLocked} onchange={value=>patchText({textSizing:value as SlideElement['textSizing']})}/></div>{/if}
      {#if capabilities.shapeType}<label class="property-select-row"><span>Shape</span><select aria-label="Shape type" value={shapeValue} onchange={event=>changeShape(event.currentTarget.value)}>{#if !shapeValue}<option value="" disabled>Mixed</option>{/if}{#each SHAPE_TOOLS.filter(tool=>tool!=='line'&&tool!=='roundrect') as tool}<option value={tool}>{SHAPE_LABELS[tool]}</option>{/each}</select></label>{/if}
      {#if !(single&&e.type==='text')}<div class="property-grid"><NumberField label="Rotation" icon={RotateCw} value={e.rotation} mixed={mixed('rotation')} unit="°" step="any" onchange={value=>number(value,'rotation')}/>{#if capabilities.radius}<NumberField label="Corner radius" icon={RadiusIcon} value={e.radius} mixed={mixed('radius')} min={0} max={500} unit="px" step="any" onchange={value=>number(value,'radius')}/>{/if}</div>{/if}
      {#if !single}<p class="compact-hint">Width and height scale the editable selection together.</p><AlignmentControls dense/>{:else}<details class="inspector-disclosure" bind:open={sections.transform} use:uiDisclosure={next=>sections.transform=next}><summary><span>{e.type==='text'?'Transform and alignment':'Align to slide'}</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body">{#if e.type==='text'}<NumberField label="Rotation" icon={RotateCw} value={e.rotation} mixed={mixed('rotation')} unit="°" step="any" onchange={value=>number(value,'rotation')}/>{/if}<AlignmentControls dense/></div></details>{/if}
      {#if !memberLayout&&!allLocked}<details class="inspector-disclosure" bind:open={sections.layout} use:uiDisclosure={next=>sections.layout=next}><summary><span>Auto layout</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><ObjectAutoLayout bind:disclosures={layoutPanels}/></div></details>{/if}
      {#if !allLocked&&editor.selection.length>1}<div class="inspector-actions"><Button variant="quiet" disabled={editable.length<2} onclick={grouping}><Group size={14}/>Group</Button></div>{/if}
    </section>
    {#if memberLayout}<ObjectAutoLayout bind:disclosures={layoutPanels}/>{/if}
    {#if !allLocked}
    {#if sameType&&e.type==='text'}
      <InspectorSection title="Typography" icon={Type} bind:open={sections.text}>
        <ObjectStyles mode="text" onedit={onstyles}/>
        <FontPicker onbrowse={onfonts} showLinkHint={false}/>
        <div class="property-grid font-properties"><label class="weight-field"><span class="sr-only">Weight</span><select aria-label="Weight" title="Font weight" value={mixed('fontWeight')?'':linkedWeight?'style':textValue('fontWeight')} onchange={event=>chooseWeight(event.currentTarget.value)}>{#if mixed('fontWeight')}<option value="" disabled>Mixed</option>{/if}{#if weightRole}<option value="style" disabled={Boolean(editor.editingId)}>Style · {styleWeight}</option>{/if}{#each [...new Set([...weights,textValue('fontWeight')])].sort((a,b)=>a-b) as w}<option value={w}>{WEIGHT_LABELS[w]||w}</option>{/each}</select></label><NumberField label="Font size" prefix="Size" hint="Font size in px" value={Math.round(textValue('fontSize')*10)/10} mixed={mixed('fontSize')} min={4} max={500} step="any" onchange={value=>number(value,'fontSize')}/></div>
        <div class="inspector-format-row"><div class="decoration-buttons" role="group" aria-label="Text formatting"><button class="icon-btn" aria-label="Bold" title="Bold" aria-pressed={boldState} onclick={()=>patchText({fontWeight:boldState===true?400:700})}><Bold size={16}/></button><button class="icon-btn" aria-label="Italic" title="Italic" aria-pressed={italicState} onclick={()=>patchText({italic:italicState!==true})}><Italic size={16}/></button><button class="icon-btn" aria-label="Underline" title="Underline" aria-pressed={underlineState} onclick={()=>patchText({underline:underlineState!==true})}><Underline size={16}/></button></div><PropertyChoice label="Text alignment" value={mixed('align')?'':textValue('align')} icons options={[{value:'left',label:'Left',icon:AlignLeft},{value:'center',label:'Center',icon:AlignCenter},{value:'right',label:'Right',icon:AlignRight}]} onchange={value=>patchText({align:value as SlideElement['align']})}/></div>
        <div class="property-choice-row"><span>Vertical</span><PropertyChoice label="Vertical text alignment" value={mixed('verticalAlign')?'':e.verticalAlign} icons options={[{value:'top',label:'Top',icon:textAlignmentIcons.top},{value:'middle',label:'Middle',icon:textAlignmentIcons.middle},{value:'bottom',label:'Bottom',icon:textAlignmentIcons.bottom}]} disabled={sizing!=='fixed'} onchange={value=>patchText({verticalAlign:value as SlideElement['verticalAlign']})}/></div>{#if sizing!=='fixed'}<p class="compact-hint">Use Fixed size to align text vertically.</p>{/if}
        <details class="inspector-disclosure" bind:open={sections.textOptions} use:uiDisclosure={next=>sections.textOptions=next}><summary><span>More text options</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><div class="property-grid"><NumberField label="Line height" prefix="Line" keyboardStep={.05} unit="×" value={textValue('lineHeight')} mixed={mixed('lineHeight')} min={.5} max={4} step="any" onchange={value=>number(value,'lineHeight')}/><NumberField label="Letter spacing" prefix="Letter" value={textValue('letterSpacing')} mixed={mixed('letterSpacing')} min={-30} max={50} unit="px" step="any" onchange={value=>number(value,'letterSpacing')}/></div>{#if single}<label class="field-label">Content<textarea aria-label="Text content" rows="4" value={e.text} oninput={event=>editor.patch({text:event.currentTarget.value},'text')}></textarea></label>{/if}</div></details>
      </InspectorSection>
    {:else if sameType&&e.type==='image'}
      <InspectorSection title={region ? 'Area fill' : 'Image'} icon={Image} label="Image properties" bind:open={sections.image}>
        {#if region}<p class="compact-hint">Resize this area freely. The pattern or texture fills its bounds.</p>{:else}<PropertyChoice label="Image fit mode" value={mixed('fit')?'':e.fit} disabled={Boolean(e.sourceRegion)} options={[{value:'contain',label:'Fit',description:'Keep the entire image visible'},{value:'cover',label:'Fill',description:'Fill the box and crop excess image'},{value:'fill',label:'Stretch',description:'Stretch the image to the box'}]} onchange={value=>editor.patch({fit:value as SlideElement['fit']})}/>{/if}
        {#if recolorable}{#key editor.selected.join(',')}<AsyncFeature feature="resource-appearance" props={{}} />{/key}{/if}
        <div class="inspector-actions"><Button variant="quiet" aria-label="Flip image horizontally" aria-pressed={mixed('flipX')?'mixed':e.flipX} onclick={()=>flip('flipX')}><FlipHorizontal2 size={16}/>Horizontal</Button><Button variant="quiet" aria-label="Flip image vertically" aria-pressed={mixed('flipY')?'mixed':e.flipY} onclick={()=>flip('flipY')}><FlipVertical2 size={16}/>Vertical</Button></div>
        {#if single}<Button variant="secondary" class="full" onclick={()=>onresources?.(e.id)}><Replace size={16}/>Replace image</Button>
        {#if e.sourceRegion}<p class="compact-hint">Replace this source region to adjust its crop.</p>{:else if !region}<details class="inspector-disclosure" bind:open={sections.crop} use:uiDisclosure={next=>sections.crop=next}><summary><span>Crop edges</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><div class="property-grid">{#each ['left','top','right','bottom'] as edge}<NumberField label={`Crop ${edge}`} prefix={edge[0].toUpperCase()+edge.slice(1)} value={Math.round((e.crop?.[edge as keyof NonNullable<SlideElement['crop']>]??0)*10000)/100} unit="%" min={0} max={99.99} step="any" onchange={value=>crop(edge as 'left'|'top'|'right'|'bottom',value)}/>{/each}</div><Button variant="quiet" onclick={()=>{imageError='';editor.patch({crop:undefined});}}>Reset crop</Button>{#if imageError}<p class="inspector-error" role="alert">{imageError}</p>{/if}</div></details>{/if}
        {#if e.resource}<details class="inspector-disclosure resource-provenance" bind:open={sections.provenance} use:uiDisclosure={next=>sections.provenance=next}><summary><span>Source and license</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><p>{e.resource.provider} · {e.resource.license}</p><p>{e.resource.attribution}</p><div><a href={e.resource.sourceUrl} target="_blank" rel="noopener noreferrer">Original source</a> · <a href={e.resource.licenseUrl} target="_blank" rel="noopener noreferrer">License</a></div>{#if e.resource.licenseNotice}<p>{e.resource.licenseNotice}</p>{/if}</div></details>{/if}{/if}
      </InspectorSection>
    {:else if e.type==='prototype'&&e.prototype&&single}
      <InspectorSection title="Prototype" icon={AppWindow} bind:open={sections.prototype}><label class="field-label">Share link<input aria-label="Prototype link" aria-invalid={Boolean(prototypeError)} aria-describedby={prototypeError?'prototype-link-error':undefined} type="url" value={e.prototype.url} onchange={event=>prototypeUrl(event.currentTarget.value)}/></label>{#if prototypeError}<p id="prototype-link-error" class="inspector-error" role="alert">{prototypeError}</p>{/if}<Button variant="secondary" class="full" onclick={()=>onprototype?.(e)}><Play size={16}/>Interactive preview</Button>
        {#if isFigmaPrototype(e.prototype.url)}<details class="inspector-disclosure" bind:open={sections.display} use:uiDisclosure={next=>sections.display=next}><summary><span>Display options</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><label class="field-label">Zoom<select aria-label="Prototype scale" value={e.prototype.scaling} onchange={event=>editor.patch({prototype:{...e.prototype!,scaling:event.currentTarget.value as 'contain'|'scale-down'|'fit-width'}})}><option value="contain">Fit to window</option><option value="scale-down">Scale down only</option><option value="fit-width">Fit width</option></select></label><PropertyChoice label="Prototype layout" value={String(e.prototype.responsive)} options={[{value:'false',label:'Fixed'},{value:'true',label:'Responsive'}]} onchange={value=>editor.patch({prototype:{...e.prototype!,responsive:value==='true'}})}/><label class="check-property"><input type="checkbox" checked={e.prototype.deviceFrame} onchange={event=>editor.patch({prototype:{...e.prototype!,deviceFrame:event.currentTarget.checked}})}/>Device frame</label><label class="check-property"><input type="checkbox" checked={e.prototype.chrome} onchange={event=>editor.patch({prototype:{...e.prototype!,chrome:event.currentTarget.checked}})}/>Figma footer</label></div></details>{:else}<p class="compact-hint">This website controls its own layout.</p>{/if}
        <details class="inspector-disclosure" bind:open={sections.poster} use:uiDisclosure={next=>sections.poster=next}><summary><span>Poster image</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><label class="field-label">Image URL<input aria-label="Prototype poster" type="url" value={e.prototype.poster??''} placeholder="https://…" onchange={event=>editor.patch({prototype:{...e.prototype!,poster:event.currentTarget.value.trim()||undefined}})}/></label><p class="compact-hint">Shown before activation and in static exports.</p></div></details>
      </InspectorSection>
    {:else if sameType&&e.type==='chart'}
      <InspectorSection title="Chart" icon={ChartColumn} bind:open={sections.chart}>{#if single}<ChartProperties element={e}/>{/if}<NumberField label="Data text size" prefix="Text size" value={dataLabelSize(e)} mixed={propertyItems.some(item=>dataLabelSize(item)!==dataLabelSize(e))} min={18} max={28} hint="Chart labels use 18–28 px" step="any" onchange={value=>number(value,'fontSize')}/></InspectorSection>
    {:else if sameType&&e.type==='table'}
      <InspectorSection title="Table" icon={Table2} label="Table properties" bind:open={sections.table}>{#if single}{#key e.id}<ElementDataEditor element={e}/>{/key}{/if}<NumberField label="Data text size" prefix="Text size" value={dataLabelSize(e)} mixed={propertyItems.some(item=>dataLabelSize(item)!==dataLabelSize(e))} min={4} max={500} hint="Table text size in px" step="any" onchange={value=>number(value,'fontSize')}/></InspectorSection>
    {/if}
    <InspectorSection title="Appearance" icon={Paintbrush} bind:open={sections.appearance}>
      {#if capabilities.fill}<div class="color-row"><span>{['text','table'].includes(e.type)?'Text':e.type==='chart'?'Series':'Fill'}</span><ColorField label={['text','table'].includes(e.type)?'Text color':e.type==='chart'?'Series color':'Fill color'} value={e.type==='text'?textValue('fill'):e.fill} mixed={mixed('fill')} onchange={value=>e.type==='text'?patchText({fill:value},'color'):editor.patch({fill:value},'color')}/></div>{/if}
      {#if capabilities.stroke}<div class="stroke-properties"><div class="color-row"><span>{e.type==='table'?'Border':'Stroke'}</span><ColorField label={e.type==='table'?'Border color':'Stroke color'} value={e.stroke} mixed={mixed('stroke')} onchange={stroke}/></div>{#if shapes}<div class="stroke-width"><NumberField label="Stroke width" prefix="Width" value={e.strokeWidth} mixed={mixed('strokeWidth')} min={0} max={100} unit="px" step="any" onchange={value=>number(value,'strokeWidth')}/></div>{/if}</div>{/if}
      <NumberField label="Opacity" prefix="Opacity" value={Math.round(e.opacity*1000)/10} mixed={mixed('opacity')} min={0} max={100} unit="%" step="any" onchange={value=>editor.patch({opacity:value/100})}/>
      {#if styleEligible&&!editor.editingId&&(capabilities.fill||capabilities.stroke)}<details class="inspector-disclosure color-style-links" bind:open={sections.colorStyles} use:uiDisclosure={next=>sections.colorStyles=next}><summary><span>Color styles</span><small>{[capabilities.fill?colorLink('fill'):'',capabilities.stroke?colorLink('stroke'):''].includes('mixed')?'Mixed':[capabilities.fill?colorLink('fill'):'',capabilities.stroke?colorLink('stroke'):''].some(Boolean)?'Linked':'Custom'}</small><ChevronDown size={14}/></summary><div class="inspector-disclosure-body">{#each ['fill','stroke'] as property}{@const key=property as 'fill'|'stroke'}{#if key==='fill'?capabilities.fill:capabilities.stroke}{@const title=key==='fill'?['text','table'].includes(e.type)?'Text':e.type==='chart'?'Series':'Fill':e.type==='table'?'Border':'Stroke'}<label class="property-select-row"><span>{title}</span><select aria-label={`${title} color style`} value={colorLink(key)} onchange={event=>linkColor(key,event.currentTarget.value)}>{#if colorLink(key)==='mixed'}<option value="mixed" disabled>Mixed links</option>{/if}<option value="">Custom</option>{#each colorRoles as role}<option value={role.value}>{role.label}</option>{/each}</select></label>{/if}{/each}</div></details>{/if}
      {#if shapes}<AsyncFeature feature="shape-effects" props={{value:e.shadow,mixed:shadowMixed,mixedFields:shadowMixedFields,disabled:allLocked,onchange:shadow=>editor.patch({shadow}),onpatch:patch=>editor.slide&&editor.commit(shadowPatchOperations(editor.slide,editor.selected,patch),'shadow')}}/>{/if}
    </InspectorSection>
    {#if !sameType&&!capabilities.fill&&!capabilities.stroke&&styleEligible}<details class="panel-section inspector-section inspector-disclosure" bind:open={sections.colorStyles} use:uiDisclosure={next=>sections.colorStyles=next}><summary><span>Color styles</span><ChevronDown size={14}/></summary><div class="inspector-disclosure-body"><ObjectStyles mode="colors"/></div></details>{/if}
    {/if}
  </fieldset>
{/if}
{/key}
{/if}
<style>
  .panel-section{padding:12px;gap:8px}
  .object-summary{padding-block:8px;position:sticky;top:0;z-index:2;background:var(--surface-chrome)}
  @media(max-height:520px){.object-summary{position:static}}
  .object-heading{gap:8px;min-width:0}
  .object-type-icon{display:grid;place-items:center;width:32px;height:32px;flex:none;color:var(--text-secondary)}
  .object-heading-copy{flex:1;min-width:0;gap:2px}
  .object-heading-copy>span{font-size:var(--ui-meta);line-height:var(--ui-line-body)}
  .object-name{padding:4px 8px;margin-left:-8px;min-height:32px;font-size:var(--ui-text);border-radius:var(--r-control)}
  .object-name:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}
  .inspector-lock-state{padding:12px 16px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--border-subtle)}
  .inspector-lock-state p{display:flex;align-items:center;gap:8px;font-size:var(--ui-label);color:var(--text-secondary)}
  .inspector-selection-note,.compact-hint{font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--text-secondary)}
  .inspector-selection-note{padding:8px 16px;border-bottom:1px solid var(--border-subtle)}
  h3{font-size:var(--ui-label);line-height:var(--ui-line-body)}
  .section-heading{display:flex;align-items:center;justify-content:space-between}
  .section-heading h3{display:flex;align-items:center;gap:8px;margin:0;min-width:0}.section-heading h3 :global(svg){flex:none;color:var(--text-secondary)}
  .layout-heading-tools{display:flex;align-items:center;gap:8px}.layout-heading-tools :global(.ratio-toggle){min-width:36px;min-height:36px;padding:8px}.layout-heading-tools>span{font-size:var(--ui-meta);color:var(--text-tertiary)}
  .property-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,6.5rem),1fr));gap:8px;min-width:0}
  .field-label{min-width:0;margin:0;gap:4px}
  .field-label input,.field-label select,.weight-field select{min-height:var(--property-control-height,36px);background:var(--field-surface);border-color:var(--field-border)}
  .weight-field{min-width:0}.property-select-row{display:flex;align-items:center;gap:8px;min-width:0;font-size:var(--ui-label);color:var(--text-secondary)}.property-select-row>span{flex:none}.property-select-row select{flex:1;min-width:0;min-height:var(--property-control-height,36px);padding-block:4px;font-size:var(--ui-label)}.color-style-links summary small{font-size:var(--ui-meta)}
  .weight-field select{width:100%;font-size:var(--ui-label)}
  textarea{background:var(--field-surface);border-color:var(--field-border);font-size:var(--ui-body);line-height:var(--ui-line-reading);resize:vertical}
  .inspector-format-row{display:flex;align-items:stretch;gap:8px;min-width:0}
  .decoration-buttons{display:flex;align-items:center;gap:2px;flex:1;min-width:0}
  .decoration-buttons button{flex:1;min-width:32px;min-height:36px;height:auto;padding:4px;border-radius:var(--r-sm)}
  .decoration-buttons button[aria-pressed='true']{background:var(--state-selected);color:var(--text-link)}
  .decoration-buttons button[aria-pressed='mixed']{background:var(--state-hover)}
  .inspector-format-row :global(.property-choice){flex:1;min-width:0}
  .property-choice-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;font-size:var(--ui-label);color:var(--text-secondary)}
  .property-choice-row>span{display:flex;flex-direction:column;flex:none;gap:2px}
  .property-choice-row small{font-size:var(--ui-meta)}
  .property-choice-row :global(.property-choice){flex:none;max-width:100%}
  .inspector-disclosure{min-width:0}
  .inspector-disclosure>summary{display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer;list-style:none;color:var(--text-secondary);font-size:var(--ui-label)}
  .inspector-disclosure>summary::-webkit-details-marker{display:none}
  .inspector-disclosure>summary span{flex:1;min-width:0}
  .inspector-disclosure>summary :global(svg){flex:none}
  .inspector-disclosure[open]>summary :global(svg){rotate:180deg}
  .inspector-disclosure>summary:focus-visible{outline:2px solid var(--accent-line);outline-offset:0;border-radius:var(--r-sm)}
  .inspector-disclosure-body{display:flex;flex-direction:column;gap:8px;padding-block:8px 4px}
  .inspector-actions{display:flex;gap:8px;flex-wrap:wrap}
  .inspector-actions :global(button){flex:1 1 7rem;min-width:0;white-space:normal}
  .inspector-actions :global(button[aria-pressed='true']){background:var(--state-selected);color:var(--text-link)}
  .stroke-properties{display:flex;flex-direction:column;gap:8px}.stroke-width{padding-left:48px;min-width:0}
  .color-row{display:grid;grid-template-columns:40px minmax(0,1fr);gap:8px;align-items:start;font-size:var(--ui-label);color:var(--text-secondary)}
  .color-row>span{padding-block:8px;line-height:20px}
  .check-property{display:flex;align-items:center;gap:8px;min-height:32px;font-size:var(--ui-label)}
  .check-property input{width:16px;height:16px;padding:0;flex:none}
  .resource-provenance{font-size:var(--ui-label);line-height:var(--ui-line-reading)}
  .resource-provenance p,.resource-provenance a{overflow-wrap:anywhere}
  .inspector-error{font-size:var(--ui-meta);color:var(--danger-text)}
  @media(max-width:760px),(pointer:coarse){
    .object-name,.field-label input,.field-label select,.weight-field select,.property-select-row select,.inspector-disclosure>summary,.check-property{min-height:44px}
    .inspector-format-row{flex-wrap:wrap}.decoration-buttons{flex-basis:100%}.decoration-buttons button{min-height:44px;min-width:44px}
    .property-choice-row{align-items:stretch;flex-direction:column;gap:4px}.property-choice-row>span{flex-direction:row;gap:8px}.property-choice-row :global(.property-choice){width:100%}
    .object-summary :global(.ui-button),.inspector-lock-state :global(.ui-button),.inspector-section :global(.ui-button){min-height:44px}
    .object-summary :global(.object-menu .ui-button){min-width:44px}
    .color-row{grid-template-columns:32px minmax(0,1fr)}.stroke-width{padding-left:40px}
  }
  @media(max-width:760px),(pointer:coarse){.layout-heading-tools :global(.ratio-toggle){min-width:44px;min-height:44px}}
  @media(min-width:761px){.inspector-section{container-type:inline-size}}
  @container(max-width:13rem){.inspector-format-row{flex-wrap:wrap}.decoration-buttons{flex-basis:100%}.color-row{grid-template-columns:1fr;gap:4px}.color-row>span{padding:0}.stroke-width{padding-left:0}}
</style>
