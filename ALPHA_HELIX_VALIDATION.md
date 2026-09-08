# Phase 2A — α-Helix validation

Validated 2026-09-09. Baseline: main / 2dbf7b2, initially clean.

## Model and measured geometry

Ac–(L-Ala)12–NHMe: 12 Ala + neutral Ac/NHMe caps; 78 atoms, 77 bonds.
Reuses Phase 1 internal-coordinate builder and unchanged covalent constants.
No mesh substitute, atom repositioning for display, mirror transform, minimization or dynamics.

| Quantity | Target / criterion | Measured |
|---|---|---|
| φ, Ala 1–12 | −60°, tolerance 1e−8° | −60° |
| ψ, Ala 1–12 | −45°, tolerance 1e−8° | −45° |
| ω, 13 peptide groups | ±180°, tolerance 1e−8° | trans |
| Peptide planarity | normal displacement <1e−10 Å | passed, all six-atom groups |
| Every bond length / adjacent angle | unchanged vs extended reference | passed to 10 decimal places |
| L-Ala chirality | positive ordered N,C,Cβ signed volume | passed for 12 residues |
| Screw twist | positive signed rotation along N→C axis | +98.869342° / residue |
| Residues / turn | compare approximate reference 3.6 | 3.641169 |
| Rise / residue | compare approximate reference 1.5 Å | 1.540360 Å |
| Pitch | compare approximate reference 5.4 Å | 5.608710 Å |
| Cα→Cβ outward projection | positive dot product with radial vector | passed for 12 residues |

The reference dimensions are approximate. The measured values are determined by our fixed bond
geometry and chosen −60°/−45° torsions; they were not tuned to match round numbers.
The N→C unit axis is (0.625071153, 0.503883670, 0.596143692). It is derived from the cross product
of successive Cα displacement differences, with sign oriented along positive axial translation.
Each adjacent pair has positive signed radial rotation. This verifies handedness independently
of a visual resemblance. Top camera direction is also checked against this axis in Chromium.

## H-bond pair audit

Eligibility is Ala-only i→i+4; the screen requires O···N 2.5–3.5 Å, H···O 1.5–2.6 Å,
N–H···O ≥120°. This is a geometric display criterion, not an energy estimate.

| Acceptor C=O residue | Donor N–H residue | O···N Å | H···O Å | N–H···O ° |
|---|---|---:|---:|---:|
| Ala 1 | Ala 5 | 3.060309 | 2.082598 | 162.321327 |
| Ala 2 | Ala 6 | 3.060309 | 2.082598 | 162.321327 |
| Ala 3 | Ala 7 | 3.060309 | 2.082598 | 162.321327 |
| Ala 4 | Ala 8 | 3.060309 | 2.082598 | 162.321327 |
| Ala 5 | Ala 9 | 3.060309 | 2.082598 | 162.321327 |
| Ala 6 | Ala 10 | 3.060309 | 2.082598 | 162.321327 |
| Ala 7 | Ala 11 | 3.060309 | 2.082598 | 162.321327 |
| Ala 8 | Ala 12 | 3.060309 | 2.082598 | 162.321327 |

Expected candidates = max(0,n−4), not a fixed count of eight. Tests use 10, 12 and 14 residues.
All 8 candidates pass for the chosen model. The UI reports actual displayed count (0 when hidden).
Negative controls: moved acceptor, reversed donor H, and extended backbone suppress invalid pairs.
The first four Ala donors and last four Ala acceptors have no partner in the displayed Ala-only
network. Cap contacts are excluded from display, not from coordinates or steric evaluation.

## Serious-overlap detector audit

Policy is exactly Phase 1.1: exclude 1–2 / 1–3 / 1–4; overlap >0.40 Å;
C 1.70, N 1.55, O 1.52, polar amide H 1.00 Å; cap nonlocal contacts retained.

**Raw detector count: 10. Other reported contacts: 0.** All hits are O(i)···H(i+4),
with distance 2.082598 Å and nominal overlap 1.52 + 1.00 − 2.082598 = 0.437402 Å.

| Atom pair | Classification |
|---|---|
| 0:O – 4:H | Ac acceptor / Ala 4 donor; cap contact |
| 1:O – 5:H | displayed backbone H-bond |
| 2:O – 6:H | displayed backbone H-bond |
| 3:O – 7:H | displayed backbone H-bond |
| 4:O – 8:H | displayed backbone H-bond |
| 5:O – 9:H | displayed backbone H-bond |
| 6:O – 10:H | displayed backbone H-bond |
| 7:O – 11:H | displayed backbone H-bond |
| 8:O – 12:H | displayed backbone H-bond |
| 9:O – 13:H | Ala 9 acceptor / NHMe donor; cap contact |

These are directionally plausible hydrogen-bond contacts. The existing radial detector does not
classify favorable donor/acceptor contacts and reports them as serious overlaps. This is a known
chemical limitation of that indicator, not evidence of ten independent severe structural defects.
We investigated the coordinates, retained −60°/−45° and all detection settings, and exposed the raw
count and explanation in the UI. No non-H-bond hits remain unexplained. No complete all-atom or
external force-field validation is claimed; carbon-bound H remains absent.

## Verification

- 77 existing tests unchanged + 16 new tests = **93 passed**.
- Strict TypeScript typecheck and production build passed.
- Chromium production preview: **24 existing + 23 new = 47 checks passed**.
- Drag, keyboard/wheel zoom, Side/Top/Reset/Fit, five toggles, H-bond focus and endpoint labels,
  residue/plot sync, readonly plot, display count, repeated navigation/disposal all passed.
- Desktop 1440×1100; responsive 768/390/320 px, no horizontal overflow.
- Console errors 0; uncaught exceptions 0.
- Captures: `artifacts/phase2a-alpha-helix.png`, `phase2a-alpha-helix-top.png`,
  `phase2a-mobile-{768,390,320}.png`; result list `phase2a-browser-results.json`.
- Desktop, Top and 390 px mobile captures visually reviewed. Hardware mobile touch,
  Safari/Firefox and external experimental structure validation are outside this verification.
