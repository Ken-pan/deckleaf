<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, description = '', icon: Icon, density = 'roomy', busy = false, tone = 'neutral', role = 'status', class: className = '', children }: {
    title: string;
    description?: string;
    icon?: typeof import('@lucide/svelte').Search;
    density?: 'roomy' | 'compact' | 'inline';
    busy?: boolean;
    tone?: 'neutral' | 'error';
    role?: 'status' | 'alert';
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="ui-empty-state {className}" data-density={density} data-tone={tone}>
  {#if Icon || busy}<span class="ui-empty-icon" aria-hidden="true">{#if busy}<span class="spinner"></span>{:else if Icon}<Icon size={density === 'inline' ? 20 : 24} strokeWidth={1.5} />{/if}</span>{/if}
  <div class="ui-empty-copy" {role}>
    <h3>{title}</h3>
    {#if description}<p>{description}</p>{/if}
  </div>
  {#if children}<div class="ui-empty-actions">{@render children()}</div>{/if}
</div>
