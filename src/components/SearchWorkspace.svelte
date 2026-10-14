<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Button, SearchField, SegmentedControl } from './ui';
  import SearchResults from './ui/SearchResults.svelte';
  import { findSearchActions, type SearchAction, type SearchScope } from '../search-actions';
  let {actions, initialQuery = '', initialScope = 'all', onselect}: {actions: SearchAction[]; initialQuery?: string; initialScope?: SearchScope; onselect: (action: SearchAction) => void} = $props();
  let query = $state(untrack(() => initialQuery)), scope = $state<SearchScope>(untrack(() => initialScope)), limit = $state(60);
  const results = $derived(findSearchActions(actions, query, scope));
  let input = $state<HTMLDivElement>(), root = $state<HTMLDivElement>();
  onMount(() => { if (innerWidth > 760) input?.querySelector('input')?.focus({preventScroll: true}); });
  $effect(() => { query; scope; limit = 60; root?.querySelector('.ui-command-results')?.scrollTo(0, 0); });
  function run(action: SearchAction) { if (!action.disabled) onselect(action); }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.metaKey || event.ctrlKey) return;
    const search = input?.querySelector('input'), buttons = Array.from(root?.querySelectorAll<HTMLButtonElement>('.ui-command-results button:not(:disabled)') ?? []), index = buttons.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'Enter' && event.target === search) { const first = results.find(action => !action.disabled); if (first) { event.preventDefault(); run(first); } return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (event.target !== search && index < 0 || event.target === search && ['Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.target === search) buttons[event.key === 'ArrowDown' ? 0 : buttons.length - 1]?.focus();
    else if (event.key === 'Home' || event.key === 'End') buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus();
    else if (event.key === 'ArrowUp' && index === 0 || event.key === 'ArrowDown' && index === buttons.length - 1) search?.focus();
    else buttons[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="search-workspace" bind:this={root} onkeydown={key}>
  <div bind:this={input}><SearchField label="Search slides, objects, and commands" bind:value={query} data-dialog-autofocus={typeof window !== 'undefined' && window.innerWidth > 760 ? true : undefined} placeholder="Search this document or commands…" /></div>
  <SegmentedControl class="search-scopes" label="Search scope" options={[{value:'all',label:'All'},{value:'slide',label:'Slides'},{value:'object',label:'Objects'},{value:'command',label:'Commands'}]} value={scope} onchange={value => scope = value as SearchScope} />
  <div class="search-workspace-status"><span role="status">{results.length} {results.length === 1 ? 'result' : 'results'}</span><span>Current document and commands</span></div>
  <SearchResults results={results.slice(0, limit)} onselect={run} compact={false} empty={query.trim() ? 'No matching results' : scope === 'object' ? 'No objects to search' : scope === 'slide' ? 'No slides to search' : 'No results in this scope'} description={query.trim() ? 'Try another search or browse all slides, objects, and commands.' : 'Choose All to browse the available document content and commands.'} resetLabel={query.trim() ? 'Clear search' : 'Search all'} onreset={()=>{query='';scope='all';input?.querySelector('input')?.focus();}} />
  {#if results.length > limit}<Button variant="quiet" onclick={() => limit += 60}>Show more results</Button>{/if}
</div>
