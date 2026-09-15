import {useEffect,useRef,useState} from 'react';
import {AssemblyScene,type AssemblyCamera,type AssemblyPick,type AssemblySceneModel,type AssemblyView} from '../rendering/AssemblyScene';

export function AssemblyViewer({model,view,camera,onPick,ariaLabel,testId='assembly-viewer'}:{model:AssemblySceneModel;view:AssemblyView;camera:AssemblyCamera;onPick:(pick:AssemblyPick)=>void;ariaLabel:string;testId?:string}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<AssemblyScene|null>(null),pick=useRef(onPick),label=useRef(ariaLabel),[error,setError]=useState(false);
 pick.current=onPick;
 useEffect(()=>{try{scene.current=new AssemblyScene(host.current!,model,p=>pick.current(p),label.current);}catch{setError(true);}return()=>{scene.current?.dispose();scene.current=null;};},[model]);
 useEffect(()=>{scene.current?.update(view);},[view,model]);
 useEffect(()=>{if(camera.token)scene.current?.cameraView(camera);},[camera]);
 return <div ref={host} className="molecule-viewer helix-viewer protein-viewer assembly-viewer" data-testid={testId}>{error&&<p role="alert" className="webgl-error">3D 화면을 시작하지 못했습니다. WebGL 지원 브라우저를 확인해 주세요.</p>}</div>;
}
