<script lang="ts">
  import { untrack } from 'svelte';
  import { Check, Sparkles } from '@lucide/svelte';
  import { Button } from './ui';
  import { TRANSITION_PRESETS, transitionPreset, type TransitionEffect, type TransitionCategory } from '../core/transitions';

  let {value, onchange}: {value: TransitionEffect; onchange: (effect: TransitionEffect) => void} = $props();
  type Category = Exclude<TransitionCategory, 'continuity'>;
  const categories: {id: Category; label: string}[] = [
    {id:'basic', label:'Essentials'},
    {id:'space', label:'Move'},
    {id:'cinema', label:'Camera'},
    {id:'mask', label:'Reveal'},
    {id:'depth', label:'3D'},
  ];
  const essentials: TransitionEffect[] = ['smart','fade','slide','push','zoom','none'];
  const categoryFor = (effect: TransitionEffect): Category => {
    if (effect === 'wipe') return 'mask';
    const category = transitionPreset(effect).category;
    return category === 'continuity' ? 'basic' : category;
  };
  let category = $state<Category>(untrack(() => categoryFor(value)));
  let lastValue = untrack(() => value);
  let choices = $derived(category === 'basic' ? essentials.map(transitionPreset) : TRANSITION_PRESETS.filter(p => categoryFor(p.id) === category));

  // Follow a new slide or undo/redo while allowing categories to be browsed without editing.
  $effect(() => {
    const current = value;
    untrack(() => {
      if (current !== lastValue) category = categoryFor(current);
      lastValue = current;
    });
  });

  function navigate(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = [...(event.currentTarget as HTMLElement).parentElement!.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + offset + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
</script>

<div class="transition-picker">
  <div class="transition-picker-heading"><span>Transition effect</span><strong>{transitionPreset(value).label}</strong></div>
  <div class="transition-categories" role="group" aria-label="Transition categories">
    {#each categories as item}
      <Button size="sm" aria-pressed={category === item.id} onclick={() => category = item.id} onkeydown={navigate}>{item.label}</Button>
    {/each}
  </div>
  <div class="transition-options" role="group" aria-label="Transition effect">
    {#each choices as choice}
      <button type="button" class="transition-option" class:smart={choice.id === 'smart'} aria-pressed={value === choice.id} aria-label={choice.label} title={choice.description} data-effect={choice.id} data-category={choice.category} onclick={() => onchange(choice.id)} onkeydown={navigate}>
        {#if choice.id === 'smart'}
          <span class="transition-smart-icon" aria-hidden="true"><Sparkles size={22} /></span>
        {:else}
          <svg class="transition-thumbnail" viewBox="0 0 84 48" aria-hidden="true">
            <g class="transition-thumb-from"><rect x="12" y="17" width="43" height="27" rx="3"/><path d="M19 24h17m-17 5h10"/></g>
            <g class="transition-thumb-to"><rect x="30" y="6" width="43" height="27" rx="3"/><path d="M37 13h17m-17 5h10"/><circle cx="64" cy="24" r="4"/></g>
            <path class="transition-thumb-direction" d="M17 10h13m-4-4 4 4-4 4"/>
          </svg>
        {/if}
        <span class="transition-option-label">{choice.label}</span>
        {#if value === choice.id}<span class="transition-option-check" aria-hidden="true"><Check size={12}/></span>{/if}
      </button>
    {/each}
  </div>
</div>
