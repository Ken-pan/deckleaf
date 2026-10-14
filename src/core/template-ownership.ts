import type {Deck,SlideElement} from './model';
export function templateSignature(e:SlideElement){
 const value=JSON.stringify([e.type,e.pageElement??e.text,e.src,e.resource,e.cells,e.chart,e.fill,e.stroke,e.fontFamily,e.fontWeight,e.italic,e.runs]);let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return (hash>>>0).toString(16);
}
/** Embedding original artwork changes bytes, not authorship. Hand-edited artwork keeps its original baseline. */
export function portableTemplateOwnership(before:Deck,after:Deck):Deck{
 return {...after,slides:after.slides.map(slide=>{const original=before.slides.find(s=>s.id===slide.id);if(!original?.template?.generated||!slide.template?.generated)return slide;return {...slide,template:{...slide.template,generated:slide.template.generated.map(item=>{const old=original.elements.find(e=>e.id===item.id),current=slide.elements.find(e=>e.id===item.id);return old&&current&&templateSignature(old)===item.signature?{...item,signature:templateSignature(current)}:item;})}};})};
}
