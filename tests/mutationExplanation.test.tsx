import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import wt from '../src/data/structures/1BTL.pdb?raw';
import mt from '../src/data/structures/1JWP.pdb?raw';
import fixture from './fixtures/tem1-rcsb-metadata.json';
import {analyzeMutation,tem1Site,TEM1_SITES,EXPERIMENTS} from '../src/protein/mutationTolerance';
import {CATALYTIC_SITES,MIC_CONCENTRATIONS,measureMutationEvidence,contactDistanceCompatible,micConceptState,thermalPosition,siteAtom} from '../src/protein/mutationEvidence';
import {initialMutationState,mutationReducer,allResultsVisited,type MutationState,type MutationAction} from '../src/modules/mutationState';
import {mutationLayers} from '../src/rendering/mutationView';
import {ResultCards,ExplanationControls,ExplanationBody,IntegratedInterpretation} from '../src/components/MutationExplanation';

const model=analyzeMutation(wt,mt),evidence=measureMutationEvidence(model);
const step=(s:MutationState,a:MutationAction)=>mutationReducer(s,a);
const applied=step(initialMutationState,{type:'apply'}),revealed=step(applied,{type:'reveal'});
const mode=(m:'activity'|'mic'|'thermal')=>step(revealed,{type:'explain',mode:m});
const html=(state:MutationState)=>renderToStaticMarkup(<ExplanationBody state={state} dispatch={()=>{}} evidence={evidence}/>);
describe('result explanation state',()=>{
 for(const stage of [initialMutationState,applied,step(revealed,{type:'a36'})])it('rejects explanation before M182T results: '+stage.stage,()=>{
  for(const m of ['activity','mic','thermal'] as const)expect(step(stage,{type:'explain',mode:m})).toBe(stage);
 });
 it('uses one discriminated mode and records unique visits',()=>{
  let s=revealed;for(const m of ['activity','mic','thermal','activity'] as const){s=step(s,{type:'explain',mode:m});expect(s.explanation.mode).toBe(m);}
  expect(s.visited).toEqual(['activity','mic','thermal']);expect(allResultsVisited(s)).toBe(true);
  expect(step(s,{type:'explain',mode:'summary'}).visited).toEqual(s.visited);
 });
 it('cleans all explanation data on A36, reset and restart',()=>{
  let s=step(mode('thermal'),{type:'interaction'});s=step(s,{type:'temperature',value:57});
  const a=step(s,{type:'a36'}),r=step(s,{type:'reset'});
  for(const next of [a,r,step(a,{type:'restart'})]){expect(next.explanation).toEqual({mode:'summary'});expect(next.visited).toEqual([]);expect(next.neutralAnswer).toBeNull();}
  expect(mutationLayers(a,true)).toEqual(['wt','ala','ser-wt']);
 });
 it('guards mode-specific controls and out-of-range inputs',()=>{
  expect(step(mode('activity'),{type:'temperature',value:57})).toEqual(mode('activity'));
  for(const index of [-1,10,0.5,NaN])expect(step(mode('mic'),{type:'concentration',index})).toEqual(mode('mic'));
  for(const value of [NaN,Infinity,24,71])expect(step(mode('thermal'),{type:'temperature',value})).toEqual(mode('thermal'));
 });
 it('keeps thermal comparison separate from applied mutation stage',()=>{
  const s=step(mode('thermal'),{type:'thermal-comparison',value:'wt'});
  expect(s.stage).toBe('M182_RESULTS_REVEALED');expect(s.explanation).toMatchObject({comparison:'wt'});
  expect(step(s,{type:'interaction'}).explanation).toMatchObject({comparison:'mutant',interaction:true});
  const seen=step(step(s,{type:'interaction'}),{type:'thermal-comparison',value:'wt'});
  expect(step(seen,{type:'interaction'}).explanation).toMatchObject({comparison:'mutant',interaction:true});
 });
});
describe('coordinate evidence, independently deposited mapping',()=>{
 for(const [i,s] of [model.wt,model.mutant].entries())for(const key of [...CATALYTIC_SITES,'m182','a185','p183','v184','e63','e64'] as const){
  it(s.id+' '+key+' auth/label mapping and residue identity',()=>{
   const r=tem1Site(s,key,i===1),spec=TEM1_SITES[key];
   const rows=fixture.structures[i].mapping.filter(q=>q.pdb_strand_id===r.chain&&Number(q.auth_seq_num)===r.resSeq&&q.pdb_ins_code==='.');
   expect(rows).toHaveLength(1);expect(Number(rows[0].seq_id)).toBe(spec.labelSeqId);expect(rows[0].mon_id).toBe(r.resName);
  });
 }
 it('computes the five-Cα RMSD after global alignment, not a hardcoded local fit',()=>{
  const distances=CATALYTIC_SITES.map(key=>{
   const a=model.wt.atoms[siteAtom(model.wt,key,'CA')].position,b=model.aligned.atoms[siteAtom(model.aligned,key,'CA',true)].position;
   return Math.hypot(...a.map((v,i)=>v-b[i]));
  });
  expect(evidence.localRmsd).toBeCloseTo(Math.sqrt(distances.reduce((v,d)=>v+d*d,0)/5),12);
  const changed={...model,aligned:{...model.aligned,atoms:model.aligned.atoms.map(a=>({...a,position:[a.position[0]+1,a.position[1],a.position[2]] as [number,number,number]}))}};
  expect(measureMutationEvidence(changed).localRmsd).not.toBe(evidence.localRmsd);
 });
 it('measures OG1···N in 1JWP, with no explicit hydrogens',()=>{
  expect(evidence.contact.distance).toBeCloseTo(Math.hypot(10.888-7.972,-7.446+7.443,25.265-25.117),10);
  expect(evidence.contact.compatible).toBe(true);expect(mt.split('\n').some(l=>l.startsWith('ATOM')&&l.slice(76,78).trim()==='H')).toBe(false);
  expect(evidence.alternateDistances.every(d=>d.distance>3.5)).toBe(true);
 });
 it('refuses absent atoms and never draws a line after a failed distance screen',()=>{
  expect(()=>siteAtom(model.wt,'m182','OG1')).toThrow();
  for(const d of [NaN,Infinity,2,3.6])expect(contactDistanceCompatible(d)).toBe(false);
  const s=step(mode('thermal'),{type:'interaction'});
  expect(mutationLayers(s,true)).toContain('ncap-contact');expect(mutationLayers(s,false)).not.toContain('ncap-contact');
  expect(mutationLayers(step(s,{type:'thermal-comparison',value:'wt'}),true)).not.toContain('ncap-contact');
 });
});
describe('assay concepts and bounded interpretation',()=>{
 it('renders actual activity and all secondary controls',()=>{
  const cards=renderToStaticMarkup(<ResultCards state={mode('activity')} dispatch={()=>{}}/>);
  for(const v of ['142 ± 2','145 ± 15','500','49.5°C','57°C','+7.5°C'])expect(cards).toContain(v);
  for(const v of ['활성 중심과 함께 해석 →','안정화 구조 모델 확인 →','500 mg/L의 의미 확인 →'])expect(cards).toContain(v);
  expect(cards.match(/aria-pressed="true"/g)).toHaveLength(1);
  const controls=renderToStaticMarkup(<ExplanationControls state={mode('activity')} dispatch={()=>{}}/>);
  for(const v of ['WT active site','M182T active site','중첩 비교'])expect(controls).toContain(v);
  expect(html(mode('activity'))).toContain('실제 raw time-series 아님');
  for(const v of ['측정 원리를 설명하는 개념도','측정값으로 시간별 흡광도를 계산한 곡선이 아닙니다','WT · 실선','M182T · 점선'])expect(html(mode('activity'))).toContain(v);
 });
 it('preserves original paper MIC steps and conceptual threshold',()=>{
  expect(MIC_CONCENTRATIONS).toEqual([0,12.5,25,50,100,250,500,1000,2000,4000]);
  expect(micConceptState(250)).toBe('growth');expect(micConceptState(500)).toBe('inhibited');
  expect(EXPERIMENTS.WT.mic).toBe(500);expect(EXPERIMENTS.M182T.mic).toBe(500);
  const text=html(step(mode('mic'),{type:'mic-answer',value:'no'}));
  for(const v of ['개념적 실험 표시','MIC는 세포 수준의 복합적인 지표','protein abundance','growth cost','효소 활성 하나만으로 MIC가 결정'])expect(text).toContain(v);
 });
 it('only reports position relative to Tm',()=>{
  expect(thermalPosition(49.5,49.5)).toBe('midpoint');expect(thermalPosition(49.5,57)).toBe('below');
  expect(thermalPosition(57,49.5)).toBe('above');expect(thermalPosition(57,57)).toBe('midpoint');
  const text=html(step(mode('thermal'),{type:'temperature',value:57}));
  expect(text).toContain('unfolding transition midpoint');expect(text).toContain('임의의 fraction folded %나 분자 변형을 계산하지 않습니다');
  expect(text).not.toMatch(/\d+%/);
 });
 it('temperature and concentration change no scene layers or camera/coordinates',()=>{
  const thermal=step(mode('thermal'),{type:'interaction'}),heated=step(thermal,{type:'temperature',value:70});
  expect(mutationLayers(heated,true)).toEqual(mutationLayers(thermal,true));expect(heated.camera).toBe(thermal.camera);
  const mic=mode('mic');expect(mutationLayers(step(mic,{type:'concentration',index:6}),true)).toEqual([]);
 });
 it('gates final question until all three modes, then rejects certain neutrality',()=>{
  expect(step(revealed,{type:'neutral-answer',value:'yes'})).toBe(revealed);
  expect(renderToStaticMarkup(<IntegratedInterpretation state={mode('activity')} dispatch={()=>{}}/>)).not.toContain('중립 돌연변이라고 확정');
  let s=revealed;for(const m of ['activity','mic','thermal'] as const)s=step(s,{type:'explain',mode:m});
  s=step(s,{type:'neutral-answer',value:'yes'});
  const text=renderToStaticMarkup(<IntegratedInterpretation state={s} dispatch={()=>{}}/>);
  for(const v of ['이 자료만으로는 확정할 수 없습니다','assay ≠ 개체 전체의 fitness ≠ population-level selection coefficient','중립성을 증명하지는 않습니다'])expect(text).toContain(v);
 });
});
