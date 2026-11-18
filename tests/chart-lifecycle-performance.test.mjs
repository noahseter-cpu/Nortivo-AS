import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketChart,aggregateBars,emaSeries,vwapSeries} from '../dist/terminal/chart.js';

// Behavioral canvas fixture: verifies work scheduling and lifecycle, not native paint time or browser FPS.
class Target extends EventTarget {
  constructor(){super();this.registered=new Map();this.dataset={};}
  addEventListener(type,listener,options){super.addEventListener(type,listener,options);if(!this.registered.has(type))this.registered.set(type,new Set());this.registered.get(type).add(listener);}
  removeEventListener(type,listener,options){super.removeEventListener(type,listener,options);this.registered.get(type)?.delete(listener);}
  listenerCount(){return [...this.registered.values()].reduce((sum,listeners)=>sum+listeners.size,0);}
  emit(type,properties={}){const event=new Event(type,{cancelable:true});Object.assign(event,properties);this.dispatchEvent(event);return event;}
}
const bars=Array.from({length:500},(_,index)=>({time:new Date(Date.parse('2026-11-16T14:30:00Z')+index*60000).toISOString(),open:10000+index,high:10020+index,low:9990+index,close:10010+index,volume:1000+index}));
const market={symbol:'NVDA',currency:'USD',bars,bars5m:bars};
const settings={timeframe:'5m',indicators:{ema9:true,ema20:true,vwap:true}};
function fixture(t){
  const originals=new Map(['window','ResizeObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  const frames=new Map(),observers=[];let nextFrame=0;
  const stats={draws:0,bitmapWrites:0,layoutReads:0};const dimensions={left:0,top:0,width:1000,height:400};
  globalThis.window={devicePixelRatio:2};
  globalThis.requestAnimationFrame=callback=>{const id=++nextFrame;frames.set(id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});
  globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}};
  const noop=()=>{};
  const context=new Proxy({clearRect(){stats.draws++;},measureText:text=>({width:text.length*6})},{get:(target,key)=>target[key]||noop,set:(target,key,value)=>{target[key]=value;return true;}});
  const canvas=new Target();let width=300,height=150;
  Object.defineProperties(canvas,{width:{get:()=>width,set:value=>{width=value;stats.bitmapWrites++;}},height:{get:()=>height,set:value=>{height=value;stats.bitmapWrites++;}}});
  canvas.getContext=()=>context;canvas.getBoundingClientRect=()=>{stats.layoutReads++;return {...dimensions};};canvas.setPointerCapture=noop;
  canvas.attrs={};canvas.setAttribute=(name,value)=>canvas.attrs[name]=value;
  const visible=new Set(),tip={classList:{add:value=>visible.add(value),remove:value=>visible.delete(value)}};
  const controls=['in','out','reset'].map(action=>{const button=new Target();button.dataset.chartAction=action;return button;});
  const container={getBoundingClientRect:()=>{stats.layoutReads++;return {...dimensions};},querySelector:selector=>selector==='canvas'?canvas:tip,querySelectorAll:()=>controls};
  const create=()=>{const chart=new MarketChart(container,{t:key=>key,time:time=>time.slice(11,16),date:time=>time});chart.update(market,settings);return chart;};
  return {stats,dimensions,canvas,controls,tip,frames,observers,create,frame(){const scheduled=[...frames.entries()];for(const [id,callback] of scheduled){frames.delete(id);callback();}}};
}

test('repeated same-canvas mounts release every canvas/control listener and observer',t=>{
  const f=fixture(t);let chart;
  for(let cycle=0;cycle<8;cycle++){
    chart=f.create();assert.equal(f.canvas.listenerCount(),7);assert(f.controls.every(button=>button.listenerCount()===1));
    chart.destroy();assert.equal(f.canvas.listenerCount(),0);assert(f.controls.every(button=>button.listenerCount()===0));
  }
  const before=f.stats.draws;f.canvas.emit('wheel',{deltaY:1,shiftKey:false});f.canvas.emit('pointermove',{clientX:200,clientY:120});f.controls[0].emit('click');
  assert.equal(f.stats.draws,before);assert.equal(f.frames.size,0);assert(f.observers.every(observer=>observer.active===false));
});

test('a pointer burst draws one frame with latest coordinates without per-event layout reads',t=>{
  const f=fixture(t),chart=f.create();const before={...f.stats};
  for(let index=0;index<60;index++)f.canvas.emit('pointermove',{clientX:100+index*5,clientY:150});
  assert.equal(f.stats.draws,before.draws);assert.equal(f.stats.layoutReads,before.layoutReads);assert.equal(f.frames.size,1);
  f.frame();assert.equal(f.stats.draws,before.draws+1);assert.equal(f.stats.bitmapWrites,before.bitmapWrites);assert(f.stats.layoutReads-before.layoutReads<=2);
  assert.deepEqual(chart.crosshair,{x:395,y:150});assert.match(f.tip.textContent,/O .* H .* L .* C .* V /);chart.destroy();
});

test('destroy cancels pending frame and stale callbacks cannot repaint a remounted canvas',t=>{
  const f=fixture(t),old=f.create();f.canvas.emit('pointermove',{clientX:200,clientY:150});const stale=[...f.frames.values()][0];
  old.destroy();assert.equal(f.frames.size,0);const current=f.create(),before=f.stats.draws;stale();f.frame();assert.equal(f.stats.draws,before);
  f.canvas.emit('pointermove',{clientX:210,clientY:160});f.frame();assert.equal(f.stats.draws,before+1);current.destroy();
});

test('bitmap dimensions reset only for actual CSS-size or pixel-ratio changes',t=>{
  const f=fixture(t),chart=f.create();const writes=f.stats.bitmapWrites;assert.equal(writes,2);
  chart.draw();chart.update(market,settings);chart.draw();assert.equal(f.stats.bitmapWrites,writes);
  f.dimensions.width=1020;f.observers[0].callback();f.frame();assert.equal(f.stats.bitmapWrites,writes+1);
  window.devicePixelRatio=1.5;chart.draw();assert.equal(f.stats.bitmapWrites,writes+3);chart.destroy();
});

test('keyboard and chart controls remain immediate and supersede an already queued pointer draw',t=>{
  const f=fixture(t),chart=f.create();f.canvas.emit('pointermove',{clientX:200,clientY:150});const before=f.stats.draws,count=chart.count;
  const event=f.canvas.emit('keydown',{key:'+'});assert.equal(event.defaultPrevented,true);assert.equal(chart.count,count-8);assert.equal(f.stats.draws,before+1);assert.equal(f.frames.size,0);
  f.controls[1].emit('click');assert.equal(chart.count,count+7);assert.equal(f.stats.draws,before+2);
  f.controls[2].emit('click');assert.equal(chart.userZoomed,false);assert.equal(chart.offset,0);assert.match(f.canvas.attrs['aria-label'],/NVDA.*5m.*candles|NVDA.*5m.*bars/);chart.destroy();
});

test('dragging uses the final pending pointer before release and resize notifications coalesce',t=>{
  const f=fixture(t),chart=f.create();f.canvas.emit('pointerdown',{clientX:200,pointerId:1});f.canvas.emit('pointermove',{clientX:350,clientY:150});
  f.canvas.emit('pointerup');assert(chart.offset>0);assert.equal(chart.drag,null);assert.equal(f.frames.size,0);
  const before=f.stats.draws;for(let index=0;index<5;index++)f.observers[0].callback();assert.equal(f.frames.size,1);f.frame();assert.equal(f.stats.draws,before+1);chart.destroy();
});

test('the public update/draw lifecycle preserves a restored viewport, real series and accessible values',t=>{
  const f=fixture(t),first=f.create();f.controls[1].emit('click');f.canvas.emit('keydown',{key:'ArrowLeft'});const saved=first.getViewState();first.destroy();
  const restored=f.create();assert.equal(restored.restoreViewState(saved),true);
  assert.equal(restored.count,saved.count);assert.equal(restored.offset,saved.offset);assert.equal(restored.userZoomed,true);
  const before=f.stats.draws;restored.update(market,{timeframe:'5m',indicators:{ema9:false,ema20:true,vwap:true}});assert.equal(f.stats.draws,before+1);
  assert.equal(restored.count,saved.count);assert.equal(restored.offset,saved.offset);
  assert.deepEqual(restored.series.ema9,emaSeries(bars,9));assert.deepEqual(restored.series.vwap,vwapSeries(bars));
  assert.equal(restored.settings.indicators.ema9,false);assert.match(f.canvas.attrs['aria-label'],/93 bars/);assert.match(f.canvas.attrs['aria-label'],/105\.04 USD/);restored.destroy();
});

test('cached exchange-day formatting preserves New York session VWAP, aggregation and indicators',()=>{
  const source=[
    {time:'2026-03-06T23:59:00Z',open:10,high:10,low:10,close:10,volume:2},
    {time:'2026-03-07T00:00:00Z',open:20,high:20,low:20,close:20,volume:2},
    {time:'2026-03-09T13:30:00Z',open:30,high:30,low:30,close:30,volume:1},
  ];
  assert.deepEqual(vwapSeries(source),[10,15,30]);
  assert.deepEqual(aggregateBars(source,2),[{time:source[1].time,open:10,high:20,low:10,close:20,volume:4}]);
  assert.deepEqual(emaSeries(source,2),[null,15,25]);
});
