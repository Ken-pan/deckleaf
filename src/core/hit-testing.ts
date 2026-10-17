import {lineHit} from './line-path';
import {shapePath} from './shape-geometry';
import type {SlideElement} from './model';
import type {Point} from './interactions';

export function hitElements(elements: SlideElement[], point: Point, tolerance = 0): SlideElement[] {
  return [...elements].reverse().filter(e=>{
    if (e.hidden||e.designPattern) return false;
    const a=-e.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=point.x-e.x-e.w/2,dy=point.y-e.y-e.h/2;
    const x=(c*dx-s*dy)*(e.flipX?-1:1)+e.w/2,y=(s*dx+c*dy)*(e.flipY?-1:1)+e.h/2;
    if (e.type==='line') {
      return lineHit(e,{x,y},Math.max((e.strokeWidth||2)/2,tolerance));
    }
    if(e.type==='ellipse')return ((x-e.w/2)/(e.w/2+tolerance))**2+((y-e.h/2)/(e.h/2+tolerance))**2<=1;
    if(e.shape || (e.type==='rect'||e.type==='diamond')&&e.radius)return shapeContains(e,{x,y},Math.max(tolerance,e.strokeWidth/2));
    if(e.type==='diamond')return Math.abs(x-e.w/2)/(e.w/2+tolerance)+Math.abs(y-e.h/2)/(e.h/2+tolerance)<=1;
    return x>=-tolerance&&x<=e.w+tolerance&&y>=-tolerance&&y<=e.h+tolerance;
  });
}


/** Rounded and concave shapes select by their visible contour, not the empty frame corners. */
export function shapeContains(e: Pick<SlideElement,'type'|'shape'|'w'|'h'|'radius'>, p:{x:number;y:number}, tolerance=0):boolean {
  const tokens=shapePath(e).match(/[MLCZ]|-?\d+(?:\.\d+)?/g)!;
  const outline:{x:number;y:number}[]=[];let i=0,at={x:0,y:0};
  const point=()=>({x:Number(tokens[i++]),y:Number(tokens[i++])});
  while(i<tokens.length){
    const command=tokens[i++];
    if(command==='M'||command==='L'){at=point();outline.push(at);}
    else if(command==='C'){
      const a=point(),b=point(),end=point(),start=at;
      for(let step=1;step<=12;step++){const t=step/12,u=1-t;outline.push({x:u*u*u*start.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*end.y});}
      at=end;
    }
  }
  let inside=false;
  for(let j=0;j<outline.length;j++){
    const a=outline[j],b=outline[(j+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
    if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=Math.max(1e-6,tolerance))return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

