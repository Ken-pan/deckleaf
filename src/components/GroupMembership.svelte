<script lang="ts">
  import {editor} from '../core/editor.svelte';
  import {groupExitOptions} from '../core/group-exit';
  import {moveOutOfGroup} from '../group-exit-actions';
  import {ExitGroupIcon} from './icons/workspace-icons';
  import {Button} from './ui';
  let {standalone=false}:{standalone?:boolean}=$props();
  let options=$derived(editor.slide?groupExitOptions(editor.slide,editor.selected,editor.selectionScope):undefined);
  let name=$derived(options?.parent?editor.slide?.autoLayouts?.find(l=>l.id===options!.parent)?.name??editor.slide?.groups?.find(g=>g.id===options!.parent)?.name??'Group':'Multiple groups');
  let flow=$derived(Boolean(options?.destination&&editor.slide?.autoLayouts?.some(l=>l.id===options!.destination)));
</script>
{#if options?.available}
  <div class="group-membership" class:standalone aria-label="Group membership">
    <p class="hint membership-parent">In <span title={name}>{name}</span></p>
    <Button variant="quiet" size="sm" disabled={Boolean(options.parent?options.out.reason:options.slide.reason)} onclick={()=>moveOutOfGroup(!options!.parent)}><ExitGroupIcon size={16}/>{options.parent?'Move out of group':'Move to slide'}</Button>
    <p class="hint">{options.parent?options.out.reason??(flow?'Move up one level and follow the parent layout.':options.destination?'Move up one level; keep the current position.':'Keep the current position on the slide.'):options.slide.reason??'Keep the current position on the slide.'}</p>
  </div>
{/if}
<style>
  .group-membership{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
  .group-membership .hint{margin:0}.membership-parent{display:flex;gap:4px;max-width:100%}.membership-parent span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .group-membership :global(button){max-width:100%}
  .standalone{padding:12px 16px;border-bottom:1px solid var(--border-subtle)}
  @media(max-width:760px),(pointer:coarse){.group-membership :global(button){min-height:44px}}
</style>
