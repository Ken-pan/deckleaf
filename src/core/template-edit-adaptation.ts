import {uid,type Slide} from './model';
/** Adapt only opted-in native templates after content edits; references stay untouched. */
export function adaptTemplateText(slide:Slide,changed:Set<string>,deletedImage:boolean):Slide{
  if(!slide.template||slide.source||!['cover','split'].includes(slide.template.prototype))return slide;
  const title=slide.elements.find(e=>e.type==='text'&&e.fontSize>=56&&e.y>110&&e.y<340&&!/^\d+$/.test(e.text));
  const missing=deletedImage&&!slide.elements.some(e=>e.type==='image'),long=slide.template.prototype==='cover'&&title&&changed.has(title.id)&&title.text.length>52&&slide.template.variant==='standard';
  if(!missing&&!long||slide.elements.some(e=>e.locked))return slide;
  const next={...slide,elements:slide.elements.map(e=>({...e,layoutItem:e.layoutItem?{...e.layoutItem}:undefined})),groups:slide.groups?.map(g=>({...g})),autoLayouts:slide.autoLayouts?.map(l=>({...l,padding:{...l.padding},order:[...l.order]})),template:{...slide.template,variant:missing?'no-image':'long-title'},layout:{margins:{left:84,right:80,top:138,bottom:96},columns:12,gutter:20}};
  const removeGroups=new Set(next.autoLayouts?.filter(l=>missing&&l.name==='Visual source').map(l=>l.id));
  if(missing)next.elements=next.elements.filter(e=>!removeGroups.has(e.group??'')&&!['Artwork mount','Illustration mount'].includes(e.name));
  const texts=next.elements.filter(e=>e.type==='text'&&e.y>110&&e.y<736&&e.fontSize>=26&&e.x<950);
  const group=uid('flow'),x=84,y=176,w=missing?1276:1040,h=504;
  const oldGroups=new Set(texts.flatMap(e=>e.group?[e.group]:[]));
  for(const id of oldGroups)if(!next.elements.some(e=>e.group===id&&!texts.includes(e)))removeGroups.add(id);
  for(const e of texts){e.group=group;e.x=x;e.w=e===texts[0]?w:missing?1140:870;e.textSizing='auto-height';if(e.fontSize>=56){e.fontSize=76;if(e.design)e.design={...e.design,textScale:76/104};}e.layoutItem={widthMode:'fill',heightMode:'fixed',maxWidth:e.w,basisFontSize:e.fontSize};}
  next.groups=[...(next.groups??[]).filter(g=>!removeGroups.has(g.id)),{id:group,name:'Adaptive introduction'}];
  next.autoLayouts=[...(next.autoLayouts??[]).filter(l=>!removeGroups.has(l.id)),{id:group,name:'Adaptive introduction',direction:'vertical',gap:32,padding:{top:0,right:0,bottom:0,left:0},align:'start',justify:'start',columns:1,x,y,w,h,textFitHeight:h,widthMode:'fixed',heightMode:'hug',order:texts.map(e=>e.id)}];
  if(long)for(const e of next.elements)if(e.type==='image'||e.name==='Artwork mount'||e.name==='Illustration mount'){e.x=1050;e.y=506;e.w=310;e.h=180;}
  return next;
}

/** Dense native tables use the whole page; imported and locked compositions stay intact. */
export function adaptTemplateTable(slide:Slide,changed:Set<string>):Slide{
 if(slide.source||slide.template?.prototype!=='table'||slide.elements.some(e=>e.locked))return slide;
 const table=slide.elements.find(e=>e.type==='table'&&e.tableFit&&changed.has(e.id));if(!table||Math.max(...(table.cells??[]).map(r=>r.length))<5)return slide;
 const elements=slide.elements.map(e=>({...e,layoutItem:e.layoutItem?{...e.layoutItem}:undefined,design:e.design?{...e.design}:undefined}));
 const removed=new Set(elements.filter(e=>e.x<328&&e.type==='text'&&!e.runs&&!e.paragraphs&&(e.name==='Current result'&&e.text==='68%'||e.text==='CURRENT RESULT\nExample completion.')).map(e=>e.id));
 const nextElements=elements.filter(e=>!removed.has(e.id)),metric=nextElements.find(e=>e.name==='Current result');
 const title=nextElements.find(e=>e.type==='text'&&e.fontSize>=56&&e.y>110&&e.y<280&&e!==metric);
 const layouts=slide.autoLayouts?.map(l=>({...l,padding:{...l.padding},order:l.order.filter(id=>!removed.has(id))})).filter(l=>l.order.length);
 const position=(e:typeof nextElements[number],x:number,y:number,w:number,h:number)=>{Object.assign(e,{x,y,w,h});const l=layouts?.find(l=>l.order.includes(e.id));if(l)Object.assign(l,{x,y,w,h,textFitHeight:h});if(e.layoutItem)e.layoutItem={...e.layoutItem,maxWidth:w};};
 const full=nextElements.find(e=>e.id===table.id)!;Object.assign(full,{x:84,y:296,w:1276,h:402,lineHeight:1.2});if(full.design)full.design.overrides=[...new Set([...(full.design.overrides??[]),'lineHeight' as const])];
 if(title)position(title,84,138,metric?920:1276,134);
 if(metric){position(metric,1116,138,244,78);metric.fontSize=56;if(metric.layoutItem)metric.layoutItem.basisFontSize=56;if(metric.design)metric.design.textScale=56/104;}
 const customContext=nextElements.filter(e=>e.type==='text'&&!e.pageElement&&e.x<328&&e.y>=280&&e.y<480&&e!==title&&e!==metric);
 for(const e of customContext)position(e,1116,222,244,64);
 for(const e of nextElements.filter(e=>e.type==='text'&&e.y>=700&&e.y<736)){position(e,84,e.y,1196,e.h);}
 const liveGroups=new Set(nextElements.flatMap(e=>e.group?[e.group]:[]));for(const l of layouts??[])liveGroups.add(l.id);
 const groups=slide.groups?.filter(g=>liveGroups.has(g.id)).map(g=>({...g,parent:g.parent&&liveGroups.has(g.parent)?g.parent:undefined}));
 return {...slide,elements:nextElements,autoLayouts:layouts,groups,template:{...slide.template,variant:'full-width-data'},layout:{margins:{left:84,right:80,top:138,bottom:96},columns:12,gutter:20}};
}
