# Mutation Tolerance 2차 확장 검증 보고서

검증일: 2026-09-29. 기존 working tree의 미커밋 구현을 기준으로 확장했다. branch는 main 그대로이며 commit / push / branch 변경을 하지 않았다. 기존 PDB asset, HbS 구현 및 기존 테스트는 변경하지 않았다.

## A. 기존 Mutation Tolerance 구조 분석

- MutationToleranceLab: useReducer 기반 5단계(stage), optional prediction, overlay, camera token.
- MutationViewer: 로컬 1BTL/1JWP load, 공통 auth residue Cα 263개 proper rigid alignment, ProteinScene 한 개와 cached ProteinComparison layers.
- 기존 summary는 Met ghost / Thr, Ser70, WT–M182T overlay 및 전체/잔기 초점. 결과는 별도 reveal 이후 표시.
- 기존 responsive: 3열 desktop, tablet 2열+결과행, mobile 1열. 이번 변경은 **M182T 결과 공개 후** tablet/mobile을 원인→결과 카드→관찰 순서로 확장.
- 기존 focusResidue의 420 ms tween과 prefers-reduced-motion 즉시 전환을 재사용. Three.js 좌표 morph 없음.
- 기존 그래프는 모듈별 SVG/Canvas 구현이며 공용 assay chart utility는 없음. 새 assay는 간단한 inline SVG.
- 기준 검증: npm test 13 files / 358 tests 통과, npm run typecheck 통과, npm run build 통과. 기존 Three.js chunk >500 kB 경고 1종.
- 상위 경로와 저장소에서 적용 가능한 AGENTS.md 없음. 기존 변경 파일의 사본은 OS 임시 폴더에 보존.

## B. 추가 result explanation state model

ResultExplanationMode = summary | activity | mic | thermal.
explanation은 discriminated union이며 activity comparison, MIC 농도/응답, thermal comparison/interaction/temperature를 해당 mode 안에 한정한다. stage=M182_RESULTS_REVEALED에서만 진입 가능.
visited는 고유 mode 방문 집합; 세 결과 방문 후 integrated interpretation 및 마지막 질문 공개.
reset / A36 / restart에서 mode, 방문, 질문 응답 초기화. thermal WT 비교는 M182T applied stage와 독립적이다.
온도와 농도 조작은 camera token, layer selection, atom coordinates를 변경하지 않는다.

## C. 효소 활성 mode

Ser70 쪽 camera focus, 전체 cartoon context, 촉매 잔기 ball-and-stick, 희미한 182 표시.
WT active site / M182T active site / 중첩 비교 제공. 중첩 시 중복 라벨을 숨기고 label collision 회피와 실제 원자 위치 연결선을 제공.
전체 RMSD 0.5248679777370812 Å. 선택 Cα RMSD **0.2629197219458724 Å**.
선택 정의: Ser70, Lys73, Ser130, Glu166, Lys234의 5개 Cα. **전체 263 Cα 정렬 후 측정; 별도 local fitting 없음**. 곁사슬 RMSD로 해석하지 않음.
표시값은 runtime 좌표 계산으로 산출하며 하드코딩하지 않음.

## D. catalytic residue mapping

실제 PDB auth identifier와 기존 RCSB mmCIF _pdbx_poly_seq_scheme fixture를 다시 대조. 모두 chain A, 빈 insertion code, WT/M182T 양쪽 동일 mapping.

| Residue | auth_seq / pdb_seq | label_seq |
|---|---:|---:|
| Ser70 | 70 | 45 |
| Lys73 | 73 | 48 |
| Ser130 | 130 | 105 |
| Glu166 | 166 | 141 |
| Lys234 | 234 | 209 |
| Glu63 | 63 | 38 |
| Glu64 | 64 | 39 |
| Met/Thr182 | 182 | 157 |
| Pro183 | 183 | 158 |
| Val/Ala184 | 184 | 159 |
| Ala185 | 185 | 160 |

array offset으로 선택하지 않는다. chain/auth/insertion/residue-name 검증 후 residue index를 renderer에 전달한다.

## E. activity assay visualization / raw-data 한계

[Jacquier et al. 2013, Table 2 및 Methods](https://pmc.ncbi.nlm.nih.gov/articles/PMC3740883/) 확인:
정제 효소, nitrocefin 32 μM, 486 nm 흡광도 초기 속도; Table 2의 37°C Vi/[E₀]는 WT 142 ± 2, M182T 145 ± 15 s⁻¹.
kcat으로 재명명하지 않았고 ±의 통계적 종류를 추정하지 않았다.
SVG는 수치 눈금 없이 거의 평행한 실선/점선으로 **측정 원리 개념도**를 표현한다. 142와 145로 raw trace를 합성하지 않는다.

## F. MIC mode

MIC에서는 같은 canvas를 보존한 채 viewer region을 숨기고 카메라 tween을 취소한다.
이산 range slider와 직접 선택 버튼, WT/M182T 두 agar-assay 개념 행 제공.
250에서는 성장 가능, 500에서는 억제 상태로 함께 변경. 500에서 최초 억제 endpoint 설명.
질문 응답 후 catalytic activity + abundance + folding/stability + cellular environment + growth cost → growth under antibiotic → MIC 표시.

## G. 실제 concentration series

**0, 12.5, 25, 50, 100, 250, 500, 1000, 2000, 4000 mg/L.**
Jacquier 원문 Methods의 MIC Measurements와 일치. 일부 후속 논문에 나타나는 125가 아닌 원문의 100을 사용.
Mueller Hinton agar, 37°C, 18 h; 성장을 억제하는 첫 농도. Table 2의 WT/M182T MIC는 모두 500 mg/L.

## H. MIC 개념도 한계

원문은 agar dilution assay이다. raw well image처럼 제시하지 않는다.
배지 모양과 성장/억제 표시는 보고된 endpoint를 설명하는 개념화이며 개별 농도의 실제 사진/성장곡선을 복제하지 않는다. 수치적 세균 성장 kinetics 없음.

## I. thermal mode

182 주변 camera focus, 낮은 강조도 cartoon, Thr/Met182와 Ala185, Pro183·Val/Ala184·Glu63/64 주변 원자 표시.
WT Met182 / M182T Thr182 반복 비교. 상호작용 공개 시 OG1과 backbone N 별도 강조 및 검증된 거리 가이드.
WT로 바꾸면 Thr-specific atoms/contact 숨김. 모드 이동/A36/unmount 시 layer와 label 정리.
Met sulfur-containing/nonpolar/OH donor 없음 vs Thr polar OH 대비를 고정된 왼쪽 원인 패널과 연결.

## J. Thr182–Ala185 실제 geometry

1JWP chain A:
- Thr182 OG1: (10.888, -7.446, 25.265) Å
- Ala185 N: (7.972, -7.443, 25.117) Å
- Oγ···N = **2.9197549554714364 Å** (UI: 2.920 Å)
- OG1···Glu63 backbone O = **5.1047927479967345 Å**
- OG1···Glu64 backbone O = **4.960920277529165 Å**

Rigid alignment 전후 내부 거리는 동일. 명시적 수소 없음.
점선은 2.5–3.5 Å의 보수적인 **heavy-atom 거리 screen**을 통과한 후보 접촉만 표시하며, **수소결합 확정선이 아닌 O···N 거리 가이드**라고 명시한다. 이 screen은 이 UI의 관찰 기준이며 Zimmerman의 H···acceptor 거리 정의를 그대로 재현한 것이 아니다. H 결합각/에너지/지속성은 계산하지 않았다. 범위를 벗어나거나 nonfinite이면 가이드 없음.

## K. 문헌상 M182T 안정화 해석

[Zimmerman et al. 2017, ACS Central Science 3:1311–1321](https://doi.org/10.1021/acscentsci.7b00465), Figures 1–4, Results를 원문 확인했다.
[원문 PDF 공개 사본](https://pendidikankimia.walisongo.ac.id/wp-content/uploads/2018/10/13-1-8.pdf).
M182T는 여러 destabilizing substitution을 보완하는 global suppressor로 연구되었다. UI는 Thr182–Ala185 helix-9 N-cap을 **안정화에 기여하는 것으로 제안된 모델**로 표시한다.
치환→OH 추가→새로운 국소 interaction 가능→native-state 안정화 기여→측정 Tm 증가의 교육적 사슬이며, 특정 수소결합 하나의 +7.5°C 정량 원인으로 단정하지 않는다.
새 자유에너지 값을 산출하지 않는다.

## L. alternate interaction / 불확실성

위 연구의 native-state ensembles는 Ala185 N-cap과 Glu64 carbonyl 상태를 논의하고 Glu63 접촉은 해당 simulation에서 드물다고 보고한다.
N-cap만으로 global stability를 예측하기 충분하지 않다는 논문의 한계를 유지했다.
현재 1JWP에서는 Glu63/64의 해당 O···O 거리가 약 5 Å여서 수소결합 점선을 그리지 않는다.
단일 구조로 equilibrium population이나 contact probability를 추정하지 않는다.
1BTL/1JWP의 **84 Ile/Val, 184 Val/Ala 차이**와 독립적 결정구조 limitation은 기존 문구 그대로 유지.

## M. Tm slider

25–70°C, step 0.5°C. 25/40/49.5/57/70 빠른 선택 버튼.
온도<Tm, =Tm, >Tm만 판단. WT 49.5, M182T 57°C.
49.5에서 WT midpoint / M182T below; 57에서 WT above / M182T midpoint.
3D unfolding animation, 실제 thermal curve, fraction folded % 산출 없음.
Jacquier의 thermal denaturation method는 25–80°C, 1.5°C/min, intrinsic fluorescence excitation 295 / emission 340 nm로 별도 설명. 체험 slider 범위와 실험 범위를 구분.

## N. 마지막 질문

activity/MIC/thermal 각 1회 이상 방문 후 공개.
어떤 응답을 선택하더라도 근거가 허용하는 답은 “이 자료만으로는 확정할 수 없습니다.”
특정 단백질 assay ≠ 개체 전체의 fitness ≠ population-level selection coefficient.
특정 조건의 작은 기능 차이가 진화적 중립성을 증명하지 않는다는 설명 유지.

## O. 수정 / 추가 파일

기존 미커밋 파일 위에 필요한 확장만 적용:
- src/modules/MutationToleranceLab.tsx
- src/modules/mutationState.ts
- src/components/MutationViewer.tsx
- src/protein/mutationTolerance.ts
- src/rendering/ProteinScene.ts
- src/rendering/proteinComparison.ts
- src/styles.css
- package.json (새 검증 script)
- README.md, SCIENTIFIC_NOTES.md (추가 설명과 이 보고서 링크)

신규:
- src/components/MutationExplanation.tsx
- src/protein/mutationEvidence.ts
- src/rendering/mutationView.ts
- tests/mutationExplanation.test.tsx
- scripts/mutation-explanation-audit.mjs
- scripts/mutation-explanation-browser-test.mjs
- MUTATION_TOLERANCE_PHASE2_VALIDATION.md

기존 tests/mutationTolerance.test.ts 및 모든 기존 browser test는 수정/삭제/약화하지 않았다.
HbS module 코드는 수정하지 않았다. 기존 fixture 및 PDB bytes 유지.

## P. 신규 tests / browser 검증

37개 신규 Vitest: reveal gate, 단일 mode, 방문 집합, A36/reset cleanup, invalid inputs, 비교 상태 독립성, auth/label mapping, 실제 RMSD/contact 계산, contact fail closed, 정확한 assay 값/농도/온도 상태, 개념도 문구, 최종 질문 gate.
Chromium 신규 11개 검증 시나리오(각 시나리오에 여러 확인 항목 포함):
결과 gate; keyboard activity/overlay; MIC 250→500; thermal WT/M182T/contact; 49.5/57°C; 최종 질문; 반복 modes/summary; reduced motion; 1024/768/390/320 responsive; A36/HbS; 반복 unmount; touch emulation.
Canvas identity와 cached label/leader 수 유지, A36/unmount 후 잔존 label 제거, browser exceptions 0 확인.
브라우저 캡처를 직접 시각 검토하고 라벨 겹침을 보완했다. 실제 물리 모바일 기기는 사용하지 않았음.
기존 npm run test:browser의 10개 모듈 전체 suite도 수정 없이 통과했다. 신규 browser suite 11개 검증 시나리오와 기존 Mutation Tolerance suite 모두 오류 0.

## Q. npm test

기준: 358 tests / 13 files 통과.
최종: 395 tests / 14 files 통과 (37개 추가).
기존 실패 없음.

## R. npm run typecheck

통과.

## S. npm run build 및 lint

통과. 기존 Three.js >500 kB chunk 경고 유지. 신규 build warning 없음.
lint script는 저장소에 없음.
git diff --check 공백 오류 없음. Git의 LF→CRLF 안내는 Windows line-ending 설정에 따른 안내이며 build warning과 별도다.

## T. 사람이 특히 확인할 장면

미리보기: http://127.0.0.1:5174/protein-3d-explorer/
1. Chapter 3 Mutation Tolerance → M182T 적용 → 실제 결과 공개.
2. 효소 활성 카드 → WT / M182T / 중첩. 실제 원자와 라벨 연결선, 182와 촉매 중심의 공간 관계.
3. MIC 카드 → 250→500. 두 줄의 억제 상태, 복합 지표 질문.
4. 열안정성 카드 → WT/Thr 반복 → 상호작용 공개. 점선은 O···N 거리 가이드임을 확인.
5. 온도 49.5 / 57, 세 결과 방문 후 최종 질문.
6. A36D → HbS 이동. 결과 설명과 이전 라벨이 남지 않는지.
7. 휴대폰 실제 화면에서 슬라이더 조작 감각과 긴 설명의 읽기 흐름.

캡처/기계 판독 결과는 artifacts/mutation-phase2-*.png, artifacts/mutation-explanation-audit.json, artifacts/mutation-explanation-browser-results.json에 보존.

## U. 남은 scientific / technical limitation

- 두 결정구조의 다른 sequence backgrounds 및 crystallographic variation; 관찰을 단일 치환의 인과 효과로 분리할 수 없음.
- 5 Cα의 RMSD는 촉매 반응, substrate binding, 곁사슬 rotamer 또는 dynamics 검증이 아님.
- H 없는 정적 구조의 heavy-atom contact proxy만 사용. 상호작용 에너지나 결합각 및 시간에 따른 점유율 미계산.
- 원시 흡광도 trace, MIC plate images, thermal-denaturation raw curves, unfolding trajectory 없음. 모두 명시된 개념도.
- browser 검증은 Chromium/SwiftShader 및 모바일·터치/reduced-motion emulation. 실제 모바일 GPU/물리 기기 및 장시간 heap profiling까지 검증한 것은 아님.
- App의 직접 브라우저 제어 런타임 초기화가 실패하여 Playwright Chromium 실브라우저 상호작용과 렌더링 이미지 검토를 사용했다.
