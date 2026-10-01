import {DEFAULTS,PRESETS,LIMITS,validate,solve} from './geometry.mjs';
import {Scene,drawPlate,drawSensor,drawTrend} from './render.mjs';
import {runChecks} from './validation.mjs';

const $=id=>document.getElementById(id);
const UNITS={mm:{factor:1,name:'mm',digits:1},cm:{factor:10,name:'cm',digits:2},in:{factor:25.4,name:'in',digits:3}};
const LENGTHS=new Set(['diameter','cameraDistance','plateDistance','offsetU','offsetV','margin','actualWidth','actualHeight']);
const STORAGE='wafer-optics-v1',PRESET_STORAGE='wafer-optics-presets-v1';
const fields={
  diameter:['웨이퍼 지름','camera',null],cameraDistance:['카메라 거리','camera',[150,2000,5]],cameraAngle:['관측각 θ','camera',[0,85,1]],
  focalLength:['렌즈 초점거리','optical',null],sensorWidth:['센서 가로','optical',null],sensorHeight:['센서 세로','optical',null],
  azimuth:['방위각 φ','optical',[-180,180,1]],cameraRoll:['카메라 롤','optical',[-180,180,1]],
  plateDistance:['흡수판 거리','plate',[20,1500,5]],tiltU:['기울기 U','pose',[-85,85,1]],tiltV:['기울기 V','pose',[-85,85,1]],roll:['면내 회전','pose',[-180,180,1]],
  offsetU:['중심 위치 U','offset',null],offsetV:['중심 위치 V','offset',null],margin:['변마다 추가 여유','size',null],actualWidth:['실제 판 가로 U','size',null],actualHeight:['실제 판 세로 V','size',null]
};
let params={...DEFAULTS},unitKey='mm',activePreset='standard',current,framePending=false,storedPresets=[],storageAvailable=true;
const invalidDraft=new Set();
const labels=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v[0]]));
function feedback(message){$('feedback').textContent=message;}
function readConfig(data){
  if(!data||data.version!==1||!data.inputs||!UNITS[data.unit])throw new Error('설정 형식');
  const next=Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,data.inputs[key]]));
  if(validate(next).length)throw new Error('입력 범위');
  return {inputs:next,unit:data.unit};
}
function config(){return {version:1,inputs:{...params},unit:unitKey};}
try{
  const stored=localStorage.getItem(STORAGE);
  if(stored){const data=readConfig(JSON.parse(stored));params=data.inputs;unitKey=data.unit;activePreset=null;}
  const presets=JSON.parse(localStorage.getItem(PRESET_STORAGE)||'[]');
  if(Array.isArray(presets))storedPresets=presets.slice(0,20).filter(row=>{try{readConfig(row.config);return typeof row.name==='string';}catch{return false;}});
}catch{storageAvailable=false;}
if(location.hash.startsWith('#config=')){
  try{const data=readConfig(JSON.parse(decodeURIComponent(location.hash.slice(8))));params=data.inputs;unitKey=data.unit;activePreset=null;}
  catch{feedback('배치 링크의 설정이 유효하지 않아 기본/저장 설정을 사용합니다.');}
}
function numeric(value){return String(Number(value.toFixed(7)));}
function renderControls(){
  for(const [key,[label,group,slider]] of Object.entries(fields)){
    const wrapper=document.createElement('div');wrapper.className='field';
    const head=document.createElement('div');head.className='field-head';
    const lab=document.createElement('label');lab.htmlFor=key;lab.textContent=label;
    const wrap=document.createElement('div');wrap.className='input-wrap';
    const input=document.createElement('input');input.id=key;input.type='number';input.dataset.numberParam=key;input.step='any';input.inputMode='decimal';
    const unit=document.createElement('span');unit.className='input-unit';unit.id=`${key}-unit`;input.setAttribute('aria-describedby',unit.id);
    wrap.append(input,unit);head.append(lab,wrap);wrapper.append(head);
    if(slider){
      const range=document.createElement('input');range.type='range';range.dataset.rangeParam=key;range.id=`${key}-range`;range.setAttribute('aria-label',`${label} 슬라이더`);
      const ticks=document.createElement('div');ticks.className='field-ticks';ticks.id=`${key}-ticks`;
      wrapper.append(range,ticks);
    }
    $(`${group}-fields`).append(wrapper);
  }
  for(const [key,preset] of Object.entries(PRESETS)){
    const button=document.createElement('button');button.dataset.preset=key;button.textContent=preset.name;
    button.addEventListener('click',()=>{
      const optics=Object.fromEntries(['focalLength','sensorWidth','sensorHeight','diameter'].map(k=>[k,Number.isFinite(params[k])?params[k]:DEFAULTS[k]]));
      params={...DEFAULTS,...optics,...preset.values};activePreset=key;invalidDraft.clear();syncControls();calculate();
    });$('presets').append(button);
  }
  syncControls();renderSavedPresets();
}
function syncControls(){
  const unit=UNITS[unitKey];$('unit').value=unitKey;
  for(const [key,[, ,slider]] of Object.entries(fields)){
    const factor=LENGTHS.has(key)?unit.factor:1,element=$(key);
    element.value=numeric(params[key]/factor);element.min=numeric(LIMITS[key][0]/factor);element.max=numeric(LIMITS[key][1]/factor);
    element.setAttribute('aria-invalid','false');
    $(`${key}-unit`).textContent=LENGTHS.has(key)?unit.name:['focalLength','sensorWidth','sensorHeight'].includes(key)?'mm':'°';
    if(slider)syncSlider(key);
  }
  document.querySelectorAll('[data-param]').forEach(el=>el.value=params[el.dataset.param]);
  $('offset-fields').hidden=params.centerMode!=='fixed';
  document.querySelectorAll('[data-preset]').forEach(el=>{el.classList.toggle('active',el.dataset.preset===activePreset);el.setAttribute('aria-pressed',String(el.dataset.preset===activePreset));});
}
function syncSlider(key){
  const [lo,hi,step]=fields[key][2],factor=LENGTHS.has(key)?UNITS[unitKey].factor:1,el=$(`${key}-range`),value=params[key];
  const a=Math.min(lo,Number.isFinite(value)?value:lo),b=Math.max(hi,Number.isFinite(value)?value:hi);
  el.min=numeric(a/factor);el.max=numeric(b/factor);el.step=numeric(step/factor);el.value=numeric(value/factor);
  $(`${key}-ticks`).textContent=`${numeric(a/factor)} — ${numeric(b/factor)} ${LENGTHS.has(key)?UNITS[unitKey].name:'°'}`;
}
function renderSavedPresets(){
  $('saved-presets').replaceChildren(new Option('저장된 배치 선택',''));
  storedPresets.forEach((row,i)=>$('saved-presets').add(new Option(row.name,String(i))));
}
function saveState(){
  if(validate(params).length||invalidDraft.size)return;
  try{localStorage.setItem(STORAGE,JSON.stringify(config()));storageAvailable=true;}catch{storageAvailable=false;}
  $('storage-status').textContent=storageAvailable?'입력은 이 브라우저에 자동 저장됩니다.':'브라우저 저장을 사용할 수 없습니다. JSON 또는 링크로 보관하세요.';
  if(location.hash.startsWith('#config=')){try{history.replaceState(null,'',`#config=${encodeURIComponent(JSON.stringify(config()))}`);}catch{}}
}
const scene=new Scene($('scene'));
function measure(v,{up=false}={}){
  const u=UNITS[unitKey],n=v/u.factor,k=10**u.digits;
  return (up?Math.ceil(n*k-1e-10)/k:n).toLocaleString('en-US',{minimumFractionDigits:u.digits,maximumFractionDigits:u.digits});
}
function percent(r){return (100*r).toFixed(1)+'%';}
function setState(id,value,kind=''){const el=$(id);el.textContent=value;el.classList.remove('warning','bad');if(kind)el.classList.add(kind);}
function addAlert(message,error=false){const d=document.createElement('div');d.className='alert'+(error?' error':'');d.textContent=message;$('alerts').append(d);}
function detail(label,value){const d=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;d.append(dt,dd);$('details-list').append(d);}
function calculate(){
  const errors=[...new Set([...validate(params),...invalidDraft])];
  current=errors.length?{valid:false,code:'input',errors}:solve(params);
  const s=current,u=UNITS[unitKey];$('alerts').replaceChildren();$('details-list').replaceChildren();
  for(const key of Object.keys(fields))$(key).setAttribute('aria-invalid',String(errors.includes(key)));
  $('result-unit').textContent=u.name;$('wafer-badge').textContent=`Ø ${Number.isFinite(params.diameter)?measure(params.diameter):'—'} ${u.name} WAFER`;
  $('width-result').textContent=s.valid?measure(s.required.width,{up:true}):'—';$('height-result').textContent=s.valid?measure(s.required.height,{up:true}):'—';
  $('size-caption').textContent=s.valid?`U × V · 변마다 여유 ${measure(params.margin)} ${u.name} · ${numeric(10**-u.digits)} ${u.name} 단위 올림`:'유효한 배치를 입력하면 크기가 표시됩니다.';
  if(s.code==='input'){
    addAlert(`입력값을 확인해 주세요: ${errors.map(k=>labels[k]||k).join(', ')}. 각 값은 표시된 단위의 허용 범위 안에 있어야 합니다.`,true);
    setState('plate-status','입력 확인','bad');setState('fov-status','입력 확인','bad');$('plate-caption').textContent='유효한 수치가 필요합니다.';$('fov-caption').textContent='유효한 수치가 필요합니다.';
    $('geometry-status').textContent='입력 오류로 계산이 중지되었습니다.';$('sampling-status').textContent='';
    $('sensor-svg').replaceChildren();$('trend-svg').replaceChildren();
  }else{
    if(s.code==='horizon')addAlert('일부 반사광이 판과 평행해집니다. 반사 영역이 발산하므로 유한한 판 크기를 구할 수 없습니다. 판 기울기를 조절하세요.',true);
    if(s.code==='behind')addAlert('일부 광선은 웨이퍼에서 반사된 뒤 판에 도달하지 않습니다. 판이 웨이퍼를 가로지르거나 뒤쪽에 있는 배치입니다. 판 거리·기울기를 조절하세요.',true);
    if(!s.fov.all)addAlert('웨이퍼 전체가 카메라 시야에 들어오지 않습니다. 카메라 거리를 늘리거나 렌즈·센서 설정을 확인하세요. 판 크기는 시야 밖을 포함한 웨이퍼 전체로 계산합니다.');
    setState('fov-status',s.fov.all?'전체 관측':'일부 벗어남',s.fov.all?'':'warning');
    $('fov-caption').textContent=`시야각 ${s.fov.angleH.toFixed(1)}° × ${s.fov.angleV.toFixed(1)}° · 핀홀 기준`;
    if(s.valid){
      setState('plate-status',s.coverage.all?'전체 포함':'일부 미포함',s.coverage.all?'':'warning');
      $('plate-caption').textContent=s.coverage.all?(s.coverage.withMargin?'설정한 여유까지 확보':'반사 영역 포함 · 여유 부족'):`면적 약 ${percent(s.coverage.sampled)} · 경계 일부 이탈`;
      if(!s.coverage.all)addAlert('입력한 실제 판이 반사 영역 일부를 놓칩니다. 계산된 필요 크기를 적용하거나 판 위치를 조정하세요.');
      else if(!s.coverage.withMargin)addAlert('실제 판이 반사 영역은 포함하지만 설정한 가장자리 여유를 모두 확보하지 못합니다.');
      if(s.coverage.blocked>0)addAlert(`현재 실제 판이 카메라와 웨이퍼 사이의 시선을 가릴 수 있습니다. 가림 면적 약 ${percent(s.coverage.blocked)} (표본 추정). 관측각이나 판 배치를 조정하세요.`);
      if(s.nearHorizon)addAlert('일부 반사광이 판에 거의 평행합니다. 크기가 배치 오차에 매우 민감하므로 판 자세와 여유를 확인하세요.');
      const unit=` ${u.name}`,center=s.required.center;
      detail('최소 크기 · 여유 없음',`${measure(s.minimum.width)} × ${measure(s.minimum.height)}${unit}`);
      detail('적용한 중심 U, V',`${measure(center[0])}, ${measure(center[1])}${unit}`);
      detail('판 중심 X, Y, Z',s.required.world.map(v=>measure(v)).join(', ')+unit);
      detail('기준점 높이 / 중심축 거리',`${measure(s.frame.height)} / ${measure(s.frame.rayDistance)}${unit}`);
      detail('실제 판 포함 면적 · 추정',`${percent(s.coverage.sampled)} (${s.sampleCount.toLocaleString()}개 표본)`);
      detail('카메라 시선 가림 · 추정',s.coverage.blocked>0?percent(s.coverage.blocked):'표본에서 감지되지 않음');
      $('geometry-status').textContent='전체 원판의 반사광이 판 평면과 전방에서 교차합니다.';
    }else{
      setState('plate-status','배치 불가','bad');$('plate-caption').textContent='거리 또는 판 기울기를 조절하세요.';
      $('geometry-status').textContent='현재 배치에서는 유한한 판 크기로 전체 반사광을 받을 수 없습니다.';
      detail('배치 상태',s.code==='horizon'?'평행 광선 / 발산':'일부 전방 교차 없음');
    }
    detail('센서에 보이는 면적 · 추정',percent(s.fov.sampled));
    $('sampling-status').textContent='전체 판정: 해석적 경계 · 면적: 2,048개 표본';
    drawSensor($('sensor-svg'),s);drawTrend($('trend-svg'),params,u.factor,u.name);
  }
  $('minimum-note').textContent='최소 크기: 현재 판 축 U·V에서 중심을 자유롭게 옮길 때의 값. 중심 좌표는 반사 중심축 위 기준점 A에서 잰 판 위 좌표입니다.';
  $('apply-size').disabled=!s.valid;$('export-csv').disabled=!s.valid;$('export-json').disabled=s.code==='input';$('share').disabled=s.code==='input';$('save-preset').disabled=s.code==='input';
  drawPlate($('plate-svg'),s,u.factor,u.name);scene.set(s,u.factor,u.name);
  document.documentElement.dataset.calculationState=s.code;saveState();
}
function schedule(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;calculate();});}
function deactivatePreset(){activePreset=null;document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});}
renderControls();
document.querySelectorAll('[data-number-param]').forEach(el=>el.addEventListener('input',()=>{
  const key=el.dataset.numberParam,raw=el.value.trim(),value=Number(raw),factor=LENGTHS.has(key)?UNITS[unitKey].factor:1;
  if(!raw||!Number.isFinite(value)){invalidDraft.add(key);params[key]=NaN;}else{invalidDraft.delete(key);params[key]=value*factor;}
  if(fields[key][2]&&Number.isFinite(params[key]))syncSlider(key);deactivatePreset();schedule();
}));
document.querySelectorAll('[data-range-param]').forEach(el=>el.addEventListener('input',()=>{
  const key=el.dataset.rangeParam;params[key]=Number(el.value)*(LENGTHS.has(key)?UNITS[unitKey].factor:1);invalidDraft.delete(key);$(key).value=el.value;deactivatePreset();schedule();
}));
document.querySelectorAll('[data-param]').forEach(el=>el.addEventListener('change',()=>{params[el.dataset.param]=el.value;$('offset-fields').hidden=params.centerMode!=='fixed';deactivatePreset();calculate();}));
$('unit').addEventListener('change',()=>{unitKey=$('unit').value;syncControls();calculate();});
$('reset').addEventListener('click',()=>{params={...DEFAULTS};unitKey='mm';activePreset='standard';invalidDraft.clear();syncControls();calculate();scene.view('home');feedback('기본 카메라와 배치로 초기화했습니다.');});
$('restore-sensor').addEventListener('click',()=>{params.sensorWidth=DEFAULTS.sensorWidth;params.sensorHeight=DEFAULTS.sensorHeight;invalidDraft.delete('sensorWidth');invalidDraft.delete('sensorHeight');syncControls();calculate();});
$('apply-size').addEventListener('click',()=>{
  if(!current.valid)return;params.actualWidth=Math.ceil(current.required.width*10)/10;params.actualHeight=Math.ceil(current.required.height*10)/10;
  syncControls();calculate();feedback('0.1 mm 단위로 올림한 필요 크기를 적용했습니다.');
});
function selectView(name){
  document.querySelectorAll('[data-view]').forEach(el=>{const selected=el.dataset.view===name;el.setAttribute('aria-selected',String(selected));el.tabIndex=selected?0:-1;$(`view-${el.dataset.view}`).hidden=!selected;});
  const u=UNITS[unitKey];drawPlate($('plate-svg'),current,u.factor,u.name);if(current.frame)drawSensor($('sensor-svg'),current);scene.draw();
}
window.addEventListener('resize',()=>{const u=UNITS[unitKey];if(!current)return;drawPlate($('plate-svg'),current,u.factor,u.name);if(current.frame)drawSensor($('sensor-svg'),current);});
document.querySelectorAll('[data-view]').forEach(el=>{
  el.addEventListener('click',()=>selectView(el.dataset.view));
  el.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const names=['scene','plate','sensor'],i=names.indexOf(el.dataset.view),n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;selectView(names[n]);$(`tab-${names[n]}`).focus();});
});
for(const name of ['home','side','top'])$(`view-${name}`).addEventListener('click',()=>scene.view(name));
$('zoom-in').addEventListener('click',()=>scene.zoomBy(1.2));$('zoom-out').addEventListener('click',()=>scene.zoomBy(1/1.2));
$('save-preset').addEventListener('click',()=>{
  const name=$('preset-name').value.trim()||`배치 ${storedPresets.length+1}`;
  if(storedPresets.length>=20){feedback('배치는 20개까지 저장할 수 있습니다. 현재 설정은 JSON으로 내려받으세요.');return;}
  const next=[...storedPresets,{name:name.trim().slice(0,80),config:config()}];
  try{localStorage.setItem(PRESET_STORAGE,JSON.stringify(next));storedPresets=next;renderSavedPresets();$('preset-name').value='';feedback('현재 배치를 이 브라우저에 저장했습니다.');}
  catch{feedback('브라우저 저장이 제한되어 있습니다. JSON 또는 링크로 보관하세요.');}
});
$('saved-presets').addEventListener('change',()=>{const row=storedPresets[Number($('saved-presets').value)];if($('saved-presets').value===''||!row)return;const data=readConfig(row.config);params={...data.inputs};unitKey=data.unit;activePreset=null;invalidDraft.clear();syncControls();calculate();feedback(`불러온 배치: ${row.name}`);});
$('run-validation').addEventListener('click',()=>{
  const rows=runChecks(),container=$('validation-results');container.replaceChildren();container.hidden=false;
  const summary=document.createElement('strong'),passed=rows.filter(r=>r.passed).length;summary.textContent=`${passed} / ${rows.length} 검증 통과`;
  container.append(summary);for(const row of rows){const d=document.createElement('div');d.className='check-row'+(row.passed?'':' failed');d.title=row.detail;const name=document.createElement('span'),result=document.createElement('span');name.textContent=row.name;result.textContent=row.passed?'✓ 통과':'실패';d.append(name,result);container.append(d);}
  feedback(passed===rows.length?'계산 검증을 모두 통과했습니다.':'실패한 검증이 있습니다. 결과 사용 전 확인하세요.');
});
function download(filename,body,type){
  const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  let preview=$('export-preview');
  if(!preview){
    const box=document.createElement('details');box.className='export-preview';const summary=document.createElement('summary');summary.textContent='다운로드가 시작되지 않으면 데이터 펼쳐서 복사';
    preview=document.createElement('textarea');preview.id='export-preview';preview.readOnly=true;preview.setAttribute('aria-label','내보내기 데이터');preview.rows=8;
    box.append(summary,preview);$('share-fallback').after(box);
  }
  preview.value=body;preview.setAttribute('aria-label',filename+' 내보내기 데이터');
}
$('export-json').addEventListener('click',()=>{
  const s=current,output={...config(),geometryUnit:'mm',angleUnit:'degree',cameraModel:'HIKROBOT MV-CS050-10GM',model:'planar specular reflection, pinhole camera, fixed plate axes',
    result:{valid:s.valid,status:s.code,minimum:s.minimum??null,required:s.required??null,coverage:s.coverage??null,fov:s.fov??null},
    assumptions:['All dimensional input values are in mm, irrespective of display unit.','Minimum rectangle for the selected plate axes; roll is not globally optimized.','One optical center; lens aperture, distortion, wafer bow and plate thickness excluded.','Area fractions and camera occlusion are estimates from 2048 equal-area disk samples.'],
    cameraSource:'https://www.hikrobotics.com/cn2/source/vision/document/2023/12/6/MV-CS050-10GM%28NPOE%29_20230508.pdf'};
  download('wafer-optics-config.json',JSON.stringify(output,null,2),'application/json;charset=utf-8');feedback('JSON 파일 다운로드를 요청했습니다. 아래에서 데이터도 확인할 수 있습니다.');
});
$('export-csv').addEventListener('click',()=>{
  if(!current.valid)return;const s=solve(params,{samples:0,boundary:720});
  const rows=['boundary_angle_deg,wafer_x_mm,wafer_y_mm,wafer_z_mm,plate_x_mm,plate_y_mm,plate_z_mm,u_from_reference_mm,v_from_reference_mm'];
  s.footprint.forEach((hit,i)=>rows.push([i/2,...s.wafer[i],...hit.Q,hit.u,hit.v].map(v=>v.toFixed(8)).join(',')));
  download('wafer-optics-boundary-mm.csv','\uFEFF'+rows.join('\r\n'),'text/csv;charset=utf-8');feedback('CSV 파일 다운로드를 요청했습니다. 경계 광선 720개, 좌표 단위는 mm입니다.');
});
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.hash=`config=${encodeURIComponent(JSON.stringify(config()))}`;
  try{await navigator.clipboard.writeText(url.href);feedback('현재 배치의 링크를 복사했습니다.');$('share-fallback').hidden=true;}
  catch{$('share-fallback').value=url.href;$('share-fallback').hidden=false;$('share-fallback').focus();$('share-fallback').select();feedback('아래 링크를 복사해 주세요.');}
});
$('toggle-inputs').addEventListener('click',()=>{
  const open=document.body.classList.toggle('mobile-controls-open');$('toggle-inputs').setAttribute('aria-expanded',String(open));$('toggle-inputs').textContent=open?'입력 설정 접기 −':'카메라·흡수판 입력 설정 ＋';
});
calculate();
