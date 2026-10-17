import {LineStyleSchema} from './line-schema';
import {ShapeVariantSchema, ElementShadowSchema} from './shape-schema';
import { z } from 'zod';
import { TRANSITION_IDS } from './transition-ids';
import { CharacterRecipeSchema } from './character-recipe-schema';
import {GraphicRecipeSchema} from './graphic-recipe';
import {TableStyleSchema,validateTableStyle} from './table-schema';
import {BlockRecipeSchema} from './deck-block-schema';
import { ChartSchema, validateChart } from './chart-schema';
import { COLOR_ROLES, DesignSystemSchema, StyleBindingSchema, DEFAULT_DESIGN_SYSTEM } from './design-system-schema';

const id = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/);
const color = z.string().regex(/^(#[\da-fA-F]{3,8}|transparent)$/);
const image = z.string().max(35_000_000).refine(v => /^(data:image\/(png|jpeg|webp|gif|svg\+xml);|https?:\/\/|\/examples\/)/.test(v), 'Unsupported image URL');
const webUrl = z.string().url().max(3000).refine(v => /^https?:\/\//.test(v), 'Expected a public source link');
export const ResourceAttributionSchema = z.object({
  id: z.string().max(200), kind: z.enum(['photo', 'icon', 'illustration']),
  provider: z.string().max(100), title: z.string().max(1000), creator: z.string().max(500),
  sourceUrl: webUrl, creatorUrl: webUrl.optional(), license: z.string().max(100), licenseUrl: webUrl,
  attribution: z.string().max(6000), attributionRequired: z.boolean(),
  licenseNotice: z.string().max(30000).optional(), color: z.string().regex(/^#[\da-fA-F]{6}$/).optional(),
  originalSha256: z.string().regex(/^[\da-f]{64}$/).optional(),
  characterRecipe: CharacterRecipeSchema.optional(),
  graphicRecipe: GraphicRecipeSchema.optional(),
}).strict();
export type ResourceAttribution = z.infer<typeof ResourceAttributionSchema>;
export const TransitionSchema = z.object({
  effect: z.enum(TRANSITION_IDS).default('fade'),
  duration: z.number().min(100).max(2000).default(480),
  easing: z.enum(['smooth', 'snappy', 'linear', 'cinematic']).default('smooth'),
}).strict();
export const AnimationSchema = z.object({
  withTransition: z.boolean().optional(),
  effect: z.enum(['none', 'fade', 'rise', 'slide', 'zoom', 'reveal']).default('none'),
  duration: z.number().min(100).max(2000).default(500),
  delay: z.number().min(0).max(5000).default(0),
  trigger: z.enum(['auto', 'click']).default('auto'),
  order: z.number().int().min(0).max(3000).default(0),
  easing: z.enum(['smooth', 'snappy', 'linear']).default('smooth'),
}).strict();
export const PrototypeSchema = z.object({
  url: webUrl.refine(v => { const u = new URL(v); return !u.username && !u.password && ![...u.searchParams.keys()].some(k => /^(token|access_token|api[-_]?key|secret|password|client-id)$/i.test(k)) && !/(?:[?&#])(?:token|access_token|api[-_]?key|secret|password|client-id)=/i.test(v) && (!['figma.com', 'www.figma.com', 'embed.figma.com'].includes(u.hostname) || /^\/proto\/[\w-]+(?:\/|$)/.test(u.pathname)); }, 'Use a prototype share link without credentials'),
  scaling: z.enum(['contain', 'scale-down', 'fit-width']).default('contain'),
  responsive: z.boolean().default(false), chrome: z.boolean().default(false),
  deviceFrame: z.boolean().default(false), poster: image.optional(),
}).strict();
export type SlideTransition = z.infer<typeof TransitionSchema>;
export type ElementAnimation = z.infer<typeof AnimationSchema>;
export type Prototype = z.infer<typeof PrototypeSchema>;
export const TextRunSchema = z.object({
  text: z.string().max(50000), bold: z.boolean().optional(), italic: z.boolean().optional(),
  underline: z.boolean().optional(), color: color.optional(),
  fontSize: z.number().min(1).max(1000).optional(), fontFamily: z.string().max(100).optional(),
  fontWeight: z.number().min(100).max(900).optional(), letterSpacing: z.number().min(-50).max(100).optional(),
  baseline: z.enum(['normal', 'super', 'sub']).optional(),
}).strict();
export const ParagraphSchema = z.object({
  runs: z.array(TextRunSchema).max(5000), align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  endStyle: TextRunSchema.optional(),
  lineHeight: z.number().min(.5).max(4).optional(), lineSpacing: z.number().min(1).max(2000).optional(),
  spaceBefore: z.number().min(0).max(2000).default(0), spaceAfter: z.number().min(0).max(2000).default(0),
  indent: z.number().min(-2000).max(2000).default(0), firstLineIndent: z.number().min(-2000).max(2000).default(0),
  bullet: z.string().max(12).optional(),
}).strict();
export type TextRun = z.infer<typeof TextRunSchema>;
export type TextParagraph = z.infer<typeof ParagraphSchema>;
export const LayoutItemSchema = z.object({
  basisFontSize: z.number().finite().min(4).max(500).optional(),
  widthMode: z.enum(['fixed','fill']).default('fixed'), heightMode: z.enum(['fixed','fill']).default('fixed'),
  basisW: z.number().finite().min(1).max(20000).optional(), basisH: z.number().finite().min(1).max(20000).optional(),
  minWidth: z.number().finite().min(1).max(20000).optional(), maxWidth: z.number().finite().min(1).max(20000).optional(),
  minHeight: z.number().finite().min(1).max(20000).optional(), maxHeight: z.number().finite().min(1).max(20000).optional(),
}).strict();
export type LayoutItem = z.infer<typeof LayoutItemSchema>;
export const ElementSchema = z.object({
  id, type: z.enum(['text', 'rect', 'ellipse', 'diamond', 'line', 'image', 'table', 'chart', 'prototype']),
  name: z.string().max(200).default('Element'),
  x: z.number().finite().min(-20000).max(20000), y: z.number().finite().min(-20000).max(20000),
  w: z.number().finite().min(1).max(20000), h: z.number().finite().min(1).max(20000),
  rotation: z.number().finite().default(0), opacity: z.number().min(0).max(1).default(1),
  flipX: z.boolean().default(false), flipY: z.boolean().default(false),
  aspectRatioLocked: z.boolean().optional(),
  locked: z.boolean().default(false), hidden: z.boolean().default(false), group: id.optional(),
  layoutItem: LayoutItemSchema.optional(),
  blockItem:z.number().int().min(0).max(11).optional(),
  text: z.string().max(50000).default(''),
  fontFamily: z.string().max(100).default('Manrope'), fontSize: z.number().min(4).max(500).default(32),
  fontWeight: z.number().min(100).max(900).default(400), italic: z.boolean().default(false),
  underline: z.boolean().default(false), align: z.enum(['left', 'center', 'right']).default('left'),
  lineHeight: z.number().min(0.5).max(4).default(1.25), letterSpacing: z.number().min(-30).max(50).default(0),
  fill: color.default('#252b29'), stroke: color.default('transparent'), strokeWidth: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(500).default(0),
  line: LineStyleSchema.optional(),
  // Reversible materialized color adjustments; authored colors survive background changes.
  contrastColors: z.record(z.string().regex(/^(fill|stroke|shapeText\.color|(?:runs\.\d+|paragraphs\.\d+\.(?:runs\.\d+|endStyle))\.color|chart\.(?:textColor|colors\.\d+|dataLabels\.color)|tableStyle\.(?:headerFill|headerText|bodyFill|stripeFill|lineColor|cellStyles\.\d+\.(?:fill|color)))$/), z.object({original:color.optional(),adapted:color}).strict()).optional(),
  shapeText: z.object({color: color.optional(), align: z.enum(['left', 'center', 'right']).optional(), verticalAlign: z.enum(['top', 'middle', 'bottom']).optional()}).strict().optional(),
  shape: ShapeVariantSchema.optional(), shadow: ElementShadowSchema.optional(),
  src: image.optional(), fit: z.enum(['contain', 'cover', 'crop', 'fill']).default('contain'),
  imagePosition: z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict().optional(),
  imageZoom: z.number().min(.000001).max(20).optional(),
  imageSize: z.object({w:z.number().positive().max(1000000),h:z.number().positive().max(1000000)}).strict().optional(),
  // Signed crop edges retain blank space when the image is moved outside its frame.
  crop: z.object({left: z.number().min(-20000).max(20000), top: z.number().min(-20000).max(20000), right: z.number().min(-20000).max(20000), bottom: z.number().min(-20000).max(20000)}).strict().refine(c => c.left + c.right < 1 && c.top + c.bottom < 1, 'Invalid crop').optional(),
  padding: z.object({left: z.number().min(0).max(2000), right: z.number().min(0).max(2000), top: z.number().min(0).max(2000), bottom: z.number().min(0).max(2000)}).strict().optional(),
  clipText: z.boolean().optional(),
  textFit: z.enum(['none','normal','shape']).optional(),
  paragraphSpacingAtEdges: z.boolean().optional(),
  maxLines: z.number().int().min(1).max(1000).optional(),
  nativeTextLayout: z.object({fingerprint:z.string().max(200000),metricsFingerprint:z.string().max(200000).optional(),runs:z.array(TextRunSchema).max(5000),lineSpacing:z.number().min(1).max(2000).optional(),intrinsicLineHeight:z.number().min(.5).max(4).optional(),wrapSlack:z.number().min(0).max(100).optional()}).strict().optional(),
  // Native page crop for effects or masks the source API does not expose.
  // The original image/crop stays in src/crop for provenance and readback.
  sourceRegion: z.object({left:z.number().min(0).max(.9999),top:z.number().min(0).max(.9999),right:z.number().min(0).max(.9999),bottom:z.number().min(0).max(.9999)}).strict().refine(c=>c.left+c.right<1&&c.top+c.bottom<1).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).default('top'), wrap: z.boolean().default(true),
  textSizing: z.enum(['fixed', 'auto-width', 'auto-height']).default('fixed'),
  runs: z.array(TextRunSchema).max(5000).optional(), paragraphs: z.array(ParagraphSchema).max(5000).optional(),
  cells: z.array(z.array(z.string().max(5000)).max(20)).max(100).optional(),
  tableStyle: TableStyleSchema.optional(),
  tableFit: z.object({minimumFontSize:z.number().min(4).max(500),padding:z.number().min(0).max(100)}).strict().optional(),
  values: z.array(z.object({label: z.string().max(100), value: z.number().finite()})).max(100).optional(),
  chart: ChartSchema.optional(),
  sourceId: z.string().optional(),
  resource: ResourceAttributionSchema.optional(),
  animation: AnimationSchema.optional(), prototype: PrototypeSchema.optional(),
  motionKey: z.string().trim().max(80).nullable().optional(),
  motionMatch: z.enum(['auto','off']).optional(),
  design: StyleBindingSchema.optional(),
  designPattern: z.boolean().optional(),
  pageElement: z.object({kind: z.enum(['header','footer','page-number','date','logo','divider']), value: z.string().max(500).optional(), coverHidden: z.boolean().optional()}).strict().optional(),
}).strict();
export type SlideElement = z.infer<typeof ElementSchema>;

export const PageElementsSchema = z.object({
  header: z.string().max(300), footer: z.string().max(300), date: z.string().max(100),
  pageNumbers: z.boolean(), numberFormat: z.enum(['number','padded','total']),
  startAt: z.number().int().min(0).max(10000), hideOnCover: z.boolean(), divider: z.boolean(),
  hideOnBreaks: z.boolean().optional(),
  logo: ElementSchema.refine(e => e.type === 'image' && Boolean(e.src) && !e.sourceRegion, 'Choose a logo image.').optional(),
}).strict();
export type PageElements = z.infer<typeof PageElementsSchema>;

export const PageLayoutSchema = z.object({
  margins: z.object({top: z.number().min(0).max(10000), right: z.number().min(0).max(10000), bottom: z.number().min(0).max(10000), left: z.number().min(0).max(10000)}).strict(),
  columns: z.number().int().min(1).max(12), gutter: z.number().min(0).max(10000),
}).strict();
export type PageLayout = z.infer<typeof PageLayoutSchema>;
export const GroupLayoutSchema = z.object({
  id, name: z.string().min(1).max(200),
  direction: z.enum(['horizontal', 'vertical', 'grid']),
  gap: z.number().finite().min(0).max(2000),
  padding: z.object({top: z.number().min(0).max(2000), right: z.number().min(0).max(2000), bottom: z.number().min(0).max(2000), left: z.number().min(0).max(2000)}).strict(),
  align: z.enum(['start', 'center', 'end']), justify: z.enum(['start', 'center', 'end', 'space-between']),
  columns: z.number().int().min(1).max(12),
  x: z.number().finite().min(-20000).max(20000), y: z.number().finite().min(-20000).max(20000),
  w: z.number().finite().min(1).max(20000), h: z.number().finite().min(1).max(20000),
  widthMode: z.enum(['hug', 'fixed']), heightMode: z.enum(['hug', 'fixed']),
  wrap: z.boolean().optional(), lineGap: z.number().finite().min(0).max(2000).optional(),
  gridSizing: z.enum(['content','equal']).optional(),
  adaptiveColumns: z.boolean().optional(),
  textFitHeight: z.number().finite().min(1).max(20000).optional(),
  order: z.array(id).min(1).max(3000),
}).strict();
export type GroupLayout = z.infer<typeof GroupLayoutSchema>;
export const GroupSchema = z.object({id, name:z.string().min(1).max(200), parent:id.optional(), layoutItem:LayoutItemSchema.optional(), block:BlockRecipeSchema.optional()}).strict();
export type SlideGroup = z.infer<typeof GroupSchema>;
export const SlideSchema = z.object({
  // Only retained to read existing documents; page identity comes from its position.
  id, title: z.string().max(1000).optional(), background: color.default('#f4f3ee'),
  notes: z.string().max(100000).default(''), elements: z.array(ElementSchema).max(3000),
  // Kept in the document and editor; skipped during regular presentation navigation.
  hidden: z.boolean().optional(),
  transition: TransitionSchema.optional(),
  backgroundStyle: z.enum(COLOR_ROLES).optional(),
  adaptiveColors: z.boolean().optional(),
  patternStyle: z.enum(['document','none']).optional(),
  layout: PageLayoutSchema.optional(),
  pageSection: z.string().max(300).optional(),
  pageElements: PageElementsSchema.optional(),
  template: z.object({prototype:z.string().max(80),variant:z.string().max(80),density:z.enum(['presentation','reading']),collection:z.enum(['portfolio','review','proposal','pitch','report','minimal']).optional(),slots:z.array(z.object({key:z.string().max(80),elementId:id}).strict()).max(300).optional(),generated:z.array(z.object({id,signature:z.string().max(20)}).strict()).max(3000).optional(),generatedGroups:z.array(id).max(1500).optional()}).strict().optional(),
  autoLayouts: z.array(GroupLayoutSchema).max(1500).optional(),
  groups: z.array(GroupSchema).max(1500).optional(),
  source: z.object({provider: z.string().max(80), render: image.optional(),
    warnings: z.array(z.string().max(1000)).max(1000).default([]),
    fidelity: z.enum(['source-render', 'converted', 'native']),
    label: z.string().max(1000).optional(), nodeId: z.string().optional(),
  }).optional(),
}).strict();
export type Slide = z.infer<typeof SlideSchema>;
export const OnlineFontSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  family: z.string().min(1).max(100).regex(/^[^";{}<>\\]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum(['sans', 'serif', 'display', 'mono', 'handwriting']),
  chinese: z.boolean(), weights: z.array(z.number().int().min(100).max(900)).min(1).max(9),
  styles: z.array(z.enum(['normal', 'italic'])).min(1).max(2),
  license: z.enum(['OFL-1.1', 'Apache-2.0']), licenseNotice: z.string().min(20).max(30000),
  provider: z.enum(['google', 'fontsource']).optional(),
}).strict();
export type OnlineFont = z.infer<typeof OnlineFontSchema>;
export const DocumentFontSchema = z.object({family: z.string().min(1).max(100), name: z.string().max(200), data: z.string().max(25_000_000).regex(/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$/), weight: z.string().regex(/^\d{3}( \d{3})?$/).default('100 900'), style: z.enum(['normal', 'italic']).default('normal')});
export const NativeSourceSchema = z.object({provider:z.literal('Keynote'),id:z.string().uuid(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const GoogleSourceSchema = z.object({id:z.string().uuid(),sha256:z.string().regex(/^[a-f0-9]{64}$/),presentationId:z.string().regex(/^[\w-]{10,200}$/)}).strict();
export const DeckSchema = z.object({
  schema: z.literal('deck-studio/1'), id,
  title: z.string().min(1).max(300), width: z.number().min(100).max(10000), height: z.number().min(100).max(10000),
  revision: z.number().int().min(0), updatedAt: z.string(),
  slides: z.array(SlideSchema).min(1).max(500),
  illustrationAccent: z.string().regex(/^#[\da-fA-F]{6}$/).optional(),
  designSystem: DesignSystemSchema.optional(),
  templateCollection: z.enum(['portfolio','review','proposal','pitch','report','minimal']).optional(),
  pageElements: PageElementsSchema.optional(),
  onlineFonts: z.array(OnlineFontSchema).max(40).optional(),
  fonts: z.array(DocumentFontSchema).max(40).optional(),
  nativeSource: NativeSourceSchema.optional(),
  googleSource: GoogleSourceSchema.optional(),
  provenance: z.object({provider: z.string(), filename: z.string().optional(), url: z.string().optional(), importedAt: z.string().optional(),pageSize:z.object({width:z.number().positive().max(20000),height:z.number().positive().max(20000),canvasWidth:z.number().positive().max(20000),canvasHeight:z.number().positive().max(20000)}).strict().optional()}).optional(),
}).strict();
export type Deck = z.infer<typeof DeckSchema>;

export const uid = (prefix = 'node') => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
export function element(type: SlideElement['type'], attrs: Partial<SlideElement> = {}): SlideElement {
  return ElementSchema.parse({id: uid(), type, x: 96, y: 200, w: 500, h: 100, name: type === 'text' ? 'Text' : type, ...attrs});
}
// Accept legacy metadata without requiring or generating a page title.
export function blankSlide(legacyTitle?: string): Slide {
  return SlideSchema.parse({id: uid('slide'), ...(legacyTitle!==undefined?{title:legacyTitle}:{}), elements: []});
}
export function validateDeck(value: unknown): Deck {
  const deck = DeckSchema.parse(value);
  assertDeckInvariants(deck);
  return deck;
}

/** Check references before recursive layout; canonical parsing happens at the transaction boundary. */
export function assertDeckInvariants(deck: Deck, trustedSlides?: ReadonlySet<Slide>): void {
  const ids = new Set<string>();
  for (const s of deck.slides) {
    // Owned immutable pages already satisfy local invariants at these dimensions.
    // Slide identity still belongs to the complete document, including reorders.
    if (trustedSlides?.has(s)) {
      if (ids.has(s.id)) throw new Error(`Duplicate slide ID: ${s.id}`);
      ids.add(s.id); continue;
    }
    if (s.layout) {
      const {margins: m, columns, gutter} = s.layout;
      const width = deck.width - m.left - m.right;
      if (width < 1 || deck.height - m.top - m.bottom < 1) throw new Error('Margins must leave at least 1 px of usable slide space.');
      if (width - (columns - 1) * gutter < columns) throw new Error('The column gap is too large. Reduce the number of columns, the gap, or the side margins.');
    }
    if (ids.has(s.id)) throw new Error(`Duplicate slide ID: ${s.id}`);
    ids.add(s.id);
    const nodes = new Set<string>();
    for (const e of s.elements) {
      if (nodes.has(e.id)) throw new Error(`Duplicate element ID: ${e.id}`);
      nodes.add(e.id);
      if (e.pageElement && e.type !== (e.pageElement.kind === 'logo' ? 'image' : e.pageElement.kind === 'divider' ? 'line' : 'text')) throw new Error('Page elements must use text, a logo image or a divider line.');
      if (e.type === 'image' && !e.src && !e.sourceRegion) throw new Error('An image needs a source');
      if (e.type === 'prototype' && !e.prototype) throw new Error('A prototype needs a share link');
      if (e.chart && e.type !== 'chart') throw new Error('Only chart objects support chart data.');
      if (e.chart) validateChart(e.chart);
      if(e.tableStyle&&e.type!=='table')throw new Error('Only table objects support table styles.');
      if(e.type==='table')validateTableStyle(e.cells??[],e.tableStyle);
      if(e.layoutItem){
        for(const axis of ['Width','Height'] as const)if((e.layoutItem[`min${axis}`]??1)>(e.layoutItem[`max${axis}`]??20000))throw new Error(`Minimum ${axis.toLowerCase()} must not exceed maximum ${axis.toLowerCase()}.`);
        if(e.rotation%360!==0&&(e.layoutItem.widthMode==='fill'||e.layoutItem.heightMode==='fill'))throw new Error('Reset object rotation before using Fill.');
      }
    }
    const containers = new Map((s.groups??[]).map(g=>[g.id,g]));
    if(containers.size!==(s.groups??[]).length)throw new Error('Duplicate group ID.');
    const known=new Set([...containers.keys(),...s.elements.map(e=>e.group).filter((id):id is string=>Boolean(id)),...(s.autoLayouts??[]).map(l=>l.id)]);
    for(const g of containers.values()) {
      if(nodes.has(g.id))throw new Error('Group and element IDs must be distinct.');
      const seen=new Set([g.id]);let parent=g.parent;
      while(parent){if(!known.has(parent))throw new Error('Parent group no longer exists.');if(seen.has(parent))throw new Error('Groups cannot contain themselves or their ancestors.');seen.add(parent);if(seen.size>32)throw new Error('Keep group nesting within 32 levels.');parent=containers.get(parent)?.parent;}
      if(g.layoutItem)for(const axis of ['Width','Height'] as const)if((g.layoutItem[`min${axis}`]??1)>(g.layoutItem[`max${axis}`]??20000))throw new Error(`Minimum ${axis.toLowerCase()} must not exceed maximum ${axis.toLowerCase()}.`);
    }
    if (!s.autoLayouts?.length) continue;
    const groups = new Set<string>();
    const membersByGroup = new Map<string, Set<string>>();
    for (const node of [...s.elements, ...(s.groups ?? [])]) {
      const parent = 'type' in node ? node.group : node.parent;
      if (!parent) continue;
      const members = membersByGroup.get(parent) ?? new Set<string>();
      members.add(node.id); membersByGroup.set(parent, members);
    }
    for (const layout of s.autoLayouts ?? []) {
      if (groups.has(layout.id)) throw new Error('Each group can have only one auto layout.');
      groups.add(layout.id);
      if(nodes.has(layout.id))throw new Error('Group and element IDs must be distinct.');
      const members = membersByGroup.get(layout.id) ?? new Set<string>();
      if (layout.order.length !== members.size || new Set(layout.order).size !== members.size || layout.order.some(id => !members.has(id))) throw new Error('Auto layout order must include each group member exactly once.');
    }
  }
}
export function newDeck(title: string, slides: Slide[], width = 1440, height = 810): Deck {
  return validateDeck({schema: 'deck-studio/1', id: uid('deck'), title, width, height, revision: 0, updatedAt: new Date().toISOString(), slides, designSystem: DEFAULT_DESIGN_SYSTEM});
}
