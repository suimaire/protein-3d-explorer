import {parsePdbHeader,isSideChainAtom,type ProteinStructure,type PdbAtom} from './pdb';
import {parseCoherentPdb,requireResidue} from './coherentPdb';
import {applyRigid,type RigidTransform} from './rigid';
import {AQP1_OPM,AQP1_HALF_THICKNESS} from './aqp1Orientation';
import {analyzeExposure,inferBonds} from './exposure';
import {SASA_RADII} from './sasa';
import {distance,type Vec} from '../geometry/vector';
import channel from '../data/aqp1-channel.json';
export const AQP1_NPA=[[78,'ASN'],[79,'PRO'],[80,'ALA'],[194,'ASN'],[195,'PRO'],[196,'ALA']] as const;
export const AQP1_ARR=[[58,'PHE'],[182,'HIS'],[191,'CYS'],[197,'ARG']] as const;
export const AQP1_PARTICLE_RADIUS=channel.particleRadius;
export const AQP1_SLAB={center:0,halfThickness:AQP1_HALF_THICKNESS};
export const aqpInstanceKey=(operator:number,chain:string,resSeq:number,insertionCode='')=>`1J4N|assembly1|op${operator+1}|${chain}:${resSeq}${insertionCode}`;
export const transformAqpPoint=(operator:RigidTransform,p:Vec)=>applyRigid(AQP1_OPM,applyRigid(operator,p));
export const channelPoint=(points:Vec[],t:number):Vec=>{
 const u=Math.max(0,Math.min(1,t))*(points.length-1),i=Math.min(points.length-2,Math.floor(u)),f=u-i;
 return points[i].map((x,k)=>x+(points[i+1][k]-x)*f) as Vec;
};
/** Clearance of a point from protein vdW spheres; educational collision audit, not a water radius. */
export function channelClearance(atoms:PdbAtom[],p:Vec){let nearest=Infinity;for(const a of atoms)nearest=Math.min(nearest,distance(a.position,p)-SASA_RADII[a.element]);return nearest;}
const mean=(ps:Vec[])=>ps.reduce<Vec>((m,p)=>m.map((v,k)=>v+p[k]/ps.length) as Vec,[0,0,0]);
export function analyzeAquaporin(text:string){
 const parsed=parseCoherentPdb(text),source=parsed.structure,header=parsePdbHeader(text);
 if(source.id!=='1J4N'||!text.includes('BOS TAURUS')||header.resolution!==2.2||header.method!=='X-RAY DIFFRACTION')throw new Error('Unexpected AQP1 source');
 const assembly=header.assemblies.find(a=>a.id===1);
 if(!assembly||assembly.author!=='TETRAMERIC'||assembly.operators.length!==4||assembly.chains.join(',')!=='A')throw new Error('Expected author-assigned 1J4N tetramer');
 const npa=AQP1_NPA.map(([n,name])=>requireResidue(source,'A',n,name).index),arr=AQP1_ARR.map(([n,name])=>requireResidue(source,'A',n,name).index);
 const waterRecords=text.split(/\r?\n/).filter(l=>l.startsWith('HETATM')&&l.slice(17,20)==='HOH'&&l[21]==='A');
 const waters=waterRecords.map(l=>({id:Number(l.slice(22,26)),serial:Number(l.slice(6,11)),position:[Number(l.slice(30,38)),Number(l.slice(38,46)),Number(l.slice(46,54))] as Vec,occupancy:Number(l.slice(54,60))}));
 const channelWaters=waters.filter(w=>[301,302,303,304].includes(w.id));
 if(channelWaters.length!==4)throw new Error('Missing deposited pore waters');
 const sourcePath=channel.points as Vec[];
 const subunits=assembly.operators.map((operator,index)=>{
  const structure={...source,atoms:source.atoms.map(a=>({...a,position:transformAqpPoint(operator,a.position)}))};
  return {index,operator,structure,path:sourcePath.map(p=>transformAqpPoint(operator,p)),waters:channelWaters.map(w=>({...w,position:transformAqpPoint(operator,w.position)})),
   center:mean(structure.residues.map(r=>structure.atoms[r.atoms.find(i=>structure.atoms[i].name==='CA')!].position))};
 });
 // SASA of the intact tetramer, cached with the model. Never classify newly exposed monomer interfaces.
 const atoms=subunits.flatMap(u=>u.structure.atoms),residues=subunits.flatMap((u,k)=>u.structure.residues.map(r=>({...r,index:k*source.residues.length+r.index,atoms:r.atoms.map(i=>i+k*source.atoms.length)})));
 const whole:ProteinStructure={...source,atoms,residues,chain:'assembly1'},exposure=analyzeExposure(whole).residues;
 const axis=mean(subunits.map(u=>u.center));
 const regions=subunits.map(u=>u.structure.residues.map(r=>{
  const side=r.atoms.filter(i=>isSideChainAtom(u.structure.atoms[i])),ca=u.structure.atoms[r.atoms.find(i=>u.structure.atoms[i].name==='CA')!].position;
  const sideCenter=mean((side.length?side:r.atoms.filter(i=>u.structure.atoms[i].name==='CA')).map(i=>u.structure.atoms[i].position));
  const corePath=u.path.filter(p=>Math.abs(p[2])<=14),near=Math.min(...r.atoms.flatMap(i=>corePath.map(p=>distance(u.structure.atoms[i].position,p))));
  const minSidePath=Math.min(...(side.length?side:r.atoms).flatMap(i=>corePath.map(p=>distance(u.structure.atoms[i].position,p))));
  const outward=(sideCenter[0]-ca[0])*(sideCenter[0]-axis[0])+(sideCenter[1]-ca[1])*(sideCenter[1]-axis[1]);
  const surface=exposure[u.index*source.residues.length+r.index].relative;
  const pore=near<=4.5;
  const lipid=!pore&&Math.abs(sideCenter[2])<=AQP1_HALF_THICKNESS&&surface>=.25&&outward>0&&minSidePath>6;
  return {index:r.index,region:pore?'pore' as const:lipid?'lipid' as const:'other' as const,near,depth:sideCenter[2],surface,outward,minSidePath};
 }));
 const waterContacts=channelWaters.map(w=>({water:w.id,contacts:source.atoms.filter(a=>['N','O'].includes(a.element)&&distance(a.position,w.position)<=3.5).map(a=>({resSeq:a.resSeq,resName:a.resName,atom:a.name,distance:distance(a.position,w.position)}))}));
 return {source,header,assembly,subunits,npa,arr,regions,exposure,bonds:inferBonds(source),axis,waterContacts,waterCount:waters.length,sourcePath,alternateChoices:parsed.alternateChoices};
}
export type AquaporinModel=ReturnType<typeof analyzeAquaporin>;
