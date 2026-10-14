// A rectangular clip with no overflow can keep its children independently editable.
export function needsRasterGroup(n: any) {
  if (!n.children?.length) return false;
  if (n.type === 'BOOLEAN_OPERATION' || n.children.some((c: any)=>c.isMask)) return true;
  if (!n.clipsContent) return false;
  if (n.cornerRadius || n.rectangleCornerRadii?.some((v: number)=>v>0)) return true;
  const b=n.absoluteBoundingBox;
  return !b || n.children.filter((c: any)=>c.visible!==false).some((c: any)=>{
    const q=c.absoluteBoundingBox; return !q || q.x < b.x-.5 || q.y < b.y-.5 || q.x+q.width > b.x+b.width+.5 || q.y+q.height > b.y+b.height+.5;
  });
}
