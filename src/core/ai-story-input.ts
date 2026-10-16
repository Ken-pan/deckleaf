import {z} from 'zod';
import {templateContract} from './template-contracts';
import {ChartSchema} from './chart-schema';
import {StorySchema} from './ai-story';
import {deckDesignSystem} from './deck-design-system';
import type {Deck} from './model';

// The model authors evidence. Native design defaults own chart presentation.
const ChartDataSchema=ChartSchema.pick({type:true,labels:true,series:true,source:true}).extend({source:z.string().trim().min(1).max(300),prefix:z.string().max(12).optional(),suffix:z.string().max(12).optional()}).strict();
const common=StorySchema.shape.slides.element.omit({layout:true,chart:true,cells:true,dates:true,points:true,block:true}).extend({notes:z.string().max(5000).optional(),body:z.string().max(700).optional().describe('One COMPLETE concise subtitle or recommendation, preferably under 100 characters. Never truncate a sentence to satisfy a length limit. Put longer background in notes.')});
const plainSlide=common.extend({layout:z.enum(['cover','statement','split','quote','section','close','freeform']),coverResourceId:z.string().max(200).optional().describe('For an illustrated cover only: choose an exact ID from coverArtwork in the creation context. Omit when no suitable choice exists.')});
const points=StorySchema.shape.slides.element.shape.points.unwrap().min(1);
const itemSlide=common.extend({layout:z.enum(['content','insights','agenda','team','process','solution','summary','appendix','case-study','columns','closing','risks']),points});
const decisionSlide=common.extend({layout:z.literal('decision'),body:common.shape.body.unwrap(),points:points.min(2)});
const timelineSlide=common.extend({layout:z.literal('timeline'),points:StorySchema.shape.slides.element.shape.points.unwrap(),dates:StorySchema.shape.slides.element.shape.dates.unwrap()});
const tableSlide=common.extend({layout:z.enum(['table','comparison','action-plan']),cells:StorySchema.shape.slides.element.shape.cells.unwrap()});
const chartSlide=common.extend({layout:z.enum(['category-chart','trend','composition','metrics']),chart:ChartDataSchema.describe('Actual data only. trend=line/area; category-chart=bar/column; composition=pie/donut.')});
const block=StorySchema.shape.slides.element.shape.block.unwrap(),node=block.shape.items.element;
const treeSlide=common.extend({layout:z.enum(['architecture','hierarchy']),block:block.omit({periodLabels:true}).extend({items:z.array(node.omit({meta:true}).extend({parent:node.shape.parent.unwrap()})).min(2).max(8)})});
const scheduleSlide=common.extend({layout:z.enum(['gantt','workstreams']),block:block.extend({items:z.array(node.omit({parent:true}).extend({meta:z.string().regex(/^\d{1,2}[-–]\d{1,2}$/).describe('Only an inclusive numeric period range: "1–2", "2–3", or "3–4". Never "Week 1–2" or an owner. Put the owner in detail; actual period names go in periodLabels.')})).min(1).max(6),periodLabels:block.shape.periodLabels.unwrap()})});
const metricSlide=common.extend({layout:z.enum(['dashboard','funnel','roadmap']),block:block.omit({periodLabels:true}).extend({items:z.array(node.omit({parent:true}).extend({meta:node.shape.meta.unwrap()})).min(1).max(6)})});
const boardSlide=common.extend({layout:z.enum(['kanban','swot']),block:block.omit({periodLabels:true}).extend({items:z.array(node.omit({parent:true,meta:true})).min(2).max(4)})});
export const CreationStorySchema=StorySchema.extend({slides:z.array(z.union([plainSlide,itemSlide,decisionSlide,timelineSlide,tableSlide,chartSlide,treeSlide,scheduleSlide,metricSlide,boardSlide])).min(2).max(12)});

/** A planned page exposes only the fields its native layout can actually use. */
export function creationSlideSchema(layout:string,flexible=false){
 const option=CreationStorySchema.shape.slides.element.options.find(schema=>schema.shape.layout.safeParse(layout).success);
 if(!option)throw new Error('Choose an authored native layout for this page.');
 let schema:z.AnyZodObject=(option as z.AnyZodObject).extend({layout:z.literal(layout)});
 // These layouts share authored fields and parallel relationships. The author
 // can adapt composition to actual copy without changing the page's meaning.
 if(flexible&&['content','insights','summary'].includes(layout))schema=schema.extend({layout:z.enum(['content','insights','summary'])});
 if('points' in option.shape){const counts=templateContract(layout).counts;schema=schema.extend({points:option.shape.points.max(counts.length?Math.max(...counts):5)});}
 return schema;
}

export async function authoredCreationStory(raw:unknown,deck:Deck){
 const value=raw as {slides?:unknown[];collection?:string};
 const system=value?.collection?(await import('./template-collections')).COLLECTIONS.find(c=>c.id===value.collection)?.system??deckDesignSystem(deck):deckDesignSystem(deck);
 return StorySchema.parse({...value,slides:value?.slides?.map(rawSlide=>{
  let slide=rawSlide as {chart?:unknown;layout?:string;source?:string;notes?:string};
  // Covers and several text compositions have no visible source slot. Keep
  // attribution in notes rather than failing the whole story or dropping it.
  if(slide.source&&!['table','comparison','action-plan','appendix','case-study'].includes(slide.layout??'')){
   const {source,...rest}=slide;slide={...rest,notes:[rest.notes,`Source: ${source}`].filter(Boolean).join('\n\n')};
  }
  if(!slide.chart)return slide;
  // Preserve complete charts from existing clients; compact data cannot borrow
  // sample values or require the model to invent colors and rendering settings.
  const full=ChartSchema.safeParse(slide.chart);if(full.success)return {...slide,chart:full.data};
  const data=ChartDataSchema.parse(slide.chart);
  return {...slide,chart:{title:'',subtitle:'',colors:[system.colors.accent,system.colors.ink,system.colors.muted],textColor:system.colors.ink,legend:data.series.length>1,grid:true,showValues:true,stacked:false,categoryTitle:'',valueTitle:'',prefix:'',suffix:'',...data}};
 })});
}
