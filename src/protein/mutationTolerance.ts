import {parsePdb,parsePdbHeader,type ProteinStructure,type PdbResidue} from './pdb';
import {fitRigid,applyRigid,determinant} from './rigid';
import {inferBonds} from './exposure';

// Verified against RCSB _pdbx_poly_seq_scheme, not an index/offset calculation.
export const TEM1_SITES={
 a36:{chain:'A',resSeq:36,insertionCode:'',labelSeqId:11,wt:'ALA',mutant:'ALA'},
 s70:{chain:'A',resSeq:70,insertionCode:'',labelSeqId:45,wt:'SER',mutant:'SER'},
 k73:{chain:'A',resSeq:73,insertionCode:'',labelSeqId:48,wt:'LYS',mutant:'LYS'},
 s130:{chain:'A',resSeq:130,insertionCode:'',labelSeqId:105,wt:'SER',mutant:'SER'},
 e166:{chain:'A',resSeq:166,insertionCode:'',labelSeqId:141,wt:'GLU',mutant:'GLU'},
 k234:{chain:'A',resSeq:234,insertionCode:'',labelSeqId:209,wt:'LYS',mutant:'LYS'},
 e63:{chain:'A',resSeq:63,insertionCode:'',labelSeqId:38,wt:'GLU',mutant:'GLU'},
 e64:{chain:'A',resSeq:64,insertionCode:'',labelSeqId:39,wt:'GLU',mutant:'GLU'},
 p183:{chain:'A',resSeq:183,insertionCode:'',labelSeqId:158,wt:'PRO',mutant:'PRO'},
 v184:{chain:'A',resSeq:184,insertionCode:'',labelSeqId:159,wt:'VAL',mutant:'ALA'},
 a185:{chain:'A',resSeq:185,insertionCode:'',labelSeqId:160,wt:'ALA',mutant:'ALA'},
 m182:{chain:'A',resSeq:182,insertionCode:'',labelSeqId:157,wt:'MET',mutant:'THR'},
} as const;
export const EXPERIMENT_SOURCE={
 title:'Jacquier et al. (2013) · Table 2',
 url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC3740883/#t02',
 doi:'10.1073/pnas.1215206110',verified:'2026-09-29',
 activity:'Vi/[E₀] at 37°C',activityUnit:'s⁻¹',micUnit:'mg/L',
 // Table 2 reports ± values without identifying their statistic in the table; retain the notation.
};
export const EXPERIMENTS={
 WT:{activity:142,error:2,mic:500,tm:49.5},
 M182T:{activity:145,error:15,mic:500,tm:57},
 A36D:{activity:0.14,error:0.01,mic:12.5},
} as const;
export const TEM1_SOURCES=[
 {id:'1BTL',chain:'A',method:'X-RAY DIFFRACTION',resolution:1.8,acquired:'2026-09-29',sha256:'159d593a4b6fd7646037c221f937fd8488e9b888067ae7dcd0826122e138af09',source:'https://files.rcsb.org/download/1BTL.pdb'},
 {id:'1JWP',chain:'A',method:'X-RAY DIFFRACTION',resolution:1.75,acquired:'2026-09-29',sha256:'2be02eaa2607116d08b23008575e5ac420f8e375a34836321f279eff4b9a1e14',source:'https://files.rcsb.org/download/1JWP.pdb'},
] as const;
export function tem1Site(structure:ProteinStructure,key:keyof typeof TEM1_SITES,mutant=false){
 const spec=TEM1_SITES[key],matches=structure.residues.filter(r=>r.chain===spec.chain&&r.resSeq===spec.resSeq&&r.insertionCode===spec.insertionCode);
 if(matches.length!==1||matches[0].resName!==(mutant?spec.mutant:spec.wt))throw new Error('TEM-1 residue mapping failed: '+key);
 return matches[0];
}
const identity=(r:PdbResidue)=>r.chain+':'+r.resSeq+':'+r.insertionCode;
/** Correspondence by verified author IDs, allowing all three verified deposited sequence differences (84, 182, 184). Missing Cα pairs are omitted explicitly. */
export const DEPOSITED_DIFFERENCES=[{resSeq:84,wt:'ILE',mutant:'VAL'},{resSeq:182,wt:'MET',mutant:'THR'},{resSeq:184,wt:'VAL',mutant:'ALA'}] as const;
export function commonCalphas(wt:ProteinStructure,mutant:ProteinStructure){
 const index=new Map(mutant.residues.map(r=>[identity(r),r]));
 if(index.size!==mutant.residues.length||new Set(wt.residues.map(identity)).size!==wt.residues.length)throw new Error('Duplicate residue identifier');
 return wt.residues.flatMap(r=>{
  const m=index.get(identity(r));if(!m)return [];
  if(r.resName!==m.resName&&!DEPOSITED_DIFFERENCES.some(d=>r.resSeq===d.resSeq&&r.resName===d.wt&&m.resName===d.mutant))throw new Error('Unexpected sequence mismatch');
  const a=r.atoms.find(i=>wt.atoms[i].name==='CA'),b=m.atoms.find(i=>mutant.atoms[i].name==='CA');
  if(a===undefined||b===undefined)return [];
  return [{key:identity(r),wtAtom:a,mutantAtom:b}];
 });
}
export function analyzeMutation(wtText:string,mutantText:string){
 const wt=parsePdb(wtText,'A'),mutant=parsePdb(mutantText,'A');
 for(const s of [wt,mutant]){
  if(!s.residues.length||s.atoms.some(a=>a.position.some(v=>!Number.isFinite(v))))throw new Error('Invalid TEM-1 coordinates');
 }
 for(const k of Object.keys(TEM1_SITES) as (keyof typeof TEM1_SITES)[]){tem1Site(wt,k);tem1Site(mutant,k,true);}
 const pairs=commonCalphas(wt,mutant),alignment=fitRigid(pairs.map(p=>mutant.atoms[p.mutantAtom].position),pairs.map(p=>wt.atoms[p.wtAtom].position));
 if(!Number.isFinite(alignment.rmsd)||Math.abs(determinant(alignment.rotation)-1)>1e-8)throw new Error('Invalid proper alignment');
 const aligned:ProteinStructure={...mutant,atoms:mutant.atoms.map(a=>({...a,position:applyRigid(alignment,a.position)}))};
 return {wt,mutant,aligned,pairs,alignment,wtBonds:inferBonds(wt),mutantBonds:inferBonds(aligned),
  headers:[parsePdbHeader(wtText),parsePdbHeader(mutantText)],unmatched:{wt:wt.residues.length-pairs.length,mutant:mutant.residues.length-pairs.length}};
}
export type MutationModel=ReturnType<typeof analyzeMutation>;
