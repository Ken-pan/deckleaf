import {readableChartRange} from './chart-range';
import {chartLabelLayout} from './chart-layout';
import {tableAppearance,tablePresentation,tableCellStyle} from './table-appearance';
import type {Deck} from './model';
import { chartFromElement, chartDescription, displayedChartSeries, isRoundChart,presentationChart } from './charts';
import {fitTableElement,tableRowHeights} from './table-fit';
import type {PptxFontLoader} from './pptx-fonts';
import {nativePptxUnits} from './pptx-units';
import {renderedPptxText} from './native-text-layout';
import {prepareTextSizing} from './text-layout-fonts';
import {prepareRegionFills} from './region-fill';
import {resourceCredits} from './resources';
import {yieldForInput} from './text-layout';
export type ImageDimensions = (src: string, name: string, id?: string) => Promise<{w:number;h:number}>;
const browserImageDimensions: ImageDimensions = (src,name) => new Promise((ok,no)=>{
  const image=new Image();image.onload=()=>ok({w:image.naturalWidth,h:image.naturalHeight});image.onerror=()=>no(new Error(`Cannot read image: ${name}`));image.src=src;
});
export async function buildPptx(deck: Deck, original = false, imageDimensions: ImageDimensions = browserImageDimensions,template=false,fontLoader?:PptxFontLoader): Promise<Uint8Array> {
  if (!original) deck = await prepareTextSizing(deck);
  const authored=deck;
  if (!original) deck = prepareRegionFills(deck);
  if(!original)deck={...deck,slides:deck.slides.map(s=>({...s,elements:s.elements.map(renderedPptxText)}))};
  deck = nativePptxUnits(deck);
  if(deck.slides.some(s=>s.elements.some(e=>e.sourceRegion&&!s.source?.render&&!e.src)))throw new Error('Attach a source PDF to complete complex shape references before exporting.');
  deck={...deck,slides:deck.slides.map(s=>({...s,elements:s.elements.map(e=>e.sourceRegion&&s.source?.render?{...e,src:s.source.render,crop:e.sourceRegion}:e)}))};
  const {default: PptxGenJS} = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({name: 'DECK', width: deck.width / 96, height: deck.height / 96}); pptx.layout = 'DECK'; pptx.title = deck.title; pptx.subject = 'Decksprig'; pptx.author = 'Decksprig';
  const c = (color: string) => color.replace('#', '');
  let deadline = performance.now() + 8;
  for (const s of deck.slides) {
    if (performance.now() >= deadline) { await yieldForInput(); deadline = performance.now() + 8; }
    const slide = pptx.addSlide(); slide.background = {color: c(s.background)};
    slide.hidden = Boolean(s.hidden);
    const credits = original ? '' : resourceCredits({...deck, slides: [s]});
    const prototypeLinks = original ? [] : s.elements.filter(e => !e.hidden && e.type === 'prototype' && e.prototype).map(e => `Interactive prototype: ${e.prototype!.url}`);
    slide.addNotes([s.notes, credits ? `Sources and licenses\n${credits}` : '', ...prototypeLinks].filter(Boolean).join('\n\n'));
    if (original && s.source?.render) { slide.addImage({data: s.source.render, x: 0, y: 0, w: deck.width / 96, h: deck.height / 96}); continue; }
    for (const raw of s.elements.filter(e => !e.hidden)) {
      const e=fitTableElement(raw);
      if (performance.now() >= deadline) { await yieldForInput(); deadline = performance.now() + 8; }
      const base = {x: e.x / 96, y: e.y / 96, w: e.w / 96, h: e.h / 96, rotate: e.rotation, objectName: e.id,altText:e.name, transparency: Math.round((1 - e.opacity) * 100)};
      if (e.type === 'text') {
        const text = e.runs?.length ? e.runs.map(r => ({text: r.text, options: {bold: r.bold, italic: r.italic, color: r.color ? c(r.color) : c(e.fill), fontSize: r.fontSize ? r.fontSize * .75 : e.fontSize * .75, fontFace: r.fontFamily || e.fontFamily}})) : e.text;
        slide.addText(text, {...base, fontFace: e.fontFamily, fontSize: e.fontSize * .75, bold: e.fontWeight >= 600, italic: e.italic, underline: e.underline ? {style: 'sng'} : undefined, color: c(e.fill), align: e.align, margin: 0, breakLine: false, valign: 'top', charSpacing: e.letterSpacing * .75, lineSpacingMultiple: e.lineHeight});
      } else if (e.type === 'image' && e.src) {
        const data = e.src.startsWith('data:') ? {data: e.src} : {path: e.src};
        if (e.fit === 'contain' && !e.crop) {
          const dimensions = await imageDimensions(e.src,e.name,`${s.id}:${e.id}`);
          const scale = Math.min(base.w / dimensions.w, base.h / dimensions.h), w = dimensions.w * scale, h = dimensions.h * scale;
          slide.addImage({...data, ...base, x: base.x + (base.w - w) / 2, y: base.y + (base.h - h) / 2, w, h});
        } else if (e.fit === 'cover' && !e.crop) slide.addImage({...data, ...base, sizing:{type:'cover',w:base.w,h:base.h}});
        else slide.addImage({...data, ...base});
      } else if (e.type === 'rect' || e.type === 'ellipse' || e.type === 'diamond' || e.type === 'line') {
        const geometry=e.type==='line'&&e.h===1?{y:base.y+.5/96,h:0}:{};
        slide.addShape(e.type === 'ellipse' ? pptx.ShapeType.ellipse : e.type === 'diamond' ? pptx.ShapeType.diamond : e.type === 'line' ? pptx.ShapeType.line : e.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {...base,...geometry, fill: e.fill === 'transparent' ? {color: 'FFFFFF', transparency: 100} : {color: c(e.fill), transparency: base.transparency}, line: e.stroke === 'transparent' ? {color: 'FFFFFF', transparency: 100} : {color: c(e.stroke), width: e.strokeWidth * .75}});
      } else if (e.type === 'prototype' && e.prototype) {
        slide.addText(`${e.name}\n${e.prototype.url}`, {...base, fontFace: 'Arial', fontSize: 18, color: c(e.fill), hyperlink: {url: e.prototype.url}, margin: 12});
      } else if (e.type === 'table') {
        const p=tablePresentation(e,deck.designSystem);
        const rows=(e.cells??[]).map((row,i)=>Array.from({length:p.widths.length},(_,j)=>{
          const style=tableCellStyle(p,i,j),fill=style.background==='transparent'?{color:'FFFFFF',transparency:100}:{color:c(style.background)};
          type CellBorder={type:'none'|'solid';pt:number;color:string};
          const border=[style.borderTop,style.borderRight,style.borderBottom,style.borderLeft].map(v=>({type:v==='0'?'none':'solid',pt:v==='0'?0:p.borderWidth*.75,color:c(p.line)})) as [CellBorder,CellBorder,CellBorder,CellBorder];
          return {text:row[j]??'',options:{fill,bold:p.headerRow&&i===0,color:c(style.color),align:style.textAlign,valign:p.verticalAlign,border}};
        }));
        slide.addTable(rows,{...base,fontFace:e.fontFamily,fontSize:e.fontSize*.75,color:c(p.text),colW:p.widths.map(w=>e.w*w/96),margin:p.padding*.75,rowH:p.heights?p.heights.map(h=>h*e.h/96):e.tableFit?tableRowHeights(e).map(h=>h/96):undefined,autoPage:false});
      } else if (e.type === 'chart') {
        const chart = presentationChart(e), series = displayedChartSeries(chart), heading = chart.title, size = Math.max(18, Math.min(28, e.fontSize)*.75);
        const type = chart.type === 'pie' ? pptx.ChartType.pie : chart.type === 'donut' ? pptx.ChartType.doughnut : chart.type === 'line' ? pptx.ChartType.line : chart.type === 'area' ? pptx.ChartType.area : pptx.ChartType.bar;
        const visibleSource=chart.sourceDisplay!=='caption'&&chart.source;
        const decimals=chart.numberFormat?.decimals,numberFormat=(chart.numberFormat?.grouping?'#,##':'')+'0'+(decimals!==undefined?(decimals?'.'+'0'.repeat(decimals):''):series.some(s=>s.values.some(v=>Math.abs(v-Math.round(v))>1e-8))?'.0#':'');
        const format = `${chart.prefix ? '"' + chart.prefix.replace(/"/g, '""') + '"' : ''}${numberFormat}${chart.suffix ? '"' + chart.suffix.replace(/"/g, '""') + '"' : ''}`;
        const range=chart.axisRange?{...chart.axisRange,step:readableChartRange([chart.axisRange.min,chart.axisRange.max]).step}:readableChartRange(series.flatMap(s=>s.values));
        const colors=[c(/^#[\da-fA-F]{6}$/.test(e.fill)?e.fill:chart.colors[0]),...chart.colors.slice(1).map(c)];
        const forecast=chart.forecastFrom!==undefined&&['line','area'].includes(chart.type);
        const data=series.map(s=>({name:s.name,labels:chart.labels,values:s.values}));
        const plotted=forecast?[
          ...data.map(s=>({...s,values:(s.values.map((v,i)=>i<chart.forecastFrom!?v:null) as number[])})),
          ...data.map(s=>({...s,name:s.name+' (forecast)',values:(s.values.map((v,i)=>i>=chart.forecastFrom!-1?v:null) as number[])})),
        ]:data;
        // Actual and forecast share one native line-chart and one pair of axes.
        // Series styling is applied in the fidelity pass, without combo-chart axes.
        slide.addChart(forecast?pptx.ChartType.line:type, plotted, {
          ...base, h: Math.max(.1, base.h - (visibleSource ? size * 1.8 / 72 : 0)),
          barDir: chart.type === 'bar' ? 'bar' : 'col', barGrouping: chart.stacked ? 'stacked' : ['line','area'].includes(chart.type)?'standard':'clustered', holeSize: chart.visual?.donutHole??60,
          showValue: !isRoundChart(chart)&&chart.showValues, showPercent: isRoundChart(chart)&&chart.showValues,
          showLegend: chart.legend, legendPos: 'b', legendFontFace: e.fontFamily, legendFontSize: size, legendColor: c(chart.textColor),
          showTitle: Boolean(heading || chart.subtitle), title: [heading, chart.subtitle].filter(Boolean).join('\n'), titleFontFace: e.fontFamily, titleFontSize: size * 1.3, titleColor: c(chart.textColor),
          catAxisLabelFontFace: e.fontFamily, catAxisLabelFontSize: size, catAxisLabelColor: c(chart.textColor),
          catAxisLabelFrequency:String(chartLabelLayout(e,chart).step),
          valAxisLabelFontFace: e.fontFamily, valAxisLabelFontSize: size, valAxisLabelColor: c(chart.textColor),
          fontSize:size,fontFace:e.fontFamily,dataLabelFontSize:size,dataLabelFontFace:e.fontFamily,dataLabelFormatCode:format,dataLabelColor:c(chart.textColor),dataLabelPosition:chart.stacked?'ctr':'bestFit',
          valAxisMajorUnit:chart.type==='bar'?range.step:undefined,
          showLabel:false,showSerName:false,
          catAxisTitle: chart.categoryTitle, showCatAxisTitle: Boolean(chart.categoryTitle),
          valAxisTitle: chart.valueTitle, showValAxisTitle: Boolean(chart.valueTitle),
          valAxisMinVal:chart.type==='bar'?range.min:chart.axisRange?.min??(series.some(s=>s.values.some(v=>v<0))?undefined:0),valAxisMaxVal:chart.type==='bar'?range.max:chart.axisRange?.max,
          valAxisLabelFormatCode: format,
          valGridLine: {color: 'DDE4E1', style: chart.grid ? 'solid' : 'none'},
          chartColors:isRoundChart(chart)?colors:forecast?[...colors.slice(0,series.length),...colors.slice(0,series.length)]:colors.slice(0,series.length),
          lineDataSymbol: chart.visual?.pointSize===0?'none':'circle', lineSize: (chart.visual?.lineWidth??2.67)*.75, lineDataSymbolSize: Math.max(2,(chart.visual?.pointSize??6.67)*.75), lineSmooth: chart.visual?.smooth??false,
        });
        if (visibleSource) slide.addText(chart.source, {...base,objectName:e.id+':source', y: base.y + base.h - size * 1.8 / 72, h: size * 1.8 / 72, margin: 0, fontFace: e.fontFamily, fontSize: size * .8, color: c(chart.textColor)});
        slide.addNotes(chartDescription(chart));
      }
    }
  }
  // JPEG bytes already carry compression. Deflating them twice adds CPU and
  // temporary buffers without a useful size reduction. Keep PNG/SVG handling,
  // then compress editable XML in the fidelity pass as before.
  const images=deck.slides.flatMap(s=>original&&s.source?.render?[s.source.render]:s.elements.filter(e=>!e.hidden&&e.type==='image'&&e.src).map(e=>e.src!));
  const jpegOnly=images.length>0&&images.every(src=>/^data:image\/jpe?g;/i.test(src)||(!src.startsWith('data:')&&/\.jpe?g$/i.test(src.split(/[?#]/,1)[0])));
  const bytes = await pptx.write({outputType:'uint8array',compression:!jpegOnly}) as Uint8Array;
  if (original) return bytes;
  const { preservePptxFidelity } = await import('./pptx-fidelity');
  const {enhancePptxTemplate}=await import('./pptx-template-structure');
  return enhancePptxTemplate(await preservePptxFidelity(bytes, deck, authored),deck,template,authored,fontLoader);
}
