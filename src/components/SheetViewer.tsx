import {useEffect,useRef,useState} from 'react';
import {PeptideScene,DEFAULT_VIEW,type SheetView} from '../rendering/PeptideScene';
import type {Peptide} from '../geometry/peptide';
export type SheetOptions={backbone:boolean;sidechains:boolean;atoms:boolean;hbonds:boolean;direction:boolean};
export type SheetCamera={view:'side'|'top'|'edge'|'reset'|'fit';token:number};
export function SheetViewer({model,options,inspection,camera}:{model:Peptide;options:SheetOptions;inspection:SheetView;camera:SheetCamera}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<PeptideScene|null>(null),[error,setError]=useState(false);
 useEffect(()=>{try{scene.current=new PeptideScene(host.current!);}catch{setError(true);}return()=>scene.current?.dispose();},[]);
 useEffect(()=>{scene.current?.update(model,{...DEFAULT_VIEW,backbone:options.backbone,sidechains:options.sidechains,atoms:options.atoms,planes:false,labels:false,axes:false},[],undefined,inspection);},[model,options,inspection]);
 useEffect(()=>{scene.current?.cameraView(camera.view);},[camera,model]);
 return <div ref={host} className="molecule-viewer helix-viewer" data-testid="sheet-viewer">{error&&<p role="alert" className="webgl-error">3D 화면을 시작하지 못했습니다. WebGL 지원 브라우저를 확인해 주세요.</p>}</div>;
}
