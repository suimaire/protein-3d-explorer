# Scientific notes — Peptide Geometry Lab

## 지킨 것

- 모델: Ac–(L-Ala)₅–NHMe. 중성 acetyl / N-methylamide cap으로 내부 peptide group을 완성합니다.
  residue 0은 Ac, 1–5는 Ala, 6은 NHMe입니다. 표기 CA는 cap에서 methyl C를 뜻합니다.
- 조작 대상은 **Ala 3**. φ = C₂–N₃–Cα₃–C₃, ψ = N₃–Cα₃–C₃–N₄.
- 회전축은 각각 N₃–Cα₃, Cα₃–C₃. 결합 그래프에서 해당 edge를 끊어 downstream 연결 성분을
  찾고 Rodrigues rigid rotation을 적용합니다. φ에서는 Cβ₃도 회전하고 N₃의 H는 움직이지 않습니다.
  ψ에서는 O₃와 residue 4 이후가 회전하며 Cβ₃는 움직이지 않습니다.
- 모든 peptide ω = Cαᵢ–Cᵢ–Nᵢ₊₁–Cαᵢ₊₁ = 180°.
  Cαᵢ, Cᵢ, Oᵢ, Nᵢ₊₁, Hᵢ₊₁, Cαᵢ₊₁은 같은 평면에 있습니다.
  화면 평면은 이 실제 6개 좌표를 같은 평면 기저에 투영해 만든 bounding rectangle이며,
  장식적으로 독립 회전하는 판이 아닙니다. 직사각형의 외곽은 분자의 물리적 경계가 아닙니다.
- C–N 부분 이중결합 성격과 제한된 회전을 공명과 연결합니다. ω 자유 회전 UI는 없습니다.
- 음/양 이면각의 부호를 독립적인 ±90° 기준 좌표로 검증합니다. −180°와 +180°는 동등합니다.
- Cβ는 N–Cα–C 평면의 L-Ala (S) 쪽에 구성합니다. ordered N,C,Cβ signed volume이 양수이며,
  회전 후에도 보존됩니다. 좌표 길이 단위는 Å입니다.

## 단순화한 것

### Ideal internal geometry

| Length | Å |
|---|---:|
| N–Cα | 1.458 |
| Cα–C | 1.525 |
| peptide C–N | 1.329 |
| C=O | 1.231 |
| Cα–Cβ | 1.521 |
| amide N–H | 1.010 |

| Angle | Degrees |
|---|---:|
| N–Cα–C | 111.2 |
| Cα–C–N | 116.2 |
| C–N–Cα | 121.7 |
| Cα–C–O | 120.8 |
| N–Cα–Cβ / C–Cα–Cβ | 109.47 |

이 값은 단일 고정 교육용 대표 상수이며 실제 구조의 분포나 정밀 refinement dictionary가 아닙니다.
대표 heavy-atom backbone 값은 Engh–Huber 계열 표준 peptide geometry에 해당하는 근사값입니다.
cap의 methyl C–C, N–methyl C에는 위 Cα 결합 길이를 재사용합니다.
amide H는 N에서 양쪽 heavy-atom 방향의 반대 이등분선에 두어 trigonal planarity를 유지합니다.
모든 결합 길이/각도는 고정되어 있고 환경 의존적 미세 변형을 계산하지 않습니다.

- 탄소 결합 H는 **좌표와 clash 계산 모두에서 생략**. Cβ는 methyl carbon만 표시합니다.
  따라서 all-atom clashscore가 아니고 수소의 steric 효과 일부를 놓칩니다.
- 초기 중앙 각도: −60°/−45°. 다른 Ala의 φ/ψ는 −135°/+135°로 고정.
- presets: α-like −60°/−45°, β-like −135°/+135°, Extended −180°/+180°.
  모두 **근사적 대표값**이고 완전한 α-helix/β-sheet 모델이 아닙니다.
- cap은 protonation equilibria를 모델링하지 않습니다. solvent, temperature, electrostatics,
  hydrogen-bond energies, minimization, dynamics는 계산하지 않습니다.

### Ramachandran representation

신뢰 가능한 local allowed-region 데이터가 없어서 **schematic**을 사용합니다.
β/extended의 대략적 범위 φ −160…−55°, ψ +70…+160°와 αR의 대략적 범위
φ −102…−27°, ψ −91…−16°를 구별 가능한 단색 도형으로 표현합니다.
이 경계는 설계된 교육용 guide이며 경험적 등고선, density, 확률, 수치 판정 기준이 아닙니다.
왼손 α 영역 등은 생략했습니다. 빈 곳을 모두 forbidden으로 분류하지 않습니다.
Gly/Pro의 분포는 별개이고 residue identity, local environment, energetic factors도 중요합니다.
marker는 target 숫자가 아닌 **실제 좌표에서 계산한 φ/ψ**를 사용합니다. seam에서는 사용자가
선택한 ±180° 쪽을 보존합니다. 클릭은 1° 단위로 값을 선택하며 slider와 단일 state를 공유합니다.

### Geometric steric indicator

- element-specific Bondi vdW radii: H 1.20, C 1.70, N 1.55, O 1.52 Å.
- 모든 표현 원자의 무순서 쌍을 검사합니다. 직접 bonded (1–2), 공통 결합 원자를 가진 (1–3)
  쌍은 결합 그래프 최단거리 2 이하로 제외합니다. **1–4 쌍은 유지**하여 torsion의 가까운 접촉을
  관찰합니다. 따라서 force-field 1–4 energy scaling과 같지 않습니다.
- overlap = rᵢ + rⱼ − distance. **overlap > 0.4 Å**를 표시합니다. 이 cutoff는 작은 정상 접촉을
  덜 강조하기 위한 교육용 선택이며 universal physical threshold가 아닙니다.
- vdW spheres는 전체 반지름을 사용하고 약한 overlap도 보입니다. 모든 보이는 overlap이
  clash cutoff를 넘지는 않습니다. 기본 ball-and-stick 원자 구는 축소 표현입니다.
- counts는 cap 포함 전체 사슬 기준입니다. visibility toggle은 계산에 영향을 주지 않습니다.
  clash를 켜면 숨겨진 clash 원자도 강조 구와 연결선으로 드러납니다.
- α-like나 β-like여도 주변 고정 구조/말단 또는 retained 1–4 접촉 때문에 clash가 가능하며,
  clash가 0이어도 실제 구조가 energetically favorable이라고 보장하지 않습니다.

## 오개념 방지를 위해 피한 것

- 자유로운 peptide C–N rotation, φ/ψ의 뒤바뀜, 임의 분자 전체 회전으로 slider 흉내내기.
- fake empirical density, 분포를 모든 residue에 일반화, 단순 clash를 forbidden 판정으로 표시하기.
- 에너지 simulation / molecular dynamics / folding prediction이라는 표현.
- cis/trans 실험 기능, 다음 단계의 나선·시트·기능 모듈 구현.

## Sources

- [EMBL-EBI: The nature of the peptide bond](https://www.ebi.ac.uk/training/online/courses/foundations-protein-structure/fundamentals-of-protein-composition/the-peptide-bond-and-primary-structure/the-nature-of-the-peptide-bond/)
- [PDBe: Structure validation practical](https://www.ebi.ac.uk/pdbe/modval4) — omega restraint and geometry concepts.
- [Engh & Huber (1991), Accurate bond and angle parameters for X-ray protein structure refinement](https://doi.org/10.1107/S0108767391001071)
- [Bondi (1964), van der Waals Volumes and Radii](https://doi.org/10.1021/j100785a001)
- [Leibniz-FLI Jena: vdW radii table](https://jenalib.leibniz-fli.de/ImgLibDoc/glossary/IMAGE_VDWR.html)

Sources support chemical conventions and representative constants, not the authored schematic boundaries.
