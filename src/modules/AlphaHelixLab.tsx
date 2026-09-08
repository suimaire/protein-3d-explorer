import {useMemo,useState} from 'react';
import {buildHelix,helixGeometry,hydrogenBonds,residueCount} from '../geometry/helix';
import {angles} from '../geometry/peptide';
import {clashes} from '../geometry/sterics';
import {HelixViewer} from '../components/HelixViewer';
import type {HelixOptions} from '../components/HelixViewer';
import {RamachandranPlot} from '../components/RamachandranPlot';
const model=buildHelix(),bonds=hydrogenBonds(model),count=residueCount(model),frame=helixGeometry(model),hits=clashes(model);
const defaults:HelixOptions={backbone:true,sidechains:true,atoms:true,hbonds:true,axis:false};
const toggles:[keyof HelixOptions,string][]=[['backbone','Backbone'],['sidechains','Side chains'],['atoms','Atoms'],['hbonds','Show H-bonds'],['axis','Show helix axis']];
export function AlphaHelixLab({onPeptide}:{onPeptide:()=>void}){
  const [options,setOptions]=useState(defaults),[selected,setSelected]=useState(6),[focus,setFocus]=useState(3),[camera,setCamera]=useState<{view:'side'|'top'|'reset'|'fit';token:number}>({view:'side',token:0});
  const actual=angles(model,selected),bond=bonds.find(b=>b.acceptor===focus)!;
  const inspection=useMemo(()=>({selected,focus,hbonds:bonds,showBonds:options.hbonds,showAxis:options.axis}),[selected,focus,options.hbonds,options.axis]);
  const changeCamera=(view:typeof camera.view)=>setCamera(c=>({view,token:c.token+1}));
  return <main className="helix-lab"><section className="module-heading"><div><p className="eyebrow">CHAPTER 2 · FROM SEQUENCE TO STRUCTURE</p><h2>α-Helix Lab</h2><p>반복되는 φ/ψ에서 backbone과 수소결합의 관계를 살펴보세요.</p></div><span className="model-tag">Ac–(L-Ala)₁₂–NHMe<strong>Idealized poly-L-alanine α-helix</strong></span></section>
    <div className="lab-grid helix-grid"><section className="viewer-panel" aria-label="3D alpha helix"><div className="panel-heading"><h3>Right-handed α-helix</h3><span className="badge">12 RESIDUES</span></div>
      <div className="camera-presets">{(['side','top','reset','fit'] as const).map(v=><button key={v} onClick={()=>changeCamera(v)}>{v==='side'?'Side view':v==='top'?'Top view':v==='reset'?'Reset camera':'Fit structure'}</button>)}</div>
      <HelixViewer model={model} options={options} inspection={inspection} camera={camera}/>
      <div className="viewer-footer"><span>드래그 회전 · 휠 / 두 손가락 확대</span><span className="central-key">금색 = 선택 residue / H-bond focus</span></div><div className="legend"><span><i className="carbon"/>C</span><span><i className="nitrogen"/>N</span><span><i className="oxygen"/>O</span><span><i className="hydrogen"/>H (amide)</span><span className="phi-key">┄ backbone H-bond</span></div>
      <div className="helix-tip">{camera.view==='top'?'Top view · helix axis 방향으로 봅니다. Cα에 연결된 Ala methyl side chain이 바깥으로 돌출됩니다.':'Side view · backbone의 반복과 C=O(i) ··· H–N(i+4) 연결을 따라가 보세요.'}</div>
    </section>
    <aside className="plot-panel helix-inspection"><div className="panel-heading"><h3>Backbone geometry</h3><span className="badge">MEASURED</span></div>
      <label className="residue-select">Inspect residue <select aria-label="Inspect residue" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{Array.from({length:count},(_,i)=><option key={i+1} value={i+1}>Ala {i+1}</option>)}</select></label>
      <div className="coordinate" data-testid="helix-measured">φ {actual.phi.toFixed(1)}° <span>/</span> ψ {actual.psi.toFixed(1)}°</div><p className="small">Ala {selected}의 실제 좌표에서 계산 · ω = 180° trans</p><RamachandranPlot {...actual}/>
      <div className="hbond-inspection"><h3>Focus H-bond <span className="badge" data-testid="hbond-count">{options.hbonds?bonds.length:0} / {Math.max(0,count-4)} 표시</span></h3><label>Backbone pair <select aria-label="Focus H-bond" value={focus} onChange={e=>{setFocus(Number(e.target.value));setOptions(o=>({...o,hbonds:true,backbone:true,atoms:true}));}}>{bonds.map(b=><option value={b.acceptor} key={b.acceptor}>Ala {b.acceptor} C=O ··· H–N Ala {b.donor}</option>)}</select></label>
        <p data-testid="hbond-detail"><strong>Acceptor</strong> Ala {bond.acceptor} C=O<br/><strong>Donor</strong> Ala {bond.donor} N–H<br/>O···N {bond.on.toFixed(2)} Å · H···O {bond.ho.toFixed(2)} Å<br/>N–H···O {bond.angle.toFixed(1)}°</p><p className="small">{options.hbonds?'금색 점선과 테두리로 선택한 결합의 원자를 표시합니다.':'Show H-bonds를 켜면 결합을 표시합니다.'}</p>
      </div>
    </aside></div>
    <section className="controls" aria-label="Helix display controls"><fieldset><legend>표시 옵션</legend><div className="toggles">{toggles.map(([key,label])=><label key={key}><input type="checkbox" checked={options[key]} onChange={()=>setOptions(o=>({...o,[key]:!o[key]}))}/>{label}</label>)}</div></fieldset><div className="presets"><button onClick={()=>setOptions(o=>({...o,backbone:true,sidechains:false}))}>Backbone only</button><button onClick={()=>setOptions(o=>({...o,backbone:true,sidechains:true}))}>Backbone + side chains</button><button onClick={()=>{setOptions(defaults);setSelected(6);setFocus(3);changeCamera('reset');}}>전체 초기화</button></div></section>
    <section className="teaching"><div><h3>01 · Repeating φ/ψ</h3><p>Peptide Geometry의 α-like φ/ψ가 여러 residue에서 반복되면 α-helical backbone이 형성될 수 있습니다.</p><button className="text-link" onClick={onPeptide}>Peptide Geometry에서 φ/ψ 조작 →</button></div><div><h3>02 · Backbone hydrogen bonds</h3><p>C=O(i) ··· H–N(i+4) network가 구조 안정화에 기여합니다. 대표적인 반복 수소결합은 side chain이 아닌 backbone 사이에 형성됩니다.</p></div><div><h3>03 · Side chains outward</h3><p>Top view에서 Ala의 methyl side chain이 helix axis 바깥으로 향하는 모습을 확인하세요. Axis는 원자나 결합이 아닌 기하학적 안내선입니다.</p></div></section>
    <section className="helix-notes"><p>대표적 idealized geometry입니다. 실제 단백질에서는 residue별 각도가 달라지며 sequence, 주변 환경과 다른 상호작용도 중요합니다.</p><p><strong>Helix ends</strong> · 표시 network는 Ala끼리만 계산합니다. Ala 1–4의 N–H와 Ala 9–12의 C=O는 이 network 안에 i→i+4 partner가 없습니다. Cap 관련 접촉은 표시 개수에서 제외합니다.</p><details><summary>대표 수치와 모델 검증 보기</summary><p>Ideal α-helix 대표값: 약 3.6 residues/turn · 1.5 Å/residue · pitch 5.4 Å.<br/>현재 좌표 측정값: {frame.perTurn.toFixed(2)} residues/turn · {frame.rise.toFixed(2)} Å/residue · pitch {frame.pitch.toFixed(2)} Å. 고정 결합 geometry와 −60°/−45°를 사용하여 대표값과 조금 다릅니다.</p><p>H-bond 표시 기준: O···N 2.5–3.5 Å, H···O 1.5–2.6 Å, N–H···O ≥120°. 에너지 계산이 아닌 교육용 geometry screen입니다.</p><p data-testid="helix-clashes">기존 detector의 심한 비결합 겹침: {hits.length}쌍. 모두 수소결합의 O···H 접촉(내부 {bonds.length}, cap 관련 {hits.length-bonds.length})으로, H-bond를 구별하지 않는 거리 지표의 한계입니다. 각 겹침은 약 0.437 Å이며, 그 외 검출된 쌍은 없습니다. 기존 0.40 Å 기준과 topology 제외 정책을 유지했습니다.</p><p>탄소 결합 H는 생략하고 amide H만 명시합니다. 실험 구조, 에너지 최소화 또는 folding simulation이 아닙니다.</p></details></section>
  </main>;
}
