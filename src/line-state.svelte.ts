import {DEFAULT_LINE, type LineStyle} from './core/line-schema';
export const lineState=$state<{style:LineStyle}>({style:{...DEFAULT_LINE}});
