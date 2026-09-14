import {useMemo,useState} from 'react';
import {ProteinViewer,type ProteinCamera} from '../components/ProteinViewer';
import type {Representation} from '../rendering/ProteinScene';
import {ubiquitin,ubiquitinBonds,ubiquitinExposure,UBIQUITIN_SOURCE} from '../protein/ubiquitin';
import {composition,findExceptions,formatExposure,groupIndices,polarContacts,GROUP_FRACTION,type ExposureGroup} from '../protein/exposure';
import {CLASS_CAVEATS,CLASS_INFO,CLASS_ORDER,RESIDUE_NAMES} from '../protein/chemistry';
import {EXPOSURE_STOPS,hex,type ColorScheme} from '../protein/colors';
import {PROBE_RADIUS,SASA_POINTS} from '../protein/sasa';

// SASA is computed once, on first opening of this module (not at app start).
let cached:ReturnType<typeof analyze>|null=null;
function analyze(){
 const residues=ubiquitinExposure().residues;
 const groups={buried:groupIndices(residues,'buried'),exposed:groupIndices(residues,'exposed'),all:groupIndices(residues,'all')};
 return {residues,groups,exceptions:findExceptions(ubiquitin,residues),compositions:{buried:composition(residues,groups.buried),exposed:composition(residues,groups.exposed),all:composition(residues,groups.all)}};
}
const titleCase=(name:string)=>name[0]+name.slice(1).toLowerCase();
const SECONDARY={helix:'α-helix',helix310:'3₁₀-helix',strand:'β-strand',other:'loop / 기타'} as const;
const defaults={representation:'ribbon' as Representation,color:'default' as ColorScheme,group:'all' as ExposureGroup,selected:null as number|null,clip:null as number|null};

function Segmented<V extends string>({label,value,options,onChange}:{label:string;value:V;options:readonly (readonly [V,string])[];onChange:(v:V)=>void}){
 return <fieldset className="segmented"><legend>{label}</legend><div role="group" aria-label={label}>{options.map(([v,text])=><button key={v} aria-pressed={value===v} onClick={()=>onChange(v)}>{text}</button>)}</div></fieldset>;
}

export function HydrophobicCoreLab(){
 const {residues,groups,exceptions,compositions}=cached??=analyze(),total=residues.length,groupSize=Math.round(total*GROUP_FRACTION);
 const residueName=(i:number)=>`${titleCase(residues[i].resName)} ${residues[i].resSeq}`;
 const [representation,setRepresentation]=useState(defaults.representation),[color,setColor]=useState(defaults.color),[group,setGroup]=useState(defaults.group);
 const [selected,setSelected]=useState<number|null>(defaults.selected),[clip,setClip]=useState<number|null>(defaults.clip),[camera,setCamera]=useState<ProteinCamera>({view:'reset',token:0});
 const view=useMemo(()=>({representation,color,highlighted:groups[group],filtered:group!=='all',selected,clip}),[representation,color,group,selected,clip,groups]);
 const changeCamera=(v:ProteinCamera['view'])=>setCamera(c=>({view:v,token:c.token+1}));
 const reset=()=>{setRepresentation(defaults.representation);setColor(defaults.color);setGroup(defaults.group);setSelected(null);setClip(null);changeCamera('reset');};
 const explore=(index:number,g:ExposureGroup)=>{setGroup(g);setColor('chemistry');setSelected(index);};
 const r=selected===null?null:residues[selected],pdbResidue=selected===null?null:ubiquitin.residues[selected];
 const contacts=selected===null?[]:polarContacts(ubiquitin,selected).slice(0,3);
 const location=r===null?'':groups.buried.has(r.index)?`이 단백질에서 가장 묻힌 ${groupSize}개(25%)에 속함`:groups.exposed.has(r.index)?`이 단백질에서 가장 노출된 ${groupSize}개(25%)에 속함`:'이 단백질에서 중간 범위';
 return <main className="helix-lab core-lab" data-group={group}>
  <section className="module-heading"><div><p className="eyebrow">CHAPTER 2 · FROM SEQUENCE TO STRUCTURE</p><h2>Hydrophobic Core</h2><p>단백질 표면과 내부에는 어떤 종류의 side chain이 더 많이 존재할까?</p></div><span className="model-tag">PDB {UBIQUITIN_SOURCE.pdbId} · human ubiquitin<strong>Experimental X-ray structure · chain A · 76 residues</strong></span></section>
  <div className="lab-grid helix-grid">
   <section className="viewer-panel" aria-label="3D ubiquitin structure">
    <div className="panel-heading"><h3>Ubiquitin ({UBIQUITIN_SOURCE.pdbId})</h3><span className="badge">{group==='all'?`ALL ${total} RESIDUES`:group==='buried'?`MORE BURIED ${groupSize}`:`MORE EXPOSED ${groupSize}`}</span></div>
    <div className="camera-presets"><button onClick={()=>changeCamera('reset')}>Reset camera</button><button onClick={()=>changeCamera('fit')}>Fit structure</button></div>
    <ProteinViewer structure={ubiquitin} bonds={ubiquitinBonds} exposure={residues} view={view} camera={camera} onPick={setSelected}/>
    <div className="viewer-footer"><span>드래그 회전 · 휠 확대 · 클릭으로 residue 선택 · 방향키 / + −</span><span className="select-key">자주색 halo = 선택 residue</span></div>
    <div className="legend" data-testid="color-legend">{color==='chemistry'?<>{CLASS_ORDER.map(c=><span key={c}><i style={{background:CLASS_INFO[c].css}}/>{CLASS_INFO[c].symbol} {CLASS_INFO[c].label}</span>)}<span>backbone = 회색</span></>
     :color==='exposure'?<span className="exposure-legend">more buried <b style={{background:`linear-gradient(90deg,${EXPOSURE_STOPS.map(hex).join(',')})`}}/> more exposed <small>(relative SASA 0 → ≥100%)</small></span>
     :<><span><i className="carbon"/>C</span><span><i className="nitrogen"/>N</span><span><i className="oxygen"/>O</span><span><i style={{background:'#d8b21d'}}/>S</span><span>Ribbon = backbone fold</span></>}</div>
    <div className="helix-tip">{group==='buried'?`solvent exposure가 가장 낮은 ${groupSize}개 residue만 강조했습니다. 어떤 chemistry가 많이 보이나요?`:group==='exposed'?`solvent exposure가 가장 높은 ${groupSize}개 residue만 강조했습니다. 표면에 어떤 chemistry가 섞여 있나요?`:'Ribbon에서 α-helix와 β-sheet를 찾은 뒤, Color by chemistry와 Exposure 필터로 내부와 표면을 비교해 보세요.'}</div>
   </section>
   <aside className="plot-panel residue-panel" aria-label="Selected residue">
    <div className="panel-heading"><h3>Selected residue</h3><span className="badge">MEASURED</span></div>
    <label className="residue-select">Residue <select aria-label="Select residue" value={selected??''} onChange={e=>setSelected(e.target.value===''?null:Number(e.target.value))}><option value="">선택 안 함</option>{residues.map(x=><option key={x.index} value={x.index}>{residueName(x.index)}</option>)}</select></label>
    {r&&pdbResidue?<div className="residue-info" data-testid="residue-info">
     <p className="residue-title">{residueName(r.index)}</p>
     <p className="small">{RESIDUE_NAMES[r.resName]} · {r.resName} · residue {r.resSeq} · chain {ubiquitin.chain}</p>
     <dl>
      <dt>Class</dt><dd data-testid="residue-class"><i className="class-swatch" style={{background:CLASS_INFO[r.chemical].css}}/>{CLASS_INFO[r.chemical].symbol} {CLASS_INFO[r.chemical].label} <small>{CLASS_INFO[r.chemical].korean}</small></dd>
      <dt>Relative solvent exposure</dt><dd data-testid="residue-exposure"><strong>{formatExposure(r.relative)}</strong>
       <span className="exposure-bar" aria-hidden="true"><b style={{left:`${Math.min(r.relative,1)*100}%`}}/></span><span className="bar-ends"><span>more buried</span><span>more exposed</span></span></dd>
      <dt>Location</dt><dd data-testid="residue-location">{location}<br/><small>노출 순위 {r.rank} / {total} (1 = 가장 묻힘)</small></dd>
      <dt>Secondary structure</dt><dd>{SECONDARY[pdbResidue.secondary]} <small>(PDB 파일 HELIX/SHEET 기록)</small></dd>
     </dl>
     <p className="small">SASA {r.sasa.toFixed(1)} Å² · side chain {r.sideChainSasa.toFixed(1)} Å²</p>
     {CLASS_CAVEATS[r.resName]&&<p className="note">{CLASS_CAVEATS[r.resName]}</p>}
     {r.relative>=1&&<p className="note">C-말단 residue는 추가 원자(OXT)가 있고 기준값은 사슬 내부 Gly-X-Gly이므로 100%를 넘을 수 있습니다.</p>}
     {pdbResidue.occupancy<1&&<p className="note">Occupancy {pdbResidue.occupancy}: 이 C-말단 구간은 PDB 파일에서 부분 occupancy로 모델링되어 좌표 해석에 주의가 필요합니다.</p>}
     {contacts.length>0&&<p className="note" data-testid="polar-contacts">Side-chain N/O ↔ 다른 residue N/O ≤ 3.5 Å: {contacts.map(c=>`${c.partner} ${c.distance.toFixed(2)} Å`).join(' · ')}<br/><small>거리만 계산했습니다. 수소 위치·각도를 확인하지 않았으므로 H-bond로 판정하지 않습니다.</small></p>}
    </div>:<p className="empty">3D 구조에서 residue를 클릭하거나 목록에서 선택하세요.</p>}
    <details className="observe" data-testid="composition">
     <summary>관찰 후 확인하기 · 이 구조에서 관찰된 분포</summary>
     <div className="table-wrap"><table><thead><tr><th>Group</th>{CLASS_ORDER.map(c=><th key={c}><i className="class-swatch" style={{background:CLASS_INFO[c].css}}/>{CLASS_INFO[c].symbol} {c==='polar'?'Polar':CLASS_INFO[c].label}</th>)}</tr></thead>
      <tbody>{(['buried','exposed','all'] as const).map(g=>{const c=compositions[g];return <tr key={g} data-testid={`composition-${g}`}><th>{g==='buried'?`More buried ${c.total}`:g==='exposed'?`More exposed ${c.total}`:`All ${c.total}`}</th>{CLASS_ORDER.map(k=><td key={k}>{c[k]}{k==='nonpolar'&&c.glycine>0&&<small> (Gly {c.glycine})</small>}</td>)}</tr>;})}</tbody></table></div>
     <p className="small">이 한 단백질(1UBQ)에서 relative SASA 순위로 나눈 결과입니다. 모든 단백질에 적용되는 보편적 비율이 아닙니다. 이는 통계적 경향이며 예외가 존재합니다. Gly는 side chain이 H 하나뿐이지만 nonpolar로 셌습니다.</p>
     <div className="exceptions"><p><strong>Explore an exception</strong></p>
      {exceptions.exposedNonpolar&&<button onClick={()=>explore(exceptions.exposedNonpolar!.index,'exposed')}>표면의 nonpolar · {residueName(exceptions.exposedNonpolar.index)} ({formatExposure(exceptions.exposedNonpolar.relative)})</button>}
      {exceptions.buriedPolar&&<button onClick={()=>explore(exceptions.buriedPolar!.index,'buried')}>내부의 polar · {residueName(exceptions.buriedPolar.index)} ({formatExposure(exceptions.buriedPolar.relative)})</button>}
      <p className="small">묻힌 polar group은 다른 단백질 원자와 hydrogen bond 등 유리한 상호작용을 형성하는 경우가 많습니다.</p></div>
    </details>
   </aside>
  </div>
  <section className="controls core-controls" aria-label="Hydrophobic core display controls">
   <Segmented label="Representation" value={representation} onChange={setRepresentation} options={[['ribbon','Ribbon'],['atoms','Atoms / sticks'],['spacefill','Space filling']] as const}/>
   <Segmented label="Color by" value={color} onChange={setColor} options={[['default','Default'],['chemistry','Chemistry'],['exposure','Exposure']] as const}/>
   <Segmented label="Exposure (이 단백질 안에서 상대적으로)" value={group} onChange={setGroup} options={[['all','All'],['buried','More buried 25%'],['exposed','More exposed 25%']] as const}/>
   <fieldset className="clip-control"><legend>Interior view · 단면 보기 (visual clipping)</legend>
    <label className="toggles"><input type="checkbox" checked={clip!==null} onChange={e=>setClip(e.target.checked?0.5:null)}/>단면 보기</label>
    <label className="clip-slider">절단 깊이 <input type="range" aria-label="Clipping depth" min={0} max={100} step={1} disabled={clip===null} value={Math.round((clip??0.5)*100)} onChange={e=>setClip(Number(e.target.value)/100)}/><output>{clip===null?'off':`앞에서 ${Math.round(clip*100)}%`}</output></label>
    <button onClick={()=>setClip(null)}>단면 초기화</button>
   </fieldset>
   <div className="presets"><button onClick={reset}>전체 초기화</button></div>
  </section>
  <section className="teaching">
   <div><h3>01 · Core = 물이 닿지 않는 내부</h3><p>Hydrophobic core는 기하학적 중심점이 아니라 solvent가 접근하기 어려운 buried interior입니다. 여기서는 중심까지의 거리 대신 원자 좌표로 solvent-accessible surface area를 계산합니다.</p></div>
   <div><h3>02 · Hydrophobic effect</h3><p>수용액에서 nonpolar surface가 물에 노출되는 면적을 줄이는 것은 protein folding의 중요한 열역학적 기여 중 하나입니다. 비극성 side chain끼리 강하게 끌어당긴다는 뜻이 아닙니다.</p></div>
   <div><h3>03 · 경향이지 규칙이 아님</h3><p>표면에도 nonpolar residue가 있고, 내부에도 polar residue가 있을 수 있습니다. 이는 통계적 경향이며 예외가 존재합니다.</p></div>
  </section>
  <section className="helix-notes">
   <p>이전에 본 α-helix와 β-sheet가 하나의 실제 globular protein 안에서 함께 존재합니다. Ribbon 보기에서 찾아보세요.</p>
   <p>이 화면은 이미 접힌 실험 구조를 분석합니다. 접히는 경로를 보여주지 않습니다. 단백질은 실제로 움직이며, 이 좌표는 결정 안의 한 conformer입니다.</p>
   <p>결정 구조에 있는 물 분자 {ubiquitin.omitted.waters}개는 residue 분포를 보기 위해 화면과 SASA 계산에서 숨겼습니다. 물이 없다는 뜻이 아닙니다. 단면 보기는 화면에서만 잘라 보는 도구이며 원자 좌표는 바뀌지 않습니다.</p>
   <details><summary>계산 방법과 단순화 보기</summary>
    <p>Solvent exposure: Shrake–Rupley 알고리즘, probe 반지름 {PROBE_RADIUS} Å, 원자당 {SASA_POINTS}개 점, Bondi vdW 반지름 C 1.70 / N 1.55 / O 1.52 / S 1.80 Å. X-ray 구조에 없는 수소는 추가하지 않고 heavy atom 좌표만 사용합니다.</p>
    <p>Relative exposure = residue SASA ÷ Tien et al. (2013) theoretical maximum ASA (Gly-X-Gly). 기준값은 다른 radii/프로그램으로 계산되었으므로 근사적 정규화입니다. 25% 그룹은 절대 기준값이 아니라 이 단백질 안에서의 순위입니다.</p>
    <p>Space filling은 원자 vdW 구의 표현이며 molecular surface 계산이 아닙니다. 색 분류는 교육용 4분류이며 Tyr, Cys, His, Gly 등은 단순 분류로 성질이 완전히 설명되지 않습니다.</p>
    <p data-testid="structure-source">Structure: RCSB PDB {UBIQUITIN_SOURCE.pdbId}, {UBIQUITIN_SOURCE.method}, {UBIQUITIN_SOURCE.resolution} Å, chain {UBIQUITIN_SOURCE.chain}, {ubiquitin.atoms.length} heavy atoms. Vijay-Kumar, Bugg &amp; Cook (1987) J. Mol. Biol. 194:531–544.</p>
   </details>
  </section>
 </main>;
}
