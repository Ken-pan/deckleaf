import {slideLabel} from './slide-label';
import type { Deck, SlideElement } from './model';
import type { Operation, Proposal } from './operations';
import { countLabel } from './ui-copy';

const labels: Record<string, string> = {
  notes: 'Speaker notes', background: 'Background', name: 'Object name',
  x: 'X', y: 'Y', w: 'Width', h: 'Height', rotation: 'Rotation', opacity: 'Opacity',
  flipX: 'Flip horizontally', flipY: 'Flip vertically', locked: 'Locked', hidden: 'Hidden', group: 'Group',
  text: 'Text', fontFamily: 'Font', fontSize: 'Font size', fontWeight: 'Font weight',
  italic: 'Italic', underline: 'Underline', align: 'Alignment', lineHeight: 'Line height', letterSpacing: 'Letter spacing',
  fill: 'Fill', stroke: 'Border color', strokeWidth: 'Border width', radius: 'Corner radius',
  src: 'Image', fit: 'Image fit', crop: 'Crop', imagePosition:'Image position', imageZoom:'Image zoom', imageSize:'Original dimensions', padding: 'Padding', clipText: 'Clip text',
  paragraphSpacingAtEdges: 'Paragraph spacing at edges', maxLines: 'Maximum lines', sourceRegion: 'Source crop',
  verticalAlign: 'Vertical alignment', wrap: 'Wrap text', textSizing: 'Text sizing', runs: 'Styled text', paragraphs: 'Paragraphs',
  cells: 'Table content', values: 'Chart data', sourceId: 'Source reference', resource: 'Resource credit',
  animation: 'Entrance effect', prototype: 'Prototype', motionKey: 'Match ID', motionMatch: 'Motion matching',
  transition: 'Slide transition', layout: 'Slide layout', effect: 'Effect', duration: 'Duration', delay: 'Delay',
  trigger: 'Trigger', order: 'Order', easing: 'Easing', margins: 'Margins', columns: 'Columns', gutter: 'Column gap',
  layoutItem:'Member sizing',widthMode:'Width sizing',heightMode:'Height sizing',lineGap:'Row gap',gridSizing:'Column sizes',minWidth:'Minimum width',maxWidth:'Maximum width',minHeight:'Minimum height',maxHeight:'Maximum height',basisW:'Preferred width',basisH:'Preferred height',
  spaceBefore: 'Space before', spaceAfter: 'Space after', firstLineIndent: 'First line indent', baseline: 'Baseline',
  lineSpacing: 'Line spacing', deviceFrame: 'Device frame', responsive: 'Responsive', chrome: 'Player controls',
};
const objectNames: Record<SlideElement['type'], string> = {text:'Text',rect:'Rectangle',ellipse:'Ellipse',diamond:'Diamond',line:'Line',image:'Image',table:'Table',chart:'Chart',prototype:'Prototype'};
const wording: Record<string, string> = {contain:'Fit within frame',cover:'Fill frame',fill:'Stretch to frame',smart:'Smart animate', auto:'Automatic', click:'On click', 'auto-width':'Auto width', 'auto-height':'Auto height', fixed:'Fixed size', off:'Off', super:'Superscript', sub:'Subscript'};
const pixelFields = new Set(['x','y','w','h','fontSize','letterSpacing','strokeWidth','radius','gutter','spaceBefore','spaceAfter','indent','firstLineIndent','lineSpacing','lineGap','minWidth','maxWidth','minHeight','maxHeight','basisW','basisH']);
const sentenceCase = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
const label = (key: string) => labels[key] ?? sentenceCase(key);
const number = (value: number) => new Intl.NumberFormat('en-US', {maximumFractionDigits: 4}).format(value);

function field(key: string, value: unknown, proposed = false): string {
  if (value == null || value === '') return 'Not set';
  if(key==='widthMode'||key==='heightMode')return value==='fill'?'Fill container':value==='hug'?'Hug contents':'Fixed';
  if (key === 'src') return proposed ? 'Updated image · Preview to review' : 'Current image';
  if (key === 'sourceId') return proposed ? 'Updated source reference' : 'Existing source reference';
  if (key === 'group') return 'Grouped';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') return key === 'opacity' ? `${number(value * 100)}%` : key === 'rotation' ? `${number(value)}°` : key === 'duration' || key === 'delay' ? `${number(value)} ms` : key === 'order' ? number(value + 1) : `${number(value)}${pixelFields.has(key) ? ' px' : ''}`;
  if (typeof value === 'string') return ['text','notes','title','name','fontFamily','motionKey','url'].includes(key) ? value : wording[value] ?? sentenceCase(value);
  if (Array.isArray(value)) {
    if (key === 'cells') return value.map(row => row.join(' | ')).join('\n');
    if (key === 'values') return value.map(item => typeof item==='number'?number(item):`${item.label}: ${number(item.value)}`).join(', ');
    if (key === 'labels') return value.join(' | ');
    if (key === 'series') return value.map(item=>`${item.name}: ${field('values',item.values)}`).join('\n');
    if (key === 'runs') return value.map(run => `${run.text}${Object.keys(run).some(k => k !== 'text') ? ` [${Object.entries(run).filter(([k]) => k !== 'text').map(([k,v]) => `${label(k)}: ${field(k,v)}`).join(' · ')}]` : ''}`).join('');
    if (key === 'paragraphs') return value.map(p => `${field('runs', p.runs)}\n${Object.entries(p).filter(([k]) => k !== 'runs').map(([k,v]) => `${label(k)}: ${field(k,v)}`).join(' · ')}`).join('\n');
    return countLabel(value.length, 'item');
  }
  const entries = value as Record<string, unknown>;
  if(key==='template')return Object.entries(entries).filter(([key])=>['prototype','variant','density','collection'].includes(key)).map(([key,value])=>`${label(key)}: ${field(key,value)}`).join('\n');
  if (key === 'resource') return [entries.title, entries.creator, entries.license].filter(Boolean).join(' · ');
  return Object.entries(entries).map(([k,v]) => {
    if (k === 'poster' || k === 'render') return `${sentenceCase(k)}: ${proposed ? 'Updated image' : 'Current image'}`;
    if (key === 'crop' || key === 'sourceRegion') return `${sentenceCase(k)}: ${number(Number(v) * 100)}%`;
    if (key === 'padding' || key === 'margins') return `${sentenceCase(k)}: ${number(Number(v))} px`;
    return `${label(k)}: ${field(k,v,proposed)}`;
  }).join(' · ');
}
function patchText(patch: Record<string, unknown>, current: Record<string, unknown> | undefined, proposed: boolean) {
  const keys = Object.keys(patch);
  if (keys.length === 1 && ['text','title','notes'].includes(keys[0])) return String((proposed ? patch : current)?.[keys[0]] ?? '');
  return keys.map(key => `${label(key)}: ${field(key,(proposed ? patch : current)?.[key],proposed)}`).join('\n');
}
function objectText(e: SlideElement) {
  return [e.text, e.resource?.title, `${objectNames[e.type]} · ${number(e.w)} × ${number(e.h)} px`, `Position: ${number(e.x)}, ${number(e.y)} px`].filter(Boolean).join('\n');
}

/** Presentation only. Original content, operation order and document data stay intact. */
export function diffProposal(deck: Deck, proposal: Proposal): {slide: string; target: string; before: string; after: string}[] {
  const slides=new Map(deck.slides.map((slide,index)=>[slide.id,{slide,index}]));
  const elements=new Map<string,Map<string,SlideElement>>();
  return proposal.operations.map((op: Operation) => {
    const entry = 'slideId' in op ? slides.get(op.slideId) : undefined,slide=entry?.slide;
    if(slide&&('elementId' in op||op.op==='reorder_elements')&&!elements.has(slide.id))elements.set(slide.id,new Map(slide.elements.map(item=>[item.id,item])));
    const element = slide && 'elementId' in op ? elements.get(slide.id)?.get(op.elementId) : undefined;
    const context = entry ? slideLabel(entry.index) : 'Document';
    const result = (target: string, before: string, after: string) => ({slide: context, target, before, after});
    switch (op.op) {
      case 'set_page_elements': {
        const settings=op.settings, scope=op.slideIds ? countLabel(op.slideIds.length,'slide') : 'All slides and new slides';
        return result('Slide details', 'Current page elements', `${scope}\nLabel: ${settings.header || 'None'}\nNote: ${settings.footer || 'None'}\nDate: ${settings.date || 'None'}\nPage numbers: ${settings.pageNumbers ? `${settings.numberFormat} · Start at ${settings.startAt}` : 'None'}\nLogo: ${settings.logo?.name || 'None'}\nFooter divider: ${settings.divider ? 'On' : 'Off'}\nHide on cover: ${settings.hideOnCover ? 'On' : 'Off'}\nHide on breaks: ${settings.hideOnBreaks ? 'On' : 'Off'}`);
      }
      case 'update_element': {const patch={...op.patch,...Object.fromEntries((op.unset??[]).map(key=>[key,undefined]))};return result(element?.name || 'Object', patchText(patch,element,false), patchText(patch,element,true));}
      case 'update_slide': return result(Object.keys(op.patch).length === 1 ? label(Object.keys(op.patch)[0]) : 'Slide settings', patchText(op.patch,slide,false), patchText(op.patch,slide,true));
      case 'set_group': {const previous=slide?.groups?.find(g=>g.id===op.group.id);const parent=(id?:string)=>slide?.autoLayouts?.find(l=>l.id===id)?.name??slide?.groups?.find(g=>g.id===id)?.name??'Slide';return result('Group',previous?`${previous.name} · Parent: ${parent(previous.parent)}`:'New group',`${op.group.name} · Parent: ${parent(op.group.parent)}`);}
      case 'remove_group': return result('Ungroup',slide?.autoLayouts?.find(l=>l.id===op.groupId)?.name??slide?.groups?.find(g=>g.id===op.groupId)?.name??'Group','Lift direct children to the parent; keep nested groups');
      case 'set_group_layout': {
        const layout = slide?.autoLayouts?.find(l => l.id === op.layout.id);
        const describe = (l: typeof op.layout) => `${l.name} · ${sentenceCase(l.direction)}${l.wrap?' · Wrap to new rows':''}\nGap: ${l.justify==='space-between'?'Automatic':`${number(l.gap)} px`} · Padding: ${field('padding',l.padding)}${l.lineGap!==undefined?`\nRow gap: ${number(l.lineGap)} px`:''}${l.direction==='grid'?`\nColumn sizes: ${l.gridSizing==='equal'?'Equal':'Content'}`:''}\nAlignment: ${sentenceCase(l.align)} · ${sentenceCase(l.justify)}\nSize: ${number(l.w)} × ${number(l.h)} px · ${l.widthMode === 'hug' ? 'Hug width' : 'Fixed width'} · ${l.heightMode === 'hug' ? 'Hug height' : 'Fixed height'}\nOrder: ${l.order.map(id=>slide?.elements.find(e=>e.id===id)?.name||slide?.groups?.find(g=>g.id===id)?.name||slide?.autoLayouts?.find(l=>l.id===id)?.name||'Object').join(' → ')}`;
        return result('Auto layout',layout ? describe(layout) : 'Free positioning',describe(op.layout));
      }
      case 'remove_group_layout': return result('Auto layout',slide?.autoLayouts?.find(l=>l.id===op.groupId)?.name||'Auto layout','Keep group with free positioning');
      case 'rename_deck': return result('Document title', deck.title, op.title);
      case 'set_illustration_accent': return result('Illustration accent color', deck.illustrationAccent ?? 'Original colors', op.color);
      case 'set_design_system': return result('Document styles',deck.designSystem?.name ?? 'Default styles',`${op.system.name} · Fonts, colors, and background pattern${op.adopt?' · Match existing native styles':''}`);
      case 'add_element': return result(`Add ${objectNames[op.element.type].toLowerCase()}`, '', `${op.element.name}\n${objectText(op.element)}`);
      case 'delete_element': return result(element?.name || 'Remove object', element ? objectText(element) : '', 'Remove from this slide');
      case 'add_slide': return result('Add slide', '', `${countLabel(op.slide.elements.length,'object')}`);
      case 'delete_slide': return result('Remove slide', context, 'Remove from this document');
      case 'reorder_slides': {
        const order = (ids: string[]) => ids.map((id,i) => `${i+1}. ${slideLabel(slides.get(id)?.index??-1)}`).join('\n');
        return result('Slide order', order(deck.slides.map(s => s.id)), order(op.ids));
      }
      case 'reorder_elements': {
        const order = (ids: string[]) => `Back to front: ${ids.map(id => slide&&elements.get(slide.id)?.get(id)?.name || 'Object').join(' → ')}`;
        return result('Layer order', order(slide?.elements.map(e => e.id) ?? []), order(op.ids));
      }
      case 'register_local_font': return result('Add document font', '', `${op.font.family} · Weight ${op.font.weight} · ${sentenceCase(op.font.style)}`);
      case 'register_online_font': return result('Add online font', '', `${op.font.family} · ${op.font.license}`);
    }
  });
}
