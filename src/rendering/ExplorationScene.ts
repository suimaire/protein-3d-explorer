import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {configureViewerControls} from './viewerControls';
import type {Vec} from '../geometry/vector';
export const v3=(p:Vec)=>new T.Vector3(...p);
/** Small opt-in scene for the new explorations. Existing scene lifecycles are unchanged. */
export class ExplorationScene{
 readonly world=new T.Scene();readonly root=new T.Group();
 readonly camera=new T.PerspectiveCamera(36,1,.1,800);
 clipOffset=0;
 readonly clip=new T.Plane(new T.Vector3(0,0,-1),1e6);
 readonly renderer:T.WebGLRenderer;readonly controls:OrbitControls;
 private resize:ResizeObserver;private observer:IntersectionObserver;
 private labels:{el:HTMLSpanElement;point:T.Vector3}[]=[];
 private ray=new T.Raycaster();private pointers=new Map<number,{x:number;y:number}>();
 private dragged=false;private frame:number|null=null;private animation:((dt:number)=>void)|null=null;private previous=0;private visible=true;private disposed=false;private frames=0;
 private points:T.Vector3[]=[];private cut:T.Vector3|null=null;
 private reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 constructor(readonly host:HTMLDivElement,label:string,private onPick:(id:string)=>void){
  this.renderer=new T.WebGLRenderer({antialias:true});this.renderer.setClearColor(0xf7f9fb);this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.localClippingEnabled=true;
  const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',label);host.append(canvas);
  this.world.add(new T.AmbientLight(0xffffff,1.9));const light=new T.DirectionalLight(0xffffff,2.6);light.position.set(5,10,12);this.camera.add(light);this.world.add(this.camera,this.root);
  this.controls=new OrbitControls(this.camera,canvas);configureViewerControls(this.controls,{pan:true});this.controls.minDistance=8;this.controls.maxDistance=500;
  this.controls.addEventListener('change',this.render);canvas.addEventListener('keydown',this.key);
  canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);
  this.camera.aspect=Math.max(1,host.clientWidth)/Math.max(1,host.clientHeight);this.camera.updateProjectionMatrix();
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.points.length)this.fit(this.points,'fit');else this.render();});this.resize.observe(host);
  this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.syncAnimation();});this.observer.observe(host);
  document.addEventListener('visibilitychange',this.syncAnimation);this.reduced.addEventListener('change',this.syncAnimation);
 }
 material(color:number,opacity=1){return new T.MeshStandardMaterial({color,transparent:opacity<1,opacity,roughness:.5,depthWrite:opacity===1,clippingPlanes:[this.clip],side:T.DoubleSide});}
 ball(p:T.Vector3,r:number,color:number,id?:string,parent=this.root,opacity=1){
  const mesh=new T.Mesh(new T.SphereGeometry(r,14,10),this.material(color,opacity));mesh.position.copy(p);if(id)mesh.userData.pick=id;parent.add(mesh);return mesh;
 }
 stick(a:T.Vector3,b:T.Vector3,r:number,color:number,parent=this.root){
  const mesh=new T.Mesh(new T.CylinderGeometry(r,r,a.distanceTo(b),8),this.material(color));mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(mesh);return mesh;
 }
 line(points:T.Vector3[],color:number,dashed=false,parent=this.root){
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),dashed?new T.LineDashedMaterial({color,dashSize:.45,gapSize:.35,clippingPlanes:[this.clip]}):new T.LineBasicMaterial({color,clippingPlanes:[this.clip]}));line.computeLineDistances();parent.add(line);return line;
 }
 label(text:string,point:T.Vector3){
  const el=document.createElement('span');el.className='atom-label addition-atom-label';el.textContent=text;this.host.append(el);this.labels.push({el,point});
 }
 clear(){
  this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});this.root.clear();
  this.labels.forEach(l=>l.el.remove());this.labels=[];
 }
 setClip(point:T.Vector3|null){this.cut=point;this.host.dataset.clip=point?'on':'off';this.render();}
 fit(points:T.Vector3[],view:'reset'|'fit'|'top'|'side'|'pore'='fit'){
  if(!points.length)return;this.points=points;
  const center=new T.Box3().setFromPoints(points).getCenter(new T.Vector3()),direction=view==='fit'?this.camera.position.clone().sub(this.controls.target).normalize():view==='top'?new T.Vector3(0,1,.001).normalize():view==='side'||view==='pore'?new T.Vector3(.25,0,1).normalize():new T.Vector3(.4,.25,1).normalize();
  if(direction.lengthSq()<.1)direction.set(.4,.25,1).normalize();
  const right=new T.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize(),tan=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));let d=10;
  for(const p of points){const q=p.clone().sub(center),z=q.dot(direction);d=Math.max(d,(Math.abs(q.dot(right))+3)/(tan*this.camera.aspect)+z,(Math.abs(q.dot(up))+3)/tan+z);}
  this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,d);this.controls.update();this.render();
 }
 setAnimation(callback:((dt:number)=>void)|null){this.animation=callback;this.syncAnimation();}
 private stopFrame(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.previous=0;this.host.dataset.animating='false';}
 private syncAnimation=()=>{
  this.stopFrame();if(!this.animation||!this.visible||document.hidden||this.reduced.matches||this.disposed)return;
  this.host.dataset.animating='true';this.frame=requestAnimationFrame(this.tick);
 };
 private tick=(now:number)=>{
  if(!this.animation||this.disposed)return;
  const dt=this.previous?Math.min((now-this.previous)/1000,.05):0;this.previous=now;this.animation(dt);this.frames++;this.host.dataset.animationFrames=String(this.frames);this.render();this.frame=requestAnimationFrame(this.tick);
 };
 private key=(e:KeyboardEvent)=>{
  const s=new T.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
  if(e.key==='ArrowLeft')s.theta-=.12;else if(e.key==='ArrowRight')s.theta+=.12;else if(e.key==='ArrowUp')s.phi-=.12;else if(e.key==='ArrowDown')s.phi+=.12;else if(e.key==='+'||e.key==='=')s.radius*=.9;else if(e.key==='-')s.radius*=1.1;else return;
  e.preventDefault();s.makeSafe();s.radius=T.MathUtils.clamp(s.radius,8,500);this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.controls.update();
 };
 private down=(e:PointerEvent)=>{this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===1)this.dragged=false;else this.dragged=true;};
 private move=(e:PointerEvent)=>{const p=this.pointers.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>5)this.dragged=true;};
 private cancel=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);this.dragged=true;};
 private up=(e:PointerEvent)=>{
  const p=this.pointers.get(e.pointerId);this.pointers.delete(e.pointerId);if(!p||this.dragged)return;
  const box=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((e.clientX-box.left)/box.width*2-1,1-(e.clientY-box.top)/box.height*2),this.camera);
  for(const hit of this.ray.intersectObject(this.root,true)){
   const id=hit.object.userData.pickAt?.(hit)??hit.object.userData.pick;
   if(!hit.object.visible||!id||this.clip.distanceToPoint(hit.point)<0)continue;
   this.onPick(String(id));break;
  }
 };
 render=()=>{
  if(this.disposed)return;
  const dir=this.camera.position.clone().sub(this.controls.target).normalize();this.clip.normal.copy(dir).negate();this.clip.constant=this.cut?this.cut.dot(dir)+this.clipOffset:1e6;
  this.renderer.render(this.world,this.camera);const d=this.host.dataset;d.cameraDirection=dir.toArray().map(x=>x.toFixed(6)).join(',');d.cameraTarget=this.controls.target.toArray().map(x=>x.toFixed(6)).join(',');d.cameraDistance=this.camera.position.distanceTo(this.controls.target).toFixed(4);
  const occupied:{x:number;y:number;w:number;h:number}[]=[];
  for(const {el,point} of this.labels){
   const p=point.clone().project(this.camera);el.hidden=Math.abs(p.z)>1||Math.abs(p.x)>1||Math.abs(p.y)>1||this.clip.distanceToPoint(point)<0;if(el.hidden)continue;
   const w=el.offsetWidth,h=el.offsetHeight,x=T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2+8,4,Math.max(4,this.host.clientWidth-w-4));let y=(1-p.y)*this.host.clientHeight/2-12;
   for(let tries=0;tries<12&&occupied.some(b=>x<b.x+b.w+4&&x+w>b.x-4&&y<b.y+b.h+4&&y+h>b.y-4);tries++)y+=h+4;
   y=T.MathUtils.clamp(y,4,Math.max(4,this.host.clientHeight-h-4));el.style.left=x+'px';el.style.top=y+'px';occupied.push({x,y,w,h});
  }
 };
 dispose(){
  this.disposed=true;this.stopFrame();this.animation=null;this.resize.disconnect();this.observer.disconnect();document.removeEventListener('visibilitychange',this.syncAnimation);this.reduced.removeEventListener('change',this.syncAnimation);this.controls.removeEventListener('change',this.render);this.controls.dispose();
  const c=this.renderer.domElement;c.removeEventListener('keydown',this.key);c.removeEventListener('pointerdown',this.down);c.removeEventListener('pointermove',this.move);c.removeEventListener('pointerup',this.up);c.removeEventListener('pointercancel',this.cancel);this.clear();this.renderer.dispose();c.remove();
 }
}
