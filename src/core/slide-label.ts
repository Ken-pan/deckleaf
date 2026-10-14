import type {Deck,Slide} from './model';

/** Navigation identifies pages by their current position, independently of authored text. */
export function slideLabel(index:number):string { return `Slide ${Math.max(0,index)+1}`; }
export function slideSearchText(slide:Slide,index:number):string {return [slideLabel(index),...slide.elements.filter(e=>!e.hidden&&e.type==='text').map(e=>e.text)].join(' ');}
