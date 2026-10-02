import { createRoot } from 'react-dom/client';
import {lazy,Suspense,useState} from 'react';
import { PeptideGeometryLab } from './modules/PeptideGeometryLab';
import { AlphaHelixLab } from './modules/AlphaHelixLab';
import {BetaSheetLab} from './modules/BetaSheetLab';
// Loaded on demand: bundles the 1UBQ structure file and runs SASA only when opened.
const HydrophobicCoreLab=lazy(()=>import('./modules/HydrophobicCoreLab').then(m=>({default:m.HydrophobicCoreLab})));
// Loaded on demand: bundles 1QJ8 + OPM orientation and runs SASA for both proteins only when opened.
const SolubleMembraneLab=lazy(()=>import('./modules/SolubleMembraneLab').then(m=>({default:m.SolubleMembraneLab})));
// Loaded on demand: fetches the 2DN2 structure asset and builds the α2β2 model only when opened.
const HemoglobinQuaternaryLab=lazy(()=>import('./modules/HemoglobinQuaternaryLab').then(m=>({default:m.HemoglobinQuaternaryLab})));
// Loaded on demand: fetches the 2DN2 (T) and 2DN1 (R) structure assets and aligns them only when opened.
const HemoglobinTransitionLab=lazy(()=>import('./modules/HemoglobinTransitionLab').then(m=>({default:m.HemoglobinTransitionLab})));
// Loaded on demand: the MWC saturation model and graph; the 2DN2 / 2DN1 structures load later, only when a structure is inspected.
const HemoglobinCooperativityLab=lazy(()=>import('./modules/HemoglobinCooperativityLab').then(m=>({default:m.HemoglobinCooperativityLab})));
// Loaded on demand: fetches the 2HBS (deoxy HbS) and 2DN2 (HbA) structure assets and builds the contact segment only when opened.
const HbsPolymerizationLab=lazy(()=>import('./modules/HbsPolymerizationLab').then(m=>({default:m.HbsPolymerizationLab})));
const MutationToleranceLab=lazy(()=>import('./modules/MutationToleranceLab').then(m=>({default:m.MutationToleranceLab})));
import './styles.css';
type ModuleId='peptide'|'helix'|'sheet'|'core'|'membrane'|'hemoglobin'|'transition'|'cooperativity'|'sickle'|'mutation';
// Chapter groups: Korean title first, the English module name stays as the term students meet in sources.
const CHAPTERS:{title:string;modules:[ModuleId,string,string][]}[]=[
 {title:'1장 · 아미노산과 펩타이드',modules:[['peptide','펩타이드 결합과 φ·ψ 회전','Peptide Geometry']]},
 {title:'2장 · 서열에서 구조로',modules:[['helix','α-나선','α-Helix'],['sheet','β-병풍','β-Sheet'],['core','소수성 중심부','Hydrophobic Core'],['membrane','수용성 단백질과 막단백질','Soluble vs Membrane Protein']]},
 {title:'3장 · 구조에서 기능으로',modules:[['hemoglobin','헤모글로빈의 4차 구조','Hemoglobin Quaternary Structure'],['transition','T ↔ R 구조 전환','Hemoglobin T ↔ R Structural Transition'],['cooperativity','협동성과 알로스테리','Hemoglobin Cooperativity & Allostery'],['mutation','돌연변이 허용성','Mutation Tolerance'],['sickle','HbS의 중합','HbA → HbS → Polymerization']]},
];
const loading=(what:string)=><main><p className="loading-note">{what} 불러오는 중…</p></main>;
function App(){const [module,setModule]=useState<ModuleId>('peptide');return <><header className="site-header"><div><nav className="breadcrumb" aria-label="현재 위치"><a href="https://suimaire.github.io/">수업 포털</a><span aria-hidden="true">›</span><a href="https://suimaire.github.io/#molecular">분자 · 생화학 탐구</a></nav><h1>단백질 3D 구조 탐색기</h1><p>아미노산 사슬이 접혀 구조가 되고, 그 구조가 기능으로 이어지는 과정을 직접 돌려 보며 확인합니다.</p></div></header><nav className="module-nav" aria-label="학습 모듈">{CHAPTERS.map(chapter=><div className="module-nav__chapter" key={chapter.title}><p className="module-nav__title">{chapter.title}</p><div className="module-nav__items">{chapter.modules.map(([id,korean,english])=><button key={id} aria-pressed={module===id} onClick={()=>setModule(id)}>{korean}<small lang="en">{english}</small></button>)}</div></div>)}</nav>{module==='peptide'?<PeptideGeometryLab/>:module==='sheet'?<BetaSheetLab/>:module==='core'?<Suspense fallback={loading('PDB 1UBQ 구조를')}><HydrophobicCoreLab/></Suspense>:module==='hemoglobin'?<Suspense fallback={loading('PDB 2DN2 구조를')}><HemoglobinQuaternaryLab/></Suspense>:module==='transition'?<Suspense fallback={loading('PDB 2DN2 · 2DN1 구조를')}><HemoglobinTransitionLab/></Suspense>:module==='cooperativity'?<Suspense fallback={loading('협동성 모형을')}><HemoglobinCooperativityLab/></Suspense>:module==='mutation'?<Suspense fallback={loading('TEM-1 구조를')}><MutationToleranceLab onHbs={()=>setModule('sickle')}/></Suspense>:module==='sickle'?<Suspense fallback={loading('PDB 2HBS · 2DN2 구조를')}><HbsPolymerizationLab onTransition={()=>setModule('transition')}/></Suspense>:module==='membrane'?<Suspense fallback={loading('PDB 1UBQ · 1QJ8 구조를')}><SolubleMembraneLab/></Suspense>:<AlphaHelixLab onPeptide={()=>setModule('peptide')}/>}<footer><span>단백질 3D 구조 탐색기 <span>교육용 모델과 실험 구조(PDB 1UBQ, 1QJ8, 2DN2, 2DN1, 2HBS, 1BTL, 1JWP) · 길이 단위 Å</span></span><span className="footer-brand">HAFS Biology Lab · CH Park</span><span data-page-views="" hidden/></footer></>;}
createRoot(document.getElementById('root')!).render(<App/>);
