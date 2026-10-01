import {DEFAULTS,solve,intersect,makeFrame,dot,sub,mul,length,diskRange} from './geometry.mjs';

// Independent identities and dense numerical checks, shared by the UI and Node.
export function runChecks() {
  const rows=[];
  const check=(name,fn)=>{try{const detail=fn(); rows.push({name,passed:true,detail});}catch(e){rows.push({name,passed:false,detail:e.message});}};
  const assert=(value,message)=>{if(!value) throw new Error(message);};
  const near=(a,b,tol=1e-8)=>assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
  const fast=p=>solve({...DEFAULTS,...p},{samples:0,boundary:0});
  check('정면 평행판 · 닫힌식',()=>{
    const s=fast({cameraAngle:0,cameraDistance:600,plateDistance:300,plateMode:'parallel',margin:0});
    assert(s.valid,'유효하지 않음'); near(s.minimum.width,450); near(s.minimum.height,450);
    return '300 × (1 + 300 / 600) = 450 mm';
  });
  check('경사 관측 · 수평판의 확대율',()=>{
    const p={cameraAngle:55,cameraDistance:800,plateDistance:200,distanceMode:'height',plateMode:'parallel',margin:0};
    const s=fast(p), expected=300*(1+200/(800*Math.cos(55*Math.PI/180)));
    near(s.minimum.width,expected); near(s.minimum.height,expected); near(s.minimum.center[0],0);
    return `지름 × (1 + 높이 / 카메라 높이) = ${expected.toFixed(6)} mm`;
  });
  check('3D 반사 법칙 · 60개 독립 광선',()=>{
    const p={...DEFAULTS,azimuth:32,tiltU:17,tiltV:-11,roll:23}, f=makeFrame(p);
    for(let i=0;i<60;i++){
      const a=i*2*Math.PI/60, P=[150*Math.cos(a),150*Math.sin(a),0], h=intersect(P,f);
      assert(!!h,'교차점 없음'); const incoming=sub(P,f.C), outgoing=sub(h.Q,P);
      const d=mul(incoming,1/length(incoming)), r=mul(outgoing,1/length(outgoing));
      near(d[0],r[0]); near(d[1],r[1]); near(d[2],-r[2]); near(dot(f.n,sub(h.Q,f.A)),0);
    }
    return '입·반사각 일치, 교차점의 판 평면 잔차 < 10⁻⁸ mm';
  });
  check('해석 경계와 조밀한 광선 추적 비교',()=>{
    const p={...DEFAULTS,cameraAngle:61,tiltU:22,tiltV:-14,roll:29}, s=fast(p);
    assert(s.valid,'유효하지 않음'); let lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
    for(let i=0;i<12000;i++){
      const a=2*Math.PI*i/12000,h=intersect([150*Math.cos(a),150*Math.sin(a),0],s.frame);
      [h.u,h.v].forEach((v,k)=>{lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);});
    }
    [s.range.u,s.range.v].forEach((range,k)=>{near(range[0],lo[k],2e-6);near(range[1],hi[k],2e-6);});
    return '경계 12,000개 광선과 상대 오차 < 0.0002%';
  });
  check('센서 시야 · 알려진 경계값',()=>{
    assert(fast({cameraAngle:0,cameraDistance:600,sensorWidth:4,sensorHeight:4}).fov.all,'정확한 접경을 포함해야 함');
    assert(!fast({cameraAngle:0,cameraDistance:599,sensorWidth:4,sensorHeight:4}).fov.all,'시야 부족을 감지해야 함');
    return '8 mm 렌즈·4 mm 센서: 거리 600 mm에서 300 mm 원판이 정확히 맞음';
  });
  check('판 평행 광선 · 유한 크기 없음',()=>{
    assert(fast({cameraAngle:0,plateMode:'parallel',tiltV:90}).code==='horizon','특이 배치를 감지해야 함');
    return '분모가 원판 내부에서 0이 되는 배치 검출';
  });
  check('일부 역방향 교차 · 배치 불가',()=>{
    assert(fast({cameraAngle:0,plateDistance:10,tiltV:45}).code==='behind','음수 광선 거리를 감지해야 함');
    return '판이 웨이퍼를 가로질러 전방 교차가 불가능한 배치 검출';
  });
  check('면내 회전 · 가로와 세로 교환',()=>{
    const a=fast({tiltU:15,tiltV:-12,roll:0}),b=fast({tiltU:15,tiltV:-12,roll:90});
    near(a.minimum.width,b.minimum.height); near(a.minimum.height,b.minimum.width);
    return '같은 평면에서 90° 회전 시 치수 교환';
  });
  check('치수·위치·여유의 확대 일관성',()=>{
    const a=fast({}),b=fast({diameter:600,cameraDistance:1300,plateDistance:800,margin:10});
    near(b.required.width,2*a.required.width);near(b.required.height,2*a.required.height);
    near(b.fov.x[0],a.fov.x[0]);
    return '공간 치수 2배 → 필요 판 2배, 센서 투영은 동일';
  });
  check('고정 중심 · 편심에 필요한 크기',()=>{
    const s=fast({cameraAngle:0,cameraDistance:600,plateDistance:300,plateMode:'parallel',margin:5,centerMode:'fixed',offsetU:40,offsetV:-20});
    near(s.required.width,540);near(s.required.height,500);
    return '450 mm 반사 영역 + 중심 편심 + 양쪽 여유 검증';
  });
  check('카메라 시선 가림 검출',()=>{
    const s=solve({cameraAngle:0,cameraDistance:600,plateDistance:250,actualWidth:600,actualHeight:600},{samples:128,boundary:0});
    near(s.coverage.blocked,1);return '카메라와 웨이퍼 사이의 정면판은 시선 100% 가림';
  });
  check('불완전 입력·특이 경계 방어',()=>{
    assert(solve({cameraDistance:NaN}).code==='input','NaN 입력 검출');
    assert(solve({sensorWidth:0}).code==='input','0 센서 검출');
    assert(diskRange(1,[1,0],1,[1,0],1)===null,'접하는 특이점 검출');
    return '유효하지 않은 입력에 치수 결과를 표시하지 않음';
  });
  return rows;
}
