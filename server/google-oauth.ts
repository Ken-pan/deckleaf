import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve} from 'node:path';

export const GOOGLE_EXPORT_SCOPES=['https://www.googleapis.com/auth/presentations','https://www.googleapis.com/auth/drive.file'];
export type GoogleOAuthConfig={clientId:string;clientSecret?:string};
type Pending={state:string;verifier:string;browser:string;redirect:string;expires:number;sourceId?:string};
type Session={token:string;expires:number};
const random=()=>randomBytes(32).toString('base64url');
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function oauthCookie(headers:string|undefined,name:string){return headers?.split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1)??'';}
export const GOOGLE_COOKIE='deck_google_session';
export const GOOGLE_PENDING_COOKIE='deck_google_pending';
export function sessionCookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/api/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;}
export async function googleOAuthConfig():Promise<GoogleOAuthConfig|undefined>{
 let value:any;
 if(process.env.GOOGLE_OAUTH_CLIENT_ID)value={client_id:process.env.GOOGLE_OAUTH_CLIENT_ID,client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET};
 else{try{const raw=JSON.parse(await readFile(process.env.DECK_STUDIO_GOOGLE_OAUTH_FILE||resolve(homedir(),'.config/deck-studio/google-oauth.json'),'utf8'));value=raw.installed??raw;}catch(e:any){if(e.code==='ENOENT')return;throw new Error('The local Google OAuth configuration could not be read.');}}
 if(typeof value.client_id!=='string'||!/^[-\w.]+\.apps\.googleusercontent\.com$/.test(value.client_id))throw new Error('Configure a Google Desktop OAuth client for this local app.');
 return {clientId:value.client_id,...(typeof value.client_secret==='string'?{clientSecret:value.client_secret}:{})};
}
/** Authorization codes and access tokens live only in this process. Nothing is
 * written to a document, browser storage, a response body or an application log. */
export class GoogleOAuth {
 private pending=new Map<string,Pending>();private sessions=new Map<string,Session>();
 constructor(private config=googleOAuthConfig,private transport:typeof fetch=fetch,private now=Date.now){}
 private clean(){const now=this.now();for(const[k,v]of this.pending)if(v.expires<=now)this.pending.delete(k);for(const[k,v]of this.sessions)if(v.expires<=now)this.sessions.delete(k);}
 async status(session:string){this.clean();return {configured:Boolean(await this.config()),connected:this.sessions.has(session)};}
 async begin(origin:string,browser:string,sourceId?:string){
  this.clean();const config=await this.config();if(!config)throw new Error('Google sign-in is not configured on this Mac.');
  const url=new URL(origin);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password)throw new Error('Google authorization requires the local app.');
  if(sourceId!==undefined&&!/^[\w-]{10,200}$/.test(sourceId))throw new Error('Choose the native Google source to connect.');
  if(this.pending.size>=32)throw new Error('Too many pending Google connections. Try again shortly.');
  const state=random(),verifier=random(),binding=browser||random(),redirect=`${url.origin}/api/google/oauth/callback`;
  this.pending.set(state,{state,verifier,browser:binding,redirect,expires:this.now()+600000,sourceId});
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const[k,v]of Object.entries({client_id:config.clientId,redirect_uri:redirect,response_type:'code',scope:GOOGLE_EXPORT_SCOPES.join(' '),state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'online',prompt:'select_account'}))auth.searchParams.set(k,v);
  // Google's desktop Picker grants the selected source without access to the
  // rest of Drive or Slides. The returned token can read/update this file and
  // create an editable copy through the same native APIs.
  if(sourceId)for(const[k,v]of Object.entries({scope:GOOGLE_EXPORT_SCOPES[1],prompt:'consent',trigger_onepick:'true',mimetypes:'application/vnd.google-apps.presentation',file_ids:sourceId,include_granted_scopes:'false'}))auth.searchParams.set(k,v);
  return {url:auth.href,browser:binding};
 }
 async complete(params:URLSearchParams,browser:string){
  this.clean();const state=params.get('state')??'',pending=this.pending.get(state);
  if(!pending||!browser||!equal(pending.browser,browser))throw new Error('Google sign-in expired or does not belong to this browser. Connect again.');
  this.pending.delete(state);
  if(params.has('error'))throw new Error('Google sign-in was canceled. You can connect again.');
  const code=params.get('code');if(!code||code.length>10000)throw new Error('Google did not return an authorization code.');
  const config=await this.config();if(!config)throw new Error('Google sign-in configuration is unavailable.');
  const body=new URLSearchParams({client_id:config.clientId,code,code_verifier:pending.verifier,grant_type:'authorization_code',redirect_uri:pending.redirect,...(config.clientSecret?{client_secret:config.clientSecret}:{})});
  const response=await this.transport('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Google could not complete sign-in. Connect again and check the Desktop OAuth client configuration.');
  const result=await response.json() as any;
  if(typeof result.access_token!=='string'||result.access_token.length>10000||result.token_type?.toLowerCase()!=='bearer')throw new Error('Google did not return a valid access token.');
  const granted=new Set(String(result.scope??'').split(' ')),scopes=pending.sourceId?[GOOGLE_EXPORT_SCOPES[1]]:GOOGLE_EXPORT_SCOPES;
  if(scopes.some(scope=>!granted.has(scope)))throw new Error('Google export needs the requested Slides and selected-file Drive access.');
  if(pending.sourceId&&!String(params.get('picked_file_ids')??'').split(',').includes(pending.sourceId))throw new Error('Choose the original Google presentation to authorize its export.');
  const ttl=Math.max(1,Math.min(3600,Number(result.expires_in)||3600)),session=random();this.sessions.set(session,{token:result.access_token,expires:this.now()+ttl*1000});
  return {session,ttl};
 }
 token(session:string){this.clean();const token=this.sessions.get(session)?.token;if(!token)throw Object.assign(new Error('Connect Google again before exporting.'),{status:401});return token;}
 disconnect(session:string,browser:string){this.sessions.delete(session);for(const[k,v]of this.pending)if(v.browser===browser)this.pending.delete(k);}
}
export const googleOAuth=new GoogleOAuth();
