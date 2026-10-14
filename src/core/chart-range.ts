export function readableChartRange(values:number[]){
 const low=Math.min(0,...values),high=Math.max(0,...values),span=high-low||1,raw=span/2,base=10**Math.floor(Math.log10(raw)),unit=raw/base;
 const step=base*(unit<=1?1:unit<=2?2:unit<=2.5?2.5:unit<=5?5:10);
 return {min:Number((Math.floor(low/step)*step).toPrecision(12)),max:Number((Math.max(Math.ceil(high/step)*step,Math.floor(low/step)*step+step)).toPrecision(12)),step};
}
