import {describe,it,expect} from 'vitest';
import * as T from 'three';
import raw from '../src/data/structures/2DN2.pdb?raw';
import metaText from './fixtures/2dn2-rcsb-metadata.json?raw';
import {parseMultiChainPdb,parsePdb,parsePdbHeader,residueKey} from '../src/protein/pdb';
import {analyzeHemoglobin,hemoglobinSceneModel,EXPLODED_DISTANCE,GLOBIN_BY_UNIPROT,HEMOGLOBIN_SOURCE,SUBUNIT_COLORS,TYPE_COLORS} from '../src/protein/hemoglobin';
import {associateHetero,displacedPositions,explodedOffsets,interfaceContacts,INTERFACE_CUTOFF,pairBetween} from '../src/protein/quaternary';
import {CHEMICAL_CLASS,classOf} from '../src/protein/chemistry';
import {inferBonds} from '../src/protein/exposure';
import {ribbonGeometry} from '../src/rendering/ribbon';
import {distance} from '../src/geometry/vector';

const meta=JSON.parse(metaText) as {assembly:{id:string;oligomericCount:number;operators:{type:string;symmetry:string}[];polymerInstances:number;nonpolymerInstances:number;modeledPolymerMonomers:number};
 assemblyFile:{coordinateRecords:number;coordinateDigest:{value:string}};entities:{chains:string[];uniprot:string[];sequence:string;sourceType:string;organism:string;description:string}[]};
const model=analyzeHemoglobin(raw),{structure,subunits,hemes,interfaces}=model,atoms=structure.atoms;
const sha256=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const ONE:Record<string,string>={ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V'};
const chainOf=(label:string)=>subunits.find(s=>s.label===label)!;

/** Fixed-column PDB line for synthetic structures. */
function line(record:'ATOM'|'HETATM',serial:number,name:string,resName:string,chain:string,resSeq:number,x:number,y:number,z:number,{icode='',alt='',occ=1,element=name[0]}:{icode?:string;alt?:string;occ?:number;element?:string}={}){
 const atomName=name.length<4&&element.length===1?` ${name}`.padEnd(4):name.padEnd(4);
 return `${record.padEnd(6)}${String(serial).padStart(5)} ${atomName}${alt||' '}${resName.padStart(3)} ${chain}${String(resSeq).padStart(4)}${icode||' '}   ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}${occ.toFixed(2).padStart(6)}${(10).toFixed(2).padStart(6)}          ${element.padStart(2)}`;
}
const residueAtoms=(chain:string,resSeq:number,x:number,serial:number,extra:{icode?:string}={})=>[
 line('ATOM',serial,'N','ALA',chain,resSeq,x,0,0,extra),line('ATOM',serial+1,'CA','ALA',chain,resSeq,x+1.46,0,0,extra),line('ATOM',serial+2,'C','ALA',chain,resSeq,x+2.0,1.42,0,extra),line('ATOM',serial+3,'O','ALA',chain,resSeq,x+1.4,2.4,0,extra)];

describe('Structure: PDB 2DN2 human deoxyhemoglobin A',()=>{
 it('1 · bundled file is the unmodified RCSB download with the expected metadata',async()=>{
  expect(await sha256(raw)).toBe(HEMOGLOBIN_SOURCE.sha256);
  expect(raw).toContain('EXPDTA    X-RAY DIFFRACTION');expect(raw).toContain('REMARK   2 RESOLUTION.    1.25 ANGSTROMS.');
  expect(raw).toMatch(/TITLE {5}1\.25A RESOLUTION CRYSTAL STRUCTURE OF HUMAN HEMOGLOBIN IN THE DEOXY/);
  expect(raw).toContain('ORGANISM_SCIENTIFIC: HOMO SAPIENS');
  expect(parsePdbHeader(raw)).toMatchObject({resolution:HEMOGLOBIN_SOURCE.resolution,method:'X-RAY DIFFRACTION',missingResidues:0,missingAtoms:0});
  expect(raw).not.toMatch(/^SEQADV|^MODRES/m);
 });
 it('2 · biological assembly: one tetramer of the four deposited chains under the identity operator, equal to RCSB assembly 1',async()=>{
  expect(model.assembly).toEqual({id:1,author:'TETRAMERIC',software:'TETRAMERIC',chains:['A','B','C','D'],identity:true});
  expect(structure.chains).toEqual(['A','B','C','D']);
  expect(meta.assembly).toMatchObject({id:'1',oligomericCount:4,polymerInstances:4,nonpolymerInstances:4,modeledPolymerMonomers:574});
  expect(meta.assembly.operators).toEqual([{id:'1',type:'identity operation',symmetry:'x,y,z'}]);
  // RCSB's generated assembly file 2DN2.pdb1 has exactly the deposited coordinate records: no chain was copied or moved.
  const records=raw.split(/\r?\n/).filter(l=>/^(ATOM|HETATM)/.test(l));
  expect(records).toHaveLength(meta.assemblyFile.coordinateRecords);
  expect(await sha256(records.map(l=>l.slice(0,66)).join('\n'))).toBe(meta.assemblyFile.coordinateDigest.value);
 });
 it('3 & 4 · two α and two β chains from DBREF accessions, matching the RCSB entity sequences (not chain letters)',()=>{
  const header=parsePdbHeader(raw);
  expect(subunits.filter(s=>s.type==='alpha').map(s=>s.chain)).toHaveLength(2);
  expect(subunits.filter(s=>s.type==='beta').map(s=>s.chain)).toHaveLength(2);
  for(const s of subunits){
   const entity=meta.entities.find(e=>e.chains.includes(s.chain))!;
   expect(entity.uniprot).toEqual([s.uniprot]);expect(GLOBIN_BY_UNIPROT[s.uniprot].type).toBe(s.type);
   expect(entity).toMatchObject({sourceType:'natural',organism:'Homo sapiens'});
   expect(header.seqres.get(s.chain)!.map(r=>ONE[r]).join('')).toBe(entity.sequence);
   expect(structure.residues.filter(r=>r.chain===s.chain).map(r=>ONE[r.resName]).join('')).toBe(entity.sequence);
  }
  expect(meta.entities.map(e=>e.description)).toEqual(['Hemoglobin alpha subunit','Hemoglobin beta subunit']);
  expect(meta.entities[0].sequence).not.toBe(meta.entities[1].sequence);
  expect(header.molecules.map(m=>[m.name,m.chains])).toEqual([['HEMOGLOBIN ALPHA SUBUNIT',['A','C']],['HEMOGLOBIN BETA SUBUNIT',['B','D']]]);
 });
 it('3b · the type mapping follows the data: relabelling DBREF breaks α2β2 and the analysis refuses',()=>{
  const swapped=raw.replace(/^(DBREF  2DN2 C .*?)P69905(\s+)HBA_HUMAN/m,'$1P68871$2HBB_HUMAN');
  expect(swapped).not.toBe(raw);
  expect(()=>analyzeHemoglobin(swapped)).toThrow(/expected α2β2, found α1β3/);
 });
 it('5 · modeled residues equal the deposited sequence length for every chain (no missing residues)',()=>{
  for(const s of subunits){
   const entity=meta.entities.find(e=>e.chains.includes(s.chain))!;
   expect(s.sequenceLength).toBe(entity.sequence.length);expect(s.modeledResidues).toBe(entity.sequence.length);
   expect([s.firstResSeq,s.lastResSeq]).toEqual([1,entity.sequence.length]);
  }
  expect(subunits.reduce((n,s)=>n+s.modeledResidues,0)).toBe(meta.assembly.modeledPolymerMonomers);
  const heavy:Record<string,number>={GLY:4,ALA:5,SER:6,CYS:6,VAL:7,THR:7,PRO:7,ILE:8,LEU:8,ASP:8,ASN:8,GLU:9,GLN:9,LYS:9,MET:8,HIS:10,PHE:11,ARG:11,TYR:12,TRP:14};
  for(const r of structure.residues){const last=subunits.find(s=>s.chain===r.chain)!.lastResSeq===r.resSeq;expect(r.atoms.length-(last?1:0)).toBe(heavy[r.resName]);}
 });
 it('6 · coordinates: exactly as deposited, finite, sane bonds, each chain one connected polypeptide, no bond between chains',()=>{
  const first=raw.split(/\r?\n/).find(l=>l.startsWith('ATOM'))!;
  expect(atoms[0].position).toEqual([Number(first.slice(30,38)),Number(first.slice(38,46)),Number(first.slice(46,54))]);
  expect(structure.omitted).toEqual({waters:221,hydrogens:0,alternateLocations:0});
  expect(atoms.every(a=>a.position.every(Number.isFinite)&&a.altLoc===''&&a.occupancy===1)).toBe(true);
  const lengths=model.bonds.map(([a,b])=>distance(atoms[a].position,atoms[b].position));
  expect(Math.min(...lengths)).toBeGreaterThan(1.1);expect(Math.max(...lengths)).toBeLessThan(1.95);
  expect(model.bonds.every(([a,b])=>atoms[a].chain===atoms[b].chain)).toBe(true);
  for(const s of subunits){
   const own=s.residues.flatMap(i=>structure.residues[i].atoms),parent=new Map(own.map(i=>[i,i])),find=(i:number):number=>parent.get(i)===i?i:find(parent.get(i)!);
   for(const [a,b] of model.bonds)if(atoms[a].chain===s.chain)parent.set(find(a),find(b));
   expect(new Set(own.map(find)).size).toBe(1);
  }
  expect(structure.residues.filter(r=>r.secondary==='strand')).toHaveLength(0);
 });
});

describe('Heme',()=>{
 it('7 & 8 · four HEM groups with 43 heavy atoms each and exactly four Fe atoms; no other hetero group',()=>{
  expect(structure.hetero.map(g=>g.resName)).toEqual(['HEM','HEM','HEM','HEM']);
  expect(structure.hetero.map(g=>g.atoms.length)).toEqual([43,43,43,43]);
  expect(atoms.filter(a=>a.element==='FE')).toHaveLength(4);
  expect(hemes.map(h=>atoms[h.iron].element)).toEqual(['FE','FE','FE','FE']);
  expect(hemes.map(h=>h.number)).toEqual([1,2,3,4]);
  // Each Fe is bonded (by distance) to the four porphyrin N and nothing else inside the group.
  for(const h of hemes){const partners=model.hemeBonds.filter(b=>b.includes(h.iron)).map(([a,b])=>atoms[a===h.iron?b:a].name).sort();expect(partners).toEqual(['NA','NB','NC','ND']);}
  expect(model.hemeBonds).toHaveLength(4*50);
  // Deposited geometry is kept as is: distances below 1.25 Å occur only in the propionate carboxylates and vinyl groups
  // (deposited 1.01–1.24 Å, documented in HEMOGLOBIN_QUATERNARY_VALIDATION.md); porphyrin ring bonds are 1.28–1.55 Å.
  const flexible=/^(CGA|CGD|O1A|O2A|O1D|O2D|CAB|CBB|CAC|CBC)$/;
  for(const [a,b] of model.hemeBonds){const d=distance(atoms[a].position,atoms[b].position);expect(d).toBeGreaterThan(1.0);expect(d).toBeLessThan(2.2);if(d<1.25)expect(flexible.test(atoms[a].name)&&flexible.test(atoms[b].name)).toBe(true);}
 });
 it('9 · each globin chain has one heme by spatial association, and the proximal His matches the LINK records',()=>{
  const header=parsePdbHeader(raw);
  for(const s of subunits){
   const h=s.heme,own=h.association.contacts[s.chain];
   expect(h.association.chain).toBe(s.chain);
   expect(own).toBeGreaterThan(40);
   for(const other of structure.chains)if(other!==s.chain)expect(h.association.contacts[other]).toBe(0);
   expect(h.proximal).toMatchObject({resName:'HIS',atomName:'NE2',chain:s.chain});
   const link=header.links.find(l=>l.b.resName==='HEM'&&l.b.chain===h.fileChain)!;
   expect([link.a.name,link.a.resName,link.a.chain,link.a.resSeq]).toEqual(['NE2','HIS',s.chain,h.proximal.resSeq]);
   expect(h.proximal.distance).toBeCloseTo(link.distance,1);
   expect(h.proximal.distance).toBeGreaterThan(2.0);expect(h.proximal.distance).toBeLessThan(2.35);
  }
  expect(new Set(subunits.map(s=>s.heme.group)).size).toBe(4);
  expect(subunits.filter(s=>s.type==='alpha').map(s=>s.heme.proximal.resSeq)).toEqual([87,87]);
  expect(subunits.filter(s=>s.type==='beta').map(s=>s.heme.proximal.resSeq)).toEqual([92,92]);
 });
 it('9b · association uses coordinates, not the record chain ID or record order',()=>{
  const heme=structure.hetero[0],relabelled={...heme,chain:'B'};
  expect(associateHetero(structure,relabelled).chain).toBe('A');
  const reordered=raw.split(/\r?\n/),hemA=reordered.filter(l=>/^HETATM.{11}HEM A/.test(l)),rest=reordered.filter(l=>!/^HETATM.{11}HEM A/.test(l));
  const moved=analyzeHemoglobin([...rest.slice(0,-1),...hemA,rest.at(-1)!].join('\n'));
  expect(moved.subunits.map(s=>[s.label,s.chain,s.heme.fileChain,s.heme.resSeq])).toEqual(subunits.map(s=>[s.label,s.chain,s.heme.fileChain,s.heme.resSeq]));
 });
 it('10 · heme is not an amino-acid residue and never enters the chemistry classification',()=>{
  expect(structure.residues.some(r=>r.resName==='HEM')).toBe(false);
  expect(CHEMICAL_CLASS.HEM).toBeUndefined();expect(()=>classOf('HEM')).toThrow();
  expect(structure.residues.every(r=>CHEMICAL_CLASS[r.resName])).toBe(true);
  expect(hemes.every(h=>structure.hetero.some(g=>g.index===h.group))).toBe(true);
  // Single-chain parser used by earlier modules still omits every HETATM.
  const chainA=parsePdb(raw,'A');
  expect(chainA.atoms.some(a=>a.hetero)).toBe(false);expect(chainA.omitted).toMatchObject({waters:221,hetero:172,otherChains:3315});
 });
});

describe('Multi-chain residue identity',()=>{
 it('11 · residue key = chain + resSeq + insertion code + resName',()=>{
  expect(residueKey({chain:'A',resSeq:10,insertionCode:'',resName:'LEU'})).toBe('A:10:LEU');
  expect(residueKey({chain:'A',resSeq:10,insertionCode:'A',resName:'LEU'})).toBe('A:10A:LEU');
  const keys=structure.residues.map(residueKey);
  expect(new Set(keys).size).toBe(574);
  expect(structure.residues.filter(r=>r.resSeq===10)).toHaveLength(4);
 });
 it('12 · insertion codes create distinct residues and distinct altloc slots',()=>{
  const text=[...residueAtoms('A',10,0,1),...residueAtoms('A',10,3.8,5,{icode:'A'}),...residueAtoms('A',11,7.6,9)].join('\n');
  const s=parseMultiChainPdb(text);
  expect(s.residues.map(residueKey)).toEqual(['A:10:ALA','A:10A:ALA','A:11:ALA']);
  expect(s.atoms).toHaveLength(12);expect(s.omitted.alternateLocations).toBe(0);
  expect(parsePdb(text,'A').residues.map(r=>`${r.resSeq}${r.insertionCode}`)).toEqual(['10','10A','11']);
 });
 it('13 · the same resSeq in different chains never collides (residues, altlocs, bonds, contacts)',()=>{
  const text=[
   ...residueAtoms('A',10,0,1),line('ATOM',5,'CB','ALA','A',10,1.9,-0.8,1.2,{alt:'A',occ:0.6}),line('ATOM',6,'CB','ALA','A',10,1.9,-0.8,-1.2,{alt:'B',occ:0.4}),
   ...residueAtoms('B',10,0,7).map(l=>l.replace(/( {2}0\.000)(?=\s+1\.00)/,'  3.500')),line('ATOM',11,'CB','ALA','B',10,1.9,-0.8,4.7),
   ...residueAtoms('B',11,2.6,12).map(l=>l.replace(/( {2}0\.000)(?=\s+1\.00)/,'  3.500')),
   line('HETATM',16,'O','HOH','A',201,9,9,9),
  ].join('\n');
  const s=parseMultiChainPdb(text);
  expect(s.chains).toEqual(['A','B']);
  expect(s.residues.map(residueKey)).toEqual(['A:10:ALA','B:10:ALA','B:11:ALA']);
  expect(s.residues.map(r=>r.atoms.length)).toEqual([5,5,4]);
  expect(s.omitted).toEqual({waters:1,hydrogens:0,alternateLocations:1});
  expect(s.atoms.find(a=>a.chain==='A'&&a.name==='CB')!.position[2]).toBe(1.2);
  const bonds=inferBonds(s);
  expect(bonds.every(([a,b])=>s.atoms[a].chain===s.atoms[b].chain)).toBe(true);
  expect(bonds.some(([a,b])=>s.atoms[a].resSeq===10&&s.atoms[b].resSeq===11)).toBe(true);
  const contacts=interfaceContacts(s);
  expect(contacts.pairs.map(p=>p.chains)).toEqual([['A','B']]);
  expect([...contacts.partners.keys()].map(i=>residueKey(s.residues[i]))).toEqual(['A:10:ALA','B:10:ALA','B:11:ALA']);
  for(const [i,partners] of contacts.partners)expect(partners).toEqual([s.residues[i].chain==='A'?'B':'A']);
 });
});

describe('UI data mapping',()=>{
 it('14 · subunit selector: α1, β1, α2, β2 each map to one real PDB chain; β1 is the larger α1 contact',()=>{
  expect(subunits.map(s=>[s.label,s.chain])).toEqual([['α1','A'],['β1','B'],['α2','C'],['β2','D']]);
  const size=(a:string,b:string)=>{const p=pairBetween(interfaces,a,b)!;return p.residues[0].length+p.residues[1].length;};
  expect(size(chainOf('α1').chain,chainOf('β1').chain)).toBeGreaterThan(size(chainOf('α1').chain,chainOf('β2').chain));
  expect(size(chainOf('α2').chain,chainOf('β2').chain)).toBeGreaterThan(size(chainOf('α2').chain,chainOf('β1').chain));
  const scene=hemoglobinSceneModel(model);
  expect(scene.chains.map(c=>[c.label,c.chain])).toEqual(subunits.map(s=>[s.label,s.chain]));
  expect(new Set(scene.chains.map(c=>c.color)).size).toBe(4);
  expect(scene.chains.map(c=>c.color)).toEqual(subunits.map(s=>SUBUNIT_COLORS[s.label].color));
 });
 it('15 · chain-type colors: one color per globin type; α and β differ',()=>{
  const scene=hemoglobinSceneModel(model);
  for(const s of subunits)expect(scene.chains.find(c=>c.chain===s.chain)!.typeColor).toBe(TYPE_COLORS[s.type].color);
  expect(TYPE_COLORS.alpha.color).not.toBe(TYPE_COLORS.beta.color);
  expect(new Set(scene.chains.map(c=>c.typeColor)).size).toBe(2);
 });
 it('16 & 17 · heme toggle data: four hemes in the scene model; selecting a chain selects its own heme',()=>{
  const scene=hemoglobinSceneModel(model);
  expect(scene.hemes).toHaveLength(4);
  for(const s of subunits){
   const h=scene.hemes.find(x=>x.chain===s.chain)!;
   expect(h.group).toBe(s.heme.group);expect(h.iron).toBe(s.heme.iron);
   expect(structure.hetero.find(g=>g.index===h.group)!.atoms).toContain(h.iron);
   expect(atoms[h.proximal.atom].chain).toBe(s.chain);
  }
  expect(model.hetero).toEqual(Object.fromEntries(subunits.map(s=>[s.heme.group,s.chain])));
 });
 it('ribbon per chain: vertices belong to that chain only; single-chain ribbon indices are unchanged',()=>{
  const positions=atoms.map(a=>new T.Vector3(...a.position));
  for(const s of subunits){
   const residues=s.residues.map(i=>structure.residues[i]),{vertexResidue,geometry}=ribbonGeometry(residues,atoms,positions,()=>0x777777);
   expect(new Set(vertexResidue)).toEqual(new Set(s.residues));geometry.dispose();
  }
  const ubq=parsePdb(raw,'A'),{vertexResidue}=ribbonGeometry(ubq.residues,ubq.atoms,ubq.atoms.map(a=>new T.Vector3(...a.position)),()=>0);
  expect(Math.max(...vertexResidue)).toBe(ubq.residues.length-1);expect(Math.min(...vertexResidue)).toBe(0);
 });
});

describe('Exploded view (display only)',()=>{
 const owner=(i:number)=>{const g=structure.hetero.find(x=>x.atoms.includes(i));return g?model.hetero[g.index]:atoms[i].chain;};
 it('18 · translation only: every chain moves by one vector of the stated length; internal geometry and heme–chain geometry preserved',()=>{
  const moved=displacedPositions(atoms,model.exploded,owner);
  for(const s of subunits){
   const v=model.exploded[s.chain];expect(Math.hypot(...v)).toBeCloseTo(EXPLODED_DISTANCE,10);
   const own=[...s.residues.flatMap(i=>structure.residues[i].atoms),...structure.hetero.find(g=>g.index===s.heme.group)!.atoms];
   for(const i of own)moved[i].forEach((c,k)=>expect(c-atoms[i].position[k]).toBeCloseTo(v[k],9));
   for(let k=0;k<own.length;k+=97)expect(distance(moved[own[k]],moved[s.heme.iron])).toBeCloseTo(distance(atoms[own[k]].position,atoms[s.heme.iron].position),9);
  }
  // Outward: chains move apart, never together.
  for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
   const [x,y]=[subunits[a],subunits[b]],before=distance(atoms[x.heme.iron].position,atoms[y.heme.iron].position),after=distance(moved[x.heme.iron],moved[y.heme.iron]);
   expect(after).toBeGreaterThan(before-1e-9);
  }
  expect(EXPLODED_DISTANCE).toBeLessThanOrEqual(10);
 });
 it('19 · reset: zero offsets reproduce the deposited coordinates exactly, and the structure itself is never modified',()=>{
  const before=JSON.stringify(atoms.map(a=>a.position));
  displacedPositions(atoms,model.exploded,owner);
  expect(JSON.stringify(atoms.map(a=>a.position))).toBe(before);
  const zero=explodedOffsets(structure,0);
  expect(displacedPositions(atoms,zero,owner)).toEqual(atoms.map(a=>a.position));
 });
});

describe('Interfaces',()=>{
 it('20 · contacts join residues of different chains only, within the documented cutoff',()=>{
  expect(interfaces.cutoff).toBe(INTERFACE_CUTOFF);expect(INTERFACE_CUTOFF).toBe(4);
  for(const p of interfaces.pairs){
   expect(p.chains[0]).not.toBe(p.chains[1]);
   for(const [side,chain] of [[0,p.chains[0]],[1,p.chains[1]]] as const)for(const i of p.residues[side]){
    const r=structure.residues[i];expect(r.chain).toBe(chain);
    const other=structure.residues.filter(x=>x.chain===p.chains[1-side]).flatMap(x=>x.atoms);
    expect(r.atoms.some(a=>other.some(b=>distance(atoms[a].position,atoms[b].position)<=INTERFACE_CUTOFF))).toBe(true);
   }
  }
  for(const [i,partners] of interfaces.partners)expect(partners).not.toContain(structure.residues[i].chain);
  const summary=Object.fromEntries(interfaces.pairs.map(p=>[p.chains.join('-'),[p.residues[0].length,p.residues[1].length]]));
  expect(summary).toEqual({'A-B':[16,18],'A-C':[4,4],'A-D':[14,13],'B-C':[13,14],'C-D':[16,18]});
  expect(pairBetween(interfaces,'B','D')).toBeNull();
  expect(interfaces.partners.size).toBe(122);
 });
 it('21 · deterministic: repeated runs and a re-ordered file give identical results by residue identity',()=>{
  const keyed=(a:ReturnType<typeof interfaceContacts>,s:typeof structure)=>a.pairs.map(p=>[p.chains.join('-'),p.residues.map(list=>list.map(i=>residueKey(s.residues[i])).sort()),p.atomPairs]);
  expect(keyed(interfaceContacts(structure),structure)).toEqual(keyed(interfaces,structure));
  const lines=raw.split(/\r?\n/),coords=lines.filter(l=>/^(ATOM|TER)/.test(l)),byChain=(c:string)=>coords.filter(l=>l.slice(21,22)===c);
  const reordered=parseMultiChainPdb(['D','C','B','A'].flatMap(byChain).join('\n'));
  expect(reordered.chains).toEqual(['D','C','B','A']);
  expect(keyed(interfaceContacts(reordered),reordered)).toEqual(keyed(interfaces,structure));
 });
});
