import test from 'node:test';
import assert from 'node:assert/strict';
import {dataState} from '../dist/assets/product-core.js';
import {restoredChartView} from '../dist/terminal/chart.js';

const healthy = {configured:true,permissionsReady:true,reachable:true,freshness:'current'};

test('an upgrade is never offered as the remedy for missing or unverified data access', () => {
  for (const state of [null,{...healthy,configured:false},{...healthy,permissionsReady:false},{...healthy,reachable:false}]) {
    assert.equal(dataState(state,false),'unavailable');
  }
  assert.equal(dataState({...healthy,reachable:null},false),'unverified');
  assert.equal(dataState({...healthy,connected:false,authorizationRequired:true},false),'connect');
});

test('market conditions and plan eligibility remain distinct', () => {
  assert.equal(dataState({...healthy,freshness:'stale'},false),'stale');
  assert.equal(dataState({...healthy,freshness:'market_closed'},false),'closed');
  assert.equal(dataState({...healthy,freshness:'delayed'},false),'delayed');
  assert.equal(dataState(healthy,false),'upgrade');
  assert.equal(dataState({...healthy,planIncluded:false}),'upgrade');
  assert.equal(dataState(healthy),'current');
});

const saved = {symbol:'NVDA',timeframe:'5m',offset:18,count:42,userZoomed:true,markerKey:null};
const context = {symbol:'NVDA',timeframe:'5m',barCount:120,defaultCount:64};

test('chart navigation and explicit zoom survive a remount of the same instrument', () => {
  assert.deepEqual(restoredChartView(saved,context),{offset:18,count:42,userZoomed:true,markerKey:null});
  assert.equal(saved.count,42);
});

test('chart state cannot overwrite a different instrument, interval or newly selected event', () => {
  assert.equal(restoredChartView(saved,{...context,symbol:'AMD'}),null);
  assert.equal(restoredChartView(saved,{...context,timeframe:'1h'}),null);
  assert.equal(restoredChartView(saved,{...context,markerKey:'2026-11-16T16:00:00Z'}),null);
});

test('unzoomed charts adapt to the device while panned history stays bounded to available bars', () => {
  assert.deepEqual(restoredChartView({...saved,userZoomed:false,offset:99},{...context,barCount:20,defaultCount:34}),
    {offset:15,count:34,userZoomed:false,markerKey:null});
  assert.equal(restoredChartView({...saved,offset:-5,count:900},context).count,300);
  assert.equal(restoredChartView({...saved,offset:-5,count:900},context).offset,0);
  assert.equal(restoredChartView({...saved,count:NaN},context),null);
});
