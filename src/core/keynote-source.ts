import {z} from 'zod';
import {TextRunSchema,ParagraphSchema,type Deck} from './model';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const KeynoteStateSchema=z.object({width:z.number().positive().max(20000),height:z.number().positive().max(20000),fonts:hash,slides:z.array(z.object({hidden:z.boolean().optional(),notes:z.string().max(100000),signature:hash,objects:z.array(z.object({sourceId:z.string().max(200).optional(),type:z.string().max(30),signature:hash,text:z.string().max(50000).optional(),runs:z.array(TextRunSchema).max(5000).optional(),paragraphs:z.array(ParagraphSchema).max(5000).optional(),fontSize:z.number().min(1).max(1000).optional(),fontFamily:z.string().max(100).optional(),fill:z.string().optional()}).strict()).max(3000)}).strict()).max(500)}).strict();
export type KeynoteState=z.infer<typeof KeynoteStateSchema>;
function canonical(value:any):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function styles(runs:any[]){const out:any[]=[];for(const {text,...style}of runs){if(out.length&&canonical(out.at(-1))===canonical(style))continue;out.push(style);}return out;}
/** A compact export contract. Images stay local; their bytes are hashed. */
export async function keynoteState(deck:Deck):Promise<KeynoteState>{
 const digest=async(value:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)))),b=>b.toString(16).padStart(2,'0')).join('');
 const slides=[];
 for(const slide of deck.slides){const objects=[];
  for(const e of slide.elements){const {id,name,text,runs,paragraphs,...structure}=e;
   const style=e.type==='text'?{...structure,runs:runs?styles(runs):undefined,paragraphs:paragraphs?.map(({runs,...p})=>({...p,runs:styles(runs)}))}:structure;
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(style)));
   const signature=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   objects.push({sourceId:e.sourceId,type:e.type,signature,...(e.type==='text'?{text:e.text,runs:e.runs,paragraphs:e.paragraphs,fontSize:e.fontSize,fontFamily:e.fontFamily,fill:e.fill}:{})});
  }slides.push({hidden:Boolean(slide.hidden),notes:slide.notes,signature:await digest({background:slide.background,transition:slide.transition,layout:slide.layout}),objects});
 }return {width:deck.width,height:deck.height,fonts:await digest({fonts:deck.fonts,onlineFonts:deck.onlineFonts}),slides};
}
