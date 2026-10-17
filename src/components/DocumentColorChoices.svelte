<script lang="ts">
  import {editor} from '../core/editor.svelte';
  import {deckDesignSystem,COLOR_LABELS} from '../core/deck-design-system';
  import {COLOR_ROLES,type ColorRole} from '../core/design-system-schema';
  import {swatchInk} from '../selection-color';
  import {Check} from '@lucide/svelte';
  let {value,disabled=false,onchoose}:{value?:ColorRole|'mixed';disabled?:boolean;onchoose:(role:ColorRole)=>void}=$props();
  const system=$derived(deckDesignSystem(editor.deck??{}));
</script>
<div class="document-color-choices" role="group" aria-label="Document colors">
  {#each COLOR_ROLES as role}<button type="button" aria-label={`Document color: ${COLOR_LABELS[role]}`} aria-pressed={value===role} disabled={disabled} title={`${COLOR_LABELS[role]} · ${system.colors[role]}`} onclick={()=>onchoose(role)}><i style:background={system.colors[role]} style:color={swatchInk(system.colors[role])} aria-hidden="true">{#if value===role}<Check size={12}/>{/if}</i><span>{COLOR_LABELS[role]}</span></button>{/each}
</div>
<style>
  .document-color-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.document-color-choices button{display:flex;align-items:center;justify-content:flex-start;gap:8px;min-width:0;padding:8px;text-align:left;border-radius:var(--r-control)}.document-color-choices i{flex:none;width:24px;height:24px;display:grid;place-items:center;border:1px solid var(--border-default);border-radius:var(--r-small)}.document-color-choices span{min-width:0;overflow-wrap:anywhere}.document-color-choices button[aria-pressed='true']{background:var(--state-selected);color:var(--text-link)}
</style>
