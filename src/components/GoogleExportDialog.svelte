<script lang="ts">
 import Notice from './ui/Notice.svelte';
 import {onDestroy,onMount} from 'svelte';
 import type {Deck} from '../core/model';
 import {keynoteState} from '../core/keynote-source';
 import Dialog from './Dialog.svelte';
 import {Button,DialogFooter} from './ui';
 let {readDocument,onclose,oncomplete,onconnection}:{readDocument:()=>Promise<Deck>;onclose:()=>void;oncomplete?:(result:{url:string})=>void;onconnection?:(connected:boolean)=>void}=$props();
 let token=$state(''),busy=$state(false),error=$state(''),url=$state(''),configured=$state(false),connected=$state(false),connecting=$state(false),checking=$state(true),disconnecting=$state(false);
 let failedAction=$state<'check'|'connect'|'disconnect'|'export'>('check');
 let disposed=false,timer:ReturnType<typeof setInterval>|undefined,popup:Window|null=null;
 const working=$derived(busy||connecting||checking||disconnecting);
 function stop(){if(timer)clearInterval(timer);timer=undefined;connecting=false;}
 async function status(){const r=await fetch('/api/google/oauth/status');if(!r.ok)throw new Error('Google connection status is unavailable. Try again.');const s=await r.json();if(!disposed){configured=s.configured;connected=s.connected;}return s.connected;}
 async function checkConnection(){if(disposed)return;checking=true;error='';try{await status();}catch(e:any){if(!disposed){failedAction='check';error=e.message;}}finally{if(!disposed)checking=false;}}
 onMount(()=>{void checkConnection();});
 onDestroy(()=>{disposed=true;token='';stop();popup?.close();});
 async function connect(){
  if(working)return;error='';failedAction='connect';popup=window.open('about:blank','deck-studio-google-authorization','width=560,height=720');
  if(!popup){error='Allow the Google sign-in window, then connect again.';return;}
  connecting=true;
  try{const deck=await readDocument();if(disposed)return;if(!deck.googleSource)throw new Error('Import the original Google Slides presentation again to connect.');
   const r=await fetch('/api/google/oauth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({presentationId:deck.googleSource.presentationId})}),s=await r.json();if(!r.ok)throw new Error(s.error);if(disposed)return;popup.location.href=s.url;
   const deadline=Date.now()+600000;let pending=false;
   timer=setInterval(async()=>{if(pending)return;pending=true;try{if(await status()){stop();popup?.close();onconnection?.(true);}else if(popup?.closed||Date.now()>deadline){stop();error='Google was not connected. Connect again to export.';}}catch(e:any){stop();error=e.message;}finally{pending=false;}},1000);
  }catch(e:any){popup?.close();stop();if(!disposed)error=e.message;}
 }
 async function disconnect(){
  if(working)return;disconnecting=true;error='';failedAction='disconnect';
  try{const r=await fetch('/api/google/oauth/disconnect',{method:'POST'});if(!r.ok)throw new Error('Google could not disconnect. Try again.');if(!disposed){connected=false;token='';onconnection?.(false);}}
  catch(e:any){if(!disposed)error=e.message;}finally{if(!disposed)disconnecting=false;}
 }
 async function exporting(){
  if(working||(!connected&&!token.trim()))return;busy=true;error='';failedAction='export';
  try{const deck=await readDocument();if(disposed)return;if(!deck.googleSource)throw new Error('Import the original Google Slides presentation again to export a copy.');
   const response=await fetch('/api/export/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:deck.googleSource,state:await keynoteState(deck),title:deck.title,...(connected?{authorization:'google-oauth'}:{token})})});
   const result=await response.json();if(!response.ok)throw new Error(result.error);if(!disposed){url=result.url;token='';oncomplete?.({url:result.url});}
  }catch(e:any){if(!disposed){error=e.message;void status().catch(()=>{});}}finally{if(!disposed)busy=false;}
 }
 function retry(){if(working)return;if(failedAction==='check')void checkConnection();else if(failedAction==='connect')void connect();else if(failedAction==='disconnect')void disconnect();else void exporting();}
</script>
<Dialog title="Export to Google Slides" {onclose}>
 {#if url}<p>Your copy is ready.</p><a class="text-btn primary" href={url} target="_blank" rel="noopener noreferrer">Open exported copy</a>
 {:else}<p class="dialog-intro">Export a copy with text and slide visibility changes.</p>
 <p class="hint">For layout or style changes, export PowerPoint instead.</p>
 {#if checking}<Notice tone="progress" message="Checking Google connection…"/>
 {:else if connected}<p role="status">Google is connected for this session.</p><Button variant="quiet" busy={disconnecting} onclick={disconnect} disabled={working}>Disconnect Google</Button><Button variant="quiet" busy={connecting} onclick={connect} disabled={working}>Choose source in Google</Button>
 {:else}<p class="hint">Choose the original presentation when connecting. Only selected files are accessible.</p>{#if !configured && !error}<p class="hint">Google sign-in is unavailable. Use an access token below.</p>{/if}{/if}
 {#if !connected}<details class="settings-disclosure"><summary>Use an access token</summary><div class="settings-disclosure-body"><label class="field-label">OAuth access token<input type="password" aria-label="OAuth access token for Google export" bind:value={token} autocomplete="off" disabled={working}/></label><p class="hint">Needs presentation and Drive copy access. Used for this export only.</p></div></details>{/if}
 {#if busy||connecting||disconnecting}<Notice tone="progress" indicator={false} message={busy?'Creating an editable copy…':connecting?'Complete Google sign-in in the opened window.':'Disconnecting Google…'}/>{/if}{/if}
 {#if error}<Notice tone="error" title={failedAction==='export'?'Copy could not be exported':failedAction==='check'?'Connection status unavailable':'Google connection could not update'} message={error}>
  {#snippet actions()}<Button variant="secondary" disabled={working} onclick={retry}>Try again</Button>{/snippet}
 </Notice>{/if}
 {#snippet footer()}<DialogFooter>{#snippet actions()}<Button variant="secondary" onclick={onclose}>{url?'Done':'Cancel'}</Button>{#if !url}{#if connected||token.trim()}<Button variant="primary" busy={busy} disabled={working} onclick={exporting}>Export copy</Button>{:else}<Button variant="primary" busy={connecting} disabled={working||!configured} onclick={connect}>Connect Google</Button>{/if}{/if}{/snippet}</DialogFooter>{/snippet}
</Dialog>
