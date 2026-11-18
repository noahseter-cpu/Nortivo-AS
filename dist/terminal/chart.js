// Price geometry uses server-owned integer cents. Never synthesize bars or interpolate gaps.
export function emaSeries(bars, period) {
  let previous = null, total = 0;
  return bars.map((bar, index) => {
    if (index < period) total += bar.close;
    if (index < period - 1) return null;
    previous = previous === null ? total / period : bar.close * (2 / (period + 1)) + previous * (1 - 2 / (period + 1));
    return previous;
  });
}
export function vwapSeries(bars) {
  let session = '', volume = 0, value = 0;
  return bars.map(bar => {
    const key = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(bar.time));
    if (key !== session) { session = key; volume = 0; value = 0; }
    volume += bar.volume;
    value += ((bar.high + bar.low + bar.close) / 3) * bar.volume;
    return volume ? value / volume : null;
  });
}
export function aggregateBars(bars, minutes) {
  if (minutes === 1) return bars;
  // Exchange sessions stay separate. Only complete consecutive groups are exposed.
  const groups = new Map();
  for (const bar of bars) {
    const d = new Date(bar.time), key = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bar);
  }
  const result = [];
  for (const session of groups.values()) {
    const size = minutes >= 390 ? 390 : minutes;
    for (let index = 0; index + size <= session.length; index += size) {
      const group = session.slice(index,index+size);
      if (group.some((bar,i) => i && new Date(bar.time) - new Date(group[i-1].time) !== 60000)) continue;
      result.push({time:group.at(-1).time,open:group[0].open,high:Math.max(...group.map(b=>b.high)),low:Math.min(...group.map(b=>b.low)),close:group.at(-1).close,volume:group.reduce((n,b)=>n+b.volume,0)});
    }
  }
  return result;
}
export class MarketChart {
  constructor(container, options) {
    this.container = container; this.options = options; this.canvas = container.querySelector('canvas'); this.tip = container.querySelector('.chart-tooltip'); this.ctx = this.canvas.getContext('2d'); this.offset = 0; this.count = this.defaultCount(); this.userZoomed = false; this.crosshair = null; this.marker = null; this.drag = null;
    this.resize = new ResizeObserver(() => {if(!this.userZoomed)this.count=this.defaultCount();this.draw();}); this.resize.observe(container);
    this.canvas.addEventListener('wheel', e => {e.preventDefault(); if(e.shiftKey) this.offset = Math.max(0, Math.min(Math.max(0,this.bars.length-5),this.offset + Math.sign(e.deltaY) * 5)); else {this.count = Math.max(12,Math.min(300,this.count + Math.sign(e.deltaY) * 8));this.userZoomed=true;} this.draw();}, {passive:false});
    this.canvas.addEventListener('pointerdown', e => {this.drag={x:e.clientX,offset:this.offset};this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{const r=this.canvas.getBoundingClientRect();this.crosshair={x:e.clientX-r.left,y:e.clientY-r.top};if(this.drag){this.offset=Math.max(0,Math.min(Math.max(0,this.bars.length-5),this.drag.offset+Math.round((e.clientX-this.drag.x)/Math.max(3,(r.width-62)/this.count))));}this.draw();});
    this.canvas.addEventListener('pointerup',()=>{this.drag=null;});
    this.canvas.addEventListener('pointercancel',()=>{this.drag=null;});
    this.canvas.addEventListener('pointerleave',()=>{if(!this.drag){this.crosshair=null;this.tip.classList.remove('visible');this.draw();}});
    this.canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','+','-','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')this.offset=Math.min(Math.max(0,this.bars.length-5),this.offset+5);if(e.key==='ArrowRight')this.offset=Math.max(0,this.offset-5);if(e.key==='+'){this.count=Math.max(12,this.count-8);this.userZoomed=true;}if(e.key==='-'){this.count=Math.min(300,this.count+8);this.userZoomed=true;}if(e.key==='Home')this.offset=Math.max(0,this.bars.length-this.count);if(e.key==='End')this.offset=0;this.draw();}});
    container.querySelectorAll('[data-chart-action]').forEach(button=>button.addEventListener('click',()=>{const a=button.dataset.chartAction;if(a==='in'){this.count=Math.max(12,this.count-15);this.userZoomed=true;}if(a==='out'){this.count=Math.min(300,this.count+15);this.userZoomed=true;}if(a==='reset'){this.offset=0;this.count=this.defaultCount();this.userZoomed=false;}this.draw();}));
  }
  defaultCount(){const width=this.container.getBoundingClientRect().width;return width<540?34:width<730?56:width<900?64:78;}
  update(market, settings, marker = null) {
    const keys={'1m':'bars','5m':'bars5m','15m':'bars15m','1h':'bars1h','4h':'bars4h','1d':'bars1d'};
    if(this.symbol!==market.symbol || this.timeframe!==settings.timeframe){this.offset=0;this.count=this.defaultCount();this.userZoomed=false;this.symbol=market.symbol;this.timeframe=settings.timeframe;}
    this.market=market;this.priceScale=market.priceScale||100;this.priceDecimals=market.priceDecimals??2;this.settings=settings;this.marker=marker;
    this.bars=market[keys[settings.timeframe]] || aggregateBars(market.bars || [], {'1m':1,'5m':5,'15m':15,'1h':60,'4h':240,'1d':390}[settings.timeframe]||1);
    const rawVwap=vwapSeries(market.bars||[]),vwapByTime=new Map((market.bars||[]).map((bar,index)=>[bar.time,rawVwap[index]]));
    this.series={ema9:emaSeries(this.bars,9),ema20:emaSeries(this.bars,20),vwap:this.bars.map(bar=>vwapByTime.get(bar.time)??null)};
    if(marker?.time&&this.markerKey!==marker.time){const index=this.bars.findIndex(bar=>new Date(bar.time)>=new Date(marker.time));if(index>=0)this.offset=Math.max(0,this.bars.length-Math.min(this.bars.length,index+Math.round(this.count/2)));this.markerKey=marker.time;}
    this.draw();
  }
  destroy(){this.resize.disconnect();}
  draw(){
    if(!this.market)return;
    const {width:w,height:h}=this.container.getBoundingClientRect();if(!w||!h)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=w*dpr;this.canvas.height=h*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);const c=this.ctx;c.clearRect(0,0,w,h);
    const right=61,left=7,top=12,bottom=25,volumeH=h*.15,priceBottom=h-bottom-volumeH-10,pw=w-right-left,ph=priceBottom-top;
    const end=Math.max(1,this.bars.length-this.offset),start=Math.max(0,end-this.count),visible=this.bars.slice(start,end);
    c.font='11px Manrope';c.textBaseline='middle';
    if(!visible.length){c.fillStyle='#a7b5b3';c.textAlign='center';c.fillText(this.options.t('warmupChart'),w/2,h/2);return;}
    const low=Math.min(...visible.map(b=>b.low)),high=Math.max(...visible.map(b=>b.high)),range=Math.max(this.priceScale,high-low),min=low-range*.09,max=high+range*.09;
    const y=p=>top+(max-p)/(max-min)*ph,x=i=>left+(i+.5)*pw/visible.length;
    c.strokeStyle='#1e292a';c.lineWidth=.6;c.textAlign='left';
    for(let i=0;i<=6;i++){const yy=top+ph*i/6;c.beginPath();c.moveTo(left,yy);c.lineTo(w-right,yy);c.stroke();c.fillStyle='#a2afaa';c.fillText(((max-(max-min)*i/6)/this.priceScale).toFixed(this.priceDecimals),w-right+6,yy);}
    const step=Math.max(1,Math.ceil(visible.length/6));
    for(let i=0;i<visible.length;i+=step){const xx=x(i);c.strokeStyle='#172123';c.beginPath();c.moveTo(xx,top);c.lineTo(xx,h-bottom);c.stroke();c.fillStyle='#a2afaa';c.textAlign='center';c.fillText(this.options.time(visible[i].time),xx,h-10);}
    visible.forEach((bar,i)=>{if(!i||bar.time.slice(0,10)===visible[i-1].time.slice(0,10))return;const xx=x(i)-pw/visible.length/2;c.strokeStyle='#496157';c.setLineDash([3,4]);c.beginPath();c.moveTo(xx,top);c.lineTo(xx,h-bottom);c.stroke();c.setLineDash([]);c.fillStyle='#bacfc2';c.textAlign='left';c.font='11px Manrope';c.fillText(this.options.day?this.options.day(bar.time):bar.time.slice(0,10),xx+5,top+9);});
    const maxVolume=Math.max(...visible.map(b=>b.volume)),cw=Math.max(1,Math.min(12,pw/visible.length*.67));
    visible.forEach((bar,i)=>{const xx=x(i),up=bar.close>=bar.open;c.strokeStyle=up?'#62de94':'#ec686c';c.fillStyle=up?'#60da90':'#e86469';c.lineWidth=1;c.beginPath();c.moveTo(xx,y(bar.high));c.lineTo(xx,y(bar.low));c.stroke();c.fillRect(xx-cw/2,y(Math.max(bar.open,bar.close)),cw,Math.max(1,Math.abs(y(bar.open)-y(bar.close))));c.globalAlpha=.45;c.fillRect(xx-cw/2,h-bottom-(bar.volume/maxVolume)*volumeH,cw,(bar.volume/maxVolume)*volumeH);c.globalAlpha=1;});
    [['ema9','#d7e2dc'],['ema20','#7bd295'],['vwap','#86aebb']].forEach(([key,color])=>{if(!this.settings.indicators?.[key])return;c.strokeStyle=color;c.lineWidth=1.1;c.beginPath();let pen=false;this.series[key].slice(start,end).forEach((value,i)=>{if(value===null){pen=false;return;}if(key==='vwap'&&i&&visible[i].time.slice(0,10)!==visible[i-1].time.slice(0,10))pen=false;if(!pen){c.moveTo(x(i),y(value));pen=true;}else c.lineTo(x(i),y(value));});c.stroke();});
    const last=visible.at(-1);const yy=y(last.close);c.setLineDash([3,4]);c.strokeStyle='#4e9e6a77';c.beginPath();c.moveTo(left,yy);c.lineTo(w-right,yy);c.stroke();c.setLineDash([]);c.fillStyle=last.close>=last.open?'#72ee9f':'#f18585';c.fillRect(w-right,yy-9,right,18);c.fillStyle='#07150d';c.textAlign='center';c.font='11px IBM Plex Mono';c.fillText((last.close/this.priceScale).toFixed(this.priceDecimals),w-right/2,yy);
    if(this.marker?.time){const mt=+new Date(this.marker.time),idx=visible.findIndex(b=>+new Date(b.time)>=mt);if(idx>=0){const xx=x(idx);c.strokeStyle='#c8db88';c.setLineDash([4,3]);c.beginPath();c.moveTo(xx,top);c.lineTo(xx,h-bottom);c.stroke();c.setLineDash([]);c.fillStyle='#c8db88';c.beginPath();c.arc(xx,y(visible[idx].close),5,0,Math.PI*2);c.stroke();const label=this.marker.label||this.options.t('event');c.font='10px Manrope';const tw=Math.min(pw-15,c.measureText(label).width+16),lx=Math.min(w-right-tw,Math.max(8,xx-tw/2));c.fillStyle='#15251a';c.fillRect(lx,top+5,tw,23);c.strokeStyle='#638267';c.strokeRect(lx,top+5,tw,23);c.fillStyle='#e0edce';c.textAlign='center';c.fillText(label.slice(0,42),lx+tw/2,top+17);}}
    if(this.crosshair&&!this.drag){const {x:cx,y:cy}=this.crosshair;if(cx>left&&cx<w-right&&cy<h-bottom){const idx=Math.max(0,Math.min(visible.length-1,Math.floor((cx-left)/pw*visible.length))),bar=visible[idx],xx=x(idx);c.strokeStyle='#8ba99b';c.lineWidth=.6;c.setLineDash([3,3]);c.beginPath();c.moveTo(xx,top);c.lineTo(xx,h-bottom);c.moveTo(left,cy);c.lineTo(w-right,cy);c.stroke();c.setLineDash([]);this.tip.textContent=`${this.options.date(bar.time)} · O ${(bar.open/this.priceScale).toFixed(this.priceDecimals)}  H ${(bar.high/this.priceScale).toFixed(this.priceDecimals)}  L ${(bar.low/this.priceScale).toFixed(this.priceDecimals)}  C ${(bar.close/this.priceScale).toFixed(this.priceDecimals)} · V ${bar.volume.toLocaleString()}`;this.tip.classList.add('visible');}}else this.tip.classList.remove('visible');
    this.canvas.setAttribute('aria-label',`${this.market.symbol} ${this.options.t('chart')} ${this.timeframe}, ${visible.length} ${this.options.t('bars')}, ${this.options.t('lastPrice')} ${(last.close/this.priceScale).toFixed(this.priceDecimals)} ${this.market.currency||'USD'}. ${this.options.t('chartKeyboard')}`);
  }
}
