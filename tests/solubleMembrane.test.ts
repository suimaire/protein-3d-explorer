import {describe,it,expect} from 'vitest';
import raw from '../src/data/structures/1QJ8.pdb?raw';
import ubqRaw from '../src/data/structures/1UBQ.pdb?raw';
import opmText from './fixtures/1qj8-opm-backbone.json?raw';
import {parsePdb} from '../src/protein/pdb';
import {analyzeExposure,composition,groupIndices} from '../src/protein/exposure';
import {classOf,CLASS_INFO} from '../src/protein/chemistry';
import {atomColor} from '../src/protein/colors';
import {applyRigid,determinant,fitRigid,type RigidTransform} from '../src/protein/rigid';
import {classifyMembrane,countClasses,findMembraneExamples,formatDepth,highlightIndices,isSurface,sideChainCentroid,transformStructure,zoneOf,SURFACE_THRESHOLD,type MembraneSlab} from '../src/protein/membrane';
import {ompx,ompxDeposited,ompxBonds,ompxAnalysis,OMPX_OPM,OMPX_SLAB,OMPX_SOURCE,OMPX_TO_OPM} from '../src/protein/ompx';
import {ubiquitin,ubiquitinExposure} from '../src/protein/ubiquitin';
import {distance,type Vec} from '../src/geometry/vector';

const opm=JSON.parse(opmText) as {dummyPlaneZ:number[];remark:string;opmRecord:{thickness:number;thicknesserror:number;tilt:number};backbone:[number,string,number,number,number][]};
const {exposure,membrane}=ompxAnalysis(),residues=exposure.residues;
const byNumber=(n:number)=>residues.find(r=>r.resSeq===n)!;
const memOf=(n:number)=>membrane[byNumber(n).index];
const sha256=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');

describe('membrane structure (PDB 1QJ8, OmpX)',()=>{
 it('bundled file is the unmodified RCSB download with expected metadata',async()=>{
  expect(await sha256(raw)).toBe('7158c5ef945d5e4eea27c517c58742da859c76f530de46738b65b893c1912831');
  expect(raw).toContain('EXPDTA    X-RAY DIFFRACTION');expect(raw).toContain('REMARK   2 RESOLUTION.    1.90 ANGSTROMS.');
  expect(raw).toContain('MOLECULE: OUTER MEMBRANE PROTEIN X');expect(raw).toContain('ORGANISM_SCIENTIFIC: ESCHERICHIA COLI');
  expect(raw).toContain('REMARK 350 SOFTWARE DETERMINED QUATERNARY STRUCTURE: MONOMERIC');
  expect(raw).toMatch(/SEQADV 1QJ8 ASN A {2}100 {2}UNP {2}P36546 {4}HIS {3}123 ENGINEERED MUTATION/);
  expect(OMPX_SOURCE).toMatchObject({pdbId:'1QJ8',resolution:1.9,chain:'A',organism:'Escherichia coli'});
 });
 it('parses chain A: 148 consecutive residues matching SEQRES, 1158 heavy atoms',()=>{
  const seqres=raw.split(/\r?\n/).filter(l=>l.startsWith('SEQRES')).flatMap(l=>l.slice(19).trim().split(/\s+/));
  expect(ompx.id).toBe('1QJ8');expect(ompx.residues.map(r=>r.resName)).toEqual(seqres);
  expect(ompx.residues.map(r=>r.resSeq)).toEqual(Array.from({length:148},(_,i)=>i+1));
  expect(ompx.atoms).toHaveLength(1158);
  expect(ompx.omitted).toEqual({waters:72,hetero:25,hydrogens:0,otherChains:0,alternateLocations:45});
  expect(new Set(ompx.atoms.map(a=>a.element))).toEqual(new Set(['C','N','O','S']));
 });
 it('every residue has its complete heavy-atom set (no missing atoms)',()=>{
  const heavy:Record<string,number>={GLY:4,ALA:5,SER:6,CYS:6,VAL:7,THR:7,PRO:7,ILE:8,LEU:8,ASP:8,ASN:8,GLU:9,GLN:9,LYS:9,MET:8,HIS:10,PHE:11,ARG:11,TYR:12,TRP:14};
  for(const r of ompx.residues)expect(r.atoms.length-(r.resSeq===148?1:0)).toBe(heavy[r.resName]);
 });
 it('alternate conformers: highest occupancy kept for the 12 residues with altlocs',()=>{
  expect(ompx.residues.filter(r=>r.occupancy<1).map(r=>[r.resSeq,r.occupancy])).toEqual([[3,0.5],[28,0.65],[39,0.6],[65,0.8],[79,0.6],[83,0.5],[85,0.6],[90,0.5],[92,0.6],[121,0.6],[130,0.6],[144,0.75]]);
  const tyr28=ompxDeposited.atoms.find(a=>a.resSeq===28&&a.name==='OH')!;expect(tyr28.altLoc).toBe('B');expect(tyr28.occupancy).toBe(0.65);
 });
 it('deposited coordinates are kept exactly; bonds are chemically sane and connect one chain',()=>{
  const first=raw.split(/\r?\n/).find(l=>l.startsWith('ATOM'))!;
  expect(ompxDeposited.atoms[0].position).toEqual([Number(first.slice(30,38)),Number(first.slice(38,46)),Number(first.slice(46,54))]);
  for(const a of ompx.atoms)for(const v of a.position)expect(Number.isFinite(v)).toBe(true);
  const lengths=ompxBonds.map(([a,b])=>distance(ompx.atoms[a].position,ompx.atoms[b].position));
  expect(Math.min(...lengths)).toBeGreaterThan(1.1);expect(Math.max(...lengths)).toBeLessThan(1.95);
  expect(ompxBonds.filter(([a,b])=>ompx.atoms[a].resSeq!==ompx.atoms[b].resSeq)).toHaveLength(147);
  const parent=ompx.atoms.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
  for(const [a,b] of ompxBonds)parent[find(a)]=find(b);
  expect(new Set(ompx.atoms.map((_,i)=>find(i))).size).toBe(1);
 });
 it('metadata: OPM record values and deposited β-strand records',()=>{
  expect(OMPX_OPM).toMatchObject({thickness:23.6,thicknessError:2.8,tilt:12});
  expect(opm.opmRecord).toMatchObject({thickness:OMPX_OPM.thickness,thicknesserror:OMPX_OPM.thicknessError,tilt:OMPX_OPM.tilt});
  expect(ompx.residues.filter(r=>r.secondary==='strand').length).toBeGreaterThan(90);
  expect(ompx.residues.some(r=>r.secondary==='helix')).toBe(false);
 });
});

describe('membrane orientation (OPM)',()=>{
 const identity:RigidTransform={rotation:[[1,0,0],[0,1,0],[0,0,1]],translation:[0,0,0]};
 it('transform is a proper rotation and deterministic',()=>{
  const R=OMPX_TO_OPM.rotation;
  expect(determinant(R)).toBeCloseTo(1,12);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)expect(R[i][0]*R[j][0]+R[i][1]*R[j][1]+R[i][2]*R[j][2]).toBeCloseTo(i===j?1:0,12);
  expect(transformStructure(ompxDeposited,OMPX_TO_OPM)).toEqual(ompx);
  expect(transformStructure(ompxDeposited,identity).atoms.map(a=>a.position)).toEqual(ompxDeposited.atoms.map(a=>a.position));
 });
 it('reproduces the OPM oriented backbone coordinates (592 atoms)',()=>{
  const atomOf=new Map(ompx.atoms.map(a=>[`${a.resSeq}:${a.name}`,a.position]));
  let worst=0;
  for(const [res,name,x,y,z] of opm.backbone){const p=atomOf.get(`${res}:${name}`)!;worst=Math.max(worst,Math.hypot(p[0]-x,p[1]-y,p[2]-z));}
  expect(opm.backbone).toHaveLength(592);expect(worst).toBeLessThan(0.01);
 });
 it('an independent refit from the OPM fixture recovers the stored transform',()=>{
  const atomOf=new Map(ompxDeposited.atoms.map(a=>[`${a.resSeq}:${a.name}`,a.position]));
  const fit=fitRigid(opm.backbone.map(([r,n])=>atomOf.get(`${r}:${n}`)!),opm.backbone.map(([,,x,y,z])=>[x,y,z] as Vec));
  expect(fit.rmsd).toBeLessThan(0.005);
  for(let i=0;i<3;i++){for(let j=0;j<3;j++)expect(fit.rotation[i][j]).toBeCloseTo(OMPX_TO_OPM.rotation[i][j],3);expect(fit.translation[i]).toBeCloseTo(OMPX_TO_OPM.translation[i],1);}
 });
 it('fitRigid recovers a known synthetic rotation exactly',()=>{
  const c=Math.cos(0.7),s=Math.sin(0.7),T:RigidTransform={rotation:[[c,-s,0],[s,c,0],[0,0,1]],translation:[3,-4,5]};
  const pts:Vec[]=[[0,0,0],[1,0,0],[0,2,0],[0,0,3],[1,1,1],[-2,1,0.5]];
  const fit=fitRigid(pts,pts.map(p=>applyRigid(T,p)));
  expect(fit.rmsd).toBeLessThan(1e-9);fit.rotation.flat().forEach((v,i)=>expect(v).toBeCloseTo(T.rotation.flat()[i],9));
 });
 it('membrane normal is +z, centre 0, boundaries ±11.8 Å equal to OPM dummy planes',()=>{
  expect(OMPX_SLAB.normal).toEqual([0,0,1]);expect(OMPX_SLAB.center).toBe(0);
  expect(OMPX_SLAB.halfThickness).toBeCloseTo(11.8,10);
  expect(opm.dummyPlaneZ).toEqual([-OMPX_SLAB.halfThickness,OMPX_SLAB.halfThickness]);
  expect(opm.remark).toContain('11.8');
  // Normal in the deposited frame is the third row of R (unit length).
  expect(Math.hypot(...OMPX_TO_OPM.rotation[2])).toBeCloseTo(1,12);
 });
 it('rigid transform preserves every internal distance and SASA',()=>{
  const n=ompx.atoms.length;
  for(let k=0;k<400;k++){const i=(k*37)%n,j=(k*101+7)%n;expect(distance(ompx.atoms[i].position,ompx.atoms[j].position)).toBeCloseTo(distance(ompxDeposited.atoms[i].position,ompxDeposited.atoms[j].position),9);}
  // Shrake–Rupley test points are fixed in the coordinate frame, so rotation changes SASA only by sampling noise.
  const deposited=analyzeExposure(ompxDeposited).residues;
  expect(Math.abs(deposited.reduce((s,r)=>s+r.sasa,0)-exposure.total)/exposure.total).toBeLessThan(0.001);
  deposited.forEach((r,i)=>{
   expect(Math.abs(residues[i].sasa-r.sasa)).toBeLessThan(2.5);
   if((r.relative>=SURFACE_THRESHOLD)!==(residues[i].relative>=SURFACE_THRESHOLD))expect(Math.abs(r.relative-SURFACE_THRESHOLD)).toBeLessThan(0.01);
  });
 });
 it('transmembrane strands cross the slab; long loops and termini lie on opposite sides',()=>{
  const ca=(n:number)=>memOf(n).caDepth;
  expect(ca(1)).toBeLessThan(-OMPX_SLAB.halfThickness);expect(ca(148)).toBeLessThan(-OMPX_SLAB.halfThickness);
  for(const n of [53,96])expect(ca(n)).toBeGreaterThan(OMPX_SLAB.halfThickness+15);
  expect(Math.abs(ca(81))).toBeLessThan(1);
 });
});

describe('residue membrane classification',()=>{
 const slab:MembraneSlab={normal:[0,0,1],center:0,halfThickness:10};
 it('zone membership at and around the boundaries',()=>{
  expect(zoneOf(0,slab)).toBe('membrane');expect(zoneOf(10,slab)).toBe('membrane');expect(zoneOf(-10,slab)).toBe('membrane');
  expect(zoneOf(10.01,slab)).toBe('sideA');expect(zoneOf(-10.01,slab)).toBe('sideB');
 });
 it('depth is the side-chain heavy-atom centroid z (Gly: Cα), matching the oriented coordinates',()=>{
  for(const n of [5,26,76,125]){const r=ompx.residues[n-1],side=r.atoms.map(i=>ompx.atoms[i]).filter(a=>!['N','CA','C','O','OXT'].includes(a.name));expect(memOf(n).depth).toBeCloseTo(side.reduce((s,a)=>s+a.position[2],0)/side.length,10);}
  const gly=ompx.residues[80];expect(gly.resName).toBe('GLY');expect(memOf(81).depth).toBe(ompx.atoms[gly.atoms.find(i=>ompx.atoms[i].name==='CA')!].position[2]);
  expect(sideChainCentroid(ompx,147)).toEqual(sideChainCentroid(ompx,147));
 });
 it('surface/buried uses rSASA ≥ 25 % for both proteins',()=>{
  expect(SURFACE_THRESHOLD).toBe(0.25);
  expect(isSurface({relative:0.25})).toBe(true);expect(isSurface({relative:0.2499})).toBe(false);
  for(const m of membrane)expect(m.surface).toBe(residues[m.index].relative>=0.25);
 });
 it('lipid-facing = inside slab AND surface; aqueous-facing = outside slab AND surface',()=>{
  for(const m of membrane){
   const inside=Math.abs(m.depth)<=OMPX_SLAB.halfThickness;
   expect(m.category).toBe(!m.surface?'buried':inside?'lipid-facing':'aqueous-facing');
  }
  // Synthetic: same exposure, different depth → different category; buried inside slab is not lipid-facing.
  const fakeExposure=[{...residues[0],index:0,relative:0.6},{...residues[1],index:1,relative:0.05}];
  const s=parsePdb(['ATOM      1  CA  GLY A   1       0.000   0.000   2.000  1.00 10.00           C','ATOM      2  CA  GLY A   2       0.000   0.000   3.000  1.00 10.00           C'].join('\n'));
  expect(classifyMembrane(s,fakeExposure,slab).map(m=>m.category)).toEqual(['lipid-facing','buried']);
  expect(classifyMembrane(s,[{...fakeExposure[0]},{...fakeExposure[1],relative:0.9}],{...slab,halfThickness:1}).map(m=>m.category)).toEqual(['aqueous-facing','aqueous-facing']);
 });
 it('transmembrane is not the same as lipid-facing: buried residues exist inside the slab',()=>{
  const inside=membrane.filter(m=>m.zone==='membrane');
  expect(inside.filter(m=>m.category==='buried').length).toBeGreaterThan(30);
  expect(memOf(27)).toMatchObject({zone:'membrane',category:'buried'});expect(byNumber(27).chemical).toBe('basic');
  expect(memOf(124)).toMatchObject({zone:'membrane',category:'buried'});expect(byNumber(124).chemical).toBe('acidic');
 });
 it('reuses the shared chemistry classification and SASA code',()=>{
  for(const r of residues)expect(r.chemical).toBe(classOf(r.resName));
  expect(analyzeExposure(ompx)).toEqual(exposure);
  expect(byNumber(100)).toMatchObject({resName:'ASN',chemical:'polar'});
 });
 it('observed compositions of this structure (not tuned)',()=>{
  const lipid=highlightIndices(residues,membrane,'lipid'),aqueous=highlightIndices(residues,membrane,'aqueous');
  expect(countClasses(residues,lipid)).toEqual({nonpolar:25,polar:7,acidic:0,basic:0,total:32,glycine:1});
  expect(countClasses(residues,aqueous)).toEqual({nonpolar:11,polar:22,acidic:10,basic:7,total:50,glycine:2});
  expect(countClasses(residues,highlightIndices(residues,membrane,'buried'))).toEqual({nonpolar:29,polar:28,acidic:4,basic:5,total:66,glycine:17});
  expect(residues.filter(r=>lipid.has(r.index)&&r.chemical==='polar').map(r=>r.resName)).toEqual(Array(7).fill('TYR'));
  const ubq=ubiquitinExposure().residues;
  expect(countClasses(ubq,highlightIndices(ubq,null,'surface'))).toEqual({nonpolar:15,polar:13,acidic:10,basic:11,total:49,glycine:6});
  expect(countClasses(ubq,highlightIndices(ubq,null,'buried'))).toEqual({nonpolar:19,polar:6,acidic:1,basic:1,total:27,glycine:0});
 });
 it('data-derived representative residues',()=>{
  const e=findMembraneExamples(ompx,residues,membrane),n=(m:{index:number}|null)=>m&&`${residues[m.index].resName}${residues[m.index].resSeq}`;
  expect(n(e.lipidNonpolar)).toBe('PHE125');expect(n(e.aqueousCharged)).toBe('ASP75');expect(n(e.lipidPolar)).toBe('TYR146');expect(n(e.buriedCharged)).toBe('LYS27');
  expect(memOf(125)).toMatchObject({zone:'membrane',category:'lipid-facing'});expect(memOf(75)).toMatchObject({zone:'sideB',category:'aqueous-facing'});
 });
});

describe('comparison with ubiquitin',()=>{
 it('ubiquitin data are unchanged (Phase 3A)',async()=>{
  expect(await sha256(ubqRaw)).toBe('d4a6812d8951cf6594e6a0763f089e35f5a80b62acb3c117b2c5565228a7b161');
  const u=ubiquitinExposure().residues;
  expect(ubiquitin.atoms).toHaveLength(602);
  expect(composition(u,groupIndices(u,'buried'))).toEqual({nonpolar:15,polar:3,acidic:0,basic:1,total:19,glycine:0});
  expect(composition(u,groupIndices(u,'exposed'))).toEqual({nonpolar:7,polar:4,acidic:5,basic:3,total:19,glycine:4});
 });
 it('same chemistry color mapping for both proteins',()=>{
  const u=ubiquitinExposure().residues,pairs=[[u.find(r=>r.resName==='LEU')!,byNumber(26)],[u.find(r=>r.resName==='GLU')!,byNumber(119)],[u.find(r=>r.resName==='LYS')!,byNumber(27)],[u.find(r=>r.resName==='TYR')!,byNumber(146)]] as const;
  for(const [a,b] of pairs){
   expect(a.resName).toBe(b.resName);
   expect(atomColor('chemistry',a,{name:'CB',element:'C'})).toBe(atomColor('chemistry',b,{name:'CB',element:'C'}));
   expect(atomColor('chemistry',b,{name:'CB',element:'C'})).toBe(CLASS_INFO[b.chemical].color);
   expect(atomColor('chemistry',a,null)).toBe(atomColor('chemistry',b,null));
  }
 });
});

describe('UI data',()=>{
 it('selected residue depth text matches the classification data',()=>{
  expect(formatDepth(memOf(125).depth)).toBe('+0.8 Å');expect(formatDepth(memOf(75).depth)).toBe('−17.2 Å');expect(formatDepth(-0.04)).toBe('−0.0 Å');
 });
 it('one highlight mode drives both proteins consistently',()=>{
  const u=ubiquitinExposure().residues;
  expect(highlightIndices(u,null,'all').size).toBe(76);expect(highlightIndices(residues,membrane,'all').size).toBe(148);
  expect(highlightIndices(u,null,'lipid').size).toBe(0);
  expect(highlightIndices(u,null,'aqueous')).toEqual(highlightIndices(u,null,'surface'));
  const surface=highlightIndices(residues,membrane,'surface'),lipid=highlightIndices(residues,membrane,'lipid'),aqueous=highlightIndices(residues,membrane,'aqueous'),buried=highlightIndices(residues,membrane,'buried');
  expect(lipid.size+aqueous.size).toBe(surface.size);expect(surface.size+buried.size).toBe(148);
  expect([...lipid].some(i=>aqueous.has(i))).toBe(false);
 });
 it('the slab used for display is the slab used for classification',()=>{
  // ProteinScene draws boundaries at centre ± halfThickness of the same OMPX_SLAB passed to classifyMembrane.
  expect(classifyMembrane(ompx,residues,OMPX_SLAB)).toEqual(membrane);
  expect(classifyMembrane(ompx,residues,{...OMPX_SLAB,halfThickness:OMPX_SLAB.halfThickness+2})).not.toEqual(membrane);
 });
});
