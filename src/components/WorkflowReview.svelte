<script lang="ts">
 import {Button} from './ui';
 import Notice from './ui/Notice.svelte';
 import {workflowLabel,type WorkflowRequest} from '../core/workflows';
 let {request,onrun,ondismiss}:{request:WorkflowRequest;onrun:()=>void;ondismiss:()=>void}=$props();
 const finished=$derived(['completed','dismissed'].includes(request.status));
 const running=$derived(request.status==='running');
</script>
<section class="workflow-review" aria-label="AI action details">
 <div class="workflow-body">
 <h3>{workflowLabel(request.action)}</h3>
 {#if request.action.kind==='import'&&request.action.url}<p class="workflow-source">{request.action.url}</p>{/if}
 {#if request.action.kind==='publish'&&request.action.target==='web'&&request.status!=='completed'}<p class="hint">Preview the website before publishing.</p>{/if}
 {#if request.result}<Notice tone={request.status==='failed'?'error':request.status==='completed'?'success':'info'} message={request.result.message}/>{/if}
 {#if request.result?.url}<a href={request.result.url} target="_blank" rel="noopener noreferrer">Open result</a>{/if}
 </div>
 <div class="workflow-actions">{#if !finished}<Button variant="primary" busy={running} onclick={onrun}>{request.status==='failed'?'Retry':request.status==='waiting_for_user'?'Continue':'Run action'}</Button>{/if}<Button disabled={running} onclick={ondismiss}>{finished?'Done':'Dismiss'}</Button>
 {#if running||request.status==='waiting_for_user'}<p class="hint" role="status">{running?'Working…':'Continue in the opened window'}</p>{/if}
 </div>
</section>
<style>
 .workflow-review{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}
 .workflow-body{display:flex;flex:1;min-height:0;flex-direction:column;gap:12px;padding:12px 16px;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;}
 .workflow-review h3{font-size:var(--ui-text);margin:0;overflow-wrap:anywhere}
 .workflow-source{overflow-wrap:anywhere;font-size:var(--ui-label)}
 .workflow-actions{display:flex;flex:none;flex-direction:column;gap:8px;padding:12px 16px;border-top:1px solid var(--border-subtle);background:var(--surface-chrome)}
 .workflow-review a{color:var(--text-primary);text-decoration:underline;overflow-wrap:anywhere}
 @media(max-width:760px),(pointer:coarse){.workflow-actions :global(button){min-height:44px}}
</style>
