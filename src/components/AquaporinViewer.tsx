import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {ExplorationScene} from '../rendering/ExplorationScene';
import {ribbonGeometry} from '../rendering/ribbon';
import {atomColor,RIBBON_DEFAULT} from '../protein/colors';
import {classOf} from '../protein/chemistry';
import {SASA_RADII} from '../protein/sasa';
import {AQP1_HALF_THICKNESS} from '../protein/aqp1Orientation';
import {channelPoint,AQP1_PARTICLE_RADIUS,aqpInstanceKey,type AquaporinModel} from '../protein/aquaporin';
import type {Vec} from '../geometry/vector';
export type AqpView={stage:'tetramer'|'subunit'|'section'|'selectivity';unit:number;opacity:number;representation:'ribbon'|'spacefill';color:'subunit'|'chemistry';region:'all'|'pore'|'lipid';membrane:boolean;waters:boolean;paths:boolean;npa:boolean;arr:boolean;clip:boolean;clipOffset:number;selected:number|null;particles:boolean};
export type AqpCamera={view:'reset'|'fit'|'top'|'side'|'pore'|'npa'|'arr';token:number};
const COLORS=[0x2f7d6a,0x8d4f9e,0xb88b36,0x457da7];
export const aqpDisplay=(p:Vec)=>new T.Vector3(p[0],p[2],-p[1]);
export function AquaporinViewer({model,view,camera,playing,step,resetToken,onPick}:{model:AquaporinModel;view:AqpView;camera:AqpCamera;playing:boolean;step:number;resetToken:number;onPick:(unit:number,residue:number)=>void}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<ExplorationScene|null>(null),pick=useRef(onPick),currentView=useRef(view),particles=useRef<{mesh:T.Mesh;path:Vec[];unit:number}[]>([]),phase=useRef(0),[error,setError]=useState(false);
 pick.current=onPick;currentView.current=view;
 const moveParticles=()=>{for(const p of particles.current){const t=.5-.5*Math.cos(phase.current+(p.unit%2)*Math.PI);p.mesh.position.copy(aqpDisplay(channelPoint(p.path,t)));}if(host.current)host.current.dataset.particlePhase=phase.current.toFixed(6);};
 useEffect(()=>{
  try{
   const s=new ExplorationScene(host.current!,'AQP1 4량체 실험 구조. 드래그·방향키 회전, 휠·더하기·빼기 확대 축소, 클릭으로 소단위와 잔기 선택.',id=>{const [u,r]=id.split(':').map(Number);pick.current(u,r);});scene.current=s;
   s.fit(model.subunits.flatMap(u=>u.structure.atoms.map(a=>aqpDisplay(a.position))),'top');
  }catch{setError(true);}
  return()=>{scene.current?.dispose();scene.current=null;particles.current=[];};
 },[model]);
 useEffect(()=>{
  const s=scene.current;if(!s)return;s.clear();particles.current=[];
  const selectedUnit=model.subunits[view.unit],corePath=selectedUnit.path.filter(p=>Math.abs(p[2])<=14);
  s.setClip(view.clip?aqpDisplay(channelPoint(corePath,.5)):null);

  // Clipping offset is a display control; atoms and pore paths never change.
  s.clipOffset=view.clipOffset;
  let drawnWaters=0;
  for(const u of model.subunits){
   const primary=u.index===view.unit,opacity=primary?1:view.opacity,positions=u.structure.atoms.map(a=>aqpDisplay(a.position));
   if(opacity<=0)continue;
   const inRegion=(r:number)=>view.region==='all'||model.regions[u.index][r].region===view.region;
   const color=(r:number,a:number|null)=>view.color==='subunit'?(a===null?COLORS[u.index]:atomColor('default',{resName:u.structure.residues[r].resName,chemical:classOf(u.structure.residues[r].resName),relative:0},u.structure.atoms[a])):atomColor('chemistry',{resName:u.structure.residues[r].resName,chemical:classOf(u.structure.residues[r].resName),relative:0},a===null?null:u.structure.atoms[a]);
   const atomResidue=new Int32Array(u.structure.atoms.length);u.structure.residues.forEach(r=>r.atoms.forEach(i=>{atomResidue[i]=r.index;}));
   const addAtoms=(ids:number[],full:boolean,alpha:number)=>{
    const mesh=new T.InstancedMesh(new T.SphereGeometry(1,14,10),s.material(0xffffff,alpha),ids.length);
    ids.forEach((i,k)=>{const r=full?SASA_RADII[u.structure.atoms[i].element]:.32;mesh.setMatrixAt(k,new T.Matrix4().compose(positions[i],new T.Quaternion(),new T.Vector3(r,r,r)));mesh.setColorAt(k,new T.Color(color(atomResidue[i],i)));});
    if(alpha>.1)mesh.userData.pickAt=(hit:T.Intersection)=>`${u.index}:${atomResidue[ids[hit.instanceId!]]}`;
    s.root.add(mesh);
   };
   if(view.representation==='ribbon'||!primary||view.region!=='all'){
    const {geometry,vertexResidue}=ribbonGeometry(u.structure.residues,u.structure.atoms,positions,r=>inRegion(r.index)?color(r.index,null):RIBBON_DEFAULT);
    const mat=s.material(0xffffff,opacity*(primary&&view.representation!=='ribbon'?.22:1));mat.vertexColors=true;const mesh=new T.Mesh(geometry,mat);
    if(opacity>.1)mesh.userData.pickAt=(hit:T.Intersection)=>`${u.index}:${vertexResidue[hit.face!.a]}`;s.root.add(mesh);
   }
   if(primary&&view.representation==='spacefill')addAtoms(u.structure.atoms.map((_,i)=>i).filter(i=>inRegion(atomResidue[i])),true,1);
   if(primary){
    const marked=new Set([...(view.npa?model.npa:[]),...(view.arr?model.arr:[]),...(view.selected!==null?[view.selected]:[])]);
    if(view.representation==='ribbon'){
     const ids=[...marked].flatMap(r=>u.structure.residues[r].atoms);addAtoms(ids,false,1);
     for(const [a,b] of model.bonds)if(marked.has(atomResidue[a])&&atomResidue[a]===atomResidue[b])s.stick(positions[a],positions[b],.12,color(atomResidue[a],a));
    }
    const mark=(indices:number[],name:string,color:number)=>{
     const ca=indices.map(r=>positions[u.structure.residues[r].atoms.find(i=>u.structure.atoms[i].name==='CA')!]);
     const center=ca.reduce((a,b)=>a.add(b),new T.Vector3()).multiplyScalar(1/ca.length);
     s.label(name,center);
     for(const ri of indices){const r=u.structure.residues[ri];const p=positions[r.atoms.find(i=>u.structure.atoms[i].name==='CA')!];const ring=new T.Mesh(new T.SphereGeometry(1.05,12,8),new T.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.7,clippingPlanes:[s.clip]}));ring.position.copy(p);s.root.add(ring);}
    };
    if(view.stage==='selectivity'){
     if(view.npa){mark(model.npa.slice(0,3),'NPA 78–80',0xb0327c);mark(model.npa.slice(3),'NPA 194–196',0xb0327c);}
     if(view.arr)mark(model.arr,'ar/R · F58 H182 C191 R197',0x15618f);
    }
    if(view.selected!==null){const r=u.structure.residues[view.selected];mark([view.selected],`소단위 ${u.index+1} · ${r.resName} ${r.resSeq}`,0xb0327c);}
   }
   if(view.paths){const line=s.line(u.path.map(aqpDisplay),0x257e93,true);(line.material as T.LineDashedMaterial).transparent=true;(line.material as T.LineDashedMaterial).opacity=primary?1:Math.max(.25,opacity);}
   if(view.stage==='tetramer')s.label(`소단위 ${u.index+1} · 물 통로`,aqpDisplay(channelPoint(u.path,.5)));
   if(view.waters&&(primary||view.stage==='tetramer')){
    for(const w of u.waters){s.ball(aqpDisplay(w.position),.55,0x2087aa,undefined,s.root,opacity);drawnWaters++;}
   }
   if(view.particles&&(primary||view.stage==='tetramer')){
    const mesh=new T.Mesh(new T.OctahedronGeometry(AQP1_PARTICLE_RADIUS),new T.MeshBasicMaterial({color:0xb0327c,clippingPlanes:[s.clip]}));s.root.add(mesh);particles.current.push({mesh,path:u.path,unit:u.index});
   }
  }
  if(view.membrane){
   const ps=model.subunits.flatMap(u=>u.structure.atoms.map(a=>aqpDisplay(a.position))),box=new T.Box3().setFromPoints(ps),cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2,w=box.max.x-box.min.x+8,d=box.max.z-box.min.z+8;
   for(const y of [-AQP1_HALF_THICKNESS,AQP1_HALF_THICKNESS]){
    const plane=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({color:0x8fb3c9,transparent:true,opacity:.1,depthWrite:false,side:T.DoubleSide}));plane.rotation.x=-Math.PI/2;plane.position.set(cx,y,cz);s.root.add(plane);
    s.line([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[-w/2,-d/2]].map(([x,z])=>new T.Vector3(cx+x,y,cz+z)),0x8ba8b9);
   }
  }
  moveParticles();
  const d=host.current!.dataset;d.unit=String(view.unit);d.stage=view.stage;d.opacity=String(view.opacity);d.selected=view.selected===null?'':aqpInstanceKey(view.unit,'A',model.source.residues[view.selected].resSeq);
  d.assembly='1';d.subunits='4';d.waterCount=String(drawnWaters);d.particles=String(particles.current.length);d.membrane=String(view.membrane);d.npa=String(view.npa);d.arr=String(view.arr);
  d.pathCenters=model.subunits.map(u=>channelPoint(u.path,.5).map(x=>x.toFixed(3)).join(',')).join(';');s.render();
 },[model,view]);
 useEffect(()=>{scene.current?.setAnimation(playing?dt=>{phase.current+=dt*.9;moveParticles();}:null);},[playing,model]);
 useEffect(()=>{phase.current=0;moveParticles();scene.current?.render();},[resetToken]);
 useEffect(()=>{if(step){phase.current+=Math.PI/8;moveParticles();scene.current?.render();}},[step]);
 useEffect(()=>{
  const s=scene.current;if(!s||!camera.token)return;const v=currentView.current,u=model.subunits[v.unit];
  const points=camera.view==='npa'||camera.view==='arr'?(camera.view==='npa'?model.npa:model.arr).flatMap(r=>u.structure.residues[r].atoms.map(i=>aqpDisplay(u.structure.atoms[i].position))):
   camera.view==='pore'?u.path.filter(p=>Math.abs(p[2])<=18).map(aqpDisplay):
   v.stage==='tetramer'?model.subunits.flatMap(u=>u.structure.atoms.map(a=>aqpDisplay(a.position))):u.structure.atoms.map(a=>aqpDisplay(a.position));
  s.fit(points,camera.view==='npa'||camera.view==='arr'?'side':camera.view);
 },[camera,model]);
 return <div ref={host} className="molecule-viewer addition-viewer" data-testid="aquaporin-viewer">{error&&<p role="alert">AQP1 3D 화면을 시작하지 못했습니다.</p>}</div>;
}
