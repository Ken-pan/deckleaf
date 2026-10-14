<script lang="ts">
  import { onMount, tick, type Component, type Snippet } from 'svelte';
  import { Check, ChevronDown } from '@lucide/svelte';
  import Button from './Button.svelte';
  import { positionFloating } from '../../ui-viewport';
  import {popoverFocus} from '../../ui-focus';
  type Item = {label: string; icon?: Component<any>; shortcut?: string; checked?: boolean; disabled?: boolean; divider?: boolean; tone?: 'danger'; onselect: (event?: MouseEvent) => void};
  let {label, items, disabled = false, active = false, iconOnly = false, children, class: className = ''}: {label: string; items: Item[]; disabled?: boolean; active?: boolean; iconOnly?: boolean; children?: Snippet; class?: string} = $props();
  const id = $props.id();
  let menu = $state<HTMLDivElement>();
  let trigger = $state<HTMLDivElement>();
  let open = $state(false);
  let fromEnd = false;
  let search = '', searchedAt = 0, positionFrame = 0;
  export function toggle() { if (!disabled) menu?.togglePopover(); }
  const buttons = () => Array.from(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  function position() {
    if (!menu || !trigger || !open) return;
    positionFloating(menu, trigger.getBoundingClientRect(), {preferredHeight: menu.scrollHeight});
  }
  function beforeToggle(event: ToggleEvent) {
    open = event.newState === 'open';
    if (!menu) return;
    menu.inert = !open;
    search = '';
    if (open) {
      // Measure before the first visible frame, including a fast outro reversal.
      const display = menu.style.display;
      menu.style.display = 'flex'; position(); menu.style.display = display;
    } else fromEnd = false;
  }
  function schedulePosition(event?: Event) {
    if (!open || event?.target instanceof Node && menu?.contains(event.target)) return;
    cancelAnimationFrame(positionFrame); positionFrame = requestAnimationFrame(position);
  }
  async function toggled(event: ToggleEvent) {
    open = event.newState === 'open';
    if (open) { await tick(); if (!menu?.matches(':popover-open')) return; position(); const controls = buttons(); (controls[fromEnd ? controls.length - 1 : 0] ?? menu).focus({preventScroll: true}); fromEnd = false; }
  }
  function select(item: Item, event: MouseEvent) { menu?.hidePopover(); trigger?.querySelector('button')?.focus({preventScroll: true}); item.onselect(event); }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); menu?.hidePopover(); trigger?.querySelector('button')?.focus(); return; }
    if (event.key === 'Tab') { menu?.hidePopover(); trigger?.querySelector('button')?.focus(); return; }
    const controls = buttons(), index = controls.indexOf(event.target as HTMLButtonElement);
    if (event.key.length === 1 && event.key !== ' ') {
      const now = performance.now(); search = now - searchedAt < 700 ? search + event.key : event.key; searchedAt = now;
      const prefix = [...search].every(letter => letter === search[0]) ? search[0] : search;
      const ordered = [...controls.slice(index + 1), ...controls.slice(0, index + 1)];
      const next = ordered.find(button => button.querySelector('span')?.textContent?.trim().toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
      if (next) { event.preventDefault(); event.stopPropagation(); next.focus(); }
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    controls[event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length]?.focus();
  }
  onMount(() => {
    const observer = new ResizeObserver(() => schedulePosition());
    if (trigger) observer.observe(trigger); if (menu) observer.observe(menu);
    window.addEventListener('resize', schedulePosition); window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition); window.visualViewport?.addEventListener('scroll', schedulePosition);
    return () => { observer.disconnect(); cancelAnimationFrame(positionFrame); window.removeEventListener('resize', schedulePosition); window.removeEventListener('scroll', schedulePosition, true); window.visualViewport?.removeEventListener('resize', schedulePosition); window.visualViewport?.removeEventListener('scroll', schedulePosition); };
  });
</script>

<div class="ui-action-menu-trigger {className}" class:icon-only={iconOnly} bind:this={trigger}>
  <Button {disabled} kind={iconOnly ? 'icon' : 'text'} class={active ? 'active' : ''} aria-label={label} title={label} aria-haspopup="menu" aria-controls={id} aria-expanded={open} popovertarget={id} onkeydown={event => { if (!event.isComposing && event.keyCode !== 229 && !event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); fromEnd = event.key === 'ArrowUp'; menu?.showPopover(); } }}>
    {@render children?.()}{#if !iconOnly}<ChevronDown size={13} aria-hidden="true" />{/if}
  </Button>
</div>
<div id={id} bind:this={menu} use:popoverFocus={{close:()=>menu?.hidePopover(),origin:()=>trigger?.querySelector('button')}} popover="auto" class="ui-action-menu" role="menu" tabindex="-1" aria-label={label} inert={!open} onbeforetoggle={beforeToggle} ontoggle={toggled} onkeydown={key}>
  {#each items as item}
    {#if item.divider}<div class="ui-menu-divider" role="separator"></div>{/if}
    <button type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} tabindex="-1" data-tone={item.tone} disabled={item.disabled} onclick={event => select(item,event)}>
      {#if item.icon}<item.icon size={16} aria-hidden="true" />{/if}<span>{item.label}</span>{#if item.checked}<Check size={14} aria-hidden="true" />{/if}{#if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
    </button>
  {/each}
</div>
