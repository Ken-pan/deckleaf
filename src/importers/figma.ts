import { element, newDeck, blankSlide, type TextRun, type SlideElement } from '../core/model';
import { needsRasterGroup } from './figma-raster';
import {figmaVisibleLayout,textLayoutFingerprint,textMetricsFingerprint} from '../core/native-text-layout';
const rgb = (c: any, fallback = '#000000') => c ? `#${[c.r ?? 0, c.g ?? 0, c.b ?? 0].map(n => Math.round(n * 255).toString(16).padStart(2, '0')).join('')}` : fallback;
const multiply = (p: number[][], t: number[][]) => [[p[0][0]*t[0][0]+p[0][1]*t[1][0],p[0][0]*t[0][1]+p[0][1]*t[1][1],p[0][0]*t[0][2]+p[0][1]*t[1][2]+p[0][2]],[p[1][0]*t[0][0]+p[1][1]*t[1][0],p[1][0]*t[0][1]+p[1][1]*t[1][1],p[1][0]*t[0][2]+p[1][1]*t[1][2]+p[1][2]]];
export function importFigma(bundle: any) {
  const nodes = bundle.slides;
  if (!Array.isArray(nodes) || !nodes.length) throw new Error('No slides found in the Figma data.');
  const box = nodes[0].absoluteBoundingBox ?? {width: nodes[0].width, height: nodes[0].height, x: 0, y: 0}, width = box.width, height = box.height;
  const slides = nodes.map((n: any, i: number) => {
    const b = n.absoluteBoundingBox ?? {x:0,y:0,width:n.width,height:n.height}, sx = width/b.width, sy = height/b.height;
    const s = blankSlide(), warnings = new Set<string>();
    s.background = rgb(n.fills?.find((f: any) => f.type === 'SOLID')?.color, '#ffffff');
    if (sx !== 1 || sy !== 1) warnings.add('This slide differs in size from the first slide. The editable version uses a shared canvas scale.');
    const visit = (node: any, parent = [[1,0,b.x],[0,1,b.y]], parentOpacity = 1) => {
      if (node.visible === false || node.isMask) return;
      const transform = bundle.nodeGeometry?.[node.id]?.transform ?? (node.relativeTransform ? multiply(parent, node.relativeTransform) : null);
      const q = node.absoluteBoundingBox;
      if (!q) { (node.children ?? []).forEach((c: any) => visit(c, transform ?? parent, parentOpacity)); return; }
      const size = bundle.nodeGeometry?.[node.id]?.size ?? node.size;
      let common: Partial<SlideElement> = {name: node.name, x:(q.x-b.x)*sx,y:(q.y-b.y)*sy,w:Math.max(1,q.width*sx),h:Math.max(1,q.height*sy),sourceId:node.id,opacity:(node.opacity ?? 1)*parentOpacity};
      if (transform && size) {
        const ax = Math.hypot(transform[0][0],transform[1][0]), ay = Math.hypot(transform[0][1],transform[1][1]), w = size.x*ax*sx, h = size.y*ay*sy;
        common = {...common,x:(transform[0][2]+transform[0][0]*size.x/2+transform[0][1]*size.y/2-b.x)*sx-w/2,y:(transform[1][2]+transform[1][0]*size.x/2+transform[1][1]*size.y/2-b.y)*sy-h/2,w:Math.max(1,w),h:Math.max(1,h),rotation:Math.atan2(transform[1][0],transform[0][0])*180/Math.PI,flipY:transform[0][0]*transform[1][1]-transform[0][1]*transform[1][0]<0};
      }
      const fill = node.fills?.find((p: any) => p.visible !== false);
      const imageRef = fill?.imageRef ?? fill?.imageHash;
      const nativeRegion = () => {
        const r=node.absoluteRenderBounds ?? q,x=Math.max(0,(r.x-b.x)*sx),y=Math.max(0,(r.y-b.y)*sy),right=Math.min(width,(r.x+r.width-b.x)*sx),bottom=Math.min(height,(r.y+r.height-b.y)*sy);
        return right>x&&bottom>y?{...common,x,y,w:right-x,h:bottom-y,rotation:0,flipX:false,flipY:false,opacity:1,sourceRegion:{left:x/width,top:y/height,right:Math.max(0,1-right/width),bottom:Math.max(0,1-bottom/height)}}:null;
      };
      if (bundle.nodeRenders?.[node.id] && (!node.children?.length || needsRasterGroup(node))) {
        const r = bundle.nodeRenderBounds?.[node.id] ?? node.absoluteRenderBounds ?? q;
        s.elements.push(element('image', {...common,x:(r.x-b.x)*sx,y:(r.y-b.y)*sy,w:Math.max(1,r.width*sx),h:Math.max(1,r.height*sy),rotation:0,flipX:false,flipY:false,opacity:parentOpacity,src:bundle.nodeRenders[node.id],fit:'fill'}));
        if (node.children?.length) warnings.add(`“${node.name}” contains masks or crops and is preserved as an image.`);
      } else if (node.type === 'TEXT') {
        const style = node.style ?? {}, chars: string = node.characters ?? '', overrides = node.characterStyleOverrides ?? [], runs: TextRun[] = [];
        const textScale = sx * (transform && size ? Math.hypot(transform[0][0], transform[1][0]) : 1);
        let start = 0;
        while (start < chars.length) {
          const id = overrides[start] ?? 0; let end = start+1;
          while (end < chars.length && (overrides[end] ?? 0) === id) end++;
          const st = {...style,...node.styleOverrideTable?.[id]}, textFill = st.fills?.find((p: any) => p.visible !== false) ?? fill;
          runs.push({text:chars.slice(start,end),fontFamily:st.fontFamily ?? 'Arial',fontSize:Math.max(4,(st.fontSize ?? 32)*textScale),fontWeight:st.fontWeight ?? 400,italic:st.italic ?? false,underline:st.textDecoration === 'UNDERLINE',color:rgb(textFill?.color),letterSpacing:(st.letterSpacing ?? 0)*textScale}); start=end;
        }
        const align = ({CENTER:'center',RIGHT:'right',JUSTIFIED:'left'} as const)[style.textAlignHorizontal as 'CENTER'] ?? 'left';
        s.elements.push(element('text',{...common,text:chars,runs,maxLines:style.textTruncation==='ENDING'?(style.maxLines || Math.max(1,Math.round(common.h! / ((style.lineHeightPx || style.fontSize*1.2)*textScale)))):undefined,fontFamily:style.fontFamily ?? 'Arial',fontSize:Math.max(4,(style.fontSize ?? 32)*textScale),fontWeight:style.fontWeight ?? 400,fill:rgb(fill?.color),align,verticalAlign:style.textAlignVertical === 'CENTER' ? 'middle' : style.textAlignVertical === 'BOTTOM' ? 'bottom' : 'top',lineHeight:style.lineHeightPx && style.fontSize ? style.lineHeightPx/style.fontSize : 1.2,letterSpacing:(style.letterSpacing ?? 0)*textScale}));
        const imported=s.elements.at(-1)!;const native=bundle.textSvgs?.[node.id];
        if(native){const visible=figmaVisibleLayout(native,imported,textScale),intrinsic=style.lineHeightPercent/100;if(visible)imported.nativeTextLayout={fingerprint:textLayoutFingerprint(imported),metricsFingerprint:textMetricsFingerprint(imported),...visible,...(Number.isFinite(intrinsic)&&intrinsic>=.5&&intrinsic<=4?{intrinsicLineHeight:intrinsic}:{})};}
        if (node.effects?.length || style.textAlignHorizontal === 'JUSTIFIED' || style.paragraphSpacing || style.paragraphIndent) warnings.add(`“${node.name}” has text effects, paragraph indents, or justified text that need review.`);
      } else if (node.children?.length) {
        if(needsRasterGroup(node)){const region=nativeRegion();if(region)s.elements.push(element('image',{...region,name:node.name||'Source group'}));warnings.add(`“${node.name||node.type}” contains masks or crops and is preserved as a source image region.`);return;}
        if (fill?.type === 'SOLID') s.elements.push(element('rect',{...common,fill:rgb(fill.color),radius:node.cornerRadius ?? 0}));
        if (needsRasterGroup(node)) warnings.add(`“${node.name || node.type}” needs the export plugin to preserve its crop or mask.`);
        node.children.forEach((c: any) => visit(c,transform ?? parent,common.opacity));
      } else if (['RECTANGLE','ELLIPSE','LINE'].includes(node.type) && (!fill || fill.type === 'SOLID')) {
        s.elements.push(element(node.type === 'ELLIPSE' ? 'ellipse' : node.type === 'LINE' ? 'line' : 'rect',{...common,fill:rgb(fill?.color,'transparent'),opacity:(common.opacity ?? 1)*(fill?.opacity ?? 1),radius:node.cornerRadius ?? 0,stroke:rgb(node.strokes?.[0]?.color,'transparent'),strokeWidth:node.strokeWeight ?? 0}));
      } else if (imageRef && bundle.assets?.[imageRef]) {
        s.elements.push(element('image',{...common,...(fill.imageTransform||fill.scaleMode==='TILE'?nativeRegion():null),src:bundle.assets[imageRef],fit:fill.scaleMode === 'FIT' ? 'contain' : 'cover'}));
        if (fill.imageTransform || fill.scaleMode === 'TILE') warnings.add(`“${node.name || node.type}” keeps its image transform as a source region. The original image is preserved.`);
      } else {const region=nativeRegion();if(region)s.elements.push(element('image',{...region,name:node.name||'Source object'}));warnings.add(`“${node.name || node.type}” is preserved as a source image region. You can move and resize it; its internal structure is not independently editable.`);}
    };
    const rootMatrix = bundle.nodeGeometry?.[n.id]?.transform ?? [[1,0,b.x],[0,1,b.y]];
    (n.children ?? []).forEach((c: any) => visit(c,rootMatrix));
    s.source = {provider:'Figma',render:bundle.renders?.[n.id],warnings:[...warnings],fidelity:'converted',nodeId:n.id,label:n.name}; return s;
  });
  const d = newDeck(bundle.title || 'Figma Slides',slides,width,height); d.provenance={provider:'Figma',url:bundle.url,importedAt:new Date().toISOString()}; return d;
}
