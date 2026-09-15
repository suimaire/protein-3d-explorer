import {useEffect,useMemo,useState} from 'react';
import {TransitionViewer} from '../components/TransitionViewer';
import {Segmented} from '../components/Segmented';
import {COMPARISON_COLORS,GUIDE_RADIUS,type TransitionCamera,type TransitionHighlight,type TransitionState} from '../rendering/TransitionScene';
import {transitionSceneModel,MOVING_DIMER,REFERENCE_DIMER,R_SOURCE,T_SOURCE,type TransitionModel} from '../protein/hemoglobinTransition';
import {loadTransition} from '../protein/transitionAssets';
import {GLOBIN_INFO,SUBUNIT_ORDER} from '../protein/hemoglobin';

export function HemoglobinTransitionLab(){
 const [model,setModel]=useState<TransitionModel|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let live=true;loadTransition().then(m=>{if(live)setModel(m);},e=>{if(live)setError(String(e));});return()=>{live=false;};},[]);
 if(error)return <main><p role="alert">PDB {T_SOURCE.pdbId} / {R_SOURCE.pdbId} 구조를 불러오지 못했습니다. ({error})</p></main>;
 if(!model)return <main><p>Loading PDB {T_SOURCE.pdbId} and {R_SOURCE.pdbId}…</p></main>;
 return <TransitionExplorer model={model}/>;
}

const defaults={state:'overlay' as TransitionState,fraction:0,highlight:'all' as TransitionHighlight,heme:true,ligand:true,iface:false,guide:false,hemeFocus:null as number|null};
const fmt=(v:number,n=2)=>v.toFixed(n);
const signed=(v:number)=>`${v>=0?'+':'−'}${Math.abs(v).toFixed(2)}`;

function TransitionExplorer({model}:{model:TransitionModel}){
 const scene=useMemo(()=>transitionSceneModel(model),[model]);
 const [state,setState]=useState(defaults.state),[fraction,setFraction]=useState(defaults.fraction),[highlight,setHighlight]=useState(defaults.highlight);
 const [showHeme,setShowHeme]=useState(defaults.heme),[showLigand,setShowLigand]=useState(defaults.ligand),[showInterface,setShowInterface]=useState(defaults.iface),[showGuide,setShowGuide]=useState(defaults.guide);
 const [hemeFocus,setHemeFocus]=useState(defaults.hemeFocus),[camera,setCamera]=useState<TransitionCamera>({view:'tetramer',token:0});
 const bump=(view:TransitionCamera['view'],heme?:number)=>setCamera(c=>({view,heme,token:c.token+1}));
 const view=useMemo(()=>({state,fraction,highlight,showHeme,showLigand,showInterface,showGuide,heme:hemeFocus}),[state,fraction,highlight,showHeme,showLigand,showInterface,showGuide,hemeFocus]);
 const reset=()=>{setState(defaults.state);setFraction(defaults.fraction);setHighlight(defaults.highlight);setShowHeme(defaults.heme);setShowLigand(defaults.ligand);setShowInterface(defaults.iface);setShowGuide(defaults.guide);setHemeFocus(defaults.hemeFocus);bump('tetramer');};
 const focusHeme=(n:number)=>{setHemeFocus(n);setShowHeme(true);bump('heme',n);};
 const {reference,moving,contacts,correspondence,hemes,subunitFits}=model;
 const percent=Math.round(fraction*100);
 const ref=REFERENCE_DIMER.join(''),mov=MOVING_DIMER.join('');
 const tip=state==='T'?`T-like state (PDB ${T_SOURCE.pdbId}, deoxy): subunits are arranged in one quaternary configuration. — 네 subunit의 배열을 눈에 익힌 뒤 R state와 비교해 보세요.`
  :state==='R'?`R-like state (PDB ${R_SOURCE.pdbId}, O₂ bound): the relative arrangement of the αβ dimers is different. — ${ref} dimer를 T 구조와 같은 위치에 맞춘 좌표로 표시합니다.`
  :state==='overlay'?`Overlay: one αβ dimer (${ref}) is aligned so the quaternary rearrangement of the other (${mov}) can be seen. — 회색 = T, 주황 = R. Highlight에서 dimer를 하나씩 켜 보세요.`
  :`Quaternary motion guide ${percent}%: T 구조(${T_SOURCE.pdbId})의 ${mov} dimer 전체를 계산된 상대 회전 ${fmt(moving.screw.angle,1)}°·중심 이동 ${fmt(moving.centroidDisplacement,1)} Å의 ${percent}%만큼 하나의 rigid body로 옮긴 화면입니다. ${ref}는 고정되어 있고, dimer 내부 모양은 변하지 않습니다. 실험 구조는 T state / R state 버튼으로 확인하세요.`;
 const selectedHeme=hemeFocus===null?null:{t:hemes.t.find(h=>h.number===hemeFocus)!,r:hemes.r.find(h=>h.number===hemeFocus)!};
 const tCount=contacts.t.length,rCount=contacts.r.length;

 return <main className="helix-lab core-lab hb-lab tr-lab" data-state={state}>
  <section className="module-heading"><div><p className="eyebrow">CHAPTER 3 · FROM STRUCTURE TO FUNCTION</p><h2>Hemoglobin T ↔ R Structural Transition</h2><p>O₂가 결합한 hemoglobin은 같은 구조에 O₂만 더해진 것일까, 아니면 subunit들의 상대적 배열도 달라질까?</p></div>
   <span className="model-tag">PDB {T_SOURCE.pdbId} (T-like, deoxy) · PDB {R_SOURCE.pdbId} (R-like, O₂)<strong>Two experimental X-ray structures · {T_SOURCE.resolution} Å each</strong></span></section>
  <section className="controls core-controls compare-controls hb-controls tr-controls" aria-label="T R comparison controls">
   <Segmented label="State" value={state} onChange={setState} options={[['T','T state'],['overlay','Overlay'],['R','R state'],['motion','Motion guide']] as const}/>
   <Segmented label="Highlight" value={highlight} onChange={setHighlight} options={[['all','Whole tetramer'],['reference','Reference αβ dimer'],['moving','Moving αβ dimer']] as const}/>
   <fieldset className="hb-toggles"><legend>Show</legend>
    <div className="toggles">
     <label><input type="checkbox" checked={showHeme} onChange={e=>{setShowHeme(e.target.checked);if(!e.target.checked)setHemeFocus(null);}}/>Heme</label>
     <label><input type="checkbox" checked={showLigand} onChange={e=>setShowLigand(e.target.checked)}/>Ligand (O₂)</label>
     <label><input type="checkbox" checked={showInterface} onChange={e=>setShowInterface(e.target.checked)}/>Interface</label>
     <label><input type="checkbox" checked={showGuide} onChange={e=>setShowGuide(e.target.checked)}/>Rearrangement guide</label>
    </div>
    <button onClick={reset}>전체 초기화</button>
   </fieldset>
  </section>
  <div className="helix-tip compare-tip" data-testid="tr-tip">{tip}
   {showGuide&&<span className="tip-extra" data-testid="guide-note"> Guide: relative structural difference after alignment — {mov}의 best-fit 회전축(점선), 회전각 {fmt(moving.screw.angle,1)}°를 나타내는 부채꼴(보이도록 반지름만 {GUIDE_RADIUS} Å로 키움), 중심 이동 {fmt(moving.centroidDisplacement,1)} Å(짧은 막대). 원자 궤적이 아닙니다.</span>}
   {showInterface&&<span className="tip-extra"> Interface: 진한 색 = 두 αβ dimer 사이 접촉 residue (heavy atom ≤ {contacts.cutoff.toFixed(1)} Å, 양쪽 구조에 공통인 원자로 계산). 상호작용 종류는 구분하지 않습니다.</span>}
   {showLigand&&(state==='T'||state==='motion')&&<span className="tip-extra"> T 구조(deoxy)에는 deposited O₂가 없으므로 ligand를 그리지 않습니다.</span>}
  </div>
  <div className="lab-grid helix-grid hb-grid">
   <section className="viewer-panel" aria-label="3D T R comparison">
    <div className="panel-heading"><h3>Hemoglobin A · T ↔ R</h3><span className="badge" data-testid="state-badge">{state==='T'?`T · ${T_SOURCE.pdbId}`:state==='R'?`R · ${R_SOURCE.pdbId} (ALIGNED)`:state==='overlay'?`OVERLAY · ${ref} ALIGNED`:`MOTION GUIDE ${percent}%`}</span></div>
    <div className="camera-presets"><button onClick={()=>{setHemeFocus(null);bump('tetramer');}}>Tetramer view</button><button onClick={()=>{setHemeFocus(null);bump('dimer');}}>Dimer comparison view</button>
     <button onClick={()=>focusHeme(hemeFocus??1)}>Heme view</button><button onClick={()=>bump('fit')}>Fit</button><button onClick={reset}>Reset</button></div>
    <TransitionViewer testId="tr-viewer" model={scene} view={view} camera={camera}
     ariaLabel="Hemoglobin T R 비교 3D 구조 (PDB 2DN2, 2DN1). 드래그로 회전, 휠로 확대, 방향키로 회전, 더하기와 빼기로 확대 축소."/>
    <div className="viewer-footer"><span>drag 회전 · 휠 확대 · 방향키 / + − · state를 바꿔도 카메라 방향은 유지됩니다</span></div>
    <div className="legend" data-testid="tr-legend">
     {(state==='T'||state==='overlay')&&<span><i style={{background:COMPARISON_COLORS.T.css}}/>T-like · {T_SOURCE.pdbId} (deoxy)</span>}
     {(state==='R'||state==='overlay')&&<span><i style={{background:COMPARISON_COLORS.R.css}}/>R-like · {R_SOURCE.pdbId} (O₂ bound, aligned on {ref})</span>}
     {state==='motion'&&<span><i style={{background:COMPARISON_COLORS.T.css}}/>T · {T_SOURCE.pdbId} geometry; {mov} moved as a rigid body ({percent}% of the calculated motion)</span>}
     {showHeme&&<><span><i style={{background:state==='R'?COMPARISON_COLORS.R.hemeCss:COMPARISON_COLORS.T.hemeCss,borderRadius:2}}/>Heme{state==='overlay'?' (dark gray T / dark orange R)':''}</span><span><i style={{background:COMPARISON_COLORS.ironCss}}/>Fe</span></>}
     {showLigand&&(state==='R'||state==='overlay')&&<span><i style={{background:COMPARISON_COLORS.ligandCss}}/>O₂ (deposited in {R_SOURCE.pdbId})</span>}
     {showGuide&&<span><i style={{background:COMPARISON_COLORS.guideCss,borderRadius:2}}/>Guide: rotation axis + rotation angle + centroid shift (not a trajectory)</span>}
    </div>
    <div className="motion-control" data-testid="motion-control">
     <label htmlFor="motion-guide">Quaternary motion guide <small>{mov} rigid-body · {ref} fixed</small> <strong data-testid="motion-value">{percent}%</strong></label>
     <input id="motion-guide" type="range" min={0} max={100} step={1} value={percent} onChange={e=>{setState('motion');setFraction(Number(e.target.value)/100);}} aria-label={`Motion guide: fraction of the calculated ${mov} rigid-body rotation and translation applied to the T structure`}/>
     <div className="range-ends"><span>0% · T · {T_SOURCE.pdbId}</span><span>100% · T {mov} + calculated rigid motion</span></div>
     <p className="motion-warning" data-testid="motion-warning">계산된 {mov}의 상대 회전·이동만 시각화한 가이드입니다. 실제 분자 전이 경로나 R 구조 자체가 아닙니다. <span className="small-inline">100%도 {R_SOURCE.pdbId} 실험 좌표가 아닙니다 (R에는 작은 tertiary 차이도 있음). 실험 구조는 T state / R state 버튼으로 보세요.</span></p>
    </div>
   </section>
   <aside className="plot-panel residue-panel hb-panel tr-panel" aria-label="Comparison values">
    <div className="panel-heading"><h3>Comparison</h3><span className="badge">CALCULATED</span></div>
    <dl className="tr-values">
     <dt>Reference dimer RMSD</dt><dd data-testid="reference-rmsd"><strong>{fmt(reference.rmsd)} Å</strong> <small>{ref} Cα {reference.matched}개, T와 R을 맞춘 뒤</small></dd>
     <dt>Relative dimer rotation</dt><dd data-testid="moving-rotation"><strong>{fmt(moving.screw.angle,1)}°</strong> <small>{mov} dimer, {ref} 기준</small></dd>
    </dl>
    <p className="small">{ref}를 겹쳐 놓아도 {mov}는 겹치지 않습니다. 같은 subunit이 같은 모양으로 있지만 서로의 배열이 달라졌습니다.</p>
    <div className="heme-list" data-testid="tr-heme-list"><p><strong>Heme 비교</strong> <small>T vs R, 좌표 측정</small></p>
     {hemes.t.map(h=>{const c=correspondence.find(x=>x.label===h.label)!;return <button key={h.number} aria-pressed={hemeFocus===h.number} onClick={()=>focusHeme(h.number)}>Heme {h.number} · {h.label} <small>({GLOBIN_INFO[c.type].name})</small></button>;})}
    </div>
    {selectedHeme&&<div className="residue-info tr-heme" data-testid="tr-heme-info">
     <p className="residue-title">Heme {selectedHeme.t.number} <small>{selectedHeme.t.label} · proximal {selectedHeme.t.proximal}</small></p>
     <div className="table-wrap"><table><thead><tr><th/><th>T ({T_SOURCE.pdbId})</th><th>R ({R_SOURCE.pdbId})</th></tr></thead><tbody>
      <tr><th>Fe–His NE2</th><td data-testid="fe-his-t">{fmt(selectedHeme.t.feHis)} Å</td><td data-testid="fe-his-r">{fmt(selectedHeme.r.feHis)} Å</td></tr>
      <tr><th>Fe ↔ porphyrin plane</th><td data-testid="fe-plane-t">{signed(selectedHeme.t.feFromPorphyrin)} Å</td><td data-testid="fe-plane-r">{signed(selectedHeme.r.feFromPorphyrin)} Å</td></tr>
      <tr><th>Ligand</th><td>none deposited</td><td data-testid="ligand-r">{selectedHeme.r.ligand?<>O₂ · Fe–{selectedHeme.r.ligand.feAtom} {fmt(selectedHeme.r.ligand.feDistance)} Å</>:'none'}</td></tr>
     </tbody></table></div>
     <p className="small">Plane = 24개 porphyrin 고리 원자의 최소제곱 평면, + = proximal His 쪽. Heme 주변의 국소 변화와 tetramer 전체 배열 변화는 함께 관찰되지만, 이 두 구조만으로 하나의 단순한 인과 사슬을 증명할 수는 없습니다.</p>
    </div>}
   </aside>
  </div>
  <section className="helix-notes tr-science" data-testid="science-note">
   <p><strong>Scientific note.</strong> T와 R은 hemoglobin의 주요 quaternary conformational states를 설명하는 유용한 모델입니다. 실제 hemoglobin은 열운동과 ligand 상태에 따라 여러 conformational states를 점유할 수 있습니다.</p>
   <p>여기서는 구조 비교만 다룹니다. T-like 구조가 O₂를 전혀 결합하지 못한다거나, R-like 구조가 항상 완전히 산소로 포화되어 있다는 뜻이 아닙니다.</p>
  </section>
  <details className="observe hb-observe" data-testid="tr-observation">
   <summary>관찰 후 확인하기</summary>
   <ul className="checklist">
    <li>{ref} (reference dimer): T와 R의 Cα RMSD <strong>{fmt(reference.rmsd)} Å</strong> — 거의 겹칩니다.</li>
    <li>{mov} (moving dimer): {ref}를 맞춘 상태에서 Cα 차이 <strong data-testid="moving-rmsd">{fmt(moving.rmsdBeforeFit)} Å</strong>, best-fit rotation <strong>{fmt(moving.screw.angle,1)}°</strong>, 중심 이동 <strong data-testid="moving-displacement">{fmt(moving.centroidDisplacement,1)} Å</strong>. {mov} 자체의 모양은 거의 같습니다 (자기 자신끼리 맞추면 {fmt(moving.fit.rmsd)} Å).</li>
    <li>Individual subunit RMSD <small>(각 chain을 따로 best-fit, 양쪽에 있는 Cα만)</small>
     <div className="table-wrap"><table className="subunit-rmsd" data-testid="subunit-rmsd"><tbody>{SUBUNIT_ORDER.map(l=><tr key={l} data-testid={`subunit-rmsd-${l}`}><th>{l}</th><td>{fmt(subunitFits[l].rmsd)} Å</td><td><small>Cα {subunitFits[l].matched}</small></td></tr>)}</tbody></table></div>
     각 globin subunit의 fold 변화(≤ {fmt(Math.max(...SUBUNIT_ORDER.map(l=>subunitFits[l].rmsd)))} Å)보다 subunit 사이의 상대적 재배열({mov} {fmt(moving.rmsdBeforeFit)} Å)이 더 두드러집니다.</li>
    <li>두 dimer 사이 접촉 residue 쌍 (≤ {contacts.cutoff.toFixed(1)} Å): T <strong data-testid="contacts-t">{tCount}</strong> · R <strong data-testid="contacts-r">{rCount}</strong> · 공통 {contacts.common.length} · T에만 {contacts.lost.length} · R에만 {contacts.gained.length}</li>
   </ul>
   <p>Hemoglobin은 고정된 rigid object가 아닙니다. O₂가 결합한 R-like 구조에서는 한 αβ dimer에 대한 다른 αβ dimer의 상대적 배열이 T-like 구조와 다릅니다. 이것이 quaternary rearrangement입니다.</p>
   <p className="small">비교: tetramer 전체를 한 번에 best-fit하면 RMSD {fmt(model.wholeTetramerRmsd)} Å로 차이가 네 subunit에 퍼져 보여, dimer 사이의 회전이 잘 드러나지 않습니다. 그래서 한 dimer만 기준으로 맞췄습니다.</p>
   <div className="table-wrap"><table><thead><tr><th>Subunit</th><th>T chain ({T_SOURCE.pdbId})</th><th>R chain ({R_SOURCE.pdbId} assembly)</th><th>Globin</th><th>Modeled T / R</th></tr></thead>
    <tbody>{correspondence.map(c=><tr key={c.label} data-testid={`tr-mapping-${c.label}`}><th>{c.label}</th><td>{c.tChain}</td><td>{c.rChain}{c.rChain!==c.rSourceChain?` (copy of ${c.rSourceChain})`:''}</td><td>{GLOBIN_INFO[c.type].name}</td><td>{c.tModeled} / {c.rModeled}</td></tr>)}</tbody></table></div>
  </details>
  <section className="helix-notes">
   <details><summary>구조 출처와 처리 방법 보기</summary>
    <p data-testid="tr-source">T: RCSB PDB {T_SOURCE.pdbId}, human deoxyhemoglobin A, {T_SOURCE.method}, {T_SOURCE.resolution} Å. R: RCSB PDB {R_SOURCE.pdbId}, human oxyhemoglobin A (O₂ bound to each heme Fe), {R_SOURCE.method}, {R_SOURCE.resolution} Å. 두 구조 모두 {R_SOURCE.citation}.</p>
    <p>{R_SOURCE.pdbId}의 asymmetric unit은 αβ dimer 하나이며, biological assembly 1은 파일의 BIOMT operator 2 (결정학적 2-fold, y, x, −z)로 만든 복사본을 더한 α2β2입니다 (chain A_2, B_2 = chain A, B의 복사본). α/β는 DBREF UniProt accession으로, α1/β1/α2/β2는 각 구조에서 접촉 크기로 따로 정한 뒤 같은 label끼리 대응시켰습니다.</p>
    <p>정렬: {ref} dimer의 공통 Cα {reference.matched}개로 R을 T에 rigid-body 최소제곱 superposition (회전 + 평행이동만; 크기 변화·반사·변형 없음, rotation determinant {fmt(reference.determinant,6)}). 원본 PDB 파일은 바꾸지 않고, 정렬 좌표는 화면에서 계산합니다.</p>
    <p>차이 그대로 표시: {R_SOURCE.pdbId}에는 α Val1, β Val1 residue와 β His2 side chain 원자가 없습니다. T↔R 비교 수치는 두 구조에 공통인 원자 {model.common.length}개만 사용하며, 없는 원자를 만들어 넣지 않습니다. Motion guide는 T 구조의 {mov} (protein 원자 + heme)에 하나의 rigid transform (quaternion SLERP 회전 + 중심 직선 이동)만 적용합니다. O₂ (OXY, occupancy 1.00)는 R endpoint에만 그리고 T에는 넣지 않았습니다. {R_SOURCE.pdbId}의 toluene (MBN) 분자와 물은 표시하지 않았습니다.</p>
   </details>
  </section>
 </main>;
}
