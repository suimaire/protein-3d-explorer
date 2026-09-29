import type {Dispatch} from 'react';
import {EXPERIMENTS,EXPERIMENT_SOURCE} from '../protein/mutationTolerance';
import {MIC_CONCENTRATIONS,RESULT_SOURCES,micConceptState,thermalPosition,type MutationEvidence} from '../protein/mutationEvidence';
import {allResultsVisited,type MutationAction,type MutationState} from '../modules/mutationState';

type Props={state:MutationState;dispatch:Dispatch<MutationAction>};
export const EXPLANATION_TITLES={summary:'구조에서 무엇이 바뀌었나?',activity:'효소 활성 · 촉매 중심을 비교해 보세요',mic:'Amoxicillin MIC · 500 mg/L은 무엇을 의미할까?',thermal:'열안정성 · M182T의 안정화 모델을 확인해 보세요'};

export function ResultCards({state,dispatch}:Props){
 const wt=EXPERIMENTS.WT,mt=EXPERIMENTS.M182T;
 const cards=[
  {mode:'activity' as const,title:'효소 활성',wt:wt.activity+' ± '+wt.error,mt:mt.activity+' ± '+mt.error,unit:'s⁻¹ · Vi/[E₀] · 37°C',result:'≈ 유사',note:'이 조건에서 측정된 초기 효소 활성은 유사했습니다.',cta:'활성 중심과 함께 해석 →'},
  {mode:'mic' as const,title:'Amoxicillin MIC',wt:String(wt.mic),mt:String(mt.mic),unit:'mg/L',result:'= 동일',note:'세포 수준에서 측정한 성장 억제 농도입니다.',cta:'500 mg/L의 의미 확인 →'},
  {mode:'thermal' as const,title:'열안정성 Tm',wt:wt.tm+'°C',mt:mt.tm+'°C',unit:'thermal transition midpoint',result:'↑ 증가 · +'+(mt.tm-wt.tm)+'°C',note:'M182T의 열적 전이 중간점이 더 높았습니다.',cta:'안정화 구조 모델 확인 →'},
 ];
 return <div data-testid="mutation-results" className="mutation-result-cards">
  <p className="mutation-note">결과를 눌러 중앙에서 의미를 탐구하세요.</p>
  {cards.map(c=>{
   const active=state.explanation.mode===c.mode;
   return <article key={c.mode} className="mutation-result-card" data-active={active}>
    <div className="mutation-card-heading"><h4>{c.title}</h4><span>{active?'확인 중 ✓':state.visited.includes(c.mode)?'확인함 ✓':''}</span></div>
    <dl><div><dt>WT</dt><dd>{c.wt}</dd></div><div><dt>M182T</dt><dd>{c.mt}</dd></div></dl>
    <small>{c.unit}</small><strong className="mutation-card-result">{c.result}</strong><p>{c.note}</p>
    <button aria-pressed={active} aria-controls="mutation-observation-title" onClick={()=>dispatch({type:'explain',mode:c.mode})}>{c.cta}</button>
   </article>;
  })}
  <a className="mutation-source" href={EXPERIMENT_SOURCE.url} target="_blank" rel="noreferrer">{EXPERIMENT_SOURCE.title} ↗</a>
  <p className="mutation-note">± 표기는 원문의 표기를 유지했습니다. 이 값은 kcat으로 바꾸어 부르지 않습니다.</p>
 </div>;
}
export function ExplanationControls({state,dispatch}:Props){
 const e=state.explanation;
 return <div className="mutation-explanation-controls">
  {e.mode==='activity'&&<div className="camera-presets" role="group" aria-label="활성 중심 비교">
   {([['wt','WT active site'],['mutant','M182T active site'],['overlay','중첩 비교']] as const).map(([value,label])=><button key={value} aria-pressed={e.comparison===value} onClick={()=>dispatch({type:'activity-comparison',value})}>{label}</button>)}
  </div>}
  {e.mode==='thermal'&&<div className="camera-presets" role="group" aria-label="182번 잔기 국소 비교">
   {([['wt','WT Met182'],['mutant','M182T Thr182']] as const).map(([value,label])=><button key={value} aria-pressed={e.comparison===value} onClick={()=>dispatch({type:'thermal-comparison',value})}>{label}</button>)}
   <button className="mutation-interaction-button" aria-pressed={e.interaction&&e.comparison==='mutant'} onClick={()=>dispatch({type:'interaction'})}>안정화에 기여하는 상호작용 보기</button>
  </div>}
  {e.mode!=='summary'&&<button className="mutation-summary-return" onClick={()=>dispatch({type:'explain',mode:'summary'})}>전체 구조 요약으로 돌아가기</button>}
 </div>;
}
function ActivityExplanation({evidence}:{evidence:MutationEvidence}){
 return <div className="mutation-explanation-body" data-testid="activity-explanation">
  <p className="mutation-level">분자 / 효소 수준</p>
  <p><strong>M182T는 촉매 residue 자체의 치환은 아닙니다.</strong> 강조된 Ser70, Lys73, Ser130, Glu166, Lys234와 변이 위치를 비교해 보세요.</p>
  <p>활성 중심의 전체적인 구조가 크게 보존되어 있다는 관찰은 이 실험 조건에서 측정된 효소 활성이 유사했다는 결과와 일관됩니다. 구조 비교만으로 기능의 인과관계를 확정할 수는 없습니다.</p>
  <p className="mutation-metric">선택한 활성 중심 Cα RMSD <strong>{evidence.localRmsd.toFixed(3)} Å</strong></p>
  <p className="mutation-note">전체 공통 Cα로 정렬한 뒤, 위 5개 잔기의 동일 Cα 집합에서 계산했습니다. 별도 국소 재정렬은 하지 않았으며, 곁사슬 전체의 RMSD가 아닙니다.</p>
  <details className="mutation-assay"><summary>효소 활성은 어떻게 측정했을까?</summary>
   <p className="mutation-concept">측정 원리를 설명하는 개념도 · 실제 raw time-series 아님</p>
   <ol className="mutation-flow"><li>정제 효소 + nitrocefin 32 μM</li><li>37°C에서 486 nm 흡광도 변화 관찰</li><li>초기 기울기 → 초기 속도 Vi → Vi/[E₀]</li></ol>
   <svg viewBox="0 0 420 225" role="img" aria-label="시간에 따른 흡광도 변화 개념도. WT 실선과 M182T 점선은 같은 시작점에서 출발하며 초기 기울기는 유사합니다. 수치 눈금은 없습니다.">
    <path d="M55 32V178H382" fill="none" stroke="#65727b" strokeWidth="2"/>
    <path data-series="WT" d="M60 170L350 58" fill="none" stroke="#15618f" strokeWidth="4"/>
    <path data-series="M182T" d="M60 170L350 51" fill="none" stroke="#b0327c" strokeWidth="4" strokeDasharray="9 6"/>
    <text x="55" y="20">흡광도 변화</text><text x="345" y="207">시간</text>
    <text x="210" y="144" fill="#15618f">WT · 실선</text><text x="210" y="167" fill="#b0327c">M182T · 점선</text>
   </svg>
   <p>실제 측정값: WT {EXPERIMENTS.WT.activity} ± {EXPERIMENTS.WT.error} s⁻¹ / M182T {EXPERIMENTS.M182T.activity} ± {EXPERIMENTS.M182T.error} s⁻¹.</p>
   <p className="mutation-note">두 선은 유사한 초기 기울기의 뜻만 보여줍니다. 측정값으로 시간별 흡광도를 계산한 곡선이 아닙니다.</p>
   <SourceLink kind="assay"/>
  </details>
 </div>;
}
function SourceLink({kind}:{kind:'assay'|'stability'}){
 const s=RESULT_SOURCES[kind];return <a className="mutation-source" href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>;
}
function MicExplanation({state,dispatch}:Props){
 const e=state.explanation;if(e.mode!=='mic')return null;
 const concentration=MIC_CONCENTRATIONS[e.concentrationIndex],growth=micConceptState(concentration)==='growth',endpoint=concentration===EXPERIMENTS.WT.mic;
 return <div className="mutation-explanation-body mutation-mic" data-testid="mic-explanation">
  <p className="mutation-level">세포 수준 · agar dilution assay</p>
  <p className="mutation-concept">보고된 MIC 값에 맞춘 개념적 실험 표시 · 실제 배지 사진이나 성장 곡선 아님</p>
  <label className="mutation-slider-label" htmlFor="mutation-concentration">Amoxicillin 농도 <strong>{concentration} mg/L</strong></label>
  <input id="mutation-concentration" type="range" min="0" max={MIC_CONCENTRATIONS.length-1} step="1" value={e.concentrationIndex} aria-valuetext={concentration+' mg/L'} onChange={event=>dispatch({type:'concentration',index:Number(event.target.value)})}/>
  <div className="mutation-concentration-steps" role="group" aria-label="실험 농도 선택">
   {MIC_CONCENTRATIONS.map((value,index)=><button key={value} aria-label={value+' mg/L'} aria-pressed={index===e.concentrationIndex} onClick={()=>dispatch({type:'concentration',index})}>{value}</button>)}
  </div>
  <small>각 단계의 단위: mg/L · 논문에서 사용한 이산 농도</small>
  <div className="mutation-agar-rows" aria-live="polite">
   {(['WT','M182T'] as const).map(name=><div key={name} className="mutation-agar-row" data-growth={growth?'growth':'inhibited'}>
    <div className="mutation-agar" aria-hidden="true">{growth?'● ● ●':'—'}</div>
    <div><strong>{name==='WT'?'WT TEM-1':name}</strong><span>{growth?'● 성장 가능 · 개념 표시':'⊘ 성장 억제 · 개념 표시'}</span><small>보고된 MIC = {EXPERIMENTS[name].mic} mg/L</small></div>
   </div>)}
   <p className="mutation-endpoint">{endpoint?'두 균주에서 처음으로 성장이 억제되는 농도 · MIC = 500 mg/L':growth?'보고된 MIC보다 낮은 시험 농도':'보고된 MIC 이상의 시험 농도'}</p>
  </div>
  <p className="mutation-note">논문은 Mueller Hinton agar에서 37°C, 18시간 후 성장이 억제되는 첫 농도를 MIC로 정했습니다. 위 표시는 MIC endpoint의 뜻을 보여주며 농도별 실제 관찰을 재현하지 않습니다.</p>
  <fieldset className="mutation-check-question"><legend>효소 활성이 비슷했기 때문에 MIC도 반드시 같았을까요?</legend>
   <button aria-pressed={e.answer==='yes'} onClick={()=>dispatch({type:'mic-answer',value:'yes'})}>그렇다</button>
   <button aria-pressed={e.answer==='no'} onClick={()=>dispatch({type:'mic-answer',value:'no'})}>꼭 그렇지는 않다</button>
  </fieldset>
  {e.answer&&<div className="mutation-feedback" role="status">
   <strong>꼭 그렇지는 않습니다. MIC는 세포 수준의 복합적인 지표입니다.</strong>
   <p className="mutation-factor-chain">β-lactamase catalytic activity + protein abundance + folding / stability + cellular environment + growth cost<br/>↓<br/>bacterial growth under antibiotic<br/>↓<br/>MIC</p>
   <p>유사한 효소 활성과 동일한 MIC는 서로 일관된 결과이지만, 효소 활성 하나만으로 MIC가 결정된다고 볼 수는 없습니다.</p>
  </div>}
  <SourceLink kind="assay"/>
 </div>;
}
function ThermalExplanation({state,dispatch,evidence}:Props&{evidence:MutationEvidence}){
 const e=state.explanation;if(e.mode!=='thermal')return null;
 const interaction=e.interaction,contact=evidence.contact;
 return <div className="mutation-explanation-body" data-testid="thermal-explanation">
  <p className="mutation-level">단백질 물성 수준</p>
  <p>{e.comparison==='wt'?<><strong>WT Met182</strong> · 비극성 · sulfur-containing · H-bond donor OH 없음</>:<><strong>M182T Thr182</strong> · 극성 –OH 포함 · 새로운 local H-bonding geometry 가능</>}</p>
  {interaction&&<div className="mutation-contact-evidence" role="status">
   <h4>문헌에서 제안된 안정화 모델 · Helix 9 N-cap interaction</h4>
   <p>Thr182 Oγ ··· Ala185 backbone NH</p>
   <p>1JWP 실제 Oγ(OG1)···N 거리: <strong>{contact.distance.toFixed(3)} Å</strong></p>
   <p>{contact.compatible?'2.5–3.5 Å의 보수적인 거리 기준을 만족합니다. 점선은 이 후보 접촉의 거리 가이드입니다.':'거리 기준을 만족하지 않아 점선을 그리지 않습니다. 문헌의 제안과 이 구조의 접촉을 구분해 보세요.'}</p>
   <p className="mutation-note">이 PDB에는 명시적 수소가 없습니다. O···N heavy-atom 거리를 대신 사용하며 H 결합각, 수소결합의 지속성이나 에너지를 확인한 것은 아닙니다.{e.comparison==='wt'?' WT 비교 중에는 Thr의 접촉 가이드를 숨깁니다.':''}</p>
  </div>}
  <ol className="mutation-cause-chain" aria-label="문헌에서 제안된 안정화 해석">
   <li>Met182 → Thr182</li><li>극성 –OH 추가</li>
   <li>{interaction?'helix 주변 새로운 H-bonding / N-cap interaction 가능':'? · 위의 상호작용 보기 버튼으로 확인'}</li>
   <li>{interaction?'native-state 안정화에 기여하는 것으로 제안':'단백질 안정성과 연결될까?'}</li>
   <li>Tm {EXPERIMENTS.WT.tm}°C → {EXPERIMENTS.M182T.tm}°C</li>
  </ol>
  <p className="mutation-note">안정화에 기여하는 것으로 제안된 상호작용입니다. 이 접촉 하나가 +7.5°C를 설명한다고 단정하거나 자유에너지 값을 계산한 것은 아닙니다.</p>
  <details className="mutation-assay"><summary>다른 상호작용과 불확실성</summary>
   <p>후속 연구는 Ala185 N-cap과 Glu64 backbone carbonyl 관련 대안 상태를 논의합니다. Glu63 접촉은 해당 시뮬레이션에서 드물었습니다. 단일 결정구조는 상태의 분포를 보여주지 않습니다.</p>
   <p>현재 1JWP의 Thr182 Oγ에서 Glu63 O: {evidence.alternateDistances[0].distance.toFixed(3)} Å, Glu64 O: {evidence.alternateDistances[1].distance.toFixed(3)} Å. 이 두 접촉에는 수소결합 점선을 표시하지 않습니다.</p>
   <p>N-cap 형성만으로 안정화가 충분히 설명되지는 않으며, helix 주변 배치와 native-state ensemble도 중요하다는 것이 문헌의 해석입니다.</p>
   <SourceLink kind="stability"/>
  </details>
  <div className="mutation-heating">
   <h4>가열해 보기</h4><p className="mutation-concept">온도와 Tm의 위치 관계 개념도 · 실제 unfolding trajectory / raw thermal curve 아님</p>
   <label className="mutation-slider-label" htmlFor="mutation-temperature">온도 <strong>{e.temperature}°C</strong></label>
   <input id="mutation-temperature" type="range" min="25" max="70" step="0.5" value={e.temperature} aria-valuetext={e.temperature+'°C'} onChange={event=>dispatch({type:'temperature',value:Number(event.target.value)})}/>
   <div className="mutation-temperature-steps" role="group" aria-label="주요 온도 선택">{[25,40,49.5,57,70].map(value=><button key={value} aria-pressed={value===e.temperature} onClick={()=>dispatch({type:'temperature',value})}>{value}°C</button>)}</div>
   <div className="mutation-tm-rows" aria-live="polite">{(['WT','M182T'] as const).map(name=>{
    const tm=EXPERIMENTS[name].tm,position=thermalPosition(e.temperature,tm);
    return <div key={name} data-position={position}><strong>{name} · Tm {tm}°C</strong><span>{position==='midpoint'?'● Tm 도달 · unfolding transition midpoint':position==='below'?'○ Tm보다 낮음':'↑ Tm보다 높은 온도'}</span></div>;
   })}</div>
   <p className="mutation-note">Tm은 해당 조건에서 관찰한 열적 unfolding transition의 중간점입니다. 임의의 fraction folded %나 분자 변형을 계산하지 않습니다.</p>
  </div>
  <details className="mutation-assay"><summary>Tm은 어떻게 측정했을까?</summary>
   <p className="mutation-concept">측정 절차 개념도 · raw curve 아님</p>
   <ol className="mutation-flow"><li>정제 단백질 · 25–80°C 가열 · 1.5°C/min</li><li>내재 tryptophan 형광 관찰 · excitation 295 nm / emission 340 nm</li><li>열적 전이 중간점 Tm 비교 · WT 49.5°C / M182T 57°C</li></ol>
   <SourceLink kind="assay"/>
  </details>
  <SourceLink kind="stability"/>
 </div>;
}
export function ExplanationBody({state,dispatch,evidence}:Props&{evidence:MutationEvidence}){
 if(state.explanation.mode==='activity')return <ActivityExplanation evidence={evidence}/>;
 if(state.explanation.mode==='mic')return <MicExplanation state={state} dispatch={dispatch}/>;
 if(state.explanation.mode==='thermal')return <ThermalExplanation state={state} dispatch={dispatch} evidence={evidence}/>;
 return null;
}
export function IntegratedInterpretation({state,dispatch}:Props){
 if(!allResultsVisited(state))return <p className="mutation-exploration-progress">결과 탐구 {state.visited.length}/3 · 세 결과를 확인하면 통합 해석과 마지막 질문이 열립니다.</p>;
 return <div className="mutation-integrated" data-testid="mutation-integrated">
  <h4>세 결과는 서로 다른 수준의 측정입니다.</h4>
  <div className="mutation-measurement-levels"><p>효소 활성 ≈<small>분자 / 효소 수준</small></p><p>MIC =<small>세포 수준</small></p><p>열안정성 ↑<small>단백질 물성 수준</small></p></div>
  <p><strong>하나의 아미노산 치환이 모든 특성에 같은 방향으로 영향을 주는 것은 아닙니다.</strong></p>
  <fieldset className="mutation-check-question"><legend>그렇다면 M182T는 중립 돌연변이라고 확정할 수 있을까?</legend>
   <button aria-pressed={state.neutralAnswer==='yes'} onClick={()=>dispatch({type:'neutral-answer',value:'yes'})}>그렇다</button>
   <button aria-pressed={state.neutralAnswer==='uncertain'} onClick={()=>dispatch({type:'neutral-answer',value:'uncertain'})}>이 자료만으로는 확정할 수 없다</button>
  </fieldset>
  {state.neutralAnswer&&<div className="mutation-feedback" role="status">
   <strong>이 자료만으로는 확정할 수 없습니다.</strong>
   <p>특정 단백질 assay ≠ 개체 전체의 fitness ≠ population-level selection coefficient</p>
   <p>특정 조건에서 단백질 기능 차이가 작다는 사실은 선택적으로 중립일 가능성과 관련될 수 있지만, 그 자체로 진화적 중립성을 증명하지는 않습니다.</p>
  </div>}
 </div>;
}
