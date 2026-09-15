# Protein 3D Explorer

고등학교 심화 생화학 수업용 3D 탐색기. 현재 Peptide Geometry, α-Helix Lab, β-Sheet Lab, Hydrophobic Core, Soluble vs Membrane Protein, Hemoglobin Quaternary Structure, Hemoglobin T ↔ R Structural Transition을 제공합니다.
Ac–(L-Ala)₅–NHMe의 Ala 3에서 φ/ψ를 조작하고 peptide plane, schematic Ramachandran map,
0.40 Å를 넘는 심한 비결합 원자 겹침을 함께 관찰합니다. 실제 에너지 계산이나 protein folding simulation은 아닙니다.

## Available modules

### Chapter 1 — Amino Acid & Peptide

**Peptide Geometry** — 중앙 Ala 3 φ/ψ 조작, peptide planarity, Ramachandran 연계, steric 표시.

### Chapter 2 — From Sequence to Structure

**α-Helix Lab** — idealized Ac–(L-Ala)₁₂–NHMe, 반복 −60°/−45° backbone, 좌표로 검증한
8개 i→i+4 H-bond, residue inspection과 Ramachandran marker, Side/Top/Reset/Fit camera,
backbone/side chains/atoms/H-bonds/axis 표시 옵션.
Donor/acceptor 결합 관계·거리·각도를 검증한 H-bond 10쌍(내부 8 + cap 2)은 serious unfavorable clash에서 제외하여 정상 α-helix는 0쌍입니다. 상세 기준과 cap 측정값은 `ALPHA_HELIX_VALIDATION.md`에 기록했습니다.

**β-Sheet Lab** — Idealized poly-L-alanine β-sheet, 3 × Ac–(L-Ala)₇–NHMe.
Antiparallel / Parallel 전환, 좌표로 판정한 inter-strand backbone H-bond (14 / 12개),
N→C 방향 안내선, strand/residue 선택과 실제 φ/ψ Ramachandran 연계,
Sheet/Top/Edge/Reset/Fit, backbone/side chains/atoms/H-bonds/direction 표시 옵션.
대표 φ −135° / ψ +132.272099°, trans ω와 side-chain 교대 방향을 검증했습니다.
두 배열 모두 cap을 포함한 심한 불리한 겹침은 0개입니다. 상세 audit: `BETA_SHEET_VALIDATION.md`.

**Hydrophobic Core** — 실험 구조 PDB 1UBQ (human ubiquitin, X-ray 1.8 Å, chain A, 76 residues).
Ribbon / Atoms / Space filling, Color by chemistry(nonpolar · polar uncharged · acidic · basic)와 exposure,
이 단백질 안에서의 More buried / More exposed 25% 필터, visual clipping 단면 보기, residue 선택 정보.
Solvent exposure는 Shrake–Rupley SASA(probe 1.4 Å, Bondi radii)와 Tien et al. (2013) 최대값으로 정규화한
relative SASA입니다. 통계적 경향과 실제 예외(Leu8, Gln41)를 함께 보여줍니다. 상세: `HYDROPHOBIC_CORE_VALIDATION.md`.

**Soluble vs Membrane Protein** — 수용성 ubiquitin(1UBQ)과 외막 β-barrel 단백질 OmpX(PDB 1QJ8, X-ray 1.9 Å, monomer)를
같은 chemistry 색으로 나란히 비교합니다. OPM 1qj8 방향(막 법선 z, hydrophobic 경계 ±11.8 Å)을 rigid transform으로 적용하고
반투명 slab로 막 hydrophobic region을 표시합니다. Surface / Buried / Lipid-facing / Aqueous-facing 강조, Side/Top view,
residue별 surface accessibility·membrane depth·lipid-facing candidate 판정. 상세: `SOLUBLE_MEMBRANE_VALIDATION.md`.

### Chapter 3 — From Structure to Function

**Hemoglobin Quaternary Structure** — 실험 구조 PDB 2DN2 (human deoxyhemoglobin A, X-ray 1.25 Å)의 α2β2 tetramer.
Biological assembly(deposited chain A–D, identity operator)와 α/β chain(UniProt DBREF·entity sequence)을 검증했습니다.
Ribbon / Atoms / Space filling, Color by subunit(α1–Chain A 등 legend)·by chain type, subunit 선택(나머지 반투명),
Heme 1–4 확인과 Focus heme(측정한 Fe–proximal His), 좌표로 계산한 subunit interface(≤ 4.0 Å)와
설명용 Separate subunits(실험 구조 상태 아님). 한 가지 구조 상태(deoxy)만 보여줍니다. 상세: `HEMOGLOBIN_QUATERNARY_VALIDATION.md`.

**Hemoglobin T ↔ R Structural Transition** — 두 실험 구조 PDB 2DN2 (deoxy, T-like)와 PDB 2DN1 (oxy, O₂ bound, R-like; 둘 다
X-ray 1.25 Å, 같은 연구)를 비교합니다. 2DN1 tetramer는 파일의 BIOMT operator로 만들고, α1β1 dimer의 Cα만으로 R을 T에
rigid-body 정렬합니다(tetramer 전체 fit 아님). T state / Overlay / R state / Morph, Reference·Moving αβ dimer 강조,
Heme·O₂ ligand·Interface·Rearrangement guide, Tetramer / Dimer comparison / Heme view, heme별 Fe–His·Fe–porphyrin 평면 비교.
화면 수치: reference dimer RMSD 0.93 Å, α2β2 상대 회전 14.1°. Morph는 실제 분자 경로가 아닌 시각적 보간임을 항상 표시합니다.
상세: `HEMOGLOBIN_TR_TRANSITION_VALIDATION.md`.

## Local development

Node.js 22.12 이상, npm을 사용합니다.

```sh
npm ci
npm run dev
```

출력된 로컬 주소의 `/protein-3d-explorer/` 경로로 접속합니다.

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
npm run test:browser
```

브라우저 검증은 실행 중인 production preview와 Playwright Chromium을 사용합니다.
필요한 경우 `npx playwright install chromium`으로 테스트 브라우저를 설치합니다.
프로젝트 내부 설치를 원하면 PowerShell에서 먼저
`$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.browser-cache"`를 설정합니다.
검증 스크립트는 `.browser-cache`가 있으면 자동으로 사용합니다.
`npm run test:browser`는 다섯 모듈의 검증을 모두 실행합니다 (24 + 24 + 31 + 18 + 16개).
검증 스크립트는 `artifacts/`에 desktop/mobile 캡처와 보고서를 저장합니다.
β-Sheet 캡처: `phase2b-beta-antiparallel.png`, `phase2b-beta-parallel.png`, `phase2b-beta-edge-view.png`, `phase2b-mobile-390.png`.
`node scripts/beta-audit.mjs`로 전체 원자 좌표, torsion, H-bond, cap/clash 결과를 `artifacts/beta-audit.json`에 재생성할 수 있습니다.
자동 테스트: 기존 172 + Soluble vs Membrane 26 = 198개. Typecheck와 production build를 함께 검증합니다.
Hydrophobic Core 캡처: `phase3a-hydrophobic-core.png`, `phase3a-buried.png`, `phase3a-exposed.png`, `phase3a-cross-section.png`.
`node scripts/core-audit.mjs`로 residue별 SASA·순위·그룹 구성을 `artifacts/core-audit.json`에 재생성합니다.
`node scripts/membrane-audit.mjs`는 OmpX 방향·분류·조성을 `artifacts/membrane-audit.json`에 재생성합니다 (`--fit <OPM 1qj8.pdb>`로 OPM 변환을 재계산).
Soluble vs Membrane 캡처: `phase3b-soluble-vs-membrane.png`, `phase3b-lipid-facing.png`, `phase3b-aqueous-facing.png`, `phase3b-mobile.png`.
`python scripts/sasa-reference.py`(Biopython 필요, 프로젝트 의존성 아님)는 독립 SASA 참조 fixture를 만듭니다.
α-Helix 캡처: `phase2a-alpha-helix.png`, `phase2a-alpha-helix-top.png`, `phase2a-mobile-390.png`.
`node scripts/hemoglobin-transition-audit.mjs`는 T↔R 대응·정렬·회전·heme·contact·morph 수치를 `artifacts/hemoglobin-transition-audit.json`에 재생성합니다.
Hemoglobin T ↔ R 캡처: `phase4b-hb-t.png`, `phase4b-hb-r.png`, `phase4b-hb-overlay.png`, `phase4b-hb-moving-dimer.png`, `phase4b-hb-morph-midpoint.png`, `phase4b-hb-mobile.png`.
`npm run test:browser`는 현재 일곱 모듈의 검증 스크립트 여섯 개와 T ↔ R 스크립트를 모두 실행합니다.

## GitHub Pages

기존 배포 주소: https://suimaire.github.io/protein-3d-explorer/

Vite base는 `/protein-3d-explorer/`로 설정했습니다. `dist/`가 정적 배포 산출물입니다.
이번 Phase 3B에서는 기존 배포 설정과 workflow를 변경하지 않았으며 push하지 않습니다.

## Structure

- `src/geometry/`: 순수 TypeScript 좌표·결합 그래프·이면각·clash 계산
- `src/protein/`: PDB parser, Shrake–Rupley SASA, relative exposure·순위·그룹, chemistry 분류와 색
- `src/data/structures/1UBQ.pdb`, `1QJ8.pdb`: RCSB에서 받은 원본 그대로의 구조 파일
- `src/protein/ompx.ts`, `membrane.ts`, `rigid.ts`: OPM 방향 rigid transform, 막 slab, lipid-facing 분류
- `src/data/`: 과학 상수, 대표각, 완성된 모듈 목록, 교육 설명
- `src/rendering/`: Three.js scene, 원자/결합/실제 좌표 기반 plane, camera controls; `ProteinScene.ts`는 ribbon/atoms/space filling, clipping, picking
- `src/components/`: viewer lifecycle, Ramachandran SVG
- `src/modules/`: Peptide Geometry / α-Helix / β-Sheet / Hydrophobic Core / Soluble vs Membrane의 state와 학생 조작 UI
- `src/main.tsx`, `src/styles.css`: 공통 앱 골격과 반응형 디자인
- `tests/`: signed torsion, geometry invariants, clash exclusion, plot mapping
- `scripts/browser-test.mjs`, `scripts/helix-browser-test.mjs`: 실제 Chromium UI·WebGL 검증; `scripts/beta-browser-test.mjs`는 β-Sheet 검증, `scripts/core-browser-test.mjs`는 Hydrophobic Core 검증
- `SCIENTIFIC_NOTES.md`: 모델의 정확성·가정·근거
- `STERIC_CLASH_VALIDATION.md`: Phase 1.1 pair별 clash audit와 최종 정책
- `ALPHA_HELIX_VALIDATION.md`: Phase 2A measured geometry, H-bond / clash audit
- `BETA_SHEET_VALIDATION.md`: Phase 2B geometry, registration, H-bond pair audit
- `HYDROPHOBIC_CORE_VALIDATION.md`: Phase 3A 구조 출처, SASA 검증, 구성 분포, residue 수동 검토
- `SOLUBLE_MEMBRANE_VALIDATION.md`: Phase 3B 후보 평가, OPM orientation, 분류 기준, 조성, residue 수동 검토
- `HEMOGLOBIN_QUATERNARY_VALIDATION.md`, `HEMOGLOBIN_TR_TRANSITION_VALIDATION.md`: Phase 4A/4B 구조 선택, assembly, chain 대응, 정렬·회전 수치
- `src/protein/hemoglobin.ts`, `hemoglobinTransition.ts`, `quaternary.ts`; `src/rendering/AssemblyScene.ts`, `TransitionScene.ts`: hemoglobin 분석과 3D 화면
- `CURRENT_STATUS.md`: 최신 완료 상태와 후속 작업

React/Vite/TypeScript/Vitest는 기존 carbohydrate explorer 패턴을 따릅니다. Three.js r170과
원자/결합 표현은 lipid explorer의 기술 방향을 따르며, 기존 프로젝트 파일을 복사·수정하지 않습니다.
새 모듈은 geometry, renderer, module UI를 분리해 추가하고 완성된 모듈만 학생 메뉴에 등록합니다.

## Session rule

**매 개발 세션 종료 시 `CURRENT_STATUS.md`를 갱신합니다.** 과학 모델을 바꾸면
`SCIENTIFIC_NOTES.md`와 관련 검증도 갱신합니다. 현재 범위 밖의 모듈·학습지·로그인 기능은 추가하지 않습니다.
