import {useEffect,useMemo,useState} from 'react';
import {SickleViewer} from '../components/SickleViewer';
import {Segmented} from '../components/Segmented';
import {FiberSchematic} from './FiberSchematic';
import {SICKLE_COLORS,type SickleCamera,type SickleHighlight,type SickleRepresentation,type SickleStep,type SickleStructure} from '../rendering/SickleScene';
import {sickleSceneModel,CONTACT_CUTOFF,HBA_SOURCE,HBS_SOURCE,MUTATION_POSITION,NEIGHBOURHOOD_RADIUS,residueLabel,type SickleModel} from '../protein/sickle';
import {loadSickle} from '../protein/sickleAssets';
import {CLASS_INFO,RESIDUE_NAMES} from '../protein/chemistry';

export function HbsPolymerizationLab({onTransition}:{onTransition:()=>void}){
 const [model,setModel]=useState<SickleModel|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let live=true;loadSickle().then(m=>{if(live)setModel(m);},e=>{if(live)setError(String(e));});return()=>{live=false;};},[]);
 if(error)return <main><p role="alert">PDB {HBS_SOURCE.pdbId} / {HBA_SOURCE.pdbId} 구조를 불러오지 못했습니다. ({error})</p></main>;
 if(!model)return <main><p>Loading PDB {HBS_SOURCE.pdbId} and {HBA_SOURCE.pdbId}…</p></main>;
 return <SickleExplorer model={model} onTransition={onTransition}/>;
}

const defaults={step:'mutation' as SickleStep,representation:'sticks' as SickleRepresentation,highlight:'both' as SickleHighlight,
 structure:'both' as SickleStructure,segment:4,heme:false,distances:true,neighbour:true};
/** Each step opens with the representation that makes its point; the student can still change it. */
const STEP_REPRESENTATION:Record<SickleStep,SickleRepresentation>={mutation:'sticks',surface:'spacefill',contact:'sticks',polymer:'ribbon'};
/** Step 3 opens on both whole molecules, so the two tetramers are seen before the contact is zoomed into. */
const STEP_CAMERA:Record<SickleStep,SickleCamera['view']>={mutation:'mutation',surface:'mutation',contact:'tetramer',polymer:'segment'};
/** Two superposed space-filling structures cannot be read at once, so the surface step opens on one and is compared by toggling. */
const STEP_STRUCTURE:Partial<Record<SickleStep,SickleStructure>>={mutation:'both',surface:'hba'};
const fmt=(v:number,n=2)=>v.toFixed(n);

function SickleExplorer({model,onTransition}:{model:SickleModel;onTransition:()=>void}){
 const scene=useMemo(()=>sickleSceneModel(model),[model]);
 const [step,setStep]=useState(defaults.step),[representation,setRepresentation]=useState(defaults.representation);
 const [highlight,setHighlight]=useState(defaults.highlight),[structure,setStructure]=useState(defaults.structure);
 const [segment,setSegment]=useState(defaults.segment),[showHeme,setShowHeme]=useState(defaults.heme);
 const [showDistances,setShowDistances]=useState(defaults.distances),[showNeighbour,setShowNeighbour]=useState(defaults.neighbour);
 const [camera,setCamera]=useState<SickleCamera>({view:'mutation',token:0});
 const bump=(view:SickleCamera['view'])=>setCamera(c=>({view,token:c.token+1}));
 const view=useMemo(()=>({step,representation,highlight,structure,segment,showHeme,showDistances,showNeighbour}),
  [step,representation,highlight,structure,segment,showHeme,showDistances,showNeighbour]);
 const goTo=(next:SickleStep)=>{setStep(next);setRepresentation(STEP_REPRESENTATION[next]);
  const structure=STEP_STRUCTURE[next];if(structure)setStructure(structure);
  if(next==='contact')setShowNeighbour(true);bump(STEP_CAMERA[next]);};
 const reset=()=>{setStep(defaults.step);setRepresentation(defaults.representation);setHighlight(defaults.highlight);setStructure(defaults.structure);
  setSegment(defaults.segment);setShowHeme(defaults.heme);setShowDistances(defaults.distances);setShowNeighbour(defaults.neighbour);bump('mutation');};

 const {mutation,primary,contacts,hbs,unengagedDonors,packing,network}=model;
 const local=step==='mutation'||step==='surface';
 const donorMolecule=hbs.instances.find(i=>i.id===primary.donor.instance)!,acceptorMolecule=hbs.instances.find(i=>i.id===primary.acceptor.instance)!;
 const core=primary.pocket.filter(q=>q.role==='core'),periphery=primary.pocket.filter(q=>q.role==='peripheral');
 const worstCore=Math.max(...core.map(q=>q.minDistance));
 const glu=CLASS_INFO[mutation.hba.chemical],val=CLASS_INFO[mutation.hbs.chemical];
 const segmentInstances=Math.min(segment,hbs.instances.length);
 const junctions=contacts.length;
 const chainRmsds=mutation.chainFits.map(f=>f.rmsd),maxChainRmsd=Math.max(...chainRmsds);

 const tip=step==='mutation'
  ? `Step 1 · One residue changes — HbA의 β6는 Glu, HbS의 β6는 Val입니다. 두 β chain을 matched Cα ${mutation.alignment.matched}개로 rigid-body 정렬해 같은 방향에서 봅니다 (Cα RMSD ${fmt(mutation.alignment.rmsd)} Å). 나머지 구조는 거의 같습니다.`
  : step==='surface'
  ? `Step 2 · Surface chemistry — β6 side chain에서 ${NEIGHBOURHOOD_RADIUS} Å 안의 residue를 space filling으로 그리고 side-chain 화학 분류로 색칠했습니다. 계산된 molecular surface가 아니라 van der Waals 반지름의 원자 구체입니다. HbA와 HbS 버튼을 번갈아 눌러 같은 자리의 표면을 비교하세요.`
  : step==='contact'
  ? `Step 3 · A new intermolecular contact — ${donorMolecule.label}의 βVal${MUTATION_POSITION}이 ${acceptorMolecule.label}의 β chain pocket에 들어가 있습니다. 두 tetramer는 서로 다른 분자입니다 (intramolecular 접촉이 아닙니다). 접촉 부위는 Contact pocket 버튼으로 확대할 수 있습니다.`
  : `Step 4 · Repeating contact — 같은 접촉이 unit cell 병진(${hbs.crystal.spaceGroup})으로 반복됩니다. 화면의 ${segmentInstances}개 tetramer는 결정 안의 배열이며, 세포 안 fiber 전체의 원자 모델이 아닙니다.`;

 return <main className="helix-lab core-lab hb-lab tr-lab hbs-lab" data-step={step}>
  <section className="module-heading"><div><p className="eyebrow">CHAPTER 3 · FROM STRUCTURE TO FUNCTION</p><h2>HbA → HbS → Polymerization</h2>
   <p>β-globin의 amino acid 하나가 바뀌면, 그 단백질 표면은 어떻게 달라지고 다른 hemoglobin 분자와 어떤 새로운 접촉이 가능해질까?</p></div>
   <span className="model-tag">PDB {HBS_SOURCE.pdbId} (deoxy HbS, {HBS_SOURCE.resolution} Å) · PDB {HBA_SOURCE.pdbId} (deoxy HbA, {HBA_SOURCE.resolution} Å)<strong>Two experimental X-ray structures</strong></span></section>

  <ol className="hbs-steps" data-testid="hbs-steps" aria-label="학습 단계">
   {([['mutation','1','Mutation','β6 Glu → Val'],['surface','2','Surface','국소 표면 화학'],
      ['contact','3','Contact','분자 사이 새 접촉'],['polymer','4','Repeat','접촉의 반복']] as const).map(([id,n,title,sub])=>
    <li key={id}><button aria-pressed={step===id} onClick={()=>goTo(id)} data-testid={`step-${id}`}><b>{n}</b><span>{title}<small>{sub}</small></span></button></li>)}
  </ol>

  <section className="controls core-controls compare-controls hb-controls tr-controls hbs-controls" aria-label="HbS polymerization controls">
   <Segmented label="Representation" value={representation} onChange={setRepresentation}
    options={[['ribbon','Ribbon'],['sticks','Sticks'],['spacefill','Space filling']] as const}/>
   <Segmented label="Highlight" value={highlight} onChange={setHighlight}
    options={[['mutation','Mutation site'],['pocket','Acceptor pocket'],['both','Both']] as const}/>
   {local
    ? <Segmented label="Structure" value={structure} onChange={setStructure} options={[['hba','HbA'],['hbs','HbS'],['both','Both']] as const}/>
    : <Segmented label="Segment" value={String(segment)} onChange={v=>{setSegment(Number(v));if(step==='polymer')bump('segment');else goTo('polymer');}}
       options={[['2','2 tetramers'],['4','4 tetramers'],['6','6 tetramers']] as const}/>}
   <fieldset className="hb-toggles"><legend>Show</legend>
    <div className="toggles">
     <label><input type="checkbox" checked={showHeme} onChange={e=>setShowHeme(e.target.checked)}/>Heme</label>
     <label><input type="checkbox" checked={showDistances} onChange={e=>setShowDistances(e.target.checked)}/>Contact distances</label>
     <label><input type="checkbox" checked={showNeighbour} disabled={local||step==='polymer'} onChange={e=>setShowNeighbour(e.target.checked)}/>Neighbour molecule</label>
    </div>
    <button onClick={reset}>전체 초기화</button>
   </fieldset>
  </section>

  <div className="helix-tip compare-tip" data-testid="hbs-tip">{tip}
   {showDistances&&!local&&<span className="tip-extra" data-testid="distance-note"> 점선 = 측정한 heavy-atom 최단 거리(≤ {fmt(CONTACT_CUTOFF,1)} Å)입니다. 근접을 표시하는 보조선이며 화학 결합이 아닙니다.</span>}
   {local&&<span className="tip-extra"> 색: {glu.label}({glu.korean}) / {val.label}({val.korean}) 등 side-chain 화학 분류. 붉은 강조 = β{MUTATION_POSITION} residue.</span>}
  </div>

  <div className="lab-grid helix-grid hb-grid">
   <section className="viewer-panel" aria-label="3D HbS structure">
    <div className="panel-heading"><h3>{local?`β chain · β${MUTATION_POSITION} site`:step==='contact'?'Two HbS molecules · lateral contact':`HbS segment · ${segmentInstances} tetramers`}</h3>
     <span className="badge" data-testid="hbs-badge">{local?`EXPERIMENTAL · ALIGNED β CHAINS`:step==='contact'?`EXPERIMENTAL · ${HBS_SOURCE.pdbId} ASYMMETRIC UNIT`:`EXPERIMENTAL + LATTICE TRANSLATION`}</span></div>
    <div className="camera-presets">
     <button onClick={()=>bump('mutation')}>Mutation site</button><button onClick={()=>bump('pocket')}>Contact pocket</button>
     <button onClick={()=>bump('tetramer')}>Whole tetramer</button><button onClick={()=>bump('segment')}>Polymer segment</button>
     <button onClick={()=>bump('fit')}>Fit</button><button onClick={reset}>Reset</button></div>
    <SickleViewer testId="hbs-viewer" model={scene} view={view} camera={camera}
     ariaLabel={`HbA와 HbS 구조 비교 및 HbS 분자 사이 접촉 3D 화면 (PDB ${HBS_SOURCE.pdbId}, ${HBA_SOURCE.pdbId}). 드래그로 회전, 휠로 확대, 방향키로 회전, 더하기와 빼기로 확대 축소.`}/>
    <div className="viewer-footer"><span>drag 회전 · 휠 확대 · 방향키 / + − · step을 바꿔도 좌표는 그대로입니다</span></div>
    <div className="legend" data-testid="hbs-legend">
     {local?<>
      {structure!=='hbs'&&<span><i style={{background:SICKLE_COLORS.hba.css}}/>HbA β chain · {HBA_SOURCE.pdbId} (aligned)</span>}
      {structure!=='hba'&&<span><i style={{background:SICKLE_COLORS.hbs.css}}/>HbS βS chain · {HBS_SOURCE.pdbId}</span>}
      <span><i style={{background:SICKLE_COLORS.donor.css}}/>β{MUTATION_POSITION} residue (HbA Glu / HbS Val)</span>
      {(representation==='spacefill'||representation==='sticks')&&<span className="legend-classes">주변 residue 색 = side-chain 화학 분류</span>}
     </>:<>
      <span><i style={{background:SICKLE_COLORS.molecule[0].css}}/>Molecule 1 (biomolecule 1 · chains {hbs.assemblies[0].chains.join(', ')})</span>
      <span><i style={{background:SICKLE_COLORS.molecule[1].css}}/>Molecule 2 (biomolecule 2 · chains {hbs.assemblies[1].chains.join(', ')})</span>
      <span><i style={{background:SICKLE_COLORS.donor.css}}/>donor βVal{MUTATION_POSITION}</span>
      <span><i style={{background:SICKLE_COLORS.pocket.css}}/>acceptor pocket {core.map(q=>residueLabel(q)).join(' · ')}</span>
      {step==='contact'&&<span><i style={{background:SICKLE_COLORS.periphery.css}}/>pocket 주변 극성 residue {periphery.map(q=>residueLabel(q)).join(' · ')}</span>}
      {showHeme&&<><span><i style={{background:SICKLE_COLORS.heme.css,borderRadius:2}}/>Heme</span><span><i style={{background:SICKLE_COLORS.ironCss}}/>Fe</span></>}
     </>}
    </div>
    {step==='polymer'&&<FiberSchematic doubleStrands={7}/>}
   </section>

   <aside className="plot-panel residue-panel hb-panel tr-panel hbs-panel" aria-label="Measured values">
    {local?<>
     <div className="panel-heading"><h3>β{MUTATION_POSITION} side chain</h3><span className="badge">CHEMISTRY</span></div>
     <p className="hbs-prediction" data-testid="hbs-prediction">Glu를 Val로 바꾸면 이 자리의 단백질 <strong>표면</strong>에서 어떤 물리화학적 성질이 달라질까요? 먼저 예상해 보고 3D에서 확인하세요.</p>
     <div className="table-wrap"><table className="hbs-chemistry" data-testid="chemistry-table"><thead><tr><th/><th>HbA · {HBA_SOURCE.pdbId}</th><th>HbS · {HBS_SOURCE.pdbId}</th></tr></thead><tbody>
      <tr><th>β{MUTATION_POSITION}</th><td data-testid="hba-residue">{RESIDUE_NAMES[mutation.hba.resName]} (Glu)</td><td data-testid="hbs-residue">{RESIDUE_NAMES[mutation.hbs.resName]} (Val)</td></tr>
      <tr><th>Side-chain 분류</th><td><i className="class-dot" style={{background:glu.css}}/>{glu.label} · {glu.korean}</td><td><i className="class-dot" style={{background:val.css}}/>{val.label} · {val.korean}</td></tr>
      <tr><th>Side-chain heavy atoms</th><td>{mutation.hba.sideChain.length}</td><td>{mutation.hbs.sideChain.length}</td></tr>
      <tr><th>생리적 pH 부근</th><td>carboxylate 곁사슬이 대체로 <strong>음전하</strong>를 띤 상태로 존재</td><td>전하 없음 · <strong>소수성</strong> side chain</td></tr>
     </tbody></table></div>
     <p className="small" data-testid="chemistry-caveat">Side chain의 protonation 상태는 국소 환경에 따라 달라질 수 있으므로 “Glu는 언제나 −1”은 아닙니다. 여기서는 생리적 조건에서 우세한 상태를 기준으로 설명합니다.</p>
     <dl className="tr-values">
      <dt>β chain 정렬</dt><dd data-testid="align-rmsd"><strong>{fmt(mutation.alignment.rmsd)} Å</strong> <small>matched Cα {mutation.alignment.matched}개, rigid-body superposition</small></dd>
      <dt>서로 다른 residue</dt><dd data-testid="align-differences"><strong>{mutation.differences.length}개</strong> <small>{mutation.differences.map(d=>`β${d.position} ${d.hba[0]}${d.hba.slice(1).toLowerCase()} → ${d.hbs[0]}${d.hbs.slice(1).toLowerCase()}`).join(', ')}</small></dd>
      <dt>β{MUTATION_POSITION} 주변 residue</dt><dd data-testid="neighbourhood-count">HbA {mutation.neighbourhood.hba.length}개 · HbS {mutation.neighbourhood.hbs.length}개 <small>side chain에서 {NEIGHBOURHOOD_RADIUS} Å 이내</small></dd>
     </dl>
     <p className="small">두 구조는 서로 다른 결정에서 얻은 것이므로, 정렬 후 남는 작은 차이를 모두 mutation의 결과라고 해석할 수는 없습니다. 여기서 확인할 것은 <strong>β{MUTATION_POSITION} 자리의 국소적인 곁사슬 화학</strong>입니다.</p>
    </>:step==='contact'?<>
     <div className="panel-heading"><h3>Intermolecular contact</h3><span className="badge">MEASURED</span></div>
     <p className="hbs-prediction" data-testid="hbs-prediction">이 Val side chain과 잘 맞는 상대 표면은 어떤 성질을 가질까요? 먼저 예상해 보세요.</p>
     <div className="table-wrap"><table className="hbs-identity" data-testid="molecule-table"><tbody>
      <tr data-testid="donor-row"><th>Donor</th><td>{donorMolecule.label}</td><td>chain {primary.donor.sourceChain} (βS)</td><td><strong>{residueLabel({resName:primary.donor.resName,resSeq:primary.donor.resSeq})}</strong></td></tr>
      <tr data-testid="acceptor-row"><th>Acceptor</th><td>{acceptorMolecule.label}</td><td>chain {primary.acceptor.sourceChain} (βS)</td><td>pocket {core.map(q=>residueLabel(q)).join(' / ')}</td></tr>
     </tbody></table></div>
     <p className="small" data-testid="intermolecular-note">두 chain은 <strong>서로 다른 hemoglobin 분자</strong>에 속합니다 ({primary.relation}). 같은 tetramer 안의 접촉이 아닙니다.</p>
     <div className="table-wrap"><table className="hbs-distances" data-testid="distance-table"><thead><tr><th>Acceptor residue</th><th>분류</th><th>최단 heavy-atom 거리</th></tr></thead><tbody>
      {primary.pocket.map(q=><tr key={q.residue} data-testid={`pocket-${q.resSeq}`}>
       <th>{residueLabel(q)}<small>{q.role==='core'?' · pocket core':' · pocket 주변'}</small></th>
       <td><i className="class-dot" style={{background:CLASS_INFO[q.chemical].css}}/>{CLASS_INFO[q.chemical].label}</td>
       <td>{fmt(q.minDistance)} Å <small>{q.donorAtom} ↔ {q.acceptorAtom}</small></td></tr>)}
      {primary.secondary&&<tr data-testid="secondary-contact"><th>{primary.secondary.acceptorLabel}<small> · donor {primary.secondary.donorLabel}</small></th><td><small>극성 곁사슬 사이</small></td>
       <td>{fmt(primary.secondary.minDistance)} Å <small>{primary.secondary.donorAtom} ↔ {primary.secondary.acceptorAtom}</small></td></tr>}
     </tbody></table></div>
     <p className="small" data-testid="contact-caveat">거리는 좌표에서 직접 잰 값입니다. 거리만으로 상호작용의 종류가 정해지지는 않습니다. βVal{MUTATION_POSITION}과 {core.map(q=>residueLabel(q)).join(' · ')}는 모두 비극성 곁사슬이고 서로 {fmt(worstCore)} Å 이내에 있어 <strong>hydrophobic contact</strong>로 설명됩니다. 공유결합이 아닙니다.</p>
     <p className="small" data-testid="cutoff-note">{fmt(CONTACT_CUTOFF,1)} Å 거리 기준을 적용하면 이 acceptor chain에서 βVal{MUTATION_POSITION} 주변에 검출되는 residue는 {primary.neighbours.map(q=>residueLabel(q)).join(' · ')}입니다. 이 기준은 분석을 위해 정한 operational cutoff이므로, 기준을 바꾸면 검출되는 residue도 달라질 수 있습니다.</p>
    </>:<>
     <div className="panel-heading"><h3>Repeating contact</h3><span className="badge">CRYSTAL LATTICE</span></div>
     <p className="hbs-prediction" data-testid="hbs-prediction">같은 접촉이 많은 HbS 분자에서 반복된다면 어떤 higher-order structure가 가능할까요?</p>
     <dl className="tr-values">
      <dt>화면의 분자</dt><dd data-testid="segment-count"><strong>{segmentInstances} tetramers</strong> <small>asymmetric unit 2개 + unit-cell 병진 복사본</small></dd>
      <dt>반복 방식</dt><dd data-testid="segment-operation"><strong>x ± a</strong> <small>unit cell a = {fmt(hbs.crystal.cell.a,3)} Å 병진 (회전 없음)</small></dd>
      <dt>{hbs.instances.length}-tetramer 구간의 βVal{MUTATION_POSITION} 접촉</dt><dd data-testid="segment-contacts"><strong>{junctions}곳</strong> <small>모두 서로 다른 두 분자 사이</small></dd>
      <dt>분자 사이 최단 거리</dt><dd data-testid="segment-packing"><strong>{fmt(packing.closest)} Å</strong> <small>{packing.overlapCutoff} Å 미만으로 겹치는 원자쌍 {packing.overlaps}개</small></dd>
     </dl>
     <p className="small" data-testid="evidence-note"><strong>근거 수준이 다릅니다.</strong> 위 3D 화면은 deoxy HbS 결정({HBS_SOURCE.pdbId})에서 직접 관측된 원자 좌표와 그 격자 병진입니다. 아래 도식은 전자현미경 3차원 재구성과 X선 섬유 회절로 추론된 fiber의 상위 구조를 나타낸 <strong>schematic</strong>이며 원자 좌표가 아닙니다.</p>
     <p className="small">결정 안의 배열을 적혈구 안의 fiber와 같다고 단정하지 않습니다. 다만 이 결정의 double strand는 fiber 모델의 기본 구성 요소로 알려져 있습니다.</p>
    </>}
   </aside>
  </div>

  <section className="helix-notes hbs-science" data-testid="hbs-science">
   <p><strong>Deoxygenation과의 연결.</strong> HbS mutation이 있다고 해서 항상 polymer가 만들어지는 것은 아닙니다. Polymerization은 특히 <strong>deoxy 상태의 polymer-compatible한 conformation</strong>에서 크게 촉진됩니다. 여기서 사용한 {HBS_SOURCE.pdbId}는 deoxy HbS 구조입니다. 실제 polymer 형성은 HbS 농도, 산소화 정도, nucleation, 세포 내 환경 등에도 함께 좌우되며 이 모듈에서는 그 속도론을 계산하지 않습니다.{' '}
    <button className="link-button" onClick={onTransition} data-testid="tr-link">왜 deoxy 상태가 중요한가? → T ↔ R 구조 보기</button></p>
   <p data-testid="network-note"><strong>접촉은 하나가 아닙니다.</strong> <span data-testid="network-established">βVal{MUTATION_POSITION} → 다른 분자 β chain의 hydrophobic pocket({core.map(q=>residueLabel(q)).join(' · ')}) 접촉은 deoxy HbS 실험 구조로 잘 확립된, polymerization의 <strong>특징적인 pathological lateral contact</strong>입니다. 그러나 HbS fiber는 βVal{MUTATION_POSITION} 접촉 하나만으로 안정화되지 않으며, 여러 axial · lateral intermolecular interaction이 함께 존재합니다.</span>{' '}
    <span data-testid="network-measured"><strong>이 모듈의 {hbs.instances.length}-tetramer crystal segment</strong>(Step 4에서 {hbs.instances.length} tetramers로 표시)에서 이 모듈의 접촉 기준(서로 다른 분자의 heavy atom ≤ {fmt(network.cutoff,1)} Å)으로 검출한 분자간 chain 접촉면은 <strong data-testid="network-total">{network.lateral+network.axial}곳</strong>이며, 그중 두 strand 사이의 lateral 접촉이 {network.lateral}곳, 같은 strand를 따라가는 axial 접촉이 {network.axial}곳입니다. βVal{MUTATION_POSITION}이 직접 관여하는 것은 그중 {network.involvingMutation}곳입니다. 이 숫자는 표시한 유한한 구간의 길이·가장자리와 접촉 기준에 따라 달라지는 <strong>이 시각화에서 계산한 값</strong>이며, 실제 HbS fiber에 고정된 접촉 개수가 아닙니다.</span></p>
   <p className="small" data-testid="rbc-note">긴 HbS polymer는 적혈구 내부의 기계적 성질을 바꾸어 세포의 변형성과 모양 변화에 기여합니다. 이 모듈은 구조 수준까지만 다루며 세포·임상 수준은 모델링하지 않습니다.</p>
  </section>

  <details className="observe hb-observe" data-testid="hbs-observation">
   <summary>관찰 후 확인하기</summary>
   <ul className="checklist">
    <li><strong>β{MUTATION_POSITION} Glu → Val.</strong> HbS의 β chain 두 개 모두가 이 치환을 가집니다 (이 구조의 βS chain {model.hbs.chains.filter(c=>c.type==='beta'&&hbs.instances.find(i=>i.id===c.instance)!.deposited).length}개 전부에서 확인).</li>
    <li><strong>charged/polar → nonpolar.</strong> {glu.label} 곁사슬이 {val.label} 곁사슬로 바뀌면서 그 자리의 표면 화학이 달라집니다. 단백질 접힘 자체는 거의 그대로입니다 — 각 chain을 따로 맞추면 Cα RMSD {fmt(Math.min(...chainRmsds))}–{fmt(maxChainRmsd)} Å, tetramer 전체로도 {mutation.tetramerFits.map(t=>fmt(t.rmsd)).join(' / ')} Å입니다.</li>
    <li><strong>이웃 β chain의 pocket.</strong> 상대 분자 β chain의 {core.map(q=>residueLabel(q)).join(' · ')} (모두 비극성)가 βVal{MUTATION_POSITION}을 둘러쌉니다. 최단 거리 {core.map(q=>fmt(q.minDistance)).join(' / ')} Å. 주변에는 {periphery.map(q=>residueLabel(q)).join(' · ')} 같은 극성 residue도 함께 있습니다.</li>
    <li><strong>intermolecular contact.</strong> donor βVal{MUTATION_POSITION}은 {donorMolecule.label}, pocket은 {acceptorMolecule.label}에 속합니다. 한 tetramer의 두 βS 중 <strong>하나만</strong> 이 접촉의 donor이고, 다른 하나({unengagedDonors.map(u=>`chain ${u.sourceChain}`).join(', ')})는 이 구간에서 pocket에 들어가 있지 않습니다.</li>
    <li><strong>deoxy HbS polymerization.</strong> 이 접촉이 여러 분자에서 반복되면 분자들이 길게 이어질 수 있습니다. 이 구간에서 확인되는 βVal{MUTATION_POSITION} 접촉은 {junctions}곳입니다.</li>
   </ul>
   <div className="table-wrap"><table data-testid="chain-fit-table"><thead><tr><th>HbS chain</th><th>Molecule</th><th>Globin</th><th>HbA 대응 chain</th><th>Cα RMSD</th></tr></thead>
    <tbody>{mutation.chainFits.map(f=><tr key={f.chain} data-testid={`chain-fit-${f.sourceChain}`}><th>{f.sourceChain} <small>({f.label})</small></th><td>{hbs.instances.find(i=>i.id===f.instance)!.label}</td>
     <td>{f.type==='alpha'?'α-globin':'β-globin'}</td><td>{f.reference}</td><td>{fmt(f.rmsd)} Å <small>Cα {f.matched}</small></td></tr>)}</tbody></table></div>
   <p className="small">이 값들은 “single mutation이 globin fold 전체를 무너뜨리지 않았다”는 점을 확인하기 위한 sanity check입니다. 두 구조는 서로 다른 결정·해상도에서 얻은 것이므로 작은 차이는 mutation 이외의 원인으로도 생깁니다.</p>
  </details>

  <section className="helix-notes">
   <details><summary>구조 출처와 처리 방법 보기</summary>
    <p data-testid="hbs-source">HbS: RCSB PDB {HBS_SOURCE.pdbId}, human deoxyhemoglobin S, {HBS_SOURCE.method}, {HBS_SOURCE.resolution} Å, space group {HBS_SOURCE.spaceGroup}. {HBS_SOURCE.citation}. HbA: RCSB PDB {HBA_SOURCE.pdbId}, human deoxyhemoglobin A, {HBA_SOURCE.method}, {HBA_SOURCE.resolution} Å. {HBA_SOURCE.citation}.</p>
    <p data-testid="assembly-note">{HBS_SOURCE.pdbId}의 asymmetric unit에는 완전한 α2βS2 tetramer가 <strong>두 개</strong> 들어 있습니다. 파일의 REMARK 350 biomolecule 1 = chains {hbs.assemblies[0].chains.join(', ')}, biomolecule 2 = chains {hbs.assemblies[1].chains.join(', ')}이며 둘 다 identity operator입니다. 그래서 Step 3의 접촉은 <strong>대칭 조작 없이</strong> deposited 좌표에서 그대로 관찰됩니다. α/β는 각 chain의 DBREF UniProt accession으로 판정했고, βS chain 네 개 모두 SEQRES {MUTATION_POSITION}번이 VAL임을 확인했습니다 (SEQADV: VAL ↔ UNP P68871 GLU {MUTATION_POSITION}).</p>
    <p data-testid="lattice-note">Step 4의 반복은 파일의 CRYST1/SCALE에서 읽은 <strong>unit-cell 병진</strong>(a = {fmt(hbs.crystal.cell.a,3)} Å, {hbs.crystal.spaceGroup})만 사용합니다. 격자 병진은 모든 space group에 포함되는 정확한 결정학적 대칭 조작이며 회전 성분이 없으므로 복사본 내부의 거리는 전혀 변하지 않습니다. Val{MUTATION_POSITION}을 pocket에 맞추기 위해 임의로 이동·회전시킨 좌표는 없습니다.</p>
    <p data-testid="identity-note">두 tetramer는 같은 chain ID와 residue 번호를 반복해서 가지므로, 이 모듈의 모든 residue/atom 식별자에는 <strong>molecule instance ID</strong>가 함께 들어갑니다 (예: <code>{primary.donor.key}</code>). 서로 다른 분자의 β{MUTATION_POSITION}을 같은 residue로 취급하지 않습니다.</p>
    <p data-testid="bond-note">결합은 각 분자 안에서만 추론하며, 분자 사이 근접은 점선 guide와 측정값으로만 표시합니다. 서로 다른 tetramer의 원자 사이에 결합이 그려지지 않는지 자동으로 검사합니다.</p>
    <p data-testid="ligand-note">{HBS_SOURCE.pdbId}는 deoxy 구조이며 heme Fe에 결합한 ligand가 deposited되어 있지 않습니다. 없는 O₂를 그려 넣지 않았습니다. 물 분자({hbs.omitted.waters}개)는 표시하지 않습니다.</p>
   </details>
  </section>
 </main>;
}
