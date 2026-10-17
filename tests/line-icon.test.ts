import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_LINE,LINE_ROUTES,LINE_DASHES,LINE_ENDS} from '../src/core/lines';
import {lineIconGeometry,lineIconMarker} from '../src/core/line-icon';

test('every route, pattern and endpoint pair composes independently with finite icon geometry',()=>{
  for(const route of LINE_ROUTES)for(const dash of LINE_DASHES)for(const start of LINE_ENDS)for(const end of LINE_ENDS){
    const style={...DEFAULT_LINE,route:route.value,dash:dash.value,start:start.value,end:end.value};
    const icon=lineIconGeometry(style),path=lineIconGeometry({...DEFAULT_LINE,route:route.value});
    assert.equal(icon.d,path.d);assert.deepEqual(icon.a,path.a);assert.deepEqual(icon.b,path.b);
    assert.equal(icon.markers[0].kind,start.value);assert.equal(icon.markers[1].kind,end.value);
    assert.equal(icon.dash,lineIconGeometry({...DEFAULT_LINE,dash:dash.value}).dash);
    assert(!/NaN|undefined|Infinity/.test(JSON.stringify(icon)));
  }
});

test('filled arrows, open arrows, stealth arrows and rings retain their actual visual meanings',()=>{
  const arrow=lineIconMarker('arrow'),open=lineIconMarker('open-arrow'),stealth=lineIconMarker('stealth'),ring=lineIconMarker('circle-outline'),dot=lineIconMarker('circle');
  assert.notEqual(arrow.d,open.d);assert.notEqual(arrow.d,stealth.d);
  assert(arrow.filled&&stealth.filled&&!open.filled);
  assert(ring.occludes&&!ring.filled&&ring.stroke>0);assert(dot.filled);
  assert(!open.occludes&&!lineIconMarker('bar').occludes);
});

test('stroke-only and endpoint-only icons share geometry and keep icon weight independent of document dimensions',()=>{
  const style={...DEFAULT_LINE,start:'diamond' as const,end:'circle-outline' as const,cap:'butt' as const,markerSize:3};
  const horizontal=lineIconGeometry(style,'horizontal',40);
  assert.equal(horizontal.d,'M6 12H34');assert.deepEqual(horizontal.a,[6,12,180]);assert.deepEqual(horizontal.b,[34,12,0]);
  assert.deepEqual(horizontal,lineIconGeometry({...style,cap:'square',markerSize:6},'horizontal',40));
  assert.equal(lineIconMarker('circle-outline').stroke,2);
  assert.equal(lineIconMarker('open-arrow').stroke,2);
});
