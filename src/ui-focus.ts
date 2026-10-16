export const activeModal = () => Array.from(document.querySelectorAll<HTMLElement>('dialog:modal')).filter(node=>node.dataset.uiLeaving !== 'true').at(-1);
const focusSelector = 'a[href],button,input,select,textarea,summary,iframe,[tabindex],[contenteditable="true"]';
export type FocusElement=HTMLElement|SVGElement;
function hiddenByDisclosure(node:Element){
  for(let closed=node.closest('details:not([open])');closed;closed=closed.parentElement?.closest('details:not([open])')??null){
    if(!closed.querySelector(':scope > summary')?.contains(node))return true;
  }
  return false;
}
export function availableFocus(node?: Element | null): node is FocusElement {
  return (node instanceof HTMLElement||node instanceof SVGElement&&node.hasAttribute('tabindex')) && node !== document.body && node.isConnected && !node.matches(':disabled') && !node.closest('[inert],[hidden],dialog:not([open])') && !hiddenByDisclosure(node) && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
}
export function tabStops(scope: ParentNode): FocusElement[] {
  return Array.from(scope.querySelectorAll<FocusElement>(focusSelector)).filter(node => node.tabIndex >= 0 && availableFocus(node));
}
export function restoreFocus(...choices: Array<FocusElement | null | undefined>) {
  const currentModal = activeModal();
  const target = choices.find(node => availableFocus(node) && (!currentModal || currentModal.contains(node))) ?? (currentModal ? tabStops(currentModal)[0] : [document.querySelector<HTMLElement>('.canvas-stage'), document.querySelector<HTMLElement>('.property-panel')].find(availableFocus));
  if (availableFocus(target)) target.focus({preventScroll:true});
}
const plainTab = (event: KeyboardEvent) => event.key === 'Tab' && !event.defaultPrevented && !event.isComposing && event.keyCode !== 229 && !event.altKey && !event.ctrlKey && !event.metaKey;

type PopupFocus = {close: () => void | boolean; origin?: () => FocusElement | null | undefined;focus?:(target:FocusElement)=>void};
// Nonmodal popovers let Tab continue the invoking control's sequence. Closing
// after focus leaves never pulls focus back from the next field or panel.
export function popoverFocus(node: HTMLElement, options: PopupFocus) {
  let tabbing = false;
  const origin = () => options.origin?.() ?? (node.id ? document.querySelector<HTMLElement>(`[aria-controls~="${CSS.escape(node.id)}"]`) : null);
  const key = (event: KeyboardEvent) => {
    if (!plainTab(event) || !node.matches(':popover-open')) return;
    tabbing = true;
    const controls = tabStops(node), active = document.activeElement, index = controls.indexOf(active as HTMLElement);
    if (!(event.shiftKey ? index <= 0 : index === controls.length - 1)) {
      // A native popover inside a modal has a separate browser focus scope.
      // Follow its visible controls explicitly so Tab cannot fall onto body.
      event.preventDefault();controls[index + (event.shiftKey ? -1 : 1)]?.focus();return;
    }
    const invoker = origin(), modal = node.closest<HTMLDialogElement>('dialog[open]');
    const outside = tabStops(modal ?? document).filter(control => !node.contains(control));
    const at = outside.indexOf(invoker as HTMLElement), next = at + (event.shiftKey ? -1 : 1);
    if(options.close()===false){event.preventDefault();tabbing=false;return;}
    if (at < 0) { event.preventDefault(); restoreFocus(invoker); }
    else if (modal || next >= 0 && next < outside.length) { event.preventDefault();const target=outside[(next + outside.length) % outside.length];if(target)(options.focus??(target=>target.focus({preventScroll:true})))(target); }
    else invoker?.focus({preventScroll: true});
  };
  const leave = () => queueMicrotask(() => {
    if (node.matches(':popover-open') && !node.contains(document.activeElement) && (document.activeElement !== document.body || tabbing) && options.close()===false) restoreFocus(node.querySelector<HTMLElement>('[aria-invalid="true"]'),node);
    tabbing = false;
  });
  const toggled = (event: ToggleEvent) => {
    if (event.newState !== 'closed' || tabbing || !node.contains(document.activeElement)) return;
    const previous = origin();
    queueMicrotask(() => { if (document.hasFocus() && (document.activeElement === document.body || node.contains(document.activeElement))) restoreFocus(previous); });
  };
  node.addEventListener('keydown', key); node.addEventListener('focusout', leave); node.addEventListener('beforetoggle', toggled);
  return {update(next: PopupFocus) { options = next; }, destroy() { node.removeEventListener('keydown', key); node.removeEventListener('focusout', leave); node.removeEventListener('beforetoggle', toggled); }};
}
