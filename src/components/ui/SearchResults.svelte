<script lang="ts">
  import { ArrowRight, MousePointer2, RectangleHorizontal, Command, Search } from '@lucide/svelte';
  import EmptyState from './EmptyState.svelte';
  import Button from './Button.svelte';
  import type { SearchAction } from '../../search-actions';
  let {results, onselect, empty = 'No matching results', description = 'Try another search or clear it to browse.', onreset, resetLabel = 'Clear search', compact = true}: {results: SearchAction[]; onselect: (action: SearchAction) => void; empty?: string; description?: string; onreset?: () => void; resetLabel?: string; compact?: boolean} = $props();
</script>

<div class="ui-command-results">
  {#each results as action (action.id)}
    {@const Icon = action.kind === 'slide' ? RectangleHorizontal : action.kind === 'object' ? MousePointer2 : Command}
    <button type="button" disabled={action.disabled} data-search-kind={action.kind} onclick={() => onselect(action)}>
      <Icon size={15} aria-hidden="true" /><span class="search-result-copy"><span>{action.label}</span>{#if action.detail}<small>{action.detail}</small>{/if}</span>
      {#if action.key}<kbd>{action.key}</kbd>{:else if action.kind !== 'command'}<ArrowRight size={14} aria-hidden="true" />{/if}
    </button>
  {:else}<EmptyState icon={compact ? undefined : Search} title={empty} {description} density={compact ? "compact" : "roomy"}>{#if onreset}<Button variant="secondary" onclick={onreset}>{resetLabel}</Button>{/if}</EmptyState>{/each}
</div>
