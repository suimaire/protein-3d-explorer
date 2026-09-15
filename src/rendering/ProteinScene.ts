import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {ProteinStructure} from '../protein/pdb';
import type {ResidueExposure} from '../protein/exposure';
import {SASA_RADII} from '../protein/sasa';
import {atomColor,DIMMED,hex,type ColorScheme} from '../protein/colors';
import type {MembraneSlab} from '../protein/membrane';
import {ribbonGeometry} from './ribbon';

export type Representation='ribbon'|'atoms'|'spacefill';
export type ProteinView={representation:Representation;color:ColorScheme;highlighted:Set<number>;filtered:boolean;selected:number|null;clip:number|null;membrane?:boolean};
export type CameraPreset='reset'|'fit'|'side'|'top';
export type SceneOptions={
 /** Membrane frame (normal +z). When given, the scene shows z vertically and can draw the slab. */ membrane?:MembraneSlab|null;
 ariaLabel?:string;
};
const vector=(p:number[])=>new T.Vector3(p[0],p[1],p[2]);
/** Display-only proper rotation (x, y, z) → (x, z, −y): the membrane normal becomes screen-up (three.js +y). */
const membraneDisplay=(p:number[])=>new T.Vector3(p[0],p[2],-p[1]);
const SELECT=0xb0327c,SLAB_FILL=0x8fb3c9,SLAB_EDGE=0x4f7890;

/** Three.js view of an experimental protein chain. Coordinates are never modified; clipping is visual only. */
export class ProteinScene{
 private renderer:T.WebGLRenderer;
 private scene=new T.Scene();
 private camera=new T.PerspectiveCamera(36,1,0.5,600);
 private controls:OrbitControls;
 private group=new T.Group();
 private resize:ResizeObserver;
 private sphere=new T.SphereGeometry(1,20,14);
 private cylinder=new T.CylinderGeometry(1,1,1,10);
 private clipPlane=new T.Plane(new T.Vector3(0,0,-1),0);
 private center=new T.Vector3();
 private radius=20;
 private positions:T.Vector3[];
 private pickables:{object:T.Object3D;residueOf:(hit:T.Intersection)=>number}[]=[];
 private label:HTMLSpanElement;
 private labelAt:T.Vector3|null=null;
 private view:ProteinView|null=null;
 private pointer:{x:number;y:number}|null=null;
 private membrane:MembraneSlab|null;
 private slab=new T.Group();
 private sideLabels:{element:HTMLSpanElement;at:T.Vector3}[]=[];
 constructor(private host:HTMLDivElement,private structure:ProteinStructure,private bonds:[number,number][],private exposure:ResidueExposure[],private onPick:(residue:number)=>void,options:SceneOptions={}){
  this.membrane=options.membrane??null;
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  this.renderer.setClearColor(0xf7f9fb);
  this.renderer.localClippingEnabled=true;
  const canvas=this.renderer.domElement;canvas.tabIndex=0;
  canvas.setAttribute('aria-label',options.ariaLabel??'유비퀴틴 단백질 3D 구조. 드래그로 회전, 휠로 확대, 클릭으로 residue 선택. 방향키로 회전, 더하기와 빼기로 확대 축소.');
  host.append(canvas);
  this.label=document.createElement('span');this.label.className='atom-label central';this.label.hidden=true;host.append(this.label);
  this.scene.add(new T.AmbientLight(0xffffff,1.9));
  const light=new T.DirectionalLight(0xffffff,2.6);light.position.set(5,10,12);this.camera.add(light);this.scene.add(this.camera);
  this.scene.add(this.group);
  this.positions=structure.atoms.map(a=>this.membrane?membraneDisplay(a.position):vector(a.position));
  const box=new T.Box3().setFromPoints(this.positions);box.getCenter(this.center);
  this.radius=Math.max(...this.positions.map(p=>p.distanceTo(this.center)))+2;
  if(this.membrane)this.buildSlab(this.membrane);
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.minDistance=12;this.controls.maxDistance=220;
  this.controls.addEventListener('change',this.render);
  canvas.addEventListener('keydown',this.keyboard);
  canvas.addEventListener('pointerdown',this.down);
  canvas.addEventListener('pointerup',this.up);
  this.camera.aspect=Math.max(host.clientWidth,1)/Math.max(host.clientHeight,1);this.camera.updateProjectionMatrix();
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const old=this.camera.aspect;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(Math.abs(old-this.camera.aspect)>0.01)this.cameraView('fit');this.render();});
  this.resize.observe(host);
  this.cameraView('reset');
 }
 /**
  * Geometric guide for the membrane hydrophobic region: a faint box between the two boundary planes
  * z = centre ± halfThickness (the same slab object used by the residue classification). Not lipid atoms.
  */
 private buildSlab(slab:MembraneSlab){
  // Lateral size only (drawing choice): frame the atoms that lie inside the slab, plus a 6 Å margin.
  const inside=this.positions.filter(p=>Math.abs(p.y-slab.center)<=slab.halfThickness),mid=new T.Vector3();
  new T.Box3().setFromPoints(inside.length?inside:this.positions).getCenter(mid);
  const extent=Math.max(...(inside.length?inside:this.positions).map(p=>Math.hypot(p.x-mid.x,p.z-mid.z)))+6,height=2*slab.halfThickness;
  const fill=new T.Mesh(new T.BoxGeometry(2*extent,height,2*extent),new T.MeshBasicMaterial({color:SLAB_FILL,transparent:true,opacity:0.12,depthWrite:false,side:T.DoubleSide}));
  fill.position.set(mid.x,slab.center,mid.z);fill.renderOrder=1;this.slab.add(fill);
  for(const y of [slab.center+slab.halfThickness,slab.center-slab.halfThickness]){
   const plane=new T.Mesh(new T.PlaneGeometry(2*extent,2*extent),new T.MeshBasicMaterial({color:SLAB_EDGE,transparent:true,opacity:0.1,depthWrite:false,side:T.DoubleSide}));
   plane.rotation.x=-Math.PI/2;plane.position.set(mid.x,y,mid.z);plane.renderOrder=1;this.slab.add(plane);
   const corners=[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([a,b])=>new T.Vector3(mid.x+a*extent,y,mid.z+b*extent));
   this.slab.add(new T.Line(new T.BufferGeometry().setFromPoints(corners),new T.LineBasicMaterial({color:SLAB_EDGE,transparent:true,opacity:0.7})));
  }
  this.slab.visible=false;this.scene.add(this.slab);
  const addLabel=(text:string,y:number)=>{const element=document.createElement('span');element.className='atom-label slab-label';element.textContent=text;element.hidden=true;this.host.append(element);this.sideLabels.push({element,at:new T.Vector3(mid.x-extent,y,mid.z+extent)});};
  addLabel('Side A (+z) · aqueous',slab.center+slab.halfThickness+4);
  addLabel(`Hydrophobic region ${height.toFixed(1)} Å`,slab.center);
  addLabel('Side B (−z) · aqueous',slab.center-slab.halfThickness-4);
 }
 private keyboard=(e:KeyboardEvent)=>{
  const offset=this.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(offset);
  if(e.key==='ArrowLeft')s.theta-=0.12;else if(e.key==='ArrowRight')s.theta+=0.12;
  else if(e.key==='ArrowUp')s.phi-=0.12;else if(e.key==='ArrowDown')s.phi+=0.12;
  else if(e.key==='+'||e.key==='=')s.radius*=0.9;else if(e.key==='-')s.radius*=1.1;else return;
  e.preventDefault();s.makeSafe();s.radius=T.MathUtils.clamp(s.radius,this.controls.minDistance,this.controls.maxDistance);
  this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.controls.update();
 };
 private down=(e:PointerEvent)=>{this.pointer={x:e.clientX,y:e.clientY};};
 private up=(e:PointerEvent)=>{
  if(!this.pointer||Math.hypot(e.clientX-this.pointer.x,e.clientY-this.pointer.y)>5){this.pointer=null;return;}
  this.pointer=null;const residue=this.pick(e.clientX,e.clientY);if(residue!==null)this.onPick(residue);
 };
 /** Nearest rendered residue under a screen point; parts removed by visual clipping are ignored. */
 pick(clientX:number,clientY:number){
  const rect=this.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
  ray.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
  let best:{distance:number;residue:number}|null=null;
  for(const p of this.pickables)for(const hit of ray.intersectObject(p.object,false)){
   if((this.view?.clip??null)!==null&&this.clipPlane.distanceToPoint(hit.point)<0)continue;
   if(!best||hit.distance<best.distance)best={distance:hit.distance,residue:p.residueOf(hit)};
   break;
  }
  return best?.residue??null;
 }
 private material(color:number,opacity=1){
  const material=new T.MeshStandardMaterial({color,transparent:opacity<1,opacity,roughness:0.5,depthWrite:opacity===1,clippingPlanes:[this.clipPlane],side:T.DoubleSide});
  // Inner faces exposed by visual clipping are drawn flat and slightly darker, so a cut atom reads as a solid section.
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\n if(!gl_FrontFacing) gl_FragColor=vec4(diffuseColor.rgb*0.8,diffuseColor.a);');};
  material.customProgramCacheKey=()=>'protein-section';
  return material;
 }
 private clear(){
  this.group.traverse(o=>{if(o instanceof T.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());if(o.geometry!==this.sphere&&o.geometry!==this.cylinder)o.geometry.dispose();}});
  this.group.clear();this.pickables=[];
 }
 private instanced(geometry:T.BufferGeometry,count:number,opacity=1){
  const mesh=new T.InstancedMesh(geometry,this.material(0xffffff,opacity),Math.max(count,1));mesh.count=count;this.group.add(mesh);return mesh;
 }
 private setStick(mesh:T.InstancedMesh,i:number,a:T.Vector3,b:T.Vector3,r:number,color:number){
  const m=new T.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()),new T.Vector3(r,a.distanceTo(b),r));
  mesh.setMatrixAt(i,m);mesh.setColorAt(i,new T.Color(color));
 }
 private setBall(mesh:T.InstancedMesh,i:number,p:T.Vector3,r:number,color:number){
  mesh.setMatrixAt(i,new T.Matrix4().compose(p,new T.Quaternion(),new T.Vector3(r,r,r)));mesh.setColorAt(i,new T.Color(color));
 }
 private residueColor(ri:number,atom:number|null,view:ProteinView){
  const r=this.exposure[ri];
  return atomColor(view.color,{resName:r.resName,chemical:r.chemical,relative:r.relative},atom===null?null:this.structure.atoms[atom]);
 }
 update(view:ProteinView){
  this.view=view;this.clear();
  const {structure}=this,residueOfAtom=new Int32Array(structure.atoms.length);
  structure.residues.forEach(r=>r.atoms.forEach(i=>{residueOfAtom[i]=r.index;}));
  const shown=(ri:number)=>view.highlighted.has(ri);
  const atomList=(filter:(i:number)=>boolean)=>structure.atoms.map((_,i)=>i).filter(filter);
  const sampleColors:string[]=[];
  if(view.representation==='ribbon'){
   this.ribbon(view,false);
   // Side chains (from Cα) of highlighted residues as sticks, for chemistry inspection.
   const side=(i:number)=>!['N','C','O','OXT'].includes(structure.atoms[i].name);
   const atoms=atomList(i=>side(i)&&shown(residueOfAtom[i]));
   const bonds=this.bonds.filter(([a,b])=>side(a)&&side(b)&&shown(residueOfAtom[a])&&residueOfAtom[a]===residueOfAtom[b]);
   this.sticks(atoms,bonds,0.2,0.2,view,residueOfAtom);
  }else{
   if(view.filtered)this.ribbon(view,true);
   const atoms=atomList(i=>shown(residueOfAtom[i]));
   if(view.representation==='atoms')this.sticks(atoms,this.bonds.filter(([a,b])=>shown(residueOfAtom[a])&&shown(residueOfAtom[b])),0.36,0.14,view,residueOfAtom);
   else{
    const mesh=this.instanced(this.sphere,atoms.length);
    atoms.forEach((a,k)=>{const color=this.residueColor(residueOfAtom[a],a,view);this.setBall(mesh,k,this.positions[a],SASA_RADII[structure.atoms[a].element],color);});
    this.pickables.push({object:mesh,residueOf:hit=>residueOfAtom[atoms[hit.instanceId!]]});
   }
  }
  // Selected residue: always drawn as ball-and-stick with a translucent halo, even outside the filter.
  this.labelAt=null;
  if(view.selected!==null){
   const residue=structure.residues[view.selected],atoms=residue.atoms,bonds=this.bonds.filter(([a,b])=>residueOfAtom[a]===view.selected&&residueOfAtom[b]===view.selected);
   if(view.representation!=='spacefill')this.sticks(atoms,bonds,0.3,0.16,view,residueOfAtom,true);
   const halo=this.instanced(this.sphere,atoms.length,0.3);
   atoms.forEach((a,k)=>this.setBall(halo,k,this.positions[a],view.representation==='spacefill'?SASA_RADII[structure.atoms[a].element]+0.25:0.75,SELECT));
   const ca=atoms.find(i=>structure.atoms[i].name==='CA')??atoms[0];
   this.labelAt=this.positions[ca].clone();
   const name=residue.resName[0]+residue.resName.slice(1).toLowerCase();
   this.label.textContent=`${name} ${residue.resSeq}`;
   sampleColors.push(hex(this.residueColor(view.selected,atoms.find(i=>!['N','CA','C','O','OXT'].includes(structure.atoms[i].name))??ca,view)));
  }
  const d=this.host.dataset;
  d.representation=view.representation;d.color=view.color;
  d.highlighted=[...view.highlighted].sort((a,b)=>a-b).map(i=>structure.residues[i].resSeq).join(',');
  d.selectedResidue=view.selected===null?'':String(structure.residues[view.selected].resSeq);
  d.selectedColor=sampleColors[0]??'';
  d.clip=view.clip===null?'off':view.clip.toFixed(2);
  if(this.membrane){this.slab.visible=!!view.membrane;d.membrane=view.membrane?'on':'off';d.slabHalfThickness=this.membrane.halfThickness.toFixed(2);}
  this.render();
 }
 private sticks(atoms:number[],bonds:[number,number][],ball:number,stick:number,view:ProteinView,residueOfAtom:Int32Array,selected=false){
  const balls=this.instanced(this.sphere,atoms.length),rods=this.instanced(this.cylinder,bonds.length*2);
  atoms.forEach((a,k)=>this.setBall(balls,k,this.positions[a],(this.structure.atoms[a].element==='C'?0.85:1)*ball,this.residueColor(residueOfAtom[a],a,view)));
  bonds.forEach(([a,b],k)=>{
   const pa=this.positions[a],pb=this.positions[b],mid=pa.clone().lerp(pb,0.5);
   this.setStick(rods,2*k,pa,mid,stick,this.residueColor(residueOfAtom[a],a,view));this.setStick(rods,2*k+1,mid,pb,stick,this.residueColor(residueOfAtom[b],b,view));
  });
  if(!selected){
   this.pickables.push({object:balls,residueOf:hit=>residueOfAtom[atoms[hit.instanceId!]]});
   this.pickables.push({object:rods,residueOf:hit=>{const [a,b]=bonds[Math.floor(hit.instanceId!/2)];return residueOfAtom[hit.instanceId!%2?b:a];}});
  }
 }
 /** Cartoon through actual Cα coordinates (shared ribbon builder); width follows the deposited HELIX/SHEET records. */
 private ribbon(view:ProteinView,ghost:boolean){
  const {structure}=this;
  const {geometry,vertexResidue}=ribbonGeometry(structure.residues,structure.atoms,this.positions,r=>ghost?DIMMED:view.highlighted.has(r.index)||!view.filtered?this.residueColor(r.index,null,view):DIMMED);
  const material=this.material(0xffffff,ghost?0.28:1);material.vertexColors=true;
  const mesh=new T.Mesh(geometry,material);this.group.add(mesh);
  if(!ghost)this.pickables.push({object:mesh,residueOf:hit=>vertexResidue[hit.face!.a]});
 }
 cameraView(view:CameraPreset){
  // Membrane scenes: Reset = Side view (normal vertical on screen); Top looks down the normal from side A.
  const preset=view==='reset'&&this.membrane?'side':view;
  const direction=preset==='fit'?this.camera.position.clone().sub(this.controls.target).normalize():preset==='side'?new T.Vector3(0.35,0,1).normalize():preset==='top'?new T.Vector3(0,1,0.001).normalize():new T.Vector3(0.35,0.2,1).normalize();
  const up=preset==='fit'?this.camera.up.clone():new T.Vector3(0,1,0);
  if(preset!=='fit')this.host.dataset.cameraPreset=view;
  const right=up.clone().cross(direction).normalize(),screenUp=direction.clone().cross(right).normalize(),tan=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));
  let distance=this.controls.minDistance;
  for(const p of this.positions){const v=p.clone().sub(this.center),z=v.dot(direction);distance=Math.max(distance,(Math.abs(v.dot(right))+2.5)/(tan*this.camera.aspect)+z,(Math.abs(v.dot(screenUp))+2.5)/tan+z);}
  this.controls.target.copy(this.center);this.camera.position.copy(this.center).addScaledVector(direction,distance);this.camera.up.copy(up);this.controls.update();this.render();
 }
 private render=()=>{
  const direction=this.camera.position.clone().sub(this.controls.target).normalize();
  // Visual slab: hide everything nearer the camera than the chosen depth through the protein centre.
  const clip=this.view?.clip??null,offset=clip===null?1e6:this.radius*(1-2*clip);
  this.clipPlane.normal.copy(direction).negate();this.clipPlane.constant=this.center.dot(direction)+offset;
  const d=this.host.dataset;
  d.cameraDirection=direction.toArray().map(v=>v.toFixed(6)).join(',');d.cameraDistance=this.camera.position.distanceTo(this.controls.target).toFixed(4);
  this.renderer.render(this.scene,this.camera);
  if(this.labelAt){
   const p=this.labelAt.clone().project(this.camera),w=this.label.offsetWidth,h=this.label.offsetHeight;
   this.label.hidden=Math.abs(p.z)>1||(clip!==null&&this.clipPlane.distanceToPoint(this.labelAt)<0);
   this.label.style.transform='none';
   this.label.style.left=`${T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2+12,4,this.host.clientWidth-w-4)}px`;
   this.label.style.top=`${T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2-28,4,this.host.clientHeight-h-4)}px`;
  }else this.label.hidden=true;
  for(const {element,at} of this.sideLabels){
   const p=at.clone().project(this.camera);
   // Side labels describe heights along the normal; hide them when viewing nearly down the normal.
   element.hidden=!this.slab.visible||Math.abs(direction.y)>0.8||Math.abs(p.z)>1||p.x<-1||p.x>1||p.y<-1||p.y>1;
   element.style.transform='none';
   element.style.left=`${T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2+6,4,Math.max(4,this.host.clientWidth-element.offsetWidth-4))}px`;
   element.style.top=`${T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2-10,4,Math.max(4,this.host.clientHeight-element.offsetHeight-4))}px`;
  }
 };
 /** Screen position of a residue's Cα, for automated picking checks. */
 screenPoint(residue:number){
  const r=this.structure.residues[residue],ca=r.atoms.find(i=>this.structure.atoms[i].name==='CA')??r.atoms[0],p=this.positions[ca].clone().project(this.camera),rect=this.renderer.domElement.getBoundingClientRect();
  return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
 }
 dispose(){
  this.resize.disconnect();this.controls.dispose();const c=this.renderer.domElement;
  c.removeEventListener('keydown',this.keyboard);c.removeEventListener('pointerdown',this.down);c.removeEventListener('pointerup',this.up);
  this.clear();this.sphere.dispose();this.cylinder.dispose();
  this.slab.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();(o.material as T.Material).dispose();}});this.sideLabels.forEach(l=>l.element.remove());
  this.renderer.dispose();c.remove();this.label.remove();
 }
}
