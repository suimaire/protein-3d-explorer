import { useMemo,useState } from 'react';
import { INITIAL,PRESETS } from '../data/science';
import { angles,conformation } from '../geometry/peptide';
import { clashes as findClashes } from '../geometry/sterics';
import { DEFAULT_VIEW } from '../rendering/PeptideScene';
import type { ViewOptions } from '../rendering/PeptideScene';
import { MoleculeViewer } from '../components/MoleculeViewer';
import { RamachandranPlot } from '../components/RamachandranPlot';
import { TeachingNotes,ScientificHelp } from '../data/TeachingNotes';
const toggles:[keyof ViewOptions,string][]=[['backbone','Backbone'],['sidechains','Side chains'],['atoms','Atoms'],['vdw','van der Waals spheres'],['planes','Show peptide plane'],['clashes','Show steric clashes'],['labels','Atom labels'],['axes','φ / ψ axes']];
export function PeptideGeometryLab(){
  const [target,setTarget]=useState(INITIAL),[options,setOptions]=useState(DEFAULT_VIEW),[resetToken,setResetToken]=useState(0);
  const model=useMemo(()=>conformation(target.phi,target.psi),[target]);
  const actual=useMemo(()=>angles(model),[model]),clashes=useMemo(()=>findClashes(model),[model]);
  // The marker comes from measured geometry; preserve the chosen sign at the periodic seam.
  const display={phi:Math.abs(Math.abs(actual.phi)-180)<1e-8?target.phi:actual.phi,psi:Math.abs(Math.abs(actual.psi)-180)<1e-8?target.psi:actual.psi};
  return <main><section className="module-heading"><div><p className="eyebrow">CHAPTER 1 · AMINO ACID & PEPTIDE</p><h2>Peptide Geometry Lab</h2><p>φ와 ψ를 바꾸며, 평면이 유지되는 부분과 움직이는 부분을 비교하세요.</p></div><span className="model-tag">Ac–Ala₅–NHMe <strong>중앙 Ala 3</strong></span></section>
    <div className="lab-grid"><section className="viewer-panel" aria-label="3D peptide"><div className="panel-heading"><h3>3D peptide</h3><button onClick={()=>setResetToken(n=>n+1)} title="시점과 확대율을 초기화">시점 초기화</button></div><MoleculeViewer model={model} options={options} clashes={clashes} resetToken={resetToken}/><div className="viewer-footer"><span>드래그 회전 · 휠 / 두 손가락 확대</span><span className="central-key">금색 테두리·라벨 = Ala 3</span></div><div className="legend"><span><i className="carbon"/>C</span><span><i className="nitrogen"/>N</span><span><i className="oxygen"/>O</span><span><i className="hydrogen"/>H (amide)</span><span className="phi-key">━ φ N–Cα</span><span className="psi-key">━ ψ Cα–C</span></div></section>
    <aside className="plot-panel"><div className="panel-heading"><h3>Ramachandran plot</h3><span className="badge">SCHEMATIC</span></div><RamachandranPlot {...display} onSelect={(phi,psi)=>setTarget({phi,psi})}/><div className="coordinate" data-testid="measured">φ {display.phi.toFixed(1)}° <span> / </span> ψ {display.psi.toFixed(1)}°</div><p className="small">십자점 = 현재 구조 · 그림을 클릭해 각도 선택</p><p className="omega">ω = 180° · trans 고정</p></aside></div>
    <section className="controls" aria-label="분자 구조 조작"><div className="slider-grid">{(['phi','psi'] as const).map(key=><div className={`angle-control ${key}`} key={key}><label htmlFor={key}><strong>{key==='phi'?'φ (phi)':'ψ (psi)'}</strong><span>{key==='phi'?'N–Cα':'Cα–C'}</span><output htmlFor={key}>{target[key]}°</output></label><input id={key} aria-label={key==='phi'?'φ (phi)':'ψ (psi)'} type="range" min="-180" max="180" step="1" value={target[key]} onChange={e=>setTarget(t=>({...t,[key]:Number(e.target.value)}))}/><div className="range-ends"><span>−180°</span><span>0°</span><span>+180°</span></div></div>)}</div><div className="presets"><span>대표값</span>{PRESETS.map(p=><button key={p.label} aria-pressed={target.phi===p.phi&&target.psi===p.psi} title={`Representative values: φ ${p.phi}°, ψ ${p.psi}°`} onClick={()=>setTarget({phi:p.phi,psi:p.psi})}>{p.label}</button>)}<button onClick={()=>{setTarget(INITIAL);setOptions(DEFAULT_VIEW);setResetToken(n=>n+1);}}>전체 초기화</button></div><fieldset><legend>표시 옵션</legend><div className="toggles">{toggles.map(([key,label])=><label key={key}><input type="checkbox" checked={options[key]} onChange={()=>setOptions(o=>({...o,[key]:!o[key]}))}/>{label}</label>)}</div></fieldset></section>
    <section className={`clash-summary ${clashes.length?'has-clashes':''}`} aria-label="입체 겹침"><div><strong>기하학적 겹침 <span data-testid="clash-count">{clashes.length}</span>쌍</strong><span>{options.clashes?'분홍 연결선 = 가까운 원자 쌍':'Show steric clashes를 켜서 위치 확인'}</span></div><p>전체 모델 기준 · 이 표시는 원자 간 겹침을 보여주는 교육용 지표입니다. 실제 단백질의 conformational preference 전체를 계산하는 molecular mechanics simulation은 아닙니다.</p>{options.clashes&&clashes.length>0&&<details><summary>가장 큰 겹침 {Math.min(5,clashes.length)}쌍 보기</summary><ul>{clashes.slice(0,5).map(c=><li key={`${c.a}-${c.b}`}>{c.a} ↔ {c.b} · 거리 {c.distance.toFixed(2)} Å · 겹침 {c.overlap.toFixed(2)} Å</li>)}</ul></details>}</section>
    <TeachingNotes/><ScientificHelp/>
  </main>;
}
