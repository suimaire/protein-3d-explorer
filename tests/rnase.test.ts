import {describe,it,expect} from 'vitest';
import text from '../src/data/structures/7RSA.pdb?raw';
import {analyzeRnase,RNASE_NATIVE_PAIRS,RNASE_INITIAL,RNASE_CONDITIONS,rnaseReducer,rnaseTopology} from '../src/protein/rnase';
import {parseCoherentPdb,requireResidue} from '../src/protein/coherentPdb';
import {distance} from '../src/geometry/vector';
const m=analyzeRnase(text);
describe('RNase experimental source',()=>{
 it('verifies species, experiment, resolution, 124 mapped residues and identity monomer',()=>{expect(text).toContain('BOS TAURUS');expect(m.header.method).toBe('X-RAY DIFFRACTION');expect(m.header.resolution).toBe(1.26);expect(m.structure.residues.length).toBe(124);expect(m.positions.size).toBe(124);expect(m.header.assemblies[0].author).toBe('MONOMERIC');expect(m.header.assemblies[0].operators).toEqual([{rotation:[[1,0,0],[0,1,0],[0,0,1]],translation:[0,0,0]}]);});
 it('resolves exactly the four literature Cys pairs by author IDs, not array subscripts',()=>{
  expect(m.disulfides.map(p=>[m.structure.residues[p.a].resSeq,m.structure.residues[p.b].resSeq])).toEqual(RNASE_NATIVE_PAIRS);
  for(const p of m.disulfides){expect(m.structure.atoms[p.atomA].name).toBe('SG');expect(m.structure.atoms[p.atomB].name).toBe('SG');expect(p.distance).toBe(distance(m.structure.atoms[p.atomA].position,m.structure.atoms[p.atomB].position));expect(p.distance).toBeGreaterThan(1.9);expect(p.distance).toBeLessThan(2.2);}
 });
 it('records absence of deposited SSBOND rather than fabricating annotations',()=>{expect(m.depositedDisulfideRecords).toEqual([]);});
 it('uses one conformer per residue, common atoms allowed, and all eight Cys have one SG',()=>{
  expect(m.alternateChoices.length).toBe(13);for(const r of m.structure.residues)expect(new Set(r.atoms.map(i=>m.structure.atoms[i].altLoc).filter(Boolean)).size).toBeLessThanOrEqual(1);
  expect(m.cysteines.size).toBe(8);for(const i of m.cysteines)expect(m.structure.residues[i].atoms.filter(a=>m.structure.atoms[a].name==='SG')).toHaveLength(1);
 });
 it('never mixes conformers even when per-atom occupancy rankings disagree',()=>{
  const mutated=text.split('\n').map(l=>l.startsWith('ATOM')&&l.slice(22,26).trim()==='11'&&l.slice(12,16).trim()==='NE2'?l.slice(0,54)+(l[16]==='B'?'  0.99':'  0.01')+l.slice(60):l).join('\n');
  const r=parseCoherentPdb(mutated).structure;expect(new Set(requireResidue(r,'A',11,'GLN').atoms.map(i=>r.atoms[i].altLoc).filter(Boolean)).size).toBe(1);
 });
 it('fails on absent Cys, wrong identity, insertion code or absent sulfur',()=>{
  expect(()=>requireResidue(m.structure,'A',26,'CYS','A')).toThrow();expect(()=>requireResidue(m.structure,'B',26,'CYS')).toThrow();
  expect(()=>analyzeRnase(text.split('\n').filter(l=>!(l.startsWith('ATOM')&&l.slice(22,26).trim()==='26'&&l.slice(12,16).trim()==='SG')).join('\n'))).toThrow(/SG/);
 });
 it('retains all backbone peptide bonds while separately modelling S–S',()=>{const peptides=m.bonds.filter(([a,b])=>m.structure.atoms[a].resSeq!==m.structure.atoms[b].resSeq);expect(peptides).toHaveLength(123);expect(peptides.every(([a,b])=>m.structure.atoms[a].name==='C'&&m.structure.atoms[b].name==='N'||m.structure.atoms[b].name==='C'&&m.structure.atoms[a].name==='N')).toBe(true);});
});
describe('RNase condition activity',()=>{
 it('display toggle does not mutate condition or chemical connectivity',()=>{let s=rnaseReducer(RNASE_INITIAL,{type:'condition',value:'reduced'});s=rnaseReducer(s,{type:'display',value:false});expect(s.condition).toBe('reduced');expect(s.showBonds).toBe(false);s=rnaseReducer(s,{type:'condition',value:'scrambled'});expect(s.showBonds).toBe(false);expect(s.condition).toBe('scrambled');});
 it('correctly distinguishes experimental, schematic and reference reuse states',()=>{expect(RNASE_CONDITIONS.native.schematic).toBe(false);expect(RNASE_CONDITIONS.reduced.schematic).toBe(true);expect(RNASE_CONDITIONS.scrambled.schematic).toBe(true);expect(RNASE_CONDITIONS.refolded.evidence).toContain('기준 좌표 재사용');expect(RNASE_CONDITIONS.exchanged.evidence).toContain('기준 좌표 재사용');});
 it('maintains all residues and chain edges without physical distance units in both schematics',()=>{
  for(const c of ['reduced','scrambled'] as const){const g=rnaseTopology(m,c);expect(g.points).toHaveLength(124);expect(g.peptideEdges).toHaveLength(123);expect(g.unit).toBe('schematic');expect(g.residueOrder).toEqual(m.structure.residues.map(r=>r.index));g.peptideEdges.forEach(([a,b],i)=>expect([a,b]).toEqual([i,i+1]));}
  expect(rnaseTopology(m,'reduced').crosslinks).toHaveLength(0);const g=rnaseTopology(m,'scrambled');expect(g.crosslinks).toHaveLength(4);expect(new Set(g.crosslinks.flat()).size).toBe(8);expect(g.crosslinks.every(p=>p.every(i=>m.cysteines.has(i)))).toBe(true);
 });
 it('clears stale pair selection on phase changes and fully resets exploration and display',()=>{const s={...RNASE_INITIAL,selectedBond:2,selectedResidue:57,showBonds:false};expect(rnaseReducer(s,{type:'condition',value:'scrambled'}).selectedBond).toBeNull();expect(rnaseReducer(s,{type:'reset'})).toEqual(RNASE_INITIAL);});
});
