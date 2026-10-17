<script lang="ts">
  import type {Snippet} from 'svelte';
  let {label,children}:{label:string;children:Snippet}=$props();
</script>

<div class="ui-property-row">
  <span class="ui-property-label">{label}</span>
  <div class="ui-property-control">{@render children()}</div>
</div>
