<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import { ChevronDown, X } from '@lucide/svelte';
  import Button from './Button.svelte';
  import { positionFloating, visualBounds } from '../../ui-viewport';
  import { availableFocus, restoreFocus, popoverFocus } from '../../ui-focus';
  const generatedId = $props.id();
  let {title, children, headerActions, trigger, anchor, avoid, returnFocus, id = generatedId, open = $bindable(false), width = 420, height = 580, minHeight = 160, autoHeight = false, mobileSheet = false, iconOnly = false, disabled = false, onopen, onkeydown, class: className = ''}: {
    title: string; children: Snippet; headerActions?: Snippet; trigger?: Snippet; anchor?: HTMLElement; avoid?: () => HTMLElement | null | undefined; returnFocus?: () => HTMLElement | undefined; id?: string;
    open?: boolean; width?: number; height?: number; minHeight?: number; autoHeight?: boolean; mobileSheet?: boolean; iconOnly?: boolean; disabled?: boolean; onopen?: () => void; onkeydown?: (event: KeyboardEvent) => void; class?: string;
  } = $props();
  let panel = $state<HTMLDivElement>(), origin = $state<HTMLDivElement>(), heading = $state<HTMLHeadingElement>();
  let frame = 0;
  let invoker: HTMLElement | null = null;
  const source = () => anchor ?? origin ?? document.querySelector<HTMLElement>('.canvas-insert-dock') ?? document.querySelector<HTMLElement>('.canvas-meta');
  export function show() { if (!disabled) panel?.showPopover(); }
  export function close() { panel?.hidePopover(); }
  export function toggle() { if (!disabled) panel?.togglePopover(); }
  function position() {
    if (!panel || !open) return;
    const bounds = source()?.getBoundingClientRect(); if (!bounds) return;
    const sheet = mobileSheet && visualBounds().width <= 600;
    panel.style.height = sheet ? `${height}px` : autoHeight ? 'auto' : `${height}px`;
    const body = panel.querySelector<HTMLElement>('.ui-popover-body'), head = panel.querySelector<HTMLElement>('.ui-popover-head');
    const preferredHeight = autoHeight ? Math.min(height, (head?.offsetHeight ?? 0) + (body?.scrollHeight ?? 0) + 2) : height;
    const toolbar = document.querySelector<HTMLElement>('.topbar');
    const topBoundary = toolbar && !toolbar.inert && toolbar.getClientRects().length ? toolbar.getBoundingClientRect().bottom + 8 : undefined;
    const dock = document.querySelector<HTMLElement>('.canvas-insert-dock'), dockBounds = dock?.getBoundingClientRect();
    const bottomBoundary = dock && dock.getClientRects().length && dockBounds && dockBounds.top > (topBoundary ?? 0) + minHeight + 8 ? dockBounds.top - 8 : undefined;
    positionFloating(panel, bounds, {maxHeight: height, preferredHeight, minHeight, topBoundary, bottomBoundary: sheet ? undefined : bottomBoundary, avoid: sheet ? undefined : avoid?.()?.getBoundingClientRect(), overlay: sheet});
  }
  function schedulePosition(event?: Event) {
    if (!open || event?.target instanceof Node && panel?.contains(event.target)) return;
    cancelAnimationFrame(frame); frame = requestAnimationFrame(position);
  }
  function beforeToggle(event: ToggleEvent) {
    open = event.newState === 'open';
    if (!panel) return;
    panel.inert = !open;
    if (open) { invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null; onopen?.(); const display = panel.style.display; panel.style.display = 'flex'; position(); panel.style.display = display; }
  }
  async function toggled(event: ToggleEvent) {
    if (event.newState !== 'open') {
      if (!returnFocus) return;
      await tick();
      if (!open && (document.activeElement === document.body || document.activeElement === document.querySelector('.canvas-stage') || panel?.contains(document.activeElement))) restoreFocus(returnFocus());
      return;
    }
    await tick(); if (!panel?.matches(':popover-open')) return;
    position();
    (innerWidth > 760 ? panel.querySelector<HTMLElement>('[data-dialog-autofocus],[data-popover-autofocus]') ?? heading : heading)?.focus({preventScroll: true});
  }
  function dismiss() {
    close();
    const node = source(), fallback = node?.matches('button') ? node : node?.querySelector<HTMLElement>('button');
    restoreFocus(availableFocus(invoker) ? invoker : fallback);
  }
  function key(event: KeyboardEvent) {
    if (!panel?.matches(':popover-open')) return;
    onkeydown?.(event);
    if (event.defaultPrevented || event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
    // Let a nested native picker dismiss before closing its containing panel.
    if (panel?.querySelector(':popover-open')) return;
    event.preventDefault(); event.stopPropagation(); dismiss();
  }
  onMount(() => {
    const observer = new ResizeObserver(() => schedulePosition());
    if (panel) observer.observe(panel); const node = source(); if (node) observer.observe(node);
    window.addEventListener('resize', schedulePosition); window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition); window.visualViewport?.addEventListener('scroll', schedulePosition);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedulePosition); window.removeEventListener('scroll', schedulePosition, true); window.visualViewport?.removeEventListener('resize', schedulePosition); window.visualViewport?.removeEventListener('scroll', schedulePosition); };
  });
</script>

{#if trigger}<div class="ui-panel-trigger" bind:this={origin}>
  <Button {disabled} kind={iconOnly ? 'icon' : 'text'} aria-label={title} title={title} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} popovertarget={id} onkeydown={event => { if (!event.isComposing && event.keyCode !== 229 && !event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowDown') { event.preventDefault(); show(); } }}>
    {@render trigger()}{#if !iconOnly}<ChevronDown size={13} aria-hidden="true" />{/if}
  </Button>
</div>{/if}
<div {id} bind:this={panel} use:popoverFocus={{close, origin:()=>returnFocus?.()??invoker}} popover="auto" class="ui-popover-panel {className}" role="dialog" tabindex="-1" aria-labelledby="{id}-title" style:--popover-width={`${width}px`} style:--popover-height={autoHeight ? 'auto' : `${height}px`} inert={!open} onbeforetoggle={beforeToggle} ontoggle={toggled} onkeydown={key}>
  <div class="ui-popover-head"><h2 id="{id}-title" bind:this={heading} tabindex="-1">{title}</h2><div class="ui-popover-head-actions">{#if headerActions}{@render headerActions()}{/if}<Button kind="icon" size="sm" aria-label="Close {title}" onclick={dismiss}><X size={16} /></Button></div></div>
  <div class="ui-popover-body">{#if open}{@render children()}{/if}</div>
</div>
