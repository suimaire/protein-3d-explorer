import {useEffect,useRef,useState} from 'react';
import {PeptideScene,DEFAULT_VIEW} from '../rendering/PeptideScene';
import type {HelixView} from '../rendering/PeptideScene';
import type {Peptide} from '../geometry/peptide';
export type HelixOptions={backbone:boolean;sidechains:boolean;atoms:boolean;hbonds:boolean;axis:boolean};
export function HelixViewer({model,options,inspection,camera}:{model:Peptide;options:HelixOptions;inspection:HelixView;camera:{view:'side'|'top'|'reset'|'fit';token:number}}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<PeptideScene|null>(null),[error,setError]=useState(false);
  useEffect(()=>{try{scene.current=new PeptideScene(host.current!);}catch{setError(true);}return()=>scene.current?.dispose();},[]);
  useEffect(()=>{scene.current?.update(model,{...DEFAULT_VIEW,backbone:options.backbone,sidechains:options.sidechains,atoms:options.atoms,planes:false,labels:false,axes:false},[],inspection);},[model,options,inspection]);
  useEffect(()=>{scene.current?.cameraView(camera.view);},[camera]);
  return <div ref={host} className="molecule-viewer helix-viewer" data-testid="helix-viewer">{error&&<p role="alert" className="webgl-error">3D 화면을 시작하지 못했습니다. WebGL 지원 브라우저에서 하드웨어 가속을 확인해 주세요.</p>}</div>;
}
