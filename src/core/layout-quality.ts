import type {Deck,Slide,SlideElement} from './model';
import type {TextMeasure} from './auto-layout';
import {layoutObjectRole, layoutText} from './layout-content';

type Box={x:number;y:number;w:number;h:number};
export type LayoutQuality={overflow:string[];canShrink:Set<string>;outside:string[];overlaps:Map<string,number>;anchors:Set<string>;connections:Set<string>;reading:Map<string,number>;readingSides:Map<string,number>;visuals:Map<string,number>;fonts:Map<string,number>;score:number};
const content=layoutText;
const intersection=(a:Box,b:Box)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const pair=(a:string,b:string)=>[a,b].sort().join('|');
export function naturalTextHeight(e:SlideElement,width:number,measure:TextMeasure){
  if(measure.height)return measure.height(e,e.fontSize,Math.max(1,width));
  return content(e).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(measure(line,e,e.fontSize)/Math.max(1,width)))*e.fontSize*e.lineHeight,0)+(e.padding?.top??0)+(e.padding?.bottom??0);
}
export function tableHeight(e:SlideElement,size:number,width:number,measure:TextMeasure){
  const cols=Math.max(1,...(e.cells??[]).map(r=>r.length)),cellWidth=width/cols-34;
  if(cellWidth<=0)return Infinity;
  return (e.cells??[]).reduce((sum,row,i)=>sum+Math.max(...row.map(text=>naturalTextHeight({...e,type:'text',text,fontSize:size,fontWeight:i===0?600:e.fontWeight,padding:undefined,runs:undefined,paragraphs:undefined,wrap:true},cellWidth,measure)),0)+25,0);
}
function visibleBox(e:SlideElement,measure:TextMeasure):Box{
  if(e.type==='image'&&!e.sourceRegion&&e.fit==='contain'&&!e.crop){const aspect=measure.aspect?.(e)??e.w/e.h,w=Math.min(e.w,e.h*aspect),h=w/aspect;return{x:e.x+(e.w-w)/2,y:e.y+(e.h-h)/2,w,h};}
  if(e.type==='text'){
    const natural=naturalTextHeight(e,e.w,measure),height=Number.isFinite(natural)?natural:e.h;
    const h=e.clipText===false?height:Math.min(height,e.h),offset=e.verticalAlign==='middle'?Math.max(0,(e.h-height)/2):e.verticalAlign==='bottom'?Math.max(0,e.h-height):0;
    return{x:e.x,y:e.y+offset,w:e.w,h};
  }
  return{x:e.x,y:e.y,w:e.w,h:e.h};
}
export function assessLayout(deck:Pick<Deck,'width'|'height'>,slide:Slide,measure:TextMeasure):LayoutQuality{
  const canvas={x:0,y:0,w:deck.width,h:deck.height},area=deck.width*deck.height,scale=Math.min(deck.width/1440,deck.height/810);
  const elements=slide.elements.filter(e=>layoutObjectRole(e,deck)!=='empty'&&e.type!=='line'&&!(e.type==='rect'&&e.w*e.h>=area*.7));
  const boxes=new Map(elements.map(e=>[e.id,visibleBox(e,measure)]));
  const q:LayoutQuality={overflow:[],canShrink:new Set(),outside:[],overlaps:new Map(),anchors:new Set(),connections:new Set(),reading:new Map(),readingSides:new Map(),visuals:new Map(),fonts:new Map(),score:0};
  for(const e of elements){
    const b=boxes.get(e.id)!;
    if(b.x< -1||b.y< -1||b.x+b.w>deck.width+1||b.y+b.h>deck.height+1)q.outside.push(e.id);
    if(e.type==='text'&&content(e).trim()){
      const h=naturalTextHeight(e,e.w,measure);if(!Number.isFinite(h)||(e.clipText!==false&&h>e.h+2))q.overflow.push(e.id);
      if(!Number.isFinite(h)||h-e.h>Math.max(6,e.fontSize*.35))q.canShrink.add(e.id);
      const runs=e.paragraphs?.flatMap(p=>p.runs)??e.runs??[];
      q.fonts.set(e.id,Math.min(e.fontSize,...runs.map(r=>r.fontSize??e.fontSize)));
    }
    if(e.type==='table'){
      if(tableHeight(e,e.fontSize,e.w,measure)>e.h+2){q.overflow.push(e.id);q.canShrink.add(e.id);}
      q.fonts.set(e.id,e.fontSize);
    }
    if(e.type==='chart'){
      const n=e.values?.length??0,w=(e.w-48-Math.max(0,n-1)*32)/Math.max(1,n);
      const labelH=Math.max(0,...(e.values??[]).map(v=>naturalTextHeight({...e,type:'text',text:v.label,fontSize:Math.min(e.fontSize,24),runs:undefined,paragraphs:undefined,padding:undefined},w,measure)));
      const wordWidth=Math.max(0,...(e.values??[]).flatMap(v=>(v.label.match(/[\p{Script=Latin}\d@_./:-]+/gu)??[]).map(word=>measure(word,e,Math.min(e.fontSize,24)))));
      if(w<40*scale||wordWidth>w+1||labelH+Math.min(e.fontSize,32)*1.4+72+80*scale>e.h)q.overflow.push(e.id);
      q.fonts.set(e.id,Math.min(e.fontSize,24));
    }
    if(layoutObjectRole(e,deck)!=='auxiliary'&&((e.type==='image'&&(e.src||e.sourceRegion))||(e.type==='chart'&&e.values?.length)||(e.type==='table'&&e.cells?.length)||e.type==='prototype'))q.visuals.set(e.id,intersection(b,canvas));
  }
  for(let i=0;i<elements.length;i++)for(const b of elements.slice(i+1)){
    const a=elements[i];if(a.group&&a.group===b.group)continue;
    if(['rect','ellipse'].includes(a.type)||['rect','ellipse'].includes(b.type))continue;
    const ab=boxes.get(a.id)!,bb=boxes.get(b.id)!,overlap=intersection(ab,bb),key=pair(a.id,b.id);
    if(overlap>Math.min(ab.w*ab.h,bb.w*bb.h)*.08)q.overlaps.set(key,overlap/area);
    const image=a.type==='image'?a:b.type==='image'?b:undefined,text=a.type==='text'?a:b.type==='text'?b:undefined;
    if(image&&text&&overlap>boxes.get(text.id)!.w*boxes.get(text.id)!.h*.8)q.anchors.add(key);
  }
  for(const text of elements.filter(e=>e.type==='text'))for(const visual of elements.filter(e=>layoutObjectRole(e,deck)!=='auxiliary'&&['image','chart','table','prototype'].includes(e.type))){
    if(text.group&&text.group===visual.group)continue;
    const a=boxes.get(text.id)!,b=boxes.get(visual.id)!;
    const order=a.y+a.h<=b.y+.5?-1:b.y+b.h<=a.y+.5?1:a.x+a.w<=b.x+.5?-1:b.x+b.w<=a.x+.5?1:0;
    if(order)q.reading.set(pair(text.id,visual.id),order);
    const sharedBand = text.y < b.y+b.h && text.y+text.h > b.y;
    if (sharedBand) {
      const side = a.x+a.w<=b.x+.5 ? -1 : b.x+b.w<=a.x+.5 ? 1 : 0;
      if (side) q.readingSides.set(pair(text.id,visual.id),side);
    }
  }
  for(const line of slide.elements.filter(e=>e.type==='line'&&!e.hidden&&e.opacity>0&&e.stroke!=='transparent'&&e.strokeWidth>0&&e.y>deck.height*.18&&e.y<deck.height*.85&&e.w<deck.width*.7)){
    for(const shape of elements.filter(e=>['rect','ellipse','image','chart','table','prototype'].includes(e.type))){
      if(line.group&&line.group===shape.group)continue;
      const b=boxes.get(shape.id)!,tolerance=16*scale;
      const near=(x:number,y:number)=>x>=b.x-tolerance&&x<=b.x+b.w+tolerance&&y>=b.y-tolerance&&y<=b.y+b.h+tolerance&&Math.min(Math.abs(x-b.x),Math.abs(x-b.x-b.w),Math.abs(y-b.y),Math.abs(y-b.y-b.h))<=tolerance;
      const pointsInto=(x:number,y:number)=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
      if(near(line.x,line.y)||near(line.x+line.w,line.y+line.h))q.connections.add(`${pair(line.id,shape.id)}:edge`);
      if(pointsInto(line.x,line.y)||pointsInto(line.x+line.w,line.y+line.h))q.connections.add(`${pair(line.id,shape.id)}:inside`);
    }
  }
  q.score=-q.overflow.length*100-q.outside.length*100-q.overlaps.size*12+[...q.visuals.values()].reduce((n,v)=>n+v/area*80,0);
  return q;
}
/** Conservative regression checks. A readable original earns the right to stay. */
export function layoutRegressions(deck:Pick<Deck,'width'|'height'>,before:LayoutQuality,after:LayoutQuality):string[]{
  const reasons:string[]=[],scale=Math.min(deck.width/1440,deck.height/810);
  if(after.overflow.length)reasons.push('Text or data does not fit');
  if(after.outside.some(id=>!before.outside.includes(id)))reasons.push('Content extends beyond the canvas');
  if([...after.overlaps].some(([key,area])=>area>(before.overlaps.get(key)??0)*1.1+.001))reasons.push('Content has new overlaps');
  if([...before.anchors].some(key=>!after.anchors.has(key)))reasons.push('Image annotations are separated from their original position');
  if([...before.connections].some(key=>!after.connections.has(key)))reasons.push('Diagram connections have changed');
  if([...before.reading].some(([key,order])=>after.reading.get(key)!==order)||[...before.readingSides].some(([key,side])=>after.readingSides.has(key)&&after.readingSides.get(key)!==side))reasons.push('The reading order of text and evidence has changed');
  if([...before.visuals].some(([id,area])=>(after.visuals.get(id)??0)<area*.9))reasons.push('Evidence images or data areas are much smaller than before');
  if([...before.fonts].some(([id,size])=>(after.fonts.get(id)??size)<(before.canShrink.has(id)||before.outside.includes(id)?Math.min(size,16*scale):size*.9)))reasons.push('Readable text has become too small');
  return reasons;
}
export function equivalentComposition(a:Slide,b:Slide,measure:TextMeasure,scale:number){
  return a.elements.every(e=>{const other=b.elements.find(o=>o.id===e.id);if(!other)return false;const x=visibleBox(e,measure),y=visibleBox(other,measure);return['x','y','w','h'].every(key=>Math.abs(x[key as keyof Box]-y[key as keyof Box])<=5*scale)&&Math.abs(e.fontSize-other.fontSize)<=Math.max(1,e.fontSize*.08)&&e.fontFamily===other.fontFamily&&e.fontWeight===other.fontWeight;});
}
