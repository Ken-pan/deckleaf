<script lang="ts">
  import { Info } from '@lucide/svelte';
  import { editor } from '../core/editor.svelte';
  import { Button, EmptyState } from './ui';
  import Notice from './ui/Notice.svelte';
</script>
<p class="dialog-intro">Up to 20 recent notifications from this session.</p>
<div class="notification-history">
  {#each editor.noticeHistory as entry (entry.id)}
    <div><Notice tone={entry.tone} message={entry.message} live={false}/><time datetime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</time></div>
  {:else}<EmptyState icon={Info} title="No recent notifications" description="Notifications appear here as you work."/>{/each}
</div>
{#if editor.noticeHistory.length}<Button variant="quiet" onclick={()=>{editor.noticeHistory=[];}}>Clear notifications</Button>{/if}
