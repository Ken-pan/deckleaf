import test from 'node:test';
import assert from 'node:assert/strict';
import {blankSlide,element,newDeck} from '../src/core/model';
import {keynoteState} from '../src/core/keynote-source';
import {nativeKeynoteEdits} from '../server/keynote-source';
import {applyOperations} from '../src/core/operations';
test('native Keynote route preserves source identity through a real text transaction and rejects layout changes',async()=>{
 const s=blankSlide();const e=element('text',{sourceId:'7',text:'First line\nSecond line',fontFamily:'Arial',paragraphs:[{runs:[{text:'First line',fontFamily:'Arial',fontSize:24}],align:'left',spaceBefore:0,spaceAfter:8,indent:0,firstLineIndent:0},{runs:[{text:'Second line',fontFamily:'Arial',fontSize:24}],align:'left',spaceBefore:8,spaceAfter:0,indent:0,firstLineIndent:0}]});s.elements=[e];const d=newDeck('Native',[s]);
 const baseline=await keynoteState(d);assert.equal(nativeKeynoteEdits(baseline,await keynoteState(d))?.changed,0);
 const edited=applyOperations(d,[{op:'update_element',slideId:s.id,elementId:e.id,patch:{text:'First revised line\nSecond line'}}],0,'manual');const plan=nativeKeynoteEdits(baseline,await keynoteState(edited));assert.equal(plan?.changed,1);assert(plan?.script.includes('set character'));assert(plan?.script.includes('Native text verification failed'));assert(!plan?.script.includes('set object text of candidate'));
 const moved=applyOperations(d,[{op:'update_element',slideId:s.id,elementId:e.id,patch:{x:150}}],0,'manual');assert.equal(nativeKeynoteEdits(baseline,await keynoteState(moved)),null);
 const paragraphs=applyOperations(d,[{op:'update_element',slideId:s.id,elementId:e.id,patch:{text:'First\nSecond\nThird'}}],0,'manual');assert.equal(nativeKeynoteEdits(baseline,await keynoteState(paragraphs)),null);
 const copy=structuredClone(d);copy.slides[0].elements[0].id='new-id';copy.slides[0].elements[0].name='Renamed';assert.equal(nativeKeynoteEdits(baseline,await keynoteState(copy))?.changed,0);
 copy.slides[0].background='#ff0000';assert.equal(nativeKeynoteEdits(baseline,await keynoteState(copy)),null);
 const duplicate=structuredClone(d);duplicate.slides[0].elements.push({...structuredClone(e),id:'duplicate',sourceId:'8'});const duplicateBase=await keynoteState(duplicate);duplicate.slides[0].elements[0].text='First revised line\nSecond line';assert.equal(nativeKeynoteEdits(duplicateBase,await keynoteState(duplicate)),null);
});
