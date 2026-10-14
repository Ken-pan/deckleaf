import {DEFAULT_DESIGN_SYSTEM,type DesignSystem} from './design-system-schema';
import {DESIGN_PRESETS} from './deck-design-system';
import {PROFESSIONAL_LAYOUTS} from './template-professional-blueprints';

export const PALETTE = {paper: '#f4f3ee', ink: '#26362c', muted: '#687168', accent: '#73856e', dark: '#26362c', onDark: '#eceee4', line: '#c9cfc1'};
export const TEMPLATE_ARTWORK = '/examples/template-assets/paper-study.jpg';
const typography = (display: string, body: string, weight = 500): DesignSystem['typography'] => ({
  title: {fontFamily: display, fontSize: 104, fontWeight: weight, lineHeight: 1.05, letterSpacing: -2},
  heading: {fontFamily: display, fontSize: 64, fontWeight: weight, lineHeight: 1.1, letterSpacing: -1},
  body: {fontFamily: body, fontSize: 30, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0},
  caption: {fontFamily: body, fontSize: 20, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0},
});
export const LAYOUTS = [
  ...PROFESSIONAL_LAYOUTS,
  {id: 'cover', name: 'Cover', description: 'Introduce the subject and author'},
  {id: 'statement', name: 'Key message', description: 'Give one idea the whole page'},
  {id: 'split', name: 'Content and evidence', description: 'Connect a finding to a visual'},
  {id: 'before-after', name: 'Before and after', description: 'Compare at the same scale'},
  {id: 'process', name: 'Decision process', description: 'Show the reasoning in three steps'},
  {id: 'evidence', name: 'Full-width evidence', description: 'Make room for the work itself'},
  {id: 'facts', name: 'Project context', description: 'Set the scope, role, and timeline'},
  {id: 'metrics', name: 'Results', description: 'Pair the takeaway with an editable chart'},
  {id: 'table', name: 'Comparison table', description: 'Make options easy to evaluate'},
  {id: 'quote', name: 'Interview insight', description: 'Give a voice to the research'},
  {id: 'roadmap', name: 'Roadmap', description: 'Set priorities and ownership'},
  {id: 'close', name: 'Closing', description: 'Leave a clear next step'},
  {id: 'agenda', name: 'Contents', description: 'Orient the audience to the story and its sections'},
  {id: 'section', name: 'Section divider', description: 'Introduce a new chapter with one clear idea'},
  {id: 'problem', name: 'Problem framing', description: 'Connect the current friction to its consequence'},
  {id: 'audience', name: 'Audience', description: 'Explain whose needs and context shape the work'},
  {id: 'insights', name: 'Insights', description: 'Distill the evidence into three useful observations'},
  {id: 'solution', name: 'Solution overview', description: 'Show how the parts of the approach fit together'},
  {id: 'gallery', name: 'Visual gallery', description: 'Compare three studies with explanatory captions'},
  {id: 'timeline', name: 'Timeline', description: 'Place four milestones and their outputs in time'},
  {id: 'team', name: 'People and ownership', description: 'Make responsibilities and handoffs explicit'},
  {id: 'risks', name: 'Risks and dependencies', description: 'Pair three uncertainties with actions and owners'},
  {id: 'summary', name: 'Takeaways', description: 'Close the argument with evidence and an implication'},
  {id: 'q-and-a', name: 'Questions', description: 'Invite a focused discussion around open questions'},
] as const;
export type LayoutId = typeof LAYOUTS[number]['id'];
export type CollectionId = 'portfolio' | 'review' | 'proposal' | 'pitch' | 'report' | 'minimal';
export interface TemplateCollection {
  id: CollectionId; name: string; title: string; caption: string; category: string;
  layouts: LayoutId[]; background: string; ink: string; display: string; body: string; system: DesignSystem;
  story?:LayoutId[];legacyLayouts?:LayoutId[];
}
const collection = (id: CollectionId, name: string, title: string, caption: string, category: string, layouts: LayoutId[], system: DesignSystem): TemplateCollection => ({
  id, name, title, caption, category, layouts, background: system.colors.background, ink: system.colors.ink,
  display: system.typography.title.fontFamily, body: system.typography.body.fontFamily, system,
});
export const COLLECTIONS: TemplateCollection[] = [
  collection('portfolio', 'Editorial', 'Selected work', 'A visual case study, from context to craft.', 'Portfolio', ['cover','agenda','facts','audience','problem','statement','quote','insights','split','before-after','process','solution','gallery','evidence','metrics','table','timeline','team','risks','roadmap','summary','section','q-and-a','close'], {...DEFAULT_DESIGN_SYSTEM, colors:{...DEFAULT_DESIGN_SYSTEM.colors,accent:'#576951',muted:'#5d655d'}, typography: typography('Work Sans','Work Sans',500)}),
  collection('review', 'Studio', 'Project review', 'Evidence, decisions, and the next iteration.', 'Project review', ['cover','agenda','facts','audience','problem','quote','insights','split','process','solution','before-after','gallery','evidence','metrics','table','risks','team','timeline','roadmap','section','statement','summary','q-and-a','close'], {...DESIGN_PRESETS[1], colors:{...DESIGN_PRESETS[1].colors,accent:'#3062a7'}, typography: typography('Plus Jakarta Sans','Inter',600)}),
  collection('proposal', 'Monograph', 'Design proposal', 'A considered direction with a clear rationale.', 'Design proposal', ['cover','agenda','facts','audience','problem','quote','insights','statement','split','evidence','solution','gallery','process','timeline','team','table','metrics','risks','roadmap','section','summary','before-after','q-and-a','close'], {...DESIGN_PRESETS[2], colors:{...DESIGN_PRESETS[2].colors,accent:'#8c4a2c',muted:'#695645'}, typography: typography('DM Serif Display','Manrope',400)}),
  collection('pitch', 'Signal', 'Product pitch', 'Problem, product, traction, and the ask.', 'Pitch deck', ['cover','agenda','statement','problem','audience','quote','insights','solution','split','gallery','evidence','metrics','table','before-after','process','team','facts','timeline','risks','roadmap','section','summary','q-and-a','close'], {...DEFAULT_DESIGN_SYSTEM, name:'Signal', colors:{background:'#171c2a',ink:'#f5f6fa',muted:'#b3bdcf',accent:'#b6caff',surface:'#293346',line:'#49556b',dark:'#0d111b',onDark:'#f5f6fa'}, typography:typography('Space Grotesk','Inter',500)}),
  collection('report', 'Ledger', 'Quarterly report', 'A readable story behind the numbers.', 'Data report', ['cover','agenda','facts','summary','audience','problem','metrics','table','before-after','insights','split','evidence','gallery','quote','process','solution','team','timeline','risks','roadmap','section','statement','q-and-a','close'], {...DEFAULT_DESIGN_SYSTEM, name:'Ledger', colors:{background:'#fbfbf9',ink:'#20282d',muted:'#646a70',accent:'#315b85',surface:'#f0f1ef',line:'#d5d9d6',dark:'#20282d',onDark:'#ffffff'}, typography:typography('Source Sans 3','Source Sans 3',600)}),
  collection('minimal', 'Minimalist', 'A clear idea', 'Space, structure, and only what matters.', 'General presentation', ['cover','agenda','section','statement','facts','problem','audience','quote','insights','split','solution','gallery','evidence','before-after','process','metrics','table','timeline','roadmap','team','risks','summary','q-and-a','close'], {...DEFAULT_DESIGN_SYSTEM, name:'Minimalist', colors:{background:'#ffffff',ink:'#171717',muted:'#666666',accent:'#333333',surface:'#f2f2f2',line:'#d3d3d3',dark:'#171717',onDark:'#ffffff'}, typography:typography('Inter','Inter',500)}),
];

// Keep the original stories intact and add the task library before the conclusion.
const stories:Record<CollectionId,LayoutId[]>={
 portfolio:['cover','agenda','summary','facts','audience','problem','quote','insights','section','split','annotation','evidence','before-after','comparison','case-study','content','solution','process','metrics','trend','gallery','team','decision','close'],
 review:['cover','agenda','summary','facts','problem','audience','quote','content','insights','split','annotation','before-after','comparison','matrix','solution','hierarchy','metrics','dashboard','trend','risks','workstreams','action-plan','decision','close'],
 proposal:['cover','agenda','summary','facts','problem','quote','statement','solution','section','split','gallery','content','case-study','annotation','comparison','table','metrics','dashboard','composition','risks','timeline','workstreams','decision','close'],
 pitch:['cover','agenda','summary','facts','audience','problem','quote','split','annotation','solution','case-study','before-after','metrics','dashboard','trend','composition','table','comparison','team','hierarchy','workstreams','risks','decision','close'],
 report:['cover','agenda','summary','facts','audience','problem','metrics','dashboard','category-chart','trend','composition','table','section','content','insights','matrix','case-study','workstreams','timeline','risks','action-plan','decision','appendix','close'],
 minimal:['cover','agenda','summary','facts','content','quote','section','insights','split','annotation','gallery','before-after','process','category-chart','trend','composition','dashboard','table','matrix','hierarchy','workstreams','action-plan','decision','close'],
};
for(const c of COLLECTIONS){c.legacyLayouts=[...c.layouts];c.story=stories[c.id];c.layouts.splice(c.layouts.length-1,0,...PROFESSIONAL_LAYOUTS.map(l=>l.id));}

