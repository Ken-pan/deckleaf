import test from 'node:test';
import assert from 'node:assert/strict';
import {publicOrigin} from '../scripts/public-origin.mjs';

test('self-host origin is normalized and rejects credentials or URL components', () => {
  assert.equal(publicOrigin('https://slides.example.org:8443/'), 'https://slides.example.org:8443');
  for (const value of ['http://slides.example.org','https://user:secret@slides.example.org','https://slides.example.org/app','https://slides.example.org/?token=secret','https://slides.example.org/#sample','javascript:alert(1)']) {
    assert.throws(() => publicOrigin(value));
  }
});

test('new public-origin setting takes precedence over the legacy fallback', () => {
  const current = process.env.DECKSPRIG_PUBLIC_ORIGIN;
  const legacy = process.env.DECKLEAF_PUBLIC_ORIGIN;
  try {
    delete process.env.DECKSPRIG_PUBLIC_ORIGIN;
    process.env.DECKLEAF_PUBLIC_ORIGIN = 'https://old.example.org';
    assert.equal(publicOrigin(), 'https://old.example.org');
    process.env.DECKSPRIG_PUBLIC_ORIGIN = 'https://new.example.org';
    assert.equal(publicOrigin(), 'https://new.example.org');
  } finally {
    if (current === undefined) delete process.env.DECKSPRIG_PUBLIC_ORIGIN; else process.env.DECKSPRIG_PUBLIC_ORIGIN = current;
    if (legacy === undefined) delete process.env.DECKLEAF_PUBLIC_ORIGIN; else process.env.DECKLEAF_PUBLIC_ORIGIN = legacy;
  }
});
