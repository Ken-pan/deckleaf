<script lang="ts">
  import { Icon, type LucideProps } from '@lucide/svelte';
  import { editorIconData } from './editor-icon-data';
  let props: LucideProps = $props();
</script>

<Icon {...props} icon={editorIconData.cornerRadius} />
