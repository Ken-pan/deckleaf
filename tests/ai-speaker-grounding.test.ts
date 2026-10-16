import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groundStructuredPages} from '../server/ai-creation-grounding';
import type {Story,CreationBrief} from '../src/core/ai-story';
const brief:CreationBrief={brief:'Explain the evidence and choose the next validation.',materials:'Proposed next work: review reasons. Requested decision: approve an investigation. If a book is damaged, notify the coordinator. A backup copies the database.',audience:'Maintainers',goal:'Choose next work',collection:'review',delivery:'presentation',templateMode:'auto',slideCount:4};
test('native normalization preserves authored decisions, explanations, quiz wording and graph edges for semantic review',()=>{
 const story:Story={title:'Review',slides:[{layout:'comparison',heading:'Exceptions',cells:[['Condition','Action'],['Damage','Notify the coordinator']],notes:'Let the coordinator decide what happens next.'},{layout:'insights',heading:'Knowledge check',points:[{heading:'Who should handle a damaged book?',body:''},{heading:'When should you ask for help?',body:''}],notes:'The coordinator decides exceptions.'},{layout:'architecture',heading:'Data path',block:{items:[{label:'API',detail:'Requests',parent:-1},{label:'Database',detail:'Records',parent:0},{label:'Backup',detail:'Copy',parent:0}]}},{layout:'close',heading:'Authorize the investigation',body:'Agree the scope before deciding to launch.',notes:'We are asking for a validation step, not claiming that the work has already succeeded.'}]};
 const before=structuredClone(story);groundStructuredPages(story,brief);assert.deepEqual(story,before);
});
test('chart and timeline normalization does not overwrite the presenter script with source snippets',()=>{
 const story:Story={title:'Evidence',slides:[{layout:'timeline',heading:'What we learned',dates:['September 2','September 9'],points:[{heading:'Interview',body:'12 people.'},{heading:'Prototype test',body:'8 people.'}],notes:'These activities answer different questions; further validation remains useful.'},{layout:'close',heading:'Next validation',notes:'Choose a focused next step.'}]};
 const before=structuredClone(story);groundStructuredPages(story,{...brief,materials:'September 2 interviewed 12 people. September 9 tested 8 people.'});assert.deepEqual(story,before);
});
