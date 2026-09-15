import {useEffect,useMemo,useState} from 'react';
import pdbUrl from '../data/structures/2DN2.pdb?url';
import {AssemblyViewer} from '../components/AssemblyViewer';
import {Segmented} from '../components/Segmented';
import type {Representation} from '../rendering/ProteinScene';
import type {AssemblyCamera,AssemblyColor,AssemblyPick} from '../rendering/AssemblyScene';
import {analyzeHemoglobin,hemoglobinSceneModel,residueLabel,EXPLODED_DISTANCE,GLOBIN_INFO,HEME_COLORS,HEMOGLOBIN_SOURCE,SUBUNIT_COLORS,TYPE_COLORS,type HemoglobinModel,type Subunit} from '../protein/hemoglobin';
import {RESIDUE_NAMES} from '../protein/chemistry';
import {pairBetween} from '../protein/quaternary';

// The deposited 2DN2 file is a separate static asset: fetched (same origin, no RCSB request) only when this module opens.
let pending:Promise<HemoglobinModel>|null=null;
const loadHemoglobin=()=>pending??=fetch(pdbUrl).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}).then(analyzeHemoglobin);

export function HemoglobinQuaternaryLab(){
 const [model,setModel]=useState<HemoglobinModel|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let live=true;loadHemoglobin().then(m=>{if(live)setModel(m);},e=>{if(live)setError(String(e));});return()=>{live=false;};},[]);
 if(error)return <main><p role="alert">PDB {HEMOGLOBIN_SOURCE.pdbId} 구조를 불러오지 못했습니다. ({error})</p></main>;
 if(!model)return <main><p>Loading PDB {HEMOGLOBIN_SOURCE.pdbId}…</p></main>;
 return <HemoglobinExplorer model={model}/>;
}

const defaults={representation:'ribbon' as Representation,color:'default' as AssemblyColor,focus:null as string|null,heme:true,interfaces:false,pair:null as string|null,exploded:false,selected:null as AssemblyPick|null};
const typeName=(s:Subunit)=>`${GLOBIN_INFO[s.type].symbol}-type · ${GLOBIN_INFO[s.type].name}`;

function HemoglobinExplorer({model}:{model:HemoglobinModel}){
 const scene=useMemo(()=>hemoglobinSceneModel(model),[model]),{structure,subunits,hemes,interfaces}=model;
 const [representation,setRepresentation]=useState(defaults.representation),[color,setColor]=useState(defaults.color),[focus,setFocus]=useState(defaults.focus);
 const [showHeme,setShowHeme]=useState(defaults.heme),[showInterfaces,setShowInterfaces]=useState(defaults.interfaces),[pair,setPair]=useState(defaults.pair);
 const [exploded,setExploded]=useState(defaults.exploded),[selected,setSelected]=useState(defaults.selected),[camera,setCamera]=useState<AssemblyCamera>({view:'reset',token:0});
 const bump=(view:AssemblyCamera['view'],chain:string|null=null)=>setCamera(c=>({view,chain,token:c.token+1}));
 const byChain=(chain:string)=>subunits.find(s=>s.chain===chain)!;
 const interfaceSet=useMemo(()=>{
  if(!showInterfaces)return null;
  const p=pair===null?null:interfaces.pairs.find(x=>x.chains.join('-')===pair);
  return new Set(p?[...p.residues[0],...p.residues[1]]:[...interfaces.partners.keys()]);
 },[showInterfaces,pair,interfaces]);
 const view=useMemo(()=>({representation,color,focus,showHeme,interfaces:interfaceSet,exploded,selected}),[representation,color,focus,showHeme,interfaceSet,exploded,selected]);
 const reset=()=>{setRepresentation(defaults.representation);setColor(defaults.color);setFocus(defaults.focus);setShowHeme(defaults.heme);setShowInterfaces(defaults.interfaces);setPair(defaults.pair);setExploded(defaults.exploded);setSelected(defaults.selected);bump('reset');};
 const focusHeme=(chain:string)=>{setFocus(chain);setShowHeme(true);setSelected({kind:'heme',index:byChain(chain).heme.group});bump('heme',chain);};
 const chainName=(chain:string)=>{const s=byChain(chain);return `${s.label} · Chain ${chain}`;};
 const focused=focus===null?null:byChain(focus);
 const pick=selected?.kind==='residue'?structure.residues[selected.index]:null,pickedHeme=selected?.kind==='heme'?hemes.find(h=>h.group===selected.index)!:null;
 const tip=exploded?'Subunits are visually separated for explanation. This is not an experimentally observed conformation. — 설명을 위해 subunit을 화면에서만 떼어 놓았습니다. 실험으로 관찰된 구조 상태가 아닙니다.'
  :showInterfaces?`Interface = 다른 chain의 heavy atom과 ${interfaces.cutoff.toFixed(1)} Å 이내에 있는 residue (좌표로 계산한 기하학적 접촉). 수소결합 하나로 연결되었다는 뜻이 아니며, 소수성 접촉·수소결합·이온 상호작용·van der Waals 접촉 등 여러 비공유 상호작용이 섞여 있을 수 있습니다.`
  :color==='default'?'구조를 돌려 본 뒤 Color를 By subunit으로 바꾸어 polypeptide chain이 몇 개인지 세어 보세요.'
  :color==='subunit'?'색 하나 = polypeptide chain 하나입니다. 빨간 stick(heme)은 polypeptide가 아니므로 subunit 수에 넣지 않습니다.'
  :'같은 색 = 같은 종류의 globin chain입니다. α와 β는 서로 다른 sequence를 가진 polypeptide입니다.';
 const legend=color==='subunit'?subunits.map(s=><span key={s.chain} data-testid={`legend-${s.chain}`}><i style={{background:SUBUNIT_COLORS[s.label].css}}/>{s.label} — Chain {s.chain}</span>)
  :color==='type'?(['alpha','beta'] as const).map(t=><span key={t}><i style={{background:TYPE_COLORS[t].css}}/>{GLOBIN_INFO[t].symbol} chains — {subunits.filter(s=>s.type===t).map(s=>`${s.label} (Chain ${s.chain})`).join(', ')}</span>)
  :[<span key="c"><i className="carbon"/>C</span>,<span key="n"><i className="nitrogen"/>N</span>,<span key="o"><i className="oxygen"/>O</span>,<span key="s"><i style={{background:'#d8b21d'}}/>S</span>,<span key="r">Ribbon = backbone fold</span>];
 const alphaCount=subunits.filter(s=>s.type==='alpha').length,betaCount=subunits.filter(s=>s.type==='beta').length;

 return <main className="helix-lab core-lab hb-lab" data-color={color} data-focus={focused?.label??'all'}>
  <section className="module-heading"><div><p className="eyebrow">CHAPTER 3 · FROM STRUCTURE TO FUNCTION</p><h2>Hemoglobin Quaternary Structure</h2><p>이 단백질은 몇 개의 polypeptide chain으로 이루어져 있을까?</p></div>
   <span className="model-tag">PDB {HEMOGLOBIN_SOURCE.pdbId} · human hemoglobin A<strong>Experimental X-ray structure · {HEMOGLOBIN_SOURCE.resolution} Å · deoxy state</strong></span></section>
  <section className="controls core-controls compare-controls hb-controls" aria-label="Hemoglobin display controls">
   <Segmented label="Representation" value={representation} onChange={setRepresentation} options={[['ribbon','Ribbon'],['atoms','Atoms / sticks'],['spacefill','Space filling']] as const}/>
   <Segmented label="Color" value={color} onChange={setColor} options={[['default','Default'],['subunit','By subunit'],['type','By chain type']] as const}/>
   <Segmented label="View" value={focus??'all'} onChange={v=>{setFocus(v==='all'?null:v);setSelected(null);}} options={[['all','Whole tetramer'],...subunits.map(s=>[s.chain,s.label] as const)] as const}/>
   <fieldset className="hb-toggles"><legend>Show</legend>
    <div className="toggles">
     <label><input type="checkbox" checked={showHeme} onChange={e=>{setShowHeme(e.target.checked);if(!e.target.checked&&selected?.kind==='heme')setSelected(null);}}/>Heme</label>
     <label><input type="checkbox" checked={showInterfaces} onChange={e=>setShowInterfaces(e.target.checked)}/>Interfaces</label>
     <label><input type="checkbox" checked={exploded} onChange={e=>setExploded(e.target.checked)}/>Separate subunits</label>
    </div>
    <button onClick={reset}>전체 초기화</button>
   </fieldset>
  </section>
  <div className={`helix-tip compare-tip${exploded?' exploded-note':''}`} data-testid="hb-tip">{tip}</div>
  <div className="lab-grid helix-grid hb-grid">
   <section className="viewer-panel" aria-label="3D hemoglobin tetramer">
    <div className="panel-heading"><h3>Hemoglobin A ({HEMOGLOBIN_SOURCE.pdbId})</h3><span className="badge" data-testid="view-badge">{focused?`${focused.label} · CHAIN ${focused.chain}`:'WHOLE TETRAMER'}</span></div>
    <div className="camera-presets"><button onClick={()=>bump('reset')}>Reset camera</button><button onClick={()=>bump('fit')}>Fit structure</button>
     <button onClick={()=>focused&&focusHeme(focused.chain)} disabled={!focused} title={focused?undefined:'View에서 subunit 하나를 먼저 고르세요'}>Focus heme</button></div>
    <AssemblyViewer testId="hb-viewer" model={scene} view={view} camera={camera} onPick={p=>{setSelected(p);}}
     ariaLabel="Hemoglobin tetramer 3D 구조 (PDB 2DN2). 드래그로 회전, 휠로 확대, 클릭으로 residue 또는 heme 선택. 방향키로 회전, 더하기와 빼기로 확대 축소."/>
    <div className="viewer-footer"><span>{exploded?`Separate subunits: 각 chain을 중심에서 바깥으로 ${EXPLODED_DISTANCE} Å 평행이동한 설명용 화면`:'drag 회전 · 휠 확대 · 클릭 선택 · 방향키 / + −'}</span><span className="select-key">자주색 halo = 선택</span></div>
    <div className="legend" data-testid="color-legend">{legend}
     {showHeme&&<><span><i style={{background:HEME_COLORS.css,borderRadius:2}}/>Heme (non-protein prosthetic group)</span><span><i style={{background:HEME_COLORS.ironCss}}/>Fe</span></>}</div>
   </section>
   <aside className="plot-panel residue-panel hb-panel" aria-label="Selection">
    <div className="panel-heading"><h3>Selected</h3><span className="badge">MEASURED</span></div>
    {pick?<div className="residue-info" data-testid="residue-info">
     <p className="residue-title">{residueLabel(pick)} <small>{byChain(pick.chain).label}</small></p>
     <p className="small">{RESIDUE_NAMES[pick.resName]} · {pick.resName} · residue {pick.resSeq}{pick.insertionCode} · PDB chain {pick.chain}</p>
     <dl>
      <dt>Subunit</dt><dd data-testid="residue-subunit">{chainName(pick.chain)} <small>{typeName(byChain(pick.chain))}</small></dd>
      <dt>Interface</dt><dd data-testid="residue-interface">{interfaces.partners.has(pick.index)?<>다른 chain과 접촉: {interfaces.partners.get(pick.index)!.map(c=>chainName(c)).join(', ')}</>:<>다른 chain과 {interfaces.cutoff.toFixed(1)} Å 이내 접촉 없음</>}</dd>
     </dl>
     <p className="small">Residue identity = chain + number + insertion code + name (<code>{pick.chain}:{pick.resSeq}{pick.insertionCode}:{pick.resName}</code>)</p>
    </div>:null}
    {pickedHeme?<div className="residue-info" data-testid="heme-info">
     <p className="residue-title">Heme {pickedHeme.number} / {hemes.length} <small>{byChain(pickedHeme.association.chain).label}</small></p>
     <p className="small">{pickedHeme.resName} {pickedHeme.resSeq} · PDB chain {pickedHeme.fileChain} · {pickedHeme.atomCount} heavy atoms · Fe 1</p>
     <dl>
      <dt>Belongs to</dt><dd>{chainName(pickedHeme.association.chain)} <small>(좌표로 확인: 4.5 Å 이내 protein 원자 {pickedHeme.association.contacts[pickedHeme.association.chain]}개가 이 chain)</small></dd>
      <dt>Kind</dt><dd>Non-protein prosthetic group — polypeptide subunit이 아닙니다.</dd>
      <dt>Nearest protein ligand</dt><dd data-testid="heme-proximal">Fe — {residueLabel(structure.residues[pickedHeme.proximal.residue])} {pickedHeme.proximal.atomName}: <strong>{pickedHeme.proximal.distance.toFixed(2)} Å</strong> <small>(proximal His, 좌표 측정)</small></dd>
     </dl>
    </div>:null}
    {focused?<div className="residue-info subunit-info" data-testid="subunit-info">
     <p className="residue-title"><i className="class-swatch" style={{background:SUBUNIT_COLORS[focused.label].css}}/>{focused.label} <small>Chain {focused.chain}</small></p>
     <dl>
      <dt>Globin type</dt><dd data-testid="subunit-type">{typeName(focused)} <small>UniProt {focused.uniprot} ({focused.entry})</small></dd>
      <dt>Residues</dt><dd data-testid="subunit-residues">sequence {focused.sequenceLength} · modeled {focused.modeledResidues} <small>(residue {focused.firstResSeq}–{focused.lastResSeq})</small></dd>
      <dt>Fold</dt><dd>HELIX 기록 residue {focused.residues.filter(i=>structure.residues[i].secondary!=='other'&&structure.residues[i].secondary!=='strand').length} / {focused.modeledResidues} <small>Ribbon에서 globin fold의 helix들을 확인하세요.</small></dd>
      <dt>Heme</dt><dd data-testid="subunit-heme">present — Heme {focused.heme.number} / {hemes.length} <small>({focused.heme.resName} {focused.heme.resSeq})</small></dd>
      <dt>Contacts</dt><dd data-testid="subunit-contacts">{subunits.filter(s=>s.chain!==focused.chain).map(s=>{const p=pairBetween(interfaces,focused.chain,s.chain);return <span key={s.chain} className="contact-row">{s.label}: {p?`${p.chains[0]===focused.chain?p.residues[0].length:p.residues[1].length} residues`:'접촉 없음'}</span>;})}</dd>
     </dl>
    </div>:!pick&&!pickedHeme?<p className="empty">View에서 subunit을 고르거나 3D 구조에서 residue 또는 heme을 클릭하세요.</p>:null}
    <div className="heme-list" data-testid="heme-list"><p><strong>Hemes</strong> <small>하나씩 찾아 확인하기</small></p>
     {hemes.map(h=><button key={h.group} aria-pressed={selected?.kind==='heme'&&selected.index===h.group} onClick={()=>focusHeme(h.association.chain)}>Heme {h.number} / {hemes.length} · {chainName(h.association.chain)}</button>)}
    </div>
    {showInterfaces&&<div className="interface-list" data-testid="interface-list"><p><strong>Subunit contacts</strong> <small>heavy atom ≤ {interfaces.cutoff.toFixed(1)} Å · residue 수</small></p>
     <button aria-pressed={pair===null} onClick={()=>setPair(null)}>All contacts · {interfaces.partners.size} residues</button>
     {interfaces.pairs.map(p=>{const key=p.chains.join('-');return <button key={key} aria-pressed={pair===key} data-testid={`pair-${key}`} onClick={()=>setPair(key)}>{byChain(p.chains[0]).label}–{byChain(p.chains[1]).label} · Chain {p.chains[0]}–{p.chains[1]} · {p.residues[0].length} + {p.residues[1].length}</button>;})}
     <p className="small">접촉 목록은 좌표에서 계산했습니다. 표시되지 않은 chain 쌍은 이 기준에서 접촉이 없습니다.</p>
    </div>}
   </aside>
  </div>
  <section className="levels" aria-label="Levels of protein structure">
   <div><strong>Primary</strong><span>sequence</span></div><div><strong>Secondary</strong><span>α-helix / β-sheet</span></div>
   <div><strong>Tertiary</strong><span>one polypeptide's 3D fold</span></div><div className="current"><strong>Quaternary</strong><span>association of multiple polypeptide subunits</span></div>
  </section>
  <details className="observe hb-observe" data-testid="observation">
   <summary>관찰 후 확인하기</summary>
   <ul className="checklist">
    <li>총 <strong data-testid="chain-count">{subunits.length}</strong>개의 polypeptide chain</li>
    <li>α-type <strong data-testid="alpha-count">{alphaCount}</strong>개 · β-type <strong data-testid="beta-count">{betaCount}</strong>개 → α{alphaCount}β{betaCount}</li>
    <li>각 chain에 heme <strong>1</strong>개 → tetramer 전체 heme <strong data-testid="heme-count">{hemes.length}</strong>개</li>
   </ul>
   <div className="table-wrap"><table><thead><tr><th>Subunit</th><th>PDB chain</th><th>Globin type</th><th>Sequence</th><th>Modeled</th><th>Heme</th></tr></thead>
    <tbody>{subunits.map(s=><tr key={s.chain} data-testid={`mapping-${s.chain}`}><th>{s.label}</th><td>{s.chain}</td><td>{GLOBIN_INFO[s.type].name}</td><td>{s.sequenceLength}</td><td>{s.modeledResidues}</td><td>Heme {s.heme.number} ({s.heme.resName} {s.heme.resSeq})</td></tr>)}</tbody></table></div>
   <p>네 polypeptide subunit이 조립되어 하나의 hemoglobin tetramer를 형성합니다. 이것이 quaternary structure의 실제 예입니다.</p>
   <p>α와 β globin은 서로 다른 polypeptide이지만 비슷한 globin fold를 가집니다. Heme는 non-protein prosthetic group이므로 subunit 수에 넣지 않습니다 (4 chains + 4 hemes ≠ 8 subunits).</p>
  </details>
  <section className="helix-notes">
   <p>이번 구조는 hemoglobin의 한 실험 구조 상태(deoxy, O₂가 결합하지 않은 상태)를 보여줍니다. 산소 결합에 따른 T↔R 구조 변화는 다음 모듈에서 비교합니다.</p>
   <p>Subunit끼리는 공유결합이 아니라 여러 비공유 상호작용으로 접촉해 하나의 assembly를 이룹니다.</p>
   <details><summary>구조 출처와 처리 방법 보기</summary>
    <p data-testid="structure-source">Structure: RCSB PDB {HEMOGLOBIN_SOURCE.pdbId}, {HEMOGLOBIN_SOURCE.method}, {HEMOGLOBIN_SOURCE.resolution} Å, {HEMOGLOBIN_SOURCE.citation}. Biological assembly {model.assembly.id} (author: {model.assembly.author.toLowerCase()}, PISA: {model.assembly.software.toLowerCase()}) = deposited chains {model.assembly.chains.join(', ')} with the identity operator; no chains were copied or generated. {structure.residues.reduce((n,r)=>n+r.atoms.length,0)} protein heavy atoms, {hemes.length} × HEM ({structure.hetero.reduce((n,g)=>n+g.atoms.length,0)} atoms).</p>
    <p>α/β 구분: 각 chain의 DBREF UniProt accession(P69905 HBA_HUMAN, P68871 HBB_HUMAN)과 같은 type 안 SEQRES 동일성으로 확인했습니다. chain 문자로 추측하지 않았습니다. α1 = 파일에서 첫 α chain, β1 = α1과 접촉 residue가 더 많은 β chain(α1β1), 나머지가 α2/β2입니다.</p>
    <p>Heme 소속: 각 heme 원자에서 4.5 Å 이내 protein 원자가 어느 chain에 있는지 세어 정했습니다(record 순서 아님). Fe–proximal His 거리는 좌표에서 측정했고 파일의 LINK 기록과 일치합니다.</p>
    <p>화면과 계산에서 제외: 물 {structure.omitted.waters}개. 이 파일에는 heme 외 다른 ligand·ion이 없습니다. O₂는 이 deoxy 구조에 없으며 그려 넣지 않았습니다. Alternate location {structure.omitted.alternateLocations}개, 누락 residue/atom 없음.</p>
    <p>Separate subunits는 각 chain(과 그 heme)을 tetramer 중심 → chain 중심 방향으로 {EXPLODED_DISTANCE} Å 평행이동만 한 설명용 화면입니다. 회전·변형은 없고, 끄면 원래 좌표로 정확히 돌아옵니다.</p>
   </details>
  </section>
 </main>;
}
