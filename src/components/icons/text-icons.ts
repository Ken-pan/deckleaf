import TextAlignTop from './TextAlignTop.svelte';
import TextAlignMiddle from './TextAlignMiddle.svelte';
import TextAlignBottom from './TextAlignBottom.svelte';
import TextAutoWidth from './TextAutoWidth.svelte';
import TextAutoHeight from './TextAutoHeight.svelte';
import TextFixedSize from './TextFixedSize.svelte';

export const textAlignmentIcons = {top: TextAlignTop, middle: TextAlignMiddle, bottom: TextAlignBottom};
export const textSizingIcons = {'auto-width': TextAutoWidth, 'auto-height': TextAutoHeight, fixed: TextFixedSize};
