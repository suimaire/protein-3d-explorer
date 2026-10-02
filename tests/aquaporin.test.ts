import {describe,it,expect} from 'vitest';
import pdb from '../src/data/structures/1J4N.pdb?raw';
import rnase from '../src/data/structures/7RSA.pdb?raw';
import opm from './fixtures/1j4n-opm-backbone.json';
import {analyzeAquaporin,AQP1_NPA,AQP1_ARR,AQP1_PARTICLE_RADIUS,aqpInstanceKey,transformAqpPoint,channelPoint,channelClearance} from '../src/protein/aquaporin';
import {AQP1_OPM,AQP1_HALF_THICKNESS} from '../src/protein/aqp1Orientation';
import {applyRigid,determinant,fitRigid} from '../src/protein/rigid';
import {requireResidue} from '../src/protein/coherentPdb';
import {distance,type Vec} from '../src/geometry/vector';
const m=analyzeAquaporin(pdb);
const sourceAtom=(resSeq:number,name:string)=>m.source.atoms.find(a=>a.resSeq===resSeq&&a.name===name)!;
describe('Verified, unchanged deposited structures',()=>{
 it('matches saved original byte checksums',async()=>{
  const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  expect(await hash(pdb)).toBe('4f02d3e91ddb9ac41f102846d9093f31f690b2c1f91caf1e627aea9d7da7ef40');
  expect(await hash(rnase)).toBe('d8d8a22d3260fb1c72a805d9f8a6affcc496ec65c8aadcb4d7ea8dccf6c63b5f');
 });
 it('has bovine 249 of 271 residues, no conformers, 114 waters and three omitted BNG ligands',()=>{
  expect(pdb).toContain('BOS TAURUS');expect(m.header.resolution).toBe(2.2);expect(m.header.method).toBe('X-RAY DIFFRACTION');
  expect(m.source.residues).toHaveLength(249);expect(m.source.atoms).toHaveLength(1852);expect(m.header.seqres.get('A')).toHaveLength(271);
  expect(m.source.residues.map(r=>r.resSeq)).toEqual(Array.from({length:249},(_,i)=>i+1));expect(m.waterCount).toBe(114);
  expect(m.source.omitted.hetero).toBe(63);expect(m.alternateChoices).toHaveLength(0);
  expect(new Set(pdb.split('\n').filter(l=>l.startsWith('HETATM')&&l.slice(17,20)==='BNG').map(l=>l.slice(21,27))).size).toBe(3);
 });
 it('uses the author tetramer rather than alternate PISA octamer',()=>{
  expect(m.assembly.author).toBe('TETRAMERIC');expect(m.assembly.id).toBe(1);expect(m.assembly.operators).toHaveLength(4);expect(m.header.assemblies.find(a=>a.id===2)?.operators).toHaveLength(8);
  expect(m.assembly.operators.map(o=>o.translation)).toEqual([[0,0,0],[93.331,93.331,0],[93.331,0,0],[0,93.331,0]]);
  for(const o of m.assembly.operators)expect(determinant(o.rotation)).toBe(1);
 });
 it('distinguishes every residue and atom instance even with repeated source chain and serial',()=>{
  const keys=m.subunits.flatMap(u=>m.source.residues.map(r=>aqpInstanceKey(u.index,r.chain,r.resSeq,r.insertionCode)));expect(new Set(keys).size).toBe(996);
  expect(new Set(m.subunits.flatMap(u=>m.source.atoms.map(a=>aqpInstanceKey(u.index,a.chain,a.resSeq,a.insertionCode)+':'+a.name))).size).toBe(7408);
  expect(aqpInstanceKey(0,'A',10,'A')).not.toBe(aqpInstanceKey(0,'A',10));
 });
 it('maps bovine NPA and ar/R by residue identity with carbonyl O of Cys191 present',()=>{
  expect(m.npa.map(i=>[m.source.residues[i].resSeq,m.source.residues[i].resName])).toEqual(AQP1_NPA);
  expect(m.arr.map(i=>[m.source.residues[i].resSeq,m.source.residues[i].resName])).toEqual(AQP1_ARR);
  expect(sourceAtom(191,'O').element).toBe('O');expect(()=>requireResidue(m.source,'A',76,'ASN')).toThrow();
 });
});
describe('Independent membrane orientation and pore validation',()=>{
 it('recovers the OPM transform from 996 independently saved backbone correspondences',()=>{
  const a=opm.atoms.map(a=>sourceAtom(a.resSeq,a.name).position),b=opm.atoms.map(a=>a.position as Vec),fit=fitRigid(a,b);
  expect(a).toHaveLength(996);expect(fit.rmsd).toBeLessThan(.003);expect(fit.maxDeviation).toBeLessThan(.007);
  for(let i=0;i<a.length;i++)expect(distance(applyRigid(AQP1_OPM,a[i]),b[i])).toBeLessThan(.007);
  expect(determinant(AQP1_OPM.rotation)).toBeCloseTo(1,10);expect(AQP1_HALF_THICKNESS).toBe(opm.halfThickness);
 });
 it('matches four different OPM monomers without creating new deposited chain IDs',()=>{
  const centroids=Object.values(opm.subunitCentroids) as Vec[];
  const nearest=m.subunits.map(u=>centroids.map(c=>distance(u.center,c)));expect(new Set(nearest.map(ds=>ds.indexOf(Math.min(...ds)))).size).toBe(4);
  nearest.forEach(ds=>expect(Math.min(...ds)).toBeLessThan(.01));expect(m.subunits.every(u=>u.structure.residues.every(r=>r.chain==='A'))).toBe(true);
 });
 it('applies identical assembly and membrane transforms to protein, original waters and paths, preserving distances',()=>{
  for(const u of m.subunits){
   expect(u.structure.atoms[100].position).toEqual(transformAqpPoint(u.operator,m.source.atoms[100].position));
   expect(u.path[40]).toEqual(transformAqpPoint(u.operator,m.sourcePath[40]));
   expect(u.waters[0].position).toEqual(transformAqpPoint(u.operator,[35.021,33.021,32.506]));
   expect(distance(u.structure.atoms[100].position,u.waters[0].position)).toBeCloseTo(distance(m.source.atoms[100].position,[35.021,33.021,32.506]),10);
  }
 });
 it('retains four measured pore waters and their literature polar neighbours',()=>{
  expect(m.waterContacts.map(w=>w.water)).toEqual([301,302,303,304]);
  const pairs=m.waterContacts.flatMap(w=>w.contacts.map(c=>[w.water,c.resSeq,c.atom]));
  for(const p of [[301,182,'NE2'],[301,192,'O'],[302,194,'ND2'],[303,78,'ND2'],[303,194,'ND2'],[304,75,'O'],[304,76,'O']])expect(pairs).toContainEqual(p);
  expect(m.waterContacts.every(w=>w.contacts.every(c=>c.distance<=3.5))).toBe(true);
 });
 it('keeps the entire displayed path and particle glyph outside all tetramer vdW spheres and away from its central space',()=>{
  const all=m.subunits.flatMap(u=>u.structure.atoms);let minimum=Infinity,maxStep=0;
  for(const u of m.subunits)for(let j=0;j<=2120;j++){
   const p=channelPoint(u.path,j/2120);minimum=Math.min(minimum,channelClearance(all,p));if(j)maxStep=Math.max(maxStep,distance(p,channelPoint(u.path,(j-1)/2120)));
   expect(Math.hypot(p[0]-m.axis[0],p[1]-m.axis[1])).toBeGreaterThan(12);
  }
  // Measured sampling interval: the Lipschitz distance bound also covers between samples.
  expect(maxStep).toBeLessThan(.065);expect(minimum-maxStep).toBeGreaterThan(AQP1_PARTICLE_RADIUS);expect(minimum).toBeGreaterThan(.95);
 });
 it('uses linear segments without spline overshoot and actually passes near the four deposited waters',()=>{
  expect(channelPoint(m.sourcePath,0)).toEqual(m.sourcePath[0]);expect(channelPoint(m.sourcePath,1)).toEqual(m.sourcePath.at(-1));
  for(const u of m.subunits)for(const w of u.waters)expect(Math.min(...u.path.map(p=>distance(p,w.position)))).toBeLessThan(1.5);
 });
 it('validates a conservative exterior rule separately from the inner pore, using intact tetramer SASA',()=>{
  expect(m.exposure).toHaveLength(996);
  for(const rs of m.regions){
   expect(rs.filter(r=>r.region==='pore')).toHaveLength(23);expect(rs.filter(r=>r.region==='lipid')).toHaveLength(26);
   for(const r of rs){if(r.region==='pore')expect(r.near).toBeLessThanOrEqual(4.5);
    if(r.region==='lipid'){expect(r.near).toBeGreaterThan(4.5);expect(Math.abs(r.depth)).toBeLessThanOrEqual(15.9);expect(r.surface).toBeGreaterThanOrEqual(.25);expect(r.outward).toBeGreaterThan(0);expect(r.minSidePath).toBeGreaterThan(6);}}
  }
 });
});
