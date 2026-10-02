# Protein learning additions — 2026-10-02 (Asia/Seoul)

## Scope and preservation
Implement A → B → C in the existing React/Three.js app. Preserve three chapters, the ten existing modules and their relative order/titles, default Peptide Geometry entry, header/portal/brand/footer/page views, existing calculations and controls, lazy loading, Pages base and deployment. Initial git status was clean. No reset, clean, stash, pull, rebase, commit, push or deployment.

## Plan
1. Read current models/renderers/scientific validation, run baseline tests, capture existing views under ignored artifacts/protein-additions/baseline.
2. A: collapsed sequence–space exploration below the original canvas. Chain-aware mapping, coherent A/B selection, minimum heavy-atom measurement with labels and explicit focus; deterministic nonredundant examples. Preserve SASA/filter/clipping. Verify unit/browser tests before B.
3. B: only new chapter menu entry, between core and membrane. Validate local 7RSA, residue-coherent alternate conformers and four literature-established S–S pairs (the current 7RSA asset has no SSBOND annotation; verify SG coordinates explicitly). Experimental ribbon plus separate rotatable, explicitly schematic condition states; display/treatment independence; primary-literature verification. Verify before C.
4. C: lazy internal aquaporin tab; original comparison remains default. Validate local bovine 1J4N assembly/operators, motifs, membrane frame and per-subunit channels. Camera/selection/section, original waters and paused bidirectional illustrative particles. Validate clearance/transforms/cleanup.
5. Complete typecheck/unit/build/existing and new browser tests; QA at 1440/1024/768/390 px and all ten original modules; inspect screenshots/final diff. Record hashes, source and coordinate audits, limits, baseline/new failures and actual results. Update SCIENTIFIC_NOTES and CURRENT_STATUS.

## Constraints
No new engine, backend, redesign, unrelated modules, invented measurements or weakened scientific expectations. Renderer changes opt in. Reuse styles/controls; visibly distinguish experimental coordinates, educational topology and illustrative paths.

## Baseline
Typecheck passed; 395/395 unit tests passed; production build passed (existing Three.js chunk advisory). Port 4173 occupied; isolated preview uses 4186.

## Completion
All three additions were implemented in order, with relevant checks before the next stage. Final typecheck/build, 427 unit tests, all ten original browser scripts, 40 new browser checks and 12 mutation-explanation checks passed. See [scientific and UI validation](PROTEIN_ADDITIONS_VALIDATION.md) for the actual results and limitations. No commit, push or deployment.

## Publication follow-up (2026-10-03)
After implementation acceptance, the user requested push and deployment. That follow-up authorizes committing these verified changes to main and using the existing GitHub Pages workflow. The no-publication statements above describe the original implementation scope.
