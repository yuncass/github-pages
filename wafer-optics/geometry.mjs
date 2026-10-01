// All geometry is in mm. The wafer lies in z=0; the camera aims at its center.
export const DEFAULTS = Object.freeze({
  diameter: 300, cameraDistance: 650, cameraAngle: 45, azimuth: 0, cameraRoll: 0,
  focalLength: 8, sensorWidth: 8.4456, sensorHeight: 7.0656,
  plateDistance: 400, distanceMode: 'ray', plateMode: 'normal',
  tiltU: 0, tiltV: 0, roll: 0, offsetU: 0, offsetV: 0,
  centerMode: 'auto', margin: 5, actualWidth: 520, actualHeight: 520
});
export const PRESETS = {
  standard: {name: '기본 · 45°', values: {}},
  symmetric: {name: '정면 · 평행판', values: {cameraAngle: 0, cameraDistance: 600, plateDistance: 250, plateMode: 'parallel'}},
  oblique: {name: '비스듬히 · 65°', values: {cameraAngle: 65, cameraDistance: 800, plateDistance: 500}},
  tilted: {name: '판 기울기 · 20°', values: {tiltU: 20, tiltV: -10, roll: 15}}
};
export const LIMITS = {
  diameter: [1, 3000], cameraDistance: [1, 50000], cameraAngle: [0, 89.5],
  azimuth: [-180, 180], cameraRoll: [-180, 180], focalLength: [0.1, 1000],
  sensorWidth: [0.1, 1000], sensorHeight: [0.1, 1000], plateDistance: [0.1, 50000],
  tiltU: [-180, 180], tiltV: [-180, 180], roll: [-180, 180],
  offsetU: [-50000, 50000], offsetV: [-50000, 50000], margin: [0, 5000],
  actualWidth: [0.1, 100000], actualHeight: [0.1, 100000]
};
export const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
export const add = (a,b) => a.map((v,i) => v+b[i]);
export const sub = (a,b) => a.map((v,i) => v-b[i]);
export const mul = (a,s) => a.map(v => v*s);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length = a => Math.hypot(...a);
export const unit = a => mul(a,1/length(a));
const rad = d => d*Math.PI/180;
export function rotate(v,axis,degrees) {
  const t=rad(degrees), c=Math.cos(t), s=Math.sin(t);
  return add(add(mul(v,c),mul(cross(axis,v),s)),mul(axis,dot(axis,v)*(1-c)));
}
export function validate(p) {
  const errors=[];
  for (const [key,[lo,hi]] of Object.entries(LIMITS)) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key]<lo || p[key]>hi) errors.push(key);
  }
  for (const [key,values] of Object.entries({distanceMode:['ray','height'],plateMode:['normal','parallel'],centerMode:['auto','fixed']})) {
    if (!values.includes(p[key])) errors.push(key);
  }
  return errors;
}

// Exact extrema of a linear-fractional function on a disk. No boundary sampling
// is used for a size or a full-coverage decision. The denominator must not vanish.
export function diskRange(a0,a,b0,b,r) {
  const span=r*Math.hypot(...b), gap=Math.abs(b0)-span;
  if (gap<=1e-12*Math.max(1,Math.abs(b0),span)) return null;
  const A=(Math.abs(b0)-span)*(Math.abs(b0)+span);
  const g0=a0/b0, c=a.map((v,i)=>v-g0*b[i]);
  const mid=-r*r*dot(c,b)/A;
  const half=Math.sqrt(Math.max(0,mid*mid+r*r*dot(c,c)/A));
  return [g0+mid-half,g0+mid+half];
}

export function makeFrame(p) {
  const th=rad(p.cameraAngle), ph=rad(p.azimuth), st=Math.sin(th), ct=Math.cos(th), sp=Math.sin(ph), cp=Math.cos(ph);
  const C=mul([st*cp,st*sp,ct],p.cameraDistance), V=[C[0],C[1],-C[2]];
  const B=[-st*cp,-st*sp,ct];
  const forward=mul(unit(C),-1), horizontal=[ct*cp,ct*sp,-st], vertical=[-sp,cp,0];
  const cr=rad(p.cameraRoll);
  const cameraU=add(mul(horizontal,Math.cos(cr)),mul(vertical,Math.sin(cr)));
  const cameraV=add(mul(horizontal,-Math.sin(cr)),mul(vertical,Math.cos(cr)));
  let u=p.plateMode==='normal' ? [ct*cp,ct*sp,st] : [cp,sp,0];
  let v=[-sp,cp,0], n=cross(u,v);
  v=rotate(v,u,p.tiltU); n=rotate(n,u,p.tiltU);
  u=rotate(u,v,p.tiltV); n=rotate(n,v,p.tiltV);
  u=rotate(u,n,p.roll); v=rotate(v,n,p.roll);
  const rayDistance=p.distanceMode==='ray' ? p.plateDistance : p.plateDistance/ct;
  const A=mul(B,rayDistance);
  return {C,V,B,A,u,v,n,cameraU,cameraV,forward,rayDistance,height:A[2]};
}

export function intersect(P,frame) {
  const d=sub(P,frame.V), den=dot(frame.n,d);
  if (Math.abs(den)<1e-12*Math.max(1,length(d))) return null;
  const t=dot(frame.n,sub(frame.A,P))/den;
  if (!(t>0) || !Number.isFinite(t)) return null;
  const Q=add(P,mul(d,t)), relative=sub(Q,frame.A);
  return {Q,t,u:dot(relative,frame.u),v:dot(relative,frame.v)};
}
export function projectSensor(P,p,frame) {
  const d=sub(P,frame.C), depth=dot(d,frame.forward);
  if (depth<=0) return null;
  return [p.focalLength*dot(d,frame.cameraU)/depth,p.focalLength*dot(d,frame.cameraV)/depth];
}
export function planePoint(frame,u,v) { return add(frame.A,add(mul(frame.u,u),mul(frame.v,v))); }
export function rectangle(frame,center,width,height) {
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>planePoint(frame,center[0]+x*width/2,center[1]+y*height/2));
}
function inside(range,center,size,margin=0) {
  return range[0]-margin >= center-size/2-1e-8 && range[1]+margin<=center+size/2+1e-8;
}
export function solve(input, {samples=2048,boundary=240}={}) {
  const p={...DEFAULTS,...input}, errors=validate(p);
  if (errors.length) return {valid:false,code:'input',errors};
  const frame=makeFrame(p), {C,V,A,n,u,v,forward,cameraU,cameraV}=frame, R=p.diameter/2;
  const b0=-dot(n,V), b=[n[0],n[1]], denomSpan=R*Math.hypot(...b);
  const denomRange=[b0-denomSpan,b0+denomSpan];
  const H=dot(n,sub(A,V));
  const tRange=diskRange(dot(n,A),[-n[0],-n[1]],b0,b,R);
  let code='ok';
  if (!tRange) code='horizon';
  else if (tRange[0]<=1e-10) code='behind';
  const depth0=dot(mul(C,-1),forward), depthB=[forward[0],forward[1]];
  const sensorRange=axis=>diskRange(p.focalLength*dot(mul(C,-1),axis),[p.focalLength*axis[0],p.focalLength*axis[1]],depth0,depthB,R);
  const sx=sensorRange(cameraU), sy=sensorRange(cameraV);
  const allInFront=depth0-R*Math.hypot(...depthB)>1e-9;
  const fovAll=!!(allInFront && sx && sy && inside(sx,0,p.sensorWidth) && inside(sy,0,p.sensorHeight));
  const fov={all:fovAll,allInFront,x:sx,y:sy,sampled:null,
    angleH:2*Math.atan(p.sensorWidth/(2*p.focalLength))*180/Math.PI,
    angleV:2*Math.atan(p.sensorHeight/(2*p.focalLength))*180/Math.PI};
  const result={valid:code==='ok',code,p,frame,denomRange,tRange,fov,footprint:[],wafer:[],sensorOutline:[],sampleCount:samples};
  let ur,vr,center;
  if (result.valid) {
    const range=axis=>{
      const k=dot(axis,sub(V,A));
      return diskRange(k*b0-H*dot(axis,V),[k*b[0]+H*axis[0],k*b[1]+H*axis[1]],b0,b,R);
    };
    ur=range(u); vr=range(v);
    const optimal=[(ur[0]+ur[1])/2,(vr[0]+vr[1])/2];
    center=p.centerMode==='auto' ? optimal : [p.offsetU,p.offsetV];
    const width=2*Math.max(center[0]-ur[0],ur[1]-center[0]);
    const height=2*Math.max(center[1]-vr[0],vr[1]-center[1]);
    result.range={u:ur,v:vr};
    result.minimum={width:ur[1]-ur[0],height:vr[1]-vr[0],center:optimal};
    result.required={width:width+2*p.margin,height:height+2*p.margin,center,world:planePoint(frame,...center)};
    result.coverage={all:inside(ur,center[0],p.actualWidth)&&inside(vr,center[1],p.actualHeight),
      withMargin:inside(ur,center[0],p.actualWidth,p.margin)&&inside(vr,center[1],p.actualHeight,p.margin),sampled:null,blocked:null};
    result.nearHorizon=(Math.abs(b0)-denomSpan)/Math.max(Math.abs(b0)+denomSpan,1)<0.02;
  }
  for (let i=0;i<boundary;i++) {
    const angle=i*2*Math.PI/boundary, P=[R*Math.cos(angle),R*Math.sin(angle),0];
    result.wafer.push(P);
    result.sensorOutline.push(projectSensor(P,p,frame));
    const hit=intersect(P,frame);
    if (result.valid && hit) result.footprint.push(hit);
  }
  let visible=0,covered=0,blocked=0;
  for (let i=0;i<samples;i++) {
    // Equal-area golden-angle samples; percentages describe wafer area, not plate area.
    const rho=R*Math.sqrt((i+0.5)/samples), angle=i*Math.PI*(3-Math.sqrt(5));
    const P=[rho*Math.cos(angle),rho*Math.sin(angle),0], sensor=projectSensor(P,p,frame);
    if (sensor && Math.abs(sensor[0])<=p.sensorWidth/2 && Math.abs(sensor[1])<=p.sensorHeight/2) visible++;
    if (!result.valid) continue;
    const hit=intersect(P,frame);
    if (hit && Math.abs(hit.u-center[0])<=p.actualWidth/2 && Math.abs(hit.v-center[1])<=p.actualHeight/2) covered++;
    const sight=sub(C,P), den=dot(n,sight), t=dot(n,sub(A,P))/den;
    if (Number.isFinite(t) && t>1e-9 && t<1-1e-9) {
      const q=sub(add(P,mul(sight,t)),A);
      if (Math.abs(dot(q,u)-center[0])<=p.actualWidth/2 && Math.abs(dot(q,v)-center[1])<=p.actualHeight/2) blocked++;
    }
  }
  if (samples) {
    fov.sampled=visible/samples;
    if (result.valid) {result.coverage.sampled=covered/samples; result.coverage.blocked=blocked/samples;}
  }
  return result;
}
