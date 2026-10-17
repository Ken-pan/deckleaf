<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Button from './Button.svelte';
  type Props = Omit<HTMLButtonAttributes, 'children'> & {label: string; tone?: 'danger'; size?: 'sm' | 'md' | 'lg'; busy?: boolean; children?: Snippet};
  let {label, size = 'md', children, ...attributes}: Props = $props();
</script>

<Button {...attributes} kind="icon" {size} aria-label={label}>{@render children?.()}</Button>
