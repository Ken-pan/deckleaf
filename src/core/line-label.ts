import type {SlideElement} from './model';
import {createLinePaths} from './line-path';

/** Portable label layout, centered by distance along the rendered path. */
export function createLineLabelRendering(paths:ReturnType<typeof createLinePaths>) {
  let context:CanvasRenderingContext2D|null|undefined;
  function lineLabelPoint(e:SlideElement) {
    const points=paths.lineGeometry(e).points;
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
    let remaining=lengths.reduce((a,b)=>a+b,0)/2;
    for(let i=0;i<lengths.length;i++){const length=lengths[i];if(remaining<=length&&length>0){const a=points[i],b=points[i+1],t=remaining/length;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}remaining-=length;}
    return points[0];
  }
  function lineLabelElement(e:SlideElement):SlideElement {
    const p=lineLabelPoint(e),maxWidth=480;
    if(context===undefined)context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
    const measure=(text:string,run:NonNullable<SlideElement['runs']>[number])=>{
      const font=run.fontSize??e.fontSize,spacing=run.letterSpacing??e.letterSpacing,family=run.fontFamily??e.fontFamily,weight=run.fontWeight??(run.bold===undefined?e.fontWeight:run.bold?700:400);
      if(context){context.font=`${(run.italic??e.italic)?'italic':'normal'} ${weight} ${font}px "${family.replace(/["\\]/g,'')}", sans-serif`;return context.measureText(text).width+Math.max(0,Array.from(text).length-1)*spacing;}
      return Array.from(text).reduce((n,c)=>n+font*(/[^\u0000-\u024f]/u.test(c)?1:.6)+spacing,0);
    };
    const paragraphs=e.paragraphs?.map(p=>p.runs)??[e.runs?.length?e.runs:[{text:e.text||' '}]];
    const widths:number[]=[];let font=e.fontSize;
    for(const runs of paragraphs){let width=0;for(const run of runs){font=Math.max(font,run.fontSize??e.fontSize);const parts=run.text.split('\n');for(let i=0;i<parts.length;i++){if(i){widths.push(width);width=0;}width+=measure(parts[i],run);}}widths.push(width);}
    const natural=Math.max(0,...widths),w=Math.max(32,Math.min(maxWidth,Math.ceil(natural)+18));
    const rows=widths.reduce((n,v)=>n+Math.max(1,Math.ceil(v/(w-16))),0),h=Math.min(20000,Math.max(font*e.lineHeight,rows*font*e.lineHeight)+8);
    const a=e.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=(p.x-e.w/2)*(e.flipX?-1:1),dy=(p.y-e.h/2)*(e.flipY?-1:1);
    const x=e.x+e.w/2+dx*c-dy*s,y=e.y+e.h/2+dx*s+dy*c;
    return {...e,type:'text',x:x-w/2,y:y-h/2,w,h,rotation:0,flipX:false,flipY:false,
      fill:e.shapeText?.color??(e.stroke==='transparent'?e.fill:e.stroke),stroke:'transparent',strokeWidth:0,
      align:e.shapeText?.align??'center',verticalAlign:'middle',padding:{left:8,right:8,top:4,bottom:4},
      textSizing:'fixed',clipText:false,wrap:natural>maxWidth-18,design:undefined,nativeTextLayout:undefined,shapeText:undefined,line:undefined,shadow:undefined};
  }
  function lineLabelStyle(e:SlideElement,size=lineLabelElement(e)) {
    const p=lineLabelPoint(e);
    return `position:absolute;inset:auto;left:${p.x}px;top:${p.y}px;width:${size.w}px;height:${size.h}px;transform:translate(-50%,-50%) scale(${e.flipX?-1:1},${e.flipY?-1:1}) rotate(${-e.rotation}deg);`;
  }
  function lineLabelTransform(e:SlideElement){const p=lineLabelPoint(e);return `translate(${p.x} ${p.y}) scale(${e.flipX?-1:1} ${e.flipY?-1:1}) rotate(${-e.rotation})`;}
  return {lineLabelPoint,lineLabelElement,lineLabelStyle,lineLabelTransform};
}
export const {lineLabelPoint,lineLabelElement,lineLabelStyle,lineLabelTransform}=createLineLabelRendering(createLinePaths());
