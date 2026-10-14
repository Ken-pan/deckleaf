<script lang="ts">
  import {rememberPanelScroll} from '../panel-scroll.svelte';
  import {slideLabel} from '../core/slide-label';
  import '../motion-panel.css';
  import { countLabel } from "../core/ui-copy";
  import { tick, untrack, setContext } from 'svelte';
  import { Play, Sparkles, ArrowUp, ArrowDown, CopyPlus, ExternalLink, MousePointer2, Clapperboard, ChevronLeft, ChevronRight, ChevronDown, PanelsTopLeft, ListOrdered } from '@lucide/svelte';
  import { Button, IconButton, SegmentedControl , EmptyState} from './ui';
  import { editor } from '../core/editor.svelte';
  import { ANIMATIONS, MOTION_RECIPES, defaultTransition, defaultAnimation, suggestEntrances, type MotionRecipe } from '../core/motion';
  import { TRANSITION_PRESETS, transitionPreset } from '../core/transitions';
  import TransitionPicker from './TransitionPicker.svelte';
  import TransitionPreview from './TransitionPreview.svelte';
  import SmartAnimatePreview from './SmartAnimatePreview.svelte';
  import { matchSmartLayers } from '../core/smart-motion';
  import { createNextMotionState, entranceSequence, moveEntranceGroup } from '../core/motion-authoring';
  import NumberField from './ui/NumberField.svelte';
  import Notice from './ui/Notice.svelte';
  import {uiDisclosure} from '../ui-motion';
  import {motionPropertyState} from '../core/motion-properties';
  import PropertyChoice from './ui/PropertyChoice.svelte';
  import type { ElementAnimation, SlideTransition } from '../core/model';
  let {onpreview, active = true,disabled=false,onexitpreview}: {onpreview: (fromId?:string) => void; active?: boolean;disabled?:boolean;onexitpreview?:()=>void} = $props();
  type Scope = 'page' | 'object' | 'sequence';
  let scope=$state<Scope>('page'), recipe=$state<MotionRecipe>('quiet');
  let body=$state<HTMLDivElement>();
  rememberPanelScroll(()=>active,()=>`${editor.deck?.id}:${editor.activeId}:${scope}:${editor.selected.join(',')}`,()=>[body]);
  let lastSelection='';
  let disclosures=$state({matches:false,more:false,order:false,matching:false});
  let sequencePages=$state({auto:0,click:0}),expandedGroups=$state<Record<string,boolean>>({}),matchLimit=$state(20);
  $effect(()=>{editor.activeId;sequencePages={auto:0,click:0};expandedGroups={};matchLimit=20;});
  const selection=$derived(editor.selection);
  let editable=$derived(selection.filter(e=>!e.locked));
  let selected=$derived(editable[0]??selection[0]);
  const propertyItems=$derived(editable.length?editable:selection);
  setContext('property-edit-scope',()=>`${editor.deck?.id}:${editor.activeId}:${editor.selected.join(',')}:${scope}`);
  let transition=$derived(editor.slide?.transition ?? defaultTransition);
  let preset=$derived(transitionPreset(transition.effect));
  let animation=$derived(selected?.animation ?? defaultAnimation);
  let pageIndex=$derived(editor.deck?.slides.findIndex(s=>s.id===editor.slide?.id) ?? -1);
  let previous=$derived(editor.deck?.slides[pageIndex-1]), next=$derived(editor.deck?.slides[pageIndex+1]);
  let matches=$derived(active&&transition.effect==='smart'&&previous&&editor.slide?matchSmartLayers(previous,editor.slide):{pairs:[],issues:[]});
  let sharedIds=$derived(transition.effect==='smart'?matches.pairs.map(p=>p.to.id):[]);
  let previousPair=$derived(matches.pairs.find(p=>p.to.id===selected?.id));
  let nextPair=$derived(active&&scope==='object'&&next?.transition?.effect==='smart'&&editor.slide?matchSmartLayers(editor.slide,next).pairs.find(p=>p.from.id===selected?.id):undefined);
  let relevantPair=$derived(transition.effect==='smart'?previousPair:next?.transition?.effect==='smart'?nextPair:undefined);
  let association=$derived(transition.effect==='smart'||next?.transition?.effect==='smart'||Boolean(selected?.motionKey));
  let unsupported=$derived(selected && (selected.type==='prototype'||selected.type==='line'||Boolean(selected.sourceRegion)));
  let mixed=$derived(propertyItems.length>1&&propertyItems.some(e=>JSON.stringify(e.animation??defaultAnimation)!==JSON.stringify(animation)));
  let mixedEffect=$derived(motionPropertyState(propertyItems,'effect').mixed);
  let suggestions=$derived(active&&scope==='sequence'&&editor.deck&&editor.slide?suggestEntrances(editor.deck,editor.slide,recipe,sharedIds):[]);
  let autoGroups=$derived(active&&scope==='sequence'&&editor.slide?entranceSequence(editor.slide,'auto'):[]), clickGroups=$derived(active&&scope==='sequence'&&editor.slide?entranceSequence(editor.slide,'click'):[]);
  $effect(()=>{const ids=editor.selection.map(e=>e.id).join('|');untrack(()=>{if(ids!==lastSelection){if(ids)scope='object';else if(scope==='object')scope='page';lastSelection=ids;}});});
  function page(patch:Partial<SlideTransition>){if(editor.slide&&!disabled)editor.commit([{op:'update_slide',slideId:editor.slide.id,patch:{transition:{...transition,...patch}}}],`motion-slide-${Object.keys(patch).join('-')}`);}
  function chooseEffect(effect:SlideTransition['effect']){page({effect,...(!editor.slide?.transition?{duration:transitionPreset(effect).duration,easing:transitionPreset(effect).easing}:{})});}
  function node(patch:Partial<ElementAnimation>){if(editor.slide&&!disabled)editor.commit(editable.map(e=>({op:'update_element',slideId:editor.slide!.id,elementId:e.id,patch:{animation:{...defaultAnimation,...e.animation,...patch}}})),`motion-${Object.keys(patch).join('-')}`);}
  function differs(key:keyof ElementAnimation){return motionPropertyState(propertyItems,key).mixed;}
  function nextState(){if(!editor.deck||!editor.slide||disabled)return;try{const revision=editor.deck.revision,{slide,operations}=createNextMotionState(editor.deck,editor.slide);editor.commit(operations,'','manual',revision);if(editor.deck.slides.some(s=>s.id===slide.id)){editor.chooseSlide(slide.id);editor.sourceMode=false;scope='page';editor.notify('Next state created. Adjust objects, then preview smart animate.');}}catch(error){editor.error=error instanceof Error?error.message:'Could not create the next state. Try again.';}}
  async function chooseObject(id:string){editor.sourceMode=false;editor.choose(id);scope='object';await tick();document.querySelector<HTMLSelectElement>('.motion-panel [aria-label="Entrance effect"]')?.focus({preventScroll:true});}
</script>
<div class="inspector-content motion-panel" data-motion-scope={scope}>
  <div class="motion-scope"><SegmentedControl label="Motion scope" options={[{value:'page',label:'Slide',ariaLabel:'Slide transition'},{value:'object',label:'Object',ariaLabel:'Object entrance'},{value:'sequence',label:'Order',ariaLabel:'Order of entrance effects'}]} value={scope} onchange={value=>scope=value as Scope}/></div>
  <div class="motion-panel-body" bind:this={body} tabindex="-1">{#if active}{#if disabled}<Notice tone="info" message="Exit the AI preview to edit motion.">{#snippet actions()}<Button variant="secondary" onclick={onexitpreview}>Exit preview</Button>{/snippet}</Notice>{/if}<fieldset class="motion-controls" {disabled}>
    {#if scope==='page'}
      <section class="panel-section motion-page-settings" aria-label="Slide transition settings">
        <div class="motion-context"><h3><PanelsTopLeft size={16} aria-hidden="true"/>Slide transition</h3><span>{slideLabel(editor.deck?.slides.findIndex(s=>s.id===editor.slide?.id)??0)}</span></div>
        {#key editor.slide?.id}<TransitionPicker value={transition.effect} onchange={chooseEffect}/>{/key}
        <p class="hint motion-effect-description">{preset.description}</p>
        {#if transition.effect==='smart' && editor.deck && editor.slide}<SmartAnimatePreview deck={editor.deck} from={previous} to={editor.slide} {active}/>{:else}<TransitionPreview {transition} {active}/>{/if}
        <div class="field-grid motion-timing"><div class="motion-number-setting"><span aria-hidden="true">Duration</span><NumberField label="Transition duration" prefix="" unit="ms" min={100} max={2000} step="any" keyboardStep={50} disabled={transition.effect==='none'} value={transition.duration} onchange={duration=>page({duration})}/></div><label class="field-label">Easing<select aria-label="Transition easing" disabled={transition.effect==='none'} value={transition.easing} onchange={e=>page({easing:e.currentTarget.value as SlideTransition['easing']})}><option value="smooth">Smooth</option><option value="snappy">Snappy</option><option value="linear">Linear</option><option value="cinematic">Cinematic</option></select></label></div>
        <Button variant="quiet" size="sm" disabled={transition.effect==='none'} onclick={()=>page({duration:preset.duration,easing:preset.easing})} title={`Use preset duration (${preset.duration} ms) and easing`} aria-label="Reset timing to preset defaults">Reset timing</Button>
        {#if transition.effect==='smart'}
          {#if previous}<details bind:open={disclosures.matches} use:uiDisclosure={next=>disclosures.matches=next} class="motion-disclosure motion-match-details"><summary><span>Object matches</span><small>{countLabel(matches.pairs.length, "object")}{matches.issues.length?` · ${countLabel(matches.issues.length, 'issue')} to review`:''}</small><ChevronDown class="motion-disclosure-chevron" size={14} aria-hidden="true"/></summary><div class="motion-disclosure-body"><p class="hint">Match IDs take priority; otherwise, objects match by a unique name within the same group. Returning reverses the animation.</p>{#each matches.issues as issue}<p class="motion-match-warning">{issue}</p>{/each}{#each matches.pairs.slice(0,matchLimit) as p}<button class:active={selected?.id===p.to.id} onclick={()=>void chooseObject(p.to.id)}><span>{p.to.name}</span><small>{p.dissolve?'Movement and dissolve':p.changed.length?'Continuity':'Static'}</small></button>{/each}{#if matches.pairs.length>matchLimit}<Button variant="quiet" onclick={()=>matchLimit+=20}>Show more matches</Button>{/if}{#if !matches.pairs.length}<p class="hint">No matching objects yet. Duplicate the previous state or select an object to configure matching.</p>{/if}</div></details>{:else}<p class="hint">Duplicate this slide, then adjust objects on the copy.</p>{/if}
        {/if}
        <div class="motion-next-state"><Button variant="secondary" size="sm" class="full" disabled={!editor.deck||editor.deck.slides.length>=500} aria-label="Duplicate state as the next slide" title="Duplicate this slide as the next motion state" onclick={nextState}><CopyPlus size={14}/>Duplicate state</Button></div>
        <details bind:open={disclosures.more} use:uiDisclosure={next=>disclosures.more=next} class="motion-disclosure"><summary><span>More options</span><ChevronDown class="motion-disclosure-chevron" size={14} aria-hidden="true"/></summary><div class="motion-disclosure-body"><a href="/examples/modern-transitions-showcase.html" target="_blank" rel="noopener noreferrer">View all {TRANSITION_PRESETS.length} transition demos <ExternalLink size={13} /></a><a href="/examples/smart-motion-studies.html" target="_blank" rel="noopener noreferrer">View smart animate examples <ExternalLink size={13} /></a><Button variant="quiet" size="sm" class="full" disabled={!editor.deck||editor.deck.slides.length<2} onclick={()=>editor.commit(editor.deck!.slides.map(s=>({op:'update_slide',slideId:s.id,patch:{transition}})))} title={`Apply this transition to all ${editor.deck?.slides.length ?? 0} slides`}>Apply to all slides</Button></div></details>
      </section>
    {:else if scope==='object'}
      <section class="panel-section" aria-label="Object entrance settings">
        <div class="motion-context"><h3><Clapperboard size={16} aria-hidden="true"/>Object entrance</h3><span>{editor.selection.length>1?`Selected ${countLabel(editor.selection.length, "object")}`:selected?.name || 'No object selected'}</span></div>
        {#if selected}
          {#if !editable.length}<p class="hint">Selected objects are locked. Unlock them to edit motion.</p>{:else if mixed}<p class="mixed-note">Mixed settings. Locked objects stay unchanged.</p>{/if}
          <fieldset disabled={!editable.length}>
            <label class="field-label">Entrance effect<select aria-label="Entrance effect" value={mixedEffect?'mixed':animation.effect} onchange={e=>node({effect:e.currentTarget.value as ElementAnimation['effect']})}>{#if mixedEffect}<option value="mixed" disabled>Mixed settings</option>{/if}{#each ANIMATIONS as [id,label]}<option value={id}>{label}</option>{/each}</select></label>
            {#if mixedEffect||animation.effect!=='none'}
              <div class="field-label"><span>Trigger</span><PropertyChoice label="Entrance trigger" value={differs('trigger')?'':animation.trigger} options={[{value:'auto',label:'Automatic'},{value:'click',label:'On click'}]} disabled={!editable.length} onchange={value=>node({trigger:value as 'auto'|'click'})}/></div>
              {#if !differs('trigger')&&animation.trigger==='auto'}<label class="motion-with-transition"><input type="checkbox" indeterminate={differs('withTransition')} checked={Boolean(animation.withTransition)} disabled={!editable.length} onchange={e=>node({withTransition:e.currentTarget.checked})}/><span>Run with slide transition</span></label>{/if}
              <div class="field-grid"><NumberField label="Entrance duration" prefix="Duration" unit="ms" min={100} max={2000} step="any" keyboardStep={50} value={animation.duration} mixed={differs('duration')} onchange={duration=>node({duration})}/><NumberField label="Entrance delay" prefix="Delay" unit="ms" min={0} max={5000} step="any" keyboardStep={50} value={animation.delay} mixed={differs('delay')} onchange={delay=>node({delay})}/></div>
              <details bind:open={disclosures.order} use:uiDisclosure={next=>disclosures.order=next} class="motion-disclosure"><summary><span>Order and easing</span><ChevronDown class="motion-disclosure-chevron" size={14} aria-hidden="true"/></summary><div class="motion-disclosure-body"><NumberField label="Play order" prefix="Order" min={1} max={3001} step={1} value={animation.order+1} mixed={differs('order')} onchange={order=>node({order:order-1})}/><p class="hint">On-click objects with the same number appear together. Automatic entrances are staggered in order.</p><label class="field-label">Entrance easing<select aria-label="Entrance easing" value={differs('easing')?'mixed':animation.easing} onchange={e=>node({easing:e.currentTarget.value as ElementAnimation['easing']})}>{#if differs('easing')}<option value="mixed" disabled>Mixed settings</option>{/if}<option value="smooth">Smooth</option><option value="snappy">Snappy</option><option value="linear">Linear</option></select></label></div></details>
            {/if}
          </fieldset>
          {#if animation.effect!=='none'&&sharedIds.includes(selected.id)}<p class="hint">This object continues across slides. Entrance effects play in a single-slide preview or replay.</p>{/if}
          {#if association}<details bind:open={disclosures.matching} use:uiDisclosure={next=>disclosures.matching=next} class="motion-disclosure"><summary><span>Object matching</span><small>{unsupported?'Independent':selected.motionMatch==='off'?'Excluded':relevantPair?'Matched':'Automatic'}</small><ChevronDown class="motion-disclosure-chevron" size={14} aria-hidden="true"/></summary><div class="motion-disclosure-body">
            {#if unsupported}<p class="hint">{selected.type==='prototype'?'Prototypes keep their own interaction and do not animate across slides.':'This object uses dissolve and does not animate across slides.'}</p>{:else}<label class="field-label">Match mode<select aria-label="Match mode across slides" disabled={selected.locked||editor.selection.length!==1} value={selected.motionMatch ?? 'auto'} onchange={e=>editor.patch({motionMatch:e.currentTarget.value as 'auto'|'off'})}><option value="auto">Automatic</option><option value="off">Exclude from smart animate</option></select></label><label class="field-label">Match ID<input aria-label="Match ID across slides" maxlength="80" disabled={selected.locked||editor.selection.length!==1} value={selected.motionKey ?? ''} placeholder="For example: hero-image" onchange={e=>editor.patch({motionKey:e.currentTarget.value.trim()})}/></label><p class="hint">{editor.selection.length!==1?'Select one object to edit matching settings.':relevantPair?`Matched on the ${transition.effect==='smart'?'previous':'next'} slide to “${transition.effect==='smart'?relevantPair.from.name:relevantPair.to.name}”.`:'Use the same ID for the same object in adjacent states. Each ID must appear only once per slide.'}</p>{/if}
          </div></details>{/if}
        {:else}<EmptyState density="inline" icon={MousePointer2} title="Select an object" description="" />{/if}
      </section>
    {:else}
      <section class="panel-section" aria-label="Play order settings">
        <div class="motion-context"><h3><ListOrdered size={16} aria-hidden="true"/>Play order</h3><span>{countLabel(autoGroups.length, 'automatic group')} · {countLabel(clickGroups.length, 'click step')}</span></div>
        <label class="field-label">Slide sequence<select aria-label="Motion sequence style" bind:value={recipe}>{#each MOTION_RECIPES as [id,label]}<option value={id}>{label}</option>{/each}</select></label>
        <Button variant="secondary" size="sm" class="full" disabled={!suggestions.length} title={`Apply entrance effects to ${countLabel(suggestions.length, 'object')} without motion`} aria-label="Apply sequence to objects without motion" onclick={()=>editor.commit(suggestions)}><Sparkles size={14}/>Apply sequence</Button>
        <p class="hint">Applies only to objects without motion.</p>
      </section>
      {#if editor.slide&&(autoGroups.length||clickGroups.length)}<section class="panel-section motion-list" aria-label="Entrance sequence">{#each ['auto','click'] as trigger}{@const groups=trigger==='auto'?autoGroups:clickGroups}{#if groups.length}{@const page=Math.min(sequencePages[trigger as 'auto'|'click'],Math.max(0,Math.ceil(groups.length/20)-1))}<div class="motion-sequence"><h4>{trigger==='auto'?'Automatic entrances':'On-click entrances'}</h4>{#if groups.length>20}<nav class="motion-pagination" aria-label={`${trigger==='auto'?'Automatic':'On-click'} entrance groups`}><Button variant="quiet" aria-label={`Previous ${trigger} groups`} disabled={page===0} onclick={()=>sequencePages[trigger as 'auto'|'click']=page-1}><ChevronLeft size={16}/></Button><span>{page*20+1}–{Math.min(groups.length,(page+1)*20)} of {groups.length}</span><Button variant="quiet" aria-label={`Next ${trigger} groups`} disabled={(page+1)*20>=groups.length} onclick={()=>sequencePages[trigger as 'auto'|'click']=page+1}><ChevronRight size={16}/></Button></nav>{/if}{#each groups.slice(page*20,(page+1)*20) as group,offset}{@const i=page*20+offset}{@const groupKey=`${trigger}:${group.order}`}<div class="motion-cue-group"><div class="motion-cue-head"><span>{trigger==='auto'?'Group':'Step'} {i+1}</span><div><IconButton label={`Move earlier ${trigger==='auto'?'Entrance group':'Click steps'} ${i+1}`} size="sm" disabled={!group.canMoveEarlier} onclick={()=>editor.commit(moveEntranceGroup(editor.slide!,trigger as 'auto'|'click',group.order,-1))}><ArrowUp size={13}/></IconButton><IconButton label={`Move later ${trigger==='auto'?'Entrance group':'Click steps'} ${i+1}`} size="sm" disabled={!group.canMoveLater} onclick={()=>editor.commit(moveEntranceGroup(editor.slide!,trigger as 'auto'|'click',group.order,1))}><ArrowDown size={13}/></IconButton></div></div>{#each expandedGroups[groupKey]?group.elements:group.elements.slice(0,10) as e}<button class:active={editor.selected.includes(e.id)} onclick={()=>void chooseObject(e.id)}><strong>{e.name}</strong><small>{ANIMATIONS.find(a=>a[0]===e.animation?.effect)?.[1]} · {e.animation!.duration}ms{e.animation!.delay?` · Delay ${e.animation!.delay}ms`:''}</small></button>{/each}{#if group.elements.length>10}<Button variant="quiet" size="sm" aria-expanded={Boolean(expandedGroups[groupKey])} onclick={()=>expandedGroups[groupKey]=!expandedGroups[groupKey]}>{expandedGroups[groupKey]?'Show fewer objects':`Show all ${group.elements.length} objects`}</Button>{/if}</div>{/each}</div>{/if}{/each}</section>{:else}<div class="panel-section"><EmptyState density="inline" icon={Clapperboard} title="No entrance effects yet" description="Apply a slide sequence above, or select an object to set its motion." /></div>{/if}
    {/if}
  </fieldset>{/if}</div>
  <div class="motion-panel-footer"><Button variant="secondary" class="full" disabled={!editor.slide||disabled} onclick={()=>onpreview(scope==='page'&&transition.effect==='smart'?previous?.id:undefined)}><Play size={14}/>{scope==='page'&&transition.effect==='smart'&&previous?'Preview smart animate':'Preview current slide'}</Button>{#if editor.sourceMode}<p class="hint">Preview uses the editable version. Source references stay static.</p>{/if}</div>
</div>
<style>
.motion-with-transition{display:flex;align-items:center;gap:8px;min-height:44px;font-size:var(--ui-label)}.motion-with-transition input{width:16px;height:16px;min-height:0;flex:none;padding:0}.motion-controls{margin:0;padding:0;border:0;min-width:0}.motion-controls:disabled{opacity:1}.motion-panel :global(.panel-section){padding:12px;gap:8px}
.motion-context h3{display:flex;align-items:center;gap:8px;min-width:0}.motion-context h3 :global(svg){flex:none;color:var(--text-secondary)}
.motion-number-setting{display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--text-secondary);font-size:var(--ui-label)}
.motion-timing{align-items:end}.motion-controls .field-label{margin:0;gap:4px}
.motion-controls .field-label select{font-size:var(--ui-label);line-height:var(--ui-line-control)}
</style>
