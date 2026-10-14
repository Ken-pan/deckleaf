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
