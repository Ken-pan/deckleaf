import type {SlideElement} from './model';

/** Fingerprints ignore identity, group movement and inherited theme values. */
export function blockFingerprint(elements:SlideElement[]):string {
  if(!elements.length)return '';
  const x=Math.min(...elements.map(e=>e.x)),y=Math.min(...elements.map(e=>e.y)),w=Math.max(...elements.map(e=>e.x+e.w))-x,h=Math.max(...elements.map(e=>e.y+e.h))-y;
  const round=(v:number)=>Math.round(v*10000)/10000;
  const data=JSON.stringify(elements.map(e=>({type:e.type,name:e.name,x:round((e.x-x)/w),y:round((e.y-y)/h),w:round(e.w/w),h:round(e.h/h),text:e.text,runs:e.runs,paragraphs:e.paragraphs,fill:e.design?.fill?e.design.fill:e.fill,stroke:e.design?.stroke?e.design.stroke:e.stroke,font:e.design?.text??e.design?.font??e.fontFamily,weight:e.design?.text&&!e.design.overrides?.includes('fontWeight')?undefined:e.fontWeight,size:e.design?.text&&!e.design.overrides?.includes('fontSize')?e.design.textScale:round(e.fontSize/w),radius:round(e.radius/w),rotation:e.rotation,hidden:e.hidden,src:e.src,design:e.design?{...e.design,overrides:[...(e.design.overrides??[])].sort()}:undefined})),(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
  let a=2166136261,b=5381;for(let i=0;i<data.length;i++){a=Math.imul(a^data.charCodeAt(i),16777619);b=Math.imul(b,33)^data.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
