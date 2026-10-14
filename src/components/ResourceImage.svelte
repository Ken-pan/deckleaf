<script lang="ts">
  import type {HTMLImgAttributes} from 'svelte/elements';
  import {isBrowserEdition} from '../core/runtime';
  let {src='',...attributes}:HTMLImgAttributes=$props();
  let resolved=$state('');
  $effect(()=>{
    const url=String(src||'');
    if(!isBrowserEdition||!url.startsWith('/api/')){resolved=url;return;}
    resolved='';let stopped=false,objectUrl='';const controller=new AbortController();
    void fetch(url,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Preview unavailable');const blob=await response.blob();if(stopped)return;objectUrl=URL.createObjectURL(blob);resolved=objectUrl;}).catch(()=>{if(!stopped)resolved='data:image/png;base64,';});
    return ()=>{stopped=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  });
</script>
<img {...attributes} src={resolved||undefined} />
