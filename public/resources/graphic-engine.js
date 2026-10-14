export const DEFAULT_GRAPHIC_RECIPE = Object.freeze({strength: 1, scale: 1, rotation: 0});
export const GRAPHIC_FAMILIES = Object.freeze([
  {id:'dots',label:'Dots'}, {id:'grids',label:'Grids'}, {id:'lines',label:'Lines & waves'}, {id:'paper',label:'Paper & grain'},
  {id:'arrows',label:'Arrows'}, {id:'stars',label:'Stars'}, {id:'marks',label:'Marks'}, {id:'shapes',label:'Shapes'},
]);
const textures = ['paper-grain','sparse-speckles','riso-grain','fiber-paper','etched-lines','dust-flecks'];
const fixedPatterns = ['halftone-fade','halftone-corner','halftone-wave','contour-flow','ripple-corner'];
const descriptions = {
  'fine-dots':'A quiet dot grid for slides with lots of text.', 'offset-dots':'Staggered dots for covers and section breaks.',
  'bold-dots':'Larger dots for playful covers and bold contrasts.', 'halftone-fade':'Dots grow toward the right. Keep copy on the left.',
  'halftone-corner':'A dotted corner that leaves the center clear.', 'halftone-wave':'A dotted wave for section openers.',
  'square-grid':'A light square grid for process and research slides.', 'dot-cross-grid':'Small crosses for a precise, technical background.',
  'engineering-grid':'Major and minor grid lines for technical diagrams.', 'diagonal-hatch':'Fine diagonal lines for diagrams and section breaks.',
  'crosshatch':'Crossed lines with a soft woven feel.', 'horizontal-rules':'Ruled lines for notes, timelines and written stories.',
  'contour-flow':'Flowing contour lines for spacious section openers.', 'ripple-corner':'Concentric rings anchored to a corner.',
  'sine-waves':'Repeating curves for a calm, flowing background.', 'isometric-grid':'An angled grid for systems and spatial diagrams.',
  'checkerboard':'A soft checkerboard for editorial covers.', 'memphis-marks':'Small geometric marks for playful stories.',
  'paper-grain':'Fine specks that add a light paper feel.', 'sparse-speckles':'A few scattered flecks for otherwise plain slides.',
  'riso-grain':'Uneven print grain for editorial covers and collages.', 'fiber-paper':'Short fibers that suggest uncoated paper.',
  'etched-lines':'Tiny irregular strokes for a subtle engraved texture.', 'dust-flecks':'Light dust marks for a tactile paper background.',
  'curved-arrow':'Point to evidence with a single curved stroke.', 'loop-arrow':'A looping arrow for a surprising turn or iteration.',
  'straight-arrow':'A hand-drawn arrow for a direct connection.', 'double-arrow':'Show a comparison or a two-way relationship.',
  'wavy-arrow':'A playful arrow for a less linear story.', 'corner-arrow':'Connect steps around a corner.',
  'sketch-circle':'Circle a detail without hiding what is underneath.', 'sketch-oval':'Frame a short phrase or a horizontal detail.',
  'double-underline':'Underline a key phrase with two loose strokes.', 'wavy-underline':'Add a playful emphasis below a key phrase.',
  'brush-highlight':'A transparent brush mark to place behind text.', 'torn-tape':'A torn strip of tape for a photo or a collage.',
  'zigzag-divider':'Separate sections with a simple zigzag.', 'dot-divider':'A quiet dotted divider between ideas.',
  'corner-brackets':'Frame evidence with four open corners.', 'organic-blob':'A soft shape to place behind a short title.',
  'orbit-rings':'Overlapping rings for connections and movement.', 'confetti-cluster':'A few loose marks for a celebration or a reveal.',
  'scribble':'An expressive hand-drawn mark for emphasis.', 'starburst':'A bold burst for a title, number or announcement.',
  'asterisk':'A simple asterisk for a footnote or a focal point.', 'sparkle':'A four-point sparkle for a small highlight.',
  'sparkle-cluster':'A pair of sparkles for a reveal or a celebration.', 'sun-rays':'Open rays for a radial idea or a focal point.',
};
const aliases = {
  '渐变网点':'halftone fade', '角落网点':'halftone corner', '网点':'halftone', '波点':'dots', '点阵':'dots', '网格':'grid',
  '背景':'background', '纹理':'texture', '颗粒':'grain', '纸张':'paper', '纸质':'paper', '纤维':'fiber', '印刷':'print',
  '波纹':'ripple', '波浪':'wave', '等高线':'contour', '斜线':'diagonal', '箭头':'arrow', '弯曲箭头':'curved arrow',
  '星芒':'starburst', '星星':'star', '圈画':'circle', '圆圈':'circle', '胶带':'tape', '涂鸦':'scribble', '下划线':'underline',
  '装饰':'accent', '几何':'geometric', '棋盘':'checkerboard', '高亮':'highlight', '虚线':'divider',
};
const synonyms = {dot:['dots','halftone','polka'],dots:['halftone','polka'],grid:['grids','graph'],wave:['waves','wiggle','ripple'],star:['stars','sparkle','asterisk','starburst'],circle:['circles','oval','rings'],paper:['grain','fiber'],arrows:['arrow']};
export function normalizeGraphicRecipe(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key=>!['strength','scale','rotation'].includes(key))) throw new Error('Invalid graphic settings.');
  const recipe = {...DEFAULT_GRAPHIC_RECIPE,...raw};
  for (const [key,min,max] of [['strength',.25,2],['scale',.5,3],['rotation',0,180]]) {
    if (typeof recipe[key] !== 'number' || !Number.isFinite(recipe[key]) || recipe[key]<min || recipe[key]>max) throw new Error(`Invalid graphic ${key}.`);
    recipe[key] = Math.round(recipe[key]*1000)/1000;
  }
  return recipe;
}
export function graphicInfo(record) {
  const sourceId = record.id || '', id = sourceId.replace(/^deck-graphics:/,'').replace(/^accent-/,'');
  const category = record.category || (sourceId.startsWith('deck-graphics:accent-') ? 'accent' : textures.includes(id) ? 'texture' : 'pattern');
  let family = category === 'texture' ? 'paper' : /arrow/.test(id) ? 'arrows' : /star|sparkle|asterisk|sun-rays/.test(id) ? 'stars' : category === 'accent' && /circle|oval|underline|highlight|tape|divider|bracket|scribble/.test(id) ? 'marks' : /dot|halftone|polka/.test(id) ? 'dots' : /grid|graph-paper|hero-plus/.test(id) ? 'grids' : /hatch|line|ripple|contour|wave|wiggle|topography|diagonal/.test(id) ? 'lines' : 'shapes';
  const familyLabel = GRAPHIC_FAMILIES.find(f=>f.id===family).label;
  const useCases = category === 'accent' ? ['Annotation','Emphasis'] : family === 'paper' || /fine|grid|graph|cross|rules/.test(id) ? ['Content','Research'] : ['Cover','Section opener'];
  const description = descriptions[id] || `A repeating ${familyLabel.toLowerCase()} background for covers and section openers.`;
  const repeatable = category === 'pattern' && !fixedPatterns.includes(id);
  const focus = id === 'halftone-corner' ? {x:1,y:0} : id === 'halftone-fade' ? {x:.85,y:.5} : id === 'halftone-wave' ? {x:.5,y:.65} : {x:.5,y:.5};
  return {family,familyLabel,category,description,useCases,repeatable,focus};
}
export function graphicSearchScore(item, query = '') {
  const info = graphicInfo(item), q = query.trim().toLowerCase(), normalized = aliases[q] || q.split(/\s+/).map(word=>aliases[word] || word).join(' ');
  if (!q) return 0;
  const title = item.title.toLowerCase(), text = `${title} ${item.id} ${info.familyLabel} ${info.description} ${info.useCases.join(' ')} ${info.category==='accent'?'accent decoration':`background ${info.category}`} ${(item.tags||[]).join(' ')}`.toLowerCase();
  const tokens = normalized.split(/[\s_-]+/).filter(Boolean);
  if (!text.includes(q) && !tokens.every(token=>[token,...(synonyms[token]||[])].some(word=>text.includes(word)))) return Infinity;
  return title === normalized ? 0 : title.startsWith(normalized) ? 1 : title.includes(normalized) ? 2 : info.familyLabel.toLowerCase() === normalized ? 3 : 4;
}
export function graphicFacets(items, query = '', category = '') {
  const matched = items.filter(item=>(!category||graphicInfo(item).category===category)&&Number.isFinite(graphicSearchScore(item,query)));
  return GRAPHIC_FAMILIES.map(f=>({...f,count:matched.filter(item=>graphicInfo(item).family===f.id).length}));
}
export function customizeGraphic(svg, color, raw = {}, repeatable = false) {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('Invalid graphic color.');
  const recipe = normalizeGraphicRecipe(raw);
  if (!repeatable && (recipe.scale!==1 || recipe.rotation!==0)) throw new Error('Size and angle are available for repeating patterns only.');
  let result = svg.replaceAll('#26362c',color);
  if (repeatable && (recipe.scale!==1 || recipe.rotation!==0)) {
    // Change the repeat, never the outer canvas. Coverage remains seamless.
    result = result.replace(/<pattern\b([^>]*)>/g,(_,attrs)=>{
      const old = attrs.match(/patternTransform="([^"]*)"/);
      const transform = `${old?old[1]+' ':''}rotate(${recipe.rotation}) scale(${recipe.scale})`;
      return `<pattern${attrs.replace(/\s+patternTransform="[^"]*"/,'')} patternTransform="${transform}">`;
    });
  }
  if (recipe.strength !== 1) {
    // One alpha transform preserves nested opacity relationships and ink color.
    result = result.replace(/(<svg\b[^>]*>)([\s\S]*)(<\/svg>)/,(_,open,body,close)=>`${open}<defs><filter id="ds-graphic-strength" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${recipe.strength} 0"/></filter></defs><g filter="url(#ds-graphic-strength)">${body}</g>${close}`);
  }
  return result;
}
export function graphicDetailSvg(svg, info, width=1600, height=900) {
  if (info.category === 'accent') return svg;
  const w = Math.min(width,400), h = Math.min(height,w*9/16), x=Math.max(0,Math.min(width-w,width*info.focus.x-w/2)), y=Math.max(0,Math.min(height-h,height*info.focus.y-h/2));
  return svg.replace(/(<svg\b[^>]*\bviewBox=")[^"]*(")/,`$1${x} ${y} ${w} ${h}$2`);
}
