# Mutation Tolerance — implementation and validation

Validated 2026-09-29. Starting branch: main; HEAD: 69b2cec; working tree was clean.
No commit, push, branch switch, or change to existing Lab scientific content was made.

**Important source limitation:** RCSB describes 1BTL as an unmutated TEM-1 entry and 1JWP as M182T.
Nevertheless, their deposited sequences differ at **84 (ILE/VAL), 182 (MET/THR), and 184 (VAL/ALA)**.
The module visibly discloses all three differences after applying M182T. These structures do not constitute
a controlled, otherwise identical single-substitution structural comparison. Functional results come from
Jacquier Table 2, independently of the crystallographic comparison.

## A. Existing architecture

- React 19 + TypeScript + Vite; Three.js 0.170 and OrbitControls. No new package or engine.
- src/main.tsx owns local module state; module navigation uses semantic buttons and aria-pressed.
  Chapters are labels in that navigation and in each Lab heading, not routes.
- Larger Labs are lazy-loaded. Existing HbS Lab uses SickleViewer/SickleScene and same-origin PDB assets.
- ProteinViewer owns a persistent ProteinScene with dispose on unmount; the shared ribbonGeometry builder
  uses real Cα coordinates and deposited HELIX/SHEET records. Balls/sticks use sphere/cylinder geometry.
- parsePdb identifies residues by chain, author number, insertion code; alternate atom slots retain the
  highest occupancy and first record on ties. Waters, hetero groups and hydrogens are omitted.
- Existing fitRigid in rigid.ts implements Horn quaternion least-squares alignment (proper rotation).
- Existing camera controls, keyboard controls, CSS palette, labels, light/background treatment are reused.
  New optional comparison layers and focus methods extend ProteinScene without changing default behavior.
- Existing responsive patterns use CSS media queries. New module-specific rules preserve other layouts.
- No service worker or offline precache manifest exists. Structures are bundled local static assets loaded on demand.
  No new runtime external requests are introduced. Existing production page-view telemetry in index.html is untouched.
- Tests use Vitest; browser scripts use existing Playwright/Chromium. Scripts: test, typecheck, build, test:browser.
  There is no lint script.
- Baseline: 12 test files / 328 tests passed; typecheck and build passed.
  The existing Three.js chunk size warning (>500 kB) was already present.

## B. Module location

Chapter 3 — From Structure to Function: after Cooperativity & Allostery and immediately before
HbA → HbS → Polymerization. Internal HbS handoff calls the existing module state setter; no reload.

## C. UI state machine

mutationState.ts implements a reducer with the following allowed progression:

M182_WT → M182_MUTANT_APPLIED → M182_RESULTS_REVEALED → A36_CASE → A36_RESULTS_REVEALED

- Optional prediction is component state only; no persistence or submission.
- A WT state rejects reveal, overlay and A36 entry actions.
- Applying M182T enables reveal; results still require a separate click.
- WT reset clears revealed results and overlay, retaining the camera and optional prediction.
- First application issues a single focus command; subsequent WT/M182T toggles do not refocus.
- A36 entry hides results again and focuses the WT Ala36 location.
- Explicit restart returns to the beginning with whole-protein framing.
- Keyboard focus passes to replacement controls or result/case headings.

## D. Three-column layout

Desktop (>1120 px): grid columns .96fr / 2fr / 1.04fr with readable minimum side widths,
approximately 24% / 50% / 26%. Cause, observation and result are also the DOM order.
701–1120 px: cause + viewer above, results across the next row.
≤700 px: cause → viewer → reveal/results. Viewer height is 460 px desktop and 400 px mobile.
Primary apply CTA is filled accent, 84 px tall (78 px mobile); reveal is a lighter secondary emphasis.
Other controls are outlined. Results use symbols and text, not value judgments encoded only in color.

## E. Structure provenance and local assets

Acquired directly from RCSB on 2026-09-29. Original PDB bytes are retained; existing *.pdb -text rule applies.

| Property | WT entry | M182T entry |
|---|---|---|
| PDB | 1BTL | 1JWP |
| Source | https://files.rcsb.org/download/1BTL.pdb | https://files.rcsb.org/download/1JWP.pdb |
| Local asset | src/data/structures/1BTL.pdb | src/data/structures/1JWP.pdb |
| Method | X-RAY DIFFRACTION | X-RAY DIFFRACTION |
| Resolution | 1.80 Å | 1.75 Å |
| Chain | A | A |
| SHA-256 | 159d593a4b6fd7646037c221f937fd8488e9b888067ae7dcd0826122e138af09 | 2be02eaa2607116d08b23008575e5ac420f8e375a34836321f279eff4b9a1e14 |

RCSB entry pages: https://www.rcsb.org/structure/1BTL and https://www.rcsb.org/structure/1JWP.
Full per-residue mmCIF mapping is preserved in tests/fixtures/tem1-rcsb-metadata.json.
For regeneration, download the corresponding RCSB .cif files into artifacts/1BTL.cif and artifacts/1JWP.cif,
then run node scripts/mutation-source-audit.mjs. That development-only script never runs in the app.

## F. Residue numbering / mapping verification

| Conventional TEM-1 site | PDB author chain / number / insertion | mmCIF label_seq_id | 1BTL | 1JWP |
|---|---|---:|---|---|
| Ala36 | A / 36 / blank | 11 | ALA | ALA |
| Catalytic Ser70 | A / 70 / blank | 45 | SER | SER |
| Met/Thr182 | A / 182 / blank | 157 | MET | THR |

The source _pdbx_poly_seq_scheme supplies every correspondence, independently of array positions.
Both files have 263 deposited and modeled polymer residues, author numbers 26–290, excluding 239 and 253.
Those are numbering gaps, not missing coordinate residues. No REMARK 465/470 missing residues/atoms are listed.
The runtime matching key is chain + author number + insertion code, without residue name so MET/THR can match.
All three deposited sequence differences are explicitly allowlisted and tested.

1JWP SEQADV records THR A 182 versus UniProt P62593 MET 180 as ENGINEERED MUTATION.
DBREF starts at PDB 26 / UniProt 24; these are not interchangeable with mmCIF label indices.
1BTL has four alternate ATOM records across Ser82/Ser285; the parser discards two duplicate atom slots.
1JWP has no alternate locations. All teaching markers are unambiguous and fully represented.
Rendered atom counts after exclusions: WT 2030, M182T 2026.

## G. Alignment

Existing fitRigid: Horn (1987) unit-quaternion rigid least-squares fit, equivalent to a proper-rotation
least-squares superposition. Maps all common chain-A Cα atoms from 1JWP onto 1BTL.
No reflection, scaling, coordinate interpolation or mutation trajectory.
All matched coordinates and the final RMSD are checked for finiteness. Missing Cα pairs are explicitly omitted;
for these assets none are missing. Correspondence does not depend on mutant residue-array ordering.
The transformed model is a copy; original deposited coordinates remain intact.

## H. Calculated Cα RMSD

- Common pairs: **263**
- RMSD: **0.5248679777370812 Å** (UI: **0.525 Å**)
- Rotation determinant: **1.0000000000000022**
- Maximum Cα deviation: **1.0497309559790304 Å**
- Unmatched residues: **0 / 0**

Reproduce with node scripts/mutation-audit.mjs; output: artifacts/mutation-audit.json.
No prompt-provided RMSD was hardcoded.

## I. Met182 / Thr182 rendering

MutationViewer uses one ProteinScene, renderer, camera and OrbitControls instance throughout the exploration.
ProteinComparison is an optional geometry/label helper within that scene, not a new renderer.
Geometry is built once; subsequent changes toggle cached groups.
Initial WT ribbon + Met182 sticks/balls; after application aligned mutant ribbon + solid Thr182 highlight
and translucent neutral-gray WT Met182 ghost. Both have DOM labels.
Whole WT overlay appears only when the separate overlay control is selected.
Ser70 is a smaller functional-site marker. Chemical identity is also described in regular DOM text.
The 420 ms focus tween moves only the camera, preserves direction, can be interrupted by user input,
and becomes immediate under prefers-reduced-motion. Reset/overlay/result clicks preserve camera state.
Cleanup disposes geometry/materials, labels, observer, controls, listeners, animation frame and renderer.

## J. Experimental source and values

Jacquier et al. (2013), Capturing the mutational landscape of the beta-lactamase TEM-1,
PNAS, DOI: 10.1073/pnas.1215206110.
Primary Table 2: https://pmc.ncbi.nlm.nih.gov/articles/PMC3740883/#t02
Verified directly against the original table on 2026-09-29.

| Genotype | Amoxicillin MIC (mg/L) | Vi/[E₀] at 37°C (s⁻¹) | Tm (°C), displayed |
|---|---:|---:|---:|
| WT | 500 | 142 ± 2 | 49.5 |
| M182T | 500 | 145 ± 15 | 57 |
| A36D | 12.5 | 0.14 ± 0.01 | not displayed in this case |

The ± notation is retained; its statistic is not relabeled without an explicit table definition.
Vi/[E₀] is not called kcat. MIC is explained as a bacterial-level experimental readout.
Tm rise is computed as 57 − 49.5 = 7.5°C.
A36D Tm is present in the original table, but is outside this requested case's two-readout comparison.
No claim of complete functional identity or evolutionary neutrality is made.

## K. A36D case

Same workspace, new case state. Only WT 1BTL Ala36 and Ser70 are drawn; no A36D structure is modeled.
An explicit visible note identifies the display as a WT location marker, not an experimental A36D structure.
Results remain hidden until the A36D reveal button is pressed.
No active-site distance is displayed, so no arbitrary reference point or unverified distance is introduced.
The conclusion rejects the rule that noncatalytic positions necessarily have small effects.
Final CTA switches internally to the existing HbS Lab, whose source and scientific content are unchanged.

## L. Files

Added:
- src/modules/MutationToleranceLab.tsx, src/modules/mutationState.ts
- src/components/MutationViewer.tsx
- src/protein/mutationTolerance.ts, src/protein/mutationAssets.ts
- src/rendering/proteinComparison.ts
- src/data/structures/1BTL.pdb, src/data/structures/1JWP.pdb
- tests/mutationTolerance.test.ts, tests/fixtures/tem1-rcsb-metadata.json
- scripts/mutation-audit.mjs, scripts/mutation-source-audit.mjs, scripts/mutation-browser-test.mjs
- MUTATION_TOLERANCE_VALIDATION.md

Updated:
- src/main.tsx (lazy module, navigation and existing footer asset list)
- src/rendering/ProteinScene.ts (opt-in cached comparisons, focus, pan and resize preservation)
- src/styles.css (scoped module styles only)
- package.json (test:browser includes the new module; test:mutation convenience script)
- Existing nine browser scripts: explicit ten-module navigation expectations where applicable,
  configurable PROTEIN_PREVIEW_ORIGIN; Peptide and hemoglobin screenshot helpers center the canvas
  before capture to avoid fractional top-edge clipping after navigation wraps. No assertion was removed.
- README.md and SCIENTIFIC_NOTES.md (module documentation).

## M. Added tests

30 Vitest tests cover asset hashes/provenance, complete auth/label mapping, marker identity, sequence discrepancies,
alternates, Cα matching with permuted/missing residues, finite transform, determinant +1, reflection rejection,
distance preservation, computed RMSD, NaN rejection, all reducer transitions, camera-command retention and scientific wording.

The new Chromium script covers 16 scenario groups: lazy load/navigation; hidden/disabled initial results;
desktop proportions; keyboard prediction/apply; focus; overlay and exit; rotation/zoom/pan; reset/reapply;
measurements/conclusions; A36 WT-only rendering; internal HbS handoff; reduced motion; 1024/768/390/320 layouts;
mobile progression; stale load/unmount; repeated cleanup; no external network/browser exceptions.
Screenshots and machine-readable reports are generated under artifacts/.

## N. npm test

Final source-only result: **13 files / 358 tests passed** (328 existing + 30 new).
A temporary HEAD comparison copy was removed after browser diagnostics so it is not part of test discovery.

## O. npm run typecheck

Passed. No new dependency, tsconfig relaxation or type suppression.

## P. npm run build

Passed. Both new PDB files are separate hashed static assets; module is lazy-loaded.
The pre-existing Three.js chunk warning remains (518.44 kB uncompressed); no build error.
No lint script exists.

## Q. Browser review

Preview: http://127.0.0.1:4175/protein-3d-explorer/
Use the Chapter 3 Mutation Tolerance navigation button.

Suggested review:
1. Check the filled apply CTA and initial WT structure with hidden results.
2. Apply M182T; inspect the Met ghost / Thr highlight; drag, zoom, pan and toggle whole overlay.
3. Reset to WT and reapply; the manipulated viewpoint should persist.
4. Reveal measurements and read the conditional conclusion and sequence-difference note.
5. Enter A36D, observe the WT-only note, reveal results, follow the internal HbS CTA.
6. At narrow widths, check the cause → viewer → results order and visible CTA text.
7. With reduced motion enabled, focus should change immediately.

Automated full browser suite: **npm run test:browser passed (all 10 scripts)** on the final production build, using PROTEIN_PREVIEW_ORIGIN=http://127.0.0.1:4175. This includes all nine existing module suites and all 16 new Mutation Tolerance scenario groups. Log: artifacts/mutation-full-browser-final.txt. New-module report: artifacts/mutation-browser-results.json (errors: []).

## R. Remaining scientific / technical limitations

- The supplied PDB pair differs at 84 and 184 as well as 182. This is the most important scientific limitation;
  neither local shifts nor the RMSD isolate M182T's causal structural effect.
- Independent crystal conditions and static coordinates cannot capture all solution dynamics or functional behavior.
- Activity/MIC conclusions are conditional on the cited assays; they do not establish evolutionary neutrality.
- A36D has no mutant experimental structure in this module; only the WT position is used.
- Cartoon paths and display radii are visualization choices, not physical atom trajectories or molecular surfaces.
- First-load offline operation is not promised: the repository has no service worker/precache. Once served locally,
  all module structure/data requests stay at the same origin; external sources are user-clicked citations only.
- Browser checks use headless Chromium with software WebGL. Physical touch devices and other browser engines
  have not been independently tested for this new module.
