<script lang="ts">
  import AsyncFeature from './AsyncFeature.svelte';
  import {objectClipboardActions} from '../clipboard-actions';
  import {editor} from '../core/editor.svelte';
  import {createContainerTree,groupBox} from '../core/container-tree';
  import type {SlideGroup} from '../core/model';
  import {Button,ActionMenu} from './ui';
  import NumberField from './ui/NumberField.svelte';
  import {layoutNumberPresets} from '../core/numeric-field';
  import GroupMembership from './GroupMembership.svelte';
  import {groupExitActions} from '../group-exit-actions';
  import {moveElements} from '../core/operations';
  import {selectionMembers,resizeSelectionFrame,scaleSelection} from '../core/selection-transform';
  import {resizeLayout,layoutResizeAxes} from '../core/layout-resize';
  import {uiDisclosure} from '../ui-motion';
  import {Group,ChevronDown,ChevronRight,Copy,Ungroup,Ellipsis,Lock,Unlock,Check} from '@lucide/svelte';
  import {EnterGroupIcon} from './icons/workspace-icons';
  import {layoutIcons} from './icons/layout-icons';
  let {disclosures=$bindable({scale:false,hierarchy:false})}: {disclosures?:{scale:boolean;hierarchy:boolean}}=$props();
  let editingBlock=$state(false);
  let tree=$derived(editor.slide?createContainerTree(editor.slide):undefined);
  let groups=$derived(tree?.groups??[]);
  let group=$derived(groups.find(g=>g.id===editor.selectedContainer));
  let layout=$derived(editor.slide?.autoLayouts?.find(l=>l.id===group?.id));
  let locked=$derived(Boolean(group&&tree?.stats.get(group.id)?.locked));
  let count=$derived(group?tree?.stats.get(group.id)?.count??0:0);
  let box=$derived(group?groupBox(editor.slide!,group.id):null);
  let contentScale=$state(100);
  let contentScaleValid=$state(true);
  let canScaleContents=$derived(!layout||Boolean(editor.slide&&layoutResizeAxes(editor.slide,layout.id).h));
  $effect(()=>{group?.id;contentScale=100;});
  let ancestors=$derived(group?[...tree!.ancestors(group.id)].reverse():[]);
  function transform(value:number,key:'x'|'y'|'w'|'h'){
    if(!box||!group||locked)return;
    const deck=editor.operationDocument(),slide=editor.slide!;
    if(key==='x'||key==='y')editor.commit(moveElements(deck,slide.id,editor.selected,key==='x'?value-box.x:0,key==='y'?value-box.y:0,group.id),`container-${key}`);
    else{const members=selectionMembers(slide,editor.selected,false,group.id),delta=value-box[key],to=resizeSelectionFrame(box,members,key==='w'?delta:0,key==='h'?delta:0,'se',true);editor.commit(scaleSelection(deck,slide.id,editor.selected,box,to,group.id),`container-${key}`);}
  }
  function name(id:string){return tree?.layouts.get(id)?.name??tree?.groupById.get(id)?.name??'Group';}
  function path(id:string){return [...(tree?.ancestors(id)??[])].reverse().map(name).concat(name(id)).join(' / ');}
  function parentLabel(id:string){const chain=[...(tree?.ancestors(id)??[])].reverse().map(name);return name(id)+(chain.length?' — '+chain.join(' / '):'');}
  function scaleContents(){
    if(!box||!group||locked||!canScaleContents||contentScale===100)return;
    const members=selectionMembers(editor.slide!,editor.selected,false,group.id),factor=contentScale/100;
    const frame=resizeSelectionFrame(box,members,box.w*(factor-1),box.h*(factor-1),'se',true);
    const ops=scaleSelection(editor.operationDocument(),editor.slide!.id,editor.selected,box,frame,group.id);
    if(layout&&group.layoutItem){
      const releases=resizeLayout(editor.slide!,group.id,frame,{w:group.layoutItem.widthMode==='fill',h:group.layoutItem.heightMode==='fill'});
      for(const release of releases){
        const index=ops.findIndex(op=>op.op===release.op&&(op.op==='set_group'?op.group.id:op.op==='set_group_layout'?op.layout.id:'')===group!.id);
        const scaled=ops[index];
        if(release.op==='set_group'){
          const base=scaled?.op==='set_group'?scaled.group:release.group;
          const op={...release,group:{...base,layoutItem:{...base.layoutItem!,widthMode:release.group.layoutItem!.widthMode,heightMode:release.group.layoutItem!.heightMode}}};
          if(index>=0)ops[index]=op;else ops.push(op);
        }else if(release.op==='set_group_layout'&&scaled?.op==='set_group_layout')ops[index]={...scaled,layout:{...scaled.layout,...(group.layoutItem.widthMode==='fill'?{widthMode:'fixed' as const}:{}),...(group.layoutItem.heightMode==='fill'?{heightMode:'fixed' as const}:{})}};
      }
    }
    editor.commit(ops);contentScale=100;
  }
  async function ungroup(){const children=tree?.childGroups.get(group!.id)??[],direct=tree?.directElements.get(group!.id)??[],revision=editor.deck!.revision;await editor.group(true);if(editor.deck!.revision!==revision&&children.length===1&&!direct.length)editor.chooseGroup(children[0].id);}
  function patch(value:Partial<SlideGroup>){if(group)editor.commit([{op:'set_group',slideId:editor.slide!.id,group:{...group,...value}}]);}
  function rename(event:Event){
    const input=event.currentTarget as HTMLInputElement,name=input.value.trim();
    if(!group||locked)return;
    if(!name){input.value=layout?.name??group.name;return;}
    if(name===group.name&&(!layout||name===layout.name))return;
    editor.commit([{op:'set_group',slideId:editor.slide!.id,group:{...group,name}},...(layout?[{op:'set_group_layout' as const,slideId:editor.slide!.id,layout:{...layout,name}}]:[])]);
  }
</script>
{#if group}
<section class="panel-section inspector-section" aria-label="Container properties">
  {#if ancestors.length}<nav class="container-path" aria-label="Container hierarchy">{#each ancestors as id,i}<button class="text-btn" onclick={()=>editor.chooseGroup(id)} title={path(id)}>{name(id)}</button>{#if i<ancestors.length-1}<ChevronRight size={12}/>{/if}{/each}</nav>{/if}
  {#if group.block}<Button variant="secondary" disabled={locked} onclick={()=>editingBlock=true}>Edit block</Button>{/if}
  {#if editingBlock&&group.block}<AsyncFeature feature="blocks" props={{targetGroupId:group.id,onclose:()=>editingBlock=false}} onclose={()=>editingBlock=false} modalTitle="Edit block"/>{/if}
  <div class="container-heading"><div class="container-identity"><div class="container-name">{#if layout}{@const LayoutIcon=layoutIcons[layout.direction]}<LayoutIcon size={16} aria-hidden="true"/>{:else}<Group size={16} aria-hidden="true"/>{/if}<input type="text" aria-label={layout?'Auto layout name':'Group name'} title={layout?.name??group.name} value={layout?.name??group.name} maxlength="200" disabled={locked} onchange={rename}/></div><p class="hint">{layout?'Auto layout':'Group'} · {count} {count===1?'object':'objects'}</p></div>
    <div class="container-actions"><button type="button" class="icon-btn" aria-label={group.id===editor.editingGroup?'Done editing group':'Enter group'} onclick={()=>group!.id===editor.editingGroup?editor.exitGroup():editor.enterGroup()}>{#if group.id===editor.editingGroup}<Check size={16}/>{:else}<EnterGroupIcon size={16}/>{/if}</button><ActionMenu label="Group actions" iconOnly items={[
      ...objectClipboardActions(),
      {label:'Wrap in group',icon:Group,disabled:locked,onselect:()=>editor.group(false,true)},
      ...groupExitActions(),
      {label:'Ungroup',icon:Ungroup,disabled:locked,onselect:()=>ungroup()},
      {label:'Duplicate group',icon:Copy,disabled:locked,divider:true,onselect:()=>editor.duplicateSelection()},
      {label:locked?'Unlock group':'Lock group',icon:locked?Unlock:Lock,onselect:()=>editor.patch({locked:!locked})},
    ]}><Ellipsis size={16}/></ActionMenu></div>
  </div>
  <div class="container-geometry" aria-label={layout?'Layout position':'Group size'}>{@render geometry()}</div>
  <GroupMembership/>
  <details class="container-transform" bind:open={disclosures.hierarchy} use:uiDisclosure={next=>disclosures.hierarchy=next}><summary><span>More options</span><ChevronDown size={14} aria-hidden="true"/></summary><label class="field-label">Parent<select class="ui-property-input" aria-label="Container parent" disabled={locked} value={group.parent??''} onchange={event=>patch({parent:event.currentTarget.value||undefined,layoutItem:undefined})}><option value="">Slide</option>{#each groups.filter(g=>g.id!==group!.id&&!tree!.ancestors(g.id).includes(group!.id)) as target}<option value={target.id}>{parentLabel(target.id)}</option>{/each}</select></label>
  {#if layout}<details class="container-transform" bind:open={disclosures.scale} use:uiDisclosure={next=>disclosures.scale=next}><summary><span>Scale contents</span><ChevronDown size={14} aria-hidden="true"/></summary><p class="hint">Scale objects, text, spacing and padding together.</p><div class="content-scale"><NumberField label="Content scale" preset="scale" prefix="Scale" unit="%" value={contentScale} min={1} max={1000} step="any" disabled={locked||!canScaleContents} onvaliditychange={value=>contentScaleValid=value} onchange={value=>{contentScale=value;}}/><Button variant="quiet" disabled={locked||!canScaleContents||!contentScaleValid||contentScale===100} aria-label="Apply scale to group contents" onclick={scaleContents}>Apply</Button></div>{#if !canScaleContents}<p class="hint">Scale the parent layout to keep its grid consistent.</p>{/if}</details>{/if}</details>
  {#if locked}<p class="hint">Unlock this group from Group actions to change its layout.</p>{/if}
</section>
{#snippet geometry()}
  {#if box}<div class="property-grid">{#each (layout?[['x','X'],['y','Y']]:[['x','X'],['y','Y'],['w','Group width'],['h','Group height']]) as [key,label]}<NumberField unit="px" presets={editor.deck&&box?layoutNumberPresets(key,editor.deck,box):undefined} preset={key==='x'||key==='y'?'offset':'dimension'} {label} prefix={key==='w'?'W':key==='h'?'H':label} value={Math.round(box[key as 'x'|'y'|'w'|'h']*10)/10} disabled={locked||Boolean(group.parent&&editor.slide?.autoLayouts?.some(l=>l.id===group.parent)&&(key==='x'||key==='y'))} min={key==='w'||key==='h'?1:-20000} max={20000} step="any" increment={4} onchange={value=>transform(value,key as 'x'|'y'|'w'|'h')}/>{/each}</div>{#if !layout}<p class="hint">Resizing scales all contents, including text. Width and height stay proportional.</p>{/if}{/if}
{/snippet}
{/if}
<style>
  section{padding:12px;gap:8px}
  .property-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,6.5rem),1fr));gap:8px;min-width:0}
  .content-scale{display:flex;align-items:flex-start;gap:8px;margin-top:8px}.content-scale :global(.number-property){flex:1;min-width:0}
  .container-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.container-identity{min-width:0;flex:1}.container-identity .hint{margin:2px 0 0}
  .container-name{display:flex;align-items:center;gap:8px;min-width:0}.container-name :global(svg){flex:none}.container-identity .container-name input[type='text']{min-width:0;width:100%;min-height:32px;padding:4px;border-color:transparent;background:transparent;font-size:var(--ui-label);font-weight:var(--ui-weight-semibold);text-overflow:ellipsis}.container-identity .container-name input[type='text']:hover:not(:disabled){background:var(--state-hover)}
  .container-actions{display:flex;align-items:center;gap:2px;flex:none}.container-transform .container-transform{margin-top:8px;border-top:0;padding-top:0}
  .container-path{display:flex;flex-wrap:wrap;align-items:center;gap:2px;font-size:var(--ui-meta);overflow-wrap:anywhere}.container-path button{font-size:inherit;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .container-transform{border-top:1px solid var(--border-subtle);padding-top:4px}.container-transform summary{display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer;font-size:var(--ui-label);list-style:none;color:var(--text-secondary);border-radius:var(--r-sm)}.container-transform summary::-webkit-details-marker{display:none}.container-transform summary>span{flex:1;min-width:0}.container-transform summary :global(svg){flex:none}.container-transform[open]>summary :global(svg){rotate:180deg}.container-transform summary:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}.container-transform[open]>.field-label{margin-top:8px;margin-bottom:4px}
  @media(max-width:760px),(pointer:coarse){.container-actions :global(.icon-btn){min-width:44px;min-height:44px}.container-path button{min-height:44px;min-width:44px}.container-transform summary,.container-identity .container-name input[type='text']{min-height:44px}}
</style>
