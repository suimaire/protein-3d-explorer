# Phase 2B — β-Sheet validation

Validated 2026-09-09. Initial main / HEAD / origin/main: ccf54d1; clean working tree.
Live remote main confirmed unchanged before committing. Only protein-3d-explorer modified.

## Construction and invariants

Three Ac–(L-Ala)₇–NHMe strands: 144 atoms, 141 bonds, explicit amide H, no carbon-bound H.
Internal-coordinate builder and original covalent constants reused without modification.
φ target −135°, ψ target +132.27209925651545°; every Ala agrees within 1e−8°.
All 24 peptide groups, including cap boundaries, have trans ω within 1e−8° and six-atom
planarity displacement below 1e−10 Å. Every bond length and adjacent angle agrees with the
reference to 10 decimal places; all 21 Ala retain positive ordered N,C,Cβ chirality volume.
Actual Cα→Cβ z projections alternate sign for every adjacent residue (product <−0.5 Å²).
The sheet is untwisted but pleated: backbone atoms are not all coplanar.

The local right-handed frame uses the measured screw axis, transverse carbonyl direction,
and their cross product. Cα₄ is its origin. ψ was solved near +135° for a 180° screw step,
not fitted to a protein or a desired H-bond count. No independent atom offsets are applied.
Parallel reference translations: (0,0,0), (0,4.8,0), (0,9.6,0) Å.
Antiparallel: (0,0,0), (−0.4,5.5,0), (−0.2,10,0) Å; B uses diag(−1,−1,+1), a proper
rotation preserving L chirality. These are pleat-phase reference offsets, not universal
inter-strand distances. Both interfaces were separately screened for contacts and clashes.

## Coordinate-derived interaction audit

Chemical identity: O double-bonded to carbonyl C; H singly bonded to an amide N.
Screen: H···O 1.5–2.6 Å; N···O 2.5–3.5 Å; N–H···O ≥120°. All pairs are screened from
actual coordinates; only inter-strand Ala–Ala pairs enter the displayed network. No index rule.
Unchanged serious-clash policy: exclude 1–2/1–3/1–4, overlap >0.40 Å, same element radii.
Cap contacts are included and valid H-bonds are not counted as unfavorable clashes.

### antiparallel

- N→C vectors: (1.000000, 0.000000, -0.000000); (-1.000000, -0.000000, -0.000000); (1.000000, 0.000000, -0.000000).
- Displayed H-bonds: **14**; cap-inclusive valid H-bonds: **16**.
- Raw severe overlaps: **16**, all are valid O···H contacts.
- Serious unfavorable clashes: **0**.

| Acceptor C=O | Donor N–H | H···O Å | N···O Å | N–H···O ° | Display |
|---|---|---:|---:|---:|---|
| A Ac | B NHMe | 1.999241 | 3.006997 | 175.313400 | cap; audit only |
| A Ala 2 | B Ala 6 | 1.999241 | 3.006997 | 175.313393 | yes |
| B Ala 6 | A Ala 2 | 1.999241 | 3.006997 | 175.313380 | yes |
| A Ala 4 | B Ala 4 | 1.999241 | 3.006997 | 175.313387 | yes |
| B Ala 4 | A Ala 4 | 1.999241 | 3.006997 | 175.313387 | yes |
| A Ala 6 | B Ala 2 | 1.999241 | 3.006997 | 175.313380 | yes |
| B Ala 2 | A Ala 6 | 1.999241 | 3.006997 | 175.313393 | yes |
| B Ac | A NHMe | 1.999241 | 3.006997 | 175.313400 | cap; audit only |
| B Ala 1 | C Ala 7 | 2.033922 | 3.042944 | 176.915532 | yes |
| C Ala 7 | B Ala 1 | 2.033922 | 3.042944 | 176.915498 | yes |
| B Ala 3 | C Ala 5 | 2.033922 | 3.042944 | 176.915521 | yes |
| C Ala 5 | B Ala 3 | 2.033922 | 3.042944 | 176.915509 | yes |
| B Ala 5 | C Ala 3 | 2.033922 | 3.042944 | 176.915509 | yes |
| C Ala 3 | B Ala 5 | 2.033922 | 3.042944 | 176.915521 | yes |
| B Ala 7 | C Ala 1 | 2.033922 | 3.042944 | 176.915498 | yes |
| C Ala 1 | B Ala 7 | 2.033922 | 3.042944 | 176.915532 | yes |

### parallel

- N→C vectors: (1.000000, 0.000000, -0.000000); (1.000000, 0.000000, -0.000000); (1.000000, 0.000000, -0.000000).
- Displayed H-bonds: **12**; cap-inclusive valid H-bonds: **16**.
- Raw severe overlaps: **16**, all are valid O···H contacts.
- Serious unfavorable clashes: **0**.

| Acceptor C=O | Donor N–H | H···O Å | N···O Å | N–H···O ° | Display |
|---|---|---:|---:|---:|---|
| A Ac | B Ala 1 | 2.024259 | 2.987920 | 158.709826 | cap; audit only |
| A Ala 2 | B Ala 3 | 2.024259 | 2.987920 | 158.709820 | yes |
| B Ala 1 | A Ala 2 | 2.024259 | 2.987920 | 158.709821 | yes |
| A Ala 4 | B Ala 5 | 2.024259 | 2.987920 | 158.709814 | yes |
| B Ala 3 | A Ala 4 | 2.024259 | 2.987920 | 158.709815 | yes |
| A Ala 6 | B Ala 7 | 2.024259 | 2.987920 | 158.709808 | yes |
| B Ala 5 | A Ala 6 | 2.024259 | 2.987920 | 158.709809 | yes |
| B Ala 7 | A NHMe | 2.024259 | 2.987921 | 158.709803 | cap; audit only |
| B Ac | C Ala 1 | 2.024259 | 2.987920 | 158.709826 | cap; audit only |
| B Ala 2 | C Ala 3 | 2.024259 | 2.987920 | 158.709820 | yes |
| C Ala 1 | B Ala 2 | 2.024259 | 2.987920 | 158.709821 | yes |
| B Ala 4 | C Ala 5 | 2.024259 | 2.987920 | 158.709814 | yes |
| C Ala 3 | B Ala 4 | 2.024259 | 2.987920 | 158.709815 | yes |
| B Ala 6 | C Ala 7 | 2.024259 | 2.987920 | 158.709808 | yes |
| C Ala 5 | B Ala 6 | 2.024259 | 2.987920 | 158.709809 | yes |
| C Ala 7 | B NHMe | 2.024259 | 2.987921 | 158.709803 | cap; audit only |

## Verification and reproducibility

- Original 107 unit tests preserved; 32 new tests; **139 passed**.
- New tests independently calculate torsions, planes, all bond lengths/angles, chirality,
  side-chain normal projections and adjacent strand direction dot products. They verify both
  interfaces are connected, real donor/acceptor criteria, cap-inclusive sterics and plot mapping.
- Negative control: translating strands far apart removes the entire teaching H-bond network.
  A single strand yields no sheet network. Switching back reconstructs the original coordinates.
- Strict TypeScript and production build passed.
- Real Chromium / software WebGL production preview: **79 checks passed**
  (24 Peptide Geometry + 24 α-Helix + 31 β-Sheet).
- β-Sheet checks cover both arrangements, five toggles, focused atom ids and all measured values,
  six representative strand/residue selections per arrangement, actual Ramachandran marker,
  safe focus reset on switching, full reset pixel equality, Sheet/Top/Edge cameras, orbit/zoom,
  fit direction preservation, mobile selectors, and repeated navigation/disposal.
- Desktop 1440×1100 and 768/390/320 px layouts: no horizontal overflow.
  Antiparallel, parallel, Edge and 390 px captures visually reviewed.
- Console errors **0**; uncaught exceptions **0**.
- Run npm run typecheck, npm test, npm run build, then start npm run preview and run
  npm run test:browser. The existing local .browser-cache is detected automatically.
- node scripts/beta-audit.mjs regenerates artifacts/beta-audit.json with every atom, bond,
  residue torsion, direction vector, displayed pair, cap pair and raw/serious overlap.
- artifacts/phase2b-browser-results.json records browser checks. Captures:
  phase2b-beta-antiparallel.png, phase2b-beta-parallel.png, phase2b-beta-edge-view.png,
  phase2b-mobile-{768,390,320}.png. All artifacts are locally retained and Git-ignored.

## Interpretation limits

Idealized educational poly-L-alanine; not experimental coordinates or an energy calculation.
Real sheets can twist and have distributed sequence/environment-dependent torsions. A strand
is a segment, and several segments of one polypeptide can contribute to a sheet. These separate
capped strands are a teaching convenience. Parallel and antiparallel are not a stability ranking.
Carbon-bound H, solvent, dynamics, folding, turns and hairpin connections are not modeled.
Mobile validation uses Chromium viewport emulation, not physical touch devices or Safari/Firefox.
See SCIENTIFIC_NOTES.md for references and the complete scientific assumptions.
