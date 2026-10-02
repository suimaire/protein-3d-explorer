import {parsePdb,residueKey,type ProteinStructure} from './pdb';
/** Opt-in residue-level alternate selection. Existing PDB parser behaviour is unchanged. */
export function parseCoherentPdb(text:string,chain='A'){
 const lines=text.split(/\r?\n/),groups=new Map<string,Map<string,number[]>>();
 for(const l of lines){
  if(!l.startsWith('ATOM  ')||l[21]!==chain||!l[16].trim()||['H','D'].includes(l.slice(76,78).trim()))continue;
  const key=l.slice(17,27),alternates=groups.get(key)??new Map<string,number[]>(),alt=l[16];
  alternates.set(alt,[...(alternates.get(alt)??[]),Number(l.slice(54,60))]);groups.set(key,alternates);
 }
 const choices=new Map([...groups].map(([key,alts])=>[key,[...alts].sort(([a,x],[b,y])=>y.reduce((a,b)=>a+b,0)/y.length-x.reduce((a,b)=>a+b,0)/x.length||a.localeCompare(b))[0][0]]));
 let excluded=0;
 const filtered=lines.filter(l=>{
  if(!l.startsWith('ATOM  ')||l[21]!==chain||!l[16].trim())return true;
  const keep=l[16]===choices.get(l.slice(17,27));if(!keep)excluded++;return keep;
 }).join('\n');
 const structure=parsePdb(filtered,chain);structure.omitted.alternateLocations+=excluded;
 for(const r of structure.residues){
  const alts=new Set(r.atoms.map(i=>structure.atoms[i].altLoc).filter(Boolean));
  if(alts.size>1)throw new Error('Mixed alternate conformers: '+residueKey(r));
 }
 return {structure,alternateChoices:[...choices].map(([residue,altLoc])=>({residue:residue.trim(),altLoc})),excludedAlternateRecords:excluded};
}
export function requireResidue(s:ProteinStructure,chain:string,resSeq:number,resName:string,insertionCode=''){
 const hits=s.residues.filter(r=>r.chain===chain&&r.resSeq===resSeq&&r.insertionCode===insertionCode&&r.resName===resName);
 if(hits.length!==1)throw new Error(`Expected exactly one ${chain}:${resSeq}${insertionCode}:${resName}`);
 return hits[0];
}
