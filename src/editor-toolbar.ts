// One Tab stop per toolbar; native popovers and fields retain their own key handling.
export function editorToolbar(node: HTMLElement) {
  let current: HTMLButtonElement | undefined;
  let ownsFocus = false, previousIndex = 0;
  const controls = () => Array.from(node.querySelectorAll<HTMLButtonElement>('button')).filter(button =>
    !button.disabled && !button.closest('[popover],dialog,[inert]') && button.getClientRects().length > 0 && getComputedStyle(button).visibility !== 'hidden');
  function sync() {
    const buttons = controls(), composite = buttons.length >= 3;
    node.setAttribute('role', composite ? 'toolbar' : 'group');
    const active = document.activeElement;
    const repairFocus = ownsFocus && current && !buttons.includes(current) && (active === document.body || active === current);
    if (!current || !buttons.includes(current)) current = buttons[Math.min(previousIndex, buttons.length - 1)];
    previousIndex = Math.max(0, buttons.indexOf(current!));
    for (const button of node.querySelectorAll<HTMLButtonElement>('button')) {
      if (!button.closest('[popover],dialog')) button.tabIndex = !composite || button === current ? 0 : -1;
    }
    if (repairFocus) (current ?? node.closest<HTMLElement>('.canvas-stage'))?.focus({preventScroll: true});
  }
  function trackFocus(event: FocusEvent) { ownsFocus = event.target instanceof HTMLButtonElement && controls().includes(event.target); }
  function focus(event: FocusEvent) {
    if (event.target instanceof HTMLButtonElement && controls().includes(event.target)) { current = event.target; sync(); }
  }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    const buttons = controls(), index = buttons.indexOf(event.target as HTMLButtonElement);
    if (buttons.length < 3 || index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    current = buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    sync(); current.focus();
  }
  const observer = new MutationObserver(sync);
  observer.observe(node, {subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'class', 'style', 'inert']});
  node.addEventListener('focusin', focus); node.addEventListener('keydown', key);
  document.addEventListener('focusin', trackFocus);
  window.addEventListener('resize', sync);
  sync();
  return {destroy() { observer.disconnect(); node.removeEventListener('focusin', focus); node.removeEventListener('keydown', key); document.removeEventListener('focusin', trackFocus); window.removeEventListener('resize', sync); }};
}
