import {describe,it,expect} from 'vitest';
import tRaw from '../src/data/structures/2DN2.pdb?raw';
import rRaw from '../src/data/structures/2DN1.pdb?raw';
import metaText from './fixtures/2dn1-rcsb-metadata.json?raw';
import ccdText from './fixtures/hem-ccd-bonds.json?raw';
import {parsePdbHeader,parseMultiChainPdb,residueKey} from '../src/protein/pdb';
import {analyzeHemoglobin,HEMOGLOBIN_SOURCE,SUBUNIT_ORDER} from '../src/protein/hemoglobin';
import {analyzeTransition,interpolatePositions,morphPositions,planeDistance,screwMotion,transitionSceneModel,MOVING_DIMER,REFERENCE_DIMER,R_SOURCE,T_SOURCE} from '../src/protein/hemoglobinTransition';
import {applyRigid,determinant,fitRigid} from '../src/protein/rigid';
import {buildAssembly,INTERFACE_CUTOFF} from '../src/protein/quaternary';
import {inferBonds} from '../src/protein/exposure';
import {distance,type Vec} from '../src/geometry/vector';

const meta=JSON.parse(metaText) as {entry:{resolution:number;method:string;depositedUnmodeledMonomers:number};
 assembly:{oligomericCount:number;operators:{id:string;type:string;symmetry:string;matrix:number[][];vector:number[]}[];operExpression:string;polymerInstances:number;modeledPolymerMonomers:number;unmodeledPolymerMonomers:number};
 assemblyFile:{coordinateRecordsPerModel:number[];coordinateDigest:{model1:string;model2:string}};
 entities:{chains:string[];uniprot:string[];sequence:string;sourceType:string;organism:string;mutations:number}[];nonpolymerEntities:{compId:string}[]};
const ccd=(JSON.parse(ccdText) as {bonds:[string,string,string][]}).bonds.map(([a,b])=>[a,b].sort().join('-')).sort();
const sha256=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const ONE:Record<string,string>={ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V'};
const HEAVY:Record<string,number>={GLY:4,ALA:5,SER:6,CYS:6,VAL:7,THR:7,PRO:7,ILE:8,LEU:8,ASP:8,ASN:8,GLU:9,GLN:9,LYS:9,MET:8,HIS:10,PHE:11,ARG:11,TYR:12,TRP:14};

const model=analyzeTransition(tRaw,rRaw),{t,r}=model,ta=t.structure.atoms,ra=r.structure.atoms;
const label=(m:typeof t,l:string)=>m.subunits.find(s=>s.label===l)!;
const caOf=(labels:string[])=>model.common.filter(c=>labels.some(l=>c.key.startsWith(`${l}:`))&&c.key.endsWith(':CA')&&!c.key.includes(':HEM:'));

describe('Structure: R endpoint PDB 2DN1 human oxyhemoglobin A',()=>{
 it('1 · R asset is the unmodified RCSB download (SHA-256) with the expected metadata; T asset unchanged',async()=>{
  expect(await sha256(rRaw)).toBe(R_SOURCE.sha256);expect(await sha256(tRaw)).toBe(HEMOGLOBIN_SOURCE.sha256);
  expect(rRaw).toMatch(/TITLE {5}1\.25A RESOLUTION CRYSTAL STRUCTURE OF HUMAN HEMOGLOBIN IN THE OXY FORM/);
  expect(rRaw).toContain('DOI    10.1016/J.JMB.2006.05.036');expect(rRaw).toContain('ORGANISM_SCIENTIFIC: HOMO SAPIENS');
  expect(parsePdbHeader(rRaw)).toMatchObject({resolution:meta.entry.resolution,method:meta.entry.method});
  expect(R_SOURCE.resolution).toBe(1.25);expect(rRaw).not.toMatch(/^SEQADV|^MODRES/m);
  for(const e of meta.entities)expect(e).toMatchObject({sourceType:'natural',organism:'Homo sapiens',mutations:0});
  expect(T_SOURCE.pdbId).toBe('2DN2');expect(t.structure.id).toBe('2DN2');expect(r.structure.id).toBe('2DN1');
 });
 it('2 · biological assembly α2β2: αβ asymmetric unit + BIOMT 2 (y, x, −z) = RCSB assembly 1 and its generated file',async()=>{
  const header=parsePdbHeader(rRaw);
  expect(header.assemblies).toHaveLength(1);expect(header.assemblies[0].chains).toEqual(['A','B']);
  expect(header.assemblies[0].operators.map(o=>({rotation:o.rotation,translation:o.translation}))).toEqual(meta.assembly.operators.map(o=>({rotation:o.matrix,translation:o.vector})));
  expect(meta.assembly).toMatchObject({oligomericCount:4,operExpression:'1,2',polymerInstances:4});
  expect(meta.assembly.operators.map(o=>o.symmetry)).toEqual(['x,y,z','y,x,-z']);
  expect(determinant(header.assemblies[0].operators[1].rotation)).toBe(-1*-1);
  expect(r.operators).toBe(2);expect(r.structure.chains).toEqual(['A','B','A_2','B_2']);
  expect(r.subunits.map(s=>[s.label,s.type,s.sourceChain,s.operator])).toEqual([['α1','alpha','A',1],['β1','beta','B',1],['α2','alpha','A',2],['β2','beta','B',2]]);
  // Applying the file's operators to every deposited coordinate record reproduces RCSB's 2DN1.pdb1 MODEL 1 and MODEL 2 exactly.
  const records=rRaw.split(/\r?\n/).filter(l=>/^(ATOM|HETATM)/.test(l)),ops=header.assemblies[0].operators;
  const f=(v:number)=>(Object.is(v,-0)||Math.abs(v)<5e-4?0:v).toFixed(3).padStart(8);
  const models=ops.map(op=>records.map(l=>{const p:Vec=[Number(l.slice(30,38)),Number(l.slice(38,46)),Number(l.slice(46,54))],q=applyRigid({rotation:op.rotation,translation:op.translation},p);return l.slice(0,30)+q.map(f).join('')+l.slice(54,66);}));
  expect(models.map(m=>m.length)).toEqual(meta.assemblyFile.coordinateRecordsPerModel);
  expect(await sha256(models[0].join('\n'))).toBe(meta.assemblyFile.coordinateDigest.model1);
  expect(await sha256(models[1].join('\n'))).toBe(meta.assemblyFile.coordinateDigest.model2);
  // The analysed copy chains equal operator 2 applied to chains A/B atom for atom.
  const dep=parseMultiChainPdb(rRaw);
  for(const [copy,src] of [['A_2','A'],['B_2','B']] as const){
   const a=ra.filter(x=>x.chain===copy&&!x.hetero),b=dep.atoms.filter(x=>x.chain===src&&!x.hetero);
   expect(a.map(x=>x.name)).toEqual(b.map(x=>x.name));
   a.forEach((x,i)=>expect(x.position).toEqual([b[i].position[1],b[i].position[0],-b[i].position[2]]));
  }
 });
 it('3 · four hemes (43 atoms, one Fe each), one per chain by coordinates; heme bonds equal the CCD HEM connectivity in both endpoints',()=>{
  for(const m of [t,r]){
   expect(m.hemes).toHaveLength(4);
   expect(m.structure.hetero.filter(g=>g.resName==='HEM').map(g=>g.atoms.length)).toEqual([43,43,43,43]);
   expect(m.structure.atoms.filter(a=>a.element==='FE')).toHaveLength(4);
   for(const s of m.subunits){expect(s.heme.association.chain).toBe(s.chain);for(const c of m.structure.chains)if(c!==s.chain)expect(s.heme.association.contacts[c]).toBe(0);}
   // Preflight: distance-inferred heme bonds are exactly the chemical bonds of the CCD component (no wrong atom pairs);
   // the short 1.0–1.25 Å carboxylate/vinyl distances are in the deposited coordinates themselves.
   for(const h of m.hemes){
    const names=m.hemeBonds.filter(([a])=>m.structure.hetero.find(g=>g.index===h.group)!.atoms.includes(a)).map(([a,b])=>[m.structure.atoms[a].name,m.structure.atoms[b].name].sort().join('-')).sort();
    expect(names).toEqual(ccd);
   }
  }
 });
 it('4 · ligand: exactly one deposited O₂ (OXY) per heme Fe, full occupancy, no altlocs; toluene declared and not a ligand; no ligand in T',()=>{
  expect(r.ligands.map(l=>l.resName)).toEqual(['OXY','OXY','OXY','OXY']);
  expect(new Set(r.ligands.map(l=>l.heme))).toEqual(new Set(r.hemes.map(h=>h.group)));
  for(const l of r.ligands){
   expect(l.atoms.map(i=>ra[i].name)).toEqual(['O1','O2']);expect(l.occupancy).toBe(1);expect(l.altlocs).toBe(0);
   expect(ra[l.feAtom].name).toBe('O1');expect(l.feDistance).toBeGreaterThan(1.7);expect(l.feDistance).toBeLessThan(1.9);
  }
  const links=parsePdbHeader(rRaw).links.filter(l=>l.b.resName==='OXY'&&l.b.name==='O1');
  expect(links.map(l=>l.distance)).toEqual([1.82,1.78]);
  expect(r.ligands.slice(0,2).map(l=>Number(l.feDistance.toFixed(2)))).toEqual([1.82,1.78]);
  expect(r.additives.map(a=>a.resName)).toEqual(['MBN','MBN','MBN','MBN']);
  expect(meta.nonpolymerEntities.map(n=>n.compId)).toEqual(['HEM','OXY','MBN']);
  expect(t.ligands).toEqual([]);expect(t.structure.hetero.every(g=>g.resName==='HEM')).toBe(true);
  // Undeclared hetero groups still make the analysis fail.
  expect(()=>analyzeHemoglobin(rRaw)).toThrow(/unexpected hetero groups/);
 });
 it('5 · chain completeness: R lacks Val1 of α and β and six His2 β side-chain atoms (REMARK 465/470); T is complete; no altlocs',()=>{
  const header=parsePdbHeader(rRaw);
  expect(header.missingResidues).toBe(2);expect(header.missingAtoms).toBe(1);expect(meta.entry.depositedUnmodeledMonomers).toBe(2);
  expect(r.subunits.map(s=>[s.label,s.modeledResidues,s.firstResSeq,s.lastResSeq])).toEqual([['α1',140,2,141],['β1',145,2,146],['α2',140,2,141],['β2',145,2,146]]);
  expect(r.subunits.reduce((n,s)=>n+s.modeledResidues,0)).toBe(meta.assembly.modeledPolymerMonomers);
  for(const s of r.subunits){
   const e=meta.entities.find(x=>x.uniprot[0]===s.uniprot)!;
   expect(parsePdbHeader(rRaw).seqres.get(s.sourceChain)!.map(x=>ONE[x]).join('')).toBe(e.sequence);
   for(const i of s.residues){const res=r.structure.residues[i],n=res.atoms.length-(res.resSeq===s.lastResSeq?1:0);
    if(s.type==='beta'&&res.resSeq===2)expect(n).toBe(HEAVY.HIS-6);else expect(n).toBe(HEAVY[res.resName]);}
  }
  expect(t.subunits.map(s=>s.modeledResidues)).toEqual([141,146,141,146]);
  for(const m of [t,r])expect(m.structure.omitted.alternateLocations).toBe(0);
  expect(model.correspondence.map(c=>[c.label,c.tOnly,c.rOnly,c.incomplete.map(x=>`${x.residue}:${x.tOnlyAtoms.join('/')}`)])).toEqual([
   ['α1',['VAL1'],[],[]],['β1',['VAL1'],[],['HIS2:CB/CG/ND1/CD2/CE1/NE2']],['α2',['VAL1'],[],[]],['β2',['VAL1'],[],['HIS2:CB/CG/ND1/CD2/CE1/NE2']]]);
 });
});

describe('Mapping T ↔ R',()=>{
 it('6 · α chains correspond by DBREF accession and identical sequence (T A/C ↔ R A/A_2)',()=>{
  for(const l of ['α1','α2']){const c=model.correspondence.find(x=>x.label===l)!;expect(c.type).toBe('alpha');expect(c.identity).toBe(1);expect(c.sequenceLength).toBe(141);
   expect(label(t,l).uniprot).toBe('P69905');expect(label(r,l).uniprot).toBe('P69905');}
  expect(model.correspondence.filter(c=>c.type==='alpha').map(c=>[c.tChain,c.rChain])).toEqual([['A','A'],['C','A_2']]);
 });
 it('7 · β chains correspond likewise (T B/D ↔ R B/B_2); β1 is the larger α1 contact in both structures',()=>{
  for(const l of ['β1','β2']){const c=model.correspondence.find(x=>x.label===l)!;expect(c.type).toBe('beta');expect(c.identity).toBe(1);expect(c.sequenceLength).toBe(146);
   expect(label(t,l).uniprot).toBe('P68871');expect(label(r,l).uniprot).toBe('P68871');}
  expect(model.correspondence.filter(c=>c.type==='beta').map(c=>[c.tChain,c.rChain])).toEqual([['B','B'],['D','B_2']]);
  for(const m of [t,r]){
   const size=(a:string,b:string)=>{const p=m.interfaces.pairs.find(x=>x.chains.includes(a)&&x.chains.includes(b));return p?p.residues[0].length+p.residues[1].length:0;};
   expect(size(label(m,'α1').chain,label(m,'β1').chain)).toBeGreaterThan(size(label(m,'α1').chain,label(m,'β2').chain));
   expect(size(label(m,'α1').chain,label(m,'β2').chain)).toBeGreaterThan(0);
  }
 });
 it('8 · chain-aware residue mapping: same label + UniProt position + resName; keys never collide between chains or endpoints',()=>{
  for(const m of [t,r])expect(new Set(m.structure.residues.map(residueKey)).size).toBe(m.structure.residues.length);
  expect(r.structure.residues.map(residueKey)).toContain('A_2:9:ASN');
  const keys=model.common.map(c=>c.key);
  expect(keys.every(k=>/^(α1|β1|α2|β2):(\d+|HEM):[A-Z0-9]{2,3}:[A-Z0-9]+$/.test(k)||/^(α1|β1|α2|β2):HEM:[A-Z0-9]+$/.test(k))).toBe(true);
  for(const c of model.common){
   const a=ta[c.t],b=ra[c.r];expect(a.name).toBe(b.name);expect(a.resName).toBe(b.resName);expect(a.resSeq).toBe(b.resSeq);
   expect(t.subunits.find(s=>s.chain===a.chain)!.label).toBe(r.subunits.find(s=>s.chain===b.chain)!.label);
  }
  // The same resSeq in α1 and α2 maps to different atoms.
  const a1=model.common.find(c=>c.key==='α1:9:ASN:CA')!,a2=model.common.find(c=>c.key==='α2:9:ASN:CA')!;
  expect(a1.t).not.toBe(a2.t);expect(a1.r).not.toBe(a2.r);expect([ta[a1.t].chain,ta[a2.t].chain,ra[a1.r].chain,ra[a2.r].chain]).toEqual(['A','C','A','A_2']);
 });
 it('9 · atom correspondence is deterministic: repeated analysis and a re-ordered R file give identical key → atom identity',()=>{
  const again=analyzeTransition(tRaw,rRaw),id=(m:typeof model)=>m.common.map(c=>`${c.key}=${ta[c.t].serial}/${m.r.structure.atoms[c.r].chain}${m.r.structure.atoms[c.r].serial}`);
  expect(id(again)).toEqual(id(model));
  const lines=rRaw.split(/\r?\n/),coords=lines.filter(l=>/^(ATOM|HETATM)/.test(l)),header=lines.filter(l=>!/^(ATOM|HETATM|TER|END)/.test(l));
  const reordered=[...header,...coords.filter(l=>l.startsWith('HETATM')),...coords.filter(l=>l.startsWith('ATOM')&&l[21]==='B'),...coords.filter(l=>l.startsWith('ATOM')&&l[21]==='A'),'END'].join('\n');
  const shuffled=analyzeTransition(tRaw,reordered);
  expect(shuffled.common.map(c=>c.key)).toEqual(model.common.map(c=>c.key));
  shuffled.common.forEach((c,i)=>expect(shuffled.r.structure.atoms[c.r].position).toEqual(ra[model.common[i].r].position));
  expect(shuffled.reference.rmsd).toBeCloseTo(model.reference.rmsd,9);
 });
 it('10 · no duplicate mapping: every common key, T atom and R atom is used once; counts match the documented differences',()=>{
  expect(new Set(model.common.map(c=>c.key)).size).toBe(model.common.length);
  expect(new Set(model.common.map(c=>c.t)).size).toBe(model.common.length);
  expect(new Set(model.common.map(c=>c.r)).size).toBe(model.common.length);
  // T has 2×Val1 α (7) + 2×Val1 β (7) + 2×6 His2 β side-chain atoms more than R's polymer; hemes all common.
  const tPolymer=ta.filter(a=>!a.hetero).length,common=model.common.filter(c=>!c.key.includes(':HEM:')).length;
  expect(tPolymer-common).toBe(2*7+2*7+2*6);
  expect(ra.filter(a=>!a.hetero).length).toBe(common);
  expect(model.common.filter(c=>c.key.includes(':HEM:'))).toHaveLength(172);
  expect(model.common.some(c=>ra[c.r].resName==='OXY'||ra[c.r].resName==='MBN')).toBe(false);
 });
});

describe('Alignment on the reference αβ dimer',()=>{
 it('11 · reference dimer α1β1 Cα RMSD from the 285 common Cα pairs (α 2–141, β 2–146)',()=>{
  expect(REFERENCE_DIMER).toEqual(['α1','β1']);expect(MOVING_DIMER).toEqual(['α2','β2']);
  const pairs=caOf(REFERENCE_DIMER);expect(pairs).toHaveLength(285);expect(model.reference.matched).toBe(285);
  const moved=pairs.map(c=>applyRigid(model.reference,ra[c.r].position)),target=pairs.map(c=>ta[c.t].position);
  const rmsd=Math.sqrt(moved.reduce((s,p,i)=>s+distance(p,target[i])**2,0)/pairs.length);
  expect(model.reference.rmsd).toBeCloseTo(rmsd,10);
  expect(rmsd).toBeGreaterThan(0.3);expect(rmsd).toBeLessThan(1.5);
  // Least squares: small perturbations of the fitted transform never lower the RMSD.
  for(const d of [[0.02,0,0],[0,-0.02,0],[0,0,0.02]] as Vec[]){
   const worse=Math.sqrt(moved.reduce((s,p,i)=>s+distance([p[0]+d[0],p[1]+d[1],p[2]+d[2]],target[i])**2,0)/pairs.length);expect(worse).toBeGreaterThan(rmsd);
  }
 });
 it('12 · rigid transform only: orthonormal rotation, unit scale, translation; the whole R structure uses the same transform',()=>{
  const R=model.reference.rotation;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)expect(R[i][0]*R[j][0]+R[i][1]*R[j][1]+R[i][2]*R[j][2]).toBeCloseTo(i===j?1:0,12);
  expect(model.reference.translation.every(Number.isFinite)).toBe(true);
  for(let k=0;k<ra.length;k+=53)expect(model.rAligned[k]).toEqual(applyRigid(model.reference,ra[k].position));
  expect(model.rAligned).toHaveLength(ra.length);
 });
 it('13 · rotation determinant = +1 (no reflection) for the reference and moving fits',()=>{
  expect(model.reference.determinant).toBeCloseTo(1,12);expect(model.moving.fit.determinant).toBeCloseTo(1,12);
  // A mirrored target cannot be fitted by a reflection: the RMSD stays large and the determinant stays +1.
  const pts=caOf(REFERENCE_DIMER).map(c=>ta[c.t].position),mirror=pts.map(p=>[-p[0],p[1],p[2]] as Vec),fit=fitRigid(pts,mirror);
  expect(determinant(fit.rotation)).toBeCloseTo(1,12);expect(fit.rmsd).toBeGreaterThan(5);
 });
 it('14 · internal distances of R are preserved by the alignment (no scaling or deformation)',()=>{
  for(let k=0;k<ra.length-400;k+=211){const a=k,b=k+397;expect(distance(model.rAligned[a],model.rAligned[b])).toBeCloseTo(distance(ra[a].position,ra[b].position),9);}
  const s=model.r.subunits[3];const own=s.residues.flatMap(i=>r.structure.residues[i].atoms);
  expect(distance(model.rAligned[own[0]],model.rAligned[own.at(-1)!])).toBeCloseTo(distance(ra[own[0]].position,ra[own.at(-1)!].position),9);
  // T coordinates are never modified.
  expect(ta[0].position).toEqual(parseMultiChainPdb(tRaw).atoms[0].position);
 });
 it('15 · alignment is deterministic',()=>{
  const again=analyzeTransition(tRaw,rRaw);
  expect(again.reference.rotation).toEqual(model.reference.rotation);expect(again.reference.translation).toEqual(model.reference.translation);
  expect(again.reference.rmsd).toBe(model.reference.rmsd);expect(again.rAligned).toEqual(model.rAligned);
 });
});

describe('Quaternary difference of the moving αβ dimer',()=>{
 it('16 · after reference alignment the moving dimer α2β2 is rotated (non-zero best-fit angle) while keeping its own shape',()=>{
  expect(model.moving.fit.matched).toBe(285);
  expect(model.moving.screw.angle).toBeGreaterThan(5);expect(model.moving.screw.angle).toBeLessThan(25);
  // The dimer itself is nearly rigid, unlike its position relative to α1β1.
  expect(model.moving.fit.rmsd).toBeLessThan(1.5);expect(model.moving.rmsdBeforeFit).toBeGreaterThan(3*model.moving.fit.rmsd);
  // The angle agrees with the rotation-matrix trace and the axis is a unit eigenvector (R·u = u).
  const R=model.moving.fit.rotation,u=model.moving.screw.axis,Ru=applyRigid({rotation:R,translation:[0,0,0]},u);
  expect(Math.acos((R[0][0]+R[1][1]+R[2][2]-1)/2)*180/Math.PI).toBeCloseTo(model.moving.screw.angle,9);
  Ru.forEach((v,k)=>expect(v).toBeCloseTo(u[k],9));expect(Math.hypot(...u)).toBeCloseTo(1,12);
  // Swapping roles (α2β2 as reference) gives the same relative rotation.
  expect(model.reversed.angle).toBeCloseTo(model.moving.screw.angle,1);
  // A whole-tetramer fit spreads the difference: worse than either dimer fit.
  expect(model.wholeTetramerRmsd).toBeGreaterThan(2*model.reference.rmsd);
 });
 it('17 · moving dimer centroid displacement is non-zero and equals the fitted motion applied to the T centroid',()=>{
  expect(model.moving.centroidDisplacement).toBeGreaterThan(1);
  const {centroidT,centroidR,fit,screw}=model.moving,moved=applyRigid(fit,centroidT);
  moved.forEach((v,k)=>expect(v).toBeCloseTo(centroidR[k],9));
  // Chasles: rotating about the axis through axisPoint plus the axial translation reproduces the same motion.
  const p=screw.axisPoint,u=screw.axis,rel:Vec=[centroidT[0]-p[0],centroidT[1]-p[1],centroidT[2]-p[2]],rot=applyRigid({rotation:fit.rotation,translation:[0,0,0]},rel);
  rot.forEach((v,k)=>expect(p[k]+v+u[k]*screw.screwTranslation).toBeCloseTo(centroidR[k],6));
  expect(screwMotion(fit,centroidT).angle).toBeCloseTo(screw.angle,12);
 });
 it('18 · calculated values are deterministic and match the documented audit (rounded)',()=>{
  const again=analyzeTransition(tRaw,rRaw);
  expect(again.moving.screw).toEqual(model.moving.screw);expect(again.moving.centroidDisplacement).toBe(model.moving.centroidDisplacement);
  expect(Number(model.reference.rmsd.toFixed(2))).toBe(0.93);
  expect(Number(model.moving.screw.angle.toFixed(1))).toBe(14.1);
  expect(Number(model.moving.centroidDisplacement.toFixed(1))).toBe(3.1);
  expect(Number(model.moving.screw.screwTranslation.toFixed(1))).toBe(-1.3);
 });
});

describe('Morph (visual interpolation only)',()=>{
 const scene=transitionSceneModel(model);
 it('19 · fraction 0 returns exactly the T coordinates of the common atoms',()=>{
  expect(morphPositions(model,0)).toEqual(model.common.map(c=>ta[c.t].position));
  expect(scene.morph.tPositions).toEqual(model.common.map(c=>ta[c.t].position));
 });
 it('20 · fraction 1 returns exactly the aligned R coordinates',()=>{
  expect(morphPositions(model,1)).toEqual(model.common.map(c=>model.rAligned[c.r]));
  expect(scene.morph.rPositions).toEqual(model.common.map(c=>model.rAligned[c.r]));
 });
 it('21 · fraction 0.5 is finite, the midpoint of each pair; bonds are kept and no atom appears or disappears',()=>{
  const mid=morphPositions(model,0.5);
  expect(mid).toHaveLength(model.common.length);expect(mid.every(p=>p.every(Number.isFinite))).toBe(true);
  mid.forEach((p,k)=>{if(k%97)return;const a=ta[model.common[k].t].position,b=model.rAligned[model.common[k].r];p.forEach((v,i)=>expect(v).toBeCloseTo((a[i]+b[i])/2,9));});
  // Connectivity: the morph layer's bonds are the T bonds among common atoms, and the same key pairs are bonds in R.
  const rKey=new Map(model.common.map((c,k)=>[c.r,k])),rBonds=new Set([...r.bonds,...r.hemeBonds].map(([a,b])=>[rKey.get(a),rKey.get(b)]).filter(([a,b])=>a!==undefined&&b!==undefined).map(p=>(p as number[]).sort((x,y)=>x-y).join('-')));
  const morphBonds=[...scene.morph.polymerBonds,...scene.morph.hemeBonds].map(p=>[...p].sort((x,y)=>x-y).join('-'));
  expect(morphBonds.length).toBeGreaterThan(4000);
  expect(morphBonds.every(b=>rBonds.has(b))).toBe(true);
  expect(new Set(morphBonds)).toEqual(rBonds);
  // Endpoint bond lengths are the deposited ones; midpoint lengths are finite and non-zero but NOT physical
  // (straight-line interpolation shortens bonds where side chains, C-terminal carbonyls or propionates differ; documented).
  const t0=morphPositions(model,0),t1=morphPositions(model,1);
  for(const [a,b] of scene.morph.polymerBonds){
   expect(distance(t0[a],t0[b])).toBe(distance(ta[model.common[a].t].position,ta[model.common[b].t].position));
   expect(distance(t1[a],t1[b])).toBe(distance(model.rAligned[model.common[a].r],model.rAligned[model.common[b].r]));
   expect(distance(mid[a],mid[b])).toBeGreaterThan(0);
  }
  const shortened=[...scene.morph.polymerBonds,...scene.morph.hemeBonds].filter(([a,b])=>distance(mid[a],mid[b])<Math.min(distance(t0[a],t0[b]),distance(t1[a],t1[b]))-0.1);
  expect(shortened.length).toBeGreaterThan(0);expect(shortened.length/morphBonds.length).toBeLessThan(0.1);
  expect(()=>morphPositions(model,1.2)).toThrow();expect(()=>morphPositions(model,Number.NaN)).toThrow();
 });
 it('22 · returning to either endpoint after intermediate values restores the exact endpoint; inputs are never modified',()=>{
  const before=JSON.stringify(ta.map(a=>a.position)),aligned=JSON.stringify(model.rAligned);
  for(const f of [0.3,0.77,0.5])interpolatePositions(scene.morph.tPositions,scene.morph.rPositions,f);
  expect(interpolatePositions(scene.morph.tPositions,scene.morph.rPositions,0)).toEqual(scene.morph.tPositions);
  expect(interpolatePositions(scene.morph.tPositions,scene.morph.rPositions,1)).toEqual(scene.morph.rPositions);
  expect(JSON.stringify(ta.map(a=>a.position))).toBe(before);expect(JSON.stringify(model.rAligned)).toBe(aligned);
 });
});

describe('Heme and ligand',()=>{
 it('23 · T/R heme mapping: heme n belongs to the same subunit label in both, all 43 heme atoms correspond',()=>{
  expect(t.hemes.map(h=>h.number)).toEqual([1,2,3,4]);expect(r.hemes.map(h=>h.number)).toEqual([1,2,3,4]);
  for(const l of SUBUNIT_ORDER){
   const th=label(t,l).heme,rh=label(r,l).heme;expect(th.number).toBe(rh.number);
   expect(model.common.filter(c=>c.key.startsWith(`${l}:HEM:`))).toHaveLength(43);
   const fe=model.common.find(c=>c.key===`${l}:HEM:FE`)!;expect(fe.t).toBe(th.iron);expect(fe.r).toBe(rh.iron);
  }
  // Fe positions agree closely for the reference dimer after alignment and differ more for the moving dimer.
  const feShift=(l:string)=>distance(ta[label(t,l).heme.iron].position,model.rAligned[label(r,l).heme.iron]);
  expect(Math.max(feShift('α1'),feShift('β1'))).toBeLessThan(2);expect(Math.min(feShift('α2'),feShift('β2'))).toBeGreaterThan(Math.max(feShift('α1'),feShift('β1')));
 });
 it('24 · proximal His mapping: His87 (α) / His92 (β) NE2 in both endpoints; Fe–NE2 measured, matching LINK records',()=>{
  for(const m of [t,r])for(const s of m.subunits){expect(s.heme.proximal).toMatchObject({resName:'HIS',atomName:'NE2',chain:s.chain,resSeq:s.type==='alpha'?87:92});}
  const rLinks=parsePdbHeader(rRaw).links.filter(l=>l.a.resName==='HIS');
  expect(rLinks.map(l=>[l.a.chain,l.a.resSeq,l.distance])).toEqual([['A',87,2.07],['B',92,2.06]]);
  expect(model.hemes.r.slice(0,2).map(h=>Number(h.feHis.toFixed(2)))).toEqual([2.07,2.06]);
  for(const h of [...model.hemes.t,...model.hemes.r]){expect(h.feHis).toBeGreaterThan(1.9);expect(h.feHis).toBeLessThan(2.35);}
  // Fe–porphyrin mean plane: displaced toward His in every T heme, much closer to the plane in every R heme (computed values).
  for(const h of model.hemes.t)expect(h.feFromPorphyrin).toBeGreaterThan(0.3);
  for(const h of model.hemes.r)expect(Math.abs(h.feFromPorphyrin)).toBeLessThan(0.15);
  // Plane distance helper: a point 1 Å above a flat square, sign follows the reference side.
  const sq:Vec[]=[[0,0,0],[1,0,0],[0,1,0],[1,1,0]];expect(planeDistance(sq,[0.5,0.5,1],[0,0,5])).toBeCloseTo(1,12);expect(planeDistance(sq,[0.5,0.5,1],[0,0,-5])).toBeCloseTo(-1,12);
 });
 it('25 · ligand belongs only to the R endpoint: R scene layer has 4 O₂, T and morph layers none, and no O₂ atom enters the morph',()=>{
  const scene=transitionSceneModel(model);
  expect(scene.r.ligands.map(l=>[l.label,l.resName])).toEqual([['α1','OXY'],['β1','OXY'],['α2','OXY'],['β2','OXY']]);
  expect(scene.t.ligands).toEqual([]);expect(scene.morph.ligands).toEqual([]);
  expect(scene.morph.atoms.some(a=>a.resName==='OXY')).toBe(false);
  expect(model.hemes.t.every(h=>h.ligand===null)).toBe(true);expect(model.hemes.r.every(h=>h.ligand?.resName==='OXY')).toBe(true);
  for(const l of scene.r.ligands){const h=scene.r.hemes.find(x=>x.label===l.label)!;expect(Math.min(...l.atoms.map(a=>distance(scene.r.positions[a],scene.r.positions[h.iron])))).toBeLessThan(2);}
 });
});

describe('Interface comparison (same 4.0 Å criterion)',()=>{
 it('inter-dimer residue-pair contacts use one cutoff for both endpoints; lost + common = T, gained + common = R; every pair verified',()=>{
  const c=model.contacts;expect(c.cutoff).toBe(INTERFACE_CUTOFF);
  expect(c.lost.length+c.common.length).toBe(c.t.length);expect(c.gained.length+c.common.length).toBe(c.r.length);
  expect(c.t.length).toBeGreaterThan(0);expect(c.r.length).toBeGreaterThan(0);
  const atomsOf=(m:typeof t,positions:Vec[],name:string,allowed:Set<number>)=>{const [l,p,res]=name.split(':');const s=m.subunits.find(x=>x.label===l)!;const rr=m.structure.residues.find(x=>x.chain===s.chain&&x.resSeq===Number(p)&&x.resName===res)!;return rr.atoms.filter(i=>allowed.has(i)).map(i=>positions[i]);};
  const tAllowed=new Set(model.common.map(x=>x.t)),rAllowed=new Set(model.common.map(x=>x.r));
  const min=(a:Vec[],b:Vec[])=>Math.min(...a.flatMap(p=>b.map(q=>distance(p,q))));
  for(const k of c.t){const [a,b]=k.split('|');expect(min(atomsOf(t,ta.map(x=>x.position),a,tAllowed),atomsOf(t,ta.map(x=>x.position),b,tAllowed))).toBeLessThanOrEqual(INTERFACE_CUTOFF);expect(REFERENCE_DIMER).toContain(a.split(':')[0]);expect(MOVING_DIMER).toContain(b.split(':')[0]);}
  for(const k of c.lost){const [a,b]=k.split('|');expect(min(atomsOf(r,model.rAligned,a,rAllowed),atomsOf(r,model.rAligned,b,rAllowed))).toBeGreaterThan(INTERFACE_CUTOFF);}
  expect(c.byPair['α1–β2'].t).toBeGreaterThan(c.byPair['α1–β2'].common);
 });
 it('assembly builder: identity operator reproduces the input; a copy is a rigid image with a distinct chain namespace',()=>{
  const dep=parseMultiChainPdb(tRaw),same=buildAssembly(dep,dep.chains,[{rotation:[[1,0,0],[0,1,0],[0,0,1]],translation:[0,0,0]}]);
  expect(same.structure.atoms.map(a=>a.position)).toEqual(dep.atoms.filter(a=>!a.hetero).map(a=>a.position).concat(same.structure.hetero.flatMap(g=>g.atoms).map(i=>same.structure.atoms[i].position)));
  expect(same.structure.residues.map(residueKey)).toEqual(dep.residues.map(residueKey));
  const two=buildAssembly(dep,['A'],[{rotation:[[1,0,0],[0,1,0],[0,0,1]],translation:[0,0,0]},{rotation:[[0,1,0],[1,0,0],[0,0,-1]],translation:[0,0,0]}]);
  expect(two.structure.chains).toEqual(['A','A_2']);expect(two.copies).toEqual([{chain:'A',source:'A',operator:1},{chain:'A_2',source:'A',operator:2}]);
  const bonds=inferBonds(two.structure);expect(bonds.every(([a,b])=>two.structure.atoms[a].chain===two.structure.atoms[b].chain)).toBe(true);
 });
});
