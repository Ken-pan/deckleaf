import test from 'node:test';
import assert from 'node:assert/strict';
import {publicOrigin} from '../scripts/public-origin.mjs';

test('self-host origin is normalized and rejects credentials or URL components', () => {
  assert.equal(publicOrigin('https://slides.example.org:8443/'), 'https://slides.example.org:8443');
  for (const value of ['http://slides.example.org','https://user:secret@slides.example.org','https://slides.example.org/app','https://slides.example.org/?token=secret','https://slides.example.org/#sample','javascript:alert(1)']) {
    assert.throws(() => publicOrigin(value));
  }
});
