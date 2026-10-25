import test from 'node:test';
import assert from 'node:assert/strict';
import { aircraft, airframe, newFlight } from '../dist/src/profiles.js';
import { calculate, distributeRemaining, fromLbs, toLbs, parseWeight } from '../dist/src/calculate.js';
import { restore, serialize } from '../dist/src/storage.js';
import { printSheet } from '../dist/src/print.js';
const compute=input=>calculate(input,aircraft,airframe);
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

test('photographed loading reproduces the mass, moment and CG datum',()=>{
  const r=compute(newFlight(true));
  assert.deepEqual(r.errors,{});assert.deepEqual(r.warnings,[]);
  assert.equal(r.zeroFuel.weight,17070);assert.equal(Math.round(r.zeroFuel.moment),4073);
  assert.equal(r.takeoff.weight,26365);assert.equal(Math.round(r.takeoff.moment),21961);
  close(r.takeoff.arm,.8329582021619572);close(r.takeoff.mac,29.50526767885231,1e-6);
  assert.equal(r.landing,null);assert.equal(r.burn,null);
});
test('ventral tank is consumed before wing fuel',()=>{
  assert.deepEqual(distributeRemaining(7799,1496,9295),{wing:7799,ventral:1496});
  assert.deepEqual(distributeRemaining(7799,1496,8000),{wing:7799,ventral:201});
  assert.deepEqual(distributeRemaining(7799,1496,7799),{wing:7799,ventral:0});
  assert.deepEqual(distributeRemaining(7799,1496,6000),{wing:6000,ventral:0});
  assert.deepEqual(distributeRemaining(7799,1496,0),{wing:0,ventral:0});
  assert.deepEqual(distributeRemaining(0,1000,500),{wing:0,ventral:500});
  assert.deepEqual(distributeRemaining(1000,0,500),{wing:500,ventral:0});
});
test('landing calculation conserves mass and moment',()=>{
  for(const remaining of [9295,8000,7799,7000,6280,0]){
    const input=newFlight(true);input.fuel.remaining=remaining;const r=compute(input);
    close(r.takeoff.weight-r.burn.total,r.landing.weight);
    close(r.takeoff.moment-r.burn.moment,r.landing.moment);
    close(r.landing.weight,17070+remaining);
    close(r.landingFuel.wing+r.landingFuel.ventral,remaining);
    close(r.burn.wing+r.burn.ventral,r.burn.total);
  }
});
test('zero is a valid landing input, unlike a missing input',()=>{
  const input=newFlight(true);assert.equal(compute(input).landing,null);
  input.fuel.remaining=0;const r=compute(input);assert.deepEqual(r.errors,{});
  assert.deepEqual(r.landing,r.zeroFuel);assert.equal(r.burn.total,9295);
});
test('excessive, negative or invalid remainder never yields a landing result',()=>{
  for(const value of [9296,-1,NaN,Infinity]){
    const input=newFlight(true);input.fuel.remaining=value;const r=compute(input);
    assert.ok(r.errors.remaining);assert.equal(r.landing,null);assert.equal(r.burn,null);
  }
  assert.throws(()=>distributeRemaining(1,1,3),RangeError);
});
test('bad load and fuel inputs suppress dependent results',()=>{
  for(const value of [-1,NaN,Infinity,null,1000001]){
    const input=newFlight(true);input.loads.row2left=value;const r=compute(input);
    assert.ok(r.errors.row2left);assert.equal(r.zeroFuel,null);assert.equal(r.takeoff,null);
    const input2=newFlight(true);input2.fuel.wing=value;const r2=compute(input2);
    assert.ok(r2.errors.wing);assert.ok(r2.zeroFuel);assert.equal(r2.takeoff,null);
  }
});
test('kg/lbs conversion is reversible and unit preference does not alter calculations',()=>{
  for(const n of [0,55,176,7799,26365,23350])close(toLbs(fromLbs(n,'kg'),'kg'),n);
  const input=newFlight(true),before=compute(input);input.unit='kg';assert.deepEqual(compute(input),before);
  close(parseWeight('79,83225712','kg'),176);assert.equal(parseWeight('0','lbs'),0);
  assert.equal(parseWeight('  ','lbs'),null);
  for(const value of ['-1','abc','NaN','Infinity','1e3','1,2,3'])assert.ok(Number.isNaN(parseWeight(value,'lbs')));
});
test('station, tank and mass limit warnings appear only above their limits',()=>{
  const input=newFlight(true);input.loads.frontBag=250;assert.ok(!compute(input).warnings.some(w=>w.id==='frontBag'));
  input.loads.frontBag=251;input.loads.wardrobe=101;input.loads.rearBag=46;input.fuel.wing=8447;input.fuel.ventral=1497;
  for(const id of ['frontBag','wardrobe','rearBag','wing','ventral'])assert.ok(compute(input).warnings.some(w=>w.id===id));
  const landing=newFlight(true);landing.fuel.remaining=6280;assert.ok(!compute(landing).warnings.some(w=>w.id==='landing'));
  landing.fuel.remaining=6281;assert.ok(compute(landing).warnings.some(w=>w.id==='landing'));
  const heavy=newFlight(true);heavy.loads.row1left=2000;
  assert.ok(compute(heavy).warnings.some(w=>w.id==='zeroFuel'));assert.ok(compute(heavy).warnings.some(w=>w.id==='takeoff'));
});
test('new flight has no payload, no fuel and no landing estimate',()=>{
  const input=newFlight();assert.ok(Object.values(input.loads).every(v=>v===0));
  const r=compute(input);assert.equal(r.takeoff.weight,16321);assert.equal(r.landing,null);
  close(r.takeoff.mac,24.8);close(r.takeoff.arm,.513);
});
test('local storage round trips valid, empty and invalid edits without silently accepting them',()=>{
  const input=newFlight(true);input.unit='kg';input.fuel.remaining=0;input.flight.route='Москва — Сочи';
  assert.deepEqual(restore(serialize(input)),input);
  input.loads.row1left=NaN;const reloaded=restore(serialize(input));assert.ok(Number.isNaN(reloaded.loads.row1left));assert.ok(compute(reloaded).errors.row1left);
  for(const raw of [null,'garbage','{}','{"version":2}',serialize({...input,airframeId:'another'})])assert.equal(restore(raw),null);
});
test('print sheet is complete, uses lbs regardless of UI unit and escapes flight fields',()=>{
  const input=newFlight(true);input.unit='kg';input.fuel.remaining=6000;input.flight.captain='<img src=x onerror=alert(1)>';
  const html=printSheet(input,compute(input),aircraft,airframe);
  assert.ok(html.includes('RA-02734'));assert.ok(html.includes('258719'));assert.ok(html.includes('ДЕМО'));
  assert.ok(html.includes('26 365'));assert.ok(html.includes('23 070'));assert.ok(html.includes('Использованное в полёте топливо'));
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
  assert.equal((html.match(/<svg/g)||[]).length,3);assert.equal((html.match(/<tr/g)||[]).length,20);
});
