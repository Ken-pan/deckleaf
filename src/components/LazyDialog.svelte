<script lang="ts">
  import type {ComponentProps} from 'svelte';
  import type DialogView from './Dialog.svelte';
  const props:ComponentProps<typeof DialogView>=$props();
  const view=import('./Dialog.svelte');
</script>
{#await view}<div role="status" class="dialog-loading">Opening {props.title}…</div>{:then module}<module.default {...props}/>{:catch}<div role="alert">This view could not load. Refresh the app.</div>{/await}
<style>.dialog-loading{position:fixed;inset:auto 24px 24px auto;padding:12px 16px;background:var(--surface);color:var(--text-secondary);z-index:100;font-size:var(--ui-label)}</style>
