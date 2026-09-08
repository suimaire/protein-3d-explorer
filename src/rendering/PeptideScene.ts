import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { COLORS, VDW } from '../data/science';
import type { Peptide, Atom } from '../geometry/peptide';
import { point } from '../geometry/peptide';
import { helixGeometry } from '../geometry/helix';
import type { HydrogenBond } from '../geometry/helix';
export type HelixView={selected:number;focus:number;hbonds:HydrogenBond[];showBonds:boolean;showAxis:boolean};
import type { Clash } from '../geometry/sterics';
export type ViewOptions={backbone:boolean;sidechains:boolean;atoms:boolean;vdw:boolean;planes:boolean;clashes:boolean;labels:boolean;axes:boolean};
export const DEFAULT_VIEW:ViewOptions={backbone:true,sidechains:true,atoms:true,vdw:false,planes:true,clashes:false,labels:true,axes:true};
const vector=(p:number[])=>new T.Vector3(...p);
export class PeptideScene {
  private renderer:T.WebGLRenderer;
  private scene=new T.Scene();
  private camera=new T.PerspectiveCamera(36,1,0.1,200);
  private controls:OrbitControls;
  private group=new T.Group();
  private resize:ResizeObserver;
  private labels:{element:HTMLSpanElement;leader:HTMLSpanElement;position:T.Vector3}[]=[];
  private center=new T.Vector3();
  private homeDirection=new T.Vector3(0,0,1);
  private homeUp=new T.Vector3(0,1,0);
  private positions:T.Vector3[]=[];
  private sphere=new T.SphereGeometry(1,24,16);
  private cylinder=new T.CylinderGeometry(1,1,1,12);
  private initialized=false;
  private helixFrame:ReturnType<typeof helixGeometry>|null=null;
  constructor(private host:HTMLDivElement) {
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.setClearColor(0xf7f9fb);
    const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','펩타이드 3D 모형. 드래그로 회전, 휠로 확대. 방향키로 회전, 더하기와 빼기로 확대 축소.');
    host.append(canvas);
    this.camera.aspect=host.clientWidth/host.clientHeight;this.camera.updateProjectionMatrix();
    this.scene.add(new T.AmbientLight(0xffffff,2.0));
    const light=new T.DirectionalLight(0xffffff,2.8);light.position.set(5,10,12);this.scene.add(light);
    this.scene.add(this.group);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.minDistance=7;this.controls.maxDistance=65;this.controls.addEventListener('change',this.render);
    canvas.addEventListener('keydown',this.keyboard);
    this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;this.renderer.setSize(w,h);const old=this.camera.aspect;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.initialized&&Math.abs(old-this.camera.aspect)>0.01){if(this.helixFrame)this.cameraView('fit');else this.resetCamera();}this.render();});
    this.resize.observe(host);
  }
  private keyboard=(e:KeyboardEvent)=>{
    const offset=this.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(offset);
    if(e.key==='ArrowLeft')s.theta-=0.12;else if(e.key==='ArrowRight')s.theta+=0.12;
    else if(e.key==='ArrowUp')s.phi-=0.12;else if(e.key==='ArrowDown')s.phi+=0.12;
    else if(e.key==='+'||e.key==='=')s.radius*=0.9;else if(e.key==='-')s.radius*=1.1;else return;
    e.preventDefault();s.makeSafe();s.radius=T.MathUtils.clamp(s.radius,7,65);this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.controls.update();
  };
  private material(color:number,opacity=1){return new T.MeshStandardMaterial({color,transparent:opacity<1,opacity,roughness:0.48,depthWrite:opacity===1});}
  private ball(p:T.Vector3,r:number,color:number,opacity=1){const mesh=new T.Mesh(this.sphere,this.material(color,opacity));mesh.position.copy(p);mesh.scale.setScalar(r);this.group.add(mesh);}
  private stick(a:T.Vector3,b:T.Vector3,r:number,color:number){const mesh=new T.Mesh(this.cylinder,this.material(color));mesh.position.copy(a).add(b).multiplyScalar(0.5);mesh.scale.set(r,a.distanceTo(b),r);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());this.group.add(mesh);}
  private label(text:string,position:T.Vector3,central=false){const element=document.createElement('span'),leader=document.createElement('span');element.className=`atom-label${central?' central':''}`;element.textContent=text;leader.className='label-leader';leader.setAttribute('aria-hidden','true');this.host.append(leader,element);this.labels.push({element,leader,position});}
  private clear(){this.group.traverse(obj=>{if(obj instanceof T.Mesh){const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());if(obj.geometry!==this.sphere&&obj.geometry!==this.cylinder)obj.geometry.dispose();}});this.group.clear();this.labels.forEach(x=>{x.element.remove();x.leader.remove();});this.labels=[];}
  update(model:Peptide,options:ViewOptions,clashes:Clash[],helix?:HelixView) {
    this.clear();
    const byId=new Map(model.atoms.map(a=>[a.id,a]));
    const visible=(a:Atom)=>a.sidechain?options.sidechains:options.backbone;
    for(const a of model.atoms){if(!visible(a))continue;const p=vector(a.position);if(options.atoms)this.ball(p,a.element==='H'?0.17:0.3,COLORS[a.element]);if(options.vdw)this.ball(p,VDW[a.element],COLORS[a.element],0.22);if(a.residue===(helix?.selected??3)&&options.atoms)this.ball(p,a.element==='H'?0.22:0.37,0xd39b20,0.32);}
    for(const b of model.bonds){const a=byId.get(b.a)!,c=byId.get(b.b)!;if(!helix){if(!visible(a)||!visible(c))continue;}else if(a.sidechain||c.sidechain){if(!options.sidechains)continue;}else if(!options.backbone)continue;const av=vector(a.position),cv=vector(c.position),mid=av.clone().lerp(cv,0.5);this.stick(av,mid,0.09,COLORS[a.element]);this.stick(mid,cv,0.09,COLORS[c.element]);if(b.order===2){const offset=vector(point(model,a.residue,'CA')).sub(av).cross(cv.clone().sub(av)).normalize().multiplyScalar(0.16);this.stick(av.clone().add(offset),cv.clone().add(offset),0.035,0x64717a);}}
    if(options.planes) for(let r=0;r<6;r++){
      const points=[point(model,r,'CA'),point(model,r,'C'),point(model,r,'O'),point(model,r+1,'N'),point(model,r+1,'CA'),point(model,r+1,'H')].map(vector);
      const origin=points[1],u=points[3].clone().sub(origin).normalize(),normal=u.clone().cross(points[0].clone().sub(origin)).normalize(),v=normal.clone().cross(u);
      const xs=points.map(p=>p.clone().sub(origin).dot(u)),ys=points.map(p=>p.clone().sub(origin).dot(v));
      const loX=Math.min(...xs)-0.2,hiX=Math.max(...xs)+0.2,loY=Math.min(...ys)-0.2,hiY=Math.max(...ys)+0.2;
      const corners=[[loX,loY],[hiX,loY],[hiX,hiY],[loX,hiY]].map(([x,y])=>origin.clone().addScaledVector(u,x).addScaledVector(v,y));
      const geometry=new T.BufferGeometry().setFromPoints([corners[0],corners[1],corners[2],corners[0],corners[2],corners[3]]);geometry.computeVertexNormals();
      const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:r===2||r===3?0x2a87ac:0x879cab,opacity:r===2||r===3?0.17:0.07,transparent:true,side:T.DoubleSide,depthWrite:false}));this.group.add(mesh);
    }
    if(options.axes&&options.backbone){this.stick(vector(point(model,3,'N')),vector(point(model,3,'CA')),0.14,0x087f83);this.stick(vector(point(model,3,'CA')),vector(point(model,3,'C')),0.14,0x9b4c9a);}
    if(options.labels&&options.backbone){for(let r=1;r<=5;r++)this.label(r===3?'Ala 3 · Cα':`Ala ${r}`,vector(point(model,r,'CA')),r===3);for(const name of ['N','C','O'])this.label(name==='C'?'C=O':name,vector(point(model,3,name)),true);this.label('Ac',vector(point(model,0,'CA')));this.label('NHMe',vector(point(model,6,'CA')));}
    if(options.clashes){for(const clash of clashes){const a=byId.get(clash.a)!,b=byId.get(clash.b)!;this.stick(vector(a.position),vector(b.position),0.045,0xc12d50);this.ball(vector(a.position),0.39,0xc12d50,0.48);this.ball(vector(b.position),0.39,0xc12d50,0.48);}}
    this.helixFrame=helix?helixGeometry(model):null;
    if(helix){
      const frame=this.helixFrame!,renderedPairs:string[]=[],focusedAtoms:string[]=[];
      if(helix.showAxis){this.dashed(vector(frame.start).addScaledVector(vector(frame.axis),-2),vector(frame.end).addScaledVector(vector(frame.axis),2),0.025,0x8395a1);this.label('Helix axis · guide',vector(frame.end).addScaledVector(vector(frame.axis),2));}
      if(helix.showBonds)for(const b of helix.hbonds){
        const focused=b.acceptor===helix.focus;renderedPairs.push(`${b.acceptor}-${b.donor}`);
        this.dashed(vector(point(model,b.acceptor,'O')),vector(point(model,b.donor,'H')),focused?0.075:0.035,focused?0xb87913:0x087f83);
        if(focused){if(options.atoms&&options.backbone)for(const [r,name] of [[b.acceptor,'C'],[b.acceptor,'O'],[b.donor,'H'],[b.donor,'N']] as const){this.ball(vector(point(model,r,name)),name==='H'?0.27:0.43,0xd39b20,0.34);focusedAtoms.push(`${r}:${name}`);}
          this.label(`Ala ${b.acceptor} C=O · acceptor`,vector(point(model,b.acceptor,'O')),true);
          this.label(`Ala ${b.donor} H–N · donor`,vector(point(model,b.donor,'N')),true);
        }
      }
      if(options.backbone){this.label('Ac · N end',vector(point(model,0,'CA')));this.label('NHMe · C end',vector(point(model,model.atoms.filter(a=>a.name==='CB').length+1,'CA')));}
      this.host.dataset.hbondPairs=renderedPairs.join(',');
      this.host.dataset.focusAtoms=focusedAtoms.join(',');
      this.host.dataset.selectedResidue=String(helix.selected);
    }
    this.positions=model.atoms.map(a=>vector(a.position));
    const ca=vector(point(model,3,'CA')),start=vector(point(model,0,'CA')),end=vector(point(model,6,'CA'));
    this.homeDirection.copy(start.clone().sub(ca).cross(end.clone().sub(ca)).normalize());
    if(this.homeDirection.lengthSq()<0.01)this.homeDirection.set(0,0,1);
    this.homeUp.copy(this.homeDirection).cross(end.clone().sub(start).normalize()).normalize();
    this.center.copy(new T.Box3().setFromPoints(this.positions).getCenter(new T.Vector3()));
    if(this.helixFrame){
      const axis=vector(this.helixFrame.axis),radial=vector(point(model,1,'CA')).sub(vector(this.helixFrame.start)).normalize();
      this.homeDirection.copy(radial).applyAxisAngle(axis,0.35);this.homeUp.copy(axis);
      this.center.copy(vector(this.helixFrame.center));
    }
    if(!this.initialized){this.resetCamera();this.initialized=true;}this.render();
  }
  private dashed(a:T.Vector3,b:T.Vector3,r:number,color:number){const count=Math.ceil(a.distanceTo(b)/0.30);for(let i=0;i<count;i++)this.stick(a.clone().lerp(b,i/count),a.clone().lerp(b,(i+0.55)/count),r,color);}
  cameraView(view:'side'|'top'|'reset'|'fit'){
    if(!this.helixFrame){this.resetCamera();return;}
    if(view==='fit'){this.fitCamera(this.camera.position.clone().sub(this.controls.target).normalize(),this.camera.up.clone());return;}
    if(view==='top'){this.fitCamera(vector(this.helixFrame.axis),this.homeDirection.clone());return;}
    this.resetCamera();
  }
  resetCamera(){this.fitCamera(this.homeDirection,this.homeUp);}
  private fitCamera(direction:T.Vector3,up:T.Vector3){
    const right=up.clone().cross(direction).normalize(),screenUp=direction.clone().cross(right).normalize(),tan=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));let distance=10;
    for(const p of this.positions){const v=p.clone().sub(this.center),z=v.dot(direction);distance=Math.max(distance,(Math.abs(v.dot(right))+2)/(tan*this.camera.aspect)+z,(Math.abs(v.dot(screenUp))+2)/tan+z);}
    this.controls.target.copy(this.center);this.camera.position.copy(this.center).addScaledVector(direction,distance);this.camera.up.copy(up);this.controls.update();this.render();
  }
  private render=()=>{
    this.host.dataset.cameraDirection=this.camera.position.clone().sub(this.controls.target).normalize().toArray().join(',');
    this.host.dataset.cameraDistance=String(this.camera.position.distanceTo(this.controls.target));
    this.renderer.render(this.scene,this.camera);
    const occupied:{x:number;y:number;w:number;h:number}[]=[];
    for(const label of [...this.labels].sort((a,b)=>Number(b.element.classList.contains('central'))-Number(a.element.classList.contains('central')))){
      const p=label.position.clone().project(this.camera),w=label.element.offsetWidth,h=label.element.offsetHeight;
      let x=T.MathUtils.clamp((p.x+1)*this.host.clientWidth/2+10,4,this.host.clientWidth-w-4),y=T.MathUtils.clamp((1-p.y)*this.host.clientHeight/2-24,4,this.host.clientHeight-h-4);
      for(let i=0;i<12&&occupied.some(r=>x<r.x+r.w+3&&x+w+3>r.x&&y<r.y+r.h+3&&y+h+3>r.y);i++)y+=h+3;
      label.element.style.transform='none';label.element.style.left=`${x}px`;label.element.style.top=`${y}px`;label.element.hidden=Math.abs(p.z)>1;occupied.push({x,y,w,h});
      const ax=(p.x+1)*this.host.clientWidth/2,ay=(1-p.y)*this.host.clientHeight/2,dx=T.MathUtils.clamp(ax,x,x+w)-ax,dy=T.MathUtils.clamp(ay,y,y+h)-ay;
      label.leader.style.left=`${ax}px`;label.leader.style.top=`${ay}px`;label.leader.style.width=`${Math.hypot(dx,dy)}px`;label.leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;label.leader.hidden=label.element.hidden;
    }
  };
  dispose(){this.resize.disconnect();this.controls.dispose();this.renderer.domElement.removeEventListener('keydown',this.keyboard);this.clear();this.sphere.dispose();this.cylinder.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
