import type {Deck,Slide} from './model';

/** A conservative copy-load heuristic, not a reading-time or aesthetic score.
 * Count CJK characters as half a word so unspaced text cannot bypass the budget. */
export function copyLoad(text:string):number {
 const cjk=text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)??[];
 const words=text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,' ').match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)??[];
 return Math.ceil(cjk.length/2+words.length);
}
export const slideHeading=(slide:Slide)=>slide.elements.find(e=>e.id===slide.template?.slots?.find(s=>s.key==='heading')?.elementId)?.text||slide.elements.find(e=>e.name==='Slide heading')?.text||slide.elements.find(e=>e.type==='text'&&!e.hidden&&!e.pageElement)?.text||'Untitled slide';
export type PresentationIssue={slideId:string;number:number;code:'dense'|'small-type'|'notes'|'repeated-title'|'rhythm'|'outside';message:string};
export function reviewPresentation(deck:Deck,slideIds?:string[]) {
 const issues:PresentationIssue[]=[],seen=new Set<string>();
 const slides=deck.slides.map((slide,index)=>({slide,index})).filter(({slide})=>!slide.hidden&&(!slideIds||slideIds.includes(slide.id)));
 const pages=slides.map(({slide,index},i)=>{
  const add=(code:PresentationIssue['code'],message:string)=>issues.push({slideId:slide.id,number:index+1,code,message});
  const texts=slide.elements.filter(e=>!e.hidden&&e.opacity>0&&!e.pageElement&&e.type==='text');
  const load=copyLoad(texts.map(e=>e.text).join(' '));
  if(load>90)add('dense','Reduce on-slide copy; move supporting detail into speaker notes.');
  const scale=Math.min(deck.width/1440,deck.height/810);
  const mainSlots=new Set(slide.template?.slots?.filter(s=>s.key==='heading'||s.key==='body'||/^items\.|^block\./.test(s.key)).map(s=>s.elementId));
  const small=slide.elements.filter(e=>!e.hidden&&e.opacity>0&&!e.pageElement&&((e.type==='text'&&(mainSlots.size?mainSlots.has(e.id):e.text.length>35)&&e.fontSize<22*scale-.1)||(e.type==='table'&&e.fontSize<22*scale-.1)));
  if(small.length)add('small-type',`Main text may be hard to read at a distance: ${small.slice(0,3).map(e=>`“${(e.text||e.name).slice(0,55)}” (${Math.round(e.fontSize/scale)} px)`).join(', ')}. Shorten or reflow these fields; do not squeeze them into smaller type.`);
  if(slide.elements.some(e=>!e.hidden&&e.opacity>0&&!e.pageElement&&['text','chart','table'].includes(e.type)&&(e.x< -1||e.y< -1||e.x+e.w>deck.width+1||e.y+e.h>deck.height+1)))add('outside','Text or data extends beyond the slide. Keep the complete content inside the canvas.');
  if(!slide.notes.trim())add('notes','Add a talking point and a transition to the next slide.');
  const heading=slideHeading(slide),key=heading.normalize('NFKC').trim().toLocaleLowerCase();
  if(seen.has(key))add('repeated-title','Give this slide a distinct takeaway so the story moves forward.');
  seen.add(key);
  const layout=slide.template?.prototype;
  if(layout&&i>1&&slides[i-1].slide.template?.prototype===layout&&slides[i-2].slide.template?.prototype===layout)add('rhythm','Three consecutive slides share a layout. Consider a different composition only if the content calls for it.');
  return {id:slide.id,number:index+1,heading,layout,copyLoad:load,hasNotes:Boolean(slide.notes.trim())};
 });
 return {pages,issues,notesCount:pages.filter(p=>p.hasNotes).length,scope:'Visible slides only. Copy load and type size are heuristics; facts, visual fit and delivery still need review.'};
}
