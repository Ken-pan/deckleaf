import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDeck,blankSlide,element} from '../src/core/model';
import {resolvePageRequest,validatePageRequest} from '../src/core/ai-page-request';
import {applyOperations,type Proposal} from '../src/core/operations';
import {proposeAI} from '../server/ai';

const oldCopy='从好模板开始，把故事讲清楚。接下来，交给你继续打磨。';
const newCopy='从好模板开始，把故事讲清楚。让每一次表达更从容。';
function fixture(){
 const slides=[1,2].map(n=>{const slide=blankSlide();slide.elements=[element('text',{id:`title-${n}`,text:`Title ${n}`}),element('text',{id:`body-${n}`,text:n===1?oldCopy:'Old subtitle'}),element('image',{id:`art-${n}`,src:'data:image/svg+xml;base64,PHN2Zy8+',x:100,y:100,w:96,h:96})];slide.template={collection:'review',prototype:'cover',variant:'default',density:'presentation',slots:[{key:'heading',elementId:`title-${n}`},{key:'body',elementId:`body-${n}`}]};return slide;});
 return newDeck('Replacement',slides);
}
function proposal(d:ReturnType<typeof fixture>,slideIndex:number,text:string,elementId=`body-${slideIndex+1}`):Proposal{return {baseRevision:d.revision,summary:'Replace subtitle',operations:[{op:'update_element',slideId:d.slides[slideIndex].id,elementId,patch:{text}}]};}

test('exact real subtitle replacement accepts the destination without retaining the source',()=>{
 const d=fixture(),before=JSON.stringify(d),prompt=`仅把当前第1页的副标题“${oldCopy}”改为“${newCopy}”，其他内容、样式和素材保持不变。`,request=resolvePageRequest(d,prompt),p=proposal(d,0,newCopy);
 assert.deepEqual(request.pages[0].texts,[newCopy]);assert.deepEqual(request.pages[0].textFields,[{key:'body',value:newCopy}]);
 assert.doesNotThrow(()=>validatePageRequest(d,p,request));const after=applyOperations(d,p.operations,p.baseRevision,'ai');assert.equal(after.slides[0].elements.find(e=>e.id==='body-1')?.text,newCopy);assert.deepEqual(after.slides[1],d.slides[1]);assert.equal(JSON.stringify(d),before);
 assert.throws(()=>validatePageRequest(d,proposal(d,0,oldCopy+'!'),request),/missing requested text/);
 assert.throws(()=>validatePageRequest(d,proposal(d,0,newCopy,'title-1'),request),/field body/);
 assert.throws(()=>validatePageRequest(d,proposal(d,1,newCopy),request),/not requested for editing/);
});

test('replacement sources are excluded for supported quote styles and connectors',()=>{
 const d=fixture();for(const [left,right,connector]of [['「','」','改成'],['“','”','替换为'],['"','"','修改为'],["'","'",'更新为'],['“','”','→'],['"','"','with'],['"','"','to']] as const){const request=resolvePageRequest(d,`第1页把${left}旧副标题${right}${connector}${left}新副标题${right}。`);assert.deepEqual(request.pages[0].texts,['新副标题'],connector);}
 assert.deepEqual(resolvePageRequest(d,'第1页标题改为「主标题」，副标题改为「副标题」。').pages[0].texts,['主标题','副标题']);
 assert.deepEqual(resolvePageRequest(d,'第1页正文改为「先把“原句”改为“新句”，再继续。」。').pages[0].texts,['先把“原句”改为“新句”，再继续。']);
});

test('multi-page replacements keep every destination tied to its correct semantic slot',()=>{
 const d=fixture(),request=resolvePageRequest(d,`第1页副标题“${oldCopy}”改为“${newCopy}”，标题「Title 1」改为「新主标题」。第2页副标题「Old subtitle」改为「第二页新副标题」。`),p:Proposal={baseRevision:0,summary:'Complete replacements',operations:[...proposal(d,0,newCopy).operations,...proposal(d,0,'新主标题','title-1').operations,...proposal(d,1,'第二页新副标题').operations]};
 assert.deepEqual(request.pages.map(p=>p.texts),[[newCopy,'新主标题'],['第二页新副标题']]);assert.doesNotThrow(()=>validatePageRequest(d,p,request));
 assert.throws(()=>validatePageRequest(d,{...p,operations:p.operations.slice(0,2)},request),/Slide 2 is missing requested text/);
});

test('single-page provider loop accepts a correct old-to-new replacement on its first response',async()=>{
 const d=fixture();let turns=0;const transport:typeof fetch=async()=>{turns++;return Response.json({output:[{type:'function_call',call_id:'copy-replacement',name:'propose_updates',arguments:JSON.stringify({baseRevision:0,summary:'Replace subtitle',updates:[{slideId:d.slides[0].id,elementId:'body-1',text:newCopy}]})}]});};
 const p=await proposeAI(d,`第1页副标题“${oldCopy}”改为“${newCopy}”，其他内容、样式和素材保持不变。`,{slideIds:[d.slides[0].id],elementIds:[]},{provider:'openai',baseUrl:'',model:'fixture',apiKey:'fixture-key'},{transport});
 assert.equal(turns,1);validatePageRequest(d,p,resolvePageRequest(d,`第1页副标题“${oldCopy}”改为“${newCopy}”。`));assert.equal(applyOperations(d,p.operations,0,'ai').slides[0].elements.find(e=>e.id==='body-1')?.text,newCopy);
});

test('ordinary English apostrophes remain instructions while quoted contractions remain copy',()=>{
 const d=fixture(),request=resolvePageRequest(d,"Change slide 1's subtitle to “New English subtitle”; don't change any other content.");assert.deepEqual(request.pages.map(p=>p.number),[1]);assert.deepEqual(request.pages[0].texts,['New English subtitle']);assert.doesNotThrow(()=>validatePageRequest(d,proposal(d,0,'New English subtitle'),request));
 const quoted=resolvePageRequest(d,"Change slide 1 subtitle from 'Old subtitle' to 'It's clearer now'.");assert.deepEqual(quoted.pages[0].texts,["It's clearer now"]);assert.doesNotThrow(()=>validatePageRequest(d,proposal(d,0,"It's clearer now"),quoted));
 const empty=resolvePageRequest(d,'第1页副标题「旧文案」改为「」。');assert.deepEqual(empty.pages[0].textFields,[{key:'body',value:''}]);assert.doesNotThrow(()=>validatePageRequest(d,proposal(d,0,''),empty));
});
