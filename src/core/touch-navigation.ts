export type TouchPoint = {x:number; y:number};
export function touchFrame(points:TouchPoint[]) {
  const [a,b] = points;
  return b ? {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y)} : {...a,distance:0};
}
export function touchZoom(initialScale:number, initialDistance:number, distance:number) {
  return Math.max(.1,Math.min(4,initialScale*distance/Math.max(1,initialDistance)));
}
