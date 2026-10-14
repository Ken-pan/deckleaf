<script lang="ts">
  import {countLabel} from '../../core/ui-copy';
  import { Search } from '@lucide/svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props = Omit<HTMLInputAttributes, 'value'> & {label: string; value?: string; count?: number};
  let {label, value = $bindable(''), count, class: className = '', ...attributes}: Props = $props();
</script>

<div class="ui-search-field {className}">
  <Search size={16} aria-hidden="true" />
  <input {...attributes} type="search" aria-label={label} bind:value autocomplete={attributes.autocomplete ?? 'off'} />
  {#if count !== undefined}<span class="ui-search-count" aria-label={countLabel(count, 'result')}>{count}</span>{/if}
</div>
