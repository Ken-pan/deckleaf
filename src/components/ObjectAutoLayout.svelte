<script lang="ts">
  import Notice from './ui/Notice.svelte';
  import {editor} from '../core/editor.svelte';
  import {selectedLayout,groupMembers} from '../core/object-layout';
  import {layoutItemOperations,layoutOverflow} from '../core/group-commands';
  import {directMembers,descendants,slideGroups} from '../core/container-tree';
  import type {GroupLayout,LayoutItem} from '../core/model';
  import {Button} from './ui';
  import NumberField from './ui/NumberField.svelte';
  import PropertyChoice from './ui/PropertyChoice.svelte';
  import {uiDisclosure} from '../ui-motion';
  import {Minus,ChevronUp,ChevronDown} from '@lucide/svelte';
  import {layoutIcons} from './icons/layout-icons';
  import {resizeLayout,layoutResizeAxes} from '../core/layout-resize';
  let {disclosures=$bindable({limits:false,group:false,order:false,help:false,individualPadding:false})}: {disclosures?:{limits:boolean;group:boolean;order:boolean;help:boolean;individualPadding:boolean}}=$props();
  let orderLimit=$state(20);
  let layout=$derived(editor.slide&&selectedLayout(editor.slide,editor.selected,editor.selectedContainer||(!editor.selectedContainer&&editor.selected.length>1?editor.editingGroup:'')));
  let container=$derived(editor.slide?slideGroups(editor.slide).find(g=>g.id===editor.selectedContainer):undefined);
  let nested=$derived(Boolean(container?.parent&&editor.slide?.autoLayouts?.some(l=>l.id===container.parent)));
  let members=$derived(editor.slide?groupMembers(editor.slide,editor.selected,editor.selectedContainer):[]);
  let locked=$derived(members.some(e=>e.locked));
  let ordered=$derived.by(()=>{
    if(!layout||!editor.slide)return [];
    const byId=new Map(directMembers(editor.slide,layout.id).map(item=>[item.id,item]));
    return layout.order.map(id=>byId.get(id)).filter((item):item is NonNullable<typeof item>=>Boolean(item));
  });
  let member=$derived(!editor.selectedContainer&&editor.selection.length===1?editor.selection[0]:undefined);
  let isMember=$derived(Boolean(member&&layout));
  let fillsWidth=$derived(layout&&editor.slide?directMembers(editor.slide,layout.id).some(e=>!e.hidden&&e.layoutItem?.widthMode==='fill'):false);
  let fillsHeight=$derived(layout&&editor.slide?directMembers(editor.slide,layout.id).some(e=>!e.hidden&&e.layoutItem?.heightMode==='fill'):false);
  let widthRequired=$derived(fillsWidth||Boolean(layout?.wrap)||layout?.direction==='grid'&&layout.gridSizing==='equal');
  let resizeAxes=$derived(layout&&editor.slide?layoutResizeAxes(editor.slide,layout.id):{w:true,h:true});
  let overflow=$derived.by(()=>{const box=layout&&editor.slide?layoutOverflow(editor.slide,layout):{width:0,height:0};return layout?.textFitHeight?{...box,height:Math.max(box.height,layout.h-layout.textFitHeight)}:box;});
  let memberError=$state('');
  const orderScope=$derived(`${editor.deck?.id}:${editor.activeId}:${layout?.id}`);
  $effect(()=>{member?.id;memberError='';});
  $effect(()=>{orderScope;orderLimit=20;});
  function patch(value:Partial<GroupLayout>) {
    if(!layout||!editor.slide)return false;
    const next={...layout,...value};
    if(next.wrap&&next.direction!=='horizontal')next.wrap=false;
    if(next.wrap||next.direction==='grid'&&next.gridSizing==='equal')next.widthMode='fixed';
    if(value.justify==='space-between'||value.direction&&next.justify==='space-between') {if(next.direction==='horizontal')next.widthMode='fixed';else if(next.direction==='vertical')next.heightMode='fixed';}
    if(JSON.stringify(next)===JSON.stringify(layout)&&!(value.widthMode&&container?.layoutItem?.widthMode==='fill'||value.heightMode&&container?.layoutItem?.heightMode==='fill'))return true;
    const ops:import('../core/operations').Operation[]=[];
    if(container&&container.layoutItem&&(value.widthMode||value.heightMode)){const layoutItem={...container.layoutItem,...(value.widthMode?{widthMode:'fixed' as const}:{}),...(value.heightMode?{heightMode:'fixed' as const}:{})};ops.push({op:'set_group',slideId:editor.slide.id,group:{...container,layoutItem}});}
    const revision=editor.deck!.revision;editor.commit([...ops,{op:'set_group_layout',slideId:editor.slide.id,layout:next}]);return editor.deck!.revision!==revision;
  }
  function itemPatch(value:Partial<LayoutItem>) {
    if(!member||!editor.slide)return false;
    const proposed={...member.layoutItem,...value};
    for(const axis of ['Width','Height'] as const)if((proposed[`min${axis}`]??1)>(proposed[`max${axis}`]??20000)){memberError=`Minimum ${axis.toLowerCase()} must not exceed maximum ${axis.toLowerCase()}.`;return false;}
    const revision=editor.deck!.revision;
    const previousError=editor.error;
    try{editor.commit(layoutItemOperations(editor.slide,[member.id],value));}catch(e:any){memberError=e.message;return false;}
    if(editor.deck!.revision===revision){memberError=editor.error;editor.error=previousError;return false;}
    memberError='';return true;
  }
  function memberSizing(axis:'width'|'height',value:string) {
    if(!member||!editor.slide)return;
    if(value==='hug') {
      const layoutItem:LayoutItem={...(member.layoutItem??{widthMode:'fixed',heightMode:'fixed'})};
      if(axis==='width')layoutItem.widthMode='fixed';layoutItem.heightMode='fixed';
      editor.patch({layoutItem,textSizing:axis==='width'?'auto-width':member.textSizing==='auto-width'?'auto-width':'auto-height'});
    }else if(value==='fixed'&&member.type==='text'&&(axis==='height'||member.textSizing==='auto-width')) {
      const layoutItem:LayoutItem={...(member.layoutItem??{widthMode:'fixed',heightMode:'fixed'})};layoutItem[axis==='width'?'widthMode':'heightMode']='fixed';
      editor.patch({layoutItem,textSizing:axis==='height'?'fixed':'auto-height'});
    }else itemPatch(axis==='width'?{widthMode:value as 'fixed'|'fill'}:{heightMode:value as 'fixed'|'fill'});
  }
  function containerSizing(axis:'width'|'height',value:string){
    if(!layout||!editor.slide)return;
    const width=axis==='width';
    if(value==='fill'&&container){const key=width?'widthMode':'heightMode';editor.commit([{op:'set_group',slideId:editor.slide.id,group:{...container,layoutItem:{widthMode:'fixed',heightMode:'fixed',...container.layoutItem,[key]:'fill',[width?'basisW':'basisH']:width?layout.w:layout.h}}}]);}
    else patch(width?{widthMode:value as GroupLayout['widthMode'],...(layout.direction==='horizontal'&&value==='hug'?{justify:'start' as const}:{})}:{heightMode:value as GroupLayout['heightMode'],...(layout.direction==='vertical'&&value==='hug'?{justify:'start' as const}:{})});
  }
  function resizeDimension(value:number,key:'w'|'h'){
    if(!layout||!editor.slide)return false;
    const revision=editor.deck!.revision;
    editor.commit(resizeLayout(editor.slide,layout.id,{...layout,[key]:value},{w:key==='w',h:key==='h'}));
    return editor.deck!.revision!==revision;
  }
  function selectGroup(){if(layout)editor.chooseGroup(layout.id);}

  function padding(n:number,key:keyof GroupLayout['padding']) {if(layout)patch({padding:{...layout.padding,[key]:n}});}
  function axisPadding(value:number,horizontal:boolean){if(layout)patch({padding:{...layout.padding,...(horizontal?{left:value,right:value}:{top:value,bottom:value})}});}
  function reorder(id:string,delta:number) {
    if(!layout)return;const order=[...layout.order],i=order.indexOf(id),j=i+delta;
    if(j<0||j>=order.length)return;if(j>=orderLimit)orderLimit+=20;[order[i],order[j]]=[order[j],order[i]];patch({order});
  }
  function sort(axis:'x'|'y') {if(layout)patch({order:[...ordered].sort((a,b)=>a[axis]-b[axis]||(axis==='x'?a.y-b.y:a.x-b.x)).map(e=>e.id)});}
</script>
<section class="panel-section inspector-section auto-layout-properties" class:has-layout={Boolean(layout)} class:is-member={isMember} aria-label="Auto layout properties">
  {#if !layout}
    <Button variant="secondary" class="full" disabled={locked} title="Keep objects in a flow · Shift + A" onclick={()=>editor.autoLayout()}><layoutIcons.horizontal size={16}/>Add auto layout</Button>
  {:else}
    {@const LayoutIcon=layoutIcons[layout.direction]}
    <div class="auto-layout-heading"><h3><LayoutIcon size={16}/>{isMember?'Member layout':'Auto layout'}</h3>
      {#if isMember}<button class="text-btn" aria-label={`Select group: ${layout.name}`} onclick={selectGroup}>Select group</button>{:else}<button class="icon-btn small" aria-label="Remove auto layout" title="Remove auto layout" disabled={locked} onclick={()=>editor.commit([{op:'remove_group_layout',slideId:editor.slide!.id,groupId:layout!.id}])}><Minus size={16}/></button>{/if}
    </div>
    {#if member&&isMember}
      <div class="member-sizing" aria-label="Member sizing">
        {#each ['width','height'] as axis}{@const width=axis==='width'}
          {@const mode=width?member.layoutItem?.widthMode:member.layoutItem?.heightMode}
          {@const automatic=member.type==='text'&&mode!=='fill'&&(width?member.textSizing==='auto-width':member.textSizing==='auto-width'||member.textSizing==='auto-height')}
          <div class="field-label"><span>{width?'Width':'Height'}</span><PropertyChoice label={`Member ${axis} sizing`} value={automatic?'hug':mode??'fixed'} disabled={member.locked} options={[{value:'fixed',label:'Fixed'},{value:'fill',label:'Fill',disabled:member.rotation%360!==0,description:'Fill the available container space'},...(member.type==='text'?[{value:'hug',label:'Hug',description:'Size to text content'}]:[])]} onchange={value=>memberSizing(axis as 'width'|'height',value)}/></div>
        {/each}
        {#if member.rotation%360!==0}<p class="hint">Reset rotation to use Fill.</p>{/if}
        {#if member.layoutItem?.widthMode==='fill'||member.layoutItem?.heightMode==='fill'}
          <details class="auto-layout-details" bind:open={disclosures.limits} use:uiDisclosure={next=>disclosures.limits=next}><summary><span>Fill limits</span><ChevronDown size={14} aria-hidden="true"/></summary><div class="field-grid">
            {#each ['Width','Height'] as axis}{#if (axis==='Width'?member.layoutItem?.widthMode:member.layoutItem?.heightMode)==='fill'}
              <NumberField step="any" increment={4} label={`Minimum member ${axis.toLowerCase()} (${axis==='Width'?'W':'H'} min)`} prefix={axis==='Width'?'W min':'H min'} value={member.layoutItem?.[`min${axis}` as keyof LayoutItem] as number??1} min={1} max={20000} disabled={member.locked} onchange={value=>itemPatch({[`min${axis}`]:value})}/>
              <NumberField step="any" increment={4} label={`Maximum member ${axis.toLowerCase()} (${axis==='Width'?'W':'H'} max)`} prefix={axis==='Width'?'W max':'H max'} value={member.layoutItem?.[`max${axis}` as keyof LayoutItem] as number??20000} min={1} max={20000} disabled={member.locked} onchange={value=>itemPatch({[`max${axis}`]:value})}/>
            {/if}{/each}
          </div><button class="text-btn" disabled={member.locked} onclick={()=>itemPatch({minWidth:undefined,maxWidth:undefined,minHeight:undefined,maxHeight:undefined})}>Clear limits</button></details>
        {/if}
        
        {#if memberError}<Notice tone="error" title="Layout could not update" message={memberError}/>{/if}
      </div>
      <details class="group-settings auto-layout-details" bind:open={disclosures.group} use:uiDisclosure={next=>disclosures.group=next}><summary><span>Group settings</span><small>{layout.name}</small><ChevronDown size={14} aria-hidden="true"/></summary>{@render groupSettings()}</details>
    {:else}{@render groupSettings()}{/if}
  {/if}
  {#snippet groupSettings()}
    {#if layout}
    <fieldset class="auto-layout-fields" disabled={locked}>
      
      <PropertyChoice label="Auto layout direction" value={layout.direction} disabled={locked} onchange={value=>patch({direction:value as GroupLayout['direction']})} options={[{value:'horizontal',label:'Row'},{value:'vertical',label:'Column'},{value:'grid',label:'Grid'}]}/>
      <div class="field-grid">
        <NumberField step="any" increment={4} label="Auto layout gap" prefix="Gap" min={0} max={2000} value={layout.justify==='space-between'&&layout.direction!=='grid'?'':layout.gap} automatic={layout.justify==='space-between'&&layout.direction!=='grid'} disabled={layout.justify==='space-between'&&layout.direction!=='grid'} hint={layout.justify==='space-between'?'Spread calculates the gap from the fixed dimension':'Space between objects in px · Shift + ↑ / ↓ steps by 4'} onchange={value=>patch({gap:value})}/>
        {#if layout.direction==='grid'}<NumberField label="Auto layout columns" prefix="Columns" min={1} max={12} value={layout.columns} onchange={value=>patch({columns:value})}/>{/if}
      </div>
      {#if layout.direction==='horizontal'}<label class="auto-layout-check"><input type="checkbox" aria-label="Wrap auto layout" checked={Boolean(layout.wrap)} onchange={event=>patch({wrap:event.currentTarget.checked})}/><span>Wrap to new rows</span></label>{/if}
      {#if layout.wrap||layout.direction==='grid'}<NumberField step="any" increment={4} label="Auto layout row gap" prefix="Row gap" min={0} max={2000} value={layout.lineGap??layout.gap} onchange={value=>patch({lineGap:value})}/>{/if}
      {#if layout.direction==='grid'}<div class="field-label"><span>Column sizes</span><PropertyChoice label="Grid column sizes" value={layout.gridSizing??'content'} disabled={locked} options={[{value:'content',label:'Content'},{value:'equal',label:'Equal'}]} onchange={value=>patch({gridSizing:value as GroupLayout['gridSizing']})}/></div>{/if}
      <div class="field-grid">
        <label class="field-label">Alignment<select aria-label="Auto layout alignment" value={layout.align} onchange={event=>patch({align:event.currentTarget.value as GroupLayout['align']})}><option value="start">{layout.direction==='horizontal'?'Top':'Left'}</option><option value="center">Center</option><option value="end">{layout.direction==='horizontal'?'Bottom':'Right'}</option></select></label>
        {#if layout.direction!=='grid'}<label class="field-label">Distribution<select aria-label="Auto layout packing" value={layout.justify} onchange={event=>patch({justify:event.currentTarget.value as GroupLayout['justify']})}><option value="start">{layout.direction==='horizontal'?'Left':'Top'}</option><option value="center">Center</option><option value="end">{layout.direction==='horizontal'?'Right':'Bottom'}</option><option value="space-between">Space between</option></select></label>{/if}
      </div>
      <div class="auto-layout-size" aria-label="Layout size"><h4>Layout size</h4>
        {#each ['width','height'] as axis}{@const width=axis==='width'}{@const mode=nested&&container?.layoutItem?.[width?'widthMode':'heightMode']==='fill'?'fill':width?layout.widthMode:layout.heightMode}
          <div class="layout-size-mode"><span>{width?'Width':'Height'}</span><PropertyChoice label={`Auto layout ${axis} sizing`} disabled={locked} value={mode} options={[{value:'hug',label:'Hug',disabled:width?Boolean(widthRequired):fillsHeight,description:'Size to contents; unavailable when members fill this axis'},{value:'fixed',label:'Fixed'},...(nested?[{value:'fill',label:'Fill',description:'Fill the available parent space'}]:[])]} onchange={value=>containerSizing(axis as 'width'|'height',value)}/></div>
          {#if mode==='fixed'}<NumberField step="any" increment={4} label={`Layout ${axis}`} prefix={width?'W':'H'} min={1} max={20000} disabled={width?!resizeAxes.w:!resizeAxes.h} value={Math.round((width?layout.w:layout.h)*10)/10} onchange={value=>resizeDimension(value,width?'w':'h')}/>{:else}<output aria-label={`Layout ${axis}`}>{Math.round(width?layout.w:layout.h)} px</output>{/if}
        {/each}
      </div>
      
      {#if !resizeAxes.h}<p class="hint">Resize the parent layout to change height.</p>{/if}
      {#if layout.textFitHeight!==undefined}<NumberField step="any" increment={4} label="Auto layout text height limit" prefix="Text limit" min={1} max={20000} value={layout.textFitHeight} onchange={value=>patch({textFitHeight:value})}/><p class="hint">Text and spacing adjust to fit this height.</p>{/if}
      {#if nested}<p class="hint">Fill follows the parent container. Hug follows this layout’s contents.</p>{/if}
      {#if layout.wrap}<p class="hint">Wrapping needs a fixed width.</p>{:else if layout.direction==='grid'&&layout.gridSizing==='equal'}<p class="hint">Equal columns need a fixed width.</p>{:else if fillsWidth||fillsHeight}<p class="hint">{fillsWidth&&fillsHeight?'Both dimensions stay fixed':fillsWidth?'Width stays fixed':'Height stays fixed'} because children use Fill.</p>{/if}
      <div class="layout-padding" aria-label="Layout padding">
        <div class="layout-padding-heading"><h4>Padding</h4><Button variant="quiet" size="sm" aria-label="Edit padding per side" aria-pressed={disclosures.individualPadding} disabled={locked} onclick={()=>disclosures.individualPadding=!disclosures.individualPadding}>Sides</Button></div>
        <div class="field-grid">
          {#if disclosures.individualPadding}
            {#each ['top','right','bottom','left'] as side}<NumberField step="any" increment={4} label={`Auto layout padding ${side}`} prefix={side[0].toUpperCase()+side.slice(1)} min={0} max={2000} value={layout.padding[side as keyof GroupLayout['padding']]} onchange={value=>padding(value,side as keyof GroupLayout['padding'])}/>{/each}
          {:else}
            <NumberField step="any" increment={4} label="Auto layout horizontal padding" prefix="X" unit="px" hint="Left and right padding" min={0} max={2000} value={layout.padding.left} mixed={layout.padding.left!==layout.padding.right} onchange={value=>axisPadding(value,true)}/>
            <NumberField step="any" increment={4} label="Auto layout vertical padding" prefix="Y" unit="px" hint="Top and bottom padding" min={0} max={2000} value={layout.padding.top} mixed={layout.padding.top!==layout.padding.bottom} onchange={value=>axisPadding(value,false)}/>
          {/if}
        </div>
      </div>
    </fieldset>
    <details class="auto-layout-details" bind:open={disclosures.order} use:uiDisclosure={next=>disclosures.order=next}><summary><span>Order</span><small>{ordered.length} {ordered.length===1?'object':'objects'}</small><ChevronDown size={14} aria-hidden="true"/></summary>
      <div class="auto-layout-sort"><button class="text-btn" disabled={locked} onclick={()=>sort('x')}>Left to right</button><button class="text-btn" disabled={locked} onclick={()=>sort('y')}>Top to bottom</button><button class="text-btn" disabled={locked} onclick={()=>patch({order:[...layout!.order].reverse()})}>Reverse</button></div>
      <ol class="auto-layout-order">{#each ordered.slice(0,orderLimit) as item,i(item.id)}<li>
        <span class="auto-layout-number" aria-hidden="true">{i+1}</span><button class="auto-layout-member" aria-label={`Select auto layout member: ${item.name}`} onclick={()=>slideGroups(editor.slide!).some(g=>g.id===item.id)?editor.chooseGroup(item.id):editor.choose(item.id,false,true)} title={item.name}>{item.name}{item.hidden?' · Hidden':''}</button>
        <button class="icon-btn small" aria-label={`Move ${item.name} earlier`} disabled={locked||i===0} onclick={()=>reorder(item.id,-1)}><ChevronUp size={14}/></button><button class="icon-btn small" aria-label={`Move ${item.name} later`} disabled={locked||i===ordered.length-1} onclick={()=>reorder(item.id,1)}><ChevronDown size={14}/></button>
      </li>{/each}</ol>{#if ordered.length>orderLimit}<Button variant="quiet" class="full" onclick={()=>orderLimit+=20}>Show more · {orderLimit} of {ordered.length}</Button>{/if}
    </details>
    <details class="auto-layout-details" bind:open={disclosures.help} use:uiDisclosure={next=>disclosures.help=next}><summary><span>Layout tips</span><ChevronDown size={14} aria-hidden="true"/></summary><p class="hint">Resize the frame to keep fixed objects at their size. Fill and wrapping follow the frame. Entering a size switches that axis to Fixed.</p></details>
    {#if locked}<p class="hint">Unlock the group contents to edit layout.</p>{:else if overflow.width>.1||overflow.height>.1}<p class="layout-overflow" role="status">{layout.textFitHeight?'Text exceeds its height limit. Increase the limit or shorten the copy.':'Contents extend beyond the frame. Increase its fixed size or adjust member sizing.'}</p>{/if}
    {/if}
  {/snippet}
</section>
<style>
  .auto-layout-properties{padding:12px;gap:8px;min-width:0}
  .auto-layout-properties:not(.has-layout){padding:0;border:0;gap:8px}
  .auto-layout-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0}.auto-layout-heading h3{display:flex;align-items:center;gap:8px;margin:0;min-width:0;max-width:100%;font-size:var(--ui-label)}
  .auto-layout-fields{margin:0;padding:0;border:0;display:flex;flex-direction:column;gap:8px;min-width:0}
  .field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,6.5rem),1fr));gap:8px;min-width:0}.field-label{min-width:0;margin:0;gap:4px}.field-label select{min-height:var(--property-control-height,36px);padding-block:4px}
  .member-sizing{display:flex;flex-direction:column;gap:12px;min-width:0}.group-settings[open]>.auto-layout-fields{margin-top:12px}.group-settings>summary{overflow-wrap:anywhere}
  .auto-layout-check{display:flex;align-items:center;gap:8px;font-size:var(--ui-label);min-height:32px}.auto-layout-check input{width:16px;height:16px;flex:none;padding:0}
  .layout-overflow{font-size:var(--ui-meta);line-height:var(--ui-line-reading);color:var(--warning-text)}
  
  .auto-layout-size{display:grid;grid-template-columns:minmax(0,1fr) minmax(72px,.55fr);align-items:center;gap:8px}.auto-layout-size output{padding:4px 0;font-size:var(--ui-meta);color:var(--text-secondary)}
  .layout-size-mode{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-width:0;font-size:var(--ui-label);color:var(--text-secondary)}.layout-size-mode :global(.property-choice){flex:1;min-width:0}
  .auto-layout-size h4{grid-column:1 / -1;margin:0;font-size:var(--ui-label);font-weight:500;color:var(--text-secondary)}
  .layout-padding{display:flex;flex-direction:column;gap:4px}.layout-padding-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.layout-padding h4{margin:0;font-size:var(--ui-label);font-weight:500;color:var(--text-secondary)}.layout-padding-heading :global(button){min-height:28px;padding:4px 8px;font-size:var(--ui-meta)}.layout-padding-heading :global(button[aria-pressed='true']){background:var(--state-selected);color:var(--text-link)}
  .auto-layout-details{border-top:1px solid var(--border-subtle);padding-top:4px}.auto-layout-details summary{display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer;list-style:none;font-size:var(--ui-label);color:var(--text-secondary);border-radius:var(--r-sm)}.auto-layout-details summary::-webkit-details-marker{display:none}.auto-layout-details summary>span{flex:1;min-width:0}.auto-layout-details summary small{font-size:var(--ui-meta);max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.auto-layout-details summary :global(svg){flex:none}.auto-layout-details[open]>summary :global(svg){rotate:180deg}.auto-layout-details summary:focus-visible{outline:2px solid var(--accent-line);outline-offset:0}.auto-layout-details .field-grid{margin-top:8px}
  .auto-layout-sort{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}.auto-layout-sort button{font-size:var(--ui-meta);padding:0 8px}
  .auto-layout-order{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}.auto-layout-order li{display:flex;align-items:center;gap:4px;min-width:0;border-radius:var(--r-sm)}.auto-layout-order li:hover{background:var(--state-hover)}.auto-layout-number{flex:none;min-width:16px;text-align:center;color:var(--text-secondary);font-size:var(--ui-meta)}
  .auto-layout-member{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:none;padding:8px 4px;font-size:var(--ui-label);border:0}.auto-layout-order .icon-btn{flex:none}
  @media(max-width:760px),(pointer:coarse){.auto-layout-size{grid-template-columns:minmax(0,1fr)}.auto-layout-size :global(.property-choice button){min-width:44px}.auto-layout-order .icon-btn{width:44px;height:44px}.auto-layout-member,.auto-layout-check,.auto-layout-details summary,.layout-padding-heading :global(button),.field-label select{min-height:44px}}
</style>
