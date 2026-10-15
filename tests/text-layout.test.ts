import {test} from 'node:test';
import assert from 'node:assert/strict';
import {element, blankSlide, newDeck, validateDeck} from '../src/core/model';
import {applyOperations, type Operation} from '../src/core/operations';
import {type TextSizeMeasure} from '../src/core/text-layout';
import {createLayout} from '../src/core/templates';
import {createLayoutCandidate, layoutProposal} from '../src/core/auto-layout';

const measure: TextSizeMeasure = e => ({w: e.text.length * e.fontSize, h: Math.ceil(e.text.length * e.fontSize / e.w) * e.fontSize * e.lineHeight});
function fixture(mode: 'fixed' | 'auto-width' | 'auto-height') {
  const s = blankSlide(); s.elements.push(element('text', {text: 'Evidence', w: 300, h: 160, textSizing: mode}));
  return newDeck('Text sizing', [s]);
}
function change(d: ReturnType<typeof fixture>, patch: Partial<ReturnType<typeof element>>, actor: 'ai'|'manual' = 'manual') {
  const s = d.slides[0]; return applyOperations(d, [{op: 'update_element', slideId: s.id, elementId: s.elements[0].id, patch}], d.revision, actor, measure);
}
test('old documents and fixed text keep authored dimensions after content and typography edits', () => {
  const d = fixture('fixed'); delete (d.slides[0].elements[0] as Partial<ReturnType<typeof element>>).textSizing;
  assert.equal(validateDeck(d).slides[0].elements[0].textSizing, 'fixed');
  const e = change(validateDeck(d), {text: 'Longer evidence', fontSize: 44}).slides[0].elements[0];
  assert.deepEqual([e.w,e.h], [300,160]);
});
test('automatic text geometry is part of the same manual/AI transaction and leaves source untouched', () => {
  for (const actor of ['manual','ai'] as const) for (const mode of ['auto-width','auto-height'] as const) {
    const d = fixture(mode), before = JSON.stringify(d);
    const result = change(d, {text: 'Updated evidence', fontSize: 40}, actor), e = result.slides[0].elements[0];
    assert.equal(e.w, mode === 'auto-height' ? 300 : 640); assert.equal(e.h, 150);
    assert.equal(result.revision, d.revision + 1); assert.equal(JSON.stringify(d), before);
  }
});
test('authored width keeps automatic height; authored height/corner sizes switch to fixed and moves preserve mode', () => {
  const d = fixture('auto-width');
  assert.equal(change(d, {x: 50}).slides[0].elements[0].textSizing, 'auto-width');
  const narrowed = change(d, {w: 60}).slides[0].elements[0];
  assert.equal(narrowed.textSizing,'auto-height'); assert.equal(narrowed.w,60); assert(narrowed.h > 160);
  const manual = change(d,{w:250,h:70}).slides[0].elements[0]; assert.deepEqual([manual.textSizing,manual.w,manual.h], ['fixed',250,70]);
  assert.equal(change(d,{textSizing:'auto-height',w:250,h:70}).slides[0].elements[0].textSizing,'auto-height');
});
test('invalid measurement and stale/locked AI changes roll back atomically', () => {
  const d = fixture('auto-height'), s=d.slides[0], e=s.elements[0], before=JSON.stringify(d);
  const ops: Operation[]=[{op:'update_element',slideId:s.id,elementId:e.id,patch:{text:'New'}}];
  assert.throws(()=>applyOperations(d,ops,0,'manual',()=>({w:300,h:NaN})));
  assert.equal(JSON.stringify(d),before);
  assert.throws(()=>applyOperations(d,ops,99,'ai',measure));
  e.locked=true; assert.throws(()=>applyOperations(d,ops,0,'ai',measure));
});
test('content-and-evidence templates wrap headings and body in persistent responsive frames', () => {
  const s=createLayout('split'), title=s.elements.find(e=>e.text==='The evidence')!,body=s.elements.find(e=>e.text.startsWith('Describe what you observed.'))!;
  assert.equal(title.textSizing,'auto-height');assert.equal(title.layoutItem?.widthMode,'fill');assert.equal(title.layoutItem?.maxWidth,516);
  assert.equal(body.textSizing,'auto-height');assert.equal(body.layoutItem?.widthMode,'fill');assert.equal(body.w,516);
});
test('automatic layout retains authored text sizing modes while repositioning text', () => {
  const d=fixture('auto-height'), s=d.slides[0];
  const candidate=createLayoutCandidate(d,s.id,'story');
  const proposal=layoutProposal(d,[candidate]);
  assert(proposal);
  const after=applyOperations(d,proposal.operations,proposal.baseRevision);
  assert.equal(after.slides[0].elements[0].textSizing,'auto-height');
});
