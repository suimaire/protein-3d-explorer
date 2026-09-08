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

### Steric clash model

- **검사 범위:** cap을 포함한 모든 표현 원자의 무순서 쌍. visibility toggle은 계산에 영향을
  주지 않습니다. carbon-bound H는 모델 자체에 없고, 생성된 amide H는 포함합니다.
- **vdW radii:** heavy atom은 Bondi 값 C 1.70, N 1.55, O 1.52 Å. 표시용 vdW sphere는
  H 1.20 Å도 사용합니다. serious-clash 계산은 MolProbity/Probe 계열의 polar-H 처리에 맞춰
  amide H에 1.00 Å를 사용합니다. 이 모델의 명시적 H는 모두 amide H입니다.
- **detection criterion:** overlap = rᵢ + rⱼ − distance이며 **overlap > 0.40 Å**를
  `심한 비결합 겹침`으로 표시합니다. 0.40 Å는 MolProbity가 serious clash를 보고하는 기준에서
  가져왔지만, 이 앱은 Probe의 rolling surface나 hydrogen-bond 판정을 복제하지 않습니다.
- **bond-topology exclusion:** 결합 그래프 최단거리가 1, 2, 3인 1–2, 1–3, 1–4 쌍을 모두
  제외합니다. Probe/Reduce의 기본 `NBonds=3`과 같은 범위입니다. 1–4는 force field에서
  별도로 다룰 수 있지만, 이 단순 거리 표시에서 일반 비결합 clash로 세면 고정 peptide geometry가
  false positive를 만들기 때문에 제외합니다. 네 결합 이상 떨어진 쌍은 검사합니다.
- **terminal caps:** Ac와 NHMe를 일괄 제외하지 않습니다. cap의 local 1–2/1–3/1–4 쌍만 같은
  topology 규칙으로 제외하고, 다른 residue와의 비국소 접촉은 peptide 원자와 똑같이 검사합니다.
- **hydrogen geometry:** amide H는 N의 두 heavy-atom 이웃에 대해 peptide plane 안의 반대
  이등분선에 놓이고 rigid backbone rotation을 따릅니다. 별도 에너지 최적화는 하지 않습니다.
  따라서 all-atom optimized clashscore가 아니며, 생략한 carbon-bound H의 충돌은 검출하지 못합니다.
- **visualization:** clash를 켜면 해당 쌍을 분홍 구와 연결선으로 표시합니다. vdW spheres는 전체
  반지름으로 모든 원자를 그리므로, 1–4처럼 평가에서 제외한 covalent-neighbor sphere도 겹쳐
  보일 수 있습니다. 기본 ball-and-stick 원자 구는 가독성을 위해 축소했습니다.
- **interpretation:** 이 clash detector는 protein force field 또는 molecular dynamics simulation이
  아니라 교육용 geometric proximity indicator입니다. clash 0은 energetically favorable하다는
  보장이 아니고, schematic Ramachandran 영역과도 독립된 관찰입니다.

Phase 1.1의 기존 6쌍 추적과 정책 비교는 [STERIC_CLASH_VALIDATION.md](STERIC_CLASH_VALIDATION.md)에
기록했습니다.

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
- [Word et al. (1999), small-probe contacts with explicit H](https://doi.org/10.1006/jmbi.1998.2400)
- [Chen et al. (2010), MolProbity all-atom validation](https://doi.org/10.1107/S0907444909042073)
- [Richardson Lab Reduce documentation](https://github.com/rlabduke/reduce/blob/master/README.usingReduce.txt)

Sources support chemical conventions and representative constants, not the authored schematic boundaries.
