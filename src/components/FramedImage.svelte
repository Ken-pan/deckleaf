<script lang="ts">
  import type {SlideElement} from '../core/model';
  import {imageStyle} from '../core/image-style';
  import ResourceImage from './ResourceImage.svelte';
  let {image,src}:{image:SlideElement;src?:string}=$props();
</script>
<ResourceImage {src} alt={image.name} draggable="false" style={imageStyle(image)}/>
