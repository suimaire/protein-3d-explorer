import { useEffect,useRef,useState } from 'react';
import { PeptideScene } from '../rendering/PeptideScene';
import type { ViewOptions } from '../rendering/PeptideScene';
import type { Peptide } from '../geometry/peptide';
import type { Clash } from '../geometry/sterics';
export function MoleculeViewer({model,options,clashes,resetToken}:{model:Peptide;options:ViewOptions;clashes:Clash[];resetToken:number}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<PeptideScene|null>(null);const [error,setError]=useState(false);
  useEffect(()=>{try{scene.current=new PeptideScene(host.current!);}catch{setError(true);}return()=>scene.current?.dispose();},[]);
  useEffect(()=>{scene.current?.update(model,options,clashes);},[model,options,clashes]);
  useEffect(()=>{scene.current?.resetCamera();},[resetToken]);
  return <div className="molecule-viewer" ref={host} data-testid="viewer">{error&&<p role="alert" className="webgl-error">3D 화면을 시작하지 못했습니다. WebGL을 지원하는 브라우저에서 하드웨어 가속을 켜고 새로고침해 주세요.</p>}</div>;
}
