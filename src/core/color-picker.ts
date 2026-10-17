import {propertyColor} from './property-color';

export type Hsva = {h:number;s:number;v:number;a:number};
export type ColorFormat='hex'|'rgb'|'hsl'|'hsb';
const unit=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export function colorToHsva(raw:string):Hsva {
  const color=propertyColor(raw);
  if(!color||color==='transparent')return {h:0,s:0,v:1,a:1};
  const [r,g,b]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  const hue=!delta?0:max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
  return {h:(hue*60+360)%360,s:max?delta/max:0,v:max,a:color.length===9?parseInt(color.slice(7),16)/255:1};
}
export function hsvaToColor({h,s,v,a}:Hsva):string {
  h=((Number.isFinite(h)?h:0)%360+360)%360;s=unit(s);v=unit(v);a=unit(a);
  const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c;
  const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  const hex=(n:number)=>Math.round(n*255).toString(16).padStart(2,'0');
  return '#'+rgb.map(n=>hex(n+m)).join('')+(a<1?hex(a):'');
}
export function colorPlanePoint(x:number,y:number,width:number,height:number) {
  return {s:unit(x/Math.max(1,width)),v:1-unit(y/Math.max(1,height))};
}
export function colorChannels(color:Hsva,format:Exclude<ColorFormat,'hex'>):number[] {
  if(format==='rgb'){const hex=hsvaToColor(color);return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
  if(format==='hsb')return [Math.round(color.h),Math.round(color.s*100),Math.round(color.v*100)];
  const l=color.v*(1-color.s/2),s=l===0||l===1?0:(color.v-l)/Math.min(l,1-l);
  return [Math.round(color.h),Math.round(s*100),Math.round(l*100)];
}
export function channelsToColor(channels:number[],format:Exclude<ColorFormat,'hex'>,alpha=1):Hsva {
  if(format==='rgb')return {...colorToHsva('#'+channels.map(n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0')).join('')),a:alpha};
  if(format==='hsb')return {h:channels[0],s:unit(channels[1]/100),v:unit(channels[2]/100),a:alpha};
  const l=unit(channels[2]/100),s=unit(channels[1]/100),v=l+s*Math.min(l,1-l);
  return {h:channels[0],s:v?2*(1-l/v):0,v,a:alpha};
}
