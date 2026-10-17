import type {LineStyle} from './line-schema';
type Point=[number,number,number];
type IconPath={d:string;a:Point;b:Point};
const paths:Record<LineStyle['route'],IconPath>={
  straight:{d:'M5 19 19 5',a:[5,19,135],b:[19,5,-45]},
  elbow:{d:'M5 5V17H19',a:[5,5,-90],b:[19,17,0]},
  rounded:{d:'M5 5v8a4 4 0 0 0 4 4h10',a:[5,5,-90],b:[19,17,0]},
  curve:{d:'M4 18C4 11.373 9.373 6 16 6H20',a:[4,18,90],b:[20,6,0]},
  arc:{d:'M4 18C4 10 10 4 18 4',a:[4,18,90],b:[18,4,0]},
  step:{d:'M5 4V12H19V20',a:[5,4,-90],b:[19,20,90]},
  zigzag:{d:'M4 18 9 6 15 18 20 6',a:[4,18,112.62],b:[20,6,-67.38]},
  wave:{d:'M3 15C6 15 6 7 9 7s3 10 6 10 3-8 6-8',a:[3,15,180],b:[21,9,0]},
};
const dashes:Record<LineStyle['dash'],string|undefined>={solid:undefined,dashed:'3.5 3.5',dotted:'.1 4','short-dash':'2 3','long-dash':'6 3','dash-dot':'5 3 .1 3','dash-dot-dot':'4 2 .1 2 .1 2'};
export function lineIconMarker(kind:LineStyle['end']) {
  const d={none:'',arrow:'M0 0-5-3V3Z','open-arrow':'M-4.5-3 0 0-4.5 3',stealth:'M0 0-5-3-3.4 0-5 3Z',circle:'M0 0a2 2 0 1 0-4 0a2 2 0 1 0 4 0Z','circle-outline':'M0 0a2 2 0 1 0-4 0a2 2 0 1 0 4 0Z',square:'M0-2H-4V2H0Z',diamond:'M0 0-3-2.4-6 0-3 2.4Z',bar:'M0-3V3'}[kind];
  const filled=!['none','open-arrow','circle-outline','bar'].includes(kind);
  return {kind,d,filled,stroke:filled?0:2,occludes:!['none','open-arrow','bar'].includes(kind)};
}
/** Optical paths stay legible at 16px; endpoints share one independent marker vocabulary. */
export function lineIconGeometry(style:LineStyle,layout:'path'|'horizontal'='path',width=24) {
  const g:IconPath=layout==='horizontal'?{d:`M6 12H${width-6}`,a:[6,12,180],b:[width-6,12,0]}:paths[style.route];
  // Icons use the same fixed stroke and rounded caps as Lucide. Document dimensions
  // and marker sizes belong to the canvas preview, not the application's icon weight.
  return {...g,dash:dashes[style.dash],markers:[{...lineIconMarker(style.start),point:g.a},{...lineIconMarker(style.end),point:g.b}]};
}
