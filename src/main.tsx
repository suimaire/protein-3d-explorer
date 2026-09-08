import { createRoot } from 'react-dom/client';
import { PeptideGeometryLab } from './modules/PeptideGeometryLab';
import './styles.css';
createRoot(document.getElementById('root')!).render(<><header className="site-header"><div className="brand-mark" aria-hidden="true">P</div><div><h1>Protein <span>3D Explorer</span></h1><p>생화학 탐구 · 단백질의 구조를 만드는 기하학</p></div><span className="current-module">Peptide Geometry</span></header><PeptideGeometryLab/><footer>Protein 3D Explorer · Phase 1 <span>교육용 이상화 모델 · 길이 단위 Å</span></footer></>);
