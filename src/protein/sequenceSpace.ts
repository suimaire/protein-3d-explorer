import {distance} from '../geometry/vector';
import {residueKey,type ProteinStructure,type PdbResidue} from './pdb';

export const residueLabel=(r:PdbResidue)=>`${r.chain || '∅'}:${r.resName[0]}${r.resName.slice(1).toLowerCase()} ${r.resSeq}${r.insertionCode}`;
/**
 * Map coordinate residues to SEQRES positions, not author residue numbers or array offsets.
 * Only an unambiguous order-preserving subsequence is accepted. Gaps remain gaps; ambiguous
 * repeats require an explicit external mapping instead of silently guessing an index.
 */
export function sequencePositions(structure:Pick<ProteinStructure,'residues'>,seqres:Map<string,string[]>){
 const result=new Map<number,number>();
 for(const chain of new Set(structure.residues.map(r=>r.chain))){
  const residues=structure.residues.filter(r=>r.chain===chain),sequence=seqres.get(chain);
  if(!sequence)throw new Error(`Missing SEQRES for chain ${chain}`);
  const n=residues.length,m=sequence.length,ways=Array.from({length:n+1},()=>new Uint8Array(m+1));
  ways[n].fill(1);
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)ways[i][j]=Math.min(2,ways[i][j+1]+(residues[i].resName===sequence[j]?ways[i+1][j+1]:0));
  if(ways[0][0]!==1)throw new Error('Sequence mapping is absent or ambiguous; explicit residue mapping required');
  let j=0;
  for(let i=0;i<n;i++){while(!(residues[i].resName===sequence[j]&&ways[i+1][j+1]))j++;result.set(residues[i].index,j++);}
 }
 return result;
}
export type ResiduePair={a:number;b:number;atomA:number;atomB:number;distance:number;sequenceGap:number|null};
/** Minimum over the actual selected non-H/D coordinates. Tie order is stable in atom order. */
export function measureResidues(s:ProteinStructure,a:number,b:number,positions:Map<number,number>):ResiduePair|null{
 if(a===b)return null;
 const ra=s.residues.find(r=>r.index===a),rb=s.residues.find(r=>r.index===b);
 if(!ra||!rb)return null;
 let best:{atomA:number;atomB:number;distance:number}|null=null;
 for(const i of ra.atoms)for(const j of rb.atoms){
  if(['H','D'].includes(s.atoms[i].element)||['H','D'].includes(s.atoms[j].element))continue;
  const d=distance(s.atoms[i].position,s.atoms[j].position);
  if(!best||d<best.distance)best={atomA:i,atomB:j,distance:d};
 }
 const pa=positions.get(a),pb=positions.get(b);
 return best?{a,b,...best,sequenceGap:ra.chain===rb.chain&&pa!==undefined&&pb!==undefined?Math.abs(pa-pb):null}:null;
}
export const EXAMPLE_CRITERIA={minimumSequenceGap:10,maximumDistance:4.5};
export function sequenceSpaceExamples(s:ProteinStructure,positions:Map<number,number>,count=3){
 const candidates:ResiduePair[]=[];
 for(let i=0;i<s.residues.length;i++)for(let j=i+1;j<s.residues.length;j++){
  const a=s.residues[i],b=s.residues[j];
  if(a.chain!==b.chain||a.occupancy<1||b.occupancy<1)continue;
  if(Math.abs((positions.get(a.index)??0)-(positions.get(b.index)??0))<EXAMPLE_CRITERIA.minimumSequenceGap)continue;
  const p=measureResidues(s,a.index,b.index,positions);
  if(p&&p.distance<=EXAMPLE_CRITERIA.maximumDistance)candidates.push(p);
 }
 // Largest sequence separations first; no reused endpoint and >=3 positions between
 // endpoints of different examples avoids three almost identical neighbouring contacts.
 candidates.sort((a,b)=>b.sequenceGap!-a.sequenceGap!||a.distance-b.distance||a.a-b.a||a.b-b.b);
 const selected:ResiduePair[]=[];
 for(const p of candidates){
  if(selected.some(q=>[p.a,p.b].some(x=>[q.a,q.b].some(y=>s.residues[x].chain===s.residues[y].chain&&Math.abs(positions.get(x)!-positions.get(y)!)<3))))continue;
  selected.push(p);if(selected.length===count)break;
 }
 return selected;
}
export type PairSelection={a:number|null;b:number|null};
export function selectPair(p:PairSelection,target:'a'|'b',value:number|null):PairSelection{
 const other=target==='a'?'b':'a';return {...p,[target]:value,[other]:value!==null&&p[other]===value?null:p[other]};
}
export const atomIdentifier=(s:ProteinStructure,i:number)=>`${residueKey(s.atoms[i])} ${s.atoms[i].name}${s.atoms[i].altLoc?' (alt '+s.atoms[i].altLoc+')':''}`;
