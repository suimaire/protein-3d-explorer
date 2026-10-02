# Protein additions — scientific and UI validation

Completed 2026-10-03 (Asia/Seoul). Local repository: `D:\Codex\260831 biochemistry\protein-3d-explorer`.

## Scope and entry points

| Addition | Entry | Implementation |
|---|---|---|
| A | Hydrophobic Core → “서열과 공간에서 비교하기” below the original viewer | Collapsed initially; mapped sequence, A/B selection, exact minimum heavy-atom pair and distance, three computed examples, explicit pair focus |
| B | Chapter 2, after Hydrophobic Core and before Soluble vs Membrane | New “이황화 결합과 변성 / Disulfide Bonds & Denaturation”; native RNase structure plus separate condition comparison |
| C | Soluble vs Membrane → “아쿠아포린의 물 통로” internal tab | Four-stage AQP1 tetramer/monomer/cutaway/selectivity exploration; original surface comparison remains default |

Only B adds a top-level learning menu item (ten existing modules → eleven). Original module order, default Peptide Geometry, header/portal/brand/footer/page-view hook, chemistry colors, Pages base, deployment settings and dependencies are preserved. This report records the implementation validation before publication. The subsequent user request on 2026-10-03 authorized committing, pushing to main and deploying through the existing GitHub Pages workflow.

## Baseline and change boundaries

- Initial working tree was clean. Read README, current status, scientific notes and original validation/code before edits.
- Baseline typecheck, 395 tests / 14 files and production build passed.
- Baseline Core (18 checks) and Membrane (16 checks) browser suites passed and were captured **before implementation**. Their logs and screenshots are in `artifacts/protein-additions/baseline/`.
- The full ten-module suite was run after implementation; it is not presented as a pre-change full-suite baseline.
- No dependencies or deployment configuration changed. Original PDB parser, SASA, OmpX classification, ribbon generation and existing camera/picking defaults were not rewritten.
- `ProteinScene` gained optional annotation/side-chain/focus features. Without those options it follows the original paths; original browser suites exercise them.
- Existing browser assertions changed only to include the requested new B menu item and count 11. No existing scientific, geometry, layout or interaction expectations were relaxed.

## A — sequence and spatial separation

Source: existing unchanged [RCSB 1UBQ](https://www.rcsb.org/structure/1UBQ), human ubiquitin, chain A, 76 modeled residues. The existing SASA and coordinate/alternate-location policy is retained.

`sequencePositions` matches modeled residue names to the chain's SEQRES as an **unambiguous order-preserving subsequence**. It keeps missing sequence positions, distinguishes chain/author number/insertion code/internal index, and fails rather than guesses when repeated sequences permit ambiguous mapping. Tests include inserted author numbers, missing residues, nonmatching internal indices, ambiguity and different chains.

Minimum distance searches all actual selected non-H/non-D atom pairs. The displayed endpoint IDs and the 3D dotted guide refer to that same minimum pair. The measurement is invariant under rigid rotation/translation. Same-residue comparison is disallowed; no cross-chain sequence difference is invented.

Example criteria remain same chain, sequence gap ≥10, minimum heavy-atom distance ≤4.5 Å. Full occupancy is additionally required; stable ordering prefers larger sequence gaps then smaller distances, and endpoints of different examples must be at least three sequence positions apart. This makes examples distinct; thresholds are educational selection criteria, not bond criteria.

| Selected pair (chain A) | Sequence gap | Minimum atom pair | Distance (Å) |
|---|---:|---|---:|
| Val5–Leu69 | 64 | CG1–CB | 3.637787376964191 |
| Gln2–Ser65 | 63 | O–N | 4.403169540228946 |
| Val17–Leu56 | 39 | CG2–CD1 | 3.470897434382064 |

Existing single selection is A; the new comparison is B. Sequence clicks and 3D clicks use the explicit A/B target; the original dropdown remains A. Buttons/sequence use text and borders in addition to color. Choosing a pair does not reset the camera; “두 잔기 함께 보기” explicitly fits it. Reset clears both selections and closes the addition. The original canvas height is unchanged.

The text states that this analyzes an already folded structure, predicts neither folding nor hydrogen bonding, and draws a measurement guide, never a “hydrophobic covalent bond.”

Reproducible full mapping/endpoints: `scripts/sequence-space-audit.mjs` → `artifacts/protein-additions/sequence-space-audit.json`.

## B — RNase A source, chemistry and condition evidence

### Source provenance and mapping

- [RCSB 7RSA](https://www.rcsb.org/structure/7RSA); [original PDB download](https://files.rcsb.org/download/7RSA.pdb).
- Bos taurus; X-ray diffraction, 1.26 Å. Entry version 2.1, 2024-05-22; acquired 2026-10-03 Asia/Seoul.
- Original file `src/data/structures/7RSA.pdb`, 211,491 bytes. SHA-256:
  `d8d8a22d3260fb1c72a805d9f8a6affcc496ec65c8aadcb4d7ea8dccf6c63b5f`.
- Biological assembly 1: monomer, chain A, identity rotation and zero translation. Modeled author residues 1–124, matching all 124 SEQRES residues, blank insertion codes; internal indices 0–123 are stored separately.
- Header reports no missing residues or missing atoms. Each required Cys is explicitly resolved by chain + author number + insertion code + residue identity, and exactly one SG must exist. All eight required Cys have unambiguous SG.
- Retained protein: 951 non-H atoms. Omitted 188 water records and 15 TBU records (three tert-butanol molecules).
- New opt-in `parseCoherentPdb` chooses the conformer with greatest mean non-H occupancy **per residue**, with lexical A-first ties; blank/common atoms are retained. It verifies that no resulting residue mixes nonblank alternate IDs. Original parser defaults elsewhere are unchanged.
- Nonblank choices: Gln11 A, Ser32 A, Asn34 B, Val43 B, Ser50 A, Lys61 A, Asn67 A, Ser77 A, Asp83 A, Arg85 A, Lys91 A, Lys98 A, Lys104 A.
- Filtering discards 140 alternate ATOM records (including their alternate hydrogens); the subsequent parser discards 909 remaining H/D records. These are sequential pipeline counts, not a claim that the original file contains only 909 hydrogen records.
- Original PDB and inspected mmCIF have **no SSBOND / disulf struct_conn annotation**. The implementation does not fabricate one. Four literature-established connections are mapped and checked against SG geometry; there is no new automatic disulfide detector.

| Literature native pair | Selected SG atom indices | Coordinate SG–SG distance (Å) |
|---|---|---:|
| Cys26–Cys84 | 193, 641 | 2.000463196362281 |
| Cys40–Cys95 | 309, 726 | 2.012962741831056 |
| Cys58–Cys110 | 445, 841 | 1.9782479622130322 |
| Cys65–Cys72 | 495, 546 | 1.9705402812426853 |

Pair source: [Klink et al. (2000)](https://doi.org/10.1046/j.1432-1327.2000.01037.x). Atom indices above are implementation identifiers after filtering; UI identifiers use chain/author residue/atom names. The expected 1.8–2.3 Å guard only validates these four known links.

### Evidence levels and condition order

Primary sources: [Anfinsen et al., PNAS (1961)](https://doi.org/10.1073/pnas.47.9.1309), especially reduced-chain reoxidation methods, and [Anfinsen, Nobel lecture (1972)](https://www.nobelprize.org/uploads/2018/06/anfinsen-lecture.pdf), pp. 56–57 / Fig. 2. The original full-text lecture was downloaded and read; the source PDF/extraction is ignored under artifacts.

| State | What is displayed | Condition meaning |
|---|---|---|
| Native | Experimental 7RSA atoms/ribbon | Native reference |
| Denaturant + reducing agent | **SCHEMATIC**, unitless residue chain | Urea changes folding conditions; mercaptoethanol reduces S–S |
| Reoxidation in refolding conditions | **7RSA reference coordinates reused** | Removal of denaturant/reductant permits refolding/reoxidation under suitable conditions |
| Oxidation while denatured, then urea removal | **SCHEMATIC**, arbitrary nonnative topology | Oxidation in denaturing conditions can trap nonnative pairings |
| Disulfide exchange after urea removal | **7RSA reference coordinates reused** | A small thiol reagent can permit rearrangement; wrong connections need not be permanent |

This is a qualitative synthesis of multiple classic experiments, not a reproduction of one complete experimental procedure. It does not imply that folding and oxidation are obligatorily nonoverlapping steps.

Both schematic states preserve the exact residue order and 123 peptide edges. Scrambled links are explicitly arbitrary educational examples (26–40, 58–65, 72–84, 95–110), drawn as dashed curved topology guides, not long atomic bonds. No atom interpolation, Å measurements, activity percentages, energy, measured time or physical rate are used in these schematic states. The shape is one illustrative layout, not a unique denatured structure.

Display visibility is a separate reducer action and never changes treatment or connectivity. All five states explicitly identify sequence, peptide links, disulfide connectivity, shape and evidence level. Recovery views disclose reuse of the same native reference, not a newly measured post-treatment structure. The UI rejects generalization to unconditional refolding of all proteins.

Audit: `scripts/rnase-audit.mjs` → `artifacts/protein-additions/rnase-audit.json`, including complete mapping, alternate choices and exact distances.

## C — bovine AQP1, assembly, membrane and pore

### Original source and assembly

- [RCSB 1J4N](https://www.rcsb.org/structure/1J4N); [original PDB download](https://files.rcsb.org/download/1J4N.pdb).
- Bos taurus, AQP1; X-ray diffraction, 2.2 Å. Entry version 1.4, 2023-12-27; acquired 2026-10-03 Asia/Seoul.
- Original file `src/data/structures/1J4N.pdb`, 206,712 bytes. SHA-256:
  `4f02d3e91ddb9ac41f102846d9093f31f690b2c1f91caf1e627aea9d7da7ef40`.
- Asymmetric unit contains protein chain A, **one** subunit. Author-assigned biological assembly **1** is a tetramer. It is built from REMARK 350 BIOMT operators, not by relabeling the asymmetric unit as a tetramer.
- Alternative assembly 2 is a software-assigned octamer; excluded in favor of the author tetramer and the four independent water pores described by [Sui et al., Nature (2001)](https://doi.org/10.1038/414872a).
- Each source monomer: 249 modeled residues, author 1–249, blank insertion codes, 1,852 protein heavy atoms, no alternate conformers or hydrogens. SEQRES contains 271 residues; missing terminal 250–271 are not invented. Original ligands: three BNG (63 atom records) omitted.
- Intact tetramer: 996 residue instances and 7,408 heavy atoms. Each pick key includes structure, assembly, operator, source chain, author residue and insertion code. Original chain A remains A; operator copies are UI “소단위 1–4,” not deposited chains B/C/D.

For column vectors, each original point p is transformed as `p' = R p + t`:

| Operator | R (rows) | t (Å) |
|---|---|---|
| 1 | (1,0,0); (0,1,0); (0,0,1) | (0,0,0) |
| 2 | (−1,0,0); (0,−1,0); (0,0,1) | (93.331,93.331,0) |
| 3 | (0,−1,0); (1,0,0); (0,0,1) | (93.331,0,0) |
| 4 | (0,1,0); (−1,0,0); (0,0,1) | (0,93.331,0) |

All determinants are +1. All four transformed Cα centers match distinct OPM subunits to <0.01 Å (OPM A/D/C/B respectively), independently checking assembly placement.

### Membrane orientation

Independent [OPM 1j4n coordinate file](https://opm-assets.storage.googleapis.com/pdb/1j4n.pdb), acquired 2026-10-03. SHA-256:
`b3e38a3194b932b38431caaafa8f64b5400826ae4b97f423b6e755ede1f847c3`.

OPM's hydrophobic half-thickness is **15.9 Å**, confirmed by its boundary dummy atoms. It is not OmpX's 11.8 Å value. Proper rigid fit from original to OPM chain A uses 996 matched N/CA/C/O coordinates: RMSD **0.002856601678964 Å**, maximum deviation **0.006464826592 Å**.

The full coefficients are in `src/protein/aqp1Orientation.ts`. Coordinate checks use the independent reduced OPM fixture `tests/fixtures/1j4n-opm-backbone.json`; the full OPM download stays ignored. Every protein atom, water and path point uses exactly `OPM(BIOMT(p))`, then the same display rotation (x,z,−y). Deposited coordinates remain unchanged. Boundary planes are position guides, not lipid molecules.

### Motifs and original water

Full-text primary paper checked at the [author manuscript](https://escholarship.org/content/qt5t69x9xs/qt5t69x9xs.pdf), particularly the pore/selectivity discussion and water interactions.

- Bovine NPA motifs: **Asn78–Pro79–Ala80**, **Asn194–Pro195–Ala196**.
- ar/R region: **Phe58, His182, Cys191, Arg197**. Cys191's **backbone carbonyl oxygen**, not its sulfur, is emphasized in the explanation.
- Two NPA Asn side chains face the central portion of a monomer's pore. The path contains hydrophobic regions plus localized polar sites; it is not uniformly hydrophilic.
- Water selection involves size and chemistry/electrostatic/orientation considerations. The app computes no electrostatic potential or proton/ion transport, and does not extend AQP1 specificity to all aquaporins.
- Original file has 114 water oxygens. Only literature pore waters HOH A301–A304 are displayed, duplicated by the correct operators. Blue spheres mean experimental oxygen positions; magenta diamond glyphs mean illustrative particles. Both display sizes are symbolic.

Measured N/O neighbors within 3.5 Å (distance check, **not a new hydrogen-bond classifier**):

| Original water | Protein atom | Distance (Å) |
|---|---|---:|
| 301 | His182 NE2 | 3.105284045 |
| 301 | Gly192 O | 2.696812007 |
| 302 | Asn194 ND2 | 3.067327664 |
| 303 | Asn78 ND2 | 3.296882922 |
| 303 | Asn194 ND2 | 3.311342024 |
| 304 | Ala75 O | 2.911264158 |
| 304 | His76 O | 2.767811229 |

### Illustrative path and particle validation

`src/data/aqp1-channel.json` stores 107 original-coordinate waypoints. Offline preparation starts around those four original waters, searches a 0.4 Å transverse grid within ±5 Å, samples axial levels every 0.5 Å, limits consecutive transverse motion and favors clearance with continuity. It is not HOLE, MD or a physical permeation trajectory.

Rendering uses piecewise **linear** interpolation between adjacent validated points (no spline overshoot), and the same assembly/OPM transform as the protein. All four whole paths were sampled at 2,121 points each against **all 7,408 intact-tetramer protein vdW spheres**:

- Minimum point-to-vdW-surface clearance: **0.968600811701229 Å**.
- Maximum distance between consecutive test points: **0.051234753829811 Å**.
- Distance-to-surface is 1-Lipschitz; even subtracting the whole maximum interval yields continuous clearance **≥0.917366057871418 Å**.
- The illustrative octahedron's enclosing radius is **0.35 Å**, safely below that conservative bound. This verifies the entire rendered glyph, not only its center.
- Minimum radial distance from the tetramer center axis: **15.220413094543456 Å**; it never traverses the central tetramer space.
- Each path passes within 1.5 Å of each of its four transformed deposited pore waters.

The displayed trajectory is a constrained, explanatory route through known pore space; neither these bounds nor the glyph size is a physical water radius or a quantitative pore-radius result.

Animation is initially paused. Explicit play/stop and manual step work; glyphs alternate direction and retrace, without implying a unidirectional pump or net flux. `prefers-reduced-motion` disables continuous play and preserves manual steps. Offscreen/document-hidden scenes suspend their frame requests; unmount cancels them. No time/speed/permeability units are shown.

### Pore versus exterior classification

Computed once on the **intact tetramer**, never rerun during rotate/select:

- Pore candidate: any residue heavy-atom center within 4.5 Å of the explanatory path portion inside OPM z=±14 Å.
- Exterior lipid candidate: not a pore candidate; side-chain center inside z=±15.9 Å; intact-tetramer relative SASA ≥0.25; side-chain vector points outward relative to the tetramer axis; all side-chain atom centers >6 Å from the same core path.
- Gly's Cα is the documented fallback where there is no non-H side-chain atom.
- Each monomer yields **23 pore candidates and 26 exterior candidates**; remaining residues stay unclassified.
- This is a conservative educational geometric selection, not exhaustive experimentally proven lipid contacts. Polar exterior exceptions are allowed. “Chemical properties” retains the existing side-chain grouping and gray backbone; it is not an electrostatic potential map.

All criteria, complete instance mapping, water contacts and clearance results: `scripts/aquaporin-audit.mjs` → `artifacts/protein-additions/aquaporin-audit.json`.

## Lifecycle and performance responsibilities

- B's module and 7RSA load on B entry; C's module and 1J4N load only on the aquaporin internal tab. Original tab is initially selected.
- Source loaders own one shared in-flight fetch and a successful cache. They clear a rejected promise for retry. Consumers use an active flag and ignore late resolutions after unmount; the shared request may finish for the cache. Browser tests delay each asset and navigate away before release.
- SASA/structure analysis is cached per source load, not recomputed by scene rotation/selection.
- Each viewer effect owns its scene; cleanup disposes geometry/materials, labels, controls, renderer, ResizeObserver, IntersectionObserver, media/document/pointer/key listeners and frame requests.
- Scene geometry is rebuilt only for view changes; animation moves existing glyph meshes. An unmounted previously playing scene was directly checked through a retained DOM handle: no further frame count increase and no canvas.
- No new visualization engine, service or runtime external PDB request. Both original new PDB assets are stored locally; the existing `.gitattributes` keeps PDB bytes unchanged across checkout.

## Actual validation results

| Check | Result |
|---|---|
| Baseline typecheck / unit / build | Passed; 395 tests / 14 files |
| A relevant tests + browser before B | Passed; new sequence tests and original Core behavior |
| B relevant tests + browser before C | Passed; 20 A+B unit tests and 11 B browser checks |
| C unit + browser | 12 C unit tests and 14 browser checks passed |
| Final `npm run typecheck` / production build | Passed |
| Final `npm test` | **427 / 427**, 17 files |
| `npm run test:browser` | **All 10 original browser scripts passed** |
| New A / B / C browser scripts | **11 + 11 + 14 checks passed** |
| Additional input/lifecycle browser script | **4 checks passed**, including delayed source responses |
| `npm run test:mutation:explanations` | Passed, 12 browser checks plus source audit; shared annotations/focus regression |

The first full old-suite attempt stopped at Mutation Tolerance's obsolete count of 10. Only that navigation expectation was corrected to 11; the final full-suite rerun passed. Early new-test failures were test fixture field names, fixed-coordinate click sampling and insufficient wait/viewport setup for browser events; these were corrected without reducing the required behavioral assertions (including all four actual picked subunits). No known final failure is suppressed.

Desktop 1440, tablet 1024, 768 and mobile 390 px were checked for all additions. Expanded A preserves its original canvas height; B and C retain large canvases. No page-wide horizontal overflow. Screenshot review covered desktop and mobile sequence, native disulfide, schematic, tetramer, selectivity and cutaway views. Keyboard focus/arrows/Enter/zoom and real Chromium touch-event emulation were exercised; dragging does not become a residue click. Repeated module/tab transitions leave the expected canvas count.

All new browser reports have zero page/console errors and zero failed HTTP asset responses. Original suites also passed their existing console/runtime checks.

**Limits:** Chromium/SwiftShader automation and screenshots are verified here. Physical iPad/iPhone Safari, Firefox and GPU-specific behavior were not tested. Long-session heap profiling and real molecular dynamics are outside this verification. The pre-existing Three.js >500 kB chunk advisory remains; build succeeds. No live-site publication or production traffic verification is claimed.

## Reproduce and artifacts

Use the actual repository first in PowerShell:

```powershell
Set-Location -LiteralPath 'D:\Codex\260831 biochemistry\protein-3d-explorer'
npm run typecheck
npm test
npm run build
npm run preview -- --port 4186 --strictPort
```

In a second terminal, also Set-Location to the repository, then:

```powershell
Set-Location -LiteralPath 'D:\Codex\260831 biochemistry\protein-3d-explorer'
$env:PROTEIN_PREVIEW_ORIGIN='http://127.0.0.1:4186'
npm run test:browser
npm run test:browser:additions
npm run test:mutation:explanations
npm run test:additions:audit
```

4186 was used because 4173 was already occupied; no existing process was stopped. The browser utilities otherwise default to the repository's usual 4173. The new audit runner uses Vite's source loader, not a separate scientific implementation.

Optional path/orientation regeneration: download the cited OPM source to an ignored local file, verify its SHA-256, then run `node scripts/aqp-path-prepare.mjs <local-opm-file>`. The preparer checks its pinned hash before writing derived files. Running the app/tests does not require that download.

Ignored artifacts directory: `artifacts/protein-additions/`.

- Baseline: `baseline/` with Core/Membrane screenshots and logs.
- A: `a-desktop.png`, `a-1440.png`, `a-1024.png`, `a-768.png`, `a-390.png`.
- B: `b-native-bond.png`, `b-scrambled.png`, `b-{1440,1024,768,390}.png`.
- C: `c-tetramer.png`, `c-section.png`, `c-selectivity.png`, `c-{1440,1024,768,390}.png`.
- Results: `a-browser-results.json`, `b-browser-results.json`, `c-browser-results.json`, `inputs-lifecycle-browser-results.json`.
- Source metadata / coordinate audit: `structure-sources.json`, `sequence-space-audit.json`, `rnase-audit.json`, `aquaporin-audit.json`, `aqp-path-preaudit.json`.
- Logs: `full-unit.log`, `final-build.log`, `original-browser-suite-final.log`, `additions-browser-suite-final.log`, `mutation-explanations-final.log`.

## Main file changes and reasons

| Files | Purpose |
|---|---|
| `HydrophobicCoreLab.tsx`, `SequenceSpaceExplorer.tsx`, `SequenceStrip.tsx`, `sequenceSpace.ts` | Optional A UI, accessible sequence and actual mapped measurements |
| `DisulfideLab.tsx`, `rnase.ts`, `rnaseAssets.ts`, `RnaseTopologyViewer.tsx`, `coherentPdb.ts` | B's real/native model, independent condition state, unitless topology, coherent conformers |
| `SolubleMembraneLab.tsx`, `AquaporinLab.tsx`, `AquaporinViewer.tsx`, `aquaporin.ts`, `aquaporinAssets.ts` | Default-preserving C internal tab, assembly, unique picking, classification and animation |
| `aqp1Orientation.ts`, `aqp1-channel.json`, local PDB files and reduced OPM fixture | Traceable source/derived geometry with independent numeric tests |
| `ProteinAnnotations.ts`, optional `ProteinScene` / `ProteinViewer` additions | Shared opt-in measured guides and explicit focus |
| `ExplorationScene.ts` | New-only rotatable scenes with owned cleanup and reduced-motion lifecycle |
| `main.tsx`, scoped appended CSS | Only B's navigation entry; consistent local layout additions |
| Three unit test files, audit/browser scripts, package script aliases | Repeatable science, UI and regression checks |
| Plan, this validation, README, scientific notes, current status | Entry points, evidence, limits and actual results |
