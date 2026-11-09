const {test}=require('node:test');
const assert=require('node:assert/strict');
const {layout}=require('../static/calendar-layout.js');
const day=new Date(2026,10,7);
const event=(id,start,end)=>({id,occurrence_start:start,occurrence_end:end,all_day:false});
test('positions half-hour starts and scales durations',()=>{
 const [a]=layout([event(1,'2026-11-07T09:30:00','2026-11-07T11:00:00')],day);
 assert.equal(a.from,570);assert.equal(a.to-a.from,90);assert.equal(a.columns,1);
});
test('overlaps use separate columns; adjacent events reclaim full width',()=>{
 const a=layout([event(1,'2026-11-07T09:00','2026-11-07T11:00'),event(2,'2026-11-07T09:30','2026-11-07T10:30'),event(3,'2026-11-07T11:00','2026-11-07T12:00')],day);
 assert.equal(a[0].columns,2);assert.equal(a[1].columns,2);assert.notEqual(a[0].column,a[1].column);assert.equal(a[2].columns,1);
});
test('overlap chains stay collision free and reuse available columns',()=>{
 const a=layout([event(1,'2026-11-07T09:00','2026-11-07T10:00'),event(2,'2026-11-07T09:30','2026-11-07T11:00'),event(3,'2026-11-07T10:00','2026-11-07T12:00')],day);
 assert.equal(a[0].column,a[2].column);assert(a.every(x=>x.columns===2));
});
test('overnight events clip into both dates and midnight is exclusive',()=>{
 const e=event(1,'2026-11-07T23:30','2026-11-08T01:00');
 let [a]=layout([e],day);assert.equal(a.from,1410);assert.equal(a.to,1440);
 [a]=layout([e],new Date(2026,10,8));assert.equal(a.from,0);assert.equal(a.to,60);
 assert.equal(layout([event(2,'2026-11-06T23:00','2026-11-07T00:00')],day).length,0);
});
test('all-day events and events outside the day do not enter the hour grid',()=>{
 const e=event(1,'2026-11-07T00:00','2026-11-08T00:00');e.all_day=true;
 assert.deepEqual(layout([e,event(2,'2026-11-08T12:00','2026-11-08T13:00')],day),[]);
});
test('clock positions are not shifted by the spring DST transition',()=>{
 const [a]=layout([event(1,'2026-03-29T09:00:00+03:00','2026-03-29T10:00:00+03:00')],new Date(2026,2,29));
 assert.equal(a.from,540);assert.equal(a.to,600);
});
