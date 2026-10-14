import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDeck,blankSlide,validateDeck} from '../src/core/model';
import {workspaceOpenError} from '../src/core/ui-copy';

test('document validation failures have readable recovery copy locally and after server serialization',()=>{
  const deck=newDeck('Preserved source',[blankSlide()]);
  deck.slides[0].source={provider:'PDF',render:'unsupported-image-link',warnings:[],fidelity:'source-render'};
  const original=structuredClone(deck);
  assert.throws(()=>validateDeck(deck),error=>{
    const local=workspaceOpenError(error),remote=workspaceOpenError((error as Error).message);
    assert.equal(local,remote);
    assert.match(local,/document/i);
    assert.match(local,/invalid|unsupported/);
    assert.doesNotMatch(local,/"code"|"path"|source.*render/);
    return true;
  });
  assert.deepEqual(deck,original);
});

test('ordinary conflict and recovery instructions retain their specific supported next steps',()=>{
  for(const message of ['Export the current recovery draft before continuing.','These changes have not been saved to the document library. Export a copy or retry saving.','[A draft] is unavailable. Open the document library.']) {
    assert.equal(workspaceOpenError(new Error(message)),message);
    assert.equal(workspaceOpenError(message),message);
  }
});

test('unknown failures provide a recovery action without serializing arbitrary objects',()=>{
  for(const failure of [undefined,null,{},new Error('')])assert.match(workspaceOpenError(failure),/Try again/);
});
