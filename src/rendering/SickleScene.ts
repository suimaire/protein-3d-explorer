import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {Vec} from '../geometry/vector';
import type {PdbResidue} from '../protein/pdb';
import {SASA_RADII} from '../protein/sasa';
import {CLASS_INFO} from '../protein/chemistry';
import {ELEMENT_COLORS} from '../protein/colors';
import type {SickleLayer,SickleSceneModel} from '../protein/sickle';
import {ribbonGeometry} from './ribbon';

export type SickleStep='mutation'|'surface'|'contact'|'polymer';
export type SickleRepresentation='ribbon'|'sticks'|'spacefill';
export type SickleHighlight='mutation'|'pocket'|'both';
/** Which structure is drawn in the two local steps. */
export type SickleStructure='hba'|'hbs'|'both';
export type SickleView={
 step:SickleStep;representation:SickleRepresentation;highlight:SickleHighlight;structure:SickleStructure;
 /** Number of tetramers drawn in the polymer step (2, 4 or 6). */ segment:number;
 showHeme:boolean;showDistances:boolean;
 /** Draw the second molecule of the contact pair; off leaves only the donor molecule on screen. */ showNeighbour:boolean;
};
export type SickleCamera={view:'tetramer'|'mutation'|'pocket'|'segment'|'fit';token:number};

/** Palette for this module, separate from the Phase 4A subunit colors and the Phase 4B T/R comparison colors. */
export const SICKLE_COLORS={
 hba:{ribbon:0x3a72b0,css:'#3a72b0'},
 hbs:{ribbon:0xc2622a,css:'#c2622a'},
 /** Molecules alternate by the biomolecule they copy, so the two strands of the segment stay distinguishable. */
 molecule:[{ribbon:0x2f7d6a,css:'#2f7d6a'},{ribbon:0x8d4f9e,css:'#8d4f9e'}],
 // Magenta on purpose: the β6 site must not be confused with any of the four side-chain chemistry-class colours
 // (nonpolar gold, polar teal, acidic red, basic blue) that the surface step uses around it.
 donor:{color:0xb0327c,css:'#b0327c'},
 pocket:{color:0x1c7d94,css:'#1c7d94'},
 periphery:{color:0x8a7320,css:'#8a7320'},
 guide:{core:0x2b2b2b,peripheral:0x7d7d7d,secondary:0x7d7d7d,css:'#2b2b2b'},
 heme:{color:0xb03040,css:'#b03040'},iron:0xf0a020,ironCss:'#f0a020',
} as const;
const FADED=0.12,DIM=0.3;
/** Display-only van der Waals radius for Fe (approximate; the heme sits inside its pocket). */
const VDW:Record<string,number>={...SASA_RADII,FE:2.0};
/** Dash length and gap of a contact guide, Å. */
const DASH=0.42,GAP=0.3;

type Drawn={layer:SickleLayer;positions:T.Vector3[];color:number;name:string};

/**
 * HbA → HbS → polymerization view. HbS is drawn at its deposited coordinates (and, for the segment, at exact unit-cell
 * translations of them); HbA is drawn at the rigidly superposed coordinates computed by the analysis. Contacts between
 * molecules are drawn as dashed proximity guides with their measured distance — never as bonds, and the bond lists are
 * per molecule, so nothing covalent can ever be drawn across two molecules.
 */
export class SickleScene{
 private renderer:T.WebGLRenderer;
 private scene=new T.Scene();
 private camera=new T.PerspectiveCamera(36,1,0.5,2200);
 private controls:OrbitControls;
 private root=new T.Group();
 private resize:ResizeObserver;
 private sphere=new T.SphereGeometry(1,16,10);
 private cylinder=new T.CylinderGeometry(1,1,1,8);
 private hbs:T.Vector3[];private hba:T.Vector3[];
 private labels:{element:HTMLSpanElement;at:T.Vector3|null;fallback:T.Vector3|null;faded:boolean}[]=[];
 private distanceLabels:HTMLSpanElement[]=[];
 private view:SickleView|null=null;
 constructor(private host:HTMLDivElement,private model:SickleSceneModel,ariaLabel:string){
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.setClearColor(0xf7f9fb);
  const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',ariaLabel);host.append(canvas);
  this.scene.add(new T.AmbientLight(0xffffff,1.9));
  const light=new T.DirectionalLight(0xffffff,2.6);light.position.set(5,10,12);this.camera.add(light);this.scene.add(this.camera);this.scene.add(this.root);
  this.hbs=model.hbs.positions.map(p=>new T.Vector3(...p));this.hba=model.hba.positions.map(p=>new T.Vector3(...p));
  // One floating label per molecule instance, plus two for the local HbA / HbS comparison.
  for(let k=0;k<model.hbs.instances.length+2;k++){
   const element=document.createElement('span');element.className='atom-label molecule-label';element.hidden=true;host.append(element);
   this.labels.push({element,at:null,fallback:null,faded:false});
  }
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.minDistance=6;this.controls.maxDistance=900;
  this.controls.addEventListener('change',this.render);canvas.addEventListener('keydown',this.keyboard);
  this.camera.aspect=Math.max(host.clientWidth,1)/Math.max(host.clientHeight,1);this.camera.updateProjectionMatrix();
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.render();});
  this.resize.observe(host);
  this.cameraView({view:'mutation',token:0});
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
  this.distanceLabels.forEach(l=>l.remove());this.distanceLabels=[];
 }
 private instanced(geometry:T.BufferGeometry,count:number,opacity:number){
  const mesh=new T.InstancedMesh(geometry,this.material(0xffffff,opacity),Math.max(count,1));mesh.count=count;this.root.add(mesh);return mesh;
 }
 private setStick(mesh:T.InstancedMesh,i:number,a:T.Vector3,b:T.Vector3,r:number,color:number){
  mesh.setMatrixAt(i,new T.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()),new T.Vector3(r,a.distanceTo(b),r)));
  mesh.setColorAt(i,new T.Color(color));
 }
 private sticks(positions:T.Vector3[],atoms:number[],bonds:[number,number][],ball:number,rod:number,color:(atom:number)=>number,opacity:number){
  const balls=this.instanced(this.sphere,atoms.length,opacity),rods=this.instanced(this.cylinder,bonds.length*2,opacity);
  atoms.forEach((a,k)=>{balls.setMatrixAt(k,new T.Matrix4().compose(positions[a],new T.Quaternion(),new T.Vector3(ball,ball,ball)));balls.setColorAt(k,new T.Color(color(a)));});
  bonds.forEach(([a,b],k)=>{const mid=positions[a].clone().lerp(positions[b],0.5);this.setStick(rods,2*k,positions[a],mid,rod,color(a));this.setStick(rods,2*k+1,mid,positions[b],rod,color(b));});
 }
 private spheres(positions:T.Vector3[],atoms:number[],radius:(atom:number)=>number,color:(atom:number)=>number,opacity:number){
  const mesh=this.instanced(this.sphere,atoms.length,opacity);
  atoms.forEach((a,k)=>{const r=radius(a);mesh.setMatrixAt(k,new T.Matrix4().compose(positions[a],new T.Quaternion(),new T.Vector3(r,r,r)));mesh.setColorAt(k,new T.Color(color(a)));});
 }
 /** Ribbon of one chain, split at residue-number gaps so a missing residue never joins two segments. */
 private ribbon(d:Drawn,residues:PdbResidue[],color:(r:PdbResidue)=>number,opacity:number){
  const segments:PdbResidue[][]=[];
  for(const r of residues){const last=segments.at(-1)?.at(-1);if(!last||r.resSeq!==last.resSeq+1)segments.push([r]);else segments.at(-1)!.push(r);}
  for(const seg of segments){
   if(seg.length<2)continue;
   const {geometry}=ribbonGeometry(seg,d.layer.atoms,d.positions,color);
   const material=this.material(0xffffff,opacity);material.vertexColors=true;material.side=T.DoubleSide;
   this.root.add(new T.Mesh(geometry,material));
  }
 }
 private chemistryColor(layer:SickleLayer,atom:number){
  const a=layer.atoms[atom];
  if(['N','C','O','OXT'].includes(a.name))return 0xb3bcc2;
  const residue=layer.residues.find(r=>r.atoms.includes(atom));
  return residue?CLASS_INFO[layer.chemical[residue.index]].color:0x888888;
 }
 /** Dashed proximity guide with its measured length. Deliberately not a cylinder bond: this is never a chemical bond. */
 private dashes(a:T.Vector3,b:T.Vector3,color:number,radius=0.075){
  const total=a.distanceTo(b),step=DASH+GAP,count=Math.max(1,Math.floor(total/step));
  const mesh=this.instanced(this.cylinder,count,1);
  mesh.renderOrder=10;const m=mesh.material as T.Material;m.depthTest=false;m.depthWrite=false;m.transparent=true;
  for(let k=0;k<count;k++){
   const t0=(k*step)/total,t1=Math.min((k*step+DASH)/total,1);
   this.setStick(mesh,k,a.clone().lerp(b,t0),a.clone().lerp(b,t1),radius,color);
  }
  return a.clone().lerp(b,0.5);
 }
 private distanceLabel(at:T.Vector3,text:string,kind:string){
  const element=document.createElement('span');element.className=`atom-label distance-label ${kind}`;element.textContent=text;element.hidden=true;
  this.host.append(element);this.distanceLabels.push(element);
  return {element,at};
 }
 private pendingDistances:{element:HTMLSpanElement;at:T.Vector3}[]=[];

 /** Residues of one chain, with side-chain atoms and the bonds inside those residues. */
 private residueSticks(d:Drawn,residues:number[],color:(atom:number)=>number,ball:number,rod:number,opacity:number,sideChainOnly:boolean){
  const set=new Set(residues),atoms:number[]=[];
  for(const i of residues)for(const a of d.layer.residues[i].atoms)
   if(!sideChainOnly||!['N','C','O','OXT'].includes(d.layer.atoms[a].name))atoms.push(a);
  const own=new Set(atoms),residueOf=new Map<number,number>();
  for(const i of residues)for(const a of d.layer.residues[i].atoms)residueOf.set(a,i);
  const bonds=d.layer.bonds.filter(([a,b])=>own.has(a)&&own.has(b)&&set.has(residueOf.get(a)!)&&residueOf.get(a)===residueOf.get(b));
  this.sticks(d.positions,atoms,bonds,ball,rod,color,opacity);
  return atoms;
 }
 private residueSpheres(d:Drawn,residues:number[],color:(atom:number)=>number,opacity:number,extra=0){
  const atoms=residues.flatMap(i=>d.layer.residues[i].atoms);
  this.spheres(d.positions,atoms,a=>VDW[d.layer.atoms[a].element]+extra,color,opacity);
  return atoms;
 }

 /** Steps 1 and 2: the HbA β chain and the HbS donor βS chain, superposed, around residue 6. */
 private drawLocal(view:SickleView){
  const m=this.model,drawn:Drawn[]=[];
  if(view.structure!=='hbs')drawn.push({layer:m.hba,positions:this.hba,color:SICKLE_COLORS.hba.ribbon,name:'hba'});
  if(view.structure!=='hba')drawn.push({layer:m.hbs,positions:this.hbs,color:SICKLE_COLORS.hbs.ribbon,name:'hbs'});
  const spacefill=view.representation==='spacefill';
  for(const d of drawn){
   const local=d.name==='hba'?m.mutation.hba:m.mutation.hbs;
   const chainResidues=d.name==='hba'
    ? m.hba.residues.filter(r=>r.chain===m.hba.chain)
    : m.hbs.residues.filter(r=>r.chain===m.hbs.chains.find(c=>c.instance===m.mutation.hbs.instance&&c.residues.includes(m.mutation.hbs.residue))!.chain);
   const opacity=view.structure==='both'?0.85:1;
   if(!spacefill)this.ribbon(d,chainResidues,()=>d.color,view.representation==='ribbon'?opacity:DIM);
   const emphasise=view.highlight!=='pocket';
   if(spacefill){
    // Space filling of the local patch: van der Waals spheres coloured by side-chain chemistry class. Not a computed
    // molecular surface — the renderer draws atoms, so the view is labelled "space filling" everywhere.
    this.residueSpheres(d,local.neighbourhood,a=>this.chemistryColor(d.layer,a),opacity);
    if(emphasise)this.residueSpheres(d,[local.residue],()=>SICKLE_COLORS.donor.color,0.32,0.28);
   }else if(view.representation==='sticks'){
    this.residueSticks(d,local.neighbourhood,a=>this.chemistryColor(d.layer,a),0.24,0.12,opacity,true);
    if(emphasise)this.residueSticks(d,[local.residue],a=>['N','C','O','OXT'].includes(d.layer.atoms[a].name)?0xb3bcc2:SICKLE_COLORS.donor.color,0.34,0.19,1,false);
   }else if(emphasise){
    this.residueSticks(d,[local.residue],a=>['N','C','O','OXT'].includes(d.layer.atoms[a].name)?0xb3bcc2:SICKLE_COLORS.donor.color,0.34,0.19,1,false);
   }
   this.labelAt(d.name==='hba'?m.hbs.instances.length:m.hbs.instances.length+1,
    d.name==='hba'?`HbA · β${m.hba.label.slice(1)} Glu6`:`HbS · βS Val6`,d.positions[local.ca].clone(),false);
  }
 }

 /** Steps 3 and 4: whole molecules, with the measured contact guides between them. */
 private drawMolecules(view:SickleView,instances:string[]){
  const m=this.model,visible=new Set(instances),d:Drawn={layer:m.hbs,positions:this.hbs,color:0,name:'hbs'};
  const highlighted=new Set<number>();
  const showMutation=view.highlight!=='pocket',showPocket=view.highlight!=='mutation';
  const contacts=m.segmentContacts.filter(c=>visible.has(c.donorInstance)&&visible.has(c.acceptorInstance));
  const donors=new Set(contacts.map(c=>c.donorResidue)),pockets=new Set(contacts.flatMap(c=>c.acceptorResidues));
  if(showMutation)for(const r of donors)highlighted.add(r);
  if(showPocket)for(const r of pockets)highlighted.add(r);
  const spacefill=view.representation==='spacefill'&&view.step==='contact';
  for(const chain of m.hbs.chains){
   if(!visible.has(chain.instance))continue;
   const instance=m.hbs.instances.find(i=>i.id===chain.instance)!;
   const color=SICKLE_COLORS.molecule[(instance.assembly-1)%SICKLE_COLORS.molecule.length].ribbon;
   const residues=chain.residues.map(i=>m.hbs.residues[i]);
   if(spacefill){
    // Only the contact region is space filled; whole molecules stay as ribbons so the two stay distinguishable.
    this.ribbon(d,residues,()=>color,DIM);
   }else{
    this.ribbon(d,residues,r=>highlighted.has(r.index)?0xffffff:color,1);
    if(view.representation==='sticks'){
     const side=chain.residues.filter(i=>highlighted.has(i));
     if(side.length)this.residueSticks(d,side,a=>this.chemistryColor(m.hbs,a),0.22,0.12,1,true);
    }
   }
  }
  // Donor βVal6 and the acceptor pocket, always as atoms so the student can see what touches what.
  if(showMutation&&donors.size)
   (spacefill?this.residueSpheres(d,[...donors],()=>SICKLE_COLORS.donor.color,1)
    :this.residueSticks(d,[...donors],a=>['N','C','O','OXT'].includes(m.hbs.atoms[a].name)?0xb3bcc2:SICKLE_COLORS.donor.color,0.32,0.18,1,false));
  if(showPocket&&pockets.size)
   (spacefill?this.residueSpheres(d,[...pockets],()=>SICKLE_COLORS.pocket.color,1)
    :this.residueSticks(d,[...pockets],a=>SICKLE_COLORS.pocket.color,0.28,0.16,1,true));
  if(view.step==='contact'){
   const peripheral=m.contact.pocket.filter(q=>q.role==='peripheral');
   if(showPocket&&peripheral.length)
    (spacefill?this.residueSpheres(d,peripheral.map(q=>q.residue),()=>SICKLE_COLORS.periphery.color,1)
     :this.residueSticks(d,peripheral.map(q=>q.residue),a=>SICKLE_COLORS.periphery.color,0.24,0.14,1,true));
   if(view.showDistances)for(const g of m.contact.guides){
    const mid=this.dashes(this.hbs[g.a],this.hbs[g.b],SICKLE_COLORS.guide[g.kind]);
    this.pendingDistances.push(this.distanceLabel(mid,`${g.distance.toFixed(2)} Å`,g.kind));
   }
  }else if(view.showDistances){
   // Polymer view: one guide per junction, so the repeating contact is visible without crowding the screen.
   for(const c of contacts){
    const mid=this.dashes(this.hbs[c.a],this.hbs[c.b],SICKLE_COLORS.guide.core,0.11);
    this.pendingDistances.push(this.distanceLabel(mid,`${c.distance.toFixed(2)} Å`,'core'));
   }
  }
  if(view.showHeme)for(const h of m.hbs.hemes){
   if(!visible.has(h.instance))continue;
   const own=new Set(h.atoms),bonds=m.hbs.hemeBonds.filter(([a,b])=>own.has(a)&&own.has(b)&&a!==h.iron&&b!==h.iron);
   this.sticks(this.hbs,h.atoms.filter(a=>a!==h.iron),bonds,0.18,0.13,()=>SICKLE_COLORS.heme.color,1);
   this.spheres(this.hbs,[h.iron],()=>0.55,()=>SICKLE_COLORS.iron,1);
  }
  const mean=(atoms:number[])=>atoms.reduce((s,i)=>s.add(this.hbs[i]),new T.Vector3()).multiplyScalar(1/Math.max(atoms.length,1));
  m.hbs.instances.forEach((instance,k)=>{
   if(!visible.has(instance.id)){this.labelAt(k,'',null,false);return;}
   const donor=contacts.some(c=>c.donorInstance===instance.id),acceptor=contacts.some(c=>c.acceptorInstance===instance.id);
   const role=view.step==='contact'?donor?' · donor βVal6':acceptor?' · acceptor pocket':'':'';
   // Each molecule is named at its centroid; when the camera is inside the pocket that centroid leaves the view, so
   // the label falls back to this molecule's own side of the contact.
   const fallback=view.step!=='contact'?null
    :donor?mean(m.contact.donorSideChain)
    :acceptor?mean(m.contact.pocket.filter(q=>q.role==='core').flatMap(q=>q.sideChain)):null;
   this.labelAt(k,`${instance.label}${role}`,new T.Vector3(...instance.centroid),false,fallback);
  });
  return contacts.length;
 }
 private labelAt(index:number,text:string,at:T.Vector3|null,faded:boolean,fallback:T.Vector3|null=null){
  const label=this.labels[index];label.element.textContent=text;label.at=text?at:null;label.fallback=text?fallback:null;label.faded=faded;
 }

 /** Molecule instances drawn at a given step and segment length, centred on the deposited asymmetric unit. */
 visibleInstances(view:SickleView){
  const m=this.model,deposited=m.hbs.instances.filter(i=>i.deposited).map(i=>i.id);
  if(view.step!=='polymer')return view.showNeighbour?deposited:[m.hbs.instances.find(i=>i.id===m.contact.donorInstance)!.id];
  // Grow outwards from the deposited unit in unit-cell order, so the segment is always a contiguous repeat.
  const order=[...m.hbs.instances].sort((a,b)=>Math.abs(a.cells[0])-Math.abs(b.cells[0])||a.cells[0]-b.cells[0]||a.assembly-b.assembly);
  return order.slice(0,Math.min(view.segment,order.length)).map(i=>i.id);
 }

 update(view:SickleView){
  this.view=view;this.clear();this.pendingDistances=[];
  for(const l of this.labels){l.at=null;l.element.textContent='';}
  const local=view.step==='mutation'||view.step==='surface';
  const instances=this.visibleInstances(view);
  let guides=0;
  if(local)this.drawLocal(view);else guides=this.drawMolecules(view,instances);
  const ds=this.host.dataset,m=this.model;
  ds.step=view.step;ds.representation=view.representation;ds.highlight=view.highlight;ds.structure=local?view.structure:'hbs';
  ds.heme=view.showHeme?'on':'off';ds.distances=view.showDistances?'on':'off';ds.neighbour=view.showNeighbour?'on':'off';
  ds.instances=local?'':instances.join(',');ds.instanceCount=local?'0':String(instances.length);
  ds.contacts=local?'0':String(guides);
  ds.guides=String(this.distanceLabels.length);
  ds.donorResidue=`${m.hbs.atoms[m.contact.donorSideChain[0]].chain}:${m.hbs.residues[m.contact.donorResidue].resSeq}:${m.hbs.residues[m.contact.donorResidue].resName}`;
  ds.donorMolecule=m.contact.donorInstance;ds.acceptorMolecule=m.contact.acceptorInstance;
  // Displayed coordinates of one atom per layer, so automated checks can confirm nothing was moved.
  ds.hbsSample=this.hbs[m.contact.donorSideChain[0]].toArray().map(v=>v.toFixed(3)).join(',');
  ds.hbaSample=this.hba[m.mutation.hba.ca].toArray().map(v=>v.toFixed(3)).join(',');
  this.render();
 }

 cameraView(request:SickleCamera){
  const m=this.model,ds=this.host.dataset,view=this.view;
  let points:T.Vector3[],direction=new T.Vector3(0.35,0.2,1).normalize(),up=new T.Vector3(0,1,0),pad=3;
  if(request.view==='fit'){
   direction=this.camera.position.clone().sub(this.controls.target).normalize();up=this.camera.up.clone();
   points=this.currentPoints(view);
  }else if(request.view==='mutation'){
   const hbs=m.mutation.hbs.neighbourhood.flatMap(i=>m.hbs.residues[i].atoms).map(i=>this.hbs[i]);
   const hba=m.mutation.hba.neighbourhood.flatMap(i=>m.hba.residues[i].atoms).map(i=>this.hba[i]);
   points=[...(view?.structure==='hba'?[]:hbs),...(view?.structure==='hbs'?[]:hba)];
   if(!points.length)points=hbs;
   pad=1.5;
  }else if(request.view==='pocket'){
   points=[m.contact.donorResidue,...m.contact.pocket.map(q=>q.residue)].flatMap(i=>m.hbs.residues[i].atoms).map(i=>this.hbs[i]);
   pad=2;
  }else if(request.view==='segment'){
   points=this.currentPoints(view);
   // Look perpendicular to the lattice repeat, so the repeating direction lies across the screen.
   const repeat=this.repeatAxis();
   if(repeat){
    const world=Math.abs(repeat.y)>0.9?new T.Vector3(0,0,1):new T.Vector3(0,1,0);
    direction=repeat.clone().cross(world).normalize();
    up=direction.clone().cross(repeat).normalize();
   }
  }else{
   const ids=new Set([m.contact.donorInstance,m.contact.acceptorInstance]);
   points=m.hbs.chains.filter(c=>ids.has(c.instance)).flatMap(c=>c.residues).flatMap(i=>m.hbs.residues[i].atoms).map(i=>this.hbs[i]);
  }
  if(request.view!=='fit')ds.cameraPreset=request.view;
  const center=new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
  const right=up.clone().cross(direction).normalize(),screenUp=direction.clone().cross(right).normalize(),tan=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));
  let distance=this.controls.minDistance;
  for(const q of points){const v=q.clone().sub(center),z=v.dot(direction);
   distance=Math.max(distance,(Math.abs(v.dot(right))+pad)/(tan*this.camera.aspect)+z,(Math.abs(v.dot(screenUp))+pad)/tan+z);}
  this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);
  this.camera.up.copy(up.clone().sub(direction.clone().multiplyScalar(up.dot(direction))).normalize());
  ds.cameraTarget=center.toArray().map(v=>v.toFixed(3)).join(',');
  this.controls.update();this.render();
 }
 /** Unit vector of the segment's lattice repeat, from the first translated instance; null when only the deposited unit exists. */
 private repeatAxis(){
  const shifted=this.model.hbs.instances.find(i=>!i.deposited);
  if(!shifted)return null;
  const t=new T.Vector3(...shifted.centroid).sub(new T.Vector3(...this.model.hbs.instances.find(i=>i.deposited&&i.assembly===shifted.assembly)!.centroid));
  return t.lengthSq()<1e-6?null:t.normalize();
 }
 /** Atoms currently on screen, used by the fit and segment presets. */
 private currentPoints(view:SickleView|null){
  const m=this.model;
  if(!view||view.step==='mutation'||view.step==='surface'){
   const hbs=m.mutation.hbs.neighbourhood.flatMap(i=>m.hbs.residues[i].atoms).map(i=>this.hbs[i]);
   const hba=m.mutation.hba.neighbourhood.flatMap(i=>m.hba.residues[i].atoms).map(i=>this.hba[i]);
   return [...hbs,...hba];
  }
  const visible=new Set(this.visibleInstances(view));
  return m.hbs.chains.filter(c=>visible.has(c.instance)).flatMap(c=>c.residues).flatMap(i=>m.hbs.residues[i].atoms).map(i=>this.hbs[i]);
 }

 private place(element:HTMLElement,at:T.Vector3,offset=0){
  const p=at.clone().project(this.camera),w=element.offsetWidth,h=element.offsetHeight;
  const left=T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2-w/2,4,Math.max(4,this.host.clientWidth-w-4));
  const top=T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2-h/2+offset,4,Math.max(4,this.host.clientHeight-h-4));
  element.style.transform='none';element.style.left=`${left}px`;element.style.top=`${top}px`;
  return {p,box:{left,top,right:left+w,bottom:top+h},step:h+4};
 }
 private render=()=>{
  const ds=this.host.dataset,direction=this.camera.position.clone().sub(this.controls.target).normalize();
  ds.cameraDirection=direction.toArray().map(v=>v.toFixed(6)).join(',');ds.cameraDistance=this.camera.position.distanceTo(this.controls.target).toFixed(4);
  this.renderer.render(this.scene,this.camera);
  // Labels are placed in priority order (molecules first, then distances). One that would sit on top of a label already
  // placed is nudged vertically, and only dropped when no nearby slot is free — so a crowded contact stays readable.
  const placed:{left:number;top:number;right:number;bottom:number}[]=[];
  const overlaps=(b:{left:number;top:number;right:number;bottom:number})=>placed.some(o=>b.left<o.right+2&&o.left<b.right+2&&b.top<o.bottom+2&&o.top<b.bottom+2);
  const show=(element:HTMLSpanElement,at:T.Vector3,fallback:T.Vector3|null)=>{
   let anchor=at,{p,box,step}=this.place(element,anchor);
   if(Math.abs(p.z)>1||p.x<-1||p.x>1||p.y<-1||p.y>1){
    if(!fallback){element.hidden=true;return;}
    anchor=fallback;({p,box,step}=this.place(element,anchor));
    if(Math.abs(p.z)>1){element.hidden=true;return;}
   }
   for(const offset of [0,-step,step,-2*step,2*step]){
    ({box}=this.place(element,anchor,offset));
    if(!overlaps(box)){placed.push(box);element.hidden=false;return;}
   }
   element.hidden=true;
  };
  for(const l of this.labels){
   if(!l.at){l.element.hidden=true;continue;}
   show(l.element,l.at,l.fallback);
   l.element.classList.toggle('faded',l.faded);
  }
  for(const d of this.pendingDistances)show(d.element,d.at,null);
 };
 dispose(){
  this.resize.disconnect();this.controls.dispose();const c=this.renderer.domElement;c.removeEventListener('keydown',this.keyboard);
  this.clear();this.sphere.dispose();this.cylinder.dispose();this.labels.forEach(l=>l.element.remove());this.renderer.dispose();c.remove();
 }
}

export type {Vec};
