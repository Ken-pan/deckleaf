import { mount, unmount, tick, type ComponentProps } from 'svelte';
import EditorContextMenu from './EditorContextMenu.svelte';
import type { ContextRequest } from './context-menu';

let root: HTMLElement | undefined;
let menu: {openAt:(request:ContextRequest)=>void} | undefined;
export function ready() { return Boolean(menu); }
export async function openContext(request: ContextRequest, host: ComponentProps<typeof EditorContextMenu>['host']) {
  if (!menu) {
    root = document.createElement('div'); root.dataset.contextMenuRoot = ''; document.body.append(root);
    menu = mount(EditorContextMenu, {target:root, props:{host}}) as {openAt:(request:ContextRequest)=>void};
    await tick();
  }
  menu?.openAt(request);
}
export async function dispose() { if (menu) await unmount(menu); menu=undefined; root?.remove(); root=undefined; }
