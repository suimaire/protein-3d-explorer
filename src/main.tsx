import { createRoot } from 'react-dom/client';
import {lazy,Suspense,useState} from 'react';
import { PeptideGeometryLab } from './modules/PeptideGeometryLab';
import { AlphaHelixLab } from './modules/AlphaHelixLab';
import {BetaSheetLab} from './modules/BetaSheetLab';
// Loaded on demand: bundles the 1UBQ structure file and runs SASA only when opened.
const HydrophobicCoreLab=lazy(()=>import('./modules/HydrophobicCoreLab').then(m=>({default:m.HydrophobicCoreLab})));
import './styles.css';
function App(){const [module,setModule]=useState<'peptide'|'helix'|'sheet'|'core'>('peptide');return <><header className="site-header"><div className="brand-mark" aria-hidden="true">P</div><div><h1>Protein <span>3D Explorer</span></h1><p>생화학 탐구 · 단백질의 구조를 만드는 기하학</p></div></header><nav className="module-nav" aria-label="학습 모듈"><button aria-pressed={module==='peptide'} onClick={()=>setModule('peptide')}><small>Chapter 1 · Amino Acid & Peptide</small>Peptide Geometry</button><button aria-pressed={module==='helix'} onClick={()=>setModule('helix')}><small>Chapter 2 · From Sequence to Structure</small>α-Helix</button><button aria-pressed={module==='sheet'} onClick={()=>setModule('sheet')}><small>Chapter 2 · From Sequence to Structure</small>β-Sheet</button><button aria-pressed={module==='core'} onClick={()=>setModule('core')}><small>Chapter 2 · From Sequence to Structure</small>Hydrophobic Core</button></nav>{module==='peptide'?<PeptideGeometryLab/>:module==='sheet'?<BetaSheetLab/>:module==='core'?<Suspense fallback={<main><p>Loading PDB 1UBQ…</p></main>}><HydrophobicCoreLab/></Suspense>:<AlphaHelixLab onPeptide={()=>setModule('peptide')}/>}<footer>Protein 3D Explorer · Phase 3A <span>교육용 모델 및 실험 구조(PDB 1UBQ) · 길이 단위 Å</span><span data-page-views="" hidden/></footer></>;}
createRoot(document.getElementById('root')!).render(<App/>);
