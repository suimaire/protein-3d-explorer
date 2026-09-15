# Phase 4B — Hemoglobin T ↔ R Structural Transition validation

Validated 2026-09-15. Initial main / HEAD `1389cd8`, clean working tree, 0 ahead / 0 behind origin/main. Only
`protein-3d-explorer` modified. All numbers below come from `node scripts/hemoglobin-transition-audit.mjs`
(writes `artifacts/hemoglobin-transition-audit.json`), which runs the same code as the app
(`src/protein/hemoglobinTransition.ts`). Unit tests: `tests/hemoglobinTransition.test.ts` (34).
Browser QA: `node scripts/hemoglobin-transition-browser-test.mjs` (production preview on port 4173).

# Preflight — heme bond rendering (Phase 4A note)

Question: are the 1.01–1.24 Å heme distances (A) real deposited coordinates or (B) wrong atom pairs joined by the
distance heuristic?

- The distance-inferred bond list of every heme (2DN2 ×4, 2DN1 ×4, also checked on 2DN3) was compared with the heavy-atom
  bond table of the wwPDB Chemical Component Dictionary entry **HEM** (`_chem_comp_bond`, 50 bonds including the four
  Fe–N). Result: **identical, 50/50 for every heme; no extra and no missing pair** (fixture `tests/fixtures/hem-ccd-bonds.json`,
  test 3).
- The short distances are between correctly bonded atoms, e.g. 2DN2 HEM C 142 CGD–O1D: CGD (3.646, 22.115, 62.073),
  O1D (2.902, 22.586, 62.568) → 1.010 Å straight from the file (B 25.5/35.6 Å²). They occur only in propionate carboxylates
  and vinyl groups, which are flexible and weakly restrained.
- Conclusion: **case A** (deposited coordinates). No renderer change was needed; coordinates are not modified. Documented
  here and in `SCIENTIFIC_NOTES.md`.

# Candidate evaluation

RCSB Data API (`core/entry`, `core/assembly`, `core/polymer_entity`, `core/nonpolymer_entity`), the PDB files and the
PubMed abstracts of the primary citations, checked 2026-09-15. T endpoint re-checked: 2DN2 is human deoxy HbA
(title "…human hemoglobin in the deoxy form", Park et al. 2006; unliganded, 1.25 Å, 574/574 residues, no altlocs, identity
tetramer) — kept unchanged as the T endpoint.

| PDB | ligand | state | resolution | completeness | issues |
|---|---|---|---:|---|---|
| **2DN1** (Park et al. 2006) | **O₂** (OXY ×2 per αβ, occupancy 1.00) | oxy, R-like quaternary (P4₁2₁2 R crystal form) | **1.25 Å** | 570/574 in the assembly: α Val1 and β Val1 unmodeled; β His2 side chain (6 atoms) missing | αβ dimer in the asymmetric unit (tetramer by crystallographic 2-fold); 2 toluene (MBN) per αβ; no altlocs; R_work 0.195, no R_free in the header; same study, lab and resolution as 2DN2 |
| 2DN3 (Park et al. 2006) | CO (CMO) | carbonmonoxy, R-like | 1.25 Å | 574/574 | αβ ASU + 2-fold; not O₂ — would have to be labelled "CO-liganded R-like" |
| 1IRD | CO (CMO) | carbonmonoxy, R-like | 1.25 Å | 574/574 | β chain numbered 201–346 (needs renumbering); not O₂; different study from 2DN2 |
| 1HHO (Shaanan 1983) | O₂ | oxy, R-like | 2.1 Å | 574/574 | older real-space refinement (Park et al. 2006 show the older structures reflect the refinement software); PO₄; COMPND "ENGINEERED: YES" annotation on natural protein; lower resolution |

All four are adult human HbA (DBREF P69905 / P68871) and RCSB assembly 1 =
tetramer built with operators `1,2` (identity + crystal symmetry y, x, −z).

# Selected endpoints

**T: PDB 2DN2** — human deoxyhemoglobin A, X-ray 1.25 Å, no heme ligand. Unchanged Phase 4A asset
(SHA-256 `cc2fca41…e214`).

**R: PDB 2DN1** — human **oxy**hemoglobin A, X-ray 1.25 Å, O₂ bound to each heme Fe. Park, Yokoyama, Shibayama, Shiro & Tame
(2006) J. Mol. Biol. 360:690–701, doi 10.1016/j.jmb.2006.05.036 — the same paper as 2DN2. Unmodified RCSB download
`src/data/structures/2DN1.pdb`, SHA-256 `4251fa525fb3378c87094495d39e449fb2368aad40d94c3ee8f2e61c130e44e1` (test 1).
Crystal growth: Na/K phosphate, glycerol, pH 6.7, 277 K.

Reasons: a true O₂-bound structure (preferred over CO), matched to the T endpoint (same study, method, resolution, numbering
and refinement approach), highest resolution. The costs — two missing N-terminal Val, one side chain and the toluene
additive — are small and are handled explicitly (below). The UI calls it "R-like (oxy)", "O₂ bound", never CO.

## R biological assembly

- `REMARK 350`: one biomolecule, author TETRAMERIC, chains A, B; BIOMT 1 identity, BIOMT 2 = rotation
  [[0,1,0],[1,0,0],[0,0,−1]], translation 0 (y, x, −z; a proper rotation, det +1). Equal to RCSB assembly 1
  (`author_defined_assembly`, oligomeric count 4, oper_expression `1,2`, 4 polymer instances, 570 modeled monomers).
- The app builds the tetramer at runtime (`buildAssembly`): chains A, B (operator 1, deposited coordinates) and their
  copies A_2, B_2 (operator 2). A copy's chain ID `A_2` means "PDB chain A, symmetry copy"; residue keys therefore never
  collide (`A:9:ASN` ≠ `A_2:9:ASN`).
- Test 2 applies the file's operators to every deposited coordinate record and reproduces RCSB's generated `2DN1.pdb1`
  MODEL 1 and MODEL 2 byte-for-byte in columns 1–66 (SHA-256 digests in `tests/fixtures/2dn1-rcsb-metadata.json`), and checks
  A_2/B_2 atom-for-atom = (y, x, −z) of A/B.
- α2β2 verified in both endpoints by the Phase 4A rules (DBREF accession per chain, identical SEQRES within a type,
  α ≠ β). The generalised `analyzeHemoglobin` also now requires each modeled residue to equal SEQRES at its numbered
  position (gaps allowed, shifts not).

# Chain mapping

Each endpoint is labelled independently by the Phase 4A rule (α1 = first α chain; β1 = β chain with the larger α1
contact; α2, β2 the rest). T and R subunits then correspond by label, after checking globin type/UniProt accession,
identical SEQRES (identity 1.00, equal length), and residue names at every UniProt position. Residues map by UniProt
position (resSeq − DBREF seqBegin + DBREF dbBegin; both files use 1-based numbering, no insertion codes), atoms by name.

| Subunit | T chain (2DN2) | R chain (2DN1 assembly) | globin | modeled T / R | only in T |
|---|---|---|---|---:|---|
| α1 | A | A | α (P69905) | 141 / 140 | Val1 |
| β1 | B | B | β (P68871) | 146 / 145 | Val1; His2 CB CG ND1 CD2 CE1 NE2 |
| α2 | C | A_2 (copy of A) | α (P69905) | 141 / 140 | Val1 |
| β2 | D | B_2 (copy of B) | β (P68871) | 146 / 145 | Val1; His2 side chain |

Structural context: α1–β1 is the largest interface in both structures (T 16+18 residues, R 19+19 at 4.0 Å) and α1–β2 is
present in both (T 14+13, R 9+9). Because the R tetramer is exactly 2-fold symmetric, assigning T α1β1 to R A/B or to
A_2/B_2 gives the same comparison; the control below (swapping roles) confirms it.

Common atoms: 4516 = 4344 polymer + 172 heme (T 4556 atoms, R 4552 incl. O₂/toluene). T minus common polymer =
2×7 (α Val1) + 2×7 (β Val1) + 2×6 (His2 β side chain) = 40 (test 10). Keys are unique; every T and R atom is used at most
once; atom identity is independent of record order (test 9, R file with HETATM first and chain B before A).

# Reference dimer

**α1β1** is the reference; **α2β2** is the moving dimer. Reasons:

- α1β1 is the tightly packed αβ unit (largest interface, above) and changes little between T and R; the αβ dimers move
  relative to each other across the α1β2/α2β1 interfaces. This is the classical frame used to describe the T→R quaternary
  change (Baldwin & Chothia 1979 superposed one αβ dimer and described the motion of the other).
- Choice checked with data: per-subunit own-fit Cα RMSD α1 0.61, β1 0.84, α2 0.54, β2 0.84 Å (subunits rigid-like; see
  Individual chain RMSD), and the
  reversed choice (α2β2 as reference) gives the same relative rotation, 14.11°.
- Naming depends only on the Phase 4A contact rule, not on chain letters.

# Alignment

- **Method**: rigid-body least-squares superposition (Horn 1987 unit quaternion, `fitRigid`; equivalent to Kabsch with the
  reflection case excluded by construction). R → T frame; T coordinates are never changed. No scaling, no deformation.
- **Atoms**: all Cα present in both endpoints for α1 and β1: **285** (α 2–141, β 2–146). No altlocs in either file. No
  outlier removal in the main fit (pre-defined sensitivity rule below).
- **Reference dimer RMSD: 0.928 Å** (max deviation 6.40 Å at β1 His146 Cα, the C-terminal residue; 227/285 Cα within
  1.0 Å). Next largest: β1 Tyr145 2.84, α1 Ala88 2.36, β1 Leu96 2.29, His97 2.27, Asp94 2.25 Å — C terminus and the
  heme-proximal F helix / FG corner, i.e. tertiary differences inside the dimer.
- **Rotation determinant: +1.000000000000**; rotation matrix rows (6 dp) [−0.311207, 0.585253, 0.748752],
  [0.652056, 0.704662, −0.279774], [−0.691356, 0.401161, −0.600914]; translation (2.739, −24.614, 49.372) Å. This transform
  mostly reflects the different crystal frames of 2DN1 and 2DN2, not a biological motion.
- Tests: orthonormality, det +1, a mirrored target is not fitted by a reflection (RMSD > 5 Å, det +1), internal distances
  preserved to 1e-9 Å, least-squares optimality, determinism (tests 11–15).
- **Sensitivity** (pre-defined rule: drop UniProt positions 1–4 and the last three residues of each chain): 273 Cα,
  reference RMSD 0.81 Å, moving-dimer rotation 14.02°, moving own-fit 0.77 Å.
- **Contrast**: a whole-tetramer best fit gives Cα RMSD 2.41 Å — the rearrangement is smeared over all four subunits,
  which is why the module never uses it.

# Quaternary rearrangement

After the α1β1 alignment, the best rigid motion taking T α2β2 Cα (285) onto aligned R α2β2 Cα:

- Moving-dimer Cα RMSD before its own fit: **5.19 Å**; after its own fit: 0.89 Å (the dimer keeps its shape; its position
  relative to α1β1 differs).
- **Relative rotation: 14.11°** (det +1).
- **Axis** (unit, T/2DN2 frame): (−0.9293, 0.0904, −0.3582); point on the axis nearest the T centroid (−0.44, 25.15, 34.06);
  T centroid 11.5 Å from the axis; **translation along the axis −1.32 Å** (Chasles screw decomposition, verified to
  reproduce the centroid motion, test 17).
- **Centroid displacement: 3.12 Å** (Cα centroid T (−3.51, 15.54, 39.61) → R (−2.91, 17.24, 42.16)).
- Control: α2β2 as reference → α1β1 rotation 14.11°, reference RMSD 0.894 Å.

**Literature consistency.** Baldwin & Chothia (1979, J. Mol. Biol. 129:175) described the deoxy → liganded quaternary change
as a rotation of one αβ dimer relative to the other of roughly 15° with a small (~1 Å) shift along the rotation axis;
textbooks usually quote "about 15°". The value computed here, 14.1° with a −1.3 Å axial shift, agrees qualitatively and
in magnitude. It was not tuned: the exact number depends on the structure pair (2DN2/2DN1 here; CO or other R forms differ
slightly), on the atoms fitted (all common Cα; 14.0° without termini) and on the frame definition. Park et al. (2006) also
propose a different fixed-residue frame for R/T comparison; this module uses the simpler whole-dimer Cα frame and says so.

# Heme / ligand

Proximal His re-used from Phase 4A (nearest polymer N/O/S to Fe): His87 NE2 (α) and His92 NE2 (β) in both endpoints.
Porphyrin plane = least-squares plane of the 24 macrocycle atoms (NA–ND, C1A…C4D, CHA–CHD); sign + = toward the proximal
His NE2. R values are pairwise identical for symmetry copies (α1 = α2, β1 = β2) because the R tetramer is generated.

| Heme | subunit | Fe–His NE2 T | Fe–His NE2 R | Fe ↔ porphyrin plane T | R | Fe ↔ 4 N plane T | R | O₂ in R: Fe–O1 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | α1 | 2.196 | 2.071 | +0.499 | +0.094 | +0.388 | +0.045 | 1.817 |
| 2 | β1 | 2.194 | 2.063 | +0.454 | +0.056 | +0.349 | −0.026 | 1.775 |
| 3 | α2 | 2.205 | 2.071 | +0.464 | +0.094 | +0.310 | +0.045 | 1.817 |
| 4 | β2 | 2.162 | 2.063 | +0.399 | +0.056 | +0.321 | −0.026 | 1.775 |

- LINK records agree: 2DN1 NE2–Fe 2.07 (α), 2.06 (β) Å; Fe–O1 1.82 (α), 1.78 (β) Å (tests 4, 24).
- Ligand: `OXY` O1/O2, occupancy 1.00, no altlocs, one per heme (assigned to the nearest Fe, must be ≤ 2.5 Å). B-factors:
  α O1 14.1 / O2 35.1, β O1 19.7 / O2 33.2 Å² (terminal O less ordered). Full occupancy is what was deposited; it is not a
  claim that every molecule in the crystal was oxygenated, and the UI does not say "fully saturated".
- O₂ is drawn only for the R endpoint (R state and Overlay). Nothing is placed on T or in the motion guide (test 25).
- Toluene (MBN ×2 per αβ): declared as an additive, excluded from display and analysis; 230 waters omitted (T: 221).
- The UI states that local heme changes and the global quaternary change are observed together but that these two
  structures alone do not prove a single causal chain.

# Interface changes

Same criterion as Phase 4A: residues with any heavy-atom pair ≤ **4.0 Å**. Computed between the reference dimer (α1, β1) and
the moving dimer (α2, β2), on atoms present in both endpoints (so missing His2 atoms cannot create a fake change), with R in
the aligned frame (distances are frame-invariant).

| Pair | T residue pairs | R | common | lost (T only) | gained (R only) |
|---|---:|---:|---:|---:|---:|
| α1–α2 | 4 | 2 | 0 | 4 | 2 |
| α1–β2 | 26 | 18 | 11 | 15 | 7 |
| β1–α2 | 26 | 18 | 12 | 14 | 6 |
| β1–β2 | 0 | 2 | 0 | 0 | 2 |
| **total** | **56** | **40** | **23** | **33** | **17** |

Examples (geometric contacts only, no interaction type claimed): lost — α1 Arg141 with α2 Asp126/Lys127 and with β2
Val34/Tyr35/Trp37; β2 His97 with α1 Pro44; β2 Asp99 with α1 Tyr42/Thr41/Asn97; gained — β2 His97 with α1 Thr38; β1 Asn102
with α2 Asp94; β1 His146 with β2 Asn139. These match the well-known switch/hinge regions of the α1β2 interface, but the
module does not label any salt bridge or hydrogen bond. Student UI shows only the total T / R / common / lost / gained counts
and an "Interface" emphasis toggle. Phase 4A whole-chain interface analysis for 2DN1 (all atoms): α1–β1 19+19, α1–β2 9+9,
α1–α2 2+2, β1–β2 2+2 residues.

# Quaternary motion guide

**Rigid-body guide, not a molecular trajectory and not the R structure.** The UI shows permanently under the slider:
"계산된 α2β2의 상대 회전·이동만 시각화한 가이드입니다. 실제 분자 전이 경로나 R 구조 자체가 아닙니다."

- **Body**: the T (2DN2) moving dimer as one rigid body — all 2278 T atoms of α2 and β2 (polymer, incl. Val1 and the His2 side
  chain) plus their two hemes (86 atoms). α1β1 (reference) never moves. No O₂ (T has none). T colours throughout.
- **Motion**: the already calculated T → R relative motion of α2β2 (`moving.fit`, 285 Cα, 14.11°). No number is hard-coded.
  At fraction f: rotation = quaternion SLERP from identity to the fit quaternion (angle f·14.11° about the fixed calculated axis),
  pivot = T α2β2 Cα centroid, which moves in a straight line by f × the calculated 3.12 Å displacement. f = 0 is exactly T;
  f = 1 is exactly the fit applied to T (x' = R·x + t).
- **Internal geometry**: identical at every slider position. Audit, f = 0.25/0.5/0.75/1: 2350 moving-dimer bonds, maximum
  bond-length change 1.9 × 10⁻¹⁴ Å. Tests check bond lengths, bond angles and sampled pairwise distances to 1e-9 Å.
- **Guide endpoint ≠ experimental R**: at 100 % the moving-dimer Cα differ from aligned 2DN1 by 0.89 Å RMSD (the moving
  dimer's own-fit RMSD, i.e. its tertiary differences). The experimental endpoints are only the T state / R state buttons;
  choosing R does not move the guide slider. Midpoint rotation 7.056°.
- Tests 19–24c: 0 % = T; 100 % = fit·T (exact) and continuous with the SLERP branch; pairwise distances, bond lengths and angles
  preserved; rotation angle f·θ about the calculated axis (deterministic); centroid moves f × displacement (deterministic);
  α1β1 fixed; moving hemes follow the same transform (Fe–His NE2 unchanged), reference hemes stay; T layer = deposited 2DN2
  and R layer = deposited 2DN1 assembly under the reference superposition only. Browser: 0 % draws the same coordinates and
  camera as T state; moving-dimer Cα at 0/50/100 % equals the audit while α1 Val1 Cα is unchanged; 100 % image differs from
  the R view; returning to 0 % reproduces the identical image; T / R / Overlay / Motion guide keep one camera.

# Individual chain RMSD

Each chain is superposed on its own (T vs aligned R; frame-independent), using only Cα present in both structures, matched by
subunit label + UniProt position + residue name (never array index). 2DN1 lacks Val1, so it is excluded automatically.

| Chain | matched Cα | own-fit Cα RMSD |
|---|---:|---:|
| α1 | 140 | 0.607 Å |
| β1 | 145 | 0.845 Å |
| α2 | 140 | 0.539 Å |
| β2 | 145 | 0.841 Å |

- For contrast: α2β2 Cα after the α1β1 alignment only, 5.19 Å; the moving dimer's own fit 0.89 Å. Each subunit's fold changes
  far less than the subunits' relative placement, so the UI sentence "각 globin subunit의 fold 변화보다 subunit 사이의 상대적
  재배열이 더 두드러집니다" is supported (test 26 requires max chain RMSD × 4 < 5.19 Å).
- Test 26 reproduces every value with an independent fit in the opposite direction. Test 27 applies two different arbitrary
  rigid transforms to T and R: chain RMSD, reference RMSD, 14.1°, axial translation, centroid displacement and the moving-dimer
  RMSDs are unchanged (to 1e-8), and the guide built in the transformed frame equals the transformed guide.

# Validation history

- The first Phase 4B build offered a "Morph" slider: straight-line interpolation of each common atom between T and aligned R.
  It distorted internal geometry at intermediate positions (e.g. at 50 %, 23 backbone, 345 side-chain and 13 heme bonds
  shortened by > 0.1 Å) and made 100 % look like a path to R. It was **removed** and replaced by the rigid-body quaternary
  motion guide above.

# Scientific simplifications

- Two static crystal structures (different crystal forms; 2DN1 crystals grown at 277 K) stand for "T-like" and "R-like"; the UI notes
  that T and R are useful models of major quaternary states and that hemoglobin can occupy several conformational states.
- No statement that T cannot bind O₂ or that R is always fully saturated; affinity/cooperativity deferred to Phase 4C.
- Frame = α1β1 Cα superposition; numbers shown to students: reference RMSD and relative rotation (displacement and
  individual subunit RMSD in the collapsed section). Matrices, axis, screw translation are documentation only.
- Rearrangement guide: dashed calculated rotation axis; a wedge whose **angle** is the calculated 14.1° drawn at an enlarged
  34 Å display radius (stated in the tip); a short bar for the 3.1 Å centroid shift. Labelled "relative structural difference
  after alignment", not a trajectory.
- "Dimer comparison view" looks down the calculated rotation axis.
- Interface = distance contact on common atoms; interaction types not assigned.

# Known limitations

- 2DN1 lacks α/β Val1 and the β His2 side chain; these atoms are absent from R and from contact comparison,
  but T still displays them in the T state (the difference is listed in the UI source notes).
- The R tetramer is generated by crystal symmetry, so its two αβ dimers are exactly identical; T's two dimers are not.
- 2DN1 header gives no R_free; REMARK 3 states the toluene bond angles were not restrained — not displayed.
- Deposited short heme propionate/vinyl distances remain as deposited (preflight).
- The rotation angle is specific to this pair and frame (see Literature consistency).
- Vite's >500 kB advisory for the shared three.js chunk remains (509.84 → 518.42 kB: TubeGeometry/ConeGeometry for the guide
  are now included); the new module is a separate lazy chunk (~37 kB); 2DN1 (450 kB) is a separate asset fetched on demand.
- Chromium (SwiftShader WebGL) only; real mobile devices, Safari and Firefox not tested.
