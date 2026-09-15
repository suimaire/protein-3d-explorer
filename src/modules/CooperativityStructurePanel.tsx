import {useEffect,useMemo,useState} from 'react';
import {TransitionViewer} from '../components/TransitionViewer';
import {COMPARISON_COLORS,type TransitionCamera} from '../rendering/TransitionScene';
import {transitionSceneModel,R_SOURCE,T_SOURCE,type TransitionModel} from '../protein/hemoglobinTransition';
import {loadTransition} from '../protein/transitionAssets';
import {inspectionView,type InspectedEndpoint} from '../protein/cooperativityStructure';

/**
 * Loaded only after "Inspect … structure" is pressed: fetches the Phase 4B endpoints (2DN2 / 2DN1) and draws them with the
 * existing T ↔ R scene. Receives no model saturation or pressure — the structure never follows the pO₂ slider.
 */
export default function CooperativityStructurePanel({endpoint}:{endpoint:InspectedEndpoint}){
 const [model,setModel]=useState<TransitionModel|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let live=true;loadTransition().then(m=>{if(live)setModel(m);},e=>{if(live)setError(String(e));});return()=>{live=false;};},[]);
 const scene=useMemo(()=>model&&transitionSceneModel(model),[model]);
 const view=useMemo(()=>inspectionView(endpoint),[endpoint]);
 const [camera,setCamera]=useState<TransitionCamera>({view:'tetramer',token:0});
 if(error)return <p role="alert" className="small">PDB {T_SOURCE.pdbId} / {R_SOURCE.pdbId} 구조를 불러오지 못했습니다. ({error})</p>;
 if(!scene)return <p className="small" data-testid="coop-structure-loading">Loading PDB {T_SOURCE.pdbId} and {R_SOURCE.pdbId}…</p>;
 const source=endpoint==='T'?T_SOURCE:R_SOURCE;
 return <div className="coop-structure-view">
  <div className="camera-presets"><button onClick={()=>setCamera(c=>({view:'tetramer',token:c.token+1}))}>Tetramer view</button><button onClick={()=>setCamera(c=>({view:'fit',token:c.token+1}))}>Fit</button></div>
  <TransitionViewer testId="coop-viewer" model={scene} view={view} camera={camera}
   ariaLabel="Hemoglobin experimental endpoint 3D structure (PDB 2DN2 T-like, 2DN1 R-like). 드래그로 회전, 휠로 확대, 방향키로 회전."/>
  <div className="legend" data-testid="coop-structure-legend">
   <span><i style={{background:endpoint==='T'?COMPARISON_COLORS.T.css:COMPARISON_COLORS.R.css}}/>{endpoint==='T'?`T-like · ${T_SOURCE.pdbId} (deoxy)`:`R-like · ${R_SOURCE.pdbId} (O₂ bound, aligned on α1β1)`}</span>
   <span><i style={{background:endpoint==='T'?COMPARISON_COLORS.T.hemeCss:COMPARISON_COLORS.R.hemeCss,borderRadius:2}}/>Heme</span><span><i style={{background:COMPARISON_COLORS.ironCss}}/>Fe</span>
   {endpoint==='R'&&<span><i style={{background:COMPARISON_COLORS.ligandCss}}/>O₂ (4, as deposited in {R_SOURCE.pdbId})</span>}
  </div>
  <p className="small" data-testid="coop-structure-note">PDB {source.pdbId} · {source.method} {source.resolution} Å. 실험 구조 좌표 그대로입니다.
   {endpoint==='T'?' Deoxy 결정 구조라 deposited O₂가 없습니다.':' 네 heme 모두에 deposited O₂가 있으며, 모델 포화도에 맞춰 O₂를 지우거나 더하지 않습니다.'}</p>
 </div>;
}
