import {describe,it,expect} from 'vitest';
import wtText from '../src/data/structures/1BTL.pdb?raw';
import mtText from '../src/data/structures/1JWP.pdb?raw';
import fixtureText from './fixtures/tem1-rcsb-metadata.json?raw';
import moduleSource from '../src/modules/MutationToleranceLab.tsx?raw';
import {analyzeMutation,commonCalphas,tem1Site,TEM1_SITES,TEM1_SOURCES,EXPERIMENTS} from '../src/protein/mutationTolerance';
import {parsePdb,parsePdbHeader} from '../src/protein/pdb';
import {determinant,applyRigid,fitRigid} from '../src/protein/rigid';
import {initialMutationState,mutationReducer,isApplied,resultsRevealed} from '../src/modules/mutationState';

const m=analyzeMutation(wtText,mtText),fixture=JSON.parse(fixtureText);
const sha256=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
describe('TEM-1 deposited evidence',()=>{
 for(const [i,id,text] of [[0,'1BTL',wtText],[1,'1JWP',mtText]] as const){
  it(id+' preserves original bytes, provenance, method and chain',async()=>{
   expect(await sha256(text)).toBe(TEM1_SOURCES[i].sha256);
   const h=parsePdbHeader(text);expect(h.method).toBe('X-RAY DIFFRACTION');expect(h.resolution).toBe(TEM1_SOURCES[i].resolution);
   expect(h.missingResidues).toBe(0);expect(h.missingAtoms).toBe(0);
   expect(h.seqres.get('A')).toHaveLength(263);
   expect(TEM1_SOURCES[i].source).toBe('https://files.rcsb.org/download/'+id+'.pdb');
  });
  it(id+' validates every modeled auth identifier against RCSB label mapping',()=>{
   const s=parsePdb(text,'A'),mapping=fixture.structures[i].mapping;
   expect(s.residues).toHaveLength(263);expect(mapping).toHaveLength(263);
   for(const r of s.residues){
    const rows=mapping.filter((q:any)=>q.pdb_strand_id===r.chain&&Number(q.pdb_seq_num)===r.resSeq);
    expect(rows).toHaveLength(1);expect(rows[0].mon_id).toBe(r.resName);expect(rows[0].pdb_ins_code).toBe('.');
   }
   expect(new Set(s.residues.map(r=>r.chain))).toEqual(new Set(['A']));
  });
  for(const key of ['a36','s70','m182'] as const)it(id+' '+key+' uses verified conventional/auth/label identity',()=>{
   const s=parsePdb(text,'A'),r=tem1Site(s,key,i===1),spec=TEM1_SITES[key];
   expect(r.resSeq).toBe(spec.resSeq);expect(r.resName).toBe(i===1?spec.mutant:spec.wt);
   const row=fixture.structures[i].mapping.find((q:any)=>Number(q.seq_id)===spec.labelSeqId);
   expect(Number(row.auth_seq_num)).toBe(spec.resSeq);expect(r.insertionCode).toBe('');
  });
 }
 it('has an explicit M182T engineered annotation and three verified deposited sequence differences',()=>{
  expect(mtText).toMatch(/SEQADV 1JWP THR A\s+182.*MET\s+180 ENGINEERED MUTATION/);
  expect(m.wt.residues.filter((r,i)=>r.resName!==m.mutant.residues[i].resName).map(r=>r.resSeq)).toEqual([84,182,184]);
 });
 it('resolves alternates deterministically without duplicate atom slots',()=>{
  expect(m.wt.omitted.alternateLocations).toBe(2);expect(m.mutant.omitted.alternateLocations).toBe(0);
  expect(fixture.structures[0].alternateResidues).toEqual(['SER A  82','SER A 285']);
  expect(new Set(m.wt.atoms.map(a=>a.chain+':'+a.resSeq+':'+a.insertionCode+':'+a.name)).size).toBe(m.wt.atoms.length);
 });
 it('rejects incorrect marker residue identity',()=>{
  const bad={...m.wt,residues:m.wt.residues.map(r=>r.resSeq===182?{...r,resName:'ALA'}:r)};
  expect(()=>tem1Site(bad,'m182')).toThrow(/mapping/);
 });
});
describe('TEM-1 proper rigid alignment',()=>{
 it('pairs all 263 common Cα deterministically, including the mutation',()=>{
  expect(m.pairs).toHaveLength(263);expect(m.pairs).toEqual(commonCalphas(m.wt,m.mutant));
  expect(m.pairs.some(p=>p.key==='A:182:')).toBe(true);expect(m.unmatched).toEqual({wt:0,mutant:0});
 });
 it('matches residue identity despite permuted array order',()=>{
  expect(commonCalphas(m.wt,{...m.mutant,residues:[...m.mutant.residues].reverse()})).toEqual(m.pairs);
 });
 it('omits missing Cα and missing residue correspondences explicitly',()=>{
  const mutant={...m.mutant,residues:m.mutant.residues.slice(1).map(r=>r.resSeq===40?{...r,atoms:r.atoms.filter(i=>m.mutant.atoms[i].name!=='CA')}:r)};
  expect(commonCalphas(m.wt,mutant)).toHaveLength(261);
 });
 it('returns finite proper rotation and reproducible transform',()=>{
  expect(determinant(m.alignment.rotation)).toBeCloseTo(1,10);expect(Number.isFinite(m.alignment.rmsd)).toBe(true);
  expect(m.aligned.atoms.every(a=>a.position.every(Number.isFinite))).toBe(true);
  expect(analyzeMutation(wtText,mtText).alignment).toEqual(m.alignment);
 });
 it('RMSD equals a fresh calculation over aligned pairs and improves the raw fit',()=>{
  const squared=(aligned:boolean)=>m.pairs.reduce((sum,p)=>{
   const a=m.wt.atoms[p.wtAtom].position,b=(aligned?m.aligned:m.mutant).atoms[p.mutantAtom].position;
   return sum+a.reduce((v,x,i)=>v+(x-b[i])**2,0);
  },0)/m.pairs.length;
  expect(m.alignment.rmsd).toBeCloseTo(Math.sqrt(squared(true)),12);
  expect(squared(true)).toBeLessThan(squared(false));expect(m.alignment.rmsd).toBeLessThan(1);
 });
 it('preserves internal distances; never morphs the mutant',()=>{
  const a=100,b=900,dist=(s:typeof m.wt)=>Math.hypot(...s.atoms[a].position.map((v,i)=>v-s.atoms[b].position[i]));
  expect(dist(m.aligned)).toBeCloseTo(dist(m.mutant),10);
  expect(applyRigid(m.alignment,m.mutant.atoms[a].position)).toEqual(m.aligned.atoms[a].position);
 });
 it('does not use a reflection even when a reflection would fit perfectly',()=>{
  const p:[number,number,number][]=[[0,0,0],[1,0,0],[0,2,0],[0,0,3]],q=p.map(([x,y,z]):[number,number,number]=>[-x,y,z]);
  const f=fitRigid(p,q);expect(determinant(f.rotation)).toBeCloseTo(1,10);expect(f.rmsd).toBeGreaterThan(0.1);
 });
 it('rejects NaN input rather than silently drawing an invalid model',()=>{
  const line=wtText.split('\n').find(l=>l.startsWith('ATOM  '))!;
  const bad=wtText.replace(line,line.slice(0,30)+'     NaN'+line.slice(38));
  expect(()=>analyzeMutation(bad,mtText)).toThrow(/Invalid/);
 });
});
describe('Mutation Tolerance allowed progression',()=>{
 const apply=()=>mutationReducer(initialMutationState,{type:'apply'});
 it('starts WT with results hidden and refuses premature reveal and case entry',()=>{
  expect(resultsRevealed(initialMutationState)).toBe(false);expect(isApplied(initialMutationState)).toBe(false);
  for(const type of ['reveal','a36','overlay'] as const)expect(mutationReducer(initialMutationState,{type})).toBe(initialMutationState);
 });
 it('permits mutation without a prediction and focuses only on first application',()=>{
  const first=apply();expect(first.stage).toBe('M182_MUTANT_APPLIED');expect(first.camera.token).toBe(1);
  const reset=mutationReducer(first,{type:'reset'}),second=mutationReducer(reset,{type:'apply'});
  expect(second.camera).toBe(first.camera);expect(second.prediction).toBeNull();
 });
 it('preserves optional prediction locally',()=>{
  const s=mutationReducer(initialMutationState,{type:'predict',value:'similar'});
  expect(mutationReducer(s,{type:'apply'}).prediction).toBe('similar');
 });
 it('reveals only on a separate click and allows A36 only after M182 results',()=>{
  const s=apply();expect(resultsRevealed(s)).toBe(false);expect(mutationReducer(s,{type:'a36'})).toBe(s);
  const r=mutationReducer(s,{type:'reveal'});expect(r.stage).toBe('M182_RESULTS_REVEALED');
  const a=mutationReducer(r,{type:'a36'});expect(a.stage).toBe('A36_CASE');expect(a.overlay).toBe(false);expect(resultsRevealed(a)).toBe(false);
  expect(mutationReducer(a,{type:'reveal'}).stage).toBe('A36_RESULTS_REVEALED');
 });
 it('resets overlay and hidden results without changing the camera',()=>{
  const s=mutationReducer(mutationReducer(apply(),{type:'overlay'}),{type:'reveal'}),r=mutationReducer(s,{type:'reset'});
  expect(r.stage).toBe('M182_WT');expect(r.overlay).toBe(false);expect(r.camera).toBe(s.camera);expect(resultsRevealed(r)).toBe(false);
 });
 it('overlay toggle is reversible without resetting framing',()=>{
  const s=apply(),o=mutationReducer(s,{type:'overlay'});expect(o.overlay).toBe(true);expect(o.camera).toBe(s.camera);
  expect(mutationReducer(o,{type:'overlay'})).toEqual(s);
 });
 it('case restart reinitializes prediction and exploration explicitly',()=>{
  const s=mutationReducer(mutationReducer(mutationReducer(apply(),{type:'reveal'}),{type:'a36'}),{type:'restart'});
  expect(s.stage).toBe('M182_WT');expect(s.hasFocused).toBe(false);expect(s.camera.view).toBe('whole');
 });
});
describe('Table 2 and scientific scope',()=>{
 it('retains original measurements and their units, without relabelling activity as kcat',()=>{
  expect(EXPERIMENTS).toEqual({WT:{activity:142,error:2,mic:500,tm:49.5},M182T:{activity:145,error:15,mic:500,tm:57},A36D:{activity:0.14,error:0.01,mic:12.5}});
 });
 it('states conditional activity similarity, neutrality limitation and the WT-only A36 display',()=>{
  const source=moduleSource;
  expect(source).toContain('이 실험 조건에서 측정된 효소 활성은 유사했습니다');
  expect(source).toContain('진화적으로 완전히 중립인 변이라고 단정할 수는 없습니다');
  expect(source).toContain('이 화면은 A36D mutant의 실험 구조를 의미하지 않습니다');
  expect(source).not.toMatch(/neutral mutation|no effect|촉매 기능 완전히 동일|아무 영향 없음/i);
 });
});
