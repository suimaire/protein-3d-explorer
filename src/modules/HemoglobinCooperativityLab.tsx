import {lazy,Suspense,useMemo,useState} from 'react';
import {Segmented} from '../components/Segmented';
import {SaturationPlot,PLOT_COLORS,type CurveMode} from '../components/SaturationPlot';
import {MWC_DEFAULT,normalizedModel} from '../protein/cooperativity';
import type {InspectedEndpoint} from '../protein/cooperativityStructure';

// The 3D viewer and the 2DN2 / 2DN1 assets load only after a structure button is pressed; the graph needs no structure.
const CooperativityStructurePanel=lazy(()=>import('./CooperativityStructurePanel'));

const U_MAX=4,DEFAULT_U=0.5;
const pct=(v:number,n=1)=>`${(v*100).toFixed(n)}%`;
/** Percent with enough digits that a tiny population never shows as a misleading 0.0 %. */
const popPct=(v:number)=>v>0&&v<0.001?`${(v*100).toPrecision(2)}%`:v<1&&v>0.999?`${(v*100).toFixed(3)}%`:pct(v);

export function HemoglobinCooperativityLab(){
 const model=useMemo(()=>normalizedModel(MWC_DEFAULT),[]);
 const [u,setU]=useState(DEFAULT_U),[mode,setMode]=useState<CurveMode>('both'),[showStates,setShowStates]=useState(false);
 const [endpoint,setEndpoint]=useState<InspectedEndpoint|null>(null);
 const p=model.at(u),n=MWC_DEFAULT.n;
 const low=model.at(0.5),mid=model.at(1),high=model.at(3),zero=model.at(0);
 const reset=()=>{setU(DEFAULT_U);setMode('both');setShowStates(false);};
 const expectedMean=p.occupancy.reduce((s,v,k)=>s+k*v,0),sum=p.occupancy.reduce((s,v)=>s+v,0);

 return <main className="helix-lab core-lab hb-lab coop-lab">
  <section className="module-heading"><div><p className="eyebrow">CHAPTER 3 · FROM STRUCTURE TO FUNCTION</p><h2>Hemoglobin Cooperativity & Allostery</h2>
   <p>왜 hemoglobin의 O₂ 결합 곡선은 결합 부위가 하나인 단백질처럼 단순한 hyperbola가 아니라 sigmoid 모양일까?</p></div>
   <span className="model-tag">MWC two-state model · n = {n}<strong>Normalized educational model · x-axis = pO₂ / model P50</strong></span></section>
  <div className="helix-tip compare-tip" data-testid="coop-prompt"><strong>먼저 예측해 보세요.</strong> 4개의 heme가 서로 독립적으로 O₂를 결합한다면 곡선은 어떤 모양일까요?
   두 곡선은 같은 50% saturation 지점(pO₂/P50 = 1)을 지나는데, 왜 모양이 다를까요? Slider를 움직이며 두 곡선과 T/R population을 비교해 보세요.</div>
  <div className="lab-grid helix-grid coop-grid">
   <section className="viewer-panel coop-graph-panel" aria-label="O₂ saturation graph">
    <div className="panel-heading"><h3>O₂ saturation curve</h3><span className="badge">MWC MODEL · NORMALIZED</span></div>
    <div className="coop-controls">
     <Segmented label="Curves" value={mode} onChange={setMode} options={[['both','Both curves'],['hb','Hemoglobin (MWC)'],['reference','One-site reference']] as const}/>
     <label className="coop-check"><input type="checkbox" checked={showStates} onChange={e=>setShowStates(e.target.checked)}/>Pure T-state / R-state curves</label>
    </div>
    <SaturationPlot model={model} u={u} uMax={U_MAX} mode={mode} showStates={showStates}/>
    <div className="legend coop-legend" data-testid="coop-legend">
     {mode!=='reference'&&<span><i className="line-key solid" style={{borderColor:PLOT_COLORS.hb}}/>Hemoglobin — cooperative MWC model (solid, ● marker)</span>}
     {mode!=='hb'&&<span><i className="line-key dashed" style={{borderColor:PLOT_COLORS.reference}}/>One-site noncooperative reference, same P50 (dashed, ◇ marker)</span>}
     {showStates&&<><span><i className="line-key dotted" style={{borderColor:PLOT_COLORS.R}}/>If every molecule stayed R-like (dotted)</span><span><i className="line-key dotted" style={{borderColor:PLOT_COLORS.T}}/>If every molecule stayed T-like (dotted)</span></>}
    </div>
    {showStates&&<p className="small" data-testid="state-curve-note">점선은 가상의 한계입니다: 모든 분자가 한 state에 머문다면 그 state의 site affinity만으로 결합합니다. T-like도 O₂를 결합하지만 affinity가 낮습니다. Hemoglobin 곡선은 O₂ pressure가 오를수록 T 곡선 쪽에서 R 곡선 쪽으로 옮겨 갑니다.</p>}
    <div className="motion-control coop-slider">
     <label htmlFor="po2">pO₂ / P50 <small>relative O₂ pressure</small> <strong data-testid="u-value">{u.toFixed(2)}</strong></label>
     <input id="po2" type="range" min={0} max={U_MAX} step={0.01} value={u} onChange={e=>setU(Number(e.target.value))}
      aria-valuetext={`pO₂/P50 ${u.toFixed(2)}; hemoglobin saturation ${pct(p.Y)}; T-like ${popPct(p.PT)}, R-like ${popPct(p.PR)}`}/>
     <div className="range-ends"><span>0 · no O₂</span><span>{U_MAX} · 4 × P50</span></div>
     <div className="presets coop-presets" role="group" aria-label="pO₂ presets">
      {([['Low O₂',0.3],['P50',1],['High O₂',3]] as const).map(([name,value])=><button key={name} aria-pressed={Math.abs(u-value)<1e-9} onClick={()=>setU(value)}>{name} · {value.toFixed(1)}</button>)}
      <button onClick={reset}>Reset</button>
     </div>
    </div>
   </section>
   <aside className="plot-panel residue-panel coop-panel" aria-label="Current model values">
    <div className="panel-heading"><h3>Current model</h3><span className="badge">pO₂/P50 = {u.toFixed(2)}</span></div>
    <dl className="tr-values coop-values">
     <dt>Saturation Y</dt><dd data-testid="y-value"><strong>{pct(p.Y)}</strong> <small>Hemoglobin · MWC model</small></dd>
     <dt>Reference</dt><dd data-testid="ref-y-value"><strong>{pct(p.reference)}</strong> <small>one-site noncooperative, same P50</small></dd>
     <dt>Average O₂</dt><dd data-testid="avg-o2"><strong>{p.meanBound.toFixed(2)} / tetramer</strong> <small>ensemble average = 4Y (한 분자에 소수 개의 O₂가 붙는다는 뜻이 아님)</small></dd>
    </dl>
    <div className="population" data-testid="population">
     <p><strong>T/R population</strong> <small>ensemble 중 각 state의 비율</small></p>
     <div className="pop-row" data-testid="pop-t"><span>T-like</span><div className="pop-track"><div style={{width:`${p.PT*100}%`,background:PLOT_COLORS.T}}/></div><b>{popPct(p.PT)}</b></div>
     <div className="pop-row" data-testid="pop-r"><span>R-like</span><div className="pop-track"><div style={{width:`${p.PR*100}%`,background:PLOT_COLORS.R}}/></div><b>{popPct(p.PR)}</b></div>
     <p className="small" data-testid="state-site-sat">한 site가 O₂로 차 있을 확률 — T-like 안에서 <strong>{pct(p.yT)}</strong>, R-like 안에서 <strong>{pct(p.yR)}</strong>. 두 state 모두 O₂를 결합하지만 R-like의 affinity가 더 높습니다.</p>
     <p className="small">각 분자는 T-like 또는 R-like state 중 하나에 있으며, 막대는 많은 분자 사이의 비율입니다. 한 분자가 “T 60% + R 40%” 모양이라는 뜻이 아닙니다.</p>
    </div>
    <div className="coop-structure" data-testid="coop-structure">
     <p><strong>Experimental structural representatives</strong> <small>T ↔ R module의 구조 재사용</small></p>
     <div className="coop-structure-buttons">
      <button aria-pressed={endpoint==='T'} onClick={()=>setEndpoint('T')}>Inspect T-like structure <small>PDB 2DN2 · deoxy</small></button>
      <button aria-pressed={endpoint==='R'} onClick={()=>setEndpoint('R')}>Inspect R-like structure <small>PDB 2DN1 · O₂ bound</small></button>
      {endpoint&&<button onClick={()=>setEndpoint(null)}>Close structure</button>}
     </div>
     <p className="small">2DN2 / 2DN1은 모델의 T-like / R-like state를 이해하기 위한 실험 구조 대표입니다. MWC population이 이 두 결정 구조의 정확한 비율이라는 뜻은 아니며, slider는 구조 좌표를 바꾸지 않습니다.</p>
    </div>
   </aside>
  </div>
  {endpoint&&<section className="coop-structure-panel" aria-label="Experimental endpoint structure"><div className="panel-heading"><h3>{endpoint==='T'?'T-like endpoint · PDB 2DN2':'R-like endpoint · PDB 2DN1'}</h3><span className="badge" data-testid="coop-structure-badge">EXPERIMENTAL · NOT pO₂-DEPENDENT</span></div>
   <Suspense fallback={<p className="small">Loading 3D viewer…</p>}><CooperativityStructurePanel endpoint={endpoint}/></Suspense></section>}
  <section className="helix-notes tr-science" data-testid="coop-science-note">
   <p><strong>Scientific note.</strong> MWC는 hemoglobin cooperativity를 설명하는 대표적인 two-state allosteric model입니다. 실제 hemoglobin은 추가적인 tertiary/intermediate states와 여러 조절 인자의 영향을 받습니다.</p>
   <p>여기 곡선은 교육용 normalized model입니다: x축은 실제 mmHg가 아니라 모델 P50에 대한 상대 압력이며, 특정 pH·온도 조건의 HbA 측정 곡선이 아닙니다.</p>
  </section>
  <details className="observe hb-observe" data-testid="occupancy-panel">
   <summary>Tetramer occupancy distribution</summary>
   <p>pO₂/P50 = {u.toFixed(2)}에서 tetramer 하나가 O₂를 k개 가지고 있을 확률 P(k). 모든 분자가 0→1→2→3→4 순서로 같이 움직이는 것이 아니라, 같은 순간에도 분자마다 결합 수가 다릅니다.</p>
   <div className="occupancy" data-testid="occupancy">
    {p.occupancy.map((v,k)=><div className="occ-row" key={k} data-testid={`occupancy-${k}`}>
     <span>k = {k}</span>
     <div className="occ-bars"><div className="pop-track"><div style={{width:`${v*100}%`,background:PLOT_COLORS.hb}}/></div><div className="pop-track outline"><div style={{width:`${p.referenceOccupancy[k]*100}%`,borderColor:PLOT_COLORS.reference}}/></div></div>
     <b>{pct(v)}<small>{pct(p.referenceOccupancy[k])}</small></b></div>)}
   </div>
   <p className="small">위 막대 = Hemoglobin MWC model, 아래 테두리 막대 = 같은 u에서 네 site가 서로 독립이고 각 site가 reference 곡선의 확률로 차 있다고 가정한 분포(binomial). Σ P(k) = <span data-testid="occupancy-sum">{sum.toFixed(3)}</span> · Σ k·P(k) = <span data-testid="occupancy-mean">{expectedMean.toFixed(2)}</span> = 4Y.</p>
  </details>
  <details className="observe hb-observe" data-testid="advanced-panel">
   <summary>Advanced · MWC parameters & Hill coefficient</summary>
   <div className="table-wrap"><table className="coop-params"><tbody>
    <tr><th>n</th><td>{n}</td><td>equivalent O₂ sites (4 hemes)</td></tr>
    <tr><th>L0 = [T0]/[R0]</th><td data-testid="param-L0">{MWC_DEFAULT.L0}</td><td>O₂가 없을 때의 T/R 평형 비율. 크면 ligand가 없을 때 T-like가 우세합니다 (T affinity가 아님).</td></tr>
    <tr><th>c = K_R / K_T</th><td data-testid="param-c">{MWC_DEFAULT.c}</td><td>두 state의 site dissociation constant 비. c &lt; 1 ⇒ R-like의 K가 작아 affinity가 높습니다.</td></tr>
    <tr><th>Model P50</th><td data-testid="model-p50">{model.x50.toFixed(2)} K_R</td><td>= {model.p50OverKT.toFixed(3)} K_T. Y = 0.5를 bisection으로 풀어 얻은 값 (hard-code 아님).</td></tr>
    <tr><th>P_R, ligand-free</th><td>{popPct(model.lowLimit.PR)}</td><td>1/(1+L0)</td></tr>
    <tr><th>P_R, saturating O₂</th><td>{popPct(model.highLimit.PR)}</td><td>1/(1+L0·c⁴)</td></tr>
   </tbody></table></div>
   <dl className="tr-values coop-values">
    <dt>n_H at P50</dt><dd data-testid="hill-p50"><strong>{model.hillAtP50.toFixed(2)}</strong> <small>effective Hill coefficient, d ln(Y/(1−Y)) / d ln pO₂</small></dd>
    <dt>n_H at current u</dt><dd data-testid="hill-current"><strong>{p.hill.toFixed(2)}</strong> <small>one-site reference: 1.00 at every u</small></dd>
   </dl>
   <p className="small">Hill coefficient는 cooperativity의 정도를 나타내는 empirical measure이며, “동시에 결합하는 O₂의 개수”가 아닙니다. Site가 n개이면 n_H ≤ n이고, n_H = n은 분자가 O₂를 0개 또는 n개로만 가지는 극한(무한히 강한 cooperativity)에서만 가능합니다. 그래서 4-site hemoglobin 모델의 n_H는 4보다 작습니다. 독립 site는 n_H = 1입니다. 여기서는 n_H = Var(k) / (4·Y·(1−Y))로 해석적으로 계산합니다.</p>
   <p className="small">Parameter는 고정되어 있습니다: Monod, Wyman & Changeux (1965)가 hemoglobin에 대해 보고한 값으로 알려진 L = 9054, c = 0.014를 교육용 예시로 사용했으며, 곡선 모양을 보기 좋게 조정하지 않았습니다.</p>
  </details>
  <details className="observe hb-observe" data-testid="coop-observation">
   <summary>관찰 후 확인하기</summary>
   <ul className="checklist">
    <li>두 곡선은 pO₂/P50 = 1에서 모두 50%입니다. 하지만 낮은 압력(u = 0.5)에서는 Hemoglobin <strong data-testid="obs-low">{pct(low.Y)}</strong> vs reference {pct(low.reference)}, 높은 압력(u = 3)에서는 <strong data-testid="obs-high">{pct(high.Y)}</strong> vs {pct(high.reference)}. 같은 P50이어도 hemoglobin은 좁은 압력 범위에서 크게 포화도가 변합니다 — sigmoid.</li>
    <li>독립적인 binding site라면 각 site가 다른 site와 상관없이 같은 확률로 차므로 hyperbola(Y = u/(1+u))가 나타납니다. Myoglobin은 하나의 heme-binding site를 가지므로 cooperative tetrameric binding을 보이지 않는 생물학적 예입니다. (위 reference 곡선은 같은 P50로 그린 비교용 곡선이며, 실제 myoglobin 곡선이 아닙니다.)</li>
    <li>O₂ pressure가 오르면 T-like population이 줄고 R-like가 늘어납니다: u = 0 T {popPct(zero.PT)}, u = 1 T {popPct(mid.PT)} · R {popPct(mid.PR)}, u = 3 T {popPct(high.PT)} · R {popPct(high.PR)}. O₂는 affinity가 높은 R-like state에 더 잘 붙으므로, O₂가 많아질수록 평형이 R-like 쪽으로 이동하고 남은 site의 평균 affinity가 높아집니다.</li>
    <li><strong>Positive cooperativity</strong>: O₂가 결합될수록 ensemble이 higher-affinity conformational state를 더 많이 차지하게 되어 추가 O₂ 결합이 상대적으로 유리해지는 현상 (MWC 관점의 설명).</li>
    <li><strong>Allostery</strong>: 한 위치의 ligand binding이 단백질 전체의 conformational equilibrium과 연결되어 다른 위치의 기능에 영향을 주는 현상. 멀리 떨어진 heme끼리 직접 접촉하거나 서로 당기는 것이 아닙니다.</li>
    <li>MWC concerted model에서는 “첫 번째 site affinity, 두 번째 site affinity”가 순서대로 정해져 있지 않습니다. 첫 O₂가 나머지 site를 직접 켜는 것이 아니라, T와 R이 서로 다른 affinity를 가지고 ligand binding에 따라 두 state의 population이 달라집니다. T-like도 O₂를 결합합니다 (u = 1에서 site 점유 확률 T {pct(mid.yT)}, R {pct(mid.yR)}).</li>
    <li>Fractional saturation Y와 평균 O₂ 수 4Y는 많은 분자의 ensemble average입니다. Tetramer occupancy distribution을 열어 보면 같은 u에서도 O₂ 0개인 분자와 4개인 분자가 섞여 있습니다.</li>
    <li>Structure: 2DN2(T-like, deoxy)와 2DN1(R-like, O₂)은 두 state의 실험 구조 대표입니다. Slider 값에 따라 두 구조를 섞거나 중간 구조를 만들지 않습니다 (T ↔ R module에서 본 α2β2 약 14° 재배열이 두 구조 사이의 quaternary 차이입니다).</li>
   </ul>
  </details>
  <section className="helix-notes">
   <details><summary>모델과 수식 보기</summary>
    <p data-testid="coop-equations">x = pO₂/K_R, L0 = [T0]/[R0], c = K_R/K_T. Q_R = (1+x)⁴, Q_T = L0(1+cx)⁴, Q = Q_R + Q_T; P_R = Q_R/Q, P_T = Q_T/Q;
     Y = [x(1+x)³ + L0·c·x(1+cx)³] / Q = P_R·x/(1+x) + P_T·cx/(1+cx). P(k) = C(4,k)[x^k + L0(cx)^k]/Q.</p>
    <p>Normalization: Y(x50) = 0.5를 ln x에 대한 bisection으로 풀고, u = pO₂/P50 = x/x50를 x축으로 사용합니다. Reference: Y = u/(1+u) (같은 P50의 one-site binding).</p>
    <p>Parameter: L = 9054, c = 0.014 (Monod, Wyman & Changeux 1965, J. Mol. Biol. 12:88–118, hemoglobin 예시로 인용되는 값). 실제 조건별 fitting 값은 L0와 affinity가 pH, 온도, CO₂, 2,3-BPG 등에 따라 달라지며, 이 module은 그 효과를 다루지 않습니다.</p>
   </details>
  </section>
 </main>;
}
