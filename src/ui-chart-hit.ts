/** Resolve authored line marks before nearby label hit areas, in screen pixels. */
export function chartPointTarget(root:Element|undefined,event:Event):SVGElement|null{
  if(!root||!(event.target instanceof Element))return null;
  let direct=event.target.closest<SVGElement>('[data-chart-point]');
  if(direct&&!root.contains(direct))direct=null;
  if(!(event instanceof MouseEvent)||event instanceof KeyboardEvent)return direct;
  if(direct&&!direct.hasAttribute('data-chart-line-hit'))return direct;
  if(!direct&&!event.target.closest('[data-chart-format="labels"]'))return null;
  let nearest:SVGElement|null=null,distance=direct?Infinity:matchMedia('(pointer:coarse)').matches?18:8;
  for(const node of root.querySelectorAll<SVGElement>('[data-chart-line-hit]')){
    const r=node.getBoundingClientRect(),d=Math.hypot(event.clientX-r.x-r.width/2,event.clientY-r.y-r.height/2);
    if(d<distance){nearest=node;distance=d;}
  }
  return nearest??direct;
}
