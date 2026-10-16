import type {CreationBrief,Story} from './ai-story';

/** Only recognize a complete, consecutive user-authored page list. Numbers in
 * prose, metrics and partial suggestions must not become an invented outline. */
export function explicitCreationOutline(brief:CreationBrief){
 const matches=[...brief.brief.matchAll(/(?:^|[\s:：,，;；。])(?:第\s*)?(1[0-2]|[1-9])(?:\s*页\s*|[.)、]\s*|\s+)/g)];
 const start=matches.findIndex((m,i)=>Number(m[1])===1&&Array.from({length:brief.slideCount},(_,n)=>Number(matches[i+n]?.[1])===n+1).every(Boolean));
 if(start<0)return [];
 return matches.slice(start,start+brief.slideCount).map((m,i)=>({number:i+1,requirement:brief.brief.slice(m.index!+m[0].length,matches[start+i+1]?.index??brief.brief.length).trim()}));
}
export function validateCreationOutline(story:Story,brief:CreationBrief){
 for(const page of explicitCreationOutline(brief)){
  const slide=story.slides[page.number-1];if(!slide)continue;
  const chart=/\b(?:chart|graph)\b|图表|柱状图|折线图|对比图/i.test(page.requirement),table=/\btable\b|表格/i.test(page.requirement);
  if(chart&&!table&&!slide.chart)throw new Error(`Slide ${page.number}: the brief requests a native chart, not a text/table substitute. Supply actual chart data, source and the requested denominators. Requirement: ${page.requirement}`);
  if(table&&!chart&&!slide.cells)throw new Error(`Slide ${page.number}: the brief requests a readable native table. Use authored cells including headers. Requirement: ${page.requirement}`);
 }
}
