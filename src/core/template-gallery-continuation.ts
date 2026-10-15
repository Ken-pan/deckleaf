import {inlineTextLines} from './inline-text-width';

/** Caption continuations use the final four-column reading region, keeping
 * complete text at a readable size instead of letting a one-item page overflow. */
export function galleryCaptionParts(value:string,family:string,width:number):string[]{
  const chars=[...value],parts:string[]=[];
  while(chars.length){
    let lo=1,hi=chars.length;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(inlineTextLines(chars.slice(0,mid).join(''),28,family,width*.9)<=8)lo=mid;else hi=mid-1;}
    let end=lo;
    if(end<chars.length){for(let i=end-1;i>=Math.floor(end*.6);i--)if(/\s/u.test(chars[i])){end=i+1;break;}}
    parts.push(chars.splice(0,end).join(''));
  }
  return parts.length?parts:[''];
}
