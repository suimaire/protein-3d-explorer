import { createRoot } from 'react-dom/client';
import {useState} from 'react';
import { PeptideGeometryLab } from './modules/PeptideGeometryLab';
import { AlphaHelixLab } from './modules/AlphaHelixLab';
import {BetaSheetLab} from './modules/BetaSheetLab';
import './styles.css';
function App(){const [module,setModule]=useState<'peptide'|'helix'|'sheet'>('peptide');return <><header className="site-header"><div className="brand-mark" aria-hidden="true">P</div><div><h1>Protein <span>3D Explorer</span></h1><p>생화학 탐구 · 단백질의 구조를 만드는 기하학</p></div></header><nav className="module-nav" aria-label="학습 모듈"><button aria-pressed={module==='peptide'} onClick={()=>setModule('peptide')}><small>Chapter 1 · Amino Acid & Peptide</small>Peptide Geometry</button><button aria-pressed={module==='helix'} onClick={()=>setModule('helix')}><small>Chapter 2 · From Sequence to Structure</small>α-Helix</button><button aria-pressed={module==='sheet'} onClick={()=>setModule('sheet')}><small>Chapter 2 · From Sequence to Structure</small>β-Sheet</button></nav>{module==='peptide'?<PeptideGeometryLab/>:module==='sheet'?<BetaSheetLab/>:<AlphaHelixLab onPeptide={()=>setModule('peptide')}/>}<footer>Protein 3D Explorer · Phase 2B <span>교육용 이상화 모델 · 길이 단위 Å</span></footer></>;}
createRoot(document.getElementById('root')!).render(<App/>);
