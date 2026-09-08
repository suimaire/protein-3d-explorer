# Protein 3D Explorer

고등학교 심화 생화학 수업용 3D 탐색기. Phase 1은 **Peptide Geometry Lab** 하나만 제공합니다.
Ac–(L-Ala)₅–NHMe의 Ala 3에서 φ/ψ를 조작하고 peptide plane, schematic Ramachandran map,
단순 기하학적 clash를 함께 관찰합니다. 실제 에너지 계산이나 protein folding simulation은 아닙니다.

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
검증 스크립트는 `artifacts/`에 desktop/mobile 캡처와 보고서를 저장합니다.

## Future GitHub Pages path

예정 주소: https://suimaire.github.io/protein-3d-explorer/

Vite base는 `/protein-3d-explorer/`로 설정했습니다. `dist/`가 정적 배포 산출물입니다.
이 단계에서는 GitHub 저장소, remote, 배포 workflow를 만들지 않았고 push/배포하지 않습니다.

## Structure

- `src/geometry/`: 순수 TypeScript 좌표·결합 그래프·이면각·clash 계산
- `src/data/`: 과학 상수, 대표각, 완성된 모듈 목록, 교육 설명
- `src/rendering/`: Three.js scene, 원자/결합/실제 좌표 기반 plane, camera controls
- `src/components/`: viewer lifecycle, Ramachandran SVG
- `src/modules/`: Peptide Geometry의 state와 학생 조작 UI
- `src/main.tsx`, `src/styles.css`: 공통 앱 골격과 반응형 디자인
- `tests/`: signed torsion, geometry invariants, clash exclusion, plot mapping
- `scripts/browser-test.mjs`: 실제 Chromium UI·WebGL 검증
- `SCIENTIFIC_NOTES.md`: 모델의 정확성·가정·근거
- `CURRENT_STATUS.md`: 최신 완료 상태와 후속 작업

React/Vite/TypeScript/Vitest는 기존 carbohydrate explorer 패턴을 따릅니다. Three.js r170과
원자/결합 표현은 lipid explorer의 기술 방향을 따르며, 기존 프로젝트 파일을 복사·수정하지 않습니다.
새 모듈은 geometry, renderer, module UI를 분리해 추가하고 완성된 모듈만 학생 메뉴에 등록합니다.

## Session rule

**매 개발 세션 종료 시 `CURRENT_STATUS.md`를 갱신합니다.** 과학 모델을 바꾸면
`SCIENTIFIC_NOTES.md`와 관련 검증도 갱신합니다. 현재 범위 밖의 모듈·학습지·로그인 기능은 추가하지 않습니다.
