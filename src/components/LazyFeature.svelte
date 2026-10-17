<script lang="ts" generics="T extends Feature">
  import {untrack} from 'svelte';
  import type {Feature,FeatureProps} from '../features';
  import Dialog from './LazyDialog.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Button from './ui/Button.svelte';
  import InsertToolsFrame from './InsertToolsFrame.svelte';
  let {feature,props={} as FeatureProps[T],onclose,modalTitle}:{feature:T;props?:FeatureProps[T];onclose?:()=>void;modalTitle?:string}=$props();
  const focusOrigin=untrack(()=>modalTitle?document.activeElement as HTMLElement|null:null);
  const request=import('./AsyncFeature.svelte').then(module=>module.default);
  const name=$derived(modalTitle||(feature==='welcome'?'workspace':feature.replaceAll('-',' ')));
</script>
{#snippet pending()}
  {#if feature==='insert-tools'}<InsertToolsFrame compact={Boolean((props as FeatureProps['insert-tools']).compact)}/>
  {:else}
  <EmptyState density={feature==='notifications'?'inline':'compact'} busy role="status" title={`Opening ${name}…`}/>
  {/if}
{/snippet}
{#await request}
  {#if modalTitle&&onclose}<Dialog title={modalTitle} wide workspace={feature==='layout'||feature==='deck-styles'} {onclose}>{@render pending()}</Dialog>{:else}{@render pending()}{/if}
{:then View}<View {feature} {props} {onclose} {modalTitle} {focusOrigin}/>
{:catch}
  {#if modalTitle&&onclose}<Dialog title={modalTitle} wide workspace={feature==='layout'||feature==='deck-styles'} {onclose}>{@render failed()}</Dialog>{:else}{@render failed()}{/if}
{/await}
{#snippet failed()}
  {#if feature==='insert-tools'}<InsertToolsFrame failed compact={Boolean((props as FeatureProps['insert-tools']).compact)}/>
  {:else}
  <EmptyState density="compact" tone="error" role="alert" title="This view could not load" description="Refresh the app to reload this view.">
    <Button variant="secondary" onclick={()=>window.location.reload()}>Refresh app</Button>{#if onclose}<Button onclick={onclose}>Back to editor</Button>{/if}
  </EmptyState>
  {/if}
{/snippet}
