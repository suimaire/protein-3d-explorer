import * as T from 'three';
import type {ProteinStructure} from '../protein/pdb';
import {ribbonGeometry} from './ribbon';

export type ComparisonLayer={id:string;structure:ProteinStructure;bonds:[number,number][];ribbon?:{color:number;opacity:number};markers?:{residue:number;color:number;opacity?:number;label:string;offset?:number;backbone?:boolean;atomNames?:string[];labelAtom?:string}[];contacts?:{from:number;to:number;color:number;label:string}[]};
/** Optional cached drawing layers for ProteinScene; no renderer, camera or animation of atomic coordinates. */
export class ProteinComparison{
 readonly root=new T.Group();
 private sphere=new T.SphereGeometry(1,16,12);
 private cylinder=new T.CylinderGeometry(1,1,1,10);
 private layers=new Map<string,T.Group>();
 private labels:{group:T.Group;element:HTMLSpanElement;leader:HTMLSpanElement;at:T.Vector3;offset:number}[]=[];
 constructor(private host:HTMLDivElement,layers:ComparisonLayer[]){
  for(const layer of layers){
   const group=new T.Group();this.layers.set(layer.id,group);this.root.add(group);
   const {structure}=layer,positions=structure.atoms.map(a=>new T.Vector3(...a.position));
   if(layer.ribbon){
    // Separate true coordinate gaps (not gaps in conventional numbering) before drawing the cartoon.
    const segments:typeof structure.residues[]=[];let segment:typeof structure.residues=[];
    for(const r of structure.residues){
     const ca=r.atoms.find(i=>structure.atoms[i].name==='CA');
     if(ca===undefined){if(segment.length)segments.push(segment);segment=[];continue;}
     const last=segment.at(-1),prev=last?.atoms.find(i=>structure.atoms[i].name==='CA');
     if(prev!==undefined&&positions[prev].distanceTo(positions[ca])>4.5){segments.push(segment);segment=[];}
     segment.push(r);
    }
    if(segment.length)segments.push(segment);
    for(const residues of segments)if(residues.length>1){
     const {geometry}=ribbonGeometry(residues,structure.atoms,positions,()=>layer.ribbon!.color);
     const material=this.material(layer.ribbon.color,layer.ribbon.opacity);material.vertexColors=true;
     // Vertex colors already encode the selected color.
     material.color.set(0xffffff);group.add(new T.Mesh(geometry,material));
    }
   }
   for(const marker of layer.markers??[]){
    const residue=structure.residues[marker.residue],allowed=new Set(residue.atoms.filter(i=>marker.atomNames?marker.atomNames.includes(structure.atoms[i].name):marker.backbone||!['N','C','O','OXT'].includes(structure.atoms[i].name)));
    const mat=this.material(marker.color,marker.opacity??1);
    for(const i of allowed){const ball=new T.Mesh(this.sphere,mat);ball.position.copy(positions[i]);ball.scale.setScalar(0.34);group.add(ball);}
    for(const [a,b] of layer.bonds)if(allowed.has(a)&&allowed.has(b)){
     const rod=new T.Mesh(this.cylinder,mat),v=positions[b].clone().sub(positions[a]);rod.position.copy(positions[a]).lerp(positions[b],0.5);
     rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());rod.scale.set(0.16,v.length(),0.16);group.add(rod);
    }
    if(!marker.label)continue;
    const ca=residue.atoms.find(i=>structure.atoms[i].name===(marker.labelAtom??'CA'))!,element=document.createElement('span');
    element.className='atom-label mutation-label';element.textContent=marker.label;element.style.borderColor='#'+marker.color.toString(16).padStart(6,'0');
    this.addLabel(group,element,positions[ca],marker.offset??-30);
   }
   for(const contact of layer.contacts??[]){
    const from=positions[contact.from],to=positions[contact.to];
    const line=new T.Line(new T.BufferGeometry().setFromPoints([from,to]),new T.LineDashedMaterial({color:contact.color,dashSize:0.22,gapSize:0.16}));
    line.computeLineDistances();group.add(line);
    const element=document.createElement('span');element.className='atom-label mutation-label';element.textContent=contact.label;
    this.addLabel(group,element,from.clone().lerp(to,0.5),28);
   }
  }
 }
 private addLabel(group:T.Group,element:HTMLSpanElement,at:T.Vector3,offset:number){
  const leader=document.createElement('span');leader.className='mutation-label-leader';leader.setAttribute('aria-hidden','true');
  this.host.append(leader,element);this.labels.push({group,element,leader,at,offset});
 }
 private material(color:number,opacity:number){return new T.MeshStandardMaterial({color,opacity,transparent:opacity<1,depthWrite:opacity===1,roughness:0.5,side:T.DoubleSide});}
 show(ids:string[],hiddenLabelIds:string[]=[]){for(const [id,group] of this.layers){group.visible=ids.includes(id);group.userData.hideLabels=hiddenLabelIds.includes(id);}}
 render(camera:T.Camera){
  const occupied:{x:number;y:number;w:number;h:number}[]=[];
  for(const l of this.labels){
   const p=l.at.clone().project(camera);
   l.element.hidden=l.leader.hidden=!l.group.visible||l.group.userData.hideLabels||Math.abs(p.z)>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
   if(l.element.hidden)continue;
   const px=(p.x+1)*this.host.clientWidth/2,py=(1-p.y)*this.host.clientHeight/2,w=l.element.offsetWidth,h=l.element.offsetHeight;
   const x=T.MathUtils.clamp(px+10,4,Math.max(4,this.host.clientWidth-w-4));
   const desired=T.MathUtils.clamp(py+l.offset,4,Math.max(4,this.host.clientHeight-h-4));
   let y=desired;
   // Separate crowded projected labels while retaining a leader to their actual atom.
   for(let attempt=0;attempt<40;attempt++){
    const delta=Math.ceil(attempt/2)*(h+5)*(attempt%2===0?-1:1);
    const candidate=T.MathUtils.clamp(desired+delta,4,Math.max(4,this.host.clientHeight-h-4));
    if(!occupied.some(r=>x<r.x+r.w+3&&x+w+3>r.x&&candidate<r.y+r.h+3&&candidate+h+3>r.y)){y=candidate;break;}
   }
   occupied.push({x,y,w,h});l.element.style.left=x+'px';l.element.style.top=y+'px';
   const tx=T.MathUtils.clamp(px,x,x+w),ty=T.MathUtils.clamp(py,y,y+h),dx=tx-px,dy=ty-py;
   l.leader.style.left=px+'px';l.leader.style.top=py+'px';l.leader.style.width=Math.hypot(dx,dy)+'px';l.leader.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
  }
 }
 dispose(){
  const materials=new Set<T.Material>();
  this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){materials.add(o.material as T.Material);if(o.geometry!==this.sphere&&o.geometry!==this.cylinder)o.geometry.dispose();}});
  materials.forEach(m=>m.dispose());this.sphere.dispose();this.cylinder.dispose();this.labels.forEach(l=>{l.element.remove();l.leader.remove();});this.root.clear();
 }
}
