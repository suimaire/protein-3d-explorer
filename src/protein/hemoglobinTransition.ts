import type {Vec} from '../geometry/vector';
import type {PdbAtom,PdbResidue} from './pdb';
import {applyRigid,determinant,fitRigid,jacobi,type Mat3,type RigidTransform} from './rigid';
import {analyzeHemoglobin,HEMOGLOBIN_SOURCE,SUBUNIT_ORDER,type HemoglobinModel,type HemeSite,type SubunitLabel} from './hemoglobin';
import {INTERFACE_CUTOFF} from './quaternary';

/** T endpoint: the Phase 4A structure, unchanged. */
export const T_SOURCE={...HEMOGLOBIN_SOURCE,stateLabel:'T-like (deoxy)',ligand:'none'} as const;
/**
 * R endpoint: RCSB 2DN1, human oxyhemoglobin A from the same study as 2DN2 (Park et al. 2006), X-ray 1.25 Å.
 * Asymmetric unit = one αβ dimer; biological assembly 1 = that dimer + its copy by the crystallographic 2-fold (BIOMT 2: y, x, −z).
 */
export const R_SOURCE={pdbId:'2DN1',protein:'Hemoglobin A (adult human)',organism:'Homo sapiens',method:'X-ray diffraction',resolution:1.25,
 state:'oxy (O₂ bound to each heme Fe)',stateLabel:'R-like (oxy)',ligand:'O₂',ligandResName:'OXY',
 doi:'10.1016/j.jmb.2006.05.036',citation:'Park et al. (2006) J. Mol. Biol. 360:690–701',sha256:'4251fa525fb3378c87094495d39e449fb2368aad40d94c3ee8f2e61c130e44e1'} as const;
/** Hetero groups declared for 2DN1: OXY = deposited O₂ ligand (checked against Fe); MBN = toluene, a crystallisation-related additive, not displayed. */
export const R_HETERO={OXY:'ligand',MBN:'additive'} as const;

export const analyzeT=(text:string)=>analyzeHemoglobin(text);
export const analyzeR=(text:string)=>analyzeHemoglobin(text,{hetero:R_HETERO});

/** Educational dimers. Reference = α1β1, the tightly packed αβ unit that stays nearly rigid between T and R (see validation). */
export const REFERENCE_DIMER:SubunitLabel[]=['α1','β1'];
export const MOVING_DIMER:SubunitLabel[]=['α2','β2'];

/** Atom identity shared by both endpoints: educational subunit + UniProt position + residue name + atom name (never record index or chain letter). */
export const atomKey=(label:SubunitLabel,position:number,resName:string,atomName:string)=>`${label}:${position}:${resName}:${atomName}`;
export const hemeAtomKey=(label:SubunitLabel,atomName:string)=>`${label}:HEM:${atomName}`;

type Endpoint={model:HemoglobinModel;
 /** Assembly chain → educational label. */ labelOf:Map<string,SubunitLabel>;
 /** UniProt position of a residue (resSeq − DBREF seqBegin + DBREF dbBegin). */ positionOf:(r:PdbResidue)=>number;
 /** Atom key → atom index (polymer + heme). */ keys:Map<string,number>};

function endpoint(model:HemoglobinModel):Endpoint{
 const labelOf=new Map(model.subunits.map(s=>[s.chain,s.label])),sourceOf=new Map(model.subunits.map(s=>[s.chain,s.sourceChain]));
 const positionOf=(r:PdbResidue)=>{const d=model.header.dbref.find(x=>x.chain===sourceOf.get(r.chain)&&x.database==='UNP')!;return r.resSeq-d.seqBegin+d.dbBegin;};
 const keys=new Map<string,number>(),atoms=model.structure.atoms;
 const add=(key:string,i:number)=>{if(keys.has(key))throw new Error(`Duplicate atom identity ${key}`);keys.set(key,i);};
 for(const r of model.structure.residues){const label=labelOf.get(r.chain)!;for(const i of r.atoms)add(atomKey(label,positionOf(r),r.resName,atoms[i].name),i);}
 for(const s of model.subunits)for(const i of model.structure.hetero.find(g=>g.index===s.heme.group)!.atoms)add(hemeAtomKey(s.label,atoms[i].name),i);
 return {model,labelOf,positionOf,keys};
}

export type ChainCorrespondence={label:SubunitLabel;type:'alpha'|'beta';tChain:string;rChain:string;rSourceChain:string;
 /** Residues aligned by UniProt position (identical SEQRES ⇒ ungapped alignment). */ sequenceLength:number;identity:number;
 tModeled:number;rModeled:number;commonResidues:number;tOnly:string[];rOnly:string[];
 /** Residues present in both with at least one atom missing in one endpoint. */ incomplete:{residue:string;tOnlyAtoms:string[];rOnlyAtoms:string[]}[]};

export type Superposition=RigidTransform&{rmsd:number;maxDeviation:number;determinant:number;matched:number};
export type ScrewMotion={
 /** Rotation angle of the best-fit rigid motion, degrees (0…180). */ angle:number;
 /** Unit rotation axis (right-hand rule gives the sense of rotation). */ axis:Vec;
 /** Point on the axis closest to the moving dimer's T centroid. */ axisPoint:Vec;
 /** Translation along the axis (Å). */ screwTranslation:number;
 /** Distance of the T centroid from the axis (Å). */ radius:number};

export type HemeGeometry={label:SubunitLabel;number:number;
 /** Fe – proximal His NE2 (Å). */ feHis:number;proximal:string;
 /** Signed Fe distance from the least-squares plane of the 24 porphyrin macrocycle atoms; + = toward the proximal His. */ feFromPorphyrin:number;
 /** Same, plane of the four pyrrole N atoms. */ feFromPyrroleN:number;
 ligand:{resName:string;feDistance:number;feAtom:string;occupancy:number}|null};

export type ContactComparison={cutoff:number;
 /** Inter-dimer residue pairs (reference-dimer residue | moving-dimer residue), computed on atoms present in both endpoints. */
 t:string[];r:string[];common:string[];lost:string[];gained:string[];
 byPair:Record<string,{t:number;r:number;common:number;lost:number;gained:number}>};

export type TransitionModel={
 t:HemoglobinModel;r:HemoglobinModel;
 correspondence:ChainCorrespondence[];
 /** Common atoms: key, T atom index, R atom index (sorted by key, deterministic). */ common:{key:string;t:number;r:number}[];
 /** R → T frame rigid transform from the reference dimer Cα superposition. */ reference:Superposition;
 /** R coordinates in the T frame (derived at runtime; the deposited R file is unchanged). */ rAligned:Vec[];
 moving:{
  /** Rigid motion taking the T moving dimer onto the aligned R moving dimer (Cα). */ fit:Superposition;screw:ScrewMotion;
  centroidT:Vec;centroidR:Vec;centroidDisplacement:number;
  /** Cα RMSD of the moving dimer without refitting (after reference alignment only). */ rmsdBeforeFit:number};
 /** Control: moving dimer as reference and reference dimer as moving (should give a similar angle). */ reversed:{referenceRmsd:number;angle:number};
 /** Contrast: whole-tetramer best-fit Cα RMSD (hides part of the rearrangement in the fit). */ wholeTetramerRmsd:number;
 perSubunitRmsd:Record<SubunitLabel,number>;
 hemes:{t:HemeGeometry[];r:HemeGeometry[]};
 contacts:ContactComparison;
};

const sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const scale=(a:Vec,s:number):Vec=>[a[0]*s,a[1]*s,a[2]*s];
const add=(a:Vec,b:Vec):Vec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const norm=(a:Vec)=>Math.hypot(a[0],a[1],a[2]);
const mean=(ps:Vec[]):Vec=>scale(ps.reduce(add,[0,0,0]),1/ps.length);
const rms=(a:Vec[],b:Vec[])=>Math.sqrt(a.reduce((s,p,i)=>s+dot(sub(p,b[i]),sub(p,b[i])),0)/a.length);

function superpose(from:Vec[],to:Vec[]):Superposition{
 const f=fitRigid(from,to);
 return {...f,determinant:determinant(f.rotation),matched:from.length};
}

/** Chasles decomposition of x' = R·x + t: rotation angle/axis, axis location and translation along the axis. */
export function screwMotion({rotation:R,translation:t}:RigidTransform,near:Vec):ScrewMotion{
 const trace=R[0][0]+R[1][1]+R[2][2],angle=Math.acos(Math.min(1,Math.max(-1,(trace-1)/2)));
 let axis:Vec=[R[2][1]-R[1][2],R[0][2]-R[2][0],R[1][0]-R[0][1]];
 const len=norm(axis);if(len<1e-12)throw new Error('Rotation too small or 180° to define an axis');
 axis=scale(axis,1/len);
 const along=dot(t,axis),perp=sub(t,scale(axis,along));
 let point=scale(add(perp,scale(cross(axis,perp),1/Math.tan(angle/2))),0.5);
 point=add(point,scale(axis,dot(sub(near,point),axis)));
 return {angle:angle*180/Math.PI,axis,axisPoint:point,screwTranslation:along,radius:norm(sub(sub(near,point),scale(axis,dot(sub(near,point),axis))))};
}

/** Signed distance of `p` from the least-squares plane of `points`; the sign is + on the side of `toward`. */
export function planeDistance(points:Vec[],p:Vec,toward:Vec){
 const c=mean(points),C=[[0,0,0],[0,0,0],[0,0,0]];
 for(const q of points){const d=sub(q,c);for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i][j]+=d[i]*d[j];}
 const {values,vectors}=jacobi(C),k=values.indexOf(Math.min(...values));
 let n:Vec=[vectors[0][k],vectors[1][k],vectors[2][k]];n=scale(n,1/norm(n));
 if(dot(sub(toward,c),n)<0)n=scale(n,-1);
 return dot(sub(p,c),n);
}
/** Porphyrin macrocycle: 4 pyrrole N + 16 pyrrole C + 4 meso C (substituents and Fe excluded). */
export const PORPHYRIN_ATOMS=['NA','NB','NC','ND','C1A','C2A','C3A','C4A','C1B','C2B','C3B','C4B','C1C','C2C','C3C','C4C','C1D','C2D','C3D','C4D','CHA','CHB','CHC','CHD'];

function hemeGeometry(model:HemoglobinModel,positions:Vec[]):HemeGeometry[]{
 const atoms=model.structure.atoms;
 return model.subunits.map(s=>{
  const h:HemeSite=s.heme,group=model.structure.hetero.find(g=>g.index===h.group)!,named=(n:string)=>group.atoms.find(i=>atoms[i].name===n)!;
  const fe=positions[h.iron],his=positions[h.proximal.atom],ring=PORPHYRIN_ATOMS.map(n=>positions[named(n)]);
  const ligand=model.ligands.find(l=>l.heme===h.group);
  return {label:s.label,number:h.number,feHis:norm(sub(fe,his)),proximal:`His${h.proximal.resSeq} ${h.proximal.atomName}`,
   feFromPorphyrin:planeDistance(ring,fe,his),feFromPyrroleN:planeDistance(ring.slice(0,4),fe,his),
   ligand:ligand?{resName:ligand.resName,feDistance:norm(sub(positions[ligand.feAtom],fe)),feAtom:atoms[ligand.feAtom].name,occupancy:ligand.occupancy}:null};
 });
}

/** Residue pairs across the two dimers with any heavy-atom pair ≤ cutoff, using only the given atoms. */
function interDimerContacts(end:Endpoint,positions:Vec[],allowed:Set<number>,cutoff:number){
 const {model,labelOf,positionOf}=end,limit=cutoff*cutoff,out=new Set<string>();
 const residuesOf=(labels:SubunitLabel[])=>model.structure.residues.filter(r=>labels.includes(labelOf.get(r.chain)!)).map(r=>({r,atoms:r.atoms.filter(i=>allowed.has(i))})).filter(x=>x.atoms.length);
 const name=(r:PdbResidue)=>`${labelOf.get(r.chain)}:${positionOf(r)}:${r.resName}`;
 const box=(list:number[])=>{const lo:Vec=[Infinity,Infinity,Infinity],hi:Vec=[-Infinity,-Infinity,-Infinity];for(const i of list)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],positions[i][k]);hi[k]=Math.max(hi[k],positions[i][k]);}return {lo,hi};};
 const ref=residuesOf(REFERENCE_DIMER).map(x=>({...x,...box(x.atoms)})),mov=residuesOf(MOVING_DIMER).map(x=>({...x,...box(x.atoms)}));
 for(const a of ref)for(const b of mov){
  if([0,1,2].some(k=>a.lo[k]-b.hi[k]>cutoff||b.lo[k]-a.hi[k]>cutoff))continue;
  if(a.atoms.some(i=>b.atoms.some(j=>{const d=sub(positions[i],positions[j]);return dot(d,d)<=limit;})))out.add(`${name(a.r)}|${name(b.r)}`);
 }
 return out;
}

/**
 * T ↔ R comparison. Chains correspond by educational label (α1, β1, α2, β2 from each endpoint's own DBREF/contact
 * analysis); residues by UniProt position with identical residue names; atoms by name. The R structure is placed in
 * the T frame by a rigid Cα superposition of the reference αβ dimer only — never a whole-tetramer fit.
 */
export function analyzeTransition(tText:string,rText:string):TransitionModel{
 const t=analyzeT(tText),r=analyzeR(rText),T=endpoint(t),R=endpoint(r),ta=t.structure.atoms,ra=r.structure.atoms;
 const correspondence=SUBUNIT_ORDER.map((label):ChainCorrespondence=>{
  const ts=t.subunits.find(s=>s.label===label)!,rs=r.subunits.find(s=>s.label===label)!;
  if(ts.type!==rs.type||ts.uniprot!==rs.uniprot)throw new Error(`T/R ${label} globin types differ`);
  const tSeq=t.header.seqres.get(ts.sourceChain)!,rSeq=r.header.seqres.get(rs.sourceChain)!;
  if(tSeq.length!==rSeq.length)throw new Error(`T/R ${label} sequence lengths differ`);
  const identity=tSeq.filter((x,i)=>x===rSeq[i]).length/tSeq.length;
  const resOf=(end:Endpoint,chain:string)=>new Map(end.model.structure.residues.filter(x=>x.chain===chain).map(x=>[end.positionOf(x),x]));
  const tr=resOf(T,ts.chain),rr=resOf(R,rs.chain),incomplete:ChainCorrespondence['incomplete']=[];
  let commonResidues=0;
  for(const [pos,x] of tr){const y=rr.get(pos);if(!y)continue;if(y.resName!==x.resName)throw new Error(`T/R ${label} ${pos} residue names differ`);commonResidues++;
   const tn=x.atoms.map(i=>ta[i].name),rn=y.atoms.map(i=>ra[i].name),tOnly=tn.filter(n=>!rn.includes(n)),rOnly=rn.filter(n=>!tn.includes(n));
   if(tOnly.length||rOnly.length)incomplete.push({residue:`${x.resName}${pos}`,tOnlyAtoms:tOnly,rOnlyAtoms:rOnly});}
  const only=(a:Map<number,PdbResidue>,b:Map<number,PdbResidue>)=>[...a].filter(([p])=>!b.has(p)).map(([p,x])=>`${x.resName}${p}`);
  return {label,type:ts.type,tChain:ts.chain,rChain:rs.chain,rSourceChain:rs.sourceChain,sequenceLength:tSeq.length,identity,tModeled:ts.modeledResidues,rModeled:rs.modeledResidues,
   commonResidues,tOnly:only(tr,rr),rOnly:only(rr,tr),incomplete};
 });
 const common=[...T.keys].filter(([k])=>R.keys.has(k)).map(([key,i])=>({key,t:i,r:R.keys.get(key)!})).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 const ca=(labels:SubunitLabel[])=>common.filter(c=>labels.some(l=>c.key.startsWith(`${l}:`))&&c.key.endsWith(':CA')&&!c.key.includes(':HEM:'));
 const refCa=ca(REFERENCE_DIMER),movCa=ca(MOVING_DIMER);
 const reference=superpose(refCa.map(c=>ra[c.r].position),refCa.map(c=>ta[c.t].position));
 const rAligned=ra.map(a=>applyRigid(reference,a.position));
 const tMov=movCa.map(c=>ta[c.t].position),rMov=movCa.map(c=>rAligned[c.r]);
 const fit=superpose(tMov,rMov),centroidT=mean(tMov),centroidR=mean(rMov);
 const screw=screwMotion(fit,centroidT);
 const revRef=superpose(movCa.map(c=>ra[c.r].position),tMov),revAligned=(p:Vec)=>applyRigid(revRef,p);
 const revFit=fitRigid(refCa.map(c=>ta[c.t].position),refCa.map(c=>revAligned(ra[c.r].position)));
 const allCa=ca(SUBUNIT_ORDER),whole=fitRigid(allCa.map(c=>ra[c.r].position),allCa.map(c=>ta[c.t].position));
 const perSubunitRmsd=Object.fromEntries(SUBUNIT_ORDER.map(l=>{const list=ca([l]),f=fitRigid(list.map(c=>ra[c.r].position),list.map(c=>ta[c.t].position));return [l,f.rmsd];})) as Record<SubunitLabel,number>;
 const tPos=ta.map(a=>a.position);
 const commonT=new Set(common.map(c=>c.t)),commonR=new Set(common.map(c=>c.r));
 const tc=interDimerContacts(T,tPos,commonT,INTERFACE_CUTOFF),rc=interDimerContacts(R,rAligned,commonR,INTERFACE_CUTOFF);
 const sorted=(s:Iterable<string>)=>[...s].sort();
 const byPair:ContactComparison['byPair']={};
 const pairOf=(k:string)=>k.split('|').map(x=>x.split(':')[0]).join('–');
 for(const l1 of REFERENCE_DIMER)for(const l2 of MOVING_DIMER)byPair[`${l1}–${l2}`]={t:0,r:0,common:0,lost:0,gained:0};
 for(const k of tc){byPair[pairOf(k)].t++;if(rc.has(k))byPair[pairOf(k)].common++;else byPair[pairOf(k)].lost++;}
 for(const k of rc){byPair[pairOf(k)].r++;if(!tc.has(k))byPair[pairOf(k)].gained++;}
 return {t,r,correspondence,common,reference,rAligned,
  moving:{fit,screw,centroidT,centroidR,centroidDisplacement:norm(sub(centroidR,centroidT)),rmsdBeforeFit:rms(tMov,rMov)},
  reversed:{referenceRmsd:revRef.rmsd,angle:screwMotion(revFit,mean(refCa.map(c=>ta[c.t].position))).angle},
  wholeTetramerRmsd:whole.rmsd,perSubunitRmsd,
  hemes:{t:hemeGeometry(t,tPos),r:hemeGeometry(r,rAligned)},
  contacts:{cutoff:INTERFACE_CUTOFF,t:sorted(tc),r:sorted(rc),common:sorted([...tc].filter(k=>rc.has(k))),lost:sorted([...tc].filter(k=>!rc.has(k))),gained:sorted([...rc].filter(k=>!tc.has(k))),byPair},
 };
}

/**
 * Visual morph between the two experimental endpoints: straight-line interpolation of each common atom,
 * p(f) = (1 − f)·T + f·R_aligned. f = 0 returns the T coordinates and f = 1 the aligned R coordinates exactly.
 * Not a molecular pathway, trajectory or kinetics.
 */
export function morphPositions(model:Pick<TransitionModel,'t'|'rAligned'|'common'>,fraction:number):Vec[]{
 const ta=model.t.structure.atoms;
 return interpolatePositions(model.common.map(c=>ta[c.t].position),model.common.map(c=>model.rAligned[c.r]),fraction);
}
/** Pairwise straight-line interpolation; endpoints are returned exactly (copies). */
export function interpolatePositions(from:Vec[],to:Vec[],fraction:number):Vec[]{
 if(!(fraction>=0&&fraction<=1))throw new Error('Morph fraction must be within 0…1');
 if(from.length!==to.length)throw new Error('Morph endpoints need the same atoms');
 return from.map((a,k)=>{
  const b=to[k];
  if(fraction===0)return [a[0],a[1],a[2]];
  if(fraction===1)return [b[0],b[1],b[2]];
  return [a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction,a[2]+(b[2]-a[2])*fraction];
 });
}

/** One drawable structure for the scene: atom metadata, residues/hemes as atom-index lists into `atoms`, and bonds. */
export type TransitionLayer={
 atoms:PdbAtom[];residues:PdbResidue[];
 /** Assembly chain → educational label. */ labelOf:Record<string,SubunitLabel>;
 hemes:{label:SubunitLabel;number:number;atoms:number[];iron:number;proximalSide:number[];proximalAtom:number}[];
 ligands:{label:SubunitLabel;resName:string;atoms:number[]}[];
 hemeBonds:[number,number][];polymerBonds:[number,number][];
 /** Residue indices in an inter-dimer contact (≤ 4.0 Å, atoms common to both endpoints). */ interfaceResidues:Set<number>};
export type TransitionSceneModel={
 t:TransitionLayer&{positions:Vec[]};r:TransitionLayer&{positions:Vec[]};
 /** Common-atom layer; positions come from `morphPositions`. */ morph:TransitionLayer&{tPositions:Vec[];rPositions:Vec[]};
 guide:{axis:Vec;axisPoint:Vec;angle:number;screwTranslation:number;centroidT:Vec;centroidR:Vec};
 reference:SubunitLabel[];moving:SubunitLabel[];
};

function layerOf(model:HemoglobinModel,contacts:string[],keep?:(atom:number)=>number):TransitionLayer{
 const end=endpoint(model),map=keep??((i:number)=>i),{structure}=model,atoms=structure.atoms;
 const residues:PdbResidue[]=[];
 const residueName=(r:PdbResidue)=>`${end.labelOf.get(r.chain)}:${end.positionOf(r)}:${r.resName}`;
 const contactNames=new Set(contacts.flatMap(k=>k.split('|'))),interfaceResidues=new Set<number>();
 for(const r of structure.residues){
  const list=r.atoms.map(map).filter(i=>i>=0);if(!list.length)continue;
  const copy={...r,index:residues.length,atoms:list};residues.push(copy);
  if(contactNames.has(residueName(r)))interfaceResidues.add(copy.index);
 }
 const ownerBonds=(bonds:[number,number][])=>bonds.map(([a,b]):[number,number]=>[map(a),map(b)]).filter(([a,b])=>a>=0&&b>=0);
 const side=(res:PdbResidue)=>res.atoms.filter(i=>!['N','C','O','OXT'].includes(atoms[i].name)).map(map).filter(i=>i>=0);
 return {atoms:[],residues,labelOf:Object.fromEntries(end.labelOf),interfaceResidues,
  hemes:model.subunits.map(s=>({label:s.label,number:s.heme.number,atoms:structure.hetero.find(g=>g.index===s.heme.group)!.atoms.map(map).filter(i=>i>=0),iron:map(s.heme.iron),
   proximalSide:side(structure.residues[s.heme.proximal.residue]),proximalAtom:map(s.heme.proximal.atom)})),
  ligands:keep?[]:model.ligands.map(l=>({label:end.labelOf.get(model.hemes.find(h=>h.group===l.heme)!.association.chain)!,resName:l.resName,atoms:l.atoms})),
  hemeBonds:ownerBonds(model.hemeBonds),polymerBonds:ownerBonds(model.bonds)};
}

/** Scene data: T (deposited), R (rigidly aligned copy), and the common-atom morph layer with its two endpoint coordinate sets. */
export function transitionSceneModel(m:TransitionModel):TransitionSceneModel{
 const tLayer=layerOf(m.t,m.contacts.t),rLayer=layerOf(m.r,m.contacts.r);
 const index=new Int32Array(m.t.structure.atoms.length).fill(-1);m.common.forEach((c,k)=>{index[c.t]=k;});
 // Morph atoms keep T residue order; each common atom's index in `m.common` is its morph index.
 const morph=layerOf(m.t,m.contacts.common,i=>index[i]);
 return {
  t:{...tLayer,atoms:m.t.structure.atoms,positions:m.t.structure.atoms.map(a=>a.position)},
  r:{...rLayer,atoms:m.r.structure.atoms,positions:m.rAligned},
  morph:{...morph,atoms:m.common.map(c=>m.t.structure.atoms[c.t]),tPositions:morphPositions(m,0),rPositions:morphPositions(m,1)},
  guide:{axis:m.moving.screw.axis,axisPoint:m.moving.screw.axisPoint,angle:m.moving.screw.angle,screwTranslation:m.moving.screw.screwTranslation,centroidT:m.moving.centroidT,centroidR:m.moving.centroidR},
  reference:REFERENCE_DIMER,moving:MOVING_DIMER,
 };
}

export type {Mat3,PdbAtom};
