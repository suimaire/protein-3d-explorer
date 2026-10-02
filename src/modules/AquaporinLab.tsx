import {useEffect,useMemo,useState} from 'react';
import {Segmented} from '../components/Segmented';
import {AquaporinViewer,type AqpView,type AqpCamera} from '../components/AquaporinViewer';
import {loadAquaporin} from '../protein/aquaporinAssets';
import type {AquaporinModel} from '../protein/aquaporin';
import {CLASS_INFO,CLASS_ORDER,classOf} from '../protein/chemistry';
const initial:AqpView={stage:'tetramer',unit:0,opacity:1,representation:'ribbon',color:'subunit',region:'all',membrane:true,waters:true,paths:true,npa:true,arr:true,clip:false,clipOffset:0,selected:null,particles:true};
const stages=[['tetramer','1 · 전체 4량체'],['subunit','2 · 소단위 하나'],['section','3 · 물 통로 단면'],['selectivity','4 · 선택성 부위']] as const;
const tips={
 tetramer:'가운데 하나의 큰 물 통로일까요? 위에서 돌려 보며 각 소단위에 표시된 네 개의 통로를 찾아보세요.',
 subunit:'소단위 하나를 고른 뒤 나머지 구조를 흐리게 해 보세요. 물 통로가 이 소단위 안을 지납니다.',
 section:'공간 채움의 앞쪽을 잘라 내부를 봅니다. 회전하면 단면 방향도 함께 바뀝니다. 절단 위치를 움직여 통로 벽과 내부를 비교해 보세요.',
 selectivity:'NPA와 ar/R 부위를 번갈아 확대하세요. 국소적인 극성 상호작용 부위와 비극성 부위가 함께 통로를 구성합니다.',
};
export function AquaporinLab(){
 const [model,setModel]=useState<AquaporinModel|null>(null),[error,setError]=useState('');
 const [view,setView]=useState<AqpView>(initial),[camera,setCamera]=useState<AqpCamera>({view:'top',token:0});
 const [playing,setPlaying]=useState(false),[step,setStep]=useState(0),[resetToken,setResetToken]=useState(0),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{let alive=true;loadAquaporin().then(m=>{if(alive)setModel(m);}).catch(e=>{if(alive)setError(String(e));});return()=>{alive=false;};},[]);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>{setReduced(q.matches);if(q.matches)setPlaying(false);};q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
 const change=<K extends keyof AqpView>(key:K,value:AqpView[K])=>setView(v=>({...v,[key]:value}));
 const focus=(v:AqpCamera['view'])=>setCamera(c=>({view:v,token:c.token+1}));
 const stage=(value:AqpView['stage'])=>{setView(v=>({...v,stage:value,opacity:value==='tetramer'?1:.15,representation:value==='section'?'spacefill':'ribbon',clip:value==='section',clipOffset:0,region:'all'}));focus(value==='tetramer'?'top':value==='subunit'?'side':'pore');};
 const reset=()=>{setView({...initial});setPlaying(false);setStep(0);setResetToken(x=>x+1);focus('top');};
 const regionCounts=useMemo(()=>model?{pore:model.regions[view.unit].filter(r=>r.region==='pore').length,lipid:model.regions[view.unit].filter(r=>r.region==='lipid').length}:null,[model,view.unit]);
 if(error)return <p role="alert">{error}</p>;
 if(!model)return <p role="status">AQP1 실험 구조와 4량체의 표면을 준비하고 있습니다…</p>;
 const selected=view.selected===null?null:model.source.residues[view.selected],region=selected?model.regions[view.unit][selected.index]:null;
 return <section className="aquaporin-lab" aria-label="아쿠아포린의 물 통로">
  <div className="panel-heading aqp-heading"><h3>AQP1 · 아쿠아포린의 물 통로</h3><span className="badge">소 (Bos taurus) · 1J4N · X선 2.2 Å</span></div>
  <div className="additions-controls"><Segmented label="통로 탐구 단계" value={view.stage} onChange={stage} options={stages}/><button onClick={reset}>아쿠아포린 전체 초기화</button></div>
  <p className="helix-tip compare-tip">{tips[view.stage]}</p>
  <div className="aqp-grid">
   <section className="viewer-panel" aria-label="AQP1 실험 구조">
    <div className="panel-heading"><h3>소단위 {view.unit+1} 선택</h3><span className="badge">실험 좌표 · Biological assembly 1</span></div>
    <div className="camera-presets"><button onClick={()=>focus('reset')}>시점 초기화</button><button onClick={()=>focus('fit')}>화면에 맞추기</button><button onClick={()=>focus('top')}>위에서 보기</button><button onClick={()=>focus('side')}>옆에서 보기</button><button onClick={()=>focus('pore')}>통로 중심 보기</button></div>
    <AquaporinViewer model={model} view={view} camera={camera} playing={playing} step={step} resetToken={resetToken} onPick={(unit,selected)=>setView(v=>({...v,unit,selected}))}/>
    <div className="viewer-footer"><span>drag 회전 · 휠 확대 · 클릭 선택 · 방향키 회전</span><span>선택: 테두리 + 잔기 이름 · 화면 아래에서 동일하게 선택 가능</span></div>
    <div className="legend aqp-legend" data-testid="aqp-water-legend"><span><i style={{background:'#2087aa'}}/>● 원본의 물 산소 (HOH 301–304 / 소단위)</span><span><i style={{background:'#b0327c'}}/>◆ 설명용 이동 입자</span><span>점선 = 설명용 경로 · 공유결합 아님</span></div>
    <div className="addition-panel-body aqp-motion">
     <div className="camera-presets"><button disabled={reduced} aria-pressed={playing} onClick={()=>setPlaying(v=>!v)}>{playing?'물 이동 예시 정지':'물 이동 예시 보기'}</button><button onClick={()=>{setPlaying(false);setStep(s=>s+1);}}>입자 한 단계 이동</button></div>
     <p className="small"><strong>설명용 왕복 이동 · 실제 MD, 실제 속도 또는 정량적 투과도 계산이 아닙니다.</strong> 순수송 방향을 정하는 농도·삼투 조건은 설정하지 않았습니다. 경로는 분자 궤적이 아니며, 두 종류의 표식 크기도 실제 물 분자 크기가 아닙니다.</p>
     {reduced&&<p className="small" role="status">기기의 움직임 줄이기 설정에 따라 연속 재생을 끕니다. ‘입자 한 단계 이동’으로 관찰할 수 있습니다.</p>}
    </div>
   </section>
   <aside className="plot-panel aqp-controls" aria-label="AQP1 표시와 선택">
    <div className="addition-panel-body">
     <Segmented label="소단위 선택" value={String(view.unit)} onChange={u=>{change('unit',Number(u));if(view.stage!=='tetramer')focus('fit');}} options={[['0','1'],['1','2'],['2','3'],['3','4']] as const}/>
     <p className="small" data-testid="aqp-instance">원본 chain A · assembly operator {view.unit+1} · 잔기 1–249</p>
     <label className="aqp-range">다른 소단위 불투명도 <output>{Math.round(view.opacity*100)}%</output><input aria-label="다른 소단위 불투명도" type="range" min="0" max="1" step=".05" value={view.opacity} onChange={e=>change('opacity',Number(e.target.value))}/></label>
     <Segmented label="AQP1 표현" value={view.representation} onChange={r=>change('representation',r)} options={[['ribbon','리본'],['spacefill','공간 채움']] as const}/>
     <Segmented label="AQP1 색" value={view.color} onChange={c=>change('color',c)} options={[['subunit','소단위 색'],['chemistry','화학적 성질']] as const}/>
     <Segmented label="AQP1 부위 후보" value={view.region} onChange={r=>{setView(v=>({...v,region:r,color:'chemistry',representation:r==='all'?v.representation:'spacefill'}));}} options={[['all','전체'],['pore','통로 안쪽'],['lipid','바깥 지질 쪽']] as const}/>
     <p className="small" data-testid="aqp-region-count">선택 소단위: 통로 후보 {regionCounts!.pore}개 · 외부 지질 쪽 후보 {regionCounts!.lipid}개. 기하학적 교육용 분류이며 모든 잔기를 양쪽으로 나누지는 않습니다.</p>
     <div className="aqp-toggles">
      <label><input type="checkbox" checked={view.membrane} onChange={e=>change('membrane',e.target.checked)}/>막 위치 표시</label>
      <label><input type="checkbox" checked={view.clip} onChange={e=>change('clip',e.target.checked)}/>앞쪽 절단</label>
     </div>
     {view.clip&&<label className="aqp-range">절단 위치 <input aria-label="AQP1 절단 위치" type="range" min="-12" max="12" step=".5" value={view.clipOffset} onChange={e=>change('clipOffset',Number(e.target.value))}/></label>}
     <div className="aqp-toggles">
      <label><input type="checkbox" checked={view.waters} onChange={e=>change('waters',e.target.checked)}/>원본의 통로 물</label>
      <label><input type="checkbox" checked={view.paths} onChange={e=>change('paths',e.target.checked)}/>설명용 경로</label>
      <label><input type="checkbox" checked={view.npa} onChange={e=>change('npa',e.target.checked)}/>NPA motif</label>
      <label><input type="checkbox" checked={view.arr} onChange={e=>change('arr',e.target.checked)}/>ar/R 부위</label>
     </div>
     <div className="camera-presets"><button onClick={()=>{setView(v=>({...v,stage:'selectivity',npa:true,clip:false}));focus('npa');}}>NPA 확대</button><button onClick={()=>{setView(v=>({...v,stage:'selectivity',arr:true,clip:false}));focus('arr');}}>ar/R 확대</button></div>
     <label className="residue-select">선택 소단위의 잔기 <select aria-label="AQP1 잔기 선택" value={view.selected??''} onChange={e=>change('selected',e.target.value===''?null:Number(e.target.value))}><option value="">선택 안 함</option>{model.source.residues.map(r=><option key={r.index} value={r.index}>{r.resName} {r.resSeq}{r.insertionCode}</option>)}</select></label>
     {selected&&<div className="pair-measurement" data-testid="aqp-selected"><strong>{selected.resName} {selected.resSeq}</strong><p>소단위 {view.unit+1} · 원본 chain {selected.chain} · operator {view.unit+1}</p><p>{CLASS_INFO[classOf(selected.resName)].symbol} {CLASS_INFO[classOf(selected.resName)].label}</p><p>{region!.region==='pore'?'통로 안쪽 후보':region!.region==='lipid'?'외부 지질 쪽 후보':'이 기준에서 별도로 분류하지 않는 부위'}</p></div>}
    </div>
   </aside>
  </div>
  <div className="legend compare-legend">{view.color==='chemistry'?<>{CLASS_ORDER.map(c=><span key={c}><i style={{background:CLASS_INFO[c].css}}/>{CLASS_INFO[c].symbol} {CLASS_INFO[c].label}</span>)}<span>backbone 회색 · 전기적 퍼텐셜 지도가 아님</span></>:<><span>소단위 1 청록 · 2 보라 · 3 황토 · 4 파랑</span><span>원자 C/N/O/S는 기존 원소 색 기준</span></>}</div>
  <div className="lab-grid aqp-notes">
   <section className="plot-panel"><div className="panel-heading"><h3>관찰 후 확인하기</h3></div><div className="addition-panel-body"><p>4량체 가운데가 주된 물 통로일까요? 통로 전체가 고르게 친수성일까요?</p><details><summary>해설 확인</summary><p>각 소단위 안에 독립된 물 통로가 하나씩 있습니다. 중앙 공간을 통과하는 경로는 그리지 않았습니다. 통로에는 소수성 구간과 국소적인 극성 상호작용 부위가 함께 있습니다.</p><p>소 AQP1의 NPA는 <strong>Asn78–Pro79–Ala80, Asn194–Pro195–Ala196</strong>입니다. 두 Asn의 곁사슬은 통로 가운데 물과의 극성 상호작용에 관여합니다. ar/R 부위의 <strong>Phe58, His182, Cys191, Arg197</strong> 중 Cys191은 특히 backbone carbonyl O가 통로 쪽을 향합니다. 잔기 전체를 칠한 색으로 개별 원자의 역할을 대신할 수는 없습니다.</p><p>물 선택성은 크기뿐 아니라 물과의 상호작용, 전하 환경과 배향에 관련됩니다. 여기서는 이온이나 양성자 수송을 계산하지 않습니다. AQP1의 선택성을 모든 aquaporin에 똑같이 적용할 수 없습니다.</p></details></div></section>
   <section className="plot-panel"><div className="panel-heading"><h3>실험 근거와 모델의 한계</h3></div><div className="addition-panel-body"><p>단백질과 파란 물 산소는 <a href="https://www.rcsb.org/structure/1J4N" target="_blank" rel="noreferrer">1J4N 실험 좌표</a>입니다. 원본 물 114개 중 문헌에서 통로 안에 보고한 301–304만 표시합니다. 자주색 입자와 점선은 좌표의 빈 공간을 확인해 설정한 교육용 연출입니다.</p><details><summary>구조·막·부위 분류의 기준</summary><p>비대칭 단위 chain A에 저자 지정 assembly 1의 네 연산자를 적용했습니다. 다른 후보 assembly 2는 8량체이므로 이 4량체 탐구에 사용하지 않습니다. 모델링된 서열은 1–249이며, SEQRES의 250–271은 좌표가 없어 그리지 않습니다. BNG 세 분자와 나머지 물은 생략했습니다.</p><p>막 경계는 AQP1의 OPM 방향과 hydrophobic half-thickness 15.9 Å를 사용합니다. OPM backbone 996점을 원본에 정합한 RMSD는 0.0029 Å입니다. 막은 지질 원자가 아닌 위치 안내입니다.</p><p>통로 후보: 막 중심 ±14 Å 범위의 설명용 경로와 잔기의 비수소 원자 중심 거리가 4.5 Å 이내. 외부 지질 쪽 후보: 통로 후보를 제외하고, 곁사슬 중심이 막 안, 4량체의 상대 SASA ≥25%, 곁사슬이 4량체 바깥 방향, 통로 경로와 곁사슬 원자 거리가 6 Å 초과인 경우입니다. 문헌의 결합 판정이나 정확한 지질 접촉 목록이 아닙니다. OmpX 분류를 재사용하지 않습니다.</p><p>근거: <a href="https://doi.org/10.1038/414872a" target="_blank" rel="noreferrer">Sui et al., Nature (2001)</a> · <a href="https://opm-assets.storage.googleapis.com/pdb/1j4n.pdb" target="_blank" rel="noreferrer">OPM 1J4N 좌표</a>. 정량적 수송, 전기적 퍼텐셜, 동역학이나 자유에너지는 계산하지 않습니다.</p></details></div></section>
  </div>
 </section>;
}
