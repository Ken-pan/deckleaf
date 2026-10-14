import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handler, config} from '../netlify/functions/open-resources';
import {browserResourceJson} from '../src/core/web/resources';

test('public proxy rejects unsupported methods and malformed parameters without an upstream call', async () => {
  assert.equal((await handler({httpMethod: 'POST', queryStringParameters: null})).statusCode, 405);
  const previous = process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED;
  process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = 'true';
  try {
  const invalid: Record<string,string>[] = [{kind:'photo',q:'x'.repeat(201)}, {kind:'photo',page:'9999'}, {action:'import',id:'openverse:------------------------------------'}, {kind:'photo',source:'unsplash'}];
  for (const params of invalid) {
    const result = await handler({httpMethod:'GET',queryStringParameters:params}); assert.equal(result.statusCode,400);
  }
  assert.deepEqual(config.rateLimit.aggregateBy, ['ip','domain']);
  } finally { if(previous === undefined) delete process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED; else process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = previous; }
});
test('operator can shut down photo requests before any provider access', async () => {
  const previous = process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED;
  process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = 'false';
  try { assert.equal((await handler({httpMethod:'GET',queryStringParameters:{kind:'photo',q:'cloud'}})).statusCode,503); }
  finally { if(previous === undefined) delete process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED; else process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = previous; }
});
test('browser resource adapter neither stores developer credentials nor advertises an enabled stock provider', async () => {
  const params = new URLSearchParams();
  const status = await browserResourceJson('/api/resources/providers',params,'GET',null);
  assert.ok(status.every((provider: any) => provider.configured === false));
  await assert.rejects(browserResourceJson('/api/resources/providers',params,'PUT',{provider:'unsplash',key:'fictional-test-key'}), /not enabled/);
});

test('fresh hosted deployments stay disabled until explicitly enabled', async () => {
  const previous = process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED;
  try { for(const setting of [undefined, 'false', 'TRUE', '1']) {
    if(setting === undefined) delete process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED; else process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = setting;
    assert.equal((await handler({httpMethod:'GET',queryStringParameters:{kind:'photo',q:'cloud'}})).statusCode,503);
  }} finally { if(previous === undefined) delete process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED; else process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = previous; }
});

test('legacy photo settings remain accepted but the new disable switch wins', async () => {
  const current = process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED;
  const legacy = process.env.DECKLEAF_PHOTO_SEARCH_ENABLED;
  try {
    delete process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED;
    process.env.DECKLEAF_PHOTO_SEARCH_ENABLED = 'true';
    assert.equal((await handler({httpMethod:'GET',queryStringParameters:{kind:'photo',q:'x'.repeat(201)}})).statusCode,400);
    process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = 'false';
    assert.equal((await handler({httpMethod:'GET',queryStringParameters:{kind:'photo',q:'cloud'}})).statusCode,503);
  } finally {
    if(current === undefined) delete process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED; else process.env.DECKSPRIG_PHOTO_SEARCH_ENABLED = current;
    if(legacy === undefined) delete process.env.DECKLEAF_PHOTO_SEARCH_ENABLED; else process.env.DECKLEAF_PHOTO_SEARCH_ENABLED = legacy;
  }
});
