// A rectangular clip with no overflow can keep its children independently editable.
function needsRasterGroup(n) {
  if (!n.children?.length) return false;
  if (n.type === 'BOOLEAN_OPERATION' || n.children.some((c)=>c.isMask)) return true;
  if (!n.clipsContent) return false;
  if (n.cornerRadius || n.rectangleCornerRadii?.some((v)=>v>0)) return true;
  const b=n.absoluteBoundingBox;
  return !b || n.children.filter((c)=>c.visible!==false).some((c)=>{
    const q=c.absoluteBoundingBox; return !q || q.x < b.x-.5 || q.y < b.y-.5 || q.x+q.width > b.x+b.width+.5 || q.y+q.height > b.y+b.height+.5;
  });
}

// Read-only fallback for environments that do not expose JSON_REST_V1.
function serializeForDeck(node) {
  const result = {id: node.id, name: node.name, type: node.type};
  for (const key of ['visible','opacity','absoluteBoundingBox','absoluteRenderBounds','fills','strokes','strokeWeight','cornerRadius','clipsContent','isMask','effects']) {
    if (key in node && typeof node[key] !== 'symbol') result[key] = node[key];
  }
  if ('width' in node) result.size = {x: node.width, y: node.height};
  if ('relativeTransform' in node) result.relativeTransform = node.relativeTransform;
  if (node.type === 'TEXT') {
    result.characters = node.characters;
    const segments = node.getStyledTextSegments(['fontName','fontSize','fontWeight','fills','textDecoration','lineHeight','letterSpacing']);
    const style = segment => ({fontFamily: segment.fontName.family,fontWeight: segment.fontWeight,fontSize: segment.fontSize,italic:/italic/i.test(segment.fontName.style),fills:segment.fills,textDecoration:segment.textDecoration,lineHeightPx:segment.lineHeight.unit==='PIXELS'?segment.lineHeight.value:segment.lineHeight.unit==='PERCENT'?segment.fontSize*segment.lineHeight.value/100:undefined,letterSpacing:segment.letterSpacing.unit==='PIXELS'?segment.letterSpacing.value:segment.fontSize*segment.letterSpacing.value/100,textAlignHorizontal:node.textAlignHorizontal,textAlignVertical:node.textAlignVertical,textTruncation:node.textTruncation,maxLines:node.maxLines});
    result.style = segments[0] ? style(segments[0]) : {};
    result.styleOverrideTable = {}; result.characterStyleOverrides = [];
    segments.forEach((segment, i) => {result.styleOverrideTable[i+1]=style(segment);for(let j=segment.start;j<segment.end;j++)result.characterStyleOverrides[j]=i+1;});
  }
  if ('children' in node) result.children = node.children.map(serializeForDeck);
  return result;
}

figma.showUI(__html__, {width: 400, height: 330, themeColors: true});
figma.ui.onmessage = async message => {
  if (message.type === 'close') { figma.closePlugin(); return; }
  if (message.type !== 'export') return;
  try {
    const slides = [], seen = new Set();
    const collect = node => {
      if (node.type === 'SLIDE' || (figma.editorType === 'figma' && ['FRAME','INSTANCE','COMPONENT'].includes(node.type))) {
        if (!seen.has(node.id)) { slides.push(node); seen.add(node.id); } return;
      }
      if ('children' in node) node.children.forEach(collect);
    };
    const selected = figma.currentPage.selection;
    if (selected.length) selected.forEach(node => {
      let parent = node;
      while (parent && parent.type !== 'SLIDE' && parent.parent?.type !== 'PAGE') parent = parent.parent;
      if (parent?.type === 'SLIDE') collect(parent); else collect(node);
    });
    else figma.currentPage.children.forEach(collect);
    // Design layer stacking is independent of presentation reading order.
    // Native Slides retain their SlideGrid order.
    if (figma.editorType === 'figma') slides.sort((a,b) => a.y-b.y || a.x-b.x);
    if (!slides.length) throw new Error('Select slides or top-level frames in a Design file.');
    if (slides.length > 100) throw new Error('Export up to 100 slides at a time.');
    const bundle = {kind: 'figma-rest', title: figma.root.name, slides: [], renders: {}, nodeRenders: {}, nodeRenderBounds: {}, nodeGeometry: {}, textSvgs: {}};
    const find = (node, id) => { if (node?.id === id) return node; for (const child of node?.children ?? []) { const n = find(child, id); if (n) return n; } return null; };
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      figma.ui.postMessage({type: 'status', text: `Exporting ${i + 1} / ${slides.length} · ${slide.name}`});
      let root;
      try { const json = await slide.exportAsync({format: 'JSON_REST_V1'}); root = find(json.document ?? json, slide.id); }
      catch { root = serializeForDeck(slide); }
      if (!root) throw new Error(`Could not read the structure of ${slide.name} .`);
      // REST JSON omits native truncation and can omit mixed text styles.
      // Always overlay the live TextNode properties, even when REST succeeds.
      const nativeText = node => {
        if (node.type === 'TEXT') {
          const target = find(root, node.id), text = serializeForDeck(node);
          if (target) Object.assign(target, {characters:text.characters, style:{...target.style,...text.style}, styleOverrideTable:text.styleOverrideTable, characterStyleOverrides:text.characterStyleOverrides});
        }
        if ('children' in node) node.children.forEach(nativeText);
      };
      nativeText(slide);
      const textNodes=[];
      const gatherText=node=>{if(node.visible===false)return;if(node.type==='TEXT'&&typeof node.exportAsync==='function')textNodes.push(node);if('children'in node)node.children.forEach(gatherText);};gatherText(slide);
      for(const node of textNodes){try{bundle.textSvgs[node.id]=await node.exportAsync({format:'SVG_STRING',svgOutlineText:false});}catch{/* Live text properties remain available when SVG export is unsupported. */}}
      bundle.slides.push(root);
      const geometry = node => {
        if ('absoluteTransform' in node && 'width' in node) bundle.nodeGeometry[node.id] = {transform: node.absoluteTransform, size: {x: node.width, y: node.height}};
        if ('children' in node) node.children.forEach(geometry);
      };
      geometry(slide);
      bundle.renders[slide.id] = 'data:image/png;base64,' + figma.base64Encode(await slide.exportAsync({format: 'PNG', constraint: {type: 'SCALE', value: 2}}));
      const leaves = [];
      const walk = node => {
        if (node.visible === false || node.isMask) return;
        if (needsRasterGroup(node)) { leaves.push(node); return; }
        if (node.type === 'TEXT') return;
        if ('children' in node && node.children.length) node.children.forEach(walk); else if ('exportAsync' in node) leaves.push(node);
      };
      slide.children.forEach(walk);
      for (const leaf of leaves) {
        bundle.nodeRenders[leaf.id] = 'data:image/png;base64,' + figma.base64Encode(await leaf.exportAsync({format: 'PNG', constraint: {type: 'SCALE', value: 2}}));
        bundle.nodeRenderBounds[leaf.id] = leaf.absoluteRenderBounds ?? leaf.absoluteBoundingBox;
      }
    }
    figma.ui.postMessage({type: 'download', filename: `${figma.root.name}.deck.json`, json: JSON.stringify(bundle)});
  } catch (error) { figma.ui.postMessage({type: 'error', text: String(error.message ?? error)}); }
};
