import {useMemo,useState} from 'react';
import {ProteinViewer,type ProteinCamera} from '../components/ProteinViewer';
import {Segmented} from '../components/Segmented';
import type {Representation} from '../rendering/ProteinScene';
import {ubiquitin,ubiquitinBonds,ubiquitinExposure,UBIQUITIN_SOURCE} from '../protein/ubiquitin';
import {ompx,ompxBonds,ompxAnalysis,OMPX_OPM,OMPX_SLAB,OMPX_SOURCE} from '../protein/ompx';
import {countClasses,findMembraneExamples,formatDepth,highlightIndices,SURFACE_THRESHOLD,type Highlight,type ResidueMembrane} from '../protein/membrane';
import {formatExposure} from '../protein/exposure';
import {CLASS_CAVEATS,CLASS_INFO,CLASS_ORDER,RESIDUE_NAMES} from '../protein/chemistry';
import {type ColorScheme} from '../protein/colors';
import {PROBE_RADIUS,SASA_POINTS} from '../protein/sasa';

type Protein='soluble'|'membrane';
// SASA for both proteins is computed once, when this module is first opened (shared Phase 3A code).
let cached:ReturnType<typeof analyze>|null=null;
function analyze(){
 const soluble=ubiquitinExposure().residues,{exposure,membrane}=ompxAnalysis(),residues=exposure.residues;
 const sets={soluble:{surface:highlightIndices(soluble,null,'surface'),buried:highlightIndices(soluble,null,'buried')},membrane:{lipid:highlightIndices(residues,membrane,'lipid'),aqueous:highlightIndices(residues,membrane,'aqueous'),buried:highlightIndices(residues,membrane,'buried')}};
 return {soluble,residues,membrane,examples:findMembraneExamples(ompx,residues,membrane),
  compositions:[
   ['ubq-surface','Ubiquitin · surface',countClasses(soluble,sets.soluble.surface)],
   ['ubq-buried','Ubiquitin · buried',countClasses(soluble,sets.soluble.buried)],
   ['ompx-lipid','OmpX · lipid-facing',countClasses(residues,sets.membrane.lipid)],
   ['ompx-aqueous','OmpX · aqueous-facing',countClasses(residues,sets.membrane.aqueous)],
   ['ompx-buried','OmpX · buried',countClasses(residues,sets.membrane.buried)],
  ] as const};
}
const titleCase=(name:string)=>name[0]+name.slice(1).toLowerCase();
const SECONDARY={helix:'α-helix',helix310:'3₁₀-helix',strand:'β-strand',other:'loop / 기타'} as const;
const CATEGORY={'lipid-facing':'Lipid-facing candidate','aqueous-facing':'Aqueous-facing surface',buried:'Buried (surface accessibility < 25%)'} as const;
const ZONE={membrane:'막 hydrophobic region 안','sideA':'막 hydrophobic region 밖 · Side A (+z)','sideB':'막 hydrophobic region 밖 · Side B (−z)'} as const;
const defaults={representation:'ribbon' as Representation,color:'default' as ColorScheme,highlight:'all' as Highlight,membrane:false,selected:null as {protein:Protein;index:number}|null};
const pct=Math.round(SURFACE_THRESHOLD*100);

export function SolubleMembraneLab(){
 const {soluble,residues,membrane,examples,compositions}=cached??=analyze();
 const [representation,setRepresentation]=useState(defaults.representation),[color,setColor]=useState(defaults.color),[highlight,setHighlight]=useState(defaults.highlight);
 const [showMembrane,setShowMembrane]=useState(defaults.membrane),[selected,setSelected]=useState(defaults.selected);
 const [solubleCamera,setSolubleCamera]=useState<ProteinCamera>({view:'reset',token:0}),[membraneCamera,setMembraneCamera]=useState<ProteinCamera>({view:'reset',token:0});
 const bump=(set:typeof setSolubleCamera,view:ProteinCamera['view'])=>set(c=>({view,token:c.token+1}));
 const highlights={soluble:useMemo(()=>highlightIndices(soluble,null,highlight),[soluble,highlight]),membrane:useMemo(()=>highlightIndices(residues,membrane,highlight),[residues,membrane,highlight])};
 const solubleView=useMemo(()=>({representation,color,highlighted:highlights.soluble,filtered:highlight!=='all',selected:selected?.protein==='soluble'?selected.index:null,clip:null}),[representation,color,highlight,highlights.soluble,selected]);
 const membraneView=useMemo(()=>({representation,color,highlighted:highlights.membrane,filtered:highlight!=='all',selected:selected?.protein==='membrane'?selected.index:null,clip:null,membrane:showMembrane}),[representation,color,highlight,highlights.membrane,selected,showMembrane]);
 const reset=()=>{setRepresentation(defaults.representation);setColor(defaults.color);setHighlight(defaults.highlight);setShowMembrane(defaults.membrane);setSelected(null);bump(setSolubleCamera,'reset');bump(setMembraneCamera,'reset');};
 const explore=(m:ResidueMembrane|null,h:Highlight)=>{if(!m)return;setHighlight(h);setColor('chemistry');setShowMembrane(true);setSelected({protein:'membrane',index:m.index});};
 const name=(p:Protein,i:number)=>{const r=p==='soluble'?soluble[i]:residues[i];return `${titleCase(r.resName)} ${r.resSeq}`;};
 const tip={all:'두 구조를 회전해 본 뒤 Color를 Chemistry로 바꾸고, 막 표시와 Highlight를 차례로 켜 보세요.',surface:`두 단백질의 표면 residue(surface accessibility ≥ ${pct}%)만 강조했습니다.`,buried:`두 단백질에서 surface accessibility < ${pct}%인 residue만 강조했습니다.`,
  lipid:`OmpX에서 막 hydrophobic region 안에 있으면서 표면에 드러난 residue만 강조했습니다. 수용성 ubiquitin에는 막 영역이 없으므로 강조되는 residue가 없습니다.`,
  aqueous:'OmpX에서는 막 hydrophobic region 밖의 표면 residue, ubiquitin에서는 모든 표면 residue(막이 없으므로)를 강조했습니다.'}[highlight];
 const sel=selected,r=sel?(sel.protein==='soluble'?soluble[sel.index]:residues[sel.index]):null,m=sel?.protein==='membrane'?membrane[sel.index]:null,pdb=sel?(sel.protein==='soluble'?ubiquitin:ompx).residues[sel.index]:null;
 const exampleButtons=[
  [examples.lipidNonpolar,'lipid','막을 향한 nonpolar'],[examples.aqueousCharged,'aqueous','물 쪽 표면의 charged'],[examples.lipidPolar,'lipid','막을 향한 polar (예외)'],[examples.buriedCharged,'buried','막 높이지만 barrel 안쪽을 향한 charged'],
 ] as const;
 return <main className="helix-lab core-lab membrane-lab" data-highlight={highlight}>
  <section className="module-heading"><div><p className="eyebrow">CHAPTER 2 · FROM SEQUENCE TO STRUCTURE</p><h2>Soluble vs Membrane Protein</h2><p>왜 두 단백질의 표면 chemistry가 다를까? 같은 색 기준으로 두 실험 구조를 비교해 보세요.</p></div>
   <span className="model-tag">PDB {UBIQUITIN_SOURCE.pdbId} · PDB {OMPX_SOURCE.pdbId}<strong>Experimental X-ray structures · same chemistry colors</strong></span></section>
  <section className="controls core-controls compare-controls" aria-label="Comparison display controls">
   <Segmented label="Representation (두 구조 공통)" value={representation} onChange={setRepresentation} options={[['ribbon','Ribbon'],['atoms','Atoms / sticks'],['spacefill','Space filling']] as const}/>
   <Segmented label="Color (두 구조 공통)" value={color} onChange={setColor} options={[['default','Default'],['chemistry','Chemistry']] as const}/>
   <Segmented label="Highlight" value={highlight} onChange={setHighlight} options={[['all','All'],['surface','Surface'],['buried','Buried'],['lipid','Lipid-facing'],['aqueous','Aqueous-facing']] as const}/>
   <fieldset className="membrane-toggle"><legend>Membrane (OmpX)</legend>
    <label className="toggles"><input type="checkbox" checked={showMembrane} onChange={e=>setShowMembrane(e.target.checked)}/>Show membrane</label>
    <button onClick={reset}>전체 초기화</button></fieldset>
  </section>
  <div className="helix-tip compare-tip">{tip}</div>
  <div className="compare-grid">
   <section className="viewer-panel" aria-label="Soluble protein: ubiquitin">
    <div className="panel-heading"><h3><small>Soluble protein</small>Ubiquitin ({UBIQUITIN_SOURCE.pdbId})</h3><span className="badge" data-testid="soluble-count">{highlights.soluble.size} / {soluble.length} RESIDUES</span></div>
    <div className="camera-presets"><button onClick={()=>bump(setSolubleCamera,'reset')}>Reset camera</button><button onClick={()=>bump(setSolubleCamera,'fit')}>Fit structure</button></div>
    <ProteinViewer testId="soluble-viewer" structure={ubiquitin} bonds={ubiquitinBonds} exposure={soluble} view={solubleView} camera={solubleCamera} onPick={i=>setSelected({protein:'soluble',index:i})}/>
    <div className="viewer-footer"><span>수용액 환경 · 막 없음</span><span>drag 회전 · 휠 확대 · 클릭 선택</span></div>
   </section>
   <section className="viewer-panel" aria-label="Membrane protein: OmpX">
    <div className="panel-heading"><h3><small>Membrane protein</small>OmpX ({OMPX_SOURCE.pdbId})</h3><span className="badge" data-testid="membrane-count">{highlights.membrane.size} / {residues.length} RESIDUES</span></div>
    <div className="camera-presets"><button onClick={()=>bump(setMembraneCamera,'side')}>Side view</button><button onClick={()=>bump(setMembraneCamera,'top')}>Top view</button><button onClick={()=>bump(setMembraneCamera,'fit')}>Fit structure</button></div>
    <ProteinViewer testId="membrane-viewer" structure={ompx} bonds={ompxBonds} exposure={residues} view={membraneView} camera={membraneCamera} onPick={i=>setSelected({protein:'membrane',index:i})}
     options={{membrane:OMPX_SLAB,ariaLabel:'OmpX 막단백질 3D 구조. 막 법선이 화면 위아래 방향. 드래그로 회전, 휠로 확대, 클릭으로 residue 선택. 방향키로 회전, 더하기와 빼기로 확대 축소.'}}/>
    <div className="viewer-footer"><span>{showMembrane?`반투명 slab = 막 hydrophobic region (OPM, ${OMPX_OPM.thickness} Å) · 지질 원자가 아닌 위치 안내`:'Show membrane으로 막 hydrophobic region 표시'}</span><span className="select-key">자주색 halo = 선택 residue</span></div>
   </section>
  </div>
  <div className="legend compare-legend" data-testid="color-legend">{color==='chemistry'?<>{CLASS_ORDER.map(c=><span key={c}><i style={{background:CLASS_INFO[c].css}}/>{CLASS_INFO[c].symbol} {CLASS_INFO[c].label}</span>)}<span>backbone = 회색 · 두 구조 같은 색 기준</span></>
   :<><span><i className="carbon"/>C</span><span><i className="nitrogen"/>N</span><span><i className="oxygen"/>O</span><span><i style={{background:'#d8b21d'}}/>S</span><span>Ribbon = backbone fold</span></>}</div>
  <div className="lab-grid compare-details">
   <aside className="plot-panel residue-panel" aria-label="Selected residue">
    <div className="panel-heading"><h3>Selected residue</h3><span className="badge">{sel?(sel.protein==='soluble'?'UBIQUITIN':'OMPX'):'MEASURED'}</span></div>
    <label className="residue-select">Residue <select aria-label="Select residue" value={sel?`${sel.protein}:${sel.index}`:''} onChange={e=>{const [p,i]=e.target.value.split(':');setSelected(e.target.value===''?null:{protein:p as Protein,index:Number(i)});}}>
     <option value="">선택 안 함</option>
     <optgroup label="Ubiquitin (1UBQ)">{soluble.map(x=><option key={x.index} value={`soluble:${x.index}`}>{name('soluble',x.index)}</option>)}</optgroup>
     <optgroup label="OmpX (1QJ8)">{residues.map(x=><option key={x.index} value={`membrane:${x.index}`}>{name('membrane',x.index)}</option>)}</optgroup>
    </select></label>
    {sel&&r&&pdb?<div className="residue-info" data-testid="residue-info">
     <p className="residue-title">{name(sel.protein,sel.index)} <small>{sel.protein==='soluble'?'Ubiquitin':'OmpX'}</small></p>
     <p className="small">{RESIDUE_NAMES[r.resName]} · {r.resName} · residue {r.resSeq} · chain {pdb.chain}</p>
     <dl>
      <dt>Class</dt><dd data-testid="residue-class"><i className="class-swatch" style={{background:CLASS_INFO[r.chemical].css}}/>{CLASS_INFO[r.chemical].symbol} {CLASS_INFO[r.chemical].label} <small>{CLASS_INFO[r.chemical].korean}</small></dd>
      <dt>Surface accessibility</dt><dd data-testid="residue-accessibility"><strong>{formatExposure(r.relative)}</strong> <small>{r.relative>=SURFACE_THRESHOLD?`surface (≥ ${pct}%)`:`buried (< ${pct}%)`}</small>
       <span className="exposure-bar" aria-hidden="true"><b style={{left:`${Math.min(r.relative,1)*100}%`}}/></span><span className="bar-ends"><span>less accessible</span><span>more accessible</span></span></dd>
      {m?<>
       <dt>Membrane depth</dt><dd data-testid="residue-depth"><strong>{formatDepth(m.depth)}</strong> <small>막 중심에서 side chain 중심까지 (Cα {formatDepth(m.caDepth)}) · 경계 ±{OMPX_SLAB.halfThickness} Å</small></dd>
       <dt>Region</dt><dd data-testid="residue-zone">{ZONE[m.zone]}</dd>
       <dt>Classification</dt><dd data-testid="residue-category"><strong>{CATEGORY[m.category]}</strong><br/><small>계산 기준: 막 hydrophobic region 안/밖 + surface accessibility ≥ {pct}%. 실제 지질 결합을 관찰한 것이 아닙니다.</small></dd>
      </>:<><dt>Environment</dt><dd data-testid="residue-zone">수용성 단백질 · 막 영역 없음 <small>(표면은 모두 물과 접하는 환경)</small></dd></>}
      <dt>Secondary structure</dt><dd>{SECONDARY[pdb.secondary]} <small>(PDB 파일 HELIX/SHEET 기록)</small></dd>
     </dl>
     <p className="small">SASA {r.sasa.toFixed(1)} Å² · side chain {r.sideChainSasa.toFixed(1)} Å² · 단백질만 놓고 계산한 값</p>
     {CLASS_CAVEATS[r.resName]&&<p className="note">{CLASS_CAVEATS[r.resName]}</p>}
     {m&&r.resName==='TYR'&&m.category==='lipid-facing'&&<p className="note">Tyr은 교육용 4분류에서 polar로 세지만 방향족 고리는 비극성입니다. 막 경계 가까이에서 자주 관찰됩니다.</p>}
     {m&&m.zone==='membrane'&&m.category==='buried'&&r.chemical!=='nonpolar'&&<p className="note">막 높이에 있지만 surface accessibility가 낮습니다. 막 쪽이 아니라 단백질 안쪽을 향한 residue일 수 있습니다.</p>}
     {sel.protein==='membrane'&&r.resSeq===100&&<p className="note">이 결정 구조에서 residue 100은 His→Asn으로 바꾼 engineered mutation입니다 (PDB SEQADV).</p>}
     {pdb.occupancy<1&&<p className="note">Occupancy {pdb.occupancy}: PDB 파일에 alternate conformation이 있어 가장 높은 occupancy의 좌표를 사용했습니다.</p>}
     {r.relative>=1&&<p className="note">말단 residue는 기준값(Gly-X-Gly)보다 노출될 수 있어 100%를 넘을 수 있습니다.</p>}
    </div>:<p className="empty">두 3D 구조 중 하나에서 residue를 클릭하거나 목록에서 선택하세요.</p>}
   </aside>
   <section className="observe-panel" aria-label="Observation">
    <details className="observe" data-testid="composition">
     <summary>관찰 후 확인하기 · 두 구조에서 관찰된 표면 chemistry</summary>
     <div className="table-wrap"><table><thead><tr><th>Group</th>{CLASS_ORDER.map(c=><th key={c}><i className="class-swatch" style={{background:CLASS_INFO[c].css}}/>{CLASS_INFO[c].symbol} {c==='polar'?'Polar':CLASS_INFO[c].label}</th>)}<th>Total</th></tr></thead>
      <tbody>{compositions.map(([key,label,c])=><tr key={key} data-testid={`composition-${key}`}><th>{label}</th>{CLASS_ORDER.map(k=><td key={k}>{c[k]}{k==='nonpolar'&&c.glycine>0&&<small> (Gly {c.glycine})</small>}</td>)}<td>{c.total}</td></tr>)}</tbody></table></div>
     <p className="small">Surface = 단백질만 놓고 계산한 relative SASA ≥ {pct}%. OmpX lipid-facing = side chain 중심이 OPM 막 hydrophobic region(±{OMPX_SLAB.halfThickness} Å) 안 + surface. Aqueous-facing = region 밖 + surface. 두 단백질 각 1개 구조의 값이며 보편적 비율이 아닙니다.</p>
     <div className="compare-statements">
      <p><strong>Soluble protein</strong> Hydrophobic residues often buried from water.</p>
      <p><strong>Membrane protein</strong> Hydrophobic residues can face the lipid bilayer.</p>
      <p><strong>Environment changes which surfaces are favorable.</strong> 수용액에서는 nonpolar 표면이 물에 노출되는 것이 불리합니다. 막의 탄화수소(acyl chain) 내부는 nonpolar 표면을 수용할 수 있는 환경입니다. 그래서 같은 nonpolar side chain도 단백질 내부 또는 막을 향한 바깥면에 놓일 수 있습니다.</p>
     </div>
     <div className="exceptions"><p><strong>Explore residues</strong> <small>(데이터에서 규칙으로 고름)</small></p>
      {exampleButtons.map(([ex,h,label])=>ex&&<button key={label} onClick={()=>explore(ex,h)}>{label} · {name('membrane',ex.index)} ({formatExposure(residues[ex.index].relative)}, {formatDepth(ex.depth)})</button>)}
      <p className="small">막 영역에도 polar residue가 있고, 막 높이의 charged residue가 barrel 안쪽을 향할 수 있습니다. 막 영역 = 모두 소수성은 아닙니다.</p></div>
    </details>
   </section>
  </div>
  <section className="teaching">
   <div><h3>01 · 같은 기준, 다른 환경</h3><p>두 구조 모두 Phase 3A와 같은 Shrake–Rupley SASA와 같은 4분류 색을 사용합니다. 달라진 것은 단백질이 놓이는 환경입니다.</p></div>
   <div><h3>02 · Membrane slab</h3><p>반투명 slab는 OPM이 계산한 막 hydrophobic region의 위치(두께 {OMPX_OPM.thickness} Å)를 보여주는 기하학적 안내입니다. 실제 지질 분자를 그린 것이 아닙니다.</p></div>
   <div><h3>03 · Lipid bilayer 복습</h3><p>인지질 이중층의 가운데는 acyl chain의 탄화수소 영역이고, 양쪽 가장자리는 극성 head group 영역입니다. slab 경계 근처는 이 계면(interface)에 해당합니다.</p></div>
  </section>
  <section className="helix-notes">
   <p>Surface accessibility는 단백질만 놓고 계산한 값입니다. 막단백질에서는 표면이 물이 아니라 지질과 접할 수 있으므로 “물 노출”이라고 부르지 않습니다.</p>
   <p>이 화면은 정지된 결정 구조의 비교입니다. molecular dynamics simulation이 아니며, 막과 단백질은 실제로 움직입니다.</p>
   <details><summary>계산 방법과 단순화 보기</summary>
    <p>Surface accessibility: Shrake–Rupley, probe {PROBE_RADIUS} Å, 원자당 {SASA_POINTS}점, Bondi radii, heavy atom만 사용. relative = residue SASA ÷ Tien et al. (2013) 최대값. Surface 기준 ≥ {pct}%는 관례적 cut-off이며 15–30%에서도 경향을 확인했습니다.</p>
    <p>막 방향: OPM(Orientations of Proteins in Membranes) 1qj8 — hydrophobic thickness {OMPX_OPM.thickness} ± {OMPX_OPM.thicknessError} Å, 막 법선 = z축, 막 중심 z = 0. 원본 좌표에 rigid-body 회전·이동만 적용했습니다(OPM 좌표와 RMSD 0.002 Å). 화면 slab와 분류 경계는 같은 값(±{OMPX_SLAB.halfThickness} Å)입니다.</p>
    <p>Side A / Side B는 막의 두 aqueous 쪽을 중립적으로 부른 이름입니다. β-barrel 외막 단백질의 일반적 topology(긴 loop는 세포 밖, 짧은 turn과 N/C 말단은 periplasm)를 적용하면 긴 loop가 있는 Side A가 세포 밖, 양 말단이 있는 Side B가 periplasm 쪽입니다. 화면 표시는 구조만으로 확정하지 않기 위해 중립적인 이름을 씁니다.</p>
    <p>OmpX는 그람음성균 외막의 8-strand β-barrel monomer(PISA/OPM)입니다. 결정 속 detergent(C8E4), 백금 중원자 화합물, 물은 화면과 계산에서 제외했습니다. Tyr/Cys/His/Gly의 4분류 단순화는 Phase 3A와 같습니다.</p>
    <p data-testid="structure-source">Structures: RCSB PDB {UBIQUITIN_SOURCE.pdbId} ({UBIQUITIN_SOURCE.resolution} Å, chain A, {ubiquitin.atoms.length} heavy atoms); RCSB PDB {OMPX_SOURCE.pdbId}, {OMPX_SOURCE.method}, {OMPX_SOURCE.resolution} Å, chain {OMPX_SOURCE.chain}, {ompx.atoms.length} heavy atoms. Vogt &amp; Schulz (1999) Structure 7:1301–1309. Lomize et al., OPM database.</p>
   </details>
  </section>
 </main>;
}
