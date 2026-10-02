import {useEffect,useMemo,useReducer,useRef,useState} from 'react';
import {ResultCards,ExplanationControls,ExplanationBody,IntegratedInterpretation,EXPLANATION_TITLES} from '../components/MutationExplanation';
import {measureMutationEvidence} from '../protein/mutationEvidence';
import {MutationViewer} from '../components/MutationViewer';
import {loadMutation} from '../protein/mutationAssets';
import {EXPERIMENTS,EXPERIMENT_SOURCE,type MutationModel} from '../protein/mutationTolerance';
import {initialMutationState,mutationReducer,isA36,isApplied,resultsRevealed} from './mutationState';

function ExperimentalResults({a36}:{a36:boolean}){
 const wt=EXPERIMENTS.WT,result=a36?EXPERIMENTS.A36D:EXPERIMENTS.M182T;
 return <div data-testid="mutation-results">
  <div className="mutation-summary">
   <strong>측정된 효소 활성 {a36?'↓ 큰 감소':'≈ 유사'}</strong>
   <strong>Amoxicillin MIC {a36?'↓ 큰 감소':'= 동일'}</strong>
   {!a36&&<strong>열안정성 ↑ 증가</strong>}
  </div>
  <table className="mutation-values"><caption>실제 실험 결과</caption>
   <thead><tr><th scope="col">측정 지표</th><th scope="col">WT</th><th scope="col">{a36?'A36D':'M182T'}</th></tr></thead>
   <tbody>
    <tr><th scope="row">효소 활성 지표<small>Vi/[E₀] · 37°C · s⁻¹</small></th><td>{wt.activity} ± {wt.error}</td><td>{result.activity} ± {result.error}</td></tr>
    <tr><th scope="row">Amoxicillin MIC<small>mg/L</small></th><td>{wt.mic}</td><td>{result.mic}</td></tr>
    {!a36&&<tr><th scope="row">열안정성<small>Tm · °C</small></th><td>{wt.tm}</td><td>{EXPERIMENTS.M182T.tm}<small>↑ +{EXPERIMENTS.M182T.tm-wt.tm}°C</small></td></tr>}
   </tbody>
  </table>
  <p className="mutation-note">{a36?'이 실험 조건에서 두 지표 모두 크게 감소했습니다.':'이 실험 조건에서 측정된 효소 활성은 유사했습니다.'}</p>
  <p className="mutation-note">MIC는 β-lactamase 기능을 반영하는 세균 수준의 실험 지표입니다. 효소 자체의 kcat과 같은 단일 물리량은 아닙니다.</p>
  <a className="mutation-source" href={EXPERIMENT_SOURCE.url} target="_blank" rel="noreferrer">{EXPERIMENT_SOURCE.title} ↗</a>
 </div>;
}

export function MutationToleranceLab({onHbs}:{onHbs:()=>void}){
 const [state,dispatch]=useReducer(mutationReducer,initialMutationState);
 const [load,setLoad]=useState<{status:'loading'}|{status:'ready';model:MutationModel}|{status:'error'}>({status:'loading'});
 const [attempt,setAttempt]=useState(0),nextControl=useRef<HTMLButtonElement>(null),caseTitle=useRef<HTMLHeadingElement>(null),resultTitle=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  let active=true;setLoad({status:'loading'});
  loadMutation().then(model=>{if(active)setLoad({status:'ready',model});}).catch(()=>{if(active)setLoad({status:'error'});});
  return()=>{active=false;};
 },[attempt]);
 const evidence=useMemo(()=>load.status==='ready'?measureMutationEvidence(load.model):null,[load]);
 const mode=state.explanation.mode;
 const a36=isA36(state),applied=isApplied(state),revealed=resultsRevealed(state),ready=load.status==='ready';
 // A removed CTA hands focus to its replacement; ordinary view controls never steal focus.
 const previousStage=useRef(state.stage);
 useEffect(()=>{
  if(previousStage.current===state.stage)return;
  previousStage.current=state.stage;
  if(state.stage==='M182_MUTANT_APPLIED'||state.stage==='M182_WT')nextControl.current?.focus({preventScroll:true});
  if(state.stage==='A36_CASE')caseTitle.current?.focus();
  if(state.stage==='M182_RESULTS_REVEALED'||state.stage==='A36_RESULTS_REVEALED')resultTitle.current?.focus({preventScroll:true});
 },[state.stage]);
 return <main className="mutation-lab" data-stage={state.stage} data-explanation={mode}>
  <section className="module-heading"><div><p className="eyebrow">3장 · 구조에서 기능으로</p><h2>돌연변이 허용성</h2><p>아미노산 하나가 바뀌면 단백질 기능도 반드시 바뀔까?</p></div><div className="model-tag">WT · PDB 1BTL<br/>M182T · PDB 1JWP</div></section>
  <div className="mutation-workspace">
   <section className="mutation-cause" aria-labelledby="mutation-cause-title">
    <div className="panel-heading"><h3 id="mutation-cause-title" tabIndex={-1} ref={caseTitle}>① {a36?'반례 탐구':'변이시키기'}</h3></div>
    <div className="mutation-panel-body">
     <p className="eyebrow">사례 {a36?'2 · A36D':'1 · M182T'}</p>
     <div className="mutation-current" aria-live="polite"><span>{a36?'WT에서 위치 관찰':applied?'✓ M182T 적용됨':'현재'}</span><strong>{a36?'Ala36 → Asp':applied?'Met → Thr':'WT TEM-1'}</strong></div>
     {a36?<><p>Alanine → Aspartate</p><p className="mutation-question">촉매 잔기 자체가 아닌 위치의 변이는 기능에 어떤 영향을 줄까요?</p><p className="mutation-note">Ala36 위치와 Ser70의 공간적 맥락을 관찰한 뒤 실험 결과를 열어 보세요.</p><button onClick={()=>dispatch({type:'restart'})}>M182T 처음부터 탐구</button></>:<>
      {applied?<><div className="mutation-chemistry"><div><strong>Methionine</strong><small>비극성 · S 포함</small></div><span aria-hidden="true">→</span><div><strong>Threonine</strong><small>극성 · –OH 포함</small></div></div><button ref={nextControl} className="mutation-reset" onClick={()=>dispatch({type:'reset'})}>WT로 되돌리기</button><p className="mutation-note">WT와 M182T를 반복해서 비교할 수 있습니다.</p></>:<>
       <p>Residue 182<br/><strong>Methionine · Met</strong></p>
       <p className="mutation-question">이 아미노산이 Thr로 바뀌면 β-lactamase의 기능은 어떻게 될까?</p>
       <fieldset className="mutation-prediction"><legend>나의 예측 <span>(선택 사항)</span></legend>
        {([['decrease','감소할 것이다'],['similar','비슷할 것이다'],['increase','증가할 것이다']] as const).map(([value,label])=><label key={value}><input type="radio" name="mutation-prediction" value={value} checked={state.prediction===value} onChange={()=>dispatch({type:'predict',value})}/>{label}</label>)}
       </fieldset>
       <button ref={nextControl} className="mutation-primary" disabled={!ready} onClick={()=>dispatch({type:'apply'})}><strong>Met182 → Thr</strong><span>M182T 변이 적용 →</span></button>
      </>}
     </>}
    </div>
   </section>
   <section className="mutation-observation" aria-labelledby="mutation-observation-title">
    <div className="panel-heading"><h3 id="mutation-observation-title" aria-live="polite">② {mode==='summary'?EXPLANATION_TITLES.summary:'지금 무엇을 확인 중인가?'}{mode!=='summary'&&<span className="mutation-mode-title">{EXPLANATION_TITLES[mode]}</span>}</h3></div>
    {mode==='summary'&&<div className="camera-presets" role="group" aria-label="구조 관찰">
     <button disabled={!ready} onClick={()=>dispatch({type:'focus',view:'whole'})}>전체 구조</button>
     <button disabled={!ready} onClick={()=>dispatch({type:'focus',view:a36?'a36':'m182'})}>변이 위치</button>
     {applied&&<button aria-pressed={state.overlay} onClick={()=>dispatch({type:'overlay'})}>WT/M182T 중첩</button>}
    </div>}
    <ExplanationControls state={state} dispatch={dispatch}/>
    <div hidden={mode==='mic'} className="mutation-scene-region">
    {load.status==='ready'&&evidence?<MutationViewer model={load.model} state={state} evidence={evidence}/>:<div className="mutation-loading" role={load.status==='error'?'alert':'status'}>{load.status==='error'?<><p>로컬 구조 파일을 불러오지 못했습니다.</p><button onClick={()=>setAttempt(n=>n+1)}>다시 시도</button></>:'TEM-1 실험 구조를 준비하고 있습니다…'}</div>}
    <div className="viewer-footer"><span>드래그 · 회전 / 휠 · 확대</span><span>Shift + 드래그 · 이동 / 방향키 · 회전 / + − · 확대</span></div>
    {mode!=='summary'?<div className="mutation-legend">WT · 청색 / M182T · 자주색 · 원자 위치는 고정된 실험 좌표입니다.</div>:<div className="mutation-legend" aria-label="구조 범례">{a36?<span>● WT Ala36 · 1BTL</span>:applied?<><span>◌ WT Met182 · 회색 ghost</span><span>● M182T Thr182 · 자주색</span>{state.overlay&&<><span>WT · 1BTL · 반투명 리본</span><span>M182T · 1JWP · 진한 리본</span></>}</>:<span>● WT Met182 · 1BTL</span>}<span>◆ Ser70 · 촉매 잔기 · 황토색</span></div>}
    </div>
    {evidence&&<ExplanationBody state={state} dispatch={dispatch} evidence={evidence}/>}
    {mode==='summary'&&(a36?<p className="mutation-structure-note">A36D의 위치를 WT 구조 위에 표시했습니다. 이 화면은 A36D mutant의 실험 구조를 의미하지 않습니다.</p>:applied?<div className="mutation-change"><h4>무엇이 바뀌었나?</h4><p><strong>Met182</strong> · 비극성 · S 포함 <span>→</span> <strong>Thr182</strong> · 극성 · –OH 포함</p><small>서로 독립적으로 결정된 WT와 M182T 실험 구조를 정렬해 비교합니다. 원자가 변환되는 경로를 보여주는 것은 아닙니다.</small></div>:<p className="mutation-structure-note">WT 전체 구조에서 Met182와 촉매 잔기 Ser70을 찾아보세요.</p>)}
    {applied&&<p className="mutation-structure-note mutation-sequence-note">구조 비교의 한계: 두 PDB에는 182 외에도 84(Ile/Val), 184(Val/Ala)의 서열 차이가 있습니다. 보이는 차이를 M182T 하나의 효과로 볼 수 없습니다. 오른쪽 결과는 별도의 논문 실험값입니다.</p>}
    {applied&&load.status==='ready'&&<details className="mutation-alignment"><summary>Cα RMSD {load.model.alignment.rmsd.toFixed(3)} Å · 공통 Cα {load.model.pairs.length}개</summary><p>서로 다른 결정에서 얻은 두 실험 구조를 정렬한 전체 Cα 차이입니다. 모든 미세한 좌표 차이를 M182T의 직접 효과로 해석할 수는 없습니다. RMSD만으로 기능을 판단할 수 없습니다.</p></details>}
   </section>
   <section className="mutation-result-panel" aria-labelledby="mutation-result-title">
    <div className="panel-heading"><h3 id="mutation-result-title" tabIndex={-1} ref={resultTitle}>③ 결과는?</h3></div>
    <div className="mutation-panel-body">
     {revealed?(a36?<ExperimentalResults a36={a36}/>:<ResultCards state={state} dispatch={dispatch}/>):<>
      <p className="mutation-note">구조를 관찰한 뒤 실제 측정값과 비교해 보세요.</p>
      <dl className="mutation-hidden-results"><div><dt>촉매 활성</dt><dd>?</dd></div><div><dt>Amoxicillin MIC</dt><dd>?</dd></div>{!a36&&<div><dt>열안정성</dt><dd>?</dd></div>}</dl>
      <button className="mutation-reveal" disabled={!ready||(!applied&&!a36)} onClick={()=>dispatch({type:'reveal'})}>{a36?'A36D 실험 결과 확인 →':'실제 실험 결과 확인 →'}</button>
      {!applied&&!a36&&<p className="mutation-note">먼저 M182T 변이를 적용해 주세요.</p>}
     </>}
     <p className="mutation-status" role="status">{revealed?'실험 결과가 공개되었습니다.':applied?'변이를 적용했습니다. 구조를 관찰하고 결과를 확인하세요.':a36?'A36D의 위치를 관찰하고 결과를 확인하세요.':'결과는 아직 공개되지 않았습니다.'}</p>
    </div>
   </section>
  </div>
  {revealed&&<section className="mutation-conclusion" aria-labelledby="mutation-conclusion-title">
   <p className="eyebrow">관찰한 것을 연결하기</p><h3 id="mutation-conclusion-title">무엇을 알 수 있을까?</h3>
   {a36?<><p>촉매 residue 자체가 아닌 위치의 변이라도 단백질 전체의 구조적·물리화학적 맥락에 따라 기능에 큰 영향을 줄 수 있다.</p><strong className="mutation-takeaway">active site 밖 ≠ 반드시 영향이 작음</strong><p>아미노산 치환의 효과는 위치, 치환되는 잔기의 물리화학적 성질, 주변 상호작용, 단백질 안정성, 기능적 네트워크 등에 따라 달라질 수 있다.</p><div className="mutation-next"><p>한 아미노산 변화가 더 큰 구조적 결과를 만드는 사례도 살펴볼까요?</p><button onClick={onHbs}>HbS 중합 모듈에서 이어 보기 →</button></div></>:<>
    <p>아미노산이 바뀌었다고 해서 단백질의 모든 기능적 특성이 반드시 크게 변하는 것은 아니다.</p><p>M182T에서는 이 조건에서 측정된 효소 활성과 amoxicillin MIC는 WT와 유사했지만, 열안정성은 증가했다.</p><strong className="mutation-takeaway">서열 변화 ≠ 반드시 기능 소실</strong><p className="mutation-note">한 가지 기능 측정에서 차이가 작다는 사실만으로 진화적으로 완전히 중립인 변이라고 단정할 수는 없습니다.</p><div className="mutation-next"><p>그렇다면 촉매 부위가 아닌 곳의 변이는 대체로 기능에 영향을 주지 않을까?</p><button onClick={()=>dispatch({type:'a36'})}>A36D 반례 확인 →</button></div>
   </>}
   {!a36&&<IntegratedInterpretation state={state} dispatch={dispatch}/>}
  </section>}
 </main>;
}
