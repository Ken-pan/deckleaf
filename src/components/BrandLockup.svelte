<script lang="ts">
  import { BRAND } from '../branding';
  let { size = 'compact', caption = '', class: className = '' }: { size?: 'compact' | 'roomy' | 'large'; caption?: string; class?: string } = $props();
</script>

<span class="brand-lockup brand-lockup--{size} {className}">
  <span class="brand-mark" aria-hidden="true"></span>
  <span class="brand-type"><span class="brand-wordmark">{BRAND.name}</span>{#if caption}<span class="brand-caption">{caption}</span>{/if}</span>
</span>
