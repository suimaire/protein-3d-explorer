# Protein 3D Explorer — Current Status

## Completed

- Phase 1 implementation: Vite + React + strict TypeScript + Three.js; Peptide Geometry Lab only.
- Pure geometry and sterics code, renderer, UI, schematic plot, teaching text separated.
- Ac–L-Ala₅–NHMe with central Ala 3 φ/ψ manipulation, measured-angle plot synchronization,
  trans peptide planes, representation toggles, clash pairs, presets, camera/reset controls.
- Korean teaching UI, mobile stacking, native keyboard sliders, keyboard camera, explicit schematic caveats.
- README and scientific documentation; no next module, worksheet, login, deployment, or remote.
- Phase 1.1 steric-clash validation completed. The former α-like count of 6 was traced to six
  fixed O(i)–Cα(i+1) 1–4 pairs and corrected with a three-bond topology exclusion.
- UI now reports `심한 비결합 겹침`; detailed pair audit is in `STERIC_CLASH_VALIDATION.md`.

## Scientific validation

- Existing α-like 6: all six were 1–4 O–Cα pairs at 2.773 Å with 0.447 Å nominal overlap;
  four internal and two at cap boundaries. Meaningful nonbonded clashes: 0; topology artifacts: 6.
- Final policy: exclude 1–2/1–3/1–4; retain contacts four or more bonds apart; keep cap atoms in
  nonlocal checks; use C 1.70/N 1.55/O 1.52 Å and polar amide H 1.00 Å; report overlap >0.40 Å.
- α-like −60/−45: 0; β-like −135/+135: 0; Extended −180/+180: 0.
- Deliberately unfavorable comparisons: 0/0: 8, +60/0: 3, −180/0: 1 severe nonbonded overlaps.
- This remains a partial-atom educational geometric indicator, not MolProbity, a force field,
  molecular dynamics, or a Ramachandran allowed/forbidden classifier.

## Verified

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

- Ideal bond geometry; all ω=180°. Only Ala 3 φ/ψ varies; other residues −135°/+135°.
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
- Real iOS/Android touch hardware and Safari/Firefox were not tested. Mobile checks use Chromium
  viewport emulation; pinch is supplied by Three.js OrbitControls, not independently device-tested.
- WebGL is required; unsupported contexts show a readable fallback. Extremely zoomed/overlapping
  conformations can be clearer with Atom labels disabled. Scientific limitations above are intentional.
- Carbon-bound H is absent, so the detector cannot serve as a complete all-atom clashscore.

## Next recommended module

- Phase 2A — α-Helix Lab, only after Phase 1.1 acceptance.
- β-Sheet after α-Helix.

## Project rule

- Update this file at the end of every development session. Update SCIENTIFIC_NOTES.md and
  geometry tests whenever scientific assumptions change. Show only completed modules to students.
- Local work only for this session; do not push, create GitHub repositories, or deploy.
