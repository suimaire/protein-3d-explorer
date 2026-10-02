import {useEffect,useMemo,useReducer,useState} from 'react';
import {ProteinViewer,type ProteinCamera} from '../components/ProteinViewer';
import {RnaseTopologyViewer} from '../components/RnaseTopologyViewer';
import {SequenceStrip} from '../components/SequenceStrip';
import {Segmented} from '../components/Segmented';
import {loadRnase} from '../protein/rnaseAssets';
import {RNASE_INITIAL,RNASE_CONDITIONS,rnaseReducer,type RnaseCondition,type RnaseModel} from '../protein/rnase';
import {residueLabel,atomIdentifier} from '../protein/sequenceSpace';
import type {Representation} from '../rendering/ProteinScene';
export function DisulfideLab(){
 const [model,setModel]=useState<RnaseModel|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;loadRnase().then(m=>{if(active)setModel(m);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[]);
 if(error)return <main><p role="alert">{error}</p></main>;
 if(!model)return <main><p className="loading-note">소 RNase A의 실험 좌표와 이황화 연결을 확인하는 중…</p></main>;
 return <RnaseLab model={model}/>;
}
function RnaseLab({model}:{model:RnaseModel}){
 const [state,dispatch]=useReducer(rnaseReducer,RNASE_INITIAL),[representation,setRepresentation]=useState<Representation>('ribbon'),[camera,setCamera]=useState<ProteinCamera>({view:'reset',token:0});
 const condition=RNASE_CONDITIONS[state.condition],p=state.selectedBond===null?null:model.disulfides[state.selectedBond];
 const all=useMemo(()=>new Set(model.structure.residues.map(r=>r.index)),[model]);
 const marks=useMemo(()=>p?[{residue:p.a,label:'A'},{residue:p.b,label:'B'}]:state.selectedResidue!==null?[{residue:state.selectedResidue,label:'선택'}]:[],[p,state.selectedResidue]);
 const view=useMemo(()=>({representation,color:'default' as const,highlighted:all,filtered:false,selected:state.selectedResidue,clip:null,sideChains:model.cysteines,marks,
  guides:state.showBonds?model.disulfides.map((d,i)=>({a:d.atomA,b:d.atomB,kind:'disulfide' as const,labelA:i===state.selectedBond?'A · '+atomIdentifier(model.structure,d.atomA):'',labelB:i===state.selectedBond?'B · '+atomIdentifier(model.structure,d.atomB):'',text:i===state.selectedBond?d.distance.toFixed(3)+' Å':''})):[]}),[representation,all,model,marks,state]);
 const bump=(view:ProteinCamera['view'],atoms?:number[])=>setCamera(c=>({view,atoms,token:c.token+1}));
 const pick=(index:number)=>{const bond=model.disulfides.findIndex(p=>p.a===index||p.b===index);dispatch({type:'select',bond:condition.schematic||bond<0?null:bond,residue:index});};
 const selectBond=(i:number)=>dispatch({type:'select',bond:i,residue:model.disulfides[i].a});
 const reset=()=>{dispatch({type:'reset'});setRepresentation('ribbon');bump('reset');};
 const change=(value:RnaseCondition)=>{dispatch({type:'condition',value});bump('reset');};
 return <main className="helix-lab core-lab disulfide-lab" data-condition={state.condition} data-evidence={condition.schematic?'schematic':state.condition==='native'?'experimental':'reference-reuse'}>
 <section className="module-heading"><div><p className="eyebrow">2장 · 서열에서 구조로</p><h2>이황화 결합과 변성</h2><p>서열과 펩타이드 연결이 그대로여도 접힌 형태와 기능이 달라질 수 있을까?</p></div><span className="model-tag">Disulfide Bonds &amp; Denaturation<strong>소 RNase A · Bos taurus</strong></span></section>
 <section className="controls additions-controls"><Segmented label="탐구" value={state.exploration} onChange={value=>{dispatch({type:'exploration',value});bump('reset');}} options={[['native','1 · 천연 구조에서 연결 찾기'],['conditions','2 · 변성·환원과 조건 복원']]}/><button onClick={reset}>전체 초기화</button></section>
 {state.exploration==='conditions'&&<section className="condition-options" aria-label="RNase 조건 비교"><p>두 처리 순서를 비교해 보세요. 여러 고전 실험을 요약한 정성적 활동으로, 단일 실험의 모든 절차나 반응 속도를 재현하지 않습니다.</p><Segmented label="조건 비교" value={state.condition==='exchanged'?'scrambled':state.condition} onChange={change} options={[['native','천연 상태'],['reduced','변성제 + 환원제 처리'],['refolded','재접힘 조건에서 재산화'],['scrambled','변성 조건에서 먼저 산화']]}/><button disabled={state.condition!=='scrambled'} onClick={()=>change('exchanged')}>요소 제거 후 이황화 교환 조건 제공</button></section>}
 <div className="lab-grid helix-grid">
 <section className="viewer-panel" aria-label="RNase A 구조">
 <div className="panel-heading"><h3>{condition.schematic?'잔기 수준 사슬 모식도':'RNase A (7RSA)'}</h3><span className={condition.schematic?'schematic-tag':'badge'} data-testid="rnase-evidence">{condition.evidence}</span></div>
 <div className="camera-presets"><button onClick={()=>bump('reset')}>전체 구조</button><button onClick={()=>bump('fit')}>화면에 맞추기</button>{!condition.schematic&&<><button onClick={()=>bump('focus',model.disulfides.flatMap(d=>[d.atomA,d.atomB]))}>이황화 결합 중심</button><button disabled={!p} onClick={()=>{if(p)bump('focus',[...model.structure.residues[p.a].atoms,...model.structure.residues[p.b].atoms]);}}>선택한 결합 확대</button></>}</div>
 {condition.schematic?<RnaseTopologyViewer model={model} condition={state.condition as 'reduced'|'scrambled'} showBonds={state.showBonds} selected={state.selectedResidue} camera={camera} onPick={pick}/>
 :<ProteinViewer testId="rnase-viewer" structure={model.structure} bonds={model.bonds} exposure={model.exposure} view={view} camera={camera} onPick={pick} options={{ariaLabel:'소 RNase A 실험 구조. 드래그·방향키로 회전, 휠·더하기·빼기로 확대 축소, 클릭으로 잔기 선택.'}}/>}
 <div className="viewer-footer"><span>드래그 회전 · 휠 확대 · 잔기 클릭 · 방향키 / + −</span><span>{condition.schematic?'단위 없는 모식도 · 회색 사슬 / 금색 Cys':'회색 리본 = 주사슬 · 금색 S–S = 곁사슬 교차 연결'}</span></div>
 <div className="addition-sequence"><SequenceStrip residues={model.structure.residues} positions={model.positions} marks={new Map(marks.map(m=>[m.residue,m.label]))} onPick={pick}/></div>
 </section>
 <aside className="plot-panel residue-panel">
 <div className="panel-heading"><h3>{state.exploration==='native'?'천연 이황화 연결':'현재 조건에서 관찰하기'}</h3></div>
 <div className="addition-panel-body">
 <p>{condition.description}</p>
 <label className="toggles"><input type="checkbox" checked={state.showBonds} onChange={e=>dispatch({type:'display',value:e.target.checked})}/>이황화 결합 표시</label><p className="small">표시를 꺼도 연결 상태는 그대로입니다. 환원 처리는 탐구 2의 조건 선택에서 다룹니다.</p>
 {!condition.schematic&&<><Segmented label="RNase 표현 방식" value={representation} onChange={setRepresentation} options={[['ribbon','리본'],['atoms','원자 / 막대'],['spacefill','공간 채움']]}/><div className="disulfide-list">{model.disulfides.map((d,i)=><button key={d.label} aria-pressed={i===state.selectedBond} onClick={()=>selectBond(i)}>{i+1} · {d.label}<span>SG–SG {d.distance.toFixed(3)} Å</span></button>)}</div></>}
 {condition.schematic&&<p className="note">모든 점은 잔기를 상징합니다. 실제 원자 좌표·크기·거리가 아닙니다. {state.condition==='scrambled'?'점선 곡선은 임의의 연결 관계(topology)이며 긴 원자 결합 막대가 아닙니다.':'사슬은 다양한 변성 형태를 대표하는 하나의 교육용 배치입니다.'}</p>}
 {p&&!condition.schematic&&<p className="note" data-testid="rnase-distance"><strong>{p.label} · {p.distance.toFixed(3)} Å</strong><br/>A · {atomIdentifier(model.structure,p.atomA)}<br/>B · {atomIdentifier(model.structure,p.atomB)}<br/>두 Cys는 서열 막대와 3D의 A/B 테두리로 함께 표시됩니다.</p>}
 {state.selectedResidue!==null&&<p data-testid="rnase-selected">선택: {residueLabel(model.structure.residues[state.selectedResidue])}</p>}
 <dl className="condition-facts" data-testid="rnase-facts"><dt>아미노산 서열</dt><dd>동일한 124개 잔기</dd><dt>펩타이드 연결</dt><dd>N → C 순서와 123개 연결 유지</dd><dt>이황화 연결</dt><dd>{condition.disulfides}</dd><dt>접힌 형태</dt><dd>{condition.shape}</dd><dt>근거 유형</dt><dd>{condition.evidence}</dd></dl>
 </div></aside></div>
 <section className="teaching"><div><h3>펩타이드 연결과 S–S 연결</h3><p>펩타이드 결합은 주사슬의 순서를 잇습니다. 이황화 결합은 두 Cys 곁사슬의 황을 잇는 공유결합이며, 사슬의 떨어진 부분을 교차 연결합니다.</p></div><div><h3>변성과 환원은 다른 작용</h3><p>변성제는 접힘을 안정화하는 환경을 바꾸고, 환원제는 S–S를 SH 상태로 바꿉니다. 환원제 하나가 모든 단백질을 즉시 완전히 펼친다는 뜻은 아닙니다.</p></div><div><h3>연결 개수만으로 충분할까?</h3><p>네 연결이 다시 생겨도 연결 상대와 접힌 형태가 다를 수 있습니다. 기능 회복 여부를 연결 개수만으로 판단할 수 없습니다.</p></div></section>
 <details className="observe addition-observe"><summary>관찰 후 확인하기 · 서열 보존과 천연 구조 회복</summary><p>서열과 펩타이드 연결이 유지되어도 접힘과 기능은 달라질 수 있습니다. RNase A에서는 적절한 조건에서 천연 구조와 활성이 회복될 수 있지만, 비천연 이황화 연결은 이를 방해할 수 있습니다. 교환 조건은 잘못된 연결의 재배열을 가능하게 합니다.</p></details>
 <section className="helix-notes"><p>모델 한계: 이 사례를 모든 단백질의 무조건적인 자발적 재접힘으로 일반화할 수 없습니다. 세포 환경·농도·응집·접힘 보조 인자 등이 중요합니다. 활성 비율, 에너지, 시간·속도는 계산하지 않습니다. 형태 사이의 보간이나 실제 펼침 궤적을 제공하지 않습니다.</p>
 <details><summary>구조·처리 순서의 근거</summary><p><a href="https://www.rcsb.org/structure/7RSA" target="_blank" rel="noreferrer">7RSA</a> · Bos taurus · X선 1.26 Å · chain A 1–124 · monomer, identity operator. 잔기마다 하나의 alternate conformer와 공통 원자만 사용했습니다. 물·TBU·수소는 제외했습니다.</p>
 <p>현재 원본 PDB에는 SSBOND 주석이 없습니다. 네 천연 연결은 <a href="https://doi.org/10.1046/j.1432-1327.2000.01037.x" target="_blank" rel="noreferrer">Klink 등 (2000)</a>의 연결 표와 실제 SG 좌표를 대조했습니다. 거리만으로 새로운 S–S 연결을 판정하는 기능은 없습니다.</p>
 <p>조건 비교는 <a href="https://doi.org/10.1073/pnas.47.9.1309" target="_blank" rel="noreferrer">Anfinsen 등 (1961)</a>의 환원 사슬 재산화 연구와 <a href="https://www.nobelprize.org/uploads/2018/06/anfinsen-lecture.pdf" target="_blank" rel="noreferrer">Anfinsen의 Nobel 강연 (1972), 그림 2</a>의 scrambled RNase 교환 실험 설명을 종합했습니다.</p></details></section>
 </main>;
}
