import type {SlideElement} from './model';
import {scaledTextStyle} from './text-sizing';

/** Opt-in authored frames fit complete text; ordinary/imported flows keep their sizes. */
export function fitFlowText(elements:SlideElement[],height:number,gap:number,horizontal:boolean,measure:(e:SlideElement)=>SlideElement):{elements:SlideElement[];gap:number} {
  const canFit=(e:SlideElement)=>e.type==='text'&&!e.locked&&!e.design?.overrides?.includes('fontSize')&&Boolean(e.layoutItem?.basisFontSize);
  const preferred=elements.map(e=>canFit(e)?measure({...e,...scaledTextStyle(e,e.layoutItem!.basisFontSize!),h:e.h*e.layoutItem!.basisFontSize!/e.fontSize}):e);
  const occupied=(es:SlideElement[])=>horizontal?Math.max(...es.map(e=>e.h)):es.reduce((n,e)=>n+e.h,0);
  const count=horizontal?0:Math.max(0,elements.length-1),minimumGap=Math.min(gap,12);
  const resolvedGap=count?Math.max(minimumGap,Math.min(gap,(height-occupied(preferred))/count)):gap;
  if(occupied(preferred)+count*resolvedGap<=height+.01)return {elements:preferred,gap:resolvedGap};
  const size=(e:SlideElement,ratio:number)=>{
    if(!canFit(e))return e;
    const base=e.layoutItem!.basisFontSize!,minimum=Math.min(base,base>=56?36:24),font=Math.max(minimum,Math.floor(base*ratio*10)/10);
    return measure({...e,...scaledTextStyle(e,font),h:e.h*font/e.fontSize});
  };
  let lo=0,hi=1;
  for(let pass=0;pass<12;pass++){const mid=(lo+hi)/2;if(occupied(preferred.map(e=>size(e,mid)))+count*minimumGap<=height)lo=mid;else hi=mid;}
  return {elements:preferred.map(e=>size(e,lo)),gap:minimumGap};
}
