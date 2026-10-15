import {fontStack} from './font-stack';
let context:CanvasRenderingContext2D|null|undefined;
/** Measure loaded fonts in the editor; Unicode-aware widths support headless exports. */
export function inlineTextWidth(value:string,size:number,family:string):number{
 if(typeof document!=='undefined'){
  context??=document.createElement('canvas').getContext('2d');
  if(context){context.font=`${size}px ${fontStack(family)}`;return context.measureText(value).width;}
 }
 return [...value].reduce((n,c)=>n+(/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(c)?1:/\s/u.test(c)?.3:/[MW@]/.test(c)?.85:/[il.,:;!|]/.test(c)?.28:.56),0)*size;
}
/** Whole words wrap before their last characters; summing widths misses that slack. */
export function inlineTextLines(value:string,size:number,family:string,width:number):number{
 const available=Math.max(1,width),cjk='\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}',tokens=new RegExp(`[${cjk}]|[^\\S\\n]+|[^\\s${cjk}]+`,'gu');
 // Reserve width slack for face and weight differences in a non-DOM constructor.
 const measure=(text:string)=>inlineTextWidth(text,size,family)*(typeof document==='undefined'?1.08:1);
 return value.split('\n').reduce((total,line)=>{let count=1,used=0;for(const token of line.match(tokens)??[]){const w=measure(token);if(/^\s+$/u.test(token)){if(used&&used+w<=available)used+=w;continue;}if(w<=available){if(used&&used+w>available){count++;used=0;}used+=w;}else for(const char of [...token]){const cw=measure(char);if(used&&used+cw>available){count++;used=0;}used+=cw;}}return total+count;},0);
}
