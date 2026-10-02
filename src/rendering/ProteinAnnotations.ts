import * as T from 'three';
import type {ProteinStructure} from '../protein/pdb';
import {SASA_RADII} from '../protein/sasa';
export type AtomGuide={a:number;b:number;labelA:string;labelB:string;text:string;kind:'measurement'|'disulfide'};
export type ResidueMark={residue:number;label:string};
export class ProteinAnnotations{
 readonly root=new T.Group();
 private labels:{el:HTMLSpanElement;point:T.Vector3;offset:number}[]=[];
 constructor(private host:HTMLDivElement,private structure:ProteinStructure,private positions:T.Vector3[],private clip:T.Plane){}
 private label(text:string,point:T.Vector3,offset=0){
  const el=document.createElement('span');el.className='atom-label addition-atom-label';el.textContent=text;this.host.append(el);this.labels.push({el,point,offset});
 }
 update(guides:AtomGuide[],marks:ResidueMark[]){
  this.clear();
  for(const {residue,label} of marks){
   const r=this.structure.residues[residue],color=label==='B'?0x15618f:0xb0327c;
   for(const i of r.atoms){const mesh=new T.Mesh(new T.SphereGeometry((SASA_RADII[this.structure.atoms[i].element]??1.7)+0.18,12,8),new T.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:0.24,clippingPlanes:[this.clip]}));mesh.position.copy(this.positions[i]);this.root.add(mesh);}
   if(!guides.length){const ca=r.atoms.find(i=>this.structure.atoms[i].name==='CA')??r.atoms[0];this.label(`${label} · ${r.resName} ${r.resSeq}${r.insertionCode}`,this.positions[ca]);}
  }
  for(const g of guides){
   const a=this.positions[g.a],b=this.positions[g.b],color=g.kind==='disulfide'?0xb18a16:0x344b5e;
   if(g.kind==='disulfide'){
    const mesh=new T.Mesh(new T.CylinderGeometry(.18,.18,a.distanceTo(b),10),new T.MeshStandardMaterial({color,clippingPlanes:[this.clip]}));
    mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());this.root.add(mesh);
   }else{
    const line=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),new T.LineDashedMaterial({color,dashSize:.35,gapSize:.2,depthTest:false,clippingPlanes:[this.clip]}));
    line.computeLineDistances();line.renderOrder=5;this.root.add(line);
   }
   for(const [p,text,offset] of [[a,g.labelA,-25],[b,g.labelB,20]] as const){
    const ball=new T.Mesh(new T.SphereGeometry(.38,16,10),new T.MeshBasicMaterial({color,depthTest:false,clippingPlanes:[this.clip]}));ball.position.copy(p);ball.renderOrder=6;this.root.add(ball);
    if(text)this.label(text,p,offset);
   }
   if(g.text)this.label(g.text,a.clone().lerp(b,.5),0);
  }
 }
 render(camera:T.Camera){
  const placed:{x:number;y:number;w:number;h:number}[]=[];
  for(const {el,point,offset} of this.labels){
   const p=point.clone().project(camera);el.hidden=Math.abs(p.z)>1||Math.abs(p.x)>1||Math.abs(p.y)>1||this.clip.distanceToPoint(point)<0;
   if(el.hidden)continue;
   const w=el.offsetWidth,h=el.offsetHeight;
   const x=T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2+14,4,Math.max(4,this.host.clientWidth-w-4));
   let y=T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2+offset,4,Math.max(4,this.host.clientHeight-h-4));
   for(let tries=0;tries<12&&placed.some(b=>x<b.x+b.w+3&&x+w>b.x-3&&y<b.y+b.h+3&&y+h>b.y-3);tries++)y+=h+4;
   y=Math.min(y,this.host.clientHeight-h-4);el.style.left=x+'px';el.style.top=y+'px';placed.push({x,y,w,h});
  }
 }
 private clear(){this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();(o.material as T.Material).dispose();}});this.root.clear();this.labels.forEach(l=>l.el.remove());this.labels=[];}
 dispose(){this.clear();}
}
