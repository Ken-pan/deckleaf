import type {Deck} from './model';
import type {Operation} from './operations';
import {deckDesignSystem, styledElement} from './deck-design-system';
import type {ColorRole, TextRole} from './design-system-schema';
import {textStylePatch} from './text-style';

export function objectColorStyleOperations(deck:Deck,slideId:string,ids:string[],property:'fill'|'stroke',role?:ColorRole):Operation[]{
  const system=deckDesignSystem(deck);
  return (deck.slides.find(s=>s.id===slideId)?.elements??[]).filter(e=>ids.includes(e.id)&&!e.locked&&!e.designPattern&&!e.resource&&!e.sourceRegion&&!['image','prototype'].includes(e.type)).map(e=>{
    const design={...e.design};
    if(role)design[property]=role;else delete design[property];
    const styled=role?styledElement({...e,design:{[property]:role}},system,deck):e;
    return {op:'update_element',slideId,elementId:e.id,patch:{design,[property]:styled[property],...(property==='stroke'&&role?{strokeWidth:e.strokeWidth||1}:{}),...(property==='fill'&&e.runs?{runs:styled.runs}:{}),...(property==='fill'&&e.paragraphs?{paragraphs:styled.paragraphs}:{}),...(e.chart?{chart:styled.chart}:{})}};
  });
}

export function objectStyleWeightOperations(deck:Deck,slideId:string,ids:string[]):Operation[]{
  const system=deckDesignSystem(deck);
  return (deck.slides.find(s=>s.id===slideId)?.elements??[]).filter(e=>ids.includes(e.id)&&e.type==='text'&&!e.locked&&!e.resource&&!e.sourceRegion&&e.design?.text).map(e=>({
    op:'update_element',slideId,elementId:e.id,patch:{...textStylePatch(e,{fontWeight:system.typography[e.design!.text!].fontWeight}),design:{...e.design,overrides:(e.design?.overrides??[]).filter(key=>key!=='fontWeight')}}
  }));
}

export function objectTextStyleOperations(deck:Deck,slideId:string,ids:string[],role?:TextRole,restore=false):Operation[]{
  const system=deckDesignSystem(deck);
  return (deck.slides.find(s=>s.id===slideId)?.elements??[]).filter(e=>ids.includes(e.id)&&e.type==='text'&&!e.locked&&!e.resource&&!e.sourceRegion&&(!restore||e.design?.text)).map(e=>{
    const design={...e.design,text:restore?e.design?.text:role,textScale:restore?(e.design?.textScale??1):1,font:undefined,overrides:[]};
    const {id,type,...patch}=styledElement({...e,design},system,deck);
    return {op:'update_element',slideId,elementId:id,patch};
  });
}
