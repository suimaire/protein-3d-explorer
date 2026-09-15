import {useEffect,useRef,useState} from 'react';
import {TransitionScene,type TransitionCamera,type TransitionView} from '../rendering/TransitionScene';
import type {TransitionSceneModel} from '../protein/hemoglobinTransition';

export function TransitionViewer({model,view,camera,ariaLabel,testId='transition-viewer'}:{model:TransitionSceneModel;view:TransitionView;camera:TransitionCamera;ariaLabel:string;testId?:string}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<TransitionScene|null>(null),label=useRef(ariaLabel),[error,setError]=useState(false);
 useEffect(()=>{try{scene.current=new TransitionScene(host.current!,model,label.current);}catch{setError(true);}return()=>{scene.current?.dispose();scene.current=null;};},[model]);
 useEffect(()=>{scene.current?.update(view);},[view,model]);
 useEffect(()=>{if(camera.token)scene.current?.cameraView(camera);},[camera]);
 return <div ref={host} className="molecule-viewer helix-viewer protein-viewer assembly-viewer transition-viewer" data-testid={testId}>{error&&<p role="alert" className="webgl-error">3D 화면을 시작하지 못했습니다. WebGL 지원 브라우저를 확인해 주세요.</p>}</div>;
}
