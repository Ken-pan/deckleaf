import {PanelTop} from '@lucide/svelte';
import {ExitGroupIcon} from './components/icons/workspace-icons';
import {editor} from './core/editor.svelte';
import {groupExitOptions} from './core/group-exit';
import {focusCanvasSelection} from './editor-focus';

export async function moveOutOfGroup(toSlide=false) {
  if(await editor.moveOutOfGroup(toSlide))await focusCanvasSelection();
}
export function groupExitActions() {
  if(!editor.slide)return [];
  const options=groupExitOptions(editor.slide,editor.selected,editor.selectionScope);
  if(!options.available)return [];
  return [
    {label:'Move out of group',icon:ExitGroupIcon,disabled:Boolean(options.out.reason),onselect:()=>moveOutOfGroup()},
    ...(options.showSlide?[{label:'Move to slide',icon:PanelTop,disabled:Boolean(options.slide.reason),onselect:()=>moveOutOfGroup(true)}]:[]),
  ];
}
