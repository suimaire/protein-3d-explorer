import {describe,it,expect} from 'vitest';
import text from '../src/data/structures/1UBQ.pdb?raw';
import {parsePdb,parsePdbHeader,type PdbResidue} from '../src/protein/pdb';
import {measureResidues,sequencePositions,sequenceSpaceExamples,selectPair} from '../src/protein/sequenceSpace';
import {distance} from '../src/geometry/vector';
const s=parsePdb(text),positions=sequencePositions(s,parsePdbHeader(text).seqres);
describe('sequence and space',()=>{
 it('maps all 76 actual residues to SEQRES, with identity preserved',()=>{expect(positions.size).toBe(76);s.residues.forEach((r,i)=>{expect(positions.get(r.index)).toBe(i);expect(r.chain).toBe('A');});});
 it('maps insertion codes, missing sequence positions and nonconsecutive author numbers independently',()=>{
  const r=(index:number,resSeq:number,resName:string,insertionCode='',chain='A')=>({index,resSeq,resName,insertionCode,chain,atoms:[],occupancy:1,secondary:'other'}) as PdbResidue;
  const rs=[r(8,101,'ALA'),r(20,101,'GLY','A'),r(25,170,'VAL'),r(26,101,'ALA','','B')];
  const m=sequencePositions({residues:rs},new Map([['A',['ALA','GLY','SER','VAL']],['B',['ALA']]]));
  expect([...m]).toEqual([[8,0],[20,1],[25,3],[26,0]]);
 });
 it('fails closed for ambiguous sequence alignments',()=>{expect(()=>sequencePositions({residues:[s.residues[0]]},new Map([['A',['MET','MET']]]))).toThrow(/ambiguous/);});
 it('uses minimum heavy atoms and returns exactly the measured pair',()=>{
  const p=measureResidues(s,0,63,positions)!;
  const all=s.residues[0].atoms.flatMap(a=>s.residues[63].atoms.map(b=>distance(s.atoms[a].position,s.atoms[b].position)));
  expect(p.distance).toBe(Math.min(...all));expect(p.distance).toBe(distance(s.atoms[p.atomA].position,s.atoms[p.atomB].position));expect(p.sequenceGap).toBe(63);
 });
 it('does not treat hydrogens as distance endpoints or same residue as a comparison',()=>{
  const copy=structuredClone(s),i=copy.atoms.length;copy.atoms.push({...copy.atoms[0],element:'H',position:copy.atoms[copy.residues[63].atoms[0]].position});copy.residues[0].atoms.push(i);
  expect(measureResidues(copy,0,63,positions)).toEqual(measureResidues(s,0,63,positions));expect(measureResidues(s,0,0,positions)).toBeNull();
 });
 it('never reports sequence separation across different chains or unmapped positions',()=>{
  const copy=structuredClone(s);copy.residues[63].chain='B';expect(measureResidues(copy,0,63,positions)?.sequenceGap).toBeNull();
  expect(measureResidues(s,0,63,new Map())?.sequenceGap).toBeNull();
 });
 it('chooses three deterministic, disjoint, well separated examples satisfying actual criteria',()=>{
  const pairs=sequenceSpaceExamples(s,positions);expect(pairs).toHaveLength(3);expect(pairs).toEqual(sequenceSpaceExamples(s,positions));
  expect(new Set(pairs.flatMap(p=>[p.a,p.b])).size).toBe(6);
  for(const p of pairs){expect(p.sequenceGap).toBeGreaterThanOrEqual(10);expect(p.distance).toBeLessThanOrEqual(4.5);expect(s.residues[p.a].chain).toBe(s.residues[p.b].chain);}
 });
 it('is rigid-motion invariant and never substitutes residue numbers for sequence indices',()=>{
  const copy=structuredClone(s);copy.atoms.forEach(a=>{const [x,y,z]=a.position;a.position=[-y+200,x-90,z+31];});copy.residues.forEach((r,i)=>r.resSeq=100+i*3);
  for(const p of sequenceSpaceExamples(s,positions)){const q=measureResidues(copy,p.a,p.b,positions)!;expect(q.distance).toBeCloseTo(p.distance,10);expect(q.sequenceGap).toBe(p.sequenceGap);}
 });
 it('keeps distinct A/B selection through either target and clearing',()=>{expect(selectPair({a:3,b:8},'b',3)).toEqual({a:null,b:3});expect(selectPair({a:3,b:8},'a',null)).toEqual({a:null,b:8});expect(selectPair({a:3,b:8},'a',8)).toEqual({a:8,b:null});});
});
