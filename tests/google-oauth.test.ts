import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GoogleOAuth,GOOGLE_EXPORT_SCOPES,oauthCookie,sessionCookie} from '../server/google-oauth';

const config=async()=>({clientId:'fixture.apps.googleusercontent.com',clientSecret:'fixture-client-secret'});
test('Google OAuth binds a single-use PKCE code to the initiating browser and keeps tokens out of public status',async()=>{
 let exchanged:URLSearchParams|undefined;
 const transport:typeof fetch=async(_url,init)=>{exchanged=new URLSearchParams(String(init?.body));return Response.json({access_token:'fixture-private-access-token',token_type:'Bearer',expires_in:3600,scope:GOOGLE_EXPORT_SCOPES.join(' ')});};
 const oauth=new GoogleOAuth(config,transport),start=await oauth.begin('http://127.0.0.1:4310',''),url=new URL(start.url),params=new URLSearchParams({state:url.searchParams.get('state')!,code:'fixture-code'});
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('access_type'),'online');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 await assert.rejects(oauth.complete(params,'another-browser'),/does not belong/);assert.equal(exchanged,undefined);
 const completed=await oauth.complete(params,start.browser);
 assert.equal(createHash('sha256').update(exchanged!.get('code_verifier')!).digest('base64url'),url.searchParams.get('code_challenge'));
 assert.equal(exchanged!.get('redirect_uri'),'http://127.0.0.1:4310/api/google/oauth/callback');assert.equal(exchanged!.get('client_secret'),'fixture-client-secret');
 assert.deepEqual(await oauth.status(completed.session),{configured:true,connected:true});assert.equal(oauth.token(completed.session),'fixture-private-access-token');
 assert.ok(!JSON.stringify(completed).includes('access-token'));assert.ok(!JSON.stringify(await oauth.status(completed.session)).includes('fixture-private'));
 await assert.rejects(oauth.complete(params,start.browser),/expired/);
 oauth.disconnect(completed.session,start.browser);assert.throws(()=>oauth.token(completed.session),/Connect Google/);
});
test('Google authorization expires, rejects remote origins and missing grants, and never keeps refresh tokens',async()=>{
 let now=0,calls=0;
 const transport:typeof fetch=async()=>{calls++;return Response.json({access_token:'fixture-token',refresh_token:'never-persisted',token_type:'Bearer',scope:GOOGLE_EXPORT_SCOPES[0]});};
 const oauth=new GoogleOAuth(config,transport,()=>now);
 await assert.rejects(oauth.begin('https://example.com',''),/local app/);
 const expired=await oauth.begin('http://localhost:4310','');now=600001;
 await assert.rejects(oauth.complete(new URLSearchParams({state:new URL(expired.url).searchParams.get('state')!,code:'fixture'}),expired.browser),/expired/);assert.equal(calls,0);
 const denied=await oauth.begin('http://localhost:4310','');await assert.rejects(oauth.complete(new URLSearchParams({state:new URL(denied.url).searchParams.get('state')!,code:'fixture'}),denied.browser),/requested Slides/);assert.equal(calls,1);
 assert.deepEqual(await oauth.status(''),{configured:true,connected:false});
});
test('Google session leases expire and cookies cannot be read by frontend JavaScript',async()=>{
 let now=0;const transport:typeof fetch=async()=>Response.json({access_token:'fixture-token',token_type:'Bearer',expires_in:60,scope:GOOGLE_EXPORT_SCOPES.join(' ')});
 const oauth=new GoogleOAuth(config,transport,()=>now),begin=await oauth.begin('http://localhost:4310',''),completed=await oauth.complete(new URLSearchParams({state:new URL(begin.url).searchParams.get('state')!,code:'fixture'}),begin.browser);
 assert.equal(oauth.token(completed.session),'fixture-token');now=60000;assert.throws(()=>oauth.token(completed.session),/Connect Google/);
 assert.match(sessionCookie('session','fixture',60),/HttpOnly; SameSite=Lax/);assert.equal(oauthCookie('other=bad; session=fixture','session'),'fixture');
});

test('native source Picker requests only selected-file access and rejects an unrelated selection',async()=>{
 const sourceId='native_source_123',transport:typeof fetch=async()=>Response.json({access_token:'fixture-selected-file-token',token_type:'Bearer',expires_in:3600,scope:GOOGLE_EXPORT_SCOPES[1]});
 const oauth=new GoogleOAuth(config,transport),begin=await oauth.begin('http://127.0.0.1:4310','',sourceId),url=new URL(begin.url);
 assert.equal(url.searchParams.get('scope'),GOOGLE_EXPORT_SCOPES[1]);assert.equal(url.searchParams.get('trigger_onepick'),'true');assert.equal(url.searchParams.get('file_ids'),sourceId);assert.equal(url.searchParams.get('include_granted_scopes'),'false');
 await assert.rejects(oauth.complete(new URLSearchParams({state:url.searchParams.get('state')!,code:'fixture',picked_file_ids:'unrelated_file_123'}),begin.browser),/original Google presentation/);
 const chosen=await oauth.begin('http://127.0.0.1:4310','',sourceId),done=await oauth.complete(new URLSearchParams({state:new URL(chosen.url).searchParams.get('state')!,code:'fixture',picked_file_ids:sourceId}),chosen.browser);
 assert.equal(oauth.token(done.session),'fixture-selected-file-token');assert.deepEqual(await oauth.status(done.session),{configured:true,connected:true});
 await assert.rejects(oauth.begin('http://127.0.0.1:4310','','invalid'),/native Google source/);
});
