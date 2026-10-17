import type {LineStyle} from './line-schema';

/** Pure routes and hit testing; lightweight enough for shared editor interactions. */
export function createLinePaths() {
  type Line={w:number;h:number;line?:Partial<LineStyle>};
  type Point={x:number;y:number};
  const n=(v:number)=>Math.round(v*1000)/1000;
  function lineGeometry(e:Line) {
    const w=e.w,h=e.h,flat=h===1,bend=e.line?.bend??.5,route=e.line?.route??'straight';
    const a={x:w===1?.5:0,y:flat?.5:0},b={x:w===1?.5:w,y:flat?.5:h};
    type Segment = {kind:'L';to:Point}|{kind:'C';a:Point;b:Point;to:Point};
    const segments:Segment[]=[];
    const L=(x:number,y:number)=>segments.push({kind:'L',to:{x,y}});
    const C=(x1:number,y1:number,x2:number,y2:number,x:number,y:number)=>segments.push({kind:'C',a:{x:x1,y:y1},b:{x:x2,y:y2},to:{x,y}});
    if(route==='elbow'){L(w*bend,a.y);L(w*bend,b.y);L(b.x,b.y);}
    else if(route==='rounded'){
      const x=w*bend,r=Math.min(w*bend,w*(1-bend),Math.abs(b.y-a.y)/2,24);
      L(x-r,a.y);C(x-r/2,a.y,x,a.y+r/2,x,a.y+r);L(x,b.y-r);C(x,b.y-r/2,x+r/2,b.y,x+r,b.y);L(b.x,b.y);
    }else if(route==='curve')C(w*bend,a.y,w*(1-bend),b.y,b.x,b.y);
    else if(route==='arc')C(a.x,a.y+(b.y-a.y)*bend,a.x+w*(1-bend),b.y,b.x,b.y);
    else if(route==='step'){L(a.x,h*bend);L(b.x,h*bend);L(b.x,b.y);}
    else if(route==='zigzag')for(let i=1;i<=8;i++){const t=i/8;L(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t+(i===8?0:(i%2?1:-1)*Math.min(16,h/5)));}
    else if(route==='wave'){
      const amp=Math.min(18,h/4);
      for(let i=0;i<4;i++){const t=i/4,u=(i+1)/4,sign=i%2?-1:1;C(w*(t+1/12),a.y+(b.y-a.y)*(t+1/12)+amp*sign,w*(u-1/12),a.y+(b.y-a.y)*(u-1/12)+amp*sign,w*u,a.y+(b.y-a.y)*u);}
    }else L(b.x,b.y);
    const path=`M ${n(a.x)} ${n(a.y)} `+segments.map(s=>s.kind==='L'?`L ${n(s.to.x)} ${n(s.to.y)}`:`C ${n(s.a.x)} ${n(s.a.y)} ${n(s.b.x)} ${n(s.b.y)} ${n(s.to.x)} ${n(s.to.y)}`).join(' ');
    const points:Point[]=[a];let from=a;
    for(const s of segments){if(s.kind==='L')points.push(s.to);else for(let i=1;i<=32;i++){const t=i/32,u=1-t;points.push({x:u*u*u*from.x+3*u*u*t*s.a.x+3*u*t*t*s.b.x+t*t*t*s.to.x,y:u*u*u*from.y+3*u*u*t*s.a.y+3*u*t*t*s.b.y+t*t*t*s.to.y});}from=s.to;}
    const first=points.find(p=>Math.hypot(p.x-a.x,p.y-a.y)>.01)??b,last=[...points].reverse().find(p=>Math.hypot(p.x-b.x,p.y-b.y)>.01)??a;
    return {path,points,start:a,end:b,startAngle:Math.atan2(a.y-first.y,a.x-first.x)*180/Math.PI,endAngle:Math.atan2(b.y-last.y,b.x-last.x)*180/Math.PI};
  }
  function lineHit(e:Line,p:Point,tolerance:number){
    const points=lineGeometry(e).points;
    return points.slice(1).some((b,i)=>{const a=points[i],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=tolerance;});
  }
  return {lineGeometry,lineHit};
}
export function lineGeometry(e:Parameters<ReturnType<typeof createLinePaths>['lineGeometry']>[0]) {return createLinePaths().lineGeometry(e);}
export function lineHit(e:Parameters<ReturnType<typeof createLinePaths>['lineHit']>[0],p:{x:number;y:number},tolerance:number) {return createLinePaths().lineHit(e,p,tolerance);}
