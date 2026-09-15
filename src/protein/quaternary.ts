import type {Vec} from '../geometry/vector';
import type {MultiChainStructure,PdbAtom,PdbResidue} from './pdb';

/**
 * Interface criterion: a polymer residue is an interface residue when any of its heavy atoms lies within
 * 4.0 Å of a heavy atom of a different polymer chain. A purely geometric contact criterion (a common choice
 * for atom-contact interface definitions); it does not identify the kind of noncovalent interaction.
 */
export const INTERFACE_CUTOFF=4.0;
/** Hetero-group association: polymer heavy atoms within 4.5 Å of any atom of the group, counted per chain. */
export const ASSOCIATION_CUTOFF=4.5;

const d2=(a:Vec,b:Vec)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;

/** Uniform spatial hash over the given atom indices; `near` lists candidates within one cell of a point. */
function grid(atoms:PdbAtom[],indices:number[],cell:number){
 const cells=new Map<string,number[]>(),of=(p:Vec)=>p.map(v=>Math.floor(v/cell));
 for(const i of indices){const k=of(atoms[i].position).join(',');const list=cells.get(k);if(list)list.push(i);else cells.set(k,[i]);}
 return (p:Vec)=>{
  const [x,y,z]=of(p),out:number[]=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of cells.get(`${x+dx},${y+dy},${z+dz}`)??[])out.push(j);
  return out;
 };
}
/** Polymer atom → residue index. */
export function residueOfAtoms(structure:Pick<MultiChainStructure,'atoms'|'residues'|'hetero'>){
 const map=new Int32Array(structure.atoms.length).fill(-1);
 for(const r of [...structure.residues,...structure.hetero])for(const i of r.atoms)map[i]=r.index;
 return map;
}

export type ChainPairContact={chains:[string,string];residues:[number[],number[]];atomPairs:number};
export type InterfaceAnalysis={cutoff:number;
 /** Interface residue index → partner chain IDs (sorted). */ partners:Map<number,string[]>;
 /** One entry per chain pair that has at least one contact, sorted by chain IDs; residue lists sorted by index. */ pairs:ChainPairContact[]};

/** Inter-chain contacts from the coordinates (polymer heavy atoms only; hetero groups and waters excluded). */
export function interfaceContacts(structure:MultiChainStructure,cutoff=INTERFACE_CUTOFF):InterfaceAnalysis{
 const polymer=structure.residues.flatMap(r=>r.atoms),residueOf=residueOfAtoms(structure),near=grid(structure.atoms,polymer,cutoff),limit=cutoff*cutoff;
 const pairMap=new Map<string,{residues:[Set<number>,Set<number>];atomPairs:number}>(),partners=new Map<number,Set<string>>();
 for(const i of polymer){
  const a=structure.atoms[i];
  for(const j of near(a.position)){
   const b=structure.atoms[j];
   if(j<=i||a.chain===b.chain||d2(a.position,b.position)>limit)continue;
   const [first,second,ri,rj]=a.chain<b.chain?[a.chain,b.chain,residueOf[i],residueOf[j]]:[b.chain,a.chain,residueOf[j],residueOf[i]];
   const key=`${first}-${second}`;let entry=pairMap.get(key);
   if(!entry){entry={residues:[new Set(),new Set()],atomPairs:0};pairMap.set(key,entry);}
   entry.residues[0].add(ri);entry.residues[1].add(rj);entry.atomPairs++;
   for(const [r,partner] of [[residueOf[i],b.chain],[residueOf[j],a.chain]] as const){let s=partners.get(r);if(!s)partners.set(r,s=new Set());s.add(partner);}
  }
 }
 const sort=(s:Set<number>)=>[...s].sort((x,y)=>x-y);
 const pairs=[...pairMap.entries()].sort(([x],[y])=>x<y?-1:x>y?1:0).map(([key,e]):ChainPairContact=>({chains:key.split('-') as [string,string],residues:[sort(e.residues[0]),sort(e.residues[1])],atomPairs:e.atomPairs}));
 return {cutoff,partners:new Map([...partners.entries()].sort(([x],[y])=>x-y).map(([r,s])=>[r,[...s].sort()])),pairs};
}
export const pairBetween=(analysis:InterfaceAnalysis,a:string,b:string)=>analysis.pairs.find(p=>(p.chains[0]===a&&p.chains[1]===b)||(p.chains[0]===b&&p.chains[1]===a))??null;

export type HeteroAssociation={group:number;
 /** Polymer heavy atoms within the cutoff of the group, per chain. */ contacts:Record<string,number>;
 /** Shortest group–chain heavy-atom distance per chain, Å. */ minDistance:Record<string,number>;
 /** Chain with the most contacts (ties: shorter minimum distance). */ chain:string};

/** Assigns a hetero group to the polymer chain that surrounds it, from coordinates only (never record order or chain ID). */
export function associateHetero(structure:MultiChainStructure,group:PdbResidue,cutoff=ASSOCIATION_CUTOFF):HeteroAssociation{
 const contacts:Record<string,number>={},minDistance:Record<string,number>={};
 for(const chain of structure.chains){contacts[chain]=0;minDistance[chain]=Infinity;}
 for(const r of structure.residues)for(const i of r.atoms){
  const p=structure.atoms[i].position;let best=Infinity;
  for(const g of group.atoms)best=Math.min(best,d2(p,structure.atoms[g].position));
  const dist=Math.sqrt(best);
  if(dist<=cutoff)contacts[r.chain]++;
  if(dist<minDistance[r.chain])minDistance[r.chain]=dist;
 }
 const chain=[...structure.chains].sort((a,b)=>contacts[b]-contacts[a]||minDistance[a]-minDistance[b])[0];
 return {group:group.index,contacts,minDistance,chain};
}

export type MetalLigand={metal:number;atom:number;residue:number;distance:number};
/** Nearest polymer N/O/S heavy atom to a metal atom (e.g. heme Fe), measured from coordinates. */
export function nearestPolymerLigand(structure:MultiChainStructure,metal:number):MetalLigand{
 const residueOf=residueOfAtoms(structure),m=structure.atoms[metal].position;let best:MetalLigand|null=null;
 for(const r of structure.residues)for(const i of r.atoms){
  const a=structure.atoms[i];if(!['N','O','S'].includes(a.element))continue;
  const dist=Math.sqrt(d2(a.position,m));
  if(!best||dist<best.distance)best={metal,atom:i,residue:residueOf[i],distance:dist};
 }
 if(!best)throw new Error('No polymer ligand atom');
 return best;
}

export type AssemblyOperator={rotation:[Vec,Vec,Vec];translation:Vec};
export type AssemblyCopy={chain:string;source:string;operator:number};
/** Chain ID of an operator copy: operator 1 keeps the deposited ID; operator k > 1 gives `A_k` (a generated symmetry copy of PDB chain A). */
export const copyChainId=(source:string,operator:number)=>operator===1?source:`${source}_${operator}`;

/**
 * Biological assembly from REMARK 350 BIOMT operators: every listed chain (polymer residues and its non-water hetero
 * groups) is copied once per operator, p' = R·p + t. Operator 1 = identity reproduces the deposited coordinates exactly.
 * Copies are rigid (a proper rotation and translation from the file); no coordinate is invented.
 */
export function buildAssembly(structure:MultiChainStructure,chains:string[],operators:AssemblyOperator[]):{structure:MultiChainStructure;copies:AssemblyCopy[]}{
 const atoms:PdbAtom[]=[],residues:PdbResidue[]=[],hetero:PdbResidue[]=[],copies:AssemblyCopy[]=[];
 const apply=({rotation:R,translation:t}:AssemblyOperator,p:Vec):Vec=>[0,1,2].map(i=>R[i][0]*p[0]+R[i][1]*p[1]+R[i][2]*p[2]+t[i]) as Vec;
 const identity=(op:AssemblyOperator)=>op.rotation.every((row,i)=>row.every((v,j)=>v===(i===j?1:0)))&&op.translation.every(v=>v===0);
 const polymerOrder:PdbAtom[][]=[],heteroOrder:{atoms:PdbAtom[];source:PdbResidue}[]=[];
 operators.forEach((op,k)=>{
  const same=identity(op);
  for(const source of structure.chains.filter(c=>chains.includes(c))){
   const chain=copyChainId(source,k+1);copies.push({chain,source,operator:k+1});
   const move=(a:PdbAtom):PdbAtom=>({...a,chain,position:same?a.position:apply(op,a.position)});
   for(const r of structure.residues.filter(r=>r.chain===source))polymerOrder.push(r.atoms.map(i=>move(structure.atoms[i])));
   for(const g of structure.hetero.filter(g=>g.chain===source))heteroOrder.push({atoms:g.atoms.map(i=>move(structure.atoms[i])),source:g});
  }
 });
 for(const list of polymerOrder){
  const r:PdbResidue={index:residues.length,resName:list[0].resName,resSeq:list[0].resSeq,insertionCode:list[0].insertionCode,chain:list[0].chain,atoms:[],occupancy:Math.min(...list.map(a=>a.occupancy)),secondary:'other'};
  const src=structure.residues.find(x=>x.resSeq===r.resSeq&&x.insertionCode===r.insertionCode&&x.resName===r.resName&&copies.find(c=>c.chain===r.chain)!.source===x.chain)!;
  r.secondary=src.secondary;
  for(const a of list){r.atoms.push(atoms.length);atoms.push(a);}
  residues.push(r);
 }
 for(const {atoms:list,source} of heteroOrder){
  const g:PdbResidue={...source,index:residues.length+hetero.length,chain:list[0].chain,atoms:[]};
  for(const a of list){g.atoms.push(atoms.length);atoms.push(a);}
  hetero.push(g);
 }
 return {structure:{id:structure.id,chains:copies.map(c=>c.chain),atoms,residues,hetero,omitted:structure.omitted},copies};
}

/** Mean position of a set of atoms. */
export function centroid(atoms:PdbAtom[],indices:number[]):Vec{
 const s:Vec=[0,0,0];for(const i of indices){const p=atoms[i].position;s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];}
 return [s[0]/indices.length,s[1]/indices.length,s[2]/indices.length];
}

/**
 * Explanatory "exploded" display: each chain is translated (never rotated or deformed) by `distance` Å along the
 * direction from the assembly's polymer centroid to that chain's polymer centroid. Distance 0 = deposited coordinates.
 */
export function explodedOffsets(structure:MultiChainStructure,distance:number):Record<string,Vec>{
 const all=structure.residues.flatMap(r=>r.atoms),center=centroid(structure.atoms,all),offsets:Record<string,Vec>={};
 for(const chain of structure.chains){
  const c=centroid(structure.atoms,structure.residues.filter(r=>r.chain===chain).flatMap(r=>r.atoms)),v:Vec=[c[0]-center[0],c[1]-center[1],c[2]-center[2]],len=Math.hypot(...v);
  offsets[chain]=len===0?[0,0,0]:[v[0]/len*distance,v[1]/len*distance,v[2]/len*distance];
 }
 return offsets;
}
/** Display positions: every atom moved by its owner chain's offset (`owner` maps an atom to a chain ID). */
export function displacedPositions(atoms:PdbAtom[],offsets:Record<string,Vec>,owner:(atom:number)=>string):Vec[]{
 return atoms.map((a,i)=>{const o=offsets[owner(i)]??[0,0,0];return [a.position[0]+o[0],a.position[1]+o[1],a.position[2]+o[2]];});
}
