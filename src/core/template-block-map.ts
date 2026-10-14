import type {BlockId} from './deck-block-schema';
export const TEMPLATE_BLOCKS:Record<string,BlockId>={agenda:'agenda',process:'process',solution:'process',team:'organization',timeline:'timeline',roadmap:'roadmap',dashboard:'metrics',hierarchy:'organization',workstreams:'gantt',architecture:'architecture',gantt:'gantt',kanban:'kanban',swot:'swot',funnel:'funnel'};
export const templateBlockId=(id:string):BlockId|undefined=>TEMPLATE_BLOCKS[id];
