import {describe,it,expect} from 'vitest';
import raw from '../src/data/structures/1UBQ.pdb?raw';
import referenceText from './fixtures/1ubq-biopython-sasa.json?raw';
import {parsePdb,isSideChainAtom} from '../src/protein/pdb';
import {shrakeRupley,spherePoints,SASA_RADII,PROBE_RADIUS} from '../src/protein/sasa';
import {analyzeExposure,composition,findExceptions,groupIndices,polarContacts,formatExposure} from '../src/protein/exposure';
import {CHEMICAL_CLASS,CLASS_INFO,MAX_ASA_TIEN_2013,classOf} from '../src/protein/chemistry';
import {atomColor,exposureColor,ELEMENT_COLORS,BACKBONE_NEUTRAL,EXPOSURE_STOPS} from '../src/protein/colors';
import {ubiquitin,ubiquitinBonds,ubiquitinExposure} from '../src/protein/ubiquitin';
import {distance,type Vec} from '../src/geometry/vector';

const reference=JSON.parse(referenceText) as {residues:{resSeq:number;resName:string;sasa:number}[]};
const exposure=ubiquitinExposure(),residues=exposure.residues;
const byNumber=(n:number)=>residues.find(r=>r.resSeq===n)!;
const sphereArea=(element:string,probe=PROBE_RADIUS)=>4*Math.PI*(SASA_RADII[element]+probe)**2;

describe('structure loading (PDB 1UBQ)',()=>{
 it('bundled file is the unmodified RCSB download',async()=>{
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)));
  expect([...digest].map(b=>b.toString(16).padStart(2,'0')).join('')).toBe('d4a6812d8951cf6594e6a0763f089e35f5a80b62acb3c117b2c5565228a7b161');
  expect(raw.startsWith('HEADER')).toBe(true);expect(raw).toContain('EXPDTA    X-RAY DIFFRACTION');expect(raw).toContain('REFINED AT 1.8 ANGSTROMS RESOLUTION');
 });
 it('uses chain A with 76 consecutive residues matching SEQRES',()=>{
  const seqres=raw.split(/\r?\n/).filter(l=>l.startsWith('SEQRES')).flatMap(l=>l.slice(19).trim().split(/\s+/));
  expect(ubiquitin.id).toBe('1UBQ');expect(ubiquitin.chain).toBe('A');
  expect(ubiquitin.residues.map(r=>r.resName)).toEqual(seqres);
  expect(ubiquitin.residues.map(r=>r.resSeq)).toEqual(Array.from({length:76},(_,i)=>i+1));
 });
 it('atom count, omitted records and element sanity',()=>{
  expect(ubiquitin.atoms).toHaveLength(602);
  expect(ubiquitin.omitted).toEqual({waters:58,hetero:0,hydrogens:0,otherChains:0,alternateLocations:0});
  expect(new Set(ubiquitin.atoms.map(a=>a.element))).toEqual(new Set(['C','N','O','S']));
  expect(ubiquitin.atoms.filter(a=>a.element==='S').map(a=>`${a.resName}${a.resSeq}:${a.name}`)).toEqual(['MET1:SD']);
 });
 it('every residue has its complete heavy-atom set',()=>{
  const heavy:Record<string,number>={GLY:4,ALA:5,SER:6,CYS:6,VAL:7,THR:7,PRO:7,ILE:8,LEU:8,ASP:8,ASN:8,GLU:9,GLN:9,LYS:9,MET:8,HIS:10,PHE:11,ARG:11,TYR:12,TRP:14};
  for(const r of ubiquitin.residues)expect(r.atoms.length-(r.resSeq===76?1:0)).toBe(heavy[r.resName]);
  expect(ubiquitin.atoms.filter(a=>a.name==='OXT').map(a=>a.resSeq)).toEqual([76]);
 });
 it('coordinates are finite and identical to the deposited columns',()=>{
  for(const a of ubiquitin.atoms)for(const v of a.position)expect(Number.isFinite(v)).toBe(true);
  expect(ubiquitin.atoms[0]).toMatchObject({serial:1,name:'N',resName:'MET',resSeq:1,occupancy:1,position:[27.34,24.43,2.614]});
  expect(ubiquitin.atoms.at(-1)).toMatchObject({serial:602,name:'OXT',resName:'GLY',resSeq:76,occupancy:0.25,position:[40.862,39.575,36.251]});
  const lines=raw.split(/\r?\n/).filter(l=>l.startsWith('ATOM'));
  lines.forEach((l,i)=>expect(ubiquitin.atoms[i].position).toEqual([Number(l.slice(30,38)),Number(l.slice(38,46)),Number(l.slice(46,54))]));
 });
 it('records deposited partial occupancy only in the C-terminal tail',()=>{
  expect(ubiquitin.residues.filter(r=>r.occupancy<1).map(r=>[r.resSeq,r.occupancy])).toEqual([[73,0.45],[74,0.45],[75,0.25],[76,0.25]]);
 });
 it('secondary structure comes from the deposited HELIX/SHEET records',()=>{
  const of=(n:number)=>ubiquitin.residues[n-1].secondary;
  for(let n=23;n<=34;n++)expect(of(n)).toBe('helix');
  for(let n=56;n<=59;n++)expect(of(n)).toBe('helix310');
  for(const n of [1,7,10,17,40,45,48,50,64,72])expect(of(n)).toBe('strand');
  for(const n of [8,19,35,36,53,73,76])expect(of(n)).toBe('other');
 });
 it('alternate locations keep the highest-occupancy conformer and waters/ligands are skipped',()=>{
  const line=(serial:number,name:string,alt:string,res:number,occ:number,x:number,record='ATOM  ',resName='SER')=>`${record}${String(serial).padStart(5)} ${name.padEnd(4)}${alt}${resName} A${String(res).padStart(4)}    ${x.toFixed(3).padStart(8)}${(0).toFixed(3).padStart(8)}${(0).toFixed(3).padStart(8)}${occ.toFixed(2).padStart(6)}${(10).toFixed(2).padStart(6)}          ${name[0].padStart(2)}`;
  const text=['HEADER    TEST                                    01-JAN-00   TEST',line(1,'OG','A',1,0.4,1),line(2,'OG','B',1,0.6,2),line(3,'CA',' ',1,1,3),line(4,'O',' ',2,1,4,'HETATM','HOH'),line(5,'H',' ',1,1,5).replace(/ H$/,' H')].join('\n');
  const s=parsePdb(text);
  expect(s.atoms.map(a=>[a.name,a.position[0]])).toEqual([['OG',2],['CA',3]]);
  expect(s.omitted).toMatchObject({waters:1,alternateLocations:1,hydrogens:1});
 });
 it('inferred covalent bonds are chemically sane and connect one chain',()=>{
  const lengths=ubiquitinBonds.map(([a,b])=>distance(ubiquitin.atoms[a].position,ubiquitin.atoms[b].position));
  expect(Math.min(...lengths)).toBeGreaterThan(1.1);expect(Math.max(...lengths)).toBeLessThan(1.95);
  const peptide=ubiquitinBonds.filter(([a,b])=>ubiquitin.atoms[a].resSeq!==ubiquitin.atoms[b].resSeq);
  expect(peptide).toHaveLength(75);
  const parent=ubiquitin.atoms.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
  for(const [a,b] of ubiquitinBonds)parent[find(a)]=find(b);
  expect(new Set(ubiquitin.atoms.map((_,i)=>find(i))).size).toBe(1);
  // Phe/His/Pro rings are closed (ring bond count = ring size).
  const ringBonds=(n:number,names:string[])=>ubiquitinBonds.filter(([a,b])=>[a,b].every(i=>ubiquitin.atoms[i].resSeq===n&&names.includes(ubiquitin.atoms[i].name))).length;
  expect(ringBonds(4,['CG','CD1','CD2','CE1','CE2','CZ'])).toBe(6);expect(ringBonds(68,['CG','ND1','CD2','CE1','NE2'])).toBe(5);expect(ringBonds(19,['N','CA','CB','CG','CD'])).toBe(5);
 });
});

describe('Shrake–Rupley SASA (synthetic geometry)',()=>{
 it('sphere points are unit length and balanced',()=>{
  const pts=spherePoints(960);expect(pts).toHaveLength(960);
  for(const p of pts)expect(Math.hypot(...p)).toBeCloseTo(1,12);
  for(const axis of [0,1,2])expect(Math.abs(pts.reduce((s,p)=>s+p[axis],0)/960)).toBeLessThan(0.01);
 });
 it('isolated atom exposes its full probe-expanded sphere',()=>{
  for(const element of ['C','N','O','S'])expect(shrakeRupley([{element,position:[1,2,3]}])[0]).toBeCloseTo(sphereArea(element),10);
  expect(shrakeRupley([{element:'C',position:[0,0,0]}],{probe:0})[0]).toBeCloseTo(4*Math.PI*1.7**2,10);
 });
 it('approaching atoms bury monotonically more surface and match the analytic spherical cap',()=>{
  let previous=Infinity;
  for(const d of [7,6.4,6,5,4,3,2,1.5]){
   const [a,b]=shrakeRupley([{element:'C',position:[0,0,0]},{element:'C',position:[d,0,0]}]);
   // Numerical point sampling: tolerance is 1% of the full expanded-sphere area.
   const R=1.7+PROBE_RADIUS,full=4*Math.PI*R*R,exact=d>=2*R?full:full-2*Math.PI*R*(R-d/2);
   expect(Math.abs(a-b)).toBeLessThan(0.01*full);expect(a).toBeLessThanOrEqual(previous+1e-9);previous=a;
   expect(Math.abs(a-exact)).toBeLessThan(0.01*full);
  }
  const far=shrakeRupley([{element:'C',position:[0,0,0]},{element:'C',position:[6.21,0,0]}]);
  expect(far[0]).toBeCloseTo(sphereArea('C'),10);
 });
 it('an enclosed atom has zero accessible area',()=>{
  const around:Vec[]=[[1.5,0,0],[-1.5,0,0],[0,1.5,0],[0,-1.5,0],[0,0,1.5],[0,0,-1.5],[1,1,1],[-1,-1,-1],[1,-1,1],[-1,1,-1],[1,1,-1],[-1,-1,1],[1,-1,-1],[-1,1,1]];
  expect(shrakeRupley([{element:'C',position:[0,0,0]},...around.map(position=>({element:'C',position}))])[0]).toBe(0);
 });
 it('is deterministic and independent of atom order',()=>{
  const atoms=ubiquitin.atoms.slice(0,120),a=shrakeRupley(atoms),b=shrakeRupley(atoms),reversed=shrakeRupley([...atoms].reverse()).reverse();
  expect(a).toEqual(b);reversed.forEach((v,i)=>expect(v).toBeCloseTo(a[i],10));
 });
 it('rejects elements without a documented radius',()=>expect(()=>shrakeRupley([{element:'FE',position:[0,0,0]}])).toThrow());
});

describe('residue exposure (1UBQ)',()=>{
 it('deterministic analysis without NaN or negative values',()=>{
  expect(analyzeExposure(ubiquitin)).toEqual(exposure);
  for(const v of exposure.atomSasa){expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);}
  for(const i of exposure.atomSasa.keys())expect(exposure.atomSasa[i]).toBeLessThanOrEqual(sphereArea(ubiquitin.atoms[i].element)+1e-9);
 });
 it('residue total equals the sum of its atom SASA; side chain + backbone partition',()=>{
  for(const r of ubiquitin.residues){
   const e=residues[r.index],atoms=r.atoms.map(i=>exposure.atomSasa[i]);
   expect(e.sasa).toBeCloseTo(atoms.reduce((s,v)=>s+v,0),10);
   const backbone=r.atoms.filter(i=>!isSideChainAtom(ubiquitin.atoms[i])).reduce((s,i)=>s+exposure.atomSasa[i],0);
   expect(e.sideChainSasa+backbone).toBeCloseTo(e.sasa,10);
  }
  expect(residues.filter(r=>r.resName==='GLY').every(r=>r.sideChainSasa===0)).toBe(true);
  expect(exposure.total).toBeCloseTo(residues.reduce((s,r)=>s+r.sasa,0),8);
 });
 it('agrees with an independent Shrake–Rupley implementation (Biopython, same parameters)',()=>{
  expect(reference.residues).toHaveLength(76);
  let worst=0;
  for(const ref of reference.residues){const r=byNumber(ref.resSeq);expect(r.resName).toBe(ref.resName);worst=Math.max(worst,Math.abs(r.sasa-ref.sasa));}
  expect(worst).toBeLessThan(0.05);
  expect(Math.abs(exposure.total-reference.residues.reduce((s,r)=>s+r.sasa,0))).toBeLessThan(0.5);
 });
 it('normalization uses Tien 2013 maxima and stays valid',()=>{
  expect(Object.keys(MAX_ASA_TIEN_2013).sort()).toEqual(Object.keys(CHEMICAL_CLASS).sort());
  for(const r of residues){expect(r.relative).toBeCloseTo(r.sasa/MAX_ASA_TIEN_2013[r.resName],12);expect(r.relative).toBeGreaterThanOrEqual(0);expect(Number.isFinite(r.relative)).toBe(true);}
  // Only the C-terminal Gly (extra OXT, terminal context) exceeds the internal Gly-X-Gly reference.
  expect(residues.filter(r=>r.relative>=1).map(r=>r.resSeq)).toEqual([76]);
  expect(formatExposure(1.4)).toBe('≥100%');expect(formatExposure(0.084)).toBe('8%');
 });
 it('rank is a permutation ordered by relative exposure',()=>{
  expect(residues.map(r=>r.rank).sort((a,b)=>a-b)).toEqual(Array.from({length:76},(_,i)=>i+1));
  const ordered=[...residues].sort((a,b)=>a.rank-b.rank);
  for(let i=1;i<ordered.length;i++)expect(ordered[i].relative).toBeGreaterThanOrEqual(ordered[i-1].relative);
  expect(ordered[0].percentile).toBe(0);expect(ordered.at(-1)!.percentile).toBe(1);
 });
 it('manual sanity: core aliphatics buried, charged/tail residues exposed',()=>{
  for(const n of [3,5,23,26,30,43,56,67])expect(byNumber(n).relative).toBeLessThan(0.01);
  for(const n of [16,32,74])expect(byNumber(n).relative).toBeGreaterThan(0.6);
  expect(byNumber(3)).toMatchObject({resName:'ILE',chemical:'nonpolar'});
  expect(byNumber(32)).toMatchObject({resName:'ASP',chemical:'acidic'});
 });
 it('exposure is not a centroid-distance proxy',()=>{
  const ca=ubiquitin.residues.map(r=>ubiquitin.atoms[r.atoms.find(i=>ubiquitin.atoms[i].name==='CA')!].position);
  const centroid=ca.reduce((s,p)=>[s[0]+p[0]/76,s[1]+p[1]/76,s[2]+p[2]/76] as Vec,[0,0,0] as Vec);
  const byDistance=ubiquitin.residues.map(r=>r.index).sort((a,b)=>distance(ca[a],centroid)-distance(ca[b],centroid)).slice(0,19);
  expect(new Set(byDistance)).not.toEqual(groupIndices(residues,'buried'));
 });
});

describe('chemical classification',()=>{
 it('covers the 20 standard residues with four classes',()=>{
  expect(Object.keys(CHEMICAL_CLASS)).toHaveLength(20);
  expect(new Set(Object.values(CHEMICAL_CLASS))).toEqual(new Set(['nonpolar','polar','acidic','basic']));
  for(const r of residues)expect(r.chemical).toBe(classOf(r.resName));
 });
 it('keeps polarity separate from charge',()=>{
  expect(classOf('SER')).toBe('polar');expect(CLASS_INFO.polar.label).toBe('Polar, uncharged');expect(CLASS_INFO.nonpolar.label).toBe('Nonpolar');
  for(const n of ['GLY','ALA','VAL','LEU','ILE','MET','PRO','PHE','TRP'])expect(classOf(n)).toBe('nonpolar');
  for(const n of ['SER','THR','CYS','ASN','GLN','TYR'])expect(classOf(n)).toBe('polar');
  for(const n of ['ASP','GLU'])expect(classOf(n)).toBe('acidic');
  for(const n of ['LYS','ARG','HIS'])expect(classOf(n)).toBe('basic');
  expect(CLASS_INFO.basic.label).not.toMatch(/\+|positive/i);
  expect(()=>classOf('HOH')).toThrow();
 });
 it('legend entries have distinct colors and symbols',()=>{
  const infos=Object.values(CLASS_INFO);
  expect(new Set(infos.map(i=>i.color)).size).toBe(4);expect(new Set(infos.map(i=>i.symbol)).size).toBe(4);
  for(const i of infos)expect(i.css).toBe('#'+i.color.toString(16).padStart(6,'0'));
 });
});

describe('buried / exposed filters',()=>{
 const buried=groupIndices(residues,'buried'),exposed=groupIndices(residues,'exposed');
 it('selects the most buried and most exposed 25% by within-protein rank',()=>{
  expect(buried.size).toBe(19);expect(exposed.size).toBe(19);expect(groupIndices(residues,'all').size).toBe(76);
  expect([...buried].some(i=>exposed.has(i))).toBe(false);
  const maxBuried=Math.max(...[...buried].map(i=>residues[i].relative)),minExposed=Math.min(...[...exposed].map(i=>residues[i].relative));
  for(const r of residues){if(!buried.has(r.index))expect(r.relative).toBeGreaterThanOrEqual(maxBuried);if(!exposed.has(r.index))expect(r.relative).toBeLessThanOrEqual(minExposed);}
 });
 it('percentile selection follows rank, including ties, on synthetic data',()=>{
  const fake=[0.5,0.1,0.1,0.9,0.3,0.7,0.2,0.8].map((relative,i)=>({index:i,resSeq:i+1,relative}));
  const ranked=fake.map(f=>({...f,resName:'ALA',chemical:'nonpolar' as const,sasa:0,sideChainSasa:0,rank:0,percentile:0}));
  [...ranked].sort((a,b)=>a.relative-b.relative||a.resSeq-b.resSeq).forEach((r,i)=>{r.rank=i+1;});
  expect([...groupIndices(ranked,'buried')].sort()).toEqual([1,2]);
  expect([...groupIndices(ranked,'exposed')].sort()).toEqual([3,7]);
 });
 it('observed composition of this structure',()=>{
  expect(composition(residues,buried)).toEqual({nonpolar:15,polar:3,acidic:0,basic:1,total:19,glycine:0});
  expect(composition(residues,exposed)).toEqual({nonpolar:7,polar:4,acidic:5,basic:3,total:19,glycine:4});
  expect(composition(residues,groupIndices(residues,'all'))).toEqual({nonpolar:34,polar:19,acidic:11,basic:12,total:76,glycine:6});
 });
 it('exceptions are derived from the data and remain visible',()=>{
  const {exposedNonpolar,buriedPolar}=findExceptions(ubiquitin,residues);
  expect(exposedNonpolar).toMatchObject({resName:'LEU',resSeq:8,chemical:'nonpolar'});
  expect(exposed.has(exposedNonpolar!.index)).toBe(true);expect(exposedNonpolar!.relative).toBeGreaterThan(0.6);expect(exposedNonpolar!.sideChainSasa).toBeGreaterThan(80);
  expect(buriedPolar).toMatchObject({resName:'GLN',resSeq:41,chemical:'polar'});
  expect(buried.has(buriedPolar!.index)).toBe(true);expect(buriedPolar!.sideChainSasa).toBeLessThan(0.5);
 });
 it('buried Gln41 polar contacts are reported as distances only',()=>{
  const c=polarContacts(ubiquitin,40);
  expect(c.map(x=>x.partner)).toEqual(['Ile 36 O','Lys 27 O']);
  expect(c[0].distance).toBeCloseTo(2.97,2);expect(c[1].distance).toBeCloseTo(3.04,2);expect(c.every(x=>x.atom==='NE2')).toBe(true);
 });
});

describe('renderer color and residue mapping',()=>{
 it('every atom maps to exactly one residue with matching identity',()=>{
  const seen=new Array(ubiquitin.atoms.length).fill(0);
  for(const r of ubiquitin.residues)for(const i of r.atoms){seen[i]++;expect(ubiquitin.atoms[i].resSeq).toBe(r.resSeq);expect(ubiquitin.atoms[i].resName).toBe(r.resName);}
  expect(seen.every(n=>n===1)).toBe(true);
  ubiquitin.residues.forEach((r,i)=>{expect(r.index).toBe(i);expect(residues[i].resSeq).toBe(r.resSeq);});
 });
 it('chemistry colors side chains by class and keeps backbone neutral',()=>{
  const leu=byNumber(8),gly=byNumber(10),glu=byNumber(16);
  expect(atomColor('chemistry',leu,{name:'CD1',element:'C'})).toBe(CLASS_INFO.nonpolar.color);
  expect(atomColor('chemistry',leu,{name:'CA',element:'C'})).toBe(BACKBONE_NEUTRAL);
  expect(atomColor('chemistry',leu,{name:'O',element:'O'})).toBe(BACKBONE_NEUTRAL);
  expect(atomColor('chemistry',gly,{name:'CA',element:'C'})).toBe(CLASS_INFO.nonpolar.color);
  expect(atomColor('chemistry',glu,{name:'OE1',element:'O'})).toBe(CLASS_INFO.acidic.color);
  expect(atomColor('chemistry',glu,null)).toBe(CLASS_INFO.acidic.color);
  expect(atomColor('chemistry',byNumber(68),{name:'NE2',element:'N'})).toBe(CLASS_INFO.basic.color);
 });
 it('default uses element colors; exposure ramp is clamped and monotonic in position',()=>{
  expect(atomColor('default',byNumber(1),{name:'SD',element:'S'})).toBe(ELEMENT_COLORS.S);
  expect(exposureColor(-1)).toBe(EXPOSURE_STOPS[0]);expect(exposureColor(0)).toBe(EXPOSURE_STOPS[0]);expect(exposureColor(0.5)).toBe(EXPOSURE_STOPS[1]);expect(exposureColor(1)).toBe(EXPOSURE_STOPS[2]);expect(exposureColor(1.4)).toBe(EXPOSURE_STOPS[2]);
  const gly76=byNumber(76);expect(atomColor('exposure',gly76,{name:'CA',element:'C'})).toBe(atomColor('exposure',gly76,{name:'OXT',element:'O'}));
 });
});
