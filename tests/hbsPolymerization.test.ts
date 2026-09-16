import {describe,it,expect} from 'vitest';
import hbsRaw from '../src/data/structures/2HBS.pdb?raw';
import hbaRaw from '../src/data/structures/2DN2.pdb?raw';
import metaText from './fixtures/2hbs-rcsb-metadata.json?raw';
import {parseMultiChainPdb,parsePdbHeader} from '../src/protein/pdb';
import {analyzeHemoglobin,HEMOGLOBIN_SOURCE,SUBUNIT_ORDER} from '../src/protein/hemoglobin';
import {classOf,CLASS_INFO} from '../src/protein/chemistry';
import {inferBonds} from '../src/protein/exposure';
import {buildAssembly,buildCopies,interfaceContacts} from '../src/protein/quaternary';
import {inverseMat3,applyRigid,determinant,type Mat3} from '../src/protein/rigid';
import {latticeAngles,latticeLabel,latticeLengths,latticeTransform,parseCrystalFrame,toFractional} from '../src/protein/crystal';
import {analyzeSickle,sickleSceneModel,moleculeResidueKey,CONTACT_CUTOFF,HBA_MUTATION_RESIDUE,HBA_SOURCE,HBS_MUTATION_RESIDUE,HBS_SOURCE,
 MUTATION_POSITION,OVERLAP_CUTOFF,POCKET_CORE,POCKET_PERIPHERY,SECONDARY_ACCEPTOR_POSITION,SECONDARY_DONOR_POSITION,SEGMENT_CELLS} from '../src/protein/sickle';
import type {Vec} from '../src/geometry/vector';

const meta=JSON.parse(metaText) as {
 entry:{title:string;resolution:number;method:string;depositedModeledMonomers:number;depositedUnmodeledMonomers:number;depositedAtoms:number;depositedSolventAtoms:number;assemblyCount:number};
 citation:{authors:string[];journal:string;volume:string;pageFirst:string;pageLast:string;year:number;doi:string;pubmed:number};
 symmetry:{spaceGroup:string;intTablesNumber:number;cell:{a:number;b:number;c:number;alpha:number;beta:number;gamma:number};z:number};
 assemblies:{id:string;oligomericCount:number;oligomericDetails:string;operators:{id:string;type:string;symmetry:string;matrix:number[][];vector:number[]}[];operExpression:string;polymerInstances:number;modeledPolymerMonomers:number;unmodeledPolymerMonomers:number}[];
 assemblyFiles:{name:string;chains:string[];coordinateRecords:number;coordinateDigest:string}[];
 entities:{entity:number;description:string;chains:string[];uniprot:string[];sequence:string;sourceType:string;organism:string;mutations:number;mutation:string|null;molecules:number}[];
 nonpolymerEntities:{compId:string;count:number;chains:string[]}[];
};
const sha256=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const ONE:Record<string,string>={ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLN:'Q',GLU:'E',GLY:'G',HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',THR:'T',TRP:'W',TYR:'Y',VAL:'V'};

const model=analyzeSickle(hbsRaw,hbaRaw),scene=sickleSceneModel(model);
const {hbs,hba,mutation,primary,contacts}=model;
const s=hbs.structure,deposited=parseMultiChainPdb(hbsRaw),header=parsePdbHeader(hbsRaw);
const depositedInstances=hbs.instances.filter(i=>i.deposited);
const betaChains=hbs.chains.filter(c=>c.type==='beta'&&depositedInstances.some(i=>i.id===c.instance));
const residueAt=(chain:string,resSeq:number)=>s.residues.find(r=>r.chain===chain&&r.resSeq===resSeq&&r.insertionCode==='')!;
const dist=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const core=primary.pocket.filter(q=>q.role==='core'),periphery=primary.pocket.filter(q=>q.role==='peripheral');

describe('Structure: HbS endpoint PDB 2HBS deoxyhemoglobin S',()=>{
 it('1 · asset is the unmodified RCSB download (SHA-256) with the deposited metadata and citation',async()=>{
  expect(await sha256(hbsRaw)).toBe(HBS_SOURCE.sha256);
  expect(hbsRaw).toMatch(/^TITLE {5}THE HIGH RESOLUTION CRYSTAL STRUCTURE OF DEOXYHEMOGLOBIN S/m);
  expect(hbsRaw).toContain('ORGANISM_SCIENTIFIC: HOMO SAPIENS');
  expect(hbsRaw).toContain(`DOI    ${meta.citation.doi.toUpperCase()}`);
  expect(hbsRaw).toContain(`PMID   ${meta.citation.pubmed}`);
  expect(parsePdbHeader(hbsRaw)).toMatchObject({resolution:meta.entry.resolution,method:meta.entry.method});
  expect(HBS_SOURCE.resolution).toBe(2.05);expect(HBS_SOURCE.pdbId).toBe('2HBS');expect(s.id).toBe('2HBS');
  expect(HBS_SOURCE.doi).toBe(meta.citation.doi);
  expect(HBS_SOURCE.citation).toContain(String(meta.citation.year));
  expect(HBS_SOURCE.citation).toContain(`${meta.citation.volume}:${meta.citation.pageFirst}–${meta.citation.pageLast}`);
 });
 it('2 · α2βS2: four α (P69905) and four βS (P68871) deposited chains, two per tetramer, checked by DBREF',()=>{
  expect(deposited.chains).toEqual(['A','B','C','D','E','F','G','H']);
  const alpha=meta.entities.find(e=>e.uniprot[0]==='P69905')!,beta=meta.entities.find(e=>e.uniprot[0]==='P68871')!;
  expect(alpha.chains).toEqual(['A','C','E','G']);expect(beta.chains).toEqual(['B','D','F','H']);
  for(const chain of alpha.chains)expect(header.dbref.find(d=>d.chain===chain&&d.database==='UNP')).toMatchObject({accession:'P69905',idCode:'HBA_HUMAN'});
  for(const chain of beta.chains)expect(header.dbref.find(d=>d.chain===chain&&d.database==='UNP')).toMatchObject({accession:'P68871',idCode:'HBB_HUMAN'});
  for(const instance of depositedInstances){
   const own=hbs.chains.filter(c=>c.instance===instance.id);
   expect(own.filter(c=>c.type==='alpha')).toHaveLength(2);expect(own.filter(c=>c.type==='beta')).toHaveLength(2);
   expect(own.map(c=>c.label).sort()).toEqual([...SUBUNIT_ORDER].sort());
  }
 });
 it('3 · β6 is Val in every βS chain — both β chains of each tetramer carry the substitution',()=>{
  expect(betaChains).toHaveLength(4);
  for(const chain of betaChains){
   const r=residueAt(chain.chain,MUTATION_POSITION);
   expect(r.resName).toBe(HBS_MUTATION_RESIDUE);
   expect(header.seqres.get(chain.sourceChain)![MUTATION_POSITION-1]).toBe(HBS_MUTATION_RESIDUE);
   expect(r.atoms.map(i=>s.atoms[i].name).sort()).toEqual(['C','CA','CB','CG1','CG2','N','O']);
  }
  // SEQADV and the RCSB entity record both describe the same single substitution against the reference sequence.
  for(const chain of ['B','D','F','H'])expect(hbsRaw).toContain(`SEQADV 2HBS VAL ${chain}    ${MUTATION_POSITION}  UNP  P68871    GLU     ${MUTATION_POSITION} VARIANT`);
  const beta=meta.entities.find(e=>e.uniprot[0]==='P68871')!;
  expect(beta.mutations).toBe(1);expect(beta.mutation).toBe('E6V VARIANT');
  expect(beta.sequence[MUTATION_POSITION-1]).toBe('V');
 });
 it('4 · the βS sequence differs from HbB reference only at position 6, and α is unchanged',()=>{
  const alpha=meta.entities.find(e=>e.uniprot[0]==='P69905')!,beta=meta.entities.find(e=>e.uniprot[0]==='P68871')!;
  const hbaModel=analyzeHemoglobin(hbaRaw);
  const seqOf=(m:typeof hbaModel,label:string)=>m.header.seqres.get(m.subunits.find(x=>x.label===label)!.sourceChain)!.map(r=>ONE[r]).join('');
  const hbaBeta=seqOf(hbaModel,'β1'),hbaAlpha=seqOf(hbaModel,'α1');
  expect(beta.sequence).toHaveLength(hbaBeta.length);
  const differences=[...beta.sequence].map((c,i)=>[i+1,hbaBeta[i],c]).filter(([,a,b])=>a!==b);
  expect(differences).toEqual([[MUTATION_POSITION,'E','V']]);
  expect(alpha.sequence).toBe(hbaAlpha);
 });
 it('5 · deoxy: eight hemes, one per chain by spatial association, and no ligand deposited on any Fe',()=>{
  const hemes=deposited.hetero.filter(g=>g.resName==='HEM');
  expect(hemes).toHaveLength(8);
  expect(meta.nonpolymerEntities.map(e=>e.compId)).toEqual(['HEM']);
  expect(meta.nonpolymerEntities[0].count).toBe(8);
  // No hetero group other than heme, so nothing could be an O2/CO ligand; waters are counted and omitted.
  expect(deposited.hetero.filter(g=>g.resName!=='HEM')).toHaveLength(0);
  expect(hbs.omitted.waters).toBe(meta.entry.depositedSolventAtoms);
  for(const chain of hbs.chains){
   const heme=s.hetero.find(g=>g.index===chain.heme)!;
   expect(heme.chain).toBe(chain.chain);
   expect(heme.atoms.filter(i=>s.atoms[i].element==='FE')).toHaveLength(1);
   // The nearest protein N to Fe is the proximal His of the same chain — the five-coordinate deoxy arrangement.
   const fe=s.atoms[chain.iron].position;
   let best={d:Infinity,res:''};
   for(const r of s.residues)if(r.chain===chain.chain)for(const i of r.atoms)
    if(s.atoms[i].element==='N'&&!['N'].includes(s.atoms[i].name)){const d=dist(fe,s.atoms[i].position);if(d<best.d)best={d,res:r.resName};}
   expect(best.res).toBe('HIS');expect(best.d).toBeLessThan(2.8);
  }
 });
 it('6 · coordinate sanity: every residue modelled, no alternate locations, heavy atoms only, finite coordinates',()=>{
  expect(header.missingResidues).toBe(meta.entry.depositedUnmodeledMonomers);
  expect(meta.entry.depositedUnmodeledMonomers).toBe(0);
  expect(deposited.residues).toHaveLength(meta.entry.depositedModeledMonomers);
  expect(deposited.atoms.filter(a=>a.altLoc!=='')).toHaveLength(0);
  expect(hbs.omitted.alternateLocations).toBe(0);
  expect(deposited.atoms.filter(a=>a.element==='H'||a.element==='D')).toHaveLength(0);
  expect(deposited.atoms.length+meta.entry.depositedSolventAtoms).toBe(meta.entry.depositedAtoms);
  for(const a of s.atoms)expect(a.position.every(Number.isFinite)).toBe(true);
  expect(deposited.atoms.every(a=>a.occupancy===1)).toBe(true);
 });
 it('7 · both biological assemblies are complete tetramers under the identity operator (RCSB assembly files agree)',()=>{
  expect(header.assemblies).toHaveLength(2);
  expect(meta.entry.assemblyCount).toBe(2);
  expect(hbs.assemblies.map(a=>a.chains)).toEqual([['A','B','C','D'],['E','F','G','H']]);
  header.assemblies.forEach((a,k)=>{
   expect(a.operators).toHaveLength(1);
   expect(a.operators[0].rotation).toEqual([[1,0,0],[0,1,0],[0,0,1]]);
   expect(a.operators[0].translation).toEqual([0,0,0]);
   expect(a.operators[0].rotation).toEqual(meta.assemblies[k].operators[0].matrix);
   expect(meta.assemblies[k]).toMatchObject({oligomericCount:4,oligomericDetails:'tetrameric',operExpression:'1',polymerInstances:4,unmodeledPolymerMonomers:0});
   expect(meta.assemblyFiles[k].chains).toEqual(a.chains);
  });
  // The two assemblies partition the deposited chains: nothing is shared and nothing is left out.
  expect(hbs.assemblies.flatMap(a=>a.chains).sort()).toEqual([...deposited.chains].sort());
 });
});

describe('HbA reference (PDB 2DN2) is unchanged',()=>{
 it('8 · the HbA asset and its Phase 4A analysis are byte- and value-identical to the existing module',async()=>{
  expect(await sha256(hbaRaw)).toBe(HEMOGLOBIN_SOURCE.sha256);
  expect(HBA_SOURCE.pdbId).toBe('2DN2');expect(HBA_SOURCE.resolution).toBe(1.25);
  const standalone=analyzeHemoglobin(hbaRaw);
  expect(hba.structure.atoms).toHaveLength(standalone.structure.atoms.length);
  expect(hba.subunits.map(x=>[x.label,x.chain,x.type])).toEqual(standalone.subunits.map(x=>[x.label,x.chain,x.type]));
  expect(hba.assembly).toEqual(standalone.assembly);
  // Coordinates are the deposited ones: the module never writes back the aligned copy.
  expect(hba.structure.atoms[0].position).toEqual(standalone.structure.atoms[0].position);
 });
 it('9 · β6 is Glu in both HbA β chains, and the acceptor-pocket positions exist in both',()=>{
  const betas=hba.subunits.filter(x=>x.type==='beta');
  expect(betas).toHaveLength(2);
  for(const b of betas){
   const at=(n:number)=>hba.structure.residues.find(r=>r.chain===b.chain&&r.resSeq===n&&r.insertionCode==='')!;
   expect(at(MUTATION_POSITION).resName).toBe(HBA_MUTATION_RESIDUE);
   expect(POCKET_CORE.map(n=>at(n).resName)).toEqual(['ALA','PHE','LEU']);
   expect(POCKET_PERIPHERY.map(n=>at(n).resName)).toEqual(['THR','ASP']);
   expect(at(SECONDARY_DONOR_POSITION).resName).toBe('THR');
  }
  // The same numbers in an α chain are different residues — 6/70/85/88 are β-globin positions only.
  const alpha=hba.subunits.find(x=>x.type==='alpha')!;
  const alphaAt=(n:number)=>hba.structure.residues.find(r=>r.chain===alpha.chain&&r.resSeq===n)!.resName;
  expect([MUTATION_POSITION,...POCKET_CORE].map(alphaAt)).not.toEqual(['GLU','ALA','PHE','LEU']);
 });
});

describe('Chain correspondence and molecule-instance-aware identity',()=>{
 it('10 · every HbS chain maps to the HbA subunit with the same label and globin type',()=>{
  expect(mutation.chainFits).toHaveLength(8);
  for(const f of mutation.chainFits){
   const reference=hba.subunits.find(x=>x.chain===f.reference)!;
   expect(reference.type).toBe(f.type);expect(reference.label).toBe(f.label);
   expect(f.matched).toBe(f.type==='alpha'?141:146);
  }
  expect(new Set(mutation.chainFits.filter(f=>f.instance===depositedInstances[0].id).map(f=>f.reference)).size).toBe(4);
 });
 it('11 · residue numbering is mature β-globin numbering in both files (DBREF seqBegin = dbBegin)',()=>{
  for(const d of [...header.dbref,...hba.header.dbref].filter(d=>d.database==='UNP')){
   expect(d.seqBegin).toBe(d.dbBegin);expect(d.seqBegin).toBe(1);
  }
  // β6 in the HbS donor chain and β6 in the HbA reference chain are the same sequence position.
  expect(mutation.hba.position).toBe(MUTATION_POSITION);expect(mutation.hbs.position).toBe(MUTATION_POSITION);
 });
 it('12 · residue identity carries a molecule instance: the same chain letter in two molecules is never the same residue',()=>{
  const keys=new Set<string>();
  for(const chain of hbs.chains)for(const i of chain.residues){
   const r=s.residues[i],key=moleculeResidueKey(s.id,chain.instance,chain.sourceChain,r);
   expect(keys.has(key)).toBe(false);keys.add(key);
  }
  expect(keys.size).toBe(s.residues.length);
  // β6 of chain H exists once per molecule instance, with the same chain letter and residue number but distinct keys.
  const val6=hbs.chains.filter(c=>c.sourceChain==='H').map(c=>moleculeResidueKey(s.id,c.instance,c.sourceChain,residueAt(c.chain,MUTATION_POSITION)));
  expect(val6).toHaveLength(SEGMENT_CELLS.length);
  expect(new Set(val6).size).toBe(SEGMENT_CELLS.length);
  expect(val6.every(k=>k.endsWith('|H:6:VAL'))).toBe(true);
  expect(hbs.instances.map(i=>i.id)).toEqual(['M1-a','M2-a','M1','M2','M1+a','M2+a']);
 });
});

describe('Mutation chemistry and the local comparison',()=>{
 it('13 · Glu is classified acidic and Val nonpolar by the existing four-group scheme (unchanged for HbS)',()=>{
  expect(classOf(HBA_MUTATION_RESIDUE)).toBe('acidic');
  expect(classOf(HBS_MUTATION_RESIDUE)).toBe('nonpolar');
  expect(mutation.hba.chemical).toBe('acidic');expect(mutation.hbs.chemical).toBe('nonpolar');
  expect(CLASS_INFO.acidic.label).toBe('Acidic');expect(CLASS_INFO.nonpolar.label).toBe('Nonpolar');
  // Pocket residues use the same scheme: Ala, Phe and Leu are all nonpolar in it.
  expect(core.map(q=>q.chemical)).toEqual(['nonpolar','nonpolar','nonpolar']);
  expect(periphery.map(q=>q.chemical)).toEqual(['polar','acidic']);
  expect(core.map(q=>classOf(q.resName))).toEqual(core.map(q=>q.chemical));
 });
 it('14 · the β-chain superposition is a proper rigid motion and leaves only β6 different',()=>{
  expect(mutation.alignment.matched).toBe(146);
  expect(mutation.alignment.determinant).toBeCloseTo(1,9);
  expect(mutation.alignment.rmsd).toBeLessThan(1);
  expect(mutation.differences).toEqual([{position:MUTATION_POSITION,hba:HBA_MUTATION_RESIDUE,hbs:HBS_MUTATION_RESIDUE}]);
  // A rigid superposition: every HbA internal distance is preserved exactly.
  const a=hba.structure.atoms;
  for(const [i,j] of [[0,100],[500,2000],[1234,4321]]){
   expect(dist(mutation.hbaPositions[i],mutation.hbaPositions[j])).toBeCloseTo(dist(a[i].position,a[j].position),9);
  }
  expect(mutation.hbaPositions[7]).toEqual(applyRigid(mutation.alignment.transform,a[7].position));
 });
 it('15 · the comparison is deterministic and the mutation does not refold the globin',()=>{
  const again=analyzeSickle(hbsRaw,hbaRaw);
  expect(again.mutation.alignment.rmsd).toBe(mutation.alignment.rmsd);
  expect(again.mutation.chainFits.map(f=>f.rmsd)).toEqual(mutation.chainFits.map(f=>f.rmsd));
  expect(again.mutation.tetramerFits.map(f=>f.rmsd)).toEqual(mutation.tetramerFits.map(f=>f.rmsd));
  for(const f of mutation.chainFits)expect(f.rmsd).toBeLessThan(1);
  for(const f of mutation.tetramerFits){expect(f.matched).toBe(574);expect(f.rmsd).toBeLessThan(1);}
 });
 it('16 · the local neighbourhood is measured around β6 in each structure and both contain the site itself',()=>{
  expect(mutation.neighbourhood.radius).toBe(10);
  expect(mutation.neighbourhood.hba).toContain(mutation.hba.residue);
  expect(mutation.neighbourhood.hbs).toContain(mutation.hbs.residue);
  expect(mutation.neighbourhood.hba.length).toBeGreaterThan(5);
  expect(mutation.neighbourhood.hbs.length).toBeGreaterThan(5);
  // Glu has more side-chain heavy atoms than Val; the substitution removes the carboxylate.
  expect(mutation.hba.sideChain.map(i=>hba.structure.atoms[i].name).sort()).toEqual(['CB','CD','CG','OE1','OE2']);
  expect(mutation.hbs.sideChain.map(i=>s.atoms[i].name).sort()).toEqual(['CB','CG1','CG2']);
 });
});

describe('Pathological intermolecular contact',()=>{
 it('17 · donor and acceptor are different molecule instances, inside the deposited asymmetric unit',()=>{
  expect(primary.intermolecular).toBe(true);
  expect(primary.donor.instance).not.toBe(primary.acceptor.instance);
  expect(depositedInstances.map(i=>i.id)).toContain(primary.donor.instance);
  expect(depositedInstances.map(i=>i.id)).toContain(primary.acceptor.instance);
  const donorInstance=hbs.instances.find(i=>i.id===primary.donor.instance)!,acceptorInstance=hbs.instances.find(i=>i.id===primary.acceptor.instance)!;
  expect(donorInstance.assembly).not.toBe(acceptorInstance.assembly);
  expect(donorInstance.cells).toEqual([0,0,0]);expect(acceptorInstance.cells).toEqual([0,0,0]);
  expect(primary.relation).toContain('same deposited asymmetric unit');
  // Discovered from the coordinates: the chains are what the file contains, not a hard-coded pair.
  expect(primary.donor.sourceChain).toBe('H');expect(primary.acceptor.sourceChain).toBe('B');
 });
 it('18 · the donor is βVal6 of a βS chain',()=>{
  expect(primary.donor.resName).toBe(HBS_MUTATION_RESIDUE);
  expect(primary.donor.resSeq).toBe(MUTATION_POSITION);
  expect(hbs.chains.find(c=>c.chain===primary.donor.chain)!.type).toBe('beta');
  expect(primary.donor.key).toBe(`2HBS|${primary.donor.instance}|H:6:VAL`);
  expect(primary.donor.sideChain.map(i=>s.atoms[i].name).sort()).toEqual(['CB','CG1','CG2']);
 });
 it('19 · the acceptor pocket is βAla70 / βPhe85 / βLeu88 of one β chain of the other molecule',()=>{
  expect(core.map(q=>[q.resName,q.resSeq])).toEqual([['ALA',70],['PHE',85],['LEU',88]]);
  expect(POCKET_CORE).toEqual([70,85,88]);
  const acceptor=hbs.chains.find(c=>c.chain===primary.acceptor.chain)!;
  expect(acceptor.type).toBe('beta');
  for(const q of primary.pocket){
   expect(q.chain).toBe(primary.acceptor.chain);
   expect(q.instance).toBe(primary.acceptor.instance);
   expect(q.instance).not.toBe(primary.donor.instance);
  }
  expect(periphery.map(q=>[q.resName,q.resSeq])).toEqual([['THR',84],['ASP',73]]);
 });
 it('20 · measured minimum heavy-atom distances are finite, within the contact criterion and stable',()=>{
  const measured=Object.fromEntries(primary.pocket.map(q=>[`${q.resName}${q.resSeq}`,q.minDistance]));
  for(const [name,d] of Object.entries(measured)){
   expect(Number.isFinite(d)).toBe(true);
   expect(d).toBeGreaterThan(2.5);
   expect(d).toBeLessThanOrEqual(CONTACT_CUTOFF);
   expect(d).toBeCloseTo(measured[name],12);
  }
  expect(measured.ALA70).toBeCloseTo(3.83,2);
  expect(measured.PHE85).toBeCloseTo(3.95,2);
  expect(measured.LEU88).toBeCloseTo(4.18,2);
  expect(measured.THR84).toBeCloseTo(3.62,2);
  expect(measured.ASP73).toBeCloseTo(3.10,2);
  // Each reported distance really is the shortest heavy-atom pair between the two residues.
  for(const q of primary.pocket){
   let best=Infinity;
   for(const i of s.residues[primary.donor.residue].atoms)for(const j of s.residues[q.residue].atoms)best=Math.min(best,dist(s.atoms[i].position,s.atoms[j].position));
   expect(q.minDistance).toBeCloseTo(best,12);
   expect(dist(s.atoms[q.donorAtomIndex].position,s.atoms[q.acceptorAtomIndex].position)).toBeCloseTo(best,12);
  }
 });
 it('21 · the three core pocket contacts are between nonpolar side-chain atoms (carbon to carbon)',()=>{
  for(const q of core){
   expect(q.sideChainDistance).not.toBeNull();
   expect(q.sideChainDistance!).toBeLessThanOrEqual(CONTACT_CUTOFF);
   expect(s.atoms[q.donorAtomIndex].element).toBe('C');
   expect(s.atoms[q.acceptorAtomIndex].element).toBe('C');
   expect(['CB','CG1','CG2']).toContain(q.donorAtom);
  }
  // The polar rim is reported separately and is not presented as part of the nonpolar core.
  expect(periphery.some(q=>s.atoms[q.acceptorAtomIndex].element==='O')).toBe(true);
 });
 it('22 · the βThr4 ↔ βAsp73 secondary polar interaction is measured across the same two molecules',()=>{
  expect(primary.secondary).not.toBeNull();
  const sec=primary.secondary!;
  expect(sec.donorLabel).toBe(`Thr${SECONDARY_DONOR_POSITION}`);
  expect(sec.acceptorLabel).toBe(`Asp${SECONDARY_ACCEPTOR_POSITION}`);
  expect(sec.minDistance).toBeCloseTo(3.11,2);
  expect(s.residues[sec.donorResidue].chain).toBe(primary.donor.chain);
  expect(s.residues[sec.acceptorResidue].chain).toBe(primary.acceptor.chain);
  expect([sec.donorAtom,sec.acceptorAtom]).toEqual(['OG1','OD2']);
 });
 it('23 · in each tetramer exactly one of the two βVal6 is the donor; the other is not in a pocket here',()=>{
  const donors=contacts.filter(c=>depositedInstances.some(i=>i.id===c.donor.instance)).map(c=>c.donor.sourceChain);
  expect(donors.sort()).toEqual(['D','H']);
  expect(model.unengagedDonors.map(u=>u.sourceChain).sort()).toEqual(['B','F']);
  for(const u of model.unengagedDonors)expect(residueAt(hbs.chains.find(c=>c.chain===u.chain)!.chain,MUTATION_POSITION).resName).toBe(HBS_MUTATION_RESIDUE);
  // The two roles are different chains: an acceptor chain here is not also a donor here.
  expect(donors.filter(d=>model.unengagedDonors.some(u=>u.sourceChain===d))).toEqual([]);
 });
 it('24 · no covalent bond is ever inferred between two molecule instances',()=>{
  const instanceOf=new Map(hbs.chains.map(c=>[c.chain,c.instance]));
  const crossing=hbs.bonds.filter(([a,b])=>instanceOf.get(s.atoms[a].chain)!==instanceOf.get(s.atoms[b].chain));
  expect(crossing).toEqual([]);
  expect(hbs.hemeBonds.filter(([a,b])=>instanceOf.get(s.atoms[a].chain)!==instanceOf.get(s.atoms[b].chain))).toEqual([]);
  // Nor between different chains of one molecule: bonds are intra-residue or a peptide bond inside one chain.
  expect(hbs.bonds.filter(([a,b])=>s.atoms[a].chain!==s.atoms[b].chain)).toEqual([]);
  // The contact atoms are close but unbonded: no bond joins the donor Val6 to any pocket residue.
  const donorAtoms=new Set(s.residues[primary.donor.residue].atoms),pocketAtoms=new Set(primary.pocket.flatMap(q=>s.residues[q.residue].atoms));
  expect(hbs.bonds.some(([a,b])=>(donorAtoms.has(a)&&pocketAtoms.has(b))||(donorAtoms.has(b)&&pocketAtoms.has(a)))).toBe(false);
 });
});

describe('Crystal lattice and the repeating segment',()=>{
 it('25 · the crystal frame read from CRYST1/SCALE agrees with the deposited cell and with RCSB',()=>{
  const frame=hbs.crystal;
  expect(frame.spaceGroup).toBe(meta.symmetry.spaceGroup);
  expect(frame.z).toBe(meta.symmetry.z);
  expect(frame.cell).toEqual(meta.symmetry.cell);
  // The SCALE matrix is the authority for the coordinate frame; it must reproduce the CRYST1 cell.
  const [a,b,c]=latticeLengths(frame),[alpha,beta,gamma]=latticeAngles(frame);
  expect(a).toBeCloseTo(frame.cell.a,2);expect(b).toBeCloseTo(frame.cell.b,1);expect(c).toBeCloseTo(frame.cell.c,2);
  expect(alpha).toBeCloseTo(frame.cell.alpha,2);expect(beta).toBeCloseTo(frame.cell.beta,2);expect(gamma).toBeCloseTo(frame.cell.gamma,2);
  // SCALE round-trips exactly, so the lattice vectors are not an approximation of the deposited transform.
  const p=s.atoms[0].position,f=toFractional(frame,p);
  const back=[0,1,2].map(i=>f[0]*frame.lattice[0][i]+f[1]*frame.lattice[1][i]+f[2]*frame.lattice[2][i]) as Vec;
  expect(dist(back,p)).toBeLessThan(1e-9);
  expect(inverseMat3(frame.scale.rotation as Mat3).map(r=>r.map(v=>Number(v.toFixed(6))))).toEqual(
   [0,1,2].map(i=>[0,1,2].map(k=>Number(frame.lattice[k][i].toFixed(6)))));
 });
 it('26 · the repeat is a pure unit-cell translation: identity rotation, exact cell vector, deterministic',()=>{
  for(const instance of hbs.instances){
   expect(instance.transform.rotation).toEqual([[1,0,0],[0,1,0],[0,0,1]]);
   expect(determinant(instance.transform.rotation)).toBe(1);
   const expected=latticeTransform(hbs.crystal,instance.cells);
   expect(instance.transform.translation).toEqual(expected.translation);
   expect(instance.operation).toBe(latticeLabel(instance.cells));
  }
  expect(hbs.instances.find(i=>i.id==='M1')!.transform.translation).toEqual([0,0,0]);
  expect(hbs.instances.find(i=>i.id==='M1+a')!.transform.translation[0]).toBeCloseTo(hbs.crystal.cell.a,2);
  expect(latticeLabel([-1,0,0])).toBe('x−a, y, z');
  expect(latticeTransform(hbs.crystal,[1,0,0]).translation).toEqual(latticeTransform(hbs.crystal,[1,0,0]).translation);
 });
 it('27 · a translated copy preserves every internal distance exactly and reproduces the deposited coordinates at cell 0',()=>{
  const at=(id:string,chain:string)=>hbs.chains.find(c=>c.instance===id&&c.sourceChain===chain)!;
  const depositedChain=at('M1','B'),shifted=at('M1+a','B');
  expect(depositedChain.residues).toHaveLength(shifted.residues.length);
  const shift=hbs.instances.find(i=>i.id==='M1+a')!.transform.translation;
  for(const k of [0,25,70,145]){
   const p=s.residues[depositedChain.residues[k]].atoms,q=s.residues[shifted.residues[k]].atoms;
   expect(p.length).toBe(q.length);
   p.forEach((i,n)=>{
    // Deposited instance = the file's own coordinates, untouched.
    const source=deposited.atoms.find(a=>a.chain==='B'&&a.resSeq===s.residues[depositedChain.residues[k]].resSeq&&a.name===s.atoms[i].name)!;
    expect(s.atoms[i].position).toEqual(source.position);
    [0,1,2].forEach(c=>expect(s.atoms[q[n]].position[c]).toBeCloseTo(s.atoms[i].position[c]+shift[c],9));
   });
  }
  // Internal geometry: a distance inside a copy equals the same distance inside the deposited unit.
  const d1=dist(s.atoms[s.residues[depositedChain.residues[0]].atoms[0]].position,s.atoms[s.residues[depositedChain.residues[100]].atoms[0]].position);
  const d2=dist(s.atoms[s.residues[shifted.residues[0]].atoms[0]].position,s.atoms[s.residues[shifted.residues[100]].atoms[0]].position);
  expect(d2).toBeCloseTo(d1,9);
 });
 it('28 · the contact repeats at every junction of the segment, always between different molecules',()=>{
  expect(contacts.length).toBe(5);
  for(const c of contacts){
   expect(c.intermolecular).toBe(true);
   expect(c.donor.instance).not.toBe(c.acceptor.instance);
   expect(c.donor.resName).toBe(HBS_MUTATION_RESIDUE);
   expect(c.pocket.filter(q=>q.role==='core').map(q=>[q.resName,q.resSeq])).toEqual([['ALA',70],['PHE',85],['LEU',88]]);
   for(const q of c.pocket.filter(q=>q.role==='core'))expect(q.minDistance).toBeLessThanOrEqual(CONTACT_CUTOFF);
  }
  // Translated copies of one contact measure exactly the same distances (a pure translation changes nothing).
  const sameJunction=contacts.filter(c=>c.donor.sourceChain==='H');
  expect(sameJunction).toHaveLength(3);
  const distances=sameJunction.map(c=>c.pocket.map(q=>q.minDistance));
  for(const row of distances)row.forEach((v,k)=>expect(v).toBeCloseTo(distances[0][k],9));
 });
 it('29 · the segment packs without severe overlap and every molecule instance is unique',()=>{
  expect(hbs.instances).toHaveLength(SEGMENT_CELLS.length*2);
  expect(new Set(hbs.instances.map(i=>i.id)).size).toBe(hbs.instances.length);
  expect(new Set(hbs.chains.map(c=>c.chain)).size).toBe(hbs.chains.length);
  expect(model.packing.overlaps).toBe(0);
  expect(model.packing.overlapCutoff).toBe(OVERLAP_CUTOFF);
  expect(model.packing.closest).toBeGreaterThan(OVERLAP_CUTOFF);
  expect(model.packing.closest).toBeLessThan(4);
 });
 it('30 · the βVal6 contact is one of several intermolecular contacts holding the segment together',()=>{
  const {network}=model;
  expect(network.cutoff).toBe(4);
  expect(network.lateral+network.axial).toBe(network.interfaces.length);
  expect(network.lateral).toBeGreaterThan(0);
  // Axial contacts exist between copies of one biomolecule along the repeat and never involve the mutation site.
  expect(network.axial).toBeGreaterThan(0);
  for(const i of network.interfaces.filter(i=>i.kind==='axial'))expect(i.involvesMutation).toBe(false);
  // Exactly the five βVal6 junctions are flagged, and they are all lateral (between the two strands).
  expect(network.involvingMutation).toBe(contacts.length);
  for(const i of network.interfaces.filter(i=>i.involvesMutation))expect(i.kind).toBe('lateral');
  expect(network.interfaces.filter(i=>i.involvesMutation).length).toBeLessThan(network.interfaces.length);
  // Every interface really is between two different molecules.
  for(const i of network.interfaces){
   expect(i.instances[0]).not.toBe(i.instances[1]);
   expect(i.atomPairs).toBeGreaterThan(0);
  }
 });
 it('31 · a shorter segment gives the same deposited-unit contact, so the repeat adds nothing to it',()=>{
  const pairOnly=analyzeSickle(hbsRaw,hbaRaw,[[0,0,0]]);
  expect(pairOnly.hbs.instances).toHaveLength(2);
  expect(pairOnly.contacts).toHaveLength(1);
  expect(pairOnly.primary.donor.sourceChain).toBe(primary.donor.sourceChain);
  expect(pairOnly.primary.acceptor.sourceChain).toBe(primary.acceptor.sourceChain);
  expect(pairOnly.primary.pocket.map(q=>q.minDistance)).toEqual(primary.pocket.map(q=>q.minDistance));
  expect(pairOnly.packing.overlaps).toBe(0);
 });
});

describe('Scene model for the viewer',()=>{
 it('32 · the scene exposes the deposited HbS coordinates and the aligned HbA copy, unmodified',()=>{
  expect(scene.hbs.positions).toHaveLength(s.atoms.length);
  scene.hbs.positions.forEach((p,i)=>expect(p).toEqual(s.atoms[i].position));
  expect(scene.hba.positions).toEqual(mutation.hbaPositions);
  expect(scene.hba.chain).toBe(hba.betaChain);
  expect(scene.hbs.instances.map(i=>i.id)).toEqual(hbs.instances.map(i=>i.id));
  expect(scene.hbs.instances.filter(i=>i.deposited)).toHaveLength(2);
 });
 it('33 · contact guides are the measured distances, one per pocket residue plus the secondary interaction',()=>{
  expect(scene.contact.guides).toHaveLength(primary.pocket.length+1);
  expect(scene.contact.guides.filter(g=>g.kind==='core')).toHaveLength(3);
  expect(scene.contact.guides.filter(g=>g.kind==='secondary')).toHaveLength(1);
  for(const g of scene.contact.guides){
   expect(g.distance).toBeCloseTo(dist(s.atoms[g.a].position,s.atoms[g.b].position),9);
   // Each guide really does cross between the two molecules.
   const instanceOf=(atom:number)=>hbs.chains.find(c=>c.chain===s.atoms[atom].chain)!.instance;
   expect(instanceOf(g.a)).not.toBe(instanceOf(g.b));
  }
  expect(scene.contact.donorInstance).toBe(primary.donor.instance);
  expect(scene.contact.acceptorInstance).toBe(primary.acceptor.instance);
  expect(scene.segmentContacts).toHaveLength(contacts.length);
  for(const c of scene.segmentContacts)expect(c.donorInstance).not.toBe(c.acceptorInstance);
 });
 it('34 · every scene residue has a chemistry class, so the surface view can colour any residue it draws',()=>{
  for(const i of scene.mutation.hbs.neighbourhood)expect(scene.hbs.chemical[i]).toBe(classOf(s.residues[i].resName));
  for(const i of scene.mutation.hba.neighbourhood)expect(scene.hba.chemical[i]).toBe(classOf(hba.structure.residues[i].resName));
  expect(scene.hbs.chemical[primary.donor.residue]).toBe('nonpolar');
  expect(scene.hba.chemical[mutation.hba.residue]).toBe('acidic');
 });
});

describe('Shared utilities stay compatible with the existing modules',()=>{
 it('35 · buildCopies reproduces buildAssembly exactly (the Phase 4A/4B path is unchanged)',()=>{
  const chains=['A','B'],operators=[{rotation:[[1,0,0],[0,1,0],[0,0,1]] as [Vec,Vec,Vec],translation:[0,0,0] as Vec},
   {rotation:[[0,1,0],[1,0,0],[0,0,-1]] as [Vec,Vec,Vec],translation:[0,0,0] as Vec}];
  const source=parseMultiChainPdb(hbaRaw);
  const viaAssembly=buildAssembly(source,chains,operators);
  const viaCopies=buildCopies(source,operators.map((transform,k)=>({id:String(k+1),chains,transform,chainId:(c:string)=>k===0?c:`${c}_${k+1}`})));
  expect(viaAssembly.structure.chains).toEqual(viaCopies.structure.chains);
  expect(viaAssembly.structure.atoms.map(a=>a.position)).toEqual(viaCopies.structure.atoms.map(a=>a.position));
  expect(viaAssembly.structure.residues.map(r=>[r.chain,r.resSeq,r.resName,r.secondary])).toEqual(viaCopies.structure.residues.map(r=>[r.chain,r.resSeq,r.resName,r.secondary]));
  expect(viaAssembly.copies.map(c=>[c.chain,c.source,c.operator])).toEqual(viaCopies.chains.map(c=>[c.chain,c.source,Number(c.copy)]));
  expect(()=>buildCopies(source,[{id:'x',chains,transform:operators[0],chainId:()=>'same'}])).toThrow(/Duplicate copy chain ID/);
 });
 it('36 · the deposited 2HBS interfaces place the contact between two tetramers, not inside one',()=>{
  const interfaces=interfaceContacts(deposited);
  const inter=interfaces.pairs.filter(p=>['A','B','C','D'].includes(p.chains[0])!==['A','B','C','D'].includes(p.chains[1]));
  expect(inter.length).toBeGreaterThan(0);
  // The two tetramers touch through β chains, which is where the pathological contact lives.
  expect(inter.map(p=>p.chains.join('-')).sort()).toEqual(['B-G','B-H']);
  expect(inferBonds(deposited).filter(([a,b])=>deposited.atoms[a].chain!==deposited.atoms[b].chain)).toEqual([]);
 });
 it('37 · the analysis rejects a file whose β6 is not Val, so the module can never silently show HbA as HbS',()=>{
  // Position 6 of the chain-B SEQRES (the sixth three-letter code) turned back into the wild-type Glu.
  const notSickle=hbsRaw.replace(/^(SEQRES {3}1 B {2}146 {2}(?:[A-Z]{3} ){5})VAL/m,'$1GLU');
  expect(notSickle).not.toBe(hbsRaw);
  expect(()=>analyzeSickle(notSickle,hbaRaw)).toThrow(/SEQRES position 6/);
  expect(()=>analyzeSickle(hbaRaw,hbaRaw)).toThrow(/HbS validation/);
 });
 it('38 · parseCrystalFrame refuses a file without the records it needs instead of guessing a lattice',()=>{
  expect(()=>parseCrystalFrame(hbsRaw.replace(/^CRYST1.*$/m,''))).toThrow(/no CRYST1/);
  expect(()=>parseCrystalFrame(hbsRaw.replace(/^SCALE3.*$/m,''))).toThrow(/expected 3 SCALE records/);
  expect(()=>inverseMat3([[1,0,0],[0,1,0],[0,0,0]])).toThrow(/singular/);
 });
});
