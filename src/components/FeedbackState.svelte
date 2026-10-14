<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CircleAlert } from '@lucide/svelte';
  import EmptyState from './ui/EmptyState.svelte';
  let { state, title, description = '', density = 'roomy', children }: {
    state: 'loading' | 'error';
    title: string;
    description?: string;
    density?: 'roomy' | 'compact' | 'inline';
    children?: Snippet;
  } = $props();
</script>

<EmptyState {title} {description} {density} busy={state === 'loading'} icon={state === 'error' ? CircleAlert : undefined} tone={state === 'error' ? 'error' : 'neutral'} role={state === 'error' ? 'alert' : 'status'} {children} />
