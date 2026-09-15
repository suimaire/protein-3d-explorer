import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {Vec} from '../geometry/vector';
import type {MultiChainStructure,PdbResidue} from '../protein/pdb';
import {SASA_RADII} from '../protein/sasa';
import {DIMMED,ELEMENT_COLORS,RIBBON_DEFAULT} from '../protein/colors';
import {ribbonGeometry} from './ribbon';
import type {Representation} from './ProteinScene';

export type AssemblyColor='default'|'subunit'|'type';
export type AssemblyPick={kind:'residue'|'heme';index:number};
export type AssemblyView={
 representation:Representation;color:AssemblyColor;
 /** Chain ID in focus (others drawn translucent), or null for the whole assembly. */ focus:string|null;
 showHeme:boolean;
 /** Interface residue indices to emphasise, or null when interfaces are off. */ interfaces:Set<number>|null;
 exploded:boolean;selected:AssemblyPick|null;
};
export type AssemblyCamera={view:'reset'|'fit'|'heme';chain?:string|null;token:number};
export type AssemblySceneModel={
 structure:MultiChainStructure;bonds:[number,number][];hemeBonds:[number,number][];
 chains:{chain:string;label:string;color:number;typeColor:number}[];
 hemes:{group:number;chain:string;iron:number;number:number;proximal:{residue:number;atom:number}}[];
 /** Chain → explanatory display offset (Å) used only while the exploded view is on. */ exploded:Record<string,Vec>;
};

const SELECT=0xb0327c,HEME_CARBON=0xc22f3c,IRON=0xf08a1c,LINK=0x6d7a83,FADED=0.16;
/** Display-only van der Waals radius for Fe in space filling (approximate; heme is buried in the pocket). */
const VDW:Record<string,number>={...SASA_RADII,FE:2.0};

/**
 * Three.js view of a multi-chain assembly with hetero groups. Each chain (with its associated hetero groups) is one
 * group; the exploded view only sets that group's translation. Atom coordinates are never modified.
 */
export class AssemblyScene{
 private renderer:T.WebGLRenderer;
 private scene=new T.Scene();
 private camera=new T.PerspectiveCamera(36,1,0.5,800);
 private controls:OrbitControls;
 private root=new T.Group();
 private groups=new Map<string,T.Group>();
 private resize:ResizeObserver;
 private sphere=new T.SphereGeometry(1,18,12);
 private cylinder=new T.CylinderGeometry(1,1,1,10);
 private positions:T.Vector3[];
 private residueOf:Int32Array;
 private ownerOf:string[];
 private center=new T.Vector3();
 private pickables:{object:T.Object3D;pick:(hit:T.Intersection)=>AssemblyPick}[]=[];
 private label:HTMLSpanElement;
 private labelAt:{chain:string;at:T.Vector3}|null=null;
 private hemeLabels:{element:HTMLSpanElement;chain:string;group:number;at:T.Vector3}[]=[];
 private view:AssemblyView|null=null;
 private pointer:{x:number;y:number}|null=null;
 constructor(private host:HTMLDivElement,private model:AssemblySceneModel,private onPick:(pick:AssemblyPick)=>void,ariaLabel:string){
  const {structure}=model;
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  this.renderer.setClearColor(0xf7f9fb);
  const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',ariaLabel);
  host.append(canvas);
  this.label=document.createElement('span');this.label.className='atom-label central';this.label.hidden=true;host.append(this.label);
  this.scene.add(new T.AmbientLight(0xffffff,1.9));
  const light=new T.DirectionalLight(0xffffff,2.6);light.position.set(5,10,12);this.camera.add(light);this.scene.add(this.camera);
  this.scene.add(this.root);
  for(const {chain} of model.chains){const g=new T.Group();g.name=chain;this.groups.set(chain,g);this.root.add(g);}
  this.positions=structure.atoms.map(a=>new T.Vector3(...a.position));
  this.residueOf=new Int32Array(structure.atoms.length).fill(-1);
  for(const r of [...structure.residues,...structure.hetero])for(const i of r.atoms)this.residueOf[i]=r.index;
  const hemeOwner=new Map(model.hemes.map(h=>[h.group,h.chain]));
  this.ownerOf=structure.atoms.map((a,i)=>a.hetero?hemeOwner.get(this.residueOf[i])??a.chain:a.chain);
  const polymer=structure.residues.flatMap(r=>r.atoms).map(i=>this.positions[i]);
  new T.Box3().setFromPoints(polymer).getCenter(this.center);
  for(const h of model.hemes){
   const element=document.createElement('span');element.className='atom-label heme-label';element.textContent=`Heme ${h.number}`;element.hidden=true;host.append(element);
   this.hemeLabels.push({element,chain:h.chain,group:h.group,at:this.positions[h.iron].clone()});
  }
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.minDistance=10;this.controls.maxDistance=320;
  this.controls.addEventListener('change',this.render);
  canvas.addEventListener('keydown',this.keyboard);canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointerup',this.up);
  this.camera.aspect=Math.max(host.clientWidth,1)/Math.max(host.clientHeight,1);this.camera.updateProjectionMatrix();
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const old=this.camera.aspect;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(Math.abs(old-this.camera.aspect)>0.01&&this.host.dataset.cameraPreset!=='heme')this.cameraView({view:'fit',token:0});this.render();});
  this.resize.observe(host);
  this.cameraView({view:'reset',token:0});
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
  this.pointer=null;const hit=this.pick(e.clientX,e.clientY);if(hit)this.onPick(hit);
 };
 /** Nearest rendered residue or heme under a screen point. Translucent (out-of-focus) chains are not pickable. */
 pick(clientX:number,clientY:number):AssemblyPick|null{
  const rect=this.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
  ray.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
  this.root.updateMatrixWorld(true);
  let best:{distance:number;pick:AssemblyPick}|null=null;
  for(const p of this.pickables){const hit=ray.intersectObject(p.object,false)[0];if(hit&&(!best||hit.distance<best.distance))best={distance:hit.distance,pick:p.pick(hit)};}
  return best?.pick??null;
 }
 private material(color:number,opacity:number){
  return new T.MeshStandardMaterial({color,transparent:opacity<1,opacity,roughness:0.5,depthWrite:opacity===1});
 }
 private clear(){
  for(const g of this.groups.values()){
   g.traverse(o=>{if(o instanceof T.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());if(o.geometry!==this.sphere&&o.geometry!==this.cylinder)o.geometry.dispose();}});
   g.clear();
  }
  this.pickables=[];
 }
 private instanced(group:T.Group,geometry:T.BufferGeometry,count:number,opacity:number){
  const mesh=new T.InstancedMesh(geometry,this.material(0xffffff,opacity),Math.max(count,1));mesh.count=count;group.add(mesh);return mesh;
 }
 private chainInfo(chain:string){return this.model.chains.find(c=>c.chain===chain)!;}
 private colorOf(chain:string,element:string|null,view:AssemblyView){
  if(view.color==='subunit')return this.chainInfo(chain).color;
  if(view.color==='type')return this.chainInfo(chain).typeColor;
  return element?ELEMENT_COLORS[element]??0x888888:RIBBON_DEFAULT;
 }
 private sticks(group:T.Group,atoms:number[],bonds:[number,number][],ball:number,stick:number,color:(atom:number)=>number,opacity:number,pick?:(atom:number)=>AssemblyPick){
  const balls=this.instanced(group,this.sphere,atoms.length,opacity),rods=this.instanced(group,this.cylinder,bonds.length*2,opacity);
  atoms.forEach((a,k)=>{const r=(this.model.structure.atoms[a].element==='C'?0.85:1)*ball;balls.setMatrixAt(k,new T.Matrix4().compose(this.positions[a],new T.Quaternion(),new T.Vector3(r,r,r)));balls.setColorAt(k,new T.Color(color(a)));});
  bonds.forEach(([a,b],k)=>{
   const pa=this.positions[a],pb=this.positions[b],mid=pa.clone().lerp(pb,0.5);
   this.setStick(rods,2*k,pa,mid,stick,color(a));this.setStick(rods,2*k+1,mid,pb,stick,color(b));
  });
  if(pick){
   this.pickables.push({object:balls,pick:hit=>pick(atoms[hit.instanceId!])});
   this.pickables.push({object:rods,pick:hit=>{const [a,b]=bonds[Math.floor(hit.instanceId!/2)];return pick(hit.instanceId!%2?b:a);}});
  }
 }
 private setStick(mesh:T.InstancedMesh,i:number,a:T.Vector3,b:T.Vector3,r:number,color:number){
  mesh.setMatrixAt(i,new T.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()),new T.Vector3(r,a.distanceTo(b),r)));
  mesh.setColorAt(i,new T.Color(color));
 }
 private spheres(group:T.Group,atoms:number[],radius:(atom:number)=>number,color:(atom:number)=>number,opacity:number,pick?:(atom:number)=>AssemblyPick){
  const mesh=this.instanced(group,this.sphere,atoms.length,opacity);
  atoms.forEach((a,k)=>{const r=radius(a);mesh.setMatrixAt(k,new T.Matrix4().compose(this.positions[a],new T.Quaternion(),new T.Vector3(r,r,r)));mesh.setColorAt(k,new T.Color(color(a)));});
  if(pick)this.pickables.push({object:mesh,pick:hit=>pick(atoms[hit.instanceId!])});
 }
 private ribbon(group:T.Group,residues:PdbResidue[],color:(r:PdbResidue)=>number,opacity:number,pickable:boolean){
  const {geometry,vertexResidue}=ribbonGeometry(residues,this.model.structure.atoms,this.positions,color);
  const material=this.material(0xffffff,opacity);material.vertexColors=true;material.side=T.DoubleSide;
  const mesh=new T.Mesh(geometry,material);group.add(mesh);
  if(pickable)this.pickables.push({object:mesh,pick:hit=>({kind:'residue',index:vertexResidue[hit.face!.a]})});
 }
 update(view:AssemblyView){
  this.view=view;this.clear();
  const {structure,bonds,hemeBonds}=this.model,atoms=structure.atoms,residueOf=this.residueOf;
  const side=(i:number)=>!['N','C','O','OXT'].includes(atoms[i].name);
  const residuePick=(a:number):AssemblyPick=>({kind:'residue',index:residueOf[a]});
  for(const {chain} of this.model.chains){
   const group=this.groups.get(chain)!,inFocus=view.focus===null||view.focus===chain,opacity=inFocus?1:FADED,pickable=inFocus;
   const [x,y,z]=view.exploded?this.model.exploded[chain]:[0,0,0];group.position.set(x,y,z);
   const residues=structure.residues.filter(r=>r.chain===chain),iface=view.interfaces;
   const emphasised=(ri:number)=>!iface||iface.has(ri);
   const inChain=(i:number)=>atoms[i].chain===chain&&!atoms[i].hetero;
   const residueColor=(r:PdbResidue)=>emphasised(r.index)?this.colorOf(chain,null,view):DIMMED;
   const atomColor=(a:number)=>this.colorOf(chain,atoms[a].element,view);
   if(view.representation==='ribbon'){
    this.ribbon(group,residues,residueColor,opacity,pickable);
    if(iface){
     const list=residues.filter(r=>iface.has(r.index)).flatMap(r=>r.atoms).filter(side);
     const b=bonds.filter(([x,y])=>inChain(x)&&side(x)&&side(y)&&iface.has(residueOf[x])&&residueOf[x]===residueOf[y]);
     this.sticks(group,list,b,0.22,0.2,atomColor,opacity,pickable?residuePick:undefined);
    }
   }else{
    if(iface)this.ribbon(group,residues,()=>DIMMED,Math.min(opacity,0.28),false);
    const list=residues.filter(r=>emphasised(r.index)).flatMap(r=>r.atoms);
    if(view.representation==='atoms'){
     const b=bonds.filter(([x,y])=>inChain(x)&&emphasised(residueOf[x])&&emphasised(residueOf[y])&&atoms[y].chain===chain);
     this.sticks(group,list,b,0.34,0.13,atomColor,opacity,pickable?residuePick:undefined);
    }else this.spheres(group,list,a=>VDW[atoms[a].element],atomColor,opacity,pickable?residuePick:undefined);
   }
  }
  // Heme: a non-protein prosthetic group drawn in its own colors in every mode, inside the chain it is associated with.
  for(const h of this.model.hemes){
   if(!view.showHeme)continue;
   const group=this.groups.get(h.chain)!,inFocus=view.focus===null||view.focus===h.chain,opacity=inFocus?1:0.3,heme=structure.hetero.find(g=>g.index===h.group)!;
   const color=(a:number)=>atoms[a].element==='FE'?IRON:HEME_CARBON,pick=inFocus?():AssemblyPick=>({kind:'heme',index:h.group}):undefined;
   if(view.representation==='spacefill')this.spheres(group,heme.atoms,a=>VDW[atoms[a].element],color,opacity,pick);
   else{
    const b=hemeBonds.filter(([x])=>residueOf[x]===h.group),porphyrin=heme.atoms.filter(a=>atoms[a].element!=='FE');
    this.sticks(group,porphyrin,b.filter(([x,y])=>atoms[x].element!=='FE'&&atoms[y].element!=='FE'),0.26,0.17,color,opacity,pick);
    this.spheres(group,[h.iron],()=>0.78,color,opacity,pick);
   }
   // Focused subunit: the measured nearest polymer ligand of Fe (proximal His) as sticks, with a thin Fe–N guide.
   if(view.focus===h.chain&&view.representation!=='spacefill'){
    const his=structure.residues[h.proximal.residue],sideAtoms=his.atoms.filter(a=>atoms[a].name!=='N'&&atoms[a].name!=='C'&&atoms[a].name!=='O');
    this.sticks(group,sideAtoms,bonds.filter(([x,y])=>residueOf[x]===his.index&&residueOf[y]===his.index&&sideAtoms.includes(x)&&sideAtoms.includes(y)),0.3,0.17,a=>ELEMENT_COLORS[atoms[a].element]??0x888888,1,a=>residuePick(a));
    const rod=this.instanced(group,this.cylinder,1,1);this.setStick(rod,0,this.positions[h.iron],this.positions[h.proximal.atom],0.07,LINK);
   }
  }
  // Selected residue or heme: translucent halo, plus a label.
  this.labelAt=null;
  if(view.selected){
   const sel=view.selected,r=sel.kind==='residue'?structure.residues[sel.index]:structure.hetero.find(g=>g.index===sel.index)!;
   const chain=this.ownerOf[r.atoms[0]],group=this.groups.get(chain)!;
   this.spheres(group,r.atoms,a=>view.representation==='spacefill'?VDW[atoms[a].element]+0.25:sel.kind==='heme'?0.5:0.75,()=>SELECT,0.3);
   const anchor=r.atoms.find(i=>atoms[i].name==='CA'||atoms[i].element==='FE')??r.atoms[0];
   this.labelAt={chain,at:this.positions[anchor].clone()};
   this.label.textContent=sel.kind==='heme'?`Heme ${this.model.hemes.find(h=>h.group===sel.index)?.number} · ${this.chainInfo(chain).label}`:`${r.resName[0]}${r.resName.slice(1).toLowerCase()} ${r.resSeq}${r.insertionCode} · ${this.chainInfo(chain).label}`;
  }
  const d=this.host.dataset;
  d.representation=view.representation;d.color=view.color;d.focus=view.focus===null?'all':this.chainInfo(view.focus).label;
  d.heme=view.showHeme?'on':'off';d.visibleHemes=String(view.showHeme?this.model.hemes.length:0);
  d.interfaces=view.interfaces?String(view.interfaces.size):'off';d.exploded=view.exploded?'on':'off';
  d.chainOffsets=this.model.chains.map(({chain})=>`${chain}:${this.groups.get(chain)!.position.toArray().map(v=>v.toFixed(3)).join(',')}`).join(';');
  d.selected=view.selected?`${view.selected.kind}:${view.selected.index}`:'';
  this.render();
 }
 /** Display position of an atom (deposited coordinates + its chain group's current translation). */
 private displayed(atom:number){return this.positions[atom].clone().add(this.groups.get(this.ownerOf[atom])!.position);}
 cameraView(request:AssemblyCamera){
  const hemeSite=request.view==='heme'?this.model.hemes.find(h=>h.chain===request.chain):null;
  if(request.view==='heme'&&hemeSite){
   // Look at the heme from outside the assembly, along the centre → Fe direction.
   const fe=this.displayed(hemeSite.iron),direction=fe.clone().sub(this.center).normalize();
   this.controls.target.copy(fe);this.camera.up.set(0,1,0);this.camera.position.copy(fe).addScaledVector(direction,34);
   this.host.dataset.cameraPreset='heme';this.host.dataset.cameraTarget=fe.toArray().map(v=>v.toFixed(3)).join(',');
   this.controls.update();this.render();return;
  }
  const fit=request.view==='fit',direction=fit?this.camera.position.clone().sub(this.controls.target).normalize():new T.Vector3(0.35,0.2,1).normalize();
  const up=fit?this.camera.up.clone():new T.Vector3(0,1,0);
  if(!fit)this.host.dataset.cameraPreset='reset';else if(this.host.dataset.cameraPreset==='heme')this.host.dataset.cameraPreset='fit';
  const right=up.clone().cross(direction).normalize(),screenUp=direction.clone().cross(right).normalize(),tan=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));
  const points=this.model.structure.atoms.map((_,i)=>this.displayed(i)),center=new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
  let distance=this.controls.minDistance;
  for(const p of points){const v=p.clone().sub(center),z=v.dot(direction);distance=Math.max(distance,(Math.abs(v.dot(right))+2.5)/(tan*this.camera.aspect)+z,(Math.abs(v.dot(screenUp))+2.5)/tan+z);}
  this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.up.copy(up);
  this.host.dataset.cameraTarget=center.toArray().map(v=>v.toFixed(3)).join(',');
  this.controls.update();this.render();
 }
 private place(element:HTMLElement,at:T.Vector3,dx:number,dy:number){
  const p=at.clone().project(this.camera),w=element.offsetWidth,h=element.offsetHeight;
  element.style.transform='none';
  element.style.left=`${T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2+dx,4,Math.max(4,this.host.clientWidth-w-4))}px`;
  element.style.top=`${T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2+dy,4,Math.max(4,this.host.clientHeight-h-4))}px`;
  return p;
 }
 private render=()=>{
  const d=this.host.dataset,direction=this.camera.position.clone().sub(this.controls.target).normalize();
  d.cameraDirection=direction.toArray().map(v=>v.toFixed(6)).join(',');d.cameraDistance=this.camera.position.distanceTo(this.controls.target).toFixed(4);
  this.renderer.render(this.scene,this.camera);
  if(this.labelAt){const p=this.place(this.label,this.labelAt.at.clone().add(this.groups.get(this.labelAt.chain)!.position),12,-28);this.label.hidden=Math.abs(p.z)>1;}else this.label.hidden=true;
  for(const l of this.hemeLabels){
   const p=this.place(l.element,l.at.clone().add(this.groups.get(l.chain)!.position),8,8),view=this.view;
   // The selected heme already carries the main label.
   l.element.hidden=!view?.showHeme||(view.selected?.kind==='heme'&&view.selected.index===l.group)||Math.abs(p.z)>1||p.x<-1||p.x>1||p.y<-1||p.y>1;
   l.element.classList.toggle('faded',!!view&&view.focus!==null&&view.focus!==l.chain);
  }
 };
 /** Screen position of an atom as displayed, for automated picking checks. */
 screenPoint(atom:number){
  const p=this.displayed(atom).project(this.camera),rect=this.renderer.domElement.getBoundingClientRect();
  return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
 }
 dispose(){
  this.resize.disconnect();this.controls.dispose();const c=this.renderer.domElement;
  c.removeEventListener('keydown',this.keyboard);c.removeEventListener('pointerdown',this.down);c.removeEventListener('pointerup',this.up);
  this.clear();this.sphere.dispose();this.cylinder.dispose();this.hemeLabels.forEach(l=>l.element.remove());
  this.renderer.dispose();c.remove();this.label.remove();
 }
}
