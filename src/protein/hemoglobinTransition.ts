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

export type SubunitFit={matched:number;rmsd:number};
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
 /** Each chain fitted on its own (T vs aligned R, matched Cα only): fold change of the subunit itself. */ subunitFits:Record<SubunitLabel,SubunitFit>;
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

type CommonAtom={key:string;t:number;r:number};
/** Matched Cα pairs of the given subunits, selected by atom key (label + UniProt position), never by array index. */
const commonCa=(common:CommonAtom[],labels:SubunitLabel[])=>common.filter(c=>labels.some(l=>c.key.startsWith(`${l}:`))&&c.key.endsWith(':CA')&&!c.key.includes(':HEM:'));

/**
 * Frame-dependent inputs → frame-independent comparison: reference-dimer superposition of R onto T, the rigid motion of
 * the moving dimer relative to it, and an independent Cα fit of every chain. `tPositions` / `rPositions` are full atom
 * coordinate arrays of each endpoint; only matched Cα enter the fits.
 */
export function quaternaryMetrics(common:CommonAtom[],tPositions:Vec[],rPositions:Vec[]){
 const refCa=commonCa(common,REFERENCE_DIMER),movCa=commonCa(common,MOVING_DIMER);
 const reference=superpose(refCa.map(c=>rPositions[c.r]),refCa.map(c=>tPositions[c.t]));
 const rAligned=rPositions.map(p=>applyRigid(reference,p));
 const tMov=movCa.map(c=>tPositions[c.t]),rMov=movCa.map(c=>rAligned[c.r]);
 const fit=superpose(tMov,rMov),centroidT=mean(tMov),centroidR=mean(rMov);
 const subunitFits=Object.fromEntries(SUBUNIT_ORDER.map(l=>{const list=commonCa(common,[l]);return [l,{matched:list.length,rmsd:fitRigid(list.map(c=>tPositions[c.t]),list.map(c=>rAligned[c.r])).rmsd}];})) as Record<SubunitLabel,SubunitFit>;
 return {reference,rAligned,subunitFits,
  moving:{fit,screw:screwMotion(fit,centroidT),centroidT,centroidR,centroidDisplacement:norm(sub(centroidR,centroidT)),rmsdBeforeFit:rms(tMov,rMov)}};
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
 const {reference,rAligned,moving,subunitFits}=quaternaryMetrics(common,ta.map(a=>a.position),ra.map(a=>a.position));
 const refCa=commonCa(common,REFERENCE_DIMER),movCa=commonCa(common,MOVING_DIMER),tMov=movCa.map(c=>ta[c.t].position);
 const revRef=superpose(movCa.map(c=>ra[c.r].position),tMov),revAligned=(p:Vec)=>applyRigid(revRef,p);
 const revFit=fitRigid(refCa.map(c=>ta[c.t].position),refCa.map(c=>revAligned(ra[c.r].position)));
 const allCa=commonCa(common,SUBUNIT_ORDER),whole=fitRigid(allCa.map(c=>ra[c.r].position),allCa.map(c=>ta[c.t].position));
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
  moving,
  reversed:{referenceRmsd:revRef.rmsd,angle:screwMotion(revFit,mean(refCa.map(c=>ta[c.t].position))).angle},
  wholeTetramerRmsd:whole.rmsd,subunitFits,
  hemes:{t:hemeGeometry(t,tPos),r:hemeGeometry(r,rAligned)},
  contacts:{cutoff:INTERFACE_CUTOFF,t:sorted(tc),r:sorted(rc),common:sorted([...tc].filter(k=>rc.has(k))),lost:sorted([...tc].filter(k=>!rc.has(k))),gained:sorted([...rc].filter(k=>!tc.has(k))),byPair},
 };
}

export type Quaternion=[number,number,number,number];
/** Unit quaternion [w, x, y, z] (w ≥ 0) of a proper rotation matrix (Shoemake); inverse of the matrix used in `fitRigid`. */
export function quaternionOf(R:Mat3):Quaternion{
 const tr=R[0][0]+R[1][1]+R[2][2];let q:Quaternion;
 if(tr>0){const s=0.5/Math.sqrt(tr+1);q=[0.25/s,(R[2][1]-R[1][2])*s,(R[0][2]-R[2][0])*s,(R[1][0]-R[0][1])*s];}
 else if(R[0][0]>=R[1][1]&&R[0][0]>=R[2][2]){const s=2*Math.sqrt(1+R[0][0]-R[1][1]-R[2][2]);q=[(R[2][1]-R[1][2])/s,s/4,(R[1][0]+R[0][1])/s,(R[0][2]+R[2][0])/s];}
 else if(R[1][1]>=R[2][2]){const s=2*Math.sqrt(1-R[0][0]+R[1][1]-R[2][2]);q=[(R[0][2]-R[2][0])/s,(R[1][0]+R[0][1])/s,s/4,(R[2][1]+R[1][2])/s];}
 else{const s=2*Math.sqrt(1-R[0][0]-R[1][1]+R[2][2]);q=[(R[1][0]-R[0][1])/s,(R[0][2]+R[2][0])/s,(R[2][1]+R[1][2])/s,s/4];}
 const n=Math.hypot(...q),sign=q[0]<0?-1:1;
 return q.map(v=>sign*v/n) as Quaternion;
}
export const quaternionMatrix=([w,x,y,z]:Quaternion):Mat3=>[[w*w+x*x-y*y-z*z,2*(x*y-w*z),2*(x*z+w*y)],[2*(x*y+w*z),w*w-x*x+y*y-z*z,2*(y*z-w*x)],[2*(x*z-w*y),2*(y*z+w*x),w*w-x*x-y*y+z*z]];
/** Spherical linear interpolation between unit quaternions (shortest arc): constant angular speed about one fixed axis. */
export function slerp(a:Quaternion,b:Quaternion,f:number):Quaternion{
 let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];const e=d<0?b.map(v=>-v) as Quaternion:b;d=Math.abs(d);
 if(d>1-1e-12)return a.map((v,k)=>v+(e[k]-v)*f) as Quaternion;
 const theta=Math.acos(d),s=Math.sin(theta),wa=Math.sin((1-f)*theta)/s,wb=Math.sin(f*theta)/s;
 return a.map((v,k)=>wa*v+wb*e[k]) as Quaternion;
}

/**
 * Quaternary motion guide: the T-state moving αβ dimer (all its protein atoms and its two hemes) moved as ONE rigid body
 * by the calculated T → R relative motion (`moving.fit`), with the reference dimer fixed. The guide endpoint is the T dimer
 * after that rigid motion — not the experimental R coordinates (R also differs by small tertiary changes). Not a pathway.
 */
export type RigidGuide={
 /** T atom indices that move (moving-dimer polymer atoms + its heme atoms), ascending. */ atoms:number[];
 /** Full calculated motion (guide at 100 %). */ fit:RigidTransform;
 /** Rotation of `fit` as a unit quaternion. */ quaternion:Quaternion;
 /** Rotation pivot = moving-dimer Cα centroid in T; the centroid travels in a straight line by `displacement`. */ pivot:Vec;displacement:Vec};

export function rigidGuide(m:Pick<TransitionModel,'t'|'moving'>):RigidGuide{
 const {structure}=m.t,atoms:number[]=[];
 for(const s of m.t.subunits)if(MOVING_DIMER.includes(s.label)){
  for(const i of s.residues)atoms.push(...structure.residues[i].atoms);
  atoms.push(...structure.hetero.find(g=>g.index===s.heme.group)!.atoms);
 }
 const {fit,centroidT,centroidR}=m.moving;
 return {atoms:atoms.sort((a,b)=>a-b),fit:{rotation:fit.rotation,translation:fit.translation},quaternion:quaternionOf(fit.rotation),pivot:centroidT,displacement:sub(centroidR,centroidT)};
}

/**
 * Rigid transform of the guide at fraction f: rotation SLERP(identity → q, f) about the pivot, pivot moved by f·displacement.
 * f = 0 is the identity and f = 1 is exactly the calculated fit (x' = R·x + t, since R·pivot + t = pivot + displacement).
 */
export function guidePose(guide:RigidGuide,fraction:number):RigidTransform{
 if(!(fraction>=0&&fraction<=1))throw new Error('Guide fraction must be within 0…1');
 if(fraction===0)return {rotation:[[1,0,0],[0,1,0],[0,0,1]],translation:[0,0,0]};
 if(fraction===1)return guide.fit;
 const rotation=quaternionMatrix(slerp([1,0,0,0],guide.quaternion,fraction)),c=guide.pivot;
 return {rotation,translation:sub(add(c,scale(guide.displacement,fraction)),applyRigid({rotation,translation:[0,0,0]},c))};
}
/** T coordinates with only the guide atoms moved by `guidePose`; every other atom (reference dimer) is an unchanged copy. */
export function guidePositions(tPositions:Vec[],guide:RigidGuide,fraction:number):Vec[]{
 const pose=guidePose(guide,fraction),out=tPositions.map(p=>[p[0],p[1],p[2]] as Vec);
 if(fraction>0)for(const i of guide.atoms)out[i]=applyRigid(pose,tPositions[i]);
 return out;
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
 /** Quaternary motion guide on the T layer; positions come from `guidePositions(t.positions, motion, f)`. */ motion:RigidGuide;
 guide:{axis:Vec;axisPoint:Vec;angle:number;screwTranslation:number;centroidT:Vec;centroidR:Vec};
 reference:SubunitLabel[];moving:SubunitLabel[];
};

function layerOf(model:HemoglobinModel,contacts:string[]):TransitionLayer{
 const end=endpoint(model),{structure}=model,atoms=structure.atoms;
 const residueName=(r:PdbResidue)=>`${end.labelOf.get(r.chain)}:${end.positionOf(r)}:${r.resName}`;
 const contactNames=new Set(contacts.flatMap(k=>k.split('|')));
 const residues=structure.residues.map((r,index)=>({...r,index}));
 const interfaceResidues=new Set(residues.filter(r=>contactNames.has(residueName(r))).map(r=>r.index));
 const side=(res:PdbResidue)=>res.atoms.filter(i=>!['N','C','O','OXT'].includes(atoms[i].name));
 return {atoms:[],residues,labelOf:Object.fromEntries(end.labelOf),interfaceResidues,
  hemes:model.subunits.map(s=>({label:s.label,number:s.heme.number,atoms:structure.hetero.find(g=>g.index===s.heme.group)!.atoms,iron:s.heme.iron,
   proximalSide:side(structure.residues[s.heme.proximal.residue]),proximalAtom:s.heme.proximal.atom})),
  ligands:model.ligands.map(l=>({label:end.labelOf.get(model.hemes.find(h=>h.group===l.heme)!.association.chain)!,resName:l.resName,atoms:l.atoms})),
  hemeBonds:model.hemeBonds,polymerBonds:model.bonds};
}

/** Scene data: T (deposited), R (rigidly aligned copy), and the rigid-body motion guide applied to the T layer. */
export function transitionSceneModel(m:TransitionModel):TransitionSceneModel{
 const tLayer=layerOf(m.t,m.contacts.t),rLayer=layerOf(m.r,m.contacts.r);
 return {
  t:{...tLayer,atoms:m.t.structure.atoms,positions:m.t.structure.atoms.map(a=>a.position)},
  r:{...rLayer,atoms:m.r.structure.atoms,positions:m.rAligned},
  motion:rigidGuide(m),
  guide:{axis:m.moving.screw.axis,axisPoint:m.moving.screw.axisPoint,angle:m.moving.screw.angle,screwTranslation:m.moving.screw.screwTranslation,centroidT:m.moving.centroidT,centroidR:m.moving.centroidR},
  reference:REFERENCE_DIMER,moving:MOVING_DIMER,
 };
}

export type {Mat3,PdbAtom};
