import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,solve,intersect,projectSensor} from '../geometry.mjs';
import {runChecks} from '../validation.mjs';

for(const row of runChecks()) test(row.name,()=>assert.ok(row.passed,row.detail));

test('seeded random disk interiors remain inside analytic plate and sensor bounds',()=>{
  let state=0x7125bd39;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  let valid=0;
  for(let c=0;c<100;c++){
    const p={...DEFAULTS,cameraDistance:250+rand()*1600,cameraAngle:rand()*80,azimuth:rand()*360-180,cameraRoll:rand()*360-180,
      plateDistance:50+rand()*800,plateMode:rand()<0.5?'normal':'parallel',tiltU:rand()*120-60,tiltV:rand()*120-60,roll:rand()*360-180};
    const s=solve(p,{samples:0,boundary:0});if(!s.valid)continue;valid++;
    for(let j=0;j<300;j++){
      const r=150*Math.sqrt(rand()),a=rand()*2*Math.PI,P=[r*Math.cos(a),r*Math.sin(a),0],h=intersect(P,s.frame);
      assert.ok(h);assert.ok(h.u>=s.range.u[0]-1e-7 && h.u<=s.range.u[1]+1e-7);
      assert.ok(h.v>=s.range.v[0]-1e-7 && h.v<=s.range.v[1]+1e-7);
      const image=projectSensor(P,p,s.frame);
      if(s.fov.all) assert.ok(image && Math.abs(image[0])<=p.sensorWidth/2+1e-7 && Math.abs(image[1])<=p.sensorHeight/2+1e-7);
    }
  }
  assert.ok(valid>30);
});
test('full coverage is decided analytically even if a small miss escapes sampling',()=>{
  const s=solve({cameraAngle:0,cameraDistance:600,plateDistance:300,margin:0,actualWidth:449.999,actualHeight:450},{samples:1,boundary:4});
  assert.equal(s.coverage.all,false);assert.equal(s.coverage.sampled,1);
});
test('off-axis horizontal plane agrees with direct ray intersection',()=>{
  const p={...DEFAULTS,cameraAngle:40,plateMode:'parallel',plateDistance:220,distanceMode:'height'};
  const s=solve(p,{samples:0,boundary:0}),P=[100,-25,0],hit=intersect(P,s.frame),C=s.frame.C,h=220;
  assert.ok(Math.abs(hit.Q[0]-(P[0]+h*(P[0]-C[0])/C[2]))<1e-8);
  assert.ok(Math.abs(hit.Q[1]-(P[1]+h*(P[1]-C[1])/C[2]))<1e-8);
  assert.ok(Math.abs(hit.Q[2]-h)<1e-8);
});
test('normal polarity reversal preserves the plane and rectangle dimensions',()=>{
  const a=solve({}, {samples:0,boundary:0}),b=solve({tiltU:180},{samples:0,boundary:0});
  assert.ok(a.valid&&b.valid);assert.ok(Math.abs(a.minimum.width-b.minimum.width)<1e-8);assert.ok(Math.abs(a.minimum.height-b.minimum.height)<1e-8);
});
test('sensor dimensions match the specified camera pixels and pixel pitch',()=>{
  assert.ok(Math.abs(DEFAULTS.sensorWidth-2448*3.45/1000)<1e-12);
  assert.ok(Math.abs(DEFAULTS.sensorHeight-2048*3.45/1000)<1e-12);
});
