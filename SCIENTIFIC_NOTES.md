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
- **detection criterion:** overlap = rᵢ + rⱼ − distance이며 **overlap > 0.40 Å** 중 아래의
  donor/acceptor·거리·각도 검증을 통과한 H-bond를 제외하고 `심한 비결합 겹침`으로 표시합니다.
  Raw overlap은 audit용으로 보존합니다. 0.40 Å는 MolProbity가 serious clash를 보고하는 기준에서
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
- cis/trans 실험 기능, β-sheet와 기능 모듈 구현.

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

## Phase 2A — α-Helix Lab

- Model: **Ac–(L-Ala)₁₂–NHMe**, 12 alanines, Ac residue 0 / NHMe residue 13.
  78 represented atoms, 77 covalent bonds. Neutral caps reuse Phase 1 cap geometry.
  Explicit amide H, omitted carbon-bound H. An idealized educational model, not an experimental
  structure, optimized molecular mechanics model, or folding trajectory.
- Reuse: `buildPeptide(count, phi, psi)` preserves the original five-residue defaults, bond lengths,
  bond angles, chirality construction, and internal-coordinate placement. No mesh-based helix,
  moved side chains, reflection, or independently positioned H-bond endpoints.
- All 12 evaluable Ala residues: φ = **−60°**, ψ = **−45°**, chosen to connect directly to Phase 1
  α-like preset. Cap neighbors make the endpoint torsions evaluable too. All 13 ω = trans 180°;
  all six-atom peptide groups are planar. φ/ψ shown by the selector/plot come from `angles(model,r)`.
- This is a representative repeated conformation. Real helices have residue-specific torsions;
  sequence, environment and other interactions matter. Hydrogen bonding contributes to stabilization
  in this geometry and is not presented as the sole cause of a helix.
- Right-handedness: derive a screw axis from successive Cα displacement differences, orient it
  in the N→C direction, verify positive signed radial rotation for every residue step.
  The renderer uses these unreflected atom coordinates. Cα→Cβ has positive outward radial projection
  for all 12 residues; side-chain positions arise from L-Ala tetrahedral geometry.
- Ideal α-helix reference values are approximately 3.6 residues/turn, 1.5 Å rise/residue and 5.4 Å
  pitch. This model measures **3.641169 / 1.540360 Å / 5.608710 Å**, respectively, from its actual
  screw geometry (98.869342° rotation/residue). Fixed bond geometry plus −60°/−45° yields a small
  difference from the rounded reference values. Both are explicitly distinguished in the UI.
- Hydrogen bonds: acceptor **C=O(i)** to donor **N–H(i+4)**, using O, H and N coordinates.
  Screen each candidate: 2.5 ≤ O···N ≤ 3.5 Å, 1.5 ≤ H···O ≤ 2.6 Å, N–H···O ≥120°.
  These are broad educational distance/direction criteria, not a universal H-bond definition,
  DSSP assignment or energy calculation. Invalid geometry suppresses the displayed pair.
- Display count derives from data: 12−4 = **8** eligible Ala–Ala pairs, all pass. O···N = 3.060309 Å,
  H···O = 2.082598 Å, N–H···O = 162.321327°. Dashed segments connect actual O and H coordinates.
  Gold highlighting retains element colors and identifies both the carbonyl C/O and donor H/N.
- Caps remain in molecular geometry and nonlocal clash checks but are excluded from the teaching
  H-bond network and its count. Ala 1–4 N–H and Ala 9–12 C=O lack an Ala-only i→i+4 partner.
  Ac O···H(Ala4) and Ala9 O···H(NHMe) are geometrically plausible contacts outside that displayed
  network; terminal groups therefore do not all reproduce the interior network. Capping chemistry
  and solvent partners are not simulated.
- **Interaction classification:** 10 raw O···H overlaps of 0.437402 Å are classified as valid
  H-bonds (8 interior + 2 cap); serious unfavorable clashes are **0**. The shared classifier checks
  covalent identity (amide N–H donor and C=O acceptor), H···O 1.5–2.6 Å, N···O 2.5–3.5 Å,
  and N–H···O ≥120°. Caps follow the same rules. Threshold/radii/1–2, 1–3, 1–4 exclusions
  remain unchanged. Invalid O···H contacts still count when overlap >0.40 Å. This model-specific
  geometry screen is not proof of all-atom energetic validity.
- Side/Top cameras use the measured screw axis as a guide. Top view does not reposition atoms.
  Axis is a dashed geometric guide. No interpolation or folding animation is implemented.

Full pair audit and deterministic validation are in [ALPHA_HELIX_VALIDATION.md](ALPHA_HELIX_VALIDATION.md).

### Structural biology cross-check

- [EMBL-EBI: α-helix](https://www.ebi.ac.uk/training/online/courses/foundations-protein-structure/principles-of-protein-folding-and-architecture/secondary-structure-%CE%B1-helices-and-%CE%B2-sheets/%CE%B1-helix/)
  — reference helical dimensions and outward side-chain arrangement.
- [EMBL-EBI: Levels of protein structure — secondary](https://www.ebi.ac.uk/training/online/courses/biomacromolecular-structures/proteins/levels-of-protein-structure-primary/levels-of-protein-structure-secondary/)
  — right-handed geometry and backbone donor/acceptor sequence offset.

Accessed 2026-09-09. These sources support structural conventions and representative dimensions;
model-specific measurements and the educational display criteria are documented separately above.

## Phase 2B — β-Sheet Lab

- Model: **Idealized poly-L-alanine β-sheet**; three independent Ac–(L-Ala)₇–NHMe strands,
  21 Ala, 144 represented atoms, 141 covalent bonds. Each strand has Ac residue 0 and NHMe
  residue 8 locally. Global residue ids use stride 9; no covalent bonds between strands.
  Explicit amide H, omitted carbon-bound H; neutral caps retain the original builder geometry.
- Build and validate strand geometry before arrangement/rendering. Reuse `buildPeptide` with
  φ **−135°**, ψ **+132.27209925651545°**, all ω **180°**. For the unchanged covalent constants,
  ψ was found by bisection near +135° so the repeated screw rotation is 180°: an untwisted
  two-residue repeat. This is a representative β-region construction, not an empirical average,
  a universal β-sheet torsion, or a fitted experimental protein. Every displayed φ/ψ and ω is
  measured from coordinates; tests cover all Ala and cap-boundary peptide planes.
- Orient the local strand using its measured screw axis as x, the transverse C₄→O₄ component
  as y, and x×y as z, with Cα₄ as origin. This right-handed change of frame preserves chirality,
  bond lengths, angles and planarity. L-Ala Cα→Cβ projections onto sheet normal z alternate
  signs without moving side-chain atoms independently.
- **Parallel**: all strands point N→C along +x; translations are (0,0,0), (0,4.8,0),
  (0,9.6,0) Å. **Antiparallel**: A/C point +x, B points −x, using a proper 180° rotation about
  z for B, with translations (0,0,0), (−0.4,5.5,0), (−0.2,10,0) Å. These are Cα₄-frame
  registrations, not a claim that every β-sheet has these inter-axis spacings. The CA pleat
  phase and reversed strand mean successive reference-point offsets need not be identical.
- Registrations were screened using actual donor/acceptor contacts and cap-inclusive sterics;
  the two antiparallel interfaces were checked separately. A rigid reversal alone does not
  establish a sheet: the selected registrations must pass the full atomic-coordinate audit.
  No index-based bonds, atom-specific repositioning, energy optimization, dynamics or folding.
- Shared amide/carbonyl classifier unchanged: carbonyl O double-bonded to C; H singly bonded
  to amide N; **H···O 1.5–2.6 Å, N···O 2.5–3.5 Å, N–H···O ≥120°**. Display only valid
  inter-strand Ala–Ala pairs, deriving count from coordinates. Antiparallel **14** (6 A/B + 8 B/C),
  parallel **12** (6 + 6). Cap-inclusive networks have 16 each; cap pairs are excluded only
  from teaching-network display, not from steric checks. Distances/angles and pair tables below
  are documented in `BETA_SHEET_VALIDATION.md`. No H-bond energy is estimated.
- Sterics unchanged: 1–2/1–3/1–4 exclusions; serious overlap >0.40 Å; same atomic radii.
  In each model all 16 raw severe overlaps are valid O···H H-bonds, leaving **0 serious
  unfavorable clashes**. This partial-atom screen does not certify all-atom energetic validity.
- This is an **untwisted pleated sheet**, not a claim that backbone atoms lie on one plane.
  Real β-sheets generally need not be perfectly flat and can twist. Real sequence and surrounding
  structure affect geometry. The UI includes the explicit Korean twist caveat.
- β-strand is one extended segment; β-sheet is an arrangement of multiple H-bonded strands.
  Different segments of the **same polypeptide** can form a sheet; the three capped molecules
  here are an educational convenience. Parallel/antiparallel describe N→C directions, not a
  universal stability ranking. Main stabilizing H-bonds shown here are backbone, not side chain.
- Sheet/Top/Edge are camera changes only. Dashed arrows at a normal offset are geometric guides,
  not atomic bonds. Focus highlights donor N/H, acceptor C/O and both residues while preserving
  element colors. No turns, hairpins, tertiary structure or future navigation placeholders added.

Structural conventions cross-checked 2026-09-09:
[EMBL-EBI β-sheet](https://www.ebi.ac.uk/training/online/courses/foundations-protein-structure/principles-of-protein-folding-and-architecture/secondary-structure-%CE%B1-helices-and-%CE%B2-sheets/%CE%B2-sheet/)
and [The Supramolecular Chemistry of β-Sheets](https://pmc.ncbi.nlm.nih.gov/articles/PMC3642101/).
These sources support direction, backbone hydrogen bonding, alternating side-chain faces and
sheet twist; the specific coordinates/registrations and display criteria are authored model choices.

## Hydrophobic Core Explorer

Phase 3A. Full audit, numbers and manual residue checks: [HYDROPHOBIC_CORE_VALIDATION.md](HYDROPHOBIC_CORE_VALIDATION.md).

### Structure

- **Protein:** human ubiquitin. **PDB ID:** 1UBQ (Vijay-Kumar, Bugg & Cook 1987, *J. Mol. Biol.* 194:531,
  doi:10.1016/0022-2836(87)90679-6). **Experimental method:** X-ray diffraction, **1.8 Å** (RCSB Data API
  `refine.ls_d_res_high`, checked 2026-09-15). **Chain:** A, 76 residues, 602 heavy atoms.
- Why 1UBQ: small soluble globular monomer containing an α-helix, a 3₁₀ helix and a mixed β-sheet;
  no ligand, no alternate locations, no missing residues or atoms. It was chosen before any exposure
  result was computed; no other protein was tried.
- **Structure preprocessing:** the RCSB PDB file is bundled byte-for-byte (SHA-256 in the validation
  document). The parser keeps model 1, chain A `ATOM` records; coordinates are used exactly as deposited.
  Alternate-location policy (none present in 1UBQ): keep the highest-occupancy conformer per atom.
  Partial occupancy (Leu73/Arg74 0.45, Gly75/Gly76 0.25) is kept and flagged in the residue panel.
- **Omitted waters/ligands:** 58 crystallographic waters are hidden from the view and excluded from SASA;
  the UI states that they exist in the structure. No ligands or other HETATM records exist. No hydrogens
  were deposited or added.
- Secondary-structure labels and ribbon widths come from the deposited HELIX/SHEET records
  (author annotation), not recomputed with DSSP.

### Residue classification

Educational four-group side-chain scheme (the common introductory-textbook grouping; no course-specific
table was available in the workspace):

| UI label | Residues |
|---|---|
| Nonpolar (■) | Gly, Ala, Val, Leu, Ile, Met, Pro, Phe, Trp |
| Polar, uncharged (●) | Ser, Thr, Cys, Asn, Gln, Tyr |
| Acidic (▲) | Asp, Glu |
| Basic (◆) | Lys, Arg, His |

- "Nonpolar" and "uncharged" are different properties: Ser/Thr/Asn/Gln are uncharged but polar.
- Caveats shown in the UI: Gly (side chain is one H), Pro (cyclic, bonded to backbone N),
  Tyr (aromatic ring + polar OH), Cys (weakly polar SH, disulfides), Met (contains S, usually nonpolar),
  **His** (protonation state depends on environment; never described as always +1).
  "Acidic/Basic" do not assign formal charges; no pKa or protonation calculation is performed.
- Chemistry coloring paints side-chain atoms (Gly: Cα) by class and backbone atoms neutral gray,
  because the class describes the side chain. Legend = label + color + symbol.

### Solvent exposure

- **SASA algorithm:** Shrake & Rupley (1973), *J. Mol. Biol.* 79:351, doi:10.1016/0022-2836(73)90011-9;
  960 golden-spiral points per atom; the neighbor grid is an optimization only.
- **Probe radius:** 1.40 Å.
- **vdW radii:** Bondi (1964): C 1.70, N 1.55, O 1.52, S 1.80 Å; heavy atoms only.
- Residue SASA = sum of its atom SASA. Side-chain SASA (atoms other than N, CA, C, O, OXT) is kept
  separately in the data model and shown in the panel; the exposure metric and ranking use whole-residue values.
- **Normalization method:** relative SASA = residue SASA / maximum accessible area.
- **Reference maximum ASA table:** Tien, Meyer, Sydykova, Spielman & Wilke (2013), "Maximum allowed
  solvent accessibilities of residues in proteins", *PLoS ONE* 8:e80635, doi:10.1371/journal.pone.0080635,
  Table 1 **theoretical** values (Å²), read from PMC3836772 and cross-checked against Biopython
  `residue_max_acc["Wilke"]`:

  | Ala | Arg | Asn | Asp | Cys | Gln | Glu | Gly | His | Ile | Leu | Lys | Met | Phe | Pro | Ser | Thr | Trp | Tyr | Val |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 129 | 274 | 195 | 193 | 167 | 225 | 223 | 104 | 224 | 197 | 201 | 236 | 224 | 240 | 159 | 155 | 172 | 285 | 263 | 174 |

  These maxima were computed with DSSP on Gly-X-Gly tripeptides, so dividing Bondi-radius SR areas by
  them is an approximate normalization. The C-terminal Gly76 (extra OXT) reaches 139%; the UI shows
  "≥100%" with an explanation. Data values are never clamped.
- **Implementation check:** matches Biopython `ShrakeRupley` with identical parameters to 0.00005 Å² per
  residue. A FreeSASA/DSSP comparison was not possible in this environment.

### Buried / exposed visualization policy

- Students first see continuous values: "Relative solvent exposure: n%", an exposure bar
  (more buried ← → more exposed), rank n/76, and optional exposure coloring (indigo → teal → gold).
- **Percentile policy:** "More buried 25%" / "More exposed 25%" = the 19 lowest / highest rSASA ranks
  *in this protein* (ties broken by residue number). No universal rSASA threshold is used or implied;
  the control is labelled "이 단백질 안에서 상대적으로".
- A filter shows the selected group's atoms (side chains in ribbon mode) and dims or ghosts the rest.
  The selected residue always stays visible with a halo.
- Composition counts sit in a collapsed "관찰 후 확인하기" panel labelled "이 구조에서 관찰된 분포",
  with a whole-chain baseline row and a note that it is not a universal ratio.
- Exceptions are chosen by code from the results (Leu8 exposed nonpolar; Gln41 buried polar) and are
  shown, not hidden. Buried polar contacts are listed only as N/O distances ≤3.5 Å, not as H-bonds.
- **Interior view:** a visual clipping plane perpendicular to the current view, with a depth slider and
  reset. Atom coordinates never move; the UI label is "단면 보기 (visual clipping)". Cut atoms are shaded
  as solid sections.
- The core is defined as the solvent-inaccessible interior. Exposure comes from SASA, not distance to the
  centroid; the validation document shows the two top-19 lists differ for 8 residues.
- Representations: Ribbon, Atoms / sticks, Space filling (vdW spheres). No molecular surface is claimed.

### Teaching language rules applied

- Hydrophobic effect: reducing nonpolar surface exposed to water is one important thermodynamic
  contribution to folding; explicitly *not* a strong nonpolar–nonpolar attraction.
- "Statistical tendency with exceptions": hydrophobic ≠ always inside, polar ≠ always outside.
- Analysis of an already-folded experimental structure: no folding pathway, animation, energy, MD or funnel.
- One crystal conformer of a dynamic protein.
- One sentence links to the Chapter 2 α-helix and β-sheet; the focus stays on interior chemistry.

### Scientific limitations

- Single crystal conformer; waters, binding partners, crystal contacts and dynamics are not in the SASA.
- Heavy-atom Bondi radii; other radius sets/algorithms (Lee–Richards, ProtOr, DSSP) give different
  absolute values, and the normalization maxima come from a different method.
- The four-class chemistry scheme is a teaching simplification; Gly is counted as nonpolar.
- One small protein; the composition is illustrative, not a statistical survey.
- Display bonds are inferred from distances; secondary structure comes from author records.

### Sources

- [RCSB PDB 1UBQ](https://www.rcsb.org/structure/1UBQ); file `https://files.rcsb.org/download/1UBQ.pdb`;
  metadata `https://data.rcsb.org/rest/v1/core/entry/1UBQ` (accessed 2026-09-15).
- Vijay-Kumar S, Bugg CE, Cook WJ (1987) [J. Mol. Biol. 194:531–544](https://doi.org/10.1016/0022-2836(87)90679-6).
- Shrake A, Rupley JA (1973) [J. Mol. Biol. 79:351–371](https://doi.org/10.1016/0022-2836(73)90011-9).
- Bondi A (1964) [J. Phys. Chem. 68:441–451](https://doi.org/10.1021/j100785a001).
- Tien MZ et al. (2013) [PLoS ONE 8:e80635](https://doi.org/10.1371/journal.pone.0080635) ([PMC3836772](https://pmc.ncbi.nlm.nih.gov/articles/PMC3836772/)).
- Biopython `Bio.PDB.SASA.ShrakeRupley` (reference implementation, used for validation only).

## Soluble vs Membrane Protein

Full audit: `SOLUBLE_MEMBRANE_VALIDATION.md`. Code: `src/protein/ompx.ts`, `membrane.ts`, `rigid.ts`.

- **Selected membrane protein:** Outer membrane protein X (OmpX), *Escherichia coli*, 8-strand β-barrel.
- **PDB ID:** 1QJ8 (Vogt & Schulz 1999). **Method:** X-ray diffraction, 1.90 Å. Chain A, 148 residues
  (mature 1–148, all modeled), 1158 heavy atoms. Engineered His100→Asn. Unmodified RCSB file bundled (SHA-256 tested).
- **Biological assembly:** monomer (REMARK 350 PISA; OPM uses 1 subunit). The whole asymmetric unit is used;
  no chain was split off, so no oligomer interface is mislabelled as lipid-facing.
- **Soluble comparison:** 1UBQ exactly as in Phase 3A (same file, parser, SASA, chemistry, colors).
- **Orientation source:** OPM entry 1qj8 (Lomize et al.), hydrophobic thickness 23.6 ± 2.8 Å, tilt 12 ± 5°.
- **Membrane normal:** +z of the OPM frame; bilayer centre z = 0 (= deposited-frame direction (0.666, −0.067, 0.743)).
- **Boundaries:** z = ±11.8 Å, equal to OPM's dummy boundary atoms. The drawn slab and the classification use one
  object (`OMPX_SLAB`).
- **Coordinate transform:** rigid rotation + translation recovered by least-squares fit of the deposited atoms to
  OPM's oriented file (1154 atoms, RMSD 0.0022 Å; OPM's Lys20 side chain differs and was excluded). Deposited
  coordinates kept; oriented copy generated in code; distances preserved (tests). Display additionally maps
  (x, y, z) → (x, z, −y) so the normal is screen-up — rendering only.
- **Ligand / water handling:** waters (72), C8E4 detergent and PtCl₄ heavy-atom sites are skipped at parse time and
  not used in SASA or display. Altlocs: highest occupancy (12 residues). No explicit lipids exist in the entry.
- **Surface exposure metric:** Phase 3A Shrake–Rupley SASA (probe 1.4 Å, 960 points, Bondi radii), relative to
  Tien 2013 maxima, of the protein alone. Called *surface accessibility* in this module, not water exposure, because
  a membrane protein's accessible surface may face lipid. Surface = rSASA ≥ 25 % (both proteins).
- **Coordinate frame for SASA:** SASA is invariant to rigid-body motion, but Shrake–Rupley sample points are fixed in
  the coordinate frame. OmpX SASA/rSASA is therefore computed once on the deposited 1QJ8 coordinates and joined to the
  OPM-oriented residues by identity (resSeq + resName); oriented coordinates are used only for display, depth (z),
  zone membership and membrane orientation.
- **Lipid-facing classification:** side-chain heavy-atom centroid (Gly: Cα) with |z| ≤ 11.8 Å AND surface →
  *lipid-facing candidate*; outside the slab AND surface → *aqueous-facing*; otherwise buried. Transmembrane residues
  that are buried (barrel interior, e.g. Lys27, Asp124) are not lipid-facing.
- **Chemistry classification:** unchanged educational four classes and palette (`chemistry.ts`, `colors.ts`).
- **Observed (not a population statistic):** OmpX lipid-facing 25 nonpolar / 7 polar (all Tyr) / 0 acidic / 0 basic;
  aqueous-facing 10 / 22 / 10 / 7; ubiquitin surface 15 (Gly 6) / 13 / 10 / 11.
- **Teaching wording:** nonpolar surface is unfavourable in water; the hydrocarbon interior of the bilayer can
  accommodate it. Avoided: "hydrophobic residues seek/are attracted to lipids", "binds lipid", "membrane region is
  all hydrophobic", "hydrophobic residues are always inside/outside".
- **Limitations:** static structures, flat fixed-thickness slab (no interface gradient, no deformation, no lipid
  atoms, not MD); protein-alone SASA ignores detergent/crystal contacts; single side-chain reference point; fixed
  25 % cut-off (15–30 % checked); Shrake–Rupley sampling noise (≤2 Å²/residue between frames) is kept out of the classification by one
  reference frame, but Val135 (24.1 %) still sits near the cut-off;
  OmpX is an outer-membrane β-barrel, not representative of all membrane proteins; Side A/B named neutrally.

### Sources

- Vogt J, Schulz GE (1999) [Structure 7:1301–1309](https://doi.org/10.1016/S0969-2126(00)80063-5). RCSB PDB 1QJ8.
- Lomize MA et al. OPM database ([opm.phar.umich.edu](https://opm.phar.umich.edu)); oriented coordinates 1qj8.
- Fernández C et al. (2002) NMR of OmpX in detergent micelles — cited by OPM as boundary verification.
- Horn BKP (1987) J. Opt. Soc. Am. A 4:629–642 — quaternion rigid fit.
- Levy ED (2010) [J. Mol. Biol. 403:660–670](https://doi.org/10.1016/j.jmb.2010.09.028) — rASA 25 % surface convention.
