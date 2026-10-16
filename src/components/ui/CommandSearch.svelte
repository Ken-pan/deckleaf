<script lang="ts">
  import {countLabel} from '../../core/ui-copy';
  import { Search, ArrowRight } from '@lucide/svelte';
  import Button from './Button.svelte';
  import PopoverPanel from './PopoverPanel.svelte';
  import SearchField from './SearchField.svelte';
  import SearchResults from './SearchResults.svelte';
  import { findSearchActions, QUICK_SEARCH_LIMIT, type SearchAction } from '../../search-actions';

  let {actions, onexpand, class: className = ''}: {actions: SearchAction[]; onexpand: (query: string) => void; class?: string} = $props();
  const id = $props.id();
  let trigger = $state<HTMLDivElement>(), content = $state<HTMLDivElement>();
  let panel = $state<{toggle: () => void; show: () => void; close: () => void}>();
  let open = $state(false), query = $state('');
  let matches = $derived(findSearchActions(actions, query, 'all', true));
  let results = $derived(matches.slice(0, QUICK_SEARCH_LIMIT));
  const buttons = () => Array.from(content?.querySelectorAll<HTMLButtonElement>('.ui-command-results button:not(:disabled)') ?? []);
  export function toggle() { panel?.toggle(); }
  export function close() { panel?.close(); }
  export function focus() { trigger?.querySelector('button')?.focus({preventScroll: true}); }
  function dismiss() { close(); focus(); }
  function expand() { const currentQuery = query; dismiss(); onexpand(currentQuery); }
  function select(action: SearchAction) {
    if (action.disabled) return;
    dismiss(); action.run();
  }
  function key(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
    const input = content?.querySelector('input'), controls = buttons(), index = controls.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'Enter' && event.target === input) {
      event.preventDefault(); const first = results.find(command => !command.disabled); if (first) select(first); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (event.target !== input && index < 0 || event.target === input && ['Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.target === input) controls[event.key === 'ArrowDown' ? 0 : controls.length - 1]?.focus();
    else if (event.key === 'Home' || event.key === 'End') controls[event.key === 'Home' ? 0 : controls.length - 1]?.focus();
    else if ((event.key === 'ArrowUp' && index === 0) || (event.key === 'ArrowDown' && index === controls.length - 1)) input?.focus();
    else controls[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  }
</script>

<div class="ui-command-trigger {className}" bind:this={trigger}>
  <Button kind="icon" aria-label="Search" title="Search · ⌘K" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} popovertarget={id} onkeydown={event => { if (!event.isComposing && event.keyCode !== 229 && !event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowDown') { event.preventDefault(); panel?.show(); } }}><Search size={16} aria-hidden="true" /></Button>
</div>
<PopoverPanel bind:this={panel} bind:open anchor={trigger} {id} title="Search" class="ui-command-popover" width={340} height={580} autoHeight onopen={() => query = ''} onkeydown={key}>
  <div class="ui-command-body" bind:this={content}>
    <SearchField label="Search slides, objects, and commands" bind:value={query} placeholder="Slides, objects, commands…" data-popover-autofocus />
    <SearchResults {results} onselect={select} onreset={()=>{query='';content?.querySelector('input')?.focus();}} />
    {#if query.trim() && results.length}<p class="ui-command-hint" role="status">{results.length} of {countLabel(matches.length, 'result')}<kbd>Esc</kbd></p>{/if}
    <div class="ui-command-more ui-popover-more"><Button variant="quiet" onclick={expand}>Expand search<ArrowRight size={14} /></Button></div>
  </div>
</PopoverPanel>
