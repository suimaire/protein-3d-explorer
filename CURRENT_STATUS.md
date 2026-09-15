# Protein 3D Explorer — Current Status

## Phase 4A — Hemoglobin Quaternary Structure, completed and verified (2026-09-15)

## Completed

- Chapter 1: **Peptide Geometry**
- Chapter 2: **α-Helix**, **β-Sheet**, **Hydrophobic Core**, **Soluble vs Membrane Protein**

## Chapter 3 — From Structure to Function

Completed:
- **Hemoglobin Quaternary Structure**

Hemoglobin Quaternary Structure:

- Candidates reviewed: 2HHB, 4HHB, 1A3N, 2DN2 (table in `HEMOGLOBIN_QUATERNARY_VALIDATION.md`). Selected **PDB 2DN2**
  (human deoxy HbA, X-ray 1.25 Å, 574/574 residues, no altlocs, only HEM + water). Unmodified RCSB file (SHA-256 tested),
  fetched from the same origin only when the module opens.
- Biological assembly 1 = deposited chains A–D, identity operator (RCSB `2DN2.pdb1` coordinates identical). α/β from
  DBREF UniProt + RCSB entities: α1 A, β1 B, α2 C, β2 D (β1 = larger α1 contact). 4 hemes, 4 Fe, one per chain by
  coordinates; Fe–His NE2 2.16–2.21 Å = LINK records.
- General chain-aware `parseMultiChainPdb` / `parsePdbHeader` (residue key chain + resSeq + iCode + resName); chain-aware
  peptide bonds; shared per-chain ribbon builder (`src/rendering/ribbon.ts`, also used by ProteinScene); new
  `AssemblyScene`; generic `src/protein/quaternary.ts` (interfaces, hetero association, exploded offsets).
- UI: Ribbon / Atoms / Space filling; Color Default / By subunit / By chain type (legend with PDB chains); View Whole
  tetramer / α1 / β1 / α2 / β2 (others translucent); Show Heme / Interfaces (≤4.0 Å, per-pair buttons) / Separate subunits
  (8 Å translation with disclaimer); Heme 1–4 buttons and Focus heme (proximal His shown); residue/heme/subunit inspector;
  question first, "관찰 후 확인하기" collapsed.

## Verified

- Initial main / HEAD `31e8949`, clean, 2 local commits ahead of origin/main (preserved). Only this repository modified.
- `npm run typecheck` passed. `npm test`: **225 passed = 204 preserved + 21 Phase 4A**.
- `npm run build` passed. Vite >500 kB advisory remains for the shared three.js chunk (509.84 kB, unchanged); new lazy chunk
  `HemoglobinQuaternaryLab` ~38 kB; 2DN2 asset 825 kB separate, not requested at start.
- `npm run test:browser`: all six scripts pass (24 + 24 + 31 + 18 + 16 + 17), console errors 0. Existing scripts changed
  only for the six-module navigation and, in the β-Sheet script, a fixed scroll position before pixel captures.
  1440 px and 768/390/320 px checked.
- Screenshots: `phase4a-hb-tetramer.png`, `phase4a-hb-subunits.png`, `phase4a-hb-hemes.png`, `phase4a-hb-exploded.png`,
  `phase4a-hb-mobile.png`; `phase4a-browser-results.json`; audit `node scripts/hemoglobin-audit.mjs`.
- Local commit only; **no push**.

## Next recommended

- **Phase 4B — Hemoglobin T ↔ R Structural Transition**, in a separate session. Not started.

---

## Phase 3B — Soluble vs Membrane Protein, completed and verified (2026-09-15)

## Completed

- Chapter 1: **Peptide Geometry**
- Chapter 2: **α-Helix**, **β-Sheet**, **Hydrophobic Core**, **Soluble vs Membrane Protein**

Soluble vs Membrane Protein:

- Candidates reviewed: OmpX 1QJ8, OmpA 1BXW/1QJP, GlpG 2IC8, bacteriorhodopsin 1C3W (table in
  `SOLUBLE_MEMBRANE_VALIDATION.md`). Selected **OmpX, PDB 1QJ8** (E. coli, X-ray 1.9 Å, 8-strand β-barrel,
  monomer, 148/148 residues modeled, 1158 heavy atoms). Unmodified RCSB file bundled (SHA-256 tested).
- Orientation from **OPM 1qj8**: normal +z, centre 0, boundaries ±11.8 Å (23.6 ± 2.8 Å). Rigid transform fitted to
  OPM's oriented file (1154 atoms, RMSD 0.0022 Å); deposited coordinates preserved; slab and classification share one object.
- Side-by-side ubiquitin (existing 1UBQ/SASA/chemistry reused) and OmpX viewers on desktop; stacked on ≤850 px.
  Shared Representation (Ribbon / Atoms / Space filling), Color (Default / Chemistry), Highlight
  (All / Surface / Buried / Lipid-facing / Aqueous-facing), Show membrane; OmpX Side / Top / Fit; ubiquitin Reset / Fit.
- Residue panel: class, surface accessibility, membrane depth (side-chain centroid and Cα), inside/outside region,
  lipid-facing candidate criterion; altloc, His100N and Tyr notes. Conclusions and composition collapsed until opened.
- Observed: OmpX lipid-facing 25 nonpolar / 7 polar (all Tyr) / 0 / 0; aqueous-facing 10 / 22 / 10 / 7;
  ubiquitin surface (rSASA ≥25 %) 15 (Gly 6) / 13 / 10 / 11. Exceptions kept: Tyr girdle, buried Lys27/Asp124 inside
  the barrel at bilayer depth, exposed nonpolar loop residues.
- Module lazy-loaded; both SASA computed on first open (~90 ms for OmpX in Node).

## Verified

- Initial main / HEAD / origin/main `b8b5975` (also `git ls-remote`), clean, 0/0. Only this repository modified.
- `npm run typecheck` passed. `npm test`: **204 passed = 172 preserved + 32 Phase 3B** (26 + 6 frame-invariant SASA tests).
- `npm run build` passed. Vite >500 kB advisory warning remains for the shared three.js chunk (507.1 → 509.8 kB);
  new lazy chunk `SolubleMembraneLab` 167.3 kB; initial `index` 241.9 kB; membrane chunk not requested at start.
- `npm run test:browser`: **113 passed = 24 + 24 + 31 + 18 + 16**, console errors / uncaught exceptions **0**.
  Existing scripts: only nav count 4 → 5 and expected nav labels. 1440 px and 768/390/320 px checked.
- Screenshots reviewed: `phase3b-soluble-vs-membrane.png`, `phase3b-membrane-chemistry.png`, `phase3b-lipid-facing.png`,
  `phase3b-aqueous-facing.png`, `phase3b-top-view.png`, `phase3b-mobile.png`; `phase3b-browser-results.json`.
- Audit: `node scripts/membrane-audit.mjs [--fit <opm 1qj8.pdb>]` → `artifacts/membrane-audit.json`.
- Local commit only; **no push**.

## Scientific simplifications

- Static structures; slab = flat OPM hydrophobic region guide, not lipid atoms, not MD.
- Protein-alone SASA ("surface accessibility"), fixed 25 % cut-off (15–30 % checked); single side-chain depth point.
- SASA/rSASA computed once on deposited 1QJ8 coordinates and joined by residue identity; OPM-oriented coordinates
  only for rendering, depth, zone and orientation (frame-invariant; Val135 24.1 % stays buried in every orientation).
- Side A / Side B named neutrally; OmpX is an outer-membrane β-barrel.

## Next recommended module

- (Historical, Phase 3B) Phase 4A — Hemoglobin Quaternary Structure. Completed 2026-09-15; see top.

---

## Phase 3A — Hydrophobic Core, completed and verified (2026-09-15)

## Completed

- Chapter 1: **Peptide Geometry**
- Chapter 2: **α-Helix**, **β-Sheet**, **Hydrophobic Core**

Hydrophobic Core Explorer:

- Real experimental structure: **PDB 1UBQ**, human ubiquitin, X-ray 1.8 Å, chain A, 76 residues,
  602 heavy atoms. Unmodified RCSB file bundled (SHA-256 tested); 58 waters hidden and labelled as such;
  no ligands, altlocs or missing atoms; partial-occupancy C-terminal tail flagged.
- Representations Ribbon / Atoms-sticks / Space filling; color Default / Chemistry / Exposure;
  exposure All / More buried 25% / More exposed 25% (within-protein rank); visual clipping with depth
  slider and reset; Reset camera / Fit; 3D click and dropdown residue selection.
- Residue panel: name, 3-letter code, number, class, relative exposure %, rank, 25% group membership,
  secondary structure, SASA, class caveats (His not always +1), distance-only polar contacts.
- Shrake–Rupley SASA (probe 1.4 Å, 960 points, Bondi radii), Tien 2013 theoretical maxima.
- Collapsed "이 구조에서 관찰된 분포": buried 15 nonpolar / 3 polar / 0 acidic / 1 basic;
  exposed 7 nonpolar (4 Gly) / 4 / 5 / 3. Data-derived exceptions: Leu8 (exposed nonpolar),
  Gln41 (buried polar).
- Module lazy-loaded; SASA computed once when first opened (~80 ms).

## Verified

- Initial main / HEAD / origin/main `8b81c88`, clean, 0/0. Only this repository modified.
- `npm run typecheck` passed. `npm test`: **172 passed = 139 preserved + 33 new**.
- `npm run build` passed. Note: Vite's advisory >500 kB warning now appears for the shared three.js
  chunk (497.8 → 507.1 kB); the new module is a separate lazy chunk.
- SASA equals Biopython ShrakeRupley (same parameters) within 0.00005 Å² per residue. FreeSASA/DSSP
  cross-check not possible here (documented).
- `npm run test:browser`: **97 passed = 24 Peptide + 24 α-Helix + 31 β-Sheet + 18 Hydrophobic Core**,
  console errors and uncaught exceptions **0**. Existing scripts only had the nav count updated 3 → 4.
  Desktop 1440×1100 and 768/390/320 px; no horizontal overflow; screenshots reviewed:
  `phase3a-hydrophobic-core.png`, `phase3a-buried.png`, `phase3a-exposed.png`,
  `phase3a-cross-section.png`, `phase3a-mobile-{768,390,320}.png`, `phase3a-browser-results.json`.
- Reproducible audit: `node scripts/core-audit.mjs` → `artifacts/core-audit.json`.
  Reference fixture: `python scripts/sasa-reference.py` (needs Biopython; not a project dependency).
- Details: `HYDROPHOBIC_CORE_VALIDATION.md`, `SCIENTIFIC_NOTES.md`.
- Local commit only; **no push** (Pages not updated before review).

## Scientific simplifications

- One crystal conformer; SASA of the isolated chain without waters, partners or crystal contacts.
- Heavy atoms only, element Bondi radii; normalization maxima come from DSSP-based Tien 2013 values
  (approximate; C-terminal Gly76 shows ≥100%).
- 25% groups are within-protein ranks, not a buried/exposed law; continuous % is shown first.
- Educational four-class chemistry (Gly nonpolar, Tyr/Cys polar uncharged, His basic without a fixed charge).
- Space filling = vdW spheres, not a molecular surface. Clipping is visual only.
- Secondary structure from deposited HELIX/SHEET records; display bonds inferred from distances.
- No folding simulation, energy, MD, membrane protein, binding pocket or other Phase 3B+ content.

## Next recommended module

- (Historical) Phase 3B — Soluble vs Membrane Protein. Completed 2026-09-15; see top.

---

## Phase 2B — completed and verified (2026-09-09)

- Available modules: Chapter 1 **Peptide Geometry**; Chapter 2 **α-Helix** and **β-Sheet**.
- β-Sheet: idealized 3 × Ac–(L-Ala)₇–NHMe; 21 Ala, 144 atoms / 141 bonds.
- Antiparallel / Parallel; actual backbone H-bond networks 14 / 12; cap-inclusive counts 16 / 16.
- N→C direction guides, side-chain alternation, strand/residue inspection, actual φ/ψ and
  Ramachandran marker, H-bond focus and measured H···O/N···O/angle, all five display toggles,
  Sheet/Top/Edge/Reset/Fit and full reset.
- Representative/measured φ −135°, ψ +132.272099°, trans ω, planar peptide groups,
  unchanged bond lengths/angles and L stereochemistry. Untwisted pleated idealization is explicit.
- Both models: 16 raw overlaps, all valid H-bonds; **0 serious unfavorable clashes**, including
  caps. Existing topology/radii/0.40 Å threshold and shared chemical classifier unchanged.
- **139 tests passed = 107 preserved + 32 β-Sheet**. Typecheck and production build passed.
- Chromium production QA: **79 passed = 24 Peptide + 24 helix + 31 β-Sheet**; console errors
  and uncaught exceptions **0**. Desktop 1440×1100; 768/390/320 px, no horizontal overflow.
  Antiparallel/parallel/edge and 390 px screenshots visually reviewed.
- Artifacts: `phase2b-beta-{antiparallel,parallel}.png`, `phase2b-beta-edge-view.png`,
  `phase2b-mobile-{768,390,320}.png`, `phase2b-browser-results.json`, `beta-audit.json`.
- Reproducible pair/coordinate audit: `node scripts/beta-audit.mjs`.
- Initial main / HEAD / origin/main: `ccf54d1509b13d77878d55a0b1a4d2d08f99c744`, clean.
  Live remote main also confirmed at that commit using a command-local OpenSSL TLS backend
  after Windows Schannel credentials failed; no Git configuration changed.
- Only this repository modified. Existing Pages workflow/configuration unchanged. Local commit
  only; no push. No hydrophobic core, hairpin, turn, portal or other explorer work.
- Scientific method and limitations: `SCIENTIFIC_NOTES.md`, full `BETA_SHEET_VALIDATION.md`.

## Completed (prior phases; historical record)

- Phase 1 implementation: Vite + React + strict TypeScript + Three.js; Peptide Geometry Lab.
- Pure geometry and sterics code, renderer, UI, schematic plot, teaching text separated.
- Ac–L-Ala₅–NHMe with central Ala 3 φ/ψ manipulation, measured-angle plot synchronization,
  trans peptide planes, representation toggles, clash pairs, presets, camera/reset controls.
- Korean teaching UI, mobile stacking, native keyboard sliders, keyboard camera, explicit schematic caveats.
- README and scientific documentation; no worksheet, login, deployment, or remote.
- Phase 1.1 steric-clash validation completed. The former α-like count of 6 was traced to six
  fixed O(i)–Cα(i+1) 1–4 pairs and corrected with a three-bond topology exclusion.
- UI now reports `심한 비결합 겹침`; detailed pair audit is in `STERIC_CLASH_VALIDATION.md`.

## Phase 2A — completed and verified

- **α-Helix Lab completed** on 2026-09-09. Student navigation exposes only Chapter 1 Peptide
  Geometry and Chapter 2 α-Helix. No β-Sheet or other future module implemented.
- Model: idealized Ac–(L-Ala)12–NHMe, 78 atoms / 77 bonds, repeated measured φ −60° / ψ −45°,
  trans ω, planar peptide groups and preserved bond lengths/angles/L chirality.
- Right-handed screw rotation +98.869342° per residue; measured 3.641169 residues/turn,
  1.540360 Å rise/residue, 5.608710 Å pitch. Approximate textbook dimensions separately labeled.
- Coordinate-screened Ala-only i→i+4 H-bonds: 8 (12−4). O···N 3.060309 Å, H···O 2.082598 Å,
  N–H···O 162.321327°. Selection highlights the carbonyl C/O and donor H/N; displayed count
  derives from the rendered network. Cap/end limitations explained.
- Side/Top/Reset/Fit, drag/keyboard rotation, wheel/keyboard zoom, backbone/side-chain/atom/
  H-bond/axis options, backbone-only comparison, residue selection with actual-angle Ramachandran
  marker, and return to Peptide Geometry implemented. Axis is a geometric guide, not an atom.
- **Interaction classification:** 10 raw O···H overlaps (8 internal + 2 cap), each 0.437402 Å,
  pass covalent amide donor/carbonyl acceptor identity and shared distance/angle checks.
  Serious unfavorable clashes: **0**. Cap pairs 0:O–4:H and 9:O–13:H each measure H···O
  2.082598 Å, N···O 3.060309 Å, N–H···O 162.321327°. No threshold/radius/topology change.
- Final `npm run typecheck`, `npm test` (**107 passed**) and production `npm run build` passed.
  Updated raw-overlap audit and added negative chemistry/geometry/cap regression tests.
- `npm run test:browser` runs both suites: **24 Peptide Geometry + 24 helix = 48 passed**, console errors
  **0**, uncaught exceptions **0**, production preview on 127.0.0.1:4173.
- Desktop 1440×1100 and 768/390/320 px layouts checked. Desktop, Top and 390 px mobile captures
  visually reviewed; no horizontal overflow. Resize preserves helix viewing direction.
- Captures/results in ignored `artifacts/`: `phase2a-alpha-helix.png`, `phase2a-alpha-helix-top.png`,
  `phase2a-mobile-{768,390,320}.png`, `phase2a-browser-results.json`.
- Detailed scientific audit: `ALPHA_HELIX_VALIDATION.md`; assumptions and references:
  `SCIENTIFIC_NOTES.md`. Existing carbohydrate/lipid explorers were not modified or accessed.
- Local-only session; no push, new GitHub repository, deployment or portal integration.

## Phase 1.1 scientific validation (historical)

- Existing α-like 6: all six were 1–4 O–Cα pairs at 2.773 Å with 0.447 Å nominal overlap;
  four internal and two at cap boundaries. Meaningful nonbonded clashes: 0; topology artifacts: 6.
- Final policy: exclude 1–2/1–3/1–4; retain contacts four or more bonds apart; keep cap atoms in
  nonlocal checks; use C 1.70/N 1.55/O 1.52 Å and polar amide H 1.00 Å; report overlap >0.40 Å.
- α-like −60/−45: 0; β-like −135/+135: 0; Extended −180/+180: 0.
- Deliberately unfavorable comparisons: 0/0: 8, +60/0: 3, −180/0: 1 severe nonbonded overlaps.
- This remains a partial-atom educational geometric indicator, not MolProbity, a force field,
  molecular dynamics, or a Ramachandran allowed/forbidden classifier.

## Phase 1.1 verification (historical)

- 2026-09-09 (Asia/Seoul): `npm run typecheck` and final `npm run build` passed.
- `npm test`: **77/77 passed** — the original **67/67 geometry tests** plus **10/10 Phase 1.1
  sterics tests**. Independent signed-angle fixtures; 56 target angle combinations
  including ±180°; φ/ψ independence and correct upstream/downstream membership; all bond lengths
  and adjacent angles preserved; six peptide groups planar and trans; L-Ala chirality preserved;
  36 atoms / 35 bonds; topology exclusions, exact preset/unfavorable pair lists, cap inclusion,
  polar-H radius, collision sensitivity, and actual-angle plot mapping.
- `npm run test:browser`: **24 checks passed** on the production preview at
  `http://127.0.0.1:4173/protein-3d-explorer/`, Chromium with software WebGL.
- Tested sliders/keyboard, actual-angle marker synchronization, presets, plot click, all eight
  display toggles, clash highlighting/count, whole-lab reset, mouse orbit, keyboard/wheel zoom,
  exact rendered-camera restoration. All passed. Plot click permits 1° screen-pixel tolerance.
- Desktop 1440×1050; responsive widths 768, 390, 320 px checked for horizontal overflow (none).
  `phase1-1-alpha-like.png`, `phase1-1-clash-validation.png`, and `phase1-1-vdw.png` were
  visually inspected. α-like clash display is clear at 0; the 0/0 clash lines and vdW overlap
  agree visually with the collapsed geometry. Model fits the viewer;
  responsive stacking is usable. Initial camera now exposes both arms of the peptide; labels
  use collision spacing and leader lines to their actual atoms.
- Browser console errors: **0**. Uncaught page exceptions: **0**.
- Captures and machine-readable check list remain locally in ignored `artifacts/`.
- Existing explorers had clean Git status before work; final preservation checked separately.
- No lint script in either reference or this project. Strict TypeScript, geometry tests, build,
  and real browser QA are the applicable checks.

## Scientific assumptions / simplifications

- Phase 1: ideal bond geometry, all ω=180°. Only Ala 3 φ/ψ varies; other residues −135°/+135°.
- Phase 2A: all Ala φ/ψ = −60°/−45°, ω trans; idealized educational helix, not experimental data.
- Explicit amide H; carbon-bound H omitted. Neutral Ac/NHMe caps.
- Ramachandran map is authored schematic, not empirical data or an allowed/forbidden classifier.
- Serious nonbonded overlap = vdW overlap >0.40 Å, excluding 1–2/1–3/1–4. Heavy-atom Bondi
  radii, polar amide H 1.00 Å; entire model including nonlocal cap contacts.
- Detailed values, limitations, references in SCIENTIFIC_NOTES.md.

## Existing explorer analysis / dependency decisions

- Inspected only the two existing explorers inside the authorized workspace; both initially clean.
- Carbohydrate: React 19, Vite 8, TypeScript, 3Dmol atom/SDF models, viewer controls/reset,
  separated components, white/gray + green design, Arial/Malgun Gothic, responsive CSS,
  Vitest component/geometry tests, scientific validation docs, npm/build/deployment README.
  Vite has fixed repository base; Actions builds dist then deploys with Pages actions. No lint script.
- Lipid: static HTML/CSS/ES modules, locally vendored Three.js r170, procedural atom/bond geometry,
  custom orbit/picking/labels, blue accent on white, Malgun Gothic/system typography,
  responsive module layout, Node geometry checks, scientific notes organized by simplifications,
  detailed scientific/development README. Relative paths; Actions deploys static root. No lint script.
- Reused patterns, not existing project files: React/Vite/TS/Vitest from carbohydrate; Three r170,
  procedural atoms/bonds, blue/white scientific surface from lipid. Existing sources remain untouched.
- Three.js + @types/three: direct control of topology-driven moving atoms and peptide-plane meshes;
  OrbitControls ships with Three, so no extra camera package. Reuses lipid's r170 version.
- React/ReactDOM + corresponding types: composable module UI and consistent existing stack.
- Vite + React plugin + TypeScript: existing development/build pattern, strict geometry types.
- Vitest: scientific invariant tests. Playwright: requested real WebGL/browser and mobile QA.
  No component framework, backend, data, icon, state, plotting, or chemistry dependency added.
- Future Pages base configured; no deployment workflow created in this phase.

## Known issues

- No known blocking issue in the tested Chromium environment.
- α-Helix has 10 raw overlaps classified as valid H-bonds and 0 serious unfavorable clashes.
  This is not a complete all-atom energetic validation.
- Real iOS/Android touch hardware and Safari/Firefox were not tested. Mobile checks use Chromium
  viewport emulation; pinch is supplied by Three.js OrbitControls, not independently device-tested.
- WebGL is required; unsupported contexts show a readable fallback. Extremely zoomed/overlapping
  conformations can be clearer with Atom labels disabled. Scientific limitations above are intentional.
- Carbon-bound H is absent, so the detector cannot serve as a complete all-atom clashscore.

## Next recommended module

- (Historical, Phase 2B) Phase 3A — Hydrophobic Core Explorer. Completed 2026-09-15; see top.
  Current next: **Phase 3B — Soluble vs Membrane Protein**.

## Project rule

- Update this file at the end of every development session. Update SCIENTIFIC_NOTES.md and
  geometry tests whenever scientific assumptions change. Show only completed modules to students.
- Local work only for this session; do not push, create GitHub repositories, or deploy.
