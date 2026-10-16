import type {CreationBrief,Story} from '../src/core/ai-story';

/** Normalize native content shape and literal chart provenance only. Semantic
 * statements, notes, decisions and diagram relationships belong to the author
 * and evidence review, never to topic-specific replacement rules. */
export function groundStructuredPages(story:Story,brief:CreationBrief){
 for(const slide of story.slides){
  if(slide.chart){
   const chart=slide.chart;
   if(/https?:\/\/|^(?:\/|file:)/i.test(chart.source)&&!brief.materials.includes(chart.source))chart.source=/[\p{Script=Han}]/u.test(brief.brief)?'用户提供的材料':'Supplied source material';
   if(/(?:sample sizes?|每组样本|样本量|denominators?)/i.test(brief.brief))chart.labels=chart.labels.map(label=>{
    if(/(?:\bn\s*=|样本|sample)/i.test(label))return label;
    const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const match=brief.materials.match(new RegExp(escaped+'(?:组)?(?:观察|样本(?:量)?[为是:：]?|\\s+(?:observed|sample(?: size)?[:=]?))\\s*(\\d+)','i'));
    return match?`${label} (n=${match[1]})`:label;
   });
  }
  if(slide.points?.length===1&&['content','insights','summary','team'].includes(slide.layout)){
   const [point]=slide.points;slide.notes=[slide.notes,slide.body].filter(Boolean).join('\n\n');slide.body=[point.heading===slide.heading?'':point.heading,point.body].filter(Boolean).join('\n');slide.layout='statement';delete slide.points;
  }
 }
}
