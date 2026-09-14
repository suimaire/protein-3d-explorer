# Phase 3A — Hydrophobic Core validation

Validated 2026-09-15. Initial main / HEAD / origin/main: `8b81c88`, clean working tree, 0/0 ahead/behind.
Only `protein-3d-explorer` modified. Reproduce the audit with `node scripts/core-audit.mjs`
(writes `artifacts/core-audit.json`).

# Structure

| Item | Value | Verified from |
|---|---|---|
| PDB ID | 1UBQ | RCSB file header / Data API `core/entry/1UBQ` |
| Protein | Ubiquitin, *Homo sapiens* | `COMPND`, `SOURCE` |
| Method | X-ray diffraction | `EXPDTA`; API `exptl.method` |
| Resolution | 1.8 Å | API `refine.ls_d_res_high` = 1.8, `resolution_combined` = [1.8]; file `TITLE` |
| R (obs) | 0.176 | API `refine.ls_R_factor_obs` (documentation only, not in UI) |
| Citation | Vijay-Kumar, Bugg & Cook (1987) *J. Mol. Biol.* 194:531–544, doi:10.1016/0022-2836(87)90679-6 | `JRNL` |
| Chain | A (only polymer chain; 1 assembly, monomer) | API `rcsb_entry_info` |
| Residues | 76, Met1–Gly76, consecutive; sequence equals `SEQRES` | test |
| Modeled / unmodeled monomers | 76 / 0 | API |
| Heavy atoms used | 602 (C 378, N 105, O 118, S 1) | parser + test |
| Waters | 58 HOH, omitted | parser count = API `deposited_solvent_atom_count` 58 |
| Ligands / other HETATM | 0 | API `nonpolymer_entity_count` 0 |
| Hydrogens | 0 deposited, none added | API `deposited_hydrogen_atom_count` 0 |
| Alternate locations | 0 | column 17 blank for all ATOM records |
| Missing atoms | 0 — every residue has its full heavy-atom set; OXT on Gly76 | test |
| Partial occupancy | Leu73, Arg74 = 0.45; Gly75, Gly76 = 0.25 | test |
| Secondary structure | `HELIX` 23–34 (class 1 α), 56–59 (class 5, 3₁₀); `SHEET` 1–7, 10–17, 40–45, 48–50, 64–72 | deposited records, not recomputed |

The bundled `src/data/structures/1UBQ.pdb` is the unmodified download of
`https://files.rcsb.org/download/1UBQ.pdb` (78 570 bytes,
SHA-256 `d4a6812d8951cf6594e6a0763f089e35f5a80b62acb3c117b2c5565228a7b161`, checked by a test;
`.gitattributes` marks `*.pdb -text` so line endings are not rewritten). Every parsed coordinate is
tested equal to its fixed PDB columns. Waters are skipped at parse time; the file itself is not edited.

# Exposure calculation

## Algorithm

- Shrake & Rupley (1973) numerical SASA, `src/protein/sasa.ts`.
- Probe radius **1.40 Å**; **960** golden-section-spiral test points per atom.
- Bondi (1964) vdW radii: C 1.70, N 1.55, O 1.52, S 1.80 Å (C/N/O identical to the peptide modules).
- Heavy atoms of chain A only (602). No hydrogens, no waters, no crystal symmetry mates.
- A point on the probe-expanded sphere of atom *i* is accessible if it lies outside every other
  expanded sphere; area = 4π(r+1.4)² × accessible fraction. Uniform neighbor grid for speed only.
- Residue SASA = Σ atom SASA. Side-chain SASA = atoms other than N, CA, C, O, OXT (Gly = 0).
- Relative exposure (rSASA) = residue SASA ÷ Tien et al. (2013) theoretical maximum ASA.
  Not clamped internally; the UI prints ≥100%.
- Rank: ascending rSASA, ties broken by residue number. More buried = rank 1–19;
  more exposed = rank 58–76 (round(76 × 0.25) = 19 each).
- Browser computation ≈70–85 ms, once, when the module is first opened.

## Validation

| Test | Result |
|---|---|
| Isolated C/N/O/S atom | exactly 4π(r+1.4)² (10 decimals); probe 0 → 4πr² |
| Two C atoms, d = 7 → 1.5 Å | SASA monotonically decreases (buried area increases); each value within 1% of full-sphere area of the analytic spherical-cap result; ≥ 2(r+p) fully exposed |
| Atom enclosed by 14 neighbors | 0 Å² |
| Determinism | two runs deep-equal; per-atom results independent of atom order (1e−10) |
| No invalid values | all atom SASA finite, ≥0, ≤ full expanded sphere |
| Residue sum | residue SASA = Σ atom SASA; side chain + backbone = total (1e−10) |
| Normalization | 20 maxima present; rSASA ≥0 and finite; only Gly76 (C-terminus) ≥ 1 (139%) |
| Rank | permutation 1…76, monotonic with rSASA; synthetic tie case correct |
| Unknown element | throws instead of silently using a default radius |

**Reference implementation.** `scripts/sasa-reference.py` ran Biopython 1.85
`Bio.PDB.SASA.ShrakeRupley` (independent code, same probe/points/radii; a one-off tool outside
the project dependencies) and saved `tests/fixtures/1ubq-biopython-sasa.json`.
Maximum per-residue difference **0.00005 Å²** (Glu34); total 4872.4614 vs 4872.4617 Å². Test tolerance
0.05 Å² per residue. A Biopython run with 2000 points gave the same buried-group composition.

Not performed: FreeSASA (the pip build failed on this Windows/Python 3.13 environment) and DSSP
(no `mkdssp` binary). The Biopython comparison verifies the implementation, not the choice of radii;
Lee–Richards/ProtOr or DSSP radii would change absolute values somewhat.

# Composition

Observed in this one structure (rSASA rank groups):

| Group | Nonpolar | Polar, uncharged | Acidic | Basic | Total |
|---|---:|---:|---:|---:|---:|
| More buried 25% | **15** | 3 | 0 | 1 | 19 |
| More exposed 25% | 7 (of which Gly 4) | 4 | 5 | 3 | 19 |
| All residues | 34 (Gly 6) | 19 | 11 | 12 | 76 |

- More buried: Ile3, Leu56, Val26, Leu67, **Gln41**, Ile23, Val5, Leu43, Ile30, Val17, Ile61,
  Leu69, Ile13, Leu15, Leu50, Lys27, Ser65, Thr7, Ile44 (rank order).
- More exposed: Lys33, Asp58, Gln62, Glu51, Glu24, Ser20, Lys63, Ala46, Asn60, Leu73, Gly10,
  Glu16, **Leu8**, Asp32, Gly75, Thr9, Gly47, Arg74, Gly76.
- Nonpolar: 79% of the buried group vs 45% of the whole chain vs 37% of the exposed group. Without Gly
  (no side chain), exposed nonpolar is 3 (Ala46, Leu73, Leu8). All 11 acidic residues lie outside the
  buried group. The result agrees with the expected tendency; no calculation, class or protein was
  changed after seeing it.
- Boundary sensitivity: Ile44 (rank 19, 15.1%) vs Tyr59 (15.6%) and Phe45 (15.7%) are nearly tied,
  so a different cut-off shifts individual residues. This is why the UI shows continuous %, and calls
  the groups relative to this protein.

# Manual residue checks

CA coordinates from the file; "centroid rank" = rank of CA distance to the CA centroid (1 = closest).

| Residue | Class | rSASA | SASA / side chain Å² | Rank | CA (Å) | Centroid rank | Check |
|---|---|---:|---:|---:|---|---:|---|
| Ile3 | nonpolar | 0.0% | 0.0 / 0.0 | 1 | 26.235, 30.058, 7.497 | 23 | strongly buried nonpolar; β1 strand; **not** near the centroid |
| Leu56 | nonpolar | 0.0% | 0.0 / 0.0 | 2 | 25.594, 21.109, 13.072 | 26 | buried nonpolar, 3₁₀ helix |
| Val26 | nonpolar | 0.1% | 0.1 / 0.1 | 3 | 33.533, 25.097, 12.978 | 2 | buried nonpolar on the α-helix face |
| Gln41 | polar | 0.2% | 0.4 / 0.0 | 5 | 34.738, 30.875, 21.473 | 12 | **buried polar exception**; NE2 2.97 Å to Ile36 O and 3.04 Å to Lys27 O (distance only) |
| Lys27 | basic | 6.7% | 15.9 / 15.9 | 16 | 35.596, 26.715, 15.736 | 3 | buried basic side chain; NZ 2.90 Å to Asp52 OD2 (distance only) |
| Leu8 | nonpolar | 70.1% | 140.8 / 100.4 | 70 | 29.607, 41.180, 19.467 | 57 | **surface nonpolar exception**; full occupancy loop residue |
| Asp32 | acidic | 70.4% | 136.0 / 104.7 | 71 | 41.718, 30.022, 10.643 | 53 | strongly exposed acidic |
| Glu16 | acidic | 65.9% | 147.0 / 132.0 | 69 | 31.220, 27.341, 4.275 | 44 | strongly exposed acidic |
| Gly76 | nonpolar (Gly) | 139% | 144.8 / 0 | 76 | 40.373, 39.813, 33.944 | 76 | C-terminal, OXT, occupancy 0.25; >100% explained in UI |

Exceptions are selected by `findExceptions` from data, not hard-coded: the most exposed non-Gly
nonpolar residue with full occupancy in the exposed group (Leu8; Leu73 is excluded because its
occupancy is 0.45), and the most buried polar/charged residue whose side-chain SASA is <1 Å² (Gln41).
The UI never says Gln41 "forms" an H-bond; it lists heavy-atom N/O distances ≤3.5 Å and states that
H positions and angles were not evaluated.

**Centroid is not exposure.** The 19 residues whose CA is closest to the centroid share only 11 with
the buried group: Ile3, Thr7, Ile13, Leu15, Val17, Leu56, Ile61, Ser65 are buried but not central;
His68, Arg42, Phe4, Lys29, Phe45, Glu24, Lys6, Thr66 are central but not in the buried group (test).

# Automated and browser verification

- `npm test`: **172 passed = 139 preserved + 33 Hydrophobic Core** (`tests/hydrophobicCore.test.ts`:
  structure 9, SASA synthetic 6, residue exposure 7, classification 3, filters 5, renderer color/mapping 3).
- `npm run typecheck`, `npm run build`: passed. Vite's advisory >500 kB warning now appears for the shared
  three.js vendor chunk (497.8 → 507.1 kB, gzip 126.9 kB) because the renderer uses InstancedMesh,
  CatmullRomCurve3 and Raycaster. The module itself is lazy-loaded (112 kB chunk including the PDB
  file); the initial `index` chunk is 241 kB.
- `npm run test:browser` (production preview, Chromium SwiftShader WebGL): **97 passed = 24 Peptide +
  24 α-Helix + 31 β-Sheet + 18 Hydrophobic Core**; console errors / uncaught exceptions **0**.
  The existing helix/β-sheet scripts' navigation count assertion was updated from 3 to 4 modules
  (and the check label text); no check was removed or skipped.
- Hydrophobic Core browser checks: module navigation and 1UBQ loading; three representations; chemistry
  (label + color + symbol legend) and exposure coloring; buried/exposed highlighted residue lists equal
  the audit; 3D click picking of a rendered buried residue syncs selector/panel; drag does not select;
  residue panel values (class, %, rank, caveats, C-terminal/occupancy notes, His note) and selected
  color for six residues; clipping toggle/slider/reset restores the exact image; composition table equals
  audit; both exception buttons; full reset exact image; keyboard/mouse orbit, wheel zoom, Fit direction,
  Reset; 768/390/320 px with no horizontal overflow, controls outside the viewer, panel within width
  and tap selection; repeated navigation through all modules with a single canvas.
- Screenshots (ignored `artifacts/`) visually reviewed: `phase3a-hydrophobic-core.png`,
  `phase3a-buried.png`, `phase3a-exposed.png`, `phase3a-cross-section.png`, `phase3a-mobile-{768,390,320}.png`;
  results in `phase3a-browser-results.json`.
- Found and fixed during QA: mobile residue panel widened past 390 px (grid item min-width); cut spheres
  appeared hollow in clipping (back faces now shaded flat).

# Scientific simplifications

- One experimental conformer (crystal, 1.8 Å) of a dynamic protein; no ensemble, no dynamics.
- Isolated chain in vacuum-like SASA: waters, crystal contacts and binding partners are ignored.
- Heavy atoms only, element-level Bondi radii; no implicit or explicit hydrogens.
- rSASA uses Tien 2013 maxima computed with DSSP (different radii/method) on Gly-X-Gly; normalization
  is approximate and termini can exceed 100%.
- Four-class educational chemistry scheme; Gly counted as nonpolar; His grouped as basic without a
  fixed charge; Tyr/Cys as polar uncharged.
- 25% groups are within-protein ranks, not a buried/exposed definition.
- Ribbon width follows deposited HELIX/SHEET records; ribbon path is a spline through actual CA.
- Space filling shows vdW spheres; no molecular (Connolly/SES) surface is computed.
- Covalent bonds for display are inferred from distances (within residue + peptide C–N), 608 bonds, all
  1.1–1.95 Å, one connected chain, rings closed.

# Known limitations

- No FreeSASA/DSSP cross-check was possible in this environment (documented above).
- Composition is for one small protein; it is not a population statistic.
- Polar contacts are distance-only and do not establish hydrogen bonds or salt bridges.
- C-terminal residues 73–76 have partial occupancy; their exposure is flagged in the UI.
- Picking uses rendered geometry; in dense space-filling views the nearest visible atom is selected.
- Real iOS/Android touch hardware and Safari/Firefox not tested (Chromium viewport emulation only).
