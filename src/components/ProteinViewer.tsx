import {useEffect,useRef,useState} from 'react';
import {ProteinScene,type CameraPreset,type ProteinView,type SceneOptions} from '../rendering/ProteinScene';
import type {ProteinStructure} from '../protein/pdb';
import type {ResidueExposure} from '../protein/exposure';

export type ProteinCamera={view:CameraPreset;token:number};
export function ProteinViewer({structure,bonds,exposure,view,camera,onPick,options,testId='protein-viewer'}:{structure:ProteinStructure;bonds:[number,number][];exposure:ResidueExposure[];view:ProteinView;camera:ProteinCamera;onPick:(residue:number)=>void;options?:SceneOptions;testId?:string}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<ProteinScene|null>(null),pick=useRef(onPick),opts=useRef(options),[error,setError]=useState(false);
 pick.current=onPick;
 useEffect(()=>{try{scene.current=new ProteinScene(host.current!,structure,bonds,exposure,r=>pick.current(r),opts.current);}catch{setError(true);}return()=>{scene.current?.dispose();scene.current=null;};},[structure,bonds,exposure]);
 useEffect(()=>{scene.current?.update(view);},[view]);
 useEffect(()=>{if(camera.token)scene.current?.cameraView(camera.view);},[camera]);
 return <div ref={host} className="molecule-viewer helix-viewer protein-viewer" data-testid={testId}>{error&&<p role="alert" className="webgl-error">3D 화면을 시작하지 못했습니다. WebGL 지원 브라우저를 확인해 주세요.</p>}</div>;
}
