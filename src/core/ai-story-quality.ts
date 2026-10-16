import {copyLoad} from './presentation-review';
import type {CreationBrief,Story} from './ai-story';
import {validateCreationOutline} from './ai-creation-outline';
import {inlineTextWidth} from './inline-text-width';

const answersBelongInNotes=(brief:CreationBrief)=>/(?:answers?[^.。]{0,35}(?:speaker notes|notes only)|答案[^。]{0,20}(?:讲稿|备注))/.test(brief.brief.toLowerCase());
const inferencePattern=/(?:indicat\w*|suggest\w*|reflect\w*|points? to)[^.。!?\n]{0,160}(?:efficien\w*|capacity|demand|improv\w*[^.。!?\n]{0,40}(?:quality|handling|handled)|(?:quality|handling|handled)[^.。!?\n]{0,40}improv\w*)/i;
function assertedInference(copy:string){
 for(const match of copy.matchAll(new RegExp(inferencePattern.source,'gi'))){
  const prefix=copy.slice(0,match.index).replace(/’/g,"'").split(/[.!?;。\n]|\b(?:but|however)\b/i).at(-1)??'';
  const negation="(?:do(?:es)? not|did not|cannot|can't|doesn't|don't|didn't|not)";
  if(new RegExp(negation+"\\s+(?:[\\w'-]+\\s+){0,3}$",'i').test(prefix)||new RegExp(negation+"[^,;.!?\\n]{0,100}\\b(?:or|nor)\\s*$",'i').test(prefix))continue;
  return match;
 }
}

/** Honor explicit answer placement without inventing or discarding authored answers. */
export function placeQuizAnswersInNotes(story:Story,brief:CreationBrief,quizSlides:number[]=[]){
 if(!answersBelongInNotes(brief))return;
 for(const [index,slide] of story.slides.entries()){
  if(!quizSlides.includes(index+1)&&!/(?:knowledge check|quiz|check your understanding|test your understanding|知识检查|小测|测验)/i.test(`${slide.heading} ${slide.body??''}`))continue;
  if(quizSlides.includes(index+1)&&!/[?？]/.test([slide.body,...(slide.points??[]).flatMap(p=>[p.heading,p.body])].filter(Boolean).join(' ')))throw new Error(`Slide ${index+1}: keep the requested knowledge check as actual questions, with answers in notes. Do not replace it with an answered table or summary.`);
  // Question-only lists need independent text frames, not the compact content rows.
  if(['content','summary'].includes(slide.layout))slide.layout='insights';
  const answers:string[]=[];
  if(slide.body?.trim()&&!/[?？]/.test(slide.body)){slide.notes=[slide.notes,slide.body].filter(Boolean).join('\n\n');delete slide.body;}
  if(/[?？]/.test(slide.body??'')&&/(?:steps|list|name|哪些|步骤)/i.test(slide.body??'')&&slide.points?.length&&slide.points.every(p=>p.body.trim()&&!/[?？]/.test(p.heading+p.body))){
   // A recall question followed by its complete answer list is already a quiz.
   // Keep the question visible and move that existing list intact into notes.
   slide.notes=[slide.notes,slide.body,...slide.points.map(p=>`${p.heading}: ${p.body}`)].filter(Boolean).join('\n\n');
   slide.layout='statement';delete slide.points;continue;
  }
  for(const point of slide.points??[]){
   if(!/[?？]\s*$/.test(point.heading)||!point.body.trim()||/[?？]\s*$/.test(point.body))continue;
   answers.push(`${point.heading}\n${point.body}`);point.body='';
  }
  if(answers.length)slide.notes=[slide.notes,...answers].filter(Boolean).join('\n\n');
 }
}

/** Replace unsupported causal inferences with the user's own evidence limit, not another guessed explanation. */
export function groundCreationClaims(story:Story,brief:CreationBrief){
 const limitation=brief.materials.split(/(?<=[。！？;；])|(?<=[.!?])\s+/).find(s=>/(?:no measured causal|cannot.{0,20}caus|不能归因)/i.test(s))?.trim();
 if(!limitation)return;
 const boundary=limitation.length<=65?limitation:/[\p{Script=Han}]/u.test(limitation)?'当前观察不能证明因果。':'These observations do not establish causality.';
 const inference=/(?:indicat\w*|suggest\w*|reflect\w*|points? to)[^.。!?]{0,160}(?:efficien\w*|capacity|demand|improv\w*[^.。!?]{0,40}(?:quality|handling|handled)|(?:quality|handling|handled)[^.。!?]{0,40}improv\w*)/i;
 const unsupportedSignificance=!/(?:statistically significant|统计显著|显著性检验)/i.test(brief.materials);
 const replace=(value:string)=>value.split(/(?<=[。！？])|(?<=[.!?])\s+/).map(sentence=>(inference.test(sentence)||unsupportedSignificance&&/(?:significant(?:ly)?[^.。!?]{0,30}(?:improv|increas|decreas|higher|lower)|显著(?:提升|提高|改善|增加|降低|下降|超过|优于|高于|低于))/i.test(sentence))&&!/(?:does not|do not|cannot|can't|not establish|hypothesis:|假设[：:]|不能|不代表)/i.test(sentence)?boundary:sentence).join(' ');
 for(const slide of story.slides){const heading=replace(slide.heading);slide.heading=slide.chart&&heading!==slide.heading?`${slide.chart.series[0].name}: ${slide.chart.series[0].values[0]} → ${slide.chart.series[0].values.at(-1)}`:heading;if(slide.body)slide.body=replace(slide.body);if(slide.notes)slide.notes=replace(slide.notes);for(const p of slide.points??[]){p.heading=replace(p.heading);p.body=replace(p.body);}}
}

/** Remove model-authored stage directions before adding source-reference notes. */
export function normalizeCreationNotes(story:Story){
 const meta=/^this (?:\w+ )?(?:slide|table) (?:\w+ ){0,2}(?:presents|shows|introduces|explains|outlines|highlights|covers|summarizes|emphasizes|details|articulates)\b|^(?:本页(?:概述|介绍|展示)|讲稿强调)/i;
 for(const slide of story.slides){
  if(!meta.test(slide.notes?.trim()??''))continue;
  const notes=slide.notes!.trim(),end=notes.search(/[.!?。！？](?:\s|$)/);
  slide.notes=(end>=0?notes.slice(end+1).trim():'')||[slide.heading,slide.body,...(slide.points??[]).map(p=>`${p.heading}: ${p.body}`)].filter(Boolean).join('\n');
 }
}

/** Keep a long introductory paragraph intact in notes instead of regenerating unrelated pages. */
export function compactCreationIntros(story:Story){
 for(const [index,slide] of story.slides.entries()){
  if(!slide.body||!['content','insights','team','process','solution','timeline','summary','appendix','case-study','table','comparison','category-chart','trend','composition','decision','action-plan','architecture','hierarchy','gantt','workstreams','kanban','swot','funnel','roadmap','dashboard'].includes(slide.layout)||(inlineTextWidth(slide.body,24,'Inter')<=436*3&&!(slide.layout==='decision'&&(slide.points?.length??0)>2)))continue;
  const body=slide.body;
  const recommendation=body.match(/^.*?[.!?。！？](?:\s|$)/)?.[0].trim()??body;
  if(slide.layout==='decision'&&recommendation.length>200)throw new Error(`Slide ${index+1}: shorten the recommendation to one complete sentence under 200 characters; preserve further detail in notes.`);
  slide.notes=[slide.notes,body].filter(Boolean).join('\n\n');delete slide.body;
  // A recommendation is essential decision content, so keep it visible as a
  // full-width point rather than discarding it with the optional introduction.
  if(slide.layout==='decision'){slide.layout=(slide.points?.length??0)>=4?'content':'insights';slide.points=[{heading:/[\p{Script=Han}]/u.test(slide.heading)?'建议':'Recommendation',body:recommendation},...(slide.points??[])];}
 }
}

/** Repair content before composition, never silently truncate or shrink it. */
export function validateStoryDesign(story:Story,brief:CreationBrief){
 validateCreationOutline(story,brief);
 const issues:string[]=[],seen=new Set<string>(),answersInNotes=answersBelongInNotes(brief);
 if(story.slides.length!==brief.slideCount)issues.push(`Use exactly ${brief.slideCount} slides; received ${story.slides.length}.`);
 for(const [index,slide] of story.slides.entries()){
  const prefix=`Slide ${index+1}`,title=slide.heading.normalize('NFKC').trim().toLocaleLowerCase();
  if(/\bEnglish\b/i.test(brief.brief)&&!/[\p{Script=Han}]/u.test(brief.materials)&&/[\p{Script=Han}]/u.test(JSON.stringify(slide)))issues.push(`${prefix}: the brief requests English, but this slide mixes in Chinese text. Rewrite the authored copy in English while preserving the original facts.`);
  if(slide.body&&slide.body.length>60&&/\b(?:and|or|with|of|to)\s*$/i.test(slide.body))issues.push(`${prefix}: the subtitle ends mid-sentence. Rewrite it as one complete short sentence; keep supporting detail in notes.`);
  const limitedEvidence=/(?:no measured causal|not a cohort|not randomly|not randomized|cannot.{0,20}caus|不能归因|未随机)/i.test(brief.materials);
  if(limitedEvidence){
   const copy=[slide.heading,slide.body,slide.notes,...(slide.points??[]).flatMap(p=>[p.heading,p.body])].filter(Boolean).join('\n');
   const inference=assertedInference(copy);
   if(inference&&!/(?:hypothesis:|hypotheses:|假设[：:])/i.test(copy))issues.push(`${prefix}: the source only supports descriptive observations, but this passage infers an unmeasured cause or outcome: ${JSON.stringify(inference[0])}. Replace it with the actual numerical observation and its evidence limit; do not infer demand, efficiency or quality from counts alone.`);
  }
  if(seen.has(title))issues.push(`${prefix}: give this slide a distinct takeaway heading; it repeats another slide.`);
  seen.add(title);
  if(answersInNotes){
   const visible=[slide.heading,slide.body,...(slide.points??[]).flatMap(p=>[p.heading,p.body]),...(slide.cells??[]).flat()].filter(Boolean).join(' ');
   if(/(?:correct answer|answer key|参考答案|正确答案)/i.test(visible))issues.push(`${prefix}: quiz answers belong only in speaker notes. Remove the visible answer heading and answer text; show the question/scenario instead and put its actual answer in notes.`);
   if(/(?:answer is in the notes|answer is in speaker notes|答案在(?:讲稿|备注))/i.test(slide.notes??''))issues.push(`${prefix}: notes must contain the actual quiz answer, not a placeholder saying the answer is in the notes.`);
   const question=/[?？]/.test(`${slide.heading} ${slide.body??''}`)||(slide.points??[]).some(p=>/[?？]/.test(p.heading)||/^(?:name|describe|choose|identify|what|how|when|which|请|如何|什么)/i.test(p.heading));
   if(/(?:knowledge check|quiz|check your understanding|知识检查|小测|测验)/i.test(`${slide.heading} ${slide.body??''}`)&&!question)issues.push(`${prefix}: this is a knowledge check, not an answered summary. Show an actual question in the heading or body, with scenario points if needed; put each complete answer in speaker notes. Preserve the requested question page.`);
  }
  if(slide.chart&&/^(?:人|位|次|个|people|users?|requests?)$/i.test(slide.chart.suffix.trim())&&[...slide.chart.labels,...slide.chart.series.map(s=>s.name)].some(label=>/(?:率|百分比|\brate\b|\bpercentage\b|\bpercent\b)/i.test(label)))issues.push(`${prefix}: the chart shows absolute counts (${slide.chart.suffix}), but a category/series calls them a rate. Use count labels or an explicitly computed percentage with its denominator; do not relabel raw counts as rates.`);
  if(slide.chart&&slide.chart.labels.length>1&&slide.chart.series.length>1){
   const copy=[slide.heading,slide.body,slide.notes].filter(Boolean).join(' ');
   const rising=/\b(?:increase|growth|rise)\b.{0,30}\b(?:both|all)\b|\b(?:both|all)\b.{0,100}\b(?:increased|grew|rose|rising|increasing)\b|(?:均|都).{0,10}(?:上升|增长|增加)/i.test(copy);
   const falling=/\b(?:decrease|decline|fall)\b.{0,30}\b(?:both|all)\b|\b(?:both|all)\b.{0,100}\b(?:decreased|declined|fell|falling|decreasing)\b|(?:均|都).{0,10}(?:下降|减少|下滑)/i.test(copy);
   const future=/\b(?:aim|goal|target|plan|hope)\b|目标|计划|希望/i.test(copy);
   if(!future&&(rising&&slide.chart.series.some(s=>s.values.at(-1)!<=s.values[0])||falling&&slide.chart.series.some(s=>s.values.at(-1)!>=s.values[0])))issues.push(`${prefix}: the commentary says all series move in one direction, but the supplied data disagrees. Correct the heading, body and notes using these first-to-last values: ${slide.chart.series.map(s=>`${s.name}: ${s.values[0]} to ${s.values.at(-1)}`).join('; ')}. Do not change the data to match the commentary.`);
  }
  if(/^(?:this (?:\w+ )?(?:slide|table) (?:\w+ ){0,2}(?:presents|shows|introduces|explains|outlines|highlights|covers|summarizes|emphasizes|details|articulates)|use this slide|本页(?:概述|介绍|展示)|讲稿强调|capture the audience['’]?s? attention)/i.test(slide.notes?.trim()??''))issues.push(`${prefix}: replace presenter instructions with the actual words to say, including the relevant facts and caveats. Notes must explain the content, not describe what the slide does.`);
  if(brief.delivery!=='presentation')continue;
  if(copyLoad(slide.heading)>18)issues.push(`${prefix}: shorten the heading to about 18 words / 36 CJK characters.`);
  const load=copyLoad([slide.heading,slide.body??'',...(slide.points??[]).flatMap(p=>[p.heading,p.body]),...(slide.cells??[]).flat(),...(slide.block?.items??[]).flatMap(i=>[i.label,i.detail,i.meta??'']),...(slide.block?.periodLabels??[])].join(' '));
  if(load>90)issues.push(`${prefix}: too much copy for presenting (${load} word-equivalents; maximum 90). Keep key evidence visible and move supporting detail into notes.`);
  if((slide.points?.length??0)>5)issues.push(`${prefix}: show at most five points. Consolidate related ideas and keep their detail in notes.`);
  if(slide.cells&& (slide.cells.length>7||Math.max(...slide.cells.map(r=>r.length))>5))issues.push(`${prefix}: the table is too dense for projection. Use at most six data rows and five columns; retain the full detail in notes or choose a reading deck.`);
  if(!slide.notes?.trim())issues.push(`${prefix}: add useful speaker notes with context, evidence limits and a transition; do not just repeat the visible copy.`);

  if(slide.density==='reading')issues.push(`${prefix}: use presentation density. Move supporting detail into notes instead of shrinking the visible type.`);
 }
 if(issues.length)throw new Error(`Revise the story before building: ${issues.slice(0,8).join(' ')} Preserve supplied facts, their precision and requested topics. Do not invent evidence or silently drop it.`);
}

export function storyDesignInstruction(brief:CreationBrief){
 const instruction=`\nDesign the whole narrative before writing slides: identify the audience's question, the central takeaway, the evidence available and the closing action. ${brief.goal?.trim()?'The desired audience outcome is supplied in creation.goal; make the conclusion serve it.':''} For a short deck, avoid a generic agenda unless requested. Headings should state a point rather than a generic topic. Use a process only when the supplied work has a real sequence or dependency. Parallel owners or independent investigations belong in insights or an action-plan table, not a process with arrows. Vary composition according to meaning: use a statement for a turning point, insights for parallel findings, comparison for alternatives, and a decision or summary for the close. Do not repeat the same heading or body copy. Give each slide a different job: establish the point, show evidence or a mechanism, explain its limit, then request one concrete decision. Avoid two consecutive closing slides that repeat the same request. A heading such as “Completed requests rose while reopenings fell” is clearer than “Data analysis”; “先验证费用是否容易理解” is clearer than “项目背景与目标”. Match those examples to the supplied facts, never copy their claims. Use a compact subtitle only when it adds information the heading and evidence do not already say. Never force a decorative chart or unsupported metric into the story. In tables and action plans, use “To confirm” for unsupplied owners or dates; do not manufacture commitments to fill columns. For structured diagrams use short node labels and one concise detail per node; schedules use owner names in detail and numeric period ranges in meta. Do not turn an untested proposal into an observed result: label expected effects as hypotheses or goals on the slide itself, not only in notes. Preserve a cohesive native template family and generous negative space.\n${brief.delivery==='reading'?'This is a reading deck: make each page self-contained, with sufficient explanation and sources. Use reading density when needed.':'This is a live presentation: set presentation density on every slide. Aim for 30–60 visible word-equivalents per slide, never more than 90, with headings under 18 words (about 36 CJK characters), 2–4 concise points (maximum five), and at most six table data rows / five columns. A CJK character counts as half a word. Keep supporting detail in useful speaker notes: what to say, why it matters, evidence limits and a transition. Do not repeat the slide verbatim in notes. Never shrink type to squeeze in extra copy.'}`;
 return instruction+' For a requested knowledge check, author two or three actual question headings with empty bodies and complete answers in notes; never substitute a summary of rules. Before submission, reconcile each supplied fact with a specific slide or speaker note: keep sample sizes, denominators, measurement units, exact values and evidence limits. Notes must carry the useful details removed from the slide, not generic advice to discuss it. Write the actual words a speaker could say: a concrete explanation or example, a relevant evidence limit and a transition. Never fill notes with meta commentary such as this slide presents, capture the audience attention, 本页概述 or 提高听众认知. On comparison charts, show each group sample size in the subtitle or labels when supplied. A date belongs only to the event explicitly associated with it in the source; leave undated observations out of timelines rather than borrowing a nearby date. For operational training, every exception must retain its condition, prohibited action and escalation route; put knowledge-check answers only where requested. Avoid vague judgements such as slight improvement without a stated basis, or claiming an unapproved plan will happen. A short deck does not need repeated requests for approval; close with the actual scope, owner and unresolved constraints supported by the materials.';
}
