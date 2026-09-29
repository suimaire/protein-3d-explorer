import {useEffect,useRef,useState} from 'react';
import {ProteinScene} from '../rendering/ProteinScene';
import {tem1Site,type MutationModel} from '../protein/mutationTolerance';
import {type MutationState} from '../modules/mutationState';
import {CATALYTIC_SITES,type MutationEvidence} from '../protein/mutationEvidence';
import {mutationLayers} from '../rendering/mutationView';

export function MutationViewer({model,state,evidence}:{model:MutationModel;state:MutationState;evidence:MutationEvidence}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<ProteinScene|null>(null),[error,setError]=useState(false);
 useEffect(()=>{
  try{
   const v=new ProteinScene(host.current!,model.wt,model.wtBonds,[],()=>{},{
    ariaLabel:'TEM-1 실험 구조 비교. 드래그 또는 방향키로 회전, 휠 또는 더하기·빼기로 확대·축소, Shift와 드래그로 이동.',
    preserveCameraOnResize:true,pan:true,
   });scene.current=v;
   const wt=model.wt,mt=model.aligned,m182=tem1Site(wt,'m182').index,t182=tem1Site(mt,'m182',true).index,s70=tem1Site(wt,'s70').index;
   v.setComparison([
    {id:'wt',structure:wt,bonds:model.wtBonds,ribbon:{color:0x91a8b6,opacity:1}},
    {id:'wt-overlay',structure:wt,bonds:model.wtBonds,ribbon:{color:0x8d979f,opacity:0.25}},
    {id:'mutant',structure:mt,bonds:model.mutantBonds,ribbon:{color:0x8babbc,opacity:0.72}},
    {id:'met',structure:wt,bonds:model.wtBonds,markers:[{residue:m182,color:0x15618f,label:'WT Met182'}]},
    {id:'met-ghost',structure:wt,bonds:model.wtBonds,markers:[{residue:m182,color:0x65727b,opacity:0.3,label:'WT Met182 · ghost',offset:10}]},
    {id:'thr',structure:mt,bonds:model.mutantBonds,markers:[{residue:t182,color:0xb0327c,label:'M182T Thr182'}]},
    {id:'ser-wt',structure:wt,bonds:model.wtBonds,markers:[{residue:s70,color:0xb9841b,label:'Ser70 · 촉매 잔기'}]},
    {id:'ser-mutant',structure:mt,bonds:model.mutantBonds,markers:[{residue:tem1Site(mt,'s70',true).index,color:0xb9841b,label:'Ser70 · 촉매 잔기'}]},
    {id:'wt-context',structure:wt,bonds:model.wtBonds,ribbon:{color:0x8297a4,opacity:0.22}},
    {id:'mutant-context',structure:mt,bonds:model.mutantBonds,ribbon:{color:0x899daf,opacity:0.22}},
    {id:'met-context',structure:wt,bonds:model.wtBonds,markers:[{residue:m182,color:0x65727b,opacity:0.45,label:'Met182 · 변이 위치'}]},
    {id:'thr-context',structure:mt,bonds:model.mutantBonds,markers:[{residue:t182,color:0xb0327c,opacity:0.45,label:'Thr182 · 변이 위치'}]},
    ...([false,true] as const).flatMap(mutant=>{
     const structure=mutant?mt:wt,bonds=mutant?model.mutantBonds:model.wtBonds,suffix=mutant?'mutant':'wt';
     const names=['Ser70','Lys73','Ser130','Glu166','Lys234'];
     return [
      {id:'active-'+suffix,structure,bonds,markers:CATALYTIC_SITES.map((key,i)=>({residue:tem1Site(structure,key,mutant).index,color:mutant?0xb0327c:0x15618f,backbone:true,label:(mutant?'M182T ':'WT ')+names[i],offset:mutant?10:-28}))},
      {id:'thermal-'+suffix,structure,bonds,markers:[
       {residue:tem1Site(structure,'m182',mutant).index,color:mutant?0xb0327c:0x15618f,backbone:true,label:mutant?'Thr182 · OH 포함':'Met182 · S 포함'},
       {residue:tem1Site(structure,'a185',mutant).index,color:0x946716,backbone:true,label:'Ala185 · helix 9',offset:10},
       ...(['p183','v184','e63','e64'] as const).map(key=>({residue:tem1Site(structure,key,mutant).index,color:0x7e929e,backbone:true,opacity:0.5,label:''})),
      ]},
     ];
    }),
    {id:'interaction-atoms',structure:mt,bonds:model.mutantBonds,markers:[
     {residue:t182,color:0xc3267c,atomNames:['OG1'],labelAtom:'OG1',label:'Thr182 Oγ · OH',offset:-52},
     {residue:tem1Site(mt,'a185',true).index,color:0x947014,atomNames:['N'],labelAtom:'N',label:'Ala185 backbone N',offset:45},
    ]},
    {id:'ncap-contact',structure:mt,bonds:model.mutantBonds,contacts:evidence.contact.compatible?[{from:evidence.contact.og,to:evidence.contact.n,color:0x947014,label:'O···N '+evidence.contact.distance.toFixed(2)+' Å · 거리 가이드'}]:[]},
    {id:'ala',structure:wt,bonds:model.wtBonds,markers:[{residue:tem1Site(wt,'a36').index,color:0x15618f,label:'WT Ala36 · A36D 위치'}]},
   ]);
  }catch{setError(true);}
  return()=>{scene.current?.dispose();scene.current=null;};
 },[model,evidence]);
 const layers=mutationLayers(state,evidence.contact.compatible).join(',');
 useEffect(()=>{
  scene.current?.showComparison(layers?layers.split(','):[],layers.includes('active-wt,active-mutant')?['active-mutant']:[]);
  if(!layers)scene.current?.stopCameraFocus();
 },[model,layers]);
 useEffect(()=>{
  if(!state.camera.token||!layers)return;
  if(state.camera.view==='whole')scene.current?.cameraView('fit');
  else scene.current?.focusResidue(tem1Site(model.wt,state.camera.view==='active'?'s70':state.camera.view==='a36'?'a36':'m182').index,state.camera.view==='active'?54:28);
 },[model,state.camera]);
 return <div ref={host} className="molecule-viewer mutation-viewer" data-testid="mutation-viewer">
  {error&&<p className="webgl-error" role="alert">3D 화면을 시작하지 못했습니다. 아래 잔기 설명과 실험 결과는 텍스트로 확인할 수 있습니다.</p>}
 </div>;
}
