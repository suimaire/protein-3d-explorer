import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {Vec} from '../geometry/vector';
import type {PdbResidue} from '../protein/pdb';
import {ELEMENT_COLORS} from '../protein/colors';
import {interpolatePositions,type TransitionLayer,type TransitionSceneModel} from '../protein/hemoglobinTransition';
import type {SubunitLabel} from '../protein/hemoglobin';
import {ribbonGeometry} from './ribbon';

export type TransitionState='T'|'overlay'|'R'|'morph';
export type TransitionHighlight='all'|'reference'|'moving';
export type TransitionView={state:TransitionState;
 /** Morph fraction 0 (T) … 1 (R); used only in the morph state. */ fraction:number;
 highlight:TransitionHighlight;showHeme:boolean;showLigand:boolean;showInterface:boolean;showGuide:boolean;
 /** Heme number (1–4) whose proximal His is drawn, or null. */ heme:number|null};
export type TransitionCamera={view:'tetramer'|'dimer'|'heme'|'fit';heme?:number;token:number};

/** Comparison palette, separate from the Phase 4A subunit colors. */
export const COMPARISON_COLORS={
 T:{ribbon:0x8d979f,css:'#8d979f',heme:0x4f5a62,hemeCss:'#4f5a62'},
 R:{ribbon:0xd2602a,css:'#d2602a',heme:0x9c3a12,hemeCss:'#9c3a12'},
 iron:0xf0a020,ironCss:'#f0a020',ligand:0xe02b2b,ligandCss:'#e02b2b',guide:0x167a6b,guideCss:'#167a6b',
} as const;
const FADED=0.14,LIGHT=0.62;
/** Display radius (Å) of the rotation wedge; only its angle and axis are calculated quantities. */
export const GUIDE_RADIUS=34;
/** A morph layer's comparison color: T gray → R orange by fraction (display only). */
export const morphColor=(f:number)=>new T.Color(COMPARISON_COLORS.T.ribbon).lerp(new T.Color(COMPARISON_COLORS.R.ribbon),f).getHex();

type Drawn={layer:TransitionLayer;positions:T.Vector3[];ribbon:number;heme:number;ligand:boolean;name:'T'|'R'|'morph'};

/**
 * T ↔ R comparison view. T is drawn at its deposited coordinates, R at its rigidly aligned coordinates (reference
 * αβ dimer superposition), and the morph layer at straight-line interpolated common-atom coordinates. The camera is
 * independent of the state, so switching T / Overlay / R / Morph never moves the view.
 */
export class TransitionScene{
 private renderer:T.WebGLRenderer;
 private scene=new T.Scene();
 private camera=new T.PerspectiveCamera(36,1,0.5,900);
 private controls:OrbitControls;
 private root=new T.Group();
 private resize:ResizeObserver;
 private sphere=new T.SphereGeometry(1,16,10);
 private cylinder=new T.CylinderGeometry(1,1,1,8);
 private tPositions:T.Vector3[];private rPositions:T.Vector3[];
 private labels:{element:HTMLSpanElement;at:T.Vector3|null}[]=[];
 private center=new T.Vector3();
 private view:TransitionView|null=null;
 constructor(private host:HTMLDivElement,private model:TransitionSceneModel,ariaLabel:string){
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.setClearColor(0xf7f9fb);
  const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',ariaLabel);host.append(canvas);
  this.scene.add(new T.AmbientLight(0xffffff,1.9));
  const light=new T.DirectionalLight(0xffffff,2.6);light.position.set(5,10,12);this.camera.add(light);this.scene.add(this.camera);this.scene.add(this.root);
  this.tPositions=model.t.positions.map(p=>new T.Vector3(...p));this.rPositions=model.r.positions.map(p=>new T.Vector3(...p));
  new T.Box3().setFromPoints(model.t.residues.flatMap(r=>r.atoms).map(i=>this.tPositions[i])).getCenter(this.center);
  for(const text of ['α1β1 · reference dimer','α2β2 · moving dimer']){const element=document.createElement('span');element.className='atom-label dimer-label';element.textContent=text;element.hidden=true;host.append(element);this.labels.push({element,at:null});}
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.minDistance=10;this.controls.maxDistance=340;
  this.controls.addEventListener('change',this.render);canvas.addEventListener('keydown',this.keyboard);
  this.camera.aspect=Math.max(host.clientWidth,1)/Math.max(host.clientHeight,1);this.camera.updateProjectionMatrix();
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.render();});
  this.resize.observe(host);
  this.cameraView({view:'tetramer',token:0});
 }
 private keyboard=(e:KeyboardEvent)=>{
  const offset=this.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(offset);
  if(e.key==='ArrowLeft')s.theta-=0.12;else if(e.key==='ArrowRight')s.theta+=0.12;
  else if(e.key==='ArrowUp')s.phi-=0.12;else if(e.key==='ArrowDown')s.phi+=0.12;
  else if(e.key==='+'||e.key==='=')s.radius*=0.9;else if(e.key==='-')s.radius*=1.1;else return;
  e.preventDefault();s.makeSafe();s.radius=T.MathUtils.clamp(s.radius,this.controls.minDistance,this.controls.maxDistance);
  this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.controls.update();
 };
 private material(color:number,opacity:number){return new T.MeshStandardMaterial({color,transparent:opacity<1,opacity,roughness:0.5,depthWrite:opacity===1});}
 private clear(){
  this.root.traverse(o=>{if(o instanceof T.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());if(o.geometry!==this.sphere&&o.geometry!==this.cylinder)o.geometry.dispose();}});
  this.root.clear();
 }
 private instanced(geometry:T.BufferGeometry,count:number,opacity:number){const mesh=new T.InstancedMesh(geometry,this.material(0xffffff,opacity),Math.max(count,1));mesh.count=count;this.root.add(mesh);return mesh;}
 private stick(mesh:T.InstancedMesh,i:number,a:T.Vector3,b:T.Vector3,r:number,color:number){
  mesh.setMatrixAt(i,new T.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()),new T.Vector3(r,a.distanceTo(b),r)));
  mesh.setColorAt(i,new T.Color(color));
 }
 private sticks(positions:T.Vector3[],atoms:number[],bonds:[number,number][],ball:number,rod:number,color:(atom:number)=>number,opacity:number){
  const balls=this.instanced(this.sphere,atoms.length,opacity),rods=this.instanced(this.cylinder,bonds.length,opacity);
  atoms.forEach((a,k)=>{balls.setMatrixAt(k,new T.Matrix4().compose(positions[a],new T.Quaternion(),new T.Vector3(ball,ball,ball)));balls.setColorAt(k,new T.Color(color(a)));});
  bonds.forEach(([a,b],k)=>this.stick(rods,k,positions[a],positions[b],rod,color(a)));
 }
 private opacityOf(label:SubunitLabel,view:TransitionView){
  if(view.highlight==='all')return 1;
  return (view.highlight==='reference'?this.model.reference:this.model.moving).includes(label)?1:FADED;
 }
 private drawLayer(d:Drawn,view:TransitionView){
  const {layer,positions}=d,atoms=layer.atoms;
  const light=new T.Color(d.ribbon).lerp(new T.Color(0xffffff),LIGHT).getHex();
  const chains=[...new Set(layer.residues.map(r=>r.chain))];
  for(const chain of chains){
   const label=layer.labelOf[chain],opacity=this.opacityOf(label,view),residues=layer.residues.filter(r=>r.chain===chain);
   // Split at gaps so a missing residue never joins two segments.
   const segments:PdbResidue[][]=[];
   for(const r of residues){const last=segments.at(-1)?.at(-1);if(!last||r.resSeq!==last.resSeq+1)segments.push([r]);else segments.at(-1)!.push(r);}
   for(const seg of segments){
    if(seg.length<2)continue;
    const {geometry}=ribbonGeometry(seg,atoms,positions,r=>view.showInterface&&!layer.interfaceResidues.has(r.index)?light:d.ribbon);
    const material=this.material(0xffffff,opacity);material.vertexColors=true;material.side=T.DoubleSide;
    this.root.add(new T.Mesh(geometry,material));
   }
  }
  if(view.showHeme)for(const h of layer.hemes){
   const opacity=Math.max(this.opacityOf(h.label,view),0.28),own=new Set(h.atoms);
   const bonds=layer.hemeBonds.filter(([a,b])=>own.has(a)&&own.has(b)&&a!==h.iron&&b!==h.iron);
   this.sticks(positions,h.atoms.filter(a=>a!==h.iron),bonds,0.2,0.15,()=>d.heme,opacity);
   const fe=this.instanced(this.sphere,1,opacity);fe.setMatrixAt(0,new T.Matrix4().compose(positions[h.iron],new T.Quaternion(),new T.Vector3(0.62,0.62,0.62)));fe.setColorAt(0,new T.Color(COMPARISON_COLORS.iron));
   if(view.heme===h.number){
    const side=new Set(h.proximalSide);
    this.sticks(positions,h.proximalSide,layer.polymerBonds.filter(([a,b])=>side.has(a)&&side.has(b)),0.26,0.15,a=>a===h.proximalAtom?ELEMENT_COLORS.N:d.heme,1);
    const link=this.instanced(this.cylinder,1,1);this.stick(link,0,positions[h.iron],positions[h.proximalAtom],0.06,0x56626b);
   }
  }
  if(d.ligand&&view.showLigand)for(const l of layer.ligands){
   const opacity=Math.max(this.opacityOf(l.label,view),0.35),bonds:[number,number][]=l.atoms.length===2?[[l.atoms[0],l.atoms[1]]]:[];
   this.sticks(positions,l.atoms,bonds,0.42,0.2,()=>COMPARISON_COLORS.ligand,opacity);
   const heme=layer.hemes.find(h=>h.label===l.label);
   if(heme){const nearest=[...l.atoms].sort((a,b)=>positions[a].distanceTo(positions[heme.iron])-positions[b].distanceTo(positions[heme.iron]))[0];const link=this.instanced(this.cylinder,1,opacity);this.stick(link,0,positions[heme.iron],positions[nearest],0.06,0x56626b);}
  }
 }
 /**
  * Geometric guide for the fitted moving-dimer motion (not an atom trajectory), drawn on top of the ribbons:
  * the calculated rotation axis (dashed), a wedge whose angle is the calculated rotation drawn at an enlarged display
  * radius around that axis, and the calculated T → R centroid displacement (short arrow).
  */
 private drawGuide(){
  const g=this.model.guide,axis=new T.Vector3(...g.axis),cT=new T.Vector3(...g.centroidT),cR=new T.Vector3(...g.centroidR);
  const point=new T.Vector3(...g.axisPoint),color=COMPARISON_COLORS.guide,angle=T.MathUtils.degToRad(g.angle);
  const onTop=<M extends T.Object3D>(o:M)=>{o.renderOrder=10;o.traverse(x=>{if(x instanceof T.Mesh){const m=x.material as T.Material;m.depthTest=false;m.depthWrite=false;m.transparent=true;}});return o;};
  const dashes=onTop(this.instanced(this.cylinder,20,1));
  for(let k=0;k<20;k++){const a=point.clone().addScaledVector(axis,-40+k*4),b=a.clone().addScaledVector(axis,2.4);this.stick(dashes,k,a,b,0.14,color);}
  const radial=cT.clone().sub(point).normalize(),path:T.Vector3[]=[];
  for(let s=0;s<=32;s++)path.push(point.clone().add(radial.clone().applyAxisAngle(axis,angle*s/32).multiplyScalar(GUIDE_RADIUS)));
  this.root.add(onTop(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(path),48,0.22,8,false),this.material(color,1))));
  const spokes=onTop(this.instanced(this.cylinder,2,1));this.stick(spokes,0,point,path[0],0.08,color);this.stick(spokes,1,point,path.at(-1)!,0.08,color);
  const end=path.at(-1)!,tangent=end.clone().sub(path.at(-2)!).normalize();
  const cone=onTop(new T.Mesh(new T.ConeGeometry(0.8,2.2,14),this.material(color,1)));cone.position.copy(end).addScaledVector(tangent,0.8);cone.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),tangent);this.root.add(cone);
  const shift=onTop(this.instanced(this.cylinder,1,1));this.stick(shift,0,cT,cR,0.12,COMPARISON_COLORS.R.heme);
  const marks=onTop(this.instanced(this.sphere,2,1));
  marks.setMatrixAt(0,new T.Matrix4().compose(cT,new T.Quaternion(),new T.Vector3(0.6,0.6,0.6)));marks.setColorAt(0,new T.Color(COMPARISON_COLORS.T.heme));
  marks.setMatrixAt(1,new T.Matrix4().compose(cR,new T.Quaternion(),new T.Vector3(0.6,0.6,0.6)));marks.setColorAt(1,new T.Color(COMPARISON_COLORS.R.heme));
 }
 private centroidOf(layer:TransitionLayer,positions:T.Vector3[],labels:SubunitLabel[]){
  const list=layer.residues.filter(r=>labels.includes(layer.labelOf[r.chain])).flatMap(r=>r.atoms).map(i=>positions[i]);
  return list.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/list.length);
 }
 update(view:TransitionView){
  this.view=view;this.clear();
  const m=this.model,drawn:Drawn[]=[];
  if(view.state==='T'||view.state==='overlay')drawn.push({layer:m.t,positions:this.tPositions,ribbon:COMPARISON_COLORS.T.ribbon,heme:COMPARISON_COLORS.T.heme,ligand:false,name:'T'});
  if(view.state==='R'||view.state==='overlay')drawn.push({layer:m.r,positions:this.rPositions,ribbon:COMPARISON_COLORS.R.ribbon,heme:COMPARISON_COLORS.R.heme,ligand:true,name:'R'});
  if(view.state==='morph'){
   const f=view.fraction,mp=interpolatePositions(m.morph.tPositions,m.morph.rPositions,f).map(p=>new T.Vector3(...p));
   drawn.push({layer:m.morph,positions:mp,ribbon:morphColor(f),heme:new T.Color(COMPARISON_COLORS.T.heme).lerp(new T.Color(COMPARISON_COLORS.R.heme),f).getHex(),ligand:false,name:'morph'});
   // The deposited O₂ belongs to the R endpoint only: drawn at f = 1, never interpolated or placed on T.
   if(f===1)drawn.push({layer:{...m.r,residues:[],hemes:[]},positions:this.rPositions,ribbon:0,heme:0,ligand:true,name:'R'});
  }
  for(const d of drawn)this.drawLayer(d,view);
  if(view.showGuide)this.drawGuide();
  const primary=drawn[0];
  const [refLabel,movLabel]=this.labels;
  refLabel.at=this.centroidOf(primary.layer,primary.positions,m.reference);movLabel.at=this.centroidOf(primary.layer,primary.positions,m.moving);
  const ds=this.host.dataset;
  ds.state=view.state;ds.fraction=view.fraction.toFixed(2);ds.highlight=view.highlight;ds.heme=view.showHeme?'on':'off';ds.ligand=view.showLigand?'on':'off';
  ds.interface=view.showInterface?'on':'off';ds.guide=view.showGuide?'on':'off';ds.hemeFocus=view.heme===null?'':String(view.heme);
  ds.layers=drawn.filter(d=>d.layer.residues.length).map(d=>d.name).join(',');
  ds.visibleLigands=String(drawn.filter(d=>d.ligand&&view.showLigand).reduce((n,d)=>n+d.layer.ligands.length,0));
  // First backbone atoms of the primary layer as displayed (for endpoint exactness checks).
  const first=primary.layer.residues[0],ca=first.atoms.find(i=>primary.layer.atoms[i].name==='CA')!;
  ds.sampleAtom=`${primary.layer.atoms[ca].chain}:${first.resSeq}:${first.resName}:CA`;ds.samplePosition=primary.positions[ca].toArray().map(v=>v.toFixed(3)).join(',');
  this.render();
 }
 cameraView(request:TransitionCamera){
  const m=this.model,ds=this.host.dataset;
  if(request.view==='heme'){
   const h=m.t.hemes.find(x=>x.number===request.heme)??m.t.hemes[0],fe=this.tPositions[h.iron],direction=fe.clone().sub(this.center).normalize();
   this.controls.target.copy(fe);this.camera.up.set(0,1,0);this.camera.position.copy(fe).addScaledVector(direction,30);
   ds.cameraPreset='heme';ds.cameraTarget=fe.toArray().map(v=>v.toFixed(3)).join(',');this.controls.update();this.render();return;
  }
  let direction:T.Vector3,up:T.Vector3;
  if(request.view==='fit'){direction=this.camera.position.clone().sub(this.controls.target).normalize();up=this.camera.up.clone();}
  else if(request.view==='dimer'){
   // Look down the moving dimer's rotation axis, so its rotation relative to the reference dimer appears in the screen plane.
   direction=new T.Vector3(...m.guide.axis).normalize();up=Math.abs(direction.y)>0.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
  }else{direction=new T.Vector3(0.35,0.2,1).normalize();up=new T.Vector3(0,1,0);}
  if(request.view!=='fit')ds.cameraPreset=request.view;else if(ds.cameraPreset==='heme')ds.cameraPreset='fit';
  const right=up.clone().cross(direction).normalize(),screenUp=direction.clone().cross(right).normalize(),tan=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));
  const points=[...this.tPositions,...this.rPositions],center=new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
  let distance=this.controls.minDistance;
  for(let i=0;i<points.length;i+=2){const v=points[i].clone().sub(center),z=v.dot(direction);distance=Math.max(distance,(Math.abs(v.dot(right))+2.5)/(tan*this.camera.aspect)+z,(Math.abs(v.dot(screenUp))+2.5)/tan+z);}
  this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.up.copy(up.clone().sub(direction.clone().multiplyScalar(up.dot(direction))).normalize());
  ds.cameraTarget=center.toArray().map(v=>v.toFixed(3)).join(',');
  this.controls.update();this.render();
 }
 private render=()=>{
  const ds=this.host.dataset,direction=this.camera.position.clone().sub(this.controls.target).normalize();
  ds.cameraDirection=direction.toArray().map(v=>v.toFixed(6)).join(',');ds.cameraDistance=this.camera.position.distanceTo(this.controls.target).toFixed(4);
  this.renderer.render(this.scene,this.camera);
  const showLabels=!!this.view&&this.view.heme===null;
  this.labels.forEach((l,k)=>{
   if(!l.at||!showLabels){l.element.hidden=true;return;}
   const p=l.at.clone().project(this.camera),w=l.element.offsetWidth,h=l.element.offsetHeight;
   l.element.style.transform='none';
   l.element.style.left=`${T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2-w/2,4,Math.max(4,this.host.clientWidth-w-4))}px`;
   l.element.style.top=`${T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2-h/2,4,Math.max(4,this.host.clientHeight-h-4))}px`;
   l.element.hidden=Math.abs(p.z)>1;
   l.element.classList.toggle('faded',!!this.view&&this.view.highlight!=='all'&&(this.view.highlight==='reference')!==(k===0));
  });
 };
 dispose(){
  this.resize.disconnect();this.controls.dispose();const c=this.renderer.domElement;c.removeEventListener('keydown',this.keyboard);
  this.clear();this.sphere.dispose();this.cylinder.dispose();this.labels.forEach(l=>l.element.remove());this.renderer.dispose();c.remove();
 }
}

export type {Vec};
