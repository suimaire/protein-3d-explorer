import {useEffect,useRef,useState} from 'react';
import {ExplorationScene,v3} from '../rendering/ExplorationScene';
import {rnaseTopology,type RnaseModel} from '../protein/rnase';
import type {ProteinCamera} from './ProteinViewer';
import * as T from 'three';
export function RnaseTopologyViewer({model,condition,showBonds,selected,camera,onPick}:{model:RnaseModel;condition:'reduced'|'scrambled';showBonds:boolean;selected:number|null;camera:ProteinCamera;onPick:(r:number)=>void}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<ExplorationScene|null>(null),pick=useRef(onPick),[error,setError]=useState(false);pick.current=onPick;
 useEffect(()=>{try{scene.current=new ExplorationScene(host.current!,'RNase 교육용 모식도. 원자 구조가 아닌 잔기 수준 사슬. 드래그·방향키로 회전, 휠·더하기·빼기로 확대 축소.',id=>pick.current(Number(id)));scene.current.fit(rnaseTopology(model,condition).points.map(v3),'reset');}catch{setError(true);}return()=>{scene.current?.dispose();scene.current=null;};},[model]);
 useEffect(()=>{
  const s=scene.current;if(!s)return;s.clear();const graph=rnaseTopology(model,condition),points=graph.points.map(v3);
  graph.peptideEdges.forEach(([a,b])=>s.stick(points[a],points[b],.1,0x8597a2));
  points.forEach((p,i)=>s.ball(p,selected===i?.65:model.cysteines.has(i)?.44:.2,selected===i?0xb0327c:model.cysteines.has(i)?0xb18a16:0x8597a2,String(i)));
  s.label('N · Lys1',points[0]);s.label('C · Val124',points.at(-1)!);
  if(showBonds)for(const [a,b] of graph.crosslinks){
   const mid=points[a].clone().lerp(points[b],.5).add(new T.Vector3(0,5,4));
   const curve=new T.QuadraticBezierCurve3(points[a],mid,points[b]);s.line(curve.getPoints(32),0xb18a16,true);s.label(`Cys${model.structure.residues[a].resSeq} ↔ Cys${model.structure.residues[b].resSeq}`,curve.getPoint(.5));
  }
  if(selected!==null)s.label(`선택 · ${model.structure.residues[selected].resName} ${model.structure.residues[selected].resSeq}`,points[selected]);
  const d=host.current!.dataset;d.condition=condition;d.sequenceOrder=graph.residueOrder.join(',');d.peptideEdges=String(graph.peptideEdges.length);d.crosslinks=graph.crosslinks.map(p=>p.join('-')).join(',');d.bondsVisible=String(showBonds);d.evidence='schematic';s.render();
 },[model,condition,showBonds,selected]);
 useEffect(()=>{if(camera.token)scene.current?.fit(rnaseTopology(model,condition).points.map(v3),camera.view==='reset'?'reset':'fit');},[camera,model,condition]);
 return <div className="molecule-viewer protein-viewer addition-viewer" data-testid="rnase-schematic" ref={host}>{error&&<p role="alert">3D 모식도를 시작하지 못했습니다.</p>}</div>;
}
