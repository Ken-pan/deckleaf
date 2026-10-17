<script lang="ts">
  import {DEFAULT_LINE,type LineStyle} from '../../core/line-schema';
  import LineIcon from './LineIcon.svelte';
  let {start,end}:{start:LineStyle['start'];end:LineStyle['end']}=$props();
</script>
<LineIcon style={{...DEFAULT_LINE,start,end}} size={20} width={28} layout="horizontal"/>
