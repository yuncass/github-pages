import {add,sub,mul,rectangle,solve} from './geometry.mjs';
const svgNS='http://www.w3.org/2000/svg';
const ink='#526650', green='#127765', orange='#ba7b3f', purple='#9b91b4', blue='#6d91b0';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(x,y,s,size=11,color=ink,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-family="Segoe UI,Malgun Gothic,sans-serif">${escape(s)}</text>`;
const line=(x,y,xx,yy,color='#e6ece0',dash='')=>`<line x1="${x}" y1="${y}" x2="${xx}" y2="${yy}" stroke="${color}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const path=(points,close=true)=>points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ')+(close?'Z':'');
const tick=v=>Math.abs(v)>=10000?(v/1000).toFixed(1)+'k':Math.abs(v)>=100?v.toFixed(0):Math.abs(v)>=10?v.toFixed(1):v.toFixed(2);
function blank(svg,message){svg.innerHTML=text((svg.viewBox.baseVal.width||840)/2,204,message,12,'#8c7763');}

export function drawPlate(svg,s,factor,unitName){
  const narrow=svg.closest('.scene-panel').clientWidth<550,W=narrow?420:840,cxPlot=W/2;
  svg.setAttribute('viewBox',`0 0 ${W} 430`);
  if(!s.valid){blank(svg,'유효한 전방 교차가 있을 때 판 도면이 표시됩니다.');return;}
  const c=s.required.center,p=s.p, w=p.actualWidth,h=p.actualHeight;
  const left=Math.min(c[0]-w/2,s.range.u[0]-p.margin),right=Math.max(c[0]+w/2,s.range.u[1]+p.margin);
  const bottom=Math.min(c[1]-h/2,s.range.v[0]-p.margin),top=Math.max(c[1]+h/2,s.range.v[1]+p.margin);
  const scale=Math.min((W-(narrow?105:180))/(right-left||1),285/(top-bottom||1)), mx=(left+right)/2,my=(bottom+top)/2;
  const xy=(u,v)=>[cxPlot+(u-mx)*scale,216-(v-my)*scale];
  let out='';
  for(let i=0;i<=8;i++){
    const u=left+(right-left)*i/8,v=bottom+(top-bottom)*i/8;
    const [x]=xy(u,0),[,y]=xy(0,v);out+=line(x,48,x,363)+line(narrow?47:75,y,W-(narrow?35:75),y);
    if(i%2===0){out+=text(x,385,tick(u/factor),narrow?11:9,'#8d9b81');out+=text(narrow?41:67,y+3,tick(v/factor),narrow?11:9,'#8d9b81','end');}
  }
  const box=(width,height,color,fill,dash='')=>{
    const [x,y]=xy(c[0]-width/2,c[1]+height/2);
    return `<rect x="${x}" y="${y}" width="${width*scale}" height="${height*scale}" fill="${fill}" stroke="${color}" stroke-width="1.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  };
  out+=box(w,h,purple,'#eeeaf466');
  out+=`<path d="${path(s.footprint.map(h=>xy(h.u,h.v)))}" fill="#e4ae6345" stroke="${orange}" stroke-width="1.8"/>`;
  out+=box(s.required.width,s.required.height,green,'none','6 4');
  const [ox,oy]=xy(0,0),[cx,cy]=xy(...c);
  if(ox>40&&ox<W-40&&oy>40&&oy<370)out+=line(ox-6,oy,ox+6,oy,'#7d8d74')+line(ox,oy-6,ox,oy+6,'#7d8d74');
  out+=`<circle cx="${cx}" cy="${cy}" r="3" fill="${green}"/>`;
  const digits=unitName==='in'?3:unitName==='cm'?2:1;
  const dimension=value=>(Math.ceil(value/factor*10**digits-1e-10)/10**digits).toFixed(digits);
  out+=text(cxPlot,28,`필요 크기 ${dimension(s.required.width)} × ${dimension(s.required.height)} ${unitName}`,narrow?15:13,green);
  out+=text(narrow?30:W-58,narrow?43:216,`V (${unitName})`,10,ink)+text(W-62,402,`U (${unitName})`,11,ink);
  svg.innerHTML=out;
}

export function drawSensor(svg,s){
  const narrow=svg.closest('.scene-panel').clientWidth<550,W=narrow?420:840,cxPlot=W/2;
  svg.setAttribute('viewBox',`0 0 ${W} 430`);
  if(!s.frame || !s.fov.allInFront){blank(svg,'일부 웨이퍼가 카메라 뒤쪽에 있어 완전한 투영을 표시할 수 없습니다.');return;}
  const p=s.p,valid=s.sensorOutline.filter(Boolean);
  const maxX=Math.max(p.sensorWidth/2,...valid.map(q=>Math.abs(q[0]))),maxY=Math.max(p.sensorHeight/2,...valid.map(q=>Math.abs(q[1])));
  const scale=Math.min((W-100)/(2*maxX),275/(2*maxY)),xy=(x,y)=>[cxPlot+x*scale,216-y*scale];
  const width=p.sensorWidth*scale,height=p.sensorHeight*scale;
  let out='';
  for(let i=0;i<=10;i++){const x=40+i*(W-80)/10;out+=line(x,60,x,358)+line(40,60+i*29.8,W-40,60+i*29.8);}
  out+=`<rect x="${cxPlot-width/2}" y="${216-height/2}" width="${width}" height="${height}" rx="1" fill="#e5edf566" stroke="${blue}" stroke-width="1.6"/>`;
  out+=`<path d="${path(valid.map(q=>xy(...q)))}" fill="${s.fov.all?'#b9d9c588':'#edbaa966'}" stroke="${s.fov.all?green:'#b95042'}" stroke-width="1.8"/>`;
  out+=line(cxPlot-9,216,cxPlot+9,216,'#97a89a')+line(cxPlot,207,cxPlot,225,'#97a89a');
  out+=text(cxPlot,30,`센서 ${p.sensorWidth.toFixed(4)} × ${p.sensorHeight.toFixed(4)} mm`,narrow?15:13,ink);
  out+=text(cxPlot,390,s.fov.all?'웨이퍼 전체가 센서 안에 들어옵니다.':'웨이퍼가 센서 경계를 벗어납니다.',narrow?14:12,s.fov.all?green:'#b95042');
  out+=text(W-45,352,'센서 +X →',11,blue,'end')+text(45,73,'+Y ↑',11,blue,'start');
  svg.innerHTML=out;
}

export function drawTrend(svg,p,factor,unitName){
  const distances=Array.from({length:41},(_,i)=>Math.max(.1,p.plateDistance*(.25+1.75*i/40)));
  const data=distances.map(d=>{const s=solve({...p,plateDistance:d},{samples:0,boundary:0});return s.valid?{x:d,w:s.required.width,h:s.required.height}:null;});
  const heights=data.filter(Boolean).flatMap(d=>[d.w,d.h]);
  if(!heights.length){svg.innerHTML=text(245,110,'이 거리 구간에서 유효한 배치가 없습니다.',12,'#8c7763');return;}
  const max=Math.max(...heights)*1.12,minX=distances[0],maxX=distances.at(-1),x=d=>54+(d-minX)/(maxX-minX)*410,y=d=>188-d/max*155;
  let out='';
  for(let i=0;i<=4;i++){
    const value=max*i/4,Y=y(value);out+=line(54,Y,464,Y)+text(47,Y+3,tick(value/factor),9,'#97a38d','end');
    const d=minX+(maxX-minX)*i/4,X=x(d);out+=text(X,206,tick(d/factor),9,'#97a38d');
  }
  for(const [key,color] of [['w',green],['h',orange]]){
    let d='',gap=true;
    for(const row of data){if(!row){gap=true;continue;}d+=`${gap?'M':'L'}${x(row.x)},${y(row[key])} `;gap=false;}
    out+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
    const current=solve(p,{samples:0,boundary:0});
    if(current.valid){out+=line(x(p.plateDistance),30,x(p.plateDistance),188,'#ccd8c2','3 4');out+=`<circle cx="${x(p.plateDistance)}" cy="${y(current.required[key==='w'?'width':'height'])}" r="4" fill="${color}" stroke="white" stroke-width="1.5"/>`;}
  }
  out+=text(54,18,`판 크기 (${unitName})`,9,'#8b9a80','start');
  out+=text(464,225,`${p.distanceMode==='ray'?'중심축 거리':'수직 높이'} (${unitName})`,9,'#8b9a80','end');
  svg.innerHTML=out;
}

export class Scene {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.yaw=-.37;this.elevation=.42;this.zoom=1;this.result=null;
    let drag=null;
    canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY,this.yaw,this.elevation];canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;this.yaw=drag[2]+(e.clientX-drag[0])*.008;this.elevation=Math.min(1.55,Math.max(-.8,drag[3]+(e.clientY-drag[1])*.006));this.draw();});
    canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoomBy(e.deltaY<0?1.1:1/1.1);},{passive:false});
    canvas.addEventListener('keydown',e=>{
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'];if(!keys.includes(e.key))return;e.preventDefault();
      if(e.key==='ArrowLeft')this.yaw-=.12;if(e.key==='ArrowRight')this.yaw+=.12;
      if(e.key==='ArrowUp')this.elevation=Math.min(1.55,this.elevation+.08);if(e.key==='ArrowDown')this.elevation=Math.max(-.8,this.elevation-.08);
      if(e.key==='+'||e.key==='=')this.zoomBy(1.1);if(e.key==='-')this.zoomBy(1/1.1);if(e.key==='Home')this.view('home');this.draw();
    });
    this.resizeObserver=new ResizeObserver(()=>this.draw());this.resizeObserver.observe(canvas);
  }
  set(s,factor,unitName){this.result=s;this.factor=factor;this.unitName=unitName;this.draw();}
  zoomBy(n){this.zoom=Math.max(.4,Math.min(4,this.zoom*n));this.draw();}
  view(mode){this.zoom=1;const phi=(this.result?.p?.azimuth||0)*Math.PI/180;this.yaw=mode==='home'?-.37-phi:-phi;this.elevation=mode==='top'?Math.PI/2:mode==='side'?0:.42;this.draw();}
  draw(){
    const ctx=this.ctx,s=this.result,rect=this.canvas.getBoundingClientRect();if(!ctx||!s||rect.width<1||rect.height<1)return;
    const W=rect.width,H=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);
    if(this.canvas.width!==Math.round(W*dpr)||this.canvas.height!==Math.round(H*dpr)){this.canvas.width=Math.round(W*dpr);this.canvas.height=Math.round(H*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    if(!s.frame){ctx.fillStyle='#8c7763';ctx.textAlign='center';ctx.font='13px Segoe UI';ctx.fillText('유효한 입력값을 확인해 주세요.',W/2,H/2);return;}
    const {C,A,u,v}=s.frame,R=s.p.diameter/2;
    const actual=s.valid?rectangle(s.frame,s.required.center,s.p.actualWidth,s.p.actualHeight):rectangle(s.frame,[0,0],s.p.actualWidth,s.p.actualHeight);
    const needed=s.valid?rectangle(s.frame,s.required.center,s.required.width,s.required.height):[];
    const ca=Math.cos(this.yaw),sa=Math.sin(this.yaw),ce=Math.cos(this.elevation),se=Math.sin(this.elevation);
    const project=P=>[ca*P[0]-sa*P[1],se*(sa*P[0]+ca*P[1])-ce*P[2]];
    const all=[...s.wafer,...actual,...needed,C,[0,0,0]], raw=all.map(project);
    let x0=Math.min(...raw.map(p=>p[0])),x1=Math.max(...raw.map(p=>p[0])),y0=Math.min(...raw.map(p=>p[1])),y1=Math.max(...raw.map(p=>p[1]));
    const sc=Math.min((W-135)/Math.max(x1-x0,100),(H-125)/Math.max(y1-y0,100))*this.zoom;
    const mx=(x0+x1)/2,my=(y0+y1)/2,xy=P=>{const q=project(P);return [W/2+(q[0]-mx)*sc,H/2+8+(q[1]-my)*sc];};
    const drawPath=(points,color,width=1,fill=null,close=false,dash=[])=>{
      if(!points.length)return;ctx.beginPath();points.forEach((p,i)=>{const q=xy(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});
      if(close)ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
    };
    const circle=(P,r,color)=>{ctx.beginPath();ctx.arc(...xy(P),r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
    const label=(P,title,subtitle,color,offset=[0,0])=>{
      const [X,Y]=xy(P),x=X+offset[0],y=Y+offset[1];ctx.font='600 11px Segoe UI,Malgun Gothic,sans-serif';
      const width=Math.max(ctx.measureText(title).width,subtitle?subtitle.length*5.5:0)+20;
      const xx=Math.min(W-width-6,Math.max(6,x-width/2)),yy=Math.max(38,Math.min(H-72,y));
      ctx.fillStyle='#fffffff0';ctx.strokeStyle='#e2e8db';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(xx,yy,width,subtitle?42:27,6);ctx.fill();ctx.stroke();
      ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(title,xx+width/2,yy+17);
      if(subtitle){ctx.font='9px Segoe UI,Malgun Gothic,sans-serif';ctx.fillStyle='#8a9782';ctx.fillText(subtitle,xx+width/2,yy+32);}
    };
    // Reference floor, centered on the wafer.
    const g=R*1.65;
    for(let i=-5;i<=5;i++){const a=i*g/5;drawPath([[-g,a,0],[g,a,0]],'#e4eadd',.7);drawPath([[a,-g,0],[a,g,0]],'#e4eadd',.7);}
    drawPath([[0,0,0],[0,0,Math.min(C[2],s.frame.height)*.5]],'#b4c4b0',1,null,false,[4,5]);
    drawPath(actual,purple,1.25,'#c7bfd33a',true);
    if(s.valid){
      for(let i=0;i<s.wafer.length;i+=20){const P=s.wafer[i],Q=s.footprint[i]?.Q;if(!Q)continue;drawPath([C,P],'#809db847',.8);drawPath([P,Q],'#c7864875',1);}
      drawPath(s.footprint.map(h=>h.Q),orange,1.5,'#ddb17b24',true);
      drawPath(needed,green,1.4,null,true,[5,4]);
    }
    drawPath(s.wafer,'#668c72',1.6,'#e6eee3d9',true);
    const inner=s.wafer.map(p=>mul(p,.88));drawPath(inner,'#b9cbb2',.8,null,true);
    // Wafer radial guides and the center optical ray.
    drawPath([[-R,0,0],[R,0,0]],'#bdcbb4',.7,null,false,[3,4]);drawPath([[0,-R,0],[0,R,0]],'#bdcbb4',.7,null,false,[3,4]);
    drawPath([C,[0,0,0]],blue,1.5,null,false,[5,4]);drawPath([[0,0,0],A],orange,1.5,null,false,[5,4]);
    circle([0,0,0],3,green);circle(A,3,orange);
    const axisSize=R*.32;
    drawPath([A,add(A,mul(u,axisSize))],green,1.8);drawPath([A,add(A,mul(v,axisSize))],green,1.8);
    ctx.font='10px Segoe UI';ctx.textAlign='left';ctx.fillStyle=green;
    let q=xy(add(A,mul(u,axisSize*1.2)));ctx.fillText('U',...q);q=xy(add(A,mul(v,axisSize*1.2)));ctx.fillText('V',...q);
    // Camera body and aperture, schematically centered at the optical center C.
    const cu=s.frame.cameraU,cv=s.frame.cameraV,back=mul(s.frame.forward,-1),size=R*.13;
    const camBox=depth=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add(add(C,mul(back,depth)),add(mul(cu,x*size),mul(cv,y*size))));
    const front=camBox(size*.5),rear=camBox(size*2.5);
    drawPath(rear,'#6282a0',1,'#d4e0eb',true);
    for(let i=0;i<4;i++)drawPath([front[i],rear[i]],'#6282a0',1);
    drawPath(front,'#506f8d',1.2,'#c1d2e2',true);
    const lens=Array.from({length:28},(_,i)=>add(C,add(mul(cu,Math.cos(i*2*Math.PI/28)*size*.62),mul(cv,Math.sin(i*2*Math.PI/28)*size*.62))));
    drawPath(lens,'#567691',1,'#58768b',true);circle(C,2.3,'#e4eef5');
    label(C,'카메라',`${tick(s.p.cameraDistance/this.factor)} ${this.unitName} · ${s.p.cameraAngle}°`,blue,[8,-69]);
    label(actual[3],'흡수판',`${tick(s.p.actualWidth/this.factor)} × ${tick(s.p.actualHeight/this.factor)} ${this.unitName}`,'#827794',[-5,-53]);
    label([0,-R,0],'웨이퍼',`Ø ${tick(s.p.diameter/this.factor)} ${this.unitName}`,green,[0,18]);
    if(!s.valid){ctx.fillStyle='#ad6650';ctx.textAlign='center';ctx.font='12px Segoe UI,Malgun Gothic';ctx.fillText('전체 반사 영역을 만들 수 없는 배치입니다.',W/2,H-28);}
    // Small world-axis triad, independent of the zoomed scene.
    const origin=[36,H-38];ctx.font='9px Segoe UI';ctx.textAlign='center';
    for(const [P,name,color] of [[[1,0,0],'X','#aa8562'],[[0,1,0],'Y','#819a69'],[[0,0,1],'Z','#7391a5']]){
      const end=project(P);ctx.beginPath();ctx.moveTo(...origin);ctx.lineTo(origin[0]+end[0]*23,origin[1]+end[1]*23);ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle=color;ctx.fillText(name,origin[0]+end[0]*31,origin[1]+end[1]*31+3);
    }
  }
}
