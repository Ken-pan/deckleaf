<script lang="ts">
  import {EmptyState} from './ui';
  import { FileText, ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Minus, Plus, ExternalLink, X } from '@lucide/svelte';
  import SlideThumbnail from './SlideThumbnail.svelte';
  import type { SpeakerSession } from '../core/presentation-session';
  import {adjacentVisibleSlide} from '../core/slide-visibility';
  let { session, detached = false, onadvance, onclock, onreset, ondetach, onclose }:
    { session: SpeakerSession; detached?: boolean; onadvance: (direction: number) => void; onclock: () => void; onreset: () => void; ondetach?: () => void; onclose?: () => void } = $props();
  let fontSize = $state(18);
  let slide = $derived(session.deck.slides[session.index]);
  let nextIndex = $derived(adjacentVisibleSlide(session.deck.slides, session.index, 1));
  let previousIndex = $derived(adjacentVisibleSlide(session.deck.slides, session.index, -1));
  let next = $derived(nextIndex === null ? undefined : session.deck.slides[nextIndex]);
</script>

<section class="speaker-panel" class:detached aria-label="Speaker view">
  <header class="speaker-heading">
    <h2>Speaker view</h2>
    {#if ondetach}<button class="player-button" onclick={ondetach} aria-label="Open speaker window" title="Open speaker window"><ExternalLink size={18}/></button>{/if}
    {#if onclose}<button class="player-button" onclick={onclose} aria-label="Close speaker view"><X size={18}/></button>{/if}
  </header>
  <p class="speaker-sharing-hint">{detached ? 'Share the presentation window with your audience.' : 'For private notes, open a speaker window and share only the presentation window.'}</p>
  <div class="speaker-timing">
    <div><span class="player-label">Elapsed</span><strong class="speaker-time">{session.elapsed}</strong></div>
    <button class="player-button" onclick={onclock} aria-label={session.timerRunning ? 'Pause timer' : 'Resume timer'} title={session.timerRunning ? 'Pause timer' : 'Resume timer'}>{#if session.timerRunning}<Pause size={18}/>{:else}<Play size={18}/>{/if}</button>
    <button class="player-button" onclick={onreset} aria-label="Reset timer" title="Reset timer"><RotateCcw size={18}/></button>
  </div>
  {#if detached}
    <div class="speaker-current" style:--speaker-preview-width="{220 * session.deck.width / session.deck.height}px">
      <div class="speaker-section-heading"><h3>Current slide</h3><span>{session.index + 1} / {session.deck.slides.length}</span></div>
      <SlideThumbnail deck={session.deck} {slide} original={session.original} active />
      {#if session.steps}<p class="player-label">Step {session.step} of {session.steps}</p>{/if}
      {#if session.blackout}<p class="player-label">Audience screen is black</p>{/if}
    </div>
  {/if}
  <div class="speaker-next">
    <div class="speaker-section-heading"><h3>Up next</h3><span>{next ? nextIndex! + 1 : 'Finished'}</span></div>
    {#if next}
      <button class="speaker-next-preview" style:max-width="{180 * session.deck.width / session.deck.height}px" onclick={() => onadvance(1)} aria-label={session.step < session.steps ? 'Reveal next step' : `Next slide: ${nextIndex! + 1}`}>
        <SlideThumbnail deck={session.deck} slide={next} original={session.original} active />
      </button>
      <p class="speaker-next-title">{`Slide ${nextIndex! + 1}`}</p>
    {:else}<p class="speaker-end">{session.step < session.steps ? 'Reveal the remaining steps on this slide.' : 'You have reached the last slide.'}</p>{/if}
  </div>
  <div class="speaker-section-heading speaker-notes-heading">
    <h3>Speaker notes</h3>
    <div class="speaker-type-controls"><button class="player-button" onclick={() => fontSize = Math.max(14, fontSize - 2)} disabled={fontSize === 14} aria-label="Smaller notes"><Minus size={16}/></button><button class="player-button" onclick={() => fontSize = Math.min(32, fontSize + 2)} disabled={fontSize === 32} aria-label="Larger notes"><Plus size={16}/></button></div>
  </div>
  <!-- Scrollable notes need a keyboard focus target; this named region is intentionally focusable. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="speaker-notes" style:font-size="{fontSize}px" tabindex="0" role="region" aria-label="Notes for current slide">{#if slide.notes}{slide.notes}{:else}<EmptyState density="inline" icon={FileText} title="No speaker notes" description="Add talking points in the editor before presenting." />{/if}</div>
  {#if detached}<footer class="speaker-navigation"><button class="player-button" onclick={() => onadvance(-1)} disabled={previousIndex === null && session.step === 0} aria-label="Previous slide or step"><ArrowLeft size={20}/></button><span>{session.index + 1} / {session.deck.slides.length}</span><button class="player-button" onclick={() => onadvance(1)} disabled={!next && session.step === session.steps} aria-label="Next slide or step"><ArrowRight size={20}/></button></footer>{/if}
</section>
